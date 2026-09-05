import { types as utilTypes } from "node:util";

import type { IndiaGstAccommodationSupplyNatureResult } from "./india-gst-accommodation-supply-nature";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const STATE_CODES = new Set(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "26", "27", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38"]);
const UTGST_CODES = new Set(["04", "26", "31", "35", "38"]);

const INPUT_KEYS = ["tenantId", "supplyNature"] as const;
const CANDIDATE_KEYS = ["propertyNode", "reservationId", "folioId", "supplyDate", "jurisdiction", "supplier", "recipient", "buyerAssociation", "classification", "placeOfSupply", "registeredStateComparison", "supplyNature", "determinationBasis", "sezDirection", "legalRule", "candidateJson", "candidateHash"] as const;
const JURISDICTION_KEYS = ["extensionId", "ownerTenantId", "key", "version", "contentHash"] as const;
const SUPPLIER_KEYS = ["registrationId", "evidenceHash", "stateCode", "serviceLocation", "status"] as const;
const SERVICE_LOCATION_KEYS = ["id", "evidenceHash", "kind", "stateCode"] as const;
const SUPPLIER_STATUS_KEYS = ["id", "evidenceHash", "statusAsOf", "taxpayerType", "sezStatus"] as const;
const RECIPIENT_KEYS = ["partyId", "registrationId", "evidenceHash", "status"] as const;
const RECIPIENT_STATUS_KEYS = ["id", "evidenceHash", "statusAsOf", "taxpayerType", "sezStatus"] as const;
const BUYER_KEYS = ["associationHash", "payloadHash"] as const;
const CLASSIFICATION_KEYS = ["classificationId", "evidenceHash"] as const;
const POS_KEYS = ["candidateHash", "legalRule", "pos"] as const;
const COMPARISON_KEYS = ["candidateHash", "comparisonRule", "stateRelationship"] as const;

type RecordValue = Record<string, unknown>;
type ComponentFamily = "igst" | "cgst_sgst" | "cgst_utgst";

export interface IndiaGstAccommodationComponentFamilyInput {
  readonly tenantId: string;
  readonly supplyNature: IndiaGstAccommodationSupplyNatureResult;
}

export interface IndiaGstAccommodationComponentFamilyResult {
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly supplyDate: string;
  readonly jurisdiction: Readonly<{ extensionId: string; key: string; version: string; contentHash: string }>;
  readonly supplierRegistrationId: string;
  readonly placeOfSupplyStateCode: string;
  readonly supplyNature: "intra_state" | "inter_state";
  readonly determinationBasis: "ordinary_registered_state_comparison" | "sez_override";
  readonly sezDirection: "none" | "to_sez" | "by_sez" | "to_and_by_sez";
  readonly componentFamily: ComponentFamily;
  readonly legalSources: Readonly<{
    supplyNature: "IGST_ACT_8_2" | "IGST_ACT_7_3" | "IGST_ACT_7_5_B";
    componentFamily: "IGST_ACT_5_1" | "CGST_ACT_9_1_AND_SGST_ACT" | "CGST_ACT_9_1_AND_UTGST_ACT_7_1";
  }>;
  readonly predecessorCandidateHash: string;
  readonly evidenceHash: string;
}

export class IndiaGstAccommodationComponentFamilyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationComponentFamilyValidationError";
  }
}

function fail(message: string): never { throw new IndiaGstAccommodationComponentFamilyValidationError(message); }

function exact(value: unknown, expected: readonly string[], subject: string, frozen: boolean): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getOwnPropertySymbols(value).length !== 0 || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      || (frozen && !Object.isFrozen(value))) return fail(`${subject} must be an exact ${frozen ? "frozen " : ""}plain object`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])
      || Object.values(descriptors).some((descriptor) => descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor)
        || (frozen && (descriptor.configurable !== false || descriptor.writable !== false)))) return fail(`${subject} shape is invalid`);
  return value as RecordValue;
}

function uuid(value: unknown, subject: string): string { return typeof value === "string" && UUID.test(value) ? value : fail(`${subject} must be a canonical UUID`); }
function hash(value: unknown, subject: string): string { return typeof value === "string" && SHA256.test(value) ? value : fail(`${subject} must be a canonical SHA-256`); }

function date(value: unknown, subject: string): string {
  if (typeof value !== "string") return fail(`${subject} is invalid`);
  const match = DATE.exec(value);
  if (!match) return fail(`${subject} is invalid`);
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0) ? value : fail(`${subject} is invalid`);
}

function state(value: unknown, subject: string): string { return typeof value === "string" && STATE_CODES.has(value) ? value : fail(`${subject} is invalid`); }
function text(value: unknown, subject: string): string { return typeof value === "string" && value.length > 0 && value === value.trim() && value === value.normalize("NFC") && !/[\u0000-\u001f\u007f]/.test(value) ? value : fail(`${subject} is invalid`); }
function digest(value: unknown): string { return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex"); }

function freezeGraph(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  if (utilTypes.isProxy(value) || !Object.isFrozen(value) || Object.getOwnPropertySymbols(value).length !== 0) fail("supply-nature evidence must be deeply frozen and symbol-free");
  seen.add(value);
  if (Array.isArray(value)) fail("supply-nature evidence must not contain arrays");
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) fail("supply-nature evidence must contain plain objects only");
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true || descriptor.configurable !== false || !("value" in descriptor) || descriptor.writable !== false) fail(`supply-nature evidence field ${key} is invalid`);
    freezeGraph(descriptor.value, seen);
  }
}

function lineageHash(value: unknown, keys: readonly string[], subject: string): RecordValue {
  const source = exact(value, keys, subject, true);
  for (const [key, item] of Object.entries(source)) if (key.toLowerCase().includes("hash")) hash(item, `${subject} ${key}`);
  return source;
}

function candidate(raw: unknown, tenantId: string): Readonly<{
  propertyNode: string; reservationId: string; folioId: string; supplyDate: string;
  jurisdiction: Readonly<{ extensionId: string; key: string; version: string; contentHash: string }>;
  supplierRegistrationId: string; supplierStateCode: string; pos: string;
  supplyNature: "intra_state" | "inter_state";
  determinationBasis: "ordinary_registered_state_comparison" | "sez_override";
  sezDirection: "none" | "to_sez" | "by_sez" | "to_and_by_sez";
  legalRule: "IGST_ACT_8_2" | "IGST_ACT_7_3" | "IGST_ACT_7_5_B"; candidateHash: string;
}> {
  freezeGraph(raw);
  const source = exact(raw, CANDIDATE_KEYS, "supply-nature evidence", true);
  const propertyNode = uuid(source.propertyNode, "propertyNode"), reservationId = uuid(source.reservationId, "reservationId"), folioId = uuid(source.folioId, "folioId"), supplyDate = date(source.supplyDate, "supplyDate");
  const jurisdictionSource = exact(source.jurisdiction, JURISDICTION_KEYS, "jurisdiction", true);
  const owner = jurisdictionSource.ownerTenantId === null ? null : uuid(jurisdictionSource.ownerTenantId, "jurisdiction ownerTenantId");
  const jurisdiction = Object.freeze({ extensionId: uuid(jurisdictionSource.extensionId, "jurisdiction extensionId"), key: text(jurisdictionSource.key, "jurisdiction key"), version: text(jurisdictionSource.version, "jurisdiction version"), contentHash: hash(jurisdictionSource.contentHash, "jurisdiction contentHash") });
  if (!/^[1-9][0-9]*$/.test(jurisdiction.version)) fail("jurisdiction version is invalid");
  const supplier = lineageHash(source.supplier, SUPPLIER_KEYS, "supplier");
  const supplierRegistrationId = uuid(supplier.registrationId, "supplier registrationId"), supplierStateCode = state(supplier.stateCode, "supplier stateCode");
  const location = lineageHash(supplier.serviceLocation, SERVICE_LOCATION_KEYS, "supplier service location");
  if (uuid(location.id, "supplier service location id") === "" || state(location.stateCode, "supplier service location state") !== supplierStateCode || (location.kind !== "principal_place_of_business" && location.kind !== "additional_place_of_business")) fail("supplier service location is invalid");
  const supplierStatus = lineageHash(supplier.status, SUPPLIER_STATUS_KEYS, "supplier status");
  if (uuid(supplierStatus.id, "supplier status id") === "" || date(supplierStatus.statusAsOf, "supplier status date") !== supplyDate || !["regular", "sez_unit", "sez_developer"].includes(String(supplierStatus.taxpayerType)) || !["affirmatively_non_sez_regular", "sez_unit", "sez_developer"].includes(String(supplierStatus.sezStatus))) fail("supplier status is invalid");
  const expectedSupplierSezStatus = supplierStatus.taxpayerType === "regular"
    ? "affirmatively_non_sez_regular"
    : supplierStatus.taxpayerType;
  if (supplierStatus.sezStatus !== expectedSupplierSezStatus) fail("supplier status conflicts with GST taxpayer type");
  const recipient = lineageHash(source.recipient, RECIPIENT_KEYS, "recipient");
  if (uuid(recipient.partyId, "recipient partyId") === "" || uuid(recipient.registrationId, "recipient registrationId") === "") fail("recipient identity is invalid");
  const recipientStatus = lineageHash(recipient.status, RECIPIENT_STATUS_KEYS, "recipient status");
  if (uuid(recipientStatus.id, "recipient status id") === "" || date(recipientStatus.statusAsOf, "recipient status date") !== supplyDate || !["regular", "sez_unit", "sez_developer"].includes(String(recipientStatus.taxpayerType)) || !["affirmatively_non_sez_regular", "sez_unit", "sez_developer"].includes(String(recipientStatus.sezStatus))) fail("recipient status is invalid");
  const expectedRecipientSezStatus = recipientStatus.taxpayerType === "regular"
    ? "affirmatively_non_sez_regular"
    : recipientStatus.taxpayerType;
  if (recipientStatus.sezStatus !== expectedRecipientSezStatus) fail("recipient status conflicts with GST taxpayer type");
  const buyer = lineageHash(source.buyerAssociation, BUYER_KEYS, "buyer association");
  const classification = lineageHash(source.classification, CLASSIFICATION_KEYS, "classification");
  if (uuid(classification.classificationId, "classification id") === "") fail("classification is invalid");
  const place = lineageHash(source.placeOfSupply, POS_KEYS, "place of supply");
  const pos = state(place.pos, "place of supply state");
  if (place.legalRule !== "IGST_ACT_12_3_B") fail("place-of-supply legal rule is invalid");
  const comparison = lineageHash(source.registeredStateComparison, COMPARISON_KEYS, "registered-state comparison");
  if (comparison.comparisonRule !== "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS" || (comparison.stateRelationship !== "same_state_or_union_territory" && comparison.stateRelationship !== "different_state_or_union_territory")) fail("registered-state comparison is invalid");
  const supplyNature = source.supplyNature as "intra_state" | "inter_state";
  const determinationBasis = source.determinationBasis as "ordinary_registered_state_comparison" | "sez_override";
  const sezDirection = source.sezDirection as "none" | "to_sez" | "by_sez" | "to_and_by_sez";
  const legalRule = source.legalRule as "IGST_ACT_8_2" | "IGST_ACT_7_3" | "IGST_ACT_7_5_B";
  if ((supplyNature !== "intra_state" && supplyNature !== "inter_state") || (determinationBasis !== "ordinary_registered_state_comparison" && determinationBasis !== "sez_override") || !["none", "to_sez", "by_sez", "to_and_by_sez"].includes(String(sezDirection)) || !["IGST_ACT_8_2", "IGST_ACT_7_3", "IGST_ACT_7_5_B"].includes(String(legalRule))) fail("supply-nature statutory fields are invalid");
  const expected = determinationBasis === "sez_override"
    ? { nature: "inter_state", rule: "IGST_ACT_7_5_B", direction: supplierStatus.sezStatus !== "affirmatively_non_sez_regular" && recipientStatus.sezStatus !== "affirmatively_non_sez_regular" ? "to_and_by_sez" : recipientStatus.sezStatus !== "affirmatively_non_sez_regular" ? "to_sez" : "by_sez" }
    : comparison.stateRelationship === "same_state_or_union_territory"
      ? { nature: "intra_state", rule: "IGST_ACT_8_2", direction: "none" }
      : { nature: "inter_state", rule: "IGST_ACT_7_3", direction: "none" };
  if (supplyNature !== expected.nature || legalRule !== expected.rule || sezDirection !== expected.direction || (determinationBasis === "ordinary_registered_state_comparison" && ((expected.nature === "intra_state") !== (supplierStateCode === pos)))) fail("supply-nature statutory precedence is inconsistent");
  const body = Object.freeze({ propertyNode, reservationId, folioId, supplyDate, jurisdiction: Object.freeze({ extensionId: jurisdiction.extensionId, ownerTenantId: owner, key: jurisdiction.key, version: jurisdiction.version, contentHash: jurisdiction.contentHash }), supplier: source.supplier, recipient: source.recipient, buyerAssociation: source.buyerAssociation, classification: source.classification, placeOfSupply: source.placeOfSupply, registeredStateComparison: source.registeredStateComparison, supplyNature, determinationBasis, sezDirection, legalRule });
  if (source.candidateJson !== JSON.stringify(body) || hash(source.candidateHash, "candidateHash") !== digest({ tenantId, candidate: body })) fail("supply-nature candidate hash is inconsistent");
  return Object.freeze({ propertyNode, reservationId, folioId, supplyDate, jurisdiction, supplierRegistrationId, supplierStateCode, pos, supplyNature, determinationBasis, sezDirection, legalRule, candidateHash: source.candidateHash as string });
}

export function deriveIndiaGstAccommodationComponentFamily(raw: IndiaGstAccommodationComponentFamilyInput): IndiaGstAccommodationComponentFamilyResult {
  const input = exact(raw, INPUT_KEYS, "component-family input", false);
  const tenantId = uuid(input.tenantId, "tenantId");
  const source = candidate(input.supplyNature, tenantId);
  const componentFamily: ComponentFamily = source.supplyNature === "inter_state" ? "igst" : UTGST_CODES.has(source.pos) ? "cgst_utgst" : "cgst_sgst";
  const componentRule = componentFamily === "igst" ? "IGST_ACT_5_1" as const : componentFamily === "cgst_utgst" ? "CGST_ACT_9_1_AND_UTGST_ACT_7_1" as const : "CGST_ACT_9_1_AND_SGST_ACT" as const;
  const body = Object.freeze({ propertyNode: source.propertyNode, reservationId: source.reservationId, folioId: source.folioId, supplyDate: source.supplyDate, jurisdiction: source.jurisdiction, supplierRegistrationId: source.supplierRegistrationId, placeOfSupplyStateCode: source.pos, supplyNature: source.supplyNature, determinationBasis: source.determinationBasis, sezDirection: source.sezDirection, componentFamily, legalSources: Object.freeze({ supplyNature: source.legalRule, componentFamily: componentRule }), predecessorCandidateHash: source.candidateHash });
  return Object.freeze({ ...body, evidenceHash: digest({ tenantId, ...body }) });
}
