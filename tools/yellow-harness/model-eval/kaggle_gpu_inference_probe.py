"""One bounded, synthetic Qwen3.8 coding trial on Kaggle's two T4 GPUs.

This records model output for manual correctness review; it never executes
generated code, exposes a listener, or reads Yellow source/guest data.
"""

import json
import os
from pathlib import Path
import subprocess
import threading
import time


BINARY = Path("/kaggle/working/yellow-qwen38/runtime/llama-cli")
MODEL = Path("/kaggle/working/yellow-qwen38/weights/Qwen3.8-27B-UD-Q4_K_M.gguf")
PROMPT = (
    "Write only Python 3 code for a function coalesce_nights(stays). "
    "Each stay is a tuple (start_day, end_day) with integer, inclusive dates. "
    "Return sorted merged tuples, combining overlapping or immediately adjacent "
    "stays. Do not mutate the input. Return [] for empty input. Raise ValueError "
    "for any stay with end_day < start_day. Example: [(5, 7), (1, 2), (3, 4)] "
    "returns [(1, 7)]."
)


def memory_mb() -> list[int]:
    result = subprocess.run(
        ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
        capture_output=True, text=True, timeout=15, check=False,
    )
    if result.returncode != 0:
        return []
    try:
        return [int(line.strip()) for line in result.stdout.splitlines()]
    except ValueError:
        return []


def run_probe() -> dict:
    if not BINARY.is_file() or not MODEL.is_file():
        raise RuntimeError("Pinned binary or GGUF is unavailable")
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = str(BINARY.parent) + ":/usr/local/nvidia/lib64:" + env.get("LD_LIBRARY_PATH", "")
    command = [
        str(BINARY), "--model", str(MODEL), "--split-mode", "layer",
        "--tensor-split", "1,1", "--n-gpu-layers", "999", "--ctx-size", "2048",
        "--n-predict", "384", "--reasoning", "off", "--temp", "0.7",
        "--top-p", "0.8", "--top-k", "20", "--seed", "1",
        "--single-turn", "--no-display-prompt", "--prompt", PROMPT,
    ]
    before = memory_mb()
    peaks = before[:]
    finished = threading.Event()

    def sample() -> None:
        while not finished.wait(1):
            current = memory_mb()
            for index, used in enumerate(current):
                if index < len(peaks):
                    peaks[index] = max(peaks[index], used)
                else:
                    peaks.append(used)

    sampler = threading.Thread(target=sample, daemon=True)
    sampler.start()
    started = time.perf_counter()
    timed_out = False
    try:
        completed = subprocess.run(command, env=env, capture_output=True,
                                   text=True, stdin=subprocess.DEVNULL,
                                   timeout=600, check=False)
        returncode = completed.returncode
        stdout, stderr = completed.stdout, completed.stderr
    except subprocess.TimeoutExpired as error:
        timed_out = True
        returncode = None
        stdout, stderr = error.stdout or b"", error.stderr or b""
    finally:
        finished.set()
        sampler.join(timeout=3)

    def tail(value: str | bytes) -> str:
        if isinstance(value, bytes):
            value = value.decode("utf-8", errors="replace")
        return value[-10000:]

    return {
        "schema": "yellow-gpu-qwen38-coding-probe-v1",
        "model_file": MODEL.name,
        "model_bytes": MODEL.stat().st_size,
        "runtime": str(BINARY),
        "command_flags": command[3:-2],
        "elapsed_seconds": round(time.perf_counter() - started, 2),
        "status": "timeout" if timed_out else ("ok" if returncode == 0 else "error"),
        "returncode": returncode,
        "gpu_memory_before_mb": before,
        "gpu_memory_peak_mb": peaks,
        "gpu_memory_after_mb": memory_mb(),
        "stdout": tail(stdout),
        "stderr": tail(stderr),
    }


if __name__ == "__main__":
    print(json.dumps(run_probe(), sort_keys=True, ensure_ascii=False))
