import { describe, expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);

describe("Order 415 intentional red: India IRP ordinary registered B2B supply type", () => {
  test("P0: the exact pure composer and bounded-context export exist", async () => {
    const moduleUrl = new URL(
      "india-irp-ordinary-registered-b2b-supply-type.ts",
      sourceRoot,
    );

    // This existence assertion was executed while the module was absent. Keeping
    // it first preserves the exact executable red boundary after implementation.
    expect(await Bun.file(moduleUrl).exists()).toBeTrue();

    const source = await Bun.file(moduleUrl).text();
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();
    expect(source).toContain(
      "export function composeIndiaIrpOrdinaryRegisteredB2bSupplyType",
    );
    expect(source).toContain(
      "eligible_irp_ordinary_registered_b2b_supply_type",
    );
    expect(index).toContain(
      'from "./india-irp-ordinary-registered-b2b-supply-type"',
    );
    expect(index).toContain(
      "composeIndiaIrpOrdinaryRegisteredB2bSupplyType",
    );
  });
});
