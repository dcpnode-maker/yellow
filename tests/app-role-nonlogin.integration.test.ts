import { afterAll, describe, expect, test } from "bun:test";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { SQL } from "bun";

import { runMigrations } from "../scripts/migrate";
import { Database } from "../src/kernel";

const ADMIN_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_APP_ROLE_NONLOGIN_URL;
if (process.env.YELLOW_REQUIRE_APP_ROLE_NONLOGIN === "1" && !ADMIN_URL) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL is required by the Order 118 proof");
}

const SOURCE_TENANT = "00000000-0000-0000-0000-000000011801";
const VICTIM_TENANT = "00000000-0000-0000-0000-000000011802";
const SOURCE_PARTY = "00000000-0000-0000-0000-000000011811";
const VICTIM_PARTY = "00000000-0000-0000-0000-000000011812";
const VICTIM_SENTINEL = "Order 118 victim sentinel";

const databaseDescribe = ADMIN_URL ? describe.serial : describe.skip;
const admin = ADMIN_URL ? new SQL(ADMIN_URL, { max: 1 }) : undefined;

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function directRoleUrl(password: string): string {
  const url = new URL(ADMIN_URL!);
  url.username = "app_role";
  url.password = password;
  return url.toString();
}

function roleUrl(role: string, password: string): string {
  const url = new URL(ADMIN_URL!);
  url.username = role;
  url.password = password;
  return url.toString();
}

function sqlState(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { errno?: unknown; code?: unknown };
  if (typeof candidate.errno === "string") return candidate.errno;
  return typeof candidate.code === "string" ? candidate.code : undefined;
}

async function expectState(operation: () => Promise<unknown>, expected: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    expect(sqlState(error)).toBe(expected);
    return;
  }
  throw new Error(`Expected SQLSTATE ${expected}`);
}

type RoleState = Readonly<{
  canLogin: boolean;
  connectionLimit: number;
  passwordIsNull: boolean;
  superuser: boolean;
  createDb: boolean;
  createRole: boolean;
  inherit: boolean;
  replication: boolean;
  bypassRls: boolean;
}>;

async function roleState(): Promise<RoleState> {
  const rows = await admin!<RoleState[]>`
    SELECT rolcanlogin AS "canLogin",
           rolconnlimit AS "connectionLimit",
           rolpassword IS NULL AS "passwordIsNull",
           rolsuper AS superuser,
           rolcreatedb AS "createDb",
           rolcreaterole AS "createRole",
           rolinherit AS inherit,
           rolreplication AS replication,
           rolbypassrls AS "bypassRls"
      FROM pg_catalog.pg_authid
     WHERE rolname = 'app_role'
  `;
  if (!rows[0]) throw new Error("app_role is missing");
  return rows[0];
}

const HARDENED_ROLE: RoleState = Object.freeze({
  canLogin: false,
  connectionLimit: 0,
  passwordIsNull: true,
  superuser: false,
  createDb: false,
  createRole: false,
  inherit: false,
  replication: false,
  bypassRls: false,
});

const PARENT_ROLE: RoleState = Object.freeze({
  ...HARDENED_ROLE,
  canLogin: true,
  connectionLimit: -1,
  inherit: true,
});

async function resetToParentRole(): Promise<void> {
  await admin!.unsafe(`
    ALTER ROLE app_role WITH LOGIN PASSWORD NULL CONNECTION LIMIT -1
      NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS;
    DELETE FROM public.schema_migration WHERE version = 12;
  `);
}

async function applyMigration(): Promise<void> {
  await runMigrations({
    databaseUrl: ADMIN_URL!,
    migrationsDirectory: fileURLToPath(new URL("../migrations", import.meta.url)),
    logger: () => undefined,
  });
}

afterAll(async () => {
  await admin?.close();
});

databaseDescribe("Order 118 app_role authentication containment", () => {
  test("P0/P2: a proof password cannot turn the internal policy role into a tenant principal", async () => {
    const password = randomBytes(48).toString("hex");
    let direct: SQL | undefined;

    try {
      await admin!.unsafe(`ALTER ROLE app_role PASSWORD ${quoteLiteral(password)}`);
      await admin!.unsafe(`
        INSERT INTO public.tenant (id, slug, name) VALUES
          ('${SOURCE_TENANT}', 'order118-source', 'Order 118 source'),
          ('${VICTIM_TENANT}', 'order118-victim', 'Order 118 victim');
        INSERT INTO public.party (id, tenant_id, kind, display_name) VALUES
          ('${SOURCE_PARTY}', '${SOURCE_TENANT}', 'person', 'Order 118 source sentinel'),
          ('${VICTIM_PARTY}', '${VICTIM_TENANT}', 'person', '${VICTIM_SENTINEL}');
      `);

      let authenticated = false;
      let exposedVictims: Array<{ displayName: string }> = [];
      try {
        direct = new SQL(directRoleUrl(password), { max: 1 });
        const connection = await direct.reserve();
        try {
          authenticated = true;
          await connection.unsafe("BEGIN");
          await connection`SELECT set_config('app.tenant_id', ${SOURCE_TENANT}, true)`;
          const victim = await connection<Array<{ id: string }>>`
            SELECT id::text AS id FROM public.tenant WHERE slug = 'order118-victim'
          `;
          expect(victim).toEqual([{ id: VICTIM_TENANT }]);
          await connection`SELECT set_config('app.tenant_id', ${victim[0]!.id}, true)`;
          exposedVictims = await connection<Array<{ displayName: string }>>`
            SELECT display_name AS "displayName"
              FROM public.party
             WHERE id = ${VICTIM_PARTY}::uuid
          `;
          await connection.unsafe("ROLLBACK");
        } finally {
          connection.release();
        }
      } catch {
        // The hardened role must be rejected by PostgreSQL before tenant SQL executes.
      }

      expect({ authenticated, exposedVictims }).toEqual({
        authenticated: false,
        exposedVictims: [],
      });
    } finally {
      await direct?.close().catch(() => undefined);
      await admin!.unsafe("ALTER ROLE app_role PASSWORD NULL").catch(() => undefined);
      await admin!.unsafe(`
        DELETE FROM public.party WHERE id IN ('${SOURCE_PARTY}', '${VICTIM_PARTY}');
        DELETE FROM public.tenant WHERE id IN ('${SOURCE_TENANT}', '${VICTIM_TENANT}');
      `).catch(() => undefined);
    }
  });

  test("P1: migration ledger, exact role catalogue and schema/RLS shape are unchanged", async () => {
    expect(await roleState()).toEqual(HARDENED_ROLE);

    const memberships = await admin!<{
      roleName: string; memberName: string; adminOption: boolean; inheritOption: boolean; setOption: boolean;
    }[]>`
      SELECT parent.rolname AS "roleName",
             member.rolname AS "memberName",
             m.admin_option AS "adminOption",
             m.inherit_option AS "inheritOption",
             m.set_option AS "setOption"
        FROM pg_catalog.pg_auth_members AS m
        JOIN pg_catalog.pg_roles AS parent ON parent.oid = m.roleid
        JOIN pg_catalog.pg_roles AS member ON member.oid = m.member
       WHERE m.roleid = 'app_role'::regrole OR m.member = 'app_role'::regrole
       ORDER BY parent.rolname, member.rolname
    `;
    expect(memberships).toEqual([{
      roleName: "app_role",
      memberName: "yellow_runtime",
      adminOption: false,
      inheritOption: false,
      setOption: true,
    }]);

    const directSessions = await admin!<{ count: number }[]>`
      SELECT count(*)::int AS count
        FROM pg_catalog.pg_stat_activity
       WHERE usename = 'app_role'
    `;
    expect(directSessions).toEqual([{ count: 0 }]);

    const databaseShape = await admin!<{
      tables: number;
      rlsTables: number;
      policies: number;
    }[]>`
      SELECT
        (SELECT count(*)::int FROM pg_catalog.pg_tables WHERE schemaname = 'public') AS tables,
        (SELECT count(*)::int
           FROM pg_catalog.pg_class AS c
           JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity) AS "rlsTables",
        (SELECT count(*)::int FROM pg_catalog.pg_policy AS p
           JOIN pg_catalog.pg_class AS c ON c.oid = p.polrelid
           JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public') AS policies
    `;
    expect(databaseShape).toEqual([{ tables: 87, rlsTables: 77, policies: 77 }]);

    const ledger = await admin!<Array<{ filename: string; checksum: string }>>`
      SELECT filename, checksum_sha256 AS checksum
        FROM public.schema_migration
       WHERE version = 12
    `;
    expect(ledger).toEqual([{
      filename: "0012_app_role_nonlogin.sql",
      checksum: "6f377ca182bcbd8ece5c6a0688597b4a4e0fc5129345a80f6f9d31076fb0ed25",
    }]);
  });

  test("P2: an unrelated login principal cannot assume app_role or enumerate tenants", async () => {
    const role = `order118_external_${randomUUID().replaceAll("-", "")}`;
    const password = randomBytes(48).toString("hex");
    let external: SQL | undefined;
    try {
      await admin!.unsafe(`CREATE ROLE ${role} LOGIN PASSWORD ${quoteLiteral(password)}`);
      external = new SQL(roleUrl(role, password), { max: 1 });
      const connection = await external.reserve();
      try {
        await expectState(() => connection.unsafe("SET ROLE app_role"), "42501");
        await expectState(() => connection.unsafe("SELECT id FROM public.tenant LIMIT 1"), "42501");
      } finally {
        connection.release();
      }
    } finally {
      await external?.close().catch(() => undefined);
      await admin!.unsafe(`DROP ROLE IF EXISTS ${role}`).catch(() => undefined);
    }
  });

  test("P3: trusted tenant transactions retain A/B isolation and reset role/context", async () => {
    await admin!.unsafe(`
      INSERT INTO public.tenant (id, slug, name) VALUES
        ('${SOURCE_TENANT}', 'order118-source', 'Order 118 source'),
        ('${VICTIM_TENANT}', 'order118-victim', 'Order 118 victim');
      INSERT INTO public.party (id, tenant_id, kind, display_name) VALUES
        ('${SOURCE_PARTY}', '${SOURCE_TENANT}', 'person', 'Order 118 source sentinel'),
        ('${VICTIM_PARTY}', '${VICTIM_TENANT}', 'person', '${VICTIM_SENTINEL}');
    `);
    const inspectReset = async (pool: SQL, backendPid: number) => {
      const connection = await pool.reserve();
      try {
        const rows = await connection<Array<{
          backendPid: number;
          roleReset: boolean;
          tenantReset: boolean;
        }>>`
          SELECT pg_backend_pid() AS "backendPid",
                 current_user = session_user AS "roleReset",
                 nullif(current_setting('app.tenant_id', true), '') IS NULL AS "tenantReset"
        `;
        expect(rows).toEqual([{ backendPid, roleReset: true, tenantReset: true }]);
      } finally {
        connection.release();
      }
    };

    try {
      const failurePool = new SQL(ADMIN_URL!, { max: 1 });
      const failureDatabase = new Database(failurePool);
      let source: Array<{
        displayName: string;
        currentRole: string;
        tenantContext: string;
        backendPid: number;
      }> = [];
      try {
        await expect(failureDatabase.withTenantTransaction(SOURCE_TENANT, async (tx) => {
          source = await tx`
            SELECT display_name AS "displayName", current_user AS "currentRole",
                   current_setting('app.tenant_id') AS "tenantContext",
                   pg_backend_pid() AS "backendPid"
              FROM public.party ORDER BY display_name
          `;
          throw new Error("order118 injected rollback");
        })).rejects.toThrow("order118 injected rollback");
        expect(source).toEqual([{
          displayName: "Order 118 source sentinel",
          currentRole: "app_role",
          tenantContext: SOURCE_TENANT,
          backendPid: expect.any(Number),
        }]);
        await inspectReset(failurePool, source[0]!.backendPid);
      } finally {
        await failurePool.close();
      }

      const successPool = new SQL(ADMIN_URL!, { max: 1 });
      const successDatabase = new Database(successPool);
      try {
        const victim = await successDatabase.withTenantTransaction(VICTIM_TENANT, async (tx) => tx<
          Array<{
            displayName: string;
            currentRole: string;
            tenantContext: string;
            backendPid: number;
          }>
        >`
          SELECT display_name AS "displayName", current_user AS "currentRole",
                 current_setting('app.tenant_id') AS "tenantContext",
                 pg_backend_pid() AS "backendPid"
            FROM public.party ORDER BY display_name
        `);
        expect(victim).toEqual([{
          displayName: VICTIM_SENTINEL,
          currentRole: "app_role",
          tenantContext: VICTIM_TENANT,
          backendPid: expect.any(Number),
        }]);
        await inspectReset(successPool, victim[0]!.backendPid);
      } finally {
        await successPool.close();
      }
    } finally {
      await admin!.unsafe(`
        DELETE FROM public.party WHERE id IN ('${SOURCE_PARTY}', '${VICTIM_PARTY}');
        DELETE FROM public.tenant WHERE id IN ('${SOURCE_TENANT}', '${VICTIM_TENANT}');
      `);
    }
  }, 30_000);

  test("P4: membership and direct-session preconditions roll back atomically and retry once", async () => {
    const member = `order118_member_${randomUUID().replaceAll("-", "")}`;
    const parent = `order118_parent_${randomUUID().replaceAll("-", "")}`;
    const password = randomBytes(48).toString("hex");
    let direct: SQL | undefined;

    const expectAtomicFailure = async (expectedRole: RoleState = PARENT_ROLE) => {
      await expectState(() => applyMigration(), "55000");
      expect(await roleState()).toEqual(expectedRole);
      const ledger = await admin!<{ count: number }[]>`
        SELECT count(*)::int AS count FROM public.schema_migration WHERE version = 12
      `;
      expect(ledger).toEqual([{ count: 0 }]);
    };

    try {
      await admin!.unsafe(`CREATE ROLE ${member}; CREATE ROLE ${parent}`);

      await resetToParentRole();
      await admin!.unsafe(`GRANT app_role TO ${member}`);
      await expectAtomicFailure();
      await admin!.unsafe(`REVOKE app_role FROM ${member}`);

      await resetToParentRole();
      await admin!.unsafe(`GRANT ${parent} TO app_role`);
      await expectAtomicFailure();
      await admin!.unsafe(`REVOKE ${parent} FROM app_role`);

      await resetToParentRole();
      await admin!.unsafe(`ALTER ROLE app_role PASSWORD ${quoteLiteral(password)}`);
      direct = new SQL(directRoleUrl(password), { max: 1 });
      const connection = await direct.reserve();
      try {
        await connection`SELECT pg_backend_pid()`;
        await expectAtomicFailure({ ...PARENT_ROLE, passwordIsNull: false });
      } finally {
        connection.release();
        await direct.close();
        direct = undefined;
      }

      await admin!.unsafe("ALTER ROLE app_role PASSWORD NULL");
      await applyMigration();
      expect(await roleState()).toEqual(HARDENED_ROLE);
      const appliedAt = await admin!<{ appliedAt: Date }[]>`
        SELECT applied_at AS "appliedAt" FROM public.schema_migration WHERE version = 12
      `;
      expect(appliedAt).toHaveLength(1);
      await applyMigration();
      const noOpAppliedAt = await admin!<{ appliedAt: Date }[]>`
        SELECT applied_at AS "appliedAt" FROM public.schema_migration WHERE version = 12
      `;
      expect(noOpAppliedAt).toEqual(appliedAt);
    } finally {
      await direct?.close().catch(() => undefined);
      await admin!.unsafe("ALTER ROLE app_role PASSWORD NULL").catch(() => undefined);
      await admin!.unsafe(`REVOKE app_role FROM ${member};`).catch(() => undefined);
      await admin!.unsafe(`REVOKE ${parent} FROM app_role;`).catch(() => undefined);
      await admin!.unsafe(`DROP ROLE IF EXISTS ${member}; DROP ROLE IF EXISTS ${parent};`).catch(() => undefined);
      if (!(await roleState()).canLogin) {
        // already hardened
      } else {
        await applyMigration();
      }
    }
  }, 60_000);
});
