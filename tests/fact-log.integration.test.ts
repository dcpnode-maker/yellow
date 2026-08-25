import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createAuditEnvelope, Database, recordFact } from "../src/kernel";

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_FACT_LOG_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL ?? process.env.YELLOW_FACT_LOG_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_FACT_LOG === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const TENANT_B = "00000000-0000-0000-0000-000000000002";
const PROPERTY_A = "00000000-0000-0000-0000-000000000012";
const ACTOR = "00000000-0000-0000-0000-000000000960";
const COMMITTED_USER = "00000000-0000-0000-0000-000000000971";
const ROLLED_BACK_USER = "00000000-0000-0000-0000-000000000972";
const COMMITTED_REQUEST = "00000000-0000-0000-0000-000000000981";
const ROLLED_BACK_REQUEST = "00000000-0000-0000-0000-000000000982";
const COMMITTED_KEY_HASH = "a".repeat(64);
const ROLLED_BACK_KEY_HASH = "b".repeat(64);
const REQUEST_HASH = "c".repeat(64);

if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error("YELLOW_FACT_LOG_URL is required by the Order 021 proof");
}

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
let database: Database | undefined;
let admin: SQL | undefined;
let committedFactId: string | undefined;

function sqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const errno = Reflect.get(error, "errno");
  return typeof errno === "string" && errno !== "" ? errno : undefined;
}

beforeAll(async () => {
  if (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL) return;
  database = Database.connect(RUNTIME_DATABASE_URL, { maxConnections: 2 });
  admin = new SQL(DEPLOY_DATABASE_URL, { max: 1 });
  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${TENANT_A}::uuid, 'order-021-fact-log', 'Order 021 Fact Log', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order_021_property', 'property',
      'Order 021 Property', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO app_user (id, tenant_id, email, display_name, auth, status)
    VALUES (${COMMITTED_USER}::uuid, ${TENANT_A}::uuid,
      'order-021-commit@yellow.test', 'Order 021 Commit', '{}'::jsonb, 'active')
  `;
});

afterAll(async () => {
  if (admin) {
    await admin`DELETE FROM api_idempotency WHERE tenant_id = ${TENANT_A}::uuid
      AND operation = 'kernel.fact-log-proof'`;
    await admin`DELETE FROM fact_log WHERE entity_id IN (${COMMITTED_USER}::uuid, ${ROLLED_BACK_USER}::uuid)`;
    await admin`DELETE FROM app_user WHERE id IN (${COMMITTED_USER}::uuid, ${ROLLED_BACK_USER}::uuid)`;
    await admin`DELETE FROM org_node WHERE id = ${PROPERTY_A}::uuid`;
    await admin`DELETE FROM tenant WHERE id = ${TENANT_A}::uuid`;
    await admin.close();
  }
  await database?.close();
});

databaseDescribe("Order 021 fact_log audit envelope", () => {
  test("P1: mutation and audit row commit in one tenant transaction", async () => {
    const envelope = createAuditEnvelope({
      actorId: ACTOR,
      tenantId: TENANT_A,
      propertyNode: PROPERTY_A,
      requestId: COMMITTED_REQUEST,
      operation: "identity.user_created",
    });

    const fact = await database!.withTenantTransaction(TENANT_A, async (tx) => {
      await tx`
        INSERT INTO api_idempotency (
          tenant_id, operation, key_hash, request_hash, created_at, expires_at
        ) VALUES (
          ${TENANT_A}::uuid, 'kernel.fact-log-proof', ${COMMITTED_KEY_HASH}::char(64),
          ${REQUEST_HASH}::char(64), transaction_timestamp(),
          transaction_timestamp() + interval '24 hours'
        )
      `;
      return recordFact(tx, {
        envelope,
        entityType: "app_user",
        entityId: COMMITTED_USER,
        payload: { source: "order-021-proof" },
      });
    });
    committedFactId = fact.id;

    const rows = await admin!<Array<{
      user_count: number;
      mutation_count: number;
      fact_count: number;
      tenant_id: string;
      actor_id: string;
      business_date: string;
      request_id: string;
      valid_from: Date;
      recorded_at: Date;
    }>>`
      SELECT
        (SELECT count(*)::int FROM app_user WHERE id = ${COMMITTED_USER}::uuid) AS user_count,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${TENANT_A}::uuid
          AND operation = 'kernel.fact-log-proof' AND key_hash = ${COMMITTED_KEY_HASH}::char(64)) AS mutation_count,
        count(*)::int AS fact_count,
        min(tenant_id::text) AS tenant_id,
        min(actor_id::text) AS actor_id,
        min(business_date::text) AS business_date,
        min(payload->>'request_id') AS request_id,
        min(valid_from) AS valid_from,
        min(recorded_at) AS recorded_at
      FROM fact_log
      WHERE id = ${fact.id}::uuid
    `;
    const row = rows[0]!;
    expect(row.user_count).toBe(1);
    expect(row.mutation_count).toBe(1);
    expect(row.fact_count).toBe(1);
    expect(row.tenant_id).toBe(TENANT_A);
    expect(row.actor_id).toBe(ACTOR);
    expect(row.request_id).toBe(COMMITTED_REQUEST);
    expect(row.business_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row.valid_from.getTime()).toBe(row.recorded_at.getTime());
  });

  test("P2: a thrown mutation transaction leaves neither mutation nor audit", async () => {
    const envelope = createAuditEnvelope({
      actorId: ACTOR,
      tenantId: TENANT_A,
      propertyNode: PROPERTY_A,
      requestId: ROLLED_BACK_REQUEST,
      operation: "identity.user_created",
    });

    await expect(database!.withTenantTransaction(TENANT_A, async (tx) => {
      await tx`
        INSERT INTO api_idempotency (
          tenant_id, operation, key_hash, request_hash, created_at, expires_at
        ) VALUES (
          ${TENANT_A}::uuid, 'kernel.fact-log-proof', ${ROLLED_BACK_KEY_HASH}::char(64),
          ${REQUEST_HASH}::char(64), transaction_timestamp(),
          transaction_timestamp() + interval '24 hours'
        )
      `;
      await recordFact(tx, {
        envelope,
        entityType: "app_user",
        entityId: ROLLED_BACK_USER,
      });
      throw new Error("controlled rollback");
    })).rejects.toThrow("controlled rollback");

    const rows = await admin!<Array<{ mutations: number; facts: number }>>`
      SELECT
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${TENANT_A}::uuid
          AND operation = 'kernel.fact-log-proof' AND key_hash = ${ROLLED_BACK_KEY_HASH}::char(64)) AS mutations,
        (SELECT count(*)::int FROM fact_log WHERE entity_id = ${ROLLED_BACK_USER}::uuid) AS facts
    `;
    expect(rows).toEqual([{ mutations: 0, facts: 0 }]);
  });

  test("P3: app_role cannot update or delete fact_log", async () => {
    expect(committedFactId).toBeDefined();

    for (const statement of ["update", "delete"] as const) {
      let error: unknown;
      try {
        await database!.withTenantTransaction(TENANT_A, async (tx) => {
          if (statement === "update") {
            await tx`UPDATE fact_log SET payload = '{}'::jsonb WHERE id = ${committedFactId!}::uuid`;
          } else {
            await tx`DELETE FROM fact_log WHERE id = ${committedFactId!}::uuid`;
          }
        });
      } catch (caught) {
        error = caught;
      }
      expect(sqlState(error)).toBe("42501");
    }
  });

  test("P4: the fact carries tenant A and is invisible to tenant B", async () => {
    expect(committedFactId).toBeDefined();

    const visibleToA = await database!.withTenantTransaction(TENANT_A, (tx) =>
      tx<Array<{ tenant_id: string }>>`
        SELECT tenant_id::text AS tenant_id FROM fact_log WHERE id = ${committedFactId!}::uuid
      `
    );
    const visibleToB = await database!.withTenantTransaction(TENANT_B, (tx) =>
      tx<Array<{ tenant_id: string }>>`
        SELECT tenant_id::text AS tenant_id FROM fact_log WHERE id = ${committedFactId!}::uuid
      `
    );

    expect(visibleToA).toEqual([{ tenant_id: TENANT_A }]);
    expect(visibleToB).toEqual([]);
  });
});
