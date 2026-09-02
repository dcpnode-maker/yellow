import {
  IdempotencyConflictError,
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
const OPERATION = "business_day.sealed" as const;
const IDEMPOTENCY_OPERATION = "financials.business-day.seal" as const;

export class BusinessDaySealValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessDaySealValidationError";
  }
}

export class BusinessDaySealConflictError extends Error {
  constructor(message = "Business day cannot be sealed") {
    super(message);
    this.name = "BusinessDaySealConflictError";
  }
}

export interface BusinessDaySealInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly businessDate: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface BusinessDaySealResult extends Readonly<Record<string, JsonValue>> {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly businessDate: string;
  readonly previousState: "open";
  readonly state: "sealed";
  readonly sealedAt: string;
  readonly actorId: string;
  readonly replayed: boolean;
}

export interface BusinessDaySealServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface SealRow {
  readonly tenant_id: unknown;
  readonly property_node: unknown;
  readonly business_date: unknown;
  readonly previous_state: unknown;
  readonly state: unknown;
  readonly sealed_at: unknown;
  readonly sealed_by: unknown;
}

function plain(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new BusinessDaySealValidationError(`${name} must be a plain object`);
  }
}

function exact(value: Record<string, unknown>, keys: readonly string[], name: string): void {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new BusinessDaySealValidationError(`${name} shape is invalid`);
  }
}

function uuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new BusinessDaySealValidationError(`${name} must be a lowercase UUID`);
  }
  return value;
}

function canonicalDate(value: unknown): string {
  if (typeof value !== "string") throw new BusinessDaySealValidationError("businessDate is invalid");
  const match = DATE.exec(value);
  if (!match) throw new BusinessDaySealValidationError("businessDate is invalid");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const limit = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month] ?? 0;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > limit) {
    throw new BusinessDaySealValidationError("businessDate is invalid");
  }
  return value;
}

function instant(value: unknown): string {
  const rendered = value instanceof Date ? value.toISOString() : value;
  if (typeof rendered !== "string") throw new Error("Database returned invalid seal instant");
  const parsed = new Date(rendered);
  if (!Number.isFinite(parsed.valueOf())) throw new Error("Database returned invalid seal instant");
  return parsed.toISOString();
}

function databaseText(value: unknown, expected: string, name: string): string {
  if (typeof value !== "string" || value !== expected) throw new Error(`Database returned invalid ${name}`);
  return value;
}

function receipt(value: unknown, target: Readonly<BusinessDaySealInput>): BusinessDaySealResult {
  plain(value, "stored seal receipt");
  exact(value, ["tenantId", "propertyNode", "businessDate", "previousState", "state", "sealedAt", "actorId", "replayed"], "stored seal receipt");
  databaseText(value.tenantId, target.tenantId, "receipt tenant");
  databaseText(value.propertyNode, target.propertyNode, "receipt property");
  databaseText(value.businessDate, target.businessDate, "receipt date");
  databaseText(value.previousState, "open", "receipt previous state");
  databaseText(value.state, "sealed", "receipt state");
  databaseText(value.actorId, target.actorId, "receipt actor");
  if (value.replayed !== false) throw new Error("Stored seal receipt has invalid replay marker");
  return Object.freeze({
    tenantId: target.tenantId,
    propertyNode: target.propertyNode,
    businessDate: target.businessDate,
    previousState: "open",
    state: "sealed",
    sealedAt: instant(value.sealedAt),
    actorId: target.actorId,
    replayed: false,
  });
}

function envelope(value: unknown, expected: {
  tenantId: string;
  propertyNode: string;
  actorId: string;
}): AuditEnvelope {
  plain(value, "envelope");
  exact(value, ["actorId", "tenantId", "propertyNode", "requestId", "operation"], "envelope");
  if (uuid(value.tenantId, "envelope tenantId") !== expected.tenantId ||
      uuid(value.propertyNode, "envelope propertyNode") !== expected.propertyNode ||
      uuid(value.actorId, "envelope actorId") !== expected.actorId ||
      uuid(value.requestId, "envelope requestId") !== value.requestId || value.operation !== OPERATION) {
    throw new BusinessDaySealValidationError("envelope binding is invalid");
  }
  return value as unknown as AuditEnvelope;
}

function normalize(input: BusinessDaySealInput): Readonly<BusinessDaySealInput> {
  plain(input, "seal input");
  exact(input, ["tenantId", "propertyNode", "businessDate", "actorId", "idempotencyKey", "envelope"], "seal input");
  const tenantId = uuid(input.tenantId, "tenantId");
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  const actorId = uuid(input.actorId, "actorId");
  const businessDate = canonicalDate(input.businessDate);
  if (typeof input.idempotencyKey !== "string" || !KEY.test(input.idempotencyKey)) {
    throw new BusinessDaySealValidationError("idempotencyKey is invalid");
  }
  return Object.freeze({
    tenantId,
    propertyNode,
    businessDate,
    actorId,
    idempotencyKey: input.idempotencyKey,
    envelope: envelope(input.envelope, { tenantId, propertyNode, actorId }),
  });
}

function translate(error: unknown): never {
  if (error instanceof IdempotencyConflictError) throw new BusinessDaySealConflictError(error.message);
  const code = (error as { code?: string; errno?: string }).code ?? (error as { errno?: string }).errno;
  if (["23503", "23505", "40001", "40P01", "42501", "55000", "P0002", "P0012"].includes(code ?? "")) {
    throw new BusinessDaySealConflictError();
  }
  throw error;
}

export class BusinessDaySealService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: BusinessDaySealServiceOptions) {
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async seal(tx: Tx, input: BusinessDaySealInput): Promise<BusinessDaySealResult> {
    const target = normalize(input);
    try {
      const result = await this.#idempotency.execute<BusinessDaySealResult>(tx, {
        tenantId: target.tenantId,
        operation: IDEMPOTENCY_OPERATION,
        key: target.idempotencyKey,
        request: {
          actorId: target.actorId,
          propertyNode: target.propertyNode,
          businessDate: target.businessDate,
        },
      }, async (commandTx) => {
        const rows = await commandTx<SealRow[]>`
          SELECT * FROM public.seal_business_day_audited(
            ${target.tenantId}::uuid,
            ${target.propertyNode}::uuid,
            ${target.businessDate}::date,
            ${target.actorId}::uuid
          )
        `;
        const row = rows[0];
        if (rows.length !== 1 || !row) throw new Error("Database returned invalid seal evidence");
        const sealedAt = instant(row.sealed_at);
        databaseText(row.tenant_id, target.tenantId, "seal tenant");
        databaseText(row.property_node, target.propertyNode, "seal property");
        databaseText(row.business_date, target.businessDate, "seal date");
        databaseText(row.sealed_by, target.actorId, "seal actor");
        databaseText(row.previous_state, "open", "previous state");
        databaseText(row.state, "sealed", "state");

        const payload = Object.freeze({
          property_node: target.propertyNode,
          business_date: target.businessDate,
          previous_state: "open",
          state: "sealed",
          sealed_at: sealedAt,
          sealed_by: target.actorId,
        });
        await recordFact(commandTx, {
          entityType: "business_day",
          entityId: target.propertyNode,
          envelope: target.envelope,
          payload,
        });
        await this.#events.publish(commandTx, {
          tenantId: target.tenantId,
          propertyNode: target.propertyNode,
          businessDate: target.businessDate,
          aggregateType: "business_day",
          aggregateId: target.propertyNode,
          eventType: OPERATION,
          eventVersion: 1,
          actorId: target.actorId,
          correlationId: target.envelope.requestId,
          causationId: null,
          payload,
        });
        return {
          status: 200,
          body: {
            tenantId: target.tenantId,
            propertyNode: target.propertyNode,
            businessDate: target.businessDate,
            previousState: "open",
            state: "sealed",
            sealedAt,
            actorId: target.actorId,
            replayed: false,
          },
        };
      });
      const bounded = receipt(result.body, target);
      return Object.freeze({ ...bounded, replayed: result.replayed });
    } catch (error) {
      return translate(error);
    }
  }
}
