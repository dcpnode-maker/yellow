"""Fail-closed, local read-only ASGI boundary for the FCC dashboard."""

from __future__ import annotations

import base64
import hmac
import ipaddress
from collections.abc import Awaitable, Callable
from typing import Any
from urllib.parse import urlsplit

ASGIApp = Callable[[dict[str, Any], Callable[[], Awaitable[dict[str, Any]]], Callable[[dict[str, Any]], Awaitable[None]]], Awaitable[None]]
_HOSTS = {"127.0.0.1:18082", "localhost:18082"}
_PAGES = {"/admin", "/admin/model_config", "/admin/messaging", "/admin/integrations", "/admin/api/config", "/admin/api/status", "/health"}
_MUTATIONS = {"POST", "PUT", "PATCH", "DELETE"}


class FCCReadOnlyGuard:
    """Forward only an authenticated, loopback-bound read-only dashboard surface."""

    def __init__(self, app: ASGIApp, *, password: str, bearer_secret: str | None = None) -> None:
        if not password:
            raise ValueError("A nonempty dashboard password is required.")
        if bearer_secret == "":
            raise ValueError("Bearer secret must be nonempty when configured.")
        self._app = app
        self._basic = f"yellow:{password}".encode()
        self._bearer = bearer_secret.encode() if bearer_secret else None

    async def __call__(self, scope: dict[str, Any], receive: Callable[[], Awaitable[dict[str, Any]]], send: Callable[[dict[str, Any]], Awaitable[None]]) -> None:
        kind = scope.get("type")
        if kind == "lifespan":
            await self._app(scope, receive, send)
            return
        if kind == "websocket":
            await send({"type": "websocket.close", "code": 1008})
            return
        if kind != "http":
            await self._deny(send, 400)
            return
        method = str(scope.get("method", "")).upper()
        if method in _MUTATIONS or method not in {"GET", "HEAD"}:
            await self._deny(send, 405)
            return
        headers = self._headers(scope)
        if headers is None or not self._loopback(scope) or not self._origin_ok(headers):
            await self._deny(send, 403)
            return
        path = scope.get("path")
        raw_path = scope.get("raw_path", b"")
        if not isinstance(path, str) or not self._allowed_path(path, raw_path) or scope.get("query_string", b""):
            await self._deny(send, 404)
            return
        if not self._authorized(headers, method):
            await self._deny(send, 401, challenge=True)
            return
        await self._app(scope, receive, send)

    @staticmethod
    def _headers(scope: dict[str, Any]) -> dict[str, bytes] | None:
        result: dict[str, bytes] = {}
        for pair in scope.get("headers", []):
            if not isinstance(pair, tuple) or len(pair) != 2 or not all(isinstance(item, bytes) for item in pair):
                return None
            name, value = pair
            try:
                key = name.decode("ascii").lower()
            except UnicodeDecodeError:
                return None
            if key in result and key in {"host", "authorization", "origin", "referer"}:
                return None
            result[key] = value
        return result

    @staticmethod
    def _loopback(scope: dict[str, Any]) -> bool:
        client = scope.get("client")
        if not isinstance(client, tuple) or not client or not isinstance(client[0], str):
            return False
        try:
            return ipaddress.ip_address(client[0]).is_loopback
        except ValueError:
            return False

    @staticmethod
    def _allowed_path(path: str, raw_path: object) -> bool:
        if not isinstance(raw_path, bytes) or b"%" in raw_path:
            return False
        try:
            if raw_path != path.encode("ascii"):
                return False
        except UnicodeEncodeError:
            return False
        if path in _PAGES:
            return True
        if not path.startswith("/admin/assets/"):
            return False
        tail = path.removeprefix("/admin/assets/").split("/")
        return all(part not in {"", ".", ".."} and all(char.isascii() and (char.isalnum() or char in "._-") for char in part) for part in tail)

    def _origin_ok(self, headers: dict[str, bytes]) -> bool:
        host = self._text(headers.get("host"))
        if host not in _HOSTS:
            return False
        if "origin" in headers and self._text(headers["origin"]) != f"http://{host}":
            return False
        if "referer" not in headers:
            return True
        referer = self._text(headers["referer"])
        if referer is None:
            return False
        try:
            parsed = urlsplit(referer)
        except ValueError:
            return False
        return parsed.scheme == "http" and parsed.netloc == host and not parsed.username and not parsed.password and not parsed.fragment

    @staticmethod
    def _text(value: bytes | None) -> str | None:
        if value is None:
            return None
        try:
            return value.decode("ascii")
        except UnicodeDecodeError:
            return None

    def _authorized(self, headers: dict[str, bytes], method: str) -> bool:
        value = self._text(headers.get("authorization"))
        if value is None:
            return False
        if value.startswith("Basic "):
            try:
                actual = base64.b64decode(value[6:], validate=True)
            except (ValueError, UnicodeEncodeError):
                return False
            return hmac.compare_digest(actual, self._basic)
        if self._bearer is not None and method == "GET" and value.startswith("Bearer "):
            return hmac.compare_digest(value[7:].encode(), self._bearer)
        return False

    @staticmethod
    async def _deny(send: Callable[[dict[str, Any]], Awaitable[None]], status: int, *, challenge: bool = False) -> None:
        headers = [(b"content-length", b"0")]
        if challenge:
            headers.append((b"www-authenticate", b'Basic realm="Yellow FCC"'))
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": b""})
