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

describe("Order 215 reservation pickup-task detail navigation", () => {
  test("admits the exact nested route while preserving plain reservation routing", () => {
    const route = functionSource("reservationRoute");
    const navigation = functionSource("reservationNavigationRoute");
    expect(functionSource("reservationPickupTaskRoute")).toContain("pickup-task");
    expect(navigation).toContain("reservationPickupTaskRoute()");
    expect(navigation).toContain('kind: "pickup-task"');
    expect(navigation).toContain("return reservationRoute()");
    expect(route).toContain('kind: "detail"');
    expect(script).toContain("function canonicalReservationPickupTaskPath(");
    expect(script).toContain('yellowSurface: "reservation-pickup-task-detail"');
    expect(script).toContain('(?:\\/pickup-task\\/[0-9a-f-]+)?$/.test(location.pathname)');
  });

  test("only exact linked arrival truth exposes the semantic action and dedicated read", () => {
    const travel = functionSource("reservationTravelDetailCollection");
    expect(travel).toContain("reservationPickupTaskAction(item, pickup)");
    const action = functionSource("reservationPickupTaskAction");
    expect(action).toContain('pickup.state !== "task-linked"');
    expect(action).toContain('textContent = "Open pickup task"');
    expect(action).toContain('className = "secondary pickup-task-detail-action"');
    expect(action).toContain("item.pickupTaskId");
    expect(action).toContain("openReservationPickupTaskDetail");

    const load = functionSource("loadReservationPickupTaskDetail");
    expect(load).toContain("/reservations/${enc(origin.reservationId)}/arrival-pickup-task/${enc(origin.taskId)}");
    expect(load).not.toMatch(/method\s*:|setInterval|setTimeout|poll/i);
  });

  test("validates only the exact minimized envelope and every declared task status", () => {
    const result = functionSource("reservationPickupTaskDetailResult");
    expect(result).toContain('Object.keys(value).sort().join(",") !== "pickupTask"');
    for (const field of [
      "taskId", "reservationId", "confirmationNo", "status", "dueAt", "priority", "createdAt", "completedAt",
    ]) expect(result).toContain(field);
    for (const status of ["open", "assigned", "in_progress", "done", "verified", "cancelled"]) {
      expect(result).toContain(`"${status}"`);
    }
    expect(result).not.toMatch(/payload|assignee|contact|driver|vehicle|dispatch|queue|sheet|credit/i);
    const instant = functionSource("reservationPickupTaskCanonicalInstant");
    expect(instant).toContain("(?:\\.\\d{1,6})?Z");
    expect(instant).toContain("Number.isFinite(Date.parse(value))");
    expect(instant).not.toContain("toISOString() === value");
  });

  test("guards every stale identity boundary before painting or focusing", () => {
    expect(script).toContain("let reservationPickupTaskRequestGeneration = 0");
    const guard = functionSource("reservationPickupTaskRequestIsCurrent");
    for (const proof of [
      "origin.requestGeneration === reservationPickupTaskRequestGeneration",
      "origin.detailGeneration === reservationDetailGeneration",
      "origin.property === propertySelect.value",
      "origin.reservationId === reservationRouteReservationId",
      "origin.taskId === reservationRoutePickupTaskId",
      "reservationDetailData?.reservation?.reservationId === origin.reservationId",
      "reservationDetailData.reservation.confirmationNo === origin.confirmationNo",
      "reservationDetailDrawer.hidden === false",
      'classList.contains("pickup-task-detail-panel")',
      "canonicalReservationPickupTaskPath(origin.property, origin.reservationId, origin.taskId)",
    ]) expect(guard).toContain(proof);
  });

  test("Back, Forward, direct refresh and Escape preserve the reservation and focus path", () => {
    const sync = functionSource("syncReservationRoute");
    expect(sync).toContain('route.kind === "pickup-task"');
    expect(sync).toContain("openReservationPickupTaskRoute");
    expect(functionSource("openReservationPickupTaskRoute")).toContain("openReservationPickupTaskDetail");
    expect(sync).toContain("closeReservationPickupTaskDetail");

    const close = functionSource("closeReservationPickupTaskDetail");
    expect(close).toContain('reservationExitHistoryAction(history.state, "reservation-pickup-task-detail") === "back"');
    expect(close).toContain("history.back()");
    expect(close).toContain("/p/${propertySelect.value}/res/${reservationId}");
    expect(close).toContain("focus({ preventScroll: true })");

    const escapeStart = script.indexOf('if (event.key === "Escape")');
    const escape = script.slice(escapeStart, script.indexOf("if (editable", escapeStart));
    expect(escape).toContain("reservationRoutePickupTaskId");
    expect(escape).toContain("closeReservationPickupTaskDetail()");
  });

  test("the nested surface remains read-only and does not acquire generic task authority", () => {
    const open = functionSource("openReservationPickupTaskDetail");
    const render = functionSource("renderReservationPickupTaskDetail");
    expect(open).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
    expect(render).not.toMatch(/assign task|dispatch task|complete task|cancel task|edit task/i);
    expect(functionSource("loadReservationPickupTaskDetail")).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/i);
  });
});
