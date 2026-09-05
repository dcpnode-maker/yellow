import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const evaluatorUrl = new URL("../src/contexts/tax-fiscal/evaluator.ts", import.meta.url);
const indexUrl = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

function source(path: URL): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

describe("Order 237 intentional red: pure rules-driven tax evaluation", () => {
  test("the evaluator and exact adopted calculation contract are absent before implementation", () => {
    const evaluator = source(evaluatorUrl);

    expect({
      evaluatorModule: existsSync(evaluatorUrl),
      evaluateTaxJurisdiction: evaluator.includes("export function evaluateTaxJurisdiction("),
      TaxEvaluationInput: evaluator.includes("export interface TaxEvaluationInput"),
      TaxEvaluationResult: evaluator.includes("export interface TaxEvaluationResult"),
      taxInclusive: evaluator.includes('"tax_inclusive"'),
      taxExclusive: evaluator.includes('"tax_exclusive"'),
      lineRounding: evaluator.includes('"line"'),
      documentRounding: evaluator.includes('"document"'),
      percent: evaluator.includes('"percent"'),
      fixedPerNight: evaluator.includes('"fixed_per_night"'),
      fixedPerPersonNight: evaluator.includes('"fixed_per_person_night"'),
      slabPercent: evaluator.includes('"slab_percent"'),
    }).toEqual({
      evaluatorModule: true,
      evaluateTaxJurisdiction: true,
      TaxEvaluationInput: true,
      TaxEvaluationResult: true,
      taxInclusive: true,
      taxExclusive: true,
      lineRounding: true,
      documentRounding: true,
      percent: true,
      fixedPerNight: true,
      fixedPerPersonNight: true,
      slabPercent: true,
    });
  });

  test("the tax-fiscal public index does not yet export the evaluator contract", () => {
    const publicIndex = source(indexUrl);

    expect(publicIndex).toContain(
      'export { evaluateTaxJurisdiction } from "./evaluator";',
    );
    expect(publicIndex).toContain(
      'export type { TaxEvaluationInput, TaxEvaluationResult } from "./evaluator";',
    );
  });
});
