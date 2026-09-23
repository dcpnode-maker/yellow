import { types as utilTypes } from "node:util";

import type {
  IndiaGstAccommodationRegisteredStateComparisonResult,
} from "./india-gst-accommodation-registered-state-comparison";
import type {
  IndiaGstRecipientSezStatusResult,
} from "./india-gst-recipient-sez-status";
import type {
  IndiaGstSupplierServiceLocationResult,
} from "./india-gst-supplier-service-location";
import type {
  IndiaGstSupplierSezStatusResult,
} from "./india-gst-supplier-sez-status";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const PIN = /^[1-9][0-9]{5}$/;
const JURISDICTION_KEY = /^[a-z0-9][a-z0-9_.:-]{0,127}$/;
const GST_STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
  "33", "34", "35", "36", "37", "38",
]);

const INPUT_KEYS = [
  "tenantId",
  "supplyDate",
  "registeredStateComparison",
  "supplierServiceLocation",
  "recipientSezStatus",
  "supplierSezStatus",
] as const;
const COMPARISON_KEYS = [
  "propertyNode", "reservationId", "folioId", "jurisdiction", "supplier",
  "recipient", "buyerAssociation", "classification", "placeOfSupply",
  "comparisonRule", "stateRelationship", "candidateJson", "candidateHash",
] as const;
const JURISDICTION_KEYS = [
  "extensionId", "ownerTenantId", "key", "version", "contentHash",
] as const;
const COMPARISON_SUPPLIER_KEYS = [
  "registrationId", "evidenceHash", "stateCode",
] as const;
const RECIPIENT_KEYS = ["partyId", "registrationId", "evidenceHash"] as const;
const BUYER_ASSOCIATION_KEYS = ["associationHash", "payloadHash"] as const;
const CLASSIFICATION_KEYS = ["classificationId", "evidenceHash"] as const;
const PLACE_OF_SUPPLY_KEYS = ["candidateHash", "legalRule", "pos"] as const;
const SERVICE_LOCATION_KEYS = [
  "supplierServiceLocationId", "propertyNode", "jurisdiction", "supplier",
  "serviceScope", "registeredPlace", "locationBasis", "legalRule", "evidenceHash",
] as const;
const SERVICE_LOCATION_SUPPLIER_KEYS = ["registrationId", "evidenceHash"] as const;
const REGISTERED_PLACE_KEYS = [
  "kind", "stateCode", "addressLine", "locality", "postalCode",
] as const;
const RECIPIENT_STATUS_KEYS = [
  "recipientSezStatusId", "recipient", "statusAsOf", "gstRegistration",
  "sezStatus", "approval", "legalRule", "evidenceHash",
] as const;
const SUPPLIER_STATUS_KEYS = [
  "supplierSezStatusId", "propertyNode", "supplierServiceLocation", "supplier",
  "statusAsOf", "gstRegistration", "sezStatus", "approval", "legalRule",
  "evidenceHash",
] as const;
const STATUS_SERVICE_LOCATION_KEYS = ["id", "evidenceHash"] as const;
const STATUS_SUPPLIER_KEYS = ["registrationId", "evidenceHash"] as const;
const GST_REGISTRATION_KEYS = [
  "status", "taxpayerType", "source", "evidenceSha256",
] as const;
const APPROVAL_KEYS = [
  "form", "reference", "validity", "status", "evidenceSha256",
] as const;
const VALIDITY_KEYS = ["fromInclusive", "toExclusive"] as const;

type JurisdictionEvidence = Readonly<{
  extensionId: string;
  ownerTenantId: string | null;
  key: string;
  version: string;
  contentHash: string;
}>;

type GstTaxpayerType = "regular" | "sez_unit" | "sez_developer";
type SezStatus = "affirmatively_non_sez_regular" | "sez_unit" | "sez_developer";
type ApprovalForm =
  | "sez_rules_form_g"
  | "sez_rules_form_b"
  | "sez_rules_form_c";
type RegisteredPlaceKind =
  | "principal_place_of_business"
  | "additional_place_of_business";

type GstRegistrationEvidence = Readonly<{
  status: "active";
  taxpayerType: GstTaxpayerType;
  source: "gst_common_portal";
  evidenceSha256: string;
}>;

type ApprovalEvidence = Readonly<{
  form: ApprovalForm;
  reference: string;
  validity: Readonly<{
    fromInclusive: string;
    toExclusive: string;
  }>;
  status: "in_force";
  evidenceSha256: string;
}>;

type ComparisonEvidence = Readonly<{
  propertyNode: string;
  reservationId: string;
  folioId: string;
  jurisdiction: JurisdictionEvidence;
  supplier: Readonly<{
    registrationId: string;
    evidenceHash: string;
    stateCode: string;
  }>;
  recipient: Readonly<{
    partyId: string;
    registrationId: string;
    evidenceHash: string;
  }>;
  buyerAssociation: Readonly<{
    associationHash: string;
    payloadHash: string;
  }>;
  classification: Readonly<{
    classificationId: string;
    evidenceHash: string;
  }>;
  placeOfSupply: Readonly<{
    candidateHash: string;
    legalRule: "IGST_ACT_12_3_B";
    pos: string;
  }>;
  comparisonRule: "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS";
  stateRelationship:
    | "same_state_or_union_territory"
    | "different_state_or_union_territory";
  candidateHash: string;
}>;

type ServiceLocationEvidence = Readonly<{
  supplierServiceLocationId: string;
  propertyNode: string;
  jurisdiction: JurisdictionEvidence;
  supplier: Readonly<{ registrationId: string; evidenceHash: string }>;
  registeredPlace: Readonly<{
    kind: RegisteredPlaceKind;
    stateCode: string;
    addressLine: string;
    locality: string;
    postalCode: string;
  }>;
  evidenceHash: string;
}>;

type RecipientStatusEvidence = Readonly<{
  recipientSezStatusId: string;
  recipient: Readonly<{
    partyId: string;
    registrationId: string;
    evidenceHash: string;
  }>;
  statusAsOf: string;
  gstRegistration: GstRegistrationEvidence;
  sezStatus: SezStatus;
  approval: ApprovalEvidence | null;
  evidenceHash: string;
}>;

type SupplierStatusEvidence = Readonly<{
  supplierSezStatusId: string;
  propertyNode: string;
  supplierServiceLocation: Readonly<{ id: string; evidenceHash: string }>;
  supplier: Readonly<{ registrationId: string; evidenceHash: string }>;
  statusAsOf: string;
  gstRegistration: GstRegistrationEvidence;
  sezStatus: SezStatus;
  approval: ApprovalEvidence | null;
  evidenceHash: string;
}>;

export type IndiaGstAccommodationSupplyNature = "intra_state" | "inter_state";
export type IndiaGstAccommodationSupplyDeterminationBasis =
  | "ordinary_registered_state_comparison"
  | "sez_override";
export type IndiaGstAccommodationSezDirection =
  | "none"
  | "to_sez"
  | "by_sez"
  | "to_and_by_sez";
export type IndiaGstAccommodationSupplyNatureLegalRule =
  | "IGST_ACT_8_2"
  | "IGST_ACT_7_3"
  | "IGST_ACT_7_5_B";

export interface IndiaGstAccommodationSupplyNatureInput {
  readonly tenantId: string;
  readonly supplyDate: string;
  readonly registeredStateComparison: IndiaGstAccommodationRegisteredStateComparisonResult;
  readonly supplierServiceLocation: IndiaGstSupplierServiceLocationResult;
  readonly recipientSezStatus: IndiaGstRecipientSezStatusResult;
  readonly supplierSezStatus: IndiaGstSupplierSezStatusResult;
}

export interface IndiaGstAccommodationSupplyNatureCandidate {
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly supplyDate: string;
  readonly jurisdiction: JurisdictionEvidence;
  readonly supplier: Readonly<{
    registrationId: string;
    evidenceHash: string;
    stateCode: string;
    serviceLocation: Readonly<{
      id: string;
      evidenceHash: string;
      kind: RegisteredPlaceKind;
      stateCode: string;
    }>;
    status: Readonly<{
      id: string;
      evidenceHash: string;
      statusAsOf: string;
      taxpayerType: GstTaxpayerType;
      sezStatus: SezStatus;
    }>;
  }>;
  readonly recipient: Readonly<{
    partyId: string;
    registrationId: string;
    evidenceHash: string;
    status: Readonly<{
      id: string;
      evidenceHash: string;
      statusAsOf: string;
      taxpayerType: GstTaxpayerType;
      sezStatus: SezStatus;
    }>;
  }>;
  readonly buyerAssociation: Readonly<{
    associationHash: string;
    payloadHash: string;
  }>;
  readonly classification: Readonly<{
    classificationId: string;
    evidenceHash: string;
  }>;
  readonly placeOfSupply: Readonly<{
    candidateHash: string;
    legalRule: "IGST_ACT_12_3_B";
    pos: string;
  }>;
  readonly registeredStateComparison: Readonly<{
    candidateHash: string;
    comparisonRule: "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS";
    stateRelationship:
      | "same_state_or_union_territory"
      | "different_state_or_union_territory";
  }>;
  readonly supplyNature: IndiaGstAccommodationSupplyNature;
  readonly determinationBasis: IndiaGstAccommodationSupplyDeterminationBasis;
  readonly sezDirection: IndiaGstAccommodationSezDirection;
  readonly legalRule: IndiaGstAccommodationSupplyNatureLegalRule;
}

export interface IndiaGstAccommodationSupplyNatureResult
  extends IndiaGstAccommodationSupplyNatureCandidate {
  readonly candidateJson: string;
  readonly candidateHash: string;
}

export class IndiaGstAccommodationSupplyNatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationSupplyNatureError";
  }
}

function fail(message: string): never {
  throw new IndiaGstAccommodationSupplyNatureError(message);
}

function exactRecord(
  value: unknown,
  expectedKeys: readonly string[],
  subject: string,
  frozen: boolean,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 ||
      (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null) ||
      (frozen && !Object.isFrozen(value))) {
    return fail(`${subject} must be an exact ${frozen ? "frozen " : ""}plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) =>
        descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || !("value" in descriptor) ||
        (frozen && (descriptor.configurable !== false || descriptor.writable !== false)))) {
    return fail(`${subject} shape is invalid`);
  }
  return value as Record<string, unknown>;
}

function canonicalUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    return fail(`${subject} must be a canonical UUID`);
  }
  return value;
}

function canonicalHash(value: unknown, subject: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    return fail(`${subject} must be a canonical SHA-256`);
  }
  return value;
}

function canonicalDate(value: unknown, subject: string): string {
  if (typeof value !== "string") {
    return fail(`${subject} is invalid`);
  }
  const match = DATE.exec(value);
  if (match === null) {
    return fail(`${subject} is invalid`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maximumDay = daysInMonth[month - 1];
  if (year === 0 || maximumDay === undefined || day === 0 || day > maximumDay) {
    return fail(`${subject} is invalid`);
  }
  return value;
}

function canonicalStateCode(value: unknown, subject: string): string {
  if (typeof value !== "string" || !GST_STATE_CODES.has(value)) {
    return fail(`${subject} is invalid`);
  }
  return value;
}

function canonicalText(value: unknown, subject: string, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength ||
      value !== value.trim() || value !== value.normalize("NFC") ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    return fail(`${subject} is not canonical`);
  }
  return value;
}

function sha256(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function exactJurisdiction(value: unknown, subject: string): JurisdictionEvidence {
  const source = exactRecord(value, JURISDICTION_KEYS, subject, true);
  const extensionId = canonicalUuid(source.extensionId, `${subject} extensionId`);
  const ownerTenantId = source.ownerTenantId === null
    ? null
    : canonicalUuid(source.ownerTenantId, `${subject} ownerTenantId`);
  if (typeof source.key !== "string" || !JURISDICTION_KEY.test(source.key) ||
      typeof source.version !== "string" || !/^[1-9][0-9]*$/.test(source.version)) {
    return fail(`${subject} identity is invalid`);
  }
  const numericVersion = Number(source.version);
  if (!Number.isSafeInteger(numericVersion) || numericVersion <= 0) {
    return fail(`${subject} identity is invalid`);
  }
  return Object.freeze({
    extensionId,
    ownerTenantId,
    key: source.key,
    version: source.version,
    contentHash: canonicalHash(source.contentHash, `${subject} contentHash`),
  });
}

function sameJurisdiction(left: JurisdictionEvidence, right: JurisdictionEvidence): boolean {
  return left.extensionId === right.extensionId &&
    left.ownerTenantId === right.ownerTenantId && left.key === right.key &&
    left.version === right.version && left.contentHash === right.contentHash;
}

function exactLineage(
  value: unknown,
  keys: readonly string[],
  subject: string,
): Record<string, unknown> {
  return exactRecord(value, keys, subject, true);
}

function exactComparison(
  value: unknown,
  tenantId: string,
): ComparisonEvidence {
  const source = exactRecord(
    value,
    COMPARISON_KEYS,
    "registered-state comparison evidence",
    true,
  );
  const propertyNode = canonicalUuid(source.propertyNode, "comparison propertyNode");
  const reservationId = canonicalUuid(source.reservationId, "comparison reservationId");
  const folioId = canonicalUuid(source.folioId, "comparison folioId");
  const jurisdiction = exactJurisdiction(source.jurisdiction, "comparison jurisdiction");

  const supplierSource = exactLineage(
    source.supplier,
    COMPARISON_SUPPLIER_KEYS,
    "comparison supplier",
  );
  const supplier = Object.freeze({
    registrationId: canonicalUuid(supplierSource.registrationId, "supplier registrationId"),
    evidenceHash: canonicalHash(supplierSource.evidenceHash, "supplier evidenceHash"),
    stateCode: canonicalStateCode(supplierSource.stateCode, "supplier stateCode"),
  });
  const recipientSource = exactLineage(source.recipient, RECIPIENT_KEYS, "comparison recipient");
  const recipient = Object.freeze({
    partyId: canonicalUuid(recipientSource.partyId, "recipient partyId"),
    registrationId: canonicalUuid(
      recipientSource.registrationId,
      "recipient registrationId",
    ),
    evidenceHash: canonicalHash(recipientSource.evidenceHash, "recipient evidenceHash"),
  });
  const buyerSource = exactLineage(
    source.buyerAssociation,
    BUYER_ASSOCIATION_KEYS,
    "comparison buyer association",
  );
  const buyerAssociation = Object.freeze({
    associationHash: canonicalHash(buyerSource.associationHash, "buyer associationHash"),
    payloadHash: canonicalHash(buyerSource.payloadHash, "buyer payloadHash"),
  });
  const classificationSource = exactLineage(
    source.classification,
    CLASSIFICATION_KEYS,
    "comparison classification",
  );
  const classification = Object.freeze({
    classificationId: canonicalUuid(
      classificationSource.classificationId,
      "classificationId",
    ),
    evidenceHash: canonicalHash(
      classificationSource.evidenceHash,
      "classification evidenceHash",
    ),
  });
  const posSource = exactLineage(
    source.placeOfSupply,
    PLACE_OF_SUPPLY_KEYS,
    "comparison placeOfSupply",
  );
  if (posSource.legalRule !== "IGST_ACT_12_3_B") {
    return fail("placeOfSupply legalRule is invalid");
  }
  const placeOfSupply = Object.freeze({
    candidateHash: canonicalHash(posSource.candidateHash, "placeOfSupply candidateHash"),
    legalRule: "IGST_ACT_12_3_B" as const,
    pos: canonicalStateCode(posSource.pos, "placeOfSupply pos"),
  });
  if (source.comparisonRule !== "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS" ||
      (source.stateRelationship !== "same_state_or_union_territory" &&
        source.stateRelationship !== "different_state_or_union_territory")) {
    return fail("registered-state comparison semantics are invalid");
  }
  const expectedRelationship = supplier.stateCode === placeOfSupply.pos
    ? "same_state_or_union_territory"
    : "different_state_or_union_territory";
  if (source.stateRelationship !== expectedRelationship) {
    return fail("registered-state comparison relationship is inconsistent");
  }
  const candidate = Object.freeze({
    propertyNode,
    reservationId,
    folioId,
    jurisdiction,
    supplier,
    recipient,
    buyerAssociation,
    classification,
    placeOfSupply,
    comparisonRule: "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS" as const,
    stateRelationship: source.stateRelationship as ComparisonEvidence["stateRelationship"],
  });
  const candidateJson = JSON.stringify(candidate);
  if (source.candidateJson !== candidateJson) {
    return fail("registered-state comparison candidateJson is inconsistent");
  }
  const candidateHash = canonicalHash(source.candidateHash, "comparison candidateHash");
  if (candidateHash !== sha256({ tenantId, candidate })) {
    return fail("registered-state comparison candidateHash is inconsistent");
  }
  return Object.freeze({ ...candidate, candidateHash });
}

function exactServiceLocation(
  value: unknown,
  tenantId: string,
): ServiceLocationEvidence {
  const source = exactRecord(
    value,
    SERVICE_LOCATION_KEYS,
    "supplier service-location evidence",
    true,
  );
  const supplierServiceLocationId = canonicalUuid(
    source.supplierServiceLocationId,
    "supplierServiceLocationId",
  );
  const propertyNode = canonicalUuid(source.propertyNode, "service-location propertyNode");
  const jurisdiction = exactJurisdiction(source.jurisdiction, "service-location jurisdiction");
  const supplierSource = exactLineage(
    source.supplier,
    SERVICE_LOCATION_SUPPLIER_KEYS,
    "service-location supplier",
  );
  const supplier = Object.freeze({
    registrationId: canonicalUuid(supplierSource.registrationId, "supplier registrationId"),
    evidenceHash: canonicalHash(supplierSource.evidenceHash, "supplier evidenceHash"),
  });
  const placeSource = exactLineage(
    source.registeredPlace,
    REGISTERED_PLACE_KEYS,
    "supplier registered place",
  );
  if (placeSource.kind !== "principal_place_of_business" &&
      placeSource.kind !== "additional_place_of_business") {
    return fail("supplier registered-place kind is invalid");
  }
  const registeredPlace = Object.freeze({
    kind: placeSource.kind as RegisteredPlaceKind,
    stateCode: canonicalStateCode(placeSource.stateCode, "registered-place stateCode"),
    addressLine: canonicalText(placeSource.addressLine, "registered-place addressLine", 300),
    locality: canonicalText(placeSource.locality, "registered-place locality", 120),
    postalCode: (() => {
      if (typeof placeSource.postalCode !== "string" || !PIN.test(placeSource.postalCode)) {
        return fail("registered-place postalCode is invalid");
      }
      return placeSource.postalCode;
    })(),
  });
  if (source.serviceScope !== "lodging_accommodation" ||
      source.locationBasis !== "supply_made_from_registered_place_of_business" ||
      source.legalRule !== "IGST_ACT_2_15_A") {
    return fail("supplier service-location semantics are invalid");
  }
  const evidence = Object.freeze({
    tenantId,
    supplierServiceLocationId,
    propertyNode,
    jurisdiction,
    supplier,
    serviceScope: "lodging_accommodation" as const,
    registeredPlace,
    locationBasis: "supply_made_from_registered_place_of_business" as const,
    legalRule: "IGST_ACT_2_15_A" as const,
  });
  const evidenceHash = canonicalHash(source.evidenceHash, "service-location evidenceHash");
  if (evidenceHash !== sha256(evidence)) {
    return fail("supplier service-location evidenceHash is inconsistent");
  }
  return Object.freeze({
    supplierServiceLocationId,
    propertyNode,
    jurisdiction,
    supplier,
    registeredPlace,
    evidenceHash,
  });
}

function exactGstRegistration(value: unknown, subject: string): GstRegistrationEvidence {
  const source = exactRecord(value, GST_REGISTRATION_KEYS, subject, true);
  if (source.status !== "active" || source.source !== "gst_common_portal" ||
      (source.taxpayerType !== "regular" && source.taxpayerType !== "sez_unit" &&
        source.taxpayerType !== "sez_developer")) {
    return fail(`${subject} semantics are invalid`);
  }
  return Object.freeze({
    status: "active" as const,
    taxpayerType: source.taxpayerType as GstTaxpayerType,
    source: "gst_common_portal" as const,
    evidenceSha256: canonicalHash(source.evidenceSha256, `${subject} evidenceSha256`),
  });
}

function exactApproval(
  value: unknown,
  taxpayerType: GstTaxpayerType,
  statusAsOf: string,
  subject: string,
): ApprovalEvidence | null {
  if (taxpayerType === "regular") {
    if (value !== null) {
      return fail(`${subject} must be absent for a regular registration`);
    }
    return null;
  }
  const source = exactRecord(value, APPROVAL_KEYS, subject, true);
  const form = source.form;
  if ((taxpayerType === "sez_unit" && form !== "sez_rules_form_g") ||
      (taxpayerType === "sez_developer" && form !== "sez_rules_form_b" &&
        form !== "sez_rules_form_c") || source.status !== "in_force") {
    return fail(`${subject} semantics are invalid`);
  }
  const validitySource = exactRecord(
    source.validity,
    VALIDITY_KEYS,
    `${subject} validity`,
    true,
  );
  const validity = Object.freeze({
    fromInclusive: canonicalDate(validitySource.fromInclusive, `${subject} validity start`),
    toExclusive: canonicalDate(validitySource.toExclusive, `${subject} validity end`),
  });
  if (validity.fromInclusive >= validity.toExclusive ||
      statusAsOf < validity.fromInclusive || statusAsOf >= validity.toExclusive) {
    return fail(`${subject} validity is inconsistent`);
  }
  return Object.freeze({
    form: form as ApprovalForm,
    reference: canonicalText(source.reference, `${subject} reference`, 128),
    validity,
    status: "in_force" as const,
    evidenceSha256: canonicalHash(source.evidenceSha256, `${subject} evidenceSha256`),
  });
}

function exactSezStatus(
  value: unknown,
  taxpayerType: GstTaxpayerType,
  subject: string,
): SezStatus {
  const expected = taxpayerType === "regular"
    ? "affirmatively_non_sez_regular"
    : taxpayerType;
  if (value !== expected) {
    return fail(`${subject} conflicts with GST taxpayer type`);
  }
  return expected;
}

function exactRecipientStatus(
  value: unknown,
  tenantId: string,
): RecipientStatusEvidence {
  const source = exactRecord(value, RECIPIENT_STATUS_KEYS, "recipient SEZ status", true);
  const recipientSezStatusId = canonicalUuid(
    source.recipientSezStatusId,
    "recipientSezStatusId",
  );
  const recipientSource = exactLineage(source.recipient, RECIPIENT_KEYS, "status recipient");
  const recipient = Object.freeze({
    partyId: canonicalUuid(recipientSource.partyId, "recipient partyId"),
    registrationId: canonicalUuid(
      recipientSource.registrationId,
      "recipient registrationId",
    ),
    evidenceHash: canonicalHash(recipientSource.evidenceHash, "recipient evidenceHash"),
  });
  const statusAsOf = canonicalDate(source.statusAsOf, "recipient statusAsOf");
  const gstRegistration = exactGstRegistration(
    source.gstRegistration,
    "recipient GST registration",
  );
  const sezStatus = exactSezStatus(
    source.sezStatus,
    gstRegistration.taxpayerType,
    "recipient SEZ status",
  );
  const approval = exactApproval(
    source.approval,
    gstRegistration.taxpayerType,
    statusAsOf,
    "recipient approval",
  );
  if (source.legalRule !== "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS") {
    return fail("recipient SEZ status legalRule is invalid");
  }
  const evidence = Object.freeze({
    tenantId,
    recipientSezStatusId,
    recipient,
    statusAsOf,
    gstRegistration,
    sezStatus,
    approval,
    legalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS" as const,
  });
  const evidenceHash = canonicalHash(source.evidenceHash, "recipient status evidenceHash");
  if (evidenceHash !== sha256(evidence)) {
    return fail("recipient SEZ status evidenceHash is inconsistent");
  }
  return Object.freeze({
    recipientSezStatusId,
    recipient,
    statusAsOf,
    gstRegistration,
    sezStatus,
    approval,
    evidenceHash,
  });
}

function exactSupplierStatus(
  value: unknown,
  tenantId: string,
): SupplierStatusEvidence {
  const source = exactRecord(value, SUPPLIER_STATUS_KEYS, "supplier SEZ status", true);
  const supplierSezStatusId = canonicalUuid(source.supplierSezStatusId, "supplierSezStatusId");
  const propertyNode = canonicalUuid(source.propertyNode, "supplier status propertyNode");
  const locationSource = exactLineage(
    source.supplierServiceLocation,
    STATUS_SERVICE_LOCATION_KEYS,
    "supplier status service location",
  );
  const supplierServiceLocation = Object.freeze({
    id: canonicalUuid(locationSource.id, "supplier status service-location id"),
    evidenceHash: canonicalHash(
      locationSource.evidenceHash,
      "supplier status service-location evidenceHash",
    ),
  });
  const supplierSource = exactLineage(
    source.supplier,
    STATUS_SUPPLIER_KEYS,
    "supplier status registration",
  );
  const supplier = Object.freeze({
    registrationId: canonicalUuid(
      supplierSource.registrationId,
      "supplier status registrationId",
    ),
    evidenceHash: canonicalHash(
      supplierSource.evidenceHash,
      "supplier status registration evidenceHash",
    ),
  });
  const statusAsOf = canonicalDate(source.statusAsOf, "supplier statusAsOf");
  const gstRegistration = exactGstRegistration(
    source.gstRegistration,
    "supplier GST registration",
  );
  const sezStatus = exactSezStatus(
    source.sezStatus,
    gstRegistration.taxpayerType,
    "supplier SEZ status",
  );
  const approval = exactApproval(
    source.approval,
    gstRegistration.taxpayerType,
    statusAsOf,
    "supplier approval",
  );
  if (source.legalRule !== "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS") {
    return fail("supplier SEZ status legalRule is invalid");
  }
  const evidence = Object.freeze({
    tenantId,
    supplierSezStatusId,
    propertyNode,
    supplierServiceLocation,
    supplier,
    statusAsOf,
    gstRegistration,
    sezStatus,
    approval,
    legalRule: "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS" as const,
  });
  const evidenceHash = canonicalHash(source.evidenceHash, "supplier status evidenceHash");
  if (evidenceHash !== sha256(evidence)) {
    return fail("supplier SEZ status evidenceHash is inconsistent");
  }
  return Object.freeze({
    supplierSezStatusId,
    propertyNode,
    supplierServiceLocation,
    supplier,
    statusAsOf,
    gstRegistration,
    sezStatus,
    approval,
    evidenceHash,
  });
}

export function buildIndiaGstAccommodationSupplyNature(
  input: IndiaGstAccommodationSupplyNatureInput,
): IndiaGstAccommodationSupplyNatureResult {
  const source = exactRecord(input, INPUT_KEYS, "supply-nature input", false);
  const tenantId = canonicalUuid(source.tenantId, "tenantId");
  const supplyDate = canonicalDate(source.supplyDate, "supplyDate");
  const comparison = exactComparison(source.registeredStateComparison, tenantId);
  const location = exactServiceLocation(source.supplierServiceLocation, tenantId);
  const recipientStatus = exactRecipientStatus(source.recipientSezStatus, tenantId);
  const supplierStatus = exactSupplierStatus(source.supplierSezStatus, tenantId);

  if (comparison.propertyNode !== location.propertyNode ||
      comparison.propertyNode !== supplierStatus.propertyNode ||
      !sameJurisdiction(comparison.jurisdiction, location.jurisdiction) ||
      comparison.supplier.registrationId !== location.supplier.registrationId ||
      comparison.supplier.evidenceHash !== location.supplier.evidenceHash ||
      comparison.supplier.registrationId !== supplierStatus.supplier.registrationId ||
      comparison.supplier.evidenceHash !== supplierStatus.supplier.evidenceHash ||
      location.supplierServiceLocationId !== supplierStatus.supplierServiceLocation.id ||
      location.evidenceHash !== supplierStatus.supplierServiceLocation.evidenceHash ||
      location.registeredPlace.stateCode !== comparison.supplier.stateCode) {
    return fail("supplier lineage conflicts across approved evidence");
  }
  if (comparison.recipient.partyId !== recipientStatus.recipient.partyId ||
      comparison.recipient.registrationId !== recipientStatus.recipient.registrationId ||
      comparison.recipient.evidenceHash !== recipientStatus.recipient.evidenceHash) {
    return fail("recipient lineage conflicts across approved evidence");
  }
  if (recipientStatus.statusAsOf !== supplyDate || supplierStatus.statusAsOf !== supplyDate) {
    return fail("both statusAsOf values must equal supplyDate");
  }

  const recipientIsSez = recipientStatus.sezStatus !== "affirmatively_non_sez_regular";
  const supplierIsSez = supplierStatus.sezStatus !== "affirmatively_non_sez_regular";
  let supplyNature: IndiaGstAccommodationSupplyNature;
  let determinationBasis: IndiaGstAccommodationSupplyDeterminationBasis;
  let sezDirection: IndiaGstAccommodationSezDirection;
  let legalRule: IndiaGstAccommodationSupplyNatureLegalRule;
  if (recipientIsSez || supplierIsSez) {
    supplyNature = "inter_state";
    determinationBasis = "sez_override";
    sezDirection = recipientIsSez && supplierIsSez
      ? "to_and_by_sez"
      : recipientIsSez
        ? "to_sez"
        : "by_sez";
    legalRule = "IGST_ACT_7_5_B";
  } else if (comparison.stateRelationship === "same_state_or_union_territory") {
    supplyNature = "intra_state";
    determinationBasis = "ordinary_registered_state_comparison";
    sezDirection = "none";
    legalRule = "IGST_ACT_8_2";
  } else {
    supplyNature = "inter_state";
    determinationBasis = "ordinary_registered_state_comparison";
    sezDirection = "none";
    legalRule = "IGST_ACT_7_3";
  }

  const candidate: IndiaGstAccommodationSupplyNatureCandidate = Object.freeze({
    propertyNode: comparison.propertyNode,
    reservationId: comparison.reservationId,
    folioId: comparison.folioId,
    supplyDate,
    jurisdiction: comparison.jurisdiction,
    supplier: Object.freeze({
      registrationId: comparison.supplier.registrationId,
      evidenceHash: comparison.supplier.evidenceHash,
      stateCode: comparison.supplier.stateCode,
      serviceLocation: Object.freeze({
        id: location.supplierServiceLocationId,
        evidenceHash: location.evidenceHash,
        kind: location.registeredPlace.kind,
        stateCode: location.registeredPlace.stateCode,
      }),
      status: Object.freeze({
        id: supplierStatus.supplierSezStatusId,
        evidenceHash: supplierStatus.evidenceHash,
        statusAsOf: supplierStatus.statusAsOf,
        taxpayerType: supplierStatus.gstRegistration.taxpayerType,
        sezStatus: supplierStatus.sezStatus,
      }),
    }),
    recipient: Object.freeze({
      partyId: comparison.recipient.partyId,
      registrationId: comparison.recipient.registrationId,
      evidenceHash: comparison.recipient.evidenceHash,
      status: Object.freeze({
        id: recipientStatus.recipientSezStatusId,
        evidenceHash: recipientStatus.evidenceHash,
        statusAsOf: recipientStatus.statusAsOf,
        taxpayerType: recipientStatus.gstRegistration.taxpayerType,
        sezStatus: recipientStatus.sezStatus,
      }),
    }),
    buyerAssociation: comparison.buyerAssociation,
    classification: comparison.classification,
    placeOfSupply: comparison.placeOfSupply,
    registeredStateComparison: Object.freeze({
      candidateHash: comparison.candidateHash,
      comparisonRule: comparison.comparisonRule,
      stateRelationship: comparison.stateRelationship,
    }),
    supplyNature,
    determinationBasis,
    sezDirection,
    legalRule,
  });
  const candidateJson = JSON.stringify(candidate);
  const candidateHash = sha256({ tenantId, candidate });
  return Object.freeze({ ...candidate, candidateJson, candidateHash });
}
