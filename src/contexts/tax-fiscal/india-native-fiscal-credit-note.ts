import { types as utilTypes } from "node:util";
import type { AuditEnvelope, Tx } from "../../kernel";
import { projectIssuedIndiaIrpWireCandidate } from "./india-irp-issued-wire-candidate";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DOCUMENT_NUMBER = /^[A-Za-z0-9/-]{1,16}$/;
const IDEMPOTENCY_KEY = /^[!-~]{8,200}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const OPERATION = "document.issued";
const MAX_RECEIPT_BYTES = 16 * 1024;
const MAX_INT64 = 9_223_372_036_854_775_807n;

const ISSUE_KEYS = [
  "tenantId", "propertyNode", "actorId", "originalDocumentId", "reason",
  "idempotencyKey", "envelope",
] as const;
const READ_KEYS = ["tenantId", "propertyNode", "actorId", "creditDocumentId"] as const;
const DISCOVERY_KEYS = ["tenantId", "propertyNode", "actorId", "originalDocumentId"] as const;
const ENVELOPE_KEYS = ["actorId", "tenantId", "propertyNode", "requestId", "operation"] as const;
const RECEIPT_KEYS = [
  "documentId", "documentKind", "originalDocumentId", "originalDocNo", "originalSha256",
  "correctionJournalId", "seriesId", "docNo", "propertyNode", "reservationId", "folioId",
  "supplierRegistrationId", "recipientRegistrationId", "financialYearStart", "currency", "status",
  "businessDate", "issuedAt", "prevHash", "sha256", "sourceEvidenceHash", "totalMinor", "reason",
] as const;

type PlainRecord = Record<string, unknown>;

export interface IndiaNativeFiscalCreditNoteIssueInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly actorId: string;
  readonly originalDocumentId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface IndiaNativeFiscalCreditNoteReadInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly actorId: string;
  readonly creditDocumentId: string;
}

export interface IndiaNativeFiscalCreditNoteDiscoveryInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly actorId: string;
  readonly originalDocumentId: string;
}

export interface IndiaNativeFiscalCreditNoteReceipt {
  readonly documentId: string;
  readonly documentKind: "credit_note";
  readonly originalDocumentId: string;
  readonly originalDocNo: string;
  readonly originalSha256: string;
  readonly correctionJournalId: string;
  readonly seriesId: string;
  readonly docNo: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly supplierRegistrationId: string;
  readonly recipientRegistrationId: string;
  readonly financialYearStart: string;
  readonly currency: "INR";
  readonly status: "issued";
  readonly businessDate: string;
  readonly issuedAt: string;
  readonly prevHash: string | null;
  readonly sha256: string;
  readonly sourceEvidenceHash: string;
  readonly totalMinor: string;
  readonly reason: string;
}

export interface IndiaNativeFiscalCreditNoteIssueResult {
  readonly receipt: Readonly<IndiaNativeFiscalCreditNoteReceipt>;
  /** Exact immutable bytes persisted by PostgreSQL and returned on every replay. */
  readonly receiptJson: string;
  /** Transport metadata only; never part of the immutable receipt JSON. */
  readonly replayed: boolean;
}

export interface IndiaNativeFiscalCreditNoteReadResult {
  readonly receipt: Readonly<IndiaNativeFiscalCreditNoteReceipt>;
  readonly receiptJson: string;
}

export interface IndiaNativeFiscalCreditNoteDocumentReadResult {
  readonly kind: "india_native_credit_note_v1";
  readonly receipt: Readonly<IndiaNativeFiscalCreditNoteReceipt>;
  /** Exact immutable content::text bytes; never the projected provider wire. */
  readonly contentJson: string;
}

export class IndiaNativeFiscalCreditNoteValidationError extends Error {
  constructor(message = "India native fiscal credit-note input is invalid") {
    super(message);
    this.name = "IndiaNativeFiscalCreditNoteValidationError";
  }
}

export class IndiaNativeFiscalCreditNoteNotFoundError extends Error {
  constructor(message = "India native fiscal credit-note source was not found") {
    super(message);
    this.name = "IndiaNativeFiscalCreditNoteNotFoundError";
  }
}

export class IndiaNativeFiscalCreditNoteAuthorizationError extends Error {
  constructor(message = "India native fiscal credit-note authority is unavailable") {
    super(message);
    this.name = "IndiaNativeFiscalCreditNoteAuthorizationError";
  }
}

export class IndiaNativeFiscalCreditNoteConflictError extends Error {
  constructor(message = "India native fiscal credit note could not be completed") {
    super(message);
    this.name = "IndiaNativeFiscalCreditNoteConflictError";
  }
}

export class IndiaNativeFiscalCreditNoteDatabaseError extends Error {
  constructor(message = "India native fiscal credit-note storage is unavailable") {
    super(message);
    this.name = "IndiaNativeFiscalCreditNoteDatabaseError";
  }
}

function record(value: unknown, expected: readonly string[]): PlainRecord | null {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value) || Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const names = Reflect.ownKeys(value);
    if (names.length !== expected.length || names.some((name) => typeof name !== "string") ||
        expected.some((name) => !names.includes(name))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result: PlainRecord = Object.create(null) as PlainRecord;
    for (const name of expected) {
      const descriptor = descriptors[name];
      if (!descriptor || !("value" in descriptor) || descriptor.get !== undefined ||
          descriptor.set !== undefined || descriptor.enumerable !== true) return null;
      result[name] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && SHA256.test(value);
}

function wellFormedUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

function reason(value: unknown): value is string {
  if (typeof value !== "string" || !wellFormedUtf16(value) ||
      /[\u0000-\u001f\u007f]/.test(value) || value.trim().length === 0) return false;
  const codePoints = Array.from(value).length;
  return codePoints >= 1 && codePoints <= 500;
}

function canonicalDate(value: unknown, aprilFirst = false): value is string {
  if (typeof value !== "string" || !DATE.test(value) || value.startsWith("0000") ||
      (aprilFirst && value.slice(5) !== "04-01")) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function positiveMinor(value: unknown): value is string {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return false;
  try {
    return BigInt(value) <= MAX_INT64;
  } catch {
    return false;
  }
}

export function snapshotIndiaNativeFiscalCreditNoteIssueInput(
  value: unknown,
): Readonly<IndiaNativeFiscalCreditNoteIssueInput> | null {
  const input = record(value, ISSUE_KEYS);
  if (!input || !uuid(input.tenantId) || !uuid(input.propertyNode) || !uuid(input.actorId) ||
      !uuid(input.originalDocumentId) || !reason(input.reason) ||
      typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) return null;
  const envelope = record(input.envelope, ENVELOPE_KEYS);
  if (!envelope || !uuid(envelope.actorId) || !uuid(envelope.tenantId) || !uuid(envelope.propertyNode) ||
      !uuid(envelope.requestId) || envelope.operation !== OPERATION || envelope.actorId !== input.actorId ||
      envelope.tenantId !== input.tenantId || envelope.propertyNode !== input.propertyNode) return null;
  return Object.freeze({
    tenantId: input.tenantId,
    propertyNode: input.propertyNode,
    actorId: input.actorId,
    originalDocumentId: input.originalDocumentId,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    envelope: Object.freeze({
      actorId: envelope.actorId,
      tenantId: envelope.tenantId,
      propertyNode: envelope.propertyNode,
      requestId: envelope.requestId,
      operation: OPERATION,
    }),
  });
}

export function snapshotIndiaNativeFiscalCreditNoteReadInput(
  value: unknown,
): Readonly<IndiaNativeFiscalCreditNoteReadInput> | null {
  const input = record(value, READ_KEYS);
  if (!input || !uuid(input.tenantId) || !uuid(input.propertyNode) || !uuid(input.actorId) ||
      !uuid(input.creditDocumentId)) return null;
  return Object.freeze({
    tenantId: input.tenantId,
    propertyNode: input.propertyNode,
    actorId: input.actorId,
    creditDocumentId: input.creditDocumentId,
  });
}

export function snapshotIndiaNativeFiscalCreditNoteDiscoveryInput(
  value: unknown,
): Readonly<IndiaNativeFiscalCreditNoteDiscoveryInput> | null {
  const input = record(value, DISCOVERY_KEYS);
  if (!input || !uuid(input.tenantId) || !uuid(input.propertyNode) || !uuid(input.actorId) ||
      !uuid(input.originalDocumentId)) return null;
  return Object.freeze({
    tenantId: input.tenantId,
    propertyNode: input.propertyNode,
    actorId: input.actorId,
    originalDocumentId: input.originalDocumentId,
  });
}

function snapshotReceipt(receiptJson: unknown): Readonly<IndiaNativeFiscalCreditNoteReceipt> | null {
  if (typeof receiptJson !== "string" || receiptJson.length < 2 || receiptJson.length > MAX_RECEIPT_BYTES ||
      !wellFormedUtf16(receiptJson)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(receiptJson);
  } catch {
    return null;
  }
  const row = record(parsed, RECEIPT_KEYS);
  if (!row || !uuid(row.documentId) || row.documentKind !== "credit_note" ||
      !uuid(row.originalDocumentId) || row.documentId === row.originalDocumentId ||
      typeof row.originalDocNo !== "string" || !DOCUMENT_NUMBER.test(row.originalDocNo) ||
      !sha256(row.originalSha256) || !uuid(row.correctionJournalId) || !uuid(row.seriesId) ||
      typeof row.docNo !== "string" || !DOCUMENT_NUMBER.test(row.docNo) || !uuid(row.propertyNode) ||
      !uuid(row.reservationId) || !uuid(row.folioId) || !uuid(row.supplierRegistrationId) ||
      !uuid(row.recipientRegistrationId) || row.supplierRegistrationId === row.recipientRegistrationId ||
      !canonicalDate(row.financialYearStart, true) || row.currency !== "INR" || row.status !== "issued" ||
      !canonicalDate(row.businessDate) || !canonicalTimestamp(row.issuedAt) ||
      (row.prevHash !== null && !sha256(row.prevHash)) || !sha256(row.sha256) ||
      !sha256(row.sourceEvidenceHash) || !positiveMinor(row.totalMinor) || !reason(row.reason)) return null;
  return Object.freeze({
    documentId: row.documentId,
    documentKind: "credit_note",
    originalDocumentId: row.originalDocumentId,
    originalDocNo: row.originalDocNo,
    originalSha256: row.originalSha256,
    correctionJournalId: row.correctionJournalId,
    seriesId: row.seriesId,
    docNo: row.docNo,
    propertyNode: row.propertyNode,
    reservationId: row.reservationId,
    folioId: row.folioId,
    supplierRegistrationId: row.supplierRegistrationId,
    recipientRegistrationId: row.recipientRegistrationId,
    financialYearStart: row.financialYearStart,
    currency: "INR",
    status: "issued",
    businessDate: row.businessDate,
    issuedAt: row.issuedAt,
    prevHash: row.prevHash,
    sha256: row.sha256,
    sourceEvidenceHash: row.sourceEvidenceHash,
    totalMinor: row.totalMinor,
    reason: row.reason,
  });
}

function returnedRow(value: unknown, expected: readonly string[]): PlainRecord | null {
  return record(value, expected);
}

function onlyRow(rows: unknown): unknown | null {
  if (typeof rows !== "object" || rows === null || utilTypes.isProxy(rows) || !Array.isArray(rows)) return null;
  try {
    // Bun's SQLResultArray attaches driver metadata to the array itself. Validate
    // a single own data row separately; never serialize or invoke that metadata.
    const keys = Reflect.ownKeys(rows);
    const allowedKeys = new Set(["0", "length", "count", "command", "lastInsertRowid", "affectedRows"]);
    if (keys.some(key => typeof key !== "string" || !allowedKeys.has(key) ||
        !("value" in Object.getOwnPropertyDescriptor(rows, key)!))) return null;
    const length = Object.getOwnPropertyDescriptor(rows, "length");
    const first = Object.getOwnPropertyDescriptor(rows, "0");
    if (!length || !("value" in length) || length.value !== 1 || !first || !("value" in first) ||
        first.enumerable !== true) return null;
    return first.value;
  } catch {
    return null;
  }
}

function sqlState(error: unknown): string | null {
  if (typeof error !== "object" || error === null || utilTypes.isProxy(error)) return null;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(error);
    for (const name of ["errno", "sqlState", "code"] as const) {
      const descriptor = descriptors[name];
      if (descriptor && "value" in descriptor && typeof descriptor.value === "string") return descriptor.value;
    }
  } catch {
    return null;
  }
  return null;
}

function mapDatabaseError(error: unknown): never {
  if (typeof error === "object" && error !== null && utilTypes.isProxy(error)) {
    throw new IndiaNativeFiscalCreditNoteDatabaseError();
  }
  if (error instanceof IndiaNativeFiscalCreditNoteValidationError ||
      error instanceof IndiaNativeFiscalCreditNoteNotFoundError ||
      error instanceof IndiaNativeFiscalCreditNoteAuthorizationError ||
      error instanceof IndiaNativeFiscalCreditNoteConflictError ||
      error instanceof IndiaNativeFiscalCreditNoteDatabaseError) throw error;
  switch (sqlState(error)) {
    case "42501":
      throw new IndiaNativeFiscalCreditNoteAuthorizationError();
    case "P0002":
    case "02000":
    case "23503":
      throw new IndiaNativeFiscalCreditNoteNotFoundError();
    case "22021":
    case "22023":
    case "22003":
    case "23514":
      throw new IndiaNativeFiscalCreditNoteValidationError();
    case "23505":
    case "40001":
    case "40P01":
    case "55000":
    case "P0011":
      throw new IndiaNativeFiscalCreditNoteConflictError();
    default:
      throw new IndiaNativeFiscalCreditNoteDatabaseError();
  }
}

export class IndiaNativeFiscalCreditNoteService {
  async readDocument(tx: Tx, value: unknown): Promise<Readonly<IndiaNativeFiscalCreditNoteDocumentReadResult> | null> {
    const input = snapshotIndiaNativeFiscalCreditNoteReadInput(value);
    if (!input || typeof tx !== "function") throw new IndiaNativeFiscalCreditNoteValidationError();
    try {
      // Materialization preserves the current-authority call even on absence.
      // Only its non-null receipt admits the correlated immutable document read.
      const rows: unknown = await tx<Array<Record<string, unknown>>>`
        WITH input AS (
          SELECT ${input.tenantId}::uuid AS tenant_id, ${input.propertyNode}::uuid AS property_node,
            ${input.actorId}::uuid AS actor_id, ${input.creditDocumentId}::uuid AS document_id
        ), authority AS MATERIALIZED (
          SELECT input.*, public.read_india_native_fiscal_credit_note(
            input.tenant_id, input.property_node, input.actor_id, input.document_id
          ) AS receipt_json FROM input
        )
        SELECT authority.receipt_json, issued.tenant_id, issued.property_node, issued.document_id,
          issued.content_json, issued.sha256
        FROM authority LEFT JOIN LATERAL (
          SELECT document.tenant_id, document.property_node, document.id AS document_id,
            document.content::text AS content_json, document.sha256
          FROM public.document AS document
          WHERE authority.receipt_json IS NOT NULL AND document.tenant_id = authority.tenant_id
            AND document.property_node = authority.property_node AND document.id = authority.document_id
            AND document.kind = 'credit_note' AND document.status = 'issued'
        ) AS issued ON true
      `;
      const contentKeys = ["tenant_id", "property_node", "document_id", "content_json", "sha256"] as const;
      const row = returnedRow(onlyRow(rows), ["receipt_json", ...contentKeys]);
      if (!row) throw new IndiaNativeFiscalCreditNoteDatabaseError();
      if (row.receipt_json === null) {
        if (contentKeys.some(key => row[key] !== null)) throw new IndiaNativeFiscalCreditNoteDatabaseError();
        return null;
      }
      const receipt = snapshotReceipt(row.receipt_json);
      if (!receipt || receipt.documentId !== input.creditDocumentId || receipt.propertyNode !== input.propertyNode ||
          row.tenant_id !== input.tenantId || row.property_node !== input.propertyNode ||
          row.document_id !== input.creditDocumentId || row.sha256 !== receipt.sha256 ||
          typeof row.content_json !== "string") throw new IndiaNativeFiscalCreditNoteDatabaseError();
      const validated = projectIssuedIndiaIrpWireCandidate({
        documentId: receipt.documentId, documentSha256: receipt.sha256, contentJson: row.content_json,
      });
      if (!validated.ok) throw new IndiaNativeFiscalCreditNoteDatabaseError();
      // The shared validator has already checked duplicate names, complete source
      // shape, decimal strings, dates and bigint item/tax totals. Parse the original
      // source (not numeric provider wire) solely to bind it to the trusted receipt.
      const source = JSON.parse(row.content_json) as {
        DocDtls: { Typ: string; No: string; Dt: string };
        YellowCredit?: Record<string, string>;
        RefDtls?: { PrecDocDtls: Array<{ InvNo: string }> };
        ValDtls: { TotInvVal: string };
      };
      const creditFields = ["originalDocumentId", "originalSha256", "reason", "correctionJournalId", "sourceEvidenceHash"] as const;
      if (source.DocDtls.Typ !== "CRN" || source.DocDtls.No !== receipt.docNo ||
          source.DocDtls.Dt !== receipt.businessDate.split("-").reverse().join("/") ||
          creditFields.some(key => source.YellowCredit?.[key] !== receipt[key]) ||
          source.RefDtls?.PrecDocDtls[0]?.InvNo !== receipt.originalDocNo ||
          BigInt(source.ValDtls.TotInvVal.replace(".", "")) !== BigInt(receipt.totalMinor)) {
        throw new IndiaNativeFiscalCreditNoteDatabaseError();
      }
      return Object.freeze({ kind: "india_native_credit_note_v1", receipt, contentJson: row.content_json });
    } catch (error) {
      if (sqlState(error) === "42501") throw new IndiaNativeFiscalCreditNoteAuthorizationError();
      throw new IndiaNativeFiscalCreditNoteDatabaseError();
    }
  }

  async discover(tx: Tx, value: unknown): Promise<Readonly<IndiaNativeFiscalCreditNoteReadResult> | null> {
    const input = snapshotIndiaNativeFiscalCreditNoteDiscoveryInput(value);
    if (!input || typeof tx !== "function") throw new IndiaNativeFiscalCreditNoteValidationError();
    try {
      // The scalar lookup deliberately returns NULL on absence and errors on any
      // duplicate binding. The non-strict VOLATILE read capability still runs on
      // that NULL, independently checking current actor/property read authority.
      const rows: unknown = await tx<Array<{ receipt_json: string | null }>>`
        WITH input AS (
          SELECT ${input.tenantId}::uuid AS tenant_id, ${input.propertyNode}::uuid AS property_node,
            ${input.actorId}::uuid AS actor_id, ${input.originalDocumentId}::uuid AS original_document_id
        )
        SELECT public.read_india_native_fiscal_credit_note(
          input.tenant_id, input.property_node, input.actor_id,
          (SELECT credit.document_id FROM public.india_native_fiscal_credit_note AS credit
            WHERE credit.tenant_id = input.tenant_id AND credit.property_node = input.property_node
              AND credit.original_document_id = input.original_document_id)
        ) AS receipt_json FROM input
      `;
      const row = returnedRow(onlyRow(rows), ["receipt_json"]);
      if (!row) throw new IndiaNativeFiscalCreditNoteDatabaseError();
      if (row.receipt_json === null) return null;
      const receipt = snapshotReceipt(row.receipt_json);
      if (!receipt || receipt.originalDocumentId !== input.originalDocumentId || receipt.propertyNode !== input.propertyNode) {
        throw new IndiaNativeFiscalCreditNoteDatabaseError();
      }
      return Object.freeze({ receipt, receiptJson: row.receipt_json as string });
    } catch (error) {
      // Discovery has no issue/conflict/validation SQL outcomes: absence is NULL,
      // authority is 42501, and every other storage failure must fail closed.
      if (sqlState(error) === "42501") throw new IndiaNativeFiscalCreditNoteAuthorizationError();
      throw new IndiaNativeFiscalCreditNoteDatabaseError();
    }
  }

  async issue(tx: Tx, value: unknown): Promise<Readonly<IndiaNativeFiscalCreditNoteIssueResult>> {
    const input = snapshotIndiaNativeFiscalCreditNoteIssueInput(value);
    if (!input || typeof tx !== "function") throw new IndiaNativeFiscalCreditNoteValidationError();
    try {
      const rows: unknown = await tx<Array<{ receipt_json: string; replayed: boolean }>>`
        SELECT result.receipt_json, result.replayed
        FROM public.commit_india_native_fiscal_credit_note(
          ${input.tenantId}::uuid, ${input.propertyNode}::uuid, ${input.actorId}::uuid,
          ${input.originalDocumentId}::uuid, ${input.reason}, ${input.idempotencyKey},
          ${input.envelope.requestId}::uuid
        ) AS result
      `;
      const row = returnedRow(onlyRow(rows), ["receipt_json", "replayed"]);
      const receipt = row ? snapshotReceipt(row.receipt_json) : null;
      if (!row || typeof row.replayed !== "boolean" || !receipt ||
          receipt.originalDocumentId !== input.originalDocumentId || receipt.propertyNode !== input.propertyNode ||
          receipt.reason !== input.reason) throw new IndiaNativeFiscalCreditNoteDatabaseError();
      return Object.freeze({ receipt, receiptJson: row.receipt_json as string, replayed: row.replayed });
    } catch (error) {
      return mapDatabaseError(error);
    }
  }

  async read(tx: Tx, value: unknown): Promise<Readonly<IndiaNativeFiscalCreditNoteReadResult> | null> {
    const input = snapshotIndiaNativeFiscalCreditNoteReadInput(value);
    if (!input || typeof tx !== "function") throw new IndiaNativeFiscalCreditNoteValidationError();
    try {
      const rows: unknown = await tx<Array<{ receipt_json: string | null }>>`
        SELECT public.read_india_native_fiscal_credit_note(
          ${input.tenantId}::uuid, ${input.propertyNode}::uuid, ${input.actorId}::uuid,
          ${input.creditDocumentId}::uuid
        ) AS receipt_json
      `;
      const row = returnedRow(onlyRow(rows), ["receipt_json"]);
      if (!row) throw new IndiaNativeFiscalCreditNoteDatabaseError();
      if (row.receipt_json === null) return null;
      const receipt = snapshotReceipt(row.receipt_json);
      if (!receipt || receipt.documentId !== input.creditDocumentId || receipt.propertyNode !== input.propertyNode) {
        throw new IndiaNativeFiscalCreditNoteDatabaseError();
      }
      return Object.freeze({ receipt, receiptJson: row.receipt_json as string });
    } catch (error) {
      return mapDatabaseError(error);
    }
  }
}
