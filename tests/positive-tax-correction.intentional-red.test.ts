import { expect, test } from "bun:test";

const moduleFile = new URL(
  "../src/contexts/financials/positive-tax-corrections.ts",
  import.meta.url,
);
const migrationFile = new URL(
  "../migrations/0045_governed_positive_tax_correction.sql",
  import.meta.url,
);

test("Order 266 P0: migration 0045 governs positive-tax correction", async () => {
  expect(await Bun.file(migrationFile).exists()).toBeTrue();
});

test("Order 266 P0: financials owns the positive-tax correction service", async () => {
  expect(await Bun.file(moduleFile).exists()).toBeTrue();
  const source = await Bun.file(moduleFile).text();
  expect(source).toContain("export class PositiveTaxCorrectionService");
  expect(source).toMatch(/async\s+reverse\s*\(/);
});

test("Order 266 P0: the financials public surface exports positive-tax correction", async () => {
  const source = await Bun.file(new URL(
    "../src/contexts/financials/index.ts",
    import.meta.url,
  )).text();
  expect(source).toContain('from "./positive-tax-corrections"');
});
