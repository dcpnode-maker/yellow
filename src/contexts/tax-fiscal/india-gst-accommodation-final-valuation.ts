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
const ORDINARY=["unrelated_not_distinct","money_only","actually_paid_or_payable_from_locked_postings","all_section15_2_additions_enumerated","all_packages_promotions_discounts_fees_enumerated"] as const;

export interface IndiaGstFinalValuationSourceInput { readonly postingRootId:string; readonly sourceKind:string; readonly classificationEvidenceHash:string; readonly eligibilityEvidenceHash:string|null; }
export interface IndiaGstAccommodationFinalValuationInput {
  readonly tenantId:string; readonly propertyNode:string; readonly reservationId:string; readonly folioId:string; readonly buyerPartyId:string;
  readonly quotedRateApplicabilityInput:IndiaGstAccommodationQuotedRateApplicabilityInput;
  readonly quotedRateApplicabilityResult:IndiaGstAccommodationQuotedRateApplicabilityResult;
  readonly sources:readonly IndiaGstFinalValuationSourceInput[];
  readonly ordinaryEvidenceHashes:Readonly<Record<(typeof ORDINARY)[number],string>>;
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
function digest(value:unknown):string{return createHash("sha256").update(JSON.stringify(value)).digest("hex");}
function same(a:unknown,b:unknown):boolean{return JSON.stringify(a)===JSON.stringify(b);}
function mapDbError(error:unknown):never{const code=(error as {code?:string;errno?:string}).code??(error as {errno?:string}).errno;if(code==="42501")throw new IndiaGstAccommodationFinalValuationNotFoundError("Final valuation authority was not found");if(code==="55000"||code==="23505"||code==="23503")throw new IndiaGstAccommodationFinalValuationConflictError("Final valuation scope is stale or unavailable");if(code==="22023"||code==="22003"||code==="23514")throw new IndiaGstAccommodationFinalValuationValidationError("Final valuation evidence is invalid");throw error;}

export class IndiaGstAccommodationFinalValuationService {
  readonly #idempotency:PostgresIdempotency;
  constructor(options:IndiaGstAccommodationFinalValuationServiceOptions){this.#idempotency=options.idempotency;}
  async finalize(tx:Tx,input:IndiaGstAccommodationFinalValuationInput):Promise<IndiaGstAccommodationFinalValuationResult>{
    frozen(input);
    const tenant=uuid(input.tenantId,"tenantId"),property=uuid(input.propertyNode,"propertyNode"),reservation=uuid(input.reservationId,"reservationId"),folio=uuid(input.folioId,"folioId"),buyer=uuid(input.buyerPartyId,"buyerPartyId");
    if(input.sources.length===0||input.sources.length>500||new Set(input.sources.map(s=>s.postingRootId)).size!==input.sources.length||typeof input.idempotencyKey!=="string"||!KEY.test(input.idempotencyKey))return fail("source set or idempotency key is invalid");
    const actor=uuid(input.envelope.actorId,"envelope.actorId"),requestId=uuid(input.envelope.requestId,"envelope.requestId");
    if(input.envelope.tenantId!==tenant||input.envelope.propertyNode!==property||input.envelope.operation!=="india_gst.accommodation_final_valuation_recorded")return fail("audit envelope is invalid");
    const sources=input.sources.map((source)=>{const root=uuid(source.postingRootId,"postingRootId");if(!KINDS.has(source.sourceKind))return fail("sourceKind is invalid");return Object.freeze({...source,postingRootId:root,classificationEvidenceHash:hash(source.classificationEvidenceHash,"classificationEvidenceHash"),eligibilityEvidenceHash:source.eligibilityEvidenceHash===null?null:hash(source.eligibilityEvidenceHash,"eligibilityEvidenceHash")});});
    const manual=[...input.manualReasons];if(new Set(manual).size!==manual.length||manual.some(r=>typeof r!=="string"||r.length<1||r.length>100||!r.match(/^[a-z0-9_]+$/)))return fail("manual reasons are invalid");
    const ordinaryHashes=ORDINARY.map(k=>hash(input.ordinaryEvidenceHashes[k],`ordinaryEvidenceHashes.${k}`));
    const disposition=manual.length?"manual_valuation_required" as const:"ordinary_final" as const;
    const expected=input.expectedCurrentValuationId===null?null:uuid(input.expectedCurrentValuationId,"expectedCurrentValuationId"),expectedHash=input.expectedCurrentEvidenceHash===null?null:hash(input.expectedCurrentEvidenceHash,"expectedCurrentEvidenceHash"),approval=input.approvalRequestId===null?null:uuid(input.approvalRequestId,"approvalRequestId");
    if((expected===null)!==(expectedHash===null))return fail("expected current id and hash must be supplied together");
    try{
      const replay=await new IndiaGstAccommodationQuotedRateApplicabilityService().resolve(tx,input.quotedRateApplicabilityInput);
      if(!same(replay,input.quotedRateApplicabilityResult)||replay.reservationLineage.reservationId!==reservation||replay.reservationLineage.folioId!==folio||input.quotedRateApplicabilityInput.propertyNode!==property||input.quotedRateApplicabilityInput.tenantId!==tenant)return fail("Order341 evidence does not byte-match exact valuation scope");
      const requestHash=digest({v:1,tenant,property,reservation,folio,buyer,order341:replay.evidenceHash,sources,ordinaryHashes,manual,expected,expectedHash,approval});
      const result=await this.#idempotency.execute<Record<string,JsonValue>>(tx,{tenantId:tenant,operation:"tax-fiscal.india-accommodation-final-valuation.finalize",key:input.idempotencyKey,request:{requestHash}},async q=>{
        const sourceIds=sources.map(s=>s.postingRootId);
        const rows=await q<SourceRow[]>`SELECT coalesce(line.folio_transfer_root_line_id,line.id)::text root_id,sum(line.amount_minor)::text amount_minor FROM public.posting_line line JOIN public.journal j ON j.tenant_id=line.tenant_id AND j.id=line.journal_id WHERE line.tenant_id=${tenant}::uuid AND line.folio_id=${folio}::uuid AND coalesce(line.folio_transfer_root_line_id,line.id)=ANY(${sourceIds}::uuid[]) AND j.currency='INR' AND NOT EXISTS(SELECT 1 FROM public.journal reversal WHERE reversal.tenant_id=j.tenant_id AND reversal.reverses=j.id) GROUP BY coalesce(line.folio_transfer_root_line_id,line.id) ORDER BY coalesce(line.folio_transfer_root_line_id,line.id)`;
        const amountByRoot=new Map(rows.map(r=>[r.root_id,r.amount_minor]));if(amountByRoot.size!==sources.length)throw new IndiaGstAccommodationFinalValuationConflictError("Complete locked posting source set is unavailable");
        const weights=Object.freeze(replay.components.map(c=>Object.freeze({ordinal:c.ordinal,weightMinor:c.quotedAmountMinor})));
        const allocations=disposition==="ordinary_final"?sources.flatMap(s=>allocateSignedLargestRemainder(amountByRoot.get(s.postingRootId)!,weights).map(a=>BigInt(a.amountMinor))):[];
        const evidenceHash=digest({v:1,requestHash,amounts:sources.map(s=>[s.postingRootId,amountByRoot.get(s.postingRootId)]),allocations:allocations.map(String)});
        const capability=await q<CapabilityRow[]>`SELECT * FROM public.record_india_gst_accommodation_final_valuation(${tenant}::uuid,${property}::uuid,${reservation}::uuid,${folio}::uuid,${buyer}::uuid,${input.quotedRateApplicabilityInput.attributionId}::uuid,${requestId}::uuid,${actor}::uuid,${disposition},${replay.evidenceHash},${requestHash},${evidenceHash},${expected}::uuid,${expectedHash},${approval}::uuid,${disposition==="ordinary_final"?ordinaryHashes:[]}::text[],${manual}::text[],${sourceIds}::uuid[],${sources.map(s=>s.sourceKind)}::text[],${sources.map(s=>s.classificationEvidenceHash)}::text[],${sources.map(s=>s.eligibilityEvidenceHash??"")}::text[],${replay.components.map(c=>Number(c.ordinal))}::integer[],${replay.components.map(c=>c.businessDate)}::date[],${replay.components.map(c=>BigInt(c.quotedAmountMinor))}::bigint[],${allocations}::bigint[])`;
        const row=capability[0];if(capability.length!==1||!row||row.evidence_hash!==evidenceHash)throw new IndiaGstAccommodationFinalValuationConflictError("Final valuation capability returned invalid evidence");
        return {status:201,body:{valuationId:row.valuation_id,generation:row.generation,disposition:row.disposition,transactionValueMinor:row.transaction_value_minor,evidenceHash:row.evidence_hash}};
      });
      return {...result.body,replayed:result.replayed} as IndiaGstAccommodationFinalValuationResult;
    }catch(error){return mapDbError(error);}
  }
}
