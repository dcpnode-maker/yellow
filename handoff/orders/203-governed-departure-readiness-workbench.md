# Order 203 — Governed departure-readiness workbench

**Status:** BUILT-UNREVIEWED-D550 — implementation and executable gates green; independent proof deferred
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-departure-readiness-workbench`
**Base:** `c3d48a3` (built-unreviewed Order202)
**Risk tier:** 2 — read-only reservation, occupancy and financial readiness composition
**Owner:** Codex implementation; independent review deferred under founder build-first direction

## Outcome

An authorized operator can open one reservation in the active property and see one
server-owned, read-only departure-readiness snapshot: reservation state, the exact
current in-house segment, its one active physical room, its matching exclusive
reservation occupancy, every reservation folio window with canonical balance, and a
fixed ordered blocker list. The workbench links staff to existing folio resolution
controls but performs no checkout or mutation.

## Fixed readiness policy

- Reservation status must be `in_house` or `due_out`.
- Exactly one segment for the reservation is `in_house`.
- That segment resolves through its assigned sellable unit to exactly one active
  physical space, and exactly one matching `slot_kind='segment'`, exclusive
  occupancy exists with `slot_ref` equal to that segment id, the same space, and the
  exact segment period.
- At least one folio window exists for the reservation. Every window must be
  `settled` or `closed` and its canonical `COALESCE(folio_balance,0)` must equal zero.
  An open-but-zero window is deliberately blocked; the existing settlement command
  owns the transition.
- Blockers are server-derived in this fixed order:
  `reservation_not_departure_state`, `current_segment_missing_or_ambiguous`,
  `physical_room_missing_or_ambiguous`, `occupancy_missing_or_ambiguous`,
  `folio_window_missing`, `folio_window_unsettled`, `folio_window_nonzero`.
- `ready=true` only when no blocker exists. This is advisory read evidence; a later
  checkout command must lock and revalidate every predicate.

## Exact scope

- `handoff/orders/203-governed-departure-readiness-workbench.md`
- `src/contexts/stay-operations/checkout-readiness.ts`,
  `src/contexts/stay-operations/index.ts`
- minimal composition in `src/app.ts`, `src/server.ts`, `src/http/operator.ts`
- `src/http/operator/index.html`, `src/http/operator/operator.js`,
  `src/http/operator/operator.css`
- `scripts/seed-review.ts`
- `tests/stay-checkout-readiness.intentional-red.test.ts`,
  `tests/stay-checkout-readiness.integration.test.ts`,
  `tests/operator-checkout-readiness-workbench.integration.test.ts`, and focused
  additions to `tests/review-seed.integration.test.ts`
- stay-operations/departure-readiness-only sections in `docs/CONTRACTS.md`,
  `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`, `docs/UI-SPEC.md`
- Phase-6 only in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`
- this order, a question only if executable proof requires scope correction,
  `DECISIONS.log`, and `handoff/LEDGER.md`

No migration, dependency, table, state, event, command or write authority is admitted.
`migrations/0001_init.sql` and every migration remain byte-identical.

## Required work

1. Commit P0 intentional red before implementation.
2. Add a deeply frozen `CheckoutReadinessService` that validates UUID authority and
   returns the complete result from one tenant transaction and one PostgreSQL snapshot
   query. It exports no raw database handle and performs no browser arithmetic.
3. Add exact no-store GET
   `/api/v1/properties/:property/reservations/:reservation/checkout-readiness` behind
   `stay-operations.checkout:read` and the exact property grant. Malformed, foreign or
   concealed targets return the existing bounded error shape without revealing PII.
4. Add a reservation-detail Departure workbench with blocker explanations, exact
   window status/balance, links to existing Folio controls, manual refresh/retry,
   deep-link/focus/keyboard support, stale property/reservation/request guards,
   reduced motion and all existing appearances. It must never imply checkout occurred.
5. Extend the deterministic review seed with one ready in-house departure example by
   reusing the isolated Order202 reservation and adding only its canonical open guest
   account plus settled zero-balance folio prerequisite. No posting, journal, payment,
   checkout, fact, outbox or occupancy mutation is created.

## Forbidden

- checkout button/command, reservation or segment transition, occupancy trim/release
- folio settlement/closure, balance repair, AR transfer, journal/posting/payment change
- account close, invoice/document/tax/fiscal/day/statutory/key mutation
- new blocker vocabulary, alerts, timers, polling, browser storage or client authority
- migration, dependency, local promotion, second local, merge, push or public/production deployment

## Pre-registered proof

- **P0 red:** service, route, workbench and exact scope markers are absent first.
- **P1 exact ready:** eligible reservation returns one segment/room/occupancy, all
  windows settled/closed zero, no blockers and `ready=true`.
- **P2 blockers:** every fixed blocker is exercised independently; multiple blockers
  preserve fixed order and no empty folio family passes vacuously.
- **P3 snapshot/read-only:** a real concurrent charge/settlement race yields one
  coherent snapshot; reservation/segment/occupancy/folio/account/journal/posting/fact/
  outbox/idempotency bytes and counts are unchanged by every read.
- **P4 hostile boundaries:** malformed and foreign tenant/property/actor/reservation
  paths conceal and write nothing.
- **P5 operator/seed:** no-store exact scope, stale guards, refresh/retry, deep-link,
  focus, keyboard, responsive/reduced-motion/appearance behavior and deterministic
  ready fixture/reseed are green.
- **P6 standing:** type/boundary/licence/audit/JS/diff/full suite and fresh referee11/11 remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact readiness and every blocker are server-owned and executable.
- [x] Read and races are coherent and byte-for-byte mutation-free.
- [x] Human Departure workbench and deterministic ready fixture are usable.
- [x] Result is recorded built-unreviewed without claiming checkout/Phase6/app completion.
