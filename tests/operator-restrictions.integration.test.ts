import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService, InventoryService, RestrictionService } from "../src/contexts/inventory";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, PostgresEventBus, PostgresIdempotency } from "../src/kernel";
import { runReviewSeed, REVIEW_EMAIL } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_OPERATOR_RESTRICTION_URL;
const PASSWORD = process.env.YELLOW_OPERATOR_RESTRICTION_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_RESTRICTION === "1";
const SECRET = "yellow-order-049-test-token-secret-exactly-long-enough";
const FROM = "2031-06-10T15:00:00.000Z";
const TO = "2031-06-12T15:00:00.000Z";
const STAY_START = "2031-06-10";
const STAY_END = "2031-06-13";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000004991";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_OPERATOR_RESTRICTION_URL and YELLOW_OPERATOR_RESTRICTION_PASSWORD are required by Order 049");
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let database: Database;
let tokens: Hs256TokenSigner;
let app: ReturnType<typeof createApp>;
let accessToken = "";
let userId = "";
let created: Record<string, unknown>;

function headers(token = accessToken, key?: string): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(key ? { "idempotency-key": key } : {}),
  };
}

function request(path: string, init: RequestInit = {}): Promise<Response> {
  return app.handle(new Request(`http://yellow.test${path}`, init));
}

async function createRestriction(body: unknown, key?: string, token = accessToken): Promise<Response> {
  return request(`/api/v1/properties/${SEED_PROPERTY.id}/restrictions`, {
    method: "POST", headers: headers(token, key), body: JSON.stringify(body),
  });
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
  const events = new PostgresEventBus(eventPool);
  app = createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      new LocalLoginService(loginPool, tokens),
      new AvailabilityService(),
      new InventoryService(events),
      new PostgresIdempotency(),
      new RestrictionService(events),
    ),
  });
  const login = await request("/api/v1/auth/local:login", {
    method: "POST", headers: headers(""),
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

databaseDescribe("Order 049 operator restriction management", () => {
  test("P1: authorized restriction read is deterministic and property-scoped", async () => {
    const response = await request(`/api/v1/properties/${SEED_PROPERTY.id}/restrictions`, { headers: headers() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ restrictions: [] });
    expect((await request(`/api/v1/properties/${FOREIGN_PROPERTY}/restrictions`, { headers: headers() })).status).toBe(403);
  });

  test("P2: closed restriction commits exact evidence and blocks existing availability", async () => {
    const response = await createRestriction({
      restrictions: [{ kind: "closed", stayStart: STAY_START, stayEnd: STAY_END }],
    }, "order049-closed-key");
    expect(response.status).toBe(201);
    expect(response.headers.get("idempotency-replayed")).toBe("false");
    const body = await response.json() as { restrictions: Array<Record<string, unknown>> };
    expect(body.restrictions).toHaveLength(1);
    created = body.restrictions[0]!;
    expect(created).toMatchObject({ kind: "closed", value: null, stayStart: STAY_START, stayEnd: STAY_END, source: "manual" });
    const evidence = await admin<Array<{ facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM fact_log WHERE entity_id = ${String(created.id)}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id = ${String(created.id)}::uuid) AS events
    `;
    expect(evidence).toEqual([{ facts: 1, events: 1 }]);

    const availability = await request(`/api/v1/properties/${SEED_PROPERTY.id}/availability:search`, {
      method: "POST", headers: headers(), body: JSON.stringify({ from: FROM, to: TO, partySize: 1 }),
    });
    expect(availability.status).toBe(200);
    const options = (await availability.json() as { options: Array<{ bookable: boolean; restrictionsApplied: unknown[] }> }).options;
    expect(options).toHaveLength(5);
    expect(options.every(({ bookable, restrictionsApplied }) => !bookable && restrictionsApplied.length === 1)).toBe(true);
  });

  test("P3: replay is exact and changed-request key reuse conflicts", async () => {
    const original = { restrictions: [{ kind: "closed", stayStart: STAY_START, stayEnd: STAY_END }] };
    const replay = await createRestriction(original, "order049-closed-key");
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.json()).toEqual({ restrictions: [created] });
    const changed = await createRestriction({
      restrictions: [{ kind: "cta", stayStart: STAY_START, stayEnd: STAY_END }],
    }, "order049-closed-key");
    expect(changed.status).toBe(409);
    expect(await admin`SELECT id FROM restriction WHERE tenant_id = ${SEED_TENANT.id}::uuid`).toHaveLength(1);
  });

  test("P4: malformed and unauthorized writes leave restriction and claim counts unchanged", async () => {
    const before = await admin<Array<{ restrictions: number; claims: number }>>`
      SELECT
        (SELECT count(*)::int FROM restriction WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS restrictions,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
    `;
    expect((await createRestriction({ restrictions: [] })).status).toBe(400);
    expect((await createRestriction({ restrictions: [], extra: true }, "order049-extra-key")).status).toBe(400);
    expect((await createRestriction({
      restrictions: [{ kind: "min_los", value: 0, stayStart: STAY_START, stayEnd: STAY_END }],
    }, "order049-invalid-value-key")).status).toBe(400);
    expect((await createRestriction({
      restrictions: [{ kind: "closed", stayStart: STAY_END, stayEnd: STAY_START }],
    }, "order049-invalid-date-key")).status).toBe(400);
    expect((await createRestriction({
      restrictions: [{ kind: "invented", stayStart: STAY_START, stayEnd: STAY_END }],
    }, "order049-invalid-kind-key")).status).toBe(400);
    const noScope = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["inventory.availability:read"] });
    expect((await createRestriction({
      restrictions: [{ kind: "cta", stayStart: STAY_START, stayEnd: STAY_END }],
    }, "order049-no-scope-key", noScope)).status).toBe(403);
    const foreignTenant = await tokens.issue({
      userId,
      tenantId: "00000000-0000-0000-0000-000000004992",
      scopes: ["inventory.restriction:write"],
    });
    expect((await createRestriction({
      restrictions: [{ kind: "ctd", stayStart: STAY_START, stayEnd: STAY_END }],
    }, "order049-foreign-tenant-key", foreignTenant)).status).toBe(403);
    expect((await request(`/api/v1/properties/${FOREIGN_PROPERTY}/restrictions`, {
      method: "POST", headers: headers(accessToken, "order049-foreign-property-key"),
      body: JSON.stringify({ restrictions: [{ kind: "cta", stayStart: STAY_START, stayEnd: STAY_END }] }),
    })).status).toBe(403);
    const after = await admin<Array<{ restrictions: number; claims: number }>>`
      SELECT
        (SELECT count(*)::int FROM restriction WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS restrictions,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
    `;
    expect(after).toEqual(before);
  });

  test("P5: publisher failure rolls restriction and claim back before retry", async () => {
    const before = await admin<Array<{ restrictions: number; facts: number; events: number; claims: number }>>`
      SELECT
        (SELECT count(*)::int FROM restriction WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS restrictions,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
    `;
    const failingRestrictions = new RestrictionService({
      async publish(): Promise<never> { throw new Error("restriction publisher secret"); },
      async consumeBatch(): Promise<never> { throw new Error("not used"); },
    });
    const failing = createApp({
      database,
      tenantResolver: new BearerTenantResolver(tokens),
      operatorApi: new OperatorHttpApi(
        new LocalLoginService(loginPool, tokens), new AvailabilityService(), undefined,
        new PostgresIdempotency(), failingRestrictions,
      ),
    });
    const body = { restrictions: [{ kind: "max_los", value: 4, stayStart: "2031-07-01", stayEnd: "2031-07-10" }] };
    const failed = await failing.handle(new Request(
      `http://yellow.test/api/v1/properties/${SEED_PROPERTY.id}/restrictions`, {
        method: "POST", headers: headers(accessToken, "order049-rollback-key"), body: JSON.stringify(body),
      },
    ));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("secret");
    expect(await admin`SELECT id FROM restriction WHERE kind = 'max_los' AND value = 4`).toHaveLength(0);
    const afterFailure = await admin<Array<{ restrictions: number; facts: number; events: number; claims: number }>>`
      SELECT
        (SELECT count(*)::int FROM restriction WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS restrictions,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
    `;
    expect(afterFailure).toEqual(before);
    const retry = await createRestriction(body, "order049-rollback-key");
    expect(retry.status).toBe(201);
    expect(retry.headers.get("idempotency-replayed")).toBe("false");
  });

  test("P6/P7: one themed restrictions UI and exact fifteen-scope login", async () => {
    const html = await (await request("/")).text();
    const css = await (await request("/assets/operator.css")).text();
    const js = await (await request("/assets/operator.js")).text();
    expect(html).toContain('id="restrictions-view"');
    expect(html).toContain('id="restriction-form"');
    expect(html).toContain("End date is exclusive");
    expect(css).toContain(':root[data-theme="pixel"]');
    expect(js).toContain('"restrictions"');
    expect(js).toContain("idempotency-key");
    expect(js).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    expect((await tokens.verify(accessToken))?.scp).toBe(
      "inventory.availability:read inventory.blocks:read inventory.blocks:write inventory.configuration:read inventory.configuration:write inventory.holds:read inventory.holds:write inventory.policy:read inventory.policy:write inventory.restriction:read inventory.restriction:write rates.configuration:read rates.configuration:write rates.pricing:read rates.pricing:write",
    );
  });
});
