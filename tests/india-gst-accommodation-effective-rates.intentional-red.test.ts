import { describe, expect, test } from "bun:test";

const seed = new URL("./seed_fixture.sql", import.meta.url);
const extensions = new URL("../docs/EXTENSIONS.md", import.meta.url);
const evaluatorProof = new URL("./tax-evaluator.test.ts", import.meta.url);
const quoteProof = new URL("./rate-quote-tax-preview.integration.test.ts", import.meta.url);

describe("Order 298 intentional red: effective India GST accommodation rates", () => {
  test("the launch seed and extension contract carry the sourced 2026 12%/18% value bands", async () => {
    // Deliberately red before Order298: both retained artifacts still encode the
    // quarantined launch-era nil/5% accommodation fixture.
    const seedText = await Bun.file(seed).text();
    const extensionText = await Bun.file(extensions).text();
    const evaluatorText = await Bun.file(evaluatorProof).text();
    const quoteText = await Bun.file(quoteProof).text();

    expect(seedText).toContain('"upto_minor":750000,"rate":0.12,"itc_eligible":true');
    expect(seedText).toContain('"upto_minor":null,"rate":0.18,"itc_eligible":true');
    expect(seedText).not.toContain(
      '"slabs":[{"upto_minor":100000,"rate":0,"itc_eligible":false},{"upto_minor":750000,"rate":0.05,"itc_eligible":false}',
    );
    expect(extensionText).toContain("12% through INR 7,500 per accommodation unit per day");
    expect(extensionText).toContain("18% above INR 7,500");
    expect(extensionText).not.toContain('"upto_minor":100000,  "rate":0');
    expect(extensionText).not.toContain('"upto_minor":750000,  "rate":0.05');
    expect(extensionText).toContain('"upto_minor":750000,  "rate":0.12, "itc_eligible":true');
    expect(extensionText).toContain('"upto_minor":null,    "rate":0.18, "itc_eligible":true');
    for (const proof of [evaluatorText, quoteText]) {
      expect(proof).toContain("{ upto_minor: 750_000, rate: 0.12, itc_eligible: true }");
      expect(proof).toContain("{ upto_minor: null, rate: 0.18, itc_eligible: true }");
    }
  });
});
