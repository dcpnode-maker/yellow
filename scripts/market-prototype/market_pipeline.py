"""Finite, sequential public-source turns using the unchanged Order726 transport.

One persistent state directory is shared by every invocation. Never replace its
budget, origin checkpoints or abandoned locks to retry a recorded stop. Reports
contain retained undated JSON-LD candidates, never calendar quotes or HTML.
"""
from __future__ import annotations

import argparse
from contextlib import ExitStack
from datetime import date, datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.parse import urlsplit, urlunsplit

from rate_fetch import Fetcher, _origin, _valid_stamp, validate_url
from rate_observations import EXPONENTS, extract_candidates, unique_object

MANIFEST_SCHEMA = 'yellow.market-pipeline-manifest.v1'
STATE_SCHEMA = 'yellow.market-pipeline-state.v1'
MAX_MANIFEST_BYTES = 256 * 1024
MAX_STATE_BYTES = 16 * 1024 * 1024
MAX_URLS = 200
MAX_RETAINED_PAGES = 1000
CANDIDATE_FIELDS = {
    'observation_kind', 'source_url', 'title', 'currency', 'amount_minor',
    'price_kind', 'checkin', 'checkout', 'amount_basis', 'taxes_included',
    'fees_included', 'availability_status', 'source_sha256', 'fetched_at',
}


def _now():
    return datetime.now(timezone.utc)


def _integer(value, minimum=0, maximum=100):
    return type(value) is int and minimum <= value <= maximum


def _read(path, limit):
    with Path(path).open('rb') as stream:
        raw = stream.read(limit + 1)
    if len(raw) > limit:
        raise ValueError('input_size_limit')
    return json.loads(raw, object_pairs_hook=unique_object,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite_json')))


def _write(path, value):
    raw = json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(',', ':')).encode()
    if len(raw) > MAX_STATE_BYTES:
        raise ValueError('state_size_limit')
    descriptor, temporary = tempfile.mkstemp(prefix=path.name + '.', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _url(value, origin):
    parsed = urlsplit(validate_url(value, {origin}))
    return urlunsplit(('https', urlsplit(origin).netloc, parsed.path, parsed.query, ''))


def validate_manifest(raw):
    if not isinstance(raw, dict) or set(raw) != {'schema', 'daily_request_limit', 'max_requests', 'sources'}:
        raise ValueError('invalid_manifest_fields')
    if raw['schema'] != MANIFEST_SCHEMA or not all(
            _integer(raw[key], 1) for key in ('daily_request_limit', 'max_requests')):
        raise ValueError('manifest_limits_require_integers_1_to_100')
    if not isinstance(raw['sources'], list) or not 1 <= len(raw['sources']) <= 5:
        raise ValueError('manifest_requires_1_to_5_sources')
    sources, origins, total = [], set(), 0
    for source in raw['sources']:
        if not isinstance(source, dict) or set(source) != {'origin', 'daily_request_limit', 'urls'}:
            raise ValueError('invalid_source_fields')
        origin = _origin(source['origin'])
        parsed = urlsplit(source['origin'])
        if parsed.path not in ('', '/') or parsed.query or parsed.fragment or origin in origins:
            raise ValueError('unique_exact_origins_required')
        if not _integer(source['daily_request_limit'], 1) or not isinstance(source['urls'], list) or not source['urls']:
            raise ValueError('source_requires_daily_limit_and_explicit_urls')
        total += len(source['urls'])
        if total > MAX_URLS:
            raise ValueError('manifest_url_limit')
        urls = [_url(value, origin) for value in source['urls']]
        if len(set(urls)) != len(urls):
            raise ValueError('duplicate_source_url')
        sources.append(dict(origin=origin, daily_request_limit=source['daily_request_limit'], urls=urls))
        origins.add(origin)
    return dict(raw, sources=sources)


def _validate_page(url, page, origin):
    if _url(url, origin) != url or not isinstance(page, dict) or set(page) != {'source_sha256', 'fetched_at', 'candidates'}:
        raise ValueError('invalid_retained_page')
    digest, stamp = page['source_sha256'], page['fetched_at']
    if not isinstance(digest, str) or not re.fullmatch('[0-9a-f]{64}', digest) or not _valid_stamp(stamp):
        raise ValueError('invalid_retained_evidence')
    if not isinstance(page['candidates'], list) or len(page['candidates']) > 200:
        raise ValueError('invalid_candidates')
    for row in page['candidates']:
        if not isinstance(row, dict) or set(row) != CANDIDATE_FIELDS:
            raise ValueError('invalid_candidate_fields')
        if (row['source_url'] != url or row['source_sha256'] != digest or row['fetched_at'] != stamp
                or row['observation_kind'] != 'undated_price_candidate'
                or row['checkin'] is not None or row['checkout'] is not None
                or any(row[key] != 'unknown' for key in ('amount_basis', 'taxes_included', 'fees_included', 'availability_status'))
                or row['price_kind'] not in ('offer_price', 'aggregate_low_price')
                or not isinstance(row['currency'], str) or row['currency'] not in EXPONENTS
                or not _integer(row['amount_minor'], 0, 9_000_000_000_000_000)):
            raise ValueError('invalid_undated_candidate')
        title = row['title']
        if title is not None and (not isinstance(title, str) or not 1 <= len(title) <= 240 or any(ord(c) < 32 for c in title)):
            raise ValueError('invalid_candidate_title')


class Pipeline:
    def __init__(self, manifest, state_dir):
        self.manifest = validate_manifest(manifest)
        self.directory = Path(state_dir).resolve()
        self.path = self.directory / 'pipeline.json'
        self.lock_path = self.directory / 'pipeline.lock'
        self.state = None

    def checkpoint(self, origin):
        return self.directory / ('origin-' + hashlib.sha256(origin.encode()).hexdigest() + '.json')

    def _save(self):
        _write(self.path, self.state)

    def _load(self):
        if not self.path.exists():
            if any(self.directory.glob('origin-*.json')):
                raise ValueError('missing_budget_for_existing_checkpoints')
            return dict(schema=STATE_SCHEMA, day=_now().date().isoformat(),
                        daily_request_limit=self.manifest['daily_request_limit'],
                        charged_requests=0, confirmed_requests=0, next_origin=None, sources={})
        try:
            state = _read(self.path, MAX_STATE_BYTES)
            if not isinstance(state, dict) or set(state) != {
                    'schema', 'day', 'daily_request_limit', 'charged_requests', 'confirmed_requests', 'next_origin', 'sources'}:
                raise ValueError('invalid_state_shape')
            if state['schema'] != STATE_SCHEMA or not isinstance(state['day'], str) or date.fromisoformat(state['day']).isoformat() != state['day']:
                raise ValueError('invalid_state_version_or_day')
            if not _integer(state['daily_request_limit'], 1) or not _integer(state['charged_requests']) or not _integer(state['confirmed_requests']):
                raise ValueError('invalid_state_budget')
            if not 0 <= state['confirmed_requests'] <= state['charged_requests'] <= state['daily_request_limit']:
                raise ValueError('inconsistent_state_budget')
            sources = state['sources']
            if not isinstance(sources, dict) or len(sources) > 5:
                raise ValueError('invalid_state_sources')
            if state['next_origin'] is not None and state['next_origin'] not in sources:
                raise ValueError('invalid_state_cursor')
            for origin, source in sources.items():
                if _origin(origin) != origin or not isinstance(source, dict) or set(source) != {
                        'daily_request_limit', 'charged_requests', 'confirmed_requests', 'pending', 'stop', 'checkpoint_created', 'pages'}:
                    raise ValueError('invalid_source_state')
                if (not _integer(source['daily_request_limit'], 1) or not _integer(source['charged_requests'])
                        or not _integer(source['confirmed_requests']) or not _integer(source['pending'], 0, 2)
                        or not 0 <= source['confirmed_requests'] <= source['charged_requests'] <= source['daily_request_limit']
                        or source['pending'] > source['charged_requests'] - source['confirmed_requests']
                        or type(source['checkpoint_created']) is not bool):
                    raise ValueError('invalid_source_budget')
                if source['stop'] not in (None, 'interrupted_batch_requires_review'):
                    raise ValueError('invalid_pipeline_stop')
                if not isinstance(source['pages'], dict) or len(source['pages']) > MAX_RETAINED_PAGES:
                    raise ValueError('retained_page_limit')
                if not source['checkpoint_created'] and any((source['pages'], source['pending'],
                        source['charged_requests'], source['confirmed_requests'], source['stop'])):
                    raise ValueError('uncreated_checkpoint_has_prior_activity')
                for url, page in source['pages'].items():
                    _validate_page(url, page, origin)
            if (sum(s['charged_requests'] for s in sources.values()) != state['charged_requests']
                    or sum(s['confirmed_requests'] for s in sources.values()) != state['confirmed_requests']):
                raise ValueError('inconsistent_aggregate_budget')
            return state
        except (OSError, ValueError, TypeError, KeyError, RecursionError) as exc:
            raise ValueError('pipeline_state_invalid_no_requests_allowed') from exc

    def _roll_day(self):
        today = _now().date().isoformat()
        if today < self.state['day']:
            raise ValueError('utc_clock_moved_backwards')
        if today != self.state['day']:
            self.state.update(day=today, charged_requests=0, confirmed_requests=0)
            for source in self.state['sources'].values():
                # An interrupted batch may have crossed midnight. Keep its
                # uncertainty charged while its inspection stop is unresolved.
                source.update(charged_requests=source['pending'], confirmed_requests=0)
                self.state['charged_requests'] += source['pending']

    def _retain(self, origin, url, result):
        page = dict(source_sha256=result['source_sha256'], fetched_at=result['fetched_at'],
                    candidates=extract_candidates(result['body'], url, result['source_sha256'], result['fetched_at']))
        _validate_page(url, page, origin)
        self.state['sources'][origin]['pages'][url] = page
        self._save()

    def run(self):
        self.directory.mkdir(parents=True, exist_ok=True)
        try:
            lock = os.open(self.lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError as exc:
            raise RuntimeError('pipeline_locked_inspect_existing_owner') from exc
        try:
            return self._run_locked()
        finally:
            os.close(lock)
            self.lock_path.unlink()

    def _run_locked(self):
        self.state = self._load()
        if self.state['daily_request_limit'] != self.manifest['daily_request_limit']:
            raise ValueError('persistent_daily_limit_mismatch')
        for source in self.state['sources'].values():
            if source['pending']:
                source['stop'] = 'interrupted_batch_requires_review'
        self._roll_day()
        for spec in self.manifest['sources']:
            origin = spec['origin']
            source = self.state['sources'].setdefault(origin, dict(
                daily_request_limit=spec['daily_request_limit'], charged_requests=0, confirmed_requests=0,
                pending=0, stop=None, checkpoint_created=False, pages={}))
            if source['daily_request_limit'] != spec['daily_request_limit']:
                raise ValueError('persistent_source_limit_mismatch')
        if len(self.state['sources']) > 5:
            raise ValueError('persistent_source_registry_limit')
        self._save()
        specs = self.manifest['sources']
        origins = [s['origin'] for s in specs]
        cursor = self.state['next_origin']
        if cursor in origins:
            index = origins.index(cursor)
            origins = origins[index:] + origins[:index]
        queues = {s['origin']: iter(s['urls']) for s in specs}
        results, attempts = {origin: [] for origin in origins}, 0
        with ExitStack() as stack:
            fetchers = {}
            # Validate every source checkpoint before any source can dispatch.
            for origin in origins:
                source = self.state['sources'][origin]
                if source['checkpoint_created'] and not self.checkpoint(origin).is_file():
                    raise ValueError('missing_existing_origin_checkpoint')
                fetchers[origin] = stack.enter_context(Fetcher(
                    self.checkpoint(origin), [origin], max_requests=100))
                source['checkpoint_created'] = True
                self._save()
            for origin, fetcher in fetchers.items():
                fetcher.max_requests = 0
                for url, page in self.state['sources'][origin]['pages'].items():
                    prior = fetcher.fetch(url)
                    if prior['status'] == 'blocked':
                        continue  # Persistent host stops still take precedence.
                    if (prior['status'] != 'already_fetched'
                            or prior['source_sha256'] != page['source_sha256']
                            or prior['fetched_at'] != page['fetched_at']):
                        raise ValueError('retained_output_checkpoint_mismatch')
            active = list(origins)
            while active:
                for origin in list(active):
                    url = next(queues[origin], None)
                    if url is None:
                        active.remove(origin)
                        continue
                    self._roll_day()
                    source, fetcher = self.state['sources'][origin], fetchers[origin]
                    retained = source['pages'].get(url)
                    # Even a metadata-only cache hit must remain visibly distinct
                    # from a successfully retained page after interruption.
                    if source['stop']:
                        result = dict(status='blocked', reason=source['stop'])
                        if retained is None:
                            fetcher.max_requests = fetcher.request_attempts
                            prior = fetcher.fetch(url)
                            if prior['status'] == 'already_fetched':
                                result = prior
                    elif retained is None and len(source['pages']) >= MAX_RETAINED_PAGES:
                        result = dict(status='skipped', reason='retained_page_limit')
                    else:
                        available = min(self.manifest['max_requests'] - attempts,
                                        self.state['daily_request_limit'] - self.state['charged_requests'],
                                        source['daily_request_limit'] - source['charged_requests'])
                        # One URL can cost robots + page. A remaining single
                        # request is allowed; Fetcher itself enforces that cap.
                        reserved = min(2, available)
                        if reserved:
                            source['pending'] = reserved
                            source['charged_requests'] += reserved
                            self.state['charged_requests'] += reserved
                            self.state['next_origin'] = origins[(origins.index(origin) + 1) % len(origins)]
                            self._save()  # Reserve durably BEFORE dispatch.
                            before = fetcher.request_attempts
                            fetcher.max_requests = before + reserved
                            result = fetcher.fetch(url)
                            used = fetcher.request_attempts - before
                            if result['status'] == 'ok':
                                self._retain(origin, url, result)
                            attempts += used
                            # Only normal completion refunds unused allowance.
                            source['charged_requests'] -= reserved - used
                            self.state['charged_requests'] -= reserved - used
                            source['confirmed_requests'] += used
                            self.state['confirmed_requests'] += used
                            source['pending'] = 0
                            if _now().date().isoformat() != self.state['day']:
                                # Charge all requests in a crossing batch to
                                # the new day too; never undercount midnight.
                                self._roll_day()
                                source['charged_requests'] += used
                                self.state['charged_requests'] += used
                                source['confirmed_requests'] += used
                                self.state['confirmed_requests'] += used
                            self._save()
                        else:
                            # Zero-cap fetch can inspect cached metadata/stops
                            # using the public API but cannot send a request.
                            fetcher.max_requests = fetcher.request_attempts
                            result = fetcher.fetch(url)
                    retained = source['pages'].get(url)
                    if result['status'] == 'already_fetched':
                        result = dict(status='retained' if retained else 'missing_output_requires_inspection',
                                      reason=None if retained else 'metadata_checkpoint_only')
                    results[origin].append(dict(source_url=url, status=result['status'], reason=result['reason'],
                                                retained=retained is not None,
                                                undated_candidates=len(retained['candidates']) if retained else 0))
            self._save()
            source_reports, candidates = [], []
            for spec in specs:
                origin = spec['origin']
                source, fetcher = self.state['sources'][origin], fetchers[origin]
                selected = [source['pages'][url] for url in spec['urls'] if url in source['pages']]
                candidates.extend(row for page in selected for row in page['candidates'])
                stop = source['stop'] or next((r['reason'] for r in results[origin] if r['status'] == 'blocked'), None)
                status = ('blocked' if stop else 'complete' if len(selected) == len(spec['urls']) else 'incomplete')
                source_reports.append(dict(origin=origin, status=status, stop_reason=stop,
                    http_attempts=fetcher.request_attempts, daily_charged_requests=source['charged_requests'],
                    daily_confirmed_requests=source['confirmed_requests'],
                    remaining_daily_requests=source['daily_request_limit'] - source['charged_requests'],
                    requested_pages=len(spec['urls']), retained_pages=len(selected), results=results[origin]))
        return dict(schema='yellow.market-pipeline-report.v1', day=self.state['day'],
                    http_attempts=attempts, remaining_invocation_requests=self.manifest['max_requests'] - attempts,
                    daily_charged_requests=self.state['charged_requests'],
                    daily_confirmed_requests=self.state['confirmed_requests'],
                    remaining_daily_requests=self.state['daily_request_limit'] - self.state['charged_requests'],
                    sources=source_reports, candidates=candidates, calendar_quote_count=0,
                    whole_market_coverage_claimed=False,
                    note='Only retained undated candidates for explicit URLs. Missing prices/dates are unknown. '
                         'Charged daily requests include uncertain interrupted reservations; confirmed requests do not. '
                         'A batch crossing midnight is conservatively attributed to both UTC days.')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--state-dir', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        output = args.output.resolve()
        state_dir = args.state_dir.resolve()
        if output.exists() or not output.parent.is_dir() or output.is_relative_to(state_dir):
            raise ValueError('output_requires_new_file_outside_state_directory')
        manifest = _read(args.manifest, MAX_MANIFEST_BYTES)
        report = Pipeline(manifest, state_dir).run()
        with output.open('x', encoding='utf-8') as stream:
            json.dump(report, stream, ensure_ascii=False, indent=2, sort_keys=True)
            stream.write('\n')
        print(json.dumps(dict(output=str(output), http_attempts=report['http_attempts'],
                              undated_candidates=len(report['candidates']), calendar_quote_count=0)))
        return 0
    except (OSError, ValueError, RuntimeError, RecursionError) as exc:
        parser.exit(2, f'Pipeline stopped: {type(exc).__name__}: {str(exc)[:160]}\n')


if __name__ == '__main__':
    raise SystemExit(main())
