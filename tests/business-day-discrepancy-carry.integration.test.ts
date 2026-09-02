import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
  BusinessDayDiscrepancyCarryService,
} from "../src/contexts/financials";
import { Database, PostgresEventBus, PostgresIdempotency, type EventBus, type IdempotencyCommandResult, type IdempotencyInput, type IdempotencyResult, type JsonValue, type Tx } from "../src/kernel";

const DEPLOY = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_ORDER359 === "1";
if (REQUIRED && (!DEPLOY || !RUNTIME)) throw new Error("Order 359 requires deploy and runtime PostgreSQL URLs");
const databaseDescribe = DEPLOY && RUNTIME ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000035901";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000035902";
const PROPERTY = "00000000-0000-0000-0000-000000035911";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000035912";
const REQUESTER = "00000000-0000-0000-0000-000000035921";
const APPROVER = "00000000-0000-0000-0000-000000035922";
const UNAUTHORIZED = "00000000-0000-0000-0000-000000035923";
const INACTIVE = "00000000-0000-0000-0000-000000035924";
const ROLE_REQUEST = "00000000-0000-0000-0000-000000035931";
const ROLE_APPROVE = "00000000-0000-0000-0000-000000035932";
const SPACE = "00000000-0000-0000-0000-000000035941";
const DISCREPANCY = "00000000-0000-0000-0000-000000035951";
const FOREIGN_DISCREPANCY = "00000000-0000-0000-0000-000000035952";

let deploy: SQL | undefined;
let runtime: SQL | undefined;
let runtimePool: SQL | undefined;
let database: Database | undefined;
let service: BusinessDayDiscrepancyCarryService | undefined;
let targetDate = "";
let sourceDate = "";

function normalizeDates(value: unknown): JsonValue {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeDates(item)]));
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  throw new Error("unexpected non-JSON proof value");
}

class Order359Idempotency extends PostgresIdempotency {
  override execute<T extends JsonValue>(tx: Tx, input: IdempotencyInput, command: (tx: Tx) => Promise<IdempotencyCommandResult<T>>): Promise<IdempotencyResult<T>> {
    return super.execute(tx, input, async (q) => {
      const result = await command(q);
      return { ...result, body: normalizeDates(result.body) as T };
    });
  }
}

async function rejected(operation: () => Promise<unknown>): Promise<void> {
  await expect(operation()).rejects.toThrow();
}

async function counts() {
  const rows = await deploy!<Array<{ carries: number; discrepancies: number; facts: number; events: number; keys: number }>>`
    SELECT
      (SELECT count(*)::int FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid) carries,
      (SELECT count(*)::int FROM discrepancy WHERE tenant_id=${TENANT}::uuid) discrepancies,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type='business_day_discrepancy_carry') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND event_type='discrepancy.carried') events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation='financials.business-day.discrepancy-carry.consume') keys`;
  return rows[0]!;
}

async function resetCase(): Promise<void> {
  await deploy!.begin(async (tx) => {
    await tx`UPDATE org_node SET timezone='UTC' WHERE id=${PROPERTY}::uuid`;
    await tx`UPDATE app_user SET status='active' WHERE tenant_id=${TENANT}::uuid AND id IN (${REQUESTER}::uuid,${APPROVER}::uuid,${UNAUTHORIZED}::uuid,${INACTIVE}::uuid)`;
    await tx`DELETE FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid`;
    await tx`DELETE FROM fact_log WHERE tenant_id=${TENANT}::uuid`;
    await tx`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid`;
    await tx`DELETE FROM api_idempotency WHERE tenant_id=${TENANT}::uuid`;
    await tx`DELETE FROM approval_request WHERE tenant_id=${TENANT}::uuid`;
    await tx`DELETE FROM discrepancy WHERE tenant_id=${TENANT}::uuid`;
    await tx`DELETE FROM business_day WHERE tenant_id=${TENANT}::uuid`;
    await tx`INSERT INTO business_day(tenant_id,property_node,business_date)
      VALUES(${TENANT}::uuid,${PROPERTY}::uuid,${sourceDate}::date),
            (${TENANT}::uuid,${PROPERTY}::uuid,${targetDate}::date)`;
    await tx`INSERT INTO discrepancy(id,tenant_id,space_id,reported,system_state,reported_by)
      VALUES(${DISCREPANCY}::uuid,${TENANT}::uuid,${SPACE}::uuid,'occupied','vacant',${REQUESTER}::uuid)`;
    await tx`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
      actor_id,correlation_id,payload)
      VALUES(${TENANT}::uuid,${PROPERTY}::uuid,${sourceDate}::date,'discrepancy',${DISCREPANCY}::uuid,
        'discrepancy.reported',${REQUESTER}::uuid,gen_random_uuid(),'{}'::jsonb)`;
  });
}

async function requestApproval(): Promise<{ approvalId: string; requestHash: string }> {
  const result = await database!.withTenantTransaction(TENANT, (tx) => service!.requestApproval(tx, {
    tenantId: TENANT, propertyNode: PROPERTY, discrepancyId: DISCREPANCY,
    sourceBusinessDate: sourceDate, targetBusinessDate: targetDate,
    reason: "Order 359 hostile proof", idempotencyKey: `order359-request-${crypto.randomUUID()}`,
    envelope: { tenantId: TENANT, propertyNode: PROPERTY, actorId: REQUESTER,
      requestId: crypto.randomUUID(), operation: "approval.requested" },
  }));
  return { approvalId: result.approvalId, requestHash: result.requestHash };
}

async function decide(approvalId: string, options: { status?: string; decider?: string; offset?: string } = {}) {
  await deploy!`UPDATE approval_request
    SET status=${options.status ?? "approved"}, decided_by=${options.decider ?? APPROVER}::uuid,
        decided_at=transaction_timestamp()+${options.offset ?? "0 seconds"}::interval
    WHERE tenant_id=${TENANT}::uuid AND id=${approvalId}::uuid`;
}

async function carry(approvalId: string, requestHash: string, key = `order359-carry-${crypto.randomUUID()}`) {
  return database!.withTenantTransaction(TENANT, (tx) => service!.carry(tx, {
    tenantId: TENANT, approvalId, expectedRequestHash: requestHash, idempotencyKey: key,
    envelope: { tenantId: TENANT, propertyNode: PROPERTY, actorId: REQUESTER, requestId: crypto.randomUUID(), operation: "discrepancy.carried" },
  }));
}

databaseDescribe("Order 359 fresh PostgreSQL hostile discrepancy-carry proof", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY!, { max: 6, prepare: false });
    runtime = new SQL(RUNTIME!, { max: 6, prepare: false });
    runtimePool = new SQL(RUNTIME!, { max: 8, prepare: false });
    database = Database.connect(RUNTIME!, { maxConnections: 8, prepare: false });
    const canonicalEvents = new PostgresEventBus(runtimePool);
    const normalizingEvents: EventBus = {
      publish: (tx, event) => {
        const value = (event as unknown as { businessDate: unknown }).businessDate;
        const businessDate = typeof value === "string" ? value : value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
        return canonicalEvents.publish(tx, { ...event, businessDate });
      },
      consumeBatch: (...args) => canonicalEvents.consumeBatch(...args),
    };
    service = new BusinessDayDiscrepancyCarryService({ events: normalizingEvents, idempotency: new Order359Idempotency() });
    targetDate = (await deploy<Array<{ d: string }>>`SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text d`)[0]!.d;
    sourceDate = (await deploy<Array<{ d: string }>>`SELECT (${targetDate}::date - 1)::text d`)[0]!.d;
    await deploy!`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT}::uuid,'order359','Order 359','shared','active'),
      (${FOREIGN_TENANT}::uuid,'order359-foreign','Order 359 foreign','shared','active')`;
    await deploy!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY}::uuid,${TENANT}::uuid,'order359','property','Order 359','UTC','USD'),
      (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order359f','property','Order 359 foreign','UTC','USD')`;
    await deploy!`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${REQUESTER}::uuid,${TENANT}::uuid,'requester@order359.test','Order 359 requester','active'),
      (${APPROVER}::uuid,${TENANT}::uuid,'approver@order359.test','Order 359 approver','active'),
      (${UNAUTHORIZED}::uuid,${TENANT}::uuid,'unauthorized@order359.test','Order 359 unauthorized','active'),
      (${INACTIVE}::uuid,${TENANT}::uuid,'inactive@order359.test','Order 359 inactive','inactive')`;
    await deploy!`INSERT INTO permission(code,description) VALUES
      ('financials.business-day:carry-discrepancy','Order 359 carry'),
      ('financials.business-day:approve-discrepancy-carry','Order 359 approve') ON CONFLICT DO NOTHING`;
    await deploy!`INSERT INTO role(id,tenant_id,name) VALUES
      (${ROLE_REQUEST}::uuid,${TENANT}::uuid,'Order 359 requester'),
      (${ROLE_APPROVE}::uuid,${TENANT}::uuid,'Order 359 approver')`;
    await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES
      (${ROLE_REQUEST}::uuid,'financials.business-day:carry-discrepancy'),
      (${ROLE_APPROVE}::uuid,'financials.business-day:approve-discrepancy-carry')`;
    await deploy!`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES
      (${TENANT}::uuid,${REQUESTER}::uuid,${ROLE_REQUEST}::uuid,${PROPERTY}::uuid),
      (${TENANT}::uuid,${APPROVER}::uuid,${ROLE_APPROVE}::uuid,${PROPERTY}::uuid)`;
    await deploy!`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status)
      VALUES(${SPACE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'ORDER359','hotel',1,'active')`;
    await resetCase();
  }, 40_000);

  beforeEach(async () => { await resetCase(); });

  afterAll(async () => {
    if (!deploy) return;
    await deploy`DELETE FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM fact_log WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM outbox WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await deploy`DELETE FROM api_idempotency WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM approval_request WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM discrepancy WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await deploy`DELETE FROM business_day WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await deploy`DELETE FROM space WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM user_role WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM role_permission WHERE role_id IN (${ROLE_REQUEST}::uuid,${ROLE_APPROVE}::uuid)`;
    await deploy`DELETE FROM role WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM app_user WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM org_node WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await deploy`DELETE FROM tenant WHERE id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await database?.close(); await runtimePool?.close({ timeout: 0 }); await runtime?.close({ timeout: 0 }); await deploy?.close({ timeout: 0 });
  });

  test("rejects a future decision and accepts past and transaction-time decisions", async () => {
    const future = await requestApproval();
    await decide(future.approvalId, { offset: "20 minutes" });
    await rejected(() => carry(future.approvalId, future.requestHash));
    expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });

    await resetCase();
    const past = await requestApproval(); await decide(past.approvalId, { offset: "-1 second" });
    expect((await carry(past.approvalId, past.requestHash)).replayed).toBe(false);
    await resetCase();
    const now = await requestApproval(); await decide(now.approvalId, { offset: "0 seconds" });
    expect((await carry(now.approvalId, now.requestHash)).replayed).toBe(false);
  });

  test("rejects exact expiry, later, pending, rejected, self and unauthorized decisions", async () => {
    const cases = [
      { status: "approved", offset: "-29 minutes", created: "-30 minutes" },
      { status: "approved", offset: "-31 minutes", created: "-31 minutes" },
      { status: "pending", decider: APPROVER },
      { status: "rejected", offset: "0 seconds" },
      { status: "approved", decider: REQUESTER },
      { status: "approved", decider: UNAUTHORIZED },
    ];
    for (const item of cases) {
      await resetCase(); const approval = await requestApproval();
      if (item.created) await deploy!`UPDATE approval_request SET created_at=transaction_timestamp()+${item.created}::interval WHERE id=${approval.approvalId}::uuid`;
      if (item.status !== "pending") await decide(approval.approvalId, item);
      await rejected(() => carry(approval.approvalId, approval.requestHash));
      expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });
    }
  });

  test("fails closed for payload, source, lineage and target staleness", async () => {
    const approval = await requestApproval(); await decide(approval.approvalId);
    await deploy!`UPDATE approval_request SET payload=jsonb_set(payload,'{requestHash}',${JSON.stringify("0".repeat(64))}::jsonb) WHERE id=${approval.approvalId}::uuid`;
    await rejected(() => carry(approval.approvalId, approval.requestHash));
    await resetCase();
    const source = await requestApproval(); await decide(source.approvalId); await deploy!`UPDATE discrepancy SET reported='vacant' WHERE id=${DISCREPANCY}::uuid`;
    await rejected(() => carry(source.approvalId, source.requestHash));
    await resetCase();
    const lineage = await requestApproval(); await decide(lineage.approvalId); await deploy!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload) VALUES(${TENANT}::uuid,${PROPERTY}::uuid,${sourceDate}::date,'discrepancy',${DISCREPANCY}::uuid,'discrepancy.reported',${REQUESTER}::uuid,gen_random_uuid(),'{}')`;
    await rejected(() => carry(lineage.approvalId, lineage.requestHash));
    await resetCase();
    const target = await requestApproval(); await decide(target.approvalId); await deploy!`UPDATE business_day SET opened_at=opened_at+interval '1 second' WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid AND business_date=${targetDate}::date`;
    await rejected(() => carry(target.approvalId, target.requestHash));
    expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });
  });

  test("rejects inactive actors, sealed days and changed property-time authority", async () => {
    const inactive = await requestApproval(); await decide(inactive.approvalId); await deploy!`UPDATE app_user SET status='inactive' WHERE id=${REQUESTER}::uuid`;
    await rejected(() => carry(inactive.approvalId, inactive.requestHash));
    expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });
    await resetCase();
    const sealedTarget = await requestApproval(); await decide(sealedTarget.approvalId); await deploy!`UPDATE business_day SET sealed_at=transaction_timestamp(),sealed_by=${APPROVER}::uuid WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid AND business_date=${targetDate}::date`;
    await rejected(() => carry(sealedTarget.approvalId, sealedTarget.requestHash));
    expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });
    await resetCase();
    const sealedSource = await requestApproval(); await decide(sealedSource.approvalId); await deploy!`UPDATE business_day SET sealed_at=transaction_timestamp(),sealed_by=${APPROVER}::uuid WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid AND business_date=${sourceDate}::date`;
    await rejected(() => carry(sealedSource.approvalId, sealedSource.requestHash));
    expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });
    await resetCase();
    const timezone = await requestApproval(); await decide(timezone.approvalId); await deploy!`UPDATE org_node SET timezone='Invalid/Order359' WHERE id=${PROPERTY}::uuid`;
    await rejected(() => carry(timezone.approvalId, timezone.requestHash));
    expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });
  });

  test("success is atomic, immutable, one-use and financially isolated", async () => {
    const before = await deploy!<{ j: number; p: number; pay: number; doc: number }[]>`SELECT
      (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT}::uuid) j,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${TENANT}::uuid) p,
      (SELECT count(*)::int FROM payment WHERE tenant_id=${TENANT}::uuid) pay,
      (SELECT count(*)::int FROM document WHERE tenant_id=${TENANT}::uuid) doc`;
    const approval = await requestApproval(); await decide(approval.approvalId);
    const beforeDays = await deploy!<Array<{ business_date: string; opened_at: string; sealed_at: string | null }>>`SELECT business_date::text,opened_at::text,sealed_at::text FROM business_day WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid ORDER BY business_date`;
    const result = await carry(approval.approvalId, approval.requestHash, "order359-replay-key");
    expect(result).toMatchObject({ sourceDiscrepancyId: DISCREPANCY, targetBusinessDate: `${targetDate}T00:00:00.000Z`, resolution: "carried_forward", replayed: false });
    const replay = await database!.withTenantTransaction(TENANT, (tx) => service!.carry(tx, {
      tenantId: TENANT, approvalId: approval.approvalId, expectedRequestHash: approval.requestHash,
      idempotencyKey: "order359-replay-key", envelope: { tenantId: TENANT, propertyNode: PROPERTY, actorId: REQUESTER, requestId: crypto.randomUUID(), operation: "discrepancy.carried" },
    }));
    expect(replay).toMatchObject({ carryId: result.carryId, replayed: true });
    await rejected(() => carry(approval.approvalId, "0".repeat(64)));
    await rejected(() => carry(approval.approvalId, approval.requestHash));
    expect(await deploy!<Array<{ resolved: boolean; resolution: string }>>`SELECT resolved_at IS NOT NULL resolved,resolution FROM discrepancy WHERE id=${DISCREPANCY}::uuid`).toEqual([{ resolved: true, resolution: "carried_forward" }]);
    expect(await deploy!<Array<{ carries: number; resolved: number; source: number }>>`SELECT count(*)::int carries,count(*) FILTER (WHERE resolution='carried_forward')::int resolved,count(*) FILTER (WHERE source_discrepancy_id=${DISCREPANCY}::uuid)::int source FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid`).toEqual([{ carries: 1, resolved: 1, source: 1 }]);
    expect(await deploy!<Array<{ business_date: string; opened_at: string; sealed_at: string | null }>>`SELECT business_date::text,opened_at::text,sealed_at::text FROM business_day WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid ORDER BY business_date`).toEqual(beforeDays);
    await expect(runtime!.begin(async tx => { await tx`SELECT set_config('app.tenant_id',${TENANT},true)`; await tx.unsafe("SET LOCAL ROLE app_role"); return tx`INSERT INTO business_day_discrepancy_carry(tenant_id,request_id,property_node,source_discrepancy_id,target_discrepancy_id,source_business_date,target_business_date,target_opened_at,space_id,discrepancy_state_hash,reason,request_hash,approval_request_id,requested_by,approved_by,approval_requested_at,approval_decided_at) VALUES(${TENANT}::uuid,gen_random_uuid(),${PROPERTY}::uuid,${DISCREPANCY}::uuid,gen_random_uuid(),${sourceDate}::date,${targetDate}::date,now(),${SPACE}::uuid,${"0".repeat(64)},'raw',${"0".repeat(64)},${approval.approvalId}::uuid,${REQUESTER}::uuid,${APPROVER}::uuid,now(),now())` })).rejects.toThrow();
    const after = await deploy!<{ j: number; p: number; pay: number; doc: number }[]>`SELECT
      (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT}::uuid) j,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${TENANT}::uuid) p,
      (SELECT count(*)::int FROM payment WHERE tenant_id=${TENANT}::uuid) pay,
      (SELECT count(*)::int FROM document WHERE tenant_id=${TENANT}::uuid) doc`;
    expect(after).toEqual(before);
  });

  test("rolls every boundary back and permits a clean retry", async () => {
    const approval = await requestApproval(); await decide(approval.approvalId);
    const failing: EventBus = { publish: async () => { throw new Error("order359 injected event failure"); } } as unknown as EventBus;
    const broken = new BusinessDayDiscrepancyCarryService({ events: failing, idempotency: new PostgresIdempotency() });
    await expect(database!.withTenantTransaction(TENANT, (tx) => broken.carry(tx, {
      tenantId: TENANT, approvalId: approval.approvalId, expectedRequestHash: approval.requestHash, idempotencyKey: "order359-rollback-key",
      envelope: { tenantId: TENANT, propertyNode: PROPERTY, actorId: REQUESTER, requestId: crypto.randomUUID(), operation: "discrepancy.carried" },
    }))).rejects.toThrow("order359 injected");
    expect(await counts()).toMatchObject({ carries: 0, discrepancies: 1, facts: 0, events: 0, keys: 0 });
    expect((await carry(approval.approvalId, approval.requestHash, "order359-rollback-key")).replayed).toBe(false);
  });

  test("two approvals converge under twenty same-key contenders and cross-tenant reads stay empty", async () => {
    const approvals = await Promise.all([requestApproval(), requestApproval()]);
    await Promise.all(approvals.map((approval) => decide(approval.approvalId)));
    const race = await Promise.allSettled(approvals.flatMap((approval) => Array.from({ length: 10 }, () => carry(approval.approvalId, approval.requestHash))));
    expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await deploy!<Array<{ carries: number }>>`SELECT count(*)::int carries FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid`).toEqual([{ carries: 1 }]);
    expect(await database!.withTenantTransaction(FOREIGN_TENANT, (tx) => tx<Array<Record<string, unknown>>>`SELECT * FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid`)).toEqual([]);
    expect(await deploy!<Array<{ count: number }>>`SELECT count(*)::int FROM business_day_discrepancy_carry WHERE tenant_id=${FOREIGN_TENANT}::uuid`).toEqual([{ count: 0 }]);
  });

  test("fresh catalogue, forced RLS and fixed owner authority remain exact", async () => {
    const rows = await deploy!`SELECT
      (SELECT count(*)::int FROM schema_migration) migrations,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') tables,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relrowsecurity) rls,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relforcerowsecurity) forced,
      (SELECT count(*)::int FROM pg_views WHERE schemaname='public') views`;
    expect(rows).toEqual([{ migrations: 63, tables: 116, rls: 106, forced: 15, views: 2 }]);
    const authority = await deploy!`SELECT c.relforcerowsecurity forced,
      has_table_privilege('app_role',c.oid,'SELECT') sel,has_table_privilege('app_role',c.oid,'INSERT') ins,
      pg_get_userbyid(p.proowner) owner,p.prosecdef definer,p.proconfig config
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL (SELECT p.* FROM pg_proc p WHERE p.oid='public.carry_business_day_discrepancy(uuid,uuid,text,uuid,uuid)'::regprocedure) p
      WHERE n.nspname='public' AND c.relname='business_day_discrepancy_carry'`;
    expect(authority[0]).toMatchObject({ forced: true, sel: true, ins: false, owner: "yellow_owner", definer: true, config: ["search_path=pg_catalog, public"] });
  });
});
