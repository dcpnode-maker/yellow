import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const workspace = await Bun.file("frontend/yellow/src/workspaces/ReservationWorkspace.tsx").text();
const surface = `${app}\n${workspace}`;
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("keeps cancel and reinstate inside Yellow's governed reservation record", () => {
  for (const contract of [
    "cancelReservationLifecycle",
    "reinstateReservationLifecycle",
    "/cancel",
    "/reinstate",
    '"idempotency-key"',
    "Cancel reservation",
    "Reinstate reservation",
    "Cancellation reason",
    "PostgreSQL will recheck the original occupancy",
    "lifecycleAttempt.current?.fingerprint !== fingerprint",
    "await detail.refetch()",
    'invalidateQueries({ queryKey: ["reservation-board", propertyId] })',
    "refreshed.data?.reservation.status === expectedStatus",
    "reconciled after an uncertain response",
    "reservation-lifecycle-busy-shield",
    "if (lifecyclePosting || operationalPosting || guestAllocationPosting || checkInPosting || checkoutPosting) return;",
    "onLifecycleBusyChange?.(true)",
    "onLifecycleBusyChange?.(false)",
    "onClickCapture={guardReservationLifecycleFlight}",
    "onSubmitCapture={guardReservationLifecycleFlight}",
    "reservationLifecycleBusyRef.current",
    "assistantOperationWasSuperseded()",
    "recognition.current?.stop()",
  ]) expect(surface).toContain(contract);

  expect(workspace).toContain("detail.data.actions.canCancel");
  expect(workspace).toContain("detail.data.actions.canReinstate");
  expect(workspace).not.toContain('reservation.status === "reserved" || reservation.status === "due_in"');
  expect(workspace).not.toContain('reservation.status === "cancelled" || reservation.status === "no_show"');
  expect(app).toContain("key={assistantCard.reservationId}");
  expect(app).toContain("key={reservationRouteId}");
  expect(app.match(/<ReservationWorkspace\b[\s\S]{0,450}?onLifecycleBusyChange=\{setReservationLifecycleFlight\}/gu)?.length).toBe(3);
  expect(app.match(/<HousekeepingWorkspace onLifecycleBusyChange=\{setReservationLifecycleFlight\} \/>/gu)?.length).toBe(2);
  const overwatchJourney = app.indexOf("<OverwatchCheckInJourney");
  const overwatchJourneyEnd = app.indexOf("/>", overwatchJourney);
  const overwatchLock = app.indexOf("onLifecycleBusyChange={setReservationLifecycleFlight}", overwatchJourney);
  expect(overwatchJourney).toBeGreaterThan(-1);
  expect(overwatchLock).toBeGreaterThan(overwatchJourney);
  expect(overwatchLock).toBeLessThan(overwatchJourneyEnd);
  expect(app).not.toContain("window.location.assign('/operator/reservations");
});

test("requires explicit bounded input and mobile-safe confirmation controls", () => {
  expect(workspace).toContain('maxLength={500}');
  expect(workspace).toContain('type="checkbox"');
  expect(workspace).toContain("reason.trim().length === 0");
  expect(workspace).toContain("setLifecycleConfirmed(false)");
  expect(css).toContain(".reservation-lifecycle-card");
  expect(css).toContain(".reservation-lifecycle-actions");
  expect(css).toContain(".reservation-lifecycle-busy-shield");
  expect(css).toContain("@media (max-width: 760px)");
});
