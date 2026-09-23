import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";
import {
  IndiaGstSupplierRegistrationService,
  type IndiaGstSupplierRegistrationInput,
  type IndiaGstSupplierRegistrationResult,
} from "./india-gst-supplier-registration";
import {
  IndiaGstFolioBuyerCandidateService,
  type IndiaGstFolioBuyerCandidateInput,
  type IndiaGstFolioBuyerCandidateResult,
} from "./india-gst-folio-buyer-candidate";
import {
  IndiaGstPropertyLocationService,
  type IndiaGstPropertyLocationInput,
  type IndiaGstPropertyLocationResult,
} from "./india-gst-property-location";
import {
  IndiaGstAccommodationClassificationService,
  type IndiaGstAccommodationClassificationInput,
  type IndiaGstAccommodationClassificationResult,
} from "./india-gst-accommodation-classification";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const GSTIN = /^([0-9]{2})[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GST_STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
  "33", "34", "35", "36", "37", "38",
]);
const ACCOMMODATION_SAC = new Set([
  "996311", "996312", "996313", "996321", "996322", "996329",
]);
const JURISDICTION_KEY = /^[a-z0-9][a-z0-9_.:-]{0,127}$/;
const INPUT_KEYS = [
  "tenantId",
  "propertyNode",
  "reservationId",
  "folioId",
  "recipientPartyId",
  "recipientRegistrationId",
  "classificationId",
] as const;
const SUPPLIER_KEYS = [
  "registrationId", "propertyNode", "scheme", "currency", "jurisdiction",
  "gstin", "stateCode", "legalName", "tradeName", "addressLine", "locality",
  "postalCode", "evidenceHash",
] as const;
const JURISDICTION_KEYS = [
  "extensionId", "ownerTenantId", "key", "version", "contentHash",
] as const;
const BUYER_CANDIDATE_KEYS = [
  "folio", "recipient", "buyer", "associationJson", "associationHash",
] as const;
const FOLIO_KEYS = [
  "folioId", "accountId", "reservationId", "windowNo", "folioStatus",
  "accountRole", "accountStatus", "reservationStatus", "currency", "propertyNode",
] as const;
const RECIPIENT_KEYS = ["partyId", "registrationId", "evidenceHash"] as const;
const BUYER_KEYS = ["format", "payload", "payloadJson", "payloadHash"] as const;
const PROPERTY_LOCATION_KEYS = [
  "propertyNode", "countryCode", "stateCode", "addressLine1", "locality", "pin",
  "evidenceHash",
] as const;
const CLASSIFICATION_KEYS = [
  "classificationId", "propertyNode", "jurisdiction", "lineId", "revenueGroup",
  "classificationSystem", "classificationCode", "isServiceCode", "evidenceHash",
] as const;
const FOLIO_STATUSES = new Set(["open", "settled", "closed"]);
const ACCOUNT_ROLES = new Set([
  "guest", "company", "group_master", "house", "outlet", "event", "trust",
  "ar_control", "cash", "bank", "card_clearing", "upi_clearing", "revenue",
  "tax_payable", "deposit_liability", "payable", "fx",
]);
const ACCOUNT_STATUSES = new Set(["open", "frozen", "closed"]);
const RESERVATION_STATUSES = new Set([
  "quote", "reserved", "waitlist", "due_in", "in_house", "due_out",
  "checked_out", "cancelled", "no_show",
]);

interface SupplierRegistrationResolver {
  resolve(
    tx: Tx,
    input: IndiaGstSupplierRegistrationInput,
  ): Promise<IndiaGstSupplierRegistrationResult>;
}

interface FolioBuyerResolver {
  resolve(
    tx: Tx,
    input: IndiaGstFolioBuyerCandidateInput,
  ): Promise<IndiaGstFolioBuyerCandidateResult>;
}

interface PropertyLocationResolver {
  resolve(
    tx: Tx,
    input: IndiaGstPropertyLocationInput,
  ): Promise<IndiaGstPropertyLocationResult>;
}

interface AccommodationClassificationResolver {
  resolve(
    tx: Tx,
    input: IndiaGstAccommodationClassificationInput,
  ): Promise<IndiaGstAccommodationClassificationResult>;
}

export interface IndiaGstAccommodationPlaceOfSupplyInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly recipientPartyId: string;
  readonly recipientRegistrationId: string;
  readonly classificationId: string;
}

export interface IndiaGstAccommodationPlaceOfSupplyCandidate {
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly jurisdiction: Readonly<{
    extensionId: string;
    ownerTenantId: string | null;
    key: string;
    version: string;
    contentHash: string;
  }>;
  readonly supplier: Readonly<{
    registrationId: string;
    evidenceHash: string;
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
  readonly propertyLocation: Readonly<{
    propertyNode: string;
    evidenceHash: string;
  }>;
  readonly legalRule: "IGST_ACT_12_3_B";
  readonly pos: string;
}

export interface IndiaGstAccommodationPlaceOfSupplyResult
  extends IndiaGstAccommodationPlaceOfSupplyCandidate {
  readonly candidateJson: string;
  readonly candidateHash: string;
}

export class IndiaGstAccommodationPlaceOfSupplyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationPlaceOfSupplyValidationError";
  }
}

export class IndiaGstAccommodationPlaceOfSupplyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationPlaceOfSupplyConflictError";
  }
}

function exactRecord(
  value: unknown,
  expectedKeys: readonly string[],
  subject: string,
  frozen: boolean,
  error: (message: string) => Error,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 ||
      (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null) ||
      (frozen && !Object.isFrozen(value))) {
    throw error(`${subject} must be an exact ${frozen ? "frozen " : ""}plain object`);
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
    throw error(`${subject} shape is invalid`);
  }
  return value as Record<string, unknown>;
}

function conflict(message: string): IndiaGstAccommodationPlaceOfSupplyConflictError {
  return new IndiaGstAccommodationPlaceOfSupplyConflictError(message);
}

function uuid(value: unknown, subject: string, input = false): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw input
      ? new IndiaGstAccommodationPlaceOfSupplyValidationError(
          `${subject} must be a canonical UUID`,
        )
      : conflict(`${subject} is invalid`);
  }
  return value;
}

function hash(value: unknown, subject: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw conflict(`${subject} is invalid`);
  }
  return value;
}

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function normalizedText(value: unknown, subject: string, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength ||
      value !== value.trim() || value !== value.normalize("NFC") ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw conflict(`${subject} is not canonical`);
  }
  return value;
}

function exactMember(
  value: unknown,
  allowed: ReadonlySet<string>,
  subject: string,
): string {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw conflict(`${subject} is invalid`);
  }
  return value;
}

function normalizeInput(value: unknown): IndiaGstAccommodationPlaceOfSupplyInput {
  const input = exactRecord(
    value,
    INPUT_KEYS,
    "India GST accommodation place-of-supply input",
    false,
    (message) => new IndiaGstAccommodationPlaceOfSupplyValidationError(message),
  );
  return Object.freeze({
    tenantId: uuid(input.tenantId, "tenantId", true),
    propertyNode: uuid(input.propertyNode, "propertyNode", true),
    reservationId: uuid(input.reservationId, "reservationId", true),
    folioId: uuid(input.folioId, "folioId", true),
    recipientPartyId: uuid(input.recipientPartyId, "recipientPartyId", true),
    recipientRegistrationId: uuid(
      input.recipientRegistrationId,
      "recipientRegistrationId",
      true,
    ),
    classificationId: uuid(input.classificationId, "classificationId", true),
  });
}

function gstinChecksum(body: string): string {
  let factor = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const character = body[index];
    const codePoint = character === undefined ? -1 : GST_ALPHABET.indexOf(character);
    if (codePoint < 0) {
      throw conflict("GSTIN is not canonical");
    }
    const addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(addend / 36) + addend % 36;
  }
  const checksum = GST_ALPHABET[(36 - sum % 36) % 36];
  if (checksum === undefined) {
    throw conflict("GSTIN is not canonical");
  }
  return checksum;
}

function exactGstin(value: unknown, stateCode: unknown, subject: string): string {
  if (typeof stateCode !== "string" || !GST_STATE_CODES.has(stateCode) ||
      typeof value !== "string" || !GSTIN.test(value) ||
      value.slice(0, 2) !== stateCode ||
      gstinChecksum(value.slice(0, 14)) !== value[14]) {
    throw conflict(`${subject} is not canonical`);
  }
  return value;
}

function exactJurisdiction(
  value: unknown,
  subject: string,
): IndiaGstAccommodationPlaceOfSupplyCandidate["jurisdiction"] {
  const jurisdiction = exactRecord(value, JURISDICTION_KEYS, subject, true, conflict);
  const extensionId = uuid(jurisdiction.extensionId, `${subject} extension id`);
  const ownerTenantId = jurisdiction.ownerTenantId === null
    ? null
    : uuid(jurisdiction.ownerTenantId, `${subject} owner tenant id`);
  if (typeof jurisdiction.key !== "string" || !JURISDICTION_KEY.test(jurisdiction.key) ||
      typeof jurisdiction.version !== "string" ||
      !/^[1-9][0-9]*$/.test(jurisdiction.version)) {
    throw conflict(`${subject} identity is invalid`);
  }
  const contentHash = hash(jurisdiction.contentHash, `${subject} content hash`);
  return Object.freeze({
    extensionId,
    ownerTenantId,
    key: jurisdiction.key,
    version: jurisdiction.version,
    contentHash,
  });
}

function sameJurisdiction(
  left: IndiaGstAccommodationPlaceOfSupplyCandidate["jurisdiction"],
  right: IndiaGstAccommodationPlaceOfSupplyCandidate["jurisdiction"],
): boolean {
  return left.extensionId === right.extensionId &&
    left.ownerTenantId === right.ownerTenantId && left.key === right.key &&
    left.version === right.version && left.contentHash === right.contentHash;
}

function exactSupplier(
  value: unknown,
  input: IndiaGstAccommodationPlaceOfSupplyInput,
): Readonly<{
  registrationId: string;
  jurisdiction: IndiaGstAccommodationPlaceOfSupplyCandidate["jurisdiction"];
  evidenceHash: string;
}> {
  const supplier = exactRecord(
    value,
    SUPPLIER_KEYS,
    "India GST supplier-registration evidence",
    true,
    conflict,
  );
  const registrationId = uuid(supplier.registrationId, "supplier registration id");
  const propertyNode = uuid(supplier.propertyNode, "supplier property node");
  const jurisdiction = exactJurisdiction(supplier.jurisdiction, "supplier jurisdiction");
  if (propertyNode !== input.propertyNode || supplier.scheme !== "in-gstin" ||
      supplier.currency !== "INR") {
    throw conflict("supplier registration conflicts with selected India/INR property");
  }
  const gstin = exactGstin(supplier.gstin, supplier.stateCode, "supplier GSTIN");
  const legalName = normalizedText(supplier.legalName, "supplier legal name", 200);
  const tradeName = supplier.tradeName === null
    ? null
    : normalizedText(supplier.tradeName, "supplier trade name", 200);
  const addressLine = normalizedText(supplier.addressLine, "supplier address", 300);
  const locality = normalizedText(supplier.locality, "supplier locality", 120);
  if (typeof supplier.postalCode !== "string" || !/^[1-9][0-9]{5}$/.test(supplier.postalCode)) {
    throw conflict("supplier postal code is invalid");
  }
  const expectedHash = sha256(JSON.stringify({
    registrationId,
    tenantId: input.tenantId,
    propertyNode,
    scheme: "in-gstin",
    currency: "INR",
    jurisdiction,
    gstin,
    stateCode: supplier.stateCode,
    legalName,
    tradeName,
    addressLine,
    locality,
    postalCode: supplier.postalCode,
  }));
  if (hash(supplier.evidenceHash, "supplier evidence hash") !== expectedHash) {
    throw conflict("supplier evidence hash is inconsistent");
  }
  return Object.freeze({ registrationId, jurisdiction, evidenceHash: expectedHash });
}

function exactBuyerPayload(
  value: unknown,
): Readonly<{
  payload: Readonly<{ BuyerDtls: Readonly<Record<string, unknown>> }>;
  payloadJson: string;
  payloadHash: string;
  recipientEvidence: Readonly<{
    gstin: string;
    stateCode: string;
    legalName: string;
    tradeName: string | null;
    addressLine1: string;
    locality: string;
    pin: string;
  }>;
}> {
  const buyer = exactRecord(value, BUYER_KEYS, "folio buyer payload evidence", true, conflict);
  if (buyer.format !== "irp_json_1_1") {
    throw conflict("folio buyer payload format is invalid");
  }
  const payload = exactRecord(buyer.payload, ["BuyerDtls"], "buyer payload", true, conflict);
  const rawDetails = payload.BuyerDtls;
  if (typeof rawDetails !== "object" || rawDetails === null || Array.isArray(rawDetails) ||
      utilTypes.isProxy(rawDetails) || !Object.isFrozen(rawDetails)) {
    throw conflict("BuyerDtls must be exact frozen evidence");
  }
  const hasTradeName = Object.prototype.hasOwnProperty.call(rawDetails, "TrdNm");
  const details = exactRecord(
    rawDetails,
    hasTradeName
      ? ["Gstin", "LglNm", "TrdNm", "Addr1", "Loc", "Pin", "Stcd"]
      : ["Gstin", "LglNm", "Addr1", "Loc", "Pin", "Stcd"],
    "BuyerDtls",
    true,
    conflict,
  );
  const gstin = exactGstin(details.Gstin, details.Stcd, "recipient GSTIN");
  const legalName = normalizedText(details.LglNm, "recipient legal name", 100);
  const tradeName = hasTradeName
    ? normalizedText(details.TrdNm, "recipient trade name", 100)
    : null;
  const addressLine1 = normalizedText(details.Addr1, "recipient address", 100);
  const locality = normalizedText(details.Loc, "recipient locality", 50);
  if (typeof details.Pin !== "number" || !Number.isSafeInteger(details.Pin) ||
      !/^[1-9][0-9]{5}$/.test(String(details.Pin))) {
    throw conflict("recipient PIN is invalid");
  }
  const payloadHash = hash(buyer.payloadHash, "buyer payload hash");
  if (typeof buyer.payloadJson !== "string" || buyer.payloadJson !== JSON.stringify(buyer.payload) ||
      payloadHash !== sha256(buyer.payloadJson)) {
    throw conflict("buyer payload hash is inconsistent");
  }
  return Object.freeze({
    payload: buyer.payload as Readonly<{ BuyerDtls: Readonly<Record<string, unknown>> }>,
    payloadJson: buyer.payloadJson,
    payloadHash,
    recipientEvidence: Object.freeze({
      gstin,
      stateCode: details.Stcd as string,
      legalName,
      tradeName,
      addressLine1,
      locality,
      pin: String(details.Pin),
    }),
  });
}

function exactBuyerCandidate(
  value: unknown,
  input: IndiaGstAccommodationPlaceOfSupplyInput,
): Readonly<{
  associationHash: string;
  payloadHash: string;
  recipientEvidenceHash: string;
}> {
  const candidate = exactRecord(
    value,
    BUYER_CANDIDATE_KEYS,
    "folio buyer candidate evidence",
    true,
    conflict,
  );
  const folio = exactRecord(candidate.folio, FOLIO_KEYS, "folio evidence", true, conflict);
  const recipient = exactRecord(
    candidate.recipient,
    RECIPIENT_KEYS,
    "recipient lineage",
    true,
    conflict,
  );
  const buyer = exactBuyerPayload(candidate.buyer);
  const folioId = uuid(folio.folioId, "folio id");
  uuid(folio.accountId, "folio account id");
  const reservationId = uuid(folio.reservationId, "folio reservation id");
  const propertyNode = uuid(folio.propertyNode, "folio property node");
  const partyId = uuid(recipient.partyId, "recipient party id");
  const registrationId = uuid(recipient.registrationId, "recipient registration id");
  if (folioId !== input.folioId || reservationId !== input.reservationId ||
      propertyNode !== input.propertyNode || partyId !== input.recipientPartyId ||
      registrationId !== input.recipientRegistrationId || folio.currency !== "INR" ||
      !Number.isSafeInteger(folio.windowNo) || (folio.windowNo as number) < 1 ||
      (folio.windowNo as number) > 20) {
    throw conflict("folio buyer evidence conflicts with selected identity or INR");
  }
  const folioStatus = exactMember(folio.folioStatus, FOLIO_STATUSES, "folio status");
  exactMember(folio.accountRole, ACCOUNT_ROLES, "folio account role");
  const accountStatus = exactMember(
    folio.accountStatus,
    ACCOUNT_STATUSES,
    "folio account status",
  );
  const reservationStatus = exactMember(
    folio.reservationStatus,
    RESERVATION_STATUSES,
    "reservation status",
  );
  if (folioStatus === "closed" || accountStatus === "closed" ||
      reservationStatus === "cancelled" || reservationStatus === "no_show") {
    throw conflict("closed folio buyer lineage cannot determine place of supply");
  }
  const recipientEvidenceHash = sha256(JSON.stringify({
    registrationId,
    tenantId: input.tenantId,
    partyId,
    scheme: "in-gstin",
    gstin: buyer.recipientEvidence.gstin,
    stateCode: buyer.recipientEvidence.stateCode,
    legalName: buyer.recipientEvidence.legalName,
    tradeName: buyer.recipientEvidence.tradeName,
    addressLine1: buyer.recipientEvidence.addressLine1,
    locality: buyer.recipientEvidence.locality,
    pin: buyer.recipientEvidence.pin,
  }));
  if (hash(recipient.evidenceHash, "recipient evidence hash") !== recipientEvidenceHash) {
    throw conflict("recipient evidence hash is inconsistent");
  }
  const associationHash = hash(candidate.associationHash, "buyer association hash");
  if (typeof candidate.associationJson !== "string" ||
      candidate.associationJson !== JSON.stringify({
        folio: candidate.folio,
        recipient: candidate.recipient,
        buyer: candidate.buyer,
      }) ||
      associationHash !== sha256(candidate.associationJson)) {
    throw conflict("folio buyer association hash is inconsistent");
  }
  return Object.freeze({
    associationHash,
    payloadHash: buyer.payloadHash,
    recipientEvidenceHash,
  });
}

function exactPropertyLocation(
  value: unknown,
  input: IndiaGstAccommodationPlaceOfSupplyInput,
): Readonly<{ propertyNode: string; stateCode: string; evidenceHash: string }> {
  const location = exactRecord(
    value,
    PROPERTY_LOCATION_KEYS,
    "property fiscal-location evidence",
    true,
    conflict,
  );
  const propertyNode = uuid(location.propertyNode, "fiscal-location property node");
  if (propertyNode !== input.propertyNode || location.countryCode !== "IN" ||
      typeof location.stateCode !== "string" || !GST_STATE_CODES.has(location.stateCode)) {
    throw conflict("property fiscal location conflicts with selected India property");
  }
  const addressLine1 = normalizedText(location.addressLine1, "property address", 100);
  const locality = normalizedText(location.locality, "property locality", 50);
  if (typeof location.pin !== "string" || !/^[1-9][0-9]{5}$/.test(location.pin)) {
    throw conflict("property fiscal-location PIN is invalid");
  }
  const evidenceHash = sha256(JSON.stringify({
    tenantId: input.tenantId,
    propertyNode,
    countryCode: "IN",
    stateCode: location.stateCode,
    addressLine1,
    locality,
    pin: location.pin,
  }));
  if (hash(location.evidenceHash, "property-location evidence hash") !== evidenceHash) {
    throw conflict("property fiscal-location evidence hash is inconsistent");
  }
  return Object.freeze({ propertyNode, stateCode: location.stateCode, evidenceHash });
}

function exactClassification(
  value: unknown,
  input: IndiaGstAccommodationPlaceOfSupplyInput,
): Readonly<{
  classificationId: string;
  jurisdiction: IndiaGstAccommodationPlaceOfSupplyCandidate["jurisdiction"];
  evidenceHash: string;
}> {
  const classification = exactRecord(
    value,
    CLASSIFICATION_KEYS,
    "accommodation-classification evidence",
    true,
    conflict,
  );
  const classificationId = uuid(classification.classificationId, "classification id");
  const propertyNode = uuid(classification.propertyNode, "classification property node");
  const jurisdiction = exactJurisdiction(
    classification.jurisdiction,
    "classification jurisdiction",
  );
  if (classificationId !== input.classificationId || propertyNode !== input.propertyNode ||
      classification.lineId !== "room" || classification.revenueGroup !== "room_revenue" ||
      classification.classificationSystem !== "SAC" ||
      typeof classification.classificationCode !== "string" ||
      !ACCOMMODATION_SAC.has(classification.classificationCode) ||
      classification.isServiceCode !== "Y") {
    throw conflict("classification is not exact India accommodation service evidence");
  }
  const evidenceHash = sha256(JSON.stringify({
    tenantId: input.tenantId,
    classificationId,
    propertyNode,
    jurisdiction,
    lineId: "room",
    revenueGroup: "room_revenue",
    classificationSystem: "SAC",
    classificationCode: classification.classificationCode,
    isServiceCode: "Y",
  }));
  if (hash(classification.evidenceHash, "classification evidence hash") !== evidenceHash) {
    throw conflict("classification evidence hash is inconsistent");
  }
  return Object.freeze({ classificationId, jurisdiction, evidenceHash });
}

export class IndiaGstAccommodationPlaceOfSupplyService {
  constructor(
    private readonly supplier: SupplierRegistrationResolver =
      new IndiaGstSupplierRegistrationService(),
    private readonly buyer: FolioBuyerResolver = new IndiaGstFolioBuyerCandidateService(),
    private readonly propertyLocation: PropertyLocationResolver =
      new IndiaGstPropertyLocationService(),
    private readonly classification: AccommodationClassificationResolver =
      new IndiaGstAccommodationClassificationService(),
  ) {}

  async resolve(
    tx: Tx,
    input: IndiaGstAccommodationPlaceOfSupplyInput,
  ): Promise<IndiaGstAccommodationPlaceOfSupplyResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstAccommodationPlaceOfSupplyValidationError(
        "tenant transaction is unavailable",
      );
    }
    const exact = normalizeInput(input);
    const supplier = exactSupplier(await this.supplier.resolve(tx, Object.freeze({
      tenantId: exact.tenantId,
      propertyNode: exact.propertyNode,
      reservationId: exact.reservationId,
    })), exact);
    const buyer = exactBuyerCandidate(await this.buyer.resolve(tx, Object.freeze({
      tenantId: exact.tenantId,
      propertyNode: exact.propertyNode,
      folioId: exact.folioId,
      recipientPartyId: exact.recipientPartyId,
      registrationId: exact.recipientRegistrationId,
    })), exact);
    const location = exactPropertyLocation(await this.propertyLocation.resolve(
      tx,
      Object.freeze({ tenantId: exact.tenantId, propertyNode: exact.propertyNode }),
    ), exact);
    const classification = exactClassification(await this.classification.resolve(
      tx,
      Object.freeze({
        tenantId: exact.tenantId,
        propertyNode: exact.propertyNode,
        reservationId: exact.reservationId,
        classificationId: exact.classificationId,
      }),
    ), exact);
    if (!sameJurisdiction(supplier.jurisdiction, classification.jurisdiction)) {
      throw conflict("supplier and classification frozen jurisdiction lineage conflicts");
    }

    const jurisdiction = supplier.jurisdiction;
    const candidate: IndiaGstAccommodationPlaceOfSupplyCandidate = Object.freeze({
      propertyNode: exact.propertyNode,
      reservationId: exact.reservationId,
      folioId: exact.folioId,
      jurisdiction,
      supplier: Object.freeze({
        registrationId: supplier.registrationId,
        evidenceHash: supplier.evidenceHash,
      }),
      recipient: Object.freeze({
        partyId: exact.recipientPartyId,
        registrationId: exact.recipientRegistrationId,
        evidenceHash: buyer.recipientEvidenceHash,
      }),
      buyerAssociation: Object.freeze({
        associationHash: buyer.associationHash,
        payloadHash: buyer.payloadHash,
      }),
      classification: Object.freeze({
        classificationId: classification.classificationId,
        evidenceHash: classification.evidenceHash,
      }),
      propertyLocation: Object.freeze({
        propertyNode: location.propertyNode,
        evidenceHash: location.evidenceHash,
      }),
      legalRule: "IGST_ACT_12_3_B",
      pos: location.stateCode,
    });
    const candidateJson = JSON.stringify(candidate);
    const candidateHash = sha256(JSON.stringify({ tenantId: exact.tenantId, candidate }));
    return Object.freeze({ ...candidate, candidateJson, candidateHash });
  }
}
