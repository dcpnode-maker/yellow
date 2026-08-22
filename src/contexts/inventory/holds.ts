import type { AuditEnvelope, EventBus, Tx } from "../../kernel";
import { recordFact } from "../../kernel";
import { InventoryNotFoundError, InventoryValidationError } from "./inventory";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type HoldStatus = "active" | "consumed" | "expired" | "released";
export type HoldKind = "cart" | "offline_lease" | "manual";

export interface CartHold {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly sellableUnitId: string;
  readonly from: Date;
  readonly to: Date;
  readonly holder: Readonly<Record<string, unknown>>;
  readonly expiresAt: Date;
  readonly kind: HoldKind;
  readonly status: HoldStatus;
}

export interface PlaceCartHoldInput {
  readonly sellableUnitId: string;
  readonly from: Date;
  readonly to: Date;
  readonly ttlSeconds: number;
  readonly holder?: Readonly<Record<string, unknown>>;
  readonly envelope: AuditEnvelope;
}

export interface PlaceOfflineLeaseInput {
  readonly sellableUnitId: string;
  readonly from: Date;
  readonly to: Date;
  readonly ttlSeconds: number;
  readonly deviceId: string;
  readonly deviceLabel?: string;
  readonly envelope: AuditEnvelope;
}

export interface TransitionHoldInput {
  readonly holdId: string;
  readonly envelope: AuditEnvelope;
}

export interface ConsumeCartHoldInput extends TransitionHoldInput {
  readonly segmentId: string;
}

export interface ConsumedCartHold {
  readonly hold: CartHold;
  readonly segmentId: string;
  readonly unitTypeId: string;
  readonly claimCount: number;
}

interface HoldRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly property_node: string;
  readonly sellable_unit_id: string;
  readonly from_at: Date;
  readonly to_at: Date;
  readonly holder: Record<string, unknown>;
  readonly expires_at: Date;
  readonly kind: HoldKind;
  readonly status: HoldStatus;
}

interface MappingRow {
  readonly space_id: string;
  readonly claim_mode: "exclusive" | "positional";
  readonly sellable_status: string;
  readonly space_status: string;
  readonly property_matches: boolean;
}

interface OccupancyRow {
  readonly id: string;
  readonly space_id: string;
  readonly period: string;
  readonly claim: string;
  readonly exclusive: boolean;
}

interface ConsumableHoldRow extends HoldRow {
  readonly unit_type_id: string;
}

interface OccupancyEventSlot {
  readonly slotRef: string;
  readonly slotKind: "hold" | "segment";
  readonly holdId?: string;
  readonly holdKind?: HoldKind;
  readonly segmentId?: string;
}

export class HoldConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HoldConflictError";
  }
}

function requireUuid(name: string, value: string): void {
  if (!UUID.test(value)) throw new InventoryValidationError(`${name} must be a UUID`);
}

function requireOperation(envelope: AuditEnvelope, expected: string): void {
  if (envelope.operation !== expected) {
    throw new InventoryValidationError(`audit operation must be ${expected}`);
  }
}

function normalizeHolder(value: Readonly<Record<string, unknown>> | undefined): Record<string, unknown> {
  const source = value ?? {};
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    throw new InventoryValidationError("holder must be a JSON object");
  }
  try {
    const encoded = JSON.stringify(source);
    if (new TextEncoder().encode(encoded).length > 8_192) {
      throw new InventoryValidationError("holder must not exceed 8192 UTF-8 bytes");
    }
    const decoded: unknown = JSON.parse(encoded);
    if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
      throw new InventoryValidationError("holder must be a JSON object");
    }
    return decoded as Record<string, unknown>;
  } catch (error) {
    if (error instanceof InventoryValidationError) throw error;
    throw new InventoryValidationError("holder must be JSON serializable");
  }
}

function offlineLeaseHolder(deviceId: string, deviceLabel: string | undefined): Record<string, unknown> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(deviceId)) {
    throw new InventoryValidationError("deviceId must be a stable 1-128 character device identifier");
  }
  if (deviceLabel !== undefined &&
      (deviceLabel !== deviceLabel.trim() || !/^[^\u0000-\u001f\u007f]{1,120}$/u.test(deviceLabel))) {
    throw new InventoryValidationError("deviceLabel must be 1-120 printable characters");
  }
  return {
    device_id: deviceId,
    ...(deviceLabel === undefined ? {} : { device_label: deviceLabel }),
  };
}

function validatePeriod(from: Date, to: Date): void {
  if (!(from instanceof Date) || !(to instanceof Date) ||
      !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
    throw new InventoryValidationError("hold period must contain finite ordered instants");
  }
}

function isOccupancyConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("errno" in error)) return false;
  return error.errno === "23P01" || error.errno === "P0002";
}

function toHold(row: HoldRow): CartHold {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    propertyNode: row.property_node,
    sellableUnitId: row.sellable_unit_id,
    from: row.from_at,
    to: row.to_at,
    holder: row.holder,
    expiresAt: row.expires_at,
    kind: row.kind,
    status: row.status,
  };
}

const HOLD_COLUMNS = `
  id, tenant_id, property_node, sellable_unit_id,
  lower(period) AS from_at, upper(period) AS to_at,
  holder, expires_at, kind, status
`;

async function occupancyRows(tx: Tx, holdId: string): Promise<OccupancyRow[]> {
  return tx.unsafe<OccupancyRow[]>(`
    SELECT id, space_id, period::text, claim::text, exclusive
    FROM space_occupancy
    WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
      AND slot_ref = $1::uuid
      AND slot_kind = 'hold'
    ORDER BY space_id, id
  `, [holdId]);
}

export class HoldService {
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  async place(tx: Tx, input: PlaceCartHoldInput): Promise<CartHold> {
    if (!Number.isInteger(input.ttlSeconds) || input.ttlSeconds < 1 || input.ttlSeconds > 900) {
      throw new InventoryValidationError("ttlSeconds must be an integer between 1 and 900");
    }
    return this.#place(tx, {
      ...input,
      kind: "cart",
      holder: normalizeHolder(input.holder),
    });
  }

  async placeOfflineLease(tx: Tx, input: PlaceOfflineLeaseInput): Promise<CartHold> {
    if (!Number.isInteger(input.ttlSeconds) || input.ttlSeconds < 3_600 || input.ttlSeconds > 604_800 ||
        input.ttlSeconds % 3_600 !== 0) {
      throw new InventoryValidationError("ttlSeconds must represent 1-168 whole hours");
    }
    return this.#place(tx, {
      sellableUnitId: input.sellableUnitId,
      from: input.from,
      to: input.to,
      ttlSeconds: input.ttlSeconds,
      holder: offlineLeaseHolder(input.deviceId, input.deviceLabel),
      kind: "offline_lease",
      envelope: input.envelope,
    });
  }

  async #place(tx: Tx, input: PlaceCartHoldInput & {
    readonly kind: "cart" | "offline_lease";
    readonly holder: Record<string, unknown>;
  }): Promise<CartHold> {
    requireOperation(input.envelope, "hold.created");
    requireUuid("sellableUnitId", input.sellableUnitId);
    validatePeriod(input.from, input.to);
    const mappings = await tx<MappingRow[]>`
      SELECT sus.space_id, sus.claim_mode, su.status AS sellable_status,
             s.status AS space_status, s.property_node = ut.property_node AS property_matches
      FROM sellable_unit AS su
      JOIN unit_type AS ut ON ut.id = su.unit_type_id AND ut.tenant_id = su.tenant_id
      JOIN sellable_unit_space AS sus
        ON sus.sellable_unit_id = su.id AND sus.tenant_id = su.tenant_id
      JOIN space AS s ON s.id = sus.space_id AND s.tenant_id = sus.tenant_id
      WHERE su.id = ${input.sellableUnitId}::uuid
        AND su.tenant_id = ${input.envelope.tenantId}::uuid
        AND su.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND ut.property_node = ${input.envelope.propertyNode}::uuid
      ORDER BY sus.space_id
    `;
    if (mappings.length === 0 || mappings.some((mapping) =>
      mapping.sellable_status !== "active" || mapping.space_status !== "active" || !mapping.property_matches
    )) {
      throw new InventoryNotFoundError("Active sellable unit was not found in the active property");
    }

    const rows = await tx.unsafe<HoldRow[]>(`
      INSERT INTO hold (
        tenant_id, property_node, sellable_unit_id, period, kind, holder, expires_at
      )
      VALUES (
        $1::uuid, $2::uuid, $3::uuid, tstzrange($4::timestamptz, $5::timestamptz, '[)'),
        $6::text, $7::text::jsonb, transaction_timestamp() + make_interval(secs => $8::int)
      )
      RETURNING ${HOLD_COLUMNS}
    `, [
      input.envelope.tenantId,
      input.envelope.propertyNode,
      input.sellableUnitId,
      input.from.toISOString(),
      input.to.toISOString(),
      input.kind,
      JSON.stringify(input.holder),
      input.ttlSeconds,
    ]);
    const row = rows[0];
    if (!row) throw new Error("PostgreSQL did not return the created hold");

    const occupancies: OccupancyRow[] = [];
    try {
      for (const mapping of mappings) {
        const result = await tx<Array<{ id: string }>>`
          SELECT record_occupancy(
            ${row.tenant_id}::uuid,
            ${mapping.space_id}::uuid,
            tstzrange(${input.from.toISOString()}::timestamptz, ${input.to.toISOString()}::timestamptz, '[)'),
            ${row.id}::uuid,
            'hold',
            ${mapping.claim_mode === "exclusive"}
          ) AS id
        `;
        const occupancyId = result[0]?.id;
        if (!occupancyId) throw new Error("PostgreSQL did not return the occupancy id");
        const created = await tx<OccupancyRow[]>`
          SELECT id, space_id, period::text AS period, claim::text AS claim, exclusive
          FROM space_occupancy
          WHERE id = ${occupancyId}::uuid
            AND tenant_id = ${row.tenant_id}::uuid
            AND slot_ref = ${row.id}::uuid
        `;
        const claim = created[0];
        if (!claim) throw new Error("PostgreSQL did not return the occupancy claim");
        occupancies.push(claim);
      }
    } catch (error) {
      if (isOccupancyConflict(error)) throw new HoldConflictError("Requested inventory is no longer available");
      throw error;
    }

    const fact = await recordFact(tx, {
      entityType: "hold",
      entityId: row.id,
      envelope: input.envelope,
      payload: {
        kind: row.kind,
        sellable_unit_id: row.sellable_unit_id,
        period: { from: input.from.toISOString(), to: input.to.toISOString() },
        expires_at: row.expires_at.toISOString(),
        ...(row.kind === "offline_lease" ? { device_id: row.holder.device_id } : {}),
      },
    });
    await this.#events.publish(tx, {
      tenantId: row.tenant_id,
      propertyNode: row.property_node,
      businessDate: fact.businessDate,
      aggregateType: "hold",
      aggregateId: row.id,
      eventType: "hold.created",
      actorId: input.envelope.actorId,
      correlationId: input.envelope.requestId,
      payload: {
        hold_id: row.id,
        kind: row.kind,
        sellable_unit_id: row.sellable_unit_id,
        expires_at: row.expires_at.toISOString(),
        ...(row.kind === "offline_lease" ? { device_id: row.holder.device_id } : {}),
      },
    });
    for (const occupancy of occupancies) {
      await this.#publishOccupancy(tx, input.envelope, fact.businessDate, {
        slotRef: row.id,
        slotKind: "hold",
        holdId: row.id,
        holdKind: row.kind,
      }, "occupancy.recorded", occupancy);
    }
    return toHold(row);
  }

  async get(tx: Tx, propertyNode: string, holdId: string): Promise<CartHold> {
    requireUuid("propertyNode", propertyNode);
    requireUuid("holdId", holdId);
    const rows = await tx.unsafe<HoldRow[]>(`
      SELECT ${HOLD_COLUMNS}
      FROM hold
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = $1::uuid
        AND id = $2::uuid
    `, [propertyNode, holdId]);
    const row = rows[0];
    if (!row) throw new InventoryNotFoundError("Hold was not found in the active property");
    return toHold(row);
  }

  async listActive(tx: Tx, propertyNode: string): Promise<readonly CartHold[]> {
    return this.#listActiveKind(tx, propertyNode, "cart");
  }

  async listActiveOfflineLeases(tx: Tx, propertyNode: string): Promise<readonly CartHold[]> {
    return this.#listActiveKind(tx, propertyNode, "offline_lease");
  }

  async #listActiveKind(tx: Tx, propertyNode: string, kind: "cart" | "offline_lease"): Promise<readonly CartHold[]> {
    requireUuid("propertyNode", propertyNode);
    const rows = await tx.unsafe<HoldRow[]>(`
      SELECT ${HOLD_COLUMNS}
      FROM hold
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = $1::uuid
        AND status = 'active'
        AND kind = $2::text
      ORDER BY expires_at, id
    `, [propertyNode, kind]);
    return rows.map(toHold);
  }

  release(tx: Tx, input: TransitionHoldInput): Promise<CartHold> {
    requireOperation(input.envelope, "hold.released");
    return this.#transition(tx, input, "released", "cart");
  }

  releaseOfflineLease(tx: Tx, input: TransitionHoldInput): Promise<CartHold> {
    requireOperation(input.envelope, "hold.released");
    return this.#transition(tx, input, "released", "offline_lease");
  }

  async consumeForSegment(tx: Tx, input: ConsumeCartHoldInput): Promise<ConsumedCartHold> {
    requireOperation(input.envelope, "hold.consumed");
    requireUuid("holdId", input.holdId);
    requireUuid("segmentId", input.segmentId);

    const rows = await tx.unsafe<ConsumableHoldRow[]>(`
      SELECT
        h.id, h.tenant_id, h.property_node, h.sellable_unit_id,
        lower(h.period) AS from_at, upper(h.period) AS to_at,
        h.holder, h.expires_at, h.kind, h.status,
        su.unit_type_id
      FROM hold AS h
      JOIN sellable_unit AS su
        ON su.id = h.sellable_unit_id
       AND su.tenant_id = h.tenant_id
      WHERE h.tenant_id = $1::uuid
        AND h.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND h.property_node = $2::uuid
        AND h.id = $3::uuid
        AND h.kind = 'cart'
        AND h.status = 'active'
        AND h.expires_at > transaction_timestamp()
      FOR UPDATE OF h
    `, [input.envelope.tenantId, input.envelope.propertyNode, input.holdId]);
    const existing = rows[0];
    if (!existing) throw new HoldConflictError("Active unexpired cart hold was not found");

    const occupancies = await occupancyRows(tx, existing.id);
    if (occupancies.length === 0) {
      throw new HoldConflictError("Active cart hold has no occupancy claims");
    }
    const released = await tx<Array<{ count: number }>>`
      SELECT release_occupancy(${existing.tenant_id}::uuid, ${existing.id}::uuid) AS count
    `;
    if (Number(released[0]?.count) !== occupancies.length) {
      throw new Error("Occupancy release count did not match the hold's captured claims");
    }

    const replacements: OccupancyRow[] = [];
    try {
      for (const occupancy of occupancies) {
        const result = await tx<Array<{ id: string }>>`
          SELECT record_occupancy(
            ${existing.tenant_id}::uuid,
            ${occupancy.space_id}::uuid,
            ${occupancy.period}::tstzrange,
            ${input.segmentId}::uuid,
            'segment',
            ${occupancy.exclusive}
          ) AS id
        `;
        const occupancyId = result[0]?.id;
        if (!occupancyId) throw new Error("PostgreSQL did not return the transferred occupancy id");
        const created = await tx<OccupancyRow[]>`
          SELECT id, space_id, period::text AS period, claim::text AS claim, exclusive
          FROM space_occupancy
          WHERE id = ${occupancyId}::uuid
            AND tenant_id = ${existing.tenant_id}::uuid
            AND slot_ref = ${input.segmentId}::uuid
            AND slot_kind = 'segment'
        `;
        const claim = created[0];
        if (!claim) throw new Error("PostgreSQL did not return the transferred occupancy claim");
        replacements.push(claim);
      }
    } catch (error) {
      if (isOccupancyConflict(error)) {
        throw new HoldConflictError("Held inventory could not be transferred to the reservation segment");
      }
      throw error;
    }
    if (replacements.length !== occupancies.length) {
      throw new Error("Transferred occupancy count did not match the hold's captured claims");
    }

    const updated = await tx.unsafe<HoldRow[]>(`
      UPDATE hold
      SET status = 'consumed'
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
        AND status = 'active'
      RETURNING ${HOLD_COLUMNS}
    `, [existing.id, existing.tenant_id]);
    const row = updated[0];
    if (!row) throw new HoldConflictError("Hold changed concurrently");

    const fact = await recordFact(tx, {
      entityType: "hold",
      entityId: row.id,
      envelope: input.envelope,
      payload: {
        kind: row.kind,
        previous_status: "active",
        status: "consumed",
        segment_id: input.segmentId,
        transferred_claims: replacements.length,
      },
    });
    await this.#events.publish(tx, {
      tenantId: row.tenant_id,
      propertyNode: row.property_node,
      businessDate: fact.businessDate,
      aggregateType: "hold",
      aggregateId: row.id,
      eventType: "hold.consumed",
      actorId: input.envelope.actorId,
      correlationId: input.envelope.requestId,
      payload: {
        hold_id: row.id,
        kind: row.kind,
        previous_status: "active",
        status: "consumed",
        segment_id: input.segmentId,
      },
    });
    for (const occupancy of occupancies) {
      await this.#publishOccupancy(tx, input.envelope, fact.businessDate, {
        slotRef: row.id,
        slotKind: "hold",
        holdId: row.id,
        holdKind: row.kind,
      }, "occupancy.released", occupancy);
    }
    for (const occupancy of replacements) {
      await this.#publishOccupancy(tx, input.envelope, fact.businessDate, {
        slotRef: input.segmentId,
        slotKind: "segment",
        holdId: row.id,
        holdKind: row.kind,
        segmentId: input.segmentId,
      }, "occupancy.recorded", occupancy);
    }

    return Object.freeze({
      hold: Object.freeze(toHold(row)),
      segmentId: input.segmentId,
      unitTypeId: existing.unit_type_id,
      claimCount: replacements.length,
    });
  }

  async expireDue(tx: Tx, envelope: AuditEnvelope, limit = 100): Promise<readonly CartHold[]> {
    requireOperation(envelope, "hold.expired");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new InventoryValidationError("expiry limit must be an integer between 1 and 100");
    }
    const due = await tx<Array<{ id: string }>>`
      SELECT id
      FROM hold
      WHERE tenant_id = ${envelope.tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = ${envelope.propertyNode}::uuid
        AND status = 'active'
        AND expires_at <= transaction_timestamp()
      ORDER BY expires_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
    const expired: CartHold[] = [];
    for (const { id } of due) {
      expired.push(await this.#transition(tx, { holdId: id, envelope }, "expired"));
    }
    return expired;
  }

  async #transition(
    tx: Tx,
    input: TransitionHoldInput,
    status: "released" | "expired",
    expectedKind?: "cart" | "offline_lease",
  ): Promise<CartHold> {
    requireUuid("holdId", input.holdId);
    const duePredicate = status === "expired"
      ? "AND expires_at <= transaction_timestamp()"
      : "AND expires_at > transaction_timestamp()";
    const rows = await tx.unsafe<HoldRow[]>(`
      SELECT ${HOLD_COLUMNS}
      FROM hold
      WHERE tenant_id = $1::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = $2::uuid
        AND id = $3::uuid
        AND status = 'active'
        AND ($4::text IS NULL OR kind = $4::text)
        ${duePredicate}
      FOR UPDATE
    `, [input.envelope.tenantId, input.envelope.propertyNode, input.holdId, expectedKind ?? null]);
    const existing = rows[0];
    if (!existing) throw new HoldConflictError(`Active ${status === "expired" ? "due" : "unexpired"} hold was not found`);
    const occupancies = await occupancyRows(tx, existing.id);
    const released = await tx<Array<{ count: number }>>`
      SELECT release_occupancy(${existing.tenant_id}::uuid, ${existing.id}::uuid) AS count
    `;
    if (Number(released[0]?.count) !== occupancies.length) {
      throw new Error("Occupancy release count did not match the hold's captured claims");
    }
    const updated = await tx.unsafe<HoldRow[]>(`
      UPDATE hold
      SET status = $1
      WHERE id = $2::uuid AND tenant_id = $3::uuid AND status = 'active'
      RETURNING ${HOLD_COLUMNS}
    `, [status, existing.id, existing.tenant_id]);
    const row = updated[0];
    if (!row) throw new HoldConflictError("Hold changed concurrently");
    const eventType = `hold.${status}`;
    const fact = await recordFact(tx, {
      entityType: "hold",
      entityId: row.id,
      envelope: input.envelope,
      payload: { kind: row.kind, previous_status: "active", status, released_claims: occupancies.length },
    });
    await this.#events.publish(tx, {
      tenantId: row.tenant_id,
      propertyNode: row.property_node,
      businessDate: fact.businessDate,
      aggregateType: "hold",
      aggregateId: row.id,
      eventType,
      actorId: input.envelope.actorId,
      correlationId: input.envelope.requestId,
      payload: { hold_id: row.id, kind: row.kind, previous_status: "active", status },
    });
    for (const occupancy of occupancies) {
      await this.#publishOccupancy(tx, input.envelope, fact.businessDate, {
        slotRef: row.id,
        slotKind: "hold",
        holdId: row.id,
        holdKind: row.kind,
      }, "occupancy.released", occupancy);
    }
    return toHold(row);
  }

  async #publishOccupancy(
    tx: Tx,
    envelope: AuditEnvelope,
    businessDate: string,
    slot: OccupancyEventSlot,
    eventType: "occupancy.recorded" | "occupancy.released",
    occupancy: OccupancyRow,
  ): Promise<void> {
    await this.#events.publish(tx, {
      tenantId: envelope.tenantId,
      propertyNode: envelope.propertyNode,
      businessDate,
      aggregateType: "space_occupancy",
      aggregateId: occupancy.id,
      eventType,
      actorId: envelope.actorId,
      correlationId: envelope.requestId,
      payload: {
        occupancy_id: occupancy.id,
        slot_ref: slot.slotRef,
        slot_kind: slot.slotKind,
        ...(slot.holdId === undefined ? {} : { hold_id: slot.holdId }),
        ...(slot.holdKind === undefined ? {} : { kind: slot.holdKind }),
        ...(slot.segmentId === undefined ? {} : { segment_id: slot.segmentId }),
        space_id: occupancy.space_id,
        period: occupancy.period,
        claim: occupancy.claim,
        exclusive: occupancy.exclusive,
      },
    });
  }
}
