"""Download only the pinned public Qwen3.8 GGUF into ephemeral Worker 2 cache.

This cell does not load or execute a model and never reads Yellow source/data.
The exact byte count and SHA-256 are verified before inference is considered.
"""

import hashlib
import json
from pathlib import Path
import time


REPO_ID = "unsloth/Qwen3.8-27B-GGUF"
REVISION = "4ca720788d1e01f1bff70c033e0d0028fd02e502"
FILENAME = "Qwen3.8-27B-UD-Q4_K_M.gguf"
EXPECTED_BYTES = 16_464_440_224
EXPECTED_SHA256 = "322e194ff79741c7baa497c240f677f54b201b0efab44ca8e50f122b39123482"
CACHE = Path.home() / ".cache" / "huggingface" / "yellow-qwen38"


def sha256(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(4 * 1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def download() -> dict:
    from huggingface_hub import hf_hub_download

    started = time.perf_counter()
    path = Path(hf_hub_download(
        repo_id=REPO_ID,
        filename=FILENAME,
        revision=REVISION,
        cache_dir=CACHE,
    ))
    size = path.stat().st_size
    digest = sha256(path)
    if size != EXPECTED_BYTES or digest != EXPECTED_SHA256:
        raise RuntimeError("Pinned model bytes or SHA-256 did not match")
    return {
        "schema": "yellow-gpu-model-download-v1",
        "repo_id": REPO_ID,
        "revision": REVISION,
        "filename": FILENAME,
        "bytes": size,
        "sha256": digest,
        "path": str(path),
        "elapsed_seconds": round(time.perf_counter() - started, 2),
    }


if __name__ == "__main__":
    print(json.dumps(download(), sort_keys=True))
