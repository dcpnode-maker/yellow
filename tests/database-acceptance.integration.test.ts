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
    checksum_sha256: "cd201b7e0bc9a2fb538b32f69adb0900d7b2149f9cc82fd5e9a02056a573166a",
  },
  {
    version: 16,
    filename: "0016_runtime_dml_authority.sql",
    checksum_sha256: "216e79ab0b10a697b79e99872cbf3a65394dcdf94773af1fd4c13862f4e83fe5",
  },
  {
    version: 17,
    filename: "0017_financial_row_lock_capability.sql",
    checksum_sha256: "0d784fab670353b665e464d350e92ab5e6de401a131a737a63b86e1844a6ec81",
  },
  {
    version: 18,
    filename: "0018_extension_type_registration_capability.sql",
    checksum_sha256: "77e80f10c1c148fe79dcf71c546afe87fbdf97ac7f320644f5e550c88d409fc3",
  },
  {
    version: 19,
    filename: "0019_financial_reversal_authority.sql",
    checksum_sha256: "40cbd74f4c154ac23f56a1b69edf865c3a5904a98d2264ad6d962671414fcc4d",
  },
  {
    version: 20,
    filename: "0020_multi_window_folio_routing.sql",
    checksum_sha256: "137c9aea660aea953b86b8bdb1233af6385ddf73daa01a25bfa3149af416d9f1",
  },
  {
    version: 21,
    filename: "0021_token_only_payment_foundation.sql",
    checksum_sha256: "8538168ae7158c4a3f4b1f93b9bae5bcc1f9fb5d6e45327486e0a68bba04dcc1",
  },
  {
    version: 22,
    filename: "0022_hosted_deposit_workbench.sql",
    checksum_sha256: "a906182ea41fb3f92617900716c6a6523ac7a34af2651b6907781f6607080dfd",
  },
  {
    version: 23,
    filename: "0023_folio_settlement_capability.sql",
    checksum_sha256: "1209d2cf1e7b7c949640a8da0202633c6713d0006f3f17752e976195186ea933",
  },
  {
    version: 24,
    filename: "0024_governed_cashier_sessions.sql",
    checksum_sha256: "8884596df1155a308c752e733834e9cdcf95dd462b286450c6dbc3ae22b50e76",
  },
  {
    version: 25,
    filename: "0025_governed_receivable_transfer.sql",
    checksum_sha256: "ce3fe52783ffb467f56a2a7342c0a5808ab8824d625f3b01b5e3532e1191c9fe",
  },
  {
    version: 26,
    filename: "0026_governed_housekeeping_task_transition.sql",
    checksum_sha256: "f3667d8443db21ad921512bfadc453e9a9f341b60594f888dad7f69a88f0fba6",
  },
  {
    version: 27,
    filename: "0027_governed_housekeeping_task_sheet_generation.sql",
    checksum_sha256: "fb46db4af1ebca0dd1d66501e51ed2064c5dc108a40701a6a7b00d170b30be43",
  },
  {
    version: 28,
    filename: "0028_governed_reservation_travel.sql",
    checksum_sha256: "c282ca42fe52d7ea6bc0de077fa3842c5d578a56de5ecc6ceb108963f61391b6",
  },
  {
    version: 29,
    filename: "0029_governed_arrival_pickup_task.sql",
    checksum_sha256: "44bfef33a0cb775ed790a7df6d6510e23286cb1570fe5565473e8b422a2d1576",
  },
  {
    version: 30,
    filename: "0030_governed_unit_condition_initialization.sql",
    checksum_sha256: "2afcace484bcba5f3513a92102216f8f73da2159e1f2348f6870b459fcef8524",
  },
  {
    version: 31,
    filename: "0031_governed_arrival_pickup_task_transition.sql",
    checksum_sha256: "e337fcb52b38e98d5877f3ce927dd54825d465d90328104d87e1df83a187598f",
  },
  {
    version: 32,
    filename: "0032_governed_arrival_room_cleaning_task.sql",
    checksum_sha256: "f69c72349c237d635826136575ec1c66ccb48cf0f0ac9b3ea4a83f786b2a6718",
  },
  {
    version: 33,
    filename: "0033_governed_due_in_room_assignment.sql",
    checksum_sha256: "cd983c31250bc5ace863fe156bc6aa15927eac74ba24ab449eff692e87aae82d",
  },
  {
    version: 34,
    filename: "0034_runtime_due_arrival_scopes.sql",
    checksum_sha256: "b59480ab270c8822c9f972de527fc47ab73c411dc9037d37e6d3d326f19cc21a",
  },
  {
    version: 35,
    filename: "0035_runtime_due_departure_scopes.sql",
    checksum_sha256: "ee102c6e479badc14fb8945d0c493905840d1c58845b9def4d74d6e2bf1a7447",
  },
  {
    version: 36,
    filename: "0036_governed_room_discrepancy_reporting.sql",
    checksum_sha256: "bd72ca9ff3b02d4f0c00b4ce82a6afb1591056b71a04cebda71b61efacc61b76",
  },
  {
    version: 37,
    filename: "0037_governed_vehicle_parking_assignment.sql",
    checksum_sha256: "82df1de46ee97771390d1d102142380b40b590456f687fdd1bd0cd1d3a4d601a",
  },
  {
    version: 38,
    filename: "0038_canonical_tax_attribution_persistence.sql",
    checksum_sha256: "dea9cfaf573d56ce2c0f5ee7987bf7009d12d0517f72dcd8a3b316232937f982",
  },
  {
    version: 39,
    filename: "0039_parking_occupancy_definer_path_repair.sql",
    checksum_sha256: "365ffb951f4ea5f4febac97ed7a4d86d5c342891d0d5464e8a36a73653c1b841",
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

  test("has the exact governed cashier schema, RLS and bounded capability authority", async () => {
    const shape = await sql!<Array<{ tables: number; policies: number }>>`
      SELECT
        (SELECT count(*)::int FROM pg_catalog.pg_tables WHERE schemaname = 'public') AS tables,
        (SELECT count(*)::int FROM pg_catalog.pg_policies WHERE schemaname = 'public') AS policies
    `;
    expect(shape).toEqual([{ tables: 94, policies: 84 }]);

    const relations = await sql!<Array<{
      relation: string;
      rls: boolean;
      appSelect: boolean;
      appMutation: boolean;
    }>>`
      SELECT class.relname AS relation,
             class.relrowsecurity AS rls,
             has_table_privilege('app_role', class.oid, 'SELECT') AS "appSelect",
             (
               has_table_privilege('app_role', class.oid, 'INSERT')
               OR has_table_privilege('app_role', class.oid, 'UPDATE')
               OR has_table_privilege('app_role', class.oid, 'DELETE')
               OR has_table_privilege('app_role', class.oid, 'TRUNCATE')
             ) AS "appMutation"
        FROM pg_catalog.pg_class AS class
       WHERE class.oid = ANY(ARRAY[
         'public.cash_drawer'::regclass,
         'public.cash_drawer_denomination'::regclass,
         'public.cashier_count'::regclass,
         'public.cashier_count_line'::regclass
       ])
       ORDER BY relation
    `;
    expect(relations).toEqual([
      { relation: "cash_drawer", rls: true, appSelect: true, appMutation: false },
      { relation: "cash_drawer_denomination", rls: true, appSelect: true, appMutation: false },
      { relation: "cashier_count", rls: true, appSelect: true, appMutation: false },
      { relation: "cashier_count_line", rls: true, appSelect: true, appMutation: false },
    ]);

    const functions = await sql!<Array<{
      signature: string;
      owner: string;
      securityDefiner: boolean;
      config: string[];
      appExecute: boolean;
      runtimeExecute: boolean;
      publicExecute: boolean;
    }>>`
      SELECT procedure.oid::regprocedure::text AS signature,
             pg_catalog.pg_get_userbyid(procedure.proowner) AS owner,
             procedure.prosecdef AS "securityDefiner",
             procedure.proconfig AS config,
             pg_catalog.has_function_privilege('app_role', procedure.oid, 'EXECUTE') AS "appExecute",
             pg_catalog.has_function_privilege('yellow_runtime', procedure.oid, 'EXECUTE') AS "runtimeExecute",
             pg_catalog.has_function_privilege('public', procedure.oid, 'EXECUTE') AS "publicExecute"
        FROM pg_catalog.pg_proc AS procedure
        JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
       WHERE namespace.nspname = 'public'
         AND procedure.proname IN (
           'open_cashier_session', 'append_cashier_count', 'close_cashier_session'
         )
       ORDER BY signature
    `;
    expect(functions).toEqual([
      {
        signature: "append_cashier_count(uuid,uuid,uuid,uuid,bigint[],bigint[])",
        owner: "yellow_owner", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"],
        appExecute: true, runtimeExecute: false, publicExecute: false,
      },
      {
        signature: "close_cashier_session(uuid,uuid,uuid,uuid,uuid,uuid,text,boolean)",
        owner: "yellow_owner", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"],
        appExecute: true, runtimeExecute: false, publicExecute: false,
      },
      {
        signature: "open_cashier_session(uuid,uuid,uuid,uuid,bigint[],bigint[])",
        owner: "yellow_owner", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"],
        appExecute: true, runtimeExecute: false, publicExecute: false,
      },
    ]);
  });

  test("has exact journal approval lineage and governed receivable-transfer authority", async () => {
    const shape = await sql!<Array<{
      tables: number; policies: number; directBill: number;
      approvalNullable: boolean; compositeFk: boolean; oneUseIndex: boolean;
      appApprovalInsert: boolean; appApprovalUpdate: boolean;
    }>>`
      SELECT
        (SELECT count(*)::int FROM pg_catalog.pg_tables WHERE schemaname = 'public') AS tables,
        (SELECT count(*)::int FROM pg_catalog.pg_policies WHERE schemaname = 'public') AS policies,
        (SELECT count(*)::int FROM public.tx_code
          WHERE code = 'DIRECT_BILL' AND name = 'Direct billing transfer'
            AND grp = 'transfer' AND usali_line IS NULL
            AND default_dr = 'company' AND default_cr = 'guest') AS "directBill",
        (SELECT is_nullable = 'YES' FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'journal'
            AND column_name = 'approval_request_id') AS "approvalNullable",
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_constraint
           WHERE conrelid = 'public.journal'::regclass
             AND conname = 'journal_approval_request_fk'
             AND pg_catalog.pg_get_constraintdef(oid) =
               'FOREIGN KEY (tenant_id, approval_request_id) REFERENCES approval_request(tenant_id, id)'
        ) AS "compositeFk",
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_indexes
           WHERE schemaname = 'public' AND tablename = 'journal'
             AND indexname = 'journal_one_use_approval'
             AND indexdef LIKE 'CREATE UNIQUE INDEX% (tenant_id, approval_request_id) WHERE (approval_request_id IS NOT NULL)'
        ) AS "oneUseIndex",
        has_column_privilege('app_role','public.journal','approval_request_id','INSERT') AS "appApprovalInsert",
        has_column_privilege('app_role','public.journal','approval_request_id','UPDATE') AS "appApprovalUpdate"
    `;
    expect(shape).toEqual([{
      tables: 94, policies: 84, directBill: 1,
      approvalNullable: true, compositeFk: true, oneUseIndex: true,
      appApprovalInsert: false, appApprovalUpdate: false,
    }]);

    const functions = await sql!<Array<{
      signature: string; owner: string; securityDefiner: boolean; config: string[];
      appExecute: boolean; runtimeExecute: boolean; publicExecute: boolean;
    }>>`
      SELECT procedure.oid::regprocedure::text AS signature,
             pg_catalog.pg_get_userbyid(procedure.proowner) AS owner,
             procedure.prosecdef AS "securityDefiner", procedure.proconfig AS config,
             pg_catalog.has_function_privilege('app_role', procedure.oid, 'EXECUTE') AS "appExecute",
             pg_catalog.has_function_privilege('yellow_runtime', procedure.oid, 'EXECUTE') AS "runtimeExecute",
             pg_catalog.has_function_privilege('public', procedure.oid, 'EXECUTE') AS "publicExecute"
        FROM pg_catalog.pg_proc AS procedure
       WHERE procedure.oid =
         'public.create_receivable_transfer(uuid,uuid,uuid,uuid,uuid,uuid,text)'::regprocedure
    `;
    expect(functions).toEqual([{
      signature: "create_receivable_transfer(uuid,uuid,uuid,uuid,uuid,uuid,text)",
      owner: "yellow_owner", securityDefiner: true,
      config: ["search_path=pg_catalog, public, pg_temp"],
      appExecute: true, runtimeExecute: false, publicExecute: false,
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
