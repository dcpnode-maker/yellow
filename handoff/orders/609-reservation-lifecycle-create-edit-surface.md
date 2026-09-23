# Order 609 — reservation lifecycle create/edit surface

## Objective

Complete the bounded React and Overwatch surfaces for creating and editing a
reservation through existing canonical Party, availability, rate, policy and
reservation services. Ask for missing data, preserve quoted authority, require the
existing confirmations and reconcile the returned reservation before success.

## Source authority and sequence

- Begin only after Order605 is closed.
- Create `D:\Yellow\temp\order609-four-day-sprint-source` as a byte-for-byte copy of
  `D:\Yellow\runtime\order605-344ab3485bf4a9da3d27ffca4cabbce75c36151b-source`.
- Order610 continues only from the independently reviewed Order609 candidate.

## Scope

- existing Yellow React reservation workspace and typed API client files identified
  by a verified preflight;
- existing Overwatch platform intent/operation files needed for parity;
- focused frontend/HTTP tests and generated frontend assets;
- this order and its review.

The implementer must freeze the exact closed file list in the review request before
the first product edit. A required file outside that list stops into a question.

## Required behavior

1. Manual and Overwatch paths call existing canonical commands; no browser-side
   availability, price, policy, identity or state authority is created.
2. Party selection uses canonical IDs and exposes duplicate evidence without
   automatically merging or guessing identity.
3. Create/edit proposals show property, dates, guests, room/rate, price/policy change
   evidence and every missing required field before confirmation.
4. Mutation requires a separate finite confirmation, stable idempotency key and
   current preflight. Cancel/no leaves no write.
5. Success is shown only after an authoritative reservation reread matches the
   receipt. Timeout/unknown result recovers by the same key rather than resubmitting.
6. Stale property/reservation/quote responses cannot repaint the active workspace.
7. The surface is keyboard/touch usable without horizontal overflow at 240, 375 and
   1440 CSS pixels; unsupported options remain visibly disabled.

## Forbidden

No migration/schema/seed/permission/new domain command, direct SQL, occupancy write,
financial/fiscal/payment action, provider call, public deployment, dependency,
optimistic success, name-based identity, automatic confirmation, merge or push.

## Acceptance

- focused source and mounted HTTP tests cover create/edit success, missing fields,
  duplicate Party, changed quote/policy, stale response, replay and unknown outcome;
- strict TypeScript, boundaries and frontend build pass;
- actual browser proof at 240/375/1440 with a mutation guard;
- independent review checks the existing command boundary and personally executes
  the proof before Order610 starts.

