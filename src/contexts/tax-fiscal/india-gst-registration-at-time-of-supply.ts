import { types as utilTypes } from "node:util";
import type { Tx } from "../../kernel";
import { parsePositiveTaxAttributionSnapshot } from "./attribution";
import type {
  IndiaGstAccommodationNativeInvoiceSourceResult,
  IndiaGstAccommodationNativeTimingResult,
} from "./india-gst-accommodation-invoice-source";
import {
  IndiaGstAccommodationInvoiceSourceValidationError,
  validateIndiaGstAccommodationNativeInvoiceSourceResult,
} from "./india-gst-accommodation-invoice-source";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CURRENCY = /^[A-Z]{3}$/;
const GSTIN = /^([0-9]{2})[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
  "33", "34", "35", "36", "37", "38",
]);
const JURISDICTION_KEY = /^[a-z0-9][a-z0-9_.:-]{0,127}$/;
const INPUT_KEYS = [
  "tenantId", "propertyNode", "reservationId", "supplierServiceLocationId",
  "supplierGstRegistrationStatusId", "serviceProvisionSnapshotId",
  "paymentReceiptSnapshotId", "invoiceIssueSnapshotId", "statusAsOf",
  "timeOfSupplyDate", "serviceProvisionDate", "paymentReceiptDate",
  "invoiceIssueDate", "ordinaryRegimeSource", "ordinaryRegimeEvidenceSha256",
  "supplierRegistrationStatusEvidenceHash", "timeOfSupplyEvidenceHash",
] as const;
const ROW_KEYS = [
  "tenant_id", "registration_id", "registration_property_node", "registration_scheme",
  "registration_currency", "jurisdiction_extension_id", "jurisdiction_owner_tenant_id",
  "jurisdiction_key", "jurisdiction_version", "jurisdiction_content_hash",
  "registration_number", "region_code", "legal_name", "trade_name", "address_line",
  "locality", "postal_code", "location_id", "location_registration_id",
  "location_supplier_evidence_hash", "location_service_scope", "registered_place_kind",
  "location_basis", "location_legal_rule", "status_id", "status_registration_id",
  "status_supplier_evidence_hash", "status_as_of", "gst_registration_status",
  "gst_taxpayer_type", "gst_status_source", "gst_status_evidence_sha256", "status_legal_rule",
  "service_id", "payment_id", "invoice_id", "property_node", "reservation_id",
  "service_date", "payment_date", "invoice_date", "service_currency", "payment_currency",
  "invoice_currency", "payment_amount", "invoice_amount", "service_evidence",
  "payment_evidence", "invoice_evidence", "books_date", "bank_date", "service_source",
  "service_rule", "payment_source", "payment_rule", "invoice_source", "invoice_rule",
  "coverage_scope", "invoice_series", "invoice_serial", "service_lineage_id",
  "service_hold_binding_id", "service_attribution_id", "service_segment_id",
  "service_quote_hash", "service_snapshot_hash", "lineage_id", "lineage_property_node",
  "lineage_hold_binding_id", "lineage_attribution_id", "lineage_reservation_id",
  "lineage_segment_id", "lineage_quote_hash", "lineage_snapshot_hash", "lineage_currency",
  "attribution_snapshot",
] as const;
type Row = Record<string, unknown>;

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

type Jurisdiction = Readonly<{ extensionId: string; ownerTenantId: string | null; key: string; version: string; contentHash: string }>;
type Lineage = Readonly<{ lineageId: string; holdBindingId: string; attributionId: string; reservationId: string; segmentId: string; originQuoteHash: string; snapshotHash: string; currency: string }>;
type RegistrationEvidence = Readonly<{ registrationId: string; evidenceHash: string }>;

export interface IndiaGstRegistrationAtTimeOfSupplyResult {
  readonly supplierRegistrationId: string;
  readonly supplierGstRegistrationStatusId: string;
  readonly supplierServiceLocationId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly statusAsOf: string;
  readonly timeOfSupplyDate: string;
  readonly result: "active_at_time_of_supply";
  readonly supplierServiceLocation: Readonly<{ id: string; evidenceHash: string }>;
  readonly supplier: RegistrationEvidence;
  readonly gstRegistration: Readonly<{ status: "active"; taxpayerType: "regular" | "sez_unit" | "sez_developer"; source: "gst_common_portal"; evidenceSha256: string }>;
  readonly supplierRegistrationStatusEvidenceHash: string;
  readonly timeOfSupplyEvidenceHash: string;
  readonly timeOfSupply: Readonly<{
    serviceProvisionSnapshotId: string; paymentReceiptSnapshotId: string; invoiceIssueSnapshotId: string;
    propertyNode: string; reservationId: string;
    serviceProvisionDate: string; paymentReceiptDate: string; invoiceIssueDate: string;
    deadlineDate: string;
    candidateDates: Readonly<{ invoiceIssueDate: string; paymentReceiptDate: string } | { serviceProvisionDate: string; paymentReceiptDate: string }>;
    branch: "section13_2_a_invoice_or_payment" | "section13_2_b_service_or_payment";
    timeOfSupplyDate: string; regime: "ordinary_rule47_30_day";
    source: "governed_rule47_ordinary_regime_record";
    legalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY";
    ordinaryRegimeSource: "governed_rule47_ordinary_regime_record"; ordinaryRegimeEvidenceSha256: string;
    invoiceSeries: string; invoiceSerial: string;
    supplierBooksEntryDate: string; supplierBankCreditDate: string;
    coverageScope: "full_attribution";
    serviceProvisionSource: "governed_service_provision_record";
    serviceProvisionLegalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY";
    paymentReceiptSource: "governed_supplier_payment_receipt_record";
    paymentReceiptLegalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY";
    invoiceIssueSource: "governed_supplier_tax_invoice_record";
    invoiceIssueLegalRule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY";
    serviceProvisionEvidenceSha256: string; paymentReceiptEvidenceSha256: string; invoiceIssueEvidenceSha256: string;
    reservationLineage: Lineage; attribution: Readonly<{ originKind: "rate_quote"; lineId: "room"; revenueGroup: "room_revenue" }>;
    amountMinor: string; currency: string;
    evidenceHash: string;
  }>;
  readonly registrationLegalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS";
  readonly timeOfSupplyLegalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY";
  readonly evidenceHash: string;
}

export interface IndiaGstSupplierRegistrationStatusForNativeTimeOfSupply {
  readonly supplierRegistrationId: string;
  readonly supplierGstRegistrationStatusId: string;
  readonly supplierServiceLocationId: string;
  readonly propertyNode: string;
  readonly statusAsOf: string;
  readonly supplierServiceLocation: Readonly<{ readonly id: string; readonly evidenceHash: string }>;
  readonly supplier: Readonly<{ readonly registrationId: string; readonly evidenceHash: string }>;
  readonly gstRegistration: Readonly<{
    readonly status: "active";
    readonly taxpayerType: "regular" | "sez_unit" | "sez_developer";
    readonly source: "gst_common_portal";
    readonly evidenceSha256: string;
  }>;
  readonly supplierRegistrationStatusEvidenceHash: string;
  readonly registrationLegalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS";
}

export interface IndiaGstRegistrationAtNativeTimeOfSupplyInput {
  readonly tenantId: string;
  readonly supplierRegistrationStatus: IndiaGstSupplierRegistrationStatusForNativeTimeOfSupply;
  readonly invoiceSource: IndiaGstAccommodationNativeInvoiceSourceResult;
}

export interface IndiaGstNativeRegistrationTimeOfSupplyEvidence {
  readonly kind: "native_current_transaction";
  readonly nativeTiming: IndiaGstAccommodationNativeTimingResult;
  readonly evidenceHash: string;
}

export interface IndiaGstRegistrationAtNativeTimeOfSupplyResult {
  readonly kind: "native_current_transaction";
  readonly supplierRegistrationId: string;
  readonly supplierGstRegistrationStatusId: string;
  readonly supplierServiceLocationId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly statusAsOf: string;
  readonly timeOfSupplyDate: string;
  readonly result: "active_at_time_of_supply";
  readonly supplierServiceLocation: Readonly<{ readonly id: string; readonly evidenceHash: string }>;
  readonly supplier: Readonly<{ readonly registrationId: string; readonly evidenceHash: string }>;
  readonly gstRegistration: IndiaGstSupplierRegistrationStatusForNativeTimeOfSupply["gstRegistration"];
  readonly supplierRegistrationStatusEvidenceHash: string;
  readonly invoiceSourceEvidenceHash: string;
  readonly timeOfSupplyEvidenceHash: string;
  readonly timeOfSupply: IndiaGstNativeRegistrationTimeOfSupplyEvidence;
  readonly registrationLegalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS";
  readonly timeOfSupplyLegalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY";
  readonly evidenceHash: string;
}

export class IndiaGstRegistrationAtTimeOfSupplyValidationError extends Error { constructor(message: string) { super(message); this.name = "IndiaGstRegistrationAtTimeOfSupplyValidationError"; } }
export class IndiaGstRegistrationAtTimeOfSupplyNotFoundError extends Error { constructor(message: string) { super(message); this.name = "IndiaGstRegistrationAtTimeOfSupplyNotFoundError"; } }
export class IndiaGstRegistrationAtTimeOfSupplyConflictError extends Error { constructor(message: string) { super(message); this.name = "IndiaGstRegistrationAtTimeOfSupplyConflictError"; } }

function exact(value: unknown, keys: readonly string[], subject: string, E: new (m: string) => Error): Row {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) throw new E(`${subject} must be an exact plain object`);
  const descriptors = Object.getOwnPropertyDescriptors(value), actual = Object.keys(descriptors).sort(), expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]) || Object.values(descriptors).some((descriptor) => descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor))) throw new E(`${subject} shape is invalid`);
  return value as Row;
}
function text(value: unknown, subject: string): string { if (typeof value !== "string") throw new IndiaGstRegistrationAtTimeOfSupplyConflictError(`${subject} is invalid`); return value; }
function uuid(value: unknown, subject: string, E = IndiaGstRegistrationAtTimeOfSupplyConflictError): string { if (typeof value !== "string" || !UUID.test(value)) throw new E(`${subject} is invalid`); return value; }
function hash(value: unknown, subject: string): string { if (typeof value !== "string" || !SHA256.test(value)) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError(`${subject} is invalid`); return value; }
function date(value: unknown, subject: string, E = IndiaGstRegistrationAtTimeOfSupplyConflictError): string { if (typeof value !== "string") throw new E(`${subject} is invalid`); const m = DATE.exec(value); if (!m) throw new E(`${subject} is invalid`); const year = +m[1]!, month = +m[2]!, day = +m[3]!, leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0), days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; if (year === 0 || month < 1 || month > 12 || day < 1 || day > (days[month - 1] ?? 0)) throw new E(`${subject} is invalid`); return value; }
function digest(value: unknown): string { return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex"); }
function freeze<T>(value: T, seen = new Set<object>()): T { if (typeof value !== "object" || value === null || seen.has(value)) return value; seen.add(value); for (const key of Reflect.ownKeys(value)) freeze((value as Record<PropertyKey, unknown>)[key], seen); return Object.freeze(value); }
function deeplyFrozen(value: unknown, seen = new Set<object>()): void { if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return; if (typeof value === "object" && seen.has(value)) return; if (typeof value !== "object" || utilTypes.isProxy(value) || !Object.isFrozen(value) || Object.getOwnPropertySymbols(value).length !== 0 || !Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new IndiaGstRegistrationAtTimeOfSupplyValidationError("native registration timing input must be an exact deeply frozen graph"); seen.add(value); for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) { if (Array.isArray(value) && key === "length") continue; if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true || descriptor.configurable !== false || !("value" in descriptor) || descriptor.writable !== false) throw new IndiaGstRegistrationAtTimeOfSupplyValidationError("native registration timing input contains invalid descriptors"); deeplyFrozen(descriptor.value, seen); } }
function add30(value: string): string { const parts = value.split("-").map(Number) as [number, number, number]; let [year, month, day] = parts; for (let i = 0; i < 30; i += 1) { day += 1; const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0), max = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!; if (day > max) { day = 1; month += 1; if (month > 12) { month = 1; year += 1; } } } if (year > 9999) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("ordinary deadline exceeds supported calendar"); return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }
function gstinChecksum(body: string): string { let factor = 2, sum = 0; for (let i = body.length - 1; i >= 0; i -= 1) { const code = GST_ALPHABET.indexOf(body[i] ?? ""); if (code < 0) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("GSTIN is invalid"); const addend = factor * code; factor = factor === 2 ? 1 : 2; sum += Math.floor(addend / 36) + addend % 36; } return GST_ALPHABET[(36 - sum % 36) % 36]!; }
function canonicalText(value: unknown, subject: string, max: number): string { if (typeof value !== "string" || value.length === 0 || value.length > max || value !== value.trim() || value !== value.normalize("NFC") || /[\u0000-\u001f\u007f]/.test(value)) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError(`${subject} is not canonical`); return value; }
function canonicalJurisdiction(row: Row): Jurisdiction { const extensionId = uuid(row.jurisdiction_extension_id, "jurisdiction extension id"), owner = row.jurisdiction_owner_tenant_id === null ? null : uuid(row.jurisdiction_owner_tenant_id, "jurisdiction owner tenant id"), key = text(row.jurisdiction_key, "jurisdiction key"), version = String(row.jurisdiction_version); if (!JURISDICTION_KEY.test(key) || !/^[1-9][0-9]*$/.test(version)) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("jurisdiction identity is invalid"); return Object.freeze({ extensionId, ownerTenantId: owner, key, version, contentHash: hash(row.jurisdiction_content_hash, "jurisdiction content hash") }); }

function build(raw: Row, input: IndiaGstRegistrationAtTimeOfSupplyInput): IndiaGstRegistrationAtTimeOfSupplyResult {
  const row = exact(raw, ROW_KEYS, "stored GST registration-at-time-of-supply row", IndiaGstRegistrationAtTimeOfSupplyConflictError);
  const tenant = uuid(row.tenant_id, "stored tenant"), registrationId = uuid(row.registration_id, "supplier registration id"), property = uuid(row.property_node, "stored property"), reservation = uuid(row.reservation_id, "stored reservation"), locationId = uuid(row.location_id, "supplier service-location id"), statusId = uuid(row.status_id, "supplier status id"), serviceId = uuid(row.service_id, "service snapshot id"), paymentId = uuid(row.payment_id, "payment snapshot id"), invoiceId = uuid(row.invoice_id, "invoice snapshot id");
  const registrationProperty = uuid(row.registration_property_node, "registration property id"), statusRegistration = uuid(row.status_registration_id, "status registration id"), locationRegistration = uuid(row.location_registration_id, "location registration id");
  if (tenant !== input.tenantId || property !== input.propertyNode || registrationProperty !== property || statusRegistration !== registrationId || locationRegistration !== registrationId || reservation !== input.reservationId || locationId !== input.supplierServiceLocationId || statusId !== input.supplierGstRegistrationStatusId || serviceId !== input.serviceProvisionSnapshotId || paymentId !== input.paymentReceiptSnapshotId || invoiceId !== input.invoiceIssueSnapshotId) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("predecessor identity conflicts");
  const statusDate = date(row.status_as_of, "status-as-of date"), tosDate = date(input.timeOfSupplyDate, "time-of-supply date", IndiaGstRegistrationAtTimeOfSupplyValidationError), serviceDate = date(row.service_date, "service date"), paymentDate = date(row.payment_date, "payment date"), invoiceDate = date(row.invoice_date, "invoice date"), books = date(row.books_date, "books date"), bank = date(row.bank_date, "bank date");
  if (statusDate !== input.statusAsOf || statusDate !== tosDate || serviceDate !== input.serviceProvisionDate || paymentDate !== input.paymentReceiptDate || invoiceDate !== input.invoiceIssueDate) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("exact date evidence conflicts");
  const jurisdiction = canonicalJurisdiction(row), registrationNumber = text(row.registration_number, "GSTIN");
  if (!GSTIN.test(registrationNumber) || registrationNumber.slice(0, 2) !== text(row.region_code, "GST state code") || !STATE_CODES.has(text(row.region_code, "GST state code")) || gstinChecksum(registrationNumber.slice(0, 14)) !== registrationNumber[14]) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("GSTIN is not canonical");
  const legalName = canonicalText(row.legal_name, "legal name", 200), tradeName = row.trade_name === null ? null : canonicalText(row.trade_name, "trade name", 200), addressLine = canonicalText(row.address_line, "address line", 300), locality = canonicalText(row.locality, "locality", 120), postalCode = text(row.postal_code, "postal code"), regionCode = text(row.region_code, "region code");
  if (!STATE_CODES.has(regionCode) || !/^[1-9][0-9]{5}$/.test(postalCode)) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("registration location is invalid");
  if (row.registration_scheme !== "in-gstin" || row.registration_currency !== "INR" || row.location_service_scope !== "lodging_accommodation" || row.registered_place_kind !== "principal_place_of_business" && row.registered_place_kind !== "additional_place_of_business" || row.location_basis !== "supply_made_from_registered_place_of_business" || row.location_legal_rule !== "IGST_ACT_2_15_A" || row.status_as_of !== input.statusAsOf || row.gst_registration_status !== "active" || row.gst_status_source !== "gst_common_portal" || row.status_legal_rule !== "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS") throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("unsupported predecessor evidence");
  const registrationBody = { registrationId, tenantId: tenant, propertyNode: property, scheme: "in-gstin" as const, currency: "INR" as const, jurisdiction, gstin: registrationNumber, stateCode: regionCode, legalName, tradeName, addressLine, locality, postalCode }, registrationEvidenceHash = digest(registrationBody);
  const storedRegistrationHash = hash(row.location_supplier_evidence_hash, "supplier evidence hash");
  if (storedRegistrationHash !== registrationEvidenceHash || hash(row.status_supplier_evidence_hash, "status supplier evidence hash") !== registrationEvidenceHash) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("supplier registration hash is inconsistent");
  const supplier = Object.freeze({ registrationId, evidenceHash: registrationEvidenceHash });
  const registeredPlace = Object.freeze({ kind: row.registered_place_kind as "principal_place_of_business" | "additional_place_of_business", stateCode: regionCode, addressLine, locality, postalCode });
  const locationEvidence = { tenantId: tenant, supplierServiceLocationId: locationId, propertyNode: property, jurisdiction, supplier, serviceScope: "lodging_accommodation" as const, registeredPlace, locationBasis: "supply_made_from_registered_place_of_business" as const, legalRule: "IGST_ACT_2_15_A" as const }, locationEvidenceHash = digest(locationEvidence);
  const statusEvidence = { tenantId: tenant, supplierGstRegistrationStatusId: statusId, propertyNode: property, supplierServiceLocation: { id: locationId, evidenceHash: locationEvidenceHash }, supplier, statusAsOf: statusDate, gstRegistration: { status: "active" as const, taxpayerType: row.gst_taxpayer_type as "regular" | "sez_unit" | "sez_developer", source: "gst_common_portal" as const, evidenceSha256: hash(row.gst_status_evidence_sha256, "GST status evidence hash") }, legalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS" as const };
  if (statusEvidence.gstRegistration.taxpayerType !== "regular" && statusEvidence.gstRegistration.taxpayerType !== "sez_unit" && statusEvidence.gstRegistration.taxpayerType !== "sez_developer") throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("GST taxpayer type is unsupported");
  const currencies = [row.service_currency, row.payment_currency, row.invoice_currency, row.lineage_currency].map((v, i) => { const c = text(v, `currency ${i}`); if (!CURRENCY.test(c)) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("currency is invalid"); return c; });
  if (new Set(currencies).size !== 1 || currencies[0] !== "INR") throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("currency lineage is inconsistent");
  const amounts = [text(row.payment_amount, "payment amount"), text(row.invoice_amount, "invoice amount")]; if (!/^[1-9][0-9]*$/.test(amounts[0]!) || amounts[0] !== amounts[1]) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("amount lineage is inconsistent");
  const hashes = ["service_evidence", "payment_evidence", "invoice_evidence", "service_quote_hash", "service_snapshot_hash", "lineage_quote_hash", "lineage_snapshot_hash"] as const; for (const key of hashes) hash(row[key], key);
  const lineageIds = ["service_lineage_id", "service_hold_binding_id", "service_attribution_id", "service_segment_id", "lineage_id", "lineage_property_node", "lineage_hold_binding_id", "lineage_attribution_id", "lineage_reservation_id", "lineage_segment_id"] as const; for (const key of lineageIds) uuid(row[key], key);
  if (row.service_lineage_id !== row.lineage_id || row.service_hold_binding_id !== row.lineage_hold_binding_id || row.service_attribution_id !== row.lineage_attribution_id || row.service_segment_id !== row.lineage_segment_id || row.lineage_property_node !== property || row.lineage_reservation_id !== reservation || row.service_quote_hash !== row.lineage_quote_hash || row.service_snapshot_hash !== row.lineage_snapshot_hash || row.coverage_scope !== "full_attribution" || row.service_source !== "governed_service_provision_record" || row.service_rule !== "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" || row.payment_source !== "governed_supplier_payment_receipt_record" || row.payment_rule !== "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY" || row.invoice_source !== "governed_supplier_tax_invoice_record" || row.invoice_rule !== "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY" || paymentDate !== (books < bank ? books : bank)) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("time-of-supply predecessor lineage is inconsistent");
  try { const attribution = parsePositiveTaxAttributionSnapshot(row.attribution_snapshot); if (attribution.origin.kind !== "rate_quote" || attribution.origin.quoteHash !== row.lineage_quote_hash || attribution.snapshotHash !== row.lineage_snapshot_hash || attribution.currency !== currencies[0] || attribution.revenueLine.lineId !== "room" || attribution.revenueLine.revenueGroup !== "room_revenue" || attribution.evaluation.grandTotalMinor.toString() !== amounts[0]) throw new Error(); } catch { throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("canonical attribution is malformed"); }
  const deadline = add30(serviceDate), timely = invoiceDate <= deadline, selected = timely ? (invoiceDate < paymentDate ? invoiceDate : paymentDate) : (serviceDate < paymentDate ? serviceDate : paymentDate); if (selected !== tosDate || row.coverage_scope !== "full_attribution") throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("time-of-supply date is inconsistent");
  const reservationLineage = Object.freeze({ lineageId: String(row.lineage_id), holdBindingId: String(row.lineage_hold_binding_id), attributionId: String(row.lineage_attribution_id), reservationId: String(row.lineage_reservation_id), segmentId: String(row.lineage_segment_id), originQuoteHash: String(row.lineage_quote_hash), snapshotHash: String(row.lineage_snapshot_hash), currency: String(currencies[0]) });
  const attribution = Object.freeze({ originKind: "rate_quote" as const, lineId: "room" as const, revenueGroup: "room_revenue" as const });
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(text(row.invoice_series, "invoice series")) || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(text(row.invoice_serial, "invoice serial"))) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("invoice identity is invalid");
  if (input.ordinaryRegimeSource !== "governed_rule47_ordinary_regime_record" || !SHA256.test(input.ordinaryRegimeEvidenceSha256)) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("ordinary regime evidence is invalid");
  const tosBody = { serviceProvisionSnapshotId: serviceId, paymentReceiptSnapshotId: paymentId, invoiceIssueSnapshotId: invoiceId, propertyNode: property, reservationId: reservation, reservationLineage, attribution, serviceProvisionDate: serviceDate, paymentReceiptDate: paymentDate, invoiceIssueDate: invoiceDate, deadlineDate: deadline, candidateDates: timely ? Object.freeze({ invoiceIssueDate: invoiceDate, paymentReceiptDate: paymentDate }) : Object.freeze({ serviceProvisionDate: serviceDate, paymentReceiptDate: paymentDate }), branch: timely ? "section13_2_a_invoice_or_payment" as const : "section13_2_b_service_or_payment" as const, timeOfSupplyDate: tosDate, regime: "ordinary_rule47_30_day" as const, source: "governed_rule47_ordinary_regime_record" as const, legalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY" as const, ordinaryRegimeEvidenceSha256: input.ordinaryRegimeEvidenceSha256, invoiceSeries: text(row.invoice_series, "invoice series"), invoiceSerial: text(row.invoice_serial, "invoice serial"), supplierBooksEntryDate: books, supplierBankCreditDate: bank, coverageScope: "full_attribution" as const, serviceProvisionSource: "governed_service_provision_record" as const, serviceProvisionLegalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" as const, paymentReceiptSource: "governed_supplier_payment_receipt_record" as const, paymentReceiptLegalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY" as const, invoiceIssueSource: "governed_supplier_tax_invoice_record" as const, invoiceIssueLegalRule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY" as const, serviceProvisionEvidenceSha256: row.service_evidence as string, paymentReceiptEvidenceSha256: row.payment_evidence as string, invoiceIssueEvidenceSha256: row.invoice_evidence as string, amountMinor: amounts[0]!, currency: currencies[0]! }, tosHash = digest(tosBody), statusHash = digest(statusEvidence);
  if (statusHash !== input.supplierRegistrationStatusEvidenceHash || tosHash !== input.timeOfSupplyEvidenceHash) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("approved predecessor evidence hash conflicts");
  const timeOfSupply = Object.freeze({ ...tosBody, ordinaryRegimeSource: tosBody.source, evidenceHash: tosHash });
  const evidence = { supplierRegistrationId: registrationId, supplierGstRegistrationStatusId: statusId, supplierServiceLocationId: locationId, propertyNode: property, reservationId: reservation, statusAsOf: statusDate, timeOfSupplyDate: tosDate, result: "active_at_time_of_supply" as const, supplierServiceLocation: { id: locationId, evidenceHash: locationEvidenceHash }, supplier, gstRegistration: statusEvidence.gstRegistration, supplierRegistrationStatusEvidenceHash: statusHash, timeOfSupplyEvidenceHash: tosHash, timeOfSupply, registrationLegalRule: statusEvidence.legalRule, timeOfSupplyLegalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY" as const };
  return freeze({ ...evidence, evidenceHash: digest({ tenantId: tenant, ...evidence }) });
}

export class IndiaGstRegistrationAtTimeOfSupplyService {
  async resolve(tx: Tx, rawInput: IndiaGstRegistrationAtTimeOfSupplyInput): Promise<IndiaGstRegistrationAtTimeOfSupplyResult> {
    if (typeof tx !== "function") throw new IndiaGstRegistrationAtTimeOfSupplyValidationError("tenant transaction is unavailable");
    const input = exact(rawInput, INPUT_KEYS, "GST registration-at-time-of-supply input", IndiaGstRegistrationAtTimeOfSupplyValidationError) as unknown as IndiaGstRegistrationAtTimeOfSupplyInput;
    const tenant = uuid(input.tenantId, "tenantId", IndiaGstRegistrationAtTimeOfSupplyValidationError);
    for (const [key, value] of Object.entries(input)) if (key !== "tenantId" && key !== "statusAsOf" && key !== "timeOfSupplyDate" && key !== "serviceProvisionDate" && key !== "paymentReceiptDate" && key !== "invoiceIssueDate" && key !== "ordinaryRegimeSource" && key !== "ordinaryRegimeEvidenceSha256" && key !== "supplierRegistrationStatusEvidenceHash" && key !== "timeOfSupplyEvidenceHash") uuid(value, key, IndiaGstRegistrationAtTimeOfSupplyValidationError);
    date(input.statusAsOf, "statusAsOf", IndiaGstRegistrationAtTimeOfSupplyValidationError); date(input.timeOfSupplyDate, "timeOfSupplyDate", IndiaGstRegistrationAtTimeOfSupplyValidationError); date(input.serviceProvisionDate, "serviceProvisionDate", IndiaGstRegistrationAtTimeOfSupplyValidationError); date(input.paymentReceiptDate, "paymentReceiptDate", IndiaGstRegistrationAtTimeOfSupplyValidationError); date(input.invoiceIssueDate, "invoiceIssueDate", IndiaGstRegistrationAtTimeOfSupplyValidationError);
    if (input.statusAsOf !== input.timeOfSupplyDate || input.ordinaryRegimeSource !== "governed_rule47_ordinary_regime_record" || !SHA256.test(input.ordinaryRegimeEvidenceSha256) || !SHA256.test(input.supplierRegistrationStatusEvidenceHash) || !SHA256.test(input.timeOfSupplyEvidenceHash)) throw new IndiaGstRegistrationAtTimeOfSupplyValidationError("exact status/time-of-supply evidence is invalid");
    const rows = await tx<Row[]>`SELECT status.tenant_id::text AS tenant_id, registration.id::text AS registration_id, registration.property_node::text AS registration_property_node, registration.scheme AS registration_scheme, registration.currency::text AS registration_currency, registration.jurisdiction_extension_id::text AS jurisdiction_extension_id, registration.jurisdiction_owner_tenant_id::text AS jurisdiction_owner_tenant_id, registration.jurisdiction_key, registration.jurisdiction_version::text AS jurisdiction_version, registration.jurisdiction_content_hash, registration.registration_number, registration.region_code, registration.legal_name, registration.trade_name, registration.address_line, registration.locality, registration.postal_code, location.id::text AS location_id, location.supplier_registration_id::text AS location_registration_id, location.supplier_evidence_hash AS location_supplier_evidence_hash, location.service_scope AS location_service_scope, location.registered_place_kind, location.location_basis, location.legal_rule AS location_legal_rule, status.id::text AS status_id, status.supplier_registration_id::text AS status_registration_id, status.supplier_registration_evidence_hash AS status_supplier_evidence_hash, status.status_as_of::text AS status_as_of, status.gst_registration_status, status.gst_taxpayer_type, status.gst_status_source, status.gst_status_evidence_sha256, status.legal_rule AS status_legal_rule, service.id::text AS service_id, payment.id::text AS payment_id, invoice.id::text AS invoice_id, service.property_node::text AS property_node, service.reservation_id::text AS reservation_id, service.service_provision_date::text AS service_date, payment.payment_receipt_date::text AS payment_date, invoice.invoice_issue_date::text AS invoice_date, service.currency::text AS service_currency, payment.currency::text AS payment_currency, invoice.currency::text AS invoice_currency, payment.amount_minor::text AS payment_amount, invoice.amount_minor::text AS invoice_amount, service.service_provision_evidence_sha256 AS service_evidence, payment.payment_receipt_evidence_sha256 AS payment_evidence, invoice.invoice_issue_evidence_sha256 AS invoice_evidence, payment.supplier_books_entry_date::text AS books_date, payment.supplier_bank_credit_date::text AS bank_date, service.service_provision_source AS service_source, service.legal_rule AS service_rule, payment.payment_receipt_source AS payment_source, payment.legal_rule AS payment_rule, invoice.invoice_issue_source AS invoice_source, invoice.legal_rule AS invoice_rule, invoice.coverage_scope, invoice.invoice_series, invoice.invoice_serial, service.reservation_lineage_id::text AS service_lineage_id, service.hold_binding_id::text AS service_hold_binding_id, service.attribution_id::text AS service_attribution_id, service.segment_id::text AS service_segment_id, service.origin_quote_hash AS service_quote_hash, service.snapshot_hash AS service_snapshot_hash, lineage.id::text AS lineage_id, lineage.property_node::text AS lineage_property_node, lineage.binding_id::text AS lineage_hold_binding_id, lineage.attribution_id::text AS lineage_attribution_id, lineage.reservation_id::text AS lineage_reservation_id, lineage.segment_id::text AS lineage_segment_id, lineage.origin_quote_hash AS lineage_quote_hash, lineage.snapshot_hash AS lineage_snapshot_hash, lineage.currency::text AS lineage_currency, attribution.snapshot AS attribution_snapshot FROM public.india_gst_supplier_registration_status_snapshot AS status JOIN public.india_gst_supplier_service_location AS location ON location.tenant_id = status.tenant_id AND location.supplier_registration_id = status.supplier_registration_id AND location.supplier_evidence_hash = status.supplier_registration_evidence_hash JOIN public.property_fiscal_registration AS registration ON registration.tenant_id = status.tenant_id AND registration.id = status.supplier_registration_id JOIN public.org_node AS property ON property.tenant_id = registration.tenant_id AND property.id = registration.property_node AND property.kind = 'property' JOIN public.india_gst_accommodation_service_provision_snapshot AS service ON service.tenant_id = status.tenant_id JOIN public.india_gst_accommodation_payment_receipt_snapshot AS payment ON payment.tenant_id = service.tenant_id AND payment.service_provision_snapshot_id = service.id JOIN public.india_gst_accommodation_invoice_issue_snapshot AS invoice ON invoice.tenant_id = service.tenant_id AND invoice.service_provision_snapshot_id = service.id JOIN public.tax_attribution_reservation_binding AS lineage ON lineage.tenant_id = service.tenant_id AND lineage.id = service.reservation_lineage_id JOIN public.tax_attribution_snapshot AS attribution ON attribution.tenant_id = service.tenant_id AND attribution.id = service.attribution_id WHERE status.tenant_id = ${tenant}::uuid AND status.tenant_id = current_setting('app.tenant_id', true)::uuid AND location.id = ${input.supplierServiceLocationId}::uuid AND status.id = ${input.supplierGstRegistrationStatusId}::uuid AND status.status_as_of = ${input.statusAsOf}::date AND ${input.statusAsOf}::date = ${input.timeOfSupplyDate}::date AND service.id = ${input.serviceProvisionSnapshotId}::uuid AND payment.id = ${input.paymentReceiptSnapshotId}::uuid AND invoice.id = ${input.invoiceIssueSnapshotId}::uuid AND service.property_node = ${input.propertyNode}::uuid AND service.reservation_id = ${input.reservationId}::uuid AND service.service_provision_date = ${input.serviceProvisionDate}::date AND payment.payment_receipt_date = ${input.paymentReceiptDate}::date AND invoice.invoice_issue_date = ${input.invoiceIssueDate}::date`;
    if (rows.length === 0) throw new IndiaGstRegistrationAtTimeOfSupplyNotFoundError("selected GST registration-at-time-of-supply evidence is unavailable");
    if (rows.length !== 1 || rows[0] === undefined) throw new IndiaGstRegistrationAtTimeOfSupplyConflictError("selected GST registration-at-time-of-supply evidence is ambiguous");
    return build(rows[0], input);
  }
}

export function resolveIndiaGstRegistrationAtTimeOfSupply(tx: Tx, input: IndiaGstRegistrationAtTimeOfSupplyInput): Promise<IndiaGstRegistrationAtTimeOfSupplyResult> { return new IndiaGstRegistrationAtTimeOfSupplyService().resolve(tx, input); }

function validateNativeInvoiceSource(tenantId: string, raw: IndiaGstAccommodationNativeInvoiceSourceResult): IndiaGstAccommodationNativeInvoiceSourceResult { try { return validateIndiaGstAccommodationNativeInvoiceSourceResult(tenantId, raw); } catch (error) { if (error instanceof IndiaGstAccommodationInvoiceSourceValidationError) throw new IndiaGstRegistrationAtTimeOfSupplyValidationError(error.message); throw error; } }

/** Pure composition only; persisted-root authentication remains in the issuance SQL boundary. */
export function composeIndiaGstRegistrationAtNativeTimeOfSupply(
  raw: IndiaGstRegistrationAtNativeTimeOfSupplyInput,
): IndiaGstRegistrationAtNativeTimeOfSupplyResult {
  deeplyFrozen(raw);
  const input = exact(raw, ["tenantId", "supplierRegistrationStatus", "invoiceSource"], "native supplier registration timing input", IndiaGstRegistrationAtTimeOfSupplyValidationError) as unknown as IndiaGstRegistrationAtNativeTimeOfSupplyInput;
  const tenantId = uuid(input.tenantId, "tenantId", IndiaGstRegistrationAtTimeOfSupplyValidationError);
  const invoiceSource = validateNativeInvoiceSource(tenantId, input.invoiceSource);
  const timing = invoiceSource.timing;
  const status = exact(input.supplierRegistrationStatus, ["supplierRegistrationId", "supplierGstRegistrationStatusId", "supplierServiceLocationId", "propertyNode", "statusAsOf", "supplierServiceLocation", "supplier", "gstRegistration", "supplierRegistrationStatusEvidenceHash", "registrationLegalRule"], "native supplier registration status", IndiaGstRegistrationAtTimeOfSupplyValidationError);
  const registrationId = uuid(status.supplierRegistrationId, "supplier registration id", IndiaGstRegistrationAtTimeOfSupplyValidationError);
  const statusId = uuid(status.supplierGstRegistrationStatusId, "supplier status id", IndiaGstRegistrationAtTimeOfSupplyValidationError);
  const locationId = uuid(status.supplierServiceLocationId, "supplier service-location id", IndiaGstRegistrationAtTimeOfSupplyValidationError);
  const propertyNode = uuid(status.propertyNode, "supplier status property", IndiaGstRegistrationAtTimeOfSupplyValidationError);
  const statusAsOf = date(status.statusAsOf, "supplier statusAsOf", IndiaGstRegistrationAtTimeOfSupplyValidationError);
  const location = exact(status.supplierServiceLocation, ["id", "evidenceHash"], "native supplier service location", IndiaGstRegistrationAtTimeOfSupplyValidationError);
  const supplier = exact(status.supplier, ["registrationId", "evidenceHash"], "native supplier registration", IndiaGstRegistrationAtTimeOfSupplyValidationError);
  const gst = exact(status.gstRegistration, ["status", "taxpayerType", "source", "evidenceSha256"], "native supplier GST status", IndiaGstRegistrationAtTimeOfSupplyValidationError);
  if (location.id !== locationId || supplier.registrationId !== registrationId || propertyNode !== timing.propertyNode || statusAsOf !== timing.timeOfSupplyDate || gst.status !== "active" || gst.source !== "gst_common_portal" || gst.taxpayerType !== "regular" && gst.taxpayerType !== "sez_unit" && gst.taxpayerType !== "sez_developer" || status.registrationLegalRule !== "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS") throw new IndiaGstRegistrationAtTimeOfSupplyValidationError("native supplier registration status conflicts with timing");
  hash(location.evidenceHash, "supplier location evidence hash"); hash(supplier.evidenceHash, "supplier evidence hash"); hash(gst.evidenceSha256, "supplier GST status evidence hash");
  const expectedStatusHash = digest({ tenantId, supplierGstRegistrationStatusId: statusId, propertyNode, supplierServiceLocation: { id: locationId, evidenceHash: location.evidenceHash }, supplier: { registrationId, evidenceHash: supplier.evidenceHash }, statusAsOf, gstRegistration: { status: gst.status, taxpayerType: gst.taxpayerType, source: gst.source, evidenceSha256: gst.evidenceSha256 }, legalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS" });
  if (status.supplierRegistrationStatusEvidenceHash !== expectedStatusHash) throw new IndiaGstRegistrationAtTimeOfSupplyValidationError("native supplier registration status hash is invalid");
  const timeBody = { kind: "native_current_transaction" as const, nativeTiming: timing };
  const timeOfSupplyEvidenceHash = digest(timeBody);
  const timeOfSupply = freeze({ ...timeBody, evidenceHash: timeOfSupplyEvidenceHash });
  const evidence = { kind: "native_current_transaction" as const, supplierRegistrationId: registrationId, supplierGstRegistrationStatusId: statusId, supplierServiceLocationId: locationId, propertyNode, reservationId: timing.reservationId, statusAsOf, timeOfSupplyDate: timing.timeOfSupplyDate, result: "active_at_time_of_supply" as const, supplierServiceLocation: { id: locationId, evidenceHash: location.evidenceHash as string }, supplier: { registrationId, evidenceHash: supplier.evidenceHash as string }, gstRegistration: { status: "active" as const, taxpayerType: gst.taxpayerType as "regular" | "sez_unit" | "sez_developer", source: "gst_common_portal" as const, evidenceSha256: gst.evidenceSha256 as string }, supplierRegistrationStatusEvidenceHash: expectedStatusHash, invoiceSourceEvidenceHash: invoiceSource.evidenceHash, timeOfSupplyEvidenceHash, timeOfSupply, registrationLegalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS" as const, timeOfSupplyLegalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY" as const };
  return freeze({ ...evidence, evidenceHash: digest({ tenantId, ...evidence }) });
}
