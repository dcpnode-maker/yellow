import { describe, expect, test } from "bun:test";
import {
  deriveIndiaGstSection14WorkingDayCalendarEvidence,
  IndiaGstSection14WorkingDayCalendarEvidenceValidationError,
} from "../src/contexts/tax-fiscal";
import type { IndiaGstSection14WorkingDayCalendarEvidenceInput } from "../src/contexts/tax-fiscal";

type Mutable = Record<PropertyKey, any>;
const TENANT = "00000000-0000-0000-0000-000000033801";
const OTHER = "00000000-0000-0000-0000-000000033802";
const SOURCE = "a".repeat(64);
const days = [
  { date: "2025-09-23", state: "working" },
  { date: "2025-09-24", state: "non_working" },
  { date: "2025-09-25", state: "working" },
  { date: "2025-09-26", state: "non_working" },
  { date: "2025-09-27", state: "working" },
  { date: "2025-09-28", state: "non_working" },
  { date: "2025-09-29", state: "working" },
] as const;

function freeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) freeze((value as Mutable)[key], seen);
  return Object.freeze(value);
}

function input(overrides: Mutable = {}): IndiaGstSection14WorkingDayCalendarEvidenceInput {
  return {
    tenantId: TENANT,
    rateChangeDate: "2025-09-22",
    throughDate: "2025-09-29",
    calendarEvidence: freeze({
      jurisdiction: "IN",
      authorityId: "INDIA_GST_GOVERNED_WORKING_DAY_CALENDAR",
      sourceDigestSha256: SOURCE,
      days: structuredClone(days),
    }),
    ...overrides,
  } as IndiaGstSection14WorkingDayCalendarEvidenceInput;
}

function deeplyFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) deeplyFrozen((value as Mutable)[key], seen);
}

describe("Order 338: India GST section14 governed working-day calendar evidence", () => {
  test("derives only the first four explicitly classified working dates", () => {
    const actual = deriveIndiaGstSection14WorkingDayCalendarEvidence(input());
    expect(actual.firstFourWorkingDates).toEqual([
      "2025-09-23", "2025-09-25", "2025-09-27", "2025-09-29",
    ]);
    expect(actual.fourthWorkingDayDate).toBe("2025-09-29");
    expect(actual.calendarDays).toEqual(days);
    expect(actual.legalRule).toBe("CGST_ACT_14_FOUR_WORKING_DAY_CALENDAR_EVIDENCE_ONLY");
  });

  test("uses supplied states even for weekend-shaped dates and never infers a state", () => {
    const changed = structuredClone(days) as unknown as Mutable[];
    changed[4]!.state = "non_working";
    changed[5]!.state = "working";
    const actual = deriveIndiaGstSection14WorkingDayCalendarEvidence(input({
      calendarEvidence: freeze({ jurisdiction: "IN", authorityId: "INDIA_GST_GOVERNED_WORKING_DAY_CALENDAR", sourceDigestSha256: SOURCE, days: changed }),
    }));
    expect(actual.firstFourWorkingDates).toEqual(["2025-09-23", "2025-09-25", "2025-09-28", "2025-09-29"]);
  });

  test("handles leap, century, month and year boundaries with explicit classifications", () => {
    const fixtures: readonly Readonly<{ change: string; through: string; dates: readonly [string, string, string, string] }>[] = [
      { change: "2024-02-27", through: "2024-03-02", dates: ["2024-02-28", "2024-02-29", "2024-03-01", "2024-03-02"] },
      { change: "2100-02-27", through: "2100-03-03", dates: ["2100-02-28", "2100-03-01", "2100-03-02", "2100-03-03"] },
      { change: "2025-12-30", through: "2026-01-03", dates: ["2025-12-31", "2026-01-01", "2026-01-02", "2026-01-03"] },
    ];
    for (const fixture of fixtures) {
      const calendarDays = fixture.dates.map((date) => ({ date, state: "working" as const }));
      const actual = deriveIndiaGstSection14WorkingDayCalendarEvidence(input({ rateChangeDate: fixture.change, throughDate: fixture.through, calendarEvidence: freeze({ jurisdiction: "IN", authorityId: "INDIA_GST_GOVERNED_WORKING_DAY_CALENDAR", sourceDigestSha256: SOURCE, days: calendarDays }) }));
      expect(actual.firstFourWorkingDates).toEqual(fixture.dates);
      expect(actual.fourthWorkingDayDate).toBe(fixture.through);
    }
  });

  test("rejects incomplete, non-dense, malformed and insufficient sequences", () => {
    const hostile: Mutable[] = [];
    for (const mutate of [
      (value: Mutable[]) => value.splice(2, 1),
      (value: Mutable[]) => { value[2]!.date = value[1]!.date; },
      (value: Mutable[]) => value.reverse(),
      (value: Mutable[]) => { value[0]!.date = "2025-09-22"; },
      (value: Mutable[]) => { value.at(-1)!.date = "2025-09-30"; },
      (value: Mutable[]) => { value[0]!.date = "2025-02-30"; },
      (value: Mutable[]) => { value[0]!.state = "closed"; },
      (value: Mutable[]) => { for (const day of value) day.state = "non_working"; },
      (value: Mutable[]) => { value[0]!.extra = true; },
    ]) { const value = structuredClone(days) as unknown as Mutable[]; mutate(value); hostile.push(value); }
    for (const value of hostile) expect(() => deriveIndiaGstSection14WorkingDayCalendarEvidence(input({ calendarEvidence: freeze({ jurisdiction: "IN", authorityId: "INDIA_GST_GOVERNED_WORKING_DAY_CALENDAR", sourceDigestSha256: SOURCE, days: value }) }))).toThrow(IndiaGstSection14WorkingDayCalendarEvidenceValidationError);
  });

  test("rejects surplus authority, mutable graphs, proxies, accessors and symbols", () => {
    for (const key of ["paymentReceiptDate", "bankCreditAfterThreshold", "rate", "amount", "timezone", "currentDate"]) {
      expect(() => deriveIndiaGstSection14WorkingDayCalendarEvidence({ ...input(), [key]: true } as never)).toThrow();
    }
    expect(() => deriveIndiaGstSection14WorkingDayCalendarEvidence(input({ calendarEvidence: { jurisdiction: "IN", authorityId: "INDIA_GST_GOVERNED_WORKING_DAY_CALENDAR", sourceDigestSha256: SOURCE, days: structuredClone(days) } }))).toThrow();
    expect(() => deriveIndiaGstSection14WorkingDayCalendarEvidence(new Proxy(input(), {}) as never)).toThrow();
    const accessor = input() as Mutable; Object.defineProperty(accessor, "throughDate", { enumerable: true, get: () => "2025-09-29" });
    expect(() => deriveIndiaGstSection14WorkingDayCalendarEvidence(accessor as never)).toThrow();
    const symbolic = input() as Mutable; symbolic[Symbol("x")] = true;
    expect(() => deriveIndiaGstSection14WorkingDayCalendarEvidence(symbolic as never)).toThrow();
    const repeatedDay = freeze({ date: "2025-09-23", state: "working" });
    expect(() => deriveIndiaGstSection14WorkingDayCalendarEvidence(input({ calendarEvidence: freeze({ jurisdiction: "IN", authorityId: "INDIA_GST_GOVERNED_WORKING_DAY_CALENDAR", sourceDigestSha256: SOURCE, days: [repeatedDay, repeatedDay, repeatedDay, repeatedDay] }) }))).toThrow();
    const tooMany = Array.from({ length: 367 }, () => ({ date: "2025-09-23", state: "working" as const }));
    expect(() => deriveIndiaGstSection14WorkingDayCalendarEvidence(input({ calendarEvidence: freeze({ jurisdiction: "IN", authorityId: "INDIA_GST_GOVERNED_WORKING_DAY_CALENDAR", sourceDigestSha256: SOURCE, days: tooMany }) }))).toThrow();
    const longAuthority = `A${"B".repeat(128)}`;
    expect(() => deriveIndiaGstSection14WorkingDayCalendarEvidence(input({ calendarEvidence: freeze({ jurisdiction: "IN", authorityId: longAuthority, sourceDigestSha256: SOURCE, days: structuredClone(days) }) }))).toThrow();
  });

  test("returns deterministic recursively frozen tenant-hidden and source-bound evidence", () => {
    const first = deriveIndiaGstSection14WorkingDayCalendarEvidence(input());
    const second = deriveIndiaGstSection14WorkingDayCalendarEvidence(input());
    expect(second).toEqual(first); expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    deeplyFrozen(first); expect(first).not.toHaveProperty("tenantId"); expect(JSON.stringify(first)).not.toContain(TENANT);
    expect(first.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    const { evidenceHash, ...body } = first;
    expect(evidenceHash).toBe(new Bun.CryptoHasher("sha256").update(JSON.stringify({ tenantId: TENANT, ...body })).digest("hex"));
    expect(deriveIndiaGstSection14WorkingDayCalendarEvidence(input({ tenantId: OTHER })).evidenceHash).not.toBe(first.evidenceHash);
    expect(deriveIndiaGstSection14WorkingDayCalendarEvidence(input({ calendarEvidence: freeze({ jurisdiction: "IN", authorityId: "INDIA_GST_ALTERNATE_AUTHORITY", sourceDigestSha256: SOURCE, days: structuredClone(days) }) })).evidenceHash).not.toBe(first.evidenceHash);
    expect(deriveIndiaGstSection14WorkingDayCalendarEvidence(input({ calendarEvidence: freeze({ jurisdiction: "IN", authorityId: "INDIA_GST_GOVERNED_WORKING_DAY_CALENDAR", sourceDigestSha256: "b".repeat(64), days: structuredClone(days) }) })).evidenceHash).not.toBe(first.evidenceHash);
    const trailing = [...structuredClone(days), { date: "2025-09-30", state: "non_working" as const }, { date: "2025-10-01", state: "working" as const }];
    const extended = deriveIndiaGstSection14WorkingDayCalendarEvidence(input({ throughDate: "2025-10-01", calendarEvidence: freeze({ jurisdiction: "IN", authorityId: "INDIA_GST_GOVERNED_WORKING_DAY_CALENDAR", sourceDigestSha256: SOURCE, days: trailing }) }));
    expect(extended.firstFourWorkingDates).toEqual(first.firstFourWorkingDates);
    expect(extended.evidenceHash).not.toBe(first.evidenceHash);
  });

  test("production source contains no host-calendar inference machinery", async () => {
    const source = await Bun.file(new URL("../src/contexts/tax-fiscal/india-gst-section14-working-day-calendar-evidence.ts", import.meta.url)).text();
    expect(source).not.toMatch(/new\s+Date|\.getDay\s*\(|Intl\.|Temporal\.|weekday|weekend|holiday/i);
  });
});
