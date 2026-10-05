# Order687 — real group creation and staff workspace

IMPLEMENTING linked-group vertical slice — 24 September2026. Founder requests create first then work with group
bookings under Reservations. Preserve the documented group/block distinction.

Current scope: read-only existing schema, commands, permissions, state model and
contract audit; exact smallest persisted vertical-slice proposal; this order and
handoff/questions/687.md. No code or database mutations until the coordinator
records an exact implementation amendment. Reuse existing reservation_group;
no invented occupancy deduction, financial semantics or parallel booking model.

Any added grant/function/migration/write/state/event path is high risk and needs
an independent agent to personally execute tenant/property/idempotency/atomicity
proof on an isolated database before live promotion. A source test passing or a
read-only seeded overview is not a completed group-creation flow.

## Explicit implementation admission after discovery

Reuse reservation_group kind=linked. Create named group with server-generated
reference; then open its persisted staff workspace and attach existing reserved
or due-in reservations from the same property. A link is not a room block:
each reservation retains its existing inventory; no rooms are held by the group.
Existing block summaries remain readable and distinct. No status/allotment,
pickup, release, wash, routing, master folio, payer or financial writes.

Exact scope:
- src/contexts/reservations/groups.ts and index.ts.
- src/http/operator.ts: group read/write adapter only.
- src/app.ts: group route registration only (root concurrently owns map routes).
- src/server.ts: inject GroupReservationService using existing event bus and
  PostgresIdempotency into OperatorHttpApi; no other composition changes.
- migrations/0101_linked_group_runtime_commands.sql (minimal grants/functions,
  transaction-bound context, no new table or broad reservation UPDATE).
- tests/schema/expected.sql, the canonical generated snapshot confirmed by
  scripts/schema-drift.ts; only independently proven0101 delta, preserve prior drift.
- docs/{CONTRACTS,EVENTS,STATE-MACHINES}.md only the implemented linked-group contract.
- frontend/yellow/src/group-reservations-api.ts.
- frontend/yellow/src/workspaces/{GroupReservationWorkspace.tsx,group-reservations.css}.
- tests/order687-groups{,.http,.integration,.ui}.test.ts; tests/fixtures/order687/.
- this order, handoff/questions/687.md, receipt/review687, handoff/LEDGER.md,
  docs/PROJECT-STATUS.md. Root handles ReservationWorkspace mounting and publication.

Use existing reservation lifecycle read/write permissions and current property
grants before idempotent replay. Strict body, bounded cursor reads, no caller tenant
or actor, exact-body idempotency with same transaction fact/event. Attach CAS from
expected group=null; never silently move membership. Reject wrong lifecycle,
cross-property/tenant, groups of non-linked kind and uncertain/stale reads.
Creation UI keeps same request/idempotency key on uncertain retry. No PII to models.

Usability admission: bounded same-property exact-confirmation candidate lookup
GET /groups/:groupId/candidates?confirmationNo=... in the same adapter/service.
Return only authorized pre-arrival candidates and membership, so staff can use a
booking reference instead of pasting opaque UUIDs. Revalidate all guards on attach.

Admission for testing: disposable isolated PG18 database/container with synthetic
seed only, no production mutation. Independent reviewer executes tenant/property,
permission, RLS/ACL, same-key replay/different-body rejection, concurrent attachment,
rollback/event atomicity and unchanged occupancy/journals. Live migration is a
separate coordinator action ONLY after passed independent review, source-frontier
check, backup and exact-target validation. No broad migration of an unknown database.

## Coordinator publication admission

Root may mount GroupReservationWorkspace in the retained Groups view in
frontend/yellow/src/workspaces/ReservationWorkspace.tsx, coordinated with686.
Release metadata may advance src/kernel/build-info.ts CURRENT_MIGRATION_FRONTIER
from99 to101, with matching tests/build-readiness.test.ts, scripts/local-review.sh,
tests/{free-host-arm64,release-workflow}.test.ts expectations only. Existing
function-specific fiscal contract identities remain unchanged.
Live publication includes independently accepted0100 (Order635 review) then0101
through the checksummed migration runner, never skipping a version. Require
verified public-demo target, backup, ledger checksums, role/owner audit and
independently executed687 proof first. Delta image/runtime backup/verification
scripts in tests/fixtures/order687 and D:/Yellow/temp/order685-* are admitted for
root integration; no unrelated source or private environment values published.
