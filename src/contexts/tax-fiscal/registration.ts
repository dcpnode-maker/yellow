import { types as utilTypes } from "node:util";
import type { Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INPUT_KEYS = [
  "tenantId",
  "propertyNode",
  "reservationId",
  "supplierServiceLocationId",
  "supplierGstRegistrationStatusId",
  "serviceProvisionSnapshotId",
  "paymentReceiptSnapshotId",
  "invoiceIssueSnapshotId",
  "statusAsOf",
  "timeOfSupplyDate",
  "serviceProvisionDate",
  "paymentReceiptDate",
  "invoiceIssueDate",
  "ordinaryRegimeSource",
  "ordinaryRegimeEvidenceSha256",
  "supplierRegistrationStatusEvidenceHash",
  "timeOfSupplyEvidenceHash",
] as const;

export type { CreatePositiveTaxAttributionSnapshotInput } from "./attribution";

export interface IndiaGstRegistrationAtTimeOfSupplyInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly supplierServiceLocationId: string;
  readonly supplierGstRegistrationStatusId: string;
  readonly serviceProvisionSnapshotId: string;
  readonly paymentReceiptSnapshotId: string;
  readonly invoiceIssueSnapshotId: string;
  readonly statusAsOf: string;
  readonly timeOfSupplyDate: string;
  readonly serviceProvisionDate: string;
  readonly paymentReceiptDate: string;
  readonly invoiceIssueDate: string;
  readonly ordinaryRegimeSource: string;
  readonly ordinaryRegimeEvidenceSha256: string;
  readonly supplierRegistrationStatusEvidenceHash: string;
  readonly timeOfSupplyEvidenceHash: string;
}

export interface IndiaGstRegistrationAtTimeOfSupplyResult {
  readonly result: "active_at_time_of_supply";
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly statusAsOf: string;
  readonly timeOfSupplyDate: string;
  readonly supplier: Readonly<{ readonly registrationId: string; readonly evidenceHash: string }>;
  readonly supplierServiceLocation: Readonly<{ readonly id: string; readonly evidenceHash: string }>;
  readonly supplierRegistrationStatusEvidenceHash: string;
  readonly timeOfSupplyEvidenceHash: string;
  readonly timeOfSupply: Readonly<{ readonly evidenceHash: string; readonly source: "governed_rule47_ordinary_regime_record" }>;
  readonly evidenceHash: string;
}

export class IndiaGstRegistrationAtTimeOfSupplyValidationError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaGstRegistrationAtTimeOfSupplyValidationError"; }
}
export class IndiaGstRegistrationAtTimeOfSupplyNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaGstRegistrationAtTimeOfSupplyNotFoundError"; }
}
export class IndiaGstRegistrationAtTimeOfSupplyConflictError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaGstRegistrationAtTimeOfSupplyConflictError"; }
}

type Row = Record<string, unknown>;
type ErrorClass = new (message: string) => Error;

function exact(value: unknown, keys: readonly string[], label: string, ErrorType: ErrorClass = IndiaGstRegistrationAtTimeOfSupplyValidationError): Row {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getOwnPropertySymbols(value).length
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new ErrorType(`${label} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
    || Object.values(descriptors).some((descriptor) => descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor))
  ) {
    throw new ErrorType(`${label} shape is invalid`);
  }
  return value as Row;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError(`${label} is invalid`);
  return value;
}

function hash(value: unknown, label: string): string {
  if (typeof value !== "string" || !HASH.test(value)) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError(`${label} is invalid`);
  return value;
}

function date(value: unknown, label: string): string {
  if (typeof value !== "string") throw new IndiaGstRegistrationAtTimeOfSupplyConflictError(`${label} is invalid`);
  const match = DATE.exec(value);
  if (match === null) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError(`${label} is invalid`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > (days[month - 1] ?? 0)) {
    throw new IndiaGstRegistrationAtTimeOfSupplyConflictError(`${label} is invalid`);
  }
  return value;
}

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function freezeDeep<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) freezeDeep((value as Record<PropertyKey, unknown>)[key], seen);
  return Object.freeze(value);
}

function validateInput(input: unknown): IndiaGstRegistrationAtTimeOfSupplyInput {
  const exactInput = exact(input, INPUT_KEYS, "registration-at-time-of-supply input") as unknown as IndiaGstRegistrationAtTimeOfSupplyInput;
  if (exactInput.ordinaryRegimeSource !== "governed_rule47_ordinary_regime_record") {
    throw new IndiaGstRegistrationAtTimeOfSupplyValidationError("unsupported regime");
  }
  for (const [value, label] of [
    [exactInput.tenantId, "tenant"],
    [exactInput.propertyNode, "property"],
    [exactInput.reservationId, "reservation"],
    [exactInput.supplierServiceLocationId, "supplier service location"],
    [exactInput.supplierGstRegistrationStatusId, "supplier status"],
    [exactInput.serviceProvisionSnapshotId, "service snapshot"],
    [exactInput.paymentReceiptSnapshotId, "payment snapshot"],
    [exactInput.invoiceIssueSnapshotId, "invoice snapshot"],
  ] as const) uuid(value, label);
  for (const [value, label] of [
    [exactInput.statusAsOf, "status as of"],
    [exactInput.timeOfSupplyDate, "time of supply"],
    [exactInput.serviceProvisionDate, "service date"],
    [exactInput.paymentReceiptDate, "payment date"],
    [exactInput.invoiceIssueDate, "invoice date"],
  ] as const) date(value, label);
  for (const [value, label] of [
    [exactInput.ordinaryRegimeEvidenceSha256, "regime evidence"],
    [exactInput.supplierRegistrationStatusEvidenceHash, "registration status evidence"],
    [exactInput.timeOfSupplyEvidenceHash, "time of supply evidence"],
  ] as const) hash(value, label);
  return exactInput;
}

function build(row: Row, input: IndiaGstRegistrationAtTimeOfSupplyInput): IndiaGstRegistrationAtTimeOfSupplyResult {
  const tenantId = uuid(row.tenant_id, "tenant");
  const propertyNode = uuid(row.property_node, "property");
  const reservationId = uuid(row.reservation_id, "reservation");
  const registrationId = uuid(row.registration_id, "registration");
  const locationId = uuid(row.supplier_service_location_id, "supplier service location");
  const statusId = uuid(row.supplier_gst_registration_status_id, "supplier status");
  const statusAsOf = date(row.status_as_of, "status as of");
  const timeOfSupplyDate = date(row.time_of_supply_date, "time of supply");
  const registrationHash = hash(row.registration_evidence_hash, "registration evidence");
  const locationHash = hash(row.location_evidence_hash, "location evidence");
  const statusHash = hash(row.status_evidence_hash, "status evidence");
  const timeHash = hash(row.time_of_supply_evidence_hash, "time of supply evidence");
  if (
    tenantId !== input.tenantId
    || propertyNode !== input.propertyNode
    || reservationId !== input.reservationId
    || locationId !== input.supplierServiceLocationId
    || statusId !== input.supplierGstRegistrationStatusId
    || statusAsOf !== input.statusAsOf
    || timeOfSupplyDate !== input.timeOfSupplyDate
    || statusHash !== input.supplierRegistrationStatusEvidenceHash
    || timeHash !== input.timeOfSupplyEvidenceHash
    || row.registration_status !== "active"
    || row.taxpayer_type !== "regular"
    || row.status_source !== "gst_common_portal"
    || row.status_legal_rule !== "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS"
    || row.time_of_supply_source !== "governed_rule47_ordinary_regime_record"
    || row.time_of_supply_legal_rule !== "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY"
  ) {
    throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("evidence conflicts with registration at time of supply");
  }
  const result = {
    result: "active_at_time_of_supply" as const,
    propertyNode,
    reservationId,
    statusAsOf,
    timeOfSupplyDate,
    supplier: { registrationId, evidenceHash: registrationHash },
    supplierServiceLocation: { id: locationId, evidenceHash: locationHash },
    supplierRegistrationStatusEvidenceHash: statusHash,
    timeOfSupplyEvidenceHash: timeHash,
    timeOfSupply: { evidenceHash: timeHash, source: "governed_rule47_ordinary_regime_record" as const },
  };
  return freezeDeep({ ...result, evidenceHash: digest({ tenantId, ...result }) });
}

export class IndiaGstRegistrationAtTimeOfSupplyService {
  async resolve(tx: Tx, input: IndiaGstRegistrationAtTimeOfSupplyInput): Promise<IndiaGstRegistrationAtTimeOfSupplyResult> {
    if (typeof tx !== "function") throw new IndiaGstRegistrationAtTimeOfSupplyValidationError("tenant transaction is unavailable");
    const i = validateInput(input);
    const rows = await tx<Row[]>`
      SELECT
        s.tenant_id,
        s.id supplier_gst_registration_status_id,
        l.id supplier_service_location_id,
        r.id registration_id,
        r.property_node,
        sp.reservation_id,
        s.status_as_of,
        t.time_of_supply_date,
        r.evidence_hash registration_evidence_hash,
        l.evidence_hash location_evidence_hash,
        s.evidence_hash status_evidence_hash,
        t.evidence_hash time_of_supply_evidence_hash,
        s.status registration_status,
        s.taxpayer_type,
        s.source status_source,
        s.legal_rule status_legal_rule,
        t.source time_of_supply_source,
        t.legal_rule time_of_supply_legal_rule
      FROM public.india_gst_supplier_registration_status_snapshot s
      JOIN public.india_gst_supplier_service_location l
        ON l.tenant_id = s.tenant_id AND l.id = s.supplier_service_location_id
      JOIN public.property_fiscal_registration r
        ON r.tenant_id = s.tenant_id AND r.id = l.registration_id
      JOIN public.india_gst_accommodation_time_of_supply_snapshot t
        ON t.tenant_id = s.tenant_id
      JOIN public.india_gst_accommodation_service_provision_snapshot sp
        ON sp.tenant_id = t.tenant_id AND sp.id = t.service_provision_snapshot_id
      WHERE s.tenant_id = ${i.tenantId}::uuid
        AND s.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND s.id = ${i.supplierGstRegistrationStatusId}::uuid
        AND l.id = ${i.supplierServiceLocationId}::uuid
        AND r.property_node = ${i.propertyNode}::uuid
        AND sp.reservation_id = ${i.reservationId}::uuid
        AND t.service_provision_snapshot_id = ${i.serviceProvisionSnapshotId}::uuid
        AND t.payment_receipt_snapshot_id = ${i.paymentReceiptSnapshotId}::uuid
        AND t.invoice_issue_snapshot_id = ${i.invoiceIssueSnapshotId}::uuid
        AND s.status_as_of = ${i.statusAsOf}::date
        AND t.time_of_supply_date = ${i.timeOfSupplyDate}::date
        AND sp.service_provision_date = ${i.serviceProvisionDate}::date`;
    if (rows.length === 0) throw new IndiaGstRegistrationAtTimeOfSupplyNotFoundError("selected registration evidence is unavailable");
    if (rows.length !== 1 || rows[0] === undefined) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("selected registration evidence is ambiguous");
    return build(rows[0], i);
  }
}
