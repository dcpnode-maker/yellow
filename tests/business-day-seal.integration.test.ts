import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { BusinessDaySealConflictError, BusinessDaySealService } from "../src/contexts/financials";
import {
  Database, PostgresEventBus, PostgresIdempotency,
  type EventBus, type PublishEventInput, type Tx,
} from "../src/kernel";

const DEPLOY = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_BUSINESS_DAY_SEAL === "1";
if (REQUIRED && (!DEPLOY || !RUNTIME)) throw new Error("Order 356 proof requires deploy and runtime URLs");
const databaseDescribe = DEPLOY && RUNTIME ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000035600";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000035601";
const PROPERTY = "00000000-0000-0000-0000-000000035610";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000035611";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000035612";
const ACTOR = "00000000-0000-0000-0000-000000035620";
const UNAUTHORIZED = "00000000-0000-0000-0000-000000035621";
const INACTIVE = "00000000-0000-0000-0000-000000035622";
const FOREIGN_ACTOR = "00000000-0000-0000-0000-000000035623";
const ROLE = "00000000-0000-0000-0000-000000035630";
const PARTY = "00000000-0000-0000-0000-000000035640";
const RESERVATION = "00000000-0000-0000-0000-000000035650";
const DAY = "2047-05-06";

let deploy: SQL | undefined;
let runtime: SQL | undefined;
let database: Database | undefined;
let events: EventBus | undefined;
let service: BusinessDaySealService | undefined;

function command(key: string, overrides: Partial<{
  tenantId: string; propertyNode: string; businessDate: string; actorId: string;
}> = {}) {
  const target = { tenantId: TENANT, propertyNode: PROPERTY, businessDate: DAY, actorId: ACTOR, ...overrides };
  return { ...target, idempotencyKey: key, envelope: {
    tenantId: target.tenantId, propertyNode: target.propertyNode, actorId: target.actorId,
    requestId: crypto.randomUUID(), operation: "business_day.sealed",
  }} as const;
}

async function seal(key: string, overrides: Parameters<typeof command>[1] = {}) {
  const input = command(key, overrides);
  return database!.withTenantTransaction(input.tenantId, (tx) => service!.seal(tx, input));
}

async function sqlState(operation: () => Promise<unknown>): Promise<string> {
  try { await operation(); } catch (error) {
    const failure = error as { code?: string; errno?: string };
    return failure.code ?? failure.errno ?? "unknown";
  }
  throw new Error("Expected PostgreSQL failure");
}

async function resetCase() {
  await deploy!`DELETE FROM api_idempotency WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await deploy!`DELETE FROM fact_log WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await deploy!`DELETE FROM outbox WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await deploy!`DELETE FROM business_day WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await deploy!`UPDATE reservation SET status='reserved' WHERE tenant_id=${TENANT}::uuid AND id=${RESERVATION}::uuid`;
  await deploy!`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES
    (${TENANT}::uuid,${PROPERTY}::uuid,${DAY}::date),
    (${TENANT}::uuid,${OTHER_PROPERTY}::uuid,${DAY}::date),
    (${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,${DAY}::date)`;
}

async function evidence() {
  return (await deploy!<Array<{ sealed: boolean; sealed_by: string | null; facts: number; events: number; keys: number }>>`
    SELECT day.sealed_at IS NOT NULL AS sealed,day.sealed_by::text,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type='business_day'
        AND entity_id=${PROPERTY}::uuid AND fact_type='business_day.sealed') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_type='business_day'
        AND aggregate_id=${PROPERTY}::uuid AND event_type='business_day.sealed') events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid
        AND operation='financials.business-day.seal') keys
    FROM business_day day WHERE day.tenant_id=${TENANT}::uuid AND day.property_node=${PROPERTY}::uuid
      AND day.business_date=${DAY}::date`)[0]!;
}

beforeAll(async () => {
  if (!DEPLOY || !RUNTIME) return;
  deploy = new SQL(DEPLOY, { max: 12, prepare: false });
  runtime = new SQL(RUNTIME, { max: 12, prepare: false });
  database = Database.connect(RUNTIME, { maxConnections: 30, prepare: false });
  events = new PostgresEventBus(runtime);
  service = new BusinessDaySealService({ events, idempotency: new PostgresIdempotency() });
  await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order356','Order 356','shared','active'),
    (${FOREIGN_TENANT}::uuid,'order356-foreign','Order 356 foreign','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order356','property','Order 356','UTC','USD'),
    (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order356.other','property','Order 356 other','UTC','USD'),
    (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order356f','property','Order 356 foreign','UTC','USD')`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR}::uuid,${TENANT}::uuid,'actor@order356.test','Order 356 actor','active'),
    (${UNAUTHORIZED}::uuid,${TENANT}::uuid,'unauthorized@order356.test','Unauthorized','active'),
    (${INACTIVE}::uuid,${TENANT}::uuid,'inactive@order356.test','Inactive','inactive'),
    (${FOREIGN_ACTOR}::uuid,${FOREIGN_TENANT}::uuid,'foreign@order356.test','Foreign','active')`;
  await deploy`INSERT INTO role(id,tenant_id,name) VALUES(${ROLE}::uuid,${TENANT}::uuid,'Order 356 auditor')`;
  await deploy`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,'business_day.seal')`;
  await deploy`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES
    (${TENANT}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${PROPERTY}::uuid),
    (${TENANT}::uuid,${INACTIVE}::uuid,${ROLE}::uuid,${PROPERTY}::uuid)`;
  await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status)
    VALUES(${PARTY}::uuid,${TENANT}::uuid,'person','Order 356 proof','active')`;
  await deploy`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency)
    VALUES(${RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O356-1','reserved',${PARTY}::uuid,'direct','USD')`;
  await resetCase();
}, 60_000);

beforeEach(async () => { if (deploy) await resetCase(); });

afterAll(async () => {
  if (!deploy) return;
  await resetCase();
  await deploy`DELETE FROM business_day WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM reservation WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM party WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM user_role WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid`;
  await deploy`DELETE FROM role WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM app_user WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM org_node WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await database?.close(); await runtime?.close({ timeout: 0 }); await deploy?.close({ timeout: 0 });
}, 60_000);

describe("Order 356 audited seal static serialization contract", () => {
  test("lock set covers each mutable authorization/readiness source", async () => {
    const migration = await Bun.file(new URL("../migrations/0064_audited_business_day_seal.sql", import.meta.url)).text();
    const locked = [...migration.matchAll(/LOCK TABLE public\.([a-z_]+) IN SHARE MODE/g)].map((match) => match[1]);
    expect(locked).toEqual(["app_user","business_day","business_day_discrepancy_carry","cashier_session",
      "discrepancy","document","fiscal_submission","inbound_message","org_node","outbox","payment",
      "payment_operation","reservation","role_permission","space","statutory_submission","tenant","user_role"]);
    expect(migration).toContain("transaction_timestamp()");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).not.toContain("->>");
    expect(migration).not.toMatch(/payload\s*(?:->|#>)/);
  });
});

databaseDescribe("Order 356 fresh PostgreSQL seal proof", () => {
  test("capability/legacy ACL and direct business-day DML remain contained", async () => {
    const authority = await deploy!<Array<Record<string, unknown>>>`
      SELECT p.oid::regprocedure::text signature,pg_get_userbyid(p.proowner) owner,p.prosecdef security_definer,
        p.provolatile::text volatility,p.proconfig config,
        has_function_privilege('app_role',p.oid,'EXECUTE') app_execute,
        has_function_privilege('yellow_runtime',p.oid,'EXECUTE') runtime_execute,
        has_function_privilege('public',p.oid,'EXECUTE') public_execute
      FROM pg_proc p WHERE p.oid='public.seal_business_day_audited(uuid,uuid,date,uuid)'::regprocedure`;
    expect(authority).toEqual([{ signature:"seal_business_day_audited(uuid,uuid,date,uuid)",owner:"yellow_owner",
      security_definer:true,volatility:"v",config:["search_path=pg_catalog, public, pg_temp"],
      app_execute:true,runtime_execute:false,public_execute:false }]);
    expect((await deploy!<Array<{ app:boolean; runtime:boolean; public:boolean }>>`
      SELECT has_function_privilege('app_role','public.seal_business_day(uuid,uuid,date,uuid)','EXECUTE') app,
        has_function_privilege('yellow_runtime','public.seal_business_day(uuid,uuid,date,uuid)','EXECUTE') runtime,
        has_function_privilege('public','public.seal_business_day(uuid,uuid,date,uuid)','EXECUTE') public`)[0])
      .toEqual({ app:false,runtime:false,public:false });
    expect(await sqlState(() => deploy!`SELECT * FROM seal_business_day_audited(
      ${TENANT}::uuid,${PROPERTY}::uuid,${DAY}::date,${ACTOR}::uuid)`)).toBe("42501");
    expect(await sqlState(() => runtime!`SELECT * FROM seal_business_day_audited(
      ${TENANT}::uuid,${PROPERTY}::uuid,${DAY}::date,${ACTOR}::uuid)`)).toBe("42501");
    expect(await sqlState(() => database!.withTenantTransaction(TENANT, (tx) => tx`
      UPDATE business_day SET sealed_at=transaction_timestamp() WHERE tenant_id=${TENANT}::uuid`))).toBe("42501");
    expect(await evidence()).toEqual({sealed:false,sealed_by:null,facts:0,events:0,keys:0});
  }, 40_000);

  test("success is database-authored, atomic, minimized and exactly replayable", async () => {
    const request = command("order356-success-replay");
    const first = await database!.withTenantTransaction(TENANT, (tx) => service!.seal(tx, request));
    expect(first).toMatchObject({tenantId:TENANT,propertyNode:PROPERTY,businessDate:DAY,
      previousState:"open",state:"sealed",actorId:ACTOR,replayed:false});
    expect(new Date(first.sealedAt).toISOString()).toBe(first.sealedAt);
    expect(await database!.withTenantTransaction(TENANT, (tx) => service!.seal(tx, request)))
      .toEqual({...first,replayed:true});
    expect(await evidence()).toEqual({sealed:true,sealed_by:ACTOR,facts:1,events:1,keys:1});
    const rows = await deploy!<Array<{fact_payload:Record<string,unknown>;event_payload:Record<string,unknown>;
      property_node:string;business_date:string;actor_id:string;correlation_id:string;causation_id:string|null}>>`
      SELECT fact.payload fact_payload,event.payload event_payload,event.property_node::text,
        event.business_date::text,event.actor_id::text,event.correlation_id::text,event.causation_id::text
      FROM fact_log fact JOIN outbox event ON event.tenant_id=fact.tenant_id
        AND event.aggregate_id=fact.entity_id AND event.event_type=fact.fact_type
      WHERE fact.tenant_id=${TENANT}::uuid AND fact.entity_id=${PROPERTY}::uuid`;
    const payload = {property_node:PROPERTY,business_date:DAY,previous_state:"open",state:"sealed",
      sealed_at:first.sealedAt,sealed_by:ACTOR};
    expect(rows).toEqual([{fact_payload:{...payload,request_id:request.envelope.requestId},event_payload:payload,
      property_node:PROPERTY,business_date:DAY,actor_id:ACTOR,correlation_id:request.envelope.requestId,causation_id:null}]);
    await expect(database!.withTenantTransaction(TENANT, (tx) => service!.seal(tx, {
      ...request,propertyNode:OTHER_PROPERTY,envelope:{...request.envelope,propertyNode:OTHER_PROPERTY},
    }))).rejects.toBeInstanceOf(BusinessDaySealConflictError);
    await expect(seal("order356-different-key-after-seal")).rejects.toBeInstanceOf(BusinessDaySealConflictError);
    expect(await evidence()).toEqual({sealed:true,sealed_by:ACTOR,facts:1,events:1,keys:1});
  }, 40_000);

  test("blocker, unknown attribution and actor/property hostility fail with zero mutation", async () => {
    await deploy!`UPDATE reservation SET status='due_in' WHERE tenant_id=${TENANT}::uuid AND id=${RESERVATION}::uuid`;
    await expect(seal("order356-unknown-due")).rejects.toBeInstanceOf(BusinessDaySealConflictError);
    expect(await evidence()).toEqual({sealed:false,sealed_by:null,facts:0,events:0,keys:0});
    await deploy!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
      actor_id,correlation_id,payload,published_at) VALUES(${TENANT}::uuid,${PROPERTY}::uuid,${DAY}::date,
      'reservation',${RESERVATION}::uuid,'reservation.due_in',${ACTOR}::uuid,gen_random_uuid(),
      '{"forged":"ignored"}'::jsonb,transaction_timestamp())`;
    await expect(seal("order356-typed-due")).rejects.toBeInstanceOf(BusinessDaySealConflictError);
    await deploy!`UPDATE reservation SET status='reserved' WHERE id=${RESERVATION}::uuid`;
    await deploy!`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid`;
    for (const [label,override] of [["unauthorized",{actorId:UNAUTHORIZED}], ["inactive",{actorId:INACTIVE}],
      ["other-property",{propertyNode:OTHER_PROPERTY}], ["missing",{businessDate:"2047-05-07"}],
      ["foreign",{tenantId:FOREIGN_TENANT,propertyNode:FOREIGN_PROPERTY,actorId:FOREIGN_ACTOR}]] as const) {
      await expect(seal(`order356-${label}-reject`,override)).rejects.toBeInstanceOf(BusinessDaySealConflictError);
    }
    expect(await evidence()).toEqual({sealed:false,sealed_by:null,facts:0,events:0,keys:0});
  }, 40_000);

  test("twenty distinct keys have exactly one winner", async () => {
    const outcomes = await Promise.allSettled(Array.from({length:20},(_,index) =>
      seal(`order356-distinct-${index.toString().padStart(2,"0")}`)));
    expect(outcomes.filter((result) => result.status==="fulfilled")).toHaveLength(1);
    expect(outcomes.filter((result) => result.status==="rejected")).toHaveLength(19);
    expect(await evidence()).toEqual({sealed:true,sealed_by:ACTOR,facts:1,events:1,keys:1});
  }, 90_000);

  test("event failure rolls back latch/fact/outbox/key and a clean retry wins", async () => {
    let observed = false;
    const failing: EventBus = { publish: async (tx:Tx,event:PublishEventInput) => {
      await events!.publish(tx,event); observed=true; throw new Error("order356 injected event failure");
    }, consumeBatch:(...args) => events!.consumeBatch(...args) };
    const broken = new BusinessDaySealService({events:failing,idempotency:new PostgresIdempotency()});
    const request = command("order356-event-rollback");
    await expect(database!.withTenantTransaction(TENANT,(tx) => broken.seal(tx,request)))
      .rejects.toThrow("order356 injected event failure");
    expect(observed).toBe(true);
    expect(await evidence()).toEqual({sealed:false,sealed_by:null,facts:0,events:0,keys:0});
    expect((await database!.withTenantTransaction(TENANT,(tx) => service!.seal(tx,request))).replayed).toBe(false);
    expect(await evidence()).toEqual({sealed:true,sealed_by:ACTOR,facts:1,events:1,keys:1});
  }, 40_000);
});
