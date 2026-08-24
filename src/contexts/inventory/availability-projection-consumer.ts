import type { ConsumeBatchResult, EventBus, OutboxEvent, Tx } from "../../kernel";
import type { ProjectionRebuildResult, RebuildAvailabilityProjectionInput } from "./availability-projection";

const CONSUMER = "availability-projection";
const PERIOD_EVENTS = new Set(["occupancy.recorded", "occupancy.released", "ooo.opened", "ooo.closed"]);
const HORIZON_EVENTS = new Set([
  "inventory.policy.changed", "space.created", "unit_type.created", "sellable_unit.created",
]);
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_POLL_INTERVAL_MS = 1_000;

interface ProjectionRebuilder {
  rebuild(tx: Tx, input: RebuildAvailabilityProjectionInput): Promise<ProjectionRebuildResult>;
}

interface DateEnvelope {
  readonly from_date: string | null;
  readonly to_date: string | null;
}

export interface AvailabilityProjectionConsumerOptions {
  readonly batchSize?: number;
  readonly pollIntervalMs?: number;
}

export interface AvailabilityProjectionDrainResult extends ConsumeBatchResult {
  readonly rebuilt: number;
}

export interface AvailabilityProjectionRunOptions {
  readonly signal?: AbortSignal;
  readonly onResult?: (result: AvailabilityProjectionDrainResult) => void;
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

async function propertyPeriodEnvelope(tx: Tx, event: OutboxEvent): Promise<DateEnvelope> {
  if (!event.propertyNode) throw new Error("Relevant projection event requires a property");
  if (typeof event.payload.period !== "string") throw new Error("Relevant projection event requires a tstzrange period");
  const rows = await tx.unsafe<DateEnvelope[]>(`
    SELECT
      (lower(candidate.period) AT TIME ZONE property.timezone)::date::text AS from_date,
      (((upper(candidate.period) - interval '1 microsecond') AT TIME ZONE property.timezone)::date + 1)::text AS to_date
    FROM org_node AS property
    CROSS JOIN LATERAL (SELECT $2::tstzrange AS period) AS candidate
    WHERE property.id = $1::uuid
      AND property.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND property.kind = 'property'
      AND NOT isempty(candidate.period)
      AND lower(candidate.period) IS NOT NULL
      AND upper(candidate.period) IS NOT NULL
      AND lower_inc(candidate.period)
      AND NOT upper_inc(candidate.period)
      AND lower(candidate.period) < upper(candidate.period)
  `, [event.propertyNode, event.payload.period]);
  const row = rows[0];
  if (!row?.from_date || !row.to_date) throw new Error("Relevant projection event has an invalid property or period");
  return row;
}

async function propertyHorizon(tx: Tx, event: OutboxEvent): Promise<DateEnvelope> {
  if (!event.propertyNode) throw new Error("Relevant projection event requires a property");
  const rows = await tx.unsafe<DateEnvelope[]>(`
    SELECT min(projection.stay_date)::text AS from_date,
           (max(projection.stay_date) + 1)::text AS to_date
    FROM org_node AS property
    LEFT JOIN availability_projection AS projection
      ON projection.tenant_id = property.tenant_id
     AND projection.property_node = property.id
    WHERE property.id = $1::uuid
      AND property.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND property.kind = 'property'
    GROUP BY property.id
  `, [event.propertyNode]);
  const row = rows[0];
  if (!row) throw new Error("Relevant projection event property was not found");
  return row;
}

export class AvailabilityProjectionConsumer {
  readonly #events: EventBus;
  readonly #projection: ProjectionRebuilder;
  readonly #batchSize: number;
  readonly #pollIntervalMs: number;

  constructor(events: EventBus, projection: ProjectionRebuilder, options: AvailabilityProjectionConsumerOptions = {}) {
    this.#events = events;
    this.#projection = projection;
    this.#batchSize = bounded("batchSize", options.batchSize ?? DEFAULT_BATCH_SIZE, 1, 100);
    this.#pollIntervalMs = bounded("pollIntervalMs", options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS, 100, 60_000);
  }

  async drainOnce(): Promise<AvailabilityProjectionDrainResult> {
    let rebuilt = 0;
    const result = await this.#events.consumeBatch(CONSUMER, async (event, tx) => {
      let envelope: DateEnvelope;
      if (PERIOD_EVENTS.has(event.eventType)) envelope = await propertyPeriodEnvelope(tx, event);
      else if (HORIZON_EVENTS.has(event.eventType)) envelope = await propertyHorizon(tx, event);
      else return;
      if (!envelope.from_date || !envelope.to_date) return;
      await this.#projection.rebuild(tx, {
        propertyNode: event.propertyNode!, fromDate: envelope.from_date, toDate: envelope.to_date,
      });
      rebuilt += 1;
    }, { limit: this.#batchSize });
    return { ...result, rebuilt };
  }

  async run(options: AvailabilityProjectionRunOptions = {}): Promise<void> {
    while (!options.signal?.aborted) {
      const started = Date.now();
      try {
        const result = await this.drainOnce();
        options.onResult?.(result);
      }
      catch (error) { options.onError?.(error); }
      await wait(Math.max(0, this.#pollIntervalMs - (Date.now() - started)), options.signal);
    }
  }
}
