import {
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const UTC_INSTANT = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})(?:\d{3})?Z$/;
const TUPLE_KEYS = Object.freeze([
  "mode", "carrier", "serviceNo", "scheduledAt", "pickupRequested",
] as const);

export type ReservationTravelDirection = "arrival" | "departure";
export type ReservationTravelMode = "flight" | "train" | "bus" | "car" | "ferry" | "other";
export type TravelEditableReservationStatus = "reserved" | "due_in" | "in_house" | "due_out";

export interface ReservationTravelTuple extends Readonly<Record<string, JsonValue>> {
  readonly mode: ReservationTravelMode | null;
  readonly carrier: string | null;
  readonly serviceNo: string | null;
  readonly scheduledAt: string | null;
  readonly pickupRequested: boolean;
}

export interface PutReservationTravelInput {
  readonly reservationId: string;
  readonly direction: ReservationTravelDirection;
  readonly expected: ReservationTravelTuple | null;
  readonly travel: ReservationTravelTuple;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface PutReservationTravelResult {
  readonly reservationId: string;
  readonly status: TravelEditableReservationStatus;
  readonly direction: ReservationTravelDirection;
  readonly travelId: string;
  readonly travel: ReservationTravelTuple;
  readonly changed: boolean;
  readonly replayed: boolean;
}

type PutReservationTravelBody = Omit<PutReservationTravelResult, "replayed"> &
  Readonly<Record<string, JsonValue>>;

export interface ReservationTravelServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface NormalizedRequest {
  readonly reservationId: string;
  readonly direction: ReservationTravelDirection;
  readonly expected: ReservationTravelTuple | null;
  readonly travel: ReservationTravelTuple;
  readonly idempotencyKey: string;
}

interface CapabilityRow {
  readonly travel_id: string;
  readonly reservation_status: string;
  readonly current_mode: string | null;
  readonly current_carrier: string | null;
  readonly current_service_no: string | null;
  readonly current_scheduled_at: string | null;
  readonly current_pickup_requested: boolean;
  readonly changed: boolean;
}

export class ReservationTravelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationTravelValidationError";
  }
}

export class ReservationTravelNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationTravelNotFoundError";
  }
}

export class ReservationTravelConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationTravelConflictError";
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ReservationTravelValidationError(`${name} must be a UUID`);
  }
  return value;
}

function exactTuple(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === TUPLE_KEYS.length &&
    keys.every((key, index) => key === [...TUPLE_KEYS].sort()[index]);
}

function mode(value: unknown, name: string): ReservationTravelMode | null {
  if (value === null || value === "flight" || value === "train" || value === "bus" ||
      value === "car" || value === "ferry" || value === "other") return value;
  throw new ReservationTravelValidationError(`${name} is invalid`);
}

function nullableText(value: unknown, name: string, maxCodePoints: number): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new ReservationTravelValidationError(`${name} must be a string or null`);
  }
  const normalized = value.trim();
  if (normalized.length === 0 || Array.from(normalized).length > maxCodePoints) {
    throw new ReservationTravelValidationError(
      `${name} must contain 1-${maxCodePoints} Unicode characters or be null`,
    );
  }
  return normalized;
}

function canonicalInstant(value: unknown, name: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new ReservationTravelValidationError(`${name} must be a canonical UTC instant or null`);
  }
  const match = UTC_INSTANT.exec(value);
  if (!match?.[1]) {
    throw new ReservationTravelValidationError(`${name} must be a canonical UTC instant or null`);
  }
  const milliseconds = `${match[1]}Z`;
  const parsed = new Date(milliseconds);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== milliseconds) {
    throw new ReservationTravelValidationError(`${name} must be a canonical UTC instant or null`);
  }
  return value;
}

function tuple(value: unknown, direction: ReservationTravelDirection, name: string): ReservationTravelTuple {
  if (!exactTuple(value)) {
    throw new ReservationTravelValidationError(`${name} must contain exactly the travel tuple fields`);
  }
  if (typeof value.pickupRequested !== "boolean") {
    throw new ReservationTravelValidationError(`${name}.pickupRequested must be boolean`);
  }
  if (direction === "departure" && value.pickupRequested) {
    throw new ReservationTravelValidationError("departure travel cannot request pickup");
  }
  return Object.freeze({
    mode: mode(value.mode, `${name}.mode`),
    carrier: nullableText(value.carrier, `${name}.carrier`, 120),
    serviceNo: nullableText(value.serviceNo, `${name}.serviceNo`, 64),
    scheduledAt: canonicalInstant(value.scheduledAt, `${name}.scheduledAt`),
    pickupRequested: value.pickupRequested,
  });
}

function hasRecordedValue(value: ReservationTravelTuple): boolean {
  return value.mode !== null || value.carrier !== null || value.serviceNo !== null ||
    value.scheduledAt !== null || value.pickupRequested;
}

function normalize(input: PutReservationTravelInput): NormalizedRequest {
  if (input.envelope.operation !== "reservation.modified") {
    throw new ReservationTravelValidationError("audit operation must be reservation.modified");
  }
  const reservationId = requireUuid("reservationId", input.reservationId);
  requireUuid("tenantId", input.envelope.tenantId);
  requireUuid("propertyNode", input.envelope.propertyNode);
  requireUuid("actorId", input.envelope.actorId);
  if (input.direction !== "arrival" && input.direction !== "departure") {
    throw new ReservationTravelValidationError("direction must be arrival or departure");
  }
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new ReservationTravelValidationError(
      "idempotencyKey must contain 8-200 printable non-space characters",
    );
  }
  const expected = input.expected === null ? null : tuple(input.expected, input.direction, "expected");
  const travel = tuple(input.travel, input.direction, "travel");
  if (!hasRecordedValue(travel)) {
    throw new ReservationTravelValidationError("travel must contain at least one recorded value");
  }
  return Object.freeze({
    reservationId,
    direction: input.direction,
    expected,
    travel,
    idempotencyKey: input.idempotencyKey,
  });
}

function status(value: string): TravelEditableReservationStatus {
  if (value === "reserved" || value === "due_in" || value === "in_house" || value === "due_out") {
    return value;
  }
  throw new ReservationTravelConflictError(`Reservation status ${value} cannot change travel`);
}

function storedTuple(
  row: CapabilityRow,
  direction: ReservationTravelDirection,
): ReservationTravelTuple {
  return tuple({
    mode: row.current_mode,
    carrier: row.current_carrier,
    serviceNo: row.current_service_no,
    scheduledAt: row.current_scheduled_at,
    pickupRequested: row.current_pickup_requested,
  }, direction, "stored travel");
}

function translateDatabaseError(error: unknown): never {
  const record = error as { errno?: unknown; code?: unknown };
  const state = record.errno ?? record.code;
  if (state === "42501") {
    throw new ReservationTravelNotFoundError("Reservation was not found in the active property");
  }
  if (state === "40001" || state === "40P01" || state === "23505" || state === "55000") {
    throw new ReservationTravelConflictError("Reservation travel state is stale or unavailable");
  }
  if (state === "22023" || state === "22001") {
    throw new ReservationTravelValidationError("Reservation travel input is invalid");
  }
  throw error;
}

export class ReservationTravelService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: ReservationTravelServiceOptions) {
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async put(tx: Tx, input: PutReservationTravelInput): Promise<PutReservationTravelResult> {
    const normalized = normalize(input);
    try {
      const outcome = await this.#idempotency.execute<PutReservationTravelBody>(tx, {
        tenantId: input.envelope.tenantId,
        operation: "reservation.travel.put",
        key: normalized.idempotencyKey,
        request: {
          actorId: input.envelope.actorId,
          propertyNode: input.envelope.propertyNode,
          reservationId: normalized.reservationId,
          direction: normalized.direction,
          expected: normalized.expected,
          travel: normalized.travel,
        },
      }, async (commandTx) => {
        const expected = normalized.expected;
        const rows = await commandTx<CapabilityRow[]>`
          SELECT capability.travel_id, capability.reservation_status,
                 capability.current_mode, capability.current_carrier,
                 capability.current_service_no,
                 CASE WHEN capability.current_scheduled_at IS NULL THEN NULL ELSE
                   to_char(capability.current_scheduled_at AT TIME ZONE 'UTC',
                     'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END AS current_scheduled_at,
                 capability.current_pickup_requested, capability.changed
          FROM public.put_reservation_travel(
            ${input.envelope.tenantId}::uuid,
            ${input.envelope.propertyNode}::uuid,
            ${normalized.reservationId}::uuid,
            ${normalized.direction},
            ${expected !== null}::boolean,
            ${expected?.mode ?? null},
            ${expected?.carrier ?? null},
            ${expected?.serviceNo ?? null},
            ${expected?.scheduledAt ?? null}::timestamptz,
            ${expected?.pickupRequested ?? null}::boolean,
            ${normalized.travel.mode},
            ${normalized.travel.carrier},
            ${normalized.travel.serviceNo},
            ${normalized.travel.scheduledAt ?? null}::timestamptz,
            ${normalized.travel.pickupRequested}::boolean,
            ${input.envelope.actorId}::uuid
          ) AS capability
        `;
        const row = rows[0];
        if (rows.length !== 1 || !row || !UUID.test(row.travel_id)) {
          throw new ReservationTravelConflictError("Reservation travel capability returned invalid evidence");
        }
        const after = storedTuple(row, normalized.direction);
        const reservationStatus = status(row.reservation_status);
        if (row.changed) {
          const diff = Object.freeze({
            direction: normalized.direction,
            before: normalized.expected,
            after,
          });
          const fact = await recordFact(commandTx, {
            entityType: "reservation",
            entityId: normalized.reservationId,
            envelope: input.envelope,
            payload: { diff: { travel: diff } },
          });
          await this.#events.publish(commandTx, {
            tenantId: input.envelope.tenantId,
            propertyNode: input.envelope.propertyNode,
            businessDate: fact.businessDate,
            aggregateType: "reservation",
            aggregateId: normalized.reservationId,
            eventType: "reservation.modified",
            actorId: input.envelope.actorId,
            correlationId: input.envelope.requestId,
            payload: {
              reservation_id: normalized.reservationId,
              diff: { travel: diff },
            },
          });
        }
        return {
          status: 200,
          body: Object.freeze({
            reservationId: normalized.reservationId,
            status: reservationStatus,
            direction: normalized.direction,
            travelId: row.travel_id,
            travel: after,
            changed: row.changed,
          }),
        };
      });
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      if (error instanceof ReservationTravelValidationError ||
          error instanceof ReservationTravelNotFoundError ||
          error instanceof ReservationTravelConflictError) throw error;
      return translateDatabaseError(error);
    }
  }
}
