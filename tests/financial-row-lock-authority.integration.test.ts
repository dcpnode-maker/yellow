import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

const DEPLOY_URL = process.env.YELLOW_FINANCIAL_ROW_LOCK_URL ?? process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_FINANCIAL_ROW_LOCK === "1";

if (REQUIRE_DATABASE && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error(
    "YELLOW_FINANCIAL_ROW_LOCK_URL and YELLOW_RUNTIME_DATABASE_URL are required by the Order 151 proof",
  );
}

const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
let deploy: SQL | undefined;
let runtime: SQL | undefined;

const TENANT_A = "00000000-0000-0000-0000-000000015101";
const TENANT_B = "00000000-0000-0000-0000-000000015102";
const PROPERTY_A = "00000000-0000-0000-0000-000000015111";
const PROPERTY_B = "00000000-0000-0000-0000-000000015112";
const ACCOUNT_GUEST = "00000000-0000-0000-0000-000000015121";
const ACCOUNT_REVENUE = "00000000-0000-0000-0000-000000015122";
const ACCOUNT_UNRELATED = "00000000-0000-0000-0000-000000015123";
const ACCOUNT_FOREIGN = "00000000-0000-0000-0000-000000015124";
const FOLIO_TARGET = "00000000-0000-0000-0000-000000015131";
const FOLIO_UNRELATED = "00000000-0000-0000-0000-000000015132";
const FOLIO_FOREIGN = "00000000-0000-0000-0000-000000015133";
const MISSING = "00000000-0000-0000-0000-000000015199";

interface SqlFailure {
  readonly code: string | undefined;
  readonly message: string;
}

function sqlFailure(error: unknown): SqlFailure {
  const failure = error as { errno?: string; message?: string };
  return { code: failure.errno, message: failure.message ?? String(error) };
}

async function captureFailure(operation: () => Promise<unknown>): Promise<SqlFailure> {
  try {
    await operation();
  } catch (error) {
    return sqlFailure(error);
  }
  throw new Error("Expected PostgreSQL operation to fail");
}

async function callCapability(
  sql: SQL,
  tenantId: string,
  accountIds: readonly (string | null)[],
  folioId: string | null,
): Promise<void> {
  const accountArray = `{${accountIds.map((id) => id ?? "NULL").join(",")}}`;
  await sql.unsafe(
    "SELECT public.lock_financial_rows($1::uuid, $2::uuid[], $3::uuid)",
    [tenantId, accountArray, folioId],
  );
}

async function asAppRole<T>(
  tenantId: string,
  operation: (tx: SQL) => Promise<T>,
): Promise<T> {
  return runtime!.begin(async (tx) => {
    await tx`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    await tx.unsafe("SET LOCAL ROLE app_role");
    return operation(tx);
  });
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await deploy`DELETE FROM folio WHERE id IN (
    ${FOLIO_TARGET}::uuid, ${FOLIO_UNRELATED}::uuid, ${FOLIO_FOREIGN}::uuid
  )`;
  await deploy`DELETE FROM account WHERE id IN (
    ${ACCOUNT_GUEST}::uuid, ${ACCOUNT_REVENUE}::uuid,
    ${ACCOUNT_UNRELATED}::uuid, ${ACCOUNT_FOREIGN}::uuid
  )`;
  await deploy`DELETE FROM org_node WHERE id IN (${PROPERTY_A}::uuid, ${PROPERTY_B}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
}

async function snapshot(): Promise<unknown> {
  return deploy!`
    SELECT
      (SELECT COALESCE(jsonb_agg(to_jsonb(account) ORDER BY account.id), '[]'::jsonb)
         FROM account WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)) AS accounts,
      (SELECT COALESCE(jsonb_agg(to_jsonb(folio) ORDER BY folio.id), '[]'::jsonb)
         FROM folio WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)) AS folios,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)) AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)) AS events
  `;
}

async function expectDirectDenied(statement: string): Promise<void> {
  const failure = await captureFailure(() => asAppRole(TENANT_A, (tx) => tx.unsafe(statement)));
  expect(failure.code).toBe("42501");
}

async function expectNowaitBlocked(statement: string): Promise<void> {
  const failure = await captureFailure(() => deploy!.begin((tx) => tx.unsafe(statement)));
  expect(failure.code).toBe("55P03");
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 8 });
  runtime = new SQL(RUNTIME_URL, { max: 8, prepare: false });
  await cleanup();
  await deploy`INSERT INTO tenant (id, slug, name, tier, status) VALUES
    (${TENANT_A}::uuid, 'order151-a', 'Order 151 A', 'shared', 'active'),
    (${TENANT_B}::uuid, 'order151-b', 'Order 151 B', 'shared', 'active')`;
  await deploy`INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency) VALUES
    (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order151_a', 'property', 'Order 151 A', 'UTC', 'USD'),
    (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order151_b', 'property', 'Order 151 B', 'UTC', 'USD')`;
  await deploy`INSERT INTO account (id, tenant_id, property_node, role, name, currency, status) VALUES
    (${ACCOUNT_GUEST}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'guest', 'Order 151 Guest', 'USD', 'open'),
    (${ACCOUNT_REVENUE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'revenue', 'Order 151 Revenue', 'USD', 'open'),
    (${ACCOUNT_UNRELATED}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'house', 'Order 151 Unrelated', 'USD', 'open'),
    (${ACCOUNT_FOREIGN}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'guest', 'Order 151 Foreign', 'USD', 'open')`;
  await deploy`INSERT INTO folio (id, tenant_id, account_id, folio_no, window_no, name, status) VALUES
    (${FOLIO_TARGET}::uuid, ${TENANT_A}::uuid, ${ACCOUNT_GUEST}::uuid, 'O151-A', 1, 'Target', 'open'),
    (${FOLIO_UNRELATED}::uuid, ${TENANT_A}::uuid, ${ACCOUNT_UNRELATED}::uuid, 'O151-U', 1, 'Unrelated', 'open'),
    (${FOLIO_FOREIGN}::uuid, ${TENANT_B}::uuid, ${ACCOUNT_FOREIGN}::uuid, 'O151-B', 1, 'Foreign', 'open')`;
});

afterAll(async () => {
  await cleanup();
  await runtime?.close();
  await deploy?.close();
}, 30_000);

databaseDescribe("Order 151 bounded financial row-lock authority", () => {
  test("P1: function catalogue, owner, search path and ACL are exact while direct locks stay denied", async () => {
    const rows = await deploy!<Array<{
      signature: string;
      owner: string;
      security_definer: boolean;
      volatility: string;
      config: string[] | null;
      result_type: string;
      source: string;
      execute_acl: string[];
      public_execute: boolean;
      app_direct: boolean;
      runtime_direct: boolean;
    }>>`
      SELECT p.oid::regprocedure::text AS signature,
             pg_get_userbyid(p.proowner) AS owner,
             p.prosecdef AS security_definer,
             p.provolatile::text AS volatility,
             p.proconfig AS config,
             p.prorettype::regtype::text AS result_type,
             p.prosrc AS source,
             ARRAY(
               SELECT COALESCE(role.rolname, 'PUBLIC')
                 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
                 LEFT JOIN pg_roles role ON role.oid = acl.grantee
                WHERE acl.privilege_type = 'EXECUTE'
                ORDER BY COALESCE(role.rolname, 'PUBLIC')
             ) AS execute_acl,
             EXISTS (
               SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
               WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
             ) AS public_execute,
             EXISTS (
               SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
               JOIN pg_roles role ON role.oid = acl.grantee
               WHERE role.rolname = 'app_role' AND acl.privilege_type = 'EXECUTE'
             ) AS app_direct,
             EXISTS (
               SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
               JOIN pg_roles role ON role.oid = acl.grantee
               WHERE role.rolname = 'yellow_runtime' AND acl.privilege_type = 'EXECUTE'
             ) AS runtime_direct
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.oid = 'public.lock_financial_rows(uuid,uuid[],uuid)'::regprocedure
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      signature: "lock_financial_rows(uuid,uuid[],uuid)",
      owner: "yellow_owner",
      security_definer: true,
      volatility: "v",
      config: ["search_path=pg_catalog, public, pg_temp"],
      result_type: "void",
      execute_acl: ["app_role", "yellow_owner"],
      public_execute: false,
      app_direct: true,
      runtime_direct: false,
    });
    expect(rows[0]!.source).toContain("public.account");
    expect(rows[0]!.source).toContain("public.folio");
    expect(rows[0]!.source).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM)\b/i);

    const directRuntime = await captureFailure(() => callCapability(
      runtime!, TENANT_A, [ACCOUNT_GUEST], FOLIO_TARGET,
    ));
    expect(directRuntime.code).toBe("42501");

    await expectDirectDenied(`UPDATE public.account SET status = status WHERE id = '${ACCOUNT_GUEST}'::uuid`);
    await expectDirectDenied(`UPDATE public.folio SET status = status WHERE id = '${FOLIO_TARGET}'::uuid`);
    await expectDirectDenied(`SELECT id FROM public.account WHERE id = '${ACCOUNT_GUEST}'::uuid FOR UPDATE`);
    await expectDirectDenied(`SELECT id FROM public.folio WHERE id = '${FOLIO_TARGET}'::uuid FOR SHARE`);
  });

  test("P2: validation is bounded, tenant-safe and non-enumerating", async () => {
    const missingContext = await captureFailure(() => runtime!.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE app_role");
      await callCapability(tx, TENANT_A, [ACCOUNT_GUEST], FOLIO_TARGET);
    }));
    expect(missingContext.code).toBe("42501");

    const wrongTenant = await captureFailure(() => asAppRole(TENANT_A, (tx) =>
      callCapability(tx, TENANT_B, [ACCOUNT_FOREIGN], FOLIO_FOREIGN)
    ));
    expect(wrongTenant.code).toBe("42501");

    const invalidInputs: readonly (readonly (string | null)[])[] = [
      [],
      [ACCOUNT_GUEST, ACCOUNT_REVENUE, ACCOUNT_UNRELATED],
      [ACCOUNT_GUEST, null],
      [ACCOUNT_GUEST, ACCOUNT_GUEST],
    ];
    for (const ids of invalidInputs) {
      const failure = await captureFailure(() => asAppRole(TENANT_A, (tx) =>
        callCapability(tx, TENANT_A, ids, null)
      ));
      expect(failure.code).toBe("22023");
    }

    const unavailable = await Promise.all([
      captureFailure(() => asAppRole(TENANT_A, (tx) =>
        callCapability(tx, TENANT_A, [MISSING], null)
      )),
      captureFailure(() => asAppRole(TENANT_A, (tx) =>
        callCapability(tx, TENANT_A, [ACCOUNT_FOREIGN], null)
      )),
      captureFailure(() => asAppRole(TENANT_A, (tx) =>
        callCapability(tx, TENANT_A, [ACCOUNT_GUEST], MISSING)
      )),
      captureFailure(() => asAppRole(TENANT_A, (tx) =>
        callCapability(tx, TENANT_A, [ACCOUNT_REVENUE], FOLIO_TARGET)
      )),
      captureFailure(() => asAppRole(TENANT_A, (tx) =>
        callCapability(tx, TENANT_A, [ACCOUNT_GUEST], FOLIO_FOREIGN)
      )),
    ]);
    expect(new Set(unavailable.map(({ code }) => code))).toEqual(new Set(["55000"]));
    expect(new Set(unavailable.map(({ message }) => message))).toEqual(
      new Set(["financial row lock targets are unavailable"]),
    );
  });

  test("P2: exact rows really lock, unrelated rows stay free, rollback releases, and pg_temp cannot shadow", async () => {
    const before = await snapshot();
    const shadowPool = new SQL(RUNTIME_URL!, { max: 1, prepare: false });
    const holder = await shadowPool.reserve();
    let began = false;
    try {
      await holder.unsafe("CREATE TEMP TABLE account (id uuid)");
      await holder.unsafe("CREATE TEMP TABLE folio (id uuid)");
      await holder.unsafe("BEGIN");
      began = true;
      await holder`SELECT set_config('app.tenant_id', ${TENANT_A}, true)`;
      await holder.unsafe("SET LOCAL ROLE app_role");
      await callCapability(holder, TENANT_A, [ACCOUNT_REVENUE, ACCOUNT_GUEST], FOLIO_TARGET);

      await expectNowaitBlocked(
        `SELECT id FROM public.account WHERE id = '${ACCOUNT_GUEST}'::uuid FOR UPDATE NOWAIT`,
      );
      await expectNowaitBlocked(
        `SELECT id FROM public.account WHERE id = '${ACCOUNT_REVENUE}'::uuid FOR UPDATE NOWAIT`,
      );
      await expectNowaitBlocked(
        `SELECT id FROM public.folio WHERE id = '${FOLIO_TARGET}'::uuid FOR UPDATE NOWAIT`,
      );
      await deploy!.begin(async (tx) => {
        await tx.unsafe(
          `SELECT id FROM public.account WHERE id = '${ACCOUNT_UNRELATED}'::uuid FOR UPDATE NOWAIT`,
        );
        await tx.unsafe(
          `SELECT id FROM public.folio WHERE id = '${FOLIO_UNRELATED}'::uuid FOR UPDATE NOWAIT`,
        );
      });

      await holder.unsafe("ROLLBACK");
      began = false;
      await deploy!.begin(async (tx) => {
        await tx.unsafe(
          `SELECT id FROM public.account WHERE id IN ('${ACCOUNT_GUEST}'::uuid, '${ACCOUNT_REVENUE}'::uuid) ORDER BY id FOR UPDATE NOWAIT`,
        );
        await tx.unsafe(
          `SELECT id FROM public.folio WHERE id = '${FOLIO_TARGET}'::uuid FOR UPDATE NOWAIT`,
        );
      });
      await holder.unsafe("DROP TABLE pg_temp.account");
      await holder.unsafe("DROP TABLE pg_temp.folio");
    } finally {
      if (began) await holder.unsafe("ROLLBACK").catch(() => undefined);
      holder.release();
      await shadowPool.close({ timeout: 0 });
    }
    expect(await snapshot()).toEqual(before);
  }, 15_000);

  test("P3: opposite two-account input order converges without deadlock", async () => {
    const first = await runtime!.reserve();
    const second = await runtime!.reserve();
    let firstBegan = false;
    let secondBegan = false;
    try {
      await first.unsafe("BEGIN");
      firstBegan = true;
      await first`SELECT set_config('app.tenant_id', ${TENANT_A}, true)`;
      await first.unsafe("SET LOCAL ROLE app_role");
      await callCapability(first, TENANT_A, [ACCOUNT_GUEST, ACCOUNT_REVENUE], FOLIO_TARGET);

      await second.unsafe("BEGIN");
      secondBegan = true;
      await second`SELECT set_config('app.tenant_id', ${TENANT_A}, true)`;
      await second.unsafe("SET LOCAL ROLE app_role");
      const secondLock = callCapability(
        second, TENANT_A, [ACCOUNT_REVENUE, ACCOUNT_GUEST], FOLIO_TARGET,
      );
      const early = await Promise.race([
        secondLock.then(() => "acquired" as const),
        Bun.sleep(100).then(() => "waiting" as const),
      ]);
      expect(early).toBe("waiting");

      await first.unsafe("COMMIT");
      firstBegan = false;
      await Promise.race([
        secondLock,
        Bun.sleep(2_000).then(() => {
          throw new Error("opposite-order financial lock did not converge");
        }),
      ]);
      await second.unsafe("COMMIT");
      secondBegan = false;
    } finally {
      if (firstBegan) await first.unsafe("ROLLBACK").catch(() => undefined);
      if (secondBegan) await second.unsafe("ROLLBACK").catch(() => undefined);
      first.release();
      second.release();
    }
  }, 10_000);
});
