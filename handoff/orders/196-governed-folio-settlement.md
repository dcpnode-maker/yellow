# Order 196 — Governed folio settlement and closure

**Status:** READY — D-531
**Phase:** 5 — Financials
**Branch:** `phase-5/folio-charge-correction-resumed`
**Base:** `caf1998` (independently approved Order195 local UI)
**Risk tier:** 3 — financial state transition and posting race
**Owner:** Codex implementation; independent proof deferred to the Phase-5 gate

## Outcome

An authorized operator can mark one folio window settled only when PostgreSQL proves
its locked balance is exactly zero, then close that settled window. Settlement and
closure never edit or delete journals or posting lines, never create balancing entries,
and never imply checkout, invoice creation, fiscalization or provider settlement.

## Fixed v1 policy

- State is monotonic: `open -> settled -> closed`; there is no reopen action.
- Settlement is a zero-balance state assertion, not a payment operation or journal.
- Each folio window settles independently so Business and Personal invoices can remain
  operationally separate.
- The existing account remains open; account closure, reservation checkout, fiscal
  invoice issue and business-day close are later orders.
- Charging, correction, transfer, deposit application and settlement serialize on the
  same canonical financial row locks. Whoever commits first determines the valid
  state observed by the other command.

## Exact scope

- `src/contexts/financials/settlements.ts`, `src/contexts/financials/index.ts`
- `src/http/operator.ts`, `src/app.ts`
- `src/http/operator/index.html`, `src/http/operator/operator.js`,
  `src/http/operator/operator.css`
- `tests/financial-folio-settlement.integration.test.ts`,
  `tests/financial-folio-settlement.intentional-red.test.ts`,
  `tests/operator-folio-workbench.integration.test.ts`,
  `tests/review-seed.integration.test.ts`, `scripts/seed-review.ts`
- settlement sections only in `docs/CONTRACTS.md`, `docs/EVENTS.md`,
  `docs/STATE-MACHINES.md`, `docs/DOMAIN-MODEL-V1.md` and Phase 5 in `BUILD-PLAN.md`
- this order, its question/review, `DECISIONS.log`, and `handoff/LEDGER.md`

No other file is admitted. There is no migration and `migrations/0001_init.sql` stays
byte-identical.

## Required work

1. Commit an intentional P0 red proof for the absent settlement domain, route and UI.
2. Add a strict settlement service using durable actor-bound idempotency and exact
   tenant/property envelopes. It first validates, then calls `lock_financial_rows`,
   re-reads the locked folio/account and canonical `folio_balance`, and performs one
   guarded state update.
3. `settle` requires exact `open` status, open guest account, exact property ownership
   and balance `0`. `close` requires exact `settled` status and a still-zero balance.
   Replays return the original result; different requests under one key conflict.
4. Emit `folio.settled` or `folio.closed` fact and outbox evidence in the same tenant
   transaction as the state transition. Payload contains identifiers and state only,
   never contact, token or payment data.
5. Expose one no-store operator route with exact `financials.folios:settle` or
   `financials.folios:close` scope plus property grant. Browser bodies cannot supply
   actor, tenant, balance, prior state or authority.
6. Add visible progressive folio controls with confirmation, retained idempotency key,
   stale-identity guard, server refetch and accessible pending/error/success states.
   Every approved appearance keeps its own composition and target sizes.

## Forbidden

- journal/posting UPDATE or DELETE; synthetic balancing or rounding entry
- payment-provider settlement, capture, refund, chargeback, cash or cashier work
- account/reservation closure, checkout, invoice/document/fiscal/tax work
- reopen, forced settlement, non-zero settlement or client-provided balance/state
- migration, new dependency, local promotion, merge, push or public/production deploy

## Pre-registered proof

- **P0 red:** settlement domain, route and UI markers are absent before implementation.
- **P1 state/accounting:** exact zero `open -> settled -> closed`; journals, posting
  lines and balances remain byte-identical; non-zero, wrong state and frozen account
  reject without artifacts.
- **P2 concurrency:** twenty settle contenders converge to one transition/evidence;
  charge-vs-settle and transfer-vs-settle have one coherent winner with no late money
  on a settled folio and no stranded partial effect.
- **P3 authority/isolation:** tenant/property/scope/actor/idempotency attacks fail
  generically; raw app-role mutation outside the service is not introduced.
- **P4 HTTP/browser:** keyboard and pointer settle/close, confirmations, retry, stale
  response suppression and refetch work at 375/768/1020/1440 across six appearances.
- **P5 standing:** financial/referee/type/boundary/licence/audit and full tests pass;
  independent high-risk execution occurs at the required gate.

## Definition of done

- [ ] Intentional red precedes product implementation.
- [ ] Zero-balance monotonic transition is PostgreSQL-lock authoritative.
- [ ] Financial history and balance are unchanged by settlement/closure.
- [ ] Concurrency and authority proofs pass.
- [ ] Authenticated operator controls are usable across six appearances.
- [ ] Standing gates pass; independent gate remains explicit until executed.
