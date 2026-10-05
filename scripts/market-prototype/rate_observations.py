"""Public price candidates and explicit dated quote observations; no stealth.

Only collect makes network requests. import-quotes never fetches a URL. Generic
JSON-LD prices are undated candidates, never a hotel's calendar or occupancy.
"""
from __future__ import annotations

import argparse
import calendar
from datetime import date, datetime, timezone
from decimal import Decimal
import hashlib
import ipaddress
import json
from pathlib import Path
import re
from typing import Any
from urllib.parse import parse_qsl, urlsplit

from public_listing_collector import HTMLLinkAndJSONLDParser, PROPERTY_TYPES

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_ROWS = 10000
# Explicit supported ISO 4217 exponents. Unknown currency is rejected, not guessed.
EXPONENTS = {**dict.fromkeys(('AED', 'SAR', 'USD', 'EUR', 'GBP', 'INR', 'AUD',
                            'CAD', 'CNY', 'HKD', 'SGD', 'THB', 'MYR', 'IDR',
                            'PHP', 'ZAR', 'NZD', 'CHF', 'TRY', 'EGP', 'QAR'), 2),
             'JPY': 0, 'KRW': 0, 'VND': 0, 'BHD': 3, 'KWD': 3, 'OMR': 3}
QUOTE_FIELDS = {'property_id', 'source', 'source_url', 'source_kind', 'seller',
                'checkin', 'checkout', 'adults', 'children', 'rooms', 'currency',
                'amount', 'amount_basis', 'taxes_included', 'fees_included',
                'room_type', 'rate_plan', 'observed_at', 'evidence_sha256'}


def text(value: Any, field: str, optional: bool = False) -> str | None:
    if optional and value is None:
        return None
    if not isinstance(value, str) or not value.strip() or len(value) > 240:
        raise ValueError(f'{field}: expected nonempty text, at most 240 characters')
    if any(ord(c) < 32 for c in value):
        raise ValueError(f'{field}: control characters are not allowed')
    return value.strip()


def public_reference(value: Any) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= 2048:
        raise ValueError('source_url: invalid length')
    parsed = urlsplit(value)
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username is not None
            or parsed.password is not None or parsed.fragment
            or any(ord(c) <= 32 for c in value)):
        raise ValueError('source_url: expected public HTTPS URL without credentials or fragment')
    try:
        port = parsed.port
        if port is not None and not 1 <= port <= 65535:
            raise ValueError('invalid port')
    except ValueError:
        raise ValueError('source_url: invalid port') from None
    host = parsed.hostname.lower().rstrip('.')
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if (address is not None and not address.is_global) or host == 'localhost' or host.endswith(('.localhost', '.local', '.internal')):
        raise ValueError('source_url: local/private addresses are not public evidence')
    if any(re.search(r'token|key|auth|password|session|cookie|email', key, re.I)
           for key, _ in parse_qsl(parsed.query, keep_blank_values=True)):
        raise ValueError('source_url: secret-bearing query parameter is not allowed')
    return value


def money_minor(value: Any, currency: str) -> int:
    if currency not in EXPONENTS:
        raise ValueError('unsupported currency exponent')
    if isinstance(value, bool) or not isinstance(value, (str, int)):
        raise ValueError('amount must be a decimal string or integer, never a float')
    if not re.fullmatch(r'\d{1,13}(?:\.\d{1,3})?', str(value)):
        raise ValueError('amount must be an unsigned plain decimal without grouping')
    number = Decimal(str(value)) * (10 ** EXPONENTS[currency])
    if number != number.to_integral_value() or number > 9_000_000_000_000_000:
        raise ValueError('amount precision or range is invalid')
    return int(number)


def iso_day(value: Any) -> date:
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError('dates require YYYY-MM-DD')
    return date.fromisoformat(value)


def utc_time(value: Any) -> str:
    if not isinstance(value, str) or len(value) > 40 or 'T' not in value:
        raise ValueError('observed_at requires a timezone-aware timestamp')
    try:
        stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        raise ValueError('observed_at is not a valid ISO timestamp') from None
    if stamp.tzinfo is None:
        raise ValueError('observed_at requires a timezone')
    try:
        return stamp.astimezone(timezone.utc).isoformat()
    except OverflowError:
        raise ValueError('observed_at is outside the supported UTC range') from None


def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('duplicate JSON object key')
        result[key] = value
    return result


def canonical_hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                    separators=(',', ':')).encode('utf-8')).hexdigest()


def normalize_quotes(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list) or len(raw) > MAX_ROWS:
        raise ValueError('input requires an array of at most 10000 quote observations')
    unique: dict[str, dict[str, Any]] = {}
    for index, entry in enumerate(raw):
        if not isinstance(entry, dict) or set(entry) != QUOTE_FIELDS:
            raise ValueError(f'row {index}: fields must match the documented quote schema exactly')
        row = {key: text(entry[key], key) for key in ('property_id', 'source', 'seller')}
        row.update({key: text(entry[key], key, optional=True) for key in ('room_type', 'rate_plan')})
        row['source_url'] = public_reference(entry['source_url'])
        if entry['source_kind'] not in ('manual_observation', 'provider_export'):
            raise ValueError('source_kind must be manual_observation or provider_export')
        row['source_kind'] = entry['source_kind']
        start, end = iso_day(entry['checkin']), iso_day(entry['checkout'])
        nights = (end - start).days
        if not 1 <= nights <= 366:
            raise ValueError('checkout must be 1 to 366 nights after checkin')
        row.update(checkin=start.isoformat(), checkout=end.isoformat(), nights=nights)
        for key, minimum, maximum in (('adults', 1, 30), ('children', 0, 30), ('rooms', 1, 30)):
            value = entry[key]
            if type(value) is not int or not minimum <= value <= maximum:
                raise ValueError(f'{key}: integer out of range')
            row[key] = value
        currency = text(entry['currency'], 'currency')
        row['currency'] = currency
        row['amount_minor'] = money_minor(entry['amount'], currency)
        if entry['amount_basis'] not in ('stay_total', 'nightly'):
            raise ValueError('amount_basis must be stay_total or nightly, not from/average')
        row['amount_basis'] = entry['amount_basis']
        for field in ('taxes_included', 'fees_included'):
            if entry[field] not in ('included', 'excluded', 'unknown'):
                raise ValueError(f'{field}: expected included/excluded/unknown')
            row[field] = entry[field]
        row['observed_at'] = utc_time(entry['observed_at'])
        digest = entry['evidence_sha256']
        if not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest):
            raise ValueError('evidence_sha256 requires the SHA-256 of retained source evidence')
        row['evidence_sha256'] = digest
        row['verification'] = 'supplied_not_independently_verified'
        # Identity excludes price/fee values so a conflicting same-capture price is an error.
        identity = {k: v for k, v in row.items() if k not in {
            'amount_minor', 'amount_basis', 'taxes_included', 'fees_included',
            'evidence_sha256', 'verification', 'source_kind'}}
        key = canonical_hash(identity)
        row['observation_id'] = key
        if key in unique and unique[key] != row:
            raise ValueError(f'row {index}: conflicting values for the same quote capture')
        unique[key] = row
    return list(unique.values())


def month_days(month: str) -> list[str]:
    if not re.fullmatch(r'\d{4}-\d{2}', month):
        raise ValueError('month requires YYYY-MM')
    first = iso_day(month + '-01')
    return [date(first.year, first.month, day).isoformat()
            for day in range(1, calendar.monthrange(first.year, first.month)[1] + 1)]


def coverage(rows: list[dict[str, Any]], month: str) -> dict[str, Any]:
    days = month_days(month)
    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not row['checkin'].startswith(month + '-'):
            continue
        context = {k: row[k] for k in ('property_id', 'source', 'seller', 'adults',
                    'children', 'rooms', 'currency', 'room_type', 'rate_plan',
                    'taxes_included', 'fees_included')}
        parsed = urlsplit(row['source_url'])
        context['source_origin'] = f'https://{parsed.hostname.lower()}:{parsed.port or 443}'
        key = canonical_hash(context)
        group = grouped.setdefault(key, dict(context=context, observed_one_night_dates=[]))
        if row['nights'] == 1 and row['checkin'] not in group['observed_one_night_dates']:
            group['observed_one_night_dates'].append(row['checkin'])
    for group in grouped.values():
        group['observed_one_night_dates'].sort()
        group['missing_one_night_dates'] = [d for d in days if d not in group['observed_one_night_dates']]
    selected = [r for r in rows if r['checkin'].startswith(month + '-')]
    return dict(month=month, days_in_month=len(days), calendar_quote_count=len(selected),
                multi_night_observations=sum(r['nights'] != 1 for r in selected),
                groups=list(grouped.values()), whole_market_coverage_claimed=False,
                missing_means='unknown; not sold out or zero',
                verification='supplied observations; evidence not independently verified')


def extract_candidates(body: str, url: str, digest: str, fetched_at: str) -> list[dict[str, Any]]:
    """Only JSON-LD attached property offers; never parse internal application RPC data."""
    parser = HTMLLinkAndJSONLDParser()
    parser.feed(body)
    rows: dict[str, dict[str, Any]] = {}
    for block in parser.jsonld_blocks[:100]:
        try:
            decoded = json.loads(block, parse_float=str, object_pairs_hook=unique_object)
        except (ValueError, RecursionError):
            continue
        queue = decoded[:] if isinstance(decoded, list) else [decoded]
        visited = 0
        while queue and visited < 1000:
            item = queue.pop(0)
            visited += 1
            if not isinstance(item, dict):
                continue
            if isinstance(item.get('@graph'), list):
                queue.extend(item['@graph'][:1000])
            kinds = item.get('@type', [])
            kinds = kinds if isinstance(kinds, list) else [kinds]
            if not any(isinstance(k, str) and k in PROPERTY_TYPES for k in kinds):
                continue
            offers = item.get('offers', [])
            offers = offers if isinstance(offers, list) else [offers]
            for offer in offers[:200]:
                if not isinstance(offer, dict):
                    continue
                field = 'price' if 'price' in offer else 'lowPrice'
                try:
                    currency = text(offer.get('priceCurrency'), 'currency')
                    amount = money_minor(offer.get(field), currency)
                    title = text(item.get('name'), 'name', optional=True)
                except ValueError:
                    continue
                row = dict(observation_kind='undated_price_candidate', source_url=url,
                           title=title, currency=currency, amount_minor=amount,
                           price_kind='offer_price' if field == 'price' else 'aggregate_low_price',
                           checkin=None, checkout=None, amount_basis='unknown',
                           taxes_included='unknown', fees_included='unknown',
                           availability_status='unknown', source_sha256=digest, fetched_at=fetched_at)
                rows[canonical_hash(row)] = row
                if len(rows) >= 200:
                    return list(rows.values())
    return list(rows.values())


def read_json(path: Path) -> tuple[Any, str]:
    with path.open('rb') as stream:
        raw = stream.read(MAX_FILE_BYTES + 1)
    if len(raw) > MAX_FILE_BYTES:
        raise ValueError('input exceeds 10 MiB')
    return json.loads(raw.decode('utf-8-sig'), parse_float=str, object_pairs_hook=unique_object), hashlib.sha256(raw).hexdigest()


def write_report(path: Path, report: dict[str, Any]) -> None:
    # Exclusive create: reports never overwrite input, checkpoint or previous observations.
    with path.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, sort_keys=True)
        stream.write('\n')


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    collect = sub.add_parser('collect', help='Public JSON-LD price candidates, not calendar quotes')
    collect.add_argument('--origin', action='append', required=True)
    collect.add_argument('--url', action='append', required=True)
    collect.add_argument('--checkpoint', type=Path, required=True)
    collect.add_argument('--max-requests', type=int, default=10)
    collect.add_argument('--output', type=Path, required=True)
    imported = sub.add_parser('import-quotes', help='Normalize explicit permitted quote evidence; offline')
    imported.add_argument('--input', type=Path, required=True)
    imported.add_argument('--month', required=True)
    imported.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.output.exists():
            raise ValueError('output already exists; choose a new report filename')
        if not args.output.parent.is_dir():
            raise ValueError('output parent must already exist')
        if args.command == 'import-quotes':
            month_days(args.month)
            raw, digest = read_json(args.input)
            rows = normalize_quotes(raw)
            report = dict(schema='yellow.market-quotes.v1', quotes=rows,
                          input_sha256=digest, http_attempts=0, coverage=coverage(rows, args.month))
        else:
            if len(args.url) > 200:
                raise ValueError('at most 200 explicit URLs per invocation')
            if args.output.resolve() == args.checkpoint.resolve():
                raise ValueError('output and checkpoint must differ')
            from rate_fetch import Fetcher
            results, candidates = [], []
            with Fetcher(cache_path=args.checkpoint, origins=args.origin,
                         max_requests=args.max_requests) as fetcher:
                for url in dict.fromkeys(args.url):
                    result = fetcher.fetch(url)
                    body = result.pop('body', None)
                    if result['status'] == 'ok' and body is not None:
                        candidates.extend(extract_candidates(body, url, result['source_sha256'], result['fetched_at']))
                    # Unsafe rejected URLs are never echoed; index maps back to operator input.
                    results.append(dict(input_index=args.url.index(url), **result))
                attempts = fetcher.request_attempts
            report = dict(schema='yellow.market-candidates.v1', candidates=candidates,
                          results=results, http_attempts=attempts, calendar_quote_count=0,
                          whole_market_coverage_claimed=False,
                          note='Candidates are not dated quotes. Resume skips fetched URLs; retain earlier reports.')
        write_report(args.output, report)
        print(json.dumps(dict(output=str(args.output), http_attempts=report['http_attempts'],
                              quote_observations=len(report.get('quotes', [])),
                              undated_candidates=len(report.get('candidates', [])))))
        return 0
    except (OSError, ValueError, RuntimeError, RecursionError) as exc:
        # Paths and raw input values are deliberately omitted from error logs.
        parser.exit(2, f'Collection/import stopped: {type(exc).__name__}: {str(exc)[:200]}\n')
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
