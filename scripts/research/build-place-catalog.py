#!/usr/bin/env python3
"""Build Yellow's immutable public Overture Places catalog.

Large inputs must be newline-delimited JSON or Parquet. Parquet is read in bounded
batches, including from pinned official Azure HTTPS byte ranges. A completed database replaces
no existing file: callers must choose a new output path for every release build.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import os
import re
import sqlite3
import struct
import sys
import tempfile
import unicodedata
from dataclasses import dataclass
from collections import OrderedDict
from io import RawIOBase
from pathlib import Path
from typing import Any, Iterable, Iterator, Mapping, Sequence
from urllib.parse import SplitResult, quote, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


OVERTURE_RELEASE = "2026-08-19.0"
OVERTURE_SCHEMA_VERSION = "1.18.0"
CATALOG_FORMAT = "yellow.place-catalog/v1"
DEFAULT_BATCH_SIZE = 2_048
MAX_BBOX_SPAN_DEGREES = 5.0
MAX_REMOTE_SOURCE_BYTES = 100 * 1024 * 1024
REMOTE_BLOCK_BYTES = 8 * 1024 * 1024
REMOTE_CACHE_BLOCKS = 8
PLACE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
COUNTRY_CODE = re.compile(r"^[A-Z]{2}$")

# Overture category spelling has evolved. Keep the public lodging family explicit
# rather than admitting every place that happens to contain a hotel-like word.
LODGING_CATEGORIES = frozenset(
    {
        "hotel",
        "lodging",
        "private_lodging",
        "bed_and_breakfast",
        "resort",
        "motel",
        "hostel",
        "guest_house",
        "aparthotel",
        "apartment_hotel",
        "serviced_apartment",
        "vacation_rental",
        "holiday_apartment",
        "inn",
        "ryokan",
        "chalet",
        "campground",
        "camp_site",
        "camping",
        "glamping",
        "lodge",
        "cabin",
        "farmstay",
        "holiday_park",
        "capsule_hotel",
        "extended_stay_hotel",
        "boutique_hotel",
        "mountain_hut",
    }
)
# Exact public SourceItem fields from the pinned Overture schema v1.18.0,
# including its geometric-range scope. Unknown fields are rejected, not copied.
PUBLIC_SOURCE_STRING_FIELDS = frozenset(
    {"property", "dataset", "license", "record_id", "update_time", "provider", "resource", "version"}
)
PUBLIC_SOURCE_FIELDS = PUBLIC_SOURCE_STRING_FIELDS | {"confidence", "between"}
# Match ECMAScript whitespace explicitly; Python str.split() has a different set.
KEYWORD_WHITESPACE = re.compile(r"[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+")


class CatalogBuildError(RuntimeError):
    pass


@dataclass(frozen=True)
class Bounds:
    west: float
    south: float
    east: float
    north: float

    def contains(self, longitude: float, latitude: float) -> bool:
        longitude_matches = (
            self.west <= longitude <= self.east
            if self.west <= self.east
            else longitude >= self.west or longitude <= self.east
        )
        return longitude_matches and self.south <= latitude <= self.north

    def as_dict(self) -> dict[str, float]:
        return {"west": self.west, "south": self.south, "east": self.east, "north": self.north}


def parse_bounds(value: str) -> Bounds:
    try:
        west, south, east, north = (float(part) for part in value.split(","))
    except (TypeError, ValueError) as error:
        raise argparse.ArgumentTypeError("bbox must be west,south,east,north") from error
    values = (west, south, east, north)
    if not all(math.isfinite(item) for item in values):
        raise argparse.ArgumentTypeError("bbox coordinates must be finite")
    if not (-180 <= west <= 180 and -180 <= east <= 180 and -90 <= south <= 90 and -90 <= north <= 90):
        raise argparse.ArgumentTypeError("bbox coordinates are outside WGS84 bounds")
    if south >= north:
        raise argparse.ArgumentTypeError("bbox south must be less than north")
    longitude_span = east - west if west <= east else 180 - west + east + 180
    if longitude_span <= 0 or longitude_span > MAX_BBOX_SPAN_DEGREES or north - south > MAX_BBOX_SPAN_DEGREES:
        raise argparse.ArgumentTypeError(
            f"bbox spans must be positive and no more than {MAX_BBOX_SPAN_DEGREES:g} degrees"
        )
    return Bounds(west, south, east, north)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def public_json(value: Any, field: str) -> Any:
    """Validate that upstream provenance is losslessly JSON-safe."""
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise CatalogBuildError(f"{field} contains a non-finite number")
        return value
    if isinstance(value, bytes):
        return {"encoding": "base64", "value": base64.b64encode(value).decode("ascii")}
    if isinstance(value, Mapping):
        result: dict[str, Any] = {}
        for key, child in value.items():
            if not isinstance(key, str):
                raise CatalogBuildError(f"{field} contains a non-string object key")
            result[key] = public_json(child, field)
        return result
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [public_json(child, field) for child in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    raise CatalogBuildError(f"{field} contains unsupported {type(value).__name__} data")


def assert_public_provenance(value: Mapping[str, Any], path: str = "sources") -> None:
    if not isinstance(value.get("property"), str) or not isinstance(value.get("dataset"), str):
        raise CatalogBuildError(f"{path} must declare public property and dataset strings")
    for key, child in value.items():
        if not isinstance(key, str) or key not in PUBLIC_SOURCE_FIELDS:
            raise CatalogBuildError(f"{path} contains an unsupported public source field")
        if child is None:
            continue
        if key in PUBLIC_SOURCE_STRING_FIELDS:
            if not isinstance(child, str) or len(child) > 4096:
                raise CatalogBuildError(f"{path}.{key} must be a bounded public string")
        elif key == "confidence":
            if isinstance(child, bool) or not isinstance(child, (int, float)) or not math.isfinite(child) or not 0 <= child <= 1:
                raise CatalogBuildError(f"{path}.confidence must be between zero and one")
        elif key == "between":
            if not isinstance(child, (list, tuple)) or len(child) != 2 or any(
                isinstance(item, bool) or not isinstance(item, (int, float)) or not math.isfinite(item)
                for item in child
            ) or not 0 <= child[0] < child[1] <= 1:
                raise CatalogBuildError(f"{path}.between must be a public numeric range")


def normalized_text(value: str) -> str:
    # Runtime queries use the same default Unicode lowercase, not casefold.
    return KEYWORD_WHITESPACE.sub(" ", unicodedata.normalize("NFKC", value).lower()).strip(" ")


def normalize_category(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = re.sub(r"[^a-z0-9]+", "_", value.strip().casefold()).strip("_")
    return normalized or None


def category_from(record: Mapping[str, Any]) -> str | None:
    categories = record.get("categories")
    candidates: list[Any] = []
    if isinstance(categories, Mapping):
        candidates.append(categories.get("primary"))
        alternates = categories.get("alternate") or categories.get("alternates")
        if isinstance(alternates, Sequence) and not isinstance(alternates, (str, bytes)):
            candidates.extend(alternates)
    elif isinstance(categories, Sequence) and not isinstance(categories, (str, bytes)):
        candidates.extend(categories)
    else:
        candidates.extend((record.get("category"), categories))
    candidates.append(record.get("basic_category"))
    taxonomy = record.get("taxonomy")
    if isinstance(taxonomy, Mapping):
        candidates.append(taxonomy.get("primary"))
        for key in ("hierarchy", "alternates"):
            values = taxonomy.get(key)
            if isinstance(values, Sequence) and not isinstance(values, (str, bytes)):
                candidates.extend(values)
    normalized = [category for value in candidates if (category := normalize_category(value))]
    return next((category for category in normalized if category in LODGING_CATEGORIES), normalized[0] if normalized else None)


def name_from(record: Mapping[str, Any]) -> str:
    names = record.get("names")
    value: Any = names.get("primary") if isinstance(names, Mapping) else record.get("name", names)
    if not isinstance(value, str) or not value.strip():
        raise CatalogBuildError("place name is missing or empty")
    value = unicodedata.normalize("NFC", value.strip())
    if len(value) > 1_000:
        raise CatalogBuildError("place name exceeds 1000 characters")
    return value


def point_from_wkb(value: bytes) -> tuple[float, float]:
    if len(value) < 21:
        raise CatalogBuildError("geometry WKB is truncated")
    byte_order = value[0]
    if byte_order not in (0, 1):
        raise CatalogBuildError("geometry WKB has an invalid byte order")
    endian = "<" if byte_order == 1 else ">"
    geometry_type = struct.unpack_from(f"{endian}I", value, 1)[0]
    offset = 5
    has_srid = bool(geometry_type & 0x20000000)
    base_type = geometry_type & 0x0FFFFFFF
    if has_srid:
        offset += 4
    if base_type >= 1000:
        base_type %= 1000
    if base_type != 1 or len(value) < offset + 16:
        raise CatalogBuildError("geometry must be a WGS84 Point")
    return struct.unpack_from(f"{endian}dd", value, offset)


def coordinates_from(record: Mapping[str, Any]) -> tuple[float, float]:
    geometry = record.get("geometry")
    longitude: Any
    latitude: Any
    if isinstance(geometry, (bytes, bytearray, memoryview)):
        longitude, latitude = point_from_wkb(bytes(geometry))
    elif isinstance(geometry, Mapping):
        coordinates = geometry.get("coordinates")
        if geometry.get("type") != "Point" or not isinstance(coordinates, Sequence) or len(coordinates) < 2:
            raise CatalogBuildError("geometry must be a GeoJSON Point")
        longitude, latitude = coordinates[0], coordinates[1]
    else:
        longitude, latitude = record.get("longitude"), record.get("latitude")
    if isinstance(longitude, bool) or isinstance(latitude, bool):
        raise CatalogBuildError("coordinates must be numbers")
    try:
        longitude, latitude = float(longitude), float(latitude)
    except (TypeError, ValueError) as error:
        raise CatalogBuildError("coordinates are missing or malformed") from error
    if not math.isfinite(longitude) or not math.isfinite(latitude):
        raise CatalogBuildError("coordinates must be finite")
    if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
        raise CatalogBuildError("coordinates are outside WGS84 bounds")
    return longitude, latitude


def normalize_url(value: Any) -> tuple[str, str] | None:
    if not isinstance(value, str) or not value.strip() or len(value) > 4_096:
        return None
    try:
        parts = urlsplit(value.strip())
        if parts.scheme.casefold() not in {"http", "https"} or not parts.hostname:
            return None
        if parts.username is not None or parts.password is not None:
            return None
        if any(ord(character) < 32 or ord(character) == 127 for character in value):
            return None
        host = parts.hostname.rstrip(".").encode("idna").decode("ascii").casefold()
        if not host or len(host) > 253 or any(not label or len(label) > 63 for label in host.split(".")):
            return None
        port = parts.port
        if port == (80 if parts.scheme.casefold() == "http" else 443):
            port = None
        netloc = f"[{host}]" if ":" in host else host
        if port is not None:
            netloc += f":{port}"
        path = quote(parts.path or "/", safe="/%:@!$&'()*+,;=-._~")
        query = quote(parts.query, safe="=&?/:@!$'()*+,;%-._~")
        normalized = urlunsplit(SplitResult(parts.scheme.casefold(), netloc, path, query, ""))
        return normalized, host
    except (UnicodeError, ValueError):
        return None


def websites_from(record: Mapping[str, Any], counters: dict[str, int]) -> list[dict[str, str]]:
    raw = record.get("websites")
    if raw is None:
        raw = record.get("website")
    values = raw if isinstance(raw, Sequence) and not isinstance(raw, (str, bytes)) else [raw]
    websites: dict[str, dict[str, str]] = {}
    for value in values:
        if value is None:
            continue
        normalized = normalize_url(value)
        if normalized is None:
            counters["unsafe_urls_skipped"] += 1
            continue
        url, domain = normalized
        websites[url] = {"url": url, "domain": domain}
    return [websites[url] for url in sorted(websites)]


def address_from(record: Mapping[str, Any]) -> dict[str, str | None] | None:
    raw = record.get("addresses", record.get("address"))
    if isinstance(raw, Sequence) and not isinstance(raw, (str, bytes)):
        raw = raw[0] if raw else None
    if isinstance(raw, str):
        raw = {"freeform": raw}
    if not isinstance(raw, Mapping):
        return None
    address = {
        "freeform": raw.get("freeform"),
        "locality": raw.get("locality"),
        "region": raw.get("region"),
        "postcode": raw.get("postcode"),
        "country": raw.get("country"),
    }
    for key, value in address.items():
        if value is not None and not isinstance(value, str):
            raise CatalogBuildError(f"address.{key} must be a string or null")
        if isinstance(value, str) and len(value) > 1_000:
            raise CatalogBuildError(f"address.{key} exceeds 1000 characters")
    return address if any(value for value in address.values()) else None


def brand_from(record: Mapping[str, Any]) -> dict[str, str | None] | None:
    raw = record.get("brand", record.get("brands"))
    if isinstance(raw, Sequence) and not isinstance(raw, (str, bytes)):
        raw = raw[0] if raw else None
    if isinstance(raw, str):
        return {"name": raw, "id": None}
    if not isinstance(raw, Mapping):
        return None
    names = raw.get("names")
    name = names.get("primary") if isinstance(names, Mapping) else raw.get("name")
    identifier = raw.get("id")
    if name is not None and not isinstance(name, str):
        raise CatalogBuildError("brand name must be a string or null")
    if identifier is not None and not isinstance(identifier, str):
        raise CatalogBuildError("brand id must be a string or null")
    return {"name": name, "id": identifier} if name or identifier else None


def normalized_status(value: Any) -> str:
    if value is None:
        return "unknown"
    if not isinstance(value, str):
        raise CatalogBuildError("operating status must be a string or null")
    status = normalize_category(value)
    aliases = {"active": "open", "closed_temporarily": "temporarily_closed", "closed_permanently": "permanently_closed"}
    status = aliases.get(status or "", status)
    if status not in {"open", "temporarily_closed", "permanently_closed", "unknown"}:
        raise CatalogBuildError(f"unsupported operating status: {value}")
    return status


def normalized_record(record: Mapping[str, Any], counters: dict[str, int]) -> dict[str, Any] | None:
    identifier = record.get("id")
    if not isinstance(identifier, str) or not PLACE_ID.fullmatch(identifier):
        raise CatalogBuildError("place id is missing or invalid")
    category = category_from(record)
    if category not in LODGING_CATEGORIES:
        counters["non_lodging_skipped"] += 1
        return None
    name = name_from(record)
    longitude, latitude = coordinates_from(record)
    confidence = record.get("confidence")
    if confidence is not None:
        if isinstance(confidence, bool) or not isinstance(confidence, (int, float)):
            raise CatalogBuildError("confidence must be a number or null")
        confidence = float(confidence)
        if not math.isfinite(confidence) or not 0 <= confidence <= 1:
            raise CatalogBuildError("confidence must be between zero and one")
    address = address_from(record)
    sources = record.get("sources")
    if sources is None:
        sources = []
    if not isinstance(sources, Sequence) or isinstance(sources, (str, bytes)):
        raise CatalogBuildError("sources must be an array")
    if any(not isinstance(source, Mapping) for source in sources):
        raise CatalogBuildError("each contributor source must be an object")
    safe_sources = [public_json(source, "sources") for source in sources]
    for source in safe_sources:
        assert_public_provenance(source)
    country = address.get("country") if address else record.get("country")
    if country is not None and not isinstance(country, str):
        raise CatalogBuildError("country must be a string or null")
    if isinstance(country, str):
        country = country.strip().upper()
        if not COUNTRY_CODE.fullmatch(country):
            raise CatalogBuildError("country must be a two-letter ISO 3166-1 alpha-2 code")
        if address is not None:
            address["country"] = country
    return {
        "id": identifier,
        "name": name,
        "longitude": longitude,
        "latitude": latitude,
        "category": category,
        "status": normalized_status(record.get("operating_status", record.get("status"))),
        "address": address,
        "country": country,
        "websites": websites_from(record, counters),
        "brand": brand_from(record),
        "confidence": confidence,
        "sources": safe_sources,
    }


def winner_key(record: Mapping[str, Any]) -> tuple[float, int, str]:
    completeness = sum(record.get(field) not in (None, "", [], {}) for field in ("address", "country", "brand", "websites"))
    scalar = {key: value for key, value in record.items() if key not in {"sources", "websites"}}
    return (record.get("confidence") if record.get("confidence") is not None else -1.0, completeness, canonical_json(scalar))


SCHEMA_SQL = """
PRAGMA application_id = 1497380432;
PRAGMA user_version = 1;
CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE places (
  rowid INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_search TEXT NOT NULL,
  longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
  latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('open','temporarily_closed','permanently_closed','unknown')),
  address_json TEXT,
  country TEXT,
  websites_json TEXT NOT NULL,
  brand_json TEXT,
  confidence REAL CHECK(confidence IS NULL OR confidence BETWEEN 0 AND 1),
  sources_json TEXT NOT NULL,
  winner_key TEXT NOT NULL
);
CREATE INDEX places_name_prefix_idx ON places(name_search, id);
CREATE INDEX places_id_idx ON places(id);
CREATE VIRTUAL TABLE place_rtree USING rtree(id, min_lon, max_lon, min_lat, max_lat);
CREATE TABLE websites (
  place_rowid INTEGER NOT NULL REFERENCES places(rowid),
  normalized_url TEXT NOT NULL,
  normalized_domain TEXT NOT NULL,
  PRIMARY KEY(place_rowid, normalized_url)
) WITHOUT ROWID;
CREATE INDEX websites_url_idx ON websites(normalized_url, place_rowid);
CREATE INDEX websites_domain_idx ON websites(normalized_domain, place_rowid);
"""


def source_descriptor(locator: str) -> dict[str, Any]:
    path = Path(locator)
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            size += len(chunk)
            digest.update(chunk)
    descriptor: dict[str, Any] = {"kind": "local", "locator": path.name, "bytes": size, "sha256": digest.hexdigest()}
    if locator.casefold().endswith((".parquet", ".parq")):
        try:
            import pyarrow.parquet as parquet
            metadata = parquet.read_metadata(path).metadata or {}
            verify_parquet_metadata(metadata, path.name, require_declaration=True)
            allowed = {
                b"overture_release": "release",
                b"overture:release": "release",
                b"overture_schema_version": "schemaVersion",
                b"overture:schema_version": "schemaVersion",
                b"yellow_source_asset": "sourceAsset",
                b"yellow_source_asset_etag": "sourceAssetEtag",
                b"yellow_source_asset_bytes": "sourceAssetBytes",
                b"yellow_range_bytes_transferred": "rangeBytesTransferred",
                b"yellow_sample_bbox": "sampleBbox",
                b"yellow_sample_rows": "sampleRows",
                b"yellow_stac_item": "stacItem",
            }
            upstream = {allowed[key.lower()]: value.decode("utf-8") for key, value in metadata.items() if key.lower() in allowed}
            if upstream:
                descriptor["upstream"] = upstream
        except ImportError as error:
            raise CatalogBuildError("PyArrow 25.0.x is required for Parquet input") from error
    return descriptor


class RejectRedirects(HTTPRedirectHandler):
    def redirect_request(self, request: Any, file_pointer: Any, code: int, message: str, headers: Any, new_url: str) -> None:
        return None


OFFICIAL_URL_OPENER = build_opener(RejectRedirects())


def open_official(request: Request) -> Any:
    # build_opener retains the environment's normal ProxyHandler while the custom
    # redirect handler prevents an allowlisted URL from hopping to another host.
    return OFFICIAL_URL_OPENER.open(request, timeout=30)


def strong_etag(value: str) -> tuple[str, str]:
    header = value.strip()
    if not header or header.startswith("W/") or len(header) > 256:
        raise CatalogBuildError("official Azure source requires a bounded strong ETag")
    if '"' in header and not (header.startswith('"') and header.endswith('"') and header.count('"') == 2):
        raise CatalogBuildError("official Azure source returned an invalid ETag")
    normalized = header[1:-1] if header.startswith('"') else header
    if not normalized or any(ord(character) < 33 or ord(character) > 126 or character in {'"', "\\"} for character in normalized):
        raise CatalogBuildError("official Azure source returned an invalid ETag")
    return normalized, header


def validate_official_azure_url(locator: str) -> None:
    parsed = urlsplit(locator)
    expected_prefix = f"/release/{OVERTURE_RELEASE}/theme=places/type=place/"
    filename = parsed.path.removeprefix(expected_prefix)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "overturemapswestus2.blob.core.windows.net"
        or parsed.username is not None
        or parsed.password is not None
        or parsed.port is not None
        or parsed.query
        or parsed.fragment
        or not parsed.path.startswith(expected_prefix)
        or re.fullmatch(r"part-[A-Za-z0-9-]+\.zstd\.parquet", filename) is None
    ):
        raise CatalogBuildError("remote input must be an exact pinned official Overture Azure Places Parquet URL")


def inspect_official_azure_source(locator: str, expected_etag: str) -> tuple[dict[str, Any], dict[str, Any]]:
    validate_official_azure_url(locator)
    if not expected_etag or len(expected_etag) > 256:
        raise CatalogBuildError("--expected-etag is required for official Azure input")
    expected_normalized, _ = strong_etag(expected_etag)
    with open_official(Request(locator, method="HEAD", headers={"Accept-Encoding": "identity"})) as response:
        if response.status != 200:
            raise CatalogBuildError(f"official Azure metadata request returned HTTP {response.status}")
        try:
            size = int(response.headers["Content-Length"])
        except (TypeError, ValueError) as error:
            raise CatalogBuildError("official Azure source omitted a valid Content-Length") from error
        etag, etag_header = strong_etag(response.headers.get("ETag", ""))
    if size < 12:
        raise CatalogBuildError("official Azure source is too small to be a Parquet object")
    if etag != expected_normalized:
        raise CatalogBuildError(f"official Azure ETag mismatch: expected {expected_normalized}, received {etag}")
    descriptor: dict[str, Any] = {
        "kind": "official-azure-range",
        "locator": locator,
        "bytes": size,
        "etag": etag,
        "sha256": None,
        "rangeBytesTransferred": 0,
        "peakRangeCacheBytes": 0,
    }
    return descriptor, {"size": size, "etag": etag, "etag_header": etag_header, "descriptor": descriptor}


class OfficialAzureRangeFile(RawIOBase):
    def __init__(self, locator: str, size: int, etag: str, etag_header: str, descriptor: dict[str, Any]):
        self.locator = locator
        self.size = size
        self.etag = etag
        self.etag_header = etag_header
        self.descriptor = descriptor
        self.position = 0
        self.transferred = 0
        self.cache: OrderedDict[int, bytes] = OrderedDict()

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.position

    def seek(self, offset: int, whence: int = 0) -> int:
        if whence == 0:
            position = offset
        elif whence == 1:
            position = self.position + offset
        elif whence == 2:
            position = self.size + offset
        else:
            raise ValueError("invalid seek mode")
        if position < 0:
            raise ValueError("negative seek position")
        self.position = position
        return position

    def _block(self, index: int) -> bytes:
        cached = self.cache.pop(index, None)
        if cached is not None:
            self.cache[index] = cached
            return cached
        start = index * REMOTE_BLOCK_BYTES
        end = min(self.size, start + REMOTE_BLOCK_BYTES) - 1
        requested = end - start + 1
        if self.transferred + requested > MAX_REMOTE_SOURCE_BYTES:
            raise CatalogBuildError(f"official Azure range reads exceeded the {MAX_REMOTE_SOURCE_BYTES}-byte cap")
        request = Request(
            self.locator,
            headers={"Range": f"bytes={start}-{end}", "Accept-Encoding": "identity", "If-Match": self.etag_header},
        )
        with open_official(request) as response:
            if response.status != 206:
                raise CatalogBuildError(f"official Azure range request returned HTTP {response.status}, expected 206")
            response_etag, _ = strong_etag(response.headers.get("ETag", ""))
            if response_etag != self.etag:
                raise CatalogBuildError("official Azure object changed during range reads")
            if response.headers.get("Content-Range") != f"bytes {start}-{end}/{self.size}":
                raise CatalogBuildError("official Azure returned a mismatched Content-Range")
            try:
                content_length = int(response.headers["Content-Length"])
            except (TypeError, ValueError) as error:
                raise CatalogBuildError("official Azure range omitted a valid Content-Length") from error
            if content_length != requested:
                raise CatalogBuildError("official Azure range returned a mismatched Content-Length")
            data = response.read(requested)
        if len(data) != requested:
            raise CatalogBuildError("official Azure returned a truncated byte range")
        self.transferred += len(data)
        self.cache[index] = data
        while len(self.cache) > REMOTE_CACHE_BLOCKS:
            self.cache.popitem(last=False)
        self.descriptor["rangeBytesTransferred"] = self.transferred
        self.descriptor["peakRangeCacheBytes"] = max(
            int(self.descriptor["peakRangeCacheBytes"]), sum(len(value) for value in self.cache.values())
        )
        return data

    def read(self, size: int = -1) -> bytes:
        if size < 0:
            size = self.size - self.position
        if size == 0 or self.position >= self.size:
            return b""
        end = min(self.size, self.position + size)
        chunks: list[bytes] = []
        while self.position < end:
            block = self._block(self.position // REMOTE_BLOCK_BYTES)
            within = self.position % REMOTE_BLOCK_BYTES
            take = min(end - self.position, len(block) - within)
            chunks.append(block[within : within + take])
            self.position += take
        return b"".join(chunks)


def bbox_row_groups(source: Any, bounds: Bounds) -> list[int]:
    paths = {source.metadata.schema.column(index).path: index for index in range(source.metadata.num_columns)}
    required = ("bbox.xmin", "bbox.xmax", "bbox.ymin", "bbox.ymax")
    if any(path not in paths for path in required):
        raise CatalogBuildError("remote Parquet lacks bbox statistics columns required for bounded range reads")
    groups: list[int] = []
    for index in range(source.metadata.num_row_groups):
        group = source.metadata.row_group(index)
        statistics = {path: group.column(paths[path]).statistics for path in required}
        if any(value is None or not value.has_min_max for value in statistics.values()):
            raise CatalogBuildError("remote Parquet lacks bbox min/max statistics required for bounded range reads")
        west_matches = (
            statistics["bbox.xmax"].max >= bounds.west and statistics["bbox.xmin"].min <= bounds.east
            if bounds.west <= bounds.east
            else statistics["bbox.xmax"].max >= bounds.west or statistics["bbox.xmin"].min <= bounds.east
        )
        if west_matches and statistics["bbox.ymax"].max >= bounds.south and statistics["bbox.ymin"].min <= bounds.north:
            groups.append(index)
    return groups


def verify_parquet_metadata(metadata: Mapping[bytes, bytes] | None, locator: str, *, require_declaration: bool = False) -> None:
    # Retain duplicate/case-variant declarations until each is checked; folding
    # them into a dict first could silently discard a conflicting release.
    decoded = [(key.decode("utf-8", "strict").lower(), value.decode("utf-8", "strict")) for key, value in (metadata or {}).items()]
    for keys, expected, label in (
        (("overture_release", "overture:release"), OVERTURE_RELEASE, "Overture release"),
        (("overture_schema_version", "overture:schema_version"), OVERTURE_SCHEMA_VERSION, "schema"),
    ):
        declarations = [value for key, value in decoded if key in keys]
        if require_declaration and not declarations:
            raise CatalogBuildError(f"{locator} must declare its {label} in Parquet metadata")
        if any(value != expected for value in declarations):
            raise CatalogBuildError(f"{locator} declares a conflicting {label}; expected {expected}")


def parquet_rows(
    locator: str,
    batch_size: int,
    bounds: Bounds | None,
    remote_context: Mapping[str, Any] | None = None,
) -> Iterator[Mapping[str, Any]]:
    try:
        import pyarrow
        import pyarrow.parquet as parquet
    except ImportError as error:
        raise CatalogBuildError("PyArrow 25.0.x is required for Parquet input") from error
    if not pyarrow.__version__.startswith("25.0."):
        raise CatalogBuildError(f"PyArrow 25.0.x is required, found {pyarrow.__version__}")
    if remote_context is not None:
        if bounds is None:
            raise CatalogBuildError("--bbox is required for official Azure range input")
        opened: Any = OfficialAzureRangeFile(
            locator,
            int(remote_context["size"]),
            str(remote_context["etag"]),
            str(remote_context["etag_header"]),
            remote_context["descriptor"],
        )
    else:
        opened = locator
    try:
        source = parquet.ParquetFile(opened)
        verify_parquet_metadata(source.metadata.metadata, locator, require_declaration=remote_context is None)
        required = {"id", "geometry", "names"}
        missing = required.difference(source.schema_arrow.names)
        if missing:
            raise CatalogBuildError(f"{locator} is missing required columns: {', '.join(sorted(missing))}")
        if not {"categories", "basic_category", "taxonomy"}.intersection(source.schema_arrow.names):
            raise CatalogBuildError(f"{locator} is missing categories, basic_category, and taxonomy")
        wanted = [column for column in ("id", "geometry", "names", "categories", "basic_category", "taxonomy", "confidence", "websites", "brand", "brands", "addresses", "sources", "operating_status", "overture_release", "overture_schema_version") if column in source.schema_arrow.names]
        row_groups = bbox_row_groups(source, bounds) if remote_context is not None else None
        for batch in source.iter_batches(batch_size=batch_size, row_groups=row_groups, columns=wanted, use_threads=False):
            yield from batch.to_pylist()
    finally:
        if remote_context is not None:
            opened.close()


def json_rows(locator: str) -> Iterator[Mapping[str, Any]]:
    with Path(locator).open("r", encoding="utf-8") as source:
        for line_number, line in enumerate(source, 1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise CatalogBuildError(f"{locator}:{line_number}: malformed NDJSON: {error.msg}") from error
            if not isinstance(value, Mapping):
                raise CatalogBuildError(f"{locator}:{line_number}: each NDJSON line must be an object")
            yield value


def input_rows(
    locator: str,
    batch_size: int,
    bounds: Bounds | None,
    remote_context: Mapping[str, Any] | None = None,
) -> Iterator[Mapping[str, Any]]:
    if locator.casefold().endswith((".parquet", ".parq")):
        yield from parquet_rows(locator, batch_size, bounds, remote_context)
    else:
        yield from json_rows(locator)


def merge_unique(first: Sequence[Any], second: Sequence[Any]) -> list[Any]:
    values = {canonical_json(value): value for value in [*first, *second]}
    return [values[key] for key in sorted(values)]


def store_record(connection: sqlite3.Connection, record: dict[str, Any], counters: dict[str, int]) -> None:
    existing_row = connection.execute(
        "SELECT rowid,name,longitude,latitude,category,status,address_json,country,websites_json,brand_json,confidence,sources_json,winner_key FROM places WHERE id=?",
        (record["id"],),
    ).fetchone()
    if existing_row is None:
        cursor = connection.execute(
            "INSERT INTO places(id,name,name_search,longitude,latitude,category,status,address_json,country,websites_json,brand_json,confidence,sources_json,winner_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                record["id"], record["name"], normalized_text(record["name"]), record["longitude"], record["latitude"],
                record["category"], record["status"], canonical_json(record["address"]) if record["address"] else None,
                record["country"], canonical_json([item["url"] for item in record["websites"]]),
                canonical_json(record["brand"]) if record["brand"] else None, record["confidence"],
                canonical_json(record["sources"]), canonical_json(winner_key(record)),
            ),
        )
        rowid = cursor.lastrowid
        assert rowid is not None
        connection.execute("INSERT INTO place_rtree VALUES(?,?,?,?,?)", (rowid, record["longitude"], record["longitude"], record["latitude"], record["latitude"]))
        for website in record["websites"]:
            connection.execute("INSERT INTO websites VALUES(?,?,?)", (rowid, website["url"], website["domain"]))
        counters["places_inserted"] += 1
        return

    counters["duplicates_merged"] += 1
    rowid = existing_row[0]
    existing = {
        "id": record["id"], "name": existing_row[1], "longitude": existing_row[2], "latitude": existing_row[3],
        "category": existing_row[4], "status": existing_row[5], "address": json.loads(existing_row[6]) if existing_row[6] else None,
        "country": existing_row[7], "websites": [{"url": row[0], "domain": row[1]} for row in connection.execute("SELECT normalized_url,normalized_domain FROM websites WHERE place_rowid=?", (rowid,))],
        "brand": json.loads(existing_row[9]) if existing_row[9] else None, "confidence": existing_row[10],
        "sources": json.loads(existing_row[11]),
    }
    chosen = record if winner_key(record) > winner_key(existing) else existing
    chosen = dict(chosen)
    chosen["sources"] = merge_unique(existing["sources"], record["sources"])
    combined_websites = merge_unique(existing["websites"], record["websites"])
    chosen["websites"] = combined_websites
    connection.execute(
        "UPDATE places SET name=?,name_search=?,longitude=?,latitude=?,category=?,status=?,address_json=?,country=?,websites_json=?,brand_json=?,confidence=?,sources_json=?,winner_key=? WHERE rowid=?",
        (
            chosen["name"], normalized_text(chosen["name"]), chosen["longitude"], chosen["latitude"], chosen["category"], chosen["status"],
            canonical_json(chosen["address"]) if chosen["address"] else None, chosen["country"],
            canonical_json([item["url"] for item in combined_websites]), canonical_json(chosen["brand"]) if chosen["brand"] else None,
            chosen["confidence"], canonical_json(chosen["sources"]), canonical_json(winner_key(chosen)), rowid,
        ),
    )
    connection.execute("UPDATE place_rtree SET min_lon=?,max_lon=?,min_lat=?,max_lat=? WHERE id=?", (chosen["longitude"], chosen["longitude"], chosen["latitude"], chosen["latitude"], rowid))
    connection.execute("DELETE FROM websites WHERE place_rowid=?", (rowid,))
    for website in combined_websites:
        connection.execute("INSERT INTO websites VALUES(?,?,?)", (rowid, website["url"], website["domain"]))


def build_catalog(
    inputs: Sequence[str],
    output: Path,
    bounds: Bounds | None,
    batch_size: int,
    expected_etag: str | None = None,
) -> dict[str, Any]:
    if not inputs:
        raise CatalogBuildError("at least one input is required")
    if output.exists() or output.is_symlink():
        raise CatalogBuildError(f"refusing to overwrite existing output: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    remote_inputs = [locator for locator in inputs if locator.startswith("https://")]
    if len(remote_inputs) > 1:
        raise CatalogBuildError("only one official Azure range input is allowed per bounded build")
    if remote_inputs and (bounds is None or expected_etag is None):
        raise CatalogBuildError("official Azure range input requires --bbox and --expected-etag")
    if expected_etag is not None and not remote_inputs:
        raise CatalogBuildError("--expected-etag applies only to official Azure range input")
    descriptor: list[dict[str, Any]] = []
    remote_contexts: dict[str, Mapping[str, Any]] = {}
    for locator in inputs:
        if locator.startswith("https://"):
            remote_descriptor, context = inspect_official_azure_source(locator, expected_etag or "")
            descriptor.append(remote_descriptor)
            remote_contexts[locator] = context
        elif "://" in locator:
            raise CatalogBuildError("unsupported input URL; only the pinned official Overture Azure host is allowed")
        else:
            descriptor.append(source_descriptor(locator))
    counters = {
        "records_read": 0,
        "places_inserted": 0,
        "duplicates_merged": 0,
        "non_lodging_skipped": 0,
        "outside_bbox_skipped": 0,
        "unsafe_urls_skipped": 0,
    }
    receipt = {
        "catalogFormat": CATALOG_FORMAT,
        "release": OVERTURE_RELEASE,
        "schemaVersion": OVERTURE_SCHEMA_VERSION,
        "bbox": bounds.as_dict() if bounds else None,
        "duplicatePolicy": "highest-confidence-then-completeness-then-canonical; union websites and contributor sources",
        "sources": descriptor,
        "counts": counters,
    }
    file_descriptor, temporary_name = tempfile.mkstemp(prefix=f".{output.name}.", suffix=".tmp", dir=output.parent)
    os.close(file_descriptor)
    os.unlink(temporary_name)
    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(temporary_name)
        connection.executescript(SCHEMA_SQL)
        connection.execute("BEGIN IMMEDIATE")
        for locator in inputs:
            requires_row_declaration = not locator.lower().endswith((".parquet", ".parq"))
            for source_record in input_rows(locator, batch_size, bounds, remote_contexts.get(locator)):
                counters["records_read"] += 1
                declared_release = source_record.get("overture_release")
                declared_schema = source_record.get("overture_schema_version")
                if requires_row_declaration and (declared_release is None or declared_schema is None):
                    raise CatalogBuildError("local NDJSON records must declare overture_release and overture_schema_version")
                if declared_release is not None and declared_release != OVERTURE_RELEASE:
                    raise CatalogBuildError(f"record declares Overture release {declared_release}, expected {OVERTURE_RELEASE}")
                if declared_schema is not None and declared_schema != OVERTURE_SCHEMA_VERSION:
                    raise CatalogBuildError(f"record declares schema {declared_schema}, expected {OVERTURE_SCHEMA_VERSION}")
                normalized = normalized_record(source_record, counters)
                if normalized is None:
                    continue
                if bounds and not bounds.contains(normalized["longitude"], normalized["latitude"]):
                    counters["outside_bbox_skipped"] += 1
                    continue
                store_record(connection, normalized, counters)
        if counters["records_read"] == 0:
            raise CatalogBuildError("inputs contained no records")
        receipt_text = canonical_json(receipt)
        for key, value in (
            ("catalog_format", CATALOG_FORMAT),
            ("overture_release", OVERTURE_RELEASE),
            ("overture_schema_version", OVERTURE_SCHEMA_VERSION),
            ("import_receipt", receipt_text),
        ):
            connection.execute("INSERT INTO metadata(key,value) VALUES(?,?)", (key, value))
        connection.commit()
        integrity = connection.execute("PRAGMA quick_check").fetchone()
        if integrity != ("ok",):
            raise CatalogBuildError(f"SQLite integrity check failed: {integrity}")
        connection.execute("PRAGMA optimize")
        connection.close()
        connection = None
        os.chmod(temporary_name, 0o444)
        with open(temporary_name, "rb") as completed:
            os.fsync(completed.fileno())
        # link() is an atomic create-if-absent on the same filesystem. Unlike
        # replace()/rename(), it cannot overwrite a catalog created during this build.
        os.link(temporary_name, output)
        os.unlink(temporary_name)
        directory = os.open(output.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
        return receipt
    except Exception:
        if connection is not None:
            connection.close()
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", nargs="+", help="local .parquet/.ndjson files or one pinned official Overture Azure Places Parquet URL")
    parser.add_argument("--output", required=True, type=Path, help="new SQLite catalog path (must not exist)")
    parser.add_argument("--bbox", type=parse_bounds, help="west,south,east,north; each span must be <=5 degrees")
    parser.add_argument("--release", default=OVERTURE_RELEASE, help="must remain pinned to the admitted release")
    parser.add_argument("--schema-version", default=OVERTURE_SCHEMA_VERSION, help="must remain pinned to the admitted schema")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--expected-etag", help="required immutable ETag for an official Azure range input")
    arguments = parser.parse_args(argv)
    try:
        if arguments.release != OVERTURE_RELEASE:
            raise CatalogBuildError(f"release must be {OVERTURE_RELEASE}")
        if arguments.schema_version != OVERTURE_SCHEMA_VERSION:
            raise CatalogBuildError(f"schema version must be {OVERTURE_SCHEMA_VERSION}")
        if not 1 <= arguments.batch_size <= 65_536:
            raise CatalogBuildError("batch size must be between 1 and 65536")
        receipt = build_catalog(
            arguments.inputs,
            arguments.output,
            arguments.bbox,
            arguments.batch_size,
            arguments.expected_etag,
        )
        print(canonical_json(receipt))
        return 0
    except (CatalogBuildError, OSError, sqlite3.Error) as error:
        print(f"place-catalog build failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
