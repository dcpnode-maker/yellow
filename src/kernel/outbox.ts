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

async function enterHandlerTenant(
  connection: Tx,
  event: OutboxEvent,
  activeTenantId: string | null,
): Promise<string> {
  if (activeTenantId === event.tenantId) return activeTenantId;
  if (activeTenantId !== null) await connection.unsafe("RESET ROLE");
  const rows = await connection.unsafe<Array<{ tenant_id: string }>>(
    "SELECT set_config('app.tenant_id', $1, true) AS tenant_id",
    [event.tenantId],
  );
  if (rows.length !== 1 || rows[0]?.tenant_id !== event.tenantId) {
    throw new Error("PostgreSQL did not establish the required outbox handler tenant");
  }
  await connection.unsafe("SET LOCAL ROLE app_role");
  return event.tenantId;
}

async function verifyHandlerTenant(connection: Tx, event: OutboxEvent): Promise<void> {
  const rows = await connection.unsafe<Array<{ current_role: string; tenant_id: string | null }>>(`
    SELECT current_user::text AS current_role,
           current_setting('app.tenant_id', true) AS tenant_id
  `);
  const context = rows[0];
  if (rows.length !== 1 || context?.current_role !== "app_role" || context.tenant_id !== event.tenantId) {
    throw new Error("Outbox handler changed its required database role or tenant context");
  }
}

async function scrubHandlerSession(connection: Tx): Promise<void> {
  await connection.unsafe("RESET ROLE");
  await connection.unsafe("RESET app.tenant_id");
  const rows = await connection.unsafe<Array<{
    current_user: string;
    session_user: string;
    tenant_reset: boolean;
  }>>(`
    SELECT current_user::text AS current_user,
           session_user::text AS session_user,
           NULLIF(current_setting('app.tenant_id', true), '') IS NULL AS tenant_reset
  `);
  const row = rows[0];
  if (rows.length !== 1 || row?.current_user !== "yellow_runtime" ||
      row.session_user !== "yellow_runtime" || row.tenant_reset !== true) {
    throw new Error("Outbox handler session did not return to the runtime tenant baseline");
  }
}

export class PostgresEventBus implements EventBus {
  readonly #pool: ConnectionPool;
  #failureClose: Promise<void> | undefined;

  constructor(pool: ConnectionPool) {
    this.#pool = pool;
  }

  async #assertSettlement(connection: Tx): Promise<void> {
    const rows = await connection.unsafe<Array<{
      session_user: string;
      current_user: string;
      tenant_reset: boolean;
      prepared_count: number;
    }>>(`
      SELECT session_user::text AS session_user,
             current_user::text AS current_user,
             NULLIF(current_setting('app.tenant_id', true), '') IS NULL AS tenant_reset,
             (SELECT count(*)::int FROM pg_prepared_statements) AS prepared_count
    `);
    const row = rows[0];
    if (rows.length !== 1 || row?.session_user !== "yellow_runtime" ||
        row.current_user !== "yellow_runtime" || row.tenant_reset !== true || row.prepared_count !== 0) {
      throw new Error("Outbox connection did not settle to the unprepared runtime identity");
    }
  }

  async #discardAndAssertSettlement(connection: Tx): Promise<void> {
    await connection.unsafe("DISCARD ALL");
    await this.#assertSettlement(connection);
  }

  async #failClosePool(connection: Tx): Promise<void> {
    let closing = this.#failureClose;
    if (!closing) {
      const close = this.#pool.close;
      if (!close) return;
      try {
        // Start and cache whole-pool shutdown before returning this unusable
        // reservation. Bun can then dispose it instead of making it reusable.
        closing = close.call(this.#pool, { timeout: 0 });
        this.#failureClose = closing;
      } catch {
        return;
      }
    }
    try { connection.release(); } catch { /* Preserve the consumer failure. */ }
    try { await closing; } catch { /* Preserve the consumer failure. */ }
  }

  async #markBatch(
    connection: Tx,
    consumer: string,
    rows: readonly OutboxRow[],
  ): Promise<readonly boolean[]> {
    if (rows.length === 0) return [];
    const encodedIds = JSON.stringify(rows.map(({ id }) => id));
    const marked = await connection<Array<{ ordinality: number | bigint; inserted: boolean }>>`
      WITH input AS MATERIALIZED (
        SELECT value::uuid AS id, ordinality
        FROM jsonb_array_elements_text(${encodedIds}::text::jsonb)
          WITH ORDINALITY AS values(value, ordinality)
        ORDER BY ordinality
      ), marked AS MATERIALIZED (
        SELECT input.ordinality,
               runtime_consumer_mark(${consumer}, input.id) AS inserted
        FROM input
        ORDER BY input.ordinality
      )
      SELECT ordinality, inserted
      FROM marked
      ORDER BY ordinality
    `;
    if (marked.length !== rows.length || marked.some(({ ordinality }, index) => Number(ordinality) !== index + 1)) {
      throw new Error("PostgreSQL did not return ordered consumer dedupe markers");
    }
    return marked.map(({ inserted }) => inserted);
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
    const { events: _events, ...result } = await this.#consume(consumer, handler, options, false);
    return result;
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
    return this.#consume(consumer, handler, options, true);
  }

  async #consume(
    consumer: string,
    handler: EventHandler,
    options: ConsumeBatchOptions,
    unpublished: boolean,
  ): Promise<ConsumedOutboxBatch> {
    if (!CONSUMER_NAME.test(consumer)) throw new Error("consumer must be a stable lowercase name");
    const limit = batchSize(options);
    const connection = await this.#pool.reserve();
    let began = false;
    let settled = false;
    let reusable = false;
    let mustClosePool = false;

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
        FROM runtime_consumer_read(${consumer}, ${initialLastSeq}::bigint, ${limit}, ${unpublished})
      `;

      const inserted = await this.#markBatch(connection, consumer, rows);
      let processed = 0;
      let lastSeq = initialLastSeq;
      const events: OutboxEvent[] = [];
      let activeTenantId: string | null = null;
      for (const [index, row] of rows.entries()) {
        const event = toEvent(row);
        events.push(event);
        if (inserted[index] === true) {
          activeTenantId = await enterHandlerTenant(connection, event, activeTenantId);
          await handler(event, connection);
          await verifyHandlerTenant(connection, event);
          processed += 1;
        } else if (activeTenantId !== null && activeTenantId !== event.tenantId) {
          await connection.unsafe("RESET ROLE");
          activeTenantId = null;
        }
        lastSeq = Math.max(lastSeq, event.seq);
      }

      try {
        await scrubHandlerSession(connection);
      } catch (error) {
        mustClosePool = true;
        throw error;
      }
      if (lastSeq !== initialLastSeq) {
        await connection.unsafe("SELECT runtime_consumer_advance($1, $2::bigint)", [consumer, lastSeq]);
      }
      try {
        await connection.unsafe("COMMIT");
      } catch (error) {
        mustClosePool = true;
        throw error;
      }
      began = false;
      settled = true;
      await this.#assertSettlement(connection);
      reusable = true;
      return { consumer, examined: rows.length, processed, lastSeq, events };
    } catch (error) {
      if (began) {
        try {
          await connection.unsafe("ROLLBACK");
          began = false;
          settled = true;
          if (!mustClosePool) {
            try {
              await this.#assertSettlement(connection);
              reusable = true;
            } catch {
              // DISCARD ALL and an exact recheck run while the backend remains reserved.
            }
          }
        } catch {
          mustClosePool = true;
        }
      }
      throw error;
    } finally {
      if (!reusable && settled && !mustClosePool) {
        try {
          await this.#discardAndAssertSettlement(connection);
          reusable = true;
        } catch {
          mustClosePool = true;
        }
      }
      if (!reusable || mustClosePool) await this.#failClosePool(connection);
      if (reusable && !mustClosePool) connection.release();
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
