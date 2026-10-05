# Order 521 — Yellow inline reservation and checkout

## Objective

Keep uniquely named reservation and departure-readiness requests inside Yellow
AI mode using the existing governed reservation workspace instead of navigating
the operator away.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `tests/yellow-voice-routing.test.ts`
- focused frontend verification and public browser proof
- `handoff/reviews/521-yellow-inline-reservation-checkout.md`

## Required behaviour

1. A unique named checkout request renders current checkout readiness, room,
   folio windows, blockers and the existing visible confirmation gate inline.
2. A unique named reservation read renders the existing reservation workspace
   inline as well.
3. No checkout or other write occurs from the spoken/read request itself.
4. Preserve the existing server-readiness and separate-checkbox requirements
   for any later checkout commit.
5. Keep the view usable on phone and desktop without document overflow.

## Exclusions

- No checkout, reservation, API, database, occupancy, folio or financial logic
  changes.
- No weakening of confirmation or authorization.

## Verification

- Focused routing/static UI tests, strict TypeScript and production build.
- Public named-departure proof showing blockers and disabled checkout inline.
- Phone geometry and reachability proof.
