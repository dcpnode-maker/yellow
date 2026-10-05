"""Bounded, read-only public HTTPS transport for Order 726.

Use ``with Fetcher(cache_path, origins) as fetcher: fetcher.fetch(url)``.
Only a successful new fetch returns a body. The durable checkpoint retains URL,
hash and time, robots policy, pacing and terminal stops; it never retains HTML.
Reopening it returns ``already_fetched`` for successful URLs. The caller must save
its extracted observations separately. Delete neither checkpoints nor lock files
to work around a recorded block; an abandoned lock requires operator inspection.
"""

from __future__ import annotations

import hashlib
import http.client
import ipaddress
import json
import math
import os
from pathlib import Path
import re
import socket
import ssl
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

USER_AGENT = "YellowMarketRatePrototype/0.1 (public research; sequential bounded requests)"
MAX_BODY_BYTES = 2 * 1024 * 1024
MAX_ROBOTS_BYTES = 256 * 1024
MAX_CACHE_BYTES = 4 * 1024 * 1024
MAX_ENTRIES = 1000
MAX_REQUESTS = 100
MAX_ORIGINS = 5
MIN_INTERVAL = 5.0
RETRY_COOLDOWN = 60.0
MAX_ATTEMPTS_PER_URL = 2
ROBOTS_TTL = 24 * 60 * 60
SCHEMA_VERSION = 1
QUERY_KEYS = frozenset({
    "checkin", "checkout", "arrival", "departure", "start_date", "end_date",
    "adults", "children", "rooms", "hl", "gl", "currency", "q",
})
PRIVATE_SEGMENTS = (
    "api", "account", "admin", "auth", "user", "login", "signin", "sign-in",
    "checkout", "payment", "session", "private", "internal", "graphql", "rpc",
    "batchexecute", "_", "preview", "booking", "reservation",
)
CHALLENGE_MARKERS = (
    "cf-chl-", "challenge-platform", "g-recaptcha", "h-captcha", "hcaptcha",
    "verify you are human", "verify that you are human", "unusual traffic",
    "automated queries", "access denied", "checking your browser",
    "enable javascript and cookies to continue",
)


def _number(value, minimum=0.0, maximum=1e12):
    return type(value) in (int, float) and math.isfinite(value) and minimum <= value <= maximum


def _origin(url: str) -> str:
    if not isinstance(url, str) or not url or len(url) > 2048:
        raise ValueError("invalid_url")
    if any(ord(char) <= 32 or ord(char) >= 127 for char in url) or "\\" in url:
        raise ValueError("ambiguous_url")
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username is not None or parsed.password is not None:
        raise ValueError("https_public_origin_required")
    if parsed.port not in (None, 443):
        raise ValueError("nonstandard_port")
    host = parsed.hostname.lower()
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", host) or "." not in host:
        raise ValueError("public_dns_hostname_required")
    if any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) for label in host.split(".")):
        raise ValueError("invalid_hostname")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise ValueError("literal_ip_not_allowed")
    if host.endswith((".local", ".localhost", ".internal", ".home", ".lan")):
        raise ValueError("private_hostname")
    if host == "bnbmehomes.com" or host.endswith(".bnbmehomes.com"):
        raise ValueError("configured_source_denial")
    return "https://" + host


def validate_url(url: str, origins=None) -> str:
    """Reject private/ambiguous routes and unknown query fields; retain safe queries."""
    origin = _origin(url)
    parsed = urllib.parse.urlsplit(url)
    if origins is not None and origin not in origins:
        raise ValueError("origin_not_allowed")
    if parsed.fragment:
        raise ValueError("fragments_not_allowed")
    path = parsed.path or "/"
    if "%" in path or ";" in path or "//" in path or any(part in (".", "..") for part in path.split("/")):
        raise ValueError("ambiguous_path")
    if any(segment.lower().startswith(PRIVATE_SEGMENTS) for segment in path.split("/") if segment):
        raise ValueError("private_endpoint")
    if re.search(r"%(?![0-9a-fA-F]{2})", parsed.query):
        raise ValueError("invalid_query_encoding")
    try:
        pairs = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True, max_num_fields=16, errors="strict")
    except (ValueError, UnicodeError) as exc:
        raise ValueError("invalid_query") from exc
    seen = set()
    for key, value in pairs:
        if key not in QUERY_KEYS or key in seen or not value or len(value) > 120:
            raise ValueError("unsafe_query_field")
        seen.add(key)
        if key in {"checkin", "checkout", "arrival", "departure", "start_date", "end_date"}:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                raise ValueError("invalid_date_query")
            try:
                datetime.strptime(value, "%Y-%m-%d")
            except ValueError as exc:
                raise ValueError("invalid_date_query") from exc
        elif key in {"adults", "children", "rooms"}:
            if not re.fullmatch(r"\d{1,2}", value) or not (0 if key == "children" else 1) <= int(value) <= 20:
                raise ValueError("invalid_occupancy_query")
        elif key == "currency" and not re.fullmatch(r"[A-Z]{3}", value):
            raise ValueError("invalid_currency_query")
        elif key == "gl" and not re.fullmatch(r"[A-Za-z]{2}", value):
            raise ValueError("invalid_country_query")
        elif key == "hl" and not re.fullmatch(r"[a-z]{2,3}(?:-[A-Za-z]{2,4})?", value):
            raise ValueError("invalid_language_query")
        elif key == "q" and not re.fullmatch(r"[\w .,'()&-]{1,120}", value, re.UNICODE):
            raise ValueError("invalid_public_search_query")
    return urllib.parse.urlunsplit(("https", parsed.netloc, path, parsed.query, ""))


def _robots_octets(value: str) -> str:
    # RFC 9309: unreserved encoded octets compare as characters; reserved octets
    # remain encoded. This prevents %63urrency bypassing a currency query rule.
    def replace(match):
        char = chr(int(match.group(1), 16))
        return char if re.fullmatch(r"[A-Za-z0-9._~-]", char) else "%" + match.group(1).upper()
    normalized = re.sub(r"%([0-9a-fA-F]{2})", replace, value)
    return "".join(char if 32 < ord(char) < 127 else "".join(f"%{octet:02X}" for octet in char.encode("utf-8"))
                   for char in normalized)


def _glob_matches(pattern, target, anchored):
    """Match only robots' '*' wildcard without exponential regex backtracking."""
    position = cursor = 0
    star = -1
    retry = 0
    while position < len(target):
        if cursor == len(pattern) and not anchored:
            return True
        if cursor < len(pattern) and pattern[cursor] == "*":
            star, retry = cursor, position
            cursor += 1
        elif cursor < len(pattern) and pattern[cursor] == target[position]:
            position += 1
            cursor += 1
        elif star >= 0:
            retry += 1
            position, cursor = retry, star + 1
        else:
            return False
    while cursor < len(pattern) and pattern[cursor] == "*":
        cursor += 1
    return cursor == len(pattern)


class RobotsPolicy:
    """Longest path-plus-query match, Allow ties and agent-specific rate hints."""

    def __init__(self, rules, interval):
        self.rules = rules
        self.interval = interval

    @classmethod
    def parse(cls, text, user_agent=USER_AGENT):
        groups, agents, rules, delays = [], [], [], []
        saw_directive = False
        for raw in text.splitlines() + ["User-agent: END-OF-FILE"]:
            line = raw.split("#", 1)[0].strip()
            if not line or ":" not in line:
                continue
            key, value = (part.strip() for part in line.split(":", 1))
            key = key.lower()
            if key == "user-agent":
                if saw_directive:
                    groups.append((agents, rules, delays))
                    agents, rules, delays, saw_directive = [], [], [], False
                if not value:
                    raise ValueError("empty_robots_agent")
                agents.append(value.lower())
            elif agents:
                saw_directive = True
                if key in {"allow", "disallow"} and value:
                    if len(value) > 2048 or value.count("*") > 20 or not value.startswith("/"):
                        raise ValueError("unsupported_robots_rule")
                    rules.append((key, _robots_octets(value)))
                elif key == "crawl-delay":
                    interval = float(value)
                    if not _number(interval, 0, 3600):
                        raise ValueError("unsupported_robots_delay")
                    delays.append(interval)
                elif key == "request-rate":
                    match = re.fullmatch(r"([1-9]\d*)\s*/\s*(\d+(?:\.\d+)?)", value)
                    if not match:
                        raise ValueError("unsupported_robots_rate")
                    interval = float(match[2]) / int(match[1])
                    if not _number(interval, 0.001, 3600):
                        raise ValueError("unsupported_robots_rate")
                    delays.append(interval)
        if not groups:
            raise ValueError("robots_has_no_policy")
        scored = []
        agent = user_agent.lower()
        for tokens, group_rules, group_delays in groups:
            score = max((0 if token == "*" else len(token) for token in tokens if token == "*" or agent.startswith(token)), default=-1)
            if score >= 0:
                scored.append((score, group_rules, group_delays))
        best = max((row[0] for row in scored), default=-1)
        chosen = [row for row in scored if row[0] == best]
        return cls([rule for _, group_rules, _ in chosen for rule in group_rules],
                   max([MIN_INTERVAL] + [delay for _, _, group_delays in chosen for delay in group_delays]))

    def can_fetch(self, url):
        parsed = urllib.parse.urlsplit(url)
        target = _robots_octets((parsed.path or "/") + ("?" + parsed.query if parsed.query else ""))
        matches = []
        for directive, pattern in self.rules:
            anchored = pattern.endswith("$")
            pattern = pattern[:-1] if anchored else pattern
            if _glob_matches(pattern, target, anchored):
                matches.append((len(pattern.replace("*", "").encode("utf-8")), directive == "allow"))
        return not matches or max(matches)[1]


def _public_address(value):
    address = ipaddress.ip_address(value)
    return address.is_global and not address.is_multicast and not address.is_reserved


class _PublicHTTPSConnection(http.client.HTTPSConnection):
    """Pin a verified public DNS result for the connection; verify original TLS host."""

    def connect(self):
        if self._tunnel_host:
            raise OSError("proxy_tunnel_forbidden")
        addresses = socket.getaddrinfo(self.host, self.port, type=socket.SOCK_STREAM)
        if not addresses or any(not _public_address(row[4][0]) for row in addresses):
            raise OSError("nonpublic_dns_address")
        # A failed address is not retried using other addresses in this run.
        family, kind, protocol, _, target = addresses[0]
        raw = socket.socket(family, kind, protocol)
        try:
            raw.settimeout(self.timeout)
            raw.connect(target)
            peer = raw.getpeername()[0]
            if not _public_address(peer) or ipaddress.ip_address(peer) != ipaddress.ip_address(target[0]):
                raise OSError("unexpected_network_peer")
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except BaseException:
            raw.close()
            raise


class _PublicHTTPSHandler(urllib.request.HTTPSHandler):
    def https_open(self, request):
        return self.do_open(_PublicHTTPSConnection, request, context=self._context)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, "redirect_not_followed", headers, fp)


def _stamp():
    return datetime.now(timezone.utc).isoformat()


def _valid_stamp(value):
    if not isinstance(value, str) or len(value) > 40:
        return False
    try:
        return datetime.fromisoformat(value).utcoffset().total_seconds() == 0
    except (ValueError, AttributeError):
        return False


class Fetcher:
    """Single-writer, sequential transport. Construction never accesses the network."""

    def __init__(self, cache_path, origins, max_requests=10, timeout_seconds=10.0, max_response_bytes=MAX_BODY_BYTES):
        if not isinstance(origins, (list, tuple)) or not 1 <= len(origins) <= MAX_ORIGINS:
            raise ValueError("provide_one_to_five_exact_origins")
        normalized = set()
        for origin in origins:
            canonical = _origin(origin)
            parsed = urllib.parse.urlsplit(origin)
            if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
                raise ValueError("exact_origins_required")
            normalized.add(canonical)
        if type(max_requests) is not int or not 1 <= max_requests <= MAX_REQUESTS:
            raise ValueError("request_limit_must_be_1_to_100")
        if not _number(timeout_seconds, 0.1, 30):
            raise ValueError("timeout_must_be_0.1_to_30_seconds")
        if type(max_response_bytes) is not int or not 1 <= max_response_bytes <= MAX_BODY_BYTES:
            raise ValueError("body_limit_must_be_1_to_2097152")
        self.origins = frozenset(normalized)
        self.cache_path = Path(cache_path).resolve()
        self.lock_path = self.cache_path.with_name(self.cache_path.name + ".lock")
        self.max_requests = max_requests
        self.timeout_seconds = timeout_seconds
        self.max_response_bytes = max_response_bytes
        self.request_attempts = 0
        self._attempted_urls = set()
        self._lock = None
        self._state = None
        self._failed = False
        self._opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}), _NoRedirect(),
            _PublicHTTPSHandler(context=ssl.create_default_context()),
        )

    def __enter__(self):
        if self._lock is not None:
            raise RuntimeError("fetcher_already_open")
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            self._lock = os.open(self.lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError as exc:
            raise RuntimeError("checkpoint_locked_inspect_existing_owner") from exc
        try:
            self._state = self._load()
            for host in self._state["hosts"].values():
                if host["in_flight"]:
                    host["stop"] = "interrupted_request_requires_review"
                    host["in_flight"] = False
            self._save()
        except BaseException:
            self.close()
            raise
        return self

    def __exit__(self, *_):
        self.close()

    def close(self):
        if self._lock is not None:
            os.close(self._lock)
            self._lock = None
            self.lock_path.unlink()

    @staticmethod
    def _host():
        return {"stop": None, "cooldown_until": 0, "last_attempt": 0, "interval": MIN_INTERVAL,
                "robots": None, "robots_at": 0, "in_flight": False}

    def _load(self):
        if not self.cache_path.exists():
            return {"schema_version": SCHEMA_VERSION, "origins": sorted(self.origins),
                    "hosts": {origin: self._host() for origin in sorted(self.origins)}, "entries": {}}
        try:
            with self.cache_path.open("rb") as handle:
                raw = handle.read(MAX_CACHE_BYTES + 1)
            if len(raw) > MAX_CACHE_BYTES:
                raise ValueError("oversized_checkpoint")
            def unique_pairs(pairs):
                result = {}
                for key, value in pairs:
                    if key in result:
                        raise ValueError("duplicate_checkpoint_key")
                    result[key] = value
                return result
            state = json.loads(raw, object_pairs_hook=unique_pairs)
            if not isinstance(state, dict) or set(state) != {"schema_version", "origins", "hosts", "entries"}:
                raise ValueError("invalid_checkpoint_shape")
            if state["schema_version"] != SCHEMA_VERSION or state["origins"] != sorted(self.origins):
                raise ValueError("checkpoint_scope_or_version_mismatch")
            if not isinstance(state["hosts"], dict) or set(state["hosts"]) != self.origins:
                raise ValueError("invalid_checkpoint_hosts")
            for host in state["hosts"].values():
                if not isinstance(host, dict) or set(host) != set(self._host()):
                    raise ValueError("invalid_checkpoint_host")
                if host["stop"] is not None and (not isinstance(host["stop"], str) or not re.fullmatch(r"[a-z0-9_]{1,80}", host["stop"])):
                    raise ValueError("invalid_checkpoint_stop")
                if not all(_number(host[key]) for key in ("cooldown_until", "last_attempt", "robots_at")):
                    raise ValueError("invalid_checkpoint_time")
                if type(host["in_flight"]) is not bool or not _number(host["interval"], MIN_INTERVAL, 3600):
                    raise ValueError("invalid_checkpoint_pacing")
                if host["robots"] is not None:
                    if not isinstance(host["robots"], str) or len(host["robots"].encode("utf-8")) > MAX_ROBOTS_BYTES:
                        raise ValueError("invalid_checkpoint_robots")
                    policy = RobotsPolicy.parse(host["robots"])
                    if host["interval"] < policy.interval:
                        raise ValueError("invalid_checkpoint_robots_pacing")
            if not isinstance(state["entries"], dict) or len(state["entries"]) > MAX_ENTRIES:
                raise ValueError("invalid_checkpoint_entries")
            for url, entry in state["entries"].items():
                validate_url(url, self.origins)
                if not isinstance(entry, dict) or set(entry) != {"status", "source_sha256", "fetched_at", "reason", "attempts"}:
                    raise ValueError("invalid_checkpoint_entry")
                if entry["status"] not in {"ok", "error", "blocked"} or type(entry["attempts"]) is not int or not 1 <= entry["attempts"] <= MAX_ATTEMPTS_PER_URL:
                    raise ValueError("invalid_checkpoint_status")
                if entry["status"] == "ok":
                    if not isinstance(entry["source_sha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", entry["source_sha256"]) or not _valid_stamp(entry["fetched_at"]) or entry["reason"] is not None:
                        raise ValueError("invalid_checkpoint_evidence")
                elif entry["source_sha256"] is not None or entry["fetched_at"] is not None or not isinstance(entry["reason"], str) or not re.fullmatch(r"[a-z0-9_]{1,80}", entry["reason"]):
                    raise ValueError("invalid_checkpoint_failure")
            return state
        except (OSError, ValueError, TypeError, KeyError, RecursionError) as exc:
            raise ValueError("checkpoint_invalid_no_requests_allowed") from exc

    def _save(self):
        raw = json.dumps(self._state, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
        if len(raw) > MAX_CACHE_BYTES:
            self._failed = True
            raise RuntimeError("checkpoint_size_limit")
        descriptor, temporary = tempfile.mkstemp(prefix=self.cache_path.name + ".", suffix=".tmp", dir=self.cache_path.parent)
        try:
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(raw)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self.cache_path)
        except BaseException:
            self._failed = True
            raise
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    @staticmethod
    def _result(status, reason=None, *, body=None, source_sha256=None, fetched_at=None, cached=False):
        return dict(status=status, body=body, source_sha256=source_sha256,
                    fetched_at=fetched_at, reason=reason, cached=cached)

    def _stop(self, origin, reason):
        self._state["hosts"][origin]["stop"] = reason
        self._save()
        return self._result("blocked", reason)

    def _request(self, url, *, robots=False):
        origin = _origin(url)
        host = self._state["hosts"][origin]
        if self.request_attempts >= self.max_requests:
            return self._result("skipped", "request_budget_exhausted")
        delay = max(0, host["last_attempt"] + host["interval"] - time.time())
        # A large publisher hint never causes an unbounded foreground sleep.
        if delay > 60:
            return self._result("cooldown", "publisher_pacing_wait")
        if delay:
            time.sleep(delay)
        host["last_attempt"] = time.time()
        host["in_flight"] = True
        self._save()  # Crash recovery blocks an uncertain request, never repeats it.
        self.request_attempts += 1
        result = None
        try:
            request = urllib.request.Request(url, headers={
                "User-Agent": USER_AGENT, "Accept": "text/plain" if robots else "text/html,application/xhtml+xml",
                "Accept-Encoding": "identity", "Connection": "close",
            }, method="GET")
            with self._opener.open(request, timeout=self.timeout_seconds) as response:
                if response.geturl() != url:
                    result = self._stop(origin, "unexpected_redirect")
                elif response.status != 200:
                    result = self._http_status(origin, response.status, robots)
                elif response.headers.get("Content-Encoding", "identity").lower() not in ("", "identity"):
                    result = self._stop(origin, "unsupported_content_encoding")
                else:
                    limit = MAX_ROBOTS_BYTES if robots else self.max_response_bytes
                    length = response.headers.get("Content-Length")
                    if length is not None and (not re.fullmatch(r"\d{1,12}", length) or int(length) > limit):
                        result = self._stop(origin, "response_size_limit")
                    else:
                        body = response.read(limit + 1)
                        if len(body) > limit:
                            result = self._stop(origin, "response_size_limit")
                        else:
                            content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
                            if content_type not in (("text/plain",) if robots else ("text/html", "application/xhtml+xml")):
                                result = self._stop(origin, "unexpected_content_type")
                            else:
                                charset = response.headers.get_content_charset() or "utf-8"
                                decoded = body.decode(charset, errors="strict")
                                if any(marker in decoded.lower() for marker in CHALLENGE_MARKERS):
                                    result = self._stop(origin, "challenge_detected")
                                else:
                                    result = self._result("ok", body=decoded, source_sha256=hashlib.sha256(body).hexdigest(), fetched_at=_stamp())
        except urllib.error.HTTPError as exc:
            exc.close()
            result = self._http_status(origin, exc.code, robots)
        except (OSError, urllib.error.URLError, http.client.HTTPException):
            if robots:
                result = self._stop(origin, "robots_unavailable")
            else:
                host["cooldown_until"] = max(host["cooldown_until"], time.time() + RETRY_COOLDOWN)
                result = self._result("error", "network_error")
        except (UnicodeError, LookupError):
            result = self._stop(origin, "response_decode_error")
        finally:
            # If there was an unexpected programming/storage exception, retain the
            # in-flight bit for fail-closed recovery instead of granting a retry.
            if result is not None:
                host["in_flight"] = False
                self._save()
        return result

    def _http_status(self, origin, status, robots):
        if status in (401, 403, 429):
            return self._stop(origin, "http_" + str(status))
        if 300 <= status < 400:
            return self._stop(origin, "redirect_not_followed")
        if robots:
            return self._stop(origin, "robots_unavailable")
        if status >= 500:
            host = self._state["hosts"][origin]
            host["cooldown_until"] = max(host["cooldown_until"], time.time() + RETRY_COOLDOWN)
            return self._result("error", "http_" + str(status))
        return self._result("blocked", "http_" + str(status))

    def fetch(self, url):
        if self._lock is None or self._failed:
            raise RuntimeError("open_healthy_fetcher_required")
        try:
            url = validate_url(url, self.origins)
        except (ValueError, TypeError):
            return self._result("blocked", "unsafe_or_unapproved_url")
        origin = _origin(url)
        host = self._state["hosts"][origin]
        if host["stop"]:
            return self._result("blocked", host["stop"], cached=True)
        prior = self._state["entries"].get(url)
        if prior and prior["status"] == "ok":
            return self._result("already_fetched", "metadata_checkpoint_only", source_sha256=prior["source_sha256"], fetched_at=prior["fetched_at"], cached=True)
        if prior and (prior["status"] == "blocked" or prior["attempts"] >= MAX_ATTEMPTS_PER_URL):
            return self._result("blocked", prior["reason"] if prior["status"] == "blocked" else "retry_limit_reached", cached=True)
        if url in self._attempted_urls:
            return self._result("cooldown", "retry_only_in_later_invocation", cached=True)
        if host["cooldown_until"] > time.time():
            return self._result("cooldown", "origin_cooldown", cached=True)
        if not prior and len(self._state["entries"]) >= MAX_ENTRIES:
            return self._result("skipped", "checkpoint_entry_limit")
        if host["robots"] is None or time.time() - host["robots_at"] >= ROBOTS_TTL:
            result = self._request(origin + "/robots.txt", robots=True)
            if result["status"] != "ok":
                return result
            try:
                policy = RobotsPolicy.parse(result["body"])
            except (ValueError, OverflowError):
                return self._stop(origin, "robots_unavailable")
            host["robots"] = result["body"]
            host["robots_at"] = time.time()
            host["interval"] = policy.interval
            self._save()
        policy = RobotsPolicy.parse(host["robots"])
        if not policy.can_fetch(url):
            return self._stop(origin, "robots_disallowed")
        result = self._request(url)
        if result["status"] in {"ok", "error", "blocked"}:
            self._attempted_urls.add(url)
            self._state["entries"][url] = {
                key: result[key] for key in ("status", "source_sha256", "fetched_at", "reason")
            }
            self._state["entries"][url]["attempts"] = (prior["attempts"] if prior else 0) + 1
            self._save()
        return result
