import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { SQL } from "bun";

import { Database } from "../src/kernel";

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_RUNTIME_AUTHORITY_P0_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL ?? process.env.YELLOW_RUNTIME_AUTHORITY_P0_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RUNTIME_AUTHORITY_P0 === "1";

if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_RUNTIME_DATABASE_URL are required for Order 127 P0");
}

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
const tenantA = randomUUID();
const tenantB = randomUUID();
const partyA = randomUUID();
const partyB = randomUUID();
const extensionType = `o127-${randomUUID().slice(0, 8)}`;
const extensionGlobal = randomUUID();
const extensionA = randomUUID();
const extensionB = randomUUID();
const schemaName = `o127_p0_${randomUUID().replaceAll("-", "")}`;
const rollbackMarker = new Error("Order 127 P0 probe rollback");

interface AuthorityEvidence {
  readonly sessionUser: string;
  readonly currentBeforeReset: string;
  readonly sessionIsSuperuser: boolean;
  readonly sessionBypassesRls: boolean;
  readonly sessionCanCreateDatabase: boolean;
  readonly appRoleCanCreateDatabase: boolean;
  readonly appRoleVictimRows: number;
  readonly currentAfterReset: string;
  readonly resetCanCreateDatabase: boolean;
  readonly resetVictimRows: number;
  readonly schemaCreateSucceeded: boolean;
  readonly schemaCreateSqlstate: string | null;
  readonly schemaVisibleInProbe: boolean;
}

function sqlstate(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

async function captureSqlState(operation: () => Promise<unknown>): Promise<string | null> {
  try {
    await operation();
  } catch (error) {
    return sqlstate(error);
  }
  return null;
}

databaseDescribe("Order 127 runtime database authority (kernel boundary; HTTP P4 is separately covered)", () => {
  let admin: SQL;
  let runtimeSession: SQL;
  let database: Database;

  beforeAll(async () => {
    admin = new SQL(DEPLOY_DATABASE_URL!, { max: 1 });
    runtimeSession = new SQL(RUNTIME_DATABASE_URL!, { max: 1 });
    database = Database.connect(RUNTIME_DATABASE_URL!, { maxConnections: 1 });
    await admin`
      INSERT INTO tenant (id, slug, name)
      VALUES
        (${tenantA}::uuid, ${`o127-p0-a-${tenantA}`}, 'Order 127 P0 tenant A'),
        (${tenantB}::uuid, ${`o127-p0-b-${tenantB}`}, 'Order 127 P0 tenant B')
    `;
    await admin`
      INSERT INTO party (id, tenant_id, kind, display_name)
      VALUES
        (${partyA}::uuid, ${tenantA}::uuid, 'person', 'Order 127 P0 sentinel A'),
        (${partyB}::uuid, ${tenantB}::uuid, 'person', 'Order 127 P0 sentinel B')
    `;
    await admin`
      INSERT INTO extension_type (type, json_schema) VALUES (${extensionType}, '{"type":"object"}'::jsonb);
      INSERT INTO extension (id, tenant_id, type, key, content) VALUES
        (${extensionGlobal}::uuid, NULL, ${extensionType}, 'global', '{}'::jsonb),
        (${extensionA}::uuid, ${tenantA}::uuid, ${extensionType}, 'tenant-a', '{}'::jsonb),
        (${extensionB}::uuid, ${tenantB}::uuid, ${extensionType}, 'tenant-b', '{}'::jsonb)
    `;
  });

  afterAll(async () => {
    if (admin) {
      await admin`DELETE FROM party WHERE id IN (${partyA}::uuid, ${partyB}::uuid)`;
      await admin`DELETE FROM extension WHERE id IN (${extensionGlobal}::uuid, ${extensionA}::uuid, ${extensionB}::uuid)`;
      await admin`DELETE FROM extension_type WHERE type = ${extensionType}`;
      await admin`DELETE FROM tenant WHERE id IN (${tenantA}::uuid, ${tenantB}::uuid)`;
    }
    await database?.close();
    await admin?.close();
    await runtimeSession?.close();
  });

  test("P0: RESET ROLE must not restore deployment superuser or cross-tenant/DDL authority", async () => {
    let evidence: AuthorityEvidence | undefined;
    let thrown: unknown;

    try {
      await database.withTenantTransaction(tenantA, async (tx) => {
        const identity = await tx<{
          session_user: string;
          current_user: string;
          session_is_superuser: boolean;
          session_bypasses_rls: boolean;
          session_can_create_database: boolean;
          app_role_can_create_database: boolean;
        }[]>`
          SELECT
            session_user::text AS session_user,
            current_user::text AS current_user,
            role.rolsuper AS session_is_superuser,
            role.rolbypassrls AS session_bypasses_rls,
            has_database_privilege(session_user, current_database(), 'CREATE') AS session_can_create_database,
            has_database_privilege(current_user, current_database(), 'CREATE') AS app_role_can_create_database
          FROM pg_roles AS role
          WHERE role.rolname = session_user
        `;
        const before = identity[0];
        if (!before) throw new Error("PostgreSQL did not return the authenticated runtime identity");

        const appRoleVictim = await tx<{ count: number }[]>`
          SELECT count(*)::int AS count
          FROM party
          WHERE id = ${partyB}::uuid
        `;

        await tx.unsafe("RESET ROLE");
        const afterReset = await tx<{
          current_user: string;
          can_create_database: boolean;
          victim_rows: number;
        }[]>`
          SELECT
            current_user::text AS current_user,
            has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_database,
            (SELECT count(*)::int FROM party WHERE id = ${partyB}::uuid) AS victim_rows
        `;
        const reset = afterReset[0];
        if (!reset) throw new Error("PostgreSQL did not return post-reset authority evidence");

        await tx.unsafe("SAVEPOINT order127_p0_authority_probe");
        let schemaCreateSucceeded = false;
        let schemaCreateSqlstate: string | null = null;
        let schemaVisibleInProbe = false;
        try {
          await tx.unsafe(`CREATE SCHEMA ${schemaName}`);
          schemaCreateSucceeded = true;
          const visible = await tx<{ visible: boolean }[]>`
            SELECT to_regnamespace(${schemaName}) IS NOT NULL AS visible
          `;
          schemaVisibleInProbe = visible[0]?.visible === true;
        } catch (error) {
          schemaCreateSqlstate = sqlstate(error);
        } finally {
          await tx.unsafe("ROLLBACK TO SAVEPOINT order127_p0_authority_probe");
          await tx.unsafe("RELEASE SAVEPOINT order127_p0_authority_probe");
        }

        evidence = {
          sessionUser: before.session_user,
          currentBeforeReset: before.current_user,
          sessionIsSuperuser: before.session_is_superuser,
          sessionBypassesRls: before.session_bypasses_rls,
          sessionCanCreateDatabase: before.session_can_create_database,
          appRoleCanCreateDatabase: before.app_role_can_create_database,
          appRoleVictimRows: appRoleVictim[0]?.count ?? -1,
          currentAfterReset: reset.current_user,
          resetCanCreateDatabase: reset.can_create_database,
          resetVictimRows: reset.victim_rows,
          schemaCreateSucceeded,
          schemaCreateSqlstate,
          schemaVisibleInProbe,
        };
        throw rollbackMarker;
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBe(rollbackMarker);
    const residual = await admin<{ schema_exists: boolean }[]>`
      SELECT to_regnamespace(${schemaName}) IS NOT NULL AS schema_exists
    `;
    expect(residual).toEqual([{ schema_exists: false }]);

    expect(evidence).toEqual({
      sessionUser: "yellow_runtime",
      currentBeforeReset: "app_role",
      sessionIsSuperuser: false,
      sessionBypassesRls: false,
      sessionCanCreateDatabase: false,
      appRoleCanCreateDatabase: false,
      appRoleVictimRows: 0,
      currentAfterReset: "yellow_runtime",
      resetCanCreateDatabase: false,
      resetVictimRows: 0,
      schemaCreateSucceeded: false,
      schemaCreateSqlstate: "42501",
      schemaVisibleInProbe: false,
    });
  });

  test("P1: exact role tuples, sole membership edge, and final ownership are enforced", async () => {
    const roles = await admin!<Array<{
      rolname: string; can_login: boolean; conn_limit: number; password_is_null: boolean;
      superuser: boolean; create_db: boolean; create_role: boolean; inherit: boolean;
      replication: boolean; bypass_rls: boolean;
    }>>`
      SELECT rolname, rolcanlogin AS can_login, rolconnlimit AS conn_limit,
             rolpassword IS NULL AS password_is_null, rolsuper AS superuser,
             rolcreatedb AS create_db, rolcreaterole AS create_role,
             rolinherit AS inherit, rolreplication AS replication, rolbypassrls AS bypass_rls
        FROM pg_catalog.pg_authid
       WHERE rolname IN ('yellow_deploy', 'yellow_owner', 'yellow_runtime', 'app_role')
       ORDER BY rolname
    `;
    expect(roles).toEqual([
      { rolname: "app_role", can_login: false, conn_limit: 0, password_is_null: true, superuser: false, create_db: false, create_role: false, inherit: false, replication: false, bypass_rls: false },
      { rolname: "yellow_deploy", can_login: true, conn_limit: -1, password_is_null: false, superuser: true, create_db: true, create_role: true, inherit: true, replication: true, bypass_rls: true },
      { rolname: "yellow_owner", can_login: false, conn_limit: 0, password_is_null: true, superuser: false, create_db: false, create_role: false, inherit: false, replication: false, bypass_rls: false },
      { rolname: "yellow_runtime", can_login: true, conn_limit: -1, password_is_null: false, superuser: false, create_db: false, create_role: false, inherit: false, replication: false, bypass_rls: false },
    ]);

    const memberships = await admin!<{ role_name: string; member_name: string }[]>`
      SELECT parent.rolname AS role_name, member.rolname AS member_name
        FROM pg_catalog.pg_auth_members m
        JOIN pg_catalog.pg_roles parent ON parent.oid = m.roleid
        JOIN pg_catalog.pg_roles member ON member.oid = m.member
       WHERE parent.rolname IN ('yellow_deploy', 'yellow_owner', 'yellow_runtime', 'app_role')
          OR member.rolname IN ('yellow_deploy', 'yellow_owner', 'yellow_runtime', 'app_role')
       ORDER BY parent.rolname, member.rolname
    `;
    expect(memberships).toEqual([{ role_name: "app_role", member_name: "yellow_runtime" }]);

    const ownership = await admin!<{ wrong_relations: number; runtime_relations: number; wrong_functions: number; runtime_functions: number }[]>`
      SELECT
        (SELECT count(*)::int FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m') AND pg_get_userbyid(c.relowner) <> 'yellow_owner') AS wrong_relations,
        (SELECT count(*)::int FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m') AND pg_get_userbyid(c.relowner) = 'yellow_runtime') AS runtime_relations,
        (SELECT count(*)::int FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND pg_get_userbyid(p.proowner) <> 'yellow_owner') AS wrong_functions,
        (SELECT count(*)::int FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND pg_get_userbyid(p.proowner) = 'yellow_runtime') AS runtime_functions
    `;
    expect(ownership).toEqual([{ wrong_relations: 0, runtime_relations: 0, wrong_functions: 0, runtime_functions: 0 }]);

    const capabilities = await admin!<{ signature: string; owner: string; public_execute: boolean; app_execute: boolean; runtime_execute: boolean; config: string[] | null }[]>`
      SELECT p.oid::regprocedure::text AS signature, pg_get_userbyid(p.proowner) AS owner,
             has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute,
             has_function_privilege('app_role', p.oid, 'EXECUTE') AS app_execute,
             has_function_privilege('yellow_runtime', p.oid, 'EXECUTE') AS runtime_execute,
             p.proconfig AS config
        FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname LIKE 'runtime_%'
       ORDER BY signature
    `;
    expect(capabilities).toHaveLength(10);
    expect(capabilities.map(({ signature }) => signature)).toEqual(expect.arrayContaining([
      "public.runtime_visible_extensions(uuid)",
      "public.runtime_extension_compatibility_inputs(text)",
    ]));
    expect(capabilities.every((row) => row.owner === "yellow_owner" && !row.public_execute && !row.app_execute && row.runtime_execute && JSON.stringify(row.config) === JSON.stringify(["search_path=pg_catalog, public, pg_temp"]))).toBe(true);

    const rls = await admin!<{ tables: number; enabled: number; forced: number; policies: number }[]>`
      SELECT count(*) FILTER (WHERE c.relkind IN ('r','p'))::int AS tables,
             count(*) FILTER (WHERE c.relkind IN ('r','p') AND c.relrowsecurity)::int AS enabled,
             count(*) FILTER (WHERE c.relkind IN ('r','p') AND c.relforcerowsecurity)::int AS forced,
             (SELECT count(*)::int FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class pc ON pc.oid = p.polrelid
               JOIN pg_catalog.pg_namespace pn ON pn.oid = pc.relnamespace WHERE pn.nspname = 'public') AS policies
        FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
    `;
    expect(rls).toEqual([{ tables: 85, enabled: 75, forced: 0, policies: 75 }]);
  });

  test("P2: a post-COMMIT contaminated role is rejected, discarded, and cannot poison pool reuse", async () => {
    await expect(database.withTenantTransaction(tenantA, async (tx) => {
      await tx.unsafe("SET ROLE app_role");
      return "contaminated";
    })).rejects.toThrow("connection retained role or tenant context");

    const canary = await database.withTenantTransaction(tenantA, async (tx) => {
      const rows = await tx<{ current_user: string; session_user: string; tenant_id: string }[]>`
        SELECT current_user::text AS current_user, session_user::text AS session_user,
               current_setting('app.tenant_id', true) AS tenant_id
      `;
      return rows[0];
    });
    expect(canary).toEqual({ current_user: "app_role", session_user: "yellow_runtime", tenant_id: tenantA });
    const observerPool = new SQL(RUNTIME_DATABASE_URL!, { max: 1 });
    const observer = await observerPool.reserve();
    try {
      const rows = await observer<{ current_user: string; session_user: string; tenant_clear: boolean }[]>`
        SELECT current_user::text AS current_user, session_user::text AS session_user,
               NULLIF(current_setting('app.tenant_id', true), '') IS NULL AS tenant_clear
      `;
      expect(rows).toEqual([{ current_user: "yellow_runtime", session_user: "yellow_runtime", tenant_clear: true }]);
    } finally { observer.release(); await observerPool.close(); }
  });

  test("P3: bounded capabilities reject PUBLIC/app_role and malformed or oversized inputs", async () => {
    const denied = await admin!<{ signature: string; public_execute: boolean; app_execute: boolean }[]>`
      SELECT p.oid::regprocedure::text AS signature,
             has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute,
             has_function_privilege('app_role', p.oid, 'EXECUTE') AS app_execute
        FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname LIKE 'runtime_%' ORDER BY signature
    `;
    expect(denied).toHaveLength(10);
    expect(denied.every((row) => !row.public_execute && !row.app_execute)).toBe(true);

    await database.withTenantTransaction(tenantA, async (tx) => {
      expect(await captureSqlState(() => tx`SELECT public.runtime_due_hold_scopes(1)`)).toBe("42501");
      expect(await captureSqlState(() => tx`SELECT public.runtime_resolve_active_tenant('x')`)).toBe("42501");
      expect(await captureSqlState(() => tx`SELECT public.runtime_consumer_begin('x')`)).toBe("42501");
      expect(await captureSqlState(() => tx`SELECT public.runtime_consumer_read('x', 0, 1, true)`)).toBe("42501");
      expect(await captureSqlState(() => tx`SELECT public.runtime_consumer_mark('x', gen_random_uuid())`)).toBe("42501");
      expect(await captureSqlState(() => tx`SELECT public.runtime_consumer_advance('x', 0)`)).toBe("42501");
      expect(await captureSqlState(() => tx`SELECT public.runtime_mark_outbox_published(ARRAY[gen_random_uuid()])`)).toBe("42501");
      expect(await captureSqlState(() => tx`SELECT public.runtime_prune_outbox(0)`)).toBe("42501");
      expect(await captureSqlState(() => tx`SELECT public.runtime_visible_extensions(${tenantA}::uuid)`)).toBe("42501");
      expect(await captureSqlState(() => tx`SELECT public.runtime_extension_compatibility_inputs(${extensionType})`)).toBe("42501");
    });

    const direct = runtimeSession!;
    expect(await captureSqlState(() => direct`SELECT public.runtime_due_hold_scopes(0)`)).toBe("22023");
    expect(await captureSqlState(() => direct`SELECT public.runtime_due_hold_scopes(1001)`)).toBe("22023");
    expect(await captureSqlState(() => direct`SELECT public.runtime_consumer_begin('Bad_Name')`)).toBe("22023");
    expect(await captureSqlState(() => direct`SELECT public.runtime_consumer_read('x', 0, 0, true)`)).toBe("22023");
    expect(await captureSqlState(() => direct`SELECT public.runtime_consumer_mark('', NULL::uuid)`)).toBe("22023");
    expect(await captureSqlState(() => direct`SELECT public.runtime_consumer_advance('x', -1)`)).toBe("22023");
    expect(await captureSqlState(() => direct`SELECT public.runtime_mark_outbox_published(ARRAY[]::uuid[])`)).toBe("22023");
    expect(await captureSqlState(() => direct`SELECT public.runtime_prune_outbox(-1)`)).toBe("22023");
    const unknown = await direct<{ id: string | null }[]>`SELECT public.runtime_resolve_active_tenant('bad'' OR 1=1') AS id`;
      expect(unknown).toEqual([{ id: null }]);
    expect(await captureSqlState(() => direct`SELECT public.runtime_extension_compatibility_inputs('')`)).toBe("22023");
    expect(await captureSqlState(() => direct`SELECT public.runtime_visible_extensions(NULL::uuid)`)).toBe("22023");
    expect(await captureSqlState(() => direct`SELECT public.runtime_extension_compatibility_inputs(repeat('a', 65))`)).toBe("22023");
      const visibleA = await direct<{ key: string }[]>`
        SELECT key FROM public.runtime_visible_extensions(${tenantA}::uuid)
       ORDER BY key
      `;
      const visibleB = await direct<{ key: string }[]>`
        SELECT key FROM public.runtime_visible_extensions(${tenantB}::uuid)
       ORDER BY key
      `;
      expect(visibleA).toEqual([{ key: "global" }, { key: "tenant-a" }]);
      expect(visibleB).toEqual([{ key: "global" }, { key: "tenant-b" }]);
      const compatibility = await direct<{ id: string }[]>`
        SELECT id FROM public.runtime_extension_compatibility_inputs(${extensionType}) ORDER BY id
      `;
      expect(compatibility.map(({ id }) => id)).toEqual([extensionGlobal, extensionA, extensionB].sort());
    await direct.unsafe("CREATE TEMP TABLE runtime_visible_extensions (id uuid) ON COMMIT DROP");
    await direct`SELECT count(*)::int FROM public.runtime_visible_extensions(${tenantA}::uuid)`;
    await direct.unsafe("CREATE TEMP TABLE runtime_extension_compatibility_inputs (id uuid) ON COMMIT DROP");
    await direct`SELECT count(*)::int FROM public.runtime_extension_compatibility_inputs('order127-missing')`;
  });

});
