# Order 198 — Governed direct-billing receivable transfer

**Status:** BUILT-UNREVIEWED-D538 — implementation and builder proof complete; independent Phase-5 gate retained
**Phase:** 5 — Financials
**Branch:** `phase-5/governed-receivable-transfer`
**Base:** `10bef0515870` (built-unreviewed Order197)
**Risk tier:** 3 — immutable money movement, shared credit authority and settlement interaction
**Owner:** Codex implementation; independent proof retained for the Phase-5 gate

## Outcome

Authorized staff can transfer the exact locked positive balance of one open guest
folio window to one exact open, party-specific company or travel-agent receivable
account in the same tenant, property and currency. One balanced immutable transfer
journal leaves the guest folio at exact zero so Order196 settlement may then proceed.

## Re-authorized fixed policy

This order consumes Question-140-E and D-344 unchanged:

- Direct billing targets only an exact open party-specific company or travel-agent
  receivable account in the same tenant/property/currency. Generic `ar_control` is
  never a guest-debt target.
- `credit_limit_minor = NULL` means no direct-billing authority, not unlimited credit.
- Exposure derives from immutable postings under deterministic financial locks.
- Within-limit transfer needs no monetary approval. Over-limit transfer requires a
  fresh different-user, one-use approval bound to exact party, account, folio, amount,
  exposure before, limit and projected exposure.
- A folio transfers only its exact current positive balance; negative/zero balances do
  not silently move or write off.
- This creates no AR invoice, allocation, aging, statement, duplicate corporate ledger,
  provider settlement, checkout, document, tax or fiscal artifact.

## Natural-solution boundary

Reuse `party_role`, party-owned `account(role='company')`, `folio`, `journal`,
`posting_line`, `approval_request`, `folio_balance`, `lock_financial_rows`, facts,
outbox and durable idempotency. Do not add an AR-balance table. Migration0025 may add
nullable tenant-coherent `journal.approval_request_id`, its one-use partial uniqueness,
and one exact owner-mediated receivable-transfer capability. Public table/RLS counts
remain 93/83.

## Exact scope

- `handoff/orders/198-governed-direct-billing-receivable-transfer.md`
- `migrations/0025_governed_receivable_transfer.sql`
- `src/contexts/financials/receivables.ts`, `src/contexts/financials/index.ts`
- `src/http/operator.ts`, `src/app.ts`, `src/server.ts`
- `src/http/operator/index.html`, `src/http/operator/operator.js`,
  `src/http/operator/operator.css`
- `scripts/seed-review.ts`
- `tests/financial-receivable-transfers.intentional-red.test.ts`,
  `tests/financial-receivable-transfers.integration.test.ts`,
  `tests/operator-receivables-workbench.integration.test.ts`,
  `tests/operator-folio-workbench.integration.test.ts`,
  `tests/review-seed.integration.test.ts`, `tests/migrate.integration.test.ts`,
  `tests/database-acceptance.integration.test.ts`,
  `tests/runtime-dml-authority.integration.test.ts`,
  `tests/security-definer-containment.integration.test.ts`,
  `tests/schema/expected.sql`
- receivable-only sections in `docs/CONTRACTS.md`, `docs/EVENTS.md`,
  `docs/STATE-MACHINES.md`, `docs/DOMAIN-MODEL-V1.md`, Phase5 only in
  `BUILD-PLAN.md` and `handoff/PHASE-5-PLAN.md`
- this order, its question if needed, `DECISIONS.log`, and `handoff/LEDGER.md`

No other file is admitted. `migrations/0001_init.sql` remains byte-identical.

## Required work

1. Commit intentional P0 red proving migration, service, routes and visible workbench
   are absent before implementation.
2. Add the exact bounded journal approval lineage and owner-mediated receivable
   transfer capability without broad journal or posting mutation authority.
3. `ReceivableService` owns strict exact-shape input, server audit envelopes,
   actor-bound idempotency, locks, current exposure/limit derivation, balanced posting,
   facts/outbox and one-use approval consumption in one transaction.
4. Add `financials.receivables:read`, `financials.receivables:transfer` and
   `financials.receivables:approve` behind exact property grants. Browser input cannot
   supply money, exposure, limit, currency, party role, account status, actor, tenant,
   property or approval evidence.
5. Add no-store server-owned preview, approval request/decision and transfer routes
   plus a visible folio direct-billing workflow with confirmation, retained retry keys,
   authoritative refetch, stale guards, keyboard/pointer access and all six appearances.
6. Extend deterministic review data with exact company and travel-agent parties,
   roles and receivable accounts but no transfer journal, AR invoice or allocation.

## Forbidden

- generic `ar_control` debt, caller amount/exposure/limit/currency/authority
- posting/journal UPDATE or DELETE, partial or negative/zero transfer, write-off
- fake AR balance/invoice/allocation/aging/statement, GL export or accounting provider
- payment/refund/cashier/deposit/trust/checkout/document/tax/fiscal/day-close behavior
- local promotion, second local, merge, push, public or production deployment

## Pre-registered proof

- **P0 red:** migration/service/routes/UI markers are absent before implementation.
- **P1 schema/authority:** fresh migrations1–25 remain93 tables/83 policies; exact
  journal lineage/FK/index/capability ACLs exist while raw/PUBLIC/runtime-login and
  cross-tenant mutation fail.
- **P2 economics:** one positive balance creates exactly two sign-opposed lines,
  increases receivable exposure exactly, leaves guest folio zero, then Order196
  settlement succeeds; no forbidden artifact appears.
- **P3 credit policy:** null limit/frozen/wrong role/tenant/property/currency/stale
  preview fail; within-limit succeeds; over-limit requires exact different-user
  approval.
- **P4 concurrency:** same-key convergence, shared-limit arbitration, one-use approval,
  charge/transfer/settlement arbitration and publisher rollback remain coherent.
- **P5 HTTP/browser:** exact scopes/grants, concealment, server preview, retry/refetch,
  stale suppression and accessible six-appearance workflow pass.
- **P6 standing:** financial/payment/deposit/settlement/cashier, migration/acceptance/
  runtime/definer/schema, type/boundary/licence/audit/full and referee11/11 pass.

## Definition of done

- [x] Intentional red precedes product implementation.
- [x] Exact transfer economics, exposure and approval authority are executable.
- [x] No fake AR ledger or forbidden financial artifact enters the slice.
- [x] Operator workflow and all registered builder gates pass.
- [x] Built result is recorded without claiming checkout, Phase5 or app completion.
