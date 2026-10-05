"""Order 728 proof uses only injected responses; never calls a remote server."""
import email.message
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import socket
import tempfile
import unittest
import urllib.error
from unittest.mock import Mock, patch

SOURCE = Path(__file__).resolve().parents[2] / "scripts/market-prototype/osm_accommodation.py"
SPEC = importlib.util.spec_from_file_location("osm_accommodation", SOURCE)
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)
TIME = "2026-09-25T09:00:00+00:00"


def node(identifier=1, **extra):
    return {"type": "node", "id": identifier, "lat": 25.1, "lon": 55.1,
            "tags": {"tourism": "hotel", "name": "Test Hotel"}, **extra}


def body(elements=None, **extra):
    return json.dumps({"osm3s": {"timestamp_osm_base": "2026-09-25T08:59:00Z"},
                       "elements": elements if elements is not None else [node()], **extra}).encode()


class Response:
    def __init__(self, data=None, status=200, url=mod.OVERPASS_URL, **headers):
        self.status, self.url = status, url
        self.body = data if data is not None else body()
        self.headers = email.message.Message()
        self.headers["Content-Type"] = headers.pop("Content_Type", "application/json")
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


class OSMProof(unittest.TestCase):
    def setUp(self):
        self.dns = patch.object(socket, "getaddrinfo", side_effect=AssertionError("unexpected real DNS"))
        self.dns.start()
        self.addCleanup(self.dns.stop)

    def test_normalization_and_distinct_hashes(self):
        raw = body([node(tags={"tourism": "hotel", "name": "فندق", "phone": "private-contact",
                              "contact:email": "private-email", "image": "private-image"})])
        norm, extract = mod.normalize(raw, TIME)
        row, metadata = norm["accommodations"][0], norm["metadata"]
        self.assertEqual(row["source_id"], "1")
        self.assertEqual(row["name"], "فندق")
        self.assertEqual(row["source_url"], "https://www.openstreetmap.org/node/1")
        self.assertEqual(row["coordinate_kind"], "osm_node_point")
        self.assertEqual(row["fetched_at"], TIME)
        self.assertEqual(row["source_status"], "mapped_accommodation_unverified")
        for field in ("active_inventory", "ota_identity", "exact_entrance", "prices", "calendar"):
            self.assertEqual(row[field], "unknown")
        self.assertEqual(metadata["response_sha256"], hashlib.sha256(raw).hexdigest())
        self.assertEqual(metadata["filtered_extract_sha256"], hashlib.sha256(extract).hexdigest())
        self.assertNotEqual(metadata["response_sha256"], metadata["filtered_extract_sha256"])
        saved = json.dumps(norm).encode() + extract
        for banned in (b"private-contact", b"private-email", b"private-image", b"contact:email"):
            self.assertNotIn(banned, saved)
        self.assertEqual(metadata["license"], "ODbL-1.0")
        self.assertEqual(metadata["retained"], 1)

    def test_way_relation_centers_and_missing_names(self):
        entries = [{"type": kind, "id": 1, "center": {"lat": 25.1, "lon": 55.1},
                    "tags": {"tourism": "apartment"}} for kind in ("way", "relation")]
        norm, _ = mod.normalize(body(entries), TIME)
        self.assertEqual(len(norm["accommodations"]), 2)
        for row in norm["accommodations"]:
            self.assertEqual(row["coordinate_kind"], "osm_bounding_box_center")
            self.assertIsNone(row["name"])

    def test_duplicates_count_once_and_types_do_not_collide(self):
        norm, _ = mod.normalize(body([node(), node(), {"type": "way", "id": 1,
                               "center": {"lat": 25.1, "lon": 55.1}, "tags": {"tourism": "hotel"}}]), TIME)
        self.assertEqual(norm["metadata"]["retained"], 2)
        self.assertEqual(norm["metadata"]["exclusion_counts"], {"duplicate_osm_id": 1})

    def test_invalid_ids_and_elements_are_excluded(self):
        entries = [None, node(True), node(-1), node("1"), node(1.5), node(type="bad")]
        norm, _ = mod.normalize(body(entries), TIME)
        self.assertEqual(norm["metadata"]["retained"], 0)
        self.assertEqual(norm["metadata"]["excluded"], len(entries))

    def test_invalid_coordinate_and_outside_bbox_exclusions(self):
        entries = [node(1, lat=True), node(2, lat="25.1"), node(3, lat=91), node(4, lon=181),
                   node(5, lat=24), node(6, lon=56), node(7, type="way", center=None),
                   node(8, lat=mod.BBOX[0], lon=mod.BBOX[1])]
        norm, _ = mod.normalize(body(entries), TIME)
        self.assertEqual(norm["metadata"]["retained"], 1)
        self.assertEqual(norm["metadata"]["exclusion_counts"], {"invalid_coordinates": 5, "out_of_bounds": 2})

    def test_tourism_whitelist_and_nonstring(self):
        entries = [node(index, tags={"tourism": kind}) for index, kind in enumerate(
            ["hotel", "motel", "hostel", "guest_house", "apartment", "restaurant", [], None], 1)]
        norm, _ = mod.normalize(body(entries), TIME)
        self.assertEqual(norm["metadata"]["retained"], 5)
        self.assertEqual(norm["metadata"]["excluded"], 3)

    def test_malformed_json_shapes_remarks_and_duplicate_keys_fail(self):
        cases = [b"bad", b"[]", b"{}", b'{"elements":{}}', b"\xff", body(osm3s=None),
                 body(remark="partial output"), body(remark={}), body(remark=None),
                 b'{"elements":[],"elements":[]}', body([node(lat=float("nan"))]),
                 body([node(lon=float("inf"))])]
        for raw in cases:
            with self.subTest(raw=raw[:70]), self.assertRaises(ValueError):
                mod.normalize(raw, TIME)

    def test_missing_timestamp_rejected(self):
        with self.assertRaisesRegex(ValueError, "missing_read_timestamp"):
            mod.normalize(body(), "")
        with self.assertRaisesRegex(ValueError, "missing_source_timestamp"):
            mod.normalize(body(osm3s={}), TIME)

    def test_normalizer_enforces_body_cap(self):
        with patch.object(mod, "MAX_BYTES", 5), self.assertRaisesRegex(ValueError, "response_size_or_type"):
            mod.normalize(body(), TIME)

    def test_transport_one_request_correct_query_and_timeout(self):
        response, opener = Response(), Mock()
        opener.open.return_value = response
        raw, timestamp = mod.fetch_once(opener)
        self.assertEqual(raw, body())
        self.assertTrue(timestamp.endswith("+00:00"))
        opener.open.assert_called_once()
        request = opener.open.call_args.args[0]
        self.assertEqual(opener.open.call_args.kwargs, {"timeout": 45})
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.full_url, mod.OVERPASS_URL)
        self.assertEqual(request.get_header("User-agent"), mod.USER_AGENT)
        self.assertEqual(request.get_header("Accept-encoding"), "identity")
        self.assertIsNone(request.get_header("Cookie"))
        self.assertIsNone(request.get_header("Authorization"))
        query = mod.urllib.parse.parse_qs(request.data.decode())["data"][0]
        self.assertEqual(query, mod.OVERPASS_QL)
        self.assertIn("[timeout:30][maxsize:67108864]", query)
        self.assertEqual(response.read_sizes, [mod.MAX_BYTES + 1])

    def test_http_status_failure_no_retry(self):
        for status in (301, 403, 429, 500, 504):
            opener = Mock()
            opener.open.return_value = Response(status=status)
            with self.subTest(status=status), self.assertRaises(ValueError):
                mod.fetch_once(opener)
            opener.open.assert_called_once()

    def test_timeout_and_http_error_no_retry(self):
        for failure in (socket.timeout("timeout"), urllib.error.HTTPError(mod.OVERPASS_URL, 429, "stop", {}, io.BytesIO())):
            opener = Mock()
            opener.open.side_effect = failure
            with self.subTest(error=type(failure).__name__), self.assertRaises(type(failure)):
                mod.fetch_once(opener)
            opener.open.assert_called_once()

    def test_redirect_response_and_handler_reject(self):
        opener = Mock()
        opener.open.return_value = Response(url="https://other.example/")
        with self.assertRaisesRegex(ValueError, "redirect_disallowed"):
            mod.fetch_once(opener)
        request = mod.urllib.request.Request(mod.OVERPASS_URL)
        with self.assertRaises(urllib.error.HTTPError):
            mod.NoRedirectHandler().redirect_request(request, io.BytesIO(), 302, "Found", {}, "https://other.example/")

    def test_content_type_encoding_and_size_header_fail_before_body(self):
        for headers in ({"Content_Type": "text/html"}, {"Content_Encoding": "gzip"},
                        {"Content_Length": str(mod.MAX_BYTES + 1)}, {"Content_Length": "-1"},
                        {"Content_Length": "oops"}, {"Content_Length": "١٢"}):
            response, opener = Response(**headers), Mock()
            opener.open.return_value = response
            with self.subTest(headers=headers), self.assertRaises(ValueError):
                mod.fetch_once(opener)
            self.assertEqual(response.read_sizes, [])

    def test_actual_size_limit_and_truncation(self):
        with patch.object(mod, "MAX_BYTES", 20):
            for response in (Response(data=b"x" * 21), Response(data=b"xxx", Content_Length="5")):
                opener = Mock()
                opener.open.return_value = response
                with self.assertRaises(ValueError):
                    mod.fetch_once(opener)

    def test_default_transport_has_no_proxy_cookie_or_auth_handler(self):
        opener = mod.get_default_opener()
        names = [type(handler).__name__ for handler in opener.handlers]
        self.assertIn("NoRedirectHandler", names)
        self.assertNotIn("HTTPRedirectHandler", names)
        self.assertNotIn("HTTPCookieProcessor", names)
        self.assertNotIn("ProxyHandler", names)  # Empty proxy map installs no proxy handlers.
        self.assertFalse(any("Auth" in name for name in names))

    def test_success_persists_only_filtered_artifacts_and_prevents_repeat(self):
        with tempfile.TemporaryDirectory() as temp:
            destination = Path(temp) / "run"
            response, opener = Response(data=body([node(tags={"tourism": "hotel", "phone": "do-not-retain"})])), Mock()
            opener.open.return_value = response
            result = mod.collect(destination, opener)
            self.assertEqual(result["status"], "completed")
            self.assertEqual(len(list(destination.iterdir())), 4)
            for artifact in destination.iterdir():
                self.assertNotIn(b"do-not-retain", artifact.read_bytes())
            with self.assertRaises(FileExistsError):
                mod.collect(destination, opener)
            opener.open.assert_called_once()
            extract = (destination / "osm_accommodations_filtered_source.json").read_bytes()
            self.assertEqual(result["filtered_extract_sha256"], hashlib.sha256(extract).hexdigest())

    def test_failure_records_terminal_status_and_no_dataset_or_retry(self):
        with tempfile.TemporaryDirectory() as temp:
            destination = Path(temp) / "failed"
            opener = Mock()
            opener.open.side_effect = urllib.error.HTTPError(mod.OVERPASS_URL, 429, "body private", {}, io.BytesIO())
            with self.assertRaises(urllib.error.HTTPError):
                mod.collect(destination, opener)
            result = json.loads((destination / "result.json").read_bytes())
            self.assertEqual(result, {"status": "failed_no_retry", "requests_attempted": 1, "error_type": "HTTPError", "http_status": 429})
            self.assertEqual(len(list(destination.iterdir())), 2)
            with self.assertRaises(FileExistsError):
                mod.collect(destination, opener)
            opener.open.assert_called_once()


if __name__ == "__main__":
    unittest.main()
