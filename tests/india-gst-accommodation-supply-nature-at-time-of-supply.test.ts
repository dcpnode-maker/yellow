import { describe, expect, test } from "bun:test";
import {
  IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError,
  IndiaGstAccommodationSupplyNatureAtTimeOfSupplyValidationError,
  composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply,
} from "../src/contexts/tax-fiscal";

type Mutable = Record<PropertyKey, any>;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const digest = (value: unknown) => new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
const TENANT = id(29701), PROPERTY = id(29702), RESERVATION = id(29703), FOLIO = id(29704);
const SUPPLIER = id(29705), RECIPIENT_PARTY = id(29706), RECIPIENT = id(29707), LOCATION = id(29708);
const SUPPLIER_STATUS = id(29709), RECIPIENT_STATUS = id(29710), EXTENSION = id(29711), CLASSIFICATION = id(29712);
const SERVICE = id(29713), PAYMENT = id(29714), INVOICE = id(29715), LINEAGE = id(29716), HOLD = id(29717), ATTRIBUTION = id(29718), SEGMENT = id(29719);
const DATE = "2043-06-15";
const QUOTE = "a".repeat(64), SNAPSHOT = "b".repeat(64), HASH = "c".repeat(64);
const SUPPLIER_STATUS_EVIDENCE_HASH = digest({
  tenantId: TENANT,
  supplierGstRegistrationStatusId: SUPPLIER_STATUS,
  propertyNode: PROPERTY,
  supplierServiceLocation: { id: LOCATION, evidenceHash: "e".repeat(64) },
  supplier: { registrationId: SUPPLIER, evidenceHash: "d".repeat(64) },
  statusAsOf: DATE,
  gstRegistration: { status: "active", taxpayerType: "regular", source: "gst_common_portal", evidenceSha256: "c".repeat(64) },
  legalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS",
});
const RECIPIENT_STATUS_EVIDENCE_HASH = digest({
  tenantId: TENANT,
  recipientSezStatusId: RECIPIENT_STATUS,
  recipient: { registrationId: RECIPIENT, evidenceHash: "1".repeat(64) },
  statusAsOf: DATE,
  gstRegistration: { status: "active", taxpayerType: "regular", source: "gst_common_portal", evidenceSha256: "2".repeat(64) },
  sezStatus: "affirmatively_non_sez_regular",
  approval: null,
  legalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS",
});
const TOS_KEYS = [
  "serviceProvisionSnapshotId", "paymentReceiptSnapshotId", "invoiceIssueSnapshotId", "propertyNode", "reservationId",
  "reservationLineage", "attribution", "serviceProvisionDate", "paymentReceiptDate", "invoiceIssueDate", "deadlineDate",
  "candidateDates", "branch", "timeOfSupplyDate", "regime", "source", "legalRule", "ordinaryRegimeSource",
  "ordinaryRegimeEvidenceSha256", "invoiceSeries", "invoiceSerial", "supplierBooksEntryDate", "supplierBankCreditDate",
  "coverageScope", "serviceProvisionSource", "serviceProvisionLegalRule", "paymentReceiptSource", "paymentReceiptLegalRule",
  "invoiceIssueSource", "invoiceIssueLegalRule", "serviceProvisionEvidenceSha256", "paymentReceiptEvidenceSha256",
  "invoiceIssueEvidenceSha256", "amountMinor", "currency",
] as const;
const SUPPLIER_KEYS = [
  "supplierRegistrationId", "supplierGstRegistrationStatusId", "supplierServiceLocationId", "propertyNode", "reservationId",
  "statusAsOf", "timeOfSupplyDate", "result", "supplierServiceLocation", "supplier", "gstRegistration",
  "supplierRegistrationStatusEvidenceHash", "timeOfSupplyEvidenceHash", "timeOfSupply", "registrationLegalRule",
  "timeOfSupplyLegalRule",
] as const;
const RECIPIENT_KEYS = [
  "recipientPartyId", "recipientRegistrationId", "recipientSezStatusId", "propertyNode", "reservationId", "statusAsOf",
  "timeOfSupplyDate", "result", "recipient", "gstRegistration", "sezStatus", "approval",
  "recipientRegistrationStatusEvidenceHash", "timeOfSupplyEvidenceHash", "timeOfSupply", "recipientRegistrationLegalRule",
  "timeOfSupplyLegalRule",
] as const;
const SUPPLY_KEYS = [
  "propertyNode", "reservationId", "folioId", "supplyDate", "jurisdiction", "supplier", "recipient", "buyerAssociation",
  "classification", "placeOfSupply", "registeredStateComparison", "supplyNature", "determinationBasis", "sezDirection", "legalRule",
] as const;
const freeze = <T>(v: T, seen = new Set<object>()): T => {
  if (typeof v !== "object" || v === null || seen.has(v)) return v;
  seen.add(v); for (const k of Reflect.ownKeys(v)) freeze((v as Mutable)[k], seen);
  return Object.freeze(v);
};
const frozen = (v: unknown, seen = new Set<object>()): void => {
  if (typeof v !== "object" || v === null || seen.has(v)) return;
  seen.add(v); expect(Object.isFrozen(v)).toBeTrue();
  for (const k of Reflect.ownKeys(v)) frozen((v as Mutable)[k], seen);
};
const clone = <T>(v: T): T => structuredClone(v);

function supplyNature() {
  const jurisdiction = { extensionId: EXTENSION, ownerTenantId: TENANT, key: "in.order297.gst.27", version: "7", contentHash: HASH };
  const candidate = {
    propertyNode: PROPERTY, reservationId: RESERVATION, folioId: FOLIO, supplyDate: DATE, jurisdiction,
    supplier: { registrationId: SUPPLIER, evidenceHash: "d".repeat(64), stateCode: "27", serviceLocation: { id: LOCATION, evidenceHash: "e".repeat(64), kind: "principal_place_of_business", stateCode: "27" }, status: { id: SUPPLIER_STATUS, evidenceHash: SUPPLIER_STATUS_EVIDENCE_HASH, statusAsOf: DATE, taxpayerType: "regular", sezStatus: "affirmatively_non_sez_regular" } },
    recipient: { partyId: RECIPIENT_PARTY, registrationId: RECIPIENT, evidenceHash: "1".repeat(64), status: { id: RECIPIENT_STATUS, evidenceHash: RECIPIENT_STATUS_EVIDENCE_HASH, statusAsOf: DATE, taxpayerType: "regular", sezStatus: "affirmatively_non_sez_regular" } },
    buyerAssociation: { associationHash: "3".repeat(64), payloadHash: "4".repeat(64) },
    classification: { classificationId: CLASSIFICATION, evidenceHash: "5".repeat(64) },
    placeOfSupply: { candidateHash: "6".repeat(64), legalRule: "IGST_ACT_12_3_B", pos: "29" },
    registeredStateComparison: { candidateHash: "7".repeat(64), comparisonRule: "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS", stateRelationship: "different_state_or_union_territory" },
    supplyNature: "inter_state", determinationBasis: "ordinary_registered_state_comparison", sezDirection: "none", legalRule: "IGST_ACT_7_3",
  };
  const candidateJson = JSON.stringify(candidate);
  return freeze({ ...candidate, candidateJson, candidateHash: digest({ tenantId: TENANT, candidate }) });
}

function timeOfSupply(tenantBound = false) {
  const body = {
    serviceProvisionSnapshotId: SERVICE, paymentReceiptSnapshotId: PAYMENT, invoiceIssueSnapshotId: INVOICE,
    propertyNode: PROPERTY, reservationId: RESERVATION,
    reservationLineage: { lineageId: LINEAGE, holdBindingId: HOLD, attributionId: ATTRIBUTION, reservationId: RESERVATION, segmentId: SEGMENT, originQuoteHash: QUOTE, snapshotHash: SNAPSHOT, currency: "INR" },
    attribution: { originKind: "rate_quote", lineId: "room", revenueGroup: "room_revenue" }, serviceProvisionDate: "2043-06-01", paymentReceiptDate: DATE, invoiceIssueDate: "2043-07-01", deadlineDate: "2043-07-01", candidateDates: { invoiceIssueDate: "2043-07-01", paymentReceiptDate: DATE }, branch: "section13_2_a_invoice_or_payment", timeOfSupplyDate: DATE, regime: "ordinary_rule47_30_day", source: "governed_rule47_ordinary_regime_record", legalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY", ordinaryRegimeSource: "governed_rule47_ordinary_regime_record", ordinaryRegimeEvidenceSha256: "8".repeat(64), invoiceSeries: "FY2043", invoiceSerial: "000297", supplierBooksEntryDate: DATE, supplierBankCreditDate: DATE, coverageScope: "full_attribution", serviceProvisionSource: "governed_service_provision_record", serviceProvisionLegalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY", paymentReceiptSource: "governed_supplier_payment_receipt_record", paymentReceiptLegalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY", invoiceIssueSource: "governed_supplier_tax_invoice_record", invoiceIssueLegalRule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY", serviceProvisionEvidenceSha256: "9".repeat(64), paymentReceiptEvidenceSha256: "a".repeat(64), invoiceIssueEvidenceSha256: "b".repeat(64), amountMinor: "10500", currency: "INR",
  };
  return freeze({ ...body, evidenceHash: tenantBound ? digest({ tenantId: TENANT, ...body }) : digest(body) });
}

function supplier() {
  const tos = timeOfSupply(false);
  const evidence = {
    supplierRegistrationId: SUPPLIER,
    supplierGstRegistrationStatusId: SUPPLIER_STATUS,
    supplierServiceLocationId: LOCATION,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    statusAsOf: DATE,
    timeOfSupplyDate: DATE,
    result: "active_at_time_of_supply",
    supplierServiceLocation: { id: LOCATION, evidenceHash: "e".repeat(64) },
    supplier: { registrationId: SUPPLIER, evidenceHash: "d".repeat(64) },
    gstRegistration: { status: "active", taxpayerType: "regular", source: "gst_common_portal", evidenceSha256: "c".repeat(64) },
    supplierRegistrationStatusEvidenceHash: SUPPLIER_STATUS_EVIDENCE_HASH,
    timeOfSupplyEvidenceHash: tos.evidenceHash,
    timeOfSupply: tos,
    registrationLegalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS",
    timeOfSupplyLegalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY",
  };
  return freeze({ ...evidence, evidenceHash: digest({ tenantId: TENANT, ...evidence }) });
}

function recipient() {
  const tos = timeOfSupply(true);
  const evidence = {
    recipientPartyId: RECIPIENT_PARTY,
    recipientRegistrationId: RECIPIENT,
    recipientSezStatusId: RECIPIENT_STATUS,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    statusAsOf: DATE,
    timeOfSupplyDate: DATE,
    result: "active_recipient_registration_at_time_of_supply",
    recipient: { registrationId: RECIPIENT, evidenceHash: "1".repeat(64) },
    gstRegistration: { status: "active", taxpayerType: "regular", source: "gst_common_portal", evidenceSha256: "2".repeat(64) },
    sezStatus: "affirmatively_non_sez_regular",
    approval: null,
    recipientRegistrationStatusEvidenceHash: RECIPIENT_STATUS_EVIDENCE_HASH,
    timeOfSupplyEvidenceHash: tos.evidenceHash,
    timeOfSupply: tos,
    recipientRegistrationLegalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS",
    timeOfSupplyLegalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY",
  };
  return freeze({ ...evidence, evidenceHash: digest({ tenantId: TENANT, ...evidence }) });
}

const base = () => freeze({ tenantId: TENANT, supplyNature: supplyNature(), supplierRegistrationAtTimeOfSupply: supplier(), recipientRegistrationAtTimeOfSupply: recipient() });
const tx = (input: unknown) => input;
const bodyWithoutHash = (value: Mutable, keys: readonly string[]) => Object.fromEntries(keys.map((key) => [key, value[key]]));
const tosBody = (value: Mutable) => Object.fromEntries(TOS_KEYS.map((key) => [key, value[key]]));
const rehashTime = (value: Mutable, tenantBound: boolean) => {
  const body = tosBody(value);
  value.evidenceHash = tenantBound ? digest({ tenantId: TENANT, ...body }) : digest(body);
};
const rehashSupplier = (value: Mutable) => {
  value.timeOfSupplyEvidenceHash = value.timeOfSupply.evidenceHash;
  value.evidenceHash = digest({ tenantId: TENANT, ...bodyWithoutHash(value, SUPPLIER_KEYS) });
};
const rehashRecipient = (value: Mutable) => {
  value.timeOfSupplyEvidenceHash = value.timeOfSupply.evidenceHash;
  value.evidenceHash = digest({ tenantId: TENANT, ...bodyWithoutHash(value, RECIPIENT_KEYS) });
};
const rehashSupplyNature = (value: Mutable) => {
  const candidate = bodyWithoutHash(value, SUPPLY_KEYS);
  value.candidateJson = JSON.stringify(candidate);
  value.candidateHash = digest({ tenantId: TENANT, candidate });
};

describe("Order 297 complete-root GST applicability binding", () => {
  test("composes same transaction/date and returns minimized frozen evidence deterministically", () => {
    const input = base();
    const first = composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(tx(input) as never);
    const replay = composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(tx(input) as never);
    expect(first).toEqual(replay);
    expect(first.result).toBe("supply_nature_and_registrations_bound_at_time_of_supply");
    expect(first.propertyNode).toBe(PROPERTY);
    expect(first.reservationId).toBe(RESERVATION);
    expect(first.supplyDate).toBe(DATE);
    expect(first.supplierTimeOfSupplyEvidenceHash).toBe(input.supplierRegistrationAtTimeOfSupply.timeOfSupplyEvidenceHash);
    expect(first.recipientTimeOfSupplyEvidenceHash).toBe(input.recipientRegistrationAtTimeOfSupply.timeOfSupplyEvidenceHash);
    expect(first).not.toHaveProperty("timeOfSupplyEvidenceHash");
    expect(first).not.toHaveProperty("tenantId");
    expect(JSON.stringify(first)).not.toContain(TENANT);
    expect(Object.keys(first).sort()).toEqual([
      "evidenceHash", "folioId", "legalRule", "propertyNode", "recipientPartyId",
      "recipientRegistrationId", "recipientRegistrationStatusEvidenceHash", "recipientSezStatusId",
      "reservationId", "result", "sezDirection", "supplyDate", "supplyNature",
      "supplierGstRegistrationStatusId", "supplierRegistrationId", "supplierRegistrationStatusEvidenceHash",
      "supplierServiceLocationId", "timeOfSupplyDate", "supplierTimeOfSupplyEvidenceHash", "recipientTimeOfSupplyEvidenceHash", "determinationBasis",
    ].sort());
    expect(first).not.toHaveProperty("gstin");
    expect(first).not.toHaveProperty("address");
    frozen(first);
    expect(JSON.stringify(input)).toBe(JSON.stringify(base()));
  });

  test("rejects every root omission, surplus, thaw, proxy/accessor/symbol and malformed top-level shape", () => {
    const names = ["supplyNature", "supplierRegistrationAtTimeOfSupply", "recipientRegistrationAtTimeOfSupply"] as const;
    for (const name of names) {
      const missing = clone(base()) as Mutable; delete missing[name];
      expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(missing as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyValidationError);
      const surplus = clone(base()) as Mutable; surplus[name].surplus = true;
      expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(surplus as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError);
      const thaw = clone(base()) as Mutable; thaw[name] = clone(thaw[name]);
      expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(thaw as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError);
    }
    const extra = { ...base(), extra: true };
    expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(extra as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyValidationError);
    expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply([] as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyValidationError);
    const accessor = clone(base()) as Mutable; Object.defineProperty(accessor, "tenantId", { enumerable: true, get: () => TENANT });
    expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(accessor as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyValidationError);
    const symbolic = clone(base()) as Mutable; symbolic[Symbol("hostile")] = true;
    expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(symbolic as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyValidationError);
    expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(new Proxy(base(), {}) as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyValidationError);

    const nestedOmissions: Array<["supplyNature" | "supplierRegistrationAtTimeOfSupply" | "recipientRegistrationAtTimeOfSupply", string]> = [
      ["supplyNature", "jurisdiction"],
      ["supplyNature", "candidateHash"],
      ["supplierRegistrationAtTimeOfSupply", "supplierServiceLocation"],
      ["supplierRegistrationAtTimeOfSupply", "timeOfSupply"],
      ["recipientRegistrationAtTimeOfSupply", "recipient"],
      ["recipientRegistrationAtTimeOfSupply", "timeOfSupply"],
    ];
    for (const [root, key] of nestedOmissions) {
      const candidate = clone(base()) as Mutable;
      delete candidate[root][key];
      freeze(candidate);
      expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(candidate as never)).toThrow();
    }
  });

  test("fails closed on tenant, property, reservation, registration, location, date, lineage, hash and nature crossings", () => {
    const cases: Array<(x: Mutable) => void> = [
      (x) => { x.tenantId = id(29790); },
      (x) => { x.supplyNature.propertyNode = id(29791); },
      (x) => { x.supplyNature.reservationId = id(29792); },
      (x) => { x.supplyNature.supplier.registrationId = id(29793); },
      (x) => { x.supplyNature.supplier.serviceLocation.id = id(29794); },
      (x) => { x.supplyNature.supplyDate = "2043-06-14"; },
      (x) => { x.supplierRegistrationAtTimeOfSupply.statusAsOf = "2043-06-14"; },
      (x) => { x.recipientRegistrationAtTimeOfSupply.timeOfSupplyDate = "2043-06-14"; },
      (x) => { x.supplierRegistrationAtTimeOfSupply.supplierRegistrationStatusEvidenceHash = "0".repeat(64); },
      (x) => { x.recipientRegistrationAtTimeOfSupply.recipientRegistrationStatusEvidenceHash = "0".repeat(64); },
      (x) => { x.supplierRegistrationAtTimeOfSupply.timeOfSupplyEvidenceHash = "0".repeat(64); },
      (x) => { x.recipientRegistrationAtTimeOfSupply.timeOfSupplyEvidenceHash = "0".repeat(64); },
      (x) => { x.supplierRegistrationAtTimeOfSupply.timeOfSupply.reservationLineage.lineageId = id(29793); },
      (x) => { x.supplierRegistrationAtTimeOfSupply.timeOfSupply.reservationLineage.holdBindingId = id(29794); },
      (x) => { x.supplierRegistrationAtTimeOfSupply.timeOfSupply.reservationLineage.attributionId = id(29795); },
      (x) => { x.supplierRegistrationAtTimeOfSupply.timeOfSupply.reservationLineage.reservationId = id(29796); },
      (x) => { x.supplierRegistrationAtTimeOfSupply.timeOfSupply.reservationLineage.segmentId = id(29797); },
      (x) => { x.supplierRegistrationAtTimeOfSupply.timeOfSupply.reservationLineage.originQuoteHash = "0".repeat(64); },
      (x) => { x.supplierRegistrationAtTimeOfSupply.timeOfSupply.reservationLineage.snapshotHash = "0".repeat(64); },
      (x) => { x.supplierRegistrationAtTimeOfSupply.timeOfSupply.reservationLineage.currency = "CAD"; },
      (x) => { x.supplierRegistrationAtTimeOfSupply.timeOfSupply.attribution.lineId = "spa"; },
      (x) => { x.supplierRegistrationAtTimeOfSupply.timeOfSupply.candidateDates.paymentReceiptDate = "2043-06-14"; },
      (x) => { x.supplyNature.legalRule = "IGST_ACT_8_2"; },
      (x) => { x.supplierRegistrationAtTimeOfSupply.result = "inactive"; },
      (x) => { x.recipientRegistrationAtTimeOfSupply.result = "inactive"; },
    ];
    for (const mutate of cases) {
      const candidate = clone(base()) as Mutable; mutate(candidate); freeze(candidate);
      expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(candidate as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError);
    }
  });

  test("rejects self-consistent Order287 status-evidence crossings after candidate replay", () => {
    const supplierStatus = clone(base()) as Mutable;
    supplierStatus.supplyNature.supplier.status.evidenceHash = "0".repeat(64);
    rehashSupplyNature(supplierStatus.supplyNature);
    freeze(supplierStatus);
    expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(supplierStatus as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError);

    const recipientStatus = clone(base()) as Mutable;
    recipientStatus.supplyNature.recipient.status.evidenceHash = "0".repeat(64);
    rehashSupplyNature(recipientStatus.supplyNature);
    freeze(recipientStatus);
    expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(recipientStatus as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError);
  });

  test("rejects self-consistent non-UUID reservation segments in either predecessor timing root", () => {
    const candidate = clone(base()) as Mutable;
    candidate.supplierRegistrationAtTimeOfSupply.timeOfSupply.reservationLineage.segmentId = "not-a-uuid";
    candidate.recipientRegistrationAtTimeOfSupply.timeOfSupply.reservationLineage.segmentId = "not-a-uuid";
    rehashTime(candidate.supplierRegistrationAtTimeOfSupply.timeOfSupply, false);
    rehashTime(candidate.recipientRegistrationAtTimeOfSupply.timeOfSupply, true);
    rehashSupplier(candidate.supplierRegistrationAtTimeOfSupply);
    rehashRecipient(candidate.recipientRegistrationAtTimeOfSupply);
    freeze(candidate);
    expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(candidate as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError);
  });

  test("rejects malformed regular-recipient approval even when its outer hash is recomputed", () => {
    const candidate = clone(base()) as Mutable;
    candidate.recipientRegistrationAtTimeOfSupply.approval = {
      form: "invalid",
      reference: 7,
      validity: null,
      status: "expired",
      evidenceSha256: "0".repeat(64),
    };
    rehashRecipient(candidate.recipientRegistrationAtTimeOfSupply);
    freeze(candidate);
    expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(candidate as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError);
  });

  test("rejects changed supplier GST evidence with a stale status evidence hash", () => {
    const candidate = clone(base()) as Mutable;
    candidate.supplierRegistrationAtTimeOfSupply.gstRegistration.evidenceSha256 = "0".repeat(64);
    rehashSupplier(candidate.supplierRegistrationAtTimeOfSupply);
    freeze(candidate);
    expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(candidate as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError);
  });

  test("rejects self-consistent taxpayer and SEZ semantic crossings between Order287 and timing roots", () => {
    const supplierCrossing = clone(base()) as Mutable;
    supplierCrossing.supplyNature.supplier.status.taxpayerType = "sez_unit";
    supplierCrossing.supplyNature.supplier.status.sezStatus = "sez_unit";
    supplierCrossing.supplyNature.determinationBasis = "sez_override";
    supplierCrossing.supplyNature.sezDirection = "by_sez";
    supplierCrossing.supplyNature.legalRule = "IGST_ACT_7_5_B";
    rehashSupplyNature(supplierCrossing.supplyNature);
    freeze(supplierCrossing);
    expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(supplierCrossing as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError);

    const recipientCrossing = clone(base()) as Mutable;
    recipientCrossing.supplyNature.recipient.status.taxpayerType = "sez_unit";
    recipientCrossing.supplyNature.recipient.status.sezStatus = "sez_unit";
    recipientCrossing.supplyNature.determinationBasis = "sez_override";
    recipientCrossing.supplyNature.sezDirection = "to_sez";
    recipientCrossing.supplyNature.legalRule = "IGST_ACT_7_5_B";
    rehashSupplyNature(recipientCrossing.supplyNature);
    freeze(recipientCrossing);
    expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(recipientCrossing as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError);
  });

  test("rejects self-consistent roots using the wrong predecessor-specific time hash algorithm", () => {
    const supplierTenantHash = clone(base()) as Mutable;
    rehashTime(supplierTenantHash.supplierRegistrationAtTimeOfSupply.timeOfSupply, true);
    rehashSupplier(supplierTenantHash.supplierRegistrationAtTimeOfSupply);
    freeze(supplierTenantHash);
    expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(supplierTenantHash as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError);

    const recipientPublicHash = clone(base()) as Mutable;
    rehashTime(recipientPublicHash.recipientRegistrationAtTimeOfSupply.timeOfSupply, false);
    rehashRecipient(recipientPublicHash.recipientRegistrationAtTimeOfSupply);
    freeze(recipientPublicHash);
    expect(() => composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(recipientPublicHash as never)).toThrow(IndiaGstAccommodationSupplyNatureAtTimeOfSupplyConflictError);
  });

  test("returns only applicability evidence and has no write, clock, network or downstream tax authority", async () => {
    const result = composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(base() as never) as Mutable;
    for (const forbidden of ["BuyerDtls", "Pos", "SupTyp", "IgstOnIntra", "rate", "tax", "levy", "amount", "document", "journal", "posting", "IRP", "submission"]) expect(result).not.toHaveProperty(forbidden);
    const source = await Bun.file(new URL("../src/contexts/tax-fiscal/india-gst-accommodation-supply-nature-at-time-of-supply.ts", import.meta.url)).text();
    expect(source).not.toMatch(/Date\.now|new Date|current_date|fetch\s*\(|INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|Tx|SQL|Database|SELECT/i);
  });
});
