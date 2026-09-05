import { recordFact, type AuditEnvelope, type EventBus, type JsonValue, type PostgresIdempotency, type Tx } from "../../kernel";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY=/^[\x21-\x7e]{8,200}$/;
const INVISIBLE=/[\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;
const OPERATION="financials.india-final-component-tax.reverse";
const REVERSAL_ENTITY="india_gst_accommodation_final_component_tax_journal_reversed";

export interface IndiaFinalComponentTaxCorrectionInput {
  readonly tenantId:string;
  readonly propertyNode:string;
  readonly originalJournalId:string;
  readonly reason:string;
  readonly idempotencyKey:string;
  readonly envelope:AuditEnvelope;
}
export interface IndiaFinalComponentTaxCorrectionResult {
  readonly state:"reversed"; readonly reversalBindingId:string; readonly postingBindingId:string;
  readonly taxId:string; readonly journalId:string; readonly originalJournalId:string;
  readonly reservationId:string; readonly folioId:string; readonly businessDate:string;
  readonly currency:"INR"; readonly lineCount:number; readonly created:boolean; readonly replayed:boolean;
}
export interface IndiaFinalComponentTaxCorrectionServiceOptions { readonly events:EventBus; readonly idempotency:PostgresIdempotency }
interface Input extends IndiaFinalComponentTaxCorrectionInput {}
interface Context { original_journal_id:string; posting_binding_id:string; tax_id:string; tax_generation:number; valuation_id:string; valuation_generation:number; applicability_id:string; reservation_id:string; folio_id:string; guest_account_id:string; context_property_node:string; original_business_date:string; current_business_date:string; currency:string; source_governed:boolean; actor_can_reverse:boolean; actor_can_post_seal:boolean }
interface Line { seq:number; account_id:string; folio_id:string|null; tx_code:string; description:string|null; amount_minor:string; quantity:string; tax_detail:unknown; folio_transfer_root_line_id:string|null; business_date:string; currency:string; account_role:string; account_status:string; account_property_node:string|null; account_currency:string }
interface Evidence { readonly context:Context; readonly lines:readonly Line[]; readonly accountIds:readonly string[] }
interface Binding { reversal_binding_id:string; posting_binding_id:string; tax_id:string; original_journal_id:string; reversal_journal_id:string; reservation_id:string; folio_id:string; business_date:string; currency:string; line_count:number; created:boolean }
interface Body extends Readonly<Record<string,JsonValue>> { readonly state:"reversed"; readonly reversalBindingId:string; readonly postingBindingId:string; readonly taxId:string; readonly journalId:string; readonly originalJournalId:string; readonly reservationId:string; readonly folioId:string; readonly businessDate:string; readonly currency:"INR"; readonly lineCount:number; readonly created:boolean }

export class IndiaFinalComponentTaxCorrectionValidationError extends Error { constructor(message:string){super(message);this.name="IndiaFinalComponentTaxCorrectionValidationError"} }
export class IndiaFinalComponentTaxCorrectionNotFoundError extends Error { constructor(message:string){super(message);this.name="IndiaFinalComponentTaxCorrectionNotFoundError"} }
export class IndiaFinalComponentTaxCorrectionConflictError extends Error { constructor(message:string){super(message);this.name="IndiaFinalComponentTaxCorrectionConflictError"} }
export class IndiaFinalComponentTaxCorrectionAuthorizationError extends Error { constructor(message:string){super(message);this.name="IndiaFinalComponentTaxCorrectionAuthorizationError"} }

function object(name:string,value:unknown):asserts value is Record<string,unknown>{
  if(typeof value!=="object"||value===null||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Object.getOwnPropertySymbols(value).length||Object.values(Object.getOwnPropertyDescriptors(value)).some(x=>x.get||x.set)) throw new IndiaFinalComponentTaxCorrectionValidationError(`${name} must be a plain object`);
}
function keys(name:string,value:Record<string,unknown>,allowed:readonly string[]){const extra=Object.getOwnPropertyNames(value).filter(x=>!allowed.includes(x));if(extra.length)throw new IndiaFinalComponentTaxCorrectionValidationError(`${name} contains unsupported fields: ${extra.sort().join(", ")}`)}
function uuid(name:string,value:unknown){if(typeof value!=="string"||!UUID.test(value))throw new IndiaFinalComponentTaxCorrectionValidationError(`${name} must be a lowercase UUID`);return value}
function normalize(value:IndiaFinalComponentTaxCorrectionInput):Input{
  object("India component-tax correction input",value);keys("India component-tax correction input",value,["tenantId","propertyNode","originalJournalId","reason","idempotencyKey","envelope"]);
  object("envelope",value.envelope);keys("envelope",value.envelope,["actorId","tenantId","propertyNode","requestId","operation"]);
  const tenantId=uuid("tenantId",value.tenantId),propertyNode=uuid("propertyNode",value.propertyNode);
  if(uuid("envelope.tenantId",value.envelope.tenantId)!==tenantId||uuid("envelope.propertyNode",value.envelope.propertyNode)!==propertyNode)throw new IndiaFinalComponentTaxCorrectionValidationError("Correction identity must match the audit envelope");
  uuid("envelope.actorId",value.envelope.actorId);uuid("envelope.requestId",value.envelope.requestId);
  if(value.envelope.operation!=="journal.posted")throw new IndiaFinalComponentTaxCorrectionValidationError("audit operation must be journal.posted");
  if(typeof value.reason!=="string"||value.reason.length<1||value.reason.length>500||value.reason.trim()!==value.reason||/[\u0000-\u001f\u007f]/.test(value.reason)||INVISIBLE.test(value.reason))throw new IndiaFinalComponentTaxCorrectionValidationError("reason must be trimmed visible text of 1 to 500 characters");
  if(typeof value.idempotencyKey!=="string"||!KEY.test(value.idempotencyKey))throw new IndiaFinalComponentTaxCorrectionValidationError("idempotencyKey must contain 8-200 visible ASCII characters");
  return Object.freeze({...value,tenantId,propertyNode,originalJournalId:uuid("originalJournalId",value.originalJournalId),envelope:Object.freeze({...value.envelope})});
}
function canonical(e:Evidence){return JSON.stringify({context:e.context,lines:e.lines,accountIds:e.accountIds})}
function validate(context:Context,lines:readonly Line[]):Evidence{
  if(!context.source_governed||context.currency!=="INR")throw new IndiaFinalComponentTaxCorrectionConflictError("Journal is not a current governed India component-tax posting");
  if(!context.actor_can_reverse)throw new IndiaFinalComponentTaxCorrectionAuthorizationError("Financial correction authority is required for this property");
  if(lines.length<3||lines.length>5)throw new IndiaFinalComponentTaxCorrectionConflictError("Original component-tax line set is incomplete");
  let balance=0n;
  for(const [i,line] of lines.entries()){
    if(line.seq!==i+1||line.business_date!==context.original_business_date||line.currency!=="INR"||line.account_status!=="open"||line.account_property_node!==context.context_property_node||line.account_currency!=="INR"||line.description===null||line.folio_transfer_root_line_id!==null)throw new IndiaFinalComponentTaxCorrectionConflictError("Original component-tax line truth is inconsistent");
    balance+=BigInt(line.amount_minor);
  }
  const root=lines[0]!,revenue=lines[1]!;
  if(root.account_id!==context.guest_account_id||root.folio_id!==context.folio_id||root.account_role!=="guest"||BigInt(root.amount_minor)<=0n||root.tax_detail===null||revenue.folio_id!==null||revenue.account_role!=="revenue"||BigInt(revenue.amount_minor)>=0n||revenue.tax_detail!==null||lines.slice(2).some(x=>x.folio_id!==null||x.account_role!=="tax_payable"||BigInt(x.amount_minor)>=0n||x.tax_detail!==null)||balance!==0n)throw new IndiaFinalComponentTaxCorrectionConflictError("Original component-tax topology is incomplete or unbalanced");
  const detail=root.tax_detail as Record<string,unknown>,tax=detail?.tax as Record<string,unknown>,posting=detail?.posting as Record<string,unknown>;
  if(detail?.schemaVersion!=="india_accommodation_component_tax_v1"||tax?.taxId!==context.tax_id||posting?.journalId!==context.original_journal_id)throw new IndiaFinalComponentTaxCorrectionConflictError("Original component-tax lineage is inconsistent");
  return Object.freeze({context:Object.freeze({...context}),lines:Object.freeze(lines.map(x=>Object.freeze({...x}))),accountIds:Object.freeze([...new Set(lines.map(x=>x.account_id))].sort())});
}

async function readOriginal(tx:Tx,i:Input):Promise<Evidence>{
  const context=(await tx<Context[]>`SELECT original.id::text original_journal_id,binding.id::text posting_binding_id,binding.tax_id::text,binding.tax_generation::int,binding.valuation_id::text,binding.valuation_generation::int,binding.applicability_id::text,binding.reservation_id::text,binding.folio_id::text,binding.guest_account_id::text,binding.property_node::text context_property_node,original.business_date::text original_business_date,(transaction_timestamp() AT TIME ZONE property.timezone)::date::text current_business_date,original.currency::text,original.kind='charge' AND original.reverses IS NULL AND original.source=jsonb_build_object('interface','financials.india-final-component-tax.post','tax_id',binding.tax_id::text) AND NOT EXISTS(SELECT 1 FROM india_gst_accommodation_final_component_tax successor WHERE successor.tenant_id=tax.tenant_id AND successor.supersedes_tax_id=tax.id) source_governed,EXISTS(SELECT 1 FROM app_user actor JOIN user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id JOIN role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='financials.adjustments:write' JOIN org_node scope ON scope.tenant_id=ur.tenant_id AND scope.id=ur.scope_node WHERE actor.tenant_id=binding.tenant_id AND actor.id=${i.envelope.actorId}::uuid AND actor.status='active' AND scope.path @> property.path) actor_can_reverse,EXISTS(SELECT 1 FROM app_user actor JOIN user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id JOIN role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='financials.adjustments:post-seal' JOIN org_node scope ON scope.tenant_id=ur.tenant_id AND scope.id=ur.scope_node WHERE actor.tenant_id=binding.tenant_id AND actor.id=${i.envelope.actorId}::uuid AND actor.status='active' AND scope.path @> property.path) actor_can_post_seal FROM india_gst_accommodation_final_component_tax_journal_binding binding JOIN journal original ON original.tenant_id=binding.tenant_id AND original.id=binding.journal_id JOIN india_gst_accommodation_final_component_tax tax ON tax.tenant_id=binding.tenant_id AND tax.id=binding.tax_id AND tax.generation=binding.tax_generation AND tax.evidence_hash=binding.tax_evidence_hash AND tax.valuation_id=binding.valuation_id AND tax.valuation_generation=binding.valuation_generation AND tax.applicability_id=binding.applicability_id JOIN org_node property ON property.tenant_id=binding.tenant_id AND property.id=binding.property_node AND property.kind='property' WHERE binding.tenant_id=${i.tenantId}::uuid AND binding.tenant_id=current_setting('app.tenant_id',true)::uuid AND binding.property_node=${i.propertyNode}::uuid AND binding.journal_id=${i.originalJournalId}::uuid`)[0];
  if(!context)throw new IndiaFinalComponentTaxCorrectionNotFoundError("Governed India component-tax journal was not found in the audit property");
  const lines=await tx<Line[]>`SELECT line.seq::int,line.account_id::text,line.folio_id::text,line.tx_code,line.description,line.amount_minor::text,line.quantity::text,line.tax_detail,line.folio_transfer_root_line_id::text,line.business_date::text,line.currency::text,account.role account_role,account.status account_status,account.property_node::text account_property_node,account.currency::text account_currency FROM posting_line line JOIN account ON account.tenant_id=line.tenant_id AND account.id=line.account_id WHERE line.tenant_id=${i.tenantId}::uuid AND line.tenant_id=current_setting('app.tenant_id',true)::uuid AND line.journal_id=${i.originalJournalId}::uuid ORDER BY line.seq`;
  return validate(context,lines);
}
function resultBody(binding:Binding):Body{return Object.freeze({state:"reversed",reversalBindingId:binding.reversal_binding_id,postingBindingId:binding.posting_binding_id,taxId:binding.tax_id,journalId:binding.reversal_journal_id,originalJournalId:binding.original_journal_id,reservationId:binding.reservation_id,folioId:binding.folio_id,businessDate:binding.business_date,currency:"INR",lineCount:Number(binding.line_count),created:binding.created})}
async function existing(tx:Tx,i:Input):Promise<Binding|undefined>{return (await tx<Binding[]>`SELECT reversal.id::text reversal_binding_id,reversal.posting_binding_id::text,reversal.tax_id::text,reversal.original_journal_id::text,reversal.reversal_journal_id::text,reversal.reservation_id::text,reversal.folio_id::text,reversal.business_date::text,reversal.currency::text,count(line.id)::int line_count,false created FROM india_gst_final_component_tax_journal_reversal_binding reversal JOIN posting_line line ON line.tenant_id=reversal.tenant_id AND line.journal_id=reversal.reversal_journal_id WHERE reversal.tenant_id=${i.tenantId}::uuid AND reversal.tenant_id=current_setting('app.tenant_id',true)::uuid AND reversal.property_node=${i.propertyNode}::uuid AND reversal.original_journal_id=${i.originalJournalId}::uuid GROUP BY reversal.tenant_id,reversal.id`)[0]}

export class IndiaFinalComponentTaxCorrectionService{
  readonly #events:EventBus;readonly #idempotency:PostgresIdempotency;
  constructor(options:IndiaFinalComponentTaxCorrectionServiceOptions){this.#events=options.events;this.#idempotency=options.idempotency}
  async reverse(tx:Tx,input:IndiaFinalComponentTaxCorrectionInput):Promise<IndiaFinalComponentTaxCorrectionResult>{
    if(typeof tx!=="function")throw new IndiaFinalComponentTaxCorrectionValidationError("tenant transaction is unavailable");const i=normalize(input);
    try{
      const tenant=(await tx<Array<{tenant_id:string|null}>>`SELECT current_setting('app.tenant_id',true) tenant_id`)[0];if(tenant?.tenant_id!==i.tenantId)throw new IndiaFinalComponentTaxCorrectionNotFoundError("Governed India component-tax journal was not found in the audit property");
      const out=await this.#idempotency.execute<Body>(tx,{tenantId:i.tenantId,operation:OPERATION,key:i.idempotencyKey,request:{actorId:i.envelope.actorId,propertyNode:i.propertyNode,originalJournalId:i.originalJournalId,reason:i.reason}},async q=>{
        const discovered=await readOriginal(q,i);
        await q`SELECT public.lock_positive_tax_posting_rows(${i.tenantId}::uuid,ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(${JSON.stringify(discovered.accountIds)}::jsonb) requested(value) ORDER BY value::uuid)::uuid[],${discovered.context.folio_id}::uuid)`;
        await q`SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(${`${i.tenantId}:india-final-component-tax-correction:${i.originalJournalId}`},408))`;
        const locked=await readOriginal(q,i);if(canonical(discovered)!==canonical(locked))throw new IndiaFinalComponentTaxCorrectionConflictError("Original component-tax truth changed during lock acquisition");
        const prior=await existing(q,i);if(prior)return {status:200,body:resultBody(prior)};
        const dates=[...new Set([locked.context.original_business_date,locked.context.current_business_date])].sort();
        if(dates.length===1)await q`SELECT public.lock_financial_business_days(${i.tenantId}::uuid,${i.propertyNode}::uuid,ARRAY[${dates[0]}::date]::date[])`;else await q`SELECT public.lock_financial_business_days(${i.tenantId}::uuid,${i.propertyNode}::uuid,ARRAY[${dates[0]}::date,${dates[1]}::date]::date[])`;
        const days=await q<Array<{business_date:string;sealed_at:Date|null}>>`SELECT business_date::text,sealed_at FROM business_day WHERE tenant_id=${i.tenantId}::uuid AND tenant_id=current_setting('app.tenant_id',true)::uuid AND property_node=${i.propertyNode}::uuid AND business_date=ANY(ARRAY[${locked.context.original_business_date}::date,${locked.context.current_business_date}::date]::date[]) ORDER BY business_date`;
        if(days.length!==dates.length||days.some((x,n)=>x.business_date!==dates[n])||days.find(x=>x.business_date===locked.context.current_business_date)?.sealed_at!==null)throw new IndiaFinalComponentTaxCorrectionConflictError("Required current property business day is missing or sealed");
        if(days.find(x=>x.business_date===locked.context.original_business_date)?.sealed_at!==null&&!locked.context.actor_can_post_seal)throw new IndiaFinalComponentTaxCorrectionAuthorizationError("Post-seal financial correction authority is required");
        const final=await readOriginal(q,i);if(canonical(locked)!==canonical(final))throw new IndiaFinalComponentTaxCorrectionConflictError("Original component-tax truth changed before reversal");
        const header=(await q<Array<{journal_id:string;business_date:string;currency:string}>>`SELECT result.journal_id::text,result.business_date::text,result.currency::text FROM public.create_india_final_component_tax_correction_header(${i.tenantId}::uuid,${i.originalJournalId}::uuid,${i.propertyNode}::uuid,${i.reason},${i.envelope.actorId}::uuid) result`)[0];
        if(!header||header.business_date!==final.context.current_business_date||header.currency!=="INR")throw new IndiaFinalComponentTaxCorrectionConflictError("PostgreSQL did not create the reversal header coherently");
        for(const line of final.lines.slice(1))await q`INSERT INTO posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,amount_minor,quantity,business_date,currency) VALUES(${i.tenantId}::uuid,${header.journal_id}::uuid,${line.seq}::smallint,${line.account_id}::uuid,${line.folio_id}::uuid,${line.tx_code},${line.description},${-BigInt(line.amount_minor)},${line.quantity}::numeric(10,3),${header.business_date}::date,${header.currency}::char(3))`;
        const binding=(await q<Binding[]>`SELECT result.reversal_binding_id::text,result.posting_binding_id::text,result.tax_id::text,result.original_journal_id::text,result.reversal_journal_id::text,result.reservation_id::text,result.folio_id::text,result.business_date::text,result.currency::text,result.line_count::int,result.created FROM public.record_india_final_component_tax_journal_reversal(${i.tenantId}::uuid,${i.propertyNode}::uuid,${i.envelope.actorId}::uuid,${i.originalJournalId}::uuid,${header.journal_id}::uuid,${final.context.actor_can_post_seal}) result`)[0];
        if(!binding||!binding.created||binding.posting_binding_id!==final.context.posting_binding_id||binding.tax_id!==final.context.tax_id||binding.reversal_journal_id!==header.journal_id||binding.business_date!==header.business_date||binding.currency!==header.currency||Number(binding.line_count)!==final.lines.length)throw new IndiaFinalComponentTaxCorrectionConflictError("PostgreSQL did not bind the exact reversal coherently");
        const journalPayload=Object.freeze({journal_id:header.journal_id,kind:"adjustment",reverses_journal_id:i.originalJournalId,posting_binding_id:binding.posting_binding_id,tax_id:binding.tax_id,reservation_id:binding.reservation_id,folio_id:binding.folio_id,lines:Object.freeze(final.lines.map(x=>Object.freeze({seq:x.seq,account:x.account_id,...(x.folio_id?{folio:x.folio_id}:{}),tx_code:x.tx_code,amount_minor:(-BigInt(x.amount_minor)).toString()})))});
        const jf=await recordFact(q,{entityType:"journal",entityId:header.journal_id,envelope:i.envelope,payload:journalPayload});if(jf.businessDate!==binding.business_date)throw new Error("journal audit date mismatch");
        await this.#events.publish(q,{tenantId:i.tenantId,propertyNode:i.propertyNode,businessDate:binding.business_date,aggregateType:"journal",aggregateId:header.journal_id,eventType:"journal.posted",actorId:i.envelope.actorId,correlationId:i.envelope.requestId,payload:journalPayload});
        const reversalPayload=Object.freeze({effect:"full_reversal",reversal_binding_id:binding.reversal_binding_id,posting_binding_id:binding.posting_binding_id,tax_id:binding.tax_id,original_journal_id:i.originalJournalId,reversal_journal_id:header.journal_id,reservation_id:binding.reservation_id,folio_id:binding.folio_id,currency:"INR"});
        const envelope=Object.freeze({...i.envelope,operation:"india_gst.accommodation_final_component_tax_journal_reversed"});const rf=await recordFact(q,{entityType:REVERSAL_ENTITY,entityId:binding.reversal_binding_id,envelope,payload:reversalPayload});if(rf.businessDate!==binding.business_date)throw new Error("reversal audit date mismatch");
        await this.#events.publish(q,{tenantId:i.tenantId,propertyNode:i.propertyNode,businessDate:binding.business_date,aggregateType:"india_gst_final_component_tax_journal_reversal_binding",aggregateId:binding.reversal_binding_id,eventType:"india_gst.accommodation_final_component_tax_journal_reversed",actorId:i.envelope.actorId,correlationId:i.envelope.requestId,payload:reversalPayload});
        return {status:201,body:resultBody(binding)};
      });return Object.freeze({...out.body,replayed:out.replayed});
    }catch(e){if(e instanceof IndiaFinalComponentTaxCorrectionValidationError||e instanceof IndiaFinalComponentTaxCorrectionNotFoundError||e instanceof IndiaFinalComponentTaxCorrectionConflictError||e instanceof IndiaFinalComponentTaxCorrectionAuthorizationError)return Promise.reject(e);const code=String((e as {errno?:string;code?:string}).errno??(e as {code?:string}).code);if(code==="42501")throw new IndiaFinalComponentTaxCorrectionAuthorizationError("India component-tax reversal authority is required");if(["23505","40001","40P01","55000","P0011"].includes(code))throw new IndiaFinalComponentTaxCorrectionConflictError("India component-tax reversal conflicted with current authority");throw e;}
  }
}
