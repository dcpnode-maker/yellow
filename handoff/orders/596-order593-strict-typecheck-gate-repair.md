# Order 596 — Order 593 strict typecheck gate repair

## Objective

Restore the repository-wide `tsc --noEmit` gate required by Order 593 by repairing
three test-only typing/configuration defects already present in its isolated candidate.
This order changes no product behavior, production source, schema, authority, fixture,
or runtime configuration.

## Source authority

- Work only in `D:\Yellow\temp\order593-departure-coordination-source`.
- Order 593 remains the product order and retains its independent-review requirement.

## Scope

- `tests/india-native-fiscal-credit-note-list.test.ts`
- `tests/yellow-cashier-bill-window-allocation.test.ts`
- `tests/yellow-voice-bill-window-allocation.test.ts`

## Required result

1. Preserve every existing assertion and runtime behavior.
2. Avoid mutating a readonly inferred object in the hostile-input loop.
3. Make the two intentional Bun runtime imports of `App.tsx` explicit to the root
   TypeScript checker without changing frontend compilation or repository tsconfig.
4. `bunx tsc --noEmit` and the three focused tests pass.

## Exclusions

- No production, frontend, migration, fixture, dependency, tsconfig, governance,
  deployment, merge, push, or public-release change.
