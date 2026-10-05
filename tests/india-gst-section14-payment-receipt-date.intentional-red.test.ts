import { describe, expect, test } from "bun:test";

describe("Order 339 intentional red: section14 governed payment-receipt date", () => {
  test("production composer and export do not exist before implementation", async () => {
    expect(await Bun.file(new URL("../src/contexts/tax-fiscal/india-gst-section14-payment-receipt-date.ts", import.meta.url)).exists()).toBeTrue();
    const index = await Bun.file(new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url)).text();
    expect(index).toContain('from "./india-gst-section14-payment-receipt-date"');
  });
});
