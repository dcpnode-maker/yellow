import { expect, test } from "bun:test";

test("Order426 requires the validation-compatibility pre-document composer export", async () => {
  const taxFiscal = await import("../src/contexts/tax-fiscal");
  expect(
    "composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly" in taxFiscal,
  ).toBeTrue();
});
