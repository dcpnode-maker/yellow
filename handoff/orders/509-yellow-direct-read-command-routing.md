# Order 509 — Yellow direct read-command routing

## Objective

Make Yellow execute safe, read-only PMS display requests immediately instead of
replying with links or buttons that require the operator to repeat the task
manually. Preserve the existing confirmation gates for all operational writes.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/voice.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-voice-routing.test.ts`
- `handoff/reviews/509-yellow-direct-read-command-routing.md`

## Required behaviour

1. A lane request such as `show arrivals`, `show departures`, or `show in
   house` immediately replaces the active Today content with that governed
   movement grid. Lane intent takes precedence over generic reservation intent.
2. A uniquely named read request immediately opens that reservation detail.
3. Generic read-only workspace requests immediately navigate to Guests,
   Housekeeping, Reservations, Rates, or Finance as appropriate; Yellow must not
   render an `Open workspace` button first.
4. Server-returned navigation remains restricted to the finite local allowlist
   and is followed directly; model prose is never interpreted as a route.
5. Check-in, room assignment, folio opening, posting, settlement and every
   other write retain their visible confirmation gates. A bare `yes` remains
   insufficient without a specific pending proposal.
6. Conversation history and selected language are persisted before navigation.
7. Existing multilingual local intent matching continues to pass.

## Exclusions

- No new database write, schema, API, model tool, or financial operation.
- No claim of native Gemini Live audio.

## Verification

- Focused voice-routing and arrival-conversation tests.
- TypeScript typecheck and production frontend build.
- Public browser smoke for `show arrivals` and a generic read workspace.
