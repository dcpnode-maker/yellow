# Order 639 — Front desk operations board

## Scope

- Add a practical public-demo operations board for the first PMS screen.
- Show arrivals, in-house stays, departures, housekeeping status, cashier authority and disabled confirmation-gated actions.
- Make cashier access explicit without requiring a cash drawer for read/preparation work.

## Out of scope

- Posting charges, taking payments, opening cash drawers, issuing fiscal documents or writing journals.
- Editing migrations or production schema.
- Enabling real PMS mutations.

## Acceptance

- `/api/v1/demo/front-desk-board` returns one current-day operating board.
- The board includes useful stats and work queues without clutter.
- Tests prove cashier posting/settlement actions stay disabled, confirmation-gated and role-governed.
