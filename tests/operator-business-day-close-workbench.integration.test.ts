import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  BusinessDayCloseWorkbenchUnavailableError,
  BusinessDayCloseWorkbenchValidationError,
} from "../src/contexts/financials";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000384001";
const PROPERTY = "00000000-0000-0000-0000-000000384002";
const ACTOR = "00000000-0000-0000-0000-000000384003";
const DATE = "2026-09-02";
const calls: unknown[] = [];
const entryCalls: unknown[] = [];
let receivedTx: Tx | null = null;
const service = async (tx: Tx, input: unknown) => {
  receivedTx = tx;
  calls.push(input);
  return {
    tenantId: TENANT, propertyNode: PROPERTY, businessDate: DATE,
    capturedAt: "2026-09-03T10:00:00.000Z", currentOpenBusinessDate: "2026-09-03",
    openDays: [
      { businessDate: DATE, openedAt: "2026-09-02T00:00:00.000Z", isCurrent: false },
      { businessDate: "2026-09-03", openedAt: "2026-09-03T00:00:00.000Z", isCurrent: true },
    ],
    readiness: { tenantId: TENANT, propertyNode: PROPERTY, businessDate: DATE,
      capturedAt: "2026-09-03T10:00:00.000Z", ready: false,
      reasons: [{ code: "unresolved_discrepancy", source: "discrepancy", count: 1 }],
      counts: { unresolvedDueIn: 0, unresolvedDueOut: 0, openCashiers: 0, unresolvedDiscrepancies: 1,
        financialInterface: 0, fiscalInterface: 0, statutoryInterface: 0, channelDelivery: 0, unknownAttribution: 0 },
      outboxLag: { kind: "none", ageMilliseconds: 0 } },
    carryCandidates: [{ discrepancyId: "00000000-0000-0000-0000-000000384004",
      spaceId: "00000000-0000-0000-0000-000000384005", spaceCode: "402", reportedBusinessDate: DATE }],
  } as const;
};
const entryService = async (tx: Tx, input: unknown) => {
  receivedTx = tx;
  entryCalls.push(input);
  return { businessDate: DATE } as const;
};

const api = new (OperatorHttpApi as unknown as new (...args: unknown[]) => OperatorHttpApi)(
  {}, {}, ...Array.from({ length: 39 }), service, entryService,
);
function context(scopes: readonly string[], granted = true, suffix = ""): TenantRequestContext {
  const tx = (() => Promise.resolve(granted ? [{ id: PROPERTY, name: "Hotel", timezone: "UTC", currency: "USD" }] : [])) as unknown as Tx;
  return { tenantId: TENANT, request: new Request(`http://yellow.test/x${suffix}`), tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes } };
}

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
const operatorSource = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
const server = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");

describe("Order384 operator business-day close workbench", () => {
  test("binds the exact scope, server actor/property/date and canonical response", async () => {
    calls.length = 0;
    receivedTx = null;
    const tenantContext = context(["financials.business-days:read"]);
    const response = await api.businessDayCloseWorkbench(tenantContext, PROPERTY, DATE);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toBeTruthy();
    expect(await response.json()).toMatchObject({ businessDate: DATE, currentOpenBusinessDate: "2026-09-03",
      readiness: { ready: false }, carryCandidates: [{ spaceCode: "402" }] });
    expect(calls).toEqual([{ tenantId: TENANT, propertyNode: PROPERTY, businessDate: DATE, actorId: ACTOR }]);
    expect(receivedTx as unknown).toBe(tenantContext.tx as unknown);
  });

  test("binds undated entry to the middleware transaction and returns exact least-data JSON", async () => {
    entryCalls.length = 0;
    receivedTx = null;
    const tenantContext = context(["financials.business-days:read"]);
    const response = await api.businessDayCloseWorkbenchEntry(tenantContext, PROPERTY);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ businessDate: DATE });
    expect(entryCalls).toEqual([{ tenantId: TENANT, propertyNode: PROPERTY, actorId: ACTOR }]);
    expect(receivedTx as unknown).toBe(tenantContext.tx as unknown);
  });

  test("rejects unauthorized or malformed entry before PostgreSQL discovery", async () => {
    entryCalls.length = 0;
    expect((await api.businessDayCloseWorkbenchEntry(context([]), PROPERTY)).status).toBe(403);
    expect((await api.businessDayCloseWorkbenchEntry(context(["financials.business-days:read"]), "bad")).status).toBe(400);
    expect((await api.businessDayCloseWorkbenchEntry(context(["financials.business-days:read"], true, "?date=2026-09-02"), PROPERTY)).status).toBe(400);
    expect(entryCalls).toEqual([]);
  });

  test("reuses the middleware transaction and runtime never constructs a nested transaction owner", () => {
    const start = operatorSource.indexOf("async businessDayCloseWorkbench(");
    const end = operatorSource.indexOf("\n  async ", start + 10);
    const adapter = operatorSource.slice(start, end < 0 ? undefined : end);
    expect(adapter).toContain("this.#businessDayCloseWorkbench(context.tx, {");
    expect(adapter).not.toContain("withTenantTransaction");
    expect(adapter).not.toContain("new BusinessDayCloseWorkbenchService");
    expect(operatorSource).toContain("businessDayCloseWorkbench: BusinessDayCloseWorkbenchLoader = loadBusinessDayCloseWorkbench");
    expect(server).not.toContain("BusinessDayCloseWorkbenchService");
  });

  test("rejects missing scope, foreign grants, malformed dates and query authority before service", async () => {
    calls.length = 0;
    expect((await api.businessDayCloseWorkbench(context([]), PROPERTY, DATE)).status).toBe(403);
    expect((await api.businessDayCloseWorkbench(context(["financials.business-days:read"], false), PROPERTY, DATE)).status).toBe(403);
    expect((await api.businessDayCloseWorkbench(context(["financials.business-days:read"]), "bad", DATE)).status).toBe(400);
    expect((await api.businessDayCloseWorkbench(context(["financials.business-days:read"]), PROPERTY, "2026-02-30")).status).toBe(400);
    expect((await api.businessDayCloseWorkbench(context(["financials.business-days:read"], true, "?include=payload"), PROPERTY, DATE)).status).toBe(400);
    expect(calls).toEqual([]);
  });

  test("conceals unavailable truth and never exposes private error detail", async () => {
    const invalid = api.failure(new Request("http://yellow.test/x"), new BusinessDayCloseWorkbenchValidationError("private"));
    const absent = api.failure(new Request("http://yellow.test/x"), new BusinessDayCloseWorkbenchUnavailableError());
    expect(invalid.status).toBe(400);
    expect(absent.status).toBe(404);
    expect(JSON.stringify(await absent.json())).not.toContain("private");
  });

  test("exposes only GET plus a read-only deep link and stale-safe accessible UI", () => {
    expect(app).toContain('.get("/p/:property/day-close"');
    expect(app).toContain('.get("/api/v1/properties/:property/business-days/close-workbench"');
    expect(app).toContain('.get("/api/v1/properties/:property/business-days/:businessDate/close-workbench"');
    expect(app).not.toContain('.post("/api/v1/properties/:property/business-days/:businessDate/close-workbench"');
    for (const id of ["day-close-view", "day-close-title", "day-close-refresh", "day-close-date",
      "day-close-workbench", "day-close-error", "day-close-retry", "day-close-content",
      "day-close-reasons", "day-close-candidates", "day-close-status"]) expect(html).toContain(`id="${id}"`);
    expect(script).toContain("dayCloseRequestGeneration");
    expect(script).toContain('activeView !== "day-close"');
    expect(script).toContain("dayCloseRouteDate()");
    const loader = script.slice(script.indexOf("async function loadDayCloseWorkbench"), script.indexOf("function setView", script.indexOf("async function loadDayCloseWorkbench")));
    expect(loader).toContain("if (!selected)");
    expect(loader).toContain("business-days/close-workbench");
    expect(loader).toContain("business-days/${enc(selected)}/close-workbench");
    expect(loader).not.toContain("new Date");
    expect(script).not.toMatch(/(?:seal).{0,40}(?:submit|button)|(?:submit|button).{0,40}(?:seal)/i);
    expect(script).toContain("Request carry approval");
  });

  test("is responsive and deliberately composed in every approved appearance", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"])
      expect(css).toContain(`:root[data-theme="${theme}"] .day-close-workbench .card`);
    expect(css).toContain("@media (max-width:760px)");
    expect(css).toContain(".day-close-detail-grid { grid-template-columns:1fr; }");
  });
});
