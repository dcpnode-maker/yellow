import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import type { AuditEnvelope, JsonValue, PostgresIdempotency, Tx } from "../../kernel";
import {
  IndiaGstAccommodationQuotedRateApplicabilityService,
  type IndiaGstAccommodationQuotedRateApplicabilityInput,
  type IndiaGstAccommodationQuotedRateApplicabilityResult,
} from "./india-gst-accommodation-quoted-rate-applicability";
import { allocateSignedLargestRemainder } from "./signed-largest-remainder";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH=/^[0-9a-f]{64}$/;
const KEY=/^[\x21-\x7e]{8,200}$/;
const KINDS=new Set(["room_consideration","package_consideration","promotion_discount","fee_consideration","section15_2_addition","section15_3_discount"]);
const ADDITIONS=new Set(["tax_duty_cess_fee_charge_excluding_gst","supplier_liability_paid_by_recipient","incidental_expense","interest_late_fee_penalty","non_government_price_linked_subsidy"]);
const DISCOUNTS=new Set(["eligible_pre_supply_recorded","eligible_post_supply_linked_itc_reversed","ineligible","indeterminable"]);
const MANUAL=new Set(["related_person","distinct_person","non_money_consideration","pure_agent","special_supply_rules_27_35","tax_inclusive","omitted_section15_2_addition","ineligible_section15_3_discount","indeterminable_section15_3_discount","incomplete_source_classification","other_indeterminable_governed_evidence"]);
const SOURCE=/^[a-z][a-z0-9_.:-]{2,63}$/;
const REFERENCE=/^[\x21-\x7e]{1,200}$/;

export interface IndiaGstFinalValuationSourceInput { readonly postingRootId:string; readonly sourceKind:string; readonly additionSubtype:string|null; readonly discountEligibility:string|null; readonly evidenceSource:string; readonly evidenceReference:string; }
export interface IndiaGstFinalValuationOrdinaryAttestation { readonly relationshipConclusion:"unrelated_not_distinct"; readonly considerationConclusion:"money_only"; readonly section152Conclusion:"all_additions_enumerated"; readonly section153Conclusion:"all_discounts_eligible"; readonly sourceCompletenessConclusion:"all_sources_classified"; readonly evidenceSource:string; readonly evidenceReference:string; }
export interface IndiaGstAccommodationFinalValuationInput {
  readonly tenantId:string; readonly propertyNode:string; readonly reservationId:string; readonly folioId:string; readonly buyerPartyId:string;
  readonly quotedRateApplicabilityInput:IndiaGstAccommodationQuotedRateApplicabilityInput;
  readonly quotedRateApplicabilityResult:IndiaGstAccommodationQuotedRateApplicabilityResult;
  readonly sources:readonly IndiaGstFinalValuationSourceInput[];
  readonly ordinaryAttestation:IndiaGstFinalValuationOrdinaryAttestation|null;
  readonly manualReasons:readonly string[]; readonly expectedCurrentValuationId:string|null; readonly expectedCurrentEvidenceHash:string|null; readonly approvalRequestId:string|null;
  readonly idempotencyKey:string; readonly envelope:AuditEnvelope;
}
export interface IndiaGstAccommodationFinalValuationResult extends Readonly<Record<string,JsonValue>> { readonly valuationId:string; readonly generation:number; readonly disposition:"ordinary_final"|"manual_valuation_required"; readonly transactionValueMinor:string|null; readonly evidenceHash:string; readonly replayed:boolean; }
export interface IndiaGstAccommodationFinalValuationServiceOptions { readonly idempotency:PostgresIdempotency; }
export class IndiaGstAccommodationFinalValuationValidationError extends Error { constructor(m:string){super(m);this.name="IndiaGstAccommodationFinalValuationValidationError";} }
export class IndiaGstAccommodationFinalValuationConflictError extends Error { constructor(m:string){super(m);this.name="IndiaGstAccommodationFinalValuationConflictError";} }
export class IndiaGstAccommodationFinalValuationNotFoundError extends Error { constructor(m:string){super(m);this.name="IndiaGstAccommodationFinalValuationNotFoundError";} }
interface SourceRow { root_id:string; amount_minor:string; }
interface CapabilityRow { valuation_id:string; generation:number; disposition:"ordinary_final"|"manual_valuation_required"; transaction_value_minor:string|null; evidence_hash:string; }

function fail(message:string):never{throw new IndiaGstAccommodationFinalValuationValidationError(message);}
function uuid(v:unknown,n:string):string{if(typeof v!=="string"||!UUID.test(v))return fail(`${n} must be a lowercase UUID`);return v;}
function hash(v:unknown,n:string):string{if(typeof v!=="string"||!HASH.test(v))return fail(`${n} must be lowercase SHA-256`);return v;}
function frozen(value:unknown,seen=new Set<object>()):void{if(value===null||typeof value==="string"||typeof value==="boolean"||(typeof value==="number"&&Number.isFinite(value)))return;if(typeof value!=="object"||seen.has(value)||utilTypes.isProxy(value)||!Object.isFrozen(value)||Object.getOwnPropertySymbols(value).length)return fail("final valuation input must be an exact deeply frozen graph");seen.add(value);if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return fail("final valuation input must contain plain records");for(const d of Object.values(Object.getOwnPropertyDescriptors(value))){if(d.get||d.set||!("value" in d))return fail("accessors are forbidden");frozen(d.value,seen);}}
function exact(value:object,keys:readonly string[],name:string):void{const actual=Object.keys(value).sort(),wanted=[...keys].sort();if(actual.length!==wanted.length||actual.some((k,i)=>k!==wanted[i]))fail(`${name} shape is invalid`);}
function sourceText(v:unknown,n:string):string{if(typeof v!=="string"||!SOURCE.test(v))return fail(`${n} is invalid`);return v;}
function reference(v:unknown,n:string):string{if(typeof v!=="string"||!REFERENCE.test(v))return fail(`${n} is invalid`);return v;}
function digest(value:unknown):string{return createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function same(a:unknown,b:unknown):boolean{return JSON.stringify(a)===JSON.stringify(b);}
function mapDbError(error:unknown):never{const code=(error as {code?:string;errno?:string}).code??(error as {errno?:string}).errno;if(code==="42501")throw new IndiaGstAccommodationFinalValuationNotFoundError("Final valuation authority was not found");if(code==="55000"||code==="23505"||code==="23503")throw new IndiaGstAccommodationFinalValuationConflictError("Final valuation scope is stale or unavailable");if(code==="22023"||code==="22003"||code==="23514")throw new IndiaGstAccommodationFinalValuationValidationError("Final valuation evidence is invalid");throw error;}

export class IndiaGstAccommodationFinalValuationService {
  readonly #idempotency:PostgresIdempotency;
  constructor(options:IndiaGstAccommodationFinalValuationServiceOptions){this.#idempotency=options.idempotency;}
  async finalize(tx:Tx,input:IndiaGstAccommodationFinalValuationInput):Promise<IndiaGstAccommodationFinalValuationResult>{
    frozen(input);
    exact(input,["tenantId","propertyNode","reservationId","folioId","buyerPartyId","quotedRateApplicabilityInput","quotedRateApplicabilityResult","sources","ordinaryAttestation","manualReasons","expectedCurrentValuationId","expectedCurrentEvidenceHash","approvalRequestId","idempotencyKey","envelope"],"final valuation input");
    const tenant=uuid(input.tenantId,"tenantId"),property=uuid(input.propertyNode,"propertyNode"),reservation=uuid(input.reservationId,"reservationId"),folio=uuid(input.folioId,"folioId"),buyer=uuid(input.buyerPartyId,"buyerPartyId");
    if(input.sources.length===0||input.sources.length>500||new Set(input.sources.map(s=>s.postingRootId)).size!==input.sources.length||typeof input.idempotencyKey!=="string"||!KEY.test(input.idempotencyKey))return fail("source set or idempotency key is invalid");
    const actor=uuid(input.envelope.actorId,"envelope.actorId"),requestId=uuid(input.envelope.requestId,"envelope.requestId");
    if(input.envelope.tenantId!==tenant||input.envelope.propertyNode!==property||input.envelope.operation!=="india_gst.accommodation_final_valuation_recorded")return fail("audit envelope is invalid");
    const sources=input.sources.map((source)=>{exact(source,["postingRootId","sourceKind","additionSubtype","discountEligibility","evidenceSource","evidenceReference"],"source attestation");const root=uuid(source.postingRootId,"postingRootId");if(!KINDS.has(source.sourceKind))return fail("sourceKind is invalid");const addition=source.additionSubtype===null?null:String(source.additionSubtype),discount=source.discountEligibility===null?null:String(source.discountEligibility);if((source.sourceKind==="section15_2_addition")!==ADDITIONS.has(addition??"")||(source.sourceKind!=="section15_2_addition"&&addition!==null))return fail("addition subtype conflicts with source kind");if((source.sourceKind==="section15_3_discount")!==DISCOUNTS.has(discount??"")||(source.sourceKind!=="section15_3_discount"&&discount!==null))return fail("discount eligibility conflicts with source kind");return Object.freeze({postingRootId:root,sourceKind:source.sourceKind,additionSubtype:addition,discountEligibility:discount,evidenceSource:sourceText(source.evidenceSource,"source evidence source"),evidenceReference:reference(source.evidenceReference,"source evidence reference")});});
    const manual=[...input.manualReasons];if(new Set(manual).size!==manual.length||manual.some(r=>typeof r!=="string"||!MANUAL.has(r)))return fail("manual reasons are invalid");
    const ordinary=input.ordinaryAttestation;if((ordinary===null)===(manual.length===0))return fail("ordinary and manual evidence must form one exact partition");
    if(ordinary!==null){exact(ordinary,["relationshipConclusion","considerationConclusion","section152Conclusion","section153Conclusion","sourceCompletenessConclusion","evidenceSource","evidenceReference"],"ordinary attestation");if(ordinary.relationshipConclusion!=="unrelated_not_distinct"||ordinary.considerationConclusion!=="money_only"||ordinary.section152Conclusion!=="all_additions_enumerated"||ordinary.section153Conclusion!=="all_discounts_eligible"||ordinary.sourceCompletenessConclusion!=="all_sources_classified")return fail("ordinary attestation conclusions are incomplete");sourceText(ordinary.evidenceSource,"ordinary evidence source");reference(ordinary.evidenceReference,"ordinary evidence reference");}
    const disposition=manual.length?"manual_valuation_required" as const:"ordinary_final" as const;
    const expected=input.expectedCurrentValuationId===null?null:uuid(input.expectedCurrentValuationId,"expectedCurrentValuationId"),expectedHash=input.expectedCurrentEvidenceHash===null?null:hash(input.expectedCurrentEvidenceHash,"expectedCurrentEvidenceHash"),approval=input.approvalRequestId===null?null:uuid(input.approvalRequestId,"approvalRequestId");
    if((expected===null)!==(expectedHash===null))return fail("expected current id and hash must be supplied together");
    try{
      const replay=await new IndiaGstAccommodationQuotedRateApplicabilityService().resolve(tx,input.quotedRateApplicabilityInput);
      if(!same(replay,input.quotedRateApplicabilityResult)||replay.reservationLineage.reservationId!==reservation||replay.reservationLineage.folioId!==folio||input.quotedRateApplicabilityInput.propertyNode!==property||input.quotedRateApplicabilityInput.tenantId!==tenant)return fail("Order341 evidence does not byte-match exact valuation scope");
      const requestHash=digest({v:2,tenant,property,reservation,folio,buyer,order341:replay.evidenceHash,sources,ordinary,manual,expected,expectedHash,approval});
      const result=await this.#idempotency.execute<Record<string,JsonValue>>(tx,{tenantId:tenant,operation:"tax-fiscal.india-accommodation-final-valuation.finalize",key:input.idempotencyKey,request:{requestHash}},async q=>{
        const sourceIds=sources.map(s=>s.postingRootId);
        const rows=await q<SourceRow[]>`SELECT coalesce(line.folio_transfer_root_line_id,line.id)::text root_id,sum(line.amount_minor)::text amount_minor FROM public.posting_line line JOIN public.journal j ON j.tenant_id=line.tenant_id AND j.id=line.journal_id WHERE line.tenant_id=${tenant}::uuid AND line.folio_id=${folio}::uuid AND coalesce(line.folio_transfer_root_line_id,line.id)=ANY(${sourceIds}::uuid[]) AND j.currency='INR' AND NOT EXISTS(SELECT 1 FROM public.journal reversal WHERE reversal.tenant_id=j.tenant_id AND reversal.reverses=j.id) GROUP BY coalesce(line.folio_transfer_root_line_id,line.id) ORDER BY coalesce(line.folio_transfer_root_line_id,line.id)`;
        const amountByRoot=new Map(rows.map(r=>[r.root_id,r.amount_minor]));if(amountByRoot.size!==sources.length)throw new IndiaGstAccommodationFinalValuationConflictError("Complete locked posting source set is unavailable");
        const weights=Object.freeze(replay.components.map(c=>Object.freeze({ordinal:c.ordinal,weightMinor:c.quotedAmountMinor})));
        const allocations=disposition==="ordinary_final"?sources.flatMap(s=>allocateSignedLargestRemainder(amountByRoot.get(s.postingRootId)!,weights).map(a=>BigInt(a.amountMinor))):[];
        const capability=await q<CapabilityRow[]>`SELECT * FROM public.record_india_gst_accommodation_final_valuation(${tenant}::uuid,${property}::uuid,${reservation}::uuid,${folio}::uuid,${buyer}::uuid,${input.quotedRateApplicabilityInput.attributionId}::uuid,${input.quotedRateApplicabilityInput.reservationLineageId}::uuid,${requestId}::uuid,${actor}::uuid,${disposition},${replay.evidenceHash},${requestHash},${expected}::uuid,${expectedHash},${approval}::uuid,${ordinary?.relationshipConclusion??null},${ordinary?.considerationConclusion??null},${ordinary?.section152Conclusion??null},${ordinary?.section153Conclusion??null},${ordinary?.sourceCompletenessConclusion??null},${ordinary?.evidenceSource??null},${ordinary?.evidenceReference??null},${manual}::text[],${sourceIds}::uuid[],${sources.map(s=>s.sourceKind)}::text[],${sources.map(s=>s.additionSubtype??"")}::text[],${sources.map(s=>s.discountEligibility??"")}::text[],${sources.map(s=>s.evidenceSource)}::text[],${sources.map(s=>s.evidenceReference)}::text[],${replay.components.map(c=>Number(c.ordinal))}::integer[],${replay.components.map(c=>c.businessDate)}::date[],${replay.components.map(c=>BigInt(c.quotedAmountMinor))}::bigint[],${allocations}::bigint[])`;
        const row=capability[0];if(capability.length!==1||!row||!HASH.test(row.evidence_hash))throw new IndiaGstAccommodationFinalValuationConflictError("Final valuation capability returned invalid evidence");
        return {status:201,body:{valuationId:row.valuation_id,generation:row.generation,disposition:row.disposition,transactionValueMinor:row.transaction_value_minor,evidenceHash:row.evidence_hash}};
      });
      return {...result.body,replayed:result.replayed} as IndiaGstAccommodationFinalValuationResult;
    }catch(error){return mapDbError(error);}
  }
}
