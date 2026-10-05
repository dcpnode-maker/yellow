"""Finite, manual notebook tasks using only a public synthetic parser contract.

No source checkout, guest data, credentials, listener, generated-code execution,
or source application is involved. Paste the cell and call run_task with one of
the fixed task IDs after the worker's startup inference succeeds.
"""

import hashlib
import json
import os
from pathlib import Path
import subprocess
import time


ROOT = Path("/kaggle/working/yellow-qwen38")
MODEL = ROOT / "weights" / "Qwen3.8-27B-UD-Q4_K_M.gguf"
BINARY = ROOT / "runtime" / "llama-cli"
MODEL_BYTES = 16_464_440_224
MODEL_SHA256 = "322e194ff79741c7baa497c240f677f54b201b0efab44ca8e50f122b39123482"
CONTRACT = (
    "Python 3 function strict_object(text): require str input, otherwise raise TypeError. "
    "Reject input with more than 1024 UTF-8 bytes using ValueError. Parse exactly one "
    "JSON object and return a dict; reject arrays, scalars and trailing non-whitespace. "
    "Reject duplicate object keys at every depth, and reject NaN, Infinity and -Infinity. "
    "Allow normal nested objects, arrays and surrounding whitespace. Use only Python "
    "stdlib json; never eval or execute input. No filesystem/network/subprocess calls."
)
TASKS = {
    "worker1-parser-proposal": (
        CONTRACT + " Write only the imports and complete implementation. No tests or explanation."
    ),
    "worker2-parser-tests": (
        CONTRACT + " Write only unittest tests. Import strict_object from harness_candidate. "
        "Use at least 8 short tests covering all requirements, including duplicate keys "
        "nested inside an array, multibyte UTF-8 size, and exactly 1024 accepted bytes. "
        "Do not implement strict_object. No explanation."
    ),
    "worker2-parser-tests-v2": (
        CONTRACT + " Write ONLY compact unittest code, at most 70 lines and 900 tokens. "
        "Directly import strict_object from harness_candidate. No import fallback, "
        "skipTest, comments, docstrings or explanation. At least 8 short test methods. "
        "Use ValueError or TypeError, never assertRaises(Exception). Test non-str, "
        "valid nested objects/arrays and whitespace, array/scalar rejection, trailing "
        "text, duplicate keys both top-level and nested inside an array, each of NaN, "
        "Infinity and -Infinity, over 1024 UTF-8 bytes including multibyte characters, "
        "and exactly 1024 bytes accepted. Compute padding from actual encoded lengths "
        "instead of assumed lengths. Do not implement strict_object."
    ),
}


def verify_model() -> None:
    if not MODEL.is_file() or MODEL.stat().st_size != MODEL_BYTES or not BINARY.is_file():
        raise RuntimeError("Verified worker setup must finish before task dispatch")
    hasher = hashlib.sha256()
    with MODEL.open("rb") as source:
        for chunk in iter(lambda: source.read(4 * 1024 * 1024), b""):
            hasher.update(chunk)
    if hasher.hexdigest() != MODEL_SHA256:
        raise RuntimeError("Task refused: model SHA-256 changed")


def task_command(task_id: str) -> list[str]:
    if task_id not in TASKS:
        raise ValueError("Unknown synthetic task ID")
    return [str(BINARY), "--model", str(MODEL), "--split-mode", "layer",
            "--tensor-split", "1,1", "--n-gpu-layers", "999", "--ctx-size", "4096",
            "--n-predict", "1024", "--reasoning", "off", "--temp", "0.7",
            "--top-p", "0.8", "--top-k", "20", "--seed", "1", "--single-turn",
            "--no-display-prompt", "--prompt", TASKS[task_id]]


def run_task(task_id: str) -> dict:
    command = task_command(task_id)
    verify_model()
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = str(BINARY.parent) + ":/usr/local/nvidia/lib64:" + env.get("LD_LIBRARY_PATH", "")
    started = time.perf_counter()
    try:
        result = subprocess.run(command, env=env, stdin=subprocess.DEVNULL,
                                capture_output=True, text=True, timeout=300, check=False)
        status, code, stdout, stderr = ("ok" if result.returncode == 0 else "error"), result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired as error:
        def decoded(value):
            return value.decode("utf-8", "replace") if isinstance(value, bytes) else value or ""
        status, code, stdout, stderr = "timeout", None, decoded(error.stdout), decoded(error.stderr)
    receipt = {"schema": "yellow-synthetic-harness-task-v1", "task_id": task_id,
               "status": status, "returncode": code, "elapsed_s": round(time.perf_counter() - started, 2),
               "stdout": stdout[-12000:], "stderr": stderr[-3000:], "model_sha256": MODEL_SHA256,
               "generated_code_executed": False, "source_applied": False}
    directory = ROOT / "tasks"
    directory.mkdir(exist_ok=True)
    (directory / (task_id + ".json")).write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(receipt, ensure_ascii=False, sort_keys=True), flush=True)
    return receipt
