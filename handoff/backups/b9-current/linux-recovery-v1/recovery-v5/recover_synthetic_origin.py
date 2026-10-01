#!/usr/bin/env python3
"""One bounded synthetic backup/restore/private-origin recovery attempt."""
from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import subprocess
import sys
import time
import urllib.parse
from contextlib import redirect_stdout
from dataclasses import dataclass
from enum import Enum


ORDER_DIR = Path(__file__).absolute().parent
REPO = Path("/workspace/yellow-release")
SOURCE = "9ff27ad8765dc75ebae9e083d4635c7a9b89fa62"
FRONTIER = 100
APP_IMAGE_ID = "sha256:103cafd6ad6ca67c8ba4b41098c09cd325d3ac705e4867707b9f9ec49f9dc1f0"
PG_IMAGE_ID = "sha256:c293117fcecda7344b5480222e813b9f673d7abd69b1dd95eff239b768b04f59"
SOURCE_SCHEMA_SHA256 = "b924ed9532046a563df6332881716130deeb2e69dc88341d0123849d61c8edf9"
SOURCE_SCHEMA_STATEMENT_COUNT = 2449
PGLAST_SITE = Path("/workspace/yellow-toolchain/schema-parser-v1/lib/python3.12/site-packages")
PGLAST_VERSION = "v7.10"
DOCKER_SOCKET = "unix:///var/run/docker.sock"
JOB = "yellow-recovery-9ff-20261001-v5"
PROJECT = JOB
APP_NAME = JOB + "-app"
PG_NAME = JOB + "-postgres"
NETWORK_NAME = JOB + "-network"
VOLUME_NAME = JOB + "-pgdata"
SOURCE_PG_ID = "8285d83c127f8981d94e10c09fe6fce1bba9c594efe13a70332597eb0e5b5680"
SOURCE_PG_IMAGE = "sha256:c293117fcecda7344b5480222e813b9f673d7abd69b1dd95eff239b768b04f59"
SOURCE_PG_NAME = "/yellow-catalogue-referee-postgres-1"
OLD_APP_ID = "fe96ec05f4db113a5935c0d7e0f38aa6445b9ca16995c073195e399edcea4599"
OLD_APP_IMAGE = "sha256:35f7d5d121eec9ae34ad1c991bc40bc6474939610938a29383ecd30b65b63c8f"
OLD_APP_REVISION = "937912cc0546bfe7b7cd8b3c082f8ef798c20e5b"
OLD_APP_NAME = "/yellow-catalogue-referee-app-1"
ORIGIN_ID = "d002232dfdb8ba671ca51fc53ae8657ea72cc361740acd61c91b49e8f5bdca59"
ORIGIN_NAME = "/yellow-cloud-synthetic-origin-9ff-20261001"
ARCHIVE_SOURCE = Path("/workspace/yellow-coordination/release-20261001/receiving-9ff-v2/private-oci-export-9ff-v1/docker-save.tar")
OCI_SOURCE = ARCHIVE_SOURCE.parent / "oci-layout"
ARCHIVE_SHA256 = "9900ad842139dfa95ba128362af6a5754a4b93500e1f229123501319ce25ef5a"
OCI_MANIFEST_SHA256 = "843b32dc43df5f7fc5c295c161adb146b4a057ac9d710083218093452362eaeb"
OCI_CONFIG_SHA256 = "103cafd6ad6ca67c8ba4b41098c09cd325d3ac705e4867707b9f9ec49f9dc1f0"
OCI_MANIFEST = OCI_SOURCE / "blobs" / "sha256" / OCI_MANIFEST_SHA256
OCI_CONFIG = OCI_SOURCE / "blobs" / "sha256" / OCI_CONFIG_SHA256
OCI_VERIFIER = ARCHIVE_SOURCE.parent.parent / "verify_actual_oci_export.py"
PRIVATE_DIR = ORDER_DIR / "private-recovery-v5"
ENV_FILE = PRIVATE_DIR / "recovery.env"
ARCHIVE_COPY = PRIVATE_DIR / "docker-save.tar"
OCI_COPY = PRIVATE_DIR / "oci-layout"
GLOBALS_FILE = PRIVATE_DIR / "roles-no-passwords.sql"
MEMBERSHIPS_FILE = PRIVATE_DIR / "role-memberships.sql"
DUMP_FILE = PRIVATE_DIR / "yellow_dev.custom.dump"
BEFORE_FILE = PRIVATE_DIR / "source-before.json"
AFTER_FILE = PRIVATE_DIR / "source-after.json"
RECEIPT_FILE = PRIVATE_DIR / "receipt.json"
RESTORED_FINGERPRINT_FILE = PRIVATE_DIR / "restored-fingerprint.json"
COMPARISON_FILE = PRIVATE_DIR / "restore-comparison.json"
FAILURE_RECEIPT_FILE = PRIVATE_DIR / "failure-receipt.json"
SOURCE_SCHEMA_DUMP_FILE = PRIVATE_DIR / "source-schema-only.sql"
RESTORED_SCHEMA_DUMP_FILE = PRIVATE_DIR / "restored-schema-only.sql"
SCHEMA_PROOF_FILE = PRIVATE_DIR / "schema-proof.json"
PG_CONTAINER = PG_NAME
TOTAL_SECONDS = 600
CLEANUP_RESERVE_SECONDS = 30
NONCE_LABEL = "yellow.recovery.nonce"
JOB_LABEL = "yellow.recovery.job"
SOURCE_LABEL = "yellow.recovery.source"


class GuardError(Exception):
    """Refusal or failed assertion; only its type and stage are public."""


@dataclass(frozen=True)
class Admission:
    source_head: str
    source_dirty: bool
    source_pg_id: str
    source_pg_image: str
    source_pg_name: str
    source_pg_running: bool
    old_app_id: str
    old_app_image: str
    old_app_revision: str
    old_app_name: str
    old_app_running: bool
    origin_id: str
    origin_image: str
    origin_revision: str
    origin_name: str
    origin_running: bool
    new_names_absent: bool
    network_absent: bool
    volume_absent: bool
    archive_hash: str
    manifest_hash: str
    config_hash: str
    private_path_fresh: bool
    paths_safe: bool
    pg_image_id: str
    app_image_id: str
    app_tag_safe: bool
    retained_service_metadata: tuple[str, ...]
    conflicting_environment: bool


def validate_admission(a: Admission) -> None:
    checks = (
        (a.source_head == SOURCE and not a.source_dirty, "source identity"),
        (a.source_pg_id == SOURCE_PG_ID and a.source_pg_image == SOURCE_PG_IMAGE
         and a.source_pg_name == SOURCE_PG_NAME and a.source_pg_running, "source database identity"),
        (a.old_app_id == OLD_APP_ID and a.old_app_image == OLD_APP_IMAGE and a.old_app_revision == OLD_APP_REVISION
         and a.old_app_name == OLD_APP_NAME and a.old_app_running, "old app identity"),
        (a.origin_id == ORIGIN_ID and a.origin_image == APP_IMAGE_ID and a.origin_revision == SOURCE
         and a.origin_name == ORIGIN_NAME and a.origin_running, "existing 9ff origin identity"),
        (a.new_names_absent and a.network_absent and a.volume_absent, "recovery resource name collision"),
        (a.archive_hash == ARCHIVE_SHA256 and a.manifest_hash == OCI_MANIFEST_SHA256
         and a.config_hash == OCI_CONFIG_SHA256, "copied image input integrity"),
        (a.private_path_fresh, "private recovery path is not fresh"),
        (a.paths_safe, "symlinked recovery path refused"),
        (a.pg_image_id == PG_IMAGE_ID and a.app_image_id in ("", APP_IMAGE_ID), "pinned image identity"),
        (a.app_tag_safe, "mutable image tag would be overwritten"),
        (not a.conflicting_environment, "generated Compose binding collides with inherited environment"),
    )
    for valid, reason in checks:
        if not valid:
            raise GuardError(reason)


def owned_cleanup(identity: tuple[str, str, str, str, str, str] | None,
                  *, expected_id: str, expected_image: str, expected_name: str,
                  nonce: str) -> bool:
    if identity is None:
        return False
    cid, image_id, name, job, source, observed_nonce = identity
    return (len(cid) == 64 and cid == expected_id and image_id == expected_image
            and name == expected_name and job == JOB and source == SOURCE
            and observed_nonce == nonce)


def owned_network(identity: tuple[str, str, str, str, str] | None, nonce: str) -> bool:
    if identity is None:
        return False
    engine_id, name, job, source, observed_nonce = identity
    return (len(engine_id) == 64 and name == NETWORK_NAME and job == JOB
            and source == SOURCE and observed_nonce == nonce)


def owned_volume(identity: tuple[str, str, str, str, str] | None, nonce: str) -> bool:
    if identity is None:
        return False
    name, driver, job, source, observed_nonce = identity
    return (name == VOLUME_NAME and driver == "local" and job == JOB
            and source == SOURCE and observed_nonce == nonce)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_asset_path(value: str) -> str:
    parsed = urllib.parse.urlsplit(value)
    if value.startswith("//") or parsed.scheme or parsed.netloc:
        raise GuardError("external asset path refused")
    if any(segment == ".." for segment in parsed.path.split("/")):
        raise GuardError("asset traversal refused")
    return value if value.startswith("/") else "/" + value


def _docker(args: list[str]) -> list[str]:
    return ["docker", "--host", DOCKER_SOCKET, *args]


def _docker_env() -> dict[str, str]:
    env = dict(os.environ)
    for key in ("DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"):
        env.pop(key, None)
    return env


def _source_pg_command(program: str, *args: str) -> list[str]:
    return _docker(["exec", SOURCE_PG_ID, program, *args])


def _has_symlink_component(path: Path) -> bool:
    current = Path(path.absolute().anchor)
    for part in path.absolute().parts[1:]:
        current /= part
        try:
            if current.is_symlink():
                return True
        except OSError:
            return True
    return False


def _paths_safe() -> bool:
    paths_safe = all(not _has_symlink_component(path) for path in (
        ORDER_DIR, Path(__file__).absolute(), ORDER_DIR / "compose.yml", PRIVATE_DIR,
        ARCHIVE_SOURCE, OCI_SOURCE, OCI_MANIFEST, OCI_CONFIG, OCI_VERIFIER,
        ARCHIVE_SOURCE.parent / "selected-image.json", ARCHIVE_SOURCE.parent / "conversion-result.json",
    ))
    if not paths_safe:
        return False
    return not any(path.is_symlink() for path in OCI_SOURCE.rglob("*"))


def _append_log(args: list[str], stdout: bytes, stderr: bytes, output_note: str = "") -> None:
    log_path = PRIVATE_DIR / "commands.log"
    maximum = 8 * 1024 * 1024
    try:
        if log_path.stat().st_size >= maximum:
            return
    except FileNotFoundError:
        pass
    record = ("$ " + " ".join(args) + "\n").encode() + (output_note + "\n").encode() \
        + stdout[:65536] + b"\n[stdout truncated per command]\n" + stderr[:65536]
    fd = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    with os.fdopen(fd, "ab") as log:
        remaining = maximum - log.tell()
        if remaining > 0:
            log.write(record[:remaining])


def _kill_group(process: subprocess.Popen) -> None:
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


def _run(args: list[str], *, deadline: float, cap: float = 60,
         env: dict[str, str] | None = None, input_file=None,
         input_bytes: bytes | None = None, stdout_path: Path | None = None,
         log: bool = True) -> bytes:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError
    stdout_file = stdout_path.open("wb") if stdout_path is not None else subprocess.PIPE
    if stdout_path is not None:
        os.chmod(stdout_path, 0o600)
    process = subprocess.Popen(
        args,
        stdin=input_file if input_file is not None else (subprocess.PIPE if input_bytes is not None else subprocess.DEVNULL),
        stdout=stdout_file,
        stderr=subprocess.PIPE,
        env=env if env is not None else _docker_env(),
        start_new_session=True,
    )
    try:
        stdout, stderr = process.communicate(input=input_bytes, timeout=min(remaining, cap))
    except BaseException:
        _kill_group(process)
        stdout, stderr = process.communicate()
        if log and PRIVATE_DIR.exists():
            _append_log(args, stdout or b"", stderr or b"", "stdout saved privately" if stdout_path else "")
        raise
    finally:
        if stdout_path is not None:
            stdout_file.close()
    stdout_bytes = stdout or b""
    stderr_bytes = stderr or b""
    if log and PRIVATE_DIR.exists():
        _append_log(args, stdout_bytes, stderr_bytes, "stdout saved privately" if stdout_path else "")
    if process.returncode:
        raise GuardError("command failed")
    return stdout_bytes


def _run_text(args: list[str], *, deadline: float, cap: float = 30,
              env: dict[str, str] | None = None, input_file=None,
              input_bytes: bytes | None = None, log: bool = True) -> str:
    return _run(args, deadline=deadline, cap=cap, env=env, input_file=input_file,
                input_bytes=input_bytes, log=log).decode("utf-8", "strict").strip()


def _format(fields: list[str], expected: int) -> list[str]:
    parts = "|".join(fields).split("|", expected - 1)
    if len(parts) != expected:
        raise GuardError("selected metadata malformed")
    return parts


def _docker_one(template: str, target: str, deadline: float) -> list[str]:
    line = _run_text(_docker(["inspect", "--format", template, target]), deadline=deadline)
    return line.split("|")


CONTAINER_FORMAT = (
    "{{.Id}}|{{.Image}}|{{.Name}}|{{.State.Running}}|"
    '{{index .Config.Labels "org.opencontainers.image.revision"}}|'
    '{{index .Config.Labels "yellow.recovery.job"}}|'
    '{{index .Config.Labels "yellow.recovery.source"}}|'
    '{{index .Config.Labels "yellow.recovery.nonce"}}'
)
OWNED_CONTAINER_FORMAT = (
    "{{.Id}}|{{.Image}}|{{.Name}}|{{index .Config.Labels \"yellow.recovery.job\"}}|"
    '{{index .Config.Labels "yellow.recovery.source"}}|'
    '{{index .Config.Labels "yellow.recovery.nonce"}}'
)
NETWORK_FORMAT = (
    "{{.Id}}|{{.Name}}|{{index .Labels \"yellow.recovery.job\"}}|"
    '{{index .Labels "yellow.recovery.source"}}|{{index .Labels "yellow.recovery.nonce"}}'
)
VOLUME_FORMAT = (
    "{{.Name}}|{{.Driver}}|{{index .Labels \"yellow.recovery.job\"}}|"
    '{{index .Labels "yellow.recovery.source"}}|{{index .Labels "yellow.recovery.nonce"}}'
)


def _list_named(kind: str, name: str, deadline: float) -> list[str]:
    if kind == "container":
        command = _docker(["ps", "-aq", "--no-trunc", "--filter", "name=^/" + name + "$"])
    elif kind == "network":
        command = _docker(["network", "ls", "-q", "--no-trunc", "--filter", "name=^" + name + "$"])
    else:
        command = _docker(["volume", "ls", "-q", "--filter", "name=^" + name + "$"])
    return [line for line in _run_text(command, deadline=deadline).splitlines() if line]


def _inspect_container(cid: str, deadline: float) -> list[str]:
    return _format(_docker_one(CONTAINER_FORMAT, cid, deadline), 8)


IMAGE_IDENTITY_FORMAT = (
    "{{.Id}}|{{.Os}}|{{.Architecture}}|{{.Config.User}}|{{json .Config.Cmd}}|"
    '{{if .Config.Labels}}{{index .Config.Labels "org.opencontainers.image.revision"}}{{end}}'
)


def _image_identity(image: str, deadline: float) -> list[str]:
    return _format(_docker_one(IMAGE_IDENTITY_FORMAT, image, deadline), 6)


APP_TAG = "yellow-managed:" + SOURCE


def _local_image_ids(deadline: float) -> set[str]:
    values = _run_text(_docker(["image", "ls", "-aq", "--no-trunc"]), deadline=deadline)
    return set(values.splitlines())


def _retained_service_metadata(deadline: float) -> tuple[str, ...]:
    template = (
        "{{.Id}}|{{.Image}}|{{.Name}}|{{.State.Running}}|{{.HostConfig.RestartPolicy.Name}}|"
        "{{json .HostConfig.PortBindings}}|{{index .Config.Labels \"org.opencontainers.image.revision\"}}"
    )
    return tuple(_run_text(_docker(["inspect", "--format", template, cid]), deadline=deadline)
                 for cid in (SOURCE_PG_ID, OLD_APP_ID, ORIGIN_ID))


def _archive_digest_inputs() -> tuple[str, str, str]:
    return sha256_file(ARCHIVE_SOURCE), sha256_file(OCI_MANIFEST), sha256_file(OCI_CONFIG)


def _collect_admission(deadline: float) -> Admission:
    head = _run_text(["git", "-C", str(REPO), "rev-parse", "HEAD"], deadline=deadline, env=os.environ.copy())
    dirty = bool(_run_text(["git", "-C", str(REPO), "status", "--porcelain=v1", "--untracked-files=all"],
                           deadline=deadline, env=os.environ.copy()))
    source_pg = _inspect_container(SOURCE_PG_ID, deadline)
    old_app = _inspect_container(OLD_APP_ID, deadline)
    origin = _inspect_container(ORIGIN_ID, deadline)
    image_ids = _local_image_ids(deadline)
    if APP_IMAGE_ID in image_ids:
        image_id, image_os, image_arch, image_user, image_cmd, image_revision = _image_identity(APP_IMAGE_ID, deadline)
        app_id = image_id if image_os == "linux" and image_arch == "amd64" and image_user == "bun" \
            and json.loads(image_cmd) == ["bun", "run", "start"] and image_revision == SOURCE else "mismatch"
    else:
        app_id = ""
    tag_ids = _run_text(_docker(["image", "ls", "-aq", "--no-trunc", "--filter", "reference=" + APP_TAG]),
                        deadline=deadline).splitlines()
    app_tag_safe = not tag_ids or all(image_id == APP_IMAGE_ID for image_id in tag_ids)
    conflicting_environment = any(key in os.environ for key in (
        "YELLOW_RECOVERY_NONCE", "YELLOW_DEPLOY_DATABASE_PASSWORD",
        "YELLOW_RUNTIME_DATABASE_PASSWORD", "YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD",
        "YELLOW_TOKEN_SECRET",
    ))
    pg_image_id, _, _, _, _, _ = _image_identity(PG_IMAGE_ID, deadline)
    source_archive_hash, manifest_hash, config_hash = _archive_digest_inputs()
    new_names_absent = not any(_list_named("container", name, deadline) for name in (APP_NAME, PG_NAME))
    network_absent = not _list_named("network", NETWORK_NAME, deadline)
    volume_absent = not _list_named("volume", VOLUME_NAME, deadline)
    safe = _paths_safe()
    path_fresh = not PRIVATE_DIR.exists()
    pg_facts = _format(source_pg, 8)
    old_facts = _format(old_app, 8)
    origin_facts = _format(origin, 8)
    return Admission(
        source_head=head,
        source_dirty=dirty,
        source_pg_id=pg_facts[0],
        source_pg_image=pg_facts[1],
        source_pg_name=pg_facts[2],
        source_pg_running=pg_facts[3].lower() == "true",
        old_app_id=old_facts[0],
        old_app_image=old_facts[1],
        old_app_name=old_facts[2],
        old_app_running=old_facts[3].lower() == "true",
        old_app_revision=old_facts[4],
        origin_id=origin_facts[0],
        origin_image=origin_facts[1],
        origin_name=origin_facts[2],
        origin_running=origin_facts[3].lower() == "true",
        origin_revision=origin_facts[4],
        new_names_absent=new_names_absent,
        network_absent=network_absent,
        volume_absent=volume_absent,
        archive_hash=source_archive_hash,
        manifest_hash=manifest_hash,
        config_hash=config_hash,
        private_path_fresh=path_fresh,
        paths_safe=safe,
        pg_image_id=pg_image_id,
        app_image_id=app_id,
        app_tag_safe=app_tag_safe,
        retained_service_metadata=_retained_service_metadata(deadline),
        conflicting_environment=conflicting_environment,
    )


def _private_copy_inputs() -> dict:
    PRIVATE_DIR.mkdir(mode=0o700)
    os.chmod(PRIVATE_DIR, 0o700)
    shutil.copyfile(ARCHIVE_SOURCE, ARCHIVE_COPY)
    os.chmod(ARCHIVE_COPY, 0o600)
    shutil.copytree(OCI_SOURCE, OCI_COPY, symlinks=True)
    for metadata_name in ("selected-image.json", "conversion-result.json"):
        shutil.copyfile(ARCHIVE_SOURCE.parent / metadata_name, PRIVATE_DIR / metadata_name)
        os.chmod(PRIVATE_DIR / metadata_name, 0o600)
    os.chmod(OCI_COPY, 0o700)
    for path in OCI_COPY.rglob("*"):
        if path.is_symlink():
            raise GuardError("symlink in copied OCI layout")
        if path.is_dir():
            os.chmod(path, 0o700)
        else:
            os.chmod(path, 0o600)
    return verify_private_image_inputs()


def verify_private_image_inputs() -> dict:
    spec = importlib.util.spec_from_file_location("yellow_oci_verifier", OCI_VERIFIER)
    if spec is None or spec.loader is None:
        raise GuardError("OCI verifier unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.JOB = PRIVATE_DIR
    captured = io.StringIO()
    with redirect_stdout(captured):
        module.main()
    proof = json.loads(captured.getvalue())
    if proof.get("passed") is not True or proof.get("config_digest") != APP_IMAGE_ID \
            or proof.get("docker_save_archive_digest") != "sha256:" + ARCHIVE_SHA256 \
            or len(proof.get("layers", [])) != 11:
        raise GuardError("private OCI content verification failed")
    return {"archive_sha256": proof["docker_save_archive_digest"][7:],
            "archive_bytes": proof["docker_save_archive_bytes"],
            "oci_manifest_sha256": proof["oci_export_manifest_digest"][7:],
            "oci_config_sha256": proof["config_digest"][7:],
            "oci_layer_count": len(proof["layers"]),
            "oci_content_proof": proof}


def _sql_json(sql: str, *, database: str, deadline: float, fresh: bool = False) -> object:
    if fresh:
        command = _docker(["exec", PG_CONTAINER, "psql", "-X", "-qAt", "--no-password", "-h",
                           "/var/run/postgresql", "-U", "yellow_deploy", "-d", database, "-v", "ON_ERROR_STOP=1",
                           "--command", sql])
    else:
        command = _source_pg_command("psql", "-X", "-qAt", "--no-password", "-v", "ON_ERROR_STOP=1",
                                     "-h", "/var/run/postgresql", "-U", "yellow_deploy", "-d", database,
                                     "--command", sql)
    value = _run_text(command, deadline=deadline, cap=45, log=True)
    return json.loads(value)


def _names_and_ledger(deadline: float, *, fresh: bool = False) -> tuple[list[str], list[dict]]:
    tables = _sql_json(
        "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; "
        "SELECT COALESCE(json_agg(relname ORDER BY relname),'[]'::json)::text FROM pg_class c "
        "JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'; ROLLBACK;",
        database="yellow_dev", deadline=deadline, fresh=fresh)
    ledger = _sql_json(
        "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; "
        "SELECT COALESCE(json_agg(json_build_object('version',version,'filename',filename,"
        "'checksum_sha256',checksum_sha256) ORDER BY version),'[]'::json)::text "
        "FROM public.schema_migration; ROLLBACK;",
        database="yellow_dev", deadline=deadline, fresh=fresh)
    if not isinstance(tables, list) or not isinstance(ledger, list):
        raise GuardError("source catalogue metadata malformed")
    if len(tables) != 130 or len(ledger) != FRONTIER:
        raise GuardError("source schema frontier mismatch")
    for name in tables:
        if not isinstance(name, str) or not re.fullmatch(r"[a-z_][a-z0-9_]*", name):
            raise GuardError("source table identifier malformed")
    for row in ledger:
        name = row.get("filename", "")
        if not re.fullmatch(r"[0-9]{4}_[a-z0-9_]+\.sql", name):
            raise GuardError("migration filename malformed")
        if sha256_file(REPO / "migrations" / name) != row.get("checksum_sha256"):
            raise GuardError("source migration checksum mismatch")
    return tables, ledger


def _sequence_fingerprint(deadline: float, *, fresh: bool = False) -> dict:
    names = _sql_json(
        "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; "
        "SELECT COALESCE(json_agg(relname ORDER BY relname),'[]'::json)::text FROM pg_class c "
        "JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S'; ROLLBACK;",
        database="yellow_dev", deadline=deadline, fresh=fresh)
    if not isinstance(names, list) or any(not isinstance(name, str)
                                           or not re.fullmatch(r"[a-z_][a-z0-9_]*", name) for name in names):
        raise GuardError("public sequence catalogue malformed")
    if not names:
        return {"count": 0, "state_sha256": hashlib.sha256(b"").hexdigest()}
    statements = []
    for name in names:
        statements.append("SELECT json_build_object('name','" + name + "','last_value',last_value,"
                          "'is_called',is_called)::text FROM public.\"" + name + "\";")
    query = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; " + " ".join(statements) + " ROLLBACK;"
    if fresh:
        command = _docker(["exec", PG_CONTAINER, "psql", "-X", "-qAt", "--no-password", "-h",
                           "/var/run/postgresql", "-U", "yellow_deploy", "-d", "yellow_dev",
                           "-v", "ON_ERROR_STOP=1", "--command", query])
    else:
        command = _source_pg_command("psql", "-X", "-qAt", "--no-password", "-v", "ON_ERROR_STOP=1",
                                     "-h", "/var/run/postgresql", "-U", "yellow_deploy", "-d", "yellow_dev",
                                     "--command", query)
    lines = _run(command, deadline=deadline, cap=45, log=False).decode("utf-8", "strict").splitlines()
    if len(lines) != len(names):
        raise GuardError("public sequence state fingerprint malformed")
    states = [json.loads(line) for line in lines]
    if [row.get("name") for row in states] != names:
        raise GuardError("public sequence state names differ")
    return {"count": len(names), "state_sha256": hashlib.sha256("\n".join(lines).encode()).hexdigest()}


def _fingerprint_sql(tables: list[str], ledger: list[dict]) -> str:
    identity_sql = (
        "SELECT json_build_object('database',current_database(),'user',session_user,"
        "'version',current_setting('server_version'),'frontier',(SELECT count(*) FROM public.schema_migration),"
        "'table_count',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
        "WHERE n.nspname='public' AND c.relkind='r'))::text;"
    )
    row_sql = []
    for name in tables:
        row_sql.append(
            "SELECT json_build_object('table','" + name + "','rows',count(*),'sha256',"
            "encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' "
            "ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex'))::text FROM public.\"" + name + "\" t;"
        )
    return "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; " + identity_sql + " " + " ".join(row_sql) + " ROLLBACK;"


def _role_and_db_metadata(database: str, *, deadline: float, fresh: bool = False) -> dict:
    sql = (
        "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT json_build_object("
        "'roles',(SELECT COALESCE(json_agg(json_build_object('name',r.rolname,'oid',(SELECT a.oid::integer "
        "FROM pg_authid a WHERE a.rolname=r.rolname AND r.rolname='yellow_deploy'),'superuser',r.rolsuper,"
        "'inherit',r.rolinherit,'create_role',r.rolcreaterole,'create_db',r.rolcreatedb,'login',r.rolcanlogin,"
        "'replication',r.rolreplication,'bypass_rls',r.rolbypassrls,'connection_limit',r.rolconnlimit,"
        "'valid_until',r.rolvaliduntil::text) ORDER BY r.rolname),'[]'::json) FROM pg_roles r),"
        "'memberships',(SELECT COALESCE(json_agg(json_build_object('role',gr.rolname,'member',mem.rolname,"
        "'grantor',gtr.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) "
        "ORDER BY gr.rolname,mem.rolname,gtr.rolname),'[]'::json) FROM pg_auth_members m "
        "JOIN pg_roles gr ON gr.oid=m.roleid JOIN pg_roles mem ON mem.oid=m.member "
        "JOIN pg_roles gtr ON gtr.oid=m.grantor),"
        "'settings',(SELECT COALESCE(json_agg(json_build_object('role',COALESCE(r.rolname,''),"
        "'database',COALESCE(d.datname,''),'config',s.setconfig) ORDER BY COALESCE(r.rolname,''),"
        "COALESCE(d.datname,'')),'[]'::json) FROM pg_db_role_setting s LEFT JOIN pg_roles r ON r.oid=s.setrole "
        "LEFT JOIN pg_database d ON d.oid=s.setdatabase),"
        "'database',(SELECT json_build_object('name',d.datname,'owner',owner.rolname,'encoding',d.encoding,"
        "'collate',d.datcollate,'ctype',d.datctype,'allow_connections',d.datallowconn,'connection_limit',d.datconnlimit,"
        "'acl',(SELECT COALESCE(json_agg(json_build_object('grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE gr.rolname END,"
        "'grantor',gtr.rolname,'privilege',x.privilege_type,'grantable',x.is_grantable) "
        "ORDER BY CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE gr.rolname END,gtr.rolname,"
        "x.privilege_type,x.is_grantable),'[]'::json) FROM aclexplode(COALESCE(d.datacl,acldefault('d',d.datdba))) x "
        "LEFT JOIN pg_roles gr ON gr.oid=x.grantee JOIN pg_roles gtr ON gtr.oid=x.grantor)) "
        "FROM pg_database d JOIN pg_roles owner ON owner.oid=d.datdba WHERE d.datname=current_database()))::text; ROLLBACK;"
    )
    result = _sql_json(sql, database=database, deadline=deadline, fresh=fresh)
    if not isinstance(result, dict):
        raise GuardError("role/database metadata malformed")
    return result


EXPECTED_SOURCE_MEMBERSHIPS = {
    ("pg_read_all_settings", "pg_monitor", "yellow_deploy", False, True, True),
    ("pg_read_all_stats", "pg_monitor", "yellow_deploy", False, True, True),
    ("pg_stat_scan_tables", "pg_monitor", "yellow_deploy", False, True, True),
    ("app_role", "yellow_runtime", "yellow_deploy", False, False, True),
}


def role_metadata_matches(source: dict, restored: dict) -> bool:
    return isinstance(source, dict) and isinstance(restored, dict) and source == restored


def validate_deploy_role_identity(role_metadata: object) -> None:
    roles = role_metadata.get("roles") if isinstance(role_metadata, dict) else None
    if not isinstance(roles, list):
        raise GuardError("yellow_deploy source role metadata missing")
    matches = [role for role in roles if isinstance(role, dict) and role.get("name") == "yellow_deploy"]
    if len(matches) != 1 or matches[0].get("oid") != 10 \
            or matches[0].get("superuser") is not True or matches[0].get("login") is not True:
        raise GuardError("yellow_deploy source bootstrap identity differs")


def _normalize_schema_dump(dump: bytes) -> bytes:
    lines = dump.splitlines(keepends=True)
    return b"".join(
        b"\\restrict <dump-restriction-token>\n" if line.startswith(b"\\restrict ") else
        b"\\unrestrict <dump-restriction-token>\n" if line.startswith(b"\\unrestrict ") else line
        for line in lines
    )


def _schema_dump(database: str, deadline: float, *, fresh: bool = False) -> bytes:
    if fresh:
        command = _docker(["exec", PG_CONTAINER, "pg_dump", "--schema-only", "--no-password", "-h",
                           "/var/run/postgresql", "-U", "yellow_deploy", "-d", database])
    else:
        command = _source_pg_command("pg_dump", "--no-password", "--schema-only", "-h", "/var/run/postgresql",
                                     "-U", "yellow_deploy", "-d", database)
    return _run(command, deadline=deadline, cap=60, log=False)


def _schema_digest(database: str, deadline: float, *, fresh: bool = False) -> str:
    return hashlib.sha256(_normalize_schema_dump(_schema_dump(database, deadline, fresh=fresh))).hexdigest()


KNOWN_CHECK_CONSTRAINTS = frozenset({
    "fiscal_submission_history_check", "cash_drawer_code_ck", "cash_drawer_name_ck",
    "cashier_session_close_reason_ck", "india_native_fiscal_credit_note_reason_check",
    "india_sez_unit_loa_renewal_file_number_ck", "india_sez_unit_loa_renewal_original_reference_ck",
    "party_fiscal_registration_address_line1_ck", "party_fiscal_registration_legal_name_ck",
    "party_fiscal_registration_locality_ck", "party_fiscal_registration_trade_name_ck",
    "payment_instrument_token_shape_ck", "property_fiscal_location_address_line1_ck",
    "property_fiscal_location_locality_ck", "property_fiscal_registration_address_line_ck",
    "property_fiscal_registration_legal_name_ck", "property_fiscal_registration_locality_ck",
    "property_fiscal_registration_trade_name_ck", "provider_event_receipt_event_id_ck",
    "provider_event_receipt_provider_reference_ck",
})


def _pglast_api():
    if not PGLAST_SITE.is_dir():
        raise GuardError("pinned PostgreSQL schema parser unavailable")
    site = str(PGLAST_SITE)
    if site in sys.path:
        sys.path.remove(site)
    sys.path.insert(0, site)
    try:
        module = importlib.import_module("pglast")
        node_type = importlib.import_module("pglast.ast").Node
        parse_sql = module.parse_sql
        module_path = Path(module.__file__).resolve()
    except BaseException:
        raise GuardError("pinned PostgreSQL schema parser unavailable") from None
    if module.__version__ != PGLAST_VERSION or PGLAST_SITE.resolve() not in module_path.parents:
        raise GuardError("pinned PostgreSQL schema parser identity mismatch")
    return parse_sql, node_type


def _canonical_ast_value(value: object, node_type: type) -> object:
    if isinstance(value, node_type):
        fields = {}
        for name in value:
            field_value = getattr(value, name)
            if name in {"location", "stmt_location", "stmt_len"} and type(field_value) is int:
                continue
            fields[name] = _canonical_ast_value(field_value, node_type)
        return {"node": type(value).__name__, "fields": fields}
    if isinstance(value, dict):
        return {str(key): _canonical_ast_value(value[key], node_type) for key in sorted(value, key=str)}
    if isinstance(value, (list, tuple)):
        return [_canonical_ast_value(item, node_type) for item in value]
    if isinstance(value, (set, frozenset)):
        normalized = [_canonical_ast_value(item, node_type) for item in value]
        return sorted(normalized, key=lambda item: json.dumps(item, sort_keys=True, separators=(",", ":")))
    if isinstance(value, Enum):
        enum_value = value.value
        if type(enum_value) not in (str, bool, int, float):
            raise GuardError("PostgreSQL schema AST contains an unsupported enum")
        return {"enum": type(value).__name__, "name": value.name, "value": enum_value}
    if value is None or type(value) in (str, bool, int, float):
        return value
    if isinstance(value, bytes):
        return {"bytes_hex": value.hex()}
    raise GuardError("PostgreSQL schema AST contains an unsupported value")


def _schema_sql_without_dump_controls(dump: bytes) -> str:
    try:
        text = dump.decode("utf-8", "strict")
    except UnicodeDecodeError:
        raise GuardError("schema dump encoding invalid") from None
    retained = []
    restrict_count = 0
    unrestrict_count = 0
    for line in text.splitlines(keepends=True):
        stripped = line.rstrip("\r\n")
        if stripped.startswith("\\restrict "):
            if not re.fullmatch(r"\\restrict [A-Za-z0-9]+", stripped):
                raise GuardError("schema dump restrict directive malformed")
            restrict_count += 1
            continue
        if stripped.startswith("\\unrestrict "):
            if not re.fullmatch(r"\\unrestrict [A-Za-z0-9]+", stripped):
                raise GuardError("schema dump unrestrict directive malformed")
            unrestrict_count += 1
            continue
        retained.append(line)
    if restrict_count != 1 or unrestrict_count != 1:
        raise GuardError("schema dump control directive count differs")
    return "".join(retained)


def schema_ast_summary(dump: bytes) -> tuple[int, str, str]:
    parse_sql, node_type = _pglast_api()
    sql_text = _schema_sql_without_dump_controls(dump)
    try:
        statements = parse_sql(sql_text)
        canonical = _canonical_ast_value(statements, node_type)
        canonical_json = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    except GuardError:
        raise
    except BaseException:
        raise GuardError("PostgreSQL schema AST parse failed") from None
    return len(statements), hashlib.sha256(canonical_json.encode("utf-8")).hexdigest(), canonical_json


def _constraint_name_from_diff_line(line: bytes) -> str | None:
    try:
        text = line.decode("utf-8", "strict")
    except UnicodeDecodeError:
        return None
    matches = [name for name in KNOWN_CHECK_CONSTRAINTS
               if re.search(r"\bCONSTRAINT\s+\"?" + re.escape(name) + r"\"?\s+CHECK\b", text)]
    return matches[0] if len(matches) == 1 else None


def schema_proof(source_dump: bytes, restored_dump: bytes) -> dict:
    source_normalized = _normalize_schema_dump(source_dump)
    restored_normalized = _normalize_schema_dump(restored_dump)
    source_lines = source_normalized.splitlines(keepends=True)
    restored_lines = restored_normalized.splitlines(keepends=True)
    source_hash = hashlib.sha256(source_normalized).hexdigest()
    restored_hash = hashlib.sha256(restored_normalized).hexdigest()
    proof = {
        "schema": "yellow-synthetic-schema-proof/v5",
        "source_raw_sha256": hashlib.sha256(source_dump).hexdigest(),
        "restored_raw_sha256": hashlib.sha256(restored_dump).hexdigest(),
        "source_normalized_sha256": source_hash,
        "restored_normalized_sha256": restored_hash,
        "source_line_count": len(source_lines),
        "restored_line_count": len(restored_lines),
        "byte_equal_after_dump_control_normalization": source_normalized == restored_normalized,
        "line_diff_count": 0,
        "line_differences_sha256": [],
        "pglast_version": None,
        "source_statement_count": None,
        "restored_statement_count": None,
        "source_ast_sha256": None,
        "restored_ast_sha256": None,
        "full_ast_equal_after_scanner_coordinates_removed": None,
        "strict_full_schema_equivalence_passed": False,
        "guard_reason": None,
        "raw_schema_lines_included": False,
    }
    if len(source_lines) != len(restored_lines):
        proof["guard_reason"] = "schema dump line count differs"
        return proof
    if source_hash != SOURCE_SCHEMA_SHA256:
        proof["guard_reason"] = "source schema hash differs from pinned frontier artifact"
        return proof

    differences = []
    seen_names = set()
    for index, (source_line, restored_line) in enumerate(zip(source_lines, restored_lines), start=1):
        if source_line == restored_line:
            continue
        source_name = _constraint_name_from_diff_line(source_line)
        restored_name = _constraint_name_from_diff_line(restored_line)
        if (source_name is None or source_name != restored_name or source_name in seen_names
                or source_line.translate(None, b"()") != restored_line.translate(None, b"()")):
            proof["guard_reason"] = "schema dump has a non-allowlisted CHECK-line byte difference"
            return proof
        seen_names.add(source_name)
        differences.append({"line_number": index, "constraint_name": source_name,
                            "source_line_sha256": hashlib.sha256(source_line).hexdigest(),
                            "restored_line_sha256": hashlib.sha256(restored_line).hexdigest()})
    proof["line_diff_count"] = len(differences)
    proof["line_differences_sha256"] = differences
    if differences and (len(differences) != 20 or seen_names != KNOWN_CHECK_CONSTRAINTS):
        proof["guard_reason"] = "schema dump does not match the exact twenty known CHECK-line differences"
        return proof
    source_count, source_ast_hash, source_ast = schema_ast_summary(source_dump)
    restored_count, restored_ast_hash, restored_ast = schema_ast_summary(restored_dump)
    if source_count != SOURCE_SCHEMA_STATEMENT_COUNT or restored_count != SOURCE_SCHEMA_STATEMENT_COUNT:
        proof.update({"pglast_version": PGLAST_VERSION,
                      "source_statement_count": source_count,
                      "restored_statement_count": restored_count,
                      "source_ast_sha256": source_ast_hash,
                      "restored_ast_sha256": restored_ast_hash,
                      "full_ast_equal_after_scanner_coordinates_removed": source_ast == restored_ast,
                      "guard_reason": "schema AST statement count differs from pinned source"})
        return proof
    ast_equal = source_ast == restored_ast
    proof.update({
        "line_diff_count": len(differences),
        "line_differences_sha256": differences,
        "pglast_version": PGLAST_VERSION,
        "source_statement_count": source_count,
        "restored_statement_count": restored_count,
        "source_ast_sha256": source_ast_hash,
        "restored_ast_sha256": restored_ast_hash,
        "full_ast_equal_after_scanner_coordinates_removed": ast_equal,
        "strict_full_schema_equivalence_passed": ast_equal,
        "guard_reason": None if ast_equal else "full PostgreSQL schema AST differs",
    })
    return proof


def snapshot_database(database: str, deadline: float, *, fresh: bool = False) -> dict:
    tables, ledger = _names_and_ledger(deadline, fresh=fresh)
    sequence_state = _sequence_fingerprint(deadline, fresh=fresh)
    query = _fingerprint_sql(tables, ledger)
    if fresh:
        command = _docker(["exec", PG_CONTAINER, "psql", "-X", "-qAt", "--no-password", "-h",
                           "/var/run/postgresql", "-U", "yellow_deploy", "-d", database, "-v", "ON_ERROR_STOP=1",
                           "--command", query])
        lines = _run(command, deadline=deadline, cap=150, log=False).decode().splitlines()
    else:
        command = _source_pg_command("psql", "-X", "-qAt", "--no-password", "-v", "ON_ERROR_STOP=1",
                                     "-h", "/var/run/postgresql", "-U", "yellow_deploy", "-d", database,
                                     "--command", query)
        lines = _run(command, deadline=deadline, cap=150, log=False).decode().splitlines()
    if len(lines) != len(tables) + 1:
        raise GuardError("row fingerprint output malformed")
    identity = json.loads(lines[0])
    rows = [json.loads(line) for line in lines[1:]]
    expected_user = "yellow_deploy"
    if identity["database"] != "yellow_dev" or identity["user"] != expected_user \
            or not identity["version"].startswith("18.") \
            or identity["frontier"] != FRONTIER or identity["table_count"] != len(tables):
        raise GuardError("database frontier/table count mismatch")
    globals_db = _role_and_db_metadata(database, deadline=deadline, fresh=fresh)
    validate_deploy_role_identity(globals_db)
    if fresh:
        deploy_role = next((role for role in globals_db["roles"] if role.get("name") == "yellow_deploy"), None)
        if not isinstance(deploy_role, dict) or deploy_role.get("oid") != 10:
            raise GuardError("fresh yellow_deploy OID 10 identity missing")
    schema_hash = _schema_digest(database, deadline, fresh=fresh)
    return {
        "identity": identity,
        "tables": tables,
        "ledger": ledger,
        "table_digests": rows,
        "public_sequences": sequence_state,
        "schema_sha256": schema_hash,
        "roles_memberships_database_acl": globals_db,
        "raw_business_rows_emitted": False,
    }


def _write_private(path: Path, payload: bytes) -> None:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(payload)
    os.chmod(path, 0o600)


def _private_env(nonce: str) -> dict[str, str]:
    return {
        "YELLOW_RECOVERY_NONCE": nonce,
        "YELLOW_DEPLOY_DATABASE_PASSWORD": secrets.token_urlsafe(48),
        "YELLOW_RUNTIME_DATABASE_PASSWORD": secrets.token_urlsafe(48),
        "YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD": secrets.token_urlsafe(48),
        "YELLOW_TOKEN_SECRET": secrets.token_urlsafe(64),
    }


def _compose(env_file: Path) -> list[str]:
    return _docker(["compose", "--project-name", PROJECT, "-f", str(ORDER_DIR / "compose.yml"),
                    "--env-file", str(env_file)])


def _verify_fresh_pg_ownership(cid: str, nonce: str, deadline: float) -> str:
    template = (
        "{{.Id}}|{{.Image}}|{{.Name}}|{{.State.Running}}|{{.Config.Image}}|"
        '{{index .Config.Labels "yellow.recovery.job"}}|'
        '{{index .Config.Labels "yellow.recovery.source"}}|'
        '{{index .Config.Labels "yellow.recovery.nonce"}}|{{json .Mounts}}|'
        "{{json .NetworkSettings.Networks}}|{{json .HostConfig.PortBindings}}"
    )
    values = _format(_docker_one(template, cid, deadline), 11)
    if (len(cid) != 64 or values[0] != cid or values[1] != PG_IMAGE_ID or values[2] != "/" + PG_NAME
            or values[3].lower() != "true" or values[4] != PG_IMAGE_ID
            or values[5] != JOB or values[6] != SOURCE or values[7] != nonce):
        raise GuardError("fresh PostgreSQL container ownership mismatch")
    mounts = json.loads(values[8])
    if not any(m.get("Type") == "volume" and m.get("Name") == VOLUME_NAME
               and m.get("Destination") == "/var/lib/postgresql" and m.get("RW") is True for m in mounts):
        raise GuardError("fresh PostgreSQL volume attachment mismatch")
    networks = json.loads(values[9])
    if set(networks) != {NETWORK_NAME}:
        raise GuardError("fresh PostgreSQL network attachment mismatch")
    ports = json.loads(values[10])
    if ports not in (None, {}):
        raise GuardError("fresh PostgreSQL host port publication refused")
    network_ids = _list_named("network", NETWORK_NAME, deadline)
    if len(network_ids) != 1 or len(network_ids[0]) != 64:
        raise GuardError("fresh recovery network ID unavailable")
    network_fields = _docker_one(
        "{{.Id}}|{{.Name}}|{{.Internal}}|{{index .Labels \"yellow.recovery.job\"}}|"
        '{{index .Labels "yellow.recovery.source"}}|{{index .Labels "yellow.recovery.nonce"}}',
        network_ids[0], deadline)
    net = _format(network_fields, 6)
    if (net[0] != network_ids[0] or net[1] != NETWORK_NAME or net[2].lower() != "true"
            or net[3] != JOB or net[4] != SOURCE or net[5] != nonce
            or networks[NETWORK_NAME].get("NetworkID") != net[0]):
        raise GuardError("fresh recovery network ownership mismatch")
    volume_fields = _docker_one(VOLUME_FORMAT, VOLUME_NAME, deadline)
    volume = _format(volume_fields, 5)
    if not owned_volume(tuple(volume), nonce):
        raise GuardError("fresh PostgreSQL volume ownership mismatch")
    return net[0]


def _query_ready_pg(deadline: float, expected_database: str) -> None:
    command = _docker(["exec", PG_CONTAINER, "psql", "-X", "-qAt", "--no-password", "-h",
                       "/var/run/postgresql", "-U", "yellow_deploy", "-d", expected_database,
                       "-v", "ON_ERROR_STOP=1", "--command",
                       "SELECT current_user || ':' || current_database() || ':' || "
                       "(SELECT oid::text FROM pg_authid WHERE rolname=current_user) || ':' || "
                       "current_setting('server_version');"])
    result = _run_text(command, deadline=deadline)
    if not result.startswith("yellow_deploy:" + expected_database + ":10:18."):
        raise GuardError("fresh yellow_deploy server identity failed")


def _roles_definition_sql(payload: bytes, role_metadata: dict) -> bytes:
    validate_deploy_role_identity(role_metadata)
    try:
        text = payload.decode("utf-8", "strict")
    except UnicodeDecodeError as error:
        raise GuardError("roles dump encoding invalid") from error
    definitions = []
    removed_create = 0
    for line in text.splitlines(keepends=True):
        if line in ("CREATE ROLE yellow_deploy;\n", "CREATE ROLE yellow_deploy;"):
            removed_create += 1
            continue
        if re.match(r"(?i)^\s*CREATE\s+ROLE\s+\"?yellow_deploy\"?\b", line):
            raise GuardError("yellow_deploy role definition is not the exact init collision")
        definitions.append(line)
    if removed_create != 1:
        raise GuardError("roles dump did not contain exactly one yellow_deploy create")
    if not definitions:
        raise GuardError("roles dump has no role definitions")
    return "".join(definitions).encode("utf-8")


def _quote_identifier(value: object) -> str:
    if not isinstance(value, str) or not value or "\x00" in value \
            or any(ord(ch) < 32 or ord(ch) == 127 for ch in value):
        raise GuardError("membership role identifier invalid")
    return '"' + value.replace('"', '""') + '"'


def build_membership_restore_sql(role_metadata: dict) -> bytes:
    roles = role_metadata.get("roles") if isinstance(role_metadata, dict) else None
    memberships = role_metadata.get("memberships") if isinstance(role_metadata, dict) else None
    if not isinstance(roles, list) or not isinstance(memberships, list):
        raise GuardError("source membership metadata missing")
    role_names = {role.get("name") for role in roles if isinstance(role, dict)}
    if len(role_names) != len(roles) or not role_names:
        raise GuardError("source role catalogue malformed")
    if "yellow_recovery_bootstrap" in role_names or len(memberships) > 512:
        raise GuardError("source membership scope invalid")
    validate_deploy_role_identity(role_metadata)
    role_by_name = {role["name"]: role for role in roles}
    rows = []
    seen = set()
    for row in memberships:
        if not isinstance(row, dict):
            raise GuardError("source membership row malformed")
        role = row.get("role")
        member = row.get("member")
        grantor = row.get("grantor")
        admin = row.get("admin")
        inherit = row.get("inherit")
        set_option = row.get("set")
        if (role not in role_names or member not in role_names or grantor not in role_names or role == member
                or type(admin) is not bool or type(inherit) is not bool or type(set_option) is not bool):
            raise GuardError("source membership fields invalid")
        if role_by_name[grantor].get("superuser") is not True:
            raise GuardError("membership grantor is not an independently restored superuser")
        key = (role, member, grantor)
        if key in seen:
            raise GuardError("duplicate source membership tuple")
        seen.add(key)
        rows.append((role, member, grantor, admin, inherit, set_option))
    if set(rows) != EXPECTED_SOURCE_MEMBERSHIPS or len(rows) != len(EXPECTED_SOURCE_MEMBERSHIPS):
        raise GuardError("source membership set differs from the reviewed four tuples")
    output = []
    for role, member, grantor, admin, inherit, set_option in sorted(rows):
        options = []
        if admin:
            options.append("ADMIN OPTION")
        options.append("INHERIT " + ("OPTION" if inherit else "FALSE"))
        options.append("SET " + ("OPTION" if set_option else "FALSE"))
        # The separate connection is authenticated as this validated original grantor.
        if grantor != "yellow_deploy":
            raise GuardError("source membership grantor differs from reviewed original role")
        output.append("GRANT " + _quote_identifier(role) + " TO " + _quote_identifier(member)
                      + " WITH " + ", ".join(options) + ";\n")
    payload = "".join(output).encode("utf-8")
    if len(payload) > 512 * 1024:
        raise GuardError("source membership restore payload too large")
    return payload


def _run_roles_restore(deadline: float, role_metadata: dict) -> None:
    command = _docker(["exec", "-i", PG_CONTAINER, "psql", "-X", "-q", "--no-password", "-h",
                       "/var/run/postgresql", "-U", "yellow_deploy", "-d", "postgres",
                       "-v", "ON_ERROR_STOP=1"])
    build_membership_restore_sql(role_metadata)
    definitions = _roles_definition_sql(GLOBALS_FILE.read_bytes(), role_metadata)
    _run(command, deadline=deadline, cap=90, input_bytes=definitions)


def _restore_database(deadline: float) -> None:
    command = _docker(["exec", "-i", PG_CONTAINER, "pg_restore", "--create", "--exit-on-error",
                       "--no-password", "-h", "/var/run/postgresql", "-U", "yellow_deploy", "-d", "postgres"])
    with DUMP_FILE.open("rb") as archive:
        _run(command, deadline=deadline, cap=240, input_file=archive)


def _set_fresh_role_passwords(env: dict[str, str], deadline: float) -> None:
    # urlsafe secrets contain only SQL-literal-safe alphanumeric, underscore and hyphen bytes.
    runtime = env["YELLOW_RUNTIME_DATABASE_PASSWORD"]
    registrar = env["YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD"]
    sql = ("ALTER ROLE yellow_runtime PASSWORD '" + runtime + "';\n"
           "ALTER ROLE yellow_extension_registrar PASSWORD '" + registrar + "';\n")
    command = _docker(["exec", "-i", PG_CONTAINER, "psql", "-X", "-q", "--no-password", "-h",
                       "/var/run/postgresql", "-U", "yellow_deploy", "-d", "postgres",
                       "-v", "ON_ERROR_STOP=1"])
    _run(command, deadline=deadline, cap=30, input_bytes=sql.encode())
    del runtime, registrar, sql


HTTP_PROOF_JS = r'''(async () => {
  const base = "http://127.0.0.1:3000";
  const read = async (path) => {
    const response = await fetch(new URL(path, base), {
      headers: {"Cache-Control": "no-store"}, signal: AbortSignal.timeout(2500)
    });
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > 2 * 1024 * 1024) throw new Error("bounded");
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("bounded");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return {response, bytes, text: new TextDecoder().decode(bytes)};
  };
  const hash = async (bytes) => {
    const result = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(result), b => b.toString(16).padStart(2, "0")).join("");
  };
  try {
    const health = await read("/health");
    const healthBody = JSON.parse(health.text);
    if (health.response.status !== 200 || healthBody.status !== "ok") throw new Error("health");
    const ready = await read("/ready");
    const readyBody = JSON.parse(ready.text);
    const build = readyBody.build || {};
    if (ready.response.status !== 200 || readyBody.status !== "ready"
        || readyBody.target !== "yellow_runtime_database"
        || build.revision !== "9ff27ad8765dc75ebae9e083d4635c7a9b89fa62"
        || build.expectedMigrationFrontier !== 100) throw new Error("ready");
    const anonymous = await read("/api/v1/me/properties");
    if (anonymous.response.status !== 401) throw new Error("anonymous");
    const paths = ["/.git/config", "/.env", "/.codex/config.toml", "/src/server.ts", "/src/server.ts.map"];
    const privatePaths = {};
    for (const path of paths) {
      const item = await read(path);
      if (item.response.status !== 404) throw new Error("private-path");
      privatePaths[path] = item.response.status;
    }
    const ui = await read("/");
    if (ui.response.status !== 200 || !ui.text.toLowerCase().includes("<html")) throw new Error("ui");
    const match = ui.text.match(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/i);
    if (!match) throw new Error("asset-reference");
    const assetUrl = new URL(match[1], base);
    if (assetUrl.origin !== base || assetUrl.username || assetUrl.password || assetUrl.protocol !== "http:")
      throw new Error("external-asset");
    if (assetUrl.search || assetUrl.hash) throw new Error("asset-query");
    const assetPath = assetUrl.pathname + assetUrl.search;
    if (assetPath.startsWith("//") || assetUrl.pathname.split("/").includes("..")) throw new Error("asset-path");
    const asset = await read(assetPath);
    if (asset.response.status !== 200 || asset.bytes.byteLength === 0) throw new Error("asset");
    console.log(JSON.stringify({
      health: {status: health.response.status, body: {status: healthBody.status}},
      ready: {status: ready.response.status, target: readyBody.target,
        revision: build.revision, expectedMigrationFrontier: build.expectedMigrationFrontier},
      anonymous_properties: {status: anonymous.response.status}, private_paths: privatePaths,
      ui: {status: ui.response.status, content_type: ui.response.headers.get("content-type"),
        sha256: await hash(ui.bytes), bytes: ui.bytes.byteLength},
      asset: {path: assetPath, status: asset.response.status,
        content_type: asset.response.headers.get("content-type"), sha256: await hash(asset.bytes),
        bytes: asset.bytes.byteLength}
    }));
  } catch (_) {
    console.log(JSON.stringify({proof_error: "private_http_proof_failed"}));
    process.exitCode = 2;
  }
})();'''


def validate_http_proof(proof: object) -> dict:
    if not isinstance(proof, dict) or set(proof) != {
        "health", "ready", "anonymous_properties", "private_paths", "ui", "asset"
    }:
        raise GuardError("container-local HTTP proof shape invalid")
    if proof["health"] != {"status": 200, "body": {"status": "ok"}}:
        raise GuardError("container-local health contract failed")
    if proof["ready"] != {"status": 200, "target": "yellow_runtime_database", "revision": SOURCE,
                          "expectedMigrationFrontier": FRONTIER}:
        raise GuardError("container-local ready contract failed")
    if proof["anonymous_properties"] != {"status": 401}:
        raise GuardError("container-local anonymous API proof failed")
    paths = ("/.git/config", "/.env", "/.codex/config.toml", "/src/server.ts", "/src/server.ts.map")
    if proof["private_paths"] != {path: 404 for path in paths}:
        raise GuardError("container-local private paths proof failed")
    for key in ("ui", "asset"):
        item = proof[key]
        if not isinstance(item, dict) or item.get("status") != 200 or type(item.get("bytes")) is not int \
                or item["bytes"] <= 0 or item["bytes"] > 2 * 1024 * 1024 \
                or not isinstance(item.get("sha256"), str) \
                or not re.fullmatch(r"[0-9a-f]{64}", item["sha256"]):
            raise GuardError("container-local UI/asset evidence invalid")
        if item.get("content_type") is not None and not isinstance(item["content_type"], str):
            raise GuardError("container-local response header invalid")
    asset_path = validate_asset_path(proof["asset"].get("path", ""))
    if urllib.parse.urlsplit(asset_path).query or urllib.parse.urlsplit(asset_path).fragment:
        raise GuardError("container-local asset URL parameters refused")
    proof["asset"]["path"] = asset_path
    if any("body" in proof[key] for key in ("ui", "asset")):
        raise GuardError("raw HTTP body refused in proof")
    return proof


def _http_proof(app_id: str, deadline: float) -> dict:
    command = _docker(["exec", app_id, "bun", "-e", HTTP_PROOF_JS])
    payload = _run_text(command, deadline=deadline, cap=30, log=True)
    return validate_http_proof(json.loads(payload))


def _inspect_owned_container(cid: str, deadline: float) -> tuple[str, str, str, str, str, str] | None:
    try:
        fields = _docker_one(OWNED_CONTAINER_FORMAT, cid, deadline)
        return tuple(_format(fields, 6))  # type: ignore[return-value]
    except BaseException:
        return None


def _verify_fresh_app_ownership(cid: str, nonce: str, network_id: str, deadline: float) -> bool:
    template = (
        "{{.Id}}|{{.Image}}|{{.Name}}|{{.State.Running}}|{{.Config.Image}}|"
        '{{index .Config.Labels "yellow.recovery.job"}}|'
        '{{index .Config.Labels "yellow.recovery.source"}}|'
        '{{index .Config.Labels "yellow.recovery.nonce"}}|{{json .NetworkSettings.Networks}}|'
        "{{json .HostConfig.PortBindings}}"
    )
    values = _format(_docker_one(template, cid, deadline), 10)
    networks = json.loads(values[8])
    ports = json.loads(values[9])
    return (len(cid) == 64 and values[0] == cid and values[1] == APP_IMAGE_ID
            and values[2] == "/" + APP_NAME and values[3].lower() == "true"
            and values[4] == APP_IMAGE_ID and values[5] == JOB and values[6] == SOURCE
            and values[7] == nonce and set(networks) == {NETWORK_NAME}
            and networks[NETWORK_NAME].get("NetworkID") == network_id and ports in (None, {}))


def _cleanup(nonce: str, created_ids: dict[str, str], deadline: float) -> None:
    candidates = {
        "app": (APP_NAME, APP_IMAGE_ID),
        "pg": (PG_NAME, PG_IMAGE_ID),
    }
    for key, (name, image) in candidates.items():
        cid = created_ids.get(key)
        if not cid:
            ids = _list_named("container", name, deadline)
            cid = ids[0] if len(ids) == 1 else ""
        if cid and len(cid) == 64:
            observed = _inspect_owned_container(cid, deadline)
            expected_name = "/" + name
            if owned_cleanup(observed, expected_id=cid, expected_image=image,
                             expected_name=expected_name, nonce=nonce):
                _run_text(_docker(["rm", "-f", cid]), deadline=deadline)
    networks = _list_named("network", NETWORK_NAME, deadline)
    if len(networks) == 1:
        net_id = networks[0]
        try:
            fields = _docker_one(NETWORK_FORMAT, net_id, deadline)
            identity = tuple(_format(fields, 5))
        except BaseException:
            identity = None
        if owned_network(identity, nonce):
            _run_text(_docker(["network", "rm", net_id]), deadline=deadline)
    volumes = _list_named("volume", VOLUME_NAME, deadline)
    if len(volumes) == 1:
        name = volumes[0]
        try:
            fields = _docker_one(VOLUME_FORMAT, name, deadline)
            identity = tuple(_format(fields, 5))
        except BaseException:
            identity = None
        if owned_volume(identity, nonce):
            _run_text(_docker(["volume", "rm", name]), deadline=deadline)


def _copy_global_roles(deadline: float) -> None:
    command = _source_pg_command("pg_dumpall", "--roles-only", "--no-role-passwords", "--no-password",
                                 "-h", "/var/run/postgresql", "-U", "yellow_deploy")
    payload = _run(command, deadline=deadline, cap=90)
    _write_private(GLOBALS_FILE, payload)


def _make_custom_dump(deadline: float) -> None:
    command = _source_pg_command("pg_dump", "--no-password", "--create", "--format=custom",
                                 "-h", "/var/run/postgresql", "-U", "yellow_deploy", "-d", "yellow_dev")
    _run(command, deadline=deadline, cap=240, stdout_path=DUMP_FILE)
    if not DUMP_FILE.is_file() or DUMP_FILE.stat().st_size == 0:
        raise GuardError("custom dump missing")


def _image_cache_or_load(deadline: float) -> None:
    # Always import from the verified private archive; Docker may reuse content already cached.
    _run(_docker(["load", "--input", str(ARCHIVE_COPY)]), deadline=deadline, cap=180)
    app = _image_identity(APP_IMAGE_ID, deadline)
    if app[0] != APP_IMAGE_ID or app[1] != "linux" or app[2] != "amd64" or app[3] != "bun" \
            or json.loads(app[4]) != ["bun", "run", "start"] or app[5] != SOURCE:
        raise GuardError("app image identity mismatch")
    pg = _image_identity(PG_IMAGE_ID, deadline)
    if pg[0] != PG_IMAGE_ID or pg[1] != "linux" or pg[2] != "amd64":
        raise GuardError("PostgreSQL image identity mismatch")


def _create_private_env(nonce: str) -> dict[str, str]:
    values = _private_env(nonce)
    contents = "".join(key + "=" + value + "\n" for key, value in values.items())
    _write_private(ENV_FILE, contents.encode())
    return values


def _database_before_after_match(before: dict, after: dict) -> bool:
    return before == after


def _canonical_sha256(value: object) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"),
                         ensure_ascii=False, allow_nan=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _flatten_fingerprint(value: object, path: str, output: dict[str, str]) -> None:
    if isinstance(value, dict):
        for key in sorted(value):
            _flatten_fingerprint(value[key], path + "." + str(key), output)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _flatten_fingerprint(item, path + "[" + str(index) + "]", output)
    else:
        output[path] = _canonical_sha256(value)


def comparison_fingerprint(snapshot: dict) -> dict[str, dict[str, str]]:
    """Return component leaf hashes only; never persist database metadata values."""
    identity = snapshot.get("identity")
    if not isinstance(identity, dict):
        raise GuardError("comparison identity metadata malformed")
    globals_db = snapshot.get("roles_memberships_database_acl")
    if not isinstance(globals_db, dict):
        raise GuardError("comparison global metadata malformed")
    selected_identity = {key: identity.get(key) for key in
                         ("database", "version", "frontier", "table_count")}
    components = {
        "identity": selected_identity,
        "tables": snapshot.get("tables"),
        "ledger": snapshot.get("ledger"),
        "table_digests": snapshot.get("table_digests"),
        "schema": snapshot.get("schema_sha256"),
        "sequences": snapshot.get("public_sequences"),
        "global_roles": globals_db.get("roles"),
        "global_memberships": globals_db.get("memberships"),
        "global_settings": globals_db.get("settings"),
        "database_acl_and_identity": globals_db.get("database"),
    }
    result: dict[str, dict[str, str]] = {}
    for component, value in components.items():
        leaves: dict[str, str] = {}
        _flatten_fingerprint(value, component, leaves)
        result[component] = leaves
    return result


def build_restore_comparison(source: dict, restored: dict) -> tuple[dict, dict]:
    source_hashes = comparison_fingerprint(source)
    restored_hashes = comparison_fingerprint(restored)
    source_globals = source["roles_memberships_database_acl"]
    restored_globals = restored["roles_memberships_database_acl"]
    comparisons = {
        "identity_equal": source_hashes["identity"] == restored_hashes["identity"],
        "tables_equal": source_hashes["tables"] == restored_hashes["tables"],
        "ledger_equal": source_hashes["ledger"] == restored_hashes["ledger"],
        "table_digests_equal": source_hashes["table_digests"] == restored_hashes["table_digests"],
        "schema_equal": source_hashes["schema"] == restored_hashes["schema"],
        "sequences_equal": source_hashes["sequences"] == restored_hashes["sequences"],
        "global_roles_equal": source_hashes["global_roles"] == restored_hashes["global_roles"],
        "global_memberships_equal": source_hashes["global_memberships"] == restored_hashes["global_memberships"],
        "global_settings_equal": source_hashes["global_settings"] == restored_hashes["global_settings"],
        "database_acl_and_identity_equal":
            source_hashes["database_acl_and_identity"] == restored_hashes["database_acl_and_identity"],
        "global_metadata_equal": role_metadata_matches(source_globals, restored_globals),
    }
    differing = []
    for component in sorted(source_hashes):
        left = source_hashes[component]
        right = restored_hashes[component]
        for path in sorted(set(left) | set(right)):
            if left.get(path) != right.get(path):
                differing.append({"path": path, "source_sha256": left.get(path),
                                  "restored_sha256": right.get(path)})
    summary = {"schema": "yellow-synthetic-restore-comparison/v5",
               "comparisons": comparisons, "differing_paths_and_hashes": differing}
    fingerprint = {"schema": "yellow-synthetic-restore-fingerprint/v5",
                   "source_sha256_by_component_and_path": source_hashes,
                   "restored_sha256_by_component_and_path": restored_hashes}
    return fingerprint, summary


def safe_failure_receipt(error: BaseException, stage: str, source_after_diagnostic: str,
                         *, restored_fingerprint_saved: bool,
                         comparison_summary_saved: bool,
                         schema_diff_saved: bool) -> dict:
    reason = str(error) if isinstance(error, GuardError) else None
    if reason is not None and not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9 _./:-]{0,159}", reason):
        reason = "guard error"
    return {
        "schema": "yellow-synthetic-recovery-failure/v5",
        "stage": stage,
        "error_type": type(error).__name__,
        "guard_reason": reason,
        "source_after_diagnostic": source_after_diagnostic,
        "restored_fingerprint_saved": restored_fingerprint_saved,
        "comparison_summary_saved": comparison_summary_saved,
        "comparison_summary_file": str(COMPARISON_FILE) if comparison_summary_saved else None,
        "schema_proof_saved": schema_diff_saved,
        "schema_proof_file": str(SCHEMA_PROOF_FILE) if schema_diff_saved else None,
        "private_schema_dumps_saved": SOURCE_SCHEMA_DUMP_FILE.is_file() and RESTORED_SCHEMA_DUMP_FILE.is_file(),
        "raw_business_rows_or_settings_or_credentials_included": False,
    }


def _main() -> int:
    overall_deadline = time.monotonic() + TOTAL_SECONDS
    work_deadline = overall_deadline - CLEANUP_RESERVE_SECONDS
    stage = "admission"
    nonce = ""
    resources_attempted = False
    source_before = None
    source_after = None
    created_ids: dict[str, str] = {}
    env_values: dict[str, str] = {}
    private_env_created = False
    signal.signal(signal.SIGTERM, lambda _s, _f: (_ for _ in ()).throw(InterruptedError()))
    try:
        admission = _collect_admission(work_deadline)
        validate_admission(admission)
        nonce = secrets.token_hex(20)
        stage = "private-checkpoint"
        copied_inputs = _private_copy_inputs()
        if (copied_inputs.get("archive_sha256") != ARCHIVE_SHA256
                or copied_inputs.get("oci_manifest_sha256") != OCI_MANIFEST_SHA256
                or copied_inputs.get("oci_config_sha256") != OCI_CONFIG_SHA256
                or copied_inputs.get("oci_layer_count") != 11):
            raise GuardError("private image checkpoint hash mismatch")
        stage = "source-before"
        source_before = snapshot_database("yellow_dev", work_deadline)
        build_membership_restore_sql(source_before["roles_memberships_database_acl"])
        _write_private(BEFORE_FILE, json.dumps(source_before, indent=2).encode() + b"\n")
        stage = "source-backup"
        _copy_global_roles(work_deadline)
        _make_custom_dump(work_deadline)
        archive_hash = sha256_file(DUMP_FILE)
        globals_hash = sha256_file(GLOBALS_FILE)
        stage = "image-cache"
        _image_cache_or_load(work_deadline)
        stage = "fresh-credentials"
        env_values = _create_private_env(nonce)
        private_env_created = True
        compose = _compose(ENV_FILE)
        stage = "fresh-postgres"
        resources_attempted = True
        _run(compose + ["up", "-d", "--wait", "--wait-timeout", "25", "--no-build", "--pull", "never", "postgres"],
             deadline=work_deadline, cap=30)
        pg_ids = _list_named("container", PG_NAME, work_deadline)
        if len(pg_ids) != 1 or len(pg_ids[0]) != 64:
            raise GuardError("fresh PostgreSQL container ID unavailable")
        created_ids["pg"] = pg_ids[0]
        network_id = _verify_fresh_pg_ownership(created_ids["pg"], nonce, work_deadline)
        _query_ready_pg(work_deadline, "postgres")
        stage = "restore-roles"
        _run_roles_restore(work_deadline, source_before["roles_memberships_database_acl"])
        _query_ready_pg(work_deadline, "postgres")
        stage = "restore-database"
        _restore_database(work_deadline)
        _query_ready_pg(work_deadline, "yellow_dev")
        stage = "set-disposable-runtime-passwords"
        _set_fresh_role_passwords(env_values, work_deadline)
        stage = "restore-comparison"
        restored = snapshot_database("yellow_dev", work_deadline, fresh=True)
        source_schema_dump = _schema_dump("yellow_dev", work_deadline)
        restored_schema_dump = _schema_dump("yellow_dev", work_deadline, fresh=True)
        _write_private(SOURCE_SCHEMA_DUMP_FILE, source_schema_dump)
        _write_private(RESTORED_SCHEMA_DUMP_FILE, restored_schema_dump)
        schema_diff = schema_proof(source_schema_dump, restored_schema_dump)
        _write_private(SCHEMA_PROOF_FILE, json.dumps(schema_diff, indent=2).encode() + b"\n")
        fingerprint, comparison = build_restore_comparison(source_before, restored)
        comparison["schema_byte_equal_after_dump_control_normalization"] = \
            schema_diff["byte_equal_after_dump_control_normalization"]
        comparison["schema_full_ast_equal_after_scanner_coordinates_removed"] = \
            schema_diff["full_ast_equal_after_scanner_coordinates_removed"]
        comparison["schema_strict_equivalence_passed"] = schema_diff["strict_full_schema_equivalence_passed"]
        _write_private(RESTORED_FINGERPRINT_FILE, json.dumps(fingerprint, indent=2).encode() + b"\n")
        _write_private(COMPARISON_FILE, json.dumps(comparison, indent=2).encode() + b"\n")
        if not schema_diff["strict_full_schema_equivalence_passed"]:
            raise GuardError(schema_diff["guard_reason"] or "strict full-schema equivalence failed")
        source_identity = source_before["identity"]
        restored_identity = restored["identity"]
        if any(source_identity[key] != restored_identity[key]
               for key in ("database", "version", "frontier", "table_count")):
            raise GuardError("restored database identity/frontier differs")
        roles_db = restored["roles_memberships_database_acl"]
        expected_roles = source_before["roles_memberships_database_acl"]
        if not role_metadata_matches(expected_roles, roles_db):
            raise GuardError("restored global role/membership/database ACL differs")
        schema_byte_equal = restored["schema_sha256"] == source_before["schema_sha256"]
        if restored["tables"] != source_before["tables"] or restored["ledger"] != source_before["ledger"] \
                or restored["table_digests"] != source_before["table_digests"] \
                or (not schema_byte_equal and not schema_diff["strict_full_schema_equivalence_passed"]) \
                or restored["public_sequences"] != source_before["public_sequences"]:
            raise GuardError("restored schema/table/migration fingerprint differs")
        # The initialized yellow_deploy identity is the original source OID 10; no extra role is allowed.
        stage = "fresh-app"
        _run(compose + ["up", "-d", "--wait", "--wait-timeout", "25", "--no-build", "--pull", "never", "app"],
             deadline=work_deadline, cap=30)
        app_ids = _list_named("container", APP_NAME, work_deadline)
        if len(app_ids) != 1 or len(app_ids[0]) != 64:
            raise GuardError("fresh app container ID unavailable")
        created_ids["app"] = app_ids[0]
        app_identity = _inspect_owned_container(created_ids["app"], work_deadline)
        if not owned_cleanup(app_identity, expected_id=created_ids["app"], expected_image=APP_IMAGE_ID,
                             expected_name="/" + APP_NAME, nonce=nonce) \
                or not _verify_fresh_app_ownership(created_ids["app"], nonce, network_id, work_deadline):
            raise GuardError("fresh app ownership mismatch")
        stage = "http-proof"
        http_proof = _http_proof(created_ids["app"], work_deadline)
        stage = "source-after"
        source_after = snapshot_database("yellow_dev", work_deadline)
        _write_private(AFTER_FILE, json.dumps(source_after, indent=2).encode() + b"\n")
        if not _database_before_after_match(source_before, source_after):
            raise GuardError("source changed during recovery; preservation inconclusive")
        retained_after = _retained_service_metadata(work_deadline)
        if retained_after != admission.retained_service_metadata:
            raise GuardError("retained source/origin service metadata changed")
        stage = "receipt"
        pg_id = created_ids["pg"]
        app_id = created_ids["app"]
        receipt = {
            "schema": "yellow-synthetic-recovery-proof/v5",
            "executed": True,
            "job": JOB,
            "source_revision": SOURCE,
            "source_frontier": FRONTIER,
            "source_database_before_after_equal": True,
            "retained_source_and_prior_origin_metadata_unchanged": True,
            "source_table_count": len(source_before["tables"]),
            "source_migration_count": len(source_before["ledger"]),
            "source_schema_sha256": source_before["schema_sha256"],
            "source_table_and_ledger_fingerprints_equal": True,
            "source_public_sequences": source_before["public_sequences"],
            "passwordless_role_globals_sha256": globals_hash,
            "custom_created_dump_sha256": archive_hash,
            "copied_docker_archive_sha256": copied_inputs["archive_sha256"],
            "copied_oci_manifest_sha256": copied_inputs["oci_manifest_sha256"],
            "copied_oci_config_sha256": copied_inputs["oci_config_sha256"],
            "verified_oci_layer_count": copied_inputs["oci_layer_count"],
            "verified_oci_content_layers": copied_inputs["oci_content_proof"]["layers"],
            "oci_config_interpreted": False,
            "image_cache_miss_or_cold_load_proven": False,
            "verified_archive_loaded_even_if_cached": True,
            "restored_schema_tables_ledger_roles_memberships_database_acl_and_sequences_equal": True,
            "schema_byte_equal_after_dump_control_normalization": schema_diff[
                "byte_equal_after_dump_control_normalization"],
            "schema_full_ast_equal_after_scanner_coordinates_removed": schema_diff[
                "full_ast_equal_after_scanner_coordinates_removed"],
            "strict_full_schema_equivalence_passed": schema_diff["strict_full_schema_equivalence_passed"],
            "role_definitions_restored_as": "yellow_deploy",
            "source_memberships_restored_as": "yellow_deploy",
            "custom_database_dump_restored_as": "yellow_deploy",
            "schema_proof": schema_diff,
            "fresh_init_role": "yellow_deploy",
            "fresh_init_role_oid": 10,
            "restored_database_identity_matches_source": True,
            "disposable_runtime_passwords_set_for": ["yellow_runtime", "yellow_extension_registrar"],
            "password_hashes_compared_or_exported": False,
            "source_database_written": False,
            "migrations_or_seed_run": False,
            "pg_container_id": pg_id,
            "app_container_id": app_id,
            "network_id": network_id,
            "volume_name": VOLUME_NAME,
            "nonce": nonce,
            "origin_scope": "container-local only",
            "host_origin_proven": False,
            "runtime": {"source_revision": SOURCE, "app_image_id": APP_IMAGE_ID,
                        "postgres_image_id": PG_IMAGE_ID, "app_name": APP_NAME,
                        "postgres_name": PG_NAME, "host_bind": None,
                        "postgres_host_port": None, "network_internal": True,
                        "restart": "no", "memory_limit_bytes_per_container": 1073741824,
                        "cpu_limit_per_container": 1, "user": "bun"},
            "http_proof": http_proof,
            "stop_commands": [
                "docker --host " + DOCKER_SOCKET + " stop " + app_id,
                "docker --host " + DOCKER_SOCKET + " stop " + pg_id,
            ],
            "owned_cleanup_commands_after_stop": [
                "docker --host " + DOCKER_SOCKET + " rm " + app_id,
                "docker --host " + DOCKER_SOCKET + " rm " + pg_id,
                "docker --host " + DOCKER_SOCKET + " network rm " + network_id,
                "docker --host " + DOCKER_SOCKET + " volume rm " + VOLUME_NAME,
            ],
            "private_env_file": str(ENV_FILE),
            "private_env_file_is_off_vm_backup": False,
            "public_route_or_login_proven": False,
            "latest_laptop_source_or_103_integrated": False,
        }
        _write_private(RECEIPT_FILE, json.dumps(receipt, indent=2).encode() + b"\n")
        print(json.dumps({"passed": True, "private_receipt": str(RECEIPT_FILE),
                          "app_container_id": app_id, "source_frontier": FRONTIER,
                          "preserved_table_count": len(source_before["tables"]),
                          "origin_scope": "container-local only", "host_origin_proven": False}))
        return 0
    except BaseException as error:
        failed_stage = stage
        source_after_diagnostic = "skipped"
        if source_before is not None and source_after is None and time.monotonic() < work_deadline - 90:
            source_after_diagnostic = "failed"
            try:
                source_after = snapshot_database("yellow_dev", work_deadline)
                _write_private(AFTER_FILE, json.dumps(source_after, indent=2).encode() + b"\n")
                source_after_diagnostic = "completed"
            except BaseException:
                pass
        if resources_attempted and nonce:
            try:
                _cleanup(nonce, created_ids, overall_deadline)
            except BaseException:
                pass
        if private_env_created:
            try:
                ENV_FILE.unlink()
            except OSError:
                pass
        if PRIVATE_DIR.exists():
            try:
                failure_receipt = safe_failure_receipt(
                    error, failed_stage, source_after_diagnostic,
                    restored_fingerprint_saved=RESTORED_FINGERPRINT_FILE.is_file(),
                    comparison_summary_saved=COMPARISON_FILE.is_file(),
                    schema_diff_saved=SCHEMA_PROOF_FILE.is_file())
                _write_private(FAILURE_RECEIPT_FILE, json.dumps(failure_receipt, indent=2).encode() + b"\n")
            except BaseException:
                pass
        if PRIVATE_DIR.exists():
            try:
                failure = PRIVATE_DIR / "failure.log"
                fd = os.open(failure, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
                with os.fdopen(fd, "ab") as stream:
                    stream.write(("stage=" + failed_stage + " type=" + type(error).__name__
                                  + " source_after_diagnostic=" + source_after_diagnostic + "\n").encode()[:512])
            except OSError:
                pass
        print("ERROR stage=" + failed_stage + " type=" + type(error).__name__, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(_main())
