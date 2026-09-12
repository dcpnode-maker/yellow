# RMS-PLACES-001 — implementation and independent review

Status: source candidate; draft until database and browser acceptance are complete.
Baseline PR92 `46004d6f9b61a02f14259fd3f911e85a72ae0c60`.
This review does not promote the desktop runtime or mark any whole phase complete.

Before handoff the candidate incorporated published PR92 successor
`41415cc5c6953f71d9b3baada6fd9c7853567128`. Its source files are retained;
the only merge conflict was an append in CONTRACTS, resolved with both contracts
and the receiving runtime-status correction intact. Exact CI runs on this combined
source, not the older baseline.

## Ownership

- Root: admitted order, property authorization/API, app/server/CSP wiring, signed
  PostgreSQL test/CI step, actual application asset proof, documentation/publication.
- `places_catalog` (Sol): public catalog/importer, provenance, bounded real sample.
- `market_map_ui` (Terra): operator map/list/selection and deterministic UI proof.
- `map_reference_review` (Sol): read-only map reference/licence analysis.
- `runtime_proof` (Sol): independent nonimplementing review and personal execution
  of focused tests/typecheck. It did not author source or proof cases.

Smaller models handled the bounded lanes; root coordinated integration. This is
not a claim that a separate desktop agent was interrupted or completed this work.

## Evidence and corrections

Tests execute real readonly SQLite queries, tampered-catalog rejection, canonical
selection and exact asset responses. A VM with a minimal DOM executes the whole
map module and exercises successive searches, context clears, late exports and
GERS mode selection. The actual Elysia application serves the deep map page and
fixed JS/worker/GeoJSON assets, and denies unlisted/traversal paths in HTTP handler
tests. These results are not a rendered browser or a signed PostgreSQL test.

Independent review caught unsafe substituted catalog fields and inadequate index
validation; runtime checks and tamper cases were added. An initial token test
used the wrong signer method and was corrected to `await signer.issue(...)`.
Asset review was repeated after the final design served installed, exactly pinned
MapLibre files. Root review fixed stale export/property races, initial deep-route
loading, lost selections between searches, GERS parsing and circle filtering.

The existing CSP test initially rejected the new image `data:` source. The
narrowly admitted correction permits that value only in `img-src`, while scripts,
workers and connections must remain exactly `'self'`. Wildcards, remote URLs,
blob URLs and unsafe script/eval sources remain prohibited. No gate was removed.

Public range-reader review found automatic redirects, absent Content-Range
validation and weak/empty ETag handling. These findings require fail-closed
protocol tests before this source candidate is accepted. See final validation
receipt below for resolution; the first successful public experiment is kept
separate from the later hardened reusable-reader tests.

## Actual data and bounded measurement

A single public Dubai extract from the pinned official Overture release read
62,979,485 range bytes and produced 3,257 lodging records in a 5,746,688-byte
SQLite index. Root independently opened and queried that real catalog, checked
its embedded receipt, and measured 50 repeated 200-record bounded queries:
p50 4.30ms, p95 5.76ms; open21.4ms; processRSS113,782,784bytes. This is a warm,
small, in-process test only. Exact upstream URL/ETag/hash/counts and approximate
transfer/build times are in the research document. KSA/global completeness,
OTA matching accuracy, concurrent HTTP and total onboarding time are unmeasured.
The example/browser hotel rows are separately labelled synthetic.

## Environment limitations and receiving gates

Actual `./setup.sh --db-only` failed with:
`Missing docker. Install Docker Engine/Desktop with the Compose plugin.`
No local PostgreSQL or Docker proof is claimed. A package-manager provisioning
attempt failed on this cloud namespace's process/permission restrictions; it was
not bypassed. No existing PMS database or laptop/WSL runtime was altered.

The new CI step runs `tests/market-map.integration.test.ts` using the existing
provisioned deployment/runtime roles. It creates its own UUID-named database,
applies canonical migrations, and exercises two tenants, sibling/ancestor grants,
token claim mismatches, disabled actors and revoked grants through signed HTTP.
Denials assert no catalog reads. An explicit required flag prevents a missing
environment from silently skipping the proof in CI. Local runs legitimately skip
those five cases. Canonical 11/11 remains required and cannot be inferred from
unit tests or the baseline branch's historical CI.

Cloud Browser returned `net::ERR_BLOCKED_BY_CLIENT` for the loopback fixture URL;
there was no supported preview route. No screenshot, WebGL, real globe,
390px-phone or production-login acceptance is claimed. The committed loopback
fixture supports a receiving owner's real browser check, including a deliberate
missing-engine mode. The receiver must complete this visual/interaction check
and the existing release gates before promoting the feature.

No self-merge, deployment, rate/inventory write, OTA/provider request, private
client import, paid API call or transfer of credentials occurred in this lane.

## Final validation receipt

Root final run: 48 Bun tests passed, 5 PostgreSQL cases explicitly skipped,
0 failed, 436 assertions across the seven focused API/catalog/UI/CSP/assets
suites. Python importer7/7; strict TypeScript passed;199 import boundaries passed;
licence check passed48 installed packages. Static browser preflight and
`git diff --check` passed. No test skip is counted as a database pass.

Independent nonimplementing reviewer personally reran Python7/7, its narrower
Bun selection34pass/5PGskips/0fail/245assertions, and types. It approved the source
for CI proof after confirming redirects are disabled, expected ETag is required
before network, weak/empty tags rejected, `If-Match` sent, exact206/range/length
validated, and the100MiB budget enforced before reads. It also checked bounded
cache, taxonomy, atomic output and actual application asset/CSP tests. The
remaining low-level note is that response ETag parsing accepts unquoted tokens;
the official Azure response is quoted and the reviewer found no continuity or
SSRF bypass for the fixed host.

Exact-commit CI and receiving browser acceptance remain outstanding at source
publication. Publication stays draft and the receiving handoff must carry the
actual result instead of treating this source receipt as a completed release.

## First exact CI and scoped regression correction

CI34726099936 on75727ee9 failed quality in12 cases: fixed navigation counts/route
lists, the old single-dependency assertion, and broad same-origin text checks
matching a literal example URL in the new placeholder. Local-review and
windows-state succeeded; dependent database/container/ARM jobs were skipped.
This failed run is retained and is not database evidence.

The admitted navigation-proof clarification updates only exact known lists for
the new16th destination and the pinned map dependency. All original15 symbols
and vendor bytes remain identical. The browser fixture serves the new JS/CSS and
asserts the original15 distinct bindings plus the new labelled map binding,
keeping every focus/contrast/geometry/motion assertion. The placeholder now uses
a plain example domain; the existing same-origin tests remain unchanged.
Root reran all10 affected non-browser files:62passed/0failed/1375assertions.
The original browser fixture still requires genuine execution in CI; it was not
run through an alternate browser-control path in this workspace.
The nonimplementing reviewer separately executed the same62/0/1375 checks and
types, inspected the exact source/test diff, and found no weakened prior assertion.
