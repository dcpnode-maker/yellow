#!/usr/bin/env python3
"""Bounded owned launch proof for the reviewed Yellow 9ff synthetic image."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import secrets
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import urllib.parse
from dataclasses import dataclass


ORDER_DIR = Path(__file__).absolute().parent
REPO = Path("/workspace/yellow-release")
SOURCE = "9ff27ad8765dc75ebae9e083d4635c7a9b89fa62"
IMAGE_ID = "sha256:103cafd6ad6ca67c8ba4b41098c09cd325d3ac705e4867707b9f9ec49f9dc1f0"
IMAGE = IMAGE_ID
JOB = "yellow-cloud-synthetic-origin-9ff-20261001"
CONTAINER_NAME = JOB
PROJECT = "yellow-cloud-origin-9ff-20261001"
NETWORK = "yellow-catalogue-referee_default"
NETWORK_ID = "ee9f4858d08eaa73dc3c9f1ba13b0c78769a0d4dc770fd6a4378fb340519a8ae"
DOCKER_SOCKET = "unix:///var/run/docker.sock"
OLD_CID = "fe96ec05f4db113a5935c0d7e0f38aa6445b9ca16995c073195e399edcea4599"
OLD_IMAGE_ID = "sha256:35f7d5d121eec9ae34ad1c991bc40bc6474939610938a29383ecd30b65b63c8f"
OLD_REVISION = "937912cc0546bfe7b7cd8b3c082f8ef798c20e5b"
OLD_NAME = "/yellow-catalogue-referee-app-1"
AUTHORITY = Path("/workspace/yellow-release/.yellow/runtime-database-authority.env")
PORT = 53009
EXPECTED_FRONTIER = 100
TIMEOUT_SECONDS = 180
TOKEN_FILE_NAME = "token.env"
JOB_DIR_NAME = "run-9ff-origin-20261001"
JOB_DIR = ORDER_DIR / JOB_DIR_NAME
TOKEN_FILE = JOB_DIR / TOKEN_FILE_NAME
RECEIPT = JOB_DIR / "receipt.json"

IMAGE_FORMAT = (
    "{{.Id}}|{{.Os}}|{{.Architecture}}|{{.Config.User}}|{{json .Config.Cmd}}|"
    '{{index .Config.Labels "org.opencontainers.image.revision"}}'
)
OLD_FORMAT = (
    "{{.Id}}|{{.Image}}|{{.Name}}|{{.State.Running}}|{{.HostConfig.RestartPolicy.Name}}|"
    '{{index .Config.Labels "org.opencontainers.image.revision"}}'
)
OWNED_FORMAT = (
    "{{.Id}}|{{.Image}}|{{.Name}}|{{index .Config.Labels \"yellow.synthetic-origin.job\"}}|"
    '{{index .Config.Labels "yellow.synthetic-origin.source"}}|'
    '{{index .Config.Labels "yellow.synthetic-origin.nonce"}}'
)


class GuardError(Exception):
    """A non-sensitive admission or ownership refusal."""


@dataclass(frozen=True)
class Facts:
    source_head: str
    source_dirty: bool
    image_id: str
    image_os: str
    image_arch: str
    image_user: str
    image_command: tuple[str, ...]
    image_revision: str
    owned_name_exists: bool
    old_id: str
    old_image_id: str
    old_name: str
    old_running: bool
    old_restart: str
    old_revision: str
    network_id: str
    docker_port_owners: tuple[str, ...]
    authority_present: bool
    authority_is_file: bool
    authority_mode: int | None
    job_dir_exists: bool
    token_file_exists: bool
    receipt_exists: bool
    conflicting_secret_environment: bool
    socket_port_free: bool
    authority_path_safe: bool
    task_paths_safe: bool


def validate_facts(f: Facts) -> None:
    checks = (
        (f.source_head == SOURCE and not f.source_dirty, "source identity"),
        (f.image_id == IMAGE_ID and f.image_os == "linux" and f.image_arch == "amd64", "image identity"),
        (f.image_user == "bun" and f.image_command == ("bun", "run", "start"), "image runtime config"),
        (f.image_revision == SOURCE, "image source label"),
        (not f.owned_name_exists, "owned name already exists"),
        (f.old_id == OLD_CID and f.old_image_id == OLD_IMAGE_ID and f.old_name == OLD_NAME, "old container identity"),
        (f.old_running and f.old_restart == "no" and f.old_revision == OLD_REVISION, "old container source identity"),
        (f.network_id == NETWORK_ID, "external network identity"),
        (not f.docker_port_owners and f.socket_port_free, "loopback port is occupied"),
        (f.authority_present and f.authority_is_file and f.authority_mode == 0o600, "authority file unavailable or permissions changed"),
        (f.authority_path_safe, "authority path contains a symlink"),
        (f.task_paths_safe, "task-owned path contains a symlink"),
        (not f.job_dir_exists and not f.token_file_exists and not f.receipt_exists, "job path is not fresh"),
        (not f.conflicting_secret_environment, "runtime secret binding already present in process environment"),
    )
    for valid, reason in checks:
        if not valid:
            raise GuardError(reason)


def run_after_admission(facts: Facts, mutation):
    """Pure admission boundary used by tests; mutation is unreachable on RED."""
    validate_facts(facts)
    return mutation()


def cleanup_if_launched(launch_attempted: bool, cleanup) -> None:
    if launch_attempted:
        cleanup()


def unlink_created_private(path: Path, created_by_invocation: bool) -> None:
    if created_by_invocation:
        try:
            path.unlink()
        except OSError:
            pass


def exact_owned_cleanup(identity: tuple[str, str, str, str, str, str] | None, cid: str, nonce: str) -> bool:
    if identity is None:
        return False
    got_id, image_id, name, job_label, source_label, nonce_label = identity
    return (
        got_id == cid
        and len(got_id) == 64
        and image_id == IMAGE_ID
        and name == "/" + CONTAINER_NAME
        and job_label == JOB
        and source_label == SOURCE
        and nonce_label == nonce
    )


def _clean_docker_environment() -> dict[str, str]:
    env = dict(os.environ)
    for key in tuple(env):
        if key in {"DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"}:
            del env[key]
    return env


def _docker(args: list[str]) -> list[str]:
    return ["docker", "--host", DOCKER_SOCKET, *args]


def _has_symlink_component(path: Path) -> bool:
    absolute = path.absolute()
    current = Path(absolute.anchor)
    for part in absolute.parts[1:]:
        current = current / part
        try:
            if current.is_symlink():
                return True
        except OSError:
            return True
    return False


def _task_paths_are_safe() -> bool:
    return all(not _has_symlink_component(path) for path in (
        ORDER_DIR,
        Path(__file__).absolute(),
        ORDER_DIR / "compose.yml",
        JOB_DIR,
        TOKEN_FILE,
        RECEIPT,
    ))


def _command(args: list[str], *, deadline: float, log_path: Path | None = None) -> str:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError
    process = subprocess.Popen(
        args,
        env=_clean_docker_environment(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    try:
        stdout, stderr = process.communicate(timeout=min(remaining, 30))
    except BaseException:
        _stop_process_group(process)
        stdout, stderr = process.communicate()
        if log_path is not None:
            _append_private_log(log_path, args, stdout, stderr)
        raise
    result_code = process.returncode
    if log_path is not None:
        _append_private_log(log_path, args, stdout, stderr)
    if result_code:
        raise GuardError("command failed")
    return stdout.strip()


def _append_private_log(path: Path, args: list[str], stdout: str, stderr: str) -> None:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    with os.fdopen(descriptor, "a", encoding="utf-8") as log:
        log.write("$ " + " ".join(args) + "\n")
        log.write(stdout)
        log.write(stderr)


def _stop_process_group(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=2)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            pass


def _one_line(value: str, fields: int) -> list[str]:
    parts = value.split("|", fields - 1)
    if len(parts) != fields:
        raise GuardError("selected inspect fields malformed")
    return parts


def _container_exists(name: str, *, deadline: float) -> bool:
    out = _command(_docker(["ps", "-aq", "--no-trunc", "--filter", "name=^/" + name + "$"]), deadline=deadline)
    return bool(out)


def _collect_facts(*, deadline: float) -> Facts:
    head = _command(["git", "-C", str(REPO), "rev-parse", "HEAD"], deadline=deadline)
    dirty = bool(_command(["git", "-C", str(REPO), "status", "--porcelain=v1", "--untracked-files=all"], deadline=deadline))
    image_line = _command(_docker(["image", "inspect", "--format", IMAGE_FORMAT, IMAGE]), deadline=deadline)
    image_id, image_os, image_arch, image_user, image_cmd, image_revision = _one_line(image_line, 6)
    old_line = _command(_docker(["inspect", "--format", OLD_FORMAT, OLD_CID]), deadline=deadline)
    old_id, old_image, old_name, old_running, old_restart, old_revision = _one_line(old_line, 6)
    network_id = _command(_docker(["network", "inspect", "--format", "{{.Id}}", NETWORK]), deadline=deadline)
    docker_port_owners = tuple(filter(None, _command(
        _docker(["ps", "-aq", "--no-trunc", "--filter", "publish=" + str(PORT)]), deadline=deadline
    ).splitlines()))
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", PORT))
            socket_free = True
    except OSError:
        socket_free = False
    authority_path_safe = not _has_symlink_component(AUTHORITY)
    stat = AUTHORITY.stat() if AUTHORITY.exists() and authority_path_safe else None
    env_conflict = any(name in os.environ for name in (
        "YELLOW_RUNTIME_DATABASE_PASSWORD", "YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD",
        "YELLOW_TOKEN_SECRET", "YELLOW_ORIGIN_NONCE"
    ))
    return Facts(
        source_head=head,
        source_dirty=dirty,
        image_id=image_id,
        image_os=image_os,
        image_arch=image_arch,
        image_user=image_user,
        image_command=tuple(json.loads(image_cmd)),
        image_revision=image_revision,
        owned_name_exists=_container_exists(CONTAINER_NAME, deadline=deadline),
        old_id=old_id,
        old_image_id=old_image,
        old_name=old_name,
        old_running=old_running.lower() == "true",
        old_restart=old_restart,
        old_revision=old_revision,
        network_id=network_id,
        docker_port_owners=docker_port_owners,
        authority_present=stat is not None,
        authority_is_file=AUTHORITY.is_file(),
        authority_mode=(stat.st_mode & 0o777) if stat else None,
        job_dir_exists=JOB_DIR.exists(),
        token_file_exists=TOKEN_FILE.exists(),
        receipt_exists=RECEIPT.exists(),
        conflicting_secret_environment=env_conflict,
        socket_port_free=socket_free,
        authority_path_safe=authority_path_safe,
        task_paths_safe=_task_paths_are_safe(),
    )


def _log(path: Path, stage: str, args: list[str], deadline: float) -> str:
    return _command(args, deadline=deadline, log_path=path / "commands.log")


def _http(url: str, *, deadline: float):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError
    request = urllib.request.Request(url, headers={"Cache-Control": "no-store"})
    try:
        with urllib.request.urlopen(request, timeout=min(remaining, 3)) as response:
            body = response.read(2 * 1024 * 1024 + 1)
            if len(body) > 2 * 1024 * 1024:
                raise GuardError("response exceeded proof bound")
            return response.status, dict(response.headers.items()), body
    except urllib.error.HTTPError as error:
        body = error.read(64 * 1024)
        return error.code, dict(error.headers.items()), body


def _validated_asset_path(value: str) -> str:
    parsed = urllib.parse.urlsplit(value)
    if value.startswith("//") or parsed.scheme or parsed.netloc:
        raise GuardError("external UI asset reference rejected")
    if any(segment == ".." for segment in parsed.path.split("/")):
        raise GuardError("UI asset path traversal rejected")
    return value if value.startswith("/") else "/" + value


def _probe(deadline: float) -> dict:
    base = "http://127.0.0.1:" + str(PORT)
    health_status, _, health_body = _http(base + "/health", deadline=deadline)
    if health_status != 200 or json.loads(health_body) != {"status": "ok"}:
        raise GuardError("health contract failed")
    ready_status, _, ready_body = _http(base + "/ready", deadline=deadline)
    ready = json.loads(ready_body)
    build = ready.get("build", {}) if isinstance(ready, dict) else {}
    if not (
        ready_status == 200
        and ready.get("status") == "ready"
        and ready.get("target") == "yellow_runtime_database"
        and build.get("revision") == SOURCE
        and build.get("expectedMigrationFrontier") == EXPECTED_FRONTIER
    ):
        raise GuardError("readiness identity failed")
    unauth_status, _, _ = _http(base + "/api/v1/me/properties", deadline=deadline)
    if unauth_status != 401:
        raise GuardError("unauthenticated property request was not denied")
    sensitive = ("/.git/config", "/.env", "/.codex/config.toml", "/src/server.ts", "/src/server.ts.map")
    sensitive_results = {}
    for path in sensitive:
        status, _, _ = _http(base + path, deadline=deadline)
        if status != 404:
            raise GuardError("sensitive path contract failed")
        sensitive_results[path] = status
    root_status, headers, html = _http(base + "/", deadline=deadline)
    if root_status != 200 or b"<html" not in html.lower():
        raise GuardError("UI shell unavailable")
    import re
    candidates = re.findall(rb'(?:src|href)=["\']([^"\']+\.(?:js|css)(?:\?[^"\']*)?)["\']', html)
    if not candidates:
        raise GuardError("UI asset reference missing")
    asset_path = _validated_asset_path(candidates[0].decode("ascii"))
    asset_status, asset_headers, asset = _http(base + asset_path, deadline=deadline)
    if asset_status != 200 or not asset:
        raise GuardError("UI asset unavailable")
    return {
        "health": {"status": health_status, "body": {"status": "ok"}},
        "ready": {"status": ready_status, "target": ready["target"], "revision": SOURCE,
                  "expectedMigrationFrontier": EXPECTED_FRONTIER},
        "unauthenticated_properties": {"status": unauth_status},
        "sensitive_paths": sensitive_results,
        "ui": {"status": root_status, "content_type": headers.get("Content-Type"),
               "body_sha256": hashlib.sha256(html).hexdigest(), "bytes": len(html)},
        "asset": {"path": asset_path, "status": asset_status,
                  "content_type": asset_headers.get("Content-Type"),
                  "sha256": hashlib.sha256(asset).hexdigest(), "bytes": len(asset)},
    }


def _inspect_owned(cid: str, deadline: float) -> tuple[str, str, str, str, str, str] | None:
    try:
        line = _command(_docker(["inspect", "--format", OWNED_FORMAT, cid]), deadline=deadline)
    except Exception:
        return None
    return tuple(_one_line(line, 6))  # type: ignore[return-value]


def _cleanup_created(cid: str | None, nonce: str, deadline: float) -> None:
    candidates = [cid] if cid and len(cid) == 64 else []
    if not candidates:
        # Preflight proved this exact name absent. A post-interrupt lookup remains
        # safe because the full ownership tuple is checked before any removal.
        found = _command(
            _docker(["ps", "-aq", "--no-trunc", "--filter", "name=^/" + CONTAINER_NAME + "$"]),
            deadline=deadline,
        )
        candidates = [item for item in found.splitlines() if len(item) == 64]
    for candidate in candidates:
        identity = _inspect_owned(candidate, deadline)
        if exact_owned_cleanup(identity, candidate, nonce):
            _command(_docker(["rm", "-f", candidate]), deadline=deadline)


def _write_private(path: Path, data: str) -> None:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        stream.write(data)
    os.chmod(path, 0o600)


def main() -> int:
    overall_deadline = time.monotonic() + TIMEOUT_SECONDS
    proof_deadline = overall_deadline - 15
    stage = "admission"
    created_cid = None
    nonce = ""
    launch_attempted = False
    private_token_created = False
    proof_succeeded = False
    signal.signal(signal.SIGTERM, lambda _signum, _frame: (_ for _ in ()).throw(InterruptedError()))
    try:
        facts = _collect_facts(deadline=proof_deadline)
        validate_facts(facts)
        # All identity and collision checks finish before the first filesystem or Docker mutation.
        JOB_DIR.mkdir(mode=0o700)
        os.chmod(JOB_DIR, 0o700)
        token = secrets.token_urlsafe(48)
        nonce = secrets.token_hex(16)
        token_fd = os.open(TOKEN_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        private_token_created = True
        with os.fdopen(token_fd, "w", encoding="utf-8") as token_stream:
            token_stream.write("YELLOW_TOKEN_SECRET=" + token + "\nYELLOW_ORIGIN_NONCE=" + nonce + "\n")
        os.chmod(TOKEN_FILE, 0o600)
        del token
        stage = "launch"
        compose = ["docker", "compose", "--project-name", PROJECT, "-f", str(ORDER_DIR / "compose.yml"),
                   "--env-file", str(AUTHORITY), "--env-file", str(TOKEN_FILE)]
        launch_attempted = True
        _log(JOB_DIR, stage, _docker(compose[1:] + ["up", "-d", "--wait", "--wait-timeout", "20",
                                                    "--no-build", "--pull", "never", "app"]), proof_deadline)
        stage = "identity"
        cid = _log(JOB_DIR, stage, _docker(compose[1:] + ["ps", "-q", "app"]), proof_deadline).strip()
        if len(cid) != 64:
            raise GuardError("launched container identity unavailable")
        created_cid = cid
        identity = _inspect_owned(cid, proof_deadline)
        if not exact_owned_cleanup(identity, cid, nonce):
            raise GuardError("launched container ownership mismatch")
        stage = "proof"
        proof = _probe(proof_deadline)
        stage = "receipt"
        receipt = {
            "schema": "yellow-synthetic-origin-proof/v1",
            "executed": True,
            "job": JOB,
            "source_revision": SOURCE,
            "image_config_digest": IMAGE_ID,
            "container_id": cid,
            "container_name": CONTAINER_NAME,
            "ownership_nonce": nonce,
            "network": NETWORK,
            "published_origin": "http://127.0.0.1:53009",
            "database_target": "yellow_dev synthetic runtime authority; credentials withheld",
            "proof": proof,
            "stop_command": "docker --host " + DOCKER_SOCKET + " stop " + cid,
            "private_token_file": str(TOKEN_FILE),
            "token_file_retention": "retained on this VM for local diagnostic recovery; not an off-VM backup",
        }
        _write_private(RECEIPT, json.dumps(receipt, indent=2) + "\n")
        proof_succeeded = True
        print(json.dumps({"status": "proof complete", "receipt": str(RECEIPT),
                          "stop_command": receipt["stop_command"]}))
        return 0
    except BaseException as error:
        if launch_attempted and not proof_succeeded:
            try:
                cleanup_if_launched(True, lambda: _cleanup_created(created_cid, nonce, overall_deadline))
            except BaseException:
                pass
        unlink_created_private(TOKEN_FILE, private_token_created and not proof_succeeded)
        print("ERROR stage=" + stage + " type=" + type(error).__name__, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
