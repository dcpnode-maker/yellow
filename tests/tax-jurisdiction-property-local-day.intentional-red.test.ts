import { describe, expect, test } from "bun:test";

const resolution = new URL("../src/contexts/tax-fiscal/resolution.ts", import.meta.url);
const proof = new URL("./tax-jurisdiction-resolution.integration.test.ts", import.meta.url);

describe("Order 300 intentional red: property-local business-day instant evidence", () => {
  test("the resolver and permanent proof bind database-derived timezone and day bounds", async () => {
    // Deliberately red before Order300: approved Order299 binds extension bounds but
    // carries no database-derived property-local day envelope.
    const source = await Bun.file(resolution).text();
    const proofText = await Bun.file(proof).text();
    for (const field of [
      "propertyTimezone",
      "businessDayFromInstant",
      "businessDayToInstant",
    ]) {
      expect(source).toContain(field);
      expect(proofText).toContain(field);
    }
    expect(proofText).toContain("America/New_York");
    expect(proofText).toContain("Asia/Kathmandu");
  });
});
