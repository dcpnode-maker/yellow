import { expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);

test("Order420 intentional red: invoice-value composer is not admitted yet", () => {
  // This file was run before implementation when the source/export were absent.
  // Keep the executable source-boundary assertion as permanent evidence.
  const source = Bun.file(new URL("india-irp-accommodation-invoice-value-candidate.ts", sourceRoot));
  const index = Bun.file(new URL("index.ts", sourceRoot));
  expect(source.size).toBeGreaterThan(0);
  expect(index.size).toBeGreaterThan(0);
  return Promise.all([source.text(), index.text()]).then(([moduleText, indexText]) => {
    expect(moduleText).toContain("export function composeIndiaIrpAccommodationInvoiceValueCandidate");
    expect(moduleText).toContain("eligible_irp_accommodation_invoice_value_candidate");
    expect(indexText).toContain('from "./india-irp-accommodation-invoice-value-candidate"');
  });
});
