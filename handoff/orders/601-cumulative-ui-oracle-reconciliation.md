# Order 601 — Cumulative UI-oracle reconciliation

## Objective

Repair two cumulative UI tests whose source locators no longer target the executable
movement-popover and result-state accessibility rules, without changing production
CSS, runtime behavior, or performance budgets.

## Scope

- `tests/yellow-reservation-board-attribute-performance.test.ts`
- `tests/yellow-stateful-neon-bloom.test.ts`

No production, CSS, frontend, dependency, generated-asset, database, or configuration
file is in scope.

## Required behavior

1. Reservation-board hit-target proof asserts the actual movement-popover close,
   input, clear, and done controls meet the 44px minimum rather than searching for an
   obsolete unrelated `form button` literal.
2. The 10,000-row reservation filtering benchmark and all existing commercial/travel
   attribute assertions remain unchanged and green.
3. Stateful-neon reduced-motion proof locates the result-state rule and its own
   subsequent media block, not an earlier ribbon media block, and continues to prove
   animation/transition/transform reset.
4. No assertion is weakened to generic source presence or snapshot-only success.

## Acceptance evidence

- Both focused test files pass with all prior behavioral and benchmark assertions.
- Strict TypeScript and the cumulative suite are rerun; unrelated failures remain
  disclosed.

## Exclusions

- No operator gallery, navigation, motion implementation, Overwatch, stale contract,
  bundle, provenance, temporary-fixture, backend, API, database, or public release
  change.
