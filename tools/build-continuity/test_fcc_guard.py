from __future__ import annotations

import asyncio
import base64
import unittest

from fcc_guard import FCCReadOnlyGuard


class Upstream:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def __call__(self, scope, receive, send) -> None:
        self.calls.append(scope)
        if scope["type"] == "lifespan":
            event = await receive()
            await send({"type": "lifespan.startup.complete" if event["type"] == "lifespan.startup" else "lifespan.shutdown.complete"})
            return
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})


def basic(password: str = "secret") -> bytes:
    return b"Basic " + base64.b64encode(f"yellow:{password}".encode())


async def invoke(guard, *, path="/admin", method="GET", headers=(), client=("127.0.0.1", 1), raw_path=None, kind="http"):
    sent = []
    events = [{"type": "http.request"}] if kind == "http" else [{"type": "lifespan.startup"}]

    async def receive():
        return events.pop(0)

    async def send(message):
        sent.append(message)

    scope = {"type": kind, "method": method, "path": path, "raw_path": raw_path or path.encode(), "headers": list(headers), "client": client, "query_string": b""}
    await guard(scope, receive, send)
    return sent


class FCCReadOnlyGuardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.upstream = Upstream()
        self.guard = FCCReadOnlyGuard(self.upstream, password="secret", bearer_secret="diag")

    def run_guard(self, **kwargs):
        return asyncio.run(invoke(self.guard, **kwargs))

    @staticmethod
    def headers(auth=basic(), **extra):
        result = [(b"host", b"127.0.0.1:18082"), (b"authorization", auth)]
        return result + [(key.encode(), value.encode()) for key, value in extra.items()]

    def test_auth_failure_and_mutations_never_reach_upstream(self) -> None:
        denied = self.run_guard(headers=self.headers(auth=b"Basic broken"))
        mutation = self.run_guard(method="POST", headers=[])
        self.assertEqual([denied[0]["status"], mutation[0]["status"]], [401, 405])
        self.assertEqual(self.upstream.calls, [])

    def test_authenticated_pages_and_get_bearer_work(self) -> None:
        page = self.run_guard(headers=self.headers(origin="http://127.0.0.1:18082"))
        asset = self.run_guard(path="/admin/assets/dashboard.js", headers=self.headers())
        diag = self.run_guard(path="/health", headers=self.headers(auth=b"Bearer diag"))
        self.assertEqual([page[0]["status"], asset[0]["status"], diag[0]["status"]], [200, 200, 200])
        self.assertEqual(len(self.upstream.calls), 3)

    def test_encoded_unknown_host_and_origin_are_denied(self) -> None:
        encoded = self.run_guard(path="/admin/assets/x/y", raw_path=b"/admin%2Fassets/x/y", headers=self.headers())
        traversal = self.run_guard(path="/admin/assets/../dashboard.js", headers=self.headers())
        host = self.run_guard(headers=[(b"host", b"evil:18082"), (b"authorization", basic())])
        origin = self.run_guard(headers=self.headers(origin="http://evil:18082"))
        malformed_origin = self.run_guard(headers=[(b"host", b"127.0.0.1:18082"), (b"authorization", basic()), (b"origin", b"http://\xff")])
        malformed_referer = self.run_guard(headers=[(b"host", b"127.0.0.1:18082"), (b"authorization", basic()), (b"referer", b"http://\xff")])
        self.assertEqual([encoded[0]["status"], traversal[0]["status"], host[0]["status"], origin[0]["status"], malformed_origin[0]["status"], malformed_referer[0]["status"]], [404, 404, 403, 403, 403, 403])
        self.assertEqual(self.upstream.calls, [])

    def test_duplicate_authorization_and_nonloopback_are_denied(self) -> None:
        duplicate = self.run_guard(headers=self.headers() + [(b"authorization", basic())])
        duplicate_host = self.run_guard(headers=[(b"host", b"127.0.0.1:18082"), (b"host", b"localhost:18082"), (b"authorization", basic())])
        remote = self.run_guard(headers=self.headers(), client=("192.0.2.1", 1))
        self.assertEqual([duplicate[0]["status"], duplicate_host[0]["status"], remote[0]["status"]], [403, 403, 403])
        self.assertEqual(self.upstream.calls, [])

    def test_websockets_close_and_lifespan_forwards(self) -> None:
        closed = self.run_guard(kind="websocket", headers=[])
        life = self.run_guard(kind="lifespan")
        self.assertEqual(closed, [{"type": "websocket.close", "code": 1008}])
        self.assertEqual(life, [{"type": "lifespan.startup.complete"}])
        self.assertEqual(len(self.upstream.calls), 1)


if __name__ == "__main__":
    unittest.main()
