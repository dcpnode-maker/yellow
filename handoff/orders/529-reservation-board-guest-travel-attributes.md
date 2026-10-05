# Order 529 — Reservation board guest and travel attributes

## Objective

Expose factual party-size and movement-travel context in the virtualized
reservation board instead of leaving its Attributes column blank.

## Scope

- `frontend/yellow/src/today-workspace.ts`
- `frontend/yellow/src/App.tsx`
- `tests/yellow-today-workspace.test.ts`
- focused frontend verification and public phone proof
- `handoff/reviews/529-reservation-board-guest-travel-attributes.md`

## Required behaviour

1. Every row displays recorded adult/child counts when present.
2. Arrival boards add recorded arrival mode, carrier/service and pickup status;
   departure boards use recorded departure travel instead.
3. Missing travel remains explicit without inference.
4. Existing virtualization, filtering and navigation remain unchanged.

## Exclusions

- No travel edit, task dispatch, reservation mutation, API, database or schema
  change.
- No inferred party size or transport information.

## Verification

- Intentional failing focused formatter tests before implementation.
- Focused frontend tests, strict TypeScript and production build.
- Public phone proof.
