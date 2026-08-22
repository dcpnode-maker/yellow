import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  AvailabilityService,
  HoldService,
  InventoryValidationError,
  type AvailabilityOption,
} from "../src/contexts/inventory";
import { createAuditEnvelope, Database, PostgresEventBus } from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_AVAILABILITY_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_AVAILABILITY === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const TENANT_B = "00000000-0000-0000-0000-000000003102";
const PROPERTY_A = "00000000-0000-0000-0000-000000000012";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000003112";
const PROPERTY_B = "00000000-0000-0000-0000-000000003113";
const ACTOR = "00000000-0000-0000-0000-000000003160";
const UT_SHARED = "00000000-0000-0000-0000-000000003400";
const UT_ROOM = "00000000-0000-0000-0000-000000003401";
const UT_COMPOSITE = "00000000-0000-0000-0000-000000003402";
const UT_A2 = "00000000-0000-0000-0000-000000003403";
const UT_PERF = "00000000-0000-0000-0000-000000003404";
const SPACE_SHARED = "00000000-0000-0000-0000-000000003500";
const SPACE_ROOM = "00000000-0000-0000-0000-000000003501";
const SPACE_COMPOSITE_A = "00000000-0000-0000-0000-000000003502";
const SPACE_COMPOSITE_B = "00000000-0000-0000-0000-000000003503";
const SPACE_A2 = "00000000-0000-0000-0000-000000003504";
const SU_POSITIONAL = "00000000-0000-0000-0000-000000003600";
const SU_ALTERNATIVE_EXCLUSIVE = "00000000-0000-0000-0000-000000003601";
const SU_ROOM = "00000000-0000-0000-0000-000000003602";
const SU_COMPOSITE = "00000000-0000-0000-0000-000000003603";
const SU_INVALID = "00000000-0000-0000-0000-000000003604";
const SU_A2 = "00000000-0000-0000-0000-000000003605";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_AVAILABILITY_URL is required by the Order 031 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let holds: HoldService | undefined;
const availability = new AvailabilityService();
const holdIds = new Set<string>();

const PERIOD = {
  from: new Date("2027-06-10T12:00:00.000Z"),
  to: new Date("2027-06-12T12:00:00.000Z"),
};
const NON_OVERLAP = {
  from: new Date("2027-07-10T12:00:00.000Z"),
  to: new Date("2027-07-12T12:00:00.000Z"),
};

function envelope(operation: "hold.created" | "hold.released" | "hold.expired") {
  return createAuditEnvelope({
    actorId: ACTOR,
    tenantId: TENANT_A,
    propertyNode: PROPERTY_A,
    requestId: crypto.randomUUID(),
    operation,
  });
}

async function search(propertyNode = PROPERTY_A, period = PERIOD, partySize = 1) {
  return database!.withTenantTransaction(TENANT_A, (tx) => availability.search(tx, {
    propertyNode,
    ...period,
    partySize,
  }));
}

async function place(sellableUnitId: string, period = PERIOD, ttlSeconds = 900) {
  const hold = await database!.withTenantTransaction(TENANT_A, (tx) => holds!.place(tx, {
    sellableUnitId,
    ...period,
    ttlSeconds,
    holder: { order: 31 },
    envelope: envelope("hold.created"),
  }));
  holdIds.add(hold.id);
  return hold;
}

async function release(holdId: string) {
  return database!.withTenantTransaction(TENANT_A, (tx) => holds!.release(tx, {
    holdId,
    envelope: envelope("hold.released"),
  }));
}

function fixtureOptions(options: readonly AvailabilityOption[]) {
  return options.filter(({ sellableUnitId }) => [
    SU_POSITIONAL,
    SU_ALTERNATIVE_EXCLUSIVE,
    SU_ROOM,
    SU_COMPOSITE,
    SU_INVALID,
  ].includes(sellableUnitId));
}

function counts(options: readonly AvailabilityOption[]) {
  return Object.fromEntries(fixtureOptions(options).map(({ sellableUnitId, availableCount }) => [
    sellableUnitId,
    availableCount,
  ]));
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 8 });
  eventPool = new SQL(DATABASE_URL, { max: 12 });
  database = Database.connect(DATABASE_URL, { maxConnections: 16 });
  holds = new HoldService(new PostgresEventBus(eventPool));

  await admin`DELETE FROM space_occupancy WHERE slot_ref IN (
    SELECT entity_id FROM fact_log WHERE actor_id = ${ACTOR}::uuid AND entity_type = 'hold'
  )`;
  await admin`DELETE FROM hold WHERE id IN (
    SELECT entity_id FROM fact_log WHERE actor_id = ${ACTOR}::uuid AND entity_type = 'hold'
  )`;
  await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR}::uuid`;
  await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR}::uuid`;
  await admin`DELETE FROM availability_projection WHERE unit_type_id IN (${UT_SHARED}::uuid, ${UT_ROOM}::uuid, ${UT_COMPOSITE}::uuid, ${UT_A2}::uuid, ${UT_PERF}::uuid)`;
  await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id IN (
    SELECT id FROM sellable_unit WHERE name LIKE 'Order 031%'
  )`;
  await admin`DELETE FROM sellable_unit WHERE name LIKE 'Order 031%'`;
  await admin`DELETE FROM space WHERE code LIKE 'O31-%'`;
  await admin`DELETE FROM unit_type WHERE id IN (${UT_SHARED}::uuid, ${UT_ROOM}::uuid, ${UT_COMPOSITE}::uuid, ${UT_A2}::uuid, ${UT_PERF}::uuid)`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id = ${TENANT_B}::uuid`;

  await admin`INSERT INTO tenant (id, slug, name, tier, status) VALUES (${TENANT_B}::uuid, 'order031-b', 'Order 031 B', 'shared', 'active')`;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A2}::uuid, ${TENANT_A}::uuid, 'order031_a2', 'property', 'Order 031 A2', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order031_b', 'property', 'Order 031 B', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, max_occupancy, sort_order)
    VALUES
      (${UT_SHARED}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O31-A', 'Shared', 'hostel', 4, 310),
      (${UT_ROOM}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O31-B', 'Room', 'hotel', 2, 311),
      (${UT_COMPOSITE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O31-C', 'Composite', 'hotel', 6, 312),
      (${UT_A2}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A2}::uuid, 'O31-D', 'Other property', 'hotel', 2, 313),
      (${UT_PERF}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O31-P', 'Performance', 'hotel', 2, 399)
  `;
  await admin`
    INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity)
    VALUES
      (${SPACE_SHARED}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O31-SHARED', 'hostel', 2),
      (${SPACE_ROOM}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O31-ROOM', 'hotel', 1),
      (${SPACE_COMPOSITE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O31-CA', 'hotel', 1),
      (${SPACE_COMPOSITE_B}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O31-CB', 'hotel', 1),
      (${SPACE_A2}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A2}::uuid, 'O31-A2', 'hotel', 1)
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name)
    VALUES
      (${SU_ALTERNATIVE_EXCLUSIVE}::uuid, ${TENANT_A}::uuid, ${UT_SHARED}::uuid, 'Order 031 A Private'),
      (${SU_POSITIONAL}::uuid, ${TENANT_A}::uuid, ${UT_SHARED}::uuid, 'Order 031 B Beds'),
      (${SU_ROOM}::uuid, ${TENANT_A}::uuid, ${UT_ROOM}::uuid, 'Order 031 Room'),
      (${SU_COMPOSITE}::uuid, ${TENANT_A}::uuid, ${UT_COMPOSITE}::uuid, 'Order 031 Composite'),
      (${SU_INVALID}::uuid, ${TENANT_A}::uuid, ${UT_COMPOSITE}::uuid, 'Order 031 Invalid'),
      (${SU_A2}::uuid, ${TENANT_A}::uuid, ${UT_A2}::uuid, 'Order 031 Other Property')
  `;
  await admin`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    VALUES
      (${TENANT_A}::uuid, ${SU_ALTERNATIVE_EXCLUSIVE}::uuid, ${SPACE_SHARED}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SU_POSITIONAL}::uuid, ${SPACE_SHARED}::uuid, 'positional'),
      (${TENANT_A}::uuid, ${SU_ROOM}::uuid, ${SPACE_ROOM}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SU_COMPOSITE}::uuid, ${SPACE_COMPOSITE_A}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SU_COMPOSITE}::uuid, ${SPACE_COMPOSITE_B}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SU_INVALID}::uuid, ${SPACE_COMPOSITE_A}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SU_INVALID}::uuid, ${SPACE_A2}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SU_A2}::uuid, ${SPACE_A2}::uuid, 'exclusive')
  `;
});

afterAll(async () => {
  if (admin) {
    await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR}::uuid`;
    await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR}::uuid`;
    const ids = [...holdIds];
    if (ids.length > 0) {
      await admin`DELETE FROM space_occupancy WHERE slot_ref IN ${admin(ids)}`;
      await admin`DELETE FROM hold WHERE id IN ${admin(ids)}`;
    }
    await admin`DELETE FROM availability_projection WHERE unit_type_id IN (${UT_SHARED}::uuid, ${UT_ROOM}::uuid, ${UT_COMPOSITE}::uuid, ${UT_A2}::uuid, ${UT_PERF}::uuid)`;
    await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id IN (SELECT id FROM sellable_unit WHERE name LIKE 'Order 031%')`;
    await admin`DELETE FROM sellable_unit WHERE name LIKE 'Order 031%'`;
    await admin`DELETE FROM space WHERE code LIKE 'O31-%'`;
    await admin`DELETE FROM unit_type WHERE id IN (${UT_SHARED}::uuid, ${UT_ROOM}::uuid, ${UT_COMPOSITE}::uuid, ${UT_A2}::uuid, ${UT_PERF}::uuid)`;
    await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid)`;
    await admin`DELETE FROM tenant WHERE id = ${TENANT_B}::uuid`;
    await admin.close();
  }
  await eventPool?.close();
  await database?.close();
}, 30_000);

databaseDescribe("Order 031 PostgreSQL-truth availability", () => {
  test("P1: empty configurations return deterministic physical capacities", async () => {
    const options = fixtureOptions(await search());
    expect(options.map(({ sellableUnitId, availableCount }) => [sellableUnitId, availableCount])).toEqual([
      [SU_ALTERNATIVE_EXCLUSIVE, 1],
      [SU_POSITIONAL, 2],
      [SU_ROOM, 1],
      [SU_COMPOSITE, 1],
    ]);
    expect(options.some(({ sellableUnitId }) => sellableUnitId === SU_INVALID)).toBe(false);
    expect((await search(PROPERTY_A, PERIOD, 5)).map(({ sellableUnitId }) => sellableUnitId)).toEqual([
      SU_COMPOSITE,
    ]);
  });

  test("P2/P3: real holds change only overlapping truth and alternatives conflict", async () => {
    const positional = await place(SU_POSITIONAL);
    expect(counts(await search())).toMatchObject({
      [SU_POSITIONAL]: 1,
      [SU_ALTERNATIVE_EXCLUSIVE]: 0,
      [SU_ROOM]: 1,
    });
    expect(counts(await search(PROPERTY_A, NON_OVERLAP))).toMatchObject({
      [SU_POSITIONAL]: 2,
      [SU_ALTERNATIVE_EXCLUSIVE]: 1,
    });
    await release(positional.id);
    expect(counts(await search())).toMatchObject({ [SU_POSITIONAL]: 2, [SU_ALTERNATIVE_EXCLUSIVE]: 1 });

    const exclusive = await place(SU_ALTERNATIVE_EXCLUSIVE);
    expect(counts(await search())).toMatchObject({ [SU_POSITIONAL]: 0, [SU_ALTERNATIVE_EXCLUSIVE]: 0 });
    await release(exclusive.id);
    expect(counts(await search())).toMatchObject({ [SU_POSITIONAL]: 2, [SU_ALTERNATIVE_EXCLUSIVE]: 1 });
  });

  test("P4: due but unswept occupancy remains unavailable until audited expiry", async () => {
    const hold = await place(SU_ROOM, PERIOD, 1);
    await admin!`UPDATE hold SET expires_at = transaction_timestamp() - interval '1 second' WHERE id = ${hold.id}::uuid`;
    expect(counts(await search())).toMatchObject({ [SU_ROOM]: 0 });
    const expired = await database!.withTenantTransaction(TENANT_A, (tx) => holds!.expireDue(tx, envelope("hold.expired"), 10));
    expect(expired.map(({ id }) => id)).toContain(hold.id);
    expect(counts(await search())).toMatchObject({ [SU_ROOM]: 1 });
  });

  test("P5: an inactive composite component excludes the whole configuration", async () => {
    await admin!`UPDATE space SET status = 'inactive' WHERE id = ${SPACE_COMPOSITE_B}::uuid`;
    try {
      expect(fixtureOptions(await search()).some(({ sellableUnitId }) => sellableUnitId === SU_COMPOSITE)).toBe(false);
    } finally {
      await admin!`UPDATE space SET status = 'active' WHERE id = ${SPACE_COMPOSITE_B}::uuid`;
    }
    expect(fixtureOptions(await search()).some(({ sellableUnitId }) => sellableUnitId === SU_INVALID)).toBe(false);
  });

  test("P6: corrupt projection data cannot alter authoritative results", async () => {
    const before = counts(await search());
    await admin!`
      INSERT INTO availability_projection (
        tenant_id, property_node, unit_type_id, stay_date, physical, sold, held, blocked, ooo
      ) VALUES (${TENANT_A}::uuid, ${PROPERTY_A}::uuid, ${UT_ROOM}::uuid, '2027-06-10', -999, 999, 999, 999, 999)
      ON CONFLICT (property_node, unit_type_id, stay_date) DO UPDATE
      SET physical = EXCLUDED.physical, sold = EXCLUDED.sold, held = EXCLUDED.held,
          blocked = EXCLUDED.blocked, ooo = EXCLUDED.ooo
    `;
    expect(counts(await search())).toEqual(before);
  });

  test("P7: tenant and property boundaries reveal no foreign options", async () => {
    const tenantB = await database!.withTenantTransaction(TENANT_B, (tx) => availability.search(tx, {
      propertyNode: PROPERTY_A,
      ...PERIOD,
    }));
    expect(tenantB).toEqual([]);
    const otherProperty = await search(PROPERTY_A2);
    expect(otherProperty.map(({ sellableUnitId }) => sellableUnitId)).toEqual([SU_A2]);
  });

  test("P8: catastrophic-regression guard validates input and keeps 500 spaces below 1000 ms", async () => {
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => availability.search(tx, {
      propertyNode: PROPERTY_A,
      from: PERIOD.to,
      to: PERIOD.from,
    }))).rejects.toBeInstanceOf(InventoryValidationError);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => availability.search(tx, {
      propertyNode: PROPERTY_A,
      ...PERIOD,
      partySize: 0,
    }))).rejects.toBeInstanceOf(InventoryValidationError);

    await admin!`
      INSERT INTO space (tenant_id, property_node, code, profile_key, capacity)
      SELECT ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O31-PERF-' || lpad(g::text, 3, '0'), 'hotel', 1
      FROM generate_series(1, 500) AS g
    `;
    await admin!`
      INSERT INTO sellable_unit (tenant_id, unit_type_id, name)
      SELECT ${TENANT_A}::uuid, ${UT_PERF}::uuid, 'Order 031 Perf ' || code
      FROM space WHERE tenant_id = ${TENANT_A}::uuid AND code LIKE 'O31-PERF-%'
    `;
    await admin!`
      INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
      SELECT ${TENANT_A}::uuid, su.id, s.id, 'exclusive'
      FROM sellable_unit su
      JOIN space s ON su.name = 'Order 031 Perf ' || s.code
      WHERE su.tenant_id = ${TENANT_A}::uuid AND su.name LIKE 'Order 031 Perf O31-PERF-%'
    `;
    const durations: number[] = [];
    let performanceOptionCount = 0;
    for (let run = 0; run < 20; run += 1) {
      const started = performance.now();
      performanceOptionCount = (await search()).filter(({ unitTypeId }) => unitTypeId === UT_PERF).length;
      durations.push(performance.now() - started);
    }
    const maxMs = Math.max(...durations);
    console.log(
      `Order 031 catastrophic-regression guard: options=${performanceOptionCount} ` +
      `runs=20 max_ms=${maxMs.toFixed(2)} ceiling_ms=1000`,
    );
    expect(performanceOptionCount).toBe(500);
    expect(maxMs).toBeLessThan(1_000);
  }, 30_000);
});
