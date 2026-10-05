import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
  NonFiscalFolioSeriesConfigurationService,
} from "../src/contexts/financials";
import {
  Database,
  IdempotencyConflictError,
  PostgresIdempotency,
  createAuditEnvelope,
  type Tx,
} from "../src/kernel";

const DEPLOY_URL = process.env.YELLOW_ORDER562_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER562_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER562_DATABASE === "1";
if (required && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Order562 requires deploy and runtime database URLs");
}

const dbDescribe = required ? describe.serial : describe.skip;
const TENANT = "56200000-0000-4000-8000-000000000001";
const PROPERTY = "56200000-0000-4000-8000-000000000002";
const OTHER_PROPERTY = "56200000-0000-4000-8000-000000000003";
const ACTOR = "56200000-0000-4000-8000-000000000004";
const ROLE = "56200000-0000-4000-8000-000000000005";
const PERMISSION = "financials.folio-series:configure";

let deploy: SQL | undefined;
let database: Database | undefined;
let service: NonFiscalFolioSeriesConfigurationService | undefined;

function sqlState(error: unknown): string {
  return String((error as { errno?: string; code?: string }).errno ??
    (error as { code?: string }).code ?? "");
}

function request(key: string, prefix = "O562-") {
  return Object.freeze({
    tenantId: TENANT,
    propertyNode: PROPERTY,
    prefix,
    idempotencyKey: key,
    envelope: createAuditEnvelope({
      actorId: ACTOR,
      tenantId: TENANT,
      propertyNode: PROPERTY,
      requestId: crypto.randomUUID(),
      operation: "folio.series.configured",
    }),
  });
}

async function configure(key: string, prefix = "O562-") {
  return database!.withTenantTransaction(TENANT, (tx) => service!.configure(tx, request(key, prefix)));
}

async function rows() {
  const [result] = await deploy!<{ series: string; facts: string; events: string; idempotency: string }[]>`
    SELECT
      COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id)::text FROM document_series s
        WHERE s.tenant_id=${TENANT}::uuid),'[]') series,
      COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id)::text FROM fact_log f
        WHERE f.tenant_id=${TENANT}::uuid AND f.entity_type='document_series'),'[]') facts,
      COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.seq)::text FROM outbox o
        WHERE o.tenant_id=${TENANT}::uuid AND o.aggregate_type='document_series'),'[]') events,
      COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.operation,i.key_hash)::text FROM api_idempotency i
        WHERE i.tenant_id=${TENANT}::uuid AND i.operation='financials.folio-series.configure'),'[]') idempotency
  `;
  return result!;
}

async function clean() {
  if (!deploy) return;
  for (const table of ["api_idempotency", "outbox", "fact_log", "document_series"]) {
    await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id=$1::uuid`, [TENANT]);
  }
  await deploy`DELETE FROM user_role WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid`;
  await deploy`DELETE FROM role WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM app_user WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM org_node WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM tenant WHERE id=${TENANT}::uuid`;
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 8, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 24, prepare: false });
  service = new NonFiscalFolioSeriesConfigurationService(new PostgresIdempotency());
  await clean();
  await deploy`INSERT INTO tenant(id,slug,name,tier,status)
    VALUES(${TENANT}::uuid,'order562','Order562','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order562.main','property','Order562 main','Asia/Kolkata','INR'),
    (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order562.other','property','Order562 other','UTC','INR')`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status)
    VALUES(${ACTOR}::uuid,${TENANT}::uuid,'actor@order562.test','Order562 actor','active')`;
  await deploy`INSERT INTO role(id,tenant_id,name) VALUES(${ROLE}::uuid,${TENANT}::uuid,'Order562 configurator')`;
  await deploy`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${PERMISSION})`;
  await deploy`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
    VALUES(${TENANT}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${PROPERTY}::uuid)`;
}, 60_000);

afterAll(async () => {
  await clean();
  await database?.close();
  await deploy?.close();
}, 60_000);

dbDescribe("Order562 governed non-fiscal folio-series configuration", () => {
  test("capability ownership, ACL and raw runtime DML remain exact", async () => {
    const functions = await deploy!<{ signature: string; owner: string; security_definer: boolean; config: string[] }[]>`
      SELECT oid::regprocedure::text signature,pg_get_userbyid(proowner) owner,
        prosecdef security_definer,proconfig config
      FROM pg_proc WHERE oid IN (
        'public.assert_non_fiscal_folio_series_configuration_authority(uuid,uuid,uuid)'::regprocedure,
        'public.configure_non_fiscal_folio_series(uuid,uuid,text,uuid,uuid)'::regprocedure
      ) ORDER BY signature`;
    expect(functions).toEqual([
      { signature: "assert_non_fiscal_folio_series_configuration_authority(uuid,uuid,uuid)",
        owner: "yellow_owner", security_definer: true,
        config: ["search_path=pg_catalog, public, pg_temp"] },
      { signature: "configure_non_fiscal_folio_series(uuid,uuid,text,uuid,uuid)",
        owner: "yellow_owner", security_definer: true,
        config: ["search_path=pg_catalog, public, pg_temp"] },
    ]);
    const acl = await deploy!<{ grantee: string; privilege: string }[]>`
      SELECT COALESCE(r.rolname,'PUBLIC') grantee,a.privilege_type privilege
      FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
      LEFT JOIN pg_roles r ON r.oid=a.grantee
      WHERE p.oid IN (
        'public.assert_non_fiscal_folio_series_configuration_authority(uuid,uuid,uuid)'::regprocedure,
        'public.configure_non_fiscal_folio_series(uuid,uuid,text,uuid,uuid)'::regprocedure
      ) ORDER BY p.oid::regprocedure::text,grantee,privilege`;
    expect(acl).toEqual([
      { grantee: "app_role", privilege: "EXECUTE" },
      { grantee: "yellow_owner", privilege: "EXECUTE" },
      { grantee: "app_role", privilege: "EXECUTE" },
      { grantee: "yellow_owner", privilege: "EXECUTE" },
    ]);
    for (const statement of [
      `INSERT INTO document_series(tenant_id,property_node,kind,prefix,next_no,fiscal) VALUES('${TENANT}','${PROPERTY}','folio','RAW-',1,false)`,
      `UPDATE document_series SET next_no=99 WHERE tenant_id='${TENANT}'`,
      `DELETE FROM document_series WHERE tenant_id='${TENANT}'`,
    ]) {
      let state = "";
      try {
        await database!.withTenantTransaction(TENANT, tx => tx.unsafe(statement));
      } catch (error) { state = sqlState(error); }
      expect(state).toBe("42501");
    }
    let deployState = "";
    try {
      await deploy!`SELECT * FROM configure_non_fiscal_folio_series(
        ${TENANT}::uuid,${PROPERTY}::uuid,'BAD-',${ACTOR}::uuid,${crypto.randomUUID()}::uuid)`;
    } catch (error) { deployState = sqlState(error); }
    expect(deployState).toBe("42501");
  });

  test("create, same-key replay and new-key current read preserve exact evidence and counter", async () => {
    const before = await rows();
    const createInput = request("order562-create-key");
    const first = await database!.withTenantTransaction(TENANT,
      (tx) => service!.configure(tx, createInput));
    expect(first).toMatchObject({ tenantId: TENANT, propertyNode: PROPERTY, kind: "folio",
      prefix: "O562-", fiscal: false, nextNo: "1", created: true, replayed: false, status: 201 });
    const replay = await configure("order562-create-key");
    expect(replay).toEqual({ ...first, replayed: true });
    const current = await configure("order562-new-key-current");
    expect(current).toEqual({ ...first, created: false, replayed: false, status: 200 });
    const after = await rows();
    expect(JSON.parse(after.series)).toHaveLength(JSON.parse(before.series).length + 1);
    expect(JSON.parse(after.facts)).toHaveLength(JSON.parse(before.facts).length + 1);
    expect(JSON.parse(after.events)).toHaveLength(JSON.parse(before.events).length + 1);
    expect(JSON.parse(after.idempotency)).toHaveLength(JSON.parse(before.idempotency).length + 2);
    const [fact] = await deploy!<{ payload: Record<string, unknown>; actor_id: string;
      business_date: string; fact_type: string }[]>`SELECT payload,actor_id::text,
        business_date::text,fact_type FROM fact_log
      WHERE tenant_id=${TENANT}::uuid AND entity_type='document_series' AND entity_id=${first.seriesId}::uuid`;
    const [event] = await deploy!<{ payload: Record<string, unknown>; event_type: string;
      event_version: number; actor_id: string; correlation_id: string; business_date: string }[]>`
      SELECT payload,event_type,event_version,actor_id::text,correlation_id::text,business_date::text FROM outbox
      WHERE tenant_id=${TENANT}::uuid AND aggregate_type='document_series' AND aggregate_id=${first.seriesId}::uuid`;
    const [expectedDate] = await deploy!<{ business_date: string }[]>`
      SELECT (transaction_timestamp() AT TIME ZONE 'Asia/Kolkata')::date::text business_date`;
    const payload = { seriesId: first.seriesId, propertyNode: PROPERTY, kind: "folio", prefix: "O562-", fiscal: false };
    expect(fact).toEqual({ payload, actor_id: ACTOR, business_date: expectedDate!.business_date,
      fact_type: "configured" });
    expect(event).toEqual({ payload, event_type: "folio.series.configured", event_version: 1,
      actor_id: ACTOR, correlation_id: createInput.envelope.requestId,
      business_date: expectedDate!.business_date });

    const allocated = await database!.withTenantTransaction(TENANT, async (tx: Tx) =>
      tx<{ folio_reference: string }[]>`SELECT folio_reference FROM allocate_non_fiscal_folio_reference(
        ${TENANT}::uuid,${PROPERTY}::uuid)`);
    expect(allocated).toEqual([{ folio_reference: "O562-1" }]);
    const afterUse = await configure("order562-used-series-key");
    expect(afterUse).toMatchObject({ seriesId: first.seriesId, nextNo: "2", created: false, status: 200 });
  });

  test("authority, prefix conflict, malformed and rollback paths fail without partial state", async () => {
    const baseline = await rows();
    await expect(configure("order562-prefix-conflict", "OTHER-")).rejects.toMatchObject({ errno: "23505" });
    expect(await rows()).toEqual(baseline);
    await expect(configure("order562-create-key", "OTHER-")).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(await rows()).toEqual(baseline);
    await deploy!`UPDATE app_user SET status='inactive' WHERE tenant_id=${TENANT}::uuid AND id=${ACTOR}::uuid`;
    try {
      await expect(configure("order562-create-key")).rejects.toMatchObject({ errno: "42501" });
    } finally {
      await deploy!`UPDATE app_user SET status='active' WHERE tenant_id=${TENANT}::uuid AND id=${ACTOR}::uuid`;
    }
    expect(await rows()).toEqual(baseline);
    await expect(database!.withTenantTransaction(TENANT, async tx => {
      await service!.configure(tx, request("order562-rollback-key"));
      throw new Error("Order562 injected rollback");
    })).rejects.toThrow("Order562 injected rollback");
    expect(await rows()).toEqual(baseline);
  });

  test("rejects fiscal-shaped and mixed folio roots without configuration evidence", async () => {
    await deploy!`DELETE FROM api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation='financials.folio-series.configure'`;
    await deploy!`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_type='document_series'`;
    await deploy!`DELETE FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type='document_series'`;
    await deploy!`DELETE FROM document_series WHERE tenant_id=${TENANT}::uuid`;
    await deploy!`INSERT INTO document_series(
      tenant_id,property_node,kind,prefix,next_no,fiscal,
      supplier_registration_id,financial_year_start,last_doc_hash
    ) VALUES(${TENANT}::uuid,${PROPERTY}::uuid,'folio','HOSTILE-',1,true,NULL,NULL,NULL)`;
    const fiscalOnly = await rows();
    await expect(configure("order562-fiscal-only")).rejects.toMatchObject({ errno: "55000" });
    expect(await rows()).toEqual(fiscalOnly);

    await deploy!`INSERT INTO document_series(
      tenant_id,property_node,kind,prefix,next_no,fiscal,
      supplier_registration_id,financial_year_start,last_doc_hash
    ) VALUES(${TENANT}::uuid,${PROPERTY}::uuid,'folio','O562-',1,false,NULL,NULL,NULL)`;
    const mixed = await rows();
    await expect(configure("order562-mixed-roots")).rejects.toMatchObject({ errno: "55000" });
    expect(await rows()).toEqual(mixed);
  });

  test("rolls back a first-write outbox failure and permits one clean same-key retry", async () => {
    await deploy!`DELETE FROM api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation='financials.folio-series.configure'`;
    await deploy!`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_type='document_series'`;
    await deploy!`DELETE FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type='document_series'`;
    await deploy!`DELETE FROM document_series WHERE tenant_id=${TENANT}::uuid`;
    const before = await rows();
    await deploy!.unsafe(`CREATE OR REPLACE FUNCTION public.order562_fail_folio_event()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type='folio.series.configured' THEN
          RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Order562 injected outbox failure';
        END IF;
        RETURN NEW;
      END $$`);
    await deploy!.unsafe(`CREATE TRIGGER order562_fail_folio_event
      BEFORE INSERT ON public.outbox FOR EACH ROW EXECUTE FUNCTION public.order562_fail_folio_event()`);
    try {
      await expect(configure("order562-first-write-failure")).rejects.toMatchObject({ errno: "P0001" });
      expect(await rows()).toEqual(before);
    } finally {
      await deploy!.unsafe("DROP TRIGGER IF EXISTS order562_fail_folio_event ON public.outbox");
      await deploy!.unsafe("DROP FUNCTION IF EXISTS public.order562_fail_folio_event()") ;
    }
    const retry = await configure("order562-first-write-failure");
    expect(retry).toMatchObject({ created: true, replayed: false, status: 201, nextNo: "1" });
    const after = await rows();
    expect(JSON.parse(after.series)).toHaveLength(1);
    expect(JSON.parse(after.facts)).toHaveLength(1);
    expect(JSON.parse(after.events)).toHaveLength(1);
    expect(JSON.parse(after.idempotency)).toHaveLength(1);
  });

  test("concurrent different prefixes select one root and reject the competing prefix", async () => {
    await deploy!`DELETE FROM api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation='financials.folio-series.configure'`;
    await deploy!`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_type='document_series'`;
    await deploy!`DELETE FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type='document_series'`;
    await deploy!`DELETE FROM document_series WHERE tenant_id=${TENANT}::uuid`;
    const settled = await Promise.allSettled(Array.from({ length: 20 }, (_, index) =>
      configure(`order562-prefix-race-${String(index).padStart(2, "0")}`, index % 2 === 0 ? "RACE-A-" : "RACE-B-")));
    const fulfilled = settled.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof configure>>> =>
      result.status === "fulfilled");
    const rejected = settled.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(fulfilled.length).toBeGreaterThan(0);
    expect(new Set(fulfilled.map((result) => result.value.prefix)).size).toBe(1);
    expect(fulfilled.filter((result) => result.value.created)).toHaveLength(1);
    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected.every((result) => sqlState(result.reason) === "23505")).toBe(true);
    const state = await rows();
    expect(JSON.parse(state.series)).toHaveLength(1);
    expect(JSON.parse(state.facts)).toHaveLength(1);
    expect(JSON.parse(state.events)).toHaveLength(1);
    expect(JSON.parse(state.idempotency)).toHaveLength(fulfilled.length);
  }, 60_000);

  test("concurrent exact requests converge while current authority remains mandatory", async () => {
    await deploy!`DELETE FROM api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation='financials.folio-series.configure'`;
    await deploy!`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_type='document_series'`;
    await deploy!`DELETE FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type='document_series'`;
    await deploy!`DELETE FROM document_series WHERE tenant_id=${TENANT}::uuid`;
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      configure(`order562-concurrent-${String(index).padStart(2, "0")}`)));
    expect(results.filter(result => result.created)).toHaveLength(1);
    expect(new Set(results.map(result => result.seriesId)).size).toBe(1);
    const state = await rows();
    expect(JSON.parse(state.series)).toHaveLength(1);
    expect(JSON.parse(state.facts)).toHaveLength(1);
    expect(JSON.parse(state.events)).toHaveLength(1);
    expect(JSON.parse(state.idempotency)).toHaveLength(20);

    await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid AND permission_code=${PERMISSION}`;
    try {
      const before = await rows();
      await expect(configure("order562-concurrent-00")).rejects.toMatchObject({ errno: "42501" });
      expect(await rows()).toEqual(before);
    } finally {
      await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${PERMISSION})`;
    }
  }, 60_000);
});
