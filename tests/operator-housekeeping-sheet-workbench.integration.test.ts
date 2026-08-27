import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000022001";
const PROPERTY = "00000000-0000-0000-0000-000000022002";
const ACTOR = "00000000-0000-0000-0000-000000022003";
const ATTENDANT = "00000000-0000-0000-0000-000000022004";
const SPACE = "00000000-0000-0000-0000-000000022005";
const SHEET = "00000000-0000-0000-0000-000000022006";
const SHEET_DATE = "2026-09-17";

const calls: Array<{ readonly method: string; readonly input: unknown }> = [];
const sheets = {
  async preview(input: unknown) {
    calls.push({ method: "preview", input });
    return [{ spaceId: SPACE, spaceCode: "301", floor: "3", profileKey: "hotel-room",
      cadence: "daily" as const, arrivalAt: "2026-09-16T09:00:00.000Z", departureAt: "2026-09-18T09:00:00.000Z" }];
  },
  async list(input: unknown) {
    calls.push({ method: "list", input });
    return [{ sheetId: SHEET, sheetDate: SHEET_DATE, attendantPartyId: ATTENDANT,
      attendantName: "Avery Housekeeping", taskCount: 1 }];
  },
  async generate(input: unknown) {
    calls.push({ method: "generate", input });
    return { sheetId: SHEET, sheetDate: SHEET_DATE, attendantPartyId: ATTENDANT,
      taskCount: 1, tasks: [{ taskId: ACTOR, spaceId: SPACE, spaceCode: "301",
        profileKey: "hotel-room", cadence: "daily" as const }], replayed: false };
  },
};

const api = new OperatorHttpApi(
  {} as LocalLoginService, {} as AvailabilityService,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, sheets,
);

function context(path: string, scopes: readonly string[], granted = true, body?: unknown): TenantRequestContext {
  const tx = (() => Promise.resolve(granted
    ? [{ id: PROPERTY, name: "Hotel", timezone: "Asia/Kolkata", currency: "INR" }] : [])) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request(`http://yellow.test${path}`, body === undefined ? undefined : {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "housekeeping-sheet-attempt-0001" },
      body: JSON.stringify(body),
    }),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

describe("Order 202 operator housekeeping sheet authority", () => {
  test("preview and list are no-store, exact-date, scoped and property concealed", async () => {
    calls.length = 0;
    const scopes = ["housekeeping.sheets:read", "housekeeping.sheets:generate"];
    const preview = await api.previewHousekeepingSheet(context(`/x?sheetDate=${SHEET_DATE}`, scopes), PROPERTY);
    expect(preview.status).toBe(200);
    expect(preview.headers.get("cache-control")).toBe("no-store");
    expect(await preview.json()).toMatchObject({ sheetDate: SHEET_DATE, canGenerate: true,
      rooms: [{ spaceId: SPACE, cadence: "daily" }] });
    expect(calls[0]).toEqual({ method: "preview", input: {
      tenantId: TENANT, propertyNode: PROPERTY, sheetDate: SHEET_DATE, limit: 200,
    } });

    const list = await api.listHousekeepingSheets(context(`/x?sheetDate=${SHEET_DATE}`, scopes), PROPERTY);
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ sheetDate: SHEET_DATE, sheets: [{ sheetId: SHEET, taskCount: 1 }] });
    expect((await api.previewHousekeepingSheet(context(`/x?sheetDate=${SHEET_DATE}`, [], true), PROPERTY)).status).toBe(403);
    expect((await api.previewHousekeepingSheet(context(`/x?sheetDate=${SHEET_DATE}`, ["housekeeping.sheets:read"], false), PROPERTY)).status).toBe(404);
    expect((await api.previewHousekeepingSheet(context("/x?sheetDate=17-09-2026", scopes), PROPERTY)).status).toBe(400);
    expect((await api.listHousekeepingSheets(context(`/x?sheetDate=${SHEET_DATE}&limit=1`, scopes), PROPERTY)).status).toBe(400);
  });

  test("generation accepts only date, attendant and retained transport key while deriving actor authority", async () => {
    calls.length = 0;
    const body = { sheetDate: SHEET_DATE, attendantPartyId: ATTENDANT };
    const response = await api.generateHousekeepingSheet(
      context("/x", ["housekeeping.sheets:generate"], true, body), PROPERTY, body,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("idempotency-replayed")).toBe("false");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: "generate", input: {
      tenantId: TENANT, propertyNode: PROPERTY, sheetDate: SHEET_DATE, attendantPartyId: ATTENDANT,
      idempotencyKey: "housekeeping-sheet-attempt-0001",
      envelope: { actorId: ACTOR, tenantId: TENANT, propertyNode: PROPERTY, operation: "task.created" },
    } });
    expect((await api.generateHousekeepingSheet(context("/x", [], true, body), PROPERTY, body)).status).toBe(403);
    expect((await api.generateHousekeepingSheet(context("/x", ["housekeeping.sheets:generate"], false, body), PROPERTY, body)).status).toBe(404);
    for (const hostile of [
      { ...body, cadence: "weekly" }, { ...body, roomIds: [SPACE] }, { ...body, actorId: ACTOR },
      { sheetDate: SHEET_DATE, attendantPartyId: "not-a-party" },
    ]) expect((await api.generateHousekeepingSheet(
      context("/x", ["housekeeping.sheets:generate"], true, hostile), PROPERTY, hostile,
    )).status).toBe(400);
  });
});

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

test("Order 202 sheet workbench is accessible, stale-safe, retry-safe and native across six appearances", () => {
  for (const marker of [
    'id="housekeeping-sheet-form"', 'id="housekeeping-sheet-date"', 'id="housekeeping-attendant-query"',
    'id="housekeeping-sheet-preview"', 'id="housekeeping-generate"', 'id="housekeeping-sheet-message" role="status" aria-live="polite"',
  ]) expect(html).toContain(marker);
  expect(html).toContain("Weekly, custom or ambiguous cadence is not guessed");
  expect(script).toContain("housekeepingSheetIsCurrent(generation, requestGeneration, property, sheetDate)");
  expect(script).toContain("existing sheet was confirmed");
  expect(script).toContain('headers: { "idempotency-key": housekeepingSheetAttemptKey }');
  expect(script).toContain("housekeepingSheetAttemptDraft !== draft");
  expect(script).toContain("profile.roles.includes(\"staff\")");
  expect(script).toContain("server revalidates active staff authority");
  expect(script).not.toMatch(/housekeepingSheet[\s\S]{0,1200}(?:cadence:|roomIds|credits|targetStatus|localStorage|sessionStorage)/);
  for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
    expect(css).toContain(`:root[data-theme="${theme}"] .housekeeping-sheet-workbench`);
  }
  expect(css).toContain(".housekeeping-attendant-search-row button, .housekeeping-preview-action { min-height: 44px;");
  expect(css).toContain("prefers-reduced-motion: reduce");
});
