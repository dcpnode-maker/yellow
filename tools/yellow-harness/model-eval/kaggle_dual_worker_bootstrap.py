"""Restartable synthetic Qwen3.8 worker cell for two personally operated Kaggle GPUs.

Paste this exact file into each notebook code cell. It fetches only pinned public
upstream model/runtime artifacts, keeps weights and runtime in /kaggle/working,
and runs one bounded synthetic inference. No listener or Yellow data is used.
"""

import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import threading
import time


ROOT = Path("/kaggle/working/yellow-qwen38")
WEIGHTS = ROOT / "weights"
RUNTIME = ROOT / "runtime"
MODEL_NAME = "Qwen3.8-27B-UD-Q4_K_M.gguf"
MODEL = WEIGHTS / MODEL_NAME
MODEL_BYTES = 16_464_440_224
MODEL_SHA256 = "322e194ff79741c7baa497c240f677f54b201b0efab44ca8e50f122b39123482"
MODEL_REPO = "unsloth/Qwen3.8-27B-GGUF"
MODEL_REVISION = "4ca720788d1e01f1bff70c033e0d0028fd02e502"
LLAMA_TAG = "b11216"
LLAMA_COMMIT = "c8296709920f9c1ae168bfd5fe66f9f73637bd60"
SOURCE = Path("/tmp/yellow-llama-source-b11216/src")
BUILD = Path("/tmp/yellow-llama-source-b11216/build")
DRIVER_LIBRARY = Path("/usr/local/nvidia/lib64/libcuda.so")
PROMPT = (
    "Write only Python 3 code for a function coalesce_nights(stays). "
    "Each stay is a tuple (start_day, end_day) with integer, inclusive dates. "
    "Return sorted merged tuples, combining overlapping or immediately adjacent "
    "stays. Do not mutate the input. Return [] for empty input. Raise ValueError "
    "for any stay with end_day < start_day. Example: [(5, 7), (1, 2), (3, 4)] "
    "returns [(1, 7)]."
)


def digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(4 * 1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def run_logged(command: list[str], log: Path, timeout: int) -> float:
    started = time.perf_counter()
    with log.open("w", encoding="utf-8") as output:
        process = subprocess.Popen(command, stdout=output, stderr=subprocess.STDOUT,
                                   text=True, start_new_session=True)
        try:
            returncode = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired as error:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=10)
            raise RuntimeError(f"Timed out: {command[0]}; log: {log}") from error
    if returncode != 0:
        tail = log.read_text(encoding="utf-8", errors="replace")[-3000:]
        raise RuntimeError(f"Command failed ({returncode}): {command[0]}\n{tail}")
    return round(time.perf_counter() - started, 2)


def runtime_env() -> dict[str, str]:
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = ":".join((str(RUNTIME), str(DRIVER_LIBRARY.parent),
                                         env.get("LD_LIBRARY_PATH", "")))
    return env


def runtime_devices() -> str:
    binary = RUNTIME / "llama-cli"
    if not binary.is_file():
        raise RuntimeError("Pinned llama-cli binary is absent")
    result = subprocess.run([str(binary), "--list-devices"], env=runtime_env(),
                            capture_output=True, text=True, timeout=60, check=False)
    output = (result.stdout + result.stderr)[-5000:]
    if result.returncode != 0 or "CUDA0" not in output or "CUDA1" not in output:
        raise RuntimeError(f"Two-GPU runtime check failed: {output}")
    return output


def prepare_runtime() -> dict:
    try:
        return {"reused": True, "devices": runtime_devices()}
    except RuntimeError:
        pass
    if not DRIVER_LIBRARY.is_file():
        raise RuntimeError(f"CUDA driver stub is absent: {DRIVER_LIBRARY}")
    ROOT.mkdir(parents=True, exist_ok=True)
    log = ROOT / "runtime-build.log"
    timings = {}
    if not SOURCE.is_dir():
        SOURCE.parent.mkdir(parents=True, exist_ok=True)
        timings["clone_s"] = run_logged(
            ["git", "clone", "--depth", "1", "--branch", LLAMA_TAG,
             "https://github.com/ggml-org/llama.cpp.git", str(SOURCE)], log, 600)
    commit = subprocess.run(["git", "-C", str(SOURCE), "rev-parse", "HEAD"],
                            capture_output=True, text=True, timeout=15, check=True).stdout.strip()
    if commit != LLAMA_COMMIT:
        raise RuntimeError(f"Unexpected llama.cpp commit: {commit}")
    print("Pinned llama.cpp source verified; building CUDA runtime...", flush=True)
    timings["configure_s"] = run_logged(
        ["cmake", "-S", str(SOURCE), "-B", str(BUILD), "-DGGML_CUDA=ON",
         "-DCMAKE_CUDA_ARCHITECTURES=75", f"-DCUDA_cuda_driver_LIBRARY={DRIVER_LIBRARY}",
         "-DLLAMA_CURL=OFF", "-DLLAMA_BUILD_TESTS=OFF", "-DCMAKE_BUILD_TYPE=Release"],
        log, 300)
    timings["build_s"] = run_logged(
        ["cmake", "--build", str(BUILD), "--target", "llama-cli", "-j", "4"],
        log, 2400)
    if not (BUILD / "bin" / "llama-cli").is_file():
        raise RuntimeError("Successful build did not produce llama-cli")
    shutil.copytree(BUILD / "bin", RUNTIME, dirs_exist_ok=True, symlinks=True)
    return {"reused": False, "commit": commit, "timings": timings,
            "devices": runtime_devices()}


def prepare_model() -> dict:
    if MODEL.is_file() and MODEL.stat().st_size == MODEL_BYTES and digest(MODEL) == MODEL_SHA256:
        return {"reused": True, "bytes": MODEL_BYTES, "sha256": MODEL_SHA256}
    if MODEL.exists():
        raise RuntimeError("Existing model file has wrong size/hash; inspect it manually")
    free = shutil.disk_usage(ROOT.parent).free
    if free < MODEL_BYTES + 1_000_000_000:
        raise RuntimeError(f"Insufficient /kaggle/working space: {free} free bytes")
    WEIGHTS.mkdir(parents=True, exist_ok=True)
    from huggingface_hub import hf_hub_download
    print("Downloading pinned public Qwen3.8 GGUF...", flush=True)
    started = time.perf_counter()
    path = Path(hf_hub_download(repo_id=MODEL_REPO, filename=MODEL_NAME,
                                revision=MODEL_REVISION, local_dir=WEIGHTS))
    if path != MODEL or path.stat().st_size != MODEL_BYTES or digest(path) != MODEL_SHA256:
        raise RuntimeError("Downloaded model identity does not match pinned SHA-256")
    return {"reused": False, "download_s": round(time.perf_counter() - started, 2),
            "bytes": MODEL_BYTES, "sha256": MODEL_SHA256}


def gpu_memory_mb() -> list[int]:
    result = subprocess.run(["nvidia-smi", "--query-gpu=memory.used",
                             "--format=csv,noheader,nounits"],
                            capture_output=True, text=True, timeout=15, check=False)
    try:
        return [int(line.strip()) for line in result.stdout.splitlines()] if result.returncode == 0 else []
    except ValueError:
        return []


def inference_command() -> list[str]:
    return [str(RUNTIME / "llama-cli"), "--model", str(MODEL),
            "--split-mode", "layer", "--tensor-split", "1,1", "--n-gpu-layers", "999",
            "--ctx-size", "2048", "--n-predict", "384", "--reasoning", "off",
            "--temp", "0.7", "--top-p", "0.8", "--top-k", "20", "--seed", "1",
            "--single-turn", "--no-display-prompt", "--prompt", PROMPT]


def probe() -> dict:
    before = gpu_memory_mb()
    peaks = before[:]
    finished = threading.Event()

    def sample() -> None:
        while not finished.wait(1):
            for index, used in enumerate(gpu_memory_mb()):
                if index < len(peaks):
                    peaks[index] = max(peaks[index], used)
                else:
                    peaks.append(used)

    monitor = threading.Thread(target=sample, daemon=True)
    monitor.start()
    started = time.perf_counter()
    try:
        result = subprocess.run(inference_command(), env=runtime_env(),
                                stdin=subprocess.DEVNULL, capture_output=True,
                                text=True, timeout=600, check=False)
    finally:
        finished.set()
        monitor.join(timeout=3)
    receipt = {"schema": "yellow-dual-qwen38-worker-v1", "status": "ok" if result.returncode == 0 else "error",
               "returncode": result.returncode, "elapsed_s": round(time.perf_counter() - started, 2),
               "gpu_before_mb": before, "gpu_peak_mb": peaks, "gpu_after_mb": gpu_memory_mb(),
               "stdout": result.stdout[-10000:], "stderr": result.stderr[-3000:]}
    (ROOT / "last_probe.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
    return receipt


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    print(json.dumps({"model": prepare_model()}, sort_keys=True), flush=True)
    print(json.dumps({"runtime": prepare_runtime()}, sort_keys=True), flush=True)
    print(json.dumps(probe(), sort_keys=True, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
