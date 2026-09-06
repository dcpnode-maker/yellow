import { expect, test } from "bun:test";

test("quality preserves the full suite and independently exercises owned subprocess boundaries", async () => {
  const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
  const quality = workflow.slice(workflow.indexOf("  quality:"), workflow.indexOf("  container-smoke:"));
  expect(quality).toContain("run: /usr/bin/time -v bun test\n");
  for (const file of [
    "tests/project-status.test.ts", "tests/owned-proof-process.test.ts", "tests/import-boundaries.test.ts",
    "tests/operator-business-day-seal-browser.integration.test.ts",
    "tests/operator-owner-trust-workbench-browser.integration.test.ts",
    "tests/operator-business-day-discrepancy-carry-browser.integration.test.ts",
  ]) expect(quality).toContain(file);
  expect(quality).not.toContain("continue-on-error");
  expect(quality).not.toContain("--test-name-pattern");
  expect(quality).not.toContain("--retry");
});

test("CI requires genuine pre79 receipt upgrade and late replay proof with isolated cleanup", async () => {
  const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
  const start = workflow.indexOf('q205_database="yellow_order440_q205_ci"');
  const end = workflow.indexOf("# Q201 proves legacy retention", start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const step = workflow.slice(start, end);
  for (const expected of [
    'native_clones+=("$q205_database")',
    'CREATE DATABASE ${q205_database}',
    '10#${filename:0:4} <= 78',
    'result.discoveredFiles !== 78',
    'YELLOW_ORDER440_REPLAY_DEPLOY_DATABASE_URL=',
    'YELLOW_ORDER440_REPLAY_RUNTIME_DATABASE_URL=',
    'YELLOW_REQUIRE_ORDER440_REPLAY=1 YELLOW_ORDER440_REPLAY_APPLY_UPGRADE=1',
    'bun test tests/fiscal-submission-immutable-replay.integration.test.ts',
    'DROP DATABASE ${q205_database} WITH (FORCE)',
  ]) expect(step).toContain(expected);
  expect(step).not.toContain("|| true");
  expect(step).not.toContain("continue-on-error");
  expect(step).not.toContain("--test-name-pattern");
});

test("CI requires current80 genuine fiscal delivery and actual Linux process proof", async () => {
  const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
  const start = workflow.indexOf('q204_database="yellow_order440_q204_ci"');
  const end = workflow.indexOf("# Q205 records real request/retry", start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const step = workflow.slice(start, end);
  for (const expected of [
    'native_clones+=("$q204_database")',
    'CREATE DATABASE ${q204_database} TEMPLATE ${native_template}',
    'YELLOW_ORDER440_DELIVERY_DEPLOY_DATABASE_URL=',
    'YELLOW_ORDER440_DELIVERY_RUNTIME_DATABASE_URL=',
    'YELLOW_REQUIRE_ORDER440_DELIVERY=1',
    'bun test tests/fiscal-submission-delivery-runtime.integration.test.ts',
    'YELLOW_REQUIRE_SERVER_FISCAL_PROCESS=1',
    'bun test tests/server-fiscal-runtime.test.ts',
    'DROP DATABASE ${q204_database} WITH (FORCE)',
  ]) expect(step).toContain(expected);
  expect(step).not.toContain("|| true");
  expect(step).not.toContain("continue-on-error");
  expect(step).not.toContain("--test-name-pattern");
  const historical = await Bun.file(new URL(
    "./fiscal-submission-immutable-replay.integration.test.ts", import.meta.url,
  )).text();
  expect(historical).toContain("applyCanonical79ReplayUpgrade()");
  expect(historical).toContain("migrationsDirectory: directory");
  expect(historical).toContain("Number(name.slice(0, 4)) <= 79");
});
