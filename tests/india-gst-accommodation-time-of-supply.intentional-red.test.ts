import { describe, expect, test } from "bun:test";

const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-time-of-supply.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 294 intentional red: accommodation time of supply", () => {
  test("the exact resolver and tax-fiscal export now exist", async () => {
    expect(await Bun.file(source).exists()).toBeTrue();
    const moduleSurface = await Bun.file(index).text();
    expect(moduleSurface).toContain(
      'from "./india-gst-accommodation-time-of-supply"',
    );
  });
});
