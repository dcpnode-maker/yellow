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

describe("Order 217 exact housekeeping-task detail navigation", () => {
  test("admits only the exact nested route and preserves the literal board route", () => {
    const canonical = functionSource("canonicalHousekeepingTaskDetailPath");
    const route = functionSource("housekeepingTaskDetailRouteFromLocation");
    const navigation = functionSource("housekeepingNavigationRoute");
    expect(canonical).toContain("/housekeeping/tasks/${taskId}");
    expect(route).toContain("/housekeeping\\/tasks\\/([0-9a-f-]+)$");
    expect(route).toContain("canonicalUuid(match[1])");
    expect(route).toContain("canonicalUuid(match[2])");
    expect(navigation).toContain('kind: "detail"');
    expect(navigation).toContain('kind: "board"');
    expect(script).toContain('(?:\\/tasks\\/[0-9a-f-]+)?$/');
  });

  test("opens from one semantic board action and reads only the dedicated endpoint", () => {
    const card = functionSource("housekeepingTaskCard");
    const load = functionSource("loadHousekeepingTaskDetail");
    expect(card).toContain('"Open details"');
    expect(card).toContain("housekeeping-task-detail-action");
    expect(card).toContain("detail.dataset.taskId = task.taskId");
    expect(script).toContain('housekeepingTaskList.addEventListener("click"');
    expect(script).toContain("openHousekeepingTaskDetail(detail.dataset.taskId");
    expect(load).toContain("/housekeeping/tasks/${enc(origin.taskId)}");
    expect(load).toContain("housekeepingTaskDetailResult(body, origin)");
    expect(load).not.toContain("/housekeeping/tasks/${enc(origin.taskId)}?");
    expect(load).not.toMatch(/method\s*:|setInterval|setTimeout|poll/i);
  });

  test("validates the minimized envelope, routed identity, states and canonical instants", () => {
    const result = functionSource("housekeepingTaskDetailResult");
    expect(result).toContain('envelopeKeys === "task"');
    for (const field of [
      "taskId", "taskStatus", "spaceId", "spaceCode", "floor", "roomCondition",
      "roomUpdatedAt", "assigned", "dueAt", "priority", "completedAt",
    ]) expect(result).toContain(field);
    expect(result).toContain("task.taskId !== origin.taskId");
    for (const status of ["assigned", "in_progress", "done"]) expect(result).toContain(`"${status}"`);
    expect(result).not.toMatch(/payload|notes|credits|sheet|assignee|party|contact|updater|reservation|guest|occupancy|discrepancy/i);
    expect(result).toContain("Object.freeze");

    const instant = functionSource("housekeepingCanonicalInstant");
    expect(instant).toContain("\\.\\d{6}Z");
    expect(instant).toContain("Number.isFinite(instant.getTime())");
    expect(instant).toContain("instant.toISOString() === millisecondInstant");
  });

  test("guards property, task, request, view, path and connected-panel identity before paint", () => {
    expect(script).toContain("let housekeepingTaskDetailRequestGeneration = 0");
    const guard = functionSource("housekeepingTaskDetailRequestIsCurrent");
    for (const proof of [
      "origin.requestGeneration === housekeepingTaskDetailRequestGeneration",
      'activeView === "housekeeping"',
      "origin.property === propertySelect.value",
      "origin.taskId === housekeepingRouteTaskId",
      "panel.isConnected",
      "panel.hidden === false",
      'housekeepingView.classList.contains("is-task-detail")',
      "canonicalHousekeepingTaskDetailPath(origin.property, origin.taskId)",
    ]) expect(guard).toContain(proof);
    expect(functionSource("loadHousekeepingTaskDetail").match(/housekeepingTaskDetailRequestIsCurrent\(origin, panel\)/g)?.length)
      .toBeGreaterThanOrEqual(4);
  });

  test("supports direct refresh, Back, Forward, Escape, board return and focus restoration", () => {
    const open = functionSource("openHousekeepingTaskDetail");
    const close = functionSource("closeHousekeepingTaskDetail");
    const sync = functionSource("syncHousekeepingRoute");
    expect(open).toContain('yellowSurface: "housekeeping-task-detail"');
    expect(open).toContain("housekeepingTaskDetailReturnFocus = trigger");
    expect(close).toContain("/p/${propertySelect.value}/housekeeping");
    expect(close).toContain("history.back()");
    expect(close).toContain("returnFocus?.isConnected");
    expect(close).toContain("focus({ preventScroll: true })");
    expect(sync).toContain("housekeepingNavigationRoute()");
    expect(sync).toContain('route.kind === "detail"');
    expect(sync).toContain("openHousekeepingTaskDetail");
    expect(sync).toContain("closeHousekeepingTaskDetail");
    expect(script).toContain('activeView === "housekeeping" && event.key === "Escape"');
    expect(script).toContain('window.addEventListener("popstate"');
    expect(script).toContain("syncHousekeepingRoute");
  });

  test("detail remains read-only, mutation-free and non-polling", () => {
    const detail = [
      functionSource("renderHousekeepingTaskDetail"),
      functionSource("loadHousekeepingTaskDetail"),
      functionSource("openHousekeepingTaskDetail"),
      functionSource("closeHousekeepingTaskDetail"),
    ].join("\n");
    expect(detail).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
    expect(detail).not.toMatch(/setInterval|setTimeout|localStorage|sessionStorage|EventSource|WebSocket/);
    expect(detail).not.toMatch(/submitHousekeepingAction|housekeepingAttempts|allowedActions|eligibleAction/);
    expect(detail).toContain("Read only");
  });
});
