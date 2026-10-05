import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
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

describe("Order 231 canonical check-in room-assignment UI", () => {
  test("places one semantic assignment disclosure inside established check-in preparation", () => {
    const blocker = html.indexOf('id="checkin-blockers"');
    const assignment = html.indexOf('id="checkin-room-assignment"');
    const checkInForm = html.indexOf('id="checkin-form"');
    expect(blocker).toBeGreaterThan(-1);
    expect(assignment).toBeGreaterThan(blocker);
    expect(checkInForm).toBeGreaterThan(assignment);
    for (const id of [
      "checkin-room-assignment-heading", "checkin-room-assignment-form",
      "checkin-room-assignment-candidates", "checkin-room-assignment-submit",
      "checkin-room-assignment-refresh", "checkin-room-assignment-close",
      "checkin-room-assignment-message",
    ]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Assign selected room");
    expect(html).toContain("Assignment does not check in the guest or change housekeeping condition.");
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBe(new Set(ids).size);
  });

  test("exposes Assign room only from the exact current blocker and canonical route", () => {
    const render = functionSource("renderCheckInReadiness");
    expect(render).toContain('blocker === "room_assignment_missing"');
    expect(render).toContain("exactCheckInRoute");
    expect(render).toContain('node("button", "quiet checkin-room-assignment-action", "Assign room")');
    expect(render).toContain("readiness.segmentId === segment.segmentId");
    expect(render).toContain("readiness.assignedSpaceId === null");
    expect(render).toContain("openDueInRoomAssignment(origin, action)");
    expect(render).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
  });

  test("binds route, reservation, segment, generations and live DOM before every action", () => {
    const current = functionSource("dueInRoomAssignmentActionIsCurrent");
    for (const boundary of [
      'activeView === "reservations"', 'currentReservationWorkbench === "check-in"',
      "reservationDetailGeneration", "checkInReadinessGeneration", "propertySelect.value",
      "reservationRouteReservationId", "reservation.confirmationNo", 'reservation.status === "due_in"',
      'origin.expectedReservationStatus === "due_in"', 'origin.expectedSegmentStatus === "booked"',
      "segment.sequence", "segment.unitTypeId", "segment.sellableUnitId === null",
      "segment.from", "segment.to", "checkInReadinessData.segmentId", "assignedSpaceId === null",
      'blockers.includes("room_assignment_missing")', "canonicalCheckInWorkbenchPath",
      "reservationDetailDrawer.isConnected", "checkInBlockers.contains(item)", "item.contains(action)",
      "action.dataset.reservationId", "action.dataset.segmentId",
    ]) expect(current).toContain(boundary);
    const panel = functionSource("dueInRoomAssignmentPanelIsCurrent");
    expect(panel).toContain("dueInRoomAssignmentActionIsCurrent");
    expect(panel).toContain("dueInRoomAssignment.isConnected");
    expect(panel).toContain("reservationDetailDrawer.contains(dueInRoomAssignment)");
  });

  test("accepts only the minimized candidate envelope and never preselects a room", () => {
    const result = functionSource("dueInRoomAssignmentResult");
    const render = functionSource("renderDueInRoomAssignmentCandidates");
    expect(result).toContain('keys.join(",") !== "candidates"');
    expect(result).toContain('"floor,roomCondition,sellableUnitId,sellableUnitName,spaceCode,spaceId"');
    expect(result).toContain("sellableUnits.has");
    expect(result).toContain("spaces.has");
    expect(render).toContain('input.type = "radio"');
    expect(render).toContain("dueInRoomAssignmentSubmit.disabled = true");
    expect(render).toContain('candidate.roomCondition === null');
    expect(render).toContain('"No condition recorded"');
    expect(render).not.toMatch(/\.checked\s*=\s*true/);
    expect(result).not.toMatch(/availableCount|bookable|occupancy|hold|price|guest|contact/);
  });

  test("submits exact CAS evidence with stable retry and refetches canonical preparation", () => {
    const submit = functionSource("submitDueInRoomAssignment");
    for (const evidence of [
      "segmentId", "expectedReservationStatus", "expectedSegmentStatus", "expectedUnitTypeId",
      "expectedSellableUnitId", "expectedPeriod", "sellableUnitId",
    ]) expect(submit).toContain(evidence);
    expect(submit).toContain("dueInRoomAssignmentAttempt?.draft === draft");
    expect(submit).toContain('headers: { "idempotency-key": attempt.key }');
    expect(submit).toContain('method: "POST"');
    expect(submit).toContain("await loadReservationDetail(origin.reservationId)");
    expect(submit).toContain('error?.status === 409');
    expect(submit).toContain("dueInRoomAssignmentRefresh.focus");
    expect(submit).not.toMatch(/submitCheckIn|checkInSubmit\.click|checkInConfirm\.click|history\.(?:pushState|replaceState)/);
  });

  test("contains stale requests, Escape, success focus and direct-route history", () => {
    const load = functionSource("loadDueInRoomAssignmentCandidates");
    const clear = functionSource("clearDueInRoomAssignment");
    const focus = functionSource("restoreDueInRoomAssignmentSuccessFocus");
    expect(load).toContain("dueInRoomAssignmentRequestGeneration");
    expect(load).toContain("dueInRoomAssignmentPanelIsCurrent(origin)");
    expect(clear).toContain("dueInRoomAssignmentRequestGeneration += 1");
    expect(clear).toContain("dueInRoomAssignmentCandidates.replaceChildren()");
    expect(focus).toContain("checkInHousekeepingAction");
    expect(focus).toContain("reservationPrimaryFolioCreate");
    expect(focus).toContain("checkInHeading");
    expect(script).toContain('if (!dueInRoomAssignment.hidden)');
    expect(script).toContain("closeDueInRoomAssignment()");
    const continuity = [
      functionSource("openDueInRoomAssignment"), functionSource("closeDueInRoomAssignment"),
      functionSource("restoreDueInRoomAssignmentSuccessFocus"),
    ].join("\n");
    expect(continuity).not.toMatch(/history\.(?:pushState|replaceState)|localStorage|sessionStorage|indexedDB|setInterval|setTimeout/);
  });

  test("keeps room choices operable at phone zoom in every appearance", () => {
    expect(css).toContain(".checkin-room-assignment-action { display: flex; align-items: center; justify-content: center; min-width: 0; min-height: 44px;");
    expect(css).toContain(".checkin-room-assignment-candidates { display: grid; grid-template-columns: repeat(2,minmax(0,1fr));");
    expect(css).toContain("@media (max-width: 620px) { .checkin-room-assignment-candidates { grid-template-columns: minmax(0,1fr);");
    expect(css).toContain("@media (max-width: 420px)");
    expect(css).toContain("overflow-wrap: anywhere");
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .checkin-room-assignment`);
    }
    expect(css).toContain(':root[data-theme="android"] :is(.checkin-room-assignment-action');
    expect(css).toContain("min-height: 48px");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .checkin-room-assignment");
    expect(css).toContain("@media (forced-colors: active) { .checkin-room-assignment");
    expect(css).toContain("outline: 3px solid Highlight");
  });
});
