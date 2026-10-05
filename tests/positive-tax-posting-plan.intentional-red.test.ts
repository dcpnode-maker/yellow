import { describe, expect, test } from "bun:test";

const moduleUrl = new URL("../src/contexts/tax-fiscal/posting-plan.ts", import.meta.url);
const indexUrl = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 251 intentional red: canonical positive tax posting plan", () => {
  test("P0: the pure posting-plan module is present without transaction authority", async () => {
    const source = await Bun.file(moduleUrl).text();
    expect(source).toContain("export interface PositiveTaxPostingPlanV1");
    expect(source).toContain("export function derivePositiveTaxPostingPlan(snapshot: unknown)");
    expect(source).toContain("parsePositiveTaxAttributionSnapshot");
  });

  test("P0: the tax-fiscal context exports the fixed pure contract", async () => {
    const index = await Bun.file(indexUrl).text();
    expect(index).toContain('from "./posting-plan"');
    const contract = await import("../src/contexts/tax-fiscal");
    expect(contract.derivePositiveTaxPostingPlan).toBeFunction();
  });
});
