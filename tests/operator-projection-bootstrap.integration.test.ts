import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import {
  AvailabilityProjectionConsumer,
  AvailabilityProjectionService,
  AvailabilityService,
  HoldService,
  InventoryService,
} from "../src/contexts/inventory";
import { OperatorHttpApi, operatorAssets } from "../src/http/operator";
import { createAuditEnvelope, Database, PostgresEventBus, PostgresIdempotency } from "../src/kernel";
import { runReviewSeed, REVIEW_EMAIL } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_OPERATOR_PROJECTION_URL;
const PASSWORD = process.env.YELLOW_OPERATOR_PROJECTION_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_PROJECTION === "1";
const SECRET = "yellow-order-060-test-token-secret-exactly-long-enough";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_OPERATOR_PROJECTION_URL and YELLOW_OPERATOR_PROJECTION_PASSWORD are required by Order 060");
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let database: Database;
let app: ReturnType<typeof createApp>;
let accessToken = "";
let userId = "";
let tokens: Hs256TokenSigner;
let events: PostgresEventBus;
let projection: AvailabilityProjectionService;

function makeApp(projectionOperations: Pick<AvailabilityProjectionService, "status" | "replaceHorizon">): ReturnType<typeof createApp> {
  return createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      new LocalLoginService(loginPool, tokens),
      new AvailabilityService(),
      new InventoryService(events),
      new PostgresIdempotency(),
      undefined, undefined, undefined, undefined, undefined, undefined,
      projectionOperations,
    ),
  });
}

function headers(key?: string, token = accessToken): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(key ? { "idempotency-key": key } : {}),
  };
}

function request(path: string, init: RequestInit = {}): Promise<Response> {
  return app.handle(new Request(`http://yellow.test${path}`, init));
}

async function projectionBytes(): Promise<string> {
  const rows = await admin<Array<{ snapshot: string }>>`
    SELECT COALESCE(jsonb_agg(to_jsonb(row_value) ORDER BY stay_date, unit_type_id), '[]'::jsonb)::text AS snapshot
    FROM (
      SELECT property_node, unit_type_id, stay_date::text, physical, sold, held, blocked, ooo, available
      FROM availability_projection
      WHERE tenant_id = ${SEED_TENANT.id}::uuid AND property_node = ${SEED_PROPERTY.id}::uuid
    ) AS row_value
  `;
  return rows[0]?.snapshot ?? "[]";
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  const review = await runReviewSeed({ databaseUrl: DATABASE_URL, password: PASSWORD, logger: () => undefined });
  userId = review.userId;
  admin = new SQL(DATABASE_URL, { max: 4 });
  loginPool = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 4 });
  database = Database.connect(DATABASE_URL, { maxConnections: 12 });
  tokens = new Hs256TokenSigner(SECRET);
  events = new PostgresEventBus(eventPool);
  projection = new AvailabilityProjectionService();
  app = makeApp(projection);
  await admin`DELETE FROM availability_projection WHERE tenant_id = ${SEED_TENANT.id}::uuid`;
  await admin`DELETE FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid AND operation = 'operator.inventory.projection.rebuild'`;
  const login = await request("/api/v1/auth/local:login", {
    method: "POST",
    headers: { "content-type": "application/json" },
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

databaseDescribe("Order 060 operator projection bootstrap", () => {
  test("P1: empty status and explicit rebuild expose the exact half-open horizon", async () => {
    const path = `/api/v1/properties/${SEED_PROPERTY.id}/availability-projection`;
    const empty = await request(path, { headers: headers() });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({
      propertyNode: SEED_PROPERTY.id, fromDate: null, toDate: null,
      rows: 0, unitTypes: 0, updatedAt: null,
    });

    const rebuilt = await request(`${path}:rebuild`, {
      method: "POST", headers: headers("order060-exact"),
      body: JSON.stringify({ fromDate: "2027-04-01", toDate: "2027-04-04" }),
    });
    expect(rebuilt.status).toBe(200);
    const body = await rebuilt.json() as Record<string, unknown>;
    expect(body.fromDate).toBe("2027-04-01");
    expect(body.toDate).toBe("2027-04-04");
    expect(Number(body.rows)).toBeGreaterThan(0);
    expect(Number(body.unitTypes)).toBeGreaterThan(0);
    expect(body.updatedAt).toMatch(/^2027-|^20\d\d-/);

    const status = await request(path, { headers: headers() });
    expect(await status.json()).toEqual(body);
  });

  test("P2: exact replay is stable and changed input conflicts without mutation", async () => {
    const path = `/api/v1/properties/${SEED_PROPERTY.id}/availability-projection:rebuild`;
    const input = { fromDate: "2027-04-10", toDate: "2027-04-13" };
    const first = await request(path, { method: "POST", headers: headers("order060-replay"), body: JSON.stringify(input) });
    expect(first.status).toBe(200);
    expect(first.headers.get("idempotency-replayed")).toBe("false");
    const firstText = await first.text();
    expect(JSON.parse(firstText)).toEqual(expect.objectContaining({ fromDate: "2027-04-10", toDate: "2027-04-13" }));
    const removed = await admin<Array<{ rows: number }>>`
      SELECT count(*)::int AS rows FROM availability_projection
      WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
        AND stay_date >= '2027-04-01'::date AND stay_date < '2027-04-04'::date
    `;
    expect(removed[0]?.rows).toBe(0);
    const before = await projectionBytes();
    const replay = await request(path, { method: "POST", headers: headers("order060-replay"), body: JSON.stringify(input) });
    expect(replay.status).toBe(200);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.text()).toBe(firstText);
    const conflict = await request(path, {
      method: "POST", headers: headers("order060-replay"),
      body: JSON.stringify({ ...input, toDate: "2027-04-14" }),
    });
    expect(conflict.status).toBe(409);
    expect(await projectionBytes()).toBe(before);
  });

  test("P3: malformed and ungranted requests fail closed without projection changes", async () => {
    const before = await projectionBytes();
    const path = `/api/v1/properties/${SEED_PROPERTY.id}/availability-projection:rebuild`;
    for (const [key, body] of [
      ["bad-date", { fromDate: "2027-02-30", toDate: "2027-03-02" }],
      ["zero", { fromDate: "2027-04-01", toDate: "2027-04-01" }],
      ["large", { fromDate: "2027-01-01", toDate: "2028-02-06" }],
      ["extra", { fromDate: "2027-04-01", toDate: "2027-04-02", tenantId: SEED_TENANT.id }],
    ] as const) {
      const response = await request(path, { method: "POST", headers: headers(`order060-${key}`), body: JSON.stringify(body) });
      expect(response.status).toBe(400);
    }
    const invalid = await request("/api/v1/properties/not-a-uuid/availability-projection", { headers: headers() });
    expect(invalid.status).toBe(400);
    const denied = await request("/api/v1/properties/00000000-0000-0000-0000-000000009999/availability-projection", { headers: headers() });
    expect(denied.status).toBe(403);
    const noScope = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: [] });
    const readOnly = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["inventory.configuration:read"] });
    const writeOnly = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["inventory.configuration:write"] });
    expect((await request(`/api/v1/properties/${SEED_PROPERTY.id}/availability-projection`, { headers: headers(undefined, noScope) })).status).toBe(403);
    expect((await request(`/api/v1/properties/${SEED_PROPERTY.id}/availability-projection`, { headers: headers(undefined, writeOnly) })).status).toBe(403);
    expect((await request(path, {
      method: "POST", headers: headers("order060-read-only", readOnly),
      body: JSON.stringify({ fromDate: "2027-04-01", toDate: "2027-04-02" }),
    })).status).toBe(403);
    expect((await request(`/api/v1/properties/${SEED_PROPERTY.id}/availability-projection`, { headers: headers(undefined, "") })).status).toBe(401);
    expect(await projectionBytes()).toBe(before);
  });

  test("P4: rebuild failure rolls back derived rows and claim, then exact retry succeeds", async () => {
    const before = await projectionBytes();
    const claimsBefore = await admin<Array<{ count: number }>>`
      SELECT count(*)::int FROM api_idempotency
      WHERE tenant_id=${SEED_TENANT.id}::uuid AND operation='operator.inventory.projection.rebuild'
    `;
    const key = "order060-injected-retry";
    let fail = true;
    const failingApp = makeApp({
      status: (tx, propertyNode) => projection.status(tx, propertyNode),
      async replaceHorizon(tx, input) {
        const result = await projection.replaceHorizon(tx, input);
        if (fail) throw new Error("Order 060 injected post-rebuild failure");
        return result;
      },
    });
    const path = `/api/v1/properties/${SEED_PROPERTY.id}/availability-projection:rebuild`;
    const init = {
      method: "POST", headers: headers(key),
      body: JSON.stringify({ fromDate: "2027-05-01", toDate: "2027-05-04" }),
    };
    const failed = await failingApp.handle(new Request(`http://yellow.test${path}`, init));
    expect(failed.status).toBe(503);
    expect((await failed.json() as { detail: string }).detail).toBe("Operator service is temporarily unavailable");
    expect(await projectionBytes()).toBe(before);
    const claims = await admin<Array<{ count: number }>>`
      SELECT count(*)::int FROM api_idempotency
      WHERE tenant_id=${SEED_TENANT.id}::uuid AND operation='operator.inventory.projection.rebuild'
    `;
    expect(claims[0]?.count).toBe(claimsBefore[0]?.count);
    fail = false;
    const retry = await failingApp.handle(new Request(`http://yellow.test${path}`, init));
    expect(retry.status).toBe(200);
    expect(retry.headers.get("idempotency-replayed")).toBe("false");

    const brokenStatusApp = makeApp({
      async status() { throw new Error("SELECT secret_internal FROM unavailable"); },
      replaceHorizon: (tx, input) => projection.replaceHorizon(tx, input),
    });
    const statusFailure = await brokenStatusApp.handle(new Request(
      `http://yellow.test/api/v1/properties/${SEED_PROPERTY.id}/availability-projection`,
      { headers: headers() },
    ));
    expect(statusFailure.status).toBe(503);
    expect(await statusFailure.text()).not.toContain("secret_internal");
  });

  test("P7: canonical hold event converges inside the chosen horizon without widening it", async () => {
    const bootstrap = await request(`/api/v1/properties/${SEED_PROPERTY.id}/availability-projection:rebuild`, {
      method: "POST", headers: headers("order060-p7-bootstrap"),
      body: JSON.stringify({ fromDate: "2027-05-01", toDate: "2027-05-04" }),
    });
    expect(bootstrap.status).toBe(200);
    const sellables = await admin<Array<{ id: string }>>`
      SELECT sellable_unit.id
      FROM sellable_unit
      JOIN unit_type ON unit_type.id=sellable_unit.unit_type_id AND unit_type.tenant_id=sellable_unit.tenant_id
      WHERE sellable_unit.tenant_id=${SEED_TENANT.id}::uuid AND unit_type.property_node=${SEED_PROPERTY.id}::uuid
      ORDER BY sellable_unit.name LIMIT 1
    `;
    const holdService = new HoldService(events);
    await database.withTenantTransaction(SEED_TENANT.id, (tx) => holdService.place(tx, {
      sellableUnitId: sellables[0]!.id,
      from: new Date("2027-05-01T15:00:00.000Z"),
      to: new Date("2027-05-02T15:00:00.000Z"),
      ttlSeconds: 900,
      holder: { reference: "Order 060 convergence" },
      envelope: createAuditEnvelope({
        actorId: userId, tenantId: SEED_TENANT.id, propertyNode: SEED_PROPERTY.id,
        requestId: crypto.randomUUID(), operation: "hold.created",
      }),
    }));
    const consumer = new AvailabilityProjectionConsumer(events, projection, { batchSize: 100 });
    for (let index = 0; index < 20; index += 1) {
      const result = await consumer.drainOnce();
      if (result.processed === 0) break;
    }
    const rows = await admin<Array<{ from_date: string; to_date: string; held: number }>>`
      SELECT min(stay_date)::text AS from_date, (max(stay_date)+1)::text AS to_date,
             sum(held)::int AS held
      FROM availability_projection
      WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
    `;
    expect(rows[0]?.from_date).toBe("2027-05-01");
    expect(rows[0]?.to_date).toBe("2027-05-04");
    expect(rows[0]?.held).toBeGreaterThan(0);
  });

  test("P5/P6: surface is explicit, themed and states that projection is not authority", async () => {
    const html = await operatorAssets.html().text();
    const js = await operatorAssets.js().text();
    expect(html).toContain('id="projection-from-date"');
    expect(html).toContain('id="projection-to-date"');
    expect(html).toContain('id="projection-rebuild-form"');
    expect(html).toContain("never authorizes holds or bookings");
    expect(js).toContain("availability-projection:rebuild");
    expect(js).toContain('addEventListener("submit"');
    expect(js).not.toContain('dispatchEvent(new Event("submit"))');
    expect(html).toContain('<option value="apple">Apple calm</option>');
    expect(html).toContain('<option value="pixel">Pixel expressive</option>');
  });
});
