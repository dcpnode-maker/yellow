import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

describe("Order 099 operator reservation booking workbench", () => {
  test("P0: complete offers, temporary hold and authoritative commit journey are present", () => {
    expect(html).toContain('id="reservation-booking-form"');
    expect(html).toContain('id="reservation-booking-options"');
    expect(script).toContain("renderReservationBookingOffers");
    expect(script).toContain("commit_arbitration_required");
    expect(script).toContain("/holds");
    expect(script).toContain("/api/v1/reservations:commit");
  });
});
