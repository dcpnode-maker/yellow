"""Verify pinned llama.cpp binary and both CUDA devices before model loading."""

import json
import os
from pathlib import Path
import subprocess


RUNTIME = Path("/tmp/yellow-llama-b11216/runtime")
BINARY = RUNTIME / "llama-b11216" / "llama-cli"


def runtime_env(runtime: Path = RUNTIME) -> dict[str, str]:
    env = os.environ.copy()
    directories = sorted({str(path.parent) for path in runtime.rglob("*.so*") if path.is_file()})
    env["LD_LIBRARY_PATH"] = ":".join([*directories, env.get("LD_LIBRARY_PATH", "")])
    return env


def probe() -> dict:
    if not BINARY.is_file():
        raise RuntimeError("Pinned llama-cli binary is missing")
    env = runtime_env()
    results = {}
    for label, flag in (("version", "--version"), ("devices", "--list-devices")):
        completed = subprocess.run(
            [str(BINARY), flag], env=env, capture_output=True, text=True,
            timeout=60, check=False,
        )
        results[label] = {
            "returncode": completed.returncode,
            "output": (completed.stdout + completed.stderr)[-6000:],
        }
    return {"schema": "yellow-gpu-runtime-probe-v1", "binary": str(BINARY), "results": results}


if __name__ == "__main__":
    print(json.dumps(probe(), sort_keys=True))
