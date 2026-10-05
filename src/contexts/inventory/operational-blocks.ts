import type { AuditEnvelope, EventBus, Tx } from "../../kernel";
import { recordFact } from "../../kernel";
import { InventoryNotFoundError, InventoryValidationError } from "./inventory";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type OperationalBlockKind = "ooo" | "oos";

export interface OperationalBlock {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly spaceId: string;
  readonly kind: OperationalBlockKind;
  readonly from: Date;
  readonly to: Date;
  readonly reason: string;
}

export interface OpenOperationalBlockInput {
  readonly spaceId: string;
  readonly kind: OperationalBlockKind;
  readonly from: Date;
  readonly to: Date;
  readonly reason: string;
  readonly envelope: AuditEnvelope;
}

export interface CloseOperationalBlockInput {
  readonly blockId: string;
  readonly envelope: AuditEnvelope;
}

interface BlockRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly property_node: string;
  readonly space_id: string;
  readonly kind: OperationalBlockKind;
  readonly from_at: Date;
  readonly to_at: Date;
  readonly reason: string;
}

interface OccupancyRow {
  readonly id: string;
  readonly space_id: string;
  readonly period: string;
  readonly claim: string;
  readonly exclusive: boolean;
}

export class OperationalBlockConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationalBlockConflictError";
  }
}

function requireUuid(name: string, value: string): void {
  if (!UUID.test(value)) throw new InventoryValidationError(`${name} must be a UUID`);
}

function requireOperation(envelope: AuditEnvelope, expected: "ooo.opened" | "ooo.closed"): void {
  if (envelope.operation !== expected) {
    throw new InventoryValidationError(`audit operation must be ${expected}`);
  }
}

function validatePeriod(from: Date, to: Date): void {
  if (!(from instanceof Date) || !(to instanceof Date) ||
      !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
    throw new InventoryValidationError("operational block period must contain finite ordered instants");
  }
}

function normalizeReason(value: string): string {
  if (typeof value !== "string" || value !== value.trim() || value.length === 0) {
    throw new InventoryValidationError("reason must be non-empty and trimmed");
  }
  if (new TextEncoder().encode(value).length > 500) {
    throw new InventoryValidationError("reason must not exceed 500 UTF-8 bytes");
  }
  return value;
}

function isOccupancyConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("errno" in error)) return false;
  return error.errno === "23P01" || error.errno === "40P01" || error.errno === "P0002";
}

function toBlock(row: BlockRow): OperationalBlock {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    propertyNode: row.property_node,
    spaceId: row.space_id,
    kind: row.kind,
    from: row.from_at,
    to: row.to_at,
    reason: row.reason,
  };
}

const BLOCK_COLUMNS = `
  block.id,
  block.tenant_id,
  space.property_node,
  block.space_id,
  block.kind,
  lower(block.period) AS from_at,
  upper(block.period) AS to_at,
  block.reason
`;

async function occupancyRows(tx: Tx, blockId: string): Promise<OccupancyRow[]> {
  return tx.unsafe<OccupancyRow[]>(`
    SELECT id, space_id, period::text, claim::text, exclusive
    FROM space_occupancy
    WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
      AND slot_ref = $1::uuid
      AND slot_kind = 'ooo'
    ORDER BY id
  `, [blockId]);
}

export class OperationalBlockService {
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  async open(tx: Tx, input: OpenOperationalBlockInput): Promise<OperationalBlock> {
    requireOperation(input.envelope, "ooo.opened");
    requireUuid("spaceId", input.spaceId);
    if (input.kind !== "ooo" && input.kind !== "oos") {
      throw new InventoryValidationError("kind must be ooo or oos");
    }
    validatePeriod(input.from, input.to);
    const reason = normalizeReason(input.reason);

    const spaces = await tx<Array<{ id: string }>>`
      SELECT space.id
      FROM space
      JOIN org_node AS property
        ON property.id = space.property_node AND property.tenant_id = space.tenant_id
      WHERE space.id = ${input.spaceId}::uuid
        AND space.tenant_id = ${input.envelope.tenantId}::uuid
        AND space.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND space.property_node = ${input.envelope.propertyNode}::uuid
        AND space.status = 'active'
        AND property.kind = 'property'
    `;
    if (!spaces[0]) throw new InventoryNotFoundError("Active space was not found in the active property");

    const inserted = await tx.unsafe<Array<Omit<BlockRow, "property_node">>>(`
      INSERT INTO ooo_oos (tenant_id, space_id, kind, period, reason)
      SELECT
        $1::uuid,
        $2::uuid,
        $3,
        tstzrange($4::timestamptz, $5::timestamptz, '[)'),
        $6
      WHERE $5::timestamptz > transaction_timestamp()
      RETURNING
        id,
        tenant_id,
        space_id,
        kind,
        lower(period) AS from_at,
        upper(period) AS to_at,
        reason
    `, [
      input.envelope.tenantId,
      input.spaceId,
      input.kind,
      input.from.toISOString(),
      input.to.toISOString(),
      reason,
    ]);
    const created = inserted[0];
    if (!created) throw new InventoryValidationError("operational block must end in the future");
    const row: BlockRow = { ...created, property_node: input.envelope.propertyNode };

    let occupancy: OccupancyRow | undefined;
    if (row.kind === "ooo") {
      try {
        const recorded = await tx<Array<{ id: string }>>`
          SELECT record_occupancy(
            ${row.tenant_id}::uuid,
            ${row.space_id}::uuid,
            tstzrange(${input.from.toISOString()}::timestamptz, ${input.to.toISOString()}::timestamptz, '[)'),
            ${row.id}::uuid,
            'ooo',
            true
          ) AS id
        `;
        const occupancyId = recorded[0]?.id;
        if (!occupancyId) throw new Error("PostgreSQL did not return the OOO occupancy id");
        occupancy = (await occupancyRows(tx, row.id))[0];
        if (!occupancy || occupancy.id !== occupancyId || !occupancy.exclusive) {
          throw new Error("PostgreSQL did not return the exact OOO occupancy claim");
        }
      } catch (error) {
        if (isOccupancyConflict(error)) {
          throw new OperationalBlockConflictError("Requested OOO interval conflicts with authoritative occupancy");
        }
        throw error;
      }
    }

    const fact = await recordFact(tx, {
      entityType: "ooo_oos",
      entityId: row.id,
      envelope: input.envelope,
      payload: {
        kind: row.kind,
        space_id: row.space_id,
        period: { from: input.from.toISOString(), to: input.to.toISOString() },
        reason: row.reason,
      },
    });
    await this.#publishBlock(tx, row, input.envelope, fact.businessDate, "ooo.opened");
    if (occupancy) {
      await this.#publishOccupancy(tx, row, input.envelope, fact.businessDate, "occupancy.recorded", occupancy);
    }
    return toBlock(row);
  }

  async close(tx: Tx, input: CloseOperationalBlockInput): Promise<OperationalBlock> {
    requireOperation(input.envelope, "ooo.closed");
    requireUuid("blockId", input.blockId);
    const rows = await tx.unsafe<BlockRow[]>(`
      SELECT ${BLOCK_COLUMNS}
      FROM ooo_oos AS block
      JOIN space ON space.id = block.space_id AND space.tenant_id = block.tenant_id
      WHERE block.id = $1::uuid
        AND block.tenant_id = $2::uuid
        AND block.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND space.property_node = $3::uuid
        AND NOT isempty(block.period)
        AND upper(block.period) > transaction_timestamp()
      FOR UPDATE OF block
    `, [input.blockId, input.envelope.tenantId, input.envelope.propertyNode]);
    const row = rows[0];
    if (!row) throw new OperationalBlockConflictError("Active operational block was not found");

    const occupancies = await occupancyRows(tx, row.id);
    const expectedClaims = row.kind === "ooo" ? 1 : 0;
    if (occupancies.length !== expectedClaims) {
      throw new Error("Operational block occupancy did not match its kind");
    }
    if (expectedClaims === 1) {
      const released = await tx<Array<{ count: number }>>`
        SELECT release_occupancy(${row.tenant_id}::uuid, ${row.id}::uuid) AS count
      `;
      if (Number(released[0]?.count) !== expectedClaims) {
        throw new Error("OOO occupancy release count did not match its captured claim");
      }
    }
    const updated = await tx<Array<{ id: string }>>`
      UPDATE ooo_oos
      SET period = CASE
        WHEN lower(period) < transaction_timestamp()
          THEN tstzrange(lower(period), transaction_timestamp(), '[)')
        ELSE 'empty'::tstzrange
      END
      WHERE id = ${row.id}::uuid
        AND tenant_id = ${row.tenant_id}::uuid
        AND NOT isempty(period)
        AND upper(period) > transaction_timestamp()
      RETURNING id
    `;
    if (updated[0]?.id !== row.id) throw new OperationalBlockConflictError("Operational block changed concurrently");

    const fact = await recordFact(tx, {
      entityType: "ooo_oos",
      entityId: row.id,
      envelope: input.envelope,
      payload: {
        kind: row.kind,
        space_id: row.space_id,
        period: { from: row.from_at.toISOString(), to: row.to_at.toISOString() },
        reason: row.reason,
      },
    });
    await this.#publishBlock(tx, row, input.envelope, fact.businessDate, "ooo.closed");
    const occupancy = occupancies[0];
    if (occupancy) {
      await this.#publishOccupancy(tx, row, input.envelope, fact.businessDate, "occupancy.released", occupancy);
    }
    return toBlock(row);
  }

  async listActive(tx: Tx, propertyNode: string): Promise<readonly OperationalBlock[]> {
    requireUuid("propertyNode", propertyNode);
    const rows = await tx.unsafe<BlockRow[]>(`
      SELECT ${BLOCK_COLUMNS}
      FROM ooo_oos AS block
      JOIN space ON space.id = block.space_id AND space.tenant_id = block.tenant_id
      WHERE block.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND space.property_node = $1::uuid
        AND NOT isempty(block.period)
        AND upper(block.period) > transaction_timestamp()
      ORDER BY lower(block.period), upper(block.period), block.kind, block.space_id, block.id
    `, [propertyNode]);
    return rows.map(toBlock);
  }

  async #publishBlock(
    tx: Tx,
    row: BlockRow,
    envelope: AuditEnvelope,
    businessDate: string,
    eventType: "ooo.opened" | "ooo.closed",
  ): Promise<void> {
    await this.#events.publish(tx, {
      tenantId: row.tenant_id,
      propertyNode: row.property_node,
      businessDate,
      aggregateType: "ooo_oos",
      aggregateId: row.id,
      eventType,
      actorId: envelope.actorId,
      correlationId: envelope.requestId,
      payload: {
        block_id: row.id,
        kind: row.kind,
        space_id: row.space_id,
        period: { from: row.from_at.toISOString(), to: row.to_at.toISOString() },
        reason: row.reason,
      },
    });
  }

  async #publishOccupancy(
    tx: Tx,
    row: BlockRow,
    envelope: AuditEnvelope,
    businessDate: string,
    eventType: "occupancy.recorded" | "occupancy.released",
    occupancy: OccupancyRow,
  ): Promise<void> {
    await this.#events.publish(tx, {
      tenantId: row.tenant_id,
      propertyNode: row.property_node,
      businessDate,
      aggregateType: "space_occupancy",
      aggregateId: occupancy.id,
      eventType,
      actorId: envelope.actorId,
      correlationId: envelope.requestId,
      payload: {
        occupancy_id: occupancy.id,
        block_id: row.id,
        slot_kind: "ooo",
        space_id: occupancy.space_id,
        period: occupancy.period,
        claim: occupancy.claim,
        exclusive: occupancy.exclusive,
      },
    });
  }
}
