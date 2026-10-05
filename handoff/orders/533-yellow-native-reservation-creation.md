# Order 533 — Yellow-native reservation creation

## Objective

Let an authorized colleague create a reservation entirely inside Yellow Next,
using the existing canonical Party search, server offer and PostgreSQL-authoritative
reservation commit APIs with a visible confirmation gate.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-native-reservation-creation.test.ts`
- focused verification, independent occupancy-path review and public browser proof
- `handoff/reviews/533-yellow-native-reservation-creation.md`

## Required behaviour

1. The Yellow reservation board exposes a mobile-first New reservation action;
   it must not hand off to the classic operator UI.
2. Capture property-local arrival/departure dates, adults, child ages and source.
3. Search canonical Party profiles and require explicit selection by Party ID.
4. Resolve current server offers from `availability:search`; show room/rate/price
   and retain the server's `promise=false` / commit-arbitration truth.
5. Require an unchecked-by-default visible acknowledgement before the direct
   commit. Use one stable idempotency key for retries of the unchanged command.
6. Commit only through `/api/v1/reservations:commit`; never write occupancy from
   the client. On conflict, discard stale offers while preserving the stay/guest.
7. On success, show the server confirmation, refresh the canonical board and
   provide direct access to the created reservation record.
8. Work at 375px without horizontal document overflow and preserve the existing
   Yellow/white design.

## Exclusions

- No database, migration, schema, endpoint, Party-create or rate-policy change.
- No claim that this closes reservation modification/cancel/reinstate/no-show.

## Risk and review

This UI invokes the existing occupancy-changing reservation commit. A non-
implementing agent must inspect the code and personally execute the relevant proof
before public deployment, per PROJECT.md.

## Verification

- Intentional-red then green focused source contract.
- Strict TypeScript, relevant frontend tests and production build.
- Independent reviewer executes source tests and a distinct live API create/replay
  or equivalent isolated proof without using implementer-supplied results.
- Public mobile browser proof of the complete visible flow.
