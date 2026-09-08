import { describe, expect, test } from "bun:test";
import {
  composeRateStayQuote, deriveRateEvaluationContext, deriveRateStayCompositionContext,
  evaluateRateModel, normalizeRateCompositionSpec, normalizeRateEvaluatorSpec,
} from "../src/contexts/rates";

const ID = "00000000-0000-0000-0000-000000006800";
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function copied<T>(value: T): T { return freeze(structuredClone(value)); }
function specInput() {
  return {modelKey:"calendar", currency:"INR", base:{kind:"calendar",cells:[
    {stayDate:"2026-03-08",state:"open",amountMinor:10001n},
    {stayDate:"2026-03-09",state:"open",amountMinor:20002n},
  ]}, gate:{}, rules:[]};
}
function contextInput(nightDate = "2026-03-08") {
  return {propertyTimeZone:"America/New_York",bookingInstant:"2026-03-07T23:30:00.000Z",
    stayStartInstant:"2026-03-08T06:30:00.000Z",stayEndInstant:"2026-03-10T05:00:00.000Z",nightDate};
}
function compositionSpec() {
  return normalizeRateCompositionSpec({currency:"INR",guestEligibility:{minAdults:1,maxAdults:4,minChildren:0,maxChildren:3,minTotalGuests:1,maxTotalGuests:6},
    package:null,promotions:[],policy:{cancellationPolicyId:null,depositPolicyId:null,guaranteePolicyId:null,noShowPolicyId:null,refundTreatment:"policy"},
    distribution:{mode:"all",channelCodes:[]}});
}
function stayInput() {
  const rateEvaluatorSpec=normalizeRateEvaluatorSpec(specInput());
  return {rateEvaluatorSpec,rateEvaluations:["2026-03-08","2026-03-09"].map(nightDate=>{
    const evaluationContext=deriveRateEvaluationContext(contextInput(nightDate));
    return {nightDate,evaluationContext,evaluationResult:evaluateRateModel(rateEvaluatorSpec,evaluationContext)};
  }),guests:{adults:2,childAges:[9]},selectedPromotionCodes:[],policyEvidence:[],
    mandatoryPolicyEvidence:[{key:"tax",evidenceRef:"tax:version-7"}],
    availabilityEvidence:{sellableUnitId:ID,availableCount:1,bookable:true,restrictionEvidence:[],operationalBlockEvidence:[],evidenceRef:"availability:v1"},
    channelCode:"direct",channelMappingEvidenceRef:null};
}

describe("Order451 private immutable evaluation reuse",()=>{
  test("module-produced normalization is reused, while equivalent caller copies are not identities",()=>{
    const spec=normalizeRateEvaluatorSpec(specInput());
    expect(normalizeRateEvaluatorSpec(spec)).toBe(spec);
    const clone=copied(spec), normalized=normalizeRateEvaluatorSpec(clone);
    expect(normalized).not.toBe(clone);
    expect(normalized).toEqual(spec);
  });
  test("complete module-produced stay is reused without changing result bytes or logical work",()=>{
    const context=deriveRateStayCompositionContext(stayInput()), spec=compositionSpec();
    const result=composeRateStayQuote(spec,context);
    expect(result.rateEvaluations).toBe(context.rateEvaluations);
    expect(composeRateStayQuote(spec,copied(context))).toEqual(result);
  });
  test("D244: warm contexts do not authorize forged frozen derived fields or foreign pairings",()=>{
    const spec=normalizeRateEvaluatorSpec(specInput()), context=deriveRateEvaluationContext(contextInput());
    const expected=evaluateRateModel(spec,context);
    for(const change of [{losNights:1},{nightDowMask:1},{bookingWindowDays:0},{bookingDate:"2026-03-08"},
      {stayStartDate:"2026-03-09"},{stayEndDate:"2026-03-11"},{nightDate:"2026-03-10"},
      {propertyTimeZone:"UTC",bookingInstant:"2026-03-08T03:30:00.000Z"}]) {
      expect(()=>evaluateRateModel(spec,freeze({...context,...change}))).toThrow();
      expect(evaluateRateModel(spec,context)).toEqual(expected);
    }
    const stay=deriveRateStayCompositionContext(stayInput()), composition=compositionSpec();
    composeRateStayQuote(composition,stay);
    for(const change of [
      {rateEvaluations:stay.rateEvaluations.slice(1)},
      {rateEvaluations:[...stay.rateEvaluations].reverse()},
      {rateEvaluatorSpec:normalizeRateEvaluatorSpec({...specInput(),currency:"USD"})},
      {rateEvaluations:stay.rateEvaluations.map((night,i)=>i?night:{...night,evaluationResult:{...night.evaluationResult,amountMinor:1n}})},
      {rateEvaluations:stay.rateEvaluations.map((night,i)=>i?night:{...night,evaluationContext:{...night.evaluationContext,losNights:1}})},
      {availabilityEvidence:{...stay.availabilityEvidence,availableCount:0}},
      {guests:{...stay.guests,childAges:[99]}},
      {mandatoryPolicyEvidence:[{key:"tax",evidenceRef:""}]},
    ]) expect(()=>composeRateStayQuote(composition,freeze({...stay,...change}))).toThrow();
  });
  test("normalizations retain no mutable caller aliases, including nested evidence",()=>{
    const raw=specInput(), spec=normalizeRateEvaluatorSpec(raw), context=deriveRateEvaluationContext(contextInput());
    raw.base.cells[0]!.amountMinor=99n;
    expect(evaluateRateModel(spec,context).amountMinor).toBe(10001n);
    expect(evaluateRateModel(raw,context).amountMinor).toBe(99n);
    const input=stayInput(), stay=deriveRateStayCompositionContext(input), composition=compositionSpec();
    const before=composeRateStayQuote(composition,stay);
    input.guests.childAges[0]=17; input.mandatoryPolicyEvidence[0]!.evidenceRef="changed:v2";
    input.availabilityEvidence.availableCount=0;
    expect(stay.guests.childAges).toEqual([9]);
    expect(stay.mandatoryPolicyEvidence[0]!.evidenceRef).toBe("tax:version-7");
    expect(composeRateStayQuote(composition,stay)).toEqual(before);
    function deeplyFrozen(value:unknown):boolean {return value===null||typeof value!=="object"||Object.isFrozen(value)&&Object.values(value).every(deeplyFrozen);}
    expect(deeplyFrozen(spec)).toBe(true); expect(deeplyFrozen(stay)).toBe(true); expect(deeplyFrozen(before)).toBe(true);
    expect(()=>{(spec.base as unknown as {cells:{amountMinor:bigint}[]}).cells[0]!.amountMinor=1n;}).toThrow();
    expect(()=>{(stay.guests.childAges as number[]).push(2);}).toThrow();
  });
  test("accessor and proxy inputs never acquire private provenance or bypass revalidation",()=>{
    const raw=specInput(); let accesses=0;
    const accessor={...raw,get currency(){accesses++;return "INR";}};
    const normalized=normalizeRateEvaluatorSpec(accessor);
    expect(accesses).toBeGreaterThan(0);
    expect(normalizeRateEvaluatorSpec(normalized)).not.toBe(normalized);
    const proxied=normalizeRateEvaluatorSpec(new Proxy(raw,{}));
    expect(normalizeRateEvaluatorSpec(proxied)).not.toBe(proxied);
    const genuine=normalizeRateEvaluatorSpec(raw);
    expect(normalizeRateEvaluatorSpec(new Proxy(genuine,{}))).not.toBe(genuine);
    let timeZoneReads=0;
    const unstable=deriveRateEvaluationContext({...contextInput(),bookingInstant:"2026-03-08T03:30:00.000Z",
      get propertyTimeZone(){return ++timeZoneReads===7?"UTC":"America/New_York";}});
    expect(unstable.propertyTimeZone).toBe("UTC");
    expect(()=>evaluateRateModel(genuine,unstable)).toThrow("derived context bookingDate does not match its canonical inputs");
    const input=stayInput();
    const exotic=deriveRateStayCompositionContext({...input,get channelCode(){return "direct";}});
    expect(composeRateStayQuote(compositionSpec(),exotic).rateEvaluations).not.toBe(exotic.rateEvaluations);
    const wrapped=deriveRateStayCompositionContext(new Proxy(input,{}));
    expect(composeRateStayQuote(compositionSpec(),wrapped).rateEvaluations).not.toBe(wrapped.rateEvaluations);
  });
  test("valid serialized and outer-frozen inputs still use canonical validation",()=>{
    const spec=normalizeRateEvaluatorSpec(specInput()), context=deriveRateEvaluationContext(contextInput());
    const serialized=JSON.parse(JSON.stringify(context));
    expect(evaluateRateModel(spec,Object.freeze(serialized))).toEqual(evaluateRateModel(spec,context));
    const mutable=structuredClone(deriveRateStayCompositionContext(stayInput()));
    // Existing contract requires frozen nested rate bundles, but permits mutable
    // common inputs which are copied by the canonical constructor.
    freeze(mutable.rateEvaluatorSpec); freeze(mutable.rateEvaluations);
    Object.freeze(mutable);
    const result=composeRateStayQuote(compositionSpec(),mutable);
    (mutable.guests.childAges as number[])[0]=99;
    expect(()=>composeRateStayQuote(compositionSpec(),mutable)).toThrow();
    expect(result.guests.childAges).toEqual([9]);
  });
  test("reference, target and recommendation evidence are reconstructed and immutable",()=>{
    const reference={sourceKind:"parent",sourceId:ID,sourceVersion:3,currency:"INR",amountMinor:12345n};
    const target=freeze({state:"included",winningRuleKey:"room",matchedRuleKeys:["room"],conflictingRuleKeys:[]});
    const recommendation=freeze({state:"accepted",adapterKey:"rms",adapterVersion:1,recommendationId:"rec-1",recommendationVersion:2,
      observedAt:"2026-03-07T00:00:00.000Z",tenantId:ID,propertyNode:ID,ratePlanId:ID,releaseId:ID,releaseVersion:1,
      sellableUnitId:ID,unitTypeId:ID,nightDate:"2026-03-08",currency:"INR",amountMinor:12345n,evidenceRef:"rms:v2"});
    const derived=deriveRateEvaluationContext({...contextInput(),reference,targetResolution:target});
    expect(derived.reference).not.toBe(reference); expect(derived.targetResolution).not.toBe(target);
    reference.amountMinor=1n;
    const spec=normalizeRateEvaluatorSpec({modelKey:"derived",currency:"INR",base:{kind:"reference",sourceKind:"parent",sourceId:ID,sourceVersion:3},gate:{},rules:[]});
    expect(evaluateRateModel(spec,derived).amountMinor).toBe(12345n);
    expect(evaluateRateModel(copied(spec),copied(derived))).toEqual(evaluateRateModel(spec,derived));
    const rms=deriveRateEvaluationContext({...contextInput(),recommendation});
    expect(rms.recommendation).not.toBe(recommendation);
    const rmsSpec=normalizeRateEvaluatorSpec({modelKey:"rms-api-managed",currency:"INR",base:{kind:"fixed",amountMinor:10000n},gate:{},rules:[],floorMinor:1n,ceilingMinor:20000n});
    expect(evaluateRateModel(rmsSpec,rms)).toEqual(evaluateRateModel(copied(rmsSpec),copied(rms)));
    expect(()=>evaluateRateModel(rmsSpec,freeze({...rms,recommendation:{...recommendation,currency:"USD"}}))).toThrow();
  });
  test("warm versus rebuilt paths retain all nine model families, conflicts and exact guards",()=>{
    const rule={key:"adjust",stage:1,priority:0,when:{},adjustment:{kind:"basis_points",basisPoints:500}};
    const common={currency:"INR",base:{kind:"fixed",amountMinor:10001n},gate:{},rules:[]};
    const target=freeze({state:"included",winningRuleKey:"room",matchedRuleKeys:["room"],conflictingRuleKeys:[]});
    const cases:[Record<string,unknown>,Record<string,unknown>][]=[
      [{...common,modelKey:"simple-fixed",rules:[rule],ceilingMinor:10500n},{}],
      [specInput(),{}],
      [{...common,modelKey:"bar-ladder",base:{kind:"reference",sourceKind:"bar",sourceId:ID,sourceVersion:1},rules:[{...rule,when:{barLevel:"HIGH"}}]},
        {barLevel:"HIGH",reference:{sourceKind:"bar",sourceId:ID,sourceVersion:1,currency:"INR",amountMinor:10001n}}],
      [{...common,modelKey:"derived",base:{kind:"reference",sourceKind:"parent",sourceId:ID,sourceVersion:1}},
        {reference:{sourceKind:"parent",sourceId:ID,sourceVersion:1,currency:"INR",amountMinor:10001n}}],
      [{...common,modelKey:"room-matrix",rules:[{...rule,targetRuleKey:"room"}]},{targetResolution:target}],
      [{...common,modelKey:"occupancy-los",rules:[{...rule,when:{los:{minNights:1,maxNights:3}}}]},{}],
      [{...common,modelKey:"contract-negotiated",eligibleTargetRuleKeys:["room"]},{targetResolution:target}],
      [{...common,modelKey:"expert-composition",rules:[rule,{...rule,key:"conflict"}]},{}],
      [{...common,modelKey:"rms-api-managed",floorMinor:1n,ceilingMinor:20000n},
        {recommendation:freeze({state:"fallback",adapterKey:"rms",adapterVersion:1,reason:"stale"})}],
    ];
    for(const [raw,extra] of cases) {
      const spec=normalizeRateEvaluatorSpec(raw), context=deriveRateEvaluationContext({...contextInput(),...extra});
      expect(normalizeRateEvaluatorSpec(spec)).toBe(spec);
      expect(evaluateRateModel(spec,context)).toEqual(evaluateRateModel(copied(spec),copied(context)));
    }
    for(const cells of [[{stayDate:"2026-03-08",state:"closed"}],[{stayDate:"2026-03-09",state:"open",amountMinor:1n}]]) {
      const spec=normalizeRateEvaluatorSpec({...specInput(),base:{kind:"calendar",cells}}), context=deriveRateEvaluationContext(contextInput());
      expect(evaluateRateModel(spec,context)).toEqual(evaluateRateModel(copied(spec),copied(context)));
      expect(evaluateRateModel(spec,context).state).toBe("unpriced");
    }
  });
  test("local-date boundaries and signed-int64 failures are unchanged on warm and rebuilt paths",()=>{
    const spec=normalizeRateEvaluatorSpec({modelKey:"simple-fixed",currency:"INR",base:{kind:"fixed",amountMinor:1n},gate:{},rules:[]});
    for(const nights of [1,366,367,730]) {
      const context=deriveRateEvaluationContext({propertyTimeZone:"UTC",bookingInstant:"2024-02-01T00:00:00.000Z",
        stayStartInstant:"2024-02-29T15:00:00.000Z",stayEndInstant:new Date(Date.parse("2024-02-29T15:00:00.000Z")+nights*86400000).toISOString(),nightDate:"2024-02-29"});
      expect(context.losNights).toBe(nights);
      expect(evaluateRateModel(spec,context)).toEqual(evaluateRateModel(copied(spec),copied(context)));
    }
    const fall=deriveRateEvaluationContext({propertyTimeZone:"America/New_York",bookingInstant:"2026-10-31T03:00:00.000Z",
      stayStartInstant:"2026-11-01T04:30:00.000Z",stayEndInstant:"2026-11-03T05:30:00.000Z",nightDate:"2026-11-01"});
    expect(fall.losNights).toBe(2); expect(fall.bookingDate).toBe("2026-10-30");
    expect(evaluateRateModel(spec,fall)).toEqual(evaluateRateModel(copied(spec),copied(fall)));
    const overflow=normalizeRateEvaluatorSpec({modelKey:"simple-fixed",currency:"INR",base:{kind:"fixed",amountMinor:9223372036854775807n},gate:{},
      rules:[{key:"overflow",stage:1,priority:0,when:{},adjustment:{kind:"delta",amountMinor:1n}}]});
    function errorOf(action:()=>unknown) {try {action();return "accepted";} catch(error) {return `${(error as Error).name}:${(error as Error).message}`;}}
    const failure=errorOf(()=>evaluateRateModel(overflow,fall));
    expect(failure).not.toBe("accepted");
    expect(errorOf(()=>evaluateRateModel(copied(overflow),copied(fall)))).toBe(failure);
    const missing={...fall} as Record<string,unknown>; delete missing.bookingDate;
    expect(()=>evaluateRateModel(spec,Object.freeze(missing))).toThrow();
    const reordered=Object.freeze(Object.fromEntries(Object.entries(fall).reverse()));
    expect(evaluateRateModel(spec,reordered)).toEqual(evaluateRateModel(spec,fall));
  });
  test("oversized primitive arrays still produce the original canonical errors",()=>{
    const large=new Array(100_001).fill(0);
    function failure(action:()=>unknown) {
      try {action();return "accepted";} catch(error) {return `${(error as Error).name}:${(error as Error).message}`;}
    }
    expect(failure(()=>normalizeRateEvaluatorSpec({...specInput(),rules:large})))
      .toBe("RateEvaluationError:rules must be an array with at most 200 entries");
    expect(failure(()=>normalizeRateEvaluatorSpec({...specInput(),base:{kind:"calendar",cells:large}})))
      .toBe("RateEvaluationError:calendar base requires 1 to 731 cells");
    expect(failure(()=>normalizeRateEvaluatorSpec({...specInput(),eligibleTargetRuleKeys:large})))
      .toBe("RateEvaluationError:eligibleTargetRuleKeys must contain at most 100 keys");
    expect(failure(()=>deriveRateStayCompositionContext({...stayInput(),rateEvaluations:large})))
      .toBe("RateCompositionError:rateEvaluations must contain 1 to 730 room-nights");
  });
  test("deep and primitive-wide graphs exhaust eligibility only, never replace validation errors",()=>{
    let deep:Record<string,unknown>={};
    for(let i=0;i<5_000;i++) deep={child:deep};
    const wide=Object.fromEntries(Array.from({length:100_010},(_,i)=>[`key${i}`,i]));
    function failure(action:()=>unknown) {
      try {action();return "accepted";} catch(error) {return `${(error as Error).name}:${(error as Error).message}`;}
    }
    for(const graph of [deep,wide]) {
      expect(failure(()=>normalizeRateEvaluatorSpec({...specInput(),extra:graph})))
        .toBe("RateEvaluationError:rate evaluator spec contains unsupported fields");
      expect(failure(()=>deriveRateEvaluationContext({...contextInput(),extra:graph})))
        .toBe("RateEvaluationError:rate evaluation context contains unsupported fields");
      expect(failure(()=>deriveRateStayCompositionContext({...stayInput(),extra:graph})))
        .toBe("RateCompositionError:rate stay composition context contains unsupported fields");
    }
    // Existing validators ignore non-enumerable extras. Exhaustion must therefore
    // disable reuse, not introduce a new rejection or authenticate this input.
    for(const graph of [deep,wide,new Array(732).fill(0),new Array(100_001).fill(0)]) {
      const input=specInput(); Object.defineProperty(input,"extra",{value:graph});
      const spec=normalizeRateEvaluatorSpec(input);
      expect(normalizeRateEvaluatorSpec(spec)).not.toBe(spec);
      expect(spec).toEqual(normalizeRateEvaluatorSpec(specInput()));
      const rawStay=stayInput(); Object.defineProperty(rawStay,"extra",{value:graph});
      const stay=deriveRateStayCompositionContext(rawStay);
      const result=composeRateStayQuote(compositionSpec(),stay);
      expect(result.rateEvaluations).not.toBe(stay.rateEvaluations);
      expect(result).toEqual(composeRateStayQuote(compositionSpec(),deriveRateStayCompositionContext(stayInput())));
    }
    const ordinary=normalizeRateEvaluatorSpec(specInput());
    expect(normalizeRateEvaluatorSpec(ordinary)).toBe(ordinary);
    const boundaryInput=specInput(); Object.defineProperty(boundaryInput,"extra",{value:new Array(731).fill(0)});
    const boundary=normalizeRateEvaluatorSpec(boundaryInput);
    expect(normalizeRateEvaluatorSpec(boundary)).toBe(boundary);
  });
});
