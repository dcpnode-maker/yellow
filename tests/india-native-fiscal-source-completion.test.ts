import { describe, expect, test } from "bun:test";

import {
  adaptIndiaGstAccommodationExternalInvoiceSource,
  deriveIndiaGstAccommodationInvoiceSource,
  deriveIndiaGstAccommodationNativeInvoiceSource,
  validateIndiaGstAccommodationNativeInvoiceSourceResult,
  type IndiaGstAccommodationNativeInvoiceSourceInput,
} from "../src/contexts/tax-fiscal/india-gst-accommodation-invoice-source";
import { deriveIndiaGstAccommodationOrdinaryTimeOfSupplyDates } from "../src/contexts/tax-fiscal/india-gst-accommodation-time-of-supply";
import { createPositiveTaxAttributionSnapshot } from "../src/contexts/tax-fiscal/attribution";
import { buildIndiaGstAccommodationSupplyNature } from "../src/contexts/tax-fiscal/india-gst-accommodation-supply-nature";
import { deriveIndiaGstAccommodationComponentFamily } from "../src/contexts/tax-fiscal/india-gst-accommodation-component-family";
import { deriveIndiaGstAccommodationLevyInputBundle } from "../src/contexts/tax-fiscal/india-gst-accommodation-levy-input-bundle";
import { deriveIndiaGstAccommodationLevyComponentIdentity } from "../src/contexts/tax-fiscal/india-gst-accommodation-levy-component-identity";
import { IndiaGstAccommodationQuotedRateApplicabilityService } from "../src/contexts/tax-fiscal/india-gst-accommodation-quoted-rate-applicability";
import { IndiaGstAccommodationFinalComponentTaxService } from "../src/contexts/tax-fiscal/india-gst-accommodation-final-component-tax";
import type { Tx } from "../src/kernel";
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
const SELLABLE = id(43423);
const VALUATION = id(43424);
const PERIOD = "[\"2026-01-01 00:00:00+00\",\"2026-01-03 00:00:00+00\")";
const PREDECESSOR = "a806f516-fed6-5768-b310-94aa03286adb";
const SUCCESSOR = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const PRE_FROM = "2022-07-17T18:30:00.000000Z";
const CUTOVER = "2025-09-21T18:30:00.000000Z" as const;
const SOURCE20 = "ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901" as const;
const SOURCE04 = "c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716" as const;
const SOURCE15 = "46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289" as const;
const HASH = (character: string): string => character.repeat(64);
const SERVICE_RECORDING_HASH = HASH("9");
const PAYMENT_RECORDING_HASH = HASH("0");

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

function quotedAttributionSnapshot(serviceDate: string) {
  return createPositiveTaxAttributionSnapshot({
    origin: { kind: "rate_quote", quoteHash: HASH("a") },
    currency: "INR",
    line: { lineId: "room", revenueGroup: "room_revenue", amountMinor: 10000n, nights: 1, personNights: 1, roomNights: [{ businessDate: serviceDate, amountMinor: 10000n }] },
    assignments: [{ businessDate: serviceDate, jurisdictionKey: "in.order434.gst", evidenceRef: `tax-assignment:${HASH("4")}` }],
    jurisdiction: { extensionId: PREDECESSOR, ownerTenantId: TENANT, key: "in.order434.gst", version: 1, contentHash: HASH("5"), evidenceRef: `tax-jurisdiction:${HASH("6")}` },
    evaluation: { schemaVersion: 1, jurisdictionKey: "in.order434.gst", country: "IN", priceDisplay: "tax_exclusive", rounding: "line", inputTotalMinor: 10000n, baseTotalMinor: 10000n, taxTotalMinor: 500n, grandTotalMinor: 10500n, taxes: [{ code: "GST_ROOM", name: "GST", taxMinor: 500n, components: [{ lineId: "room", revenueGroup: "room_revenue", baseMinor: 10000n, taxMinor: 500n, rateBasisPoints: 500 }] }] },
  });
}

function evidenceRoots(serviceDate: string, booksDate: string, bankDate: string) {
  const attributionSnapshot = quotedAttributionSnapshot(serviceDate);
  const reservationLineage = freeze({
    lineageId: LINEAGE,
    holdBindingId: HOLD,
    attributionId: ATTRIBUTION,
    reservationId: RESERVATION,
    segmentId: SEGMENT,
    originQuoteHash: HASH("a"),
    snapshotHash: attributionSnapshot.snapshotHash,
    currency: "INR",
  });
  const attribution = freeze({
    originKind: "rate_quote" as const,
    lineId: "room" as const,
    revenueGroup: "room_revenue" as const,
  });
  const serviceProjection = {
    serviceProvisionSnapshotId: SERVICE,
    propertyNode: PROPERTY,
    reservationLineage,
    attribution,
    serviceProvisionDate: serviceDate,
    serviceProvisionSource: "governed_service_provision_record" as const,
    serviceProvisionEvidenceSha256: HASH("c"),
    legalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" as const,
  };
  const service = freeze({ ...serviceProjection, evidenceHash: insertionHash({ tenantId: TENANT, ...serviceProjection }) });
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
  const paymentProjection = {
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
  };
  const payment = freeze({ ...paymentProjection, evidenceHash: insertionHash({ tenantId: TENANT, ...paymentProjection }) });
  return { service, payment, attributionSnapshot };
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

function quotedComponentIdentity(historicalResolution: IndiaGstAccommodationHistoricalResolutionResult, family: "igst" | "cgst_sgst" | "cgst_utgst" = "cgst_sgst") {
  const selected = historicalResolution.selectedExtension;
  const stateCode = family === "cgst_utgst" ? "04" : "29", placeState = family === "igst" ? "27" : stateCode;
  const jurisdiction = () => freeze({ extensionId: selected.extensionId, ownerTenantId: TENANT, key: selected.key, version: String(selected.version), contentHash: selected.contentHash });
  const recipientStatusBody = { recipientSezStatusId: RECIPIENT_STATUS, recipient: freeze({ partyId: RECIPIENT_PARTY, registrationId: RECIPIENT_REGISTRATION, evidenceHash: HASH("7") }), statusAsOf: historicalResolution.businessDay.businessDate, gstRegistration: freeze({ status: "active", taxpayerType: "regular", source: "gst_common_portal", evidenceSha256: HASH("8") }), sezStatus: "affirmatively_non_sez_regular", approval: null, legalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS" };
  const recipientSezStatus = freeze({ ...recipientStatusBody, evidenceHash: insertionHash({ tenantId: TENANT, ...recipientStatusBody }) });
  const comparisonBody = freeze({ propertyNode: PROPERTY, reservationId: RESERVATION, folioId: FOLIO, jurisdiction: jurisdiction(), supplier: freeze({ registrationId: SUPPLIER_REGISTRATION, evidenceHash: HASH("5"), stateCode }), recipient: freeze({ partyId: RECIPIENT_PARTY, registrationId: RECIPIENT_REGISTRATION, evidenceHash: HASH("7") }), buyerAssociation: freeze({ associationHash: HASH("a"), payloadHash: HASH("b") }), classification: freeze({ classificationId: CLASSIFICATION, evidenceHash: HASH("c") }), placeOfSupply: freeze({ candidateHash: HASH("d"), legalRule: "IGST_ACT_12_3_B", pos: placeState }), comparisonRule: "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS", stateRelationship: family === "igst" ? "different_state_or_union_territory" : "same_state_or_union_territory" });
  const comparison = freeze({ ...comparisonBody, candidateJson: JSON.stringify(comparisonBody), candidateHash: insertionHash({ tenantId: TENANT, candidate: comparisonBody }) });
  const serviceLocationBody = { supplierServiceLocationId: SUPPLIER_LOCATION, propertyNode: PROPERTY, jurisdiction: jurisdiction(), supplier: freeze({ registrationId: SUPPLIER_REGISTRATION, evidenceHash: HASH("5") }), serviceScope: "lodging_accommodation", registeredPlace: freeze({ kind: "principal_place_of_business", stateCode, addressLine: "1 Residency Road", locality: "Bengaluru", postalCode: "560001" }), locationBasis: "supply_made_from_registered_place_of_business", legalRule: "IGST_ACT_2_15_A" };
  const supplierServiceLocation = freeze({ ...serviceLocationBody, evidenceHash: insertionHash({ tenantId: TENANT, ...serviceLocationBody }) });
  const supplierStatusBody = { supplierSezStatusId: SUPPLIER_STATUS, propertyNode: PROPERTY, supplierServiceLocation: freeze({ id: SUPPLIER_LOCATION, evidenceHash: supplierServiceLocation.evidenceHash }), supplier: freeze({ registrationId: SUPPLIER_REGISTRATION, evidenceHash: HASH("5") }), statusAsOf: historicalResolution.businessDay.businessDate, gstRegistration: freeze({ status: "active", taxpayerType: "regular", source: "gst_common_portal", evidenceSha256: HASH("6") }), sezStatus: "affirmatively_non_sez_regular", approval: null, legalRule: "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS" };
  const supplierSezStatus = freeze({ ...supplierStatusBody, evidenceHash: insertionHash({ tenantId: TENANT, ...supplierStatusBody }) });
  const supplyNature = buildIndiaGstAccommodationSupplyNature({ tenantId: TENANT, supplyDate: historicalResolution.businessDay.businessDate, registeredStateComparison: comparison, supplierServiceLocation, recipientSezStatus, supplierSezStatus } as never);
  const componentFamily = deriveIndiaGstAccommodationComponentFamily({ tenantId: TENANT, supplyNature } as never);
  const ancestry = { tenantId: TENANT, historicalResolution, supplyNature, componentFamily };
  const levyInputBundle = deriveIndiaGstAccommodationLevyInputBundle(ancestry as never);
  const input = { ...ancestry, levyInputBundle };
  return { input, result: deriveIndiaGstAccommodationLevyComponentIdentity(input as never) };
}

function quotedPersistedRow(attributionSnapshot: ReturnType<typeof createPositiveTaxAttributionSnapshot>) {
  return { tenant_id: TENANT, lineage_id: LINEAGE, property_node: PROPERTY, hold_binding_id: HOLD, hold_id: HOLD, attribution_id: ATTRIBUTION, reservation_id: RESERVATION, segment_id: SEGMENT, sellable_unit_id: SELLABLE, folio_id: FOLIO, origin_quote_hash: HASH("a"), snapshot_hash: attributionSnapshot.snapshotHash, currency: "INR", snapshot: attributionSnapshot, binding_row_id: HOLD, binding_hold_id: HOLD, hold_row_id: HOLD, binding_sellable_unit_id: SELLABLE, hold_sellable_unit_id: SELLABLE, segment_sellable_unit_id: SELLABLE, lineage_period: PERIOD, binding_period: PERIOD, hold_period: PERIOD, segment_period: PERIOD, binding_attribution_id: ATTRIBUTION, attribution_row_id: ATTRIBUTION, binding_origin_quote_hash: HASH("a"), binding_snapshot_hash: attributionSnapshot.snapshotHash, binding_currency: "INR" };
}

function nativePersistedRootRow(input: IndiaGstAccommodationNativeInvoiceSourceInput) {
  const source = deriveIndiaGstAccommodationNativeInvoiceSource(input);
  return { tenant_id: TENANT, property_node: PROPERTY, reservation_id: RESERVATION, lineage_id: LINEAGE, attribution_id: ATTRIBUTION, service_id: SERVICE, payment_id: PAYMENT, ordinary_id: ORDINARY, service_date: source.timing.serviceProvisionDate, books_date: source.timing.supplierBooksEntryDate, bank_date: source.timing.supplierBankCreditDate, receipt_date: source.timing.paymentReceiptDate, amount_minor: source.timing.amountMinor, currency: "INR", service_external_hash: input.serviceProvision.serviceProvisionEvidenceSha256, payment_external_hash: input.paymentReceipt.paymentReceiptEvidenceSha256, ordinary_external_hash: input.ordinaryRegime.ordinaryRegimeEvidenceSha256, ordinary_regime: input.ordinaryRegime.regime, ordinary_source: input.ordinaryRegime.ordinaryRegimeSource, ordinary_legal_basis: input.ordinaryRegime.legalBasis, ordinary_service_hash: SERVICE_RECORDING_HASH, service_hash: SERVICE_RECORDING_HASH, payment_hash: PAYMENT_RECORDING_HASH, ordinary_hash: input.ordinaryRegime.evidenceHash, timing_id: TIMING, timing_folio_id: FOLIO, prospective_document_id: DOCUMENT, timing_service_id: SERVICE, timing_service_hash: SERVICE_RECORDING_HASH, timing_payment_id: PAYMENT, timing_payment_hash: PAYMENT_RECORDING_HASH, timing_ordinary_id: ORDINARY, timing_ordinary_hash: input.ordinaryRegime.evidenceHash, timing_invoice_date: source.timing.invoiceIssueDate, timing_hash: input.nativeTiming.evidenceHash, issuing_transaction_id: "434", transaction_timestamp: "2026-09-05 12:00:00+05:30", property_timezone: "Asia/Kolkata" };
}

function nativeServiceProjectionRow(input: IndiaGstAccommodationNativeInvoiceSourceInput, snapshot: unknown) {
  const service = input.serviceProvision, lineage = service.reservationLineage;
  return { tenant_id: TENANT, id: SERVICE, property_node: PROPERTY, reservation_lineage_id: lineage.lineageId, hold_binding_id: lineage.holdBindingId, attribution_id: lineage.attributionId, reservation_id: lineage.reservationId, segment_id: lineage.segmentId, origin_quote_hash: lineage.originQuoteHash, snapshot_hash: lineage.snapshotHash, currency: lineage.currency, service_provision_date: service.serviceProvisionDate, service_provision_source: service.serviceProvisionSource, service_provision_evidence_sha256: service.serviceProvisionEvidenceSha256, legal_rule: service.legalRule, lineage_id: lineage.lineageId, lineage_property_node: PROPERTY, lineage_hold_binding_id: lineage.holdBindingId, lineage_attribution_id: lineage.attributionId, lineage_reservation_id: lineage.reservationId, lineage_segment_id: lineage.segmentId, lineage_origin_quote_hash: lineage.originQuoteHash, lineage_snapshot_hash: lineage.snapshotHash, lineage_currency: lineage.currency, attribution_snapshot: snapshot };
}

function nativePaymentProjectionRow(input: IndiaGstAccommodationNativeInvoiceSourceInput, snapshot: unknown) {
  const payment = input.paymentReceipt, service = payment.serviceProvision, lineage = service.reservationLineage;
  return { tenant_id: TENANT, id: PAYMENT, service_provision_snapshot_id: SERVICE, currency: payment.currency, amount_minor: payment.amountMinor, coverage_scope: payment.coverageScope, supplier_books_entry_date: payment.supplierBooksEntryDate, supplier_bank_credit_date: payment.supplierBankCreditDate, payment_receipt_date: payment.paymentReceiptDate, payment_receipt_source: payment.paymentReceiptSource, payment_receipt_evidence_sha256: payment.paymentReceiptEvidenceSha256, legal_rule: payment.legalRule, service_tenant_id: TENANT, service_id: SERVICE, property_node: PROPERTY, reservation_lineage_id: lineage.lineageId, hold_binding_id: lineage.holdBindingId, attribution_id: lineage.attributionId, reservation_id: lineage.reservationId, segment_id: lineage.segmentId, origin_quote_hash: lineage.originQuoteHash, snapshot_hash: lineage.snapshotHash, service_currency: lineage.currency, service_provision_date: service.serviceProvisionDate, service_provision_source: service.serviceProvisionSource, service_provision_evidence_sha256: service.serviceProvisionEvidenceSha256, service_legal_rule: service.legalRule, lineage_id: lineage.lineageId, lineage_property_node: PROPERTY, lineage_hold_binding_id: lineage.holdBindingId, lineage_attribution_id: lineage.attributionId, lineage_reservation_id: lineage.reservationId, lineage_segment_id: lineage.segmentId, lineage_origin_quote_hash: lineage.originQuoteHash, lineage_snapshot_hash: lineage.snapshotHash, lineage_currency: lineage.currency, attribution_snapshot: snapshot };
}

function nativeQuotedTx(
  row: ReturnType<typeof quotedPersistedRow>,
  sourceInput: IndiaGstAccommodationNativeInvoiceSourceInput,
  calls: string[] = [],
  finalRows?: Readonly<{ valuation: readonly Mutable[]; nights: readonly Mutable[] }>,
  nativeRootOverride?: Mutable,
): Tx {
  return (async (strings: TemplateStringsArray) => {
    const sql = strings.join("?"); calls.push(sql);
    if (sql.includes("india_gst_accommodation_ordinary_regime_evidence")) return [nativeRootOverride ?? nativePersistedRootRow(sourceInput)];
    if (sql.includes("FROM public.india_gst_accommodation_payment_receipt_snapshot")) return [nativePaymentProjectionRow(sourceInput, row.snapshot)];
    if (sql.includes("FROM public.india_gst_accommodation_service_provision_snapshot")) return [nativeServiceProjectionRow(sourceInput, row.snapshot)];
    if (sql.includes("tax_attribution_hold_binding")) return [row];
    if (sql.includes("JOIN india_gst_accommodation_final_valuation")) return finalRows?.valuation ?? [];
    if (sql.includes("india_gst_accommodation_valuation_room_night")) return finalRows?.nights ?? [];
    throw new Error(`unexpected native quoted applicability SQL: ${sql}`);
  }) as unknown as Tx;
}

function nativeQuotedInput(input: IndiaGstAccommodationNativeInvoiceSourceInput, family: "igst" | "cgst_sgst" | "cgst_utgst" = "cgst_sgst") {
  const component = quotedComponentIdentity(input.historicalResolutions.serviceProvision, family);
  return freeze(JSON.parse(JSON.stringify({ tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, folioId: FOLIO, reservationLineageId: LINEAGE, attributionId: ATTRIBUTION, nativeInvoiceSourceInput: input, componentIdentityInput: component.input, componentIdentityResult: component.result })));
}

function nativeFinalRows(sourceInput: IndiaGstAccommodationNativeInvoiceSourceInput, nightValue = "10000") {
  return { valuation: [{ valuation_id: VALUATION, generation: 1, transaction_value_minor: nightValue, evidence_hash: HASH("f"), native_consideration_basis_hash: HASH("1"), timing_projection_evidence_hash: sourceInput.nativeTiming.evidenceHash }], nights: [{ ordinal: 0, business_date: sourceInput.serviceProvision.serviceProvisionDate, transaction_value_minor: nightValue }] };
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

  test("resolves ordinary native quoted applicability without fabricating Section14 fields", async () => {
    const sourceInput = nativeInput("2026-01-01", "2026-01-03", "2026-01-04", "2026-01-02");
    const input = nativeQuotedInput(sourceInput), calls: string[] = [];
    const actual = await new IndiaGstAccommodationQuotedRateApplicabilityService().resolveNative(
      nativeQuotedTx(quotedPersistedRow(quotedAttributionSnapshot("2026-01-01")), sourceInput, calls),
      input,
    );
    expect(actual.kind).toBe("native_current_transaction");
    expect(actual.rateSelection.kind).toBe("ordinary_section13_single_version");
    expect(actual.rateSelection).not.toHaveProperty("case");
    expect(actual.rateSelection).not.toHaveProperty("selectedVersionSide");
    expect(actual.rateSelection).not.toHaveProperty("section14EvidenceHash");
    expect(actual.rateSelection.selectedVersion.gstRoomSlabs[0]).toMatchObject({ rate: 0.05, itcEligible: false });
    expect(actual.nativeTiming).toMatchObject({ nativeTimingId: TIMING, prospectiveDocumentId: DOCUMENT, serviceProvisionSnapshotId: SERVICE, paymentReceiptSnapshotId: PAYMENT, ordinaryRegimeEvidenceId: ORDINARY, timeOfSupplyDate: "2026-01-02" });
    expect(actual.components[0]).toMatchObject({ ordinal: "0", quotedAmountMinor: "10000", slab: { uptoMinor: 750000, aggregateRateBasisPoints: 500 } });
    expect(actual.predecessorHashes).toMatchObject({ nativeTiming: actual.nativeTiming.evidenceHash, serviceProvisionRecording: SERVICE_RECORDING_HASH, paymentReceiptRecording: PAYMENT_RECORDING_HASH, ordinaryRegimeRecording: sourceInput.ordinaryRegime.evidenceHash, serviceProvisionProjection: sourceInput.serviceProvision.evidenceHash, paymentReceiptProjection: sourceInput.paymentReceipt.evidenceHash });
    expect(actual.predecessorHashes.serviceProvisionRecording).not.toBe(actual.predecessorHashes.serviceProvisionProjection);
    expect(actual.predecessorHashes.paymentReceiptRecording).not.toBe(actual.predecessorHashes.paymentReceiptProjection);
    const { evidenceHash, ...body } = actual;
    expect(evidenceHash).toBe(insertionHash({ tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, folioId: FOLIO, ...body }));
    expect(calls).toHaveLength(4);
    expect(Object.isFrozen(actual)).toBeTrue();
  });

  test("resolves a genuine-change native quoted rate from the full rederived source", async () => {
    const sourceInput = nativeInput("2025-09-21", "2025-09-23", "2025-09-24", "2025-09-23", "2025-09-23");
    const actual = await new IndiaGstAccommodationQuotedRateApplicabilityService().resolveNative(
      nativeQuotedTx(quotedPersistedRow(quotedAttributionSnapshot("2025-09-21")), sourceInput),
      nativeQuotedInput(sourceInput),
    );
    expect(actual.rateSelection).toMatchObject({ kind: "genuine_section14_rate_change", case: "supply_before_invoice_after_payment_after", selectedVersionSide: "successor", timeOfSupplyDate: "2025-09-23" });
    expect(actual.rateSelection.selectedVersion.gstRoomSlabs[0]).toMatchObject({ rate: 0.05, itcEligible: false });
    expect(actual.predecessorHashes.rateSource).toMatch(/^[0-9a-f]{64}$/);
    expect(actual.predecessorHashes.nativeInvoiceSource).toMatch(/^[0-9a-f]{64}$/);
  });

  test("rejects malformed and cross-scope native quoted applicability inputs", async () => {
    const sourceInput = nativeInput("2026-01-01", "2026-01-03", "2026-01-04", "2026-01-02"), service = new IndiaGstAccommodationQuotedRateApplicabilityService(), tx = nativeQuotedTx(quotedPersistedRow(quotedAttributionSnapshot("2026-01-01")), sourceInput);
    const valid = nativeQuotedInput(sourceInput);
    const missing = structuredClone(valid) as Mutable; delete missing.componentIdentityResult; freeze(missing);
    await expect(service.resolveNative(tx, missing as never)).rejects.toThrow(/shape is invalid/);
    const surplus = structuredClone(valid) as Mutable; surplus.surplus = true; freeze(surplus);
    await expect(service.resolveNative(tx, surplus as never)).rejects.toThrow(/shape is invalid/);
    const crossed = structuredClone(valid) as Mutable; crossed.propertyNode = id(43998); freeze(crossed);
    await expect(service.resolveNative(tx, crossed as never)).rejects.toThrow(/predecessor identity conflicts/);
    const wrongPersistedTiming = { ...nativePersistedRootRow(sourceInput), timing_hash: HASH("0") };
    await expect(service.resolveNative(
      nativeQuotedTx(quotedPersistedRow(quotedAttributionSnapshot("2026-01-01")), sourceInput, [], undefined, wrongPersistedTiming),
      valid,
    )).rejects.toThrow(/persisted native source roots conflict/);
    const wrongProjection = structuredClone(sourceInput) as Mutable;
    wrongProjection.serviceProvision.evidenceHash = HASH("d");
    freeze(wrongProjection);
    await expect(service.resolveNative(
      nativeQuotedTx(quotedPersistedRow(quotedAttributionSnapshot("2026-01-01")), wrongProjection as IndiaGstAccommodationNativeInvoiceSourceInput),
      nativeQuotedInput(wrongProjection as IndiaGstAccommodationNativeInvoiceSourceInput),
    )).rejects.toThrow(/service-provision date projection does not byte-match/);
    const projectionUsedAsRecordingRoot = { ...nativePersistedRootRow(sourceInput), timing_service_hash: sourceInput.serviceProvision.evidenceHash };
    await expect(service.resolveNative(
      nativeQuotedTx(quotedPersistedRow(quotedAttributionSnapshot("2026-01-01")), sourceInput, [], undefined, projectionUsedAsRecordingRoot),
      valid,
    )).rejects.toThrow(/persisted native source roots conflict/);
  });

  test("calculates ordinary native final component tax for every component family", async () => {
    for (const family of ["igst", "cgst_sgst", "cgst_utgst"] as const) {
      const sourceInput = nativeInput("2026-01-01", "2026-01-03", "2026-01-04", "2026-01-02"), applicabilityInput = nativeQuotedInput(sourceInput, family), calls: string[] = [];
      const finalInput = freeze({ tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, folioId: FOLIO, nativeQuotedRateApplicabilityInput: applicabilityInput });
      const actual = await new IndiaGstAccommodationFinalComponentTaxService().calculateNative(
        nativeQuotedTx(quotedPersistedRow(quotedAttributionSnapshot("2026-01-01")), sourceInput, calls, nativeFinalRows(sourceInput)),
        finalInput,
      );
      expect(actual).toMatchObject({ kind: "native_current_transaction", nativeTimingId: TIMING, valuationId: VALUATION, generation: 1, rateSelectionKind: "ordinary_section13_single_version", taxMinor: "500", grandTotalMinor: "10500" });
      expect(actual.roomNights[0]!.slab.components.map((component) => component.identity)).toEqual(family === "igst" ? ["igst"] : family === "cgst_sgst" ? ["cgst", "sgst"] : ["cgst", "utgst"]);
      expect(actual.predecessorHashes).not.toHaveProperty("section14");
      expect(actual.predecessorHashes).toMatchObject({ finalValuation: HASH("f"), nativeConsiderationBasis: HASH("1") });
      expect(calls).toHaveLength(6);
      expect(Object.isFrozen(actual)).toBeTrue();
    }
  });

  test("calculates genuine-change native final component tax from its selected full version", async () => {
    const sourceInput = nativeInput("2025-09-21", "2025-09-23", "2025-09-24", "2025-09-23", "2025-09-23"), applicabilityInput = nativeQuotedInput(sourceInput, "igst");
    const actual = await new IndiaGstAccommodationFinalComponentTaxService().calculateNative(
      nativeQuotedTx(quotedPersistedRow(quotedAttributionSnapshot("2025-09-21")), sourceInput, [], nativeFinalRows(sourceInput)),
      freeze({ tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, folioId: FOLIO, nativeQuotedRateApplicabilityInput: applicabilityInput }),
    );
    expect(actual).toMatchObject({ rateSelectionKind: "genuine_section14_rate_change", taxMinor: "500", grandTotalMinor: "10500" });
    expect(actual.predecessorHashes).toHaveProperty("rateSource");
  });

  test("rejects missing native valuation, mismatched night totals, and uncovered payment totals", async () => {
    const sourceInput = nativeInput("2026-01-01", "2026-01-03", "2026-01-04", "2026-01-02"), applicabilityInput = nativeQuotedInput(sourceInput), finalInput = freeze({ tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, folioId: FOLIO, nativeQuotedRateApplicabilityInput: applicabilityInput }), service = new IndiaGstAccommodationFinalComponentTaxService(), row = quotedPersistedRow(quotedAttributionSnapshot("2026-01-01"));
    await expect(service.calculateNative(nativeQuotedTx(row, sourceInput, [], { valuation: [], nights: [] }), finalInput)).rejects.toThrow(/one current native valuation/);
    await expect(service.calculateNative(nativeQuotedTx(row, sourceInput, [], { valuation: nativeFinalRows(sourceInput).valuation, nights: nativeFinalRows(sourceInput, "9999").nights }), finalInput)).rejects.toThrow(/do not reconcile/);
    const uncovered = structuredClone(sourceInput) as Mutable; uncovered.paymentReceipt.amountMinor = "10501"; freeze(uncovered);
    const uncoveredInput = nativeQuotedInput(uncovered as IndiaGstAccommodationNativeInvoiceSourceInput);
    await expect(service.calculateNative(
      nativeQuotedTx(row, uncovered as IndiaGstAccommodationNativeInvoiceSourceInput, [], nativeFinalRows(uncovered as IndiaGstAccommodationNativeInvoiceSourceInput)),
      freeze({ tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, folioId: FOLIO, nativeQuotedRateApplicabilityInput: uncoveredInput }),
    )).rejects.toThrow(/ancestry|reconcile|cover/);
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
