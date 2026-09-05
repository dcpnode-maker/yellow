import { describe, expect, test } from "bun:test";
import {
  composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate,
  composeIndiaIrpAccommodationNumericItemSources,
  composeIndiaIrpOrdinaryRegisteredB2bSupplyType,
  type IndiaIrpAccommodationSourceResult,
} from "../src/contexts/tax-fiscal";
import {
  cloneOrder419,
  makeOrder419Input,
  makeOrder419Source,
  makeOrder419UnsupportedExportInput,
  rehashOrder419Source,
  TENANT,
} from "./fixtures/india-irp-order419-fixture";

type Mutable = Record<string, any>;

function freeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value as object)) {
    seen.add(value as object);
    for (const child of Object.values(value as Mutable)) freeze(child, seen);
    Object.freeze(value);
  }
  return value;
}

function allFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value as Mutable).every((child) => allFrozen(child, seen));
}

function rejected(value: unknown): void {
  expect(() => composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate(value as never)).toThrow();
}

describe("Order423 India IRP ordinary-B2B transaction details", () => {
  test("emits only exact fixed-order GST/B2B transaction details", () => {
    for (const family of ["igst", "cgst_sgst", "cgst_utgst"] as const) {
      const input = makeOrder419Input({ family });
      const result = composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate(input);
      expect(Object.keys(result)).toEqual([
        "state", "format", "payload", "payloadJson", "lineage", "sourceEvidenceHash", "evidenceHash",
      ]);
      expect(Object.keys(result.payload)).toEqual(["TranDtls"]);
      expect(Object.keys(result.payload.TranDtls)).toEqual(["TaxSch", "SupTyp"]);
      expect(result.payload).toEqual({ TranDtls: { TaxSch: "GST", SupTyp: "B2B" } });
      expect(result.payloadJson).toBe('{"TranDtls":{"TaxSch":"GST","SupTyp":"B2B"}}');
      for (const forbidden of ["RegRev", "IgstOnIntra", "EcmGstin", "SellerDtls", "BuyerDtls", "DocDtls", "ItemList", "ValDtls"]) {
        expect(result.payloadJson).not.toContain(forbidden);
      }
    }
  });

  test("binds exact Order413 and Order415 lineage with stable tenant-hidden frozen output", () => {
    const input = makeOrder419Input();
    const before = JSON.stringify(input);
    const supply = composeIndiaIrpOrdinaryRegisteredB2bSupplyType(input);
    const first = composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate(input);
    const second = composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate(input);
    expect(first).toEqual(second);
    expect(JSON.stringify(input)).toBe(before);
    expect(first.lineage).toEqual({
      sourceEvidenceHash: input.source.evidenceHash,
      supplyTypeEvidenceHash: supply.evidenceHash,
    });
    expect(first.sourceEvidenceHash).toBe(input.source.evidenceHash);
    expect(allFrozen(first)).toBeTrue();
    expect(JSON.stringify(first)).not.toContain(TENANT);
  });

  test("tenant changes only evidence-hash preimages and remains absent from output", () => {
    const otherTenant = "20000000-0000-4000-8000-000000000002";
    const first = composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate(makeOrder419Input({}, TENANT));
    const second = composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate(makeOrder419Input({}, otherTenant));
    expect(second.payload).toEqual(first.payload);
    expect(second.payloadJson).toBe(first.payloadJson);
    expect(second.format).toBe(first.format);
    expect(second.evidenceHash).not.toBe(first.evidenceHash);
    expect(second.sourceEvidenceHash).not.toBe(first.sourceEvidenceHash);
    expect(second.lineage.supplyTypeEvidenceHash).not.toBe(first.lineage.supplyTypeEvidenceHash);
    expect(JSON.stringify(second)).not.toContain(otherTenant);
  });

  test("Order415 remains load-bearing for coherent unsupported supply mutation", () => {
    const unsupported = makeOrder419UnsupportedExportInput();
    expect(composeIndiaIrpAccommodationNumericItemSources(unsupported).state).toBe(
      "eligible_irp_accommodation_numeric_item_sources",
    );
    rejected(unsupported);
  });

  test("rejects surplus transaction authority and stale source evidence", () => {
    for (const [key, value] of [["RegRev", "N"], ["IgstOnIntra", "N"], ["EcmGstin", "29AAPFU0939F1ZR"], ["SupTyp", "B2B"]] as const) {
      const raw = cloneOrder419(makeOrder419Input()) as unknown as Mutable;
      raw[key] = value;
      rejected(freeze(raw));
    }
    const source = cloneOrder419(makeOrder419Source()) as unknown as Mutable;
    source.evidenceHash = "0".repeat(64);
    rejected(freeze({ tenantId: TENANT, source }));
  });

  test("rejects malformed, mutable, proxy, accessor, symbol, sparse and cyclic graphs", () => {
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

    const surplusSource = cloneOrder419(makeOrder419Source()) as unknown as Mutable;
    surplusSource.TranDtls = { TaxSch: "GST", SupTyp: "B2B" };
    rejected(freeze({ tenantId: TENANT, source: rehashOrder419Source(
      freeze(surplusSource) as IndiaIrpAccommodationSourceResult,
    ) }));
  });
});
