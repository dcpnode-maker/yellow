# Dubai listing prototype — evidence and safe next step

Status on 25 September 2026: the collector and its offline tests are staged, but
the collector has **not** been run against a public listing site. There is no
collector-produced count, rate series, verified-active inventory, or October 2026
quote in this repository. The next allowed step is an independent review followed
by the root owner's explicitly bounded public run; do not infer permission to run
another source or crawl wider.

## Existing research artifact

The separate temporary artifact at
`D:/Yellow/temp/dubai-market-prototype-20260925/` contains ten unique Booking.com
listing-URL candidates from public search-index observations. Its README records
the capture method and limits. These are candidates only: search-index content may
be stale and does not establish that a unit is active, currently managed by bnbme,
or available. The temporary CSV is not output from the collector and has not been
uploaded or imported into Yellow.

The artifact records four explicitly named areas: Dubai Marina, Palm Jumeirah,
Business Bay, and Downtown Dubai. It contains zero October quotes and zero
coordinates; activity remains unverified and whole-market coverage is unknown.
No personal contact details, photos, or marketing descriptions were retained.
The observed bnbme Dubai page showed “No Property Found”; that is not proof of no
inventory. The sitemap timed out. Three direct Booking.com checks produced a
robot-verification page, after which no bypass or further direct requests were
attempted. Other candidates have index-only evidence. See the temporary
`README.md` and `bnbme-indexed-candidates.csv` for row-level provenance.

## Collector contract

[`public_listing_collector.py`](../../scripts/market-prototype/public_listing_collector.py)
uses only Python's standard library. The module import itself makes no requests;
collection is explicit through its CLI and requires repeated `--origin` and
`--seed` arguments, a metadata-only `--cache`, `--max-pages`, and a new
`--output-data` path. Keep cache and report artifacts under
`D:/Yellow/temp/dubai-market-prototype-20260925/`.

The current implementation:

- requires exact HTTPS origins (maximum 5) and explicit HTTPS seeds (maximum 50),
  and bounds pages (maximum 200), total HTTP attempts (pages plus at most one
  robots request per origin), response bodies
  (maximum 5 MiB), and per-request timeouts (maximum 30 seconds);
- requests sequentially with a transparent Yellow prototype User-Agent and at
  least three seconds between requests to an origin; robots `Crawl-delay` and
  `Request-rate` may increase that interval;
- evaluates robots rules using longest matching path, with `Allow` winning a tie,
  and supports `*` and terminal `$`; ambiguous/invalid rules fail closed;
- fails closed on percent-encoded and dot-segment paths, filters API/account/auth
  paths, never follows redirects, and stops the origin after HTTP 401, 403, or 429;
- reads only HTML anchors and `application/ld+json`; it does not inspect other
  scripts, call hidden endpoints, or fetch images;
- caches only normalized facts, discovered eligible URLs, source SHA-256, and
  fetched time—not raw HTML. Resume requires the same seed/origin/limit scope;
  cache schema v2 resets legacy v1 entries and rejects malformed/incomplete data;
- marks every result `public_metadata_candidate` with
  `availability_status: unknown`. Coordinates, when supplied, are labeled
  `public_point_unverified`. Ambiguous entities without a stable identifier or
  title are omitted.

Example shape (replace placeholders only after the source and seeds are approved;
this documentation does not authorize running it):

```powershell
python scripts/market-prototype/public_listing_collector.py `
  --origin https://reviewed-public-origin.example `
  --seed https://reviewed-public-origin.example/reviewed-public-path `
  --cache D:/Yellow/temp/dubai-market-prototype-20260925/collector-cache.json `
  --max-pages 10 `
  --max-response-bytes 2097152 `
  --output-data D:/Yellow/temp/dubai-market-prototype-20260925/collector-report.json
```

`Allow` in robots.txt is not a content license. The prototype does not retain
photos or descriptions, and its output is research evidence—not an operational
hotel import or a permission to publish third-party content. D-NATIVE-MAP-688
also records that public listing publication and provider entitlements remain
unapproved/unbuilt. Price observations are separate, date-specific evidence and
must not be inferred from marketing cards, blank-date search results, or active
status. No property/database writes are part of this order.

## Verification

The named offline test file is
[`test_public_listing_collector.py`](../../tests/market-prototype/test_public_listing_collector.py).
It mocks HTTP behavior and covers source isolation, robots precedence/wildcards and
rate hints, blocked redirects, auth/rate-limit stopping, time/body/page bounds,
metadata-only resume and cache-schema invalidation, deduplication, corrupt cache,
stable entity identity, conservative metadata extraction, and CLI artifact safety.
No external request is made by the test suite.

```powershell
python -m unittest discover -s tests/market-prototype -p 'test_public_listing_collector.py' -v
python -m py_compile scripts/market-prototype/public_listing_collector.py tests/market-prototype/test_public_listing_collector.py
python scripts/market-prototype/public_listing_collector.py --help
```

Final implementer and independent result:29/29 focused tests pass; compilation
and CLI help pass. Independent review718 resolves the cache/HTTPS/request-budget
findings. Root repeated29/29 and compilation, then fetched only the reviewed
`https://bnbmehomes.com/city/dubai` seed with max-pages1,10second timeout and1MiB
response bound: two HTTP attempts including robots, one page, no errors and zero
public JSON-LD listing records. Report/cache hashes and exact command are in
receipt718. This is not a zero-market assertion, active inventory, an October
pricing dataset or a production ingestion pipeline. No further crawl was started.
