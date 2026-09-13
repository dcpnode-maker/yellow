# Overture property discovery and market map

Order RMS-PLACES-001. Isolated from PR92 baseline
`46004d6f9b61a02f14259fd3f911e85a72ae0c60` on
`phase-9/overture-compset-map`. This is a receiving candidate, not a deployed
PMS, a phase-completion declaration, or approval to replace the desktop runtime.

## Delivered behavior

The Rates & inventory group has a Market map workspace, also available at
`/p/<property UUID>/market-map`. Authorized operators can search public lodging
records by name prefix, website URL, domain, GERS ID, a bounded map extent or a
radius. The radius uses geodesic filtering after the bounded spatial query;
truncated responses require a narrower search. The list remains usable if map
rendering is unavailable. Subject/compset choices survive ordinary searches and
clear on property change or sign-out; stale responses cannot download a previous
property's selection. Up to 50 comparable candidates can be exported for mapping
review. Names and source text are rendered as text, not HTML.

The export is a proposal with `requires-provider-mapping`,
`automaticPricingEligible: false`, and `operationalWrites: false`. It reloads
canonical records on the server. It does not create a provider/channel mapping.
That existing workflow must confirm property and room identity before rate data
can be associated with the selection.

One lazy, same-origin MapLibre GL JS engine supports flat and globe projections.
The included Natural Earth outline works without map API keys or paid tiles.
This is not a Google photorealistic terrain/building layer. At street scale the
initial basemap is sparse; a separately licensed, budgeted detail layer is a
future enhancement. The full global Parquet archive never enters the browser.

## Server setup

Use Bun 1.3.14 and install the committed lockfile. For Parquet imports use Python
3.12 and PyArrow 25.0.x (25.0.1 was used in the measured sample); NDJSON imports
use the standard library. Obtain the public Overture archive or a permitted
extract on the server and verify its provenance before import. No credentials,
guest data, client export or contract belongs in this shared public catalog.

```sh
bun install --frozen-lockfile
python3 scripts/research/build-place-catalog.py /srv/yellow/public/places/*.parquet \
  --output /srv/yellow/catalog/places-2026-08-19.0.sqlite
```

For a bounded regional catalog, append e.g.
`--bbox 55.0,24.8,55.5,25.4`. Input files are streamed in batches; a local full
file is hashed for its receipt, so full-archive import still incurs disk I/O.
The output must be a new path. A failed build cannot replace an existing good
catalog. Configure the runtime with the trusted server-side environment variable:

```sh
YELLOW_PLACE_CATALOG_PATH=/srv/yellow/catalog/places-2026-08-19.0.sqlite bun start
```

The same importer also supports a bounded direct public Azure range source. For
the observed Dubai object, use the exact asset URL linked below as INPUT, append
`--bbox 55,24.8,55.5,25.4 --expected-etag 0x8DEFE09A965A3F0`, and choose a new
output. It only accepts the pinned official Overture Places host/path, requires
a bounded area and a strong ETag, rejects redirects and unexpected byte ranges,
and caps downloaded bytes at 100 MiB per source. Its LRU cache is configured for
at most eight 8 MiB blocks. These are configured limits, not total RSS limits.
It stops on budget exhaustion or a changed source; use a smaller area or the
already preserved archive. General web URLs, credentials, proxies and S3 SDK
connections are not implemented. The first public experiment used an earlier
scratch range reader; the hardened reusable reader has mocked protocol tests
and has not yet repeated that live transfer.

The client cannot choose filesystem paths. The runtime opens the catalog readonly,
checks format/release/schema, SQLite integrity, spatial/URL indexes and canonical
record safety. Missing or invalid catalog configuration leaves discovery
unavailable without making the rest of the PMS depend on this optional dataset.
For replacement, build a new immutable catalog, validate it and change the path
through the existing receiving-owner release process. No hot swap is claimed.

## Authority and API contract

Both endpoints use the existing signed identity, tenant transaction and exact
`rates.configuration:read` permission. They recheck the active actor and database
grant for the target property, including ancestor grants, before touching the
public catalog. PostgreSQL remains the business authority; SQLite is only a
rebuildable index of public third-party place records.

- `GET /api/v1/properties/:property/market-map/places`
  takes exactly one mode: `keyword&q=`, `url&url=`, `domain&domain=`, `id&id=`,
  or `bbox&west=&south=&east=&north=`. Optional `limit` (1–200; default 100)
  and opaque `cursor` are bounded. Duplicate and unknown parameters are rejected.
  The maximum span is 5 degrees per axis. Cursor offsets cannot exceed 10,000.
- `POST /api/v1/properties/:property/market-map/selection`
  takes only `{ "subjectId": "...", "competitorIds": ["..."] }`, with 1–50
  unique competitors excluding the subject. Missing canonical records return 409.
  The response contains release metadata, subject/candidate records, generated
  timestamp and the proposal boundary flags described above.

Responses are `no-store`. Unconfigured catalog is 503 after authorization;
invalid input 400; unauthorized identity 401; absent scope/property grant 403.
Server errors do not expose paths or database details. No endpoint writes rates,
inventory, availability, tenants, PMS property mappings or outbox records.

## Observed public-data proof — 12 September 2026

Official [STAC item 00008](https://stac.overturemaps.org/2026-08-19.0/places/place/00008/00008.json)
identified this [Azure Parquet asset](https://overturemapswestus2.blob.core.windows.net/release/2026-08-19.0/theme=places/type=place/part-00008-48f1e796-6516-5a3b-b151-9c452711a6cd-c000.zstd.parquet).
The object was 641,793,437 bytes, ETag `0x8DEFE09A965A3F0`.

| Measurement | Observed result |
|---|---:|
| Dubai bbox, west/south/east/north | 55.0 / 24.8 / 55.5 / 25.4 |
| Intersecting Parquet row groups | 11 |
| Transferred range bytes | 62,979,485 |
| Local bounded Parquet bytes | 10,729,236 |
| Public place rows in that extract | 97,376 |
| Lodging catalog records | 3,257 |
| Non-lodging records skipped | 94,119 |
| Unsafe website values skipped | 109 |
| SQLite catalog bytes | 5,746,688 |
| Range-reading time, approximately | 127 s |
| Local catalog build time, approximately | 2 s |

Local extract SHA-256:
`5c5d49858baee00d94283e0bdc90403b0535cf7582e540a6127686658ed6f4ac`.
The catalog's `metadata.import_receipt` retains upstream URL, ETag, object size,
transfer bytes, bbox, source hash and import counts. Read this before comparing a
new receipt. These are actual public observations; the separate example JSON
and browser fixture explicitly contain fabricated records.

A root-agent check opened this real catalog in 21.4 ms. Fifty repeated in-process
queries of bbox `55.2,25.1,55.4,25.3`, each returning 200 records, measured p50
4.30 ms and p95 5.76 ms, with process RSS 113,782,784 bytes. This uses a warm OS
cache on a small sample: it does not measure HTTP, concurrency, cold disk, WebGL,
the global archive, or total client onboarding. No broad speedup is claimed.

The sample measures Dubai only. KSA/other geographies, completeness, hotel/STR
precision, duplicate real-world businesses with different GERS IDs and match
quality against OTAs remain to be evaluated. Same-ID rows merge deterministically;
different IDs are not silently conflated. Domain matches can be ambiguous because
one hotel chain website can refer to multiple properties. A place confidence
score is a publisher field, not an independently calibrated compset-match score.

## Provenance and costs

Pin Overture release `2026-08-19.0` and schema `1.18.0` (documentation spells it
v1.18.0). It is a snapshot of potentially older observations, not a live rate or
availability feed. Listing unavailability never implies rooms sold or unconstrained
demand. Preserve contributor source/licence fields and the applicable notices:
[release notes](https://docs.overturemaps.org/blog/2026/08/19/release-notes/),
[Places documentation](https://docs.overturemaps.org/guides/places/),
[attribution](https://docs.overturemaps.org/attribution/).
Applicable Places contributor licences include CDLA-Permissive-2.0, Apache-2.0
and CC0-1.0; the source notices travel with the data, not the map engine licence.

MapLibre GL JS **6.9.0** is pinned in package.json/bun.lock, BSD-3-Clause;
Natural Earth 1:110m land is public domain with an upstream commit and SHA in
`src/http/operator/vendor/MARKET-MAP-NOTICE.md`. The God's Eye reference at
`759652207fd1279ece97f0f19af566feb9a82146` informed interaction design. This slice
does not copy its noncommercial data layers, API credentials, Google tile access
or whole application. See the component notice for exact source links.

Data and included engine licence acquisition cost is zero. Server transfer,
storage, rebuilds, query compute and mapping review still cost money. No paid
provider was called. Total cost per validated mapped property is unknown; these
3,257 candidates have not been manually validated. A customer module price must
be measured total cost / 0.70 for a 30% gross margin. Existing rate-shopping
horizons, refresh bands and provider budgets are unchanged by place discovery.

## Acceptance and receiving owner

See `handoff/reviews/RMS-PLACES-001.md` for exact tests and remaining gates.
The existing CI quality job now requires the actual Chromium renderer proof.
It uses disposable synthetic fixtures and software WebGL; this checks correctness,
not GPU or production performance. For the same automated check on a supported
workstation with Chrome/Chromium installed:

```sh
YELLOW_REQUIRE_MARKET_MAP_BROWSER=1 \
YELLOW_MARKET_MAP_PROOF_DIR=/tmp/yellow-market-map-proof \
  bun test tests/operator-market-map.browser.test.ts
```

Without the required flag, the renderer case is explicitly skipped while the
existing VM cases still execute. Missing browser/WebGL with the flag set fails.
CI retains bounded synthetic screenshots and a JSON receipt for seven days.
The global flat/globe comparison precedes hotel markers so changed selection
styling cannot falsely prove projection. Typing then submitting must make only
one catalog request, and the missing-engine case must still allow list selection.

For interactive browser acceptance on a supported workstation:

```sh
bun scripts/research/verify-market-map-browser.ts --serve
# Open the printed loopback URL. ?deep tests initial route visibility.
# --serve --fail-map uses port 4318 and simulates a missing engine.
```

This is a loopback-only fixture using the real UI/assets/API but synthetic
permissions and three synthetic hotel records. It does not exercise PostgreSQL
or production sign-in. Confirm flat/globe rendering, list selection, subsequent
search retention, export, context reset, keyboard use and 390px phone layout.
Then repeat the real operator route with a configured catalog after the normal
release gates. Compare independently labelled Dubai/Riyadh records before
promising client coverage. A client still confirms the subject and proposed
compset; agents can handle extraction, setup and normalization.
