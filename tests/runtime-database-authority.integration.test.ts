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

databaseDescribe("Order 127 P0 runtime database authority", () => {
  let admin: SQL;
  let database: Database;

  beforeAll(async () => {
    admin = new SQL(DEPLOY_DATABASE_URL!, { max: 1 });
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
  });

  afterAll(async () => {
    if (admin) {
      await admin`DELETE FROM party WHERE id IN (${partyA}::uuid, ${partyB}::uuid)`;
      await admin`DELETE FROM tenant WHERE id IN (${tenantA}::uuid, ${tenantB}::uuid)`;
    }
    await database?.close();
    await admin?.close();
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
});
