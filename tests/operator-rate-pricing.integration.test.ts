import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import { RateConfigurationService, RatePricingService } from "../src/contexts/rates";
import { OperatorHttpApi } from "../src/http/operator";
import { createAuditEnvelope, Database, PostgresEventBus, PostgresIdempotency } from "../src/kernel";
import { runReviewSeed, REVIEW_EMAIL } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_OPERATOR_PRICING_URL;
const PASSWORD = process.env.YELLOW_OPERATOR_PRICING_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_PRICING === "1";
const SECRET = "yellow-order-051-test-token-secret-exactly-long-enough";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000005191";
const UNKNOWN_UNIT = "00000000-0000-0000-0000-000000005192";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_OPERATOR_PRICING_URL and YELLOW_OPERATOR_PRICING_PASSWORD are required by Order 051");
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
let ratePlanId = "";
let unitTypeId = "";

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

function pricePath(suffix = "", property: string = SEED_PROPERTY.id): string {
  return `/api/v1/properties/${property}/rate-prices${suffix}`;
}

function canonicalBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ratePlanId,
    unitTypeId,
    stayStart: "2041-01-01",
    stayEnd: "2041-02-01",
    dowMask: 127,
    pricing: {
      occupancy: [
        { adults: 1, amountMinor: "9007199254740993" },
        { adults: 2, amountMinor: "9223372036854775807" },
      ],
      extraAdultMinor: "9007199254740995",
      extraChildren: [{ maxAge: 17, amountMinor: "9007199254740997" }],
    },
    ...overrides,
  };
}

async function postPrice(body: unknown, key?: string, token = accessToken, property: string = SEED_PROPERTY.id): Promise<Response> {
  return request(pricePath("", property), {
    method: "POST", headers: headers(token, key), body: JSON.stringify(body),
  });
}

function audit(operation: "rate_plan.created" | "rate_price.created") {
  return createAuditEnvelope({
    actorId: userId,
    tenantId: SEED_TENANT.id,
    propertyNode: SEED_PROPERTY.id,
    requestId: crypto.randomUUID(),
    operation,
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
  const rates = new RateConfigurationService(events);
  const pricing = new RatePricingService(events);
  const unitRows = await admin<Array<{ id: string }>>`
    SELECT id FROM unit_type
    WHERE tenant_id = ${SEED_TENANT.id}::uuid AND property_node = ${SEED_PROPERTY.id}::uuid AND code = 'STD'
  `;
  unitTypeId = unitRows[0]?.id ?? "";
  const plan = await database.withTenantTransaction(SEED_TENANT.id, (tx) => rates.createRatePlan(tx, {
    code: "O51", name: "Order 051 flexible", currency: "USD", envelope: audit("rate_plan.created"),
  }));
  ratePlanId = plan.id;
  await database.withTenantTransaction(SEED_TENANT.id, (tx) => pricing.create(tx, {
    ratePlanId, unitTypeId, stayStart: "2040-01-01", stayEnd: "2040-02-01", dowMask: 127,
    pricing: { occupancy: { "1": 9_007_199_254_740_993n } }, envelope: audit("rate_price.created"),
  }));
  app = createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      new LocalLoginService(loginPool, tokens), new AvailabilityService(), undefined,
      new PostgresIdempotency(), undefined, rates, pricing,
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

databaseDescribe("Order 051 operator rate-price management", () => {
  test("P1: current PostgreSQL price returns exact string money", async () => {
    const query = new URLSearchParams({ ratePlanId, unitTypeId, stayDate: "2040-01-15" });
    const response = await request(`${pricePath("/current")}?${query}`, { headers: headers() });
    expect(response.status).toBe(200);
    const body = await response.json() as { ratePrice: { pricing: { occupancy: Record<string, string> } } };
    expect(body.ratePrice.pricing.occupancy).toEqual({ "1": "9007199254740993" });
    expect((await request(`${pricePath("/current", FOREIGN_PROPERTY)}?${query}`, { headers: headers() })).status).toBe(403);
  });

  test("P2: exact string amounts create numeric JSONB with non-monetary evidence", async () => {
    const response = await postPrice(canonicalBody(), "order051-create");
    expect(response.status).toBe(201);
    const body = await response.json() as { ratePrice: { id: string; pricing: { occupancy: Record<string, string>; extraAdultMinor: string; extraChildren: Array<{ maxAge: number; amountMinor: string }> } } };
    expect(body.ratePrice.pricing).toEqual({
      occupancy: { "1": "9007199254740993", "2": "9223372036854775807" },
      extraAdultMinor: "9007199254740995",
      extraChildren: [{ maxAge: 17, amountMinor: "9007199254740997" }],
    });
    const rows = await admin<Array<{ occ_types: string[]; event_has_money: boolean; facts: number }>>`
      SELECT ARRAY(SELECT jsonb_typeof(value) FROM jsonb_each(rp.pricing->'occ') ORDER BY key::int) AS occ_types,
             (o.payload::text ~ '9007199254740993|9223372036854775807') AS event_has_money,
             (SELECT count(*)::int FROM fact_log WHERE entity_id = rp.id) AS facts
      FROM rate_price rp JOIN outbox o ON o.aggregate_id = rp.id WHERE rp.id = ${body.ratePrice.id}::uuid
    `;
    expect(rows[0]).toEqual({ occ_types: ["number", "number"], event_has_money: false, facts: 1 });
  });

  test("P3: durable replay is byte-equivalent and changed reuse conflicts", async () => {
    const body = canonicalBody({ stayStart: "2042-01-01", stayEnd: "2042-02-01" });
    const first = await postPrice(body, "order051-replay");
    const firstText = await first.text();
    const second = await postPrice(body, "order051-replay");
    expect(second.status).toBe(201);
    expect(second.headers.get("idempotency-replayed")).toBe("true");
    expect(await second.text()).toBe(firstText);
    expect((await postPrice({ ...body, dowMask: 31 }, "order051-replay")).status).toBe(409);
  });

  test("P4: malformed and unauthorized money writes persist nothing", async () => {
    const before = await admin<Array<{ prices: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM rate_price WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS prices,
             (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
    `;
    const invalidAmounts = [1, "-1", "+1", "01", "1.0", "1e2", "9223372036854775808"];
    for (const [index, amountMinor] of invalidAmounts.entries()) {
      const body = canonicalBody({ pricing: { occupancy: [{ adults: 1, amountMinor }] } });
      expect((await postPrice(body, `order051-invalid-${index}`)).status).toBe(400);
    }
    expect((await postPrice({ ...canonicalBody(), extra: true }, "order051-extra")).status).toBe(400);
    expect((await postPrice(canonicalBody({ unitTypeId: UNKNOWN_UNIT }), "order051-unknown-unit")).status).toBe(404);
    const noScope = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["rates.pricing:read"] });
    expect((await postPrice(canonicalBody(), "order051-no-scope", noScope)).status).toBe(403);
    expect((await postPrice(canonicalBody(), "order051-foreign-property", accessToken, FOREIGN_PROPERTY)).status).toBe(403);
    const foreignTenant = await tokens.issue({ userId, tenantId: FOREIGN_PROPERTY, scopes: ["rates.pricing:write"] });
    expect((await postPrice(canonicalBody(), "order051-foreign-tenant", foreignTenant)).status).toBe(403);
    const after = await admin<Array<{ prices: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM rate_price WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS prices,
             (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
    `;
    expect(after).toEqual(before);
  });

  test("P5: publisher failure rolls every artifact and claim back before retry", async () => {
    const before = await admin<Array<{ prices: number; facts: number; events: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM rate_price WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS prices,
             (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS facts,
             (SELECT count(*)::int FROM outbox WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS events,
             (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
    `;
    const failingPricing = new RatePricingService({
      async publish(): Promise<never> { throw new Error("pricing publisher secret"); },
      async consumeBatch(): Promise<never> { throw new Error("not used"); },
    });
    const failing = createApp({
      database, tenantResolver: new BearerTenantResolver(tokens),
      operatorApi: new OperatorHttpApi(
        new LocalLoginService(loginPool, tokens), new AvailabilityService(), undefined,
        new PostgresIdempotency(), undefined, undefined, failingPricing,
      ),
    });
    const body = canonicalBody({ stayStart: "2043-01-01", stayEnd: "2043-02-01" });
    const failed = await failing.handle(new Request(`http://yellow.test${pricePath()}`, {
      method: "POST", headers: headers(accessToken, "order051-rollback"), body: JSON.stringify(body),
    }));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("secret");
    const afterFailure = await admin<Array<{ prices: number; facts: number; events: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM rate_price WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS prices,
             (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS facts,
             (SELECT count(*)::int FROM outbox WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS events,
             (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
    `;
    expect(afterFailure).toEqual(before);
    expect((await postPrice(body, "order051-rollback")).status).toBe(201);
  });

  test("P6/P7: progressive exact-money UI and exact seventeen-scope login", async () => {
    const html = await (await request("/")).text();
    const css = await (await request("/assets/operator.css")).text();
    const js = await (await request("/assets/operator.js")).text();
    expect(html).toContain('id="rate-price-form"');
    expect(html).toContain('id="current-price-form"');
    expect(html).toContain('id="create-tier-list"');
    expect(html).toContain('id="add-create-tier"');
    expect(html).toContain("Exact minor units");
    expect(css).toContain(':root[data-theme="pixel"]');
    expect(js).toContain("BigInt");
    expect(js).not.toMatch(/parseFloat|Number\([^)]*(?:amount|price)/i);
    expect(js).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    expect(js).not.toMatch(/\b(?:SELECT|INSERT|UPDATE|DELETE)\s/i);
    expect(js).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect((await tokens.verify(accessToken))?.scp).toBe(
      "inventory.availability:read inventory.blocks:read inventory.blocks:write inventory.configuration:read inventory.configuration:write inventory.holds:read inventory.holds:write inventory.offline_leases:read inventory.offline_leases:write inventory.policy:read inventory.policy:write inventory.restriction:read inventory.restriction:write rates.configuration:read rates.configuration:write rates.pricing:read rates.pricing:write",
    );
  });
});
