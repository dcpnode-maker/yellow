# Order 219 — Reservation-detail operational preparation routing

**Status:** BUILT-UNREVIEWED-D582 — implementation and executable gates green; independent product review deferred
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/reservation-detail-operational-preparation`
**Base:** `01f740f` (built-unreviewed Order218)
**Risk tier:** 2 — UI-only composition of existing governed readiness workflows
**Owner:** Codex implementation; independent product review remains deferred by founder build-first direction

## Outcome

From canonical reservation detail, an operator can deliberately open the already
governed check-in or checkout preparation workbench appropriate to current authoritative
status. Navigation itself runs no command and adds no eligibility or mutation authority.

## Fixed contract

- A successfully validated current detail emits exactly one action: `due_in` →
  **Prepare check-in**; `in_house|due_out` → **Prepare checkout**; every other status
  emits none. This presentation mapping is identical to existing
  `applyReservationWorkbenchIntent`; no new status meaning is admitted.
- The action targets only the same canonical `/p/{property}/res/{reservation}` with
  existing exact `?workbench=check-in|checkout`, existing parser, readiness endpoints,
  server permissions and explicit confirmation workflows. Navigation makes no POST and
  cannot bypass readiness or confirmation.
- Before navigation, recheck exact property, routed reservation, validated detail
  reservation id/confirmation/status, detail generation, plain canonical pathname,
  visible connected drawer/content/action and current Reservations view. Stale identity
  is inert.
- Exactly one same-reservation history entry is added. Refresh and Forward reapply the
  existing preparation intent. Back returns to plain detail and restores focus to the
  matching action when still authoritative, otherwise the reservation heading. Close
  and Escape retain existing reservation-detail behavior.
- All server 403/404/409 readiness and command outcomes remain unchanged. No automatic
  check-in/checkout, folio repair, occupancy mutation, room-condition change or
  housekeeping creation occurs.
- The action is at least 44px, Android 48px, wraps at 375px/200% zoom and has visible
  focus, forced-colour and reduced-motion containment across all six appearances.

## Exact scope

- this order and its intentional-red test;
- `src/http/operator/operator.js` and focused `operator.css` styles;
- focused truth-table, stale/history/transport and six-appearance tests plus existing
  Orders 200/203/204/209 and reservation-detail regressions;
- `docs/UI-SPEC.md`, `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`;
- `DECISIONS.log` and `handoff/LEDGER.md`.

No HTML, API/adapter/domain/context, contract/security, schema/migration/seed,
dependency, scope/event or local promotion/deployment file is admitted.

## Pre-registered proof

- **P0 red:** operational-preparation action/helper is absent.
- **P1 truth:** exact status/action truth table, max one semantic action.
- **P2 transport:** exact existing query/parser/readiness/confirmation flows only; no command on navigation.
- **P3 containment:** property/reservation/confirmation/status/path/view/drawer/action/generation mismatches are inert.
- **P4 history:** one entry; refresh/Forward reapply; Back restores plain detail and safe focus.
- **P5 UX:** six appearances, 375px/200% zoom, focus, forced colours and reduced motion.
- **P6 standing:** Orders200/203/204/209 and reservation regressions plus type/boundary/licence/audit/JS/diff/schema/referee green.

## Definition of done

- [x] Intentional red preceded implementation (`50b24a2`).
- [x] Exact authoritative status emits only the matching preparation action.
- [x] Existing readiness/confirmation authority remains unchanged.
- [x] History, focus, six-appearance and accessibility containment is green.
- [x] Standing gates are green and the result is recorded built-unreviewed in D-582.

## Build evidence

- Order219 focused proof: 13 passed, 0 failed, 133 assertions.
- Existing check-in, checkout, Today routing, reservation-detail and vehicle-link
  regressions remained green; the full standing suite passed 530, skipped 629
  environment-gated cases and failed 0 across 1,159 tests / 206 files.
- TypeScript, 82-file import boundaries, 23-package licence policy, audit with zero
  vulnerabilities, JavaScript syntax and diff checks passed.
- Fresh PostgreSQL 16.15 migrations 1–29 and fixtures produced the current 93-table
  schema; the canonical schema matched and the independent invariant referee passed
  11/11. The setup wrapper's obsolete 89-table assertion was not treated as schema
  authority. The disposable stack was removed with zero matching containers, volumes
  or networks retained.
