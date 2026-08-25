import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_DATABASE_ACCEPTANCE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_DATABASE_ACCEPTANCE === "1";
const EXPECTED_MIGRATIONS = [
  {
    version: 1,
    filename: "0001_init.sql",
    checksum_sha256: "fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923",
  },
  {
    version: 2,
    filename: "0002_kernel_consumer_cursor.sql",
    checksum_sha256: "0ace078c04196ccff2d066b0483fce17fddbc1ef592effb25dd57c2ce996c3f4",
  },
  {
    version: 3,
    filename: "0003_revoke_legacy_expire_holds.sql",
    checksum_sha256: "a9564092d14367d37fe7f79eee65a97fdf2dbd1c359536d1b807006540d6251b",
  },
  {
    version: 4,
    filename: "0004_api_idempotency.sql",
    checksum_sha256: "f08fcc6be6c6a2cd631da8c4e2d08bf5d2139de24ba2b1ca6ec1554ab2590ab2",
  },
  {
    version: 5,
    filename: "0005_projection_replace_privilege.sql",
    checksum_sha256: "3421cbc8353b51f876701c062ab990eaad3833e3314b5273ed54e17b09fdbd54",
  },
  {
    version: 6,
    filename: "0006_rate_release_approval_lookup.sql",
    checksum_sha256: "72a938e1a9d5c862d873ce987c0cdb36247008d8b5d4b76aeec1aeabf6aa1c11",
  },
  {
    version: 7,
    filename: "0007_reservation_guest_delete_privilege.sql",
    checksum_sha256: "b39b67ed47e83f348f88dfa892dc5c6df75014822b2bf1084c97c51d2c6571db",
  },
  {
    version: 8,
    filename: "0008_party_search_indexes.sql",
    checksum_sha256: "88345b7d1cf6d7afbe1154b315bdc9569b7081b0cf5bcd1d864c9bad9b08270e",
  },
  {
    version: 9,
    filename: "0009_account_folio_integrity.sql",
    checksum_sha256: "56d3d47e2007d9106376459dc77623551f21731c5b6312e43e6ab100150205c2",
  },
  {
    version: 10,
    filename: "0010_financial_posting_integrity.sql",
    checksum_sha256: "859bdbbba98d858ac04e24f51751914c2cda10073b26c3c068ff8a27d4698ae3",
  },
  {
    version: 11,
    filename: "0011_security_definer_containment.sql",
    checksum_sha256: "6c9af4f72fa6be5a2c0e256624620c7ee8cf61d709c3ca99a37cd126bbe57796",
  },
  {
    version: 12,
    filename: "0012_app_role_nonlogin.sql",
    checksum_sha256: "6f377ca182bcbd8ece5c6a0688597b4a4e0fc5129345a80f6f9d31076fb0ed25",
  },
  {
    version: 13,
    filename: "0013_revoke_app_role_business_day_seal.sql",
    checksum_sha256: "75aef629ebc90a7c2ba3dcf94532295cfce57fc521197d7b5cdc6b6d5a1bf712",
  },
  {
    version: 14,
    filename: "0014_bind_occupancy_caller_tenant.sql",
    checksum_sha256: "706806ad3c041d506df1e90f75b19ed219baa3fedb8968471828657ab6c7493a",
  },
  {
    version: 15,
    filename: "0015_runtime_database_authority.sql",
    checksum_sha256: "758ca4b646d3f1aaf77ab9049b6b169510fe8671a73425780749b4d136d27daf",
  },
];

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL is required by bun run test:database");
}

let sql: SQL | undefined;
const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;

interface MigrationLedgerRow {
  readonly version: number | bigint;
  readonly filename: string;
  readonly checksum_sha256: string;
}

databaseDescribe("fresh deployment database acceptance", () => {
  beforeAll(() => { sql = new SQL(DATABASE_URL!); });
  afterAll(async () => { await sql?.close(); sql = undefined; });

  test("uses exact PostgreSQL 16.15 with pg_stat_statements preloaded and available", async () => {
    const rows = await sql!<{ version: string; preload: string; available: boolean }[]>`
      SELECT current_setting('server_version') AS version,
             current_setting('shared_preload_libraries') AS preload,
             EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_stat_statements') AS available
    `;
    expect(rows).toEqual([{ version: "16.15", preload: "pg_stat_statements", available: true }]);
  });

  test("has the exact migration ledger owned and isolated from app/public roles", async () => {
    const ledger = await sql!<MigrationLedgerRow[]>`
      SELECT version, filename, checksum_sha256
      FROM public.schema_migration
      ORDER BY version
    `;
    expect(ledger.map((row) => ({
      version: Number(row.version),
      filename: row.filename,
      checksum_sha256: row.checksum_sha256,
    }))).toEqual(EXPECTED_MIGRATIONS);

    const relation = await sql!<{ owner_matches: boolean; relrowsecurity: boolean; public_privileges: number; app_privileges: number }[]>`
      SELECT pg_get_userbyid(c.relowner) = 'yellow_owner' AS owner_matches,
             c.relrowsecurity,
             (SELECT count(*)::int FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl WHERE acl.grantee = 0) AS public_privileges,
             (SELECT count(*)::int
                FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege
               WHERE has_table_privilege('app_role', c.oid, privilege)) AS app_privileges
        FROM pg_class c
       WHERE c.oid = 'public.schema_migration'::regclass
    `;
    expect(relation).toEqual([{ owner_matches: true, relrowsecurity: false, public_privileges: 0, app_privileges: 0 }]);
  });

  test("yellow_owner owns all public tables/views and non-extension functions", async () => {
    const relations = await sql!<{ total: number; wrong_owner: number; app_owned: number }[]>`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE pg_get_userbyid(relowner) <> 'yellow_owner')::int AS wrong_owner,
             count(*) FILTER (WHERE pg_get_userbyid(relowner) = 'app_role')::int AS app_owned
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m')
    `;
    expect(relations[0]!.total).toBeGreaterThan(0);
    expect(relations[0]!.wrong_owner).toBe(0);
    expect(relations[0]!.app_owned).toBe(0);

    const functions = await sql!<{ total: number; wrong_owner: number }[]>`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE pg_get_userbyid(p.proowner) <> 'yellow_owner')::int AS wrong_owner
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND NOT EXISTS (
           SELECT 1 FROM pg_depend d
            WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
         )
    `;
    expect(functions[0]!.total).toBeGreaterThan(0);
    expect(functions[0]!.wrong_owner).toBe(0);
  });

  test("keeps app_role as an unassumable internal policy role", async () => {
    const role = await sql!<Array<{
      canLogin: boolean;
      connectionLimit: number;
      passwordIsNull: boolean;
      superuser: boolean;
      createDb: boolean;
      createRole: boolean;
      inherit: boolean;
      replication: boolean;
      bypassRls: boolean;
    }>>`
      SELECT rolcanlogin AS "canLogin", rolconnlimit AS "connectionLimit",
             rolpassword IS NULL AS "passwordIsNull", rolsuper AS superuser,
             rolcreatedb AS "createDb", rolcreaterole AS "createRole",
             rolinherit AS inherit, rolreplication AS replication,
             rolbypassrls AS "bypassRls"
        FROM pg_catalog.pg_authid
       WHERE rolname = 'app_role'
    `;
    expect(role).toEqual([{
      canLogin: false,
      connectionLimit: 0,
      passwordIsNull: true,
      superuser: false,
      createDb: false,
      createRole: false,
      inherit: false,
      replication: false,
      bypassRls: false,
    }]);

    const memberships = await sql!<{ count: number }[]>`
      SELECT count(*)::int AS count
        FROM pg_catalog.pg_auth_members
       WHERE roleid = 'app_role'::regrole OR member = 'app_role'::regrole
    `;
    expect(memberships).toEqual([{ count: 1 }]);
  });

  test("keeps business-day sealing deployment-owner-only", async () => {
    const authority = await sql!<Array<{
      ownerMatches: boolean;
      ownerExecute: boolean;
      publicExecute: boolean;
      appExecute: boolean;
    }>>`
      SELECT pg_get_userbyid(p.proowner) = 'yellow_owner' AS "ownerMatches",
             has_function_privilege('yellow_owner', p.oid, 'EXECUTE') AS "ownerExecute",
             has_function_privilege('public', p.oid, 'EXECUTE') AS "publicExecute",
             has_function_privilege('app_role', p.oid, 'EXECUTE') AS "appExecute"
        FROM pg_catalog.pg_proc AS p
       WHERE p.oid = 'public.seal_business_day(uuid,uuid,date,uuid)'::regprocedure
    `;
    expect(authority).toEqual([{
      ownerMatches: true,
      ownerExecute: true,
      publicExecute: false,
      appExecute: false,
    }]);
  });

  test("contains only the exact canonical demo tenant and property", async () => {
    const tenants = await sql!`SELECT id, slug, name, tier, residency, status FROM public.tenant ORDER BY id`;
    const properties = await sql!`
      SELECT id, tenant_id, path::text AS path, kind, name, timezone, currency, config
        FROM public.org_node ORDER BY id
    `;
    expect(tenants).toEqual([SEED_TENANT]);
    expect(properties).toEqual([{
      id: SEED_PROPERTY.id,
      tenant_id: SEED_PROPERTY.tenantId,
      path: SEED_PROPERTY.path,
      kind: SEED_PROPERTY.kind,
      name: SEED_PROPERTY.name,
      timezone: SEED_PROPERTY.timezone,
      currency: SEED_PROPERTY.currency,
      config: {},
    }]);
  });
});
