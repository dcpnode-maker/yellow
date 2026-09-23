# Order 631 — Today glass ADR and RevPAR

## Intent

Make the public demo's first screen surface the simple hotel math already returned
by the server-owned operating-performance API: occupancy, room nights, available
rooms, room revenue, ADR and RevPAR.

## Scope

- `frontend/yellow/src/workspaces/TodayGlassDashboard.tsx`
- `frontend/yellow/src/App.tsx`
- `tests/order631-today-glass-adr-revpar.test.ts`
- `handoff/LEDGER.md`

## Non-goals

- No schema changes.
- No new KPI formulas in the client.
- No write workflows or finance changes.

## Acceptance

- The mounted Today glass dashboard accepts and displays ADR and RevPAR from the
  existing operating-performance payload.
- A focused source test proves the wired props and displayed labels.
- Typecheck passes.
