"""Build pinned llama.cpp with Kaggle's own glibc/CUDA after binary ABI mismatch.

Only public upstream source is cloned. No Yellow data, keys or model are sent
to this build. Logs and artifacts stay in ephemeral /tmp storage.
"""

import json
import os
from pathlib import Path
import platform
import signal
import subprocess
import time


TAG = "b11216"
COMMIT = "c8296709920f9c1ae168bfd5fe66f9f73637bd60"
ROOT = Path("/tmp/yellow-llama-source-b11216")
SOURCE = ROOT / "src"
BUILD = ROOT / "build"
DRIVER_LIBRARY = Path("/usr/local/nvidia/lib64/libcuda.so")


def run(command: list[str], timeout: int, log: Path) -> float:
    started = time.perf_counter()
    with log.open("w", encoding="utf-8") as output:
        process = subprocess.Popen(command, stdout=output, stderr=subprocess.STDOUT,
                                   text=True, start_new_session=True)
        try:
            returncode = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=10)
            raise RuntimeError("Pinned build command exceeded its bounded time") from exc
    if returncode != 0:
        tail = log.read_text(encoding="utf-8", errors="replace")[-3000:]
        raise RuntimeError(f"Pinned build command failed ({returncode}): {tail}")
    return round(time.perf_counter() - started, 2)


def build() -> dict:
    ROOT.mkdir(parents=True, exist_ok=True)
    times = {}
    if not SOURCE.exists():
        times["clone_seconds"] = run([
            "git", "clone", "--depth", "1", "--branch", TAG,
            "https://github.com/ggml-org/llama.cpp.git", str(SOURCE),
        ], 300, ROOT / "clone.log")
    head = subprocess.check_output(["git", "-C", str(SOURCE), "rev-parse", "HEAD"],
                                   text=True).strip()
    if head != COMMIT:
        raise RuntimeError("llama.cpp source commit does not match pinned release")
    if not DRIVER_LIBRARY.is_file():
        raise RuntimeError("Kaggle CUDA driver library is unavailable")
    times["configure_seconds"] = run([
        "cmake", "-S", str(SOURCE), "-B", str(BUILD),
        "-DGGML_CUDA=ON", "-DCMAKE_CUDA_ARCHITECTURES=75",
        f"-DCUDA_cuda_driver_LIBRARY={DRIVER_LIBRARY}",
        "-DCMAKE_BUILD_TYPE=Release", "-DLLAMA_CURL=OFF",
        "-DLLAMA_BUILD_TESTS=OFF", "-DGGML_NATIVE=OFF",
    ], 300, ROOT / "configure.log")
    times["build_seconds"] = run([
        "cmake", "--build", str(BUILD), "--target", "llama-cli", "-j", "4",
    ], 2400, ROOT / "build.log")
    binary = BUILD / "bin" / "llama-cli"
    if not binary.is_file():
        raise RuntimeError("Pinned source build did not produce llama-cli")
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = str(binary.parent) + ":" + env.get("LD_LIBRARY_PATH", "")
    devices = subprocess.run([str(binary), "--list-devices"], env=env,
                             capture_output=True, text=True, timeout=60, check=False)
    if devices.returncode != 0:
        raise RuntimeError("Built llama-cli cannot enumerate CUDA devices")
    return {
        "schema": "yellow-llama-source-build-v1",
        "tag": TAG,
        "commit": head,
        "libc": platform.libc_ver(),
        "binary": str(binary),
        "times": times,
        "devices": (devices.stdout + devices.stderr)[-3000:],
    }


if __name__ == "__main__":
    print(json.dumps(build(), sort_keys=True))
