# Order 626 — Group-block rooming-list drilldown

## Intent

Make the public PMS group-block workbench operationally useful, not just a summary.
For each block, the operator must see which reservations are consuming pickup, their
guest names, status, room type, stay dates and picked-up night count.

## Scope

- `src/contexts/reservations/group-blocks.ts`
- `src/http/operator.ts`
- `frontend/yellow/src/yellow-api.tsx`
- `frontend/yellow/src/workspaces/ReservationWorkspace.tsx`
- `frontend/yellow/src/styles.css`
- `tests/order626-group-block-rooming-list.test.ts`
- `handoff/LEDGER.md`

## Boundaries

- Read-only only.
- No schema migration.
- No direct occupancy writes.
- No group pickup/release/write action yet.
- Reservation links open the existing reservation detail route.

## Acceptance proof

- Focused static test for service/API/UI/CSS coverage.
- Live colleague-readiness probe remains green.
- TypeScript remains green.

