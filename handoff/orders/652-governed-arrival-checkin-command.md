# Order 652 — governed arrival check-in command

## Scope

- Add an explicit deterministic demo-arrival provisioning script for the Yellow public demo tenant.
- Add a confirmation-gated demo check-in command route for the single provisioned arrival fixture.
- The check-in command may update only the fixed demo reservation/segment state, write occupancy only through `record_occupancy()`, and write one outbox event in the same tenant transaction.
- Update demo safety/proof/readiness/share evidence to report two governed real mutation families only after the command is implemented and reviewed.

## Acceptance

- Unconfirmed calls return without opening the database.
- Confirmed calls for any unsupported reservation/room return without opening the database.
- If the fixture is missing, the command refuses instead of creating it.
- The provisioning script is explicit and idempotent.
- Successful check-in:
  - requires exact phrase `CONFIRM YELLOW OPERATION`;
  - uses the fixed fixture confirmation `L3R-HX-0126` and room `303`;
  - updates reservation to `in_house`;
  - updates the active reservation segment to `in_house`;
  - calls `record_occupancy()` for the assigned room and segment;
  - writes one `reservation.checked_in` outbox event;
  - does not write folio, journal, posting, payment, document, or statutory tables.
- Focused tests, typecheck, import boundaries and PG18 referee pass.
- Because reservation/occupancy state is high-risk, a non-implementing independent reviewer must personally execute proof and record it in `handoff/reviews/652-governed-arrival-checkin-command.md`.
