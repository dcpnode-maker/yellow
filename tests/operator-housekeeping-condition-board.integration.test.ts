import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000208001";
const PROPERTY = "00000000-0000-0000-0000-000000208002";
const ACTOR = "00000000-0000-0000-0000-000000208003";
const SPACE = "00000000-0000-0000-0000-000000208004";
const UPDATED_AT = "2026-08-28T09:30:00.000Z";
const calls: unknown[] = [];

const housekeeping = {
  async listBoard() { return []; },
  async transition(): Promise<never> { throw new Error("not used"); },
  async listConditions(input: unknown) {
    calls.push(input);
    return {
      rooms: [{
        spaceId: SPACE,
        code: "101",
        floor: "1",
        condition: "inspected" as const,
        updatedAt: UPDATED_AT,
        updatedBy: ACTOR,
        taskId: "00000000-0000-0000-0000-000000208099",
        ready: true,
        source: "must-not-cross-http-boundary",
      }],
      nextCursor: "eyJ2IjoxfQ",
      wholePropertyTotal: 999,
    };
  },
};

const api = new OperatorHttpApi(
  {} as LocalLoginService,
  {} as AvailabilityService,
  undefined, // inventory
  undefined, // idempotency
  undefined, // restrictions
  undefined, // rates
  undefined, // pricing
  undefined, // blocks
  undefined, // policy
  undefined, // holds
  undefined, // projection
  undefined, // runtime status
  undefined, // rate builder
  undefined, // reservation commit
  undefined, // offers
  undefined, // guests
  undefined, // lifecycle
  undefined, // segments
  undefined, // parties
  undefined, // statements
  undefined, // charges
  undefined, // reservation board
  undefined, // reservation detail
  undefined, // folios
  undefined, // corrections
  undefined, // transfers
  undefined, // hosted deposits
  undefined, // settlements
  undefined, // cashiers
  undefined, // receivables
  undefined, // check-in
  housekeeping,
);

function context(query: string, scopes: readonly string[], granted = true): TenantRequestContext {
  const tx = (() => Promise.resolve(granted
    ? [{ id: PROPERTY, name: "Hotel", timezone: "UTC", currency: "USD" }]
    : [])) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request(`http://yellow.test/api/v1/properties/${PROPERTY}/housekeeping/conditions${query}`),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

describe("Order 208 operator room-condition read", () => {
  test("GET is no-store, exact-scope/property-granted, forwards only allowed query and minimizes output", async () => {
    calls.length = 0;
    const response = await api.housekeepingConditions(
      context("?condition=inspected&cursor=eyJ2IjoxfQ&limit=25", ["housekeeping.tasks:read"]),
      PROPERTY,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      nextCursor: "eyJ2IjoxfQ",
      rooms: [{ code: "101", condition: "inspected", floor: "1", spaceId: SPACE, updatedAt: UPDATED_AT }],
    });
    expect(calls).toEqual([{
      tenantId: TENANT,
      propertyNode: PROPERTY,
      condition: "inspected",
      cursor: "eyJ2IjoxfQ",
      limit: 25,
    }]);
  });

  test("missing scope and property grants fail closed before the domain read", async () => {
    calls.length = 0;
    expect((await api.housekeepingConditions(context("", []), PROPERTY)).status).toBe(403);
    expect((await api.housekeepingConditions(
      context("", ["housekeeping.tasks:read"], false), PROPERTY,
    )).status).toBe(404);
    expect(calls).toEqual([]);
  });

  test("property, condition, cursor, limit, duplicate and extra query input is strictly rejected", async () => {
    calls.length = 0;
    const scope = ["housekeeping.tasks:read"];
    expect((await api.housekeepingConditions(context("", scope), "bad")).status).toBe(400);
    for (const query of [
      "?condition=ready", "?condition=clean&condition=dirty", "?cursor=", "?cursor=bad%3D",
      "?cursor=a&cursor=b", "?limit=0", "?limit=101", "?limit=1.5", "?offset=1",
    ]) {
      expect((await api.housekeepingConditions(context(query, scope), PROPERTY)).status).toBe(400);
    }
    expect(calls).toEqual([]);
  });

  test("the application exposes exactly one room-condition read route and no write route", () => {
    const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    const route = "/api/v1/properties/:property/housekeeping/conditions";
    expect(app).toContain(`.get("${route}"`);
    for (const verb of ["post", "put", "patch", "delete"]) {
      expect(app).not.toContain(`.${verb}("${route}"`);
    }
  });
});
