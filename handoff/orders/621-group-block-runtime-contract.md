# Order 621 — Group block runtime contract

## Scope

- Add an executable, deterministic group/block read contract for the thin public-demo backend.
- Model the OPERA-style group block concepts already present in the immutable baseline:
  `reservation_group`, `block_status_def`, `block_allotment`, and reservations linked by
  `group_id`.
- Show pickup, remaining allotment, wash/release guidance, deduct/non-deduct status, and
  rooming-list readiness in one operational response.

## Out of scope

- Schema changes or migrations.
- Writing reservations, rooming lists, occupancy, folios, journals, documents or outbox rows.
- Claiming full Phase 11 group/block implementation.
- Replacing the PostgreSQL occupancy choke point.

## Acceptance

- `GET /api/v1/demo/group-blocks` returns a deterministic group block workbench payload.
- A deducting block decreases available block allotment by picked-up reservations.
- A wash schedule releases configured remaining rooms at cutoff without creating negative counts.
- A non-deducting prospect/tentative block is visible but explicitly does not reduce house inventory.
- Tests prove the formulas and API response so the UI has a safe contract to build against.
