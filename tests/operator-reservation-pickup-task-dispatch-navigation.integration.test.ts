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

describe("Order 228 reservation pickup-task dispatch navigation", () => {
  test("accepts only the exact enriched detail and compatible zero-or-one action", () => {
    const result = functionSource("reservationPickupTaskDetailResult");
    expect(result).toContain('"assigneePartyId"');
    expect(result).toContain('"eligibleAction"');
    expect(result).toContain('eligibleAction === "assign" && task.status === "open" && task.assigneePartyId === null');
    expect(result).toContain('eligibleAction === "start" && task.status === "assigned"');
    expect(result).toContain('eligibleAction === "complete" && task.status === "in_progress"');
    expect(result).toContain("Object.hasOwn(RESERVATION_PICKUP_TASK_ACTION_LABELS, eligibleAction)");
  });

  test("renders detached assignment, start, complete or no action from server truth", () => {
    const render = functionSource("renderReservationPickupTaskDetail");
    expect(render).toContain('task.eligibleAction === "assign"');
    expect(render).toContain("reservationPickupTaskAssignmentPicker(panel, task)");
    expect(render).toContain('task.eligibleAction === "start" || task.eligibleAction === "complete"');
    expect(render).toContain("RESERVATION_PICKUP_TASK_ACTION_LABELS[task.eligibleAction]");
    expect(render).toContain("No action is permitted for your current grant and this server state.");
    expect(render).toContain('task.assigneePartyId === null ? "Unassigned" : "Assigned"');
    expect(render).not.toMatch(/email|phone|whatsapp|contact/i);
  });

  test("reuses bounded Party search while retaining only permitted staff identity", () => {
    const search = functionSource("searchReservationPickupTaskStaff");
    expect(search).toContain("/parties:search");
    expect(search).toContain('body: JSON.stringify({ query, limit: 20 })');
    expect(search).toContain('profile.roles.includes("staff")');
    expect(search).toContain("partyId: String(profile.partyId), displayName: profile.displayName");
    expect(search).not.toMatch(/email|phone|whatsapp|contact|legalName/i);
    const picker = functionSource("reservationPickupTaskAssignmentPicker");
    expect(picker).toContain('role", "region"');
    expect(picker).toContain('aria-live", "polite"');
    expect(picker).toContain('type = "search"');
    expect(picker).toContain('type = "submit"');
    expect(picker).toContain("Choose one active staff Party");
  });

  test("guards route, detail, task, assignment, action, panel and connected control", () => {
    const guard = functionSource("reservationPickupTaskActionIsCurrent");
    for (const proof of [
      "origin.requestGeneration === reservationPickupTaskRequestGeneration",
      "origin.detailGeneration === reservationDetailGeneration",
      "origin.property === propertySelect.value",
      "origin.reservationId === reservationRouteReservationId",
      "origin.taskId === reservationRoutePickupTaskId",
      "origin.confirmationNo === reservationDetailData?.reservation?.confirmationNo",
      "task.status === origin.taskStatus",
      "task.assigneePartyId === origin.assigneePartyId",
      "task.eligibleAction === origin.action",
      'classList.contains("is-pickup-task-detail")',
      "content.contains(control)",
      "control.dataset.expectedTaskStatus === origin.taskStatus",
      "control.dataset.expectedAssigneePartyId === (origin.assigneePartyId || \"\")",
      "canonicalReservationPickupTaskPath(origin.property, origin.reservationId, origin.taskId)",
      'location.search === ""',
    ]) expect(guard).toContain(proof);
    expect(functionSource("reservationPickupTaskStaffSearchIsCurrent"))
      .toContain("generation === reservationPickupTaskStaffSearchGeneration");
  });

  test("submits strict action-specific evidence with stable retry idempotency", () => {
    const submit = functionSource("submitReservationPickupTaskAction");
    expect(submit).toContain('? { expectedTaskStatus: "open", expectedAssigneePartyId: null, staffPartyId }');
    expect(submit).toContain(': { expectedTaskStatus: origin.taskStatus, expectedAssigneePartyId: origin.assigneePartyId }');
    expect(submit).toContain("/arrival-pickup-task/${enc(origin.taskId)}/${enc(origin.action)}");
    expect(submit).toContain('method: "POST"');
    expect(submit).toContain('headers: { "idempotency-key": attempt.key }');
    expect(submit).toContain("existing?.draft === draft ? existing : { draft, key: crypto.randomUUID() }");
    expect(submit).toContain("for (const item of controls) item.disabled = true");
    expect(submit).not.toMatch(/localStorage|sessionStorage|setInterval|poll/i);
  });

  test("treats receipts as transient and refetches authoritative detail on success or conflict", () => {
    const submit = functionSource("submitReservationPickupTaskAction");
    expect(submit).toContain("await refreshReservationPickupTaskActionTruth(origin)");
    expect(submit).toContain("error?.status === 409");
    expect(submit).toContain("reservationPickupTaskAttempts.delete(origin.taskId)");
    expect(submit).not.toMatch(/result\.|receipt\.|taskStatus\s*=|assigneePartyId\s*=/);
    const refresh = functionSource("refreshReservationPickupTaskActionTruth");
    expect(refresh).toContain("await loadReservationPickupTaskDetail(panel, reservation, origin.taskId)");
    expect(refresh).toContain("focusReservationPickupTaskCurrentAction()");
    const focus = functionSource("focusReservationPickupTaskCurrentAction");
    expect(focus).toContain(".pickup-task-assignee-query,.pickup-task-detail-governed-action:not(:disabled),#pickup-task-detail-title");
  });

  test("navigation cleanup invalidates searches, selection and command attempts", () => {
    const close = functionSource("closeReservationPickupTaskDetail");
    expect(close).toContain("clearReservationPickupTaskActionDraft({ clearAttempts: true })");
    const clear = functionSource("clearReservationPickupTaskActionDraft");
    expect(clear).toContain("reservationPickupTaskStaffSearchGeneration += 1");
    expect(clear).toContain("reservationPickupTaskStaffSelection = null");
    expect(clear).toContain("reservationPickupTaskAttempts.clear()");
  });
});
