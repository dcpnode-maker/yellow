import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

test("Order 211 intentional red: reservation detail does not yet host governed guest allocation", () => {
  expect(script).toContain("reservation-guest-allocation-action");
  expect(script).toContain("reservation-guest-allocation-panel");
  expect(script).toContain("openReservationGuestAllocation");
  expect(script).toContain("reservationGuestDetailRequestIsCurrent");
  expect(script).toContain("restoreReservationGuestEditorHome");
  expect(script).toContain("refreshReservationDetailAfterGuestCommand");
});
