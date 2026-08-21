import { LocalLoginService, type LocalLoginInput } from "../contexts/identity";
import {
  AvailabilityService,
  InventoryValidationError,
  type SearchAvailabilityInput,
} from "../contexts/inventory";
import type { TenantRequestContext } from "../kernel";

const AVAILABILITY_SCOPE = "inventory.availability:read";
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
  return typeof context.identity.actorId === "string" &&
    context.identity.scopes?.includes(AVAILABILITY_SCOPE) === true;
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
}): Promise<PropertyRow[]> {
  return context.tx<PropertyRow[]>`
    SELECT DISTINCT target.id, target.name, target.timezone, target.currency
    FROM user_role
    JOIN role
      ON role.id = user_role.role_id
     AND role.tenant_id = user_role.tenant_id
    JOIN role_permission
      ON role_permission.role_id = role.id
     AND role_permission.permission_code = ${AVAILABILITY_SCOPE}
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

export class OperatorHttpApi {
  readonly #login: LocalLoginService;
  readonly #availability: Pick<AvailabilityService, "search">;

  constructor(login: LocalLoginService, availability: Pick<AvailabilityService, "search"> = new AvailabilityService()) {
    this.#login = login;
    this.#availability = availability;
  }

  unavailable(request: Request): Response {
    return apiError(request, 503, "service/unavailable", "Service unavailable", "Operator service is temporarily unavailable");
  }

  unauthorized(request: Request): Response {
    return apiError(request, 401, "auth/unauthorized", "Authentication required", "A valid bearer token is required");
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
