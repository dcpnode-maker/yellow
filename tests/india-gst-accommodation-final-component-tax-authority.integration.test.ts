import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
  IndiaGstAccommodationFinalComponentTaxService,
  IndiaGstAccommodationQuotedRateApplicabilityService,
} from "../src/contexts/tax-fiscal";

const url = process.env.YELLOW_ORDER360_DATABASE_URL;
const run = url ? describe : describe.skip;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const T=id(36001), P=id(36002), R=id(36003), F=id(36004), V=id(36005), U=id(36006);
const h=(x:string)=>x.repeat(64);
const freeze=<TValue>(value:TValue,seen=new Set<object>()):TValue=>{ if(value&&typeof value==="object"&&!seen.has(value as object)){seen.add(value as object);for(const key of Reflect.ownKeys(value as object))freeze(Reflect.get(value as object,key),seen);Object.freeze(value);}return value;};

const replay=freeze({
  section14:{case:"supply_before_invoice_after_payment_after",timeOfSupplyDate:"2025-09-21",selectedVersionSide:"predecessor",selectedVersion:{extensionId:id(36020),version:1,status:"retired",contentHash:h("a"),effectiveFromInstant:"2020-01-01T00:00:00.000000Z",effectiveToInstant:"2025-09-21T00:00:00.000000Z"}},
  reservationLineage:{lineageId:id(36021),holdBindingId:id(36022),reservationId:R,segmentId:id(36023),folioId:F,attributionId:id(36024),originQuoteHash:h("b"),snapshotHash:h("c"),currency:"INR"},
  components:[{ordinal:"0",businessDate:"2025-09-21",quotedAmountMinor:"700000",slab:{uptoMinor:750000,aggregateRate:0.05,aggregateRateBasisPoints:500,itcEligible:false,components:[{identity:"cgst",rate:0.025,rateBasisPoints:250},{identity:"sgst",rate:0.025,rateBasisPoints:250}]}}],
  predecessorHashes:{section14:h("d"),levyComponentIdentity:h("e"),reservationLineage:h("f"),attributionSnapshot:h("1")},evidenceHash:h("2"),
});
const rate={extensionId:id(36020),version:1,status:"retired",contentHash:h("a"),effectiveFromInstant:"2020-01-01T00:00:00.000000Z",effectiveToInstant:"2025-09-21T00:00:00.000000Z",key:"in-gst-lodging",gstRoomSlabs:[{uptoMinor:750000,rate:0.05,itcEligible:false},{uptoMinor:null,rate:0.18,itcEligible:true}]};
const input=freeze({tenantId:T,propertyNode:P,reservationId:R,folioId:F,quotedRateApplicabilityInput:{tenantId:T,propertyNode:P,reservationId:R,folioId:F,reservationLineageId:id(36021),attributionId:id(36024),section14Input:{rateVersionPair:{predecessor:rate,successor:{...rate,gstRoomSlabs:rate.gstRoomSlabs.map(s=>({...s})),extensionId:id(36025),version:2,status:"active",effectiveFromInstant:"2025-09-21T00:00:00.000000Z",effectiveToInstant:null}},componentIdentityResult:{componentIdentities:["cgst","sgst"]}},section14Result:{},componentIdentityInput:{},componentIdentityResult:{componentIdentities:["cgst","sgst"]}}});

run("Order 360 persisted valuation PostgreSQL authority",()=>{
  const db=new SQL(url!); let original: typeof IndiaGstAccommodationQuotedRateApplicabilityService.prototype.resolve;
  beforeAll(async()=>{
    original=IndiaGstAccommodationQuotedRateApplicabilityService.prototype.resolve;
    IndiaGstAccommodationQuotedRateApplicabilityService.prototype.resolve=async()=>replay as never;
    const setup=await db.reserve();try{
      await setup.unsafe("SET session_replication_role=replica; SET ROLE yellow_owner");
      await setup`SELECT set_config('app.tenant_id',${T},false)`;
      await setup`DELETE FROM india_gst_accommodation_valuation_room_night WHERE tenant_id=${T}::uuid`;
      await setup`DELETE FROM india_gst_accommodation_final_valuation WHERE tenant_id=${T}::uuid`;
      await setup`INSERT INTO tenant(id,slug,name) VALUES(${T}::uuid,'order360','Order360') ON CONFLICT DO NOTHING`;
      await setup`INSERT INTO india_gst_accommodation_final_valuation(tenant_id,id,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,attribution_id,request_id,generation,disposition,currency,transaction_value_minor,source_set_hash,order341_evidence_hash,request_hash,evidence_hash,ordinary_evidence_hashes,manual_reasons,relationship_conclusion,consideration_conclusion,section15_2_conclusion,section15_3_conclusion,source_completeness_conclusion,attestation_evidence_source,attestation_evidence_reference,relationship_set_hash,attested_by,actor_id) VALUES(${T}::uuid,${V}::uuid,${P}::uuid,${R}::uuid,${F}::uuid,${id(36007)}::uuid,1,${id(36008)}::uuid,${id(36024)}::uuid,${id(36009)}::uuid,0,'ordinary_final','INR',700000,${h("3")},${h("2")},${h("4")},${h("5")},ARRAY[${h("6")},${h("7")},${h("8")},${h("9")},${h("a")}],ARRAY[]::text[],'unrelated_not_distinct','money_only','all_additions_enumerated','all_discounts_eligible','all_sources_classified','operator_attestation','ORDER360',${h("b")},${U}::uuid,${U}::uuid)`;
      await setup`INSERT INTO india_gst_accommodation_valuation_room_night(tenant_id,valuation_id,ordinal,business_date,quoted_weight_minor,transaction_value_minor,currency) VALUES(${T}::uuid,${V}::uuid,0,'2025-09-21',700000,700000,'INR')`;
      await setup.unsafe("RESET ROLE; SET session_replication_role=origin");
    }finally{setup.release();}
  });
  afterAll(async()=>{IndiaGstAccommodationQuotedRateApplicabilityService.prototype.resolve=original;await db.close();});

  async function execute(candidate:typeof input=input){
    const connection=await db.reserve();try{await connection.unsafe("BEGIN");await connection`SELECT set_config('app.tenant_id',${candidate.tenantId},true)`;await connection.unsafe("SET LOCAL ROLE app_role");const result=await new IndiaGstAccommodationFinalComponentTaxService().calculate(connection,candidate as never);await connection.unsafe("ROLLBACK");return result;}catch(error){await connection.unsafe("ROLLBACK");throw error;}finally{connection.release();}
  }
  async function owner(sql:string){const connection=await db.reserve();try{await connection.unsafe("SET session_replication_role=replica");await connection`SELECT set_config('app.tenant_id',${T},false)`;await connection.unsafe("SET ROLE yellow_owner");await connection.unsafe(sql);await connection.unsafe("RESET ROLE; SET session_replication_role=origin");}finally{connection.release();}}
  async function withMutation(sql:string,restore:string){
    await owner(sql);try{await expect(execute()).rejects.toThrow();}finally{await owner(restore);}
  }

  test("derives the exact tax from the unique persisted head and writes nothing",async()=>{
    const before=await db<Array<{facts:number;events:number;valuations:number;nights:number}>>`SELECT (SELECT count(*)::int FROM fact_log WHERE tenant_id=${T}::uuid) facts,(SELECT count(*)::int FROM outbox WHERE tenant_id=${T}::uuid) events,(SELECT count(*)::int FROM india_gst_accommodation_final_valuation WHERE tenant_id=${T}::uuid) valuations,(SELECT count(*)::int FROM india_gst_accommodation_valuation_room_night WHERE tenant_id=${T}::uuid) nights`;
    const actual=await execute();expect(actual).toMatchObject({valuationId:V,generation:0,taxMinor:"35000",grandTotalMinor:"735000"});expect(actual.roomNights[0]?.slab.components.map(c=>c.taxMinor)).toEqual(["17500","17500"]);
    const after=await db<Array<{facts:number;events:number;valuations:number;nights:number}>>`SELECT (SELECT count(*)::int FROM fact_log WHERE tenant_id=${T}::uuid) facts,(SELECT count(*)::int FROM outbox WHERE tenant_id=${T}::uuid) events,(SELECT count(*)::int FROM india_gst_accommodation_final_valuation WHERE tenant_id=${T}::uuid) valuations,(SELECT count(*)::int FROM india_gst_accommodation_valuation_room_night WHERE tenant_id=${T}::uuid) nights`;expect(after).toEqual(before);
  });
  test("fails closed for hash mismatch and incomplete, null, negative or gapped nights",async()=>{
    const restoreNight="DELETE FROM india_gst_accommodation_valuation_room_night WHERE valuation_id='"+V+"'; INSERT INTO india_gst_accommodation_valuation_room_night(tenant_id,valuation_id,ordinal,business_date,quoted_weight_minor,transaction_value_minor,currency) VALUES('"+T+"','"+V+"',0,'2025-09-21',700000,700000,'INR')";
    const mutations:[[string,string],[string,string],[string,string],[string,string],[string,string]]=[["UPDATE india_gst_accommodation_final_valuation SET order341_evidence_hash='"+h("c")+"' WHERE id='"+V+"'","UPDATE india_gst_accommodation_final_valuation SET order341_evidence_hash='"+h("2")+"' WHERE id='"+V+"'"],["DELETE FROM india_gst_accommodation_valuation_room_night WHERE valuation_id='"+V+"'",restoreNight],["UPDATE india_gst_accommodation_valuation_room_night SET transaction_value_minor=NULL WHERE valuation_id='"+V+"'",restoreNight],["UPDATE india_gst_accommodation_valuation_room_night SET transaction_value_minor=-1 WHERE valuation_id='"+V+"'",restoreNight],["UPDATE india_gst_accommodation_valuation_room_night SET ordinal=1 WHERE valuation_id='"+V+"'",restoreNight]];
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
