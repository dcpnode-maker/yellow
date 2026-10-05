# Order712 — active reservation alert controls

Founder continuation, Phase7. Current React detail only displays alerts; Order463
server create/deactivate commands already exist. This order connects those commands
without new policy, schema, authority or lifecycle. Source decisions1460/1461/1466
and CONTRACTS.md reservation-alert section remain binding.

Outcome: inside Alerts & travel, authorized staff create an operational alert and
deactivate an active alert with explicit review/confirmation; read-only staff retain
readable alerts. Use server actions.canManageAlerts, never infer permission from the
reservation status. Creation body is exactly {code,message,showOn}; code is null or
trimmed 1–64 Unicode code points, note trimmed 1–1000 code points, showOn is exactly
checkin/checkout/always. Reject unsafe control characters, permitting CR/LF/tab only
in notes. Deactivate uses the exact selected alert id and {}. No edit, delete,
reactivate, lifecycle/finance/occupancy effect or private data collection.

POST existing /api/v1/properties/{property}/reservations/{reservation}/alerts or
/alerts/{alert}/deactivate with one frozen Idempotency-Key/payload per attempt.
Validate HTTP200 and complete receipt {alert:{id,code,message,showOn,active},changed,
replayed}; after POST validate refreshed exact reservation and matching alert row
before success. A received receipt followed by any readback failure is uncertain.
Retain exact key/payload and navigation lock after unknown response, malformed
receipt or failed readback; same-key reconciliation stays enabled even while parent
is busy. Known refusal before any uncertain attempt may return to editable review.
Never treat a later refusal as proof an earlier uncertain write did not happen.
Guard context/unmount before and after token acquisition and async results. Use
existing VoiceInput/VoiceTextarea for editable text, no new speech provider.

Exclusive scope:
- Builder: new frontend/yellow/src/workspaces/ReservationAlerts.tsx,
  frontend/yellow/src/reservation-alerts-client.ts,
  frontend/yellow/src/workspaces/reservation-alerts.css,
  tests/order712-reservation-alerts.test.tsx.
  Props: propertyId, reservationId, confirmationNo, alerts (ReservationDetail
  reservation.alerts), canManageAlerts, getToken, otherMutationBusy, onLockChange,
  onRefreshDetail returning Promise<ReservationDetail>. No yellow-api edits.
- Root: frontend/yellow/src/workspaces/ReservationWorkspace.tsx alert read list
  replacement with component and mutual busy/navigation/retained-refetch handling;
  tests/order712-alerts-integration.test.ts; exact pending-refresh guard assertion
  in tests/order709-reservation-integration.test.ts and additive lock assertions
  in tests/order711-room-move-integration.test.ts per Q712, preserving all existing
  guest and room-move protections and their own recovery exemptions.
- Governance: this order, handoff/questions/712.md, handoff/reviews/712-alerts.md,
  handoff/receipts/712-alerts.md, docs/PROJECT-STATUS.md, handoff/LEDGER.md.
- Generated public/yellow-next/**; external D:/Yellow/temp/order712-* build and
  minimized verification evidence. No DB fixtures/migrations on serving data.

Verification: focused injected transport/React tests for permission, shape/bounds,
create/deactivate/no-op/replay, double-submit, uncertain retry and corrupt readback,
stale token/context, parent recovery lock and read-only display; existing Order463
mock HTTP/domain/UI suites; full types/boundaries/Vite. Nonimplementing reviewer
personally runs relevant proofs and inspects implementation. Backend is unchanged;
prior accepted Order463 real PostgreSQL proof remains identified separately, not
represented as newly executed proof. Live QA only read/unsaved form checks on real
reservations; any actual annotation must target an explicitly synthetic QA booking.
App-only existing-stack cutover only after review, retain previous rollback image.
No whole-ecosystem completion claim follows from this bounded integration.
