import { describe, expect, test } from "bun:test";

const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-section14-payment-proviso.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 302 intentional red: section14 payment proviso gate", () => {
  test("the pure fail-closed primitive and tax-fiscal export exist", async () => {
    expect(await Bun.file(source).exists()).toBeTrue();
    expect(await Bun.file(index).text()).toContain(
      'from "./india-gst-section14-payment-proviso"',
    );
  });
});
