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
export const REVIEW_RECEIVABLE_APPROVE_PERMISSION = Object.freeze({
  code: "financials.receivables:approve",
  description: "Approve governed over-limit receivable transfers",
});
export const REVIEW_TRUST_NEGATIVE_APPROVE_PERMISSION = Object.freeze({
  code: "financials.trust:approve-negative",
  description: "Approve one exact negative owner trust expense",
});
export const REVIEW_DIRTY_ROOM_OVERRIDE_PERMISSION = Object.freeze({
  code: "stay-operations.checkin:dirty-room-override",
  description: "Override a dirty or pickup room check-in with an attributable reason",
});
export const REVIEW_HOUSEKEEPING_INSPECT_PERMISSION = Object.freeze({
  code: "housekeeping.tasks:inspect",
  description: "Independently verify completed property housekeeping tasks",
});
export const REVIEW_PICKUP_TASK_DISPATCH_PERMISSION = Object.freeze({
  code: "stay-operations.pickup-tasks:dispatch",
  description: "Assign the exact linked arrival pickup task to active property staff",
});
export const REVIEW_PICKUP_TASK_WORK_PERMISSION = Object.freeze({
  code: "stay-operations.pickup-tasks:work",
  description: "Start and complete the exact linked arrival pickup task",
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
  { code: "financials.receivables:read", description: "Read governed property receivable targets and exposure" },
  { code: "financials.receivables:transfer", description: "Transfer exact guest debt to a governed receivable" },
  { code: "financials.trust:post", description: "Post one governed owner trust expense accrual" },
  { code: "financials.transfers:write", description: "Preview and commit governed folio transfers" },
  { code: "housekeeping.tasks:read", description: "Read the governed property housekeeping task board" },
  { code: "housekeeping.tasks:work", description: "Start and complete governed property housekeeping tasks" },
  { code: "housekeeping.discrepancies:read", description: "Read unresolved governed property room discrepancies" },
  { code: "housekeeping.discrepancies:report", description: "Report an explicit observed room presence for governed comparison" },
  { code: "housekeeping.arrival-tasks:read", description: "Read the exact dirty or pickup arrival cleaning-task candidate" },
  { code: "housekeeping.arrival-tasks:create", description: "Assign the exact dirty or pickup arrival cleaning task" },
  { code: "housekeeping.conditions:initialize", description: "Initialize one absent property room condition" },
  { code: "housekeeping.sheets:read", description: "Read governed property housekeeping task sheets" },
  { code: "housekeeping.sheets:generate", description: "Generate governed property housekeeping task sheets" },
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
  { code: "stay-operations.checkin:read", description: "Read server-owned property check-in readiness" },
  { code: "stay-operations.checkin:commit", description: "Commit an eligible property check-in" },
  { code: "stay-operations.checkout:read", description: "Read server-owned property departure readiness" },
  { code: "stay-operations.checkout:commit", description: "Commit an eligible property checkout" },
  { code: "stay-operations.vehicles:read", description: "Read the governed property vehicle register" },
  { code: "stay-operations.vehicles:park", description: "Assign onsite reservation-linked vehicles to governed parking spaces" },
  REVIEW_PICKUP_TASK_DISPATCH_PERMISSION,
  REVIEW_PICKUP_TASK_WORK_PERMISSION,
]);
const REVIEW_USER_NAME = `${TENANT_NAME}/review-user/${REVIEW_EMAIL}`;
const REVIEW_APPROVER_USER_NAME = `${TENANT_NAME}/review-user/${REVIEW_APPROVER_EMAIL}`;
const REVIEW_ROLE_NAME_UUID = `${TENANT_NAME}/review-role/availability`;
const REVIEW_APPROVER_ROLE_NAME_UUID = `${TENANT_NAME}/review-role/post-seal-financial`;
const REVIEW_FOLIO_SERIES_UUID = `${TENANT_NAME}/review-financials/folio-series`;
const REVIEW_REVENUE_ACCOUNT_UUID = `${TENANT_NAME}/review-financials/room-revenue`;
const REVIEW_CASH_ACCOUNT_UUID = `${TENANT_NAME}/review-financials/front-desk-cash`;
const REVIEW_CASH_DRAWER_UUID = `${TENANT_NAME}/review-financials/front-desk-1`;
const REVIEW_COMPANY_PARTY_UUID = `${TENANT_NAME}/review-parties/company/northstar-consulting`;
const REVIEW_AGENT_PARTY_UUID = `${TENANT_NAME}/review-parties/agent/horizon-travel`;
const REVIEW_COMPANY_ACCOUNT_UUID = `${TENANT_NAME}/review-financials/receivable/northstar-consulting`;
const REVIEW_AGENT_ACCOUNT_UUID = `${TENANT_NAME}/review-financials/receivable/horizon-travel`;
const REVIEW_STATUTORY_ADAPTER_KEY = "local-review-recorded-identity";
const REVIEW_CHECKIN_FIXTURE_UUID = `${TENANT_NAME}/review-checkin`;
const REVIEW_HOUSEKEEPING_FIXTURE_UUID = `${TENANT_NAME}/review-housekeeping`;
const REVIEW_VEHICLE_FIXTURE_UUID = `${TENANT_NAME}/review-vehicles`;
const REVIEW_ARRIVAL_TRAVEL_FIXTURE_UUID = `${TENANT_NAME}/review-arrival-travel`;
const REVIEW_DEPARTURE_TRAVEL_FIXTURE_UUID = `${TENANT_NAME}/review-departure-travel`;
const REVIEW_PICKUP_TASK_DISPATCH_FIXTURE_UUID = `${TENANT_NAME}/review-pickup-task-dispatch`;
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
  { code: "203", unitTypeCode: "DLX", name: "Room 203", floor: "2", areaSqm: 38 },
]);

const PARKING_SPACES = Object.freeze([
  { code: "P-01", name: "Parking P-01", floor: "B1" },
  { code: "P-02", name: "Parking P-02", floor: "B1" },
  { code: "P-03", name: "Parking P-03", floor: "B2" },
]);

const INITIAL_CONDITION_FIXTURE_ROOM_CODE = "203";

const CHECKIN_EXAMPLES = Object.freeze([
  Object.freeze({ key: "clean", confirmationNo: "ARR-CLEAN", displayName: "Arrival Clean Example",
    roomCode: "101", condition: "clean" as const, hasIdentityDocument: true }),
  Object.freeze({ key: "dirty", confirmationNo: "ARR-DIRTY", displayName: "Arrival Dirty Example",
    roomCode: "102", condition: "dirty" as const, hasIdentityDocument: true }),
  Object.freeze({ key: "unassigned", confirmationNo: "ARR-UNASSIGNED",
    displayName: "Arrival Unassigned Example", roomCode: null, condition: null,
    hasIdentityDocument: true }),
  Object.freeze({ key: "identity-gated", confirmationNo: "ARR-IDENTITY", displayName: "Arrival Identity Gate Example",
    roomCode: "G01", condition: "clean" as const, hasIdentityDocument: false }),
]);

const ARRIVAL_TRAVEL_EXAMPLES = Object.freeze([
  Object.freeze({
    key: "clean",
    mode: "flight" as const,
    carrier: "Air India",
    serviceNo: "AI141",
    scheduledAt: "2026-09-18T07:15:30.123456Z",
    pickupRequested: true,
  }),
  Object.freeze({
    key: "dirty",
    mode: "train" as const,
    carrier: "Indian Railways",
    serviceNo: "12952",
    scheduledAt: "2026-09-18T08:45:00.654321Z",
    pickupRequested: false,
  }),
]);

const DEPARTURE_TRAVEL_EXAMPLE = Object.freeze({
  mode: "flight" as const,
  carrier: "Air Canada",
  serviceNo: "AC43",
  scheduledAt: "2026-09-17T18:25:45.987654Z",
});

const PICKUP_TASK_DISPATCH_EXAMPLE = Object.freeze({
  mode: "car" as const,
  carrier: "Yellow Guest Transport",
  serviceNo: "PICKUP-OPEN-1",
  scheduledAt: "2026-09-18T09:30:00.123456Z",
  createdAt: "2026-09-17T12:00:00.000Z",
});

const HOUSEKEEPING_EXAMPLES = Object.freeze([
  Object.freeze({ key: "assigned-dirty", roomCode: "103", taskStatus: "assigned" as const,
    condition: "dirty" as const, conditionUpdatedAt: "2026-09-16T08:00:00.000Z",
    createdAt: "2026-09-15T12:00:00.000Z", dueAt: "2026-09-16T10:00:00.000Z",
    completedAt: null }),
  Object.freeze({ key: "done-clean", roomCode: "201", taskStatus: "done" as const,
    condition: "clean" as const, conditionUpdatedAt: "2026-09-16T09:00:00.000Z",
    createdAt: "2026-09-15T13:00:00.000Z", dueAt: "2026-09-16T11:00:00.000Z",
    completedAt: "2026-09-16T09:00:00.000Z" }),
]);

const HOUSEKEEPING_SHEET_FIXTURE = Object.freeze({
  roomCode: "202",
  confirmationNo: "HK-SHEET-ELIGIBLE",
  displayName: "Housekeeping Sheet Eligible Guest",
  sheetDate: "2026-09-18",
  stayStart: "2026-09-17T15:00:00.000Z",
  stayEnd: "2026-09-19T11:00:00.000Z",
  condition: "pickup" as const,
  conditionUpdatedAt: "2026-09-18T07:00:00.000Z",
  financialCreatedAt: "2026-09-17T14:00:00.000Z",
});

const CHECKOUT_COMMAND_FIXTURE = Object.freeze({
  confirmationNo: "CHECKOUT-READY",
  stayStart: "2025-09-18T15:00:00.000Z",
  stayEnd: HOUSEKEEPING_SHEET_FIXTURE.stayStart,
  financialCreatedAt: "2026-08-27T14:00:00.000Z",
});

const VEHICLE_EXAMPLES = Object.freeze([
  Object.freeze({
    key: "arrival",
    regNo: "DL01AB2048",
    make: "Tata",
    model: "Nexon EV",
    colour: "Midnight Blue",
    driverName: "Arrival Clean Example",
    enteredAt: "2026-09-18T06:30:00.000Z",
    exitedAt: null,
  }),
  Object.freeze({
    key: "departure",
    regNo: "ON-YLW-2026",
    make: "Toyota",
    model: "RAV4",
    colour: "Pearl White",
    driverName: "Housekeeping Sheet Eligible Guest",
    enteredAt: "2026-09-17T13:45:00.000Z",
    exitedAt: "2026-09-19T11:20:00.000Z",
  }),
  Object.freeze({
    key: "parking",
    regNo: "PARK-YLW-01",
    make: "Mahindra",
    model: "XUV400",
    colour: "Everest White",
    driverName: "Parking Assignment Guest",
    enteredAt: null,
    exitedAt: null,
  }),
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
  readonly companyPartyId: string;
  readonly agentPartyId: string;
  readonly companyReceivableAccountId: string;
  readonly agentReceivableAccountId: string;
  readonly unitTypes: { created: number; existing: number };
  readonly rooms: { created: number; existing: number };
  readonly sellableUnits: { created: number; existing: number };
}

interface ReviewCheckInExamples {
  readonly cleanReservationId: string;
  readonly dirtyReservationId: string;
  readonly unassignedReservationId: string;
  readonly unassignedSegmentId: string;
  readonly identityGatedReservationId: string;
  readonly identityGatePropertyId: string;
}

interface ReviewHousekeepingExamples {
  readonly assignedDirtyTaskId: string;
  readonly doneCleanTaskId: string;
  readonly attendantPartyId: string;
  readonly sheetDate: string;
  readonly eligibleReservationId: string;
  readonly eligibleSegmentId: string;
  readonly eligibleSpaceId: string;
  readonly eligibleSellableUnitId: string;
  readonly eligibleOccupancyId: string;
  readonly departureAccountId: string;
  readonly departureFolioId: string;
  readonly checkoutReservationId: string;
  readonly checkoutSegmentId: string;
  readonly checkoutOccupancyId: string;
  readonly checkoutFolioId: string;
}

interface ReviewVehicleExamples {
  readonly arrivalVehicleId: string;
  readonly departureVehicleId: string;
  readonly parkingVehicleId: string;
}

interface ReviewArrivalTravelExamples {
  readonly cleanTravelId: string;
  readonly dirtyTravelId: string;
}

interface ReviewDepartureTravelExamples {
  readonly checkoutTravelId: string;
}

interface ReviewPickupTaskDispatchExample {
  readonly reservationId: string;
  readonly travelId: string;
  readonly taskId: string;
  readonly staffPartyId: string;
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
  readonly checkInExamples: ReviewCheckInExamples;
  readonly housekeepingExamples: ReviewHousekeepingExamples;
  readonly vehicleExamples: ReviewVehicleExamples;
  readonly arrivalTravelExamples: ReviewArrivalTravelExamples;
  readonly departureTravelExamples: ReviewDepartureTravelExamples;
  readonly pickupTaskDispatchExample: ReviewPickupTaskDispatchExample;
  readonly conditionInitializationSpaceId: string;
}

export interface IdentityInventoryReviewSeedResult extends ReviewSeedBaseResult {
  readonly mode: "identity_inventory";
  readonly rate: null;
  readonly checkInExamples: null;
  readonly housekeepingExamples: null;
  readonly vehicleExamples: null;
  readonly arrivalTravelExamples: null;
  readonly departureTravelExamples: null;
  readonly pickupTaskDispatchExample: null;
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
  companyPartyId: string;
  agentPartyId: string;
  companyReceivableAccountId: string;
  agentReceivableAccountId: string;
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
    companyPartyId: await uuidV5(SEED_TENANT.id, REVIEW_COMPANY_PARTY_UUID),
    agentPartyId: await uuidV5(SEED_TENANT.id, REVIEW_AGENT_PARTY_UUID),
    companyReceivableAccountId: await uuidV5(SEED_TENANT.id, REVIEW_COMPANY_ACCOUNT_UUID),
    agentReceivableAccountId: await uuidV5(SEED_TENANT.id, REVIEW_AGENT_ACCOUNT_UUID),
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
  const receivableApprovePermissions = await connection<Array<{ code: string; description: string }>>`
    SELECT code, description FROM permission WHERE code = ${REVIEW_RECEIVABLE_APPROVE_PERMISSION.code}
  `;
  if (receivableApprovePermissions.length === 0) {
    await connection`INSERT INTO permission (code, description)
      VALUES (${REVIEW_RECEIVABLE_APPROVE_PERMISSION.code}, ${REVIEW_RECEIVABLE_APPROVE_PERMISSION.description})`;
  } else {
    exact(receivableApprovePermissions[0], REVIEW_RECEIVABLE_APPROVE_PERMISSION,
      "Receivable approve review permission");
  }
  const trustApprovePermissions = await connection<Array<{ code: string; description: string }>>`
    SELECT code, description FROM permission WHERE code = ${REVIEW_TRUST_NEGATIVE_APPROVE_PERMISSION.code}
  `;
  if (trustApprovePermissions.length === 0) {
    await connection`INSERT INTO permission (code, description)
      VALUES (${REVIEW_TRUST_NEGATIVE_APPROVE_PERMISSION.code},
        ${REVIEW_TRUST_NEGATIVE_APPROVE_PERMISSION.description})`;
  } else {
    exact(trustApprovePermissions[0], REVIEW_TRUST_NEGATIVE_APPROVE_PERMISSION,
      "Trust-negative approve review permission");
  }
  const dirtyRoomOverridePermissions = await connection<Array<{ code: string; description: string }>>`
    SELECT code, description FROM permission WHERE code = ${REVIEW_DIRTY_ROOM_OVERRIDE_PERMISSION.code}
  `;
  if (dirtyRoomOverridePermissions.length === 0) {
    await connection`INSERT INTO permission (code, description)
      VALUES (${REVIEW_DIRTY_ROOM_OVERRIDE_PERMISSION.code}, ${REVIEW_DIRTY_ROOM_OVERRIDE_PERMISSION.description})`;
  } else {
    exact(dirtyRoomOverridePermissions[0], REVIEW_DIRTY_ROOM_OVERRIDE_PERMISSION,
      "Dirty-room override review permission");
  }
  const housekeepingInspectPermissions = await connection<Array<{ code: string; description: string }>>`
    SELECT code, description FROM permission WHERE code = ${REVIEW_HOUSEKEEPING_INSPECT_PERMISSION.code}
  `;
  if (housekeepingInspectPermissions.length === 0) {
    await connection`INSERT INTO permission (code, description)
      VALUES (${REVIEW_HOUSEKEEPING_INSPECT_PERMISSION.code},
        ${REVIEW_HOUSEKEEPING_INSPECT_PERMISSION.description})`;
  } else {
    exact(housekeepingInspectPermissions[0], REVIEW_HOUSEKEEPING_INSPECT_PERMISSION,
      "Housekeeping inspect review permission");
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
  await connection`
    INSERT INTO role_permission (role_id, permission_code)
    VALUES (${approverRoleId}::uuid, ${REVIEW_RECEIVABLE_APPROVE_PERMISSION.code})
    ON CONFLICT (role_id, permission_code) DO NOTHING
  `;
  await connection`
    INSERT INTO role_permission (role_id, permission_code)
    VALUES (${approverRoleId}::uuid, ${REVIEW_TRUST_NEGATIVE_APPROVE_PERMISSION.code})
    ON CONFLICT (role_id, permission_code) DO NOTHING
  `;
  await connection`
    INSERT INTO role_permission (role_id, permission_code)
    VALUES (${approverRoleId}::uuid, ${REVIEW_DIRTY_ROOM_OVERRIDE_PERMISSION.code})
    ON CONFLICT (role_id, permission_code) DO NOTHING
  `;
  await connection`
    INSERT INTO role_permission (role_id, permission_code)
    VALUES (${approverRoleId}::uuid, ${REVIEW_HOUSEKEEPING_INSPECT_PERMISSION.code})
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

async function provisionReceivableTarget(
  connection: ReservedSQL,
  spec: Readonly<{
    partyId: string;
    accountId: string;
    displayName: string;
    legalName: string;
    partyRole: "company" | "agent";
    accountName: string;
    creditLimitMinor: bigint;
  }>,
): Promise<void> {
  const parties = await connection<Array<{
    id: string; tenant_id: string; kind: string; display_name: string; legal_name: string | null;
    attrs: unknown; vip_code: string | null; status: string; merged_into: string | null;
  }>>`
    SELECT id, tenant_id, kind, display_name, legal_name, attrs, vip_code, status, merged_into
    FROM party
    WHERE id=${spec.partyId}::uuid
       OR (tenant_id=${SEED_TENANT.id}::uuid AND display_name=${spec.displayName})
    ORDER BY id
  `;
  const expectedParty = {
    id: spec.partyId, tenant_id: SEED_TENANT.id, kind: "org", display_name: spec.displayName,
    legal_name: spec.legalName, attrs: { source: "local-review", direct_billing: true },
    vip_code: null, status: "active", merged_into: null,
  };
  if (parties.length === 0) {
    await connection`
      INSERT INTO party (id, tenant_id, kind, display_name, legal_name, attrs, status)
      VALUES (${spec.partyId}::uuid, ${SEED_TENANT.id}::uuid, 'org', ${spec.displayName},
        ${spec.legalName}, ${JSON.stringify(expectedParty.attrs)}::text::jsonb, 'active')
    `;
  } else {
    exact(parties[0], expectedParty, `Local-review ${spec.partyRole} party`);
    if (parties.length !== 1) throw new Error(`Local-review ${spec.partyRole} party is ambiguous`);
  }

  const roles = await connection<Array<{ tenant_id: string; party_id: string; role: string; detail: unknown }>>`
    SELECT tenant_id, party_id, role, detail
    FROM party_role
    WHERE tenant_id=${SEED_TENANT.id}::uuid AND party_id=${spec.partyId}::uuid AND role=${spec.partyRole}
  `;
  const expectedRole = {
    tenant_id: SEED_TENANT.id, party_id: spec.partyId, role: spec.partyRole,
    detail: { source: "local-review" },
  };
  if (roles.length === 0) {
    await connection`
      INSERT INTO party_role (tenant_id, party_id, role, detail)
      VALUES (${SEED_TENANT.id}::uuid, ${spec.partyId}::uuid, ${spec.partyRole},
        ${JSON.stringify(expectedRole.detail)}::text::jsonb)
    `;
  } else {
    exact(roles[0], expectedRole, `Local-review ${spec.partyRole} role`);
    if (roles.length !== 1) throw new Error(`Local-review ${spec.partyRole} role is ambiguous`);
  }

  const accounts = await connection<Array<{
    id: string; tenant_id: string; property_node: string | null; role: string;
    party_id: string | null; name: string; currency: string;
    credit_limit_minor: string | number | bigint | null; status: string;
  }>>`
    SELECT id, tenant_id, property_node, role, party_id, name, currency::text,
           credit_limit_minor, status
    FROM account
    WHERE id=${spec.accountId}::uuid
       OR (tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
           AND role='company' AND party_id=${spec.partyId}::uuid
           AND currency=${SEED_PROPERTY.currency})
    ORDER BY id
  `;
  const expectedAccount = {
    id: spec.accountId, tenant_id: SEED_TENANT.id, property_node: SEED_PROPERTY.id,
    role: "company", party_id: spec.partyId, name: spec.accountName,
    currency: SEED_PROPERTY.currency, credit_limit_minor: spec.creditLimitMinor.toString(), status: "open",
  };
  if (accounts.length === 0) {
    await connection`
      INSERT INTO account (
        id, tenant_id, property_node, role, party_id, name, currency, credit_limit_minor, status
      ) VALUES (
        ${spec.accountId}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid,
        'company', ${spec.partyId}::uuid, ${spec.accountName}, ${SEED_PROPERTY.currency},
        ${spec.creditLimitMinor}, 'open'
      )
    `;
  } else {
    const account = accounts[0];
    exact(account && { ...account,
      credit_limit_minor: account.credit_limit_minor === null ? null : BigInt(account.credit_limit_minor).toString(),
    }, expectedAccount, `Local-review ${spec.partyRole} receivable account`);
    if (accounts.length !== 1) throw new Error(`Local-review ${spec.partyRole} receivable account is ambiguous`);
  }
}

async function provisionReviewFinancials(
  connection: ReservedSQL,
  folioSeriesId: string,
  revenueAccountId: string,
  cashAccountId: string,
  cashDrawerId: string,
  companyPartyId: string,
  agentPartyId: string,
  companyReceivableAccountId: string,
  agentReceivableAccountId: string,
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

  await provisionReceivableTarget(connection, {
    partyId: companyPartyId,
    accountId: companyReceivableAccountId,
    displayName: "Northstar Consulting",
    legalName: "Northstar Consulting Limited",
    partyRole: "company",
    accountName: "Northstar Consulting Receivable",
    creditLimitMinor: 500000n,
  });
  await provisionReceivableTarget(connection, {
    partyId: agentPartyId,
    accountId: agentReceivableAccountId,
    displayName: "Horizon Travel",
    legalName: "Horizon Travel Services Limited",
    partyRole: "agent",
    accountName: "Horizon Travel Receivable",
    creditLimitMinor: 250000n,
  });

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

  const ownerPartyId = await uuidV5(SEED_TENANT.id, "yellow.local.review.owner-trust.party");
  const trustAccountId = await uuidV5(SEED_TENANT.id, "yellow.local.review.owner-trust.account");
  const payableAccountId = await uuidV5(SEED_TENANT.id, "yellow.local.review.owner-payable.account");
  await connection`
    INSERT INTO party(id,tenant_id,kind,display_name,attrs,status)
    VALUES(${ownerPartyId}::uuid,${SEED_TENANT.id}::uuid,'org','Yellow Review Owner',
      '{"source":"local-review"}'::jsonb,'active')
    ON CONFLICT (id) DO NOTHING
  `;
  await connection`
    INSERT INTO party_role(tenant_id,party_id,role,detail)
    VALUES(${SEED_TENANT.id}::uuid,${ownerPartyId}::uuid,'owner','{"source":"local-review"}'::jsonb)
    ON CONFLICT (party_id,role) DO NOTHING
  `;
  await connection`
    INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status)
    VALUES
      (${trustAccountId}::uuid,${SEED_TENANT.id}::uuid,${SEED_PROPERTY.id}::uuid,'trust',
       ${ownerPartyId}::uuid,'Yellow Review Owner Trust',${SEED_PROPERTY.currency},'open'),
      (${payableAccountId}::uuid,${SEED_TENANT.id}::uuid,${SEED_PROPERTY.id}::uuid,'payable',
       NULL,'Yellow Review Owner Payable',${SEED_PROPERTY.currency},'open')
    ON CONFLICT (id) DO NOTHING
  `;
  const trustTruth = await connection<Array<{ parties:number;roles:number;accounts:number }>>`
    SELECT
      (SELECT count(*)::int FROM party WHERE tenant_id=${SEED_TENANT.id}::uuid
        AND id=${ownerPartyId}::uuid AND kind='org' AND display_name='Yellow Review Owner'
        AND attrs='{"source":"local-review"}'::jsonb AND status='active') parties,
      (SELECT count(*)::int FROM party_role WHERE tenant_id=${SEED_TENANT.id}::uuid
        AND party_id=${ownerPartyId}::uuid AND role='owner' AND detail='{"source":"local-review"}'::jsonb) roles,
      (SELECT count(*)::int FROM account WHERE tenant_id=${SEED_TENANT.id}::uuid
        AND property_node=${SEED_PROPERTY.id}::uuid AND currency=${SEED_PROPERTY.currency}
        AND status='open' AND ((id=${trustAccountId}::uuid AND role='trust' AND party_id=${ownerPartyId}::uuid
          AND name='Yellow Review Owner Trust') OR (id=${payableAccountId}::uuid AND role='payable'
          AND party_id IS NULL AND name='Yellow Review Owner Payable'))) accounts
  `;
  exact(trustTruth[0], { parties:1, roles:1, accounts:2 }, "Local-review owner-trust configuration");
  await connection`
    INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,debit_account_id,credit_account_id)
    VALUES(${SEED_TENANT.id}::uuid,${SEED_PROPERTY.id}::uuid,${SEED_PROPERTY.currency},
      'OWNER_TRUST_EXPENSE',${trustAccountId}::uuid,${payableAccountId}::uuid)
    ON CONFLICT (tenant_id,property_node,currency,tx_code) DO NOTHING
  `;
  const trustRoute = await connection<Array<{ debit_account_id:string|null;credit_account_id:string|null }>>`
    SELECT debit_account_id,credit_account_id FROM tx_code_route
    WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
      AND currency=${SEED_PROPERTY.currency} AND tx_code='OWNER_TRUST_EXPENSE'
  `;
  exact(trustRoute, [{ debit_account_id:trustAccountId, credit_account_id:payableAccountId }],
    "Local-review owner-trust route");

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

function parkingShape(item: Space, spec: typeof PARKING_SPACES[number]): void {
  exact({
    tenantId: item.tenantId, propertyNode: item.propertyNode, code: item.code,
    profileKey: item.profileKey, capacity: item.capacity, maxOccupancy: item.maxOccupancy,
    floor: item.floor, areaSqm: item.areaSqm, genderPolicy: item.genderPolicy,
    attrs: item.attrs, status: item.status,
  }, {
    tenantId: SEED_TENANT.id, propertyNode: SEED_PROPERTY.id, code: spec.code,
    profileKey: "parking", capacity: 1, maxOccupancy: null, floor: spec.floor,
    areaSqm: null, genderPolicy: "any",
    attrs: { source: "local-review", name: spec.name }, status: "active",
  }, `Parking space ${spec.code}`);
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

async function provisionCheckInExamples(
  connection: ReservedSQL,
  ratePlanId: string,
  userId: string,
  approverUserId: string,
  roleId: string,
  approverRoleId: string,
  unitTypes: ReadonlyMap<string, UnitType>,
  spaces: ReadonlyMap<string, Space>,
  sellableUnits: ReadonlyMap<string, SellableUnit>,
): Promise<ReviewCheckInExamples> {
  await connection`SELECT pg_advisory_xact_lock(hashtextextended('yellow.local.review.seed.checkin', 0))`;

  const identityPropertyId = await uuidV5(SEED_TENANT.id, `${REVIEW_CHECKIN_FIXTURE_UUID}/identity-property`);
  const identityPropertyPath = "yellow_demo.review_identity";
  const identityPropertyConfig = Object.freeze({ statutory_adapter_key: REVIEW_STATUTORY_ADAPTER_KEY });
  const identityPropertyRows = await connection<Array<Record<string, unknown>>>`
    SELECT id, tenant_id, path::text, kind, name, timezone, currency::text, config
    FROM org_node
    WHERE id=${identityPropertyId}::uuid
       OR (tenant_id=${SEED_TENANT.id}::uuid AND path=${identityPropertyPath}::ltree)
    ORDER BY id FOR UPDATE
  `;
  const expectedIdentityProperty = { id: identityPropertyId, tenant_id: SEED_TENANT.id,
    path: identityPropertyPath, kind: "property", name: "Yellow Identity Gate Review Property",
    timezone: "UTC", currency: "USD", config: identityPropertyConfig };
  if (identityPropertyRows.length === 0) {
    await connection`INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency, config)
      VALUES (${identityPropertyId}::uuid, ${SEED_TENANT.id}::uuid, ${identityPropertyPath}::ltree,
        'property', 'Yellow Identity Gate Review Property', 'UTC', 'USD',
        ${JSON.stringify(identityPropertyConfig)}::text::jsonb)`;
  } else {
    exact(identityPropertyRows[0], expectedIdentityProperty, "Local-review identity-gate property");
    if (identityPropertyRows.length !== 1) throw new Error("Local-review identity-gate property is ambiguous");
  }

  for (const grant of [
    { userId, roleId },
    { userId: approverUserId, roleId },
    { userId: approverUserId, roleId: approverRoleId },
  ]) {
    await connection`INSERT INTO user_role (tenant_id, user_id, role_id, scope_node)
      VALUES (${SEED_TENANT.id}::uuid, ${grant.userId}::uuid, ${grant.roleId}::uuid,
        ${identityPropertyId}::uuid)
      ON CONFLICT (user_id, role_id, scope_node) DO NOTHING`;
  }

  const identityUnitTypeId = await uuidV5(SEED_TENANT.id, `${REVIEW_CHECKIN_FIXTURE_UUID}/identity-property/unit-type`);
  const identitySpaceId = await uuidV5(SEED_TENANT.id, `${REVIEW_CHECKIN_FIXTURE_UUID}/identity-property/space`);
  const identitySellableId = await uuidV5(SEED_TENANT.id, `${REVIEW_CHECKIN_FIXTURE_UUID}/identity-property/sellable`);
  const identityRatePlanId = await uuidV5(SEED_TENANT.id, `${REVIEW_CHECKIN_FIXTURE_UUID}/identity-property/rate-plan`);
  await connection`INSERT INTO unit_type
      (id, tenant_id, property_node, code, name, profile_key, base_occupancy, max_occupancy, attrs, sort_order)
    VALUES (${identityUnitTypeId}::uuid, ${SEED_TENANT.id}::uuid, ${identityPropertyId}::uuid,
      'GATE', 'Identity Gate Review Room', 'hotel', 1, 1,
      '{"source":"local-review-checkin"}'::jsonb, 10)
    ON CONFLICT (tenant_id, property_node, code) DO NOTHING`;
  await connection`INSERT INTO space
      (id, tenant_id, property_node, code, profile_key, capacity, floor, attrs, status)
    VALUES (${identitySpaceId}::uuid, ${SEED_TENANT.id}::uuid, ${identityPropertyId}::uuid,
      'G01', 'hotel', 1, 'G', '{"source":"local-review-checkin"}'::jsonb, 'active')
    ON CONFLICT (tenant_id, property_node, code) DO NOTHING`;
  await connection`INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name, status)
    VALUES (${identitySellableId}::uuid, ${SEED_TENANT.id}::uuid, ${identityUnitTypeId}::uuid,
      'Identity Gate Review Room G01', 'active')
    ON CONFLICT (id) DO NOTHING`;
  await connection`INSERT INTO sellable_unit_space
      (tenant_id, sellable_unit_id, space_id, claim_mode)
    VALUES (${SEED_TENANT.id}::uuid, ${identitySellableId}::uuid, ${identitySpaceId}::uuid, 'exclusive')
    ON CONFLICT (sellable_unit_id, space_id) DO NOTHING`;
  await connection`INSERT INTO rate_plan
      (id, tenant_id, property_node, code, name, currency, tax_inclusive, status)
    VALUES (${identityRatePlanId}::uuid, ${SEED_TENANT.id}::uuid, ${identityPropertyId}::uuid,
      'ARRIVAL-REVIEW', 'Arrival readiness review rate', 'USD', true, 'active')
    ON CONFLICT (tenant_id, property_node, code) DO NOTHING`;

  const adapterId = await uuidV5(SEED_TENANT.id, `${REVIEW_CHECKIN_FIXTURE_UUID}/statutory-adapter`);
  const adapterContent = Object.freeze({
    country: "ZZ",
    adapter_key: "recorded-identity-demo",
    schedule: "on_checkin",
    required_identity_fields: Object.freeze(["identity_document"]),
    transport: "rest",
    format: "local-review-only",
  });
  const adapterRows = await connection<Array<{
    id: string; tenant_id: string | null; type: string; key: string; version: number;
    content: unknown; status: string; effective_now: boolean;
  }>>`
    SELECT id, tenant_id, type, key, version, content, status, effective @> CURRENT_TIMESTAMP AS effective_now
    FROM extension
    WHERE id=${adapterId}::uuid
       OR (tenant_id=${SEED_TENANT.id}::uuid AND type='statutory_adapter'
           AND key=${REVIEW_STATUTORY_ADAPTER_KEY} AND version=1)
    ORDER BY id
    FOR UPDATE
  `;
  const expectedAdapter = {
    id: adapterId, tenant_id: SEED_TENANT.id, type: "statutory_adapter",
    key: REVIEW_STATUTORY_ADAPTER_KEY, version: 1, content: adapterContent,
    status: "active", effective_now: true,
  };
  if (adapterRows.length === 0) {
    await connection`
      INSERT INTO extension (id, tenant_id, type, key, version, effective, content, status)
      VALUES (${adapterId}::uuid, ${SEED_TENANT.id}::uuid, 'statutory_adapter',
        ${REVIEW_STATUTORY_ADAPTER_KEY}, 1,
        tstzrange('2020-01-01T00:00:00Z'::timestamptz, NULL, '[)'),
        ${JSON.stringify(adapterContent)}::text::jsonb, 'active')
    `;
  } else {
    exact(adapterRows[0], expectedAdapter, "Local-review statutory adapter");
    if (adapterRows.length !== 1) throw new Error("Local-review statutory adapter is ambiguous");
  }

  const result: Record<string, string> = {};
  let unassignedSegmentId: string | undefined;
  for (const spec of CHECKIN_EXAMPLES) {
    const identityGated = spec.key === "identity-gated";
    const baseUnitType = unitTypes.get("STD");
    const baseSpace = spec.roomCode === null ? undefined : spaces.get(spec.roomCode);
    const baseSellableUnit = spec.roomCode === null ? undefined : sellableUnits.get(spec.roomCode);
    if (!identityGated && (!baseUnitType || (spec.roomCode !== null && (!baseSpace || !baseSellableUnit)))) {
      throw new Error(`Local-review check-in inventory is absent for room ${spec.roomCode}`);
    }
    const propertyNode = identityGated ? identityPropertyId : SEED_PROPERTY.id;
    const unitTypeId = identityGated ? identityUnitTypeId : baseUnitType!.id;
    const spaceId = identityGated ? identitySpaceId : baseSpace?.id ?? null;
    const sellableUnitId = identityGated ? identitySellableId : baseSellableUnit?.id ?? null;
    const fixtureRatePlanId = identityGated ? identityRatePlanId : ratePlanId;
    const base = `${REVIEW_CHECKIN_FIXTURE_UUID}/${spec.key}`;
    const partyId = await uuidV5(SEED_TENANT.id, `${base}/party`);
    const accountId = await uuidV5(SEED_TENANT.id, `${base}/account`);
    const reservationId = await uuidV5(SEED_TENANT.id, `${base}/reservation`);
    const segmentId = await uuidV5(SEED_TENANT.id, `${base}/segment`);
    const folioId = await uuidV5(SEED_TENANT.id, `${base}/folio`);
    const identityDocumentId = await uuidV5(SEED_TENANT.id, `${base}/identity-document`);

    const partyRows = await connection<Array<{
      id: string; tenant_id: string; kind: string; display_name: string; legal_name: string | null;
      attrs: unknown; vip_code: string | null; status: string; merged_into: string | null;
    }>>`
      SELECT id, tenant_id, kind, display_name, legal_name, attrs, vip_code, status, merged_into
      FROM party WHERE id=${partyId}::uuid ORDER BY id FOR UPDATE
    `;
    const expectedParty = { id: partyId, tenant_id: SEED_TENANT.id, kind: "person",
      display_name: spec.displayName, legal_name: spec.displayName,
      attrs: { source: "local-review", checkin_example: spec.key }, vip_code: null,
      status: "active", merged_into: null };
    if (partyRows.length === 0) {
      await connection`
        INSERT INTO party (id, tenant_id, kind, display_name, legal_name, attrs, status)
        VALUES (${partyId}::uuid, ${SEED_TENANT.id}::uuid, 'person', ${spec.displayName},
          ${spec.displayName}, ${JSON.stringify(expectedParty.attrs)}::text::jsonb, 'active')
      `;
    } else exact(partyRows[0], expectedParty, `Local-review ${spec.key} arrival party`);

    const guestRoles = await connection<Array<{ tenant_id: string; party_id: string; role: string; detail: unknown }>>`
      SELECT tenant_id, party_id, role, detail FROM party_role
      WHERE party_id=${partyId}::uuid AND role='guest'
    `;
    const expectedGuestRole = { tenant_id: SEED_TENANT.id, party_id: partyId, role: "guest",
      detail: { source: "local-review", checkin_example: spec.key } };
    if (guestRoles.length === 0) {
      await connection`INSERT INTO party_role (tenant_id, party_id, role, detail)
        VALUES (${SEED_TENANT.id}::uuid, ${partyId}::uuid, 'guest',
          ${JSON.stringify(expectedGuestRole.detail)}::text::jsonb)`;
    } else exact(guestRoles[0], expectedGuestRole, `Local-review ${spec.key} guest role`);

    const reservationRows = await connection<Array<Record<string, unknown>>>`
      SELECT id, tenant_id, property_node, confirmation_no, status, primary_party,
             booker_party, group_id, channel_code, currency::text, guarantee_policy
      FROM reservation
      WHERE id=${reservationId}::uuid
         OR (tenant_id=${SEED_TENANT.id}::uuid AND confirmation_no=${spec.confirmationNo})
      ORDER BY id FOR UPDATE
    `;
    const expectedReservation = { id: reservationId, tenant_id: SEED_TENANT.id,
      property_node: propertyNode, confirmation_no: spec.confirmationNo, status: "due_in",
      primary_party: partyId, booker_party: null, group_id: null, channel_code: "direct",
      currency: SEED_PROPERTY.currency, guarantee_policy: null };
    if (reservationRows.length === 0) {
      await connection`
        INSERT INTO reservation (id, tenant_id, property_node, confirmation_no, status,
          primary_party, channel_code, currency, notes)
        VALUES (${reservationId}::uuid, ${SEED_TENANT.id}::uuid, ${propertyNode}::uuid,
          ${spec.confirmationNo}, 'due_in', ${partyId}::uuid, 'direct', ${SEED_PROPERTY.currency},
          ${`Local-review ${spec.key} check-in readiness example`})
      `;
    } else {
      exact(reservationRows[0], expectedReservation, `Local-review ${spec.key} arrival reservation`);
      if (reservationRows.length !== 1) throw new Error(`Local-review ${spec.key} arrival reservation is ambiguous`);
    }

    const segmentRows = await connection<Array<Record<string, unknown>>>`
      SELECT id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id,
             lower(period)='2020-01-01T00:00:00Z'::timestamptz AS exact_start,
             upper(period)='2100-01-01T00:00:00Z'::timestamptz AS exact_end,
             adults, children, rate_plan_id, price_override, status
      FROM reservation_segment WHERE id=${segmentId}::uuid FOR UPDATE
    `;
    const expectedSegment = { id: segmentId, tenant_id: SEED_TENANT.id,
      reservation_id: reservationId, seq: 1, unit_type_id: unitTypeId,
      sellable_unit_id: sellableUnitId, exact_start: true, exact_end: true,
      adults: 1, children: [], rate_plan_id: fixtureRatePlanId, price_override: null, status: "booked" };
    if (segmentRows.length === 0) {
      await connection`
        INSERT INTO reservation_segment (id, tenant_id, reservation_id, seq, unit_type_id,
          sellable_unit_id, period, adults, children, rate_plan_id, status)
        VALUES (${segmentId}::uuid, ${SEED_TENANT.id}::uuid, ${reservationId}::uuid, 1,
          ${unitTypeId}::uuid, ${sellableUnitId}::uuid,
          tstzrange('2020-01-01T00:00:00Z'::timestamptz, '2100-01-01T00:00:00Z'::timestamptz, '[)'),
          1, '[]'::jsonb, ${fixtureRatePlanId}::uuid, 'booked')
      `;
    } else exact(segmentRows[0], expectedSegment, `Local-review ${spec.key} arrival segment`);

    const reservationGuests = await connection<Array<{ tenant_id: string; reservation_id: string; party_id: string; role: string; share_pct: string | null }>>`
      SELECT tenant_id, reservation_id, party_id, role, share_pct::text
      FROM reservation_guest WHERE reservation_id=${reservationId}::uuid AND party_id=${partyId}::uuid
    `;
    const expectedReservationGuest = { tenant_id: SEED_TENANT.id, reservation_id: reservationId,
      party_id: partyId, role: "primary", share_pct: null };
    if (reservationGuests.length === 0) {
      await connection`INSERT INTO reservation_guest (tenant_id, reservation_id, party_id, role)
        VALUES (${SEED_TENANT.id}::uuid, ${reservationId}::uuid, ${partyId}::uuid, 'primary')`;
    } else exact(reservationGuests[0], expectedReservationGuest, `Local-review ${spec.key} reservation guest`);

    const accountRows = await connection<Array<Record<string, unknown>>>`
      SELECT id, tenant_id, property_node, role, party_id, name, currency::text,
             credit_limit_minor::text, status
      FROM account WHERE id=${accountId}::uuid FOR UPDATE
    `;
    const accountName = `${spec.displayName} Guest Ledger`;
    const expectedAccount = { id: accountId, tenant_id: SEED_TENANT.id,
      property_node: propertyNode, role: "guest", party_id: partyId, name: accountName,
      currency: SEED_PROPERTY.currency, credit_limit_minor: null, status: "open" };
    if (accountRows.length === 0) {
      await connection`INSERT INTO account (id, tenant_id, property_node, role, party_id, name, currency, status)
        VALUES (${accountId}::uuid, ${SEED_TENANT.id}::uuid, ${propertyNode}::uuid,
          'guest', ${partyId}::uuid, ${accountName}, ${SEED_PROPERTY.currency}, 'open')`;
    } else exact(accountRows[0], expectedAccount, `Local-review ${spec.key} guest account`);

    const folioRows = await connection<Array<Record<string, unknown>>>`
      SELECT id, tenant_id, account_id, reservation_id, folio_no, window_no, name, status
      FROM folio WHERE id=${folioId}::uuid OR
        (tenant_id=${SEED_TENANT.id}::uuid AND folio_no=${`ARR-${spec.key.toUpperCase()}-1`})
      ORDER BY id FOR UPDATE
    `;
    const folioNo = `ARR-${spec.key.toUpperCase()}-1`;
    const expectedFolio = { id: folioId, tenant_id: SEED_TENANT.id, account_id: accountId,
      reservation_id: reservationId, folio_no: folioNo, window_no: 1,
      name: "Primary", status: "open" };
    if (folioRows.length === 0) {
      await connection`INSERT INTO folio (id, tenant_id, account_id, reservation_id, folio_no, window_no, name, status)
        VALUES (${folioId}::uuid, ${SEED_TENANT.id}::uuid, ${accountId}::uuid,
          ${reservationId}::uuid, ${folioNo}, 1, 'Primary', 'open')`;
    } else {
      exact(folioRows[0], expectedFolio, `Local-review ${spec.key} primary folio`);
      if (folioRows.length !== 1) throw new Error(`Local-review ${spec.key} primary folio is ambiguous`);
    }

    if (spaceId !== null && spec.condition !== null) {
      const conditionRows = await connection<Array<{ tenant_id: string; space_id: string; condition: string; updated_by: string | null }>>`
        SELECT tenant_id, space_id, condition, updated_by FROM unit_condition WHERE space_id=${spaceId}::uuid FOR UPDATE
      `;
      const expectedCondition = { tenant_id: SEED_TENANT.id, space_id: spaceId,
        condition: spec.condition, updated_by: userId };
      if (conditionRows.length === 0) {
        await connection`INSERT INTO unit_condition (tenant_id, space_id, condition, updated_by)
          VALUES (${SEED_TENANT.id}::uuid, ${spaceId}::uuid, ${spec.condition}, ${userId}::uuid)`;
      } else exact(conditionRows[0], expectedCondition, `Local-review room ${spec.roomCode} condition`);
    }

    const identityDocuments = await connection<Array<Record<string, unknown>>>`
      SELECT id, tenant_id, party_id, kind, number_enc, issuing_country::text, expiry::text, scan_ref
      FROM identity_document WHERE party_id=${partyId}::uuid ORDER BY id FOR UPDATE
    `;
    if (spec.hasIdentityDocument) {
      const expectedIdentityDocument = { id: identityDocumentId, tenant_id: SEED_TENANT.id,
        party_id: partyId, kind: "passport", number_enc: `local-review:${spec.key}:recorded`,
        issuing_country: "ZZ", expiry: "2099-12-31", scan_ref: null };
      if (identityDocuments.length === 0) {
        await connection`INSERT INTO identity_document
          (id, tenant_id, party_id, kind, number_enc, issuing_country, expiry)
          VALUES (${identityDocumentId}::uuid, ${SEED_TENANT.id}::uuid, ${partyId}::uuid,
            'passport', ${expectedIdentityDocument.number_enc}, 'ZZ', '2099-12-31'::date)`;
      } else {
        exact(identityDocuments[0], expectedIdentityDocument, `Local-review ${spec.key} identity evidence`);
        if (identityDocuments.length !== 1) throw new Error(`Local-review ${spec.key} identity evidence is ambiguous`);
      }
    } else if (identityDocuments.length !== 0) {
      throw new Error("Local-review identity-gated example must have no recorded identity document");
    }

    result[spec.key] = reservationId;
    if (spec.key === "unassigned") unassignedSegmentId = segmentId;
  }

  return Object.freeze({
    cleanReservationId: result.clean!,
    dirtyReservationId: result.dirty!,
    unassignedReservationId: result.unassigned!,
    unassignedSegmentId: unassignedSegmentId!,
    identityGatedReservationId: result["identity-gated"]!,
    identityGatePropertyId: identityPropertyId,
  });
}

async function provisionArrivalTravelExamples(
  connection: ReservedSQL,
  checkInExamples: ReviewCheckInExamples,
): Promise<ReviewArrivalTravelExamples> {
  await connection`SELECT pg_advisory_xact_lock(hashtextextended('yellow.local.review.seed.arrival-travel', 0))`;
  const reservationIds = Object.freeze({
    clean: checkInExamples.cleanReservationId,
    dirty: checkInExamples.dirtyReservationId,
  });
  const result: Record<string, string> = {};

  for (const spec of ARRIVAL_TRAVEL_EXAMPLES) {
    const reservationId = reservationIds[spec.key];
    const reservations = await connection<Array<{
      id: string; tenant_id: string; property_node: string; status: string;
    }>>`
      SELECT id, tenant_id, property_node, status
      FROM reservation
      WHERE id=${reservationId}::uuid
      FOR UPDATE
    `;
    const reservation = reservations[0];
    if (!reservation || reservations.length !== 1 || reservation.tenant_id !== SEED_TENANT.id ||
        reservation.property_node !== SEED_PROPERTY.id || reservation.status !== "due_in") {
      throw new Error(`Local-review ${spec.key} arrival travel reservation is absent or inconsistent`);
    }

    const travelId = await uuidV5(
      SEED_TENANT.id,
      `${REVIEW_ARRIVAL_TRAVEL_FIXTURE_UUID}/${spec.key}`,
    );
    const rows = await connection<Array<Record<string, unknown>>>`
      SELECT id, tenant_id, reservation_id, direction, mode, carrier, service_no,
             scheduled_at=${spec.scheduledAt}::timestamptz AS exact_scheduled_at,
             pickup_requested, pickup_task_id, notes
      FROM travel_detail
      WHERE id=${travelId}::uuid
         OR (tenant_id=${SEED_TENANT.id}::uuid AND reservation_id=${reservationId}::uuid
             AND direction='arrival')
      ORDER BY id
      FOR UPDATE
    `;
    const expected = {
      id: travelId,
      tenant_id: SEED_TENANT.id,
      reservation_id: reservationId,
      direction: "arrival",
      mode: spec.mode,
      carrier: spec.carrier,
      service_no: spec.serviceNo,
      exact_scheduled_at: true,
      pickup_requested: spec.pickupRequested,
      pickup_task_id: null,
      notes: null,
    };
    if (rows.length === 0) {
      await connection`
        INSERT INTO travel_detail (
          id, tenant_id, reservation_id, direction, mode, carrier, service_no,
          scheduled_at, pickup_requested
        ) VALUES (
          ${travelId}::uuid, ${SEED_TENANT.id}::uuid, ${reservationId}::uuid,
          'arrival', ${spec.mode}, ${spec.carrier}, ${spec.serviceNo},
          ${spec.scheduledAt}::timestamptz, ${spec.pickupRequested}
        )
      `;
    } else {
      exact(rows[0], expected, `Local-review ${spec.key} arrival travel`);
      if (rows.length !== 1) throw new Error(`Local-review ${spec.key} arrival travel is ambiguous`);
    }
    result[spec.key] = travelId;
  }

  return Object.freeze({
    cleanTravelId: result.clean!,
    dirtyTravelId: result.dirty!,
  });
}

async function provisionDepartureTravelExamples(
  connection: ReservedSQL,
  housekeepingExamples: ReviewHousekeepingExamples,
): Promise<ReviewDepartureTravelExamples> {
  await connection`SELECT pg_advisory_xact_lock(hashtextextended('yellow.local.review.seed.departure-travel', 0))`;
  const reservationId = housekeepingExamples.checkoutReservationId;
  const reservations = await connection<Array<{
    id: string; tenant_id: string; property_node: string; status: string;
    confirmation_no: string;
  }>>`
    SELECT id, tenant_id, property_node, status, confirmation_no
    FROM reservation
    WHERE id=${reservationId}::uuid
    FOR UPDATE
  `;
  const reservation = reservations[0];
  if (!reservation || reservations.length !== 1 || reservation.tenant_id !== SEED_TENANT.id ||
      reservation.property_node !== SEED_PROPERTY.id || reservation.status !== "due_out" ||
      reservation.confirmation_no !== CHECKOUT_COMMAND_FIXTURE.confirmationNo) {
    throw new Error("Local-review checkout-ready departure travel reservation is absent or inconsistent");
  }

  const travelId = await uuidV5(SEED_TENANT.id, REVIEW_DEPARTURE_TRAVEL_FIXTURE_UUID);
  const rows = await connection<Array<Record<string, unknown>>>`
    SELECT id, tenant_id, reservation_id, direction, mode, carrier, service_no,
           scheduled_at=${DEPARTURE_TRAVEL_EXAMPLE.scheduledAt}::timestamptz AS exact_scheduled_at,
           pickup_requested, pickup_task_id, notes
    FROM travel_detail
    WHERE id=${travelId}::uuid
       OR (tenant_id=${SEED_TENANT.id}::uuid AND reservation_id=${reservationId}::uuid
           AND direction='departure')
    ORDER BY id
    FOR UPDATE
  `;
  const expected = {
    id: travelId,
    tenant_id: SEED_TENANT.id,
    reservation_id: reservationId,
    direction: "departure",
    mode: DEPARTURE_TRAVEL_EXAMPLE.mode,
    carrier: DEPARTURE_TRAVEL_EXAMPLE.carrier,
    service_no: DEPARTURE_TRAVEL_EXAMPLE.serviceNo,
    exact_scheduled_at: true,
    pickup_requested: false,
    pickup_task_id: null,
    notes: null,
  };
  if (rows.length === 0) {
    await connection`
      INSERT INTO travel_detail (
        id, tenant_id, reservation_id, direction, mode, carrier, service_no,
        scheduled_at, pickup_requested, pickup_task_id, notes
      ) VALUES (
        ${travelId}::uuid, ${SEED_TENANT.id}::uuid, ${reservationId}::uuid,
        'departure', ${DEPARTURE_TRAVEL_EXAMPLE.mode}, ${DEPARTURE_TRAVEL_EXAMPLE.carrier},
        ${DEPARTURE_TRAVEL_EXAMPLE.serviceNo},
        ${DEPARTURE_TRAVEL_EXAMPLE.scheduledAt}::timestamptz, false, NULL, NULL
      )
    `;
  } else {
    exact(rows[0], expected, "Local-review checkout-ready departure travel");
    if (rows.length !== 1) {
      throw new Error("Local-review checkout-ready departure travel is ambiguous");
    }
  }

  return Object.freeze({ checkoutTravelId: travelId });
}

async function provisionPickupTaskDispatchExample(
  connection: ReservedSQL,
  checkInExamples: ReviewCheckInExamples,
  housekeepingExamples: ReviewHousekeepingExamples,
): Promise<ReviewPickupTaskDispatchExample> {
  await connection`SELECT pg_advisory_xact_lock(hashtextextended('yellow.local.review.seed.pickup-task-dispatch', 0))`;
  const reservationId = checkInExamples.identityGatedReservationId;
  const propertyNode = checkInExamples.identityGatePropertyId;
  const staffPartyId = housekeepingExamples.attendantPartyId;
  const travelId = await uuidV5(SEED_TENANT.id, `${REVIEW_PICKUP_TASK_DISPATCH_FIXTURE_UUID}/travel`);
  const taskId = await uuidV5(SEED_TENANT.id, `${REVIEW_PICKUP_TASK_DISPATCH_FIXTURE_UUID}/task`);

  const reservations = await connection<Array<{
    id: string; tenant_id: string; property_node: string; status: string;
  }>>`
    SELECT id, tenant_id, property_node, status
    FROM reservation
    WHERE id=${reservationId}::uuid
    FOR UPDATE
  `;
  const reservation = reservations[0];
  if (!reservation || reservations.length !== 1 || reservation.tenant_id !== SEED_TENANT.id ||
      reservation.property_node !== propertyNode || reservation.status !== "due_in") {
    throw new Error("Local-review pickup dispatch reservation is absent or inconsistent");
  }

  const staff = await connection<Array<{
    id: string; tenant_id: string; status: string; role: string | null;
  }>>`
    SELECT party.id, party.tenant_id, party.status, role.role
    FROM party
    LEFT JOIN party_role AS role
      ON role.tenant_id=party.tenant_id AND role.party_id=party.id AND role.role='staff'
    WHERE party.id=${staffPartyId}::uuid
    FOR UPDATE OF party
  `;
  if (staff.length !== 1 || staff[0]?.tenant_id !== SEED_TENANT.id ||
      staff[0]?.status !== "active" || staff[0]?.role !== "staff") {
    throw new Error("Local-review pickup dispatch staff candidate is absent or inconsistent");
  }

  const payload = Object.freeze({ requestType: "arrival_pickup" });
  const taskRows = await connection<Array<Record<string, unknown>>>`
    SELECT id, tenant_id, property_node, kind, status, subject_type, subject_id,
           assignee_party, department,
           scheduled.due_at, priority, credits, sheet_id, payload,
           scheduled.created_at, completed_at
    FROM task
    CROSS JOIN LATERAL (
      SELECT
        task.due_at=${PICKUP_TASK_DISPATCH_EXAMPLE.scheduledAt}::timestamptz AS due_at,
        task.created_at=${PICKUP_TASK_DISPATCH_EXAMPLE.createdAt}::timestamptz AS created_at
    ) AS scheduled
    WHERE id=${taskId}::uuid
    FOR UPDATE OF task
  `;
  const expectedTask = {
    id: taskId, tenant_id: SEED_TENANT.id, property_node: propertyNode,
    kind: "guest_request", status: "open", subject_type: "reservation",
    subject_id: reservationId, assignee_party: null, department: "transport",
    due_at: true, priority: 3, credits: null, sheet_id: null, payload,
    created_at: true, completed_at: null,
  };
  if (taskRows.length === 0) {
    await connection`
      INSERT INTO task (
        id, tenant_id, property_node, kind, status, subject_type, subject_id,
        assignee_party, department, due_at, priority, credits, sheet_id, payload,
        created_at, completed_at
      ) VALUES (
        ${taskId}::uuid, ${SEED_TENANT.id}::uuid, ${propertyNode}::uuid,
        'guest_request', 'open', 'reservation', ${reservationId}::uuid,
        NULL, 'transport', ${PICKUP_TASK_DISPATCH_EXAMPLE.scheduledAt}::timestamptz,
        3, NULL, NULL, ${JSON.stringify(payload)}::text::jsonb,
        ${PICKUP_TASK_DISPATCH_EXAMPLE.createdAt}::timestamptz, NULL
      )
    `;
  } else {
    exact(taskRows[0], expectedTask, "Local-review open arrival pickup task");
    if (taskRows.length !== 1) throw new Error("Local-review open arrival pickup task is ambiguous");
  }

  const travelRows = await connection<Array<Record<string, unknown>>>`
    SELECT id, tenant_id, reservation_id, direction, mode, carrier, service_no,
           scheduled_at=${PICKUP_TASK_DISPATCH_EXAMPLE.scheduledAt}::timestamptz AS exact_scheduled_at,
           pickup_requested, pickup_task_id, notes
    FROM travel_detail
    WHERE id=${travelId}::uuid
       OR (tenant_id=${SEED_TENANT.id}::uuid AND reservation_id=${reservationId}::uuid
           AND direction='arrival')
    ORDER BY id
    FOR UPDATE
  `;
  const expectedTravel = {
    id: travelId, tenant_id: SEED_TENANT.id, reservation_id: reservationId,
    direction: "arrival", mode: PICKUP_TASK_DISPATCH_EXAMPLE.mode,
    carrier: PICKUP_TASK_DISPATCH_EXAMPLE.carrier,
    service_no: PICKUP_TASK_DISPATCH_EXAMPLE.serviceNo,
    exact_scheduled_at: true, pickup_requested: true, pickup_task_id: taskId, notes: null,
  };
  if (travelRows.length === 0) {
    await connection`
      INSERT INTO travel_detail (
        id, tenant_id, reservation_id, direction, mode, carrier, service_no,
        scheduled_at, pickup_requested, pickup_task_id, notes
      ) VALUES (
        ${travelId}::uuid, ${SEED_TENANT.id}::uuid, ${reservationId}::uuid,
        'arrival', ${PICKUP_TASK_DISPATCH_EXAMPLE.mode},
        ${PICKUP_TASK_DISPATCH_EXAMPLE.carrier}, ${PICKUP_TASK_DISPATCH_EXAMPLE.serviceNo},
        ${PICKUP_TASK_DISPATCH_EXAMPLE.scheduledAt}::timestamptz, true, ${taskId}::uuid, NULL
      )
    `;
  } else {
    exact(travelRows[0], expectedTravel, "Local-review linked arrival pickup travel");
    if (travelRows.length !== 1) throw new Error("Local-review linked arrival pickup travel is ambiguous");
  }

  return Object.freeze({ reservationId, travelId, taskId, staffPartyId });
}

async function provisionHousekeepingExamples(
  connection: ReservedSQL,
  userId: string,
  ratePlanId: string,
  spaces: ReadonlyMap<string, Space>,
  sellableUnits: ReadonlyMap<string, SellableUnit>,
): Promise<ReviewHousekeepingExamples> {
  await connection`SELECT pg_advisory_xact_lock(hashtextextended('yellow.local.review.seed.housekeeping', 0))`;

  const attendantPartyId = await uuidV5(
    SEED_TENANT.id,
    `${REVIEW_HOUSEKEEPING_FIXTURE_UUID}/attendant`,
  );
  const attendantAttrs = Object.freeze({ source: "local-review", housekeeping_fixture: "attendant" });
  const attendantRows = await connection<Array<Record<string, unknown>>>`
    SELECT id, tenant_id, kind, display_name, legal_name, attrs, vip_code, status, merged_into
    FROM party WHERE id=${attendantPartyId}::uuid ORDER BY id FOR UPDATE
  `;
  const expectedAttendant = { id: attendantPartyId, tenant_id: SEED_TENANT.id, kind: "person",
    display_name: "Avery Housekeeping", legal_name: "Avery Housekeeping", attrs: attendantAttrs,
    vip_code: null, status: "active", merged_into: null };
  if (attendantRows.length === 0) {
    await connection`INSERT INTO party
      (id, tenant_id, kind, display_name, legal_name, attrs, status)
      VALUES (${attendantPartyId}::uuid, ${SEED_TENANT.id}::uuid, 'person',
        'Avery Housekeeping', 'Avery Housekeeping',
        ${JSON.stringify(attendantAttrs)}::text::jsonb, 'active')`;
  } else {
    exact(attendantRows[0], expectedAttendant, "Local-review housekeeping attendant");
    if (attendantRows.length !== 1) throw new Error("Local-review housekeeping attendant is ambiguous");
  }

  const staffDetail = Object.freeze({ source: "local-review", housekeeping_fixture: "attendant" });
  const staffRoles = await connection<Array<Record<string, unknown>>>`
    SELECT tenant_id, party_id, role, detail FROM party_role
    WHERE party_id=${attendantPartyId}::uuid AND role='staff'
  `;
  const expectedStaffRole = { tenant_id: SEED_TENANT.id, party_id: attendantPartyId,
    role: "staff", detail: staffDetail };
  if (staffRoles.length === 0) {
    await connection`INSERT INTO party_role (tenant_id, party_id, role, detail)
      VALUES (${SEED_TENANT.id}::uuid, ${attendantPartyId}::uuid, 'staff',
        ${JSON.stringify(staffDetail)}::text::jsonb)`;
  } else {
    exact(staffRoles[0], expectedStaffRole, "Local-review housekeeping attendant role");
    if (staffRoles.length !== 1) throw new Error("Local-review housekeeping attendant role is ambiguous");
  }

  const taskIds: Record<string, string> = {};
  for (const spec of HOUSEKEEPING_EXAMPLES) {
    const space = spaces.get(spec.roomCode);
    if (!space) throw new Error(`Local-review housekeeping room ${spec.roomCode} is absent`);

    const physicalSpaces = await connection<Array<{ id: string }>>`
      SELECT id FROM space
      WHERE id=${space.id}::uuid AND tenant_id=${SEED_TENANT.id}::uuid
        AND property_node=${SEED_PROPERTY.id}::uuid AND status='active'
    `;
    if (physicalSpaces.length !== 1) {
      throw new Error(`Local-review housekeeping room ${spec.roomCode} is not one active property space`);
    }

    const conditionRows = await connection<Array<Record<string, unknown>>>`
      SELECT tenant_id, space_id, condition,
             to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at,
             updated_by
      FROM unit_condition WHERE space_id=${space.id}::uuid FOR UPDATE
    `;
    const expectedCondition = { tenant_id: SEED_TENANT.id, space_id: space.id,
      condition: spec.condition, updated_at: spec.conditionUpdatedAt, updated_by: userId };
    if (conditionRows.length === 0) {
      await connection`INSERT INTO unit_condition
        (tenant_id, space_id, condition, updated_at, updated_by)
        VALUES (${SEED_TENANT.id}::uuid, ${space.id}::uuid, ${spec.condition},
          ${spec.conditionUpdatedAt}::timestamptz, ${userId}::uuid)`;
    } else {
      exact(conditionRows[0], expectedCondition,
        `Local-review housekeeping room ${spec.roomCode} condition`);
      if (conditionRows.length !== 1) {
        throw new Error(`Local-review housekeeping room ${spec.roomCode} condition is ambiguous`);
      }
    }

    const taskId = await uuidV5(SEED_TENANT.id, `${REVIEW_HOUSEKEEPING_FIXTURE_UUID}/${spec.key}/task`);
    const payload = Object.freeze({ source: "local-review", housekeeping_example: spec.key });
    const taskRows = await connection<Array<Record<string, unknown>>>`
      SELECT id, tenant_id, property_node, kind, status, subject_type, subject_id,
             assignee_party, department,
             to_char(due_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS due_at,
             priority, credits, sheet_id, payload,
             to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
             CASE WHEN completed_at IS NULL THEN NULL ELSE
               to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS completed_at
      FROM task WHERE id=${taskId}::uuid ORDER BY id FOR UPDATE
    `;
    const expectedTask = { id: taskId, tenant_id: SEED_TENANT.id, property_node: SEED_PROPERTY.id,
      kind: "housekeeping", status: spec.taskStatus, subject_type: "space", subject_id: space.id,
      assignee_party: attendantPartyId, department: "Housekeeping", due_at: spec.dueAt,
      priority: 2, credits: null, sheet_id: null, payload, created_at: spec.createdAt,
      completed_at: spec.completedAt };
    if (taskRows.length === 0) {
      await connection`INSERT INTO task
        (id, tenant_id, property_node, kind, status, subject_type, subject_id,
         assignee_party, department, due_at, priority, credits, sheet_id, payload,
         created_at, completed_at)
        VALUES (${taskId}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid,
          'housekeeping', ${spec.taskStatus}, 'space', ${space.id}::uuid,
          ${attendantPartyId}::uuid, 'Housekeeping', ${spec.dueAt}::timestamptz,
          2, NULL, NULL, ${JSON.stringify(payload)}::text::jsonb,
          ${spec.createdAt}::timestamptz, ${spec.completedAt}::timestamptz)`;
    } else {
      exact(taskRows[0], expectedTask, `Local-review ${spec.key} housekeeping task`);
      if (taskRows.length !== 1) throw new Error(`Local-review ${spec.key} housekeeping task is ambiguous`);
    }
    taskIds[spec.key] = taskId;
  }

  const sheetFixtureSpace = spaces.get(HOUSEKEEPING_SHEET_FIXTURE.roomCode);
  const sheetFixtureSellable = sellableUnits.get(HOUSEKEEPING_SHEET_FIXTURE.roomCode);
  if (!sheetFixtureSpace || !sheetFixtureSellable) {
    throw new Error("Local-review housekeeping sheet fixture inventory is absent");
  }
  const fixtureBase = `${REVIEW_HOUSEKEEPING_FIXTURE_UUID}/sheet-generation`;
  const guestPartyId = await uuidV5(SEED_TENANT.id, `${fixtureBase}/party`);
  const reservationId = await uuidV5(SEED_TENANT.id, `${fixtureBase}/reservation`);
  const segmentId = await uuidV5(SEED_TENANT.id, `${fixtureBase}/segment`);
  const departureAccountId = await uuidV5(SEED_TENANT.id, `${fixtureBase}/departure-readiness/account`);
  const departureFolioId = await uuidV5(SEED_TENANT.id, `${fixtureBase}/departure-readiness/folio`);
  const checkoutFixtureBase = `${fixtureBase}/departure-command`;
  const checkoutReservationId = await uuidV5(SEED_TENANT.id, `${checkoutFixtureBase}/reservation`);
  const checkoutSegmentId = await uuidV5(SEED_TENANT.id, `${checkoutFixtureBase}/segment`);
  const checkoutFolioId = await uuidV5(SEED_TENANT.id, `${checkoutFixtureBase}/folio`);
  const guestAttrs = Object.freeze({ source: "local-review", housekeeping_fixture: "sheet-eligible-guest" });
  const guestRows = await connection<Array<Record<string, unknown>>>`
    SELECT id, tenant_id, kind, display_name, legal_name, attrs, vip_code, status, merged_into
    FROM party WHERE id=${guestPartyId}::uuid ORDER BY id FOR UPDATE
  `;
  const expectedGuest = { id: guestPartyId, tenant_id: SEED_TENANT.id, kind: "person",
    display_name: HOUSEKEEPING_SHEET_FIXTURE.displayName,
    legal_name: HOUSEKEEPING_SHEET_FIXTURE.displayName, attrs: guestAttrs,
    vip_code: null, status: "active", merged_into: null };
  if (guestRows.length === 0) {
    await connection`INSERT INTO party
      (id, tenant_id, kind, display_name, legal_name, attrs, status)
      VALUES (${guestPartyId}::uuid, ${SEED_TENANT.id}::uuid, 'person',
        ${HOUSEKEEPING_SHEET_FIXTURE.displayName}, ${HOUSEKEEPING_SHEET_FIXTURE.displayName},
        ${JSON.stringify(guestAttrs)}::text::jsonb, 'active')`;
  } else {
    exact(guestRows[0], expectedGuest, "Local-review housekeeping sheet eligible guest");
    if (guestRows.length !== 1) throw new Error("Local-review housekeeping sheet eligible guest is ambiguous");
  }

  const guestRoleDetail = Object.freeze({ source: "local-review", housekeeping_fixture: "sheet-eligible-guest" });
  const guestRoleRows = await connection<Array<Record<string, unknown>>>`
    SELECT tenant_id, party_id, role, detail FROM party_role
    WHERE party_id=${guestPartyId}::uuid AND role='guest'
  `;
  const expectedGuestRole = { tenant_id: SEED_TENANT.id, party_id: guestPartyId,
    role: "guest", detail: guestRoleDetail };
  if (guestRoleRows.length === 0) {
    await connection`INSERT INTO party_role (tenant_id, party_id, role, detail)
      VALUES (${SEED_TENANT.id}::uuid, ${guestPartyId}::uuid, 'guest',
        ${JSON.stringify(guestRoleDetail)}::text::jsonb)`;
  } else {
    exact(guestRoleRows[0], expectedGuestRole, "Local-review housekeeping sheet eligible guest role");
    if (guestRoleRows.length !== 1) throw new Error("Local-review housekeeping sheet eligible guest role is ambiguous");
  }

  const reservationRows = await connection<Array<Record<string, unknown>>>`
    SELECT id, tenant_id, property_node, confirmation_no, status, primary_party,
           booker_party, group_id, channel_code, currency::text, guarantee_policy
    FROM reservation
    WHERE id=${reservationId}::uuid OR
      (tenant_id=${SEED_TENANT.id}::uuid AND confirmation_no=${HOUSEKEEPING_SHEET_FIXTURE.confirmationNo})
    ORDER BY id FOR UPDATE
  `;
  const expectedReservation = { id: reservationId, tenant_id: SEED_TENANT.id,
    property_node: SEED_PROPERTY.id, confirmation_no: HOUSEKEEPING_SHEET_FIXTURE.confirmationNo,
    status: "in_house", primary_party: guestPartyId, booker_party: null, group_id: null,
    channel_code: "direct", currency: SEED_PROPERTY.currency, guarantee_policy: null };
  if (reservationRows.length === 0) {
    await connection`INSERT INTO reservation
      (id, tenant_id, property_node, confirmation_no, status, primary_party,
       channel_code, currency, notes)
      VALUES (${reservationId}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid,
        ${HOUSEKEEPING_SHEET_FIXTURE.confirmationNo}, 'in_house', ${guestPartyId}::uuid,
        'direct', ${SEED_PROPERTY.currency}, 'Local-review housekeeping sheet eligible stay')`;
  } else {
    exact(reservationRows[0], expectedReservation, "Local-review housekeeping sheet eligible reservation");
    if (reservationRows.length !== 1) throw new Error("Local-review housekeeping sheet eligible reservation is ambiguous");
  }

  const sellableRows = await connection<Array<{ unit_type_id: string }>>`
    SELECT unit_type_id FROM sellable_unit
    WHERE id=${sheetFixtureSellable.id}::uuid AND tenant_id=${SEED_TENANT.id}::uuid
  `;
  const unitTypeId = sellableRows[0]?.unit_type_id;
  if (!unitTypeId || sellableRows.length !== 1) {
    throw new Error("Local-review housekeeping sheet eligible sellable unit is ambiguous");
  }
  const segmentRows = await connection<Array<Record<string, unknown>>>`
    SELECT id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id,
           lower(period)=${HOUSEKEEPING_SHEET_FIXTURE.stayStart}::timestamptz AS exact_start,
           upper(period)=${HOUSEKEEPING_SHEET_FIXTURE.stayEnd}::timestamptz AS exact_end,
           adults, children, rate_plan_id, price_override, status
    FROM reservation_segment WHERE id=${segmentId}::uuid FOR UPDATE
  `;
  const expectedSegment = { id: segmentId, tenant_id: SEED_TENANT.id,
    reservation_id: reservationId, seq: 1, unit_type_id: unitTypeId,
    sellable_unit_id: sheetFixtureSellable.id, exact_start: true, exact_end: true,
    adults: 1, children: [], rate_plan_id: ratePlanId, price_override: null, status: "in_house" };
  if (segmentRows.length === 0) {
    await connection`INSERT INTO reservation_segment
      (id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id, period,
       adults, children, rate_plan_id, status)
      VALUES (${segmentId}::uuid, ${SEED_TENANT.id}::uuid, ${reservationId}::uuid, 1,
        ${unitTypeId}::uuid, ${sheetFixtureSellable.id}::uuid,
        tstzrange(${HOUSEKEEPING_SHEET_FIXTURE.stayStart}::timestamptz,
          ${HOUSEKEEPING_SHEET_FIXTURE.stayEnd}::timestamptz, '[)'),
        1, '[]'::jsonb, ${ratePlanId}::uuid, 'in_house')`;
  } else {
    exact(segmentRows[0], expectedSegment, "Local-review housekeeping sheet eligible segment");
    if (segmentRows.length !== 1) throw new Error("Local-review housekeeping sheet eligible segment is ambiguous");
  }

  const reservationGuestRows = await connection<Array<Record<string, unknown>>>`
    SELECT tenant_id, reservation_id, party_id, role, share_pct::text
    FROM reservation_guest
    WHERE reservation_id=${reservationId}::uuid AND party_id=${guestPartyId}::uuid
  `;
  const expectedReservationGuest = { tenant_id: SEED_TENANT.id, reservation_id: reservationId,
    party_id: guestPartyId, role: "primary", share_pct: null };
  if (reservationGuestRows.length === 0) {
    await connection`INSERT INTO reservation_guest (tenant_id, reservation_id, party_id, role)
      VALUES (${SEED_TENANT.id}::uuid, ${reservationId}::uuid, ${guestPartyId}::uuid, 'primary')`;
  } else {
    exact(reservationGuestRows[0], expectedReservationGuest,
      "Local-review housekeeping sheet eligible reservation guest");
    if (reservationGuestRows.length !== 1) {
      throw new Error("Local-review housekeeping sheet eligible reservation guest is ambiguous");
    }
  }

  const departureAccountRows = await connection<Array<Record<string, unknown>>>`
    SELECT account.id, account.tenant_id, account.property_node, account.role, account.party_id,
           account.name, account.currency::text, account.credit_limit_minor::text, account.status,
           to_char(account.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
    FROM account
    WHERE account.id=${departureAccountId}::uuid
       OR (account.tenant_id=${SEED_TENANT.id}::uuid
         AND account.property_node=${SEED_PROPERTY.id}::uuid
         AND account.role='guest' AND account.party_id=${guestPartyId}::uuid)
    ORDER BY account.id FOR UPDATE
  `;
  const expectedDepartureAccount = { id: departureAccountId, tenant_id: SEED_TENANT.id,
    property_node: SEED_PROPERTY.id, role: "guest", party_id: guestPartyId,
    name: `${HOUSEKEEPING_SHEET_FIXTURE.displayName} Ledger`,
    currency: SEED_PROPERTY.currency, credit_limit_minor: null, status: "open",
    created_at: HOUSEKEEPING_SHEET_FIXTURE.financialCreatedAt };
  if (departureAccountRows.length === 0) {
    await connection`INSERT INTO account
      (id, tenant_id, property_node, role, party_id, name, currency, status, created_at)
      VALUES (${departureAccountId}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid,
        'guest', ${guestPartyId}::uuid, ${expectedDepartureAccount.name},
        ${SEED_PROPERTY.currency}, 'open',
        ${HOUSEKEEPING_SHEET_FIXTURE.financialCreatedAt}::timestamptz)`;
  } else {
    exact(departureAccountRows[0], expectedDepartureAccount,
      "Local-review departure-readiness guest account");
    if (departureAccountRows.length !== 1) {
      throw new Error("Local-review departure-readiness guest account is ambiguous");
    }
  }

  const departureFolioNo = "DEP-HK-SHEET-1";
  const departureFolioRows = await connection<Array<Record<string, unknown>>>`
    SELECT folio.id, folio.tenant_id, folio.account_id, folio.reservation_id,
           folio.folio_no, folio.window_no, folio.name, folio.status,
           to_char(folio.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
           COALESCE(balance.balance_minor, 0)::text AS balance_minor,
           COALESCE(balance.lines, 0)::int AS posting_lines
    FROM folio
    LEFT JOIN folio_balance AS balance
      ON balance.tenant_id=folio.tenant_id AND balance.folio_id=folio.id
    WHERE folio.id=${departureFolioId}::uuid
       OR (folio.tenant_id=${SEED_TENANT.id}::uuid
         AND (folio.folio_no=${departureFolioNo}
           OR (folio.reservation_id=${reservationId}::uuid AND folio.window_no=1)))
    ORDER BY folio.id FOR UPDATE OF folio
  `;
  const expectedDepartureFolio = { id: departureFolioId, tenant_id: SEED_TENANT.id,
    account_id: departureAccountId, reservation_id: reservationId,
    folio_no: departureFolioNo, window_no: 1, name: "Primary", status: "settled",
    created_at: HOUSEKEEPING_SHEET_FIXTURE.financialCreatedAt,
    balance_minor: "0", posting_lines: 0 };
  if (departureFolioRows.length === 0) {
    await connection`INSERT INTO folio
      (id, tenant_id, account_id, reservation_id, folio_no, window_no, name, status, created_at)
      VALUES (${departureFolioId}::uuid, ${SEED_TENANT.id}::uuid,
        ${departureAccountId}::uuid, ${reservationId}::uuid, ${departureFolioNo}, 1,
        'Primary', 'settled', ${HOUSEKEEPING_SHEET_FIXTURE.financialCreatedAt}::timestamptz)`;
  } else {
    exact(departureFolioRows[0], expectedDepartureFolio,
      "Local-review departure-readiness settled folio");
    if (departureFolioRows.length !== 1) {
      throw new Error("Local-review departure-readiness settled folio is ambiguous");
    }
  }

  const sheetConditionRows = await connection<Array<Record<string, unknown>>>`
    SELECT tenant_id, space_id, condition,
           to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at,
           updated_by
    FROM unit_condition WHERE space_id=${sheetFixtureSpace.id}::uuid FOR UPDATE
  `;
  const expectedSheetCondition = { tenant_id: SEED_TENANT.id, space_id: sheetFixtureSpace.id,
    condition: HOUSEKEEPING_SHEET_FIXTURE.condition,
    updated_at: HOUSEKEEPING_SHEET_FIXTURE.conditionUpdatedAt, updated_by: userId };
  if (sheetConditionRows.length === 0) {
    await connection`INSERT INTO unit_condition
      (tenant_id, space_id, condition, updated_at, updated_by)
      VALUES (${SEED_TENANT.id}::uuid, ${sheetFixtureSpace.id}::uuid,
        ${HOUSEKEEPING_SHEET_FIXTURE.condition},
        ${HOUSEKEEPING_SHEET_FIXTURE.conditionUpdatedAt}::timestamptz, ${userId}::uuid)`;
  } else {
    exact(sheetConditionRows[0], expectedSheetCondition,
      "Local-review housekeeping sheet eligible room condition");
    if (sheetConditionRows.length !== 1) {
      throw new Error("Local-review housekeeping sheet eligible room condition is ambiguous");
    }
  }

  let occupancyRows = await connection<Array<Record<string, unknown>>>`
    SELECT id, tenant_id, space_id,
           lower(period)=${HOUSEKEEPING_SHEET_FIXTURE.stayStart}::timestamptz AS exact_start,
           upper(period)=${HOUSEKEEPING_SHEET_FIXTURE.stayEnd}::timestamptz AS exact_end,
           slot_ref, slot_kind, exclusive, claim::text
    FROM space_occupancy WHERE tenant_id=${SEED_TENANT.id}::uuid AND slot_ref=${segmentId}::uuid
    ORDER BY id
  `;
  if (occupancyRows.length === 0) {
    await connection`SELECT record_occupancy(
      ${SEED_TENANT.id}::uuid, ${sheetFixtureSpace.id}::uuid,
      tstzrange(${HOUSEKEEPING_SHEET_FIXTURE.stayStart}::timestamptz,
        ${HOUSEKEEPING_SHEET_FIXTURE.stayEnd}::timestamptz, '[)'),
      ${segmentId}::uuid, 'segment', true)`;
    occupancyRows = await connection<Array<Record<string, unknown>>>`
      SELECT id, tenant_id, space_id,
             lower(period)=${HOUSEKEEPING_SHEET_FIXTURE.stayStart}::timestamptz AS exact_start,
             upper(period)=${HOUSEKEEPING_SHEET_FIXTURE.stayEnd}::timestamptz AS exact_end,
             slot_ref, slot_kind, exclusive, claim::text
      FROM space_occupancy WHERE tenant_id=${SEED_TENANT.id}::uuid AND slot_ref=${segmentId}::uuid
      ORDER BY id
    `;
  }
  const occupancy = occupancyRows[0];
  if (!occupancy) throw new Error("Local-review housekeeping sheet eligible occupancy is absent");
  exact(occupancy, { id: occupancy.id, tenant_id: SEED_TENANT.id, space_id: sheetFixtureSpace.id,
    exact_start: true, exact_end: true, slot_ref: segmentId, slot_kind: "segment",
    exclusive: true, claim: "[0,)" }, "Local-review housekeeping sheet eligible occupancy");
  if (occupancyRows.length !== 1) throw new Error("Local-review housekeeping sheet eligible occupancy is ambiguous");

  const checkoutReservationRows = await connection<Array<Record<string, unknown>>>`
    SELECT id, tenant_id, property_node, confirmation_no, status, primary_party,
           booker_party, group_id, channel_code, currency::text, guarantee_policy
    FROM reservation
    WHERE id=${checkoutReservationId}::uuid OR
      (tenant_id=${SEED_TENANT.id}::uuid AND confirmation_no=${CHECKOUT_COMMAND_FIXTURE.confirmationNo})
    ORDER BY id FOR UPDATE
  `;
  const expectedCheckoutReservation = { id: checkoutReservationId, tenant_id: SEED_TENANT.id,
    property_node: SEED_PROPERTY.id, confirmation_no: CHECKOUT_COMMAND_FIXTURE.confirmationNo,
    status: "due_out", primary_party: guestPartyId, booker_party: null, group_id: null,
    channel_code: "direct", currency: SEED_PROPERTY.currency, guarantee_policy: null };
  if (checkoutReservationRows.length === 0) {
    await connection`INSERT INTO reservation
      (id, tenant_id, property_node, confirmation_no, status, primary_party,
       channel_code, currency, notes)
      VALUES (${checkoutReservationId}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid,
        ${CHECKOUT_COMMAND_FIXTURE.confirmationNo}, 'due_out', ${guestPartyId}::uuid,
        'direct', ${SEED_PROPERTY.currency}, 'Local-review governed checkout ready stay')`;
  } else {
    exact(checkoutReservationRows[0], expectedCheckoutReservation,
      "Local-review checkout command reservation");
    if (checkoutReservationRows.length !== 1) {
      throw new Error("Local-review checkout command reservation is ambiguous");
    }
  }

  const checkoutSegmentRows = await connection<Array<Record<string, unknown>>>`
    SELECT id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id,
           lower(period)=${CHECKOUT_COMMAND_FIXTURE.stayStart}::timestamptz AS exact_start,
           upper(period)=${CHECKOUT_COMMAND_FIXTURE.stayEnd}::timestamptz AS exact_end,
           adults, children, rate_plan_id, price_override, status
    FROM reservation_segment WHERE id=${checkoutSegmentId}::uuid FOR UPDATE
  `;
  const expectedCheckoutSegment = { id: checkoutSegmentId, tenant_id: SEED_TENANT.id,
    reservation_id: checkoutReservationId, seq: 1, unit_type_id: unitTypeId,
    sellable_unit_id: sheetFixtureSellable.id, exact_start: true, exact_end: true,
    adults: 1, children: [], rate_plan_id: ratePlanId, price_override: null, status: "in_house" };
  if (checkoutSegmentRows.length === 0) {
    await connection`INSERT INTO reservation_segment
      (id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id, period,
       adults, children, rate_plan_id, status)
      VALUES (${checkoutSegmentId}::uuid, ${SEED_TENANT.id}::uuid,
        ${checkoutReservationId}::uuid, 1, ${unitTypeId}::uuid,
        ${sheetFixtureSellable.id}::uuid,
        tstzrange(${CHECKOUT_COMMAND_FIXTURE.stayStart}::timestamptz,
          ${CHECKOUT_COMMAND_FIXTURE.stayEnd}::timestamptz, '[)'),
        1, '[]'::jsonb, ${ratePlanId}::uuid, 'in_house')`;
  } else {
    exact(checkoutSegmentRows[0], expectedCheckoutSegment,
      "Local-review checkout command segment");
    if (checkoutSegmentRows.length !== 1) {
      throw new Error("Local-review checkout command segment is ambiguous");
    }
  }

  const checkoutFolioNo = "DEP-CHECKOUT-1";
  const checkoutFolioRows = await connection<Array<Record<string, unknown>>>`
    SELECT folio.id, folio.tenant_id, folio.account_id, folio.reservation_id,
           folio.folio_no, folio.window_no, folio.name, folio.status,
           to_char(folio.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
           COALESCE(balance.balance_minor, 0)::text AS balance_minor,
           COALESCE(balance.lines, 0)::int AS posting_lines
    FROM folio
    LEFT JOIN folio_balance AS balance
      ON balance.tenant_id=folio.tenant_id AND balance.folio_id=folio.id
    WHERE folio.id=${checkoutFolioId}::uuid
       OR (folio.tenant_id=${SEED_TENANT.id}::uuid
         AND (folio.folio_no=${checkoutFolioNo}
           OR (folio.reservation_id=${checkoutReservationId}::uuid AND folio.window_no=1)))
    ORDER BY folio.id FOR UPDATE OF folio
  `;
  const expectedCheckoutFolio = { id: checkoutFolioId, tenant_id: SEED_TENANT.id,
    account_id: departureAccountId, reservation_id: checkoutReservationId,
    folio_no: checkoutFolioNo, window_no: 1, name: "Primary", status: "settled",
    created_at: CHECKOUT_COMMAND_FIXTURE.financialCreatedAt,
    balance_minor: "0", posting_lines: 0 };
  if (checkoutFolioRows.length === 0) {
    await connection`INSERT INTO folio
      (id, tenant_id, account_id, reservation_id, folio_no, window_no, name, status, created_at)
      VALUES (${checkoutFolioId}::uuid, ${SEED_TENANT.id}::uuid,
        ${departureAccountId}::uuid, ${checkoutReservationId}::uuid, ${checkoutFolioNo}, 1,
        'Primary', 'settled', ${CHECKOUT_COMMAND_FIXTURE.financialCreatedAt}::timestamptz)`;
  } else {
    exact(checkoutFolioRows[0], expectedCheckoutFolio,
      "Local-review checkout command settled folio");
    if (checkoutFolioRows.length !== 1) {
      throw new Error("Local-review checkout command settled folio is ambiguous");
    }
  }

  let checkoutOccupancyRows = await connection<Array<Record<string, unknown>>>`
    SELECT id, tenant_id, space_id,
           lower(period)=${CHECKOUT_COMMAND_FIXTURE.stayStart}::timestamptz AS exact_start,
           upper(period)=${CHECKOUT_COMMAND_FIXTURE.stayEnd}::timestamptz AS exact_end,
           slot_ref, slot_kind, exclusive, claim::text
    FROM space_occupancy
    WHERE tenant_id=${SEED_TENANT.id}::uuid AND slot_ref=${checkoutSegmentId}::uuid
    ORDER BY id
  `;
  if (checkoutOccupancyRows.length === 0) {
    await connection`SELECT record_occupancy(
      ${SEED_TENANT.id}::uuid, ${sheetFixtureSpace.id}::uuid,
      tstzrange(${CHECKOUT_COMMAND_FIXTURE.stayStart}::timestamptz,
        ${CHECKOUT_COMMAND_FIXTURE.stayEnd}::timestamptz, '[)'),
      ${checkoutSegmentId}::uuid, 'segment', true)`;
    checkoutOccupancyRows = await connection<Array<Record<string, unknown>>>`
      SELECT id, tenant_id, space_id,
             lower(period)=${CHECKOUT_COMMAND_FIXTURE.stayStart}::timestamptz AS exact_start,
             upper(period)=${CHECKOUT_COMMAND_FIXTURE.stayEnd}::timestamptz AS exact_end,
             slot_ref, slot_kind, exclusive, claim::text
      FROM space_occupancy
      WHERE tenant_id=${SEED_TENANT.id}::uuid AND slot_ref=${checkoutSegmentId}::uuid
      ORDER BY id
    `;
  }
  const checkoutOccupancy = checkoutOccupancyRows[0];
  if (!checkoutOccupancy) throw new Error("Local-review checkout command occupancy is absent");
  exact(checkoutOccupancy, { id: checkoutOccupancy.id, tenant_id: SEED_TENANT.id,
    space_id: sheetFixtureSpace.id, exact_start: true, exact_end: true,
    slot_ref: checkoutSegmentId, slot_kind: "segment", exclusive: true, claim: "[0,)" },
  "Local-review checkout command occupancy");
  if (checkoutOccupancyRows.length !== 1) {
    throw new Error("Local-review checkout command occupancy is ambiguous");
  }

  return Object.freeze({
    assignedDirtyTaskId: taskIds["assigned-dirty"]!,
    doneCleanTaskId: taskIds["done-clean"]!,
    attendantPartyId,
    sheetDate: HOUSEKEEPING_SHEET_FIXTURE.sheetDate,
    eligibleReservationId: reservationId,
    eligibleSegmentId: segmentId,
    eligibleSpaceId: sheetFixtureSpace.id,
    eligibleSellableUnitId: sheetFixtureSellable.id,
    eligibleOccupancyId: String(occupancy.id),
    departureAccountId,
    departureFolioId,
    checkoutReservationId,
    checkoutSegmentId,
    checkoutOccupancyId: String(checkoutOccupancy.id),
    checkoutFolioId,
  });
}

async function provisionVehicleExamples(
  connection: ReservedSQL,
  checkInExamples: ReviewCheckInExamples,
  housekeepingExamples: ReviewHousekeepingExamples,
): Promise<ReviewVehicleExamples> {
  const parkingReservationId = await uuidV5(
    SEED_TENANT.id,
    `${REVIEW_VEHICLE_FIXTURE_UUID}/parking-reservation`,
  );
  const parkingSegmentId = await uuidV5(
    SEED_TENANT.id,
    `${REVIEW_VEHICLE_FIXTURE_UUID}/parking-segment`,
  );
  const parkingSources = await connection<Array<{
    party_id: string; unit_type_id: string; sellable_unit_id: string; rate_plan_id: string;
  }>>`
    SELECT reservation.primary_party AS party_id, segment.unit_type_id,
           segment.sellable_unit_id, segment.rate_plan_id
      FROM reservation
      JOIN reservation_segment AS segment
        ON segment.tenant_id=reservation.tenant_id AND segment.reservation_id=reservation.id
     WHERE reservation.tenant_id=${SEED_TENANT.id}::uuid
       AND reservation.property_node=${SEED_PROPERTY.id}::uuid
       AND reservation.id=${housekeepingExamples.eligibleReservationId}::uuid
       AND segment.id=${housekeepingExamples.eligibleSegmentId}::uuid
  `;
  const parkingSource = parkingSources[0];
  if (!parkingSource || parkingSources.length !== 1 || !parkingSource.sellable_unit_id) {
    throw new Error("Local-review parking vehicle source stay is absent or inconsistent");
  }
  const parkingReservations = await connection<Array<{
    id: string; status: string; primary_party: string; current_segments: number;
  }>>`
    SELECT reservation.id, reservation.status, reservation.primary_party,
           (SELECT count(*)::int FROM reservation_segment AS segment
             WHERE segment.tenant_id=reservation.tenant_id
               AND segment.reservation_id=reservation.id
               AND segment.status='in_house'
               AND segment.period @> transaction_timestamp()) AS current_segments
      FROM reservation
     WHERE reservation.id=${parkingReservationId}::uuid
        OR (reservation.tenant_id=${SEED_TENANT.id}::uuid
            AND reservation.property_node=${SEED_PROPERTY.id}::uuid
            AND reservation.confirmation_no='PARKING-REVIEW')
     ORDER BY reservation.id
     FOR UPDATE OF reservation
  `;
  if (parkingReservations.length === 0) {
    await connection`INSERT INTO reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
    ) VALUES(
      ${parkingReservationId}::uuid,${SEED_TENANT.id}::uuid,${SEED_PROPERTY.id}::uuid,
      'PARKING-REVIEW','in_house',${parkingSource.party_id}::uuid,'direct',${SEED_PROPERTY.currency}
    )`;
    await connection`INSERT INTO reservation_segment(
      id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,
      adults,children,rate_plan_id,status
    ) VALUES(
      ${parkingSegmentId}::uuid,${SEED_TENANT.id}::uuid,${parkingReservationId}::uuid,1,
      ${parkingSource.unit_type_id}::uuid,${parkingSource.sellable_unit_id}::uuid,
      tstzrange(transaction_timestamp()-interval '1 day',transaction_timestamp()+interval '30 days','[)'),
      1,'[]'::jsonb,${parkingSource.rate_plan_id}::uuid,'in_house'
    )`;
  } else {
    const existing = parkingReservations[0]!;
    if (parkingReservations.length !== 1 || existing.id !== parkingReservationId ||
        existing.status !== "in_house" || existing.primary_party !== parkingSource.party_id ||
        existing.current_segments !== 1) {
      throw new Error("Local-review parking assignment stay collides with non-canonical data");
    }
  }

  const reservationIds = Object.freeze({
    arrival: checkInExamples.cleanReservationId,
    departure: housekeepingExamples.eligibleReservationId,
    parking: parkingReservationId,
  });
  const result: Record<string, string> = {};

  for (const spec of VEHICLE_EXAMPLES) {
    const reservationId = reservationIds[spec.key];
    const associations = await connection<Array<{
      reservation_id: string; tenant_id: string; property_node: string; party_id: string | null;
      party_tenant_id: string | null;
    }>>`
      SELECT reservation.id AS reservation_id, reservation.tenant_id,
             reservation.property_node, reservation.primary_party AS party_id,
             party.tenant_id AS party_tenant_id
      FROM reservation
      LEFT JOIN party ON party.id=reservation.primary_party
      WHERE reservation.id=${reservationId}::uuid
      FOR UPDATE OF reservation
    `;
    const association = associations[0];
    if (!association || associations.length !== 1 || association.tenant_id !== SEED_TENANT.id ||
        association.property_node !== SEED_PROPERTY.id || !association.party_id ||
        association.party_tenant_id !== SEED_TENANT.id) {
      throw new Error(`Local-review ${spec.key} vehicle association is absent or inconsistent`);
    }

    const vehicleId = await uuidV5(SEED_TENANT.id, `${REVIEW_VEHICLE_FIXTURE_UUID}/${spec.key}`);
    const enteredAt = spec.key === "parking"
      ? (await connection<Array<{ entered_at: string }>>`
          SELECT to_char(lower(period) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS entered_at
            FROM reservation_segment WHERE id=${parkingSegmentId}::uuid
        `)[0]!.entered_at
      : spec.enteredAt;
    const vehicles = await connection<Array<Record<string, unknown>>>`
      SELECT id, tenant_id, property_node, reservation_id, party_id, reg_no, make, model,
             colour, driver_name, parking_space,
             entered_at=${enteredAt}::timestamptz AS exact_entered_at,
             CASE WHEN ${spec.exitedAt}::text IS NULL THEN exited_at IS NULL
                  ELSE exited_at=${spec.exitedAt}::timestamptz END AS exact_exited_at,
             notes
      FROM vehicle
      WHERE id=${vehicleId}::uuid
         OR (tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
             AND reg_no=${spec.regNo})
      ORDER BY id
      FOR UPDATE
    `;
    const expected = {
      id: vehicleId,
      tenant_id: SEED_TENANT.id,
      property_node: SEED_PROPERTY.id,
      reservation_id: reservationId,
      party_id: association.party_id,
      reg_no: spec.regNo,
      make: spec.make,
      model: spec.model,
      colour: spec.colour,
      driver_name: spec.driverName,
      parking_space: null,
      exact_entered_at: true,
      exact_exited_at: true,
      notes: null,
    };
    if (vehicles.length === 0) {
      await connection`
        INSERT INTO vehicle (
          id, tenant_id, property_node, reservation_id, party_id, reg_no,
          make, model, colour, driver_name, entered_at, exited_at
        ) VALUES (
          ${vehicleId}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid,
          ${reservationId}::uuid, ${association.party_id}::uuid, ${spec.regNo},
          ${spec.make}, ${spec.model}, ${spec.colour}, ${spec.driverName},
          ${enteredAt}::timestamptz, ${spec.exitedAt}::timestamptz
        )
      `;
    } else {
      exact(vehicles[0], expected, `Local-review ${spec.key} vehicle`);
      if (vehicles.length !== 1) throw new Error(`Local-review ${spec.key} vehicle is ambiguous`);
    }
    result[spec.key] = vehicleId;
  }

  return Object.freeze({
    arrivalVehicleId: result.arrival!,
    departureVehicleId: result.departure!,
    parkingVehicleId: result.parking!,
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
    cashAccountId, cashDrawerId, companyPartyId, agentPartyId,
    companyReceivableAccountId, agentReceivableAccountId,
  } = await canonicalIds();
  const identityPool = new SQL(options.databaseUrl, { max: 2 });
  const eventPool = new SQL(options.databaseUrl, { max: 4, prepare: false });
  const database = Database.connect(options.databaseUrl, { maxConnections: 6 });

  try {
    await withIdentityTransaction(identityPool, async (tx) => {
      await provisionIdentity(tx, options.password, approverPassword, userId, approverUserId, roleId, approverRoleId);
      await provisionReviewFinancials(tx, folioSeriesId, revenueAccountId, cashAccountId, cashDrawerId,
        companyPartyId, agentPartyId, companyReceivableAccountId, agentReceivableAccountId);
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
      for (const spec of PARKING_SPACES) {
        const matches = existing.filter(({ code }) => code === spec.code);
        let item = matches[0];
        if (matches.length > 1) throw new Error(`Parking space ${spec.code} is duplicated`);
        if (item) {
          parkingShape(item, spec);
        } else {
          item = await inventory.createSpace(tx, {
            code: spec.code, profileKey: "parking", capacity: 1, maxOccupancy: null,
            floor: spec.floor, areaSqm: null, genderPolicy: "any",
            attrs: { source: "local-review", name: spec.name },
            envelope: createAuditEnvelope({ actorId: userId, tenantId: SEED_TENANT.id,
              propertyNode: SEED_PROPERTY.id, requestId: crypto.randomUUID(), operation: "space.created" }),
          });
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
      cashAccountId, cashDrawerId, companyPartyId, agentPartyId,
      companyReceivableAccountId, agentReceivableAccountId, ...counts };
    if (mode === "identity_inventory") {
      logger("review rate: omitted by explicit identity_inventory fixture mode");
      return { ...common, mode, rate: null, checkInExamples: null, housekeepingExamples: null,
        vehicleExamples: null, arrivalTravelExamples: null, departureTravelExamples: null,
        pickupTaskDispatchExample: null };
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

    let checkInExamples: ReviewCheckInExamples | undefined;
    let housekeepingExamples: ReviewHousekeepingExamples | undefined;
    let vehicleExamples: ReviewVehicleExamples | undefined;
    let arrivalTravelExamples: ReviewArrivalTravelExamples | undefined;
    let departureTravelExamples: ReviewDepartureTravelExamples | undefined;
    let pickupTaskDispatchExample: ReviewPickupTaskDispatchExample | undefined;
    await withIdentityTransaction(identityPool, async (tx) => {
      checkInExamples = await provisionCheckInExamples(
        tx,
        rate.ratePlanId,
        userId,
        approverUserId,
        roleId,
        approverRoleId,
        unitTypes,
        spaces,
        sellableUnits,
      );
      arrivalTravelExamples = await provisionArrivalTravelExamples(tx, checkInExamples);
      housekeepingExamples = await provisionHousekeepingExamples(
        tx,
        userId,
        rate.ratePlanId,
        spaces,
        sellableUnits,
      );
      departureTravelExamples = await provisionDepartureTravelExamples(tx, housekeepingExamples);
      pickupTaskDispatchExample = await provisionPickupTaskDispatchExample(
        tx,
        checkInExamples,
        housekeepingExamples,
      );
      vehicleExamples = await provisionVehicleExamples(tx, checkInExamples, housekeepingExamples);
    });
    if (!checkInExamples) throw new Error("Local-review check-in examples were not provisioned");
    if (!housekeepingExamples) throw new Error("Local-review housekeeping examples were not provisioned");
    if (!vehicleExamples) throw new Error("Local-review vehicle examples were not provisioned");
    if (!arrivalTravelExamples) throw new Error("Local-review arrival travel examples were not provisioned");
    if (!departureTravelExamples) throw new Error("Local-review departure travel example was not provisioned");
    if (!pickupTaskDispatchExample) throw new Error("Local-review pickup task dispatch example was not provisioned");

    const conditionInitializationSpace = spaces.get(INITIAL_CONDITION_FIXTURE_ROOM_CODE);
    if (!conditionInitializationSpace) throw new Error("Local-review condition initialization room is missing");
    await withIdentityTransaction(identityPool, async (tx) => {
      await tx`DELETE FROM unit_condition
        WHERE tenant_id=${SEED_TENANT.id}::uuid
          AND space_id=${conditionInitializationSpace.id}::uuid`;
    });

    logger(`review rate: plan=${rate.ratePlanId} active_release=${rate.activeReleaseId} version=${rate.activeReleaseVersion} state=${rate.created ? "created" : "existing"}`);
    logger(`review check-in: clean=${checkInExamples.cleanReservationId} dirty=${checkInExamples.dirtyReservationId} unassigned=${checkInExamples.unassignedReservationId} identity_gated=${checkInExamples.identityGatedReservationId}`);
    logger(`review housekeeping: assigned_dirty=${housekeepingExamples.assignedDirtyTaskId} done_clean=${housekeepingExamples.doneCleanTaskId}`);
    logger(`review housekeeping sheet fixture: date=${housekeepingExamples.sheetDate} attendant=${housekeepingExamples.attendantPartyId} reservation=${housekeepingExamples.eligibleReservationId} segment=${housekeepingExamples.eligibleSegmentId} room=${housekeepingExamples.eligibleSpaceId}`);
    logger(`review departure readiness fixture: reservation=${housekeepingExamples.eligibleReservationId} segment=${housekeepingExamples.eligibleSegmentId} room=${housekeepingExamples.eligibleSpaceId} occupancy=${housekeepingExamples.eligibleOccupancyId} account=${housekeepingExamples.departureAccountId} folio=${housekeepingExamples.departureFolioId}`);
    logger(`review checkout command fixture: reservation=${housekeepingExamples.checkoutReservationId} segment=${housekeepingExamples.checkoutSegmentId} room=${housekeepingExamples.eligibleSpaceId} occupancy=${housekeepingExamples.checkoutOccupancyId} account=${housekeepingExamples.departureAccountId} folio=${housekeepingExamples.checkoutFolioId}`);
    logger(`review vehicle fixtures: arrival=${vehicleExamples.arrivalVehicleId} departure=${vehicleExamples.departureVehicleId} parking=${vehicleExamples.parkingVehicleId}`);
    logger(`review arrival travel fixtures: clean=${arrivalTravelExamples.cleanTravelId} dirty=${arrivalTravelExamples.dirtyTravelId}`);
    logger(`review departure travel fixture: checkout=${departureTravelExamples.checkoutTravelId}`);
    logger(`review pickup task dispatch fixture: reservation=${pickupTaskDispatchExample.reservationId} travel=${pickupTaskDispatchExample.travelId} task=${pickupTaskDispatchExample.taskId} staff=${pickupTaskDispatchExample.staffPartyId}`);
    return { ...common, mode, rate, checkInExamples, housekeepingExamples, vehicleExamples,
      arrivalTravelExamples, departureTravelExamples,
      pickupTaskDispatchExample,
      conditionInitializationSpaceId: conditionInitializationSpace.id };
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
