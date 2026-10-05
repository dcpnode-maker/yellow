import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INPUT_KEYS = ["tenantId", "eventId"] as const;
const ROW_KEYS = [
  "posting_binding_id",
  "native_timing_id",
  "tax_id",
  "valuation_id",
  "applicability_id",
  "reservation_id",
  "folio_id",
  "journal_id",
  "currency",
  "business_date",
  "evidence_hash",
  "created",
] as const;

type ExactRecord = Readonly<Record<string, unknown>>;

interface NativeFiscalAccountingRow {
  readonly posting_binding_id: unknown;
  readonly native_timing_id: unknown;
  readonly tax_id: unknown;
  readonly valuation_id: unknown;
  readonly applicability_id: unknown;
  readonly reservation_id: unknown;
  readonly folio_id: unknown;
  readonly journal_id: unknown;
  readonly currency: unknown;
  readonly business_date: unknown;
  readonly evidence_hash: unknown;
  readonly created: unknown;
}

export interface IndiaNativeFiscalAccountingEventInput {
  readonly tenantId: string;
  readonly eventId: string;
}

export interface IndiaNativeFiscalAccountingEventResult {
  readonly postingBindingId: string;
  readonly nativeTimingId: string;
  readonly taxId: string;
  readonly valuationId: string;
  readonly applicabilityId: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly journalId: string | null;
  readonly currency: "INR";
  readonly businessDate: string;
  readonly evidenceHash: string;
  readonly created: boolean;
  readonly replayed: boolean;
}

export class IndiaNativeFiscalAccountingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaNativeFiscalAccountingValidationError";
  }
}

export class IndiaNativeFiscalAccountingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaNativeFiscalAccountingNotFoundError";
  }
}

export class IndiaNativeFiscalAccountingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaNativeFiscalAccountingConflictError";
  }
}

function exact(value: unknown, expected: readonly string[], subject: string): ExactRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)
      || utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0
      || (Object.getPrototypeOf(value) !== Object.prototype
        && Object.getPrototypeOf(value) !== null)) {
    throw new IndiaNativeFiscalAccountingValidationError(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length
      || actual.some((key, index) => key !== wanted[index])
      || Object.values(descriptors).some((descriptor) =>
        descriptor.get !== undefined || descriptor.set !== undefined
        || descriptor.enumerable !== true || !("value" in descriptor))) {
    throw new IndiaNativeFiscalAccountingValidationError(`${subject} shape is invalid`);
  }
  return value as ExactRecord;
}

function inputUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaNativeFiscalAccountingValidationError(`${subject} must be a lowercase UUID`);
  }
  return value;
}

function storedUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaNativeFiscalAccountingConflictError(`${subject} is not a lowercase UUID`);
  }
  return value;
}

function storedHash(value: unknown): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new IndiaNativeFiscalAccountingConflictError("native accounting evidence hash is invalid");
  }
  return value;
}

function storedDate(value: unknown): string {
  if (typeof value !== "string") {
    throw new IndiaNativeFiscalAccountingConflictError("native accounting business date is invalid");
  }
  const match = DATE.exec(value);
  if (!match) {
    throw new IndiaNativeFiscalAccountingConflictError("native accounting business date is invalid");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12
      || day < 1 || day > (daysInMonth[month - 1] ?? 0)) {
    throw new IndiaNativeFiscalAccountingConflictError("native accounting business date is invalid");
  }
  return value;
}

function normalize(raw: IndiaNativeFiscalAccountingEventInput): Readonly<{
  tenantId: string;
  eventId: string;
}> {
  const input = exact(raw, INPUT_KEYS, "native fiscal accounting event input");
  return Object.freeze({
    tenantId: inputUuid(input.tenantId, "tenantId"),
    eventId: inputUuid(input.eventId, "eventId"),
  });
}

function result(candidate: unknown): IndiaNativeFiscalAccountingEventResult {
  let raw: ExactRecord;
  try {
    raw = exact(candidate, ROW_KEYS, "native fiscal accounting capability result");
  } catch (error) {
    if (error instanceof IndiaNativeFiscalAccountingValidationError) {
      throw new IndiaNativeFiscalAccountingConflictError(error.message);
    }
    throw error;
  }
  const journalId = raw.journal_id === null
    ? null
    : storedUuid(raw.journal_id, "native accounting journal id");
  if (raw.currency !== "INR" || typeof raw.created !== "boolean") {
    throw new IndiaNativeFiscalAccountingConflictError("native accounting capability returned invalid evidence");
  }
  return Object.freeze({
    postingBindingId: storedUuid(raw.posting_binding_id, "native accounting posting binding id"),
    nativeTimingId: storedUuid(raw.native_timing_id, "native accounting timing id"),
    taxId: storedUuid(raw.tax_id, "native accounting tax id"),
    valuationId: storedUuid(raw.valuation_id, "native accounting valuation id"),
    applicabilityId: storedUuid(raw.applicability_id, "native accounting applicability id"),
    reservationId: storedUuid(raw.reservation_id, "native accounting reservation id"),
    folioId: storedUuid(raw.folio_id, "native accounting folio id"),
    journalId,
    currency: "INR",
    businessDate: storedDate(raw.business_date),
    evidenceHash: storedHash(raw.evidence_hash),
    created: raw.created,
    replayed: !raw.created,
  });
}

function mapDbError(error: unknown): never {
  if ((typeof error !== "object" || error === null) && typeof error !== "function") {
    throw error;
  }
  const shaped = error as {
    readonly errno?: unknown;
    readonly sqlState?: unknown;
    readonly code?: unknown;
  };
  const rawState = shaped.errno ?? shaped.sqlState ?? shaped.code;
  const code = typeof rawState === "string" || typeof rawState === "number"
    ? String(rawState)
    : undefined;
  if (code === "42501") {
    throw new IndiaNativeFiscalAccountingNotFoundError(
      "Native fiscal accounting event or authority was not found",
    );
  }
  if (code === "22023" || code === "22003") {
    throw new IndiaNativeFiscalAccountingValidationError(
      "Native fiscal accounting event input is invalid",
    );
  }
  if (code === "55000" || code === "23505" || code === "23503"
      || code === "23514" || code === "P0011") {
    throw new IndiaNativeFiscalAccountingConflictError(
      "Native fiscal accounting conflicted with current authority",
    );
  }
  throw error;
}

/**
 * Consumes the persisted TaxFiscal request event inside the caller's transaction.
 * PostgreSQL owns source authentication, money, routes, dates, posting and replay.
 */
export class IndiaNativeFiscalAccountingEventHandler {
  async handle(
    tx: Tx,
    raw: IndiaNativeFiscalAccountingEventInput,
  ): Promise<IndiaNativeFiscalAccountingEventResult> {
    if (typeof tx !== "function") {
      throw new IndiaNativeFiscalAccountingValidationError("tenant transaction is unavailable");
    }
    const input = normalize(raw);
    try {
      const rows = await tx<NativeFiscalAccountingRow[]>`
        SELECT result.posting_binding_id::text AS posting_binding_id,
               result.native_timing_id::text AS native_timing_id,
               result.tax_id::text AS tax_id,
               result.valuation_id::text AS valuation_id,
               result.applicability_id::text AS applicability_id,
               result.reservation_id::text AS reservation_id,
               result.folio_id::text AS folio_id,
               result.journal_id::text AS journal_id,
               result.currency::text AS currency,
               result.business_date::text AS business_date,
               result.evidence_hash,
               result.created
          FROM public.consume_india_native_fiscal_accounting_event(
            ${input.tenantId}::uuid,
            ${input.eventId}::uuid
          ) AS result
      `;
      if (rows.length === 0) {
        throw new IndiaNativeFiscalAccountingNotFoundError(
          "Native fiscal accounting event was not consumed",
        );
      }
      if (rows.length !== 1 || !rows[0]) {
        throw new IndiaNativeFiscalAccountingConflictError(
          "Native fiscal accounting capability returned ambiguous evidence",
        );
      }
      return result(rows[0]);
    } catch (error) {
      if (error instanceof IndiaNativeFiscalAccountingValidationError
          || error instanceof IndiaNativeFiscalAccountingNotFoundError
          || error instanceof IndiaNativeFiscalAccountingConflictError) {
        throw error;
      }
      return mapDbError(error);
    }
  }
}
