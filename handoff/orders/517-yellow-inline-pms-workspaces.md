# Order 517 — Yellow inline PMS workspaces

## Objective

Render deterministic Reservations, Guests, Housekeeping, Billing Desk and Rates
requests inside Yellow AI mode using the same governed React workspaces.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-voice-routing.test.ts`
- `handoff/reviews/517-yellow-inline-pms-workspaces.md`

## Required behaviour

1. Each finite local workspace intent renders its existing governed workspace
   inside Yellow without a model call or automatic navigation.
2. The embedded workspace uses its canonical loaders and existing confirmation
   gates; no duplicate fixture or alternate write path is created.
3. Reservation/guest/cashier searches and row interactions remain functional.
4. Mobile layouts remain single-column/compact through the existing responsive
   workspace CSS.

## Exclusions

- No API, database, permission, command payload or state-transition change.

## Verification

- Focused tests, typecheck, production build and hosted desktop/mobile smokes.
