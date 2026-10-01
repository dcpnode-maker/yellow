#!/usr/bin/env python3
"""Convert one bounded Docker-save or OCI image archive into an OCI image layout.

The converter treats config bytes as opaque except for reading RootFS.DiffIDs.
It never accesses, logs, or serializes config Env values.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import sys
import tarfile
import tempfile
import zlib
import gzip
from typing import Any, BinaryIO

MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024
MAX_MEMBERS = 4096
MAX_PATH_BYTES = 1024
MAX_JSON_BYTES = 1024 * 1024
MAX_CONFIG_BYTES = 16 * 1024 * 1024
MAX_LAYERS = 64
CHUNK = 1024 * 1024
SOURCE_REVISION = "9ff27ad8765dc75ebae9e083d4635c7a9b89fa62"
SOURCE_IMAGE_ID = "sha256:103cafd6ad6ca67c8ba4b41098c09cd325d3ac705e4867707b9f9ec49f9dc1f0"
SOURCE_DIFFIDS = [
    "sha256:0854555d70acaa318b38ee50bc667cb51ff6bf0757624624c7ff3b6fe17459a0",
    "sha256:9072d322eb16c6a414861801ae295eb67839e0aeabeab982bea0520b6fccdeaa",
    "sha256:135be4fad03ab91972ef4eb6846e200938c2dea183881ba5cac3d79648a09737",
    "sha256:7a415decbb54be30a9369d7466887b96544eedd7b28dbb7ad87dc6381a4b91a0",
    "sha256:fb0c09554b3fc2d49fda0df4305e80bbd89a17e405ed02b65b79c54fcf6fd637",
    "sha256:592e878c2cd79244e9ecf582b4688c9fa9c45bb31b1890119e1fb88fae6a6784",
    "sha256:e51fbaa4439c4e38781cc712ef035b33f5c6f5e3d4dd4d1377552689102b3d84",
    "sha256:06fca1b110f6a67625050001ccdee537dbe49390d99e394a9899f3c481b97b11",
    "sha256:62a99645d033b7c1dc411c85064e0b940519cea36a50120ac270e0833d6611a9",
    "sha256:357202e048be5e1a9cb55c7dee3c6a21374cd3ac5c1e0c2604b39b8dbf54c7a0",
    "sha256:cc5b9c2168d091be119bba2598b036189a0d8caaabef315faf89fe2eb1d60597",
]
OCI_MANIFEST = "application/vnd.oci.image.manifest.v1+json"
OCI_CONFIG = "application/vnd.oci.image.config.v1+json"
OCI_LAYER_GZIP = "application/vnd.oci.image.layer.v1.tar+gzip"
OCI_LAYER = "application/vnd.oci.image.layer.v1.tar"
DOCKER_MANIFEST = "application/vnd.docker.distribution.manifest.v2+json"
DOCKER_CONFIG = "application/vnd.docker.container.image.v1+json"
DOCKER_LAYER_GZIP = "application/vnd.docker.image.rootfs.diff.tar.gzip"
DOCKER_LAYER = "application/vnd.docker.image.rootfs.diff.tar"
HEX = re.compile(r"^[0-9a-f]{64}$")


class ConversionError(Exception):
    pass


def _fail(message: str) -> None:
    raise ConversionError(message)


def _json(data: bytes, where: str) -> Any:
    if len(data) > MAX_JSON_BYTES:
        _fail(f"{where} exceeds JSON size limit")
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in items:
            if key in result:
                _fail(f"duplicate JSON key in {where}")
            result[key] = value
        return result
    try:
        return json.loads(data, object_pairs_hook=pairs)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        _fail(f"invalid JSON in {where}: {exc}")


def _canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _digest(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def _safe_name(name: str) -> str:
    if not name or "\x00" in name or "\\" in name or len(name.encode("utf-8", "surrogatepass")) > MAX_PATH_BYTES:
        _fail("invalid archive path")
    path = PurePosixPath(name)
    parts = name.split("/")
    if name.endswith("/"):
        parts = parts[:-1]
    if path.is_absolute() or any(part in ("", ".", "..") for part in parts):
        _fail("unsafe archive path")
    # Tar commonly records directory names with a trailing slash.
    cleaned = name[:-1] if name.endswith("/") else name
    if not cleaned:
        _fail("invalid archive path")
    return cleaned


def _index_archive(tf: tarfile.TarFile) -> dict[str, tarfile.TarInfo]:
    members: dict[str, tarfile.TarInfo] = {}
    total = 0
    for number, member in enumerate(tf):
        if number >= MAX_MEMBERS:
            _fail("archive member count exceeds limit")
        name = _safe_name(member.name)
        if name in members:
            _fail("duplicate archive path")
        if member.isdir():
            pass
        elif not member.isreg():
            _fail("archive contains a link or non-regular entry")
        else:
            if member.size < 0:
                _fail("negative archive entry size")
            total += member.size
            if total > MAX_ARCHIVE_BYTES:
                _fail("archive expanded member bytes exceed limit")
        members[name] = member
    return members


def _read_member(tf: tarfile.TarFile, members: dict[str, tarfile.TarInfo], name: str,
                 limit: int = MAX_JSON_BYTES) -> bytes:
    member = members.get(name)
    if member is None or not member.isreg() or member.size > limit:
        _fail(f"missing, non-regular, or oversized archive entry: {name}")
    stream = tf.extractfile(member)
    if stream is None:
        _fail(f"cannot read archive entry: {name}")
    data = stream.read(limit + 1)
    if len(data) != member.size or len(data) > limit:
        _fail(f"truncated or oversized archive entry: {name}")
    return data


def _copy_member(tf: tarfile.TarFile, members: dict[str, tarfile.TarInfo], name: str,
                 dest: BinaryIO, limit: int = MAX_ARCHIVE_BYTES) -> tuple[str, int]:
    member = members.get(name)
    if member is None or not member.isreg():
        _fail(f"missing or non-regular archive entry: {name}")
    if member.size > limit:
        _fail("archive entry exceeds stream limit")
    stream = tf.extractfile(member)
    if stream is None:
        _fail(f"cannot read archive entry: {name}")
    h = hashlib.sha256()
    count = 0
    while True:
        chunk = stream.read(CHUNK)
        if not chunk:
            break
        count += len(chunk)
        if count > member.size or count > limit:
            _fail("archive entry exceeded declared or configured size")
        dest.write(chunk)
        h.update(chunk)
    if count != member.size:
        _fail(f"truncated archive entry: {name}")
    return "sha256:" + h.hexdigest(), count


def _config_diffids(config: bytes) -> list[str]:
    # Scan top-level JSON boundaries without decoding any non-rootfs value. In
    # particular, config.Env remains opaque bytes throughout this converter.
    def ws(pos: int) -> int:
        while pos < len(config) and config[pos] in b" \t\r\n":
            pos += 1
        return pos

    def string_end(pos: int) -> int:
        if pos >= len(config) or config[pos] != 34:
            _fail("invalid image config JSON string")
        pos += 1
        while pos < len(config):
            c = config[pos]
            if c == 92:
                pos += 2
                continue
            if c == 34:
                return pos + 1
            if c < 32:
                _fail("invalid control byte in image config JSON")
            pos += 1
        _fail("unterminated image config JSON string")

    def value_end(pos: int) -> int:
        start = pos
        stack: list[int] = []
        in_string = False
        escaped = False
        while pos < len(config):
            c = config[pos]
            if in_string:
                if escaped:
                    escaped = False
                elif c == 92:
                    escaped = True
                elif c == 34:
                    in_string = False
            elif c == 34:
                in_string = True
            elif c in (123, 91):
                stack.append(c)
            elif c in (125, 93):
                if not stack:
                    if c == 125:
                        break
                    _fail("invalid image config JSON nesting")
                opening = stack.pop()
                if (opening, c) not in ((123, 125), (91, 93)):
                    _fail("invalid image config JSON nesting")
            elif c == 44 and not stack:
                break
            pos += 1
        end = pos
        while end > start and config[end - 1] in b" \t\r\n":
            end -= 1
        if in_string or stack or end == start:
            _fail("invalid or truncated image config JSON value")
        return end

    pos = ws(0)
    if pos >= len(config) or config[pos] != 123:
        _fail("image config JSON must be an object")
    pos = ws(pos + 1)
    rootfs = None
    seen: set[str] = set()
    if pos < len(config) and config[pos] == 125:
        _fail("image config has no rootfs")
    while True:
        key_end = string_end(pos)
        try:
            key = json.loads(config[pos:key_end])
        except (UnicodeDecodeError, json.JSONDecodeError):
            _fail("invalid image config JSON key")
        if not isinstance(key, str) or key in seen:
            _fail("invalid or duplicate image config JSON key")
        seen.add(key)
        pos = ws(key_end)
        if pos >= len(config) or config[pos] != 58:
            _fail("invalid image config JSON object")
        pos = ws(pos + 1)
        end = value_end(pos)
        if key == "rootfs":
            rootfs = _json(config[pos:end], "image config rootfs")
        pos = ws(end)
        if pos >= len(config):
            _fail("truncated image config JSON object")
        if config[pos] == 125:
            pos = ws(pos + 1)
            break
        if config[pos] != 44:
            _fail("invalid image config JSON object delimiter")
        pos = ws(pos + 1)
    if pos != len(config):
        _fail("trailing bytes in image config JSON")
    if not isinstance(rootfs, dict) or rootfs.get("type") != "layers":
        _fail("image config has no supported rootfs")
    diffids = rootfs.get("diff_ids")
    if not isinstance(diffids, list) or len(diffids) > MAX_LAYERS:
        _fail("image config has invalid RootFS.DiffIDs")
    for item in diffids:
        if not isinstance(item, str) or not item.startswith("sha256:") or not HEX.fullmatch(item[7:]):
            _fail("image config has invalid RootFS diff ID")
    return diffids


def _verify_expected(config: bytes, expected_id: str, expected_diffids: list[str]) -> None:
    if _digest(config) != expected_id:
        _fail("config digest does not match expected image ID")
    if _config_diffids(config) != expected_diffids:
        _fail("ordered RootFS diff IDs do not match expected values")


def _new_output(path: Path) -> None:
    if path.is_symlink():
        _fail("output path cannot be a symlink")
    try:
        path.mkdir(parents=True, exist_ok=False, mode=0o700)
    except FileExistsError:
        if not path.is_dir() or any(path.iterdir()):
            _fail("output must be a fresh or empty directory")
    (path / "blobs" / "sha256").mkdir(parents=True, exist_ok=True, mode=0o700)


def _write_exclusive(path: Path, data: bytes) -> None:
    try:
        with path.open("xb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
    except FileExistsError:
        _fail(f"refusing to overwrite output: {path.name}")


def _publish_index(path: Path, data: bytes) -> None:
    # Publish by an exclusive hard link only after the complete file is durable.
    # A failed write therefore cannot leave a partial index.json behind.
    tmp = path.parent / (".index-pending-" + secrets.token_hex(12))
    try:
        with tmp.open("xb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        try:
            os.link(tmp, path)
        except FileExistsError:
            _fail("refusing to overwrite output: index.json")
    except OSError as exc:
        _fail(f"cannot publish OCI index: {exc}")
    finally:
        try:
            tmp.unlink()
        except FileNotFoundError:
            pass


def _blob_path(out: Path, digest: str) -> Path:
    return out / "blobs" / "sha256" / digest[7:]


def _write_blob(out: Path, payload: bytes) -> dict[str, Any]:
    digest = _digest(payload)
    _write_exclusive(_blob_path(out, digest), payload)
    return {"mediaType": "", "digest": digest, "size": len(payload)}


def _verify_descriptor(desc: Any, expected_media: set[str], where: str) -> tuple[str, str, int]:
    if not isinstance(desc, dict):
        _fail(f"invalid {where} descriptor")
    media = desc.get("mediaType")
    digest = desc.get("digest")
    size = desc.get("size")
    if not isinstance(media, str) or media not in expected_media or not isinstance(digest, str) or not digest.startswith("sha256:") or not HEX.fullmatch(digest[7:]) or type(size) is not int or size < 0 or size > MAX_ARCHIVE_BYTES:
        _fail(f"unsupported or invalid {where} descriptor")
    return media, digest, size


def _read_oci_blob(tf: tarfile.TarFile, members: dict[str, tarfile.TarInfo], digest: str,
                   size: int, limit: int = MAX_ARCHIVE_BYTES) -> bytes:
    name = f"blobs/sha256/{digest[7:]}"
    member = members.get(name)
    if member is None or not member.isreg() or member.size != size or size > limit:
        _fail(f"missing or invalid OCI blob: {name}")
    payload = _read_member(tf, members, name, limit)
    if _digest(payload) != digest:
        _fail(f"OCI blob digest mismatch: {name}")
    return payload


def _decompress_layer(encoded: bytes, media: str) -> bytes:
    if media in (OCI_LAYER, DOCKER_LAYER):
        raw = encoded
    elif media in (OCI_LAYER_GZIP, DOCKER_LAYER_GZIP):
        try:
            # Stream through GzipFile so a compressed bomb cannot allocate without bound.
            pieces: list[bytes] = []
            total = 0
            with gzip.GzipFile(fileobj=__import__("io").BytesIO(encoded), mode="rb") as gz:
                while True:
                    part = gz.read(CHUNK)
                    if not part:
                        break
                    total += len(part)
                    if total > MAX_ARCHIVE_BYTES:
                        _fail("uncompressed layer exceeds limit")
                    pieces.append(part)
            raw = b"".join(pieces)
        except (OSError, EOFError, zlib.error) as exc:
            _fail(f"invalid gzip layer: {exc}")
    else:
        _fail("unsupported OCI layer compression")
    if len(raw) > MAX_ARCHIVE_BYTES:
        _fail("uncompressed layer exceeds limit")
    return raw


def _deterministic_gzip(raw: bytes, out: Path) -> tuple[str, int]:
    digest = hashlib.sha256()
    count = 0
    # Write a canonical gzip stream with mtime=0 and no original filename.
    try:
        with tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024, mode="w+b") as spool:
            with gzip.GzipFile(filename="", mode="wb", fileobj=spool, mtime=0, compresslevel=6) as gz:
                gz.write(raw)
            spool.seek(0)
            tmp = out / "blobs" / "sha256" / (".layer-" + secrets.token_hex(12))
            with tmp.open("xb") as dest:
                while True:
                    chunk = spool.read(CHUNK)
                    if not chunk:
                        break
                    dest.write(chunk)
                    digest.update(chunk)
                    count += len(chunk)
                dest.flush()
                os.fsync(dest.fileno())
            hex_digest = digest.hexdigest()
            final = out / "blobs" / "sha256" / hex_digest
            try:
                os.link(tmp, final)
            except FileExistsError:
                _fail("refusing to overwrite OCI blob")
            tmp.unlink()
            return "sha256:" + hex_digest, count
    except OSError as exc:
        _fail(f"cannot write OCI layer blob: {exc}")


def _docker_input(tf: tarfile.TarFile, members: dict[str, tarfile.TarInfo],
                  expected_id: str, expected_diffids: list[str], out: Path) -> tuple[bytes, list[dict[str, Any]]]:
    manifest = _json(_read_member(tf, members, "manifest.json"), "Docker manifest.json")
    if not isinstance(manifest, list) or len(manifest) != 1:
        _fail("Docker archive must contain exactly one selected image manifest")
    item = manifest[0]
    if not isinstance(item, dict) or not isinstance(item.get("Config"), str) or not isinstance(item.get("Layers"), list):
        _fail("invalid Docker image manifest")
    config_path = _safe_name(item["Config"])
    layers = item["Layers"]
    if len(layers) > MAX_LAYERS:
        _fail("layer count exceeds limit")
    config = _read_member(tf, members, config_path, MAX_CONFIG_BYTES)
    _verify_expected(config, expected_id, expected_diffids)
    if len(layers) != len(expected_diffids):
        _fail("Docker layer count does not match expected diff IDs")
    layer_descs: list[dict[str, Any]] = []
    raw_total = 0
    for layer_name in layers:
        if not isinstance(layer_name, str):
            _fail("invalid Docker layer reference")
        raw_name = _safe_name(layer_name)
        # Docker save layer.tar values may already contain gzip bytes in some exporters.
        encoded_info = members.get(raw_name)
        if encoded_info is None or not encoded_info.isreg():
            _fail(f"missing or non-regular Docker layer: {raw_name}")
        if encoded_info.size > MAX_ARCHIVE_BYTES:
            _fail("Docker layer exceeds limit")
        stream = tf.extractfile(encoded_info)
        if stream is None:
            _fail("cannot read Docker layer")
        encoded = stream.read(MAX_ARCHIVE_BYTES + 1)
        if len(encoded) != encoded_info.size:
            _fail("truncated Docker layer")
        if encoded.startswith(b"\x1f\x8b"):
            raw = _decompress_layer(encoded, OCI_LAYER_GZIP)
        else:
            raw = encoded
        raw_total += len(raw)
        if raw_total > MAX_ARCHIVE_BYTES:
            _fail("total uncompressed layer bytes exceed limit")
        if _digest(raw) != expected_diffids[len(layer_descs)]:
            _fail("Docker layer diff ID mismatch")
        dgst, size = _deterministic_gzip(raw, out)
        layer_descs.append({"mediaType": OCI_LAYER_GZIP, "digest": dgst, "size": size})
    return config, layer_descs


def _oci_input(tf: tarfile.TarFile, members: dict[str, tarfile.TarInfo],
               expected_id: str, expected_diffids: list[str], out: Path) -> tuple[bytes, list[dict[str, Any]]]:
    layout = _json(_read_member(tf, members, "oci-layout"), "oci-layout")
    if not isinstance(layout, dict) or layout.get("imageLayoutVersion") != "1.0.0":
        _fail("unsupported OCI layout")
    index = _json(_read_member(tf, members, "index.json"), "OCI index.json")
    if not isinstance(index, dict):
        _fail("OCI index must be a JSON object")
    roots = index.get("manifests")
    if index.get("schemaVersion") != 2 or not isinstance(roots, list) or len(roots) != 1:
        _fail("OCI archive must have exactly one root image descriptor")
    _, root_digest, root_size = _verify_descriptor(roots[0], {OCI_MANIFEST, DOCKER_MANIFEST}, "root manifest")
    manifest_bytes = _read_oci_blob(tf, members, root_digest, root_size)
    manifest = _json(manifest_bytes, "OCI manifest")
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 2 or manifest.get("mediaType") not in (OCI_MANIFEST, DOCKER_MANIFEST):
        _fail("unsupported OCI manifest")
    config_media, config_digest, config_size = _verify_descriptor(manifest.get("config"), {OCI_CONFIG, DOCKER_CONFIG}, "config")
    del config_media
    config = _read_oci_blob(tf, members, config_digest, config_size, MAX_CONFIG_BYTES)
    _verify_expected(config, expected_id, expected_diffids)
    layers = manifest.get("layers")
    if not isinstance(layers, list) or len(layers) != len(expected_diffids) or len(layers) > MAX_LAYERS:
        _fail("OCI layer count does not match expected diff IDs")
    layer_descs: list[dict[str, Any]] = []
    raw_total = 0
    for pos, desc in enumerate(layers):
        media, digest, size = _verify_descriptor(desc, {OCI_LAYER_GZIP, OCI_LAYER, DOCKER_LAYER_GZIP, DOCKER_LAYER}, "layer")
        encoded = _read_oci_blob(tf, members, digest, size)
        raw = _decompress_layer(encoded, media)
        raw_total += len(raw)
        if raw_total > MAX_ARCHIVE_BYTES:
            _fail("total uncompressed layer bytes exceed limit")
        if _digest(raw) != expected_diffids[pos]:
            _fail("OCI layer diff ID mismatch")
        dgst, out_size = _deterministic_gzip(raw, out)
        layer_descs.append({"mediaType": OCI_LAYER_GZIP, "digest": dgst, "size": out_size})
    return config, layer_descs


def convert(input_tar: Path, output_dir: Path, expected_id: str,
            expected_diffids: list[str]) -> dict[str, Any]:
    if not expected_id.startswith("sha256:") or not HEX.fullmatch(expected_id[7:]):
        _fail("expected config ID must be a sha256 digest")
    if len(expected_diffids) > MAX_LAYERS or any(not isinstance(d, str) or not d.startswith("sha256:") or not HEX.fullmatch(d[7:]) for d in expected_diffids):
        _fail("expected diff IDs must be an ordered list of sha256 digests (maximum 64)")
    try:
        if input_tar.stat().st_size > MAX_ARCHIVE_BYTES:
            _fail("input archive exceeds byte limit")
    except OSError as exc:
        _fail(f"cannot stat input archive: {exc}")
    _new_output(output_dir)
    try:
        with tarfile.open(input_tar, mode="r:*") as tf:
            members = _index_archive(tf)
            if "manifest.json" in members:
                config, layers = _docker_input(tf, members, expected_id, expected_diffids, output_dir)
                source_format = "docker-save-manifest"
                if "oci-layout" in members or "index.json" in members:
                    source_format = "docker-save-manifest+oci-metadata"
            elif "oci-layout" in members or "index.json" in members:
                config, layers = _oci_input(tf, members, expected_id, expected_diffids, output_dir)
                source_format = "oci-archive"
            else:
                config, layers = _docker_input(tf, members, expected_id, expected_diffids, output_dir)
                source_format = "docker-save-manifest"
    except (tarfile.TarError, EOFError, OSError) as exc:
        _fail(f"invalid or truncated archive: {exc}")
    config_digest = _digest(config)
    _write_exclusive(_blob_path(output_dir, config_digest), config)
    config_desc = {"mediaType": OCI_CONFIG, "digest": config_digest, "size": len(config)}
    manifest_obj = {"schemaVersion": 2, "mediaType": OCI_MANIFEST,
                    "config": config_desc, "layers": layers}
    manifest_bytes = _canonical(manifest_obj)
    manifest_digest = _digest(manifest_bytes)
    _write_exclusive(_blob_path(output_dir, manifest_digest), manifest_bytes)
    root_desc = {"mediaType": OCI_MANIFEST, "digest": manifest_digest, "size": len(manifest_bytes)}
    # Only the exact parent-selected image and its expected ordered diff IDs carry
    # the 9ff provenance annotation. Generic synthetic/foreign conversions do not.
    attests_source = expected_id == SOURCE_IMAGE_ID and expected_diffids == SOURCE_DIFFIDS
    if attests_source:
        root_desc["annotations"] = {"org.opencontainers.image.revision": SOURCE_REVISION}
    layout_bytes = _canonical({"imageLayoutVersion": "1.0.0"})
    _write_exclusive(output_dir / "oci-layout", layout_bytes)
    # Published last: absence of this file means conversion did not complete.
    index_bytes = _canonical({"schemaVersion": 2, "manifests": [root_desc]})
    _publish_index(output_dir / "index.json", index_bytes)
    return {"sourceFormat": source_format, "configDigest": config_digest,
            "manifestDigest": manifest_digest, "layerCount": len(layers),
            "indexSha256": hashlib.sha256(index_bytes).hexdigest(),
            "sourceRevision": SOURCE_REVISION if attests_source else None}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="task-owned Docker-save or OCI archive")
    parser.add_argument("--output", required=True, type=Path, help="fresh or empty output directory")
    parser.add_argument("--expected-config-id", required=True, help="sha256:<config bytes digest>")
    parser.add_argument("--expected-diff-id", action="append", default=[], help="ordered RootFS diff ID; repeat once per layer")
    args = parser.parse_args(argv)
    try:
        result = convert(args.input, args.output, args.expected_config_id, args.expected_diff_id)
    except ConversionError as exc:
        print(f"conversion rejected: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
