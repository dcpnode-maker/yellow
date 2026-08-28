import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const resolutionUrl = new URL("../src/contexts/tax-fiscal/resolution.ts", import.meta.url);
const indexUrl = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

function source(path: URL): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

describe("Order 238 intentional red: effective tax-jurisdiction resolution", () => {
  test("the resolver service is absent before implementation", () => {
    const resolution = source(resolutionUrl);

    expect(existsSync(resolutionUrl)).toBe(true);
    expect(resolution).toContain("export class TaxJurisdictionResolutionService");
  });

  test("the tax-fiscal public index does not yet export the resolver", () => {
    const publicIndex = source(indexUrl);

    expect(publicIndex).toContain(
      'export { TaxJurisdictionResolutionService } from "./resolution";',
    );
  });
});
