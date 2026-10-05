# Order 657 — Governed group pickup command

## Intent

Move the public colleague demo closer to a complete PMS by proving a real,
confirmation-gated group pickup workflow. The command converts one room from the
fixed `MEHRA-WED` block into a reservation linked to the block, without writing
occupancy, folio, finance, payment, fiscal, statutory, or external rails.

## Scope

- Add a deterministic demo group pickup fixture extension for `MEHRA-WED`:
  - self-contained tenant/property prerequisites;
  - one demo guest party;
  - one demo unit type and rate plan;
  - one `block_allotment` row for the pickup date/unit type.
- Add a governed route:
  - `POST /api/v1/demo/governed/group-block/pickup`
  - exact phrase: `CONFIRM YELLOW OPERATION`
  - fixed block: `MEHRA-WED`
  - fixed date: `2026-10-03`
  - fixed unit type: `DLX`
  - fixed quantity: `1`
- In one tenant-scoped transaction:
  - verify the block is `definite`;
  - verify picked-up reservations for that block/date/unit type remain below allotment;
  - insert one `reservation` linked to the group;
  - insert one `reservation_segment`;
  - write one `group.pickup_created` outbox event.
- Replay must be non-mutating:
  - no second reservation;
  - no second segment;
  - no second event;
  - no config/allotment row update churn.
- Update demo proof/readiness/share/action-safety surfaces from six to seven governed mutation families.
- Add focused tests, clean PostgreSQL proof, and independent review.

## Out of scope

- No occupancy claim, room assignment, cashier, folio, journal, payment, document,
  statutory, fiscal, channel, or external API writes.
- No multi-room pickup, multi-date pickup, rooming-list CSV import, wash/release
  mutation, or full group reservation UI rewrite.
- No schema migration.

## Proof required

- Focused Bun tests pass.
- `bun run typecheck` passes.
- `bun run boundaries` passes.
- `.\setup.ps1 -DbOnly` prints `11 passed, 0 failed`.
- Independent reviewer personally proves on clean PostgreSQL 18:
  - first run creates exactly one reservation and one segment for `MEHRA-WED`;
  - first run writes exactly one `group.pickup_created`;
  - replay is non-mutating;
  - no `space_occupancy`, `folio`, `journal`, `posting_line`, `payment`, or
    `document` rows are written by the pickup command.
