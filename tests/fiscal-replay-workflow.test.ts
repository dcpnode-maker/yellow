import { expect, test } from "bun:test";

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
