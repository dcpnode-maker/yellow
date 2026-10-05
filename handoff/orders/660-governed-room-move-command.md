# Order 660 — Governed room move command

## Intent

Make the public demo's remaining disabled PMS mutation family real: a confirmation-gated room move for the deterministic in-house arrival fixture.

## Scope

- Add one alternate same-unit-type demo room/sellable unit to the existing arrival fixture.
- Add a bounded governed route for moving the fixed demo reservation from room 303 to room 305.
- Use only existing PMS tables and the approved occupancy functions.
- Update the public action-safety/readiness/share proof surfaces.
- Add focused tests and independent review proof.

## Out of scope

- Cross-room-type upgrades/downgrades.
- Composite/bed moves.
- Room readiness automation, key encoding, housekeeping task side effects.
- Rate, folio, journal, payment, document, fiscal, statutory or external rail changes.
- New schema, new tables or edits to the immutable baseline migration.

## Acceptance

- Without exact confirmation phrase, the route performs no database work.
- With confirmation phrase after the governed check-in, it:
  - releases old segment occupancy using `release_occupancy`;
  - truncates the old segment to departed;
  - inserts one new in-house segment for the same reservation/unit type/rate plan;
  - records occupancy for the new segment using `record_occupancy`;
  - writes one `reservation.room_moved` outbox event in the same transaction.
- Replay is non-mutating.
- No folio, journal, posting_line, payment, document, fiscal or statutory rows are written by the room move.
