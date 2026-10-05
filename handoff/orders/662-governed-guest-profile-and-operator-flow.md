# Order 662 — Governed guest profile and operator flow

## Intent

Replace the public demo root JSON-link wall with a staff-facing PMS arrival flow that
an operator can actually use: review the arrival, check in the guest, correct the
primary guest name, add a sharer, and move the room.

## Scope

- Serve `/` as a CSP-safe mobile-readable operator flow for the synthetic arrival
  `L3R-HX-0126`.
- Keep the old manager/proof dashboard reachable away from the operator root.
- Add governed form routes for:
  - check-in;
  - guest profile update;
  - sharer addition;
  - room move.
- Implement the guest profile command using existing primitives only:
  - `party` for person identity;
  - `reservation_guest` for primary/sharer links;
  - `outbox` for same-transaction evidence.
- Preserve exact confirmation phrase gating for every write.
- Preserve PostgreSQL as the source of truth and avoid direct occupancy writes.

## Explicit non-scope

- No schema change.
- No new person-like table.
- No production payment/card/fiscal/document-numbering rail.
- No OTA writeback.
- No change to `migrations/0001_init.sql`.

## Required proof

- Focused tests for root operator flow and governed guest profile confirmation gates.
- Typecheck.
- Import boundary check.
- Local database proof showing:
  - guest profile write updates `party`;
  - sharer is linked through `reservation_guest`;
  - outbox event is written in the same command path;
  - confirmation failure does not mutate data.
- Independent review because the order mutates guest identity/reservation guest links.
