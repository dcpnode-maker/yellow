import { SQL, type ReservedSQL } from "bun";

import { hashLocalPassword, verifyLocalPassword } from "../src/contexts/identity";
import { InventoryService, type SellableUnit, type Space, type UnitType } from "../src/contexts/inventory";
import { createAuditEnvelope, Database, PostgresEventBus } from "../src/kernel";
import { PROPERTY_NAME, SEED_PROPERTY, SEED_TENANT, TENANT_NAME, URL_NAMESPACE_UUID } from "./seed";
import { uuidV5 } from "./lib/uuid-v5";

export const REVIEW_EMAIL = "operator@yellow.local";
export const REVIEW_DISPLAY_NAME = "Yellow Review Operator";
export const REVIEW_ROLE_NAME = "Local Availability Reviewer";
export const REVIEW_PERMISSION = "inventory.availability:read";
export const REVIEW_PERMISSIONS = Object.freeze([
  { code: REVIEW_PERMISSION, description: "Read tenant-scoped truth availability" },
  { code: "inventory.configuration:read", description: "Read tenant-scoped inventory configuration" },
  { code: "inventory.configuration:write", description: "Create tenant-scoped inventory configuration" },
  { code: "inventory.restriction:read", description: "Read tenant-scoped restriction configuration" },
  { code: "inventory.restriction:write", description: "Create tenant-scoped restriction configuration" },
]);
const REVIEW_USER_NAME = `${TENANT_NAME}/review-user/${REVIEW_EMAIL}`;
const REVIEW_ROLE_NAME_UUID = `${TENANT_NAME}/review-role/availability`;

const ROOM_TYPES = Object.freeze([
  { code: "STD", name: "Standard Room", baseOccupancy: 2, maxOccupancy: 2, sortOrder: 10 },
  { code: "DLX", name: "Deluxe Room", baseOccupancy: 2, maxOccupancy: 3, sortOrder: 20 },
]);

const ROOMS = Object.freeze([
  { code: "101", unitTypeCode: "STD", name: "Room 101", floor: "1", areaSqm: 24 },
  { code: "102", unitTypeCode: "STD", name: "Room 102", floor: "1", areaSqm: 24 },
  { code: "103", unitTypeCode: "STD", name: "Room 103", floor: "1", areaSqm: 26 },
  { code: "201", unitTypeCode: "DLX", name: "Room 201", floor: "2", areaSqm: 36 },
  { code: "202", unitTypeCode: "DLX", name: "Room 202", floor: "2", areaSqm: 38 },
]);

interface IdentityRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly email: string;
  readonly display_name: string;
  readonly auth: unknown;
  readonly status: string;
}

interface RoleRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
}

export interface ReviewSeedOptions {
  readonly databaseUrl: string;
  readonly password: string;
  readonly logger?: (line: string) => void;
}

export interface ReviewSeedResult {
  readonly tenant: string;
  readonly property: string;
  readonly email: string;
  readonly userId: string;
  readonly roleId: string;
  readonly unitTypes: { created: number; existing: number };
  readonly rooms: { created: number; existing: number };
  readonly sellableUnits: { created: number; existing: number };
}

async function withIdentityTransaction(pool: SQL, operation: (connection: ReservedSQL) => Promise<void>): Promise<void> {
  const connection = await pool.reserve();
  let began = false;
  try {
    await connection.unsafe("BEGIN");
    began = true;
    await operation(connection);
    await connection.unsafe("COMMIT");
    began = false;
  } catch (error) {
    if (began) {
      try { await connection.unsafe("ROLLBACK"); } catch { /* preserve the original failure */ }
    }
    throw error;
  } finally {
    connection.release();
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function exact(value: unknown, expected: unknown, label: string): void {
  if (stableJson(value) !== stableJson(expected)) throw new Error(`${label} collides with non-canonical local-review data`);
}

async function canonicalIds(): Promise<{ userId: string; roleId: string }> {
  const derivedTenant = await uuidV5(URL_NAMESPACE_UUID, TENANT_NAME);
  const derivedProperty = await uuidV5(derivedTenant, PROPERTY_NAME);
  if (derivedTenant !== SEED_TENANT.id || derivedProperty !== SEED_PROPERTY.id) {
    throw new Error("Canonical launch-seed identities did not derive exactly");
  }
  return {
    userId: await uuidV5(SEED_TENANT.id, REVIEW_USER_NAME),
    roleId: await uuidV5(SEED_TENANT.id, REVIEW_ROLE_NAME_UUID),
  };
}

async function provisionIdentity(connection: ReservedSQL, password: string, userId: string, roleId: string): Promise<void> {
  const base = await connection<Array<{ tenant_ok: boolean; property_ok: boolean }>>`
    SELECT
      EXISTS (
        SELECT 1 FROM tenant
        WHERE id = ${SEED_TENANT.id}::uuid AND slug = ${SEED_TENANT.slug}
          AND name = ${SEED_TENANT.name} AND tier = ${SEED_TENANT.tier}
          AND residency = ${SEED_TENANT.residency} AND status = ${SEED_TENANT.status}
      ) AS tenant_ok,
      EXISTS (
        SELECT 1 FROM org_node
        WHERE id = ${SEED_PROPERTY.id}::uuid AND tenant_id = ${SEED_TENANT.id}::uuid
          AND path = ${SEED_PROPERTY.path}::ltree AND kind = 'property'
          AND name = ${SEED_PROPERTY.name} AND timezone = ${SEED_PROPERTY.timezone}
          AND currency = ${SEED_PROPERTY.currency}
      ) AS property_ok
  `;
  if (!base[0]?.tenant_ok || !base[0]?.property_ok) {
    throw new Error("Canonical launch seed is absent; run bun run db:seed first");
  }

  for (const permission of REVIEW_PERMISSIONS) {
    const permissions = await connection<Array<{ code: string; description: string }>>`
      SELECT code, description FROM permission WHERE code = ${permission.code}
    `;
    if (permissions.length === 0) {
      await connection`INSERT INTO permission (code, description) VALUES (${permission.code}, ${permission.description})`;
    } else {
      exact(permissions[0], permission, `Review permission ${permission.code}`);
    }
  }

  const users = await connection<IdentityRow[]>`
    SELECT id, tenant_id, email, display_name, auth, status
    FROM app_user
    WHERE id = ${userId}::uuid
       OR (tenant_id = ${SEED_TENANT.id}::uuid AND lower(email) = lower(${REVIEW_EMAIL}))
    ORDER BY id
  `;
  if (users.length === 0) {
    const auth = await hashLocalPassword(password);
    await connection`
      INSERT INTO app_user (id, tenant_id, email, display_name, auth, status)
      VALUES (${userId}::uuid, ${SEED_TENANT.id}::uuid, ${REVIEW_EMAIL}, ${REVIEW_DISPLAY_NAME},
              ${JSON.stringify(auth)}::text::jsonb, 'active')
    `;
  } else {
    const user = users[0];
    if (users.length !== 1 || !user || user.id !== userId || user.tenant_id !== SEED_TENANT.id ||
        user.email !== REVIEW_EMAIL || user.display_name !== REVIEW_DISPLAY_NAME || user.status !== "active" ||
        !(await verifyLocalPassword(password, user.auth))) {
      throw new Error("Review user collides with non-canonical local-review data");
    }
  }

  const roles = await connection<RoleRow[]>`
    SELECT id, tenant_id, name FROM role
    WHERE id = ${roleId}::uuid
       OR (tenant_id = ${SEED_TENANT.id}::uuid AND name = ${REVIEW_ROLE_NAME})
    ORDER BY id
  `;
  if (roles.length === 0) {
    await connection`
      INSERT INTO role (id, tenant_id, name)
      VALUES (${roleId}::uuid, ${SEED_TENANT.id}::uuid, ${REVIEW_ROLE_NAME})
    `;
  } else {
    exact(roles[0], { id: roleId, tenant_id: SEED_TENANT.id, name: REVIEW_ROLE_NAME }, "Review role");
    if (roles.length !== 1) throw new Error("Review role collides with non-canonical local-review data");
  }

  for (const permission of REVIEW_PERMISSIONS) {
    const rolePermissions = await connection<Array<{ role_id: string; permission_code: string }>>`
      SELECT role_id, permission_code FROM role_permission
      WHERE role_id = ${roleId}::uuid AND permission_code = ${permission.code}
    `;
    if (rolePermissions.length === 0) {
      await connection`
        INSERT INTO role_permission (role_id, permission_code)
        VALUES (${roleId}::uuid, ${permission.code})
      `;
    } else if (rolePermissions.length !== 1) {
      throw new Error(`Review role permission ${permission.code} is not canonical`);
    }
  }

  const grants = await connection<Array<{ tenant_id: string; user_id: string; role_id: string; scope_node: string }>>`
    SELECT tenant_id, user_id, role_id, scope_node FROM user_role
    WHERE user_id = ${userId}::uuid AND role_id = ${roleId}::uuid AND scope_node = ${SEED_PROPERTY.id}::uuid
  `;
  if (grants.length === 0) {
    await connection`
      INSERT INTO user_role (tenant_id, user_id, role_id, scope_node)
      VALUES (${SEED_TENANT.id}::uuid, ${userId}::uuid, ${roleId}::uuid, ${SEED_PROPERTY.id}::uuid)
    `;
  } else {
    exact(grants[0], { tenant_id: SEED_TENANT.id, user_id: userId, role_id: roleId, scope_node: SEED_PROPERTY.id }, "Review role grant");
    if (grants.length !== 1) throw new Error("Review role grant is not canonical");
  }
}

function unitTypeShape(item: UnitType, spec: typeof ROOM_TYPES[number]): void {
  exact({
    tenantId: item.tenantId, propertyNode: item.propertyNode, code: item.code, name: item.name,
    profileKey: item.profileKey, baseOccupancy: item.baseOccupancy, maxOccupancy: item.maxOccupancy,
    attrs: item.attrs, sortOrder: item.sortOrder,
  }, {
    tenantId: SEED_TENANT.id, propertyNode: SEED_PROPERTY.id, code: spec.code, name: spec.name,
    profileKey: "hotel", baseOccupancy: spec.baseOccupancy, maxOccupancy: spec.maxOccupancy,
    attrs: { source: "local-review" }, sortOrder: spec.sortOrder,
  }, `Room type ${spec.code}`);
}

function roomShape(item: Space, spec: typeof ROOMS[number]): void {
  exact({
    tenantId: item.tenantId, propertyNode: item.propertyNode, code: item.code,
    profileKey: item.profileKey, capacity: item.capacity, maxOccupancy: item.maxOccupancy,
    floor: item.floor, areaSqm: item.areaSqm, genderPolicy: item.genderPolicy,
    attrs: item.attrs, status: item.status,
  }, {
    tenantId: SEED_TENANT.id, propertyNode: SEED_PROPERTY.id, code: spec.code,
    profileKey: "hotel", capacity: 1, maxOccupancy: null, floor: spec.floor,
    areaSqm: spec.areaSqm.toFixed(2), genderPolicy: "any",
    attrs: { source: "local-review" }, status: "active",
  }, `Room ${spec.code}`);
}

function sellableShape(item: SellableUnit, spec: typeof ROOMS[number], unitTypeId: string, spaceId: string): void {
  exact({
    tenantId: item.tenantId, propertyNode: item.propertyNode, unitTypeId: item.unitTypeId,
    unitTypeCode: item.unitTypeCode, name: item.name, status: item.status, spaces: item.spaces,
  }, {
    tenantId: SEED_TENANT.id, propertyNode: SEED_PROPERTY.id, unitTypeId,
    unitTypeCode: spec.unitTypeCode, name: spec.name, status: "active",
    spaces: [{ spaceId, code: spec.code, claimMode: "exclusive" }],
  }, `Sellable unit ${spec.name}`);
}

export async function runReviewSeed(options: ReviewSeedOptions): Promise<ReviewSeedResult> {
  if (!options.databaseUrl) throw new Error("databaseUrl is required");
  if (!options.password) throw new Error("password is required");
  const logger = options.logger ?? console.log;
  const { userId, roleId } = await canonicalIds();
  const identityPool = new SQL(options.databaseUrl, { max: 2 });
  const eventPool = new SQL(options.databaseUrl, { max: 4 });
  const database = Database.connect(options.databaseUrl, { maxConnections: 6 });

  try {
    await withIdentityTransaction(identityPool, (tx) => provisionIdentity(tx, options.password, userId, roleId));
    const inventory = new InventoryService(new PostgresEventBus(eventPool));
    const counts = {
      unitTypes: { created: 0, existing: 0 },
      rooms: { created: 0, existing: 0 },
      sellableUnits: { created: 0, existing: 0 },
    };

    const unitTypes = new Map<string, UnitType>();
    await database.withTenantTransaction(SEED_TENANT.id, async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended('yellow.local.review.seed', 0))`;
      const existing = await inventory.listUnitTypes(tx, SEED_PROPERTY.id);
      for (const spec of ROOM_TYPES) {
        const matches = existing.filter(({ code }) => code === spec.code);
        let item = matches[0];
        if (matches.length > 1) throw new Error(`Room type ${spec.code} is duplicated`);
        if (item) {
          unitTypeShape(item, spec);
          counts.unitTypes.existing += 1;
        } else {
          item = await inventory.createUnitType(tx, {
            code: spec.code, name: spec.name, profileKey: "hotel",
            baseOccupancy: spec.baseOccupancy, maxOccupancy: spec.maxOccupancy,
            attrs: { source: "local-review" }, sortOrder: spec.sortOrder,
            envelope: createAuditEnvelope({ actorId: userId, tenantId: SEED_TENANT.id,
              propertyNode: SEED_PROPERTY.id, requestId: crypto.randomUUID(), operation: "unit_type.created" }),
          });
          counts.unitTypes.created += 1;
        }
        unitTypes.set(spec.code, item);
      }
    });

    const spaces = new Map<string, Space>();
    await database.withTenantTransaction(SEED_TENANT.id, async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended('yellow.local.review.seed', 0))`;
      const existing = await inventory.listSpaces(tx, SEED_PROPERTY.id);
      for (const spec of ROOMS) {
        const matches = existing.filter(({ code }) => code === spec.code);
        let item = matches[0];
        if (matches.length > 1) throw new Error(`Room ${spec.code} is duplicated`);
        if (item) {
          roomShape(item, spec);
          counts.rooms.existing += 1;
        } else {
          item = await inventory.createSpace(tx, {
            code: spec.code, profileKey: "hotel", capacity: 1, maxOccupancy: null,
            floor: spec.floor, areaSqm: spec.areaSqm, genderPolicy: "any",
            attrs: { source: "local-review" },
            envelope: createAuditEnvelope({ actorId: userId, tenantId: SEED_TENANT.id,
              propertyNode: SEED_PROPERTY.id, requestId: crypto.randomUUID(), operation: "space.created" }),
          });
          counts.rooms.created += 1;
        }
        spaces.set(spec.code, item);
      }
    });

    await database.withTenantTransaction(SEED_TENANT.id, async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended('yellow.local.review.seed', 0))`;
      const existing = await inventory.listSellableUnits(tx, SEED_PROPERTY.id);
      for (const spec of ROOMS) {
        const unitType = unitTypes.get(spec.unitTypeCode);
        const space = spaces.get(spec.code);
        if (!unitType || !space) throw new Error(`Review inventory dependency is missing for room ${spec.code}`);
        const matches = existing.filter(({ name }) => name === spec.name);
        let item = matches[0];
        if (matches.length > 1) throw new Error(`Sellable unit ${spec.name} is duplicated`);
        if (item) {
          sellableShape(item, spec, unitType.id, space.id);
          counts.sellableUnits.existing += 1;
        } else {
          item = await inventory.createSellableUnit(tx, {
            unitTypeId: unitType.id, name: spec.name,
            spaces: [{ spaceId: space.id, claimMode: "exclusive" }],
            envelope: createAuditEnvelope({ actorId: userId, tenantId: SEED_TENANT.id,
              propertyNode: SEED_PROPERTY.id, requestId: crypto.randomUUID(), operation: "sellable_unit.created" }),
          });
          counts.sellableUnits.created += 1;
        }
      }
    });

    logger(`review seed: tenant=${SEED_TENANT.slug} property=${SEED_PROPERTY.name}`);
    logger(`review login: ${REVIEW_EMAIL} (password supplied by YELLOW_REVIEW_PASSWORD)`);
    logger(`review inventory: unit_types=${counts.unitTypes.created}/${counts.unitTypes.existing} rooms=${counts.rooms.created}/${counts.rooms.existing} sellable_units=${counts.sellableUnits.created}/${counts.sellableUnits.existing} created/existing`);
    return { tenant: SEED_TENANT.slug, property: SEED_PROPERTY.name, email: REVIEW_EMAIL,
      userId, roleId, ...counts };
  } finally {
    await database.close();
    await eventPool.close();
    await identityPool.close();
  }
}

async function runCli(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const password = process.env.YELLOW_REVIEW_PASSWORD;
  if (!databaseUrl || !password) {
    console.error("DATABASE_URL and YELLOW_REVIEW_PASSWORD are required");
    process.exitCode = 1;
    return;
  }
  try {
    await runReviewSeed({ databaseUrl, password });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(`review seed failed: ${raw.split(password).join("[REDACTED]")}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) await runCli();
