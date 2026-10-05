import {
  ApprovalConflictError,
  ApprovalService,
  IdempotencyConflictError,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";
import {
  TrustAccountingConflictError,
  TrustAccountingNotFoundError,
  TrustAccountingService,
  TrustAccountingValidationError,
  type PostOwnerExpenseResult,
} from "./trust";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const AMOUNT = /^[1-9][0-9]*$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
const MAX = 100;
const KIND = "owner_trust_negative_expense";
const SUBJECT = "account";
const MAKER = "financials.trust:post";
const CHECKER = "financials.trust:approve-negative";

export const MAX_OWNER_TRUST_ACCOUNTS = MAX;
export const MAX_OWNER_TRUST_APPROVALS = MAX;

export class OwnerTrustExpenseWorkbenchValidationError extends Error { constructor(message:string){super(message);this.name="OwnerTrustExpenseWorkbenchValidationError";} }
export class OwnerTrustExpenseWorkbenchNotFoundError extends Error { constructor(){super("Owner trust expense resource was not found or authorized");this.name="OwnerTrustExpenseWorkbenchNotFoundError";} }
export class OwnerTrustExpenseWorkbenchUnavailableError extends Error { constructor(){super("Owner trust expense state is unavailable or stale");this.name="OwnerTrustExpenseWorkbenchUnavailableError";} }

export interface ListOwnerTrustAccountsInput { readonly tenantId:string; readonly propertyNode:string; readonly actorId:string; }
export interface OwnerTrustAccountView { readonly accountReference:string; readonly accountLabel:string; readonly ownerLabel:string; readonly currency:string; readonly availableBalanceMinor:string; readonly canPost:boolean; }
export interface PreviewOwnerTrustExpenseInput { readonly tenantId:string; readonly propertyNode:string; readonly actorId:string; readonly trustAccountId:string; readonly amountMinor:string; readonly reason:string; }
export interface OwnerTrustExpensePreview { readonly accountReference:string; readonly accountLabel:string; readonly ownerLabel:string; readonly currency:string; readonly amountMinor:string; readonly availableBalanceMinor:string; readonly projectedBalanceMinor:string; readonly approvalRequired:boolean; }
export interface RequestOwnerTrustApprovalInput extends PreviewOwnerTrustExpenseInput { readonly idempotencyKey:string; readonly envelope:AuditEnvelope; }
export interface OwnerTrustApprovalRequestResult extends Readonly<Record<string,JsonValue>> { readonly approvalId:string; readonly accountReference:string; readonly currency:string; readonly amountMinor:string; readonly projectedBalanceMinor:string; readonly status:"pending"; readonly requestedAt:string; readonly replayed:boolean; }
export interface ListOwnerTrustApprovalsInput { readonly tenantId:string; readonly propertyNode:string; readonly actorId:string; }
export interface OwnerTrustApprovalView { readonly approvalId:string; readonly accountReference:string; readonly accountLabel:string; readonly ownerLabel:string; readonly currency:string; readonly amountMinor:string; readonly availableBalanceMinor:string; readonly projectedBalanceMinor:string; readonly reason:string; readonly requesterLabel:string; readonly status:"pending"|"approved"|"rejected"|"expired"; readonly requestedAt:string; readonly decidedAt:string|null; readonly canDecide:boolean; readonly canPost:boolean; }
export interface DecideOwnerTrustApprovalInput { readonly tenantId:string; readonly propertyNode:string; readonly approvalId:string; readonly decision:"approved"|"rejected"; readonly idempotencyKey:string; readonly envelope:AuditEnvelope; }
export interface OwnerTrustApprovalDecisionResult extends Readonly<Record<string,JsonValue>> { readonly approvalId:string; readonly status:"approved"|"rejected"; readonly decidedAt:string; readonly replayed:boolean; }
export interface PostOwnerTrustExpenseWorkbenchInput { readonly tenantId:string; readonly propertyNode:string; readonly trustAccountId:string; readonly amountMinor:string; readonly reason:string; readonly approvalId?:string|null; readonly idempotencyKey:string; readonly envelope:AuditEnvelope; }

export interface OwnerTrustExpenseWorkbenchServiceOptions { readonly events:EventBus; readonly idempotency:PostgresIdempotency; }

interface PreparedRow { property_node:string;owner_party_id:string;owner_label:string;trust_account_id:string;trust_account_label:string;payable_account_id:string;currency:string;amount_minor:string;available_before_minor:string;projected_available_minor:string;approval_required:boolean;approval_payload:Record<string,unknown>; }
interface AccountRow { id:string;account_label:string;owner_label:string;currency:string;available_minor:string;can_post:boolean; }
interface ApprovalRow { id:string;subject_id:string;payload:Record<string,unknown>;status:"pending"|"approved"|"rejected"|"expired";requested_by:string;requester_label:string;created_at:Date;decided_at:Date|null;account_label:string;owner_label:string;currency:string;can_decide:boolean;can_post:boolean;consumed:boolean; }

function object(value:unknown,name:string):asserts value is Record<string,unknown>{if(typeof value!=="object"||value===null||Array.isArray(value)||Object.getOwnPropertySymbols(value).length)throw new OwnerTrustExpenseWorkbenchValidationError(`${name} must be a plain object`);}
function shape(value:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[],name="input"){const keys=Object.keys(value);if(required.some(k=>!Object.hasOwn(value,k))||keys.some(k=>!required.includes(k)&&!optional.includes(k)))throw new OwnerTrustExpenseWorkbenchValidationError(`${name} shape is invalid`);}
function uuid(value:unknown,name:string){if(typeof value!=="string"||!UUID.test(value))throw new OwnerTrustExpenseWorkbenchValidationError(`${name} must be a lowercase UUID`);return value;}
function money(value:unknown){if(typeof value!=="string"||!AMOUNT.test(value)||BigInt(value)>9223372036854775807n)throw new OwnerTrustExpenseWorkbenchValidationError("amountMinor must be a canonical positive signed-int64 decimal");return value;}
function reason(value:unknown){if(typeof value!=="string"||value!==value.trim()||value!==value.normalize("NFC")||new TextEncoder().encode(value).length<1||new TextEncoder().encode(value).length>500||/[\x00-\x1f\x7f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u.test(value))throw new OwnerTrustExpenseWorkbenchValidationError("reason is invalid");return value;}
function key(value:unknown){if(typeof value!=="string"||!KEY.test(value))throw new OwnerTrustExpenseWorkbenchValidationError("idempotencyKey is invalid");return value;}
function envelope(value:unknown,tenantId:string,propertyNode:string,operation:string){object(value,"envelope");shape(value,["tenantId","propertyNode","actorId","requestId","operation"],[],"envelope");if(uuid(value.tenantId,"envelope.tenantId")!==tenantId||uuid(value.propertyNode,"envelope.propertyNode")!==propertyNode||value.operation!==operation)throw new OwnerTrustExpenseWorkbenchValidationError("envelope binding is invalid");uuid(value.actorId,"envelope.actorId");uuid(value.requestId,"envelope.requestId");return value as unknown as AuditEnvelope;}
function stable(value:unknown):string{if(value===null||typeof value!=="object")return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(stable).join(",")}]`;return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;}
function evidence(value:unknown){object(value,"approval evidence");const keys=["ownerPartyId","trustAccountId","payableAccountId","amountMinor","availableBeforeMinor","projectedAvailableMinor","reason"] as const;shape(value,keys,[],"approval evidence");for(const k of ["ownerPartyId","trustAccountId","payableAccountId"] as const)uuid(value[k],k);money(value.amountMinor);reason(value.reason);if(typeof value.availableBeforeMinor!=="string"||!/^0$|^-?[1-9][0-9]*$/.test(value.availableBeforeMinor)||typeof value.projectedAvailableMinor!=="string"||!/^0$|^-?[1-9][0-9]*$/.test(value.projectedAvailableMinor))throw new OwnerTrustExpenseWorkbenchUnavailableError();return value as unknown as Record<(typeof keys)[number],string>;}
function translate(error:unknown):never{if(error instanceof OwnerTrustExpenseWorkbenchValidationError||error instanceof OwnerTrustExpenseWorkbenchNotFoundError||error instanceof OwnerTrustExpenseWorkbenchUnavailableError)throw error;if(error instanceof TrustAccountingValidationError)throw new OwnerTrustExpenseWorkbenchValidationError(error.message);if(error instanceof TrustAccountingNotFoundError)throw new OwnerTrustExpenseWorkbenchNotFoundError();if(error instanceof TrustAccountingConflictError||error instanceof IdempotencyConflictError||error instanceof ApprovalConflictError)throw new OwnerTrustExpenseWorkbenchUnavailableError();const state=(error as {code?:string;errno?:string}).code??(error as {errno?:string}).errno;if(state==="42501")throw new OwnerTrustExpenseWorkbenchNotFoundError();if(["55000","23505","40001","40P01","P0011"].includes(state??""))throw new OwnerTrustExpenseWorkbenchUnavailableError();if(["22023","22003"].includes(state??""))throw new OwnerTrustExpenseWorkbenchValidationError("owner trust expense input is invalid");throw error;}

export class OwnerTrustExpenseWorkbenchService {
  readonly #approvals:ApprovalService; readonly #idempotency:PostgresIdempotency; readonly #trust:TrustAccountingService;
  constructor(options:OwnerTrustExpenseWorkbenchServiceOptions){this.#approvals=new ApprovalService(options.events);this.#idempotency=options.idempotency;this.#trust=new TrustAccountingService(options);}

  async listAccounts(tx:Tx,raw:ListOwnerTrustAccountsInput):Promise<readonly OwnerTrustAccountView[]>{
    object(raw,"account list");shape(raw,["tenantId","propertyNode","actorId"],[],"account list");const tenantId=uuid(raw.tenantId,"tenantId"),propertyNode=uuid(raw.propertyNode,"propertyNode"),actorId=uuid(raw.actorId,"actorId");
    const rows=await tx<AccountRow[]>`SELECT trust.id,trust.name AS account_label,owner.display_name AS owner_label,trust.currency::text,
      (-COALESCE((SELECT sum(line.amount_minor::numeric) FROM posting_line line WHERE line.tenant_id=trust.tenant_id AND line.account_id=trust.id),0))::bigint::text AS available_minor,
      (EXISTS(SELECT 1 FROM app_user actor JOIN user_role actor_role ON actor_role.tenant_id=actor.tenant_id AND actor_role.user_id=actor.id AND actor_role.scope_node=${propertyNode}::uuid JOIN role_permission permission ON permission.role_id=actor_role.role_id AND permission.permission_code=${MAKER} WHERE actor.tenant_id=trust.tenant_id AND actor.id=${actorId}::uuid AND actor.status='active')
       AND EXISTS(SELECT 1 FROM tx_code_route route JOIN account payable ON payable.tenant_id=route.tenant_id AND payable.id=route.credit_account_id AND payable.property_node=route.property_node AND payable.currency=route.currency AND payable.role='payable' AND payable.status='open' WHERE route.tenant_id=trust.tenant_id AND route.property_node=trust.property_node AND route.currency=trust.currency AND route.tx_code='OWNER_TRUST_EXPENSE' AND route.debit_account_id=trust.id)) AS can_post
      FROM account trust JOIN party owner ON owner.tenant_id=trust.tenant_id AND owner.id=trust.party_id AND owner.status='active'
      JOIN party_role owner_role ON owner_role.tenant_id=owner.tenant_id AND owner_role.party_id=owner.id AND owner_role.role='owner'
      WHERE trust.tenant_id=${tenantId}::uuid AND trust.tenant_id=current_setting('app.tenant_id',true)::uuid AND trust.property_node=${propertyNode}::uuid AND trust.role='trust' AND trust.status='open'
      AND EXISTS(SELECT 1 FROM app_user actor JOIN user_role actor_role ON actor_role.tenant_id=actor.tenant_id AND actor_role.user_id=actor.id AND actor_role.scope_node=${propertyNode}::uuid JOIN role_permission permission ON permission.role_id=actor_role.role_id AND permission.permission_code=${MAKER} WHERE actor.tenant_id=trust.tenant_id AND actor.id=${actorId}::uuid AND actor.status='active')
      ORDER BY owner.display_name,trust.name,trust.id LIMIT ${MAX+1}`;
    if(rows.length>MAX)throw new OwnerTrustExpenseWorkbenchUnavailableError();
    return Object.freeze(rows.map(row=>Object.freeze({accountReference:row.id,accountLabel:row.account_label,ownerLabel:row.owner_label,currency:row.currency,availableBalanceMinor:row.available_minor,canPost:row.can_post})));
  }

  async previewExpense(tx:Tx,raw:PreviewOwnerTrustExpenseInput):Promise<OwnerTrustExpensePreview>{const n=this.#normalizePreview(raw);try{return this.#publicPreview(await this.#prepare(tx,n));}catch(error){return translate(error);}}

  async requestApproval(tx:Tx,raw:RequestOwnerTrustApprovalInput):Promise<OwnerTrustApprovalRequestResult>{
    object(raw,"approval request");shape(raw,["tenantId","propertyNode","actorId","trustAccountId","amountMinor","reason","idempotencyKey","envelope"],[],"approval request");const n=this.#normalizePreview({tenantId:raw.tenantId,propertyNode:raw.propertyNode,actorId:raw.actorId,trustAccountId:raw.trustAccountId,amountMinor:raw.amountMinor,reason:raw.reason}),audit=envelope(raw.envelope,n.tenantId,n.propertyNode,"approval.requested");if(audit.actorId!==n.actorId)throw new OwnerTrustExpenseWorkbenchValidationError("actor binding is invalid");key(raw.idempotencyKey);
    try{const result=await this.#idempotency.execute<OwnerTrustApprovalRequestResult>(tx,{tenantId:n.tenantId,operation:"financials.trust.owner-expense.approval.request",key:raw.idempotencyKey,request:{actorId:n.actorId,propertyNode:n.propertyNode,trustAccountId:n.trustAccountId,amountMinor:n.amountMinor,reason:n.reason}},async query=>{const prepared=await this.#prepare(query,n);if(!prepared.approval_required)throw new OwnerTrustExpenseWorkbenchUnavailableError();const approval=await this.#approvals.request(query,{kind:KIND,subjectType:SUBJECT,subjectId:n.trustAccountId,requestedBy:n.actorId,payload:prepared.approval_payload,envelope:audit});return {status:201,body:{approvalId:approval.id,accountReference:n.trustAccountId,currency:prepared.currency,amountMinor:n.amountMinor,projectedBalanceMinor:String(prepared.projected_available_minor),status:"pending",requestedAt:approval.createdAt.toISOString(),replayed:false}};});return Object.freeze({...result.body,replayed:result.replayed});}catch(error){return translate(error);}
  }

  async listApprovals(tx:Tx,raw:ListOwnerTrustApprovalsInput):Promise<readonly OwnerTrustApprovalView[]>{
    object(raw,"approval list");shape(raw,["tenantId","propertyNode","actorId"],[],"approval list");const tenantId=uuid(raw.tenantId,"tenantId"),propertyNode=uuid(raw.propertyNode,"propertyNode"),actorId=uuid(raw.actorId,"actorId");
    const rows=await tx<ApprovalRow[]>`SELECT approval.id,approval.subject_id,approval.payload,approval.status,approval.requested_by,requester.display_name AS requester_label,approval.created_at,approval.decided_at,trust.name AS account_label,owner.display_name AS owner_label,trust.currency::text,
      EXISTS(SELECT 1 FROM app_user actor JOIN user_role actor_role ON actor_role.tenant_id=actor.tenant_id AND actor_role.user_id=actor.id AND actor_role.scope_node=${propertyNode}::uuid JOIN role_permission permission ON permission.role_id=actor_role.role_id AND permission.permission_code=${CHECKER} WHERE actor.tenant_id=approval.tenant_id AND actor.id=${actorId}::uuid AND actor.status='active') AS can_decide,
      EXISTS(SELECT 1 FROM app_user actor JOIN user_role actor_role ON actor_role.tenant_id=actor.tenant_id AND actor_role.user_id=actor.id AND actor_role.scope_node=${propertyNode}::uuid JOIN role_permission permission ON permission.role_id=actor_role.role_id AND permission.permission_code=${MAKER} WHERE actor.tenant_id=approval.tenant_id AND actor.id=${actorId}::uuid AND actor.status='active') AS can_post,
      EXISTS(SELECT 1 FROM journal used WHERE used.tenant_id=approval.tenant_id AND used.approval_request_id=approval.id) AS consumed
      FROM approval_request approval JOIN account trust ON trust.tenant_id=approval.tenant_id AND trust.id=approval.subject_id AND trust.property_node=${propertyNode}::uuid AND trust.role='trust'
      JOIN party owner ON owner.tenant_id=trust.tenant_id AND owner.id=trust.party_id JOIN app_user requester ON requester.tenant_id=approval.tenant_id AND requester.id=approval.requested_by
      WHERE approval.tenant_id=${tenantId}::uuid AND approval.tenant_id=current_setting('app.tenant_id',true)::uuid AND approval.kind=${KIND} AND approval.subject_type=${SUBJECT}
      AND EXISTS(SELECT 1 FROM app_user actor JOIN user_role actor_role ON actor_role.tenant_id=actor.tenant_id AND actor_role.user_id=actor.id AND actor_role.scope_node=${propertyNode}::uuid JOIN role_permission permission ON permission.role_id=actor_role.role_id AND permission.permission_code IN (${MAKER},${CHECKER}) WHERE actor.tenant_id=approval.tenant_id AND actor.id=${actorId}::uuid AND actor.status='active')
      ORDER BY approval.created_at DESC,approval.id DESC LIMIT ${MAX+1}`;
    if(rows.length>MAX)throw new OwnerTrustExpenseWorkbenchUnavailableError();
    return Object.freeze(rows.map(row=>{const p=evidence(row.payload);if(p.trustAccountId!==row.subject_id)throw new OwnerTrustExpenseWorkbenchUnavailableError();return Object.freeze({approvalId:row.id,accountReference:row.subject_id,accountLabel:row.account_label,ownerLabel:row.owner_label,currency:row.currency,amountMinor:p.amountMinor,availableBalanceMinor:p.availableBeforeMinor,projectedBalanceMinor:p.projectedAvailableMinor,reason:p.reason,requesterLabel:row.requester_label,status:row.status,requestedAt:row.created_at.toISOString(),decidedAt:row.decided_at?.toISOString()??null,canDecide:row.status==="pending"&&row.requested_by!==actorId&&row.can_decide,canPost:row.status==="approved"&&row.requested_by===actorId&&row.can_post&&!row.consumed});}));
  }

  async decideApproval(tx:Tx,raw:DecideOwnerTrustApprovalInput):Promise<OwnerTrustApprovalDecisionResult>{
    object(raw,"approval decision");shape(raw,["tenantId","propertyNode","approvalId","decision","idempotencyKey","envelope"],[],"approval decision");const tenantId=uuid(raw.tenantId,"tenantId"),propertyNode=uuid(raw.propertyNode,"propertyNode"),approvalId=uuid(raw.approvalId,"approvalId");if(raw.decision!=="approved"&&raw.decision!=="rejected")throw new OwnerTrustExpenseWorkbenchValidationError("decision is invalid");const audit=envelope(raw.envelope,tenantId,propertyNode,"approval.decided");key(raw.idempotencyKey);
    try{const result=await this.#idempotency.execute<OwnerTrustApprovalDecisionResult>(tx,{tenantId,operation:`financials.trust.owner-expense.approval.${raw.decision}`,key:raw.idempotencyKey,request:{actorId:audit.actorId,propertyNode,approvalId,decision:raw.decision}},async query=>{const row=await this.#lockApproval(query,tenantId,propertyNode,approvalId,audit.actorId,"decide");const decided=await this.#approvals.decide(query,{approvalId,decision:raw.decision,decidedBy:audit.actorId,envelope:audit});if(!decided.decidedAt)throw new OwnerTrustExpenseWorkbenchUnavailableError();return {status:200,body:{approvalId,status:raw.decision,decidedAt:decided.decidedAt.toISOString(),replayed:false}};});return Object.freeze({...result.body,replayed:result.replayed});}catch(error){return translate(error);}
  }

  async postExpense(tx:Tx,raw:PostOwnerTrustExpenseWorkbenchInput):Promise<PostOwnerExpenseResult>{
    object(raw,"expense post");shape(raw,["tenantId","propertyNode","trustAccountId","amountMinor","reason","idempotencyKey","envelope"],["approvalId"],"expense post");const tenantId=uuid(raw.tenantId,"tenantId"),propertyNode=uuid(raw.propertyNode,"propertyNode"),trustAccountId=uuid(raw.trustAccountId,"trustAccountId"),amountMinor=money(raw.amountMinor),why=reason(raw.reason),audit=envelope(raw.envelope,tenantId,propertyNode,"journal.posted");key(raw.idempotencyKey);const approvalId=raw.approvalId==null?null:uuid(raw.approvalId,"approvalId");
    try{const prepared=await this.#prepare(tx,{tenantId,propertyNode,actorId:audit.actorId,trustAccountId,amountMinor,reason:why});if(prepared.approval_required){if(!approvalId)throw new OwnerTrustExpenseWorkbenchUnavailableError();await this.#lockApproval(tx,tenantId,propertyNode,approvalId,audit.actorId,"post",prepared.approval_payload);}else if(approvalId!==null)throw new OwnerTrustExpenseWorkbenchValidationError("approval is not valid for a nonnegative expense");return await this.#trust.postOwnerExpense(tx,{tenantId,trustAccountId,amountMinor,reason:why,approvalRequestId:approvalId,idempotencyKey:raw.idempotencyKey,envelope:audit});}catch(error){return translate(error);}
  }

  #normalizePreview(raw:PreviewOwnerTrustExpenseInput){object(raw,"expense preview");shape(raw,["tenantId","propertyNode","actorId","trustAccountId","amountMinor","reason"],[],"expense preview");return {tenantId:uuid(raw.tenantId,"tenantId"),propertyNode:uuid(raw.propertyNode,"propertyNode"),actorId:uuid(raw.actorId,"actorId"),trustAccountId:uuid(raw.trustAccountId,"trustAccountId"),amountMinor:money(raw.amountMinor),reason:reason(raw.reason)};}
  async #prepare(tx:Tx,input:{tenantId:string;propertyNode:string;actorId:string;trustAccountId:string;amountMinor:string;reason:string}){const rows=await tx<PreparedRow[]>`SELECT * FROM public.prepare_owner_trust_expense(${input.tenantId}::uuid,${input.trustAccountId}::uuid,${input.actorId}::uuid,${input.amountMinor}::bigint,${input.reason})`;const row=rows[0];if(rows.length!==1||!row||row.property_node!==input.propertyNode||row.trust_account_id!==input.trustAccountId||String(row.amount_minor)!==input.amountMinor)throw new OwnerTrustExpenseWorkbenchUnavailableError();evidence(row.approval_payload);return row;}
  #publicPreview(row:PreparedRow):OwnerTrustExpensePreview{return Object.freeze({accountReference:row.trust_account_id,accountLabel:row.trust_account_label,ownerLabel:row.owner_label,currency:row.currency,amountMinor:String(row.amount_minor),availableBalanceMinor:String(row.available_before_minor),projectedBalanceMinor:String(row.projected_available_minor),approvalRequired:row.approval_required});}
  async #lockApproval(tx:Tx,tenantId:string,propertyNode:string,approvalId:string,actorId:string,mode:"decide"|"post",expected?:Record<string,unknown>){const rows=await tx<Array<ApprovalRow>>`SELECT approval.id,approval.subject_id,approval.payload,approval.status,approval.requested_by,requester.display_name AS requester_label,approval.created_at,approval.decided_at,trust.name AS account_label,owner.display_name AS owner_label,trust.currency::text,
      EXISTS(SELECT 1 FROM app_user actor JOIN user_role actor_role ON actor_role.tenant_id=actor.tenant_id AND actor_role.user_id=actor.id AND actor_role.scope_node=${propertyNode}::uuid JOIN role_permission permission ON permission.role_id=actor_role.role_id AND permission.permission_code=${CHECKER} WHERE actor.tenant_id=approval.tenant_id AND actor.id=${actorId}::uuid AND actor.status='active') AS can_decide,
      EXISTS(SELECT 1 FROM app_user actor JOIN user_role actor_role ON actor_role.tenant_id=actor.tenant_id AND actor_role.user_id=actor.id AND actor_role.scope_node=${propertyNode}::uuid JOIN role_permission permission ON permission.role_id=actor_role.role_id AND permission.permission_code=${MAKER} WHERE actor.tenant_id=approval.tenant_id AND actor.id=${actorId}::uuid AND actor.status='active') AS can_post,
      EXISTS(SELECT 1 FROM journal used WHERE used.tenant_id=approval.tenant_id AND used.approval_request_id=approval.id) AS consumed
      FROM approval_request approval JOIN account trust ON trust.tenant_id=approval.tenant_id AND trust.id=approval.subject_id AND trust.property_node=${propertyNode}::uuid AND trust.role='trust' JOIN party owner ON owner.tenant_id=trust.tenant_id AND owner.id=trust.party_id JOIN app_user requester ON requester.tenant_id=approval.tenant_id AND requester.id=approval.requested_by
      WHERE approval.tenant_id=${tenantId}::uuid AND approval.id=${approvalId}::uuid AND approval.kind=${KIND} AND approval.subject_type=${SUBJECT}`;
    const observed=rows[0];if(rows.length!==1||!observed)throw new OwnerTrustExpenseWorkbenchUnavailableError();const p=evidence(observed.payload);
    // Match create_owner_trust_expense: financial rows first, approval row second.
    const prepared=await this.#prepare(tx,{tenantId,propertyNode,actorId:observed.requested_by,trustAccountId:observed.subject_id,amountMinor:p.amountMinor,reason:p.reason});
    const locked=(await tx<Array<{status:ApprovalRow["status"];requested_by:string;payload:Record<string,unknown>;decided_at:Date|null;consumed:boolean}>>`SELECT approval.status,approval.requested_by,approval.payload,approval.decided_at,EXISTS(SELECT 1 FROM journal used WHERE used.tenant_id=approval.tenant_id AND used.approval_request_id=approval.id) AS consumed FROM approval_request approval WHERE approval.tenant_id=${tenantId}::uuid AND approval.id=${approvalId}::uuid AND approval.kind=${KIND} AND approval.subject_type=${SUBJECT} FOR UPDATE OF approval`)[0];
    if(!locked||locked.requested_by!==observed.requested_by||stable(locked.payload)!==stable(observed.payload)||!prepared.approval_required||stable(prepared.approval_payload)!==stable(locked.payload)||(expected&&stable(expected)!==stable(locked.payload)))throw new OwnerTrustExpenseWorkbenchUnavailableError();
    const row={...observed,status:locked.status,requested_by:locked.requested_by,payload:locked.payload,decided_at:locked.decided_at,consumed:locked.consumed};if(mode==="decide"&&(row.status!=="pending"||row.requested_by===actorId||!row.can_decide))throw new OwnerTrustExpenseWorkbenchUnavailableError();if(mode==="post"&&(row.status!=="approved"||row.requested_by!==actorId||!row.can_post||row.consumed||!row.decided_at))throw new OwnerTrustExpenseWorkbenchUnavailableError();return row;}
}
