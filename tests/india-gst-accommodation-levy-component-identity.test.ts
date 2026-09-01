import { describe, expect, test } from "bun:test";
import { IndiaGstAccommodationHistoricalResolutionService, buildIndiaGstAccommodationSupplyNature, deriveIndiaGstAccommodationComponentFamily, deriveIndiaGstAccommodationLevyComponentIdentity, deriveIndiaGstAccommodationLevyComponentRateSchedule, deriveIndiaGstAccommodationLevyInputBundle } from "../src/contexts/tax-fiscal";

type Mutable = Record<PropertyKey, any>;
type Family = "igst" | "cgst_sgst" | "cgst_utgst";
const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
const TENANT=id(31001),OTHER=id(31002),PROPERTY=id(31003),RESERVATION=id(31004),FOLIO=id(31005),SUPPLIER=id(31006),RECIPIENT=id(31007),RECIPIENT_REG=id(31008),SERVICE=id(31009),SUPPLIER_STATUS=id(31010),RECIPIENT_STATUS=id(31011),CLASSIFICATION=id(31012);
const PREDECESSOR="a806f516-fed6-5768-b310-94aa03286adb",SUCCESSOR="0b21daf2-ea6e-5568-9c21-69e4d4424574",KEY="in-gst-lodging",CUTOVER="2025-09-21T18:30:00.000000Z",PRE_FROM="2022-07-17T18:30:00.000000Z";
const content=(lower:0.12|0.05,itc:boolean)=>({country:"IN",price_display:"tax_exclusive",rounding:"document",taxes:[{code:"GST_ROOM",name:"GST on accommodation",mode:"slab_percent",slab_basis:"transaction_value",applies_to:["room_revenue"],slabs:[{upto_minor:750000,rate:lower,itc_eligible:itc},{upto_minor:null,rate:0.18,itc_eligible:true}]},{code:"GST_FNB",name:"GST on F&B",mode:"percent",rate:0.05,applies_to:["fnb_revenue"]}]});
const extension=(extensionId:string,version:number,status:string,body:unknown)=>({id:extensionId,tenantId:null,type:"tax_jurisdiction",key:KEY,version,content:body,status});
function canonical(value:any):string{if(value===null||typeof value!=="object")return JSON.stringify(Object.is(value,-0)?0:value);if(Array.isArray(value))return`[${value.map(canonical).join(",")}]`;return`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;}
const digestCanonical=(v:unknown)=>new Bun.CryptoHasher("sha256").update(canonical(v)).digest("hex");
const digest=(v:unknown)=>new Bun.CryptoHasher("sha256").update(JSON.stringify(v)).digest("hex");
function freeze<T>(v:T,seen=new Set<object>()):T{if(typeof v!=="object"||v===null||seen.has(v))return v;seen.add(v);for(const k of Reflect.ownKeys(v))freeze((v as Mutable)[k],seen);return Object.freeze(v);}
function deeplyFrozen(v:unknown,seen=new Set<object>()):void{if(typeof v!=="object"||v===null||seen.has(v))return;seen.add(v);expect(Object.isFrozen(v)).toBeTrue();for(const k of Reflect.ownKeys(v))deeplyFrozen((v as Mutable)[k],seen);}

async function historical(day:"2025-09-21"|"2025-09-22"="2025-09-22"){
  const old=day==="2025-09-21";
  const state={property:{tenant_id:TENANT,property_timezone:"Asia/Kolkata",business_day_from_instant:old?"2025-09-20T18:30:00.000000Z":CUTOVER,business_day_to_instant:old?CUTOVER:"2025-09-22T18:30:00.000000Z"},assignments:[{jurisdiction_key:KEY,effective_from:"2020-01-01",effective_to:null}],visible:[extension(PREDECESSOR,1,"retired",content(0.12,true)),extension(SUCCESSOR,2,"active",content(0.05,false))],periods:{[PREDECESSOR]:{extensionId:PREDECESSOR,ownerTenantId:null,effectiveFromInstant:PRE_FROM,effectiveToInstant:CUTOVER},[SUCCESSOR]:{extensionId:SUCCESSOR,ownerTenantId:null,effectiveFromInstant:CUTOVER,effectiveToInstant:null}} as Mutable};
  const tx=(async(strings:TemplateStringsArray)=>{const sql=strings.join("?");if(/FROM\s+(?:public\.)?org_node/i.test(sql))return/property_timezone/i.test(sql)?[state.property]:[{tenant_id:TENANT}];if(/FROM\s+(?:public\.)?tax_assignment/i.test(sql))return state.assignments;throw new Error(`unexpected SQL: ${sql}`);}) as never;
  const registry={async listVisible(t:string){expect(t).toBe(TENANT);return state.visible;},async readVisibleEffectivePeriod(t:string,e:string){expect(t).toBe(TENANT);return state.periods[e];}};
  return new IndiaGstAccommodationHistoricalResolutionService(registry).resolve(tx,{propertyNode:PROPERTY,businessDate:day});
}
function status(kind:"supplier"|"recipient",date:string,serviceHash="6".repeat(64)){
  const body=kind==="supplier"?{supplierSezStatusId:SUPPLIER_STATUS,propertyNode:PROPERTY,supplierServiceLocation:freeze({id:SERVICE,evidenceHash:serviceHash}),supplier:freeze({registrationId:SUPPLIER,evidenceHash:"b".repeat(64)}),statusAsOf:date,gstRegistration:freeze({status:"active",taxpayerType:"regular",source:"gst_common_portal",evidenceSha256:"5".repeat(64)}),sezStatus:"affirmatively_non_sez_regular",approval:null,legalRule:"IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS"}:{recipientSezStatusId:RECIPIENT_STATUS,recipient:freeze({partyId:RECIPIENT,registrationId:RECIPIENT_REG,evidenceHash:"c".repeat(64)}),statusAsOf:date,gstRegistration:freeze({status:"active",taxpayerType:"regular",source:"gst_common_portal",evidenceSha256:"4".repeat(64)}),sezStatus:"affirmatively_non_sez_regular",approval:null,legalRule:"IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS"};
  return freeze({...body,evidenceHash:digest({tenantId:TENANT,...body})});
}
function nature(history:Mutable,family:Family):Mutable{
  const selected=history.selectedExtension,state=family==="cgst_utgst"?"04":"27",pos=family==="igst"?"29":state;
  const jurisdiction=()=>freeze({extensionId:selected.extensionId,ownerTenantId:TENANT,key:selected.key,version:String(selected.version),contentHash:selected.contentHash});
  const comparisonBody=freeze({propertyNode:PROPERTY,reservationId:RESERVATION,folioId:FOLIO,jurisdiction:jurisdiction(),supplier:freeze({registrationId:SUPPLIER,evidenceHash:"b".repeat(64),stateCode:state}),recipient:freeze({partyId:RECIPIENT,registrationId:RECIPIENT_REG,evidenceHash:"c".repeat(64)}),buyerAssociation:freeze({associationHash:"d".repeat(64),payloadHash:"e".repeat(64)}),classification:freeze({classificationId:CLASSIFICATION,evidenceHash:"f".repeat(64)}),placeOfSupply:freeze({candidateHash:"1".repeat(64),legalRule:"IGST_ACT_12_3_B",pos}),comparisonRule:"SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS",stateRelationship:family==="igst"?"different_state_or_union_territory":"same_state_or_union_territory"});
  const comparison=freeze({...comparisonBody,candidateJson:JSON.stringify(comparisonBody),candidateHash:digest({tenantId:TENANT,candidate:comparisonBody})});
  const serviceBody={supplierServiceLocationId:SERVICE,propertyNode:PROPERTY,jurisdiction:jurisdiction(),supplier:freeze({registrationId:SUPPLIER,evidenceHash:"b".repeat(64)}),serviceScope:"lodging_accommodation",registeredPlace:freeze({kind:"principal_place_of_business",stateCode:state,addressLine:"1 Marine Drive",locality:"Mumbai",postalCode:"400001"}),locationBasis:"supply_made_from_registered_place_of_business",legalRule:"IGST_ACT_2_15_A"};
  const serviceLocation=freeze({...serviceBody,evidenceHash:digest({tenantId:TENANT,...serviceBody})});
  return buildIndiaGstAccommodationSupplyNature({tenantId:TENANT,supplyDate:history.businessDay.businessDate,registeredStateComparison:comparison,supplierServiceLocation:serviceLocation,recipientSezStatus:status("recipient",history.businessDay.businessDate),supplierSezStatus:status("supplier",history.businessDay.businessDate,serviceLocation.evidenceHash)} as never) as Mutable;
}
function complete(history:Mutable,familyName:Family,tenantId=TENANT){const supplyNature=nature(history,familyName);const componentFamily=deriveIndiaGstAccommodationComponentFamily({tenantId:TENANT,supplyNature} as never) as Mutable;const bundleInput={tenantId:TENANT,historicalResolution:history,supplyNature,componentFamily};const levyInputBundle=deriveIndiaGstAccommodationLevyInputBundle(bundleInput as never) as Mutable;return{tenantId,historicalResolution:history,supplyNature,componentFamily,levyInputBundle};}
const derive=(v:unknown)=>deriveIndiaGstAccommodationLevyComponentIdentity(v as never) as Mutable;
const deriveRates=(v:unknown)=>deriveIndiaGstAccommodationLevyComponentRateSchedule(v as never) as Mutable;
const reject=(v:unknown)=>expect(()=>derive(v)).toThrow();
function rehashBundle(v:Mutable,tenantId=TENANT):void{const{evidenceHash:_old,...body}=v;v.evidenceHash=digestCanonical({tenantId,...body});}

describe("Order 310: India GST accommodation levy-component identity",()=>{
  test("maps every family to the exact ordered identities and readiness",async()=>{
    const expected={igst:[["igst"],"sole_component_aggregate_schedule"],cgst_sgst:[["cgst","sgst"],"numeric_component_split_authority_required"],cgst_utgst:[["cgst","utgst"],"numeric_component_split_authority_required"]} as const;
    for(const family of ["igst","cgst_sgst","cgst_utgst"] as const){const actual=derive(complete(await historical() as Mutable,family));expect(actual.componentIdentities).toEqual(expected[family][0]);expect(actual.readiness).toBe(expected[family][1]);}
  });

  test("rederives complete Order309 ancestry and requires byte-exact bundle equality",async()=>{
    const history=await historical() as Mutable;
    for(const family of ["igst","cgst_sgst","cgst_utgst"] as const){const valid=complete(history,family);expect(()=>derive(valid)).not.toThrow();const reordered=structuredClone(valid.levyInputBundle) as Mutable;const{evidenceHash:_hash,propertyNode,...rest}=reordered;const body={...rest,propertyNode};const candidate={...body,evidenceHash:digestCanonical({tenantId:TENANT,...body})};expect(JSON.stringify(candidate)).not.toBe(JSON.stringify(valid.levyInputBundle));reject({...valid,levyInputBundle:freeze(candidate)});}
  });

  test("coherent public rehash cannot relabel family, schedule, version, legal source or predecessor",async()=>{
    const valid=complete(await historical() as Mutable,"igst");
    for(const mutate of [(v:Mutable)=>{v.componentFamily="cgst_sgst";},(v:Mutable)=>{v.gstRoomSlabs[0].rate=0.12;},(v:Mutable)=>{v.selectedVersion.version=1;},(v:Mutable)=>{v.legalSources.componentFamily="CGST_ACT_9_1_AND_SGST_ACT";},(v:Mutable)=>{v.predecessorHashes.componentFamily="9".repeat(64);},(v:Mutable)=>{v.reservationId=id(31991);}]){const bundle=structuredClone(valid.levyInputBundle) as Mutable;mutate(bundle);rehashBundle(bundle);reject({...valid,levyInputBundle:freeze(bundle)});}
    reject({...valid,tenantId:OTHER});
  });

  test("dual families expose no numeric split and preserve the aggregate schedule exactly once",async()=>{
    for(const family of ["cgst_sgst","cgst_utgst"] as const){const valid=complete(await historical() as Mutable,family),actual=derive(valid),text=JSON.stringify(actual);expect(actual.readiness).toBe("numeric_component_split_authority_required");expect(actual.gstRoomSlabs).toEqual(valid.levyInputBundle.gstRoomSlabs);expect(text.match(/gstRoomSlabs/g)).toHaveLength(1);expect(actual.componentIdentities.every((v:unknown)=>typeof v==="string")).toBeTrue();expect(text).not.toMatch(/componentRate|rateBasisPoints|componentAmount|taxMinor|taxableValue|rounding|residual/i);}
  });

  test("accepts exactly five fields and rejects hostile or surplus authority",async()=>{
    const valid=complete(await historical() as Mutable,"cgst_sgst"),hostile:unknown[]=[null,[],new Proxy(valid,{}),{...valid,[Symbol("hostile")]:true}];
    for(const key of Object.keys(valid)){const missing={...valid} as Mutable;delete missing[key];hostile.push(missing);}
    for(const key of ["rate","componentRate","rateBasisPoints","taxableValue","value","amount","taxMinor","taxAmount","rounding","residual","split","section14","posting","document","irp"])hostile.push({...valid,[key]:1});
    const accessor={...valid} as Mutable;Object.defineProperty(accessor,"levyInputBundle",{enumerable:true,get:()=>valid.levyInputBundle});hostile.push(accessor);hostile.push({...valid,levyInputBundle:{...valid.levyInputBundle}});
    const nestedSymbol=structuredClone(valid.levyInputBundle) as Mutable;nestedSymbol.selectedVersion[Symbol("hostile")]=true;hostile.push({...valid,levyInputBundle:freeze(nestedSymbol)});
    const sparse=structuredClone(valid.levyInputBundle) as Mutable;delete sparse.gstRoomSlabs[0];hostile.push({...valid,levyInputBundle:freeze(sparse)});
    for(const candidate of hostile)reject(candidate);
  });

  test("returns the exact frozen tenant-hidden deterministic envelope and hash lineage",async()=>{
    const keys=["propertyNode","reservationId","folioId","supplyDate","selectedVersion","gstRoomSlabs","componentFamily","componentIdentities","readiness","legalSources","predecessorHashes","evidenceHash"];
    for(const day of ["2025-09-21","2025-09-22"] as const){const valid=complete(await historical(day) as Mutable,"igst"),first=derive(valid),second=derive(valid);expect(Object.keys(first)).toEqual(keys);expect(second).toEqual(first);expect(JSON.stringify(second)).toBe(JSON.stringify(first));deeplyFrozen(first);expect(first).not.toHaveProperty("tenantId");expect(JSON.stringify(first)).not.toContain(TENANT);expect(first.predecessorHashes).toEqual({...valid.levyInputBundle.predecessorHashes,levyInputBundle:valid.levyInputBundle.evidenceHash});const{evidenceHash,...body}=first;expect(evidenceHash).toBe(digest({tenantId:TENANT,...body}));expect(evidenceHash).not.toBe(digest(body));expect(evidenceHash).not.toBe(digest({tenantId:OTHER,...body}));expect(first.evidenceHash).toMatch(/^[0-9a-f]{64}$/);}
  });
});

describe("Order 337: India GST accommodation numeric component-rate split",()=>{
  test("derives exact ordered IGST, CGST+SGST and CGST+UTGST component rates",async()=>{
    const expected={igst:[["igst",0.05]],cgst_sgst:[["cgst",0.025],["sgst",0.025]],cgst_utgst:[["cgst",0.025],["utgst",0.025]]} as const;
    for(const family of ["igst","cgst_sgst","cgst_utgst"] as const){const input=complete(await historical() as Mutable,family),componentIdentity=derive(input),actual=deriveRates({...input,componentIdentity});expect(actual.componentRateSlabs[0].components.map((v:Mutable)=>[v.identity,v.rate])).toEqual(expected[family]);expect(actual.componentRateSlabs[0].aggregateRate).toBe(0.05);expect(actual.componentRateSlabs[1].aggregateRate).toBe(0.18);}
  });

  test("preserves historical and active aggregate schedules exactly once while splitting every even rate",async()=>{
    for(const day of ["2025-09-21","2025-09-22"] as const){for(const family of ["igst","cgst_sgst","cgst_utgst"] as const){const input=complete(await historical(day) as Mutable,family),componentIdentity=derive(input),actual=deriveRates({...input,componentIdentity}),text=JSON.stringify(actual);expect(actual.componentRateSlabs.map((v:Mutable)=>({uptoMinor:v.uptoMinor,rate:v.aggregateRate,itcEligible:v.itcEligible}))).toEqual(input.levyInputBundle.gstRoomSlabs);for(const slab of actual.componentRateSlabs){expect(slab.components.reduce((sum:number,v:Mutable)=>sum+v.rateBasisPoints,0)).toBe(slab.aggregateRateBasisPoints);}expect(text.match(/componentRateSlabs/g)).toHaveLength(1);expect(text).not.toMatch(/taxableValue|taxMinor|taxAmount|rounding|residual|posting|document|irp/i);}}
  });

  test("replays complete Order310 ancestry and rejects coherent supplied-result mutations",async()=>{
    const input=complete(await historical() as Mutable,"cgst_sgst"),componentIdentity=derive(input);expect(()=>deriveRates({...input,componentIdentity})).not.toThrow();
    for(const mutate of [(v:Mutable)=>{v.componentIdentities=["sgst","cgst"];},(v:Mutable)=>{v.readiness="sole_component_aggregate_schedule";},(v:Mutable)=>{v.gstRoomSlabs[0].rate=0.12;},(v:Mutable)=>{v.predecessorHashes.levyInputBundle="9".repeat(64);},(v:Mutable)=>{v.evidenceHash="8".repeat(64);}]){const changed=structuredClone(componentIdentity) as Mutable;mutate(changed);freeze(changed);expect(()=>deriveRates({...input,componentIdentity:changed})).toThrow();}
  });

  test("rejects surplus authority and returns frozen tenant-hidden deterministic evidence",async()=>{
    const input=complete(await historical() as Mutable,"cgst_utgst"),componentIdentity=derive(input),valid={...input,componentIdentity},first=deriveRates(valid),second=deriveRates(valid);expect(second).toEqual(first);expect(JSON.stringify(second)).toBe(JSON.stringify(first));deeplyFrozen(first);expect(first).not.toHaveProperty("tenantId");expect(JSON.stringify(first)).not.toContain(TENANT);expect(first.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    for(const key of ["taxableValue","value","amount","taxMinor","taxAmount","rounding","residual","section14","posting","document","irp"]){expect(()=>deriveRates({...valid,[key]:1})).toThrow();}
    expect(()=>deriveRates({...valid,componentIdentity:{...componentIdentity}})).toThrow();expect(()=>deriveRates(new Proxy(valid,{}))).toThrow();
  });
});
