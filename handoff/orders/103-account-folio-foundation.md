# Order 103 — Account-owned reservation folio foundation

**Phase:** 5  
**Branch:** `phase-5/account-folio-foundation`  
**Base:** `f32663f`  
**Risk tier:** 3 — financial ownership, tenant coherence and concurrent numbering  
**Owner:** Codex implementation; independent non-implementing reviewer required

## Outcome

Create Yellow's first executable financial aggregate without posting money. Opening a
confirmed reservation's primary folio derives its tenant, property, Party and currency
from PostgreSQL, reuses one canonical property-scoped guest account, allocates one
human-readable non-fiscal folio reference transactionally, and creates window 1 with
atomic fact, `folio.opened` outbox and idempotency evidence. A reservation links to a
folio; it never owns or becomes the account.

## Natural-Solution Test

The immutable baseline already contains `account`, `folio`, `document_series`, Party,
reservation, facts, outbox, tenant RLS and durable idempotency. The natural solution is
a financial context service plus a forward integrity migration: no shadow balance,
counter table, reservation column, journal, payment, tax object or new event is needed.
The migration adds only tenant-coherent reference constraints and the missing one-window
invariant; the existing non-fiscal `document_series(kind='folio')` row is the numbering
authority.

## Scope

- `migrations/0009_account_folio_integrity.sql`
- `src/contexts/financials/folios.ts`, `src/contexts/financials/index.ts`
- `tests/financial-folios.integration.test.ts`
- `tests/migrate.integration.test.ts`, `tests/database-acceptance.integration.test.ts`,
  `tests/schema/expected.sql`
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`,
  `docs/research/CAPABILITY-MATRIX.md`
- `src/project-status.ts`, `tests/founder-status.integration.test.ts` only after green
- this order, `handoff/PHASE-5-PLAN.md`, `handoff/LEDGER.md`, `DECISIONS.log`,
  `handoff/questions/`, and the independent review record

## Required work

1. Migration 0009 adds referenced `(tenant_id,id)` uniqueness where required, composite
   tenant foreign keys for account→property/Party and folio→account/reservation, plus
   exact uniqueness of `(tenant_id,reservation_id,window_no)` for reservation-linked
   folios. Existing single-column keys remain; no table, column, status, role or event is
   added. The migration must reject cross-tenant child references at the database edge.
2. Add `FolioService.openPrimary` with an exact runtime shape containing only tenant id,
   reservation id, idempotency key and audit envelope. Tenant comes from its transaction
   at every real caller; actor/property/currency/Party/confirmation are server-derived.
3. Lock the reservation and accept only `reserved`, `due_in`, `in_house` or `due_out`.
   Validate its property and primary Party inside the same tenant. Use transaction-level
   advisory locking for the account reuse key and reservation so concurrent different
   keys cannot create competing accounts or window 1.
4. Reuse exactly one account keyed by tenant + property + role `guest` + primary Party +
   currency. Zero creates one open account with a non-PII name; more than one, or one
   frozen/closed account, fails closed rather than guessing or silently opening another.
5. If exact window 1 already exists, return it as an unchanged result after verifying its
   canonical account relationship. Otherwise require exactly one non-fiscal folio series
   for the tenant/property, lock it, allocate `prefix || next_no`, increment once, and
   insert one open folio. Series allocation and all evidence share the same transaction,
   so any later failure reuses the number without a gap.
6. Wrap the complete command in `PostgresIdempotency` under
   `financials.folio.open`. A changed same-key request conflicts. A real creation appends
   one minimized `folio.opened` fact and existing outbox event; unchanged opens invent no
   evidence. Responses/events use UUIDs, window number and folio reference only—no Party
   name, contact, note, payment token or raw reservation metadata.
7. Document this foundation honestly. Balanced charges, statement queries, additional
   windows, routing, transfer, correction, settlement, payments, tax/fiscal, cashier,
   day close, AR, trust and UI/API remain later orders.

## Forbidden

- Editing `migrations/0001_init.sql`; new table/column/status/account role/event
- Journal, posting line, balance mutation, charge, transfer, reversal or adjustment
- Payment instrument/payment/deposit/provider/webhook, PAN/CVV or payment token handling
- Tax calculation, document creation/issue/hash chain, fiscal/statutory behavior
- Trust/owner funds, AR, cashier, business-day roll/seal, reservation transition
- Caller-selected property, Party, currency, account, folio number, series or window
- Floating-point money, direct non-tenant SQL, browser/HTTP/UI, consumer/worker automation
- Number allocation outside the account/folio/evidence transaction
- Self-review, self-merge, files outside Scope or weakening existing referee assertions

## Pre-registered proof

### P0 — intentional red

A focused test imports `FolioService` from the financial context and fails before any
production or migration implementation because the export does not exist.

### P1 — forward integrity migration

Fresh migrations 0001–0009 prove exact ledger/checksum and normalized schema. PostgreSQL
rejects cross-tenant account property/Party and folio account/reservation references plus
duplicate reservation window 1. Existing fixture and RLS/referee behavior remain exact.

### P2 — canonical account and folio opening

Fresh PostgreSQL proves one eligible reservation creates one open guest account and one
open primary folio with the exact locked series number, one minimized fact and one
`folio.opened` event. A second reservation for the same Party/property/currency reuses
the account but receives its own next folio; a different property or currency does not.
Existing exact window 1 returns unchanged and creates no new artifacts.

### P3 — concurrency, replay and rollback

Twenty concurrent different-key opens yield one window/account/evidence effect and one
series increment. Exact same-key replay is byte-equivalent; changed content conflicts.
Injected failure after outbox insertion rolls account, folio, fact, event, idempotency and
series counter back, and the same key retry wins with the unskipped number.

### P4 — hostile financial boundaries

Foreign tenant/property/Party evidence, cancelled/no-show/checked-out reservations,
malformed ids/keys/envelopes, missing or ambiguous/wrong-fiscal series, duplicate or
frozen/closed canonical accounts and corrupt existing window relationships fail without
artifacts. App-role tenant A cannot read tenant B account/folio. Journal, posting,
payment, cashier, business-day and document row counts remain byte-identical.

### P5 — project gates

Focused proof, migration/deployment acceptance, exact schema, typecheck, boundaries,
standing suite, licences/audit, protected hashes and a fresh 84-table referee pass. A
non-implementing reviewer personally executes P1–P4 on fresh PostgreSQL and approves.

## Definition of done

- [x] Order exists before implementation.
- [x] Intentional P0 red is committed before production or migration code.
- [x] Tenant/account/folio constraints fail closed at PostgreSQL.
- [x] Primary folio opening is atomic, replayable, minimized and gap-free.
- [x] Concurrency and publication failure leave no duplicate or partial artifact.
- [x] No money/payment/tax/fiscal/day-close behavior enters this slice.
- [x] Standing/referee gates pass and scope is exact.
- [x] Independent reviewer approves executed proof.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
