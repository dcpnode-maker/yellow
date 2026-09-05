import { describe, expect, test } from "bun:test";
import { composeIndiaIrpAccommodationInvoiceValueCandidate } from "../src/contexts/tax-fiscal";
import { cloneOrder419, makeOrder419Input, makeOrder419Source, rehashOrder419Source, TENANT } from "./fixtures/india-irp-order419-fixture";

type Mutable = Record<string, any>;
const freeze = <T>(value: T, seen = new Set<object>()): T => {
  if (value !== null && typeof value === "object" && !seen.has(value as object)) {
    seen.add(value as object);
    for (const child of Object.values(value as Mutable)) freeze(child, seen);
    Object.freeze(value);
  }
  return value;
};
const rehashed = (mutate: (source: Mutable) => void): unknown => {
  const source = cloneOrder419(makeOrder419Source({ family: "cgst_sgst", nights: 2 })) as unknown as Mutable;
  mutate(source);
  return freeze({ tenantId: TENANT, source: rehashOrder419Source(freeze(source) as never) });
};
const rejected = (value: unknown): void => expect(() => composeIndiaIrpAccommodationInvoiceValueCandidate(value as never)).toThrow();
const allFrozen = (value: unknown, seen = new Set<object>()): boolean => {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value as Mutable).every((child) => allFrozen(child, seen));
};

describe("Order 420 India IRP invoice values", () => {
  test("aggregates every component family with exact two-decimal values", () => {
    const cases = [
      [{ family: "igst", aggregateRateBasisPoints: 500, nights: 2, transactionValues: ["10001", "10002"], componentTaxes: [["500"], ["600"]] }, { AssVal: "200.03", IgstVal: "11.00", TotInvVal: "211.03" }],
      [{ family: "cgst_sgst", aggregateRateBasisPoints: 1200, nights: 2, transactionValues: ["10001", "10002"], componentTaxes: [["600", "600"], ["600", "600"]] }, { AssVal: "200.03", CgstVal: "12.00", SgstVal: "12.00", TotInvVal: "224.03" }],
      [{ family: "cgst_utgst", aggregateRateBasisPoints: 1800, nights: 2, transactionValues: ["10001", "10002"], componentTaxes: [["900", "900"], ["900", "900"]] }, { AssVal: "200.03", CgstVal: "18.00", SgstVal: "18.00", TotInvVal: "236.03" }],
    ] as const;
    for (const [options, expected] of cases) {
      const result = composeIndiaIrpAccommodationInvoiceValueCandidate(makeOrder419Input(options));
      expect(result.valDtls).toEqual(expected);
      expect(Object.keys(result.valDtls)).toEqual(Object.keys(expected));
      expect(result.lineage.itemCount).toBe(2);
    }
  });

  test("handles one, multiple and 366 nights without drift and is replayable", () => {
    for (const nights of [1, 2, 366]) {
      const raw = makeOrder419Input({ nights, transactionValues: Array.from({ length: nights }, () => "10001"), componentTaxes: Array.from({ length: nights }, () => ["0"]) });
      const before = JSON.stringify(raw);
      const first = composeIndiaIrpAccommodationInvoiceValueCandidate(raw);
      const second = composeIndiaIrpAccommodationInvoiceValueCandidate(raw);
      expect(first).toEqual(second);
      expect(first.valDtls).toEqual({ AssVal: `${(10001n * BigInt(nights) / 100n).toString()}.${String((10001n * BigInt(nights)) % 100n).padStart(2, "0")}`, IgstVal: "0.00", TotInvVal: `${(10001n * BigInt(nights) / 100n).toString()}.${String((10001n * BigInt(nights)) % 100n).padStart(2, "0")}` });
      expect(JSON.stringify(raw)).toBe(before);
      expect(allFrozen(first)).toBeTrue();
      expect(JSON.stringify(first)).not.toContain(TENANT);
    }
  });

  test("keeps lineage fixed and excludes forbidden optional fields", () => {
    const result = composeIndiaIrpAccommodationInvoiceValueCandidate(makeOrder419Input({ family: "cgst_utgst", componentTaxes: [["0", "0"]] }));
    expect(result.lineage).toEqual({ itemCandidateEvidenceHash: result.lineage.itemCandidateEvidenceHash, sourceEvidenceHash: result.sourceEvidenceHash, itemCount: 1, componentFamily: "cgst_utgst" });
    for (const forbidden of ["Discount", "CesVal", "StCesVal", "OthChrg", "RndOffAmt"]) {
      expect(Object.keys(result.valDtls)).not.toContain(forbidden);
    }
    expect(Object.values(result).some((value) => JSON.stringify(value).includes(TENANT))).toBeFalse();
  });

  test("accepts the exact signed-int64 ceiling and keeps tenant authority hash-only", () => {
    const ceiling = composeIndiaIrpAccommodationInvoiceValueCandidate(makeOrder419Input({
      transactionValues: ["9223372036854775807"], componentTaxes: [["0"]],
    }));
    expect(ceiling.valDtls).toEqual({
      AssVal: "92233720368547758.07", IgstVal: "0.00", TotInvVal: "92233720368547758.07",
    });

    const otherTenant = "20000000-0000-4000-8000-000000000002";
    const first = composeIndiaIrpAccommodationInvoiceValueCandidate(makeOrder419Input({}, TENANT));
    const second = composeIndiaIrpAccommodationInvoiceValueCandidate(makeOrder419Input({}, otherTenant));
    expect(second.valDtls).toEqual(first.valDtls);
    expect(second.supplyTypeCode).toBe(first.supplyTypeCode);
    expect(second.currency).toBe(first.currency);
    expect(second.evidenceHash).not.toBe(first.evidenceHash);
    expect(JSON.stringify(second)).not.toContain(otherTenant);
  });

  test("rejects malformed, noncanonical, overflow and arithmetic-inconsistent sources", () => {
    const cases: ((source: Mutable) => void)[] = [
      (s) => { s.financialSource.roomNights[0].transactionValueMinor = "01"; },
      (s) => { s.financialSource.roomNights[0].transactionValueMinor = "9223372036854775808"; },
      (s) => { s.financialSource.grandTotalMinor = "1"; },
      (s) => { s.financialSource.components.pop(); },
      (s) => { s.componentFamily.componentFamily = "igst"; },
    ];
    for (const mutate of cases) rejected(rehashed(mutate));
    rejected(makeOrder419Input({ nights: 0 }));
  });

  test("Order419 validation is load-bearing for forged coherent export ancestry", () => {
    rejected(rehashed((source) => {
      source.supplyNatureAtTimeOfSupply.supplyNature = "export";
      source.componentFamily.supplyNature = "export";
      for (const key of ["supplyNatureAtTimeOfSupply", "componentFamily"] as const) {
        const { evidenceHash: _discarded, ...body } = source[key];
        source[key] = { ...body, evidenceHash: new Bun.CryptoHasher("sha256").update(JSON.stringify({ tenantId: TENANT, ...body })).digest("hex") };
      }
    }));
  });

  test("rejects mutable, proxy, accessor, symbol, sparse and cyclic input graphs", () => {
    const valid = makeOrder419Input();
    rejected({ ...valid });
    rejected(Object.freeze({ ...valid, source: new Proxy(valid.source, {}) }));

    const accessor = { tenantId: TENANT } as Mutable;
    Object.defineProperty(accessor, "source", { enumerable: true, get: () => valid.source });
    Object.freeze(accessor);
    rejected(accessor);

    const symbol = cloneOrder419(valid) as unknown as Mutable;
    Object.defineProperty(symbol, Symbol("authority"), { enumerable: true, value: "B2B" });
    rejected(freeze(symbol));

    const sparse = cloneOrder419(valid) as unknown as Mutable;
    sparse.source.financialSource.roomNights.length = 2;
    rejected(freeze(sparse));

    const cycle = cloneOrder419(valid) as unknown as Mutable;
    cycle.source.loop = cycle.source;
    rejected(freeze(cycle));
  });
});
