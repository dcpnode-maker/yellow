# Order711 — active same-type in-house room move

Founder continuation, Phase7. Predecessors709/710 are bounded integrations, not
ecosystem completion. D-287/D-305/D-306 and existing segment command remain binding.
Natural-solution test: reuse existing reservation segments, inventory configuration,
occupancy authority and fact/outbox commands; no new entity, state, event or schema.

Expose a room-move sibling to departure changes under Stay & billing in the active
reservation detail. Read exact confirmation history and separately authorized
inventory configuration. Only server canMoveRoom/latest in-house history permits
the form; configured destinations must be active, same unit type, a single exclusive
space different from the source space. Configuration is guidance, not availability
or readiness. A denied inventory permission has an explicit non-bypassable error.

Staff select an exact destination and explicitly confirm an immediate same-type
move. POST only expected source sellable unit, exact expected period and destination
sellable unit to the existing property/reservation/segment move endpoint, with one
frozen key. Server owns time, tenant, actor, space/type and occupancy arbitration.
Validate complete receipt, then fresh exact segment history plus reservation detail
before success. Reconcile old departed/new in-house segment identities, sequence,
source/destination, periods and receipt-owned move instant. Unknown responses or
readback errors retain payload/key and parent lock; same-key retry remains usable.
Stale property/record/unmount callbacks must not post or apply. No auto-move, caller
timestamp, cross-type/bed/composite move, readiness, key, finance or pricing claim.

Exclusive scope:
- Builder: new frontend/yellow/src/workspaces/ReservationRoomMove.tsx,
  frontend/yellow/src/reservation-room-move.ts,
  frontend/yellow/src/workspaces/reservation-room-move.css,
  tests/order711-reservation-room-move.test.tsx.
  Component props propertyId,reservationId,confirmationNo,getToken,timezone,
  otherMutationBusy,onLockChange,onRefreshDetail. Use imported ReservationDetail
  types; controller owns injected fetch/token, strict history/inventory/receipt
  transport and reconciliation. Avoid changes to shared yellow-api contracts.
- Root: frontend/yellow/src/workspaces/ReservationWorkspace.tsx only import/mount,
  aggregate move lock/navigation/mutual exclusion and error-retention integration;
  tests/order711-room-move-integration.test.ts; the exact pending-refresh assertion
  in tests/order709-reservation-integration.test.ts per Q711, preserving its guest
  protection while adding the room-move lock.
- Independent proof helper (reviewer/root): scripts/order711-room-move-proof.ps1,
  tests/reservation-segment-changes.integration.test.ts only if current-frontier
  fixture incompatibility is documented first in handoff/questions/711.md; never
  weaken assertions or existing domain requirements to obtain a pass.
- Governance: this order, handoff/questions/711.md, handoff/reviews/711-room-move.md,
  handoff/receipts/711-room-move.md, docs/PROJECT-STATUS.md, handoff/LEDGER.md.
- Generated public/yellow-next/**; external temporary proof/build evidence under
  D:/Yellow/temp/order711-* only. Database proof uses exact new database name
  yellow_order711_proof_<unique suffix> on the existing PostgreSQL service; no second
  public app, no clone of live tenant data, no role/grant expansion on live.

Verification: injected controller transport/render/wiring failure, conflict,
uncertain replay, corrupt receipt, stale context and denied permission tests;
full types/boundaries/build. Non-implementing independent reviewer must personally
execute existing reservation-segment-changes integration suite on a fresh isolated
current-schema PostgreSQL proof DB with distinct deploy/runtime identities and
YELLOW_REQUIRE_RESERVATION_SEGMENTS=1. Missing environment/skips are not proof.
Create schema without live tenant data; never point fixed-fixture suites at live.
Preserve proof DB on failure for inspection; cleanup only exact verified disposable
target after evidence. No migration/domain change authorized by this order.

Actual mobile/desktop browser must verify entry point, accessible confirmation,
permission/error states and review/readback; any actual move uses an explicitly
synthetic isolated fixture, never real guest data. App-only existing-stack cutover
requires passing independent occupancy proof and rollback to709/710. If a current
backend/security blocker appears, keep the safe current release live and report it;
do not silently expand authority or mark room moves/ecosystem complete.
