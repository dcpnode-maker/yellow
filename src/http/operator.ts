import { LocalLoginService, type LocalLoginInput } from "../contexts/identity";
import {
  AvailabilityService,
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryService,
  InventoryValidationError,
  type CreateSellableUnitInput,
  type CreateSpaceInput,
  type CreateUnitTypeInput,
  type SearchAvailabilityInput,
} from "../contexts/inventory";
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

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
  "listUnitTypes" | "listSpaces" | "listSellableUnits"
>;

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

function jsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

export class OperatorHttpApi {
  readonly #login: LocalLoginService;
  readonly #availability: Pick<AvailabilityService, "search">;
  readonly #inventory?: InventoryOperations;
  readonly #idempotency: PostgresIdempotency;

  constructor(
    login: LocalLoginService,
    availability: Pick<AvailabilityService, "search"> = new AvailabilityService(),
    inventory?: InventoryOperations,
    idempotency = new PostgresIdempotency(),
  ) {
    this.#login = login;
    this.#availability = availability;
    this.#inventory = inventory;
    this.#idempotency = idempotency;
  }

  unavailable(request: Request): Response {
    return apiError(request, 503, "service/unavailable", "Service unavailable", "Operator service is temporarily unavailable");
  }

  unauthorized(request: Request): Response {
    return apiError(request, 401, "auth/unauthorized", "Authentication required", "A valid bearer token is required");
  }

  failure(request: Request, error: unknown): Response {
    if (error instanceof IdempotencyConflictError || error instanceof InventoryConflictError) {
      const type = error instanceof IdempotencyConflictError ? "request/idempotency_conflict" : "inventory/conflict";
      return apiError(request, 409, type, "Conflict", "The inventory request conflicts with existing state");
    }
    if (error instanceof IdempotencyValidationError || error instanceof InventoryValidationError) {
      return apiError(request, 400, "request/invalid", "Invalid request", "Inventory input is invalid");
    }
    if (error instanceof InventoryNotFoundError) {
      return apiError(request, 404, "inventory/not_found", "Not found", "Referenced inventory was not found");
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
