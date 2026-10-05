"""Offline evidence, price precision and CLI tests; never real market fixtures."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts' / 'market-prototype'))
import rate_observations as rates


def quote(**overrides):
    row = dict(property_id='synthetic-001', source='google_hotels',
               source_url='https://www.google.com/travel/hotels',
               source_kind='manual_observation', seller='Synthetic seller',
               checkin='2026-10-01', checkout='2026-10-02', adults=2,
               children=0, rooms=1, currency='AED', amount='501.25',
               amount_basis='stay_total', taxes_included='unknown',
               fees_included='unknown', room_type=None, rate_plan=None,
               observed_at='2026-09-25T08:30:00+00:00', evidence_sha256='a' * 64)
    row.update(overrides)
    return row


class QuoteTests(unittest.TestCase):
    def test_exact_money(self):
        self.assertEqual(rates.money_minor('501.25', 'AED'), 50125)
        self.assertEqual(rates.money_minor('1.001', 'KWD'), 1001)
        self.assertEqual(rates.money_minor('1200', 'JPY'), 1200)
        for amount, currency in [('1.001', 'AED'), ('NaN', 'AED'),
                                 ('1e6', 'AED'), ('-1', 'AED'),
                                 ('1,200', 'AED'), ('1', 'ZZZ'), (1.25, 'AED')]:
            with self.subTest(amount=amount), self.assertRaises(ValueError):
                rates.money_minor(amount, currency)

    def test_quote_preserves_unknown_and_provenance(self):
        row = rates.normalize_quotes([quote()])[0]
        self.assertEqual(row['amount_minor'], 50125)
        self.assertEqual(row['taxes_included'], 'unknown')
        self.assertEqual(row['evidence_sha256'], 'a' * 64)
        self.assertEqual(row['verification'], 'supplied_not_independently_verified')
        self.assertEqual(row['nights'], 1)

    def test_bad_date_context_rejected(self):
        for updates in [dict(checkin='2026-02-30'), dict(checkout='2026-10-01'),
                        dict(checkin='20261001'), dict(adults=True), dict(adults=0),
                        dict(rooms=0), dict(children=-1), dict(observed_at='2026-09-25'),
                        dict(amount_basis='from'), dict(evidence_sha256='missing'),
                        dict(source_kind='scraped_verified'), dict(taxes_included=True),
                        dict(source_url='https://user:password@example.com/'),
                        dict(source_url='https://example.com/?api_key=secret'),
                        dict(source_url='https://127.0.0.1/internal'),
                        dict(source_url='https://example.com:bad/rate'),
                        dict(source_url='https://localhost/rate'),
                        dict(observed_at='0001-01-01T00:00:00+01:00'),
                        dict(amount=None), dict(secret='no')]:
            with self.subTest(updates=updates), self.assertRaises(ValueError):
                rates.normalize_quotes([quote(**updates)])

    def test_identical_dedup_conflicting_same_capture_rejected(self):
        self.assertEqual(len(rates.normalize_quotes([quote(), quote()])), 1)
        with self.assertRaises(ValueError):
            rates.normalize_quotes([quote(), quote(amount='600')])
        self.assertEqual(len(rates.normalize_quotes([
            quote(), quote(observed_at='2026-09-25T09:30:00Z', amount='600')])), 2)

    def test_context_not_merged(self):
        self.assertEqual(len(rates.normalize_quotes([
            quote(), quote(adults=1), quote(room_type='Suite'), quote(currency='USD')])), 4)

    def test_full_month_needs_exact_one_night_observations(self):
        rows = rates.normalize_quotes([quote(), quote(checkin='2026-10-03', checkout='2026-10-06')])
        report = rates.coverage(rows, '2026-10')
        self.assertEqual(report['groups'][0]['observed_one_night_dates'], ['2026-10-01'])
        self.assertEqual(len(report['groups'][0]['missing_one_night_dates']), 30)
        self.assertEqual(report['multi_night_observations'], 1)
        self.assertFalse(report['whole_market_coverage_claimed'])

    def test_empty_coverage_is_unknown(self):
        report = rates.coverage([], '2026-10')
        self.assertEqual(report['groups'], [])
        self.assertEqual(report['calendar_quote_count'], 0)
        self.assertEqual(report['days_in_month'], 31)

    def test_coverage_partitions_actual_source_origins(self):
        rows = rates.normalize_quotes([
            quote(source_url='https://one.example/hotel'),
            quote(source_url='https://two.example/hotel', checkin='2026-10-02', checkout='2026-10-03')])
        groups = rates.coverage(rows, '2026-10')['groups']
        self.assertEqual(len(groups), 2)
        self.assertTrue(all(len(g['missing_one_night_dates']) == 30 for g in groups))

    def test_duplicate_json_keys_fail_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder)/'input.json'
            source.write_text('[{"amount":"500","amount":"1"}]', encoding='utf-8')
            with self.assertRaises(ValueError):
                rates.read_json(source)
        body = '<script type="application/ld+json">{"@type":"Hotel","offers":{"price":"500","price":"1","priceCurrency":"AED"}}</script>'
        self.assertEqual(rates.extract_candidates(body, 'https://example.com/', 'b'*64,
                                                 '2026-09-25T00:00:00Z'), [])

    def test_jsonld_candidates_never_become_dated_quotes(self):
        body = '<script type="application/ld+json">' + json.dumps({
            '@type': 'Hotel', 'name': 'Synthetic hotel',
            'offers': [{'@type': 'Offer', 'price': '99.90', 'priceCurrency': 'AED'},
                       {'@type': 'AggregateOffer', 'lowPrice': '88', 'priceCurrency': 'AED'}]
        }) + '</script>'
        rows = rates.extract_candidates(body, 'https://example.com/hotel', 'b'*64,
                                        '2026-09-25T00:00:00Z')
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['amount_minor'], 9990)
        self.assertIsNone(rows[0]['checkin'])
        self.assertEqual(rows[0]['observation_kind'], 'undated_price_candidate')
        self.assertEqual(rows[1]['price_kind'], 'aggregate_low_price')
        self.assertEqual(rows[0]['availability_status'], 'unknown')

    def test_unrelated_offers_and_script_internals_not_read(self):
        body = '<script>{"price":55}</script><script type="application/ld+json">' + json.dumps({
            '@type': 'Product', 'offers': {'price': '10', 'priceCurrency': 'AED'}
        }) + '</script>'
        self.assertEqual(rates.extract_candidates(body, 'https://example.com/', 'b'*64,
                                                 '2026-09-25T00:00:00Z'), [])

    def test_invalid_jsonld_amount_skipped(self):
        body = '<script type="application/ld+json">' + json.dumps({
            '@graph': [{'@type': 'Hotel', 'offers': {'price': 'NaN', 'priceCurrency': 'AED'}}]
        }) + '</script>'
        self.assertEqual(rates.extract_candidates(body, 'https://example.com/', 'c'*64,
                                                 '2026-09-25T00:00:00Z'), [])

    def test_real_cli_no_network_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            source, output = Path(folder)/'input.json', Path(folder)/'report.json'
            source.write_text(json.dumps([quote()]), encoding='utf-8')
            cmd = [sys.executable, str(ROOT/'scripts/market-prototype/rate_observations.py'),
                   'import-quotes', '--input', str(source), '--month', '2026-10',
                   '--output', str(output)]
            result = subprocess.run(cmd, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            saved = output.read_bytes()
            data = json.loads(saved)
            self.assertEqual(data['quotes'][0]['amount_minor'], 50125)
            self.assertEqual(data['http_attempts'], 0)
            self.assertNotEqual(subprocess.run(cmd, capture_output=True).returncode, 0)
            self.assertEqual(output.read_bytes(), saved)

    def test_collect_cli_integration_does_not_promote_query_dates(self):
        import rate_fetch
        body = '<script type="application/ld+json">{"@type":"Hotel","name":"Synthetic","offers":{"price":"99.90","priceCurrency":"AED"}}</script>'
        class FakeFetcher:
            request_attempts = 2
            def __init__(self, **kwargs):
                pass
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass
            def fetch(self, url):
                return dict(status='ok', body=body, source_sha256='a'*64,
                            fetched_at='2026-09-25T00:00:00Z', reason=None, cached=False)
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder)/'report.json'
            with patch.object(rate_fetch, 'Fetcher', FakeFetcher), patch('builtins.print'):
                result = rates.main(['collect', '--origin', 'https://public.example',
                    '--url', 'https://public.example/hotel?checkin=2026-10-01',
                    '--checkpoint', str(Path(folder)/'checkpoint.json'), '--output', str(output)])
            self.assertEqual(result, 0)
            saved = json.loads(output.read_text())
            self.assertEqual(saved['http_attempts'], 2)
            self.assertEqual(saved['calendar_quote_count'], 0)
            self.assertEqual(saved['candidates'][0]['amount_minor'], 9990)
            self.assertIsNone(saved['candidates'][0]['checkin'])
            self.assertNotIn('body', saved['results'][0])


if __name__ == '__main__':
    unittest.main()
