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

## September13 continuation: close the renderer proof gap

Both attempts of CI34726472461 completed with all six jobs green at088c4021.
Root downloaded the independent repeat's database job103644288589 log: signed
map isolation5/5, zero failures,19 assertions; canonical referee11/11. The earlier
"repeat running" handoff is superseded by that observed completed result. These
are historical head088c proofs, not the new successor's acceptance.

The receiving branch advanced to da9f97d46af3cb78f1ea98e49bed03581686a5ef (Order467).
Although a GitHub status read reported non-mergeable, `git merge-tree` found a
clean merge. Its published status/release evidence was incorporated without
editing the receiving changes. This branch does not claim that runtime's state.

Ankit requested "Fix it please". The resolved CI clarification admits a required
actual renderer test in the existing quality job. The existing synthetic fixture
now exports an ephemeral server factory and serves the correct local font and
favicon paths. Production fixes explicit form submission's duplicate request by
clearing the pending input debounce. The browser case asserts that behavior,
actual global projection before marker changes, desktop/phone geometry,
keyboard/list selection, export/context reset and missing-engine operation.
VM and real Chromium results remain separate; absent local browser is a skip
unless explicitly required, in which case it is a failure.

The required CI command writes bounded synthetic-only screenshot/JSON artifacts.
GitHub's official upload-artifact7.0.1 is pinned by exact commit with seven-day
retention, no hidden files and no new application dependency or token scope.
Root read its action, upload implementation and MIT licence. The source is
documented in the CI clarification. Exact successor CI and screenshot inspection
must be recorded in PR93 before claiming renderer acceptance. No local raw
browser workaround, retained runtime change, operational write, merge to the
receiving branch or deployment is part of this continuation.

Successor local proof: root34pass/3explicit skips/0fail/333 assertions across
map, asset, CSP and receiving-status suites; types and199 boundaries pass. The
nonimplementing map-fix reviewer personally executed10pass/1renderer skip/0fail/69
assertions, preflight, types and diff check. Its raster-timing finding was fixed
with bounded stable capture while preserving projection identity assertions.
The polling deadline includes capture time; no local Chromium proof is claimed.

## Required CI blocked by incorporated status expectations

CI34739524076 on31ab3ff2 failed three full-suite tests before the actual renderer
step. Quality failed; local-review and Windows-state passed; database, ARM64 and
container jobs were skipped. There is no renderer artifact or acceptance from
that run. The three tests still pinned the September12 Order464 snapshot despite
the incorporated published Order467 source recording September13/Order466 and
the timestamped Q258 local delivery. The CI clarification admits their correction
before edits; production status remains byte-identical to receiving source.

Root executes all three corrected files:8passed,2existing database-gated skips,
0failed,222 assertions. Historical records through Order444, all18 phase states,
review coverage91 and provider/runtime caveats remain asserted. New assertions
pin Orders465/466 to their recorded source/CI receipts and preserve the difference
between historical promotion and current runtime. The unchanged database cases
remain CI work; no deployment or release is inferred from status test success.

The independent nonimplementer separately executes the same8/2skips/0fail/222
assertions and finds no weakened history or release boundary. Source7230e7ce is
published. No CI run starts while the PR reports dirty. The initially returned
base da9 is an ancestor (GitHub compare ahead5/behind0 and local merge-tree both
clean); refreshing the existing draft subsequently reveals newly published
receiving d819e080, which independently repairs the same three status tests.
This newer merge genuinely conflicts only in those three files. Incorporate all
receiving source/documents unchanged, retain its test names and new runtime/last
order assertions, plus this lane's stronger receipt and completion assertions.
Root's combined three-file proof passes8/2existing DB skips/0fail/234 assertions.
The PR92 coordination comment5651386935 identifies the shared status repair and
retains this lane's map ownership. Actual renderer acceptance still awaits CI.

The merged source f5051660 runs CI34740449038. Its full regression suite passes,
but required actual Chromium proof fails at desktop-lazy-load because the map
falls back before the engine loads. Root inspects the actual failure screenshot;
this is genuine browser failure, not acceptance. Windows/local-review pass and
dependent database/ARM64/container jobs skip. The bounded screenshot artifact is
retained. Add bounded failure JSON (runtime errors, request/status receipts and
safe synthetic DOM diagnostics) and a local console initialization reason; keep
the product's friendly fallback unchanged. MapLibre6.9's actual pinned source
requires WebGL2, so the proof now requires WebGL2 explicitly and releases its
probe context. No test assertion or CSP is relaxed, and no renderer fix is yet
claimed. Both root and independent status reviewer pass the merged234 assertions.

CI34740793655 onc43e4836 reproduces the failure with WebGL2=true and every map
asset200. The captured initialization TypeError reads null index0; it occurs
before a worker request. The upstream primary issue6148 reports this same error
for a360-degree maxBounds, exactly the option supplied by this map constructor:
https://github.com/maplibre/maplibre-gl-js/issues/6148. Remove the redundant global
maxBounds and use the engine's default global camera. The existing boundedBounds
client checks and server5-degree/radius budgets remain unchanged. Required actual
browser proof establishes whether this candidate resolves the observed failure;
the issue report alone is not a Yellow test. Move that proof before the full
suite under the admitted CI clarification, retaining all required gates.

The independent map reviewer finds no scope/budget/gate regression and personally
runs10/1explicit browser skip/0fail/69 assertions. Published3f3d3082 cannot start
CI because the receiver advances to33a39508 (accepted Order468 credit printing).
Incorporate that exact published source without changing its implementation.
Only CONTRACTS' appended sections conflict; both complete sections are preserved.
Status tests merge automatically with this lane's extra receipt assertions intact.
Current source and required renderer acceptance must use this new combined tree.

CI34741226348 onc4c16120 stops earlier: Chromium does not expose its debugging
port within the harness's6-second startup allowance. This attempt never reaches
the map and supplies no evidence about the maxBounds correction. Replace that
startup-only allowance with a20-second monotonic deadline, retain at most16KiB
of browser stderr while draining the pipe, and always emit a failed lifecycle
receipt when startup fails. All rendering/interaction assertions and the55-second
overall test bound remain unchanged. No unsupported browser flag, CSP relaxation
or silent retry is introduced. The next exact run must still prove the map.

CI34741439147 ond641b9f1 loads WebGL2 and the real map with allassets200 and no
runtime errors. Global flat/globe/restored pixel identity, desktop geometry,
immediate-submit deduplication, keyboard selection/export and context reset all
pass before the phone raster fails with one colour. Root inspects actual flat,
globe and phone failure previews: capture rectangles extend below the viewport,
and the globe still shows the placeholder text. Remove the initial placeholder
before construction and give an initialized MapLibre host block layout/zero
padding; restore placeholder styling on initialization failure. Correct the
test's complete-canvas capture and retain the raster/geometry assertions. This
run is partial renderer evidence, not accepted phone/fallback or full CI proof.

## New PR review findings — 13 September 2026

The prior 5c39c81 source subsequently passed all six jobs in CI34741706278;
the post-publication execution receipt is PR93 comment5651711840. This historical
pass is preserved. The automated review then posted five new findings, and Ankit
asked this lane to handle only unfinished work without duplicating Order472.
PR93 was returned to draft and PR92 comment5652111209 reserved these five repairs.

Confirmed regressions: camelCase private provenance and nested scalar values were
accepted; local NDJSON/Parquet could lack release evidence; multiple URLs duplicated
domain results; Python casefold and runtime lowercase disagreed; visible bounds
clipped the antimeridian. Added focused tests failed before the fixes. The four
new Python tests initially produced20 failed subcases/one missing-evidence error;
the two new runtime tests initially failed0pass/2fail. Terra reproduced the domain
duplicate and clipped/invalid viewport requests before repair.

Repairs stay in the admitted importer/catalog/map surfaces. Public SourceItem keys
and types are checked both on import and before returning old SQLite records.
Local inputs require matching release and schema evidence, including aliases and
conflict rejection. Name keys use the runtime-compatible normalization and old
incompatible keys fail visibly. Domain results are unique before pagination.
Map/radius bounds support unwrapped and canonical dateline crossings while keeping
finite, positive, at-most-five-degree spans.

Root personally executed Python importer11/11; focused TypeScript map/catalog/API/
CSP38passed,1explicit Chromium-environment skip,0failed,318 assertions; strict types
and199 import boundaries pass. An adjacent static string assertion initially failed
after the bounds helper changed; it now checks both actual latitude/longitude
limits, with the behavioral VM tests retained. No assertion was removed to hide an
accepted behavior change. Real Chromium and PostgreSQL remain required CI gates.

Fresh nonimplementing `/root/map_remaining_provenance_review` (requested Astra,
high reasoning) APPROVES only the new provenance/release/normalization/domain
repair. It personally ran Python11/11 and Bun catalog11/11 with94 assertions, plus
positive all-ten-source-field preservation, seven invalid range probes and two
case-variant metadata conflict probes. It made no edits and did not claim PG proof.
Reviewed SHA-256 files:

```
eefb88696cc8fb0cf039cb15a746338ac02d5d5fc71d14b6863147f15e539fb4 scripts/research/build-place-catalog.py
59667a2d2d873b7ca8c19afb13b74ab027253dc24f00a755535e3b729e136c24 src/contexts/distribution/place-catalog.ts
cf1f060045a8c64f04501688889ef83ca4b70886061cb6e7bd066110fe02b9f4 tests/place-catalog-import.test.py
f075a5f61e27ce0ff75d3acde6a78c733aefdea768a606852ed9d72f64260272 tests/place-catalog.test.ts
d5e0f5e06f4c0dd095a1a517b3a6b0faaac36839793cd6b74a17dc5017495d95 scripts/research/place-catalog-example.json
```

Root separately reviewed Terra's small domain/bounds changes and ran their combined
suite. The prepared public Dubai catalog passes the new validators read-only for
3,257 records/6,514 source items; no data copy or upload is needed. There is no
private-client processing, schema/authority change, receiving-tree write or runtime
activation. Successor publication and exact CI are pending at this committed
checkpoint; final results belong in a post-publication PR receipt.

Receiving-source reconciliation: published Order470 at63338ed312f925bddd951665189196e3615a51b9 merged automatically into this isolated candidate, with no conflicts or changes to the reviewed importer/catalog hashes. Root checked the combined four-file status surface:17passed,4explicitDB/Windows skips,0failed,401 assertions. Order472 remains uncommitted on the receiving workstation and is not present or modified here. This is source integration in the PR93 lane, not a receiving-branch merge or runtime activation.
