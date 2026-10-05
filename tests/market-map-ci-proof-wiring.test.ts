import { expect, test } from "bun:test";

const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
const researchProof = await Bun.file(new URL("./operator-overture-market-map.browser.test.ts", import.meta.url)).text();

test("CI binds both map renderers to the report-producing required browser proof", () => {
  const proofStep = workflow.split("- name: Prove market map renderer and interactions")[1]?.split("- name: Retain market map browser proof")[0] ?? "";
  expect(proofStep).toContain('YELLOW_REQUIRE_MARKET_MAP_BROWSER: "1"');
  expect(proofStep).toContain("YELLOW_MARKET_MAP_PROOF_DIR: ${{ runner.temp }}/yellow-market-map-proof");
  expect(proofStep).toContain("bun test");
  expect(proofStep).toContain("tests/operator-market-map.browser.test.ts");
  expect(proofStep).toContain("tests/operator-overture-market-map.browser.test.ts");
  expect(researchProof).toContain("process.env.YELLOW_MARKET_MAP_PROOF_DIR");
  expect(researchProof.includes('Object.assign(proof, { status: "passed"')).toBe(true);
});

test("missing proof artifacts remain a hard CI failure", () => {
  const retention = workflow.split("- name: Retain market map browser proof")[1]?.split("- name: Test")[0] ?? "";
  expect(retention).toContain("path: ${{ runner.temp }}/yellow-market-map-proof");
  expect(retention).toContain("if-no-files-found: error");
  expect(retention).not.toContain("continue-on-error");
  expect(retention).toContain("steps.market-map-browser.outcome == 'failure'");
});
