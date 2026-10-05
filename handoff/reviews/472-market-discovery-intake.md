# Order472 — bounded market-discovery source acceptance

Date: 13 September 2026. Order472 remains active; this is not live delivery.

## Ownership and personally executed proof

- `/root/q258_runtime_cutover` implemented discovery and the regional adapter.
  Non-implementer `/root` inspected final source, returned defects for correction,
  and personally executed the TypeScript suite below.
- `/root/q258_source_adapter` implemented dated-observation fallback. Root
  independently inspected it and executed the same final combined suite.
- `/root` implemented the extractor and its Python tests. Non-implementer
  `/root/astra_ultra_handoff` (gpt-6-astra / ultra) inspected final code and personally
  executed all 13 Python tests, including the installed DuckDB native query fixture.
  Real publisher queries were executed by root, not by the reviewer.

All commands used the existing active checkout
`C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order175-folio-responsive-containment`.

```powershell
& 'C:\Users\astha\.bun\bin\bun.exe' test tests/market-discovery.test.ts tests/market-regional-artifact.test.ts tests/market-shopping.test.ts tests/market-batches.test.ts tests/market-source-adapters.test.ts
& 'C:\Users\astha\.bun\bin\bun.exe' run typecheck
& 'C:\Users\astha\.bun\bin\bun.exe' run boundaries
& 'C:\Users\astha\AppData\Local\Programs\Python\Python313\python.exe' -B -m unittest discover -s tests/research -p test_extract_overture_region.py -v
```

Root TypeScript result: **62 pass, 0 fail, 437 assertions**, 5 files, 844ms;
typecheck exits0 and import boundaries pass across200 TypeScript files.
Independent native Python result: **13 pass, 0 fail, 0 skips**, 1.398s.
These are focused source proofs, not a full repository/DB/release gate.

## Regional checkpoint SHA256 (D1486)

| File | SHA256 |
|---|---|
| `src/contexts/distribution/market-discovery.ts` | `806517258F995743FD437B5E58A5702233F3B1EEDC8530AF9751FEF064578CAA` |
| `tests/market-discovery.test.ts` | `121246AA379F240A0F66B4E239E065D798ABA893F896E09B0DC57EC37C2220DE` |
| `src/contexts/distribution/market-regional-artifact.ts` | `74E286E3515271C0F2BB2AB0B1DD3D70E55846A1E14FB471A81AD88BF626BE39` |
| `tests/market-regional-artifact.test.ts` | `6406447BA83E7D0132F05216A6EDCBE7FF91278E6A17DEEBFA75AC74AE4CC147` |
| `src/contexts/distribution/market-shopping.ts` | `55DC78F89F9B23B260E1F009020B665AD46F4CA388B908DF687DA7856789BD50` |
| `tests/market-shopping.test.ts` | `8A6877D66241272EB7E0E4758A9B706D771C05BF605496374D6903BE86AA3A52` |
| `src/contexts/distribution/index.ts` | `F4E387351AD013A9F32791650165DFBF1DB9A389F0FE147CE38BF53343309588` |
| `scripts/research/extract-overture-region.py` | `AFA6D92F26AE8B3BAC5113866E814B899A52FFA16AD22439548F7A9240BC023C` |
| `tests/research/test_extract_overture_region.py` | `66E3677742C3E39BB23BE1DA0A56DDC9EE4BDAA7F4BFFD64EE24BD15A9C7F2A1` |

## Genuine findings and corrections

Discovery review repaired whitespace-only core fields, locale-dependent comparison
and throwing public exports. Typed Result wrappers alone are public. An intermediate
fixture literal-type failure was corrected without weakening the product boundary.

The artifact adapter originally accepted the first of conflicting duplicate IDs.
It now counts IDs across all501 rows, including the sentinel, and rejects every
occurrence of a duplicate. Optional unsafe URLs are excluded without retaining
query/credential secrets; raw addresses stay evidence-only. Embedded hashes and
regex-shaped publisher URLs are metadata, not future server admission authority.

The first extractor projected float32 bbox anchors instead of original point
geometry. Its successful v1 outputs remain unchanged and are not accepted map
identities. Strict WKB decoding replaced that projection. A real corrected query
then failed because `CAST(GEOMETRY AS BLOB)` is unsupported on the pinned binary;
the initial BLOB-only fixture did not detect this. The failure is retained at
`E:\yellow\market-discovery\order472\region-20260913T075837Z-d12255d42b30474ba2b730cf19b3048f`:
20.564s, no accepted artifact. The fix uses native `ST_AsWKB(geometry)` and upgrades
the fixture to actual `GEOMETRY('OGC:CRS84')`, not a relaxed assertion or new spatial
dependency. Both endian encodings, malformed/dimension/range/NULL handling and
exact edge filtering before LIMIT501 now pass independent native proof.

Fallback review repaired an incorrect blanket `stale-collection` reason and a
missing prior observation when a newer response is non-actionable. Original source
age/reason is retained; expired unavailability is not current unavailability.
Distinct dated evidence is appended once, fresh success replaces it, and invalid
or cross-context cache cannot become a fallback. Existing bounds still apply.

## Actual bounded v2 artifacts

Root ran the extractor with `--bbox` for each region, then read receipts,
independently hashed `region.json` bytes and passed them through the public typed
adapter. All observations retain unknown operating status. Artifact folders also
contain bounded settings/supervision receipts. Source method is
`publisher-range-extract`, coordinate method `source-wkb-point`, not independent
verification of physical coordinates or Drive payload content.

| Region / bbox (lat min,max; lon min,max) | Exclusive folder under `E:\yellow\market-discovery\order472` | Rows / bytes / elapsed | Artifact SHA256 |
|---|---|---|---|
| Riyadh / 24.707,24.709;46.676,46.678 | `region-20260913T080233Z-139ffad96f59497a9a19d547792d070e` | 33 / 41,226 / 31.04s | `4b90f33418ab95d62c5ed21a09a601c5bf93c7cf66817e91fe86e0562fa17009` |
| Dubai / 25.196,25.198;55.270,55.272 | `region-20260913T080453Z-5b27867cde994a0b9c673d099ecb7d85` | 35 / 43,688 / 34.648s | `7c0c268a34cb461713eed238124c627a5d1c0e44e3509184a215628b362cc6e7` |

Adapter results: Riyadh33 valid/0 rejected/46 optional exclusions; Dubai35 valid/
0 rejected/52 optional exclusions. Both `moreAvailable=false`, complete only for
the requested bounded **all-places** query. No hotel-only coverage, real-client
compset, fuzzy-match accuracy, live quote or demand acceptance follows. Root also
confirmed legacy v1 rejection. Legacy Dubai501 and Riyadh33 artifacts are retained
as bbox-derived evidence, not relabelled v2.

## Resource and release boundaries

One isolated DuckDB1.5.5 tool on E:, wheel SHA256
`6826504277dba513c0c5d71d828456c94d729c9d2482f94b2e289f90a9167e28`;
signed canonical httpfs SHA256
`65661c40463e74751993e8a7cb7b4c8906be9218319616a0bdfc1b4ae9ffdf9a`.
The earlier httpfs INSTALL move error and identical owned temporary copy remain;
the extractor explicitly loads the canonical signed file. No cleanup was executed.
Independent inspection compared installed wheel members; the extractor rehashes
the wheel and extension but does not rehash every installed module on every run.

Exact16 manifest-pinned objects; threads2, memory/temp256MiB, supervisor120s,
4MiB artifact and 270MiB run bounds, 2GiB disk reserve, full-download fallback and
automatic extension installation disabled. Network bytes were not measured and
there is no hard network-byte cap; SQL LIMIT is not one. Unsupported geometry and
budget failures fail closed; no implicit global restore, recursion or PMS writes.

Still unbuilt: server-verified artifact admission, authenticated durable compset,
map/table and planner integration. No new extension registration, database proof,
provider activation, source publication, local promotion or phase closure occurred.
Published633 CI quality failures remain unresolved; the last verified sole local
is41415/frontier91. Frozen471 and all unrelated work remain preserved.

## Subsequent byte-admission acceptance (D1487)

Builder `/root/q258_runtime_cutover`; root is the non-implementing reviewer.
New `market-regional-admission.ts` validates bounded copied bytes against server-owned
expected logical ID/length/hash/region, hashes original bytes internally, checks
fatal UTF8/BOM and accepted v2 structure, and requires the exact16 publisher URLs
and wheel/httpfs pins. No file I/O, property authority or module-import side effects.

Root found a genuine RED at initial source1EEE57C2: a SharedArrayBuffer view with
an own `.buffer` property hiding its backing storage was accepted. The exact actual
Dubai-byte reproduction returned `shadowedSharedBufferAccepted:true`, exit1.
The repair reads captured native TypedArray buffer/length/offset slots once,
refuses shared/detached backing and never invokes instance getters/iterators.
Root reran the same reproduction: rejected, exit0. Root also actually executed
transfer/detached rejection, rather than counting a conditional skipped assertion.
Tests cover offset views, Buffer, throwing/dynamic getters, pre-await input and
metadata mutation, hash/region/length drift, UTF8/BOM/v1 and source/tool substitution.

Root personally executed the prior five-file suite plus
`tests/market-regional-admission.test.ts`: **66 pass, 0 fail, 470 assertions**, 6 files,
587ms. Strict types and201 import boundaries pass after root's explicit public
exports. Root independently compares all16 literal URLs with the previously hashed
Drive manifest and successfully admits both actual pinned Riyadh/Dubai artifacts
through the public entrypoint. These direct read-only probes are not a hardened
filesystem loader or a mounted app catalog.

Final new-source SHA256:

- `src/contexts/distribution/market-regional-admission.ts`:
  `61976E448BA1B6AAA11B8DD209E85E67D09AACB94A9CBDCB33DAEED1C230A5ED`.
- `tests/market-regional-admission.test.ts`:
  `8BA768C2150810B228A72FE77A5FB2AAD891C26A0F072D6FE863BF6A29DBF4FB`.
- `src/contexts/distribution/index.ts` (supersedes its D1486 hash only):
  `F4641B90E96F4C2ACAEF83C5AD7B4E8519B76E827FBB56BDAEAD741DCEB1314C`.

Next exact scope: private two-entry runtime manifest, native filesystem path/handle
validation and immutable catalog; then property-granted compset persistence and
map/planner mounting. No registration, runtime, publication or phase closure here.

## Native runtime catalog acceptance (D1488)

Production reader author: `/root/astra_ultra_handoff` (gpt-6-astra/ultra).
Production loader and unit-test author: `/root/q258_runtime_cutover`.
Root did not implement either production file; it inspected both and personally
executed the independent native tests it authored. Astra separately inspected
the fixture-only cleanup ownership boundary; this is not a general-purpose
all-reparse-tag or hostile-race-safe deletion utility.

The explicit loader owns the private two-entry manifest and invokes the preserved
PowerShell7 binary with `shell:false`, `windowsHide:true`, a15,000ms child deadline,
4MiB input bound, approximately5.6MiB stdout cap and64KiB stderr cap. It never reads
at module import or scans a directory. Server-only root/executable/reader options
cannot replace the catalog, hashes or validator. Each explicit invocation loads
both files before publishing the frozen result. Composition must call it before
request handling; no composition or HTTP route is added here.

The helper uses .NET SafeFileHandle/Win32 opened-handle checks, not experimental
Bun FFI. It retains every directory from the drive root through the parent,
rejects native reparse flags, opens the regular leaf without write/delete sharing,
rejects multiple hard links, verifies bounded exact size and final path/identity
before and after same-handle reads, and closes owned handles in finally. Manual
argument parsing contains malformed input in the same static failure receipt.
It neither logs private paths/content nor writes data. Only the supervising caller
owns timeout/hash/UTF8 admission; synchronous native ReadFile has no JS timer.

### Root-executed proof

Using preserved Bun1.3.14 and PowerShell7.6.5, with `YELLOW_NATIVE_MARKET_PROOF=1`:

```text
bun test tests/market-regional-artifact-loader.test.ts tests/native-market-regional-artifact.test.ts tests/market-regional-admission.test.ts tests/market-regional-artifact.test.ts tests/market-discovery.test.ts tests/market-shopping.test.ts tests/market-batches.test.ts tests/market-source-adapters.test.ts
81 pass; 0 fail; 589 assertions; 8 files; 52.98s

bun node_modules/typescript/bin/tsc --noEmit
exit 0
bun scripts/check-import-boundaries.ts
201 TypeScript files; zero violations
```

All9 native cases actually executed. Regular and Unicode-path bytes match; handles
close; missing files/directories/wrong lengths/oversize/zero lengths fail; traversal,
UNC/device/drive-relative/ADS/reserved/trailing/control names fail with empty stderr;
actual ancestor/root/leaf junctions and hard-linked files fail; a held writable
file handle is rejected and succeeds after closure. Both real Riyadh/Dubai pinned
artifacts load with33/35 unknown-status records and frozen receipts. The first valid
file plus missing second file exposes no partial result. A same-length one-byte
mutation in an exclusively owned fixture fails actual SHA admission; original
artifact bytes remain identical. The reparse fixture was a directory junction,
not a claimed execution against every reparse tag or a file symlink.

After final freeze, root also ran the6 loader tests and3 real catalog cases via
`--test-name-pattern 'Order472 explicit|loads both real|never exposes|same-length tampered'`:
9 pass,0 fail,76 assertions,7.89s;6 other native cases explicitly filtered out.
This focused confirmation does not invent an additional complete native run.

Unit supervision tests run actual loader/parser code with transport/timer mocks
inside isolated, shell-free Bun children bounded to4s/128KiB. They prove receipt
validation, output caps, stream errors, nonzero exit and the actual timeout callback
with configured15,000ms delay, including late-output containment. They do not prove
a real15-second wait or kernel termination of a stalled native child. Root rejected
an initial throw-only test label and a main-process module mock during inspection;
the latter was replaced before combined acceptance to avoid leaking mocks into
other tests. No production test-only launcher/validator option was added. Public
index imports, stricter override paths and stream-error handling were also repaired.

| Final source | SHA256 |
|---|---|
| `scripts/native/read-market-regional-artifact.ps1` | `F00DDE6C140AF80889B1499EE4F2214E6136F6B46B828CF848D46ED659E79DDD` |
| `src/runtime/market-regional-artifact-loader.ts` | `F32E93484CC6DD18BCA7E5902D0315AF1720D1C5EF2D27562981E65EE35C11EA` |
| `tests/market-regional-artifact-loader.test.ts` | `4904E20D2DE6C2166D643AF1C9DD97FB8DFFB78CD365BBA1D6D05899D950ED0F` |
| `tests/native-market-regional-artifact.test.ts` | `B42C9AE0A82B16666060E6DE1567C7F537A309F2D8AD58F5096C4B4572A4108B` |

Prior accepted domain/index and frozen471 hashes remain unchanged. Exclusive
`native-proof-*` fixture directories were removed; no original artifact, v1 failure,
toolchain or business data was deleted. No new dependency was installed. Actual
native portability is Windows-only here; other platforms fail closed. No new DB,
extension registration, mounted catalog/map, commit/push, local cutover or phase
completion follows. Exact633 CI timeouts remain unresolved; the read-only worker
identified pwsh/git children in the two failures and proposed a two-file isolated
CI diagnostic, but no cause or fix is claimed and no workflow changed.

## Property competitor-set backend and isolated native proof (D1489)

Scope was admitted before edits in Q264 and Q265. Domain, schema, public exports
and migration0092 author: /root/astra_ultra_handoff (gpt-6-astra/ultra). HTTP/managed
generic-route guards and HTTP tests author: /root/q258_runtime_cutover. Guarded
native preparer and synthetic fixture author: /root/q258_source_adapter. Root
did not implement those production changes; it inspected them and personally
executed all database and final aggregate proof. Root authored the seed type-only
addition, docs, native environment tests and actual schema snapshot. The HTTP
worker independently inspected root's seed change and personally ran its pure
catalogue test:1pass,5 explicitly skipped DB cases,0fail,5 assertions. No default
instance, permission or role grant was added by that seed change.

### Implemented behavior

- Server-admitted logical ID/hash/source-record references only; actor/property
  come from authenticated context. Request and actor snapshots precede the first
  await. Strict bounded schemas retain provenance, original capture-time spelling
  and completeness; no inference that a record is a verified hotel or current rate.
- Managed extension type with property key, expected-active-version comparison
  under the existing extension lock, immutable versions, explicit empty-set clear,
  exact actor-bound idempotency, atomic facts and outbox. Historical replay is a
  receipt, not a claim that an old version is still active.
- Owner-fixed, narrow SECURITY DEFINER function checks active tenant/user and one
  complete current property-scoped grant, locks relevant rows FOR SHARE, rereads
  that grant and fails if withdrawn/changed. Locks survive successful savepoint
  release until the outer transaction ends. No broad identity-table UPDATE grant.
- Dedicated discovery/current/confirm HTTP routes; generic extension registration,
  creation and listing cannot bypass this managed type's property boundary.
  This guards application routes, not a claim that arbitrary privileged SQL cannot
  alter configuration. Deliberate deploy-owned synthetic corruption is tested.

### Actual preparation and retained failed check

The first read-only Review stopped with cluster_identity_mismatch: PostgreSQL
rendered inet_server_addr()::text as127.0.0.1/32. Root inspected the actual non-secret
identity; the builder changed both checks to host(inet_server_addr()), retaining
exact127.0.0.1 equality. No target existed and no mutation occurred on that failure.
Review also repaired a missing role-fingerprint comma, second-read catalogue hash
binding, direct-call URL validation, canonical child migration-directory pinning
and skipped-test pool construction. Initial root ProcessEnv test typing failure
was corrected. These are genuine findings, not waived checks.

Root privately read the existing protected regular Order442 authority files,
validated their original database/role/loopback address, and changed only the
per-child target to the exact Q265 database. No credentials are copied here or
written into new files. Native postgres/psql binary hashes were verified.

Root personally executed Review, then Prepare on:

- Existing PostgreSQL16.15 cluster127.0.0.1:55503,
  D:/Yellow/temp/order434-production-cluster-20260906.
- Verified idle template yellow_order434_production:0 tenants,127 base tables,
  exact77 migration checksums,18,332,695 bytes; D: free23,444,439,040 bytes.
- One absent target yellow_order472_compset_20260913, owner yellow_deploy.
  Canonical runner applied only78–92; it did not replay1–77 or alter cluster roles.
- Full local1–92 catalogue SHA256:
  05b6867d289cae0da24d4453e85330f895b133d9194c4d5e9f40e115731d99fc.
  Suffix78–92 SHA256:
  3fab742d9a277fa223e291b845abe17c7095aec0a34ae9e2d52f82a04ff4d2f6.
- Before/after public role-attribute/membership fingerprint identical:
  ea31e02a42852007fac9862fa63ee3d9acee5d4598eb176dec11497bd925f8af.
  Outside-target database catalogue fingerprint identical:
  19c8de423952be6712dc47c6d576571c22280870e5944e6cece1c9d582ee9abd.
  These are defined catalogue checks, not bytewise fingerprints of all databases
  or a claim to have compared private role passwords.

No DROP/TRUNCATE, new cluster, application seed, live user permission assignment,
hotel record, listener, Docker/WSL or running application was changed. Test cohorts
use random IDs and are retained; after the two executions the target contains44
synthetic tenants and occupies19,438,615 bytes. It is not a second application.

### Root personally executed commands and results

Only dedicated exact-target Order472 URLs were supplied, with
YELLOW_REQUIRE_MARKET_COMPSET_INTEGRATION=1. Native catalog cases additionally
used YELLOW_NATIVE_MARKET_PROOF=1.

```text
bun scripts/native/prepare-market-compset-proof.ts   (ACTION=Review)
exit0; targetCreated:false
bun scripts/native/prepare-market-compset-proof.ts   (ACTION=Prepare)
exit0; targetCreated:true; exact suffix78–92; fingerprints unchanged

bun test tests/market-compset.integration.test.ts tests/market-api.integration.test.ts
11 pass;0 fail;78 assertions;2.78s

bun test tests/market-regional-artifact-loader.test.ts tests/native-market-regional-artifact.test.ts tests/market-regional-admission.test.ts tests/market-regional-artifact.test.ts tests/market-discovery.test.ts tests/market-shopping.test.ts tests/market-batches.test.ts tests/market-source-adapters.test.ts tests/market-compset.test.ts tests/market-api.test.ts tests/native-market-compset-proof.test.ts tests/market-compset.integration.test.ts tests/market-api.integration.test.ts
113 pass;0 fail;838 assertions;13 files;51.83s

bun run typecheck
exit0
bun scripts/check-import-boundaries.ts
202 TypeScript files;zero violations
git diff --check
exit0
```

The real DB cases verify non-superuser/non-BYPASSRLS runtime authority, narrow
function ACL/owner/search_path, two-tenant and property isolation, disabled actors,
read/write grants, immutable replacement/clear, old receipt replay, concurrent
same/different keys, expired/changed-actor idempotency, late real outbox write
rollback despite the caller committing, blocking permission/actor withdrawal
while locks are held, revoked/disabled-tenant replay, and persisted corruption
rejection. HTTP tests use actual tenant transaction middleware/service, with a
synthetic identity resolver rather than a claim about production login wiring.

Root captured actual schema-only output with pinned native pg_dump16.15
(SHA2561AC52B046946F1388101C0BFAEAF519BFAE1AD1966A07E73C1F4BBA690FC75B2),
using --schema-only --no-owner --no-comments. The existing normalizer removed only
the paired dump wrappers. Comparison found exactly two new schema blocks (function
and its ACL), no changed or removed previous blocks. Root applied only those actual
blocks to tests/schema/expected.sql; its complete SHA256 matches the captured output.
No Docker schema CLI or handwritten schema substitute was used.

### Frozen source

| File | SHA256 |
|---|---|
| src/contexts/distribution/market-compset.ts | 066DDB6C0074B577F501D7239446A4FA9C6F4703A2C4D41CB43125ECE007B277 |
| src/contexts/distribution/index.ts | 9B1A27AED6D8B0C92F3351C9A7002772487BEDE61B1FE6647331044562874298 |
| migrations/0092_market_compset_authority.sql | FC20C295C130010BDDCD1E71388261A23CB1B3E5AA85BEA27B4492A1074028AC |
| src/http/market.ts | 742376E4D99E6B35CD5AD90C9D4C3C241245BAE28C35AE0BA29F273E357C542B |
| src/http/extensions.ts | 20F8A8F3140F27875AE98408D548ACB629403166EC734BC8FA6A529F85B8DD0D |
| src/app.ts | 2EBA5ED2841F7D1B8673D1DA062B0B9168CC93A27A55C4A0847D871BCE570158 |
| scripts/seed.ts | 9CD9412D346EBFFC9E99189767B7974CA42FED189D430239AC1C192B85EBC6AE |
| tests/market-compset.test.ts | 4FF2E44A7C96A5C0EA5F4A667591D548965E0F16C11B21329B958FE2DB1ED10F |
| tests/market-compset.integration.test.ts | D0AC270D0C00DAB1A9F6B649C8B11614DE5883492896089A63BBD0FF2769EAF1 |
| tests/market-api.test.ts | 7D65F01766B05021C5DABABC89328AF969B590A5A11775D11FBB1B919736BE37 |
| tests/market-api.integration.test.ts | 22ED8CE02654907EEC2047AF6D8151D28E26AA3CC6A62781C0342919733A0121 |
| tests/helpers/market-compset-fixture.ts | 8B880A4BB9ED887F09D28B9E4B73806AD63A0C41E5C568F3C429C692D60F3D20 |
| tests/native-market-compset-proof.test.ts | 6212E8D834A3B079C09F2AA88B80DE1E2C496BEDF85A45142A6994907CDF7934 |
| scripts/native/prepare-market-compset-proof.ts | 16A9B27E4D84071159C6AE44CC8C84554834E3C6EA6AA8D19D73D33958808BC1 |
| tests/schema/expected.sql | 1D9F2294F2E60FF816EC1A34AE35D01DEC269CEEC29D350D102246D7BE6048E8 |

This accepts the bounded backend source, not Order472 completion. The113-test
aggregate is not the full repository suite, canonical11-invariant referee, CI or
live release. Startup composition/build frontier/readiness, operator map/table,
property identity suggestions and planner wiring remain. No automatic real-user
permission grant or full canonical seed was executed. Fresh GET /ready still
reports the sole app41415/frontier91. Published633, its unresolved CI failures,
all18 phases, frozen471 and Q253 remain unchanged.

## Q266 startup and operator workspace — D1490, independently accepted source

13 September 2026. Runtime author: /root/astra_ultra_handoff (GPT-6 Astra Ultra).
Static shell author: /root/q258_runtime_cutover. Workspace author:
 /root/q258_source_adapter. Root did not implement these production changes and
personally inspected and executed the final proof. Root authored the browser
proof; q258_runtime_cutover independently inspected the other worker's workspace
and ran its focused checks, not its own static-route changes.

The explicit YELLOW_MARKET_WORKBENCH=1 flag requires the normal operator mode.
The accepted native catalog loads once before providers, pools, workers or the
listener. Disabled does no artifact read and mounts no market API; enabled
missing/invalid/partial catalog fails with static text. The existing registry,
events, idempotency and tenant transaction are reused. Source frontier advances
91→92. The separate runtime readiness extension checks exact0092 function body,
owner, definer/search_path/ACL and canonical schema/permissions without granting
or repairing authority. Existing kernel readiness is unchanged.

The lazy /p/:property/market workspace uses the existing Rates & inventory group
and theme. It provides regional source-point plot, filter,25-row pagination,
explicit own-record and comparator choices, visible source/coverage/provenance,
a selected-evidence review and explicit confirmation. No external viewer/network
dependency, auto-selected identity, price collection or publication is added.
The existing availability-scoped property picker is not silently broadened;
market-only property discovery remains required in the next integration tranche.

### Genuine failures retained and repaired

- Initial source inspection caught null initial record comparison, confirmation
  surviving changed selections, partial/ambiguous catalog acceptance, whole-world
  projection hiding regional points, missing heading associations and reload gates.
  Implementer repaired these with bounded parsing and current-selection review.
- Independent review caught duplicate snapshot/record identities and failed
  paired-refresh retaining actionable old state. Root's real browser first failed
  because403 left Refresh disabled; the settled-error recovery was repaired.
- The first native readiness run passed the real-runtime positive case, then
  three hostile tests timed out at their unchanged20second bounds and teardown
  timed out at5seconds. Root stopped only the observed owned test PID16192.
  A single opt-in static-stage diagnostic stopped at probe-and-assertion:start.
  PostgreSQL had completed the SELECT: idle-in-transaction/ClientRead, no blockers.
  That diagnostic also timed out; root stopped only its owned PID13972.
  No backend was forcibly terminated and no fixture data was dropped.
- The runtime author replaced only the in-transaction asynchronous test matcher
  with direct awaited try/catch and synchronous exact Error/message assertions.
  Same target, mutation, rollback, fingerprint, runtime recheck and deadlines.
  Root reran the selected four-variation case:1pass/0fail/16 assertions in240ms.
  This identifies a test-client settlement problem here, not a production
  database-lock failure. Static tracing remains opt-in and emits no secrets.
- Root's new browser test initially needed explicit evaluation result types.
  Its40-row size-limit fixture also exceeded its own regional bbox; coordinates
  were corrected inside that bbox, not by weakening the production parser.

### Actual independent final proof

Dedicated three-role URLs were read privately through the retained Q265 wrapper;
no secret values were output or written. Explicit native/integration opt-ins:
YELLOW_REQUIRE_MARKET_COMPSET_INTEGRATION=1 and YELLOW_NATIVE_MARKET_PROOF=1.

```text
bun test tests/market-regional-artifact-loader.test.ts tests/native-market-regional-artifact.test.ts tests/market-regional-admission.test.ts tests/market-regional-artifact.test.ts tests/market-discovery.test.ts tests/market-shopping.test.ts tests/market-batches.test.ts tests/market-source-adapters.test.ts tests/market-compset.test.ts tests/market-api.test.ts tests/native-market-compset-proof.test.ts tests/market-compset.integration.test.ts tests/market-api.integration.test.ts tests/build-readiness.test.ts tests/server-market-runtime.test.ts tests/market-runtime-readiness.integration.test.ts tests/operator-market-assets.test.ts tests/operator-market.test.ts tests/operator-market.browser.test.ts
136 pass;0 fail;1311 assertions;19 files;56.05s
bun run typecheck
exit0
bun scripts/check-import-boundaries.ts
202 TypeScript files;zero violations
git diff --check
exit0
```

This aggregate includes15 actual PostgreSQL cases (the previous11 service/API
cases plus4 runtime-readiness cases) and9 actual native filesystem cases.
The four readiness cases include11 hostile variations with rollback and exact
post-rollback metadata fingerprint/real-runtime positive checks. They are not
the canonical11-invariant referee or full repository release gates.

The browser proof executes actual shell/scripts/lazy asset in owned Chromium and
a temporary loopback server with synthetic HTTP responses, never port3000.
Its38 assertions cover signed-out lazy loading, actual market deep-link/login,
pagination, readable source dates/unknown status, inert hostile names, regional
point spread, changed-selection review reset, identical key/body after ambiguous
503,409 fresh confirmation,403 clearing/recovery, delayed old-property isolation,
400 and failed-refresh reload gates, multibyte16KiB request blocking before POST,
375px containment/reduced-motion mode, and sign-out clearing. It does not prove
production credentials, native hardware performance or live database-to-browser
delivery. UI/UX Pro Max informed accessibility/loading/review checks only; no
new skin or claim of founder visual approval.

The retained native target is yellow_order472_compset_20260913, frontier92,
66 synthetic tenants and19,766,295 bytes after the final suite; no other target
sessions remained. All hostile mutations rolled back. No new database/cluster,
hotel import, global-role change or persistent authority repair occurred.

### Frozen source

| File | SHA256 |
|---|---|
| src/server.ts | 1443DFAE9D5DEE17B6846E6A7B34A24067D50BE9E37F3068EAC207E8D6962135 |
| src/runtime/market-workbench.ts | 658F0E7CD5D1E4502F826668EE0E50FF2C34EE496F76C6990CC764E895FA7FB2 |
| src/kernel/build-info.ts | 3B7D2B788FC31F16DE4495278A11ECC7FCD95BC98C0DBC8611E17F1FCE8E3C13 |
| tests/build-readiness.test.ts | AFDF59EB83B8B7C0A3DF7FF9F0826244C6491E0E8862F4DF5514F84B12BC4DEF |
| tests/server-market-runtime.test.ts | ED0C0D3D5D4DD8B1FA130F864CDAF624DBBE334E1FE108D87A4C6C7CA73887BD |
| tests/market-runtime-readiness.integration.test.ts | 0E14D896B3557DD989C065CBBB2164E97D3E8F4AC51FAD3575E51E28F0B67BC2 |
| src/app.ts | A99E5A5F4BDC0B51EC2455B1F76B2E169B169DEC775182F86CB33FFA15B015A7 |
| src/http/operator.ts | 3ED89D56BE450D8F92D9284E8ADBEE5D0CB19694ED345404031624F76190C46F |
| tests/operator-market-assets.test.ts | 3942500EB8DC2605B7C899FCF99430BBD61AF36FBC598240C006BCC587C9FE29 |
| src/http/operator/index.html | 0221865939A548DBAAE7BD7275D74C9BF2B7D84812FA90EB40BFAB5278328654 |
| src/http/operator/operator.js | 16C3FB2285CF104C4C977F3CADE3882AB41E39518E5358D383DA0B5CF516A1DF |
| src/http/operator/market.js | 9F3E607DC9F3650B32988A54973FFB89DF2C7D78923B7189765D91A2C3406D7C |
| src/http/operator/operator.css | B6F20CD5D816EE0A51AB74BB1F7E0D58EA819571D43616471C9DB023203C1894 |
| tests/operator-market.test.ts | 222CA4156BBFD690AA521BD9D14424995E8B0DA00F929B64D70831143F419BCE |
| tests/operator-market.browser.test.ts | 2492B2DB8936C2AE098E5E6AF243208392BAF3032B93AC4B940760CCF255C643 |

Accepted only as this source tranche. URL/ID identity-suggestion integration,
market-only property discovery, planner linkage and exact-source publication/
release remain required. No phase closed. Frozen471 and all18 phases remain.
Fresh GET /ready still reports41415cc5c6953f71d9b3baada6fd9c7853567128/frontier91
on the sole3000 app. Published633 CI failures are not resolved by these local
proofs. Nothing in468–472 was newly published or delivered to that runtime.

Additional metadata compatibility check after the status edits:
`bun test tests/project-status.test.ts tests/current-source-status.test.ts`
returned8pass/4platform-skips/0fail/217 assertions in20.05s; diff whitespace check
passed. This suite invokes the Windows state reporter and bounded optional-probe
fixtures. It was broader than the native-only Q266 proof selection and should not
be repeated for this tranche; use direct metadata/source checks instead. It is
not evidence of Docker/WSL runtime readiness or authorization to start either.

## Q267 identity and saved-plan bridge — implementation and independent proof

Admission: `handoff/questions/267-order472-identity-and-planner-bridge.md`,
including the recorded bounded pagination-fixture amendment before fixture edits.
Astra Ultra authored the domain and native test additions; q258_runtime_cutover
authored HTTP composition/tests; q258_source_adapter authored UI changes.
Root did not implement these production changes and personally executed the
actual PostgreSQL and Chromium proofs. Root owns the synthetic browser proof.

Initial native execution on the sole retained Q265 target passed 13 service tests
with 140 assertions and 3 HTTP tests with 35 assertions. These include actual
50+3 property keyset pages, tenant/role confinement, current-grant locks, exact
saved-version locking, historical evidence without the current catalog, property
timezone/currency/server time, and zero durable preview effects. Existing schema,
permissions, roles and runtime were not replaced; fixture cohorts are fresh UUIDs
inside the same guarded target. This is not the canonical 11-invariant referee.

Real browser execution exposed genuine integration failures despite passing
author unit checks: mismatched effective-property capture after lazy import;
stale identity requests leaving Suggest disabled; missing market choices for
operational users; delayed previews surviving refresh; and the routed-property
variant of the import guard. Inspection additionally found new identity/property
controls able to interfere with an uncertain confirmation and permission-error
paths retaining private evidence. These are acceptance defects, not waived tests.
The two other workers supplied bounded read-only lifecycle findings while the UI
author repaired its own files. No unrelated/full-application review was started.

Root upgraded the old browser fixture from a version-only reply to full exact
saved evidence, with separate per-property versions and a realistic confirmation
receipt. Q267 deliberately refreshes the current saved set after receipt
acknowledgment. Accordingly the old assertion for a transient `confirmed` state
now awaits visible saved version plus `ready`, then explicitly selects a new draft
before a further confirmation. Original same-body/key/exactly-one-effect,
revocation, conflict, UTF-8 bound, mobile containment and logout assertions remain.
New tests cover market-only login, pagination, original historical capture dates,
manual suggestions/draft application, explicit saved comparator indexes and child
ages, invalid token rejection, 201-comparator rejection without truncation,
changed-condition/refresh staleness, and deep links beyond the first property page.
No test/browser process connects to port 3000; owned temporary browser profiles
are bounded, validated and removed after their own processes exit.

Final aggregate acceptance and frozen identities are recorded below only after
all relevant checks finish; this intermediate record does not claim completion.

### Final Q267 source acceptance — D1491

On13 September2026 nonimplementing root personally executed the final frozen
source using Bun1.3.14, the guarded Q265 private environment wrapper, the same
retained synthetic target and explicit YELLOW_NATIVE_MARKET_PROOF=1:

```text
bun test tests/market-regional-artifact-loader.test.ts tests/native-market-regional-artifact.test.ts tests/market-regional-admission.test.ts tests/market-regional-artifact.test.ts tests/market-discovery.test.ts tests/market-shopping.test.ts tests/market-batches.test.ts tests/market-source-adapters.test.ts tests/market-compset.test.ts tests/market-api.test.ts tests/native-market-compset-proof.test.ts tests/market-compset.integration.test.ts tests/market-api.integration.test.ts tests/build-readiness.test.ts tests/server-market-runtime.test.ts tests/market-runtime-readiness.integration.test.ts tests/operator-market-assets.test.ts tests/operator-market.test.ts tests/operator-market.browser.test.ts
153 pass; 0 fail; 1641 expect() calls; 19 files; 61.41s.
bun run typecheck
exit0
bun run boundaries
Import boundaries OK:202 TypeScript files scanned
git diff --check
exit0
```

The aggregate includes20 actual PostgreSQL cases (13 domain,3 HTTP,4 readiness),
9 actual native filesystem cases and2 actual Chromium journeys/82 assertions
against synthetic HTTP. All opt-in suites above executed; none was reported as
a successful skip. The separate final browser run was2pass/0fail/82 in5.41s.
These counts are not the canonical11-invariant referee, whole-repository CI,
live browser/database delivery, a production latency benchmark or phase closure.

Additional real browser defects repaired before this final run: a property-A
callback becoming permanently inactive after selectingB, cachedA outranking the
browser's B route, reused-workspace callbacks bound to obsolete load generations,
and permission-loss paths leaving independent in-flight requests or saved evidence.
The final proof includes repeated Market opens, delayed A→B results, back/forward
navigation, exact uncertain retries with new controls frozen, historical saved
records, condition/refresh invalidation,201-comparator refusal and a direct route
to a property beyond page50. No assertions or deadlines were removed to pass.

Production hashes below match the authors' frozen source. Root-owned browser
proof is identified separately by its path. Existing unrelated guest-picker edits
in operator.js are preserved, not newly accepted as part of Q267.

| File | SHA256 |
|---|---|
| src/contexts/distribution/market-compset.ts | 3EC5AFEFB51A901CB62CC6CF7B7B5CB7D86A9AB7D11EEB7753C24012C028F2AE |
| src/contexts/distribution/index.ts | 28DA68EE9674BF3E1E66FEAAA0B39B4FAEACED68B0725B5A389EFB6B88E13768 |
| tests/market-compset.test.ts | 587D4B1EC4C5515F77D10F48323188DB7455743F493EB6169E18BAFBBA0F202E |
| tests/market-compset.integration.test.ts | E43E938345AD372E1D7CD50684794D3A6A7C2333A29E04936BDA105C20B206DD |
| tests/helpers/market-compset-fixture.ts | B55BB10BB25C2439000E65CC82860C57B8AB77D7953B423CCA7B2F562340D6A2 |
| src/http/market.ts | CE36FB9DD96B208AEFEB15D7F61FC5BA7D6F66A190D3D299681ED9938CF0E172 |
| src/app.ts | D3A499372B84CC19194F016DBF7ED1D2BE66AD96CBF6640E389882964604A78D |
| tests/market-api.test.ts | 68D2D2A4EFB053AA6D182E03799B91E58759BDC987B0B9B32E1647F51E6B8940 |
| tests/market-api.integration.test.ts | 37CF463662841884701EC200117BBE96ED63C81FD518E1B63A750DD9E521FEC1 |
| src/http/operator/operator.js | 56E52FF8680A751D4ADFBE3F267DCBA6D989B450C3561A0CA13D070AD7285687 |
| src/http/operator/market.js | 4E9F4298C1788B63D2F985995003E234C26A09F1C66ACD5EEC88ED3BB755B65D |
| src/http/operator/operator.css | 5AF26B0F1BD2B3DD040C8568E241E8655F2E0DAB30137C3E870788D4960C6E80 |
| tests/operator-market.test.ts | DFE9581937D168D87ABB13E9113CB7329736427A45F53F1CB98113118F9E5A36 |
| tests/operator-market.browser.test.ts | 352583F1088AF2F12AE3DC56D9852D65A2D4B1F3B98F2F9FDBEC3D5400B86517 |

Migration0092 remainsFC20C295C130010BDDCD1E71388261A23CB1B3E5AA85BEA27B4492A1074028AC.
Frozen471 invoices.js remainsEEFC4548F9EDE2EEE20AEF0BC7C3BD8331547C210A6849CB1E67DD956487BCBF;
its provider-request unit test remains882800A3A01E7BD8D4242C601291F210872573399CC497B9E8EA1B6AF02E8845.
No new database, cluster, runtime cutover, provider activation, global role or
real-hotel import was performed. The existing synthetic fixture creates only its
own bounded fresh tenant cohorts. Private authority values are not in this record.

Source accepted for Q267, Order472 still active. The current UI presents preview
counts; rendering its full bounded sample/window detail and the requested real2D
map/selectable attributes remains integration work. Preview is deliberately
non-executable and does not authorize rate collection. Publication/release gates
remain separate: fresh GET http://127.0.0.1:3000/ready still reports
41415cc5c6953f71d9b3baada6fd9c7853567128/frontier91. Published633CI remains red.
All18 phases, frozen471, paused445 and dependency-gated11→13→17 remain preserved.
No founder action is required for the next source-only work.

## Q268 map/table/planner detail — root-executed source acceptance, 13 September 2026

Scope was admitted before code in Q268 and Order472. Astra Ultra authored the
frame and its tests; q258_runtime_cutover authored fixed asset routes and header
composition; q258_source_adapter authored parent/attributes/planner details.
Root did not implement those product changes and personally executed the integrated
proof below. Root authored the browser proof/shared harness and vendored the
unmodified publisher-hashed assets. There were no domain/schema/DB changes.

Final related command (native Windows, active checkout, Bun1.3.14):

```powershell
& 'C:\Users\astha\.bun\bin\bun.exe' test tests/operator-market.browser.test.ts tests/operator-market-map.browser.test.ts tests/operator-market.test.ts tests/operator-market-map.test.ts tests/operator-market-assets.test.ts tests/security-headers.test.ts tests/build-readiness.test.ts tests/market-discovery.test.ts tests/market-regional-artifact.test.ts tests/market-regional-admission.test.ts tests/market-compset.test.ts tests/market-api.test.ts tests/market-source-batch.test.ts tests/market-source-adapters.test.ts tests/market-shopping.test.ts tests/market-batches.test.ts tests/server-market-runtime.test.ts tests/market-regional-artifact-loader.test.ts tests/native-market-regional-artifact.test.ts
```

Actual result: **139 pass,20 skip,0 fail,1777 assertions,19 selected files,10.33s**.
The20 skips are9 environment-gated source-batch cases plus9 native-file cases
and2 hooks without opt-in native authority. They are NOT passes or new native/DB
proof. The17 executing files cover this source/UI/static-security tranche;
Q267's prior20 actual PostgreSQL and9 native cases remain historical, not rerun
here. No full canonical invariant referee, CI or whole-release acceptance claim.
Root also personally ran strict tsc,202 import boundaries and git diff --check.

The three actual browser journeys use real operator assets and synthetic HTTP:
old selection/retry/conflict/permission/property flows, full server planner detail
with stale/malformed response handling, and real local Leaflet1.9.4 in its actual
CSP frame. The new map journey separately passed1/0/69 assertions. Every external
request was intercepted BEFORE navigation; tiles were synthetic PNGs, never
requests to OSM. Before activation there were zero map-asset/tile requests.
Checks cover exact local assets, unchanged parent/narrow frame CSP and XFO,
origin-only tile referrer/no Authorization, linked attribution, safe marker text,
opaque-only messages, wrong origin/source/nonce/revision rejection, keyboard and
click inspection without selection, selectable table facts and inspector links,
role revisions, empty-map cleanup,375px parent/frame containment,500 records with
499 plotted plus explicit1 polar omission, synchronous bounded keyboard panning,
reduced-motion zoom, offline fallback, pagehide cleanup, property/refresh/grant
invalidation, unknown-confirmation freeze and sign-out teardown. The injected
unknown confirmation uses only the synthetic handler, not a real business record.

Genuine failures and repairs retained:
- Pre-opt-in privacy disclosure was overwritten by initial refresh: fixed by a
  persistent disclosure independent of dynamic status.
- Browser inspection threw because parser validation dropped website/category
  arrays, then remained empty because the fact list was not attached: authors
  repaired retention/frozen copies and DOM attachment; actual browser re-executed.
- Disable map stayed disabled until unrelated rerender: immediate shared control
  synchronization now covers activation/destroy/clear and unknown-state freeze.
- Leaflet keyboard panBy defaults to animation despite zoom/fade flags. Astra
  added owned canvas keyboard handling with public non-animated panTo/setView,
  bounded before movement and removed during teardown. Actual immediate marker
  movement and repeated-pan clamp now pass.
- Root's first shared-harness extraction used an inner command-id anchor and
  broke test syntax; fixed from the saved pre-extraction source, no product change
  or removed test. Root test corrections used the real details/coverage/inspector
  nodes, avoided serializing Window, measured actual marker position rather than
  a reset map-pane transform, and cleared only the disposable browser's synthetic
  cache before deliberate offline simulation. No timeout/guard/assertion waiver.

Frozen source/test SHA256 after final aggregate:

| File | SHA256 |
|---|---|
| src/http/market-map.ts | 4177040569808402730781A3C72B6FABC97C14A61D13E9E963B6376647731E5B |
| src/app.ts | DF1306729008F4B37C6CC14A7FD23F647105D86A1BD2B4F5FDAAEA4183F2053E |
| src/http/operator/market-map.html | A62BC4D99DE897B27A9A897E7FE4D5771F84889D0AFDA3964D8991C3D8F3D1D7 |
| src/http/operator/market-map.js | ACE04286071DC6385233D325B17721BF3C14D68DC684C4714B4EB34C258BCB06 |
| src/http/operator/market-map.css | 2115C19B9108A56B8803D988EC6B2D4DFA56D45BE2D52F424521F28F1C32D2CE |
| src/http/operator/market.js | 4BB9BB5305FD4EE6F663350D344B345DB155E872C88D9772587AC835064D7463 |
| src/http/operator/operator.css | 8CF906D3435B0FB8556ECCAB5273C21D69B95644BFC414FB10F1F936E5CD9FBD |
| tests/helpers/market-browser.ts | DCE69BB0F5CE3D3AFDDE3FF2899C351DBFC9E20BDBACCA4F327FCD22D77AAF71 |
| tests/operator-market.browser.test.ts | 2E29CD5F6477C2766502F1BFF1AD168B57C4DE662DF4956091E524B5E223D64E |
| tests/operator-market-map.browser.test.ts | EE852EB147F77EB63FFA5C16BDF2084AE88C45300BDE17294DEA9578F18BFE47 |
| tests/operator-market-map.test.ts | 5E965C84183D60E06132F4D5875BD84C4BB611859562D5AA7B4213071017EBBF |
| tests/operator-market-assets.test.ts | 5A0503FB44D2787559751BF05635F188B61D832247C04E850E5C28FEC96C9E6B |
| tests/operator-market.test.ts | 92BF7F65A8D114A8FAC8115C7B8DD07A22693F407D0FC7EE05930FF855617770 |
| src/http/operator/vendor/leaflet-1.9.4/leaflet.js | DB49D009C841F5CA34A888C96511AE936FD9F5533E90D8B2C4D57596F4E5641A |
| src/http/operator/vendor/leaflet-1.9.4/leaflet.css | A7837102824184820DFA198D1EBCD109FF6D0FF9A2672A074B9A1B4D147D04C6 |
| src/http/operator/vendor/leaflet-1.9.4/LICENSE | 53E8DC25862014E4324741CA18FBE3611E11D42EF69F59F86EA8C5389647D4CB |

Source acceptance only. No Git index/commit/push/merge, new worktree, runtime
restart/cutover, provider activation, hotel data or model installation. Fresh
GET /ready still reports sole3000 revision41415cc5c6953f71d9b3baada6fd9c7853567128,
frontier91; source is92. Head63338ed312f925bddd951665189196e3615a51b9 is unchanged;
previously recorded CI failures have not been resolved by this checkpoint.
Frozen471/paused445 and all18 phases remain. Next: exact-source release gates,
then preserved fiscal completion and dependency-gated11→13→17.
