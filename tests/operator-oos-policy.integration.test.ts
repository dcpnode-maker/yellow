import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService, InventoryPolicyService } from "../src/contexts/inventory";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, PostgresEventBus, PostgresIdempotency, type EventBus,
  type PublishEventInput, type Tx } from "../src/kernel";
import { runReviewSeed, REVIEW_EMAIL } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_OPERATOR_POLICY_URL;
const PASSWORD = process.env.YELLOW_OPERATOR_POLICY_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_POLICY === "1";
const SECRET = "yellow-order-054-test-token-secret-exactly-long-enough";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000005491";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_OPERATOR_POLICY_URL and YELLOW_OPERATOR_POLICY_PASSWORD are required by Order 054");
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let database: Database;
let tokens: Hs256TokenSigner;
let events: PostgresEventBus;
let app: ReturnType<typeof createApp>;
let accessToken = "";
let userId = "";

function headers(token = accessToken, key?: string): Record<string, string> {
  return { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(key ? { "idempotency-key": key } : {}) };
}

function policyPath(property: string = SEED_PROPERTY.id): string {
  return `/api/v1/properties/${property}/inventory-policy`;
}

function request(target: ReturnType<typeof createApp>, path: string, init: RequestInit = {}): Promise<Response> {
  return target.handle(new Request(`http://yellow.test${path}`, init));
}

function setPolicy(value: unknown, key?: string, token = accessToken, target = app,
  property: string = SEED_PROPERTY.id, body: unknown = { oosSellability: value }): Promise<Response> {
  return request(target, `${policyPath(property)}/oos-sellability`, {
    method: "POST", headers: headers(token, key), body: JSON.stringify(body),
  });
}

class FailingEventBus implements EventBus {
  async publish(_tx: Tx, _event: PublishEventInput): Promise<never> { throw new Error("Order 054 injected publisher failure"); }
  async consumeBatch(): Promise<never> { throw new Error("not used"); }
}

function makeApp(policy: InventoryPolicyService): ReturnType<typeof createApp> {
  return createApp({ database, tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(new LocalLoginService(loginPool, tokens), new AvailabilityService(),
      undefined, new PostgresIdempotency(), undefined, undefined, undefined, undefined, policy) });
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  const review = await runReviewSeed({ databaseUrl: DATABASE_URL, password: PASSWORD, logger: () => undefined });
  userId = review.userId;
  admin = new SQL(DATABASE_URL, { max: 8 });
  loginPool = new SQL(DATABASE_URL, { max: 5 });
  eventPool = new SQL(DATABASE_URL, { max: 8 });
  database = Database.connect(DATABASE_URL, { maxConnections: 20 });
  tokens = new Hs256TokenSigner(SECRET);
  events = new PostgresEventBus(eventPool);
  app = makeApp(new InventoryPolicyService(events));
  const login = await request(app, "/api/v1/auth/local:login", { method: "POST", headers: headers(""),
    body: JSON.stringify({ tenant: SEED_TENANT.slug, email: REVIEW_EMAIL, password: PASSWORD }) });
  expect(login.status).toBe(200);
  accessToken = (await login.json() as { accessToken: string }).accessToken;
});

afterAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await database.close(); await eventPool.close(); await loginPool.close(); await admin.close();
});

databaseDescribe("Order 054 operator OOS sellability policy", () => {
  test("P1: absent policy reads blocked without evidence", async () => {
    const before = await admin<Array<{ facts: number; events: number }>>`
      SELECT (SELECT count(*)::int FROM fact_log WHERE entity_id=${SEED_PROPERTY.id}::uuid
        AND fact_type='inventory.policy.changed') AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${SEED_PROPERTY.id}::uuid
          AND event_type='inventory.policy.changed') AS events
    `;
    const response = await request(app, policyPath(), { headers: headers() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ inventoryPolicy: { propertyNode: SEED_PROPERTY.id, oosSellability: "blocked" } });
    const after = await admin<Array<{ facts: number; events: number }>>`
      SELECT (SELECT count(*)::int FROM fact_log WHERE entity_id=${SEED_PROPERTY.id}::uuid
        AND fact_type='inventory.policy.changed') AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${SEED_PROPERTY.id}::uuid
          AND event_type='inventory.policy.changed') AS events
    `;
    expect(after[0]).toEqual(before[0]);
  });

  test("P2: allowed preserves unrelated config and writes exact replayable evidence", async () => {
    await admin`UPDATE org_node SET config='{"keep":"9007199254740993","inventory":{"other":{"n":9007199254740993}}}'::jsonb
      WHERE id=${SEED_PROPERTY.id}::uuid`;
    const first = await setPolicy("allowed", "order054-allowed");
    expect(first.status).toBe(200);
    const firstText = await first.text();
    expect(JSON.parse(firstText)).toEqual({ inventoryPolicy: { propertyNode: SEED_PROPERTY.id, oosSellability: "allowed" } });
    const replay = await setPolicy("allowed", "order054-allowed");
    expect(replay.status).toBe(200); expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.text()).toBe(firstText);
    const rows = await admin<Array<{ keep: string; nested: string; value: string; facts: number; events: number }>>`
      SELECT config->>'keep' AS keep, config#>>'{inventory,other,n}' AS nested,
        config#>>'{inventory,oos_sellability}' AS value,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${SEED_PROPERTY.id}::uuid
          AND fact_type='inventory.policy.changed') AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${SEED_PROPERTY.id}::uuid
          AND event_type='inventory.policy.changed') AS events
      FROM org_node WHERE id=${SEED_PROPERTY.id}::uuid
    `;
    expect(rows[0]).toEqual({ keep: "9007199254740993", nested: "9007199254740993", value: "allowed", facts: 1, events: 1 });
  });

  test("P3: effective no-op has no evidence, changed reuse conflicts, reverse transition is exact", async () => {
    const noOp = await setPolicy("allowed", "order054-noop");
    expect(noOp.status).toBe(200);
    expect((await setPolicy("blocked", "order054-noop")).status).toBe(409);
    const reverse = await setPolicy("blocked", "order054-blocked");
    expect(reverse.status).toBe(200);
    const rows = await admin<Array<{ value: string; facts: number; events: number; exact: number }>>`
      SELECT config#>>'{inventory,oos_sellability}' AS value,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${SEED_PROPERTY.id}::uuid
          AND fact_type='inventory.policy.changed') AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${SEED_PROPERTY.id}::uuid
          AND event_type='inventory.policy.changed') AS events,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${SEED_PROPERTY.id}::uuid
          AND payload @> ${JSON.stringify({ policy: "oos_sellability", previous: "allowed", value: "blocked" })}::text::jsonb) AS exact
      FROM org_node WHERE id=${SEED_PROPERTY.id}::uuid
    `;
    expect(rows[0]).toEqual({ value: "blocked", facts: 2, events: 2, exact: 1 });
  });

  test("P4: malformed and unauthorized calls persist no policy evidence or claim", async () => {
    const before = await admin<Array<{ config: string; facts: number; events: number; claims: number }>>`
      SELECT config::text AS config,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${SEED_PROPERTY.id}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${SEED_PROPERTY.id}::uuid) AS events,
        (SELECT count(*)::int FROM api_idempotency) AS claims FROM org_node WHERE id=${SEED_PROPERTY.id}::uuid
    `;
    const noScope = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["inventory.policy:read"] });
    expect((await setPolicy("allowed", "order054-no-scope", noScope)).status).toBe(403);
    expect((await setPolicy("invented", "order054-invalid")).status).toBe(400);
    expect((await setPolicy("allowed", "order054-unknown", accessToken, app, SEED_PROPERTY.id,
      { oosSellability: "allowed", extra: true })).status).toBe(400);
    expect((await setPolicy("allowed", undefined)).status).toBe(400);
    expect((await setPolicy("allowed", "order054-foreign", accessToken, app, FOREIGN_PROPERTY)).status).toBe(403);
    const after = await admin<Array<{ config: string; facts: number; events: number; claims: number }>>`
      SELECT config::text AS config,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${SEED_PROPERTY.id}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${SEED_PROPERTY.id}::uuid) AS events,
        (SELECT count(*)::int FROM api_idempotency) AS claims FROM org_node WHERE id=${SEED_PROPERTY.id}::uuid
    `;
    expect(after[0]).toEqual(before[0]);
  });

  test("P5: publisher failure rolls config, fact, event and claim back before retry", async () => {
    const failing = makeApp(new InventoryPolicyService(new FailingEventBus()));
    const failedKeyHash = new Bun.CryptoHasher("sha256").update("order054-failure").digest("hex");
    expect((await setPolicy("allowed", "order054-failure", accessToken, failing)).status).toBe(503);
    const rows = await admin<Array<{ value: string; facts: number; claims: number }>>`
      SELECT config#>>'{inventory,oos_sellability}' AS value,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${SEED_PROPERTY.id}::uuid
          AND payload @> ${JSON.stringify({ previous: "blocked", value: "allowed" })}::text::jsonb) AS facts,
        (SELECT count(*)::int FROM api_idempotency
          WHERE operation='operator.inventory.policy.oos_sellability' AND key_hash=${failedKeyHash}) AS claims
      FROM org_node WHERE id=${SEED_PROPERTY.id}::uuid
    `;
    expect(rows[0]).toEqual({ value: "blocked", facts: 1, claims: 0 });
    expect((await setPolicy("allowed", "order054-failure")).status).toBe(200);
  });

  test("P6-P8: typed policy UI and exact seventeen-scope role expose no alternate config path", async () => {
    const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
    const js = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
    expect(html).toContain('id="oos-policy-form"'); expect(html).toContain("Allowed with warning");
    expect(html).toContain("Out of order is always physical"); expect(js).toContain("loadInventoryPolicy");
    expect(js).not.toMatch(/localStorage|sessionStorage|indexedDB|org_node|oos_sellability|jsonb_set/i);
    const permissions = await admin<Array<{ code: string }>>`
      SELECT permission.code FROM permission
      JOIN role_permission ON role_permission.permission_code=permission.code
      JOIN role ON role.id=role_permission.role_id WHERE role.tenant_id=${SEED_TENANT.id}::uuid
        AND role.name='Local Availability Reviewer' ORDER BY permission.code
    `;
    expect(permissions.map(({ code }) => code)).toEqual([
      "inventory.availability:read", "inventory.blocks:read", "inventory.blocks:write",
      "inventory.configuration:read", "inventory.configuration:write", "inventory.holds:read",
      "inventory.holds:write", "inventory.offline_leases:read", "inventory.offline_leases:write",
      "inventory.policy:read",
      "inventory.policy:write", "inventory.restriction:read", "inventory.restriction:write",
      "rates.configuration:read", "rates.configuration:write", "rates.pricing:read", "rates.pricing:write",
    ]);
  });
});
