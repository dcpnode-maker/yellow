# Order 656 - governed group block status command

## Scope
- Add a fixed public-demo governed group block status command for `MEHRA-WED`.
- Accept only the exact confirmation phrase `CONFIRM YELLOW OPERATION`.
- Provision/read a deterministic group block fixture with configured block statuses.
- Convert only `MEHRA-WED` from `tentative` to `definite` and write one `group.status_changed` outbox event in the same tenant transaction.
- Reread group/status-definition state after execution; replay must be non-mutating.
- Expose a demo API route and update proof/action-safety/readiness/share contracts truthfully.
- Add focused tests plus run typecheck, boundary check, PostgreSQL 18 invariant battery, and independent review.

## Out of scope
- Rooming-list import, pickup reservation creation, wash/release arithmetic, occupancy, folios, journal/payment/document/statutory/fiscal writes, channel distribution, or schema migration.
