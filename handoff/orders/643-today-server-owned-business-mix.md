# Order 643 — Today server-owned business mix

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/yellow-api.tsx`
- `tests/order643-today-server-owned-business-mix.test.ts`
- `handoff/LEDGER.md`

## Problem

The public demo now has a server-owned commercial contribution read model, but the
Today glass dashboard still derives its Business Mix cards from currently mounted
movement rows and a frontend mapping table. For speed, consistency and PMS audit
clarity, the first screen should prefer the server contribution API.

## Acceptance

- Add frontend types and loader for `/api/v1/properties/:property/commercial-contribution`.
- Today dashboard uses server-owned contribution groups/segments/sources when
  available.
- Keep a conservative movement-row fallback for temporary API unavailability.
- No write action, migration, finance change, occupancy mutation or external call.
