"""Install a checksummed public llama.cpp CUDA runtime in ephemeral Worker 2 storage.

No model, Yellow source or account key is downloaded by this cell. Both release
assets are pinned and extracted with Python's data-only tar filter.
"""

import hashlib
import json
from pathlib import Path
import tarfile
import time
import urllib.request


VERSION = "b11216"
BASE = f"https://github.com/ggml-org/llama.cpp/releases/download/{VERSION}"
ROOT = Path("/tmp/yellow-llama-b11216")
ASSETS = (
    (
        "llama-b11216-bin-ubuntu-cuda-12.8-x64.tar.gz",
        172_252_243,
        "058181c6679888d06385f6ca81b9f6cc0490f35cbd385e4a7fcafd1f8cb32289",
    ),
    (
        "cudart-llama-b11216-bin-ubuntu-cuda-12.8-x64.tar.gz",
        594_377_812,
        "9183c84ca889e62e023a3bd81176633eea8c229f4c4407ea41163870abecef6c",
    ),
)


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def download(name: str, size: int, expected_sha256: str, root: Path) -> Path:
    target = root / name
    if target.exists() and target.stat().st_size == size and digest(target) == expected_sha256:
        return target
    temporary = root / (name + ".part")
    request = urllib.request.Request(f"{BASE}/{name}", headers={"User-Agent": "Yellow-Model-Eval/1"})
    started = time.monotonic()
    total = 0
    result = hashlib.sha256()
    with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as output:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > size or time.monotonic() - started > 900:
                raise RuntimeError("Release download exceeded its size or time budget")
            result.update(chunk)
            output.write(chunk)
    if total != size or result.hexdigest() != expected_sha256:
        raise RuntimeError("Release asset byte count or SHA-256 did not match")
    temporary.replace(target)
    return target


def extract(archive: Path, directory: Path) -> None:
    with tarfile.open(archive, "r:gz") as source:
        source.extractall(directory, filter="data")


def setup(root: Path = ROOT) -> dict:
    root.mkdir(parents=True, exist_ok=True)
    files = [download(name, size, sha, root) for name, size, sha in ASSETS]
    runtime = root / "runtime"
    runtime.mkdir(exist_ok=True)
    for archive in files:
        extract(archive, runtime)
    binaries = sorted(path for path in runtime.rglob("llama-cli") if path.is_file())
    if len(binaries) != 1:
        raise RuntimeError("Expected exactly one llama-cli binary in pinned release")
    return {
        "schema": "yellow-llama-runtime-v1",
        "version": VERSION,
        "binary": str(binaries[0]),
        "sha256": {name: sha for name, _size, sha in ASSETS},
    }


if __name__ == "__main__":
    print(json.dumps(setup(), sort_keys=True))
