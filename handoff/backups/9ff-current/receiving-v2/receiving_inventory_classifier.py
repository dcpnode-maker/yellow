"""Pure metadata-only receiving classifier for the pinned 9ff release pair."""
from __future__ import annotations

import re
from typing import Any

BASE_COMMIT = "e06e400a57485cc10a8a35c21dcb1e01b5a667d1"
BASE_TREE = "a5237050fdf81a2d7eea1231318d3ccfb2908e1d"
CLOUD_COMMIT = "9ff27ad8765dc75ebae9e083d4635c7a9b89fa62"
CLOUD_TREE = "4311a79c0c9ffc33877809162b1b38ae1b3c944a"
_HEX40 = re.compile(r"^[0-9a-f]{40}$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_ALLOWED_MODES = {"100644", "100755"}


class InventoryError(ValueError):
    """Invalid or ambiguous metadata; no source file access is performed."""


def _source_ids(value: Any) -> None:
    expected = {
        "base_commit": BASE_COMMIT,
        "base_tree": BASE_TREE,
        "cloud_commit": CLOUD_COMMIT,
        "cloud_tree": CLOUD_TREE,
    }
    if not isinstance(value, dict) or set(value) != set(expected):
        raise InventoryError("source_ids must contain exactly the pinned base/cloud IDs")
    if any(value[k] != v for k, v in expected.items()):
        raise InventoryError("source_ids do not match the pinned receiving pair")


def _normalize_path(value: Any) -> str:
    if not isinstance(value, str) or not value or "\x00" in value:
        raise InventoryError("path must be a nonempty relative POSIX path")
    if value.startswith("/") or "\\" in value or re.match(r"^[A-Za-z]:", value):
        raise InventoryError("rooted or non-POSIX path rejected")
    parts = value.split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise InventoryError("path is not normalized")
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in value):
        raise InventoryError("control or DEL character in path")
    return value


def _blob(value: Any, label: str) -> tuple[bool, tuple[str, str, str | None] | None]:
    fields = {"observed", "git_blob", "sha256", "mode"}
    if not isinstance(value, dict) or set(value) != fields:
        raise InventoryError(f"{label} blob record has an invalid shape")
    observed = value["observed"]
    if type(observed) is not bool:
        raise InventoryError(f"{label}.observed must be boolean")
    oid, digest, mode = value["git_blob"], value["sha256"], value["mode"]
    if not observed:
        if oid is not None or digest is not None or mode is not None:
            raise InventoryError(f"unobserved {label} cannot claim blob or mode identities")
        return False, None
    if oid is None and digest is None:
        if mode is not None:
            raise InventoryError(f"absent {label} path must have null mode")
        return True, None  # Observed path absence; valid for additions/deletions.
    if not isinstance(oid, str) or not _HEX40.fullmatch(oid):
        raise InventoryError(f"{label}.git_blob must be a full lowercase Git blob ID")
    if not isinstance(digest, str) or not _HEX64.fullmatch(digest):
        raise InventoryError(f"{label}.sha256 must be a lowercase SHA-256 digest")
    if mode is not None and not isinstance(mode, str):
        raise InventoryError(f"{label}.mode must be a string or null")
    if mode in {"120000", "160000"}:
        raise InventoryError(f"{label} symlinks and submodules are unsupported receiving entries")
    if mode is not None and mode not in _ALLOWED_MODES:
        raise InventoryError(f"{label}.mode must be 100644, 100755, or null when unknown")
    # A present blob with null mode is observed content but an unknown preimage.
    return True, (oid, digest, mode)


def _fully_identified(blob: tuple[str, str, str | None] | None) -> bool:
    return blob is None or blob[2] in _ALLOWED_MODES


def classify_inventory(document: Any) -> dict[str, Any]:
    """Classify only supplied identities. Never opens source, credential, or repo files."""
    if not isinstance(document, dict) or set(document) != {"source_ids", "paths"}:
        raise InventoryError("document must contain exactly source_ids and paths")
    _source_ids(document["source_ids"])
    rows = document["paths"]
    if not isinstance(rows, list):
        raise InventoryError("paths must be a list")
    seen_exact: set[str] = set()
    seen_windows: set[str] = set()
    result = []
    for row in rows:
        if not isinstance(row, dict) or not {"path", "base", "cloud"}.issubset(row) or set(row) - {"path", "base", "cloud", "laptop"}:
            raise InventoryError("each path row needs path, base, cloud, and optional laptop")
        path = _normalize_path(row["path"])
        windows_key = path.casefold()
        if path in seen_exact or windows_key in seen_windows:
            raise InventoryError("duplicate or Windows case-colliding path")
        seen_exact.add(path)
        seen_windows.add(windows_key)
        base_observed, base = _blob(row["base"], "base")
        cloud_observed, cloud = _blob(row["cloud"], "cloud")
        if "laptop" in row:
            laptop_observed, laptop = _blob(row["laptop"], "laptop")
        else:
            laptop_observed, laptop = False, None

        if not base_observed or not cloud_observed or not _fully_identified(base) or not _fully_identified(cloud):
            classification = "unknown_preimage_cannot_apply"
        elif not laptop_observed:
            classification = "laptop_unobserved"
        elif not _fully_identified(laptop):
            classification = "unknown_preimage_cannot_apply"
        elif cloud == base:
            if laptop == base:
                classification = "shared_same_no_overwrite"
            else:
                classification = "laptop_only_preserve"
        elif laptop == cloud:
            classification = "already_same_no_overwrite"
        elif laptop == base:
            classification = "cloud_only_guarded_apply"
        else:
            classification = "diverged_manual_hunks"
        result.append({"path": path, "classification": classification,
                       "cloud_change": _change_kind(base_observed, base, cloud_observed, cloud),
                       # Metadata-only candidate. Callers must recheck actual laptop
                       # content+mode and obtain reviewer approval; this never applies.
                       "may_apply": classification == "cloud_only_guarded_apply"})
    return {"schema": "yellow-receiving-inventory-result/v1", "paths": result}


def _change_kind(base_observed: bool, base: tuple[str, str, str | None] | None,
                 cloud_observed: bool, cloud: tuple[str, str, str | None] | None) -> str:
    if not base_observed or not cloud_observed or not _fully_identified(base) or not _fully_identified(cloud):
        return "unknown"
    if base is None and cloud is not None:
        return "addition"
    if base is not None and cloud is None:
        return "deletion"
    if base == cloud:
        return "unchanged"
    if base is not None and cloud is not None and base[:2] == cloud[:2] and base[2] != cloud[2]:
        return "mode_change"
    return "modify"
