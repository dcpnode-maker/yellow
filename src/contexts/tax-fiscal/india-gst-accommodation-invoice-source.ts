import { types as utilTypes } from "node:util";

import {
  deriveIndiaGstAccommodationOrdinaryTimeOfSupplyDates,
  type IndiaGstAccommodationTimeOfSupplyResult,
} from "./india-gst-accommodation-time-of-supply";
import type { IndiaGstAccommodationHistoricalResolutionResult } from "./india-gst-accommodation-historical-resolution";
import type { IndiaGstAccommodationOrdinaryRegimeEvidence } from "./india-gst-accommodation-ordinary-regime-evidence";
import type { IndiaGstAccommodationPaymentReceiptDateResult } from "./india-gst-accommodation-payment-receipt-date";
import {
  deriveIndiaGstAccommodationRateChangeDate,
  type IndiaGstAccommodationRateChangeDateResult,
} from "./india-gst-accommodation-rate-change-date";
import type {
  IndiaGstAccommodationRateVersionEvidence,
  IndiaGstAccommodationRateVersionPairResult,
} from "./india-gst-accommodation-rate-version-pair";
import type { IndiaGstAccommodationServiceProvisionDateResult } from "./india-gst-accommodation-service-provision-date";
import {
  deriveIndiaGstSection14RateSelectionFromEvidence,
  type IndiaGstSection14PaymentEvidence,
  type IndiaGstSection14RateSelectionResult,
} from "./india-gst-section14-rate-selection";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DECIMAL = /^[1-9][0-9]*$/;
const INT64_MAX = 9_223_372_036_854_775_807n;

const NATIVE_INPUT_KEYS = [
  "kind", "tenantId", "propertyNode", "reservationId", "serviceProvision",
  "paymentReceipt", "ordinaryRegime", "nativeTiming", "rateVersionPair",
  "rateChangeDateEvidence", "historicalResolutions", "section14PaymentEvidence",
] as const;
const EXTERNAL_INPUT_KEYS = [
  "kind", "tenantId", "propertyNode", "reservationId", "timeOfSupply",
  "rateVersionPair", "rateChangeDateEvidence", "section14",
] as const;
const ORDINARY_KEYS = [
  "ordinaryRegimeEvidenceId", "serviceProvisionSnapshotId", "regime",
  "ordinaryRegimeSource", "legalBasis", "ordinaryRegimeEvidenceSha256", "evidenceHash",
] as const;
const NATIVE_TIMING_KEYS = [
  "nativeTimingId", "prospectiveDocumentId", "propertyNode", "reservationId",
  "serviceProvisionSnapshotId", "paymentReceiptSnapshotId",
  "ordinaryRegimeEvidenceId", "invoiceIssueDate", "evidenceHash",
] as const;
const HISTORY_KEYS = [
  "serviceProvision", "invoiceIssue", "supplierBooksEntry", "supplierBankCredit",
  "paymentReceipt", "timeOfSupply",
] as const;
const HISTORICAL_RESULT_KEYS = [
  "property", "businessDay", "assignment", "selectedExtension", "rateVersionPair",
  "evidenceHash",
] as const;
const EXTERNAL_TIME_KEYS = [
  "serviceProvisionSnapshotId", "paymentReceiptSnapshotId", "invoiceIssueSnapshotId",
  "propertyNode", "reservationId", "reservationLineage", "attribution",
  "serviceProvisionDate", "paymentReceiptDate", "invoiceIssueDate", "deadlineDate",
  "candidateDates", "branch", "timeOfSupplyDate", "regime", "source", "legalRule",
  "ordinaryRegimeEvidenceSha256", "invoiceSeries", "invoiceSerial",
  "supplierBooksEntryDate", "supplierBankCreditDate", "coverageScope",
  "serviceProvisionSource", "serviceProvisionLegalRule", "paymentReceiptSource",
  "paymentReceiptLegalRule", "invoiceIssueSource", "invoiceIssueLegalRule",
  "serviceProvisionEvidenceSha256", "paymentReceiptEvidenceSha256",
  "invoiceIssueEvidenceSha256", "amountMinor", "currency", "evidenceHash",
] as const;
const SECTION14_RESULT_KEYS = [
  "case", "serviceProvisionDate", "invoiceIssueDate", "paymentReceiptDate",
  "rateChangeDate", "timeOfSupplyDate", "selectedVersionSide", "selectedVersion",
  "legalRule", "predecessorHashes", "evidenceHash",
] as const;
const NATIVE_RESULT_KEYS = ["kind", "timing", "rateSource", "evidenceHash"] as const;
const NATIVE_TIMING_RESULT_KEYS = [
  "kind", "nativeTimingId", "prospectiveDocumentId", "serviceProvisionSnapshotId",
  "paymentReceiptSnapshotId", "ordinaryRegimeEvidenceId", "propertyNode", "reservationId",
  "serviceProvisionDate", "paymentReceiptDate", "invoiceIssueDate", "supplierBooksEntryDate",
  "supplierBankCreditDate", "deadlineDate", "candidateDates", "branch", "timeOfSupplyDate",
  "regime", "ordinaryRegimeSource", "ordinaryRegimeLegalBasis", "amountMinor", "currency",
  "predecessorHashes", "evidenceHash",
] as const;
const NATIVE_RATE_HISTORY_HASH_KEYS = [
  "serviceProvision", "invoiceIssue", "supplierBooksEntry", "supplierBankCredit",
  "paymentReceipt", "timeOfSupply",
] as const;

type JsonRecord = Record<string, unknown>;

export type IndiaGstAccommodationNativeOrdinaryRegimeEvidence =
  IndiaGstAccommodationOrdinaryRegimeEvidence;

export interface IndiaGstAccommodationNativeInvoiceTimingProjection {
  readonly nativeTimingId: string;
  readonly prospectiveDocumentId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly serviceProvisionSnapshotId: string;
  readonly paymentReceiptSnapshotId: string;
  readonly ordinaryRegimeEvidenceId: string;
  readonly invoiceIssueDate: string;
  readonly evidenceHash: string;
}

export interface IndiaGstAccommodationNativeHistoricalResolutions {
  readonly serviceProvision: IndiaGstAccommodationHistoricalResolutionResult;
  readonly invoiceIssue: IndiaGstAccommodationHistoricalResolutionResult;
  readonly supplierBooksEntry: IndiaGstAccommodationHistoricalResolutionResult;
  readonly supplierBankCredit: IndiaGstAccommodationHistoricalResolutionResult;
  readonly paymentReceipt: IndiaGstAccommodationHistoricalResolutionResult;
  readonly timeOfSupply: IndiaGstAccommodationHistoricalResolutionResult;
}

export interface IndiaGstAccommodationNativeInvoiceSourceInput {
  readonly kind: "native_current_transaction";
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly serviceProvision: IndiaGstAccommodationServiceProvisionDateResult;
  readonly paymentReceipt: IndiaGstAccommodationPaymentReceiptDateResult;
  readonly ordinaryRegime: IndiaGstAccommodationNativeOrdinaryRegimeEvidence;
  readonly nativeTiming: IndiaGstAccommodationNativeInvoiceTimingProjection;
  readonly rateVersionPair: IndiaGstAccommodationRateVersionPairResult;
  readonly rateChangeDateEvidence: IndiaGstAccommodationRateChangeDateResult;
  readonly historicalResolutions: IndiaGstAccommodationNativeHistoricalResolutions;
  readonly section14PaymentEvidence: IndiaGstSection14PaymentEvidence | null;
}

export interface IndiaGstAccommodationExternalInvoiceSourceInput {
  readonly kind: "external_issued_invoice";
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly timeOfSupply: IndiaGstAccommodationTimeOfSupplyResult;
  readonly rateVersionPair: IndiaGstAccommodationRateVersionPairResult;
  readonly rateChangeDateEvidence: IndiaGstAccommodationRateChangeDateResult;
  readonly section14: IndiaGstSection14RateSelectionResult;
}

export type IndiaGstAccommodationInvoiceSourceInput =
  | IndiaGstAccommodationNativeInvoiceSourceInput
  | IndiaGstAccommodationExternalInvoiceSourceInput;

export interface IndiaGstAccommodationNativeTimingResult {
  readonly kind: "native_current_transaction";
  readonly nativeTimingId: string;
  readonly prospectiveDocumentId: string;
  readonly serviceProvisionSnapshotId: string;
  readonly paymentReceiptSnapshotId: string;
  readonly ordinaryRegimeEvidenceId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly serviceProvisionDate: string;
  readonly paymentReceiptDate: string;
  readonly invoiceIssueDate: string;
  readonly supplierBooksEntryDate: string;
  readonly supplierBankCreditDate: string;
  readonly deadlineDate: string;
  readonly candidateDates: Readonly<
    | { readonly invoiceIssueDate: string; readonly paymentReceiptDate: string }
    | { readonly serviceProvisionDate: string; readonly paymentReceiptDate: string }
  >;
  readonly branch: "section13_2_a_invoice_or_payment" | "section13_2_b_service_or_payment";
  readonly timeOfSupplyDate: string;
  readonly regime: "ordinary_rule47_30_day";
  readonly ordinaryRegimeSource: "governed_rule47_ordinary_regime_record";
  readonly ordinaryRegimeLegalBasis: "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT";
  readonly amountMinor: string;
  readonly currency: "INR";
  readonly predecessorHashes: Readonly<{
    readonly serviceProvision: string;
    readonly paymentReceipt: string;
    readonly ordinaryRegime: string;
    readonly nativeTiming: string;
  }>;
  readonly evidenceHash: string;
}

export interface IndiaGstAccommodationNativeSingleVersionRateSource {
  readonly kind: "ordinary_section13_single_version";
  readonly selectedVersion: IndiaGstAccommodationRateVersionEvidence;
  readonly historicalResolutionEvidenceHashes: Readonly<{
    readonly serviceProvision: string;
    readonly invoiceIssue: string;
    readonly supplierBooksEntry: string;
    readonly supplierBankCredit: string;
    readonly paymentReceipt: string;
    readonly timeOfSupply: string;
  }>;
  readonly evidenceHash: string;
}

export interface IndiaGstAccommodationNativeSection14RateSource {
  readonly kind: "genuine_section14_rate_change";
  readonly section14: IndiaGstSection14RateSelectionResult;
  readonly historicalResolutionEvidenceHashes: IndiaGstAccommodationNativeSingleVersionRateSource["historicalResolutionEvidenceHashes"];
  readonly evidenceHash: string;
}

export type IndiaGstAccommodationNativeRateSource =
  | IndiaGstAccommodationNativeSingleVersionRateSource
  | IndiaGstAccommodationNativeSection14RateSource;

export interface IndiaGstAccommodationNativeInvoiceSourceResult {
  readonly kind: "native_current_transaction";
  readonly timing: IndiaGstAccommodationNativeTimingResult;
  readonly rateSource: IndiaGstAccommodationNativeRateSource;
  readonly evidenceHash: string;
}

export interface IndiaGstAccommodationExternalInvoiceSourceResult {
  readonly kind: "external_issued_invoice";
  readonly timeOfSupply: IndiaGstAccommodationTimeOfSupplyResult;
  readonly section14: IndiaGstSection14RateSelectionResult;
  readonly evidenceHash: string;
}

export type IndiaGstAccommodationInvoiceSourceResult =
  | IndiaGstAccommodationNativeInvoiceSourceResult
  | IndiaGstAccommodationExternalInvoiceSourceResult;

export class IndiaGstAccommodationInvoiceSourceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationInvoiceSourceValidationError";
  }
}

function fail(message: string): never {
  throw new IndiaGstAccommodationInvoiceSourceValidationError(message);
}

function exact(value: unknown, keys: readonly string[], subject: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)
      || utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0
      || (Object.getPrototypeOf(value) !== Object.prototype
        && Object.getPrototypeOf(value) !== null)) {
    return fail(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
      || actual.some((key, index) => key !== expected[index])
      || Object.values(descriptors).some((descriptor) => descriptor.get !== undefined
        || descriptor.set !== undefined || descriptor.enumerable !== true
        || !("value" in descriptor))) {
    return fail(`${subject} shape is invalid`);
  }
  return value as JsonRecord;
}

function deeplyFrozen(value: unknown, subject: string, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean"
      || (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value === "object" && seen.has(value)) return;
  if (typeof value !== "object" || utilTypes.isProxy(value) || !Object.isFrozen(value)
      || Object.getOwnPropertySymbols(value).length !== 0) {
    fail(`${subject} must be a deeply frozen plain graph`);
  }
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null) {
    fail(`${subject} must contain plain objects only`);
  }
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      fail(`${subject} arrays must be exact and dense`);
    }
  }
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === "length") continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined
        || descriptor.enumerable !== true || descriptor.configurable !== false
        || descriptor.writable !== false || !("value" in descriptor)) {
      fail(`${subject} descriptors are invalid`);
    }
    deeplyFrozen(descriptor.value, subject, seen);
  }
}

function uuid(value: unknown, subject: string): string {
  return typeof value === "string" && UUID.test(value)
    ? value
    : fail(`${subject} must be a canonical UUID`);
}

function hash(value: unknown, subject: string): string {
  return typeof value === "string" && SHA256.test(value)
    ? value
    : fail(`${subject} must be a canonical SHA-256`);
}

function civilDate(value: unknown, subject: string): string {
  if (typeof value !== "string") return fail(`${subject} must be a calendar date`);
  const match = DATE.exec(value);
  if (!match) return fail(`${subject} must be a calendar date`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year === 0 || month < 1 || month > 12 || day < 1
      || day > (days[month - 1] ?? 0)) return fail(`${subject} must be a calendar date`);
  return value;
}

function canonicalJson(value: unknown, ancestors = new Set<object>(), depth = 0): string {
  if (depth > 64) return fail("invoice-source evidence is too deeply nested");
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? JSON.stringify(Object.is(value, -0) ? 0 : value)
      : fail("invoice-source evidence contains a non-finite number");
  }
  if (typeof value !== "object" || utilTypes.isProxy(value) || ancestors.has(value)) {
    return fail("invoice-source evidence is not canonical JSON");
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const keys = Object.keys(value);
      if (Object.getOwnPropertySymbols(value).length !== 0 || keys.length !== value.length
          || keys.some((key, index) => key !== String(index))) {
        return fail("invoice-source evidence arrays must be exact and dense");
      }
      return `[${value.map((item) => canonicalJson(item, ancestors, depth + 1)).join(",")}]`;
    }
    if ((Object.getPrototypeOf(value) !== Object.prototype
        && Object.getPrototypeOf(value) !== null)
        || Object.getOwnPropertySymbols(value).length !== 0) {
      return fail("invoice-source evidence objects must be plain records");
    }
    return `{${Object.keys(value).sort().map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined
          || descriptor.enumerable !== true || !("value" in descriptor)) {
        return fail("invoice-source evidence objects must contain data fields only");
      }
      return `${JSON.stringify(key)}:${canonicalJson(descriptor.value, ancestors, depth + 1)}`;
    }).join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

function canonicalDigest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(canonicalJson(value)).digest("hex");
}

function insertionDigest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function freeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    freeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return Object.freeze(value);
}

function validateLineage(
  propertyNode: string,
  reservationId: string,
  service: IndiaGstAccommodationServiceProvisionDateResult,
  payment: IndiaGstAccommodationPaymentReceiptDateResult,
): void {
  deeplyFrozen(service, "service-provision evidence");
  deeplyFrozen(payment, "payment-receipt evidence");
  const lineage = service.reservationLineage;
  for (const [subject, value] of [
    ["service snapshot", service.serviceProvisionSnapshotId],
    ["service property", service.propertyNode],
    ["lineage id", lineage.lineageId],
    ["hold binding", lineage.holdBindingId],
    ["attribution", lineage.attributionId],
    ["lineage reservation", lineage.reservationId],
    ["segment", lineage.segmentId],
    ["payment snapshot", payment.paymentReceiptSnapshotId],
  ] as const) uuid(value, subject);
  for (const [subject, value] of [
    ["service evidence", service.evidenceHash],
    ["service external evidence", service.serviceProvisionEvidenceSha256],
    ["lineage quote", lineage.originQuoteHash],
    ["lineage snapshot", lineage.snapshotHash],
    ["payment evidence", payment.evidenceHash],
    ["payment external evidence", payment.paymentReceiptEvidenceSha256],
  ] as const) hash(value, subject);
  const serviceDate = civilDate(service.serviceProvisionDate, "service-provision date");
  const booksDate = civilDate(payment.supplierBooksEntryDate, "supplier books-entry date");
  const bankDate = civilDate(payment.supplierBankCreditDate, "supplier bank-credit date");
  const receiptDate = civilDate(payment.paymentReceiptDate, "payment-receipt date");
  if (service.propertyNode !== propertyNode || lineage.reservationId !== reservationId
      || payment.propertyNode !== propertyNode
      || payment.serviceProvision.serviceProvisionSnapshotId !== service.serviceProvisionSnapshotId
      || payment.serviceProvision.serviceProvisionDate !== serviceDate
      || payment.serviceProvision.serviceProvisionEvidenceSha256
        !== service.serviceProvisionEvidenceSha256
      || canonicalJson(payment.serviceProvision.reservationLineage) !== canonicalJson(lineage)
      || canonicalJson(payment.serviceProvision.attribution) !== canonicalJson(service.attribution)
      || payment.serviceProvision.serviceProvisionSource !== "governed_service_provision_record"
      || payment.serviceProvision.legalRule !== "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY"
      || service.serviceProvisionSource !== "governed_service_provision_record"
      || service.legalRule !== "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY"
      || payment.coverageScope !== "full_attribution"
      || payment.paymentReceiptSource !== "governed_supplier_payment_receipt_record"
      || payment.legalRule !== "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY"
      || receiptDate !== (booksDate < bankDate ? booksDate : bankDate)
      || payment.currency !== "INR" || lineage.currency !== "INR"
      || !DECIMAL.test(payment.amountMinor)) {
    fail("service, payment and full attribution lineage do not agree");
  }
}

function validateHistoricalResolution(
  tenantId: string,
  propertyNode: string,
  businessDate: string,
  pair: IndiaGstAccommodationRateVersionPairResult,
  raw: IndiaGstAccommodationHistoricalResolutionResult,
  subject: string,
): IndiaGstAccommodationHistoricalResolutionResult {
  deeplyFrozen(raw, subject);
  const value = exact(raw, HISTORICAL_RESULT_KEYS, subject);
  const property = exact(value.property, ["propertyNode", "propertyTimezone"], `${subject} property`);
  const day = exact(value.businessDay, ["businessDate", "fromInstant", "toInstant"], `${subject} business day`);
  const assignment = exact(value.assignment, ["jurisdictionKey", "effectiveFrom", "effectiveTo"], `${subject} assignment`);
  if (property.propertyNode !== propertyNode || typeof property.propertyTimezone !== "string"
      || property.propertyTimezone.length === 0 || property.propertyTimezone.trim() !== property.propertyTimezone
      || day.businessDate !== businessDate || assignment.jurisdictionKey !== "in-gst-lodging"
      || typeof day.fromInstant !== "string" || typeof day.toInstant !== "string"
      || day.fromInstant >= day.toInstant) {
    fail(`${subject} does not represent the complete selected property day`);
  }
  const fromInstant = day.fromInstant as string;
  const toInstant = day.toInstant as string;
  const effectiveFrom = assignment.effectiveFrom;
  const effectiveTo = assignment.effectiveTo;
  if ((effectiveFrom !== null && civilDate(effectiveFrom, `${subject} assignment lower`) > businessDate)
      || (effectiveTo !== null && civilDate(effectiveTo, `${subject} assignment upper`) <= businessDate)) {
    fail(`${subject} assignment does not contain its business date`);
  }
  const resultPair = value.rateVersionPair as IndiaGstAccommodationRateVersionPairResult;
  deriveIndiaGstAccommodationRateChangeDate({ tenantId, rateVersionPair: resultPair });
  if (resultPair.evidenceHash !== pair.evidenceHash
      || canonicalJson(resultPair) !== canonicalJson(pair)) {
    fail(`${subject} uses a different governed rate history`);
  }
  const candidates = [pair.predecessor, pair.successor].filter((candidate) =>
    candidate.effectiveFromInstant <= fromInstant
      && (candidate.effectiveToInstant === null || candidate.effectiveToInstant >= toInstant));
  if (candidates.length !== 1 || !candidates[0]
      || canonicalJson(value.selectedExtension) !== canonicalJson(candidates[0])) {
    fail(`${subject} does not select the sole whole-day rate member`);
  }
  const { evidenceHash, ...body } = raw;
  if (hash(evidenceHash, `${subject} evidence hash`)
      !== canonicalDigest({ tenantId, ...body })) {
    fail(`${subject} evidence hash does not bind the whole-day resolution`);
  }
  return raw;
}

function validateRateInputs(
  tenantId: string,
  propertyNode: string,
  pair: IndiaGstAccommodationRateVersionPairResult,
  rateDate: IndiaGstAccommodationRateChangeDateResult,
): IndiaGstAccommodationRateChangeDateResult {
  deeplyFrozen(pair, "rate-version pair");
  const fresh = deriveIndiaGstAccommodationRateChangeDate({ tenantId, rateVersionPair: pair });
  deeplyFrozen(rateDate, "rate-change-date evidence");
  if (pair.propertyNode !== propertyNode || canonicalJson(rateDate) !== canonicalJson(fresh)) {
    fail("rate-version pair or rate-change-date evidence conflicts with the property");
  }
  return fresh;
}

function nativeTiming(
  tenantId: string,
  propertyNode: string,
  reservationId: string,
  service: IndiaGstAccommodationServiceProvisionDateResult,
  payment: IndiaGstAccommodationPaymentReceiptDateResult,
  ordinaryRaw: IndiaGstAccommodationNativeOrdinaryRegimeEvidence,
  projectionRaw: IndiaGstAccommodationNativeInvoiceTimingProjection,
): IndiaGstAccommodationNativeTimingResult {
  const ordinary = exact(ordinaryRaw, ORDINARY_KEYS, "ordinary-regime evidence");
  const projection = exact(projectionRaw, NATIVE_TIMING_KEYS, "native timing projection");
  deeplyFrozen(ordinaryRaw, "ordinary-regime evidence");
  deeplyFrozen(projectionRaw, "native timing projection");
  const ordinaryId = uuid(ordinary.ordinaryRegimeEvidenceId, "ordinary-regime evidence id");
  const nativeTimingId = uuid(projection.nativeTimingId, "native timing id");
  const prospectiveDocumentId = uuid(projection.prospectiveDocumentId, "prospective document id");
  const invoiceIssueDate = civilDate(projection.invoiceIssueDate, "native invoice issue date");
  const ordinaryHash = hash(ordinary.evidenceHash, "ordinary-regime evidence hash");
  const projectionHash = hash(projection.evidenceHash, "native timing evidence hash");
  hash(ordinary.ordinaryRegimeEvidenceSha256, "ordinary-regime evidence SHA-256");
  if (ordinary.regime !== "ordinary_rule47_30_day"
      || ordinary.ordinaryRegimeSource !== "governed_rule47_ordinary_regime_record"
      || ordinary.legalBasis !== "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT"
      || ordinary.serviceProvisionSnapshotId !== service.serviceProvisionSnapshotId
      || projection.propertyNode !== propertyNode || projection.reservationId !== reservationId
      || projection.serviceProvisionSnapshotId !== service.serviceProvisionSnapshotId
      || projection.paymentReceiptSnapshotId !== payment.paymentReceiptSnapshotId
      || projection.ordinaryRegimeEvidenceId !== ordinaryId) {
    fail("native timing projection does not bind the exact ordinary service/payment source");
  }
  const dates = deriveIndiaGstAccommodationOrdinaryTimeOfSupplyDates({
    serviceProvisionDate: service.serviceProvisionDate,
    paymentReceiptDate: payment.paymentReceiptDate,
    invoiceIssueDate,
  });
  const predecessorHashes = Object.freeze({
    serviceProvision: service.evidenceHash,
    paymentReceipt: payment.evidenceHash,
    ordinaryRegime: ordinaryHash,
    nativeTiming: projectionHash,
  });
  const body = {
    kind: "native_current_transaction" as const,
    nativeTimingId,
    prospectiveDocumentId,
    serviceProvisionSnapshotId: service.serviceProvisionSnapshotId,
    paymentReceiptSnapshotId: payment.paymentReceiptSnapshotId,
    ordinaryRegimeEvidenceId: ordinaryId,
    propertyNode,
    reservationId,
    serviceProvisionDate: service.serviceProvisionDate,
    paymentReceiptDate: payment.paymentReceiptDate,
    invoiceIssueDate,
    supplierBooksEntryDate: payment.supplierBooksEntryDate,
    supplierBankCreditDate: payment.supplierBankCreditDate,
    deadlineDate: dates.deadlineDate,
    candidateDates: dates.candidateDates,
    branch: dates.branch,
    timeOfSupplyDate: dates.timeOfSupplyDate,
    regime: "ordinary_rule47_30_day" as const,
    ordinaryRegimeSource: "governed_rule47_ordinary_regime_record" as const,
    ordinaryRegimeLegalBasis: "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT" as const,
    amountMinor: payment.amountMinor,
    currency: "INR" as const,
    predecessorHashes,
  };
  return freeze({ ...body, evidenceHash: canonicalDigest({ tenantId, ...body }) });
}

function nativeRateSource(
  input: IndiaGstAccommodationNativeInvoiceSourceInput,
  timing: IndiaGstAccommodationNativeTimingResult,
): IndiaGstAccommodationNativeRateSource {
  const historiesRaw = exact(input.historicalResolutions, HISTORY_KEYS, "historical resolutions");
  const fixedDates = {
    serviceProvision: timing.serviceProvisionDate,
    invoiceIssue: timing.invoiceIssueDate,
    supplierBooksEntry: timing.supplierBooksEntryDate,
    supplierBankCredit: timing.supplierBankCreditDate,
  } as const;
  const histories = {} as Record<
    keyof IndiaGstAccommodationNativeHistoricalResolutions,
    IndiaGstAccommodationHistoricalResolutionResult
  >;
  for (const key of [
    "serviceProvision", "invoiceIssue", "supplierBooksEntry",
    "supplierBankCredit",
  ] as const) {
    histories[key] = validateHistoricalResolution(
      input.tenantId,
      input.propertyNode,
      fixedDates[key],
      input.rateVersionPair,
      historiesRaw[key] as IndiaGstAccommodationHistoricalResolutionResult,
      `${key} historical resolution`,
    );
  }
  const selectedMembers = new Set(([
    "serviceProvision", "invoiceIssue", "supplierBooksEntry",
    "supplierBankCredit",
  ] as const).map((key) =>
    canonicalJson(histories[key].selectedExtension)));
  if (selectedMembers.size === 1) {
    if (input.section14PaymentEvidence !== null) {
      fail("ordinary single-version timing cannot carry Section14 evidence");
    }
    histories.paymentReceipt = validateHistoricalResolution(
      input.tenantId,
      input.propertyNode,
      timing.paymentReceiptDate,
      input.rateVersionPair,
      historiesRaw.paymentReceipt as IndiaGstAccommodationHistoricalResolutionResult,
      "paymentReceipt historical resolution",
    );
    histories.timeOfSupply = validateHistoricalResolution(
      input.tenantId,
      input.propertyNode,
      timing.timeOfSupplyDate,
      input.rateVersionPair,
      historiesRaw.timeOfSupply as IndiaGstAccommodationHistoricalResolutionResult,
      "timeOfSupply historical resolution",
    );
    if (canonicalJson(histories.paymentReceipt.selectedExtension)
          !== canonicalJson(histories.serviceProvision.selectedExtension)
        || canonicalJson(histories.timeOfSupply.selectedExtension)
          !== canonicalJson(histories.serviceProvision.selectedExtension)) {
      fail("ordinary Section13 dates do not share one whole-day rate member");
    }
    const historicalResolutionEvidenceHashes = Object.freeze({
      serviceProvision: histories.serviceProvision.evidenceHash,
      invoiceIssue: histories.invoiceIssue.evidenceHash,
      supplierBooksEntry: histories.supplierBooksEntry.evidenceHash,
      supplierBankCredit: histories.supplierBankCredit.evidenceHash,
      paymentReceipt: histories.paymentReceipt.evidenceHash,
      timeOfSupply: histories.timeOfSupply.evidenceHash,
    });
    const selectedVersion = histories.timeOfSupply.selectedExtension;
    const body = {
      kind: "ordinary_section13_single_version" as const,
      selectedVersion,
      historicalResolutionEvidenceHashes,
    };
    return freeze({
      ...body,
      evidenceHash: canonicalDigest({
        tenantId: input.tenantId,
        propertyNode: input.propertyNode,
        reservationId: input.reservationId,
        invoiceTimingEvidenceHash: timing.evidenceHash,
        rateVersionPairEvidenceHash: input.rateVersionPair.evidenceHash,
        ...body,
      }),
    });
  }
  if (selectedMembers.size !== 2 || input.section14PaymentEvidence === null) {
    fail("mixed rate periods require complete governed Section14 payment evidence");
  }
  const invoiceTiming = freeze({
    propertyNode: input.propertyNode,
    serviceProvision: input.paymentReceipt.serviceProvision,
    invoiceIssueDate: timing.invoiceIssueDate,
    amountMinor: timing.amountMinor,
    currency: timing.currency,
    evidenceHash: input.nativeTiming.evidenceHash,
  });
  const section14 = deriveIndiaGstSection14RateSelectionFromEvidence({
    tenantId: input.tenantId,
    propertyNode: input.propertyNode,
    reservationId: input.reservationId,
    rateVersionPair: input.rateVersionPair,
    rateChangeDateEvidence: input.rateChangeDateEvidence,
    serviceProvisionResult: input.serviceProvision,
    paymentReceiptResult: input.paymentReceipt,
    invoiceTiming,
    paymentEvidence: input.section14PaymentEvidence,
  });
  histories.paymentReceipt = validateHistoricalResolution(
    input.tenantId,
    input.propertyNode,
    section14.paymentReceiptDate,
    input.rateVersionPair,
    historiesRaw.paymentReceipt as IndiaGstAccommodationHistoricalResolutionResult,
    "paymentReceipt historical resolution",
  );
  histories.timeOfSupply = validateHistoricalResolution(
    input.tenantId,
    input.propertyNode,
    section14.timeOfSupplyDate,
    input.rateVersionPair,
    historiesRaw.timeOfSupply as IndiaGstAccommodationHistoricalResolutionResult,
    "timeOfSupply historical resolution",
  );
  const selectedHistoryVersion = {
    extensionId: histories.timeOfSupply.selectedExtension.extensionId,
    version: histories.timeOfSupply.selectedExtension.version,
    status: histories.timeOfSupply.selectedExtension.status,
    contentHash: histories.timeOfSupply.selectedExtension.contentHash,
    effectiveFromInstant: histories.timeOfSupply.selectedExtension.effectiveFromInstant,
    effectiveToInstant: histories.timeOfSupply.selectedExtension.effectiveToInstant,
  };
  if (canonicalJson(section14.selectedVersion)
        !== canonicalJson(selectedHistoryVersion)) {
    fail("Section14 selection conflicts with whole-day time-of-supply history");
  }
  const historicalResolutionEvidenceHashes = Object.freeze({
    serviceProvision: histories.serviceProvision.evidenceHash,
    invoiceIssue: histories.invoiceIssue.evidenceHash,
    supplierBooksEntry: histories.supplierBooksEntry.evidenceHash,
    supplierBankCredit: histories.supplierBankCredit.evidenceHash,
    paymentReceipt: histories.paymentReceipt.evidenceHash,
    timeOfSupply: histories.timeOfSupply.evidenceHash,
  });
  const body = {
    kind: "genuine_section14_rate_change" as const,
    section14,
    historicalResolutionEvidenceHashes,
  };
  return freeze({
    ...body,
    evidenceHash: canonicalDigest({
      tenantId: input.tenantId,
      propertyNode: input.propertyNode,
      reservationId: input.reservationId,
      invoiceTimingEvidenceHash: timing.evidenceHash,
      rateVersionPairEvidenceHash: input.rateVersionPair.evidenceHash,
      ...body,
    }),
  });
}

function validateNativeRateSourceResult(raw: IndiaGstAccommodationNativeRateSource): void {
  let kind: unknown;
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)
      && !utilTypes.isProxy(raw)) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, "kind");
    if (descriptor && descriptor.get === undefined && descriptor.set === undefined
        && "value" in descriptor) kind = descriptor.value;
  }
  const rate = exact(
    raw,
    kind === "ordinary_section13_single_version"
      ? ["kind", "selectedVersion", "historicalResolutionEvidenceHashes", "evidenceHash"]
      : ["kind", "section14", "historicalResolutionEvidenceHashes", "evidenceHash"],
    "native rate-source result",
  );
  const histories = exact(
    rate.historicalResolutionEvidenceHashes,
    NATIVE_RATE_HISTORY_HASH_KEYS,
    "native rate-source history hashes",
  );
  for (const key of NATIVE_RATE_HISTORY_HASH_KEYS) hash(histories[key], `native ${key} history hash`);
  hash(rate.evidenceHash, "native rate-source evidence hash");
  if (rate.kind === "ordinary_section13_single_version") {
    const version = exact(rate.selectedVersion, ["extensionId", "key", "version", "status", "effectiveFromInstant", "effectiveToInstant", "content", "contentHash", "gstRoomSlabs"], "native selected rate version");
    uuid(version.extensionId, "native selected rate-version id");
    if (version.key !== "in-gst-lodging" || version.version !== 1 && version.version !== 2
        || version.status !== "retired" && version.status !== "active"
        || typeof version.effectiveFromInstant !== "string"
        || version.effectiveToInstant !== null && typeof version.effectiveToInstant !== "string") {
      fail("native selected rate version is invalid");
    }
    if (typeof version.content !== "object" || version.content === null
        || Array.isArray(version.content) || utilTypes.isProxy(version.content)
        || Object.getOwnPropertySymbols(version.content).length !== 0
        || (Object.getPrototypeOf(version.content) !== Object.prototype
          && Object.getPrototypeOf(version.content) !== null)) {
      fail("native selected rate content must be an exact plain object");
    }
    exact(version.content, Object.keys(version.content), "native selected rate content");
    if (hash(version.contentHash, "native selected rate content hash")
        !== canonicalDigest(version.content)) fail("native selected rate content hash is inconsistent");
    if (!Array.isArray(version.gstRoomSlabs) || version.gstRoomSlabs.length !== 2) fail("native selected GST room slabs are invalid");
    for (const slabRaw of version.gstRoomSlabs) {
      const slab = exact(slabRaw, ["uptoMinor", "rate", "itcEligible"], "native selected GST room slab");
      if (slab.uptoMinor !== null && (!Number.isSafeInteger(slab.uptoMinor) || (slab.uptoMinor as number) <= 0)
          || typeof slab.rate !== "number" || !Number.isFinite(slab.rate) || slab.rate < 0 || slab.rate > 1
          || typeof slab.itcEligible !== "boolean") fail("native selected GST room slab is invalid");
    }
    return;
  }
  if (rate.kind !== "genuine_section14_rate_change") fail("native rate-source kind is invalid");
  const section14 = exact(rate.section14, SECTION14_RESULT_KEYS, "native Section14 result");
  const cases = new Set([
    "supply_before_invoice_after_payment_after", "supply_invoice_before_payment_after",
    "supply_payment_before_invoice_after", "supply_after_invoice_before_payment_after",
    "supply_after_invoice_payment_before", "supply_invoice_after_payment_before",
  ]);
  for (const key of ["serviceProvisionDate", "invoiceIssueDate", "paymentReceiptDate", "rateChangeDate", "timeOfSupplyDate"] as const) civilDate(section14[key], `native Section14 ${key}`);
  if (typeof section14.case !== "string" || !cases.has(section14.case)
      || section14.selectedVersionSide !== "predecessor" && section14.selectedVersionSide !== "successor"
      || section14.legalRule !== "CGST_ACT_14_CHANGE_IN_RATE_SIX_CASE_RATE_VERSION_SELECTION") fail("native Section14 result is invalid");
  const selected = exact(section14.selectedVersion, ["extensionId", "version", "status", "contentHash", "effectiveFromInstant", "effectiveToInstant"], "native Section14 selected version");
  uuid(selected.extensionId, "native Section14 selected version id"); hash(selected.contentHash, "native Section14 selected version content hash");
  if (selected.version !== 1 && selected.version !== 2 || selected.status !== "retired" && selected.status !== "active" || typeof selected.effectiveFromInstant !== "string" || selected.effectiveToInstant !== null && typeof selected.effectiveToInstant !== "string") fail("native Section14 selected version is invalid");
  const predecessorHashes = exact(section14.predecessorHashes, ["rateVersionPair", "rateChangeDate", "serviceProvision", "paymentReceipt", "invoiceIssue", "paymentProviso", "workingDayCalendar", "governedPaymentReceipt"], "native Section14 predecessor hashes");
  for (const key of ["rateVersionPair", "rateChangeDate", "serviceProvision", "paymentReceipt", "invoiceIssue", "paymentProviso"] as const) hash(predecessorHashes[key], `native Section14 ${key} hash`);
  for (const key of ["workingDayCalendar", "governedPaymentReceipt"] as const) if (predecessorHashes[key] !== null) hash(predecessorHashes[key], `native Section14 ${key} hash`);
  hash(section14.evidenceHash, "native Section14 evidence hash");
}

/**
 * Validates the exact, frozen reduced native result and its timing/source envelope.
 * It cannot authenticate the rate-source inner evidence hashes because the reduced
 * result intentionally omits their rate-version-pair and historical roots; that
 * authentication remains mandatory at the persisted issuance boundary.
 */
export function validateIndiaGstAccommodationNativeInvoiceSourceResult(
  tenantIdRaw: string,
  raw: IndiaGstAccommodationNativeInvoiceSourceResult,
): IndiaGstAccommodationNativeInvoiceSourceResult {
  const tenantId = uuid(tenantIdRaw, "tenantId");
  deeplyFrozen(raw, "native invoice-source result");
  const source = exact(raw, NATIVE_RESULT_KEYS, "native invoice-source result");
  if (source.kind !== "native_current_transaction") fail("native invoice-source result kind is invalid");
  const timing = exact(source.timing, NATIVE_TIMING_RESULT_KEYS, "native invoice timing result");
  for (const key of ["nativeTimingId", "prospectiveDocumentId", "serviceProvisionSnapshotId", "paymentReceiptSnapshotId", "ordinaryRegimeEvidenceId", "propertyNode", "reservationId"] as const) uuid(timing[key], `native timing ${key}`);
  for (const key of ["serviceProvisionDate", "paymentReceiptDate", "invoiceIssueDate", "supplierBooksEntryDate", "supplierBankCreditDate", "deadlineDate", "timeOfSupplyDate"] as const) civilDate(timing[key], `native timing ${key}`);
  const predecessors = exact(timing.predecessorHashes, ["serviceProvision", "paymentReceipt", "ordinaryRegime", "nativeTiming"], "native timing predecessor hashes");
  for (const key of ["serviceProvision", "paymentReceipt", "ordinaryRegime", "nativeTiming"] as const) hash(predecessors[key], `native timing ${key} hash`);
  const dates = deriveIndiaGstAccommodationOrdinaryTimeOfSupplyDates({ serviceProvisionDate: timing.serviceProvisionDate as string, paymentReceiptDate: timing.paymentReceiptDate as string, invoiceIssueDate: timing.invoiceIssueDate as string });
  exact(timing.candidateDates, dates.branch === "section13_2_a_invoice_or_payment" ? ["invoiceIssueDate", "paymentReceiptDate"] : ["serviceProvisionDate", "paymentReceiptDate"], "native timing candidate dates");
  if (timing.kind !== "native_current_transaction" || timing.deadlineDate !== dates.deadlineDate
      || timing.branch !== dates.branch || timing.timeOfSupplyDate !== dates.timeOfSupplyDate
      || canonicalJson(timing.candidateDates) !== canonicalJson(dates.candidateDates)
      || timing.paymentReceiptDate !== ((timing.supplierBooksEntryDate as string) < (timing.supplierBankCreditDate as string) ? timing.supplierBooksEntryDate : timing.supplierBankCreditDate)
      || timing.regime !== "ordinary_rule47_30_day" || timing.ordinaryRegimeSource !== "governed_rule47_ordinary_regime_record"
      || timing.ordinaryRegimeLegalBasis !== "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT"
      || timing.currency !== "INR" || typeof timing.amountMinor !== "string" || !DECIMAL.test(timing.amountMinor)
      || BigInt(timing.amountMinor) > INT64_MAX) fail("native invoice timing semantics are invalid");
  const timingBody = Object.fromEntries(NATIVE_TIMING_RESULT_KEYS.slice(0, -1).map((key) => [key, timing[key]]));
  if (hash(timing.evidenceHash, "native timing evidence hash") !== canonicalDigest({ tenantId, ...timingBody })) fail("native timing evidence hash is invalid");
  validateNativeRateSourceResult(source.rateSource as IndiaGstAccommodationNativeRateSource);
  if (hash(source.evidenceHash, "native invoice-source evidence hash") !== canonicalDigest({ tenantId, kind: source.kind, timing: source.timing, rateSource: source.rateSource })) fail("native invoice-source evidence hash is invalid");
  return raw;
}

/**
 * Pure native timing/rate composition. Persisted-root authentication remains
 * the responsibility of the owner-mediated SQL issuance boundary.
 */
export function deriveIndiaGstAccommodationNativeInvoiceSource(
  raw: IndiaGstAccommodationNativeInvoiceSourceInput,
): IndiaGstAccommodationNativeInvoiceSourceResult {
  const input = exact(raw, NATIVE_INPUT_KEYS, "native invoice-source input") as unknown as
    IndiaGstAccommodationNativeInvoiceSourceInput;
  if (input.kind !== "native_current_transaction") fail("native invoice-source kind is invalid");
  const tenantId = uuid(input.tenantId, "tenantId");
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  const reservationId = uuid(input.reservationId, "reservationId");
  validateLineage(propertyNode, reservationId, input.serviceProvision, input.paymentReceipt);
  validateRateInputs(
    tenantId,
    propertyNode,
    input.rateVersionPair,
    input.rateChangeDateEvidence,
  );
  const timing = nativeTiming(
    tenantId,
    propertyNode,
    reservationId,
    input.serviceProvision,
    input.paymentReceipt,
    input.ordinaryRegime,
    input.nativeTiming,
  );
  const rateSource = nativeRateSource(input, timing);
  const body = { kind: "native_current_transaction" as const, timing, rateSource };
  return validateIndiaGstAccommodationNativeInvoiceSourceResult(
    tenantId,
    freeze({ ...body, evidenceHash: canonicalDigest({ tenantId, ...body }) }),
  );
}

function validateExternalTimeOfSupply(
  tenantId: string,
  propertyNode: string,
  reservationId: string,
  raw: IndiaGstAccommodationTimeOfSupplyResult,
): IndiaGstAccommodationTimeOfSupplyResult {
  deeplyFrozen(raw, "external time-of-supply evidence");
  exact(raw, EXTERNAL_TIME_KEYS, "external time-of-supply evidence");
  const expectedDates = deriveIndiaGstAccommodationOrdinaryTimeOfSupplyDates({
    serviceProvisionDate: raw.serviceProvisionDate,
    paymentReceiptDate: raw.paymentReceiptDate,
    invoiceIssueDate: raw.invoiceIssueDate,
  });
  if (raw.propertyNode !== propertyNode || raw.reservationId !== reservationId
      || raw.reservationLineage.reservationId !== reservationId
      || raw.source !== "governed_rule47_ordinary_regime_record"
      || raw.regime !== "ordinary_rule47_30_day"
      || raw.legalRule !== "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY"
      || raw.invoiceIssueSource !== "governed_supplier_tax_invoice_record"
      || raw.invoiceIssueLegalRule !== "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY"
      || raw.deadlineDate !== expectedDates.deadlineDate
      || raw.branch !== expectedDates.branch
      || raw.timeOfSupplyDate !== expectedDates.timeOfSupplyDate
      || canonicalJson(raw.candidateDates) !== canonicalJson(expectedDates.candidateDates)) {
    fail("external time-of-supply evidence conflicts with its approved contract");
  }
  const { evidenceHash, ...body } = raw;
  if (hash(evidenceHash, "external time-of-supply evidence hash")
      !== insertionDigest({ tenantId, ...body })) {
    fail("external time-of-supply evidence hash is invalid");
  }
  return raw;
}

function validateExternalSection14(
  tenantId: string,
  propertyNode: string,
  reservationId: string,
  timing: IndiaGstAccommodationTimeOfSupplyResult,
  rateDate: IndiaGstAccommodationRateChangeDateResult,
  raw: IndiaGstSection14RateSelectionResult,
): IndiaGstSection14RateSelectionResult {
  deeplyFrozen(raw, "external Section14 evidence");
  exact(raw, SECTION14_RESULT_KEYS, "external Section14 evidence");
  if (raw.serviceProvisionDate !== timing.serviceProvisionDate
      || raw.invoiceIssueDate !== timing.invoiceIssueDate
      || raw.rateChangeDate !== rateDate.rateChangeDate
      || raw.predecessorHashes.rateVersionPair !== rateDate.pairEvidenceHash
      || raw.predecessorHashes.rateChangeDate !== rateDate.evidenceHash) {
    fail("external Section14 evidence conflicts with timing or rate history");
  }
  const body = {
    case: raw.case,
    serviceProvisionDate: raw.serviceProvisionDate,
    invoiceIssueDate: raw.invoiceIssueDate,
    paymentReceiptDate: raw.paymentReceiptDate,
    rateChangeDate: raw.rateChangeDate,
    timeOfSupplyDate: raw.timeOfSupplyDate,
    selectedVersionSide: raw.selectedVersionSide,
    selectedVersion: raw.selectedVersion,
    legalRule: raw.legalRule,
    predecessorHashes: raw.predecessorHashes,
  };
  if (hash(raw.evidenceHash, "external Section14 evidence hash")
      !== insertionDigest({ tenantId, propertyNode, reservationId, ...body })) {
    fail("external Section14 evidence hash is invalid");
  }
  return raw;
}

/** Preserves the approved external envelopes without granting issue authority. */
export function adaptIndiaGstAccommodationExternalInvoiceSource(
  raw: IndiaGstAccommodationExternalInvoiceSourceInput,
): IndiaGstAccommodationExternalInvoiceSourceResult {
  const input = exact(raw, EXTERNAL_INPUT_KEYS, "external invoice-source input") as unknown as
    IndiaGstAccommodationExternalInvoiceSourceInput;
  if (input.kind !== "external_issued_invoice") fail("external invoice-source kind is invalid");
  const tenantId = uuid(input.tenantId, "tenantId");
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  const reservationId = uuid(input.reservationId, "reservationId");
  const rateDate = validateRateInputs(
    tenantId,
    propertyNode,
    input.rateVersionPair,
    input.rateChangeDateEvidence,
  );
  const timeOfSupply = validateExternalTimeOfSupply(
    tenantId,
    propertyNode,
    reservationId,
    input.timeOfSupply,
  );
  const section14 = validateExternalSection14(
    tenantId,
    propertyNode,
    reservationId,
    timeOfSupply,
    rateDate,
    input.section14,
  );
  const body = { kind: "external_issued_invoice" as const, timeOfSupply, section14 };
  return freeze({ ...body, evidenceHash: canonicalDigest({ tenantId, ...body }) });
}

export function deriveIndiaGstAccommodationInvoiceSource(
  input: IndiaGstAccommodationInvoiceSourceInput,
): IndiaGstAccommodationInvoiceSourceResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)
      || utilTypes.isProxy(input)) {
    return fail("invoice-source input must be an exact plain object");
  }
  const kind = Object.getOwnPropertyDescriptor(input, "kind");
  if (!kind || !("value" in kind)) return fail("invoice-source kind is invalid");
  if (kind.value === "native_current_transaction") {
    return deriveIndiaGstAccommodationNativeInvoiceSource(
      input as IndiaGstAccommodationNativeInvoiceSourceInput,
    );
  }
  if (kind.value === "external_issued_invoice") {
    return adaptIndiaGstAccommodationExternalInvoiceSource(
      input as IndiaGstAccommodationExternalInvoiceSourceInput,
    );
  }
  return fail("invoice-source kind is invalid");
}
