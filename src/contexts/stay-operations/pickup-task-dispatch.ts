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

export const ARRIVAL_PICKUP_TASK_ACTIONS = Object.freeze(["assign", "start", "complete"] as const);
export const ARRIVAL_PICKUP_TASK_STATUSES = Object.freeze([
  "open", "assigned", "in_progress", "done",
] as const);

export type ArrivalPickupTaskAction = (typeof ARRIVAL_PICKUP_TASK_ACTIONS)[number];
export type ArrivalPickupTaskStatus = (typeof ARRIVAL_PICKUP_TASK_STATUSES)[number];

interface ArrivalPickupTaskTransitionBase {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly taskId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export type ArrivalPickupTaskTransitionInput = ArrivalPickupTaskTransitionBase & (
  | {
    readonly action: "assign";
    readonly expectedTaskStatus: "open";
    readonly expectedAssigneePartyId: null;
    readonly staffPartyId: string;
  }
  | {
    readonly action: "start";
    readonly expectedTaskStatus: "assigned";
    readonly expectedAssigneePartyId: string;
  }
  | {
    readonly action: "complete";
    readonly expectedTaskStatus: "in_progress";
    readonly expectedAssigneePartyId: string;
  }
);

export interface ArrivalPickupTaskTransitionResult extends Readonly<Record<string, JsonValue>> {
  readonly taskId: string;
  readonly reservationId: string;
  readonly taskStatus: ArrivalPickupTaskStatus;
  readonly assigneePartyId: string;
  readonly completedAt: string | null;
  readonly action: ArrivalPickupTaskAction;
  readonly eligibleAction: ArrivalPickupTaskAction | null;
  readonly replayed: boolean;
}

export interface ArrivalPickupTaskDispatchServiceOptions {
  readonly database: Database;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface NormalizedTransition {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly taskId: string;
  readonly action: ArrivalPickupTaskAction;
  readonly expectedTaskStatus: Exclude<ArrivalPickupTaskStatus, "done">;
  readonly expectedAssigneePartyId: string | null;
  readonly staffPartyId: string | null;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface CapabilityRow {
  readonly task_id: string;
  readonly reservation_id: string;
  readonly previous_task_status: string;
  readonly task_status: string;
  readonly previous_assignee_party: string | null;
  readonly assignee_party: string | null;
  readonly task_completed_at: Date | null;
}

export class ArrivalPickupTaskDispatchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArrivalPickupTaskDispatchValidationError";
  }
}

export class ArrivalPickupTaskDispatchNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArrivalPickupTaskDispatchNotFoundError";
  }
}

export class ArrivalPickupTaskDispatchConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArrivalPickupTaskDispatchConflictError";
  }
}

function plainObject(value: unknown, subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new ArrivalPickupTaskDispatchValidationError(`${subject} must be a plain object`);
  }
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  subject: string,
): void {
  const actual = Object.keys(value);
  if (required.some((key) => !Object.hasOwn(value, key)) ||
      actual.some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new ArrivalPickupTaskDispatchValidationError(`${subject} shape is invalid`);
  }
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ArrivalPickupTaskDispatchValidationError(`${subject} must be a lowercase UUID`);
  }
  return value;
}

function storedUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ArrivalPickupTaskDispatchConflictError(`${subject} is invalid`);
  }
  return value;
}

function storedStatus(value: unknown): ArrivalPickupTaskStatus {
  if (value === "open" || value === "assigned" || value === "in_progress" || value === "done") {
    return value;
  }
  throw new ArrivalPickupTaskDispatchConflictError("Arrival pickup task status evidence is invalid");
}

function eligibleAction(status: ArrivalPickupTaskStatus, assigneePartyId: string | null): ArrivalPickupTaskAction | null {
  if (status === "open" && assigneePartyId === null) return "assign";
  if (status === "assigned" && assigneePartyId !== null) return "start";
  if (status === "in_progress" && assigneePartyId !== null) return "complete";
  return null;
}

function canonicalInstant(value: Date | null, subject: string): string | null {
  if (value === null) return null;
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new ArrivalPickupTaskDispatchConflictError(`${subject} is invalid`);
  }
  return value.toISOString();
}

function normalize(input: ArrivalPickupTaskTransitionInput): NormalizedTransition {
  plainObject(input, "arrival pickup task transition input");
  const action = input.action;
  if (action !== "assign" && action !== "start" && action !== "complete") {
    throw new ArrivalPickupTaskDispatchValidationError("action is invalid");
  }
  exactKeys(
    input,
    [
      "tenantId", "propertyNode", "reservationId", "taskId", "action",
      "expectedTaskStatus", "expectedAssigneePartyId", "idempotencyKey", "envelope",
      ...(action === "assign" ? ["staffPartyId"] : []),
    ],
    [],
    "arrival pickup task transition input",
  );
  const tenantId = uuid(input.tenantId, "tenantId");
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new ArrivalPickupTaskDispatchValidationError(
      "idempotencyKey must contain 8 to 200 visible ASCII characters",
    );
  }
  const expectedStatus = input.expectedTaskStatus;
  if ((action === "assign" && expectedStatus !== "open") ||
      (action === "start" && expectedStatus !== "assigned") ||
      (action === "complete" && expectedStatus !== "in_progress")) {
    throw new ArrivalPickupTaskDispatchValidationError("expectedTaskStatus is invalid for action");
  }
  const expectedAssigneePartyId = input.expectedAssigneePartyId === null
    ? null
    : uuid(input.expectedAssigneePartyId, "expectedAssigneePartyId");
  if ((action === "assign" && expectedAssigneePartyId !== null) ||
      (action !== "assign" && expectedAssigneePartyId === null)) {
    throw new ArrivalPickupTaskDispatchValidationError("expectedAssigneePartyId is invalid for action");
  }
  const staffPartyId = action === "assign" ? uuid(input.staffPartyId, "staffPartyId") : null;
  plainObject(input.envelope, "envelope");
  exactKeys(input.envelope, ["actorId", "tenantId", "propertyNode", "requestId", "operation"], [], "envelope");
  if (uuid(input.envelope.tenantId, "envelope.tenantId") !== tenantId ||
      uuid(input.envelope.propertyNode, "envelope.propertyNode") !== propertyNode ||
      input.envelope.operation !== "task.status_changed") {
    throw new ArrivalPickupTaskDispatchValidationError("audit envelope is not bound to task.status_changed");
  }
  return Object.freeze({
    tenantId,
    propertyNode,
    reservationId: uuid(input.reservationId, "reservationId"),
    taskId: uuid(input.taskId, "taskId"),
    action,
    expectedTaskStatus: expectedStatus,
    expectedAssigneePartyId,
    staffPartyId,
    idempotencyKey: input.idempotencyKey,
    envelope: Object.freeze({
      actorId: uuid(input.envelope.actorId, "envelope.actorId"),
      tenantId,
      propertyNode,
      requestId: uuid(input.envelope.requestId, "envelope.requestId"),
      operation: "task.status_changed",
    }),
  });
}

function translateDatabaseError(error: unknown): never {
  if (error instanceof IdempotencyConflictError) {
    throw new ArrivalPickupTaskDispatchConflictError(error.message);
  }
  const record = error as { errno?: unknown; code?: unknown; message?: unknown };
  const state = record.errno ?? record.code;
  const message = typeof record.message === "string" ? record.message : "";
  if (state === "40001" || state === "40P01" || state === "23505") {
    throw new ArrivalPickupTaskDispatchConflictError("Arrival pickup task evidence changed concurrently");
  }
  if (state === "42501" || message.includes("target is unavailable") ||
      message.includes("assignee is unavailable")) {
    throw new ArrivalPickupTaskDispatchNotFoundError(
      "Arrival pickup task or assignee was not found in the active property",
    );
  }
  if (message.includes("transition is not allowed")) {
    throw new ArrivalPickupTaskDispatchConflictError("Arrival pickup task is not eligible for that action");
  }
  if (state === "22023") {
    throw new ArrivalPickupTaskDispatchValidationError("Arrival pickup task transition input is invalid");
  }
  throw error;
}

export class ArrivalPickupTaskDispatchService {
  readonly #database: Database;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: ArrivalPickupTaskDispatchServiceOptions) {
    this.#database = options.database;
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async transition(input: ArrivalPickupTaskTransitionInput): Promise<ArrivalPickupTaskTransitionResult> {
    const normalized = normalize(input);
    try {
      const outcome = await this.#database.withTenantTransaction(normalized.tenantId, (tx) =>
        this.#idempotency.execute<ArrivalPickupTaskTransitionResult>(tx, {
          tenantId: normalized.tenantId,
          operation: "stay-operations.pickup-task.transition",
          key: normalized.idempotencyKey,
          request: {
            actorId: normalized.envelope.actorId,
            propertyNode: normalized.propertyNode,
            reservationId: normalized.reservationId,
            taskId: normalized.taskId,
            action: normalized.action,
            expectedTaskStatus: normalized.expectedTaskStatus,
            expectedAssigneePartyId: normalized.expectedAssigneePartyId,
            staffPartyId: normalized.staffPartyId,
          },
        }, async (commandTx) => {
          const rows = await commandTx<CapabilityRow[]>`
            SELECT task_id, reservation_id, previous_task_status, task_status,
                   previous_assignee_party, assignee_party, task_completed_at
            FROM public.transition_arrival_pickup_task(
              ${normalized.tenantId}::uuid,
              ${normalized.propertyNode}::uuid,
              ${normalized.reservationId}::uuid,
              ${normalized.taskId}::uuid,
              ${normalized.action},
              ${normalized.expectedTaskStatus},
              ${normalized.expectedAssigneePartyId}::uuid,
              ${normalized.staffPartyId}::uuid,
              ${normalized.envelope.actorId}::uuid
            )
          `;
          const row = rows[0];
          if (rows.length !== 1 || !row) {
            throw new ArrivalPickupTaskDispatchConflictError(
              "Arrival pickup task transition returned invalid evidence",
            );
          }
          const taskId = storedUuid(row.task_id, "taskId");
          const reservationId = storedUuid(row.reservation_id, "reservationId");
          if (taskId !== normalized.taskId || reservationId !== normalized.reservationId) {
            throw new ArrivalPickupTaskDispatchConflictError(
              "Arrival pickup task transition returned mismatched evidence",
            );
          }
          const previousStatus = storedStatus(row.previous_task_status);
          const taskStatus = storedStatus(row.task_status);
          const previousAssigneePartyId = row.previous_assignee_party === null
            ? null
            : storedUuid(row.previous_assignee_party, "previousAssigneePartyId");
          const assigneePartyId = storedUuid(row.assignee_party, "assigneePartyId");
          if (previousStatus !== normalized.expectedTaskStatus ||
              previousAssigneePartyId !== normalized.expectedAssigneePartyId ||
              (normalized.action === "assign" && assigneePartyId !== normalized.staffPartyId) ||
              (normalized.action !== "assign" && assigneePartyId !== previousAssigneePartyId)) {
            throw new ArrivalPickupTaskDispatchConflictError(
              "Arrival pickup task transition returned mismatched evidence",
            );
          }
          const expectedResultStatus = normalized.action === "assign"
            ? "assigned"
            : normalized.action === "start" ? "in_progress" : "done";
          if (taskStatus !== expectedResultStatus) {
            throw new ArrivalPickupTaskDispatchConflictError(
              "Arrival pickup task transition returned a non-adjacent status",
            );
          }
          const completedAt = canonicalInstant(row.task_completed_at, "task completed_at");
          if ((normalized.action === "complete" && completedAt === null) ||
              (normalized.action !== "complete" && completedAt !== null)) {
            throw new ArrivalPickupTaskDispatchConflictError(
              "Arrival pickup task transition returned invalid completion evidence",
            );
          }
          const payload = Object.freeze({
            reservation_id: reservationId,
            action: normalized.action,
            previous_status: previousStatus,
            current_status: taskStatus,
            completed_at: completedAt,
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
            eventType: "task.status_changed",
            actorId: normalized.envelope.actorId,
            correlationId: normalized.envelope.requestId,
            payload,
          });
          return {
            status: 200,
            body: Object.freeze({
              taskId,
              reservationId,
              taskStatus,
              assigneePartyId,
              completedAt,
              action: normalized.action,
              eligibleAction: eligibleAction(taskStatus, assigneePartyId),
              replayed: false,
            }),
          };
        }),
      );
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      if (error instanceof ArrivalPickupTaskDispatchValidationError ||
          error instanceof ArrivalPickupTaskDispatchNotFoundError ||
          error instanceof ArrivalPickupTaskDispatchConflictError) throw error;
      return translateDatabaseError(error);
    }
  }
}
