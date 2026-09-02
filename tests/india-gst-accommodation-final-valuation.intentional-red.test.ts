import { describe, expect, test } from "bun:test";
import * as taxFiscal from "../src/contexts/tax-fiscal";

describe("Order 350 intentional red: governed final valuation", () => {
  test("allocator and governed service are absent before production", () => {
    expect(typeof (taxFiscal as Record<string, unknown>).allocateSignedLargestRemainder).toBe("function");
    expect(typeof (taxFiscal as Record<string, unknown>).IndiaGstAccommodationFinalValuationService).toBe("function");
  });
});
