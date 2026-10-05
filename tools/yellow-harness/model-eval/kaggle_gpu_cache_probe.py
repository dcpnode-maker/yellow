"""Bounded writable-cache check before Worker 2's large public-model trial.

Writes and removes a single 1 MiB temporary file in the model cache. A passing
probe does not prove Kaggle's full download quota or a successful model load.
"""

import json
import os
from pathlib import Path
import shutil
import tempfile


MODEL_BYTES = 16_464_440_224
RESERVE_BYTES = 8_000_000_000


def collect(cache: Path | None = None) -> dict:
    cache = cache or Path.home() / ".cache" / "huggingface" / "yellow-qwen38"
    result = {
        "schema": "yellow-gpu-cache-probe-v1",
        "model_bytes": MODEL_BYTES,
        "reserve_bytes": RESERVE_BYTES,
        "write_ok": False,
    }
    try:
        cache.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=cache) as sample:
            sample.write(bytes(1024 * 1024))
            sample.flush()
            os.fsync(sample.fileno())
        usage = shutil.disk_usage(cache)
        result.update({
            "cache_path": str(cache),
            "write_ok": True,
            "free_bytes": usage.free,
            "apparent_space_ok": usage.free >= MODEL_BYTES + RESERVE_BYTES,
        })
    except (OSError, ValueError) as error:
        result["error_type"] = type(error).__name__
    return result


if __name__ == "__main__":
    print(json.dumps(collect(), sort_keys=True))
