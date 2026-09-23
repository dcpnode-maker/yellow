import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const attributionUrl = new URL(
  "../src/contexts/tax-fiscal/attribution.ts",
  import.meta.url,
);
const indexUrl = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

function source(path: URL): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function expectPublicSymbol(
  symbol: string,
  declaration: string,
): void {
  const attribution = source(attributionUrl);
  const publicIndex = source(indexUrl);

  expect({
    attributionModule: existsSync(attributionUrl),
    declaration: attribution.includes(declaration),
    publicExport: publicIndex.includes(symbol),
  }).toEqual({
    attributionModule: true,
    declaration: true,
    publicExport: true,
  });
}

describe("Order 240 intentional red: canonical positive tax-attribution snapshot", () => {
  test("PositiveTaxAttributionSnapshotV1 is absent before implementation", () => {
    expectPublicSymbol(
      "PositiveTaxAttributionSnapshotV1",
      "export interface PositiveTaxAttributionSnapshotV1",
    );
  });

  test("TaxAttributionSnapshotError is absent before implementation", () => {
    expectPublicSymbol(
      "TaxAttributionSnapshotError",
      "export class TaxAttributionSnapshotError",
    );
  });

  test("createPositiveTaxAttributionSnapshot is absent before implementation", () => {
    expectPublicSymbol(
      "createPositiveTaxAttributionSnapshot",
      "export function createPositiveTaxAttributionSnapshot(",
    );
  });

  test("parsePositiveTaxAttributionSnapshot is absent before implementation", () => {
    expectPublicSymbol(
      "parsePositiveTaxAttributionSnapshot",
      "export function parsePositiveTaxAttributionSnapshot(",
    );
  });
});
