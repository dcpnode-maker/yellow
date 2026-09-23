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

describe("Order 221 exact housekeeping-sheet task receipt navigation", () => {
  test("validates and deeply freezes one bounded exact generation receipt", () => {
    const parse = functionSource("parseHousekeepingGenerationReceipt");
    for (const field of [
      "sheetId", "sheetDate", "attendantPartyId", "taskCount", "tasks", "replayed",
      "taskId", "spaceId", "spaceCode", "profileKey", "cadence",
    ]) expect(parse).toContain(field);
    expect(parse).toContain("canonicalUuid");
    expect(parse).toContain("taskCount");
    expect(parse).toMatch(/tasks\.length|\.length\s*!==\s*(?:value\.)?taskCount/);
    expect(parse).toContain("new Set");
    expect(parse).toMatch(/taskIds|taskIdentit|task\.taskId/);
    expect(parse).toMatch(/spaceIds|spaceIdentit|task\.spaceId/);
    expect(parse).toContain('"daily"');
    expect(parse).toContain('"on_departure"');
    expect(parse).toContain("Object.freeze");
    expect(parse.match(/Object\.freeze/g)?.length).toBeGreaterThanOrEqual(3);
    expect(parse).not.toMatch(/weekly|custom|payload|notes|guest|reservation|occupancy|localStorage|sessionStorage/i);
  });

  test("retains successful and replayed results only after exact current continuity checks", () => {
    const generate = functionSource("generateHousekeepingSheet");
    expect(generate).toContain("parseHousekeepingGenerationReceipt");
    expect(generate).toContain("housekeepingSheetIsCurrent(generation, requestGeneration, property, sheetDate)");
    expect(generate).toContain("attendantPartyId");
    expect(generate).toMatch(/renderHousekeepingSheetTaskReceipt|renderHousekeepingGenerationReceipt/);
    expect(generate).toContain("result.replayed");
    expect(generate).toContain("housekeepingSheetAttemptKey = \"\"");
    expect(generate).toContain("housekeepingSheetAttemptDraft = \"\"");
  });

  test("makes property, date, attendant, receipt generation, task and visible route identity mandatory", () => {
    const open = functionSource("openGeneratedHousekeepingTaskDetail");
    for (const proof of [
      "propertySelect.value",
      "housekeepingSheetDate.value",
      "housekeepingSheetAttendant",
      "location.pathname",
      "action.isConnected",
    ]) expect(open).toContain(proof);
    expect(open).toMatch(/activeView\s*(?:!==\s*"housekeeping"|===\s*"housekeeping")/);
    expect(open).toContain("receipt.generation !== housekeepingGenerationReceiptGeneration");
    expect(open).toMatch(/task\.taskId|origin\.taskId|action\.dataset\.taskId/);
    expect(open).toMatch(/task\.spaceId|origin\.spaceId|action\.dataset\.spaceId/);
    expect(open).toMatch(/task\.cadence|origin\.cadence|action\.dataset\.cadence/);
    expect(open).toMatch(/panel\.isConnected|receiptPanel\.isConnected|\.contains\(action\)/);
    expect(open).toContain("panel.hidden");
    expect(open).toContain("openHousekeepingTaskDetail");
  });

  test("renders exactly one deliberate Open task action per validated task and no eager request", () => {
    const renderName = script.includes("function renderHousekeepingSheetTaskReceipt(")
      ? "renderHousekeepingSheetTaskReceipt" : "renderHousekeepingGenerationReceipt";
    const render = functionSource(renderName);
    expect(render).toContain('"Open task"');
    expect(render).toContain("housekeeping-sheet-task-receipt-action");
    expect(functionSource("ensureHousekeepingGenerationReceiptPanel")).toContain("openGeneratedHousekeepingTaskDetail(action)");
    expect(render).toMatch(/receipt\.tasks\.map|for \(const task of receipt\.tasks\)/);
    expect(render).toContain("replaceChildren");
    expect(render).not.toMatch(/request\(|method\s*:|fetch\(|setInterval|setTimeout|poll|localStorage|sessionStorage/i);
  });

  test("clears transient truth on preview, draft, property, attendant and failed generation boundaries", () => {
    const clear = functionSource("clearHousekeepingSheetReceipt");
    expect(clear).toMatch(/receipt\s*=\s*null/i);
    expect(clear).toContain("replaceChildren");
    expect(clear).toMatch(/hidden\s*=\s*true/);

    expect(functionSource("clearHousekeepingSheetPreview")).toContain("clearHousekeepingSheetReceipt");
    expect(functionSource("clearHousekeepingSheetState")).toContain("clearHousekeepingSheetPreview");
    expect(functionSource("chooseHousekeepingAttendant")).toContain("clearHousekeepingSheetPreview");
    expect(functionSource("previewHousekeepingSheet")).toContain("clearHousekeepingSheetReceipt");
    const generate = functionSource("generateHousekeepingSheet");
    expect(generate.match(/clearHousekeepingSheetReceipt\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(generate).toContain("error?.status === 409");
    expect(script).toMatch(/housekeepingSheetDate\.addEventListener\("change",[\s\S]{0,400}clearHousekeepingSheetPreview\(\)/);
    expect(script).toMatch(/propertySelect\.addEventListener\("change",[\s\S]{0,1800}clearHousekeepingSheetState\(\)/);
    expect(functionSource("setView")).toMatch(/previousView === "housekeeping"[\s\S]{0,500}clearHousekeepingSheetReceipt\(\)/);
  });

  test("reuses the existing task-detail route, refetch, Back/Forward/direct-route and focus contract", () => {
    const openReceipt = functionSource("openGeneratedHousekeepingTaskDetail");
    const openDetail = functionSource("openHousekeepingTaskDetail");
    const loadDetail = functionSource("loadHousekeepingTaskDetail");
    const sync = functionSource("syncHousekeepingRoute");
    const close = functionSource("closeHousekeepingTaskDetail");
    expect(openReceipt).toContain("openHousekeepingTaskDetail");
    expect(openReceipt).not.toMatch(/request\(|method\s*:|fetch\(/);
    expect(openDetail).toContain('yellowSurface: "housekeeping-task-detail"');
    expect(openDetail).toContain("canonicalHousekeepingTaskDetailPath");
    expect(loadDetail).toContain("/housekeeping/tasks/${enc(origin.taskId)}");
    expect(loadDetail).not.toMatch(/method\s*:/);
    expect(sync).toContain('route.kind === "detail"');
    expect(sync).toContain("openHousekeepingTaskDetail");
    expect(sync).toContain("generatedHousekeepingTaskAction(route.taskId)");
    expect(close).toContain("history.back()");
    expect(close).toContain("returnFocus?.isConnected");
    expect(close).toContain("focus({ preventScroll: true })");
    expect(script).toContain('window.addEventListener("popstate"');
    expect(script).toContain("syncHousekeepingRoute");
  });

  test("receipt composition adds no command, polling, storage or inferred task authority", () => {
    const names = [
      "parseHousekeepingGenerationReceipt", "clearHousekeepingSheetReceipt",
      script.includes("function renderHousekeepingSheetTaskReceipt(")
        ? "renderHousekeepingSheetTaskReceipt" : "renderHousekeepingGenerationReceipt",
      "openGeneratedHousekeepingTaskDetail",
    ];
    const receipt = names.map(functionSource).join("\n");
    expect(receipt).not.toMatch(/method\s*:\s*"(?:POST|PUT|PATCH|DELETE)"|setInterval|setTimeout|EventSource|WebSocket|localStorage|sessionStorage/);
    expect(receipt).not.toMatch(/eligibleAction|allowedActions\s*=|taskStatus\s*=|roomCondition\s*=/);
    expect(receipt).not.toMatch(/reservation|guest|occupancy|parking|discrepancy/i);
  });
});
