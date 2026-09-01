import { describe, expect, test } from "bun:test";

describe("Order 341 intentional red: quoted accommodation rate applicability", () => {
  test("the transaction-read resolver and boundary exports are absent before production", async () => {
    const taxFiscal = await import("../src/contexts/tax-fiscal");

    expect(taxFiscal).toHaveProperty("IndiaGstAccommodationQuotedRateApplicabilityService");
  });
});
