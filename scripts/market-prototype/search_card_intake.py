"""Offline intake of factual Airbnb search-card observations, not a crawler.

Reads an explicitly captured card table. No credentials, browser state or network.
Card dates and displayed stay totals are authoritative over search request dates.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, urlsplit

from rate_observations import (canonical_hash, coverage, iso_day, money_minor,
                               normalize_quotes, text, unique_object, utc_time)

COLUMNS = ['id', 'name', 'locality', 'checkin', 'checkout', 'adults', 'price',
           'duration', 'bedrooms', 'beds', 'bathrooms', 'rating', 'badge',
           'free_cancellation']
FIELDS = {'schema', 'observed_at', 'search_url', 'requested_checkin',
          'requested_checkout', 'currency', 'fees_included', 'taxes_included',
          'columns', 'rows'}
SEARCH_URL = ('https://www.airbnb.co.in/s/Dubai--United-Arab-Emirates/homes?'
              'checkin=2026-10-01&checkout=2026-10-02&adults=2&currency=AED&locale=en')
MAX_BYTES = 2 * 1024 * 1024


def optional_fact(value, pattern, field):
    if value is None:
        return None
    if not isinstance(value, str) or not re.fullmatch(pattern, value):
        raise ValueError(f'invalid {field}')
    return value


def normalize_capture(raw):
    if not isinstance(raw, dict) or set(raw) != FIELDS:
        raise ValueError('invalid capture fields')
    if raw['schema'] != 'yellow.airbnb-ui-cards/v1' or raw['columns'] != COLUMNS:
        raise ValueError('unsupported capture schema or columns')
    # This first adapter is deliberately limited to the observed Dubai request.
    if raw['search_url'] != SEARCH_URL or raw['currency'] != 'AED':
        raise ValueError('unsupported search context or currency')
    if (raw['requested_checkin'], raw['requested_checkout']) != ('2026-10-01', '2026-10-02'):
        raise ValueError('request dates do not match evidence URL')
    stamp = utc_time(raw['observed_at'])
    for field in ('fees_included', 'taxes_included'):
        if raw[field] not in ('included', 'excluded', 'unknown'):
            raise ValueError('invalid inclusion status')
    if not isinstance(raw['rows'], list) or not 1 <= len(raw['rows']) <= 1000:
        raise ValueError('requires 1 to 1000 captured rows')
    evidence_hash = canonical_hash(raw)
    listings, captures, quote_input = {}, {}, []
    for values in raw['rows']:
        if not isinstance(values, list) or len(values) != len(COLUMNS):
            raise ValueError('invalid card columns')
        card = dict(zip(COLUMNS, values))
        listing_id = card['id']
        if not isinstance(listing_id, str) or not re.fullmatch(r'[1-9][0-9]{0,29}', listing_id):
            raise ValueError('listing id must be an exact digit string')
        start, end = iso_day(card['checkin']), iso_day(card['checkout'])
        nights = (end - start).days
        if not 1 <= nights <= 366 or card['duration'] != f'for {nights} night' + ('s' if nights != 1 else ''):
            raise ValueError('card date/duration mismatch')
        if card['adults'] != '2':
            raise ValueError('card occupancy differs from observed search')
        if not isinstance(card['price'], str):
            raise ValueError('missing displayed price')
        price = re.fullmatch(r'ﺩ\.ﺇ[\s\u00a0]+(0|[1-9][0-9]*|[1-9][0-9]{0,2}(?:,[0-9]{3})+)(\.[0-9]{1,2})?', card['price'])
        if not price:
            raise ValueError('invalid displayed AED price')
        amount = price[1].replace(',', '') + (price[2] or '')
        minor = money_minor(amount, 'AED')
        for field, pattern in (
            ('bedrooms', r'[0-9]+ bedrooms?'),
            ('beds', r'[0-9]+ (?:king |queen )?beds?'),
            ('bathrooms', r'[0-9]+(?:\.[0-9]+)? bathrooms?')):
            optional_fact(card[field], pattern, field)
        rating, reviews = None, None
        if card['rating'] is not None:
            match = re.fullmatch(r'([0-5](?:\.[0-9]{1,2})?) out of 5 average rating, ([0-9]+) reviews?', str(card['rating']))
            if not match or float(match[1]) > 5:
                raise ValueError('invalid rating')
            rating, reviews = match[1], int(match[2])
        if card['badge'] not in (None, 'Superhost', 'Guest favourite'):
            raise ValueError('invalid badge')
        if card['free_cancellation'] is not None and type(card['free_cancellation']) is not bool:
            raise ValueError('invalid cancellation indication')
        url = 'https://www.airbnb.co.in/rooms/' + listing_id
        listing = dict(source='airbnb', listing_id=listing_id, source_url=url,
                       name=text(card['name'], 'name'), locality_display=text(card['locality'], 'locality'),
                       bedrooms_display=card['bedrooms'], beds_display=card['beds'],
                       bathrooms_display=card['bathrooms'], rating=rating,
                       review_count=reviews, badge=card['badge'], observed_at=stamp,
                       latitude=None, longitude=None, active_inventory_verified=False,
                       evidence_sha256=evidence_hash)
        if listing_id in listings and listings[listing_id] != listing:
            raise ValueError('conflicting listing in same capture')
        listings[listing_id] = listing
        observation = dict(listing_id=listing_id, name=listing['name'], source_url=url,
                           checkin=start.isoformat(), checkout=end.isoformat(), nights=nights,
                           adults=2, children=0, rooms=1, currency='AED',
                           amount_minor=minor, amount_basis='stay_total',
                           displayed_price=card['price'], fees_included=raw['fees_included'],
                           taxes_included=raw['taxes_included'],
                           free_cancellation_displayed=card['free_cancellation'],
                           alternative_dates=(start.isoformat(), end.isoformat()) !=
                           (raw['requested_checkin'], raw['requested_checkout']),
                           observed_at=stamp, evidence_sha256=evidence_hash)
        identity = (listing_id, start.isoformat(), end.isoformat())
        if identity in captures and captures[identity] != observation:
            raise ValueError('conflicting quote in same capture')
        captures[identity] = observation
        quote_input.append(dict(property_id=listing_id, source='airbnb', source_url=url,
                                source_kind='manual_observation', seller='Airbnb',
                                checkin=start.isoformat(), checkout=end.isoformat(),
                                adults=2, children=0, rooms=1, currency='AED', amount=amount,
                                amount_basis='stay_total', taxes_included=raw['taxes_included'],
                                fees_included=raw['fees_included'], room_type=None, rate_plan=None,
                                observed_at=stamp, evidence_sha256=evidence_hash))
    quotes = normalize_quotes(quote_input)
    return dict(listings=list(listings.values()), observations=list(captures.values()),
                quotes=quotes, quote_import=list({canonical_hash(q): q for q in quote_input}.values()),
                coverage=coverage(quotes, '2026-10'),
                receipt=dict(schema='yellow.airbnb-ui-intake-receipt/v1',
                             evidence_sha256=evidence_hash, captured_rows=len(raw['rows']),
                             unique_listings=len(listings), unique_observations=len(captures),
                             alternative_date_observations=sum(o['alternative_dates'] for o in captures.values()),
                             deduplicated_rows=len(raw['rows'])-len(captures),
                             whole_market_coverage_claimed=False, exact_coordinates_available=False,
                             network_requests_by_intake=0, source='ordinary rendered Airbnb search cards',
                             pricing_caveat='Displayed stay totals, not guaranteed bookable final quotes; taxes unknown when not explicit.'))


def csv_safe(value):
    if value is None:
        return ''
    value = str(value)
    return "'" + value if value.lstrip().startswith(('=', '+', '-', '@')) else value


def write_exports(raw_path, output):
    source = Path(raw_path)
    if source.stat().st_size > MAX_BYTES:
        raise ValueError('input too large')
    data = source.read_bytes()
    if len(data) > MAX_BYTES:
        raise ValueError('input too large')
    result = normalize_capture(json.loads(data.decode('utf-8-sig'), object_pairs_hook=unique_object))
    dest = Path(output)
    dest.mkdir(parents=False, exist_ok=False)
    result['receipt']['source_file_sha256'] = hashlib.sha256(data).hexdigest()
    for name, value in result.items():
        with (dest / (name + '.json')).open('x', encoding='utf-8') as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
    with (dest / 'observations.csv').open('x', encoding='utf-8-sig', newline='') as handle:
        fields = list(result['observations'][0])
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in result['observations']:
            # Formula-like values are neutralized; IDs stay strings in canonical JSON.
            writer.writerow({k: csv_safe(v) for k, v in row.items()})
    return result['receipt']


def read_capture(path):
    path = Path(path)
    if path.stat().st_size > MAX_BYTES:
        raise ValueError('input too large')
    body = path.read_bytes()
    if len(body) > MAX_BYTES:
        raise ValueError('input too large')
    return json.loads(body.decode('utf-8-sig'), object_pairs_hook=unique_object)


def compile_dataset(paths, booking_path, output):
    """Join source-qualified facts, not guessed cross-OTA property matches."""
    if not 1 <= len(paths) <= 3:
        raise ValueError('pilot requires 1 to 3 Airbnb captures')
    listings, observations, quotes, evidence, seen_captures = {}, [], [], [], set()
    for path in paths:
        raw = read_capture(path)
        digest = canonical_hash(raw)
        if digest in seen_captures:
            continue
        seen_captures.add(digest)
        normalized = normalize_capture(raw)
        evidence.append({'file': Path(path).name, 'canonical_sha256': digest})
        for item in normalized['listings']:
            key = ('airbnb', item['listing_id'])
            locality = item['locality_display']
            prior = listings.get(key)
            localities = sorted(set((prior or {}).get('locality_observations', []) + [locality]))
            if prior and prior['observed_at'] > item['observed_at']:
                item = dict(prior)
            item['locality_observations'] = localities
            item['market_scope'] = 'outside_dubai' if any('Sharjah' in place for place in localities) else 'dubai_search_candidate_unverified'
            listings[key] = item
        for observation in normalized['observations']:
            observation['source'] = 'airbnb'
            observation['market_scope'] = listings[('airbnb', observation['listing_id'])]['market_scope']
            observations.append(observation)
        quotes.extend(normalized['quotes'])
    if booking_path:
        raw = read_capture(booking_path)
        if not isinstance(raw, dict) or raw.get('schema') != 'yellow.booking-connector-capture/v1':
            raise ValueError('unsupported booking capture')
        expected = dict(destination='Dubai, United Arab Emirates', checkin='2026-10-01',
                        checkout='2026-10-02', adults=2, children=0, rooms=1,
                        currency='AED', point_of_sale_country='in', locale='en-gb')
        if raw.get('context') != expected or not isinstance(raw.get('rows'), list) or len(raw['rows']) > 100:
            raise ValueError('unsupported booking context')
        stamp, digest = utc_time(raw['observed_at']), canonical_hash(raw)
        evidence.append({'file': Path(booking_path).name, 'canonical_sha256': digest})
        booking_quotes, seen_booking = [], set()
        for row in raw['rows']:
            listing_id = row.get('listing_id')
            if not isinstance(listing_id, str) or not re.fullmatch(r'[1-9][0-9]{0,29}', listing_id) or listing_id in seen_booking:
                raise ValueError('invalid or duplicate Booking listing id')
            seen_booking.add(listing_id)
            url = row.get('source_url')
            parts = urlsplit(url) if isinstance(url, str) else None
            if (parts is None or parts.hostname != 'www.booking.com' or parts.scheme != 'https'
                    or parts.username is not None or parts.password is not None or parts.fragment
                    or not parts.path.startswith('/hotel/ae/')):
                raise ValueError('invalid Booking reference')
            query = parse_qs(parts.query)
            for key, val in [('checkin', '2026-10-01'), ('checkout', '2026-10-02'),
                             ('no_rooms', '1'), ('group_adults', '2'), ('selected_currency', 'AED')]:
                if query.get(key) != [val]:
                    raise ValueError('Booking URL query mismatch')
            if row.get('source') != 'booking.com' or row.get('currency') != 'AED':
                raise ValueError('Booking source/currency mismatch')
            minor = money_minor(row['displayed_amount'], 'AED')
            location = row.get('location')
            if not isinstance(location, dict) or location.get('country_code') != 'ae' or location.get('city_name') != 'Dubai':
                raise ValueError('Booking market mismatch')
            coordinates = location.get('coordinates')
            latitude = longitude = None
            if coordinates is not None:
                if not isinstance(coordinates, dict):
                    raise ValueError('invalid provider coordinates')
                latitude, longitude = coordinates.get('latitude'), coordinates.get('longitude')
                if (type(latitude) not in (float, int) or type(longitude) not in (float, int)
                        or not -90 <= latitude <= 90 or not -180 <= longitude <= 180):
                    raise ValueError('invalid provider coordinates')
            name = text(row.get('name'), 'name')
            district = text(location.get('district_name'), 'district', optional=True)
            rating = row.get('rating')
            if rating is not None:
                if not isinstance(rating, dict):
                    raise ValueError('invalid Booking rating')
                score, reviews, stars = (rating.get(k) for k in ('review_score', 'number_of_reviews', 'stars'))
                if (type(score) not in (float, int) or not 0 <= score <= 10
                        or type(reviews) is not int or not 0 <= reviews <= 10000000
                        or type(stars) is not int or not 0 <= stars <= 5):
                    raise ValueError('invalid Booking rating ranges')
                rating = dict(review_score=score, number_of_reviews=reviews, stars=stars,
                              stars_type=text(rating.get('stars_type'), 'stars_type', optional=True))
            listings[('booking.com', listing_id)] = dict(source='booking.com', listing_id=listing_id,
                name=name, source_url=url, locality_display=district,
                locality_observations=[district], latitude=latitude, longitude=longitude,
                location_kind='provider_reported_not_independently_surveyed',
                rating=rating, observed_at=stamp, evidence_sha256=digest,
                market_scope='dubai_provider_city', active_inventory_verified=False)
            observations.append(dict(source='booking.com', listing_id=listing_id, name=name, source_url=url,
                checkin='2026-10-01', checkout='2026-10-02', nights=1, adults=2, children=0, rooms=1,
                currency='AED', amount_minor=minor, amount_basis='stay_total',
                fees_included='unknown', taxes_included='unknown', market_scope='dubai_provider_city',
                alternative_dates=False, observed_at=stamp, evidence_sha256=digest))
            booking_quotes.append(dict(property_id=listing_id, source='booking.com', source_url=url,
                source_kind='provider_export', seller='Booking.com', checkin='2026-10-01', checkout='2026-10-02',
                adults=2, children=0, rooms=1, currency='AED', amount=row['displayed_amount'],
                amount_basis='stay_total', taxes_included='unknown', fees_included='unknown',
                room_type=None, rate_plan=None, observed_at=stamp, evidence_sha256=digest))
        quotes.extend(normalize_quotes(booking_quotes))
    # A quote identity already binds source, property, dates, occupancy and time.
    # Separate page evidence may support the same quote, but must never silently
    # replace a different price/fee value at that exact capture identity.
    unique_quotes = {}
    for row in quotes:
        prior = unique_quotes.get(row['observation_id'])
        comparable = {k: v for k, v in row.items() if k != 'evidence_sha256'}
        if prior and {k: v for k, v in prior.items() if k != 'evidence_sha256'} != comparable:
            raise ValueError('conflicting same-capture quote across input files')
        unique_quotes.setdefault(row['observation_id'], row)
    quotes = list(unique_quotes.values())
    # Retain all captured evidence observations; separately select the latest
    # observation per source identity/date/context for a practical comparison CSV.
    latest = {}
    for row in observations:
        key = (row['source'], row['listing_id'], row['checkin'], row['checkout'], row['adults'], row['currency'])
        if key not in latest or row['observed_at'] >= latest[key]['observed_at']:
            latest[key] = row
    comparables = [r for r in latest.values() if not r['alternative_dates'] and r['market_scope'] != 'outside_dubai']
    receipt = dict(schema='yellow.multi-source-pilot/v1',
        source_listing_counts={s: sum(k[0] == s for k in listings) for s in sorted({k[0] for k in listings})},
        source_qualified_listing_count=len(listings), observations=len(observations),
        distinct_source_stay_observations=len(latest), exact_date_dubai_candidates=len(comparables),
        out_of_market_listings=sum(r['market_scope'] == 'outside_dubai' for r in listings.values()),
        alternative_date_observations=sum(r['alternative_dates'] for r in latest.values()),
        evidence=evidence, whole_market_coverage_claimed=False, cross_source_entity_matching=False,
        whole_month_calendar=False, automatic_pricing_eligible=False,
        observed_at_meaning='local evidence recording time, not provider quote generation time',
        csv_id_policy='IDs prefixed with apostrophe to discourage spreadsheet numeric rounding; JSON is canonical')
    outputs = dict(listings=list(listings.values()), observations=observations,
                   comparables= comparables, quotes=quotes, coverage=coverage(quotes, '2026-10'), receipt=receipt)
    dest = Path(output)
    dest.mkdir(parents=False, exist_ok=False)
    for name, value in outputs.items():
        with (dest / (name + '.json')).open('x', encoding='utf-8') as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
    fields = ['source', 'listing_id', 'name', 'checkin', 'checkout', 'nights', 'adults',
              'currency', 'amount_minor', 'amount_basis', 'fees_included', 'taxes_included',
              'market_scope', 'observed_at', 'source_url']
    with (dest / 'comparables.csv').open('x', encoding='utf-8-sig', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in comparables:
            writer.writerow({k: "'" + row[k] if k == 'listing_id' else csv_safe(row[k]) for k in fields})
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, nargs='+')
    parser.add_argument('--booking', help='Optional ordinary Booking.com connector capture')
    parser.add_argument('--compile', action='store_true', help='Compile source-qualified pilot dataset')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        if not args.compile and (len(args.input) != 1 or args.booking):
            raise ValueError('multiple inputs/Booking require --compile')
        receipt = (compile_dataset(args.input, args.booking, args.output) if args.compile
                   else write_exports(args.input[0], args.output))
        print(json.dumps(receipt, indent=2))
    except (ValueError, OSError, TypeError, KeyError) as exc:
        parser.exit(2, f'intake stopped: {type(exc).__name__}: {exc}\n')
