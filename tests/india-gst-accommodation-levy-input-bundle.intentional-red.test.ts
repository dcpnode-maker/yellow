import { expect, test } from "bun:test";

import * as taxFiscal from "../src/contexts/tax-fiscal";

test("Order 309 intentional red: governed accommodation levy-input bundle exists", () => {
  expect(typeof (taxFiscal as Record<string, unknown>).deriveIndiaGstAccommodationLevyInputBundle)
    .toBe("function");
});
