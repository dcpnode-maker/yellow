import { types as utilTypes } from "node:util";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SHA256 = /^[0-9a-f]{64}$/;
const AUTHORITY = /^[A-Z][A-Z0-9_.:-]{2,127}$/;
const INPUT_KEYS = ["tenantId", "rateChangeDate", "throughDate", "calendarEvidence"] as const;
const EVIDENCE_KEYS = ["jurisdiction", "authorityId", "sourceDigestSha256", "days"] as const;
const DAY_KEYS = ["date", "state"] as const;

type JsonRecord = Record<string, unknown>;
export type IndiaGstWorkingDayState = "working" | "non_working";

export interface IndiaGstSection14WorkingDayCalendarEvidenceInput {
  readonly tenantId: string;
  readonly rateChangeDate: string;
  readonly throughDate: string;
  readonly calendarEvidence: Readonly<{
    readonly jurisdiction: "IN";
    readonly authorityId: string;
    readonly sourceDigestSha256: string;
    readonly days: readonly Readonly<{
      readonly date: string;
      readonly state: IndiaGstWorkingDayState;
    }>[];
  }>;
}

export interface IndiaGstSection14WorkingDayCalendarEvidenceResult {
  readonly rateChangeDate: string;
  readonly throughDate: string;
  readonly jurisdiction: "IN";
  readonly authorityId: string;
  readonly sourceDigestSha256: string;
  readonly calendarDays: readonly Readonly<{
    readonly date: string;
    readonly state: IndiaGstWorkingDayState;
  }>[];
  readonly firstFourWorkingDates: readonly [string, string, string, string];
  readonly fourthWorkingDayDate: string;
  readonly legalRule: "CGST_ACT_14_FOUR_WORKING_DAY_CALENDAR_EVIDENCE_ONLY";
  readonly evidenceHash: string;
}

export class IndiaGstSection14WorkingDayCalendarEvidenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstSection14WorkingDayCalendarEvidenceValidationError";
  }
}

function fail(message: string): never {
  throw new IndiaGstSection14WorkingDayCalendarEvidenceValidationError(message);
}

function exact(value: unknown, keys: readonly string[], subject: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getOwnPropertySymbols(value).length !== 0
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    return fail(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])
      || Object.values(descriptors).some((descriptor) => descriptor.get !== undefined
        || descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor))) {
    return fail(`${subject} shape is invalid`);
  }
  return value as JsonRecord;
}

function requireFrozenGraph(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value !== "object" || seen.has(value) || utilTypes.isProxy(value)
      || !Object.isFrozen(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    fail("calendar evidence must be a deeply frozen non-repeating graph");
  }
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null) fail("calendar evidence must contain plain objects only");
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      fail("calendar days must be an exact dense array");
    }
  }
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === "length") continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true
        || descriptor.configurable !== false || !("value" in descriptor) || descriptor.writable !== false) {
      fail("calendar evidence descriptors are invalid");
    }
    requireFrozenGraph(descriptor.value, seen);
  }
}

function civilDate(value: unknown, subject: string): string {
  if (typeof value !== "string") return fail(`${subject} is invalid`);
  const match = DATE.exec(value);
  if (!match) return fail(`${subject} is invalid`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const limits = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > (limits[month - 1] ?? 0)) {
    return fail(`${subject} is invalid`);
  }
  return value;
}

function nextCivilDate(value: string): string {
  let [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const limit = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  day += 1;
  if (day > limit) {
    day = 1;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
      if (year > 9999) fail("calendar sequence exceeds supported civil dates");
    }
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

export function deriveIndiaGstSection14WorkingDayCalendarEvidence(
  raw: IndiaGstSection14WorkingDayCalendarEvidenceInput,
): IndiaGstSection14WorkingDayCalendarEvidenceResult {
  const input = exact(raw, INPUT_KEYS, "working-day evidence input");
  const tenantId = typeof input.tenantId === "string" && UUID.test(input.tenantId)
    ? input.tenantId
    : fail("tenantId must be a canonical UUID");
  const rateChangeDate = civilDate(input.rateChangeDate, "rateChangeDate");
  const throughDate = civilDate(input.throughDate, "throughDate");
  const supplied = input.calendarEvidence;
  requireFrozenGraph(supplied);
  const evidence = exact(supplied, EVIDENCE_KEYS, "calendarEvidence");
  if (evidence.jurisdiction !== "IN") fail("calendarEvidence.jurisdiction must be IN");
  const authorityId = typeof evidence.authorityId === "string" && AUTHORITY.test(evidence.authorityId)
    ? evidence.authorityId
    : fail("calendarEvidence.authorityId is invalid");
  const sourceDigestSha256 = typeof evidence.sourceDigestSha256 === "string"
      && SHA256.test(evidence.sourceDigestSha256)
    ? evidence.sourceDigestSha256
    : fail("calendarEvidence.sourceDigestSha256 is invalid");
  if (!Array.isArray(evidence.days) || evidence.days.length < 4 || evidence.days.length > 366) {
    fail("calendarEvidence.days must contain 4 to 366 classified dates");
  }

  let expectedDate = nextCivilDate(rateChangeDate);
  const calendarDays: Array<Readonly<{ date: string; state: IndiaGstWorkingDayState }>> = [];
  const workingDates: string[] = [];
  for (let index = 0; index < evidence.days.length; index += 1) {
    const day = exact(evidence.days[index], DAY_KEYS, `calendarEvidence.days[${index}]`);
    const date = civilDate(day.date, `calendarEvidence.days[${index}].date`);
    if (date !== expectedDate) fail("calendarEvidence.days must be contiguous and begin after rateChangeDate");
    if (day.state !== "working" && day.state !== "non_working") {
      fail(`calendarEvidence.days[${index}].state is invalid`);
    }
    const normalized = Object.freeze({ date, state: day.state });
    calendarDays.push(normalized);
    if (day.state === "working" && workingDates.length < 4) workingDates.push(date);
    expectedDate = nextCivilDate(date);
  }
  if (calendarDays.at(-1)?.date !== throughDate) fail("calendarEvidence.days must end at throughDate");
  if (workingDates.length !== 4) fail("calendarEvidence does not establish four working days");

  const firstFourWorkingDates = Object.freeze([...workingDates]) as unknown as readonly [string, string, string, string];
  const body = Object.freeze({
    rateChangeDate,
    throughDate,
    jurisdiction: "IN" as const,
    authorityId,
    sourceDigestSha256,
    calendarDays: Object.freeze(calendarDays),
    firstFourWorkingDates,
    fourthWorkingDayDate: firstFourWorkingDates[3],
    legalRule: "CGST_ACT_14_FOUR_WORKING_DAY_CALENDAR_EVIDENCE_ONLY" as const,
  });
  return Object.freeze({ ...body, evidenceHash: digest({ tenantId, ...body }) });
}
