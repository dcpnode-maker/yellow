import { describe, expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);

describe("Order 429 intentional red: India IRP fiscal-action readiness", () => {
  test("P0: the exact readiness module and bounded-context export are initially absent", async () => {
    const moduleUrl = new URL("india-irp-accommodation-fiscal-action-readiness.ts", sourceRoot);
    const moduleSource = await Bun.file(moduleUrl).text();
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();
    expect(moduleSource).toContain("export class IndiaIrpAccommodationFiscalActionReadinessService");
    expect(index).toContain('from "./india-irp-accommodation-fiscal-action-readiness"');
    expect(index).toContain("IndiaIrpAccommodationFiscalActionReadinessService");
  });
});
