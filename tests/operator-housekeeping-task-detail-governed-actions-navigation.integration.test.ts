import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const http = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");

function functionSource(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const opening = source.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = opening; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

describe("Order 220 housekeeping-task detail governed action navigation", () => {
  test("accepts only a compatible frozen zero-or-one server action", () => {
    const result = functionSource(script, "housekeepingTaskDetailResult");
    expect(result).toContain('"allowedActions"');
    expect(result).toContain("allowedActions.length > 1");
    expect(result).toContain('allowedAction === "start" && task.taskStatus === "assigned" && task.assigned === true');
    expect(result).toContain('allowedAction === "complete" && task.taskStatus === "in_progress"');
    expect(result).toContain('["dirty", "pickup"].includes(task.roomCondition)');
    expect(result).toContain('allowedAction === "verify" && task.taskStatus === "done" && task.roomCondition === "clean"');
    expect(result).toContain("Object.hasOwn(HOUSEKEEPING_ACTION_LABELS, allowedAction)");
    expect(result).toContain("Object.freeze({ ...task, allowedActions: Object.freeze(allowedActions.slice()) })");

    const render = functionSource(script, "renderHousekeepingTaskDetail");
    expect(render).toContain('node("button", "primary housekeeping-task-detail-governed-action", HOUSEKEEPING_ACTION_LABELS[action])');
    expect(render).toContain('const action = task.allowedActions[0] || ""');
    expect((render.match(/governedAction\.append\(button\)/g) || []).length).toBe(1);
  });

  test("derives detail authority from the existing distinct work and inspect grants", () => {
    const projection = functionSource(http, "operatorHousekeepingTaskDetail");
    expect(http).toContain('if (task.taskStatus === "assigned" && task.assigned) return "start"');
    expect(http).toContain('if (task.taskStatus === "in_progress" && (task.roomCondition === "dirty" || task.roomCondition === "pickup"))');
    expect(http).toContain('if (task.taskStatus === "done" && task.roomCondition === "clean") return "verify"');
    expect(projection).toContain("allowedHousekeepingActions(");
    expect(projection).toContain("housekeepingTaskDetailEligibleAction(task)");
    expect(projection).toContain("workGranted");
    expect(projection).toContain("inspectGranted");
    expect(http).toContain("HOUSEKEEPING_WORK_SCOPE");
    expect(http).toContain("HOUSEKEEPING_INSPECT_SCOPE");
  });

  test("rechecks every exact stale identity and mounted-surface boundary before submission", () => {
    const current = functionSource(script, "housekeepingTaskDetailActionIsCurrent");
    for (const proof of [
      "origin.requestGeneration === housekeepingTaskDetailRequestGeneration",
      'activeView === "housekeeping"',
      "origin.property === propertySelect.value",
      "origin.taskId === housekeepingRouteTaskId",
      "task.taskId === origin.taskId",
      "task.taskStatus === origin.taskStatus",
      "task.roomCondition === origin.roomCondition",
      "task.roomUpdatedAt === origin.roomUpdatedAt",
      "task.allowedActions.length === 1",
      "task.allowedActions[0] === origin.action",
      "housekeepingTaskDetailPanel === panel",
      "panel.isConnected",
      "panel.hidden === false",
      'housekeepingView.classList.contains("is-task-detail")',
      "content?.hidden === false",
      "button.isConnected",
      "content.contains(button)",
      'button.classList.contains("housekeeping-task-detail-governed-action")',
      "button.dataset.taskId === origin.taskId",
      "button.dataset.action === origin.action",
      "button.dataset.expectedTaskStatus === origin.taskStatus",
      "button.dataset.expectedRoomCondition === origin.roomCondition",
      "button.dataset.expectedRoomUpdatedAt === origin.roomUpdatedAt",
      "canonicalHousekeepingTaskDetailPath(origin.property, origin.taskId)",
      'location.search === ""',
    ]) expect(current).toContain(proof);
    expect(functionSource(script, "submitHousekeepingTaskDetailAction")).toContain(
      "if (!housekeepingTaskDetailActionIsCurrent(origin, panel, button)) return",
    );
  });

  test("submits only the existing exact transition body and actor-bound retry transport", () => {
    const submit = functionSource(script, "submitHousekeepingTaskDetailAction");
    expect(submit).toContain("action: origin.action");
    expect(submit).toContain("expectedTaskStatus: origin.taskStatus");
    expect(submit).toContain("expectedRoomCondition: origin.roomCondition");
    expect(submit).toContain("expectedRoomUpdatedAt: origin.roomUpdatedAt");
    expect(submit).toContain("/housekeeping/tasks/${enc(origin.taskId)}/transition");
    expect(submit).toContain('method: "POST"');
    expect(submit).toContain('headers: { "idempotency-key": attempt.key }');
    expect(submit).toContain("body: JSON.stringify(body)");
    expect(submit).not.toMatch(/targetStatus|actorId|tenantId|assignee|spaceId|notes|payload/);
  });

  test("retains an unchanged retry key and replaces only a changed draft", () => {
    const submit = functionSource(script, "submitHousekeepingTaskDetailAction");
    expect(script).toContain("const housekeepingTaskDetailAttempts = new Map()");
    expect(submit).toContain("housekeepingTaskDetailAttempts.get(origin.taskId)");
    expect(submit).toContain("existing?.draft === draft ? existing : { draft, key: crypto.randomUUID() }");
    expect(submit).toContain("housekeepingTaskDetailAttempts.set(origin.taskId, attempt)");
    expect(submit).toContain("Retry this unchanged action to keep the same idempotency key");
    expect(submit).toContain("button.disabled = false");
    expect(submit).toContain("button.focus({ preventScroll: true })");
  });

  test("refreshes exact detail, board and room-condition truth after start, complete or conflict", () => {
    const refresh = functionSource(script, "refreshHousekeepingTaskDetailActionTruth");
    const submit = functionSource(script, "submitHousekeepingTaskDetailAction");
    expect(refresh).toContain("loadHousekeepingTaskDetail(origin.taskId, { focus: true })");
    expect(refresh).toContain("loadHousekeepingBoard({ detailTaskId: origin.taskId })");
    expect(refresh).toContain("loadHousekeepingConditions({ detailTaskId: origin.taskId })");
    expect(submit).toContain('if (origin.action === "verify")');
    expect(submit).toContain("else await refreshHousekeepingTaskDetailActionTruth(origin)");
    expect(submit).toContain("error?.status === 409");
    expect(submit).toContain("housekeepingTaskDetailAttempts.delete(origin.taskId)");
    expect(submit).toContain("await refreshHousekeepingTaskDetailActionTruth(origin)");
  });

  test("Verify exits the ineligible detail to refreshed board truth with safe focus and history", () => {
    const exit = functionSource(script, "exitVerifiedHousekeepingTaskDetail");
    expect(exit).toContain("housekeepingReturnFocus = origin.taskId");
    expect(exit).toContain("closeHousekeepingTaskDetail({ history: false, restoreFocus: false })");
    expect(exit).toContain("history.replaceState(null, \"\", `/p/${origin.property}/housekeeping`)");
    expect(exit).toContain("loadHousekeepingBoard({ focus: true })");
    expect(exit).toContain("loadHousekeepingConditions()");

    const close = functionSource(script, "closeHousekeepingTaskDetail");
    expect(close).toContain('history.state?.yellowSurface === "housekeeping-task-detail"');
    expect(close).toContain("history.back()");
    expect(close).toContain("returnFocus?.isConnected");
    expect(script).toContain('activeView === "housekeeping" && event.key === "Escape"');
    expect(script).toContain('window.addEventListener("popstate"');
    expect(script).toContain("syncHousekeepingRoute");
  });

  test("adds no new polling, browser storage or optimistic lifecycle authority", () => {
    const detailAction = [
      functionSource(script, "housekeepingTaskDetailActionIsCurrent"),
      functionSource(script, "refreshHousekeepingTaskDetailActionTruth"),
      functionSource(script, "exitVerifiedHousekeepingTaskDetail"),
      functionSource(script, "submitHousekeepingTaskDetailAction"),
    ].join("\n");
    expect(detailAction).not.toMatch(/setInterval|setTimeout|localStorage|sessionStorage|EventSource|WebSocket/);
    expect(detailAction).not.toMatch(/targetStatus|optimistic|assignment|createTask|cancelTask|reopen/i);
  });
});
