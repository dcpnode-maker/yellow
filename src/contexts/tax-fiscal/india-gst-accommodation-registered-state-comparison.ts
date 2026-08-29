import { types as utilTypes } from "node:util";

import type { IndiaGstSupplierRegistrationResult } from "./india-gst-supplier-registration";
import type { IndiaGstAccommodationPlaceOfSupplyResult } from
  "./india-gst-accommodation-place-of-supply";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;
const PINCODE = /^[1-9][0-9]{5}$/;
const GSTIN = /^([0-9]{2})[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GST_STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
  "33", "34", "35", "36", "37", "38",
]);
const JURISDICTION_KEY = /^[a-z0-9][a-z0-9_.:-]{0,127}$/;

const INPUT_KEYS = ["tenantId", "supplier", "placeOfSupply"] as const;
const SUPPLIER_KEYS = [
  "registrationId", "propertyNode", "scheme", "currency", "jurisdiction",
  "gstin", "stateCode", "legalName", "tradeName", "addressLine", "locality",
  "postalCode", "evidenceHash",
] as const;
const PLACE_OF_SUPPLY_KEYS = [
  "propertyNode", "reservationId", "folioId", "jurisdiction", "supplier",
  "recipient", "buyerAssociation", "classification", "propertyLocation",
  "legalRule", "pos", "candidateJson", "candidateHash",
] as const;
const JURISDICTION_KEYS = [
  "extensionId", "ownerTenantId", "key", "version", "contentHash",
] as const;
const SUPPLIER_LINEAGE_KEYS = ["registrationId", "evidenceHash"] as const;
const RECIPIENT_KEYS = ["partyId", "registrationId", "evidenceHash"] as const;
const BUYER_ASSOCIATION_KEYS = ["associationHash", "payloadHash"] as const;
const CLASSIFICATION_KEYS = ["classificationId", "evidenceHash"] as const;
const PROPERTY_LOCATION_KEYS = ["propertyNode", "evidenceHash"] as const;

const COMPARISON_RULE = "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS" as const;

type Jurisdiction = Readonly<{
  extensionId: string;
  ownerTenantId: string | null;
  key: string;
  version: string;
  contentHash: string;
}>;

export type IndiaGstAccommodationRegisteredStateRelationship =
  | "same_state_or_union_territory"
  | "different_state_or_union_territory";

export interface IndiaGstAccommodationRegisteredStateComparisonInput {
  readonly tenantId: string;
  readonly supplier: IndiaGstSupplierRegistrationResult;
  readonly placeOfSupply: IndiaGstAccommodationPlaceOfSupplyResult;
}

export interface IndiaGstAccommodationRegisteredStateComparisonCandidate {
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly jurisdiction: Jurisdiction;
  readonly supplier: Readonly<{
    registrationId: string;
    evidenceHash: string;
    stateCode: string;
  }>;
  readonly recipient: Readonly<{
    partyId: string;
    registrationId: string;
    evidenceHash: string;
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
  readonly comparisonRule: typeof COMPARISON_RULE;
  readonly stateRelationship: IndiaGstAccommodationRegisteredStateRelationship;
}

export interface IndiaGstAccommodationRegisteredStateComparisonResult
  extends IndiaGstAccommodationRegisteredStateComparisonCandidate {
  readonly candidateJson: string;
  readonly candidateHash: string;
}

export class IndiaGstAccommodationRegisteredStateComparisonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationRegisteredStateComparisonError";
  }
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
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      `${subject} must be an exact ${frozen ? "frozen " : ""}plain object`,
    );
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
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      `${subject} shape is invalid`,
    );
  }
  return value as Record<string, unknown>;
}

function canonicalUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      `${subject} must be a canonical UUID`,
    );
  }
  return value;
}

function canonicalHash(value: unknown, subject: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      `${subject} must be a canonical SHA-256`,
    );
  }
  return value;
}

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function canonicalText(value: unknown, subject: string, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength ||
      value !== value.trim() || value !== value.normalize("NFC") ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      `${subject} is not canonical`,
    );
  }
  return value;
}

function canonicalVersion(value: unknown): string {
  if (typeof value !== "string" || !POSITIVE_INTEGER.test(value)) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      "jurisdiction version is invalid",
    );
  }
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      "jurisdiction version is invalid",
    );
  }
  return value;
}

function canonicalStateCode(value: unknown, subject: string): string {
  if (typeof value !== "string" || !GST_STATE_CODES.has(value)) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      `${subject} is invalid`,
    );
  }
  return value;
}

function gstinChecksum(body: string): string {
  let factor = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const character = body[index];
    if (character === undefined) {
      throw new IndiaGstAccommodationRegisteredStateComparisonError(
        "supplier GSTIN body is invalid",
      );
    }
    const codePoint = GST_ALPHABET.indexOf(character);
    if (codePoint < 0) {
      throw new IndiaGstAccommodationRegisteredStateComparisonError(
        "supplier GSTIN body is invalid",
      );
    }
    const addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(addend / 36) + addend % 36;
  }
  const checksum = GST_ALPHABET[(36 - sum % 36) % 36];
  if (checksum === undefined) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      "supplier GSTIN checksum is invalid",
    );
  }
  return checksum;
}

function canonicalGstin(value: unknown, stateCode: string): string {
  if (typeof value !== "string" || !GSTIN.test(value) ||
      value.slice(0, 2) !== stateCode ||
      gstinChecksum(value.slice(0, 14)) !== value[14]) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      "supplier GSTIN is not canonical",
    );
  }
  return value;
}

function exactJurisdiction(value: unknown, subject: string): Jurisdiction {
  const source = exactRecord(value, JURISDICTION_KEYS, subject, true);
  const extensionId = canonicalUuid(source.extensionId, `${subject} extensionId`);
  const ownerTenantId = source.ownerTenantId === null
    ? null
    : canonicalUuid(source.ownerTenantId, `${subject} ownerTenantId`);
  if (typeof source.key !== "string" || !JURISDICTION_KEY.test(source.key)) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      `${subject} key is invalid`,
    );
  }
  return Object.freeze({
    extensionId,
    ownerTenantId,
    key: source.key,
    version: canonicalVersion(source.version),
    contentHash: canonicalHash(source.contentHash, `${subject} contentHash`),
  });
}

function sameJurisdiction(left: Jurisdiction, right: Jurisdiction): boolean {
  return left.extensionId === right.extensionId &&
    left.ownerTenantId === right.ownerTenantId &&
    left.key === right.key && left.version === right.version &&
    left.contentHash === right.contentHash;
}

function exactSupplier(
  value: unknown,
  tenantId: string,
): Readonly<{
  registrationId: string;
  propertyNode: string;
  jurisdiction: Jurisdiction;
  stateCode: string;
  evidenceHash: string;
}> {
  const source = exactRecord(value, SUPPLIER_KEYS, "supplier evidence", true);
  const registrationId = canonicalUuid(source.registrationId, "supplier registrationId");
  const propertyNode = canonicalUuid(source.propertyNode, "supplier propertyNode");
  if (source.scheme !== "in-gstin" || source.currency !== "INR") {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      "supplier scheme or currency is invalid",
    );
  }
  const jurisdiction = exactJurisdiction(source.jurisdiction, "supplier jurisdiction");
  const stateCode = canonicalStateCode(source.stateCode, "supplier stateCode");
  const gstin = canonicalGstin(source.gstin, stateCode);
  const legalName = canonicalText(source.legalName, "supplier legalName", 200);
  const tradeName = source.tradeName === null
    ? null
    : canonicalText(source.tradeName, "supplier tradeName", 200);
  const addressLine = canonicalText(source.addressLine, "supplier addressLine", 300);
  const locality = canonicalText(source.locality, "supplier locality", 120);
  if (typeof source.postalCode !== "string" || !PINCODE.test(source.postalCode)) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      "supplier postalCode is invalid",
    );
  }
  const expectedHash = sha256(JSON.stringify({
    registrationId,
    tenantId,
    propertyNode,
    scheme: "in-gstin",
    currency: "INR",
    jurisdiction,
    gstin,
    stateCode,
    legalName,
    tradeName,
    addressLine,
    locality,
    postalCode: source.postalCode,
  }));
  const evidenceHash = canonicalHash(source.evidenceHash, "supplier evidenceHash");
  if (evidenceHash !== expectedHash) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      "supplier evidenceHash is inconsistent",
    );
  }
  return Object.freeze({
    registrationId,
    propertyNode,
    jurisdiction,
    stateCode,
    evidenceHash,
  });
}

function exactPlaceOfSupply(
  value: unknown,
  tenantId: string,
): Readonly<{
  propertyNode: string;
  reservationId: string;
  folioId: string;
  jurisdiction: Jurisdiction;
  supplier: Readonly<{ registrationId: string; evidenceHash: string }>;
  recipient: Readonly<{ partyId: string; registrationId: string; evidenceHash: string }>;
  buyerAssociation: Readonly<{ associationHash: string; payloadHash: string }>;
  classification: Readonly<{ classificationId: string; evidenceHash: string }>;
  propertyLocation: Readonly<{ propertyNode: string; evidenceHash: string }>;
  legalRule: "IGST_ACT_12_3_B";
  pos: string;
  candidateHash: string;
}> {
  const source = exactRecord(
    value,
    PLACE_OF_SUPPLY_KEYS,
    "accommodation place-of-supply evidence",
    true,
  );
  const propertyNode = canonicalUuid(source.propertyNode, "place-of-supply propertyNode");
  const reservationId = canonicalUuid(
    source.reservationId,
    "place-of-supply reservationId",
  );
  const folioId = canonicalUuid(source.folioId, "place-of-supply folioId");
  const jurisdiction = exactJurisdiction(
    source.jurisdiction,
    "place-of-supply jurisdiction",
  );

  const supplierSource = exactRecord(
    source.supplier,
    SUPPLIER_LINEAGE_KEYS,
    "place-of-supply supplier lineage",
    true,
  );
  const supplier = Object.freeze({
    registrationId: canonicalUuid(
      supplierSource.registrationId,
      "place-of-supply supplier registrationId",
    ),
    evidenceHash: canonicalHash(
      supplierSource.evidenceHash,
      "place-of-supply supplier evidenceHash",
    ),
  });

  const recipientSource = exactRecord(
    source.recipient,
    RECIPIENT_KEYS,
    "place-of-supply recipient lineage",
    true,
  );
  const recipient = Object.freeze({
    partyId: canonicalUuid(recipientSource.partyId, "recipient partyId"),
    registrationId: canonicalUuid(
      recipientSource.registrationId,
      "recipient registrationId",
    ),
    evidenceHash: canonicalHash(recipientSource.evidenceHash, "recipient evidenceHash"),
  });

  const buyerSource = exactRecord(
    source.buyerAssociation,
    BUYER_ASSOCIATION_KEYS,
    "place-of-supply buyer association",
    true,
  );
  const buyerAssociation = Object.freeze({
    associationHash: canonicalHash(buyerSource.associationHash, "buyer associationHash"),
    payloadHash: canonicalHash(buyerSource.payloadHash, "buyer payloadHash"),
  });

  const classificationSource = exactRecord(
    source.classification,
    CLASSIFICATION_KEYS,
    "place-of-supply classification lineage",
    true,
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

  const locationSource = exactRecord(
    source.propertyLocation,
    PROPERTY_LOCATION_KEYS,
    "place-of-supply property-location lineage",
    true,
  );
  const propertyLocation = Object.freeze({
    propertyNode: canonicalUuid(
      locationSource.propertyNode,
      "property-location propertyNode",
    ),
    evidenceHash: canonicalHash(
      locationSource.evidenceHash,
      "property-location evidenceHash",
    ),
  });
  if (propertyLocation.propertyNode !== propertyNode) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      "property-location lineage conflicts with place-of-supply property",
    );
  }
  if (source.legalRule !== "IGST_ACT_12_3_B") {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      "place-of-supply legal rule is invalid",
    );
  }
  const pos = canonicalStateCode(source.pos, "place-of-supply pos");

  const candidate = Object.freeze({
    propertyNode,
    reservationId,
    folioId,
    jurisdiction,
    supplier,
    recipient,
    buyerAssociation,
    classification,
    propertyLocation,
    legalRule: "IGST_ACT_12_3_B" as const,
    pos,
  });
  const candidateJson = JSON.stringify(candidate);
  if (typeof source.candidateJson !== "string" || source.candidateJson !== candidateJson) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      "place-of-supply candidateJson is inconsistent",
    );
  }
  const candidateHash = canonicalHash(
    source.candidateHash,
    "place-of-supply candidateHash",
  );
  if (candidateHash !== sha256(JSON.stringify({ tenantId, candidate }))) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      "place-of-supply candidateHash is inconsistent",
    );
  }
  return Object.freeze({
    ...candidate,
    candidateHash,
  });
}

export function buildIndiaGstAccommodationRegisteredStateComparison(
  input: IndiaGstAccommodationRegisteredStateComparisonInput,
): IndiaGstAccommodationRegisteredStateComparisonResult {
  const source = exactRecord(input, INPUT_KEYS, "registered-state comparison input", false);
  const tenantId = canonicalUuid(source.tenantId, "tenantId");
  const supplier = exactSupplier(source.supplier, tenantId);
  const placeOfSupply = exactPlaceOfSupply(source.placeOfSupply, tenantId);
  if (supplier.propertyNode !== placeOfSupply.propertyNode ||
      supplier.registrationId !== placeOfSupply.supplier.registrationId ||
      supplier.evidenceHash !== placeOfSupply.supplier.evidenceHash ||
      !sameJurisdiction(supplier.jurisdiction, placeOfSupply.jurisdiction)) {
    throw new IndiaGstAccommodationRegisteredStateComparisonError(
      "supplier evidence conflicts with place-of-supply lineage",
    );
  }

  const stateRelationship: IndiaGstAccommodationRegisteredStateRelationship =
    supplier.stateCode === placeOfSupply.pos
      ? "same_state_or_union_territory"
      : "different_state_or_union_territory";
  const candidate: IndiaGstAccommodationRegisteredStateComparisonCandidate = Object.freeze({
    propertyNode: placeOfSupply.propertyNode,
    reservationId: placeOfSupply.reservationId,
    folioId: placeOfSupply.folioId,
    jurisdiction: supplier.jurisdiction,
    supplier: Object.freeze({
      registrationId: supplier.registrationId,
      evidenceHash: supplier.evidenceHash,
      stateCode: supplier.stateCode,
    }),
    recipient: placeOfSupply.recipient,
    buyerAssociation: placeOfSupply.buyerAssociation,
    classification: placeOfSupply.classification,
    placeOfSupply: Object.freeze({
      candidateHash: placeOfSupply.candidateHash,
      legalRule: placeOfSupply.legalRule,
      pos: placeOfSupply.pos,
    }),
    comparisonRule: COMPARISON_RULE,
    stateRelationship,
  });
  const candidateJson = JSON.stringify(candidate);
  const candidateHash = sha256(JSON.stringify({ tenantId, candidate }));
  return Object.freeze({ ...candidate, candidateJson, candidateHash });
}
