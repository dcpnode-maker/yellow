import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync("tools/promote-public-demo.ps1", "utf8");

test("public demo promotion script keeps the required asset mirror step explicit", () => {
  expect(script).toContain('$frontendPublic = Join-Path $root "frontend\\yellow\\public\\yellow-next"');
  expect(script).toContain('$dockerPublic = Join-Path $root "public\\yellow-next"');
  expect(script).toContain("& robocopy $frontendPublic $dockerPublic /MIR");
});

test("public demo promotion script verifies before rebuilding live app", () => {
  const testsIndex = script.indexOf("& bun test");
  const buildIndex = script.indexOf("& bun x vite build");
  const composeIndex = script.indexOf("& docker compose");
  expect(testsIndex).toBeGreaterThan(0);
  expect(buildIndex).toBeGreaterThan(testsIndex);
  expect(composeIndex).toBeGreaterThan(buildIndex);
});

test("public demo promotion script validates runtime files and health checks", () => {
  for (const expected of [
    "yellow-public-demo.env",
    "yellow-public-demo.compose.yml",
    "yellow-public-demo-tunnel.compose.yml",
    "Invoke-WebRequest -UseBasicParsing -Uri $url",
  ]) {
    expect(script).toContain(expected);
  }
});
