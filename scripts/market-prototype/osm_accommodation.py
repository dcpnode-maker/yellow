"""One bounded public OSM sample; not active OTA inventory or calendar rates.

Antigravity generated the query/transport/normalizer scaffold (Order 728);
Codex reviewed and hardened it before execution. No contact tags are persisted.
The source extract is privacy-filtered, NOT the original response bytes.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from math import isfinite
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request

BBOX = (24.80, 54.85, 25.45, 55.65)  # selected metro sample, NOT an administrative boundary
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
MAX_BYTES = 8 * 1024 * 1024
USER_AGENT = "Yellow-OpenData-Sample/1.0 (one bounded accommodation sample)"
ALLOWED_TOURISM = frozenset({"hotel", "motel", "hostel", "guest_house", "apartment"})
OVERPASS_QL = f'''[out:json][timeout:30][maxsize:67108864];
nwr["tourism"~"^(hotel|motel|hostel|guest_house|apartment)$"]({','.join(map(str, BBOX))});
out center;
'''
ATTRIBUTION = {
    "attribution": "OpenStreetMap contributors",
    "license": "ODbL-1.0",
    "license_url": "https://opendatacommons.org/licenses/odbl/1-0/",
    "copyright_url": "https://www.openstreetmap.org/copyright",
}


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, "redirect_disallowed", headers, fp)


def get_default_opener():
    return urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirectHandler())


def fetch_once(opener=None):
    """Single POST; failure/denial/timeout propagates, without retry or fallback."""
    opener = opener if opener is not None else get_default_opener()
    request = urllib.request.Request(
        OVERPASS_URL, data=urllib.parse.urlencode({"data": OVERPASS_QL}).encode("utf-8"),
        headers={"User-Agent": USER_AGENT, "Accept": "application/json", "Accept-Encoding": "identity"},
        method="POST",
    )
    with opener.open(request, timeout=45) as response:
        if response.status != 200:
            raise ValueError(f"http_status_{response.status}")
        if response.geturl() != OVERPASS_URL:
            raise ValueError("redirect_disallowed")
        if response.headers.get_content_type() != "application/json":
            raise ValueError("unexpected_content_type")
        if response.headers.get("Content-Encoding", "identity").lower() != "identity":
            raise ValueError("unexpected_content_encoding")
        length = response.headers.get("Content-Length")
        if length is not None and (not length.isascii() or not length.isdigit() or int(length) > MAX_BYTES):
            raise ValueError("invalid_or_excess_content_length")
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError("response_size_limit")
        if length is not None and len(body) != int(length):
            raise ValueError("incomplete_response")
        return body, datetime.now(timezone.utc).isoformat()


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate_json_key")
        result[key] = value
    return result


def _reject_constant(_value):
    raise ValueError("nonfinite_json_number")


def _decode(raw_bytes):
    if not isinstance(raw_bytes, bytes) or len(raw_bytes) > MAX_BYTES:
        raise ValueError("response_size_or_type")
    try:
        data = json.loads(raw_bytes.decode("utf-8"), object_pairs_hook=_unique_object, parse_constant=_reject_constant)
    except (UnicodeError, ValueError, RecursionError) as error:
        raise ValueError("malformed_json") from error
    if not isinstance(data, dict) or not isinstance(data.get("elements"), list):
        raise ValueError("malformed_overpass_shape")
    # Any server remark can denote partial/incomplete output: fail closed.
    if "remark" in data:
        raise ValueError("overpass_remark_incomplete")
    metadata = data.get("osm3s")
    if not isinstance(metadata, dict) or not isinstance(metadata.get("timestamp_osm_base"), str):
        raise ValueError("missing_source_timestamp")
    return data


def _extract_coords(element):
    if element.get("type") == "node":
        source, kind = element, "osm_node_point"
    else:
        source, kind = element.get("center"), "osm_bounding_box_center"
    if not isinstance(source, dict):
        return None
    lat, lon = source.get("lat"), source.get("lon")
    if type(lat) not in (int, float) or type(lon) not in (int, float):
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180) or not (isfinite(lat) and isfinite(lon)):
        return None
    return float(lat), float(lon), kind


def normalize(raw_bytes, fetched_at):
    data = _decode(raw_bytes)
    if not isinstance(fetched_at, str) or not fetched_at:
        raise ValueError("missing_read_timestamp")
    records, seen, exclusions, source_elements = [], set(), Counter(), []
    for element in data["elements"]:
        if not isinstance(element, dict):
            exclusions["malformed_element"] += 1
            continue
        kind, identifier = element.get("type"), element.get("id")
        if kind not in ("node", "way", "relation") or type(identifier) is not int or identifier <= 0:
            exclusions["invalid_source_identity"] += 1
            continue
        if (kind, identifier) in seen:
            exclusions["duplicate_osm_id"] += 1
            continue
        seen.add((kind, identifier))
        tags = element.get("tags")
        if not isinstance(tags, dict) or not isinstance(tags.get("tourism"), str) or tags["tourism"] not in ALLOWED_TOURISM:
            exclusions["disallowed_tourism_type"] += 1
            continue
        coords = _extract_coords(element)
        if coords is None:
            exclusions["invalid_coordinates"] += 1
            continue
        lat, lon, coordinate_kind = coords
        if not (BBOX[0] <= lat <= BBOX[2] and BBOX[1] <= lon <= BBOX[3]):
            exclusions["out_of_bounds"] += 1
            continue
        name = tags.get("name") if isinstance(tags.get("name"), str) else None
        records.append({
            "source_type": kind, "source_id": str(identifier),
            "source_url": f"https://www.openstreetmap.org/{kind}/{identifier}",
            "source_status": "mapped_accommodation_unverified", "tourism_kind": tags["tourism"],
            "name": name, "latitude": lat, "longitude": lon, "coordinate_kind": coordinate_kind,
            "fetched_at": fetched_at, "active_inventory": "unknown", "ota_identity": "unknown",
            "exact_entrance": "unknown", "prices": "unknown", "calendar": "unknown",
        })
        # Whitelist evidence only. No contacts, addresses, photos, reviews or other tags survive.
        source_element = {"type": kind, "id": identifier, "tags": {"tourism": tags["tourism"]}}
        if name is not None:
            source_element["tags"]["name"] = name
        if kind == "node":
            source_element.update({"lat": lat, "lon": lon})
        else:
            source_element["center"] = {"lat": lat, "lon": lon}
        source_elements.append(source_element)
    extract = {
        "extraction_notice": "Privacy-filtered retained elements only; not the original response bytes.",
        "osm3s": {"timestamp_osm_base": data["osm3s"]["timestamp_osm_base"]},
        "elements": source_elements, **ATTRIBUTION,
    }
    extract_bytes = _json_bytes(extract)
    normalized = {
        "metadata": {
            "schema": "yellow.osm-accommodation-sample.v1", "source_endpoint": OVERPASS_URL,
            "fetched_at": fetched_at, "source_timestamp": data["osm3s"]["timestamp_osm_base"],
            "response_sha256": hashlib.sha256(raw_bytes).hexdigest(), "response_bytes": len(raw_bytes),
            "filtered_extract_sha256": hashlib.sha256(extract_bytes).hexdigest(),
            "bounding_box_south_west_north_east": list(BBOX),
            "coverage": "Bounded Dubai metro POI sample; not a complete market or administrative boundary.",
            "returned_elements": len(data["elements"]), "retained": len(records),
            "excluded": sum(exclusions.values()), "exclusion_counts": dict(exclusions), **ATTRIBUTION,
        },
        "accommodations": records,
    }
    return normalized, extract_bytes


def _json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def collect(output_dir, opener=None):
    """Reserve a fresh run directory before the only request; never silently rerun."""
    directory = Path(output_dir)
    directory.mkdir(parents=True, exist_ok=False)
    attempt = {"source_endpoint": OVERPASS_URL, "started_at": datetime.now(timezone.utc).isoformat(),
               "maximum_requests": 1, "query": OVERPASS_QL, "status": "started"}
    (directory / "attempt.json").write_bytes(_json_bytes(attempt))
    try:
        body, fetched_at = fetch_once(opener)
        normalized, filtered_extract = normalize(body, fetched_at)
        with (directory / "osm_accommodations_filtered_source.json").open("xb") as output:
            output.write(filtered_extract)
        with (directory / "osm_accommodations_normalized.json").open("xb") as output:
            output.write(_json_bytes(normalized))
        result = {"status": "completed", "requests": 1, **normalized["metadata"]}
    except (OSError, ValueError, urllib.error.URLError) as error:
        # No response body, redirect URL, private details or exception text retained.
        result = {"status": "failed_no_retry", "requests_attempted": 1, "error_type": type(error).__name__}
        if isinstance(error, urllib.error.HTTPError):
            result["http_status"] = error.code
        with (directory / "result.json").open("xb") as output:
            output.write(_json_bytes(result))
        raise
    with (directory / "result.json").open("xb") as output:
        output.write(_json_bytes(result))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = collect(args.output_dir)
    except (OSError, ValueError, urllib.error.URLError) as error:
        print(f"Collection stopped; no retry. {type(error).__name__}", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
