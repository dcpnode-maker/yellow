import { readFileSync } from "node:fs";
import { SQL } from "bun";

import { PartyProfileService } from "../src/contexts/crm";
import { ChargeService, FolioService } from "../src/contexts/financials";
import { HoldService, InventoryService, ReservationOccupancyService } from "../src/contexts/inventory";
import { RateConfigurationService, RatePricingService } from "../src/contexts/rates";
import { ReservationCommitService, ReservationLifecycleService } from "../src/contexts/reservations";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type AuditEnvelope,
  type Tx,
} from "../src/kernel";
import {
  compileScenarioFoundation,
  type GeneratedScenario,
  type ScenarioManifest,
} from "./generate-scenario-foundations";
import { uuidV5 } from "./lib/uuid-v5";
import { SEED_TENANT, TENANT_NAME, URL_NAMESPACE_UUID } from "./seed";
import {
  REVIEW_APPROVER_EMAIL,
  REVIEW_APPROVER_ROLE_NAME,
  REVIEW_EMAIL,
  REVIEW_ROLE_NAME,
} from "./seed-review";

export const SCENARIO_REVIEW_AS_OF_DATE = "2026-08-26";
export const SCENARIO_REVIEW_VERSION = "order181-v1";
export const APPROVED_SCENARIO_HASHES = Object.freeze({
  "india-riverstone": "587fbda9b234fa3bab40fcd5446a143ee1915a516ce7499e8c79ef682144f30c",
  "canada-harbourlight": "7b6c3e4f3d104aefbdaef156ca9098d3df946f792307b63e743a02a7e3c75cd8",
});

type ScenarioKey = keyof typeof APPROVED_SCENARIO_HASHES;

interface SeedOptions {
  readonly databaseUrl: string;
  readonly logger?: (line: string) => void;
}

export interface ScenarioReviewSeedResult {
  readonly version: typeof SCENARIO_REVIEW_VERSION;
  readonly asOfLocalDate: typeof SCENARIO_REVIEW_AS_OF_DATE;
  readonly properties: readonly {
    readonly scenarioKey: ScenarioKey;
    readonly propertyId: string;
    readonly propertyName: string;
    readonly unitTypes: number;
    readonly rooms: number;
    readonly ratePlans: number;
    readonly ratePrices: number;
    readonly reservations: number;
    readonly cancelled: number;
    readonly reserved: number;
    readonly folios: number;
    readonly charges: number;
  }[];
}

interface Identity {
  readonly operatorId: string;
  readonly approverId: string;
  readonly roleId: string;
  readonly approverRoleId: string;
}

interface PropertySpec {
  readonly scenario: GeneratedScenario;
  readonly manifest: ScenarioManifest;
  readonly propertyId: string;
  readonly path: string;
  readonly shortCode: "RIV" | "HAR";
}

interface UnitTypeSeed {
  readonly id: string;
  readonly code: string;
  readonly maxOccupancy: number;
}

interface RoomSeed {
  readonly id: string;
  readonly unitTypeId: string;
}

interface RatePlanSeed {
  readonly id: string;
  readonly code: string;
}

interface ExistingRow {
  readonly id: string;
}

const manifestFiles = Object.freeze([
  new URL("../fixtures/scenario-foundations/v1/india.json", import.meta.url),
  new URL("../fixtures/scenario-foundations/v1/canada.json", import.meta.url),
]);

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertExact(subject: string, actual: unknown, expected: unknown): void {
  if (stable(actual) !== stable(expected)) {
    throw new Error(`${subject} collides with non-canonical ${SCENARIO_REVIEW_VERSION} data`);
  }
}

async function deterministicId(name: string): Promise<string> {
  return uuidV5(URL_NAMESPACE_UUID, `${TENANT_NAME}/${SCENARIO_REVIEW_VERSION}/${name}`);
}

function requestId(property: PropertySpec, operation: string, suffix: string): Promise<string> {
  return deterministicId(`${property.scenario.scenarioKey}/${operation}/${suffix}`);
}

async function envelope(
  property: PropertySpec,
  actorId: string,
  operation: string,
  suffix: string,
): Promise<AuditEnvelope> {
  return createAuditEnvelope({
    actorId,
    tenantId: SEED_TENANT.id,
    propertyNode: property.propertyId,
    requestId: await requestId(property, operation, suffix),
    operation,
  });
}

function parseManifest(file: URL): { manifest: ScenarioManifest; scenario: GeneratedScenario } {
  const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
  const scenario = compileScenarioFoundation(raw);
  const scenarioKey = scenario.scenarioKey as ScenarioKey;
  const approved = APPROVED_SCENARIO_HASHES[scenarioKey];
  if (approved === undefined || scenario.sourceHashSha256 !== approved) {
    throw new Error(`Scenario manifest ${scenario.scenarioKey} is not the exact independently approved source`);
  }
  if (scenario.dateWindow.startLocalDate !== "2024-01-01" ||
      scenario.dateWindow.endLocalDateExclusive !== "2027-01-01" ||
      scenario.dateWindow.dayCount !== 1_096 || scenario.dailyDemandInputs.length !== 1_096) {
    throw new Error(`Scenario manifest ${scenario.scenarioKey} does not have the approved 1,096-day window`);
  }
  return { manifest: raw as ScenarioManifest, scenario };
}

async function specs(): Promise<readonly PropertySpec[]> {
  const parsed = manifestFiles.map(parseManifest);
  return Promise.all(parsed.map(async ({ manifest, scenario }) => {
    const india = scenario.scenarioKey === "india-riverstone";
    return Object.freeze({
      manifest,
      scenario,
      propertyId: await deterministicId(`${scenario.scenarioKey}/property`),
      path: india ? "yellow_demo.riverstone" : "yellow_demo.harbourlight",
      shortCode: india ? "RIV" as const : "HAR" as const,
    });
  }));
}

async function loadIdentity(tx: Tx): Promise<Identity> {
  const users = await tx<Array<{ id: string; email: string; status: string }>>`
    SELECT id, email, status FROM app_user
    WHERE tenant_id=${SEED_TENANT.id}::uuid AND email IN (${REVIEW_EMAIL}, ${REVIEW_APPROVER_EMAIL})
    ORDER BY email
  `;
  if (users.length !== 2 || users.some(({ status }) => status !== "active")) {
    throw new Error("Canonical active local-review operator and approver must exist before scenario seeding");
  }
  const operatorId = users.find(({ email }) => email === REVIEW_EMAIL)?.id;
  const approverId = users.find(({ email }) => email === REVIEW_APPROVER_EMAIL)?.id;
  const roles = await tx<Array<{ id: string; name: string }>>`
    SELECT id, name FROM role WHERE tenant_id=${SEED_TENANT.id}::uuid
      AND name IN (${REVIEW_ROLE_NAME}, ${REVIEW_APPROVER_ROLE_NAME})
  `;
  const roleId = roles.find(({ name }) => name === REVIEW_ROLE_NAME)?.id;
  const approverRoleId = roles.find(({ name }) => name === REVIEW_APPROVER_ROLE_NAME)?.id;
  if (!operatorId || !approverId || !roleId || !approverRoleId || roles.length !== 2) {
    throw new Error("Canonical local-review identity or role is ambiguous");
  }
  return { operatorId, approverId, roleId, approverRoleId };
}

async function ensureProperty(tx: Tx, spec: PropertySpec, identity: Identity): Promise<void> {
  const expected = {
    id: spec.propertyId,
    tenant_id: SEED_TENANT.id,
    path: spec.path,
    kind: "property",
    name: spec.scenario.property.displayName,
    timezone: spec.scenario.property.timeZone,
    currency: spec.scenario.property.currency,
    config: {
      scenario_review: {
        version: SCENARIO_REVIEW_VERSION,
        source_hash_sha256: spec.scenario.sourceHashSha256,
        synthetic: true,
        tax_fiscal: "pending_policy",
      },
    },
  };
  const rows = await tx<Array<typeof expected>>`
    SELECT id, tenant_id, path::text AS path, kind, name, timezone, currency::text, config
    FROM org_node WHERE id=${spec.propertyId}::uuid OR (tenant_id=${SEED_TENANT.id}::uuid AND path=${spec.path}::ltree)
    ORDER BY id
  `;
  if (rows.length === 0) {
    await tx`
      INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency, config)
      VALUES (${expected.id}::uuid, ${expected.tenant_id}::uuid, ${expected.path}::ltree,
        ${expected.kind}, ${expected.name}, ${expected.timezone}, ${expected.currency}::char(3),
        ${JSON.stringify(expected.config)}::text::jsonb)
    `;
  } else {
    if (rows.length !== 1) throw new Error(`${spec.scenario.scenarioKey} property identity is ambiguous`);
    assertExact(`${spec.scenario.scenarioKey} property`, rows[0], expected);
  }
  for (const userId of [identity.operatorId, identity.approverId]) {
    await tx`
      INSERT INTO user_role (tenant_id, user_id, role_id, scope_node)
      VALUES (${SEED_TENANT.id}::uuid, ${userId}::uuid, ${identity.roleId}::uuid, ${spec.propertyId}::uuid)
      ON CONFLICT (user_id, role_id, scope_node) DO NOTHING
    `;
  }
  await tx`
    INSERT INTO user_role (tenant_id, user_id, role_id, scope_node)
    VALUES (${SEED_TENANT.id}::uuid, ${identity.approverId}::uuid,
      ${identity.approverRoleId}::uuid, ${spec.propertyId}::uuid)
    ON CONFLICT (user_id, role_id, scope_node) DO NOTHING
  `;
}

async function ensureInventory(
  tx: Tx,
  spec: PropertySpec,
  actorId: string,
  inventory: InventoryService,
): Promise<{ unitTypes: readonly UnitTypeSeed[]; rooms: readonly RoomSeed[] }> {
  const unitTypes: UnitTypeSeed[] = [];
  const rooms: RoomSeed[] = [];
  let roomOrdinal = 0;
  for (const [typeIndex, roomType] of spec.manifest.roomTypes.entries()) {
    const attrs = {
      scenario_review: SCENARIO_REVIEW_VERSION,
      scenario_key: spec.scenario.scenarioKey,
      room_class: roomType.classCode,
      child_capacity: roomType.childCapacity,
      accessible: roomType.accessible,
      connects_to_type_codes: roomType.connectsToTypeCodes,
    };
    const found = await tx<Array<{
      id: string; code: string; name: string; profile_key: string;
      base_occupancy: number; max_occupancy: number; attrs: unknown; sort_order: number;
    }>>`
      SELECT id, code, name, profile_key, base_occupancy, max_occupancy, attrs, sort_order
      FROM unit_type WHERE tenant_id=${SEED_TENANT.id}::uuid
        AND property_node=${spec.propertyId}::uuid AND code=${roomType.code}
    `;
    let id: string;
    if (found.length === 0) {
      const created = await inventory.createUnitType(tx, {
        code: roomType.code,
        name: roomType.label,
        profileKey: "hotel",
        baseOccupancy: Math.min(2, roomType.adultCapacity),
        maxOccupancy: roomType.adultCapacity + roomType.childCapacity,
        attrs,
        sortOrder: (typeIndex + 1) * 10,
        envelope: await envelope(spec, actorId, "unit_type.created", roomType.code),
      });
      id = created.id;
    } else {
      if (found.length !== 1 || !found[0]) throw new Error(`${roomType.code} unit type is ambiguous`);
      const row = found[0];
      assertExact(`${spec.scenario.scenarioKey}/${roomType.code} unit type`, {
        code: row.code, name: row.name, profile_key: row.profile_key,
        base_occupancy: row.base_occupancy, max_occupancy: row.max_occupancy,
        attrs: row.attrs, sort_order: row.sort_order,
      }, {
        code: roomType.code, name: roomType.label, profile_key: "hotel",
        base_occupancy: Math.min(2, roomType.adultCapacity),
        max_occupancy: roomType.adultCapacity + roomType.childCapacity,
        attrs, sort_order: (typeIndex + 1) * 10,
      });
      id = row.id;
    }
    unitTypes.push({ id, code: roomType.code, maxOccupancy: roomType.adultCapacity + roomType.childCapacity });

    for (let withinType = 0; withinType < roomType.quantity; withinType += 1) {
      roomOrdinal += 1;
      const roomCode = `${spec.shortCode}-${String(roomOrdinal).padStart(3, "0")}`;
      const roomAttrs = {
        scenario_review: SCENARIO_REVIEW_VERSION,
        scenario_key: spec.scenario.scenarioKey,
        room_type: roomType.code,
        room_class: roomType.classCode,
        child_capacity: roomType.childCapacity,
        accessible: roomType.accessible,
        connects_to_type_codes: roomType.connectsToTypeCodes,
      };
      const existingSpace = await tx<Array<{
        id: string; code: string; profile_key: string; capacity: number;
        max_occupancy: number | null; floor: string | null; attrs: unknown; status: string;
      }>>`
        SELECT id, code, profile_key, capacity, max_occupancy, floor, attrs, status
        FROM space WHERE tenant_id=${SEED_TENANT.id}::uuid
          AND property_node=${spec.propertyId}::uuid AND code=${roomCode}
      `;
      let spaceId: string;
      const floor = String(Math.floor(withinType / 10) + typeIndex + 1);
      if (existingSpace.length === 0) {
        const created = await inventory.createSpace(tx, {
          code: roomCode,
          profileKey: "hotel",
          capacity: 1,
          maxOccupancy: roomType.adultCapacity + roomType.childCapacity,
          floor,
          attrs: roomAttrs,
          envelope: await envelope(spec, actorId, "space.created", roomCode),
        });
        spaceId = created.id;
      } else {
        if (existingSpace.length !== 1 || !existingSpace[0]) throw new Error(`${roomCode} space is ambiguous`);
        const row = existingSpace[0];
        assertExact(`${spec.scenario.scenarioKey}/${roomCode} space`, {
          code: row.code, profile_key: row.profile_key, capacity: row.capacity,
          max_occupancy: row.max_occupancy, floor: row.floor, attrs: row.attrs, status: row.status,
        }, {
          code: roomCode, profile_key: "hotel", capacity: 1,
          max_occupancy: roomType.adultCapacity + roomType.childCapacity,
          floor, attrs: roomAttrs, status: "active",
        });
        spaceId = row.id;
      }
      const existingSellable = await tx<Array<{
        id: string; unit_type_id: string; name: string; status: string; space_id: string; claim_mode: string;
      }>>`
        SELECT su.id, su.unit_type_id, su.name, su.status, sus.space_id, sus.claim_mode
        FROM sellable_unit AS su
        JOIN sellable_unit_space AS sus ON sus.tenant_id=su.tenant_id AND sus.sellable_unit_id=su.id
        WHERE su.tenant_id=${SEED_TENANT.id}::uuid AND sus.space_id=${spaceId}::uuid
        ORDER BY su.id
      `;
      let sellableId: string;
      if (existingSellable.length === 0) {
        const created = await inventory.createSellableUnit(tx, {
          unitTypeId: id,
          name: `Room ${roomCode}`,
          spaces: [{ spaceId, claimMode: "exclusive" }],
          envelope: await envelope(spec, actorId, "sellable_unit.created", roomCode),
        });
        sellableId = created.id;
      } else {
        if (existingSellable.length !== 1 || !existingSellable[0]) throw new Error(`${roomCode} sellable unit is ambiguous`);
        const row = existingSellable[0];
        assertExact(`${spec.scenario.scenarioKey}/${roomCode} sellable`, {
          unit_type_id: row.unit_type_id, name: row.name, status: row.status,
          space_id: row.space_id, claim_mode: row.claim_mode,
        }, { unit_type_id: id, name: `Room ${roomCode}`, status: "active", space_id: spaceId, claim_mode: "exclusive" });
        sellableId = row.id;
      }
      rooms.push({ id: sellableId, unitTypeId: id });
    }
  }
  if (unitTypes.length !== 5 || rooms.length !== 40) throw new Error(`${spec.scenario.scenarioKey} manifest no longer defines 5 types and 40 rooms`);
  return { unitTypes, rooms };
}

async function ensureRates(
  tx: Tx,
  spec: PropertySpec,
  actorId: string,
  unitTypes: readonly UnitTypeSeed[],
  configuration: RateConfigurationService,
  pricing: RatePricingService,
): Promise<readonly RatePlanSeed[]> {
  const policyIds = new Map<string, string>();
  for (const policy of spec.manifest.policies) {
    const name = `${spec.shortCode} ${policy.code} synthetic cancellation intent`;
    const content = policy.refundability === "refundable"
      ? { kind: "cancellation", rules: [{ before_hours: 48, penalty: { basis: "nights", value: 1 } }] }
      : { kind: "cancellation", rules: [{ before_hours: 876_000, penalty: { basis: "percent", value: 100 } }] };
    const existing = await tx<Array<{ id: string; kind: string; name: string; content: unknown }>>`
      SELECT id, kind, name, content FROM policy
      WHERE tenant_id=${SEED_TENANT.id}::uuid AND name=${name}
      ORDER BY id
    `;
    let id: string;
    if (existing.length === 0) {
      id = (await configuration.createPolicy(tx, {
        kind: "cancellation", name, content,
        envelope: await envelope(spec, actorId, "policy.created", policy.code),
      })).id;
    } else {
      if (existing.length !== 1 || !existing[0]) throw new Error(`${name} policy is ambiguous`);
      assertExact(`${name} policy`, { kind: existing[0].kind, name: existing[0].name, content: existing[0].content },
        { kind: "cancellation", name, content });
      id = existing[0].id;
    }
    policyIds.set(policy.code, id);
  }

  const plans: RatePlanSeed[] = [];
  for (const board of spec.manifest.boardPlans) {
    for (const policy of spec.manifest.policies) {
      const code = `${board.normalized === "room_only" ? "EP" : board.normalized === "breakfast" ? "CP" : board.normalized === "half_board" ? "MAP" : "AP"}_${policy.refundability === "refundable" ? "FLEX" : "NRF"}`;
      const name = `${board.label} · ${policy.refundability === "refundable" ? "Flexible" : "Non-refundable"} · synthetic untaxed`;
      const existing = await tx<Array<{
        id: string; code: string; name: string; currency: string; tax_inclusive: boolean;
        cancellation_policy: string | null; market_code: string | null; source_code: string | null; status: string;
      }>>`
        SELECT id, code, name, currency::text, tax_inclusive, cancellation_policy,
          market_code, source_code, status
        FROM rate_plan WHERE tenant_id=${SEED_TENANT.id}::uuid
          AND property_node=${spec.propertyId}::uuid AND code=${code}
      `;
      let id: string;
      if (existing.length === 0) {
        id = (await configuration.createRatePlan(tx, {
          code, name, currency: spec.scenario.property.currency, taxInclusive: false,
          // Policies are intentionally materialised but unattached: legal/tax terms remain pending.
          cancellationPolicyId: null, guaranteePolicyId: null, depositPolicyId: null,
          marketCode: "SYNTHETIC", sourceCode: "SCENARIO",
          envelope: await envelope(spec, actorId, "rate_plan.created", code),
        })).id;
      } else {
        if (existing.length !== 1 || !existing[0]) throw new Error(`${code} rate plan is ambiguous`);
        const row = existing[0];
        assertExact(`${spec.scenario.scenarioKey}/${code} rate plan`, {
          code: row.code, name: row.name, currency: row.currency, tax_inclusive: row.tax_inclusive,
          cancellation_policy: row.cancellation_policy, market_code: row.market_code,
          source_code: row.source_code, status: row.status,
        }, { code, name, currency: spec.scenario.property.currency, tax_inclusive: false,
          cancellation_policy: null, market_code: "SYNTHETIC", source_code: "SCENARIO", status: "active" });
        id = row.id;
      }
      plans.push({ id, code });

      for (const unitType of unitTypes) {
        const amount = BigInt((spec.shortCode === "RIV" ? 700_000 : 15_000) +
          plans.length * (spec.shortCode === "RIV" ? 25_000 : 500) + unitTypes.indexOf(unitType) * (spec.shortCode === "RIV" ? 15_000 : 300));
        const occupancy = Object.fromEntries(Array.from({ length: unitType.maxOccupancy }, (_, index) => [String(index + 1), amount + BigInt(index) * (spec.shortCode === "RIV" ? 50_000n : 1_000n)]));
        const existingPrice = await tx<Array<{
          id: string; stay_start: string; stay_end: string; dow_mask: number; pricing: unknown;
        }>>`
          SELECT id, lower(stay_dates)::text AS stay_start, upper(stay_dates)::text AS stay_end,
            dow_mask, pricing
          FROM rate_price WHERE tenant_id=${SEED_TENANT.id}::uuid AND rate_plan_id=${id}::uuid
            AND unit_type_id=${unitType.id}::uuid AND superseded_by IS NULL
          ORDER BY id
        `;
        const expectedPricing = { occ: Object.fromEntries(Object.entries(occupancy).map(([key, value]) => [key, Number(value)])) };
        if (existingPrice.length === 0) {
          await pricing.create(tx, {
            ratePlanId: id, unitTypeId: unitType.id,
            stayStart: "2024-01-01", stayEnd: "2027-01-01", dowMask: 127,
            pricing: { occupancy },
            envelope: await envelope(spec, actorId, "rate_price.created", `${code}/${unitType.code}`),
          });
        } else {
          if (existingPrice.length !== 1 || !existingPrice[0]) throw new Error(`${code}/${unitType.code} current price is ambiguous`);
          const row = existingPrice[0];
          assertExact(`${spec.scenario.scenarioKey}/${code}/${unitType.code} price`, {
            stay_start: row.stay_start, stay_end: row.stay_end, dow_mask: row.dow_mask, pricing: row.pricing,
          }, { stay_start: "2024-01-01", stay_end: "2027-01-01", dow_mask: 127, pricing: expectedPricing });
        }
      }
    }
  }
  if (plans.length !== 8) throw new Error(`${spec.scenario.scenarioKey} no longer defines eight board/refund rate combinations`);
  return plans;
}

async function ensureParty(
  tx: Tx,
  spec: PropertySpec,
  actorId: string,
  parties: PartyProfileService,
): Promise<string> {
  const email = `${spec.scenario.scenarioKey}@synthetic.yellow.invalid`;
  const displayName = `${spec.shortCode} Synthetic Scenario Guest`;
  const rows = await tx<Array<{ id: string; kind: string; display_name: string; legal_name: string | null; status: string }>>`
    SELECT p.id, p.kind, p.display_name, p.legal_name, p.status
    FROM party AS p JOIN contact_point AS cp ON cp.tenant_id=p.tenant_id AND cp.party_id=p.id
    WHERE p.tenant_id=${SEED_TENANT.id}::uuid AND cp.kind='email' AND cp.value=${email}
    ORDER BY p.id
  `;
  if (rows.length === 0) {
    const result = await parties.create(tx, {
      kind: "person", displayName, legalName: null, roles: ["guest"],
      contacts: [{ kind: "email", value: email, isPrimary: true }],
      acknowledgedDuplicatePartyIds: [],
      idempotencyKey: `${SCENARIO_REVIEW_VERSION}:party:${spec.scenario.scenarioKey}`,
      envelope: await envelope(spec, actorId, "party.created", "primary-guest"),
    });
    return result.party.partyId;
  }
  if (rows.length !== 1 || !rows[0]) throw new Error(`${spec.scenario.scenarioKey} synthetic Party is ambiguous`);
  assertExact(`${spec.scenario.scenarioKey} synthetic Party`, rows[0], {
    id: rows[0].id, kind: "person", display_name: displayName, legal_name: null, status: "active",
  });
  const roles = await tx<Array<{ role: string }>>`
    SELECT role FROM party_role WHERE tenant_id=${SEED_TENANT.id}::uuid AND party_id=${rows[0].id}::uuid ORDER BY role
  `;
  assertExact(`${spec.scenario.scenarioKey} synthetic Party roles`, roles, [{ role: "guest" }]);
  return rows[0].id;
}

function addLocalDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function zonedInstant(localDate: string, hour: number, timeZone: string): Date {
  const [year, month, day] = localDate.split("-").map(Number) as [number, number, number];
  const wanted = Date.UTC(year, month - 1, day, hour);
  let guess = wanted;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(({ type, value }) => [type, value]));
    const rendered = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
    guess += wanted - rendered;
  }
  return new Date(guess);
}

async function ensureReservations(
  tx: Tx,
  spec: PropertySpec,
  actorId: string,
  partyId: string,
  rooms: readonly RoomSeed[],
  plans: readonly RatePlanSeed[],
  events: PostgresEventBus,
): Promise<{ reservationIds: readonly string[]; cancelled: number; reserved: number }> {
  const lifecycle = new ReservationLifecycleService({ events, idempotency: new PostgresIdempotency() });
  const reservationIds: string[] = [];
  let cancelled = 0;
  let reserved = 0;
  for (const daily of spec.scenario.dailyDemandInputs) {
    const reservationId = await deterministicId(`${spec.scenario.scenarioKey}/reservation/${daily.localDate}`);
    const segmentId = await deterministicId(`${spec.scenario.scenarioKey}/segment/${daily.localDate}`);
    const room = rooms[daily.dayIndex % rooms.length]!;
    const manifestPolicy = spec.manifest.policies.find(({ code }) => code === daily.policyCode);
    const manifestBoard = spec.manifest.boardPlans.find(({ code }) => code === daily.boardPlanCode);
    if (!manifestPolicy || !manifestBoard) throw new Error(`${daily.localDate} references unknown policy or board plan`);
    const boardCode = manifestBoard.normalized === "room_only" ? "EP" : manifestBoard.normalized === "breakfast" ? "CP" : manifestBoard.normalized === "half_board" ? "MAP" : "AP";
    const planCode = `${boardCode}_${manifestPolicy.refundability === "refundable" ? "FLEX" : "NRF"}`;
    const plan = plans.find(({ code }) => code === planCode);
    if (!plan) throw new Error(`${daily.localDate} resolved no rate plan`);
    const partyShape = spec.manifest.partyShapes.find(({ code }) => code === daily.partyShapeCode);
    if (!partyShape) throw new Error(`${daily.localDate} resolved no party shape`);
    const from = zonedInstant(daily.localDate, 15, spec.scenario.property.timeZone);
    const to = zonedInstant(addLocalDays(daily.localDate, 1), 11, spec.scenario.property.timeZone);
    const expectedStatus = daily.localDate < SCENARIO_REVIEW_AS_OF_DATE ? "cancelled" : "reserved";
    const existing = await tx<Array<{
      reservation_id: string; reservation_status: string; property_node: string;
      primary_party: string; channel_code: string; currency: string;
      segment_id: string; segment_status: string; sellable_unit_id: string;
      unit_type_id: string; rate_plan_id: string; adults: number; children: unknown;
      from_at: Date; to_at: Date; primary_guests: number;
    }>>`
      SELECT r.id AS reservation_id, r.status AS reservation_status, r.property_node,
        r.primary_party, r.channel_code, r.currency::text,
        s.id AS segment_id, s.status AS segment_status, s.sellable_unit_id,
        s.unit_type_id, s.rate_plan_id, s.adults, s.children,
        lower(s.period) AS from_at, upper(s.period) AS to_at,
        (SELECT count(*)::int FROM reservation_guest g
          WHERE g.tenant_id=r.tenant_id AND g.reservation_id=r.id
            AND g.party_id=r.primary_party AND g.role='primary') AS primary_guests
      FROM reservation r
      JOIN reservation_segment s ON s.tenant_id=r.tenant_id AND s.reservation_id=r.id AND s.seq=1
      WHERE r.tenant_id=${SEED_TENANT.id}::uuid AND r.id=${reservationId}::uuid
      ORDER BY s.id
    `;
    if (existing.length > 0) {
      if (existing.length !== 1 || !existing[0]) throw new Error(`${daily.localDate} reservation is ambiguous`);
      const row = existing[0];
      assertExact(`${spec.scenario.scenarioKey}/${daily.localDate} reservation`, {
        reservation_id: row.reservation_id, reservation_status: row.reservation_status,
        property_node: row.property_node, primary_party: row.primary_party,
        channel_code: row.channel_code, currency: row.currency,
        segment_id: row.segment_id, segment_status: row.segment_status,
        sellable_unit_id: row.sellable_unit_id, unit_type_id: row.unit_type_id,
        rate_plan_id: row.rate_plan_id, adults: row.adults, children: row.children,
        from_at: row.from_at.toISOString(), to_at: row.to_at.toISOString(),
        primary_guests: row.primary_guests,
      }, {
        reservation_id: reservationId, reservation_status: expectedStatus,
        property_node: spec.propertyId, primary_party: partyId,
        channel_code: daily.sourceCode.startsWith("ota_") ? "scenario_review" : daily.sourceCode,
        currency: spec.scenario.property.currency,
        segment_id: segmentId, segment_status: expectedStatus === "cancelled" ? "cancelled" : "booked",
        sellable_unit_id: room.id, unit_type_id: room.unitTypeId,
        rate_plan_id: plan.id, adults: partyShape.adults,
        children: partyShape.childAges.map((age) => ({ age })),
        from_at: from.toISOString(), to_at: to.toISOString(), primary_guests: 1,
      });
      reservationIds.push(reservationId);
      if (expectedStatus === "cancelled") cancelled += 1;
      else reserved += 1;
      continue;
    }
    const ids = [reservationId, segmentId];
    const commits = new ReservationCommitService({
      holds: new HoldService(events), occupancy: new ReservationOccupancyService(events), events,
      idempotency: new PostgresIdempotency(), idFactory: () => ids.shift() ?? crypto.randomUUID(),
    });
    const committed = await commits.commitDirect(tx, {
      primaryPartyId: partyId, ratePlanId: plan.id,
      adults: partyShape.adults, childAges: partyShape.childAges,
      channelCode: daily.sourceCode.startsWith("ota_") ? "scenario_review" : daily.sourceCode,
      idempotencyKey: `${SCENARIO_REVIEW_VERSION}:reservation:${spec.scenario.scenarioKey}:${daily.localDate}`,
      sellableUnitId: room.id,
      from,
      to,
      envelope: await envelope(spec, actorId, "reservation.confirmed", daily.localDate),
    });
    if (committed.reservationId !== reservationId || committed.segmentId !== segmentId) {
      throw new Error(`${daily.localDate} reservation identity drifted`);
    }
    reservationIds.push(reservationId);
    if (daily.localDate < SCENARIO_REVIEW_AS_OF_DATE) {
      const result = await lifecycle.cancel(tx, {
        reservationId, reason: "Synthetic historical scenario completed outside implemented stay-ops lifecycle",
        idempotencyKey: `${SCENARIO_REVIEW_VERSION}:cancel:${spec.scenario.scenarioKey}:${daily.localDate}`,
        envelope: await envelope(spec, actorId, "reservation.cancelled", daily.localDate),
      });
      if (result.status !== "cancelled") throw new Error(`${daily.localDate} did not cancel through lifecycle`);
      cancelled += 1;
    } else {
      reserved += 1;
    }
  }
  return { reservationIds, cancelled, reserved };
}

async function ensureFinancialConfiguration(tx: Tx, spec: PropertySpec): Promise<void> {
  const seriesId = await deterministicId(`${spec.scenario.scenarioKey}/folio-series`);
  const revenueId = await deterministicId(`${spec.scenario.scenarioKey}/room-revenue`);
  const prefix = `${spec.shortCode}-FOL-`;
  const existingSeries = await tx<Array<{ id: string; prefix: string; fiscal: boolean }>>`
    SELECT id, prefix, fiscal FROM document_series
    WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${spec.propertyId}::uuid AND kind='folio'
  `;
  if (existingSeries.length === 0) {
    await tx`INSERT INTO document_series (id, tenant_id, property_node, kind, prefix, next_no, fiscal)
      VALUES (${seriesId}::uuid, ${SEED_TENANT.id}::uuid, ${spec.propertyId}::uuid, 'folio', ${prefix}, 1, false)`;
  } else {
    if (existingSeries.length !== 1 || !existingSeries[0]) throw new Error(`${spec.scenario.scenarioKey} folio series is ambiguous`);
    assertExact(`${spec.scenario.scenarioKey} folio series`, existingSeries[0], { id: seriesId, prefix, fiscal: false });
  }
  const revenue = await tx<Array<{ id: string; role: string; name: string; currency: string; status: string }>>`
    SELECT id, role, name, currency::text, status FROM account
    WHERE tenant_id=${SEED_TENANT.id}::uuid AND id=${revenueId}::uuid
  `;
  if (revenue.length === 0) {
    await tx`INSERT INTO account (id, tenant_id, property_node, role, name, currency, status)
      VALUES (${revenueId}::uuid, ${SEED_TENANT.id}::uuid, ${spec.propertyId}::uuid,
        'revenue', 'Room Revenue', ${spec.scenario.property.currency}::char(3), 'open')`;
  } else {
    if (revenue.length !== 1 || !revenue[0]) throw new Error(`${spec.scenario.scenarioKey} revenue account is ambiguous`);
    assertExact(`${spec.scenario.scenarioKey} revenue account`, revenue[0], {
      id: revenueId, role: "revenue", name: "Room Revenue", currency: spec.scenario.property.currency, status: "open",
    });
  }
  await tx`
    INSERT INTO tx_code_route (tenant_id, property_node, currency, tx_code, debit_account_id, credit_account_id)
    VALUES (${SEED_TENANT.id}::uuid, ${spec.propertyId}::uuid, ${spec.scenario.property.currency}::char(3),
      'ROOM', NULL, ${revenueId}::uuid)
    ON CONFLICT (tenant_id, property_node, currency, tx_code) DO NOTHING
  `;
  const routes = await tx<Array<{ credit_account_id: string; debit_account_id: string | null }>>`
    SELECT credit_account_id, debit_account_id FROM tx_code_route
    WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${spec.propertyId}::uuid
      AND currency=${spec.scenario.property.currency}::char(3) AND tx_code='ROOM'
  `;
  assertExact(`${spec.scenario.scenarioKey} ROOM route`, routes, [{ credit_account_id: revenueId, debit_account_id: null }]);
  await tx`
    INSERT INTO business_day (tenant_id, property_node, business_date)
    VALUES (${SEED_TENANT.id}::uuid, ${spec.propertyId}::uuid,
      (transaction_timestamp() AT TIME ZONE ${spec.scenario.property.timeZone})::date)
    ON CONFLICT (property_node, business_date) DO NOTHING
  `;
}

async function ensureFoliosAndCharges(
  tx: Tx,
  spec: PropertySpec,
  actorId: string,
  reservationIds: readonly string[],
  events: PostgresEventBus,
): Promise<void> {
  const folios = new FolioService({ events, idempotency: new PostgresIdempotency() });
  const charges = new ChargeService({ events, idempotency: new PostgresIdempotency() });
  const selected = reservationIds.slice(-12);
  if (selected.length !== 12) throw new Error(`${spec.scenario.scenarioKey} has fewer than twelve eligible folio reservations`);
  for (const [index, reservationId] of selected.entries()) {
    const opened = await folios.openPrimary(tx, {
      tenantId: SEED_TENANT.id, reservationId,
      idempotencyKey: `${SCENARIO_REVIEW_VERSION}:folio:${spec.scenario.scenarioKey}:${index}`,
      envelope: await envelope(spec, actorId, "folio.opened", String(index)),
    });
    const amountMinor = spec.shortCode === "RIV" ? String(850_000 + index * 10_000) : String(18_000 + index * 250);
    await charges.postCharge(tx, {
      tenantId: SEED_TENANT.id, folioId: opened.folioId, txCode: "ROOM", amountMinor,
      idempotencyKey: `${SCENARIO_REVIEW_VERSION}:charge:${spec.scenario.scenarioKey}:${index}`,
      envelope: await envelope(spec, actorId, "journal.posted", String(index)),
    });
  }
}

async function verifyProperty(tx: Tx, spec: PropertySpec): Promise<ScenarioReviewSeedResult["properties"][number]> {
  const rows = await tx<Array<{
    unit_types: number; rooms: number; rate_plans: number; rate_prices: number;
    reservations: number; cancelled: number; reserved: number; folios: number; charges: number;
  }>>`
    SELECT
      (SELECT count(*)::int FROM unit_type WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${spec.propertyId}::uuid) AS unit_types,
      (SELECT count(*)::int FROM space WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${spec.propertyId}::uuid) AS rooms,
      (SELECT count(*)::int FROM rate_plan WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${spec.propertyId}::uuid) AS rate_plans,
      (SELECT count(*)::int FROM rate_price rp JOIN rate_plan p ON p.id=rp.rate_plan_id AND p.tenant_id=rp.tenant_id WHERE p.tenant_id=${SEED_TENANT.id}::uuid AND p.property_node=${spec.propertyId}::uuid AND rp.superseded_by IS NULL) AS rate_prices,
      (SELECT count(*)::int FROM reservation WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${spec.propertyId}::uuid) AS reservations,
      (SELECT count(*)::int FROM reservation WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${spec.propertyId}::uuid AND status='cancelled') AS cancelled,
      (SELECT count(*)::int FROM reservation WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${spec.propertyId}::uuid AND status='reserved') AS reserved,
      (SELECT count(*)::int FROM folio f JOIN reservation r ON r.id=f.reservation_id AND r.tenant_id=f.tenant_id WHERE r.tenant_id=${SEED_TENANT.id}::uuid AND r.property_node=${spec.propertyId}::uuid) AS folios,
      (SELECT count(*)::int FROM journal WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${spec.propertyId}::uuid AND kind='charge') AS charges
  `;
  const row = rows[0];
  const expectedCancelled = spec.scenario.dailyDemandInputs.filter(({ localDate }) => localDate < SCENARIO_REVIEW_AS_OF_DATE).length;
  const expected = { unit_types: 5, rooms: 40, rate_plans: 8, rate_prices: 40,
    reservations: 1_096, cancelled: expectedCancelled, reserved: 1_096 - expectedCancelled,
    folios: 12, charges: 12 };
  assertExact(`${spec.scenario.scenarioKey} final cardinalities`, row, expected);
  return Object.freeze({
    scenarioKey: spec.scenario.scenarioKey as ScenarioKey,
    propertyId: spec.propertyId,
    propertyName: spec.scenario.property.displayName,
    unitTypes: expected.unit_types,
    rooms: expected.rooms,
    ratePlans: expected.rate_plans,
    ratePrices: expected.rate_prices,
    reservations: expected.reservations,
    cancelled: expected.cancelled,
    reserved: expected.reserved,
    folios: expected.folios,
    charges: expected.charges,
  });
}

export async function runScenarioReviewSeed(options: SeedOptions): Promise<ScenarioReviewSeedResult> {
  if (!options.databaseUrl) throw new Error("databaseUrl is required");
  const logger = options.logger ?? console.log;
  const propertySpecs = await specs();
  const eventPool = new SQL(options.databaseUrl, { max: 1, prepare: false });
  const events = new PostgresEventBus(eventPool);
  const database = Database.connect(options.databaseUrl, { maxConnections: 1, prepare: false });
  const authority = new SQL(options.databaseUrl, { max: 1 });
  try {
    // These rows have no product command service. Like the existing review seed,
    // establish and exact-check them with deployment authority before entering the
    // app-role transaction used for every domain mutation.
    const authorityConnection = await authority.reserve();
    let began = false;
    try {
      await authorityConnection.unsafe("BEGIN");
      began = true;
      await authorityConnection`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
      await authorityConnection`SELECT pg_advisory_xact_lock(hashtextextended(${`${SEED_TENANT.id}:${SCENARIO_REVIEW_VERSION}:authority`}, 181))`;
      const identity = await loadIdentity(authorityConnection);
      for (const property of propertySpecs) {
        await ensureProperty(authorityConnection, property, identity);
        await ensureFinancialConfiguration(authorityConnection, property);
      }
      await authorityConnection.unsafe("COMMIT");
      began = false;
    } catch (error) {
      if (began) await authorityConnection.unsafe("ROLLBACK");
      throw error;
    } finally {
      authorityConnection.release();
    }
    const result = await database.withTenantTransaction(SEED_TENANT.id, async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`${SEED_TENANT.id}:${SCENARIO_REVIEW_VERSION}`}, 181))`;
      const identity = await loadIdentity(tx);
      const inventory = new InventoryService(events);
      const configuration = new RateConfigurationService(events);
      const pricing = new RatePricingService(events);
      const parties = new PartyProfileService({ events, idempotency: new PostgresIdempotency() });
      const summaries: ScenarioReviewSeedResult["properties"][number][] = [];
      for (const property of propertySpecs) {
        const inventorySeed = await ensureInventory(tx, property, identity.operatorId, inventory);
        const plans = await ensureRates(tx, property, identity.operatorId, inventorySeed.unitTypes, configuration, pricing);
        const partyId = await ensureParty(tx, property, identity.operatorId, parties);
        const reservations = await ensureReservations(tx, property, identity.operatorId, partyId,
          inventorySeed.rooms, plans, events);
        if (reservations.cancelled + reservations.reserved !== 1_096) throw new Error("Reservation status partition drifted");
        await ensureFoliosAndCharges(tx, property, identity.operatorId, reservations.reservationIds, events);
        summaries.push(await verifyProperty(tx, property));
      }
      return Object.freeze({
        version: SCENARIO_REVIEW_VERSION,
        asOfLocalDate: SCENARIO_REVIEW_AS_OF_DATE,
        properties: Object.freeze(summaries),
      });
    });
    logger(`scenario review seed: ${result.properties.length} properties, ${result.properties.reduce((n, item) => n + item.reservations, 0)} stays`);
    return result;
  } finally {
    await database.close();
    await eventPool.close({ timeout: 0 });
    await authority.close({ timeout: 0 });
  }
}

if (import.meta.main) {
  const databaseUrl = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("YELLOW_DEPLOY_DATABASE_URL or DATABASE_URL is required");
  await runScenarioReviewSeed({ databaseUrl });
}
