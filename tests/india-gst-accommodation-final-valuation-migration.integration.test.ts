import { afterAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { randomUUID } from "node:crypto";

const url=process.env.YELLOW_ORDER350_DATABASE_URL;
const run=url?describe:describe.skip;
run("Order 350 fresh PostgreSQL catalogue",()=>{
  const db=new SQL(url!,{max:1});afterAll(()=>db.close());
  test("has the exact migration/table/RLS/view counts",async()=>{
    const [row]=await db<Array<{m:number;t:number;r:number;f:number;v:number}>>`SELECT (SELECT count(*)::int FROM schema_migration) m,(SELECT count(*)::int FROM pg_tables WHERE schemaname='public') t,(SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relrowsecurity) r,(SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relforcerowsecurity) f,(SELECT count(*)::int FROM pg_views WHERE schemaname='public') v`;
    expect(row).toEqual({m:62,t:115,r:105,f:14,v:2});
  });
  test("four bundle tables are forced-RLS and app SELECT-only",async()=>{
    const rows=await db<Array<{relname:string;relforcerowsecurity:boolean;sel:boolean;ins:boolean;upd:boolean;del:boolean}>>`SELECT c.relname,c.relforcerowsecurity,has_table_privilege('app_role',c.oid,'SELECT') sel,has_table_privilege('app_role',c.oid,'INSERT') ins,has_table_privilege('app_role',c.oid,'UPDATE') upd,has_table_privilege('app_role',c.oid,'DELETE') del FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('india_gst_accommodation_final_valuation','india_gst_accommodation_valuation_source','india_gst_accommodation_valuation_room_night','india_gst_accommodation_valuation_allocation') ORDER BY c.relname`;
    expect(rows).toHaveLength(4);for(const row of rows)expect(row).toMatchObject({relforcerowsecurity:true,sel:true,ins:false,upd:false,del:false});
  });
  test("bounded command is owner-mediated and denied to runtime/public",async()=>{
    const [row]=await db<Array<{owner:string;definer:boolean;config:string[];app:boolean;runtime:boolean;everyone:boolean}>>`SELECT pg_get_userbyid(p.proowner) owner,p.prosecdef definer,p.proconfig config,has_function_privilege('app_role',p.oid,'EXECUTE') app,has_function_privilege('yellow_runtime',p.oid,'EXECUTE') runtime,has_function_privilege('public',p.oid,'EXECUTE') everyone FROM pg_proc p WHERE p.proname='record_india_gst_accommodation_final_valuation'`;
    expect(row).toMatchObject({owner:"yellow_owner",definer:true,config:["search_path=pg_catalog, public"],app:true,runtime:false,everyone:false});
  });
  test("records an atomic immutable valuation bundle through the governed command",async()=>{
    const [tenant,property,actor,buyer,reservation,guest,revenue,folio,attribution,journal,source,counter,request]=Array.from({length:13},()=>randomUUID()) as [string,string,string,string,string,string,string,string,string,string,string,string,string];
    const h=(value:string)=>value.repeat(64);
    await db.begin(async tx=>{
      await tx`INSERT INTO tenant(id,slug,name) VALUES(${tenant}::uuid,${`o350-${tenant.slice(0,8)}`},'Order350')`;
      await tx`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES(${property}::uuid,${tenant}::uuid,${`o350_${tenant.replaceAll("-","")}`}::ltree,'property','Order350','Asia/Kolkata','INR')`;
      await tx`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(${actor}::uuid,${tenant}::uuid,${`${actor}@order350.test`},'Actor','active')`;
      await tx`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(${buyer}::uuid,${tenant}::uuid,'person','Buyer','active')`;
      await tx`INSERT INTO party_role(tenant_id,party_id,role) VALUES(${tenant}::uuid,${buyer}::uuid,'guest')`;
      await tx`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,currency) VALUES(${reservation}::uuid,${tenant}::uuid,${property}::uuid,${`O350-${reservation.slice(0,8)}`},'reserved',${buyer}::uuid,'INR')`;
      await tx`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES(${guest}::uuid,${tenant}::uuid,${property}::uuid,'guest',${buyer}::uuid,'Guest','INR','open'),(${revenue}::uuid,${tenant}::uuid,${property}::uuid,'revenue',NULL,'Revenue','INR','open')`;
      await tx`INSERT INTO folio(id,tenant_id,account_id,reservation_id,window_no,status) VALUES(${folio}::uuid,${tenant}::uuid,${guest}::uuid,${reservation}::uuid,2,'open')`;
      await tx`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES(${tenant}::uuid,${property}::uuid,CURRENT_DATE)`;
      const code=`O350_${source.slice(0,8)}`;
      await tx`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr) VALUES(${code},'Order350 room','revenue','Rooms','guest','revenue')`;
      await tx`INSERT INTO journal(id,tenant_id,property_node,business_date,kind,description,currency,created_by) VALUES(${journal}::uuid,${tenant}::uuid,${property}::uuid,CURRENT_DATE,'charge','Order350','INR',${actor}::uuid)`;
      await tx`INSERT INTO posting_line(id,tenant_id,journal_id,seq,account_id,folio_id,tx_code,amount_minor,business_date,currency) VALUES(${source}::uuid,${tenant}::uuid,${journal}::uuid,1,${guest}::uuid,${folio}::uuid,${code},1000,CURRENT_DATE,'INR'),(${counter}::uuid,${tenant}::uuid,${journal}::uuid,2,${revenue}::uuid,NULL,${code},-1000,CURRENT_DATE,'INR')`;
      const snapshot={schemaVersion:1,origin:{kind:"rate_quote",quoteHash:h("a")},currency:"INR",revenueLine:{},assignments:[],jurisdiction:{},evaluation:{},snapshotHash:h("b")};
      await tx`INSERT INTO tax_attribution_snapshot(tenant_id,id,property_node,actor_id,schema_version,origin_kind,origin_quote_hash,snapshot_hash,currency,snapshot) VALUES(${tenant}::uuid,${attribution}::uuid,${property}::uuid,${actor}::uuid,1,'rate_quote',${h("a")},${h("b")},'INR',${snapshot}::jsonb)`;
    });
    const connection=await db.reserve();
    try{
      await connection.unsafe("BEGIN");
      await connection`SELECT set_config('app.tenant_id',${tenant},true)`;
      await connection.unsafe("SET LOCAL ROLE app_role");
      const rows=await connection<Array<{generation:number;disposition:string;transaction_value_minor:string}>>`SELECT * FROM record_india_gst_accommodation_final_valuation(${tenant}::uuid,${property}::uuid,${reservation}::uuid,${folio}::uuid,${buyer}::uuid,${attribution}::uuid,${request}::uuid,${actor}::uuid,'ordinary_final',${h("c")},${h("d")},${h("e")},NULL::uuid,NULL::text,NULL::uuid,ARRAY[${h("1")},${h("2")},${h("3")},${h("4")},${h("5")}]::text[],'{}'::text[],ARRAY[${source}::uuid],ARRAY['room_consideration']::text[],ARRAY[${h("6")}]::text[],ARRAY['']::text[],ARRAY[0]::integer[],ARRAY[CURRENT_DATE]::date[],ARRAY[1000]::bigint[],ARRAY[1000]::bigint[])`;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({generation:0,disposition:"ordinary_final",transaction_value_minor:"1000"});
      const [counts]=await connection<Array<{roots:number;sources:number;nights:number;allocations:number;facts:number;events:number}>>`SELECT (SELECT count(*)::int FROM india_gst_accommodation_final_valuation WHERE tenant_id=${tenant}::uuid) roots,(SELECT count(*)::int FROM india_gst_accommodation_valuation_source WHERE tenant_id=${tenant}::uuid) sources,(SELECT count(*)::int FROM india_gst_accommodation_valuation_room_night WHERE tenant_id=${tenant}::uuid) nights,(SELECT count(*)::int FROM india_gst_accommodation_valuation_allocation WHERE tenant_id=${tenant}::uuid) allocations,(SELECT count(*)::int FROM fact_log WHERE tenant_id=${tenant}::uuid AND entity_type='india_gst_accommodation_final_valuation') facts,(SELECT count(*)::int FROM outbox WHERE tenant_id=${tenant}::uuid AND event_type='india_gst.accommodation_final_valuation_recorded') events`;
      expect(counts).toEqual({roots:1,sources:1,nights:1,allocations:1,facts:1,events:1});
      await connection.unsafe("SAVEPOINT immutable_probe");
      try{await connection.unsafe(`UPDATE india_gst_accommodation_final_valuation SET evidence_hash='${h("f")}' WHERE tenant_id='${tenant}'::uuid`);}catch{await connection.unsafe("ROLLBACK TO SAVEPOINT immutable_probe");}
      const [immutable]=await connection<Array<{evidence_hash:string}>>`SELECT evidence_hash FROM india_gst_accommodation_final_valuation WHERE tenant_id=${tenant}::uuid`;
      expect(immutable!.evidence_hash).toBe(h("e"));
    }finally{
      await connection.unsafe("ROLLBACK").catch(()=>undefined);
      connection.release();
    }
  },30_000);
});
