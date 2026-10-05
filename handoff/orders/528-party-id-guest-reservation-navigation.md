# Order 528 — Party-ID guest/reservation navigation

## Objective

Make the reservation-to-guest-profile journey use the canonical Party ID so
staff always open the correct person's history even when guest names collide.

## Scope

- `frontend/yellow/src/App.tsx`
- `tests/yellow-guest-search-workspace.test.ts`
- focused frontend verification and public phone proof
- `handoff/reviews/528-party-id-guest-reservation-navigation.md`

## Required behaviour

1. Reservation detail consumes each governed guest's Party ID.
2. Selecting a named guest passes Party ID to the guest workspace, never the
   display name as identity.
3. URL-requested guest selection resolves an exact Party ID before any display
   name fallback.
4. Guest profile history continues to use the existing Party-ID-scoped board
   read and stay links.

## Exclusions

- No Party merge, profile edit, reservation mutation, API, database or schema
  change.
- No inference when the server does not return a matching Party profile.

## Verification

- Intentional failing focused test before implementation.
- Focused frontend tests, strict TypeScript and production build.
- Public reservation-to-profile phone proof.
