import {
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type Tx,
} from "../../kernel";
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
  type ClaimMode,
} from "./inventory";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_STAY_MS = 366 * 24 * 60 * 60 * 1_000;
const POSITIONAL_ATTEMPTS = 3;
const POSITIONAL_SAVEPOINT = "yellow_direct_positional_claim";

export interface ClaimReservationSegmentInput {
  readonly sellableUnitId: string;
  readonly segmentId: string;
  readonly from: Date;
  readonly to: Date;
  readonly envelope: AuditEnvelope;
}

export interface ReleaseReservationSegmentInput {
  readonly segmentId: string;
  readonly envelope: AuditEnvelope;
}

export interface ReservationSegmentClaim {
  readonly sellableUnitId: string;
  readonly unitTypeId: string;
  readonly from: Date;
  readonly to: Date;
  readonly claimCount: number;
  readonly claims: readonly ReservationSegmentOccupancyClaim[];
}

export interface ReservationSegmentRelease {
  readonly segmentId: string;
  readonly claimCount: number;
  readonly claims: readonly ReservationSegmentOccupancyClaim[];
}

export interface ReservationSegmentOccupancyClaim {
  readonly id: string;
  readonly spaceId: string;
  readonly period: string;
  readonly claim: string;
  readonly exclusive: boolean;
}

interface MappingRow {
  readonly unit_type_id: string;
  readonly space_id: string;
  readonly claim_mode: ClaimMode;
  readonly sellable_status: string;
  readonly space_status: string;
  readonly unit_property: string;
  readonly space_property: string;
}

interface OccupancyRow {
  readonly id: string;
  readonly space_id: string;
  readonly period: string;
  readonly claim: string;
  readonly exclusive: boolean;
}

function freezeClaims(rows: readonly OccupancyRow[]): readonly ReservationSegmentOccupancyClaim[] {
  return Object.freeze(rows.map((row) => Object.freeze({
    id: row.id,
    spaceId: row.space_id,
    period: row.period,
    claim: row.claim,
    exclusive: row.exclusive,
  })));
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new InventoryValidationError(`${name} must be a UUID`);
  }
  return value;
}

function requirePeriod(from: unknown, to: unknown): Readonly<{ from: Date; to: Date }> {
  if (!(from instanceof Date) || !(to instanceof Date) ||
      !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) ||
      from >= to || to.getTime() - from.getTime() > MAX_STAY_MS) {
    throw new InventoryValidationError("reservation stay must be a positive period of at most 366 days");
  }
  return Object.freeze({ from: new Date(from), to: new Date(to) });
}

function sqlState(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  for (const key of ["errno", "code", "sqlState"] as const) {
    const value = (error as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return null;
}

function isOccupancyConflict(error: unknown): boolean {
  const state = sqlState(error);
  return state === "23P01" || state === "40P01" || state === "P0002";
}

async function recordClaim(
  tx: Tx,
  tenantId: string,
  mapping: MappingRow,
  period: Readonly<{ from: Date; to: Date }>,
  segmentId: string,
): Promise<string> {
  const exclusive = mapping.claim_mode === "exclusive";
  const execute = async (): Promise<string> => {
    const rows = await tx<Array<{ id: string }>>`
      SELECT record_occupancy(
        ${tenantId}::uuid,
        ${mapping.space_id}::uuid,
        tstzrange(${period.from.toISOString()}::timestamptz, ${period.to.toISOString()}::timestamptz, '[)'),
        ${segmentId}::uuid,
        'segment',
        ${exclusive}
      ) AS id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("PostgreSQL did not return the occupancy id");
    return id;
  };

  if (exclusive) {
    try {
      return await execute();
    } catch (error) {
      if (isOccupancyConflict(error)) {
        throw new InventoryConflictError("Requested exclusive inventory is no longer available");
      }
      throw error;
    }
  }

  for (let attempt = 1; attempt <= POSITIONAL_ATTEMPTS; attempt += 1) {
    await tx.unsafe(`SAVEPOINT ${POSITIONAL_SAVEPOINT}`);
    try {
      const id = await execute();
      await tx.unsafe(`RELEASE SAVEPOINT ${POSITIONAL_SAVEPOINT}`);
      return id;
    } catch (error) {
      await tx.unsafe(`ROLLBACK TO SAVEPOINT ${POSITIONAL_SAVEPOINT}`);
      await tx.unsafe(`RELEASE SAVEPOINT ${POSITIONAL_SAVEPOINT}`);
      const state = sqlState(error);
      if (state === "23P01" && attempt < POSITIONAL_ATTEMPTS) continue;
      if (state === "23P01" || state === "40P01" || state === "P0002") {
        throw new InventoryConflictError("Requested positional inventory is no longer available");
      }
      throw error;
    }
  }
  throw new InventoryConflictError("Requested positional inventory is no longer available");
}

export class ReservationOccupancyService {
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  async claimForSegment(tx: Tx, input: ClaimReservationSegmentInput): Promise<ReservationSegmentClaim> {
    if (input.envelope.operation !== "occupancy.recorded") {
      throw new InventoryValidationError("audit operation must be occupancy.recorded");
    }
    const sellableUnitId = requireUuid("sellableUnitId", input.sellableUnitId);
    const segmentId = requireUuid("segmentId", input.segmentId);
    const period = requirePeriod(input.from, input.to);
    await tx`
      SELECT pg_advisory_xact_lock(hashtextextended(${segmentId}::text, 85))
    `;
    const existingClaims = await tx<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM space_occupancy
      WHERE tenant_id = ${input.envelope.tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND slot_ref = ${segmentId}::uuid
        AND slot_kind = 'segment'
    `;
    if (Number(existingClaims[0]?.count) !== 0) {
      throw new InventoryConflictError("Reservation segment already owns occupancy claims");
    }
    const mappings = await tx<MappingRow[]>`
      SELECT
        su.unit_type_id,
        sus.space_id,
        sus.claim_mode,
        su.status AS sellable_status,
        space.status AS space_status,
        unit_type.property_node AS unit_property,
        space.property_node AS space_property
      FROM sellable_unit AS su
      JOIN unit_type
        ON unit_type.id = su.unit_type_id
       AND unit_type.tenant_id = su.tenant_id
      JOIN sellable_unit_space AS sus
        ON sus.sellable_unit_id = su.id
       AND sus.tenant_id = su.tenant_id
      JOIN space
        ON space.id = sus.space_id
       AND space.tenant_id = sus.tenant_id
      WHERE su.id = ${sellableUnitId}::uuid
        AND su.tenant_id = ${input.envelope.tenantId}::uuid
        AND su.tenant_id = current_setting('app.tenant_id', true)::uuid
      ORDER BY sus.space_id
    `;
    const first = mappings[0];
    if (!first || mappings.some((mapping) =>
      mapping.unit_type_id !== first.unit_type_id ||
      mapping.sellable_status !== "active" ||
      mapping.space_status !== "active" ||
      mapping.unit_property !== input.envelope.propertyNode ||
      mapping.space_property !== input.envelope.propertyNode
    )) {
      throw new InventoryNotFoundError("Active sellable unit was not found in the active property");
    }

    const occupancies: OccupancyRow[] = [];
    for (const mapping of mappings) {
      const occupancyId = await recordClaim(tx, input.envelope.tenantId, mapping, period, segmentId);
      const rows = await tx<OccupancyRow[]>`
        SELECT id, space_id, period::text AS period, claim::text AS claim, exclusive
        FROM space_occupancy
        WHERE id = ${occupancyId}::uuid
          AND tenant_id = ${input.envelope.tenantId}::uuid
          AND slot_ref = ${segmentId}::uuid
          AND slot_kind = 'segment'
          AND space_id = ${mapping.space_id}::uuid
          AND period = tstzrange(${period.from.toISOString()}::timestamptz, ${period.to.toISOString()}::timestamptz, '[)')
          AND exclusive = ${mapping.claim_mode === "exclusive"}
      `;
      const occupancy = rows[0];
      if (!occupancy) throw new Error("PostgreSQL did not return the exact segment occupancy claim");
      occupancies.push(occupancy);
    }
    if (occupancies.length !== mappings.length) {
      throw new Error("Created occupancy count did not match the sellable mappings");
    }

    const fact = await recordFact(tx, {
      entityType: "reservation_segment",
      entityId: segmentId,
      envelope: input.envelope,
      payload: {
        sellable_unit_id: sellableUnitId,
        unit_type_id: first.unit_type_id,
        period: { from: period.from.toISOString(), to: period.to.toISOString() },
        claim_count: occupancies.length,
      },
    });
    for (const occupancy of occupancies) {
      await this.#events.publish(tx, {
        tenantId: input.envelope.tenantId,
        propertyNode: input.envelope.propertyNode,
        businessDate: fact.businessDate,
        aggregateType: "space_occupancy",
        aggregateId: occupancy.id,
        eventType: "occupancy.recorded",
        actorId: input.envelope.actorId,
        correlationId: input.envelope.requestId,
        payload: {
          occupancy_id: occupancy.id,
          slot_ref: segmentId,
          slot_kind: "segment",
          segment_id: segmentId,
          space_id: occupancy.space_id,
          period: occupancy.period,
          claim: occupancy.claim,
          exclusive: occupancy.exclusive,
        },
      });
    }

    return Object.freeze({
      sellableUnitId,
      unitTypeId: first.unit_type_id,
      from: new Date(period.from),
      to: new Date(period.to),
      claimCount: occupancies.length,
      claims: freezeClaims(occupancies),
    });
  }

  async releaseForSegment(
    tx: Tx,
    input: ReleaseReservationSegmentInput,
  ): Promise<ReservationSegmentRelease> {
    if (input.envelope.operation !== "occupancy.released") {
      throw new InventoryValidationError("audit operation must be occupancy.released");
    }
    const segmentId = requireUuid("segmentId", input.segmentId);
    await tx`
      SELECT pg_advisory_xact_lock(hashtextextended(${segmentId}::text, 85))
    `;
    const occupancies = await tx<OccupancyRow[]>`
      SELECT occupancy.id, occupancy.space_id, occupancy.period::text AS period,
             occupancy.claim::text AS claim, occupancy.exclusive
      FROM space_occupancy AS occupancy
      JOIN reservation_segment AS segment
        ON segment.id = occupancy.slot_ref
       AND segment.tenant_id = occupancy.tenant_id
      JOIN reservation
        ON reservation.id = segment.reservation_id
       AND reservation.tenant_id = segment.tenant_id
      WHERE occupancy.tenant_id = ${input.envelope.tenantId}::uuid
        AND occupancy.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND occupancy.slot_ref = ${segmentId}::uuid
        AND occupancy.slot_kind = 'segment'
        AND reservation.property_node = ${input.envelope.propertyNode}::uuid
      ORDER BY occupancy.space_id, occupancy.id
    `;
    if (occupancies.length === 0) {
      throw new InventoryConflictError("Reservation segment has no releasable occupancy claims");
    }
    const released = await tx<Array<{ count: number }>>`
      SELECT release_occupancy(${input.envelope.tenantId}::uuid, ${segmentId}::uuid) AS count
    `;
    if (Number(released[0]?.count) !== occupancies.length) {
      throw new Error("Occupancy release count did not match the segment's captured claims");
    }

    const fact = await recordFact(tx, {
      entityType: "reservation_segment",
      entityId: segmentId,
      envelope: input.envelope,
      payload: { segment_id: segmentId, claim_count: occupancies.length },
    });
    for (const occupancy of occupancies) {
      await this.#events.publish(tx, {
        tenantId: input.envelope.tenantId,
        propertyNode: input.envelope.propertyNode,
        businessDate: fact.businessDate,
        aggregateType: "space_occupancy",
        aggregateId: occupancy.id,
        eventType: "occupancy.released",
        actorId: input.envelope.actorId,
        correlationId: input.envelope.requestId,
        payload: {
          occupancy_id: occupancy.id,
          slot_ref: segmentId,
          slot_kind: "segment",
          segment_id: segmentId,
          space_id: occupancy.space_id,
          period: occupancy.period,
          claim: occupancy.claim,
          exclusive: occupancy.exclusive,
        },
      });
    }
    return Object.freeze({
      segmentId,
      claimCount: occupancies.length,
      claims: freezeClaims(occupancies),
    });
  }
}
