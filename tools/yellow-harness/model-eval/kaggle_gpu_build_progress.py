"""Read-only status for the bounded Kaggle llama.cpp CUDA build."""

import json
from pathlib import Path
import subprocess


ROOT = Path("/tmp/yellow-llama-source-b11216")


def probe() -> dict:
    log = ROOT / "build.log"
    binary = ROOT / "build/bin/llama-cli"
    running = subprocess.run(
        ["ps", "-eo", "pid,ppid,etime,comm,args"], capture_output=True,
        text=True, timeout=15, check=False,
    )
    selected = [line[:240] for line in running.stdout.splitlines()
                if any(term in line for term in ("/tmp/yellow-llama-source-b11216",
                                                "cicc", "ptxas"))]
    return {
        "schema": "yellow-gpu-build-progress-v1",
        "binary_exists": binary.is_file(),
        "binary_bytes": binary.stat().st_size if binary.is_file() else None,
        "log_tail": log.read_text(encoding="utf-8", errors="replace")[-3500:]
                    if log.is_file() else None,
        "related_processes": selected[-20:],
    }


if __name__ == "__main__":
    print(json.dumps(probe(), sort_keys=True))
