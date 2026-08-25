import type { ConnectionPool, Tx } from "./db";
import type {
  ConsumeBatchOptions,
  ConsumeBatchResult,
  EventBus,
  EventHandler,
  OutboxEvent,
  PublishEventInput,
} from "./event-bus";

const OUTBOX_PUBLISH_LOCK = 6_441_674_055_002_974_568n;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BUSINESS_DATE = /^\d{4}-\d{2}-\d{2}$/;
const STABLE_NAME = /^[a-z][a-z0-9_.-]*$/;
const CONSUMER_NAME = /^[a-z][a-z0-9-]*$/;
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 1_000;

interface OutboxRow {
  readonly seq: number | bigint;
  readonly id: string;
  readonly tenant_id: string;
  readonly property_node: string | null;
  readonly business_date: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly event_type: string;
  readonly event_version: number;
  readonly actor_id: string | null;
  readonly correlation_id: string;
  readonly causation_id: string | null;
  readonly created_at: Date;
  readonly payload: Record<string, unknown>;
}

export interface ConsumedOutboxBatch extends ConsumeBatchResult {
  readonly events: readonly OutboxEvent[];
}

function requiredUuid(name: string, value: string): void {
  if (!UUID.test(value)) throw new Error(`${name} must be a UUID`);
}

function optionalUuid(name: string, value: string | null | undefined): void {
  if (value !== null && value !== undefined) requiredUuid(name, value);
}

function toSequence(value: number | bigint): number {
  const sequence = Number(value);
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("Outbox seq exceeds safe integer range");
  return sequence;
}

function toEvent(row: OutboxRow): OutboxEvent {
  return {
    seq: toSequence(row.seq),
    id: row.id,
    tenantId: row.tenant_id,
    propertyNode: row.property_node,
    businessDate: row.business_date,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    actorId: row.actor_id,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    occurredAt: row.created_at,
    payload: row.payload,
  };
}

function validateEvent(event: PublishEventInput): void {
  requiredUuid("tenantId", event.tenantId);
  optionalUuid("propertyNode", event.propertyNode);
  requiredUuid("aggregateId", event.aggregateId);
  optionalUuid("actorId", event.actorId);
  requiredUuid("correlationId", event.correlationId);
  optionalUuid("causationId", event.causationId);
  if (!BUSINESS_DATE.test(event.businessDate)) throw new Error("businessDate must be YYYY-MM-DD");
  if (!STABLE_NAME.test(event.aggregateType)) throw new Error("aggregateType must be a stable lowercase identifier");
  if (!STABLE_NAME.test(event.eventType) || !event.eventType.includes(".")) {
    throw new Error("eventType must map directly to the EVENTS.md dotted catalogue");
  }
  const version = event.eventVersion ?? 1;
  if (!Number.isSafeInteger(version) || version < 1) throw new Error("eventVersion must be a positive integer");
  if (typeof event.payload !== "object" || event.payload === null || Array.isArray(event.payload)) {
    throw new Error("event payload must be an object of facts");
  }
}

function batchSize(options: ConsumeBatchOptions): number {
  const limit = options.limit ?? DEFAULT_BATCH_SIZE;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH_SIZE) {
    throw new Error(`consumer batch limit must be between 1 and ${MAX_BATCH_SIZE}`);
  }
  return limit;
}

async function runHandlerAsTenant(connection: Tx, event: OutboxEvent, handler: EventHandler): Promise<void> {
  await connection`SELECT set_config('app.tenant_id', ${event.tenantId}, true)`;
  await connection.unsafe("SET LOCAL ROLE app_role");
  let failure: unknown;

  try {
    await handler(event, connection);
  } catch (error) {
    failure = error;
  }

  try {
    await connection.unsafe("RESET ROLE");
  } catch (resetError) {
    if (failure === undefined) throw resetError;
  }
  if (failure !== undefined) throw failure;
}

export class PostgresEventBus implements EventBus {
  readonly #pool: ConnectionPool;

  constructor(pool: ConnectionPool) {
    this.#pool = pool;
  }

  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    validateEvent(event);
    await tx`SELECT pg_advisory_xact_lock(${OUTBOX_PUBLISH_LOCK})`;

    const payload = JSON.stringify(event.payload);
    const rows = await tx<OutboxRow[]>`
      INSERT INTO outbox (
        tenant_id,
        property_node,
        business_date,
        aggregate_type,
        aggregate_id,
        event_type,
        event_version,
        actor_id,
        correlation_id,
        causation_id,
        payload
      )
      VALUES (
        ${event.tenantId}::uuid,
        ${event.propertyNode}::uuid,
        ${event.businessDate}::date,
        ${event.aggregateType},
        ${event.aggregateId}::uuid,
        ${event.eventType},
        ${event.eventVersion ?? 1},
        ${event.actorId}::uuid,
        ${event.correlationId}::uuid,
        ${event.causationId ?? null}::uuid,
        ${payload}::text::jsonb
      )
      RETURNING
        seq,
        id,
        tenant_id,
        property_node,
        business_date::text,
        aggregate_type,
        aggregate_id,
        event_type,
        event_version,
        actor_id,
        correlation_id,
        causation_id,
        created_at,
        payload
    `;
    const row = rows[0];
    if (!row) throw new Error("PostgreSQL did not return the published event");
    return toEvent(row);
  }

  async consumeBatch(
    consumer: string,
    handler: EventHandler,
    options: ConsumeBatchOptions = {},
  ): Promise<ConsumeBatchResult> {
    if (!CONSUMER_NAME.test(consumer)) throw new Error("consumer must be a stable lowercase name");
    const limit = batchSize(options);
    const connection = await this.#pool.reserve();
    let began = false;

    try {
      await connection.unsafe("BEGIN");
      began = true;
      const cursorRows = await connection<Array<{ last_seq: number | bigint }>>`
        SELECT runtime_consumer_begin(${consumer}) AS last_seq
      `;
      const initialLastSeq = Number(cursorRows[0]?.last_seq ?? 0);
      if (!Number.isSafeInteger(initialLastSeq) || initialLastSeq < 0) {
        throw new Error("Consumer cursor is outside the supported sequence range");
      }

      const rows = await connection<OutboxRow[]>`
        SELECT
          seq,
          id,
          tenant_id,
          property_node,
          business_date::text,
          aggregate_type,
          aggregate_id,
          event_type,
          event_version,
          actor_id,
          correlation_id,
          causation_id,
          created_at,
          payload
        FROM runtime_consumer_read(${consumer}, ${initialLastSeq}::bigint, ${limit}, false)
      `;

      let processed = 0;
      let lastSeq = initialLastSeq;
      for (const row of rows) {
        const event = toEvent(row);
        const inserted = await connection<Array<{ inserted: boolean }>>`
          SELECT runtime_consumer_mark(${consumer}, ${event.id}::uuid) AS inserted
        `;
        if (inserted[0]?.inserted === true) {
          await runHandlerAsTenant(connection, event, handler);
          processed += 1;
        }
        lastSeq = event.seq;
      }

      if (lastSeq !== initialLastSeq) {
        await connection`SELECT runtime_consumer_advance(${consumer}, ${lastSeq}::bigint)`;
      }
      await connection.unsafe("COMMIT");
      began = false;
      return { consumer, examined: rows.length, processed, lastSeq };
    } catch (error) {
      if (began) {
        try {
          await connection.unsafe("ROLLBACK");
        } catch {
          // Preserve the consumer or handler failure; the broken reservation is discarded.
        }
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Processes rows that have not yet been acknowledged by the relay. The consumer
   * transaction deliberately does not set published_at: a crash after this method
   * commits is recovered by selecting the same unpublished rows and applying the
   * consumer_processed dedupe marker.
   */
  async consumeUnpublishedBatch(
    consumer: string,
    handler: EventHandler,
    options: ConsumeBatchOptions = {},
  ): Promise<ConsumedOutboxBatch> {
    if (!CONSUMER_NAME.test(consumer)) throw new Error("consumer must be a stable lowercase name");
    const limit = batchSize(options);
    const connection = await this.#pool.reserve();
    let began = false;

    try {
      await connection.unsafe("BEGIN");
      began = true;
      const cursorRows = await connection<Array<{ last_seq: number | bigint }>>`
        SELECT runtime_consumer_begin(${consumer}) AS last_seq
      `;
      const initialLastSeq = Number(cursorRows[0]?.last_seq ?? 0);
      if (!Number.isSafeInteger(initialLastSeq) || initialLastSeq < 0) {
        throw new Error("Consumer cursor is outside the supported sequence range");
      }

      const rows = await connection<OutboxRow[]>`
        SELECT
          seq,
          id,
          tenant_id,
          property_node,
          business_date::text,
          aggregate_type,
          aggregate_id,
          event_type,
          event_version,
          actor_id,
          correlation_id,
          causation_id,
          created_at,
          payload
        FROM runtime_consumer_read(${consumer}, ${initialLastSeq}::bigint, ${limit}, true)
      `;

      let processed = 0;
      let lastSeq = initialLastSeq;
      const events: OutboxEvent[] = [];
      for (const row of rows) {
        const event = toEvent(row);
        events.push(event);
        const inserted = await connection<Array<{ inserted: boolean }>>`
          SELECT runtime_consumer_mark(${consumer}, ${event.id}::uuid) AS inserted
        `;
        if (inserted[0]?.inserted === true) {
          await runHandlerAsTenant(connection, event, handler);
          processed += 1;
        }
        lastSeq = Math.max(lastSeq, event.seq);
      }

      if (lastSeq !== initialLastSeq) {
        await connection`SELECT runtime_consumer_advance(${consumer}, ${lastSeq}::bigint)`;
      }
      await connection.unsafe("COMMIT");
      began = false;
      return { consumer, examined: rows.length, processed, lastSeq, events };
    } catch (error) {
      if (began) {
        try {
          await connection.unsafe("ROLLBACK");
        } catch {
          // Preserve the consumer or handler failure; the broken reservation is discarded.
        }
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async markPublished(eventIds: readonly string[]): Promise<number> {
    if (eventIds.length === 0) return 0;
    for (const eventId of eventIds) requiredUuid("eventId", eventId);
    const encodedIds = JSON.stringify(eventIds);
    const connection = await this.#pool.reserve();
    let began = false;
    try {
      await connection.unsafe("BEGIN");
      began = true;
      const result = await connection<Array<{ count: number }>>`
        SELECT runtime_mark_outbox_published(
          ARRAY(
            SELECT value::uuid
            FROM jsonb_array_elements_text(${encodedIds}::text::jsonb)
          )
        ) AS count
      `;
      await connection.unsafe("COMMIT");
      began = false;
      return result[0]?.count ?? 0;
    } catch (error) {
      if (began) await connection.unsafe("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }

  async prunePublished(retentionSeconds: number): Promise<{ processed: number; outbox: number }> {
    if (!Number.isSafeInteger(retentionSeconds) || retentionSeconds < 0) {
      throw new Error("retentionSeconds must be a non-negative integer");
    }
    const connection = await this.#pool.reserve();
    let began = false;
    try {
      await connection.unsafe("BEGIN");
      began = true;
      const rows = await connection<Array<{ processed: number; outbox: number | bigint }>>`
        SELECT processed, outbox
        FROM runtime_prune_outbox(${retentionSeconds})
      `;
      await connection.unsafe("COMMIT");
      began = false;
      return {
        processed: rows[0]?.processed ?? 0,
        outbox: Number(rows[0]?.outbox ?? 0),
      };
    } catch (error) {
      if (began) await connection.unsafe("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }
}
