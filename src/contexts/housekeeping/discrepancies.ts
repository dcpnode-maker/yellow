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
const PERSON_TOKEN = /^persons:([1-9][0-9]{0,2})$/;
const MAX_OPEN = 100;

export const HOUSEKEEPING_OBSERVED_PRESENCES = Object.freeze(["occupied", "vacant"] as const);
export const HOUSEKEEPING_DISCREPANCY_KINDS = Object.freeze(["sleep", "skip", "person"] as const);
export type HousekeepingObservedPresence = (typeof HOUSEKEEPING_OBSERVED_PRESENCES)[number];
export type HousekeepingDiscrepancyKind = (typeof HOUSEKEEPING_DISCREPANCY_KINDS)[number];

export interface HousekeepingDiscrepancyListInput {
  readonly tenantId: string;
  readonly propertyNode: string;
}
export interface HousekeepingDiscrepancyReportInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly spaceId: string;
  readonly observedPresence: HousekeepingObservedPresence;
  readonly observedPersons: number | null;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}
export interface HousekeepingDiscrepancy extends Readonly<Record<string, JsonValue>> {
  readonly discrepancyId: string;
  readonly spaceId: string;
  readonly code: string;
  readonly floor: string | null;
  readonly kind: HousekeepingDiscrepancyKind;
  readonly reported: string;
  readonly systemState: string;
  readonly reportedBy: string;
  readonly reportedAt: string;
}
export interface HousekeepingDiscrepancyReportResult extends Readonly<Record<string, JsonValue>> {
  readonly discrepancy: HousekeepingDiscrepancy | null;
  readonly created: boolean;
  readonly replayed: boolean;
}
export interface HousekeepingDiscrepancyServiceOptions {
  readonly database: Database;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface DiscrepancyRow {
  readonly discrepancy_id: string;
  readonly room_id: string;
  readonly room_code: string;
  readonly room_floor: string | null;
  readonly discrepancy_kind: string;
  readonly reported_value: string;
  readonly system_value: string;
  readonly reporter_id: string;
  readonly discrepancy_reported_at: Date | string;
}
interface CapabilityRow {
  readonly discrepancy_id: string | null;
  readonly room_id: string;
  readonly room_code: string;
  readonly room_floor: string | null;
  readonly discrepancy_kind: string | null;
  readonly reported_value: string | null;
  readonly system_value: string | null;
  readonly reporter_id: string | null;
  readonly discrepancy_reported_at: Date | string | null;
  readonly created: boolean;
}

export class HousekeepingDiscrepancyValidationError extends Error {
  constructor(message: string) { super(message); this.name = "HousekeepingDiscrepancyValidationError"; }
}
export class HousekeepingDiscrepancyNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "HousekeepingDiscrepancyNotFoundError"; }
}
export class HousekeepingDiscrepancyConflictError extends Error {
  constructor(message: string) { super(message); this.name = "HousekeepingDiscrepancyConflictError"; }
}

function plain(value: unknown, subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new HousekeepingDiscrepancyValidationError(`${subject} must be a plain object`);
  }
}
function exact(value: Record<string, unknown>, keys: readonly string[], subject: string): void {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new HousekeepingDiscrepancyValidationError(`${subject} shape is invalid`);
  }
}
function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new HousekeepingDiscrepancyValidationError(`${subject} must be a lowercase UUID`);
  }
  return value;
}
function text(value: unknown, subject: string, maximum: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum || /[\x00-\x1f\x7f]/u.test(value)) {
    throw new Error(`Database returned invalid ${subject}`);
  }
  return value;
}
function instant(value: unknown, subject: string): string {
  if (!(value instanceof Date) && typeof value !== "string") throw new Error(`Database returned invalid ${subject}`);
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Database returned invalid ${subject}`);
  return parsed.toISOString();
}
function presence(value: unknown): HousekeepingObservedPresence {
  if (value === "occupied" || value === "vacant") return value;
  throw new HousekeepingDiscrepancyValidationError("observedPresence must be occupied or vacant");
}
function kind(value: unknown): HousekeepingDiscrepancyKind {
  if (value === "sleep" || value === "skip" || value === "person") return value;
  throw new Error("Database returned an invalid discrepancy kind");
}
function tokens(discrepancyKind: HousekeepingDiscrepancyKind, reported: string, systemState: string): void {
  if ((discrepancyKind === "sleep" && reported === "occupied" && systemState === "vacant") ||
      (discrepancyKind === "skip" && reported === "vacant" && systemState === "occupied")) return;
  if (discrepancyKind === "person") {
    const observed = PERSON_TOKEN.exec(reported);
    const expected = PERSON_TOKEN.exec(systemState);
    if (observed && expected && Number(observed[1]) <= 99 && observed[1] !== expected[1]) return;
  }
  throw new Error("Database returned incoherent discrepancy evidence");
}
function canonical(row: DiscrepancyRow): HousekeepingDiscrepancy {
  const discrepancyKind = kind(row.discrepancy_kind);
  const reported = text(row.reported_value, "reported discrepancy value", 32);
  const systemState = text(row.system_value, "system discrepancy value", 32);
  tokens(discrepancyKind, reported, systemState);
  return Object.freeze({
    discrepancyId: uuid(row.discrepancy_id, "discrepancyId"),
    spaceId: uuid(row.room_id, "spaceId"),
    code: text(row.room_code, "room code", 120),
    floor: row.room_floor === null ? null : text(row.room_floor, "room floor", 120),
    kind: discrepancyKind,
    reported,
    systemState,
    reportedBy: uuid(row.reporter_id, "reportedBy"),
    reportedAt: instant(row.discrepancy_reported_at, "discrepancy report time"),
  });
}

function normalizeList(input: HousekeepingDiscrepancyListInput): HousekeepingDiscrepancyListInput {
  plain(input, "housekeeping discrepancy list input");
  exact(input, ["tenantId", "propertyNode"], "housekeeping discrepancy list input");
  return Object.freeze({
    tenantId: uuid(input.tenantId, "tenantId"),
    propertyNode: uuid(input.propertyNode, "propertyNode"),
  });
}

function normalizeReport(input: HousekeepingDiscrepancyReportInput): HousekeepingDiscrepancyReportInput {
  plain(input, "housekeeping discrepancy report input");
  exact(input, [
    "tenantId", "propertyNode", "spaceId", "observedPresence", "observedPersons",
    "idempotencyKey", "envelope",
  ], "housekeeping discrepancy report input");
  const tenantId = uuid(input.tenantId, "tenantId");
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  const observedPresence = presence(input.observedPresence);
  if ((observedPresence === "occupied" && (!Number.isInteger(input.observedPersons) ||
       (input.observedPersons ?? 0) < 1 || (input.observedPersons ?? 100) > 99)) ||
      (observedPresence === "vacant" && input.observedPersons !== null)) {
    throw new HousekeepingDiscrepancyValidationError(
      "observedPersons must be 1 to 99 when occupied and null when vacant",
    );
  }
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new HousekeepingDiscrepancyValidationError(
      "idempotencyKey must contain 8 to 200 visible ASCII characters",
    );
  }
  plain(input.envelope, "envelope");
  exact(input.envelope, ["actorId", "tenantId", "propertyNode", "requestId", "operation"], "envelope");
  if (uuid(input.envelope.tenantId, "envelope.tenantId") !== tenantId ||
      uuid(input.envelope.propertyNode, "envelope.propertyNode") !== propertyNode ||
      input.envelope.operation !== "discrepancy.reported") {
    throw new HousekeepingDiscrepancyValidationError("audit envelope is not bound to discrepancy.reported");
  }
  const envelope = Object.freeze({
    actorId: uuid(input.envelope.actorId, "envelope.actorId"),
    tenantId,
    propertyNode,
    requestId: uuid(input.envelope.requestId, "envelope.requestId"),
    operation: "discrepancy.reported",
  });
  return Object.freeze({
    tenantId,
    propertyNode,
    spaceId: uuid(input.spaceId, "spaceId"),
    observedPresence,
    observedPersons: observedPresence === "occupied" ? input.observedPersons : null,
    idempotencyKey: input.idempotencyKey,
    envelope,
  });
}

function translate(error: unknown): never {
  if (error instanceof IdempotencyConflictError) {
    throw new HousekeepingDiscrepancyConflictError(error.message);
  }
  const record = error as { errno?: unknown; code?: unknown; message?: unknown };
  const state = record.errno ?? record.code;
  const message = typeof record.message === "string" ? record.message : "";
  if (state === "40001" || state === "40P01" || state === "23505" ||
      message.includes("conflicts with an open discrepancy")) {
    throw new HousekeepingDiscrepancyConflictError("Room observation conflicts with the unresolved discrepancy");
  }
  if (state === "42501" || state === "55000" || message.includes("target is unavailable") ||
      message.includes("evidence is incoherent")) {
    throw new HousekeepingDiscrepancyNotFoundError(
      "Room was not found as an exact reportable room in the active property",
    );
  }
  if (state === "22023") throw new HousekeepingDiscrepancyValidationError("Room observation is invalid");
  throw error;
}

export class HousekeepingDiscrepancyService {
  readonly #database: Database;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: HousekeepingDiscrepancyServiceOptions) {
    this.#database = options.database;
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async listOpen(input: HousekeepingDiscrepancyListInput): Promise<readonly HousekeepingDiscrepancy[]> {
    const target = normalizeList(input);
    try {
      const rows = await this.#database.withTenantTransaction(target.tenantId, (tx) =>
        tx<DiscrepancyRow[]>`
          SELECT discrepancy.id AS discrepancy_id,
                 room.id AS room_id, room.code AS room_code, room.floor AS room_floor,
                 CASE
                   WHEN discrepancy.reported = 'occupied' AND discrepancy.system_state = 'vacant' THEN 'sleep'
                   WHEN discrepancy.reported = 'vacant' AND discrepancy.system_state = 'occupied' THEN 'skip'
                   WHEN discrepancy.reported ~ '^persons:[1-9][0-9]{0,2}$'
                    AND discrepancy.system_state ~ '^persons:[1-9][0-9]{0,2}$' THEN 'person'
                   ELSE NULL
                 END AS discrepancy_kind,
                 discrepancy.reported AS reported_value,
                 discrepancy.system_state AS system_value,
                 discrepancy.reported_by AS reporter_id,
                 discrepancy.reported_at AS discrepancy_reported_at
          FROM public.discrepancy AS discrepancy
          JOIN public.space AS room
            ON room.tenant_id = discrepancy.tenant_id
           AND room.id = discrepancy.space_id
           AND room.property_node = ${target.propertyNode}::uuid
           AND room.status = 'active'
          JOIN public.unit_condition AS condition
            ON condition.tenant_id = room.tenant_id
           AND condition.space_id = room.id
          WHERE discrepancy.tenant_id = ${target.tenantId}::uuid
            AND discrepancy.tenant_id = current_setting('app.tenant_id', true)::uuid
            AND discrepancy.resolved_at IS NULL
          ORDER BY discrepancy.reported_at DESC, discrepancy.id DESC
          LIMIT ${MAX_OPEN + 1}
        `,
      );
      if (rows.length > MAX_OPEN) {
        throw new HousekeepingDiscrepancyConflictError(
          "Open room discrepancies exceed the bounded reporting surface",
        );
      }
      return Object.freeze(rows.map(canonical));
    } catch (error) {
      if (error instanceof HousekeepingDiscrepancyConflictError) throw error;
      return translate(error);
    }
  }

  async report(input: HousekeepingDiscrepancyReportInput): Promise<HousekeepingDiscrepancyReportResult> {
    const normalized = normalizeReport(input);
    try {
      const outcome = await this.#database.withTenantTransaction(normalized.tenantId, (tx) =>
        this.#idempotency.execute<HousekeepingDiscrepancyReportResult>(tx, {
          tenantId: normalized.tenantId,
          operation: "housekeeping.discrepancy.report",
          key: normalized.idempotencyKey,
          request: {
            actorId: normalized.envelope.actorId,
            propertyNode: normalized.propertyNode,
            spaceId: normalized.spaceId,
            observedPresence: normalized.observedPresence,
            observedPersons: normalized.observedPersons,
          },
        }, async (commandTx) => {
          const rows = await commandTx<CapabilityRow[]>`
            SELECT discrepancy_id, room_id, room_code, room_floor, discrepancy_kind,
                   reported_value, system_value, reporter_id, discrepancy_reported_at, created
            FROM public.report_room_discrepancy(
              ${normalized.tenantId}::uuid,
              ${normalized.propertyNode}::uuid,
              ${normalized.spaceId}::uuid,
              ${normalized.observedPresence},
              ${normalized.observedPersons}::integer,
              ${normalized.envelope.actorId}::uuid
            )
          `;
          const row = rows[0];
          if (rows.length !== 1 || !row || row.room_id !== normalized.spaceId) {
            throw new HousekeepingDiscrepancyNotFoundError(
              "Room was not found as an exact reportable room in the active property",
            );
          }
          const absent = row.discrepancy_id === null && row.discrepancy_kind === null &&
            row.reported_value === null && row.system_value === null && row.reporter_id === null &&
            row.discrepancy_reported_at === null;
          if (absent) {
            if (row.created) throw new Error("Database returned invalid matching room evidence");
            return {
              status: 200,
              body: Object.freeze({ discrepancy: null, created: false, replayed: false }),
            };
          }
          if (row.discrepancy_id === null || row.discrepancy_kind === null ||
              row.reported_value === null || row.system_value === null || row.reporter_id === null ||
              row.discrepancy_reported_at === null) {
            throw new Error("Database returned incomplete discrepancy evidence");
          }
          const discrepancy = canonical(row as DiscrepancyRow);
          if (discrepancy.spaceId !== normalized.spaceId) {
            throw new Error("Database returned mismatched discrepancy room evidence");
          }
          if (row.created) {
            const payload = Object.freeze({
              space_id: discrepancy.spaceId,
              kind: discrepancy.kind,
              reported: discrepancy.reported,
              system_state: discrepancy.systemState,
            });
            const fact = await recordFact(commandTx, {
              entityType: "discrepancy",
              entityId: discrepancy.discrepancyId,
              envelope: normalized.envelope,
              payload,
            });
            await this.#events.publish(commandTx, {
              tenantId: normalized.tenantId,
              propertyNode: normalized.propertyNode,
              businessDate: fact.businessDate,
              aggregateType: "discrepancy",
              aggregateId: discrepancy.discrepancyId,
              eventType: "discrepancy.reported",
              actorId: normalized.envelope.actorId,
              correlationId: normalized.envelope.requestId,
              payload,
            });
          }
          return {
            status: row.created ? 201 : 200,
            body: Object.freeze({ discrepancy, created: row.created, replayed: false }),
          };
        }),
      );
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      if (error instanceof HousekeepingDiscrepancyNotFoundError) throw error;
      return translate(error);
    }
  }
}
