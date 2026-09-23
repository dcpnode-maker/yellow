import { describe, expect, test } from "bun:test";

const migration = new URL("../migrations/0059_tax_extension_effective_period.sql", import.meta.url);
const extensionSource = new URL("../src/kernel/extension.ts", import.meta.url);
const resolutionSource = new URL("../src/contexts/tax-fiscal/resolution.ts", import.meta.url);

describe("Order 299 intentional red: selected extension effective-period evidence", () => {
  test("the runtime projection and frozen jurisdiction evidence carry both exact bounds", async () => {
    // Deliberately red before Order299: Order238 documented that the runtime adapter
    // omitted extension.effective, and neither this migration nor these evidence fields exist.
    expect(await Bun.file(migration).exists()).toBe(true);
    const extensionText = await Bun.file(extensionSource).text();
    const resolutionText = await Bun.file(resolutionSource).text();
    expect(extensionText).toContain("readVisibleEffectivePeriod");
    expect(extensionText).toContain("runtime_visible_extension_effective_period");
    expect(resolutionText).toContain("effectiveFromInstant");
    expect(resolutionText).toContain("effectiveToInstant");
    expect(resolutionText).toContain("readVisibleEffectivePeriod");
  });
});
