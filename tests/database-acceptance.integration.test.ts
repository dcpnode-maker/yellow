import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_DATABASE_ACCEPTANCE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_DATABASE_ACCEPTANCE === "1";
const BASELINE_SHA256 = "fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_DATABASE_ACCEPTANCE_URL is required by bun run test:database");
}

let sql: SQL | undefined;
const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;

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

  test("has exact immutable baseline ledger owned and isolated from app/public roles", async () => {
    const ledger = await sql!`SELECT version, filename, checksum_sha256 FROM public.schema_migration ORDER BY version`;
    expect(ledger).toHaveLength(1);
    expect(Number(ledger[0]?.version)).toBe(1);
    expect(ledger[0]?.filename).toBe("0001_init.sql");
    expect(ledger[0]?.checksum_sha256).toBe(BASELINE_SHA256);

    const relation = await sql!<{ owner_matches: boolean; relrowsecurity: boolean; public_privileges: number; app_privileges: number }[]>`
      SELECT pg_get_userbyid(c.relowner) = current_user AS owner_matches,
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

  test("deployment user owns all public tables/views and non-extension functions", async () => {
    const relations = await sql!<{ total: number; wrong_owner: number; app_owned: number }[]>`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE pg_get_userbyid(relowner) <> current_user)::int AS wrong_owner,
             count(*) FILTER (WHERE pg_get_userbyid(relowner) = 'app_role')::int AS app_owned
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m')
    `;
    expect(relations[0]!.total).toBeGreaterThan(0);
    expect(relations[0]!.wrong_owner).toBe(0);
    expect(relations[0]!.app_owned).toBe(0);

    const functions = await sql!<{ total: number; wrong_owner: number }[]>`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE pg_get_userbyid(p.proowner) <> current_user)::int AS wrong_owner
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
      config: "{}",
    }]);
  });
});
