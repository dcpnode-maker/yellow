import { SQL, type ReservedSQL } from "bun";

import { hashLocalPassword, verifyLocalPassword } from "../src/contexts/identity";
import { InventoryService, type SellableUnit, type Space, type UnitType } from "../src/contexts/inventory";
import {
  canonicalRateAuthoringJson,
  compileRateAuthoringCommand,
  RateConfigurationService,
  RateModelService,
  RatePublicationService,
  RateTargetService,
  type CanonicalRateAuthoringCommand,
  type Policy,
  type RatePlan,
  type RatePlanRelease,
} from "../src/contexts/rates";
import {
  ApprovalService,
  createAuditEnvelope,
  Database,
  ExtensionRegistry,
  PostgresEventBus,
  type Tx,
} from "../src/kernel";
import { PROPERTY_NAME, SEED_PROPERTY, SEED_TENANT, TENANT_NAME, URL_NAMESPACE_UUID } from "./seed";
import { uuidV5 } from "./lib/uuid-v5";

export const REVIEW_EMAIL = "operator@yellow.local";
export const REVIEW_DISPLAY_NAME = "Yellow Review Operator";
export const REVIEW_APPROVER_EMAIL = "approver@yellow.local";
export const REVIEW_APPROVER_DISPLAY_NAME = "Yellow Rate Approver";
export const REVIEW_ROLE_NAME = "Local Availability Reviewer";
export const REVIEW_APPROVER_ROLE_NAME = "Local Post-Seal Financial Approver";
export const REVIEW_POST_SEAL_PERMISSION = Object.freeze({
  code: "financials.adjustments:post-seal",
  description: "Post immutable financial adjustments involving sealed business days",
});
export const REVIEW_CASHIER_SUPERVISE_PERMISSION = Object.freeze({
  code: "financials.cashiers:supervise",
  description: "Supervise governed property cashier custody",
});
export const REVIEW_PERMISSION = "inventory.availability:read";
export const REVIEW_PERMISSIONS = Object.freeze([
  { code: "crm.parties:read", description: "Search tenant-scoped Party profiles" },
  { code: "crm.parties:write", description: "Create tenant-scoped Party profiles" },
  { code: "financials.charges:write", description: "Post governed charges to property folios" },
  { code: "financials.adjustments:write", description: "Create governed immutable folio adjustments" },
  { code: "financials.folios:open", description: "Open reservation primary folios" },
  { code: "financials.folios:read", description: "Read property folio statements" },
  { code: "financials.folios:settle", description: "Settle exact-zero property folio windows" },
  { code: "financials.folios:close", description: "Close exact-zero settled property folio windows" },
  { code: "financials.cashiers:read", description: "Read governed property cashier custody" },
  { code: "financials.cashiers:operate", description: "Operate an attributable property cashier session" },
  { code: "financials.transfers:write", description: "Preview and commit governed folio transfers" },
  { code: REVIEW_PERMISSION, description: "Read tenant-scoped truth availability" },
  { code: "inventory.blocks:read", description: "Read tenant-scoped operational blocks" },
  { code: "inventory.blocks:write", description: "Open and close tenant-scoped operational blocks" },
  { code: "inventory.policy:read", description: "Read tenant-scoped inventory policy" },
  { code: "inventory.policy:write", description: "Change tenant-scoped inventory policy" },
  { code: "inventory.configuration:read", description: "Read tenant-scoped inventory configuration" },
  { code: "inventory.configuration:write", description: "Create tenant-scoped inventory configuration" },
  { code: "inventory.holds:read", description: "Read tenant-scoped active cart holds" },
  { code: "inventory.holds:write", description: "Place and release tenant-scoped cart holds" },
  { code: "inventory.offline_leases:read", description: "Read tenant-scoped active offline capacity leases" },
  { code: "inventory.offline_leases:write", description: "Place and release tenant-scoped offline capacity leases" },
  { code: "inventory.restriction:read", description: "Read tenant-scoped restriction configuration" },
  { code: "inventory.restriction:write", description: "Create tenant-scoped restriction configuration" },
  { code: "rates.configuration:read", description: "Read tenant-scoped rate configuration" },
  { code: "rates.configuration:write", description: "Create tenant-scoped rate configuration" },
  { code: "rates.pricing:read", description: "Read tenant-scoped rate pricing" },
  { code: "rates.pricing:write", description: "Create tenant-scoped rate pricing" },
  { code: "reservations.booking:write", description: "Commit tenant-scoped reservations" },
  { code: "reservations.guests:read", description: "Read tenant-scoped reservation guest allocations" },
  { code: "reservations.guests:write", description: "Replace tenant-scoped reservation guest allocations" },
  { code: "reservations.lifecycle:read", description: "Read tenant-scoped reservation lifecycle details" },
  { code: "reservations.lifecycle:write", description: "Modify tenant-scoped reservation lifecycle" },
  { code: "reservations.segments:read", description: "Read tenant-scoped reservation segment history" },
  { code: "reservations.segments:write", description: "Change tenant-scoped reservation segments" },
]);
const REVIEW_USER_NAME = `${TENANT_NAME}/review-user/${REVIEW_EMAIL}`;
const REVIEW_APPROVER_USER_NAME = `${TENANT_NAME}/review-user/${REVIEW_APPROVER_EMAIL}`;
const REVIEW_ROLE_NAME_UUID = `${TENANT_NAME}/review-role/availability`;
const REVIEW_APPROVER_ROLE_NAME_UUID = `${TENANT_NAME}/review-role/post-seal-financial`;
const REVIEW_FOLIO_SERIES_UUID = `${TENANT_NAME}/review-financials/folio-series`;
const REVIEW_REVENUE_ACCOUNT_UUID = `${TENANT_NAME}/review-financials/room-revenue`;
const REVIEW_CASH_ACCOUNT_UUID = `${TENANT_NAME}/review-financials/front-desk-cash`;
const REVIEW_CASH_DRAWER_UUID = `${TENANT_NAME}/review-financials/front-desk-1`;
export const REVIEW_CASH_DRAWER_CODE = "FRONT-DESK-1";
export const REVIEW_CASH_DENOMINATIONS = Object.freeze([1n, 5n, 10n, 25n, 100n, 500n, 1000n, 2000n, 5000n, 10000n]);

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

const REVIEW_RATE_POLICIES: readonly Readonly<{
  kind: Policy["kind"];
  name: string;
  content: Readonly<Record<string, unknown>>;
}>[] = Object.freeze([
  Object.freeze({
    kind: "cancellation" as const,
    name: "Flexible 48 hour cancellation",
    content: Object.freeze({
      kind: "cancellation",
      rules: Object.freeze([Object.freeze({
        before_hours: 48,
        penalty: Object.freeze({ basis: "nights", value: 1 }),
      })]),
    }),
  }),
  Object.freeze({
    kind: "deposit" as const,
    name: "First night deposit",
    content: Object.freeze({
      kind: "deposit",
      deposit: Object.freeze({ basis: "first_night", due: "at_booking" }),
    }),
  }),
  Object.freeze({
    kind: "guarantee" as const,
    name: "Card guarantee",
    content: Object.freeze({ kind: "guarantee", guarantee: "card_on_file" }),
  }),
  Object.freeze({
    kind: "no_show" as const,
    name: "First night no-show",
    content: Object.freeze({
      kind: "no_show",
      no_show_charge: Object.freeze({ basis: "first_night", value: 1 }),
    }),
  }),
]);

const REVIEW_RATE_PLAN = Object.freeze({
  code: "FLEX",
  name: "Flexible public rate",
  currency: "USD",
  taxInclusive: true,
  marketCode: "LEISURE",
  sourceCode: "DIRECT",
});

const REVIEW_RATE_PREVIEW = Object.freeze({
  bookingInstant: "2030-01-01T00:00:00.000Z",
  stayStartInstant: "2030-02-01T15:00:00.000Z",
  stayEndInstant: "2030-02-02T15:00:00.000Z",
  nightDate: "2030-02-01",
});

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

interface ReviewSeedBaseOptions {
  readonly databaseUrl: string;
  readonly password: string;
  readonly approverPassword?: string;
  readonly logger?: (line: string) => void;
}

export interface PublishedReviewSeedOptions extends ReviewSeedBaseOptions {
  readonly mode?: "published";
}

export interface IdentityInventoryReviewSeedOptions extends ReviewSeedBaseOptions {
  readonly mode: "identity_inventory";
}

export type ReviewSeedOptions = PublishedReviewSeedOptions | IdentityInventoryReviewSeedOptions;

interface ReviewSeedBaseResult {
  readonly tenant: string;
  readonly property: string;
  readonly email: string;
  readonly userId: string;
  readonly approverEmail: string;
  readonly approverUserId: string;
  readonly roleId: string;
  readonly cashAccountId: string;
  readonly cashDrawerId: string;
  readonly unitTypes: { created: number; existing: number };
  readonly rooms: { created: number; existing: number };
  readonly sellableUnits: { created: number; existing: number };
}

interface ReviewSeedRateResult {
  readonly ratePlanId: string;
  readonly activeReleaseId: string;
  readonly activeReleaseVersion: number;
  readonly created: boolean;
}

export interface PublishedReviewSeedResult extends ReviewSeedBaseResult {
  readonly mode: "published";
  readonly rate: ReviewSeedRateResult;
}

export interface IdentityInventoryReviewSeedResult extends ReviewSeedBaseResult {
  readonly mode: "identity_inventory";
  readonly rate: null;
}

export type ReviewSeedResult = PublishedReviewSeedResult | IdentityInventoryReviewSeedResult;

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

async function canonicalIds(): Promise<{
  userId: string;
  approverUserId: string;
  roleId: string;
  approverRoleId: string;
  folioSeriesId: string;
  revenueAccountId: string;
  cashAccountId: string;
  cashDrawerId: string;
}> {
  const derivedTenant = await uuidV5(URL_NAMESPACE_UUID, TENANT_NAME);
  const derivedProperty = await uuidV5(derivedTenant, PROPERTY_NAME);
  if (derivedTenant !== SEED_TENANT.id || derivedProperty !== SEED_PROPERTY.id) {
    throw new Error("Canonical launch-seed identities did not derive exactly");
  }
  return {
    userId: await uuidV5(SEED_TENANT.id, REVIEW_USER_NAME),
    approverUserId: await uuidV5(SEED_TENANT.id, REVIEW_APPROVER_USER_NAME),
    roleId: await uuidV5(SEED_TENANT.id, REVIEW_ROLE_NAME_UUID),
    approverRoleId: await uuidV5(SEED_TENANT.id, REVIEW_APPROVER_ROLE_NAME_UUID),
    folioSeriesId: await uuidV5(SEED_TENANT.id, REVIEW_FOLIO_SERIES_UUID),
    revenueAccountId: await uuidV5(SEED_TENANT.id, REVIEW_REVENUE_ACCOUNT_UUID),
    cashAccountId: await uuidV5(SEED_TENANT.id, REVIEW_CASH_ACCOUNT_UUID),
    cashDrawerId: await uuidV5(SEED_TENANT.id, REVIEW_CASH_DRAWER_UUID),
  };
}

interface ReviewUserSpec {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly label: string;
}

async function provisionReviewUser(
  connection: ReservedSQL,
  password: string,
  spec: ReviewUserSpec,
): Promise<void> {
  const users = await connection<IdentityRow[]>`
    SELECT id, tenant_id, email, display_name, auth, status
    FROM app_user
    WHERE id = ${spec.id}::uuid
       OR (tenant_id = ${SEED_TENANT.id}::uuid AND lower(email) = lower(${spec.email}))
    ORDER BY id
  `;
  if (users.length === 0) {
    const auth = await hashLocalPassword(password);
    await connection`
      INSERT INTO app_user (id, tenant_id, email, display_name, auth, status)
      VALUES (${spec.id}::uuid, ${SEED_TENANT.id}::uuid, ${spec.email}, ${spec.displayName},
              ${JSON.stringify(auth)}::text::jsonb, 'active')
    `;
    return;
  }
  const user = users[0];
  if (users.length !== 1 || !user || user.id !== spec.id || user.tenant_id !== SEED_TENANT.id ||
      user.email !== spec.email || user.display_name !== spec.displayName || user.status !== "active" ||
      !(await verifyLocalPassword(password, user.auth))) {
    throw new Error(`${spec.label} collides with non-canonical local-review data`);
  }
}

async function provisionIdentity(
  connection: ReservedSQL,
  password: string,
  approverPassword: string,
  userId: string,
  approverUserId: string,
  roleId: string,
  approverRoleId: string,
): Promise<void> {
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
  const postSealPermissions = await connection<Array<{ code: string; description: string }>>`
    SELECT code, description FROM permission WHERE code = ${REVIEW_POST_SEAL_PERMISSION.code}
  `;
  if (postSealPermissions.length === 0) {
    await connection`INSERT INTO permission (code, description)
      VALUES (${REVIEW_POST_SEAL_PERMISSION.code}, ${REVIEW_POST_SEAL_PERMISSION.description})`;
  } else {
    exact(postSealPermissions[0], REVIEW_POST_SEAL_PERMISSION, "Post-seal review permission");
  }
  const cashierSupervisePermissions = await connection<Array<{ code: string; description: string }>>`
    SELECT code, description FROM permission WHERE code = ${REVIEW_CASHIER_SUPERVISE_PERMISSION.code}
  `;
  if (cashierSupervisePermissions.length === 0) {
    await connection`INSERT INTO permission (code, description)
      VALUES (${REVIEW_CASHIER_SUPERVISE_PERMISSION.code}, ${REVIEW_CASHIER_SUPERVISE_PERMISSION.description})`;
  } else {
    exact(cashierSupervisePermissions[0], REVIEW_CASHIER_SUPERVISE_PERMISSION,
      "Cashier supervise review permission");
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
  const approverRoles = await connection<RoleRow[]>`
    SELECT id, tenant_id, name FROM role
    WHERE id = ${approverRoleId}::uuid
       OR (tenant_id = ${SEED_TENANT.id}::uuid AND name = ${REVIEW_APPROVER_ROLE_NAME})
    ORDER BY id
  `;
  if (approverRoles.length === 0) {
    await connection`INSERT INTO role (id, tenant_id, name)
      VALUES (${approverRoleId}::uuid, ${SEED_TENANT.id}::uuid, ${REVIEW_APPROVER_ROLE_NAME})`;
  } else {
    exact(approverRoles[0], { id: approverRoleId, tenant_id: SEED_TENANT.id,
      name: REVIEW_APPROVER_ROLE_NAME }, "Post-seal review role");
    if (approverRoles.length !== 1) throw new Error("Post-seal review role is ambiguous");
  }
  await connection`
    INSERT INTO role_permission (role_id, permission_code)
    VALUES (${approverRoleId}::uuid, ${REVIEW_POST_SEAL_PERMISSION.code})
    ON CONFLICT (role_id, permission_code) DO NOTHING
  `;
  await connection`
    INSERT INTO role_permission (role_id, permission_code)
    VALUES (${approverRoleId}::uuid, ${REVIEW_CASHIER_SUPERVISE_PERMISSION.code})
    ON CONFLICT (role_id, permission_code) DO NOTHING
  `;

  const users = Object.freeze([
    Object.freeze({ id: userId, email: REVIEW_EMAIL, displayName: REVIEW_DISPLAY_NAME, label: "Review user", password }),
    Object.freeze({ id: approverUserId, email: REVIEW_APPROVER_EMAIL,
      displayName: REVIEW_APPROVER_DISPLAY_NAME, label: "Review approver", password: approverPassword }),
  ]);
  for (const user of users) {
    await provisionReviewUser(connection, user.password, user);
    const grants = await connection<Array<{ tenant_id: string; user_id: string; role_id: string; scope_node: string }>>`
      SELECT tenant_id, user_id, role_id, scope_node FROM user_role
      WHERE user_id = ${user.id}::uuid AND role_id = ${roleId}::uuid AND scope_node = ${SEED_PROPERTY.id}::uuid
    `;
    if (grants.length === 0) {
      await connection`
        INSERT INTO user_role (tenant_id, user_id, role_id, scope_node)
        VALUES (${SEED_TENANT.id}::uuid, ${user.id}::uuid, ${roleId}::uuid, ${SEED_PROPERTY.id}::uuid)
      `;
    } else {
      exact(grants[0], { tenant_id: SEED_TENANT.id, user_id: user.id, role_id: roleId,
        scope_node: SEED_PROPERTY.id }, `${user.label} role grant`);
      if (grants.length !== 1) throw new Error(`${user.label} role grant is not canonical`);
    }
  }
  await connection`
    INSERT INTO user_role (tenant_id, user_id, role_id, scope_node)
    VALUES (${SEED_TENANT.id}::uuid, ${approverUserId}::uuid,
      ${approverRoleId}::uuid, ${SEED_PROPERTY.id}::uuid)
    ON CONFLICT (user_id, role_id, scope_node) DO NOTHING
  `;
}

async function provisionReviewFinancials(
  connection: ReservedSQL,
  folioSeriesId: string,
  revenueAccountId: string,
  cashAccountId: string,
  cashDrawerId: string,
): Promise<void> {
  const series = await connection<Array<{
    id: string; prefix: string; next_no: string | number | bigint; last_doc_hash: string | null;
  }>>`
    SELECT id, prefix, next_no, last_doc_hash
    FROM document_series
    WHERE tenant_id=${SEED_TENANT.id}::uuid
      AND property_node=${SEED_PROPERTY.id}::uuid
      AND kind='folio' AND fiscal=false
    ORDER BY id
  `;
  if (series.length === 0) {
    await connection`
      INSERT INTO document_series (id, tenant_id, property_node, kind, prefix, next_no, fiscal)
      VALUES (${folioSeriesId}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid,
        'folio', 'FOL-', 1, false)
    `;
  } else {
    const current = series[0];
    if (series.length !== 1 || !current || current.id !== folioSeriesId || current.prefix !== "FOL-" ||
        BigInt(current.next_no) < 1n || current.last_doc_hash !== null) {
      throw new Error("Local-review non-fiscal folio series collides with non-canonical data");
    }
  }

  const accounts = await connection<Array<{
    id: string; tenant_id: string; property_node: string | null; role: string;
    party_id: string | null; name: string; currency: string; status: string;
  }>>`
    SELECT id, tenant_id, property_node, role, party_id, name, currency::text, status
    FROM account
    WHERE id=${revenueAccountId}::uuid
       OR (tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
           AND role='revenue' AND name='Room Revenue' AND currency=${SEED_PROPERTY.currency})
    ORDER BY id
  `;
  const expectedAccount = {
    id: revenueAccountId, tenant_id: SEED_TENANT.id, property_node: SEED_PROPERTY.id,
    role: "revenue", party_id: null, name: "Room Revenue", currency: SEED_PROPERTY.currency, status: "open",
  };
  if (accounts.length === 0) {
    await connection`
      INSERT INTO account (id, tenant_id, property_node, role, party_id, name, currency, status)
      VALUES (${revenueAccountId}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid,
        'revenue', NULL, 'Room Revenue', ${SEED_PROPERTY.currency}, 'open')
    `;
  } else {
    exact(accounts[0], expectedAccount, "Local-review room-revenue account");
    if (accounts.length !== 1) throw new Error("Local-review room-revenue account is ambiguous");
  }

  const cashAccounts = await connection<Array<{
    id: string; tenant_id: string; property_node: string | null; role: string;
    party_id: string | null; name: string; currency: string; status: string;
  }>>`
    SELECT id, tenant_id, property_node, role, party_id, name, currency::text, status
    FROM account
    WHERE id=${cashAccountId}::uuid
       OR (tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
           AND role='cash' AND name='Front Desk Cash' AND currency=${SEED_PROPERTY.currency})
    ORDER BY id
  `;
  const expectedCashAccount = {
    id: cashAccountId, tenant_id: SEED_TENANT.id, property_node: SEED_PROPERTY.id,
    role: "cash", party_id: null, name: "Front Desk Cash", currency: SEED_PROPERTY.currency, status: "open",
  };
  if (cashAccounts.length === 0) {
    await connection`
      INSERT INTO account (id, tenant_id, property_node, role, party_id, name, currency, status)
      VALUES (${cashAccountId}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid,
        'cash', NULL, 'Front Desk Cash', ${SEED_PROPERTY.currency}, 'open')
    `;
  } else {
    exact(cashAccounts[0], expectedCashAccount, "Local-review front-desk cash account");
    if (cashAccounts.length !== 1) throw new Error("Local-review front-desk cash account is ambiguous");
  }

  const drawers = await connection<Array<{
    tenant_id: string; id: string; property_node: string; account_id: string;
    code: string; name: string; currency: string; active: boolean;
  }>>`
    SELECT tenant_id, id, property_node, account_id, code, name, currency::text, active
    FROM cash_drawer
    WHERE id=${cashDrawerId}::uuid
       OR (tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
           AND code=${REVIEW_CASH_DRAWER_CODE})
    ORDER BY id
  `;
  const expectedDrawer = {
    tenant_id: SEED_TENANT.id, id: cashDrawerId, property_node: SEED_PROPERTY.id,
    account_id: cashAccountId, code: REVIEW_CASH_DRAWER_CODE, name: "Front Desk 1",
    currency: SEED_PROPERTY.currency, active: true,
  };
  if (drawers.length === 0) {
    await connection`
      INSERT INTO cash_drawer (
        tenant_id, id, property_node, account_id, code, name, currency, active
      ) VALUES (
        ${SEED_TENANT.id}::uuid, ${cashDrawerId}::uuid, ${SEED_PROPERTY.id}::uuid,
        ${cashAccountId}::uuid, ${REVIEW_CASH_DRAWER_CODE}, 'Front Desk 1',
        ${SEED_PROPERTY.currency}, true
      )
    `;
  } else {
    exact(drawers[0], expectedDrawer, "Local-review front-desk cash drawer");
    if (drawers.length !== 1) throw new Error("Local-review front-desk cash drawer is ambiguous");
  }

  const denominationRows = await connection<Array<{ unit_minor: string | number | bigint; active: boolean }>>`
    SELECT unit_minor, active
    FROM cash_drawer_denomination
    WHERE tenant_id=${SEED_TENANT.id}::uuid AND drawer_id=${cashDrawerId}::uuid
    ORDER BY unit_minor
  `;
  if (denominationRows.length === 0) {
    for (const denomination of REVIEW_CASH_DENOMINATIONS) {
      await connection`
        INSERT INTO cash_drawer_denomination (tenant_id, drawer_id, unit_minor, active)
        VALUES (${SEED_TENANT.id}::uuid, ${cashDrawerId}::uuid, ${denomination}, true)
      `;
    }
  } else {
    exact(denominationRows.map(({ unit_minor, active }) => ({ unit_minor: BigInt(unit_minor).toString(), active })),
      REVIEW_CASH_DENOMINATIONS.map((unit_minor) => ({ unit_minor: unit_minor.toString(), active: true })),
      "Local-review cashier denominations");
  }

  const codes = await connection<Array<{
    code: string; name: string; grp: string; usali_line: string | null;
    default_dr: string | null; default_cr: string | null;
  }>>`
    SELECT code, name, grp, usali_line, default_dr, default_cr FROM tx_code WHERE code='ROOM'
  `;
  const expectedCode = {
    code: "ROOM", name: "Room charge", grp: "revenue", usali_line: "Rooms",
    default_dr: "guest", default_cr: "revenue",
  };
  if (codes.length === 0) {
    await connection`
      INSERT INTO tx_code (code, name, grp, usali_line, default_dr, default_cr)
      VALUES ('ROOM', 'Room charge', 'revenue', 'Rooms', 'guest', 'revenue')
    `;
  } else {
    exact(codes[0], expectedCode, "Local-review ROOM transaction code");
    if (codes.length !== 1) throw new Error("Local-review ROOM transaction code is ambiguous");
  }

  const routes = await connection<Array<{
    tenant_id: string; property_node: string; currency: string; tx_code: string;
    debit_account_id: string | null; credit_account_id: string | null;
  }>>`
    SELECT tenant_id, property_node, currency::text, tx_code, debit_account_id, credit_account_id
    FROM tx_code_route
    WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
      AND currency=${SEED_PROPERTY.currency} AND tx_code='ROOM'
  `;
  const expectedRoute = {
    tenant_id: SEED_TENANT.id, property_node: SEED_PROPERTY.id, currency: SEED_PROPERTY.currency,
    tx_code: "ROOM", debit_account_id: null, credit_account_id: revenueAccountId,
  };
  if (routes.length === 0) {
    await connection`
      INSERT INTO tx_code_route (
        tenant_id, property_node, currency, tx_code, debit_account_id, credit_account_id
      ) VALUES (
        ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid, ${SEED_PROPERTY.currency},
        'ROOM', NULL, ${revenueAccountId}::uuid
      )
    `;
  } else {
    exact(routes[0], expectedRoute, "Local-review ROOM transaction route");
    if (routes.length !== 1) throw new Error("Local-review ROOM transaction route is ambiguous");
  }

  const days = await connection<Array<{ tenant_id: string; business_date: string; sealed_at: string | null }>>`
    SELECT day.tenant_id, day.business_date::text, day.sealed_at::text
    FROM org_node AS property
    LEFT JOIN business_day AS day
      ON day.property_node=property.id
     AND day.business_date=(CURRENT_TIMESTAMP AT TIME ZONE property.timezone)::date
    WHERE property.id=${SEED_PROPERTY.id}::uuid AND property.tenant_id=${SEED_TENANT.id}::uuid
  `;
  const currentDay = days[0];
  if (!currentDay) throw new Error("Local-review property is unavailable while provisioning its business day");
  if (currentDay.business_date === null || currentDay.tenant_id === null) {
    await connection`
      INSERT INTO business_day (tenant_id, property_node, business_date)
      SELECT property.tenant_id, property.id,
        (CURRENT_TIMESTAMP AT TIME ZONE property.timezone)::date
      FROM org_node AS property
      WHERE property.id=${SEED_PROPERTY.id}::uuid AND property.tenant_id=${SEED_TENANT.id}::uuid
    `;
  } else if (currentDay.tenant_id !== SEED_TENANT.id || currentDay.sealed_at !== null) {
    throw new Error("Local-review current business day is foreign or sealed");
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

function reviewEnvelope(actorId: string, operation: string) {
  return createAuditEnvelope({
    actorId,
    tenantId: SEED_TENANT.id,
    propertyNode: SEED_PROPERTY.id,
    requestId: crypto.randomUUID(),
    operation,
  });
}

function requirePolicy(policies: readonly Policy[], kind: Policy["kind"]): Policy {
  const matches = policies.filter((policy) => policy.kind === kind);
  const policy = matches[0];
  if (!policy || matches.length !== 1) throw new Error(`canonical review ${kind} policy is absent or duplicated`);
  return policy;
}

function canonicalReviewRateCommand(ratePlanId: string, policies: readonly Policy[]): CanonicalRateAuthoringCommand {
  return compileRateAuthoringCommand({
    authoringMode: "guided",
    ratePlanId,
    model: { key: "simple-fixed", version: 1, componentModelKeys: [] },
    target: {
      rules: [{
        key: "property-default",
        effect: "include",
        priority: 0,
        physical: { kind: "property" },
        commercial: {},
      }],
    },
    evaluator: {
      modelKey: "simple-fixed",
      currency: "USD",
      base: { kind: "fixed", amountMinor: "12500" },
      gate: { stayStart: "2020-01-01", stayEnd: "2100-01-01", dowMask: 127 },
      rules: [],
      floorMinor: null,
      ceilingMinor: null,
      eligibleTargetRuleKeys: [],
    },
    composition: {
      currency: "USD",
      guestEligibility: {
        minAdults: 1,
        maxAdults: 4,
        minChildren: 0,
        maxChildren: 3,
        minTotalGuests: 1,
        maxTotalGuests: 7,
      },
      package: null,
      promotions: [],
      policy: {
        cancellationPolicyId: requirePolicy(policies, "cancellation").id,
        depositPolicyId: requirePolicy(policies, "deposit").id,
        guaranteePolicyId: requirePolicy(policies, "guarantee").id,
        noShowPolicyId: requirePolicy(policies, "no_show").id,
        refundTreatment: "policy",
      },
      distribution: { mode: "all", channelCodes: [] },
    },
    rmsBinding: null,
  });
}

function reviewPreviewCell(
  sellable: SellableUnit,
  policies: readonly Policy[],
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    key: "local-review-flex-2030-02-01",
    evaluationContext: Object.freeze({
      propertyTimeZone: SEED_PROPERTY.timezone,
      ...REVIEW_RATE_PREVIEW,
    }),
    targetContext: Object.freeze({
      unitTypeId: sellable.unitTypeId,
      sellableUnitId: sellable.id,
      commercial: Object.freeze({}),
    }),
    guests: Object.freeze({ adults: 1, childAges: Object.freeze([]) }),
    selectedPromotionCodes: Object.freeze([]),
    policyEvidence: Object.freeze([
      Object.freeze({ kind: "cancellation", policyId: requirePolicy(policies, "cancellation").id,
        evidenceRef: `policy:${requirePolicy(policies, "cancellation").id}` }),
      Object.freeze({ kind: "deposit", policyId: requirePolicy(policies, "deposit").id,
        evidenceRef: `policy:${requirePolicy(policies, "deposit").id}` }),
      Object.freeze({ kind: "guarantee", policyId: requirePolicy(policies, "guarantee").id,
        evidenceRef: `policy:${requirePolicy(policies, "guarantee").id}` }),
      Object.freeze({ kind: "no_show", policyId: requirePolicy(policies, "no_show").id,
        evidenceRef: `policy:${requirePolicy(policies, "no_show").id}` }),
    ]),
    mandatoryPolicyEvidence: Object.freeze([]),
    availabilityEvidence: Object.freeze({
      sellableUnitId: sellable.id,
      availableCount: 1,
      bookable: true,
      restrictionEvidence: Object.freeze([]),
      operationalBlockEvidence: Object.freeze([]),
      evidenceRef: `availability:local-review:${sellable.id}:2030-02-01`,
    }),
    channelCode: "direct",
    channelMappingEvidenceRef: null,
  });
}

async function ensureReviewPolicies(
  tx: Tx,
  configuration: RateConfigurationService,
  requesterId: string,
): Promise<readonly Policy[]> {
  const policies = [...await configuration.listPolicies(tx)];
  const canonical: Policy[] = [];
  for (const spec of REVIEW_RATE_POLICIES) {
    const matches = policies.filter(({ kind, name }) => kind === spec.kind && name === spec.name);
    if (matches.length > 1) throw new Error(`${spec.name} collides with duplicated local-review data`);
    let policy = matches[0];
    if (policy) {
      exact(policy.content, spec.content, spec.name);
    } else {
      policy = await configuration.createPolicy(tx, {
        kind: spec.kind,
        name: spec.name,
        content: spec.content,
        envelope: reviewEnvelope(requesterId, "policy.created"),
      });
      policies.push(policy);
    }
    canonical.push(policy);
  }
  return Object.freeze(canonical);
}

async function ensureReviewRatePlan(
  tx: Tx,
  configuration: RateConfigurationService,
  policies: readonly Policy[],
  requesterId: string,
): Promise<RatePlan> {
  const plans = await configuration.listRatePlans(tx, SEED_PROPERTY.id);
  const matches = plans.filter(({ code }) => code === REVIEW_RATE_PLAN.code);
  if (matches.length > 1) throw new Error("FLEX rate plan collides with duplicated local-review data");
  let plan = matches[0];
  if (!plan) {
    plan = await configuration.createRatePlan(tx, {
      ...REVIEW_RATE_PLAN,
      cancellationPolicyId: requirePolicy(policies, "cancellation").id,
      depositPolicyId: requirePolicy(policies, "deposit").id,
      guaranteePolicyId: requirePolicy(policies, "guarantee").id,
      envelope: reviewEnvelope(requesterId, "rate_plan.created"),
    });
  } else {
    exact({
      tenantId: plan.tenantId,
      propertyNode: plan.propertyNode,
      code: plan.code,
      name: plan.name,
      currency: plan.currency,
      taxInclusive: plan.taxInclusive,
      cancellationPolicyId: plan.cancellationPolicyId,
      depositPolicyId: plan.depositPolicyId,
      guaranteePolicyId: plan.guaranteePolicyId,
      parentPlanId: plan.parentPlanId,
      derivation: plan.derivation,
      marketCode: plan.marketCode,
      sourceCode: plan.sourceCode,
      status: plan.status,
    }, {
      tenantId: SEED_TENANT.id,
      propertyNode: SEED_PROPERTY.id,
      ...REVIEW_RATE_PLAN,
      cancellationPolicyId: requirePolicy(policies, "cancellation").id,
      depositPolicyId: requirePolicy(policies, "deposit").id,
      guaranteePolicyId: requirePolicy(policies, "guarantee").id,
      parentPlanId: null,
      derivation: null,
      status: "active",
    }, "FLEX rate plan");
  }
  return plan;
}

type ReviewApprovalView = Awaited<
  ReturnType<RatePublicationService["listPublicationApprovals"]>
>["approvals"][number];

async function releaseApprovals(
  tx: Tx,
  publication: RatePublicationService,
  ratePlanId: string,
  releaseId: string,
): Promise<readonly ReviewApprovalView[]> {
  const found: ReviewApprovalView[] = [];
  let after: string | undefined;
  for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
    const page = await publication.listPublicationApprovals(tx, {
      propertyNode: SEED_PROPERTY.id,
      ratePlanId,
      limit: 100,
      ...(after === undefined ? {} : { after }),
    });
    found.push(...page.approvals.filter(({ releaseId: candidate }) => candidate === releaseId));
    if (page.nextCursor === null) return Object.freeze(found);
    after = page.nextCursor;
  }
  throw new Error("local-review approval history exceeds the bounded verification window");
}

async function verifyActiveReviewRelease(
  tx: Tx,
  active: RatePlanRelease,
  expected: CanonicalRateAuthoringCommand,
  requesterId: string,
  approverId: string,
  models: RateModelService,
  targets: RateTargetService,
  publication: RatePublicationService,
): Promise<void> {
  const modelMatches = (await models.listDraftVersions(tx, SEED_PROPERTY.id, expected.ratePlanId))
    .filter(({ id, extensionVersion }) =>
      id === active.modelDraftId && extensionVersion === active.modelDraftVersion
    );
  const targetMatches = (await targets.listDraftVersions(tx, SEED_PROPERTY.id, expected.ratePlanId))
    .filter(({ id, extensionVersion }) =>
      id === active.targetDraftId && extensionVersion === active.targetDraftVersion
    );
  const model = modelMatches[0];
  const target = targetMatches[0];
  if (!model || modelMatches.length !== 1 || !target || targetMatches.length !== 1 ||
      active.propertyNode !== SEED_PROPERTY.id || active.ratePlanId !== expected.ratePlanId ||
      active.status !== "active" || active.undoOfVersion !== null) {
    throw new Error("active FLEX release collides with non-canonical local-review data");
  }
  const reconstructed: CanonicalRateAuthoringCommand = Object.freeze({
    authoringMode: model.authoringMode,
    ratePlanId: active.ratePlanId,
    model: Object.freeze({
      key: model.modelKey,
      version: model.modelVersion,
      componentModelKeys: model.componentModelKeys,
    }),
    target: Object.freeze({ rules: target.rules }),
    evaluator: active.evaluatorSpec,
    composition: active.compositionSpec,
    rmsBinding: active.rmsBinding,
  });
  if (canonicalRateAuthoringJson(reconstructed) !== canonicalRateAuthoringJson(expected)) {
    throw new Error("active FLEX release collides with non-canonical local-review data");
  }
  const approvals = await releaseApprovals(tx, publication, expected.ratePlanId, active.id);
  const approval = approvals[0];
  if (!approval || approvals.length !== 1 || approval.status !== "approved" ||
      approval.releaseStatus !== "active" || approval.releaseVersion !== active.extensionVersion ||
      approval.requestedBy.id !== requesterId || approval.decidedBy?.id !== approverId) {
    throw new Error("active FLEX release collides with non-canonical local-review data");
  }
}

async function provisionReviewRate(
  tx: Tx,
  sellable: SellableUnit,
  requesterId: string,
  approverId: string,
  configuration: RateConfigurationService,
  models: RateModelService,
  targets: RateTargetService,
  publication: RatePublicationService,
): Promise<ReviewSeedRateResult> {
  const policies = await ensureReviewPolicies(tx, configuration, requesterId);
  const plan = await ensureReviewRatePlan(tx, configuration, policies, requesterId);
  const expected = canonicalReviewRateCommand(plan.id, policies);
  const releases = await publication.listReleaseVersions(tx, SEED_PROPERTY.id, plan.id);
  const activeReleases = releases.filter(({ status }) => status === "active");
  if (activeReleases.length > 1) {
    throw new Error("active FLEX release collides with non-canonical local-review data");
  }
  const existing = activeReleases[0];
  if (existing) {
    await verifyActiveReviewRelease(tx, existing, expected, requesterId, approverId, models, targets, publication);
    return Object.freeze({
      ratePlanId: plan.id,
      activeReleaseId: existing.id,
      activeReleaseVersion: existing.extensionVersion,
      created: false,
    });
  }

  const model = await models.createDraftVersion(tx, {
    ratePlanId: plan.id,
    modelKey: expected.model.key,
    modelVersion: expected.model.version,
    authoringMode: expected.authoringMode,
    componentModelKeys: expected.model.componentModelKeys,
    envelope: reviewEnvelope(requesterId, "rate_plan_model.drafted"),
  });
  const target = await targets.createDraftVersion(tx, {
    ratePlanId: plan.id,
    authoringMode: expected.authoringMode,
    rules: expected.target.rules,
    envelope: reviewEnvelope(requesterId, "rate_plan_target.drafted"),
  });
  const draft = await publication.createDraftVersion(tx, {
    ratePlanId: plan.id,
    modelDraftVersion: model.extensionVersion,
    targetDraftVersion: target.extensionVersion,
    evaluatorSpec: expected.evaluator,
    compositionSpec: expected.composition,
    rmsBinding: expected.rmsBinding,
    envelope: reviewEnvelope(requesterId, "rate_plan_release.drafted"),
  });
  const previewCells = Object.freeze([reviewPreviewCell(sellable, policies)]);
  const requested = await publication.requestPublicationApproval(tx, {
    releaseId: draft.id,
    previewCells,
    requestedBy: requesterId,
    envelope: reviewEnvelope(requesterId, "rate_plan_release.approval_requested"),
  });
  const decided = await publication.decidePublicationApproval(tx, {
    propertyNode: SEED_PROPERTY.id,
    ratePlanId: plan.id,
    approvalId: requested.approval.id,
    decision: "approved",
    decidedBy: approverId,
    envelope: reviewEnvelope(approverId, "rate_plan_release.approval_decided"),
  });
  if (decided.status !== "approved") throw new Error("local-review rate approval was not approved");
  const published = await publication.publishDraft(tx, {
    releaseId: draft.id,
    approvalId: requested.approval.id,
    previewCells,
    envelope: reviewEnvelope(approverId, "rate_plan_release.published"),
  });
  await verifyActiveReviewRelease(
    tx,
    published.release,
    expected,
    requesterId,
    approverId,
    models,
    targets,
    publication,
  );
  return Object.freeze({
    ratePlanId: plan.id,
    activeReleaseId: published.release.id,
    activeReleaseVersion: published.release.extensionVersion,
    created: true,
  });
}

export function runReviewSeed(options: IdentityInventoryReviewSeedOptions): Promise<IdentityInventoryReviewSeedResult>;
export function runReviewSeed(options: PublishedReviewSeedOptions): Promise<PublishedReviewSeedResult>;
export async function runReviewSeed(options: ReviewSeedOptions): Promise<ReviewSeedResult> {
  if (!options.databaseUrl) throw new Error("databaseUrl is required");
  if (!options.password) throw new Error("password is required");
  const mode = options.mode ?? "published";
  const approverPassword = options.approverPassword ?? `${options.password}\u0000rate-approver`;
  if (!approverPassword || approverPassword === options.password) {
    throw new Error("approverPassword must be distinct from password");
  }
  const logger = options.logger ?? console.log;
  const {
    userId, approverUserId, roleId, approverRoleId, folioSeriesId, revenueAccountId,
    cashAccountId, cashDrawerId,
  } = await canonicalIds();
  const identityPool = new SQL(options.databaseUrl, { max: 2 });
  const eventPool = new SQL(options.databaseUrl, { max: 4, prepare: false });
  const database = Database.connect(options.databaseUrl, { maxConnections: 6 });

  try {
    await withIdentityTransaction(identityPool, async (tx) => {
      await provisionIdentity(tx, options.password, approverPassword, userId, approverUserId, roleId, approverRoleId);
      await provisionReviewFinancials(tx, folioSeriesId, revenueAccountId, cashAccountId, cashDrawerId);
    });
    const events = new PostgresEventBus(eventPool);
    const inventory = new InventoryService(events);
    const counts = {
      unitTypes: { created: 0, existing: 0 },
      rooms: { created: 0, existing: 0 },
      sellableUnits: { created: 0, existing: 0 },
    };

    const unitTypes = new Map<string, UnitType>();
    const sellableUnits = new Map<string, SellableUnit>();
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
        sellableUnits.set(spec.code, item);
      }
    });

    logger(`review seed: tenant=${SEED_TENANT.slug} property=${SEED_PROPERTY.name}`);
    logger(`review login: ${REVIEW_EMAIL} (password supplied by YELLOW_REVIEW_PASSWORD)`);
    logger(`review approver: ${REVIEW_APPROVER_EMAIL} (password supplied by YELLOW_REVIEW_APPROVER_PASSWORD)`);
    logger(`review inventory: unit_types=${counts.unitTypes.created}/${counts.unitTypes.existing} rooms=${counts.rooms.created}/${counts.rooms.existing} sellable_units=${counts.sellableUnits.created}/${counts.sellableUnits.existing} created/existing`);
    const common = { tenant: SEED_TENANT.slug, property: SEED_PROPERTY.name, email: REVIEW_EMAIL,
      userId, approverEmail: REVIEW_APPROVER_EMAIL, approverUserId, roleId,
      cashAccountId, cashDrawerId, ...counts };
    if (mode === "identity_inventory") {
      logger("review rate: omitted by explicit identity_inventory fixture mode");
      return { ...common, mode, rate: null };
    }

    const previewSellable = sellableUnits.get("101");
    if (!previewSellable) throw new Error("Review rate preview sellable is missing");
    const configuration = new RateConfigurationService(events);
    const registry = new ExtensionRegistry(eventPool);
    const models = new RateModelService(registry);
    const targets = new RateTargetService(registry);
    const publication = new RatePublicationService(registry, new ApprovalService(events), events);
    const rate = await database.withTenantTransaction(SEED_TENANT.id, async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended('yellow.local.review.seed', 0))`;
      return provisionReviewRate(
        tx,
        previewSellable,
        userId,
        approverUserId,
        configuration,
        models,
        targets,
        publication,
      );
    });

    logger(`review rate: plan=${rate.ratePlanId} active_release=${rate.activeReleaseId} version=${rate.activeReleaseVersion} state=${rate.created ? "created" : "existing"}`);
    return { ...common, mode, rate };
  } finally {
    await database.close();
    await eventPool.close();
    await identityPool.close();
  }
}

async function runCli(): Promise<void> {
  const databaseUrl = process.env.YELLOW_DEPLOY_DATABASE_URL;
  const password = process.env.YELLOW_REVIEW_PASSWORD;
  const approverPassword = process.env.YELLOW_REVIEW_APPROVER_PASSWORD;
  if (!databaseUrl || !password || !approverPassword || password === approverPassword) {
    console.error("YELLOW_DEPLOY_DATABASE_URL, YELLOW_REVIEW_PASSWORD and a distinct YELLOW_REVIEW_APPROVER_PASSWORD are required");
    process.exitCode = 1;
    return;
  }
  try {
    await runReviewSeed({ databaseUrl, password, approverPassword });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(`review seed failed: ${raw.split(password).join("[REDACTED]").split(approverPassword).join("[REDACTED]")}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) await runCli();
