"""Read-only CUDA driver-library probe for the pinned Kaggle GPU build."""

import json
import os
from pathlib import Path
import subprocess


ROOTS = (
    Path("/usr/lib/x86_64-linux-gnu"),
    Path("/usr/local/cuda/lib64/stubs"),
    Path("/usr/local/cuda/targets/x86_64-linux/lib/stubs"),
    Path("/usr/local/nvidia/lib64"),
    Path("/usr/local/nvidia/lib"),
    Path("/opt/nvidia/lib64"),
    Path("/opt/nvidia/lib"),
)


def probe() -> dict:
    paths = sorted(str(path) for root in ROOTS if root.is_dir()
                   for path in root.glob("libcuda.so*"))
    ldconfig = subprocess.run(["ldconfig", "-p"], capture_output=True,
                              text=True, timeout=15, check=False)
    return {
        "schema": "yellow-cuda-driver-probe-v1",
        "libcuda_paths": paths,
        "linker_entries": [line.strip() for line in ldconfig.stdout.splitlines()
                           if "libcuda.so" in line],
        "candidate_exists": {path: Path(path).exists() for path in paths},
        "ld_library_path": os.environ.get("LD_LIBRARY_PATH", ""),
        "nvidia_smi": subprocess.run(["which", "nvidia-smi"], capture_output=True,
                                      text=True, timeout=10, check=False).stdout.strip(),
        "nvidia_smi_ldd": subprocess.run(["ldd", "/usr/bin/nvidia-smi"],
                                         capture_output=True, text=True, timeout=10,
                                         check=False).stdout[-3000:],
    }


if __name__ == "__main__":
    print(json.dumps(probe(), sort_keys=True))
