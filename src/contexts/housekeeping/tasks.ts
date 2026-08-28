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
const CURSOR = /^[A-Za-z0-9_-]{1,2048}$/;
const MICROSECOND_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

export const HOUSEKEEPING_TASK_ACTIONS = Object.freeze(["start", "complete", "verify"] as const);
export const HOUSEKEEPING_TASK_STATUSES = Object.freeze([
  "assigned", "in_progress", "done", "verified",
] as const);
export const HOUSEKEEPING_ROOM_CONDITIONS = Object.freeze([
  "clean", "dirty", "pickup", "inspected",
] as const);

export type HousekeepingTaskAction = (typeof HOUSEKEEPING_TASK_ACTIONS)[number];
export type HousekeepingTaskStatus = (typeof HOUSEKEEPING_TASK_STATUSES)[number];
export type HousekeepingRoomCondition = (typeof HOUSEKEEPING_ROOM_CONDITIONS)[number];

export interface HousekeepingBoardInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly limit?: number;
}

export interface HousekeepingConditionListInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly condition?: HousekeepingRoomCondition;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface HousekeepingConditionBoardRow {
  readonly spaceId: string;
  readonly code: string;
  readonly floor: string | null;
  readonly condition: HousekeepingRoomCondition;
  readonly updatedAt: string;
}

export interface HousekeepingConditionPage {
  readonly rooms: readonly HousekeepingConditionBoardRow[];
  readonly nextCursor: string | null;
}

export interface HousekeepingTaskBoardItem {
  readonly taskId: string;
  readonly taskStatus: HousekeepingTaskStatus;
  readonly spaceId: string;
  readonly spaceCode: string;
  readonly floor: string | null;
  readonly roomCondition: HousekeepingRoomCondition;
  readonly roomUpdatedAt: string;
  readonly assigneePartyId: string | null;
  readonly dueAt: string | null;
  readonly priority: number;
  readonly completedAt: string | null;
  readonly eligibleAction: HousekeepingTaskAction | null;
}

export interface HousekeepingTransitionInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly taskId: string;
  readonly action: HousekeepingTaskAction;
  readonly expectedTaskStatus: HousekeepingTaskStatus;
  readonly expectedRoomCondition: HousekeepingRoomCondition;
  readonly expectedRoomUpdatedAt: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface HousekeepingTransitionResult extends Readonly<Record<string, JsonValue>> {
  readonly taskId: string;
  readonly taskStatus: HousekeepingTaskStatus;
  readonly spaceId: string;
  readonly roomCondition: HousekeepingRoomCondition;
  readonly roomUpdatedAt: string;
  readonly completedAt: string | null;
  readonly action: HousekeepingTaskAction;
  readonly eligibleAction: HousekeepingTaskAction | null;
  readonly replayed: boolean;
}

export interface HousekeepingTaskServiceOptions {
  readonly database: Database;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface BoardRow {
  readonly task_id: string;
  readonly task_status: string;
  readonly space_id: string;
  readonly space_code: string;
  readonly floor: string | null;
  readonly room_condition: string;
  readonly room_updated_at: Date;
  readonly assignee_party: string | null;
  readonly due_at: Date | null;
  readonly priority: number;
  readonly completed_at: Date | null;
}

interface CapabilityRow {
  readonly task_id: string;
  readonly task_status: string;
  readonly space_id: string;
  readonly room_condition: string;
  readonly room_updated_at: Date;
  readonly task_completed_at: Date | null;
}

interface HousekeepingConditionCursor {
  readonly v: 1;
  readonly condition: HousekeepingRoomCondition | null;
  readonly code: string;
  readonly id: string;
}

interface HousekeepingConditionSqlRow {
  readonly id: string;
  readonly code: string;
  readonly floor: string | null;
  readonly condition: string;
  readonly updated_at: string;
}

export class HousekeepingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HousekeepingValidationError";
  }
}

export class HousekeepingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HousekeepingNotFoundError";
  }
}

export class HousekeepingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HousekeepingConflictError";
  }
}

function plainObject(value: unknown, subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new HousekeepingValidationError(`${subject} must be a plain object`);
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
    throw new HousekeepingValidationError(`${subject} shape is invalid`);
  }
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new HousekeepingValidationError(`${subject} must be a lowercase UUID`);
  }
  return value;
}

function action(value: unknown): HousekeepingTaskAction {
  if (value === "start" || value === "complete" || value === "verify") return value;
  throw new HousekeepingValidationError("action is invalid");
}

function status(value: unknown, subject = "task status"): HousekeepingTaskStatus {
  if (value === "assigned" || value === "in_progress" || value === "done" || value === "verified") {
    return value;
  }
  throw new HousekeepingValidationError(`${subject} is invalid`);
}

function condition(value: unknown, subject = "room condition"): HousekeepingRoomCondition {
  if (value === "clean" || value === "dirty" || value === "pickup" || value === "inspected") {
    return value;
  }
  throw new HousekeepingValidationError(`${subject} is invalid`);
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function encodeConditionCursor(cursor: HousekeepingConditionCursor): string {
  return encodeBase64Url(JSON.stringify(cursor));
}

function decodeConditionCursor(value: unknown): HousekeepingConditionCursor | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || !CURSOR.test(value)) {
    throw new HousekeepingValidationError("cursor is invalid");
  }
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(value));
    plainObject(parsed, "cursor");
    exactKeys(parsed, ["v", "condition", "code", "id"], [], "cursor");
    if (parsed.v !== 1 ||
        (parsed.condition !== null && !HOUSEKEEPING_ROOM_CONDITIONS.includes(parsed.condition as HousekeepingRoomCondition)) ||
        typeof parsed.code !== "string" || parsed.code.length > 512 ||
        typeof parsed.id !== "string" || !UUID.test(parsed.id)) {
      throw new Error("cursor fields");
    }
    const cursor = Object.freeze({
      v: 1 as const,
      condition: parsed.condition as HousekeepingRoomCondition | null,
      code: parsed.code,
      id: parsed.id,
    });
    if (encodeConditionCursor(cursor) !== value) throw new Error("cursor is non-canonical");
    return cursor;
  } catch (error) {
    if (error instanceof HousekeepingValidationError && error.message === "cursor is invalid") {
      throw error;
    }
    throw new HousekeepingValidationError("cursor is invalid");
  }
}

function conditionListInput(input: HousekeepingConditionListInput) {
  plainObject(input, "housekeeping condition input");
  exactKeys(
    input,
    ["tenantId", "propertyNode"],
    ["condition", "cursor", "limit"],
    "housekeeping condition input",
  );
  const normalizedCondition = input.condition === undefined ? null : condition(input.condition, "condition");
  if (input.limit !== undefined &&
      (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)) {
    throw new HousekeepingValidationError("limit must be an integer from 1 to 100");
  }
  const cursor = decodeConditionCursor(input.cursor);
  if (cursor !== null && cursor.condition !== normalizedCondition) {
    throw new HousekeepingValidationError("cursor does not belong to this condition filter");
  }
  return Object.freeze({
    tenantId: uuid(input.tenantId, "tenantId"),
    propertyNode: uuid(input.propertyNode, "propertyNode"),
    condition: normalizedCondition,
    cursor,
    limit: input.limit ?? 50,
  });
}

function storedConditionText(value: unknown, subject: string): string {
  if (typeof value !== "string" || value.length > 512) {
    throw new HousekeepingConflictError(`Stored room ${subject} is invalid`);
  }
  return value;
}

function storedConditionUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new HousekeepingConflictError("Stored room space id is invalid");
  }
  return value;
}

function storedConditionInstant(value: unknown): string {
  if (typeof value !== "string" || !MICROSECOND_UTC.test(value)) {
    throw new HousekeepingConflictError("Stored room condition timestamp is invalid");
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 23) !== value.slice(0, 23)) {
    throw new HousekeepingConflictError("Stored room condition timestamp is invalid");
  }
  return value;
}

function storedRoomCondition(value: unknown): HousekeepingRoomCondition {
  if (value === "clean" || value === "dirty" || value === "pickup" || value === "inspected") {
    return value;
  }
  throw new HousekeepingConflictError("Stored room condition is invalid");
}

function canonicalConditionRow(row: HousekeepingConditionSqlRow): HousekeepingConditionBoardRow {
  return Object.freeze({
    spaceId: storedConditionUuid(row.id),
    code: storedConditionText(row.code, "code"),
    floor: row.floor === null ? null : storedConditionText(row.floor, "floor"),
    condition: storedRoomCondition(row.condition),
    updatedAt: storedConditionInstant(row.updated_at),
  });
}

function instant(value: unknown, subject: string): string {
  if (typeof value !== "string") throw new HousekeepingValidationError(`${subject} must be an ISO instant`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new HousekeepingValidationError(`${subject} must be a canonical ISO instant`);
  }
  return value;
}

function iso(value: Date, subject: string): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error(`Database returned invalid ${subject}`);
  }
  return value.toISOString();
}

function eligibleAction(
  taskStatus: HousekeepingTaskStatus,
  roomCondition: HousekeepingRoomCondition,
  assigneePartyId: string | null = null,
): HousekeepingTaskAction | null {
  if (taskStatus === "assigned" && assigneePartyId !== null) return "start";
  if (taskStatus === "in_progress" && (roomCondition === "dirty" || roomCondition === "pickup")) {
    return "complete";
  }
  if (taskStatus === "done" && roomCondition === "clean") return "verify";
  return null;
}

function boardInput(input: HousekeepingBoardInput): Readonly<Required<HousekeepingBoardInput>> {
  plainObject(input, "housekeeping board input");
  exactKeys(input, ["tenantId", "propertyNode"], ["limit"], "housekeeping board input");
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new HousekeepingValidationError("limit must be an integer from 1 to 200");
  }
  return Object.freeze({
    tenantId: uuid(input.tenantId, "tenantId"),
    propertyNode: uuid(input.propertyNode, "propertyNode"),
    limit,
  });
}

function transitionInput(input: HousekeepingTransitionInput): HousekeepingTransitionInput {
  plainObject(input, "housekeeping transition input");
  exactKeys(input, [
    "tenantId", "propertyNode", "taskId", "action", "expectedTaskStatus",
    "expectedRoomCondition", "expectedRoomUpdatedAt", "idempotencyKey", "envelope",
  ], [], "housekeeping transition input");
  const tenantId = uuid(input.tenantId, "tenantId");
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  const normalizedAction = action(input.action);
  const expectedTaskStatus = status(input.expectedTaskStatus, "expectedTaskStatus");
  const expectedForAction = normalizedAction === "start" ? "assigned" :
    normalizedAction === "complete" ? "in_progress" : "done";
  if (expectedTaskStatus !== expectedForAction) {
    throw new HousekeepingValidationError("expectedTaskStatus does not match action");
  }
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new HousekeepingValidationError("idempotencyKey must contain 8 to 200 visible ASCII characters");
  }
  plainObject(input.envelope, "envelope");
  exactKeys(input.envelope, ["actorId", "tenantId", "propertyNode", "requestId", "operation"], [], "envelope");
  if (uuid(input.envelope.tenantId, "envelope.tenantId") !== tenantId ||
      uuid(input.envelope.propertyNode, "envelope.propertyNode") !== propertyNode ||
      input.envelope.operation !== "task.status_changed") {
    throw new HousekeepingValidationError("audit envelope is not bound to task.status_changed");
  }
  const envelope = Object.freeze({
    actorId: uuid(input.envelope.actorId, "envelope.actorId"),
    tenantId,
    propertyNode,
    requestId: uuid(input.envelope.requestId, "envelope.requestId"),
    operation: "task.status_changed",
  });
  return Object.freeze({
    tenantId,
    propertyNode,
    taskId: uuid(input.taskId, "taskId"),
    action: normalizedAction,
    expectedTaskStatus,
    expectedRoomCondition: condition(input.expectedRoomCondition, "expectedRoomCondition"),
    expectedRoomUpdatedAt: instant(input.expectedRoomUpdatedAt, "expectedRoomUpdatedAt"),
    idempotencyKey: input.idempotencyKey,
    envelope,
  });
}

function translateDatabaseError(error: unknown): never {
  if (error instanceof IdempotencyConflictError) {
    throw new HousekeepingConflictError(error.message);
  }
  const record = error as { errno?: unknown; code?: unknown; message?: unknown };
  const state = record.errno ?? record.code;
  const message = typeof record.message === "string" ? record.message : "";
  if (state === "40001" || state === "40P01" || state === "23505") {
    throw new HousekeepingConflictError("Housekeeping task or room evidence changed concurrently");
  }
  if (state === "42501" || message.includes("target is unavailable")) {
    throw new HousekeepingNotFoundError("Housekeeping task was not found in the active property");
  }
  if (message.includes("transition is not allowed")) {
    throw new HousekeepingConflictError("Housekeeping task is not eligible for that action");
  }
  throw error;
}

export class HousekeepingTaskService {
  readonly #database: Database;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: HousekeepingTaskServiceOptions) {
    this.#database = options.database;
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async listConditions(input: HousekeepingConditionListInput): Promise<HousekeepingConditionPage> {
    const page = conditionListInput(input);
    const rows = await this.#database.withTenantTransaction(page.tenantId, async (tx) =>
      tx<HousekeepingConditionSqlRow[]>`
        WITH target_property AS MATERIALIZED (
          SELECT property.id
          FROM public.org_node AS property
          WHERE property.tenant_id = ${page.tenantId}::uuid
            AND property.tenant_id = current_setting('app.tenant_id', true)::uuid
            AND property.id = ${page.propertyNode}::uuid
            AND property.kind = 'property'
        )
        SELECT room.id, room.code, room.floor, room_condition.condition,
               to_char(
                 room_condition.updated_at AT TIME ZONE 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
               ) AS updated_at
        FROM public.space AS room
        JOIN target_property AS property ON property.id = room.property_node
        JOIN public.unit_condition AS room_condition
          ON room_condition.tenant_id = ${page.tenantId}::uuid
         AND room_condition.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND room_condition.space_id = room.id
        WHERE room.tenant_id = ${page.tenantId}::uuid
          AND room.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND room.status = 'active'
          AND (${page.condition}::text IS NULL OR room_condition.condition = ${page.condition}::text)
          AND (
            ${page.cursor?.code ?? null}::text IS NULL OR
            room.code COLLATE "C" > ${page.cursor?.code ?? null}::text COLLATE "C" OR
            (room.code COLLATE "C" = ${page.cursor?.code ?? null}::text COLLATE "C" AND
             room.id > ${page.cursor?.id ?? null}::uuid)
          )
        ORDER BY room.code COLLATE "C", room.id
        LIMIT ${page.limit + 1}
      `,
    );
    const hasMore = rows.length > page.limit;
    const rooms = Object.freeze(rows.slice(0, page.limit).map(canonicalConditionRow));
    const last = rooms.at(-1);
    return Object.freeze({
      rooms,
      nextCursor: hasMore && last
        ? encodeConditionCursor({
          v: 1,
          condition: page.condition,
          code: last.code,
          id: last.spaceId,
        })
        : null,
    });
  }

  async listBoard(input: HousekeepingBoardInput): Promise<readonly HousekeepingTaskBoardItem[]> {
    const normalized = boardInput(input);
    try {
      return await this.#database.withTenantTransaction(normalized.tenantId, async (tx) => {
        const rows = await tx<BoardRow[]>`
          SELECT task.id AS task_id, task.status AS task_status,
                 room.id AS space_id, room.code AS space_code, room.floor,
                 condition.condition AS room_condition,
                 condition.updated_at AS room_updated_at,
                 task.assignee_party, task.due_at, task.priority, task.completed_at
          FROM task
          JOIN org_node AS property
            ON property.tenant_id = task.tenant_id
           AND property.id = task.property_node
           AND property.kind = 'property'
          JOIN space AS room
            ON room.tenant_id = task.tenant_id
           AND room.id = task.subject_id
           AND room.property_node = task.property_node
           AND room.status = 'active'
          JOIN unit_condition AS condition
            ON condition.tenant_id = task.tenant_id
           AND condition.space_id = room.id
          WHERE task.tenant_id = ${normalized.tenantId}::uuid
            AND task.tenant_id = current_setting('app.tenant_id', true)::uuid
            AND task.property_node = ${normalized.propertyNode}::uuid
            AND task.kind = 'housekeeping'
            AND task.subject_type = 'space'
            AND task.status IN ('assigned', 'in_progress', 'done')
          ORDER BY task.priority ASC, task.due_at ASC NULLS LAST, room.code ASC, task.id ASC
          LIMIT ${normalized.limit}
        `;
        return Object.freeze(rows.map((row): HousekeepingTaskBoardItem => {
          const taskStatus = status(row.task_status);
          const roomCondition = condition(row.room_condition);
          const assigneePartyId = row.assignee_party === null ? null : uuid(row.assignee_party, "assigneePartyId");
          return Object.freeze({
            taskId: uuid(row.task_id, "taskId"),
            taskStatus,
            spaceId: uuid(row.space_id, "spaceId"),
            spaceCode: row.space_code,
            floor: row.floor,
            roomCondition,
            roomUpdatedAt: iso(row.room_updated_at, "room updated_at"),
            assigneePartyId,
            dueAt: row.due_at === null ? null : iso(row.due_at, "task due_at"),
            priority: row.priority,
            completedAt: row.completed_at === null ? null : iso(row.completed_at, "task completed_at"),
            eligibleAction: eligibleAction(taskStatus, roomCondition, assigneePartyId),
          });
        }));
      });
    } catch (error) {
      return translateDatabaseError(error);
    }
  }

  async transition(input: HousekeepingTransitionInput): Promise<HousekeepingTransitionResult> {
    const normalized = transitionInput(input);
    try {
      const outcome = await this.#database.withTenantTransaction(normalized.tenantId, (tx) =>
        this.#idempotency.execute<HousekeepingTransitionResult>(tx, {
          tenantId: normalized.tenantId,
          operation: "housekeeping.task.transition",
          key: normalized.idempotencyKey,
          request: {
            actorId: normalized.envelope.actorId,
            propertyNode: normalized.propertyNode,
            taskId: normalized.taskId,
            action: normalized.action,
            expectedTaskStatus: normalized.expectedTaskStatus,
            expectedRoomCondition: normalized.expectedRoomCondition,
            expectedRoomUpdatedAt: normalized.expectedRoomUpdatedAt,
          },
        }, async (commandTx) => {
          const rows = await commandTx<CapabilityRow[]>`
            SELECT task_id, task_status, space_id, room_condition,
                   room_updated_at, task_completed_at
            FROM public.transition_housekeeping_task(
              ${normalized.tenantId}::uuid,
              ${normalized.propertyNode}::uuid,
              ${normalized.taskId}::uuid,
              ${normalized.action},
              ${normalized.expectedTaskStatus},
              ${normalized.expectedRoomCondition},
              ${normalized.expectedRoomUpdatedAt}::timestamptz,
              ${normalized.envelope.actorId}::uuid
            )
          `;
          const row = rows[0];
          if (rows.length !== 1 || !row) {
            throw new HousekeepingConflictError("Housekeeping transition returned invalid evidence");
          }
          const taskStatus = status(row.task_status);
          const roomCondition = condition(row.room_condition);
          const roomUpdatedAt = iso(row.room_updated_at, "room updated_at");
          const completedAt = row.task_completed_at === null ? null : iso(row.task_completed_at, "task completed_at");
          const previousStatus = normalized.expectedTaskStatus;
          const previousCondition = normalized.expectedRoomCondition;
          const taskPayload = Object.freeze({
            action: normalized.action,
            previous_status: previousStatus,
            current_status: taskStatus,
            space_id: row.space_id,
            previous_room_condition: previousCondition,
            current_room_condition: roomCondition,
            room_updated_at: roomUpdatedAt,
          });
          const taskFact = await recordFact(commandTx, {
            entityType: "task",
            entityId: row.task_id,
            envelope: normalized.envelope,
            payload: taskPayload,
          });
          await this.#events.publish(commandTx, {
            tenantId: normalized.tenantId,
            propertyNode: normalized.propertyNode,
            businessDate: taskFact.businessDate,
            aggregateType: "task",
            aggregateId: row.task_id,
            eventType: "task.status_changed",
            actorId: normalized.envelope.actorId,
            correlationId: normalized.envelope.requestId,
            payload: taskPayload,
          });

          if (roomCondition !== previousCondition) {
            const conditionEnvelope = Object.freeze({
              ...normalized.envelope,
              operation: "unit.condition_changed",
            });
            const conditionPayload = Object.freeze({
              task_id: row.task_id,
              action: normalized.action,
              previous_condition: previousCondition,
              current_condition: roomCondition,
              room_updated_at: roomUpdatedAt,
            });
            const conditionFact = await recordFact(commandTx, {
              entityType: "unit_condition",
              entityId: row.space_id,
              envelope: conditionEnvelope,
              payload: conditionPayload,
            });
            await this.#events.publish(commandTx, {
              tenantId: normalized.tenantId,
              propertyNode: normalized.propertyNode,
              businessDate: conditionFact.businessDate,
              aggregateType: "unit_condition",
              aggregateId: row.space_id,
              eventType: "unit.condition_changed",
              actorId: normalized.envelope.actorId,
              correlationId: normalized.envelope.requestId,
              causationId: taskFact.id,
              payload: conditionPayload,
            });
          }

          return {
            status: 200,
            body: Object.freeze({
              taskId: uuid(row.task_id, "taskId"),
              taskStatus,
              spaceId: uuid(row.space_id, "spaceId"),
              roomCondition,
              roomUpdatedAt,
              completedAt,
              action: normalized.action,
              eligibleAction: eligibleAction(taskStatus, roomCondition),
              replayed: false,
            }),
          };
        })
      );
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      return translateDatabaseError(error);
    }
  }
}
