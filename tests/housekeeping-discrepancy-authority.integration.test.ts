import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

const migration = Bun.file(new URL(
  "../migrations/0036_governed_room_discrepancy_reporting.sql",
  import.meta.url,
));

const SIGNATURE =
  "public.report_room_discrepancy(uuid,uuid,uuid,text,integer,uuid)";

describe("Order 235 governed room discrepancy authority source", () => {
  test("migration0036 is one create-only, fixed-search-path owner capability", async () => {
    const source = await migration.text();

    expect(source).toContain("CREATE FUNCTION public.report_room_discrepancy(");
    expect(source).toContain("p_tenant uuid");
    expect(source).toContain("p_property uuid");
    expect(source).toContain("p_space uuid");
    expect(source).toContain("p_observed_presence text");
    expect(source).toContain("p_observed_persons integer");
    expect(source).toContain("p_actor uuid");
    expect(source).toContain("SECURITY DEFINER");
    expect(source).toContain("SET search_path = pg_catalog, public");
    expect(source).toContain("session_user <> 'yellow_runtime'");
    expect(source).toContain("current_setting('role', true) IS DISTINCT FROM 'app_role'");
    expect(source).toContain("current_user <> 'yellow_owner'");
    expect(source).toContain("current_setting('app.tenant_id', true)");
    expect(source).toContain("ALTER FUNCTION public.report_room_discrepancy(");
    expect(source).toContain("OWNER TO yellow_owner");
    expect(source).toContain("GRANT EXECUTE ON FUNCTION public.report_room_discrepancy(");
    expect(source).toContain("TO app_role");
    expect(source).toContain("REVOKE ALL ON FUNCTION public.report_room_discrepancy(");
    expect(source).toContain("FROM PUBLIC, app_role, yellow_runtime");
    expect(source).toContain("CREATE UNIQUE INDEX");
    expect(source).toContain("ON public.discrepancy (tenant_id, space_id)");
    expect(source).toContain("WHERE resolved_at IS NULL");
    expect(source).toContain(
      "REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.discrepancy FROM app_role",
    );

    expect(source).toContain("INSERT INTO public.discrepancy");
    expect(source).not.toContain("UPDATE public.discrepancy");
    expect(source).not.toContain("DELETE FROM public.discrepancy");
    expect(source).not.toContain("INSERT INTO public.space_occupancy");
    expect(source).not.toContain("UPDATE public.space_occupancy");
    expect(source).not.toContain("DELETE FROM public.space_occupancy");
  });

  test("the capability returns only the minimized canonical discrepancy receipt", async () => {
    const source = await migration.text();

    for (const field of [
      "discrepancy_id uuid",
      "room_id uuid",
      "room_code text",
      "room_floor text",
      "discrepancy_kind text",
      "reported_value text",
      "system_value text",
      "reporter_id uuid",
      "discrepancy_reported_at timestamptz",
      "created boolean",
    ]) {
      expect(source).toContain(field);
    }
    expect(source).not.toMatch(/RETURNS TABLE\s*\([^)]*reservation_id/is);
    expect(source).not.toMatch(/RETURNS TABLE\s*\([^)]*segment_id/is);
    expect(source).not.toMatch(/RETURNS TABLE\s*\([^)]*occupancy_id/is);
    expect(source).not.toMatch(/RETURNS TABLE\s*\([^)]*guest/is);
  });
});

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_DISCREPANCY_AUTHORITY === "1";

if (REQUIRE_DATABASE && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error(
    "Order 235 authority proof requires YELLOW_DEPLOY_DATABASE_URL and YELLOW_RUNTIME_DATABASE_URL",
  );
}

const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
let deploy: SQL | undefined;
let runtime: SQL | undefined;

function sqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const record = error as Record<string, unknown>;
  for (const key of ["errno", "code", "sqlState"]) {
    if (typeof record[key] === "string") return record[key];
  }
  return undefined;
}

async function expectState(action: () => Promise<unknown>, expected: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    expect(sqlState(error)).toBe(expected);
    return;
  }
  throw new Error(`Expected SQLSTATE ${expected}`);
}

beforeAll(() => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 2 });
  runtime = new SQL(RUNTIME_URL, { max: 2 });
});

afterAll(async () => {
  await runtime?.close();
  await deploy?.close();
});

databaseDescribe("Order 235 executable discrepancy authority", () => {
  test("function owner, volatility, search path and exact execute ACL are bounded", async () => {
    const rows = await deploy!<Array<{
      signature: string;
      owner: string;
      securityDefiner: boolean;
      volatility: string;
      settings: string[];
      appExecute: boolean;
      runtimeExecute: boolean;
      publicExecute: boolean;
    }>>`
      SELECT procedure.oid::regprocedure::text AS signature,
             pg_get_userbyid(procedure.proowner) AS owner,
             procedure.prosecdef AS "securityDefiner",
             procedure.provolatile::text AS volatility,
             COALESCE(procedure.proconfig, ARRAY[]::text[]) AS settings,
             has_function_privilege('app_role', procedure.oid, 'EXECUTE') AS "appExecute",
             has_function_privilege('yellow_runtime', procedure.oid, 'EXECUTE') AS "runtimeExecute",
             has_function_privilege('public', procedure.oid, 'EXECUTE') AS "publicExecute"
        FROM pg_proc AS procedure
        JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
       WHERE namespace.nspname = 'public'
         AND procedure.proname = 'report_room_discrepancy'
    `;

    expect(rows).toEqual([{
      signature: SIGNATURE.replace("public.", ""),
      owner: "yellow_owner",
      securityDefiner: true,
      volatility: "v",
      settings: ["search_path=pg_catalog, public"],
      appExecute: true,
      runtimeExecute: false,
      publicExecute: false,
    }]);
  });

  test("raw discrepancy mutation stays denied to app_role", async () => {
    const indexes = await deploy!<Array<{ uniqueIndex: boolean; predicate: string | null }>>`
      SELECT index_class.relname IS NOT NULL AND index.indisunique AS "uniqueIndex",
             pg_get_expr(index.indpred, index.indrelid) AS predicate
        FROM pg_index AS index
        JOIN pg_class AS table_class ON table_class.oid = index.indrelid
        JOIN pg_namespace AS namespace ON namespace.oid = table_class.relnamespace
        JOIN pg_class AS index_class ON index_class.oid = index.indexrelid
       WHERE namespace.nspname = 'public'
         AND table_class.relname = 'discrepancy'
         AND index.indisunique
         AND (SELECT array_agg(attribute.attname::text ORDER BY key.ordinality)
                FROM unnest(index.indkey) WITH ORDINALITY AS key(attnum, ordinality)
                JOIN pg_attribute AS attribute
                  ON attribute.attrelid = table_class.oid
                 AND attribute.attnum = key.attnum) = ARRAY['tenant_id','space_id']
    `;
    expect(indexes).toEqual([{
      uniqueIndex: true,
      predicate: "(resolved_at IS NULL)",
    }]);

    const privileges = await deploy!<Array<{
      selectAllowed: boolean;
      insertAllowed: boolean;
      updateAllowed: boolean;
      deleteAllowed: boolean;
      truncateAllowed: boolean;
    }>>`
      SELECT has_table_privilege('app_role','public.discrepancy','SELECT') AS "selectAllowed",
             has_table_privilege('app_role','public.discrepancy','INSERT') AS "insertAllowed",
             has_table_privilege('app_role','public.discrepancy','UPDATE') AS "updateAllowed",
             has_table_privilege('app_role','public.discrepancy','DELETE') AS "deleteAllowed",
             has_table_privilege('app_role','public.discrepancy','TRUNCATE') AS "truncateAllowed"
    `;
    expect(privileges).toEqual([{
      selectAllowed: true,
      insertAllowed: false,
      updateAllowed: false,
      deleteAllowed: false,
      truncateAllowed: false,
    }]);

    await runtime!.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000023501', true)`;
      await tx.unsafe("SET LOCAL ROLE app_role");
      await expectState(
        () => tx.unsafe("INSERT INTO public.discrepancy (tenant_id,space_id,reported,system_state) VALUES ('00000000-0000-0000-0000-000000023501','00000000-0000-0000-0000-000000023502','occupied','vacant')"),
        "42501",
      );
    });
    await runtime!.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000023501', true)`;
      await tx.unsafe("SET LOCAL ROLE app_role");
      await expectState(
        () => tx.unsafe("UPDATE public.discrepancy SET resolution='hostile' WHERE false"),
        "42501",
      );
    });
    await runtime!.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000023501', true)`;
      await tx.unsafe("SET LOCAL ROLE app_role");
      await expectState(
        () => tx.unsafe("DELETE FROM public.discrepancy WHERE false"),
        "42501",
      );
    });
  });

  test("direct runtime invocation is denied while the exact assumed role reaches input validation", async () => {
    const directInvocation = `SELECT * FROM ${SIGNATURE.slice(0, SIGNATURE.indexOf("("))}(
      NULL::uuid,NULL::uuid,NULL::uuid,NULL::text,NULL::integer,NULL::uuid
    )`;
    await expectState(() => runtime!.unsafe(directInvocation), "42501");

    await runtime!.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000023501', true)`;
      await tx.unsafe("SET LOCAL ROLE app_role");
      await expectState(
        () => tx.unsafe(`SELECT * FROM ${SIGNATURE.slice(0, SIGNATURE.indexOf("("))}(
          '00000000-0000-0000-0000-000000023501'::uuid,
          NULL::uuid,NULL::uuid,NULL::text,NULL::integer,NULL::uuid
        )`),
        "22023",
      );
    });
  });

  test("the assumed role cannot cross the transaction-local tenant boundary", async () => {
    await runtime!.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000023501', true)`;
      await tx.unsafe("SET LOCAL ROLE app_role");
      await expectState(
        () => tx.unsafe(`SELECT * FROM public.report_room_discrepancy(
          '00000000-0000-0000-0000-000000023599'::uuid,
          NULL::uuid,NULL::uuid,NULL::text,NULL::integer,NULL::uuid
        )`),
        "42501",
      );
    });
  });
});
