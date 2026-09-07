# Order448 — Existing full-credit discovery from the original invoice

**Status:** ACTIVE non-UI implementation, activated by root after exact Order447
publication25d3b979278c409621f0c70ea5a2951558ecb982. Its CI34163554694 is running;
disjoint typed/API implementation and pure tests may proceed now. Native proof,
final acceptance and publication require the separate current88 CI/target checks.
**Owner:** Codex coordinator. **Phase:** 7. **Date:** 2026-09-08 (Asia/Kolkata).
**Authority:** PROJECT.md; founder-approved Q187/D1302 clauses 1, 5 and 7;
D1426 functional-only directive; independently verified Order446 native full-credit
issuance and its canonical0087 read contract.
**Predecessor:** Order447 publication and exact-source CI at canonical current88.

Lane A owns the native credit service, command, context export and typed test file.
Lane B owns only the discovery import/method in operator.ts, the method-disjoint
app.ts route, and the existing operator credit-note integration test. Root owns
contracts, coordination, integration and publication; the independent native
reviewer owns its review file and personally executed proof. No lane edits another
lane's files without a handoff. Draft scope adds no private native helper yet;
any necessary helper/target admission is documented before execution.

## Complete outcome

An authorized operator who knows a genuine original native India invoice UUID can
discover the at-most-one full credit already issued against it, even when the original
POST response or generated credit-document UUID is unavailable. The server returns
the same immutable PostgreSQL `receipt_json` bytes as the existing credit-document-ID
GET. Discovery never issues, retries, submits, cancels, edits or deletes anything.

Add this method-disjoint route beneath the existing property boundary:

`GET /api/v1/properties/:property/invoices/:originalDocument/credit-notes`

The existing POST at the same path remains byte- and behavior-compatible.

## Existing authority and Natural-Solution Test

No new entity or persistence concept is justified:

- canonical0087 already enforces exactly one binding per
  `(tenant_id, original_document_id)` in
  `public.india_native_fiscal_credit_note` and grants app-role SELECT under forced
  tenant RLS;
- that binding already stores the generated `document_id` and immutable
  `receipt_json`;
- `public.read_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid)` already
  rechecks active tenant, user, property hierarchy and
  `tax-fiscal.documents:read` before returning those bytes;
- the existing TypeScript receipt parser and HTTP responder already enforce the
  strict receipt shape, selector agreement, `no-store`, correlation header and raw
  byte preservation.

Therefore this order adds no migration, table, column, index, permission, state,
event, idempotency record, journal, posting, fiscal number, provider action or second
receipt representation. Do not add `LIMIT 1` to hide binding corruption and do not
read `receipt_json` directly in application SQL, because either would weaken existing
database authority.

## Exact command and query contract

Add an exact plain-object input containing only:

```text
tenantId, propertyNode, actorId, originalDocumentId
```

Name the public boundary consistently:

- `IndiaNativeFiscalCreditNoteDiscoveryInput`
- `snapshotIndiaNativeFiscalCreditNoteDiscoveryInput(value)`
- `IndiaNativeFiscalCreditNoteService.discover(tx, value)`
- `DiscoverIndiaNativeFiscalCreditNoteCommand`
- `discoverIndiaNativeFiscalCreditNote(database, value)`
- `discoverIndiaNativeFiscalCreditNoteInTransaction(tx, value)`

The result is the existing
`IndiaNativeFiscalCreditNoteReadResult | null`; do not create a wrapper or a second
receipt type. Snapshot all four canonical lowercase UUID strings before the first
await. Reject arrays, proxies, accessors, inherited/surplus keys and malformed UUIDs
with the existing sanitized validation failure and zero SQL calls. The command owns
the normal `Database.withTenantTransaction`; the in-transaction function must use the
caller's `Tx` without opening another connection or transaction.

Discovery executes one parameterized statement. Bind the four input values exactly
once through a one-row input CTE. Its scalar subquery selects only
`document_id` from `public.india_native_fiscal_credit_note` using exact tenant,
property and original-document predicates; pass that UUID, including `NULL` when no
binding exists, to the existing
`public.read_india_native_fiscal_credit_note(...)`. The existing VOLATILE function
must execute even for a missing binding so current database authority is rechecked;
never return early from an unauthoritative direct lookup. Tenant context remains the
transaction-local `app.tenant_id` established by `Database`.

Accept exactly one SQL result row with sole field `receipt_json`. `NULL` means no
discoverable credit. Non-null text must pass the existing strict receipt validator and
must match the requested `propertyNode` and `originalDocumentId`; malformed,
multi-row, hostile/accessor/proxy or selector-divergent storage replies are sanitized
database failures, never success or ordinary not-found. Preserve the exact received
text bytes.

## Exact HTTP contract

The signed session supplies tenant and actor; path parameters supply property and
original invoice. No body, query selector, amount, reason, idempotency key, folio,
series, date, number, hash or credit-document ID is accepted.

Before the first grant-query await, validate/snapshot the route and session input.
Require the existing `tax-fiscal.documents:read` token scope and current property
grant, then rely on the database function's independent current-authority recheck.

| Outcome | Response |
|---|---|
| Existing bound full credit | `200`, exact durable `receipt_json`, `no-store`; no `idempotency-replayed` header |
| No credit, unknown/non-native/foreign original, or a binding outside the otherwise authorized tenant/property route | the same concealed `404 fiscal/credit_note_not_found` |
| Missing token scope or current property/database authority | existing sanitized `403` |
| Malformed UUID or any query selector | existing sanitized `400` |
| Malformed storage reply or unexpected database failure | existing sanitized `503` and transaction rollback |

Do not expose whether a foreign original invoice or credit exists. Do not change the
existing POST, credit-ID GET, receipt bytes, error vocabulary or fiscal-submission
routes.

## Scope

Implementation and focused proof:

- `src/contexts/tax-fiscal/india-native-fiscal-credit-note.ts`
- `src/commands/issue-india-native-fiscal-credit-note.ts`
- `src/contexts/tax-fiscal/index.ts`
- `src/http/operator.ts` (the one discovery method/import only)
- `src/app.ts` (the one method-disjoint GET route only)
- `tests/india-native-fiscal-credit-note.test.ts`
- `tests/operator-fiscal-credit-note.integration.test.ts`
- `docs/CONTRACTS.md`

Coordination and independent evidence:

- this order
- `handoff/reviews/448-native-credit-note-original-discovery.md` (new)
- `docs/PROJECT-STATUS.md`, `DECISIONS.log`, `handoff/LEDGER.md` only when recording
  actual verified/published state

The current CI already executes
`tests/operator-fiscal-credit-note.integration.test.ts` with mandatory Order446
deploy/runtime URLs against an isolated fresh current database, and its workflow
oracle pins that filename. No workflow edit is expected. If publication of Order447
changes that fact or any necessary file is outside this list, stop and write a scoped
question instead of widening this order.

## Forbidden

- any migration or edit to migrations 0001–0088;
- a new table/view/function/index/permission/event or receipt/read model;
- any invoice, credit, journal, posting, allocation, series, document, fact, outbox,
  idempotency or fiscal-submission write;
- partial/debit/refund/replacement credit behavior, original-invoice mutation or a
  second full credit;
- provider calls, credential requests, provider activation or external acceptance
  claims;
- list/search/pagination across invoices or credits, query selectors or cross-property
  discovery;
- UI/UX, local-app promotion, deployment, merge or Phase7-complete claims.

## Pre-registered proof and Definition of Done

1. **Typed boundary.** Focused tests prove hostile/surplus/malformed inputs perform
   zero queries; snapshot precedes checkout/await; the command uses one tenant
   transaction; the in-transaction helper delegates to the supplied `Tx`; the SQL is
   one parameterized CTE/read-function statement with exact four-value binding.
2. **Storage hostility.** Unit tests prove `NULL` returns null, valid reordered JSON
   preserves exact bytes, and malformed/multi-row/proxy/accessor or wrong
   original/property receipts become sanitized database failure. Existing issue and
   credit-ID read cases remain byte-identical.
3. **Signed HTTP boundary.** Stubbed composition proves the GET shares the POST path
   without shadowing it; requires signed read scope and property grant; rejects bad
   UUID/query before SQL; returns exact bytes/no-store without replay metadata; and
   conceals all unavailable-object cases behind one 404.
4. **Actual PostgreSQL proof.** On one isolated canonical-current fixture, the
   existing signed-session test must prove: 404 before issuance; actual Order446 issue;
   discovery by original returns bytes identical to both the POST and credit-ID GET;
   repeated/concurrent discovery remains byte-identical; a foreign original through
   an otherwise authorized route and unknown/non-native originals are concealed404;
   an ungranted property route is403. Direct transaction-level discovery by a
   now-unauthorized synthetic actor for a missing original must raise the typed
   authorization failure rather than return null, proving the authoritative function
   still executes on the null path; the stale signed route independently returns403
   at its current-property check.
5. **Zero mutation.** Capture the issued credit graph, original financial/source
   graph, series counter/hash, and relevant document/journal/posting/fact/outbox/
   idempotency/submission row fingerprints after the fixture's authorized issue.
   Require exact equality after every discovery/denial cohort. Discovery creates no
   audit event because it is a read.
6. **Independent execution.** A nonimplementing reviewer personally runs the focused
   source tests and the mandatory real signed-session PostgreSQL proof, then verifies
   typecheck, import boundaries, full nonvisual standing suite, licence policy and
   exact-source CI. Skips or mock-only results are not database proof. Any native
   execution requires a separately admitted isolated target and before/after
   preservation snapshot; never run generic integration bootstrap against the
   retained shared server.

Completion means this one read-only recovery/discovery path is implemented,
independently proven and published. It does not complete provider certification,
partial/debit corrections, UI work, local promotion or Phase7.
