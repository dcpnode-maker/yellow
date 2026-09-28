import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { BusinessDaySealConflictError, BusinessDaySealValidationError } from "../src/contexts/financials";
import { OperatorHttpApi } from "../src/http/operator";
import type { Database, TenantRequestContext, TenantResolver, Tx } from "../src/kernel";
import { readFileSync } from "node:fs";

const T = "00000000-0000-0000-0000-000000389011";
const P = "00000000-0000-0000-0000-000000389012";
const A = "00000000-0000-0000-0000-000000389013";
let calls = 0;
let mode: "ok" | "validation" | "conflict" | "unknown" = "ok";
let serviceTx: Tx | undefined;
const seal = { async seal(tx: Tx) { calls += 1; serviceTx = tx;
  if (mode === "validation") throw new BusinessDaySealValidationError("private validation evidence");
  if (mode === "conflict") throw new BusinessDaySealConflictError("private conflict evidence");
  if (mode === "unknown") throw new Error("private SQL and permission evidence");
  return { tenantId: T, propertyNode: P, businessDate: "2026-09-03",
  previousState: "open" as const, state: "sealed" as const, sealedAt: "2026-09-03T20:00:00.000Z",
  actorId: A, replayed: false }; } };
const api = new (OperatorHttpApi as unknown as new (...args: unknown[]) => OperatorHttpApi)(
  {}, {}, ...Array.from({ length: 39 }), undefined, undefined, undefined, seal,
);
function ctx(request: Request, granted = true): TenantRequestContext {
  const tx = (async () => granted ? [{ id: P, name: "Hotel", timezone: "UTC", currency: "USD" }] : []) as unknown as Tx;
  return { tenantId: T, tx, request, identity: { tenantId: T, actorId: A, scopes: ["financials.business-days:seal"] } };
}
function request(suffix = "", body?: BodyInit, key = "order389-hostile") {
  return new Request(`http://yellow.test/api/v1/properties/${P}/business-days/2026-09-03/seal${suffix}`,
    { method: "POST", body, headers: { "idempotency-key": key } });
}

describe("Order 389 hostile HTTP ingress", () => {
  test("admits only zero bytes and an undefined parsed body", async () => {
    calls = 0;
    expect((await api.sealBusinessDay(ctx(request()), P, "2026-09-03", undefined)).status).toBe(200);
    for (const [body, parsed] of [["{}", {}], ["null", null], [" ", undefined]] as const) {
      expect((await api.sealBusinessDay(ctx(request("", body)), P, "2026-09-03", parsed)).status).toBe(400);
    }
    expect(calls).toBe(1);
  });

  test("rejects query, invalid dates, invalid keys and foreign property grants without calling seal", async () => {
    calls = 0;
    expect((await api.sealBusinessDay(ctx(request("?force=true")), P, "2026-09-03", undefined)).status).toBe(400);
    expect((await api.sealBusinessDay(ctx(request()), P, "2026-02-30", undefined)).status).toBe(400);
    expect((await api.sealBusinessDay(ctx(request()), P, "2026-13-01", undefined)).status).toBe(400);
    expect((await api.sealBusinessDay(ctx(request("", undefined, "short")), P, "2026-09-03", undefined)).status).toBe(400);
    expect((await api.sealBusinessDay(ctx(request(), false), P, "2026-09-03", undefined)).status).toBe(403);
    expect(calls).toBe(0);
  });
});

describe("Order 389 real createApp route composition", () => {
  const tx = (async () => [{ id: P, name: "Hotel", timezone: "UTC", currency: "USD" }]) as unknown as Tx;
  const database = { async withTenantTransaction(_tenant: string, operation: (value: Tx) => Promise<Response>) {
    return operation(tx);
  } } as unknown as Database;
  const tenantResolver = { async resolve() { return { tenantId: T, actorId: A,
    scopes: ["financials.business-days:seal"] }; } } satisfies TenantResolver;
  const app = createApp({ database, tenantResolver, operatorApi: api });
  const url = `http://yellow.test/api/v1/properties/${P}/business-days/2026-09-03/seal`;
  const headers = { "idempotency-key": "order389-app-key" };

  test("parse:none admits a true zero-byte request and retains the middleware Tx", async () => {
    calls = 0; mode = "ok"; serviceTx = undefined;
    const response = await app.handle(new Request(url, { method: "POST", headers }));
    expect(response.status).toBe(200);
    expect(calls).toBe(1);
    expect(serviceTx as unknown).toBe(tx as unknown);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("idempotency-replayed")).toBe("false");
    expect(await response.json()).toEqual({ propertyNode: P, businessDate: "2026-09-03", previousState: "open",
      state: "sealed", sealedAt: "2026-09-03T20:00:00.000Z", replayed: false });
  });

  test("parse:none rejects every nonempty representation before the service", async () => {
    for (const body of ["{}", "null", " ", "\0", new URLSearchParams({ force: "true" })]) {
      calls = 0; mode = "ok";
      const response = await app.handle(new Request(url, { method: "POST", headers, body }));
      expect(response.status).toBe(400);
      expect(calls).toBe(0);
    }
    calls = 0;
    expect((await app.handle(new Request(`${url}?force=true`, { method: "POST", headers }))).status).toBe(400);
    expect(calls).toBe(0);
  });

  test("conceals service validation, conflict and unknown failures", async () => {
    for (const [failureMode, status] of [["validation", 400], ["conflict", 409], ["unknown", 503]] as const) {
      mode = failureMode;
      const response = await app.handle(new Request(url, { method: "POST", headers }));
      const rendered = JSON.stringify(await response.json());
      expect(response.status).toBe(status);
      expect(rendered).not.toMatch(/private|SQL|permission|business_day\.seal/i);
    }
    mode = "ok";
  });

  test("route and runtime wiring are exact and mutation-sensitive", () => {
    const appSource = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    const server = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
    expect(appSource.match(/\.post\("\/api\/v1\/properties\/:property\/business-days\/:businessDate\/seal"/g)).toHaveLength(1);
    expect(appSource).toContain('context, params.property, params.businessDate, body,\n        )), { parse: "none" })');
    expect(server.match(/new BusinessDaySealService\(\{ events, idempotency: new PostgresIdempotency\(\) \}\)/g)).toHaveLength(1);
    expect(server).toContain("undefined, undefined, businessDayCarry, businessDaySeal, ownerTrustExpenses, {\n      submissions: fiscalSubmissions,\n      adapters: fiscalSubmissionAdapters,\n    })");
  });
});
