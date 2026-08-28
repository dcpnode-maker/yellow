import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

function functionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const opening = script.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = opening; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

describe("Order 226 exact check-in to Housekeeping continuity", () => {
  test("admits only exact room-condition blockers on the current due-in readiness", () => {
    const render = functionSource("renderCheckInReadiness");
    expect(script).toContain('const CHECKIN_HOUSEKEEPING_BLOCKERS = Object.freeze(["room_condition_missing", "room_not_ready"]);');
    expect(script).toContain('const checkInHousekeepingAction = $("#checkin-housekeeping-action")');
    expect(render).toContain("CHECKIN_HOUSEKEEPING_BLOCKERS.includes(blocker)");
    expect(render).toContain("checkInHousekeepingAction.hidden = false");
    expect(render).toContain("checkInHousekeepingAction.dataset.blocker = housekeepingBlocker");
    expect(render).toContain("checkInHousekeepingAction.dataset.reservationId = readiness.reservationId");
    expect(render).toContain("Object.freeze({");
    expect(render).toContain("status: reservationDetailData.reservation.status");
    expect(render).toContain("assignedSpaceId: readiness.assignedSpaceId");
    expect(render).toContain("roomCondition: readiness.roomCondition");
    expect(render).toContain("checkInHousekeepingActionOrigin = origin");
    expect(script).toContain("openCheckInHousekeeping(checkInHousekeepingActionOrigin, checkInHousekeepingAction)");
  });

  test("rechecks the complete readiness, route, generation, action and DOM mismatch matrix", () => {
    const current = functionSource("checkInHousekeepingActionIsCurrent");
    for (const boundary of [
      'activeView === "reservations"', "reservationDetailGeneration", "checkInReadinessGeneration",
      "propertySelect.value", "reservationRouteReservationId", "reservationDetailData",
      "checkInReadinessData", 'origin.status === "due_in"', "origin.blocker", "origin.assignedSpaceId",
      "origin.roomCondition", "origin.originPath", "location.pathname", "location.search",
      "reservationDetailDrawer.isConnected", "reservationDetailDrawer.hidden === false",
      "checkInWorkbench.hidden === false", "action?.isConnected", "action.hidden === false",
      "action.disabled === false", "action.dataset.blocker", "action.dataset.reservationId",
    ]) expect(current).toContain(boundary);
    expect(current).toContain("CHECKIN_HOUSEKEEPING_BLOCKERS.includes(origin.blocker)");
    expect(current).toContain("checkInBlockers.contains(item)");
    expect(current).toContain("item?.dataset.blocker === origin.blocker");
  });

  test("validates and freezes only the minimized canonical return descriptor", () => {
    const fromState = functionSource("checkInHousekeepingReturnFromState");
    expect(fromState).toContain('state?.yellowSurface !== "housekeeping"');
    expect(fromState).toContain("checkInHousekeepingReturn");
    for (const key of [
      "assignedSpaceId", "blocker", "confirmationNo", "detailGeneration", "drawerReturnView",
      "originPath", "property", "readinessGeneration", "reservationId", "roomCondition", "status",
    ]) expect(fromState).toContain(key);
    expect(fromState).toContain("Object.keys(value).sort().join");
    expect(fromState).toContain("canonicalUuid");
    expect(fromState).toContain('value.status !== "due_in"');
    expect(fromState).toContain("CHECKIN_HOUSEKEEPING_BLOCKERS.includes(value.blocker)");
    expect(fromState).toContain("CHECKIN_HOUSEKEEPING_CONDITIONS.includes(value.roomCondition)");
    expect(fromState).toContain("canonicalCheckInWorkbenchPath(value.property, value.reservationId)");
    expect(fromState).toContain("Object.freeze({ ...value })");
  });

  test("opens one canonical Housekeeping entry and preserves only recorded condition and space identity", () => {
    const open = functionSource("openCheckInHousekeeping");
    expect(open).toContain("checkInHousekeepingActionIsCurrent");
    expect(open).toContain("Object.freeze({");
    expect(open).toContain("checkInHousekeepingReturn");
    expect((open.match(/history\.pushState\(/g) || []).length).toBe(1);
    expect(open).toContain('yellowSurface: "housekeeping"');
    expect(open).toContain('/p/${origin.property}/housekeeping');
    expect(open).toContain('setView("housekeeping", false)');
    const sync = functionSource("syncCheckInHousekeepingContext");
    const view = functionSource("setView");
    expect(sync).toContain("checkInHousekeepingReturnFromState(history.state, propertySelect.value)");
    expect(sync).toContain("housekeepingConditionFilter.value = returning.roomCondition !== null ? returning.roomCondition : \"\"");
    expect(view).toContain("const arrivalReturn = syncCheckInHousekeepingContext()");
    expect(view).toContain("loadHousekeepingConditions().then");
    expect(view).toContain("restoreCheckInHousekeepingRoomFocus(arrivalReturn)");
    expect(open).not.toContain("request(");
    expect(open).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
  });

  test("focuses only exact authoritative condition-space truth or the safe condition heading", () => {
    const focus = functionSource("restoreCheckInHousekeepingRoomFocus");
    const load = functionSource("loadHousekeepingConditions");
    const current = functionSource("housekeepingConditionIsCurrent");
    expect(focus).toContain("housekeepingConditionRows");
    expect(focus).toContain("assignedSpaceId");
    expect(focus).toContain("roomCondition");
    expect(focus).toContain("housekeepingConditionList");
    expect(focus).toContain("candidate.dataset.spaceId === returning.assignedSpaceId");
    expect(focus).toContain("housekeepingConditionTitle");
    expect(focus).toContain("focus({ preventScroll: true })");
    expect(load).toContain("housekeepingConditionResult(await request(");
    expect(load).toContain("housekeepingConditionGeneration");
    expect(load).toContain("housekeepingConditionRequestGeneration");
    expect(current).toContain('activeView === "housekeeping"');
    expect(current).toContain('location.pathname === `/p/${property}/housekeeping`');
    expect(focus).not.toMatch(/task|occupancy|readiness(?:\s*===\s*(?:true|false))|ready(?:\s*===\s*(?:true|false))/i);
  });

  test("Back to arrival, Escape and browser history refetch reservation plus readiness truth", () => {
    const returning = functionSource("returnFromHousekeepingToCheckIn");
    const openDetail = functionSource("openReservationDetail");
    const syncReservation = functionSource("syncReservationRoute");
    const view = functionSource("setView");
    const readiness = functionSource("loadCheckInReadiness");
    const restore = functionSource("restoreCheckInHousekeepingArrivalFocus");
    expect(returning).toContain("checkInHousekeepingReturn");
    expect(returning).toContain("history.back()");
    expect(returning).toContain('setView("reservations", false)');
    expect(returning).toContain("reservationDrawerReturnView = returning.drawerReturnView");
    expect(returning).toContain("reservationDrawerReturnReservationId = returning.reservationId");
    expect(openDetail).toContain("loadReservationDetail(reservationId)");
    expect(syncReservation).toContain("openReservationDetail");
    expect(view).toContain("syncReservationRoute()");
    expect(readiness).toContain("/check-in/readiness");
    expect(restore).toContain("checkInHousekeepingReturn");
    expect(restore).toContain("checkInHeading");
    expect(restore).toContain("focus({ preventScroll: true })");
    expect(script).toContain('window.addEventListener("popstate"');
    expect(script).toContain("returnFromHousekeepingToCheckIn({ fromHistory: true })");
    expect(script).toContain("returnFromHousekeepingToCheckIn()");
    expect(script).toContain('event.key === "Escape"');
  });

  test("keeps direct Housekeeping unchanged and adds no write, storage, polling or inferred authority", () => {
    const fromState = functionSource("checkInHousekeepingReturnFromState");
    const current = functionSource("checkInHousekeepingActionIsCurrent");
    const sync = functionSource("syncCheckInHousekeepingContext");
    const open = functionSource("openCheckInHousekeeping");
    const returning = functionSource("returnFromHousekeepingToCheckIn");
    const roomFocus = functionSource("restoreCheckInHousekeepingRoomFocus");
    const arrivalFocus = functionSource("restoreCheckInHousekeepingArrivalFocus");
    const setView = functionSource("setView");
    expect(setView).toContain("loadHousekeepingBoard()");
    expect(setView).toContain("loadHousekeepingConditions()");
    expect(script).toContain("syncCheckInHousekeepingContext()");
    expect(script).toContain("hidden = returning === null");

    const continuity = [fromState, current, sync, open, returning, roomFocus, arrivalFocus].join("\n");
    expect(continuity).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
    expect(continuity).not.toMatch(/setInterval|setTimeout|localStorage|sessionStorage|indexedDB/);
    expect(continuity).not.toMatch(/submitCheckIn|submitHousekeepingAction|record_occupancy|release_occupancy|parking|onsite|accessAllowed|accessGranted/);
  });
});
