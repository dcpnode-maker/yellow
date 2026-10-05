# Order 556 — unified reservation-board oracle reconciliation

## Objective

Replace the two disclosed legacy static test oracles that still describe the removed
pre-MovementGrid reservation board with assertions for the currently published shared
manual/Yellow reservation surface.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-reservation-command-surface.test.ts`
- `handoff/reviews/556-unified-reservation-board-oracle-reconciliation.md`
- `handoff/LEDGER.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`

## Required behaviour

1. Preserve the current unified `MovementGrid`; do not restore the removed legacy board.
2. Assert current explicit state semantics, shared typed query, complete governed board
   search fields, virtualization and URL-stable Yellow inline detail.
3. Named Yellow row selection must be proven to set exact reservation ID detail inside
   the retained AI surface; no stale `showOnReservationBoard` redirect oracle remains.
4. Test-only reconciliation: no runtime, API, database or public-app change.

## Verification

- Intentional red is the already-recorded 4 pass/2 fail adjacent run in Review554.
- Corrected command-surface + rich-record suites, Order554 focused/adjacent suites,
  strict frontend/root TypeScript and production build.
