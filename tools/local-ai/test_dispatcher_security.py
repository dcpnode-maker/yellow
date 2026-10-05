import http.server
import pathlib
import sys
import threading
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from dispatch_local_workers import DispatchError, _dispatch, _request


class _Server:
    def __init__(self, handler):
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    @property
    def url(self):
        host, port = self.server.server_address
        return f"http://{host}:{port}"

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *_):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)


class DispatcherSecurityTests(unittest.TestCase):
    def test_redirect_is_rejected_without_forwarding_bearer(self):
        observed = []

        class Sink(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                observed.append(self.headers.get("Authorization"))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"{}")

            def log_message(self, *_):
                pass

        with _Server(Sink) as sink:
            target = sink.url

            class Redirect(http.server.BaseHTTPRequestHandler):
                def do_POST(self):
                    self.send_response(302)
                    self.send_header("Location", target)
                    self.end_headers()

                def log_message(self, *_):
                    pass

            with _Server(Redirect) as redirect:
                with self.assertRaises(DispatchError):
                    _request(redirect.url, {"x": 1}, 2, "fabricated-review-key")
        self.assertEqual([], observed)

    def test_task_secret_is_rejected_before_network(self):
        with self.assertRaisesRegex(DispatchError, "credential material"):
            _dispatch(pathlib.Path.cwd(), "laptop", "safe context", "sk-or-v1-" + "z" * 32)

    def test_malformed_authorization_value_is_not_echoed(self):
        fabricated = "fabricated-review-key\r\nInjected: value"
        with self.assertRaises(DispatchError) as caught:
            _request("http://127.0.0.1:1", {"x": 1}, 1, fabricated)
        self.assertNotIn("fabricated-review-key", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
