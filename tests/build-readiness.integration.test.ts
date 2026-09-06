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
const databaseName = `yellow_order440_readiness_${crypto.randomUUID().replaceAll("-", "")}`;
let administrator: SQL | undefined;
let deployment: SQL | undefined;
let runtime: SQL | undefined;
let deploymentDatabaseUrl = "";
let runtimeDatabaseUrl = "";
let currentReleaseReady = false;

async function readinessFailure(operation: Promise<void>): Promise<Error> {
  try {
    await operation;
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error("runtime readiness rejected with a non-Error value");
  }
  throw new Error("runtime readiness unexpectedly succeeded");
}

async function ensureCurrentRelease(): Promise<void> {
  if (currentReleaseReady) return;
  const result = await runMigrations({ databaseUrl: deploymentDatabaseUrl, logger: () => undefined });
  expect(result.appliedFiles).toEqual([
    "0080_fiscal_submission_delivery_runtime.sql",
  ]);
  deployment = new SQL(deploymentDatabaseUrl, { max: 1, prepare: false });
  runtime = new SQL(runtimeDatabaseUrl, { max: 1, prepare: false });
  currentReleaseReady = true;
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

    const predecessorDirectory = await mkdtemp(join(tmpdir(), "yellow-order440-readiness-75-"));
    try {
      const names = (await readdir(MIGRATIONS)).filter(name =>
        name.endsWith(".sql") && Number(name.slice(0, 4)) <= 75);
      await Promise.all(names.map(async name => writeFile(resolve(predecessorDirectory, name),
        await readFile(resolve(MIGRATIONS, name)))));
      await runMigrations({ databaseUrl: deploymentUrl.toString(),
        migrationsDirectory: predecessorDirectory, logger: () => undefined });
    } finally {
      if (!resolve(predecessorDirectory).startsWith(resolve(tmpdir()) + "/")
          && !resolve(predecessorDirectory).startsWith(resolve(tmpdir()) + "\\")) {
        throw new Error("readiness proof cleanup escaped temporary directory");
      }
      await rm(predecessorDirectory, { recursive: true, force: true });
    }
    await administrator.close({ timeout: 5 });
    administrator = undefined;
  }, 120_000);

  afterAll(async () => {
    await runtime?.close({ timeout: 5 });
    await deployment?.close({ timeout: 5 });
    await administrator?.close({ timeout: 5 });
    const cleanup = new SQL(ADMIN_URL!, { max: 1, prepare: false });
    await cleanup.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await cleanup.close({ timeout: 5 });
  });

  test("rejects a direct yellow_runtime login against the production-75 predecessor", async () => {
    const predecessorRuntime = new SQL(runtimeDatabaseUrl, { max: 1, prepare: false });
    try {
      const error = await readinessFailure(assertRuntimeReleaseReadiness(predecessorRuntime));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await predecessorRuntime.close({ timeout: 5 });
    }
  });

  test("rejects a direct yellow_runtime login against the complete release-77 predecessor", async () => {
    const prefixDirectory = await mkdtemp(join(tmpdir(), "yellow-order440-readiness-77-"));
    try {
      const names = (await readdir(MIGRATIONS)).filter(name =>
        name.endsWith(".sql") && Number(name.slice(0, 4)) <= 77);
      await Promise.all(names.map(async name => writeFile(resolve(prefixDirectory, name),
        await readFile(resolve(MIGRATIONS, name)))));
      const result = await runMigrations({ databaseUrl: deploymentDatabaseUrl,
        migrationsDirectory: prefixDirectory, logger: () => undefined });
      expect(result.appliedFiles).toEqual([
        "0076_india_native_fiscal_source_evidence.sql",
        "0077_india_native_fiscal_source_completion.sql",
      ]);
    } finally {
      if (!resolve(prefixDirectory).startsWith(resolve(tmpdir()) + "/")
          && !resolve(prefixDirectory).startsWith(resolve(tmpdir()) + "\\")) {
        throw new Error("readiness proof cleanup escaped temporary directory");
      }
      await rm(prefixDirectory, { recursive: true, force: true });
    }
    const predecessorRuntime = new SQL(runtimeDatabaseUrl, { max: 1, prepare: false });
    try {
      const error = await readinessFailure(assertRuntimeReleaseReadiness(predecessorRuntime));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await predecessorRuntime.close({ timeout: 5 });
    }
  });

  test("rejects the exact release-79 predecessor without runtime discovery", async () => {
    const prefixDirectory = await mkdtemp(join(tmpdir(), "yellow-order440-readiness-79-"));
    try {
      const names = (await readdir(MIGRATIONS)).filter(name =>
        name.endsWith(".sql") && Number(name.slice(0, 4)) <= 79);
      await Promise.all(names.map(async name => writeFile(resolve(prefixDirectory, name),
        await readFile(resolve(MIGRATIONS, name)))));
      const result = await runMigrations({ databaseUrl: deploymentDatabaseUrl,
        migrationsDirectory: prefixDirectory, logger: () => undefined });
      expect(result.appliedFiles).toEqual([
        "0078_fiscal_submission_durability.sql",
        "0079_fiscal_immutable_command_receipts.sql",
      ]);
    } finally {
      if (!resolve(prefixDirectory).startsWith(resolve(tmpdir()) + "/")
          && !resolve(prefixDirectory).startsWith(resolve(tmpdir()) + "\\")) {
        throw new Error("readiness proof cleanup escaped temporary directory");
      }
      await rm(prefixDirectory, { recursive: true, force: true });
    }
    const predecessorDeployment = new SQL(deploymentDatabaseUrl, { max: 1, prepare: false });
    const predecessorRuntime = new SQL(runtimeDatabaseUrl, { max: 1, prepare: false });
    try {
      const [identity] = await predecessorDeployment<{
        applied: number; frontier: number; discovery: string | null;
      }[]>`
        SELECT count(*)::integer AS applied,max(version)::integer AS frontier,
               to_regprocedure('public.runtime_due_india_fiscal_submissions(integer,uuid,uuid)')::text AS discovery
          FROM public.schema_migration
      `;
      expect(identity).toEqual({ applied: 79, frontier: 79, discovery: null });
      const error = await readinessFailure(assertRuntimeReleaseReadiness(predecessorRuntime));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await predecessorRuntime.close({ timeout: 5 });
      await predecessorDeployment.close({ timeout: 5 });
    }
  });

  test("accepts only a direct yellow_runtime login against the complete current catalogue", async () => {
    await ensureCurrentRelease();
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects the deployment login", async () => {
    await ensureCurrentRelease();
    const error = await readinessFailure(assertRuntimeReleaseReadiness(deployment!));
    expect(error.message).toBe("runtime release readiness is unavailable");
  });

  test("rejects a privileged deployment session after SET ROLE yellow_runtime", async () => {
    await ensureCurrentRelease();
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

  test("rejects history without FORCE RLS and proves restoration", async () => {
    await ensureCurrentRelease();
    try {
      await deployment!.unsafe("ALTER TABLE public.fiscal_submission_history NO FORCE ROW LEVEL SECURITY");
      const error = await readinessFailure(assertRuntimeReleaseReadiness(runtime!));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await deployment!.unsafe("ALTER TABLE public.fiscal_submission_history FORCE ROW LEVEL SECURITY");
    }
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects permissive additional policy and proves restoration", async () => {
    await ensureCurrentRelease();
    try {
      await deployment!.unsafe("CREATE POLICY order440_readiness_probe ON public.fiscal_submission_history USING (true) WITH CHECK (true)");
      const error = await readinessFailure(assertRuntimeReleaseReadiness(runtime!));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await deployment!.unsafe("DROP POLICY IF EXISTS order440_readiness_probe ON public.fiscal_submission_history");
    }
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects modified tenant predicate and proves restoration", async () => {
    await ensureCurrentRelease();
    try {
      await deployment!.unsafe("ALTER POLICY tenant_isolation ON public.fiscal_submission_history USING (true) WITH CHECK (true)");
      const error = await readinessFailure(assertRuntimeReleaseReadiness(runtime!));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await deployment!.unsafe(`ALTER POLICY tenant_isolation ON public.fiscal_submission_history
        USING (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid)
        WITH CHECK (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid)`);
    }
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects public history access and proves restoration", async () => {
    await ensureCurrentRelease();
    try {
      await deployment!.unsafe("GRANT SELECT ON public.fiscal_submission_history TO PUBLIC");
      const error = await readinessFailure(assertRuntimeReleaseReadiness(runtime!));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await deployment!.unsafe("REVOKE SELECT ON public.fiscal_submission_history FROM PUBLIC");
    }
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects fiscal function configuration drift and proves restoration", async () => {
    await ensureCurrentRelease();
    const signature = "public.request_india_fiscal_submission(uuid,uuid,uuid,uuid,uuid,text,uuid)";
    try {
      await deployment!.unsafe(`ALTER FUNCTION ${signature} SET TimeZone='Asia/Kolkata'`);
      const error = await readinessFailure(assertRuntimeReleaseReadiness(runtime!));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await deployment!.unsafe(`ALTER FUNCTION ${signature} SET TimeZone='UTC'`);
    }
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects wrong request authority and proves restoration", async () => {
    await ensureCurrentRelease();
    const signature = "public.request_india_fiscal_submission(uuid,uuid,uuid,uuid,uuid,text,uuid)";
    try {
      await deployment!.unsafe(`GRANT EXECUTE ON FUNCTION ${signature} TO yellow_runtime`);
      const error = await readinessFailure(assertRuntimeReleaseReadiness(runtime!));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await deployment!.unsafe(`REVOKE EXECUTE ON FUNCTION ${signature} FROM yellow_runtime`);
    }
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects public claim capability and proves restoration", async () => {
    await ensureCurrentRelease();
    const signature = "public.claim_india_fiscal_submission(uuid,uuid,integer)";
    try {
      await deployment!.unsafe(`GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC`);
      const error = await readinessFailure(assertRuntimeReleaseReadiness(runtime!));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await deployment!.unsafe(`REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC`);
    }
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects public discovery capability and proves restoration", async () => {
    await ensureCurrentRelease();
    const signature = "public.runtime_due_india_fiscal_submissions(integer,uuid,uuid)";
    try {
      await deployment!.unsafe(`GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC`);
      const error = await readinessFailure(assertRuntimeReleaseReadiness(runtime!));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await deployment!.unsafe(`REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC`);
    }
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects application-role discovery capability and proves restoration", async () => {
    await ensureCurrentRelease();
    const signature = "public.runtime_due_india_fiscal_submissions(integer,uuid,uuid)";
    try {
      await deployment!.unsafe(`GRANT EXECUTE ON FUNCTION ${signature} TO app_role`);
      const error = await readinessFailure(assertRuntimeReleaseReadiness(runtime!));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await deployment!.unsafe(`REVOKE EXECUTE ON FUNCTION ${signature} FROM app_role`);
    }
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects discovery function configuration drift and proves restoration", async () => {
    await ensureCurrentRelease();
    const signature = "public.runtime_due_india_fiscal_submissions(integer,uuid,uuid)";
    try {
      await deployment!.unsafe(`ALTER FUNCTION ${signature} SET TimeZone='Asia/Kolkata'`);
      const error = await readinessFailure(assertRuntimeReleaseReadiness(runtime!));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await deployment!.unsafe(`ALTER FUNCTION ${signature} SET TimeZone='UTC'`);
    }
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });
});
