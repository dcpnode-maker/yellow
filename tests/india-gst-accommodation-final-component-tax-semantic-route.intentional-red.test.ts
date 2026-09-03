import { describe, expect, test } from "bun:test";
import * as taxFiscal from "../src/contexts/tax-fiscal";

const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-final-component-tax-semantic-route.ts",
  import.meta.url,
);

describe("Order 406 intentional red: persisted India component-tax semantic routing", () => {
  test("P0: the exact read-only resolver surface exists", async () => {
    expect(await Bun.file(source).exists()).toBeTrue();
    expect(typeof (taxFiscal as Record<string, unknown>)
      .IndiaGstAccommodationFinalComponentTaxSemanticRouteService).toBe("function");

    const implementation = await Bun.file(source).text();
    const index = await Bun.file(new URL(
      "../src/contexts/tax-fiscal/index.ts",
      import.meta.url,
    )).text();
    expect(implementation).toContain(
      "export class IndiaGstAccommodationFinalComponentTaxSemanticRouteService",
    );
    expect(implementation).toMatch(/async resolve\s*\(/);
    expect(index).toContain(
      'from "./india-gst-accommodation-final-component-tax-semantic-route"',
    );
  });
});

