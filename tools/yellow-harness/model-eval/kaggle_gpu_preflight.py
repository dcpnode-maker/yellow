"""Read-only Worker 2 preflight before a large public-model download.

Paste this exact cell into the personally operated GPU notebook. It records
resources and local tool availability but downloads nothing and changes no
account, file, or runtime setting.
"""

import importlib.util
import json
import os
import platform
import shutil


MODEL_GGUF_GB = 16.5
MIN_FREE_DISK_GB = 25.0


def collect() -> dict:
    disk = shutil.disk_usage("/kaggle/working" if os.path.isdir("/kaggle/working") else ".")
    result = {
        "schema": "yellow-gpu-preflight-v1",
        "python": platform.python_version(),
        "cpu_count": os.cpu_count(),
        "cpu_model": None,
        "ram_total_bytes": None,
        "ram_available_bytes": None,
        "disk_total_gb": round(disk.total / 1_000_000_000, 2),
        "disk_used_gb": round(disk.used / 1_000_000_000, 2),
        "free_disk_gb": round(disk.free / 1_000_000_000, 2),
        "model_gguf_gb": MODEL_GGUF_GB,
        "download_space_ok": disk.free >= MIN_FREE_DISK_GB * 1_000_000_000,
        "commands": {name: bool(shutil.which(name)) for name in ("cmake", "c++", "nvcc", "llama-cli", "llama-server")},
        "packages": {name: importlib.util.find_spec(name) is not None for name in ("torch", "huggingface_hub", "llama_cpp")},
        "cuda_devices": [],
    }
    if os.path.isfile("/proc/cpuinfo"):
        with open("/proc/cpuinfo", encoding="utf-8") as source:
            result["cpu_model"] = next(
                (line.split(":", 1)[1].strip() for line in source if line.startswith("model name")),
                None,
            )
    if os.path.isfile("/proc/meminfo"):
        with open("/proc/meminfo", encoding="utf-8") as source:
            memory = {key.rstrip(":"): int(value.split()[0]) * 1024 for key, value in
                      (line.split(":", 1) for line in source if ":" in line)
                      if key in ("MemTotal", "MemAvailable")}
        result["ram_total_bytes"] = memory.get("MemTotal")
        result["ram_available_bytes"] = memory.get("MemAvailable")
    if result["packages"]["torch"]:
        import torch

        result["torch"] = str(torch.__version__)
        result["cuda_available"] = bool(torch.cuda.is_available())
        if torch.cuda.is_available():
            for index in range(min(torch.cuda.device_count(), 4)):
                device = torch.cuda.get_device_properties(index)
                free_bytes, _total_bytes = torch.cuda.mem_get_info(index)
                result["cuda_devices"].append({
                    "index": index,
                    "name": device.name,
                    "total_bytes": device.total_memory,
                    "free_bytes": free_bytes,
                    "capability": f"{device.major}.{device.minor}",
                })
    return result


if __name__ == "__main__":
    print(json.dumps(collect(), sort_keys=True))
