import { expect, test } from "bun:test";

test("failure diagnostics are time and byte bounded without replacing acceptance or cleanup", async () => {
  const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
  const start = workflow.indexOf("      - name: Print database logs on failure");
  const end = workflow.indexOf("      - name: Remove database stack and volumes", start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const diagnostic = workflow.slice(start, end);
  expect(diagnostic).toContain("if: failure()");
  expect(diagnostic).toContain("timeout-minutes: 1");
  expect(diagnostic).toContain("timeout --kill-after=5s 20s docker compose logs --no-color --tail 40 postgres app | tail -c 65536");
  expect(diagnostic).toContain('diagnostic_status=("${PIPESTATUS[@]}")');
  expect(diagnostic).toContain("partial diagnostics only");
  expect(workflow.slice(end, workflow.indexOf("  local-review:", end))).toContain("if: always()");
  const acceptance = workflow.slice(workflow.indexOf("      - name: Prove deployment migration and seed"), start);
  for (const required of ["bun run test:database", "bun run schema:check", "Prove invariant database through canonical referee"]) {
    expect(acceptance).toContain(required);
  }
  expect(acceptance).not.toContain("continue-on-error");
  expect(acceptance).not.toContain("|| true");
});

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

test("CI pins genuine fiscal delivery to its exact historical81 catalogue", async () => {
  const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
  const prefix = workflow.indexOf('signed_migrations="$(mktemp -d "$RUNNER_TEMP/yellow-order440-prefix81.XXXXXX")"');
  const start = workflow.indexOf('q204_database="yellow_order440_q204_ci"');
  const end = workflow.indexOf("# Q205 records real request/retry", start);
  expect(start).toBeGreaterThan(0);
  expect(prefix).toBeGreaterThan(0);
  expect(prefix).toBeLessThan(start);
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
  const prefixStep = workflow.slice(prefix, start);
  expect(prefixStep).toContain('10#${filename:0:4} <= 81');
  expect(prefixStep).toContain('export YELLOW_MIGRATIONS_DIR="$signed_migrations"');
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

test("CI preserves historical fiscal frontiers and runs fresh and upgraded86 proofs in strict isolation", async () => {
  const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
  const historicalStart = workflow.indexOf('native_migrations="$(mktemp -d "$RUNNER_TEMP/yellow-order434-prefix80.XXXXXX")"');
  const q203 = workflow.indexOf('q203_database="yellow_order440_q203_ci"');
  const q204 = workflow.indexOf('q204_database="yellow_order440_q204_ci"');
  const upgrade = workflow.indexOf('q207_upgrade_database="yellow_order440_q207_upgrade_ci"');
  const current = workflow.indexOf('q207_database="yellow_order440_q207_ci"');
  const q209 = workflow.indexOf('q209_database="yellow_order440_q209_populated_ci"');
  const q208 = workflow.indexOf('q208_database="yellow_order440_q208_fresh85_ci"');
  const q212Fresh = workflow.indexOf('q212_fresh_database="yellow_order440_q212_fresh86_ci"');
  const q212Upgrade = workflow.indexOf('q212_upgrade_database="yellow_order440_q212_upgrade85_ci"');
  const order446 = workflow.indexOf("      - name: Prove Order446 credit-note backend on isolated fresh87 and populated86 targets");
  expect(historicalStart).toBeGreaterThan(0);
  expect(q203).toBeGreaterThan(historicalStart);
  expect(q204).toBeGreaterThan(q203);
  expect(upgrade).toBeGreaterThan(q204);
  expect(current).toBeGreaterThan(upgrade);
  expect(q209).toBeGreaterThan(current);
  expect(q208).toBeGreaterThan(q209);
  expect(q212Fresh).toBeGreaterThan(q208);
  expect(q212Upgrade).toBeGreaterThan(q212Fresh);
  expect(order446).toBeGreaterThan(q212Upgrade);
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

  const q208End = workflow.indexOf("      - name: Prove native fiscal release containment", q208);
  const q208Step = workflow.slice(q208, q208End);
  expect(q208Step).toContain("unset YELLOW_MIGRATIONS_DIR");
  expect(q208Step).toContain('CREATE DATABASE ${q208_database}');
  expect(q208Step).not.toContain('CREATE DATABASE ${q208_database} TEMPLATE');
  expect(q208Step).toContain('YELLOW_ORDER440_Q208_DEPLOY_DATABASE_URL=');
  expect(q208Step).toContain('YELLOW_ORDER440_Q208_RUNTIME_DATABASE_URL=');
  expect(q208Step).toContain('YELLOW_MIGRATIONS_DIR="$current85_migrations"');
  expect(q208Step).toContain('YELLOW_REQUIRE_ORDER440_Q208_DATABASE=1');
  expect(q208Step).toContain("bun test tests/india-native-fiscal-operator.integration.test.ts");
  expect(q208Step).not.toContain("|| true");
  expect(q208Step).not.toContain("continue-on-error");
  expect(q208Step).not.toContain("--test-name-pattern");

  const current85Start = workflow.lastIndexOf(
    'current85_migrations="$(mktemp -d "$RUNNER_TEMP/yellow-order440-prefix85.XXXXXX")"',
    q209,
  );
  expect(current85Start).toBeGreaterThan(current);
  const current85Prefix = workflow.slice(current85Start, q209);
  expect(current85Prefix).toContain('10#${filename:0:4} <= 85');
  const q209Source = await Bun.file(new URL(
    "./india-native-fiscal-populated-upgrade.integration.test.ts", import.meta.url,
  )).text();
  expect(q209Source).toContain("Number(name.slice(0, 4)) <= 85");
  expect(q209Source).toContain("withCanonical85Migrations");

  const q212FreshStep = workflow.slice(q212Fresh, q212Upgrade);
  expect(q212FreshStep).toContain('CREATE DATABASE ${q212_fresh_database}');
  expect(q212FreshStep).toContain('YELLOW_MIGRATIONS_DIR="$current86_migrations" YELLOW_DEPLOY_DATABASE_URL="$q212_fresh_deploy_url" bun run db:migrate');
  expect(q212FreshStep).toContain("YELLOW_REQUIRE_ORDER440_Q212_DATABASE=1");
  expect(q212FreshStep).toContain("bun test tests/fiscal-retry-binding.integration.test.ts");
  expect(q212FreshStep).not.toContain("fiscal-retry-readiness.integration.test.ts");
  expect(q212FreshStep).not.toContain("YELLOW_ORDER440_Q212_APPLY_UPGRADE=1");
  const current86Start = workflow.lastIndexOf(
    'current86_migrations="$(mktemp -d "$RUNNER_TEMP/yellow-order440-prefix86.XXXXXX")"',
    q212Fresh,
  );
  expect(current86Start).toBeGreaterThan(q208);
  expect(workflow.slice(current86Start, q212Fresh)).toContain('10#${filename:0:4} <= 86');
  const q212UpgradeStep = workflow.slice(q212Upgrade, order446);
  expect(q212UpgradeStep).toContain('CREATE DATABASE ${q212_upgrade_database}');
  expect(q212UpgradeStep).toContain('YELLOW_MIGRATIONS_DIR="$current85_migrations"');
  expect(q212UpgradeStep).toContain('YELLOW_ORDER440_Q212_MIGRATIONS_DIR="$current86_migrations"');
  expect(q212UpgradeStep).not.toContain("env -u YELLOW_MIGRATIONS_DIR");
  expect(q212UpgradeStep).toContain("YELLOW_ORDER440_Q212_APPLY_UPGRADE=1");
  expect(q212UpgradeStep).toContain("bun test tests/fiscal-retry-binding.integration.test.ts");
  expect(q212UpgradeStep).not.toContain("fiscal-retry-readiness.integration.test.ts");
  expect(q212UpgradeStep).toContain('rm -r -- "$current85_migrations"');
  expect(q212UpgradeStep).toContain('rm -r -- "$current86_migrations"');
  for (const step of [q212FreshStep, q212UpgradeStep]) {
    expect(step).not.toContain("|| true");
    expect(step).not.toContain("continue-on-error");
    expect(step).not.toContain("--test-name-pattern");
  }

  const order446Step = workflow.slice(order446, q208End);
  for (const required of [
    'fresh_database="yellow_order446_fresh87_ci"',
    'upgrade_database="yellow_order446_upgrade86_ci"',
    'readiness_database="yellow_order440_q212_current87_ci"',
    'prefix86="$(mktemp -d "$RUNNER_TEMP/yellow-order446-prefix86.XXXXXX")"',
    '10#${filename:0:4} <= 86',
    'env -u YELLOW_MIGRATIONS_DIR YELLOW_DEPLOY_DATABASE_URL="$fresh_deploy_url" bun run db:migrate',
    "YELLOW_REQUIRE_ORDER446_DATABASE=1",
    "bun test tests/india-native-fiscal-credit-note.integration.test.ts",
    "bun test tests/operator-fiscal-credit-note.integration.test.ts",
    'env -u YELLOW_MIGRATIONS_DIR YELLOW_DEPLOY_DATABASE_URL="$readiness_deploy_url" bun run db:migrate',
    "bun test tests/fiscal-retry-readiness.integration.test.ts",
    'YELLOW_MIGRATIONS_DIR="$prefix86" YELLOW_DEPLOY_DATABASE_URL="$upgrade_deploy_url" bun run db:migrate',
    "YELLOW_REQUIRE_ORDER446_UPGRADE_DATABASE=1",
    "bun test tests/india-native-fiscal-credit-note-upgrade.integration.test.ts",
  ]) expect(order446Step).toContain(required);
  expect(order446Step).not.toContain("|| true");
  expect(order446Step).not.toContain("continue-on-error");
  expect(order446Step).not.toContain("--test-name-pattern");
});
