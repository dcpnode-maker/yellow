# Order 546 — check-in guest conversation continuity

## Objective

Keep the accepted conversational guest/sharer workflow available inside the same
live Yellow check-in journey, preserving context before and after confirmation.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-conversational-guest-allocation.test.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-voice-routing.test.ts`
- `handoff/reviews/546-checkin-guest-conversation-continuity.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`
- `handoff/LEDGER.md`

## Required behaviour

1. A named governed check-in journey is also the active reservation for accepted
   Order544 add/remove guest commands.
2. An exact yes confirms a pending guest proposal before it can be interpreted as a
   check-in/folio/room confirmation. With no guest proposal, existing arrival
   confirmation routing is unchanged.
3. Proposal, denial, success, reconciliation and stale-stop cards retain the live
   check-in journey and its server-owned readiness context.
4. A successful guest write invalidates both ordinary reservation and Overwatch
   reservation/readiness queries before the journey is shown as refreshed.
5. No guest command can confirm check-in, assign a room or open a folio; each action
   keeps its own exact proposal and confirmation authority.

## Exclusions

- No new endpoint, domain write, schema, migration, permission, provider, Gemini,
  microphone, Party creation, financial split, room/HK/folio/check-in semantics.

## Verification

- Intentional red source contract, focused and adjacent tests, strict types/build.
- Independent source/conversation review, then non-mutating public check-in proposal
  proof on desktop and 375px.
