import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Parent wiring only; injected controller and actual browser checks supply the
// separate behavior evidence. These tests do not create hotel annotations.
const source = readFileSync("frontend/yellow/src/workspaces/ReservationWorkspace.tsx", "utf8");
const travel = source.slice(source.indexOf('<article id="reservation-detail-travel"'), source.indexOf('<article id="reservation-detail-history"'));
const alerts = travel.slice(travel.indexOf('<ReservationAlerts'), travel.indexOf('<h3>Travel'));

test("reservation alerts use the server capability in the existing travel section", () => {
  expect(alerts).toContain('key={`${propertyId}:${reservation.reservationId}:${reservation.confirmationNo}`}');
  expect(alerts).toContain('propertyId={propertyId}');
  expect(alerts).toContain('reservationId={reservation.reservationId}');
  expect(alerts).toContain('confirmationNo={reservation.confirmationNo}');
  expect(alerts).toContain('alerts={reservation.alerts}');
  expect(alerts).toContain('canManageAlerts={detail.data.actions.canManageAlerts}');
  expect(alerts).toContain('getToken={session}');
  expect(alerts).toContain('const result = await detail.refetch()');
  expect(alerts).toContain('if (result.isError || !result.data) throw');
  expect(travel).toContain('<ArrivalPickupWorkspace');
});

test("pending alert commands hold navigation without disabling their own recovery", () => {
  expect(source.includes('arrivalPickupLocked || alertsLocked ? "travel"')).toBe(true);
  const callback = source.slice(source.indexOf('const setAlertsLock'), source.indexOf('const setRoomMoveLock'));
  expect(callback).toContain('onLifecycleBusyChange?.(true)');
  expect(alerts).toContain('onLockChange={setAlertsLock}');
  expect(alerts).toContain('otherMutationBusy={otherMutationBusy || departureChangeLocked || arrivalPickupLocked || guestProfileCreateBusy || checkInDialogOpen || roomMoveLocked}');
  expect(alerts).not.toContain('otherMutationBusy={reservationMutationBusy}');
  expect(source.includes('if (detail.isError && (!(guestProfileCreateBusy || roomMoveLocked || alertsLocked) || !detail.data))')).toBe(true);
});

test("neighboring commands include the alert lock", () => {
  const stay = source.slice(source.indexOf('<ReservationDepartureChange'), source.indexOf('<h2>Folio windows'));
  expect(stay).toContain('checkInDialogOpen || roomMoveLocked || alertsLocked}');
  expect(stay).toContain('guestProfileCreateBusy || checkInDialogOpen || alertsLocked}');
  expect(travel).toContain('guestProfileCreateBusy || roomMoveLocked || alertsLocked}');
  const guest = source.slice(source.indexOf('<GuestProfileCreate'), source.indexOf('{guestProfileResults.length'));
  expect(guest).toContain('guestProfileSearching || roomMoveLocked || alertsLocked}');
  expect(source.includes('checkInDialogOpen || guestProfileCreateBusy || roomMoveLocked || alertsLocked;')).toBe(true);
});
