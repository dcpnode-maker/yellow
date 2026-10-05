"""Provision and serve FCC only behind Yellow's local read-only guard."""

from __future__ import annotations

import argparse
import os
import secrets
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Mapping

from fcc_guard import FCCReadOnlyGuard

SOURCE = Path(r"D:\Yellow\runtime\free-claude-code\source")
CONFIG_ROOT = Path(r"D:\Yellow\runtime\free-claude-code\config")
HOME_CONFIG = Path.home() / ".fcc"
CONFIG_VALUES = {
    "FCC_CONFIG_SCHEMA": "1",
    "HOST": "127.0.0.1",
    "PORT": "18082",
    "PROXY_AUTH_ENABLED": "true",
    "FCC_OPEN_BROWSER": "false",
    "MESSAGING_PLATFORM": "none",
    "VOICE_NOTE_ENABLED": "false",
    "ENABLE_WEB_SERVER_TOOLS": "false",
    "MODEL": "lmstudio/unconfigured",
    "MODEL_FALLBACKS": "",
    "LM_STUDIO_BASE_URL": "http://127.0.0.1:9/v1",
    "LLAMACPP_BASE_URL": "http://127.0.0.1:9/v1",
    "OLLAMA_BASE_URL": "http://127.0.0.1:9",
    "HTTP_CONNECT_TIMEOUT": "1",
    "HTTP_READ_TIMEOUT": "1",
    "HTTP_WRITE_TIMEOUT": "1",
}
_LEGACY_CONFIG_VALUES = {key: value for key, value in CONFIG_VALUES.items() if not key.startswith("HTTP_")}
_WINDOWS_ENV = {
    "APPDATA", "COMSPEC", "HOMEDRIVE", "HOMEPATH", "HOME", "LOCALAPPDATA",
    "NUMBER_OF_PROCESSORS", "OS", "PATH", "PATHEXT", "PROCESSOR_ARCHITECTURE",
    "PROGRAMDATA", "PUBLIC", "SYSTEMROOT", "TEMP", "TMP", "USERDOMAIN",
    "USERNAME", "USERPROFILE", "WINDIR",
}


@dataclass(frozen=True)
class Provisioned:
    env_path: Path
    dashboard_path: Path


def _secret(value: str) -> str:
    if len(value) < 32 or any(char.isspace() or ord(char) < 33 or ord(char) > 126 for char in value):
        raise ValueError("FCC secret is malformed.")
    return value


def _read_env(path: Path, expected: Mapping[str, str] = CONFIG_VALUES) -> dict[str, str]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
        values = dict(line.split("=", 1) for line in lines if line and "=" in line)
    except (OSError, ValueError) as error:
        raise ValueError("FCC managed configuration is unreadable.") from error
    if len(values) != len(lines) or set(values) != set(expected) | {"ANTHROPIC_AUTH_TOKEN"}:
        raise ValueError("FCC managed configuration is not the exact read-only profile.")
    if any(values[key] != fixed for key, fixed in expected.items()):
        raise ValueError("FCC managed configuration differs from the read-only profile.")
    values["ANTHROPIC_AUTH_TOKEN"] = _secret(values["ANTHROPIC_AUTH_TOKEN"])
    return values


def provision(root: Path = CONFIG_ROOT, *, secrets_factory: Callable[[], str] | None = None) -> Provisioned:
    if root.is_symlink():
        raise ValueError("FCC configuration root must not be a link.")
    root.mkdir(parents=True, exist_ok=True)
    env_path, dashboard_path = root / ".env", root / "dashboard-secret.txt"
    if env_path.exists() or dashboard_path.exists():
        if not env_path.is_file() or not dashboard_path.is_file():
            raise ValueError("FCC configuration is incomplete.")
        try:
            managed = _read_env(env_path)
        except ValueError:
            legacy = _read_env(env_path, _LEGACY_CONFIG_VALUES)
            migrated = CONFIG_VALUES | {"ANTHROPIC_AUTH_TOKEN": legacy["ANTHROPIC_AUTH_TOKEN"]}
            env_path.write_text(
                "".join(f"{key}={value}\n" for key, value in migrated.items()),
                encoding="utf-8",
            )
            managed = _read_env(env_path)
        if managed["ANTHROPIC_AUTH_TOKEN"] == _secret(dashboard_path.read_text(encoding="utf-8")):
            raise ValueError("FCC API and dashboard secrets must differ.")
        return Provisioned(env_path, dashboard_path)
    generate = secrets_factory or (lambda: secrets.token_urlsafe(36))
    api_secret, dashboard_secret = _secret(generate()), _secret(generate())
    if api_secret == dashboard_secret:
        raise ValueError("FCC API and dashboard secrets must differ.")
    dashboard_path.write_text(dashboard_secret, encoding="utf-8")
    values = CONFIG_VALUES | {"ANTHROPIC_AUTH_TOKEN": api_secret}
    env_path.write_text("".join(f"{key}={value}\n" for key, value in values.items()), encoding="utf-8")
    return Provisioned(env_path, dashboard_path)


def sanitized_environment(parent: Mapping[str, str], source: Path = SOURCE) -> dict[str, str]:
    child = {key: value for key, value in parent.items() if key in _WINDOWS_ENV}
    child["PYTHONPATH"] = str(source / "src")
    return child


def _verify_home_config() -> None:
    if not HOME_CONFIG.exists() or HOME_CONFIG.resolve() != CONFIG_ROOT.resolve():
        raise ValueError("C:\\Users\\astha\\.fcc must be the validated D: FCC junction.")


def serve() -> None:
    provision()
    _verify_home_config()
    child = sanitized_environment(os.environ)
    os.environ.clear()
    os.environ.update(child)
    sys.path.insert(0, str(SOURCE / "src"))
    from free_claude_code.config.loader import get_settings
    from free_claude_code.runtime.bootstrap import build_asgi_app
    import uvicorn

    password = (CONFIG_ROOT / "dashboard-secret.txt").read_text(encoding="utf-8")
    bearer = _read_env(CONFIG_ROOT / ".env")["ANTHROPIC_AUTH_TOKEN"]
    app = FCCReadOnlyGuard(build_asgi_app(get_settings()), password=password, bearer_secret=bearer)
    uvicorn.run(app, host="127.0.0.1", port=18082, access_log=False, log_level="warning")


def main() -> None:
    parser = argparse.ArgumentParser(description="FCC local read-only dashboard")
    parser.add_argument("action", choices=("provision", "serve"), nargs="?", default="provision")
    action = parser.parse_args().action
    if action == "provision":
        provision()
        return
    serve()


if __name__ == "__main__":
    main()
