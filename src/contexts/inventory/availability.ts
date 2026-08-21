import type { Tx } from "../../kernel";
import { InventoryValidationError } from "./inventory";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface SearchAvailabilityInput {
  readonly propertyNode: string;
  readonly from: Date;
  readonly to: Date;
  readonly partySize?: number;
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
  return partySize;
}

export class AvailabilityService {
  async search(tx: Tx, input: SearchAvailabilityInput): Promise<readonly AvailabilityOption[]> {
    const partySize = validate(input);
    const rows = await tx.unsafe<AvailabilityRow[]>(`
      WITH occupancy_summary AS (
        SELECT
          space_id,
          bool_or(exclusive) AS has_exclusive,
          count(*) FILTER (WHERE NOT exclusive)::int AS positional_claims
        FROM space_occupancy
        WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
          AND period && tstzrange($2::timestamptz, $3::timestamptz, '[)')
        GROUP BY space_id
      ),
      mapping_capacity AS (
        SELECT
          su.id AS sellable_unit_id,
          su.name AS sellable_unit_name,
          su.status AS sellable_status,
          ut.id AS unit_type_id,
          ut.code AS unit_type_code,
          ut.name AS unit_type_name,
          ut.profile_key,
          ut.max_occupancy,
          ut.sort_order,
          s.id AS space_id,
          s.status AS space_status,
          s.property_node = ut.property_node AS property_matches,
          CASE
            WHEN sus.claim_mode = 'exclusive' THEN
              CASE WHEN os.space_id IS NULL THEN 1 ELSE 0 END
            WHEN COALESCE(os.has_exclusive, false) THEN 0
            ELSE GREATEST(s.capacity - COALESCE(os.positional_claims, 0), 0)
          END AS free_claims
        FROM sellable_unit AS su
        JOIN unit_type AS ut ON ut.id = su.unit_type_id AND ut.tenant_id = su.tenant_id
        JOIN sellable_unit_space AS sus
          ON sus.sellable_unit_id = su.id AND sus.tenant_id = su.tenant_id
        JOIN space AS s ON s.id = sus.space_id AND s.tenant_id = sus.tenant_id
        LEFT JOIN occupancy_summary AS os ON os.space_id = s.id
        WHERE su.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND ut.property_node = $1::uuid
          AND ut.max_occupancy >= $4::int
      )
      SELECT
        sellable_unit_id,
        sellable_unit_name,
        unit_type_id,
        unit_type_code,
        unit_type_name,
        profile_key,
        max_occupancy,
        min(free_claims)::int AS available_count
      FROM mapping_capacity
      GROUP BY sellable_unit_id, sellable_unit_name, sellable_status,
               unit_type_id, unit_type_code, unit_type_name, profile_key,
               max_occupancy, sort_order
      HAVING sellable_status = 'active'
         AND bool_and(space_status = 'active' AND property_matches)
      ORDER BY sort_order, unit_type_code, sellable_unit_name, sellable_unit_id
    `, [input.propertyNode, input.from.toISOString(), input.to.toISOString(), partySize]);
    return rows.map((row) => ({
      sellableUnitId: row.sellable_unit_id,
      sellableUnitName: row.sellable_unit_name,
      unitTypeId: row.unit_type_id,
      unitTypeCode: row.unit_type_code,
      unitTypeName: row.unit_type_name,
      profileKey: row.profile_key,
      maxOccupancy: row.max_occupancy,
      availableCount: row.available_count,
    }));
  }
}
