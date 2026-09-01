import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";
import {
  IndiaGstAccommodationInvoiceIssueDateService,
  type IndiaGstAccommodationInvoiceIssueDateInput,
  type IndiaGstAccommodationInvoiceIssueDateResult,
} from "./india-gst-accommodation-invoice-issue-date";
import {
  IndiaGstAccommodationPaymentReceiptDateService,
  type IndiaGstAccommodationPaymentReceiptDateInput,
  type IndiaGstAccommodationPaymentReceiptDateResult,
} from "./india-gst-accommodation-payment-receipt-date";
import {
  deriveIndiaGstAccommodationRateChangeDate,
  type IndiaGstAccommodationRateChangeDateResult,
} from "./india-gst-accommodation-rate-change-date";
import type { IndiaGstAccommodationRateVersionPairResult } from "./india-gst-accommodation-rate-version-pair";
import {
  IndiaGstAccommodationServiceProvisionDateService,
  type IndiaGstAccommodationServiceProvisionDateInput,
  type IndiaGstAccommodationServiceProvisionDateResult,
} from "./india-gst-accommodation-service-provision-date";
import {
  resolveIndiaGstSection14PaymentProviso,
  type IndiaGstSection14PaymentProvisoResult,
} from "./india-gst-section14-payment-proviso";
import {
  deriveIndiaGstSection14PaymentReceiptDate,
  type IndiaGstSection14PaymentReceiptDateResult,
} from "./india-gst-section14-payment-receipt-date";
import {
  deriveIndiaGstSection14WorkingDayCalendarEvidence,
  type IndiaGstSection14WorkingDayCalendarEvidenceInput,
  type IndiaGstSection14WorkingDayCalendarEvidenceResult,
} from "./india-gst-section14-working-day-calendar-evidence";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INPUT_KEYS = [
  "tenantId", "propertyNode", "reservationId", "rateVersionPair",
  "rateChangeDateEvidence",
  "serviceProvisionInput", "serviceProvisionResult",
  "paymentReceiptInput", "paymentReceiptResult",
  "invoiceIssueInput", "invoiceIssueResult", "paymentEvidence",
] as const;
const SAFE_KEYS = ["kind", "paymentProvisoEvidence"] as const;
const CALENDAR_KEYS = [
  "kind", "paymentProvisoEvidence", "throughDate", "calendarEvidence",
  "workingDayEvidence", "paymentReceiptEvidence",
] as const;

type JsonRecord = Record<string, unknown>;

export type IndiaGstSection14PaymentEvidence =
  | Readonly<{
    readonly kind: "safe_ordinary_receipt";
    readonly paymentProvisoEvidence: IndiaGstSection14PaymentProvisoResult;
  }>
  | Readonly<{
    readonly kind: "calendar_governed_receipt";
    readonly paymentProvisoEvidence: IndiaGstSection14PaymentProvisoResult;
    readonly throughDate: string;
    readonly calendarEvidence: IndiaGstSection14WorkingDayCalendarEvidenceInput["calendarEvidence"];
    readonly workingDayEvidence: IndiaGstSection14WorkingDayCalendarEvidenceResult;
    readonly paymentReceiptEvidence: IndiaGstSection14PaymentReceiptDateResult;
  }>;

export interface IndiaGstSection14RateSelectionInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly rateVersionPair: IndiaGstAccommodationRateVersionPairResult;
  readonly rateChangeDateEvidence: IndiaGstAccommodationRateChangeDateResult;
  readonly serviceProvisionInput: IndiaGstAccommodationServiceProvisionDateInput;
  readonly serviceProvisionResult: IndiaGstAccommodationServiceProvisionDateResult;
  readonly paymentReceiptInput: IndiaGstAccommodationPaymentReceiptDateInput;
  readonly paymentReceiptResult: IndiaGstAccommodationPaymentReceiptDateResult;
  readonly invoiceIssueInput: IndiaGstAccommodationInvoiceIssueDateInput;
  readonly invoiceIssueResult: IndiaGstAccommodationInvoiceIssueDateResult;
  readonly paymentEvidence: IndiaGstSection14PaymentEvidence;
}

export type IndiaGstSection14RateSelectionCase =
  | "supply_before_invoice_after_payment_after"
  | "supply_invoice_before_payment_after"
  | "supply_payment_before_invoice_after"
  | "supply_after_invoice_before_payment_after"
  | "supply_after_invoice_payment_before"
  | "supply_invoice_after_payment_before";

export interface IndiaGstSection14RateSelectionResult {
  readonly case: IndiaGstSection14RateSelectionCase;
  readonly serviceProvisionDate: string;
  readonly invoiceIssueDate: string;
  readonly paymentReceiptDate: string;
  readonly rateChangeDate: string;
  readonly timeOfSupplyDate: string;
  readonly selectedVersionSide: "predecessor" | "successor";
  readonly selectedVersion: Readonly<{
    readonly extensionId: string;
    readonly version: 1 | 2;
    readonly status: "retired" | "active";
    readonly contentHash: string;
    readonly effectiveFromInstant: string;
    readonly effectiveToInstant: string | null;
  }>;
  readonly legalRule: "CGST_ACT_14_CHANGE_IN_RATE_SIX_CASE_RATE_VERSION_SELECTION";
  readonly predecessorHashes: Readonly<{
    readonly rateVersionPair: string;
    readonly rateChangeDate: string;
    readonly serviceProvision: string;
    readonly paymentReceipt: string;
    readonly invoiceIssue: string;
    readonly paymentProviso: string;
    readonly workingDayCalendar: string | null;
    readonly governedPaymentReceipt: string | null;
  }>;
  readonly evidenceHash: string;
}

export class IndiaGstSection14RateSelectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstSection14RateSelectionValidationError";
  }
}

function fail(message: string): never {
  throw new IndiaGstSection14RateSelectionValidationError(message);
}

function exact(value: unknown, wanted: readonly string[], subject: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getOwnPropertySymbols(value).length !== 0
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    return fail(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...wanted].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])
      || Object.values(descriptors).some((descriptor) => descriptor.get !== undefined
        || descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor))) {
    return fail(`${subject} shape is invalid`);
  }
  return value as JsonRecord;
}

function paymentEvidenceRecord(value: unknown): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getOwnPropertySymbols(value).length !== 0
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    return fail("section14 payment evidence must be an exact plain object");
  }
  const kind = Object.getOwnPropertyDescriptor(value, "kind");
  if (!kind || kind.get !== undefined || kind.set !== undefined || kind.enumerable !== true
      || !("value" in kind) || (kind.value !== "safe_ordinary_receipt" && kind.value !== "calendar_governed_receipt")) {
    return fail("section14 payment evidence kind is invalid");
  }
  return exact(value, kind.value === "safe_ordinary_receipt" ? SAFE_KEYS : CALENDAR_KEYS, "section14 payment evidence");
}

function deeplyFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return;
  if (typeof value !== "object" || seen.has(value) || utilTypes.isProxy(value) || !Object.isFrozen(value)
      || Object.getOwnPropertySymbols(value).length !== 0) {
    fail("supplied governed result must be a deeply frozen non-repeating graph");
  }
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null) fail("supplied governed result must contain plain objects only");
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      fail("supplied governed result arrays must be exact and dense");
    }
  }
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === "length") continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true
        || descriptor.configurable !== false || descriptor.writable !== false || !("value" in descriptor)) {
      fail("supplied governed result descriptors are invalid");
    }
    deeplyFrozen(descriptor.value, seen);
  }
}

function replay<T>(supplied: unknown, fresh: T, subject: string): T {
  deeplyFrozen(supplied);
  if (JSON.stringify(supplied) !== JSON.stringify(fresh)) fail(`${subject} does not insertion-byte match fresh truth`);
  return fresh;
}

function uuid(value: unknown, subject: string): string {
  return typeof value === "string" && UUID.test(value) ? value : fail(`${subject} must be a canonical UUID`);
}

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function classify(
  serviceProvisionDate: string,
  invoiceIssueDate: string,
  paymentReceiptDate: string,
  rateChangeDate: string,
): Readonly<{ case: IndiaGstSection14RateSelectionCase; timeOfSupplyDate: string; selectedVersionSide: "predecessor" | "successor" }> {
  const service = serviceProvisionDate < rateChangeDate ? "before" : serviceProvisionDate > rateChangeDate ? "after" : "equal";
  const invoice = invoiceIssueDate < rateChangeDate ? "before" : invoiceIssueDate > rateChangeDate ? "after" : "equal";
  const payment = paymentReceiptDate < rateChangeDate ? "before" : paymentReceiptDate > rateChangeDate ? "after" : "equal";
  if (service === "equal" || invoice === "equal" || payment === "equal") fail("rate-change equality has no admitted section14 case");
  if (service === "before" && invoice === "after" && payment === "after") {
    return Object.freeze({ case: "supply_before_invoice_after_payment_after", timeOfSupplyDate: invoiceIssueDate < paymentReceiptDate ? invoiceIssueDate : paymentReceiptDate, selectedVersionSide: "successor" });
  }
  if (service === "before" && invoice === "before" && payment === "after") {
    return Object.freeze({ case: "supply_invoice_before_payment_after", timeOfSupplyDate: invoiceIssueDate, selectedVersionSide: "predecessor" });
  }
  if (service === "before" && invoice === "after" && payment === "before") {
    return Object.freeze({ case: "supply_payment_before_invoice_after", timeOfSupplyDate: paymentReceiptDate, selectedVersionSide: "predecessor" });
  }
  if (service === "after" && invoice === "before" && payment === "after") {
    return Object.freeze({ case: "supply_after_invoice_before_payment_after", timeOfSupplyDate: paymentReceiptDate, selectedVersionSide: "successor" });
  }
  if (service === "after" && invoice === "before" && payment === "before") {
    return Object.freeze({ case: "supply_after_invoice_payment_before", timeOfSupplyDate: invoiceIssueDate < paymentReceiptDate ? invoiceIssueDate : paymentReceiptDate, selectedVersionSide: "predecessor" });
  }
  if (service === "after" && invoice === "after" && payment === "before") {
    return Object.freeze({ case: "supply_invoice_after_payment_before", timeOfSupplyDate: invoiceIssueDate, selectedVersionSide: "successor" });
  }
  return fail("date arrangement has no admitted section14 case");
}

function rootsAgree(
  tenantId: string,
  propertyNode: string,
  reservationId: string,
  service: IndiaGstAccommodationServiceProvisionDateResult,
  payment: IndiaGstAccommodationPaymentReceiptDateResult,
  invoice: IndiaGstAccommodationInvoiceIssueDateResult,
): void {
  if (service.propertyNode !== propertyNode || payment.propertyNode !== propertyNode || invoice.propertyNode !== propertyNode
      || service.reservationLineage.reservationId !== reservationId
      || payment.serviceProvision.serviceProvisionSnapshotId !== service.serviceProvisionSnapshotId
      || invoice.serviceProvision.serviceProvisionSnapshotId !== service.serviceProvisionSnapshotId
      || payment.serviceProvision.serviceProvisionDate !== service.serviceProvisionDate
      || invoice.serviceProvision.serviceProvisionDate !== service.serviceProvisionDate
      || payment.serviceProvision.reservationLineage.reservationId !== reservationId
      || invoice.serviceProvision.reservationLineage.reservationId !== reservationId
      || payment.serviceProvision.reservationLineage.lineageId !== service.reservationLineage.lineageId
      || invoice.serviceProvision.reservationLineage.lineageId !== service.reservationLineage.lineageId
      || payment.serviceProvision.reservationLineage.holdBindingId !== service.reservationLineage.holdBindingId
      || invoice.serviceProvision.reservationLineage.holdBindingId !== service.reservationLineage.holdBindingId
      || payment.serviceProvision.reservationLineage.attributionId !== service.reservationLineage.attributionId
      || invoice.serviceProvision.reservationLineage.attributionId !== service.reservationLineage.attributionId
      || payment.serviceProvision.reservationLineage.segmentId !== service.reservationLineage.segmentId
      || invoice.serviceProvision.reservationLineage.segmentId !== service.reservationLineage.segmentId
      || payment.serviceProvision.reservationLineage.originQuoteHash !== service.reservationLineage.originQuoteHash
      || invoice.serviceProvision.reservationLineage.originQuoteHash !== service.reservationLineage.originQuoteHash
      || payment.serviceProvision.reservationLineage.snapshotHash !== service.reservationLineage.snapshotHash
      || invoice.serviceProvision.reservationLineage.snapshotHash !== service.reservationLineage.snapshotHash
      || payment.amountMinor !== invoice.amountMinor || payment.currency !== invoice.currency
      || payment.currency !== service.reservationLineage.currency || invoice.currency !== service.reservationLineage.currency) {
    fail("governed service, invoice, payment and attribution roots do not agree");
  }
  // Retaining tenant identity in the final preimage is intentional even though it is hidden.
  if (!UUID.test(tenantId)) fail("tenantId must be a canonical UUID");
}

export class IndiaGstSection14RateSelectionService {
  readonly #service = new IndiaGstAccommodationServiceProvisionDateService();
  readonly #payment = new IndiaGstAccommodationPaymentReceiptDateService();
  readonly #invoice = new IndiaGstAccommodationInvoiceIssueDateService();

  async resolve(tx: Tx, raw: IndiaGstSection14RateSelectionInput): Promise<IndiaGstSection14RateSelectionResult> {
    if (typeof tx !== "function") fail("tenant transaction is unavailable");
    const input = exact(raw, INPUT_KEYS, "section14 rate-selection input");
    const tenantId = uuid(input.tenantId, "tenantId");
    const propertyNode = uuid(input.propertyNode, "propertyNode");
    const reservationId = uuid(input.reservationId, "reservationId");
    try {
      deeplyFrozen(input.rateVersionPair);
      const rateDate = replay(input.rateChangeDateEvidence, deriveIndiaGstAccommodationRateChangeDate({ tenantId, rateVersionPair: input.rateVersionPair as IndiaGstAccommodationRateVersionPairResult }), "rate-change-date result");
      const service = replay(input.serviceProvisionResult, await this.#service.resolve(tx, input.serviceProvisionInput as IndiaGstAccommodationServiceProvisionDateInput), "service-provision result");
      const payment = replay(input.paymentReceiptResult, await this.#payment.resolve(tx, input.paymentReceiptInput as IndiaGstAccommodationPaymentReceiptDateInput), "payment-receipt result");
      const invoice = replay(input.invoiceIssueResult, await this.#invoice.resolve(tx, input.invoiceIssueInput as IndiaGstAccommodationInvoiceIssueDateInput), "invoice-issue result");
      if (input.rateVersionPair && (input.rateVersionPair as IndiaGstAccommodationRateVersionPairResult).propertyNode !== propertyNode) fail("rate-version pair property does not match governed roots");
      rootsAgree(tenantId, propertyNode, reservationId, service, payment, invoice);

      const evidence = paymentEvidenceRecord(input.paymentEvidence);
      let paymentReceiptDate: string;
      let proviso: IndiaGstSection14PaymentProvisoResult;
      let workingDayHash: string | null = null;
      let governedReceiptHash: string | null = null;
      try {
        proviso = resolveIndiaGstSection14PaymentProviso({ supplierBooksEntryDate: payment.supplierBooksEntryDate, supplierBankCreditDate: payment.supplierBankCreditDate, rateChangeDate: rateDate.rateChangeDate });
        replay(evidence.paymentProvisoEvidence, proviso, "payment-proviso result");
        if (evidence.kind === "safe_ordinary_receipt") {
          if (proviso.state !== "proviso_not_triggered_on_recorded_dates" || proviso.paymentReceiptDate !== payment.paymentReceiptDate) {
            fail("safe payment evidence does not equal the governed ordinary receipt");
          }
          paymentReceiptDate = proviso.paymentReceiptDate;
        } else if (evidence.kind === "calendar_governed_receipt") {
          if (proviso.state !== "working_day_calendar_required") fail("calendar payment evidence requires the governed calendar branch");
          const calendar = deriveIndiaGstSection14WorkingDayCalendarEvidence({ tenantId, rateChangeDate: rateDate.rateChangeDate, throughDate: evidence.throughDate as string, calendarEvidence: evidence.calendarEvidence as IndiaGstSection14WorkingDayCalendarEvidenceInput["calendarEvidence"] });
          replay(evidence.workingDayEvidence, calendar, "working-day-calendar result");
          const governed = deriveIndiaGstSection14PaymentReceiptDate({ tenantId, rateVersionPair: input.rateVersionPair as IndiaGstAccommodationRateVersionPairResult, rateChangeDateEvidence: rateDate, supplierBooksEntryDate: payment.supplierBooksEntryDate, supplierBankCreditDate: payment.supplierBankCreditDate, paymentProvisoEvidence: proviso, throughDate: evidence.throughDate as string, calendarEvidence: evidence.calendarEvidence as IndiaGstSection14WorkingDayCalendarEvidenceInput["calendarEvidence"], workingDayEvidence: calendar });
          replay(evidence.paymentReceiptEvidence, governed, "governed payment-receipt result");
          paymentReceiptDate = governed.paymentReceiptDate;
          workingDayHash = calendar.evidenceHash;
          governedReceiptHash = governed.evidenceHash;
        } else {
          fail("section14 payment evidence kind is invalid");
        }
      } catch (error) {
        if (error instanceof IndiaGstSection14RateSelectionValidationError) throw error;
        return fail("section14 payment evidence ancestry is invalid");
      }

      const selected = classify(service.serviceProvisionDate, invoice.invoiceIssueDate, paymentReceiptDate, rateDate.rateChangeDate);
      const version = selected.selectedVersionSide === "predecessor" ? (input.rateVersionPair as IndiaGstAccommodationRateVersionPairResult).predecessor : (input.rateVersionPair as IndiaGstAccommodationRateVersionPairResult).successor;
      const selectedVersion = Object.freeze({ extensionId: version.extensionId, version: version.version, status: version.status, contentHash: version.contentHash, effectiveFromInstant: version.effectiveFromInstant, effectiveToInstant: version.effectiveToInstant });
      const predecessorHashes = Object.freeze({ rateVersionPair: (input.rateVersionPair as IndiaGstAccommodationRateVersionPairResult).evidenceHash, rateChangeDate: rateDate.evidenceHash, serviceProvision: service.evidenceHash, paymentReceipt: payment.evidenceHash, invoiceIssue: invoice.evidenceHash, paymentProviso: proviso.evidenceHash, workingDayCalendar: workingDayHash, governedPaymentReceipt: governedReceiptHash });
      const body = Object.freeze({ case: selected.case, serviceProvisionDate: service.serviceProvisionDate, invoiceIssueDate: invoice.invoiceIssueDate, paymentReceiptDate, rateChangeDate: rateDate.rateChangeDate, timeOfSupplyDate: selected.timeOfSupplyDate, selectedVersionSide: selected.selectedVersionSide, selectedVersion, legalRule: "CGST_ACT_14_CHANGE_IN_RATE_SIX_CASE_RATE_VERSION_SELECTION" as const, predecessorHashes });
      return Object.freeze({ ...body, evidenceHash: digest({ tenantId, propertyNode, reservationId, ...body }) });
    } catch (error) {
      if (error instanceof IndiaGstSection14RateSelectionValidationError) throw error;
      return fail("complete governed section14 ancestry is invalid");
    }
  }
}
