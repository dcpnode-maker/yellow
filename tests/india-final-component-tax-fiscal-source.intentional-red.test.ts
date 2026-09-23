import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const service = resolve(
  root,
  "src",
  "contexts",
  "financials",
  "india-final-component-tax-fiscal-source.ts",
);
const index = resolve(root, "src", "contexts", "financials", "index.ts");

describe("Order412 intentional red: India accommodation fiscal-source eligibility", () => {
  test("P0: the Financials-owned read boundary exists", () => {
    expect(existsSync(service)).toBeTrue();
    const source = readFileSync(service, "utf8");
    expect(source).toContain("IndiaFinalComponentTaxFiscalSourceService");
    expect(source).toContain("IndiaFinalComponentTaxFiscalSourceInput");
    expect(source).toContain("eligible_current_posted_source");
  });

  test("P0: the Financials public surface exports the fiscal-source boundary", () => {
    const source = readFileSync(index, "utf8");
    expect(source).toContain('from "./india-final-component-tax-fiscal-source"');
    expect(source).toContain("IndiaFinalComponentTaxFiscalSourceService");
  });
});
