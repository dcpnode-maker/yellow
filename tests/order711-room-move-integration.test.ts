import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Integration wiring only. Controller tests and independent real PostgreSQL
// arbitration proof are required separately; these assertions do not move rooms.
const source = readFileSync("frontend/yellow/src/workspaces/ReservationWorkspace.tsx", "utf8");
const stay = source.slice(source.indexOf('<article id="reservation-detail-stay"'), source.indexOf('<h2>Folio windows</h2>'));
const move = stay.slice(stay.indexOf('<ReservationRoomMove'));

test("active room move stays beside departure under Stay & billing", () => {
  expect(stay).toContain('<ReservationDepartureChange');
  expect(move).toContain('key={`${propertyId}:${reservation.reservationId}:${reservation.confirmationNo}`}');
  expect(move).toContain('propertyId={propertyId}');
  expect(move).toContain('reservationId={reservation.reservationId}');
  expect(move).toContain('confirmationNo={reservation.confirmationNo}');
  expect(move).toContain('getToken={session}');
  expect(move).toContain('onLockChange={setRoomMoveLock}');
  expect(move).toContain('const result = await detail.refetch()');
  expect(move).toContain('if (result.isError || !result.data) throw');
});

test("room move locks its parent while retaining its own recovery path", () => {
  expect(source).toContain('departureChangeLocked || roomMoveLocked ? "stay"');
  const lock = source.slice(source.indexOf('const setRoomMoveLock'), source.indexOf('const setDepartureLock'));
  expect(lock).toContain('onLifecycleBusyChange?.(true)');
  expect(source).toContain('guestProfileCreateBusy || roomMoveLocked || alertsLocked);');
  expect(move).toContain('otherMutationBusy={otherMutationBusy || departureChangeLocked || arrivalPickupLocked || guestProfileCreateBusy || checkInDialogOpen || alertsLocked}');
  expect(move).not.toContain('otherMutationBusy={reservationMutationBusy}');
  expect(source).toContain('if (detail.isError && (!(guestProfileCreateBusy || roomMoveLocked || alertsLocked) || !detail.data))');
});

test("neighboring reservation commands cannot overlap a pending move", () => {
  const departure = stay.slice(stay.indexOf('<ReservationDepartureChange'), stay.indexOf('<ReservationRoomMove'));
  expect(departure).toContain('checkInDialogOpen || roomMoveLocked || alertsLocked}');
  const guest = source.slice(source.indexOf('<GuestProfileCreate'), source.indexOf('{guestProfileResults.length'));
  expect(guest).toContain('guestProfileSearching || roomMoveLocked || alertsLocked}');
  const travel = source.slice(source.indexOf('<ArrivalPickupWorkspace'), source.indexOf('<article id="reservation-detail-history"'));
  expect(travel).toContain('guestProfileCreateBusy || roomMoveLocked || alertsLocked}');
  const lifecycle = source.slice(source.indexOf('const submitLifecycle'), source.indexOf('const submitCheckIn'));
  expect(lifecycle).toContain('departureChangeLocked || roomMoveLocked');
});
