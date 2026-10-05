import { describe, expect, test } from "bun:test";
import { allocateSignedLargestRemainder, IndiaGstAccommodationFinalValuationConflictError, IndiaGstAccommodationFinalValuationNotFoundError, IndiaGstAccommodationFinalValuationService, IndiaGstAccommodationFinalValuationValidationError, IndiaGstAccommodationQuotedRateApplicabilityService, SignedLargestRemainderError } from "../src/contexts/tax-fiscal";

const weights=(...values:string[])=>Object.freeze(values.map((weightMinor,index)=>Object.freeze({ordinal:String(index),weightMinor})));

describe("Order 350 signed largest-remainder allocator",()=>{
  test("allocates both signs with deterministic ordinal residual ties",()=>{
    expect(allocateSignedLargestRemainder("5",weights("1","1","1"))).toEqual([
      {ordinal:"0",amountMinor:"2"},{ordinal:"1",amountMinor:"2"},{ordinal:"2",amountMinor:"1"},
    ]);
    expect(allocateSignedLargestRemainder("-5",weights("1","1","1"))).toEqual([
      {ordinal:"0",amountMinor:"-2"},{ordinal:"1",amountMinor:"-2"},{ordinal:"2",amountMinor:"-1"},
    ]);
  });
  test("uses unequal exact integer weights and preserves input-independent result",()=>{
    const forward=allocateSignedLargestRemainder("101",weights("10","20","70"));
    const reversed=allocateSignedLargestRemainder("101",Object.freeze([...weights("70","20","10")].map((v,i)=>Object.freeze({...v,ordinal:String(2-i)}))));
    expect(forward).toEqual([{ordinal:"0",amountMinor:"10"},{ordinal:"1",amountMinor:"20"},{ordinal:"2",amountMinor:"71"}]);
    expect(reversed).toEqual(forward);
    expect(forward.reduce((sum,row)=>sum+BigInt(row.amountMinor),0n)).toBe(101n);
  });
  test("supports one minor unit, 366 nights and signed-int64 boundary",()=>{
    const many=weights(...Array.from({length:366},()=>"1"));
    expect(allocateSignedLargestRemainder("1",many).filter(v=>v.amountMinor==="1")).toHaveLength(1);
    const edge=allocateSignedLargestRemainder("9223372036854775807",weights("1","2"));
    expect(edge.reduce((sum,row)=>sum+BigInt(row.amountMinor),0n)).toBe(9223372036854775807n);
  });
  test("fails closed on zero, unsafe, duplicate, thawed and non-positive evidence",()=>{
    for(const run of [
      ()=>allocateSignedLargestRemainder("0",weights("1")),
      ()=>allocateSignedLargestRemainder("9223372036854775808",weights("1")),
      ()=>allocateSignedLargestRemainder("1",[{ordinal:"0",weightMinor:"1"}]),
      ()=>allocateSignedLargestRemainder("1",Object.freeze([Object.freeze({ordinal:"0",weightMinor:"0"})])),
      ()=>allocateSignedLargestRemainder("1",Object.freeze([Object.freeze({ordinal:"0",weightMinor:"1"}),Object.freeze({ordinal:"0",weightMinor:"2"})])),
    ]) expect(run).toThrow(SignedLargestRemainderError);
  });
});

const U="00000000-0000-4000-8000-000000000001";
function freeze<T>(value:T):T{if(value&&typeof value==="object"){for(const child of Object.values(value as object))freeze(child);Object.freeze(value);}return value;}
function valuation(overrides:Record<string,unknown>={}){
  return freeze({tenantId:U,propertyNode:U,reservationId:U,folioId:U,buyerPartyId:U,
    quotedRateApplicabilityInput:{},quotedRateApplicabilityResult:{},
    sources:[{postingRootId:U,sourceKind:"room_consideration",additionSubtype:null,discountEligibility:null,evidenceSource:"operator_attestation",evidenceReference:"SOURCE-350"}],
    ordinaryAttestation:{relationshipConclusion:"unrelated_not_distinct",considerationConclusion:"money_only",section152Conclusion:"all_additions_enumerated",section153Conclusion:"all_discounts_eligible",sourceCompletenessConclusion:"all_sources_classified",evidenceSource:"operator_attestation",evidenceReference:"ROOT-350"},
    manualReasons:[],expectedCurrentValuationId:null,expectedCurrentEvidenceHash:null,approvalRequestId:null,idempotencyKey:"order350-proof",
    envelope:{tenantId:U,propertyNode:U,actorId:U,requestId:U,operation:"india_gst.accommodation_final_valuation_recorded"},...overrides} as any);
}
const validator=new IndiaGstAccommodationFinalValuationService({idempotency:{} as any});
describe("Order 354 governed valuation input boundary",()=>{
  test("rejects non-canonical manual vocabulary before database access",async()=>{
    await expect(validator.finalize({} as any,valuation({ordinaryAttestation:null,manualReasons:["operator_choice"]}))).rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationValidationError);
  });
  test("rejects mixed ordinary/manual partitions and surplus source hashes",async()=>{
    await expect(validator.finalize({} as any,valuation({manualReasons:["related_person"]}))).rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationValidationError);
    const source={postingRootId:U,sourceKind:"room_consideration",additionSubtype:null,discountEligibility:null,evidenceSource:"operator_attestation",evidenceReference:"SOURCE-350",classificationHash:"a".repeat(64)};
    await expect(validator.finalize({} as any,valuation({sources:[source]}))).rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationValidationError);
  });
  test("rejects mismatched Section 15 source classifications",async()=>{
    const source={postingRootId:U,sourceKind:"section15_2_addition",additionSubtype:null,discountEligibility:null,evidenceSource:"operator_attestation",evidenceReference:"SOURCE-350"};
    await expect(validator.finalize({} as any,valuation({sources:[source]}))).rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationValidationError);
  });
});

test("Order 357 buyer override is valid only before PostgreSQL transaction-time expiry",async()=>{
  const migration=await Bun.file(new URL("../migrations/0062_india_gst_accommodation_final_valuation.sql",import.meta.url)).text();
  expect(migration).toContain("ar.valid_until > transaction_timestamp()");
});

test("Order 357 service replays exact idempotency and rejects same-key content conflict",async()=>{
  const replay=freeze({evidenceHash:"a".repeat(64),reservationLineage:{reservationId:U,folioId:U},components:[{ordinal:"0",businessDate:"2030-01-01",quotedAmountMinor:"1000"}]}) as any;
  const original=IndiaGstAccommodationQuotedRateApplicabilityService.prototype.resolve;
  IndiaGstAccommodationQuotedRateApplicabilityService.prototype.resolve=async()=>replay;
  let storedRequest="",storedBody:Record<string,unknown>|null=null,executions=0;
  const idempotency={execute:async(_tx:unknown,request:{key:string;request:unknown},work:(tx:unknown)=>Promise<{status:number;body:Record<string,unknown>}> )=>{
    const canonical=JSON.stringify(request.request);
    if(storedBody){if(canonical!==storedRequest)throw new Error("idempotency content conflict");return {status:201,body:storedBody,replayed:true};}
    executions+=1;
    const q=async(strings:TemplateStringsArray)=>strings[0]!.includes("record_india_gst")?[{valuation_id:U,generation:0,disposition:"ordinary_final",transaction_value_minor:"1000",evidence_hash:"b".repeat(64)}]:[{root_id:U,amount_minor:"1000"}];
    const created=await work(q);storedRequest=canonical;storedBody=created.body;return {...created,replayed:false};
  }} as any;
  const input=(reference:string)=>freeze({...valuation(),quotedRateApplicabilityInput:{tenantId:U,propertyNode:U,attributionId:U,reservationLineageId:U},quotedRateApplicabilityResult:replay,sources:[{postingRootId:U,sourceKind:"room_consideration",additionSubtype:null,discountEligibility:null,evidenceSource:"operator_attestation",evidenceReference:reference}]}) as any;
  try{
    const service=new IndiaGstAccommodationFinalValuationService({idempotency});
    expect((await service.finalize({} as any,input("SOURCE-350"))).replayed).toBeFalse();
    expect((await service.finalize({} as any,input("SOURCE-350"))).replayed).toBeTrue();
    expect(executions).toBe(1);
    await expect(service.finalize({} as any,input("SOURCE-CHANGED"))).rejects.toThrow("idempotency content conflict");
  }finally{IndiaGstAccommodationQuotedRateApplicabilityService.prototype.resolve=original;}
});

function nativeValuation(overrides:Record<string,unknown>={}){
  return freeze({tenantId:U,propertyNode:U,reservationId:U,folioId:U,buyerPartyId:U,serviceProvisionSnapshotId:U,
    sources:[{postingRootId:U,sourceKind:"room_consideration",additionSubtype:null,discountEligibility:null,evidenceSource:"operator_attestation",evidenceReference:"SOURCE-434"}],
    ordinaryAttestation:{relationshipConclusion:"unrelated_not_distinct",considerationConclusion:"money_only",section152Conclusion:"all_additions_enumerated",section153Conclusion:"all_discounts_eligible",sourceCompletenessConclusion:"all_sources_classified",evidenceSource:"operator_attestation",evidenceReference:"ROOT-434"},
    expectedCurrentValuationId:null,expectedCurrentEvidenceHash:null,approvalRequestId:null,idempotencyKey:"order434-native-valuation",
    envelope:{tenantId:U,propertyNode:U,actorId:U,requestId:U,operation:"india_gst.accommodation_final_valuation_recorded"},...overrides} as any);
}

function nativeCapability(created:boolean,overrides:Record<string,unknown>={}){
  return {valuation_id:U,generation:0,disposition:"ordinary_final",transaction_value_minor:"1000",evidence_hash:"a".repeat(64),native_consideration_basis_hash:"b".repeat(64),created,...overrides};
}

describe("Order 434 native consideration valuation boundary",()=>{
  test("calls the governed 25-argument capability on creation and every replay without caller money or invoice evidence",async()=>{
    const calls:{sql:string;values:unknown[]}[]=[];
    let invocation=0;
    const tx=async(strings:TemplateStringsArray,...values:unknown[])=>{
      calls.push({sql:strings.join("?"),values});
      return [nativeCapability(invocation++===0)];
    };
    const idempotency={execute:()=>{throw new Error("native valuation must not use a generic replay short-circuit");}};
    const service=new IndiaGstAccommodationFinalValuationService({idempotency:idempotency as any});
    const input=nativeValuation();
    const first=await service.finalizeNative(tx as any,input);
    const replay=await service.finalizeNative(tx as any,input);
    expect(first).toEqual({valuationId:U,generation:0,disposition:"ordinary_final",transactionValueMinor:"1000",evidenceHash:"a".repeat(64),nativeConsiderationBasisHash:"b".repeat(64),replayed:false});
    expect(replay.replayed).toBeTrue();
    expect(calls).toHaveLength(2);
    expect(calls[0]!.sql).toContain("record_india_gst_native_accommodation_valuation");
    expect(calls[0]!.values).toHaveLength(25);
    expect(calls[0]!.values.slice(0,9)).toEqual([U,U,U,U,U,U,U,U,"order434-native-valuation"]);
    expect(calls[0]!.values.slice(19)).toEqual([
      `{"${U}"}`,
      '{"room_consideration"}',
      '{""}',
      '{""}',
      '{"operator_attestation"}',
      '{"SOURCE-434"}',
    ]);
    expect(JSON.stringify(calls[0]!.values)).not.toContain("quotedRateApplicability");
    expect(JSON.stringify(calls[0]!.values)).not.toContain("invoiceIssue");
    expect(Object.isFrozen(first)).toBeTrue();
  });

  test("binds native source arrays as PostgreSQL literals without changing admitted reference text",async()=>{
    const reference='SOURCE,434"quoted\\path';
    let values:unknown[]=[];
    const tx=async(_strings:TemplateStringsArray,...bound:unknown[])=>{
      values=bound;
      return [nativeCapability(true)];
    };
    const service=new IndiaGstAccommodationFinalValuationService({idempotency:{} as any});
    const input=nativeValuation({sources:[{
      postingRootId:U,sourceKind:"room_consideration",additionSubtype:null,
      discountEligibility:null,evidenceSource:"operator_attestation",evidenceReference:reference,
    }]});
    await service.finalizeNative(tx as any,input);
    expect(values.slice(19)).toEqual([
      `{"${U}"}`,
      '{"room_consideration"}',
      '{""}',
      '{""}',
      '{"operator_attestation"}',
      '{"SOURCE,434\\"quoted\\\\path"}',
    ]);
    expect(input.sources[0]!.evidenceReference).toBe(reference);
  });

  test("accepts only the exact native ordinary input and complete Section 15 classifications before SQL",async()=>{
    let calls=0;
    const tx=async()=>{calls+=1;return [nativeCapability(true)];};
    const service=new IndiaGstAccommodationFinalValuationService({idempotency:{} as any});
    const invalid=[
      nativeValuation({quotedRateApplicabilityResult:{}}),
      nativeValuation({transactionValueMinor:"1000"}),
      nativeValuation({ordinaryAttestation:null}),
      nativeValuation({sources:[null]}),
      nativeValuation({expectedCurrentValuationId:U,expectedCurrentEvidenceHash:null}),
      nativeValuation({sources:[{postingRootId:U,sourceKind:"section15_2_addition",additionSubtype:null,discountEligibility:null,evidenceSource:"operator_attestation",evidenceReference:"SOURCE-434"}]}),
      nativeValuation({sources:[{postingRootId:U,sourceKind:"section15_3_discount",additionSubtype:null,discountEligibility:"ineligible",evidenceSource:"operator_attestation",evidenceReference:"SOURCE-434"}]}),
    ];
    for(const input of invalid)await expect(service.finalizeNative(tx as any,input)).rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationValidationError);
    const mutable=structuredClone(nativeValuation());
    await expect(service.finalizeNative(tx as any,mutable as any)).rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationValidationError);
    const hiddenSurplus=structuredClone(nativeValuation());
    Object.defineProperty(hiddenSurplus,"callerTotal",{value:"1000",enumerable:false});
    freeze(hiddenSurplus);
    await expect(service.finalizeNative(tx as any,hiddenSurplus as any)).rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationValidationError);
    await expect(service.finalizeNative({} as any,nativeValuation())).rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationValidationError);
    expect(calls).toBe(0);
  });

  test("validates the complete native receipt and maps governed SQLSTATE families",async()=>{
    const service=new IndiaGstAccommodationFinalValuationService({idempotency:{} as any});
    for(const invalid of [
      {valuation_id:"not-a-uuid"}, {generation:-1}, {disposition:"manual_valuation_required"},
      {transaction_value_minor:"0"}, {evidence_hash:"bad"},
      {native_consideration_basis_hash:"bad"}, {created:"true"},
    ]){
      const tx=async()=>[nativeCapability(true,invalid)];
      await expect(service.finalizeNative(tx as any,nativeValuation())).rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationConflictError);
    }
    const mappings=[
      [{errno:"42501"},IndiaGstAccommodationFinalValuationNotFoundError],
      [{sqlState:"55000"},IndiaGstAccommodationFinalValuationConflictError],
      [{code:"23505"},IndiaGstAccommodationFinalValuationConflictError],
      [{errno:"23503"},IndiaGstAccommodationFinalValuationConflictError],
      [{sqlState:"22023"},IndiaGstAccommodationFinalValuationValidationError],
      [{code:"22003"},IndiaGstAccommodationFinalValuationValidationError],
      [{errno:"23514"},IndiaGstAccommodationFinalValuationValidationError],
    ] as const;
    for(const [error,expected] of mappings){
      const tx=async()=>{throw error;};
      await expect(service.finalizeNative(tx as any,nativeValuation())).rejects.toBeInstanceOf(expected);
    }
    const plain=new Error("unrelated driver failure");
    const tx=async()=>{throw plain;};
    await expect(service.finalizeNative(tx as any,nativeValuation())).rejects.toBe(plain);
  });
});
