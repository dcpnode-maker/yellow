import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import { RateConfigurationService, RatePricingService, type RatePrice } from "../src/contexts/rates";
import { OperatorHttpApi } from "../src/http/operator";
import { createAuditEnvelope, Database, PostgresEventBus, PostgresIdempotency } from "../src/kernel";
import { runReviewSeed, REVIEW_EMAIL } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";
import { BROWSER_SQL_SYNTAX } from "./helpers/browser-asset-security";

const DATABASE_URL = process.env.YELLOW_OPERATOR_CORRECTION_URL;
const PASSWORD = process.env.YELLOW_OPERATOR_CORRECTION_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_CORRECTION === "1";
const SECRET = "yellow-order-052-test-token-secret-exactly-long-enough";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000005291";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_OPERATOR_CORRECTION_URL and YELLOW_OPERATOR_CORRECTION_PASSWORD are required by Order 052");
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let database: Database;
let tokens: Hs256TokenSigner;
let pricing: RatePricingService;
let app: ReturnType<typeof createApp>;
let accessToken = "";
let userId = "";
let ratePlanId = "";
let unitTypeId = "";
let sources: { p1: RatePrice; p2: RatePrice; race: RatePrice; invalid: RatePrice; failure: RatePrice };
let p1SuccessorId = "";

function headers(token = accessToken, key?: string): Record<string, string> {
  return { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(key ? { "idempotency-key": key } : {}) };
}

function request(path: string, init: RequestInit = {}): Promise<Response> {
  return app.handle(new Request(`http://yellow.test${path}`, init));
}

function correctionPath(ratePriceId: string, property: string = SEED_PROPERTY.id): string {
  return `/api/v1/properties/${property}/rate-prices/${ratePriceId}/supersede`;
}

function currentPath(stayDate: string): string {
  const query = new URLSearchParams({ ratePlanId, unitTypeId, stayDate });
  return `/api/v1/properties/${SEED_PROPERTY.id}/rate-prices/current?${query}`;
}

function pricingBody(amount = "9007199254740993"): Record<string, unknown> {
  return { pricing: {
    occupancy: [{ adults: 1, amountMinor: amount }, { adults: 2, amountMinor: "9223372036854775807" }],
    extraAdultMinor: "9007199254740995",
    extraChildren: [{ maxAge: 5, amountMinor: "0" }, { maxAge: 17, amountMinor: "9007199254740997" }],
  } };
}

async function correct(source: RatePrice, body: unknown, key?: string, token = accessToken,
  property: string = SEED_PROPERTY.id, target = app): Promise<Response> {
  return target.handle(new Request(`http://yellow.test${correctionPath(source.id, property)}`, {
    method: "POST", headers: headers(token, key), body: JSON.stringify(body),
  }));
}

function audit(operation: "rate_plan.created" | "rate_price.created" | "rate_price.superseded") {
  return createAuditEnvelope({ actorId: userId, tenantId: SEED_TENANT.id, propertyNode: SEED_PROPERTY.id,
    requestId: crypto.randomUUID(), operation });
}

async function createSource(stayStart: string, amountMinor: bigint): Promise<RatePrice> {
  const day = Number(stayStart.slice(-2));
  const stayEnd = `${stayStart.slice(0, -2)}${String(day + 1).padStart(2, "0")}`;
  return database.withTenantTransaction(SEED_TENANT.id, (tx) => pricing.create(tx, {
    ratePlanId, unitTypeId, stayStart, stayEnd, dowMask: 127,
    pricing: { occupancy: { "1": amountMinor } }, envelope: audit("rate_price.created"),
  }));
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  const review = await runReviewSeed({ databaseUrl: DATABASE_URL, password: PASSWORD, logger: () => undefined });
  userId = review.userId;
  admin = new SQL(DATABASE_URL, { max: 8 });
  loginPool = new SQL(DATABASE_URL, { max: 6 });
  eventPool = new SQL(DATABASE_URL, { max: 12 });
  database = Database.connect(DATABASE_URL, { maxConnections: 36 });
  tokens = new Hs256TokenSigner(SECRET);
  const events = new PostgresEventBus(eventPool);
  const configuration = new RateConfigurationService(events);
  pricing = new RatePricingService(events);
  const unitRows = await admin<Array<{ id: string }>>`
    SELECT id FROM unit_type WHERE tenant_id = ${SEED_TENANT.id}::uuid
      AND property_node = ${SEED_PROPERTY.id}::uuid AND code = 'STD'
  `;
  unitTypeId = unitRows[0]?.id ?? "";
  const plan = await database.withTenantTransaction(SEED_TENANT.id, (tx) => configuration.createRatePlan(tx, {
    code: "O52", name: "Order 052 correctable", currency: "USD", envelope: audit("rate_plan.created"),
  }));
  ratePlanId = plan.id;
  sources = {
    p1: await createSource("2050-01-01", 100n),
    p2: await createSource("2050-02-01", 200n),
    race: await createSource("2050-03-01", 300n),
    invalid: await createSource("2050-04-01", 400n),
    failure: await createSource("2050-05-01", 500n),
  };
  app = createApp({ database, tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(new LocalLoginService(loginPool, tokens), new AvailabilityService(),
      undefined, new PostgresIdempotency(), undefined, configuration, pricing) });
  const login = await request("/api/v1/auth/local:login", { method: "POST", headers: headers(""),
    body: JSON.stringify({ tenant: SEED_TENANT.slug, email: REVIEW_EMAIL, password: PASSWORD }) });
  expect(login.status).toBe(200);
  accessToken = (await login.json() as { accessToken: string }).accessToken;
});

afterAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await database.close(); await eventPool.close(); await loginPool.close(); await admin.close();
});

databaseDescribe("Order 052 operator rate-price correction", () => {
  test("P1: one correction preserves its key and creates exact immutable evidence", async () => {
    const response = await correct(sources.p1, pricingBody(), "order052-p1");
    expect(response.status).toBe(201);
    const body = await response.json() as { ratePrice: Omit<RatePrice, "pricing"> & {
      pricing: { occupancy: Record<string, string>; extraAdultMinor: string | null;
        extraChildren: Array<{ maxAge: number; amountMinor: string }> } } };
    p1SuccessorId = body.ratePrice.id;
    expect(body.ratePrice).toMatchObject({ ratePlanId, unitTypeId, stayStart: sources.p1.stayStart,
      stayEnd: sources.p1.stayEnd, dowMask: 127, currency: "USD", supersededBy: null });
    expect(body.ratePrice.pricing.occupancy).toEqual({ "1": "9007199254740993", "2": "9223372036854775807" });
    const rows = await admin<Array<{ link: string; old_amount: string; facts: number; events: number; event_has_money: boolean }>>`
      SELECT old.superseded_by AS link, old.pricing->'occ'->>'1' AS old_amount,
        (SELECT count(*)::int FROM fact_log WHERE fact_type = 'rate_price.superseded'
          AND entity_id IN (old.id, old.superseded_by)) AS facts,
        (SELECT count(*)::int FROM outbox WHERE event_type = 'rate_price.superseded'
          AND aggregate_id = old.superseded_by) AS events,
        EXISTS(SELECT 1 FROM outbox WHERE event_type = 'rate_price.superseded'
          AND aggregate_id = old.superseded_by AND payload::text ~ '9007199254740993|9223372036854775807') AS event_has_money
      FROM rate_price old WHERE old.id = ${sources.p1.id}::uuid
    `;
    expect(rows[0]).toEqual({ link: p1SuccessorId, old_amount: "100", facts: 2, events: 1, event_has_money: false });
  });

  test("P2: correction replay is byte-equivalent and changed reuse conflicts", async () => {
    const first = await correct(sources.p2, pricingBody("700"), "order052-replay");
    const firstText = await first.text();
    const second = await correct(sources.p2, pricingBody("700"), "order052-replay");
    expect(second.status).toBe(201);
    expect(second.headers.get("idempotency-replayed")).toBe("true");
    expect(await second.text()).toBe(firstText);
    expect((await correct(sources.p2, pricingBody("701"), "order052-replay")).status).toBe(409);
  });

  test("P3: twenty concurrent corrections produce one winner and no fork", async () => {
    const claimsBefore = await admin<Array<{ claims: number }>>`
      SELECT count(*)::int AS claims FROM api_idempotency
      WHERE operation = 'operator.rates.price.supersede'
    `;
    const responses = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      correct(sources.race, pricingBody(String(1000 + index)), `order052-race-${index}`)));
    const statuses = responses.map(({ status }) => status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(19);
    expect(statuses.filter((status) => status !== 201 && status !== 409)).toEqual([]);
    const rows = await admin<Array<{ linked: boolean; facts: number; events: number; claims: number }>>`
      SELECT old.superseded_by IS NOT NULL AS linked,
        (SELECT count(*)::int FROM fact_log WHERE fact_type = 'rate_price.superseded'
          AND payload @> ${JSON.stringify({ old_rate_price_id: sources.race.id })}::text::jsonb) AS facts,
        (SELECT count(*)::int FROM outbox WHERE event_type = 'rate_price.superseded'
          AND payload @> ${JSON.stringify({ old_rate_price_id: sources.race.id })}::text::jsonb) AS events,
        (SELECT count(*)::int FROM api_idempotency
          WHERE operation = 'operator.rates.price.supersede') AS claims
      FROM rate_price old WHERE old.id = ${sources.race.id}::uuid
    `;
    expect(rows[0]?.linked).toBe(true);
    expect(rows[0]?.facts).toBe(2);
    expect(rows[0]?.events).toBe(1);
    expect(rows[0]?.claims).toBe((claimsBefore[0]?.claims ?? 0) + 1);
  });

  test("P4: invalid and unauthorized corrections persist no successor or claim", async () => {
    const before = await admin<Array<{ prices: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM rate_price WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS prices,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
    `;
    expect((await correct(sources.invalid, pricingBody())).status).toBe(400);
    expect((await correct(sources.invalid, { ...pricingBody(), stayStart: "2051-01-01" }, "order052-extra")).status).toBe(400);
    expect((await correct(sources.invalid, { pricing: { occupancy: [{ adults: 1, amountMinor: 1 }] } }, "order052-number")).status).toBe(400);
    expect((await correct(sources.invalid, { pricing: { occupancy: [{ adults: 1, amountMinor: "01" }] } }, "order052-leading")).status).toBe(400);
    expect((await correct(sources.invalid, { pricing: { occupancy: [{ adults: 1, amountMinor: "1" }, { adults: 1, amountMinor: "2" }] } }, "order052-duplicate")).status).toBe(400);
    expect((await correct(sources.invalid, { pricing: { occupancy: [{ adults: 1, amountMinor: "1" }],
      extraChildren: [{ maxAge: 12, amountMinor: "1" }, { maxAge: 5, amountMinor: "1" }] } }, "order052-bands")).status).toBe(400);
    const noScope = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["rates.pricing:read"] });
    expect((await correct(sources.invalid, pricingBody(), "order052-no-scope", noScope)).status).toBe(403);
    expect((await correct(sources.invalid, pricingBody(), "order052-foreign-property", accessToken, FOREIGN_PROPERTY)).status).toBe(403);
    const foreignTenant = await tokens.issue({ userId, tenantId: FOREIGN_PROPERTY, scopes: ["rates.pricing:write"] });
    expect((await correct(sources.invalid, pricingBody(), "order052-foreign-tenant", foreignTenant)).status).toBe(403);
    expect((await correct(sources.p1, pricingBody("999"), "order052-repeat")).status).toBe(409);
    const after = await admin<Array<{ prices: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM rate_price WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS prices,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
    `;
    expect(after).toEqual(before);
  });

  test("P5: publisher failure rolls correction and claim back before retry", async () => {
    const before = await admin<Array<{ prices: number; facts: number; events: number; claims: number; linked: boolean }>>`
      SELECT (SELECT count(*)::int FROM rate_price WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS prices,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims,
        superseded_by IS NOT NULL AS linked FROM rate_price WHERE id = ${sources.failure.id}::uuid
    `;
    const failingPricing = new RatePricingService({ async publish(): Promise<never> { throw new Error("correction publisher secret"); },
      async consumeBatch(): Promise<never> { throw new Error("not used"); } });
    const failing = createApp({ database, tenantResolver: new BearerTenantResolver(tokens),
      operatorApi: new OperatorHttpApi(new LocalLoginService(loginPool, tokens), new AvailabilityService(),
        undefined, new PostgresIdempotency(), undefined, undefined, failingPricing) });
    const failed = await correct(sources.failure, pricingBody("800"), "order052-rollback", accessToken, SEED_PROPERTY.id, failing);
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("secret");
    const afterFailure = await admin<Array<{ prices: number; facts: number; events: number; claims: number; linked: boolean }>>`
      SELECT (SELECT count(*)::int FROM rate_price WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS prices,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims,
        superseded_by IS NOT NULL AS linked FROM rate_price WHERE id = ${sources.failure.id}::uuid
    `;
    expect(afterFailure).toEqual(before);
    expect((await correct(sources.failure, pricingBody("800"), "order052-rollback")).status).toBe(201);
  });

  test("P6: current lookup follows the corrected successor", async () => {
    const response = await request(currentPath("2050-01-01"), { headers: headers() });
    expect(response.status).toBe(200);
    const body = await response.json() as { ratePrice: { id: string; pricing: { occupancy: Record<string, string> } } };
    expect(body.ratePrice.id).toBe(p1SuccessorId);
    expect(body.ratePrice.pricing.occupancy["1"]).toBe("9007199254740993");
  });

  test("P7/P8: dynamic correction editor is typed, complete and skin-shared", async () => {
    const html = await (await request("/")).text();
    const css = await (await request("/assets/operator.css")).text();
    const js = await (await request("/assets/operator.js")).text();
    expect(html).toContain('id="rate-correction-form"');
    expect(html).toContain('id="correction-tier-list"');
    expect(html).toContain('id="add-correction-tier"');
    expect(html).toContain('id="correction-child-list"');
    expect(html).toContain('id="add-correction-child"');
    expect(html).toContain("creates new history");
    expect(css).toContain(':root[data-theme="pixel"]');
    expect(js).toContain("loadPriceCorrection");
    expect(js).not.toMatch(/parseFloat|Number\([^)]*(?:amount|price)/i);
    expect(js).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    expect(js).not.toMatch(BROWSER_SQL_SYNTAX);
    expect(js).not.toMatch(/postgres(?:ql)?:\/\//i);
  });
});
