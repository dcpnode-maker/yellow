import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Wiring regressions; command behavior is exercised by the companion controller
// suite and mounted mobile/desktop proof, not inferred from these source checks.
const source = readFileSync("frontend/yellow/src/workspaces/ReservationWorkspace.tsx", "utf8");
const booking = source.slice(source.indexOf("function ReservationCreateWorkspace("), source.indexOf("function ReservationBoardWorkspace("));
const allocation = source.slice(source.indexOf('<div className="reservation-guests-editor">'), source.indexOf('<div className="reservation-guest-allocation-list">'));

test("booking reuses canonical guest creation without changing reservation commit", () => {
  expect(booking).toContain('<h2>Choose a guest</h2>');
  expect(booking).toContain('<GuestProfileCreate propertyId={propertyId} getToken={session} disabled={working || commitUncertain}');
  expect(booking).toContain('onBusyChange={setGuestProfileBusy}');
  const callback = booking.slice(booking.indexOf('onCreated={(profile)'), booking.indexOf('{guest ? <div'));
  expect(callback).toContain('setGuest(profile)');
  expect(callback).toContain('setGuests([profile])');
  expect(callback).toContain('resetOffer()');
  expect(callback).not.toContain('commitReservation(');
  expect(callback).not.toContain('findOffers(');
  expect(booking).toContain('const result = await commitReservation(commitAttempt.current.input)');
  expect(booking).toContain('reservationMatchesCreateReceipt(authoritative, result, evidence)');
});

test("pending guest commands lock parent exits without disabling their own reconciliation", () => {
  expect(booking).toContain('const creationBusy = working || commitUncertain || guestProfileBusy');
  expect(booking).toContain('onBusyChange?.(creationBusy)');
  expect(booking).toContain('disabled={creationBusy} onClick={onCancel}>Close');
  expect(booking).toContain('disabled={creationBusy} onClick={() => setStep(1)}>Back');
  expect(booking).toContain('disabled={!guest || creationBusy}');
  expect(booking).not.toContain('getToken={session} disabled={creationBusy}');
  expect(booking).toContain('guestSearchGeneration.current += 1');
  expect(booking).toContain('offerSearchGeneration.current += 1');
  expect(booking).toContain('createGeneration.current += 1');
});

test("guest-and-share creation requires a separate explicit role and allocation save", () => {
  expect(allocation).toContain('key={`${propertyId}:${reservationId}`}');
  expect(allocation).toContain('onBusyChange={setGuestProfileCreateBusy}');
  expect(allocation).toContain('setGuestProfileResults([profile])');
  const callback = allocation.slice(allocation.indexOf('onCreated={(profile)'), allocation.indexOf('{guestProfileResults.length'));
  expect(callback).not.toContain('addGuestProfile(');
  expect(callback).not.toContain('submitGuestAllocation(');
  expect(allocation).toContain('addGuestProfile(profile, "accompanying")');
  expect(allocation).toContain('addGuestProfile(profile, "sharer")');
  expect(source).toContain('guestProfileCreateBusy ? "guests"');
  expect(source).toContain('checkInDialogOpen || guestProfileCreateBusy');
  expect(source).toContain('if (detail.isError && (!(guestProfileCreateBusy || roomMoveLocked || alertsLocked) || !detail.data))');
});
