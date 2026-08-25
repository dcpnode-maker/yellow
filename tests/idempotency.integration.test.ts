import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  createAuditEnvelope,
  Database,
  IdempotencyConflictError,
  IdempotencyValidationError,
  PostgresIdempotency,
  recordFact,
  type JsonValue,
} from "../src/kernel";

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_IDEMPOTENCY_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL ?? process.env.YELLOW_IDEMPOTENCY_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_IDEMPOTENCY === "1";
const TENANT_A = "00000000-0000-0000-0000-000000004710";
const TENANT_B = "00000000-0000-0000-0000-000000004711";
const PROPERTY_A = "00000000-0000-0000-0000-000000004720";
const PROPERTY_B = "00000000-0000-0000-0000-000000004721";
const ACTOR_A = "00000000-0000-0000-0000-000000004730";
const ACTOR_B = "00000000-0000-0000-0000-000000004731";
const NOW = new Date("2030-01-02T03:04:05.000Z");

if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error("YELLOW_IDEMPOTENCY_URL is required by the Order 047 proof");
}

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL;
let database: Database;

function subject(suffix: number): string {
  return `00000000-0000-0000-0000-${suffix.toString().padStart(12, "0")}`;
}

async function cleanFixtures(): Promise<void> {
  await admin`DELETE FROM api_idempotency WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM fact_log WHERE actor_id IN (${ACTOR_A}::uuid, ${ACTOR_B}::uuid)`;
  await admin`DELETE FROM app_user WHERE id IN (${ACTOR_A}::uuid, ${ACTOR_B}::uuid)`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
}

beforeAll(async () => {
  if (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL) return;
  admin = new SQL(DEPLOY_DATABASE_URL, { max: 4 });
  database = Database.connect(RUNTIME_DATABASE_URL, { maxConnections: 24 });
  await cleanFixtures();
  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order047-a', 'Order 047 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order047-b', 'Order 047 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order047_a', 'property', 'Order 047 A', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order047_b', 'property', 'Order 047 B', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO app_user (id, tenant_id, email, display_name, auth, status)
    VALUES
      (${ACTOR_A}::uuid, ${TENANT_A}::uuid, 'a@order047.test', 'Order 047 A', '{}'::jsonb, 'active'),
      (${ACTOR_B}::uuid, ${TENANT_B}::uuid, 'b@order047.test', 'Order 047 B', '{}'::jsonb, 'active')
  `;
});

afterAll(async () => {
  if (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL) return;
  await cleanFixtures();
  await database.close();
  await admin.close();
});

function factCallback(
  tenantId: string,
  propertyNode: string,
  actorId: string,
  entityId: string,
  body: JsonValue,
  status = 201,
): Parameters<PostgresIdempotency["execute"]>[2] {
  return async (tx) => {
    await recordFact(tx, {
      entityType: "idempotency_probe",
      entityId,
      envelope: createAuditEnvelope({
        tenantId,
        propertyNode,
        actorId,
        requestId: crypto.randomUUID(),
        operation: "idempotency_probe.created",
      }),
      payload: { order: 47 },
    });
    return { status, body };
  };
}

databaseDescribe("Order 047 durable API idempotency", () => {
  test("P1: first execution stores hashed identity and atomically commits its fact", async () => {
    const service = new PostgresIdempotency({ now: () => NOW });
    const rawKey = "order047-first-raw-key";
    const entityId = subject(471001);
    const result = await database.withTenantTransaction(TENANT_A, (tx) =>
      service.execute(tx, {
        tenantId: TENANT_A,
        operation: "inventory.unit_type.create",
        key: rawKey,
        request: { z: 1, nested: { second: true, first: "a" } },
      }, factCallback(TENANT_A, PROPERTY_A, ACTOR_A, entityId, { id: entityId, created: true })),
    );
    expect(result).toEqual({ status: 201, body: { id: entityId, created: true }, replayed: false });

    const rows = await admin<Array<{
      key_hash: string; request_hash: string; response_status: number;
      response_body: JsonValue; created_at: Date; completed_at: Date; expires_at: Date;
      serialized: string;
    }>>`
      SELECT key_hash, request_hash, response_status, response_body, created_at,
             completed_at, expires_at, to_jsonb(api_idempotency)::text AS serialized
      FROM api_idempotency
      WHERE tenant_id = ${TENANT_A}::uuid AND operation = 'inventory.unit_type.create'
    `;
    expect(rows).toHaveLength(1);
    const row = rows[0];
    if (!row) throw new Error("P1 idempotency record was not returned");
    expect(row.key_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.request_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.serialized).not.toContain(rawKey);
    expect(row.response_status).toBe(201);
    expect(row.response_body).toEqual({ id: entityId, created: true });
    expect(row.created_at.getTime()).toBe(NOW.getTime());
    expect(row.completed_at.getTime()).toBe(NOW.getTime());
    expect(row.expires_at.getTime() - row.created_at.getTime()).toBe(86_400_000);
    expect((await admin`SELECT id FROM fact_log WHERE entity_id = ${entityId}::uuid`)).toHaveLength(1);
  });

  test("P2: sequential and twenty-way concurrent retries execute once", async () => {
    const service = new PostgresIdempotency({ now: () => NOW });
    const sequentialEntity = subject(471002);
    let sequentialCalls = 0;
    const executeSequential = (request: JsonValue) => database.withTenantTransaction(TENANT_A, (tx) =>
      service.execute(tx, {
        tenantId: TENANT_A,
        operation: "inventory.space.create",
        key: "order047-sequential-key",
        request,
      }, async (innerTx) => {
        sequentialCalls += 1;
        return factCallback(TENANT_A, PROPERTY_A, ACTOR_A, sequentialEntity, {
          id: sequentialEntity, code: "A1",
        })(innerTx);
      }),
    );
    const first = await executeSequential({ code: "A1", attrs: { b: 2, a: 1 } });
    const replay = await executeSequential({ attrs: { a: 1, b: 2 }, code: "A1" });
    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ ...first, replayed: true });
    expect(sequentialCalls).toBe(1);

    let nullCalls = 0;
    const executeNull = () => database.withTenantTransaction(TENANT_A, (tx) =>
      service.execute(tx, {
        tenantId: TENANT_A,
        operation: "inventory.null.create",
        key: "order047-null-response",
        request: {},
      }, async () => {
        nullCalls += 1;
        return { status: 204, body: null };
      }),
    );
    expect(await executeNull()).toEqual({ status: 204, body: null, replayed: false });
    expect(await executeNull()).toEqual({ status: 204, body: null, replayed: true });
    expect(nullCalls).toBe(1);

    const concurrentEntity = subject(471003);
    let concurrentCalls = 0;
    const results = await Promise.all(Array.from({ length: 20 }, () =>
      database.withTenantTransaction(TENANT_A, (tx) =>
        service.execute(tx, {
          tenantId: TENANT_A,
          operation: "inventory.sellable_unit.create",
          key: "order047-concurrent-key",
          request: { name: "Room 47", spaces: ["A1"] },
        }, async (innerTx) => {
          concurrentCalls += 1;
          await innerTx`SELECT pg_sleep(0.05)`;
          return factCallback(TENANT_A, PROPERTY_A, ACTOR_A, concurrentEntity, {
            id: concurrentEntity, name: "Room 47",
          })(innerTx);
        }),
      ),
    ));
    expect(concurrentCalls).toBe(1);
    expect(results.filter(({ replayed }) => !replayed)).toHaveLength(1);
    expect(new Set(results.map(({ body }) => JSON.stringify(body)))).toEqual(new Set([
      JSON.stringify({ id: concurrentEntity, name: "Room 47" }),
    ]));
    expect((await admin`SELECT id FROM fact_log WHERE entity_id = ${concurrentEntity}::uuid`)).toHaveLength(1);
  });

  test("P3: changed requests conflict and invalid keys or JSON never persist", async () => {
    const service = new PostgresIdempotency({ now: () => NOW });
    const entityId = subject(471004);
    await database.withTenantTransaction(TENANT_A, (tx) =>
      service.execute(tx, {
        tenantId: TENANT_A,
        operation: "inventory.unit_type.create",
        key: "order047-conflict-key",
        request: { code: "STD", occupancy: { max: 2, base: 1 } },
      }, factCallback(TENANT_A, PROPERTY_A, ACTOR_A, entityId, { id: entityId })),
    );

    let changedCalls = 0;
    await expect(database.withTenantTransaction(TENANT_A, (tx) =>
      service.execute(tx, {
        tenantId: TENANT_A,
        operation: "inventory.unit_type.create",
        key: "order047-conflict-key",
        request: { occupancy: { base: 1, max: 3 }, code: "STD" },
      }, async () => {
        changedCalls += 1;
        return { status: 201, body: { impossible: true } };
      }),
    )).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(changedCalls).toBe(0);

    const invalid: Array<{ key: string; request: unknown }> = [
      { key: "", request: {} },
      { key: "short", request: {} },
      { key: "x".repeat(201), request: {} },
      { key: "contains\ncontrol", request: {} },
      { key: "order047-invalid-nan", request: { value: Number.NaN } },
      { key: "order047-invalid-undefined", request: { value: undefined } },
      { key: "order047-invalid-date", request: { value: new Date() } },
    ];
    for (const item of invalid) {
      await expect(database.withTenantTransaction(TENANT_A, (tx) =>
        service.execute(tx, {
          tenantId: TENANT_A,
          operation: "inventory.invalid.create",
          key: item.key,
          request: item.request as JsonValue,
        }, async () => ({ status: 201, body: {} })),
      )).rejects.toBeInstanceOf(IdempotencyValidationError);
    }
    await expect(database.withTenantTransaction(TENANT_A, (tx) =>
      service.execute(tx, {
        tenantId: TENANT_A,
        operation: "inventory.invalid.create",
        key: "order047-invalid-response",
        request: {},
      }, async () => ({ status: 201, body: { value: Number.POSITIVE_INFINITY } as unknown as JsonValue })),
    )).rejects.toBeInstanceOf(IdempotencyValidationError);
    expect(await admin`SELECT key_hash FROM api_idempotency WHERE operation = 'inventory.invalid.create'`).toHaveLength(0);
  });

  test("P4: callback failure rolls back and expiry permits a new request", async () => {
    const service = new PostgresIdempotency({ now: () => NOW });
    const failedEntity = subject(471005);
    await expect(database.withTenantTransaction(TENANT_A, (tx) =>
      service.execute(tx, {
        tenantId: TENANT_A,
        operation: "inventory.rollback.create",
        key: "order047-rollback-key",
        request: { attempt: 1 },
      }, async (innerTx) => {
        await factCallback(TENANT_A, PROPERTY_A, ACTOR_A, failedEntity, {})(innerTx);
        throw new Error("injected command failure");
      }),
    )).rejects.toThrow("injected command failure");
    expect(await admin`SELECT id FROM fact_log WHERE entity_id = ${failedEntity}::uuid`).toHaveLength(0);
    expect(await admin`SELECT key_hash FROM api_idempotency WHERE operation = 'inventory.rollback.create'`).toHaveLength(0);

    const recovered = await database.withTenantTransaction(TENANT_A, (tx) =>
      service.execute(tx, {
        tenantId: TENANT_A,
        operation: "inventory.rollback.create",
        key: "order047-rollback-key",
        request: { attempt: 1 },
      }, factCallback(TENANT_A, PROPERTY_A, ACTOR_A, failedEntity, { recovered: true })),
    );
    expect(recovered).toMatchObject({ body: { recovered: true }, replayed: false });

    const firstEntity = subject(471006);
    const reusedEntity = subject(471007);
    await database.withTenantTransaction(TENANT_A, (tx) =>
      service.execute(tx, {
        tenantId: TENANT_A,
        operation: "inventory.expiry.create",
        key: "order047-expiry-key",
        request: { version: 1 },
      }, factCallback(TENANT_A, PROPERTY_A, ACTOR_A, firstEntity, { version: 1 })),
    );
    const afterExpiry = new PostgresIdempotency({ now: () => new Date(NOW.getTime() + 86_400_001) });
    const reused = await database.withTenantTransaction(TENANT_A, (tx) =>
      afterExpiry.execute(tx, {
        tenantId: TENANT_A,
        operation: "inventory.expiry.create",
        key: "order047-expiry-key",
        request: { version: 2 },
      }, factCallback(TENANT_A, PROPERTY_A, ACTOR_A, reusedEntity, { version: 2 })),
    );
    expect(reused).toEqual({ status: 201, body: { version: 2 }, replayed: false });
    expect((await admin`SELECT id FROM fact_log WHERE entity_id IN (${firstEntity}::uuid, ${reusedEntity}::uuid)`)).toHaveLength(2);
  });

  test("P5: identical keys are tenant-local and app_role cannot forge tenant access", async () => {
    const service = new PostgresIdempotency({ now: () => NOW });
    const shared = {
      operation: "inventory.tenant.create",
      key: "order047-shared-tenant-key",
      request: { code: "SAME" },
    };
    const a = await database.withTenantTransaction(TENANT_A, (tx) =>
      service.execute(tx, { ...shared, tenantId: TENANT_A },
        factCallback(TENANT_A, PROPERTY_A, ACTOR_A, subject(471008), { tenant: "a" })),
    );
    const b = await database.withTenantTransaction(TENANT_B, (tx) =>
      service.execute(tx, { ...shared, tenantId: TENANT_B },
        factCallback(TENANT_B, PROPERTY_B, ACTOR_B, subject(471009), { tenant: "b" })),
    );
    expect(a.body).toEqual({ tenant: "a" });
    expect(b.body).toEqual({ tenant: "b" });

    expect(await database.withTenantTransaction(TENANT_A, (tx) =>
      tx`SELECT tenant_id FROM api_idempotency WHERE operation = 'inventory.tenant.create'`,
    )).toHaveLength(1);
    await expect(database.withTenantTransaction(TENANT_A, (tx) =>
      service.execute(tx, { ...shared, tenantId: TENANT_B }, async () => ({ status: 201, body: {} })),
    )).rejects.toMatchObject({ errno: "42501" });
  });

  test("P6: migration surface has exact RLS, grants, constraints, and expiry index", async () => {
    const columns = await admin<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'api_idempotency'
      ORDER BY ordinal_position
    `;
    expect(columns.map(({ column_name }) => column_name)).toEqual([
      "tenant_id", "operation", "key_hash", "request_hash", "response_status",
      "response_body", "created_at", "completed_at", "expires_at",
    ]);
    const metadata = await admin<Array<{
      relrowsecurity: boolean; relforcerowsecurity: boolean; policies: number;
      can_select: boolean; can_insert: boolean; can_update: boolean; can_delete: boolean;
      insert_columns: string[]; update_columns: string[];
      expiry_indexes: number;
    }>>`
      SELECT c.relrowsecurity, c.relforcerowsecurity,
        (SELECT count(*)::int FROM pg_policy WHERE polrelid = c.oid) AS policies,
        has_table_privilege('app_role', c.oid, 'SELECT') AS can_select,
        has_table_privilege('app_role', c.oid, 'INSERT') AS can_insert,
        has_table_privilege('app_role', c.oid, 'UPDATE') AS can_update,
        has_table_privilege('app_role', c.oid, 'DELETE') AS can_delete,
        (SELECT array_agg(column_name::text ORDER BY ordinal_position) FROM information_schema.columns col
          WHERE col.table_schema = 'public' AND col.table_name = 'api_idempotency'
            AND has_column_privilege('app_role', 'public.api_idempotency', col.column_name, 'INSERT')) AS insert_columns,
        (SELECT array_agg(column_name::text ORDER BY ordinal_position) FROM information_schema.columns col
          WHERE col.table_schema = 'public' AND col.table_name = 'api_idempotency'
            AND has_column_privilege('app_role', 'public.api_idempotency', col.column_name, 'UPDATE')) AS update_columns,
        (SELECT count(*)::int FROM pg_indexes WHERE schemaname = 'public'
          AND tablename = 'api_idempotency' AND indexdef LIKE '%expires_at%') AS expiry_indexes
      FROM pg_class c
      WHERE c.oid = 'public.api_idempotency'::regclass
    `;
    expect(metadata).toEqual([{
      relrowsecurity: true,
      relforcerowsecurity: false,
      policies: 1,
      can_select: true,
      can_insert: false,
      can_update: false,
      can_delete: false,
      insert_columns: ["tenant_id", "operation", "key_hash", "request_hash", "created_at", "expires_at"],
      update_columns: ["request_hash", "response_status", "response_body", "created_at", "completed_at", "expires_at"],
      expiry_indexes: 1,
    }]);
  });
});
