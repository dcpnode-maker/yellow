import { describe, expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);

describe("Order 414 intentional red: India accommodation numeric item-source composition", () => {
  test("P0: the exact pure composer and bounded-context export exist", async () => {
    const moduleUrl = new URL(
      "india-irp-accommodation-numeric-item-source.ts",
      sourceRoot,
    );

    expect(await Bun.file(moduleUrl).exists()).toBeTrue();

    const source = await Bun.file(moduleUrl).text();
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();
    expect(source).toContain(
      "export function composeIndiaIrpAccommodationNumericItemSources",
    );
    expect(source).toContain("eligible_irp_accommodation_numeric_item_sources");
    expect(index).toContain(
      'from "./india-irp-accommodation-numeric-item-source"',
    );
    expect(index).toContain(
      "composeIndiaIrpAccommodationNumericItemSources",
    );
  });
});
