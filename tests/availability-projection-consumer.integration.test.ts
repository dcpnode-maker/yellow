import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  AvailabilityProjectionConsumer,
  AvailabilityProjectionService,
  HoldService,
  type ProjectionRebuildResult,
} from "../src/contexts/inventory";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  type ConsumeBatchResult,
  type EventBus,
  type EventHandler,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_AVAILABILITY_PROJECTION_CONSUMER_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_AVAILABILITY_PROJECTION_CONSUMER === "1";
const TENANT = "00000000-0000-0000-0000-000000005910";
const PROPERTY = "00000000-0000-0000-0000-000000005920";
const UNIT_TYPE = "00000000-0000-0000-0000-000000005930";
const SPACE = "00000000-0000-0000-0000-000000005940";
const SELLABLE = "00000000-0000-0000-0000-000000005950";
const ACTOR = "00000000-0000-0000-0000-000000005960";
const FROM = "2027-03-13";
const TO = "2027-03-16";

if (REQUIRE_DATABASE && !DATABASE_URL) throw new Error("YELLOW_AVAILABILITY_PROJECTION_CONSUMER_URL is required by Order 059");
const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;

let admin: SQL;
let database: Database;
let events: PostgresEventBus;
let projection: AvailabilityProjectionService;
let holds: HoldService;

function envelope(operation: "hold.created" | "hold.released", requestId = crypto.randomUUID()) {
  return createAuditEnvelope({ actorId: ACTOR, tenantId: TENANT, propertyNode: PROPERTY, requestId, operation });
}

async function publish(eventType: string, payload: Record<string, unknown>, propertyNode: string | null = PROPERTY): Promise<void> {
  await database.withTenantTransaction(TENANT, (tx) => events.publish(tx, {
    tenantId: TENANT,
    propertyNode,
    businessDate: FROM,
    aggregateType: "order059",
    aggregateId: crypto.randomUUID(),
    eventType,
    actorId: ACTOR,
    correlationId: crypto.randomUUID(),
    payload,
  }));
}

async function snapshot(): Promise<unknown[]> {
  return admin`
    SELECT stay_date::text, physical, sold, held, blocked, ooo, available
    FROM availability_projection
    WHERE property_node = ${PROPERTY}::uuid
    ORDER BY stay_date
  `;
}

async function cursor(): Promise<{ last: number; processed: number }> {
  const rows = await admin<Array<{ last: number; processed: number }>>`
    SELECT COALESCE((SELECT last_seq::int FROM consumer_cursor WHERE consumer = 'availability-projection'), 0) AS last,
           (SELECT count(*)::int FROM consumer_processed WHERE consumer = 'availability-projection') AS processed
  `;
  return rows[0] ?? { last: 0, processed: 0 };
}

async function reset(): Promise<void> {
  await admin`DELETE FROM consumer_processed WHERE consumer = 'availability-projection'`;
  await admin`DELETE FROM consumer_cursor WHERE consumer = 'availability-projection'`;
  await admin`DELETE FROM outbox WHERE tenant_id = ${TENANT}::uuid`;
  await admin`DELETE FROM space_occupancy WHERE tenant_id = ${TENANT}::uuid`;
  await admin`DELETE FROM hold WHERE tenant_id = ${TENANT}::uuid`;
  await admin`DELETE FROM ooo_oos WHERE tenant_id = ${TENANT}::uuid`;
  await admin`UPDATE org_node SET config = '{"inventory":{"oos_sellability":"blocked"}}'::jsonb WHERE id = ${PROPERTY}::uuid`;
  await admin`DELETE FROM availability_projection WHERE property_node = ${PROPERTY}::uuid`;
  await database.withTenantTransaction(TENANT, (tx) => projection.rebuild(tx, { propertyNode: PROPERTY, fromDate: FROM, toDate: TO }));
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 8 });
  database = Database.connect(DATABASE_URL, { maxConnections: 12 });
  events = new PostgresEventBus(new SQL(DATABASE_URL, { max: 8 }));
  projection = new AvailabilityProjectionService();
  holds = new HoldService(events);
  await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id = ${SELLABLE}::uuid`;
  await admin`DELETE FROM sellable_unit WHERE id = ${SELLABLE}::uuid`;
  await admin`DELETE FROM space WHERE id = ${SPACE}::uuid`;
  await admin`DELETE FROM unit_type WHERE id = ${UNIT_TYPE}::uuid`;
  await admin`DELETE FROM org_node WHERE id = ${PROPERTY}::uuid`;
  await admin`DELETE FROM tenant WHERE id = ${TENANT}::uuid`;
  await admin`INSERT INTO tenant (id,slug,name,tier,status) VALUES (${TENANT}::uuid,'order059','Order 059','shared','active')`;
  await admin`INSERT INTO org_node (id,tenant_id,path,kind,name,timezone,currency,config) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order059','property','Order 059 New York','America/New_York','USD','{"inventory":{"oos_sellability":"blocked"}}')`;
  await admin`INSERT INTO unit_type (id,tenant_id,property_node,code,name,profile_key,max_occupancy,sort_order) VALUES
    (${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O59','Order 059 Room','hotel',2,590)`;
  await admin`INSERT INTO space (id,tenant_id,property_node,code,profile_key,capacity) VALUES
    (${SPACE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O59-1','hotel',1)`;
  await admin`INSERT INTO sellable_unit (id,tenant_id,unit_type_id,name) VALUES
    (${SELLABLE}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,'Order 059 Room 1')`;
  await admin`INSERT INTO sellable_unit_space (tenant_id,sellable_unit_id,space_id,claim_mode) VALUES
    (${TENANT}::uuid,${SELLABLE}::uuid,${SPACE}::uuid,'exclusive')`;
});

beforeEach(async () => { if (DATABASE_URL) await reset(); });

afterAll(async () => {
  if (!DATABASE_URL) return;
  await reset();
  await admin`DELETE FROM availability_projection WHERE property_node = ${PROPERTY}::uuid`;
  await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id = ${SELLABLE}::uuid`;
  await admin`DELETE FROM sellable_unit WHERE id = ${SELLABLE}::uuid`;
  await admin`DELETE FROM space WHERE id = ${SPACE}::uuid`;
  await admin`DELETE FROM unit_type WHERE id = ${UNIT_TYPE}::uuid`;
  await admin`DELETE FROM org_node WHERE id = ${PROPERTY}::uuid`;
  await admin`DELETE FROM tenant WHERE id = ${TENANT}::uuid`;
  await database.close();
  await admin.close();
}, 30_000);

databaseDescribe("Order 059 durable availability-projection event consumer", () => {
  test("P1: canonical hold occupancy rebuilds its local night atomically with cursor evidence", async () => {
    await database.withTenantTransaction(TENANT, (tx) => holds.place(tx, {
      sellableUnitId: SELLABLE,
      from: new Date("2027-03-14T05:00:00Z"),
      to: new Date("2027-03-15T04:00:00Z"),
      ttlSeconds: 900,
      holder: { reference: "order059-p1" },
      envelope: envelope("hold.created"),
    }));
    const result = await new AvailabilityProjectionConsumer(events, projection).drainOnce();
    expect(result).toMatchObject({ examined: 2, processed: 2, rebuilt: 1 });
    expect((await snapshot()).map((row: any) => [row.stay_date, row.held])).toEqual([
      ["2027-03-13", 0], ["2027-03-14", 1], ["2027-03-15", 0],
    ]);
    expect((await cursor()).processed).toBe(2);
  });

  test("P2: release restores projection and repeat drain is byte-equivalent", async () => {
    const placed = await database.withTenantTransaction(TENANT, (tx) => holds.place(tx, {
      sellableUnitId: SELLABLE, from: new Date("2027-03-14T05:00:00Z"), to: new Date("2027-03-15T04:00:00Z"),
      ttlSeconds: 900, holder: { reference: "order059-p2" }, envelope: envelope("hold.created"),
    }));
    const consumer = new AvailabilityProjectionConsumer(events, projection);
    await consumer.drainOnce();
    await database.withTenantTransaction(TENANT, (tx) => holds.release(tx, { holdId: placed.id, envelope: envelope("hold.released") }));
    await consumer.drainOnce();
    const restored = await snapshot();
    expect(restored.every((row: any) => row.held === 0)).toBeTrue();
    expect(await consumer.drainOnce()).toMatchObject({ examined: 0, processed: 0, rebuilt: 0 });
    expect(await snapshot()).toEqual(restored);
  });

  test("P3: OOS and policy events rebuild while unrelated events are acknowledged no-ops", async () => {
    await admin`INSERT INTO ooo_oos (tenant_id,space_id,kind,period,reason) VALUES
      (${TENANT}::uuid,${SPACE}::uuid,'oos',tstzrange('2027-03-15T04:00:00Z','2027-03-16T04:00:00Z','[)'),'Order 059')`;
    await publish("ooo.opened", { kind: "oos", period: '["2027-03-15 04:00:00+00","2027-03-16 04:00:00+00")' });
    const consumer = new AvailabilityProjectionConsumer(events, projection);
    await consumer.drainOnce();
    expect((await snapshot()).find((row: any) => row.stay_date === "2027-03-15")).toMatchObject({ blocked: 1, available: 0 });
    await admin`UPDATE org_node SET config = '{"inventory":{"oos_sellability":"allowed"}}'::jsonb WHERE id = ${PROPERTY}::uuid`;
    await publish("inventory.policy.changed", { policy: "oos_sellability", value: "allowed" });
    await consumer.drainOnce();
    expect((await snapshot()).find((row: any) => row.stay_date === "2027-03-15")).toMatchObject({ blocked: 0, available: 1 });
    const before = await snapshot();
    await publish("rate_price.created", { period: '["bad","bad")' });
    await consumer.drainOnce();
    expect(await snapshot()).toEqual(before);
  });

  test("P4: PostgreSQL derives exact DST and midnight local-date envelopes", async () => {
    const calls: Array<{ fromDate: string; toDate: string }> = [];
    const recorder = { async rebuild(_tx: Tx, input: any): Promise<ProjectionRebuildResult> {
      calls.push({ fromDate: input.fromDate, toDate: input.toDate });
      return { ...input, rows: 0, unitTypes: 0 };
    } };
    await publish("occupancy.recorded", { period: '["2027-03-14 04:59:59+00","2027-03-15 04:00:00+00")' });
    await new AvailabilityProjectionConsumer(events, recorder).drainOnce();
    expect(calls).toEqual([{ fromDate: "2027-03-13", toDate: "2027-03-15" }]);
  });

  test("P5: malformed and transient failures roll projection, cursor and markers back", async () => {
    await publish("occupancy.recorded", { period: "not-a-range" });
    const before = await snapshot();
    await expect(new AvailabilityProjectionConsumer(events, projection).drainOnce()).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
    expect(await cursor()).toEqual({ last: 0, processed: 0 });

    await reset();
    await publish("occupancy.recorded", { period: '("2027-03-14 05:00:00+00","2027-03-15 04:00:00+00"]' });
    const beforeNoncanonicalBounds = await snapshot();
    await expect(new AvailabilityProjectionConsumer(events, projection).drainOnce()).rejects.toThrow();
    expect(await snapshot()).toEqual(beforeNoncanonicalBounds);
    expect(await cursor()).toEqual({ last: 0, processed: 0 });

    await reset();
    await publish("occupancy.recorded", { period: '["2027-03-14 05:00:00+00","2027-03-15 04:00:00+00")' });
    let fail = true;
    const transient = { async rebuild(tx: Tx, input: any) {
      if (fail) { fail = false; throw new Error("order059 transient"); }
      return projection.rebuild(tx, input);
    } };
    const consumer = new AvailabilityProjectionConsumer(events, transient);
    await expect(consumer.drainOnce()).rejects.toThrow("order059 transient");
    expect(await cursor()).toEqual({ last: 0, processed: 0 });
    expect(await consumer.drainOnce()).toMatchObject({ processed: 1, rebuilt: 1 });
  });

  test("P6: concurrent drains serialize and polling retries without overlap then aborts", async () => {
    await publish("occupancy.recorded", { period: '["2027-03-14 05:00:00+00","2027-03-15 04:00:00+00")' });
    const [a, b] = await Promise.all([
      new AvailabilityProjectionConsumer(events, projection).drainOnce(),
      new AvailabilityProjectionConsumer(events, projection).drainOnce(),
    ]);
    expect([a.processed, b.processed].sort()).toEqual([0, 1]);

    let active = 0; let maxActive = 0; let attempts = 0;
    const fake: EventBus = {
      async publish(_tx: Tx, _event: PublishEventInput): Promise<OutboxEvent> { throw new Error("not used"); },
      async consumeBatch(_name: string, _handler: EventHandler): Promise<ConsumeBatchResult> {
        active++; maxActive = Math.max(maxActive, active); const attempt = ++attempts;
        await Bun.sleep(5); active--;
        if (attempt === 1) throw new Error("transient poll");
        return { consumer: "availability-projection", examined: 0, processed: 0, lastSeq: 0 };
      },
    };
    const abort = new AbortController(); const errors: unknown[] = [];
    await Promise.race([
      new AvailabilityProjectionConsumer(fake, projection, { pollIntervalMs: 100 }).run({
        signal: abort.signal,
        onError: (error) => errors.push(error),
        onResult: () => abort.abort(),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Order 059 worker did not stop")), 1_000)),
    ]);
    expect(errors).toHaveLength(1); expect(attempts).toBeGreaterThanOrEqual(2); expect(maxActive).toBe(1);

    let unobservedResultAttempts = 0;
    const unobservedResultAbort = new AbortController();
    const unobservedResultBus: EventBus = {
      async publish(_tx: Tx, _event: PublishEventInput): Promise<OutboxEvent> { throw new Error("not used"); },
      async consumeBatch(): Promise<ConsumeBatchResult> {
        unobservedResultAttempts += 1;
        unobservedResultAbort.abort();
        return { consumer: "availability-projection", examined: 0, processed: 0, lastSeq: 0 };
      },
    };
    await Promise.race([
      new AvailabilityProjectionConsumer(unobservedResultBus, projection, { pollIntervalMs: 100 }).run({
        signal: unobservedResultAbort.signal,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Order 059 worker skipped drain without onResult")), 1_000)),
    ]);
    expect(unobservedResultAttempts).toBe(1);

    expect(() => new AvailabilityProjectionConsumer(fake, projection, { batchSize: 0 })).toThrow();
    expect(() => new AvailabilityProjectionConsumer(fake, projection, { batchSize: 101 })).toThrow();
    expect(() => new AvailabilityProjectionConsumer(fake, projection, { pollIntervalMs: 99 })).toThrow();
    expect(() => new AvailabilityProjectionConsumer(fake, projection, { pollIntervalMs: 60_001 })).toThrow();
    const server = await Bun.file(new URL("../src/server.ts", import.meta.url)).text();
    const compose = await Bun.file(new URL("../docker-compose.yml", import.meta.url)).text();
    expect(server).toContain('workbenchEnabled && Bun.env.YELLOW_AVAILABILITY_PROJECTION_WORKER === "1"');
    expect(compose).toContain('YELLOW_AVAILABILITY_PROJECTION_WORKER: "${YELLOW_AVAILABILITY_PROJECTION_WORKER:-1}"');
  });
});
