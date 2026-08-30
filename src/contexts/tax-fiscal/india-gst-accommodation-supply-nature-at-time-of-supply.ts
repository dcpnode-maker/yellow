import { types as utilTypes } from "node:util";
import type {
  IndiaGstAccommodationSupplyNatureResult,
} from "./india-gst-accommodation-supply-nature";
import type {
  IndiaGstRegistrationAtTimeOfSupplyResult,
} from "./india-gst-registration-at-time-of-supply";
import type {
  IndiaGstRecipientRegistrationAtTimeOfSupplyResult,
} from "./india-gst-recipient-registration-at-time-of-supply";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^(?:[0-9]{4})-(?:[0-9]{2})-(?:[0-9]{2})$/;

const INPUT_KEYS = [
  "tenantId",
  "supplyNature",
  "supplierRegistrationAtTimeOfSupply",
  "recipientRegistrationAtTimeOfSupply",
] as const;
const SUPPLY_KEYS = [
  "propertyNode", "reservationId", "folioId", "supplyDate", "jurisdiction",
  "supplier", "recipient", "buyerAssociation", "classification", "placeOfSupply",
  "registeredStateComparison", "supplyNature", "determinationBasis", "sezDirection",
  "legalRule", "candidateJson", "candidateHash",
] as const;
const SUPPLIER_KEYS = [
  "supplierRegistrationId", "supplierGstRegistrationStatusId", "supplierServiceLocationId",
  "propertyNode", "reservationId", "statusAsOf", "timeOfSupplyDate", "result",
  "supplierServiceLocation", "supplier", "gstRegistration",
  "supplierRegistrationStatusEvidenceHash", "timeOfSupplyEvidenceHash", "timeOfSupply",
  "registrationLegalRule", "timeOfSupplyLegalRule", "evidenceHash",
] as const;
const RECIPIENT_KEYS = [
  "recipientPartyId", "recipientRegistrationId", "recipientSezStatusId", "propertyNode",
  "reservationId", "statusAsOf", "timeOfSupplyDate", "result", "recipient",
  "gstRegistration", "sezStatus", "approval", "recipientRegistrationStatusEvidenceHash",
  "timeOfSupplyEvidenceHash", "timeOfSupply", "recipientRegistrationLegalRule",
  "timeOfSupplyLegalRule", "evidenceHash",
] as const;
const GST_KEYS = ["status", "taxpayerType", "source", "evidenceSha256"] as const;
const REGISTRATION_KEYS = ["registrationId", "evidenceHash"] as const;
const SERVICE_LOCATION_KEYS = ["id", "evidenceHash"] as const;
const TOS_KEYS = [
  "serviceProvisionSnapshotId", "paymentReceiptSnapshotId", "invoiceIssueSnapshotId",
  "propertyNode", "reservationId", "reservationLineage", "attribution",
  "serviceProvisionDate", "paymentReceiptDate", "invoiceIssueDate", "deadlineDate",
  "candidateDates", "branch", "timeOfSupplyDate", "regime", "source", "legalRule",
  "ordinaryRegimeSource", "ordinaryRegimeEvidenceSha256", "invoiceSeries", "invoiceSerial",
  "supplierBooksEntryDate", "supplierBankCreditDate", "coverageScope",
  "serviceProvisionSource", "serviceProvisionLegalRule", "paymentReceiptSource",
  "paymentReceiptLegalRule", "invoiceIssueSource", "invoiceIssueLegalRule",
  "serviceProvisionEvidenceSha256", "paymentReceiptEvidenceSha256",
  "invoiceIssueEvidenceSha256", "amountMinor", "currency", "evidenceHash",
] as const;
const LINEAGE_KEYS = [
  "lineageId", "holdBindingId", "attributionId", "reservationId", "segmentId",
  "originQuoteHash", "snapshotHash", "currency",
] as const;
const ATTRIBUTION_KEYS = ["originKind", "lineId", "revenueGroup"] as const;
const CANDIDATE_DATES_A = ["invoiceIssueDate", "paymentReceiptDate"] as const;
const CANDIDATE_DATES_B = ["serviceProvisionDate", "paymentReceiptDate"] as const;

type RecordValue = Record<string, unknown>;
type Input = {
  readonly tenantId: string;
  readonly supplyNature: IndiaGstAccommodationSupplyNatureResult;
  readonly supplierRegistrationAtTimeOfSupply: IndiaGstRegistrationAtTimeOfSupplyResult;
  readonly recipientRegistrationAtTimeOfSupply: IndiaGstRecipientRegistrationAtTimeOfSupplyResult;
};

export interface IndiaGstAccommodationSupplyNatureAtTimeOfSupplyInput extends Input {}

export interface IndiaGstAccommodationSupplyNatureAtTimeOfSupplyResult {
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly supplyDate: string;
  readonly supplyNature: "intra_state" | "inter_state";
  readonly determinationBasis: "ordinary_registered_state_comparison" | "sez_override";
  readonly sezDirection: "none" | "to_sez" | "by_sez" | "to_and_by_sez";
  readonly legalRule: "IGST_ACT_8_2" | "IGST_ACT_7_3" | "IGST_ACT_7_5_B";
  readonly supplierRegistrationId: string;
  readonly supplierGstRegistrationStatusId: string;
  readonly supplierServiceLocationId: string;
  readonly supplierRegistrationStatusEvidenceHash: string;
  readonly recipientPartyId: string;
  readonly recipientRegistrationId: string;
  readonly recipientSezStatusId: string;
  readonly recipientRegistrationStatusEvidenceHash: string;
  readonly timeOfSupplyDate: string;
  readonly timeOfSupplyEvidenceHash: string;
  readonly result: "supply_nature_and_registrations_bound_at_time_of_supply";
  readonly evidenceHash: string;
}

export class IndiaGstAccommodationSupplyNatureAtTimeOfSupplyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationSupplyNatureAtTimeOfSupplyValidationError";
  }
}
export class IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError";
  }
}

function fail(message: string): never {
  throw new IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError(message);
}

function exactRecord(value: unknown, keys: readonly string[], subject: string): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    return fail(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) => descriptor.get !== undefined ||
        descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor))) {
    return fail(`${subject} shape is invalid`);
  }
  return value as RecordValue;
}

function rootRecord(value: unknown, keys: readonly string[], subject: string): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    return fail(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) => descriptor.get !== undefined ||
        descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor))) {
    if (actual.includes("surplus")) return fail(`${subject} contains surplus evidence`);
    return fail(`${subject} shape is invalid`);
  }
  return value as RecordValue;
}

function exactInput(value: unknown): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new IndiaGstAccommodationSupplyNatureAtTimeOfSupplyValidationError(
      "accommodation supply nature timing input must be an exact plain object",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...INPUT_KEYS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) => descriptor.get !== undefined ||
        descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor))) {
    throw new IndiaGstAccommodationSupplyNatureAtTimeOfSupplyValidationError(
      "accommodation supply nature timing input shape is invalid",
    );
  }
  return value as RecordValue;
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) return fail(`${subject} is invalid`);
  return value;
}
function hash(value: unknown, subject: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) return fail(`${subject} is invalid`);
  return value;
}
function date(value: unknown, subject: string): string {
  if (typeof value !== "string" || !DATE.test(value)) return fail(`${subject} is invalid`);
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > (days[month - 1] ?? 0)) {
    return fail(`${subject} is invalid`);
  }
  return value;
}
function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}
function add30(value: string): string {
  const parts = value.split("-").map(Number);
  let year = parts[0] ?? 0, month = parts[1] ?? 0, day = parts[2] ?? 0;
  for (let count = 0; count < 30; count += 1) {
    day += 1;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day > (days[month - 1] ?? 0)) { day = 1; month += 1; if (month > 12) { month = 1; year += 1; } }
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function assertFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) {
    return fail("predecessor evidence is not recursively frozen");
  }
  for (const key of Reflect.ownKeys(value)) assertFrozen((value as Record<PropertyKey, unknown>)[key], seen);
}
function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
function equalTimeOfSupply(left: RecordValue, right: RecordValue): boolean {
  const keys = TOS_KEYS.filter((key) => key !== "evidenceHash");
  return equalJson(
    Object.fromEntries(keys.map((key) => [key, left[key]])),
    Object.fromEntries(keys.map((key) => [key, right[key]])),
  );
}

function validateSupplyNature(value: unknown, tenantId: string): IndiaGstAccommodationSupplyNatureResult {
  const root = rootRecord(value, SUPPLY_KEYS, "Order287 supply-nature evidence");
  const propertyNode = uuid(root.propertyNode, "supply-nature propertyNode");
  const reservationId = uuid(root.reservationId, "supply-nature reservationId");
  const folioId = uuid(root.folioId, "supply-nature folioId");
  const supplyDate = date(root.supplyDate, "supply-nature supplyDate");
  const jurisdiction = exactRecord(root.jurisdiction, ["extensionId", "ownerTenantId", "key", "version", "contentHash"], "supply-nature jurisdiction");
  uuid(jurisdiction.extensionId, "supply-nature extensionId");
  if (jurisdiction.ownerTenantId !== null) uuid(jurisdiction.ownerTenantId, "supply-nature ownerTenantId");
  hash(jurisdiction.contentHash, "supply-nature contentHash");
  if (typeof jurisdiction.key !== "string" || !/^[a-z0-9][a-z0-9_.:-]{0,127}$/.test(jurisdiction.key) ||
      typeof jurisdiction.version !== "string" || !/^[1-9][0-9]*$/.test(jurisdiction.version)) return fail("supply-nature jurisdiction is invalid");
  const supplier = exactRecord(root.supplier, ["registrationId", "evidenceHash", "stateCode", "serviceLocation", "status"], "supply-nature supplier");
  const supplierLocation = exactRecord(supplier.serviceLocation, ["id", "evidenceHash", "kind", "stateCode"], "supply-nature service location");
  const supplierStatus = exactRecord(supplier.status, ["id", "evidenceHash", "statusAsOf", "taxpayerType", "sezStatus"], "supply-nature supplier status");
  const recipient = exactRecord(root.recipient, ["partyId", "registrationId", "evidenceHash", "status"], "supply-nature recipient");
  const recipientStatus = exactRecord(recipient.status, ["id", "evidenceHash", "statusAsOf", "taxpayerType", "sezStatus"], "supply-nature recipient status");
  const buyerAssociation = exactRecord(root.buyerAssociation, ["associationHash", "payloadHash"], "supply-nature buyer association");
  const classification = exactRecord(root.classification, ["classificationId", "evidenceHash"], "supply-nature classification");
  const place = exactRecord(root.placeOfSupply, ["candidateHash", "legalRule", "pos"], "supply-nature place of supply");
  const comparison = exactRecord(root.registeredStateComparison, ["candidateHash", "comparisonRule", "stateRelationship"], "supply-nature comparison");
  for (const [v, s] of [[supplier.evidenceHash, "supplier evidenceHash"], [supplierLocation.evidenceHash, "service location hash"], [supplierStatus.evidenceHash, "supplier status hash"], [recipient.evidenceHash, "recipient evidenceHash"], [recipientStatus.evidenceHash, "recipient status hash"], [buyerAssociation.associationHash, "association hash"], [buyerAssociation.payloadHash, "association payload hash"], [classification.evidenceHash, "classification hash"], [place.candidateHash, "place candidate hash"], [comparison.candidateHash, "comparison candidate hash"]] as const) hash(v, s);
  for (const [v, s] of [[supplierLocation.stateCode, "service location state"], [supplier.stateCode, "supplier state"], [place.pos, "place state"]] as const) if (typeof v !== "string" || !/^(?:01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|26|27|29|30|31|32|33|34|35|36|37|38)$/.test(v)) return fail(`${s} is invalid`);
  uuid(supplier.registrationId, "supplier registrationId"); uuid(supplierLocation.id, "service location id"); uuid(supplierStatus.id, "supplier status id"); uuid(recipient.partyId, "recipient partyId"); uuid(recipient.registrationId, "recipient registrationId"); uuid(recipientStatus.id, "recipient status id");
  date(supplierStatus.statusAsOf, "supplier status date"); date(recipientStatus.statusAsOf, "recipient status date");
  if (supplierStatus.statusAsOf !== supplyDate || recipientStatus.statusAsOf !== supplyDate || supplierLocation.stateCode !== supplier.stateCode ||
      place.legalRule !== "IGST_ACT_12_3_B" || comparison.comparisonRule !== "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS" ||
      (comparison.stateRelationship !== "same_state_or_union_territory" && comparison.stateRelationship !== "different_state_or_union_territory") ||
      typeof root.candidateJson !== "string" || root.candidateJson !== JSON.stringify(Object.fromEntries(SUPPLY_KEYS.slice(0, 15).map((key) => [key, root[key]])))) return fail("Order287 supply-nature envelope is inconsistent");
  const statusValues = [supplierStatus, recipientStatus] as const;
  for (const status of statusValues) {
    if ((status.taxpayerType !== "regular" && status.taxpayerType !== "sez_unit" && status.taxpayerType !== "sez_developer") ||
        (status.sezStatus !== "affirmatively_non_sez_regular" && status.sezStatus !== "sez_unit" && status.sezStatus !== "sez_developer") ||
        (status.taxpayerType === "regular") !== (status.sezStatus === "affirmatively_non_sez_regular") ||
        (status.taxpayerType !== "regular" && status.taxpayerType !== status.sezStatus)) return fail("supply-nature status semantics are invalid");
  }
  const supplierIsSez = supplierStatus.sezStatus !== "affirmatively_non_sez_regular";
  const recipientIsSez = recipientStatus.sezStatus !== "affirmatively_non_sez_regular";
  const expectedNature = supplierIsSez || recipientIsSez || comparison.stateRelationship === "different_state_or_union_territory" ? "inter_state" : "intra_state";
  const expectedBasis = supplierIsSez || recipientIsSez ? "sez_override" : "ordinary_registered_state_comparison";
  const expectedDirection = supplierIsSez && recipientIsSez ? "to_and_by_sez" : recipientIsSez ? "to_sez" : supplierIsSez ? "by_sez" : "none";
  const expectedRule = supplierIsSez || recipientIsSez ? "IGST_ACT_7_5_B" : comparison.stateRelationship === "same_state_or_union_territory" ? "IGST_ACT_8_2" : "IGST_ACT_7_3";
  if (root.supplyNature !== expectedNature || root.determinationBasis !== expectedBasis || root.sezDirection !== expectedDirection || root.legalRule !== expectedRule) return fail("supply-nature statutory precedence is inconsistent");
  const candidate = Object.fromEntries(SUPPLY_KEYS.slice(0, 15).map((key) => [key, root[key]]));
  if (root.candidateHash !== digest({ tenantId, candidate })) return fail("Order287 supply-nature candidate hash is inconsistent");
  assertFrozen(root);
  return root as unknown as IndiaGstAccommodationSupplyNatureResult;
}

function validateGst(value: unknown, subject: string): void {
  const gst = exactRecord(value, GST_KEYS, subject);
  if (gst.status !== "active" || gst.source !== "gst_common_portal" ||
      (gst.taxpayerType !== "regular" && gst.taxpayerType !== "sez_unit" && gst.taxpayerType !== "sez_developer")) return fail(`${subject} is invalid`);
  hash(gst.evidenceSha256, `${subject} evidence hash`);
}

function validateTimeOfSupply(value: unknown, subject: string, tenantId: string): RecordValue {
  const time = exactRecord(value, TOS_KEYS, subject);
  for (const key of ["serviceProvisionSnapshotId", "paymentReceiptSnapshotId", "invoiceIssueSnapshotId", "propertyNode", "reservationId"] as const) uuid(time[key], `${subject} ${key}`);
  for (const key of ["serviceProvisionDate", "paymentReceiptDate", "invoiceIssueDate", "deadlineDate", "timeOfSupplyDate", "supplierBooksEntryDate", "supplierBankCreditDate"] as const) date(time[key], `${subject} ${key}`);
  for (const key of ["ordinaryRegimeEvidenceSha256", "serviceProvisionEvidenceSha256", "paymentReceiptEvidenceSha256", "invoiceIssueEvidenceSha256"] as const) hash(time[key], `${subject} ${key}`);
  if (typeof time.invoiceSeries !== "string" || typeof time.invoiceSerial !== "string" || typeof time.amountMinor !== "string" || !/^[1-9][0-9]*$/.test(time.amountMinor) || typeof time.currency !== "string" || !/^[A-Z]{3}$/.test(time.currency)) return fail(`${subject} money/identity fields are invalid`);
  const lineageEvidence = exactRecord(time.reservationLineage, LINEAGE_KEYS, `${subject} reservation lineage`);
  for (const key of ["lineageId", "holdBindingId", "attributionId", "reservationId"] as const) uuid(lineageEvidence[key], `${subject} lineage ${key}`);
  for (const key of ["originQuoteHash", "snapshotHash"] as const) hash(lineageEvidence[key], `${subject} lineage ${key}`);
  if (lineageEvidence.currency !== time.currency) return fail(`${subject} lineage currency conflicts`);
  const attribution = exactRecord(time.attribution, ATTRIBUTION_KEYS, `${subject} attribution`);
  if (attribution.originKind !== "rate_quote" || attribution.lineId !== "room" || attribution.revenueGroup !== "room_revenue") return fail(`${subject} attribution is invalid`);
  const candidateKeys = time.branch === "section13_2_a_invoice_or_payment" ? CANDIDATE_DATES_A : time.branch === "section13_2_b_service_or_payment" ? CANDIDATE_DATES_B : null;
  if (candidateKeys === null) return fail(`${subject} branch is invalid`);
  const candidates = exactRecord(time.candidateDates, candidateKeys, `${subject} candidate dates`);
  const serviceProvisionDate = time.serviceProvisionDate as string;
  const paymentReceiptDate = time.paymentReceiptDate as string;
  const invoiceIssueDate = time.invoiceIssueDate as string;
  const booksDate = time.supplierBooksEntryDate as string;
  const bankDate = time.supplierBankCreditDate as string;
  const lineage = time.reservationLineage as RecordValue;
  const deadlineDate = add30(serviceProvisionDate);
  const timely = invoiceIssueDate <= deadlineDate;
  const chosenDate = timely
    ? (invoiceIssueDate < paymentReceiptDate ? invoiceIssueDate : paymentReceiptDate)
    : (serviceProvisionDate < paymentReceiptDate ? serviceProvisionDate : paymentReceiptDate);
  const expectedCandidates = timely
    ? { invoiceIssueDate, paymentReceiptDate }
    : { serviceProvisionDate, paymentReceiptDate };
  if (time.deadlineDate !== deadlineDate || (timely && time.branch !== "section13_2_a_invoice_or_payment") || (!timely && time.branch !== "section13_2_b_service_or_payment") || !equalJson(candidates, expectedCandidates) || time.timeOfSupplyDate !== chosenDate || paymentReceiptDate !== (booksDate < bankDate ? booksDate : bankDate) || lineage.reservationId !== time.reservationId ||
      time.serviceProvisionSource !== "governed_service_provision_record" || time.serviceProvisionLegalRule !== "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" || time.paymentReceiptSource !== "governed_supplier_payment_receipt_record" || time.paymentReceiptLegalRule !== "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY" || time.invoiceIssueSource !== "governed_supplier_tax_invoice_record" || time.invoiceIssueLegalRule !== "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY" ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(time.invoiceSeries as string) || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(time.invoiceSerial as string)) return fail(`${subject} date and ordinary-regime semantics are inconsistent`);
  const body = Object.fromEntries(TOS_KEYS.slice(0, -1).map((key) => [key, time[key]]));
  const bodyHash = digest(body);
  const tenantBodyHash = digest({ tenantId, ...body });
  if (time.regime !== "ordinary_rule47_30_day" || time.source !== "governed_rule47_ordinary_regime_record" || time.ordinaryRegimeSource !== time.source || time.legalRule !== "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY" || time.coverageScope !== "full_attribution" || (time.evidenceHash !== bodyHash && time.evidenceHash !== tenantBodyHash)) return fail(`${subject} envelope is inconsistent`);
  return time;
}

function validateSupplier(value: unknown, tenantId: string): IndiaGstRegistrationAtTimeOfSupplyResult {
  const root = rootRecord(value, SUPPLIER_KEYS, "Order295 supplier timing evidence");
  const propertyNode = uuid(root.propertyNode, "supplier timing propertyNode");
  const reservationId = uuid(root.reservationId, "supplier timing reservationId");
  const statusAsOf = date(root.statusAsOf, "supplier timing statusAsOf");
  const timeDate = date(root.timeOfSupplyDate, "supplier timing timeOfSupplyDate");
  if (root.result !== "active_at_time_of_supply" || statusAsOf !== timeDate || root.registrationLegalRule !== "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS" || root.timeOfSupplyLegalRule !== "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY") return fail("Order295 supplier timing identity is invalid");
  const location = exactRecord(root.supplierServiceLocation, SERVICE_LOCATION_KEYS, "supplier timing service location");
  const supplier = exactRecord(root.supplier, REGISTRATION_KEYS, "supplier timing supplier");
  uuid(root.supplierRegistrationId, "supplier timing registration id"); uuid(root.supplierGstRegistrationStatusId, "supplier timing status id"); uuid(root.supplierServiceLocationId, "supplier timing service location id");
  if (location.id !== root.supplierServiceLocationId || supplier.registrationId !== root.supplierRegistrationId) return fail("Order295 supplier timing identity is inconsistent");
  hash(location.evidenceHash, "supplier timing location hash"); hash(supplier.evidenceHash, "supplier timing registration hash"); hash(root.supplierRegistrationStatusEvidenceHash, "supplier timing status hash"); hash(root.timeOfSupplyEvidenceHash, "supplier timing time hash");
  validateGst(root.gstRegistration, "supplier timing GST registration");
  const time = validateTimeOfSupply(root.timeOfSupply, "Order295 time-of-supply", tenantId);
  if (time.propertyNode !== propertyNode || time.reservationId !== reservationId || time.timeOfSupplyDate !== timeDate || root.timeOfSupplyEvidenceHash !== time.evidenceHash || root.evidenceHash !== digest(Object.fromEntries(SUPPLIER_KEYS.slice(0, -1).map((key) => [key, root[key]])))) return fail("Order295 supplier timing envelope is inconsistent");
  assertFrozen(root);
  return root as unknown as IndiaGstRegistrationAtTimeOfSupplyResult;
}

function validateRecipient(value: unknown, tenantId: string): IndiaGstRecipientRegistrationAtTimeOfSupplyResult {
  const root = rootRecord(value, RECIPIENT_KEYS, "Order296 recipient timing evidence");
  const propertyNode = uuid(root.propertyNode, "recipient timing propertyNode");
  const reservationId = uuid(root.reservationId, "recipient timing reservationId");
  const statusAsOf = date(root.statusAsOf, "recipient timing statusAsOf");
  const timeDate = date(root.timeOfSupplyDate, "recipient timing timeOfSupplyDate");
  if (root.result !== "active_recipient_registration_at_time_of_supply" || statusAsOf !== timeDate || root.recipientRegistrationLegalRule !== "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS" || root.timeOfSupplyLegalRule !== "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY") return fail("Order296 recipient timing identity is invalid");
  const recipient = exactRecord(root.recipient, REGISTRATION_KEYS, "recipient timing recipient");
  uuid(root.recipientPartyId, "recipient timing party id"); uuid(root.recipientRegistrationId, "recipient timing registration id"); uuid(root.recipientSezStatusId, "recipient timing status id");
  if (recipient.registrationId !== root.recipientRegistrationId) return fail("Order296 recipient timing registration is inconsistent");
  hash(recipient.evidenceHash, "recipient timing registration hash"); hash(root.recipientRegistrationStatusEvidenceHash, "recipient timing status hash"); hash(root.timeOfSupplyEvidenceHash, "recipient timing time hash");
  validateGst(root.gstRegistration, "recipient timing GST registration");
  if (root.sezStatus !== "affirmatively_non_sez_regular" && root.sezStatus !== "sez_unit" && root.sezStatus !== "sez_developer") return fail("recipient timing SEZ status is invalid");
  if (root.approval !== null) exactRecord(root.approval, ["form", "reference", "validity", "status", "evidenceSha256"], "recipient timing SEZ approval");
  const time = validateTimeOfSupply(root.timeOfSupply, "Order296 time-of-supply", tenantId);
  if (time.propertyNode !== propertyNode || time.reservationId !== reservationId || time.timeOfSupplyDate !== timeDate || root.timeOfSupplyEvidenceHash !== time.evidenceHash || root.evidenceHash !== digest(Object.fromEntries(RECIPIENT_KEYS.slice(0, -1).map((key) => [key, root[key]])))) return fail("Order296 recipient timing envelope is inconsistent");
  assertFrozen(root);
  return root as unknown as IndiaGstRecipientRegistrationAtTimeOfSupplyResult;
}

export function composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(
  rawInput: IndiaGstAccommodationSupplyNatureAtTimeOfSupplyInput,
): IndiaGstAccommodationSupplyNatureAtTimeOfSupplyResult {
  const input = exactInput(rawInput) as unknown as Input;
  const tenantId = uuid(input.tenantId, "tenantId");
  const nature = validateSupplyNature(input.supplyNature, tenantId);
  const supplier = validateSupplier(input.supplierRegistrationAtTimeOfSupply, tenantId);
  const recipient = validateRecipient(input.recipientRegistrationAtTimeOfSupply, tenantId);
  if (nature.propertyNode !== supplier.propertyNode || nature.propertyNode !== recipient.propertyNode || nature.reservationId !== supplier.reservationId || nature.reservationId !== recipient.reservationId ||
      nature.supplyDate !== supplier.statusAsOf || nature.supplyDate !== recipient.statusAsOf || nature.supplyDate !== supplier.timeOfSupplyDate || nature.supplyDate !== recipient.timeOfSupplyDate ||
      nature.supplier.registrationId !== supplier.supplier.registrationId || nature.supplier.evidenceHash !== supplier.supplier.evidenceHash || nature.supplier.serviceLocation.id !== supplier.supplierServiceLocation.id || nature.supplier.serviceLocation.evidenceHash !== supplier.supplierServiceLocation.evidenceHash || nature.supplier.status.id !== supplier.supplierGstRegistrationStatusId ||
      nature.recipient.partyId !== recipient.recipientPartyId || nature.recipient.registrationId !== recipient.recipientRegistrationId || nature.recipient.evidenceHash !== recipient.recipient.evidenceHash || nature.recipient.status.id !== recipient.recipientSezStatusId ||
      supplier.timeOfSupplyEvidenceHash !== recipient.timeOfSupplyEvidenceHash || !equalTimeOfSupply(supplier.timeOfSupply as unknown as RecordValue, recipient.timeOfSupply as unknown as RecordValue)) return fail("approved roots do not describe one transaction at one time of supply");
  const body = Object.freeze({ propertyNode: nature.propertyNode, reservationId: nature.reservationId, folioId: nature.folioId, supplyDate: nature.supplyDate, supplyNature: nature.supplyNature, determinationBasis: nature.determinationBasis, sezDirection: nature.sezDirection, legalRule: nature.legalRule, supplierRegistrationId: supplier.supplierRegistrationId, supplierGstRegistrationStatusId: supplier.supplierGstRegistrationStatusId, supplierServiceLocationId: supplier.supplierServiceLocationId, supplierRegistrationStatusEvidenceHash: supplier.supplierRegistrationStatusEvidenceHash, recipientPartyId: recipient.recipientPartyId, recipientRegistrationId: recipient.recipientRegistrationId, recipientSezStatusId: recipient.recipientSezStatusId, recipientRegistrationStatusEvidenceHash: recipient.recipientRegistrationStatusEvidenceHash, timeOfSupplyDate: nature.supplyDate, timeOfSupplyEvidenceHash: supplier.timeOfSupplyEvidenceHash, result: "supply_nature_and_registrations_bound_at_time_of_supply" as const });
  return Object.freeze({ ...body, evidenceHash: digest({ tenantId, ...body }) });
}

export class IndiaGstAccommodationSupplyNatureAtTimeOfSupplyService {
  compose(input: IndiaGstAccommodationSupplyNatureAtTimeOfSupplyInput): IndiaGstAccommodationSupplyNatureAtTimeOfSupplyResult {
    return composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(input);
  }
}

export const buildIndiaGstAccommodationSupplyNatureAtTimeOfSupply = composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply;
