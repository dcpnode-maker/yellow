"""Read-only filesystem/cache map for Worker 2 model-fit decisions."""

import json
import os
import shutil


def collect() -> dict:
    filesystems = {}
    for path in ("/", "/kaggle/working", "/tmp", "/root/.cache/huggingface"):
        if os.path.exists(path):
            usage = shutil.disk_usage(path)
            filesystems[path] = {
                "total_gb": round(usage.total / 1e9, 2),
                "free_gb": round(usage.free / 1e9, 2),
            }
    result = {"schema": "yellow-gpu-storage-v1", "filesystems": filesystems}
    try:
        from huggingface_hub import scan_cache_dir

        cache = scan_cache_dir()
        result["hf_cache_total_gb"] = round(cache.size_on_disk / 1e9, 2)
        result["prior_smoke_cache_gb"] = round(sum(
            repo.size_on_disk for repo in cache.repos
            if repo.repo_id == "Qwen/Qwen2.5-Coder-1.5B-Instruct"
        ) / 1e9, 2)
    except Exception as exc:
        result["hf_cache_error"] = type(exc).__name__
    return result


if __name__ == "__main__":
    print(json.dumps(collect(), sort_keys=True))
