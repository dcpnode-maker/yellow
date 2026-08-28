import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

test("Order 212 intentional red: governed travel capability and service do not yet exist", () => {
  expect(existsSync(new URL("../migrations/0028_governed_reservation_travel.sql", import.meta.url))).toBe(true);
  expect(existsSync(new URL("../src/contexts/reservations/travel.ts", import.meta.url))).toBe(true);
});

test("Order 212 intentional red: operator route and canonical detail editor are absent", () => {
  const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
  const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");

  expect(app).toContain("/travel/:direction");
  expect(script).toContain("reservation-travel-action");
  expect(script).toContain("reservation-travel-panel");
  expect(script).toContain("openReservationTravelEditor");
  expect(script).toContain("reservationTravelDetailRequestIsCurrent");
  expect(script).toContain("restoreReservationTravelEditorHome");
  expect(html).toContain('id="reservation-travel-form"');
});
