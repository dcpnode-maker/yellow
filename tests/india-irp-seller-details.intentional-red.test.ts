import { describe, expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);

describe("Order 275 intentional red: exact India IRP 1.1 seller details", () => {
  test("P0: the pure seller-details module and bounded-context export exist", async () => {
    const moduleUrl = new URL("india-irp-seller-details.ts", sourceRoot);

    expect(await Bun.file(moduleUrl).exists()).toBeTrue();

    const source = await Bun.file(moduleUrl).text();
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();
    expect(source).toContain("export function buildIndiaIrpSellerDetails(");
    expect(source).toContain('format: "irp_json_1_1"');
    expect(source).toContain('new Bun.CryptoHasher("sha256")');
    expect(index).toContain('from "./india-irp-seller-details"');
  });
});
