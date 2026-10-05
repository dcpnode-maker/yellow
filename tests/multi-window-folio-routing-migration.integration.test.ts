import { afterAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

const URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_MULTI_WINDOW_ROUTING === "1" && !URL) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL is required by the Order 188 migration proof");
}

const databaseDescribe = URL ? describe.serial : describe.skip;
const sql = URL ? new SQL(URL, { max: 1 }) : undefined;

afterAll(async () => {
  await sql?.close();
});

databaseDescribe("Order 188 migration 0020 acceptance", () => {
  test("P1: ledger, typed lineage constraints and tenant-leading lookup are exact", async () => {
    const ledger = await sql!<Array<{ version: string; filename: string }>>`
      SELECT version::text, filename
        FROM public.schema_migration
       WHERE version = 20
    `;
    expect(ledger).toEqual([{
      version: "20",
      filename: "0020_multi_window_folio_routing.sql",
    }]);

    const column = await sql!<Array<{ nullable: string; type: string }>>`
      SELECT is_nullable AS nullable, udt_name AS type
        FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'posting_line'
         AND column_name = 'folio_transfer_root_line_id'
    `;
    expect(column).toEqual([{ nullable: "YES", type: "uuid" }]);

    const constraints = await sql!<Array<{ name: string; definition: string }>>`
      SELECT conname AS name,
             pg_get_constraintdef(oid, true) AS definition
        FROM pg_constraint
       WHERE conrelid = 'public.posting_line'::regclass
         AND conname IN (
           'posting_line_tenant_id_id_uq',
           'posting_line_transfer_root_not_self_ck',
           'posting_line_transfer_shape_ck',
           'posting_line_transfer_root_fk'
         )
       ORDER BY conname
    `;
    expect(constraints).toEqual([
      { name: "posting_line_tenant_id_id_uq", definition: "UNIQUE (tenant_id, id)" },
      { name: "posting_line_transfer_root_fk", definition: "FOREIGN KEY (tenant_id, folio_transfer_root_line_id) REFERENCES posting_line(tenant_id, id)" },
      { name: "posting_line_transfer_root_not_self_ck", definition: "CHECK (folio_transfer_root_line_id IS NULL OR folio_transfer_root_line_id <> id)" },
      { name: "posting_line_transfer_shape_ck", definition: "CHECK (folio_transfer_root_line_id IS NULL OR folio_id IS NOT NULL AND amount_minor <> 0 AND tax_detail IS NULL)" },
    ]);

    const indexes = await sql!<Array<{ name: string; definition: string }>>`
      SELECT indexname AS name, indexdef AS definition
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'posting_line_transfer_root_lookup'
    `;
    expect(indexes).toHaveLength(1);
    expect(indexes[0]?.definition).toContain(
      "(tenant_id, folio_transfer_root_line_id) WHERE (folio_transfer_root_line_id IS NOT NULL)",
    );
  });

  test("P1: transfer command signature, owner, search path, ACL and returned shape are exact", async () => {
    const functions = await sql!<Array<{
      signature: string;
      owner: string;
      securityDefiner: boolean;
      volatility: string;
      config: string[];
      appExecute: boolean;
      runtimeExecute: boolean;
      publicDenied: boolean;
      result: string;
      source: string;
    }>>`
      SELECT p.oid::regprocedure::text AS signature,
             pg_get_userbyid(p.proowner) AS owner,
             p.prosecdef AS "securityDefiner",
             p.provolatile::text AS volatility,
             p.proconfig AS config,
             has_function_privilege('app_role', p.oid, 'EXECUTE') AS "appExecute",
             has_function_privilege('yellow_runtime', p.oid, 'EXECUTE') AS "runtimeExecute",
             NOT EXISTS (
               SELECT 1
                 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
                WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
             ) AS "publicDenied",
             pg_get_function_result(p.oid) AS result,
             p.prosrc AS source
        FROM pg_proc AS p
       WHERE p.oid = 'public.create_folio_transfer(uuid,uuid,uuid,uuid[],uuid,text)'::regprocedure
    `;
    const fn = functions[0];
    expect(fn).toBeDefined();
    expect({
      signature: fn?.signature,
      owner: fn?.owner,
      securityDefiner: fn?.securityDefiner,
      volatility: fn?.volatility,
      config: fn?.config,
      appExecute: fn?.appExecute,
      runtimeExecute: fn?.runtimeExecute,
      publicDenied: fn?.publicDenied,
    }).toEqual({
      signature: "create_folio_transfer(uuid,uuid,uuid,uuid[],uuid,text)",
      owner: "yellow_owner",
      securityDefiner: true,
      volatility: "v",
      config: ["search_path=pg_catalog, public, pg_temp"],
      appExecute: true,
      runtimeExecute: false,
      publicDenied: true,
    });
    expect(fn?.result).toBe(
      "TABLE(journal_id uuid, property_node uuid, business_date date, currency character, source_folio_id uuid, destination_folio_id uuid, root_line_id uuid, amount_minor bigint, tx_code text, description text, quantity numeric)",
    );
    expect(fn?.source).toContain("session_user <> 'yellow_runtime'");
    expect(fn?.source).toContain("current_user <> 'yellow_owner'");
    expect(fn?.source).toContain(":folio-transfer-root:");
    expect(fn?.source).toContain("corrected folio transfer roots must move with their contra companion");

    const lineagePrivileges = await sql!<Array<{ insertAllowed: boolean; updateAllowed: boolean }>>`
      SELECT has_column_privilege(
               'app_role','public.posting_line','folio_transfer_root_line_id','INSERT'
             ) AS "insertAllowed",
             has_column_privilege(
               'app_role','public.posting_line','folio_transfer_root_line_id','UPDATE'
             ) AS "updateAllowed"
    `;
    expect(lineagePrivileges).toEqual([{ insertAllowed: false, updateAllowed: false }]);
  });
});
