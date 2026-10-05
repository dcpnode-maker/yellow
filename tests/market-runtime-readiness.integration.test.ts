/** Q266: exact retained Q265 target only; every hostile variation rolls back. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL, type ReservedSQL } from "bun";
import { readMarketCompsetIntegrationEnvironment } from "./helpers/market-compset-environment";
import { assertMarketWorkbenchReadiness } from "../src/runtime/market-workbench";

const enabled = process.env.YELLOW_REQUIRE_MARKET_COMPSET_INTEGRATION === "1";
const environment = enabled ? readMarketCompsetIntegrationEnvironment() : null;
const databaseDescribe = enabled ? describe.serial : describe.skip;
const TARGET = environment === null ? "" : environment.database;
const SIGNATURE = "public.assert_market_compset_authority(uuid,uuid,uuid,text)";
let deploy: SQL;
let runtime: SQL;
const traceEnabled = enabled && process.env.YELLOW_ORDER472_MARKET_READINESS_TRACE === "1";
let variationNumber = 0;
function trace(stage: string): void {
  // Diagnostic stages only: never emit SQL, errors, connection details or rows.
  if (traceEnabled) console.info(`[Q266 readiness ${variationNumber}] ${stage}`);
}

async function fingerprint(): Promise<string> {
  const rows = await deploy<Array<{ state: string }>>`
    SELECT jsonb_build_object(
      'function',(SELECT jsonb_build_object('definition',pg_get_functiondef(oid),'owner',proowner,'acl',proacl,'config',proconfig)
        FROM pg_proc WHERE oid=to_regprocedure(${SIGNATURE})),
      'schema',(SELECT json_schema FROM extension_type WHERE type='market_compset'),
      'permissions',(SELECT jsonb_agg(to_jsonb(permission) ORDER BY code) FROM permission WHERE code IN ('distribution.market:read','distribution.market:write')),
      'ledger',(SELECT jsonb_agg(to_jsonb(schema_migration) ORDER BY version) FROM schema_migration)
    )::text AS state
  `;
  if (rows.length !== 1 || !rows[0]) throw new Error("Q266 target snapshot is unavailable");
  return rows[0].state;
}
async function ready(): Promise<void> {
  await runtime.begin("read only", async tx => {
    await tx.unsafe("SET LOCAL ROLE app_role");
    await assertMarketWorkbenchReadiness(tx);
  });
}
async function rolledBackVariation(change: (tx: SQL | ReservedSQL) => Promise<void>): Promise<void> {
  variationNumber += 1;
  trace("fingerprint-before:start");
  const before = await fingerprint();
  trace("fingerprint-before:done");
  const rollback = new Error("Q266 deliberate rollback marker");
  try {
    trace("transaction:start");
    await deploy.begin(async tx => {
      trace("transaction:entered");
      const identity = await tx<Array<{ database: string; role: string }>>`SELECT current_database() AS database,current_user AS role`;
      trace("identity:done");
      expect(identity).toEqual([{ database: TARGET, role: "yellow_deploy" }]);
      await tx.unsafe("SET LOCAL statement_timeout = '5000ms'");
      trace("statement-timeout:done");
      await tx.unsafe("SET LOCAL lock_timeout = '1500ms'");
      trace("lock-timeout:done");
      // This is the exact catalog probe, not an impersonated runtime session.
      // Positive deployed runtime behavior is verified separately by ready().
      trace("mutation:start");
      await change(tx);
      trace("mutation:done");
      trace("probe:start");
      let failure: unknown;
      // Await SQL directly: Bun 1.3.14's asynchronous matcher stalls client
      // settlement inside this reserved transaction, even after SELECT finishes.
      try {
        await assertMarketWorkbenchReadiness(tx);
        trace("probe:fulfilled");
      } catch (error) {
        failure = error;
        trace("probe:rejected");
      }
      expect(failure).toBeInstanceOf(Error);
      expect(failure instanceof Error ? failure.message : undefined).toBe("Market workbench readiness is unavailable");
      trace("probe-assertion:done");
      trace("rollback:throw");
      throw rollback;
    });
  } catch (error) {
    trace(error === rollback ? "transaction:marker-rejected" : "transaction:unexpected-rejected");
    if (error !== rollback) throw error;
  }
  trace("fingerprint-after:start");
  expect(await fingerprint()).toBe(before);
  trace("fingerprint-after:done");
  trace("runtime-recheck:start");
  await ready();
  trace("runtime-recheck:done");
}

databaseDescribe("Order472 Q266 isolated market readiness", () => {
  beforeAll(async () => {
    deploy = new SQL(environment!.deployDatabaseUrl, { max: 1, prepare: false });
    runtime = new SQL(environment!.runtimeDatabaseUrl, { max: 1, prepare: false });
    const rows = await deploy<Array<{ database: string; role: string; frontier: number; migrations: number }>>`
      SELECT current_database() AS database,current_user AS role,(SELECT max(version)::int FROM schema_migration) AS frontier,
        (SELECT count(*)::int FROM schema_migration) AS migrations
    `;
    expect(rows).toEqual([{ database: TARGET, role: "yellow_deploy", frontier: 92, migrations: 92 }]);
    const identities = await runtime<Array<{ role: string; superuser: boolean; bypass: boolean }>>`
      SELECT current_user AS role,rolsuper AS superuser,rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user
    `;
    expect(identities).toEqual([{ role: "yellow_runtime", superuser: false, bypass: false }]);
    await ready();
  });
  afterAll(async () => {
    if (runtime) await runtime.close();
    if (deploy) await deploy.close();
  });
  test("exact capability/schema/permissions pass as the real runtime without state change", async () => {
    const before = await fingerprint(); await ready(); expect(await fingerprint()).toBe(before);
  });
  test("owner, search path, definer and body drift are rejected and rolled back", async () => {
    for (const statement of [
      `ALTER FUNCTION ${SIGNATURE} OWNER TO yellow_deploy`,
      `ALTER FUNCTION ${SIGNATURE} SET search_path TO public`,
      `ALTER FUNCTION ${SIGNATURE} SECURITY INVOKER`,
      `CREATE OR REPLACE FUNCTION public.assert_market_compset_authority(p_tenant uuid,p_property uuid,p_actor uuid,p_permission text)
        RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $hostile$ BEGIN RETURN true; END; $hostile$`,
    ]) await rolledBackVariation(async tx => { await tx.unsafe(statement); });
  }, 20_000);
  test("PUBLIC/runtime/grant-option leakage and missing app EXECUTE fail closed", async () => {
    for (const statement of [
      `GRANT EXECUTE ON FUNCTION ${SIGNATURE} TO PUBLIC`,
      `GRANT EXECUTE ON FUNCTION ${SIGNATURE} TO yellow_runtime`,
      `GRANT EXECUTE ON FUNCTION ${SIGNATURE} TO app_role WITH GRANT OPTION`,
      `REVOKE EXECUTE ON FUNCTION ${SIGNATURE} FROM app_role`,
    ]) await rolledBackVariation(async tx => { await tx.unsafe(statement); });
  }, 20_000);
  test("missing function, changed canonical schema and changed permission catalogue fail closed", async () => {
    await rolledBackVariation(async tx => {
      await tx.unsafe(`ALTER FUNCTION ${SIGNATURE} RENAME TO order472_q266_unavailable_authority`);
    });
    await rolledBackVariation(async tx => {
      await tx`UPDATE extension_type SET json_schema='{}'::jsonb WHERE type='market_compset'`;
    });
    await rolledBackVariation(async tx => {
      await tx`UPDATE permission SET description='Q266 synthetic changed description' WHERE code='distribution.market:write'`;
    });
  }, 20_000);
});
