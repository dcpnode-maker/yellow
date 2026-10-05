#!/usr/bin/env python3
"""Bounded, source-only recovery checkpoint for the RESOURCE-20261001 order.

Capture and restore are deliberately separate commands. Capture does not stage,
checkout, fetch, switch refs, or otherwise write to the receiving Git worktree.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

SOURCE_ROOT = Path(r"E:\YellowWorkspace\Worktrees\git-live-order611-source-v2")
CHECKPOINT_ROOT = Path(r"E:\YellowWorkspace\Data\Recovery\RESOURCE-20261001")
REMOTE_REF = "refs/remotes/origin/phase-7/release-local-gates-20261001"
EXPECTED_REMOTE = "a00ca3f941d601df6a436db53612d58b2f4f4729"
CLOUD_RELEASE_REF = "refs/yellow/recovery/cloud-release-20261001-f610a926"
EXPECTED_CLOUD_RELEASE = "f610a9264840cbbf8d4ea05b29852889e0115e6f"
DIFF_FORMAT = "git-binary-full-index/v1"
MAX_SOURCE_FILES = 50_000
MAX_SOURCE_BYTES = 2 * 1024**3
DISK_MARGIN = 256 * 1024**2

EXCLUDED_DIRS = {
    ".git", ".yellow", ".private", "node_modules", "vendor", "venv", ".venv",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".cache",
    "cache", "caches", "content_cache", "docker-data", "postgres-data",
    "pgdata", "database", "databases", "private", "secrets", "credentials",
    "toolchains", "artifacts", "coverage", "dist", "build", "target",
}
EXCLUDED_BASENAMES = {
    ".env", "credentials.json", "service-account.json", "id_rsa", "id_ed25519",
}
EXCLUDED_SUFFIXES = {
    ".pem", ".key", ".p12", ".pfx", ".dmp", ".dump", ".backup",
    ".vhd", ".vhdx", ".sqlite", ".sqlite3", ".db", ".pgdata", ".pyc", ".pyo",
}
EXCLUDED_PREFIXES = (".env.",)
PATHSPEC_EXCLUDES = [
    ":(exclude,glob)**/.git/**", ":(exclude,glob)**/.yellow/**",
    ":(exclude,glob)**/node_modules/**", ":(exclude,glob)**/vendor/**",
    ":(exclude,glob)**/.venv/**", ":(exclude,glob)**/venv/**",
    ":(exclude,glob)**/__pycache__/**", ":(exclude,glob)**/.cache/**",
    ":(exclude,glob)**/cache/**", ":(exclude,glob)**/caches/**",
    ":(exclude,glob)**/content_cache/**", ":(exclude,glob)**/docker-data/**",
    ":(exclude,glob)**/postgres-data/**", ":(exclude,glob)**/pgdata/**",
    ":(exclude,glob)**/database/**", ":(exclude,glob)**/databases/**",
    ":(exclude,glob)**/private/**", ":(exclude,glob)**/secrets/**",
    ":(exclude,glob)**/credentials/**", ":(exclude,glob)**/toolchains/**",
    ":(exclude,glob)**/artifacts/**", ":(exclude,glob)**/coverage/**",
    ":(exclude,glob)**/dist/**", ":(exclude,glob)**/build/**",
    ":(exclude,glob)**/target/**", ":(exclude,glob)**/.env",
    ":(exclude,glob)**/.env.*", ":(exclude,glob)**/credentials.json",
    ":(exclude,glob)**/service-account.json", ":(exclude,glob)**/*.pem",
    ":(exclude,glob)**/*.key", ":(exclude,glob)**/*.p12",
    ":(exclude,glob)**/*.pfx", ":(exclude,glob)**/*.dmp",
    ":(exclude,glob)**/*.dump", ":(exclude,glob)**/*.backup",
    ":(exclude,glob)**/*.vhd", ":(exclude,glob)**/*.vhdx",
    ":(exclude,glob)**/*.sqlite", ":(exclude,glob)**/*.sqlite3",
    ":(exclude,glob)**/*.db", ":(exclude,glob)**/*.pgdata",
]


class RecoveryError(RuntimeError):
    pass


def fail(message: str) -> None:
    raise RecoveryError(message)


def run_git(repo: Path, *args: str, check: bool = True, input_bytes: bytes | None = None) -> bytes:
    environment = os.environ.copy()
    environment["GIT_OPTIONAL_LOCKS"] = "0"
    proc = subprocess.run(
        ["git", "-C", str(repo), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        input=input_bytes,
        env=environment,
        check=False,
    )
    if check and proc.returncode:
        fail(f"git {args[0] if args else ''} failed: {proc.stderr.decode('utf-8', 'replace').strip()}")
    return proc.stdout


def git_text(repo: Path, *args: str) -> str:
    return run_git(repo, *args).decode("utf-8", "strict").strip()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def fsync_file(path: Path) -> None:
    with path.open("r+b") as stream:
        stream.flush()
        os.fsync(stream.fileno())


def fsync_dir(path: Path) -> None:
    if os.name != "nt":
        fd = os.open(path, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)


def write_bytes(path: Path, data: bytes) -> None:
    with path.open("xb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def write_json(path: Path, value: Any) -> None:
    write_bytes(path, (json.dumps(value, indent=2, sort_keys=True) + "\n").encode("utf-8"))


def path_is_reparse(path: Path) -> bool:
    try:
        info = path.lstat()
    except FileNotFoundError:
        return False
    attrs = getattr(info, "st_file_attributes", 0)
    reparse = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    return path.is_symlink() or bool(attrs & reparse)


def assert_no_reparse_components(path: Path, allow_missing_leaf: bool = False) -> None:
    absolute = Path(os.path.abspath(path))
    current = Path(absolute.anchor)
    parts = absolute.parts[1:]
    for index, part in enumerate(parts):
        current = current / part
        if allow_missing_leaf and index == len(parts) - 1 and not current.exists():
            continue
        if path_is_reparse(current):
            fail(f"reparse point or symlink in protected path: {current}")


def assert_exact_source_root(root: Path) -> None:
    if Path(os.path.abspath(root)).as_posix().casefold() != SOURCE_ROOT.as_posix().casefold():
        fail("unexpected source root; this order admits only the fixed receiving checkout")
    assert_no_reparse_components(root)
    if not root.is_dir():
        fail("fixed source root is unavailable")
    top = git_text(root, "rev-parse", "--show-toplevel")
    if Path(os.path.abspath(top)).as_posix().casefold() != SOURCE_ROOT.as_posix().casefold():
        fail("Git top-level does not equal the fixed source root")


def protect_checkpoint(path: Path) -> None:
    if os.name != "nt":
        fail("private Windows ACLs are required for checkpoint creation")
    who = subprocess.run(["whoami.exe", "/user", "/fo", "csv", "/nh"],
                         capture_output=True, text=True, check=False)
    if who.returncode:
        fail("cannot determine current Windows account SID")
    fields = next(csv.reader(line for line in who.stdout.splitlines() if line.strip()), [])
    if len(fields) != 2:
        fail("cannot parse current Windows user and SID")
    try:
        account, sid = fields[0], fields[1]
    except Exception as exc:
        fail(f"cannot parse current Windows account SID: {exc}")
    if not sid.startswith("S-"):
        fail("whoami did not return a valid current-user SID")
    proc = subprocess.run(
        ["icacls.exe", str(path), "/inheritance:r", "/grant:r", f"*{sid}:(OI)(CI)F"],
        capture_output=True, text=True, check=False,
    )
    if proc.returncode:
        fail(f"icacls failed to restrict checkpoint ACL: {proc.stderr.strip() or proc.stdout.strip()}")
    acl_script = (
        "$ErrorActionPreference='Stop'; "
        "$acl=[System.IO.Directory]::GetAccessControl($env:YELLOW_CHECKPOINT_ACL_PATH); "
        "$rules=@($acl.Access | ForEach-Object { "
        "[PSCustomObject]@{sid=$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;"
        "inherited=$_.IsInherited;type=$_.AccessControlType.ToString();rights=$_.FileSystemRights.ToString()} }); "
        "$ownerSid=([Security.Principal.NTAccount]$acl.Owner).Translate([Security.Principal.SecurityIdentifier]).Value; "
        "[PSCustomObject]@{protected=$acl.AreAccessRulesProtected;ownerSid=$ownerSid;rules=$rules} | "
        "ConvertTo-Json -Depth 4 -Compress"
    )
    environment = os.environ.copy()
    environment["YELLOW_CHECKPOINT_ACL_PATH"] = str(path)
    readback = subprocess.run(
        ["powershell.exe", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", acl_script],
        capture_output=True, text=True, env=environment, check=False,
    )
    if readback.returncode:
        fail(f"cannot read checkpoint ACL identities: {readback.stderr.strip()}")
    try:
        acl = json.loads(readback.stdout)
        rules = acl["rules"] if isinstance(acl["rules"], list) else [acl["rules"]]
    except (ValueError, KeyError, TypeError):
        fail("checkpoint ACL readback is not valid structured data")
    if (not acl.get("protected") or acl.get("ownerSid") != sid or not rules or
            any(rule.get("inherited") or rule.get("sid") != sid or
                rule.get("type") != "Allow" or "FullControl" not in rule.get("rights", "")
                for rule in rules)):
        fail(f"checkpoint ACL is not restricted to explicit current-user access ({account})")


def git_snapshot(root: Path) -> dict[str, Any]:
    head = git_text(root, "rev-parse", "HEAD")
    remote = git_text(root, "rev-parse", REMOTE_REF)
    if remote != EXPECTED_REMOTE:
        fail(f"required fetched ref does not equal the admitted commit: {remote}")
    cloud_release = git_text(root, "rev-parse", CLOUD_RELEASE_REF)
    if cloud_release != EXPECTED_CLOUD_RELEASE:
        fail(f"required published cloud release ref does not equal the admitted commit: {cloud_release}")
    refs = run_git(root, "show-ref", "--head").decode("utf-8", "strict")
    status = run_git(root, "status", "--porcelain=v1", "--untracked-files=all")
    status_z = run_git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all")
    index_path_text = git_text(root, "rev-parse", "--git-path", "index")
    index_path = Path(index_path_text)
    if not index_path.is_absolute():
        index_path = root / index_path
    assert_no_reparse_components(index_path)
    if not index_path.is_file():
        fail("Git index file is unavailable")
    return {
        "head": head,
        "remote_ref": REMOTE_REF,
        "remote_commit": remote,
        "cloud_release_ref": CLOUD_RELEASE_REF,
        "cloud_release_commit": cloud_release,
        "refs_text": refs,
        "status_text": status.decode("utf-8", "backslashreplace"),
        "status_z": status_z,
        "status_z_sha256": sha256_bytes(status_z),
        "index_path": str(index_path),
        "index_sha256": sha256_file(index_path),
        "index_bytes": index_path.stat().st_size,
    }


def assert_snapshot_unchanged(root: Path, before: dict[str, Any]) -> None:
    after = git_snapshot(root)
    for key in ("head", "remote_ref", "remote_commit", "cloud_release_ref", "cloud_release_commit",
                "refs_text", "status_text",
                "status_z", "status_z_sha256", "index_sha256", "index_bytes"):
        if before[key] != after[key]:
            fail(f"source Git input changed during checkpoint operation: {key}")


def excluded_reason(relative: str) -> str | None:
    parts = PurePosixPath(relative).parts
    basename = parts[-1].casefold() if parts else ""
    if any(part.casefold() in EXCLUDED_DIRS for part in parts):
        return "private, database, cache, dependency, generated, or toolchain directory"
    if basename == ".env.example":
        return None
    if basename in EXCLUDED_BASENAMES or basename.startswith(EXCLUDED_PREFIXES):
        return "credential or environment file"
    if Path(basename).suffix.casefold() in EXCLUDED_SUFFIXES:
        return "database, credential, cache, or binary runtime artifact"
    return None


def git_paths(root: Path) -> list[str]:
    head_paths = run_git(root, "ls-tree", "-r", "-z", "--name-only", "HEAD")
    tracked = run_git(root, "ls-files", "-z")
    untracked = run_git(root, "ls-files", "--others", "--exclude-standard", "-z")
    result: set[str] = set()
    for raw in head_paths.split(b"\0") + tracked.split(b"\0") + untracked.split(b"\0"):
        if not raw:
            continue
        try:
            value = raw.decode("utf-8", "strict")
        except UnicodeDecodeError:
            fail("non-UTF-8 source path cannot be represented portably")
        if "\\" in value or PurePosixPath(value).is_absolute() or ".." in PurePosixPath(value).parts:
            fail(f"unsafe Git path: {value!r}")
        result.add(value)
    if (root / ".env.example").is_file():
        result.add(".env.example")
    return sorted(result, key=lambda s: s.encode("utf-8"))


def inspect_source_files(root: Path) -> tuple[list[dict[str, Any]], list[dict[str, str]], int, list[str]]:
    included: list[dict[str, Any]] = []
    excluded: list[dict[str, str]] = []
    allowed_paths: list[str] = []
    total = 0
    all_paths = git_paths(root)
    if len(all_paths) > MAX_SOURCE_FILES:
        fail("Git source path inventory exceeds the admitted file limit")
    for relative in all_paths:
        reason = excluded_reason(relative)
        source = root.joinpath(*PurePosixPath(relative).parts)
        assert_no_reparse_components(source, allow_missing_leaf=True)
        if reason:
            excluded.append({"path": relative, "reason": reason})
            continue
        allowed_paths.append(relative)
        if not source.exists():
            continue
        info = source.lstat()
        if not stat.S_ISREG(info.st_mode):
            fail(f"non-regular or linked source input: {relative}")
        total += info.st_size
        if len(included) >= MAX_SOURCE_FILES or total > MAX_SOURCE_BYTES:
            fail("source snapshot exceeds the admitted file or byte limit")
        included.append({"path": relative, "bytes": info.st_size, "sha256": sha256_file(source)})
    return included, excluded, total, allowed_paths


def artifact_record(path: Path) -> dict[str, Any]:
    return {"name": path.name, "bytes": path.stat().st_size, "sha256": sha256_file(path)}


def make_zip(root: Path, zip_path: Path, files: list[dict[str, Any]]) -> None:
    with zipfile.ZipFile(zip_path, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for record in files:
            relative = record["path"]
            source = root.joinpath(*PurePosixPath(relative).parts)
            assert_no_reparse_components(source)
            info = zipfile.ZipInfo(relative)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | 0o600) << 16
            digest = hashlib.sha256()
            count = 0
            with source.open("rb") as source_stream, archive.open(info, "w") as archive_stream:
                for block in iter(lambda: source_stream.read(1024 * 1024), b""):
                    digest.update(block)
                    count += len(block)
                    archive_stream.write(block)
            if count != record["bytes"] or digest.hexdigest() != record["sha256"]:
                fail(f"source changed while building archive: {relative}")


def git_diff_for_paths(root: Path, allowed_paths: list[str], *args: str) -> bytes:
    if not allowed_paths:
        return b""
    # This installed Git rejects --pathspec-from-file for diff. Keep argv small
    # and bounded by passing literal pathspec batches (well below Windows limits).
    output = bytearray()
    batch: list[str] = []
    batch_bytes = 0
    for path in allowed_paths:
        spec = ":(literal)" + path
        size = len(spec.encode("utf-8")) + 1
        if batch and (len(batch) >= 40 or batch_bytes + size > 10_000):
            output.extend(run_git(root, *args, "--full-index", "--", *batch))
            batch, batch_bytes = [], 0
        batch.append(spec)
        batch_bytes += size
    if batch:
        output.extend(run_git(root, *args, "--full-index", "--", *batch))
    return bytes(output)


def git_patch(root: Path, output_path: Path, allowed_paths: list[str], *args: str) -> None:
    payload = git_diff_for_paths(root, allowed_paths, *args)
    write_bytes(output_path, payload)


def create_bundle(root: Path, checkpoint: Path) -> None:
    bundle = checkpoint / "source-refs.bundle"
    run_git(root, "bundle", "create", str(bundle), "HEAD", REMOTE_REF, CLOUD_RELEASE_REF)
    run_git(root, "bundle", "verify", str(bundle))
    listed = run_git(root, "bundle", "list-heads", str(bundle)).decode("utf-8", "strict")
    heads = {}
    for line in listed.splitlines():
        parts = line.split(" ", 1)
        if len(parts) == 2:
            heads[parts[1]] = parts[0]
    if (heads.get(REMOTE_REF) != EXPECTED_REMOTE or
            heads.get(CLOUD_RELEASE_REF) != EXPECTED_CLOUD_RELEASE):
        fail("bundle does not advertise both required exact published refs")
    if git_text(root, "rev-parse", "HEAD") not in heads.values():
        fail("bundle does not contain the exact local HEAD")


def create_checkpoint() -> Path:
    root = SOURCE_ROOT
    assert_exact_source_root(root)
    before = git_snapshot(root)
    files, excluded, source_bytes, allowed_paths = inspect_source_files(root)
    common_dir_text = git_text(root, "rev-parse", "--git-common-dir")
    common_dir = Path(common_dir_text)
    if not common_dir.is_absolute():
        common_dir = root / common_dir
    common_dir = Path(os.path.abspath(common_dir))
    assert_no_reparse_components(common_dir)
    object_path = common_dir / "objects"
    object_bytes = sum(p.stat().st_size for p in object_path.rglob("*") if p.is_file())
    required = source_bytes * 2 + object_bytes + DISK_MARGIN
    free = shutil.disk_usage(CHECKPOINT_ROOT.drive or "E:\\").free
    if free < required:
        fail(f"insufficient free space for bounded checkpoint: need {required}, have {free}")
    assert_no_reparse_components(CHECKPOINT_ROOT, allow_missing_leaf=True)
    CHECKPOINT_ROOT.mkdir(parents=True, exist_ok=True)
    assert_no_reparse_components(CHECKPOINT_ROOT)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    checkpoint = CHECKPOINT_ROOT / f"source-{stamp}-{uuid.uuid4().hex[:10]}"
    checkpoint.mkdir(exist_ok=False)
    protect_checkpoint(checkpoint)
    try:
        create_bundle(root, checkpoint)
        make_zip(root, checkpoint / "working-source.zip", files)
        git_patch(root, checkpoint / "head-working.diff", allowed_paths, "diff", "--binary", "HEAD")
        git_patch(root, checkpoint / "staged.diff", allowed_paths, "diff", "--cached", "--binary", "HEAD")
        git_patch(root, checkpoint / "unstaged.diff", allowed_paths, "diff", "--binary")
        write_bytes(checkpoint / "original-index.bin", Path(before["index_path"]).read_bytes())
        write_bytes(checkpoint / "original-status.txt", before["status_text"].encode("utf-8", "backslashreplace"))
        write_bytes(checkpoint / "original-status-z.bin", before["status_z"])
        refs_path = checkpoint / "original-refs.txt"
        write_bytes(refs_path, before["refs_text"].encode("utf-8"))
        assert_snapshot_unchanged(root, before)
        verify_zip(checkpoint / "working-source.zip", files)
        for record in files:
            source = root.joinpath(*PurePosixPath(record["path"]).parts)
            if not source.is_file() or sha256_file(source) != record["sha256"]:
                fail(f"source input hash changed before checkpoint completion: {record['path']}")
        assert_snapshot_unchanged(root, before)
        artifacts = [artifact_record(p) for p in sorted(checkpoint.iterdir()) if p.is_file()]
        manifest = {
            "schema": "yellow-laptop-source-recovery/v1",
            "state": "complete",
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "source_root": str(root),
            "local_head": before["head"],
            "required_remote_ref": REMOTE_REF,
            "required_remote_commit": EXPECTED_REMOTE,
            "required_cloud_release_ref": CLOUD_RELEASE_REF,
            "required_cloud_release_commit": EXPECTED_CLOUD_RELEASE,
            "diff_format": DIFF_FORMAT,
            "original_refs_sha256": sha256_file(refs_path),
            "original_index_sha256": before["index_sha256"],
            "original_index_bytes": before["index_bytes"],
            "original_status_sha256": sha256_file(checkpoint / "original-status.txt"),
            "original_status_z_sha256": before["status_z_sha256"],
            "original_status": before["status_text"].splitlines(),
            "source_file_count": len(files),
            "source_bytes": source_bytes,
            "source_files": files,
            "diff_paths": allowed_paths,
            "diff_scope": "Literal pathnames from HEAD tree, index, and nonignored untracked inventory, excluding every manifest-listed private/runtime category; emitted in bounded argv batches and compared using the same batches on restore.",
            "excluded_paths": excluded,
            "excluded_scope": [
                "Secrets, credential and environment files; private directories; databases and dumps; caches; dependencies; generated outputs; toolchains.",
                "No database, runtime, credential, configuration, paid-service, hosting, or business-data recovery is included or claimed.",
            ],
            "status_and_index": "Original index bytes, status, refs and HEAD are captured and checked unchanged before completion.",
            "artifacts": artifacts,
            "restore_status_scope": "Only captured in-scope source paths are restored; excluded and ignored data is intentionally absent.",
        }
        write_json(checkpoint / "manifest.json", manifest)
        fsync_dir(checkpoint)
        verify_checkpoint(checkpoint, verify_source=True)
        return checkpoint
    except Exception:
        # Preserve failed evidence for inspection; never delete a partial checkpoint.
        raise


def load_manifest(checkpoint: Path) -> dict[str, Any]:
    assert_no_reparse_components(checkpoint)
    path = checkpoint / "manifest.json"
    if not path.is_file() or path_is_reparse(path):
        fail("checkpoint manifest is missing or linked")
    value = json.loads(path.read_text(encoding="utf-8"))
    if value.get("schema") != "yellow-laptop-source-recovery/v1" or value.get("state") != "complete":
        fail("checkpoint is not a completed source-only checkpoint")
    if Path(os.path.abspath(value.get("source_root", ""))).as_posix().casefold() != SOURCE_ROOT.as_posix().casefold():
        fail("manifest source root is outside the fixed admitted checkout")
    return value


def verify_zip(path: Path, files: list[dict[str, Any]]) -> None:
    expected = {record["path"]: record for record in files}
    with zipfile.ZipFile(path, "r") as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or set(names) != set(expected):
            fail("source archive entries do not match the portable file manifest")
        for name in names:
            safe_archive_path(name)
            record = expected[name]
            digest = hashlib.sha256()
            count = 0
            with archive.open(name, "r") as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(block)
                    count += len(block)
            if count != record["bytes"] or digest.hexdigest() != record["sha256"]:
                fail(f"source archive byte/hash mismatch: {name}")


def safe_archive_path(name: str) -> PurePosixPath:
    path = PurePosixPath(name)
    if not name or path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name:
        fail(f"unsafe archive path: {name!r}")
    if name.startswith("/") or any(part in ("", ".") for part in name.split("/")):
        fail(f"non-portable archive path: {name!r}")
    return path


def verify_checkpoint(checkpoint: Path, verify_source: bool = False) -> dict[str, Any]:
    checkpoint = Path(os.path.abspath(checkpoint))
    if checkpoint.parent.as_posix().casefold() != CHECKPOINT_ROOT.as_posix().casefold():
        fail("checkpoint must be an immediate child of the fixed recovery directory")
    assert_no_reparse_components(checkpoint)
    manifest = load_manifest(checkpoint)
    if manifest.get("diff_format") != DIFF_FORMAT:
        fail("checkpoint binary diff format is unsupported; recapture with the current full-index format")
    if (manifest.get("required_remote_ref") != REMOTE_REF or
            manifest.get("required_remote_commit") != EXPECTED_REMOTE or
            manifest.get("required_cloud_release_ref") != CLOUD_RELEASE_REF or
            manifest.get("required_cloud_release_commit") != EXPECTED_CLOUD_RELEASE):
        fail("checkpoint manifest does not record both currently admitted published refs")
    for artifact in manifest["artifacts"]:
        path = checkpoint / artifact["name"]
        if path.parent != checkpoint or not path.is_file() or path_is_reparse(path):
            fail(f"missing, unsafe, or linked checkpoint artifact: {artifact['name']}")
        if path.stat().st_size != artifact["bytes"] or sha256_file(path) != artifact["sha256"]:
            fail(f"checkpoint artifact hash mismatch: {artifact['name']}")
    verify_zip(checkpoint / "working-source.zip", manifest["source_files"])
    if (len(manifest.get("diff_paths", [])) > MAX_SOURCE_FILES or
            len(set(manifest.get("diff_paths", []))) != len(manifest.get("diff_paths", []))):
        fail("checkpoint diff scope is oversized or contains duplicate paths")
    for path in manifest.get("diff_paths", []):
        safe_archive_path(path)
        if excluded_reason(path):
            fail(f"checkpoint diff scope contains an excluded path: {path}")
    bundle = checkpoint / "source-refs.bundle"
    if SOURCE_ROOT.is_dir():
        run_git(SOURCE_ROOT, "bundle", "verify", str(bundle))
    listed = subprocess.run(["git", "bundle", "list-heads", str(bundle)], check=True,
                            capture_output=True, text=True).stdout.splitlines()
    heads = {line.split(" ", 1)[1]: line.split(" ", 1)[0] for line in listed if " " in line}
    if (heads.get(REMOTE_REF) != EXPECTED_REMOTE or
            heads.get(CLOUD_RELEASE_REF) != EXPECTED_CLOUD_RELEASE or
            manifest["local_head"] not in heads.values()):
        fail("Git bundle does not contain local HEAD and both required exact published refs")
    if verify_source:
        root = SOURCE_ROOT
        assert_exact_source_root(root)
        current = git_snapshot(root)
        if current["head"] != manifest["local_head"]:
            fail("current receiving checkout HEAD differs from checkpoint")
        if current["refs_text"] != (checkpoint / "original-refs.txt").read_text(encoding="utf-8"):
            fail("current Git refs differ from checkpoint input")
        if current["status_text"] != (checkpoint / "original-status.txt").read_text(encoding="utf-8", errors="backslashreplace"):
            fail("current Git status differs from checkpoint input")
        if current["status_z"] != (checkpoint / "original-status-z.bin").read_bytes() or current["status_z_sha256"] != manifest["original_status_z_sha256"]:
            fail("current unambiguous Git status bytes differ from checkpoint input")
        if current["index_sha256"] != manifest["original_index_sha256"]:
            fail("current Git index differs from checkpoint input")
        for record in manifest["source_files"]:
            source = root.joinpath(*PurePosixPath(record["path"]).parts)
            if not source.is_file() or path_is_reparse(source) or sha256_file(source) != record["sha256"]:
                fail(f"current source input differs from checkpoint: {record['path']}")
    return {"checkpoint": str(checkpoint), "verified_artifacts": len(manifest["artifacts"]),
            "source_files": manifest["source_file_count"], "source_bytes": manifest["source_bytes"],
            "source_verified_against_current": verify_source}


def restore_checkpoint(checkpoint: Path, destination: Path) -> dict[str, Any]:
    checkpoint = Path(os.path.abspath(checkpoint))
    result = verify_checkpoint(checkpoint, verify_source=False)
    destination = Path(os.path.abspath(destination))
    if destination.exists() or path_is_reparse(destination):
        fail("restore destination already exists; refusing overwrite")
    if (destination.parent.as_posix().casefold() != CHECKPOINT_ROOT.as_posix().casefold()
            or not re.fullmatch(r"restore-[A-Za-z0-9-]{8,80}", destination.name)):
        fail("restore destination must be a new immediate restore-* child of the fixed recovery directory")
    assert_no_reparse_components(CHECKPOINT_ROOT)
    if not CHECKPOINT_ROOT.is_dir():
        fail("fixed recovery directory is unavailable")
    manifest = load_manifest(checkpoint)
    destination.mkdir(exist_ok=False)
    protect_checkpoint(destination)
    proc = subprocess.run(["git", "clone", "--no-checkout", str(checkpoint / "source-refs.bundle"), str(destination)],
                          capture_output=True, text=True, check=False)
    if proc.returncode:
        fail(f"bundle clone failed: {proc.stderr.strip()}")
    try:
        cloud_commit = subprocess.run(
            ["git", "-C", str(destination), "rev-parse", "--verify", f"{EXPECTED_CLOUD_RELEASE}^{{commit}}"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        if cloud_commit != EXPECTED_CLOUD_RELEASE:
            fail("isolated clone does not contain the exact published cloud release commit")
        subprocess.run(["git", "-C", str(destination), "checkout", "--detach", manifest["local_head"]],
                       capture_output=True, text=True, check=True)
        for patch_name, flags in (("staged.diff", ["apply", "--index"]), ("unstaged.diff", ["apply"])):
            patch = checkpoint / patch_name
            if patch.stat().st_size:
                subprocess.run(["git", "-C", str(destination), *flags, str(patch)],
                               capture_output=True, text=True, check=True)
        expected_paths = {item["path"]: item for item in manifest["source_files"]}
        with zipfile.ZipFile(checkpoint / "working-source.zip", "r") as archive:
            for name in archive.namelist():
                rel = safe_archive_path(name)
                target = destination.joinpath(*rel.parts)
                if Path(os.path.commonpath([str(destination), str(target)])).as_posix().casefold() != destination.as_posix().casefold():
                    fail(f"archive path escaped restore destination: {name}")
                target.parent.mkdir(parents=True, exist_ok=True)
                assert_no_reparse_components(target.parent)
                if target.exists() and path_is_reparse(target):
                    fail(f"restore would write through a linked path: {name}")
                if target.exists() and not target.is_file():
                    fail(f"restore target is not a regular file: {name}")
                with archive.open(name, "r") as input_stream, target.open("xb" if not target.exists() else "wb") as output_stream:
                    shutil.copyfileobj(input_stream, output_stream, 1024 * 1024)
                    output_stream.flush()
                    os.fsync(output_stream.fileno())
        for name, record in expected_paths.items():
            target = destination.joinpath(*safe_archive_path(name).parts)
            if not target.is_file() or path_is_reparse(target) or target.stat().st_size != record["bytes"] or sha256_file(target) != record["sha256"]:
                fail(f"restored source differs from archived manifest: {name}")
        diff_checks = (
            ("head-working.diff", ("diff", "--binary", "HEAD")),
            ("staged.diff", ("diff", "--cached", "--binary", "HEAD")),
            ("unstaged.diff", ("diff", "--binary")),
        )
        for artifact_name, git_args in diff_checks:
            if git_diff_for_paths(destination, manifest["diff_paths"], *git_args) != (checkpoint / artifact_name).read_bytes():
                fail(f"restored Git status/index diff differs from captured input: {artifact_name}")
        restored_head = subprocess.run(["git", "-C", str(destination), "rev-parse", "HEAD"],
                                       capture_output=True, text=True, check=True).stdout.strip()
        if restored_head != manifest["local_head"]:
            fail("restored checkout HEAD differs from captured local HEAD")
        fsync_dir(destination)
        result.update({"restore_destination": str(destination), "restored_head": restored_head,
                       "archive_equality": "verified", "index_delta": "restored from staged binary patch",
                       "working_status_and_index_diffs": "verified against captured binary diffs",
                       "excluded_scope": manifest["excluded_scope"]})
        return result
    except Exception:
        # Never delete or replace a failed restore; retain it for root inspection.
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("capture", help="create a new immutable source-only checkpoint")
    verify = commands.add_parser("verify", help="verify checkpoint bytes and optionally the current source inputs")
    verify.add_argument("checkpoint", type=Path)
    verify.add_argument("--current-source", action="store_true")
    restore = commands.add_parser("restore", help="restore source into a new isolated checkout")
    restore.add_argument("checkpoint", type=Path)
    restore.add_argument("destination", type=Path)
    args = parser.parse_args()
    if args.command == "capture":
        result = {"checkpoint": str(create_checkpoint()), "state": "complete", "source_only": True}
    elif args.command == "verify":
        result = verify_checkpoint(args.checkpoint, verify_source=args.current_source)
    else:
        result = restore_checkpoint(args.checkpoint, args.destination)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RecoveryError, OSError, ValueError, KeyError, zipfile.BadZipFile,
            subprocess.CalledProcessError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(2)
