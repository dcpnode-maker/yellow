import {
  MARKET_COMPSET_READ_SCOPE,
  MARKET_COMPSET_WRITE_SCOPE,
  type MarketCompsetActor,
  type MarketCompsetPrincipal,
  type MarketCompsetResult,
  type MarketCompsetService,
} from "../contexts/distribution";
import type { TenantRequestContext } from "../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/u;

type MarketCompsetOperations = Pick<MarketCompsetService,
  "discovery" | "current" | "confirm" | "suggestIdentity" | "previewPlan" | "properties">;

function correlationId(request: Request): string {
  const candidate = request.headers.get("x-correlation-id");
  return candidate !== null && UUID.test(candidate) ? candidate : crypto.randomUUID();
}

function response(
  request: Request,
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
  correlation = correlationId(request),
): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-correlation-id": correlation,
      ...Object.fromEntries(new Headers(extraHeaders)),
    },
  });
}

function error(request: Request, status: number, type: string, title: string, detail: string, correlation = correlationId(request)): Response {
  return response(request, { type, title, status, detail, correlation_id: correlation }, status, {}, correlation);
}

function hasJsonContentType(request: Request): boolean {
  const value = request.headers.get("content-type");
  return value !== null && /^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(value);
}

function actorFor(
  context: TenantRequestContext,
  propertyNode: string,
  scope: string,
): MarketCompsetActor | null {
  if (!UUID.test(propertyNode) || typeof context.identity.actorId !== "string" || !UUID.test(context.identity.actorId)
    || context.identity.scopes?.includes(scope) !== true) return null;
  return Object.freeze({
    tenantId: context.tenantId,
    actorId: context.identity.actorId,
    propertyNode,
    requestId: correlationId(context.request),
    scopes: Object.freeze([...(context.identity.scopes ?? [])]),
  });
}

function principalFor(context: TenantRequestContext, scope: string): MarketCompsetPrincipal | null {
  if (typeof context.identity.actorId !== "string" || !UUID.test(context.identity.actorId)
    || context.identity.scopes?.includes(scope) !== true) return null;
  return Object.freeze({
    tenantId: context.tenantId,
    actorId: context.identity.actorId,
    requestId: correlationId(context.request),
    scopes: Object.freeze([...(context.identity.scopes ?? [])]),
  });
}

function marketPropertiesInput(request: Request): Readonly<{ cursor: string | null }> | null {
  const entries = [...new URL(request.url).searchParams.entries()];
  if (entries.length === 0) return Object.freeze({ cursor: null });
  const entry = entries[0];
  if (entries.length !== 1 || !entry || entry[0] !== "cursor") return null;
  return Object.freeze({ cursor: entry[1] });
}

function resultFailure(
  request: Request,
  result: Extract<MarketCompsetResult<unknown>, { readonly ok: false }>,
  correlation?: string,
): Response {
  switch (result.error.code) {
    case "invalid_input":
      return error(request, 400, "request/invalid", "Invalid request", "Market competitor-set input is invalid", correlation);
    case "forbidden":
      return error(request, 403, "auth/property_forbidden", "Forbidden", "Market access is not granted", correlation);
    case "conflict":
    case "invalid_state":
      return error(request, 409, "market/conflict", "Conflict", "Market competitor-set state conflicts with the request", correlation);
    case "unavailable":
      return error(request, 503, "service/unavailable", "Service unavailable", "Market competitor-set service is temporarily unavailable", correlation);
  }
  return error(request, 503, "service/unavailable", "Service unavailable", "Market competitor-set service is temporarily unavailable", correlation);
}

/** HTTP adapter only: the distribution service remains the authority for current grants and replay. */
export class MarketHttpApi {
  readonly #service: MarketCompsetOperations;

  constructor(service: MarketCompsetOperations) {
    this.#service = service;
  }

  failure(request: Request): Response {
    return error(request, 503, "service/unavailable", "Service unavailable", "Market competitor-set service is temporarily unavailable");
  }

  async discovery(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    const actor = actorFor(context, propertyNode, MARKET_COMPSET_READ_SCOPE);
    if (actor === null) return error(context.request, 403, "auth/property_forbidden", "Forbidden", "Market access is not granted");
    if (new URL(context.request.url).search !== "") {
      return error(context.request, 400, "request/invalid", "Invalid request", "Market discovery input is invalid", actor.requestId);
    }
    const result = await this.#service.discovery(context.tx, actor);
    return result.ok ? response(context.request, { discovery: result.value }, 200, {}, actor.requestId) : resultFailure(context.request, result, actor.requestId);
  }

  async current(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    const actor = actorFor(context, propertyNode, MARKET_COMPSET_READ_SCOPE);
    if (actor === null) return error(context.request, 403, "auth/property_forbidden", "Forbidden", "Market access is not granted");
    if (new URL(context.request.url).search !== "") {
      return error(context.request, 400, "request/invalid", "Invalid request", "Market competitor-set input is invalid", actor.requestId);
    }
    const result = await this.#service.current(context.tx, actor);
    return result.ok ? response(context.request, { compset: result.value }, 200, {}, actor.requestId) : resultFailure(context.request, result, actor.requestId);
  }

  async suggestIdentity(context: TenantRequestContext, propertyNode: string, input: unknown): Promise<Response> {
    const actor = actorFor(context, propertyNode, MARKET_COMPSET_READ_SCOPE);
    if (actor === null) return error(context.request, 403, "auth/property_forbidden", "Forbidden", "Market access is not granted");
    if (!hasJsonContentType(context.request) || new URL(context.request.url).search !== "") {
      return error(context.request, 400, "request/invalid", "Invalid request", "Market identity input is invalid", actor.requestId);
    }
    const result = await this.#service.suggestIdentity(context.tx, actor, input);
    return result.ok ? response(context.request, { suggestions: result.value }, 200, {}, actor.requestId) : resultFailure(context.request, result, actor.requestId);
  }

  async previewPlan(context: TenantRequestContext, propertyNode: string, input: unknown): Promise<Response> {
    const actor = actorFor(context, propertyNode, MARKET_COMPSET_READ_SCOPE);
    if (actor === null) return error(context.request, 403, "auth/property_forbidden", "Forbidden", "Market access is not granted");
    if (!hasJsonContentType(context.request) || new URL(context.request.url).search !== "") {
      return error(context.request, 400, "request/invalid", "Invalid request", "Market plan preview input is invalid", actor.requestId);
    }
    const result = await this.#service.previewPlan(context.tx, actor, input);
    return result.ok ? response(context.request, { preview: result.value }, 200, {}, actor.requestId) : resultFailure(context.request, result, actor.requestId);
  }

  async properties(context: TenantRequestContext): Promise<Response> {
    const principal = principalFor(context, MARKET_COMPSET_READ_SCOPE);
    if (principal === null) return error(context.request, 403, "auth/property_forbidden", "Forbidden", "Market access is not granted");
    const input = marketPropertiesInput(context.request);
    if (input === null) return error(context.request, 400, "request/invalid", "Invalid request", "Market properties input is invalid", principal.requestId);
    const result = await this.#service.properties(context.tx, principal, input);
    return result.ok ? response(context.request, { marketProperties: result.value }, 200, {}, principal.requestId) : resultFailure(context.request, result, principal.requestId);
  }

  async confirm(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const actor = actorFor(context, propertyNode, MARKET_COMPSET_WRITE_SCOPE);
    const idempotencyKey = context.request.headers.get("idempotency-key");
    if (actor === null) return error(context.request, 403, "auth/property_forbidden", "Forbidden", "Market access is not granted");
    if (!hasJsonContentType(context.request) || new URL(context.request.url).search !== ""
      || idempotencyKey === null || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      return error(context.request, 400, "request/invalid", "Invalid request", "Market competitor-set confirmation input is invalid", actor.requestId);
    }
    const result = await this.#service.confirm(context.tx, actor, body, idempotencyKey);
    if (!result.ok) return resultFailure(context.request, result, actor.requestId);
    return response(context.request, { confirmation: result.value }, result.value.replayed ? 200 : 201, {
      "idempotency-replayed": String(result.value.replayed),
    }, actor.requestId);
  }
}
