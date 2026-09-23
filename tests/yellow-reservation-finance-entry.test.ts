import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

function sourceBetween(start: string, end: string): string {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Missing source boundary: ${start}`);
  return app.slice(from, to);
}

test("reservation detail and the rendered movement board open Finance for the exact reservation with honest context", () => {
  expect(app).toContain('workspace=finance&reservation=${encodeURIComponent(reservation.reservationId)}');
  expect(app).toContain('workspace=finance&reservation=${encodeURIComponent(detail.data!.reservation.reservationId)}');
  const movementGrid = sourceBetween('function MovementGrid', 'function ReservationWorkspace');
  expect(movementGrid).toContain('className="movement-billing-action"');
  expect(movementGrid).toContain('aria-label={`Open cashier and billing for ${stay.confirmationNo}`}');
  expect(movementGrid).toContain('workspace=finance&reservation=${encodeURIComponent(stay.reservationId)}');
  expect(movementGrid).toContain('event.stopPropagation()');
  expect(app).toContain('Open cashier · in-house billing');
  expect(app).toContain('Open cashier · pre-arrival billing');
  expect(app).toContain('In-house billing context');
  expect(app).toContain('Pre-arrival billing context');
  expect(app).toContain('The current server record controls whether charges can be posted.');
  expect(app).toContain('folio.data.chargeAvailability.reason');
  expect(app).toContain('disabled={!folio.data.chargeAvailability.allowed || posting || depositLocked}');
});

test("opening a no-folio billing window is confirmed, fresh, idempotent and proof-based", () => {
  const action = sourceBetween('function PrimaryBillingWindowAction', 'function CashierWorkbench');
  expect(action).toContain('allowedStatuses = new Set(["reserved", "due_in", "in_house", "due_out"])');
  expect(action).toContain('reservation.folios.length === 0');
  expect(action).toContain('I confirm opening the primary billing window for {confirmationName}.');
  expect(action).toContain('const fresh = await loadReservation(reservation.reservationId)');
  expect(action).toContain('key: `yellow-primary-billing-window-${reservation.reservationId}-${crypto.randomUUID()}`');
  expect(action).toContain('body: "{}"');
  expect(action).toContain('await openPrimaryFolio(reservation.reservationId, attempt.current.key)');
  expect(action).toContain('const refreshed = await loadReservation(reservation.reservationId)');
  expect(action).toContain('folio.windowNo === 1 && folio.status === "open"');
  expect(action).toContain('retained the exact reservation, body and idempotency key');
  expect(action).toContain('data-lifecycle-recovery={recoveryLocked ? "true" : undefined}');
  expect(action).toContain('onLifecycleBusyChange?.(true)');
  expect(action).toContain('if (uncertain || (recoveryLocked && attempt.current !== null))');
  expect(action).toContain('if ((!eligible || reservationReadUnavailable) && !recoveryLocked) return null;');
  expect(action).toContain('disabled={posting || recoveryLocked}');
  expect(action).toContain('const reservationIdentity = `${reservation.reservationId}:${reservation.folios.map');
  expect(action).toContain('setConfirmed(false);');
  expect(action).toContain('const billingContextLabel = isInHouseBilling ? "IN-HOUSE BILLING" : "PRE-ARRIVAL BILLING";');
  expect(action).toContain('onLifecycleBusyChange?.(false)');
  expect(action).toContain('fresh.reservation.reservationId !== reservation.reservationId');
  expect(action).not.toContain('setMessage("Primary billing window opened.")');
});

test("the finance workbench preserves retained recovery across a transient reservation refresh failure", () => {
  expect(app).toContain('const lastReservationDetail = useRef<ReservationDetail | null>(null);');
  expect(app).toContain('const visibleReservationDetail = currentReservationDetail ?? (');
  expect(app).toContain('const reservationDetailRefreshUnavailable = detail.isError && visibleReservationDetail !== null;');
  expect(app).toContain('The last confirmed reservation record remains visible only for same-key recovery');
  expect(app).toContain('<PrimaryBillingWindowAction key={visibleReservationDetail.reservation.reservationId} reservation={visibleReservationDetail.reservation} reservationReadUnavailable={reservationDetailRefreshUnavailable}');
  expect(app).toContain('disabled={receivableBusy || receivableAttemptUncertain || reservationDetailRefreshUnavailable || depositLocked}');
  expect(app).toContain('const enterOpenedPrimaryBillingWindow = (fresh: ReservationDetail, folioId: string) =>');
  expect(app).toContain('void board.refetch()');
  expect(css).toContain('.primary-billing-window');
  expect(css).toContain('.primary-billing-window > button { min-height: 44px;');
  expect(css).toContain('.primary-billing-window .confirmation { min-height: 44px;');
  expect(css).toContain('.movement-billing-action { width: 100%; min-height: 44px;');
});
