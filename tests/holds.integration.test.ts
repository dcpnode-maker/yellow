import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { HoldConflictError, HoldService, InventoryNotFoundError } from "../src/contexts/inventory";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  type EventBus,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_HOLDS_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_HOLDS === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const TENANT_B = "00000000-0000-0000-0000-000000003002";
const PROPERTY_A = "00000000-0000-0000-0000-000000000012";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000003012";
const PROPERTY_B = "00000000-0000-0000-0000-000000003013";
const ACTOR = "00000000-0000-0000-0000-000000003060";
const UNIT_TYPE = "00000000-0000-0000-0000-000000003100";
const UNIT_TYPE_A2 = "00000000-0000-0000-0000-000000003101";
const SPACE_COMPOSITE_A = "00000000-0000-0000-0000-000000003200";
const SPACE_COMPOSITE_B = "00000000-0000-0000-0000-000000003201";
const SPACE_EXCLUSIVE = "00000000-0000-0000-0000-000000003202";
const SPACE_POSITIONAL = "00000000-0000-0000-0000-000000003203";
const SPACE_A2 = "00000000-0000-0000-0000-000000003204";
const SELLABLE_COMPOSITE = "00000000-0000-0000-0000-000000003300";
const SELLABLE_EXCLUSIVE = "00000000-0000-0000-0000-000000003301";
const SELLABLE_POSITIONAL = "00000000-0000-0000-0000-000000003302";
const SELLABLE_A2 = "00000000-0000-0000-0000-000000003303";

if (REQUIRE_DATABASE && !DATABASE_URL) throw new Error("YELLOW_HOLDS_URL is required by the Order 030 proof");

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let service: HoldService | undefined;
const holdIds = new Set<string>();

function envelope(operation: "hold.created" | "hold.released" | "hold.expired", propertyNode = PROPERTY_A) {
  return createAuditEnvelope({
    actorId: ACTOR,
    tenantId: TENANT_A,
    propertyNode,
    requestId: crypto.randomUUID(),
    operation,
  });
}

function stay(offsetDays = 0) {
  return {
    from: new Date(Date.UTC(2027, 0, 10 + offsetDays, 12)),
    to: new Date(Date.UTC(2027, 0, 12 + offsetDays, 12)),
  };
}

async function place(sellableUnitId: string, offsetDays: number, ttlSeconds = 900, propertyNode = PROPERTY_A) {
  const result = await database!.withTenantTransaction(TENANT_A, (tx) => service!.place(tx, {
    sellableUnitId,
    ...stay(offsetDays),
    ttlSeconds,
    holder: { client_id: `order030-${offsetDays}` },
    envelope: envelope("hold.created", propertyNode),
  }));
  holdIds.add(result.id);
  return result;
}

class FailingEventBus implements EventBus {
  async publish(_tx: Tx, _event: PublishEventInput): Promise<never> {
    throw new Error("injected hold publisher failure");
  }
  async consumeBatch(): Promise<never> {
    throw new Error("not used");
  }
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 8 });
  eventPool = new SQL(DATABASE_URL, { max: 16 });
  database = Database.connect(DATABASE_URL, { maxConnections: 32 });
  service = new HoldService(new PostgresEventBus(eventPool));
  await admin`DELETE FROM space_occupancy WHERE slot_ref IN (
    SELECT entity_id FROM fact_log WHERE actor_id = ${ACTOR}::uuid AND entity_type = 'hold'
  )`;
  await admin`DELETE FROM hold WHERE id IN (
    SELECT entity_id FROM fact_log WHERE actor_id = ${ACTOR}::uuid AND entity_type = 'hold'
  )`;
  await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR}::uuid`;
  await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR}::uuid`;
  await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id IN (${SELLABLE_COMPOSITE}::uuid, ${SELLABLE_EXCLUSIVE}::uuid, ${SELLABLE_POSITIONAL}::uuid, ${SELLABLE_A2}::uuid)`;
  await admin`DELETE FROM sellable_unit WHERE id IN (${SELLABLE_COMPOSITE}::uuid, ${SELLABLE_EXCLUSIVE}::uuid, ${SELLABLE_POSITIONAL}::uuid, ${SELLABLE_A2}::uuid)`;
  await admin`DELETE FROM space WHERE id IN (${SPACE_COMPOSITE_A}::uuid, ${SPACE_COMPOSITE_B}::uuid, ${SPACE_EXCLUSIVE}::uuid, ${SPACE_POSITIONAL}::uuid, ${SPACE_A2}::uuid)`;
  await admin`DELETE FROM unit_type WHERE id IN (${UNIT_TYPE}::uuid, ${UNIT_TYPE_A2}::uuid)`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id = ${TENANT_B}::uuid`;
  await admin`INSERT INTO tenant (id, slug, name, tier, status) VALUES (${TENANT_B}::uuid, 'order030-b', 'Order 030 B', 'shared', 'active')`;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A2}::uuid, ${TENANT_A}::uuid, 'order030_a2', 'property', 'Order 030 A2', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order030_b', 'property', 'Order 030 B', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key)
    VALUES
      (${UNIT_TYPE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O30', 'Order 030', 'hotel'),
      (${UNIT_TYPE_A2}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A2}::uuid, 'O30A2', 'Order 030 A2', 'hotel')
  `;
  await admin`
    INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity)
    VALUES
      (${SPACE_COMPOSITE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O30-CA', 'hotel', 1),
      (${SPACE_COMPOSITE_B}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O30-CB', 'hotel', 1),
      (${SPACE_EXCLUSIVE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O30-EX', 'hotel', 1),
      (${SPACE_POSITIONAL}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O30-POS', 'hotel', 2),
      (${SPACE_A2}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A2}::uuid, 'O30-A2', 'hotel', 1)
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name)
    VALUES
      (${SELLABLE_COMPOSITE}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE}::uuid, 'Order 030 Composite'),
      (${SELLABLE_EXCLUSIVE}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE}::uuid, 'Order 030 Exclusive'),
      (${SELLABLE_POSITIONAL}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE}::uuid, 'Order 030 Positional'),
      (${SELLABLE_A2}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE_A2}::uuid, 'Order 030 A2')
  `;
  await admin`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    VALUES
      (${TENANT_A}::uuid, ${SELLABLE_COMPOSITE}::uuid, ${SPACE_COMPOSITE_A}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_COMPOSITE}::uuid, ${SPACE_COMPOSITE_B}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_EXCLUSIVE}::uuid, ${SPACE_EXCLUSIVE}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_POSITIONAL}::uuid, ${SPACE_POSITIONAL}::uuid, 'positional'),
      (${TENANT_A}::uuid, ${SELLABLE_A2}::uuid, ${SPACE_A2}::uuid, 'exclusive')
  `;
});

afterAll(async () => {
  if (admin) {
    const ids = [...holdIds];
    if (ids.length > 0) {
      await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR}::uuid`;
      await admin`DELETE FROM fact_log WHERE entity_id IN ${admin(ids)}`;
      await admin`DELETE FROM space_occupancy WHERE slot_ref IN ${admin(ids)}`;
      await admin`DELETE FROM hold WHERE id IN ${admin(ids)}`;
    }
    await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR}::uuid`;
    await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR}::uuid`;
    await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id IN (${SELLABLE_COMPOSITE}::uuid, ${SELLABLE_EXCLUSIVE}::uuid, ${SELLABLE_POSITIONAL}::uuid, ${SELLABLE_A2}::uuid)`;
    await admin`DELETE FROM sellable_unit WHERE id IN (${SELLABLE_COMPOSITE}::uuid, ${SELLABLE_EXCLUSIVE}::uuid, ${SELLABLE_POSITIONAL}::uuid, ${SELLABLE_A2}::uuid)`;
    await admin`DELETE FROM space WHERE id IN (${SPACE_COMPOSITE_A}::uuid, ${SPACE_COMPOSITE_B}::uuid, ${SPACE_EXCLUSIVE}::uuid, ${SPACE_POSITIONAL}::uuid, ${SPACE_A2}::uuid)`;
    await admin`DELETE FROM unit_type WHERE id IN (${UNIT_TYPE}::uuid, ${UNIT_TYPE_A2}::uuid)`;
    await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid)`;
    await admin`DELETE FROM tenant WHERE id = ${TENANT_B}::uuid`;
    await admin.close();
  }
  await eventPool?.close();
  await database?.close();
}, 30_000);

databaseDescribe("Order 030 audited cart holds", () => {
  test("P1: composite placement commits hold, claims, fact, and exact events", async () => {
    const hold = await place(SELLABLE_COMPOSITE, 0, 120);
    expect(hold.status).toBe("active");
    expect(hold.from).toEqual(stay(0).from);
    expect(hold.to).toEqual(stay(0).to);
    expect(hold.expiresAt).toBeInstanceOf(Date);
    const ttl = await admin!<Array<{ remaining_seconds: number }>>`
      SELECT extract(epoch FROM expires_at - transaction_timestamp())::float8 AS remaining_seconds
      FROM hold WHERE id = ${hold.id}::uuid
    `;
    const remaining = ttl[0]?.remaining_seconds;
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(120);
    const evidence = await admin!<Array<{ claims: number; facts: number; events: string[] }>>`
      SELECT
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref = ${hold.id}::uuid) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE entity_type = 'hold' AND entity_id = ${hold.id}::uuid) AS facts,
        (SELECT array_agg(event_type ORDER BY event_type) FROM outbox
          WHERE aggregate_id = ${hold.id}::uuid OR payload @> ${JSON.stringify({ hold_id: hold.id })}::text::jsonb) AS events
    `;
    expect(evidence[0]?.claims).toBe(2);
    expect(evidence[0]?.facts).toBe(1);
    expect(evidence[0]?.events).toEqual(["hold.created", "occupancy.recorded", "occupancy.recorded"]);
    const period = await admin!<Array<{ lower_inc: boolean; upper_inc: boolean }>>`
      SELECT lower_inc(period), upper_inc(period) FROM hold WHERE id = ${hold.id}::uuid
    `;
    expect(period).toEqual([{ lower_inc: true, upper_inc: false }]);
  });

  test("P1 mapping completeness: one inactive component rejects the whole composite", async () => {
    const claimsBefore = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM space_occupancy
      WHERE space_id IN (${SPACE_COMPOSITE_A}::uuid, ${SPACE_COMPOSITE_B}::uuid)
    `;
    const before = claimsBefore[0];
    if (!before) throw new Error("PostgreSQL did not return the mapping-completeness claim count");
    await admin!`UPDATE space SET status = 'inactive' WHERE id = ${SPACE_COMPOSITE_B}::uuid`;
    const request = envelope("hold.created");
    try {
      await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.place(tx, {
        sellableUnitId: SELLABLE_COMPOSITE,
        ...stay(1),
        ttlSeconds: 60,
        holder: { order: 30, incomplete: true },
        envelope: request,
      }))).rejects.toBeInstanceOf(InventoryNotFoundError);
    } finally {
      await admin!`UPDATE space SET status = 'active' WHERE id = ${SPACE_COMPOSITE_B}::uuid`;
    }
    const evidence = await admin!<Array<{ holds: number; claims: number; facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM hold WHERE holder @> '{"incomplete":true}'::jsonb) AS holds,
        (SELECT count(*)::int FROM space_occupancy
          WHERE space_id IN (${SPACE_COMPOSITE_A}::uuid, ${SPACE_COMPOSITE_B}::uuid)) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE payload @> ${JSON.stringify({ request_id: request.requestId })}::text::jsonb) AS facts,
        (SELECT count(*)::int FROM outbox WHERE correlation_id = ${request.requestId}::uuid) AS events
    `;
    expect(evidence).toEqual([{
      holds: 0,
      claims: before.count,
      facts: 0,
      events: 0,
    }]);
  });

  test("P2: exclusive race has exactly one winner and no loser artifacts", async () => {
    const attempts = await Promise.allSettled(Array.from({ length: 20 }, (_, index) =>
      place(SELLABLE_EXCLUSIVE, 10, 900).then((hold) => ({ index, hold }))
    ));
    const winners = attempts.filter((result) => result.status === "fulfilled");
    const losers = attempts.filter((result) => result.status === "rejected");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(19);
    const unexpected = losers.flatMap((result) => {
      if (result.reason instanceof HoldConflictError) return [];
      const reason = result.reason as { name?: string; message?: string; errno?: string; code?: string };
      return [{ name: reason.name, message: reason.message, errno: reason.errno, code: reason.code }];
    });
    if (unexpected.length > 0) throw new Error(`Unexpected race errors: ${JSON.stringify(unexpected)}`);
    const winner = winners[0];
    if (!winner || winner.status !== "fulfilled") throw new Error("exclusive race returned no winner");
    const counts = await admin!<Array<{ holds: number; claims: number; facts: number }>>`
      SELECT
        (SELECT count(*)::int FROM hold WHERE sellable_unit_id = ${SELLABLE_EXCLUSIVE}::uuid AND period && tstzrange(${stay(10).from.toISOString()}::timestamptz, ${stay(10).to.toISOString()}::timestamptz, '[)')) AS holds,
        (SELECT count(*)::int FROM space_occupancy WHERE space_id = ${SPACE_EXCLUSIVE}::uuid AND period && tstzrange(${stay(10).from.toISOString()}::timestamptz, ${stay(10).to.toISOString()}::timestamptz, '[)')) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE entity_type = 'hold' AND entity_id = ${winner.value.hold.id}::uuid) AS facts
    `;
    expect(counts).toEqual([{ holds: 1, claims: 1, facts: 1 }]);
  }, 30_000);

  test("P3: positional race fills exactly two distinct claims", async () => {
    const attempts = await Promise.allSettled(Array.from({ length: 3 }, () => place(SELLABLE_POSITIONAL, 20)));
    const winners = attempts.filter((result) => result.status === "fulfilled");
    expect(winners).toHaveLength(2);
    expect(attempts.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rows = await admin!<Array<{ count: number; claims: number }>>`
      SELECT count(*)::int AS count, count(DISTINCT claim)::int AS claims
      FROM space_occupancy
      WHERE space_id = ${SPACE_POSITIONAL}::uuid
        AND period && tstzrange(${stay(20).from.toISOString()}::timestamptz, ${stay(20).to.toISOString()}::timestamptz, '[)')
    `;
    expect(rows).toEqual([{ count: 2, claims: 2 }]);
  });

  test("P4: publisher failure rolls back all hold artifacts", async () => {
    const failing = new HoldService(new FailingEventBus());
    const request = envelope("hold.created");
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => failing.place(tx, {
      sellableUnitId: SELLABLE_EXCLUSIVE,
      ...stay(30),
      ttlSeconds: 60,
      holder: { order: 30, rollback: true },
      envelope: request,
    }))).rejects.toThrow("injected hold publisher failure");
    const rows = await admin!<Array<{ holds: number; claims: number; facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM hold WHERE holder @> '{"rollback":true}'::jsonb) AS holds,
        (SELECT count(*)::int FROM space_occupancy WHERE period && tstzrange(${stay(30).from.toISOString()}::timestamptz, ${stay(30).to.toISOString()}::timestamptz, '[)') AND slot_kind = 'hold') AS claims,
        (SELECT count(*)::int FROM fact_log WHERE payload @> ${JSON.stringify({ request_id: request.requestId })}::text::jsonb) AS facts,
        (SELECT count(*)::int FROM outbox WHERE correlation_id = ${request.requestId}::uuid) AS events
    `;
    expect(rows).toEqual([{ holds: 0, claims: 0, facts: 0, events: 0 }]);
  });

  test("P5: release is exact and repeat release adds no evidence", async () => {
    const hold = await place(SELLABLE_COMPOSITE, 40);
    const released = await database!.withTenantTransaction(TENANT_A, (tx) => service!.release(tx, {
      holdId: hold.id,
      envelope: envelope("hold.released"),
    }));
    expect(released.status).toBe("released");
    const before = await admin!<Array<{ claims: number; facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref = ${hold.id}::uuid) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE entity_id = ${hold.id}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id = ${hold.id}::uuid OR payload @> ${JSON.stringify({ hold_id: hold.id })}::text::jsonb) AS events
    `;
    expect(before).toEqual([{ claims: 0, facts: 2, events: 6 }]);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.release(tx, {
      holdId: hold.id,
      envelope: envelope("hold.released"),
    }))).rejects.toBeInstanceOf(HoldConflictError);
    const after = await admin!<Array<{ facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM fact_log WHERE entity_id = ${hold.id}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id = ${hold.id}::uuid OR payload @> ${JSON.stringify({ hold_id: hold.id })}::text::jsonb) AS events
    `;
    expect(after).toEqual([{ facts: 2, events: 6 }]);
  });

  test("P6: expiry is bounded to due holds in one tenant property", async () => {
    const due = await place(SELLABLE_EXCLUSIVE, 50, 1);
    const future = await place(SELLABLE_EXCLUSIVE, 53, 900);
    const otherProperty = await place(SELLABLE_A2, 52, 1, PROPERTY_A2);
    await admin!`
      UPDATE hold SET expires_at = transaction_timestamp() - interval '1 second'
      WHERE id IN (${due.id}::uuid, ${otherProperty.id}::uuid)
    `;
    const expired = await database!.withTenantTransaction(TENANT_A, (tx) => service!.expireDue(
      tx,
      envelope("hold.expired"),
      1,
    ));
    expect(expired.map(({ id }) => id)).toEqual([due.id]);
    const states = await admin!<Array<{ id: string; status: string; claims: number }>>`
      SELECT h.id, h.status,
             (SELECT count(*)::int FROM space_occupancy so WHERE so.slot_ref = h.id) AS claims
      FROM hold h WHERE h.id IN (${due.id}::uuid, ${future.id}::uuid, ${otherProperty.id}::uuid)
      ORDER BY h.id
    `;
    const byId = new Map(states.map((row) => [row.id, row]));
    expect(byId.get(due.id)).toMatchObject({ status: "expired", claims: 0 });
    expect(byId.get(future.id)).toMatchObject({ status: "active", claims: 1 });
    expect(byId.get(otherProperty.id)).toMatchObject({ status: "active", claims: 1 });
  });

  test("P7: tenant B cannot observe or mutate tenant A holds", async () => {
    const hold = await place(SELLABLE_EXCLUSIVE, 60);
    const listed = await database!.withTenantTransaction(TENANT_B, (tx) => service!.listActive(tx, PROPERTY_A));
    expect(listed).toEqual([]);
    await expect(database!.withTenantTransaction(TENANT_B, (tx) => service!.get(tx, PROPERTY_A, hold.id)))
      .rejects.toBeInstanceOf(InventoryNotFoundError);
    const forged = createAuditEnvelope({
      actorId: ACTOR,
      tenantId: TENANT_B,
      propertyNode: PROPERTY_A,
      requestId: crypto.randomUUID(),
      operation: "hold.released",
    });
    await expect(database!.withTenantTransaction(TENANT_B, (tx) => service!.release(tx, { holdId: hold.id, envelope: forged })))
      .rejects.toBeInstanceOf(HoldConflictError);
  });

  test("P8: app_role still cannot write occupancy directly", async () => {
    const connection = await admin!.reserve();
    let observed: unknown;
    try {
      await connection.unsafe("BEGIN");
      await connection`SELECT set_config('app.tenant_id', ${TENANT_A}, true)`;
      await connection.unsafe("SET LOCAL ROLE app_role");
      try {
        await connection`
          DELETE FROM space_occupancy WHERE tenant_id = ${TENANT_A}::uuid AND slot_kind = 'hold'
        `;
      } catch (error) {
        observed = error;
      }
      await connection.unsafe("ROLLBACK");
    } finally {
      connection.release();
    }
    expect((observed as { errno?: string }).errno).toBe("42501");
  });
});
