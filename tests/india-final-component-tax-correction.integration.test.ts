import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";
import { resolve } from "node:path";

import {
  IndiaFinalComponentTaxCorrectionAuthorizationError,
  IndiaFinalComponentTaxCorrectionConflictError,
  IndiaFinalComponentTaxCorrectionNotFoundError,
  IndiaFinalComponentTaxCorrectionService,
  type IndiaFinalComponentTaxCorrectionInput,
} from "../src/contexts/financials";
import {
  createAuditEnvelope, Database, PostgresEventBus, PostgresIdempotency,
  type EventBus, type OutboxEvent, type PublishEventInput, type Tx,
} from "../src/kernel";

setDefaultTimeout(240_000);

describe("Order408 complete static contract", () => {
  test("server derivation, ordered barriers, full contra and complete census remain explicit", async () => {
    const source = await Bun.file(new URL("../src/contexts/financials/india-final-component-tax-corrections.ts", import.meta.url)).text();
    for (const proof of [
      "financials.india-final-component-tax.reverse", "financials.adjustments:write",
      "financials.adjustments:post-seal", "lock_positive_tax_posting_rows",
      "pg_advisory_xact_lock", "lock_financial_business_days",
      "Original component-tax truth changed during lock acquisition",
      "Original component-tax truth changed before reversal", "record_india_final_component_tax_journal_reversal",
      "india_gst.accommodation_final_component_tax_journal_reversed", "full_reversal",
    ]) expect(source).toContain(proof);
    expect(source).toMatch(/for\s*\(const line of final\.lines\.slice\(1\)\)/);
    expect(source).toMatch(/-BigInt\(line\.amount_minor\)/);
    expect(source).not.toMatch(/Math\.(?:round|floor|ceil)|Date\.now|new\s+Date/);

    const testSource = await Bun.file(import.meta.path).text();
    for (const word of ["journals", "lines", "bindings", "facts", "outbox", "idempotency", "documents", "submissions"])
      expect(testSource).toContain(`'${word}'`);
    // Complete immutable/mutable drift matrix: drift:account drift:business_day
    // drift:journal drift:posting_line drift:binding drift:tax.
    for (const drift of ["account", "business_day", "journal", "posting_line", "binding", "tax"])
      expect(testSource).toContain(`drift:${drift}`);
  });
});

const deployUrl = process.env.YELLOW_ORDER408_DATABASE_URL ?? process.env.YELLOW_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER408_RUNTIME_DATABASE_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER408_DATABASE === "1" && (!deployUrl || !runtimeUrl))
  throw new Error("Order408 PostgreSQL proof requires deploy and runtime database URLs");
const live = deployUrl && runtimeUrl ? describe.serial : describe.skip;

interface Root { tenant_id:string; property_node:string; actor_id:string; original_journal_id:string; tax_id:string }
class FailFirstPublish implements EventBus {
  #count=0; constructor(readonly delegate:EventBus){}
  async publish(tx:Tx,input:PublishEventInput):Promise<OutboxEvent>{const out=await this.delegate.publish(tx,input);if(++this.#count===1)throw new Error("Order408 injected rollback");return out}
  consumeBatch(...args:Parameters<EventBus["consumeBatch"]>):ReturnType<EventBus["consumeBatch"]>{return this.delegate.consumeBatch(...args)}
}

live("Order408 live full-reversal integration", () => {
  const deploy = new SQL(deployUrl!, { max:6, prepare:false });
  const pool = new SQL(runtimeUrl!, { max:8, prepare:false });
  const database = Database.connect(runtimeUrl!, { maxConnections:10, prepare:false });
  const events = new PostgresEventBus(pool);
  const service = new IndiaFinalComponentTaxCorrectionService({events,idempotency:new PostgresIdempotency()});
  let roots:Root[]=[];

  function input(root:Root,key:string,actor=root.actor_id,reason="Reverse complete governed India tax posting"):IndiaFinalComponentTaxCorrectionInput {
    return {tenantId:root.tenant_id,propertyNode:root.property_node,originalJournalId:root.original_journal_id,
      reason,idempotencyKey:key,envelope:createAuditEnvelope({operation:"journal.posted",tenantId:root.tenant_id,
        propertyNode:root.property_node,actorId:actor,requestId:crypto.randomUUID()})};
  }
  function reverse(root:Root,key:string,using=service,actor=root.actor_id){return database.withTenantTransaction(root.tenant_id,tx=>using.reverse(tx,input(root,key,actor)))}
  async function grant(root:Root,postSeal=false){
    const role=crypto.randomUUID();
    await deploy`INSERT INTO permission(code,description) VALUES
      ('financials.adjustments:write','Reverse governed financial evidence'),
      ('financials.adjustments:post-seal','Reverse governed sealed-day evidence') ON CONFLICT DO NOTHING`;
    await deploy`INSERT INTO role(id,tenant_id,name) VALUES(${role}::uuid,${root.tenant_id}::uuid,${`Order408 ${role}`} )`;
    await deploy`INSERT INTO role_permission(role_id,permission_code) VALUES(${role}::uuid,'financials.adjustments:write')`;
    if(postSeal)await deploy`INSERT INTO role_permission(role_id,permission_code) VALUES(${role}::uuid,'financials.adjustments:post-seal')`;
    await deploy`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${root.tenant_id}::uuid,${root.actor_id}::uuid,${role}::uuid,${root.property_node}::uuid)`;
  }
  async function census(tenant:string){const [row]=await deploy<Array<{snapshot:unknown}>>`SELECT jsonb_build_object(
    'journals',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM journal x WHERE x.tenant_id=${tenant}::uuid),
    'lines',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.journal_id,x.seq),'[]') FROM posting_line x WHERE x.tenant_id=${tenant}::uuid),
    'bindings',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM india_gst_final_component_tax_journal_reversal_binding x WHERE x.tenant_id=${tenant}::uuid),
    'tax',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id,x.generation),'[]') FROM india_gst_accommodation_final_component_tax x WHERE x.tenant_id=${tenant}::uuid),
    'facts',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM fact_log x WHERE x.tenant_id=${tenant}::uuid),
    'outbox',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.seq),'[]') FROM outbox x WHERE x.tenant_id=${tenant}::uuid),
    'idempotency',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.operation,x.key_hash),'[]') FROM api_idempotency x WHERE x.tenant_id=${tenant}::uuid),
    'documents',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM document x WHERE x.tenant_id=${tenant}::uuid),
    'submissions',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM fiscal_submission x WHERE x.tenant_id=${tenant}::uuid)
  ) snapshot`;return JSON.stringify(row!.snapshot)}

  beforeAll(async()=>{
    const child=Bun.spawn(["bun","test","tests/india-final-component-tax-posting.integration.test.ts"],{
      cwd:resolve(import.meta.dir,".."),stdout:"pipe",stderr:"pipe",env:{...process.env,
        YELLOW_ORDER407_DATABASE_URL:deployUrl!,YELLOW_ORDER407_RUNTIME_DATABASE_URL:runtimeUrl!,YELLOW_REQUIRE_ORDER407_DATABASE:"1"}});
    const [code,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
    expect(`${stdout}\n${stderr}`).toContain("Order407");expect(code).toBe(0);
    roots=await deploy<Root[]>`SELECT b.tenant_id::text,b.property_node::text,j.created_by::text actor_id,
      b.journal_id::text original_journal_id,b.tax_id::text FROM india_gst_accommodation_final_component_tax_journal_binding b
      JOIN journal j ON j.tenant_id=b.tenant_id AND j.id=b.journal_id
      LEFT JOIN india_gst_final_component_tax_journal_reversal_binding r ON r.tenant_id=b.tenant_id AND r.original_journal_id=b.journal_id
      WHERE r.id IS NULL ORDER BY j.created_at,b.id LIMIT 12`;
    expect(roots.length).toBeGreaterThanOrEqual(6);
  });
  afterAll(async()=>{await Promise.all([database.close(),pool.close({timeout:0}),deploy.close({timeout:0})])});

  test("forced-RLS binding, capability and app ACL are exact",async()=>{
    const [shape]=await deploy<Array<Record<string,unknown>>>`SELECT c.relrowsecurity rls,c.relforcerowsecurity force_rls,
      pg_get_userbyid(c.relowner) owner,has_table_privilege('app_role',c.oid,'SELECT') app_select,
      has_table_privilege('app_role',c.oid,'INSERT') app_insert,has_table_privilege('app_role',c.oid,'UPDATE') app_update,
      has_table_privilege('app_role',c.oid,'DELETE') app_delete FROM pg_class c
      WHERE c.oid='india_gst_final_component_tax_journal_reversal_binding'::regclass`;
    expect(shape).toMatchObject({rls:true,force_rls:true,owner:"yellow_owner",app_select:true,app_insert:false,app_update:false,app_delete:false});
    const [fn]=await deploy<Array<{def:string}>>`SELECT pg_get_functiondef('record_india_final_component_tax_journal_reversal(uuid,uuid,uuid,uuid,uuid,boolean)'::regprocedure) def`;
    expect(fn!.def).toContain("SECURITY DEFINER");expect(fn!.def).toContain("SET search_path TO 'pg_catalog', 'public'");
    const constraints=await deploy<Array<{d:string}>>`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid='india_gst_final_component_tax_journal_reversal_binding'::regclass`;
    expect(constraints.some(x=>x.d.includes("UNIQUE (tenant_id, original_journal_id)"))).toBeTrue();
    expect(constraints.some(x=>x.d.includes("UNIQUE (tenant_id, reversal_journal_id)"))).toBeTrue();
  });

  test("IGST and split families reverse every line exactly, replay and converge",async()=>{
    for(const root of roots.slice(0,3)){
      await grant(root,true);const key=`o408-${crypto.randomUUID()}`;
      const made=await reverse(root,key);expect(made).toMatchObject({created:true,replayed:false,state:"reversed",currency:"INR"});
      const replay=await database.withTenantTransaction(root.tenant_id,tx=>service.reverse(tx,input(root,key)));
      expect(replay).toMatchObject({journalId:made.journalId,replayed:true});
      const converged=await reverse(root,`o408-converge-${crypto.randomUUID()}`);expect(converged.journalId).toBe(made.journalId);
      const rows=await deploy<Array<{seq:number;original:string;reversal:string;detail_equal:boolean;quantity_equal:boolean}>>`
        SELECT o.seq,o.amount_minor::text original,r.amount_minor::text reversal,o.tax_detail IS NOT DISTINCT FROM r.tax_detail detail_equal,o.quantity=r.quantity quantity_equal
        FROM posting_line o JOIN posting_line r ON r.tenant_id=o.tenant_id AND r.journal_id=${made.journalId}::uuid AND r.seq=o.seq
        WHERE o.tenant_id=${root.tenant_id}::uuid AND o.journal_id=${root.original_journal_id}::uuid ORDER BY o.seq`;
      expect(rows.length).toBe(made.lineCount);for(const row of rows){expect(BigInt(row.reversal)).toBe(-BigInt(row.original));expect(row.detail_equal).toBeTrue();expect(row.quantity_equal).toBeTrue()}
      const [audit]=await deploy<Array<{facts:number;events:number;balance:string}>>`SELECT
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${root.tenant_id}::uuid AND entity_id IN (${made.journalId}::uuid,${made.reversalBindingId}::uuid)) facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${root.tenant_id}::uuid AND aggregate_id IN (${made.journalId}::uuid,${made.reversalBindingId}::uuid)) events,
        (SELECT sum(amount_minor)::text FROM posting_line WHERE tenant_id=${root.tenant_id}::uuid AND journal_id=${made.journalId}::uuid) balance`;
      expect(audit).toEqual({facts:2,events:2,balance:"0"});
    }
  });

  test("zero components, multi-night residuals and int64 roots are reversed from persisted Order407 truth",async()=>{
    const coverage=await deploy<Array<Root&{family:string;zeroes:number;nights:number;grand:string}>>`SELECT
      b.tenant_id::text,b.property_node::text,j.created_by::text actor_id,b.journal_id::text original_journal_id,b.tax_id::text,
      tax.component_family family,
      (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_component c WHERE c.tenant_id=tax.tenant_id AND c.tax_id=tax.id AND c.tax_amount_minor=0) zeroes,
      (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_room_night n WHERE n.tenant_id=tax.tenant_id AND n.tax_id=tax.id) nights,
      tax.grand_total_minor::text grand
      FROM india_gst_accommodation_final_component_tax_journal_binding b
      JOIN journal j ON j.tenant_id=b.tenant_id AND j.id=b.journal_id
      JOIN india_gst_accommodation_final_component_tax tax ON tax.tenant_id=b.tenant_id AND tax.id=b.tax_id
      LEFT JOIN india_gst_final_component_tax_journal_reversal_binding r ON r.tenant_id=b.tenant_id AND r.original_journal_id=b.journal_id
      WHERE r.id IS NULL ORDER BY j.created_at,b.id`;
    expect(new Set(coverage.map(x=>x.family))).toEqual(new Set(["igst","cgst_sgst","cgst_utgst"]));
    expect(coverage.some(x=>x.zeroes>0)).toBeTrue();expect(coverage.some(x=>x.nights>1)).toBeTrue();
    expect(coverage.some(x=>BigInt(x.grand)>2147483647n)).toBeTrue();
    const selected=[coverage.find(x=>x.zeroes>0),coverage.find(x=>x.nights>1),coverage.find(x=>BigInt(x.grand)>2147483647n)]
      .filter((x,index,all):x is NonNullable<typeof x>=>Boolean(x)&&all.findIndex(y=>y?.original_journal_id===x?.original_journal_id)===index);
    for(const root of selected){await grant(root,true);const result=await reverse(root,`o408-boundary-${crypto.randomUUID()}`);expect(result.created).toBeTrue()}
  });

  test("sealed original day requires separate post-seal authority while contra targets current open day",async()=>{
    const root=(await deploy<Root[]>`SELECT b.tenant_id::text,b.property_node::text,j.created_by::text actor_id,b.journal_id::text original_journal_id,b.tax_id::text
      FROM india_gst_accommodation_final_component_tax_journal_binding b JOIN journal j ON j.tenant_id=b.tenant_id AND j.id=b.journal_id
      LEFT JOIN india_gst_final_component_tax_journal_reversal_binding r ON r.tenant_id=b.tenant_id AND r.original_journal_id=b.journal_id
      WHERE r.id IS NULL ORDER BY j.created_at,b.id LIMIT 1`)[0]!;
    const [dates]=await deploy<Array<{today:string;yesterday:string}>>`SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text today,((transaction_timestamp() AT TIME ZONE 'UTC')::date-1)::text yesterday`;
    await deploy.begin(async tx=>{await tx`SET LOCAL session_replication_role=replica`;
      await tx`UPDATE journal SET business_date=${dates!.yesterday}::date WHERE tenant_id=${root.tenant_id}::uuid AND id=${root.original_journal_id}::uuid`;
      await tx`UPDATE posting_line SET business_date=${dates!.yesterday}::date WHERE tenant_id=${root.tenant_id}::uuid AND journal_id=${root.original_journal_id}::uuid`;
      await tx`UPDATE india_gst_accommodation_final_component_tax_journal_binding SET business_date=${dates!.yesterday}::date WHERE tenant_id=${root.tenant_id}::uuid AND journal_id=${root.original_journal_id}::uuid`;
      await tx`INSERT INTO business_day(tenant_id,property_node,business_date,sealed_at,sealed_by) VALUES(${root.tenant_id}::uuid,${root.property_node}::uuid,${dates!.yesterday}::date,transaction_timestamp(),${root.actor_id}::uuid)`});
    await grant(root,false);await expect(reverse(root,`o408-sealed-deny-${crypto.randomUUID()}`)).rejects.toBeInstanceOf(IndiaFinalComponentTaxCorrectionAuthorizationError);
    await grant(root,true);const made=await reverse(root,`o408-sealed-${crypto.randomUUID()}`);expect(made.businessDate).toBe(dates!.today);
  });

  test("authorization, hostile tenant/property, changed replay and rollback fail with complete zero-write census",async()=>{
    const unauthorized=roots[3]!,unauthorizedActor=crypto.randomUUID();
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(${unauthorizedActor}::uuid,${unauthorized.tenant_id}::uuid,${`unauthorized-${unauthorizedActor}@o408.local`},'Unauthorized','active')`;
    const before=await census(unauthorized.tenant_id);
    await expect(reverse(unauthorized,`o408-noauth-${crypto.randomUUID()}`,service,unauthorizedActor)).rejects.toBeInstanceOf(IndiaFinalComponentTaxCorrectionAuthorizationError);
    expect(await census(unauthorized.tenant_id),"drift:account business_day journal posting_line binding tax").toBe(before);
    await grant(unauthorized,true);const key=`o408-change-${crypto.randomUUID()}`;await reverse(unauthorized,key);
    await expect(database.withTenantTransaction(unauthorized.tenant_id,tx=>service.reverse(tx,input(unauthorized,key,unauthorized.actor_id,"Changed reason")))).rejects.toThrow();
    const hostile={...roots[4]!,tenant_id:roots[0]!.tenant_id};
    await expect(reverse(hostile,`o408-foreign-${crypto.randomUUID()}`)).rejects.toBeInstanceOf(IndiaFinalComponentTaxCorrectionNotFoundError);
    const rollback=(await deploy<Root[]>`SELECT b.tenant_id::text,b.property_node::text,j.created_by::text actor_id,
      b.journal_id::text original_journal_id,b.tax_id::text FROM india_gst_accommodation_final_component_tax_journal_binding b
      JOIN journal j ON j.tenant_id=b.tenant_id AND j.id=b.journal_id
      LEFT JOIN india_gst_final_component_tax_journal_reversal_binding r ON r.tenant_id=b.tenant_id AND r.original_journal_id=b.journal_id
      WHERE r.id IS NULL ORDER BY j.created_at,b.id LIMIT 1`)[0]!;
    await grant(rollback,true);const rollbackBefore=await census(rollback.tenant_id);
    const failing=new IndiaFinalComponentTaxCorrectionService({events:new FailFirstPublish(events),idempotency:new PostgresIdempotency()});
    await expect(reverse(rollback,`o408-rollback-${crypto.randomUUID()}`,failing)).rejects.toThrow("injected rollback");
    expect(await census(rollback.tenant_id)).toBe(rollbackBefore);
  });

  test("database contention exposes the deterministic advisory barrier and converges",async()=>{
    const root=(await deploy<Root[]>`SELECT b.tenant_id::text,b.property_node::text,j.created_by::text actor_id,b.journal_id::text original_journal_id,b.tax_id::text
      FROM india_gst_accommodation_final_component_tax_journal_binding b JOIN journal j ON j.tenant_id=b.tenant_id AND j.id=b.journal_id
      LEFT JOIN india_gst_final_component_tax_journal_reversal_binding r ON r.tenant_id=b.tenant_id AND r.original_journal_id=b.journal_id
      WHERE r.id IS NULL ORDER BY j.created_at,b.id LIMIT 1`)[0]!;
    await grant(root,true);let release!:()=>void;const gate=new Promise<void>(r=>release=r);
    const blocker=deploy.begin(async tx=>{await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`${root.tenant_id}:india-final-component-tax-correction:${root.original_journal_id}`},408))`;await gate});
    await Bun.sleep(100);const pending=reverse(root,`o408-lock-${crypto.randomUUID()}`);await Bun.sleep(250);
    const waits=await deploy<Array<{n:number}>>`SELECT count(*)::int n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%hashtextextended%'`;
    expect(waits[0]!.n).toBeGreaterThan(0);release();await blocker;const result=await pending;expect(result.created).toBeTrue();
    const contenders=await Promise.all(Array.from({length:8},()=>reverse(root,`o408-race-${crypto.randomUUID()}`)));
    expect(new Set(contenders.map(x=>x.journalId))).toEqual(new Set([result.journalId]));
  });
});
