import { describe, expect, test } from "bun:test";
import * as taxFiscal from "../src/contexts/tax-fiscal";

describe("Order 353 intentional red: final component tax calculation", () => {
  test("the pure calculator and bounded-context export are absent before implementation", () => {
    expect(typeof (taxFiscal as Record<string, unknown>).IndiaGstAccommodationFinalComponentTaxService).toBe("function");
  });
});
