# Order 659 — Governed group rooming-list import command

## Intent

Finish the public demo group block operating path by proving a real,
confirmation-gated rooming-list import. The command attaches named guests to the
fixed `MEHRA-WED` pickup reservation using existing PMS primitives.

## Scope

- Add deterministic demo guest parties for the fixed rooming-list import.
- Add a governed route:
  - `POST /api/v1/demo/governed/group-block/rooming-list/import`
  - exact phrase: `CONFIRM YELLOW OPERATION`
  - fixed block: `MEHRA-WED`
  - fixed reservation: `GRP-MEHRA-001`
- In one tenant-scoped transaction:
  - require the pickup reservation to exist and belong to `MEHRA-WED`;
  - insert `reservation_guest` rows for primary + accompanying guests;
  - write one `group.rooming_list_imported` outbox event.
- Replay must be non-mutating:
  - no duplicate guest links;
  - no second event;
  - no side-table writes.
- Update demo proof/readiness/share/action-safety surfaces from eight to nine
  governed mutation families.
- Add focused tests, clean PostgreSQL proof, and independent review.

## Out of scope

- No CSV parser, file upload, multi-room import, guest identity-document capture,
  statutory submission, occupancy, folio, journal, payment, document, fiscal,
  channel, or external API writes.
- No schema migration.

## Proof required

- Focused Bun tests pass.
- `bun run typecheck` passes.
- `bun run boundaries` passes.
- `.\setup.ps1 -DbOnly` prints `11 passed, 0 failed`.
- Independent reviewer personally proves on clean PostgreSQL 18:
  - after status + pickup, first import creates exactly two `reservation_guest`
    links for `GRP-MEHRA-001`;
  - exactly one `group.rooming_list_imported` event is written;
  - replay is non-mutating;
  - no `space_occupancy`, `folio`, `journal`, `posting_line`, `payment`,
    `document`, `statutory_submission`, or `fiscal_submission` rows are written by
    the import command.
