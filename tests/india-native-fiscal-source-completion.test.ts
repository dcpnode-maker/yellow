import { describe, expect, test } from "bun:test";

import {
  adaptIndiaGstAccommodationExternalInvoiceSource,
  deriveIndiaGstAccommodationInvoiceSource,
  deriveIndiaGstAccommodationNativeInvoiceSource,
  validateIndiaGstAccommodationNativeInvoiceSourceResult,
  type IndiaGstAccommodationNativeInvoiceSourceInput,
} from "../src/contexts/tax-fiscal/india-gst-accommodation-invoice-source";
import { deriveIndiaGstAccommodationOrdinaryTimeOfSupplyDates } from "../src/contexts/tax-fiscal/india-gst-accommodation-time-of-supply";
import { composeIndiaGstRegistrationAtNativeTimeOfSupply } from "../src/contexts/tax-fiscal/india-gst-registration-at-time-of-supply";
import { composeIndiaGstRecipientRegistrationAtNativeTimeOfSupply } from "../src/contexts/tax-fiscal/india-gst-recipient-registration-at-time-of-supply";
import { composeIndiaGstAccommodationNativeSupplyNatureAtTimeOfSupply } from "../src/contexts/tax-fiscal/india-gst-accommodation-supply-nature-at-time-of-supply";
import type { IndiaGstAccommodationHistoricalResolutionResult } from "../src/contexts/tax-fiscal/india-gst-accommodation-historical-resolution";
import type { IndiaGstAccommodationOrdinaryRegimeEvidenceResult } from "../src/contexts/tax-fiscal/india-gst-accommodation-ordinary-regime-evidence";
import { deriveIndiaGstAccommodationRateChangeDate } from "../src/contexts/tax-fiscal/india-gst-accommodation-rate-change-date";
import type { IndiaGstAccommodationRateVersionPairResult } from "../src/contexts/tax-fiscal/india-gst-accommodation-rate-version-pair";
import {
  deriveIndiaGstSection14PaymentReceiptDate,
} from "../src/contexts/tax-fiscal/india-gst-section14-payment-receipt-date";
import { resolveIndiaGstSection14PaymentProviso } from "../src/contexts/tax-fiscal/india-gst-section14-payment-proviso";
import {
  deriveIndiaGstSection14RateSelectionFromEvidence,
  type IndiaGstSection14PaymentEvidence,
} from "../src/contexts/tax-fiscal/india-gst-section14-rate-selection";
import { deriveIndiaGstSection14WorkingDayCalendarEvidence } from "../src/contexts/tax-fiscal/india-gst-section14-working-day-calendar-evidence";

type Mutable = Record<PropertyKey, any>;

const id = (n: number): string =>
  `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const TENANT = id(43401);
const PROPERTY = id(43402);
const RESERVATION = id(43403);
const LINEAGE = id(43404);
const HOLD = id(43405);
const ATTRIBUTION = id(43406);
const SEGMENT = id(43407);
const SERVICE = id(43408);
const PAYMENT = id(43409);
const ORDINARY = id(43410);
const TIMING = id(43411);
const DOCUMENT = id(43412);
const INVOICE = id(43413);
const FOLIO = id(43414);
const SUPPLIER_REGISTRATION = id(43415);
const SUPPLIER_STATUS = id(43416);
const SUPPLIER_LOCATION = id(43417);
const RECIPIENT_PARTY = id(43418);
const RECIPIENT_REGISTRATION = id(43419);
const RECIPIENT_STATUS = id(43420);
const JURISDICTION = id(43421);
const CLASSIFICATION = id(43422);
const PREDECESSOR = "a806f516-fed6-5768-b310-94aa03286adb";
const SUCCESSOR = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const PRE_FROM = "2022-07-17T18:30:00.000000Z";
const CUTOVER = "2025-09-21T18:30:00.000000Z" as const;
const SOURCE20 = "ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901" as const;
const SOURCE04 = "c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716" as const;
const SOURCE15 = "46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289" as const;
const HASH = (character: string): string => character.repeat(64);

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
}

function canonicalHash(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(stable(value)).digest("hex");
}

function insertionHash(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function freeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) freeze((value as Mutable)[key], seen);
  return Object.freeze(value);
}

function content(lowerRate: 0.12 | 0.05, itcEligible: boolean) {
  return {
    country: "IN",
    price_display: "tax_exclusive",
    rounding: "document",
    taxes: [{
      code: "GST_ROOM",
      name: "GST on accommodation",
      mode: "slab_percent",
      slab_basis: "transaction_value",
      applies_to: ["room_revenue"],
      slabs: [
        { upto_minor: 750000, rate: lowerRate, itc_eligible: itcEligible },
        { upto_minor: null, rate: 0.18, itc_eligible: true },
      ],
    }],
  };
}

function version(
  extensionId: string,
  number: 1 | 2,
  status: "retired" | "active",
  lowerRate: 0.12 | 0.05,
  itcEligible: boolean,
  from: string,
  to: string | null,
) {
  const body = content(lowerRate, itcEligible);
  return {
    extensionId,
    key: "in-gst-lodging" as const,
    version: number,
    status,
    effectiveFromInstant: from,
    effectiveToInstant: to,
    content: body,
    contentHash: canonicalHash(body),
    gstRoomSlabs: [
      { uptoMinor: 750000, rate: lowerRate, itcEligible },
      { uptoMinor: null, rate: 0.18, itcEligible: true },
    ] as const,
  };
}

function pair(): IndiaGstAccommodationRateVersionPairResult {
  const predecessor = version(PREDECESSOR, 1, "retired", 0.12, true, PRE_FROM, CUTOVER);
  const successor = version(SUCCESSOR, 2, "active", 0.05, false, CUTOVER, null);
  const body = {
    propertyNode: PROPERTY,
    predecessor,
    successor,
    cutoverInstant: CUTOVER,
    statutoryLowerBandDelta: {
      thresholdMinor: 750000 as const,
      predecessorRate: 0.12 as const,
      predecessorItcEligible: true as const,
      successorRate: 0.05 as const,
      successorItcEligible: false as const,
      predecessorHasNilBand: false as const,
      successorHasNilBand: false as const,
    },
    sourceHashes: {
      notification20_2019: SOURCE20,
      notification04_2022: SOURCE04,
      notification15_2025: SOURCE15,
    },
  };
  return freeze({
    ...body,
    evidenceHash: canonicalHash({
      tenantId: TENANT,
      predecessorOwnerTenantId: null,
      successorOwnerTenantId: null,
      ...body,
    }),
  });
}

function previousDate(date: string): string {
  const instant = new Date(`${date}T00:00:00.000Z`);
  instant.setUTCDate(instant.getUTCDate() - 1);
  return instant.toISOString().slice(0, 10);
}

function history(
  businessDate: string,
  rateVersionPair: IndiaGstAccommodationRateVersionPairResult = pair(),
): IndiaGstAccommodationHistoricalResolutionResult {
  const selectedExtension = businessDate < "2025-09-22"
    ? rateVersionPair.predecessor
    : rateVersionPair.successor;
  const body = {
    property: { propertyNode: PROPERTY, propertyTimezone: "Asia/Kolkata" },
    businessDay: {
      businessDate,
      fromInstant: `${previousDate(businessDate)}T18:30:00.000000Z`,
      toInstant: `${businessDate}T18:30:00.000000Z`,
    },
    assignment: {
      jurisdictionKey: "in-gst-lodging" as const,
      effectiveFrom: "2020-01-01",
      effectiveTo: null,
    },
    selectedExtension,
    rateVersionPair,
  };
  return freeze({ ...body, evidenceHash: canonicalHash({ tenantId: TENANT, ...body }) });
}

function evidenceRoots(serviceDate: string, booksDate: string, bankDate: string) {
  const reservationLineage = freeze({
    lineageId: LINEAGE,
    holdBindingId: HOLD,
    attributionId: ATTRIBUTION,
    reservationId: RESERVATION,
    segmentId: SEGMENT,
    originQuoteHash: HASH("a"),
    snapshotHash: HASH("b"),
    currency: "INR",
  });
  const attribution = freeze({
    originKind: "rate_quote" as const,
    lineId: "room" as const,
    revenueGroup: "room_revenue" as const,
  });
  const service = freeze({
    serviceProvisionSnapshotId: SERVICE,
    propertyNode: PROPERTY,
    reservationLineage,
    attribution,
    serviceProvisionDate: serviceDate,
    serviceProvisionSource: "governed_service_provision_record" as const,
    serviceProvisionEvidenceSha256: HASH("c"),
    legalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" as const,
    evidenceHash: HASH("d"),
  });
  const serviceProvision = freeze({
    serviceProvisionSnapshotId: SERVICE,
    serviceProvisionDate: serviceDate,
    serviceProvisionSource: "governed_service_provision_record" as const,
    serviceProvisionEvidenceSha256: HASH("c"),
    legalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" as const,
    reservationLineage,
    attribution,
  });
  const paymentReceiptDate = booksDate < bankDate ? booksDate : bankDate;
  const payment = freeze({
    paymentReceiptSnapshotId: PAYMENT,
    propertyNode: PROPERTY,
    serviceProvision,
    supplierBooksEntryDate: booksDate,
    supplierBankCreditDate: bankDate,
    paymentReceiptDate,
    coverageScope: "full_attribution" as const,
    amountMinor: "10500",
    currency: "INR",
    paymentReceiptSource: "governed_supplier_payment_receipt_record" as const,
    paymentReceiptEvidenceSha256: HASH("e"),
    legalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY" as const,
    evidenceHash: HASH("f"),
  });
  return { service, payment };
}

function paymentEvidence(
  rateVersionPair: IndiaGstAccommodationRateVersionPairResult,
  booksDate: string,
  bankDate: string,
): IndiaGstSection14PaymentEvidence {
  const rateChangeDateEvidence = deriveIndiaGstAccommodationRateChangeDate({
    tenantId: TENANT,
    rateVersionPair,
  });
  const paymentProvisoEvidence = resolveIndiaGstSection14PaymentProviso({
    supplierBooksEntryDate: booksDate,
    supplierBankCreditDate: bankDate,
    rateChangeDate: rateChangeDateEvidence.rateChangeDate,
  });
  if (paymentProvisoEvidence.state === "proviso_not_triggered_on_recorded_dates") {
    return freeze({ kind: "safe_ordinary_receipt" as const, paymentProvisoEvidence });
  }
  const calendarEvidence = freeze({
    jurisdiction: "IN" as const,
    authorityId: "INDIA_GST_GOVERNED_WORKING_DAY_CALENDAR" as const,
    sourceDigestSha256: HASH("9"),
    days: ["23", "24", "25", "26", "27", "28", "29", "30"].map((day) => ({
      date: `2025-09-${day}`,
      state: "working" as const,
    })),
  });
  const workingDayEvidence = deriveIndiaGstSection14WorkingDayCalendarEvidence({
    tenantId: TENANT,
    rateChangeDate: rateChangeDateEvidence.rateChangeDate,
    throughDate: "2025-09-30",
    calendarEvidence,
  });
  return freeze({
    kind: "calendar_governed_receipt" as const,
    paymentProvisoEvidence,
    throughDate: "2025-09-30",
    calendarEvidence,
    workingDayEvidence,
    paymentReceiptEvidence: deriveIndiaGstSection14PaymentReceiptDate({
      tenantId: TENANT,
      rateVersionPair,
      rateChangeDateEvidence,
      supplierBooksEntryDate: booksDate,
      supplierBankCreditDate: bankDate,
      paymentProvisoEvidence,
      throughDate: "2025-09-30",
      calendarEvidence,
      workingDayEvidence,
    }),
  });
}

function nativeInput(
  serviceDate: string,
  booksDate: string,
  bankDate: string,
  invoiceDate: string,
  section14TimeOfSupplyDate?: string,
  section14PaymentReceiptDate?: string,
): IndiaGstAccommodationNativeInvoiceSourceInput {
  const rateVersionPair = pair();
  const rateChangeDateEvidence = deriveIndiaGstAccommodationRateChangeDate({
    tenantId: TENANT,
    rateVersionPair,
  });
  const { service, payment } = evidenceRoots(serviceDate, booksDate, bankDate);
  const ordinaryDates = deriveIndiaGstAccommodationOrdinaryTimeOfSupplyDates({
    serviceProvisionDate: serviceDate,
    paymentReceiptDate: payment.paymentReceiptDate,
    invoiceIssueDate: invoiceDate,
  });
  const resolutionDates = {
    serviceProvision: serviceDate,
    invoiceIssue: invoiceDate,
    supplierBooksEntry: booksDate,
    supplierBankCredit: bankDate,
    paymentReceipt: section14PaymentReceiptDate ?? payment.paymentReceiptDate,
    timeOfSupply: section14TimeOfSupplyDate ?? ordinaryDates.timeOfSupplyDate,
  };
  const distinctMembers = new Set(Object.values(resolutionDates).map((date) =>
    date < "2025-09-22" ? "predecessor" : "successor"));
  const recordedOrdinaryRegime: IndiaGstAccommodationOrdinaryRegimeEvidenceResult = freeze({
    ordinaryRegimeEvidenceId: ORDINARY,
    serviceProvisionSnapshotId: SERVICE,
    regime: "ordinary_rule47_30_day" as const,
    ordinaryRegimeSource: "governed_rule47_ordinary_regime_record" as const,
    legalBasis: "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT" as const,
    ordinaryRegimeEvidenceSha256: HASH("1"),
    evidenceHash: HASH("2"),
    created: true,
    replayed: false,
  });
  const { created: _created, replayed: _replayed, ...ordinaryRegimeProjection } = recordedOrdinaryRegime;
  return {
    kind: "native_current_transaction",
    tenantId: TENANT,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    serviceProvision: service,
    paymentReceipt: payment,
    ordinaryRegime: freeze(ordinaryRegimeProjection),
    nativeTiming: freeze({
      nativeTimingId: TIMING,
      prospectiveDocumentId: DOCUMENT,
      propertyNode: PROPERTY,
      reservationId: RESERVATION,
      serviceProvisionSnapshotId: SERVICE,
      paymentReceiptSnapshotId: PAYMENT,
      ordinaryRegimeEvidenceId: ORDINARY,
      invoiceIssueDate: invoiceDate,
      evidenceHash: HASH("3"),
    }),
    rateVersionPair,
    rateChangeDateEvidence,
    historicalResolutions: freeze({
      serviceProvision: history(resolutionDates.serviceProvision, rateVersionPair),
      invoiceIssue: history(resolutionDates.invoiceIssue, rateVersionPair),
      supplierBooksEntry: history(resolutionDates.supplierBooksEntry, rateVersionPair),
      supplierBankCredit: history(resolutionDates.supplierBankCredit, rateVersionPair),
      paymentReceipt: history(resolutionDates.paymentReceipt, rateVersionPair),
      timeOfSupply: history(resolutionDates.timeOfSupply, rateVersionPair),
    }),
    section14PaymentEvidence: distinctMembers.size === 1
      ? null
      : paymentEvidence(rateVersionPair, booksDate, bankDate),
  };
}

function externalTimeOfSupply(input: IndiaGstAccommodationNativeInvoiceSourceInput) {
  const dates = deriveIndiaGstAccommodationOrdinaryTimeOfSupplyDates({
    serviceProvisionDate: input.serviceProvision.serviceProvisionDate,
    paymentReceiptDate: input.paymentReceipt.paymentReceiptDate,
    invoiceIssueDate: input.nativeTiming.invoiceIssueDate,
  });
  const evidence = {
    serviceProvisionSnapshotId: SERVICE,
    paymentReceiptSnapshotId: PAYMENT,
    invoiceIssueSnapshotId: INVOICE,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    reservationLineage: input.serviceProvision.reservationLineage,
    attribution: input.serviceProvision.attribution,
    serviceProvisionDate: input.serviceProvision.serviceProvisionDate,
    paymentReceiptDate: input.paymentReceipt.paymentReceiptDate,
    invoiceIssueDate: input.nativeTiming.invoiceIssueDate,
    deadlineDate: dates.deadlineDate,
    candidateDates: dates.candidateDates,
    branch: dates.branch,
    timeOfSupplyDate: dates.timeOfSupplyDate,
    regime: "ordinary_rule47_30_day" as const,
    source: "governed_rule47_ordinary_regime_record" as const,
    legalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY" as const,
    ordinaryRegimeEvidenceSha256: HASH("1"),
    invoiceSeries: "FY2025",
    invoiceSerial: "434",
    supplierBooksEntryDate: input.paymentReceipt.supplierBooksEntryDate,
    supplierBankCreditDate: input.paymentReceipt.supplierBankCreditDate,
    coverageScope: "full_attribution" as const,
    serviceProvisionSource: "governed_service_provision_record" as const,
    serviceProvisionLegalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" as const,
    paymentReceiptSource: "governed_supplier_payment_receipt_record" as const,
    paymentReceiptLegalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY" as const,
    invoiceIssueSource: "governed_supplier_tax_invoice_record" as const,
    invoiceIssueLegalRule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY" as const,
    serviceProvisionEvidenceSha256: input.serviceProvision.serviceProvisionEvidenceSha256,
    paymentReceiptEvidenceSha256: input.paymentReceipt.paymentReceiptEvidenceSha256,
    invoiceIssueEvidenceSha256: HASH("7"),
    amountMinor: input.paymentReceipt.amountMinor,
    currency: "INR",
  };
  return freeze({ ...evidence, evidenceHash: insertionHash({ tenantId: TENANT, ...evidence }) });
}

function nativeRegistrationComposition(source: ReturnType<typeof deriveIndiaGstAccommodationNativeInvoiceSource>) {
  const statusAsOf = source.timing.timeOfSupplyDate;
  const supplierServiceLocation = freeze({ id: SUPPLIER_LOCATION, evidenceHash: HASH("4") });
  const supplierIdentity = freeze({ registrationId: SUPPLIER_REGISTRATION, evidenceHash: HASH("5") });
  const supplierGst = freeze({ status: "active" as const, taxpayerType: "regular" as const, source: "gst_common_portal" as const, evidenceSha256: HASH("6") });
  const supplierStatusHash = insertionHash({ tenantId: TENANT, supplierGstRegistrationStatusId: SUPPLIER_STATUS, propertyNode: PROPERTY, supplierServiceLocation, supplier: supplierIdentity, statusAsOf, gstRegistration: supplierGst, legalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS" });
  const supplier = composeIndiaGstRegistrationAtNativeTimeOfSupply(freeze({
    tenantId: TENANT,
    supplierRegistrationStatus: freeze({ supplierRegistrationId: SUPPLIER_REGISTRATION, supplierGstRegistrationStatusId: SUPPLIER_STATUS, supplierServiceLocationId: SUPPLIER_LOCATION, propertyNode: PROPERTY, statusAsOf, supplierServiceLocation, supplier: supplierIdentity, gstRegistration: supplierGst, supplierRegistrationStatusEvidenceHash: supplierStatusHash, registrationLegalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS" as const }),
    invoiceSource: source,
  }));

  const recipientIdentity = freeze({ registrationId: RECIPIENT_REGISTRATION, evidenceHash: HASH("7") });
  const recipientGst = freeze({ status: "active" as const, taxpayerType: "regular" as const, source: "gst_common_portal" as const, evidenceSha256: HASH("8") });
  const recipientStatusHash = insertionHash({ tenantId: TENANT, recipientSezStatusId: RECIPIENT_STATUS, recipient: { partyId: RECIPIENT_PARTY, registrationId: RECIPIENT_REGISTRATION, evidenceHash: recipientIdentity.evidenceHash }, statusAsOf, gstRegistration: recipientGst, sezStatus: "affirmatively_non_sez_regular", approval: null, legalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS" });
  const recipient = composeIndiaGstRecipientRegistrationAtNativeTimeOfSupply(freeze({
    tenantId: TENANT,
    recipientRegistrationStatus: freeze({ recipientPartyId: RECIPIENT_PARTY, recipientRegistrationId: RECIPIENT_REGISTRATION, recipientSezStatusId: RECIPIENT_STATUS, statusAsOf, recipient: recipientIdentity, gstRegistration: recipientGst, sezStatus: "affirmatively_non_sez_regular" as const, approval: null, recipientRegistrationStatusEvidenceHash: recipientStatusHash, recipientRegistrationLegalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS" as const }),
    invoiceSource: source,
  }));

  const supplyHead = {
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    folioId: FOLIO,
    supplyDate: statusAsOf,
    jurisdiction: freeze({ extensionId: JURISDICTION, ownerTenantId: null, key: "in-gst-lodging", version: "2", contentHash: HASH("9") }),
    supplier: freeze({ registrationId: SUPPLIER_REGISTRATION, evidenceHash: supplierIdentity.evidenceHash, stateCode: "29", serviceLocation: freeze({ id: SUPPLIER_LOCATION, evidenceHash: supplierServiceLocation.evidenceHash, kind: "principal_place_of_business" as const, stateCode: "29" }), status: freeze({ id: SUPPLIER_STATUS, evidenceHash: supplierStatusHash, statusAsOf, taxpayerType: "regular" as const, sezStatus: "affirmatively_non_sez_regular" as const }) }),
    recipient: freeze({ partyId: RECIPIENT_PARTY, registrationId: RECIPIENT_REGISTRATION, evidenceHash: recipientIdentity.evidenceHash, status: freeze({ id: RECIPIENT_STATUS, evidenceHash: recipientStatusHash, statusAsOf, taxpayerType: "regular" as const, sezStatus: "affirmatively_non_sez_regular" as const }) }),
    buyerAssociation: freeze({ associationHash: HASH("a"), payloadHash: HASH("b") }),
    classification: freeze({ classificationId: CLASSIFICATION, evidenceHash: HASH("c") }),
    placeOfSupply: freeze({ candidateHash: HASH("d"), legalRule: "IGST_ACT_12_3_B" as const, pos: "29" }),
    registeredStateComparison: freeze({ candidateHash: HASH("e"), comparisonRule: "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS" as const, stateRelationship: "same_state_or_union_territory" as const }),
    supplyNature: "intra_state" as const,
    determinationBasis: "ordinary_registered_state_comparison" as const,
    sezDirection: "none" as const,
    legalRule: "IGST_ACT_8_2" as const,
  };
  const candidateJson = JSON.stringify(supplyHead);
  const supplyNature = freeze({ ...supplyHead, candidateJson, candidateHash: insertionHash({ tenantId: TENANT, candidate: supplyHead }) });
  const composed = composeIndiaGstAccommodationNativeSupplyNatureAtTimeOfSupply({ tenantId: TENANT, supplyNature, supplierRegistrationAtTimeOfSupply: supplier, recipientRegistrationAtTimeOfSupply: recipient });
  return { source, supplier, recipient, supplyNature, composed };
}

describe("Order 434 native/external invoice timing and rate source", () => {
  test("uses ordinary Rule47/Section13 and whole-day history without inventing Section14 or an external invoice", () => {
    const input = nativeInput("2026-01-01", "2026-01-03", "2026-01-04", "2026-01-02");
    expect(Object.keys(input.ordinaryRegime).sort()).toEqual([
      "evidenceHash", "legalBasis", "ordinaryRegimeEvidenceId",
      "ordinaryRegimeEvidenceSha256", "ordinaryRegimeSource", "regime",
      "serviceProvisionSnapshotId",
    ].sort());
    const actual = deriveIndiaGstAccommodationInvoiceSource(input);
    expect(actual.kind).toBe("native_current_transaction");
    if (actual.kind !== "native_current_transaction") throw new Error("native result expected");
    expect(actual.timing).toMatchObject({
      invoiceIssueDate: "2026-01-02",
      deadlineDate: "2026-01-31",
      branch: "section13_2_a_invoice_or_payment",
      timeOfSupplyDate: "2026-01-02",
    });
    expect(actual.rateSource.kind).toBe("ordinary_section13_single_version");
    expect(actual.rateSource).not.toHaveProperty("section14");
    expect(actual.rateSource).not.toHaveProperty("rateChangeDate");
    expect(JSON.stringify(actual)).not.toContain("governed_supplier_tax_invoice_record");
    expect(JSON.stringify(actual)).not.toContain("invoiceSeries");
    expect(JSON.stringify(actual)).not.toContain("invoiceSerial");
    expect(Object.isFrozen(actual)).toBeTrue();
    expect(Object.isFrozen(actual.timing.predecessorHashes)).toBeTrue();
  });

  test("keeps the native Rule47 day-30/day-31 boundary exact", () => {
    const timely = deriveIndiaGstAccommodationNativeInvoiceSource(
      nativeInput("2026-01-01", "2026-02-02", "2026-02-03", "2026-01-31"),
    );
    expect(timely.timing.deadlineDate).toBe("2026-01-31");
    expect(timely.timing.branch).toBe("section13_2_a_invoice_or_payment");
    expect(timely.timing.timeOfSupplyDate).toBe("2026-01-31");

    const late = deriveIndiaGstAccommodationNativeInvoiceSource(
      nativeInput("2026-01-01", "2026-02-02", "2026-02-03", "2026-02-01"),
    );
    expect(late.timing.deadlineDate).toBe("2026-01-31");
    expect(late.timing.branch).toBe("section13_2_b_service_or_payment");
    expect(late.timing.timeOfSupplyDate).toBe("2026-01-01");
    expect(late.rateSource.kind).toBe("ordinary_section13_single_version");
  });

  test("reuses the genuine Section14 core for all six admitted cross-version arrangements", () => {
    const cases = [
      ["2025-09-21", "2025-09-23", "2025-09-24", "2025-09-23", "2025-09-23", "supply_before_invoice_after_payment_after", "successor"],
      ["2025-09-21", "2025-09-23", "2025-09-24", "2025-09-21", "2025-09-21", "supply_invoice_before_payment_after", "predecessor"],
      ["2025-09-21", "2025-09-20", "2025-09-21", "2025-09-23", "2025-09-20", "supply_payment_before_invoice_after", "predecessor"],
      ["2025-09-23", "2025-09-23", "2025-09-24", "2025-09-21", "2025-09-23", "supply_after_invoice_before_payment_after", "successor"],
      ["2025-09-23", "2025-09-20", "2025-09-21", "2025-09-21", "2025-09-20", "supply_after_invoice_payment_before", "predecessor"],
      ["2025-09-23", "2025-09-20", "2025-09-21", "2025-09-23", "2025-09-23", "supply_invoice_after_payment_before", "successor"],
    ] as const;
    for (const [service, books, bank, invoice, section14Date, statutoryCase, side] of cases) {
      const actual = deriveIndiaGstAccommodationNativeInvoiceSource(
        nativeInput(service, books, bank, invoice, section14Date),
      );
      expect(actual.rateSource.kind).toBe("genuine_section14_rate_change");
      if (actual.rateSource.kind !== "genuine_section14_rate_change") {
        throw new Error("Section14 result expected");
      }
      expect(actual.rateSource.section14.case).toBe(statutoryCase);
      expect(actual.rateSource.section14.selectedVersionSide).toBe(side);
      expect(actual.rateSource.section14.predecessorHashes.invoiceIssue).toBe(HASH("3"));
    }

    const delayedBank = deriveIndiaGstAccommodationNativeInvoiceSource(
      nativeInput(
        "2025-09-21", "2025-09-20", "2025-09-30", "2025-09-23",
        "2025-09-23", "2025-09-30",
      ),
    );
    expect(delayedBank.rateSource.kind).toBe("genuine_section14_rate_change");
    if (delayedBank.rateSource.kind !== "genuine_section14_rate_change") {
      throw new Error("Section14 result expected");
    }
    expect(delayedBank.rateSource.section14.paymentReceiptDate).toBe("2025-09-30");
    expect(delayedBank.timing.paymentReceiptDate).toBe("2025-09-20");
  });

  test("preserves the external issued-invoice and Section14 result objects without relabelling", () => {
    const native = nativeInput(
      "2025-09-21", "2025-09-23", "2025-09-24", "2025-09-23", "2025-09-23",
    );
    const timeOfSupply = externalTimeOfSupply(native);
    const invoiceTiming = freeze({
      propertyNode: PROPERTY,
      serviceProvision: native.paymentReceipt.serviceProvision,
      invoiceIssueDate: native.nativeTiming.invoiceIssueDate,
      amountMinor: native.paymentReceipt.amountMinor,
      currency: native.paymentReceipt.currency,
      evidenceHash: HASH("8"),
    });
    const section14 = deriveIndiaGstSection14RateSelectionFromEvidence({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: RESERVATION,
      rateVersionPair: native.rateVersionPair,
      rateChangeDateEvidence: native.rateChangeDateEvidence,
      serviceProvisionResult: native.serviceProvision,
      paymentReceiptResult: native.paymentReceipt,
      invoiceTiming,
      paymentEvidence: native.section14PaymentEvidence!,
    });
    const actual = adaptIndiaGstAccommodationExternalInvoiceSource({
      kind: "external_issued_invoice",
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: RESERVATION,
      timeOfSupply,
      rateVersionPair: native.rateVersionPair,
      rateChangeDateEvidence: native.rateChangeDateEvidence,
      section14,
    });
    expect(actual.kind).toBe("external_issued_invoice");
    expect(actual.timeOfSupply).toBe(timeOfSupply);
    expect(actual.section14).toBe(section14);
    expect(actual.timeOfSupply.invoiceIssueSource).toBe("governed_supplier_tax_invoice_record");

    const invalidExternal = structuredClone({
      kind: "external_issued_invoice",
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: RESERVATION,
      timeOfSupply,
      rateVersionPair: native.rateVersionPair,
      rateChangeDateEvidence: native.rateChangeDateEvidence,
      section14,
    }) as Mutable;
    invalidExternal.timeOfSupply.invoiceIssueSource = "native_current_transaction";
    freeze(invalidExternal);
    expect(() => adaptIndiaGstAccommodationExternalInvoiceSource(invalidExternal as never))
      .toThrow(/approved contract/);
  });

  test("rejects ordinary/Section14 confusion and invalid native source identities", () => {
    const ordinary = nativeInput("2026-01-01", "2026-01-03", "2026-01-04", "2026-01-02");
    expect(() => deriveIndiaGstAccommodationNativeInvoiceSource({
      ...ordinary,
      section14PaymentEvidence: paymentEvidence(
        ordinary.rateVersionPair,
        "2025-09-20",
        "2025-09-21",
      ),
    })).toThrow(/cannot carry Section14/);

    const mixed = nativeInput(
      "2025-09-21", "2025-09-23", "2025-09-24", "2025-09-23", "2025-09-23",
    );
    expect(() => deriveIndiaGstAccommodationNativeInvoiceSource({
      ...mixed,
      section14PaymentEvidence: null,
    })).toThrow(/require complete governed Section14/);

    const incompleteCalendar = structuredClone(mixed) as Mutable;
    incompleteCalendar.section14PaymentEvidence.calendarEvidence.days.pop();
    freeze(incompleteCalendar);
    expect(() => deriveIndiaGstAccommodationNativeInvoiceSource(incompleteCalendar as never))
      .toThrow();

    const wrongTiming = structuredClone(ordinary) as Mutable;
    wrongTiming.nativeTiming.paymentReceiptSnapshotId = id(43999);
    freeze(wrongTiming);
    expect(() => deriveIndiaGstAccommodationNativeInvoiceSource(wrongTiming as never))
      .toThrow(/does not bind the exact ordinary service\/payment source/);

    const wrongDay = structuredClone(ordinary) as Mutable;
    wrongDay.historicalResolutions.invoiceIssue.businessDay.businessDate = "2026-01-03";
    freeze(wrongDay);
    expect(() => deriveIndiaGstAccommodationNativeInvoiceSource(wrongDay as never))
      .toThrow(/complete selected property day/);

    const unprojectedRecorderResult = freeze({
      ...ordinary.ordinaryRegime,
      created: true,
      replayed: false,
    });
    expect(() => deriveIndiaGstAccommodationNativeInvoiceSource({
      ...ordinary,
      ordinaryRegime: unprojectedRecorderResult,
    } as never)).toThrow(/ordinary-regime evidence shape is invalid/);

    const malformedOrdinaryHash = structuredClone(ordinary) as Mutable;
    malformedOrdinaryHash.ordinaryRegime.ordinaryRegimeEvidenceSha256 = HASH("g");
    freeze(malformedOrdinaryHash);
    expect(() => deriveIndiaGstAccommodationNativeInvoiceSource(malformedOrdinaryHash as never))
      .toThrow(/ordinary-regime evidence SHA-256 must be a canonical SHA-256/);

    const oversizedAmount = structuredClone(ordinary) as Mutable;
    oversizedAmount.paymentReceipt.amountMinor = "9223372036854775808";
    freeze(oversizedAmount);
    expect(() => deriveIndiaGstAccommodationNativeInvoiceSource(oversizedAmount as never))
      .toThrow(/timing semantics/);

    const validResult = deriveIndiaGstAccommodationNativeInvoiceSource(ordinary);
    const missingRateSource = structuredClone(validResult) as Mutable;
    missingRateSource.rateSource = null;
    freeze(missingRateSource);
    expect(() => validateIndiaGstAccommodationNativeInvoiceSourceResult(
      TENANT,
      missingRateSource as never,
    )).toThrow(/native rate-source result must be an exact plain object/);

    const malformedRateContent = structuredClone(validResult) as Mutable;
    malformedRateContent.rateSource.selectedVersion.content = null;
    freeze(malformedRateContent);
    expect(() => validateIndiaGstAccommodationNativeInvoiceSourceResult(
      TENANT,
      malformedRateContent as never,
    )).toThrow(/selected rate content must be an exact plain object/);

    expect(() => deriveIndiaGstAccommodationNativeInvoiceSource({
      ...ordinary,
      invoiceIssueSnapshotId: INVOICE,
    } as never)).toThrow(/shape is invalid/);
  });

  test("composes native Order295/296/297 evidence with distinct canonical time hashes", () => {
    const source = deriveIndiaGstAccommodationNativeInvoiceSource(
      nativeInput("2026-01-01", "2026-01-03", "2026-01-04", "2026-01-02"),
    );
    const { supplier, recipient, composed } = nativeRegistrationComposition(source);
    expect(supplier.kind).toBe("native_current_transaction");
    expect(recipient.kind).toBe("native_current_transaction");
    expect(supplier.invoiceSourceEvidenceHash).toBe(source.evidenceHash);
    expect(recipient.invoiceSourceEvidenceHash).toBe(source.evidenceHash);
    expect(supplier.timeOfSupplyEvidenceHash).toBe(insertionHash({
      kind: "native_current_transaction",
      nativeTiming: source.timing,
    }));
    expect(recipient.timeOfSupplyEvidenceHash).toBe(insertionHash({
      tenantId: TENANT,
      kind: "native_current_transaction",
      nativeTiming: source.timing,
    }));
    expect(supplier.timeOfSupplyEvidenceHash).not.toBe(recipient.timeOfSupplyEvidenceHash);
    expect(composed).toMatchObject({
      kind: "native_current_transaction",
      invoiceSourceEvidenceHash: source.evidenceHash,
      nativeTimingEvidenceHash: source.timing.evidenceHash,
      supplierTimeOfSupplyEvidenceHash: supplier.timeOfSupplyEvidenceHash,
      recipientTimeOfSupplyEvidenceHash: recipient.timeOfSupplyEvidenceHash,
      timeOfSupplyDate: source.timing.timeOfSupplyDate,
    });
    expect(JSON.stringify(composed)).not.toContain("invoiceIssueSnapshotId");
    expect(JSON.stringify(composed)).not.toContain("invoiceSeries");
    expect(Object.isFrozen(composed)).toBeTrue();
  });

  test("composes each genuine Section14 variant without manufacturing external-invoice ancestry", () => {
    const cases = [
      ["2025-09-21", "2025-09-23", "2025-09-24", "2025-09-23", "2025-09-23"],
      ["2025-09-21", "2025-09-23", "2025-09-24", "2025-09-21", "2025-09-21"],
      ["2025-09-21", "2025-09-20", "2025-09-21", "2025-09-23", "2025-09-20"],
      ["2025-09-23", "2025-09-23", "2025-09-24", "2025-09-21", "2025-09-23"],
      ["2025-09-23", "2025-09-20", "2025-09-21", "2025-09-21", "2025-09-20"],
      ["2025-09-23", "2025-09-20", "2025-09-21", "2025-09-23", "2025-09-23"],
    ] as const;
    for (const args of cases) {
      const source = deriveIndiaGstAccommodationNativeInvoiceSource(nativeInput(args[0], args[1], args[2], args[3], args[4]));
      expect(source.rateSource.kind).toBe("genuine_section14_rate_change");
      const actual = nativeRegistrationComposition(source);
      expect(actual.composed.invoiceSourceEvidenceHash).toBe(source.evidenceHash);
      expect(actual.composed.nativeTimingEvidenceHash).toBe(source.timing.evidenceHash);
    }
  });

  test("rejects incomplete, surplus, and mismatched otherwise-valid native roots", () => {
    const first = nativeRegistrationComposition(deriveIndiaGstAccommodationNativeInvoiceSource(
      nativeInput("2026-01-01", "2026-01-03", "2026-01-04", "2026-01-02"),
    ));
    expect(() => composeIndiaGstRegistrationAtNativeTimeOfSupply(freeze({
      tenantId: TENANT,
      invoiceSource: first.source,
    }) as never)).toThrow(/shape is invalid/);
    expect(() => composeIndiaGstRecipientRegistrationAtNativeTimeOfSupply(freeze({
      tenantId: TENANT,
      recipientRegistrationStatus: freeze({ surplus: true }),
      invoiceSource: first.source,
      surplus: true,
    }) as never)).toThrow(/shape is invalid/);

    const second = nativeRegistrationComposition(deriveIndiaGstAccommodationNativeInvoiceSource(
      nativeInput("2026-01-01", "2026-01-04", "2026-01-05", "2026-01-03"),
    ));
    expect(() => composeIndiaGstAccommodationNativeSupplyNatureAtTimeOfSupply({
      tenantId: TENANT,
      supplyNature: first.supplyNature,
      supplierRegistrationAtTimeOfSupply: first.supplier,
      recipientRegistrationAtTimeOfSupply: second.recipient,
    })).toThrow(/do not describe one transaction/);
    const oversizedSupplier = structuredClone(first.supplier) as Mutable;
    oversizedSupplier.timeOfSupply.nativeTiming.amountMinor = "9223372036854775808";
    freeze(oversizedSupplier);
    expect(() => composeIndiaGstAccommodationNativeSupplyNatureAtTimeOfSupply({
      tenantId: TENANT,
      supplyNature: first.supplyNature,
      supplierRegistrationAtTimeOfSupply: oversizedSupplier as never,
      recipientRegistrationAtTimeOfSupply: first.recipient,
    })).toThrow(/native timing semantics/);
    expect(() => composeIndiaGstAccommodationNativeSupplyNatureAtTimeOfSupply({
      tenantId: TENANT,
      supplyNature: first.supplyNature,
      supplierRegistrationAtTimeOfSupply: first.supplier,
    } as never)).toThrow(/shape is invalid/);
  });

  test("the adapter is pure and the shared cores add no persistence, clock, or external-invoice fiction", async () => {
    const source = await Bun.file(new URL(
      "../src/contexts/tax-fiscal/india-gst-accommodation-invoice-source.ts",
      import.meta.url,
    )).text();
    expect(source).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM)\b/i);
    expect(source).not.toMatch(/Date\.now|new\s+Date|fetch\s*\(/);
    expect(source).not.toContain("invoiceIssueSnapshotId: input.nativeTiming");
    expect(source).toContain("deriveIndiaGstAccommodationOrdinaryTimeOfSupplyDates");
    expect(source).toContain("deriveIndiaGstSection14RateSelectionFromEvidence");
  });
});
