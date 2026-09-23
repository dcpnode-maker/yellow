import { describe, expect, test } from "bun:test";

const moduleFile = Bun.file(new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-rate-version-pair.ts",
  import.meta.url,
));
const indexFile = Bun.file(new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url));

describe("Order 304 intentional red: governed accommodation rate-version pair", () => {
  test("the exact retired-predecessor/active-successor evidence boundary exists", async () => {
    expect(await moduleFile.exists()).toBe(true);
    const [source, exports] = await Promise.all([moduleFile.text(), indexFile.text()]);

    expect(source).toContain("IndiaGstAccommodationRateVersionPairService");
    expect(source).toContain("2025-09-21T18:30:00.000000Z");
    expect(source).toContain("ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901");
    expect(source).toContain("c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716");
    expect(source).toContain("46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289");
    expect(exports).toContain('from "./india-gst-accommodation-rate-version-pair"');
  });
});
