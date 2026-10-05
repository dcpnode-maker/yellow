# Order 550 — conversational arrival cleaning-task preparation

## Objective

Let Yellow turn an assigned dirty/pickup arrival blocker into one governed,
attendant-specific housekeeping-task proposal inside the same live check-in journey,
then create it only after separate spoken confirmation.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/voice.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-checkin-cleaning-conversation.test.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-voice-routing.test.ts`
- `handoff/reviews/550-conversational-arrival-cleaning-task.md`
- `handoff/LEDGER.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`

## Required behaviour

1. Exact `dirty_room_override_unauthorized` in the active check-in journey loads the
   existing governed arrival-cleaning candidate; Yellow never infers or edits room
   condition.
2. “Prepare check-in” reports an existing actionable task, missing create authority,
   or asks for an exact staff identity. It does not merely return a generic blocker.
3. “Assign cleaning to <staff name or Party ID>” resolves exactly one active Party
   carrying the `staff` role; inactive, non-staff, missing and ambiguous identity
   fail closed.
4. Yellow displays the exact reservation, room, room condition, due time and selected
   attendant before accepting a separately spoken narrow yes/no.
5. Confirmation re-fetches the authoritative candidate. Changed candidate truth
   stops and refreshes; an existing task reconciles without duplicate POST; otherwise
   one stable idempotency key calls only the existing governed create endpoint.
6. Success refreshes candidate, reservation, readiness and Today/housekeeping views,
   retains the check-in journey, and states that physical cleaning/inspection is
   still owned by Housekeeping.

## Exclusions

- No task lifecycle transition, automatic physical completion, room-condition edit,
  check-in commit, room assignment, folio action, database/schema/migration/
  permission/provider change.

## Verification

- Intentional red source/parser contract.
- Controlled conversation proof for ambiguity, denial, stale truth, existing-task
  convergence, unchanged retry and success refresh.
- Focused/adjacent tests, strict types and production build.
- Independent non-implementing review before any public promotion.
