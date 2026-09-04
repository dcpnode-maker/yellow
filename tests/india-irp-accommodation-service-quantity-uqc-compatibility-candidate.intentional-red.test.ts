import { describe, expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);

describe("Order425 India IRP service quantity/UQC compatibility candidate", () => {
  test("P0: the exact pure composer and bounded-context export exist", async () => {
    const moduleUrl = new URL(
      "india-irp-accommodation-service-quantity-uqc-compatibility-candidate.ts",
      sourceRoot,
    );

    // This existence assertion was executed while the module was absent. Keeping
    // it first preserves the exact executable red boundary after implementation.
    expect(await Bun.file(moduleUrl).exists()).toBeTrue();

    const source = await Bun.file(moduleUrl).text();
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();
    expect(source).toContain(
      "export function composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate",
    );
    expect(source).toContain(
      "eligible_irp_accommodation_service_quantity_uqc_compatibility_candidate",
    );
    expect(index).toContain(
      'from "./india-irp-accommodation-service-quantity-uqc-compatibility-candidate"',
    );
  });
});
