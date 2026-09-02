import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
  IndiaGstAccommodationFinalComponentTaxService,
  IndiaGstAccommodationQuotedRateApplicabilityService,
} from "../src/contexts/tax-fiscal";
import { fixture, TENANT, PROPERTY, RESERVATION, FOLIO, LINEAGE, HOLD, ATTRIBUTION, SEGMENT, SELLABLE } from "./india-gst-accommodation-quoted-rate-applicability.test";

const url = process.env.YELLOW_ORDER360_DATABASE_URL;
const run = url ? describe : describe.skip;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const T=TENANT, P=PROPERTY, R=RESERVATION, F=FOLIO, V=id(36005), U=id(36006);
const h=(x:string)=>x.repeat(64);
const freeze=<TValue>(value:TValue,seen=new Set<object>()):TValue=>{ if(value&&typeof value==="object"&&!seen.has(value as object)){seen.add(value as object);for(const key of Reflect.ownKeys(value as object))freeze(Reflect.get(value as object,key),seen);Object.freeze(value);}return value;};

const replay=freeze({
  section14:{case:"supply_before_invoice_after_payment_after",timeOfSupplyDate:"2025-09-21",selectedVersionSide:"predecessor",selectedVersion:{extensionId:id(36020),version:1,status:"retired",contentHash:h("a"),effectiveFromInstant:"2020-01-01T00:00:00.000000Z",effectiveToInstant:"2025-09-21T00:00:00.000000Z"}},
  reservationLineage:{lineageId:id(36021),holdBindingId:id(36022),reservationId:R,segmentId:id(36023),folioId:F,attributionId:id(36024),originQuoteHash:h("b"),snapshotHash:h("c"),currency:"INR"},
  components:[{ordinal:"0",businessDate:"2025-09-21",quotedAmountMinor:"700000",slab:{uptoMinor:750000,aggregateRate:0.05,aggregateRateBasisPoints:500,itcEligible:false,components:[{identity:"cgst",rate:0.025,rateBasisPoints:250},{identity:"sgst",rate:0.025,rateBasisPoints:250}]}}],
  predecessorHashes:{section14:h("d"),levyComponentIdentity:h("e"),reservationLineage:h("f"),attributionSnapshot:h("1")},evidenceHash:h("2"),
});
const rate={extensionId:id(36020),version:1,status:"retired",contentHash:h("a"),effectiveFromInstant:"2020-01-01T00:00:00.000000Z",effectiveToInstant:"2025-09-21T00:00:00.000000Z",key:"in-gst-lodging",gstRoomSlabs:[{uptoMinor:750000,rate:0.05,itcEligible:false},{uptoMinor:null,rate:0.18,itcEligible:true}]};
let input:any, igstInput:any, utgstInput:any, order341Hash="", igstHash="", utgstHash="";

run("Order 360 persisted valuation PostgreSQL authority",()=>{
  const db=new SQL(url!);
  beforeAll(async()=>{
    const built=await fixture("cgst_sgst","2025-09-21","2025-09-23","2025-09-24","2025-09-24",[700000n,800000n]);
    const igst=await fixture("igst","2025-09-21","2025-09-23","2025-09-24","2025-09-24",[700000n,800000n]);
    const utgst=await fixture("cgst_utgst","2025-09-21","2025-09-23","2025-09-24","2025-09-24",[700000n,800000n]);
    input=freeze({tenantId:T,propertyNode:P,reservationId:R,folioId:F,quotedRateApplicabilityInput:built.input});
    igstInput=freeze({tenantId:T,propertyNode:P,reservationId:R,folioId:F,quotedRateApplicabilityInput:igst.input});
    utgstInput=freeze({tenantId:T,propertyNode:P,reservationId:R,folioId:F,quotedRateApplicabilityInput:utgst.input});
    const setup=await db.reserve();try{
      await setup.unsafe("SET session_replication_role=replica; SET ROLE yellow_owner");
      await setup`SELECT set_config('app.tenant_id',${T},false)`;
      await setup`DELETE FROM india_gst_accommodation_valuation_room_night WHERE tenant_id=${T}::uuid`;
      await setup`DELETE FROM india_gst_accommodation_final_valuation WHERE tenant_id=${T}::uuid`;
      await setup`INSERT INTO tenant(id,slug,name) VALUES(${T}::uuid,'order360','Order360') ON CONFLICT DO NOTHING`;
      const buyer=id(36040),account=id(36041),unitType=id(36042),ratePlan=id(36043), snapshot=(built.rows as any).attribution;
      await setup`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES(${P}::uuid,${T}::uuid,'order360'::ltree,'property','Order360','Asia/Kolkata','INR')`;
      await setup`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(${U}::uuid,${T}::uuid,'order360@example.test','Order360','active')`;
      await setup`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(${buyer}::uuid,${T}::uuid,'person','Buyer','active')`;
      await setup`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES(${unitType}::uuid,${T}::uuid,${P}::uuid,'O361','Room','hotel',2)`;
      await setup`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES(${SELLABLE}::uuid,${T}::uuid,${unitType}::uuid,'Room 1','active')`;
      await setup`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status) VALUES(${ratePlan}::uuid,${T}::uuid,${P}::uuid,'O361','Rate','INR',false,'active')`;
      await setup`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,currency) VALUES(${R}::uuid,${T}::uuid,${P}::uuid,'O361','reserved',${buyer}::uuid,'INR')`;
      await setup`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status) VALUES(${SEGMENT}::uuid,${T}::uuid,${R}::uuid,1,${unitType}::uuid,${SELLABLE}::uuid,${(built.rows as any).persisted.segment_period}::tstzrange,1,'[]'::jsonb,${ratePlan}::uuid,'booked')`;
      await setup`INSERT INTO hold(id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status) VALUES(${HOLD}::uuid,${T}::uuid,${P}::uuid,${SELLABLE}::uuid,${(built.rows as any).persisted.hold_period}::tstzrange,'cart','{}'::jsonb,'2030-01-01','consumed')`;
      await setup`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES(${account}::uuid,${T}::uuid,${P}::uuid,'guest',${buyer}::uuid,'Guest','INR','open')`;
      await setup`INSERT INTO folio(id,tenant_id,account_id,reservation_id,window_no,status) VALUES(${F}::uuid,${T}::uuid,${account}::uuid,${R}::uuid,1,'open')`;
      await setup`INSERT INTO tax_attribution_snapshot(tenant_id,id,property_node,actor_id,schema_version,origin_kind,origin_quote_hash,snapshot_hash,currency,snapshot) VALUES(${T}::uuid,${ATTRIBUTION}::uuid,${P}::uuid,${U}::uuid,1,'rate_quote',${(built.rows as any).persisted.origin_quote_hash},${(built.rows as any).persisted.snapshot_hash},'INR',${snapshot}::jsonb)`;
      await setup`INSERT INTO tax_attribution_hold_binding(tenant_id,id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES(${T}::uuid,${HOLD}::uuid,${P}::uuid,${U}::uuid,${HOLD}::uuid,${ATTRIBUTION}::uuid,${SELLABLE}::uuid,${(built.rows as any).persisted.binding_period}::tstzrange,${(built.rows as any).persisted.origin_quote_hash},${(built.rows as any).persisted.snapshot_hash},'INR')`;
      await setup`INSERT INTO tax_attribution_reservation_binding(tenant_id,id,property_node,linked_by,binding_id,hold_id,attribution_id,reservation_id,segment_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES(${T}::uuid,${LINEAGE}::uuid,${P}::uuid,${U}::uuid,${HOLD}::uuid,${HOLD}::uuid,${ATTRIBUTION}::uuid,${R}::uuid,${SEGMENT}::uuid,${SELLABLE}::uuid,${(built.rows as any).persisted.lineage_period}::tstzrange,${(built.rows as any).persisted.origin_quote_hash},${(built.rows as any).persisted.snapshot_hash},'INR')`;
      const service=(built.rows as any).service,payment=(built.rows as any).payment,invoice=(built.rows as any).invoice;
      await setup`INSERT INTO india_gst_accommodation_service_provision_snapshot(tenant_id,id,property_node,reservation_lineage_id,hold_binding_id,attribution_id,reservation_id,segment_id,origin_quote_hash,snapshot_hash,currency,service_provision_date,service_provision_source,service_provision_evidence_sha256,legal_rule) VALUES(${T}::uuid,${service.id}::uuid,${P}::uuid,${LINEAGE}::uuid,${HOLD}::uuid,${ATTRIBUTION}::uuid,${R}::uuid,${SEGMENT}::uuid,${service.origin_quote_hash},${service.snapshot_hash},'INR',${service.service_provision_date}::date,${service.service_provision_source},${service.service_provision_evidence_sha256},${service.legal_rule})`;
      await setup`INSERT INTO india_gst_accommodation_payment_receipt_snapshot(tenant_id,id,service_provision_snapshot_id,currency,amount_minor,coverage_scope,supplier_books_entry_date,supplier_bank_credit_date,payment_receipt_date,payment_receipt_source,payment_receipt_evidence_sha256,legal_rule) VALUES(${T}::uuid,${payment.id}::uuid,${service.id}::uuid,'INR',${payment.amount_minor},${payment.coverage_scope},${payment.supplier_books_entry_date}::date,${payment.supplier_bank_credit_date}::date,${payment.payment_receipt_date}::date,${payment.payment_receipt_source},${payment.payment_receipt_evidence_sha256},${payment.legal_rule})`;
      await setup`INSERT INTO india_gst_accommodation_invoice_issue_snapshot(tenant_id,id,service_provision_snapshot_id,currency,amount_minor,coverage_scope,invoice_series,invoice_serial,invoice_issue_date,invoice_issue_source,invoice_issue_evidence_sha256,legal_rule) VALUES(${T}::uuid,${invoice.id}::uuid,${service.id}::uuid,'INR',${invoice.amount_minor},${invoice.coverage_scope},${invoice.invoice_series},${invoice.invoice_serial},${invoice.invoice_issue_date}::date,${invoice.invoice_issue_source},${invoice.invoice_issue_evidence_sha256},${invoice.legal_rule})`;
      order341Hash=(await new IndiaGstAccommodationQuotedRateApplicabilityService().resolve(setup,input.quotedRateApplicabilityInput)).evidenceHash;
      igstHash=(await new IndiaGstAccommodationQuotedRateApplicabilityService().resolve(setup,igstInput.quotedRateApplicabilityInput)).evidenceHash;
      utgstHash=(await new IndiaGstAccommodationQuotedRateApplicabilityService().resolve(setup,utgstInput.quotedRateApplicabilityInput)).evidenceHash;
      await setup`INSERT INTO india_gst_accommodation_final_valuation(tenant_id,id,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,attribution_id,request_id,generation,disposition,currency,transaction_value_minor,source_set_hash,order341_evidence_hash,request_hash,evidence_hash,ordinary_evidence_hashes,manual_reasons,relationship_conclusion,consideration_conclusion,section15_2_conclusion,section15_3_conclusion,source_completeness_conclusion,attestation_evidence_source,attestation_evidence_reference,relationship_set_hash,attested_by,actor_id) VALUES(${T}::uuid,${V}::uuid,${P}::uuid,${R}::uuid,${F}::uuid,${id(36007)}::uuid,1,${id(36008)}::uuid,${id(36024)}::uuid,${id(36009)}::uuid,0,'ordinary_final','INR',1500000,${h("3")},${order341Hash},${h("4")},${h("5")},ARRAY[${h("6")},${h("7")},${h("8")},${h("9")},${h("a")}],ARRAY[]::text[],'unrelated_not_distinct','money_only','all_additions_enumerated','all_discounts_eligible','all_sources_classified','operator_attestation','ORDER360',${h("b")},${U}::uuid,${U}::uuid)`;
      await setup`INSERT INTO india_gst_accommodation_valuation_room_night(tenant_id,valuation_id,ordinal,business_date,quoted_weight_minor,transaction_value_minor,currency) VALUES(${T}::uuid,${V}::uuid,0,'2025-09-21',700000,700000,'INR'),(${T}::uuid,${V}::uuid,1,'2025-09-22',800000,800000,'INR')`;
      await setup.unsafe("RESET ROLE; SET session_replication_role=origin");
    }finally{setup.release();}
  });
  afterAll(async()=>{await db.close();});

  async function execute(candidate:typeof input=input){
    const connection=await db.reserve();try{await connection.unsafe("BEGIN");await connection`SELECT set_config('app.tenant_id',${candidate.tenantId},true)`;await connection.unsafe("SET LOCAL ROLE app_role");const result=await new IndiaGstAccommodationFinalComponentTaxService().calculate(connection,candidate as never);await connection.unsafe("ROLLBACK");return result;}catch(error){await connection.unsafe("ROLLBACK");throw error;}finally{connection.release();}
  }
  async function owner(sql:string){const connection=await db.reserve();try{await connection.unsafe("SET session_replication_role=replica");await connection`SELECT set_config('app.tenant_id',${T},false)`;await connection.unsafe("SET ROLE yellow_owner");await connection.unsafe(sql);}finally{try{await connection.unsafe("RESET ROLE; SET session_replication_role=origin");}catch{}connection.release();}}
  async function withMutation(sql:string,restore:string){
    await owner(sql);try{await expect(execute()).rejects.toThrow();}finally{await owner(restore);}
  }

  test("derives the exact tax from the unique persisted head and writes nothing",async()=>{
    const census=()=>db<Array<Record<string,number>>>`SELECT (SELECT count(*)::int FROM fact_log WHERE tenant_id=${T}::uuid) facts,(SELECT count(*)::int FROM outbox WHERE tenant_id=${T}::uuid) events,(SELECT count(*)::int FROM india_gst_accommodation_final_valuation WHERE tenant_id=${T}::uuid) valuations,(SELECT count(*)::int FROM india_gst_accommodation_valuation_room_night WHERE tenant_id=${T}::uuid) nights,(SELECT count(*)::int FROM document WHERE tenant_id=${T}::uuid) documents,(SELECT count(*)::int FROM fiscal_submission WHERE tenant_id=${T}::uuid) fiscal,(SELECT count(*)::int FROM journal WHERE tenant_id=${T}::uuid) journals,(SELECT count(*)::int FROM posting_line WHERE tenant_id=${T}::uuid) postings`;
    const before=await census();const actual=await execute();expect(actual).toMatchObject({valuationId:V,generation:0,taxMinor:"179000",grandTotalMinor:"1679000"});expect(actual.roomNights.map(n=>n.slab.components.map(c=>c.taxMinor))).toEqual([["17500","17500"],["72000","72000"]]);expect(Object.isFrozen(actual)).toBeTrue();expect(Object.isFrozen(actual.roomNights)).toBeTrue();expect(Object.isFrozen(actual.roomNights[0]!.slab.components)).toBeTrue();
    expect(await census()).toEqual(before);
  });
  test("persists every component family, exact threshold, half-up fractions and overflow hostility",async()=>{
    const restore="UPDATE india_gst_accommodation_final_valuation SET transaction_value_minor=1500000,order341_evidence_hash='"+order341Hash+"' WHERE id='"+V+"'; DELETE FROM india_gst_accommodation_valuation_room_night WHERE valuation_id='"+V+"'; INSERT INTO india_gst_accommodation_valuation_room_night(tenant_id,valuation_id,ordinal,business_date,quoted_weight_minor,transaction_value_minor,currency) VALUES('"+T+"','"+V+"',0,'2025-09-21',700000,700000,'INR'),('"+T+"','"+V+"',1,'2025-09-22',800000,800000,'INR')";
    const persist=async(hashValue:string,a:string,b:string,total:string)=>owner("UPDATE india_gst_accommodation_final_valuation SET transaction_value_minor="+total+",order341_evidence_hash='"+hashValue+"' WHERE id='"+V+"'; DELETE FROM india_gst_accommodation_valuation_room_night WHERE valuation_id='"+V+"'; INSERT INTO india_gst_accommodation_valuation_room_night(tenant_id,valuation_id,ordinal,business_date,quoted_weight_minor,transaction_value_minor,currency) VALUES('"+T+"','"+V+"',0,'2025-09-21',1,"+a+",'INR'),('"+T+"','"+V+"',1,'2025-09-22',1,"+b+",'INR')");
    try{
      await persist(igstHash,"700000","800000","1500000");const igst=await execute(igstInput);expect(igst.roomNights.map(n=>n.slab.components.map(c=>c.identity))).toEqual([["igst"],["igst"]]);expect(igst.taxMinor).toBe("179000");
      await persist(utgstHash,"700000","800000","1500000");const utgst=await execute(utgstInput);expect(utgst.roomNights[0]!.slab.components.map(c=>c.identity)).toEqual(["cgst","utgst"]);
      await persist(order341Hash,"750000","750000","1500000");const threshold=await execute();expect(threshold.roomNights.every(n=>n.slab.uptoMinor===750000)).toBeTrue();
      await persist(order341Hash,"100","1499900","1500000");const half=await execute();expect(half.roomNights[0]!.slab.components.map(c=>c.taxMinor)).toEqual(["3","3"]);
      await persist(order341Hash,"101","1499899","1500000");const fractional=await execute();expect(fractional.roomNights[0]!.slab.components.map(c=>c.taxMinor)).toEqual(["3","3"]);
      await persist(order341Hash,"1","9223372036854775806","9223372036854775807");await expect(execute()).rejects.toThrow("signed int64");
    }finally{await owner(restore);}
  },30000);
  test("database constraints prevent a second current ordinary head",async()=>{
    const duplicate=id(36050);
    await expect(owner("INSERT INTO india_gst_accommodation_final_valuation SELECT tenant_id,'"+duplicate+"',property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,attribution_id,'"+id(36051)+"',generation,disposition,currency,transaction_value_minor,source_set_hash,order341_evidence_hash,'"+h("d")+"','"+h("e")+"',ordinary_evidence_hashes,manual_reasons,relationship_conclusion,consideration_conclusion,section15_2_conclusion,section15_3_conclusion,source_completeness_conclusion,attestation_evidence_source,attestation_evidence_reference,relationship_set_hash,attested_by,attested_at,NULL,NULL,actor_id,recorded_at FROM india_gst_accommodation_final_valuation WHERE id='"+V+"'")).rejects.toThrow();
    expect(await execute()).toMatchObject({valuationId:V});
  });
  test("fails closed for hash mismatch and incomplete, null, negative or gapped nights",async()=>{
    const restoreNight="DELETE FROM india_gst_accommodation_valuation_room_night WHERE valuation_id='"+V+"'; INSERT INTO india_gst_accommodation_valuation_room_night(tenant_id,valuation_id,ordinal,business_date,quoted_weight_minor,transaction_value_minor,currency) VALUES('"+T+"','"+V+"',0,'2025-09-21',700000,700000,'INR'),('"+T+"','"+V+"',1,'2025-09-22',800000,800000,'INR')";
    const mutations:[[string,string],[string,string],[string,string],[string,string],[string,string]]=[["UPDATE india_gst_accommodation_final_valuation SET order341_evidence_hash='"+h("c")+"' WHERE id='"+V+"'","UPDATE india_gst_accommodation_final_valuation SET order341_evidence_hash='"+order341Hash+"' WHERE id='"+V+"'"],["DELETE FROM india_gst_accommodation_valuation_room_night WHERE valuation_id='"+V+"'",restoreNight],["UPDATE india_gst_accommodation_valuation_room_night SET transaction_value_minor=NULL WHERE valuation_id='"+V+"'",restoreNight],["UPDATE india_gst_accommodation_valuation_room_night SET transaction_value_minor=-1 WHERE valuation_id='"+V+"'",restoreNight],["DELETE FROM india_gst_accommodation_valuation_room_night WHERE valuation_id='"+V+"' AND ordinal=0; UPDATE india_gst_accommodation_valuation_room_night SET ordinal=2 WHERE valuation_id='"+V+"' AND ordinal=1",restoreNight]];
    for(const [mutation,restore] of mutations)await withMutation(mutation,restore);
  },30000);
  test("fails closed for missing, manual, superseded and foreign property scope heads",async()=>{
    const foreign=structuredClone(input) as any;foreign.tenantId=id(36998);foreign.quotedRateApplicabilityInput.tenantId=id(36998);await expect(execute(freeze(foreign))).rejects.toThrow();
    await withMutation("UPDATE india_gst_accommodation_final_valuation SET property_node='"+id(36999)+"' WHERE id='"+V+"'","UPDATE india_gst_accommodation_final_valuation SET property_node='"+P+"' WHERE id='"+V+"'");
    const successor=id(36030);
    await withMutation("INSERT INTO india_gst_accommodation_final_valuation SELECT tenant_id,'"+successor+"',property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,attribution_id,'"+id(36031)+"',1,'manual_valuation_required',currency,NULL,source_set_hash,order341_evidence_hash,'"+h("c")+"','"+h("d")+"','{}','{related_person}',NULL,NULL,NULL,NULL,NULL,NULL,NULL,relationship_set_hash,attested_by,attested_at,NULL,'"+V+"',actor_id,recorded_at FROM india_gst_accommodation_final_valuation WHERE id='"+V+"'","DELETE FROM india_gst_accommodation_final_valuation WHERE id='"+successor+"'");
    await withMutation("UPDATE india_gst_accommodation_final_valuation SET disposition='manual_valuation_required',transaction_value_minor=NULL,ordinary_evidence_hashes='{}',manual_reasons='{related_person}',relationship_conclusion=NULL,consideration_conclusion=NULL,section15_2_conclusion=NULL,section15_3_conclusion=NULL,source_completeness_conclusion=NULL,attestation_evidence_source=NULL,attestation_evidence_reference=NULL WHERE id='"+V+"'","UPDATE india_gst_accommodation_final_valuation SET disposition='ordinary_final',transaction_value_minor=700000,ordinary_evidence_hashes=ARRAY['"+h("6")+"','"+h("7")+"','"+h("8")+"','"+h("9")+"','"+h("a")+"'],manual_reasons='{}',relationship_conclusion='unrelated_not_distinct',consideration_conclusion='money_only',section15_2_conclusion='all_additions_enumerated',section15_3_conclusion='all_discounts_eligible',source_completeness_conclusion='all_sources_classified',attestation_evidence_source='operator_attestation',attestation_evidence_reference='ORDER360' WHERE id='"+V+"'");
  },30000);
});
