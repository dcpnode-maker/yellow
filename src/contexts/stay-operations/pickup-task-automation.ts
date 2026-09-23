import {
  createAuditEnvelope,
  recordFact,
  type ConsumeBatchResult,
  type EventBus,
  type OutboxEvent,
  type Tx,
} from "../../kernel";

const CONSUMER = "arrival-pickup-task";
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface CapabilityRow {
  readonly task_id: string | null;
  readonly created: boolean;
  readonly due_at: Date | string | null;
}

export interface ArrivalPickupTaskAutomationOptions {
  readonly batchSize?: number;
  readonly pollIntervalMs?: number;
}

export interface ArrivalPickupTaskAutomationDrainResult extends ConsumeBatchResult {
  readonly created: number;
}

export interface ArrivalPickupTaskAutomationRunOptions {
  readonly signal?: AbortSignal;
  readonly onResult?: (result: ArrivalPickupTaskAutomationDrainResult) => void;
  readonly onError?: (error: unknown) => void;
}

function bounded(name: string, value: number, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
    const timer = setTimeout(finish, milliseconds);
    const abort = () => { clearTimeout(timer); finish(); };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new Error(`Pickup-task automation received an invalid ${subject}`);
  }
  return value;
}

function dueInstant(value: Date | string | null): string | null {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("Pickup-task automation received an invalid due instant");
  }
  return parsed.toISOString();
}

function isReservationModification(event: OutboxEvent): boolean {
  return event.eventType === "reservation.modified" && event.aggregateType === "reservation";
}

async function createFromCurrentTruth(events: EventBus, event: OutboxEvent, tx: Tx): Promise<boolean> {
  if (!isReservationModification(event)) return false;
  if (event.propertyNode === null || event.actorId === null) {
    throw new Error("Reservation modification requires property and actor evidence");
  }

  const tenantId = uuid(event.tenantId, "tenant id");
  const propertyNode = uuid(event.propertyNode, "property id");
  const reservationId = uuid(event.aggregateId, "reservation id");
  const actorId = uuid(event.actorId, "source actor id");
  const correlationId = uuid(event.correlationId, "source correlation id");
  const sourceEventId = uuid(event.id, "source event id");
  const rows = await tx<CapabilityRow[]>`
    SELECT task_id, created, due_at
    FROM public.govern_arrival_pickup_task(
      ${tenantId}::uuid,
      ${propertyNode}::uuid,
      ${reservationId}::uuid,
      ${actorId}::uuid
    )
  `;
  const row = rows[0];
  if (rows.length !== 1 || !row || typeof row.created !== "boolean") {
    throw new Error("Pickup-task capability returned invalid evidence");
  }

  const dueAt = dueInstant(row.due_at);
  if (!row.created) {
    if ((row.task_id === null) !== (dueAt === null)) {
      throw new Error("Pickup-task capability returned incoherent existing evidence");
    }
    if (row.task_id !== null) uuid(row.task_id, "linked task id");
    return false;
  }

  const taskId = uuid(row.task_id, "created task id");
  if (dueAt === null) throw new Error("Pickup-task capability omitted the created task due instant");
  const envelope = createAuditEnvelope({
    actorId,
    tenantId,
    propertyNode,
    requestId: correlationId,
    operation: "task.created",
  });
  const payload = Object.freeze({
    taskId,
    kind: "guest_request",
    subjectType: "reservation",
    subjectId: reservationId,
    department: "transport",
    dueAt,
  });
  const fact = await recordFact(tx, {
    entityType: "task",
    entityId: taskId,
    envelope,
    payload,
  });
  await events.publish(tx, {
    tenantId,
    propertyNode,
    businessDate: fact.businessDate,
    aggregateType: "task",
    aggregateId: taskId,
    eventType: "task.created",
    actorId,
    correlationId,
    causationId: sourceEventId,
    payload,
  });
  return true;
}

export class ArrivalPickupTaskAutomationConsumer {
  readonly #events: EventBus;
  readonly #batchSize: number;
  readonly #pollIntervalMs: number;

  constructor(events: EventBus, options: ArrivalPickupTaskAutomationOptions = {}) {
    this.#events = events;
    this.#batchSize = bounded("batchSize", options.batchSize ?? DEFAULT_BATCH_SIZE, 1, 100);
    this.#pollIntervalMs = bounded(
      "pollIntervalMs",
      options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      100,
      60_000,
    );
  }

  async drainOnce(): Promise<ArrivalPickupTaskAutomationDrainResult> {
    let created = 0;
    const result = await this.#events.consumeBatch(CONSUMER, async (event, tx) => {
      if (await createFromCurrentTruth(this.#events, event, tx)) created += 1;
    }, { limit: this.#batchSize });
    return { ...result, created };
  }

  async run(options: ArrivalPickupTaskAutomationRunOptions = {}): Promise<void> {
    while (!options.signal?.aborted) {
      const started = Date.now();
      try {
        const result = await this.drainOnce();
        options.onResult?.(result);
      } catch (error) {
        options.onError?.(error);
      }
      await wait(Math.max(0, this.#pollIntervalMs - (Date.now() - started)), options.signal);
    }
  }
}
