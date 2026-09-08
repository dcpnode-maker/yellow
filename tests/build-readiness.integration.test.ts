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
let originalProjectorDefinition = "";
const CREDIT_PROJECTOR = "public.india_fiscal_submission_project_wire(uuid,uuid,uuid)";
const CREDIT_PROJECTOR_BODY_SHA = "b34eaf0095dad0df5cd55453b7e4bd1a42f5ae698a02c5ebca3dcac7645c9f96";
const BODY_DRIFT_COMMENT = "-- unrelated body drift must also fail closed";

function appendLiteralBodyDrift(definition: string, body: string): string {
  return definition.replace(body, literalBody => `${literalBody}\n${BODY_DRIFT_COMMENT}\n`);
}

test("projector body drift preserves JavaScript replacement-token bytes", () => {
  const body = "BEGIN\n  IF value~'^[0-9]+$' THEN value:='$$'; END IF;\nEND";
  const definition = `CREATE FUNCTION probe() RETURNS void AS $function$\n${body}\n$function$;`;
  expect(appendLiteralBodyDrift(definition, body)).toBe(
    `CREATE FUNCTION probe() RETURNS void AS $function$\n${body}\n${BODY_DRIFT_COMMENT}\n\n$function$;`,
  );
});

async function projectorCatalogue(): Promise<string> {
  const [row] = await deployment!<{ snapshot: string }[]>`
    SELECT jsonb_build_object('definition',pg_catalog.pg_get_functiondef(procedure.oid),
      'owner',procedure.proowner,'acl',procedure.proacl,'config',procedure.proconfig,
      'language',procedure.prolang,'kind',procedure.prokind,'result',procedure.prorettype,
      'arguments',procedure.proargtypes,'allArguments',procedure.proallargtypes,
      'defaults',procedure.proargdefaults,'variadic',procedure.provariadic,
      'security',procedure.prosecdef,'volatility',procedure.provolatile,
      'strict',procedure.proisstrict,'setReturning',procedure.proretset,
      'parallel',procedure.proparallel,'leakproof',procedure.proleakproof)::text snapshot
    FROM pg_catalog.pg_proc procedure WHERE procedure.oid=pg_catalog.to_regprocedure(${CREDIT_PROJECTOR})
  `;
  if (!row) throw new Error("Projector restoration snapshot is missing");
  return row.snapshot;
}

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
  expect(result.appliedFiles).toEqual(["0088_native_credit_fiscal_submission.sql"]);
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

  test("rejects the release-80 predecessor without protected receipt retrieval", async () => {
    const prefixDirectory = await mkdtemp(join(tmpdir(), "yellow-order440-readiness-80-"));
    try {
      const names = (await readdir(MIGRATIONS)).filter(name =>
        name.endsWith(".sql") && Number(name.slice(0, 4)) <= 80);
      await Promise.all(names.map(async name => writeFile(resolve(prefixDirectory, name),
        await readFile(resolve(MIGRATIONS, name)))));
      const result = await runMigrations({ databaseUrl: deploymentDatabaseUrl,
        migrationsDirectory: prefixDirectory, logger: () => undefined });
      expect(result.appliedFiles).toEqual(["0080_fiscal_submission_delivery_runtime.sql"]);
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
    } finally { await predecessorRuntime.close({ timeout: 5 }); }
  });

  test("rejects the exact release-85 predecessor without durable retry binding", async () => {
    const prefixDirectory = await mkdtemp(join(tmpdir(), "yellow-order440-readiness-85-"));
    try {
      const names = (await readdir(MIGRATIONS)).filter(name =>
        name.endsWith(".sql") && Number(name.slice(0, 4)) <= 85);
      await Promise.all(names.map(async name => writeFile(resolve(prefixDirectory, name),
        await readFile(resolve(MIGRATIONS, name)))));
      const result = await runMigrations({ databaseUrl: deploymentDatabaseUrl,
        migrationsDirectory: prefixDirectory, logger: () => undefined });
      expect(result.appliedFiles).toEqual([
        "0081_fiscal_signed_delivery_receipts.sql",
        "0082_india_native_fiscal_operator_workflow.sql",
        "0083_india_native_fiscal_operator_calendar_bounds.sql",
        "0084_india_native_fiscal_operator_query_execution.sql",
        "0085_india_native_fiscal_operator_command.sql",
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
        applied: number; frontier: number; retry_binding: string | null;
      }[]>`
        SELECT count(*)::integer AS applied,max(version)::integer AS frontier,
               to_regprocedure('public.india_fiscal_submission_retry_binding_v1(text,text,text,uuid,integer)')::text
                 AS retry_binding
          FROM public.schema_migration
      `;
      expect(identity).toEqual({ applied: 85, frontier: 85, retry_binding: null });
      const error = await readinessFailure(assertRuntimeReleaseReadiness(predecessorRuntime));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await predecessorRuntime.close({ timeout: 5 });
      await predecessorDeployment.close({ timeout: 5 });
    }
  });

  test("rejects the populated release-86 predecessor without the credit-note authority", async () => {
    const prefixDirectory = await mkdtemp(join(tmpdir(), "yellow-order446-readiness-86-"));
    try {
      const names = (await readdir(MIGRATIONS)).filter(name =>
        name.endsWith(".sql") && Number(name.slice(0, 4)) <= 86);
      await Promise.all(names.map(async name => writeFile(resolve(prefixDirectory, name),
        await readFile(resolve(MIGRATIONS, name)))));
      const result = await runMigrations({ databaseUrl: deploymentDatabaseUrl,
        migrationsDirectory: prefixDirectory, logger: () => undefined });
      expect(result.appliedFiles).toEqual(["0086_fiscal_submission_retry_binding.sql"]);
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
        applied: number; frontier: number; credit_binding: string | null;
        credit_commit: string | null;
      }[]>`
        SELECT count(*)::integer AS applied,max(version)::integer AS frontier,
               to_regclass('public.india_native_fiscal_credit_note')::text AS credit_binding,
               to_regprocedure('public.commit_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid,text,text,uuid)')::text
                 AS credit_commit
          FROM public.schema_migration
      `;
      expect(identity).toEqual({ applied: 86, frontier: 86, credit_binding: null, credit_commit: null });
      const error = await readinessFailure(assertRuntimeReleaseReadiness(predecessorRuntime));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally {
      await predecessorRuntime.close({ timeout: 5 });
      await predecessorDeployment.close({ timeout: 5 });
    }
  });

  test("rejects original canonical87 without the exact credit fiscal projector", async () => {
    const prefixDirectory = await mkdtemp(join(tmpdir(), "yellow-order447-readiness-87-"));
    try {
      const names = (await readdir(MIGRATIONS)).filter(name =>
        name.endsWith(".sql") && Number(name.slice(0, 4)) <= 87);
      expect(names).toHaveLength(87);
      await Promise.all(names.map(async name => writeFile(resolve(prefixDirectory, name),
        await readFile(resolve(MIGRATIONS, name)))));
      const result = await runMigrations({ databaseUrl: deploymentDatabaseUrl,
        migrationsDirectory: prefixDirectory, logger: () => undefined });
      expect(result.appliedFiles).toEqual(["0087_india_native_fiscal_credit_note.sql"]);
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
        frontier: number; checksum: string; body_sha: string; definition: string;
      }[]>`
        SELECT (SELECT max(version)::int FROM public.schema_migration) frontier,
          (SELECT checksum_sha256 FROM public.schema_migration WHERE version=87) checksum,
          pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
            pg_catalog.replace(prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex') body_sha,
          pg_catalog.pg_get_functiondef(oid) definition
        FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(${CREDIT_PROJECTOR})
      `;
      expect(identity?.frontier).toBe(87);
      expect(identity?.checksum).toBe("c8b4ada5702807a0705a13e888e95730e0dbcc8ac7796e0ad2358208a5f873ba");
      expect(identity?.body_sha).toBe("ca6b253d5fd162f4ff79aa810d479c14cf5e11692ffbfcec2732d4f34c8a3cd0");
      originalProjectorDefinition = identity!.definition;
      await expect(assertRuntimeReleaseReadiness(predecessorRuntime)).rejects.toThrow(
        "runtime release readiness is unavailable",
      );
    } finally {
      await predecessorRuntime.close({ timeout: 5 });
      await predecessorDeployment.close({ timeout: 5 });
    }
  });

  test("accepts only a direct yellow_runtime login against canonical88", async () => {
    await ensureCurrentRelease();
    const [identity] = await deployment!<{ frontier: number; checksum: string; body_sha: string }[]>`
      SELECT (SELECT max(version)::int FROM public.schema_migration) frontier,
        (SELECT checksum_sha256 FROM public.schema_migration WHERE version=88) checksum,
        pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
          pg_catalog.replace(prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex') body_sha
      FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(${CREDIT_PROJECTOR})
    `;
    expect(identity).toEqual({ frontier: 88,
      checksum: "214754e94bdfb0a2163395c9ab4449b0b5e87da7830c45e69d77ac05a2cddb64",
      body_sha: CREDIT_PROJECTOR_BODY_SHA });
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects Order447 projector metadata, private ACL and body drift with exact restoration", async () => {
    await ensureCurrentRelease();
    const before = await projectorCatalogue();
    const [row] = await deployment!<{ definition: string; body: string }[]>`
      SELECT pg_catalog.pg_get_functiondef(oid) definition,prosrc body
      FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(${CREDIT_PROJECTOR})
    `;
    expect(row).toBeDefined();
    expect(originalProjectorDefinition).toContain("CREATE OR REPLACE FUNCTION");
    const definition = row!.definition;
    const mutations = [
      `ALTER FUNCTION ${CREDIT_PROJECTOR} STABLE`,
      `ALTER FUNCTION ${CREDIT_PROJECTOR} STRICT`,
      `ALTER FUNCTION ${CREDIT_PROJECTOR} PARALLEL SAFE`,
      `ALTER FUNCTION ${CREDIT_PROJECTOR} SECURITY DEFINER`,
      `ALTER FUNCTION ${CREDIT_PROJECTOR} SET search_path TO pg_catalog,public`,
      `ALTER FUNCTION ${CREDIT_PROJECTOR} SET TimeZone TO 'Asia/Kolkata'`,
      `ALTER FUNCTION ${CREDIT_PROJECTOR} SET DateStyle TO 'SQL,DMY'`,
      `ALTER FUNCTION ${CREDIT_PROJECTOR} OWNER TO yellow_deploy`,
      ...["PUBLIC", "app_role", "yellow_runtime", "yellow_deploy"].map(role =>
        `GRANT EXECUTE ON FUNCTION ${CREDIT_PROJECTOR} TO ${role}`),
      originalProjectorDefinition,
      appendLiteralBodyDrift(definition, row!.body),
    ];
    for (const mutate of mutations) {
      try {
        await deployment!.unsafe(mutate);
        await expect(assertRuntimeReleaseReadiness(runtime!)).rejects.toThrow(
          "runtime release readiness is unavailable",
        );
      } finally {
        await deployment!.begin(async transaction => {
          await transaction.unsafe(definition);
          await transaction.unsafe(`ALTER FUNCTION ${CREDIT_PROJECTOR} OWNER TO yellow_owner`);
          await transaction.unsafe("SET LOCAL ROLE yellow_owner");
          await transaction.unsafe(`REVOKE ALL ON FUNCTION ${CREDIT_PROJECTOR} FROM PUBLIC,app_role,yellow_runtime,yellow_deploy`);
          await transaction.unsafe(`GRANT EXECUTE ON FUNCTION ${CREDIT_PROJECTOR} TO yellow_owner`);
        });
      }
      expect(await projectorCatalogue()).toBe(before);
      await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
    }
  });

  test("rejects missing or substituted projector identity while retaining its original object", async () => {
    await ensureCurrentRelease();
    const before = await projectorCatalogue();
    const savedSignature = "public.order447_readiness_saved_projector(uuid,uuid,uuid)";
    // Rename keeps the real object's OID/ACL/body intact; substitutes have no dependants.
    for (const substitute of [null, "text", "SETOF jsonb", "jsonb"]) {
      let renamed = false;
      try {
        await deployment!.begin(async transaction => {
          await transaction.unsafe(`ALTER FUNCTION ${CREDIT_PROJECTOR} RENAME TO order447_readiness_saved_projector`);
          if (substitute !== null) {
            await transaction.unsafe(`CREATE FUNCTION ${CREDIT_PROJECTOR} RETURNS ${substitute}
              LANGUAGE sql VOLATILE CALLED ON NULL INPUT SECURITY INVOKER PARALLEL UNSAFE
              SET search_path TO pg_catalog,public,pg_temp SET TimeZone TO 'UTC' SET DateStyle TO 'ISO,YMD'
              AS 'SELECT NULL::${substitute === "text" ? "text" : "jsonb"}'`);
            await transaction.unsafe(`ALTER FUNCTION ${CREDIT_PROJECTOR} OWNER TO yellow_owner`);
            await transaction.unsafe(`REVOKE ALL ON FUNCTION ${CREDIT_PROJECTOR} FROM PUBLIC,app_role,yellow_runtime`);
          }
        });
        renamed = true;
        await expect(assertRuntimeReleaseReadiness(runtime!)).rejects.toThrow(
          "runtime release readiness is unavailable",
        );
      } finally {
        if (renamed) {
          await deployment!.begin(async transaction => {
            await transaction.unsafe(`DROP FUNCTION IF EXISTS ${CREDIT_PROJECTOR}`);
            await transaction.unsafe(`ALTER FUNCTION ${savedSignature} RENAME TO india_fiscal_submission_project_wire`);
          });
        }
      }
      expect(await projectorCatalogue()).toBe(before);
      await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
    }
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

  test("rejects read capability authority and volatility drift and proves restoration", async () => {
    await ensureCurrentRelease();
    const signature = "public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)";
    for (const role of ["PUBLIC", "yellow_runtime"]) {
      try {
        await deployment!.unsafe(`GRANT EXECUTE ON FUNCTION ${signature} TO ${role}`);
        const error = await readinessFailure(assertRuntimeReleaseReadiness(runtime!));
        expect(error.message).toBe("runtime release readiness is unavailable");
      } finally { await deployment!.unsafe(`REVOKE EXECUTE ON FUNCTION ${signature} FROM ${role}`); }
    }
    try {
      await deployment!.unsafe(`ALTER FUNCTION ${signature} VOLATILE`);
      const error = await readinessFailure(assertRuntimeReleaseReadiness(runtime!));
      expect(error.message).toBe("runtime release readiness is unavailable");
    } finally { await deployment!.unsafe(`ALTER FUNCTION ${signature} STABLE`); }
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects retry-binding metadata and ACL drift and proves restoration", async () => {
    await ensureCurrentRelease();
    const signature = "public.india_fiscal_submission_retry_binding_v1(text,text,text,uuid,integer)";
    for (const role of ["PUBLIC", "app_role", "yellow_runtime"]) {
      try {
        await deployment!.unsafe(`GRANT EXECUTE ON FUNCTION ${signature} TO ${role}`);
        await expect(assertRuntimeReleaseReadiness(runtime!)).rejects.toThrow(
          "runtime release readiness is unavailable",
        );
      } finally {
        await deployment!.unsafe(`REVOKE EXECUTE ON FUNCTION ${signature} FROM ${role}`);
      }
      await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
    }
    const metadataDrifts = [
      [`ALTER FUNCTION ${signature} STABLE`, `ALTER FUNCTION ${signature} IMMUTABLE`],
      [`ALTER FUNCTION ${signature} STRICT`, `ALTER FUNCTION ${signature} CALLED ON NULL INPUT`],
      [`ALTER FUNCTION ${signature} PARALLEL SAFE`, `ALTER FUNCTION ${signature} PARALLEL UNSAFE`],
      [`ALTER FUNCTION ${signature} SECURITY DEFINER`, `ALTER FUNCTION ${signature} SECURITY INVOKER`],
      [`ALTER FUNCTION ${signature} SET search_path TO public`,
        `ALTER FUNCTION ${signature} SET search_path TO pg_catalog, public`],
    ] as const;
    for (const [mutate, restore] of metadataDrifts) {
      try {
        await deployment!.unsafe(mutate);
        await expect(assertRuntimeReleaseReadiness(runtime!)).rejects.toThrow(
          "runtime release readiness is unavailable",
        );
      } finally { await deployment!.unsafe(restore); }
      await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
    }
  });

  test("rejects Order446 credit-note catalogue drift and restores exact readiness", async () => {
    await ensureCurrentRelease();
    const commit = "public.commit_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid,text,text,uuid)";
    const templates = "public.india_native_credit_line_templates(uuid,uuid)";
    const cases: ReadonlyArray<Readonly<{
      mutate: readonly string[];
      restore: readonly string[];
    }>> = [
      {
        mutate: ["ALTER TABLE public.india_native_fiscal_credit_note NO FORCE ROW LEVEL SECURITY"],
        restore: ["ALTER TABLE public.india_native_fiscal_credit_note FORCE ROW LEVEL SECURITY"],
      },
      {
        mutate: ["ALTER POLICY tenant_isolation ON public.india_native_fiscal_credit_note USING (true) WITH CHECK (true)"],
        restore: [`ALTER POLICY tenant_isolation ON public.india_native_fiscal_credit_note
          USING (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid)
          WITH CHECK (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid)`],
      },
      {
        mutate: ["GRANT INSERT ON public.india_native_fiscal_credit_note TO app_role"],
        restore: ["REVOKE INSERT ON public.india_native_fiscal_credit_note FROM app_role"],
      },
      {
        mutate: [
          "ALTER TABLE public.india_native_fiscal_credit_note DROP CONSTRAINT india_native_fiscal_credit_note_check",
          `ALTER TABLE public.india_native_fiscal_credit_note
            ADD CONSTRAINT india_native_fiscal_credit_note_check CHECK (true)`,
        ],
        restore: [
          "ALTER TABLE public.india_native_fiscal_credit_note DROP CONSTRAINT india_native_fiscal_credit_note_check",
          `ALTER TABLE public.india_native_fiscal_credit_note
            ADD CONSTRAINT india_native_fiscal_credit_note_check CHECK (document_id<>original_document_id)`,
        ],
      },
      {
        mutate: ["DROP INDEX public.india_native_credit_property"],
        restore: [`CREATE INDEX india_native_credit_property
          ON public.india_native_fiscal_credit_note
          (tenant_id,property_node,business_date,document_id)`],
      },
      {
        mutate: [`ALTER FUNCTION ${commit} SET search_path TO public`],
        restore: [`ALTER FUNCTION ${commit} SET search_path TO pg_catalog,public,pg_temp`],
      },
      {
        mutate: [`GRANT EXECUTE ON FUNCTION ${commit} TO yellow_runtime`],
        restore: [`REVOKE EXECUTE ON FUNCTION ${commit} FROM yellow_runtime`],
      },
      {
        mutate: [`ALTER FUNCTION ${templates} STABLE`],
        restore: [`ALTER FUNCTION ${templates} VOLATILE`],
      },
      {
        mutate: [
          "DROP TRIGGER india_native_credit_complete ON public.india_native_fiscal_credit_note",
          `CREATE CONSTRAINT TRIGGER india_native_credit_complete
            AFTER INSERT ON public.india_native_fiscal_credit_note
            DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW
            EXECUTE FUNCTION public.assert_india_native_credit_complete()`,
        ],
        restore: [
          "DROP TRIGGER IF EXISTS india_native_credit_complete ON public.india_native_fiscal_credit_note",
          `CREATE CONSTRAINT TRIGGER india_native_credit_complete
            AFTER INSERT ON public.india_native_fiscal_credit_note
            DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
            EXECUTE FUNCTION public.assert_india_native_credit_complete()`,
        ],
      },
    ];
    for (const probe of cases) {
      try {
        for (const statement of probe.mutate) await deployment!.unsafe(statement);
        await expect(assertRuntimeReleaseReadiness(runtime!)).rejects.toThrow(
          "runtime release readiness is unavailable",
        );
      } finally {
        for (const statement of probe.restore) await deployment!.unsafe(statement);
      }
      await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
    }
  });

  test("rejects effective extra head and history column grants and proves restoration", async () => {
    await ensureCurrentRelease();
    const forbidden = [
      ["fiscal_submission", "wire_text", "app_role"],
      ["fiscal_submission", "claim_token_hash", "PUBLIC"],
      ["fiscal_submission", "status", "yellow_runtime"],
      ["fiscal_submission_history", "response_sha256", "app_role"],
      ["fiscal_submission_history", "claim_token_hash", "PUBLIC"],
    ] as const;
    for (const [table, column, role] of forbidden) {
      try {
        await deployment!.unsafe(`GRANT SELECT(${column}) ON public.${table} TO ${role}`);
        const error = await readinessFailure(assertRuntimeReleaseReadiness(runtime!));
        expect(error.message).toBe("runtime release readiness is unavailable");
      } finally { await deployment!.unsafe(`REVOKE SELECT(${column}) ON public.${table} FROM ${role}`); }
      await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
    }
  });

  test("rejects Q208 public and private capability authority drift and proves restoration", async () => {
    await ensureCurrentRelease();
    const publicSignature = "public.prepare_india_native_fiscal_invoice_v4(uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid,text,text)";
    const privateSignature = "public.read_india_native_document_context_candidate(uuid,uuid,uuid,uuid,uuid,uuid)";
    try {
      await deployment!.unsafe(`GRANT EXECUTE ON FUNCTION ${publicSignature} TO yellow_runtime`);
      await expect(assertRuntimeReleaseReadiness(runtime!)).rejects.toThrow("runtime release readiness is unavailable");
    } finally {
      await deployment!.unsafe(`REVOKE EXECUTE ON FUNCTION ${publicSignature} FROM yellow_runtime`);
    }
    try {
      await deployment!.unsafe(`GRANT EXECUTE ON FUNCTION ${privateSignature} TO app_role`);
      await expect(assertRuntimeReleaseReadiness(runtime!)).rejects.toThrow("runtime release readiness is unavailable");
    } finally {
      await deployment!.unsafe(`REVOKE EXECUTE ON FUNCTION ${privateSignature} FROM app_role`);
    }
    try {
      await deployment!.unsafe(`ALTER FUNCTION ${publicSignature} SET TimeZone='Asia/Kolkata'`);
      await expect(assertRuntimeReleaseReadiness(runtime!)).rejects.toThrow("runtime release readiness is unavailable");
    } finally {
      await deployment!.unsafe(`ALTER FUNCTION ${publicSignature} SET TimeZone='UTC'`);
    }
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects a missing Q208 index or permission entry and proves restoration", async () => {
    await ensureCurrentRelease();
    try {
      await deployment!.unsafe("DROP INDEX public.india_native_operator_submission_document");
      await expect(assertRuntimeReleaseReadiness(runtime!)).rejects.toThrow("runtime release readiness is unavailable");
    } finally {
      await deployment!.unsafe(`CREATE INDEX india_native_operator_submission_document
        ON public.fiscal_submission(tenant_id,property_node,document_id,id)`);
    }
    for (const wrongOrdering of [
      "business_date ASC,issued_at DESC,id DESC",
      "business_date DESC NULLS LAST,issued_at DESC,id DESC",
    ]) {
      try {
        await deployment!.unsafe("DROP INDEX public.india_native_operator_document_queue");
        await deployment!.unsafe(`CREATE INDEX india_native_operator_document_queue
          ON public.document(tenant_id,property_node,${wrongOrdering})
          WHERE kind='invoice' AND status='issued'`);
        await expect(assertRuntimeReleaseReadiness(runtime!)).rejects.toThrow("runtime release readiness is unavailable");
      } finally {
        await deployment!.unsafe("DROP INDEX IF EXISTS public.india_native_operator_document_queue");
        await deployment!.unsafe(`CREATE INDEX india_native_operator_document_queue
          ON public.document(tenant_id,property_node,business_date DESC,issued_at DESC,id DESC)
          WHERE kind='invoice' AND status='issued'`);
      }
      await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
    }
    try {
      await deployment!`DELETE FROM public.permission WHERE code='tax-fiscal.documents:read'`;
      await expect(assertRuntimeReleaseReadiness(runtime!)).rejects.toThrow("runtime release readiness is unavailable");
    } finally {
      await deployment!`INSERT INTO public.permission(code,description) VALUES
        ('tax-fiscal.documents:read','Read property-authorized immutable fiscal documents')
        ON CONFLICT(code) DO UPDATE SET description=EXCLUDED.description`;
    }
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });
});
