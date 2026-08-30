import { describe, expect, test } from "bun:test";
import { SQL } from "bun";

const migration = new URL("../migrations/0059_tax_extension_effective_period.sql", import.meta.url);
const DEPLOY_URL = process.env.YELLOW_ORDER299_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER299_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER299_DATABASE === "1";

if (required && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Order 299 deploy and runtime database URLs are required");
}

const id = (suffix: number) =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const TENANT_A = id(29901);
const TENANT_B = id(29902);
const GLOBAL = id(29911);
const BOUNDED = id(29912);
const LOWER_UNBOUNDED = id(29913);
const UPPER_UNBOUNDED = id(29914);
const FOREIGN = id(29915);
const EMPTY = id(29916);
const INFINITE = id(29917);

async function sqlState(operation: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await operation();
  } catch (error) {
    return (error as { errno?: string }).errno;
  }
  return undefined;
}

describe("Order 299 migration contract", () => {
  test("defines one qualified, runtime-only, exact-identity effective-period projection", async () => {
    const source = await Bun.file(migration).text();
    expect(source).toContain("runtime_visible_extension_effective_period");
    expect(source).toContain("RETURNS TABLE(");
    for (const term of [
      "extension_id uuid",
      "owner_tenant_id uuid",
      "effective_from_instant timestamptz",
      "effective_to_instant timestamptz",
      "FROM public.extension AS e",
      "e.id = p_extension",
      "e.tenant_id IS NULL OR e.tenant_id = p_tenant",
      "session_user <> 'yellow_runtime'",
      "OWNER TO yellow_owner",
      "FROM PUBLIC, app_role",
      "TO yellow_runtime",
      "SET search_path = pg_catalog, public, pg_temp",
    ]) expect(source).toContain(term);
    expect(source).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE)\b/i);
  });
});

const live = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
live("Order 299 live PostgreSQL authority, visibility, and range proof", () => {
  const deploy = new SQL(DEPLOY_URL!, { max: 1 });
  const runtime = new SQL(RUNTIME_URL!, { max: 1 });

  test("P1-P4: exact typed bounds, tenant/global visibility, denial, and fail-closed identity", async () => {
    try {
      await deploy.unsafe(`
        SET ROLE yellow_owner;
        DELETE FROM public.extension
         WHERE id IN ('${GLOBAL}','${BOUNDED}','${LOWER_UNBOUNDED}','${UPPER_UNBOUNDED}',
                      '${FOREIGN}','${EMPTY}','${INFINITE}');
        INSERT INTO public.extension (id, tenant_id, type, key, version, effective, content, status)
        VALUES
          ('${GLOBAL}', NULL, 'tax_jurisdiction', 'order299-global', 1,
           tstzrange('2026-01-01 01:02:03.123456+05:30','2027-02-03 04:05:06.654321-04','[)'), '{}'::jsonb, 'active'),
          ('${BOUNDED}', '${TENANT_A}', 'tax_jurisdiction', 'order299-bounded', 1,
           tstzrange('2030-03-04 05:06:07.000008+00','2031-04-05 06:07:08.000009+00','[)'), '{}'::jsonb, 'active'),
          ('${LOWER_UNBOUNDED}', '${TENANT_A}', 'tax_jurisdiction', 'order299-lower-open', 1,
           tstzrange(NULL,'2032-05-06 07:08:09.000010+00','()'), '{}'::jsonb, 'active'),
          ('${UPPER_UNBOUNDED}', '${TENANT_A}', 'tax_jurisdiction', 'order299-upper-open', 1,
           tstzrange('2033-06-07 08:09:10.000011+00',NULL,'[)'), '{}'::jsonb, 'active'),
          ('${FOREIGN}', '${TENANT_B}', 'tax_jurisdiction', 'order299-foreign', 1,
           tstzrange('2034-01-01+00','2035-01-01+00','[)'), '{}'::jsonb, 'active'),
          ('${EMPTY}', '${TENANT_A}', 'tax_jurisdiction', 'order299-empty', 1,
           'empty'::tstzrange, '{}'::jsonb, 'active'),
          ('${INFINITE}', '${TENANT_A}', 'tax_jurisdiction', 'order299-infinity', 1,
           tstzrange('infinity'::timestamptz,NULL,'[)'), '{}'::jsonb, 'active');
        RESET ROLE;
      `);

      const catalogue = await deploy<Array<Record<string, unknown>>>`
        SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef security_definer,
               p.provolatile volatility, p.proretset returns_set,
               p.proconfig config,
               pg_get_function_result(p.oid) result,
               has_function_privilege('public',p.oid,'EXECUTE') public_execute,
               has_function_privilege('app_role',p.oid,'EXECUTE') app_execute,
               has_function_privilege('yellow_runtime',p.oid,'EXECUTE') runtime_execute
          FROM pg_proc p
         WHERE p.oid='public.runtime_visible_extension_effective_period(uuid,uuid)'::regprocedure
      `;
      expect(catalogue).toEqual([{
        owner: "yellow_owner", security_definer: true, volatility: "s", returns_set: true,
        config: ["search_path=pg_catalog, public, pg_temp"],
        result: "TABLE(extension_id uuid, owner_tenant_id uuid, effective_from_instant timestamp with time zone, effective_to_instant timestamp with time zone)",
        public_execute: false, app_execute: false, runtime_execute: true,
      }]);

      await runtime.unsafe("SET TIME ZONE 'UTC'");
      const read = async (tenant: string, extension: string) => runtime<Array<Record<string, unknown>>>`
        SELECT extension_id::text, owner_tenant_id::text,
               effective_from_instant::text, effective_to_instant::text
          FROM public.runtime_visible_extension_effective_period(${tenant}::uuid,${extension}::uuid)
      `;
      expect(await read(TENANT_A, GLOBAL)).toEqual([{
        extension_id: GLOBAL, owner_tenant_id: null,
        effective_from_instant: "2025-12-31 19:32:03.123456+00",
        effective_to_instant: "2027-02-03 08:05:06.654321+00",
      }]);
      expect(await read(TENANT_A, BOUNDED)).toEqual([{
        extension_id: BOUNDED, owner_tenant_id: TENANT_A,
        effective_from_instant: "2030-03-04 05:06:07.000008+00",
        effective_to_instant: "2031-04-05 06:07:08.000009+00",
      }]);
      expect(await read(TENANT_A, LOWER_UNBOUNDED)).toEqual([{
        extension_id: LOWER_UNBOUNDED, owner_tenant_id: TENANT_A,
        effective_from_instant: null, effective_to_instant: "2032-05-06 07:08:09.00001+00",
      }]);
      expect(await read(TENANT_A, UPPER_UNBOUNDED)).toEqual([{
        extension_id: UPPER_UNBOUNDED, owner_tenant_id: TENANT_A,
        effective_from_instant: "2033-06-07 08:09:10.000011+00", effective_to_instant: null,
      }]);

      for (const operation of [
        () => read(TENANT_A, FOREIGN),
        () => read(TENANT_B, BOUNDED),
        () => read(TENANT_A, id(29999)),
        () => runtime`SELECT * FROM public.runtime_visible_extension_effective_period(NULL::uuid,${GLOBAL}::uuid)`,
        () => runtime`SELECT * FROM public.runtime_visible_extension_effective_period(${TENANT_A}::uuid,NULL::uuid)`,
        () => runtime.unsafe("SELECT * FROM public.runtime_visible_extension_effective_period('bad'::uuid,'bad'::uuid)"),
        () => read(TENANT_A, EMPTY),
        () => read(TENANT_A, INFINITE),
      ]) {
        const state = await sqlState(operation);
        expect(state).toBeDefined();
        expect(["22023", "22P02"]).toContain(state!);
      }

      expect(await sqlState(() => deploy.unsafe(`SET ROLE app_role; SELECT * FROM public.runtime_visible_extension_effective_period('${TENANT_A}'::uuid,'${GLOBAL}'::uuid)`))).toBe("42501");
      await deploy.unsafe("RESET ROLE");

      await runtime.unsafe("CREATE TEMP TABLE extension (id uuid, effective tstzrange)");
      await runtime.unsafe(`INSERT INTO pg_temp.extension VALUES ('${GLOBAL}', tstzrange('1900-01-01+00',NULL,'[)'))`);
      expect(await read(TENANT_A, GLOBAL)).toEqual([{
        extension_id: GLOBAL, owner_tenant_id: null,
        effective_from_instant: "2025-12-31 19:32:03.123456+00",
        effective_to_instant: "2027-02-03 08:05:06.654321+00",
      }]);
    } finally {
      await deploy.unsafe(`RESET ROLE; SET ROLE yellow_owner; DELETE FROM public.extension WHERE id IN ('${GLOBAL}','${BOUNDED}','${LOWER_UNBOUNDED}','${UPPER_UNBOUNDED}','${FOREIGN}','${EMPTY}','${INFINITE}'); RESET ROLE;`).catch(() => {});
      await Promise.all([deploy.close(), runtime.close()]);
    }
  }, 30_000);
});
