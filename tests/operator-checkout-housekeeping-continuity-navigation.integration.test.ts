import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

const PROPERTY = "00000000-0000-0000-0000-000000234001";
const RESERVATION = "00000000-0000-0000-0000-000000234002";
const SEGMENT = "00000000-0000-0000-0000-000000234003";
const SPACE = "00000000-0000-0000-0000-000000234004";

function functionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const opening = script.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = opening; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

function executableWithCanonicalUuid<T extends (...args: never[]) => unknown>(name: string): T {
  const canonicalUuid = (value: string) => /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/.test(value);
  return new Function("canonicalUuid", `return (${functionSource(name)})`)(canonicalUuid) as T;
}

const receipt = Object.freeze({
  reservationId: RESERVATION,
  previousReservationStatus: "due_out",
  reservationStatus: "checked_out",
  segmentId: SEGMENT,
  segmentStatus: "departed",
  assignedSpaceId: SPACE,
  checkedOutAt: "2026-08-28T09:30:00.000Z",
  previousSegmentPeriod: { from: "2026-08-27T09:00:00.000Z", to: "2026-08-29T09:00:00.000Z" },
  segmentPeriod: { from: "2026-08-27T09:00:00.000Z", to: "2026-08-28T09:30:00.000Z" },
  releasedClaimCount: 1,
  folioWindowCount: 2,
  replayed: false,
});

const context = Object.freeze({
  property: PROPERTY,
  reservationId: RESERVATION,
  confirmationNo: "Y-234-CHECKOUT",
  originPath: `/p/${PROPERTY}/res/${RESERVATION}`,
  detailGeneration: 17,
  browserGeneration: 4,
});

describe("Order 234 exact checkout-to-Housekeeping continuity", () => {
  test("admits only the exact current checkout receipt into one minimized frozen descriptor", () => {
    const validateReceipt = executableWithCanonicalUuid<(value: unknown, reservationId: string) => typeof receipt>("checkoutResult");
    const descriptorFor = executableWithCanonicalUuid<(
      result: typeof receipt,
      value: typeof context,
    ) => Readonly<Record<string, unknown>> | null>("checkoutHousekeepingCompletionDescriptor");
    const exactReceipt = validateReceipt(receipt, RESERVATION);
    const descriptor = descriptorFor(exactReceipt, context);

    expect(descriptor).toEqual({
      assignedSpaceId: SPACE,
      browserGeneration: 4,
      confirmationNo: "Y-234-CHECKOUT",
      detailGeneration: 17,
      originPath: `/p/${PROPERTY}/res/${RESERVATION}`,
      property: PROPERTY,
      releasedClaimCount: 1,
      reservationId: RESERVATION,
      reservationStatus: "checked_out",
      segmentStatus: "departed",
    });
    expect(Object.isFrozen(descriptor)).toBeTrue();
    expect(descriptor).not.toHaveProperty("segmentId");
    expect(descriptor).not.toHaveProperty("checkedOutAt");
    expect(descriptor).not.toHaveProperty("replayed");

    for (const hostile of [
      { ...exactReceipt, reservationId: SEGMENT },
      { ...exactReceipt, reservationStatus: "due_out" },
      { ...exactReceipt, segmentStatus: "in_house" },
      { ...exactReceipt, assignedSpaceId: null },
      { ...exactReceipt, assignedSpaceId: "hostile" },
      { ...exactReceipt, releasedClaimCount: 0 },
      { ...exactReceipt, releasedClaimCount: 2 },
    ]) expect(descriptorFor(hostile as typeof receipt, context)).toBeNull();
    for (const hostileContext of [
      { ...context, property: SEGMENT },
      { ...context, reservationId: SEGMENT },
      { ...context, confirmationNo: "" },
      { ...context, originPath: `/p/${PROPERTY}/res/${SEGMENT}` },
      { ...context, detailGeneration: 0 },
      { ...context, browserGeneration: 0 },
      { ...context, surplus: true },
    ]) expect(descriptorFor(exactReceipt, hostileContext as typeof context)).toBeNull();
    expect(() => validateReceipt({ ...receipt, hostile: true }, RESERVATION)).toThrow();
  });

  test("creates completion only after the exact authoritative checked-out refresh", () => {
    const submit = functionSource("submitCheckout");
    expect(submit).toContain("checkoutHousekeepingCompletionDescriptor(result");
    expect(submit).toContain("loadReservationDetail(reservationId)");
    expect(submit).toContain("authoritativeDetailGeneration !== reservationDetailGeneration");
    expect(submit).toContain('reservationDetailData.reservation.status !== "checked_out"');
    expect(submit).toContain("checkoutHousekeepingCompletion");
    expect(submit.indexOf("checkoutHousekeepingCompletionDescriptor(result")).toBeLessThan(submit.indexOf("await detailRefresh"));
    expect(submit.indexOf("await detailRefresh")).toBeLessThan(submit.indexOf("housekeepingAction"));
    expect(submit).not.toMatch(/localStorage|sessionStorage|indexedDB|setInterval|setTimeout/);
  });

  test("rechecks every route, generation, authoritative detail and connected-DOM identity before opening", () => {
    const current = functionSource("checkoutHousekeepingCompletionActionIsCurrent");
    for (const boundary of [
      'activeView === "reservations"', "reservationDetailGeneration", "browserGeneration",
      "propertySelect.value", "reservationRouteReservationId", "reservationDetailData",
      'origin.reservationStatus === "checked_out"', "location.pathname", "location.search",
      "reservationDetailDrawer.isConnected", "reservationDetailDrawer.hidden === false",
      "section?.isConnected", "action?.isConnected", "action.hidden === false",
      "action.disabled === false", "section.contains(action)", "assignedSpaceId",
      "confirmationNo", "releasedClaimCount", "reservationStatus", "segmentStatus",
    ]) expect(current).toContain(boundary);
    const open = functionSource("openCheckoutHousekeeping");
    expect(open).toContain("checkoutHousekeepingCompletionActionIsCurrent(origin, section, action)");
  });

  test("validates exact completion and Housekeeping history shapes before reconstruction", () => {
    const completion = functionSource("checkoutHousekeepingCompletionFromState");
    const returning = functionSource("checkoutHousekeepingReturnFromState");
    for (const source of [completion, returning]) {
      for (const key of [
        "assignedSpaceId", "browserGeneration", "confirmationNo", "detailGeneration", "originPath",
        "property", "releasedClaimCount", "reservationId", "reservationStatus", "segmentStatus",
      ]) expect(source).toContain(key);
      expect(source).toContain("Object.keys(value).sort()");
      expect(source).toContain("canonicalUuid");
      expect(source).toContain('value.reservationStatus !== "checked_out"');
      expect(source).toContain('value.segmentStatus !== "departed"');
      expect(source).toContain("value.releasedClaimCount !== 1");
      expect(source).toContain("Object.freeze({ ...value })");
    }
    expect(completion).toContain('state?.yellowSurface !== "reservation-detail"');
    expect(returning).toContain('state?.yellowSurface !== "housekeeping"');
  });

  test("opens one existing Housekeeping history entry and focuses only authoritative room truth or its safe heading", () => {
    const open = functionSource("openCheckoutHousekeeping");
    expect((open.match(/history\.pushState\(/g) || []).length).toBe(1);
    expect(open).toContain('yellowSurface: "housekeeping"');
    expect(open).toContain("checkoutHousekeepingReturn");
    expect(open).toContain('/p/${origin.property}/housekeeping');
    expect(open).toContain('setView("housekeeping", false)');
    expect(open).not.toContain("request(");

    const sync = functionSource("syncCheckoutHousekeepingContext");
    expect(sync).toContain("checkoutHousekeepingReturnFromState(history.state, propertySelect.value)");
    expect(sync).toContain("ensureCheckoutHousekeepingReturnControl(returning)");
    expect(sync).not.toMatch(/housekeepingConditionFilter\.value\s*=/);

    const focus = functionSource("restoreCheckoutHousekeepingRoomFocus");
    expect(focus).toContain("housekeepingConditionRows");
    expect(focus).toContain("assignedSpaceId");
    expect(focus).toContain("housekeepingConditionList");
    expect(focus).toContain("candidate.dataset.spaceId === returning.assignedSpaceId");
    expect(focus).toContain("housekeepingConditionTitle");
    expect(focus).toContain("focus({ preventScroll: true })");
    expect(focus).not.toMatch(/task|occupancy|dirty|clean|pickup|inspected|readiness/i);
  });

  test("Back, Escape, browser history and refresh return through authoritative checked-out detail", () => {
    const back = functionSource("returnFromHousekeepingToCheckedOutReservation");
    const restore = functionSource("restoreCheckoutHousekeepingDetailFocus");
    const openDetail = functionSource("openReservationDetail");
    expect(back).toContain("checkoutHousekeepingReturn");
    expect(back).toContain("history.back()");
    expect(back).toContain('setView("reservations", false)');
    expect(openDetail).toContain("loadReservationDetail(reservationId)");
    expect(restore).toContain("checkoutHousekeepingCompletionActionIsCurrent");
    expect(restore).toContain("reservationDetailTitle");
    expect(restore).toContain("focus({ preventScroll: true })");
    expect(script).toContain('window.addEventListener("popstate"');
    expect(script).toContain("returnFromHousekeepingToCheckedOutReservation({ fromHistory: true })");
    expect(script).toContain("returnFromHousekeepingToCheckedOutReservation()");
    expect(script).toContain('event.key === "Escape"');
  });

  test("direct Housekeeping stays non-contextual and continuity adds no mutation, polling, storage or inferred work", () => {
    const sync = functionSource("syncCheckoutHousekeepingContext");
    expect(sync).toContain("if (!returning");
    expect(sync).toContain("clearCheckoutHousekeepingReturnControl()");
    expect(sync).toContain("return null");
    const setView = functionSource("setView");
    expect(setView).toContain("loadHousekeepingBoard()");
    expect(setView).toContain("loadHousekeepingConditions()");

    const continuity = [
      functionSource("checkoutHousekeepingCompletionDescriptor"),
      functionSource("checkoutHousekeepingCompletionFromState"),
      functionSource("checkoutHousekeepingCompletionActionIsCurrent"),
      functionSource("checkoutHousekeepingReturnFromState"),
      functionSource("syncCheckoutHousekeepingContext"),
      functionSource("openCheckoutHousekeeping"),
      functionSource("restoreCheckoutHousekeepingRoomFocus"),
      functionSource("returnFromHousekeepingToCheckedOutReservation"),
      functionSource("restoreCheckoutHousekeepingDetailFocus"),
    ].join("\n");
    expect(continuity).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
    expect(continuity).not.toMatch(/setInterval|setTimeout|EventSource|WebSocket|localStorage|sessionStorage|indexedDB/);
    expect(continuity).not.toMatch(/submitCheckout|submitHousekeepingAction|create.*task|transition.*task|record_occupancy|release_occupancy|condition\s*=|dirty|cleaning|required|discrepancy/i);
  });
});
