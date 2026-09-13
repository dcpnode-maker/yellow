import { expect, test } from "bun:test";

import {
  MARKET_COMPSET_CI_DATABASE,
  readMarketCompsetIntegrationEnvironment,
} from "./helpers/market-compset-environment";

test("Order472 CI wiring creates, migrates, seeds, proves, and removes only its fixed market target", async () => {
  const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
  const stepName = "      - name: Prove Order472 market authority, API and runtime readiness on an isolated target";
  const start = workflow.indexOf(stepName);
  const end = workflow.indexOf("\n      - name:", start + stepName.length);
  const step = workflow.slice(start, end === -1 ? undefined : end);
  const selected = readMarketCompsetIntegrationEnvironment({
    YELLOW_REQUIRE_MARKET_COMPSET_INTEGRATION: "1",
    YELLOW_ORDER472_MARKET_COMPSET_CI_MODE: "1",
    CI: "true", GITHUB_ACTIONS: "true", POSTGRES_ADDRESS: "127.0.0.1:54329",
    YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL: `postgres://yellow_deploy:ci-secret@127.0.0.1:54329/${MARKET_COMPSET_CI_DATABASE}`,
    YELLOW_ORDER472_MARKET_COMPSET_RUNTIME_DATABASE_URL: `postgres://yellow_runtime:ci-secret@127.0.0.1:54329/${MARKET_COMPSET_CI_DATABASE}`,
    YELLOW_ORDER472_MARKET_COMPSET_REGISTRAR_DATABASE_URL: `postgres://yellow_extension_registrar:ci-secret@127.0.0.1:54329/${MARKET_COMPSET_CI_DATABASE}`,
  });
  expect(selected).toMatchObject({ mode: "ci", database: MARKET_COMPSET_CI_DATABASE });
  const create = step.indexOf("CREATE DATABASE ${market_database}");
  const cleanup = step.indexOf("trap cleanup_market_database EXIT");
  const migrate = step.indexOf("bun run db:migrate", create);
  const seed = step.indexOf("bun run db:seed", migrate);
  const fixture = step.indexOf("seedMarketCompsetFixture", seed);
  const suites = step.indexOf("tests/market-compset.integration.test.ts tests/market-api.integration.test.ts tests/market-runtime-readiness.integration.test.ts", seed);
  expect(create).toBeGreaterThan(-1); expect(migrate).toBeGreaterThan(create); expect(seed).toBeGreaterThan(migrate);
  expect(cleanup).toBeGreaterThan(create); expect(fixture).toBeGreaterThan(seed); expect(suites).toBeGreaterThan(fixture);
  expect(step.indexOf("          cleanup_market_database\n")).toBe(-1);
  expect(step).toContain("unset YELLOW_MIGRATIONS_DIR YELLOW_REVIEW_SEED_URL");
  expect(step).toContain("set -euo pipefail");
  expect(step).not.toContain("continue-on-error:");
  expect(step).not.toContain("\n        if:");
  for (const required of [
    "YELLOW_REQUIRE_MARKET_COMPSET_INTEGRATION=1", "YELLOW_ORDER472_MARKET_COMPSET_CI_MODE=1",
    "CI=true", "GITHUB_ACTIONS=true", "YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL",
    "YELLOW_ORDER472_MARKET_COMPSET_RUNTIME_DATABASE_URL", "YELLOW_ORDER472_MARKET_COMPSET_REGISTRAR_DATABASE_URL",
    "POSTGRES_ADDRESS=\"$POSTGRES_ADDRESS\"",
  ]) expect(step).toContain(required);
  const proofEnvironment = step.slice(step.indexOf("export YELLOW_REQUIRE_MARKET_COMPSET_INTEGRATION=1"));
  for (const required of [
    "export YELLOW_REQUIRE_MARKET_COMPSET_INTEGRATION=1",
    "export YELLOW_ORDER472_MARKET_COMPSET_CI_MODE=1",
    "export YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL=\"$market_deploy_url\"",
    "export YELLOW_ORDER472_MARKET_COMPSET_RUNTIME_DATABASE_URL=\"$market_runtime_url\"",
    "export YELLOW_ORDER472_MARKET_COMPSET_REGISTRAR_DATABASE_URL=\"$market_registrar_url\"",
    "export CI=true",
    "export GITHUB_ACTIONS=true",
    "export POSTGRES_ADDRESS=\"$POSTGRES_ADDRESS\"",
    "new SQL(environment.deployDatabaseUrl, { max: 1, prepare: false })",
    "finally",
    "market_compset_ci_fixture_preparation_failed",
    "market_compset_ci_fixture_close_failed",
  ]) expect(proofEnvironment).toContain(required);
  expect(proofEnvironment).not.toContain("YELLOW_DEPLOY_DATABASE_URL=");
  expect(proofEnvironment).not.toContain("YELLOW_RUNTIME_DATABASE_URL=");
});
