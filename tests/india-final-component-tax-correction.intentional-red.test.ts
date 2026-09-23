import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const migration = resolve(root, "migrations", "0072_governed_india_final_component_tax_correction.sql");
const service = resolve(root, "src", "contexts", "financials", "india-final-component-tax-corrections.ts");
const index = resolve(root, "src", "contexts", "financials", "index.ts");

describe("Order408 intentional red: governed India component-tax full reversal", () => {
  test("P0: migration 0072 exists", () => {
    expect(existsSync(migration)).toBeTrue();
  });

  test("P0: the financials-owned correction service has the fixed bounded command", () => {
    const source = readFileSync(service, "utf8");
    expect(source).toContain("IndiaFinalComponentTaxCorrectionService");
    expect(source).toContain("IndiaFinalComponentTaxCorrectionInput");
    expect(source).toContain("financials.india-final-component-tax.reverse");
    expect(source).toContain("india_gst_accommodation_final_component_tax_journal_reversed");
    const input = source.match(/export interface IndiaFinalComponentTaxCorrectionInput\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(input).toMatch(/readonly tenantId:/);
    expect(input).toMatch(/readonly propertyNode:/);
    expect(input).toMatch(/readonly originalJournalId:/);
    expect(input).toMatch(/readonly reason:/);
    expect(input).toMatch(/readonly idempotencyKey:/);
    expect(input).toMatch(/readonly envelope:/);
    expect(input).not.toMatch(/readonly\s+(?:amount|amountMinor|account|accountId|folio|folioId|businessDate|tax|taxId|route|lines|components|postSealAuthorized)\s*:/);
  });

  test("P0: the financials public surface exports the India correction", () => {
    const source = readFileSync(index, "utf8");
    expect(source).toContain('from "./india-final-component-tax-corrections"');
    expect(source).toContain("IndiaFinalComponentTaxCorrectionService");
  });
});
