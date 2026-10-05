"""Synthetic offline pipeline proof; every transport response is injected."""
import copy
from datetime import datetime, timedelta, timezone
import email.message
import importlib.util
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest
import urllib.error
from unittest.mock import MagicMock, patch

SOURCE_DIR = Path(__file__).resolve().parents[2] / 'scripts/market-prototype'
sys.path.insert(0, str(SOURCE_DIR))
SPEC = importlib.util.spec_from_file_location('market_pipeline', SOURCE_DIR / 'market_pipeline.py')
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)

BODY = b'''<script type="application/ld+json">{"@type":"Hotel","name":"Synthetic hotel",
 "offers":{"price":"123.45","priceCurrency":"AED"}}</script>'''


class Response:
    def __init__(self, url, body, content_type):
        self.url, self.body, self.status = url, body, 200
        self.headers = email.message.Message()
        self.headers['Content-Type'] = content_type

    def geturl(self):
        return self.url

    def read(self, size):
        return self.body[:size]

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name) / 'state'
        self.requests, self.sleeps, self.responses = [], [], {}
        self.now = datetime(2026, 9, 25, 12, tzinfo=timezone.utc)
        self.seconds = self.now.timestamp()
        self.robots = b'User-agent: *\nAllow: /\n'
        self.active_requests = 0
        for mocked in (
            patch.object(mod, '_now', side_effect=lambda: self.now),
            patch('rate_fetch.time.time', side_effect=lambda: self.seconds),
            patch('rate_fetch.time.sleep', side_effect=self.sleep),
            patch('urllib.request.build_opener', side_effect=lambda *a, **k: MagicMock(open=self.open)),
            patch.object(socket, 'getaddrinfo', side_effect=AssertionError('real network forbidden')),
        ):
            mocked.start()
            self.addCleanup(mocked.stop)

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.seconds += seconds

    def open(self, request, timeout):
        self.assertEqual(self.active_requests, 0, 'transport must remain sequential')
        self.active_requests += 1
        try:
            self.requests.append(request.full_url)
            state = self.read_state()
            origin = mod._origin(request.full_url)
            self.assertGreater(state['sources'][origin]['pending'], 0, 'reserve before dispatch')
            self.assertGreaterEqual(state['charged_requests'], state['sources'][origin]['pending'])
            self.assertEqual(timeout, 10.0)
            value = self.responses.get(request.full_url)
            if callable(value):
                value = value()
            if isinstance(value, BaseException):
                raise value
            robots = request.full_url.endswith('/robots.txt')
            body = value if value is not None else self.robots if robots else BODY
            return Response(request.full_url, body, 'text/plain' if robots else 'text/html')
        finally:
            self.active_requests -= 1

    def manifest(self, names=('a', 'b'), count=2, limit=100, per_source=20, run_limit=20):
        return dict(schema=mod.MANIFEST_SCHEMA, daily_request_limit=limit, max_requests=run_limit,
                    sources=[dict(origin=f'https://{name}.example', daily_request_limit=per_source,
                                  urls=[f'https://{name}.example/hotel{i}' for i in range(count)]) for name in names])

    def run_pipeline(self, manifest=None):
        return mod.Pipeline(self.manifest() if manifest is None else manifest, self.directory).run()

    def read_state(self):
        return json.loads((self.directory / 'pipeline.json').read_text())

    def write_state(self, state):
        (self.directory / 'pipeline.json').write_text(json.dumps(state))

    def test_round_robin_sequential_reservation_refund_and_candidate_resume(self):
        first = self.run_pipeline()
        self.assertEqual(self.requests, ['https://a.example/robots.txt', 'https://a.example/hotel0',
                                      'https://b.example/robots.txt', 'https://b.example/hotel0',
                                      'https://a.example/hotel1', 'https://b.example/hotel1'])
        self.assertEqual(first['http_attempts'], 6)
        self.assertEqual(first['daily_charged_requests'], 6)
        self.assertEqual(first['daily_confirmed_requests'], 6)
        self.assertEqual([s['remaining_daily_requests'] for s in first['sources']], [17, 17])
        self.assertEqual(len(first['candidates']), 4)
        self.assertEqual(first['calendar_quote_count'], 0)
        self.assertFalse(first['whole_market_coverage_claimed'])
        self.assertTrue(all(r['amount_minor'] == 12345 and r['checkin'] is None and r['checkout'] is None
                            and r['amount_basis'] == 'unknown' for r in first['candidates']))
        self.assertTrue(all(delay >= 5 for delay in self.sleeps))
        second = self.run_pipeline()
        self.assertEqual(second['http_attempts'], 0)
        self.assertEqual(second['daily_charged_requests'], 6)
        self.assertEqual(second['candidates'], first['candidates'])
        self.assertTrue(all(r['status'] == 'retained' for s in second['sources'] for r in s['results']))
        self.assertNotIn('Synthetic hotel', ''.join(p.read_text() for p in self.directory.glob('origin-*.json')))

    def test_global_daily_cap_includes_robots_and_persists_across_runs(self):
        manifest = self.manifest(limit=3)
        first = self.run_pipeline(manifest)
        self.assertEqual(first['http_attempts'], 3)
        self.assertEqual(first['remaining_daily_requests'], 0)
        self.assertEqual(first['sources'][1]['retained_pages'], 0)
        self.assertEqual(self.run_pipeline(manifest)['http_attempts'], 0)
        self.assertEqual(len(self.requests), 3)

    def test_per_origin_daily_budget_survives_reordered_manifest_and_more_urls(self):
        manifest = self.manifest(per_source=2)
        first = self.run_pipeline(manifest)
        self.assertEqual([s['http_attempts'] for s in first['sources']], [2, 2])
        changed = self.manifest(names=('b', 'a'), count=3, per_source=2)
        self.assertEqual(self.run_pipeline(changed)['http_attempts'], 0)
        self.assertEqual(len(self.requests), 4)

    def test_invocation_cap_and_cursor_prevent_first_source_starvation(self):
        manifest = self.manifest(names=('a', 'b', 'c'), run_limit=2)
        first = self.run_pipeline(manifest)
        self.assertEqual(first['http_attempts'], 2)
        second = self.run_pipeline(manifest)
        self.assertEqual(second['http_attempts'], 2)
        self.assertEqual(self.requests[2], 'https://b.example/robots.txt')
        self.run_pipeline(manifest)
        self.assertEqual(self.requests[4], 'https://c.example/robots.txt')

    def test_next_utc_day_resets_budgets_but_retains_successes_and_stops(self):
        manifest = self.manifest(per_source=2)
        self.responses['https://b.example/robots.txt'] = b'User-agent: *\nDisallow: /\n'
        self.run_pipeline(manifest)
        self.now += timedelta(days=1)
        self.seconds += 86400
        report = self.run_pipeline(manifest)
        self.assertEqual(report['http_attempts'], 2)
        self.assertEqual(report['sources'][1]['status'], 'blocked')
        self.assertEqual(report['sources'][1]['stop_reason'], 'robots_disallowed')
        self.assertEqual(self.requests.count('https://b.example/robots.txt'), 1)

    def test_midnight_crossing_batch_is_conservatively_charged_to_new_day(self):
        def cross():
            self.now += timedelta(days=1)
            return BODY
        self.responses['https://a.example/hotel0'] = cross
        report = self.run_pipeline(self.manifest(names=('a',), count=1, limit=2, per_source=2))
        self.assertEqual(report['day'], '2026-09-26')
        self.assertEqual(report['daily_charged_requests'], 2)
        self.assertEqual(report['remaining_daily_requests'], 0)

    def test_blocked_source_does_not_prevent_other_source_and_stays_blocked(self):
        self.responses['https://a.example/hotel0'] = urllib.error.HTTPError(
            'https://a.example/hotel0', 429, 'limited', {}, None)
        first = self.run_pipeline()
        self.assertEqual(first['sources'][0]['stop_reason'], 'http_429')
        self.assertEqual(first['sources'][1]['retained_pages'], 2)
        self.assertEqual(self.run_pipeline()['http_attempts'], 0)
        self.assertNotIn('https://a.example/hotel1', self.requests)

    def test_publisher_pacing_is_unchanged(self):
        self.robots = b'User-agent: *\nCrawl-delay: 17\nAllow: /\n'
        self.run_pipeline(self.manifest(names=('a',), count=2))
        self.assertEqual(self.sleeps, [17.0, 17.0])

    def test_crash_after_fetch_charges_full_reservation_stops_and_never_refetches(self):
        manifest = self.manifest(names=('a',), count=1)
        with patch.object(mod.Pipeline, '_retain', side_effect=RuntimeError('synthetic disk failure')):
            with self.assertRaisesRegex(RuntimeError, 'synthetic disk failure'):
                self.run_pipeline(manifest)
        state = self.read_state()
        self.assertEqual(state['charged_requests'], 2)
        self.assertEqual(state['confirmed_requests'], 0)
        self.assertEqual(state['sources']['https://a.example']['pending'], 2)
        resumed = self.run_pipeline(manifest)
        self.assertEqual(resumed['http_attempts'], 0)
        self.assertEqual(resumed['sources'][0]['stop_reason'], 'interrupted_batch_requires_review')
        self.assertEqual(resumed['sources'][0]['retained_pages'], 0)
        self.assertEqual(resumed['sources'][0]['results'][0]['status'], 'missing_output_requires_inspection')
        self.assertEqual(resumed['candidates'], [])
        self.assertEqual(len(self.requests), 2)

    def test_interrupted_reservation_not_refunded_on_day_rollover(self):
        manifest = self.manifest(names=('a',), count=1, limit=2)
        with patch.object(mod.Pipeline, '_retain', side_effect=KeyboardInterrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.run_pipeline(manifest)
        self.now += timedelta(days=1)
        resumed = self.run_pipeline(manifest)
        self.assertEqual(resumed['daily_charged_requests'], 2)
        self.assertEqual(resumed['daily_confirmed_requests'], 0)
        self.assertEqual(resumed['http_attempts'], 0)

    def test_successful_metadata_without_output_is_explicit_and_never_refetched(self):
        manifest = self.manifest(names=('a',), count=1)
        self.run_pipeline(manifest)
        state = self.read_state()
        state['sources']['https://a.example']['pages'] = {}
        self.write_state(state)
        report = self.run_pipeline(manifest)
        result = report['sources'][0]['results'][0]
        self.assertEqual(result['status'], 'missing_output_requires_inspection')
        self.assertFalse(result['retained'])
        self.assertEqual(report['http_attempts'], 0)
        self.assertEqual(report['candidates'], [])

    def test_crash_after_retention_preserves_candidates_without_claiming_completed_batch(self):
        manifest = self.manifest(names=('a',), count=1)
        original = mod.Pipeline._retain
        def crash(pipeline, *args):
            original(pipeline, *args)
            raise RuntimeError('crash after durable extraction')
        with patch.object(mod.Pipeline, '_retain', crash):
            with self.assertRaises(RuntimeError):
                self.run_pipeline(manifest)
        report = self.run_pipeline(manifest)
        self.assertEqual(report['http_attempts'], 0)
        self.assertEqual(len(report['candidates']), 1)
        self.assertEqual(report['sources'][0]['status'], 'blocked')

    def test_lock_is_exclusive_and_is_not_removed_by_other_runner(self):
        self.directory.mkdir()
        lock = self.directory / 'pipeline.lock'
        lock.write_text('synthetic existing owner')
        with self.assertRaisesRegex(RuntimeError, 'pipeline_locked'):
            self.run_pipeline()
        self.assertEqual(lock.read_text(), 'synthetic existing owner')
        self.assertEqual(self.requests, [])

    def test_corrupt_state_and_duplicate_json_keys_fail_closed(self):
        self.directory.mkdir()
        for content in ('{', '{"schema":1,"schema":2}', 'NaN', '[]'):
            (self.directory / 'pipeline.json').write_text(content)
            with self.assertRaisesRegex(ValueError, 'pipeline_state_invalid'):
                self.run_pipeline()
        self.assertEqual(self.requests, [])

    def test_corrupt_second_checkpoint_prevents_first_source_network(self):
        manifest = self.manifest(count=1)
        self.run_pipeline(manifest)
        pipeline = mod.Pipeline(manifest, self.directory)
        pipeline.checkpoint('https://b.example').write_text('{}')
        manifest = self.manifest(count=2)
        before = len(self.requests)
        with self.assertRaisesRegex(ValueError, 'checkpoint_invalid'):
            self.run_pipeline(manifest)
        self.assertEqual(len(self.requests), before)

    def test_missing_budget_or_known_checkpoint_cannot_reset_existing_state(self):
        manifest = self.manifest(names=('a',), count=1)
        self.run_pipeline(manifest)
        pipeline = mod.Pipeline(manifest, self.directory)
        saved = pipeline.path.read_text()
        pipeline.path.unlink()
        with self.assertRaisesRegex(ValueError, 'missing_budget'):
            self.run_pipeline(manifest)
        pipeline.path.write_text(saved)
        pipeline.checkpoint('https://a.example').unlink()
        with self.assertRaisesRegex(ValueError, 'missing_existing_origin_checkpoint'):
            self.run_pipeline(manifest)
        self.assertEqual(len(self.requests), 2)

    def test_budget_configuration_cannot_be_raised_by_new_manifest(self):
        manifest = self.manifest(limit=10, per_source=5)
        self.run_pipeline(manifest)
        for changed in (self.manifest(limit=11, per_source=5), self.manifest(limit=10, per_source=6)):
            with self.assertRaisesRegex(ValueError, 'persistent_.*limit_mismatch'):
                self.run_pipeline(changed)

    def test_corrupt_budget_or_invented_calendar_candidates_fail_closed(self):
        manifest = self.manifest(names=('a',), count=1)
        self.run_pipeline(manifest)
        pristine = self.read_state()
        for mutation in ('budget', 'date', 'currency', 'extra', 'float', 'huge'):
            state = copy.deepcopy(pristine)
            page = next(iter(state['sources']['https://a.example']['pages'].values()))
            row = page['candidates'][0]
            if mutation == 'budget':
                state['charged_requests'] = 0
            elif mutation == 'date':
                row['checkin'] = '2026-10-01'
            elif mutation == 'currency':
                row['currency'] = 'UNKNOWN'
            elif mutation == 'extra':
                row['email'] = 'private data'
            elif mutation == 'float':
                row['amount_minor'] = 1.1
            else:
                state['sources']['https://a.example']['pages'] = dict.fromkeys(
                    [f'https://a.example/hotel{i}' for i in range(1001)], page)
            self.write_state(state)
            with self.assertRaisesRegex(ValueError, 'pipeline_state_invalid'):
                self.run_pipeline(manifest)
        self.assertEqual(len(self.requests), 2)

    def test_manifest_rejects_duplicate_origins_urls_unsafe_routes_and_excess_limits(self):
        mutations = []
        for key, value in [('max_requests', 101), ('max_requests', True), ('daily_request_limit', 0), ('sources', [])]:
            m = self.manifest()
            m[key] = value
            mutations.append(m)
        m = self.manifest(names=('a', 'a'))
        mutations.append(m)
        m = self.manifest(names=('a', 'b', 'c', 'd', 'e', 'f'))
        mutations.append(m)
        for url in ('http://a.example/hotel', 'https://a.example/api/data', 'https://127.0.0.1/',
                    'https://a.example/hotel?token=secret', 'https://other.example/hotel',
                    'https://a.example/hotel#fragment'):
            m = self.manifest(names=('a',))
            m['sources'][0]['urls'] = [url]
            mutations.append(m)
        m = self.manifest(names=('a',))
        m['sources'][0]['urls'] *= 2
        mutations.append(m)
        mutations.append(self.manifest(names=('a',), count=201))
        mutations.append(self.manifest(names=('bnbmehomes.com',)))
        mutations[-1]['sources'][0]['origin'] = 'https://bnbmehomes.com'
        for invalid in mutations:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                self.run_pipeline(invalid)
        self.assertEqual(self.requests, [])

    def test_source_registry_cannot_rotate_out_old_origin_stops(self):
        self.run_pipeline(self.manifest(names=('a', 'b', 'c', 'd', 'e'), count=1))
        before = len(self.requests)
        with self.assertRaisesRegex(ValueError, 'persistent_source_registry_limit'):
            self.run_pipeline(self.manifest(names=('f',), count=1))
        self.assertEqual(len(self.requests), before)

    def test_clock_reversal_is_fail_closed(self):
        self.run_pipeline()
        self.now -= timedelta(days=1)
        with self.assertRaisesRegex(ValueError, 'utc_clock_moved_backwards'):
            self.run_pipeline()

    def test_retained_evidence_must_match_transport_before_any_network(self):
        manifest = self.manifest(names=('a', 'b'), count=1)
        self.run_pipeline(manifest)
        pipeline = mod.Pipeline(manifest, self.directory)
        checkpoint = pipeline.checkpoint('https://b.example')
        original = checkpoint.read_text()
        for mode in ('changed_hash', 'missing_entry'):
            data = json.loads(original)
            if mode == 'changed_hash':
                data['entries']['https://b.example/hotel0']['source_sha256'] = '0' * 64
            else:
                data['entries'] = {}
            checkpoint.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, 'retained_output_checkpoint_mismatch'):
                self.run_pipeline(self.manifest(names=('a', 'b'), count=2))
        self.assertEqual(len(self.requests), 4)

    def test_uncreated_checkpoint_flag_cannot_hide_recorded_source_activity(self):
        manifest = self.manifest(names=('a',), count=1)
        self.run_pipeline(manifest)
        state = self.read_state()
        state['sources']['https://a.example']['checkpoint_created'] = False
        self.write_state(state)
        checkpoint = mod.Pipeline(manifest, self.directory).checkpoint('https://a.example')
        checkpoint.unlink()
        with self.assertRaisesRegex(ValueError, 'pipeline_state_invalid'):
            self.run_pipeline(manifest)
        self.assertFalse(checkpoint.exists())
        self.assertEqual(len(self.requests), 2)

    def test_one_hundred_request_ceiling_includes_all_five_sources_robots(self):
        report = self.run_pipeline(self.manifest(names=('a', 'b', 'c', 'd', 'e'),
                                                count=40, per_source=20, run_limit=100))
        self.assertEqual(len(self.requests), 100)
        self.assertEqual(report['http_attempts'], 100)
        self.assertEqual([s['http_attempts'] for s in report['sources']], [20] * 5)
        self.assertEqual(len(report['candidates']), 95)
        self.assertEqual(report['remaining_daily_requests'], 0)

    def test_separate_process_respects_budget_and_live_exclusive_lock(self):
        manifest_path = Path(self.temp.name) / 'manifest.json'
        manifest = self.manifest(limit=3)
        manifest_path.write_text(json.dumps(manifest))
        self.run_pipeline(manifest)
        code = '''import sys, socket
from datetime import datetime, timezone
sys.path.insert(0, sys.argv.pop(1))
import market_pipeline
market_pipeline._now = lambda: datetime(2026, 9, 25, 12, tzinfo=timezone.utc)
def denied(*args, **kwargs):
    raise AssertionError('unexpected DNS in separate process')
socket.getaddrinfo = denied
raise SystemExit(market_pipeline.main())
'''
        output = Path(self.temp.name) / 'child.json'
        args = [sys.executable, '-c', code, str(SOURCE_DIR), '--manifest', str(manifest_path),
                '--state-dir', str(self.directory), '--output', str(output)]
        result = subprocess.run(args, capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(output.read_text())['http_attempts'], 0)
        self.assertEqual(json.loads(output.read_text())['remaining_daily_requests'], 0)
        args[-1] = str(Path(self.temp.name) / 'blocked-child.json')
        lock = self.directory / 'pipeline.lock'
        with lock.open('x'):
            result = subprocess.run(args, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 2)
            self.assertIn('pipeline_locked', result.stderr)
        self.assertEqual(len(self.requests), 3)

    def test_cli_writes_new_report_and_refuses_state_output_or_existing_report(self):
        manifest = Path(self.temp.name) / 'manifest.json'
        manifest.write_text(json.dumps(self.manifest(names=('a',), count=1)))
        output = Path(self.temp.name) / 'report.json'
        args = ['--manifest', str(manifest), '--state-dir', str(self.directory), '--output', str(output)]
        with patch('builtins.print'):
            self.assertEqual(mod.main(args), 0)
        self.assertEqual(json.loads(output.read_text())['http_attempts'], 2)
        with self.assertRaises(SystemExit) as caught:
            mod.main(args)
        self.assertEqual(caught.exception.code, 2)
        args[-1] = str(self.directory / 'unexpected.json')
        with self.assertRaises(SystemExit):
            mod.main(args)
        self.assertEqual(len(self.requests), 2)

    def test_oversized_manifest_and_state_are_bounded(self):
        manifest = Path(self.temp.name) / 'manifest.json'
        manifest.write_bytes(b' ' * (mod.MAX_MANIFEST_BYTES + 1))
        with self.assertRaisesRegex(ValueError, 'input_size_limit'):
            mod._read(manifest, mod.MAX_MANIFEST_BYTES)
        self.directory.mkdir()
        (self.directory / 'pipeline.json').write_bytes(b' ' * (mod.MAX_STATE_BYTES + 1))
        with self.assertRaisesRegex(ValueError, 'pipeline_state_invalid'):
            self.run_pipeline()


if __name__ == '__main__':
    unittest.main()
