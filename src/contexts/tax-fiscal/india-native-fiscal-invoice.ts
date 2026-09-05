import { types as utilTypes } from "node:util";

import {
  IndiaFinalComponentTaxFiscalSourceService,
  IndiaNativeFiscalAccountingEventHandler,
  type IndiaFinalComponentTaxNativeFiscalSourceResult,
  type IndiaNativeFiscalAccountingEventInput,
  type IndiaNativeFiscalAccountingEventResult,
} from "../financials";
import {
  type AuditEnvelope,
  type JsonValue,
  type Tx,
} from "../../kernel";
import {
  IndiaIrpAccommodationFiscalActionReadinessService,
  type IndiaIrpAccommodationFiscalActionReadinessInput,
  type IndiaIrpAccommodationFiscalActionReadinessResult,
} from "./india-irp-accommodation-fiscal-action-readiness";
import {
  IndiaIrpAccommodationSourceService,
  type IndiaIrpAccommodationSourceResult,
} from "./india-irp-accommodation-source";
import {
  assembleIndiaNativeFiscalSource,
  type IndiaNativeFiscalSourceInput,
  type IndiaNativeFiscalSourceResult,
} from "./india-native-fiscal-source";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PREFIX = /^[A-Za-z0-9/-]+$/;
const AUTHORITY = /^[A-Z][A-Z0-9_.:-]{2,127}$/;
const OPERATION = "document.issued";
const SERIES_OPERATION = "document.series.configured";
const BLOCKED_STATE = "blocked_pending_fiscal_document_origin_policy";
const BLOCKERS = [
  "FISCAL_DOCUMENT_ORIGIN_UNSELECTED",
  "LEGAL_DOCUMENT_NUMBER_FORMAT_UNCONFIGURED",
  "DOCUMENT_SERIES_UNBOUND",
] as const;

type PlainRecord = Record<string, unknown>;
type InvoiceKind = "invoice";
type SeriesKind = "invoice" | "credit_note" | "debit_note";

export interface IndiaNativeFiscalSeriesConfigurationInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly supplierRegistrationId: string;
  readonly documentKind: SeriesKind;
  readonly prefix: string;
  readonly envelope: AuditEnvelope;
}

export interface IndiaNativeFiscalSeriesConfigurationResult {
  readonly seriesId: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly supplierRegistrationId: string;
  readonly documentKind: SeriesKind;
  readonly prefix: string;
  readonly financialYearStart: string;
  readonly nextNo: string;
  readonly replayed: boolean;
}

export interface IndiaNativeFiscalInvoiceIssueInput extends IndiaIrpAccommodationFiscalActionReadinessInput {
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface IndiaNativeFiscalInvoiceCalendarEvidence {
  readonly authorityId: string;
  readonly sourceDigestSha256: string;
  readonly throughDate: string;
  readonly days: readonly Readonly<{
    readonly date: string;
    readonly state: "working" | "non_working";
  }>[];
}

export interface IndiaNativeFiscalInvoiceIssueNativeInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly actorId: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly valuationId: string;
  readonly serviceProvisionSnapshotId: string;
  readonly paymentReceiptSnapshotId: string;
  readonly ordinaryRegimeEvidenceId: string;
  readonly supplierServiceLocationId: string;
  readonly supplierRegistrationStatusId: string;
  readonly supplierSezStatusId: string;
  readonly recipientRegistrationId: string;
  readonly recipientSezStatusId: string;
  readonly classificationId: string;
  readonly calendarEvidence: IndiaNativeFiscalInvoiceCalendarEvidence | null;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export type IndiaNativeFiscalPreparedSourceInput = Omit<IndiaNativeFiscalSourceInput, "financialSource">;

export interface IndiaNativeFiscalAccountingHandlerPort {
  handle(tx: Tx, input: IndiaNativeFiscalAccountingEventInput): Promise<IndiaNativeFiscalAccountingEventResult>;
}

export interface IndiaNativeFiscalSourceReaderPort {
  resolveNative(
    tx: Tx,
    input: Readonly<{
      tenantId: string;
      propertyNode: string;
      reservationId: string;
      folioId: string;
      postingBindingId: string;
    }>,
  ): Promise<IndiaFinalComponentTaxNativeFiscalSourceResult>;
}

export type IndiaNativeFiscalInvoiceReceipt = Readonly<Record<string, JsonValue>> & {
  readonly documentId: string;
  readonly documentKind: InvoiceKind;
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
  readonly preDocumentEvidenceHash: string;
  readonly readinessEvidenceHash: string;
  readonly replayed: boolean;
}

interface CommitRow {
  readonly document_id: string;
  readonly document_kind: string;
  readonly series_id: string;
  readonly doc_no: string;
  readonly property_node: string;
  readonly reservation_id: string;
  readonly folio_id: string;
  readonly supplier_registration_id: string;
  readonly recipient_registration_id: string;
  readonly financial_year_start: string;
  readonly currency: string;
  readonly status: string;
  readonly business_date: string;
  readonly issued_at: Date | string;
  readonly prev_hash: string | null;
  readonly sha256: string;
  readonly source_evidence_hash: string;
  readonly pre_document_evidence_hash: string;
  readonly readiness_evidence_hash: string;
  readonly created: boolean;
}

interface SeriesRow {
  readonly series_id: string;
  readonly tenant_id: string;
  readonly property_node: string;
  readonly supplier_registration_id: string;
  readonly document_kind: string;
  readonly prefix: string;
  readonly financial_year_start: string;
  readonly next_no: string | number | bigint;
  /** Returned atomically by create_india_native_fiscal_series: true only for a new row. */
  readonly created: boolean;
}

interface NativePrepareRow {
  readonly native_timing_id: unknown;
  readonly request_event_id: unknown;
  readonly posting_binding_id: unknown;
  readonly prepared_source_json: unknown;
  readonly completed_receipt: unknown;
}

const NATIVE_INPUT_KEYS = [
  "tenantId", "propertyNode", "actorId", "reservationId", "folioId", "valuationId",
  "serviceProvisionSnapshotId", "paymentReceiptSnapshotId", "ordinaryRegimeEvidenceId",
  "supplierServiceLocationId", "supplierRegistrationStatusId", "supplierSezStatusId",
  "recipientRegistrationId", "recipientSezStatusId", "classificationId", "calendarEvidence",
  "idempotencyKey", "envelope",
] as const;
const CALENDAR_KEYS = ["authorityId", "sourceDigestSha256", "throughDate", "days"] as const;
const CALENDAR_DAY_KEYS = ["date", "state"] as const;
const PREPARE_ROW_KEYS = [
  "native_timing_id", "request_event_id", "posting_binding_id", "prepared_source_json",
  "completed_receipt",
] as const;
const PREPARED_SOURCE_KEYS = [
  "tenantId", "legalBuyerPartyId", "sellerRegistration", "recipientRegistration",
  "placeOfSupply", "classification", "supplyNatureAtTimeOfSupplyInput",
  "supplyNatureAtTimeOfSupplyResult",
] as const;
const COMMIT_ROW_KEYS = [
  "document_id", "document_kind", "series_id", "doc_no", "property_node", "reservation_id",
  "folio_id", "supplier_registration_id", "recipient_registration_id", "financial_year_start",
  "currency", "status", "business_date", "issued_at", "prev_hash", "sha256",
  "source_evidence_hash", "pre_document_evidence_hash", "readiness_evidence_hash", "created",
] as const;

export class IndiaNativeFiscalInvoiceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaNativeFiscalInvoiceValidationError";
  }
}
export class IndiaNativeFiscalInvoiceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaNativeFiscalInvoiceNotFoundError";
  }
}
export class IndiaNativeFiscalInvoiceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaNativeFiscalInvoiceConflictError";
  }
}
export class IndiaNativeFiscalInvoiceAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaNativeFiscalInvoiceAuthorizationError";
  }
}

export class IndiaNativeFiscalSeriesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaNativeFiscalSeriesValidationError";
  }
}
export class IndiaNativeFiscalSeriesNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaNativeFiscalSeriesNotFoundError";
  }
}
export class IndiaNativeFiscalSeriesConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaNativeFiscalSeriesConflictError";
  }
}
export class IndiaNativeFiscalSeriesAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaNativeFiscalSeriesAuthorizationError";
  }
}

function plain(value: unknown, subject: string): asserts value is PlainRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null) || Object.getOwnPropertySymbols(value).length !== 0) {
    throw new IndiaNativeFiscalInvoiceValidationError(`${subject} must be a plain object`);
  }
}

function exact(value: PlainRecord, allowed: readonly string[], subject: string): void {
  const names = Object.getOwnPropertyNames(value);
  const extras = names.filter((name) => !allowed.includes(name));
  if (extras.length > 0) throw new IndiaNativeFiscalInvoiceValidationError(
    `${subject} contains unsupported fields: ${extras.sort().join(", ")}`,
  );
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaNativeFiscalInvoiceValidationError(`${subject} must be a lowercase UUID`);
  }
  return value;
}

function hash(value: unknown, subject: string): string {
  if (typeof value !== "string" || !HASH.test(value)) {
    throw new IndiaNativeFiscalInvoiceConflictError(`${subject} must be a lowercase SHA-256 hash`);
  }
  return value;
}

function storedUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaNativeFiscalInvoiceConflictError(`PostgreSQL returned an invalid ${subject}`);
  }
  return value;
}

function visibleKey(value: unknown, subject: string): string {
  if (typeof value !== "string" || !KEY.test(value)) {
    throw new IndiaNativeFiscalInvoiceValidationError(`${subject} must contain 8 to 200 visible ASCII characters`);
  }
  return value;
}

function postgresArray(values: readonly (string | number | bigint | boolean | null)[]): string {
  return `{${values.map((value) => value === null
    ? "NULL"
    : `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`).join(",")}}`;
}

function date(value: unknown, subject: string): string {
  if (typeof value !== "string" || !DATE.test(value)) {
    throw new IndiaNativeFiscalInvoiceValidationError(`${subject} must be YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new IndiaNativeFiscalInvoiceValidationError(`${subject} is not a calendar date`);
  }
  return value;
}

function auditEnvelope(value: unknown, tenantId: string, propertyNode: string, operation: string): AuditEnvelope {
  plain(value, "envelope");
  const envelope = value as Partial<AuditEnvelope>;
  const actorId = uuid(envelope.actorId, "envelope.actorId");
  const envelopeTenantId = uuid(envelope.tenantId, "envelope.tenantId");
  const envelopePropertyNode = uuid(envelope.propertyNode, "envelope.propertyNode");
  const requestId = uuid(envelope.requestId, "envelope.requestId");
  if (envelopeTenantId !== tenantId || envelopePropertyNode !== propertyNode || envelope.operation !== operation) {
    throw new IndiaNativeFiscalInvoiceValidationError("audit envelope is not bound to the command");
  }
  return Object.freeze({ actorId, tenantId: envelopeTenantId, propertyNode: envelopePropertyNode, requestId, operation });
}

function normalizeSeries(input: IndiaNativeFiscalSeriesConfigurationInput): IndiaNativeFiscalSeriesConfigurationInput {
  plain(input, "series configuration input");
  exact(input, ["tenantId", "propertyNode", "supplierRegistrationId", "documentKind", "prefix", "envelope"], "series configuration input");
  const tenantId = uuid(input.tenantId, "tenantId");
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  const supplierRegistrationId = uuid(input.supplierRegistrationId, "supplierRegistrationId");
  if (input.documentKind !== "invoice" && input.documentKind !== "credit_note" && input.documentKind !== "debit_note") {
    throw new IndiaNativeFiscalSeriesValidationError("documentKind is not a supported fiscal series kind");
  }
  if (typeof input.prefix !== "string" || input.prefix.trim() !== input.prefix ||
      input.prefix.length < 1 || input.prefix.length > 12 || !PREFIX.test(input.prefix)) {
    throw new IndiaNativeFiscalSeriesValidationError("prefix must be 1 to 12 ASCII letters, digits, slash or hyphen");
  }
  const envelope = auditEnvelope(input.envelope, tenantId, propertyNode, SERIES_OPERATION);
  return Object.freeze({ ...input, tenantId, propertyNode, supplierRegistrationId, envelope });
}

function normalizeInvoice(input: IndiaNativeFiscalInvoiceIssueInput): IndiaNativeFiscalInvoiceIssueInput {
  plain(input, "native invoice input");
  exact(input, [
    "tenantId", "propertyNode", "reservationId", "folioId", "journalId", "recipientPartyId",
    "recipientRegistrationId", "classificationId", "supplyNatureAtTimeOfSupplyInput",
    "supplyNatureAtTimeOfSupplyResult", "actorId", "idempotencyKey", "envelope",
  ], "native invoice input");
  const tenantId = uuid(input.tenantId, "tenantId");
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  const actorId = uuid(input.actorId, "actorId");
  const envelope = auditEnvelope(input.envelope, tenantId, propertyNode, OPERATION);
  if (envelope.actorId !== actorId) throw new IndiaNativeFiscalInvoiceValidationError("actorId must match envelope.actorId");
  const idempotencyKey = visibleKey(input.idempotencyKey, "idempotencyKey");
  return Object.freeze({ ...input, tenantId, propertyNode, actorId, idempotencyKey, envelope });
}

function normalizeNativeCalendar(value: unknown): IndiaNativeFiscalInvoiceCalendarEvidence | null {
  if (value === null) return null;
  plain(value, "calendarEvidence");
  exact(value, CALENDAR_KEYS, "calendarEvidence");
  if (typeof value.authorityId !== "string" || !AUTHORITY.test(value.authorityId)) {
    throw new IndiaNativeFiscalInvoiceValidationError("calendarEvidence.authorityId is invalid");
  }
  if (typeof value.sourceDigestSha256 !== "string" || !HASH.test(value.sourceDigestSha256)) {
    throw new IndiaNativeFiscalInvoiceValidationError("calendarEvidence.sourceDigestSha256 is invalid");
  }
  const throughDate = date(value.throughDate, "calendarEvidence.throughDate");
  if (!Array.isArray(value.days) || value.days.length < 4 || value.days.length > 366) {
    throw new IndiaNativeFiscalInvoiceValidationError("calendarEvidence.days must contain 4 to 366 dates");
  }
  const calendarDays = value.days;
  const days = calendarDays.map((raw, index) => {
    plain(raw, `calendarEvidence.days[${index}]`);
    exact(raw, CALENDAR_DAY_KEYS, `calendarEvidence.days[${index}]`);
    const day = date(raw.date, `calendarEvidence.days[${index}].date`);
    if (raw.state !== "working" && raw.state !== "non_working") {
      throw new IndiaNativeFiscalInvoiceValidationError(`calendarEvidence.days[${index}].state is invalid`);
    }
    if (index > 0) {
      const prior = (calendarDays[index - 1] as PlainRecord).date;
      const expected = new Date(`${String(prior)}T00:00:00Z`);
      expected.setUTCDate(expected.getUTCDate() + 1);
      if (expected.toISOString().slice(0, 10) !== day) {
        throw new IndiaNativeFiscalInvoiceValidationError("calendarEvidence.days must be dense and ordered");
      }
    }
    return Object.freeze({ date: day, state: raw.state });
  });
  if (days.at(-1)?.date !== throughDate) {
    throw new IndiaNativeFiscalInvoiceValidationError("calendarEvidence.throughDate must equal the last governed day");
  }
  return Object.freeze({
    authorityId: value.authorityId,
    sourceDigestSha256: value.sourceDigestSha256,
    throughDate,
    days: Object.freeze(days),
  });
}

function normalizeNativeInvoice(
  input: IndiaNativeFiscalInvoiceIssueNativeInput,
): IndiaNativeFiscalInvoiceIssueNativeInput {
  plain(input, "native current-transaction invoice input");
  exact(input, NATIVE_INPUT_KEYS, "native current-transaction invoice input");
  const tenantId = uuid(input.tenantId, "tenantId");
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  const actorId = uuid(input.actorId, "actorId");
  plain(input.envelope, "envelope");
  exact(input.envelope, ["actorId", "tenantId", "propertyNode", "requestId", "operation"], "envelope");
  const envelope = auditEnvelope(input.envelope, tenantId, propertyNode, OPERATION);
  if (envelope.actorId !== actorId) {
    throw new IndiaNativeFiscalInvoiceValidationError("actorId must match envelope.actorId");
  }
  const identities = {
    reservationId: uuid(input.reservationId, "reservationId"),
    folioId: uuid(input.folioId, "folioId"),
    valuationId: uuid(input.valuationId, "valuationId"),
    serviceProvisionSnapshotId: uuid(input.serviceProvisionSnapshotId, "serviceProvisionSnapshotId"),
    paymentReceiptSnapshotId: uuid(input.paymentReceiptSnapshotId, "paymentReceiptSnapshotId"),
    ordinaryRegimeEvidenceId: uuid(input.ordinaryRegimeEvidenceId, "ordinaryRegimeEvidenceId"),
    supplierServiceLocationId: uuid(input.supplierServiceLocationId, "supplierServiceLocationId"),
    supplierRegistrationStatusId: uuid(input.supplierRegistrationStatusId, "supplierRegistrationStatusId"),
    supplierSezStatusId: uuid(input.supplierSezStatusId, "supplierSezStatusId"),
    recipientRegistrationId: uuid(input.recipientRegistrationId, "recipientRegistrationId"),
    recipientSezStatusId: uuid(input.recipientSezStatusId, "recipientSezStatusId"),
    classificationId: uuid(input.classificationId, "classificationId"),
  };
  return Object.freeze({
    tenantId,
    propertyNode,
    actorId,
    ...identities,
    calendarEvidence: normalizeNativeCalendar(input.calendarEvidence),
    idempotencyKey: visibleKey(input.idempotencyKey, "idempotencyKey"),
    envelope,
  });
}

function recursivelyFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value as Record<string, unknown>)) recursivelyFreeze(child, seen);
    Object.freeze(value);
  }
  return value;
}

function preparedSource(value: unknown): IndiaNativeFiscalPreparedSourceInput {
  if (typeof value !== "string") {
    throw new IndiaNativeFiscalInvoiceConflictError("native preparation did not return canonical source JSON");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch {
    throw new IndiaNativeFiscalInvoiceConflictError("native preparation returned malformed source JSON");
  }
  if (JSON.stringify(parsed) !== value) {
    throw new IndiaNativeFiscalInvoiceConflictError("native preparation source JSON is not canonical");
  }
  try {
    plain(parsed, "prepared native source");
    exact(parsed, PREPARED_SOURCE_KEYS, "prepared native source");
  } catch {
    throw new IndiaNativeFiscalInvoiceConflictError("native preparation source JSON shape is inconsistent");
  }
  if (JSON.stringify(Object.keys(parsed)) !== JSON.stringify(PREPARED_SOURCE_KEYS)) {
    throw new IndiaNativeFiscalInvoiceConflictError("native preparation source JSON key order is not canonical");
  }
  return recursivelyFreeze(parsed as unknown as IndiaNativeFiscalPreparedSourceInput);
}

function exactCommitRow(value: unknown, replay: boolean): CommitRow {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new IndiaNativeFiscalInvoiceConflictError("native invoice receipt is malformed");
  }
  const names = Object.keys(value).sort();
  const expected = [...COMMIT_ROW_KEYS].sort();
  if (names.length !== expected.length || names.some((name, index) => name !== expected[index]) ||
      typeof (value as PlainRecord).created !== "boolean" ||
      (replay && (value as PlainRecord).created !== false)) {
    throw new IndiaNativeFiscalInvoiceConflictError("native invoice receipt shape is inconsistent");
  }
  return value as unknown as CommitRow;
}

function asDate(value: Date | string): string {
  const result = value instanceof Date ? value.toISOString() : value;
  if (typeof result !== "string" || !result.includes("T")) {
    throw new IndiaNativeFiscalInvoiceConflictError("PostgreSQL returned an invalid issued-at timestamp");
  }
  return result;
}

function asSeriesResult(row: SeriesRow, input: IndiaNativeFiscalSeriesConfigurationInput, replayed: boolean): IndiaNativeFiscalSeriesConfigurationResult {
  if (typeof row.created !== "boolean" || !UUID.test(row.series_id) || row.tenant_id !== input.tenantId || row.property_node !== input.propertyNode ||
      row.supplier_registration_id !== input.supplierRegistrationId || row.document_kind !== input.documentKind ||
      row.prefix !== input.prefix || !DATE.test(row.financial_year_start) || row.financial_year_start.slice(5) !== "04-01") {
    throw new IndiaNativeFiscalSeriesConflictError("PostgreSQL returned an incoherent fiscal series");
  }
  const next = BigInt(row.next_no);
  if (next < 1n || next > 9223372036854775807n) throw new IndiaNativeFiscalSeriesConflictError("fiscal series counter is invalid");
  return Object.freeze({ seriesId: row.series_id, tenantId: row.tenant_id, propertyNode: row.property_node,
    supplierRegistrationId: row.supplier_registration_id, documentKind: input.documentKind, prefix: row.prefix,
    financialYearStart: row.financial_year_start, nextNo: next.toString(), replayed });
}

type ReceiptSelectors = Readonly<{
  propertyNode: string;
  reservationId: string;
  folioId: string;
}>;

function receipt(row: CommitRow, input: ReceiptSelectors, replayed: boolean): IndiaNativeFiscalInvoiceReceipt {
  if (!UUID.test(row.document_id) || row.document_kind !== "invoice" || !UUID.test(row.series_id) ||
      !row.doc_no || row.property_node !== input.propertyNode || row.reservation_id !== input.reservationId ||
      row.folio_id !== input.folioId || !UUID.test(row.supplier_registration_id) ||
      row.supplier_registration_id === row.recipient_registration_id || !UUID.test(row.recipient_registration_id) ||
      !DATE.test(row.financial_year_start) || row.financial_year_start.slice(5) !== "04-01" || row.currency !== "INR" ||
      row.status !== "issued" || !DATE.test(row.business_date) || !HASH.test(row.sha256) ||
      !HASH.test(row.source_evidence_hash) || !HASH.test(row.pre_document_evidence_hash) ||
      !HASH.test(row.readiness_evidence_hash) || (row.prev_hash !== null && !HASH.test(row.prev_hash))) {
    throw new IndiaNativeFiscalInvoiceConflictError("PostgreSQL returned an incoherent issued invoice receipt");
  }
  return Object.freeze({ documentId: row.document_id, documentKind: "invoice", seriesId: row.series_id, docNo: row.doc_no,
    propertyNode: row.property_node, reservationId: row.reservation_id, folioId: row.folio_id,
    supplierRegistrationId: row.supplier_registration_id, recipientRegistrationId: row.recipient_registration_id,
    financialYearStart: row.financial_year_start, currency: "INR", status: "issued", businessDate: row.business_date,
    issuedAt: asDate(row.issued_at), prevHash: row.prev_hash, sha256: row.sha256,
    sourceEvidenceHash: row.source_evidence_hash, preDocumentEvidenceHash: row.pre_document_evidence_hash,
    readinessEvidenceHash: row.readiness_evidence_hash, replayed });
}

function readinessInput(input: IndiaNativeFiscalInvoiceIssueInput): IndiaIrpAccommodationFiscalActionReadinessInput {
  const { actorId: _actorId, idempotencyKey: _idempotencyKey, envelope: _envelope, ...selectors } = input;
  return Object.freeze(selectors);
}

function expectedReadiness(readiness: IndiaIrpAccommodationFiscalActionReadinessResult): void {
  if (readiness.state !== BLOCKED_STATE || readiness.submissionReady !== false || readiness.permittedActions.length !== 0 ||
      JSON.stringify(readiness.blockers) !== JSON.stringify(BLOCKERS)) {
    throw new IndiaNativeFiscalInvoiceConflictError("Order429 readiness is not the exact approved blocked result");
  }
  hash(readiness.sourceEvidenceHash, "Order429 source evidence hash");
  hash(readiness.preDocumentEvidenceHash, "Order426 pre-document evidence hash");
  hash(readiness.evidenceHash, "Order429 readiness evidence hash");
  const preDocument = readiness.preDocumentEvidence;
  let sections: unknown;
  try {
    sections = JSON.parse(preDocument.sectionsJson);
  } catch {
    throw new IndiaNativeFiscalInvoiceConflictError("Order426 pre-document JSON is not canonical");
  }
  if (typeof sections !== "object" || sections === null || Array.isArray(sections) ||
      JSON.stringify(Object.keys(sections)) !== JSON.stringify(["Version", "TranDtls", "SellerDtls", "BuyerDtls", "ItemList", "ValDtls"]) ||
      JSON.stringify(sections) !== preDocument.sectionsJson ||
      JSON.stringify(sections) !== JSON.stringify(preDocument.sections)) {
    throw new IndiaNativeFiscalInvoiceConflictError("Order426 pre-document sections are not the genuine fixed composition");
  }
}

function bindNativeSource(
  input: IndiaNativeFiscalInvoiceIssueNativeInput,
  sourceInput: IndiaNativeFiscalSourceInput,
  source: IndiaNativeFiscalSourceResult,
): void {
  const financial = source.financialSource;
  const atTime = source.supplyNatureAtTimeOfSupply;
  const supplyInput = sourceInput.supplyNatureAtTimeOfSupplyInput.supplyNature;
  const timing = sourceInput.supplyNatureAtTimeOfSupplyInput
    .supplierRegistrationAtTimeOfSupply.timeOfSupply.nativeTiming;
  if (sourceInput.tenantId !== input.tenantId ||
      financial.propertyNode !== input.propertyNode || financial.reservationId !== input.reservationId ||
      financial.folioId !== input.folioId || financial.valuationId !== input.valuationId ||
      atTime.supplierServiceLocationId !== input.supplierServiceLocationId ||
      atTime.supplierGstRegistrationStatusId !== input.supplierRegistrationStatusId ||
      atTime.recipientRegistrationId !== input.recipientRegistrationId ||
      atTime.recipientSezStatusId !== input.recipientSezStatusId ||
      source.classification.classificationId !== input.classificationId ||
      supplyInput.supplier.status.id !== input.supplierSezStatusId ||
      timing.serviceProvisionSnapshotId !== input.serviceProvisionSnapshotId ||
      timing.paymentReceiptSnapshotId !== input.paymentReceiptSnapshotId ||
      timing.ordinaryRegimeEvidenceId !== input.ordinaryRegimeEvidenceId) {
    throw new IndiaNativeFiscalInvoiceConflictError(
      "prepared native fiscal source does not bind the exact issue selectors",
    );
  }
}

function hashPreimage(value: Readonly<Record<string, unknown>>, tenantId: string, field: string): string {
  const { [field]: _ignored, ...body } = value;
  return JSON.stringify({ tenantId, ...body });
}

type CommitPayloadInput = Pick<
  IndiaNativeFiscalInvoiceIssueNativeInput,
  "tenantId" | "recipientRegistrationId"
>;

function commitPayload(
  input: CommitPayloadInput,
  readiness: IndiaIrpAccommodationFiscalActionReadinessResult,
  source: IndiaIrpAccommodationSourceResult,
): JsonValue {
  // The DB capability derives the legal document body and all financial values. This
  // payload carries only the exact frozen Order429 state/evidence. Typed selectors
  // are separate SQL arguments; legal date, number, tax and hash-chain authority
  // remain in SQL.
  return Object.freeze({
    readinessState: readiness.state,
    submissionReady: readiness.submissionReady,
    permittedActions: readiness.permittedActions,
    blockers: readiness.blockers,
    recipientRegistrationId: input.recipientRegistrationId,
    sourceEvidenceHash: readiness.sourceEvidenceHash,
    preDocumentEvidenceHash: readiness.preDocumentEvidenceHash,
    readinessEvidenceHash: readiness.evidenceHash,
    preDocumentJson: readiness.preDocumentEvidence.sectionsJson,
    sourceEvidencePreimage: hashPreimage(source as unknown as Readonly<Record<string, unknown>>, input.tenantId, "evidenceHash"),
    preDocumentEvidencePreimage: hashPreimage(
      readiness.preDocumentEvidence as unknown as Readonly<Record<string, unknown>>,
      input.tenantId,
      "evidenceHash",
    ),
    readinessEvidencePreimage: hashPreimage(
      readiness as unknown as Readonly<Record<string, unknown>>,
      input.tenantId,
      "evidenceHash",
    ),
  });
}

export function deriveIndiaFinancialYearStart(value: string): string {
  date(value, "issue date");
  const year = Number(value.slice(0, 4)) - (value.slice(5, 10) < "04-01" ? 1 : 0);
  return `${year.toString().padStart(4, "0")}-04-01`;
}

export function validateIndiaNativeFiscalPrefix(prefix: string, financialYearStart: string): string {
  date(financialYearStart, "financialYearStart");
  if (financialYearStart.slice(5) !== "04-01" || prefix.length < 1 || prefix.length > 12 || !PREFIX.test(prefix)) {
    throw new IndiaNativeFiscalSeriesValidationError("prefix or financial year is invalid");
  }
  // A legal reference consists of prefix + a positive decimal serial and must be
  // no longer than the Rule-46 sixteen-character ceiling.
  if (prefix.length + 1 > 16) throw new IndiaNativeFiscalSeriesValidationError("prefix leaves no room for a legal serial");
  return prefix;
}

export class IndiaNativeFiscalSeriesConfigurationService {
  async configure(tx: Tx, rawInput: IndiaNativeFiscalSeriesConfigurationInput): Promise<IndiaNativeFiscalSeriesConfigurationResult> {
    if (typeof tx !== "function") throw new IndiaNativeFiscalSeriesValidationError("tenant transaction is unavailable");
    const input = normalizeSeries(rawInput);
    validateIndiaNativeFiscalPrefix(input.prefix, "2026-04-01");
    const context = (await tx<Array<{ tenant_id: string | null; current_user: string; current_role: string }>>`
      SELECT NULLIF(current_setting('app.tenant_id', true), '') AS tenant_id,
             current_user::text, current_setting('role', true)::text AS current_role
    `)[0];
    if (!context || context.tenant_id !== input.tenantId || context.current_user !== "app_role" || context.current_role !== "app_role") {
      throw new IndiaNativeFiscalSeriesAuthorizationError("native fiscal series requires the governed tenant app role");
    }
    try {
      const rows = await tx<SeriesRow[]>`
         SELECT series_id, tenant_id, property_node, supplier_registration_id,
                document_kind, prefix, financial_year_start::text, next_no, created
        FROM public.create_india_native_fiscal_series(
          ${input.tenantId}::uuid, ${input.propertyNode}::uuid,
          ${input.supplierRegistrationId}::uuid, ${input.documentKind},
          ${input.prefix}, ${input.envelope.actorId}::uuid
        )
      `;
      const row = rows[0];
      if (!row) throw new IndiaNativeFiscalSeriesConflictError("PostgreSQL did not return the configured fiscal series");
       return asSeriesResult(row, input, row.created !== true);
    } catch (error) {
      if (error instanceof IndiaNativeFiscalSeriesConflictError || error instanceof IndiaNativeFiscalSeriesAuthorizationError) throw error;
      const state = (error as { errno?: unknown; code?: unknown }).errno ??
        (error as { errno?: unknown; code?: unknown }).code;
      if (state === "23505" || state === "40001" || state === "40P01") {
        throw new IndiaNativeFiscalSeriesConflictError("India native fiscal series is already bound or changed concurrently");
      }
      throw error;
    }
  }
}

export interface IndiaNativeFiscalInvoiceServiceOptions {
  readonly readiness?: IndiaIrpAccommodationFiscalActionReadinessService;
  readonly source?: IndiaIrpAccommodationSourceService;
  readonly nativeAccounting?: IndiaNativeFiscalAccountingHandlerPort;
  readonly nativeFinancialSource?: IndiaNativeFiscalSourceReaderPort;
}

export class IndiaNativeFiscalInvoiceIssuanceService {
  readonly #readiness: IndiaIrpAccommodationFiscalActionReadinessService;
  readonly #source: IndiaIrpAccommodationSourceService;
  readonly #nativeAccounting: IndiaNativeFiscalAccountingHandlerPort;
  readonly #nativeFinancialSource: IndiaNativeFiscalSourceReaderPort;

  constructor(options: IndiaNativeFiscalInvoiceServiceOptions = {}) {
    this.#readiness = options.readiness ?? new IndiaIrpAccommodationFiscalActionReadinessService();
    this.#source = options.source ?? new IndiaIrpAccommodationSourceService();
    this.#nativeAccounting = options.nativeAccounting ?? new IndiaNativeFiscalAccountingEventHandler();
    this.#nativeFinancialSource = options.nativeFinancialSource ?? new IndiaFinalComponentTaxFiscalSourceService();
  }

  async issue(tx: Tx, rawInput: IndiaNativeFiscalInvoiceIssueInput): Promise<IndiaNativeFiscalInvoiceReceipt> {
    if (typeof tx !== "function") throw new IndiaNativeFiscalInvoiceValidationError("tenant transaction is unavailable");
    const input = normalizeInvoice(rawInput);
    const context = (await tx<Array<{ tenant_id: string | null; current_user: string; current_role: string }>>`
      SELECT NULLIF(current_setting('app.tenant_id', true), '') AS tenant_id,
             current_user::text, current_setting('role', true)::text AS current_role
    `)[0];
    if (!context || context.tenant_id !== input.tenantId || context.current_user !== "app_role" || context.current_role !== "app_role") {
      throw new IndiaNativeFiscalInvoiceAuthorizationError("native fiscal issue requires the governed tenant app role");
    }
    const selectors = readinessInput(input);
    const readiness = await this.#readiness.resolve(tx, selectors);
    expectedReadiness(readiness);
    const source = await this.#source.resolve(tx, selectors);
    if (source.evidenceHash !== readiness.sourceEvidenceHash) {
      throw new IndiaNativeFiscalInvoiceConflictError("Order413 source changed during native fiscal issuance");
    }
    const payload = commitPayload(input, readiness, source);
    const rows = await tx<CommitRow[]>`
        SELECT document_id, document_kind, series_id, doc_no, property_node,
               reservation_id, folio_id, supplier_registration_id,
               recipient_registration_id, financial_year_start::text, currency::text,
               status, business_date::text, issued_at, prev_hash, sha256,
               source_evidence_hash, pre_document_evidence_hash,
               readiness_evidence_hash, created
        FROM public.commit_india_native_fiscal_invoice(
          ${input.tenantId}::uuid, ${input.propertyNode}::uuid, ${input.actorId}::uuid,
          ${input.reservationId}::uuid, ${input.folioId}::uuid, ${input.journalId}::uuid,
          ${input.idempotencyKey}, ${JSON.stringify(payload)}::text::jsonb,
          ${input.envelope.requestId}::uuid
        )
      `;
    const row = rows[0];
    if (!row) throw new IndiaNativeFiscalInvoiceConflictError("PostgreSQL did not return the issued invoice receipt");
    return receipt(row, input, row.created !== true);
  }

  async issueNative(
    tx: Tx,
    rawInput: IndiaNativeFiscalInvoiceIssueNativeInput,
  ): Promise<IndiaNativeFiscalInvoiceReceipt> {
    if (typeof tx !== "function") {
      throw new IndiaNativeFiscalInvoiceValidationError("tenant transaction is unavailable");
    }
    const input = normalizeNativeInvoice(rawInput);
    const calendar = input.calendarEvidence;
    const calendarDates = postgresArray(calendar?.days.map((day) => day.date) ?? []);
    const calendarStates = postgresArray(calendar?.days.map((day) => day.state) ?? []);
    const rows = await tx<NativePrepareRow[]>`
      SELECT native_timing_id::text, request_event_id::text, posting_binding_id::text,
             prepared_source_json, completed_receipt
        FROM public.prepare_india_native_fiscal_invoice_v2(
          ${input.tenantId}::uuid, ${input.propertyNode}::uuid, ${input.actorId}::uuid,
          ${input.reservationId}::uuid, ${input.folioId}::uuid, ${input.valuationId}::uuid,
          ${input.serviceProvisionSnapshotId}::uuid, ${input.paymentReceiptSnapshotId}::uuid,
          ${input.ordinaryRegimeEvidenceId}::uuid, ${input.supplierServiceLocationId}::uuid,
          ${input.supplierRegistrationStatusId}::uuid, ${input.supplierSezStatusId}::uuid,
          ${input.recipientRegistrationId}::uuid, ${input.recipientSezStatusId}::uuid,
          ${input.classificationId}::uuid, ${calendar?.authorityId ?? null},
          ${calendar?.sourceDigestSha256 ?? null}, ${calendar?.throughDate ?? null}::date,
          ${calendarDates}::date[], ${calendarStates}::text[], ${input.idempotencyKey},
          ${input.envelope.requestId}::uuid
        )
    `;
    if (rows.length !== 1 || !rows[0]) {
      throw new IndiaNativeFiscalInvoiceConflictError("native invoice preparation returned ambiguous evidence");
    }
    const rowRecord = rows[0] as unknown as PlainRecord;
    const names = Object.keys(rowRecord).sort();
    const expected = [...PREPARE_ROW_KEYS].sort();
    if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) {
      throw new IndiaNativeFiscalInvoiceConflictError("native invoice preparation shape is inconsistent");
    }
    const nativeTimingId = storedUuid(rows[0].native_timing_id, "native timing id");
    const requestEventId = storedUuid(rows[0].request_event_id, "request event id");
    const postingBindingId = storedUuid(rows[0].posting_binding_id, "posting binding id");

    if (rows[0].completed_receipt !== null) {
      if (rows[0].prepared_source_json !== null) {
        throw new IndiaNativeFiscalInvoiceConflictError("completed native replay returned fresh source evidence");
      }
      const replay = receipt(exactCommitRow(rows[0].completed_receipt, true), input, true);
      if (replay.recipientRegistrationId !== input.recipientRegistrationId) {
        throw new IndiaNativeFiscalInvoiceConflictError("completed native replay is not bound to the request");
      }
      return replay;
    }

    const prepared = preparedSource(rows[0].prepared_source_json);
    const accounting = await this.#nativeAccounting.handle(tx, Object.freeze({
      tenantId: input.tenantId,
      eventId: requestEventId,
    }));
    if (accounting.nativeTimingId !== nativeTimingId || accounting.postingBindingId !== postingBindingId) {
      throw new IndiaNativeFiscalInvoiceConflictError("native accounting did not bind the prepared transaction");
    }
    const financialSource = await this.#nativeFinancialSource.resolveNative(tx, Object.freeze({
      tenantId: input.tenantId,
      propertyNode: input.propertyNode,
      reservationId: input.reservationId,
      folioId: input.folioId,
      postingBindingId,
    }));
    if (financialSource.nativeTimingId !== nativeTimingId ||
        financialSource.postingBindingId !== postingBindingId ||
        accounting.taxId !== financialSource.taxId || accounting.valuationId !== financialSource.valuationId ||
        accounting.applicabilityId !== financialSource.applicabilityId ||
        accounting.reservationId !== financialSource.reservationId || accounting.folioId !== financialSource.folioId ||
        accounting.journalId !== financialSource.journalId || accounting.currency !== financialSource.currency ||
        accounting.businessDate !== financialSource.businessDate ||
        accounting.evidenceHash !== financialSource.accountingEvidenceHash) {
      throw new IndiaNativeFiscalInvoiceConflictError("native accounting result changed before fiscal source resolution");
    }
    const sourceInput = recursivelyFreeze({
      tenantId: prepared.tenantId,
      financialSource,
      legalBuyerPartyId: prepared.legalBuyerPartyId,
      sellerRegistration: prepared.sellerRegistration,
      recipientRegistration: prepared.recipientRegistration,
      placeOfSupply: prepared.placeOfSupply,
      classification: prepared.classification,
      supplyNatureAtTimeOfSupplyInput: prepared.supplyNatureAtTimeOfSupplyInput,
      supplyNatureAtTimeOfSupplyResult: prepared.supplyNatureAtTimeOfSupplyResult,
    } satisfies IndiaNativeFiscalSourceInput);
    const source = assembleIndiaNativeFiscalSource(sourceInput);
    bindNativeSource(input, sourceInput, source);
    const readiness = await this.#readiness.resolveNative(tx, sourceInput);
    expectedReadiness(readiness);
    if (readiness.sourceEvidenceHash !== source.evidenceHash) {
      throw new IndiaNativeFiscalInvoiceConflictError("Order413 source changed during native fiscal issuance");
    }
    const payload = commitPayload(input, readiness, source);
    const committed = await tx<CommitRow[]>`
      SELECT document_id, document_kind, series_id, doc_no, property_node,
             reservation_id, folio_id, supplier_registration_id,
             recipient_registration_id, financial_year_start::text, currency::text,
             status, business_date::text, issued_at, prev_hash, sha256,
             source_evidence_hash, pre_document_evidence_hash,
             readiness_evidence_hash, created
        FROM public.commit_india_native_fiscal_invoice_v2(
          ${input.tenantId}::uuid, ${input.propertyNode}::uuid, ${input.actorId}::uuid,
          ${nativeTimingId}::uuid, ${input.idempotencyKey},
          ${JSON.stringify(payload)}::text::jsonb, ${input.envelope.requestId}::uuid
        )
    `;
    if (committed.length !== 1 || !committed[0]) {
      throw new IndiaNativeFiscalInvoiceConflictError("PostgreSQL did not return the native issued invoice receipt");
    }
    const commitRow = exactCommitRow(committed[0], false);
    const result = receipt(commitRow, input, commitRow.created !== true);
    if (result.supplierRegistrationId !== source.sellerRegistration.registrationId ||
        result.recipientRegistrationId !== source.recipientRegistration.registrationId ||
        result.documentId !== sourceInput.supplyNatureAtTimeOfSupplyInput
          .supplierRegistrationAtTimeOfSupply.timeOfSupply.nativeTiming.prospectiveDocumentId ||
        result.businessDate !== financialSource.businessDate ||
        result.sourceEvidenceHash !== source.evidenceHash ||
        result.preDocumentEvidenceHash !== readiness.preDocumentEvidenceHash ||
        result.readinessEvidenceHash !== readiness.evidenceHash) {
      throw new IndiaNativeFiscalInvoiceConflictError("native issued invoice receipt is not bound to prepared evidence");
    }
    return result;
  }
}

/** Stable context-level name for callers that do not need to distinguish the
 * issuance operation from the fiscal-invoice aggregate. */
export class IndiaNativeFiscalInvoiceService extends IndiaNativeFiscalInvoiceIssuanceService {}

export const createIndiaNativeFiscalSeries = (tx: Tx, input: IndiaNativeFiscalSeriesConfigurationInput) =>
  new IndiaNativeFiscalSeriesConfigurationService().configure(tx, input);

export const configureIndiaNativeFiscalSeries = createIndiaNativeFiscalSeries;
