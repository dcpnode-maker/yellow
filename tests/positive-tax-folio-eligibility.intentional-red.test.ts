import { describe, expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);

describe("Order 256 intentional red: authoritative positive-tax primary-folio eligibility", () => {
  test("P0: the tax-fiscal context exports the fixed read-lock-recheck contract", async () => {
    const service = await Bun.file(new URL("folio-eligibility.ts", sourceRoot)).text();
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();

    expect(service).toContain("export class PositiveTaxFolioEligibilityService");
    expect(service).toContain("export interface PositiveTaxFolioEligibilityInput");
    expect(service).toContain("export interface PositiveTaxFolioEligibilityResult");
    expect(service).toContain("export class PositiveTaxFolioEligibilityValidationError");
    expect(service).toContain("export class PositiveTaxFolioEligibilityNotFoundError");
    expect(service).toContain("export class PositiveTaxFolioEligibilityConflictError");
    expect(service).toContain("async resolve(");
    expect(service).toContain("tx: Tx");
    expect(service).toContain("input: PositiveTaxFolioEligibilityInput");
    expect(service).toContain("public.lock_financial_rows");
    expect(service).toContain("parsePositiveTaxAttributionSnapshot");
    expect(index).toContain('from "./folio-eligibility"');
  });
});
