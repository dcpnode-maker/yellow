import { LocalLoginService, type LocalLoginInput } from "../contexts/identity";
import {
  AvailabilityService,
  AvailabilityProjectionService,
  HoldConflictError,
  HoldService,
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryPolicyService,
  InventoryService,
  InventoryValidationError,
  OperationalBlockConflictError,
  OperationalBlockService,
  RestrictionService,
  type CreateSellableUnitInput,
  type CreateSpaceInput,
  type CreateUnitTypeInput,
  type RestrictionDraft,
  type RestrictionKind,
  type SearchAvailabilityInput,
  type RebuildAvailabilityProjectionInput,
} from "../contexts/inventory";
import {
  RateConfigurationService,
  RateConflictError,
  RateNotFoundError,
  RatePricingService,
  RateValidationError,
  type CreatePolicyInput,
  type CreateRatePriceInput,
  type CreateRatePlanInput,
  type PolicyKind,
  type RatePricingInput,
} from "../contexts/rates";
import {
  createAuditEnvelope,
  IdempotencyConflictError,
  IdempotencyValidationError,
  PostgresIdempotency,
  type JsonValue,
  type TenantRequestContext,
  type Tx,
} from "../kernel";

const AVAILABILITY_SCOPE = "inventory.availability:read";
const CONFIGURATION_READ_SCOPE = "inventory.configuration:read";
const CONFIGURATION_WRITE_SCOPE = "inventory.configuration:write";
const RESTRICTION_READ_SCOPE = "inventory.restriction:read";
const RESTRICTION_WRITE_SCOPE = "inventory.restriction:write";
const RATE_READ_SCOPE = "rates.configuration:read";
const RATE_WRITE_SCOPE = "rates.configuration:write";
const PRICING_READ_SCOPE = "rates.pricing:read";
const PRICING_WRITE_SCOPE = "rates.pricing:write";
const BLOCK_READ_SCOPE = "inventory.blocks:read";
const BLOCK_WRITE_SCOPE = "inventory.blocks:write";
const POLICY_READ_SCOPE = "inventory.policy:read";
const POLICY_WRITE_SCOPE = "inventory.policy:write";
const HOLD_READ_SCOPE = "inventory.holds:read";
const HOLD_WRITE_SCOPE = "inventory.holds:write";
const OFFLINE_LEASE_READ_SCOPE = "inventory.offline_leases:read";
const OFFLINE_LEASE_WRITE_SCOPE = "inventory.offline_leases:write";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key));
}

function correlationId(request: Request): string {
  const candidate = request.headers.get("x-correlation-id");
  return candidate && UUID.test(candidate) ? candidate : crypto.randomUUID();
}

function apiResponse(
  request: Request,
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  const correlation = correlationId(request);
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-correlation-id": correlation,
      ...Object.fromEntries(new Headers(extraHeaders)),
    },
  });
}

function apiError(request: Request, status: number, type: string, title: string, detail: string): Response {
  const correlation = correlationId(request);
  return Response.json({ type, title, status, detail, correlation_id: correlation }, {
    status,
    headers: { "cache-control": "no-store", "x-correlation-id": correlation },
  });
}

function hasAvailabilityScope(context: TenantRequestContext): context is TenantRequestContext & {
  identity: { actorId: string; scopes: readonly string[] };
} {
  return hasScope(context, AVAILABILITY_SCOPE);
}

function hasScope(context: TenantRequestContext, scope: string): context is TenantRequestContext & {
  identity: { actorId: string; scopes: readonly string[] };
} {
  return typeof context.identity.actorId === "string" && context.identity.scopes?.includes(scope) === true;
}

function parseInstant(value: unknown): Date | null {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function parseSearch(body: unknown): Omit<SearchAvailabilityInput, "propertyNode"> | null {
  if (!isObject(body) || !exactKeys(body, ["from", "to"], ["partySize", "ratePlanId", "channelCode"])) {
    return null;
  }
  const from = parseInstant(body.from);
  const to = parseInstant(body.to);
  if (!from || !to) return null;
  if (body.partySize !== undefined && typeof body.partySize !== "number") return null;
  if (body.ratePlanId !== undefined && typeof body.ratePlanId !== "string") return null;
  if (body.channelCode !== undefined && typeof body.channelCode !== "string") return null;
  return {
    from,
    to,
    ...(body.partySize === undefined ? {} : { partySize: body.partySize }),
    ...(body.ratePlanId === undefined ? {} : { ratePlanId: body.ratePlanId }),
    ...(body.channelCode === undefined ? {} : { channelCode: body.channelCode }),
  };
}

function parseProjectionRebuild(body: unknown): Omit<RebuildAvailabilityProjectionInput, "propertyNode"> | null {
  if (!isObject(body) || !exactKeys(body, ["fromDate", "toDate"])) return null;
  if (typeof body.fromDate !== "string" || !LOCAL_DATE.test(body.fromDate) ||
      typeof body.toDate !== "string" || !LOCAL_DATE.test(body.toDate)) return null;
  return { fromDate: body.fromDate, toDate: body.toDate };
}

function parseHold(body: unknown): { sellableUnitId: string; from: Date; to: Date; holderReference: string } | null {
  if (!isObject(body) || !exactKeys(body, ["sellableUnitId", "from", "to", "holderReference"]) ||
      typeof body.sellableUnitId !== "string" || !UUID.test(body.sellableUnitId) ||
      typeof body.holderReference !== "string" || body.holderReference !== body.holderReference.trim() ||
      !/^[^\u0000-\u001f\u007f]{1,120}$/u.test(body.holderReference)) return null;
  const from = parseInstant(body.from);
  const to = parseInstant(body.to);
  return from && to && from < to ? { sellableUnitId: body.sellableUnitId, from, to, holderReference: body.holderReference } : null;
}

function parseOfflineLease(body: unknown): {
  sellableUnitId: string;
  from: Date;
  to: Date;
  deviceId: string;
  deviceLabel?: string;
  leaseHours: number;
} | null {
  if (!isObject(body) ||
      !exactKeys(body, ["sellableUnitId", "from", "to", "deviceId", "leaseHours"], ["deviceLabel"]) ||
      typeof body.sellableUnitId !== "string" || !UUID.test(body.sellableUnitId) ||
      typeof body.deviceId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(body.deviceId) ||
      typeof body.leaseHours !== "number" || !Number.isInteger(body.leaseHours) ||
      body.leaseHours < 1 || body.leaseHours > 168 ||
      (body.deviceLabel !== undefined &&
        (typeof body.deviceLabel !== "string" || body.deviceLabel !== body.deviceLabel.trim() ||
          !/^[^\u0000-\u001f\u007f]{1,120}$/u.test(body.deviceLabel)))) return null;
  const from = parseInstant(body.from);
  const to = parseInstant(body.to);
  return from && to && from < to ? {
    sellableUnitId: body.sellableUnitId,
    from,
    to,
    deviceId: body.deviceId,
    ...(body.deviceLabel === undefined ? {} : { deviceLabel: body.deviceLabel }),
    leaseHours: body.leaseHours,
  } : null;
}

interface PropertyRow {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly currency: string | null;
}

async function listGrantedProperties(context: TenantRequestContext & {
  identity: { actorId: string; scopes: readonly string[] };
}, permissionCode = AVAILABILITY_SCOPE): Promise<PropertyRow[]> {
  return context.tx<PropertyRow[]>`
    SELECT DISTINCT target.id, target.name, target.timezone, target.currency
    FROM user_role
    JOIN role
      ON role.id = user_role.role_id
     AND role.tenant_id = user_role.tenant_id
    JOIN role_permission
      ON role_permission.role_id = role.id
     AND role_permission.permission_code = ${permissionCode}
    JOIN org_node AS grant_node
      ON grant_node.id = user_role.scope_node
     AND grant_node.tenant_id = user_role.tenant_id
    JOIN org_node AS target
      ON target.tenant_id = user_role.tenant_id
     AND target.kind = 'property'
     AND target.path <@ grant_node.path
    WHERE user_role.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND user_role.user_id = ${context.identity.actorId}::uuid
    ORDER BY target.name, target.id
  `;
}

type InventoryOperations = Pick<InventoryService,
  "createUnitType" | "createSpace" | "createSellableUnit" |
  "getUnitType" | "listUnitTypes" | "listSpaces" | "listSellableUnits"
>;

interface BulkRoomDraft {
  readonly code: string;
  readonly name?: string;
  readonly floor?: string;
}

function parseBulkRooms(body: unknown): { unitTypeId: string; rooms: readonly BulkRoomDraft[] } | null {
  if (!isObject(body) || !exactKeys(body, ["unitTypeId", "rooms"]) ||
      typeof body.unitTypeId !== "string" || !UUID.test(body.unitTypeId) ||
      !Array.isArray(body.rooms) || body.rooms.length < 1 || body.rooms.length > 200) return null;
  const rooms: BulkRoomDraft[] = [];
  const codes = new Set<string>();
  for (const item of body.rooms) {
    if (!isObject(item) || !exactKeys(item, ["code"], ["name", "floor"]) ||
        typeof item.code !== "string" ||
        (item.name !== undefined && typeof item.name !== "string") ||
        (item.floor !== undefined && typeof item.floor !== "string")) return null;
    if (item.name !== undefined &&
        (item.name !== item.name.trim() || item.name.length < 1 || item.name.length > 200)) return null;
    if (item.floor !== undefined &&
        (item.floor !== item.floor.trim() || item.floor.length < 1 || item.floor.length > 64)) return null;
    if (codes.has(item.code)) return null;
    codes.add(item.code);
    rooms.push({
      code: item.code,
      ...(item.name === undefined ? {} : { name: item.name }),
      ...(item.floor === undefined ? {} : { floor: item.floor }),
    });
  }
  return { unitTypeId: body.unitTypeId, rooms };
}

type RestrictionOperations = Pick<RestrictionService, "list" | "createBatch">;
const RESTRICTION_KINDS: readonly RestrictionKind[] = [
  "closed", "cta", "ctd", "min_los", "max_los", "min_adv", "max_adv",
];

function parseRestrictionBatch(body: unknown): readonly RestrictionDraft[] | null {
  if (!isObject(body) || !exactKeys(body, ["restrictions"]) || !Array.isArray(body.restrictions)) return null;
  const restrictions: RestrictionDraft[] = [];
  for (const item of body.restrictions) {
    if (!isObject(item) || !exactKeys(item, ["kind", "stayStart", "stayEnd"], [
      "value", "unitTypeId", "ratePlanId", "channelCode",
    ])) return null;
    if (typeof item.kind !== "string" || !RESTRICTION_KINDS.includes(item.kind as RestrictionKind) ||
        typeof item.stayStart !== "string" || typeof item.stayEnd !== "string") return null;
    if (item.value !== undefined && item.value !== null && typeof item.value !== "number") return null;
    if (item.unitTypeId !== undefined && item.unitTypeId !== null && typeof item.unitTypeId !== "string") return null;
    if (item.ratePlanId !== undefined && item.ratePlanId !== null && typeof item.ratePlanId !== "string") return null;
    if (item.channelCode !== undefined && item.channelCode !== null && typeof item.channelCode !== "string") return null;
    restrictions.push({
      kind: item.kind as RestrictionKind,
      stayStart: item.stayStart,
      stayEnd: item.stayEnd,
      ...(item.value === undefined ? {} : { value: item.value as number | null }),
      ...(item.unitTypeId === undefined ? {} : { unitTypeId: item.unitTypeId as string | null }),
      ...(item.ratePlanId === undefined ? {} : { ratePlanId: item.ratePlanId as string | null }),
      ...(item.channelCode === undefined ? {} : { channelCode: item.channelCode as string | null }),
    });
  }
  return restrictions;
}

type RateOperations = Pick<RateConfigurationService,
  "listPolicies" | "listRatePlans" | "createPolicy" | "createRatePlan"
>;

type PricingOperations = Pick<RatePricingService, "create" | "findCurrent" | "supersede">;
type BlockOperations = Pick<OperationalBlockService, "listActive" | "open" | "close">;
type PolicyOperations = Pick<InventoryPolicyService, "get" | "setOosSellability">;
type HoldOperations = Pick<HoldService,
  "listActive" | "place" | "release" |
  "listActiveOfflineLeases" | "placeOfflineLease" | "releaseOfflineLease"
>;

const MAX_MONEY = 9_223_372_036_854_775_807n;

function parseAmount(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)$/.test(value)) return null;
  const amount = BigInt(value);
  return amount <= MAX_MONEY ? amount : null;
}

function parsePricingValue(value: unknown): RatePricingInput | null {
  if (!isObject(value) || !exactKeys(value, ["occupancy"], ["extraAdultMinor", "extraChildren"]) ||
      !Array.isArray(value.occupancy) || value.occupancy.length === 0) return null;
  const occupancy: Record<string, bigint> = {};
  for (const tier of value.occupancy) {
    if (!isObject(tier) || !exactKeys(tier, ["adults", "amountMinor"]) ||
        !Number.isInteger(tier.adults) || (tier.adults as number) < 1 || (tier.adults as number) > 100 ||
        occupancy[String(tier.adults)] !== undefined) return null;
    const amount = parseAmount(tier.amountMinor);
    if (amount === null) return null;
    occupancy[String(tier.adults)] = amount;
  }
  const extraAdultMinor = value.extraAdultMinor === undefined ? undefined : parseAmount(value.extraAdultMinor);
  if (extraAdultMinor === null) return null;
  const rawChildren = value.extraChildren ?? [];
  if (!Array.isArray(rawChildren)) return null;
  const extraChildren: Array<{ maxAge: number; amountMinor: bigint }> = [];
  for (const child of rawChildren) {
    if (!isObject(child) || !exactKeys(child, ["maxAge", "amountMinor"]) || !Number.isInteger(child.maxAge)) return null;
    const amountMinor = parseAmount(child.amountMinor);
    if (amountMinor === null) return null;
    extraChildren.push({ maxAge: child.maxAge as number, amountMinor });
  }
  return { occupancy, ...(extraAdultMinor === undefined ? {} : { extraAdultMinor }),
    ...(value.extraChildren === undefined ? {} : { extraChildren }) };
}

function parsePricing(body: unknown): Omit<CreateRatePriceInput, "envelope"> | null {
  if (!isObject(body) || !exactKeys(body, ["ratePlanId", "unitTypeId", "stayStart", "stayEnd", "pricing"], ["dowMask"]) ||
      typeof body.ratePlanId !== "string" || typeof body.unitTypeId !== "string" ||
      typeof body.stayStart !== "string" || typeof body.stayEnd !== "string" ||
      (body.dowMask !== undefined && !Number.isInteger(body.dowMask))) return null;
  const pricing = parsePricingValue(body.pricing);
  if (!pricing) return null;
  return { ratePlanId: body.ratePlanId, unitTypeId: body.unitTypeId, stayStart: body.stayStart,
    stayEnd: body.stayEnd, ...(body.dowMask === undefined ? {} : { dowMask: body.dowMask as number }), pricing };
}

function ratePriceJson(price: Awaited<ReturnType<RatePricingService["findCurrent"]>>): JsonValue {
  return {
    id: price.id, tenantId: price.tenantId, propertyNode: price.propertyNode,
    ratePlanId: price.ratePlanId, unitTypeId: price.unitTypeId,
    stayStart: price.stayStart, stayEnd: price.stayEnd, dowMask: price.dowMask,
    currency: price.currency,
    pricing: {
      occupancy: Object.fromEntries(Object.entries(price.pricing.occupancy).map(([tier, amount]) => [tier, amount.toString()])),
      extraAdultMinor: price.pricing.extraAdultMinor?.toString() ?? null,
      extraChildren: price.pricing.extraChildren.map(({ maxAge, amountMinor }) => ({ maxAge, amountMinor: amountMinor.toString() })),
    },
    recordedAt: price.recordedAt.toISOString(), supersededBy: price.supersededBy,
  };
}

function canonicalJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalJson(item)]));
  }
  return value;
}

function parsePolicy(body: unknown): Omit<CreatePolicyInput, "envelope"> | null {
  if (!isObject(body) || !exactKeys(body, ["kind", "name", "content"]) ||
      typeof body.kind !== "string" || !(["cancellation", "deposit", "guarantee", "no_show"] as const)
        .includes(body.kind as PolicyKind) ||
      typeof body.name !== "string" || !isObject(body.content)) return null;
  return { kind: body.kind as PolicyKind, name: body.name, content: body.content };
}

function parseRatePlan(body: unknown): Omit<CreateRatePlanInput, "envelope"> | null {
  if (!isObject(body) || !exactKeys(body, ["code", "name", "currency"], [
    "taxInclusive", "cancellationPolicyId", "guaranteePolicyId", "depositPolicyId", "marketCode", "sourceCode",
  ]) || typeof body.code !== "string" || typeof body.name !== "string" || typeof body.currency !== "string") return null;
  if (body.taxInclusive !== undefined && typeof body.taxInclusive !== "boolean") return null;
  for (const key of ["cancellationPolicyId", "guaranteePolicyId", "depositPolicyId", "marketCode", "sourceCode"] as const) {
    if (body[key] !== undefined && body[key] !== null && typeof body[key] !== "string") return null;
  }
  return {
    code: body.code,
    name: body.name,
    currency: body.currency,
    ...(body.taxInclusive === undefined ? {} : { taxInclusive: body.taxInclusive }),
    ...(body.cancellationPolicyId === undefined ? {} : { cancellationPolicyId: body.cancellationPolicyId as string | null }),
    ...(body.guaranteePolicyId === undefined ? {} : { guaranteePolicyId: body.guaranteePolicyId as string | null }),
    ...(body.depositPolicyId === undefined ? {} : { depositPolicyId: body.depositPolicyId as string | null }),
    ...(body.marketCode === undefined ? {} : { marketCode: body.marketCode as string | null }),
    ...(body.sourceCode === undefined ? {} : { sourceCode: body.sourceCode as string | null }),
  };
}

function parseUnitType(body: unknown): Omit<CreateUnitTypeInput, "envelope"> | null {
  if (!isObject(body) || !exactKeys(body, ["code", "name", "profileKey"], [
    "baseOccupancy", "maxOccupancy", "attrs", "sortOrder",
  ])) return null;
  if (typeof body.code !== "string" || typeof body.name !== "string" || typeof body.profileKey !== "string") return null;
  if (body.baseOccupancy !== undefined && typeof body.baseOccupancy !== "number") return null;
  if (body.maxOccupancy !== undefined && typeof body.maxOccupancy !== "number") return null;
  if (body.sortOrder !== undefined && typeof body.sortOrder !== "number") return null;
  if (body.attrs !== undefined && !isObject(body.attrs)) return null;
  return {
    code: body.code,
    name: body.name,
    profileKey: body.profileKey,
    ...(body.baseOccupancy === undefined ? {} : { baseOccupancy: body.baseOccupancy }),
    ...(body.maxOccupancy === undefined ? {} : { maxOccupancy: body.maxOccupancy }),
    ...(body.attrs === undefined ? {} : { attrs: body.attrs }),
    ...(body.sortOrder === undefined ? {} : { sortOrder: body.sortOrder }),
  };
}

function parseSpace(body: unknown): Omit<CreateSpaceInput, "envelope"> | null {
  if (!isObject(body) || !exactKeys(body, ["code", "profileKey"], [
    "capacity", "maxOccupancy", "floor", "areaSqm", "genderPolicy", "attrs",
  ])) return null;
  if (typeof body.code !== "string" || typeof body.profileKey !== "string") return null;
  if (body.capacity !== undefined && typeof body.capacity !== "number") return null;
  if (body.maxOccupancy !== undefined && body.maxOccupancy !== null && typeof body.maxOccupancy !== "number") return null;
  if (body.floor !== undefined && body.floor !== null && typeof body.floor !== "string") return null;
  if (body.areaSqm !== undefined && body.areaSqm !== null && typeof body.areaSqm !== "number") return null;
  if (body.genderPolicy !== undefined && body.genderPolicy !== null &&
      body.genderPolicy !== "any" && body.genderPolicy !== "female" && body.genderPolicy !== "male") return null;
  if (body.attrs !== undefined && !isObject(body.attrs)) return null;
  return {
    code: body.code,
    profileKey: body.profileKey,
    ...(body.capacity === undefined ? {} : { capacity: body.capacity }),
    ...(body.maxOccupancy === undefined ? {} : { maxOccupancy: body.maxOccupancy }),
    ...(body.floor === undefined ? {} : { floor: body.floor }),
    ...(body.areaSqm === undefined ? {} : { areaSqm: body.areaSqm }),
    ...(body.genderPolicy === undefined ? {} : { genderPolicy: body.genderPolicy }),
    ...(body.attrs === undefined ? {} : { attrs: body.attrs }),
  };
}

function parseSellableUnit(body: unknown): Omit<CreateSellableUnitInput, "envelope"> | null {
  if (!isObject(body) || !exactKeys(body, ["unitTypeId", "name", "spaces"]) ||
      typeof body.unitTypeId !== "string" || typeof body.name !== "string" || !Array.isArray(body.spaces)) return null;
  const spaces: Array<{ spaceId: string; claimMode: "exclusive" | "positional" }> = [];
  for (const item of body.spaces) {
    if (!isObject(item) || !exactKeys(item, ["spaceId", "claimMode"]) ||
        typeof item.spaceId !== "string" || (item.claimMode !== "exclusive" && item.claimMode !== "positional")) return null;
    spaces.push({ spaceId: item.spaceId, claimMode: item.claimMode });
  }
  return { unitTypeId: body.unitTypeId, name: body.name, spaces };
}

function parseOperationalBlock(body: unknown): { spaceId: string; kind: "ooo" | "oos";
  from: Date; to: Date; reason: string } | null {
  if (!isObject(body) || !exactKeys(body, ["spaceId", "kind", "from", "to", "reason"]) ||
      typeof body.spaceId !== "string" || (body.kind !== "ooo" && body.kind !== "oos") ||
      typeof body.from !== "string" || typeof body.to !== "string" || typeof body.reason !== "string" ||
      !ISO_INSTANT.test(body.from) || !ISO_INSTANT.test(body.to)) return null;
  const from = new Date(body.from);
  const to = new Date(body.to);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return null;
  return { spaceId: body.spaceId, kind: body.kind, from, to, reason: body.reason };
}

function jsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

export class OperatorHttpApi {
  readonly #login: LocalLoginService;
  readonly #availability: Pick<AvailabilityService, "search">;
  readonly #inventory?: InventoryOperations;
  readonly #idempotency: PostgresIdempotency;
  readonly #restrictions?: RestrictionOperations;
  readonly #rates?: RateOperations;
  readonly #pricing?: PricingOperations;
  readonly #blocks?: BlockOperations;
  readonly #policy?: PolicyOperations;
  readonly #holds?: HoldOperations;
  readonly #projection?: Pick<AvailabilityProjectionService, "status" | "replaceHorizon">;

  constructor(
    login: LocalLoginService,
    availability: Pick<AvailabilityService, "search"> = new AvailabilityService(),
    inventory?: InventoryOperations,
    idempotency = new PostgresIdempotency(),
    restrictions?: RestrictionOperations,
    rates?: RateOperations,
    pricing?: PricingOperations,
    blocks?: BlockOperations,
    policy?: PolicyOperations,
    holds?: HoldOperations,
    projection?: Pick<AvailabilityProjectionService, "status" | "replaceHorizon">,
  ) {
    this.#login = login;
    this.#availability = availability;
    this.#inventory = inventory;
    this.#idempotency = idempotency;
    this.#restrictions = restrictions;
    this.#rates = rates;
    this.#pricing = pricing;
    this.#blocks = blocks;
    this.#policy = policy;
    this.#holds = holds;
    this.#projection = projection;
  }

  unavailable(request: Request): Response {
    return apiError(request, 503, "service/unavailable", "Service unavailable", "Operator service is temporarily unavailable");
  }

  unauthorized(request: Request): Response {
    return apiError(request, 401, "auth/unauthorized", "Authentication required", "A valid bearer token is required");
  }

  failure(request: Request, error: unknown): Response {
    if (error instanceof IdempotencyConflictError || error instanceof InventoryConflictError ||
        error instanceof OperationalBlockConflictError || error instanceof HoldConflictError) {
      const type = error instanceof IdempotencyConflictError ? "request/idempotency_conflict" : "inventory/conflict";
      return apiError(request, 409, type, "Conflict", "The inventory request conflicts with existing state");
    }
    if (error instanceof RateConflictError) {
      return apiError(request, 409, "rates/conflict", "Conflict", "The rate configuration conflicts with existing state");
    }
    if (error instanceof IdempotencyValidationError || error instanceof InventoryValidationError) {
      return apiError(request, 400, "request/invalid", "Invalid request", "Inventory input is invalid");
    }
    if (error instanceof InventoryNotFoundError) {
      return apiError(request, 404, "inventory/not_found", "Not found", "Referenced inventory was not found");
    }
    if (error instanceof RateValidationError) {
      return apiError(request, 400, "request/invalid", "Invalid request", "Rate configuration input is invalid");
    }
    if (error instanceof RateNotFoundError) {
      return apiError(request, 404, "rates/not_found", "Not found", "Referenced rate configuration was not found");
    }
    return this.unavailable(request);
  }

  async login(request: Request, body: unknown): Promise<Response> {
    const hasValidShape = isObject(body) && exactKeys(body, ["tenant", "email", "password"]);
    const input = hasValidShape
      ? body as unknown as LocalLoginInput
      : { tenant: "", email: "", password: "" };
    try {
      const result = await this.#login.authenticate(input);
      if (!hasValidShape || !result) {
        return apiError(request, 401, "auth/invalid_credentials", "Authentication failed", "Invalid credentials");
      }
      return apiResponse(request, result);
    } catch {
      return apiError(request, 503, "service/unavailable", "Service unavailable", "Authentication is temporarily unavailable");
    }
  }

  async properties(context: TenantRequestContext): Promise<Response> {
    if (!hasAvailabilityScope(context)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Availability access is not granted");
    }
    try {
      return apiResponse(context.request, { properties: await listGrantedProperties(context) });
    } catch {
      return apiError(context.request, 503, "service/unavailable", "Service unavailable", "Property access is temporarily unavailable");
    }
  }

  async search(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    if (!hasAvailabilityScope(context)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Availability access is not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    const input = parseSearch(body);
    if (!input) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Availability search input is invalid");
    }

    try {
      const grants = await listGrantedProperties(context);
      if (!grants.some(({ id }) => id === propertyNode)) {
        return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
      }
      const options = await this.#availability.search(context.tx, { propertyNode, ...input });
      return apiResponse(context.request, { options });
    } catch (error) {
      if (error instanceof InventoryValidationError) {
        return apiError(context.request, 400, "request/invalid", "Invalid request", "Availability search input is invalid");
      }
      return apiError(context.request, 503, "service/unavailable", "Service unavailable", "Availability is temporarily unavailable");
    }
  }

  async inventory(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, CONFIGURATION_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Inventory configuration access is not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#inventory) return this.unavailable(context.request);
    try {
      const grants = await listGrantedProperties(context, CONFIGURATION_READ_SCOPE);
      if (!grants.some(({ id }) => id === propertyNode)) {
        return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
      }
      const [unitTypes, spaces, sellableUnits] = await Promise.all([
        this.#inventory.listUnitTypes(context.tx, propertyNode),
        this.#inventory.listSpaces(context.tx, propertyNode),
        this.#inventory.listSellableUnits(context.tx, propertyNode),
      ]);
      return apiResponse(context.request, { unitTypes, spaces, sellableUnits });
    } catch (error) {
      if (error instanceof InventoryValidationError) {
        return apiError(context.request, 400, "request/invalid", "Invalid request", "Inventory request is invalid");
      }
      return apiError(context.request, 503, "service/unavailable", "Service unavailable", "Inventory is temporarily unavailable");
    }
  }

  async availabilityProjection(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, CONFIGURATION_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Inventory configuration access is not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#projection) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, CONFIGURATION_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    return apiResponse(context.request, await this.#projection.status(context.tx, propertyNode));
  }

  async rebuildAvailabilityProjection(
    context: TenantRequestContext,
    propertyNode: string,
    body: unknown,
  ): Promise<Response> {
    const input = parseProjectionRebuild(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Projection range is invalid");
    if (!hasScope(context, CONFIGURATION_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Inventory configuration changes are not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#projection) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, CONFIGURATION_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: "operator.inventory.projection.rebuild",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { propertyNode, body },
    }, async (tx) => {
      await this.#projection!.replaceHorizon(tx, { propertyNode, ...input });
      return { status: 200, body: jsonValue(await this.#projection!.status(tx, propertyNode)) };
    });
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async createUnitType(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseUnitType(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Unit type input is invalid");
    return this.#create(context, propertyNode, body, "operator.inventory.unit_type.create", "unit_type.created",
      (tx, envelope) => this.#inventory!.createUnitType(tx, { ...input, envelope }));
  }

  async createSpace(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseSpace(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Space input is invalid");
    return this.#create(context, propertyNode, body, "operator.inventory.space.create", "space.created",
      (tx, envelope) => this.#inventory!.createSpace(tx, { ...input, envelope }));
  }

  async createSellableUnit(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseSellableUnit(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Sellable unit input is invalid");
    return this.#create(context, propertyNode, body, "operator.inventory.sellable_unit.create", "sellable_unit.created",
      (tx, envelope) => this.#inventory!.createSellableUnit(tx, { ...input, envelope }));
  }

  async createBulkRooms(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseBulkRooms(body);
    if (!input) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Bulk room input is invalid");
    }
    if (!hasScope(context, CONFIGURATION_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Inventory configuration changes are not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#inventory) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, CONFIGURATION_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: "operator.inventory.rooms.bulk",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { propertyNode, body },
    }, async (tx) => {
      const unitType = await this.#inventory!.getUnitType(tx, propertyNode, input.unitTypeId);
      if (unitType.profileKey !== "hotel") {
        throw new InventoryValidationError("Bulk room creation requires a hotel room type");
      }
      const rooms = [];
      for (const room of input.rooms) {
        const space = await this.#inventory!.createSpace(tx, {
          code: room.code,
          profileKey: unitType.profileKey,
          capacity: 1,
          maxOccupancy: unitType.maxOccupancy,
          ...(room.floor === undefined ? {} : { floor: room.floor }),
          envelope: createAuditEnvelope({
            actorId: context.identity.actorId,
            tenantId: context.tenantId,
            propertyNode,
            requestId,
            operation: "space.created",
          }),
        });
        const sellableUnit = await this.#inventory!.createSellableUnit(tx, {
          unitTypeId: unitType.id,
          name: room.name ?? `Room ${room.code}`,
          spaces: [{ spaceId: space.id, claimMode: "exclusive" }],
          envelope: createAuditEnvelope({
            actorId: context.identity.actorId,
            tenantId: context.tenantId,
            propertyNode,
            requestId,
            operation: "sellable_unit.created",
          }),
        });
        rooms.push({ space, sellableUnit });
      }
      return { status: 201, body: { rooms: jsonValue(rooms) } };
    });
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async operationalBlocks(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, BLOCK_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Operational-block access is not granted");
    }
    if (!UUID.test(propertyNode)) return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    if (!this.#blocks) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, BLOCK_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    return apiResponse(context.request, { operationalBlocks: jsonValue(await this.#blocks.listActive(context.tx, propertyNode)) });
  }

  async openOperationalBlock(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseOperationalBlock(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Operational-block input is invalid");
    if (!hasScope(context, BLOCK_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Operational-block changes are not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(input.spaceId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or space identifier is invalid");
    }
    if (!this.#blocks) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, BLOCK_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId, operation: "operator.inventory.blocks.open",
      key: context.request.headers.get("idempotency-key") ?? "", request: { propertyNode, body },
    }, async (tx) => ({ status: 201, body: { operationalBlock: jsonValue(await this.#blocks!.open(tx, {
      ...input, envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId, operation: "ooo.opened" }),
    })) } }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed), "x-correlation-id": requestId,
    });
  }

  async closeOperationalBlock(context: TenantRequestContext, propertyNode: string, blockId: string, body: unknown): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, [])) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Operational-block close input must be empty");
    }
    if (!hasScope(context, BLOCK_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Operational-block changes are not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(blockId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or block identifier is invalid");
    }
    if (!this.#blocks) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, BLOCK_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId, operation: "operator.inventory.blocks.close",
      key: context.request.headers.get("idempotency-key") ?? "", request: { propertyNode, blockId, body },
    }, async (tx) => ({ status: 200, body: { operationalBlock: jsonValue(await this.#blocks!.close(tx, {
      blockId, envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId, operation: "ooo.closed" }),
    })) } }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed), "x-correlation-id": requestId,
    });
  }

  async inventoryPolicy(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, POLICY_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Inventory-policy access is not granted");
    }
    if (!UUID.test(propertyNode)) return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    if (!this.#policy) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, POLICY_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    return apiResponse(context.request, { inventoryPolicy: await this.#policy.get(context.tx, propertyNode) });
  }

  async activeHolds(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, HOLD_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Cart-hold access is not granted");
    }
    if (!UUID.test(propertyNode)) return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    if (!this.#holds) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, HOLD_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    return apiResponse(context.request, { holds: jsonValue(await this.#holds.listActive(context.tx, propertyNode)) });
  }

  async placeHold(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseHold(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Cart-hold input is invalid");
    if (!hasScope(context, HOLD_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Cart-hold changes are not granted");
    }
    if (!UUID.test(propertyNode)) return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    if (!this.#holds) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, HOLD_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId, operation: "operator.inventory.holds.place",
      key: context.request.headers.get("idempotency-key") ?? "", request: { propertyNode, body },
    }, async (tx) => ({ status: 201, body: { hold: jsonValue(await this.#holds!.place(tx, {
      sellableUnitId: input.sellableUnitId, from: input.from, to: input.to, ttlSeconds: 600,
      holder: { reference: input.holderReference },
      envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId, operation: "hold.created" }),
    })) } }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed), "x-correlation-id": requestId,
    });
  }

  async releaseHold(context: TenantRequestContext, propertyNode: string, holdId: string, body: unknown): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, [])) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Cart-hold release input must be empty");
    }
    if (!hasScope(context, HOLD_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Cart-hold changes are not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(holdId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or hold identifier is invalid");
    }
    if (!this.#holds) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, HOLD_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId, operation: "operator.inventory.holds.release",
      key: context.request.headers.get("idempotency-key") ?? "", request: { propertyNode, holdId, body },
    }, async (tx) => ({ status: 200, body: { hold: jsonValue(await this.#holds!.release(tx, {
      holdId, envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId, operation: "hold.released" }),
    })) } }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed), "x-correlation-id": requestId,
    });
  }

  async activeOfflineLeases(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, OFFLINE_LEASE_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Offline-capacity access is not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#holds) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, OFFLINE_LEASE_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    return apiResponse(context.request, {
      offlineLeases: jsonValue(await this.#holds.listActiveOfflineLeases(context.tx, propertyNode)),
    });
  }

  async placeOfflineLease(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseOfflineLease(body);
    if (!input) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Offline-capacity input is invalid");
    }
    if (!hasScope(context, OFFLINE_LEASE_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Offline-capacity changes are not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#holds) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, OFFLINE_LEASE_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: "operator.inventory.offline_leases.place",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { propertyNode, body },
    }, async (tx) => {
      const options = await this.#availability.search(tx, {
        propertyNode,
        from: input.from,
        to: input.to,
        partySize: 1,
      });
      const exact = options.find(({ sellableUnitId }) => sellableUnitId === input.sellableUnitId);
      if (!exact?.bookable) {
        throw new HoldConflictError("Requested offline capacity is not currently bookable");
      }
      return {
        status: 201,
        body: { offlineLease: jsonValue(await this.#holds!.placeOfflineLease(tx, {
        sellableUnitId: input.sellableUnitId,
        from: input.from,
        to: input.to,
        ttlSeconds: input.leaseHours * 3_600,
        deviceId: input.deviceId,
        ...(input.deviceLabel === undefined ? {} : { deviceLabel: input.deviceLabel }),
        envelope: createAuditEnvelope({
          actorId: context.identity.actorId,
          tenantId: context.tenantId,
          propertyNode,
          requestId,
          operation: "hold.created",
        }),
        })) },
      };
    });
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async releaseOfflineLease(
    context: TenantRequestContext,
    propertyNode: string,
    leaseId: string,
    body: unknown,
  ): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, [])) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Offline-capacity release input must be empty");
    }
    if (!hasScope(context, OFFLINE_LEASE_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Offline-capacity changes are not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(leaseId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or lease identifier is invalid");
    }
    if (!this.#holds) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, OFFLINE_LEASE_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: "operator.inventory.offline_leases.release",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { propertyNode, leaseId, body },
    }, async (tx) => ({
      status: 200,
      body: { offlineLease: jsonValue(await this.#holds!.releaseOfflineLease(tx, {
        holdId: leaseId,
        envelope: createAuditEnvelope({
          actorId: context.identity.actorId,
          tenantId: context.tenantId,
          propertyNode,
          requestId,
          operation: "hold.released",
        }),
      })) },
    }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async setOosSellability(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, ["oosSellability"]) ||
        (body.oosSellability !== "blocked" && body.oosSellability !== "allowed")) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "OOS sellability input is invalid");
    }
    if (!hasScope(context, POLICY_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Inventory-policy changes are not granted");
    }
    if (!UUID.test(propertyNode)) return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    if (!this.#policy) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, POLICY_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId, operation: "operator.inventory.policy.oos_sellability",
      key: context.request.headers.get("idempotency-key") ?? "", request: { propertyNode, body },
    }, async (tx) => ({ status: 200, body: { inventoryPolicy: jsonValue(await this.#policy!.setOosSellability(tx, {
      value: body.oosSellability as "blocked" | "allowed",
      envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId, operation: "inventory.policy.changed" }),
    })) } }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed), "x-correlation-id": requestId,
    });
  }

  async restrictions(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, RESTRICTION_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Restriction access is not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#restrictions) return this.unavailable(context.request);
    try {
      const grants = await listGrantedProperties(context, RESTRICTION_READ_SCOPE);
      if (!grants.some(({ id }) => id === propertyNode)) {
        return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
      }
      return apiResponse(context.request, { restrictions: await this.#restrictions.list(context.tx, propertyNode) });
    } catch (error) {
      if (error instanceof InventoryValidationError) {
        return apiError(context.request, 400, "request/invalid", "Invalid request", "Restriction request is invalid");
      }
      return apiError(context.request, 503, "service/unavailable", "Service unavailable", "Restrictions are temporarily unavailable");
    }
  }

  async createRestrictions(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const restrictions = parseRestrictionBatch(body);
    if (!restrictions) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Restriction input is invalid");
    }
    if (!hasScope(context, RESTRICTION_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Restriction changes are not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#restrictions) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RESTRICTION_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: "operator.inventory.restriction.create",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { propertyNode, body },
    }, async (tx) => ({
      status: 201,
      body: { restrictions: jsonValue(await this.#restrictions!.createBatch(tx, {
        restrictions,
        envelope: createAuditEnvelope({
          actorId: context.identity.actorId,
          tenantId: context.tenantId,
          propertyNode,
          requestId,
          operation: "restriction.created",
        }),
      })) },
    }));
    return apiResponse(context.request, outcome.body, outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async rateConfiguration(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, RATE_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate configuration access is not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#rates) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RATE_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const [policies, ratePlans] = await Promise.all([
      this.#rates.listPolicies(context.tx),
      this.#rates.listRatePlans(context.tx, propertyNode),
    ]);
    return apiResponse(context.request, { policies, ratePlans });
  }

  async createPolicy(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parsePolicy(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Policy input is invalid");
    return this.#createRate(context, propertyNode, body, "operator.rates.policy.create", "policy.created",
      async (tx, envelope) => ({ policy: jsonValue(await this.#rates!.createPolicy(tx, { ...input, envelope })) }));
  }

  async createRatePlan(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseRatePlan(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate plan input is invalid");
    return this.#createRate(context, propertyNode, body, "operator.rates.rate_plan.create", "rate_plan.created",
      async (tx, envelope) => ({ ratePlan: jsonValue(await this.#rates!.createRatePlan(tx, { ...input, envelope })) }));
  }

  async currentRatePrice(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, PRICING_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate pricing access is not granted");
    }
    if (!UUID.test(propertyNode)) return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    if (!this.#pricing) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, PRICING_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const query = new URL(context.request.url).searchParams;
    const price = await this.#pricing.findCurrent(context.tx, {
      propertyNode,
      ratePlanId: query.get("ratePlanId") ?? "",
      unitTypeId: query.get("unitTypeId") ?? "",
      stayDate: query.get("stayDate") ?? "",
    });
    return apiResponse(context.request, { ratePrice: ratePriceJson(price) });
  }

  async createRatePrice(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parsePricing(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate pricing input is invalid");
    if (!hasScope(context, PRICING_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate pricing changes are not granted");
    }
    if (!UUID.test(propertyNode)) return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    if (!this.#pricing) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, PRICING_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: "operator.rates.price.create",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { propertyNode, body },
    }, async (tx) => ({
      status: 201,
      body: { ratePrice: ratePriceJson(await this.#pricing!.create(tx, {
        ...input,
        envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
          propertyNode, requestId, operation: "rate_price.created" }),
      })) },
    }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed), "x-correlation-id": requestId,
    });
  }

  async supersedeRatePrice(context: TenantRequestContext, propertyNode: string, ratePriceId: string, body: unknown): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, ["pricing"])) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate correction input is invalid");
    }
    const correctedPricing = parsePricingValue(body.pricing);
    if (!correctedPricing) return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate correction input is invalid");
    if (!hasScope(context, PRICING_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate pricing changes are not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(ratePriceId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or rate-price identifier is invalid");
    }
    if (!this.#pricing) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, PRICING_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId, operation: "operator.rates.price.supersede",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { propertyNode, ratePriceId, body },
    }, async (tx) => ({ status: 201, body: {
      ratePrice: ratePriceJson(await this.#pricing!.supersede(tx, {
        ratePriceId, pricing: correctedPricing,
        envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
          propertyNode, requestId, operation: "rate_price.superseded" }),
      })),
    } }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed), "x-correlation-id": requestId,
    });
  }

  async #createRate(
    context: TenantRequestContext,
    propertyNode: string,
    requestBody: unknown,
    idempotencyOperation: string,
    auditOperation: "policy.created" | "rate_plan.created",
    command: (tx: Tx, envelope: ReturnType<typeof createAuditEnvelope>) => Promise<JsonValue>,
  ): Promise<Response> {
    if (!hasScope(context, RATE_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate configuration changes are not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#rates) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RATE_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: idempotencyOperation,
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { propertyNode, body: requestBody },
    }, async (tx) => ({
      status: 201,
      body: await command(tx, createAuditEnvelope({
        actorId: context.identity.actorId,
        tenantId: context.tenantId,
        propertyNode,
        requestId,
        operation: auditOperation,
      })),
    }));
    return apiResponse(context.request, outcome.body, outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async #create(
    context: TenantRequestContext,
    propertyNode: string,
    requestBody: unknown,
    idempotencyOperation: string,
    auditOperation: string,
    command: (tx: Tx, envelope: ReturnType<typeof createAuditEnvelope>) => Promise<unknown>,
  ): Promise<Response> {
    if (!hasScope(context, CONFIGURATION_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Inventory configuration changes are not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#inventory) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, CONFIGURATION_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: idempotencyOperation,
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { propertyNode, body: requestBody },
    }, async (tx) => ({
      status: 201,
      body: jsonValue(await command(tx, createAuditEnvelope({
        actorId: context.identity.actorId,
        tenantId: context.tenantId,
        propertyNode,
        requestId,
        operation: auditOperation,
      }))),
    }));
    return apiResponse(context.request, outcome.body, outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }
}

const ASSET_URLS = {
  html: new URL("./operator/index.html", import.meta.url),
  css: new URL("./operator/operator.css", import.meta.url),
  js: new URL("./operator/operator.js", import.meta.url),
} as const;

function assetResponse(url: URL, contentType: string): Response {
  return new Response(Bun.file(url), {
    headers: { "cache-control": "no-cache", "content-type": contentType },
  });
}

export const operatorAssets = Object.freeze({
  html(): Response { return assetResponse(ASSET_URLS.html, "text/html; charset=utf-8"); },
  css(): Response { return assetResponse(ASSET_URLS.css, "text/css; charset=utf-8"); },
  js(): Response { return assetResponse(ASSET_URLS.js, "text/javascript; charset=utf-8"); },
});
