# Order 548 — natural named check-in resolution

## Objective

Make a natural command such as “prepare check-in for Meera Iyer” select the one
current due-in reservation even when the same Party has historical or future stays,
without weakening exact identity or confirmation gates.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/voice.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-voice-routing.test.ts`
- `handoff/reviews/548-natural-named-checkin-resolution.md`
- `handoff/LEDGER.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`

## Required behaviour

1. An explicit check-in command resolves against current `due_in` truth before name
   scoring, using `operationalState` when present and otherwise canonical status.
2. Repeat stays for the same Party outside `due_in` cannot make one current due-in
   name ambiguous.
3. Two current due-ins with the same name remain ambiguous and produce no action;
   exact confirmation can still resolve only an eligible due-in.
4. Ordinary open/expand commands retain their existing all-reservation behaviour,
   and checkout retains its existing due-out/in-house boundary.
5. The result only opens the governed check-in journey. It performs no write and
   does not weaken the separate final confirmation.

## Exclusions

- No API/domain/database/schema/migration/permission/Gemini/microphone/UI styling,
  guest, room, folio, housekeeping or check-in commit change.

## Verification

- Intentional red for repeat-stay name resolution and ambiguity.
- Focused/adjacent tests, strict types and production build.
- Independent non-implementing source review before any public promotion.
