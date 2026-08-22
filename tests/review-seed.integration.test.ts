import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService, verifyLocalPassword } from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import { OperatorHttpApi } from "../src/http/operator";
import { Database } from "../src/kernel";
import { runReviewSeed, REVIEW_EMAIL } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_REVIEW_SEED_URL;
const PASSWORD = process.env.YELLOW_REVIEW_SEED_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_REVIEW_SEED === "1";
const SECRET = "yellow-order-046-test-token-secret-exactly-long-enough";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_REVIEW_SEED_URL and YELLOW_REVIEW_SEED_PASSWORD are required by the Order 046 proof");
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let database: Database;
let first: Awaited<ReturnType<typeof runReviewSeed>>;

async function counts() {
  const rows = await admin<Array<{
    users: number; roles: number; grants: number; unit_types: number;
    spaces: number; sellables: number; facts: number; events: number;
  }>>`
    SELECT
      (SELECT count(*)::int FROM app_user WHERE id = ${first.userId}::uuid) AS users,
      (SELECT count(*)::int FROM role WHERE id = ${first.roleId}::uuid) AS roles,
      (SELECT count(*)::int FROM user_role WHERE user_id = ${first.userId}::uuid) AS grants,
      (SELECT count(*)::int FROM unit_type WHERE tenant_id = ${SEED_TENANT.id}::uuid AND attrs @> '{"source":"local-review"}') AS unit_types,
      (SELECT count(*)::int FROM space WHERE tenant_id = ${SEED_TENANT.id}::uuid AND attrs @> '{"source":"local-review"}') AS spaces,
      (SELECT count(*)::int FROM sellable_unit AS su JOIN unit_type AS ut ON ut.id = su.unit_type_id
        WHERE su.tenant_id = ${SEED_TENANT.id}::uuid AND ut.attrs @> '{"source":"local-review"}') AS sellables,
      (SELECT count(*)::int FROM fact_log WHERE actor_id = ${first.userId}::uuid) AS facts,
      (SELECT count(*)::int FROM outbox WHERE actor_id = ${first.userId}::uuid) AS events
  `;
  const row = rows[0];
  if (!row) throw new Error("Order 046 count probe returned no row");
  return row;
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  first = await runReviewSeed({ databaseUrl: DATABASE_URL, password: PASSWORD, logger: () => undefined });
  admin = new SQL(DATABASE_URL, { max: 4 });
  loginPool = new SQL(DATABASE_URL, { max: 4 });
  database = Database.connect(DATABASE_URL, { maxConnections: 8 });
});

afterAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await database.close();
  await loginPool.close();
  await admin.close();
});

databaseDescribe("Order 046 reproducible local-review seed", () => {
  test("P1: provisions the exact local identity and five-room inventory", async () => {
    expect(first).toMatchObject({
      tenant: "yellow-demo",
      property: "Yellow Demo Property",
      email: REVIEW_EMAIL,
      unitTypes: { created: 2, existing: 0 },
      rooms: { created: 5, existing: 0 },
      sellableUnits: { created: 5, existing: 0 },
    });
    expect(await counts()).toEqual({
      users: 1, roles: 1, grants: 1, unit_types: 2, spaces: 5,
      sellables: 5, facts: 12, events: 12,
    });
  });

  test("P2: every inventory aggregate carries one fact and one outbox event", async () => {
    const rows = await admin<Array<{ entity_type: string; aggregates: number; facts: number; events: number }>>`
      SELECT fact.entity_type,
             count(DISTINCT fact.entity_id)::int AS aggregates,
             count(DISTINCT fact.id)::int AS facts,
             count(DISTINCT event.id)::int AS events
      FROM fact_log AS fact
      JOIN outbox AS event
        ON event.aggregate_type = fact.entity_type
       AND event.aggregate_id = fact.entity_id
       AND event.correlation_id = (fact.payload ->> 'request_id')::uuid
      WHERE fact.actor_id = ${first.userId}::uuid
      GROUP BY fact.entity_type
      ORDER BY fact.entity_type
    `;
    expect(rows).toEqual([
      { entity_type: "sellable_unit", aggregates: 5, facts: 5, events: 5 },
      { entity_type: "space", aggregates: 5, facts: 5, events: 5 },
      { entity_type: "unit_type", aggregates: 2, facts: 2, events: 2 },
    ]);
  });

  test("P3: identical rerun is an exact no-op", async () => {
    const before = await counts();
    const second = await runReviewSeed({ databaseUrl: DATABASE_URL!, password: PASSWORD!, logger: () => undefined });
    expect(second).toMatchObject({
      unitTypes: { created: 0, existing: 2 },
      rooms: { created: 0, existing: 5 },
      sellableUnits: { created: 0, existing: 5 },
    });
    expect(await counts()).toEqual(before);
  });

  test("P4: same identity with a different password fails without mutation", async () => {
    const before = await counts();
    await expect(runReviewSeed({ databaseUrl: DATABASE_URL!, password: `${PASSWORD!}-collision`, logger: () => undefined }))
      .rejects.toThrow("Review user collides with non-canonical local-review data");
    expect(await counts()).toEqual(before);
    const users = await admin<Array<{ auth: unknown }>>`
      SELECT auth FROM app_user WHERE id = ${first.userId}::uuid
    `;
    expect(await verifyLocalPassword(PASSWORD!, users[0]?.auth)).toBe(true);
  });

  test("P5: login is least-scope and availability returns five real options", async () => {
    const tokens = new Hs256TokenSigner(SECRET);
    const app = createApp({
      database,
      tenantResolver: new BearerTenantResolver(tokens),
      operatorApi: new OperatorHttpApi(new LocalLoginService(loginPool, tokens), new AvailabilityService()),
    });
    const login = await app.handle(new Request("http://yellow.test/api/v1/auth/local:login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant: SEED_TENANT.slug, email: REVIEW_EMAIL, password: PASSWORD }),
    }));
    expect(login.status).toBe(200);
    const loginBody = await login.json() as { accessToken: string };
    expect(await tokens.verify(loginBody.accessToken)).toMatchObject({
      sub: first.userId,
      tid: SEED_TENANT.id,
      scp: "inventory.availability:read inventory.blocks:read inventory.blocks:write inventory.configuration:read inventory.configuration:write inventory.holds:read inventory.holds:write inventory.policy:read inventory.policy:write inventory.restriction:read inventory.restriction:write rates.configuration:read rates.configuration:write rates.pricing:read rates.pricing:write",
    });

    const headers = { "content-type": "application/json", authorization: `Bearer ${loginBody.accessToken}` };
    const properties = await app.handle(new Request("http://yellow.test/api/v1/me/properties", { headers }));
    expect(await properties.json()).toEqual({ properties: [{
      id: SEED_PROPERTY.id, name: SEED_PROPERTY.name,
      timezone: SEED_PROPERTY.timezone, currency: SEED_PROPERTY.currency,
    }] });

    const from = new Date(Date.now() + 30 * 86_400_000);
    from.setUTCHours(15, 0, 0, 0);
    const to = new Date(from.getTime() + 2 * 86_400_000);
    const availability = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${SEED_PROPERTY.id}/availability:search`, {
        method: "POST", headers,
        body: JSON.stringify({ from: from.toISOString(), to: to.toISOString(), partySize: 1 }),
      },
    ));
    expect(availability.status).toBe(200);
    const body = await availability.json() as { options: Array<{ sellableUnitName: string; bookable: boolean }> };
    expect(body.options.map(({ sellableUnitName }) => sellableUnitName)).toEqual([
      "Room 101", "Room 102", "Room 103", "Room 201", "Room 202",
    ]);
    expect(body.options.every(({ bookable }) => bookable)).toBe(true);
  });
});
