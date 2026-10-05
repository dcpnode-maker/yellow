import { describe, expect, test } from "bun:test";

import { ArrivalPickupTaskAutomationConsumer } from "../src/contexts/stay-operations";
import type {
  ConsumeBatchResult,
  EventBus,
  EventHandler,
  OutboxEvent,
  PublishEventInput,
  Tx,
} from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000021301";
const PROPERTY = "00000000-0000-0000-0000-000000021302";
const RESERVATION = "00000000-0000-0000-0000-000000021303";
const ACTOR = "00000000-0000-0000-0000-000000021304";
const CORRELATION = "00000000-0000-0000-0000-000000021305";
const SOURCE_EVENT = "00000000-0000-0000-0000-000000021306";
const TASK = "00000000-0000-0000-0000-000000021307";
const FACT = "00000000-0000-0000-0000-000000021308";
const DUE = "2027-05-06T07:30:00.000Z";

function source(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    seq: 1,
    id: SOURCE_EVENT,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    businessDate: "2027-05-06",
    aggregateType: "reservation",
    aggregateId: RESERVATION,
    eventType: "reservation.modified",
    eventVersion: 1,
    actorId: ACTOR,
    correlationId: CORRELATION,
    causationId: null,
    occurredAt: new Date("2027-05-05T12:00:00.000Z"),
    payload: Object.freeze({ hostile: "ignored", diff: { travel: { pickupRequested: false } } }),
    ...overrides,
  };
}

interface CapabilityEvidence {
  readonly task_id: string | null;
  readonly created: boolean;
  readonly due_at: Date | string | null;
}

interface FakeTxResult {
  readonly tx: Tx;
  readonly statements: string[];
}

function fakeTx(evidence: CapabilityEvidence): FakeTxResult {
  const statements: string[] = [];
  const tx = (async (strings: TemplateStringsArray) => {
    const statement = strings.join("?");
    statements.push(statement);
    if (statement.includes("govern_arrival_pickup_task")) return [evidence];
    if (statement.includes("INSERT INTO fact_log")) {
      return [{
        id: FACT,
        tenant_id: TENANT,
        entity_type: "task",
        entity_id: TASK,
        fact_type: "task.created",
        valid_from: new Date("2027-05-05T12:00:01.000Z"),
        recorded_at: new Date("2027-05-05T12:00:01.000Z"),
        business_date: "2027-05-06",
        actor_id: ACTOR,
        payload: {},
        supersedes: null,
      }];
    }
    throw new Error(`Unexpected SQL: ${statement}`);
  }) as unknown as Tx;
  return { tx, statements };
}

class FakeBus implements EventBus {
  readonly events: readonly OutboxEvent[];
  readonly tx: Tx;
  readonly published: Array<PublishEventInput> = [];
  consumer = "";
  limit = 0;

  constructor(events: readonly OutboxEvent[], tx: Tx) {
    this.events = events;
    this.tx = tx;
  }

  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    expect(tx).toBe(this.tx);
    this.published.push(event);
    return source({
      seq: 100 + this.published.length,
      id: FACT,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      actorId: event.actorId,
      correlationId: event.correlationId,
      causationId: event.causationId ?? null,
      payload: event.payload,
    });
  }

  async consumeBatch(
    consumer: string,
    handler: EventHandler,
    options: { readonly limit?: number } = {},
  ): Promise<ConsumeBatchResult> {
    this.consumer = consumer;
    this.limit = options.limit ?? 0;
    for (const event of this.events) await handler(event, this.tx);
    return {
      consumer,
      examined: this.events.length,
      processed: this.events.length,
      lastSeq: this.events.at(-1)?.seq ?? 0,
    };
  }
}

describe("Order 213 durable arrival pickup-task consumer", () => {
  test("qualifying current truth calls only the owner capability and copies exact evidence", async () => {
    const { tx, statements } = fakeTx({ task_id: TASK, created: true, due_at: DUE });
    const bus = new FakeBus([source()], tx);
    const result = await new ArrivalPickupTaskAutomationConsumer(bus).drainOnce();

    expect(result).toEqual({
      consumer: "arrival-pickup-task", examined: 1, processed: 1, lastSeq: 1, created: 1,
    });
    expect(bus.consumer).toBe("arrival-pickup-task");
    expect(bus.limit).toBe(25);
    expect(statements.filter((sql) => sql.includes("govern_arrival_pickup_task"))).toHaveLength(1);
    expect(statements.filter((sql) => sql.includes("INSERT INTO fact_log"))).toHaveLength(1);
    expect(bus.published).toEqual([{
      tenantId: TENANT,
      propertyNode: PROPERTY,
      businessDate: "2027-05-06",
      aggregateType: "task",
      aggregateId: TASK,
      eventType: "task.created",
      actorId: ACTOR,
      correlationId: CORRELATION,
      causationId: SOURCE_EVENT,
      payload: {
        taskId: TASK,
        kind: "guest_request",
        subjectType: "reservation",
        subjectId: RESERVATION,
        department: "transport",
        dueAt: DUE,
      },
    }]);
  });

  test("unrelated source events are acknowledged without SQL and minimized diff is never command truth", async () => {
    const { tx, statements } = fakeTx({ task_id: TASK, created: true, due_at: DUE });
    const bus = new FakeBus([
      source({ eventType: "reservation.created", seq: 1 }),
      source({ aggregateType: "task", seq: 2 }),
    ], tx);
    const result = await new ArrivalPickupTaskAutomationConsumer(bus).drainOnce();
    expect(result).toMatchObject({ processed: 2, created: 0 });
    expect(statements).toEqual([]);
    expect(bus.published).toEqual([]);

    const currentTruth = new FakeBus([source({
      payload: Object.freeze({ diff: { travel: { pickupRequested: false, scheduledAt: null } } }),
    })], tx);
    expect(await new ArrivalPickupTaskAutomationConsumer(currentTruth).drainOnce()).toMatchObject({ created: 1 });
  });

  test("ineligible and already-linked current truth emit no fact or event", async () => {
    for (const evidence of [
      { task_id: null, created: false, due_at: null },
      { task_id: TASK, created: false, due_at: DUE },
    ] satisfies CapabilityEvidence[]) {
      const { tx, statements } = fakeTx(evidence);
      const bus = new FakeBus([source()], tx);
      expect(await new ArrivalPickupTaskAutomationConsumer(bus).drainOnce()).toMatchObject({ created: 0 });
      expect(statements.filter((sql) => sql.includes("govern_arrival_pickup_task"))).toHaveLength(1);
      expect(statements.some((sql) => sql.includes("INSERT INTO fact_log"))).toBeFalse();
      expect(bus.published).toEqual([]);
    }
  });

  test("malformed source or capability evidence fails closed for transactional retry", async () => {
    const malformedSources = [
      source({ propertyNode: null }),
      source({ actorId: null }),
      source({ aggregateId: "not-a-reservation" }),
    ];
    for (const event of malformedSources) {
      const { tx } = fakeTx({ task_id: TASK, created: true, due_at: DUE });
      await expect(new ArrivalPickupTaskAutomationConsumer(new FakeBus([event], tx)).drainOnce()).rejects.toThrow();
    }

    for (const evidence of [
      { task_id: null, created: true, due_at: DUE },
      { task_id: TASK, created: true, due_at: null },
      { task_id: TASK, created: false, due_at: null },
      { task_id: null, created: false, due_at: DUE },
    ] satisfies CapabilityEvidence[]) {
      const { tx } = fakeTx(evidence);
      await expect(new ArrivalPickupTaskAutomationConsumer(new FakeBus([source()], tx)).drainOnce()).rejects.toThrow();
    }
  });

  test("bounded polling retries serially, reports results and aborts cleanly", async () => {
    const { tx } = fakeTx({ task_id: null, created: false, due_at: null });
    let attempts = 0;
    let active = 0;
    let maxActive = 0;
    const bus = new FakeBus([], tx);
    bus.consumeBatch = async (consumer): Promise<ConsumeBatchResult> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      const attempt = ++attempts;
      await Bun.sleep(5);
      active -= 1;
      if (attempt === 1) throw new Error("transient pickup poll");
      return { consumer, examined: 0, processed: 0, lastSeq: 0 };
    };
    const abort = new AbortController();
    const errors: unknown[] = [];
    const results: unknown[] = [];
    await Promise.race([
      new ArrivalPickupTaskAutomationConsumer(bus, { pollIntervalMs: 100 }).run({
        signal: abort.signal,
        onError: (error) => errors.push(error),
        onResult: (result) => { results.push(result); abort.abort(); },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("pickup worker did not stop")), 1_000)),
    ]);
    expect(errors).toHaveLength(1);
    expect(results).toEqual([{
      consumer: "arrival-pickup-task", examined: 0, processed: 0, lastSeq: 0, created: 0,
    }]);
    expect(attempts).toBe(2);
    expect(maxActive).toBe(1);

    expect(() => new ArrivalPickupTaskAutomationConsumer(bus, { batchSize: 0 })).toThrow();
    expect(() => new ArrivalPickupTaskAutomationConsumer(bus, { batchSize: 101 })).toThrow();
    expect(() => new ArrivalPickupTaskAutomationConsumer(bus, { pollIntervalMs: 99 })).toThrow();
    expect(() => new ArrivalPickupTaskAutomationConsumer(bus, { pollIntervalMs: 60_001 })).toThrow();
  });
});
