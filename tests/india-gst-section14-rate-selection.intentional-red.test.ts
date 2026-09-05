import { describe, expect, test } from "bun:test";

describe("Order 340 intentional red: Section14 six-case rate selection", () => {
  test("the transaction-bound six-case composer and boundary export exist", async () => {
    const module = await import("../src/contexts/tax-fiscal");
    expect(module).toHaveProperty("IndiaGstSection14RateSelectionService");
    expect(module).toHaveProperty("IndiaGstSection14RateSelectionValidationError");
    expect(
      await Bun.file(
        new URL(
          "../src/contexts/tax-fiscal/india-gst-section14-rate-selection.ts",
          import.meta.url,
        ),
      ).exists(),
    ).toBeTrue();
  });
});
