# Order454 — Read existing fiscal numbering configuration

**Status: functional integration admitted, 2026-09-08.** Root published verified
Order453 treef587df27 as87da26f354d08b545bc6b9127031cc29b38881ef to existing
draftPR92, preserving all2118 earlier tracked files and outside index semantics.
Exact-headCI34244482395 is running, not yet approved. This migration-free read
journey may now integrate in the existing worktree. No UI/UX work.

## Outcome and existing authority

An authorized operator can discover the existing current-year fiscal series for
an exact property, supplier registration and document kind without guessing its
prefix or invoking the configuration write API. Q187/D1302 clauses2,3,7 and
D1440 already govern these identities, property-local FY and actor authority.

Baseline0001 grants app_role SELECT on document_series and authority tables;
0016 removes writes,0073 removes raw counter UPDATE,0047/0055 retain SELECT on
supplier registration/status. Reuse those existing grants and tenant RLS. Do not
add0091, a SECURITY DEFINER capability, permission, table, dependency or provider.

## Read contract

Input is exactly tenantId, propertyNode, supplierRegistrationId, documentKind and
actorId. Snapshot plain own-data fields before asynchronous work; reject extra
keys, getters and proxies. Accept only supported native invoice/credit_note/
debit_note kinds and canonical UUIDs. No prefix, FY, date, counter or series ID
from the caller.

One parameterized tenant-Tx SQL query returns one mandatory authority row before
interpreting absence: direct yellow_runtime session, current user/role app_role,
exact transaction-local tenant context, active tenant/actor, tenant-coherent role
membership, series:configure permission and same-tenant ancestor property scope.
Do not use listGrantedProperties alone or expose the private0087 assertion.
Gate all supplier/series output on current authority. Derive the current date/FY
using the property's recorded timezone; resolve the same dated active supplier
evidence as configuration. Use the exact existing series scope index.

Return a frozen nullable series containing only the existing eight identity/
kind/prefix/FY/nextNo fields. Counter is a lossless positive int64 string, never
allocated or reserved by a read. Validate exact bound selectors, actual April1
FY, allowed prefix and every scalar. False authority is a typed authorization
error before absence; it must return no protected columns. This SQL-derived
denial is not falsely described as an owner capability raising42501. Missing
configured series is null; invalid supplier/current status is fail-closed and
must remain distinguishable from a successful configured-series result.

No locks, DML, events, numbering, configuration replay or idempotency claim.
No debit-note valuation or provider activation is implied.

## Source-only scope now

- src/contexts/tax-fiscal/india-native-fiscal-series-discovery.ts
- tests/india-native-fiscal-series-discovery.test.ts
- this order
- private preparation notes under .yellow/evidence/order454

The worker implements only the new service and pure tests. Intentional red
precedes implementation. No existing source/test/fixture edits, context export,
command/API, database execution, migration or candidate publication yet. Root
will explicitly enumerate later integration/native proof scope after453 is frozen
and safely published. Never include these preparations in453's42-path candidate.

## Required later acceptance

### Additional new-file-only test preparation admitted

While453 source remains frozen and its release checks run, root admits one more
new file: tests/india-native-fiscal-series-discovery.integration.test.ts. Prepare
actual PostgreSQL cases using the existing reviewed453 fixture through its public
test exports, without changing that fixture or any other existing file. Do not
execute the tests or create/mutate any database yet. All actual targets and cohort
limits will be admitted separately after453's protected release proof. This is
preparation only; do not include454 files in453's selective release candidate.

Independent actual PostgreSQL and signed API tests must cover configured and
absent series, custom prefix, advanced counter, separate property/kind/prior FY,
inactive/revoked/coherent-role denials even when no series exists, unavailable
supplier evidence, exact scalar decoding and complete zero-write preservation.
Inspect the actual query plan; a bounded result is not a claim of bounded scan.
Later GET uses signed tenant/actor, current property grant and no-store responses.
No whole-phase completion is implied by this source-only preparation.

## Post453 command/API integration scope

The earlier new-file-only limit is superseded ONLY for this explicit scope:

- src/commands/read-india-native-fiscal-series.ts
- src/contexts/tax-fiscal/index.ts (public discovery exports only)
- src/http/operator.ts and src/app.ts (one GET journey only; preserve all existing
  backend and paused UI hunks)
- tests/india-native-fiscal-series-discovery-command.test.ts
- tests/operator-native-fiscal-series-discovery.integration.test.ts
- docs/CONTRACTS.md, docs/PROJECT-STATUS.md, DECISIONS.log, handoff/LEDGER.md
- handoff/reviews/454-native-fiscal-series-discovery.md

GET /api/v1/properties/:property/fiscal-series accepts exactly one occurrence
each of supplierRegistrationId and documentKind in the query, no extra identity,
counter, prefix, fiscal-year/date or selector overrides. Signed session and
current property grant must include tax-fiscal.series:configure; the service
independently enforces its complete current authority. Successful authorized
discovery returns200 {series: eight-field-result-or-null}, no-store. Invalid
selectors400, missing/revoked authority403, unavailable/corrupt evidence503;
sanitize errors through existing mappings. Never call configuration or issuance
on GET, allocate a counter, add an event or claim idempotent mutation.

Prepare command/API tests with explicit intentional red then implementation and
green focused proof. Actual native tests, target activation and API-to-database
proof require separately reviewed root admission. Existing454 PostgreSQL test
remains disabled until root changes only its exact ADMITTED_TARGET line after
all production source stops changing. Private helper preparation is admitted;
no database execution, server, provider, main merge or live promotion here.

## Root native acceptance admission — 2026-09-08

Root independently inspected the frozen service, command, route and tests and
executed focused13/0 (276 assertions). The next native target is ONLY the existing
yellow_order453_referee90_20260908 on127.0.0.1:55503, reached with protected
yellow_deploy/yellow_runtime credentials. Its1,264 existing rows and all eight
companion databases, catalogue, global roles and live host identities must remain
unchanged except for explicitly owned fixture additions in this target.

Admit the exact ADMITTED_TARGET replacement in the existing native integration
test, then filesystem Review and read-only Preflight using the separately read
private native-run.ps1/native-proof.ts. The externally pinned root admission must
bind those fresh receipts before one native suite execution. Footprint: exactly
two synthetic discovery454/foreign454 cohorts and six fully owned transaction
codes; five configured series plus one unused prior-year series, one real fixture
invoice and its legitimate counter advancement. Temporary authority/timezone
challenges affect only these new cohorts and must restore exactly. No migration,
seed, clone, extra database, cleanup, provider, live app or automatic retry.

The command/API worker may prepare additional native signed-request cases ONLY
inside tests/operator-native-fiscal-series-discovery.integration.test.ts. These
must reuse the exact two454 cohorts produced by the native SQL proof, perform
read-only API requests and preserve the database. No execution is admitted yet;
root will separately inspect the cases and bind the successful SQL receipt first.

## Retained failed-run audit and read-only diagnosis — 2026-09-08

The initial native suite remains RED (combined seven-input test timeout and
close-hook timeout). Do not rerun fixture creation or erase that evidence.
Root admits only the following separately inspected private successors on the
same retained target and two existing cohorts, with no DDL/DML/cleanup:

1. Execute `postaudit-run.ps1` SHA256
   `3c19ae99fd715123bd84b7c0294207d027b00a6d7920d4ed6d4a337d86a9d2d9`
   with `postaudit-proof.ts` SHA256
   `10f6eba822220c283a72ed559a66979bb8104ef65a553bfed657b615e85f8738`.
   Preserve all original pins and RED test outcome. The sole ownership-query
   oracle repair orders by the qualified numeric outbox sequence, not its text
   alias. This can prove containment, never make the original native test green.
2. Run `diagnose-timeout.ps1` SHA256
   `f7dbe5722753b007bbd0122b0c8534b5c3dc51da3cca4c83b92075875377b6d0`
   with `diagnose-timeout.ts` SHA256
   `50f55761a9b8362e9e72b6d0acfc6a3cff1616d0395a6e32bfa28dccdd7ad41d`.
   First Fresh/wrong-property; only if it completes, Shared/all seven retained
   inputs. It uses the real tenant transaction wrapper, unchanged service and
   before/after row/catalogue/sequence fingerprints. Diagnostic transaction-local
   statement/lock timeouts are 5s/1s; each child retains the 120s outer pump bound.
   Record stages, returned error classes, snapshot equality and pool close.
   This diagnostic is not a replacement for the original native test assertions.

No successful SQL receipt is manufactured; signed-HTTP execution and any test or
production repair remain separately admitted. Credentials stay private and no
Docker/WSL/status probe, server or live app operation is permitted.

## Retained assertion reproduction admission — 2026-09-09 local

Root read the complete prepared runner and test plus the exact imported private
credential/ACL/process-pump functions. Independent `receipt_oracle_acceptance`
inspected the same files without execution. Admit one read-only run, with no
fixture import or creation, on the already retained two cohorts in ONLY
`yellow_order453_referee90_20260908` at `127.0.0.1:55503`.

Runner SHA256 `107c13a472a8337933901fb661a9d58425d6b8e28c8ba186596a9f9ae0febfcb`;
test SHA256 `8d30939abb78f8c681b584e93cbdcd8c822864c6c54aaceeea8e0dcb8d3e46a6`.
The test retains the original seven sequential promise-rejection assertions,
120-second test limit, shared runtime pool, and per-case complete public-row,
catalogue and sequence equality. Only the bounded outer process pump allows
180 seconds to retain the original timeout and close-hook output. There is no
statement/lock timeout override, manual catch replacement or retry. The absent
supplier uses a fixed absent UUID, not the original uncaptured random UUID.
Fresh pools do not reproduce the preceding original suite's pool history.

Root also freezes and checks these source/runtime pins before and after the run:

- discovery service: `e6c8f08a3c981f2ae9a8f300a0837b29143d79bb5ac1b196f1859ab5cc1f09ac`
- database kernel: `105436435adf2727d7e85713951f8def9f206f1d22d609880221c32cda55265b`
- kernel index: `f0f6976982ad5728c578fea1cd04a5fdf730ff197a8c9f52d5d42f3f8d51feaa`
- invoice/error module: `736165950d286040ac317a824fb3dc48594d7fb04fa11cd4861ba6e99c7eb874`
- package manifest: `7db3c6a252fa817f6a89ab9c1d321d0ebcef266a072838a7e54d6a96e112ed24`
- Bun lockfile: `16b1eb40baf0797fca6d8b57f4d0eba021525413f860f73e90838135217ffd1b`
- Bun executable: `0187f68d843f825a72ada4a7eca60db896ed753759a7f8252edcd31ac1bf1b9c`

Require the retained PostgreSQL PID15956/executable/start and exact loopback
listener55503, no3000/3001 listener, and sufficient existing drive space. Do not
start/stop a server, change environments on disk, mutate database facts, or grant
signed-HTTP/whole-suite approval from this isolated reproduction. The original
native RED and failed host-guard postaudit remain retained.

Two admission guards stopped before Bun/database execution: the first root shell
compared a UTC timestamp to a PowerShell local-DateTime parse (fixed by comparing
the exact UTC round-trip string); the second found the pinned observed snapshot
has a current-user-only INHERITED ACL rather than the required explicit protected
ACL. Seed/app credential ACLs are already explicit and remain untouched. Root
admits tightening ONLY that exact observed snapshot's ACL with the previously
reviewed Set-PrivateAcl function, retaining its exact b90a1001 bytes and owner.
No protection check is removed or relaxed; no test has yet executed in these two
attempts. The one admitted reproduction remains pending after these preflights.

## Retained original matcher RED; settled-error proof preparation

Root's one admitted original-matcher reproduction is RED on the first retained
wrong-property case: SQL wrapper entered and emitted sql-start, then the rejection
matcher was entered; sql-returned was never reached. Original120s test timeout and
5s close-hook timeout occurred, then the180s bounded pump stopped its own child.
Log `20260908-183940-279-941e0420-retained-expect-repro.log`, SHA256
`7cf19b62cc6e1714c9847048df9a319b71e8211f5a75fbb16b373276f8b957d2`.
Source/runtime external pins were unchanged. This reproduced the isolated failure;
it did not complete after-snapshots or establish whole-suite green.

Admit preparation only of two NEW successors in `.yellow/evidence/order454/`:
`retained-settled-rejection.integration.test.ts` and
`retained-settled-rejection.ps1`. Preserve the frozen original reproduction.
The only behavioral test change is to await the real operation in try/catch,
then assert rejection and exact expected error type after settlement. Add pure
negative controls for unexpected success and wrong error type, plus a genuine
expected-error control. Preserve all seven inputs, complete per-case snapshots,
shared pools,120s test limit,180s outer process limit and absence of SQL timeout
overrides. No fixture creation/import, DDL/DML, cleanup, production-code change
or original integration-test edit. Root must read, pin, admit and execute the
successor before this assertion repair or native result is accepted.

## Root settled-error execution admission — 2026-09-09

Root read the successor test, runner and imported credential/ACL/process-pump
definitions. Admit one root execution after independent non-operating inspection:
runner `9c3d851f1d9e54e1a619dda27bf4863a1e2b7be61d962e5bc00a734b103e3616`,
test `2c33501b910aca80da58bd8f542d03b112a8c65544e582e5a11dadc177f308f9`.
Target remains only the existing `yellow_order453_referee90_20260908` and its
seven frozen inputs. No fixture import/create, DDL/DML, timeout override or retry.
The genuine operation settles before synchronous type and canonical-message
assertion. Pure controls independently reject success, wrong type (same message)
and wrong message (same type), preserving unexpected error/value identity.

The runner binds the original RED artifacts and all prior source/Bun/helper pins;
before and after it verifies PostgreSQL15956's exact UTC start/executable, sole
55503 listener, stopped3000/3001, terminal-status bytes and at least4GiB free on
each existing drive. It keeps the original120s test/default5s hooks inside a180s
owned-child cap, private bounded logs, and requires2pass/0fail/no skipped tests,
each of seven actual rejections and unchanged complete snapshots, and both pools
closed. This accepts only the isolated assertion successor, not the original
suite, signed HTTP route, phase, release or live promotion. Independent personal
execution remains a separate handoff after the root result.

Root executed the exact pair through bundled PowerShell7.6.5:2pass/0fail,
63 assertions, seven retained cases in5.76s, snapshots unchanged and pools closed.
Log `20260908-212243-923-3efde621-retained-settled-rejection.log` SHA256
`f315340190ca3209093f20ff034c53f6f3d12f37860a586fafd5567ea738b338`.
Independent execution selected Windows PowerShell5.1 instead, and failed at the
credential-map `.TryAdd` API before Bun/database execution or proof-log creation.
That failed attempt is retained, not passed or silently retried.

Root admits the runner-only prerequisite guard now pinning the actual bundled
PowerShell7.6.5 executable path/hash362a356c before credential access. Runner
successor `251991f1725bc85fef25af3b9cc49baad38aa0249be614cb65533e41d23a1158`
changes no test, database, deadline, target or pass oracle. After independent
inspection of this guard, admit one fresh independent execution using exactly
`C:\Users\astha\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe`
with `-NoLogo -NoProfile -NonInteractive -File` and the recorded successor runner
hash/test2c33501b/root-handoff switch. This is the corrected runtime invocation,
not an unchanged retry of a database failure.

## Full-suite and HTTP successor preparation

Q247 explicitly adds its question file and the canonical integration test's
settled-assertion repair/pure controls to scope after independent isolated
acceptance. New private full-suite/HTTP runner and audit preparation is admitted;
execution and any additional synthetic cohort footprint remain separately gated.
Preserve the original failed artifacts and every existing retained cohort. No
production source, schema, provider or live app mutation is part of this repair.

## Retained signed-HTTP admission — 2026-09-09

Root read the complete manifest helper, runner and frozen HTTP test. Following
independent non-operating inspection, admit one Root PrepareManifest read and one
Root Execute, then a separate Independent Execute after the root result. Runner
`0f846a1ad07ba6bbab01d721e51463f378e00e6e3c93fafd04908e3605f6847d`,
helper `dc118a402e5751374a87933495233c893bdd3aaabaec9e303d18e2a0db1f7094`,
test `8837cb392da5d1fa2baf797886bead076684f61ea176102e4cc244144ed4a24a`.
Source/fixture closure224 files is42986fdf; existing retained diagnosis d87c520c
binds the two cohorts and five current-year series. No new fixtures or listener.

Use only exact bundled PowerShell7.6.5 and pinned native Bun/PostgreSQL; require
PG15956/55503 and absent3000/3001 before and after. PrepareManifest makes one
SELECT with explicit read admission, closes its pool, and writes private IDs-only
capture/manifest; root must separately bind the resulting manifest hash before
either actual test invocation. Distinct root/independent protected logs cannot be
overwritten. Each run must report5pass/0fail/no skip, complete row/catalogue/sequence
equality and pool closure. The bounded child retains180s/5MiB; C/D must retain512MiB
minimum and64MiB beyond the log bound for this read-only proof, not the unrelated
runtime-upgrade reserve. No automatic retry, DDL/DML, seed, migration, publication,
provider, credential-file change or serving-runtime startup is admitted.

## Full native successor accepted; HTTP fixture-day correction — 2026-09-09

Q247 root executed repaired testae6ccb66 through runner84e0b945/proof41e381db,
binding Reviewaf332be3, fresh Preflight8448eead and private root admission350b959e.
Actual result10pass/0fail/253 assertions/38.19s. Final61785924 and observedf17633be
prove all1,437 prior rows, eight companions, global/target catalogue and ledger,
protected sequences unchanged; only the admitted173-row two-cohort/six-code
fixture footprint was added (1,610 total). Exactly19 owned outbox allocations
were contiguous under numeric ordering. The initial filesystem-only Review failed
because object key insertion order differed, log28b58286; sorted-entry comparison
preserves the same5/3/1 deadline multiset. The original failed proofs remain.

Independent windows_test_acceptance read all exact files and personally executed
the read-only auditd9e9463d:15.34s/exit0, receipt59bc5056, fresh observationf92c0708,
logb5ec84fc. It independently recaptured preservation and ownership without
recreating fixtures or rerunning the full suite. This accepts native SQL only.

Root HTTP manifest3cace1a8 was read successfully. Actual retained HTTP run returned
4pass/1fail/41 assertions/2.32s, logcc911f9c; configured request received503 while
snapshot equality and identity binding passed. Source diagnosis identifies likely
September8 supplier-status evidence after September9 property-local rollover.
The original manifest lacked a current-day status/authority preflight.

Admit preparation of NEW private helpers/runners for (a) one read-only diagnostic
of the exact three old property/supplier pairs' dates/status and sanitized request
result, and (b) a successor manifest bound to full-suite final61785924 and its
two newly created current-day cohorts. No additional fixture writes, status
backfill, schema/provider/production change, predicate relaxation or test edit.
The frozen HTTP test8837cb39 remains unchanged. New manifest preparation must
verify current-day status and exact actor/property authority before acceptance;
root/independent execution uses new non-overwriting logs and separately pinned
manifest. Root must inspect and admit each final helper/runner before DB access.

Root read and admits successor5034db6d with diagnostic7507e7a7 and selector896a0ca9:
one Root DiagnoseExpiry read, followed by one Root PrepareManifest read. Exact
full-suite final61785924/observedf17633be bind the two fresh cohorts. Corrected
old foreign supplier matches original retained evidence; no unadmitted identity.
The five-test HTTP source8837cb39 is unchanged. After diagnostic/current-day/actor
preflight and separate manifest hash binding, admit one Root Execute and one
independent nonimplementer Execute in distinct protected logs. No writes, retries,
new cohorts or weakening of current-date availability is part of this successor.
