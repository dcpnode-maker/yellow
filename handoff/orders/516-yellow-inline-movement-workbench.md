# Order 516 — Yellow inline movement workbench

## Objective

Render arrivals, departures and in-house requests as live interactive data
inside Yellow AI mode instead of navigating the operator to another page.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-voice-routing.test.ts`
- `handoff/reviews/516-yellow-inline-movement-workbench.md`

## Required behaviour

1. A local movement request renders its complete current lane inside Yellow.
2. The inline result reuses the virtualized searchable/filterable/sortable grid;
   it must not create a second data source or truncate the lane.
3. Clicking or pressing Enter on an inline row opens the actual reservation.
4. The request does not navigate before the operator selects a record.
5. The result remains usable on mobile through the existing compact grid.
6. No operational write is introduced.

## Exclusions

- No reservation, occupancy, housekeeping, financial or database mutation.
- No model call for deterministic movement reads.

## Verification

- Focused frontend tests, typecheck, production build and hosted browser smoke.
