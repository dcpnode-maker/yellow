# Order 510 — Yellow complete reservation command index

## Objective

Allow Yellow to resolve a named reservation or guest across the property’s
complete governed reservation board, including current, future and historical
stays, instead of searching only today’s three movement lanes.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-voice-routing.test.ts`
- `handoff/reviews/510-yellow-complete-reservation-command-index.md`

## Required behaviour

1. Named voice/text commands search the complete cursor-collected reservation
   board for the selected property.
2. If the index has not loaded when the command arrives, Yellow waits for or
   refetches the governed index before resolving the name.
3. Today’s lanes remain a fail-closed fallback only if the complete index is
   unavailable.
4. Unique-name and confirmation-number rules remain unchanged; ambiguous names
   must not open or mutate a reservation.
5. Read-only commands open reservation detail directly. Check-in and cashier
   commands retain their existing governed workbenches and confirmation gates.

## Exclusions

- No fuzzy guessing across ambiguous guests.
- No database, API, reservation-state or financial write change.

## Verification

- Focused voice-routing, paging and Today tests.
- TypeScript typecheck and production frontend build.
- Hosted browser check with a reservation outside today’s active lane set when
  one exists in the published governed board.
