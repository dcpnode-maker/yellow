import type { AuditEnvelope, EventBus, Tx } from "../../kernel";
import { recordFact } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const PROFILE_KEY = /^[a-z][a-z0-9._-]{0,63}$/;
const SMALLINT_MAX = 32_767;
const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

export type ClaimMode = "exclusive" | "positional";

export interface UnitType {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly code: string;
  readonly name: string;
  readonly profileKey: string;
  readonly baseOccupancy: number;
  readonly maxOccupancy: number;
  readonly attrs: Readonly<Record<string, unknown>>;
  readonly sortOrder: number;
}

export interface Space {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly code: string;
  readonly profileKey: string;
  readonly capacity: number;
  readonly maxOccupancy: number | null;
  readonly floor: string | null;
  readonly areaSqm: string | null;
  readonly genderPolicy: "any" | "female" | "male" | null;
  readonly attrs: Readonly<Record<string, unknown>>;
  readonly status: string;
}

export interface SellableSpaceClaim {
  readonly spaceId: string;
  readonly code: string;
  readonly claimMode: ClaimMode;
}

export interface SellableUnit {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly unitTypeId: string;
  readonly unitTypeCode: string;
  readonly name: string;
  readonly status: string;
  readonly spaces: readonly SellableSpaceClaim[];
}

export interface CreateUnitTypeInput {
  readonly code: string;
  readonly name: string;
  readonly profileKey: string;
  readonly baseOccupancy?: number;
  readonly maxOccupancy?: number;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly sortOrder?: number;
  readonly envelope: AuditEnvelope;
}

export interface CreateSpaceInput {
  readonly code: string;
  readonly profileKey: string;
  readonly capacity?: number;
  readonly maxOccupancy?: number | null;
  readonly floor?: string | null;
  readonly areaSqm?: number | null;
  readonly genderPolicy?: "any" | "female" | "male" | null;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly envelope: AuditEnvelope;
}

export interface CreateSellableUnitInput {
  readonly unitTypeId: string;
  readonly name: string;
  readonly spaces: readonly {
    readonly spaceId: string;
    readonly claimMode: ClaimMode;
  }[];
  readonly envelope: AuditEnvelope;
}

interface UnitTypeRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly property_node: string;
  readonly code: string;
  readonly name: string;
  readonly profile_key: string;
  readonly base_occupancy: number;
  readonly max_occupancy: number;
  readonly attrs: Record<string, unknown>;
  readonly sort_order: number;
}

interface SpaceRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly property_node: string;
  readonly code: string;
  readonly profile_key: string;
  readonly capacity: number;
  readonly max_occupancy: number | null;
  readonly floor: string | null;
  readonly area_sqm: string | null;
  readonly gender_policy: "any" | "female" | "male" | null;
  readonly attrs: Record<string, unknown>;
  readonly status: string;
}

interface SellableUnitRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly property_node: string;
  readonly unit_type_id: string;
  readonly unit_type_code: string;
  readonly name: string;
  readonly status: string;
  readonly sort_order: number;
}

interface SellableClaimRow {
  readonly sellable_unit_id: string;
  readonly space_id: string;
  readonly code: string;
  readonly claim_mode: ClaimMode;
}

export class InventoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryValidationError";
  }
}

export class InventoryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryConflictError";
  }
}

export class InventoryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryNotFoundError";
  }
}

function requireUuid(name: string, value: string): void {
  if (!UUID.test(value)) throw new InventoryValidationError(`${name} must be a UUID`);
}

function requireCode(name: string, value: string): void {
  if (value !== value.trim() || !CODE.test(value)) {
    throw new InventoryValidationError(`${name} must be a trimmed stable identifier`);
  }
}

function requireProfileKey(value: string): void {
  if (value !== value.trim() || !PROFILE_KEY.test(value)) {
    throw new InventoryValidationError("profileKey must be a trimmed lowercase stable identifier");
  }
}

function requireName(value: string): void {
  if (value !== value.trim() || value.length === 0 || value.length > 200) {
    throw new InventoryValidationError("name must be trimmed and contain 1 to 200 characters");
  }
}

function requireSmallPositive(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > SMALLINT_MAX) {
    throw new InventoryValidationError(`${name} must be an integer between 1 and ${SMALLINT_MAX}`);
  }
}

function requireSortOrder(value: number): void {
  if (!Number.isInteger(value) || value < INT32_MIN || value > INT32_MAX) {
    throw new InventoryValidationError("sortOrder must be a signed 32-bit integer");
  }
}

function normalizeAttrs(value: Readonly<Record<string, unknown>> | undefined): Record<string, unknown> {
  const source = value ?? {};
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    throw new InventoryValidationError("attrs must be a JSON object");
  }
  try {
    const encoded = JSON.stringify(source);
    const decoded: unknown = JSON.parse(encoded);
    if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
      throw new InventoryValidationError("attrs must be a JSON object");
    }
    return decoded as Record<string, unknown>;
  } catch (error) {
    if (error instanceof InventoryValidationError) throw error;
    throw new InventoryValidationError("attrs must be JSON serializable");
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "errno" in error && error.errno === "23505";
}

function toUnitType(row: UnitTypeRow): UnitType {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    propertyNode: row.property_node,
    code: row.code,
    name: row.name,
    profileKey: row.profile_key,
    baseOccupancy: row.base_occupancy,
    maxOccupancy: row.max_occupancy,
    attrs: row.attrs,
    sortOrder: row.sort_order,
  };
}

function toSpace(row: SpaceRow): Space {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    propertyNode: row.property_node,
    code: row.code,
    profileKey: row.profile_key,
    capacity: row.capacity,
    maxOccupancy: row.max_occupancy,
    floor: row.floor,
    areaSqm: row.area_sqm,
    genderPolicy: row.gender_policy,
    attrs: row.attrs,
    status: row.status,
  };
}

async function requireProperty(tx: Tx, envelope: AuditEnvelope): Promise<void> {
  const rows = await tx<Array<{ id: string }>>`
    SELECT id
    FROM org_node
    WHERE id = ${envelope.propertyNode}::uuid
      AND tenant_id = ${envelope.tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND kind = 'property'
  `;
  if (!rows[0]) throw new InventoryNotFoundError("Property was not found in the active tenant");
}

function requireOperation(envelope: AuditEnvelope, expected: string): void {
  if (envelope.operation !== expected) {
    throw new InventoryValidationError(`audit operation must be ${expected}`);
  }
}

async function unitTypeRows(tx: Tx, propertyNode: string, id?: string): Promise<UnitTypeRow[]> {
  requireUuid("propertyNode", propertyNode);
  if (id !== undefined) requireUuid("unitTypeId", id);
  return id === undefined
    ? tx<UnitTypeRow[]>`
        SELECT id, tenant_id, property_node, code, name, profile_key,
               base_occupancy, max_occupancy, attrs, sort_order
        FROM unit_type
        WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property_node = ${propertyNode}::uuid
        ORDER BY sort_order, code, id
      `
    : tx<UnitTypeRow[]>`
        SELECT id, tenant_id, property_node, code, name, profile_key,
               base_occupancy, max_occupancy, attrs, sort_order
        FROM unit_type
        WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property_node = ${propertyNode}::uuid
          AND id = ${id}::uuid
      `;
}

async function spaceRows(tx: Tx, propertyNode: string, id?: string): Promise<SpaceRow[]> {
  requireUuid("propertyNode", propertyNode);
  if (id !== undefined) requireUuid("spaceId", id);
  return id === undefined
    ? tx<SpaceRow[]>`
        SELECT id, tenant_id, property_node, code, profile_key, capacity,
               max_occupancy, floor, area_sqm::text, gender_policy, attrs, status
        FROM space
        WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property_node = ${propertyNode}::uuid
        ORDER BY code, id
      `
    : tx<SpaceRow[]>`
        SELECT id, tenant_id, property_node, code, profile_key, capacity,
               max_occupancy, floor, area_sqm::text, gender_policy, attrs, status
        FROM space
        WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property_node = ${propertyNode}::uuid
          AND id = ${id}::uuid
      `;
}

async function attachClaims(tx: Tx, rows: readonly SellableUnitRow[]): Promise<readonly SellableUnit[]> {
  if (rows.length === 0) return [];
  const ids = rows.map(({ id }) => id);
  const claims = await tx<SellableClaimRow[]>`
    SELECT sus.sellable_unit_id, sus.space_id, space.code, sus.claim_mode
    FROM sellable_unit_space AS sus
    JOIN space ON space.id = sus.space_id AND space.tenant_id = sus.tenant_id
    WHERE sus.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND sus.sellable_unit_id IN ${tx(ids)}
    ORDER BY sus.sellable_unit_id, space.code, sus.space_id
  `;
  const byUnit = new Map<string, SellableSpaceClaim[]>();
  for (const claim of claims) {
    const existing = byUnit.get(claim.sellable_unit_id) ?? [];
    existing.push({ spaceId: claim.space_id, code: claim.code, claimMode: claim.claim_mode });
    byUnit.set(claim.sellable_unit_id, existing);
  }
  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    propertyNode: row.property_node,
    unitTypeId: row.unit_type_id,
    unitTypeCode: row.unit_type_code,
    name: row.name,
    status: row.status,
    spaces: byUnit.get(row.id) ?? [],
  }));
}

export class InventoryService {
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  async createUnitType(tx: Tx, input: CreateUnitTypeInput): Promise<UnitType> {
    requireOperation(input.envelope, "unit_type.created");
    requireCode("code", input.code);
    requireName(input.name);
    requireProfileKey(input.profileKey);
    const baseOccupancy = input.baseOccupancy ?? 2;
    const maxOccupancy = input.maxOccupancy ?? 2;
    requireSmallPositive("baseOccupancy", baseOccupancy);
    requireSmallPositive("maxOccupancy", maxOccupancy);
    if (baseOccupancy > maxOccupancy) {
      throw new InventoryValidationError("baseOccupancy cannot exceed maxOccupancy");
    }
    const sortOrder = input.sortOrder ?? 0;
    requireSortOrder(sortOrder);
    const attrs = normalizeAttrs(input.attrs);
    await requireProperty(tx, input.envelope);

    let rows: UnitTypeRow[];
    try {
      rows = await tx<UnitTypeRow[]>`
        INSERT INTO unit_type (
          tenant_id, property_node, code, name, profile_key,
          base_occupancy, max_occupancy, attrs, sort_order
        )
        VALUES (
          ${input.envelope.tenantId}::uuid, ${input.envelope.propertyNode}::uuid,
          ${input.code}, ${input.name}, ${input.profileKey}, ${baseOccupancy},
          ${maxOccupancy}, ${JSON.stringify(attrs)}::text::jsonb, ${sortOrder}
        )
        RETURNING id, tenant_id, property_node, code, name, profile_key,
                  base_occupancy, max_occupancy, attrs, sort_order
      `;
    } catch (error) {
      if (isUniqueViolation(error)) throw new InventoryConflictError(`Unit type code ${input.code} already exists`);
      throw error;
    }
    const row = rows[0];
    if (!row) throw new Error("PostgreSQL did not return the created unit type");
    const fact = await recordFact(tx, {
      entityType: "unit_type",
      entityId: row.id,
      envelope: input.envelope,
      payload: { code: row.code, property_node: row.property_node },
    });
    await this.#events.publish(tx, {
      tenantId: row.tenant_id,
      propertyNode: row.property_node,
      businessDate: fact.businessDate,
      aggregateType: "unit_type",
      aggregateId: row.id,
      eventType: "unit_type.created",
      actorId: input.envelope.actorId,
      correlationId: input.envelope.requestId,
      payload: { unit_type_id: row.id, code: row.code },
    });
    return toUnitType(row);
  }

  async createSpace(tx: Tx, input: CreateSpaceInput): Promise<Space> {
    requireOperation(input.envelope, "space.created");
    requireCode("code", input.code);
    requireProfileKey(input.profileKey);
    const capacity = input.capacity ?? 1;
    requireSmallPositive("capacity", capacity);
    if (input.maxOccupancy !== undefined && input.maxOccupancy !== null) {
      requireSmallPositive("maxOccupancy", input.maxOccupancy);
    }
    if (input.floor !== undefined && input.floor !== null &&
        (input.floor !== input.floor.trim() || input.floor.length === 0 || input.floor.length > 64)) {
      throw new InventoryValidationError("floor must be null or a trimmed value up to 64 characters");
    }
    if (input.areaSqm !== undefined && input.areaSqm !== null &&
        (!Number.isFinite(input.areaSqm) || input.areaSqm <= 0 || input.areaSqm >= 1_000_000)) {
      throw new InventoryValidationError("areaSqm must be a positive finite value below 1000000");
    }
    if (input.genderPolicy !== undefined && input.genderPolicy !== null &&
        !(["any", "female", "male"] as const).includes(input.genderPolicy)) {
      throw new InventoryValidationError("genderPolicy must be any, female, male, or null");
    }
    const attrs = normalizeAttrs(input.attrs);
    await requireProperty(tx, input.envelope);

    let rows: SpaceRow[];
    try {
      rows = await tx<SpaceRow[]>`
        INSERT INTO space (
          tenant_id, property_node, code, profile_key, capacity, max_occupancy,
          floor, area_sqm, gender_policy, attrs
        )
        VALUES (
          ${input.envelope.tenantId}::uuid, ${input.envelope.propertyNode}::uuid,
          ${input.code}, ${input.profileKey}, ${capacity}, ${input.maxOccupancy ?? null},
          ${input.floor ?? null}, ${input.areaSqm ?? null}, ${input.genderPolicy ?? null},
          ${JSON.stringify(attrs)}::text::jsonb
        )
        RETURNING id, tenant_id, property_node, code, profile_key, capacity,
                  max_occupancy, floor, area_sqm::text, gender_policy, attrs, status
      `;
    } catch (error) {
      if (isUniqueViolation(error)) throw new InventoryConflictError(`Space code ${input.code} already exists`);
      throw error;
    }
    const row = rows[0];
    if (!row) throw new Error("PostgreSQL did not return the created space");
    const fact = await recordFact(tx, {
      entityType: "space",
      entityId: row.id,
      envelope: input.envelope,
      payload: { code: row.code, property_node: row.property_node },
    });
    await this.#events.publish(tx, {
      tenantId: row.tenant_id,
      propertyNode: row.property_node,
      businessDate: fact.businessDate,
      aggregateType: "space",
      aggregateId: row.id,
      eventType: "space.created",
      actorId: input.envelope.actorId,
      correlationId: input.envelope.requestId,
      payload: { space_id: row.id, code: row.code, capacity: row.capacity },
    });
    return toSpace(row);
  }

  async createSellableUnit(tx: Tx, input: CreateSellableUnitInput): Promise<SellableUnit> {
    requireOperation(input.envelope, "sellable_unit.created");
    requireUuid("unitTypeId", input.unitTypeId);
    requireName(input.name);
    if (input.spaces.length === 0) {
      throw new InventoryValidationError("sellable unit requires at least one space claim");
    }
    const seen = new Set<string>();
    for (const claim of input.spaces) {
      requireUuid("spaceId", claim.spaceId);
      if (claim.claimMode !== "exclusive" && claim.claimMode !== "positional") {
        throw new InventoryValidationError("claimMode must be exclusive or positional");
      }
      if (seen.has(claim.spaceId)) throw new InventoryValidationError("space claims must be distinct");
      seen.add(claim.spaceId);
    }
    await requireProperty(tx, input.envelope);
    const unitTypes = await unitTypeRows(tx, input.envelope.propertyNode, input.unitTypeId);
    const unitType = unitTypes[0];
    if (!unitType) throw new InventoryNotFoundError("Unit type was not found in the active property");
    const spaceIds = input.spaces.map(({ spaceId }) => spaceId);
    const spaces = await tx<Array<{ id: string }>>`
      SELECT id
      FROM space
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = ${input.envelope.propertyNode}::uuid
        AND id IN ${tx(spaceIds)}
      ORDER BY id
    `;
    if (spaces.length !== spaceIds.length) {
      throw new InventoryNotFoundError("Every space must exist in the active property");
    }

    const rows = await tx<SellableUnitRow[]>`
      INSERT INTO sellable_unit (tenant_id, unit_type_id, name)
      VALUES (${input.envelope.tenantId}::uuid, ${unitType.id}::uuid, ${input.name})
      RETURNING id, tenant_id, ${unitType.property_node}::uuid AS property_node,
                unit_type_id, ${unitType.code}::text AS unit_type_code, name, status,
                ${unitType.sort_order}::int AS sort_order
    `;
    const row = rows[0];
    if (!row) throw new Error("PostgreSQL did not return the created sellable unit");
    for (const claim of input.spaces) {
      await tx`
        INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
        VALUES (${input.envelope.tenantId}::uuid, ${row.id}::uuid, ${claim.spaceId}::uuid, ${claim.claimMode})
      `;
    }
    const fact = await recordFact(tx, {
      entityType: "sellable_unit",
      entityId: row.id,
      envelope: input.envelope,
      payload: {
        unit_type_id: row.unit_type_id,
        space_claims: input.spaces.map(({ spaceId, claimMode }) => ({ space_id: spaceId, claim_mode: claimMode })),
      },
    });
    await this.#events.publish(tx, {
      tenantId: row.tenant_id,
      propertyNode: row.property_node,
      businessDate: fact.businessDate,
      aggregateType: "sellable_unit",
      aggregateId: row.id,
      eventType: "sellable_unit.created",
      actorId: input.envelope.actorId,
      correlationId: input.envelope.requestId,
      payload: {
        sellable_unit_id: row.id,
        unit_type_id: row.unit_type_id,
        space_claims: input.spaces.map(({ spaceId, claimMode }) => ({ space_id: spaceId, claim_mode: claimMode })),
      },
    });
    const [created] = await attachClaims(tx, [row]);
    if (!created) throw new Error("Created sellable unit could not be read back");
    return created;
  }

  async listUnitTypes(tx: Tx, propertyNode: string): Promise<readonly UnitType[]> {
    return (await unitTypeRows(tx, propertyNode)).map(toUnitType);
  }

  async getUnitType(tx: Tx, propertyNode: string, unitTypeId: string): Promise<UnitType> {
    const row = (await unitTypeRows(tx, propertyNode, unitTypeId))[0];
    if (!row) throw new InventoryNotFoundError("Unit type was not found in the active property");
    return toUnitType(row);
  }

  async listSpaces(tx: Tx, propertyNode: string): Promise<readonly Space[]> {
    return (await spaceRows(tx, propertyNode)).map(toSpace);
  }

  async getSpace(tx: Tx, propertyNode: string, spaceId: string): Promise<Space> {
    const row = (await spaceRows(tx, propertyNode, spaceId))[0];
    if (!row) throw new InventoryNotFoundError("Space was not found in the active property");
    return toSpace(row);
  }

  async listSellableUnits(tx: Tx, propertyNode: string): Promise<readonly SellableUnit[]> {
    requireUuid("propertyNode", propertyNode);
    const rows = await tx<SellableUnitRow[]>`
      SELECT su.id, su.tenant_id, ut.property_node, su.unit_type_id,
             ut.code AS unit_type_code, su.name, su.status, ut.sort_order
      FROM sellable_unit AS su
      JOIN unit_type AS ut ON ut.id = su.unit_type_id AND ut.tenant_id = su.tenant_id
      WHERE su.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND ut.property_node = ${propertyNode}::uuid
      ORDER BY ut.sort_order, ut.code, su.name, su.id
    `;
    return attachClaims(tx, rows);
  }

  async getSellableUnit(tx: Tx, propertyNode: string, sellableUnitId: string): Promise<SellableUnit> {
    requireUuid("propertyNode", propertyNode);
    requireUuid("sellableUnitId", sellableUnitId);
    const rows = await tx<SellableUnitRow[]>`
      SELECT su.id, su.tenant_id, ut.property_node, su.unit_type_id,
             ut.code AS unit_type_code, su.name, su.status, ut.sort_order
      FROM sellable_unit AS su
      JOIN unit_type AS ut ON ut.id = su.unit_type_id AND ut.tenant_id = su.tenant_id
      WHERE su.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND ut.property_node = ${propertyNode}::uuid
        AND su.id = ${sellableUnitId}::uuid
    `;
    const unit = (await attachClaims(tx, rows))[0];
    if (!unit) throw new InventoryNotFoundError("Sellable unit was not found in the active property");
    return unit;
  }
}
