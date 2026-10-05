# Order 515 — reservation board arrival-date context

## Objective

Make the unified past/current/future reservation grid show and sort the same
property-local arrival value with enough date context to distinguish stays.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-reservation-board-pages.test.ts`
- `handoff/reviews/515-reservation-board-arrival-date-context.md`

## Required behaviour

1. The all-state grid's first column uses scheduled arrival when present,
   otherwise `stayFrom`; it must not display `stayTo` under an Arrival heading.
2. All-state rows display property-local date and time.
3. Today-specific arrival/departure grids retain compact time-only display.
4. Sorting remains aligned with the displayed arrival value.

## Exclusions

- No API, reservation, occupancy, financial or state-transition change.

## Verification

- Focused tests, typecheck, production build and hosted all-state grid smoke.
