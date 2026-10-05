# Order 617 — cashier search bounded read workbench

## Objective

Continue from the live Order611 source and make the cashier search screen safer and
more useful for colleague review by bounding visible results and surfacing the
canonical evidence used to find a reservation or folio.

## Scope

- `frontend/yellow/src/workspaces/FinanceWorkspace.tsx`
- `frontend/yellow/src/styles.css`
- focused source tests
- generated Yellow Next public assets and promotion evidence

## Required behavior

- Search accepts guest, confirmation, room, source/channel/market and exact folio
  references without adding any financial write authority.
- Reservation-board results render in a bounded page, not an unbounded list.
- Page navigation uses stable opaque cursor tokens rather than exposing row offsets
  as the user-facing control state.
- Each result shows the evidence fields that made it useful for cashier lookup.
- Existing posting, bill-window transfer, direct-billing, deposit and folio-opening
  controls remain confirmation-gated and unchanged.

## Out of scope

- New SQL, schema, permissions, financial mutations, settlement/payment/fiscal changes,
  external provider changes, or PostgreSQL cutover.

