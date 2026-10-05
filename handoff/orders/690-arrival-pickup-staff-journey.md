# Order690 — arrival travel and pickup staff journey

24 September2026. Founder asks why remaining ecosystem work stopped; continue
finishing real existing-backed workflows. Root audit and ecosystem_journey_gaps
found current React travel display has no capture/dispatch flow while the
authoritative travel and linked pickup task commands already exist.

Natural solution: reuse reservation_travel + canonical task + current travel/CAS
and pickup-task command/event authority. No new primitive, policy or backend.
Builder ecosystem_journey_gaps; independent non-implementer order679_independent_review.

## Scope

- frontend/yellow/src/arrival-pickup-api.ts and arrival-pickup.ts: typed bounded
  adapters/guards for existing travel PUT and linked pickup task GET/actions.
  Existing session/error/date helpers imported from yellow-api only.
- frontend/yellow/src/workspaces/ArrivalPickupWorkspace.tsx and arrival-pickup.css:
  capture arrival travel and pickup intent, scheduled-unlinked explanation/manual
  refresh, exact linked-task read, select existing staff Party for assign, then
  start/complete using current allowed actions. Confirmation, exact expected
  tuple/idempotency body and retained uncertain retry; no fake successful state.
- frontend/yellow/src/workspaces/ReservationWorkspace.tsx: only mount/integrate
  pickup workspace in existing travel area, refresh detail and join existing
  lifecycle lock so property/reservation navigation cannot drop uncertain writes.
- tests/order690-arrival-pickup.test.ts; tests/order690-arrival-pickup-http.test.ts;
  tests/fixtures/order690/**: pure/API and loopback synthetic mounted-UI fixture,
  no public forwarding or credentials. Existing backend proof files read/run only.
- Root owns capability-registry.ts: only accurate narrowly bounded arrival-pickup
  capability entry, no relabel of all Guest requests or transport bookings.
- This order; reviews/690-arrival-pickup.md; receipts/690-arrival-pickup.md under
  handoff; docs/PROJECT-STATUS.md; handoff/LEDGER.md; generated public/yellow-next;
  temporary D:/Yellow/temp release recipe based on current a42f0b25 image.

## Acceptance and safety

Existing HTTP/domain contracts are authoritative. Personally executed independent
proof for current-grant/tenant scoping/CAS/task state transitions and preserved
idempotency; no direct task writes. Mounted synthetic flow success/denial/conflict/
unknown-retry/route change. Actual public read-only desktop/mobile proof. Verify
pickup worker enabled before claiming automated creation; do not silently enable
unreviewed unrelated workers. If existing backend needs repair, stop and record a
scope question rather than widen. No public QA mutations or external messages.
Same single public app only; no schema, finance, occupancy, provider changes.
No whole ecosystem completion. Product card remains bounded/beta as appropriate.
