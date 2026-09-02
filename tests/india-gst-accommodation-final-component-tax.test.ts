import { describe, expect, test } from "bun:test";
import {
  calculateIndiaGstAccommodationFinalComponentTax,
  IndiaGstAccommodationFinalComponentTaxValidationError,
} from "../src/contexts/tax-fiscal";

type AnyRecord = Record<string, any>;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const T = id(35301), P = id(35302), R = id(35303), F = id(35304), L = id(35305), A = id(35306);
const freeze = <TValue>(value: TValue, seen = new Set<object>()): TValue => {
  if (value === null || typeof value !== "object" || seen.has(value as object)) return value;
  seen.add(value as object);
  for (const key of Reflect.ownKeys(value as object)) freeze(Reflect.get(value as object, key), seen);
  return Object.freeze(value);
};
const hash = (letter: string) => letter.repeat(64);

function fixture(family: "igst" | "cgst_sgst" | "cgst_utgst", values: readonly string[], quoted = values) {
  const identities = family === "igst" ? ["igst"] : family === "cgst_sgst" ? ["cgst", "sgst"] : ["cgst", "utgst"];
  const slabs = (lower: number, itcEligible: boolean) => [
    { uptoMinor: 750000, rate: lower / 10000, itcEligible },
    { uptoMinor: null, rate: 0.18, itcEligible: true },
  ];
  const predecessor = { extensionId: id(35307), version: 1, status: "retired", contentHash: hash("e"), effectiveFromInstant: "2020-01-01T00:00:00.000000Z", effectiveToInstant: "2025-09-21T00:00:00.000000Z", key: "in-gst-lodging", gstRoomSlabs: slabs(500, false) };
  const rateVersionPair = { predecessor, successor: { ...predecessor, extensionId: id(35308), version: 2, status: "active", contentHash: hash("f"), effectiveFromInstant: "2025-09-21T00:00:00.000000Z", effectiveToInstant: null, gstRoomSlabs: slabs(500, false) } };
  const result = {
    section14: { case: "supply_before_invoice_after_payment_after", timeOfSupplyDate: "2025-09-21", selectedVersionSide: "predecessor", selectedVersion: { extensionId: predecessor.extensionId, version: predecessor.version, status: predecessor.status, contentHash: predecessor.contentHash, effectiveFromInstant: predecessor.effectiveFromInstant, effectiveToInstant: predecessor.effectiveToInstant } },
    reservationLineage: { lineageId: L, holdBindingId: id(35309), reservationId: R, segmentId: id(35310), folioId: F, attributionId: A, originQuoteHash: hash("a"), snapshotHash: hash("b"), currency: "INR" },
    components: values.map((_, index) => ({
      ordinal: String(index),
      businessDate: `2025-09-${String(21 + index).padStart(2, "0")}`,
      quotedAmountMinor: quoted[index]!,
      slab: {
        uptoMinor: 750000,
        aggregateRate: 0.05,
        aggregateRateBasisPoints: 500,
        itcEligible: false,
        components: identities.map((identity) => ({
          identity,
          rate: family === "igst" ? 0.05 : 0.025,
          rateBasisPoints: family === "igst" ? 500 : 250,
        })),
      },
    })),
    predecessorHashes: { section14: hash("1"), levyComponentIdentity: hash("2"), reservationLineage: hash("3"), attributionSnapshot: hash("4") },
    evidenceHash: hash("5"),
  };
  const input = {
    tenantId: T, propertyNode: P, reservationId: R, folioId: F, reservationLineageId: L, attributionId: A,
    section14Input: { tenantId: T, propertyNode: P, reservationId: R, rateVersionPair },
    section14Result: {}, componentIdentityInput: {}, componentIdentityResult: { componentIdentities: identities },
  };
  const finalValuation = { valuationId: id(35311), generation: 0, disposition: "ordinary_final", transactionValueMinor: values.reduce((sum, value) => sum + BigInt(value), 0n).toString(), evidenceHash: hash("6"), replayed: true };
  return { input: freeze({ tenantId: T, propertyNode: P, reservationId: R, folioId: F, finalValuation, roomNights: result.components.map((component, index) => ({ ordinal: component.ordinal, businessDate: component.businessDate, transactionValueMinor: values[index]! })), quotedRateApplicabilityInput: input, quotedRateApplicabilityResult: freeze(result) }), result: freeze(result) };
}

describe("Order 353 India accommodation final component tax", () => {
  test("reselects the slab from each final value and rounds ordered components independently", () => {
    const built = fixture("cgst_sgst", ["700000", "800000"]);
    const actual = calculateIndiaGstAccommodationFinalComponentTax(built.input as never, built.result as never);
    expect(actual.roomNights.map((night) => [night.slab.uptoMinor, night.slab.components.map((component) => component.taxMinor), night.taxMinor])).toEqual([[750000, ["17500", "17500"], "35000"], [null, ["72000", "72000"], "144000"]]);
    expect(actual.taxMinor).toBe("179000"); expect(actual.grandTotalMinor).toBe("1679000");
  });

  test("supports IGST and CGST+UTGST families and exact half-up fractions", () => {
    const igst = calculateIndiaGstAccommodationFinalComponentTax(fixture("igst", ["100"] ).input as never, fixture("igst", ["100"] ).result as never);
    expect(igst.roomNights[0]!.slab.components).toEqual([{ identity: "igst", rateBasisPoints: 500, taxMinor: "5" }]);
    const utgst = fixture("cgst_utgst", ["100"]); const actual = calculateIndiaGstAccommodationFinalComponentTax(utgst.input as never, utgst.result as never);
    expect(actual.roomNights[0]!.slab.components.map((component) => component.taxMinor)).toEqual(["3", "3"]);
  });

  test("rejects non-positive, overflow, manual and stale/reordered evidence", () => {
    for (const values of [["0"], ["-1"], ["9223372036854775808"]]) expect(() => calculateIndiaGstAccommodationFinalComponentTax(fixture("igst", values).input as never, fixture("igst", values).result as never)).toThrow(IndiaGstAccommodationFinalComponentTaxValidationError);
    const manual = fixture("igst", ["100"]); const manualInput = structuredClone(manual.input) as AnyRecord; manualInput.finalValuation.disposition = "manual_valuation_required";
    expect(() => calculateIndiaGstAccommodationFinalComponentTax(freeze(manualInput) as never, manual.result as never)).toThrow();
    const stale = fixture("igst", ["100"]); const changed = structuredClone(stale.result) as AnyRecord; changed.components[0].ordinal = "1";
    expect(() => calculateIndiaGstAccommodationFinalComponentTax(stale.input as never, freeze(changed) as never)).toThrow();
  });

  test("returns deterministic recursively frozen evidence without tenant disclosure", () => {
    const first = fixture("cgst_sgst", ["700000"]), second = fixture("cgst_sgst", ["700000"]);
    const a = calculateIndiaGstAccommodationFinalComponentTax(first.input as never, first.result as never), b = calculateIndiaGstAccommodationFinalComponentTax(second.input as never, second.result as never);
    expect(a).toEqual(b); expect(a.evidenceHash).toMatch(/^[0-9a-f]{64}$/); expect(JSON.stringify(a)).not.toContain(T); expect(Object.isFrozen(a)).toBeTrue(); expect(Object.isFrozen(a.roomNights[0])).toBeTrue();
  });
});
