# Q236 — Order450 native list proof and mandatory CI execution

## RESOLVED — bounded technical proof admission

Order450 needs its new native HTTP/list test executed, not silently skipped by the
existing Order446 CI command. After root releases the Order449 source-publication
freeze, admit only one additional block in `.github/workflows/ci.yml`: run
`tests/operator-fiscal-credit-note-list.integration.test.ts` against the already
created fresh88 credit target with its existing deploy/runtime variables and
`YELLOW_REQUIRE_ORDER450_DATABASE=1`. No new CI database, service, dependency or
provider is necessary. Missing authority must fail this mandatory test explicitly.

For local independent execution, admit private preparation/runner files only under
`.yellow/evidence/order450`. Reuse the existing native PostgreSQL16.15 server on
port55503 and only `yellow_order446_referee87_20260907`, at canonical migration88.
The preceding accepted Order449 after-state is preserved as an input, not replaced:
canonical SHA256 `7af73c81c30436be115aa8f4afcf058896ccffe887f62a6190741fa64ecc0327`.
The target currently contains1,773 public rows, seven synthetic tenants and21
permissions. Fresh preflight must authenticate exact source files, migrations,
schema, ownership/ACLs, all existing rows, companions and running services before
root admits one execution. Credentials remain protected and are never logged.
The unchanged canonical helper requires its own existing output directory:
admit only new uniquely named `order450-<timestamp>-<nonce>-*.json` snapshots under
`.yellow/evidence/order447/canonical-logs`. Do not overwrite any prior snapshot or
change that helper. Capture canonical state again after the read-only planner and
require it byte-identical to the post-test state.

Use the existing governed fixture factories to create the minimum two new synthetic
tenant/property cohorts: two genuine credits in one property and one credit in the
foreign property. Every original invoice, valuation, correction and credit is
produced by existing commands, not invented document rows. Permit only the new
fixture-owned rows, the six exact ROOM/CGST/SGST transaction-code globals produced
by those two factories, and revocation of the new test actor's own role links.
No prior row, permission, global value, catalogue, function, sequence definition,
schema ledger or companion target may change. Identify each actual code through
its new cohort routes and prove zero outside-cohort references; do not authorize a
prefix-wide global mutation. Do not retry issuance or prune/delete fixture rows.

Personally execute the frozen HTTP/service pagination, exact-number filtering,
empty-page, tenant/property isolation and revoked-current-authority cases. Snapshot
the complete new cohorts' financial/fiscal graph after fixture creation and require
it unchanged by all reads and denials; full outer containment preserves every old
row and limits additions to the admitted cohorts. Retain failed runs verbatim.

Capture actual parameterized list-query EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT
JSON) in runtime/app_role tenant transactions for empty, populated, continuation,
exact-number hit and miss. The authority CTE must execute even on empty results;
denied actor calls must return42501, not an empty page. No ANALYZE/statistics write
is authorized. On tiny fixtures, a separately labelled transaction-local
enable_seqscan=off plan may prove existing index eligibility; it must not be
presented as the optimizer's normal plan. Limit+1 bounds returned rows, not all
examined rows: exact-number lookup may scan the bounded property/date range.
The actual HTTP test revokes the new main cohort's actor after proving populated
same-day pagination. Subsequent positive plans therefore use the new foreign
cohort's still-authorized actor and its one credit, including an empty continuation;
revoked empty/continuation plans use the main actor. Do not invent a replacement
grant or describe the empty continuation plan as a populated continuation.

Root reads the complete frozen helper/test and verifies hashes before personally
executing. No new server/database/Docker/WSL process, app restart/promotion, external
provider, migration, UI work, main merge or phase-completion claim is admitted.
