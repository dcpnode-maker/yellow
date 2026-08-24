import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  InventoryNotFoundError,
  InventoryPolicyService,
  InventoryValidationError,
  type OosSellability,
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

const DATABASE_URL = process.env.YELLOW_INVENTORY_POLICY_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_INVENTORY_POLICY === "1";
const TENANT_A = "00000000-0000-0000-0000-000000003910";
const TENANT_B = "00000000-0000-0000-0000-000000003911";
const PROPERTY_A = "00000000-0000-0000-0000-000000003920";
const PROPERTY_B = "00000000-0000-0000-0000-000000003921";
const ACTOR = "00000000-0000-0000-0000-000000003930";
const CONFIG_JSON = '{"brand":"yellow","large_counter":900719925474099312345,"inventory":{"housekeeping":"daily"}}';

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_INVENTORY_POLICY_URL is required by the Order 038 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL;
let eventPool: SQL;
let database: Database;
let events: PostgresEventBus;
let policies: InventoryPolicyService;

function envelope(
  operation = "inventory.policy.changed",
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

async function get(propertyNode = PROPERTY_A, tenantId = TENANT_A) {
  return database.withTenantTransaction(tenantId, (tx) => policies.get(tx, propertyNode));
}

async function set(value: OosSellability, customEnvelope = envelope()) {
  return database.withTenantTransaction(customEnvelope.tenantId, (tx) => policies.setOosSellability(tx, {
    value,
    envelope: customEnvelope,
  }));
}

async function evidence() {
  const rows = await admin<Array<{ facts: number; events: number }>>`
    SELECT
      (SELECT count(*)::int FROM fact_log WHERE actor_id = ${ACTOR}::uuid) AS facts,
      (SELECT count(*)::int FROM outbox WHERE actor_id = ${ACTOR}::uuid) AS events
  `;
  return rows[0];
}

class FailingEventBus implements EventBus {
  readonly #delegate: EventBus;

  constructor(delegate: EventBus) {
    this.#delegate = delegate;
  }

  publish(_tx: Tx, _event: PublishEventInput): Promise<OutboxEvent> {
    return Promise.reject(new Error("Order 038 injected publish failure"));
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
  admin = new SQL(DATABASE_URL, { max: 8 });
  eventPool = new SQL(DATABASE_URL, { max: 8 });
  database = Database.connect(DATABASE_URL, { maxConnections: 16 });
  events = new PostgresEventBus(eventPool);
  policies = new InventoryPolicyService(events);

  await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR}::uuid`;
  await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR}::uuid`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order038-a', 'Order 038 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order038-b', 'Order 038 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency, config)
    VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order038_a', 'property', 'Order 038 A', 'UTC', 'USD',
       ${CONFIG_JSON}::text::jsonb),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order038_b', 'property', 'Order 038 B', 'UTC', 'USD', '{}'::jsonb)
  `;
});

beforeEach(async () => {
  if (!DATABASE_URL) return;
  await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR}::uuid`;
  await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR}::uuid`;
  await admin`
    UPDATE org_node
    SET config = ${CONFIG_JSON}::text::jsonb
    WHERE id = ${PROPERTY_A}::uuid
  `;
  await admin`UPDATE org_node SET config = '{}'::jsonb WHERE id = ${PROPERTY_B}::uuid`;
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  await admin`DELETE FROM outbox WHERE actor_id = ${ACTOR}::uuid`;
  await admin`DELETE FROM fact_log WHERE actor_id = ${ACTOR}::uuid`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin.close();
  await eventPool.close();
  await database.close();
});

databaseDescribe("Order 038 per-property OOS sellability policy", () => {
  test("P1: absent policy reads blocked without evidence", async () => {
    expect(await get()).toEqual({ propertyNode: PROPERTY_A, oosSellability: "blocked" });
    expect(await evidence()).toEqual({ facts: 0, events: 0 });
  });

  test("P2: allowed preserves unrelated config and writes exact atomic evidence", async () => {
    expect(await set("allowed")).toEqual({ propertyNode: PROPERTY_A, oosSellability: "allowed" });
    const stored = await admin<Array<{
      brand: string;
      large_counter: string;
      housekeeping: string;
      oos_sellability: string;
    }>>`
      SELECT
        config ->> 'brand' AS brand,
        config ->> 'large_counter' AS large_counter,
        config #>> '{inventory,housekeeping}' AS housekeeping,
        config #>> '{inventory,oos_sellability}' AS oos_sellability
      FROM org_node WHERE id = ${PROPERTY_A}::uuid
    `;
    expect(stored[0]).toEqual({
      brand: "yellow",
      large_counter: "900719925474099312345",
      housekeeping: "daily",
      oos_sellability: "allowed",
    });
    const facts = await admin<Array<{ fact_type: string; payload: Record<string, unknown> }>>`
      SELECT fact_type, payload FROM fact_log WHERE actor_id = ${ACTOR}::uuid
    `;
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      fact_type: "inventory.policy.changed",
      payload: { policy: "oos_sellability", previous: "blocked", value: "allowed" },
    });
    const outbox = await admin<Array<{ event_type: string; aggregate_id: string; payload: Record<string, unknown> }>>`
      SELECT event_type, aggregate_id, payload FROM outbox WHERE actor_id = ${ACTOR}::uuid
    `;
    expect(outbox).toEqual([{
      event_type: "inventory.policy.changed",
      aggregate_id: PROPERTY_A,
      payload: { policy: "oos_sellability", previous: "blocked", value: "allowed" },
    }]);
  });

  test("P3: same effective value is a no-op and a real reversal is evidenced once", async () => {
    await set("allowed");
    const before = await admin<Array<{ config: string }>>`
      SELECT config::text AS config FROM org_node WHERE id = ${PROPERTY_A}::uuid
    `;
    expect(await set("allowed")).toEqual({ propertyNode: PROPERTY_A, oosSellability: "allowed" });
    const after = await admin<Array<{ config: string }>>`
      SELECT config::text AS config FROM org_node WHERE id = ${PROPERTY_A}::uuid
    `;
    expect(after).toEqual(before);
    expect(await evidence()).toEqual({ facts: 1, events: 1 });

    expect(await set("blocked")).toEqual({ propertyNode: PROPERTY_A, oosSellability: "blocked" });
    const transitions = await admin<Array<{ payload: Record<string, unknown> }>>`
      SELECT payload FROM outbox WHERE actor_id = ${ACTOR}::uuid ORDER BY seq
    `;
    expect(transitions.map(({ payload }) => payload)).toEqual([
      { policy: "oos_sellability", previous: "blocked", value: "allowed" },
      { policy: "oos_sellability", previous: "allowed", value: "blocked" },
    ]);
    expect(await evidence()).toEqual({ facts: 2, events: 2 });
  });

  test("P4: publisher failure rolls config and fact back", async () => {
    const failing = new InventoryPolicyService(new FailingEventBus(events));
    await expect(database.withTenantTransaction(TENANT_A, (tx) => failing.setOosSellability(tx, {
      value: "allowed",
      envelope: envelope(),
    }))).rejects.toThrow("Order 038 injected publish failure");
    expect(await get()).toEqual({ propertyNode: PROPERTY_A, oosSellability: "blocked" });
    expect(await evidence()).toEqual({ facts: 0, events: 0 });
  });

  test("P5: tenant, property, value, operation, id, and stored-shape errors fail closed", async () => {
    await expect(get(PROPERTY_A, TENANT_B)).rejects.toBeInstanceOf(InventoryNotFoundError);
    await expect(set("allowed", envelope("inventory.policy.changed", TENANT_A, PROPERTY_B)))
      .rejects.toBeInstanceOf(InventoryNotFoundError);
    await expect(set("warning" as OosSellability)).rejects.toBeInstanceOf(InventoryValidationError);
    await expect(set("allowed", envelope("wrong.operation"))).rejects.toBeInstanceOf(InventoryValidationError);
    await expect(get("not-a-uuid")).rejects.toBeInstanceOf(InventoryValidationError);
    await admin`UPDATE org_node SET config = '[]'::jsonb WHERE id = ${PROPERTY_A}::uuid`;
    await expect(get()).rejects.toBeInstanceOf(InventoryValidationError);
    expect(await evidence()).toEqual({ facts: 0, events: 0 });
  });

  test("P6: opposite concurrent writes form an exact serialized history", async () => {
    const results = await Promise.all([
      set("allowed"),
      set("blocked"),
    ]);
    expect(results.map(({ oosSellability }) => oosSellability).sort()).toEqual(["allowed", "blocked"]);
    const transitions = await admin<Array<{ payload: { policy: string; previous: string; value: string } }>>`
      SELECT payload FROM outbox WHERE actor_id = ${ACTOR}::uuid ORDER BY seq
    `;
    const final = await get();
    if (transitions.length === 1) {
      expect(transitions.map(({ payload }) => payload)).toEqual([
        { policy: "oos_sellability", previous: "blocked", value: "allowed" },
      ]);
      expect(final.oosSellability).toBe("allowed");
    } else {
      expect(transitions.map(({ payload }) => payload)).toEqual([
        { policy: "oos_sellability", previous: "blocked", value: "allowed" },
        { policy: "oos_sellability", previous: "allowed", value: "blocked" },
      ]);
      expect(final.oosSellability).toBe("blocked");
    }
    expect(await evidence()).toEqual({ facts: transitions.length, events: transitions.length });
  });
});
