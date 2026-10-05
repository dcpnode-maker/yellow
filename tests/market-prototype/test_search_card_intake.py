import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts' / 'market-prototype'))
from search_card_intake import COLUMNS, SEARCH_URL, compile_dataset, csv_safe, normalize_capture, write_exports


def fixture():
    return dict(schema='yellow.airbnb-ui-cards/v1', observed_at='2026-09-25T15:00:00Z',
                search_url=SEARCH_URL, requested_checkin='2026-10-01', requested_checkout='2026-10-02',
                currency='AED', fees_included='included', taxes_included='unknown', columns=COLUMNS,
                rows=[['1763362436102089053', 'Synthetic fixture', 'Flat in Dubai', '2026-10-01',
                       '2026-10-02', '2', 'ﺩ.ﺇ\u00a01,484', 'for 1 night', '1 bedroom', '2 beds',
                       '1.5 bathrooms', '4.95 out of 5 average rating, 41 reviews', None, None]])


class IntakeTests(unittest.TestCase):
    def test_exact_identity_money_and_unknown_location(self):
        result = normalize_capture(fixture())
        self.assertEqual(result['listings'][0]['listing_id'], '1763362436102089053')
        self.assertEqual(result['quotes'][0]['amount_minor'], 148400)
        self.assertIsNone(result['listings'][0]['latitude'])
        self.assertIsNone(result['observations'][0]['free_cancellation_displayed'])
        self.assertEqual(len(result['coverage']['groups'][0]['missing_one_night_dates']), 30)

    def test_alternative_multinight_not_requested_nightly(self):
        raw = fixture()
        raw['rows'][0][3:5] = ['2026-09-30', '2026-10-02']
        raw['rows'][0][7] = 'for 2 nights'
        result = normalize_capture(raw)
        self.assertEqual(result['receipt']['alternative_date_observations'], 1)
        self.assertEqual(result['quotes'][0]['amount_basis'], 'stay_total')
        self.assertEqual(result['quotes'][0]['amount_minor'], 148400)
        self.assertEqual(result['coverage']['calendar_quote_count'], 0)

    def test_dedupe_and_conflict(self):
        raw = fixture()
        raw['rows'].append(copy.deepcopy(raw['rows'][0]))
        self.assertEqual(normalize_capture(raw)['receipt']['deduplicated_rows'], 1)
        raw['rows'][1][6] = 'ﺩ.ﺇ 500'
        with self.assertRaises(ValueError):
            normalize_capture(raw)

    def test_reject_malformed_facts(self):
        for index, bad in [(0, 1763362436102089053), (0, '001'), (3, '2026-02-30'),
                           (7, 'for 3 nights'), (5, '3'), (6, '$123'), (6, 'ﺩ.ﺇ 1,48'),
                           (6, 'ﺩ.ﺇ 10.001'), (6, None), (11, '5.1 out of 5 average rating, 4 reviews'),
                           (14-1, 1), (8, 'unknown')]:
            raw = fixture()
            raw['rows'][0][index] = bad
            with self.subTest(index=index, bad=bad), self.assertRaises(ValueError):
                normalize_capture(raw)

    def test_context_validation(self):
        for field, bad in [('currency', 'USD'), ('requested_checkin', '2026-10-02'),
                           ('observed_at', '2026-09-25'), ('taxes_included', True), ('rows', [])]:
            raw = fixture()
            raw[field] = bad
            with self.subTest(field=field), self.assertRaises(ValueError):
                normalize_capture(raw)

    def test_optional_fields_unknown_and_amount_precision(self):
        raw = fixture()
        raw['rows'][0][6] = 'ﺩ.ﺇ 0.10'
        raw['rows'][0][8:12] = [None]*4
        result = normalize_capture(raw)
        self.assertEqual(result['quotes'][0]['amount_minor'], 10)
        self.assertIsNone(result['listings'][0]['review_count'])

    def test_formula_neutralization(self):
        self.assertEqual(csv_safe(' =SUM(A1)'), "' =SUM(A1)")
        self.assertEqual(csv_safe('@cmd'), "'@cmd")
        self.assertEqual(csv_safe(None), '')

    def test_file_roundtrip_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            path, output = Path(temp)/'source.json', Path(temp)/'output'
            path.write_text(json.dumps(fixture()), encoding='utf-8')
            receipt = write_exports(path, output)
            self.assertEqual(receipt['unique_listings'], 1)
            self.assertEqual(len(list(output.iterdir())), 7)
            self.assertEqual(json.loads((output/'quotes.json').read_text())[0]['amount_minor'], 148400)
            with self.assertRaises(FileExistsError):
                write_exports(path, output)

    def test_duplicate_json_fields_fail_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'source.json'
            path.write_text('{"rows": [], "rows": []}')
            with self.assertRaises(ValueError):
                write_exports(path, Path(temp)/'out')

    def test_compilation_filters_sharjah_and_alternative_dates(self):
        with tempfile.TemporaryDirectory() as temp:
            raw = fixture()
            alternate = copy.deepcopy(raw['rows'][0])
            alternate[0] = '839908988047409847'
            alternate[3] = '2026-09-30'
            alternate[7] = 'for 2 nights'
            outside = copy.deepcopy(raw['rows'][0])
            outside[0], outside[2] = '1362176491106677672', 'Apartment in Sharjah'
            raw['rows'].extend([alternate, outside])
            source, out = Path(temp)/'cards.json', Path(temp)/'compiled'
            source.write_text(json.dumps(raw), encoding='utf-8')
            receipt = compile_dataset([source, source], None, out)
            self.assertEqual(receipt['source_qualified_listing_count'], 3)
            self.assertEqual(receipt['exact_date_dubai_candidates'], 1)
            self.assertEqual(receipt['alternative_date_observations'], 1)
            self.assertEqual(receipt['out_of_market_listings'], 1)
            self.assertIn("'1763362436102089053", (out/'comparables.csv').read_text(encoding='utf-8-sig'))
            self.assertEqual(len(receipt['evidence']), 1)

    def test_booking_source_qualified_not_fuzzy_matched(self):
        with tempfile.TemporaryDirectory() as temp:
            source, booking = Path(temp)/'cards.json', Path(temp)/'booking.json'
            source.write_text(json.dumps(fixture()), encoding='utf-8')
            row = dict(source='booking.com', listing_id='1763362436102089053', name='Synthetic fixture',
                source_url='https://www.booking.com/hotel/ae/test.html?checkin=2026-10-01&checkout=2026-10-02&no_rooms=1&group_adults=2&selected_currency=AED',
                displayed_amount='198.16', currency='AED', rating=None,
                location=dict(country_code='ae', city_name='Dubai', district_name='Test',
                              coordinates=dict(latitude=25.2, longitude=55.3)))
            capture = dict(schema='yellow.booking-connector-capture/v1', observed_at='2026-09-25T18:01:00Z',
                context=dict(destination='Dubai, United Arab Emirates', checkin='2026-10-01', checkout='2026-10-02',
                             adults=2, children=0, rooms=1, currency='AED', point_of_sale_country='in', locale='en-gb'), rows=[row])
            booking.write_text(json.dumps(capture), encoding='utf-8')
            receipt = compile_dataset([source], booking, Path(temp)/'out')
            self.assertEqual(receipt['source_qualified_listing_count'], 2)
            quotes = json.loads((Path(temp)/'out'/'quotes.json').read_text())
            self.assertEqual(quotes[-1]['amount_minor'], 19816)
            for key, bad in [('currency', 'USD'), ('listing_id', 123), ('source_url', 'https://example.com/hotel/ae/test.html')]:
                modified = copy.deepcopy(capture)
                modified['rows'][0][key] = bad
                booking.write_text(json.dumps(modified), encoding='utf-8')
                with self.subTest(key=key), self.assertRaises(ValueError):
                    compile_dataset([source], booking, Path(temp)/'invalid-out')
            modified = copy.deepcopy(capture)
            modified['rows'][0]['rating'] = dict(review_score=999, number_of_reviews=-12, stars=3, contact_email='not-retained@example.test')
            booking.write_text(json.dumps(modified), encoding='utf-8')
            with self.assertRaises(ValueError):
                compile_dataset([source], booking, Path(temp)/'bad-rating')
            modified['rows'][0]['rating'].update(review_score=8.1, number_of_reviews=4)
            booking.write_text(json.dumps(modified), encoding='utf-8')
            compile_dataset([source], booking, Path(temp)/'good-rating')
            self.assertNotIn('contact_email', (Path(temp)/'good-rating'/'listings.json').read_text())

    def test_cross_file_quote_conflict_and_latest_listing_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            first, second = Path(temp)/'a.json', Path(temp)/'b.json'
            one, two = fixture(), fixture()
            two['rows'][0][6] = 'ﺩ.ﺇ 999'
            first.write_text(json.dumps(one), encoding='utf-8')
            second.write_text(json.dumps(two), encoding='utf-8')
            with self.assertRaises(ValueError):
                compile_dataset([first, second], None, Path(temp)/'conflict')
            two['observed_at'] = '2026-09-25T16:00:00Z'
            two['rows'][0][1] = 'Newer fixture title'
            second.write_text(json.dumps(two), encoding='utf-8')
            compile_dataset([second, first], None, Path(temp)/'later')
            listings = json.loads((Path(temp)/'later'/'listings.json').read_text())
            self.assertEqual(listings[0]['name'], 'Newer fixture title')
            quotes = json.loads((Path(temp)/'later'/'quotes.json').read_text())
            self.assertEqual(len(quotes), 2)


if __name__ == '__main__':
    unittest.main()
