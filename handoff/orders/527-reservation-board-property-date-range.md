# Order 527 — Reservation board property-local date range

## Objective

Add an explicit property-local arrival/departure date range to the existing
virtualized reservation board.

## Scope

- `frontend/yellow/src/today-workspace.ts`
- `frontend/yellow/src/App.tsx`
- `tests/yellow-today-workspace.test.ts`
- focused frontend verification and public phone proof
- `handoff/reviews/527-reservation-board-property-date-range.md`

## Required behaviour

1. Advanced filter exposes From and To dates named for the board's movement
   context (arrival or departure).
2. Date comparisons use the property's timezone, not the browser timezone.
3. Boundaries are inclusive and combine with every existing match-all rule.
4. Active-filter count and Clear filters include both date values.

## Exclusions

- No reservation mutation, API, database, schema, fixture or financial change.
- No inferred movement timestamp: arrival uses scheduled arrival/stay start and
  departure uses stay end, matching the existing table authority.

## Verification

- Intentional failing timezone-boundary test before implementation.
- Focused frontend tests, strict TypeScript and production build.
- Public phone and landscape proof.
