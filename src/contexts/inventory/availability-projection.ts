import type { Tx } from "../../kernel";
import { InventoryNotFoundError, InventoryValidationError } from "./inventory";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const MAX_NIGHTS = 400;

export interface RebuildAvailabilityProjectionInput {
  readonly propertyNode: string;
  readonly fromDate: string;
  readonly toDate: string;
}

export interface ProjectionRebuildResult {
  readonly propertyNode: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly rows: number;
  readonly unitTypes: number;
}

export interface AvailabilityProjectionStatus {
  readonly propertyNode: string;
  readonly fromDate: string | null;
  readonly toDate: string | null;
  readonly rows: number;
  readonly unitTypes: number;
  readonly updatedAt: string | null;
}

interface PropertyRow {
  readonly id: string;
  readonly oos_sellability: "blocked" | "allowed" | null;
}

interface InsertResultRow {
  readonly rows: number;
  readonly unit_types: number;
}

interface StatusRow {
  readonly from_date: string | null;
  readonly to_date: string | null;
  readonly rows: number;
  readonly unit_types: number;
  readonly updated_at: string | null;
}

function exactDate(name: string, value: string): number {
  if (typeof value !== "string" || !LOCAL_DATE.test(value)) {
    throw new InventoryValidationError(`${name} must be YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new InventoryValidationError(`${name} must be a real calendar date`);
  }
  return parsed.getTime();
}

function validate(input: RebuildAvailabilityProjectionInput): void {
  if (!UUID.test(input.propertyNode)) {
    throw new InventoryValidationError("propertyNode must be a UUID");
  }
  const from = exactDate("fromDate", input.fromDate);
  const to = exactDate("toDate", input.toDate);
  const nights = (to - from) / DAY_MS;
  if (!Number.isInteger(nights) || nights < 1 || nights > MAX_NIGHTS) {
    throw new InventoryValidationError(`projection range must contain 1 to ${MAX_NIGHTS} nights`);
  }
}

export class AvailabilityProjectionService {
  async status(tx: Tx, propertyNode: string): Promise<AvailabilityProjectionStatus> {
    if (!UUID.test(propertyNode)) {
      throw new InventoryValidationError("propertyNode must be a UUID");
    }
    const properties = await tx.unsafe<Array<{ id: string }>>(`
      SELECT id
      FROM org_node
      WHERE id = $1::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND kind = 'property'
    `, [propertyNode]);
    if (!properties[0]) throw new InventoryNotFoundError("Property was not found in the active tenant");
    const rows = await tx.unsafe<StatusRow[]>(`
      SELECT
        min(stay_date)::text AS from_date,
        (max(stay_date) + 1)::text AS to_date,
        count(*)::int AS rows,
        count(DISTINCT unit_type_id)::int AS unit_types,
        max(updated_at)::text AS updated_at
      FROM availability_projection
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = $1::uuid
    `, [propertyNode]);
    const status = rows[0];
    if (!status) throw new Error("Projection status did not return evidence");
    return {
      propertyNode,
      fromDate: status.from_date,
      toDate: status.to_date,
      rows: status.rows,
      unitTypes: status.unit_types,
      updatedAt: status.updated_at,
    };
  }

  async rebuild(tx: Tx, input: RebuildAvailabilityProjectionInput): Promise<ProjectionRebuildResult> {
    validate(input);
    const properties = await tx.unsafe<PropertyRow[]>(`
      SELECT
        id,
        CASE
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
      FOR UPDATE
    `, [input.propertyNode]);
    const property = properties[0];
    if (!property) throw new InventoryNotFoundError("Property was not found in the active tenant");
    if (property.oos_sellability === null) {
      throw new Error("Property has invalid inventory.oos_sellability policy");
    }

    await tx.unsafe(`
      DELETE FROM availability_projection
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = $1::uuid
        AND stay_date >= $2::date
        AND stay_date < $3::date
    `, [property.id, input.fromDate, input.toDate]);

    const inserted = await tx.unsafe<InsertResultRow[]>(`
      WITH property_context AS MATERIALIZED (
        SELECT id, timezone
        FROM org_node
        WHERE id = $1::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND kind = 'property'
      ),
      dates AS MATERIALIZED (
        SELECT
          day::date AS stay_date,
          day::date::timestamp AT TIME ZONE property.timezone AS from_at,
          (day::date + 1)::timestamp AT TIME ZONE property.timezone AS to_at
        FROM property_context AS property
        CROSS JOIN generate_series($2::date, $3::date - 1, interval '1 day') AS day
      ),
      sellable_shape AS MATERIALIZED (
        SELECT
          unit_type.id AS unit_type_id,
          sellable.id AS sellable_unit_id,
          count(mapping.space_id)::int AS mapping_count,
          max(mapping.space_id::text)::uuid AS space_id,
          max(mapping.claim_mode) AS claim_mode,
          bool_and(
            space.id IS NOT NULL
            AND space.tenant_id = unit_type.tenant_id
            AND space.property_node = unit_type.property_node
            AND space.status = 'active'
          ) AS mappings_valid
        FROM unit_type
        JOIN sellable_unit AS sellable
          ON sellable.unit_type_id = unit_type.id
         AND sellable.tenant_id = unit_type.tenant_id
         AND sellable.status = 'active'
        LEFT JOIN sellable_unit_space AS mapping
          ON mapping.sellable_unit_id = sellable.id
         AND mapping.tenant_id = sellable.tenant_id
        LEFT JOIN space
          ON space.id = mapping.space_id
         AND space.tenant_id = mapping.tenant_id
        WHERE unit_type.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND unit_type.property_node = $1::uuid
        GROUP BY unit_type.id, sellable.id
      ),
      safe_types AS MATERIALIZED (
        SELECT unit_type_id
        FROM sellable_shape
        GROUP BY unit_type_id
        HAVING bool_and(mapping_count = 1 AND mappings_valid)
           AND count(*) = count(DISTINCT space_id)
      ),
      safe_mappings AS MATERIALIZED (
        SELECT
          shape.unit_type_id,
          shape.sellable_unit_id,
          shape.space_id,
          shape.claim_mode,
          CASE WHEN shape.claim_mode = 'exclusive' THEN 1 ELSE space.capacity END AS physical
        FROM sellable_shape AS shape
        JOIN safe_types ON safe_types.unit_type_id = shape.unit_type_id
        JOIN space
          ON space.id = shape.space_id
         AND space.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND space.property_node = $1::uuid
         AND space.status = 'active'
      ),
      mapping_days AS MATERIALIZED (
        SELECT mapping.*, dates.stay_date, dates.from_at, dates.to_at
        FROM safe_mappings AS mapping
        CROSS JOIN dates
      ),
      occupancy_loss AS MATERIALIZED (
        SELECT
          mapping.unit_type_id,
          mapping.sellable_unit_id,
          mapping.space_id,
          mapping.physical,
          mapping.stay_date,
          mapping.from_at,
          mapping.to_at,
          CASE
            WHEN bool_or(occupancy.exclusive AND occupancy.slot_kind = 'segment') THEN mapping.physical
            ELSE count(occupancy.id) FILTER (
              WHERE NOT occupancy.exclusive AND occupancy.slot_kind = 'segment'
            )::int
          END AS sold,
          CASE
            WHEN bool_or(occupancy.exclusive AND occupancy.slot_kind = 'hold') THEN mapping.physical
            ELSE count(occupancy.id) FILTER (
              WHERE NOT occupancy.exclusive AND occupancy.slot_kind = 'hold'
            )::int
          END AS held,
          CASE
            WHEN bool_or(occupancy.exclusive AND occupancy.slot_kind = 'ooo') THEN mapping.physical
            ELSE count(occupancy.id) FILTER (
              WHERE NOT occupancy.exclusive AND occupancy.slot_kind = 'ooo'
            )::int
          END AS ooo
        FROM mapping_days AS mapping
        LEFT JOIN space_occupancy AS occupancy
          ON occupancy.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND occupancy.space_id = mapping.space_id
         AND occupancy.period && tstzrange(mapping.from_at, mapping.to_at, '[)')
        GROUP BY mapping.unit_type_id, mapping.sellable_unit_id, mapping.space_id,
                 mapping.physical, mapping.stay_date, mapping.from_at, mapping.to_at
      ),
      mapping_projection AS MATERIALIZED (
        SELECT
          loss.*,
          CASE
            WHEN $4::text = 'blocked' AND EXISTS (
              SELECT 1
              FROM ooo_oos AS block
              WHERE block.tenant_id = current_setting('app.tenant_id', true)::uuid
                AND block.space_id = loss.space_id
                AND block.kind = 'oos'
                AND NOT isempty(block.period)
                AND block.period && tstzrange(loss.from_at, loss.to_at, '[)')
            ) THEN GREATEST(loss.physical - loss.sold - loss.held - loss.ooo, 0)
            ELSE 0
          END AS blocked
        FROM occupancy_loss AS loss
      ),
      replacement AS MATERIALIZED (
        SELECT
          current_setting('app.tenant_id', true)::uuid AS tenant_id,
          $1::uuid AS property_node,
          unit_type_id,
          stay_date,
          sum(physical)::int AS physical,
          sum(sold)::int AS sold,
          sum(held)::int AS held,
          sum(blocked)::int AS blocked,
          sum(ooo)::int AS ooo
        FROM mapping_projection
        GROUP BY unit_type_id, stay_date
      ),
      inserted AS (
        INSERT INTO availability_projection (
          tenant_id, property_node, unit_type_id, stay_date,
          physical, sold, held, blocked, ooo, updated_at
        )
        SELECT tenant_id, property_node, unit_type_id, stay_date,
               physical, sold, held, blocked, ooo, transaction_timestamp()
        FROM replacement
        WHERE physical >= sold + held + blocked + ooo
        ORDER BY stay_date, unit_type_id
        RETURNING unit_type_id
      )
      SELECT count(*)::int AS rows, count(DISTINCT unit_type_id)::int AS unit_types
      FROM inserted
    `, [property.id, input.fromDate, input.toDate, property.oos_sellability]);
    const evidence = inserted[0];
    if (!evidence) throw new Error("Projection rebuild did not return evidence");
    return {
      propertyNode: property.id,
      fromDate: input.fromDate,
      toDate: input.toDate,
      rows: evidence.rows,
      unitTypes: evidence.unit_types,
    };
  }

  async replaceHorizon(tx: Tx, input: RebuildAvailabilityProjectionInput): Promise<ProjectionRebuildResult> {
    const result = await this.rebuild(tx, input);
    await tx.unsafe(`
      DELETE FROM availability_projection
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = $1::uuid
        AND (stay_date < $2::date OR stay_date >= $3::date)
    `, [input.propertyNode, input.fromDate, input.toDate]);
    return result;
  }
}
