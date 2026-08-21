import type { Tx } from "../../kernel";
import { InventoryValidationError } from "./inventory";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CHANNEL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export interface SearchAvailabilityInput {
  readonly propertyNode: string;
  readonly from: Date;
  readonly to: Date;
  readonly partySize?: number;
  readonly ratePlanId?: string;
  readonly channelCode?: string;
}

export interface AppliedRestriction {
  readonly id: string;
  readonly kind: "closed" | "cta" | "ctd" | "min_los" | "max_los" | "min_adv" | "max_adv";
  readonly value: number | null;
  readonly blocks: boolean;
}

export interface AppliedOperationalBlock {
  readonly id: string;
  readonly spaceId: string;
  readonly kind: "ooo" | "oos";
  readonly reason: string | null;
  readonly blocks: boolean;
}

export interface AvailabilityOption {
  readonly sellableUnitId: string;
  readonly sellableUnitName: string;
  readonly unitTypeId: string;
  readonly unitTypeCode: string;
  readonly unitTypeName: string;
  readonly profileKey: string;
  readonly maxOccupancy: number;
  readonly availableCount: number;
  readonly bookable: boolean;
  readonly restrictionsApplied: readonly AppliedRestriction[];
  readonly operationalBlocksApplied: readonly AppliedOperationalBlock[];
}

interface AvailabilityRow {
  readonly sellable_unit_id: string;
  readonly sellable_unit_name: string;
  readonly unit_type_id: string;
  readonly unit_type_code: string;
  readonly unit_type_name: string;
  readonly profile_key: string;
  readonly max_occupancy: number;
  readonly available_count: number;
  readonly bookable: boolean;
  readonly restrictions_applied: string;
  readonly operational_blocks_applied: string;
}

interface PropertyPolicyRow {
  readonly oos_sellability: "blocked" | "allowed" | null;
}

function validate(input: SearchAvailabilityInput): number {
  if (!UUID.test(input.propertyNode)) throw new InventoryValidationError("propertyNode must be a UUID");
  if (!(input.from instanceof Date) || !(input.to instanceof Date) ||
      !Number.isFinite(input.from.getTime()) || !Number.isFinite(input.to.getTime()) || input.from >= input.to) {
    throw new InventoryValidationError("availability period must contain finite ordered instants");
  }
  const partySize = input.partySize ?? 1;
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 32_767) {
    throw new InventoryValidationError("partySize must be an integer between 1 and 32767");
  }
  if (input.ratePlanId !== undefined && !UUID.test(input.ratePlanId)) {
    throw new InventoryValidationError("ratePlanId must be a UUID");
  }
  if (input.channelCode !== undefined &&
      (input.channelCode !== input.channelCode.trim() || !CHANNEL.test(input.channelCode))) {
    throw new InventoryValidationError("channelCode must be a trimmed stable identifier");
  }
  return partySize;
}

function parseRestrictions(value: string): readonly AppliedRestriction[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("PostgreSQL returned invalid restriction evidence");
  return parsed as AppliedRestriction[];
}

function parseOperationalBlocks(value: string): readonly AppliedOperationalBlock[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("PostgreSQL returned invalid operational-block evidence");
  for (const block of parsed) {
    if (typeof block !== "object" || block === null ||
        !("id" in block) || typeof block.id !== "string" || !UUID.test(block.id) ||
        !("spaceId" in block) || typeof block.spaceId !== "string" || !UUID.test(block.spaceId) ||
        !("kind" in block) || (block.kind !== "ooo" && block.kind !== "oos") ||
        !("reason" in block) || (block.reason !== null && typeof block.reason !== "string") ||
        !("blocks" in block) || typeof block.blocks !== "boolean") {
      throw new Error("PostgreSQL returned invalid operational-block evidence");
    }
  }
  return parsed as AppliedOperationalBlock[];
}

export class AvailabilityService {
  async search(tx: Tx, input: SearchAvailabilityInput): Promise<readonly AvailabilityOption[]> {
    const partySize = validate(input);
    const policies = await tx.unsafe<PropertyPolicyRow[]>(`
      SELECT CASE
        WHEN jsonb_typeof(config) <> 'object' THEN NULL
        WHEN config ? 'inventory' AND jsonb_typeof(config -> 'inventory') <> 'object' THEN NULL
        WHEN NOT (COALESCE(config -> 'inventory', '{}'::jsonb) ? 'oos_sellability') THEN 'blocked'
        WHEN jsonb_typeof(config #> '{inventory,oos_sellability}') = 'string'
          AND config #>> '{inventory,oos_sellability}' IN ('blocked', 'allowed')
          THEN config #>> '{inventory,oos_sellability}'
        ELSE NULL
      END AS oos_sellability
      FROM org_node
      WHERE id = $1::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND kind = 'property'
    `, [input.propertyNode]);
    const propertyPolicy = policies[0];
    if (!propertyPolicy) return [];
    if (propertyPolicy.oos_sellability === null) {
      throw new Error("Property has invalid inventory.oos_sellability policy");
    }

    const rows = await tx.unsafe<AvailabilityRow[]>(`
      WITH property_context AS (
        SELECT
          id,
          (($2::timestamptz AT TIME ZONE timezone)::date) AS arrival_date,
          (($3::timestamptz AT TIME ZONE timezone)::date) AS departure_date,
          ((transaction_timestamp() AT TIME ZONE timezone)::date) AS booking_date
        FROM org_node
        WHERE id = $1::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND kind = 'property'
      ),
      restriction_candidates AS MATERIALIZED (
        SELECT
          restriction.id,
          restriction.unit_type_id,
          restriction.kind,
          restriction.value,
          CASE restriction.kind
            WHEN 'closed' THEN true
            WHEN 'cta' THEN true
            WHEN 'ctd' THEN true
            WHEN 'min_los' THEN (property.departure_date - property.arrival_date) < restriction.value
            WHEN 'max_los' THEN (property.departure_date - property.arrival_date) > restriction.value
            WHEN 'min_adv' THEN (property.arrival_date - property.booking_date) < restriction.value
            WHEN 'max_adv' THEN (property.arrival_date - property.booking_date) > restriction.value
            ELSE true
          END AS blocks
        FROM restriction
        CROSS JOIN property_context AS property
        WHERE restriction.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND restriction.scope_node = property.id
          AND (
            restriction.rate_plan_id IS NULL
            OR ($5::uuid IS NOT NULL AND restriction.rate_plan_id = $5::uuid)
          )
          AND (
            restriction.channel_code IS NULL
            OR ($6::text IS NOT NULL AND restriction.channel_code = $6::text)
          )
          AND CASE restriction.kind
            WHEN 'closed' THEN restriction.stay_dates && daterange(property.arrival_date, property.departure_date, '[)')
            WHEN 'cta' THEN restriction.stay_dates @> property.arrival_date
            WHEN 'ctd' THEN restriction.stay_dates @> property.departure_date
            ELSE restriction.stay_dates @> property.arrival_date
          END
      ),
      occupancy_summary AS (
        SELECT
          space_id,
          bool_or(exclusive) AS has_exclusive,
          count(*) FILTER (WHERE NOT exclusive)::int AS positional_claims
        FROM space_occupancy
        WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
          AND period && tstzrange($2::timestamptz, $3::timestamptz, '[)')
        GROUP BY space_id
      ),
      sellable_mappings AS MATERIALIZED (
        SELECT
          su.id AS sellable_unit_id,
          su.name AS sellable_unit_name,
          su.status AS sellable_status,
          su.tenant_id,
          ut.id AS unit_type_id,
          ut.code AS unit_type_code,
          ut.name AS unit_type_name,
          ut.profile_key,
          ut.max_occupancy,
          ut.sort_order,
          ut.property_node,
          sus.space_id,
          sus.claim_mode
        FROM unit_type AS ut
        JOIN sellable_unit AS su
          ON su.unit_type_id = ut.id AND su.tenant_id = ut.tenant_id
        JOIN sellable_unit_space AS sus
          ON sus.sellable_unit_id = su.id AND sus.tenant_id = su.tenant_id
        WHERE ut.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND ut.property_node = $1::uuid
          AND ut.max_occupancy >= $4::int
      ),
      operational_block_evidence AS MATERIALIZED (
        SELECT
          mapping.sellable_unit_id,
          jsonb_agg(
            jsonb_build_object(
              'id', block.id,
              'spaceId', block.space_id,
              'kind', block.kind,
              'reason', block.reason,
              'blocks', block.kind = 'ooo' OR $7::text = 'blocked'
            ) ORDER BY block.kind, block.space_id, block.id
          ) AS operational_blocks,
          bool_or(block.kind = 'ooo' OR $7::text = 'blocked') AS any_blocks
        FROM sellable_mappings AS mapping
        JOIN ooo_oos AS block
          ON block.tenant_id = mapping.tenant_id
         AND block.space_id = mapping.space_id
        WHERE block.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND NOT isempty(block.period)
          AND upper(block.period) > transaction_timestamp()
          AND block.period && tstzrange($2::timestamptz, $3::timestamptz, '[)')
        GROUP BY mapping.sellable_unit_id
      ),
      mapping_capacity AS (
        SELECT
          mapping.sellable_unit_id,
          mapping.sellable_unit_name,
          mapping.sellable_status,
          mapping.unit_type_id,
          mapping.unit_type_code,
          mapping.unit_type_name,
          mapping.profile_key,
          mapping.max_occupancy,
          mapping.sort_order,
          s.id AS space_id,
          s.status AS space_status,
          s.property_node = mapping.property_node AS property_matches,
          CASE
            WHEN mapping.claim_mode = 'exclusive' THEN
              CASE WHEN os.space_id IS NULL THEN 1 ELSE 0 END
            WHEN COALESCE(os.has_exclusive, false) THEN 0
            ELSE GREATEST(s.capacity - COALESCE(os.positional_claims, 0), 0)
          END AS free_claims
        FROM sellable_mappings AS mapping
        JOIN space AS s ON s.id = mapping.space_id AND s.tenant_id = mapping.tenant_id
        LEFT JOIN occupancy_summary AS os ON os.space_id = s.id
      ),
      physical_options AS (
        SELECT
        sellable_unit_id,
        sellable_unit_name,
        unit_type_id,
        unit_type_code,
        unit_type_name,
        profile_key,
        max_occupancy,
          min(free_claims)::int AS available_count,
          sort_order
        FROM mapping_capacity
        GROUP BY sellable_unit_id, sellable_unit_name, sellable_status,
                 unit_type_id, unit_type_code, unit_type_name, profile_key,
                 max_occupancy, sort_order
        HAVING sellable_status = 'active'
           AND bool_and(space_status = 'active' AND property_matches)
      ),
      restriction_evidence AS MATERIALIZED (
        SELECT
          target.id AS unit_type_id,
          jsonb_agg(
            jsonb_build_object(
              'id', restriction.id,
              'kind', restriction.kind,
              'value', restriction.value,
              'blocks', restriction.blocks
            ) ORDER BY restriction.kind, restriction.id
          ) AS restrictions,
          bool_or(restriction.blocks) AS any_blocks
        FROM unit_type AS target
        JOIN restriction_candidates AS restriction
          ON restriction.unit_type_id IS NULL OR restriction.unit_type_id = target.id
        WHERE target.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND target.property_node = $1::uuid
        GROUP BY target.id
      )
      SELECT
        physical.sellable_unit_id,
        physical.sellable_unit_name,
        physical.unit_type_id,
        physical.unit_type_code,
        physical.unit_type_name,
        physical.profile_key,
        physical.max_occupancy,
        physical.available_count,
        (physical.available_count > 0
          AND NOT COALESCE(evidence.any_blocks, false)
          AND NOT COALESCE(operational.any_blocks, false)) AS bookable,
        COALESCE(evidence.restrictions, '[]'::jsonb)::text AS restrictions_applied,
        COALESCE(operational.operational_blocks, '[]'::jsonb)::text AS operational_blocks_applied
      FROM physical_options AS physical
      CROSS JOIN property_context AS property
      LEFT JOIN restriction_evidence AS evidence ON evidence.unit_type_id = physical.unit_type_id
      LEFT JOIN operational_block_evidence AS operational
        ON operational.sellable_unit_id = physical.sellable_unit_id
      ORDER BY physical.sort_order, physical.unit_type_code,
               physical.sellable_unit_name, physical.sellable_unit_id
    `, [
      input.propertyNode,
      input.from.toISOString(),
      input.to.toISOString(),
      partySize,
      input.ratePlanId ?? null,
      input.channelCode ?? null,
      propertyPolicy.oos_sellability,
    ]);
    return rows.map((row) => ({
      sellableUnitId: row.sellable_unit_id,
      sellableUnitName: row.sellable_unit_name,
      unitTypeId: row.unit_type_id,
      unitTypeCode: row.unit_type_code,
      unitTypeName: row.unit_type_name,
      profileKey: row.profile_key,
      maxOccupancy: row.max_occupancy,
      availableCount: row.available_count,
      bookable: row.bookable,
      restrictionsApplied: parseRestrictions(row.restrictions_applied),
      operationalBlocksApplied: parseOperationalBlocks(row.operational_blocks_applied),
    }));
  }
}
