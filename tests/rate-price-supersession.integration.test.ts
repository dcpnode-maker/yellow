import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  RateConflictError,
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

const DATABASE_URL = process.env.YELLOW_RATE_SUPERSESSION_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RATE_SUPERSESSION === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const PROPERTY_A = "00000000-0000-0000-0000-000000000012";
const RATE_PLAN_A = "00000000-0000-0000-0000-000000000600";
const UNIT_TYPE_A = "00000000-0000-0000-0000-000000000300";
const TENANT_B = "00000000-0000-0000-0000-000000003402";
const PROPERTY_B = "00000000-0000-0000-0000-000000003412";
const ACTOR_A = "00000000-0000-0000-0000-000000003460";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RATE_SUPERSESSION_URL is required by the Order 034 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL;
let eventPool: SQL;
let database: Database;
let service: RatePricingService;
let p1Old: RatePrice | undefined;
let p1Successor: RatePrice | undefined;
const aggregateIds = new Set<string>();

function envelope(operation: "rate_price.created" | "rate_price.superseded", tenantId = TENANT_A, propertyNode = PROPERTY_A) {
  return createAuditEnvelope({
    actorId: ACTOR_A,
    tenantId,
    propertyNode,
    requestId: crypto.randomUUID(),
    operation,
  });
}

function remember<T extends { id: string }>(value: T): T {
  aggregateIds.add(value.id);
  return value;
}

async function createFixture(stayStart: string, stayEnd: string, amountMinor: bigint) {
  return remember(await database.withTenantTransaction(TENANT_A, (tx) => service.create(tx, {
    ratePlanId: RATE_PLAN_A,
    unitTypeId: UNIT_TYPE_A,
    stayStart,
    stayEnd,
    pricing: { occupancy: { "1": amountMinor } },
    envelope: envelope("rate_price.created"),
  })));
}

class FailingEventBus implements EventBus {
  async publish(_tx: Tx, event: PublishEventInput): Promise<never> {
    if (event.eventType === "rate_price.superseded") throw new Error("injected publisher failure");
    throw new Error("unexpected event");
  }

  async consumeBatch(): Promise<never> {
    throw new Error("not used");
  }
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 25 });
  database = Database.connect(DATABASE_URL, { maxConnections: 25 });
  service = new RatePricingService(new PostgresEventBus(eventPool));

  const stale = await admin<Array<{ entity_id: string }>>`
    SELECT DISTINCT entity_id FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid AND entity_type = 'rate_price'
  `;
  const staleIds = stale.map(({ entity_id }) => entity_id);
  if (staleIds.length > 0) {
    await admin`UPDATE rate_price SET superseded_by = NULL WHERE id IN ${admin(staleIds)} OR superseded_by IN ${admin(staleIds)}`;
    await admin`DELETE FROM outbox WHERE aggregate_id IN ${admin(staleIds)}`;
    await admin`DELETE FROM fact_log WHERE entity_id IN ${admin(staleIds)}`;
    await admin`DELETE FROM rate_price WHERE id IN ${admin(staleIds)}`;
  }
  await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR_A}::uuid`;
  await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid`;
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  const ids = [...aggregateIds];
  if (ids.length > 0) {
    await admin`UPDATE rate_price SET superseded_by = NULL WHERE id IN ${admin(ids)} OR superseded_by IN ${admin(ids)}`;
    await admin`DELETE FROM outbox WHERE aggregate_id IN ${admin(ids)}`;
    await admin`DELETE FROM fact_log WHERE entity_id IN ${admin(ids)}`;
    await admin`DELETE FROM rate_price WHERE id IN ${admin(ids)}`;
  }
  await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR_A}::uuid`;
  await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid`;
  await admin.close();
  await eventPool.close();
  await database.close();
});

databaseDescribe("Order 034 race-safe rate-price supersession", () => {
  test("P1: correction links one exact-key successor with two facts and one event", async () => {
    p1Old = await createFixture("2037-01-01", "2037-02-01", 9_007_199_254_740_993n);
    p1Successor = remember(await database.withTenantTransaction(TENANT_A, (tx) => service.supersede(tx, {
      ratePriceId: p1Old!.id,
      pricing: {
        occupancy: { "1": 9_007_199_254_740_999n, "2": 9_223_372_036_854_775_807n },
        extraAdultMinor: 9_007_199_254_741_001n,
      },
      envelope: envelope("rate_price.superseded"),
    })));
    expect(p1Successor).toMatchObject({
      ratePlanId: p1Old.ratePlanId,
      unitTypeId: p1Old.unitTypeId,
      stayStart: p1Old.stayStart,
      stayEnd: p1Old.stayEnd,
      dowMask: p1Old.dowMask,
      currency: p1Old.currency,
      supersededBy: null,
    });
    expect(p1Successor.pricing.occupancy).toEqual({ "1": 9_007_199_254_740_999n, "2": 9_223_372_036_854_775_807n });
    const chain = await admin<Array<{ id: string; superseded_by: string | null }>>`
      SELECT id, superseded_by FROM rate_price WHERE id IN (${p1Old.id}::uuid, ${p1Successor.id}::uuid) ORDER BY id
    `;
    expect(chain.find(({ id }) => id === p1Old!.id)?.superseded_by).toBe(p1Successor.id);
    expect(chain.find(({ id }) => id === p1Successor!.id)?.superseded_by).toBeNull();
    const evidence = await admin<Array<{ facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM fact_log WHERE fact_type = 'rate_price.superseded' AND entity_id IN (${p1Old.id}::uuid, ${p1Successor.id}::uuid)) AS facts,
        (SELECT count(*)::int FROM outbox WHERE event_type = 'rate_price.superseded' AND aggregate_id = ${p1Successor.id}::uuid) AS events
    `;
    expect(evidence[0]).toEqual({ facts: 2, events: 1 });
  });

  test("P2: twenty concurrent corrections produce exactly one successor and no fork", async () => {
    const source = await createFixture("2037-03-01", "2037-04-01", 100n);
    const attempts = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      database.withTenantTransaction(TENANT_A, (tx) => service.supersede(tx, {
        ratePriceId: source.id,
        pricing: { occupancy: { "1": BigInt(1_000 + index) } },
        envelope: envelope("rate_price.superseded"),
      })).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
    ));
    const winners = attempts.filter((attempt): attempt is { ok: true; value: RatePrice } => attempt.ok);
    const losers = attempts.filter((attempt): attempt is { ok: false; error: unknown } => !attempt.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(19);
    expect(losers.every(({ error }) => error instanceof RateConflictError)).toBeTrue();
    const winner = winners[0];
    if (!winner) throw new Error("Concurrent proof produced no winner");
    remember(winner.value);
    const evidence = await admin<Array<{ linked_to: string | null; successors: number; facts: number; events: number }>>`
      SELECT
        (SELECT superseded_by FROM rate_price WHERE id = ${source.id}::uuid) AS linked_to,
        (SELECT count(*)::int FROM rate_price WHERE id = (SELECT superseded_by FROM rate_price WHERE id = ${source.id}::uuid)) AS successors,
        (SELECT count(*)::int FROM fact_log WHERE fact_type = 'rate_price.superseded' AND payload @> ${JSON.stringify({ old_rate_price_id: source.id })}::text::jsonb) AS facts,
        (SELECT count(*)::int FROM outbox WHERE event_type = 'rate_price.superseded' AND payload @> ${JSON.stringify({ old_rate_price_id: source.id })}::text::jsonb) AS events
    `;
    expect(evidence[0]).toEqual({ linked_to: winner.value.id, successors: 1, facts: 2, events: 1 });
  }, 30_000);

  test("P3: repeat, foreign tenant/property, and malformed pricing fail closed", async () => {
    if (!p1Old) throw new Error("P1 source fixture is absent");
    await expect(database.withTenantTransaction(TENANT_A, (tx) => service.supersede(tx, {
      ratePriceId: p1Old!.id,
      pricing: { occupancy: { "1": 1n } },
      envelope: envelope("rate_price.superseded"),
    }))).rejects.toBeInstanceOf(RateConflictError);
    await expect(database.withTenantTransaction(TENANT_B, (tx) => service.supersede(tx, {
      ratePriceId: p1Old!.id,
      pricing: { occupancy: { "1": 1n } },
      envelope: envelope("rate_price.superseded", TENANT_B, PROPERTY_B),
    }))).rejects.toBeInstanceOf(RateConflictError);
    const current = await createFixture("2037-05-01", "2037-06-01", 500n);
    await expect(database.withTenantTransaction(TENANT_A, (tx) => service.supersede(tx, {
      ratePriceId: current.id,
      pricing: { occupancy: { "1": 1n } },
      envelope: envelope("rate_price.superseded", TENANT_A, PROPERTY_B),
    }))).rejects.toBeInstanceOf(RateConflictError);
    await expect(database.withTenantTransaction(TENANT_A, (tx) => service.supersede(tx, {
      ratePriceId: current.id,
      pricing: { occupancy: { "1": 1 as never } },
      envelope: envelope("rate_price.superseded"),
    }))).rejects.toBeInstanceOf(RateValidationError);
  });

  test("P4: publisher failure restores the old current row and removes successor facts", async () => {
    const source = await createFixture("2037-07-01", "2037-08-01", 700n);
    const failing = new RatePricingService(new FailingEventBus());
    await expect(database.withTenantTransaction(TENANT_A, (tx) => failing.supersede(tx, {
      ratePriceId: source.id,
      pricing: { occupancy: { "1": 701n } },
      envelope: envelope("rate_price.superseded"),
    }))).rejects.toThrow("injected publisher failure");
    const rows = await admin<Array<{ superseded_by: string | null; prices: number; facts: number }>>`
      SELECT
        (SELECT superseded_by FROM rate_price WHERE id = ${source.id}::uuid) AS superseded_by,
        (SELECT count(*)::int FROM rate_price WHERE rate_plan_id = ${RATE_PLAN_A}::uuid AND lower(stay_dates) = '2037-07-01'::date) AS prices,
        (SELECT count(*)::int FROM fact_log WHERE fact_type = 'rate_price.superseded' AND payload @> ${JSON.stringify({ old_rate_price_id: source.id })}::text::jsonb) AS facts
    `;
    expect(rows[0]).toEqual({ superseded_by: null, prices: 1, facts: 0 });
  });

  test("P5: current lookup follows the correction link", async () => {
    if (!p1Old || !p1Successor) throw new Error("P1 chain fixtures are absent");
    const current = await database.withTenantTransaction(TENANT_A, (tx) => service.findCurrent(tx, {
      propertyNode: PROPERTY_A,
      ratePlanId: p1Old!.ratePlanId,
      unitTypeId: p1Old!.unitTypeId,
      stayDate: "2037-01-05",
    }));
    expect(current.id).toBe(p1Successor.id);
    expect(current.id).not.toBe(p1Old.id);
  });

  test("P6: canonical prices and unrelated current rows remain untouched", async () => {
    const canonical = await admin<Array<{ id: string; superseded_by: string | null }>>`
      SELECT id, superseded_by FROM rate_price
      WHERE id IN ('00000000-0000-0000-0000-000000000700'::uuid, '00000000-0000-0000-0000-000000000701'::uuid)
      ORDER BY id
    `;
    expect(canonical).toEqual([
      { id: "00000000-0000-0000-0000-000000000700", superseded_by: null },
      { id: "00000000-0000-0000-0000-000000000701", superseded_by: null },
    ]);
    const currentTestRows = await admin<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM rate_price
      WHERE id IN ${admin([...aggregateIds])} AND superseded_by IS NULL
    `;
    expect(currentTestRows[0]?.count).toBeGreaterThan(0);
  });
});
