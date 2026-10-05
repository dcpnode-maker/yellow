# Order 655 - governed checkout completion command

## Scope
- Add a fixed public-demo governed checkout command for Sara Al Harbi (`L3R-HX-0126`, `FOL-DEMO-303`, room `303`).
- Accept only the exact confirmation phrase `CONFIRM YELLOW OPERATION`.
- Execute only after the authoritative PostgreSQL `folio_balance` for the demo folio is zero.
- Complete checkout by calling `release_occupancy()` for the demo reservation segment, updating the reservation to `checked_out`, updating the segment to `departed`, closing the demo folio, and writing one `reservation.checked_out` outbox event in the same tenant transaction.
- Reread reservation/segment/folio/balance/occupancy state after execution; replay must not duplicate outbox rows or mutate already checked-out state.
- Expose a demo API route and update proof/action-safety/readiness/share contracts truthfully.
- Add focused tests plus run typecheck, boundary check, PostgreSQL 18 invariant battery, and independent review.

## Out of scope
- Early departure fees, late checkout pricing, AR transfer, fiscal document issue, statutory reporting, room move, group block mutation, payment provider rails, or broad checkout UI redesign.
- Schema migration or editing `migrations/0001_init.sql`.
