"""Bounded, metadata-only collector for explicitly authorized public listing pages.

This prototype never stores response bodies, images, descriptions, personal data,
or credentials. Callers must provide exact HTTPS origins and explicit public seeds.
It is deliberately sequential and does not make a request until ``run`` is called.
"""

from __future__ import annotations

import argparse
import hashlib
import html.parser
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple


MAX_FIELD_LENGTH = 240
MAX_LINKS_PER_PAGE = 200
MAX_RECORDS_PER_PAGE = 200
MAX_PAGE_COUNT = 200
MAX_ALLOWED_ORIGINS = 5
MAX_SEED_URLS = 50
MAX_BODY_BYTES = 5 * 1024 * 1024
MAX_TIMEOUT_SECONDS = 30.0
MAX_URL_LENGTH = 2048
CACHE_SCHEMA_VERSION = 2
MAX_ROBOTS_DELAY_SECONDS = 3600.0
DISALLOWED_PATH_PREFIXES = (
    "/api", "/account", "/user", "/login", "/signin", "/sign-in",
    "/admin", "/auth", "/checkout", "/booking",
)
PROPERTY_TYPES = {
    "Accommodation", "SingleFamilyResidence", "Apartment", "RealEstateListing",
    "HotelRoom", "Hotel", "VacationRental", "House", "Residence",
}


def _origin(url: str) -> str:
    """Return a normalized origin; reject ambiguous/non-web URLs and credentials."""
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise ValueError("URL must use HTTPS and include a hostname")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("URL credentials are not allowed")
    scheme = parsed.scheme.lower()
    host = parsed.hostname.encode("idna").decode("ascii").lower()
    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError("invalid URL port") from exc
    effective_port = port or (443 if scheme == "https" else 80)
    return f"{scheme}://{host}:{effective_port}"


def _clean_url(url: str) -> str:
    """Canonicalize a public page URL, dropping fragments and query parameters."""
    if len(url) > MAX_URL_LENGTH:
        raise ValueError("URL exceeds maximum length")
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme.lower() not in {"https", "http"} or not parsed.hostname:
        raise ValueError("URL must use HTTP(S) and include a hostname")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("URL credentials are not allowed")
    host = parsed.hostname.encode("idna").decode("ascii").lower()
    port = parsed.port
    netloc = host if port is None else f"{host}:{port}"
    path = parsed.path or "/"
    return urllib.parse.urlunsplit((parsed.scheme.lower(), netloc, path, "", ""))


def _path_allowed(url: str) -> bool:
    path = urllib.parse.urlsplit(url).path.lower()
    if "%" in path or any(segment in {".", ".."} for segment in path.split("/")):
        return False
    return not any(path.startswith(prefix) for prefix in DISALLOWED_PATH_PREFIXES)


def _scalar(value: Any) -> Optional[str]:
    if isinstance(value, (str, int, float)) and not isinstance(value, bool):
        cleaned = " ".join(str(value).split())
        return cleaned[:MAX_FIELD_LENGTH] or None
    return None


def _positive_int(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if 0 <= value <= 10000 else None
    if isinstance(value, float) and value.is_integer():
        return _positive_int(int(value))
    if isinstance(value, str) and re.fullmatch(r"\s*\d{1,5}\s*", value):
        parsed = int(value)
        return parsed if parsed <= 10000 else None
    return None


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Never follow a redirect; each destination must be an explicit reviewed seed."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        raise urllib.error.HTTPError(newurl, code, "redirect not followed", headers, fp)


class HTMLLinkAndJSONLDParser(html.parser.HTMLParser):
    """Extract anchor hrefs and JSON-LD blocks only; ignore every other script."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: List[str] = []
        self.jsonld_blocks: List[str] = []
        self._in_jsonld = False
        self._jsonld: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        tag = tag.lower()
        values = {key.lower(): (value or "") for key, value in attrs}
        if tag == "a" and values.get("href", "").strip():
            self.links.append(values["href"].strip())
        elif tag == "script" and values.get("type", "").strip().lower() == "application/ld+json":
            self._in_jsonld = True
            self._jsonld = []

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self._in_jsonld:
            block = "".join(self._jsonld).strip()
            if block:
                self.jsonld_blocks.append(block)
            self._jsonld = []
            self._in_jsonld = False

    def handle_data(self, data: str) -> None:
        if self._in_jsonld:
            self._jsonld.append(data)


class RobotsPolicy:
    """Small deterministic robots matcher with Allow tie-break and common rate hints."""

    def __init__(self, rules: Sequence[Tuple[str, str]], delay: float, request_rate: Optional[float]) -> None:
        self.rules = tuple(rules)
        self.delay = delay
        self.request_rate = request_rate

    @classmethod
    def parse(cls, text: str, user_agent: str) -> "RobotsPolicy":
        groups: List[Tuple[List[str], List[Tuple[str, str]], List[float], List[float]]] = []
        agents: List[str] = []
        rules: List[Tuple[str, str]] = []
        delays: List[float] = []
        request_rates: List[float] = []
        saw_directive = False

        def flush() -> None:
            nonlocal agents, rules, delays, request_rates, saw_directive
            if agents:
                groups.append((agents, rules, delays, request_rates))
            agents, rules, delays, request_rates, saw_directive = [], [], [], [], False

        for raw_line in text.splitlines():
            line = raw_line.split("#", 1)[0].strip()
            if not line or ":" not in line:
                continue
            key, value = (part.strip() for part in line.split(":", 1))
            key, value = key.lower(), value.strip()
            if key == "user-agent":
                if saw_directive:
                    flush()
                if not value:
                    raise ValueError("empty user-agent directive")
                agents.append(value.lower())
                continue
            if not agents:
                continue
            if key in {"allow", "disallow"}:
                if value:
                    rules.append((key, value))
                    saw_directive = True
            elif key == "crawl-delay":
                try:
                    delay = float(value)
                except ValueError as exc:
                    raise ValueError("invalid crawl-delay") from exc
                if not 0 <= delay <= MAX_ROBOTS_DELAY_SECONDS:
                    raise ValueError("crawl-delay outside supported bounds")
                delays.append(delay)
                saw_directive = True
            elif key == "request-rate":
                match = re.fullmatch(r"(\d+)\s*/\s*(\d+(?:\.\d+)?)", value)
                if not match or int(match.group(1)) <= 0 or float(match.group(2)) <= 0:
                    raise ValueError("invalid request-rate")
                interval = float(match.group(2)) / int(match.group(1))
                if interval > MAX_ROBOTS_DELAY_SECONDS:
                    raise ValueError("request-rate outside supported bounds")
                request_rates.append(interval)
                saw_directive = True
        flush()
        if not groups:
            raise ValueError("robots file has no user-agent group")

        agent = user_agent.lower()
        matched: List[Tuple[int, List[Tuple[str, str]], List[float], List[float]]] = []
        wildcard: List[Tuple[List[Tuple[str, str]], List[float], List[float]]] = []
        for group_agents, group_rules, group_delays, group_rates in groups:
            best = max((len(token) for token in group_agents if token != "*" and agent.startswith(token)), default=0)
            if best:
                matched.append((best, group_rules, group_delays, group_rates))
            elif "*" in group_agents:
                wildcard.append((group_rules, group_delays, group_rates))
        if matched:
            specificity = max(item[0] for item in matched)
            chosen = [(ruleset, delayset, rateset) for score, ruleset, delayset, rateset in matched if score == specificity]
        else:
            chosen = wildcard
        selected_rules = [rule for group_rules, _, _ in chosen for rule in group_rules]
        selected_delays = [delay for _, group_delays, _ in chosen for delay in group_delays]
        selected_rates = [rate for _, _, group_rates in chosen for rate in group_rates]
        return cls(selected_rules, max(selected_delays, default=0.0), max(selected_rates, default=0.0) or None)

    def can_fetch(self, url: str) -> bool:
        path = urllib.parse.urlsplit(url).path or "/"
        matches: List[Tuple[int, bool]] = []
        for directive, pattern in self.rules:
            end_anchor = pattern.endswith("$")
            expression = re.escape(pattern[:-1] if end_anchor else pattern).replace(r"\*", ".*")
            flags = 0
            if re.match("^" + expression + ("$" if end_anchor else ""), path, flags):
                specificity = len(pattern.rstrip("$").replace("*", ""))
                matches.append((specificity, directive == "allow"))
        if not matches:
            return True
        longest = max(length for length, _ in matches)
        return any(allowed for length, allowed in matches if length == longest)


class PublicListingCollector:
    """Sequential collector constrained to an explicit exact-origin allowlist."""

    def __init__(
        self,
        allowed_origins: Sequence[str],
        seed_urls: Sequence[str],
        cache_path: str,
        user_agent: str = "YellowPublicListingPrototype/0.1",
        timeout_seconds: float = 10.0,
        max_response_bytes: int = 2 * 1024 * 1024,
        max_pages: int = 50,
    ) -> None:
        if not allowed_origins:
            raise ValueError("at least one explicit allowed origin is required")
        if len(allowed_origins) > MAX_ALLOWED_ORIGINS:
            raise ValueError("allowlist is limited to 5 exact origins")
        if len(seed_urls) > MAX_SEED_URLS:
            raise ValueError("seed list is limited to 50 URLs")
        if not 0 < timeout_seconds <= MAX_TIMEOUT_SECONDS:
            raise ValueError("timeout must be positive and no more than 30 seconds")
        if not 0 < max_response_bytes <= MAX_BODY_BYTES:
            raise ValueError("response size must be positive and no more than 5 MiB")
        if not 0 < max_pages <= MAX_PAGE_COUNT:
            raise ValueError("page count must be between 1 and 200")
        normalized_origins = set()
        for value in allowed_origins:
            parsed_origin = urllib.parse.urlsplit(value)
            if parsed_origin.path not in ("", "/") or parsed_origin.query or parsed_origin.fragment:
                raise ValueError("allowlist entries must be exact origins, not paths or queries")
            normalized_origins.add(_origin(value))
        self.allowed_origins = frozenset(normalized_origins)
        seeds = []
        for value in seed_urls:
            canonical_seed = _clean_url(value)
            _origin(canonical_seed)  # Seeds must be HTTPS too; HTTP is never requested.
            seeds.append(canonical_seed)
        self.seed_urls = tuple(dict.fromkeys(seeds))
        self.cache_path = cache_path
        self.user_agent = user_agent.strip()
        self.timeout_seconds = timeout_seconds
        self.max_response_bytes = max_response_bytes
        self.max_pages = max_pages
        self.max_request_attempts = max_pages + len(self.allowed_origins)
        self.http_attempts = 0
        self.scope = {
            "allowed_origins": sorted(self.allowed_origins),
            "seed_urls": list(self.seed_urls),
            "timeout_seconds": timeout_seconds,
            "max_response_bytes": max_response_bytes,
            "max_pages": max_pages,
            "user_agent": self.user_agent,
        }
        self.stopped_origins: Set[str] = set()
        self.robots_checked_origins: Set[str] = set()
        self.robot_parsers: Dict[str, RobotsPolicy] = {}
        self.request_intervals: Dict[str, float] = {}
        self.last_request_at: Dict[str, float] = {}
        self.visited_urls: Set[str] = set()
        self.records: List[Dict[str, Any]] = []
        self.errors: List[Dict[str, str]] = []
        self.fetched_pages = 0
        self.cached_pages = 0
        self.cache_state: Dict[str, Any] = {"schema_version": CACHE_SCHEMA_VERSION, "scope": self.scope, "entries": {}}
        self._load_cache()

    def _allowed(self, url: str) -> bool:
        try:
            return _origin(url) in self.allowed_origins
        except ValueError:
            return False

    def _load_cache(self) -> None:
        if not os.path.exists(self.cache_path):
            return
        try:
            with open(self.cache_path, "r", encoding="utf-8") as cache_file:
                data = json.load(cache_file)
            if not isinstance(data, dict) or data.get("schema_version") != CACHE_SCHEMA_VERSION or not isinstance(data.get("entries"), dict):
                self.errors.append({"url": "cache", "error": "cache_schema_mismatch_reset"})
                return
            if data.get("scope") != self.scope:
                self.errors.append({"url": "cache", "error": "cache_scope_mismatch_reset"})
                return
            entries: Dict[str, Any] = {}
            for url, entry in data["entries"].items():
                if not isinstance(url, str) or not self._allowed(url) or not _path_allowed(url):
                    continue
                if not isinstance(entry, dict):
                    continue
                digest, fetched_at = entry.get("source_sha256"), entry.get("fetched_at")
                if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
                    continue
                if not isinstance(fetched_at, str) or not isinstance(entry.get("records"), list) or not isinstance(entry.get("links"), list):
                    continue
                if len(entry["records"]) > MAX_RECORDS_PER_PAGE or len(entry["links"]) > MAX_LINKS_PER_PAGE:
                    continue
                try:
                    if datetime.fromisoformat(fetched_at).tzinfo is None:
                        continue
                except ValueError:
                    continue
                # Cache only normalized facts and URLs; never retain an HTML response body.
                if any(not isinstance(row, dict) for row in entry["records"]) or any(not isinstance(link, str) for link in entry["links"]):
                    continue
                record_keys = {
                    "source_url", "id", "title", "locality", "property_type", "bedrooms",
                    "capacity", "public_coordinates", "location_precision", "source_sha256", "fetched_at",
                    "observation_kind", "availability_status",
                }
                safe_records = []
                for row in entry["records"]:
                    if set(row) != record_keys or row.get("source_url") != url:
                        continue
                    if row.get("source_sha256") != digest or row.get("fetched_at") != fetched_at:
                        continue
                    if any(value is not None and (not isinstance(value, str) or len(value) > MAX_FIELD_LENGTH)
                           for key, value in row.items() if key in {"id", "title", "locality", "property_type", "location_precision"}):
                        continue
                    if not isinstance(row.get("id"), str) or row.get("property_type") not in PROPERTY_TYPES:
                        continue
                    if row.get("location_precision") not in {"not_supplied", "public_point_unverified"}:
                        continue
                    if row.get("observation_kind") != "public_metadata_candidate" or row.get("availability_status") != "unknown":
                        continue
                    if any(value is not None and (not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 10000)
                           for value in (row.get("bedrooms"), row.get("capacity"))):
                        continue
                    coordinates = row.get("public_coordinates")
                    if coordinates is not None:
                        if not isinstance(coordinates, dict) or set(coordinates) != {"latitude", "longitude"}:
                            continue
                        if not all(isinstance(coordinates.get(key), (int, float)) and not isinstance(coordinates.get(key), bool)
                                   for key in ("latitude", "longitude")):
                            continue
                        if not (-90 <= coordinates["latitude"] <= 90 and -180 <= coordinates["longitude"] <= 180):
                            continue
                    safe_records.append(row)
                if len(safe_records) != len(entry["records"]):
                    continue
                safe_links = []
                for link in entry["links"][:MAX_LINKS_PER_PAGE]:
                    try:
                        safe_link = _clean_url(link)
                    except ValueError:
                        continue
                    if safe_link == link and self._allowed(link) and _path_allowed(link) and link not in safe_links:
                        safe_links.append(link)
                entries[url] = {"source_sha256": digest, "fetched_at": fetched_at, "records": safe_records, "links": safe_links}
            if len(entries) != len(data["entries"]):
                self.errors.append({"url": "cache", "error": "invalid_cache_entries_skipped"})
            self.cache_state = {"schema_version": CACHE_SCHEMA_VERSION, "scope": self.scope, "entries": entries}
        except (OSError, ValueError, TypeError):
            self.errors.append({"url": "cache", "error": "corrupt_cache_reset"})

    def _save_cache(self) -> None:
        parent = os.path.dirname(os.path.abspath(self.cache_path))
        os.makedirs(parent, exist_ok=True)
        temporary = self.cache_path + ".tmp"
        with open(temporary, "w", encoding="utf-8") as cache_file:
            json.dump(self.cache_state, cache_file, ensure_ascii=False, sort_keys=True)
        os.replace(temporary, self.cache_path)

    def _fetch_url(self, url: str, *, is_robots: bool = False) -> Tuple[int, Optional[bytes]]:
        try:
            canonical = _clean_url(url)
            origin = _origin(canonical)
        except ValueError:
            self.errors.append({"url": "invalid", "error": "invalid_url"})
            return 0, None
        if origin not in self.allowed_origins:
            self.errors.append({"url": canonical, "error": "origin_not_allowlisted"})
            return 0, None
        if origin in self.stopped_origins:
            return 0, None
        if self.http_attempts >= self.max_request_attempts:
            self.errors.append({"url": canonical, "error": "total_request_budget_exhausted"})
            return 0, None
        if not is_robots and (not _path_allowed(canonical) or not self._is_allowed_by_robots(canonical)):
            self.errors.append({"url": canonical, "error": "robots_or_path_denied"})
            return 0, None

        request = urllib.request.Request(
            canonical,
            headers={"User-Agent": self.user_agent, "Accept": "text/html,application/xhtml+xml"},
        )
        opener = urllib.request.build_opener(_NoRedirectHandler())
        try:
            self._wait_for_rate_limit(origin)
            self.http_attempts += 1
            with opener.open(request, timeout=self.timeout_seconds) as response:
                final_url = response.geturl()
                if (
                    not self._allowed(final_url)
                    or _origin(final_url) != origin
                    or urllib.parse.urlsplit(final_url).query
                    or urllib.parse.urlsplit(final_url).fragment
                    or _clean_url(final_url) != canonical
                ):
                    self.errors.append({"url": canonical, "error": "redirect_or_final_url_mismatch"})
                    return 0, None
                body = response.read(self.max_response_bytes + 1)
                if len(body) > self.max_response_bytes:
                    self.errors.append({"url": canonical, "error": "response_size_limit_exceeded"})
                    return 0, None
                return int(getattr(response, "status", 200)), body
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403, 429):
                self.stopped_origins.add(origin)
                self.errors.append({"url": canonical, "error": f"host_stopped_http_{exc.code}"})
            elif 300 <= exc.code < 400:
                self.errors.append({"url": canonical, "error": "redirect_not_followed"})
            else:
                self.errors.append({"url": canonical, "error": f"http_error_{exc.code}"})
            return exc.code, None
        except (OSError, TimeoutError, ValueError, urllib.error.URLError):
            self.errors.append({"url": canonical, "error": "fetch_failed"})
            return 0, None

    def _is_allowed_by_robots(self, url: str) -> bool:
        parser = self.robot_parsers.get(_origin(url))
        if parser is None:
            return False
        try:
            return parser.can_fetch(url)
        except Exception:
            return False

    def _wait_for_rate_limit(self, origin: str) -> None:
        interval = self.request_intervals.get(origin, 3.0)
        now = time.monotonic()
        previous = self.last_request_at.get(origin)
        if previous is not None:
            delay = interval - (now - previous)
            if delay > 0:
                time.sleep(delay)
        self.last_request_at[origin] = time.monotonic()

    def _load_robots(self, origin: str) -> bool:
        robots_url = origin + "/robots.txt"
        status, body = self._fetch_url(robots_url, is_robots=True)
        self.robots_checked_origins.add(origin)
        if status != 200 or body is None:
            self.errors.append({"url": robots_url, "error": "robots_unavailable_fail_closed"})
            self.stopped_origins.add(origin)
            return False
        try:
            parser = RobotsPolicy.parse(body.decode("utf-8"), self.user_agent)
            self.robot_parsers[origin] = parser
            self.request_intervals[origin] = max(3.0, parser.delay, parser.request_rate or 0.0)
            return True
        except (UnicodeDecodeError, ValueError):
            self.errors.append({"url": robots_url, "error": "robots_parse_failed_fail_closed"})
            self.stopped_origins.add(origin)
            return False

    def extract_metadata(self, html_text: str, source_url: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        parser = HTMLLinkAndJSONLDParser()
        try:
            parser.feed(html_text)
        except Exception:
            return [], []
        links: List[str] = []
        for href in parser.links[:MAX_LINKS_PER_PAGE]:
            try:
                target = _clean_url(urllib.parse.urljoin(source_url, href))
            except ValueError:
                continue
            if self._allowed(target) and _path_allowed(target) and target not in links:
                links.append(target)

        found: List[Dict[str, Any]] = []
        for block in parser.jsonld_blocks:
            try:
                decoded = json.loads(block)
            except (ValueError, TypeError):
                continue
            items = decoded if isinstance(decoded, list) else [decoded]
            for root in items:
                if isinstance(root, dict) and isinstance(root.get("@graph"), list):
                    items.extend(root["@graph"])
            for item in items:
                if not isinstance(item, dict):
                    continue
                raw_type = item.get("@type")
                types = raw_type if isinstance(raw_type, list) else [raw_type]
                property_type = next((kind for kind in types if isinstance(kind, str) and kind in PROPERTY_TYPES), None)
                if property_type is None:
                    continue
                address = item.get("address")
                locality_value = address.get("addressLocality") if isinstance(address, dict) else item.get("addressLocality")
                geo = item.get("geo") if isinstance(item.get("geo"), dict) else {}
                latitude = geo.get("latitude")
                longitude = geo.get("longitude")
                coordinates: Optional[Dict[str, float]] = None
                precision = "not_supplied"
                try:
                    lat = float(latitude)
                    lon = float(longitude)
                    if -90 <= lat <= 90 and -180 <= lon <= 180:
                        coordinates = {"latitude": lat, "longitude": lon}
                        precision = "exact_point_supplied"
                except (TypeError, ValueError):
                    pass
                title = _scalar(item.get("name"))
                identifier = self._entity_id(item.get("@id") or item.get("identifier") or item.get("url"), source_url, title)
                if identifier is None:
                    continue
                found.append({
                    "source_url": source_url,
                    "id": identifier,
                    "title": title,
                    "locality": _scalar(locality_value),
                    "property_type": property_type,
                    "bedrooms": _positive_int(item.get("numberOfBedrooms")),
                    "capacity": _positive_int(item.get("occupancy") or item.get("maximumAttendeeCapacity")),
                    "public_coordinates": coordinates,
                    "location_precision": "public_point_unverified" if coordinates is not None else precision,
                    "observation_kind": "public_metadata_candidate",
                    "availability_status": "unknown",
                })
                if len(found) >= MAX_RECORDS_PER_PAGE:
                    break
            if len(found) >= MAX_RECORDS_PER_PAGE:
                break
        return found, links

    @staticmethod
    def _entity_id(raw_identifier: Any, source_url: str, title: Optional[str]) -> Optional[str]:
        """Build a stable per-entity key without retaining query tokens or contact data."""
        identifier = _scalar(raw_identifier)
        normalized: Optional[str] = None
        if identifier:
            if re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", identifier) or re.fullmatch(r"\+?[\d\s().-]{7,}", identifier):
                identifier = None
            elif urllib.parse.urlsplit(identifier).scheme:
                if urllib.parse.urlsplit(identifier).scheme.lower() not in {"http", "https"}:
                    identifier = None
                else:
                    try:
                        normalized = _clean_url(identifier)
                    except ValueError:
                        normalized = None
            if identifier and normalized is None:
                if urllib.parse.urlsplit(identifier).scheme:
                    return None
                normalized = identifier.split("?", 1)[0].split("#", 1)[0][:MAX_FIELD_LENGTH] or None
        if normalized and title:
            return (normalized + "#title=" + urllib.parse.quote(title.casefold(), safe=""))[:MAX_FIELD_LENGTH]
        if normalized:
            return normalized[:MAX_FIELD_LENGTH]
        if title:
            return (source_url + "#title=" + urllib.parse.quote(title.casefold(), safe=""))[:MAX_FIELD_LENGTH]
        return None

    def run(self) -> Dict[str, Any]:
        queue: List[str] = []
        for seed in self.seed_urls:
            if self._allowed(seed) and _path_allowed(seed) and seed not in queue:
                queue.append(seed)
            else:
                self.errors.append({"url": "seed", "error": "seed_not_allowlisted_or_disallowed"})

        while queue and len(self.visited_urls) < self.max_pages:
            url = queue.pop(0)
            if url in self.visited_urls:
                continue
            origin = _origin(url)
            if origin in self.stopped_origins:
                continue
            if origin not in self.robots_checked_origins:
                self._load_robots(origin)
            if origin in self.stopped_origins:
                continue
            if not self._is_allowed_by_robots(url):
                self.errors.append({"url": url, "error": "robots_disallowed"})
                continue
            self.visited_urls.add(url)
            entry = self.cache_state["entries"].get(url)
            if entry is not None:
                records, links = entry["records"], entry["links"]
                self.cached_pages += 1
            else:
                status, body = self._fetch_url(url)
                if status != 200 or body is None:
                    continue
                digest = hashlib.sha256(body).hexdigest()
                fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
                try:
                    html_text = body.decode("utf-8")
                except UnicodeDecodeError:
                    self.errors.append({"url": url, "error": "page_not_utf8"})
                    continue
                records, links = self.extract_metadata(html_text, url)
                records = [dict(row, source_sha256=digest, fetched_at=fetched_at) for row in records]
                entry = {"source_sha256": digest, "fetched_at": fetched_at, "records": records, "links": links}
                self.cache_state["entries"][url] = entry
                self.fetched_pages += 1
                try:
                    self._save_cache()
                except OSError:
                    self.errors.append({"url": "cache", "error": "cache_checkpoint_failed"})
            self.records.extend(records)
            for link in links:
                if link not in self.visited_urls and link not in queue and len(queue) < MAX_LINKS_PER_PAGE:
                    queue.append(link)

        unique: List[Dict[str, Any]] = []
        seen: Set[Tuple[str, str]] = set()
        for record in self.records:
            key = (record["source_url"], record["id"])
            if key not in seen:
                seen.add(key)
                unique.append(record)
        return {
            "allowed_origins": sorted(self.allowed_origins),
            "total_visited": len(self.visited_urls),
            "http_attempts": self.http_attempts,
            "max_request_attempts": self.max_request_attempts,
            "fetched_pages": self.fetched_pages,
            "cached_pages": self.cached_pages,
            "records_extracted": len(unique),
            "records": unique,
            "errors": self.errors,
            "coverage_scope_note": "Observed public metadata from explicit seeds on allowlisted origins only; no whole-market coverage claim.",
        }


def main(argv: Optional[Sequence[str]] = None) -> int:
    """CLI entry point. Crawling occurs only after explicit reviewed arguments."""
    parser = argparse.ArgumentParser(description="Collect bounded public listing metadata from reviewed exact origins.")
    parser.add_argument("--origin", action="append", required=True, help="Exact HTTPS origin, e.g. https://example.com (max 5)")
    parser.add_argument("--seed", action="append", required=True, help="Explicit public HTTPS seed URL (repeatable, max 50)")
    parser.add_argument("--cache", required=True, help="Metadata-only JSON checkpoint path")
    parser.add_argument("--max-pages", type=int, default=50)
    parser.add_argument("--max-response-bytes", type=int, default=MAX_BODY_BYTES)
    parser.add_argument("--timeout-seconds", type=float, default=10.0)
    parser.add_argument("--output-data", required=True, help="New JSON report file; existing files are never overwritten")
    args = parser.parse_args(argv)
    try:
        collector = PublicListingCollector(
            allowed_origins=args.origin,
            seed_urls=args.seed,
            cache_path=args.cache,
            timeout_seconds=args.timeout_seconds,
            max_response_bytes=args.max_response_bytes,
            max_pages=args.max_pages,
        )
        destination = os.path.abspath(args.output_data)
        if os.path.exists(destination):
            parser.error("--output-data already exists; choose a new artifact path")
        if destination == os.path.abspath(args.cache):
            parser.error("--output-data and --cache must be different paths")
        report = collector.run()
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        temporary = destination + ".tmp"
        with open(temporary, "x", encoding="utf-8") as output_file:
            json.dump(report, output_file, ensure_ascii=False, indent=2, sort_keys=True)
        os.replace(temporary, destination)
        print(json.dumps(report, ensure_ascii=False, sort_keys=True))
        return 0
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
