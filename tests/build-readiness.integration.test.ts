import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { runMigrations } from "../scripts/migrate";
import { assertRuntimeReleaseReadiness } from "../src/kernel";

const ADMIN_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_BUILD_READINESS === "1";
const MIGRATIONS = resolve(import.meta.dir, "..", "migrations");

if (REQUIRED && (!ADMIN_URL || !RUNTIME_URL)) {
  throw new Error("Order438 build-readiness proof requires deploy and runtime PostgreSQL URLs");
}

const databaseDescribe = ADMIN_URL && RUNTIME_URL ? describe.serial : describe.skip;
const databaseName = `yellow_build_readiness_${crypto.randomUUID().replaceAll("-", "")}`;
let administrator: SQL | undefined;
let deployment: SQL | undefined;
let runtime: SQL | undefined;
let deploymentDatabaseUrl = "";
let runtimeDatabaseUrl = "";
let release77Ready = false;

async function readinessFailure(operation: Promise<void>): Promise<Error> {
  try {
    await operation;
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error("runtime readiness rejected with a non-Error value");
  }
  throw new Error("runtime readiness unexpectedly succeeded");
}

async function ensureRelease77(): Promise<void> {
  if (release77Ready) return;
  const result = await runMigrations({ databaseUrl: deploymentDatabaseUrl, logger: () => undefined });
  expect(result.appliedFiles).toEqual([
    "0076_india_native_fiscal_source_evidence.sql",
    "0077_india_native_fiscal_source_completion.sql",
  ]);
  deployment = new SQL(deploymentDatabaseUrl, { max: 1, prepare: false });
  runtime = new SQL(runtimeDatabaseUrl, { max: 1, prepare: false });
  release77Ready = true;
}

databaseDescribe("Order438 runtime release readiness identity", () => {
  beforeAll(async () => {
    administrator = new SQL(ADMIN_URL!, { max: 1, prepare: false });
    await administrator.unsafe(`CREATE DATABASE "${databaseName}"`);

    const deploymentUrl = new URL(ADMIN_URL!);
    deploymentUrl.pathname = `/${databaseName}`;
    const runtimeUrl = new URL(RUNTIME_URL!);
    runtimeUrl.pathname = `/${databaseName}`;
    deploymentDatabaseUrl = deploymentUrl.toString();
    runtimeDatabaseUrl = runtimeUrl.toString();

    const predecessorDirectory = await mkdtemp(join(tmpdir(), "yellow-readiness-75-"));
    try {
      const names = (await readdir(MIGRATIONS)).filter(name =>
        name.endsWith(".sql") && Number(name.slice(0, 4)) <= 75);
      await Promise.all(names.map(async name => writeFile(resolve(predecessorDirectory, name),
        await readFile(resolve(MIGRATIONS, name)))));
      await runMigrations({ databaseUrl: deploymentUrl.toString(),
        migrationsDirectory: predecessorDirectory, logger: () => undefined });
    } finally {
      await rm(predecessorDirectory, { recursive: true, force: true });
    }
    await administrator.close({ timeout: 0 });
    administrator = undefined;
  }, 120_000);

  afterAll(async () => {
    await runtime?.close({ timeout: 0 });
    await deployment?.close({ timeout: 0 });
    await administrator?.close({ timeout: 0 });
    const cleanup = new SQL(ADMIN_URL!, { max: 1, prepare: false });
    await cleanup.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await cleanup.close({ timeout: 0 });
  });

  test("rejects a direct yellow_runtime login against the production-75 predecessor", async () => {
    const predecessorRuntime = new SQL(runtimeDatabaseUrl, { max: 1, prepare: false });
    try {
      const error = await readinessFailure(assertRuntimeReleaseReadiness(predecessorRuntime));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await predecessorRuntime.close({ timeout: 0 });
    }
  });

  test("accepts only a direct yellow_runtime login against the complete release-77 catalogue", async () => {
    await ensureRelease77();
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects the deployment login", async () => {
    await ensureRelease77();
    const error = await readinessFailure(assertRuntimeReleaseReadiness(deployment!));
    expect(error.message).toBe("runtime release readiness is unavailable");
  });

  test("rejects a privileged deployment session after SET ROLE yellow_runtime", async () => {
    await ensureRelease77();
    const connection = await deployment!.reserve();
    try {
      await connection.unsafe("BEGIN");
      await connection.unsafe("SET LOCAL ROLE yellow_runtime");
      const error = await readinessFailure(assertRuntimeReleaseReadiness(connection));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await connection.unsafe("ROLLBACK");
      connection.release();
    }
  });
});
