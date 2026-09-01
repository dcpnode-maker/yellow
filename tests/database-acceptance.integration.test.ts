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
  {
    version: 40,
    filename: "0040_quoted_tax_hold_binding.sql",
    checksum_sha256: "b61d1332acf17df9189612d355fb584754bdd7ddda9782e377bf73be44cc589b",
  },
  {
    version: 41,
    filename: "0041_quoted_tax_reservation_lineage.sql",
    checksum_sha256: "96795066ed0ae795044a56c7fbef33087e8c7fa94647b22482ee6b48ed06f171",
  },
  {
    version: 42,
    filename: "0042_quoted_tax_reservation_no_binding_compatibility.sql",
    checksum_sha256: "dd2622f024859231a6128f649276bb4904d60f2380de9324196c22ac43b0c098",
  },
  {
    version: 43,
    filename: "0043_positive_tax_semantic_route.sql",
    checksum_sha256: "a5036df30f07c4c8add08c46cdb805c71b87597efa542e368e64aa35d572bf40",
  },
  {
    version: 44,
    filename: "0044_governed_positive_tax_posting.sql",
    checksum_sha256: "5ea338b18aabb3cb2c5a4613c00ebf57806be881b956b13df1e2c95262cce55c",
  },
  {
    version: 45,
    filename: "0045_governed_positive_tax_correction.sql",
    checksum_sha256: "aec7f04eaa0536568adf68d51d7e2fa3ff578cd043b3079c080a680d6e210dba",
  },
  {
    version: 46,
    filename: "0046_positive_tax_posting_ordinal_repair.sql",
    checksum_sha256: "bd7fb83f619aabf76b7247246a096ca09275823d07cbdceeb2deec8a1e76b574",
  },
  {
    version: 47,
    filename: "0047_property_fiscal_registration.sql",
    checksum_sha256: "7e5b8a912230ebbd7cf033b4883a7138ba5ae2d9fcb007dda42b5345d1c95bf0",
  },
  {
    version: 48,
    filename: "0048_party_fiscal_registration.sql",
    checksum_sha256: "d57c5db53f75d719ef2e802a738f815cd03a54a87dbdec1f8813574666e0012f",
  },
  {
    version: 49,
    filename: "0049_property_fiscal_location.sql",
    checksum_sha256: "7efed30ed6d84b7229ec298425925c38d28c13dc570f8e03eabc35fe17c276b4",
  },
  {
    version: 50,
    filename: "0050_india_gst_item_classification.sql",
    checksum_sha256: "a3eeba9a7a4b00c580c822126b8c48d17053c9acaccbf15538cadfddb47d9433",
  },
  {
    version: 51,
    filename: "0051_india_gst_supplier_service_location.sql",
    checksum_sha256: "af457264bb976d64930022eb4686a55096248bf0b9e1f13151454b47d47b2496",
  },
  {
    version: 52,
    filename: "0052_india_gst_recipient_sez_status.sql",
    checksum_sha256: "7a318a99c4e3e40722fc97c0445b3475e7cedc10feb651b4c5049f4e3afd65da",
  },
  {
    version: 53,
    filename: "0053_india_gst_supplier_sez_status.sql",
    checksum_sha256: "e5208a1698c06db64842946876c90912c03d9aa0481ed0ceced6fa0295020c3d",
  },
  {
    version: 54,
    filename: "0054_india_sez_unit_loa_renewal.sql",
    checksum_sha256: "54a65ae32acfc5e232037129685a7c7edfb950aa66b54d4ea053c7acf11bb717",
  },
  {
    version: 55,
    filename: "0055_india_gst_supplier_registration_status.sql",
    checksum_sha256: "c0f50dc59178da55cd89ad06bcbd4ee48f36a48e154c07e41b089a7608cb1f80",
  },
  {
    version: 56,
    filename: "0056_india_gst_accommodation_service_provision_date.sql",
    checksum_sha256: "920b98c03e65e7ed968b2fe277f6f9d67185be125a68aec3123b9ad0b8f27658",
  },
  {
    version: 57,
    filename: "0057_india_gst_accommodation_payment_receipt_date.sql",
    checksum_sha256: "12108a774929f7541090c628d28972b313498d51cd84b0d3a9ccd6b541d25117",
  },
  {
    version: 58,
    filename: "0058_india_gst_accommodation_invoice_issue_date.sql",
    checksum_sha256: "d2eaf70479a602ec82dc5abe73442475abb80ed8ec3f2ef3ec333b182c30dddf",
  },
  {
    version: 59,
    filename: "0059_tax_extension_effective_period.sql",
    checksum_sha256: "b920169d3776ff8f9804b8273c27a35d750a704919f3f1012af50ec94166f2e8",
  },
  {
    version: 60,
    filename: "0060_owner_trust_negative_authorization.sql",
    checksum_sha256: "2379fed5d09385a19f6abcc2a27582b3d1d77495a7b3c1b49437d66baade4f11",
  },
  {
    version: 61,
    filename: "0061_runtime_due_business_day_scopes.sql",
    checksum_sha256: "50cf8593ac385b74fbe61da9d28f0ecf59b78297c7aff46ad073f34409efc34f",
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

    const catalogue = await sql!<Array<{
      migrations: number; tables: number; rlsTables: number;
      policies: number; forceRlsTables: number;
    }>>`
      SELECT
        (SELECT count(*)::int FROM public.schema_migration) AS migrations,
        (SELECT count(*)::int FROM pg_catalog.pg_tables
          WHERE schemaname = 'public') AS tables,
        (SELECT count(*)::int
           FROM pg_catalog.pg_class AS class
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
          WHERE namespace.nspname = 'public'
            AND class.relkind IN ('r', 'p')
            AND class.relrowsecurity) AS "rlsTables",
        (SELECT count(*)::int FROM pg_catalog.pg_policies
          WHERE schemaname = 'public') AS policies,
        (SELECT count(*)::int
           FROM pg_catalog.pg_class AS class
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
          WHERE namespace.nspname = 'public'
            AND class.relkind IN ('r', 'p')
            AND class.relforcerowsecurity) AS "forceRlsTables"
    `;
    expect(catalogue).toEqual([{
      migrations: 61, tables: 111, rlsTables: 101, policies: 101, forceRlsTables: 10,
    }]);
  });

  test("has the exact configured positive-tax semantic-route schema and read-only runtime ACL", async () => {
    const relation = await sql!<Array<{
      owner: string;
      rls: boolean;
      columns: string;
      types: string;
      notNull: string;
      appSelect: boolean;
      appMutation: boolean;
      publicPrivileges: number;
      runtimePrivileges: number;
      policyCount: number;
      policyUsesNullifContext: boolean;
      constraintCount: number;
      requiredConstraints: number;
      identityNullsNotDistinct: boolean;
      tenantLeadingLookup: boolean;
    }>>`
      SELECT pg_catalog.pg_get_userbyid(cls.relowner) AS owner,
             cls.relrowsecurity AS rls,
             (
               SELECT pg_catalog.string_agg(attribute.attname, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS columns,
             (
               SELECT pg_catalog.string_agg(
                 pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
                 ',' ORDER BY attribute.attnum
               )
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS types,
             (
               SELECT pg_catalog.string_agg(attribute.attnotnull::text, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS "notNull",
             pg_catalog.has_table_privilege('app_role', cls.oid, 'SELECT') AS "appSelect",
             (
               pg_catalog.has_table_privilege('app_role', cls.oid, 'INSERT')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'UPDATE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'DELETE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'TRUNCATE')
             ) AS "appMutation",
             (
               SELECT count(*)::int
                 FROM pg_catalog.aclexplode(
                   COALESCE(cls.relacl, pg_catalog.acldefault('r', cls.relowner))
                 ) AS acl
                WHERE acl.grantee = 0
             ) AS "publicPrivileges",
             (
               SELECT count(*)::int
                 FROM unnest(ARRAY[
                   'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                 ]) AS privilege
                WHERE pg_catalog.has_table_privilege('yellow_runtime', cls.oid, privilege)
             ) AS "runtimePrivileges",
             (
               SELECT count(*)::int FROM pg_catalog.pg_policy
                WHERE polrelid = cls.oid AND polname = 'tenant_isolation'
             ) AS "policyCount",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_policy AS policy
                WHERE policy.polrelid = cls.oid
                  AND policy.polname = 'tenant_isolation'
                  AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
                  AND pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
             ) AS "policyUsesNullifContext",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
             ) AS "constraintCount",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
                  AND conname = ANY(ARRAY[
                    'tax_semantic_route_pk',
                    'tax_semantic_route_identity_uq',
                    'tax_semantic_route_property_fk',
                    'tax_semantic_route_extension_fk',
                    'tax_semantic_route_tx_code_fk',
                    'tax_semantic_route_configured_route_fk',
                    'tax_semantic_route_currency_ck',
                    'tax_semantic_route_jurisdiction_version_ck',
                    'tax_semantic_route_jurisdiction_hash_ck',
                    'tax_semantic_route_jurisdiction_key_ck',
                    'tax_semantic_route_jurisdiction_owner_ck',
                    'tax_semantic_route_semantic_ck'
                  ])
             ) AS "requiredConstraints",
             EXISTS (
               SELECT 1
                 FROM pg_catalog.pg_index AS index
                 JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index.indexrelid
                WHERE index.indrelid = cls.oid
                  AND index_class.relname = 'tax_semantic_route_identity_uq'
                  AND index.indisunique
                  AND index.indnullsnotdistinct
             ) AS "identityNullsNotDistinct",
             EXISTS (
               SELECT 1
                 FROM pg_catalog.pg_index AS index
                 JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index.indexrelid
                 JOIN pg_catalog.pg_attribute AS leading_attribute
                   ON leading_attribute.attrelid = cls.oid
                  AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                WHERE index.indrelid = cls.oid
                  AND index_class.relname = 'tax_semantic_route_lookup'
                  AND leading_attribute.attname = 'tenant_id'
             ) AS "tenantLeadingLookup"
        FROM pg_catalog.pg_class AS cls
       WHERE cls.oid = 'public.tax_semantic_route'::regclass
    `;
    expect(relation).toEqual([{
      owner: "yellow_owner",
      rls: true,
      columns: "tenant_id,id,property_node,currency,jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,semantic_kind,semantic_code,tx_code",
      types: "uuid,uuid,uuid,character(3),uuid,uuid,text,integer,text,text,text,text",
      notNull: "true,true,true,true,true,false,true,true,true,true,true,true",
      appSelect: true,
      appMutation: false,
      publicPrivileges: 0,
      runtimePrivileges: 0,
      policyCount: 1,
      policyUsesNullifContext: true,
      constraintCount: 12,
      requiredConstraints: 12,
      identityNullsNotDistinct: true,
      tenantLeadingLookup: true,
    }]);

    const foreignKeys = await sql!<Array<{ name: string; definition: string }>>`
      SELECT constraint_row.conname AS name,
             pg_catalog.pg_get_constraintdef(constraint_row.oid) AS definition
        FROM pg_catalog.pg_constraint AS constraint_row
       WHERE constraint_row.conrelid = 'public.tax_semantic_route'::regclass
         AND constraint_row.contype = 'f'
       ORDER BY constraint_row.conname
    `;
    expect(foreignKeys).toEqual([
      {
        name: "tax_semantic_route_configured_route_fk",
        definition: "FOREIGN KEY (tenant_id, property_node, currency, tx_code) REFERENCES tx_code_route(tenant_id, property_node, currency, tx_code)",
      },
      {
        name: "tax_semantic_route_extension_fk",
        definition: "FOREIGN KEY (jurisdiction_extension_id) REFERENCES extension(id)",
      },
      {
        name: "tax_semantic_route_property_fk",
        definition: "FOREIGN KEY (tenant_id, property_node) REFERENCES org_node(tenant_id, id)",
      },
      {
        name: "tax_semantic_route_tx_code_fk",
        definition: "FOREIGN KEY (tx_code) REFERENCES tx_code(code)",
      },
    ]);

    const appRead = await sql!.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
      return tx<{ count: number }[]>`
        SELECT count(*)::int AS count FROM public.tax_semantic_route
      `;
    });
    expect(appRead).toEqual([{ count: 0 }]);

    try {
      await sql!.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE app_role");
        await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
        await tx.unsafe("INSERT INTO public.tax_semantic_route DEFAULT VALUES");
      });
      throw new Error("app_role unexpectedly mutated tax_semantic_route");
    } catch (error) {
      expect((error as { errno?: string }).errno).toBe("42501");
    }
  });

  test("has exact India GST property-registration schema, RLS and SELECT-only app authority", async () => {
    const relation = await sql!<Array<{
      owner: string;
      rls: boolean;
      columns: string;
      types: string;
      notNull: string;
      appSelect: boolean;
      appMutation: boolean;
      publicPrivileges: number;
      runtimePrivileges: number;
      policyCount: number;
      policyUsesNullifContext: boolean;
      constraintCount: number;
      requiredConstraints: number;
      identityNullsNotDistinct: boolean;
      tenantLeadingLookup: boolean;
    }>>`
      SELECT pg_catalog.pg_get_userbyid(cls.relowner) AS owner,
             cls.relrowsecurity AS rls,
             (
               SELECT pg_catalog.string_agg(attribute.attname, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS columns,
             (
               SELECT pg_catalog.string_agg(
                 pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
                 ',' ORDER BY attribute.attnum
               )
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS types,
             (
               SELECT pg_catalog.string_agg(attribute.attnotnull::text, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS "notNull",
             pg_catalog.has_table_privilege('app_role', cls.oid, 'SELECT') AS "appSelect",
             (
               pg_catalog.has_table_privilege('app_role', cls.oid, 'INSERT')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'UPDATE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'DELETE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'TRUNCATE')
             ) AS "appMutation",
             (
               SELECT count(*)::int
                 FROM pg_catalog.aclexplode(
                   COALESCE(cls.relacl, pg_catalog.acldefault('r', cls.relowner))
                 ) AS acl
                WHERE acl.grantee = 0
             ) AS "publicPrivileges",
             (
               SELECT count(*)::int
                 FROM unnest(ARRAY[
                   'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                 ]) AS privilege
                WHERE pg_catalog.has_table_privilege('yellow_runtime', cls.oid, privilege)
             ) AS "runtimePrivileges",
             (
               SELECT count(*)::int FROM pg_catalog.pg_policy
                WHERE polrelid = cls.oid AND polname = 'tenant_isolation'
             ) AS "policyCount",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_policy AS policy
                WHERE policy.polrelid = cls.oid
                  AND policy.polname = 'tenant_isolation'
                  AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
                  AND pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
             ) AS "policyUsesNullifContext",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
             ) AS "constraintCount",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
                  AND conname = ANY(ARRAY[
                    'property_fiscal_registration_pk',
                    'property_fiscal_registration_identity_uq',
                    'property_fiscal_registration_property_fk',
                    'property_fiscal_registration_extension_fk',
                    'property_fiscal_registration_scheme_ck',
                    'property_fiscal_registration_currency_ck',
                    'property_fiscal_registration_jurisdiction_owner_ck',
                    'property_fiscal_registration_jurisdiction_key_ck',
                    'property_fiscal_registration_jurisdiction_version_ck',
                    'property_fiscal_registration_jurisdiction_hash_ck',
                    'property_fiscal_registration_registration_ck',
                    'property_fiscal_registration_region_ck',
                    'property_fiscal_registration_registration_region_ck',
                    'property_fiscal_registration_legal_name_ck',
                    'property_fiscal_registration_trade_name_ck',
                    'property_fiscal_registration_address_line_ck',
                    'property_fiscal_registration_locality_ck',
                    'property_fiscal_registration_postal_code_ck'
                  ])
             ) AS "requiredConstraints",
             EXISTS (
               SELECT 1
                 FROM pg_catalog.pg_index AS index
                 JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index.indexrelid
                WHERE index.indrelid = cls.oid
                  AND index_class.relname = 'property_fiscal_registration_identity_uq'
                  AND index.indisunique
                  AND index.indnullsnotdistinct
             ) AS "identityNullsNotDistinct",
             EXISTS (
               SELECT 1
                 FROM pg_catalog.pg_index AS index
                 JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index.indexrelid
                 JOIN pg_catalog.pg_attribute AS leading_attribute
                   ON leading_attribute.attrelid = cls.oid
                  AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                WHERE index.indrelid = cls.oid
                  AND index_class.relname = 'property_fiscal_registration_lookup'
                  AND leading_attribute.attname = 'tenant_id'
             ) AS "tenantLeadingLookup"
        FROM pg_catalog.pg_class AS cls
       WHERE cls.oid = 'public.property_fiscal_registration'::regclass
    `;
    expect(relation).toEqual([{
      owner: "yellow_owner",
      rls: true,
      columns: "tenant_id,id,property_node,scheme,currency,jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,registration_number,region_code,legal_name,trade_name,address_line,locality,postal_code",
      types: "uuid,uuid,uuid,text,character(3),uuid,uuid,text,integer,text,text,text,text,text,text,text,text",
      notNull: "true,true,true,true,true,true,false,true,true,true,true,true,true,false,true,true,true",
      appSelect: true,
      appMutation: false,
      publicPrivileges: 0,
      runtimePrivileges: 0,
      policyCount: 1,
      policyUsesNullifContext: true,
      constraintCount: 18,
      requiredConstraints: 18,
      identityNullsNotDistinct: true,
      tenantLeadingLookup: true,
    }]);

    const foreignKeys = await sql!<Array<{ name: string; definition: string }>>`
      SELECT constraint_row.conname AS name,
             pg_catalog.pg_get_constraintdef(constraint_row.oid) AS definition
        FROM pg_catalog.pg_constraint AS constraint_row
       WHERE constraint_row.conrelid = 'public.property_fiscal_registration'::regclass
         AND constraint_row.contype = 'f'
       ORDER BY constraint_row.conname
    `;
    expect(foreignKeys).toEqual([
      {
        name: "property_fiscal_registration_extension_fk",
        definition: "FOREIGN KEY (jurisdiction_extension_id) REFERENCES extension(id)",
      },
      {
        name: "property_fiscal_registration_property_fk",
        definition: "FOREIGN KEY (tenant_id, property_node) REFERENCES org_node(tenant_id, id)",
      },
    ]);

    const appRead = await sql!.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
      return tx<{ count: number }[]>`
        SELECT count(*)::int AS count FROM public.property_fiscal_registration
      `;
    });
    expect(appRead).toEqual([{ count: 0 }]);

    try {
      await sql!.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE app_role");
        await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
        await tx.unsafe("INSERT INTO public.property_fiscal_registration DEFAULT VALUES");
      });
      throw new Error("app_role unexpectedly mutated property_fiscal_registration");
    } catch (error) {
      expect((error as { errno?: string }).errno).toBe("42501");
    }
  });

  test("has exact India property fiscal-location schema, forced RLS and SELECT-only app authority", async () => {
    const relation = await sql!<Array<{
      owner: string;
      rls: boolean;
      forceRls: boolean;
      columns: string;
      types: string;
      notNull: string;
      appSelect: boolean;
      appMutation: boolean;
      publicPrivileges: number;
      runtimePrivileges: number;
      policyCount: number;
      policyUsesNullifContext: boolean;
      constraintCount: number;
      requiredConstraints: number;
      primaryKeyIsTenantProperty: boolean;
      tenantLeadingIndexes: number;
      totalIndexes: number;
    }>>`
      SELECT pg_catalog.pg_get_userbyid(cls.relowner) AS owner,
             cls.relrowsecurity AS rls,
             cls.relforcerowsecurity AS "forceRls",
             (
               SELECT pg_catalog.string_agg(attribute.attname, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS columns,
             (
               SELECT pg_catalog.string_agg(
                 pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
                 ',' ORDER BY attribute.attnum
               )
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS types,
             (
               SELECT pg_catalog.string_agg(attribute.attnotnull::text, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS "notNull",
             pg_catalog.has_table_privilege('app_role', cls.oid, 'SELECT') AS "appSelect",
             (
               pg_catalog.has_table_privilege('app_role', cls.oid, 'INSERT')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'UPDATE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'DELETE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'TRUNCATE')
             ) AS "appMutation",
             (
               SELECT count(*)::int
                 FROM pg_catalog.aclexplode(
                   COALESCE(cls.relacl, pg_catalog.acldefault('r', cls.relowner))
                 ) AS acl
                WHERE acl.grantee = 0
             ) AS "publicPrivileges",
             (
               SELECT count(*)::int
                 FROM unnest(ARRAY[
                   'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                 ]) AS privilege
                WHERE pg_catalog.has_table_privilege('yellow_runtime', cls.oid, privilege)
             ) AS "runtimePrivileges",
             (
               SELECT count(*)::int FROM pg_catalog.pg_policy
                WHERE polrelid = cls.oid AND polname = 'tenant_isolation'
             ) AS "policyCount",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_policy AS policy
                WHERE policy.polrelid = cls.oid
                  AND policy.polname = 'tenant_isolation'
                  AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
                  AND pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
             ) AS "policyUsesNullifContext",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
             ) AS "constraintCount",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
                  AND conname = ANY(ARRAY[
                    'property_fiscal_location_pk',
                    'property_fiscal_location_property_fk',
                    'property_fiscal_location_country_ck',
                    'property_fiscal_location_state_ck',
                    'property_fiscal_location_address_line1_ck',
                    'property_fiscal_location_locality_ck',
                    'property_fiscal_location_pin_ck'
                  ])
             ) AS "requiredConstraints",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                WHERE constraint_row.conrelid = cls.oid
                  AND constraint_row.conname = 'property_fiscal_location_pk'
                  AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                    = 'PRIMARY KEY (tenant_id, property_node)'
             ) AS "primaryKeyIsTenantProperty",
             (
               SELECT count(*)::int
                 FROM pg_catalog.pg_index AS index
                 JOIN pg_catalog.pg_attribute AS leading_attribute
                   ON leading_attribute.attrelid = cls.oid
                  AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                WHERE index.indrelid = cls.oid
                  AND leading_attribute.attname = 'tenant_id'
             ) AS "tenantLeadingIndexes",
             (
               SELECT count(*)::int FROM pg_catalog.pg_index AS index
                WHERE index.indrelid = cls.oid
             ) AS "totalIndexes"
        FROM pg_catalog.pg_class AS cls
       WHERE cls.oid = 'public.property_fiscal_location'::regclass
    `;
    expect(relation).toEqual([{
      owner: "yellow_owner",
      rls: true,
      forceRls: true,
      columns: "tenant_id,property_node,country_code,state_code,address_line1,locality,pin",
      types: "uuid,uuid,character(2),text,text,text,text",
      notNull: "true,true,true,true,true,true,true",
      appSelect: true,
      appMutation: false,
      publicPrivileges: 0,
      runtimePrivileges: 0,
      policyCount: 1,
      policyUsesNullifContext: true,
      constraintCount: 7,
      requiredConstraints: 7,
      primaryKeyIsTenantProperty: true,
      tenantLeadingIndexes: 1,
      totalIndexes: 1,
    }]);

    const foreignKeys = await sql!<Array<{ name: string; definition: string }>>`
      SELECT constraint_row.conname AS name,
             pg_catalog.pg_get_constraintdef(constraint_row.oid) AS definition
        FROM pg_catalog.pg_constraint AS constraint_row
       WHERE constraint_row.conrelid = 'public.property_fiscal_location'::regclass
         AND constraint_row.contype = 'f'
       ORDER BY constraint_row.conname
    `;
    expect(foreignKeys).toEqual([{
      name: "property_fiscal_location_property_fk",
      definition: "FOREIGN KEY (tenant_id, property_node) REFERENCES org_node(tenant_id, id)",
    }]);

    const appRead = await sql!.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
      return tx<{ count: number }[]>`
        SELECT count(*)::int AS count FROM public.property_fiscal_location
      `;
    });
    expect(appRead).toEqual([{ count: 0 }]);

    try {
      await sql!.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE app_role");
        await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
        await tx.unsafe("INSERT INTO public.property_fiscal_location DEFAULT VALUES");
      });
      throw new Error("app_role unexpectedly mutated property_fiscal_location");
    } catch (error) {
      expect((error as { errno?: string }).errno).toBe("42501");
    }
  });

  test("has exact India GST accommodation-classification schema, forced RLS and SELECT-only app authority", async () => {
    const relation = await sql!<Array<{
      owner: string; rls: boolean; forceRls: boolean;
      columns: string; types: string; notNull: string;
      appSelect: boolean; appMutation: boolean;
      publicPrivileges: number; runtimePrivileges: number;
      policyCount: number; policyUsesNullifContext: boolean;
      constraintCount: number; requiredConstraints: number;
      identityNullsNotDistinct: boolean;
      tenantLeadingIndexes: number; totalIndexes: number;
    }>>`
      SELECT pg_catalog.pg_get_userbyid(cls.relowner) AS owner,
             cls.relrowsecurity AS rls,
             cls.relforcerowsecurity AS "forceRls",
             (
               SELECT pg_catalog.string_agg(attribute.attname, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS columns,
             (
               SELECT pg_catalog.string_agg(
                 pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
                 ',' ORDER BY attribute.attnum
               )
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS types,
             (
               SELECT pg_catalog.string_agg(attribute.attnotnull::text, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS "notNull",
             pg_catalog.has_table_privilege('app_role', cls.oid, 'SELECT') AS "appSelect",
             (
               pg_catalog.has_table_privilege('app_role', cls.oid, 'INSERT')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'UPDATE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'DELETE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'TRUNCATE')
             ) AS "appMutation",
             (
               SELECT count(*)::int
                 FROM pg_catalog.aclexplode(
                   COALESCE(cls.relacl, pg_catalog.acldefault('r', cls.relowner))
                 ) AS acl
                WHERE acl.grantee = 0
             ) AS "publicPrivileges",
             (
               SELECT count(*)::int
                 FROM unnest(ARRAY[
                   'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                 ]) AS privilege
                WHERE pg_catalog.has_table_privilege('yellow_runtime', cls.oid, privilege)
             ) AS "runtimePrivileges",
             (
               SELECT count(*)::int FROM pg_catalog.pg_policy
                WHERE polrelid = cls.oid AND polname = 'tenant_isolation'
             ) AS "policyCount",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_policy AS policy
                WHERE policy.polrelid = cls.oid
                  AND policy.polname = 'tenant_isolation'
                  AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
                  AND pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
             ) AS "policyUsesNullifContext",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
             ) AS "constraintCount",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
                  AND conname = ANY(ARRAY[
                    'india_gst_item_classification_pk',
                    'india_gst_item_classification_identity_uq',
                    'india_gst_item_classification_property_fk',
                    'india_gst_item_classification_extension_fk',
                    'india_gst_item_classification_jurisdiction_owner_ck',
                    'india_gst_item_classification_jurisdiction_key_ck',
                    'india_gst_item_classification_jurisdiction_version_ck',
                    'india_gst_item_classification_jurisdiction_hash_ck',
                    'india_gst_item_classification_country_ck',
                    'india_gst_item_classification_line_ck',
                    'india_gst_item_classification_revenue_group_ck',
                    'india_gst_item_classification_system_ck',
                    'india_gst_item_classification_code_ck',
                    'india_gst_item_classification_service_ck'
                  ])
             ) AS "requiredConstraints",
             EXISTS (
               SELECT 1
                 FROM pg_catalog.pg_index AS index
                 JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index.indexrelid
                WHERE index.indrelid = cls.oid
                  AND index_class.relname = 'india_gst_item_classification_identity_uq'
                  AND index.indisunique
                  AND index.indnullsnotdistinct
             ) AS "identityNullsNotDistinct",
             (
               SELECT count(*)::int
                 FROM pg_catalog.pg_index AS index
                 JOIN pg_catalog.pg_attribute AS leading_attribute
                   ON leading_attribute.attrelid = cls.oid
                  AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                WHERE index.indrelid = cls.oid
                  AND leading_attribute.attname = 'tenant_id'
             ) AS "tenantLeadingIndexes",
             (
               SELECT count(*)::int FROM pg_catalog.pg_index AS index
                WHERE index.indrelid = cls.oid
             ) AS "totalIndexes"
        FROM pg_catalog.pg_class AS cls
       WHERE cls.oid = 'public.india_gst_item_classification'::regclass
    `;
    expect(relation).toEqual([{
      owner: "yellow_owner",
      rls: true,
      forceRls: true,
      columns: "tenant_id,id,property_node,jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,country_code,line_id,revenue_group,classification_system,classification_code,is_service_code",
      types: "uuid,uuid,uuid,uuid,uuid,text,integer,text,character(2),text,text,text,text,character(1)",
      notNull: "true,true,true,true,false,true,true,true,true,true,true,true,true,true",
      appSelect: true,
      appMutation: false,
      publicPrivileges: 0,
      runtimePrivileges: 0,
      policyCount: 1,
      policyUsesNullifContext: true,
      constraintCount: 14,
      requiredConstraints: 14,
      identityNullsNotDistinct: true,
      tenantLeadingIndexes: 2,
      totalIndexes: 2,
    }]);

    const foreignKeys = await sql!<Array<{ name: string; definition: string }>>`
      SELECT constraint_row.conname AS name,
             pg_catalog.pg_get_constraintdef(constraint_row.oid) AS definition
        FROM pg_catalog.pg_constraint AS constraint_row
       WHERE constraint_row.conrelid = 'public.india_gst_item_classification'::regclass
         AND constraint_row.contype = 'f'
       ORDER BY constraint_row.conname
    `;
    expect(foreignKeys).toEqual([
      {
        name: "india_gst_item_classification_extension_fk",
        definition: "FOREIGN KEY (jurisdiction_extension_id) REFERENCES extension(id)",
      },
      {
        name: "india_gst_item_classification_property_fk",
        definition: "FOREIGN KEY (tenant_id, property_node) REFERENCES org_node(tenant_id, id)",
      },
    ]);

    const appRead = await sql!.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
      return tx<{ count: number }[]>`
        SELECT count(*)::int AS count FROM public.india_gst_item_classification
      `;
    });
    expect(appRead).toEqual([{ count: 0 }]);

    try {
      await sql!.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE app_role");
        await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
        await tx.unsafe("INSERT INTO public.india_gst_item_classification DEFAULT VALUES");
      });
      throw new Error("app_role unexpectedly mutated india_gst_item_classification");
    } catch (error) {
      expect((error as { errno?: string }).errno).toBe("42501");
    }
  });

  test("has exact India GST supplier service-location schema, forced RLS and SELECT-only app authority", async () => {
    const relation = await sql!<Array<{
      owner: string; rls: boolean; forceRls: boolean;
      columns: string; types: string; notNull: string;
      appSelect: boolean; appMutation: boolean;
      publicPrivileges: number; runtimePrivileges: number;
      policyCount: number; policyUsesNullifContext: boolean;
      constraintCount: number; requiredConstraints: number;
      exactIdentity: boolean; compositeRegistrationForeignKey: boolean;
      tenantLeadingIndexes: number; totalIndexes: number;
    }>>`
      SELECT pg_catalog.pg_get_userbyid(cls.relowner) AS owner,
             cls.relrowsecurity AS rls,
             cls.relforcerowsecurity AS "forceRls",
             (
               SELECT pg_catalog.string_agg(attribute.attname, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS columns,
             (
               SELECT pg_catalog.string_agg(
                 pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
                 ',' ORDER BY attribute.attnum
               )
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS types,
             (
               SELECT pg_catalog.string_agg(attribute.attnotnull::text, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS "notNull",
             pg_catalog.has_table_privilege('app_role', cls.oid, 'SELECT') AS "appSelect",
             (
               pg_catalog.has_table_privilege('app_role', cls.oid, 'INSERT')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'UPDATE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'DELETE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'TRUNCATE')
             ) AS "appMutation",
             (
               SELECT count(*)::int
                 FROM pg_catalog.aclexplode(
                   COALESCE(cls.relacl, pg_catalog.acldefault('r', cls.relowner))
                 ) AS acl
                WHERE acl.grantee = 0
             ) AS "publicPrivileges",
             (
               SELECT count(*)::int
                 FROM unnest(ARRAY[
                   'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                 ]) AS privilege
                WHERE pg_catalog.has_table_privilege('yellow_runtime', cls.oid, privilege)
             ) AS "runtimePrivileges",
             (
               SELECT count(*)::int FROM pg_catalog.pg_policy
                WHERE polrelid = cls.oid AND polname = 'tenant_isolation'
             ) AS "policyCount",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_policy AS policy
                WHERE policy.polrelid = cls.oid
                  AND policy.polname = 'tenant_isolation'
                  AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
                  AND pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
             ) AS "policyUsesNullifContext",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
             ) AS "constraintCount",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
                  AND conname = ANY(ARRAY[
                    'india_gst_supplier_service_location_pk',
                    'india_gst_supplier_service_location_identity_uq',
                    'india_gst_supplier_service_location_registration_fk',
                    'india_gst_supplier_service_location_supplier_hash_ck',
                    'india_gst_supplier_service_location_scope_ck',
                    'india_gst_supplier_service_location_registered_place_ck',
                    'india_gst_supplier_service_location_basis_ck',
                    'india_gst_supplier_service_location_legal_rule_ck'
                  ])
             ) AS "requiredConstraints",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                WHERE constraint_row.conrelid = cls.oid
                  AND constraint_row.conname = 'india_gst_supplier_service_location_identity_uq'
                  AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                    = 'UNIQUE (tenant_id, supplier_registration_id, supplier_evidence_hash, service_scope)'
             ) AS "exactIdentity",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                WHERE constraint_row.conrelid = cls.oid
                  AND constraint_row.conname = 'india_gst_supplier_service_location_registration_fk'
                  AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                    = 'FOREIGN KEY (tenant_id, supplier_registration_id) REFERENCES property_fiscal_registration(tenant_id, id)'
             ) AS "compositeRegistrationForeignKey",
             (
               SELECT count(*)::int
                 FROM pg_catalog.pg_index AS index
                 JOIN pg_catalog.pg_attribute AS leading_attribute
                   ON leading_attribute.attrelid = cls.oid
                  AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                WHERE index.indrelid = cls.oid
                  AND leading_attribute.attname = 'tenant_id'
             ) AS "tenantLeadingIndexes",
             (
               SELECT count(*)::int FROM pg_catalog.pg_index AS index
                WHERE index.indrelid = cls.oid
             ) AS "totalIndexes"
        FROM pg_catalog.pg_class AS cls
       WHERE cls.oid = 'public.india_gst_supplier_service_location'::regclass
    `;
    expect(relation).toEqual([{
      owner: "yellow_owner", rls: true, forceRls: true,
      columns: "tenant_id,id,supplier_registration_id,supplier_evidence_hash,service_scope,registered_place_kind,location_basis,legal_rule",
      types: "uuid,uuid,uuid,text,text,text,text,text",
      notNull: "true,true,true,true,true,true,true,true",
      appSelect: true, appMutation: false,
      publicPrivileges: 0, runtimePrivileges: 0,
      policyCount: 1, policyUsesNullifContext: true,
      constraintCount: 8, requiredConstraints: 8,
      exactIdentity: true, compositeRegistrationForeignKey: true,
      tenantLeadingIndexes: 2, totalIndexes: 2,
    }]);

    const appRead = await sql!.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
      return tx<{ count: number }[]>`
        SELECT count(*)::int AS count FROM public.india_gst_supplier_service_location
      `;
    });
    expect(appRead).toEqual([{ count: 0 }]);

    try {
      await sql!.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE app_role");
        await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
        await tx.unsafe("INSERT INTO public.india_gst_supplier_service_location DEFAULT VALUES");
      });
      throw new Error("app_role unexpectedly mutated india_gst_supplier_service_location");
    } catch (error) {
      expect((error as { errno?: string }).errno).toBe("42501");
    }
  });

  test("has exact India GST recipient SEZ-status schema, forced RLS and SELECT-only app authority", async () => {
    const relation = await sql!<Array<{
      owner: string; rls: boolean; forceRls: boolean;
      columns: string; types: string; notNull: string;
      appSelect: boolean; appMutation: boolean;
      publicPrivileges: number; runtimePrivileges: number;
      policyCount: number; policyUsesNullifContext: boolean;
      constraintCount: number; requiredConstraints: number;
      exactIdentity: boolean; compositeRegistrationForeignKey: boolean;
      tenantLeadingIndexes: number; totalIndexes: number;
    }>>`
      SELECT pg_catalog.pg_get_userbyid(cls.relowner) AS owner,
             cls.relrowsecurity AS rls,
             cls.relforcerowsecurity AS "forceRls",
             (
               SELECT pg_catalog.string_agg(attribute.attname, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS columns,
             (
               SELECT pg_catalog.string_agg(
                 pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
                 ',' ORDER BY attribute.attnum
               )
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS types,
             (
               SELECT pg_catalog.string_agg(attribute.attnotnull::text, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS "notNull",
             pg_catalog.has_table_privilege('app_role', cls.oid, 'SELECT') AS "appSelect",
             (
               pg_catalog.has_table_privilege('app_role', cls.oid, 'INSERT')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'UPDATE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'DELETE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'TRUNCATE')
             ) AS "appMutation",
             (
               SELECT count(*)::int
                 FROM pg_catalog.aclexplode(
                   COALESCE(cls.relacl, pg_catalog.acldefault('r', cls.relowner))
                 ) AS acl
                WHERE acl.grantee = 0
             ) AS "publicPrivileges",
             (
               SELECT count(*)::int
                 FROM unnest(ARRAY[
                   'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                 ]) AS privilege
                WHERE pg_catalog.has_table_privilege('yellow_runtime', cls.oid, privilege)
             ) AS "runtimePrivileges",
             (
               SELECT count(*)::int FROM pg_catalog.pg_policy
                WHERE polrelid = cls.oid AND polname = 'tenant_isolation'
             ) AS "policyCount",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_policy AS policy
                WHERE policy.polrelid = cls.oid
                  AND policy.polname = 'tenant_isolation'
                  AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
                  AND pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
             ) AS "policyUsesNullifContext",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
             ) AS "constraintCount",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
                  AND conname = ANY(ARRAY[
                    'india_gst_recipient_sez_status_pk',
                    'india_gst_recipient_sez_status_identity_uq',
                    'india_gst_recipient_sez_status_registration_fk',
                    'india_gst_recipient_sez_status_recipient_hash_ck',
                    'india_gst_recipient_sez_status_registration_status_ck',
                    'india_gst_recipient_sez_status_taxpayer_type_ck',
                    'india_gst_recipient_sez_status_source_ck',
                    'india_gst_recipient_sez_status_status_hash_ck',
                    'india_gst_recipient_sez_status_approval_shape_ck',
                    'india_gst_recipient_sez_status_legal_rule_ck'
                  ])
             ) AS "requiredConstraints",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                WHERE constraint_row.conrelid = cls.oid
                  AND constraint_row.conname = 'india_gst_recipient_sez_status_identity_uq'
                  AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                    = 'UNIQUE (tenant_id, recipient_registration_id, recipient_registration_evidence_hash, status_as_of)'
             ) AS "exactIdentity",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                WHERE constraint_row.conrelid = cls.oid
                  AND constraint_row.conname = 'india_gst_recipient_sez_status_registration_fk'
                  AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                    = 'FOREIGN KEY (tenant_id, recipient_registration_id) REFERENCES party_fiscal_registration(tenant_id, id)'
             ) AS "compositeRegistrationForeignKey",
             (
               SELECT count(*)::int
                 FROM pg_catalog.pg_index AS index
                 JOIN pg_catalog.pg_attribute AS leading_attribute
                   ON leading_attribute.attrelid = cls.oid
                  AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                WHERE index.indrelid = cls.oid
                  AND leading_attribute.attname = 'tenant_id'
             ) AS "tenantLeadingIndexes",
             (
               SELECT count(*)::int FROM pg_catalog.pg_index AS index
                WHERE index.indrelid = cls.oid
             ) AS "totalIndexes"
        FROM pg_catalog.pg_class AS cls
       WHERE cls.oid = 'public.india_gst_recipient_sez_status'::regclass
    `;
    expect(relation).toEqual([{
      owner: "yellow_owner", rls: true, forceRls: true,
      columns: "tenant_id,id,recipient_registration_id,recipient_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,approval_form,approval_reference,approval_validity,approval_status,approval_evidence_sha256,legal_rule",
      types: "uuid,uuid,uuid,text,date,text,text,text,text,text,text,daterange,text,text,text",
      notNull: "true,true,true,true,true,true,true,true,true,false,false,false,false,false,true",
      appSelect: true, appMutation: false,
      publicPrivileges: 0, runtimePrivileges: 0,
      policyCount: 1, policyUsesNullifContext: true,
      constraintCount: 10, requiredConstraints: 10,
      exactIdentity: true, compositeRegistrationForeignKey: true,
      tenantLeadingIndexes: 2, totalIndexes: 2,
    }]);

    const appRead = await sql!.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
      return tx<{ count: number }[]>`
        SELECT count(*)::int AS count FROM public.india_gst_recipient_sez_status
      `;
    });
    expect(appRead).toEqual([{ count: 0 }]);

    try {
      await sql!.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE app_role");
        await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
        await tx.unsafe("INSERT INTO public.india_gst_recipient_sez_status DEFAULT VALUES");
      });
      throw new Error("app_role unexpectedly mutated india_gst_recipient_sez_status");
    } catch (error) {
      expect((error as { errno?: string }).errno).toBe("42501");
    }
  });

  test("has exact India GST supplier SEZ-status schema, forced RLS and SELECT-only app authority", async () => {
    const relation = await sql!<Array<{
      owner: string; rls: boolean; forceRls: boolean;
      columns: string; types: string; notNull: string;
      appSelect: boolean; appMutation: boolean;
      publicPrivileges: number; runtimePrivileges: number;
      policyCount: number; policyUsesNullifContext: boolean;
      constraintCount: number; requiredConstraints: number;
      exactIdentity: boolean; compositeRegistrationForeignKey: boolean;
      tenantLeadingIndexes: number; totalIndexes: number;
    }>>`
      SELECT pg_catalog.pg_get_userbyid(cls.relowner) AS owner,
             cls.relrowsecurity AS rls,
             cls.relforcerowsecurity AS "forceRls",
             (
               SELECT pg_catalog.string_agg(attribute.attname, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS columns,
             (
               SELECT pg_catalog.string_agg(
                 pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
                 ',' ORDER BY attribute.attnum
               )
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS types,
             (
               SELECT pg_catalog.string_agg(attribute.attnotnull::text, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS "notNull",
             pg_catalog.has_table_privilege('app_role', cls.oid, 'SELECT') AS "appSelect",
             (
               pg_catalog.has_table_privilege('app_role', cls.oid, 'INSERT')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'UPDATE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'DELETE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'TRUNCATE')
             ) AS "appMutation",
             (
               SELECT count(*)::int
                 FROM pg_catalog.aclexplode(
                   COALESCE(cls.relacl, pg_catalog.acldefault('r', cls.relowner))
                 ) AS acl
                WHERE acl.grantee = 0
             ) AS "publicPrivileges",
             (
               SELECT count(*)::int
                 FROM unnest(ARRAY[
                   'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                 ]) AS privilege
                WHERE pg_catalog.has_table_privilege('yellow_runtime', cls.oid, privilege)
             ) AS "runtimePrivileges",
             (
               SELECT count(*)::int FROM pg_catalog.pg_policy
                WHERE polrelid = cls.oid AND polname = 'tenant_isolation'
             ) AS "policyCount",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_policy AS policy
                WHERE policy.polrelid = cls.oid
                  AND policy.polname = 'tenant_isolation'
                  AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
                  AND pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
             ) AS "policyUsesNullifContext",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
             ) AS "constraintCount",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
                  AND conname = ANY(ARRAY[
                    'india_gst_supplier_sez_status_pk',
                    'india_gst_supplier_sez_status_identity_uq',
                    'india_gst_supplier_sez_status_registration_fk',
                    'india_gst_supplier_sez_status_supplier_hash_ck',
                    'india_gst_supplier_sez_status_registration_status_ck',
                    'india_gst_supplier_sez_status_taxpayer_type_ck',
                    'india_gst_supplier_sez_status_source_ck',
                    'india_gst_supplier_sez_status_status_hash_ck',
                    'india_gst_supplier_sez_status_approval_shape_ck',
                    'india_gst_supplier_sez_status_legal_rule_ck'
                  ])
             ) AS "requiredConstraints",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                WHERE constraint_row.conrelid = cls.oid
                  AND constraint_row.conname = 'india_gst_supplier_sez_status_identity_uq'
                  AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                    = 'UNIQUE (tenant_id, supplier_registration_id, supplier_registration_evidence_hash, status_as_of)'
             ) AS "exactIdentity",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                WHERE constraint_row.conrelid = cls.oid
                  AND constraint_row.conname = 'india_gst_supplier_sez_status_registration_fk'
                  AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                    = 'FOREIGN KEY (tenant_id, supplier_registration_id) REFERENCES property_fiscal_registration(tenant_id, id)'
             ) AS "compositeRegistrationForeignKey",
             (
               SELECT count(*)::int
                 FROM pg_catalog.pg_index AS index
                 JOIN pg_catalog.pg_attribute AS leading_attribute
                   ON leading_attribute.attrelid = cls.oid
                  AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                WHERE index.indrelid = cls.oid
                  AND leading_attribute.attname = 'tenant_id'
             ) AS "tenantLeadingIndexes",
             (
               SELECT count(*)::int FROM pg_catalog.pg_index AS index
                WHERE index.indrelid = cls.oid
             ) AS "totalIndexes"
        FROM pg_catalog.pg_class AS cls
       WHERE cls.oid = 'public.india_gst_supplier_sez_status'::regclass
    `;
    expect(relation).toEqual([{
      owner: "yellow_owner", rls: true, forceRls: true,
      columns: "tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,approval_form,approval_reference,approval_validity,approval_status,approval_evidence_sha256,legal_rule",
      types: "uuid,uuid,uuid,text,date,text,text,text,text,text,text,daterange,text,text,text",
      notNull: "true,true,true,true,true,true,true,true,true,false,false,false,false,false,true",
      appSelect: true, appMutation: false,
      publicPrivileges: 0, runtimePrivileges: 0,
      policyCount: 1, policyUsesNullifContext: true,
      constraintCount: 10, requiredConstraints: 10,
      exactIdentity: true, compositeRegistrationForeignKey: true,
      tenantLeadingIndexes: 2, totalIndexes: 2,
    }]);

    const appRead = await sql!.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
      return tx<{ count: number }[]>`
        SELECT count(*)::int AS count FROM public.india_gst_supplier_sez_status
      `;
    });
    expect(appRead).toEqual([{ count: 0 }]);

    try {
      await sql!.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE app_role");
        await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
        await tx.unsafe("INSERT INTO public.india_gst_supplier_sez_status DEFAULT VALUES");
      });
      throw new Error("app_role unexpectedly mutated india_gst_supplier_sez_status");
    } catch (error) {
      expect((error as { errno?: string }).errno).toBe("42501");
    }
  });

  test("has exact India SEZ-unit LoA-renewal schema, forced RLS and SELECT-only app authority", async () => {
    const relation = await sql!<Array<{
      owner: string; rls: boolean; forceRls: boolean;
      columns: string; types: string; notNull: string;
      appSelect: boolean; appMutation: boolean;
      publicPrivileges: number; runtimePrivileges: number;
      policyCount: number; policyUsesNullifContext: boolean;
      constraintCount: number; requiredConstraints: number;
      exactIdentity: boolean; compositeSupplierStatusForeignKey: boolean;
      tenantLeadingIndexes: number; totalIndexes: number;
    }>>`
      SELECT pg_catalog.pg_get_userbyid(cls.relowner) AS owner,
             cls.relrowsecurity AS rls,
             cls.relforcerowsecurity AS "forceRls",
             (
               SELECT pg_catalog.string_agg(attribute.attname, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS columns,
             (
               SELECT pg_catalog.string_agg(
                 pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
                 ',' ORDER BY attribute.attnum
               )
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS types,
             (
               SELECT pg_catalog.string_agg(attribute.attnotnull::text, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS "notNull",
             pg_catalog.has_table_privilege('app_role', cls.oid, 'SELECT') AS "appSelect",
             (
               pg_catalog.has_table_privilege('app_role', cls.oid, 'INSERT')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'UPDATE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'DELETE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'TRUNCATE')
             ) AS "appMutation",
             (
               SELECT count(*)::int
                 FROM pg_catalog.aclexplode(
                   COALESCE(cls.relacl, pg_catalog.acldefault('r', cls.relowner))
                 ) AS acl
                WHERE acl.grantee = 0
             ) AS "publicPrivileges",
             (
               SELECT count(*)::int
                 FROM unnest(ARRAY[
                   'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                 ]) AS privilege
                WHERE pg_catalog.has_table_privilege('yellow_runtime', cls.oid, privilege)
             ) AS "runtimePrivileges",
             (
               SELECT count(*)::int FROM pg_catalog.pg_policy
                WHERE polrelid = cls.oid AND polname = 'tenant_isolation'
             ) AS "policyCount",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_policy AS policy
                WHERE policy.polrelid = cls.oid
                  AND policy.polname = 'tenant_isolation'
                  AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
                  AND pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
             ) AS "policyUsesNullifContext",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
             ) AS "constraintCount",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
                  AND conname = ANY(ARRAY[
                    'india_sez_unit_loa_renewal_pk',
                    'india_sez_unit_loa_renewal_identity_uq',
                    'india_sez_unit_loa_renewal_supplier_status_fk',
                    'india_sez_unit_loa_renewal_original_reference_ck',
                    'india_sez_unit_loa_renewal_original_hash_ck',
                    'india_sez_unit_loa_renewal_file_number_ck',
                    'india_sez_unit_loa_renewal_validity_ck',
                    'india_sez_unit_loa_renewal_issue_chronology_ck',
                    'india_sez_unit_loa_renewal_status_ck',
                    'india_sez_unit_loa_renewal_source_ck',
                    'india_sez_unit_loa_renewal_status_hash_ck',
                    'india_sez_unit_loa_renewal_form_hash_ck',
                    'india_sez_unit_loa_renewal_legal_rule_ck'
                  ])
             ) AS "requiredConstraints",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                WHERE constraint_row.conrelid = cls.oid
                  AND constraint_row.conname = 'india_sez_unit_loa_renewal_identity_uq'
                  AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                    = 'UNIQUE (tenant_id, supplier_sez_status_id, form_f2_file_number, form_f2_issue_date)'
             ) AS "exactIdentity",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                WHERE constraint_row.conrelid = cls.oid
                  AND constraint_row.conname = 'india_sez_unit_loa_renewal_supplier_status_fk'
                  AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                    = 'FOREIGN KEY (tenant_id, supplier_sez_status_id) REFERENCES india_gst_supplier_sez_status(tenant_id, id)'
             ) AS "compositeSupplierStatusForeignKey",
             (
               SELECT count(*)::int
                 FROM pg_catalog.pg_index AS index
                 JOIN pg_catalog.pg_attribute AS leading_attribute
                   ON leading_attribute.attrelid = cls.oid
                  AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                WHERE index.indrelid = cls.oid
                  AND leading_attribute.attname = 'tenant_id'
             ) AS "tenantLeadingIndexes",
             (
               SELECT count(*)::int FROM pg_catalog.pg_index AS index
                WHERE index.indrelid = cls.oid
             ) AS "totalIndexes"
        FROM pg_catalog.pg_class AS cls
       WHERE cls.oid = 'public.india_sez_unit_loa_renewal'::regclass
    `;
    expect(relation).toEqual([{
      owner: "yellow_owner", rls: true, forceRls: true,
      columns: "tenant_id,id,supplier_sez_status_id,original_loa_reference,original_loa_issue_date,original_loa_evidence_sha256,form_f2_file_number,form_f2_issue_date,renewal_validity,renewal_status_as_of,renewal_status,renewal_status_source,renewal_status_evidence_sha256,form_f2_evidence_sha256,legal_rule",
      types: "uuid,uuid,uuid,text,date,text,text,date,daterange,date,text,text,text,text,text",
      notNull: "true,true,true,true,true,true,true,true,true,true,true,true,true,true,true",
      appSelect: true, appMutation: false,
      publicPrivileges: 0, runtimePrivileges: 0,
      policyCount: 1, policyUsesNullifContext: true,
      constraintCount: 13, requiredConstraints: 13,
      exactIdentity: true, compositeSupplierStatusForeignKey: true,
      tenantLeadingIndexes: 2, totalIndexes: 2,
    }]);

    const appRead = await sql!.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
      return tx<{ count: number }[]>`
        SELECT count(*)::int AS count FROM public.india_sez_unit_loa_renewal
      `;
    });
    expect(appRead).toEqual([{ count: 0 }]);

    try {
      await sql!.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE app_role");
        await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
        await tx.unsafe("INSERT INTO public.india_sez_unit_loa_renewal DEFAULT VALUES");
      });
      throw new Error("app_role unexpectedly mutated india_sez_unit_loa_renewal");
    } catch (error) {
      expect((error as { errno?: string }).errno).toBe("42501");
    }
  });

  test("has exact India GST supplier registration-status schema, forced RLS and SELECT-only app authority", async () => {
    const relation = await sql!<Array<{
      owner: string; rls: boolean; forceRls: boolean;
      columns: string; types: string; notNull: string;
      appSelect: boolean; appMutation: boolean;
      publicPrivileges: number; runtimePrivileges: number;
      policyCount: number; policyUsesNullifContext: boolean;
      constraintCount: number; requiredConstraints: number;
      exactIdentity: boolean; compositeSupplierRegistrationForeignKey: boolean;
      tenantLeadingIndexes: number; totalIndexes: number;
    }>>`
      SELECT pg_catalog.pg_get_userbyid(cls.relowner) AS owner,
             cls.relrowsecurity AS rls,
             cls.relforcerowsecurity AS "forceRls",
             (
               SELECT pg_catalog.string_agg(attribute.attname, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS columns,
             (
               SELECT pg_catalog.string_agg(
                 pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
                 ',' ORDER BY attribute.attnum
               )
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS types,
             (
               SELECT pg_catalog.string_agg(attribute.attnotnull::text, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS "notNull",
             pg_catalog.has_table_privilege('app_role', cls.oid, 'SELECT') AS "appSelect",
             (
               pg_catalog.has_table_privilege('app_role', cls.oid, 'INSERT')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'UPDATE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'DELETE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'TRUNCATE')
             ) AS "appMutation",
             (
               SELECT count(*)::int
                 FROM pg_catalog.aclexplode(
                   COALESCE(cls.relacl, pg_catalog.acldefault('r', cls.relowner))
                 ) AS acl
                WHERE acl.grantee = 0
             ) AS "publicPrivileges",
             (
               SELECT count(*)::int
                 FROM unnest(ARRAY[
                   'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                 ]) AS privilege
                WHERE pg_catalog.has_table_privilege('yellow_runtime', cls.oid, privilege)
             ) AS "runtimePrivileges",
             (
               SELECT count(*)::int FROM pg_catalog.pg_policy
                WHERE polrelid = cls.oid AND polname = 'tenant_isolation'
             ) AS "policyCount",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_policy AS policy
                WHERE policy.polrelid = cls.oid
                  AND policy.polname = 'tenant_isolation'
                  AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
                  AND pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
             ) AS "policyUsesNullifContext",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
             ) AS "constraintCount",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
                  AND conname = ANY(ARRAY[
                    'india_gst_supplier_registration_status_snapshot_pk',
                    'india_gst_supplier_registration_status_snapshot_identity_uq',
                    'india_gst_supplier_registration_status_snapshot_registration_fk',
                    'india_gst_supplier_status_snapshot_supplier_evidence_ck',
                    'india_gst_supplier_registration_status_snapshot_status_ck',
                    'india_gst_supplier_status_snapshot_taxpayer_type_ck',
                    'india_gst_supplier_registration_status_snapshot_source_ck',
                    'india_gst_supplier_status_snapshot_portal_evidence_ck',
                    'india_gst_supplier_registration_status_snapshot_legal_rule_ck'
                  ])
             ) AS "requiredConstraints",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                WHERE constraint_row.conrelid = cls.oid
                  AND constraint_row.conname = 'india_gst_supplier_registration_status_snapshot_identity_uq'
                  AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                    = 'UNIQUE (tenant_id, supplier_registration_id, supplier_registration_evidence_hash, status_as_of)'
             ) AS "exactIdentity",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                WHERE constraint_row.conrelid = cls.oid
                  AND constraint_row.conname = 'india_gst_supplier_registration_status_snapshot_registration_fk'
                  AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                    = 'FOREIGN KEY (tenant_id, supplier_registration_id) REFERENCES property_fiscal_registration(tenant_id, id)'
             ) AS "compositeSupplierRegistrationForeignKey",
             (
               SELECT count(*)::int
                 FROM pg_catalog.pg_index AS index
                 JOIN pg_catalog.pg_attribute AS leading_attribute
                   ON leading_attribute.attrelid = cls.oid
                  AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                WHERE index.indrelid = cls.oid
                  AND leading_attribute.attname = 'tenant_id'
             ) AS "tenantLeadingIndexes",
             (
               SELECT count(*)::int FROM pg_catalog.pg_index AS index
                WHERE index.indrelid = cls.oid
             ) AS "totalIndexes"
        FROM pg_catalog.pg_class AS cls
       WHERE cls.oid = 'public.india_gst_supplier_registration_status_snapshot'::regclass
    `;
    expect(relation).toEqual([{
      owner: "yellow_owner", rls: true, forceRls: true,
      columns: "tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule",
      types: "uuid,uuid,uuid,text,date,text,text,text,text,text",
      notNull: "true,true,true,true,true,true,true,true,true,true",
      appSelect: true, appMutation: false,
      publicPrivileges: 0, runtimePrivileges: 0,
      policyCount: 1, policyUsesNullifContext: true,
      constraintCount: 9, requiredConstraints: 9,
      exactIdentity: true, compositeSupplierRegistrationForeignKey: true,
      tenantLeadingIndexes: 2, totalIndexes: 2,
    }]);

    const appRead = await sql!.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
      return tx<{ count: number }[]>`
        SELECT count(*)::int AS count
          FROM public.india_gst_supplier_registration_status_snapshot
      `;
    });
    expect(appRead).toEqual([{ count: 0 }]);

    try {
      await sql!.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE app_role");
        await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
        await tx.unsafe(
          "INSERT INTO public.india_gst_supplier_registration_status_snapshot DEFAULT VALUES",
        );
      });
      throw new Error(
        "app_role unexpectedly mutated india_gst_supplier_registration_status_snapshot",
      );
    } catch (error) {
      expect((error as { errno?: string }).errno).toBe("42501");
    }
  });

  test("has exact India GST accommodation service-provision-date schema and SELECT-only authority", async () => {
    const relation = await sql!<Array<{
      owner: string; rls: boolean; forceRls: boolean; columns: string; types: string;
      notNull: string; appSelect: boolean; appMutation: boolean;
      publicPrivileges: number; runtimePrivileges: number; policyCount: number;
      policyUsesNullifContext: boolean; constraintCount: number;
      requiredConstraints: number; exactIdentity: boolean; exactLineageFk: boolean;
      tenantLeadingIndexes: number; totalIndexes: number;
    }>>`
      SELECT pg_catalog.pg_get_userbyid(cls.relowner) AS owner,
             cls.relrowsecurity AS rls,
             cls.relforcerowsecurity AS "forceRls",
             (SELECT pg_catalog.string_agg(a.attname, ',' ORDER BY a.attnum)
                FROM pg_catalog.pg_attribute a
               WHERE a.attrelid=cls.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
             (SELECT pg_catalog.string_agg(
                       pg_catalog.format_type(a.atttypid,a.atttypmod),',' ORDER BY a.attnum)
                FROM pg_catalog.pg_attribute a
               WHERE a.attrelid=cls.oid AND a.attnum>0 AND NOT a.attisdropped) AS types,
             (SELECT pg_catalog.string_agg(a.attnotnull::text,',' ORDER BY a.attnum)
                FROM pg_catalog.pg_attribute a
               WHERE a.attrelid=cls.oid AND a.attnum>0 AND NOT a.attisdropped) AS "notNull",
             pg_catalog.has_table_privilege('app_role',cls.oid,'SELECT') AS "appSelect",
             (pg_catalog.has_table_privilege('app_role',cls.oid,'INSERT')
               OR pg_catalog.has_table_privilege('app_role',cls.oid,'UPDATE')
               OR pg_catalog.has_table_privilege('app_role',cls.oid,'DELETE')
               OR pg_catalog.has_table_privilege('app_role',cls.oid,'TRUNCATE')) AS "appMutation",
             (SELECT count(*)::int FROM pg_catalog.aclexplode(
                COALESCE(cls.relacl,pg_catalog.acldefault('r',cls.relowner))) acl
               WHERE acl.grantee=0) AS "publicPrivileges",
             (SELECT count(*)::int FROM unnest(ARRAY[
                'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege
               WHERE pg_catalog.has_table_privilege('yellow_runtime',cls.oid,privilege))
               AS "runtimePrivileges",
             (SELECT count(*)::int FROM pg_catalog.pg_policy
               WHERE polrelid=cls.oid AND polname='tenant_isolation') AS "policyCount",
             EXISTS (SELECT 1 FROM pg_catalog.pg_policy policy
               WHERE policy.polrelid=cls.oid AND policy.polname='tenant_isolation'
                 AND pg_catalog.pg_get_expr(policy.polqual,policy.polrelid)
                   LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
                 AND pg_catalog.pg_get_expr(policy.polwithcheck,policy.polrelid)
                   LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%')
               AS "policyUsesNullifContext",
             (SELECT count(*)::int FROM pg_catalog.pg_constraint
               WHERE conrelid=cls.oid) AS "constraintCount",
             (SELECT count(*)::int FROM pg_catalog.pg_constraint
               WHERE conrelid=cls.oid AND conname=ANY(ARRAY[
                 'india_gst_accommodation_service_provision_snapshot_pk',
                 'india_gst_accommodation_service_provision_lineage_date_uq',
                 'india_gst_accommodation_service_provision_lineage_fk',
                 'india_gst_accommodation_service_provision_quote_hash_ck',
                 'india_gst_accommodation_service_provision_snapshot_hash_ck',
                 'india_gst_accommodation_service_provision_currency_ck',
                 'india_gst_accommodation_service_provision_date_ck',
                 'india_gst_accommodation_service_provision_source_ck',
                 'india_gst_accommodation_service_provision_evidence_ck',
                 'india_gst_accommodation_service_provision_legal_rule_ck']))
               AS "requiredConstraints",
             EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c
               WHERE c.conrelid=cls.oid
                 AND c.conname='india_gst_accommodation_service_provision_lineage_date_uq'
                 AND pg_catalog.pg_get_constraintdef(c.oid)=
                   'UNIQUE (tenant_id, reservation_lineage_id, service_provision_date)')
               AS "exactIdentity",
             EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c
               WHERE c.conrelid=cls.oid
                 AND c.conname='india_gst_accommodation_service_provision_lineage_fk'
                 AND pg_catalog.pg_get_constraintdef(c.oid)=
                   'FOREIGN KEY (tenant_id, reservation_lineage_id, property_node, hold_binding_id, attribution_id, reservation_id, segment_id, origin_quote_hash, snapshot_hash, currency) REFERENCES tax_attribution_reservation_binding(tenant_id, id, property_node, binding_id, attribution_id, reservation_id, segment_id, origin_quote_hash, snapshot_hash, currency)')
               AS "exactLineageFk",
             (SELECT count(*)::int FROM pg_catalog.pg_index i
                JOIN pg_catalog.pg_attribute a ON a.attrelid=cls.oid
                 AND a.attnum=(i.indkey::smallint[])[0]
               WHERE i.indrelid=cls.oid AND a.attname='tenant_id') AS "tenantLeadingIndexes",
             (SELECT count(*)::int FROM pg_catalog.pg_index i
               WHERE i.indrelid=cls.oid) AS "totalIndexes"
        FROM pg_catalog.pg_class cls
       WHERE cls.oid='public.india_gst_accommodation_service_provision_snapshot'::regclass
    `;
    expect(relation).toEqual([{
      owner: "yellow_owner", rls: true, forceRls: true,
      columns: "tenant_id,id,property_node,reservation_lineage_id,hold_binding_id,attribution_id,reservation_id,segment_id,origin_quote_hash,snapshot_hash,currency,service_provision_date,service_provision_source,service_provision_evidence_sha256,legal_rule",
      types: "uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,character(3),date,text,text,text",
      notNull: "true,true,true,true,true,true,true,true,true,true,true,true,true,true,true",
      appSelect: true, appMutation: false, publicPrivileges: 0, runtimePrivileges: 0,
      policyCount: 1, policyUsesNullifContext: true,
      constraintCount: 10, requiredConstraints: 10,
      exactIdentity: true, exactLineageFk: true,
      tenantLeadingIndexes: 2, totalIndexes: 2,
    }]);

    const appRead = await sql!.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`SELECT set_config('app.tenant_id',${SEED_TENANT.id},true)`;
      return tx<Array<{ count: number }>>`
        SELECT count(*)::int count
          FROM public.india_gst_accommodation_service_provision_snapshot`;
    });
    expect(appRead).toEqual([{ count: 0 }]);
    try {
      await sql!.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE app_role");
        await tx`SELECT set_config('app.tenant_id',${SEED_TENANT.id},true)`;
        await tx.unsafe(
          "INSERT INTO public.india_gst_accommodation_service_provision_snapshot DEFAULT VALUES",
        );
      });
      throw new Error(
        "app_role unexpectedly mutated india_gst_accommodation_service_provision_snapshot",
      );
    } catch (error) {
      expect((error as { errno?: string }).errno).toBe("42501");
    }
  });

  test("has exact India GST Party-registration schema, tenant coherence and SELECT-only app authority", async () => {
    const relation = await sql!<Array<{
      owner: string;
      rls: boolean;
      columns: string;
      types: string;
      notNull: string;
      appSelect: boolean;
      appMutation: boolean;
      publicPrivileges: number;
      runtimePrivileges: number;
      policyCount: number;
      policyUsesNullifContext: boolean;
      constraintCount: number;
      requiredConstraints: number;
      identityIsTenantSchemeRegistration: boolean;
      tenantLeadingIndexes: number;
      totalIndexes: number;
    }>>`
      SELECT pg_catalog.pg_get_userbyid(cls.relowner) AS owner,
             cls.relrowsecurity AS rls,
             (
               SELECT pg_catalog.string_agg(attribute.attname, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS columns,
             (
               SELECT pg_catalog.string_agg(
                 pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
                 ',' ORDER BY attribute.attnum
               )
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS types,
             (
               SELECT pg_catalog.string_agg(attribute.attnotnull::text, ',' ORDER BY attribute.attnum)
                 FROM pg_catalog.pg_attribute AS attribute
                WHERE attribute.attrelid = cls.oid
                  AND attribute.attnum > 0
                  AND NOT attribute.attisdropped
             ) AS "notNull",
             pg_catalog.has_table_privilege('app_role', cls.oid, 'SELECT') AS "appSelect",
             (
               pg_catalog.has_table_privilege('app_role', cls.oid, 'INSERT')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'UPDATE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'DELETE')
               OR pg_catalog.has_table_privilege('app_role', cls.oid, 'TRUNCATE')
             ) AS "appMutation",
             (
               SELECT count(*)::int
                 FROM pg_catalog.aclexplode(
                   COALESCE(cls.relacl, pg_catalog.acldefault('r', cls.relowner))
                 ) AS acl
                WHERE acl.grantee = 0
             ) AS "publicPrivileges",
             (
               SELECT count(*)::int
                 FROM unnest(ARRAY[
                   'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                 ]) AS privilege
                WHERE pg_catalog.has_table_privilege('yellow_runtime', cls.oid, privilege)
             ) AS "runtimePrivileges",
             (
               SELECT count(*)::int FROM pg_catalog.pg_policy
                WHERE polrelid = cls.oid AND polname = 'tenant_isolation'
             ) AS "policyCount",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_policy AS policy
                WHERE policy.polrelid = cls.oid
                  AND policy.polname = 'tenant_isolation'
                  AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
                  AND pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
                    LIKE '%NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text)%'
             ) AS "policyUsesNullifContext",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
             ) AS "constraintCount",
             (
               SELECT count(*)::int FROM pg_catalog.pg_constraint
                WHERE conrelid = cls.oid
                  AND conname = ANY(ARRAY[
                    'party_fiscal_registration_pk',
                    'party_fiscal_registration_identity_uq',
                    'party_fiscal_registration_party_fk',
                    'party_fiscal_registration_scheme_ck',
                    'party_fiscal_registration_registration_ck',
                    'party_fiscal_registration_region_ck',
                    'party_fiscal_registration_registration_region_ck',
                    'party_fiscal_registration_legal_name_ck',
                    'party_fiscal_registration_trade_name_ck',
                    'party_fiscal_registration_address_line1_ck',
                    'party_fiscal_registration_locality_ck',
                    'party_fiscal_registration_pin_ck'
                  ])
             ) AS "requiredConstraints",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                WHERE constraint_row.conrelid = cls.oid
                  AND constraint_row.conname = 'party_fiscal_registration_identity_uq'
                  AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                    = 'UNIQUE (tenant_id, scheme, registration_number)'
             ) AS "identityIsTenantSchemeRegistration",
             (
               SELECT count(*)::int
                 FROM pg_catalog.pg_index AS index
                 JOIN pg_catalog.pg_attribute AS leading_attribute
                   ON leading_attribute.attrelid = cls.oid
                  AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                WHERE index.indrelid = cls.oid
                  AND leading_attribute.attname = 'tenant_id'
             ) AS "tenantLeadingIndexes",
             (
               SELECT count(*)::int FROM pg_catalog.pg_index AS index
                WHERE index.indrelid = cls.oid
             ) AS "totalIndexes"
        FROM pg_catalog.pg_class AS cls
       WHERE cls.oid = 'public.party_fiscal_registration'::regclass
    `;
    expect(relation).toEqual([{
      owner: "yellow_owner",
      rls: true,
      columns: "tenant_id,id,party_id,scheme,registration_number,region_code,legal_name,trade_name,address_line1,locality,pin",
      types: "uuid,uuid,uuid,text,text,text,text,text,text,text,text",
      notNull: "true,true,true,true,true,true,true,false,true,true,true",
      appSelect: true,
      appMutation: false,
      publicPrivileges: 0,
      runtimePrivileges: 0,
      policyCount: 1,
      policyUsesNullifContext: true,
      constraintCount: 12,
      requiredConstraints: 12,
      identityIsTenantSchemeRegistration: true,
      tenantLeadingIndexes: 3,
      totalIndexes: 3,
    }]);

    const foreignKeys = await sql!<Array<{ name: string; definition: string }>>`
      SELECT constraint_row.conname AS name,
             pg_catalog.pg_get_constraintdef(constraint_row.oid) AS definition
        FROM pg_catalog.pg_constraint AS constraint_row
       WHERE constraint_row.conrelid = 'public.party_fiscal_registration'::regclass
         AND constraint_row.contype = 'f'
       ORDER BY constraint_row.conname
    `;
    expect(foreignKeys).toEqual([{
      name: "party_fiscal_registration_party_fk",
      definition: "FOREIGN KEY (tenant_id, party_id) REFERENCES party(tenant_id, id)",
    }]);

    const appRead = await sql!.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
      return tx<{ count: number }[]>`
        SELECT count(*)::int AS count FROM public.party_fiscal_registration
      `;
    });
    expect(appRead).toEqual([{ count: 0 }]);

    try {
      await sql!.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE app_role");
        await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
        await tx.unsafe("INSERT INTO public.party_fiscal_registration DEFAULT VALUES");
      });
      throw new Error("app_role unexpectedly mutated party_fiscal_registration");
    } catch (error) {
      expect((error as { errno?: string }).errno).toBe("42501");
    }
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

  test("has the exact append-only quoted-tax hold-binding root and bounded capability", async () => {
    const relation = await sql!<Array<{
      owner: string; rls: boolean; tenantPolicy: boolean; appSelect: boolean;
      appMutation: boolean; publicPrivileges: number; holdUnique: boolean;
      attributionUnique: boolean; snapshotHashUnique: boolean;
      compositeHoldFk: boolean; compositeAttributionFk: boolean;
    }>>`
      SELECT pg_catalog.pg_get_userbyid(class.relowner) AS owner,
             class.relrowsecurity AS rls,
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_policy
                WHERE polrelid=class.oid AND polname='tenant_isolation'
             ) AS "tenantPolicy",
             pg_catalog.has_table_privilege('app_role', class.oid, 'SELECT') AS "appSelect",
             (
               pg_catalog.has_table_privilege('app_role', class.oid, 'INSERT')
               OR pg_catalog.has_table_privilege('app_role', class.oid, 'UPDATE')
               OR pg_catalog.has_table_privilege('app_role', class.oid, 'DELETE')
               OR pg_catalog.has_table_privilege('app_role', class.oid, 'TRUNCATE')
             ) AS "appMutation",
             (
               SELECT count(*)::int
                 FROM pg_catalog.aclexplode(
                   COALESCE(class.relacl, pg_catalog.acldefault('r', class.relowner))
                 ) AS acl
                WHERE acl.grantee=0
             ) AS "publicPrivileges",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint
                WHERE conrelid=class.oid
                  AND conname='tax_attribution_hold_binding_hold_uq' AND contype='u'
             ) AS "holdUnique",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint
                WHERE conrelid=class.oid
                  AND conname='tax_attribution_hold_binding_attribution_uq' AND contype='u'
             ) AS "attributionUnique",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint
                WHERE conrelid=class.oid
                  AND conname='tax_attribution_hold_binding_snapshot_hash_uq' AND contype='u'
             ) AS "snapshotHashUnique",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint
                WHERE conrelid=class.oid
                  AND conname='tax_attribution_hold_binding_hold_fk'
                  AND confrelid='public.hold'::regclass
             ) AS "compositeHoldFk",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint
                WHERE conrelid=class.oid
                  AND conname='tax_attribution_hold_binding_attribution_fk'
                  AND confrelid='public.tax_attribution_snapshot'::regclass
             ) AS "compositeAttributionFk"
        FROM pg_catalog.pg_class AS class
       WHERE class.oid='public.tax_attribution_hold_binding'::regclass
    `;
    expect(relation).toEqual([{
      owner: "yellow_owner",
      rls: true,
      tenantPolicy: true,
      appSelect: true,
      appMutation: false,
      publicPrivileges: 0,
      holdUnique: true,
      attributionUnique: true,
      snapshotHashUnique: true,
      compositeHoldFk: true,
      compositeAttributionFk: true,
    }]);

    const capability = await sql!<Array<{
      signature: string; owner: string; securityDefiner: boolean; config: string[];
      appExecute: boolean; runtimeExecute: boolean; publicExecute: boolean; result: string;
    }>>`
      SELECT procedure.oid::regprocedure::text AS signature,
             pg_catalog.pg_get_userbyid(procedure.proowner) AS owner,
             procedure.prosecdef AS "securityDefiner",
             procedure.proconfig AS config,
             pg_catalog.has_function_privilege('app_role', procedure.oid, 'EXECUTE') AS "appExecute",
             pg_catalog.has_function_privilege('yellow_runtime', procedure.oid, 'EXECUTE') AS "runtimeExecute",
             pg_catalog.has_function_privilege('public', procedure.oid, 'EXECUTE') AS "publicExecute",
             pg_catalog.pg_get_function_result(procedure.oid) AS result
        FROM pg_catalog.pg_proc AS procedure
       WHERE procedure.oid =
         'public.record_tax_attribution_hold_binding(uuid,uuid,uuid,uuid,uuid)'::regprocedure
    `;
    expect(capability).toEqual([{
      signature: "record_tax_attribution_hold_binding(uuid,uuid,uuid,uuid,uuid)",
      owner: "yellow_owner",
      securityDefiner: true,
      config: ["search_path=pg_catalog, public, pg_temp"],
      appExecute: true,
      runtimeExecute: false,
      publicExecute: false,
      result: "TABLE(binding_id uuid, property_node uuid, hold_id uuid, attribution_id uuid, origin_quote_hash text, snapshot_hash text, currency character, bound_by uuid, bound_at timestamp with time zone, created boolean)",
    }]);
  });

  test("has the exact append-only quoted-tax reservation-lineage root and bounded capability", async () => {
    const relation = await sql!<Array<{
      owner: string; rls: boolean; tenantPolicy: boolean; appSelect: boolean;
      appMutation: boolean; publicPrivileges: number; bindingUnique: boolean;
      reservationUnique: boolean; segmentUnique: boolean; sourceFk: boolean;
      reservationFk: boolean; segmentFk: boolean;
    }>>`
      SELECT pg_catalog.pg_get_userbyid(class.relowner) AS owner,
             class.relrowsecurity AS rls,
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_policy
                WHERE polrelid=class.oid AND polname='tenant_isolation'
             ) AS "tenantPolicy",
             pg_catalog.has_table_privilege('app_role', class.oid, 'SELECT') AS "appSelect",
             (
               pg_catalog.has_table_privilege('app_role', class.oid, 'INSERT')
               OR pg_catalog.has_table_privilege('app_role', class.oid, 'UPDATE')
               OR pg_catalog.has_table_privilege('app_role', class.oid, 'DELETE')
               OR pg_catalog.has_table_privilege('app_role', class.oid, 'TRUNCATE')
             ) AS "appMutation",
             (
               SELECT count(*)::int
                 FROM pg_catalog.aclexplode(
                   COALESCE(class.relacl, pg_catalog.acldefault('r', class.relowner))
                 ) AS acl
                WHERE acl.grantee=0
             ) AS "publicPrivileges",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint
                WHERE conrelid=class.oid
                  AND conname='tax_attribution_reservation_binding_binding_uq'
                  AND contype='u'
             ) AS "bindingUnique",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint
                WHERE conrelid=class.oid
                  AND conname='tax_attribution_reservation_binding_reservation_uq'
                  AND contype='u'
             ) AS "reservationUnique",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint
                WHERE conrelid=class.oid
                  AND conname='tax_attribution_reservation_binding_segment_uq'
                  AND contype='u'
             ) AS "segmentUnique",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint
                WHERE conrelid=class.oid
                  AND conname='tax_attribution_reservation_binding_source_fk'
                  AND confrelid='public.tax_attribution_hold_binding'::regclass
             ) AS "sourceFk",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint
                WHERE conrelid=class.oid
                  AND conname='tax_attribution_reservation_binding_reservation_fk'
                  AND confrelid='public.reservation'::regclass
             ) AS "reservationFk",
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_constraint
                WHERE conrelid=class.oid
                  AND conname='tax_attribution_reservation_binding_segment_fk'
                  AND confrelid='public.reservation_segment'::regclass
             ) AS "segmentFk"
        FROM pg_catalog.pg_class AS class
       WHERE class.oid='public.tax_attribution_reservation_binding'::regclass
    `;
    expect(relation).toEqual([{
      owner: "yellow_owner",
      rls: true,
      tenantPolicy: true,
      appSelect: true,
      appMutation: false,
      publicPrivileges: 0,
      bindingUnique: true,
      reservationUnique: true,
      segmentUnique: true,
      sourceFk: true,
      reservationFk: true,
      segmentFk: true,
    }]);

    const capability = await sql!<Array<{
      signature: string; owner: string; securityDefiner: boolean; config: string[];
      appExecute: boolean; runtimeExecute: boolean; publicExecute: boolean; result: string;
    }>>`
      SELECT procedure.oid::regprocedure::text AS signature,
             pg_catalog.pg_get_userbyid(procedure.proowner) AS owner,
             procedure.prosecdef AS "securityDefiner",
             procedure.proconfig AS config,
             pg_catalog.has_function_privilege('app_role', procedure.oid, 'EXECUTE') AS "appExecute",
             pg_catalog.has_function_privilege('yellow_runtime', procedure.oid, 'EXECUTE') AS "runtimeExecute",
             pg_catalog.has_function_privilege('public', procedure.oid, 'EXECUTE') AS "publicExecute",
             pg_catalog.pg_get_function_result(procedure.oid) AS result
        FROM pg_catalog.pg_proc AS procedure
       WHERE procedure.oid =
         'public.link_tax_attribution_reservation(uuid,uuid,uuid,uuid,uuid,uuid)'::regprocedure
    `;
    expect(capability).toEqual([{
      signature: "link_tax_attribution_reservation(uuid,uuid,uuid,uuid,uuid,uuid)",
      owner: "yellow_owner",
      securityDefiner: true,
      config: ["search_path=pg_catalog, public, pg_temp"],
      appExecute: true,
      runtimeExecute: false,
      publicExecute: false,
      result: "TABLE(lineage_id uuid, binding_id uuid, hold_id uuid, attribution_id uuid, reservation_id uuid, segment_id uuid, origin_quote_hash text, snapshot_hash text, currency character, linked_by uuid, linked_at timestamp with time zone, created boolean)",
    }]);
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
    expect(shape).toEqual([{ tables: 111, policies: 101 }]);

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
      tables: 111, policies: 101, directBill: 1,
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

  test("has exact Order291 payment-receipt snapshot shape, FK, checks and SELECT-only ACL", async () => {
    const shape = await sql!<Array<{ columns: string; owner: string; rls: boolean; force: boolean; policies: number; appSelect: boolean; appMutation: boolean; fk: boolean; serviceUnique: boolean }>>`
      SELECT (SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='india_gst_accommodation_payment_receipt_snapshot') columns,
        pg_get_userbyid(c.relowner) owner, c.relrowsecurity rls, c.relforcerowsecurity force,
        (SELECT count(*)::int FROM pg_policy WHERE polrelid=c.oid) policies,
        has_table_privilege('app_role',c.oid,'SELECT') "appSelect",
        (has_table_privilege('app_role',c.oid,'INSERT') OR has_table_privilege('app_role',c.oid,'UPDATE') OR has_table_privilege('app_role',c.oid,'DELETE') OR has_table_privilege('app_role',c.oid,'TRUNCATE')) "appMutation",
        EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=c.oid AND contype='f' AND conname='india_gst_accommodation_payment_receipt_service_fk') fk,
        EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=c.oid AND contype='u' AND conname='india_gst_accommodation_payment_receipt_service_uq') "serviceUnique"
      FROM pg_class c WHERE c.oid='public.india_gst_accommodation_payment_receipt_snapshot'::regclass`;
    expect(shape).toEqual([{ columns: "tenant_id,id,service_provision_snapshot_id,currency,amount_minor,coverage_scope,supplier_books_entry_date,supplier_bank_credit_date,payment_receipt_date,payment_receipt_source,payment_receipt_evidence_sha256,legal_rule", owner: "yellow_owner", rls: true, force: true, policies: 1, appSelect: true, appMutation: false, fk: true, serviceUnique: true }]);
    const checks = await sql!<{ name: string }[]>`SELECT conname name FROM pg_constraint WHERE conrelid='public.india_gst_accommodation_payment_receipt_snapshot'::regclass AND contype='c' ORDER BY conname`;
    expect(checks.map((x) => x.name)).toEqual([
      "india_gst_accommodation_payment_receipt_amount_ck", "india_gst_accommodation_payment_receipt_bank_date_ck",
      "india_gst_accommodation_payment_receipt_books_date_ck", "india_gst_accommodation_payment_receipt_coverage_ck",
      "india_gst_accommodation_payment_receipt_currency_ck", "india_gst_accommodation_payment_receipt_date_ck",
      "india_gst_accommodation_payment_receipt_evidence_ck", "india_gst_accommodation_payment_receipt_legal_rule_ck",
      "india_gst_accommodation_payment_receipt_source_ck",
    ]);
  });

  test("has exact Order292 invoice-issue snapshot shape, FK, checks and SELECT-only ACL", async () => {
    const shape = await sql!<Array<{ columns: string; owner: string; rls: boolean; force: boolean; policies: number; appSelect: boolean; appMutation: boolean; fk: boolean; serviceUnique: boolean; identityUnique: boolean }>>`
      SELECT (SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='india_gst_accommodation_invoice_issue_snapshot') columns,
        pg_get_userbyid(c.relowner) owner, c.relrowsecurity rls, c.relforcerowsecurity force,
        (SELECT count(*)::int FROM pg_policy WHERE polrelid=c.oid) policies,
        has_table_privilege('app_role',c.oid,'SELECT') "appSelect",
        (has_table_privilege('app_role',c.oid,'INSERT') OR has_table_privilege('app_role',c.oid,'UPDATE') OR has_table_privilege('app_role',c.oid,'DELETE') OR has_table_privilege('app_role',c.oid,'TRUNCATE')) "appMutation",
        EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=c.oid AND contype='f' AND conname='india_gst_accommodation_invoice_issue_service_fk') fk,
        EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=c.oid AND contype='u' AND conname='india_gst_accommodation_invoice_issue_service_uq') "serviceUnique",
        EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=c.oid AND contype='u' AND conname='india_gst_accommodation_invoice_issue_identity_uq') "identityUnique"
      FROM pg_class c WHERE c.oid='public.india_gst_accommodation_invoice_issue_snapshot'::regclass`;
    expect(shape).toEqual([{ columns: "tenant_id,id,service_provision_snapshot_id,currency,amount_minor,coverage_scope,invoice_series,invoice_serial,invoice_issue_date,invoice_issue_source,invoice_issue_evidence_sha256,legal_rule", owner: "yellow_owner", rls: true, force: true, policies: 1, appSelect: true, appMutation: false, fk: true, serviceUnique: true, identityUnique: true }]);
    const checks = await sql!<{ name: string }[]>`SELECT conname name FROM pg_constraint WHERE conrelid='public.india_gst_accommodation_invoice_issue_snapshot'::regclass AND contype='c' ORDER BY conname`;
    expect(checks.map((x) => x.name)).toEqual([
      "india_gst_accommodation_invoice_issue_amount_ck", "india_gst_accommodation_invoice_issue_coverage_ck",
      "india_gst_accommodation_invoice_issue_currency_ck", "india_gst_accommodation_invoice_issue_date_ck",
      "india_gst_accommodation_invoice_issue_evidence_ck", "india_gst_accommodation_invoice_issue_legal_rule_ck",
      "india_gst_accommodation_invoice_issue_serial_ck", "india_gst_accommodation_invoice_issue_series_ck",
      "india_gst_accommodation_invoice_issue_source_ck",
    ]);
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
