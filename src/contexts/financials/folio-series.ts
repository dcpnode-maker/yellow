import type { AuditEnvelope, JsonValue, PostgresIdempotency, Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const PREFIX = /^[A-Za-z0-9/-]{1,24}$/;

export interface ConfigureNonFiscalFolioSeriesInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly prefix: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface ConfigureNonFiscalFolioSeriesResult {
  readonly seriesId: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly kind: "folio";
  readonly prefix: string;
  readonly fiscal: false;
  readonly nextNo: string;
  readonly created: boolean;
  readonly replayed: boolean;
  readonly status: 200 | 201;
}

interface StoredSeriesBody extends Readonly<Record<string, JsonValue>> {
  readonly seriesId: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly kind: "folio";
  readonly prefix: string;
  readonly fiscal: false;
  readonly nextNo: string;
  readonly created: boolean;
}

interface SeriesRow {
  readonly series_id: string;
  readonly tenant_id: string;
  readonly property_node: string;
  readonly prefix: string;
  readonly next_no: string;
  readonly created: boolean;
}

export class NonFiscalFolioSeriesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonFiscalFolioSeriesValidationError";
  }
}

export class NonFiscalFolioSeriesConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonFiscalFolioSeriesConflictError";
  }
}

export class NonFiscalFolioSeriesUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonFiscalFolioSeriesUnavailableError";
  }
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length &&
    [...expected].sort().every((key, index) => actual[index] === key);
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new NonFiscalFolioSeriesValidationError(`${name} must be a UUID`);
  }
  return value;
}

function normalize(input: ConfigureNonFiscalFolioSeriesInput): ConfigureNonFiscalFolioSeriesInput {
  if (typeof input !== "object" || input === null || Array.isArray(input) || !exactKeys(input, [
    "tenantId", "propertyNode", "prefix", "idempotencyKey", "envelope",
  ])) {
    throw new NonFiscalFolioSeriesValidationError("folio-series input is invalid");
  }
  if (typeof input.envelope !== "object" || input.envelope === null || Array.isArray(input.envelope) ||
      !exactKeys(input.envelope, ["actorId", "tenantId", "propertyNode", "requestId", "operation"])) {
    throw new NonFiscalFolioSeriesValidationError("folio-series audit envelope is invalid");
  }
  const tenantId = requireUuid("tenantId", input.tenantId);
  const propertyNode = requireUuid("propertyNode", input.propertyNode);
  if (requireUuid("envelope.tenantId", input.envelope.tenantId) !== tenantId ||
      requireUuid("envelope.propertyNode", input.envelope.propertyNode) !== propertyNode ||
      input.envelope.operation !== "folio.series.configured") {
    throw new NonFiscalFolioSeriesValidationError("folio-series audit scope is invalid");
  }
  requireUuid("envelope.actorId", input.envelope.actorId);
  requireUuid("envelope.requestId", input.envelope.requestId);
  if (typeof input.prefix !== "string" || input.prefix !== input.prefix.trim() || !PREFIX.test(input.prefix)) {
    throw new NonFiscalFolioSeriesValidationError("prefix must contain 1-24 allowed visible characters");
  }
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new NonFiscalFolioSeriesValidationError("idempotency key must contain 8-200 visible ASCII characters");
  }
  return Object.freeze({
    tenantId,
    propertyNode,
    prefix: input.prefix,
    idempotencyKey: input.idempotencyKey,
    envelope: input.envelope,
  });
}

function stored(row: SeriesRow): StoredSeriesBody {
  if (!UUID.test(row.series_id) || !UUID.test(row.tenant_id) || !UUID.test(row.property_node) ||
      !PREFIX.test(row.prefix) || !/^[1-9][0-9]*$/.test(row.next_no) || typeof row.created !== "boolean") {
    throw new NonFiscalFolioSeriesUnavailableError("PostgreSQL returned an invalid folio-series receipt");
  }
  return Object.freeze({
    seriesId: row.series_id,
    tenantId: row.tenant_id,
    propertyNode: row.property_node,
    kind: "folio",
    prefix: row.prefix,
    fiscal: false,
    nextNo: row.next_no,
    created: row.created,
  });
}

export class NonFiscalFolioSeriesConfigurationService {
  readonly #idempotency: PostgresIdempotency;

  constructor(idempotency: PostgresIdempotency) {
    this.#idempotency = idempotency;
  }

  async configure(
    tx: Tx,
    input: ConfigureNonFiscalFolioSeriesInput,
  ): Promise<Readonly<ConfigureNonFiscalFolioSeriesResult>> {
    const normalized = normalize(input);
    const authority = await tx<{ checked: boolean }[]>`
      SELECT true AS checked
      FROM public.assert_non_fiscal_folio_series_configuration_authority(
        ${normalized.tenantId}::uuid,
        ${normalized.propertyNode}::uuid,
        ${normalized.envelope.actorId}::uuid
      )
    `;
    if (authority.length !== 1 || authority[0]?.checked !== true) {
      throw new NonFiscalFolioSeriesUnavailableError("PostgreSQL did not confirm folio-series authority");
    }
    const outcome = await this.#idempotency.execute<StoredSeriesBody>(tx, {
      tenantId: normalized.tenantId,
      operation: "financials.folio-series.configure",
      key: normalized.idempotencyKey,
      request: {
        actorId: normalized.envelope.actorId,
        propertyNode: normalized.propertyNode,
        prefix: normalized.prefix,
      },
    }, async (commandTx) => {
      const rows = await commandTx<SeriesRow[]>`
        SELECT
          series_id::text,
          tenant_id::text,
          property_node::text,
          prefix,
          next_no::text,
          created
        FROM configure_non_fiscal_folio_series(
          ${normalized.tenantId}::uuid,
          ${normalized.propertyNode}::uuid,
          ${normalized.prefix},
          ${normalized.envelope.actorId}::uuid,
          ${normalized.envelope.requestId}::uuid
        )
      `;
      if (rows.length !== 1) {
        throw new NonFiscalFolioSeriesUnavailableError("PostgreSQL did not return one folio-series receipt");
      }
      const body = stored(rows[0]!);
      return { status: body.created ? 201 : 200, body };
    });
    if (outcome.status !== 200 && outcome.status !== 201) {
      throw new NonFiscalFolioSeriesUnavailableError("Stored folio-series status is invalid");
    }
    return Object.freeze({
      ...outcome.body,
      replayed: outcome.replayed,
      status: outcome.status,
    });
  }
}
