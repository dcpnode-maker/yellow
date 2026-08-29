import { describe, expect, test } from "bun:test";

const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-registered-state-comparison.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 283 intentional red: exact India accommodation registered-state comparison", () => {
  test("P0: the value module and bounded-context export are absent before implementation", async () => {
    expect(await Bun.file(source).exists()).toBeTrue();

    const valueModule = await Bun.file(source).text();
    const moduleSurface = await Bun.file(index).text();

    expect(valueModule).toContain(
      "export function buildIndiaGstAccommodationRegisteredStateComparison",
    );
    expect(moduleSurface).toContain(
      'from "./india-gst-accommodation-registered-state-comparison"',
    );
  });
});
