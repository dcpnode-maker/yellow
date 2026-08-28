import {
  IdempotencyConflictError,
  recordFact,
  type AuditEnvelope,
  type Database,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
} from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;

export interface ArrivalRoomCleaningCandidateInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
}

export interface ArrivalRoomCleaningCreateInput extends ArrivalRoomCleaningCandidateInput {
  readonly attendantPartyId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface ArrivalRoomCleaningCandidate {
  readonly reservationId: string;
  readonly spaceId: string;
  readonly spaceCode: string;
  readonly roomCondition: "dirty" | "pickup";
  readonly dueAt: string;
  readonly existingTaskId: string | null;
}

export interface ArrivalRoomCleaningResult extends Readonly<Record<string, JsonValue>> {
  readonly taskId: string;
  readonly reservationId: string;
  readonly spaceId: string;
  readonly roomCondition: "dirty" | "pickup";
  readonly attendantPartyId: string;
  readonly dueAt: string;
  readonly created: boolean;
  readonly replayed: boolean;
}

export interface ArrivalRoomCleaningTaskServiceOptions {
  readonly database: Database;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface CandidateRow {
  readonly reservation_id: string;
  readonly space_id: string;
  readonly space_code: string;
  readonly room_condition: string;
  readonly due_at: string;
  readonly existing_task_id: string | null;
  readonly actionable_task_count: number;
}

interface CapabilityRow {
  readonly task_id: string;
  readonly room_id: string;
  readonly room_condition: string;
  readonly assignee_party: string;
  readonly due_at: string;
  readonly created: boolean;
}

export class ArrivalRoomCleaningValidationError extends Error {}
export class ArrivalRoomCleaningNotFoundError extends Error {}
export class ArrivalRoomCleaningConflictError extends Error {}

function plain(value: unknown, subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new ArrivalRoomCleaningValidationError(`${subject} must be a plain object`);
  }
}

function exact(value: Record<string, unknown>, keys: readonly string[], subject: string): void {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new ArrivalRoomCleaningValidationError(`${subject} shape is invalid`);
  }
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ArrivalRoomCleaningValidationError(`${subject} must be a lowercase UUID`);
  }
  return value;
}

function condition(value: unknown): "dirty" | "pickup" {
  if (value === "dirty" || value === "pickup") return value;
  throw new Error("Database returned an invalid arrival room condition");
}

function instant(value: unknown, subject: string): string {
  if (typeof value !== "string") throw new Error(`Database returned invalid ${subject}`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Database returned invalid ${subject}`);
  return parsed.toISOString();
}

function candidateInput(input: ArrivalRoomCleaningCandidateInput): ArrivalRoomCleaningCandidateInput {
  plain(input, "arrival cleaning candidate input");
  exact(input, ["tenantId", "propertyNode", "reservationId"], "arrival cleaning candidate input");
  return Object.freeze({
    tenantId: uuid(input.tenantId, "tenantId"),
    propertyNode: uuid(input.propertyNode, "propertyNode"),
    reservationId: uuid(input.reservationId, "reservationId"),
  });
}

function createInput(input: ArrivalRoomCleaningCreateInput): ArrivalRoomCleaningCreateInput {
  plain(input, "arrival cleaning create input");
  exact(input, [
    "tenantId", "propertyNode", "reservationId", "attendantPartyId", "idempotencyKey", "envelope",
  ], "arrival cleaning create input");
  const base = candidateInput({
    tenantId: input.tenantId,
    propertyNode: input.propertyNode,
    reservationId: input.reservationId,
  });
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new ArrivalRoomCleaningValidationError("idempotencyKey must contain 8 to 200 visible ASCII characters");
  }
  plain(input.envelope, "envelope");
  exact(input.envelope, ["actorId", "tenantId", "propertyNode", "requestId", "operation"], "envelope");
  if (uuid(input.envelope.tenantId, "envelope.tenantId") !== base.tenantId ||
      uuid(input.envelope.propertyNode, "envelope.propertyNode") !== base.propertyNode ||
      input.envelope.operation !== "task.created") {
    throw new ArrivalRoomCleaningValidationError("audit envelope is not bound to task.created");
  }
  return Object.freeze({
    ...base,
    attendantPartyId: uuid(input.attendantPartyId, "attendantPartyId"),
    idempotencyKey: input.idempotencyKey,
    envelope: Object.freeze({
      actorId: uuid(input.envelope.actorId, "envelope.actorId"),
      tenantId: base.tenantId,
      propertyNode: base.propertyNode,
      requestId: uuid(input.envelope.requestId, "envelope.requestId"),
      operation: "task.created",
    }),
  });
}

function translate(error: unknown): never {
  if (error instanceof ArrivalRoomCleaningValidationError ||
      error instanceof ArrivalRoomCleaningNotFoundError ||
      error instanceof ArrivalRoomCleaningConflictError) throw error;
  if (error instanceof IdempotencyConflictError) throw new ArrivalRoomCleaningConflictError(error.message);
  const record = error as { errno?: unknown; code?: unknown; message?: unknown };
  const state = record.errno ?? record.code;
  if (state === "42501" || state === "55000") {
    throw new ArrivalRoomCleaningNotFoundError("Arrival cleaning target was not found in the active property");
  }
  if (state === "40001" || state === "40P01" || state === "23505") {
    throw new ArrivalRoomCleaningConflictError("Arrival cleaning truth changed concurrently");
  }
  if (state === "22023") throw new ArrivalRoomCleaningValidationError("Arrival cleaning input is invalid");
  throw error;
}

export class ArrivalRoomCleaningTaskService {
  readonly #database: Database;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: ArrivalRoomCleaningTaskServiceOptions) {
    this.#database = options.database;
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async candidate(input: ArrivalRoomCleaningCandidateInput): Promise<ArrivalRoomCleaningCandidate> {
    const normalized = candidateInput(input);
    try {
      return await this.#database.withTenantTransaction(normalized.tenantId, async (tx) => {
        const rows = await tx<CandidateRow[]>`
          WITH eligible_segment AS MATERIALIZED (
            SELECT segment.*
            FROM reservation
            JOIN reservation_segment AS segment
              ON segment.tenant_id = reservation.tenant_id
             AND segment.reservation_id = reservation.id
             AND segment.status = 'booked'
             AND segment.period @> transaction_timestamp()
            WHERE reservation.tenant_id = ${normalized.tenantId}::uuid
              AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
              AND reservation.property_node = ${normalized.propertyNode}::uuid
              AND reservation.id = ${normalized.reservationId}::uuid
              AND reservation.status = 'due_in'
          ), eligible_room AS MATERIALIZED (
            SELECT segment.reservation_id, room.id AS space_id, room.code AS space_code,
                   condition.condition AS room_condition, lower(segment.period) AS due_at
            FROM eligible_segment AS segment
            JOIN sellable_unit_space AS mapping
              ON mapping.tenant_id = segment.tenant_id
             AND mapping.sellable_unit_id = segment.sellable_unit_id
            JOIN space AS room
              ON room.tenant_id = mapping.tenant_id
             AND room.id = mapping.space_id
             AND room.property_node = ${normalized.propertyNode}::uuid
             AND room.status = 'active'
            JOIN unit_condition AS condition
              ON condition.tenant_id = room.tenant_id
             AND condition.space_id = room.id
             AND condition.condition IN ('dirty', 'pickup')
            WHERE (SELECT count(*) FROM eligible_segment) = 1
          )
          SELECT room.reservation_id, room.space_id, room.space_code,
                 room.room_condition, room.due_at,
                 min(task.id) AS existing_task_id,
                 count(task.id)::int AS actionable_task_count
          FROM eligible_room AS room
          LEFT JOIN task
            ON task.tenant_id = ${normalized.tenantId}::uuid
           AND task.property_node = ${normalized.propertyNode}::uuid
           AND task.kind = 'housekeeping'
           AND task.subject_type = 'space'
           AND task.subject_id = room.space_id
           AND task.status IN ('assigned', 'in_progress')
          WHERE (SELECT count(*) FROM eligible_room) = 1
          GROUP BY room.reservation_id, room.space_id, room.space_code,
                   room.room_condition, room.due_at
        `;
        const row = rows[0];
        if (rows.length !== 1 || !row || row.actionable_task_count > 1) {
          throw new ArrivalRoomCleaningNotFoundError("Arrival cleaning target was not found in the active property");
        }
        return Object.freeze({
          reservationId: uuid(row.reservation_id, "reservationId"),
          spaceId: uuid(row.space_id, "spaceId"),
          spaceCode: row.space_code,
          roomCondition: condition(row.room_condition),
          dueAt: instant(row.due_at, "arrival due time"),
          existingTaskId: row.existing_task_id === null ? null : uuid(row.existing_task_id, "existingTaskId"),
        });
      });
    } catch (error) {
      return translate(error);
    }
  }

  async create(input: ArrivalRoomCleaningCreateInput): Promise<ArrivalRoomCleaningResult> {
    const normalized = createInput(input);
    try {
      const outcome = await this.#database.withTenantTransaction(normalized.tenantId, (tx) =>
        this.#idempotency.execute<ArrivalRoomCleaningResult>(tx, {
          tenantId: normalized.tenantId,
          operation: "housekeeping.arrival-cleaning.create",
          key: normalized.idempotencyKey,
          request: {
            actorId: normalized.envelope.actorId,
            propertyNode: normalized.propertyNode,
            reservationId: normalized.reservationId,
            attendantPartyId: normalized.attendantPartyId,
          },
        }, async (commandTx) => {
          const rows = await commandTx<CapabilityRow[]>`
            SELECT task_id, room_id, room_condition, assignee_party, due_at, created
            FROM public.create_arrival_room_cleaning_task(
              ${normalized.tenantId}::uuid,
              ${normalized.propertyNode}::uuid,
              ${normalized.reservationId}::uuid,
              ${normalized.attendantPartyId}::uuid,
              ${normalized.envelope.actorId}::uuid
            )
          `;
          const row = rows[0];
          if (rows.length !== 1 || !row) {
            throw new ArrivalRoomCleaningNotFoundError("Arrival cleaning target was not found in the active property");
          }
          const taskId = uuid(row.task_id, "taskId");
          const spaceId = uuid(row.room_id, "spaceId");
          const attendantPartyId = uuid(row.assignee_party, "attendantPartyId");
          const roomCondition = condition(row.room_condition);
          const dueAt = instant(row.due_at, "arrival due time");
          if (row.created) {
            const payload = Object.freeze({
              reservation_id: normalized.reservationId,
              space_id: spaceId,
              room_condition: roomCondition,
              assignee_party_id: attendantPartyId,
              status: "assigned",
              department: "Housekeeping",
              priority: 1,
              due_at: dueAt,
            });
            const fact = await recordFact(commandTx, {
              entityType: "task",
              entityId: taskId,
              envelope: normalized.envelope,
              payload,
            });
            await this.#events.publish(commandTx, {
              tenantId: normalized.tenantId,
              propertyNode: normalized.propertyNode,
              businessDate: fact.businessDate,
              aggregateType: "task",
              aggregateId: taskId,
              eventType: "task.created",
              actorId: normalized.envelope.actorId,
              correlationId: normalized.envelope.requestId,
              payload,
            });
          }
          return {
            status: row.created ? 201 : 200,
            body: Object.freeze({
              taskId,
              reservationId: normalized.reservationId,
              spaceId,
              roomCondition,
              attendantPartyId,
              dueAt,
              created: row.created,
              replayed: false,
            }),
          };
        })
      );
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      return translate(error);
    }
  }
}
