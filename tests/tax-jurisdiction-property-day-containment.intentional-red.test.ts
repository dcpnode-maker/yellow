import { describe, expect, test } from "bun:test";

const resolution = new URL("../src/contexts/tax-fiscal/resolution.ts", import.meta.url);
const proof = new URL("./tax-jurisdiction-effective-period.test.ts", import.meta.url);
const seed = new URL("./seed_fixture.sql", import.meta.url);

describe("Order 301 intentional red: whole property-day extension containment", () => {
  test("resolution rejects partial-day periods and the active India history starts at Kolkata midnight", async () => {
    // Deliberately red before Order301: Order299/300 preserve both intervals but do
    // not yet require the selected extension to contain the complete property day.
    const source = await Bun.file(resolution).text();
    const proofText = await Bun.file(proof).text();
    const seedText = await Bun.file(seed).text();

    expect(source).toContain("requireWholeBusinessDayContainment");
    expect(proofText).toContain("2026-06-01T00:00:00.000001Z");
    expect(proofText).toContain("2026-06-01T23:59:59.999999Z");
    expect(seedText).toContain(
      "tstzrange('2025-09-21T18:30:00.000000Z', NULL, '[)')",
    );
  });
});
