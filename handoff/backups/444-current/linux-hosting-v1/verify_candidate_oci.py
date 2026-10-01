#!/usr/bin/env python3
"""Independent OCI layer/config-byte proof for the identity-repackaged candidate."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import stat

EXPECTED_LAYER_COUNT = 11
MAX_JSON_BYTES = 2 * 1024 * 1024
MAX_LAYER_BYTES = 1024 * 1024 * 1024
MAX_TOTAL_LAYER_BYTES = 2 * 1024 * 1024 * 1024
HEX64 = re.compile(r"^[0-9a-f]{64}$")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_read(path: Path, maximum: int) -> bytes:
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(path, flags)
    except OSError:
        raise ValueError("bounded OCI file unavailable") from None
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > maximum:
            raise ValueError("bounded OCI metadata file invalid")
        chunks = []
        remaining = maximum + 1
        while remaining:
            chunk = os.read(fd, min(1024 * 1024, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        data = b"".join(chunks)
        if len(data) > maximum:
            raise ValueError("bounded OCI metadata file invalid")
        return data
    finally:
        os.close(fd)


def safe_json(path: Path) -> object:
    return json.loads(safe_read(path, MAX_JSON_BYTES).decode("utf-8", "strict"))


def verify_layout_directories(layout: Path) -> None:
    if layout.is_symlink() or not layout.is_dir():
        raise ValueError("candidate layout path invalid")
    root_names = {entry.name for entry in layout.iterdir()}
    if root_names != {"oci-layout", "index.json", "blobs"}:
        raise ValueError("OCI layout root contains missing or extra paths")
    blobs = layout / "blobs"
    sha_dir = blobs / "sha256"
    for directory in (blobs, sha_dir):
        try:
            mode = directory.lstat().st_mode
        except OSError:
            raise ValueError("OCI layout directory missing") from None
        if stat.S_ISLNK(mode) or not stat.S_ISDIR(mode):
            raise ValueError("OCI layout contains symlinked or non-directory ancestor")
    if {entry.name for entry in blobs.iterdir()} != {"sha256"}:
        raise ValueError("OCI blob tree contains unexpected path")


def sha_file(path: Path) -> str:
    h = hashlib.sha256()
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise ValueError("OCI blob is not a regular file")
        with os.fdopen(fd, "rb", closefd=False) as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                h.update(chunk)
    finally:
        os.close(fd)
    return h.hexdigest()


def blob_path(root: Path, descriptor: object) -> tuple[Path, str, int]:
    if not isinstance(descriptor, dict) or descriptor.get("mediaType") != "application/vnd.oci.image.layer.v1.tar+gzip":
        raise ValueError("OCI layer descriptor media type mismatch")
    dgst = descriptor.get("digest")
    size = descriptor.get("size")
    if not isinstance(dgst, str) or not dgst.startswith("sha256:") or not HEX64.fullmatch(dgst[7:]) \
            or type(size) is not int or size < 0 or size > MAX_LAYER_BYTES:
        raise ValueError("OCI layer descriptor shape invalid")
    path = root / "blobs" / "sha256" / dgst[7:]
    if path.is_symlink() or not path.is_file() or path.stat().st_size != size:
        raise ValueError("OCI layer blob missing or wrong size")
    if sha_file(path) != dgst[7:]:
        raise ValueError("OCI compressed layer digest mismatch")
    return path, dgst[7:], size


def hash_gzip_layer(path: Path) -> tuple[str, int]:
    h = hashlib.sha256()
    total = 0
    with gzip.open(path, "rb") as stream:
        while True:
            chunk = stream.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_LAYER_BYTES:
                raise ValueError("OCI uncompressed layer exceeds limit")
            h.update(chunk)
    return h.hexdigest(), total


def verify(layout: Path, expected_image_id: str, expected_diff_ids: list[str]) -> dict:
    if len(expected_diff_ids) != EXPECTED_LAYER_COUNT:
        raise ValueError("candidate layout or expected layer list invalid")
    verify_layout_directories(layout)
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", expected_image_id):
        raise ValueError("candidate image identity invalid")
    if any(not isinstance(item, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", item)
           for item in expected_diff_ids):
        raise ValueError("candidate diff ID invalid")
    layout_meta = safe_json(layout / "oci-layout")
    if layout_meta != {"imageLayoutVersion": "1.0.0"}:
        raise ValueError("OCI layout marker mismatch")
    index_bytes = safe_read(layout / "index.json", MAX_JSON_BYTES)
    index = json.loads(index_bytes)
    descriptors = index.get("manifests") if isinstance(index, dict) else None
    if not isinstance(index, dict) or index.get("schemaVersion") != 2 \
            or not isinstance(descriptors, list) or len(descriptors) != 1:
        raise ValueError("OCI index descriptor count mismatch")
    root_descriptor = descriptors[0]
    manifest_digest = root_descriptor.get("digest") if isinstance(root_descriptor, dict) else None
    manifest_size = root_descriptor.get("size") if isinstance(root_descriptor, dict) else None
    if not isinstance(root_descriptor, dict) \
            or root_descriptor.get("mediaType") != "application/vnd.oci.image.manifest.v1+json" \
            or not isinstance(manifest_digest, str) or not manifest_digest.startswith("sha256:") \
            or not HEX64.fullmatch(manifest_digest[7:]) or type(manifest_size) is not int:
        raise ValueError("OCI manifest descriptor invalid")
    manifest_path = layout / "blobs" / "sha256" / manifest_digest[7:]
    if manifest_path.is_symlink() or not manifest_path.is_file():
        raise ValueError("OCI manifest missing")
    manifest_bytes = safe_read(manifest_path, MAX_JSON_BYTES)
    if len(manifest_bytes) != manifest_size or digest(manifest_bytes) != manifest_digest[7:]:
        raise ValueError("OCI manifest digest mismatch")
    manifest = json.loads(manifest_bytes)
    config = manifest.get("config") if isinstance(manifest, dict) else None
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 2 \
            or manifest.get("mediaType") != "application/vnd.oci.image.manifest.v1+json" \
            or not isinstance(config, dict) or config.get("mediaType") != "application/vnd.oci.image.config.v1+json":
        raise ValueError("OCI config descriptor invalid")
    if config.get("digest") != expected_image_id or type(config.get("size")) is not int:
        raise ValueError("OCI config descriptor does not match immutable image ID")
    config_path = layout / "blobs" / "sha256" / expected_image_id[7:]
    if type(config["size"]) is not int or config["size"] > 16 * 1024 * 1024 \
            or config_path.is_symlink() or not config_path.is_file() or config_path.stat().st_size != config["size"]:
        raise ValueError("opaque OCI config blob missing or wrong size")
    # Config bytes are hashed as opaque bytes; this verifier never decodes Config.Env.
    config_hash = sha_file(config_path)
    if config_hash != expected_image_id[7:]:
        raise ValueError("opaque OCI config digest mismatch")
    layers = manifest.get("layers")
    if not isinstance(layers, list) or len(layers) != EXPECTED_LAYER_COUNT:
        raise ValueError("OCI layer count mismatch")
    layer_proofs = []
    total_uncompressed = 0
    expected_blob_names = {expected_image_id[7:], manifest_digest[7:]}
    for ordinal, descriptor in enumerate(layers):
        path, compressed_hash, compressed_size = blob_path(layout, descriptor)
        expected_blob_names.add(compressed_hash)
        diff_id, uncompressed_size = hash_gzip_layer(path)
        expected = expected_diff_ids[ordinal][7:]
        if diff_id != expected:
            raise ValueError("OCI uncompressed diff ID mismatch")
        total_uncompressed += uncompressed_size
        if total_uncompressed > MAX_TOTAL_LAYER_BYTES:
            raise ValueError("OCI total uncompressed layers exceed limit")
        layer_proofs.append({"ordinal": ordinal, "compressed_sha256": compressed_hash,
                             "compressed_bytes": compressed_size, "diff_id": "sha256:" + diff_id,
                             "uncompressed_bytes": uncompressed_size})
    blob_dir = layout / "blobs" / "sha256"
    if blob_dir.is_symlink() or not blob_dir.is_dir():
        raise ValueError("OCI blob directory invalid")
    observed_blob_names = set()
    for path in blob_dir.iterdir():
        if path.is_symlink() or not path.is_file() or not HEX64.fullmatch(path.name):
            raise ValueError("OCI layout has a nonregular blob path")
        observed_blob_names.add(path.name)
    if observed_blob_names != expected_blob_names:
        raise ValueError("OCI layout has missing or extra blobs")
    return {"passed": True, "image_id": expected_image_id,
            "index_sha256": digest(index_bytes), "manifest_sha256": manifest_digest[7:],
            "config_sha256": config_hash, "config_bytes_interpreted": False,
            "config_env_inspected": False, "layer_count": len(layer_proofs),
            "layers": layer_proofs, "total_uncompressed_layer_bytes": total_uncompressed}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--layout", required=True, type=Path)
    parser.add_argument("--expected-image-id", required=True)
    parser.add_argument("--expected-diff-id", action="append", required=True)
    args = parser.parse_args()
    try:
        proof = verify(args.layout, args.expected_image_id, args.expected_diff_id)
    except BaseException as error:
        print(json.dumps({"passed": False, "error_type": type(error).__name__}))
        return 1
    print(json.dumps(proof, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
