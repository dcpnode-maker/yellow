# Order450 — Authorized issued-credit list and lookup

**Status:** BUILT AND PUBLISHED in 0b1ff327d289c611542d81f272d7e3a2e7223b06
on draft PR92. Independent scoped proofs and exact combined standing1,956/0 pass,
with1,410 explicit environment/database skips and34,947 assertions. All six source CI
jobs pass in34202983111. Earlier failures remain evidence.
No UI, local promotion, provider activation or phase completion is claimed.
**Phase:**7. **Owner:**Codex. **Date:**2026-09-08.
**Authority:**Q187 approved native correction/read principles; founder functional-
only continuation; immutable Order446 credit binding and documents:read capability.

## User outcome

Cashier/integration clients can find issued native credits by business-date range
and exact document number without already knowing a document/original UUID. Each
summary leads to existing receipt, original invoice and complete-document APIs.
This is one backend service/command/signed HTTP journey; no UI or print renderer.

## Contract and performance

GET `/api/v1/properties/:property/credit-notes` with required issuedFrom and
issuedBefore (inclusive/exclusive canonical dates,1–366 days). Optional docNo is
an exact fiscal number1–16 alphanumerics/slash/hyphen, not fuzzy SQL. Optional
after is an opaque canonical cursor; limit defaults25 and is integer1–100.
Reject unknown/duplicate query selectors, malformed UTF/date/UUID/cursor, accessors,
proxies, inherited or symbolic fields. Signed session supplies tenant and actor;
those can never be overridden in query/body. Detach inputs before any await.

Sort descending business_date,document_id to use existing tenant/property/date/id
credit index. Fetch limit+1, never OFFSET or unrestricted matching-count query.
Return frozen `{items,nextCursor}`; items are frozen summaries containing exactly
documentId,originalDocumentId,docNo,originalDocNo,businessDate,propertyNode,
currency,totalMinor,sha256. IDs/date/number/hash/positive-int64-decimal/currency
are strictly validated; currency is INR. No floating point or recomputed tax.
totalMinor is the existing immutable receipt's integer string. Other fields come
from immutable credit/document/original columns, with exact tenant/property,
kind/status/identity and receipt metadata bindings checked before returning.
Invalid/duplicate/out-of-order/mismatched rows fail closed, never partially return.

Use one parameterized query per page. A MATERIALIZED CTE must invoke the existing
non-strict VOLATILE read_india_native_fiscal_credit_note with the current tenant,
property,actor and NULL document to establish present authority before scanning.
Make the outer result depend on that CTE even for an empty page; revoked authority
must deny rather than look like empty data. Reuse app_role SELECT/RLS, transaction-
local tenant context and existing credit/property index; no migration or generic
SQL API. Preserve a validated empty sentinel to distinguish absent rows from
missing authority execution. Inspect the actual planner/native denial proof.

The cursor binds version,tenant,property,exact date/docNo filters,final businessDate
and documentId; canonical encoding rejects duplicate JSON names/extra fields and
cross-filter/property reuse. Cursor is pagination, never authority. Recheck current
scope,property grant and database authority on every page. No guessable offset or
cache. Keys used for sorting/filtering are typed columns, not indexed JSONB WHERE
expressions. No receipt per-row network calls or full-document validation per row.

HTTP200 uses no-store and correlation ID. Existing credit authorization/validation/
database exceptions map to403/400/503, sanitized and independent of private SQL.
Authorized empty results are200/items[]/nextCursor:null. Forbidden property403.
Existing issue/discovery/receipt/document routes and semantics remain unchanged.

## Scope and coordinated lanes

- LaneA new files: src/contexts/tax-fiscal/india-native-fiscal-credit-note-list.ts,
  src/commands/list-india-native-fiscal-credit-notes.ts,
  tests/india-native-fiscal-credit-note-list.test.ts.
- Integration after root releases Order449 freeze: only context index exports,
  src/http/operator.ts import/method, src/app.ts GET route.
- LaneB new tests/operator-fiscal-credit-note-list.integration.test.ts: focused
  signed composition and mandatory real-PostgreSQL tests using existing fixtures.
- Root coordination: this order, docs/CONTRACTS.md, docs/PROJECT-STATUS.md,
  DECISIONS.log, handoff/LEDGER.md, handoff/reviews/450-native-credit-note-listing.md.
- Existing fixtures are read-only dependencies. Native target/proof helper requires
  separate exact admission. No edits outside this list; raise a scoped question
  if another file is necessary. No existing449 source edit before root release.
- Q236 additionally admits only the mandatory new-test command in the existing
  `.github/workflows/ci.yml` fresh88 credit step after root releases the freeze,
  plus exact private native proof preparation. No additional database is created.

## Acceptance

Test input snapshots/hostile shapes; one-query bound inputs; zero SQL on malformed
inputs; row/metadata validation; empty pages; exact filters; page boundaries,
same-day tie ordering, cross-filter cursors, no duplicate/skipped rows; revoked
authority even empty and later pages; HTTP authentication/scope/property/query
denials and no-store. Nonimplementer personally executes real native pagination,
tenant/property isolation and unchanged financial/fiscal state. Do not seed many
hotels or start another database/server; reuse separately admitted synthetic data.
Types,boundaries,full standing and exact-source CI remain required. No provider,
issuance,correction,numbering,app restart/promotion,UI,mainmerge or Phase7completion.
