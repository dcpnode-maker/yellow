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
  BusinessDayDiscrepancyCarryConflictError,
  BusinessDayDiscrepancyCarryService,
  BusinessDayDiscrepancyCarryValidationError,
  type BusinessDayDiscrepancyCarryApproval,
  type BusinessDayDiscrepancyCarryResult,
} from "./business-day-discrepancy-carry";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
const HASH = /^[0-9a-f]{64}$/;
const CURSOR = /^[A-Za-z0-9_-]{1,512}$/;
const KIND = "business_day_discrepancy_carry";
const SUBJECT = "discrepancy";
const MAKER_PERMISSION = "financials.business-day:carry-discrepancy";
const CHECKER_PERMISSION = "financials.business-day:approve-discrepancy-carry";

export class BusinessDayDiscrepancyCarryOperatorValidationError extends Error {
  constructor(message: string) { super(message); this.name = "BusinessDayDiscrepancyCarryOperatorValidationError"; }
}
export class BusinessDayDiscrepancyCarryOperatorUnavailableError extends Error {
  constructor(message = "Business-day discrepancy carry approval is unavailable") { super(message); this.name = "BusinessDayDiscrepancyCarryOperatorUnavailableError"; }
}
export class BusinessDayDiscrepancyCarryOperatorConflictError extends Error {
  constructor(message: string) { super(message); this.name = "BusinessDayDiscrepancyCarryOperatorConflictError"; }
}

export interface RequestCarryApprovalOperatorInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly sourceBusinessDate: string;
  readonly discrepancyId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}
export interface ListCarryApprovalsOperatorInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly actorId: string;
  readonly after?: string;
  readonly limit?: number;
}
export interface DecideCarryApprovalOperatorInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly approvalId: string;
  readonly decision: "approved" | "rejected";
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}
export interface ConsumeCarryApprovalOperatorInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly approvalId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}
export interface CarryApprovalOperatorView {
  readonly approvalId: string;
  readonly sourceDiscrepancyId: string;
  readonly sourceBusinessDate: string;
  readonly targetBusinessDate: string;
  readonly roomCode: string;
  readonly reason: string;
  readonly requesterLabel: string;
  readonly status: "pending" | "approved" | "rejected" | "expired";
  readonly requestedAt: string;
  readonly decidedAt: string | null;
  readonly expiresAt: string;
  readonly canDecide: boolean;
  readonly canCarry: boolean;
}
export interface CarryApprovalOperatorPage {
  readonly approvals: readonly CarryApprovalOperatorView[];
  readonly nextCursor: string | null;
}
export interface CarryApprovalDecisionResult extends Readonly<Record<string, JsonValue>> {
  readonly approvalId: string;
  readonly status: "approved" | "rejected";
  readonly decidedAt: string;
  readonly replayed: boolean;
}

interface ApprovalPayload {
  readonly propertyNode: string; readonly sourceDiscrepancyId: string;
  readonly sourceBusinessDate: string; readonly targetBusinessDate: string;
  readonly reason: string; readonly discrepancyStateHash: string;
  readonly requestHash: string; readonly targetOpenedAt: string;
}
interface InboxRow {
  readonly id: string; readonly subject_id: string; readonly payload: unknown;
  readonly status: string; readonly requested_by: string; readonly requester_label: string;
  readonly decided_at: Date | null; readonly created_at: Date; readonly valid_until: Date | null;
  readonly room_code: string; readonly actor_can_make: boolean; readonly actor_can_decide: boolean;
  readonly consumed: boolean; readonly within_window: boolean; readonly expires_at: Date;
  readonly lineage_count: number; readonly lineage_property: string | null; readonly lineage_date: string | null;
  readonly target_evidence_valid: boolean; readonly action_evidence_current: boolean;
}
interface LockedRow extends InboxRow { readonly tenant_id: string; readonly kind: string; readonly subject_type: string; }
interface PreparedRow { readonly discrepancy_state_hash: string; readonly request_hash: string; readonly approval_payload: unknown; }
interface CursorValue { readonly createdAt: string; readonly id: string; }

function object(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getOwnPropertySymbols(value).length !== 0) throw new BusinessDayDiscrepancyCarryOperatorValidationError(`${name} must be a plain object`);
}
function shape(value: Record<string, unknown>, keys: readonly string[], name: string): void {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new BusinessDayDiscrepancyCarryOperatorValidationError(`${name} shape is invalid`);
}
function uuid(value: unknown, name: string): string { if (typeof value !== "string" || !UUID.test(value)) throw new BusinessDayDiscrepancyCarryOperatorValidationError(`${name} must be a lowercase UUID`); return value; }
function date(value: unknown, name: string): string { const parsed = typeof value === "string" && DATE.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(Number.NaN); if (typeof value !== "string" || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new BusinessDayDiscrepancyCarryOperatorValidationError(`${name} is invalid`); return value; }
function key(value: unknown): string { if (typeof value !== "string" || !KEY.test(value)) throw new BusinessDayDiscrepancyCarryOperatorValidationError("idempotencyKey is invalid"); return value; }
function reason(value: unknown): string { if (typeof value !== "string" || value !== value.trim() || value !== value.normalize("NFC") || new TextEncoder().encode(value).length < 1 || new TextEncoder().encode(value).length > 500 || /[\x00-\x1f\x7f]/u.test(value)) throw new BusinessDayDiscrepancyCarryOperatorValidationError("reason is invalid"); return value; }
function envelope(value: AuditEnvelope, tenantId: string, propertyNode: string, operation: string): AuditEnvelope {
  object(value, "envelope"); shape(value, ["actorId", "tenantId", "propertyNode", "requestId", "operation"], "envelope");
  if (uuid(value.actorId, "envelope actor") !== value.actorId || value.tenantId !== tenantId || value.propertyNode !== propertyNode || value.operation !== operation) throw new BusinessDayDiscrepancyCarryOperatorValidationError("envelope binding is invalid");
  return value;
}
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source).sort().map((name) => `${JSON.stringify(name)}:${stable(source[name])}`).join(",")}}`;
}
function payload(value: unknown): ApprovalPayload {
  try {
    object(value, "approval payload");
    shape(value, ["propertyNode", "sourceDiscrepancyId", "sourceBusinessDate", "targetBusinessDate", "reason", "discrepancyStateHash", "requestHash", "targetOpenedAt"], "approval payload");
    const result: ApprovalPayload = {
      propertyNode: uuid(value.propertyNode, "payload property"), sourceDiscrepancyId: uuid(value.sourceDiscrepancyId, "payload discrepancy"),
      sourceBusinessDate: date(value.sourceBusinessDate, "payload source date"), targetBusinessDate: date(value.targetBusinessDate, "payload target date"),
      reason: reason(value.reason), discrepancyStateHash: String(value.discrepancyStateHash), requestHash: String(value.requestHash), targetOpenedAt: String(value.targetOpenedAt),
    };
    if (!HASH.test(result.discrepancyStateHash) || !HASH.test(result.requestHash) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(result.targetOpenedAt) || !Number.isFinite(Date.parse(result.targetOpenedAt))) throw new Error("noncanonical evidence");
    return result;
  } catch { throw new BusinessDayDiscrepancyCarryOperatorUnavailableError(); }
}
function encodeCursor(row: InboxRow): string { return Buffer.from(JSON.stringify({ createdAt: row.created_at.toISOString(), id: row.id }), "utf8").toString("base64url"); }
function decodeCursor(value: unknown): CursorValue | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || !CURSOR.test(value)) throw new BusinessDayDiscrepancyCarryOperatorValidationError("after is invalid");
  let decoded: string; try { decoded = Buffer.from(value, "base64url").toString("utf8"); } catch { throw new BusinessDayDiscrepancyCarryOperatorValidationError("after is invalid"); }
  if (Buffer.from(decoded, "utf8").toString("base64url") !== value) throw new BusinessDayDiscrepancyCarryOperatorValidationError("after is not canonical");
  let raw: unknown; try { raw = JSON.parse(decoded); } catch { throw new BusinessDayDiscrepancyCarryOperatorValidationError("after is invalid"); }
  object(raw, "after"); shape(raw, ["createdAt", "id"], "after");
  const instant = typeof raw.createdAt === "string" ? new Date(raw.createdAt) : new Date(Number.NaN);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString() !== raw.createdAt) throw new BusinessDayDiscrepancyCarryOperatorValidationError("after timestamp is invalid");
  return Object.freeze({ createdAt: raw.createdAt, id: uuid(raw.id, "after id") });
}
function translate(error: unknown): never {
  if (error instanceof BusinessDayDiscrepancyCarryOperatorValidationError || error instanceof BusinessDayDiscrepancyCarryOperatorUnavailableError || error instanceof BusinessDayDiscrepancyCarryOperatorConflictError) throw error;
  if (error instanceof IdempotencyConflictError || error instanceof ApprovalConflictError || error instanceof BusinessDayDiscrepancyCarryConflictError) throw new BusinessDayDiscrepancyCarryOperatorConflictError(error.message);
  if (error instanceof BusinessDayDiscrepancyCarryValidationError) throw new BusinessDayDiscrepancyCarryOperatorValidationError(error.message);
  const sql = error as { code?: string; errno?: string };
  if (["23505", "40001", "40P01", "42501", "55000"].includes(sql.code ?? sql.errno ?? "")) throw new BusinessDayDiscrepancyCarryOperatorConflictError("Business-day discrepancy carry evidence is unavailable or stale");
  throw error;
}
function businessDate(value: unknown): string {
  if (typeof value === "string") {
    if (DATE.test(value)) return date(value, "business date");
    if (/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value)) return date(value.slice(0, 10), "business date");
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  throw new BusinessDayDiscrepancyCarryOperatorUnavailableError();
}

export class BusinessDayDiscrepancyCarryOperatorService {
  readonly #carry: BusinessDayDiscrepancyCarryService; readonly #approvals: ApprovalService;
  readonly #idempotency: PostgresIdempotency;
  constructor(options: { readonly events: EventBus; readonly idempotency: PostgresIdempotency }) {
    this.#carry = new BusinessDayDiscrepancyCarryService(options); this.#approvals = new ApprovalService(options.events); this.#idempotency = options.idempotency;
  }

  async requestApproval(tx: Tx, input: RequestCarryApprovalOperatorInput): Promise<BusinessDayDiscrepancyCarryApproval> {
    object(input, "request"); shape(input, ["tenantId", "propertyNode", "sourceBusinessDate", "discrepancyId", "reason", "idempotencyKey", "envelope"], "request");
    const tenantId = uuid(input.tenantId, "tenantId"), propertyNode = uuid(input.propertyNode, "propertyNode"), source = date(input.sourceBusinessDate, "sourceBusinessDate");
    const discrepancyId = uuid(input.discrepancyId, "discrepancyId"), why = reason(input.reason), audit = envelope(input.envelope, tenantId, propertyNode, "approval.requested"); key(input.idempotencyKey);
    try {
      const target = await tx<Array<{ target_business_date: string }>>`
        SELECT day.business_date::text AS target_business_date
        FROM org_node property
        JOIN business_day day ON day.tenant_id=property.tenant_id AND day.property_node=property.id
          AND day.business_date=(transaction_timestamp() AT TIME ZONE property.timezone)::date
          AND day.sealed_at IS NULL
        WHERE property.tenant_id=${tenantId}::uuid AND property.id=${propertyNode}::uuid AND property.kind='property'
        LIMIT 2`;
      if (target.length !== 1 || !target[0]) throw new BusinessDayDiscrepancyCarryOperatorUnavailableError();
      return await this.#carry.requestApproval(tx, { tenantId, propertyNode, discrepancyId, sourceBusinessDate: source, targetBusinessDate: target[0].target_business_date, reason: why, idempotencyKey: input.idempotencyKey, envelope: audit });
    } catch (error) { return translate(error); }
  }

  async listApprovals(tx: Tx, input: ListCarryApprovalsOperatorInput): Promise<CarryApprovalOperatorPage> {
    object(input, "list"); shape(input, ["tenantId", "propertyNode", "actorId", ...(input.after === undefined ? [] : ["after"]), ...(input.limit === undefined ? [] : ["limit"])], "list");
    const tenantId = uuid(input.tenantId, "tenantId"), propertyNode = uuid(input.propertyNode, "propertyNode"), actorId = uuid(input.actorId, "actorId"), after = decodeCursor(input.after);
    const limit = input.limit ?? 50; if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new BusinessDayDiscrepancyCarryOperatorValidationError("limit must be an integer from 1 to 100");
    const rows = await tx<InboxRow[]>`
      SELECT approval.id,approval.subject_id,approval.payload,approval.status,approval.requested_by,
             requester.display_name AS requester_label,approval.decided_at,approval.created_at,approval.valid_until,
             room.code AS room_code,
             EXISTS(SELECT 1 FROM app_user actor JOIN user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id JOIN role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code=${MAKER_PERMISSION} JOIN org_node scope ON scope.tenant_id=ur.tenant_id AND scope.id=ur.scope_node WHERE actor.tenant_id=approval.tenant_id AND actor.id=${actorId}::uuid AND actor.status='active' AND scope.path @> property.path) AS actor_can_make,
             EXISTS(SELECT 1 FROM app_user actor JOIN user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id JOIN role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code=${CHECKER_PERMISSION} JOIN org_node scope ON scope.tenant_id=ur.tenant_id AND scope.id=ur.scope_node WHERE actor.tenant_id=approval.tenant_id AND actor.id=${actorId}::uuid AND actor.status='active' AND scope.path @> property.path) AS actor_can_decide,
             EXISTS(SELECT 1 FROM business_day_discrepancy_carry used WHERE used.tenant_id=approval.tenant_id AND used.approval_request_id=approval.id) AS consumed,
             transaction_timestamp()>=approval.created_at AND transaction_timestamp()<approval.created_at+interval '30 minutes' AS within_window,
             approval.created_at+interval '30 minutes' AS expires_at,
             (SELECT count(*)::int FROM outbox lineage WHERE lineage.tenant_id=approval.tenant_id AND lineage.aggregate_type='discrepancy' AND lineage.aggregate_id=approval.subject_id AND lineage.event_type='discrepancy.reported') AS lineage_count,
             (SELECT min(lineage.property_node::text) FROM outbox lineage WHERE lineage.tenant_id=approval.tenant_id AND lineage.aggregate_type='discrepancy' AND lineage.aggregate_id=approval.subject_id AND lineage.event_type='discrepancy.reported') AS lineage_property,
             (SELECT min(lineage.business_date::text) FROM outbox lineage WHERE lineage.tenant_id=approval.tenant_id AND lineage.aggregate_type='discrepancy' AND lineage.aggregate_id=approval.subject_id AND lineage.event_type='discrepancy.reported') AS lineage_date,
             (SELECT count(*)=1 FROM jsonb_to_record(approval.payload) AS evidence("targetBusinessDate" text,"targetOpenedAt" text)
               JOIN business_day target ON target.tenant_id=approval.tenant_id AND target.property_node=room.property_node
                AND target.business_date::text=evidence."targetBusinessDate"
                AND to_char(target.opened_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')=evidence."targetOpenedAt") AS target_evidence_valid,
             EXISTS(SELECT 1 FROM jsonb_to_record(approval.payload) AS evidence("sourceBusinessDate" text,"targetBusinessDate" text,"targetOpenedAt" text)
               JOIN business_day source ON source.tenant_id=approval.tenant_id AND source.property_node=room.property_node AND source.business_date::text=evidence."sourceBusinessDate" AND source.sealed_at IS NULL
               JOIN business_day target ON target.tenant_id=approval.tenant_id AND target.property_node=room.property_node AND target.business_date::text=evidence."targetBusinessDate" AND target.sealed_at IS NULL
                AND target.business_date=(transaction_timestamp() AT TIME ZONE property.timezone)::date
                AND to_char(target.opened_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')=evidence."targetOpenedAt"
               WHERE discrepancy.resolved_at IS NULL) AS action_evidence_current
      FROM approval_request approval
      JOIN discrepancy discrepancy ON discrepancy.tenant_id=approval.tenant_id AND discrepancy.id=approval.subject_id
      JOIN space room ON room.tenant_id=discrepancy.tenant_id AND room.id=discrepancy.space_id AND room.property_node=${propertyNode}::uuid
      JOIN org_node property ON property.tenant_id=room.tenant_id AND property.id=room.property_node AND property.kind='property'
      JOIN app_user requester ON requester.tenant_id=approval.tenant_id AND requester.id=approval.requested_by
      WHERE approval.tenant_id=${tenantId}::uuid AND approval.tenant_id=current_setting('app.tenant_id',true)::uuid
        AND approval.kind=${KIND} AND approval.subject_type=${SUBJECT}
        AND (${after === null} OR (approval.created_at,approval.id)<(${after?.createdAt ?? "1970-01-01T00:00:00.000Z"}::timestamptz,${after?.id ?? "00000000-0000-0000-0000-000000000000"}::uuid))
      ORDER BY approval.created_at DESC,approval.id DESC LIMIT ${limit + 1}`;
    if (rows.length > limit + 1) throw new BusinessDayDiscrepancyCarryOperatorUnavailableError();
    const parsed = rows.map((row): { readonly row: InboxRow; readonly view: CarryApprovalOperatorView } => {
      if (!UUID.test(row.id) || row.subject_id === undefined || !["pending", "approved", "rejected", "expired"].includes(row.status) || !(row.created_at instanceof Date) || !Number.isFinite(row.created_at.getTime()) || row.valid_until !== null) throw new BusinessDayDiscrepancyCarryOperatorUnavailableError();
      const evidence = payload(row.payload); if (evidence.propertyNode !== propertyNode || evidence.sourceDiscrepancyId !== row.subject_id) throw new BusinessDayDiscrepancyCarryOperatorUnavailableError();
      if (!(row.expires_at instanceof Date) || !Number.isFinite(row.expires_at.getTime()) || row.lineage_count !== 1 || row.lineage_property !== propertyNode || row.lineage_date !== evidence.sourceBusinessDate || !row.target_evidence_valid) throw new BusinessDayDiscrepancyCarryOperatorUnavailableError();
      const status = row.status === "pending" && !row.within_window ? "expired" : row.status as CarryApprovalOperatorView["status"];
      return Object.freeze({ row, view: Object.freeze({ approvalId: row.id, sourceDiscrepancyId: evidence.sourceDiscrepancyId, sourceBusinessDate: evidence.sourceBusinessDate, targetBusinessDate: evidence.targetBusinessDate, roomCode: row.room_code, reason: evidence.reason, requesterLabel: row.requester_label, status, requestedAt: row.created_at.toISOString(), decidedAt: row.decided_at?.toISOString() ?? null, expiresAt: row.expires_at.toISOString(), canDecide: row.status === "pending" && row.within_window && row.requested_by !== actorId && row.actor_can_decide && row.action_evidence_current, canCarry: row.status === "approved" && row.within_window && row.requested_by === actorId && row.actor_can_make && !row.consumed && row.action_evidence_current }) });
    });
    const visible = parsed.slice(0, limit);
    return Object.freeze({ approvals: Object.freeze(visible.map(({ view }) => view)), nextCursor: rows.length > limit && visible.at(-1) ? encodeCursor(visible.at(-1)!.row) : null });
  }

  async decideApproval(tx: Tx, input: DecideCarryApprovalOperatorInput): Promise<CarryApprovalDecisionResult> {
    object(input, "decision"); shape(input, ["tenantId", "propertyNode", "approvalId", "decision", "idempotencyKey", "envelope"], "decision");
    const tenantId = uuid(input.tenantId, "tenantId"), propertyNode = uuid(input.propertyNode, "propertyNode"), approvalId = uuid(input.approvalId, "approvalId");
    if (input.decision !== "approved" && input.decision !== "rejected") throw new BusinessDayDiscrepancyCarryOperatorValidationError("decision is invalid");
    const audit = envelope(input.envelope, tenantId, propertyNode, "approval.decided"), idempotencyKey = key(input.idempotencyKey);
    try {
      const output = await this.#idempotency.execute<CarryApprovalDecisionResult>(tx, { tenantId, operation: "financials.business-day.discrepancy-carry.decide", key: idempotencyKey, request: { actorId: audit.actorId, propertyNode, approvalId, decision: input.decision } }, async (query) => {
        const row = await this.#lockCanonicalDecision(query, tenantId, propertyNode, approvalId, audit.actorId);
        const decided = await this.#approvals.decide(query, { approvalId, decision: input.decision, decidedBy: audit.actorId, envelope: audit });
        if (!decided.decidedAt || decided.status !== input.decision || row.status !== "pending") throw new BusinessDayDiscrepancyCarryOperatorUnavailableError();
        return { status: 200, body: { approvalId, status: input.decision, decidedAt: decided.decidedAt.toISOString(), replayed: false } };
      });
      return Object.freeze({ ...output.body, replayed: output.replayed });
    } catch (error) { return translate(error); }
  }

  async carry(tx: Tx, input: ConsumeCarryApprovalOperatorInput): Promise<BusinessDayDiscrepancyCarryResult> {
    object(input, "carry"); shape(input, ["tenantId", "propertyNode", "approvalId", "idempotencyKey", "envelope"], "carry");
    const tenantId = uuid(input.tenantId, "tenantId"), propertyNode = uuid(input.propertyNode, "propertyNode"), approvalId = uuid(input.approvalId, "approvalId"); key(input.idempotencyKey);
    const audit = envelope(input.envelope, tenantId, propertyNode, "discrepancy.carried");
    try {
      const row = await this.#lockApprovedForCarry(tx, tenantId, propertyNode, approvalId, audit.actorId);
      const evidence = payload(row.payload);
      const result = await this.#carry.carry(tx, { tenantId, approvalId, expectedRequestHash: evidence.requestHash, idempotencyKey: input.idempotencyKey, envelope: audit });
      return Object.freeze({ ...result, sourceBusinessDate: businessDate(result.sourceBusinessDate), targetBusinessDate: businessDate(result.targetBusinessDate) });
    } catch (error) { return translate(error); }
  }

  async #lockCanonicalDecision(tx: Tx, tenantId: string, propertyNode: string, approvalId: string, actorId: string): Promise<LockedRow> {
    const rows = await tx<LockedRow[]>`
      SELECT approval.id,approval.tenant_id,approval.kind,approval.subject_type,approval.subject_id,approval.payload,approval.status,approval.requested_by,
             requester.display_name AS requester_label,approval.decided_at,approval.created_at,approval.valid_until,room.code AS room_code,
             EXISTS(SELECT 1 FROM app_user actor JOIN user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id JOIN role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code=${MAKER_PERMISSION} JOIN org_node scope ON scope.tenant_id=ur.tenant_id AND scope.id=ur.scope_node WHERE actor.tenant_id=approval.tenant_id AND actor.id=${actorId}::uuid AND actor.status='active' AND scope.path @> property.path) AS actor_can_make,
             EXISTS(SELECT 1 FROM app_user actor JOIN user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id JOIN role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code=${CHECKER_PERMISSION} JOIN org_node scope ON scope.tenant_id=ur.tenant_id AND scope.id=ur.scope_node WHERE actor.tenant_id=approval.tenant_id AND actor.id=${actorId}::uuid AND actor.status='active' AND scope.path @> property.path) AS actor_can_decide,
             EXISTS(SELECT 1 FROM business_day_discrepancy_carry used WHERE used.tenant_id=approval.tenant_id AND used.approval_request_id=approval.id) AS consumed,
             transaction_timestamp()>=approval.created_at AND transaction_timestamp()<approval.created_at+interval '30 minutes' AS within_window,
             approval.created_at+interval '30 minutes' AS expires_at,
             1::int AS lineage_count,${propertyNode}::text AS lineage_property,(approval.payload->>'sourceBusinessDate')::text AS lineage_date,true AS target_evidence_valid,true AS action_evidence_current
      FROM approval_request approval JOIN discrepancy discrepancy ON discrepancy.tenant_id=approval.tenant_id AND discrepancy.id=approval.subject_id
      JOIN space room ON room.tenant_id=discrepancy.tenant_id AND room.id=discrepancy.space_id AND room.property_node=${propertyNode}::uuid
      JOIN org_node property ON property.tenant_id=room.tenant_id AND property.id=room.property_node AND property.kind='property'
      JOIN app_user requester ON requester.tenant_id=approval.tenant_id AND requester.id=approval.requested_by
      WHERE approval.tenant_id=${tenantId}::uuid AND approval.tenant_id=current_setting('app.tenant_id',true)::uuid AND approval.id=${approvalId}::uuid
        AND approval.kind=${KIND} AND approval.subject_type=${SUBJECT} FOR UPDATE OF approval`;
    if (rows.length !== 1 || !rows[0]) throw new BusinessDayDiscrepancyCarryOperatorUnavailableError();
    const row = rows[0], evidence = payload(row.payload);
    if (row.valid_until !== null || evidence.propertyNode !== propertyNode || evidence.sourceDiscrepancyId !== row.subject_id || !row.within_window) throw new BusinessDayDiscrepancyCarryOperatorUnavailableError();
    if (row.status !== "pending" || row.requested_by === actorId || !row.actor_can_decide) throw new BusinessDayDiscrepancyCarryOperatorUnavailableError();
    const prepared = await tx<PreparedRow[]>`SELECT * FROM public.prepare_business_day_discrepancy_carry(${tenantId}::uuid,${propertyNode}::uuid,${row.subject_id}::uuid,${evidence.sourceBusinessDate}::date,${evidence.targetBusinessDate}::date,${evidence.reason},${crypto.randomUUID()}::uuid,${row.requested_by}::uuid)`;
    if (prepared.length !== 1 || !prepared[0] || prepared[0].request_hash !== evidence.requestHash || prepared[0].discrepancy_state_hash !== evidence.discrepancyStateHash || stable(prepared[0].approval_payload) !== stable(row.payload)) throw new BusinessDayDiscrepancyCarryOperatorUnavailableError();
    return row;
  }

  async #lockApprovedForCarry(tx: Tx, tenantId: string, propertyNode: string, approvalId: string, actorId: string): Promise<LockedRow> {
    const rows = await tx<LockedRow[]>`
      SELECT approval.id,approval.tenant_id,approval.kind,approval.subject_type,approval.subject_id,approval.payload,approval.status,approval.requested_by,
             requester.display_name AS requester_label,approval.decided_at,approval.created_at,approval.valid_until,room.code AS room_code,
             EXISTS(SELECT 1 FROM app_user actor JOIN user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id JOIN role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code=${MAKER_PERMISSION} JOIN org_node scope ON scope.tenant_id=ur.tenant_id AND scope.id=ur.scope_node WHERE actor.tenant_id=approval.tenant_id AND actor.id=${actorId}::uuid AND actor.status='active' AND scope.path @> property.path) AS actor_can_make,
             false AS actor_can_decide,
             EXISTS(SELECT 1 FROM business_day_discrepancy_carry used WHERE used.tenant_id=approval.tenant_id AND used.approval_request_id=approval.id) AS consumed,
             transaction_timestamp()>=approval.created_at AND transaction_timestamp()<approval.created_at+interval '30 minutes' AS within_window,
             approval.created_at+interval '30 minutes' AS expires_at,
             1::int AS lineage_count,${propertyNode}::text AS lineage_property,(approval.payload->>'sourceBusinessDate')::text AS lineage_date,true AS target_evidence_valid,true AS action_evidence_current
      FROM approval_request approval JOIN discrepancy discrepancy ON discrepancy.tenant_id=approval.tenant_id AND discrepancy.id=approval.subject_id
      JOIN space room ON room.tenant_id=discrepancy.tenant_id AND room.id=discrepancy.space_id AND room.property_node=${propertyNode}::uuid
      JOIN org_node property ON property.tenant_id=room.tenant_id AND property.id=room.property_node AND property.kind='property'
      JOIN app_user requester ON requester.tenant_id=approval.tenant_id AND requester.id=approval.requested_by
      WHERE approval.tenant_id=${tenantId}::uuid AND approval.tenant_id=current_setting('app.tenant_id',true)::uuid AND approval.id=${approvalId}::uuid
        AND approval.kind=${KIND} AND approval.subject_type=${SUBJECT} FOR UPDATE OF approval`;
    if (rows.length !== 1 || !rows[0]) throw new BusinessDayDiscrepancyCarryOperatorUnavailableError();
    const row = rows[0], evidence = payload(row.payload);
    // Keep this preflight limited to immutable approval identity. The existing
    // carry service owns idempotent replay and migration0063 remains the final
    // authority for current permission, validity, one-use and discrepancy state.
    if (row.valid_until !== null || evidence.propertyNode !== propertyNode || evidence.sourceDiscrepancyId !== row.subject_id || row.status !== "approved" || row.requested_by !== actorId || row.decided_at === null) throw new BusinessDayDiscrepancyCarryOperatorUnavailableError();
    return row;
  }
}
