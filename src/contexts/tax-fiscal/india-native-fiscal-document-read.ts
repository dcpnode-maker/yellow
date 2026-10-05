import { types as utilTypes } from "node:util";
import type { Tx } from "../../kernel";
import { projectIssuedIndiaIrpWireCandidate } from "./india-irp-issued-wire-candidate";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const MINOR = /^(?:0|[1-9][0-9]{0,18})$/;
const MAX_INT64 = 9_223_372_036_854_775_807n;
const DOCUMENT_NUMBER = /^[A-Za-z0-9/-]{1,16}$/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
const SUMMARY_KEYS = ["documentId", "documentNumber", "businessDate", "issuedAt", "reservationId",
  "folioId", "recipientRegistrationId", "buyerName", "buyerGstin", "currency", "taxableMinor", "taxMinor", "totalMinor"] as const;
const DETAIL_KEYS = ["kind", "documentId", "propertyNode", "reservationId", "folioId", "seriesId", "documentNumber",
  "businessDate", "issuedAt", "recipientRegistrationId", "sourceEvidenceHash", "documentSha256", "previousHash", "contentJson"] as const;
type RecordValue = Record<string, unknown>;
type ReadErrorCode = "invalid_input" | "invalid_document" | "permission_denied" | "unsupported_jurisdiction" | "database_error";

export type IndiaNativeFiscalDocumentReadResult<T> = Readonly<
  | { ok: true; value: T }
  | { ok: false; error: Readonly<{ code: ReadErrorCode; message: string }> }
>;

export interface IndiaNativeFiscalInvoiceSummary {
  readonly documentId: string;
  readonly documentNumber: string;
  readonly businessDate: string;
  readonly issuedAt: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly recipientRegistrationId: string;
  readonly buyerName: string;
  readonly buyerGstin: string;
  readonly currency: "INR";
  readonly taxableMinor: string;
  readonly taxMinor: string;
  readonly totalMinor: string;
}

export interface IndiaNativeFiscalInvoiceList {
  readonly items: readonly Readonly<IndiaNativeFiscalInvoiceSummary>[];
  readonly matchingCount: string;
  readonly nextCursor: string | null;
}

export interface IndiaNativeFiscalInvoiceDocument {
  readonly kind: "india_native_invoice_v1";
  readonly documentId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly seriesId: string;
  readonly documentNumber: string;
  readonly businessDate: string;
  readonly issuedAt: string;
  readonly recipientRegistrationId: string;
  readonly sourceEvidenceHash: string;
  readonly documentSha256: string;
  readonly previousHash: string | null;
  readonly contentJson: string;
}

interface Scope { readonly tenantId: string; readonly propertyNode: string; readonly actorId: string }
interface Position { readonly businessDate: string; readonly issuedAt: string; readonly documentId: string }
interface ListInput extends Scope {
  readonly issuedFrom: string; readonly issuedBefore: string;
  readonly reservationId: string | null; readonly folioId: string | null;
  readonly query: string; readonly limit: number; readonly filterHash: string;
  readonly cursor: Readonly<Position> | null;
}

function fail<T>(code: ReadErrorCode): IndiaNativeFiscalDocumentReadResult<T> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message: "Invoice information could not be read" }) });
}

/** Detached own-data snapshots avoid executing accessors or retaining mutable inputs. */
function record(value: unknown): RecordValue | null {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value)) return null;
  try {
    if (Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.getOwnPropertySymbols(value).length) return null;
    const snapshot: RecordValue = Object.create(null);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!("value" in descriptor) || descriptor.get || descriptor.set || !descriptor.enumerable) return null;
      snapshot[key] = descriptor.value;
    }
    return snapshot;
  } catch { return null; }
}

function exact(value: RecordValue, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function uuid(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }
function sha(value: unknown): value is string { return typeof value === "string" && HASH.test(value); }
function hash(value: string): string { return new Bun.CryptoHasher("sha256").update(value).digest("hex"); }
function date(value: unknown): value is string {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
}
function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value)) return false;
  const ms = `${value.slice(0, 23)}Z`;
  const instant = new Date(ms);
  return Number.isFinite(instant.getTime()) && instant.toISOString() === ms;
}
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max * 2 && value.isWellFormed()
    && !CONTROL.test(value) && Array.from(value).length <= max;
}
function minor(value: unknown): value is string {
  return typeof value === "string" && MINOR.test(value) && BigInt(value) <= MAX_INT64;
}
function scope(value: RecordValue): Scope | null {
  if (!uuid(value.tenantId) || !uuid(value.propertyNode) || !uuid(value.actorId)) return null;
  return { tenantId: value.tenantId, propertyNode: value.propertyNode, actorId: value.actorId };
}

function decodeCursor(raw: unknown, input: Scope & { filterHash: string; issuedFrom: string; issuedBefore: string }): Position | null {
  if (typeof raw !== "string" || raw.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    if (Buffer.from(json, "utf8").toString("base64url") !== raw) return null;
    const value = record(JSON.parse(json));
    if (!value || !exact(value, ["version", "tenantId", "propertyNode", "filterHash", "businessDate", "issuedAt", "documentId"])
      || value.version !== 1 || value.tenantId !== input.tenantId || value.propertyNode !== input.propertyNode
      || value.filterHash !== input.filterHash || !date(value.businessDate) || !timestamp(value.issuedAt) || !uuid(value.documentId)
      || value.businessDate < input.issuedFrom || value.businessDate >= input.issuedBefore) return null;
    const canonical = { version: 1, tenantId: input.tenantId, propertyNode: input.propertyNode, filterHash: input.filterHash,
      businessDate: value.businessDate, issuedAt: value.issuedAt, documentId: value.documentId };
    // Canonical re-encoding also rejects duplicate JSON names, alternate escaping and extra whitespace.
    if (JSON.stringify(canonical) !== json) return null;
    return Object.freeze({ businessDate: value.businessDate, issuedAt: value.issuedAt, documentId: value.documentId });
  } catch { return null; }
}

function listInput(raw: unknown): ListInput | null {
  const value = record(raw);
  if (!value) return null;
  const allowed = new Set(["tenantId", "propertyNode", "actorId", "issuedFrom", "issuedBefore", "reservationId", "folioId", "query", "after", "limit"]);
  if (Object.keys(value).some(key => !allowed.has(key))) return null;
  const authority = scope(value);
  if (!authority || !date(value.issuedFrom) || !date(value.issuedBefore)) return null;
  const days = (Date.parse(`${value.issuedBefore}T00:00:00Z`) - Date.parse(`${value.issuedFrom}T00:00:00Z`)) / 86_400_000;
  if (days < 1 || days > 366) return null;
  const reservationId = value.reservationId === undefined ? null : value.reservationId;
  const folioId = value.folioId === undefined ? null : value.folioId;
  if ((reservationId !== null && !uuid(reservationId)) || (folioId !== null && !uuid(folioId))) return null;
  const search = value.query === undefined ? "" : value.query;
  if (!text(search, 120)) return null;
  const query = search.trim();
  const limit = value.limit === undefined ? 25 : value.limit;
  if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) return null;
  const filterHash = hash(JSON.stringify([value.issuedFrom, value.issuedBefore, reservationId, folioId, query]));
  const partial = { ...authority, issuedFrom: value.issuedFrom, issuedBefore: value.issuedBefore, filterHash };
  const cursor = value.after === undefined || value.after === null ? null : decodeCursor(value.after, partial);
  if (value.after !== undefined && value.after !== null && !cursor) return null;
  return Object.freeze({ ...partial, reservationId, folioId, query, limit, cursor });
}

/** Bun SQL arrays may carry driver metadata; only detached numeric own-data cells are consumed. */
function resultRows(value: unknown, max: number): unknown[] | null {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value) || !Array.isArray(value)) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (!length || !("value" in length) || !Number.isSafeInteger(length.value) || length.value < 1 || length.value > max) return null;
  const snapshot: unknown[] = [];
  for (let index = 0; index < length.value; index++) {
    const cell = Object.getOwnPropertyDescriptor(value, String(index));
    if (!cell || !("value" in cell) || !cell.enumerable) return null;
    snapshot.push(cell.value);
  }
  return snapshot;
}

function summary(raw: unknown, input: ListInput): Readonly<IndiaNativeFiscalInvoiceSummary> | null {
  const row = record(raw);
  if (!row || !exact(row, SUMMARY_KEYS) || !uuid(row.documentId) || !uuid(row.reservationId) || !uuid(row.folioId)
    || !uuid(row.recipientRegistrationId) || typeof row.documentNumber !== "string" || !DOCUMENT_NUMBER.test(row.documentNumber)
    || !date(row.businessDate) || row.businessDate < input.issuedFrom || row.businessDate >= input.issuedBefore
    || !timestamp(row.issuedAt) || !text(row.buyerName, 256) || row.buyerName.trim().length === 0
    || typeof row.buyerGstin !== "string" || !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(row.buyerGstin)
    || row.currency !== "INR" || !minor(row.taxableMinor) || !minor(row.taxMinor) || !minor(row.totalMinor)
    || BigInt(row.taxableMinor) + BigInt(row.taxMinor) !== BigInt(row.totalMinor)
    || (input.reservationId !== null && row.reservationId !== input.reservationId)
    || (input.folioId !== null && row.folioId !== input.folioId)) return null;
  return Object.freeze(Object.fromEntries(SUMMARY_KEYS.map(key => [key, row[key]]))) as unknown as Readonly<IndiaNativeFiscalInvoiceSummary>;
}

function compare(a: Position, b: Position): number {
  for (const key of ["businessDate", "issuedAt", "documentId"] as const) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  return 0;
}

function encodeCursor(input: ListInput, last: Position): string {
  return Buffer.from(JSON.stringify({ version: 1, tenantId: input.tenantId, propertyNode: input.propertyNode,
    filterHash: input.filterHash, businessDate: last.businessDate, issuedAt: last.issuedAt, documentId: last.documentId }), "utf8").toString("base64url");
}

function listResult(raw: unknown, input: ListInput): IndiaNativeFiscalInvoiceList | null {
  const rows = resultRows(raw, input.limit + 1);
  if (!rows) return null;
  let count: string | null = null;
  let previous: Position | null = input.cursor;
  const documentIds = new Set<string>(input.cursor ? [input.cursor.documentId] : []);
  const items: Readonly<IndiaNativeFiscalInvoiceSummary>[] = [];
  for (const rawRow of rows) {
    const row = record(rawRow);
    if (!row || !exact(row, ["document_id", "business_date", "issued_at", "summary", "matching_count"])
      || !minor(row.matching_count) || (count !== null && count !== row.matching_count)) return null;
    count = row.matching_count;
    if (row.document_id === null) {
      if (rows.length !== 1 || row.business_date !== null || row.issued_at !== null || row.summary !== null
        || (!input.cursor && count !== "0")) return null;
      continue;
    }
    const item = summary(row.summary, input);
    if (!item || row.document_id !== item.documentId || row.business_date !== item.businessDate || row.issued_at !== item.issuedAt
      || documentIds.has(item.documentId) || (previous !== null && compare(item, previous) >= 0)) return null;
    documentIds.add(item.documentId);
    previous = item;
    items.push(item);
  }
  if (count === null || BigInt(count) < BigInt(items.length)) return null;
  if (!input.cursor && BigInt(items.length) !== (BigInt(count) < BigInt(input.limit + 1) ? BigInt(count) : BigInt(input.limit + 1))) return null;
  const visible = items.slice(0, input.limit);
  const last = visible.at(-1);
  return Object.freeze({ items: Object.freeze(visible), matchingCount: count,
    nextCursor: items.length > input.limit && last ? encodeCursor(input, last) : null });
}

function document(raw: unknown, input: Scope & { documentId: string }): Readonly<IndiaNativeFiscalInvoiceDocument> | null {
  const row = record(raw);
  if (!row || !exact(row, DETAIL_KEYS) || row.kind !== "india_native_invoice_v1"
    || row.documentId !== input.documentId || row.propertyNode !== input.propertyNode
    || !uuid(row.reservationId) || !uuid(row.folioId) || !uuid(row.seriesId) || !uuid(row.recipientRegistrationId)
    || typeof row.documentNumber !== "string" || !DOCUMENT_NUMBER.test(row.documentNumber)
    || !date(row.businessDate) || !timestamp(row.issuedAt) || !sha(row.sourceEvidenceHash)
    || !sha(row.documentSha256) || (row.previousHash !== null && !sha(row.previousHash)) || typeof row.contentJson !== "string") return null;
  const validated = projectIssuedIndiaIrpWireCandidate({ documentId: input.documentId,
    documentSha256: row.documentSha256, contentJson: row.contentJson });
  if (!validated.ok) return null;
  // The existing lossless validator checked duplicate names, shape, amounts and hash.
  // Use the original string-valued source, never parse numeric provider-wire money.
  const source = record(JSON.parse(row.contentJson));
  const identity = source && record(source.DocDtls);
  const expectedDate = `${row.businessDate.slice(8, 10)}/${row.businessDate.slice(5, 7)}/${row.businessDate.slice(0, 4)}`;
  if (!identity || identity.No !== row.documentNumber || identity.Dt !== expectedDate || identity.Typ !== "INV") return null;
  return Object.freeze(Object.fromEntries(DETAIL_KEYS.map(key => [key, row[key]]))) as unknown as Readonly<IndiaNativeFiscalInvoiceDocument>;
}

function databaseFailure<T>(error: unknown): IndiaNativeFiscalDocumentReadResult<T> {
  if (typeof error === "object" && error !== null && !utilTypes.isProxy(error)) {
    for (const key of ["code", "errno", "sqlState"]) {
      const descriptor = Object.getOwnPropertyDescriptor(error, key);
      if (descriptor && "value" in descriptor) {
        if (descriptor.value === "42501") return fail("permission_denied");
        if (descriptor.value === "P2082") return fail("unsupported_jurisdiction");
      }
    }
  }
  return fail("database_error");
}

/** Read-only SQL capabilities authenticate the native source and current role/property authority. */
export class IndiaNativeFiscalDocumentReadService {
  async list(tx: Tx, raw: unknown): Promise<IndiaNativeFiscalDocumentReadResult<IndiaNativeFiscalInvoiceList>> {
    const input = listInput(raw);
    if (!input || typeof tx !== "function") return fail("invalid_input");
    try {
      const rows = await tx`
        SELECT document_id::text, business_date::text,
               to_char(issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS issued_at,
               summary, matching_count::text
          FROM public.list_india_native_fiscal_documents(
            ${input.tenantId}::uuid, ${input.propertyNode}::uuid, ${input.actorId}::uuid,
            ${input.issuedFrom}::date, ${input.issuedBefore}::date, ${input.reservationId}::uuid,
            ${input.folioId}::uuid, ${input.query}, ${input.cursor?.businessDate ?? null}::date,
            ${input.cursor?.issuedAt ?? null}::timestamptz, ${input.cursor?.documentId ?? null}::uuid,
            ${input.limit + 1}::integer
          )
      `;
      const value = listResult(rows, input);
      return value ? Object.freeze({ ok: true, value }) : fail("invalid_document");
    } catch (error) { return databaseFailure(error); }
  }

  async read(tx: Tx, raw: unknown): Promise<IndiaNativeFiscalDocumentReadResult<Readonly<IndiaNativeFiscalInvoiceDocument> | null>> {
    const row = record(raw);
    const authority = row && scope(row);
    if (!row || !authority || !exact(row, ["tenantId", "propertyNode", "actorId", "documentId"])
      || !uuid(row.documentId) || typeof tx !== "function") return fail("invalid_input");
    const input = Object.freeze({ ...authority, documentId: row.documentId });
    try {
      const result = await tx`
        SELECT public.read_india_native_fiscal_document(
          ${input.tenantId}::uuid, ${input.propertyNode}::uuid, ${input.documentId}::uuid, ${input.actorId}::uuid
        ) AS document
      `;
      const rows = resultRows(result, 1);
      const wrapper = rows && record(rows[0]);
      if (!wrapper || !exact(wrapper, ["document"])) return fail("invalid_document");
      if (wrapper.document === null) return Object.freeze({ ok: true, value: null });
      const value = document(wrapper.document, input);
      return value ? Object.freeze({ ok: true, value }) : fail("invalid_document");
    } catch (error) { return databaseFailure(error); }
  }
}
