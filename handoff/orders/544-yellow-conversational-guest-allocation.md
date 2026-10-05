# Order 544 — Yellow conversational guest allocation

## Objective

Let staff add or remove an existing guest occurrence from the live inline
reservation by natural Yellow conversation, with an exact visible proposal and a
separate confirmation-gated canonical write.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/voice.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-voice-routing.test.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-conversational-guest-allocation.test.ts`
- `handoff/reviews/544-yellow-conversational-guest-allocation.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`
- `handoff/LEDGER.md`

## Required behaviour

1. While one reservation is live inside Yellow, natural commands can add an
   existing canonical Party as `accompanying` or `sharer`, or remove one uniquely
   named non-primary occurrence. Speech never creates or edits Party identity.
2. Search must fail closed on zero, multiple, inactive, already-attached, or primary
   matches. Removal must fail closed on zero, multiple, or primary matches.
3. Sharer commands require canonical two-decimal new-share and primary-share values;
   all retained sharers remain explicit and the final integer-basis-point total must
   equal exactly 100.00.
4. Yellow renders the exact reservation, primary and complete proposed allocation,
   says no change has occurred, and asks for a separate narrow yes/no confirmation.
5. Confirmation re-fetches canonical guest truth. Any stale baseline stops without
   writing. The existing governed guest replacement endpoint is the only write
   authority and the unchanged proposal keeps one idempotency key.
6. Success is claimed only after a canonical refetch exactly matches; uncertain
   success reconciles by refetch. Reservation detail and board caches are invalidated.
7. A confirmed write owns the shared reservation mutation lock, stops recognition,
   and rejects competing assistant or UI actions until canonical reconciliation.
8. Property/reservation change, cancellation, or a new proposal invalidates old
   consent. Generic yes/no without one current proposal never writes.

## Exclusions

- No Party creation/identity editing, automatic profile merge, financial split,
  folio routing, invoice ownership, schema, migration, permission, endpoint, event,
  provider, Gemini, microphone, neon or housekeeping change.
- No unconfirmed write and no interpretation of interim speech as confirmation.

## Risk and review

This exposes an existing audited reservation mutation through Yellow. A different
non-implementing agent must inspect final bytes and personally execute bounded parser,
stale-baseline, confirmation, replay/reconciliation, and existing canonical API/DB
evidence before promotion.

## Verification

- Intentional failing frontend contract before implementation.
- Focused and adjacent frontend suites, strict root/frontend TypeScript, production
  Vite build.
- Independent review, then public desktop and 375px conversational browser proof.
