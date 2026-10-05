import {
  createAuditEnvelope,
  recordFact,
  type AuditEnvelope,
  type Database,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_POLL_INTERVAL_MS = 100;
const MAX_POLL_INTERVAL_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_SCOPE_BATCH_SIZE = 100;
const MAX_SCOPE_BATCH_SIZE = 100;
const DEFAULT_ARRIVAL_BATCH_SIZE = 100;
const MAX_ARRIVAL_BATCH_SIZE = 100;

export const RESERVATION_ARRIVAL_ROLL_ACTOR_ID = "00000000-0000-0000-0000-000000000057";

export interface DueArrivalScope {
  readonly tenantId: string;
  readonly propertyNode: string;
}

export interface DueArrivalScopeSource {
  listDueScopes(limit: number): Promise<readonly DueArrivalScope[]>;
}

export interface RollDueArrivalsInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly limit: number;
  readonly envelope: AuditEnvelope;
}

export interface RolledDueArrival extends Readonly<Record<string, JsonValue>> {
  readonly reservationId: string;
  readonly segmentId: string;
  readonly businessDate: string;
}

export interface ReservationArrivalRollResult {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly businessDate: string | null;
  readonly examined: number;
  readonly transitioned: number;
  readonly arrivals: readonly RolledDueArrival[];
}

export interface ReservationArrivalRollServiceOptions {
  readonly database: Database;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

export interface ReservationArrivalRollWorkerOptions {
  readonly actorId?: string;
  readonly pollIntervalMs?: number;
  readonly scopeBatchSize?: number;
  readonly arrivalBatchSize?: number;
}

export interface ReservationArrivalRollFailure extends DueArrivalScope {
  readonly error: string;
}

export interface ReservationArrivalRollDrainResult {
  readonly scopes: number;
  readonly examined: number;
  readonly transitioned: number;
  readonly failures: readonly ReservationArrivalRollFailure[];
}

export interface ReservationArrivalRollRunOptions {
  readonly signal?: AbortSignal;
  readonly onPoll?: (startedAt: number) => void;
  readonly onResult?: (result: ReservationArrivalRollDrainResult) => void;
  readonly onError?: (error: unknown) => void;
}

interface ArrivalCandidateRow {
  readonly reservation_id: string;
  readonly segment_id: string;
  readonly business_date: string;
}

interface BusinessDateRow {
  readonly business_date: string;
}

interface DueArrivalBody extends RolledDueArrival {}

type ArrivalRollOperations = Pick<ReservationArrivalRollService, "rollDueArrivals">;

export class ReservationArrivalRollValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationArrivalRollValidationError";
  }
}

export class ReservationArrivalRollConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationArrivalRollConflictError";
  }
}

function plain(value: unknown, subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new ReservationArrivalRollValidationError(`${subject} must be a plain object`);
  }
}

function exact(value: Record<string, unknown>, required: readonly string[], subject: string): void {
  const actual = Object.keys(value);
  if (required.some((key) => !Object.hasOwn(value, key)) ||
      actual.some((key) => !required.includes(key))) {
    throw new ReservationArrivalRollValidationError(`${subject} shape is invalid`);
  }
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ReservationArrivalRollValidationError(`${subject} must be a lowercase UUID`);
  }
  return value;
}

function bounded(name: string, value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new ReservationArrivalRollValidationError(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value as number;
}

function normalize(input: RollDueArrivalsInput): RollDueArrivalsInput {
  plain(input, "reservation arrival-roll input");
  exact(input, ["tenantId", "propertyNode", "limit", "envelope"], "reservation arrival-roll input");
  plain(input.envelope, "reservation arrival-roll envelope");
  exact(
    input.envelope,
    ["actorId", "tenantId", "propertyNode", "requestId", "operation"],
    "reservation arrival-roll envelope",
  );
  const tenantId = uuid(input.tenantId, "tenantId");
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  if (uuid(input.envelope.tenantId, "envelope.tenantId") !== tenantId ||
      uuid(input.envelope.propertyNode, "envelope.propertyNode") !== propertyNode ||
      input.envelope.operation !== "reservation.due_in") {
    throw new ReservationArrivalRollValidationError(
      "reservation arrival-roll envelope is not bound to reservation.due_in",
    );
  }
  return Object.freeze({
    tenantId,
    propertyNode,
    limit: bounded("limit", input.limit, 1, MAX_ARRIVAL_BATCH_SIZE),
    envelope: Object.freeze({
      actorId: uuid(input.envelope.actorId, "envelope.actorId"),
      tenantId,
      propertyNode,
      requestId: uuid(input.envelope.requestId, "envelope.requestId"),
      operation: "reservation.due_in",
    }),
  });
}

function storedUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new Error(`Database returned an invalid ${subject}`);
  }
  return value;
}

function storedDate(value: unknown): string {
  if (typeof value !== "string" || !DATE.test(value)) {
    throw new Error("Database returned an invalid business date");
  }
  return value;
}

function keyFor(propertyNode: string, businessDate: string, reservationId: string): string {
  return `reservation-arrival-roll:${propertyNode}:${businessDate}:${reservationId}`;
}

function translate(error: unknown): never {
  if (error instanceof ReservationArrivalRollValidationError ||
      error instanceof ReservationArrivalRollConflictError) throw error;
  const state = (error as { errno?: unknown; code?: unknown }).errno ??
    (error as { code?: unknown }).code;
  if (state === "23505" || state === "40001" || state === "40P01") {
    throw new ReservationArrivalRollConflictError("Reservation arrival truth changed concurrently");
  }
  throw error;
}

async function loadBusinessDate(tx: Tx, input: RollDueArrivalsInput): Promise<string | null> {
  const rows = await tx<BusinessDateRow[]>`
    SELECT (transaction_timestamp() AT TIME ZONE property.timezone)::date::text AS business_date
    FROM tenant
    JOIN org_node AS property
      ON property.tenant_id = tenant.id
     AND property.id = ${input.propertyNode}::uuid
     AND property.kind = 'property'
    WHERE tenant.id = ${input.tenantId}::uuid
      AND tenant.id = current_setting('app.tenant_id', true)::uuid
      AND tenant.status = 'active'
  `;
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new Error("Database returned ambiguous property identity");
  return storedDate(rows[0]!.business_date);
}

async function lockCandidates(
  tx: Tx,
  input: RollDueArrivalsInput,
  businessDate: string,
): Promise<readonly ArrivalCandidateRow[]> {
  return tx<ArrivalCandidateRow[]>`
    SELECT reservation.id AS reservation_id,
           segment.id AS segment_id,
           ${businessDate}::date::text AS business_date
    FROM reservation
    JOIN tenant
      ON tenant.id = reservation.tenant_id
     AND tenant.status = 'active'
    JOIN org_node AS property
      ON property.tenant_id = reservation.tenant_id
     AND property.id = reservation.property_node
     AND property.kind = 'property'
    JOIN reservation_segment AS segment
      ON segment.tenant_id = reservation.tenant_id
     AND segment.reservation_id = reservation.id
     AND segment.status = 'booked'
    WHERE reservation.tenant_id = ${input.tenantId}::uuid
      AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND reservation.property_node = ${input.propertyNode}::uuid
      AND reservation.status = 'reserved'
      AND (lower(segment.period) AT TIME ZONE property.timezone)::date = ${businessDate}::date
      AND NOT EXISTS (
        SELECT 1
        FROM reservation_segment AS later
        WHERE later.tenant_id = segment.tenant_id
          AND later.reservation_id = segment.reservation_id
          AND (later.seq > segment.seq OR (later.seq = segment.seq AND later.id > segment.id))
      )
    ORDER BY reservation.id, segment.id
    LIMIT ${input.limit}
    FOR UPDATE OF reservation, segment SKIP LOCKED
  `;
}

async function revalidateCandidate(
  tx: Tx,
  input: RollDueArrivalsInput,
  candidate: ArrivalCandidateRow,
): Promise<void> {
  const rows = await tx<Array<{ coherent: boolean }>>`
    SELECT true AS coherent
    FROM reservation
    JOIN tenant
      ON tenant.id = reservation.tenant_id
     AND tenant.status = 'active'
    JOIN org_node AS property
      ON property.tenant_id = reservation.tenant_id
     AND property.id = reservation.property_node
     AND property.kind = 'property'
    JOIN reservation_segment AS segment
      ON segment.tenant_id = reservation.tenant_id
     AND segment.reservation_id = reservation.id
     AND segment.id = ${candidate.segment_id}::uuid
     AND segment.status = 'booked'
    WHERE reservation.tenant_id = ${input.tenantId}::uuid
      AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND reservation.property_node = ${input.propertyNode}::uuid
      AND reservation.id = ${candidate.reservation_id}::uuid
      AND reservation.status = 'reserved'
      AND (lower(segment.period) AT TIME ZONE property.timezone)::date = ${candidate.business_date}::date
      AND NOT EXISTS (
        SELECT 1
        FROM reservation_segment AS later
        WHERE later.tenant_id = segment.tenant_id
          AND later.reservation_id = segment.reservation_id
          AND (later.seq > segment.seq OR (later.seq = segment.seq AND later.id > segment.id))
      )
  `;
  if (rows.length !== 1 || rows[0]?.coherent !== true) {
    throw new ReservationArrivalRollConflictError("Reservation arrival truth changed concurrently");
  }
}

export class ReservationArrivalRollService {
  readonly #database: Database;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: ReservationArrivalRollServiceOptions) {
    this.#database = options.database;
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async rollDueArrivals(input: RollDueArrivalsInput): Promise<ReservationArrivalRollResult> {
    const normalized = normalize(input);
    try {
      return await this.#database.withTenantTransaction(normalized.tenantId, async (tx) => {
        const businessDate = await loadBusinessDate(tx, normalized);
        if (businessDate === null) {
          return Object.freeze({
            tenantId: normalized.tenantId,
            propertyNode: normalized.propertyNode,
            businessDate: null,
            examined: 0,
            transitioned: 0,
            arrivals: Object.freeze([]),
          });
        }
        const candidates = await lockCandidates(tx, normalized, businessDate);
        const arrivals: RolledDueArrival[] = [];
        for (const candidateRow of candidates) {
          const candidate = Object.freeze({
            reservation_id: storedUuid(candidateRow.reservation_id, "reservation id"),
            segment_id: storedUuid(candidateRow.segment_id, "segment id"),
            business_date: storedDate(candidateRow.business_date),
          });
          const outcome = await this.#idempotency.execute<DueArrivalBody>(tx, {
            tenantId: normalized.tenantId,
            operation: "reservation.arrival_roll",
            key: keyFor(normalized.propertyNode, businessDate, candidate.reservation_id),
            request: {
              actorId: normalized.envelope.actorId,
              propertyNode: normalized.propertyNode,
              reservationId: candidate.reservation_id,
              segmentId: candidate.segment_id,
              businessDate,
            },
          }, async (commandTx) => {
            await revalidateCandidate(commandTx, normalized, candidate);
            const transitioned = await commandTx<Array<{ id: string }>>`
              UPDATE reservation
              SET status = 'due_in'
              WHERE tenant_id = ${normalized.tenantId}::uuid
                AND tenant_id = current_setting('app.tenant_id', true)::uuid
                AND property_node = ${normalized.propertyNode}::uuid
                AND id = ${candidate.reservation_id}::uuid
                AND status = 'reserved'
              RETURNING id
            `;
            if (transitioned.length !== 1 || transitioned[0]?.id !== candidate.reservation_id) {
              throw new ReservationArrivalRollConflictError("Reservation arrival truth changed concurrently");
            }
            const payload = Object.freeze({
              reservation_id: candidate.reservation_id,
              previous_status: "reserved",
              status: "due_in",
              segment_id: candidate.segment_id,
              segment_status: "booked",
              business_date: businessDate,
            });
            const fact = await recordFact(commandTx, {
              entityType: "reservation",
              entityId: candidate.reservation_id,
              envelope: normalized.envelope,
              payload,
            });
            if (fact.businessDate !== businessDate) {
              throw new ReservationArrivalRollConflictError("Reservation business-date evidence is incoherent");
            }
            await this.#events.publish(commandTx, {
              tenantId: normalized.tenantId,
              propertyNode: normalized.propertyNode,
              businessDate,
              aggregateType: "reservation",
              aggregateId: candidate.reservation_id,
              eventType: "reservation.due_in",
              actorId: normalized.envelope.actorId,
              correlationId: normalized.envelope.requestId,
              payload,
            });
            return {
              status: 200,
              body: Object.freeze({
                reservationId: candidate.reservation_id,
                segmentId: candidate.segment_id,
                businessDate,
              }),
            };
          });
          if (outcome.replayed) {
            throw new ReservationArrivalRollConflictError("Reservation arrival replay conflicts with reserved truth");
          }
          arrivals.push(Object.freeze({ ...outcome.body }));
        }
        return Object.freeze({
          tenantId: normalized.tenantId,
          propertyNode: normalized.propertyNode,
          businessDate,
          examined: candidates.length,
          transitioned: arrivals.length,
          arrivals: Object.freeze(arrivals),
        });
      });
    } catch (error) {
      return translate(error);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown reservation arrival-roll failure";
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

export class ReservationArrivalRollWorker {
  readonly #rolls: ArrivalRollOperations;
  readonly #source: DueArrivalScopeSource;
  readonly #actorId: string;
  readonly #pollIntervalMs: number;
  readonly #scopeBatchSize: number;
  readonly #arrivalBatchSize: number;

  constructor(
    rolls: ArrivalRollOperations,
    source: DueArrivalScopeSource,
    options: ReservationArrivalRollWorkerOptions = {},
  ) {
    this.#rolls = rolls;
    this.#source = source;
    this.#actorId = uuid(options.actorId ?? RESERVATION_ARRIVAL_ROLL_ACTOR_ID, "actorId");
    this.#pollIntervalMs = bounded(
      "pollIntervalMs",
      options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      MIN_POLL_INTERVAL_MS,
      MAX_POLL_INTERVAL_MS,
    );
    this.#scopeBatchSize = bounded(
      "scopeBatchSize",
      options.scopeBatchSize ?? DEFAULT_SCOPE_BATCH_SIZE,
      1,
      MAX_SCOPE_BATCH_SIZE,
    );
    this.#arrivalBatchSize = bounded(
      "arrivalBatchSize",
      options.arrivalBatchSize ?? DEFAULT_ARRIVAL_BATCH_SIZE,
      1,
      MAX_ARRIVAL_BATCH_SIZE,
    );
  }

  async drainOnce(): Promise<ReservationArrivalRollDrainResult> {
    const scopes = await this.#source.listDueScopes(this.#scopeBatchSize);
    if (scopes.length > this.#scopeBatchSize) {
      throw new Error("due-arrival scope source exceeded its requested limit");
    }
    let examined = 0;
    let transitioned = 0;
    const failures: ReservationArrivalRollFailure[] = [];
    for (const scope of scopes) {
      try {
        const tenantId = uuid(scope.tenantId, "scope tenantId");
        const propertyNode = uuid(scope.propertyNode, "scope propertyNode");
        const result = await this.#rolls.rollDueArrivals({
          tenantId,
          propertyNode,
          limit: this.#arrivalBatchSize,
          envelope: createAuditEnvelope({
            actorId: this.#actorId,
            tenantId,
            propertyNode,
            requestId: crypto.randomUUID(),
            operation: "reservation.due_in",
          }),
        });
        examined += result.examined;
        transitioned += result.transitioned;
      } catch (error) {
        failures.push(Object.freeze({ ...scope, error: errorMessage(error) }));
      }
    }
    return Object.freeze({
      scopes: scopes.length,
      examined,
      transitioned,
      failures: Object.freeze(failures),
    });
  }

  async run(options: ReservationArrivalRollRunOptions = {}): Promise<void> {
    while (!options.signal?.aborted) {
      const startedAt = Date.now();
      options.onPoll?.(startedAt);
      try {
        options.onResult?.(await this.drainOnce());
      } catch (error) {
        options.onError?.(error);
      }
      await wait(Math.max(0, this.#pollIntervalMs - (Date.now() - startedAt)), options.signal);
    }
  }
}
