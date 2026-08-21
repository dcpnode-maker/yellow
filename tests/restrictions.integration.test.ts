import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  InventoryNotFoundError,
  InventoryValidationError,
  RestrictionService,
  type Restriction,
} from "../src/contexts/inventory";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  type EventBus,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_RESTRICTION_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESTRICTION === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const PROPERTY_A = "00000000-0000-0000-0000-000000000012";
const UNIT_TYPE_A = "00000000-0000-0000-0000-000000000300";
const RATE_PLAN_A = "00000000-0000-0000-0000-000000000600";
const TENANT_B = "00000000-0000-0000-0000-000000003502";
const PROPERTY_B = "00000000-0000-0000-0000-000000003512";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000003513";
const ACTOR_A = "00000000-0000-0000-0000-000000003560";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RESTRICTION_URL is required by the Order 035 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL;
let eventPool: SQL;
let database: Database;
let service: RestrictionService;
let canonicalBatch: readonly Restriction[] = [];
let baselineSnapshot: Array<{ id: string; row_text: string }> = [];
const aggregateIds = new Set<string>();

function envelope(propertyNode = PROPERTY_A) {
  return createAuditEnvelope({
    actorId: ACTOR_A,
    tenantId: TENANT_A,
    propertyNode,
    requestId: crypto.randomUUID(),
    operation: "restriction.created",
  });
}

class FailOnSecondEventBus implements EventBus {
  #calls = 0;
  readonly #delegate: EventBus;

  constructor(delegate: EventBus) {
    this.#delegate = delegate;
  }

  async publish(tx: Tx, event: PublishEventInput) {
    this.#calls += 1;
    if (this.#calls === 2) throw new Error("injected second publisher failure");
    return this.#delegate.publish(tx, event);
  }

  async consumeBatch(): Promise<never> {
    throw new Error("not used");
  }
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 8 });
  database = Database.connect(DATABASE_URL, { maxConnections: 8 });
  service = new RestrictionService(new PostgresEventBus(eventPool));
  const stale = await admin<Array<{ entity_id: string }>>`
    SELECT entity_id FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid AND entity_type = 'restriction'
  `;
  const staleIds = stale.map(({ entity_id }) => entity_id);
  if (staleIds.length > 0) {
    await admin`DELETE FROM outbox WHERE aggregate_id IN ${admin(staleIds)}`;
    await admin`DELETE FROM fact_log WHERE entity_id IN ${admin(staleIds)}`;
    await admin`DELETE FROM restriction WHERE id IN ${admin(staleIds)}`;
  }
  await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR_A}::uuid`;
  await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id = ${TENANT_B}::uuid`;
  baselineSnapshot = await admin<Array<{ id: string; row_text: string }>>`
    SELECT id, row_to_json(restriction.*)::text AS row_text FROM restriction ORDER BY id
  `;
  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${TENANT_B}::uuid, 'order035-b', 'Order 035 Tenant B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A2}::uuid, ${TENANT_A}::uuid, 'order035_property_a2', 'property', 'Order 035 Property A2', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order035_property_b', 'property', 'Order 035 Property B', 'UTC', 'USD')
  `;
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  const ids = [...aggregateIds];
  if (ids.length > 0) {
    await admin`DELETE FROM outbox WHERE aggregate_id IN ${admin(ids)}`;
    await admin`DELETE FROM fact_log WHERE entity_id IN ${admin(ids)}`;
    await admin`DELETE FROM restriction WHERE id IN ${admin(ids)}`;
  }
  await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR_A}::uuid`;
  await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id = ${TENANT_B}::uuid`;
  await admin.close();
  await eventPool.close();
  await database.close();
});

databaseDescribe("Order 035 atomic property restriction configuration", () => {
  test("P1: mixed batch commits exact rows, facts, and events atomically", async () => {
    canonicalBatch = await database.withTenantTransaction(TENANT_A, (tx) => service.createBatch(tx, {
      restrictions: [
        { kind: "closed", stayStart: "2038-01-01", stayEnd: "2038-01-05" },
        { kind: "min_los", value: 3, unitTypeId: UNIT_TYPE_A, stayStart: "2038-01-01", stayEnd: "2038-02-01" },
        { kind: "max_adv", value: 365, ratePlanId: RATE_PLAN_A, channelCode: "DIRECT", stayStart: "2038-01-01", stayEnd: "2039-01-01" },
      ],
      envelope: envelope(),
    }));
    for (const row of canonicalBatch) aggregateIds.add(row.id);
    expect(canonicalBatch.map(({ kind, value, source }) => ({ kind, value, source }))).toEqual([
      { kind: "closed", value: null, source: "manual" },
      { kind: "min_los", value: 3, source: "manual" },
      { kind: "max_adv", value: 365, source: "manual" },
    ]);
    expect(canonicalBatch.every(({ stayStart }) => stayStart === "2038-01-01")).toBeTrue();
    const ids = canonicalBatch.map(({ id }) => id);
    const evidence = await admin<Array<{ facts: number; events: number; changed: number }>>`
      SELECT
        (SELECT count(*)::int FROM fact_log WHERE entity_id IN ${admin(ids)}) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id IN ${admin(ids)}) AS events,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id IN ${admin(ids)} AND event_type = 'restriction.changed' AND payload @> '{"action":"created"}'::jsonb) AS changed
    `;
    expect(evidence[0]).toEqual({ facts: 3, events: 3, changed: 3 });
  });

  test("P2: filters and deterministic ordering preserve exact scope", async () => {
    const all = await database.withTenantTransaction(TENANT_A, (tx) => service.list(tx, PROPERTY_A));
    const ours = all.filter(({ id }) => aggregateIds.has(id));
    expect(ours.map(({ kind }) => kind)).toEqual(["closed", "min_los", "max_adv"]);
    const unit = await database.withTenantTransaction(TENANT_A, (tx) => service.list(tx, PROPERTY_A, { unitTypeId: UNIT_TYPE_A }));
    expect(unit.filter(({ id }) => aggregateIds.has(id)).map(({ kind }) => kind)).toEqual(["min_los"]);
    const plan = await database.withTenantTransaction(TENANT_A, (tx) => service.list(tx, PROPERTY_A, { ratePlanId: RATE_PLAN_A }));
    expect(plan.filter(({ id }) => aggregateIds.has(id)).map(({ kind }) => kind)).toEqual(["max_adv"]);
  });

  test("P3: malformed and foreign references fail without partial artifacts", async () => {
    const before = await admin<Array<{ rows: number; facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM restriction WHERE scope_node = ${PROPERTY_A}::uuid) AS rows,
        (SELECT count(*)::int FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE actor_id = ${ACTOR_A}::uuid) AS events
    `;
    const invalidBatches = [
      [{ kind: "closed", value: 1, stayStart: "2038-03-01", stayEnd: "2038-03-02" }],
      [{ kind: "min_los", value: 0, stayStart: "2038-03-01", stayEnd: "2038-03-02" }],
      [{ kind: "cta", stayStart: "2038-03-02", stayEnd: "2038-03-02" }],
      [{ kind: "ctd", channelCode: " bad ", stayStart: "2038-03-01", stayEnd: "2038-03-02" }],
      [{ kind: "closed", stayStart: "2038-02-30", stayEnd: "2038-03-02" }],
    ] as const;
    for (const restrictions of invalidBatches) {
      await expect(database.withTenantTransaction(TENANT_A, (tx) => service.createBatch(tx, {
        restrictions: restrictions as never,
        envelope: envelope(),
      }))).rejects.toBeInstanceOf(InventoryValidationError);
    }
    await expect(database.withTenantTransaction(TENANT_A, (tx) => service.createBatch(tx, {
      restrictions: [{ kind: "closed", unitTypeId: "00000000-0000-0000-0000-000000003530", stayStart: "2038-03-01", stayEnd: "2038-03-02" }],
      envelope: envelope(),
    }))).rejects.toBeInstanceOf(InventoryNotFoundError);
    await expect(database.withTenantTransaction(TENANT_A, (tx) => service.createBatch(tx, {
      restrictions: [{ kind: "closed", ratePlanId: "00000000-0000-0000-0000-000000003540", stayStart: "2038-03-01", stayEnd: "2038-03-02" }],
      envelope: envelope(),
    }))).rejects.toBeInstanceOf(InventoryNotFoundError);
    const after = await admin<Array<{ rows: number; facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM restriction WHERE scope_node = ${PROPERTY_A}::uuid) AS rows,
        (SELECT count(*)::int FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE actor_id = ${ACTOR_A}::uuid) AS events
    `;
    expect(after[0]).toEqual(before[0]);
  });

  test("P4: a later publisher failure rolls the whole batch back", async () => {
    const failing = new RestrictionService(new FailOnSecondEventBus(new PostgresEventBus(eventPool)));
    await expect(database.withTenantTransaction(TENANT_A, (tx) => failing.createBatch(tx, {
      restrictions: [
        { kind: "cta", stayStart: "2038-04-01", stayEnd: "2038-04-02" },
        { kind: "ctd", stayStart: "2038-04-02", stayEnd: "2038-04-03" },
      ],
      envelope: envelope(),
    }))).rejects.toThrow("injected second publisher failure");
    const rows = await admin<Array<{ rows: number; facts: number }>>`
      SELECT
        (SELECT count(*)::int FROM restriction WHERE lower(stay_dates) IN ('2038-04-01'::date, '2038-04-02'::date)) AS rows,
        (SELECT count(*)::int FROM fact_log WHERE payload @> '{"stay_start":"2038-04-01"}'::jsonb OR payload @> '{"stay_start":"2038-04-02"}'::jsonb) AS facts
    `;
    expect(rows[0]).toEqual({ rows: 0, facts: 0 });
  });

  test("P5: tenant and property list boundaries reveal no foreign rows", async () => {
    const tenantB = await database.withTenantTransaction(TENANT_B, (tx) => service.list(tx, PROPERTY_A));
    const propertyA2 = await database.withTenantTransaction(TENANT_A, (tx) => service.list(tx, PROPERTY_A2));
    expect(tenantB).toEqual([]);
    expect(propertyA2).toEqual([]);
  });

  test("P6: every pre-existing restriction remains byte-equivalent", async () => {
    if (baselineSnapshot.length === 0) {
      expect(baselineSnapshot).toEqual([]);
      return;
    }
    const current = await admin<Array<{ id: string; row_text: string }>>`
      SELECT id, row_to_json(restriction.*)::text AS row_text
      FROM restriction WHERE id IN ${admin(baselineSnapshot.map(({ id }) => id))} ORDER BY id
    `;
    expect(current).toEqual(baselineSnapshot);
  });
});
