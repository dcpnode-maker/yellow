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
const DEFAULT_DEPARTURE_BATCH_SIZE = 100;
const MAX_DEPARTURE_BATCH_SIZE = 100;

export const RESERVATION_DEPARTURE_ROLL_ACTOR_ID = "00000000-0000-0000-0000-000000000058";

export interface DueDepartureScope {
  readonly tenantId: string;
  readonly propertyNode: string;
}

export interface DueDepartureScopeSource {
  listDueScopes(limit: number): Promise<readonly DueDepartureScope[]>;
}

export interface RollDueDeparturesInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly limit: number;
  readonly envelope: AuditEnvelope;
}

export interface RolledDueDeparture extends Readonly<Record<string, JsonValue>> {
  readonly reservationId: string;
  readonly segmentId: string;
  readonly businessDate: string;
}

export interface ReservationDepartureRollResult {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly businessDate: string | null;
  readonly examined: number;
  readonly transitioned: number;
  readonly departures: readonly RolledDueDeparture[];
}

export interface ReservationDepartureRollServiceOptions {
  readonly database: Database;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

export interface ReservationDepartureRollWorkerOptions {
  readonly actorId?: string;
  readonly pollIntervalMs?: number;
  readonly scopeBatchSize?: number;
  readonly departureBatchSize?: number;
}

export interface ReservationDepartureRollFailure extends DueDepartureScope {
  readonly error: string;
}

export interface ReservationDepartureRollDrainResult {
  readonly scopes: number;
  readonly examined: number;
  readonly transitioned: number;
  readonly failures: readonly ReservationDepartureRollFailure[];
}

export interface ReservationDepartureRollRunOptions {
  readonly signal?: AbortSignal;
  readonly onPoll?: (startedAt: number) => void;
  readonly onResult?: (result: ReservationDepartureRollDrainResult) => void;
  readonly onError?: (error: unknown) => void;
}

interface DepartureCandidateRow {
  readonly reservation_id: string;
  readonly segment_id: string;
  readonly business_date: string;
}

interface BusinessDateRow {
  readonly business_date: string;
}

interface DueDepartureBody extends RolledDueDeparture {}

type DepartureRollOperations = Pick<ReservationDepartureRollService, "rollDueDepartures">;

export class ReservationDepartureRollValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationDepartureRollValidationError";
  }
}

export class ReservationDepartureRollConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationDepartureRollConflictError";
  }
}

function plain(value: unknown, subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new ReservationDepartureRollValidationError(`${subject} must be a plain object`);
  }
}

function exact(value: Record<string, unknown>, required: readonly string[], subject: string): void {
  const actual = Object.keys(value);
  if (required.some((key) => !Object.hasOwn(value, key)) ||
      actual.some((key) => !required.includes(key))) {
    throw new ReservationDepartureRollValidationError(`${subject} shape is invalid`);
  }
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ReservationDepartureRollValidationError(`${subject} must be a lowercase UUID`);
  }
  return value;
}

function bounded(name: string, value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new ReservationDepartureRollValidationError(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value as number;
}

function normalize(input: RollDueDeparturesInput): RollDueDeparturesInput {
  plain(input, "reservation departure-roll input");
  exact(input, ["tenantId", "propertyNode", "limit", "envelope"], "reservation departure-roll input");
  plain(input.envelope, "reservation departure-roll envelope");
  exact(
    input.envelope,
    ["actorId", "tenantId", "propertyNode", "requestId", "operation"],
    "reservation departure-roll envelope",
  );
  const tenantId = uuid(input.tenantId, "tenantId");
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  if (uuid(input.envelope.tenantId, "envelope.tenantId") !== tenantId ||
      uuid(input.envelope.propertyNode, "envelope.propertyNode") !== propertyNode ||
      input.envelope.operation !== "reservation.due_out") {
    throw new ReservationDepartureRollValidationError(
      "reservation departure-roll envelope is not bound to reservation.due_out",
    );
  }
  return Object.freeze({
    tenantId,
    propertyNode,
    limit: bounded("limit", input.limit, 1, MAX_DEPARTURE_BATCH_SIZE),
    envelope: Object.freeze({
      actorId: uuid(input.envelope.actorId, "envelope.actorId"),
      tenantId,
      propertyNode,
      requestId: uuid(input.envelope.requestId, "envelope.requestId"),
      operation: "reservation.due_out",
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
  return `reservation-departure-roll:${propertyNode}:${businessDate}:${reservationId}`;
}

function translate(error: unknown): never {
  if (error instanceof ReservationDepartureRollValidationError ||
      error instanceof ReservationDepartureRollConflictError) throw error;
  const state = (error as { errno?: unknown; code?: unknown }).errno ??
    (error as { code?: unknown }).code;
  if (state === "23505" || state === "40001" || state === "40P01") {
    throw new ReservationDepartureRollConflictError("Reservation departure truth changed concurrently");
  }
  throw error;
}

async function loadBusinessDate(tx: Tx, input: RollDueDeparturesInput): Promise<string | null> {
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
  input: RollDueDeparturesInput,
  businessDate: string,
): Promise<readonly DepartureCandidateRow[]> {
  return tx<DepartureCandidateRow[]>`
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
     AND segment.status = 'in_house'
    WHERE reservation.tenant_id = ${input.tenantId}::uuid
      AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND reservation.property_node = ${input.propertyNode}::uuid
      AND reservation.status = 'in_house'
      AND (upper(segment.period) AT TIME ZONE property.timezone)::date = ${businessDate}::date
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
  input: RollDueDeparturesInput,
  candidate: DepartureCandidateRow,
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
     AND segment.status = 'in_house'
    WHERE reservation.tenant_id = ${input.tenantId}::uuid
      AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND reservation.property_node = ${input.propertyNode}::uuid
      AND reservation.id = ${candidate.reservation_id}::uuid
      AND reservation.status = 'in_house'
      AND (upper(segment.period) AT TIME ZONE property.timezone)::date = ${candidate.business_date}::date
      AND NOT EXISTS (
        SELECT 1
        FROM reservation_segment AS later
        WHERE later.tenant_id = segment.tenant_id
          AND later.reservation_id = segment.reservation_id
          AND (later.seq > segment.seq OR (later.seq = segment.seq AND later.id > segment.id))
      )
  `;
  if (rows.length !== 1 || rows[0]?.coherent !== true) {
    throw new ReservationDepartureRollConflictError("Reservation departure truth changed concurrently");
  }
}

export class ReservationDepartureRollService {
  readonly #database: Database;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: ReservationDepartureRollServiceOptions) {
    this.#database = options.database;
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async rollDueDepartures(input: RollDueDeparturesInput): Promise<ReservationDepartureRollResult> {
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
            departures: Object.freeze([]),
          });
        }
        const candidates = await lockCandidates(tx, normalized, businessDate);
        const departures: RolledDueDeparture[] = [];
        for (const candidateRow of candidates) {
          const candidate = Object.freeze({
            reservation_id: storedUuid(candidateRow.reservation_id, "reservation id"),
            segment_id: storedUuid(candidateRow.segment_id, "segment id"),
            business_date: storedDate(candidateRow.business_date),
          });
          const outcome = await this.#idempotency.execute<DueDepartureBody>(tx, {
            tenantId: normalized.tenantId,
            operation: "reservation.departure_roll",
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
              SET status = 'due_out'
              WHERE tenant_id = ${normalized.tenantId}::uuid
                AND tenant_id = current_setting('app.tenant_id', true)::uuid
                AND property_node = ${normalized.propertyNode}::uuid
                AND id = ${candidate.reservation_id}::uuid
                AND status = 'in_house'
              RETURNING id
            `;
            if (transitioned.length !== 1 || transitioned[0]?.id !== candidate.reservation_id) {
              throw new ReservationDepartureRollConflictError("Reservation departure truth changed concurrently");
            }
            const payload = Object.freeze({
              reservation_id: candidate.reservation_id,
              previous_status: "in_house",
              status: "due_out",
              segment_id: candidate.segment_id,
              segment_status: "in_house",
              business_date: businessDate,
            });
            const fact = await recordFact(commandTx, {
              entityType: "reservation",
              entityId: candidate.reservation_id,
              envelope: normalized.envelope,
              payload,
            });
            if (fact.businessDate !== businessDate) {
              throw new ReservationDepartureRollConflictError("Reservation business-date evidence is incoherent");
            }
            await this.#events.publish(commandTx, {
              tenantId: normalized.tenantId,
              propertyNode: normalized.propertyNode,
              businessDate,
              aggregateType: "reservation",
              aggregateId: candidate.reservation_id,
              eventType: "reservation.due_out",
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
            throw new ReservationDepartureRollConflictError(
              "Reservation departure replay conflicts with in-house truth",
            );
          }
          departures.push(Object.freeze({ ...outcome.body }));
        }
        return Object.freeze({
          tenantId: normalized.tenantId,
          propertyNode: normalized.propertyNode,
          businessDate,
          examined: candidates.length,
          transitioned: departures.length,
          departures: Object.freeze(departures),
        });
      });
    } catch (error) {
      return translate(error);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown reservation departure-roll failure";
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

export class ReservationDepartureRollWorker {
  readonly #rolls: DepartureRollOperations;
  readonly #source: DueDepartureScopeSource;
  readonly #actorId: string;
  readonly #pollIntervalMs: number;
  readonly #scopeBatchSize: number;
  readonly #departureBatchSize: number;

  constructor(
    rolls: DepartureRollOperations,
    source: DueDepartureScopeSource,
    options: ReservationDepartureRollWorkerOptions = {},
  ) {
    this.#rolls = rolls;
    this.#source = source;
    this.#actorId = uuid(options.actorId ?? RESERVATION_DEPARTURE_ROLL_ACTOR_ID, "actorId");
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
    this.#departureBatchSize = bounded(
      "departureBatchSize",
      options.departureBatchSize ?? DEFAULT_DEPARTURE_BATCH_SIZE,
      1,
      MAX_DEPARTURE_BATCH_SIZE,
    );
  }

  async drainOnce(): Promise<ReservationDepartureRollDrainResult> {
    const scopes = await this.#source.listDueScopes(this.#scopeBatchSize);
    if (scopes.length > this.#scopeBatchSize) {
      throw new Error("due-departure scope source exceeded its requested limit");
    }
    let examined = 0;
    let transitioned = 0;
    const failures: ReservationDepartureRollFailure[] = [];
    for (const scope of scopes) {
      try {
        const tenantId = uuid(scope.tenantId, "scope tenantId");
        const propertyNode = uuid(scope.propertyNode, "scope propertyNode");
        const result = await this.#rolls.rollDueDepartures({
          tenantId,
          propertyNode,
          limit: this.#departureBatchSize,
          envelope: createAuditEnvelope({
            actorId: this.#actorId,
            tenantId,
            propertyNode,
            requestId: crypto.randomUUID(),
            operation: "reservation.due_out",
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

  async run(options: ReservationDepartureRollRunOptions = {}): Promise<void> {
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
