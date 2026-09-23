import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  RateNotFoundError,
  RatePricingService,
  RateValidationError,
  type RatePrice,
} from "../src/contexts/rates";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  type EventBus,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_RATE_PRICING_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RATE_PRICING === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const PROPERTY_A = "00000000-0000-0000-0000-000000000012";
const RATE_PLAN_A = "00000000-0000-0000-0000-000000000600";
const UNIT_TYPE_A = "00000000-0000-0000-0000-000000000300";
const UNIT_TYPE_A2 = "00000000-0000-0000-0000-000000000301";
const TENANT_B = "00000000-0000-0000-0000-000000003302";
const PROPERTY_B = "00000000-0000-0000-0000-000000003312";
const RATE_PLAN_B = "00000000-0000-0000-0000-000000003320";
const UNIT_TYPE_B = "00000000-0000-0000-0000-000000003330";
const ACTOR_A = "00000000-0000-0000-0000-000000003360";
const MAX_BIGINT = 9_223_372_036_854_775_807n;

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RATE_PRICING_URL is required by the Order 033 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL;
let eventPool: SQL;
let database: Database;
let service: RatePricingService;
let exactPrice: RatePrice | undefined;
const aggregateIds = new Set<string>();

function envelope(propertyNode = PROPERTY_A) {
  return createAuditEnvelope({
    actorId: ACTOR_A,
    tenantId: TENANT_A,
    propertyNode,
    requestId: crypto.randomUUID(),
    operation: "rate_price.created",
  });
}

function remember<T extends { id: string }>(value: T): T {
  aggregateIds.add(value.id);
  return value;
}

class FailingEventBus implements EventBus {
  async publish(_tx: Tx, _event: PublishEventInput): Promise<never> {
    throw new Error("injected publisher failure");
  }

  async consumeBatch(): Promise<never> {
    throw new Error("not used");
  }
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 6 });
  database = Database.connect(DATABASE_URL, { maxConnections: 8 });
  service = new RatePricingService(new PostgresEventBus(eventPool));

  await admin`DELETE FROM rate_price WHERE recorded_at >= now() - interval '1 day' AND tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid) AND lower(stay_dates) >= '2035-01-01'::date`;
  await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR_A}::uuid`;
  await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid`;
  await admin`DELETE FROM rate_plan WHERE id = ${RATE_PLAN_B}::uuid`;
  await admin`DELETE FROM unit_type WHERE id = ${UNIT_TYPE_B}::uuid`;
  await admin`DELETE FROM org_node WHERE id = ${PROPERTY_B}::uuid`;
  await admin`DELETE FROM tenant WHERE id = ${TENANT_B}::uuid`;
  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${TENANT_B}::uuid, 'order033-b', 'Order 033 Tenant B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order033_property_b', 'property', 'Order 033 Property B', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, base_occupancy, max_occupancy)
    VALUES (${UNIT_TYPE_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O33-B', 'Order 033 B', 'hotel', 1, 2)
  `;
  await admin`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency)
    VALUES (${RATE_PLAN_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O33-B', 'Order 033 B', 'USD')
  `;
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  const ids = [...aggregateIds];
  if (ids.length > 0) {
    await admin`DELETE FROM outbox WHERE aggregate_id IN ${admin(ids)}`;
    await admin`DELETE FROM fact_log WHERE entity_id IN ${admin(ids)}`;
    await admin`DELETE FROM rate_price WHERE id IN ${admin(ids)}`;
  }
  await admin`DELETE FROM rate_price WHERE tenant_id = ${TENANT_B}::uuid`;
  await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR_A}::uuid`;
  await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid`;
  await admin`DELETE FROM rate_plan WHERE id = ${RATE_PLAN_B}::uuid`;
  await admin`DELETE FROM unit_type WHERE id = ${UNIT_TYPE_B}::uuid`;
  await admin`DELETE FROM org_node WHERE id = ${PROPERTY_B}::uuid`;
  await admin`DELETE FROM tenant WHERE id = ${TENANT_B}::uuid`;
  await admin.close();
  await eventPool.close();
  await database.close();
});

databaseDescribe("Order 033 exact bigint rate prices", () => {
  test("P1: unsafe-number-range and signed-bigint-max amounts round-trip exactly", async () => {
    exactPrice = remember(await database.withTenantTransaction(TENANT_A, (tx) => service.create(tx, {
      ratePlanId: RATE_PLAN_A,
      unitTypeId: UNIT_TYPE_A,
      stayStart: "2035-01-01",
      stayEnd: "2035-02-01",
      pricing: {
        occupancy: { "1": 9_007_199_254_740_993n, "2": MAX_BIGINT },
        extraAdultMinor: 9_007_199_254_740_995n,
        extraChildren: [
          { maxAge: 5, amountMinor: 0n },
          { maxAge: 17, amountMinor: 9_007_199_254_740_997n },
        ],
      },
      envelope: envelope(),
    })));
    expect(exactPrice.pricing).toEqual({
      occupancy: { "1": 9_007_199_254_740_993n, "2": MAX_BIGINT },
      extraAdultMinor: 9_007_199_254_740_995n,
      extraChildren: [
        { maxAge: 5, amountMinor: 0n },
        { maxAge: 17, amountMinor: 9_007_199_254_740_997n },
      ],
    });
    const reread = await database.withTenantTransaction(TENANT_A, (tx) => service.get(tx, PROPERTY_A, exactPrice!.id));
    expect(reread.pricing).toEqual(exactPrice.pricing);
    const storage = await admin<Array<{ occ_types: string[]; adult_type: string; child_types: string[] }>>`
      SELECT
        ARRAY(SELECT jsonb_typeof(value) FROM jsonb_each(pricing->'occ') ORDER BY key::int) AS occ_types,
        jsonb_typeof(pricing->'extra_adult') AS adult_type,
        ARRAY(SELECT jsonb_typeof(value->'amount') FROM jsonb_array_elements(pricing->'extra_child')) AS child_types
      FROM rate_price WHERE id = ${exactPrice.id}::uuid
    `;
    expect(storage[0]).toEqual({ occ_types: ["number", "number"], adult_type: "number", child_types: ["number", "number"] });
  });

  test("P2: tenant, property, plan, and unit ownership are explicit", async () => {
    for (const candidate of [
      { ratePlanId: RATE_PLAN_B, unitTypeId: UNIT_TYPE_A, propertyNode: PROPERTY_A },
      { ratePlanId: RATE_PLAN_A, unitTypeId: UNIT_TYPE_B, propertyNode: PROPERTY_A },
      { ratePlanId: RATE_PLAN_A, unitTypeId: UNIT_TYPE_A, propertyNode: PROPERTY_B },
      { ratePlanId: RATE_PLAN_A, unitTypeId: UNIT_TYPE_A2, propertyNode: PROPERTY_A },
    ]) {
      const shouldSucceed = candidate.unitTypeId === UNIT_TYPE_A2;
      const operation = database.withTenantTransaction(TENANT_A, (tx) => service.create(tx, {
        ratePlanId: candidate.ratePlanId,
        unitTypeId: candidate.unitTypeId,
        stayStart: "2035-03-01",
        stayEnd: "2035-03-02",
        pricing: { occupancy: { "1": 100n } },
        envelope: envelope(candidate.propertyNode),
      }));
      if (shouldSucceed) {
        remember(await operation);
      } else {
        await expect(operation).rejects.toBeInstanceOf(RateNotFoundError);
      }
    }
  });

  test("P3: invalid money, range, mask, tiers, and bands fail before insert", async () => {
    const invalid = [
      { stayStart: "2035-04-01", stayEnd: "2035-04-02", dowMask: 127, pricing: { occupancy: { "1": 1 as never } } },
      { stayStart: "2035-04-01", stayEnd: "2035-04-02", dowMask: 127, pricing: { occupancy: { "1": MAX_BIGINT + 1n } } },
      { stayStart: "2035-02-30", stayEnd: "2035-04-02", dowMask: 127, pricing: { occupancy: { "1": 1n } } },
      { stayStart: "2035-04-02", stayEnd: "2035-04-02", dowMask: 127, pricing: { occupancy: { "1": 1n } } },
      { stayStart: "2035-04-01", stayEnd: "2035-04-02", dowMask: 0, pricing: { occupancy: { "1": 1n } } },
      { stayStart: "2035-04-01", stayEnd: "2035-04-02", dowMask: 127, pricing: { occupancy: {} } },
      { stayStart: "2035-04-01", stayEnd: "2035-04-02", dowMask: 127, pricing: { occupancy: { "0": 1n } } },
      { stayStart: "2035-04-01", stayEnd: "2035-04-02", dowMask: 127, pricing: { occupancy: { "1": 1n }, extraChildren: [{ maxAge: 12, amountMinor: 1n }, { maxAge: 5, amountMinor: 1n }] } },
    ] as const;
    for (const candidate of invalid) {
      await expect(database.withTenantTransaction(TENANT_A, (tx) => service.create(tx, {
        ratePlanId: RATE_PLAN_A,
        unitTypeId: UNIT_TYPE_A,
        ...candidate,
        envelope: envelope(),
      }))).rejects.toBeInstanceOf(RateValidationError);
    }
    const rows = await admin<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM rate_price WHERE lower(stay_dates) = '2035-04-01'::date
    `;
    expect(rows[0]?.count).toBe(0);
  });

  test("P4: publisher failure rolls price and fact back", async () => {
    const failing = new RatePricingService(new FailingEventBus());
    await expect(database.withTenantTransaction(TENANT_A, (tx) => failing.create(tx, {
      ratePlanId: RATE_PLAN_A,
      unitTypeId: UNIT_TYPE_A,
      stayStart: "2035-05-01",
      stayEnd: "2035-05-02",
      pricing: { occupancy: { "1": 500n } },
      envelope: envelope(),
    }))).rejects.toThrow("injected publisher failure");
    const rows = await admin<Array<{ prices: number; facts: number }>>`
      SELECT
        (SELECT count(*)::int FROM rate_price WHERE lower(stay_dates) = '2035-05-01'::date) AS prices,
        (SELECT count(*)::int FROM fact_log WHERE payload @> '{"stay_start":"2035-05-01"}'::jsonb) AS facts
    `;
    expect(rows[0]).toEqual({ prices: 0, facts: 0 });
  });

  test("P5: PostgreSQL date/mask truth and latest precedence select exactly", async () => {
    const older = remember(await database.withTenantTransaction(TENANT_A, (tx) => service.create(tx, {
      ratePlanId: RATE_PLAN_A,
      unitTypeId: UNIT_TYPE_A,
      stayStart: "2036-01-01",
      stayEnd: "2036-01-10",
      dowMask: 1,
      pricing: { occupancy: { "1": 100n } },
      envelope: envelope(),
    })));
    await admin`SELECT pg_sleep(0.01)`;
    const newer = remember(await database.withTenantTransaction(TENANT_A, (tx) => service.create(tx, {
      ratePlanId: RATE_PLAN_A,
      unitTypeId: UNIT_TYPE_A,
      stayStart: "2036-01-01",
      stayEnd: "2036-01-10",
      dowMask: 1,
      pricing: { occupancy: { "1": 200n } },
      envelope: envelope(),
    })));
    const tuesday = remember(await database.withTenantTransaction(TENANT_A, (tx) => service.create(tx, {
      ratePlanId: RATE_PLAN_A,
      unitTypeId: UNIT_TYPE_A,
      stayStart: "2036-01-01",
      stayEnd: "2036-01-10",
      dowMask: 2,
      pricing: { occupancy: { "1": 300n } },
      envelope: envelope(),
    })));
    const mondayResult = await database.withTenantTransaction(TENANT_A, (tx) => service.findCurrent(tx, {
      propertyNode: PROPERTY_A, ratePlanId: RATE_PLAN_A, unitTypeId: UNIT_TYPE_A, stayDate: "2036-01-07",
    }));
    const tuesdayResult = await database.withTenantTransaction(TENANT_A, (tx) => service.findCurrent(tx, {
      propertyNode: PROPERTY_A, ratePlanId: RATE_PLAN_A, unitTypeId: UNIT_TYPE_A, stayDate: "2036-01-08",
    }));
    expect(mondayResult.id).toBe(newer.id);
    expect(mondayResult.id).not.toBe(older.id);
    expect(tuesdayResult.id).toBe(tuesday.id);
    await expect(database.withTenantTransaction(TENANT_A, (tx) => service.findCurrent(tx, {
      propertyNode: PROPERTY_A, ratePlanId: RATE_PLAN_A, unitTypeId: UNIT_TYPE_A, stayDate: "2036-01-06",
    }))).rejects.toBeInstanceOf(RateNotFoundError);
  });

  test("P6: tenant reads and event payloads expose neither foreign rows nor money", async () => {
    if (!exactPrice) throw new Error("P1 exact-price fixture is absent");
    await expect(database.withTenantTransaction(TENANT_B, (tx) => service.get(tx, PROPERTY_A, exactPrice!.id)))
      .rejects.toBeInstanceOf(RateNotFoundError);
    const rows = await admin<Array<{ event_type: string; has_pricing: boolean; payload_text: string }>>`
      SELECT event_type, payload ? 'pricing' AS has_pricing, payload::text AS payload_text
      FROM outbox WHERE aggregate_id = ${exactPrice.id}::uuid
    `;
    expect(rows[0]?.event_type).toBe("rate_price.created");
    expect(rows[0]?.has_pricing).toBeFalse();
    expect(rows[0]?.payload_text).not.toContain("9007199254740993");
  });

  test("P7: the create-only slice leaves every test row unsuperseded", async () => {
    const ids = [...aggregateIds];
    const rows = await admin<Array<{ total: number; current: number }>>`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE superseded_by IS NULL)::int AS current
      FROM rate_price WHERE id IN ${admin(ids)}
    `;
    expect(rows[0]).toEqual({ total: ids.length, current: ids.length });
    const canonical = await admin<Array<{ id: string; superseded_by: string | null }>>`
      SELECT id, superseded_by FROM rate_price
      WHERE id IN ('00000000-0000-0000-0000-000000000700'::uuid, '00000000-0000-0000-0000-000000000701'::uuid)
      ORDER BY id
    `;
    expect(canonical).toEqual([
      { id: "00000000-0000-0000-0000-000000000700", superseded_by: null },
      { id: "00000000-0000-0000-0000-000000000701", superseded_by: null },
    ]);
  });
});
