from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import sqlite3
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq


ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts" / "research" / "build-place-catalog.py"
SPEC = importlib.util.spec_from_file_location("yellow_place_catalog_builder", BUILDER)
assert SPEC is not None and SPEC.loader is not None
BUILDER_MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = BUILDER_MODULE
SPEC.loader.exec_module(BUILDER_MODULE)


def record(identifier: str, name: str = "Harbour Hotel", longitude: float = 55.27, latitude: float = 25.2, **changes):
    value = {
        "id": identifier,
        "geometry": {"type": "Point", "coordinates": [longitude, latitude]},
        "names": {"primary": name},
        "categories": {"primary": "hotel"},
        "confidence": 0.8,
        "websites": ["HTTPS://Example.COM:443/stay#campaign", "javascript:alert(1)"],
        "addresses": [{"freeform": "1 Road", "locality": "Dubai", "region": "Dubai", "postcode": None, "country": "AE"}],
        "operating_status": None,
        "sources": [{"property": "source-a", "dataset": "meta", "license": "CC0-1.0"}],
        "overture_release": "2026-08-19.0",
        "overture_schema_version": "1.18.0",
    }
    value.update(changes)
    return value


class PlaceCatalogImportTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="yellow-place-import-")
        self.root = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def write_ndjson(self, name: str, records) -> Path:
        path = self.root / name
        path.write_text("".join(json.dumps(value, separators=(",", ":")) + "\n" for value in records), encoding="utf-8")
        return path

    def run_builder(self, source: Path, output: Path, *arguments: str):
        return subprocess.run(
            [sys.executable, str(BUILDER), str(source), "--output", str(output), *arguments],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_builds_public_lodging_catalog_with_receipt_and_safe_urls(self):
        self.assertEqual(pa.__version__, "25.0.1")
        attack = "</script><img src=x onerror=alert(1)>"
        source = self.write_ndjson("places.ndjson", [
            record("place-a", attack),
            record("not-lodging", categories={"primary": "restaurant"}),
            record("outside", longitude=54.0, latitude=24.0),
        ])
        output = self.root / "catalog.sqlite"
        result = self.run_builder(source, output, "--bbox", "55,25,56,26")
        self.assertEqual(result.returncode, 0, result.stderr)
        receipt = json.loads(result.stdout)
        self.assertEqual(receipt["release"], "2026-08-19.0")
        self.assertEqual(receipt["schemaVersion"], "1.18.0")
        self.assertEqual(receipt["counts"], {
            "records_read": 3,
            "places_inserted": 1,
            "duplicates_merged": 0,
            "non_lodging_skipped": 1,
            "outside_bbox_skipped": 1,
            "unsafe_urls_skipped": 2,
        })
        self.assertEqual(oct(output.stat().st_mode & 0o777), "0o444")
        connection = sqlite3.connect(f"file:{output}?mode=ro", uri=True)
        row = connection.execute("SELECT name,status,websites_json,sources_json FROM places").fetchone()
        self.assertEqual(row[0], attack)
        self.assertEqual(row[1], "unknown")
        self.assertEqual(json.loads(row[2]), ["https://example.com/stay"])
        self.assertEqual(json.loads(row[3]), [{"dataset": "meta", "license": "CC0-1.0", "property": "source-a"}])
        metadata = dict(connection.execute("SELECT key,value FROM metadata"))
        self.assertEqual(metadata["catalog_format"], "yellow.place-catalog/v1")
        self.assertEqual(json.loads(metadata["import_receipt"]), receipt)
        self.assertEqual(connection.execute("SELECT normalized_domain FROM websites").fetchone()[0], "example.com")
        connection.close()

    def test_duplicate_policy_is_order_independent_and_unions_provenance(self):
        lower = record("same-id", name="Lower", confidence=0.2, websites=["https://one.example"], sources=[{"property": "first", "dataset": "synthetic"}])
        winner = record("same-id", name="Winner", confidence=0.9, websites=["https://two.example"], sources=[{"property": "second", "dataset": "synthetic"}])
        winners = []
        for index, values in enumerate(([lower, winner], [winner, lower])):
            output = self.root / f"catalog-{index}.sqlite"
            result = self.run_builder(self.write_ndjson(f"input-{index}.ndjson", values), output)
            self.assertEqual(result.returncode, 0, result.stderr)
            connection = sqlite3.connect(f"file:{output}?mode=ro", uri=True)
            winners.append(connection.execute("SELECT name,websites_json,sources_json FROM places").fetchone())
            self.assertEqual(connection.execute("SELECT count(*) FROM place_rtree").fetchone()[0], 1)
            connection.close()
        self.assertEqual(winners[0], winners[1])
        self.assertEqual(winners[0][0], "Winner")
        self.assertEqual(json.loads(winners[0][1]), ["https://one.example/", "https://two.example/"])
        self.assertEqual(json.loads(winners[0][2]), [{"property": "first", "dataset": "synthetic"}, {"property": "second", "dataset": "synthetic"}])

    def test_malformed_release_coordinate_and_ndjson_fail_atomically(self):
        cases = [
            [record("bad-release", overture_release="2026-07-01.0")],
            [record("bad-coordinate", longitude=181)],
            [record("private-source", sources=[{"property": "source", "tenant_id": "must-not-enter-global-catalog"}])],
        ]
        for index, values in enumerate(cases):
            output = self.root / f"bad-{index}.sqlite"
            result = self.run_builder(self.write_ndjson(f"bad-{index}.ndjson", values), output)
            self.assertEqual(result.returncode, 2)
            self.assertFalse(output.exists())
        malformed = self.root / "malformed.ndjson"
        malformed.write_text('{"id":\n', encoding="utf-8")
        output = self.root / "malformed.sqlite"
        result = self.run_builder(malformed, output)
        self.assertEqual(result.returncode, 2)
        self.assertFalse(output.exists())

        wrong_schema = self.run_builder(
            self.write_ndjson("wrong-schema.ndjson", [record("schema")]),
            self.root / "wrong-schema.sqlite",
            "--schema-version", "1.17.0",
        )
        self.assertEqual(wrong_schema.returncode, 2)
        self.assertFalse((self.root / "wrong-schema.sqlite").exists())

    def test_refuses_to_replace_a_good_output_on_failure_or_success(self):
        source = self.write_ndjson("good.ndjson", [record("good")])
        output = self.root / "catalog.sqlite"
        first = self.run_builder(source, output)
        self.assertEqual(first.returncode, 0, first.stderr)
        before = hashlib.sha256(output.read_bytes()).hexdigest()
        os.chmod(output, 0o644)
        second = self.run_builder(source, output)
        self.assertEqual(second.returncode, 2)
        self.assertIn("refusing to overwrite", second.stderr)
        self.assertEqual(hashlib.sha256(output.read_bytes()).hexdigest(), before)

    def test_imports_overture_shaped_parquet_in_bounded_batches(self):
        source = self.root / "places.parquet"
        values = []
        for index in range(5):
            value = record(f"parquet-{index}", name=f"Parquet {index}")
            longitude, latitude = value.pop("geometry")["coordinates"]
            value["geometry"] = struct.pack("<BIdd", 1, 1, longitude, latitude)
            value.pop("categories")
            value["basic_category"] = "accommodation"
            value["taxonomy"] = {"primary": "hotel", "hierarchy": ["lodging"], "alternates": []}
            value["brand"] = {"wikidata": "Q1", "names": {"primary": "Parquet Brand"}}
            value.pop("overture_release")
            value.pop("overture_schema_version")
            values.append(value)
        table = pa.Table.from_pylist(values)
        metadata = dict(table.schema.metadata or {})
        metadata[b"overture_release"] = b"2026-08-19.0"
        metadata[b"overture_schema_version"] = b"1.18.0"
        pq.write_table(table.replace_schema_metadata(metadata), source, row_group_size=2)
        output = self.root / "parquet.sqlite"
        result = self.run_builder(source, output, "--batch-size", "1")
        self.assertEqual(result.returncode, 0, result.stderr)
        receipt = json.loads(result.stdout)
        self.assertEqual(receipt["sources"][0]["upstream"], {
            "release": "2026-08-19.0", "schemaVersion": "1.18.0",
        })
        connection = sqlite3.connect(f"file:{output}?mode=ro", uri=True)
        self.assertEqual(connection.execute("SELECT count(*) FROM places").fetchone()[0], 5)
        connection.close()

    def test_antimeridian_bbox_is_bounded_and_explicit(self):
        source = self.write_ndjson("edge.ndjson", [
            record("east", longitude=179.5, latitude=10),
            record("west", longitude=-179.5, latitude=10),
            record("away", longitude=0, latitude=10),
        ])
        output = self.root / "edge.sqlite"
        result = self.run_builder(source, output, "--bbox", "179,9,-179,11")
        self.assertEqual(result.returncode, 0, result.stderr)
        receipt = json.loads(result.stdout)
        self.assertEqual(receipt["counts"]["places_inserted"], 2)
        self.assertEqual(receipt["counts"]["outside_bbox_skipped"], 1)
        too_large = self.run_builder(source, self.root / "too-large.sqlite", "--bbox", "170,9,-170,11")
        self.assertNotEqual(too_large.returncode, 0)
        self.assertFalse((self.root / "too-large.sqlite").exists())

    def test_official_azure_reader_requires_pinned_url_etag_and_bounded_ranges(self):
        url = (
            "https://overturemapswestus2.blob.core.windows.net/release/2026-08-19.0/"
            "theme=places/type=place/part-test.zstd.parquet"
        )
        payload = b"PARQUET-RANGE"

        class Response:
            def __init__(self, status, headers, body=b""):
                self.status, self.headers, self.body = status, headers, body

            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

            def read(self, amount):
                return self.body[:amount]

        def open_request(request):
            if request.get_method() == "HEAD":
                return Response(200, {"Content-Length": str(len(payload)), "ETag": '"fixed-etag"'})
            self.assertEqual(request.headers["Range"], f"bytes=0-{len(payload) - 1}")
            self.assertEqual(request.get_header("If-match"), '"fixed-etag"')
            return Response(206, {
                "ETag": '"fixed-etag"',
                "Content-Length": str(len(payload)),
                "Content-Range": f"bytes 0-{len(payload) - 1}/{len(payload)}",
            }, payload)

        with mock.patch.object(BUILDER_MODULE, "open_official", open_request):
            descriptor, context = BUILDER_MODULE.inspect_official_azure_source(url, "fixed-etag")
            ranged = BUILDER_MODULE.OfficialAzureRangeFile(
                url, context["size"], context["etag"], context["etag_header"], context["descriptor"]
            )
            self.assertEqual(ranged.read(), payload)
            self.assertEqual(descriptor["rangeBytesTransferred"], len(payload))
            self.assertEqual(descriptor["peakRangeCacheBytes"], len(payload))
            ranged.close()  # RawIOBase owns close; no nonexistent cloud-filesystem close is called.

        def should_not_open(_request):
            raise AssertionError("invalid ETag or exhausted budget must fail before network access")

        with mock.patch.object(BUILDER_MODULE, "open_official", should_not_open):
            for etag in ("", '""', "W/\"weak\"", 'bad"tag'):
                with self.assertRaises(BUILDER_MODULE.CatalogBuildError):
                    BUILDER_MODULE.inspect_official_azure_source(url, etag)
            exhausted = BUILDER_MODULE.OfficialAzureRangeFile(
                url,
                BUILDER_MODULE.REMOTE_BLOCK_BYTES * 20,
                "fixed-etag",
                '"fixed-etag"',
                {"rangeBytesTransferred": 0, "peakRangeCacheBytes": 0},
            )
            exhausted.transferred = BUILDER_MODULE.MAX_REMOTE_SOURCE_BYTES - 1
            with self.assertRaises(BUILDER_MODULE.CatalogBuildError):
                exhausted.read(1)

        with mock.patch.object(BUILDER_MODULE, "open_official", lambda _request: Response(302, {})):
            with self.assertRaises(BUILDER_MODULE.CatalogBuildError):
                BUILDER_MODULE.inspect_official_azure_source(url, "fixed-etag")

        wrong_range = Response(206, {
            "ETag": '"fixed-etag"',
            "Content-Length": str(len(payload)),
            "Content-Range": f"bytes 1-{len(payload)}/{len(payload)}",
        }, payload)
        with mock.patch.object(BUILDER_MODULE, "open_official", lambda _request: wrong_range):
            ranged = BUILDER_MODULE.OfficialAzureRangeFile(
                url, len(payload), "fixed-etag", '"fixed-etag"',
                {"rangeBytesTransferred": 0, "peakRangeCacheBytes": 0},
            )
            with self.assertRaises(BUILDER_MODULE.CatalogBuildError):
                ranged.read()
        with self.assertRaises(BUILDER_MODULE.CatalogBuildError):
            BUILDER_MODULE.validate_official_azure_url(
                "https://example.com/release/2026-08-19.0/theme=places/type=place/part.parquet"
            )


    def test_public_provenance_allows_only_typed_public_source_fields(self):
        public = {"property": "", "dataset": "synthetic", "record_id": "public-fixture"}
        hostile = [
            {**public, key: "synthetic-private-marker"}
            for key in ("clientId", "guestId", "reservationId", "PMSPropertyID", "arbitraryField", "guest_id")
        ] + [
            {**public, "dataset": {"guestId": "synthetic-private-marker"}},
            {**public, "record_id": ["synthetic-private-marker"]},
            {**public, "confidence": True},
            {**public, "confidence": 2},
            {**public, "between": [0, {"guestId": "synthetic-private-marker"}]},
        ]
        for index, source_fields in enumerate(hostile):
            with self.subTest(index=index):
                source = self.write_ndjson(f"private-{index}.ndjson", [record("synthetic", sources=[source_fields])])
                output = self.root / f"private-{index}.sqlite"
                with self.assertRaises(BUILDER_MODULE.CatalogBuildError):
                    BUILDER_MODULE.build_catalog([str(source)], output, None, 16)
                self.assertFalse(output.exists())
                self.assertEqual(list(self.root.glob(f".{output.name}.*.tmp")), [])

    def test_local_ndjson_requires_release_and_schema_declarations(self):
        for field in ("overture_release", "overture_schema_version"):
            for value in (None, "missing"):
                with self.subTest(field=field, value=value):
                    item = record("synthetic", sources=[{"property": "", "dataset": "synthetic"}])
                    if value == "missing":
                        item.pop(field)
                    else:
                        item[field] = value
                    source = self.write_ndjson(f"{field}-{value}.ndjson", [item])
                    output = self.root / f"{field}-{value}.sqlite"
                    with self.assertRaisesRegex(BUILDER_MODULE.CatalogBuildError, "declare"):
                        BUILDER_MODULE.build_catalog([str(source)], output, None, 16)
                    self.assertFalse(output.exists())

    def test_local_parquet_requires_matching_release_metadata(self):
        item = record("synthetic", sources=[{"property": "", "dataset": "synthetic"}])
        item.pop("overture_release")
        item.pop("overture_schema_version")
        table = pa.Table.from_pylist([item])
        declarations = (
            {},
            {b"overture_release": b"2026-08-19.0"},
            {b"overture_schema_version": b"1.18.0"},
            {b"overture_release": b"2026-08-19.0", b"overture_schema_version": b"1.18.0", b"overture:release": b"2025-01-01.0"},
        )
        for index, metadata in enumerate(declarations):
            with self.subTest(index=index):
                source = self.root / f"undeclared-{index}.parquet"
                pq.write_table(table.replace_schema_metadata(metadata), source)
                output = self.root / f"undeclared-{index}.sqlite"
                with self.assertRaises(BUILDER_MODULE.CatalogBuildError):
                    BUILDER_MODULE.build_catalog([str(source)], output, None, 16)
                self.assertFalse(output.exists())
        source = self.root / "declared.parquet"
        pq.write_table(table.replace_schema_metadata({b"overture:release": b"2026-08-19.0", b"overture:schema_version": b"1.18.0"}), source)
        receipt = BUILDER_MODULE.build_catalog([str(source)], self.root / "declared.sqlite", None, 16)
        self.assertEqual(receipt["sources"][0]["upstream"]["release"], "2026-08-19.0")

    def test_keyword_keys_use_default_lowercase_and_shared_whitespace(self):
        fixtures = {
            "Straße Hotel": "straße hotel",
            "ΟΣ Hotel": "ος hotel",
            "İSTANBUL": "i\u0307stanbul",
            "\ufeffＡＢＣ\u00a0Hotel\ufeff": "abc hotel",
        }
        for text, expected in fixtures.items():
            with self.subTest(text=text):
                self.assertEqual(BUILDER_MODULE.normalized_text(text), expected)


if __name__ == "__main__":
    unittest.main()
