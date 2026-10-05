"""Offline-only safety and behavior tests for the listing collector."""

import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
import urllib.error
import urllib.request
from unittest.mock import MagicMock, patch


SOURCE = Path(__file__).resolve().parents[2] / "scripts" / "market-prototype" / "public_listing_collector.py"
SPEC = importlib.util.spec_from_file_location("public_listing_collector", SOURCE)
assert SPEC and SPEC.loader
collector_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collector_module)
PublicListingCollector = collector_module.PublicListingCollector
HTMLLinkAndJSONLDParser = collector_module.HTMLLinkAndJSONLDParser
_NoRedirectHandler = collector_module._NoRedirectHandler


class ListingCollectorTests(unittest.TestCase):
    origin = "https://allowed.example"
    seed = origin + "/listings"
    robots = b"User-agent: *\nAllow: /\n"

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.cache = os.path.join(self.temp.name, "cache.json")

    def tearDown(self):
        self.temp.cleanup()

    def make_collector(self, **kwargs):
        options = dict(allowed_origins=[self.origin], seed_urls=[self.seed], cache_path=self.cache)
        options.update(kwargs)
        return PublicListingCollector(**options)

    def set_robots(self, collector):
        collector.robot_parsers[self.origin + ":443"] = collector_module.RobotsPolicy.parse(
            "User-agent: *\nAllow: /", collector.user_agent
        )

    def test_exact_origin_and_disallowed_path_isolation(self):
        collector = self.make_collector(seed_urls=["https://evil.example/item", self.origin + "/api/private"])
        with patch.object(collector, "_load_robots", return_value=True), patch.object(collector, "_fetch_url") as fetch:
            result = collector.run()
        fetch.assert_not_called()
        self.assertEqual(result["fetched_pages"], 0)
        self.assertEqual(len(result["errors"]), 2)

    def test_allowlist_rejects_path_scoped_entries(self):
        with self.assertRaises(ValueError):
            self.make_collector(allowed_origins=[self.origin + "/public"])
        with self.assertRaises(ValueError):
            self.make_collector(allowed_origins=["http://allowed.example"])
        with self.assertRaises(ValueError):
            self.make_collector(seed_urls=["http://allowed.example/listings"])

    def test_origin_seed_and_total_request_budgets_are_bounded(self):
        origins = [f"https://site{index}.example" for index in range(6)]
        with self.assertRaises(ValueError):
            self.make_collector(allowed_origins=origins)
        seeds = [f"{self.origin}/listing/{index}" for index in range(51)]
        with self.assertRaises(ValueError):
            self.make_collector(seed_urls=seeds)

        allowed = origins[:3]
        denied_seeds = [origin + "/listing" for origin in allowed]
        collector = self.make_collector(allowed_origins=allowed, seed_urls=denied_seeds, max_pages=1)
        response = MagicMock()
        response.status = 200
        response.read.return_value = b"User-agent: *\nDisallow: /\n"
        response.__enter__.return_value = response

        class FakeOpener:
            def open(self, request, timeout):
                response.geturl.return_value = request.full_url
                return response

        with patch.object(collector, "_wait_for_rate_limit"), patch.object(collector_module.urllib.request, "build_opener", return_value=FakeOpener()) as build:
            result = collector.run()
        self.assertEqual(result["total_visited"], 0)
        self.assertEqual(result["http_attempts"], 3)
        self.assertEqual(result["max_request_attempts"], 4)
        self.assertEqual(build.call_count, 3)

    def test_encoded_and_dot_segment_paths_fail_closed(self):
        collector = self.make_collector(seed_urls=[])
        for path in ("/%61pi/v1", "/public%2fapi", "/public/../api/private", "/public/./listing", "/api.json"):
            with self.subTest(path=path):
                self.assertFalse(collector._allowed(self.origin + path) and collector_module._path_allowed(self.origin + path))

    def test_all_redirects_are_rejected_until_destination_is_explicitly_seeded(self):
        handler = _NoRedirectHandler()
        request = urllib.request.Request(self.seed)
        for target in (
            self.seed + "/allowed",
            "http://allowed.example/listings/allowed",
            "https://allowed.example:444/listings/allowed",
            "https://evil.example/listings/allowed",
            "https://allowed.example/account/private",
            "https://allowed.example/listings/denied",
            "https://allowed.example/listings/allowed?token=private",
        ):
            with self.subTest(target=target), self.assertRaises(urllib.error.HTTPError):
                handler.redirect_request(request, None, 302, "Found", {}, target)

    def test_robots_longest_match_allow_tie_wildcards_and_rate_hints(self):
        policy = collector_module.RobotsPolicy.parse(
            "User-agent: *\nAllow: /\nDisallow: /calendar\nAllow: /calendar/public\n"
            "Disallow: /private/*/book$\nCrawl-delay: 4\nRequest-rate: 1/7",
            "YellowPublicListingPrototype/0.1",
        )
        self.assertFalse(policy.can_fetch(self.origin + "/calendar/today"))
        self.assertTrue(policy.can_fetch(self.origin + "/calendar/public/one"))
        self.assertFalse(policy.can_fetch(self.origin + "/private/unit/book"))
        self.assertTrue(policy.can_fetch(self.origin + "/private/unit/book/extra"))
        self.assertEqual(policy.delay, 4)
        self.assertEqual(policy.request_rate, 7)

    def test_allow_then_disallow_order_does_not_create_first_rule_allow(self):
        policy = collector_module.RobotsPolicy.parse(
            "User-agent: *\nAllow: /\nDisallow: /private/", "YellowPublicListingPrototype/0.1"
        )
        self.assertFalse(policy.can_fetch(self.origin + "/private/item"))

    def test_robots_missing_error_and_deny_fail_closed(self):
        collector = self.make_collector()
        with patch.object(collector, "_fetch_url", return_value=(503, None)):
            self.assertFalse(collector._load_robots(self.origin + ":443"))
        self.assertIn(self.origin + ":443", collector.stopped_origins)

        parser = collector_module.RobotsPolicy.parse(
            "User-agent: *\nDisallow: /listings", collector.user_agent
        )
        collector.robot_parsers[self.origin + ":443"] = parser
        self.assertFalse(collector._is_allowed_by_robots(self.seed))

    def test_http_429_stops_origin(self):
        collector = self.make_collector()
        err = urllib.error.HTTPError(self.seed, 429, "Too Many Requests", {}, None)
        with patch.object(collector_module.urllib.request, "build_opener") as build:
            build.return_value.open.side_effect = err
            status, body = collector._fetch_url(self.seed, is_robots=True)
        self.assertEqual((status, body), (429, None))
        self.assertIn(self.origin + ":443", collector.stopped_origins)

    def test_actual_request_handler_rejects_redirect_and_stops_401_403(self):
        for status_code in (302, 401, 403):
            with self.subTest(status_code=status_code):
                collector = self.make_collector()
                error = urllib.error.HTTPError(self.seed, status_code, "stop", {}, None)
                with patch.object(collector, "_wait_for_rate_limit"), patch.object(collector, "_is_allowed_by_robots", return_value=True), patch.object(collector_module.urllib.request, "build_opener") as build:
                    build.return_value.open.side_effect = error
                    status, body = collector._fetch_url(self.seed)
                self.assertEqual((status, body), (status_code, None))
                build.assert_called_once()
                if status_code in (401, 403):
                    self.assertIn(self.origin + ":443", collector.stopped_origins)

    def test_request_uses_configured_timeout(self):
        collector = self.make_collector(timeout_seconds=7.5)
        response = MagicMock()
        response.geturl.return_value = self.seed
        response.status = 200
        response.read.return_value = b""
        response.__enter__.return_value = response
        with patch.object(collector, "_wait_for_rate_limit"), patch.object(collector, "_is_allowed_by_robots", return_value=True), patch.object(collector_module.urllib.request, "build_opener") as build:
            build.return_value.open.return_value = response
            collector._fetch_url(self.seed)
        build.return_value.open.assert_called_once()
        self.assertEqual(build.return_value.open.call_args.kwargs["timeout"], 7.5)

    def test_minimum_three_second_spacing_is_enforced(self):
        collector = self.make_collector()
        origin = self.origin + ":443"
        collector.last_request_at[origin] = 10.0
        collector.request_intervals[origin] = 5.0
        with patch.object(collector_module.time, "monotonic", side_effect=[11.0, 11.0]), patch.object(collector_module.time, "sleep") as sleep:
            collector._wait_for_rate_limit(origin)
        sleep.assert_called_once_with(4.0)

    def test_response_limit_reads_only_limit_plus_one(self):
        collector = self.make_collector(max_response_bytes=10)
        response = MagicMock()
        response.geturl.return_value = self.seed
        response.status = 200
        response.read.return_value = b"x" * 11
        response.__enter__.return_value = response
        with patch.object(collector, "_is_allowed_by_robots", return_value=True), patch.object(collector_module.urllib.request, "build_opener") as build:
            build.return_value.open.return_value = response
            status, body = collector._fetch_url(self.seed)
        response.read.assert_called_once_with(11)
        self.assertEqual((status, body), (0, None))
        self.assertTrue(any(e["error"] == "response_size_limit_exceeded" for e in collector.errors))

    def test_metadata_only_cache_resumes_without_duplicate_page_fetch(self):
        collector = self.make_collector()
        self.set_robots(collector)
        body = b'<script type="application/ld+json">{"@type":"Apartment","@id":"a1","name":"Studio","numberOfBedrooms":1}</script>'
        with patch.object(collector, "_load_robots", return_value=True), patch.object(collector, "_fetch_url", return_value=(200, body)):
            first = collector.run()
        self.assertEqual(first["fetched_pages"], 1)
        with open(self.cache, encoding="utf-8") as cache_file:
            saved = json.load(cache_file)
        self.assertNotIn("content", json.dumps(saved).lower())
        self.assertNotIn(body.decode(), json.dumps(saved))
        self.assertIn("source_sha256", first["records"][0])
        self.assertIn("fetched_at", first["records"][0])

        resumed = self.make_collector()
        self.set_robots(resumed)
        with patch.object(resumed, "_load_robots", return_value=True), patch.object(resumed, "_fetch_url") as fetch:
            second = resumed.run()
        fetch.assert_not_called()
        self.assertEqual(second["cached_pages"], 1)
        self.assertEqual(second["records"], first["records"])

    def test_changed_seed_or_limits_invalidates_cache_scope(self):
        first = self.make_collector()
        first.cache_state["entries"][self.seed] = {
            "source_sha256": "a" * 64, "fetched_at": "2026-09-25T00:00:00+00:00", "records": [], "links": []
        }
        first._save_cache()
        changed = self.make_collector(max_pages=3)
        self.assertEqual(changed.cache_state["entries"], {})
        self.assertTrue(any("scope_mismatch" in row["error"] for row in changed.errors))

    def test_corrupt_cache_resets_without_reading_or_fetching(self):
        Path(self.cache).write_text("not json", encoding="utf-8")
        collector = self.make_collector()
        self.assertEqual(collector.cache_state["entries"], {})
        self.assertTrue(any(row["error"] == "corrupt_cache_reset" for row in collector.errors))

    def test_legacy_v1_cache_is_rejected_after_metadata_schema_change(self):
        Path(self.cache).write_text(json.dumps({
            "schema_version": 1,
            "scope": {"allowed_origins": [self.origin + ":443"]},
            "entries": {
                self.seed: {
                    "source_sha256": "a" * 64,
                    "fetched_at": "2026-09-25T00:00:00+00:00",
                    "records": [{"source_url": self.seed, "id": self.seed, "title": "Legacy candidate"}],
                    "links": [],
                }
            },
        }), encoding="utf-8")
        collector = self.make_collector()
        self.assertEqual(collector.cache_state["entries"], {})
        self.assertTrue(any(row["error"] == "cache_schema_mismatch_reset" for row in collector.errors))

    def test_incomplete_cache_record_invalidates_page_for_refetch(self):
        collector = self.make_collector()
        collector.cache_state["entries"][self.seed] = {
            "source_sha256": "a" * 64,
            "fetched_at": "2026-09-25T00:00:00+00:00",
            "records": [{"source_url": self.seed, "id": "legacy", "title": "Missing new contract fields"}],
            "links": [],
        }
        collector._save_cache()
        loaded = self.make_collector()
        self.assertEqual(loaded.cache_state["entries"], {})
        self.assertTrue(any(row["error"] == "invalid_cache_entries_skipped" for row in loaded.errors))

    def test_parser_extracts_jsonld_and_anchor_only_not_other_scripts(self):
        html = (
            '<a href="/listings/one">one</a>'
            '<script>window.secret="ignore"</script>'
            '<script type="application/ld+json">'
            '{"@type":"Apartment","name":"Quiet Flat","numberOfBedrooms":2,'
            '"address":{"addressLocality":"Dubai"},"geo":{"latitude":25.2,"longitude":55.3},'
            '"description":"must not be stored"}</script>'
        )
        parser = HTMLLinkAndJSONLDParser()
        parser.feed(html)
        self.assertEqual(parser.links, ["/listings/one"])
        self.assertEqual(len(parser.jsonld_blocks), 1)
        collector = self.make_collector(seed_urls=[])
        rows, links = collector.extract_metadata(html, self.seed)
        self.assertEqual(links, [self.origin + "/listings/one"])
        self.assertEqual(rows[0]["title"], "Quiet Flat")
        self.assertNotIn("description", rows[0])
        self.assertEqual(rows[0]["location_precision"], "public_point_unverified")
        self.assertEqual(rows[0]["availability_status"], "unknown")
        self.assertEqual(rows[0]["observation_kind"], "public_metadata_candidate")

    def test_multiple_entities_keep_distinct_ids_and_never_claim_inventory(self):
        collector = self.make_collector(seed_urls=[])
        html = (
            '<script type="application/ld+json">{"@graph":['
            '{"@type":"Accommodation","name":"North Studio"},'
            '{"@type":"Accommodation","name":"South Studio"},'
            '{"@type":"LodgingBusiness","name":"Example Operator"},'
            '{"@type":"Apartment"}]}</script>'
        )
        rows, _ = collector.extract_metadata(html, self.seed)
        self.assertEqual([row["title"] for row in rows], ["North Studio", "South Studio"])
        self.assertNotEqual(rows[0]["id"], rows[1]["id"])
        self.assertTrue(all(row["availability_status"] == "unknown" for row in rows))

    def test_hotel_and_vacation_rental_schema_types_are_supported_as_candidates(self):
        collector = self.make_collector(seed_urls=[])
        html = (
            '<script type="application/ld+json">['
            '{"@type":"Hotel","name":"Hotel A"},'
            '{"@type":"VacationRental","name":"Rental B"}]</script>'
        )
        rows, _ = collector.extract_metadata(html, self.seed)
        self.assertEqual({row["property_type"] for row in rows}, {"Hotel", "VacationRental"})
        self.assertTrue(all(row["availability_status"] == "unknown" for row in rows))

    def test_entity_id_drops_query_tokens_and_ambiguous_nodes_are_skipped(self):
        collector = self.make_collector(seed_urls=[])
        html = (
            '<script type="application/ld+json">['
            '{"@type":"Apartment","@id":"https://allowed.example/unit?id=secret","name":"A"},'
            '{"@type":"Apartment"}]</script>'
        )
        rows, _ = collector.extract_metadata(html, self.seed)
        self.assertEqual(len(rows), 1)
        self.assertNotIn("secret", rows[0]["id"])

    def test_links_drop_query_and_cross_origin_or_account_paths(self):
        collector = self.make_collector(seed_urls=[])
        html = '<a href="/stay?id=private-token">stay</a><a href="https://evil.example/x">x</a><a href="/account/profile">account</a>'
        _, links = collector.extract_metadata(html, self.seed)
        self.assertEqual(links, [self.origin + "/stay"])

    def test_full_address_string_is_not_misreported_as_locality(self):
        collector = self.make_collector(seed_urls=[])
        html = '<script type="application/ld+json">{"@type":"Apartment","name":"Street listing","address":"12 Example Street, Dubai"}</script>'
        rows, _ = collector.extract_metadata(html, self.seed)
        self.assertIsNone(rows[0]["locality"])

    def test_bedroom_field_is_not_guessed_from_rooms_and_values_are_capped(self):
        collector = self.make_collector(seed_urls=[])
        html = (
            '<script type="application/ld+json">['
            '{"@type":"Apartment","name":"A","numberOfRooms":3},'
            '{"@type":"Apartment","name":"B","numberOfBedrooms":"99999"}]</script>'
        )
        rows, _ = collector.extract_metadata(html, self.seed)
        self.assertEqual([row["bedrooms"] for row in rows], [None, None])

    def test_max_page_limit_bounds_anchor_fanout(self):
        collector = self.make_collector(max_pages=1)
        self.set_robots(collector)
        body = b'<a href="/listings/a">a</a><a href="/listings/b">b</a>'
        with patch.object(collector, "_load_robots", return_value=True), patch.object(collector, "_fetch_url", return_value=(200, body)) as fetch:
            result = collector.run()
        fetch.assert_called_once_with(self.seed)
        self.assertEqual(result["total_visited"], 1)

    def test_cli_requires_explicit_sources_and_writes_only_requested_report(self):
        output = os.path.join(self.temp.name, "report.json")
        fake = MagicMock()
        fake.run.return_value = {"records": [], "errors": [], "coverage_scope_note": "explicit seeds only"}
        with patch.object(collector_module, "PublicListingCollector", return_value=fake) as constructor, patch("builtins.print"):
            code = collector_module.main([
                "--origin", self.origin, "--seed", self.seed, "--cache", self.cache,
                "--max-pages", "2", "--output-data", output,
            ])
        self.assertEqual(code, 0)
        constructor.assert_called_once()
        fake.run.assert_called_once()
        with open(output, encoding="utf-8") as report_file:
            self.assertEqual(json.load(report_file)["coverage_scope_note"], "explicit seeds only")

    def test_cli_refuses_existing_output_before_running_collector(self):
        output = os.path.join(self.temp.name, "existing.json")
        Path(output).write_text("preserve", encoding="utf-8")
        fake = MagicMock()
        with patch.object(collector_module, "PublicListingCollector", return_value=fake), patch("builtins.print"), patch("argparse.ArgumentParser.error", side_effect=ValueError("expected refusal")):
            with self.assertRaises(ValueError):
                collector_module.main([
                    "--origin", self.origin, "--seed", self.seed, "--cache", self.cache,
                    "--output-data", output,
                ])
        fake.run.assert_not_called()
        self.assertEqual(Path(output).read_text(encoding="utf-8"), "preserve")

    def test_duplicate_records_deduplicate_by_source_and_id(self):
        collector = self.make_collector()
        self.set_robots(collector)
        body = b'<script type="application/ld+json">[{"@type":"Apartment","@id":"same"},{"@type":"Apartment","@id":"same"}]</script>'
        with patch.object(collector, "_load_robots", return_value=True), patch.object(collector, "_fetch_url", return_value=(200, body)):
            result = collector.run()
        self.assertEqual(result["records_extracted"], 1)


if __name__ == "__main__":
    unittest.main()
