import { describe, expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);

describe("Order 413 intentional red: India accommodation statutory-envelope eligibility", () => {
  test("P0: the exact read-only source module and bounded-context export exist", async () => {
    const moduleUrl = new URL("india-irp-accommodation-source.ts", sourceRoot);

    expect(await Bun.file(moduleUrl).exists()).toBeTrue();

    const source = await Bun.file(moduleUrl).text();
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();
    expect(source).toContain(
      "export class IndiaIrpAccommodationSourceService",
    );
    expect(source).toContain("eligible_irp_invoice_source");
    expect(index).toContain('from "./india-irp-accommodation-source"');
    expect(index).toContain("IndiaIrpAccommodationSourceService");
  });
});
