# Order 223 — Today in-house checkout preparation

**Status:** BUILT-UNREVIEWED-D590
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/today-in-house-checkout-preparation`
**Base:** `a6053f7` (built-unreviewed Order222)
**Risk tier:** 2 — UI-only routing into existing governed checkout preparation
**Owner:** Codex implementation; independent product review remains deferred by founder build-first direction

## Outcome

An exact in-house row in the exact Today in-house lane exposes **Prepare checkout**
and opens the already-governed checkout-readiness workbench. The operator no longer
has to open plain reservation detail before beginning an otherwise supported journey.

## Fixed contract

- Extend only the existing pure Today lane/status truth table: exact
  `in_house + in_house` returns the existing `{ workbench: "checkout", label:
  "Prepare checkout" }` presentation action.
- Exact due-in/check-in and due-out/checkout mappings remain byte-equivalent.
  Every mismatched or unknown lane/status pair remains inert.
- Reuse the existing semantic `.today-operational-action`, canonical reservation
  route, strict workbench parser, one-entry history, stale guards and Today return
  focus. No second route, control family or appearance treatment is added.
- Opening is navigation only. Existing authoritative reservation detail and checkout
  readiness refetch, fixed blockers and explicit checkout confirmation remain
  mandatory before the existing command can run.
- Travel, room, folio, balance, occupancy, housekeeping or inferred readiness truth
  is never consulted to create the action.

## Exact scope

- this order and its intentional-red/focused routing tests;
- `src/http/operator/operator.js`;
- only truly superseded Today truth-table expectations in existing Order209 tests;
- the Today-routing section of `docs/UI-SPEC.md`;
- Phase-6 entries in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`;
- `DECISIONS.log` and `handoff/LEDGER.md`.

No HTML, CSS, API/adapter/domain/context, command, permission, financial, occupancy,
schema/migration/seed, dependency, scope/event, local promotion/deployment file is admitted.

## Pre-registered proof

- **P0 red:** `todayOperationalAction("in_house", "in_house")` is currently null.
- **P1 routing:** all three exact mappings pass and the complete mismatch matrix is null.
- **P2 composition:** rendering reuses the existing action, route, parser, history and focus.
- **P3 authority:** navigation contains no mutation and checkout readiness/confirmation remain mandatory.
- **P4 standing:** Today, reservation-detail, checkout, type, boundary, licence, audit,
  JavaScript, diff and full repository gates remain green.

## Definition of done

- [x] Intentional red preceded implementation.
- [x] Exact in-house row receives only the existing checkout-preparation action.
- [x] All mismatches remain inert and no authority is inferred.
- [x] Focused and standing gates are green and result is recorded built-unreviewed.

## Builder evidence

- Focused Today/reservation-detail/checkout journey: `64 passed, 0 failed`, 932 assertions.
- Standing suite: `581 passed, 629 skipped, 0 failed`, 6,389 assertions across
  1,210 tests in 218 files.
- Typecheck, 82 import boundaries, 23 dependency licences, audit with zero known
  vulnerabilities, JavaScript syntax and diff checks are green.
- The diff changes no TypeScript server/API/domain/database/schema/migration/seed/
  dependency authority, preserving the exact inherited schema/referee evidence.
  Independent product review remains deferred by founder build-first direction.
