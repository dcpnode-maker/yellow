import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { OutboxRelay, PostgresEventBus, type OutboxEvent, type Tx } from "../src/kernel";

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_OUTBOX_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL ?? process.env.YELLOW_OUTBOX_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RELAY === "1";
const TENANT = "00000000-0000-0000-0000-000000000001";
const PROPERTY = "00000000-0000-0000-0000-000000000012";
const MIXED_TENANT_B = crypto.randomUUID();
const MIXED_PROPERTY_B = crypto.randomUUID();
const ACTOR = "00000000-0000-0000-0000-000000000960";
const BUSINESS_DATE = "2026-09-02";
const CONSUMERS = [
  "order-023-kill",
  "order-023-crash-window",
  "order-023-poll-idle",
  "order-023-poll-load",
  "order-023-concurrent",
  "order-023-backlog",
  "order-023-prune",
  "order-023-canary-cursor",
  "order-023-canary",
  "order-023-canary-unpublished",
  "order-023-canary-cursor-rollback",
  "order-023-canary-unpublished-rollback",
  "order-023-mixed-clean",
  "order-023-mixed-reset",
  "order-023-mixed-reset-unpublished",
  "order-023-mixed-wrong-tenant",
  "order-023-mixed-wrong-tenant-unpublished",
  "order-023-mixed-guc",
  "order-023-mixed-guc-deallocate",
  "order-023-mixed-unpublished",
  "order-023-mixed-unpublished-guc",
  "order-023-mixed-unpublished-failure",
  "order-023-mixed-settlement-failure",
  "order-023-mixed-unpublished-settlement-failure",
] as const;

if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_RUNTIME_DATABASE_URL are required by the Order 023 proof");
}

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let pool: SQL | undefined;
let bus: PostgresEventBus | undefined;
const correlations = new Set<string>();

async function insertEvents(count: number, correlation = crypto.randomUUID()): Promise<OutboxEvent[]> {
  correlations.add(correlation);
  const payload = JSON.stringify({ proof: "order-023" });
  const rows = await admin!<Array<{
    seq: number;
    id: string;
    aggregate_id: string;
    created_at: Date;
  }>>`
    INSERT INTO outbox (
      tenant_id, property_node, business_date, aggregate_type, aggregate_id,
      event_type, actor_id, correlation_id, payload
    )
    SELECT
      ${TENANT}::uuid,
      ${PROPERTY}::uuid,
      ${BUSINESS_DATE}::date,
      'task',
      gen_random_uuid(),
      'task.created',
      ${ACTOR}::uuid,
      ${correlation}::uuid,
      ${payload}::text::jsonb
    FROM generate_series(1, ${count})
    RETURNING seq::int, id, aggregate_id, created_at
  `;
  return rows.map((row) => ({
    seq: row.seq,
    id: row.id,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    businessDate: BUSINESS_DATE,
    aggregateType: "task",
    aggregateId: row.aggregate_id,
    eventType: "task.created",
    eventVersion: 1,
    actorId: ACTOR,
    correlationId: correlation,
    causationId: null,
    occurredAt: row.created_at,
    payload: { proof: "order-023" },
  }));
}

async function seedConsumerCursor(consumer: string): Promise<number> {
  await admin!`DELETE FROM consumer_processed WHERE consumer = ${consumer}`;
  const rows = await admin!<{ lastSeq: number }[]>`
    SELECT COALESCE(max(seq), 0)::int AS "lastSeq" FROM outbox
  `;
  const lastSeq = rows[0]?.lastSeq ?? 0;
  await admin!`
    INSERT INTO consumer_cursor (consumer, last_seq)
    VALUES (${consumer}, ${lastSeq}::bigint)
    ON CONFLICT (consumer) DO UPDATE SET last_seq = EXCLUDED.last_seq
  `;
  return lastSeq;
}

async function insertMixedEvents(): Promise<OutboxEvent[]> {
  const tenants = [TENANT, TENANT, MIXED_TENANT_B, MIXED_TENANT_B, TENANT];
  const properties = [PROPERTY, PROPERTY, MIXED_PROPERTY_B, MIXED_PROPERTY_B, PROPERTY];
  const correlation = crypto.randomUUID();
  correlations.add(correlation);
  const events: OutboxEvent[] = [];
  for (let index = 0; index < tenants.length; index += 1) {
    const rows = await admin!<Array<{ seq: number; id: string; aggregate_id: string; created_at: Date }>>`
      INSERT INTO outbox (
        tenant_id, property_node, business_date, aggregate_type, aggregate_id,
        event_type, actor_id, correlation_id, payload
      ) VALUES (
        ${tenants[index]!}::uuid, ${properties[index]!}::uuid, ${BUSINESS_DATE}::date,
        'task', gen_random_uuid(), 'task.created', ${ACTOR}::uuid, ${correlation}::uuid,
        '{"proof":"order-023-mixed"}'::jsonb
      ) RETURNING seq::int, id, aggregate_id, created_at
    `;
    const row = rows[0]!;
    events.push({
      seq: row.seq, id: row.id, tenantId: tenants[index]!, propertyNode: properties[index]!,
      businessDate: BUSINESS_DATE, aggregateType: "task", aggregateId: row.aggregate_id,
      eventType: "task.created", eventVersion: 1, actorId: ACTOR, correlationId: correlation,
      causationId: null, occurredAt: row.created_at, payload: { proof: "order-023-mixed" },
    });
  }
  return events;
}

async function drain(relay: OutboxRelay, handler: Parameters<OutboxRelay["drainOnce"]>[0]): Promise<number> {
  let examined = 0;
  while (true) {
    const batch = await relay.drainOnce(handler);
    examined += batch.examined;
    if (batch.examined === 0) return examined;
  }
}

test("D398: migration exposes explicit cursor/unpublished branches", async () => {
  const migration = await Bun.file(new URL("../migrations/0015_runtime_database_authority.sql", import.meta.url)).text();
  expect(migration).toContain("p_unpublished boolean");
  expect(migration).toContain("IF p_unpublished THEN");
  expect(migration).toContain("o.published_at IS NULL");
  expect(migration).toContain("o.seq > p_after");
  expect(migration).toContain("ON CONFLICT (consumer, outbox_id) DO NOTHING");
});

beforeAll(async () => {
  if (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL) return;
  admin = new SQL(DEPLOY_DATABASE_URL, { max: 4 });
  pool = new SQL(RUNTIME_DATABASE_URL, { max: 12, prepare: false });
  bus = new PostgresEventBus(pool);
  // Order proofs own the relay's pending queue; isolate it from prior local test data.
  await admin`UPDATE outbox SET published_at = now() WHERE published_at IS NULL`;
  await admin`INSERT INTO tenant (id, slug, name) VALUES (${MIXED_TENANT_B}::uuid, 'order023-mixed-b', 'Order 023 Mixed B')`;
  await admin`INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES (${MIXED_PROPERTY_B}::uuid, ${MIXED_TENANT_B}::uuid, 'order023.mixed_b'::ltree, 'property', 'Order 023 Mixed B', 'UTC', 'USD')`;
});

afterAll(async () => {
  if (admin) {
    await admin`DELETE FROM task WHERE payload->>'proof' = 'order-023'`;
    await admin`DELETE FROM consumer_processed WHERE consumer IN ${admin(CONSUMERS)}`;
    await admin`DELETE FROM consumer_cursor WHERE consumer IN ${admin(CONSUMERS)}`;
    if (correlations.size > 0) {
      await admin`DELETE FROM outbox WHERE correlation_id IN ${admin([...correlations])}`;
    }
    await admin`DELETE FROM org_node WHERE id = ${MIXED_PROPERTY_B}::uuid`;
    await admin`DELETE FROM tenant WHERE id = ${MIXED_TENANT_B}::uuid`;
    await admin.close();
  }
  await pool?.close();
});

databaseDescribe("Order 023 crash-safe outbox relay", () => {
  test("P1-P3: SIGKILL mid-batch rolls back, restart delivers all once and marks published", async () => {
    const events = await insertEvents(120);
    const moduleUrl = new URL("../src/kernel/index.ts", import.meta.url).href;
    const childSource = `
      import { SQL } from "bun";
      import { OutboxRelay, PostgresEventBus } from ${JSON.stringify(moduleUrl)};
      const pool = new SQL(process.env.YELLOW_RUNTIME_DATABASE_URL, { max: 1, prepare: false });
      const relay = new OutboxRelay(new PostgresEventBus(pool), { consumer: "order-023-kill", batchSize: 120 });
      let handled = 0;
      await relay.drainOnce(async (event, tx) => {
        await tx\`INSERT INTO task (id, tenant_id, property_node, kind, payload)
          VALUES (\${event.aggregateId}::uuid, \${event.tenantId}::uuid, \${event.propertyNode}::uuid,
            'trace', '{"proof":"order-023"}'::jsonb)\`;
        handled += 1;
        if (handled === 25) process.kill(process.pid, "SIGKILL");
      });
    `;
    const child = Bun.spawn([process.execPath, "-e", childSource], {
      env: { ...process.env, YELLOW_RUNTIME_DATABASE_URL: RUNTIME_DATABASE_URL! },
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await child.exited;
    const stderr = await new Response(child.stderr).text();
    expect(exitCode, stderr).not.toBe(0);

    const rolledBack = await admin!<Array<{ tasks: number; markers: number; published: number }>>`
      SELECT
        (SELECT count(*)::int FROM task WHERE id IN ${admin!(events.map(({ aggregateId }) => aggregateId))}) AS tasks,
        (SELECT count(*)::int FROM consumer_processed WHERE consumer = 'order-023-kill') AS markers,
        (SELECT count(*)::int FROM outbox WHERE id IN ${admin!(events.map(({ id }) => id))} AND published_at IS NOT NULL) AS published
    `;
    expect(rolledBack).toEqual([{ tasks: 0, markers: 0, published: 0 }]);

    const relay = new OutboxRelay(bus!, { consumer: "order-023-kill", batchSize: 120 });
    const handlerIds: string[] = [];
    await drain(relay, async (event, tx) => {
      handlerIds.push(event.id);
      await tx`
        INSERT INTO task (id, tenant_id, property_node, kind, payload)
        VALUES (
          ${event.aggregateId}::uuid, ${event.tenantId}::uuid, ${event.propertyNode}::uuid,
          'trace', '{"proof":"order-023"}'::jsonb
        )
      `;
    });
    expect(handlerIds).toHaveLength(120);
    expect(new Set(handlerIds).size).toBe(120);

    const recovered = await admin!<Array<{ tasks: number; markers: number; published: number }>>`
      SELECT
        (SELECT count(*)::int FROM task WHERE id IN ${admin!(events.map(({ aggregateId }) => aggregateId))}) AS tasks,
        (SELECT count(*)::int FROM consumer_processed WHERE consumer = 'order-023-kill') AS markers,
        (SELECT count(*)::int FROM outbox WHERE id IN ${admin!(events.map(({ id }) => id))} AND published_at IS NOT NULL) AS published
    `;
    expect(recovered).toEqual([{ tasks: 120, markers: 120, published: 120 }]);
  }, 30_000);

  test("P3: committed consumer effect survives a crash before publication without duplication", async () => {
    const events = await insertEvents(12);
    const relay = new OutboxRelay(bus!, { consumer: "order-023-crash-window", batchSize: 12 });
    let handled = 0;
    await expect(relay.drainOnce(async (event, tx) => {
      handled += 1;
      await tx`
        INSERT INTO task (id, tenant_id, property_node, kind, payload)
        VALUES (
          ${event.aggregateId}::uuid, ${event.tenantId}::uuid, ${event.propertyNode}::uuid,
          'trace', '{"proof":"order-023"}'::jsonb
        )
      `;
    }, {
      afterConsumerCommit: () => {
        throw new Error("simulated process death after consumer commit");
      },
    })).rejects.toThrow("simulated process death");
    expect(handled).toBe(12);

    let redeliveredEffects = 0;
    const restarted = await relay.drainOnce(async () => {
      redeliveredEffects += 1;
    });
    expect(restarted).toEqual({ examined: 12, processed: 0, published: 12 });
    expect(redeliveredEffects).toBe(0);
    const published = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM outbox
      WHERE id IN ${admin!(events.map(({ id }) => id))} AND published_at IS NOT NULL
    `;
    expect(published[0]?.count).toBe(12);
  });

  test("D398: set-wise marks and both consume paths preserve order, dedupe, and rollback", async () => {
    await seedConsumerCursor("order-023-canary-cursor");
    const cursorEvents = (await insertEvents(4)).sort((left, right) => left.seq - right.seq);
    await admin!`INSERT INTO consumer_processed (consumer, outbox_id) VALUES ('order-023-canary-cursor', ${cursorEvents[0]!.id}::uuid)`;
    const cursorHandled: string[] = [];
    const cursorResult = await bus!.consumeBatch("order-023-canary-cursor", async (event) => {
      cursorHandled.push(event.id);
    }, { limit: 10 });
    expect(cursorResult).toMatchObject({ examined: 4, processed: 3, lastSeq: cursorEvents.at(-1)!.seq });
    expect(cursorHandled).toEqual(cursorEvents.slice(1).map(({ id }) => id));
    expect(await bus!.markPublished(cursorEvents.map(({ id }) => id))).toBe(4);

    await seedConsumerCursor("order-023-canary-unpublished");
    const unpublishedEvents = (await insertEvents(4)).sort((left, right) => left.seq - right.seq);
    await admin!`INSERT INTO consumer_processed (consumer, outbox_id) VALUES ('order-023-canary-unpublished', ${unpublishedEvents[0]!.id}::uuid)`;
    const unpublishedHandled: string[] = [];
    const unpublishedResult = await bus!.consumeUnpublishedBatch("order-023-canary-unpublished", async (event) => {
      unpublishedHandled.push(event.id);
    }, { limit: 10 });
    expect(unpublishedResult).toMatchObject({ examined: 4, processed: 3, lastSeq: unpublishedEvents.at(-1)!.seq });
    expect(unpublishedResult.events.map(({ id }) => id)).toEqual(unpublishedEvents.map(({ id }) => id));
    expect(unpublishedHandled).toEqual(unpublishedEvents.slice(1).map(({ id }) => id));

    const marked = await bus!.markPublished([
      unpublishedEvents[3]!.id,
      unpublishedEvents[1]!.id,
      unpublishedEvents[1]!.id,
    ]);
    expect(marked).toBe(2);
    const publication = await admin!<{ id: string; published: boolean }[]>`
      SELECT id, published_at IS NOT NULL AS published
        FROM outbox
       WHERE id IN (${unpublishedEvents[1]!.id}::uuid, ${unpublishedEvents[3]!.id}::uuid)
       ORDER BY id
    `;
    expect(publication).toEqual([
      { id: unpublishedEvents[1]!.id, published: true },
      { id: unpublishedEvents[3]!.id, published: true },
    ].sort((left, right) => left.id.localeCompare(right.id)));
    expect(await bus!.markPublished(unpublishedEvents.map(({ id }) => id))).toBe(4);

    await seedConsumerCursor("order-023-canary-cursor-rollback");
    const cursorRollbackEvents = (await insertEvents(2)).sort((left, right) => left.seq - right.seq);
    await expect(bus!.consumeBatch("order-023-canary-cursor-rollback", async () => {
      throw new Error("D398 cursor rollback");
    }, { limit: 10 })).rejects.toThrow("D398 cursor rollback");
    const cursorRetry = await bus!.consumeBatch("order-023-canary-cursor-rollback", async () => undefined, { limit: 10 });
    expect(cursorRetry.processed).toBe(cursorRollbackEvents.length);
    expect(await bus!.markPublished(cursorRollbackEvents.map(({ id }) => id))).toBe(cursorRollbackEvents.length);

    await seedConsumerCursor("order-023-canary-unpublished-rollback");
    const unpublishedRollbackEvents = (await insertEvents(2)).sort((left, right) => left.seq - right.seq);
    await expect(bus!.consumeUnpublishedBatch("order-023-canary-unpublished-rollback", async () => {
      throw new Error("D398 unpublished rollback");
    }, { limit: 10 })).rejects.toThrow("D398 unpublished rollback");
    const unpublishedRetry = await bus!.consumeUnpublishedBatch("order-023-canary-unpublished-rollback", async () => undefined, { limit: 10 });
    expect(unpublishedRetry.processed).toBe(unpublishedRollbackEvents.length);
    expect(await bus!.markPublished(unpublishedRollbackEvents.map(({ id }) => id))).toBe(unpublishedRollbackEvents.length);
  });

  const runD399Proof = async (
    mode: "ordered" | "unpublished",
    adversary: "reset" | "wrong-tenant" | "guc" | "deallocate" | "settlement",
  ) => {

    const assertRollback = async (consumer: string, baseline: number, events: readonly OutboxEvent[]) => {
      const rows = await admin!<{ lastSeq: number; marks: number; effects: number }[]>`
        SELECT c.last_seq::int AS "lastSeq",
               (SELECT count(*)::int FROM consumer_processed WHERE consumer = ${consumer}) AS marks,
               (SELECT count(*)::int FROM task WHERE payload->>'proof' = 'order-023'
                 AND id IN ${admin!(events.map(({ aggregateId }) => aggregateId))}) AS effects
          FROM consumer_cursor AS c WHERE c.consumer = ${consumer}
      `;
      expect(rows).toEqual([{ lastSeq: baseline, marks: 0, effects: 0 }]);
    };

    const inspectClean = async (candidate: SQL, expectedPid?: number) => {
      const connection = await candidate.reserve();
      try {
        const rows = await connection<{ pid: number; current_user: string; session_user: string; tenant_clear: boolean; prepared_count: number }[]>`
          SELECT pg_backend_pid()::int AS pid,
                 current_user::text AS current_user, session_user::text AS session_user,
                 NULLIF(current_setting('app.tenant_id', true), '') IS NULL AS tenant_clear,
                 (SELECT count(*)::int FROM pg_prepared_statements) AS prepared_count
        `;
        expect(rows).toEqual([{
          pid: expect.any(Number), current_user: "yellow_runtime", session_user: "yellow_runtime",
          tenant_clear: true, prepared_count: 0,
        }]);
        if (expectedPid !== undefined) expect(rows[0]!.pid).toBe(expectedPid);
        return rows[0]!.pid;
      } finally {
        connection.release();
      }
    };

    type Consume = (candidate: PostgresEventBus, handler: (event: OutboxEvent, tx: Tx) => Promise<void>) => Promise<unknown>;
    const runFailure = async (
      consumer: string,
      consume: Consume,
      tamper: (tx: Tx, event: OutboxEvent) => Promise<void>,
      expectPoolClosed = false,
    ) => {
      const baseline = await seedConsumerCursor(consumer);
      const events = await insertMixedEvents();
      const failedPool = new SQL(RUNTIME_DATABASE_URL!, { max: 1, prepare: false });
      const failedBus = new PostgresEventBus(failedPool);
      try {
        await expect(consume(failedBus, async (event, tx) => {
          await tx`INSERT INTO task (id, tenant_id, property_node, kind, payload)
            VALUES (${event.aggregateId}::uuid, ${event.tenantId}::uuid, ${event.propertyNode}::uuid,
                    'trace', '{"proof":"order-023"}'::jsonb)`;
          await tamper(tx, event);
        })).rejects.toThrow(/changed|required|settle|prepared|26000|connection|closed|terminated|reset/i);
        await assertRollback(consumer, baseline, events);
        if (expectPoolClosed) {
          await expect(failedPool.reserve()).rejects.toThrow();
        }
      } finally {
        // A true settlement failure fail-closes this pool; never rely on PID replacement in place.
        await failedPool.close();
      }

      const retryPool = new SQL(RUNTIME_DATABASE_URL!, { max: 1, prepare: false });
      const retryBus = new PostgresEventBus(retryPool);
      try {
        const seen: string[] = [];
        const retry = await consume(retryBus, async (event, tx) => {
          const rows = await tx<{ user: string; tenant: string }[]>`
            SELECT current_user::text AS user, current_setting('app.tenant_id', true) AS tenant
          `;
          expect(rows).toEqual([{ user: "app_role", tenant: event.tenantId }]);
          seen.push(event.id);
        }) as { processed: number };
        expect(retry.processed).toBe(events.length);
        expect(seen).toEqual(events.map(({ id }) => id));
        expect(await retryBus.markPublished(events.map(({ id }) => id))).toBe(events.length);
        await inspectClean(retryPool);
      } finally {
        await retryPool.close();
      }
    };

    const runSameValue = async (consumer: string, consume: Consume, deallocate: boolean) => {
      await seedConsumerCursor(consumer);
      const events = await insertMixedEvents();
      const candidate = new SQL(RUNTIME_DATABASE_URL!, { max: 1, prepare: false });
      const candidateBus = new PostgresEventBus(candidate);
      const before = await inspectClean(candidate);
      try {
        const result = await consume(candidateBus, async (event, tx) => {
          await tx`SELECT set_config('app.tenant_id', ${event.tenantId}, false)`;
          if (deallocate) await tx.unsafe("DEALLOCATE ALL");
        }) as { processed: number };
        expect(result.processed).toBe(events.length);
        expect(await candidateBus.markPublished(events.map(({ id }) => id))).toBe(events.length);
        // Same physical backend is reused, but all role/GUC/prepared state is neutralized.
        await inspectClean(candidate, before);
      } finally {
        await candidate.close();
      }
    };

    const terminateHandlerBackend = async (tx: Tx) => {
      await tx.unsafe("RESET ROLE");
      await tx.unsafe("SELECT pg_terminate_backend(pg_backend_pid())");
    };

    if (mode === "ordered" && adversary === "reset") {
      await runFailure("order-023-mixed-reset", (candidate, handler) => candidate.consumeBatch("order-023-mixed-reset", handler, { limit: 10 }), async (tx) => {
        await tx.unsafe("RESET ROLE");
      });
    } else if (mode === "ordered" && adversary === "wrong-tenant") {
      await runFailure("order-023-mixed-wrong-tenant", (candidate, handler) => candidate.consumeBatch("order-023-mixed-wrong-tenant", handler, { limit: 10 }), async (tx) => {
        await tx`SELECT set_config('app.tenant_id', ${MIXED_TENANT_B}, false)`;
      });
    } else if (mode === "ordered" && adversary === "guc") {
      await runSameValue("order-023-mixed-guc", (candidate, handler) => candidate.consumeBatch("order-023-mixed-guc", handler, { limit: 10 }), false);
    } else if (mode === "ordered" && adversary === "deallocate") {
      await runSameValue("order-023-mixed-guc-deallocate", (candidate, handler) => candidate.consumeBatch("order-023-mixed-guc-deallocate", handler, { limit: 10 }), true);
    } else if (mode === "ordered" && adversary === "settlement") {
      await runFailure("order-023-mixed-settlement-failure", (candidate, handler) => candidate.consumeBatch("order-023-mixed-settlement-failure", handler, { limit: 10 }), terminateHandlerBackend, true);
    } else if (mode === "unpublished" && adversary === "reset") {
      await runFailure("order-023-mixed-reset-unpublished", (candidate, handler) => candidate.consumeUnpublishedBatch("order-023-mixed-reset-unpublished", handler, { limit: 10 }), async (tx) => {
        await tx.unsafe("RESET ROLE");
      });
    } else if (mode === "unpublished" && adversary === "wrong-tenant") {
      await runFailure("order-023-mixed-wrong-tenant-unpublished", (candidate, handler) => candidate.consumeUnpublishedBatch("order-023-mixed-wrong-tenant-unpublished", handler, { limit: 10 }), async (tx) => {
        await tx`SELECT set_config('app.tenant_id', ${MIXED_TENANT_B}, false)`;
      });
    } else if (mode === "unpublished" && adversary === "guc") {
      await runSameValue("order-023-mixed-unpublished-guc", (candidate, handler) => candidate.consumeUnpublishedBatch("order-023-mixed-unpublished-guc", handler, { limit: 10 }), false);
    } else if (mode === "unpublished" && adversary === "deallocate") {
      await runSameValue("order-023-mixed-unpublished", (candidate, handler) => candidate.consumeUnpublishedBatch("order-023-mixed-unpublished", handler, { limit: 10 }), true);
    } else if (mode === "unpublished" && adversary === "settlement") {
      await runFailure("order-023-mixed-unpublished-settlement-failure", (candidate, handler) => candidate.consumeUnpublishedBatch("order-023-mixed-unpublished-settlement-failure", handler, { limit: 10 }), terminateHandlerBackend, true);
    }
  };

  test("D399 clean: mixed-tenant order and context", async () => {
    await seedConsumerCursor("order-023-mixed-clean");
    const cleanEvents = await insertMixedEvents();
    const cleanSeen: Array<{ id: string; user: string; tenant: string }> = [];
    const cleanResult = await bus!.consumeBatch("order-023-mixed-clean", async (event, tx) => {
      const rows = await tx<{ user: string; tenant: string }[]>`
        SELECT current_user::text AS user, current_setting('app.tenant_id', true) AS tenant
      `;
      cleanSeen.push({ id: event.id, user: rows[0]!.user, tenant: rows[0]!.tenant });
    }, { limit: 10 });
    expect(cleanResult).toMatchObject({ examined: 5, processed: 5, lastSeq: cleanEvents.at(-1)!.seq });
    expect(cleanSeen).toEqual(cleanEvents.map(({ id, tenantId }) => ({ id, user: "app_role", tenant: tenantId })));
    expect(await bus!.markPublished(cleanEvents.map(({ id }) => id))).toBe(5);
  });
  test("D399 ordered RESET ROLE", async () => runD399Proof("ordered", "reset"));
  test("D399 ordered wrong tenant", async () => runD399Proof("ordered", "wrong-tenant"));
  test("D399 ordered same-value GUC", async () => runD399Proof("ordered", "guc"));
  test("D399 ordered DEALLOCATE ALL", async () => runD399Proof("ordered", "deallocate"));
  test("D399 ordered settlement failure", async () => runD399Proof("ordered", "settlement"));
  test("D399 unpublished RESET ROLE", async () => runD399Proof("unpublished", "reset"));
  test("D399 unpublished wrong tenant", async () => runD399Proof("unpublished", "wrong-tenant"));
  test("D399 unpublished same-value GUC", async () => runD399Proof("unpublished", "guc"));
  test("D399 unpublished DEALLOCATE ALL", async () => runD399Proof("unpublished", "deallocate"));
  test("D399 unpublished settlement failure", async () => runD399Proof("unpublished", "settlement"));

  test("P4: polling starts every 100-250 ms while idle and under load", async () => {
    async function measure(consumer: string, load: boolean): Promise<number[]> {
      if (load) await insertEvents(5);
      const relay = new OutboxRelay(bus!, { consumer, pollIntervalMs: 160, batchSize: 1 });
      const controller = new AbortController();
      const starts: number[] = [];
      await relay.run(async () => {}, {
        signal: controller.signal,
        onPoll: (startedAt) => {
          starts.push(startedAt);
          if (starts.length === 6) controller.abort();
        },
      });
      return starts.slice(1).map((value, index) => value - starts[index]!);
    }

    const idle = await measure("order-023-poll-idle", false);
    const loaded = await measure("order-023-poll-load", true);
    expect([...idle, ...loaded].every((interval) => interval >= 100 && interval <= 250)).toBe(true);
  }, 10_000);

  test("P5: two relay instances using one consumer never double-apply an effect", async () => {
    const events = await insertEvents(40);
    const relayA = new OutboxRelay(bus!, { consumer: "order-023-concurrent", batchSize: 100 });
    const relayB = new OutboxRelay(bus!, { consumer: "order-023-concurrent", batchSize: 100 });
    const effects = new Map<string, number>();
    const handler = async (event: OutboxEvent) => {
      effects.set(event.id, (effects.get(event.id) ?? 0) + 1);
      await Bun.sleep(1);
    };
    await Promise.all([relayA.drainOnce(handler), relayB.drainOnce(handler)]);
    await drain(relayA, handler);
    expect(effects.size).toBe(events.length);
    expect([...effects.values()].every((count) => count === 1)).toBe(true);
  });

  test("P6: a 10,000-row backlog drains in bounded batches and memory", async () => {
    await insertEvents(10_000);
    const relay = new OutboxRelay(bus!, { consumer: "order-023-backlog", batchSize: 250 });
    const before = process.memoryUsage().rss;
    let examined = 0;
    let largestBatch = 0;
    let batches = 0;
    while (true) {
      const result = await relay.drainOnce(async () => {});
      if (result.examined === 0) break;
      examined += result.examined;
      largestBatch = Math.max(largestBatch, result.examined);
      batches += 1;
    }
    const growth = process.memoryUsage().rss - before;
    expect(examined).toBe(10_000);
    expect(largestBatch).toBe(250);
    expect(batches).toBe(40);
    expect(growth).toBeLessThan(128 * 1024 * 1024);
  }, 60_000);

  test("D-94: prune removes dedupe only with old published rows", async () => {
    const [published, unpublished] = await insertEvents(2);
    await admin!`
      INSERT INTO consumer_processed (consumer, outbox_id, processed_at)
      VALUES
        ('order-023-prune', ${published!.id}::uuid, now() - interval '40 days'),
        ('order-023-prune', ${unpublished!.id}::uuid, now() - interval '40 days')
    `;
    await admin!`
      UPDATE outbox
      SET published_at = CASE WHEN id = ${published!.id}::uuid THEN now() - interval '40 days' ELSE NULL END
      WHERE id IN (${published!.id}::uuid, ${unpublished!.id}::uuid)
    `;
    const result = await new OutboxRelay(bus!, { consumer: "order-023-prune" }).prune(30 * 24 * 60 * 60);
    expect(result).toEqual({ processed: 1, outbox: 1 });
    const survivors = await admin!<Array<{ outbox_id: string }>>`
      SELECT outbox_id FROM consumer_processed WHERE consumer = 'order-023-prune'
    `;
    expect(survivors).toEqual([{ outbox_id: unpublished!.id }]);
  });
});
