import { describe, expect, test } from "bun:test";

const fixture = new URL("./seed_fixture.sql", import.meta.url);
const launchSeed = new URL("../scripts/seed.ts", import.meta.url);
const extensions = new URL("../docs/EXTENSIONS.md", import.meta.url);
const evaluatorProof = new URL("./tax-evaluator.test.ts", import.meta.url);
const quoteProof = new URL("./rate-quote-tax-preview.integration.test.ts", import.meta.url);

const FIXTURE_BANDS =
  '"slabs":[{"upto_minor":750000,"rate":0.05,"itc_eligible":false},{"upto_minor":null,"rate":0.18,"itc_eligible":true}]';
const LAUNCH_BANDS =
  "slabs: [{ upto_minor: 750000, rate: 0.05, itc_eligible: false }, { upto_minor: null, rate: 0.18, itc_eligible: true }]";

describe("Order 303 intentional red: Notification 15 accommodation correction", () => {
  test("canonical fixture, default seed and executable boundaries carry exact 5%/18% truth", async () => {
    const fixtureText = await Bun.file(fixture).text();
    const launchText = await Bun.file(launchSeed).text();
    const extensionText = await Bun.file(extensions).text();
    const evaluatorText = await Bun.file(evaluatorProof).text();
    const quoteText = await Bun.file(quoteProof).text();

    expect(fixtureText).toContain(FIXTURE_BANDS);
    expect(launchText).toContain(LAUNCH_BANDS);
    expect(fixtureText).not.toContain('"rate":0.12,"itc_eligible":true');
    expect(launchText).not.toContain("upto_minor: 100000, rate: 0");

    expect(extensionText).toContain('"upto_minor":750000,  "rate":0.05, "itc_eligible":false');
    expect(extensionText).toContain('"upto_minor":null,    "rate":0.18, "itc_eligible":true');
    expect(extensionText).toContain("Notification 15/2025-Central Tax (Rate)");
    expect(extensionText).toContain("effective 22 September 2025");
    expect(extensionText).not.toContain('"upto_minor":100000,  "rate":0');

    for (const proof of [evaluatorText, quoteText]) {
      expect(proof).toContain("{ upto_minor: 750_000, rate: 0.05, itc_eligible: false }");
      expect(proof).toContain("{ upto_minor: null, rate: 0.18, itc_eligible: true }");
    }
    expect(evaluatorText).toContain("taxTotalMinor: 182_523n");
    expect(quoteText).toContain("taxTotalMinor: 182_523n");
    expect(quoteText).toContain("rateBasisPoints: 500");
  });
});
