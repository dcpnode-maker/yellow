import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("maintains canonical reservation guests and shares in the React reservation workspace", () => {
  for (const contract of [
    "replaceReservationGuests",
    'method: "PUT"',
    'authorization: `Bearer ${await session()}`',
    '"idempotency-key": idempotencyKey',
    "Guests & shares",
    "Primary guest · server owned",
    "Search existing guest profiles",
    "Add as accompanying",
    "Add as sharer",
    "guestAllocationAttempt.current?.fingerprint !== fingerprint",
    "reservationGuestAllocationsMatch",
    "await detail.refetch()",
    'invalidateQueries({ queryKey: ["reservation-board", propertyId] })',
    "onLifecycleBusyChange?.(true)",
    "onLifecycleBusyChange?.(false)",
  ]) expect(app).toContain(contract);

  expect(app).toContain('new Set(["reserved", "due_in", "in_house", "due_out"])');
  expect(app).toContain("guest.role === \"primary\"");
  expect(app).toContain("guest.role === \"sharer\"");
  expect(app).toContain("parseGuestShareBasisPoints");
  expect(app).toContain("guestShareTotalBasisPoints === 10_000");
  expect(app).toContain("setGuestAllocationConfirmed(false)");
  expect(app).not.toContain("guest financial split");
});

test("keeps the guest editor contained on touch and zoom surfaces", () => {
  expect(css).toContain(".reservation-guests-card");
  expect(css).toContain(".reservation-guest-search-results");
  expect(css).toContain(".reservation-guest-allocation-row");
  expect(css).toContain("@media (max-width: 760px)");
});

test("cancels stale profile-search busy state at every editor identity boundary", () => {
  const resetEffect = app.slice(
    app.indexOf("useEffect(() => {\n    guestSearchGeneration.current += 1;"),
    app.indexOf("}, [reservationId]);"),
  );
  const open = app.slice(app.indexOf("const openGuestAllocation"), app.indexOf("const closeGuestAllocation"));
  const close = app.slice(app.indexOf("const closeGuestAllocation"), app.indexOf("const searchGuestProfilesForAllocation"));
  const queryChange = app.slice(app.indexOf('placeholder="Name, email, phone or Party ID"'), app.indexOf("onKeyDown=", app.indexOf('placeholder="Name, email, phone or Party ID"')));
  for (const boundary of [resetEffect, open, close, queryChange]) {
    expect(boundary).toContain("guestSearchGeneration.current += 1");
    expect(boundary).toContain("setGuestProfileSearching(false)");
  }
});
