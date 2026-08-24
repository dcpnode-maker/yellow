import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService, InventoryService } from "../src/contexts/inventory";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, PostgresEventBus, PostgresIdempotency } from "../src/kernel";
import { runReviewSeed, REVIEW_EMAIL } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";
import { BROWSER_SQL_SYNTAX } from "./helpers/browser-asset-security";

const DATABASE_URL = process.env.YELLOW_OPERATOR_INVENTORY_URL;
const PASSWORD = process.env.YELLOW_OPERATOR_INVENTORY_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_INVENTORY === "1";
const SECRET = "yellow-order-048-test-token-secret-exactly-long-enough";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000004880";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000004881";
const FOREIGN_ACTOR = "00000000-0000-0000-0000-000000004882";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_OPERATOR_INVENTORY_URL and YELLOW_OPERATOR_INVENTORY_PASSWORD are required by Order 048");
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let database: Database;
let tokens: Hs256TokenSigner;
let app: ReturnType<typeof createApp>;
let accessToken = "";
let approverToken = "";
let userId = "";
let approverUserId = "";
let createdUnitType: Record<string, unknown>;
let createdSpace: Record<string, unknown>;
let createdSellable: Record<string, unknown>;

function headers(token = accessToken, idempotencyKey?: string): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
  };
}

function request(path: string, init: RequestInit = {}): Promise<Response> {
  return app.handle(new Request(`http://yellow.test${path}`, init));
}

async function post(path: string, body: unknown, key?: string, token = accessToken): Promise<Response> {
  return request(path, { method: "POST", headers: headers(token, key), body: JSON.stringify(body) });
}

async function artifactCounts(entityId: string): Promise<{ facts: number; events: number }> {
  const rows = await admin<Array<{ facts: number; events: number }>>`
    SELECT
      (SELECT count(*)::int FROM fact_log WHERE entity_id = ${entityId}::uuid) AS facts,
      (SELECT count(*)::int FROM outbox WHERE aggregate_id = ${entityId}::uuid) AS events
  `;
  return rows[0]!;
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  const review = await runReviewSeed({ databaseUrl: DATABASE_URL, password: PASSWORD, logger: () => undefined });
  userId = review.userId;
  approverUserId = review.approverUserId;
  admin = new SQL(DATABASE_URL, { max: 4 });
  loginPool = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 4 });
  database = Database.connect(DATABASE_URL, { maxConnections: 12 });
  tokens = new Hs256TokenSigner(SECRET);
  approverToken = await tokens.issue({
    userId: approverUserId,
    tenantId: SEED_TENANT.id,
    scopes: ["inventory.configuration:read", "inventory.configuration:write"],
  });
  const inventory = new InventoryService(new PostgresEventBus(eventPool));
  app = createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      new LocalLoginService(loginPool, tokens),
      new AvailabilityService(),
      inventory,
      new PostgresIdempotency(),
    ),
  });
  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${FOREIGN_TENANT}::uuid, 'order048-foreign', 'Order 048 Foreign', 'shared', 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES (${FOREIGN_PROPERTY}::uuid, ${FOREIGN_TENANT}::uuid, 'order048_foreign', 'property', 'Foreign Property', 'UTC', 'USD')
    ON CONFLICT (id) DO NOTHING
  `;
  const login = await request("/api/v1/auth/local:login", {
    method: "POST",
    headers: headers(""),
    body: JSON.stringify({ tenant: SEED_TENANT.slug, email: REVIEW_EMAIL, password: PASSWORD }),
  });
  expect(login.status).toBe(200);
  accessToken = (await login.json() as { accessToken: string }).accessToken;
});

afterAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await database.close();
  await eventPool.close();
  await loginPool.close();
  await admin.close();
});

databaseDescribe("Order 048 operator inventory management", () => {
  test("P1: configuration read returns exact deterministic property inventory", async () => {
    const response = await request(`/api/v1/properties/${SEED_PROPERTY.id}/inventory`, { headers: headers() });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as {
      unitTypes: Array<{ code: string }>;
      spaces: Array<{ code: string }>;
      sellableUnits: Array<{ name: string }>;
    };
    expect(body.unitTypes.map(({ code }) => code)).toEqual(["STD", "DLX"]);
    expect(body.spaces.map(({ code }) => code)).toEqual(["101", "102", "103", "201", "202"]);
    expect(body.sellableUnits.map(({ name }) => name)).toEqual([
      "Room 101", "Room 102", "Room 103", "Room 201", "Room 202",
    ]);
  });

  test("Order 103 P0: a second authorized actor cannot replay the first actor's cached success", async () => {
    const path = `/api/v1/properties/${SEED_PROPERTY.id}/inventory/unit-types`;
    const input = {
      code: "O103", name: "Order 103 Actor Boundary", profileKey: "hotel",
      baseOccupancy: 1, maxOccupancy: 2, sortOrder: 103,
    };
    const key = "order103-cross-actor-key";

    const first = await post(path, input, key);
    expect(first.status).toBe(201);
    expect(first.headers.get("idempotency-replayed")).toBe("false");
    const created = await first.json() as { id: string };
    expect(await artifactCounts(created.id)).toEqual({ facts: 1, events: 1 });

    const crossActor = await post(path, input, key, approverToken);
    expect(crossActor.status).toBe(409);
    expect(crossActor.headers.get("idempotency-replayed")).toBeNull();
    const problem = await crossActor.json() as Record<string, unknown>;
    expect(problem).toEqual(expect.objectContaining({ type: "request/idempotency_conflict" }));
    expect(JSON.stringify(problem)).not.toContain(created.id);
    expect(await artifactCounts(created.id)).toEqual({ facts: 1, events: 1 });
    expect(await admin`
      SELECT id FROM fact_log
      WHERE entity_id = ${created.id}::uuid AND actor_id = ${approverUserId}::uuid
    `).toHaveLength(0);

    const sameActorReplay = await post(path, input, key);
    expect(sameActorReplay.status).toBe(201);
    expect(sameActorReplay.headers.get("idempotency-replayed")).toBe("true");
    expect(await sameActorReplay.json()).toEqual(created);
    expect(await artifactCounts(created.id)).toEqual({ facts: 1, events: 1 });
  });

  test("P2: three idempotent POSTs use audited production inventory commands", async () => {
    const unitTypeResponse = await post(`/api/v1/properties/${SEED_PROPERTY.id}/inventory/unit-types`, {
      code: "O48", name: "Order 048 Suite", profileKey: "hotel",
      baseOccupancy: 2, maxOccupancy: 4, sortOrder: 480,
    }, "order048-unit-type-key");
    expect(unitTypeResponse.status).toBe(201);
    expect(unitTypeResponse.headers.get("idempotency-replayed")).toBe("false");
    expect(unitTypeResponse.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
    createdUnitType = await unitTypeResponse.json() as Record<string, unknown>;

    const spaceResponse = await post(`/api/v1/properties/${SEED_PROPERTY.id}/inventory/spaces`, {
      code: "O48-01", profileKey: "hotel", capacity: 1, maxOccupancy: 4,
      floor: "48", areaSqm: 48, genderPolicy: "any",
    }, "order048-space-key");
    expect(spaceResponse.status).toBe(201);
    createdSpace = await spaceResponse.json() as Record<string, unknown>;

    const sellableResponse = await post(`/api/v1/properties/${SEED_PROPERTY.id}/inventory/sellable-units`, {
      unitTypeId: createdUnitType.id,
      name: "Order 048 Suite 01",
      spaces: [{ spaceId: createdSpace.id, claimMode: "exclusive" }],
    }, "order048-sellable-key");
    expect(sellableResponse.status).toBe(201);
    createdSellable = await sellableResponse.json() as Record<string, unknown>;

    expect(await artifactCounts(String(createdUnitType.id))).toEqual({ facts: 1, events: 1 });
    expect(await artifactCounts(String(createdSpace.id))).toEqual({ facts: 1, events: 1 });
    expect(await artifactCounts(String(createdSellable.id))).toEqual({ facts: 1, events: 1 });
  });

  test("P3: exact replay is byte-equivalent and changed key reuse conflicts", async () => {
    const exactBody = {
      code: "O48", name: "Order 048 Suite", profileKey: "hotel",
      baseOccupancy: 2, maxOccupancy: 4, sortOrder: 480,
    };
    const replay = await post(`/api/v1/properties/${SEED_PROPERTY.id}/inventory/unit-types`, exactBody, "order048-unit-type-key");
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.json()).toEqual(createdUnitType);
    expect(await artifactCounts(String(createdUnitType.id))).toEqual({ facts: 1, events: 1 });

    const conflict = await post(`/api/v1/properties/${SEED_PROPERTY.id}/inventory/unit-types`, {
      ...exactBody, name: "Changed request",
    }, "order048-unit-type-key");
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual(expect.objectContaining({ type: "request/idempotency_conflict" }));
  });

  test("P4: malformed, unauthorized and foreign requests persist nothing", async () => {
    const before = await admin<Array<{ rows: number }>>`
      SELECT count(*)::int AS rows FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid
    `;
    expect((await post(`/api/v1/properties/${SEED_PROPERTY.id}/inventory/spaces`, {
      code: "NO-KEY", profileKey: "hotel",
    })).status).toBe(400);
    expect((await post(`/api/v1/properties/${SEED_PROPERTY.id}/inventory/spaces`, {
      code: "EXTRA", profileKey: "hotel", surprise: true,
    }, "order048-extra-field-key")).status).toBe(400);
    expect((await post(`/api/v1/properties/${SEED_PROPERTY.id}/inventory/spaces`, {
      code: " invalid ", profileKey: "hotel",
    }, "order048-domain-invalid-key")).status).toBe(400);

    const noScope = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["inventory.availability:read"] });
    expect((await post(`/api/v1/properties/${SEED_PROPERTY.id}/inventory/spaces`, {
      code: "NO-SCOPE", profileKey: "hotel",
    }, "order048-no-scope-key", noScope)).status).toBe(403);
    expect((await post(`/api/v1/properties/${FOREIGN_PROPERTY}/inventory/spaces`, {
      code: "FOREIGN", profileKey: "hotel",
    }, "order048-foreign-key")).status).toBe(403);
    const foreignToken = await tokens.issue({
      userId: FOREIGN_ACTOR, tenantId: FOREIGN_TENANT,
      scopes: ["inventory.configuration:read", "inventory.configuration:write"],
    });
    expect((await request(`/api/v1/properties/${SEED_PROPERTY.id}/inventory`, { headers: headers(foreignToken) })).status).toBe(403);
    const after = await admin<Array<{ rows: number }>>`
      SELECT count(*)::int AS rows FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid
    `;
    expect(after).toEqual(before);
  });

  test("P5: publisher failure rolls domain and idempotency back before retry", async () => {
    const failingInventory = new InventoryService({
      async publish(): Promise<never> { throw new Error("publisher unavailable with secret detail"); },
      async consumeBatch(): Promise<never> { throw new Error("not used by inventory commands"); },
    });
    const failing = createApp({
      database,
      tenantResolver: new BearerTenantResolver(tokens),
      operatorApi: new OperatorHttpApi(
        new LocalLoginService(loginPool, tokens), new AvailabilityService(),
        failingInventory, new PostgresIdempotency(),
      ),
    });
    const path = `/api/v1/properties/${SEED_PROPERTY.id}/inventory/spaces`;
    const input = { code: "O48-ROLLBACK", profileKey: "hotel", capacity: 1 };
    const failed = await failing.handle(new Request(`http://yellow.test${path}`, {
      method: "POST", headers: headers(accessToken, "order048-rollback-key"), body: JSON.stringify(input),
    }));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("secret detail");
    expect(await admin`SELECT id FROM space WHERE tenant_id = ${SEED_TENANT.id}::uuid AND code = 'O48-ROLLBACK'`).toHaveLength(0);
    expect(await admin`SELECT key_hash FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid AND operation = 'operator.inventory.space.create'`).toHaveLength(1);

    const retry = await post(path, input, "order048-rollback-key");
    expect(retry.status).toBe(201);
    expect(retry.headers.get("idempotency-replayed")).toBe("false");
  });

  test("P6/P7: assets expose one themed inventory UI and login carries exact twenty-five scopes", async () => {
    const html = await (await request("/")).text();
    const css = await (await request("/assets/operator.css")).text();
    const js = await (await request("/assets/operator.js")).text();
    expect(html).toContain('id="inventory-view"');
    expect(html).toContain('id="unit-type-form"');
    expect(html).toContain('id="space-form"');
    expect(html).toContain('id="sellable-unit-form"');
    expect(css).toContain(':root[data-theme="pixel"]');
    expect(css).toContain("[hidden] { display: none !important; }");
    expect(js).toContain("crypto.randomUUID()");
    expect(js).toContain("idempotency-key");
    expect(js).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    expect(js).not.toMatch(BROWSER_SQL_SYNTAX);
    expect(js).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect((await tokens.verify(accessToken))?.scp).toBe(
      "crm.parties:read crm.parties:write inventory.availability:read inventory.blocks:read inventory.blocks:write inventory.configuration:read inventory.configuration:write inventory.holds:read inventory.holds:write inventory.offline_leases:read inventory.offline_leases:write inventory.policy:read inventory.policy:write inventory.restriction:read inventory.restriction:write rates.configuration:read rates.configuration:write rates.pricing:read rates.pricing:write reservations.guests:read reservations.guests:write reservations.lifecycle:read reservations.lifecycle:write reservations.segments:read reservations.segments:write",
    );
  });
});
