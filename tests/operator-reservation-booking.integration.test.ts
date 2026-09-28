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

  test("P4: late hold and commit responses cannot resurrect old-property state", async () => {
    const start = script.indexOf("  async function placeReservationBookingHold() {");
    const end = script.indexOf("\n  function renderOptions(options, summary)", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const execute = new Function(`
      let reservationBookingSelection = {
        sellableUnitId: "sellable-a", ratePlanId: "rate-a",
        stay: { from: "2046-01-10T12:00:00.000Z", to: "2046-01-12T12:00:00.000Z" }
      };
      let reservationBookingDraft = { primaryPartyId: "party-a", adults: 1, childAges: [], channelCode: "direct" };
      let reservationBookingHold = null;
      let reservationBookingSearchGeneration = 7;
      const propertySelect = { value: "property-a" };
      const pendingKeys = new Map();
      const classList = { add() {}, remove() {} };
      const reservationBookingHoldAction = { disabled: false, hidden: false };
      const reservationBookingDirect = { disabled: false, hidden: false };
      const reservationBookingHeld = { disabled: false, hidden: true };
      const reservationBookingHoldText = { textContent: "" };
      const reservationBookingMessage = { textContent: "", classList };
      const confirmationStrong = { textContent: "" };
      const confirmationSmall = { textContent: "" };
      const reservationBookingConfirmation = {
        hidden: true, focus() {},
        querySelector(selector) { return selector === "strong" ? confirmationStrong : confirmationSmall; }
      };
      let resolveResponse;
      const request = () => new Promise((resolve) => { resolveResponse = resolve; });
      ${script.slice(start, end)}
      return {
        startHold: () => placeReservationBookingHold(),
        startCommit: () => commitReservationBooking(false),
        switchProperty() {
          propertySelect.value = "property-b";
          reservationBookingSearchGeneration += 1;
          reservationBookingSelection = null;
          reservationBookingHold = null;
          reservationBookingDraft = null;
        },
        resolve: (value) => resolveResponse(value),
        snapshot: () => ({
          hold: reservationBookingHold,
          selection: reservationBookingSelection,
          confirmationHidden: reservationBookingConfirmation.hidden,
          confirmation: confirmationStrong.textContent,
        }),
      };
    `);

    const holdHarness = execute();
    const holdRequest = holdHarness.startHold();
    holdHarness.switchProperty();
    holdHarness.resolve({ hold: { id: "stale-hold", expiresAt: "2046-01-10T12:10:00.000Z" } });
    await holdRequest;
    expect(holdHarness.snapshot()).toEqual({ hold: null, selection: null, confirmationHidden: true, confirmation: "" });

    const commitHarness = execute();
    const commitRequest = commitHarness.startCommit();
    commitHarness.switchProperty();
    commitHarness.resolve({ reservation: { confirmationNo: "STALE", status: "confirmed", reservationId: "reservation-a" } });
    await commitRequest;
    expect(commitHarness.snapshot()).toEqual({ hold: null, selection: null, confirmationHidden: true, confirmation: "" });
  });

});
