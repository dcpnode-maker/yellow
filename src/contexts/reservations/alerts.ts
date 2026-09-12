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
const UNSAFE_CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
const UNSAFE_NOTE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;

export type ReservationAlertShowOn = "checkin" | "checkout" | "always";

export interface ReservationAlert extends Readonly<Record<string, JsonValue>> {
  readonly id: string;
  readonly code: string | null;
  readonly message: string;
  readonly showOn: ReservationAlertShowOn;
  readonly active: boolean;
}

export interface CreateReservationAlertInput {
  readonly reservationId: string;
  readonly code: string | null;
  readonly message: string;
  readonly showOn: ReservationAlertShowOn;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface DeactivateReservationAlertInput {
  readonly reservationId: string;
  readonly alertId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface ReservationAlertResult {
  readonly alert: ReservationAlert;
  readonly changed: boolean;
  readonly replayed: boolean;
}

type ReservationAlertBody = Omit<ReservationAlertResult, "replayed"> & Readonly<Record<string, JsonValue>>;

export interface ReservationAlertServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface ReservationRow {
  readonly id: string;
}

interface AlertRow {
  readonly id: string;
  readonly code: string | null;
  readonly message: string;
  readonly show_on: string;
  readonly active: boolean;
}

interface CreateNormalized {
  readonly reservationId: string;
  readonly code: string | null;
  readonly message: string;
  readonly showOn: ReservationAlertShowOn;
  readonly idempotencyKey: string;
}

interface DeactivateNormalized {
  readonly reservationId: string;
  readonly alertId: string;
  readonly idempotencyKey: string;
}

export class ReservationAlertValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationAlertValidationError";
  }
}

export class ReservationAlertNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationAlertNotFoundError";
  }
}

export class ReservationAlertConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationAlertConflictError";
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ReservationAlertValidationError(`${name} must be a UUID`);
  }
  return value;
}

function boundedText(name: string, value: unknown, maximumCodePoints: number, multiline = false): string {
  if (typeof value !== "string") {
    throw new ReservationAlertValidationError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length === 0 || Array.from(normalized).length > maximumCodePoints ||
      (multiline ? UNSAFE_NOTE_CONTROL : UNSAFE_CONTROL).test(normalized)) {
    throw new ReservationAlertValidationError(`${name} must contain 1-${maximumCodePoints} safe Unicode characters`);
  }
  return normalized;
}

function showOn(value: unknown): ReservationAlertShowOn {
  if (value === "checkin" || value === "checkout" || value === "always") return value;
  throw new ReservationAlertValidationError("showOn must be checkin, checkout or always");
}

function storedAlert(row: AlertRow): ReservationAlert {
  if (!UUID.test(row.id) || typeof row.message !== "string" || typeof row.active !== "boolean") {
    throw new ReservationAlertConflictError("Stored reservation alert is invalid");
  }
  let code: string | null;
  try {
    code = row.code === null ? null : boundedText("stored code", row.code, 64);
    return Object.freeze({
      id: row.id,
      code,
      message: boundedText("stored message", row.message, 1000, true),
      showOn: showOn(row.show_on),
      active: row.active,
    });
  } catch {
    throw new ReservationAlertConflictError("Stored reservation alert is invalid");
  }
}

function validateEnvelope(envelope: AuditEnvelope): void {
  if (envelope.operation !== "reservation.modified") {
    throw new ReservationAlertValidationError("audit operation must be reservation.modified");
  }
  requireUuid("tenantId", envelope.tenantId);
  requireUuid("propertyNode", envelope.propertyNode);
  requireUuid("actorId", envelope.actorId);
  requireUuid("requestId", envelope.requestId);
}

function idempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !IDEMPOTENCY_KEY.test(value)) {
    throw new ReservationAlertValidationError("idempotencyKey must contain 8-200 printable non-space characters");
  }
  return value;
}

function normalizeCreate(input: CreateReservationAlertInput): CreateNormalized {
  validateEnvelope(input.envelope);
  return Object.freeze({
    reservationId: requireUuid("reservationId", input.reservationId),
    code: input.code === null ? null : boundedText("code", input.code, 64),
    message: boundedText("message", input.message, 1000, true),
    showOn: showOn(input.showOn),
    idempotencyKey: idempotencyKey(input.idempotencyKey),
  });
}

function normalizeDeactivate(input: DeactivateReservationAlertInput): DeactivateNormalized {
  validateEnvelope(input.envelope);
  return Object.freeze({
    reservationId: requireUuid("reservationId", input.reservationId),
    alertId: requireUuid("alertId", input.alertId),
    idempotencyKey: idempotencyKey(input.idempotencyKey),
  });
}

async function lockReservation(
  tx: Tx,
  envelope: AuditEnvelope,
  reservationId: string,
): Promise<void> {
  const rows = await tx<ReservationRow[]>`
    SELECT id
    FROM reservation
    WHERE id = ${reservationId}::uuid
      AND tenant_id = ${envelope.tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND property_node = ${envelope.propertyNode}::uuid
    FOR UPDATE
  `;
  if (rows.length !== 1 || rows[0]?.id !== reservationId) {
    throw new ReservationAlertNotFoundError("Reservation was not found in the active property");
  }
}

async function recordAlertChange(
  tx: Tx,
  events: EventBus,
  envelope: AuditEnvelope,
  reservationId: string,
  action: "create" | "deactivate",
  alert: ReservationAlert,
): Promise<void> {
  const diff = Object.freeze({
    alerts: Object.freeze({ action, alertId: alert.id, active: alert.active }),
  });
  const fact = await recordFact(tx, {
    entityType: "reservation",
    entityId: reservationId,
    envelope,
    payload: { diff },
  });
  await events.publish(tx, {
    tenantId: envelope.tenantId,
    propertyNode: envelope.propertyNode,
    businessDate: fact.businessDate,
    aggregateType: "reservation",
    aggregateId: reservationId,
    eventType: "reservation.modified",
    actorId: envelope.actorId,
    correlationId: envelope.requestId,
    payload: { reservation_id: reservationId, diff },
  });
}

function translateDatabaseError(error: unknown): never {
  const record = error as { errno?: unknown; code?: unknown };
  const state = record.errno ?? record.code;
  if (state === "42501") {
    throw new ReservationAlertNotFoundError("Reservation alert was not found in the active property");
  }
  if (state === "40001" || state === "40P01" || state === "23505" || state === "55000") {
    throw new ReservationAlertConflictError("Reservation alert state is stale or unavailable");
  }
  if (state === "22001" || state === "22023") {
    throw new ReservationAlertValidationError("Reservation alert input is invalid");
  }
  throw error;
}

export class ReservationAlertService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: ReservationAlertServiceOptions) {
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async create(tx: Tx, input: CreateReservationAlertInput): Promise<ReservationAlertResult> {
    const normalized = normalizeCreate(input);
    try {
      const outcome = await this.#idempotency.execute<ReservationAlertBody>(tx, {
        tenantId: input.envelope.tenantId,
        operation: "reservation.alert.create",
        key: normalized.idempotencyKey,
        request: {
          actorId: input.envelope.actorId,
          propertyNode: input.envelope.propertyNode,
          reservationId: normalized.reservationId,
          code: normalized.code,
          message: normalized.message,
          showOn: normalized.showOn,
        },
      }, async (commandTx) => {
        await lockReservation(commandTx, input.envelope, normalized.reservationId);
        const rows = await commandTx<AlertRow[]>`
          INSERT INTO alert (tenant_id, subject_type, subject_id, code, message, show_on, active)
          VALUES (
            ${input.envelope.tenantId}::uuid, 'reservation', ${normalized.reservationId}::uuid,
            ${normalized.code}, ${normalized.message}, ${normalized.showOn}, true
          )
          RETURNING id, code, message, show_on, active
        `;
        const row = rows[0];
        if (rows.length !== 1 || !row) {
          throw new ReservationAlertConflictError("Reservation alert creation returned invalid evidence");
        }
        const alert = storedAlert(row);
        await recordAlertChange(commandTx, this.#events, input.envelope, normalized.reservationId, "create", alert);
        return { status: 200, body: Object.freeze({ alert, changed: true }) };
      });
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      if (error instanceof ReservationAlertValidationError || error instanceof ReservationAlertNotFoundError ||
          error instanceof ReservationAlertConflictError) throw error;
      return translateDatabaseError(error);
    }
  }

  async deactivate(tx: Tx, input: DeactivateReservationAlertInput): Promise<ReservationAlertResult> {
    const normalized = normalizeDeactivate(input);
    try {
      const outcome = await this.#idempotency.execute<ReservationAlertBody>(tx, {
        tenantId: input.envelope.tenantId,
        operation: "reservation.alert.deactivate",
        key: normalized.idempotencyKey,
        request: {
          actorId: input.envelope.actorId,
          propertyNode: input.envelope.propertyNode,
          reservationId: normalized.reservationId,
          alertId: normalized.alertId,
        },
      }, async (commandTx) => {
        await lockReservation(commandTx, input.envelope, normalized.reservationId);
        const rows = await commandTx<AlertRow[]>`
          SELECT id, code, message, show_on, active
          FROM alert
          WHERE id = ${normalized.alertId}::uuid
            AND tenant_id = ${input.envelope.tenantId}::uuid
            AND subject_type = 'reservation'
            AND subject_id = ${normalized.reservationId}::uuid
          FOR UPDATE
        `;
        const row = rows[0];
        if (rows.length !== 1 || !row) {
          throw new ReservationAlertNotFoundError("Reservation alert was not found in the active property");
        }
        const before = storedAlert(row);
        if (!before.active) {
          return { status: 200, body: Object.freeze({ alert: before, changed: false }) };
        }
        const updated = await commandTx<AlertRow[]>`
          UPDATE alert
          SET active = false
          WHERE id = ${normalized.alertId}::uuid
            AND tenant_id = ${input.envelope.tenantId}::uuid
            AND subject_type = 'reservation'
            AND subject_id = ${normalized.reservationId}::uuid
            AND active = true
          RETURNING id, code, message, show_on, active
        `;
        const changedRow = updated[0];
        if (updated.length !== 1 || !changedRow) {
          throw new ReservationAlertConflictError("Reservation alert changed concurrently");
        }
        const alert = storedAlert(changedRow);
        await recordAlertChange(commandTx, this.#events, input.envelope, normalized.reservationId, "deactivate", alert);
        return { status: 200, body: Object.freeze({ alert, changed: true }) };
      });
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      if (error instanceof ReservationAlertValidationError || error instanceof ReservationAlertNotFoundError ||
          error instanceof ReservationAlertConflictError) throw error;
      return translateDatabaseError(error);
    }
  }
}
