import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

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

describe("Order230 exact arrival cleaning-task to check-in continuity", () => {
  test("admits a minimized frozen descriptor only from both exact Order229 task outcomes", () => {
    const descriptor = functionSource("arrivalCleaningCheckInReturnDescriptor");
    const renderArrival = functionSource("renderArrivalRoomCleaningTask");

    for (const identity of [
      "property", "reservationId", "confirmationNo", "blocker", "assignedSpaceId",
      "roomCondition", "taskId", "originPath", "detailGeneration", "readinessGeneration",
    ]) expect(descriptor).toContain(identity);
    expect(descriptor).toContain('origin.blocker !== "dirty_room_override_unauthorized"');
    expect(descriptor).toContain("origin.returning !== checkInHousekeepingReturn");
    expect(descriptor).toContain("canonicalUuid(taskId)");
    expect(descriptor).toContain("canonicalCheckInWorkbenchPath(origin.property, origin.reservationId)");
    expect(descriptor).toContain("Object.freeze({");

    expect(renderArrival).toContain(
      "arrivalCleaningCheckInReturnDescriptor(origin, state.candidate.existingTaskId)",
    );
    expect(renderArrival).toContain(
      "arrivalCleaningCheckInReturnDescriptor(origin, value.taskId)",
    );
    expect(renderArrival.match(/openHousekeepingTaskDetail\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(renderArrival).toContain("arrivalReturn");
  });

  test("reconstructs only the exact canonical history descriptor and rejects extra or stale shape", () => {
    const fromState = functionSource("arrivalCleaningCheckInReturnFromState");
    expect(fromState).toContain('state?.yellowSurface !== "housekeeping-task-detail"');
    expect(fromState).toContain("state?.arrivalCleaningCheckInReturn");
    expect(fromState).toContain("Object.keys(value).sort().join");
    expect(fromState).toContain("canonicalUuid");
    expect(fromState).toContain('value.blocker !== "dirty_room_override_unauthorized"');
    expect(fromState).toContain('value.roomCondition !== "dirty"');
    expect(fromState).toContain('value.roomCondition !== "pickup"');
    expect(fromState).toContain("value.taskId !== taskId");
    expect(fromState).toContain("canonicalHousekeepingTaskDetailPath(value.property, value.taskId)");
    expect(fromState).toContain("canonicalCheckInWorkbenchPath(value.property, value.reservationId)");
    expect(fromState).toContain("Object.freeze({ ...value })");
  });

  test("binds every property, reservation, blocker, room, task, route, view, data, generation and DOM boundary", () => {
    const current = functionSource("arrivalCleaningCheckInReturnIsCurrent");
    for (const boundary of [
      "arrivalCleaningCheckInReturnFromState(history.state, propertySelect.value, housekeepingRouteTaskId)",
      "current !== null",
      "returning !== null",
      "current.property === returning.property",
      "current.reservationId === returning.reservationId",
      "current.confirmationNo === returning.confirmationNo",
      "current.blocker === returning.blocker",
      "current.assignedSpaceId === returning.assignedSpaceId",
      "current.roomCondition === returning.roomCondition",
      "current.originPath === returning.originPath",
      "current.taskId === returning.taskId",
      "current.taskPath === returning.taskPath",
      "returning.property === propertySelect.value",
      "returning.taskId === housekeepingRouteTaskId",
      'returning.blocker === "dirty_room_override_unauthorized"',
      "returning.assignedSpaceId",
      "returning.roomCondition",
      'activeView === "housekeeping"',
      "returning.housekeepingGeneration === housekeepingGeneration",
      "returning.housekeepingConditionGeneration === housekeepingConditionGeneration",
      "returning.taskDetailRequestGeneration === housekeepingTaskDetailRequestGeneration",
      "task?.taskId === returning.taskId",
      "task.spaceId === returning.assignedSpaceId",
      "housekeepingTaskDetailPanel === panel",
      "panel?.isConnected",
      "panel.hidden === false",
      'housekeepingView.classList.contains("is-task-detail")',
      "canonicalHousekeepingTaskDetailPath(returning.property, returning.taskId)",
      'location.search === ""',
      "action?.isConnected",
      "action.hidden === false",
      "action.disabled === false",
      "content.contains(action)",
      "action.dataset.taskId === returning.taskId",
    ]) expect(current).toContain(boundary);
  });

  test("renders one deliberate contextual return without adopting generic Housekeeping detail", () => {
    const render = functionSource("renderHousekeepingTaskDetail");
    const contextual = functionSource("renderHousekeepingTaskDetailArrivalReturn");
    expect(render).toContain("renderHousekeepingTaskDetailArrivalReturn(panel, task)");
    expect(render).toContain("...(arrivalReturn ? [arrivalReturn] : [])");
    expect(contextual).toContain("housekeeping-task-detail-arrival-return");
    expect(contextual).toContain('"Back to arrival"');
    expect(contextual).toContain('"Continue check-in preparation"');
    expect(contextual).toContain('task.taskStatus === "done"');
    expect(contextual).toContain('task.roomCondition === "clean"');
    expect(contextual).toContain("returnFromArrivalCleaningTaskToCheckIn");
    expect(contextual).toContain("rebaseArrivalCleaningCheckInReturn(task)");

    const generic = functionSource("openHousekeepingTaskDetail");
    expect(generic).toContain("arrivalReturn = null");
    expect(generic).toContain("arrivalCleaningCheckInReturnFromState");
    expect(generic).toContain("arrivalCleaningCheckInReturn");
  });

  test("preserves context through governed Start, Complete, conflict refresh and Verify board exit", () => {
    const submit = functionSource("submitHousekeepingTaskDetailAction");
    const refresh = functionSource("refreshHousekeepingTaskDetailActionTruth");
    const verifyExit = functionSource("exitVerifiedHousekeepingTaskDetail");
    const rebase = functionSource("rebaseArrivalCleaningCheckInReturn");
    expect(submit).toContain("await refreshHousekeepingTaskDetailActionTruth(origin)");
    expect(submit).toContain('error?.status === 409');
    expect(submit).toContain('if (origin.action === "verify")');
    expect(refresh).toContain("loadHousekeepingTaskDetail(origin.taskId");
    expect(refresh).toContain("loadHousekeepingBoard({ detailTaskId: origin.taskId })");
    expect(refresh).toContain("loadHousekeepingConditions({ detailTaskId: origin.taskId })");
    expect(rebase).toContain("arrivalCleaningCheckInReturnFromState(history.state");
    expect(rebase).toContain("task?.taskId !== housekeepingRouteTaskId");
    expect(rebase).toContain("task.spaceId !== returning.assignedSpaceId");
    expect(rebase).toContain("location.pathname !== returning.taskPath");
    expect(rebase).toContain("taskDetailRequestGeneration: housekeepingTaskDetailRequestGeneration");
    expect(rebase).toContain("history.replaceState({ ...history.state, arrivalCleaningCheckInReturn: current }");
    expect(verifyExit).toContain("arrivalCleaningCheckInReturn");
    expect(verifyExit).toContain("arrivalCleaningCheckInReturnFromState");
    expect(verifyExit).toContain("history.replaceState");
    expect(verifyExit).toContain('yellowSurface: "housekeeping"');
    expect(verifyExit).toContain("checkInHousekeepingReturn");
  });

  test("one deliberate return reopens canonical check-in and refetches reservation plus readiness without checking in", () => {
    const returning = functionSource("returnFromArrivalCleaningTaskToCheckIn");
    const current = functionSource("arrivalCleaningCheckInReturnIsCurrent");
    expect(returning).toContain("arrivalCleaningCheckInReturnIsCurrent");
    expect(current).toContain("canonicalCheckInWorkbenchPath(returning.property, returning.reservationId)");
    expect(returning).toContain("checkInHousekeepingReturn");
    expect(returning).toContain("setView(\"reservations\", false)");
    expect(returning).toContain("openReservationDetail");
    expect(returning).toContain('workbench: "check-in"');
    expect(returning).not.toMatch(/submitCheckIn|checkInConfirm\.click|checkInSubmit\.click/);

    const detail = functionSource("openReservationDetail");
    const renderDetail = functionSource("renderReservationDetail");
    const workbench = functionSource("applyReservationWorkbenchIntent");
    const readiness = functionSource("loadCheckInReadiness");
    expect(detail).toContain("loadReservationDetail(reservationId)");
    expect(renderDetail).toContain("applyReservationWorkbenchIntent(reservation)");
    expect(workbench).toContain("loadCheckInReadiness({ focus: checkInCompatible })");
    expect(readiness).toContain("/check-in/readiness");
  });

  test("refresh and Forward restore valid context while Escape and Back remain board-first", () => {
    const sync = functionSource("syncHousekeepingRoute");
    const close = functionSource("closeHousekeepingTaskDetail");
    expect(sync).toContain("arrivalCleaningCheckInReturnFromState(history.state");
    expect(sync).toContain("openHousekeepingTaskDetail");
    expect(sync).toContain("arrivalReturn");
    expect(close).toContain('history.state?.yellowSurface === "housekeeping-task-detail"');
    expect(close).toContain("history.back()");
    expect(close).toContain("returnFocus?.isConnected");
    expect(script).toContain('activeView === "housekeeping" && event.key === "Escape" && housekeepingRouteTaskId');
    expect(script).toContain('window.addEventListener("popstate"');
    expect(script).toContain("syncHousekeepingRoute");
  });

  test("adds no request, storage, polling, inferred readiness or automatic mutation transport", () => {
    const continuity = [
      functionSource("arrivalCleaningCheckInReturnDescriptor"),
      functionSource("arrivalCleaningCheckInReturnFromState"),
      functionSource("arrivalCleaningCheckInReturnIsCurrent"),
      functionSource("returnFromArrivalCleaningTaskToCheckIn"),
    ].join("\n");
    expect(continuity).not.toMatch(/request\(|fetch\(|setInterval|setTimeout|localStorage|sessionStorage|indexedDB|EventSource|WebSocket/);
    expect(continuity).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
    expect(continuity).not.toMatch(/submitCheckIn|submitHousekeepingTaskDetailAction|record_occupancy|release_occupancy/);
    expect(continuity).not.toMatch(/canCheckIn\s*=(?!=)|ready\s*=(?!=)|taskStatus\s*=(?!=)|roomCondition\s*=(?!=)/);
  });
});
