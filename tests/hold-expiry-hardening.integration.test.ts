import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

const DATABASE_URL = process.env.YELLOW_HOLD_HARDENING_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_HOLD_HARDENING === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_HOLD_HARDENING_URL is required by the Order 029 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let sql: SQL | undefined;

beforeAll(() => {
  if (DATABASE_URL) sql = new SQL(DATABASE_URL, { max: 2 });
});

afterAll(async () => {
  await sql?.close();
});

databaseDescribe("Order 029 legacy hold-expiry privilege hardening", () => {
  test("P2: PUBLIC and app_role have no execute privilege", async () => {
    const rows = await sql!<Array<{ public_execute: number; app_execute: boolean }>>`
      SELECT
        (SELECT count(*)::int
         FROM pg_proc AS p
         CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
         WHERE p.oid = 'public.expire_holds()'::regprocedure
           AND acl.grantee = 0
           AND acl.privilege_type = 'EXECUTE') AS public_execute,
        has_function_privilege('app_role', 'public.expire_holds()', 'EXECUTE') AS app_execute
    `;
    expect(rows).toEqual([{ public_execute: 0, app_execute: false }]);
  });

  test("P3: app_role invocation is denied with SQLSTATE 42501", async () => {
    const connection = await sql!.reserve();
    let observed: unknown;
    try {
      await connection.unsafe("BEGIN");
      await connection`SELECT set_config('app.tenant_id', ${TENANT_A}, true)`;
      await connection.unsafe("SET LOCAL ROLE app_role");
      try {
        await connection`SELECT expire_holds()`;
      } catch (error) {
        observed = error;
      }
      await connection.unsafe("ROLLBACK");
    } finally {
      connection.release();
    }
    expect(observed).toBeDefined();
    expect((observed as { errno?: string }).errno).toBe("42501");
  });
});
