import { describe, expect, test } from "bun:test";

const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-supply-nature-at-time-of-supply.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 297 intentional red: GST accommodation supply nature bound at time of supply", () => {
  test("the pure complete-root composer and bounded-context export exist", async () => {
    // This test is deliberately run before implementation. It must fail at admission
    // and only become green once the exact Order297 source/export surface is present.
    expect(await Bun.file(source).exists()).toBeTrue();
    const moduleSurface = await Bun.file(index).text();
    expect(moduleSurface).toContain(
      'from "./india-gst-accommodation-supply-nature-at-time-of-supply"',
    );
    expect(moduleSurface).toContain(
      "composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply",
    );
    expect(moduleSurface).toContain(
      "IndiaGstAccommodationSupplyNatureAtTimeOfSupplyValidationError",
    );
  });
});
