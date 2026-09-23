# Order 637 — Today business contribution hierarchy

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/workspaces/TodayGlassDashboard.tsx`
- `frontend/yellow/src/styles.css`
- `tests/order637-today-business-hierarchy.test.ts`
- `handoff/LEDGER.md`

## Problem

The founder clarified that hotel commercial math is simple and should stay visible:
individual reservations contribute room nights and revenue to Market Segment (MS),
many MS roll up to Market Segment Group (MSG), and source/channel/company/product
intersections let operators see where business comes from. The current Today
Business Mix card shows only raw market/source/channel codes, which is useful but
does not demonstrate the MSG → MS hierarchy.

## Acceptance

- Keep the Today screen read-only and fast; no write action runs from the dashboard.
- Reuse existing movement/reservation-board rows. Do not invent a new table or
  duplicate commercial truth.
- Render top contribution cards as MSG → MS with source/channel evidence.
- Preserve unmapped evidence explicitly instead of guessing.
- Add a source test that proves the hierarchy helpers and UI labels are present.
