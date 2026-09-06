import { expect, test } from "bun:test";

test("browser proofs share one journey deadline inside their original outer limits", async () => {
  for (const [file, budget, outer] of [
    ["operator-business-day-discrepancy-carry-browser.integration.test.ts", "55_000", "60_000"],
    ["operator-business-day-seal-browser.integration.test.ts", "85_000", "90_000"],
    ["operator-owner-trust-workbench-browser.integration.test.ts", "85_000", "90_000"],
  ] as const) {
    const source = await Bun.file(new URL(`./${file}`, import.meta.url)).text();
    const deadline = `const expiresAt = performance.now() + ${budget};`;
    expect(source.split(deadline).length).toBe(2);
    const journey = source.slice(source.indexOf(deadline));
    expect(journey.indexOf(deadline)).toBeLessThan(journey.indexOf("for (const theme"));
    expect(journey).toContain(`}, ${outer});`);
    expect(journey).toMatch(/await chromium\([^\n]+, expiresAt\)/);
    const browser = source.slice(source.indexOf("async function chromium"), source.indexOf("const result = await runOwnedProofProcess"));
    expect(browser).toContain("expiresAt: number");
    expect(browser).toContain("const remainingMs = Math.floor(expiresAt - performance.now());");
    expect(browser).toContain('if (remainingMs < 1) throw new Error("browser journey deadline exhausted before launch");');
    expect(source).toContain("{ timeoutMs: remainingMs }");
    expect(source).not.toContain("timeoutMs: 8_000");
  }
});

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

test("CI requires current81 genuine fiscal delivery and actual Linux process proof", async () => {
  const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
  const start = workflow.indexOf('q204_database="yellow_order440_q204_ci"');
  const end = workflow.indexOf("# Q205 records real request/retry", start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const step = workflow.slice(start, end);
  for (const expected of [
    'native_clones+=("$q204_database")',
    'CREATE DATABASE ${q204_database} TEMPLATE ${native_template}',
    'YELLOW_DEPLOY_DATABASE_URL="postgres://yellow_deploy:${YELLOW_DEPLOY_DATABASE_PASSWORD}@${POSTGRES_ADDRESS}/${q204_database}"',
    'bun run db:migrate',
    'YELLOW_ORDER440_DELIVERY_DEPLOY_DATABASE_URL=',
    'YELLOW_ORDER440_DELIVERY_RUNTIME_DATABASE_URL=',
    'YELLOW_REQUIRE_ORDER440_DELIVERY=1',
    'bun test tests/fiscal-submission-delivery-runtime.integration.test.ts',
    'YELLOW_REQUIRE_SERVER_FISCAL_PROCESS=1',
    'bun test tests/server-fiscal-runtime.test.ts',
    'DROP DATABASE ${q204_database} WITH (FORCE)',
  ]) expect(step).toContain(expected);
  expect(step.indexOf("bun run db:migrate")).toBeGreaterThan(step.indexOf("CREATE DATABASE"));
  expect(step.indexOf("bun run db:migrate")).toBeLessThan(step.indexOf("bun test tests/fiscal-submission-delivery-runtime.integration.test.ts"));
  expect(step).not.toContain("YELLOW_MIGRATIONS_DIR=");
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

test("CI preserves historical80 fixtures and runs signed frontier81 proofs in strict isolated order", async () => {
  const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
  const historicalStart = workflow.indexOf('native_migrations="$(mktemp -d "$RUNNER_TEMP/yellow-order434-prefix80.XXXXXX")"');
  const q203 = workflow.indexOf('q203_database="yellow_order440_q203_ci"');
  const q204 = workflow.indexOf('q204_database="yellow_order440_q204_ci"');
  const upgrade = workflow.indexOf('q207_upgrade_database="yellow_order440_q207_upgrade_ci"');
  const current = workflow.indexOf('q207_database="yellow_order440_q207_ci"');
  expect(historicalStart).toBeGreaterThan(0);
  expect(q203).toBeGreaterThan(historicalStart);
  expect(q204).toBeGreaterThan(q203);
  expect(upgrade).toBeGreaterThan(q204);
  expect(current).toBeGreaterThan(upgrade);
  const historical = workflow.slice(historicalStart, upgrade);
  expect(historical).toContain('10#${filename:0:4} <= 80');
  expect(historical).toContain('export YELLOW_ORDER434_MIGRATIONS_DIR="$native_migrations"');
  expect(historical).toContain('YELLOW_MIGRATIONS_DIR="$native_migrations"');
  expect(historical).not.toContain("YELLOW_ORDER440_SIGNED_DEPLOY_DATABASE_URL=");

  const upgradeStep = workflow.slice(upgrade, current);
  for (const required of [
    'native_clones+=("$q207_upgrade_database")',
    'CREATE DATABASE ${q207_upgrade_database} TEMPLATE ${native_template}',
    'YELLOW_ORDER440_SIGNED_DEPLOY_DATABASE_URL=',
    'YELLOW_ORDER440_SIGNED_RUNTIME_DATABASE_URL=',
    'YELLOW_REQUIRE_ORDER440_SIGNED=1 YELLOW_ORDER440_SIGNED_APPLY_UPGRADE=1',
    'bun test tests/fiscal-signed-receipt-durability.integration.test.ts',
    'DROP DATABASE ${q207_upgrade_database} WITH (FORCE)',
  ]) expect(upgradeStep).toContain(required);

  const end = workflow.indexOf("      - name: Prove native fiscal release containment", current);
  expect(end).toBeGreaterThan(current);
  const currentStep = workflow.slice(current, end);
  for (const required of [
    'native_clones+=("$q207_database")',
    'CREATE DATABASE ${q207_database} TEMPLATE ${native_template}',
    'YELLOW_DEPLOY_DATABASE_URL="$q207_deploy_url" bun run db:migrate',
    'YELLOW_REQUIRE_ORDER440_SIGNED=1',
    'bun test tests/fiscal-signed-receipt-durability.integration.test.ts',
    'bun test tests/fiscal-signed-provider-journey.integration.test.ts',
    'bun test tests/operator-fiscal-submission-receipt.integration.test.ts',
    'DROP DATABASE ${q207_database} WITH (FORCE)',
  ]) expect(currentStep).toContain(required);
  const durability = currentStep.indexOf("bun test tests/fiscal-signed-receipt-durability.integration.test.ts");
  const journey = currentStep.indexOf("bun test tests/fiscal-signed-provider-journey.integration.test.ts");
  const receiptGet = currentStep.indexOf("bun test tests/operator-fiscal-submission-receipt.integration.test.ts");
  expect(durability).toBeGreaterThan(currentStep.indexOf("bun run db:migrate"));
  expect(journey).toBeGreaterThan(durability);
  expect(receiptGet).toBeGreaterThan(journey);
  expect(currentStep).not.toContain("|| true");
  expect(currentStep).not.toContain("continue-on-error");
  expect(currentStep).not.toContain("--test-name-pattern");
});
