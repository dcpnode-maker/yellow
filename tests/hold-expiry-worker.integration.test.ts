import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  HOLD_EXPIRY_ACTOR_ID,
  HoldExpiryWorker,
  type DueHoldScope,
  type DueHoldScopeSource,
} from "../src/contexts/inventory";
import { HoldService } from "../src/contexts/inventory";
import { PostgresDueHoldScopeSource } from "../src/workers/postgres-due-hold-scopes";
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
import { runReviewSeed } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_HOLD_EXPIRY_URL;
const PASSWORD = process.env.YELLOW_HOLD_EXPIRY_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_HOLD_EXPIRY === "1";
const TENANT_B = "00000000-0000-0000-0000-000000005602";
const PROPERTY_B = "00000000-0000-0000-0000-000000005612";
const UNIT_TYPE_B = "00000000-0000-0000-0000-000000005622";
const SPACE_B = "00000000-0000-0000-0000-000000005632";
const SELLABLE_B = "00000000-0000-0000-0000-000000005642";
const ACTOR_A = "00000000-0000-0000-0000-000000005650";
const ACTOR_B = "00000000-0000-0000-0000-000000005651";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_HOLD_EXPIRY_URL and YELLOW_HOLD_EXPIRY_PASSWORD are required by Order 056");
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let eventPool: SQL;
let database: Database;
let events: PostgresEventBus;
let holds: HoldService;
let source: PostgresDueHoldScopeSource;
let sellables: Record<string, string> = {};

function envelope(tenantId: string, propertyNode: string, actorId: string, operation: "hold.created" | "hold.expired") {
  return createAuditEnvelope({ tenantId, propertyNode, actorId, requestId: crypto.randomUUID(), operation });
}

function period(offset: number) {
  return {
    from: new Date(Date.UTC(2047, 0, 10 + offset, 12)),
    to: new Date(Date.UTC(2047, 0, 12 + offset, 12)),
  };
}

async function place(
  sellableUnitId: string,
  offset: number,
  tenantId: string = SEED_TENANT.id,
  propertyNode: string = SEED_PROPERTY.id,
  actorId: string = ACTOR_A,
) {
  return database.withTenantTransaction(tenantId, (tx) => holds.place(tx, {
    sellableUnitId, ...period(offset), ttlSeconds: 900,
    holder: { reference: `Order 056 ${offset}` },
    envelope: envelope(tenantId, propertyNode, actorId, "hold.created"),
  }));
}

async function makeDue(id: string): Promise<void> {
  await admin`UPDATE hold SET expires_at=transaction_timestamp()-interval '1 second' WHERE id=${id}::uuid`;
}

function worker(workerHolds: HoldService = holds, workerSource: DueHoldScopeSource = source) {
  return new HoldExpiryWorker(database, workerHolds, workerSource, {
    actorId: HOLD_EXPIRY_ACTOR_ID, pollIntervalMs: 100, scopeBatchSize: 20, holdBatchSize: 20,
  });
}

class FailExpiryBus implements EventBus {
  constructor(readonly delegate: EventBus) {}
  publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    if (event.eventType === "hold.expired") throw new Error("Order 056 injected expiry publish failure");
    return this.delegate.publish(tx, event);
  }
  consumeBatch(consumer: string, handler: EventHandler, options?: ConsumeBatchOptions): Promise<ConsumeBatchResult> {
    return this.delegate.consumeBatch(consumer, handler, options);
  }
}

class StaticSource implements DueHoldScopeSource {
  constructor(readonly scopes: readonly DueHoldScope[]) {}
  async listDueScopes(): Promise<readonly DueHoldScope[]> { return this.scopes; }
}

class TransientSource implements DueHoldScopeSource {
  calls = 0;
  constructor(readonly delegate: DueHoldScopeSource) {}
  listDueScopes(limit: number): Promise<readonly DueHoldScope[]> {
    this.calls += 1;
    if (this.calls === 1) return Promise.reject(new Error("Order 056 transient discovery failure"));
    return this.delegate.listDueScopes(limit);
  }
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger() {} });
  await runReviewSeed({ databaseUrl: DATABASE_URL, password: PASSWORD, logger() {} });
  admin = new SQL(DATABASE_URL, { max: 12 });
  eventPool = new SQL(DATABASE_URL, { max: 16 });
  database = Database.connect(DATABASE_URL, { maxConnections: 32 });
  events = new PostgresEventBus(eventPool);
  holds = new HoldService(events);
  source = new PostgresDueHoldScopeSource(admin);
  const rows = await admin<Array<{ name: string; id: string }>>`
    SELECT name, id FROM sellable_unit WHERE tenant_id=${SEED_TENANT.id}::uuid ORDER BY name
  `;
  sellables = Object.fromEntries(rows.map(({ name, id }) => [name, id]));
  await admin`INSERT INTO tenant (id,slug,name,tier,status)
    VALUES (${TENANT_B}::uuid,'order-056-b','Order 056 B','shared','active')`;
  await admin`INSERT INTO org_node (id,tenant_id,path,kind,name,timezone,currency)
    VALUES (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order_056_b','property','Order 056 B','UTC','USD')`;
  await admin`INSERT INTO unit_type (id,tenant_id,property_node,code,name,profile_key)
    VALUES (${UNIT_TYPE_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'O56B','Order 056 B','hotel')`;
  await admin`INSERT INTO space (id,tenant_id,property_node,code,profile_key,capacity)
    VALUES (${SPACE_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'O56B','hotel',1)`;
  await admin`INSERT INTO sellable_unit (id,tenant_id,unit_type_id,name)
    VALUES (${SELLABLE_B}::uuid,${TENANT_B}::uuid,${UNIT_TYPE_B}::uuid,'Order 056 B')`;
  await admin`INSERT INTO sellable_unit_space (tenant_id,sellable_unit_id,space_id,claim_mode)
    VALUES (${TENANT_B}::uuid,${SELLABLE_B}::uuid,${SPACE_B}::uuid,'exclusive')`;
});

afterAll(async () => {
  await database?.close();
  await eventPool?.close();
  await admin?.close();
});

databaseDescribe("Order 056 audited hold-expiry worker", () => {
  test("P1: due expiry releases exact occupancy and evidence while future hold is unchanged", async () => {
    const due = await place(sellables["Room 101"]!, 0);
    const future = await place(sellables["Room 102"]!, 0);
    await makeDue(due.id);
    const result = await worker().drainOnce();
    expect(result).toEqual({ scopes: 1, expired: 1, failures: [] });
    const rows = await admin<Array<{ id: string; status: string; claims: number; facts: number; events: string[] }>>`
      SELECT h.id,h.status,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=h.id) claims,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=h.id) facts,
        (SELECT array_agg(event_type ORDER BY event_type) FROM outbox
          WHERE aggregate_id=h.id OR payload @> jsonb_build_object('hold_id',h.id)) events
      FROM hold h WHERE h.id IN (${due.id}::uuid,${future.id}::uuid) ORDER BY h.id
    `;
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(due.id)).toEqual({ id: due.id, status: "expired", claims: 0, facts: 2,
      events: ["hold.created", "hold.expired", "occupancy.recorded", "occupancy.released"] });
    expect(byId.get(future.id)).toEqual({ id: future.id, status: "active", claims: 1, facts: 1,
      events: ["hold.created", "occupancy.recorded"] });
  });

  test("P2: deploy discovery is scope-only while two tenants expire under RLS context", async () => {
    const dueA = await place(sellables["Room 103"]!, 10);
    const dueB = await place(SELLABLE_B, 10, TENANT_B, PROPERTY_B, ACTOR_B);
    await makeDue(dueA.id); await makeDue(dueB.id);
    const scopes = await source.listDueScopes(20);
    expect(scopes).toEqual([
      { tenantId: SEED_TENANT.id, propertyNode: SEED_PROPERTY.id },
      { tenantId: TENANT_B, propertyNode: PROPERTY_B },
    ]);
    expect(Object.keys(scopes[0] ?? {}).sort()).toEqual(["propertyNode", "tenantId"]);
    const connection = await admin.reserve();
    try {
      await connection.unsafe("BEGIN");
      await connection.unsafe("SET LOCAL ROLE app_role");
      const invisible = await connection<Array<{ count: number }>>`SELECT count(*)::int count FROM hold`;
      expect(invisible).toEqual([{ count: 0 }]);
      await connection.unsafe("ROLLBACK");
    } finally { connection.release(); }
    expect(await worker().drainOnce()).toEqual({ scopes: 2, expired: 2, failures: [] });
    const states = await admin<Array<{ tenant_id: string; status: string; claims: number }>>`
      SELECT tenant_id,status,(SELECT count(*)::int FROM space_occupancy WHERE slot_ref=hold.id) claims
      FROM hold WHERE id IN (${dueA.id}::uuid,${dueB.id}::uuid) ORDER BY tenant_id
    `;
    expect(states).toEqual([
      { tenant_id: TENANT_B, status: "expired", claims: 0 },
      { tenant_id: SEED_TENANT.id, status: "expired", claims: 0 },
    ]);
  });

  test("P3: concurrent workers transition once and publisher rollback remains retryable", async () => {
    const due = await place(sellables["Room 201"]!, 20);
    await makeDue(due.id);
    const failing = worker(new HoldService(new FailExpiryBus(events)));
    const failed = await failing.drainOnce();
    expect(failed.scopes).toBe(1); expect(failed.expired).toBe(0); expect(failed.failures).toHaveLength(1);
    const rolled = await admin<Array<{ status: string; claims: number; facts: number }>>`
      SELECT status,(SELECT count(*)::int FROM space_occupancy WHERE slot_ref=hold.id) claims,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=hold.id) facts FROM hold WHERE id=${due.id}::uuid
    `;
    expect(rolled).toEqual([{ status: "active", claims: 1, facts: 1 }]);
    const [left, right] = await Promise.all([worker().drainOnce(), worker().drainOnce()]);
    expect(left.expired + right.expired).toBe(1);
    const evidence = await admin<Array<{ status: string; claims: number; facts: number; expired_events: number }>>`
      SELECT status,(SELECT count(*)::int FROM space_occupancy WHERE slot_ref=hold.id) claims,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=hold.id) facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=hold.id AND event_type='hold.expired') expired_events
      FROM hold WHERE id=${due.id}::uuid
    `;
    expect(evidence).toEqual([{ status: "expired", claims: 0, facts: 2, expired_events: 1 }]);
  });

  test("P4: a bad first scope is reported and does not block a later valid scope", async () => {
    const due = await place(sellables["Room 202"]!, 30);
    await makeDue(due.id);
    const result = await worker(holds, new StaticSource([
      { tenantId: "not-a-uuid", propertyNode: SEED_PROPERTY.id },
      { tenantId: SEED_TENANT.id, propertyNode: SEED_PROPERTY.id },
    ])).drainOnce();
    expect(result.scopes).toBe(2); expect(result.expired).toBe(1); expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ tenantId: "not-a-uuid", propertyNode: SEED_PROPERTY.id });
    expect(await admin<Array<{ status: string }>>`SELECT status FROM hold WHERE id=${due.id}::uuid`)
      .toEqual([{ status: "expired" }]);
  });

  test("P5: transient discovery recovers on the next poll and abort stops the loop", async () => {
    const due = await place(sellables["Room 101"]!, 40);
    await makeDue(due.id);
    const transient = new TransientSource(source);
    const controller = new AbortController();
    const errors: string[] = [];
    const results: number[] = [];
    await Promise.race([
      worker(holds, transient).run({ signal: controller.signal,
        onError(error) { errors.push(error instanceof Error ? error.message : String(error)); },
        onResult(result) { results.push(result.expired); if (result.expired === 1) controller.abort(); },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Order 056 worker did not stop")), 1_000)),
    ]);
    expect(errors).toEqual(["Order 056 transient discovery failure"]);
    expect(results).toContain(1); expect(transient.calls).toBeGreaterThanOrEqual(2);
  });

  test("P6/P7: options and runtime are bounded, doubly opt-in and expose no expiry shortcut", async () => {
    expect(() => new HoldExpiryWorker(database, holds, source, { pollIntervalMs: 99 })).toThrow();
    expect(() => new HoldExpiryWorker(database, holds, source, { scopeBatchSize: 0 })).toThrow();
    expect(() => new HoldExpiryWorker(database, holds, source, { holdBatchSize: 101 })).toThrow();
    await expect(new HoldExpiryWorker(database, holds, new StaticSource([
      { tenantId: SEED_TENANT.id, propertyNode: SEED_PROPERTY.id },
      { tenantId: TENANT_B, propertyNode: PROPERTY_B },
    ]), { scopeBatchSize: 1 }).drainOnce()).rejects.toThrow("exceeded its requested limit");
    const server = await Bun.file(new URL("../src/server.ts", import.meta.url)).text();
    const compose = await Bun.file(new URL("../docker-compose.yml", import.meta.url)).text();
    const workerSource = await Bun.file(new URL("../src/workers/postgres-due-hold-scopes.ts", import.meta.url)).text();
    expect(server).toContain('workbenchEnabled && Bun.env.YELLOW_HOLD_EXPIRY_WORKER === "1"');
    expect(compose).toContain('YELLOW_HOLD_EXPIRY_WORKER: "${YELLOW_HOLD_EXPIRY_WORKER:-1}"');
    expect(workerSource).toContain("SELECT tenant_id, property_node");
    expect(workerSource).not.toMatch(/holder|space_occupancy|record_occupancy|release_occupancy|expire_holds/i);
  });
});
