"""Paste into a private Kaggle TPU notebook for one synthetic capability probe.

This reads no datasets, environment values, credentials, or Yellow files. It does
not download a model or open a listener.
"""

import importlib.util
import json
import os
import platform
import time


receipt = {
    "schema": "yellow-hardware-probe-v1",
    "python": platform.python_version(),
    "system": platform.system(),
    "cpu_count": os.cpu_count(),
    "accelerator": "none",
    "devices": [],
    "checks": {},
}
with open("/proc/meminfo", encoding="utf-8") as source:
    line = next((item for item in source if item.startswith("MemTotal:")), None)
receipt["ram_bytes"] = int(line.split()[1]) * 1024 if line else None
receipt["checks"]["packages"] = {
    name: importlib.util.find_spec(name) is not None
    for name in ("jax", "jaxlib", "torch", "torch_xla", "transformers", "flax")
}

try:
    import jax
    import jax.numpy as jnp

    receipt["checks"]["jax"] = jax.__version__
    devices = [device for device in jax.devices() if device.platform == "tpu"]
    receipt["devices"] = [
        {"name": str(device.device_kind), "platform": device.platform}
        for device in devices[:8]
    ]
    if devices:
        receipt["accelerator"] = "tpu"
        started = time.perf_counter()
        result = jnp.ones((128, 128), dtype=jnp.float32) @ jnp.ones(
            (128, 128), dtype=jnp.float32
        )
        result.block_until_ready()
        receipt["checks"]["tiny_matmul_ms"] = round(
            (time.perf_counter() - started) * 1000, 2
        )
        receipt["checks"]["tiny_matmul_ok"] = float(result[0, 0]) == 128.0
except Exception as error:
    receipt["checks"]["jax_error"] = type(error).__name__

print(json.dumps(receipt, sort_keys=True))
