import { describe, expect, test } from "bun:test";

const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-place-of-supply.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 282 intentional red: exact India accommodation place of supply", () => {
  test("P0: the resolver module and bounded-context export are absent before implementation", async () => {
    expect(await Bun.file(source).exists()).toBeTrue();

    const service = await Bun.file(source).text();
    const moduleSurface = await Bun.file(index).text();

    expect(service).toContain(
      "export class IndiaGstAccommodationPlaceOfSupplyService",
    );
    expect(service).toContain("async resolve(");
    expect(moduleSurface).toContain(
      'from "./india-gst-accommodation-place-of-supply"',
    );
  });
});
