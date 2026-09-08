# Order449 — Complete immutable credit-note document retrieval

**Status:** BUILT, backend-only; root independently executed actual PostgreSQL
API1/0(48), full containment and focused50/0(650) with3 explicit database skips.
Exact seven-path standing/publication under Q234 and source CI remain pending.
Published parent is ffb03441a16d50aa050c5d6f715d35ed9223601b on draft PR92.
No local promotion or phase-completion claim.
**Phase:** 7. **Owner:** Codex. **Date:** 2026-09-08.
**Authority:** PROJECT.md, founder-approved Q187 clauses1/5/7, native Order446
issuance/read capability and Order447's lossless issued-credit validator. No new
fiscal policy is decided by this read-only completion slice.

## Outcome and existing architecture

Authorized staff can retrieve the full already-issued native credit document,
including its frozen supplier/buyer/items/taxes/original-reference data. Existing
credit receipt GET and original-invoice discovery return only the issuance receipt;
they do not expose the complete issued document for downstream detail/printing.
This order builds the backend retrieval, not a UI or renderer.

Reuse the immutable public.document row, existing credit binding and the existing
`read_india_native_fiscal_credit_note` current-authority capability. No new table,
migration, permission, event, query engine, dependency or second source of truth.
Do not recompute tax or consult today's mutable guest/registration configuration.

## Service and command contract

Input is the existing exact read snapshot: tenantId, propertyNode, actorId and
creditDocumentId. Validate/detach it before any await; hostile/extra/malformed
input performs zero SQL. Add `IndiaNativeFiscalCreditNoteService.readDocument`,
`ReadIndiaNativeFiscalCreditNoteDocumentCommand`, and matching normal/caller-Tx
functions. Use the existing transaction-local tenant context and error vocabulary.

Execute one parameterized statement with those four UUIDs bound once in an input
CTE. A MATERIALIZED authority CTE must invoke the non-strict VOLATILE existing read
capability even for a missing document. Only with its non-null receipt may a
correlated lookup return the exact tenant/property/document row, restricted to
kind credit_note and status issued. Select stored `content::text` and stored
sha256, not reconstructed JSON. Never replace current actor authority with a direct
table read. Missing authorized receipt returns null; receipt present with missing,
duplicate, malformed or mismatched content is a sanitized storage failure.

Reuse the existing strict receipt parser. Verify document/property selectors and
stored sha256 equal the receipt, then run Order447's lossless source validator
against the original content string. It enforces byte hash, duplicate-name rejection,
source limits, CRN shape and integer amounts. Bind DocDtls No/date/type to receipt;
bind every YellowCredit field to its receipt counterpart; require the sole original
reference number equal originalDocNo and the source total equal totalMinor using
exact decimal-to-bigint conversion, never floats or parsed numeric provider wire.
The prior invoice date remains the immutable validated reference, not a new date
derived from current configuration. Do not alter the existing validator or receipts.

Successful value is a frozen object with exactly:
`kind: india_native_credit_note_v1`, `receipt` (existing validated receipt),
`contentJson` (the exact stored string). Do not duplicate a second receipt encoding
in this response. All nested receipt fields remain frozen by the existing parser.

## HTTP

GET `/api/v1/properties/:property/credit-notes/:creditDocument/document`.
The signed session owns tenant/actor; path owns property/document. No query selector
or body-derived authority. Require documents:read scope and current property grant,
then the independent database authority check. Return200 JSON with no-store and
correlation header; no replay metadata. Concealed absence404, malformed input400,
denied403 and corrupt/unexpected storage503 use the existing credit error responses.
Existing issue, receipt read, discovery and fiscal-submission endpoints stay intact.

## Scope and parallel ownership

- Backend lane: src/contexts/tax-fiscal/india-native-fiscal-credit-note.ts,
  src/commands/issue-india-native-fiscal-credit-note.ts,
  src/contexts/tax-fiscal/index.ts, tests/india-native-fiscal-credit-note.test.ts.
- HTTP lane: only method/import in src/http/operator.ts and route in src/app.ts,
  plus tests/operator-fiscal-credit-note.integration.test.ts.
- Root: this order, docs/CONTRACTS.md, docs/PROJECT-STATUS.md, DECISIONS.log,
  handoff/LEDGER.md; nonimplementer owns handoff/reviews/449-native-credit-note-document-read.md.

Preserve all paused UI hunks in mixed files. No code before activation. Any private
native proof helper/target needs separately documented admission; reuse the existing
server and bounded synthetic fixtures rather than starting another cluster.

## Executable acceptance

Focused tests exercise hostile inputs/storage, snapshot timing, exact bound query,
authority on absence, byte-preserved reordered content, hash and all lineage-field
mismatches, invalid CRN and monetary totals; old tests remain unchanged. Signed HTTP
proof covers scope/grants, method routing, selectors, no-store and sanitized errors.
A nonimplementer personally executes actual issued-credit retrieval, concurrent
reads, concealed foreign/missing/noncredit IDs, revoked authority on missing and
existing objects, exact stored bytes and unchanged financial/fiscal graphs. Retain
every failed result, correct the cause, and run the relevant proof. Types, boundaries,
licence, full standing and exact-source CI are required before final acceptance.

No issuance/correction/posting/numbering/migration/provider call, UI, runtime
promotion, merge or whole-Phase7 completion is authorized by this order.
