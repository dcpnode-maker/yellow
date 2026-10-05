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
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;

export const HOUSEKEEPING_SHEET_CADENCES = Object.freeze(["daily", "on_departure"] as const);
export type HousekeepingSheetCadence = (typeof HOUSEKEEPING_SHEET_CADENCES)[number];

export interface HousekeepingSheetPreviewInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly sheetDate: string;
  readonly limit?: number;
}

export interface HousekeepingSheetPreviewItem {
  readonly spaceId: string;
  readonly spaceCode: string;
  readonly floor: string | null;
  readonly profileKey: string;
  readonly cadence: HousekeepingSheetCadence;
  readonly arrivalAt: string;
  readonly departureAt: string;
}

export interface HousekeepingSheetListInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly sheetDate: string;
  readonly limit?: number;
}

export interface HousekeepingSheetListItem {
  readonly sheetId: string;
  readonly sheetDate: string;
  readonly attendantPartyId: string;
  readonly attendantName: string;
  readonly taskCount: number;
}

export interface HousekeepingSheetGenerateInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly sheetDate: string;
  readonly attendantPartyId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface HousekeepingGeneratedTask extends Readonly<Record<string, JsonValue>> {
  readonly taskId: string;
  readonly spaceId: string;
  readonly spaceCode: string;
  readonly profileKey: string;
  readonly cadence: HousekeepingSheetCadence;
}

export interface HousekeepingSheetGenerationResult extends Readonly<Record<string, JsonValue>> {
  readonly sheetId: string;
  readonly sheetDate: string;
  readonly attendantPartyId: string;
  readonly taskCount: number;
  readonly tasks: readonly HousekeepingGeneratedTask[];
  readonly replayed: boolean;
}

export interface HousekeepingSheetServiceOptions {
  readonly database: Database;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface CapabilityRow {
  readonly sheet_id: string | null;
  readonly sheet_date: string;
  readonly attendant_party: string | null;
  readonly created: boolean;
  readonly rooms: unknown;
}

interface ListRow {
  readonly sheet_id: string;
  readonly sheet_date: string;
  readonly attendant_party: string;
  readonly attendant_name: string;
  readonly task_count: number;
}

interface PreviewRecord {
  readonly space_id: unknown;
  readonly space_code: unknown;
  readonly floor: unknown;
  readonly profile_key: unknown;
  readonly cadence: unknown;
  readonly arrival_at: unknown;
  readonly departure_at: unknown;
}

interface TaskRecord {
  readonly task_id: unknown;
  readonly space_id: unknown;
  readonly space_code: unknown;
  readonly profile_key: unknown;
  readonly cadence: unknown;
}

export class HousekeepingSheetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HousekeepingSheetValidationError";
  }
}

export class HousekeepingSheetNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HousekeepingSheetNotFoundError";
  }
}

export class HousekeepingSheetConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HousekeepingSheetConflictError";
  }
}

export class HousekeepingUnsupportedCadenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HousekeepingUnsupportedCadenceError";
  }
}

function plain(value: unknown, subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new HousekeepingSheetValidationError(`${subject} must be a plain object`);
  }
}

function exact(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  subject: string,
): void {
  const actual = Object.keys(value);
  if (required.some((key) => !Object.hasOwn(value, key)) ||
      actual.some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new HousekeepingSheetValidationError(`${subject} shape is invalid`);
  }
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new HousekeepingSheetValidationError(`${subject} must be a lowercase UUID`);
  }
  return value;
}

function date(value: unknown, subject: string): string {
  if (typeof value !== "string" || !DATE.test(value)) {
    throw new HousekeepingSheetValidationError(`${subject} must be YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HousekeepingSheetValidationError(`${subject} must be a real calendar date`);
  }
  return value;
}

function limit(value: unknown): number {
  const normalized = value ?? 100;
  if (!Number.isInteger(normalized) || (normalized as number) < 1 || (normalized as number) > 200) {
    throw new HousekeepingSheetValidationError("limit must be an integer from 1 to 200");
  }
  return normalized as number;
}

function cadence(value: unknown): HousekeepingSheetCadence {
  if (value === "daily" || value === "on_departure") return value;
  throw new Error("Database returned an unsupported housekeeping cadence");
}

function text(value: unknown, subject: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`Database returned invalid ${subject}`);
  return value;
}

function nullableText(value: unknown, subject: string): string | null {
  return value === null ? null : text(value, subject);
}

function instant(value: unknown, subject: string): string {
  const raw = text(value, subject);
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Database returned invalid ${subject}`);
  return parsed.toISOString();
}

function jsonArray(value: unknown, subject: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`Database returned invalid ${subject}`);
  return value;
}

function previewInput(input: HousekeepingSheetPreviewInput): Readonly<Required<HousekeepingSheetPreviewInput>> {
  plain(input, "housekeeping sheet preview input");
  exact(input, ["tenantId", "propertyNode", "sheetDate"], ["limit"], "housekeeping sheet preview input");
  return Object.freeze({
    tenantId: uuid(input.tenantId, "tenantId"),
    propertyNode: uuid(input.propertyNode, "propertyNode"),
    sheetDate: date(input.sheetDate, "sheetDate"),
    limit: limit(input.limit),
  });
}

function listInput(input: HousekeepingSheetListInput): Readonly<Required<HousekeepingSheetListInput>> {
  plain(input, "housekeeping sheet list input");
  exact(input, ["tenantId", "propertyNode", "sheetDate"], ["limit"], "housekeeping sheet list input");
  return Object.freeze({
    tenantId: uuid(input.tenantId, "tenantId"),
    propertyNode: uuid(input.propertyNode, "propertyNode"),
    sheetDate: date(input.sheetDate, "sheetDate"),
    limit: limit(input.limit),
  });
}

function generateInput(input: HousekeepingSheetGenerateInput): HousekeepingSheetGenerateInput {
  plain(input, "housekeeping sheet generate input");
  exact(input, [
    "tenantId", "propertyNode", "sheetDate", "attendantPartyId", "idempotencyKey", "envelope",
  ], [], "housekeeping sheet generate input");
  const tenantId = uuid(input.tenantId, "tenantId");
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new HousekeepingSheetValidationError("idempotencyKey must contain 8 to 200 visible ASCII characters");
  }
  plain(input.envelope, "envelope");
  exact(input.envelope, ["actorId", "tenantId", "propertyNode", "requestId", "operation"], [], "envelope");
  if (uuid(input.envelope.tenantId, "envelope.tenantId") !== tenantId ||
      uuid(input.envelope.propertyNode, "envelope.propertyNode") !== propertyNode ||
      input.envelope.operation !== "task.created") {
    throw new HousekeepingSheetValidationError("audit envelope is not bound to task.created");
  }
  return Object.freeze({
    tenantId,
    propertyNode,
    sheetDate: date(input.sheetDate, "sheetDate"),
    attendantPartyId: uuid(input.attendantPartyId, "attendantPartyId"),
    idempotencyKey: input.idempotencyKey,
    envelope: Object.freeze({
      actorId: uuid(input.envelope.actorId, "envelope.actorId"),
      tenantId,
      propertyNode,
      requestId: uuid(input.envelope.requestId, "envelope.requestId"),
      operation: "task.created",
    }),
  });
}

function parsePreview(value: unknown): readonly HousekeepingSheetPreviewItem[] {
  return Object.freeze(jsonArray(value, "housekeeping preview rooms").map((item) => {
    plain(item, "housekeeping preview room");
    const row = item as unknown as PreviewRecord;
    return Object.freeze({
      spaceId: uuid(row.space_id, "spaceId"),
      spaceCode: text(row.space_code, "space code"),
      floor: nullableText(row.floor, "floor"),
      profileKey: text(row.profile_key, "profile key"),
      cadence: cadence(row.cadence),
      arrivalAt: instant(row.arrival_at, "arrival instant"),
      departureAt: instant(row.departure_at, "departure instant"),
    });
  }));
}

function parseTasks(value: unknown): readonly HousekeepingGeneratedTask[] {
  return Object.freeze(jsonArray(value, "generated housekeeping tasks").map((item) => {
    plain(item, "generated housekeeping task");
    const row = item as unknown as TaskRecord;
    return Object.freeze({
      taskId: uuid(row.task_id, "taskId"),
      spaceId: uuid(row.space_id, "spaceId"),
      spaceCode: text(row.space_code, "space code"),
      profileKey: text(row.profile_key, "profile key"),
      cadence: cadence(row.cadence),
    });
  }));
}

function translate(error: unknown): never {
  if (error instanceof HousekeepingSheetValidationError ||
      error instanceof HousekeepingSheetConflictError ||
      error instanceof HousekeepingSheetNotFoundError ||
      error instanceof HousekeepingUnsupportedCadenceError) throw error;
  if (error instanceof IdempotencyConflictError) throw new HousekeepingSheetConflictError(error.message);
  const record = error as { errno?: unknown; code?: unknown; message?: unknown };
  const state = record.errno ?? record.code;
  const message = typeof record.message === "string" ? record.message : "";
  if (state === "0A000" || message.includes("cadence is unsupported")) {
    throw new HousekeepingUnsupportedCadenceError(
      "This property date uses a housekeeping cadence that this version cannot generate",
    );
  }
  if (state === "42501" || state === "55000" || message.includes("target is unavailable")) {
    throw new HousekeepingSheetNotFoundError("Housekeeping sheet target was not found in the active property");
  }
  if (state === "23505" || state === "40001" || state === "40P01") {
    throw new HousekeepingSheetConflictError("Housekeeping sheet changed concurrently or belongs to another attendant");
  }
  if (state === "55001" || message.includes("no eligible rooms")) {
    throw new HousekeepingSheetConflictError("No rooms are eligible for a housekeeping sheet on this property date");
  }
  if (state === "22023") throw new HousekeepingSheetValidationError("Housekeeping sheet input is invalid");
  throw error;
}

export class HousekeepingSheetService {
  readonly #database: Database;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: HousekeepingSheetServiceOptions) {
    this.#database = options.database;
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async preview(input: HousekeepingSheetPreviewInput): Promise<readonly HousekeepingSheetPreviewItem[]> {
    const normalized = previewInput(input);
    try {
      return await this.#database.withTenantTransaction(normalized.tenantId, async (tx) => {
        const rows = await tx<CapabilityRow[]>`
          SELECT sheet_id, sheet_date::text, attendant_party, created, rooms
          FROM public.govern_housekeeping_task_sheet(
            ${normalized.tenantId}::uuid,
            ${normalized.propertyNode}::uuid,
            ${normalized.sheetDate}::date,
            ${null}::uuid,
            ${null}::uuid,
            'preview',
            ${normalized.limit}::integer
          )
        `;
        const row = rows[0];
        if (rows.length !== 1 || !row || row.sheet_id !== null || row.attendant_party !== null || row.created) {
          throw new Error("Housekeeping preview capability returned invalid evidence");
        }
        return parsePreview(row.rooms);
      });
    } catch (error) {
      return translate(error);
    }
  }

  async list(input: HousekeepingSheetListInput): Promise<readonly HousekeepingSheetListItem[]> {
    const normalized = listInput(input);
    try {
      return await this.#database.withTenantTransaction(normalized.tenantId, async (tx) => {
        const rows = await tx<ListRow[]>`
          SELECT sheet.id AS sheet_id,
                 sheet.sheet_date::text,
                 sheet.attendant_party,
                 attendant.display_name AS attendant_name,
                 count(task.id)::int AS task_count
          FROM task_sheet AS sheet
          JOIN org_node AS property
            ON property.tenant_id = sheet.tenant_id
           AND property.id = sheet.property_node
           AND property.kind = 'property'
          JOIN party AS attendant
            ON attendant.tenant_id = sheet.tenant_id
           AND attendant.id = sheet.attendant_party
           AND attendant.status = 'active'
          JOIN party_role AS staff
            ON staff.tenant_id = attendant.tenant_id
           AND staff.party_id = attendant.id
           AND staff.role = 'staff'
          LEFT JOIN task
            ON task.tenant_id = sheet.tenant_id
           AND task.property_node = sheet.property_node
           AND task.sheet_id = sheet.id
           AND task.kind = 'housekeeping'
           AND task.subject_type = 'space'
          WHERE sheet.tenant_id = ${normalized.tenantId}::uuid
            AND sheet.tenant_id = current_setting('app.tenant_id', true)::uuid
            AND sheet.property_node = ${normalized.propertyNode}::uuid
            AND sheet.sheet_date = ${normalized.sheetDate}::date
          GROUP BY sheet.id, sheet.sheet_date, sheet.attendant_party, attendant.display_name
          ORDER BY sheet.sheet_date DESC, sheet.id
          LIMIT ${normalized.limit}
        `;
        return Object.freeze(rows.map((row) => Object.freeze({
          sheetId: uuid(row.sheet_id, "sheetId"),
          sheetDate: date(row.sheet_date, "sheetDate"),
          attendantPartyId: uuid(row.attendant_party, "attendantPartyId"),
          attendantName: text(row.attendant_name, "attendant name"),
          taskCount: row.task_count,
        })));
      });
    } catch (error) {
      return translate(error);
    }
  }

  async generate(input: HousekeepingSheetGenerateInput): Promise<HousekeepingSheetGenerationResult> {
    const normalized = generateInput(input);
    try {
      const outcome = await this.#database.withTenantTransaction(normalized.tenantId, (tx) =>
        this.#idempotency.execute<HousekeepingSheetGenerationResult>(tx, {
          tenantId: normalized.tenantId,
          operation: "housekeeping.sheet.generate",
          key: normalized.idempotencyKey,
          request: {
            actorId: normalized.envelope.actorId,
            propertyNode: normalized.propertyNode,
            sheetDate: normalized.sheetDate,
            attendantPartyId: normalized.attendantPartyId,
          },
        }, async (commandTx) => {
          const rows = await commandTx<CapabilityRow[]>`
            SELECT sheet_id, sheet_date::text, attendant_party, created, rooms
            FROM public.govern_housekeeping_task_sheet(
              ${normalized.tenantId}::uuid,
              ${normalized.propertyNode}::uuid,
              ${normalized.sheetDate}::date,
              ${normalized.attendantPartyId}::uuid,
              ${normalized.envelope.actorId}::uuid,
              'generate',
              ${null}::integer
            )
          `;
          const row = rows[0];
          if (rows.length !== 1 || !row || row.sheet_id === null || row.attendant_party === null) {
            throw new HousekeepingSheetConflictError("Housekeeping generation returned invalid evidence");
          }
          const tasks = parseTasks(row.rooms);
          const sheetId = uuid(row.sheet_id, "sheetId");
          const attendantPartyId = uuid(row.attendant_party, "attendantPartyId");
          if (attendantPartyId !== normalized.attendantPartyId) {
            throw new HousekeepingSheetConflictError("Housekeeping sheet belongs to another attendant");
          }

          if (row.created) {
            for (const task of tasks) {
              const payload = Object.freeze({
                sheet_id: sheetId,
                sheet_date: normalized.sheetDate,
                attendant_party_id: attendantPartyId,
                space_id: task.spaceId,
                profile_key: task.profileKey,
                cadence: task.cadence,
                status: "assigned",
                department: "Housekeeping",
              });
              const fact = await recordFact(commandTx, {
                entityType: "task",
                entityId: task.taskId,
                envelope: normalized.envelope,
                payload,
              });
              await this.#events.publish(commandTx, {
                tenantId: normalized.tenantId,
                propertyNode: normalized.propertyNode,
                businessDate: fact.businessDate,
                aggregateType: "task",
                aggregateId: task.taskId,
                eventType: "task.created",
                actorId: normalized.envelope.actorId,
                correlationId: normalized.envelope.requestId,
                payload,
              });
            }
          }

          return {
            status: row.created ? 201 : 200,
            body: Object.freeze({
              sheetId,
              sheetDate: date(row.sheet_date, "sheetDate"),
              attendantPartyId,
              taskCount: tasks.length,
              tasks,
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
