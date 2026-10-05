# Order 514 — Yellow named checkout preparation

## Objective

Resolve a named checkout command before generic departure intent and directly
open that stay’s live governed checkout-readiness screen.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/voice.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-voice-routing.test.ts`
- `handoff/reviews/514-yellow-named-checkout-preparation.md`

## Required behaviour

1. `prepare checkout for <unique guest/confirmation>` resolves from the complete
   reservation command index before the generic due-out lane matcher.
2. Yellow immediately opens the actual reservation detail and its current
   checkout-readiness view; no intermediate link/button is shown.
3. Ambiguous or missing names do not open any reservation.
4. This command performs no checkout. The existing live readiness, checkbox and
   enabled-state confirmation gate remain the only commit route.
5. Cashier wording still takes precedence when the same named request explicitly
   asks for a folio or bill.

## Exclusions

- No checkout state transition, room release, folio settlement, payment or
  housekeeping-task mutation.

## Verification

- Voice resolver and static confirmation-gate tests, typecheck, production
  build and hosted named due-out command smoke.
