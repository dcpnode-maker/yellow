import { describe, expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);

describe("Order 278 intentional red: exact India IRP 1.1 buyer details", () => {
  test("P0: the pure buyer-details module and bounded-context export exist", async () => {
    const moduleUrl = new URL("india-irp-buyer-details.ts", sourceRoot);

    expect(await Bun.file(moduleUrl).exists()).toBeTrue();

    const source = await Bun.file(moduleUrl).text();
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();
    expect(source).toContain("export function buildIndiaIrpBuyerDetails(");
    expect(source).toContain('format: "irp_json_1_1"');
    expect(source).toContain('new Bun.CryptoHasher("sha256")');
    expect(index).toContain('from "./india-irp-buyer-details"');
  });
});
