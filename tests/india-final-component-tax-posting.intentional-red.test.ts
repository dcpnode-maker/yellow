import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../migrations/0071_governed_india_final_component_tax_posting.sql",
  import.meta.url,
);
const sourceRoot = new URL("../src/contexts/financials/", import.meta.url);

describe("Order 407 intentional red: governed India final component-tax posting", () => {
  test("P0: migration 0071 exists", async () => {
    expect(await Bun.file(migration).exists()).toBeTrue();
  });

  test("P0: financials exposes the fixed India posting service", async () => {
    const module = new URL("india-final-component-tax-postings.ts", sourceRoot);
    expect(await Bun.file(module).exists()).toBeTrue();
    const source = await Bun.file(module).text();
    expect(source).toContain("export class IndiaFinalComponentTaxPostingService");
    expect(source).toContain("async post(");
    expect(source).toContain("financials.india-final-component-tax.post");
  });

  test("P0: the financials public surface exports India component-tax posting", async () => {
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();
    expect(index).toContain('from "./india-final-component-tax-postings"');
  });
});
