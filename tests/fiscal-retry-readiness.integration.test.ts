import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { createHash } from "node:crypto";

import { assertRuntimeReleaseReadiness, CURRENT_MIGRATION_FRONTIER } from "../src/kernel";

const DEPLOY_URL = process.env.YELLOW_ORDER440_Q212_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER440_Q212_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_ORDER440_Q212_DATABASE === "1";
const MIGRATION_86_SHA256 = "40c55de6a34fb0f0ba354e5e37d210500038018fa649cf9437e29813fa0b915e";
const HELPER_SIGNATURE =
  "public.india_fiscal_submission_retry_binding_v1(text,text,text,uuid,integer)";
const HELPER_DECLARATION = `public.india_fiscal_submission_retry_binding_v1(
  p_status text,p_disposition text,p_reconciliation_reason text,
  p_provider_extension_id uuid,p_provider_extension_version integer
)`;
const RECEIPT_SIGNATURE =
  "public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)";

interface ProofTarget {
  readonly authority: string;
  readonly database: string;
}

function parseTarget(value: string, expectedRole: "yellow_deploy" | "yellow_runtime"): ProofTarget {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Q212 readiness proof target is invalid");
  }
  let username: string;
  let database: string;
  try {
    username = decodeURIComponent(parsed.username);
    database = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error("Q212 readiness proof target is invalid");
  }
  const authorityStart = value.indexOf("://") + 3;
  const pathStart = value.indexOf("/", authorityStart);
  const rawPath = pathStart < 0 ? "" : value.slice(pathStart);
  const port = parsed.port === "" ? 5432 : Number(parsed.port);
  if (!/^(?:postgres|postgresql):$/.test(parsed.protocol)
    || !["127.0.0.1", "[::1]"].includes(parsed.hostname.toLowerCase())
    || !Number.isSafeInteger(port) || port < 1 || port > 65_535
    || username !== expectedRole || parsed.username !== expectedRole || parsed.password === ""
    || parsed.pathname !== `/${database}` || rawPath !== `/${database}`
    || parsed.search !== "" || parsed.hash !== ""
    || !/^yellow_order440_q212_[a-z0-9_]+$/.test(database)) {
    throw new Error("Q212 readiness proof target is invalid");
  }
  return Object.freeze({
    authority: `${parsed.hostname.toLowerCase()}:${port}`,
    database,
  });
}

function assertSameTarget(deployUrl: string, runtimeUrl: string): ProofTarget {
  const deploy = parseTarget(deployUrl, "yellow_deploy");
  const runtime = parseTarget(runtimeUrl, "yellow_runtime");
  if (deploy.authority !== runtime.authority || deploy.database !== runtime.database) {
    throw new Error("Q212 readiness deploy and runtime URLs must identify one target");
  }
  return deploy;
}

if (REQUIRED && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Q212 readiness proof requires explicit deploy and runtime URLs");
}
if ((DEPLOY_URL || RUNTIME_URL) && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Q212 readiness proof requires both deploy and runtime URLs");
}
const configuredTarget = DEPLOY_URL && RUNTIME_URL
  ? assertSameTarget(DEPLOY_URL, RUNTIME_URL)
  : undefined;
const databaseDescribe = configuredTarget ? describe.serial : describe.skip;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function readinessFailure(operation: Promise<void>): Promise<Error> {
  try {
    await operation;
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error("Q212 readiness rejected with a non-Error value");
  }
  throw new Error("Q212 readiness unexpectedly succeeded");
}

describe("Q212 retained readiness target admission", () => {
  test("accepts only paired loopback URLs with split exact roles", () => {
    const deploy = "postgres://yellow_deploy:protected@127.0.0.1:55503/yellow_order440_q212_readiness";
    const runtime = "postgres://yellow_runtime:protected@127.0.0.1:55503/yellow_order440_q212_readiness";
    expect(assertSameTarget(deploy, runtime)).toEqual({
      authority: "127.0.0.1:55503",
      database: "yellow_order440_q212_readiness",
    });
    for (const [left, right] of [
      [deploy.replace("q212", "q211"), runtime],
      [deploy, runtime.replace("55503", "55504")],
      [deploy, runtime.replace("yellow_runtime", "yellow_deploy")],
      [deploy, runtime.replace("127.0.0.1", "database.example")],
      [deploy, `${runtime}?options=private`],
      [deploy.replace("/yellow_", "/%79ellow_"), runtime],
    ] as const) {
      expect(() => assertSameTarget(left, right)).toThrow();
    }
  });
});

databaseDescribe("Q212 direct-runtime retry-binding readiness hostility", () => {
  let deploy: SQL | undefined;
  let runtime: SQL | undefined;
  let canonicalHelperDefinition = "";
  let canonicalReceiptDefinition = "";
  let initialContractFingerprint = "";
  let initialPublicDataFingerprint = "";
  let initialRoleFingerprint = "";

  async function helperResult(): Promise<string | null> {
    const rows = await deploy!<{ result: string | null }[]>`
      SELECT pg_catalog.pg_get_function_result(procedure.oid) AS result
      FROM pg_catalog.pg_proc procedure
      WHERE procedure.oid=pg_catalog.to_regprocedure(${HELPER_SIGNATURE})
    `;
    return rows[0]?.result ?? null;
  }

  async function receiptDefinition(): Promise<string> {
    const rows = await deploy!<{ definition: string }[]>`
      SELECT pg_catalog.pg_get_functiondef(procedure.oid) AS definition
      FROM pg_catalog.pg_proc procedure
      WHERE procedure.oid=pg_catalog.to_regprocedure(${RECEIPT_SIGNATURE})
    `;
    if (rows.length !== 1 || !rows[0]) throw new Error("Q212 receipt function is unavailable");
    return rows[0].definition;
  }

  async function contractFingerprint(): Promise<string> {
    const functions = await deploy!<Array<{
      name: string;
      owner: string;
      language: string;
      volatility: string;
      securityDefiner: boolean;
      strict: boolean;
      parallel: string;
      leakproof: boolean;
      returnsSet: boolean;
      result: string;
      config: string[] | null;
      acl: string | null;
      definition: string;
    }>>`
      SELECT procedure.oid::pg_catalog.regprocedure::text AS name,
             owner.rolname AS owner,language.lanname AS language,
             procedure.provolatile::text AS "volatility",
             procedure.prosecdef AS "securityDefiner",
             procedure.proisstrict AS strict,procedure.proparallel::text AS parallel,
             procedure.proleakproof AS leakproof,procedure.proretset AS "returnsSet",
             pg_catalog.pg_get_function_result(procedure.oid) AS result,
             procedure.proconfig AS config,procedure.proacl::text AS acl,
             pg_catalog.pg_get_functiondef(procedure.oid) AS definition
      FROM pg_catalog.pg_proc procedure
      JOIN pg_catalog.pg_roles owner ON owner.oid=procedure.proowner
      JOIN pg_catalog.pg_language language ON language.oid=procedure.prolang
      WHERE procedure.oid IN (
        pg_catalog.to_regprocedure(${HELPER_SIGNATURE}),
        pg_catalog.to_regprocedure(${RECEIPT_SIGNATURE})
      )
      ORDER BY name
    `;
    const ledger = await deploy!<Array<{
      version: number;
      filename: string;
      checksum: string;
    }>>`
      SELECT version,filename,pg_catalog.btrim(checksum_sha256) AS checksum
      FROM public.schema_migration ORDER BY version
    `;
    return sha256(JSON.stringify({ functions, ledger }));
  }

  async function publicDataFingerprint(): Promise<string> {
    const relations = await deploy!<Array<{ name: string }>>`
      SELECT relation.relname AS name
      FROM pg_catalog.pg_class relation
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace
      WHERE namespace.nspname='public' AND relation.relkind IN ('r','p')
      ORDER BY relation.relname
    `;
    const fingerprints: Array<Readonly<{ name: string; rows: number; digest: string }>> = [];
    for (const { name } of relations) {
      if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
        throw new Error("Q212 public relation identity is unsupported");
      }
      const rows = await deploy!.unsafe<Array<{ rows: number; digest: string }>>(`
        SELECT pg_catalog.count(*)::integer AS rows,
               pg_catalog.md5(coalesce(pg_catalog.string_agg(
                 pg_catalog.md5(pg_catalog.to_jsonb(source_row)::text),''
                 ORDER BY pg_catalog.to_jsonb(source_row)::text
               ),'')) AS digest
        FROM public."${name}" source_row
      `);
      if (rows.length !== 1 || !rows[0]) throw new Error("Q212 public relation snapshot failed");
      fingerprints.push(Object.freeze({ name, rows: rows[0].rows, digest: rows[0].digest }));
    }
    return sha256(JSON.stringify(fingerprints));
  }

  async function roleFingerprint(): Promise<string> {
    const roles = await deploy!<Array<{
      role: string;
      superuser: boolean;
      inherit: boolean;
      createRole: boolean;
      createDatabase: boolean;
      canLogin: boolean;
      replication: boolean;
      bypassRls: boolean;
      connectionLimit: number;
      config: string[] | null;
    }>>`
      SELECT rolname AS role,rolsuper AS superuser,rolinherit AS inherit,
             rolcreaterole AS "createRole",rolcreatedb AS "createDatabase",
             rolcanlogin AS "canLogin",rolreplication AS replication,
             rolbypassrls AS "bypassRls",rolconnlimit AS "connectionLimit",
             rolconfig AS config
      FROM pg_catalog.pg_roles
      WHERE rolname IN ('yellow_deploy','yellow_owner','yellow_runtime','app_role')
      ORDER BY rolname
    `;
    const memberships = await deploy!<Array<{ role: string; member: string; admin: boolean }>>`
      SELECT role.rolname AS role,member.rolname AS member,membership.admin_option AS admin
      FROM pg_catalog.pg_auth_members membership
      JOIN pg_catalog.pg_roles role ON role.oid=membership.roleid
      JOIN pg_catalog.pg_roles member ON member.oid=membership.member
      WHERE role.rolname IN ('yellow_deploy','yellow_owner','yellow_runtime','app_role')
         OR member.rolname IN ('yellow_deploy','yellow_owner','yellow_runtime','app_role')
      ORDER BY role.rolname,member.rolname
    `;
    return sha256(JSON.stringify({ roles, memberships }));
  }

  async function restoreCanonicalHelper(): Promise<void> {
    if (!deploy || canonicalHelperDefinition === "") return;
    const result = await helperResult();
    if (result !== null && result !== "jsonb") {
      await deploy.begin(async transaction => {
        await transaction.unsafe(`DROP FUNCTION ${HELPER_SIGNATURE}`);
        await transaction.unsafe("SET LOCAL ROLE yellow_owner");
        await transaction.unsafe(canonicalHelperDefinition);
      });
    } else {
      if (result === null) {
        await deploy.begin(async transaction => {
          await transaction.unsafe("SET LOCAL ROLE yellow_owner");
          await transaction.unsafe(canonicalHelperDefinition);
        });
      } else {
        await deploy.unsafe(canonicalHelperDefinition);
      }
    }
    await deploy.unsafe(`ALTER FUNCTION ${HELPER_SIGNATURE} OWNER TO yellow_owner`);
    await deploy.unsafe(`ALTER FUNCTION ${HELPER_SIGNATURE} NOT LEAKPROOF`);
    await deploy.unsafe(`REVOKE ALL ON FUNCTION ${HELPER_SIGNATURE} FROM PUBLIC,app_role,yellow_runtime`);
  }

  async function proveRejected(expectedReceiptDefinition = canonicalReceiptDefinition): Promise<void> {
    const error = await readinessFailure(assertRuntimeReleaseReadiness(runtime!));
    expect(error.message).toBe("runtime release readiness is unavailable");
    expect(await receiptDefinition()).toBe(expectedReceiptDefinition);
  }

  async function proveRestored(): Promise<void> {
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
    expect(await receiptDefinition()).toBe(canonicalReceiptDefinition);
  }

  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 1, prepare: false, connectionTimeout: 5 });
    runtime = new SQL(RUNTIME_URL!, { max: 1, prepare: false, connectionTimeout: 5 });
    const [deployIdentity] = await deploy<Array<{
      sessionUser: string;
      currentUser: string;
      database: string;
      databaseOwner: string;
      superuser: boolean;
      serverMajor: number;
    }>>`
      SELECT session_user AS "sessionUser",current_user AS "currentUser",
             current_database() AS database,
             pg_catalog.pg_get_userbyid(database_row.datdba) AS "databaseOwner",
             pg_catalog.current_setting('is_superuser')='on' AS superuser,
             pg_catalog.current_setting('server_version_num')::integer/10000 AS "serverMajor"
      FROM pg_catalog.pg_database database_row
      WHERE database_row.datname=pg_catalog.current_database()
    `;
    const [runtimeIdentity] = await runtime<Array<{
      sessionUser: string;
      currentUser: string;
      database: string;
      superuser: boolean;
    }>>`
      SELECT session_user AS "sessionUser",current_user AS "currentUser",
             current_database() AS database,
             pg_catalog.current_setting('is_superuser')='on' AS superuser
    `;
    expect(deployIdentity).toEqual({ sessionUser: "yellow_deploy", currentUser: "yellow_deploy",
      database: configuredTarget!.database, databaseOwner: "yellow_deploy",
      superuser: true, serverMajor: 16 });
    expect(runtimeIdentity).toEqual({ sessionUser: "yellow_runtime", currentUser: "yellow_runtime",
      database: configuredTarget!.database, superuser: false });
    const [frontier] = await deploy<Array<{
      migrations: number;
      frontier: number;
      checksum: string | null;
      helper: string | null;
    }>>`
      SELECT pg_catalog.count(*)::integer AS migrations,
             pg_catalog.max(version)::integer AS frontier,
             pg_catalog.max(pg_catalog.btrim(checksum_sha256)) FILTER(WHERE version=86) AS checksum,
             pg_catalog.to_regprocedure(${HELPER_SIGNATURE})::text AS helper
      FROM public.schema_migration
    `;
    expect(frontier).toEqual({ migrations: 89, frontier: CURRENT_MIGRATION_FRONTIER,
      checksum: MIGRATION_86_SHA256,
      helper: "india_fiscal_submission_retry_binding_v1(text,text,text,uuid,integer)" });
    const [reverseDependencies] = await deploy<Array<{ dependents: number }>>`
      SELECT pg_catalog.count(*)::integer AS dependents
      FROM pg_catalog.pg_depend dependency
      WHERE dependency.refclassid='pg_catalog.pg_proc'::pg_catalog.regclass
        AND dependency.refobjid=pg_catalog.to_regprocedure(${HELPER_SIGNATURE})
        AND dependency.deptype NOT IN ('i','e')
    `;
    expect(reverseDependencies).toEqual({ dependents: 0 });
    canonicalHelperDefinition = (await deploy<Array<{ definition: string }>>`
      SELECT pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(${HELPER_SIGNATURE})) AS definition
    `)[0]!.definition;
    canonicalReceiptDefinition = await receiptDefinition();
    await expect(assertRuntimeReleaseReadiness(runtime)).resolves.toBeUndefined();
    initialContractFingerprint = await contractFingerprint();
    initialPublicDataFingerprint = await publicDataFingerprint();
    initialRoleFingerprint = await roleFingerprint();
  }, 60_000);

  afterAll(async () => {
    let cleanupFailure: unknown;
    try {
      await restoreCanonicalHelper();
      if (runtime) await assertRuntimeReleaseReadiness(runtime);
    } catch (error) {
      cleanupFailure = error;
    } finally {
      await runtime?.close({ timeout: 5 });
      await deploy?.close({ timeout: 5 });
    }
    if (cleanupFailure) throw new Error("Q212 readiness proof could not prove cleanup");
  });

  test("rejects committed helper EXECUTE grants and restores exact denial", async () => {
    for (const role of ["PUBLIC", "app_role", "yellow_runtime"] as const) {
      try {
        await deploy!.unsafe(`GRANT EXECUTE ON FUNCTION ${HELPER_SIGNATURE} TO ${role}`);
        await proveRejected();
      } finally {
        await deploy!.unsafe(`REVOKE EXECUTE ON FUNCTION ${HELPER_SIGNATURE} FROM ${role}`);
      }
      await proveRestored();
    }
  }, 60_000);

  test("rejects committed helper metadata drift and restores every attribute", async () => {
    const drifts = [
      [`ALTER FUNCTION ${HELPER_SIGNATURE} STABLE`, `ALTER FUNCTION ${HELPER_SIGNATURE} IMMUTABLE`],
      [`ALTER FUNCTION ${HELPER_SIGNATURE} STRICT`,
        `ALTER FUNCTION ${HELPER_SIGNATURE} CALLED ON NULL INPUT`],
      [`ALTER FUNCTION ${HELPER_SIGNATURE} PARALLEL SAFE`,
        `ALTER FUNCTION ${HELPER_SIGNATURE} PARALLEL UNSAFE`],
      [`ALTER FUNCTION ${HELPER_SIGNATURE} SECURITY DEFINER`,
        `ALTER FUNCTION ${HELPER_SIGNATURE} SECURITY INVOKER`],
      [`ALTER FUNCTION ${HELPER_SIGNATURE} SET search_path TO public`,
        `ALTER FUNCTION ${HELPER_SIGNATURE} SET search_path TO pg_catalog, public`],
      [`ALTER FUNCTION ${HELPER_SIGNATURE} OWNER TO yellow_deploy`,
        `ALTER FUNCTION ${HELPER_SIGNATURE} OWNER TO yellow_owner`],
      [`ALTER FUNCTION ${HELPER_SIGNATURE} LEAKPROOF`,
        `ALTER FUNCTION ${HELPER_SIGNATURE} NOT LEAKPROOF`],
    ] as const;
    for (const [mutate, restore] of drifts) {
      try {
        await deploy!.unsafe(mutate);
        await proveRejected();
      } finally {
        await deploy!.unsafe(restore);
      }
      await proveRestored();
    }
  }, 60_000);

  test("rejects a committed language replacement without changing the receipt body", async () => {
    try {
      await deploy!.unsafe(`
        CREATE OR REPLACE FUNCTION ${HELPER_DECLARATION}
        RETURNS jsonb LANGUAGE plpgsql IMMUTABLE CALLED ON NULL INPUT PARALLEL UNSAFE
        SECURITY INVOKER SET search_path=pg_catalog,public AS $q212_language$
        BEGIN RETURN '{}'::pg_catalog.jsonb; END
        $q212_language$
      `);
      await proveRejected();
    } finally {
      await deploy!.unsafe(canonicalHelperDefinition);
    }
    await proveRestored();
  }, 30_000);

  test("rejects a committed return-type replacement and atomically restores the helper", async () => {
    try {
      await deploy!.begin(async transaction => {
        await transaction.unsafe(`DROP FUNCTION ${HELPER_SIGNATURE}`);
        await transaction.unsafe("SET LOCAL ROLE yellow_owner");
        await transaction.unsafe(`
          CREATE FUNCTION ${HELPER_DECLARATION}
          RETURNS text LANGUAGE sql IMMUTABLE CALLED ON NULL INPUT PARALLEL UNSAFE
          SECURITY INVOKER SET search_path=pg_catalog,public AS $q212_result$
            SELECT '{}'::text
          $q212_result$
        `);
        await transaction.unsafe(
          `REVOKE ALL ON FUNCTION ${HELPER_SIGNATURE} FROM PUBLIC,app_role,yellow_runtime`,
        );
      });
      await proveRejected();
    } finally {
      await restoreCanonicalHelper();
    }
    await proveRestored();
  }, 30_000);

  test("rejects a committed set-returning replacement and atomically restores the helper", async () => {
    try {
      await deploy!.begin(async transaction => {
        await transaction.unsafe(`DROP FUNCTION ${HELPER_SIGNATURE}`);
        await transaction.unsafe("SET LOCAL ROLE yellow_owner");
        await transaction.unsafe(`
          CREATE FUNCTION ${HELPER_DECLARATION}
          RETURNS SETOF jsonb LANGUAGE sql IMMUTABLE CALLED ON NULL INPUT PARALLEL UNSAFE
          SECURITY INVOKER SET search_path=pg_catalog,public AS $q212_set_result$
            SELECT '{}'::pg_catalog.jsonb
          $q212_set_result$
        `);
        await transaction.unsafe(
          `REVOKE ALL ON FUNCTION ${HELPER_SIGNATURE} FROM PUBLIC,app_role,yellow_runtime`,
        );
      });
      await proveRejected();
    } finally {
      await restoreCanonicalHelper();
    }
    await proveRestored();
  }, 30_000);

  test("rejects a receipt reader that no longer uses the exact helper", async () => {
    const marker = "RETURN v_common||public.india_fiscal_submission_retry_binding_v1(";
    const start = canonicalReceiptDefinition.indexOf(marker);
    const end = canonicalReceiptDefinition.indexOf(");", start);
    if (start < 0 || end < start || canonicalReceiptDefinition.indexOf(marker, start + marker.length) >= 0) {
      throw new Error("Q212 canonical receipt helper call is not singular");
    }
    const detachedDefinition = canonicalReceiptDefinition.slice(0, start)
      + "RETURN v_common;"
      + canonicalReceiptDefinition.slice(end + 2);
    try {
      await deploy!.unsafe(detachedDefinition);
      await proveRejected(detachedDefinition);
    } finally {
      await deploy!.unsafe(canonicalReceiptDefinition);
    }
    await proveRestored();
  }, 30_000);

  test("leaves the exact authority, roles, ledger, permissions and tenant data unchanged", async () => {
    await proveRestored();
    expect(await contractFingerprint()).toBe(initialContractFingerprint);
    expect(await roleFingerprint()).toBe(initialRoleFingerprint);
    expect(await publicDataFingerprint()).toBe(initialPublicDataFingerprint);
  }, 60_000);
});
