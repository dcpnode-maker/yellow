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

  test("P1: child ages are parsed exactly and invalid inputs are rejected locally", () => {
    const start = script.indexOf("  function reservationBookingChildAges(value) {");
    const end = script.indexOf("\n  async function placeReservationBookingHold()", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const execute = new Function(`${script.slice(start, end)}\nreturn { reservationBookingChildAges };`);
    const { reservationBookingChildAges } = execute() as {
      reservationBookingChildAges: (value: string) => number[];
    };

    expect(reservationBookingChildAges("")).toEqual([]);
    expect(reservationBookingChildAges("0, 6,17")).toEqual([0, 6, 17]);
    expect(() => reservationBookingChildAges("-1")).toThrow();
    expect(() => reservationBookingChildAges("18")).toThrow();
    expect(() => reservationBookingChildAges("1.5")).toThrow();
  });

  test("P4: browser sends canonical commands and renders only server confirmation truth", () => {
    expect(script).toContain("`${fromValue}Z`");
    expect(script).toContain("`${toValue}Z`");
    expect(script).toContain("commit_arbitration_required");
    expect(script).toContain("result.reservation.confirmationNo");
    expect(script).toContain("result.reservation.status");
    expect(script).toContain("searchGeneration !== reservationBookingSearchGeneration");
    expect(script).toContain("property !== propertySelect.value");
    expect(script).not.toMatch(/Math\.round|\.toFixed|parseFloat/);
    expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
});
