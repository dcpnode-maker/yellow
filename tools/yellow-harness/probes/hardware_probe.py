"""Print a bounded, synthetic Kaggle/local accelerator capability receipt.

No network calls, environment-variable values, source files, models or private
datasets are read. Optional installed frameworks are used only for tiny tensors.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import platform
import sys
import time
from typing import Any


def memory_bytes(meminfo: str) -> int | None:
    for line in meminfo.splitlines():
        fields = line.split()
        if len(fields) == 3 and fields[0] == "MemTotal:" and fields[2] == "kB":
            try:
                return int(fields[1]) * 1024
            except ValueError:
                return None
    return None


def cpu_snapshot() -> dict[str, Any]:
    try:
        ram = memory_bytes(Path("/proc/meminfo").read_text(encoding="utf-8"))
    except OSError:
        ram = None
    return {
        "schema": "yellow-hardware-probe-v1",
        "python": platform.python_version(),
        "system": platform.system(),
        "cpu_count": os.cpu_count(),
        "ram_bytes": ram,
        "accelerator": "none",
        "devices": [],
        "checks": {},
    }


def add_cuda(receipt: dict[str, Any]) -> bool:
    try:
        import torch
    except ImportError:
        receipt["checks"]["torch"] = "not_installed"
        return False
    except Exception as exc:  # an installed framework may fail to initialize
        receipt["checks"]["torch"] = f"import_failed:{type(exc).__name__}"
        return False
    receipt["checks"]["torch"] = str(torch.__version__)
    if not torch.cuda.is_available():
        return False
    receipt["accelerator"] = "cuda"
    for index in range(min(torch.cuda.device_count(), 8)):
        device = torch.cuda.get_device_properties(index)
        receipt["devices"].append({
            "name": device.name,
            "memory_bytes": device.total_memory,
        })
    start = time.perf_counter()
    left = torch.ones((128, 128), device="cuda")
    right = left @ left
    torch.cuda.synchronize()
    receipt["checks"]["tiny_matmul_ms"] = round((time.perf_counter() - start) * 1000, 2)
    receipt["checks"]["tiny_matmul_ok"] = float(right[0, 0]) == 128.0
    return True


def add_jax_tpu(receipt: dict[str, Any]) -> None:
    try:
        import jax
        import jax.numpy as jnp
    except ImportError:
        receipt["checks"]["jax"] = "not_installed"
        return
    except Exception as exc:
        receipt["checks"]["jax"] = f"import_failed:{type(exc).__name__}"
        return
    receipt["checks"]["jax"] = str(jax.__version__)
    devices = [device for device in jax.devices() if device.platform == "tpu"]
    if not devices:
        return
    receipt["accelerator"] = "tpu"
    receipt["devices"] = [{"name": str(device.device_kind)} for device in devices[:8]]
    start = time.perf_counter()
    left = jnp.ones((128, 128), dtype=jnp.float32)
    result = left @ left
    result.block_until_ready()
    receipt["checks"]["tiny_matmul_ms"] = round((time.perf_counter() - start) * 1000, 2)
    receipt["checks"]["tiny_matmul_ok"] = float(result[0, 0]) == 128.0


def probe() -> dict[str, Any]:
    receipt = cpu_snapshot()
    if not add_cuda(receipt):
        add_jax_tpu(receipt)
    return receipt


if __name__ == "__main__":
    try:
        print(json.dumps(probe(), sort_keys=True))
    except Exception as exc:
        print(json.dumps({"schema": "yellow-hardware-probe-v1", "error": type(exc).__name__}))
        sys.exit(2)
