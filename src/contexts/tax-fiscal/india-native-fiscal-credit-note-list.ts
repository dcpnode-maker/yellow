import { types as utilTypes } from "node:util";
import type { Tx } from "../../kernel";
import {
  IndiaNativeFiscalCreditNoteAuthorizationError,
  IndiaNativeFiscalCreditNoteDatabaseError,
  IndiaNativeFiscalCreditNoteValidationError,
} from "./india-native-fiscal-credit-note";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NUMBER = /^[A-Za-z0-9/-]{1,16}$/;
const HASH = /^[0-9a-f]{64}$/;
const REQUIRED = ["tenantId", "propertyNode", "actorId", "issuedFrom", "issuedBefore"];
const OPTIONAL = ["docNo", "after", "limit"];
const RECEIPT_KEYS = ["documentId", "documentKind", "originalDocumentId", "originalDocNo", "originalSha256",
  "correctionJournalId", "seriesId", "docNo", "propertyNode", "reservationId", "folioId",
  "supplierRegistrationId", "recipientRegistrationId", "financialYearStart", "currency", "status",
  "businessDate", "issuedAt", "prevHash", "sha256", "sourceEvidenceHash", "totalMinor", "reason"];
const DATA_KEYS = ["tenant_id", "property_node", "document_id", "original_document_id", "doc_no",
  "original_doc_no", "business_date", "sha256", "receipt_json", "metadata_json", "bindings_valid"];
const ROW_KEYS = ["authority_receipt", ...DATA_KEYS];
type RecordValue = Record<string, unknown>;

export interface IndiaNativeFiscalCreditNoteListInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly actorId: string;
  readonly issuedFrom: string;
  readonly issuedBefore: string;
  readonly docNo?: string;
  readonly after?: string;
  readonly limit?: number;
}

export interface IndiaNativeFiscalCreditNoteSummary {
  readonly documentId: string;
  readonly originalDocumentId: string;
  readonly docNo: string;
  readonly originalDocNo: string;
  readonly businessDate: string;
  readonly propertyNode: string;
  readonly currency: "INR";
  readonly totalMinor: string;
  readonly sha256: string;
}

export interface IndiaNativeFiscalCreditNoteListResult {
  readonly items: readonly Readonly<IndiaNativeFiscalCreditNoteSummary>[];
  readonly nextCursor: string | null;
}

type Snapshot = Readonly<IndiaNativeFiscalCreditNoteListInput & { readonly limit: number }>;
type Position = Readonly<{ businessDate: string; documentId: string }>;

function record(value: unknown, required: readonly string[], optional: readonly string[] = []): RecordValue | null {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value) || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) return null;
  const keys = Reflect.ownKeys(value);
  if (required.some(key => !keys.includes(key)) || keys.some(key => typeof key !== "string" ||
      (!required.includes(key) && !optional.includes(key)))) return null;
  const result: RecordValue = Object.create(null) as RecordValue;
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!("value" in descriptor) || !descriptor.enumerable) return null;
    result[key] = descriptor.value;
  }
  return result;
}

function matches(value: unknown, expression: RegExp): value is string {
  return typeof value === "string" && expression.test(value);
}

function date(value: unknown): value is string {
  if (!matches(value, /^\d{4}-\d{2}-\d{2}$/) || value.startsWith("0000")) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function encodeCursor(input: IndiaNativeFiscalCreditNoteListInput, position: Position): string {
  return Buffer.from(JSON.stringify({version: 1, tenantId: input.tenantId, propertyNode: input.propertyNode,
    issuedFrom: input.issuedFrom, issuedBefore: input.issuedBefore, docNo: input.docNo ?? null,
    businessDate: position.businessDate, documentId: position.documentId}), "utf8").toString("base64url");
}

function decodeCursor(value: string, input: IndiaNativeFiscalCreditNoteListInput): Position | null {
  if (value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const row = record(JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
      ["version", "tenantId", "propertyNode", "issuedFrom", "issuedBefore", "docNo", "businessDate", "documentId"]);
    if (!row || row.version !== 1 || !date(row.businessDate) || !matches(row.documentId, UUID) ||
        row.businessDate < input.issuedFrom || row.businessDate >= input.issuedBefore) return null;
    const position = Object.freeze({businessDate: row.businessDate, documentId: row.documentId});
    // Exact re-encoding also rejects duplicate/escaped JSON names, whitespace,
    // alternate field order, padding, invalid UTF8 and selector substitution.
    return encodeCursor(input, position) === value ? position : null;
  } catch { return null; }
}

export function snapshotIndiaNativeFiscalCreditNoteListInput(value: unknown): Snapshot | null {
  const row = record(value, REQUIRED, OPTIONAL);
  if (!row || !matches(row.tenantId, UUID) || !matches(row.propertyNode, UUID) || !matches(row.actorId, UUID) ||
      !date(row.issuedFrom) || !date(row.issuedBefore)) return null;
  const days = (Date.parse(row.issuedBefore) - Date.parse(row.issuedFrom)) / 86_400_000;
  if (days < 1 || days > 366 || ("docNo" in row && !matches(row.docNo, NUMBER)) ||
      ("after" in row && typeof row.after !== "string") ||
      ("limit" in row && (typeof row.limit !== "number" || !Number.isInteger(row.limit) || row.limit < 1 || row.limit > 100))) return null;
  const result: Snapshot = Object.freeze({tenantId: row.tenantId, propertyNode: row.propertyNode, actorId: row.actorId,
    issuedFrom: row.issuedFrom, issuedBefore: row.issuedBefore,
    ...("docNo" in row ? {docNo: row.docNo as string} : {}),
    ...("after" in row ? {after: row.after as string} : {}), limit: "limit" in row ? row.limit as number : 25});
  return result.after !== undefined && !decodeCursor(result.after, result) ? null : result;
}

// Receipt metadata is a flat string/null object, not fiscal document content.
// Consume each token to reject duplicate decoded keys before JSON can erase them.
function scalarObject(value: unknown, keys: readonly string[]): RecordValue | null {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 16_384 || !value.isWellFormed()) return null;
  const token = /\s*("(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*")\s*:\s*("(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|null)\s*/y;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  const output: RecordValue = Object.create(null) as RecordValue;
  let offset = 1;
  try {
    JSON.parse(value); // Require JSON whitespace/escape grammar as well as unique scalar keys.
    while (offset < trimmed.length - 1) {
      token.lastIndex = offset;
      const match = token.exec(trimmed);
      if (!match) return null;
      const key = JSON.parse(match[1]!) as string;
      const item: unknown = JSON.parse(match[2]!);
      if (Object.hasOwn(output, key) || !keys.includes(key) ||
          (typeof item === "string" && !item.isWellFormed())) return null;
      output[key] = item;
      offset = token.lastIndex;
      if (offset === trimmed.length - 1) break;
      if (trimmed[offset] !== "," || offset + 1 >= trimmed.length - 1) return null;
      offset += 1;
    }
    return Object.keys(output).length === keys.length && offset === trimmed.length - 1 ? output : null;
  } catch { return null; }
}

function receipt(value: unknown): RecordValue | null {
  const row = scalarObject(value, RECEIPT_KEYS);
  if (!row || ["documentId", "originalDocumentId", "correctionJournalId", "seriesId", "propertyNode", "reservationId",
    "folioId", "supplierRegistrationId", "recipientRegistrationId"].some(key => !matches(row[key], UUID)) ||
    ["sha256", "originalSha256", "sourceEvidenceHash"].some(key => !matches(row[key], HASH)) ||
    (row.prevHash !== null && !matches(row.prevHash, HASH)) || !matches(row.docNo, NUMBER) || !matches(row.originalDocNo, NUMBER) ||
    row.documentId === row.originalDocumentId || row.supplierRegistrationId === row.recipientRegistrationId ||
    row.documentKind !== "credit_note" || row.status !== "issued" || row.currency !== "INR" ||
    !date(row.businessDate) || !date(row.financialYearStart) || row.financialYearStart.slice(5) !== "04-01" ||
    !matches(row.issuedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) ||
    !Number.isFinite(Date.parse(row.issuedAt)) || new Date(row.issuedAt).toISOString() !== row.issuedAt ||
    !matches(row.totalMinor, /^[1-9]\d{0,18}$/) || BigInt(row.totalMinor) > 9_223_372_036_854_775_807n ||
    typeof row.reason !== "string" || !row.reason.trim() || Array.from(row.reason).length > 500 || /[\u0000-\u001f\u007f]/.test(row.reason)) return null;
  return row;
}

function rowsArray(value: unknown, bound: number): RecordValue[] | null {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value) || !Array.isArray(value)) return null;
  // Like the existing credit reader, accept the driver's SQLResultArray while
  // inspecting only own data descriptors; never invoke a custom prototype.
  if (value.length < 1 || value.length > bound) return null;
  const allowed = new Set(["length", "count", "command", "lastInsertRowid", "affectedRows",
    ...Array.from({length: value.length}, (_, i) => String(i))]);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key) || !("value" in Object.getOwnPropertyDescriptor(value, key)!)) return null;
  }
  const result: RecordValue[] = [];
  for (let i = 0; i < value.length; i++) {
    const entry = Object.getOwnPropertyDescriptor(value, String(i));
    if (!entry || !("value" in entry) || !entry.enumerable) return null;
    const row = record(entry.value, ROW_KEYS);
    if (!row) return null;
    result.push(row);
  }
  return result;
}

function earlier(position: Position, before: Position): boolean {
  return position.businessDate < before.businessDate ||
    (position.businessDate === before.businessDate && position.documentId < before.documentId);
}

export class IndiaNativeFiscalCreditNoteListService {
  async list(tx: Tx, value: unknown): Promise<Readonly<IndiaNativeFiscalCreditNoteListResult>> {
    const input = snapshotIndiaNativeFiscalCreditNoteListInput(value);
    if (!input || typeof tx !== "function") throw new IndiaNativeFiscalCreditNoteValidationError();
    const cursor = input.after === undefined ? null : decodeCursor(input.after, input);
    try {
      const returned: unknown = await tx`
        WITH input AS (
          SELECT ${input.tenantId}::uuid AS tenant_id, ${input.propertyNode}::uuid AS property_node,
            ${input.actorId}::uuid AS actor_id
        ), authority AS MATERIALIZED (
          SELECT input.*, public.read_india_native_fiscal_credit_note(
            input.tenant_id, input.property_node, input.actor_id, NULL::uuid
          ) AS authority_receipt FROM input
        )
        SELECT authority.authority_receipt, page.* FROM authority LEFT JOIN LATERAL (
          SELECT c.tenant_id, c.property_node, c.document_id, c.original_document_id,
            d.doc_no, original.doc_no AS original_doc_no, c.business_date::text AS business_date,
            d.sha256, c.receipt_json,
            jsonb_build_object('documentId',d.id,'documentKind',d.kind,'originalDocumentId',original.id,
              'originalDocNo',original.doc_no,'originalSha256',original.sha256,
              'correctionJournalId',c.correction_journal_id,'seriesId',d.series_id,'docNo',d.doc_no,
              'propertyNode',d.property_node,'reservationId',origin.reservation_id,'folioId',origin.folio_id,
              'supplierRegistrationId',origin.supplier_registration_id,'recipientRegistrationId',origin.recipient_registration_id,
              'financialYearStart',series.financial_year_start,'currency','INR','status',d.status,
              'businessDate',d.business_date,'issuedAt',to_char(d.issued_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'prevHash',d.prev_hash,'sha256',d.sha256,'sourceEvidenceHash',c.source_evidence_hash,'reason',c.reason)::text AS metadata_json,
            (d.id=c.document_id AND d.property_node=c.property_node AND d.kind='credit_note' AND d.status='issued'
              AND d.business_date=c.business_date AND d.series_id=c.series_id AND d.issued_at=c.created_at
              AND d.subject_type='folio' AND d.subject_id=origin.folio_id AND original.kind='invoice' AND original.status='issued'
              AND original.property_node=c.property_node AND origin.document_id=c.original_document_id
              AND origin.source_kind='native_current_transaction_graph'
              AND series.property_node=c.property_node AND series.kind='credit_note' AND series.fiscal
              AND series.supplier_registration_id=origin.supplier_registration_id) AS bindings_valid
          FROM public.india_native_fiscal_credit_note c
          LEFT JOIN public.document d ON d.tenant_id=c.tenant_id AND d.id=c.document_id
          LEFT JOIN public.document original ON original.tenant_id=c.tenant_id AND original.id=c.original_document_id
          LEFT JOIN public.india_gst_native_fiscal_document_origin origin ON origin.tenant_id=c.tenant_id AND origin.id=c.original_origin_id
          LEFT JOIN public.document_series series ON series.tenant_id=c.tenant_id AND series.id=c.series_id
          WHERE authority.authority_receipt IS NULL AND c.tenant_id=authority.tenant_id AND c.property_node=authority.property_node
            AND c.business_date >= ${input.issuedFrom}::date AND c.business_date < ${input.issuedBefore}::date
            AND (${input.docNo ?? null}::text IS NULL OR d.doc_no=${input.docNo ?? null}::text)
            AND (${cursor?.businessDate ?? null}::date IS NULL OR (c.business_date,c.document_id) <
              (${cursor?.businessDate ?? null}::date,${cursor?.documentId ?? null}::uuid))
          ORDER BY c.business_date DESC,c.document_id DESC LIMIT ${input.limit + 1}::integer
        ) page ON true ORDER BY page.business_date DESC,page.document_id DESC
      `;
      const rows = rowsArray(returned, input.limit + 1);
      if (!rows) throw new IndiaNativeFiscalCreditNoteDatabaseError();
      if (rows.length === 1 && rows[0]!.document_id === null) {
        if (rows[0]!.authority_receipt !== null || DATA_KEYS.some(key => rows[0]![key] !== null)) throw new IndiaNativeFiscalCreditNoteDatabaseError();
        return Object.freeze({items: Object.freeze([]), nextCursor: null});
      }
      const items: Readonly<IndiaNativeFiscalCreditNoteSummary>[] = [];
      let previous = cursor;
      const seen = new Set<string>();
      for (const row of rows) {
        const stored = receipt(row.receipt_json);
        const metadata = scalarObject(row.metadata_json, RECEIPT_KEYS.filter(key => key !== "totalMinor"));
        if (row.authority_receipt !== null || row.bindings_valid !== true || row.tenant_id !== input.tenantId ||
            row.property_node !== input.propertyNode || !stored || !metadata ||
            Object.keys(metadata).some(key => metadata[key] !== stored[key]) ||
            !matches(row.document_id, UUID) || !matches(row.original_document_id, UUID) ||
            !matches(row.doc_no, NUMBER) || !matches(row.original_doc_no, NUMBER) || !matches(row.sha256, HASH) || !date(row.business_date) ||
            stored.documentId !== row.document_id || stored.originalDocumentId !== row.original_document_id ||
            stored.docNo !== row.doc_no || stored.originalDocNo !== row.original_doc_no || stored.sha256 !== row.sha256 ||
            stored.propertyNode !== row.property_node || stored.businessDate !== row.business_date ||
            row.business_date < input.issuedFrom || row.business_date >= input.issuedBefore ||
            (input.docNo !== undefined && row.doc_no !== input.docNo)) throw new IndiaNativeFiscalCreditNoteDatabaseError();
        const position = {documentId: row.document_id, businessDate: row.business_date};
        if (seen.has(position.documentId) || (previous && !earlier(position, previous))) throw new IndiaNativeFiscalCreditNoteDatabaseError();
        seen.add(position.documentId);
        previous = position;
        items.push(Object.freeze({documentId: row.document_id, originalDocumentId: row.original_document_id,
          docNo: row.doc_no, originalDocNo: row.original_doc_no, businessDate: row.business_date,
          propertyNode: input.propertyNode, currency: "INR", totalMinor: stored.totalMinor as string, sha256: row.sha256}));
      }
      const hasMore = items.length > input.limit;
      const page = Object.freeze(items.slice(0, input.limit));
      return Object.freeze({items: page, nextCursor: hasMore ? encodeCursor(input, page[page.length - 1]!) : null});
    } catch (error) {
      if (typeof error === "object" && error !== null && !utilTypes.isProxy(error)) {
        const descriptors = Object.getOwnPropertyDescriptors(error);
        if (["errno", "sqlState", "code"].some(key => descriptors[key] && "value" in descriptors[key]! && descriptors[key]!.value === "42501")) {
          throw new IndiaNativeFiscalCreditNoteAuthorizationError();
        }
      }
      throw new IndiaNativeFiscalCreditNoteDatabaseError();
    }
  }
}
