import type { Tx } from "./db";
import type { AuditEnvelope } from "./audit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ENTITY_TYPE = /^[a-z][a-z0-9_.-]*$/;

export interface FactSubject {
  readonly entityType: string;
  readonly entityId: string;
}

export interface RecordFactInput extends FactSubject {
  readonly envelope: AuditEnvelope;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly supersedes?: string;
}

export interface RecordedFact {
  readonly id: string;
  readonly tenantId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly factType: string;
  readonly validFrom: Date;
  readonly recordedAt: Date;
  readonly businessDate: string;
  readonly actorId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly supersedes: string | null;
}

interface FactRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly fact_type: string;
  readonly valid_from: Date;
  readonly recorded_at: Date;
  readonly business_date: string;
  readonly actor_id: string;
  readonly payload: Record<string, unknown>;
  readonly supersedes: string | null;
}

export async function recordFact(tx: Tx, input: RecordFactInput): Promise<RecordedFact> {
  if (!ENTITY_TYPE.test(input.entityType)) throw new Error("entityType must be a stable lowercase identifier");
  if (!UUID.test(input.entityId)) throw new Error("entityId must be a UUID");
  if (input.supersedes !== undefined && !UUID.test(input.supersedes)) {
    throw new Error("supersedes must be a UUID");
  }

  const payload = JSON.stringify({ ...input.payload, request_id: input.envelope.requestId });
  const rows = await tx<FactRow[]>`
    INSERT INTO fact_log (
      tenant_id,
      entity_type,
      entity_id,
      fact_type,
      valid_from,
      business_date,
      actor_id,
      payload,
      supersedes
    )
    SELECT
      ${input.envelope.tenantId}::uuid,
      ${input.entityType},
      ${input.entityId}::uuid,
      ${input.envelope.operation},
      transaction_timestamp(),
      (transaction_timestamp() AT TIME ZONE property.timezone)::date,
      ${input.envelope.actorId}::uuid,
      ${payload}::text::jsonb,
      ${input.supersedes ?? null}::uuid
    FROM org_node AS property
    WHERE property.id = ${input.envelope.propertyNode}::uuid
      AND property.tenant_id = ${input.envelope.tenantId}::uuid
      AND property.kind = 'property'
    RETURNING
      id,
      tenant_id,
      entity_type,
      entity_id,
      fact_type,
      valid_from,
      recorded_at,
      business_date::text,
      actor_id,
      payload,
      supersedes
  `;
  const row = rows[0];
  if (!row) throw new Error("Audit property was not found in the active tenant");

  return {
    id: row.id,
    tenantId: row.tenant_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    factType: row.fact_type,
    validFrom: row.valid_from,
    recordedAt: row.recorded_at,
    businessDate: row.business_date,
    actorId: row.actor_id,
    payload: row.payload,
    supersedes: row.supersedes,
  };
}
