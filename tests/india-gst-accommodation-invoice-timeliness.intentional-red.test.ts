import { describe, expect, test } from "bun:test";

const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-invoice-timeliness.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 293 intentional red: ordinary Rule47 invoice timeliness", () => {
  test("P0: the exact pure resolver and bounded-context export do not exist before implementation", async () => {
    expect(await Bun.file(source).exists()).toBeTrue();

    const valueModule = await Bun.file(source).text();
    const moduleSurface = await Bun.file(index).text();

    expect(valueModule).toContain(
      "export function resolveIndiaGstAccommodationInvoiceTimeliness",
    );
    expect(moduleSurface).toContain(
      'from "./india-gst-accommodation-invoice-timeliness"',
    );
  });
});
