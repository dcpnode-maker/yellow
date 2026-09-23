import { describe, expect, test } from "bun:test";

const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-recipient-registration-at-time-of-supply.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 296 intentional red: recipient GST registration at exact time of supply", () => {
  test("the recipient-side resolver source and tax-fiscal export exist", async () => {
    expect(await Bun.file(source).exists()).toBeTrue();
    const moduleSurface = await Bun.file(index).text();
    expect(moduleSurface).toContain(
      'from "./india-gst-recipient-registration-at-time-of-supply"',
    );
    expect(moduleSurface).toContain(
      "resolveIndiaGstRecipientRegistrationAtTimeOfSupply",
    );
    expect(moduleSurface).toContain(
      "IndiaGstRecipientRegistrationAtTimeOfSupplyService",
    );
  });
});
