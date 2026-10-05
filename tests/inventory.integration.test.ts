import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryService,
  InventoryValidationError,
} from "../src/contexts/inventory";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  type EventBus,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_INVENTORY_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_INVENTORY === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const PROPERTY_A = "00000000-0000-0000-0000-000000000012";
const TENANT_B = "00000000-0000-0000-0000-000000002802";
const PROPERTY_B = "00000000-0000-0000-0000-000000002812";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000002813";
const ACTOR_A = "00000000-0000-0000-0000-000000002860";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_INVENTORY_URL is required by the Order 028 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let service: InventoryService | undefined;
const aggregateIds = new Set<string>();

function envelope(operation: "unit_type.created" | "space.created" | "sellable_unit.created") {
  return createAuditEnvelope({
    actorId: ACTOR_A,
    tenantId: TENANT_A,
    propertyNode: PROPERTY_A,
    requestId: crypto.randomUUID(),
    operation,
  });
}

async function createUnitType(code: string, sortOrder = 0) {
  const result = await database!.withTenantTransaction(TENANT_A, (tx) => service!.createUnitType(tx, {
    code,
    name: `Order 028 ${code}`,
    profileKey: "hotel",
    baseOccupancy: 1,
    maxOccupancy: 4,
    attrs: { proof: { order: 28 }, accessible: true },
    sortOrder,
    envelope: envelope("unit_type.created"),
  }));
  aggregateIds.add(result.id);
  return result;
}

async function createSpace(code: string, propertyNode = PROPERTY_A) {
  const request = createAuditEnvelope({
    actorId: ACTOR_A,
    tenantId: TENANT_A,
    propertyNode,
    requestId: crypto.randomUUID(),
    operation: "space.created",
  });
  const result = await database!.withTenantTransaction(TENANT_A, (tx) => service!.createSpace(tx, {
    code,
    profileKey: "hotel",
    capacity: 2,
    maxOccupancy: 4,
    floor: "28",
    areaSqm: 42.5,
    genderPolicy: "any",
    attrs: { proof: { order: 28 }, balcony: false },
    envelope: request,
  }));
  aggregateIds.add(result.id);
  return result;
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
  service = new InventoryService(new PostgresEventBus(eventPool));

  await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id IN (
    SELECT id FROM sellable_unit WHERE name LIKE 'Order 028%'
  )`;
  await admin`DELETE FROM sellable_unit WHERE name LIKE 'Order 028%'`;
  await admin`DELETE FROM space WHERE code LIKE 'O28-%'`;
  await admin`DELETE FROM unit_type WHERE code LIKE 'O28-%'`;
  await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR_A}::uuid`;
  await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id = ${TENANT_B}::uuid`;
  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${TENANT_B}::uuid, 'order028-b', 'Order 028 Tenant B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A2}::uuid, ${TENANT_A}::uuid, 'order028_property_a2', 'property', 'Order 028 Property A2', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order028_property_b', 'property', 'Order 028 Property B', 'UTC', 'USD')
  `;
});

afterAll(async () => {
  if (admin) {
    const ids = [...aggregateIds];
    if (ids.length > 0) {
      await admin`DELETE FROM outbox WHERE aggregate_id IN ${admin(ids)}`;
      await admin`DELETE FROM fact_log WHERE entity_id IN ${admin(ids)}`;
      await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id IN ${admin(ids)}`;
      await admin`DELETE FROM sellable_unit WHERE id IN ${admin(ids)}`;
      await admin`DELETE FROM space WHERE id IN ${admin(ids)}`;
      await admin`DELETE FROM unit_type WHERE id IN ${admin(ids)}`;
    }
    await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR_A}::uuid`;
    await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid`;
    await admin`DELETE FROM space WHERE code LIKE 'O28-%'`;
    await admin`DELETE FROM unit_type WHERE code LIKE 'O28-%'`;
    await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid)`;
    await admin`DELETE FROM tenant WHERE id = ${TENANT_B}::uuid`;
    await admin.close();
  }
  await eventPool?.close();
  await database?.close();
});

databaseDescribe("Order 028 tenant-safe inventory configuration", () => {
  test("P1: creates and reads an atomic audited inventory configuration", async () => {
    const unitType = await createUnitType("O28-COMPOSITE", 280);
    const spaceA = await createSpace("O28-SPACE-A");
    const spaceB = await createSpace("O28-SPACE-B");
    const sellable = await database!.withTenantTransaction(TENANT_A, (tx) => service!.createSellableUnit(tx, {
      unitTypeId: unitType.id,
      name: "Order 028 Composite",
      spaces: [
        { spaceId: spaceB.id, claimMode: "positional" },
        { spaceId: spaceA.id, claimMode: "exclusive" },
      ],
      envelope: envelope("sellable_unit.created"),
    }));
    aggregateIds.add(sellable.id);

    expect(unitType.attrs).toEqual({ proof: { order: 28 }, accessible: true });
    expect(spaceA.areaSqm).toBe("42.50");
    expect(sellable.spaces.map(({ code, claimMode }) => [code, claimMode])).toEqual([
      ["O28-SPACE-A", "exclusive"],
      ["O28-SPACE-B", "positional"],
    ]);

    const read = await database!.withTenantTransaction(TENANT_A, async (tx) => ({
      unitType: await service!.getUnitType(tx, PROPERTY_A, unitType.id),
      space: await service!.getSpace(tx, PROPERTY_A, spaceA.id),
      sellable: await service!.getSellableUnit(tx, PROPERTY_A, sellable.id),
    }));
    expect(read.unitType).toEqual(unitType);
    expect(read.space).toEqual(spaceA);
    expect(read.sellable).toEqual(sellable);

    const evidence = await admin!<Array<{
      entity_type: string;
      facts: number;
      events: number;
      payload_kind: string;
    }>>`
      SELECT f.entity_type, count(DISTINCT f.id)::int AS facts,
             count(DISTINCT o.id)::int AS events,
             min(jsonb_typeof(f.payload)) AS payload_kind
      FROM fact_log AS f
      JOIN outbox AS o ON o.aggregate_type = f.entity_type AND o.aggregate_id = f.entity_id
      WHERE f.entity_id IN (${unitType.id}::uuid, ${spaceA.id}::uuid, ${spaceB.id}::uuid, ${sellable.id}::uuid)
      GROUP BY f.entity_type
      ORDER BY f.entity_type
    `;
    expect(evidence).toEqual([
      { entity_type: "sellable_unit", facts: 1, events: 1, payload_kind: "object" },
      { entity_type: "space", facts: 2, events: 2, payload_kind: "object" },
      { entity_type: "unit_type", facts: 1, events: 1, payload_kind: "object" },
    ]);
    const eventTypes = await admin!<Array<{ event_type: string; fact_type: string }>>`
      SELECT o.event_type, f.fact_type
      FROM outbox AS o
      JOIN fact_log AS f ON f.entity_type = o.aggregate_type AND f.entity_id = o.aggregate_id
      WHERE o.aggregate_id IN (${unitType.id}::uuid, ${spaceA.id}::uuid, ${spaceB.id}::uuid, ${sellable.id}::uuid)
      ORDER BY o.event_type, o.aggregate_id
    `;
    expect(eventTypes).toEqual([
      { event_type: "sellable_unit.created", fact_type: "sellable_unit.created" },
      { event_type: "space.created", fact_type: "space.created" },
      { event_type: "space.created", fact_type: "space.created" },
      { event_type: "unit_type.created", fact_type: "unit_type.created" },
    ]);
  });

  test("P2: publisher failure rolls aggregate and fact back together", async () => {
    const failingService = new InventoryService(new FailingEventBus());
    const request = envelope("space.created");
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => failingService.createSpace(tx, {
      code: "O28-ROLLBACK",
      profileKey: "hotel",
      attrs: { should: "rollback" },
      envelope: request,
    }))).rejects.toThrow("injected publisher failure");

    const counts = await admin!<Array<{ spaces: number; facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM space WHERE code = 'O28-ROLLBACK') AS spaces,
        (SELECT count(*)::int FROM fact_log WHERE payload @> ${JSON.stringify({ request_id: request.requestId })}::text::jsonb) AS facts,
        (SELECT count(*)::int FROM outbox WHERE correlation_id = ${request.requestId}::uuid) AS events
    `;
    expect(counts).toEqual([{ spaces: 0, facts: 0, events: 0 }]);
  });

  test("P3: tenant B cannot observe or target tenant A inventory", async () => {
    const unitType = await createUnitType("O28-ISOLATED", 281);
    const space = await createSpace("O28-ISOLATED");
    const observed = await database!.withTenantTransaction(TENANT_B, async (tx) => ({
      unitTypes: await service!.listUnitTypes(tx, PROPERTY_A),
      spaces: await service!.listSpaces(tx, PROPERTY_A),
      sellables: await service!.listSellableUnits(tx, PROPERTY_A),
    }));
    expect(observed).toEqual({ unitTypes: [], spaces: [], sellables: [] });
    await expect(database!.withTenantTransaction(TENANT_B, (tx) => service!.getUnitType(tx, PROPERTY_A, unitType.id)))
      .rejects.toBeInstanceOf(InventoryNotFoundError);
    await expect(database!.withTenantTransaction(TENANT_B, (tx) => service!.getSpace(tx, PROPERTY_A, space.id)))
      .rejects.toBeInstanceOf(InventoryNotFoundError);

    const forgedEnvelope = createAuditEnvelope({
      actorId: ACTOR_A,
      tenantId: TENANT_B,
      propertyNode: PROPERTY_A,
      requestId: crypto.randomUUID(),
      operation: "space.created",
    });
    await expect(database!.withTenantTransaction(TENANT_B, (tx) => service!.createSpace(tx, {
      code: "O28-FORGED",
      profileKey: "hotel",
      envelope: forgedEnvelope,
    }))).rejects.toBeInstanceOf(InventoryNotFoundError);
    const tenantBEnvelope = createAuditEnvelope({
      actorId: ACTOR_A,
      tenantId: TENANT_B,
      propertyNode: PROPERTY_B,
      requestId: crypto.randomUUID(),
      operation: "sellable_unit.created",
    });
    await expect(database!.withTenantTransaction(TENANT_B, (tx) => service!.createSellableUnit(tx, {
      unitTypeId: unitType.id,
      name: "Order 028 Foreign Identifiers",
      spaces: [{ spaceId: space.id, claimMode: "exclusive" }],
      envelope: tenantBEnvelope,
    }))).rejects.toBeInstanceOf(InventoryNotFoundError);
  });

  test("P4: sellable configuration rejects a cross-property space", async () => {
    const unitType = await createUnitType("O28-PROPERTY", 282);
    const otherSpace = await createSpace("O28-OTHER-PROPERTY", PROPERTY_A2);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createSellableUnit(tx, {
      unitTypeId: unitType.id,
      name: "Order 028 Cross Property",
      spaces: [{ spaceId: otherSpace.id, claimMode: "exclusive" }],
      envelope: envelope("sellable_unit.created"),
    }))).rejects.toBeInstanceOf(InventoryNotFoundError);
    const rows = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM sellable_unit WHERE name = 'Order 028 Cross Property'
    `;
    expect(rows).toEqual([{ count: 0 }]);
  });

  test("P5: duplicate and malformed inputs fail without partial evidence", async () => {
    const unitType = await createUnitType("O28-DUPLICATE", 283);
    const space = await createSpace("O28-DUPLICATE");
    const evidenceBefore = await admin!<Array<{ facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE actor_id = ${ACTOR_A}::uuid) AS events
    `;
    await expect(createUnitType("O28-DUPLICATE", 284)).rejects.toBeInstanceOf(InventoryConflictError);
    await expect(createSpace("O28-DUPLICATE")).rejects.toBeInstanceOf(InventoryConflictError);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createUnitType(tx, {
      code: "O28-BAD-ATTRS",
      name: "Bad attrs",
      profileKey: "hotel",
      attrs: [] as unknown as Record<string, unknown>,
      envelope: envelope("unit_type.created"),
    }))).rejects.toBeInstanceOf(InventoryValidationError);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createSpace(tx, {
      code: "O28-BAD-CAPACITY",
      profileKey: "hotel",
      capacity: 0,
      envelope: envelope("space.created"),
    }))).rejects.toBeInstanceOf(InventoryValidationError);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createUnitType(tx, {
      code: "O28-BAD-OCCUPANCY",
      name: "Bad occupancy",
      profileKey: "hotel",
      baseOccupancy: 3,
      maxOccupancy: 2,
      envelope: envelope("unit_type.created"),
    }))).rejects.toBeInstanceOf(InventoryValidationError);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createSellableUnit(tx, {
      unitTypeId: unitType.id,
      name: "Order 028 Empty",
      spaces: [],
      envelope: envelope("sellable_unit.created"),
    }))).rejects.toBeInstanceOf(InventoryValidationError);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createSellableUnit(tx, {
      unitTypeId: unitType.id,
      name: "Order 028 Duplicate Claims",
      spaces: [
        { spaceId: space.id, claimMode: "exclusive" },
        { spaceId: space.id, claimMode: "positional" },
      ],
      envelope: envelope("sellable_unit.created"),
    }))).rejects.toBeInstanceOf(InventoryValidationError);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createSellableUnit(tx, {
      unitTypeId: unitType.id,
      name: "Order 028 Invalid Claim",
      spaces: [{ spaceId: space.id, claimMode: "shared" as "exclusive" }],
      envelope: envelope("sellable_unit.created"),
    }))).rejects.toBeInstanceOf(InventoryValidationError);

    const partial = await admin!<Array<{ aggregates: number; facts: number; events: number }>>`
      SELECT
        ((SELECT count(*) FROM unit_type WHERE code IN ('O28-BAD-ATTRS')) +
         (SELECT count(*) FROM unit_type WHERE code IN ('O28-BAD-OCCUPANCY')) +
         (SELECT count(*) FROM space WHERE code IN ('O28-BAD-CAPACITY')) +
         (SELECT count(*) FROM sellable_unit WHERE name IN ('Order 028 Empty', 'Order 028 Duplicate Claims', 'Order 028 Invalid Claim')))::int AS aggregates,
        (SELECT count(*)::int FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE actor_id = ${ACTOR_A}::uuid) AS events
    `;
    const before = evidenceBefore[0];
    const after = partial[0];
    if (!before || !after) throw new Error("PostgreSQL did not return the P5 evidence counts");
    expect(after.aggregates).toBe(0);
    expect({ facts: after.facts, events: after.events }).toEqual(before);
  });

  test("P6: property lists are deterministic", async () => {
    const typeZ = await createUnitType("O28-SORT-Z", 290);
    const typeB = await createUnitType("O28-SORT-B", 285);
    await createUnitType("O28-SORT-A", 285);
    const spaceZ = await createSpace("O28-SORT-Z");
    const spaceA = await createSpace("O28-SORT-A");
    for (const [unitTypeId, name, spaceId] of [
      [typeB.id, "Order 028 Sort B", spaceA.id],
      [typeB.id, "Order 028 Sort A", spaceZ.id],
      [typeZ.id, "Order 028 Sort Z", spaceZ.id],
    ] as const) {
      const created = await database!.withTenantTransaction(TENANT_A, (tx) => service!.createSellableUnit(tx, {
        unitTypeId,
        name,
        spaces: [{ spaceId, claimMode: "exclusive" }],
        envelope: envelope("sellable_unit.created"),
      }));
      aggregateIds.add(created.id);
    }
    const lists = await database!.withTenantTransaction(TENANT_A, async (tx) => ({
      unitTypes: await service!.listUnitTypes(tx, PROPERTY_A),
      spaces: await service!.listSpaces(tx, PROPERTY_A),
      sellables: await service!.listSellableUnits(tx, PROPERTY_A),
    }));
    expect(lists.unitTypes.filter(({ code }) => code.startsWith("O28-SORT-")).map(({ code }) => code)).toEqual([
      "O28-SORT-A",
      "O28-SORT-B",
      "O28-SORT-Z",
    ]);
    expect(lists.spaces.filter(({ code }) => code.startsWith("O28-SORT-")).map(({ code }) => code)).toEqual([
      "O28-SORT-A",
      "O28-SORT-Z",
    ]);
    expect(lists.sellables.filter(({ name }) => name.startsWith("Order 028 Sort")).map(({ name }) => name)).toEqual([
      "Order 028 Sort A",
      "Order 028 Sort B",
      "Order 028 Sort Z",
    ]);
  });
});
