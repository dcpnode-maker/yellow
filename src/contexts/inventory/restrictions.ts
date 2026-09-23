import type { AuditEnvelope, EventBus, Tx } from "../../kernel";
import { recordFact } from "../../kernel";
import { InventoryNotFoundError, InventoryValidationError } from "./inventory";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CHANNEL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_BATCH = 100;
const MAX_VALUE = 2_147_483_647;

export type RestrictionKind = "closed" | "cta" | "ctd" | "min_los" | "max_los" | "min_adv" | "max_adv";

export interface Restriction {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly unitTypeId: string | null;
  readonly ratePlanId: string | null;
  readonly channelCode: string | null;
  readonly kind: RestrictionKind;
  readonly value: number | null;
  readonly stayStart: string;
  readonly stayEnd: string;
  readonly source: "manual";
}

export interface RestrictionDraft {
  readonly unitTypeId?: string | null;
  readonly ratePlanId?: string | null;
  readonly channelCode?: string | null;
  readonly kind: RestrictionKind;
  readonly value?: number | null;
  readonly stayStart: string;
  readonly stayEnd: string;
}

export interface CreateRestrictionBatchInput {
  readonly restrictions: readonly RestrictionDraft[];
  readonly envelope: AuditEnvelope;
}

export interface RestrictionFilter {
  readonly unitTypeId?: string;
  readonly ratePlanId?: string;
}

interface RestrictionRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly scope_node: string;
  readonly unit_type_id: string | null;
  readonly rate_plan_id: string | null;
  readonly channel_code: string | null;
  readonly kind: RestrictionKind;
  readonly value: number | null;
  readonly stay_start: string;
  readonly stay_end: string;
  readonly source: "manual";
}

interface NormalizedDraft {
  readonly unitTypeId: string | null;
  readonly ratePlanId: string | null;
  readonly channelCode: string | null;
  readonly kind: RestrictionKind;
  readonly value: number | null;
  readonly stayStart: string;
  readonly stayEnd: string;
}

function requireUuid(name: string, value: string): void {
  if (!UUID.test(value)) throw new InventoryValidationError(`${name} must be a UUID`);
}

function requireDate(name: string, value: string): void {
  if (!DATE.test(value)) throw new InventoryValidationError(`${name} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new InventoryValidationError(`${name} must be a real calendar date`);
  }
}

function normalizeDraft(draft: RestrictionDraft): NormalizedDraft {
  const kinds: readonly RestrictionKind[] = ["closed", "cta", "ctd", "min_los", "max_los", "min_adv", "max_adv"];
  if (!kinds.includes(draft.kind)) throw new InventoryValidationError("restriction kind is unsupported");
  requireDate("stayStart", draft.stayStart);
  requireDate("stayEnd", draft.stayEnd);
  if (draft.stayStart >= draft.stayEnd) {
    throw new InventoryValidationError("restriction stay range must be non-empty and increasing");
  }
  const unitTypeId = draft.unitTypeId ?? null;
  const ratePlanId = draft.ratePlanId ?? null;
  if (unitTypeId !== null) requireUuid("unitTypeId", unitTypeId);
  if (ratePlanId !== null) requireUuid("ratePlanId", ratePlanId);
  const channelCode = draft.channelCode ?? null;
  if (channelCode !== null && (channelCode !== channelCode.trim() || !CHANNEL.test(channelCode))) {
    throw new InventoryValidationError("channelCode must be null or a trimmed stable identifier");
  }
  const valued = draft.kind === "min_los" || draft.kind === "max_los" || draft.kind === "min_adv" || draft.kind === "max_adv";
  let value: number | null;
  if (valued) {
    if (!Number.isInteger(draft.value) || (draft.value as number) < 1 || (draft.value as number) > MAX_VALUE) {
      throw new InventoryValidationError(`${draft.kind} requires a positive 32-bit integer value`);
    }
    value = draft.value as number;
  } else {
    if (draft.value !== undefined && draft.value !== null) {
      throw new InventoryValidationError(`${draft.kind} must not carry a value`);
    }
    value = null;
  }
  return { unitTypeId, ratePlanId, channelCode, kind: draft.kind, value, stayStart: draft.stayStart, stayEnd: draft.stayEnd };
}

function toRestriction(row: RestrictionRow): Restriction {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    propertyNode: row.scope_node,
    unitTypeId: row.unit_type_id,
    ratePlanId: row.rate_plan_id,
    channelCode: row.channel_code,
    kind: row.kind,
    value: row.value,
    stayStart: row.stay_start,
    stayEnd: row.stay_end,
    source: row.source,
  };
}

async function requireProperty(tx: Tx, envelope: AuditEnvelope): Promise<void> {
  const rows = await tx<Array<{ id: string }>>`
    SELECT id FROM org_node
    WHERE id = ${envelope.propertyNode}::uuid
      AND tenant_id = ${envelope.tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND kind = 'property'
  `;
  if (!rows[0]) throw new InventoryNotFoundError("Property was not found in the active tenant");
}

async function requireReferences(tx: Tx, envelope: AuditEnvelope, draft: NormalizedDraft): Promise<void> {
  if (draft.unitTypeId !== null) {
    const rows = await tx<Array<{ id: string }>>`
      SELECT id FROM unit_type
      WHERE id = ${draft.unitTypeId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = ${envelope.propertyNode}::uuid
    `;
    if (!rows[0]) throw new InventoryNotFoundError("Unit type was not found in the active property");
  }
  if (draft.ratePlanId !== null) {
    const rows = await tx<Array<{ id: string }>>`
      SELECT id FROM rate_plan
      WHERE id = ${draft.ratePlanId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = ${envelope.propertyNode}::uuid
    `;
    if (!rows[0]) throw new InventoryNotFoundError("Rate plan was not found in the active property");
  }
}

export class RestrictionService {
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  async createBatch(tx: Tx, input: CreateRestrictionBatchInput): Promise<readonly Restriction[]> {
    if (input.envelope.operation !== "restriction.created") {
      throw new InventoryValidationError("audit operation must be restriction.created");
    }
    if (!Array.isArray(input.restrictions) || input.restrictions.length < 1 || input.restrictions.length > MAX_BATCH) {
      throw new InventoryValidationError(`restriction batch must contain 1 to ${MAX_BATCH} rows`);
    }
    const drafts = input.restrictions.map(normalizeDraft);
    const keys = new Set<string>();
    for (const draft of drafts) {
      const key = JSON.stringify(draft);
      if (keys.has(key)) throw new InventoryValidationError("restriction batch contains a duplicate row");
      keys.add(key);
    }
    await requireProperty(tx, input.envelope);
    for (const draft of drafts) await requireReferences(tx, input.envelope, draft);

    const created: Restriction[] = [];
    for (const draft of drafts) {
      const rows = await tx<RestrictionRow[]>`
        INSERT INTO restriction (
          tenant_id, scope_node, unit_type_id, rate_plan_id, channel_code,
          kind, value, stay_dates, source
        ) VALUES (
          ${input.envelope.tenantId}::uuid, ${input.envelope.propertyNode}::uuid,
          ${draft.unitTypeId}::uuid, ${draft.ratePlanId}::uuid, ${draft.channelCode},
          ${draft.kind}, ${draft.value},
          daterange(${draft.stayStart}::date, ${draft.stayEnd}::date, '[)'), 'manual'
        )
        RETURNING id, tenant_id, scope_node, unit_type_id, rate_plan_id, channel_code,
                  kind, value, lower(stay_dates)::text AS stay_start,
                  upper(stay_dates)::text AS stay_end, source
      `;
      const row = rows[0];
      if (!row) throw new Error("PostgreSQL did not return the created restriction");
      const fact = await recordFact(tx, {
        entityType: "restriction",
        entityId: row.id,
        envelope: input.envelope,
        payload: {
          action: "created",
          kind: row.kind,
          value: row.value,
          unit_type_id: row.unit_type_id,
          rate_plan_id: row.rate_plan_id,
          channel_code: row.channel_code,
          stay_start: row.stay_start,
          stay_end: row.stay_end,
          source: row.source,
        },
      });
      await this.#events.publish(tx, {
        tenantId: row.tenant_id,
        propertyNode: row.scope_node,
        businessDate: fact.businessDate,
        aggregateType: "restriction",
        aggregateId: row.id,
        eventType: "restriction.changed",
        actorId: input.envelope.actorId,
        correlationId: input.envelope.requestId,
        payload: {
          restriction_id: row.id,
          action: "created",
          kind: row.kind,
          unit_type_id: row.unit_type_id,
          rate_plan_id: row.rate_plan_id,
          channel_code: row.channel_code,
          stay_dates: { start: row.stay_start, end: row.stay_end },
        },
      });
      created.push(toRestriction(row));
    }
    return created;
  }

  async list(tx: Tx, propertyNode: string, filter: RestrictionFilter = {}): Promise<readonly Restriction[]> {
    requireUuid("propertyNode", propertyNode);
    if (filter.unitTypeId !== undefined) requireUuid("unitTypeId", filter.unitTypeId);
    if (filter.ratePlanId !== undefined) requireUuid("ratePlanId", filter.ratePlanId);
    const rows = await tx<RestrictionRow[]>`
      SELECT id, tenant_id, scope_node, unit_type_id, rate_plan_id, channel_code,
             kind, value, lower(stay_dates)::text AS stay_start,
             upper(stay_dates)::text AS stay_end, source
      FROM restriction
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND scope_node = ${propertyNode}::uuid
        AND (${filter.unitTypeId ?? null}::uuid IS NULL OR unit_type_id = ${filter.unitTypeId ?? null}::uuid)
        AND (${filter.ratePlanId ?? null}::uuid IS NULL OR rate_plan_id = ${filter.ratePlanId ?? null}::uuid)
      ORDER BY lower(stay_dates), upper(stay_dates), kind, unit_type_id NULLS FIRST,
               rate_plan_id NULLS FIRST, channel_code NULLS FIRST, id
    `;
    return rows.map(toRestriction);
  }
}
