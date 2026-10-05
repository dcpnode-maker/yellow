# Order 539 — Yellow reservation operational details

## Objective

Let an authorized colleague edit the existing governed reservation operational
fields—notes, ETA, ETD, market, source and origin—inside the Yellow reservation
record with exact-before compare-and-set, explicit confirmation, stable retry
identity and canonical refresh.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-reservation-operational-details.test.ts`
- focused verification, independent state-transition review and public browser proof
- `handoff/reviews/539-yellow-reservation-operational-details.md`

## Required behaviour

1. Show editing only for server-reported modifiable states: `reserved`, `due_in`,
   `in_house`, `due_out`.
2. Seed all six inputs from canonical detail and send only changed fields, with
   the exact original value in `expected` and edited value in `changes`.
3. Preserve the existing PATCH endpoint, Bearer session and stable idempotency
   identity for an unchanged retry; no new write path or local-only truth.
4. Bound notes to 4,000 characters and codes to the existing server contract;
   ETA/ETD use explicit timezone-bearing time text and may be cleared.
5. Require a separate unchecked confirmation naming the reservation and list
   changed fields before the command becomes available.
6. Share the existing lifecycle/check-in/checkout/voice shell lock. On an
   uncertain response, refresh canonical detail and claim success only when all
   submitted fields equal the requested normalized values.
7. Render actionable conflict/error feedback and refreshed history; never infer
   success from the browser state.
8. Work at 375px without document overflow or fixed-control interception.

## Exclusions

- No stay-date, room, rate, guest/sharer, policy, state, financial, schema,
  permission, endpoint or event change.
- No no-show or claim of complete reservation editing / whole-PMS completion.

## Risk and review

This is an audited reservation state change using an existing canonical command.
A non-implementing reviewer must inspect the final bytes and personally execute a
bounded modify + identical replay + conflict/no-extra-write proof on one dedicated
fictional future reservation. Exact fact/outbox/idempotency evidence and unchanged
occupancy/financial fingerprints are required before public deployment.

## Verification

- Intentional red, then focused contract green.
- Strict frontend/root TypeScript, adjacent frontend tests and Vite build.
- Independent reviewer-owned canonical API/DB proof.
- Root non-mutating 375px visible edit/review proof before promotion.
