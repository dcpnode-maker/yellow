#!/usr/bin/env python3
"""Install and run a pinned, local-only OmniRoute gateway for continuity work.

This tool has no provider-login, provider-key, plugin, tunnel, MITM, or model
request capability.  It only verifies the reviewed npm archive, installs it with
lifecycle scripts disabled, and can run a local health/authentication smoke test.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request


VERSION = "3.8.50"
ARCHIVE_NAME = f"omniroute-{VERSION}.tgz"
ARCHIVE_BYTES = 121_369_534
INTEGRITY = "sha512-qK6REDWQYGh8lwGwDgFMsBqAMXnxIePudr8cSuSYeB9iIlywNhDJxHKt6Cwa31lPci8jXE5bbvl+az0lvyt0Mg=="
DEFAULT_PORT = 20129


class Blocked(Exception):
    """Raised for a refused unsafe or non-reproducible operation."""


def lexists(path: Path) -> bool:
    return os.path.lexists(path)


def is_link_or_reparse(path: Path) -> bool:
    """Identify POSIX links and Windows reparse points without resolving either."""
    try:
        info = path.lstat()
    except OSError:
        return False
    reparse = getattr(info, "st_file_attributes", 0) & 0x400
    return stat.S_ISLNK(info.st_mode) or bool(reparse)


def safe_private_path(state: Path, path: Path, label: str, *, required: bool = False,
                      directory: bool = False) -> Path:
    """Reject links/reparse points on every existing component below private state."""
    state = state.resolve()
    path = path.absolute()
    try:
        path.relative_to(state)
    except ValueError as exc:
        raise Blocked(f"{label} escapes private OmniRoute state") from exc
    current = path
    while True:
        if lexists(current) and is_link_or_reparse(current):
            raise Blocked(f"Refusing symlink or reparse point for {label}")
        if current == state:
            break
        current = current.parent
    if required and not path.exists():
        raise Blocked(f"Required {label} is missing")
    if required and directory and not path.is_dir():
        raise Blocked(f"Required {label} is not a directory")
    if required and not directory and not path.is_file():
        raise Blocked(f"Required {label} is not a regular file")
    return path


def git_root() -> Path:
    try:
        root = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"], text=True, stderr=subprocess.DEVNULL
        ).strip()
    except subprocess.CalledProcessError as exc:
        raise Blocked("Run from the Yellow repository or one of its subdirectories") from exc
    return Path(root).resolve()


def git_dir(root: Path) -> Path:
    value = subprocess.check_output(
        ["git", "-C", str(root), "rev-parse", "--absolute-git-dir"], text=True
    ).strip()
    path = Path(value)
    if path.is_symlink() or not path.is_dir():
        raise Blocked("Git metadata directory is unavailable or unsafe")
    return path.resolve()


def private_root(root: Path) -> Path:
    path = git_dir(root) / "yellow-omniroute"
    if lexists(path):
        if is_link_or_reparse(path) or not path.is_dir():
            raise Blocked("Refusing an existing non-directory or symlinked OmniRoute state")
    else:
        path.mkdir(mode=0o700)
    os.chmod(path, 0o700)
    return path


def archive_path(root: Path, supplied: str | None) -> Path:
    path = Path(supplied).expanduser().resolve() if supplied else root.parent / ARCHIVE_NAME
    if not path.is_file() or path.is_symlink():
        raise Blocked(f"Reviewed archive not found: {path}")
    return path


def verify_archive(path: Path) -> None:
    if path.stat().st_size != ARCHIVE_BYTES:
        raise Blocked("Archive byte count differs from the reviewed published artifact")
    hasher = hashlib.sha512()
    with path.open("rb") as archive:
        for block in iter(lambda: archive.read(1024 * 1024), b""):
            hasher.update(block)
    digest = base64.b64encode(hasher.digest()).decode("ascii")
    if "sha512-" + digest != INTEGRITY:
        raise Blocked("Archive SHA-512 integrity differs from the pinned npm value")
    try:
        with tarfile.open(path, "r:gz") as package:
            manifest = json.load(package.extractfile("package/package.json"))  # type: ignore[arg-type]
            license_text = package.extractfile("package/LICENSE").read().decode("utf-8")  # type: ignore[union-attr]
    except (tarfile.TarError, KeyError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise Blocked("Archive cannot be read as the reviewed OmniRoute package") from exc
    if manifest.get("name") != "omniroute" or manifest.get("version") != VERSION:
        raise Blocked("Archive package identity does not match omniroute@3.8.50")
    if manifest.get("license") != "MIT" or not license_text.startswith("MIT License\n"):
        raise Blocked("Archive license is not the reviewed MIT license")


def package_dir(state: Path) -> Path:
    return safe_private_path(state, state / "npm" / "node_modules" / "omniroute",
                             "OmniRoute package directory", required=True, directory=True)


def installed_version(state: Path) -> str | None:
    manifest = safe_private_path(state, state / "npm" / "node_modules" / "omniroute" / "package.json",
                                 "OmniRoute manifest")
    if not manifest.exists():
        return None
    if not manifest.is_file():
        raise Blocked("OmniRoute manifest is not a regular file")
    try:
        return json.loads(manifest.read_text(encoding="utf-8")).get("version")
    except (OSError, json.JSONDecodeError):
        return None


def required_esbuild_package(state: Path) -> str:
    system = {"linux": "linux", "darwin": "darwin", "win32": "win32"}.get(sys.platform)
    machine = {"x86_64": "x64", "amd64": "x64", "aarch64": "arm64", "arm64": "arm64"}.get(
        os.uname().machine.lower() if hasattr(os, "uname") else os.environ.get("PROCESSOR_ARCHITECTURE", "").lower()
    )
    try:
        esbuild_manifest = safe_private_path(
            state, state / "npm" / "node_modules" / "esbuild" / "package.json", "esbuild manifest",
            required=True,
        )
        esbuild = json.loads(esbuild_manifest.read_text(encoding="utf-8"))
        version = esbuild["version"]
    except (OSError, KeyError, json.JSONDecodeError) as exc:
        raise Blocked("The installed OmniRoute dependency tree lacks esbuild metadata") from exc
    if not system or not machine or not isinstance(version, str):
        raise Blocked("This host has no reviewed esbuild platform package mapping")
    return f"@esbuild/{system}-{machine}@{version}"


def install_required_esbuild_binary(state: Path, npm: str) -> None:
    package = required_esbuild_package(state)
    package_name = package.rsplit("@", 1)[0]
    platform_dir = safe_private_path(state, state / "npm" / "node_modules" / package_name,
                                     "esbuild platform package")
    if platform_dir.exists() and platform_dir.is_dir():
        return
    # esbuild's platform executable is an optional npm dependency but is required
    # by OmniRoute's bundled tsx launcher. Install only that matching executable.
    subprocess.run(
        [npm, "install", "--prefix", str(state / "npm"), "--ignore-scripts", "--omit=optional",
         "--no-audit", "--no-fund", "--no-save", package],
        check=True,
    )


def secure_write(state: Path, path: Path, text: str) -> None:
    safe_private_path(state, path, "private file")
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    safe_private_path(state, path.parent, "private file parent", required=True, directory=True)
    os.chmod(path.parent, 0o700)
    fd, temporary = tempfile.mkstemp(prefix=".omniroute-", dir=path.parent, text=True)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        safe_private_path(state, path, "private file")
        os.replace(temporary, path)
        os.chmod(path, 0o600)
    finally:
        Path(temporary).unlink(missing_ok=True)


def secret() -> str:
    return secrets.token_urlsafe(48)


def private_env(state: Path, port: int) -> Path:
    if not 1 <= port <= 65535:
        raise Blocked("Port must be in the range 1..65535")
    data = state / "data"
    safe_private_path(state, data, "private data directory")
    if lexists(data) and not data.is_dir():
        raise Blocked("Refusing unsafe private data directory")
    data.mkdir(mode=0o700, exist_ok=True)
    safe_private_path(state, data, "private data directory", required=True, directory=True)
    os.chmod(data, 0o700)
    env_path = data / ".env"
    safe_private_path(state, env_path, "private environment file")
    if env_path.exists():
        if not env_path.is_file():
            raise Blocked("Private OmniRoute environment is not a regular file")
        return env_path
    values = {
        "DATA_DIR": str(data),
        "OMNIROUTE_DATA_DIR": str(data),
        "PORT": str(port),
        "API_PORT": str(port),
        "DASHBOARD_PORT": str(port),
        "OMNIROUTE_SERVER_HOST": "127.0.0.1",
        "LIVE_WS_HOST": "127.0.0.1",
        "OMNIROUTE_ENABLE_LIVE_WS": "0",
        "REQUIRE_API_KEY": "true",
        "OMNIROUTE_DISABLE_BACKGROUND_SERVICES": "true",
        "OMNIROUTE_DISABLE_CREDENTIAL_HEALTH_CHECK": "true",
        "OMNIROUTE_NO_UPDATE_NOTIFIER": "1",
        "DISABLE_MITM": "true",
        "DISABLE_TUNNEL": "true",
        "JWT_SECRET": secret(),
        "API_KEY_SECRET": secrets.token_hex(32),
        "STORAGE_ENCRYPTION_KEY": secrets.token_hex(32),
        "INITIAL_PASSWORD": secret(),
        "OMNIROUTE_API_KEY": "or_" + secret(),
    }
    secure_write(state, env_path, "".join(f"{key}={value}\n" for key, value in values.items()))
    return env_path


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator and key:
            env[key] = value
    return env


def locked_runtime_settings(state: Path, port: int) -> dict[str, str]:
    data = safe_private_path(state, state / "data", "private data directory", required=True, directory=True)
    return {
        "DATA_DIR": str(data),
        "OMNIROUTE_DATA_DIR": str(data),
        "PORT": str(port),
        "API_PORT": str(port),
        "DASHBOARD_PORT": str(port),
        "OMNIROUTE_SERVER_HOST": "127.0.0.1",
        "LIVE_WS_HOST": "127.0.0.1",
        "OMNIROUTE_ENABLE_LIVE_WS": "0",
        "REQUIRE_API_KEY": "true",
        "OMNIROUTE_DISABLE_BACKGROUND_SERVICES": "true",
        "OMNIROUTE_DISABLE_CREDENTIAL_HEALTH_CHECK": "true",
        "OMNIROUTE_NO_UPDATE_NOTIFIER": "1",
        "DISABLE_MITM": "true",
        "DISABLE_TUNNEL": "true",
        "OMNIROUTE_CLI_SKIP_REPO_ENV": "1",
    }


def runtime_env(state: Path, port: int) -> dict[str, str]:
    env = dict(os.environ)
    env_path = private_env(state, port)
    safe_private_path(state, env_path, "private environment file", required=True)
    env.update(load_env(env_path))
    # Provider credentials must not leak from a coordinator shell into this
    # unactivated gateway. Its generated local API key is deliberately retained.
    for key in tuple(env):
        if key not in {"OMNIROUTE_API_KEY", "API_KEY_SECRET"} and (
            key.endswith("_API_KEY") or key.endswith("_ACCESS_TOKEN") or key.endswith("_AUTH_TOKEN")
        ):
            env.pop(key)
    # Apply after private secrets and the caller environment: neither can relax
    # bind, authentication, background, MITM, tunnel, or selected-port policy.
    env.update(locked_runtime_settings(state, port))
    if not env.get("OMNIROUTE_API_KEY") or not env.get("JWT_SECRET") or not env.get("API_KEY_SECRET"):
        raise Blocked("Private OmniRoute secrets are incomplete")
    return env


def install(root: Path, state: Path, archive: Path) -> None:
    verify_archive(archive)
    existing = installed_version(state)
    if existing == VERSION:
        print(f"OmniRoute {VERSION} is already installed in private Git state.")
        return
    if existing is not None:
        raise Blocked("A different OmniRoute version already exists; do not replace private state")
    npm = shutil.which("npm")
    if not npm:
        raise Blocked("Node.js/npm is required for the reviewed archive install")
    prefix = state / "npm"
    safe_private_path(state, prefix, "private npm prefix")
    if prefix.exists():
        raise Blocked("Private npm prefix already exists but lacks the expected pinned install")
    # npm receives a local, verified archive. Lifecycle hooks and broad optional
    # packages are excluded; no upstream provider is contacted here.
    subprocess.run(
        [npm, "install", "--prefix", str(prefix), "--ignore-scripts", "--omit=optional",
         "--no-audit", "--no-fund", "--package-lock=false", str(archive)],
        check=True,
    )
    if installed_version(state) != VERSION:
        raise Blocked("npm completed without installing the pinned OmniRoute version")
    install_required_esbuild_binary(state, npm)
    private_env(state, DEFAULT_PORT)
    print(f"Installed verified OmniRoute {VERSION} in private Git state.")


def command(state: Path) -> list[str]:
    entrypoint = safe_private_path(state, package_dir(state) / "bin" / "omniroute.mjs",
                                   "OmniRoute launcher", required=True)
    node = shutil.which("node")
    if not node:
        raise Blocked("Node.js is required to run OmniRoute")
    return [node, str(entrypoint)]


def http_get(url: str, headers: dict[str, str] | None = None, timeout: float = 2.0) -> tuple[int, bytes]:
    request = urllib.request.Request(url, headers=headers or {})
    try:
        # This is strictly a loopback probe. Never inherit a corporate/global HTTP
        # proxy that could route even a local health check outside the host.
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(request, timeout=timeout) as response:
            return response.status, response.read(4096)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(4096)


def smoke(state: Path, port: int) -> int:
    env = runtime_env(state, port)
    log_path = safe_private_path(state, state / "smoke.log", "private smoke log")
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    log_fd = os.open(log_path, flags, 0o600)
    process: subprocess.Popen[str] | None = None
    with os.fdopen(log_fd, "w", encoding="utf-8") as log:
        os.chmod(log_path, 0o600)
        process = subprocess.Popen(
            [*command(state), "serve", "--port", str(port), "--no-open", "--no-tray", "--no-recovery"],
            cwd=package_dir(state), env=env, stdout=log, stderr=subprocess.STDOUT, text=True,
        )
    try:
        deadline = time.monotonic() + 35
        health_status: int | None = None
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise Blocked(f"OmniRoute exited before the local smoke check; inspect private log {log_path}")
            try:
                health_status, _ = http_get(f"http://127.0.0.1:{port}/healthz")
                if 200 <= health_status < 300:
                    break
            except (urllib.error.URLError, TimeoutError):
                time.sleep(0.5)
        else:
            raise Blocked(f"Timed out waiting for the local OmniRoute health endpoint; inspect private log {log_path}")
        unauthenticated, _ = http_get(f"http://127.0.0.1:{port}/v1/models")
        if unauthenticated != 401:
            raise Blocked(f"Unauthenticated /v1/models was not rejected (HTTP {unauthenticated})")
        print(f"Smoke passed: health HTTP {health_status}; unauthenticated gateway HTTP 401.")
        print("No authenticated gateway, models, chat, or completion endpoint was called.")
        return 0
    finally:
        if process is not None and process.poll() is None:
            process.send_signal(signal.SIGTERM)
            try:
                process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=4)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", help="Path to the reviewed omniroute-3.8.50.tgz archive")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--install", action="store_true", help="Verify and install the pinned local archive")
    parser.add_argument("--smoke", action="store_true", help="Run local health and unauthenticated-rejection checks")
    parser.add_argument("--serve", action="store_true", help="Run foreground loopback-only gateway; makes no model request")
    args = parser.parse_args()
    if not any((args.install, args.smoke, args.serve)):
        parser.error("choose at least one of --install, --smoke, or --serve")
    root = git_root()
    state = private_root(root)
    if args.install:
        install(root, state, archive_path(root, args.archive))
    if args.smoke:
        if installed_version(state) != VERSION:
            raise Blocked("Run --install successfully before --smoke")
        smoke(state, args.port)
    if args.serve:
        if installed_version(state) != VERSION:
            raise Blocked("Run --install successfully before --serve")
        os.execvpe(command(state)[0], [*command(state), "serve", "--port", str(args.port), "--no-open", "--no-tray", "--no-recovery"], runtime_env(state, args.port))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (Blocked, OSError, subprocess.CalledProcessError) as exc:
        print(f"Blocked: {exc}", file=sys.stderr)
        raise SystemExit(2)
