# Order 512 — Unified virtual reservation board

## Objective

Replace the older Reservations list with the same fast, virtualized,
spreadsheet-style grid used for movement views, covering all current, future
and historical reservation states.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/today-workspace.ts`
- focused frontend tests
- `handoff/reviews/512-unified-virtual-reservation-board.md`

## Required behaviour

1. Reservations renders the complete cursor-collected board in one virtualized
   grid and does not mount every row at once.
2. Search covers guest, confirmation, room/type, channel, rate and operational
   state.
3. Advanced filters include operational state, source and room assignment and
   combine using match-all semantics.
4. Advanced deterministic two-level sorting, keyboard row movement and Enter
   to open reservation remain available.
5. Clicking a row or guest opens the full reservation detail; no redundant Open
   button is shown.
6. All-states view labels the first date column as Arrival and retains factual
   status descriptions.
7. Existing due-in/due-out/in-house grids remain unchanged in meaning.
8. Mobile retains horizontal spreadsheet scrolling and compact row density.

## Exclusions

- No reservation, guest, room, folio or financial write.
- No new or inferred reservation attribute.

## Verification

- Helper filter/sort tests, cursor paging tests, typecheck and production build.
- Hosted Reservations smoke confirms total count, virtualization and direct row
  opening.
