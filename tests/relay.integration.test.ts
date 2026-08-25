import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { OutboxRelay, PostgresEventBus, type OutboxEvent } from "../src/kernel";

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_OUTBOX_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL ?? process.env.YELLOW_OUTBOX_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RELAY === "1";
const TENANT = "00000000-0000-0000-0000-000000000001";
const PROPERTY = "00000000-0000-0000-0000-000000000012";
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

async function seedConsumerCursor(consumer: string): Promise<void> {
  await admin!`DELETE FROM consumer_processed WHERE consumer = ${consumer}`;
  const rows = await admin!<{ lastSeq: number }[]>`
    SELECT COALESCE(max(seq), 0)::int AS "lastSeq" FROM outbox
  `;
  await admin!`
    INSERT INTO consumer_cursor (consumer, last_seq)
    VALUES (${consumer}, ${rows[0]?.lastSeq ?? 0}::bigint)
    ON CONFLICT (consumer) DO UPDATE SET last_seq = EXCLUDED.last_seq
  `;
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
  pool = new SQL(RUNTIME_DATABASE_URL, { max: 12 });
  bus = new PostgresEventBus(pool);
  // Order proofs own the relay's pending queue; isolate it from prior local test data.
  await admin`UPDATE outbox SET published_at = now() WHERE published_at IS NULL`;
});

afterAll(async () => {
  if (admin) {
    await admin`DELETE FROM task WHERE payload->>'proof' = 'order-023'`;
    await admin`DELETE FROM consumer_processed WHERE consumer IN ${admin(CONSUMERS)}`;
    await admin`DELETE FROM consumer_cursor WHERE consumer IN ${admin(CONSUMERS)}`;
    if (correlations.size > 0) {
      await admin`DELETE FROM outbox WHERE correlation_id IN ${admin([...correlations])}`;
    }
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
      const pool = new SQL(process.env.YELLOW_RUNTIME_DATABASE_URL, { max: 1 });
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
  });

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
