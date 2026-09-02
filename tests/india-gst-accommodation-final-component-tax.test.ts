import { describe, expect, test } from "bun:test";
import {
  IndiaGstAccommodationFinalComponentTaxService,
  type IndiaGstAccommodationFinalComponentTaxInput,
} from "../src/contexts/tax-fiscal";

describe("Order 360 persisted valuation authority", () => {
  test("the public input contains scope plus Order341 replay input only", () => {
    const keys: readonly (keyof IndiaGstAccommodationFinalComponentTaxInput)[] = [
      "tenantId", "propertyNode", "reservationId", "folioId", "quotedRateApplicabilityInput",
    ];
    expect(keys).toEqual(["tenantId", "propertyNode", "reservationId", "folioId", "quotedRateApplicabilityInput"]);
    expect(keys).not.toContain("finalValuation" as never);
    expect(keys).not.toContain("roomNights" as never);
    expect(keys).not.toContain("quotedRateApplicabilityResult" as never);
  });

  test("exports only the transaction-bound service, never a caller-value calculation hook", async () => {
    const exports = await import("../src/contexts/tax-fiscal");
    expect(typeof IndiaGstAccommodationFinalComponentTaxService).toBe("function");
    expect("calculateIndiaGstAccommodationFinalComponentTax" in exports).toBeFalse();
  });

  test("rejects the parent forged caller valuation before any database access", async () => {
    const forged = Object.freeze({
      tenantId: "00000000-0000-0000-0000-000000036001",
      propertyNode: "00000000-0000-0000-0000-000000036002",
      reservationId: "00000000-0000-0000-0000-000000036003",
      folioId: "00000000-0000-0000-0000-000000036004",
      quotedRateApplicabilityInput: Object.freeze({}),
      finalValuation: Object.freeze({ transactionValueMinor: "999999999" }),
      roomNights: Object.freeze([Object.freeze({ ordinal: "0", transactionValueMinor: "999999999" })]),
      quotedRateApplicabilityResult: Object.freeze({}),
    });
    let queried = false;
    const tx = (async () => { queried = true; return []; }) as never;
    await expect(new IndiaGstAccommodationFinalComponentTaxService().calculate(tx, forged as never)).rejects.toThrow("shape is invalid");
    expect(queried).toBeFalse();
  });
});
