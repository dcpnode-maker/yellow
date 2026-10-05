# Order 658 — Governed group wash/release command

## Intent

Complete the public demo group block lifecycle after status conversion and pickup by
proving a real, confirmation-gated wash/release command. The command releases
unpicked allotment from the fixed `MEHRA-WED` block according to its configured wash
rule, while preserving picked-up rooms and avoiding all occupancy/finance/fiscal rails.

## Scope

- Add a governed route:
  - `POST /api/v1/demo/governed/group-block/wash`
  - exact phrase: `CONFIRM YELLOW OPERATION`
  - fixed block: `MEHRA-WED`
  - fixed date: `2026-10-03`
  - fixed unit type: `DLX`
- In one tenant-scoped transaction:
  - provision/read the deterministic group block fixture;
  - require the block to be `definite`;
  - count picked-up reservations for the block/date/unit type;
  - read `wash_schedule` from `reservation_group`;
  - reduce `block_allotment.blocked` by the configured release percentage of the
    unpicked allotment;
  - never reduce blocked rooms below picked-up rooms;
  - write one `group.wash_applied` outbox event.
- Replay must be non-mutating:
  - no second allotment update;
  - no second event;
  - no side-table writes.
- Update demo proof/readiness/share/action-safety surfaces from seven to eight
  governed mutation families.
- Add focused tests, clean PostgreSQL proof, and independent review.

## Out of scope

- No occupancy claim, reservation pickup creation, rooming-list import, cashier,
  folio, journal, payment, document, statutory, fiscal, channel, or external API
  writes.
- No multi-date wash, multi-unit wash, automatic scheduled wash, or UI rewrite.
- No schema migration.

## Proof required

- Focused Bun tests pass.
- `bun run typecheck` passes.
- `bun run boundaries` passes.
- `.\setup.ps1 -DbOnly` prints `11 passed, 0 failed`.
- Independent reviewer personally proves on clean PostgreSQL 18:
  - first run after status+pickup reduces DLX `blocked` from `10` to `6`;
  - picked-up count remains `1`;
  - exactly one `group.wash_applied` event is written;
  - replay is non-mutating;
  - no `space_occupancy`, `folio`, `journal`, `posting_line`, `payment`, or
    `document` rows are written by the wash command.
