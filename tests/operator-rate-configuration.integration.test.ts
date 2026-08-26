import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import { RateConfigurationService } from "../src/contexts/rates";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, PostgresEventBus, PostgresIdempotency } from "../src/kernel";
import { runReviewSeed, REVIEW_EMAIL } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";
import { BROWSER_SQL_SYNTAX } from "./helpers/browser-asset-security";

const DATABASE_URL = process.env.YELLOW_OPERATOR_RATE_URL;
const PASSWORD = process.env.YELLOW_OPERATOR_RATE_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_RATE === "1";
const SECRET = "yellow-order-050-test-token-secret-exactly-long-enough";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000005091";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_OPERATOR_RATE_URL and YELLOW_OPERATOR_RATE_PASSWORD are required by Order 050");
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
let createdPolicies: Record<string, Record<string, unknown>> = {};
let createdPlan: Record<string, unknown>;

const policyBodies = Object.freeze({
  cancellation: {
    kind: "cancellation", name: "Flexible 48 hour cancellation",
    content: { kind: "cancellation", rules: [
      { before_hours: 48, penalty: { basis: "percent", value: 25 } },
      { before_hours: 0, penalty: { basis: "nights", value: 1 } },
    ] },
  },
  deposit: {
    kind: "deposit", name: "Thirty percent deposit",
    content: { kind: "deposit", deposit: { basis: "percent", value: 30, due: "days_before_arrival", days_before: 7 } },
  },
  guarantee: {
    kind: "guarantee", name: "Card guarantee",
    content: { kind: "guarantee", guarantee: "card_on_file" },
  },
  no_show: {
    kind: "no_show", name: "First night no show",
    content: { kind: "no_show", no_show_charge: { basis: "first_night", value: 1 } },
  },
});

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

function ratePath(suffix = "", property: string = SEED_PROPERTY.id): string {
  return `/api/v1/properties/${property}/rate-configuration${suffix}`;
}

async function postPolicy(body: unknown, key?: string, token = accessToken, property: string = SEED_PROPERTY.id): Promise<Response> {
  return request(ratePath("/policies", property), {
    method: "POST", headers: headers(token, key), body: JSON.stringify(body),
  });
}

async function postPlan(body: unknown, key?: string, token = accessToken, property: string = SEED_PROPERTY.id): Promise<Response> {
  return request(ratePath("/rate-plans", property), {
    method: "POST", headers: headers(token, key), body: JSON.stringify(body),
  });
}

function canonicalPlanBody(): Record<string, unknown> {
  return {
    code: "FLEX", name: "Flexible rate", currency: "USD", taxInclusive: false,
    cancellationPolicyId: String(createdPolicies.cancellation?.id),
    guaranteePolicyId: String(createdPolicies.guarantee?.id),
    depositPolicyId: String(createdPolicies.deposit?.id),
    marketCode: "LEISURE", sourceCode: "DIRECT",
  };
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  const review = await runReviewSeed({
    databaseUrl: DATABASE_URL,
    password: PASSWORD,
    mode: "identity_inventory",
    logger: () => undefined,
  });
  userId = review.userId;
  admin = new SQL(DATABASE_URL, { max: 4 });
  loginPool = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 4 });
  database = Database.connect(DATABASE_URL, { maxConnections: 12 });
  tokens = new Hs256TokenSigner(SECRET);
  const rates = new RateConfigurationService(new PostgresEventBus(eventPool));
  app = createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      new LocalLoginService(loginPool, tokens), new AvailabilityService(), undefined,
      new PostgresIdempotency(), undefined, rates,
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

databaseDescribe("Order 050 operator rate-plan management", () => {
  test("P1: authorized rate snapshot is deterministic and property-scoped", async () => {
    const response = await request(ratePath(), { headers: headers() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ policies: [], ratePlans: [] });
    const fixtureRows = await admin<Array<{
      policies: number;
      rate_plans: number;
      model_versions: number;
      target_versions: number;
      release_versions: number;
      approvals: number;
    }>>`
      SELECT
        (SELECT count(*)::int FROM policy) AS policies,
        (SELECT count(*)::int FROM rate_plan) AS rate_plans,
        (SELECT count(*)::int FROM extension WHERE type = 'yellow.rate.model') AS model_versions,
        (SELECT count(*)::int FROM extension WHERE type = 'yellow.rate.target') AS target_versions,
        (SELECT count(*)::int FROM extension WHERE type = 'yellow.rate.release') AS release_versions,
        (SELECT count(*)::int FROM approval_request) AS approvals
    `;
    expect(fixtureRows).toEqual([{
      policies: 0,
      rate_plans: 0,
      model_versions: 0,
      target_versions: 0,
      release_versions: 0,
      approvals: 0,
    }]);
    expect((await request(ratePath("", FOREIGN_PROPERTY), { headers: headers() })).status).toBe(403);
  });

  test("P2: all supported policies commit exact typed evidence through HTTP", async () => {
    for (const [kind, body] of Object.entries(policyBodies)) {
      const response = await postPolicy(body, `order050-policy-${kind}`);
      expect(response.status).toBe(201);
      expect(response.headers.get("idempotency-replayed")).toBe("false");
      const policy = (await response.json() as { policy: Record<string, unknown> }).policy;
      expect(policy).toMatchObject({ kind, name: body.name, content: body.content });
      createdPolicies[kind] = policy;
    }
    const ids = Object.values(createdPolicies).map(({ id }) => String(id));
    const evidence = await admin<Array<{ policies: number; object_content: number; facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM policy WHERE id IN ${admin(ids)}) AS policies,
        (SELECT count(*)::int FROM policy WHERE id IN ${admin(ids)} AND jsonb_typeof(content) = 'object') AS object_content,
        (SELECT count(*)::int FROM fact_log WHERE entity_id IN ${admin(ids)}) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id IN ${admin(ids)} AND event_type = 'policy.created') AS events
    `;
    expect(evidence).toEqual([{ policies: 4, object_content: 4, facts: 4, events: 4 }]);
  });

  test("P3: base plan composes exact policy kinds without derivation or prices", async () => {
    const response = await postPlan(canonicalPlanBody(), "order050-plan-flex");
    expect(response.status).toBe(201);
    createdPlan = (await response.json() as { ratePlan: Record<string, unknown> }).ratePlan;
    expect(createdPlan).toMatchObject({
      code: "FLEX", name: "Flexible rate", currency: "USD", taxInclusive: false,
      parentPlanId: null, derivation: null, marketCode: "LEISURE", sourceCode: "DIRECT",
    });
    const evidence = await admin<Array<{ facts: number; events: number; prices: number }>>`
      SELECT
        (SELECT count(*)::int FROM fact_log WHERE entity_id = ${String(createdPlan.id)}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id = ${String(createdPlan.id)}::uuid AND event_type = 'rate_plan.created') AS events,
        (SELECT count(*)::int FROM rate_price WHERE rate_plan_id = ${String(createdPlan.id)}::uuid) AS prices
    `;
    expect(evidence).toEqual([{ facts: 1, events: 1, prices: 0 }]);
    const snapshot = await request(ratePath(), { headers: headers() });
    expect((await snapshot.json() as { ratePlans: unknown[] }).ratePlans).toEqual([createdPlan]);
  });

  test("P4: exact replay is stable and changed-request key reuse conflicts", async () => {
    const replay = await postPlan(canonicalPlanBody(), "order050-plan-flex");
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.json()).toEqual({ ratePlan: createdPlan });
    const changed = { ...canonicalPlanBody(), name: "Changed flexible rate" };
    expect((await postPlan(changed, "order050-plan-flex")).status).toBe(409);
    expect(await admin`SELECT id FROM rate_plan WHERE property_node = ${SEED_PROPERTY.id}::uuid`).toHaveLength(1);
  });

  test("P5: invalid and unauthorized writes leave domain and claims unchanged", async () => {
    const before = await admin<Array<{ policies: number; plans: number; claims: number }>>`
      SELECT
        (SELECT count(*)::int FROM policy WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS policies,
        (SELECT count(*)::int FROM rate_plan WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS plans,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
    `;
    expect((await postPolicy(policyBodies.guarantee)).status).toBe(400);
    expect((await postPolicy({ ...policyBodies.guarantee, extra: true }, "order050-extra-key")).status).toBe(400);
    expect((await postPolicy({ kind: "guarantee", name: "Mismatch", content: { kind: "deposit" } }, "order050-mismatch-key")).status).toBe(400);
    expect((await postPlan({ ...canonicalPlanBody(), code: "bad-code" }, "order050-bad-plan-key")).status).toBe(400);
    expect((await postPlan({
      ...canonicalPlanBody(), code: "WRONGKIND", cancellationPolicyId: String(createdPolicies.guarantee?.id),
    }, "order050-wrong-kind-key")).status).toBe(404);
    const noScope = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["inventory.availability:read"] });
    expect((await postPolicy(policyBodies.no_show, "order050-no-scope-key", noScope)).status).toBe(403);
    expect((await postPlan({ ...canonicalPlanBody(), code: "FOREIGNPROP" }, "order050-foreign-property-key", accessToken, FOREIGN_PROPERTY)).status).toBe(403);
    const foreignTenant = await tokens.issue({
      userId, tenantId: "00000000-0000-0000-0000-000000005092", scopes: ["rates.configuration:write"],
    });
    expect((await postPolicy(policyBodies.no_show, "order050-foreign-tenant-key", foreignTenant)).status).toBe(403);
    const after = await admin<Array<{ policies: number; plans: number; claims: number }>>`
      SELECT
        (SELECT count(*)::int FROM policy WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS policies,
        (SELECT count(*)::int FROM rate_plan WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS plans,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
    `;
    expect(after).toEqual(before);
  });

  test("P6: publisher failure rolls every artifact and claim back before retry", async () => {
    const before = await admin<Array<{ plans: number; facts: number; events: number; claims: number }>>`
      SELECT
        (SELECT count(*)::int FROM rate_plan WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS plans,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
    `;
    const failingRates = new RateConfigurationService({
      async publish(): Promise<never> { throw new Error("rate publisher secret"); },
      async consumeBatch(): Promise<never> { throw new Error("not used"); },
    });
    const failing = createApp({
      database,
      tenantResolver: new BearerTenantResolver(tokens),
      operatorApi: new OperatorHttpApi(
        new LocalLoginService(loginPool, tokens), new AvailabilityService(), undefined,
        new PostgresIdempotency(), undefined, failingRates,
      ),
    });
    const body = { code: "FAILSAFE", name: "Failure-safe rate", currency: "USD" };
    const failed = await failing.handle(new Request(`http://yellow.test${ratePath("/rate-plans")}`, {
      method: "POST", headers: headers(accessToken, "order050-rollback-key"), body: JSON.stringify(body),
    }));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("secret");
    const afterFailure = await admin<Array<{ plans: number; facts: number; events: number; claims: number }>>`
      SELECT
        (SELECT count(*)::int FROM rate_plan WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS plans,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS claims
    `;
    expect(afterFailure).toEqual(before);
    const retry = await postPlan(body, "order050-rollback-key");
    expect(retry.status).toBe(201);
    expect(retry.headers.get("idempotency-replayed")).toBe("false");
  });

  test("P7/P8: one progressive themed Rates UI and exact twenty-eight-scope login", async () => {
    const html = await (await request("/")).text();
    const css = await (await request("/assets/operator.css")).text();
    const js = await (await request("/assets/operator.js")).text();
    expect(html).toContain('id="rates-view"');
    expect(html).toContain('id="policy-form"');
    expect(html).toContain('id="rate-plan-form"');
    expect(html).toContain("Prices and derived plans are separate steps");
    expect(css).toContain(':root[data-theme="android"]');
    expect(js).toContain('"rates"');
    expect(js).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    expect(js).not.toMatch(BROWSER_SQL_SYNTAX);
    expect(js).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect((await tokens.verify(accessToken))?.scp).toBe(
      "crm.parties:read crm.parties:write financials.charges:write financials.folios:open financials.folios:read inventory.availability:read inventory.blocks:read inventory.blocks:write inventory.configuration:read inventory.configuration:write inventory.holds:read inventory.holds:write inventory.offline_leases:read inventory.offline_leases:write inventory.policy:read inventory.policy:write inventory.restriction:read inventory.restriction:write rates.configuration:read rates.configuration:write rates.pricing:read rates.pricing:write reservations.booking:write reservations.guests:read reservations.guests:write reservations.lifecycle:read reservations.lifecycle:write reservations.segments:read reservations.segments:write",
    );
  });
});
