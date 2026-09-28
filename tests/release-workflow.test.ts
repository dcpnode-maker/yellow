import { describe, expect, test } from "bun:test";

describe("Order 438 immutable release and local-review contracts", () => {
  test("publishes exact green-main SHA images without deploying a cloud target", async () => {
    const workflow = await Bun.file(new URL("../.github/workflows/release.yml", import.meta.url)).text();
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.event == 'push'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(workflow).toContain("github.event.workflow_run.head_repository.full_name == github.repository");
    for (const requiredJob of [
      "windows-state",
      "quality",
      "container-smoke",
      "database",
      "local-review",
    ]) {
      expect(workflow).toContain(`\"${requiredJob}\"`);
    }
    expect(workflow).toContain("ref: ${{ github.event.workflow_run.head_sha }}");
    expect(workflow).toContain('runtime_tag="$IMAGE:$RELEASE_SHA-amd64"');
    expect(workflow).toContain('migration_tag="$IMAGE:$RELEASE_SHA-migrations-amd64"');
    expect(workflow).toContain('--build-arg "YELLOW_BUILD_SHA=$RELEASE_SHA"');
    expect(workflow).toContain("MIGRATION_FRONTIER: '81'");
    expect(workflow).toContain('Expected migration frontier: \\`$MIGRATION_FRONTIER\\`');
    expect(workflow).not.toMatch(/\blatest\b|kamal deploy|ssh |production-preview/);
  });

  test("requires the fresh unseeded Order434 migration and native six-suite proof", async () => {
    const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
    for (const required of [
      'YELLOW_REQUIRE_ORDER434_DATABASE=1',
      'native_migrations="$(mktemp -d "$RUNNER_TEMP/yellow-order434-prefix80.XXXXXX")"',
      '10#${filename:0:4} <= 80',
      'YELLOW_ORDER434_MIGRATIONS_DIR="$native_migrations"',
      'YELLOW_MIGRATIONS_DIR="$native_migrations"',
      'YELLOW_ORDER434_PG_DUMP_COMPOSE=1',
      "Prove Order434 native fiscal suite on a fresh migrated 80 database",
      "timeout-minutes: 35",
      "YELLOW_REQUIRE_ORDER434_NATIVE_ACCOUNTING_DATABASE=1",
      "YELLOW_REQUIRE_ORDER434_NATIVE_ISSUANCE_DATABASE=1",
      "bun run db:migrate",
      "native_template=\"yellow_ci_order434_native_template\"",
      "native_clones=()",
      "CREATE DATABASE ${native_clone} TEMPLATE ${native_template}",
      "DROP DATABASE IF EXISTS ${native_clone} WITH (FORCE)",
      "tests/india-gst-accommodation-ordinary-regime-evidence.integration.test.ts",
      "tests/india-native-fiscal-source-completion.integration.test.ts",
      "tests/india-native-fiscal-accounting.integration.test.ts",
      "tests/india-native-fiscal-preparation.integration.test.ts",
      "tests/india-native-fiscal-source-locks.integration.test.ts",
      "tests/india-native-fiscal-completion.integration.test.ts",
    ]) expect(workflow).toContain(required);
    expect(workflow).not.toContain("DROP DATABASE IF EXISTS yellow_ci_order434_native WITH (FORCE); CREATE DATABASE yellow_ci_order434_native");
    expect(workflow).not.toContain("YELLOW_REVIEW_PASSWORD=yellow");
  });

  test("requires canonical durable fiscal proof from the exact predecessor", async () => {
    const workflow = await Bun.file(new URL("../.github/workflows/ci.yml", import.meta.url)).text();
    expect(workflow).toContain('durable_database="yellow_order440_durable_ci"');
    expect(workflow).toContain('YELLOW_ORDER440_PRE_MIGRATIONS_DIR="$durable_migrations"');
    expect(workflow).toContain("result.discoveredFiles !== 77");
    expect(workflow).toContain("YELLOW_REQUIRE_ORDER440_DURABILITY=1");
    expect(workflow).toContain("bun test tests/fiscal-submission-durability.integration.test.ts");
    const proof = await Bun.file(new URL("fiscal-submission-durability.integration.test.ts", import.meta.url)).text();
    expect(proof).toContain('const CANONICAL78 = "0078_fiscal_submission_durability.sql"');
    expect(proof).toContain("const migrated = await withCanonical78Migrations(directory => runMigrations");
    expect(proof).toContain("migrationsDirectory: directory");
    expect(proof).toContain("Number(name.slice(0, 4)) <= 78");
    expect(proof).not.toContain('new URL("../handoff/drafts/order440/');
  });

  test("embeds the exact build revision in both release image targets", async () => {
    const dockerfile = await Bun.file(new URL("../Dockerfile", import.meta.url)).text();
    expect(dockerfile.match(/ARG YELLOW_BUILD_SHA/g)).toHaveLength(2);
    expect(dockerfile.match(/LABEL org\.opencontainers\.image\.revision=\$YELLOW_BUILD_SHA/g)).toHaveLength(2);
    expect(dockerfile.match(/ENV YELLOW_BUILD_SHA=\$YELLOW_BUILD_SHA/g)).toHaveLength(2);

    const databaseTools = dockerfile.slice(
      dockerfile.indexOf(" AS database-tools"),
      dockerfile.indexOf(" AS runtime"),
    );
    expect(databaseTools).toContain("COPY --chown=bun:bun src ./src");
    expect(databaseTools).toContain("USER bun");
  });

  test("the one-command local launcher proves exact revision, readiness and login", async () => {
    const launcher = await Bun.file(new URL("../scripts/local-review.sh", import.meta.url)).text();
    expect(launcher).toContain("git status --porcelain --untracked-files=normal");
    expect(launcher).toContain('export YELLOW_BUILD_SHA="$revision"');
    expect(launcher).toContain("./setup.sh --db-only");
    expect(launcher).toContain("seed bun scripts/seed-review.ts");
    expect(launcher).toContain('/ready"');
    expect(launcher).toContain('body.target !== "yellow_runtime_database"');
    expect(launcher).toContain("body.build?.expectedMigrationFrontier !== 81");
    expect(launcher).toContain("/api/v1/auth/local:login");
    expect(launcher).toContain('YELLOW_APP_PORT="${YELLOW_APP_PORT:-3000}"');
    expect(launcher).toContain("crypto.getRandomValues");
    expect(launcher).not.toMatch(/docker compose down -v|docker volume rm|YELLOW_REVIEW_PASSWORD=yellow/);
  });
});
