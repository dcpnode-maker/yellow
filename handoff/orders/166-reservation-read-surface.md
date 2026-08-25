# Order 166 — Reservation board and detail read surface

**Status:** READY — prerequisite for the real reservation workbench
**Phase:** 5 · human-testable application
**Branch:** `phase-5/reservation-read-surface`
**Base:** `c0fa84d` (Order165 candidate plus approved Order164 evidence; Order165 review remains prerequisite)
**Risk tier:** 3 — tenant/property-scoped reservation and Party reads
**Owner:** Codex implementation; independent non-implementing Tier-3 review

## Outcome

Integrate the already independently approved, unintegrated Order141 reservation-detail
aggregate and expose one bounded reservation board plus one aggregate detail endpoint.
This supplies truthful server data for the next lightweight list/drawer UI without
adding a mutation, schema object, permission or second source of truth.

## Scope

- exact approved Order141 product/test/governance/review files from `9397c141`;
- `docs/CONTRACTS.md`;
- new `src/contexts/reservations/board.ts`;
- `src/contexts/reservations/detail.ts` only for an exact UUID lookup extension if the
  approved confirmation lookup cannot safely serve a deep link;
- `src/contexts/reservations/index.ts`;
- `src/http/operator.ts`;
- `src/app.ts`;
- `src/server.ts`;
- new `tests/reservation-board.integration.test.ts`;
- new `tests/operator-reservation-read-surface.integration.test.ts`;
- inherited `tests/reservation-detail.integration.test.ts`;
- this order, additive D-433, `handoff/LEDGER.md`, and one additive review.

No HTML/CSS/JavaScript, schema, migration, index, grant, seed, state transition, event,
write, lock, occupancy, journal/payment/fiscal behavior, dependency, credential or local
runtime replacement is in scope. Stop and write a question before widening it.

## Required behavior

1. Import Order141 exactly, preserving all hostile stored-reference, tenant/property,
   range, Party, account, task and fact-predecessor guards and its immutable approval.
2. Add one read-only service that lists at most 100 reservations per call (default 50)
   in deterministic `created_at DESC, id DESC` order with a canonical opaque cursor.
   Offset pagination is forbidden.
3. Accept only strict non-PII filters: optional reservation status and optional bounded
   stay-overlap `from`/`to`. Guest names, contacts and arbitrary search text never enter
   a GET URL. Existing exact-confirmation lookup remains byte-compatible.
4. Each row contains only reservation id/reference/status, primary guest display name,
   current stay bounds, latest unit type/sellable/rate labels, adults/child count,
   channel/currency and created time. Contacts, identity documents, notes, history,
   payment/tax and invented totals are absent.
5. Add a UUID-addressed aggregate detail endpoint for canonical
   `/p/{property}/res/{reservation}` deep links. Foreign tenant/property/missing records
   are indistinguishable not-found responses. The endpoint returns the approved Order141
   aggregate and server-derived existing lifecycle actions without client inference.
6. All reads execute inside the caller's transaction-local tenant context, use bounded
   set-wise SQL with tenant-leading predicates, create zero artifacts, and behave the
   same with production-style `prepare: false` connections.

## Proof

- exact Order141 patch/blob/review identity and ancestry evidence;
- tied-timestamp multi-page completeness with no duplicates/omissions, strict malformed
  cursor/filter/limit denial, default/max bounds and deterministic repeated reads;
- two tenants and two properties proving list/detail isolation, generic not-found,
  no contact leakage and unchanged exact-confirmation behavior;
- query-plan/bounded-work evidence, zero before/after mutation cardinality, and
  production-style unprepared parity;
- focused board/detail/operator suites, standing tests, typecheck, boundaries, licences,
  audit, schema/protected hashes and fresh referee 11/11;
- independent non-implementing Tier-3 reviewer personally executes the proof.

## Forbidden

- Guest/contact query strings, OFFSET, unbounded rows, N+1 list queries, JSON extraction
  predicates, RLS bypass, duplicated Order141 joins, client-derived actions, mock data,
  write/event/schema/permission changes, merge, push, deployment, self-review or self-merge.

## Definition of done

- [ ] One bounded board page and one UUID detail surface are tenant/property safe.
- [ ] Approved Order141 guards remain intact and existing lookup stays compatible.
- [ ] Full Tier-3 proof passes on one immutable independently approved candidate.
