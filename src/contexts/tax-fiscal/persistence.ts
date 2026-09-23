import {
  IdempotencyConflictError,
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";
import {
  TaxAttributionSnapshotError,
  parsePositiveTaxAttributionSnapshot,
  type PositiveTaxAttributionSnapshotV1,
} from "./attribution";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const CURRENCY = /^[A-Z]{3}$/;
const RECORDED_EVENT = "tax.attribution_recorded";
const RECORD_OPERATION = RECORDED_EVENT;
const ENTITY_TYPE = "tax_attribution_snapshot";

export interface RecordTaxAttributionInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly snapshot: unknown;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface GetTaxAttributionInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly attributionId: string;
}

export interface TaxAttributionReceipt extends Readonly<Record<string, JsonValue>> {
  readonly attributionId: string;
  readonly propertyNode: string;
  readonly schemaVersion: 1;
  readonly originKind: "rate_quote";
  readonly originQuoteHash: string;
  readonly snapshotHash: string;
  readonly currency: string;
  readonly recordedBy: string;
  readonly recordedAt: string;
  readonly created: boolean;
  readonly replayed: boolean;
}

export interface TaxAttributionRecord {
  readonly attributionId: string;
  readonly propertyNode: string;
  readonly schemaVersion: 1;
  readonly originKind: "rate_quote";
  readonly originQuoteHash: string;
  readonly snapshotHash: string;
  readonly currency: string;
  readonly snapshot: PositiveTaxAttributionSnapshotV1;
  readonly recordedBy: string;
  readonly recordedAt: string;
}

export interface TaxAttributionPersistenceServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface NormalizedRecordInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly snapshot: PositiveTaxAttributionSnapshotV1;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface TaxAttributionRow {
  readonly attribution_id: string;
  readonly property_node: string;
  readonly actor_id: string;
  readonly schema_version: number;
  readonly origin_kind: string;
  readonly origin_quote_hash: string;
  readonly snapshot_hash: string;
  readonly currency: string;
  readonly snapshot: unknown;
  readonly recorded_at: Date | string;
  readonly created?: boolean;
}

interface RecordBody extends Readonly<Record<string, JsonValue>> {
  readonly attributionId: string;
  readonly propertyNode: string;
  readonly schemaVersion: 1;
  readonly originKind: "rate_quote";
  readonly originQuoteHash: string;
  readonly snapshotHash: string;
  readonly currency: string;
  readonly recordedBy: string;
  readonly recordedAt: string;
  readonly created: boolean;
}

export class TaxAttributionPersistenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxAttributionPersistenceValidationError";
  }
}

export class TaxAttributionPersistenceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxAttributionPersistenceNotFoundError";
  }
}

export class TaxAttributionPersistenceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxAttributionPersistenceConflictError";
  }
}

function exactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
  subject: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new TaxAttributionPersistenceValidationError(`${subject} must be a plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) => descriptor.get !== undefined ||
        descriptor.set !== undefined || descriptor.enumerable !== true)) {
    throw new TaxAttributionPersistenceValidationError(`${subject} shape is invalid`);
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new TaxAttributionPersistenceValidationError(`${subject} must be a UUID`);
  }
  return value;
}

function envelope(value: unknown, tenantId: string, propertyNode: string): AuditEnvelope {
  const source = exactPlainRecord(
    value,
    ["actorId", "tenantId", "propertyNode", "requestId", "operation"],
    "envelope",
  );
  const envelopeTenant = uuid(source.tenantId, "envelope.tenantId");
  const envelopeProperty = uuid(source.propertyNode, "envelope.propertyNode");
  if (envelopeTenant !== tenantId || envelopeProperty !== propertyNode) {
    throw new TaxAttributionPersistenceValidationError(
      "tenant and property must match the audit envelope",
    );
  }
  if (source.operation !== RECORDED_EVENT) {
    throw new TaxAttributionPersistenceValidationError(
      `audit operation must be ${RECORDED_EVENT}`,
    );
  }
  return Object.freeze({
    actorId: uuid(source.actorId, "envelope.actorId"),
    tenantId,
    propertyNode,
    requestId: uuid(source.requestId, "envelope.requestId"),
    operation: RECORDED_EVENT,
  });
}

function parseSnapshot(value: unknown): PositiveTaxAttributionSnapshotV1 {
  try {
    return parsePositiveTaxAttributionSnapshot(value);
  } catch (error) {
    if (error instanceof TaxAttributionSnapshotError) {
      throw new TaxAttributionPersistenceValidationError(
        "snapshot must be an exact canonical positive tax-attribution value",
      );
    }
    throw error;
  }
}

function parseStoredSnapshot(value: unknown): PositiveTaxAttributionSnapshotV1 {
  try {
    return parsePositiveTaxAttributionSnapshot(value);
  } catch (error) {
    if (error instanceof TaxAttributionSnapshotError) {
      throw new TaxAttributionPersistenceConflictError(
        "Stored tax-attribution snapshot is not canonical",
      );
    }
    throw error;
  }
}

function normalizeRecord(input: RecordTaxAttributionInput): NormalizedRecordInput {
  const source = exactPlainRecord(
    input,
    ["tenantId", "propertyNode", "snapshot", "idempotencyKey", "envelope"],
    "record input",
  );
  const tenantId = uuid(source.tenantId, "tenantId");
  const propertyNode = uuid(source.propertyNode, "propertyNode");
  if (typeof source.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(source.idempotencyKey)) {
    throw new TaxAttributionPersistenceValidationError(
      "idempotencyKey must contain 8-200 visible ASCII characters",
    );
  }
  const snapshot = parseSnapshot(source.snapshot);
  return Object.freeze({
    tenantId,
    propertyNode,
    snapshot,
    idempotencyKey: source.idempotencyKey,
    envelope: envelope(source.envelope, tenantId, propertyNode),
  });
}

function normalizeGet(input: GetTaxAttributionInput): GetTaxAttributionInput {
  const source = exactPlainRecord(
    input,
    ["tenantId", "propertyNode", "attributionId"],
    "get input",
  );
  return Object.freeze({
    tenantId: uuid(source.tenantId, "tenantId"),
    propertyNode: uuid(source.propertyNode, "propertyNode"),
    attributionId: uuid(source.attributionId, "attributionId"),
  });
}

function instant(value: Date | string): string {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new TaxAttributionPersistenceConflictError(
      "Stored tax-attribution evidence has an invalid recorded instant",
    );
  }
  return parsed.toISOString();
}

function canonicalRecord(row: TaxAttributionRow, propertyNode: string): TaxAttributionRecord {
  if (!UUID.test(row.attribution_id) || row.property_node !== propertyNode ||
      !UUID.test(row.actor_id) || row.schema_version !== 1 || row.origin_kind !== "rate_quote" ||
      !SHA256.test(row.origin_quote_hash) || !SHA256.test(row.snapshot_hash) ||
      !CURRENCY.test(row.currency)) {
    throw new TaxAttributionPersistenceConflictError(
      "Stored tax-attribution metadata is incomplete or inconsistent",
    );
  }
  const snapshot = parseStoredSnapshot(row.snapshot);
  if (snapshot.schemaVersion !== row.schema_version || snapshot.origin.kind !== row.origin_kind ||
      snapshot.origin.quoteHash !== row.origin_quote_hash ||
      snapshot.snapshotHash !== row.snapshot_hash || snapshot.currency !== row.currency) {
    throw new TaxAttributionPersistenceConflictError(
      "Stored tax-attribution metadata does not match its canonical snapshot",
    );
  }
  return Object.freeze({
    attributionId: row.attribution_id,
    propertyNode: row.property_node,
    schemaVersion: 1 as const,
    originKind: "rate_quote" as const,
    originQuoteHash: row.origin_quote_hash,
    snapshotHash: row.snapshot_hash,
    currency: row.currency,
    snapshot,
    recordedBy: row.actor_id,
    recordedAt: instant(row.recorded_at),
  });
}

function receipt(record: TaxAttributionRecord, created: boolean): RecordBody {
  return Object.freeze({
    attributionId: record.attributionId,
    propertyNode: record.propertyNode,
    schemaVersion: record.schemaVersion,
    originKind: record.originKind,
    originQuoteHash: record.originQuoteHash,
    snapshotHash: record.snapshotHash,
    currency: record.currency,
    recordedBy: record.recordedBy,
    recordedAt: record.recordedAt,
    created,
  });
}

function evidencePayload(record: TaxAttributionRecord): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    attribution_id: record.attributionId,
    property_node: record.propertyNode,
    origin_kind: record.originKind,
    origin_quote_hash: record.originQuoteHash,
    snapshot_hash: record.snapshotHash,
    currency: record.currency,
  });
}

function translate(error: unknown): never {
  if (error instanceof TaxAttributionPersistenceValidationError ||
      error instanceof TaxAttributionPersistenceNotFoundError ||
      error instanceof TaxAttributionPersistenceConflictError) throw error;
  if (error instanceof IdempotencyConflictError) {
    throw new TaxAttributionPersistenceConflictError(error.message);
  }
  const state = (error as { errno?: unknown; code?: unknown }).errno ??
    (error as { errno?: unknown; code?: unknown }).code;
  if (state === "42501" || state === "55000") {
    throw new TaxAttributionPersistenceNotFoundError(
      "Tax-attribution target was not found in the active tenant property",
    );
  }
  if (state === "22023") {
    throw new TaxAttributionPersistenceValidationError("Tax-attribution input is invalid");
  }
  if (state === "23505" || state === "23514" || state === "40001" || state === "40P01") {
    throw new TaxAttributionPersistenceConflictError(
      "Tax-attribution state is unavailable or changed concurrently",
    );
  }
  throw error;
}

export class TaxAttributionPersistenceService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: TaxAttributionPersistenceServiceOptions) {
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async record(tx: Tx, input: RecordTaxAttributionInput): Promise<TaxAttributionReceipt> {
    const normalized = normalizeRecord(input);
    try {
      const outcome = await this.#idempotency.execute<RecordBody>(tx, {
        tenantId: normalized.tenantId,
        operation: RECORD_OPERATION,
        key: normalized.idempotencyKey,
        request: {
          actorId: normalized.envelope.actorId,
          propertyNode: normalized.propertyNode,
          snapshotHash: normalized.snapshot.snapshotHash,
        },
      }, async (commandTx) => {
        const snapshotJson = JSON.stringify(normalized.snapshot);
        const rows = await commandTx<TaxAttributionRow[]>`
          SELECT attribution_id, property_node, actor_id, schema_version::integer,
                 origin_kind, origin_quote_hash, snapshot_hash, currency::text,
                 snapshot, recorded_at, created
          FROM public.record_tax_attribution_snapshot(
            ${normalized.tenantId}::uuid,
            ${normalized.propertyNode}::uuid,
            ${normalized.envelope.actorId}::uuid,
            ${normalized.snapshot.schemaVersion}::integer,
            ${normalized.snapshot.origin.kind}::text,
            ${normalized.snapshot.origin.quoteHash}::text,
            ${normalized.snapshot.snapshotHash}::text,
            ${normalized.snapshot.currency}::text,
            ${snapshotJson}::text::jsonb
          )
        `;
        const row = rows[0];
        if (rows.length !== 1 || !row || typeof row.created !== "boolean") {
          throw new TaxAttributionPersistenceConflictError(
            "Tax-attribution capability returned invalid evidence",
          );
        }
        const record = canonicalRecord(row, normalized.propertyNode);
        if (row.created) {
          const payload = evidencePayload(record);
          const fact = await recordFact(commandTx, {
            entityType: ENTITY_TYPE,
            entityId: record.attributionId,
            envelope: normalized.envelope,
            payload,
          });
          await this.#events.publish(commandTx, {
            tenantId: normalized.tenantId,
            propertyNode: normalized.propertyNode,
            businessDate: fact.businessDate,
            aggregateType: ENTITY_TYPE,
            aggregateId: record.attributionId,
            eventType: RECORDED_EVENT,
            actorId: normalized.envelope.actorId,
            correlationId: normalized.envelope.requestId,
            payload,
          });
        }
        return {
          status: row.created ? 201 : 200,
          body: receipt(record, row.created),
        };
      });
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      return translate(error);
    }
  }

  async get(tx: Tx, input: GetTaxAttributionInput): Promise<TaxAttributionRecord> {
    const normalized = normalizeGet(input);
    try {
      const rows = await tx<TaxAttributionRow[]>`
        SELECT id AS attribution_id, property_node, actor_id,
               schema_version::integer, origin_kind, origin_quote_hash, snapshot_hash,
               currency::text, snapshot, recorded_at
        FROM public.tax_attribution_snapshot
        WHERE tenant_id = ${normalized.tenantId}::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property_node = ${normalized.propertyNode}::uuid
          AND id = ${normalized.attributionId}::uuid
      `;
      const row = rows[0];
      if (rows.length !== 1 || !row) {
        throw new TaxAttributionPersistenceNotFoundError(
          "Tax-attribution record was not found in the active tenant property",
        );
      }
      return canonicalRecord(row, normalized.propertyNode);
    } catch (error) {
      return translate(error);
    }
  }
}
