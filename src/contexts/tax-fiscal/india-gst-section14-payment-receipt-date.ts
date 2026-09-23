import { types as utilTypes } from "node:util";

import {
  deriveIndiaGstAccommodationRateChangeDate,
  type IndiaGstAccommodationRateChangeDateResult,
} from "./india-gst-accommodation-rate-change-date";
import type { IndiaGstAccommodationRateVersionPairResult } from "./india-gst-accommodation-rate-version-pair";
import {
  resolveIndiaGstSection14PaymentProviso,
  type IndiaGstSection14PaymentProvisoResult,
} from "./india-gst-section14-payment-proviso";
import {
  deriveIndiaGstSection14WorkingDayCalendarEvidence,
  type IndiaGstSection14WorkingDayCalendarEvidenceInput,
  type IndiaGstSection14WorkingDayCalendarEvidenceResult,
} from "./india-gst-section14-working-day-calendar-evidence";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INPUT_KEYS = [
  "tenantId", "rateVersionPair", "rateChangeDateEvidence", "supplierBooksEntryDate",
  "supplierBankCreditDate", "paymentProvisoEvidence", "throughDate", "calendarEvidence",
  "workingDayEvidence",
] as const;

type JsonRecord = Record<string, unknown>;

export interface IndiaGstSection14PaymentReceiptDateInput {
  readonly tenantId: string;
  readonly rateVersionPair: IndiaGstAccommodationRateVersionPairResult;
  readonly rateChangeDateEvidence: IndiaGstAccommodationRateChangeDateResult;
  readonly supplierBooksEntryDate: string;
  readonly supplierBankCreditDate: string;
  readonly paymentProvisoEvidence: IndiaGstSection14PaymentProvisoResult;
  readonly throughDate: string;
  readonly calendarEvidence: IndiaGstSection14WorkingDayCalendarEvidenceInput["calendarEvidence"];
  readonly workingDayEvidence: IndiaGstSection14WorkingDayCalendarEvidenceResult;
}

export interface IndiaGstSection14PaymentReceiptDateResult {
  readonly rateChangeDate: string;
  readonly supplierBooksEntryDate: string;
  readonly supplierBankCreditDate: string;
  readonly fourthWorkingDayDate: string;
  readonly paymentReceiptDate: string;
  readonly branch: "ordinary_earlier_of_within_four_working_days" | "bank_credit_after_four_working_days";
  readonly calendarAuthorityId: string;
  readonly calendarSourceDigestSha256: string;
  readonly legalRule: "CGST_ACT_14_PAYMENT_RECEIPT_DATE_FOUR_WORKING_DAY_PROVISO";
  readonly predecessorHashes: Readonly<{
    readonly rateChangeDate: string;
    readonly paymentProviso: string;
    readonly workingDayCalendar: string;
  }>;
  readonly evidenceHash: string;
}

export class IndiaGstSection14PaymentReceiptDateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstSection14PaymentReceiptDateValidationError";
  }
}

function fail(message: string): never {
  throw new IndiaGstSection14PaymentReceiptDateValidationError(message);
}

function exact(value: unknown, expected: readonly string[], subject: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getOwnPropertySymbols(value).length !== 0
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    return fail(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])
      || Object.values(descriptors).some((descriptor) => descriptor.get !== undefined
        || descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor))) {
    return fail(`${subject} shape is invalid`);
  }
  return value as JsonRecord;
}

function frozenGraph(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return;
  if (typeof value !== "object" || seen.has(value) || utilTypes.isProxy(value)
      || !Object.isFrozen(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    fail("supplied predecessor evidence must be a deeply frozen non-repeating graph");
  }
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null) fail("supplied predecessor evidence must contain plain objects only");
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      fail("supplied predecessor arrays must be exact and dense");
    }
  }
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === "length") continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true
        || descriptor.configurable !== false || !("value" in descriptor) || descriptor.writable !== false) {
      fail("supplied predecessor descriptors are invalid");
    }
    frozenGraph(descriptor.value, seen);
  }
}

function exactReplay<T>(supplied: T, rederived: T, subject: string): T {
  frozenGraph(supplied);
  if (JSON.stringify(supplied) !== JSON.stringify(rederived)) fail(`${subject} does not byte-match complete ancestry`);
  return rederived;
}

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

export function deriveIndiaGstSection14PaymentReceiptDate(
  raw: IndiaGstSection14PaymentReceiptDateInput,
): IndiaGstSection14PaymentReceiptDateResult {
  const input = exact(raw, INPUT_KEYS, "section14 payment-receipt input");
  const tenantId = typeof input.tenantId === "string" && UUID.test(input.tenantId)
    ? input.tenantId
    : fail("tenantId must be a canonical UUID");

  let rateDate: IndiaGstAccommodationRateChangeDateResult;
  let proviso: IndiaGstSection14PaymentProvisoResult;
  let calendar: IndiaGstSection14WorkingDayCalendarEvidenceResult;
  try {
    rateDate = deriveIndiaGstAccommodationRateChangeDate({
      tenantId,
      rateVersionPair: input.rateVersionPair as IndiaGstAccommodationRateVersionPairResult,
    });
    exactReplay(input.rateChangeDateEvidence as IndiaGstAccommodationRateChangeDateResult, rateDate, "rate-change-date evidence");
    proviso = resolveIndiaGstSection14PaymentProviso({
      supplierBooksEntryDate: input.supplierBooksEntryDate as string,
      supplierBankCreditDate: input.supplierBankCreditDate as string,
      rateChangeDate: rateDate.rateChangeDate,
    });
    exactReplay(input.paymentProvisoEvidence as IndiaGstSection14PaymentProvisoResult, proviso, "payment-proviso evidence");
    calendar = deriveIndiaGstSection14WorkingDayCalendarEvidence({
      tenantId,
      rateChangeDate: rateDate.rateChangeDate,
      throughDate: input.throughDate as string,
      calendarEvidence: input.calendarEvidence as IndiaGstSection14WorkingDayCalendarEvidenceInput["calendarEvidence"],
    });
    exactReplay(input.workingDayEvidence as IndiaGstSection14WorkingDayCalendarEvidenceResult, calendar, "working-day evidence");
  } catch (error) {
    if (error instanceof IndiaGstSection14PaymentReceiptDateValidationError) throw error;
    return fail("complete predecessor ancestry is invalid");
  }

  if (proviso.state !== "working_day_calendar_required") {
    fail("payment proviso evidence is not in the calendar-required branch");
  }
  const bankDate = proviso.supplierBankCreditDate;
  if (!calendar.calendarDays.some((day) => day.date === bankDate)) {
    fail("working-day calendar does not contain supplier bank-credit date");
  }
  const booksDate = proviso.supplierBooksEntryDate;
  const afterFour = bankDate > calendar.fourthWorkingDayDate;
  const branch = afterFour
    ? "bank_credit_after_four_working_days" as const
    : "ordinary_earlier_of_within_four_working_days" as const;
  const paymentReceiptDate = afterFour ? bankDate : booksDate < bankDate ? booksDate : bankDate;
  const predecessorHashes = Object.freeze({
    rateChangeDate: rateDate.evidenceHash,
    paymentProviso: proviso.evidenceHash,
    workingDayCalendar: calendar.evidenceHash,
  });
  const body = Object.freeze({
    rateChangeDate: rateDate.rateChangeDate,
    supplierBooksEntryDate: booksDate,
    supplierBankCreditDate: bankDate,
    fourthWorkingDayDate: calendar.fourthWorkingDayDate,
    paymentReceiptDate,
    branch,
    calendarAuthorityId: calendar.authorityId,
    calendarSourceDigestSha256: calendar.sourceDigestSha256,
    legalRule: "CGST_ACT_14_PAYMENT_RECEIPT_DATE_FOUR_WORKING_DAY_PROVISO" as const,
    predecessorHashes,
  });
  return Object.freeze({ ...body, evidenceHash: digest({ tenantId, ...body }) });
}
