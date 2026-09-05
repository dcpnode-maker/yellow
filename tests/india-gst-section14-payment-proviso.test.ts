import { describe, expect, test } from "bun:test";
import { resolveIndiaGstSection14PaymentProviso } from "../src/contexts/tax-fiscal";

type Mutable = Record<PropertyKey, unknown>;
type Input = {
  supplierBooksEntryDate: string;
  supplierBankCreditDate: string;
  rateChangeDate: string;
};

const base: Input = {
  supplierBooksEntryDate: "2043-06-15",
  supplierBankCreditDate: "2043-06-16",
  rateChangeDate: "2043-06-16",
};

const deepFrozen = (value: unknown, seen = new Set<object>()) => {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) deepFrozen((value as Mutable)[key], seen);
};

const evaluate = (input: Input) => resolveIndiaGstSection14PaymentProviso(input);

describe("Order 302: India GST section 14 payment proviso", () => {
  test("retains the ordinary earlier-of date before and at the asserted boundary", () => {
    for (const [books, bank, expected] of [
      ["2043-06-15", "2043-06-14", "2043-06-14"],
      ["2043-06-15", "2043-06-15", "2043-06-15"],
      ["2043-06-15", "2043-06-16", "2043-06-15"],
    ] as const) {
      const actual = evaluate({ ...base, supplierBooksEntryDate: books, supplierBankCreditDate: bank });
      expect(actual.state).toBe("proviso_not_triggered_on_recorded_dates");
      if (actual.state !== "proviso_not_triggered_on_recorded_dates") throw new Error("unexpected state");
      expect(actual.paymentReceiptDate).toBe(expected);
    }
  });

  test("requires calendar evidence for every later bank credit, without guessing", () => {
    for (const bank of ["2043-06-17", "2043-06-18", "2043-06-19", "2043-06-20", "2043-06-21"]) {
      const actual = evaluate({ ...base, supplierBankCreditDate: bank });
      expect(actual.state).toBe("working_day_calendar_required");
      expect(actual).not.toHaveProperty("paymentReceiptDate");
      expect(actual).not.toHaveProperty("workingDays");
      expect(actual).not.toHaveProperty("elapsedWorkingDays");
    }
  });

  test("rejects malformed dates and every non-exact input shape", () => {
    const malformed: unknown[] = [
      null, [], { ...base, extra: true },
      { supplierBooksEntryDate: base.supplierBooksEntryDate, supplierBankCreditDate: base.supplierBankCreditDate },
      { ...base, supplierBooksEntryDate: "2043-02-29" },
      { ...base, supplierBooksEntryDate: "2043-2-09" },
      { ...base, supplierBooksEntryDate: "2043-00-01" },
      { ...base, supplierBankCreditDate: "2043-04-31" },
      { ...base, rateChangeDate: "not-a-date" },
      { ...base, rateChangeDate: "2043-01-01T00:00:00Z" },
    ];
    const accessor = { ...base } as Mutable;
    Object.defineProperty(accessor, "rateChangeDate", { enumerable: true, get: () => base.rateChangeDate });
    malformed.push(accessor, new Proxy({ ...base }, {}), { ...base, [Symbol("hostile")]: true });
    for (const candidate of malformed) expect(() => evaluate(candidate as Input)).toThrow();
  });

  test("returns deterministic recursively frozen evidence and binds every input", () => {
    const first = evaluate(base);
    const second = evaluate({ ...base });
    expect(first).toEqual(second);
    deepFrozen(first);
    for (const key of ["supplierBooksEntryDate", "supplierBankCreditDate", "rateChangeDate"] as const) {
      const changed = evaluate({ ...base, [key]: key === "rateChangeDate" ? "2043-06-17" : "2043-06-14" });
      expect(changed.evidenceHash).not.toBe(first.evidenceHash);
    }
    expect(() => (((first as unknown) as Mutable).evidenceHash = "x")).toThrow();
  });

  test("implementation is pure and does not introduce a guessed calendar", async () => {
    const source = await Bun.file(new URL("../src/contexts/tax-fiscal/india-gst-section14-payment-proviso.ts", import.meta.url)).text();
    expect(source).not.toMatch(/\b(?:new\s+Date|Date\s*\(|Date\.now|Date\.UTC)\b/i);
    expect(source).not.toMatch(/weekday|weekend|holiday|workingDays|elapsedWorkingDays/i);
  });
});
