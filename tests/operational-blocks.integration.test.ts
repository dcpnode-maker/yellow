import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  HoldService,
  InventoryNotFoundError,
  InventoryValidationError,
  OperationalBlockConflictError,
  OperationalBlockService,
  type OperationalBlockKind,
} from "../src/contexts/inventory";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  type ConsumeBatchOptions,
  type ConsumeBatchResult,
  type EventBus,
  type EventHandler,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_OPERATIONAL_BLOCK_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATIONAL_BLOCK === "1";
const TENANT_A = "00000000-0000-0000-0000-000000003810";
const TENANT_B = "00000000-0000-0000-0000-000000003811";
const PROPERTY_A = "00000000-0000-0000-0000-000000003820";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000003821";
const PROPERTY_B = "00000000-0000-0000-0000-000000003822";
const UNIT_TYPE_A = "00000000-0000-0000-0000-000000003830";
const SPACE_A = "00000000-0000-0000-0000-000000003840";
const SPACE_A2 = "00000000-0000-0000-0000-000000003841";
const SPACE_B = "00000000-0000-0000-0000-000000003842";
const SELLABLE_A = "00000000-0000-0000-0000-000000003850";
const ACTOR = "00000000-0000-0000-0000-000000003860";
const FROM = new Date("2027-10-10T12:00:00.000Z");
const TO = new Date("2027-10-12T12:00:00.000Z");

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_OPERATIONAL_BLOCK_URL is required by the Order 037 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL;
let eventPool: SQL;
let database: Database;
let events: PostgresEventBus;
let blocks: OperationalBlockService;
let holds: HoldService;

function envelope(
  operation: "ooo.opened" | "ooo.closed" | "hold.created" | "hold.released",
  tenantId = TENANT_A,
  propertyNode = PROPERTY_A,
) {
  return createAuditEnvelope({
    actorId: ACTOR,
    tenantId,
    propertyNode,
    requestId: crypto.randomUUID(),
    operation,
  });
}

async function open(
  kind: OperationalBlockKind,
  reason: string,
  options: { readonly from?: Date; readonly to?: Date; readonly spaceId?: string } = {},
) {
  return database.withTenantTransaction(TENANT_A, (tx) => blocks.open(tx, {
    spaceId: options.spaceId ?? SPACE_A,
    kind,
    from: options.from ?? FROM,
    to: options.to ?? TO,
    reason,
    envelope: envelope("ooo.opened"),
  }));
}

async function close(blockId: string) {
  return database.withTenantTransaction(TENANT_A, (tx) => blocks.close(tx, {
    blockId,
    envelope: envelope("ooo.closed"),
  }));
}

async function releaseFixtureClaims(): Promise<void> {
  const operational = await admin<Array<{ id: string; tenant_id: string }>>`
    SELECT id, tenant_id FROM ooo_oos
    WHERE space_id IN (${SPACE_A}::uuid, ${SPACE_A2}::uuid, ${SPACE_B}::uuid)
  `;
  for (const row of operational) {
    await admin`SELECT release_occupancy(${row.tenant_id}::uuid, ${row.id}::uuid)`;
  }
  const fixtureHolds = await admin<Array<{ id: string; tenant_id: string }>>`
    SELECT id, tenant_id FROM hold WHERE sellable_unit_id = ${SELLABLE_A}::uuid
  `;
  for (const row of fixtureHolds) {
    await admin`SELECT release_occupancy(${row.tenant_id}::uuid, ${row.id}::uuid)`;
  }
}

async function cleanupArtifacts(): Promise<void> {
  await releaseFixtureClaims();
  await admin`DELETE FROM hold WHERE sellable_unit_id = ${SELLABLE_A}::uuid`;
  await admin`DELETE FROM ooo_oos WHERE space_id IN (${SPACE_A}::uuid, ${SPACE_A2}::uuid, ${SPACE_B}::uuid)`;
  await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR}::uuid`;
  await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR}::uuid`;
}

async function artifactCounts() {
  const rows = await admin<Array<{
    blocks: number;
    occupancies: number;
    facts: number;
    events: number;
  }>>`
    SELECT
      (SELECT count(*)::int FROM ooo_oos
       WHERE space_id IN (${SPACE_A}::uuid, ${SPACE_A2}::uuid, ${SPACE_B}::uuid)) AS blocks,
      (SELECT count(*)::int FROM space_occupancy
       WHERE slot_kind = 'ooo' AND space_id IN (${SPACE_A}::uuid, ${SPACE_A2}::uuid, ${SPACE_B}::uuid)) AS occupancies,
      (SELECT count(*)::int FROM fact_log WHERE actor_id = ${ACTOR}::uuid) AS facts,
      (SELECT count(*)::int FROM outbox WHERE actor_id = ${ACTOR}::uuid) AS events
  `;
  return rows[0];
}

class FailSecondPublishBus implements EventBus {
  readonly #delegate: EventBus;
  #calls = 0;

  constructor(delegate: EventBus) {
    this.#delegate = delegate;
  }

  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    this.#calls += 1;
    if (this.#calls === 2) throw new Error("Order 037 injected second-publish failure");
    return this.#delegate.publish(tx, event);
  }

  consumeBatch(
    consumer: string,
    handler: EventHandler,
    options?: ConsumeBatchOptions,
  ): Promise<ConsumeBatchResult> {
    return this.#delegate.consumeBatch(consumer, handler, options);
  }
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 12 });
  eventPool = new SQL(DATABASE_URL, { max: 32 });
  database = Database.connect(DATABASE_URL, { maxConnections: 32 });
  events = new PostgresEventBus(eventPool);
  blocks = new OperationalBlockService(events);
  holds = new HoldService(events);

  await cleanupArtifacts();
  await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id = ${SELLABLE_A}::uuid`;
  await admin`DELETE FROM sellable_unit WHERE id = ${SELLABLE_A}::uuid`;
  await admin`DELETE FROM space WHERE id IN (${SPACE_A}::uuid, ${SPACE_A2}::uuid, ${SPACE_B}::uuid)`;
  await admin`DELETE FROM unit_type WHERE id = ${UNIT_TYPE_A}::uuid`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A}::uuid, ${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order037-a', 'Order 037 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order037-b', 'Order 037 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order037_a', 'property', 'Order 037 A', 'UTC', 'USD'),
      (${PROPERTY_A2}::uuid, ${TENANT_A}::uuid, 'order037_a2', 'property', 'Order 037 A2', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order037_b', 'property', 'Order 037 B', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, max_occupancy)
    VALUES (${UNIT_TYPE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O37-A', 'Order 037 A', 'hotel', 2)
  `;
  await admin`
    INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity)
    VALUES
      (${SPACE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O37-A', 'hotel', 1),
      (${SPACE_A2}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A2}::uuid, 'O37-A2', 'hotel', 1),
      (${SPACE_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O37-B', 'hotel', 1)
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name)
    VALUES (${SELLABLE_A}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE_A}::uuid, 'Order 037 A')
  `;
  await admin`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    VALUES (${TENANT_A}::uuid, ${SELLABLE_A}::uuid, ${SPACE_A}::uuid, 'exclusive')
  `;
});

beforeEach(async () => {
  if (!DATABASE_URL) return;
  await cleanupArtifacts();
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  await cleanupArtifacts();
  await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id = ${SELLABLE_A}::uuid`;
  await admin`DELETE FROM sellable_unit WHERE id = ${SELLABLE_A}::uuid`;
  await admin`DELETE FROM space WHERE id IN (${SPACE_A}::uuid, ${SPACE_A2}::uuid, ${SPACE_B}::uuid)`;
  await admin`DELETE FROM unit_type WHERE id = ${UNIT_TYPE_A}::uuid`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A}::uuid, ${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin.close();
  await eventPool.close();
  await database.close();
});

databaseDescribe("Order 037 audited OOO/OOS lifecycle", () => {
  test("P1: OOO open commits one exclusive claim with exact fact and events", async () => {
    const block = await open("ooo", "AC compressor replacement");
    expect(block).toMatchObject({ tenantId: TENANT_A, propertyNode: PROPERTY_A, spaceId: SPACE_A, kind: "ooo" });
    expect(block.from).toEqual(FROM);
    expect(block.to).toEqual(TO);

    const stored = await admin<Array<{ kind: string; reason: string; from_at: Date; to_at: Date }>>`
      SELECT kind, reason, lower(period) AS from_at, upper(period) AS to_at
      FROM ooo_oos WHERE id = ${block.id}::uuid
    `;
    expect(stored).toEqual([{
      kind: "ooo",
      reason: "AC compressor replacement",
      from_at: FROM,
      to_at: TO,
    }]);
    const occupancy = await admin<Array<{
      id: string;
      slot_ref: string;
      slot_kind: string;
      space_id: string;
      exclusive: boolean;
      claim: string;
    }>>`
      SELECT id, slot_ref, slot_kind, space_id, exclusive, claim::text
      FROM space_occupancy WHERE slot_ref = ${block.id}::uuid
    `;
    expect(occupancy).toEqual([{
      id: expect.any(String),
      slot_ref: block.id,
      slot_kind: "ooo",
      space_id: SPACE_A,
      exclusive: true,
      claim: "[0,)",
    }]);
    const facts = await admin<Array<{ fact_type: string; payload: Record<string, unknown> }>>`
      SELECT fact_type, payload FROM fact_log
      WHERE entity_type = 'ooo_oos' AND entity_id = ${block.id}::uuid
    `;
    expect(facts).toHaveLength(1);
    expect(facts[0]?.fact_type).toBe("ooo.opened");
    expect(facts[0]?.payload).toMatchObject({ kind: "ooo", space_id: SPACE_A, reason: "AC compressor replacement" });
    const outbox = await admin<Array<{
      event_type: string;
      aggregate_id: string;
      payload: Record<string, unknown>;
    }>>`
      SELECT event_type, aggregate_id, payload FROM outbox
      WHERE correlation_id = (
        SELECT (payload ->> 'request_id')::uuid FROM fact_log
        WHERE entity_type = 'ooo_oos' AND entity_id = ${block.id}::uuid
      )
      ORDER BY seq
    `;
    expect(outbox).toHaveLength(2);
    expect(outbox[0]).toMatchObject({ event_type: "ooo.opened", aggregate_id: block.id });
    expect(outbox[1]).toMatchObject({
      event_type: "occupancy.recorded",
      aggregate_id: occupancy[0]?.id,
      payload: { block_id: block.id, slot_kind: "ooo", space_id: SPACE_A },
    });
  });

  test("P2: OOS open is audited but creates no occupancy claim", async () => {
    const block = await open("oos", "Television replacement");
    const claims = await admin<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM space_occupancy WHERE slot_ref = ${block.id}::uuid
    `;
    expect(claims[0]?.count).toBe(0);
    const facts = await admin<Array<{ fact_type: string }>>`
      SELECT fact_type FROM fact_log WHERE entity_type = 'ooo_oos' AND entity_id = ${block.id}::uuid
    `;
    expect(facts).toEqual([{ fact_type: "ooo.opened" }]);
    const outbox = await admin<Array<{ event_type: string; payload: Record<string, unknown> }>>`
      SELECT event_type, payload FROM outbox WHERE aggregate_id = ${block.id}::uuid ORDER BY seq
    `;
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ event_type: "ooo.opened", payload: { kind: "oos", space_id: SPACE_A } });
  });

  test("P3: close removes only one cause and repeated close adds no evidence", async () => {
    const ooo = await open("ooo", "Water ingress");
    const firstOos = await open("oos", "Minibar fault");
    const secondOos = await open("oos", "Telephone fault");

    await close(firstOos.id);
    expect((await database.withTenantTransaction(TENANT_A, (tx) => blocks.listActive(tx, PROPERTY_A)))
      .map(({ id }) => id).sort()).toEqual([ooo.id, secondOos.id].sort());
    expect((await admin<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM space_occupancy WHERE slot_ref = ${ooo.id}::uuid
    `)[0]?.count).toBe(1);

    await close(ooo.id);
    expect((await admin<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM space_occupancy WHERE slot_ref = ${ooo.id}::uuid
    `)[0]?.count).toBe(0);
    const evidenceBeforeRepeat = await artifactCounts();
    await expect(close(ooo.id)).rejects.toBeInstanceOf(OperationalBlockConflictError);
    expect(await artifactCounts()).toEqual(evidenceBeforeRepeat);

    const events = await admin<Array<{ event_type: string }>>`
      SELECT event_type FROM outbox WHERE aggregate_id = ${ooo.id}::uuid ORDER BY seq
    `;
    expect(events).toEqual([{ event_type: "ooo.opened" }, { event_type: "ooo.closed" }]);
    const occupancyEvents = await admin<Array<{ event_type: string }>>`
      SELECT event_type FROM outbox
      WHERE payload @> ${JSON.stringify({ block_id: ooo.id })}::text::jsonb
        AND event_type LIKE 'occupancy.%'
      ORDER BY seq
    `;
    expect(occupancyEvents).toEqual([
      { event_type: "occupancy.recorded" },
      { event_type: "occupancy.released" },
    ]);
  });

  test("P4: an overlapping real hold makes OOO lose without partial artifacts", async () => {
    const hold = await database.withTenantTransaction(TENANT_A, (tx) => holds.place(tx, {
      sellableUnitId: SELLABLE_A,
      from: FROM,
      to: TO,
      ttlSeconds: 900,
      holder: { order: 37 },
      envelope: envelope("hold.created"),
    }));
    const attempted = envelope("ooo.opened");
    try {
      await expect(database.withTenantTransaction(TENANT_A, (tx) => blocks.open(tx, {
        spaceId: SPACE_A,
        kind: "ooo",
        from: FROM,
        to: TO,
        reason: "Conflict proof",
        envelope: attempted,
      }))).rejects.toBeInstanceOf(OperationalBlockConflictError);
      expect((await admin<Array<{ count: number }>>`
        SELECT count(*)::int AS count FROM ooo_oos WHERE reason = 'Conflict proof'
      `)[0]?.count).toBe(0);
      expect((await admin<Array<{ count: number }>>`
        SELECT count(*)::int AS count FROM fact_log
        WHERE payload @> ${JSON.stringify({ request_id: attempted.requestId })}::text::jsonb
      `)[0]?.count).toBe(0);
      expect((await admin<Array<{ count: number }>>`
        SELECT count(*)::int AS count FROM outbox WHERE correlation_id = ${attempted.requestId}::uuid
      `)[0]?.count).toBe(0);
    } finally {
      await database.withTenantTransaction(TENANT_A, (tx) => holds.release(tx, {
        holdId: hold.id,
        envelope: envelope("hold.released"),
      }));
    }
  });

  test("P5: tenant/property isolation and malformed inputs fail closed", async () => {
    const visible = await open("oos", "Isolation proof");
    expect(await database.withTenantTransaction(TENANT_B, (tx) => blocks.listActive(tx, PROPERTY_A))).toEqual([]);
    expect(await database.withTenantTransaction(TENANT_A, (tx) => blocks.listActive(tx, PROPERTY_A2))).toEqual([]);
    await close(visible.id);
    const baseline = await artifactCounts();

    await expect(database.withTenantTransaction(TENANT_B, (tx) => blocks.open(tx, {
      spaceId: SPACE_A,
      kind: "oos",
      from: FROM,
      to: TO,
      reason: "Foreign tenant",
      envelope: envelope("ooo.opened", TENANT_B, PROPERTY_B),
    }))).rejects.toBeInstanceOf(InventoryNotFoundError);
    await expect(database.withTenantTransaction(TENANT_A, (tx) => blocks.open(tx, {
      spaceId: SPACE_A,
      kind: "oos",
      from: FROM,
      to: TO,
      reason: "Wrong property",
      envelope: envelope("ooo.opened", TENANT_A, PROPERTY_A2),
    }))).rejects.toBeInstanceOf(InventoryNotFoundError);

    const invalid = [
      { spaceId: "not-a-uuid", kind: "ooo" as OperationalBlockKind, from: FROM, to: TO, reason: "Bad id" },
      { spaceId: SPACE_A, kind: "invalid" as OperationalBlockKind, from: FROM, to: TO, reason: "Bad kind" },
      { spaceId: SPACE_A, kind: "ooo" as OperationalBlockKind, from: TO, to: FROM, reason: "Bad dates" },
      { spaceId: SPACE_A, kind: "ooo" as OperationalBlockKind, from: new Date("2025-01-01T00:00:00Z"), to: new Date("2025-01-02T00:00:00Z"), reason: "Expired" },
      { spaceId: SPACE_A, kind: "ooo" as OperationalBlockKind, from: FROM, to: TO, reason: " " },
      { spaceId: SPACE_A, kind: "ooo" as OperationalBlockKind, from: FROM, to: TO, reason: "é".repeat(251) },
    ] as const;
    for (const draft of invalid) {
      await expect(database.withTenantTransaction(TENANT_A, (tx) => blocks.open(tx, {
        ...draft,
        envelope: envelope("ooo.opened"),
      }))).rejects.toBeInstanceOf(InventoryValidationError);
    }
    expect(await artifactCounts()).toEqual(baseline);
  });

  test("P6: second-publish failure rolls every OOO artifact back", async () => {
    const failing = new OperationalBlockService(new FailSecondPublishBus(events));
    const attempted = envelope("ooo.opened");
    await expect(database.withTenantTransaction(TENANT_A, (tx) => failing.open(tx, {
      spaceId: SPACE_A,
      kind: "ooo",
      from: FROM,
      to: TO,
      reason: "Rollback proof",
      envelope: attempted,
    }))).rejects.toThrow("Order 037 injected second-publish failure");
    expect(await artifactCounts()).toEqual({ blocks: 0, occupancies: 0, facts: 0, events: 0 });
  });

  test("P7: twenty concurrent OOO opens have exactly one PostgreSQL winner", async () => {
    const attempts = await Promise.allSettled(Array.from({ length: 20 }, () =>
      database.withTenantTransaction(TENANT_A, (tx) => blocks.open(tx, {
        spaceId: SPACE_A,
        kind: "ooo",
        from: FROM,
        to: TO,
        reason: "Concurrent proof",
        envelope: envelope("ooo.opened"),
      }))));
    const winners = attempts.filter((result) => result.status === "fulfilled");
    const losers = attempts.filter((result) => result.status === "rejected");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(19);
    expect(losers.every((result) => result.status === "rejected" &&
      result.reason instanceof OperationalBlockConflictError)).toBeTrue();
    expect(await artifactCounts()).toEqual({ blocks: 1, occupancies: 1, facts: 1, events: 2 });
  }, 20_000);
});
