"""Offline transport proof: mock the network, exercise policy and durable state."""

import email.message
import hashlib
import importlib.util
import json
from pathlib import Path
import socket
import tempfile
import unittest
import urllib.error
import urllib.request
from unittest.mock import MagicMock, patch


SOURCE = Path(__file__).resolve().parents[2] / "scripts/market-prototype/rate_fetch.py"
SPEC = importlib.util.spec_from_file_location("rate_fetch", SOURCE)
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


class Response:
    def __init__(self, url, body, status=200, content_type="text/html; charset=utf-8", **headers):
        self.url, self.body, self.status = url, body, status
        self.headers = email.message.Message()
        self.headers["Content-Type"] = content_type
        for key, value in headers.items():
            self.headers[key.replace("_", "-")] = value
        self.read_sizes = []

    def geturl(self):
        return self.url

    def read(self, size):
        self.read_sizes.append(size)
        return self.body[:size]

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass


class FetcherTests(unittest.TestCase):
    origin = "https://public.example"
    url = origin + "/hotel?checkin=2026-10-01&checkout=2026-10-02&adults=2&currency=AED"
    robots = "User-agent: *\nAllow: /\n"

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.cache = Path(self.temp.name) / "cache.json"
        self.now = 1_800_000_000.0
        self.sleeps, self.requests = [], []
        self.clock_patch = patch.object(mod.time, "time", side_effect=lambda: self.now)
        self.sleep_patch = patch.object(mod.time, "sleep", side_effect=self.sleep)
        self.clock_patch.start()
        self.sleep_patch.start()
        self.addCleanup(self.clock_patch.stop)
        self.addCleanup(self.sleep_patch.stop)
        # Every test is offline even if a mock is accidentally omitted.
        self.network_patch = patch.object(mod.socket, "getaddrinfo", side_effect=AssertionError("unexpected real DNS"))
        self.network_patch.start()
        self.addCleanup(self.network_patch.stop)

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.now += seconds

    def fetcher(self, **kwargs):
        return mod.Fetcher(cache_path=self.cache, origins=[self.origin], **kwargs)

    def scripted(self, fetcher, page=None, robots=None):
        page = b"<html>public hotel</html>" if page is None else page
        robots = self.robots if robots is None else robots

        def opened(request, timeout):
            self.requests.append((request, timeout, self.now))
            if request.full_url.endswith("/robots.txt"):
                return Response(request.full_url, robots.encode(), content_type="text/plain")
            if isinstance(page, Exception):
                raise page
            if isinstance(page, Response):
                return page
            return Response(request.full_url, page)
        fetcher._opener.open = MagicMock(side_effect=opened)
        return fetcher._opener.open

    def test_preserves_query_bytes_hash_time_and_transparent_no_credentials_headers(self):
        with self.fetcher(timeout_seconds=7.5) as fetcher:
            opened = self.scripted(fetcher)
            result = fetcher.fetch(self.url)
            self.assertEqual(result["status"], "ok")
            self.assertEqual(result["source_sha256"], hashlib.sha256(b"<html>public hotel</html>").hexdigest())
            self.assertTrue(mod._valid_stamp(result["fetched_at"]))
            self.assertEqual(fetcher.request_attempts, 2)
            self.assertEqual(opened.call_args.args[0].full_url, self.url)
            self.assertEqual(self.sleeps, [5.0])
            headers = dict(self.requests[-1][0].header_items())
            self.assertIn("YellowMarketRatePrototype", headers["User-agent"])
            self.assertEqual(set(headers), {"User-agent", "Accept", "Accept-encoding", "Connection"})
            self.assertEqual(self.requests[-1][1], 7.5)

    def test_exact_origin_and_private_secret_url_rejections_use_no_network(self):
        urls = [
            "http://public.example/hotel", "https://evil.example/hotel", "https://sub.public.example/hotel",
            "https://public.example:444/hotel", "https://me:secret@public.example/hotel", self.origin + "/api.json",
            self.origin + "/hotel/../api", self.origin + "/%61pi", self.origin + "/hotel//admin", self.origin + "/hotel;admin",
            self.origin + "/travel/_/batchexecute", self.origin + "/hotel?token=secret", self.origin + "/hotel?q=a%40b.com",
            self.origin + "/hotel?adults=2&adults=3", self.origin + "/hotel?checkin=2026-02-31", self.origin + "/hotel#fragment",
            self.origin + "/hotel?currency=AED%0d%0aCookie:x", self.origin + "/hotel?q=%zz", self.origin + "/hotel?children=-1",
        ]
        with self.fetcher() as fetcher:
            opened = self.scripted(fetcher)
            for url in urls:
                with self.subTest(url=url):
                    self.assertEqual(fetcher.fetch(url)["status"], "blocked")
            opened.assert_not_called()
            self.assertEqual(fetcher.request_attempts, 0)

    def test_origin_configuration_rejects_private_literal_and_configured_denial(self):
        origins = ["https://127.0.0.1", "https://[::1]", "https://localhost", "https://host.local", "https://bnbmehomes.com",
                   "https://www.bnbmehomes.com", "https://bnbmehomes.com.", self.origin + "/path", self.origin + "?q=test"]
        for origin in origins:
            with self.subTest(origin=origin), self.assertRaises(ValueError):
                mod.Fetcher(self.cache, [origin])
        for kwargs in ({"max_requests": 0}, {"max_requests": 101}, {"max_requests": True}, {"timeout_seconds": float("nan")},
                       {"timeout_seconds": 31}, {"max_response_bytes": mod.MAX_BODY_BYTES + 1}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                self.fetcher(**kwargs)

    def test_robots_query_longest_allow_tie_wildcard_encoded_fields_and_anchor(self):
        policy = mod.RobotsPolicy.parse("User-agent: *\nAllow: /\nDisallow: /hotel?currency=AED\n"
                                       "Allow: /hotel?currency=AED&adults=2$\nDisallow: /x*?q=blocked$\n"
                                       "Disallow: /tie\nAllow: /tie\n")
        self.assertFalse(policy.can_fetch(self.origin + "/hotel?currency=AED"))
        self.assertFalse(policy.can_fetch(self.origin + "/hotel?%63urrency=AED"))
        self.assertTrue(policy.can_fetch(self.origin + "/hotel?currency=AED&adults=2"))
        self.assertFalse(policy.can_fetch(self.origin + "/hotel?currency=AED&adults=2&rooms=1"))
        self.assertFalse(policy.can_fetch(self.origin + "/xyz?q=blocked"))
        self.assertTrue(policy.can_fetch(self.origin + "/xyz?q=blocked-extra"))
        self.assertTrue(policy.can_fetch(self.origin + "/tie"))

    def test_specific_agent_and_empty_disallow_do_not_merge_groups(self):
        policy = mod.RobotsPolicy.parse("User-agent: *\nDisallow:\nUser-agent: OtherBot\nDisallow: /\n")
        self.assertTrue(policy.can_fetch(self.url))
        policy = mod.RobotsPolicy.parse("User-agent: *\nDisallow: /\nUser-agent: YellowMarketRatePrototype\nAllow: /hotel\n")
        self.assertTrue(policy.can_fetch(self.url))

    def test_robots_utf8_literals_and_encoded_query_octets_match(self):
        for rule in ("Café", "Caf%C3%A9", "Caf%c3%a9"):
            with self.subTest(rule=rule):
                policy = mod.RobotsPolicy.parse("User-agent: *\nDisallow: /hotel?q=" + rule + "\n")
                for query in ("Caf%C3%A9", "Caf%c3%a9"):
                    url = mod.validate_url(self.origin + "/hotel?q=" + query)
                    self.assertFalse(policy.can_fetch(url))

    def test_robots_many_wildcards_uses_bounded_matching_without_regex(self):
        policy = mod.RobotsPolicy.parse("User-agent: *\nDisallow: /" + "a*" * 20 + "b$\n")
        with patch.object(mod.re, "search", side_effect=AssertionError("unbounded regex matching forbidden")):
            self.assertTrue(policy.can_fetch(self.origin + "/" + "a" * 2000))
            self.assertFalse(policy.can_fetch(self.origin + "/" + "a" * 1999 + "b"))
        for pattern, target, anchored, allowed in [
            ("/foo", "/foobar", False, True), ("/foo", "/foobar", True, False),
            ("/foo*", "/foo", True, True), ("/a*b*c", "/abbbbcc", True, True),
            ("/a*b*c", "/abbbbd", False, False), ("/*", "/", True, True),
        ]:
            with self.subTest(pattern=pattern, target=target):
                self.assertEqual(mod._glob_matches(pattern, target, anchored), allowed)

    def test_robots_denial_persists_host_stop_without_page_request(self):
        with self.fetcher() as fetcher:
            self.scripted(fetcher, robots="User-agent: *\nDisallow: /hotel?checkin=2026-10-01\n")
            self.assertEqual(fetcher.fetch(self.url)["reason"], "robots_disallowed")
            self.assertEqual(fetcher.request_attempts, 1)
        with self.fetcher(max_requests=99) as resumed:
            opened = self.scripted(resumed)
            self.assertEqual(resumed.fetch(self.origin + "/other")["reason"], "robots_disallowed")
            opened.assert_not_called()

    def test_request_budget_counts_robots_and_pages_and_new_origins(self):
        with mod.Fetcher(self.cache, [self.origin, "https://second.example"], max_requests=1) as fetcher:
            opened = self.scripted(fetcher)
            self.assertEqual(fetcher.fetch(self.url)["reason"], "request_budget_exhausted")
            self.assertEqual(fetcher.fetch("https://second.example/hotel")["reason"], "request_budget_exhausted")
            self.assertEqual(fetcher.request_attempts, 1)
            self.assertEqual(opened.call_count, 1)

    def test_pacing_respects_robots_hints_and_survives_restart(self):
        with self.fetcher() as fetcher:
            self.scripted(fetcher, robots="User-agent: *\nAllow: /\nCrawl-delay: 7\nRequest-rate: 1/9\n")
            self.assertEqual(fetcher.fetch(self.url)["status"], "ok")
            self.assertEqual(self.sleeps, [9.0])
        with self.fetcher() as resumed:
            self.scripted(resumed)
            self.assertEqual(resumed.fetch(self.origin + "/other")["status"], "ok")
            self.assertEqual(self.sleeps, [9.0, 9.0])

    def test_long_publisher_delay_is_reported_without_long_sleep(self):
        with self.fetcher() as fetcher:
            self.scripted(fetcher, robots="User-agent: *\nAllow: /\nCrawl-delay: 3600\n")
            self.assertEqual(fetcher.fetch(self.url)["reason"], "publisher_pacing_wait")
            self.assertEqual(self.sleeps, [])
            self.assertEqual(fetcher.request_attempts, 1)

    def test_metadata_only_checkpoint_resumes_without_body_or_duplicate_requests(self):
        with self.fetcher() as fetcher:
            self.scripted(fetcher, page=b"<html>private-looking-field-not-persisted</html>")
            first = fetcher.fetch(self.url)
        raw = self.cache.read_text()
        self.assertNotIn("private-looking-field", raw)
        self.assertNotIn('"body"', raw)
        with self.fetcher() as resumed:
            opened = self.scripted(resumed)
            second = resumed.fetch(self.url)
            self.assertEqual(second["status"], "already_fetched")
            self.assertTrue(second["cached"])
            self.assertIsNone(second["body"])
            self.assertEqual(second["source_sha256"], first["source_sha256"])
            self.assertEqual(second["fetched_at"], first["fetched_at"])
            opened.assert_not_called()

    def test_query_variants_are_distinct_checkpoint_entries(self):
        with self.fetcher() as fetcher:
            opened = self.scripted(fetcher)
            self.assertEqual(fetcher.fetch(self.url)["status"], "ok")
            self.assertEqual(fetcher.fetch(self.url.replace("adults=2", "adults=3"))["status"], "ok")
            self.assertEqual(fetcher.fetch(self.url)["status"], "already_fetched")
            self.assertEqual(opened.call_count, 3)

    def test_http_denials_redirects_and_challenge_stop_host_persistently(self):
        cases = [(status, "http_" + str(status)) for status in (401, 403, 429)] + [(302, "redirect_not_followed"), (307, "redirect_not_followed")]
        for status, reason in cases:
            with self.subTest(status=status):
                cache = Path(self.temp.name) / (str(status) + ".json")
                with mod.Fetcher(cache, [self.origin]) as fetcher:
                    self.scripted(fetcher, page=urllib.error.HTTPError(self.url, status, "blocked", {}, None))
                    self.assertEqual(fetcher.fetch(self.url)["reason"], reason)
                    self.assertEqual(fetcher.fetch(self.origin + "/next")["reason"], reason)
                    self.assertEqual(fetcher.request_attempts, 2)
                with mod.Fetcher(cache, [self.origin]) as resumed:
                    opened = self.scripted(resumed)
                    self.assertEqual(resumed.fetch(self.url)["reason"], reason)
                    opened.assert_not_called()
        with self.fetcher() as fetcher:
            self.scripted(fetcher, page=b"<html>Please verify you are human</html>")
            self.assertEqual(fetcher.fetch(self.url)["reason"], "challenge_detected")
            self.assertEqual(fetcher.fetch(self.origin + "/next")["status"], "blocked")

    def test_robots_missing_malformed_or_failed_is_permanent_stop(self):
        for index, robots in enumerate(("<html>not robots</html>", "User-agent: *\nCrawl-delay: nan", "User-agent: *\nRequest-rate: 0/1")):
            with self.subTest(robots=robots), mod.Fetcher(Path(self.temp.name) / f"r{index}.json", [self.origin]) as fetcher:
                self.scripted(fetcher, robots=robots)
                self.assertEqual(fetcher.fetch(self.url)["reason"], "robots_unavailable")
                self.assertEqual(fetcher.request_attempts, 1)
        with self.fetcher() as fetcher:
            fetcher._opener.open = MagicMock(side_effect=urllib.error.HTTPError(self.origin + "/robots.txt", 404, "missing", {}, None))
            self.assertEqual(fetcher.fetch(self.url)["reason"], "robots_unavailable")
        with self.fetcher() as resumed:
            self.scripted(resumed)
            self.assertEqual(resumed.fetch(self.url)["reason"], "robots_unavailable")
            self.assertEqual(resumed.request_attempts, 0)

    def test_transient_failure_cooldown_later_invocation_only_and_retry_cap(self):
        for index in range(2):
            with self.fetcher() as fetcher:
                self.scripted(fetcher, page=urllib.error.HTTPError(self.url, 503, "outage", {}, None))
                self.assertEqual(fetcher.fetch(self.url)["status"], "error")
                self.assertEqual(fetcher.fetch(self.origin + "/other")["reason"], "origin_cooldown")
                self.now += 61
                self.assertNotEqual(fetcher.fetch(self.url)["status"], "ok")
                self.assertEqual(fetcher.request_attempts, 2 if index == 0 else 1)
        with self.fetcher() as resumed:
            opened = self.scripted(resumed)
            self.assertEqual(resumed.fetch(self.url)["reason"], "retry_limit_reached")
            opened.assert_not_called()

    def test_network_failure_cooldown_persists_across_restart_then_can_succeed(self):
        with self.fetcher() as fetcher:
            self.scripted(fetcher, page=urllib.error.URLError("network unavailable with sensitive detail"))
            self.assertEqual(fetcher.fetch(self.url)["reason"], "network_error")
        self.assertNotIn("sensitive detail", self.cache.read_text())
        with self.fetcher() as resumed:
            opened = self.scripted(resumed)
            self.assertEqual(resumed.fetch(self.url)["reason"], "origin_cooldown")
            opened.assert_not_called()
        self.now += 61
        with self.fetcher() as resumed:
            self.scripted(resumed)
            self.assertEqual(resumed.fetch(self.url)["status"], "ok")
            self.assertEqual(resumed.request_attempts, 1)

    def test_response_limit_and_content_length_bound_reads(self):
        with self.fetcher(max_response_bytes=10) as fetcher:
            page = Response(self.url, b"x" * 11)
            self.scripted(fetcher, page=page)
            self.assertEqual(fetcher.fetch(self.url)["reason"], "response_size_limit")
            self.assertEqual(page.read_sizes, [11])
        with mod.Fetcher(Path(self.temp.name) / "length.json", [self.origin], max_response_bytes=10) as fetcher:
            page = Response(self.url, b"x", Content_Length="11")
            self.scripted(fetcher, page=page)
            self.assertEqual(fetcher.fetch(self.url)["reason"], "response_size_limit")
            self.assertEqual(page.read_sizes, [])

    def test_encoding_content_type_and_unexpected_response_url_are_rejected(self):
        cases = [(Response(self.url, b"compressed", Content_Encoding="gzip"), "unsupported_content_encoding"),
                 (Response(self.url, b"json", content_type="application/json"), "unexpected_content_type"),
                 (Response(self.origin + "/elsewhere", b"html"), "unexpected_redirect"),
                 (Response(self.url, b"\xff"), "response_decode_error")]
        for index, (page, reason) in enumerate(cases):
            with self.subTest(reason=reason), mod.Fetcher(Path(self.temp.name) / f"c{index}.json", [self.origin]) as fetcher:
                self.scripted(fetcher, page=page)
                self.assertEqual(fetcher.fetch(self.url)["reason"], reason)

    def test_cache_corrupt_oversized_duplicate_keys_scope_and_incomplete_fail_closed(self):
        for content in (b"not json", b"{" * 1200, b" " * (mod.MAX_CACHE_BYTES + 1), b'{"schema_version":1,"schema_version":1}', b'{}'):
            with self.subTest(length=len(content)):
                self.cache.write_bytes(content)
                with self.assertRaises(ValueError):
                    with self.fetcher():
                        self.fail("corrupt cache entered")
                self.assertEqual(self.cache.read_bytes(), content)
                self.assertFalse(self.cache.with_suffix(".json.lock").exists())
        self.cache.unlink()
        with self.fetcher():
            pass
        with self.assertRaises(ValueError):
            with mod.Fetcher(self.cache, ["https://different.example"]):
                pass

    def test_checkpoint_schema_rejects_tampered_timestamps_policy_and_evidence(self):
        with self.fetcher() as fetcher:
            self.scripted(fetcher)
            fetcher.fetch(self.url)
        original = json.loads(self.cache.read_text())
        changes = [lambda state: state["hosts"][self.origin].update(interval=1),
                   lambda state: state["hosts"][self.origin].update(last_attempt=float("nan")),
                   lambda state: state["entries"][self.url].update(source_sha256="wrong"),
                   lambda state: state["entries"][self.url].update(fetched_at="2026-09-25"),
                   lambda state: state["entries"][self.url].update(body="unapproved body")]
        for change in changes:
            state = json.loads(json.dumps(original))
            change(state)
            self.cache.write_text(json.dumps(state))
            with self.assertRaises(ValueError):
                with self.fetcher():
                    pass

    def test_lock_excludes_other_writer_and_context_cleanup_preserves_cache(self):
        with self.fetcher():
            with self.assertRaises(RuntimeError):
                with self.fetcher():
                    pass
        with self.fetcher():
            pass
        self.assertTrue(self.cache.exists())
        self.assertFalse(self.cache.with_suffix(".json.lock").exists())

    def test_interrupted_request_checkpoint_stops_without_retry(self):
        with self.fetcher() as fetcher:
            fetcher._state["hosts"][self.origin]["in_flight"] = True
            fetcher._save()
        with self.fetcher() as resumed:
            opened = self.scripted(resumed)
            self.assertEqual(resumed.fetch(self.url)["reason"], "interrupted_request_requires_review")
            opened.assert_not_called()

    def test_atomic_write_failure_prevents_outbound_request_and_keeps_prior_checkpoint(self):
        with self.fetcher() as fetcher:
            before = self.cache.read_bytes()
            opened = self.scripted(fetcher)
            with patch.object(mod.os, "replace", side_effect=OSError("disk unavailable")), self.assertRaises(OSError):
                fetcher.fetch(self.url)
            self.assertEqual(self.cache.read_bytes(), before)
            opened.assert_not_called()
            self.assertEqual(fetcher.request_attempts, 0)
            with self.assertRaises(RuntimeError):
                fetcher.fetch(self.url)
        self.assertEqual(list(self.cache.parent.glob("*.tmp")), [])

    def test_expired_robots_are_rechecked_with_remaining_budget(self):
        with self.fetcher() as fetcher:
            self.scripted(fetcher)
            fetcher.fetch(self.url)
        self.now += mod.ROBOTS_TTL + 1
        with self.fetcher(max_requests=1) as resumed:
            self.scripted(resumed)
            self.assertEqual(resumed.fetch(self.origin + "/new")["reason"], "request_budget_exhausted")
            self.assertEqual(resumed.request_attempts, 1)

    def test_proxy_environment_ignored_and_no_cookie_or_auth_handlers(self):
        with patch.dict(mod.os.environ, {"HTTPS_PROXY": "http://127.0.0.1:9999", "HTTP_PROXY": "http://127.0.0.1:9999"}):
            fetcher = self.fetcher()
        handlers = fetcher._opener.handlers
        self.assertFalse(any(isinstance(handler, (urllib.request.HTTPCookieProcessor, urllib.request.HTTPBasicAuthHandler, urllib.request.ProxyHandler)) for handler in handlers))
        self.assertTrue(any(isinstance(handler, mod._PublicHTTPSHandler) for handler in handlers))
        request = urllib.request.Request(self.url)
        with self.assertRaises(urllib.error.HTTPError):
            mod._NoRedirect().redirect_request(request, None, 302, "Found", {}, "http://127.0.0.1/private")

    def test_dns_private_mixed_loopback_linklocal_and_ipv6_fail_before_socket(self):
        addresses = ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "fc00::1", "::ffff:127.0.0.1",
                     "224.0.0.1", "239.255.255.250", "ff0e::1", "240.0.0.1"]
        for address in addresses:
            with self.subTest(address=address), patch.object(mod.socket, "getaddrinfo", return_value=[
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443)),
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 443)),
            ]), patch.object(mod.socket, "socket") as create:
                connection = mod._PublicHTTPSConnection("public.example", timeout=5)
                with self.assertRaises(OSError):
                    connection.connect()
                create.assert_not_called()

    def test_unexpected_or_nonpublic_peer_is_closed_before_tls(self):
        for peer in ("93.184.216.35", "127.0.0.1", "224.0.0.1", "ff0e::1"):
            with self.subTest(peer=peer):
                context, raw = MagicMock(), MagicMock()
                raw.getpeername.return_value = (peer, 443)
                connection = mod._PublicHTTPSConnection("public.example", timeout=5, context=context)
                with patch.object(mod.socket, "getaddrinfo", return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]), patch.object(mod.socket, "socket", return_value=raw):
                    with self.assertRaises(OSError):
                        connection.connect()
                raw.close.assert_called_once()
                context.wrap_socket.assert_not_called()

    def test_dns_public_address_pinned_once_tls_uses_original_hostname(self):
        context, raw = MagicMock(), MagicMock()
        raw.getpeername.return_value = ("93.184.216.34", 443)
        connection = mod._PublicHTTPSConnection("public.example", timeout=5, context=context)
        with patch.object(mod.socket, "getaddrinfo", return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]) as dns, patch.object(mod.socket, "socket", return_value=raw):
            connection.connect()
        dns.assert_called_once()
        raw.connect.assert_called_once_with(("93.184.216.34", 443))
        raw.settimeout.assert_called_once_with(5)
        context.wrap_socket.assert_called_once_with(raw, server_hostname="public.example")


if __name__ == "__main__":
    unittest.main()
