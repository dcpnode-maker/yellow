import { describe, expect, test } from "bun:test";

const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-supply-nature.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 287 intentional red: exact India accommodation supply nature", () => {
  test("P0: the pure value module and bounded-context export are absent before implementation", async () => {
    expect(await Bun.file(source).exists()).toBeTrue();

    const valueModule = await Bun.file(source).text();
    const moduleSurface = await Bun.file(index).text();

    expect(valueModule).toContain(
      "export function buildIndiaGstAccommodationSupplyNature",
    );
    expect(moduleSurface).toContain(
      'from "./india-gst-accommodation-supply-nature"',
    );
  });
});
