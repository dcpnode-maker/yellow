import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../migrations/0044_governed_positive_tax_posting.sql",
  import.meta.url,
);
const sourceRoot = new URL("../src/contexts/financials/", import.meta.url);

describe("Order 262 intentional red: governed positive-tax journal posting", () => {
  test("P0: migration 0044 exists", async () => {
    expect(await Bun.file(migration).exists()).toBeTrue();
  });

  test("P0: the financials-owned posting module exposes the fixed service", async () => {
    const module = new URL("positive-tax-postings.ts", sourceRoot);
    expect(await Bun.file(module).exists()).toBeTrue();

    const source = await Bun.file(module).text();
    expect(source).toContain("export class PositiveTaxPostingService");
    expect(source).toContain("async post(");
  });

  test("P0: the financials public surface exports positive-tax posting", async () => {
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();
    expect(index).toContain('from "./positive-tax-postings"');
  });
});
