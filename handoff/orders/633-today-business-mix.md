# Order 633 — Today business mix surface

## Intent

Make the public demo visibly reflect the founder's PMS source hierarchy on the
first screen: market segment/source/channel contribution should be visible without
opening every reservation.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/workspaces/TodayGlassDashboard.tsx`
- `frontend/yellow/src/styles.css`
- `tests/order633-today-business-mix.test.ts`
- `tests/order611-today-glass-dashboard.test.ts`
- `handoff/LEDGER.md`

## Non-goals

- No schema changes.
- No revenue allocation formulas in the client.
- No write workflows.

## Acceptance

- The Today glass dashboard receives and renders a read-only business mix list.
- The list is derived from already-loaded movement rows and uses market/source/channel
  codes returned by the reservation-board API.
- Focused source test, typecheck and public demo probes pass.
