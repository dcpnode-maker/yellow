import { types as utilTypes } from "node:util";

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INPUT_KEYS = [
  "supplierBooksEntryDate",
  "supplierBankCreditDate",
  "rateChangeDate",
] as const;

export interface IndiaGstSection14PaymentProvisoInput {
  readonly supplierBooksEntryDate: string;
  readonly supplierBankCreditDate: string;
  readonly rateChangeDate: string;
}

interface IndiaGstSection14PaymentProvisoEvidence {
  readonly supplierBooksEntryDate: string;
  readonly supplierBankCreditDate: string;
  readonly rateChangeDate: string;
  readonly legalRule: "CGST_ACT_14_PAYMENT_CREDIT_FOUR_WORKING_DAY_PROVISO_GUARD";
  readonly evidenceHash: string;
}

export interface IndiaGstSection14ProvisoNotTriggeredResult
  extends IndiaGstSection14PaymentProvisoEvidence {
  readonly state: "proviso_not_triggered_on_recorded_dates";
  readonly paymentReceiptDate: string;
}

export interface IndiaGstSection14WorkingDayCalendarRequiredResult
  extends IndiaGstSection14PaymentProvisoEvidence {
  readonly state: "working_day_calendar_required";
}

export type IndiaGstSection14PaymentProvisoResult =
  | IndiaGstSection14ProvisoNotTriggeredResult
  | IndiaGstSection14WorkingDayCalendarRequiredResult;

export class IndiaGstSection14PaymentProvisoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstSection14PaymentProvisoValidationError";
  }
}

function exactInput(value: unknown): Record<string, unknown> {
  if (
    typeof value !== "object" || value === null || Array.isArray(value) ||
    utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new IndiaGstSection14PaymentProvisoValidationError(
      "section14 payment proviso input must be an exact plain object",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...INPUT_KEYS].sort();
  if (
    actual.length !== expected.length || actual.some((key, index) => key !== expected[index]) ||
    Object.values(descriptors).some((descriptor) => descriptor.get !== undefined ||
      descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor))
  ) {
    throw new IndiaGstSection14PaymentProvisoValidationError(
      "section14 payment proviso input shape is invalid",
    );
  }
  return value as Record<string, unknown>;
}

function civilDate(value: unknown, subject: string): string {
  if (typeof value !== "string") {
    throw new IndiaGstSection14PaymentProvisoValidationError(`${subject} is invalid`);
  }
  const match = DATE.exec(value);
  if (!match) throw new IndiaGstSection14PaymentProvisoValidationError(`${subject} is invalid`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > (days[month - 1] ?? 0)) {
    throw new IndiaGstSection14PaymentProvisoValidationError(`${subject} is invalid`);
  }
  return value;
}

function evidenceHash(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

export function resolveIndiaGstSection14PaymentProviso(
  raw: IndiaGstSection14PaymentProvisoInput,
): IndiaGstSection14PaymentProvisoResult {
  const input = exactInput(raw);
  const supplierBooksEntryDate = civilDate(
    input.supplierBooksEntryDate,
    "supplierBooksEntryDate",
  );
  const supplierBankCreditDate = civilDate(
    input.supplierBankCreditDate,
    "supplierBankCreditDate",
  );
  const rateChangeDate = civilDate(input.rateChangeDate, "rateChangeDate");
  const legalRule = "CGST_ACT_14_PAYMENT_CREDIT_FOUR_WORKING_DAY_PROVISO_GUARD" as const;

  if (supplierBankCreditDate > rateChangeDate) {
    const evidence = {
      state: "working_day_calendar_required" as const,
      supplierBooksEntryDate,
      supplierBankCreditDate,
      rateChangeDate,
      legalRule,
    };
    return Object.freeze({ ...evidence, evidenceHash: evidenceHash(evidence) });
  }

  const evidence = {
    state: "proviso_not_triggered_on_recorded_dates" as const,
    paymentReceiptDate: supplierBooksEntryDate < supplierBankCreditDate
      ? supplierBooksEntryDate
      : supplierBankCreditDate,
    supplierBooksEntryDate,
    supplierBankCreditDate,
    rateChangeDate,
    legalRule,
  };
  return Object.freeze({ ...evidence, evidenceHash: evidenceHash(evidence) });
}
