import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000235001";
const PROPERTY = "00000000-0000-0000-0000-000000235002";
const ACTOR = "00000000-0000-0000-0000-000000235003";
const SPACE = "00000000-0000-0000-0000-000000235004";
const DISCREPANCY = "00000000-0000-0000-0000-000000235005";
const REPORTED_AT = "2026-08-28T10:15:30.123Z";
const calls: Array<{ kind: string; input: unknown }> = [];

const service = {
  async listOpen(input: unknown) {
    calls.push({ kind: "list", input });
    return [{ discrepancyId: DISCREPANCY, spaceId: SPACE, code: "101", floor: "1",
      kind: "sleep" as const, reported: "occupied", systemState: "vacant",
      reportedBy: ACTOR, reportedAt: REPORTED_AT }];
  },
  async report(input: unknown) {
    calls.push({ kind: "report", input });
    return { discrepancy: null, created: false, replayed: false };
  },
};

const api = new OperatorHttpApi(
  {} as LocalLoginService, {} as AvailabilityService,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, service,
);

function context(method: "GET" | "POST", query: string, scopes: readonly string[], granted = true): TenantRequestContext {
  const tx = (() => Promise.resolve(granted
    ? [{ id: PROPERTY, name: "Hotel", timezone: "UTC", currency: "USD" }]
    : [])) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request(`http://yellow.test/api/v1/properties/${PROPERTY}/housekeeping/discrepancies${query}`, {
      method,
      headers: method === "POST" ? { "idempotency-key": "order235-attempt-0001",
        "x-correlation-id": "00000000-0000-0000-0000-000000235099" } : {},
    }),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

describe("Order 235 operator discrepancy HTTP", () => {
  test("GET is no-store, exact-scope/property-granted and minimizes room evidence", async () => {
    calls.length = 0;
    const response = await api.housekeepingDiscrepancies(
      context("GET", "", ["housekeeping.discrepancies:read"]), PROPERTY,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ discrepancies: [{
      floor: "1", kind: "sleep", reported: "occupied", reportedAt: REPORTED_AT,
      reportedBy: ACTOR, spaceCode: "101", spaceId: SPACE, systemState: "vacant",
    }] });
    expect(calls).toEqual([{ kind: "list", input: { tenantId: TENANT, propertyNode: PROPERTY } }]);
  });

  test("POST forwards exact observation, actor-bound audit identity and returns matching no-op receipt", async () => {
    calls.length = 0;
    const response = await api.reportHousekeepingDiscrepancy(
      context("POST", "", ["housekeeping.discrepancies:report"]), PROPERTY,
      { spaceId: SPACE, observedPresence: "vacant", observedPersons: null },
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("idempotency-replayed")).toBe("false");
    expect(response.headers.get("x-correlation-id")).toBe("00000000-0000-0000-0000-000000235099");
    expect(await response.json()).toEqual({ created: false, discrepancy: null, replayed: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.kind).toBe("report");
    expect(calls[0]?.input).toMatchObject({ tenantId: TENANT, propertyNode: PROPERTY, spaceId: SPACE,
      observedPresence: "vacant", observedPersons: null, idempotencyKey: "order235-attempt-0001",
      envelope: { actorId: ACTOR, tenantId: TENANT, propertyNode: PROPERTY,
        operation: "discrepancy.reported", requestId: "00000000-0000-0000-0000-000000235099" } });
  });

  test("hostile query/body, missing scope and foreign property fail before the service", async () => {
    calls.length = 0;
    expect((await api.housekeepingDiscrepancies(
      context("GET", "?limit=1", ["housekeeping.discrepancies:read"]), PROPERTY,
    )).status).toBe(400);
    expect((await api.housekeepingDiscrepancies(context("GET", "", []), PROPERTY)).status).toBe(403);
    expect((await api.housekeepingDiscrepancies(
      context("GET", "", ["housekeeping.discrepancies:read"], false), PROPERTY,
    )).status).toBe(404);
    const report = context("POST", "", ["housekeeping.discrepancies:report"]);
    for (const body of [
      {},
      { spaceId: SPACE, observedPresence: "vacant", observedPersons: 0 },
      { spaceId: SPACE, observedPresence: "occupied", observedPersons: null },
      { spaceId: SPACE, observedPresence: "occupied", observedPersons: 100 },
      { spaceId: SPACE, observedPresence: "vacant", observedPersons: null, reservationId: SPACE },
    ]) expect((await api.reportHousekeepingDiscrepancy(report, PROPERTY, body)).status).toBe(400);
    expect(calls).toEqual([]);
  });

  test("the application exposes only exact GET and POST routes", () => {
    const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    const route = "/api/v1/properties/:property/housekeeping/discrepancies";
    expect(app).toContain(`.get("${route}"`);
    expect(app).toContain(`.post("${route}"`);
    for (const verb of ["put", "patch", "delete"]) expect(app).not.toContain(`.${verb}("${route}"`);
  });
});
