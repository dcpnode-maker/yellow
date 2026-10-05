# Order718 independent collector review — 25 September 2026

Reviewer: `/root/guest_contract709`; I did not implement the collector or its tests.
Scope reviewed: `scripts/market-prototype/public_listing_collector.py` and
`tests/market-prototype/test_public_listing_collector.py`. No public page was
fetched, no database was touched, and no source edits were made by the reviewer.

## Review and disposition

The initial review found a cache migration defect: the new metadata rows added
`observation_kind` and `availability_status` without advancing the cache schema.
Legacy rows were silently dropped while their page entry was retained, so resume
would skip a refetch. I reproduced this offline (`entry_retained=True`,
`records_retained=0`, no error). The builder fixed this by advancing the cache to
schema v2 and rejecting incomplete cached pages; legacy-v1 and partial-row
regressions were added and passed in the final run.

Current source rejects all redirects until the destination is separately seeded,
rejects percent-encoded and dot-segment paths, enforces exact origin allowlists,
fails closed on unavailable robots rules, and stops an origin on 401/403/429.
Robots matching now covers `*`, `$`, longest-rule matching, Allow tie-breaks and
the configured crawl/request rate hints. The parser reads anchors and JSON-LD
only; saved rows omit descriptions and raw response bodies. Cache rows are
allowlisted metadata with the exact source scope, timestamps and hashes. Records
are explicitly labeled `public_metadata_candidate` with `availability_status`
`unknown`; exact-looking supplied points are marked unverified. It no longer
infers bedrooms from `numberOfRooms` or accepts the generic `LodgingBusiness`
node as a listing type. Those candidate labels are important: broad `Accommodation`
and similar schema types do not prove an independently marketable unit.

One material bounds finding remains before a live crawl: `max_pages` caps visited
content pages, but `allowed_origins` and `seed_urls` are uncapped, and seeds denied
by robots do not advance the visited-page counter. An offline mock using
`max_pages=1`, three allowlisted origins/seeds and disallow-all robots rules
processed three robots loads with zero visited pages. Add a bounded seed/origin
or total-request limit that includes `robots.txt` attempts before using the CLI
against public sources. Also, the module docstring says exact HTTPS origins while
`_origin` accepts both HTTP and HTTPS; either enforce HTTPS or align the declared
contract. No public fetching was performed.

## Reviewer-run proof

`python -m unittest discover -s tests/market-prototype -p 'test_public_listing_collector.py' -v`
— **28 passed, 0 failed**.

`python -m py_compile scripts/market-prototype/public_listing_collector.py tests/market-prototype/test_public_listing_collector.py`
— **pass** (bytecode cache directed outside the repository).

`python scripts/market-prototype/public_listing_collector.py --help` — **pass**;
help does not start collection.

The suite mocks HTTP and covers the exact-origin/redirect/path guards, robots
semantics and fail-closed behavior, 401/403/429 handling, byte/timeout/page/rate
limits, metadata-only parsing, identity candidates and unknown availability,
cache scope/resume/legacy invalidation, and explicit non-overwriting CLI output.

## Verdict and limits

The collector is suitable for continued offline work. **Withhold approval for a
live public crawl** until request counts (including robots loads) are bounded and
the HTTP-versus-HTTPS contract is resolved. This review does not establish that
the source permits reuse of names or coordinates, that metadata identifies a
unique physical unit, or that any candidate is bookable; the source/retention
decision and all live collection remain outside this proof.

## Final independent re-review — `/root/review709`, 25 September 2026

I did not implement Order718. After `/root/completion_queue709` froze the collector
and tests, I read both files in full and personally executed the offline proof.
Reviewed SHA-256: collector
`23E10EFAC9D46C9D50EC0FAC81E9638F9883D601944090BEB4F7658F16EB5560`,
test `14FE526BBCEB1ACF9DE44F5D88A864643EE17C1F5622A1285027BE23CDC61291`.

The two prior live blockers are resolved in this source. All allowlist entries and
seeds require HTTPS; candidate links and returned final URLs pass the same exact
origin check, and automatic redirects are refused. The constructor caps five
origins and 50 seeds. `_fetch_url` increments `http_attempts` before every actual
network open, including `robots.txt`, and refuses further opens after
`max_pages + len(allowed_origins)` attempts. A mocked three-origin, robots-denied,
one-page case confirms three robots attempts and zero content pages; it cannot
expand into unbounded robots loads. Maximum page count, body bytes, timeout,
sequential rate spacing, fail-closed robots behavior, 401/403/429 host stops and
metadata-only cache v2 are retained. This is a request-count bound, not a claim
that source use or a dataset is authorized.

Personally executed commands and results:

- `python -B -m unittest discover -s tests/market-prototype -p 'test_public_listing_collector.py' -v`: **29 passed, 0 failed**. All HTTP behavior in this suite is mocked.
- `python -m py_compile scripts/market-prototype/public_listing_collector.py tests/market-prototype/test_public_listing_collector.py`: **exit 0**, with `PYTHONPYCACHEPREFIX` directed to `D:/Yellow/temp/dubai-market-prototype-20260925/review-pycache`.
- `python scripts/market-prototype/public_listing_collector.py --help`: **exit 0**; displayed exact HTTPS origin, explicit HTTPS seed and bounded options without starting collection.

**Verdict:** the collector is ready for a separately authorized, very small live
metadata run. For one reviewed origin, one explicit seed and `--max-pages 1`, its
own cap permits at most two network attempts (robots plus one page); a robots
denial or fetch stop permits fewer. Root must still decide the permitted source,
terms/retention and specific parameters before running it. I made **no public
requests**, did not run the CLI with sources, and did not verify names, coordinates,
listing identity, bookability, availability or October quotes. No hotel database
was accessed or changed. The earlier withheld-live verdict above is superseded
only for the two boundedness/HTTPS defects, not for those source/data limitations.
