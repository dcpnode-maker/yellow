import { describe, expect, test } from "bun:test";

import {
  composeIndiaIrpAccommodationRoomNightItemCandidates,
  type IndiaIrpAccommodationRoomNightItemCandidateInput,
} from "../src/contexts/tax-fiscal";
import {
  cloneOrder419,
  makeOrder419Input,
  makeOrder419Source,
  makeOrder419UnsupportedExportInput,
  rehashOrder419Source,
  TENANT,
  type FixtureOptions,
} from "./fixtures/india-irp-order419-fixture";

type MutableRecord = Record<string, any>;

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value as MutableRecord)) deepFreeze(child, seen);
    Object.freeze(value);
  }
  return value;
}

function expectRejected(value: unknown): void {
  expect(() => composeIndiaIrpAccommodationRoomNightItemCandidates(
    value as IndiaIrpAccommodationRoomNightItemCandidateInput,
  )).toThrow();
}

function rebuilt(
  mutator: (source: MutableRecord) => void,
  options: FixtureOptions = {},
): IndiaIrpAccommodationRoomNightItemCandidateInput {
  const source = cloneOrder419(makeOrder419Source(options)) as unknown as MutableRecord;
  mutator(source);
  return deepFreeze({ tenantId: TENANT, source: rehashOrder419Source(
    deepFreeze(source) as never,
  ) });
}

function allFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => allFrozen(child, seen));
}

describe("Order 419 India IRP room-night item candidates", () => {
  test("maps every supported family at 5%, 12% and 18% with exact decimals", () => {
    const cases: readonly [FixtureOptions, string, Record<string, string>][] = [
      [{ family: "igst", aggregateRateBasisPoints: 500, componentTaxes: [["500"]] }, "5.00", { IgstAmt: "5.00" }],
      [{ family: "igst", aggregateRateBasisPoints: 1200, componentTaxes: [["1200"]] }, "12.00", { IgstAmt: "12.00" }],
      [{ family: "igst", aggregateRateBasisPoints: 1800, componentTaxes: [["1800"]] }, "18.00", { IgstAmt: "18.00" }],
      [{ family: "cgst_sgst", aggregateRateBasisPoints: 500, componentTaxes: [["250", "250"]] }, "5.00", { CgstAmt: "2.50", SgstAmt: "2.50" }],
      [{ family: "cgst_sgst", aggregateRateBasisPoints: 1200, componentTaxes: [["600", "600"]] }, "12.00", { CgstAmt: "6.00", SgstAmt: "6.00" }],
      [{ family: "cgst_sgst", aggregateRateBasisPoints: 1800, componentTaxes: [["900", "900"]] }, "18.00", { CgstAmt: "9.00", SgstAmt: "9.00" }],
      [{ family: "cgst_utgst", aggregateRateBasisPoints: 500, componentTaxes: [["250", "250"]] }, "5.00", { CgstAmt: "2.50", SgstAmt: "2.50" }],
      [{ family: "cgst_utgst", aggregateRateBasisPoints: 1200, componentTaxes: [["600", "600"]] }, "12.00", { CgstAmt: "6.00", SgstAmt: "6.00" }],
      [{ family: "cgst_utgst", aggregateRateBasisPoints: 1800, componentTaxes: [["900", "900"]] }, "18.00", { CgstAmt: "9.00", SgstAmt: "9.00" }],
    ];
    for (const [fixture, rate, taxes] of cases) {
      const result = composeIndiaIrpAccommodationRoomNightItemCandidates(makeOrder419Input(fixture));
      expect(result.items).toHaveLength(1);
      const item = result.items[0]!;
      expect(item.irp).toMatchObject({
        SlNo: "1", IsServc: "Y", HsnCd: "996311", UnitPrice: "100.00",
        TotAmt: "100.00", AssAmt: "100.00", GstRt: rate,
        TotItemVal: (100 + Number(rate)).toFixed(2),
        ...taxes,
      });
      expect(Object.keys(item.irp)).toEqual([
        "SlNo", "IsServc", "HsnCd", "UnitPrice", "TotAmt", "AssAmt", "GstRt",
        ...Object.keys(taxes), "TotItemVal",
      ]);
      expect(item.lineage.roomNightOrdinal).toBe("0");
      expect(item.lineage.businessDate).toBe("2044-01-01");
      expect(item.lineage.sourceEvidenceHash).toBe(result.sourceEvidenceHash);
    }
  });

  test("preserves one-to-one dense serials for one, multiple and 366 nights", () => {
    for (const nights of [1, 2, 366]) {
      const values = Array.from({ length: nights }, () => "10000");
      const taxes = Array.from({ length: nights }, () => ["0"] as const);
      const raw = makeOrder419Input({ nights, transactionValues: values, componentTaxes: taxes });
      const before = JSON.stringify(raw);
      const first = composeIndiaIrpAccommodationRoomNightItemCandidates(raw);
      const second = composeIndiaIrpAccommodationRoomNightItemCandidates(raw);
      expect(first.items).toHaveLength(nights);
      expect(first.items.map(({ irp }) => irp.SlNo)).toEqual(
        Array.from({ length: nights }, (_, index) => String(index + 1)),
      );
      expect(first.items.map(({ lineage }) => lineage.roomNightOrdinal)).toEqual(
        Array.from({ length: nights }, (_, index) => String(index)),
      );
      expect(first).toEqual(second);
      expect(JSON.stringify(raw)).toBe(before);
      expect(allFrozen(first)).toBeTrue();
      expect(JSON.stringify(first)).not.toContain(TENANT);
    }
  });

  test("keeps zero component amounts explicit and omits every non-contract optional field", () => {
    const result = composeIndiaIrpAccommodationRoomNightItemCandidates(makeOrder419Input({
      family: "cgst_utgst", aggregateRateBasisPoints: 1800, componentTaxes: [["0", "0"]],
    }));
    expect(result.items[0]!.irp).toEqual({
      SlNo: "1", IsServc: "Y", HsnCd: "996311", UnitPrice: "100.00", TotAmt: "100.00",
      AssAmt: "100.00", GstRt: "18.00", CgstAmt: "0.00", SgstAmt: "0.00", TotItemVal: "100.00",
    });
    expect(Object.keys(result.items[0]!.irp)).not.toContain("PrdDesc");
    expect(Object.keys(result.items[0]!.irp)).not.toContain("Qty");
    expect(Object.keys(result.items[0]!.irp)).not.toContain("Unit");
    expect(Object.keys(result.items[0]!.irp)).not.toContain("Discount");
    expect(Object.keys(result.items[0]!.irp)).not.toContain("PreTaxVal");
  });

  test("fails closed for topology, lineage, value, rate and correctly rehashed unsupported mutations", () => {
    const cases: ((source: MutableRecord) => void)[] = [
      (source) => { source.financialSource.components.pop(); },
      (source) => { source.financialSource.components.reverse(); },
      (source) => { source.financialSource.roomNights[1].ordinal = "2"; },
      (source) => { source.financialSource.roomNights[0].transactionValueMinor = "01"; },
      (source) => { source.financialSource.roomNights[0].aggregateRateBasisPoints = 501; },
      (source) => { source.financialSource.grandTotalMinor = "1"; },
      (source) => { source.componentFamily.componentFamily = "igst"; },
      (source) => { source.supplyNatureAtTimeOfSupply.supplyNature = "export"; },
      (source) => { source.financialSource.roomNights[0].unexpected = true; },
    ];
    for (const mutate of cases) expectRejected(rebuilt(mutate, { family: "cgst_sgst", nights: 2 }));
    expectRejected(makeOrder419UnsupportedExportInput());
  });

  test("rejects mutable, proxy, accessor, symbol, sparse and cyclic graphs before accepting them", () => {
    const valid = makeOrder419Input();
    expectRejected({ ...valid });
    expectRejected(Object.freeze({ ...valid, source: new Proxy(valid.source, {}) }));

    const accessor = { tenantId: TENANT } as MutableRecord;
    Object.defineProperty(accessor, "source", { enumerable: true, get: () => valid.source });
    Object.freeze(accessor);
    expectRejected(accessor);

    const symbol = cloneOrder419(valid) as unknown as MutableRecord;
    Object.defineProperty(symbol, Symbol("authority"), { enumerable: true, value: "B2B" });
    expectRejected(deepFreeze(symbol));

    const sparse = cloneOrder419(valid) as unknown as MutableRecord;
    sparse.source.financialSource.roomNights.length = 2;
    expectRejected(deepFreeze(sparse));

    const cycle = cloneOrder419(valid) as unknown as MutableRecord;
    cycle.source.loop = cycle.source;
    expectRejected(deepFreeze(cycle));
  });
});
