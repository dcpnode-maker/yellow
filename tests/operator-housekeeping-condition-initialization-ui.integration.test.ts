import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
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

describe("Order227 exact missing-room condition initialization UI", () => {
  test("only exact current room_condition_missing continuity may request the candidate", () => {
    const open = functionSource("openHousekeepingConditionInitialization");
    const current = functionSource("housekeepingConditionInitializationIsCurrent");
    expect(open).toContain('origin.blocker !== "room_condition_missing"');
    expect(open).toContain("origin.assignedSpaceId");
    expect(open).toContain("loadHousekeepingInitialConditionCandidate");
    expect(open).not.toMatch(/room_not_ready|housekeepingConditionRows.*find|condition === null/);
    for (const proof of [
      "checkInHousekeepingReturn",
      'activeView === "housekeeping"',
      "propertySelect.value",
      "housekeepingConditionGeneration",
      "housekeepingConditionRequestGeneration",
      "origin.assignedSpaceId",
      'origin.blocker === "room_condition_missing"',
      "action.isConnected",
      "action.hidden === false",
      "housekeepingConditionBoard.contains(action)",
    ]) expect(current).toContain(proof);
  });

  test("candidate response is minimized, absent-only and server-authorized", () => {
    const result = functionSource("housekeepingInitialConditionCandidateResult");
    expect(result).toContain('Object.keys(value).sort()');
    expect(result).toContain('"candidate"');
    expect(result).toContain('"allowedInitialConditions"');
    expect(result).toContain('"code"');
    expect(result).toContain('"floor"');
    expect(result).toContain('"roomCondition"');
    expect(result).toContain('"spaceId"');
    expect(result).toContain("candidate.roomCondition !== null");
    expect(result).toContain('["clean", "dirty", "pickup"]');
    expect(result).not.toContain("inspected");
  });

  test("renders one semantic inline disclosure with no selected or inferred default", () => {
    const render = functionSource("renderHousekeepingConditionInitialization");
    expect(render).toContain('node("button", "quiet housekeeping-condition-initialize-action", "Set initial condition")');
    expect(render).toContain('action.type = "button"');
    expect(render).toContain('action.setAttribute("aria-expanded", "false")');
    expect(render).toContain('action.setAttribute("aria-controls"');
    expect(render).toContain('node("form", "housekeeping-condition-initialization-form")');
    expect(render).toContain('node("fieldset", "housekeeping-condition-initialization-options")');
    expect(render).toContain('node("legend", "", "Initial room condition")');
    expect(render).toContain('input.type = "radio"');
    expect(render).toContain('input.name = "initial-room-condition"');
    expect(render).toContain('node("button", "primary", "Record initial condition")');
    expect(render).toContain('node("button", "quiet", "Cancel")');
    expect(render).toContain('role", "status"');
    expect(render).not.toMatch(/\.checked\s*=|defaultChecked|selectedIndex|inspected|infer|optimistic/i);
    expect(html).not.toContain('name="initial-room-condition" checked');
  });

  test("submission keeps one unchanged retry key and sends only the exact absence command", () => {
    const submit = functionSource("submitHousekeepingConditionInitialization");
    expect(script).toContain("const housekeepingConditionInitializationAttempts = new Map()")
    expect(submit).toContain("expectedRoomCondition: null");
    expect(submit).toContain("roomCondition");
    expect(submit).toContain("existing?.draft === draft ? existing : { draft, key: crypto.randomUUID() }");
    expect(submit).toContain('method: "POST"');
    expect(submit).toContain('headers: { "idempotency-key": attempt.key }');
    expect(submit).toContain("body: JSON.stringify(body)");
    expect(submit).toContain("/housekeeping/conditions/${enc(origin.assignedSpaceId)}/initialize");
    expect(submit).not.toMatch(/actorId|tenantId|propertyNode|updatedAt|updatedBy|task|occupancy|reservation|readiness|inspected/i);
  });

  test("success and conflict refetch server truth before exact-or-safe focus", () => {
    const refresh = functionSource("refreshHousekeepingConditionInitializationTruth");
    const submit = functionSource("submitHousekeepingConditionInitialization");
    const focus = functionSource("restoreHousekeepingConditionInitializationFocus");
    expect(refresh).toContain("loadHousekeepingInitialConditionCandidate");
    expect(refresh).toContain("loadHousekeepingConditions");
    expect(submit).toContain("error?.status === 409");
    expect(submit).toContain("await refreshHousekeepingConditionInitializationTruth");
    expect(submit).toContain("housekeepingConditionInitializationAttempts.delete");
    expect(focus).toContain("candidate.roomCondition === null");
    expect(focus).toContain("housekeepingConditionTitle");
    expect(focus).toContain("focus({ preventScroll: true })");
    expect(functionSource("returnFromHousekeepingToCheckIn")).toContain("checkInWorkbenchHeading");
  });

  test("the bounded UI adds no task, occupancy, readiness inference, storage or polling", () => {
    const bounded = [
      functionSource("loadHousekeepingInitialConditionCandidate"),
      functionSource("housekeepingConditionInitializationIsCurrent"),
      functionSource("renderHousekeepingConditionInitialization"),
      functionSource("submitHousekeepingConditionInitialization"),
      functionSource("refreshHousekeepingConditionInitializationTruth"),
      functionSource("restoreHousekeepingConditionInitializationFocus"),
    ].join("\n");
    expect(bounded).not.toMatch(/setInterval|setTimeout|localStorage|sessionStorage|EventSource|WebSocket/);
    expect(bounded).not.toMatch(/createTask|transitionTask|occupancy|ready\s*=|inspected/i);
  });

  test("inline controls contain at phone zoom and preserve all six appearances", () => {
    expect(css).toContain(".housekeeping-condition-initialize-action { min-width: 0; min-height: 44px;");
    expect(css).toContain(".housekeeping-condition-initialization-form { min-width: 0;");
    expect(css).toContain(".housekeeping-condition-initialization-options");
    expect(css).toContain("max-width: 100%");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("@media (max-width: 420px)");
    expect(css).toContain('@media (prefers-reduced-motion: reduce) { .housekeeping-condition-initialize-action');
    expect(css).toContain('@media (forced-colors: active) { .housekeeping-condition-initialize-action');
    expect(css).toContain(".housekeeping-condition-initialize-action:focus-visible { outline: 3px solid Highlight;");
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .housekeeping-condition-initialize-action`);
      expect(css).toContain(`:root[data-theme="${theme}"] .housekeeping-condition-initialization-form`);
    }
    expect(css).toContain(':root[data-theme="android"] .housekeeping-condition-initialize-action { min-height: 48px;');
  });
});
