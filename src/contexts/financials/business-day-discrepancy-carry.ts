import {
  ApprovalService,
  IdempotencyConflictError,
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/; const HASH=/^[0-9a-f]{64}$/; const KEY=/^[\x21-\x7e]{8,200}$/;
export class BusinessDayDiscrepancyCarryValidationError extends Error { constructor(m:string){super(m);this.name="BusinessDayDiscrepancyCarryValidationError";} }
export class BusinessDayDiscrepancyCarryConflictError extends Error { constructor(m:string){super(m);this.name="BusinessDayDiscrepancyCarryConflictError";} }
export interface RequestBusinessDayDiscrepancyCarryApprovalInput { readonly tenantId:string; readonly propertyNode:string; readonly discrepancyId:string; readonly sourceBusinessDate:string; readonly targetBusinessDate:string; readonly reason:string; readonly idempotencyKey:string; readonly envelope:AuditEnvelope; }
export interface ConsumeBusinessDayDiscrepancyCarryInput { readonly tenantId:string; readonly approvalId:string; readonly expectedRequestHash:string; readonly idempotencyKey:string; readonly envelope:AuditEnvelope; }
export interface BusinessDayDiscrepancyCarryApproval extends Readonly<Record<string,JsonValue>> { readonly approvalId:string; readonly discrepancyStateHash:string; readonly requestHash:string; readonly createdAt:string; readonly replayed:boolean; }
export interface BusinessDayDiscrepancyCarryResult extends Readonly<Record<string,JsonValue>> { readonly carryId:string; readonly sourceDiscrepancyId:string; readonly targetDiscrepancyId:string; readonly propertyNode:string; readonly sourceBusinessDate:string; readonly targetBusinessDate:string; readonly resolution:"carried_forward"; readonly requestHash:string; readonly replayed:boolean; }
export interface BusinessDayDiscrepancyCarryServiceOptions { readonly events:EventBus; readonly idempotency:PostgresIdempotency; }
interface Prep {discrepancy_state_hash:string;request_hash:string;approval_payload:Record<string,unknown>}
interface Carry {carry_id:string;source_discrepancy_id:string;target_discrepancy_id:string;property_node:string;source_business_date:string;target_business_date:string;resolution:string;request_hash:string}
function plain(v:unknown,n:string):asserts v is Record<string,unknown>{if(typeof v!=="object"||v===null||Array.isArray(v)||Object.getOwnPropertySymbols(v).length)throw new BusinessDayDiscrepancyCarryValidationError(`${n} must be a plain object`);}
function exact(v:Record<string,unknown>,keys:readonly string[],n:string){if(Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))throw new BusinessDayDiscrepancyCarryValidationError(`${n} shape is invalid`);}
function uuid(v:unknown,n:string){if(typeof v!=="string"||!UUID.test(v))throw new BusinessDayDiscrepancyCarryValidationError(`${n} must be a lowercase UUID`);return v;}
function date(v:unknown,n:string){if(typeof v!=="string"||!DATE.test(v)||Number.isNaN(Date.parse(`${v}T00:00:00Z`)))throw new BusinessDayDiscrepancyCarryValidationError(`${n} is invalid`);return v;}
function key(v:unknown){if(typeof v!=="string"||!KEY.test(v))throw new BusinessDayDiscrepancyCarryValidationError("idempotencyKey is invalid");return v;}
function env(v:unknown,tenant:string,property:string|undefined,operation:string):AuditEnvelope{plain(v,"envelope");exact(v,["actorId","tenantId","propertyNode","requestId","operation"],"envelope");if(uuid(v.tenantId,"envelope tenant")!==tenant||(property!==undefined&&uuid(v.propertyNode,"envelope property")!==property)||v.operation!==operation)throw new BusinessDayDiscrepancyCarryValidationError("envelope binding is invalid");return v as unknown as AuditEnvelope;}
function reason(v:unknown){if(typeof v!=="string"||v!==v.trim()||v!==v.normalize("NFC")||v.length<1||new TextEncoder().encode(v).length>500||/[\x00-\x1f\x7f]/u.test(v))throw new BusinessDayDiscrepancyCarryValidationError("reason is invalid");return v;}
function translate(e:unknown):never{if(e instanceof IdempotencyConflictError)throw new BusinessDayDiscrepancyCarryConflictError(e.message);const x=e as {code?:string;errno?:string};if(["23505","40001","40P01","55000","42501"].includes(x.code??x.errno??""))throw new BusinessDayDiscrepancyCarryConflictError("discrepancy carry evidence is unavailable or stale");throw e;}
export class BusinessDayDiscrepancyCarryService {
 readonly #events:EventBus; readonly #idempotency:PostgresIdempotency; readonly #approvals:ApprovalService;
 constructor(o:BusinessDayDiscrepancyCarryServiceOptions){this.#events=o.events;this.#idempotency=o.idempotency;this.#approvals=new ApprovalService(o.events);}
 async requestApproval(tx:Tx,input:RequestBusinessDayDiscrepancyCarryApprovalInput):Promise<BusinessDayDiscrepancyCarryApproval>{
  plain(input,"request");exact(input,["tenantId","propertyNode","discrepancyId","sourceBusinessDate","targetBusinessDate","reason","idempotencyKey","envelope"],"request");
  const tenant=uuid(input.tenantId,"tenantId"),property=uuid(input.propertyNode,"propertyNode"),discrepancy=uuid(input.discrepancyId,"discrepancyId"),source=date(input.sourceBusinessDate,"source date"),target=date(input.targetBusinessDate,"target date"),why=reason(input.reason),envelope=env(input.envelope,tenant,property,"approval.requested");key(input.idempotencyKey);
  try {const out=await this.#idempotency.execute<BusinessDayDiscrepancyCarryApproval>(tx,{tenantId:tenant,operation:"financials.business-day.discrepancy-carry.request",key:input.idempotencyKey,request:{actorId:envelope.actorId,propertyNode:property,discrepancyId:discrepancy,sourceBusinessDate:source,targetBusinessDate:target,reason:why}},async q=>{
   const rows=await q<Prep[]>`SELECT * FROM public.prepare_business_day_discrepancy_carry(${tenant}::uuid,${property}::uuid,${discrepancy}::uuid,${source}::date,${target}::date,${why},${envelope.requestId}::uuid,${envelope.actorId}::uuid)`; const p=rows[0]; if(rows.length!==1||!p||!HASH.test(p.request_hash)||!HASH.test(p.discrepancy_state_hash))throw new Error("invalid preparation evidence");
   const approval=await this.#approvals.request(q,{kind:"business_day_discrepancy_carry",subjectType:"discrepancy",subjectId:discrepancy,requestedBy:envelope.actorId,payload:p.approval_payload,envelope});
   return {status:201,body:{approvalId:approval.id,discrepancyStateHash:p.discrepancy_state_hash,requestHash:p.request_hash,createdAt:approval.createdAt.toISOString(),replayed:false}};
  });return Object.freeze({...out.body,replayed:out.replayed});}catch(e){return translate(e);}
 }
 async carry(tx:Tx,input:ConsumeBusinessDayDiscrepancyCarryInput):Promise<BusinessDayDiscrepancyCarryResult>{
  plain(input,"carry");exact(input,["tenantId","approvalId","expectedRequestHash","idempotencyKey","envelope"],"carry");const tenant=uuid(input.tenantId,"tenantId"),approval=uuid(input.approvalId,"approvalId");if(typeof input.expectedRequestHash!=="string"||!HASH.test(input.expectedRequestHash))throw new BusinessDayDiscrepancyCarryValidationError("expectedRequestHash is invalid");key(input.idempotencyKey);const envelope=env(input.envelope,tenant,undefined,"discrepancy.carried");
  try {const out=await this.#idempotency.execute<BusinessDayDiscrepancyCarryResult>(tx,{tenantId:tenant,operation:"financials.business-day.discrepancy-carry.consume",key:input.idempotencyKey,request:{actorId:envelope.actorId,approvalId:approval,expectedRequestHash:input.expectedRequestHash}},async q=>{
   const rows=await q<Carry[]>`SELECT * FROM public.carry_business_day_discrepancy(${tenant}::uuid,${approval}::uuid,${input.expectedRequestHash},${envelope.requestId}::uuid,${envelope.actorId}::uuid)`;const r=rows[0];if(rows.length!==1||!r||r.resolution!=="carried_forward"||r.request_hash!==input.expectedRequestHash)throw new Error("invalid carry evidence");
   const payload={carry_id:r.carry_id,source_discrepancy_id:r.source_discrepancy_id,target_discrepancy_id:r.target_discrepancy_id,source_business_date:r.source_business_date,target_business_date:r.target_business_date,resolution:"carried_forward",request_hash:r.request_hash};
   const fact=await recordFact(q,{entityType:"business_day_discrepancy_carry",entityId:r.carry_id,envelope:{...envelope,propertyNode:r.property_node},payload});await this.#events.publish(q,{tenantId:tenant,propertyNode:r.property_node,businessDate:r.target_business_date,aggregateType:"discrepancy",aggregateId:r.target_discrepancy_id,eventType:"discrepancy.carried",actorId:envelope.actorId,correlationId:envelope.requestId,payload});
   return {status:201,body:{carryId:r.carry_id,sourceDiscrepancyId:r.source_discrepancy_id,targetDiscrepancyId:r.target_discrepancy_id,propertyNode:r.property_node,sourceBusinessDate:r.source_business_date,targetBusinessDate:r.target_business_date,resolution:"carried_forward",requestHash:r.request_hash,replayed:false}};
  });return Object.freeze({...out.body,replayed:out.replayed});}catch(e){return translate(e);}
 }
}
