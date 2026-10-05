# Order 638 — Group reservation manager read model

## Scope

- Expand the public demo group-block slice into a group reservation manager read model.
- Show block lifecycle, pickup, rooming-list, wash/release and status-change actions with operational purpose.
- Keep every action confirmation-gated and disabled in the public shell.

## Out of scope

- Writing reservations, occupancy, allotment, journals, documents, payments, statutory records or outbox rows.
- Editing migrations or production schema.
- Implementing live rooming-list import.

## Acceptance

- `/api/v1/demo/group-blocks/manager` returns group reservation manager cards.
- The definite MICE block surfaces cutoff/release risk, rooming-list gap and pickup/import/wash/status action definitions.
- Tests prove all manager actions require confirmation and remain disabled.
