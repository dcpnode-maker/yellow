import { describe, expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);

describe("Order 279 intentional red: exact India GST folio buyer candidate", () => {
  test("P0: the read-only candidate module and bounded-context export exist", async () => {
    const moduleUrl = new URL("india-gst-folio-buyer-candidate.ts", sourceRoot);

    expect(await Bun.file(moduleUrl).exists()).toBeTrue();

    const source = await Bun.file(moduleUrl).text();
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();
    expect(source).toContain("export class IndiaGstFolioBuyerCandidateService");
    expect(source).toContain('new Bun.CryptoHasher("sha256")');
    expect(source).toContain("buildIndiaIrpBuyerDetails(");
    expect(index).toContain('from "./india-gst-folio-buyer-candidate"');
  });
});
