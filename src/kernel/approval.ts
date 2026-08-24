import type { AuditEnvelope } from "./audit";
import type { Tx } from "./db";
import type { EventBus } from "./event-bus";
import { recordFact } from "./fact-log";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STABLE_NAME = /^[a-z][a-z0-9_.-]*$/;

export const APPROVAL_STATUSES = ["pending", "approved", "rejected", "expired"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type ApprovalDecision = Exclude<ApprovalStatus, "pending">;

export const APPROVAL_TRANSITIONS = Object.freeze({
  pending: Object.freeze(["approved", "rejected", "expired"] as const),
  approved: Object.freeze([] as const),
  rejected: Object.freeze([] as const),
  expired: Object.freeze([] as const),
});

export interface ApprovalRequest {
  readonly id: string;
  readonly tenantId: string;
  readonly kind: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly requestedBy: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly status: ApprovalStatus;
  readonly decidedBy: string | null;
  readonly decidedAt: Date | null;
  readonly createdAt: Date;
}

export interface RequestApprovalInput {
  readonly kind: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly requestedBy: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly envelope: AuditEnvelope;
}

export interface DecideApprovalInput {
  readonly approvalId: string;
  readonly decision: ApprovalStatus;
  readonly decidedBy?: string;
  readonly envelope: AuditEnvelope;
}

interface ApprovalRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly kind: string;
  readonly subject_type: string;
  readonly subject_id: string;
  readonly requested_by: string;
  readonly payload: Record<string, unknown>;
  readonly status: ApprovalStatus;
  readonly decided_by: string | null;
  readonly decided_at: Date | null;
  readonly created_at: Date;
}

function requireUuid(name: string, value: string): void {
  if (!UUID.test(value)) throw new Error(`${name} must be a UUID`);
}

function requireStableName(name: string, value: string): void {
  if (!STABLE_NAME.test(value)) throw new Error(`${name} must be a stable lowercase identifier`);
}

function toApproval(row: ApprovalRow): ApprovalRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    kind: row.kind,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    requestedBy: row.requested_by,
    payload: row.payload,
    status: row.status,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  };
}

function isStatus(value: string): value is ApprovalStatus {
  return APPROVAL_STATUSES.includes(value as ApprovalStatus);
}

export function isDeclaredApprovalTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return (APPROVAL_TRANSITIONS[from] as readonly ApprovalStatus[]).includes(to);
}

export class ApprovalConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalConflictError";
  }
}

export class ApprovalService {
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  async request(tx: Tx, input: RequestApprovalInput): Promise<ApprovalRequest> {
    requireStableName("kind", input.kind);
    requireStableName("subjectType", input.subjectType);
    requireUuid("subjectId", input.subjectId);
    requireUuid("requestedBy", input.requestedBy);
    if (input.requestedBy !== input.envelope.actorId) {
      throw new Error("approval requester must match the authenticated audit actor");
    }
    if (typeof input.payload !== "object" || input.payload === null || Array.isArray(input.payload)) {
      throw new Error("approval payload must be an object of facts");
    }
    const rows = await tx<ApprovalRow[]>`
      INSERT INTO approval_request (
        tenant_id, kind, subject_type, subject_id, requested_by, payload
      )
      VALUES (
        ${input.envelope.tenantId}::uuid,
        ${input.kind},
        ${input.subjectType},
        ${input.subjectId}::uuid,
        ${input.requestedBy}::uuid,
        ${JSON.stringify(input.payload)}::text::jsonb
      )
      RETURNING id, tenant_id, kind, subject_type, subject_id, requested_by,
                payload, status, decided_by, decided_at, created_at
    `;
    const row = rows[0];
    if (!row) throw new Error("PostgreSQL did not return the approval request");
    const fact = await recordFact(tx, {
      entityType: "approval_request",
      entityId: row.id,
      envelope: input.envelope,
      payload: {
        approval_id: row.id,
        kind: row.kind,
        subject_type: row.subject_type,
        subject_id: row.subject_id,
        requested_by: row.requested_by,
        status: row.status,
        payload: row.payload,
      },
    });
    await this.#events.publish(tx, {
      tenantId: row.tenant_id,
      propertyNode: input.envelope.propertyNode,
      businessDate: fact.businessDate,
      aggregateType: "approval_request",
      aggregateId: row.id,
      eventType: "approval.requested",
      actorId: input.requestedBy,
      correlationId: input.envelope.requestId,
      payload: { approval_id: row.id, kind: row.kind, subject_type: row.subject_type, subject_id: row.subject_id },
    });
    return toApproval(row);
  }

  async decide(tx: Tx, input: DecideApprovalInput): Promise<ApprovalRequest> {
    requireUuid("approvalId", input.approvalId);
    if (!isStatus(input.decision)) throw new Error(`Unknown approval status ${input.decision}`);

    const existing = await tx<Array<{ status: ApprovalStatus; requested_by: string }>>`
      SELECT status, requested_by
      FROM approval_request
      WHERE id = ${input.approvalId}::uuid
    `;
    const current = existing[0];
    if (!current) throw new ApprovalConflictError("Approval request was not found in the active tenant");
    if (!isDeclaredApprovalTransition(current.status, input.decision)) {
      throw new ApprovalConflictError(`Illegal approval transition ${current.status} -> ${input.decision}`);
    }

    const isHumanDecision = input.decision === "approved" || input.decision === "rejected";
    if (isHumanDecision) {
      if (!input.decidedBy) throw new Error(`${input.decision} requires decidedBy`);
      requireUuid("decidedBy", input.decidedBy);
      if (input.decidedBy !== input.envelope.actorId) {
        throw new Error("approval decider must match the authenticated audit actor");
      }
      if (input.decidedBy === current.requested_by) {
        throw new ApprovalConflictError("Self-approval is forbidden");
      }
    } else if (input.decidedBy !== undefined) {
      throw new Error("expired approvals carry no decidedBy");
    }

    const rows = await tx<ApprovalRow[]>`
      UPDATE approval_request
      SET
        status = ${input.decision},
        decided_by = ${isHumanDecision ? input.decidedBy! : null}::uuid,
        decided_at = now()
      WHERE id = ${input.approvalId}::uuid
        AND status = 'pending'
      RETURNING id, tenant_id, kind, subject_type, subject_id, requested_by,
                payload, status, decided_by, decided_at, created_at
    `;
    const row = rows[0];
    if (!row) throw new ApprovalConflictError("Approval request was decided concurrently");
    const fact = await recordFact(tx, {
      entityType: "approval_request",
      entityId: row.id,
      envelope: input.envelope,
      payload: {
        approval_id: row.id,
        previous_status: "pending",
        status: row.status,
        decided_by: row.decided_by,
      },
    });
    await this.#events.publish(tx, {
      tenantId: row.tenant_id,
      propertyNode: input.envelope.propertyNode,
      businessDate: fact.businessDate,
      aggregateType: "approval_request",
      aggregateId: row.id,
      eventType: "approval.decided",
      actorId: input.envelope.actorId,
      correlationId: input.envelope.requestId,
      payload: { approval_id: row.id, status: row.status, decided_by: row.decided_by },
    });
    return toApproval(row);
  }
}
