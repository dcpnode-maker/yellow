# Order 526 — Reservation board commercial filters

## Objective

Add explicit room-type and rate-plan filters to Yellow's existing virtualized
reservation movement board so an operator can narrow large arrival, departure,
in-house or all-reservation lists without relying on free-text search.

## Scope

- `frontend/yellow/src/today-workspace.ts`
- `frontend/yellow/src/App.tsx`
- `tests/yellow-today-workspace.test.ts`
- focused frontend verification and public phone proof
- `handoff/reviews/526-reservation-board-commercial-filters.md`

## Required behaviour

1. Advanced filter exposes exact room-type and rate-plan selectors derived from
   the already-loaded governed reservation rows.
2. Room type and rate plan combine with operational state, source, room
   assignment and search using match-all semantics.
3. The active-filter count includes the new selectors and Clear filters resets
   them.
4. The table remains virtualized and contained on phone and landscape widths.

## Exclusions

- No reservation mutation, API, database, schema, fixture or financial change.
- No inference of missing room types or rate plans.
- No new dependency and no change to the procedural Yellow neon field.

## Verification

- Intentional failing focused test before implementation.
- Focused frontend tests, strict TypeScript and production build.
- Public narrow-phone and landscape proof.
