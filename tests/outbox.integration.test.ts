import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  Database,
  type EventBus,
  type OutboxEvent,
  PostgresEventBus,
  type PublishEventInput,
} from "../src/kernel";

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_OUTBOX_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL ?? process.env.YELLOW_OUTBOX_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OUTBOX === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const GROUP_A = "00000000-0000-0000-0000-000000000010";
const REGION_A = "00000000-0000-0000-0000-000000000011";
const PROPERTY_A = "00000000-0000-0000-0000-000000000012";
const ACTOR = "00000000-0000-0000-0000-000000000960";
const COMMITTED_TASK = "00000000-0000-0000-0000-000000000973";
const ROLLED_BACK_TASK = "00000000-0000-0000-0000-000000000974";
const COMMITTED_CORRELATION = "00000000-0000-0000-0000-000000000983";
const ROLLED_BACK_CORRELATION = "00000000-0000-0000-0000-000000000984";
const BUSINESS_DATE = "2026-09-01";
const TEST_CONSUMERS = [
  "order-022-ordering",
  "order-022-resume",
  "order-022-consumer-a",
  "order-022-consumer-b",
] as const;

if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_RUNTIME_DATABASE_URL are required by the Order 022 proof");
}

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
let database: Database | undefined;
let admin: SQL | undefined;
let consumerPool: SQL | undefined;
let bus: PostgresEventBus | undefined;
const createdFixtureNodes: string[] = [];
let createdFixtureTenant = false;
const testAggregateIds = new Set<string>([COMMITTED_TASK, ROLLED_BACK_TASK]);

function event(aggregateId: string, correlationId = crypto.randomUUID()): PublishEventInput {
  testAggregateIds.add(aggregateId);
  return {
    tenantId: TENANT_A,
    propertyNode: PROPERTY_A,
    businessDate: BUSINESS_DATE,
    aggregateType: "task",
    aggregateId,
    eventType: "task.created",
    actorId: ACTOR,
    correlationId,
    payload: { task_id: aggregateId },
  };
}

beforeAll(async () => {
  if (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL) return;
  database = Database.connect(RUNTIME_DATABASE_URL, { maxConnections: 24 });
  admin = new SQL(DEPLOY_DATABASE_URL, { max: 4 });
  consumerPool = new SQL(RUNTIME_DATABASE_URL, { max: 8, prepare: false });
  bus = new PostgresEventBus(consumerPool);

  const tenant = await admin<{ id: string }[]>`SELECT id::text AS id FROM tenant WHERE id = ${TENANT_A}::uuid`;
  if (tenant.length === 0) {
    await admin`INSERT INTO tenant (id, slug, name) VALUES (${TENANT_A}::uuid, 'acme', 'Acme Hotels')`;
    createdFixtureTenant = true;
  }
  const fixtureNodes = [
    { id: GROUP_A, path: "acme", kind: "group", name: "Acme Group", timezone: null, currency: null },
    { id: REGION_A, path: "acme.gulf", kind: "region", name: "Gulf Region", timezone: null, currency: null },
    { id: PROPERTY_A, path: "acme.gulf.dxb01", kind: "property", name: "Acme Downtown Dubai", timezone: "Asia/Dubai", currency: "AED" },
  ] as const;
  for (const node of fixtureNodes) {
    const existing = await admin<{ id: string }[]>`SELECT id::text AS id FROM org_node WHERE id = ${node.id}::uuid`;
    if (existing.length === 0) {
      await admin`
        INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
        VALUES (${node.id}::uuid, ${TENANT_A}::uuid, ${node.path}::ltree, ${node.kind}, ${node.name}, ${node.timezone}, ${node.currency})
      `;
      createdFixtureNodes.push(node.id);
    }
  }
  const authoritativeProperty = await admin<{ tenant_id: string; path: string; kind: string; parent_path: string | null }[]>`
    SELECT tenant_id::text AS tenant_id, path::text AS path, kind,
           subpath(path, 0, nlevel(path) - 1)::text AS parent_path
      FROM org_node
     WHERE id = ${PROPERTY_A}::uuid
  `;
  expect(authoritativeProperty).toEqual([{
    tenant_id: TENANT_A,
    path: "acme.gulf.dxb01",
    kind: "property",
    parent_path: "acme.gulf",
  }]);
});

afterAll(async () => {
  if (admin) {
    await admin`DELETE FROM consumer_processed WHERE consumer IN ${admin(TEST_CONSUMERS)}`;
    await admin`DELETE FROM consumer_cursor WHERE consumer IN ${admin(TEST_CONSUMERS)}`;
    await admin`DELETE FROM outbox WHERE aggregate_id IN ${admin([...testAggregateIds])}`;
    await admin`DELETE FROM task WHERE id IN (${COMMITTED_TASK}::uuid, ${ROLLED_BACK_TASK}::uuid)`;
    for (const nodeId of [PROPERTY_A, REGION_A, GROUP_A]) {
      if (createdFixtureNodes.includes(nodeId)) {
        await admin`DELETE FROM org_node WHERE id = ${nodeId}::uuid`;
      }
    }
    if (createdFixtureTenant) await admin`DELETE FROM tenant WHERE id = ${TENANT_A}::uuid`;
    await admin.close();
  }
  await consumerPool?.close();
  await database?.close();
});

databaseDescribe("Order 022 EventBus and durable consumer", () => {
  test("migration tables are deploy-owned, RLS-free, and unavailable to app_role/PUBLIC", async () => {
    const rows = await admin!<Array<{
      relname: string;
      owner: string;
      current_name: string;
      relrowsecurity: boolean;
      app_privileges: boolean;
      runtime_privileges: boolean;
      public_privileges: boolean;
    }>>`
      SELECT
        c.relname,
        pg_get_userbyid(c.relowner) AS owner,
        current_user AS current_name,
        c.relrowsecurity,
        has_table_privilege('app_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS app_privileges,
        has_table_privilege('yellow_runtime', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS runtime_privileges,
        EXISTS (
          SELECT 1
          FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) AS acl
          WHERE acl.grantee = 0
        ) AS public_privileges
      FROM pg_class AS c
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('consumer_cursor', 'consumer_processed')
      ORDER BY c.relname
    `;

    expect(rows).toEqual([
      { relname: "consumer_cursor", owner: "yellow_owner", current_name: "yellow_deploy", relrowsecurity: false, app_privileges: false, runtime_privileges: false, public_privileges: false },
      { relname: "consumer_processed", owner: "yellow_owner", current_name: "yellow_deploy", relrowsecurity: false, app_privileges: false, runtime_privileges: false, public_privileges: false },
    ]);
    expect(rows.every((row) => row.relrowsecurity === false)).toBe(true);
    expect(rows.every((row) => row.app_privileges === false)).toBe(true);
    expect(rows.every((row) => row.runtime_privileges === false)).toBe(true);
    expect(rows.every((row) => row.public_privileges === false)).toBe(true);
  });

  test("P1: mutation and event commit together while rollback publishes neither", async () => {
    const committed = await database!.withTenantTransaction(TENANT_A, async (tx) => {
      await tx`
        INSERT INTO task (id, tenant_id, property_node, kind, payload)
        VALUES (${COMMITTED_TASK}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'trace', '{}'::jsonb)
      `;
      return bus!.publish(tx, event(COMMITTED_TASK, COMMITTED_CORRELATION));
    });

    await expect(database!.withTenantTransaction(TENANT_A, async (tx) => {
      await tx`
        INSERT INTO task (id, tenant_id, property_node, kind, payload)
        VALUES (${ROLLED_BACK_TASK}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'trace', '{}'::jsonb)
      `;
      await bus!.publish(tx, event(ROLLED_BACK_TASK, ROLLED_BACK_CORRELATION));
      throw new Error("controlled event rollback");
    })).rejects.toThrow("controlled event rollback");

    const rows = await admin!<Array<{ committed_tasks: number; committed_events: number; rolled_tasks: number; rolled_events: number }>>`
      SELECT
        (SELECT count(*)::int FROM task WHERE id = ${COMMITTED_TASK}::uuid) AS committed_tasks,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id = ${COMMITTED_TASK}::uuid) AS committed_events,
        (SELECT count(*)::int FROM task WHERE id = ${ROLLED_BACK_TASK}::uuid) AS rolled_tasks,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id = ${ROLLED_BACK_TASK}::uuid) AS rolled_events
    `;
    expect(rows).toEqual([{ committed_tasks: 1, committed_events: 1, rolled_tasks: 0, rolled_events: 0 }]);
    expect(committed.payload).toEqual({ task_id: COMMITTED_TASK });
  });

  test("P6: a later publisher cannot allocate past an earlier uncommitted event", async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolveGate) => {
      releaseFirst = resolveGate;
    });
    let firstPublished!: (published: OutboxEvent) => void;
    const firstReady = new Promise<OutboxEvent>((resolveReady) => {
      firstPublished = resolveReady;
    });
    let secondFinished = false;
    const firstId = crypto.randomUUID();
    const secondId = crypto.randomUUID();

    const first = database!.withTenantTransaction(TENANT_A, async (tx) => {
      const published = await bus!.publish(tx, event(firstId));
      firstPublished(published);
      await firstGate;
      return published;
    });
    const firstEvent = await firstReady;
    const second = database!.withTenantTransaction(TENANT_A, async (tx) => {
      const published = await bus!.publish(tx, event(secondId));
      secondFinished = true;
      return published;
    });

    await Bun.sleep(75);
    expect(secondFinished).toBe(false);
    releaseFirst();
    const [committedFirst, committedSecond] = await Promise.all([first, second]);
    expect(committedFirst.id).toBe(firstEvent.id);
    expect(committedFirst.seq).toBeLessThan(committedSecond.seq);
  });

  test("P2: concurrent publishers are consumed in durable seq order", async () => {
    const concurrentIds: string[] = Array.from({ length: 20 }, () => crypto.randomUUID());
    const published = await Promise.all(concurrentIds.map((aggregateId) =>
      database!.withTenantTransaction(TENANT_A, (tx) => bus!.publish(tx, event(aggregateId)))
    ));
    const observed: OutboxEvent[] = [];
    const handlerContexts: Array<{ current_user: string; tenant_id: string }> = [];
    const result = await bus!.consumeBatch(
      "order-022-ordering",
      async (outboxEvent, tx) => {
        observed.push(outboxEvent);
        const rows = await tx<Array<{ current_user: string; tenant_id: string }>>`
          SELECT current_user, current_setting('app.tenant_id', true) AS tenant_id
        `;
        handlerContexts.push(rows[0]!);
      },
      { limit: 1_000 },
    );

    expect(result.processed).toBe(observed.length);
    expect(handlerContexts.every(({ current_user, tenant_id }) =>
      current_user === "app_role" && tenant_id === TENANT_A
    )).toBe(true);
    expect(observed.map(({ seq }) => seq)).toEqual([...observed.map(({ seq }) => seq)].sort((a, b) => a - b));
    const observedConcurrent = observed.filter(({ aggregateId }) => concurrentIds.includes(aggregateId));
    expect(observedConcurrent.map(({ id }) => id)).toEqual(
      [...published].sort((left, right) => left.seq - right.seq).map(({ id }) => id),
    );
  });

  test("P3: a restarted consumer resumes from its durable cursor without gap or repeat", async () => {
    const expected = await admin!<Array<{ seq: number; id: string }>>`
      SELECT seq::int AS seq, id FROM outbox ORDER BY seq
    `;
    const observed: string[] = [];
    const poolA = new SQL(RUNTIME_DATABASE_URL!, { max: 1, prepare: false });
    const firstBus = new PostgresEventBus(poolA);
    const first = await firstBus.consumeBatch(
      "order-022-resume",
      async ({ id }) => {
        observed.push(id);
      },
      { limit: 2 },
    );
    await poolA.close();

    const poolB = new SQL(RUNTIME_DATABASE_URL!, { max: 1, prepare: false });
    const restartedBus = new PostgresEventBus(poolB);
    const second = await restartedBus.consumeBatch(
      "order-022-resume",
      async ({ id }) => {
        observed.push(id);
      },
      { limit: 1_000 },
    );
    await poolB.close();

    expect(first.examined).toBe(2);
    expect(observed).toEqual(expected.map(({ id }) => id));
    expect(new Set(observed).size).toBe(observed.length);
    expect(expected.length).toBeGreaterThan(0);
    expect(second.lastSeq).toBe(expected.at(-1)!.seq);
  });

  test("P5: different named consumers concurrently receive the same complete stream", async () => {
    const expected = await admin!<Array<{ seq: number }>>`SELECT seq::int AS seq FROM outbox ORDER BY seq`;
    const observedA: number[] = [];
    const observedB: number[] = [];
    const poolA = new SQL(RUNTIME_DATABASE_URL!, { max: 1, prepare: false });
    const poolB = new SQL(RUNTIME_DATABASE_URL!, { max: 1, prepare: false });

    await Promise.all([
      new PostgresEventBus(poolA).consumeBatch(
        "order-022-consumer-a",
        async ({ seq }) => {
          observedA.push(seq);
          await Bun.sleep(1);
        },
        { limit: 1_000 },
      ),
      new PostgresEventBus(poolB).consumeBatch(
        "order-022-consumer-b",
        async ({ seq }) => {
          observedB.push(seq);
          await Bun.sleep(1);
        },
        { limit: 1_000 },
      ),
    ]);
    await Promise.all([poolA.close(), poolB.close()]);

    expect(observedA).toEqual(expected.map(({ seq }) => seq));
    expect(observedB).toEqual(expected.map(({ seq }) => seq));
  });

  test("P4: context consumers cannot import the Postgres adapter directly", async () => {
    const root = resolve(import.meta.dir, "..", "src", "contexts");
    const violations: string[] = [];
    for await (const relativePath of new Bun.Glob("**/*.ts").scan({ cwd: root, onlyFiles: true })) {
      const source = await readFile(resolve(root, relativePath), "utf8");
      if (/from\s+["'][^"']*kernel\/outbox(?:\.ts)?["']/.test(source)) violations.push(relativePath);
    }

    const acceptsPort = (_eventBus: EventBus): true => true;
    expect(acceptsPort(bus!)).toBe(true);
    expect(violations).toEqual([]);
  });
});
