import {
  PublicBookingSiteAuthority,
  PublicBookingSiteConflictError,
  PublicBookingSiteError,
  PublicBookingSiteUnavailableError,
  PublicBookingSiteValidationError,
  PUBLIC_BOOKING_PUBLISHER_SCOPES,
  type PublicBookingRuntimeSql,
  type PublicBookingSiteContext,
  type PublishPublicBookingSiteBody,
} from "../contexts/identity";
import { PublicBookingError, type PublicBookingService, type PublicBookingSession } from "../contexts/reservations";
import { HoldConflictError } from "../contexts/inventory";
import { IdempotencyConflictError, type Database, type TenantRequestContext } from "../kernel";
import {
  QuotedTaxHoldBindingConflictError,
  QuotedTaxHoldBindingValidationError,
} from "../contexts/tax-fiscal";
import { ReservationConflictError, ReservationOfferValidationError } from "../contexts/reservations";
import { readCrsSearchJson, StaffCrsSearchError } from "./crs-search";

const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_LIVE_BUDGETS = 4096;
const BUDGET_WINDOW_MS = 60_000;
const BUDGET_LIMIT = 30;
const PUBLISH_SAVEPOINT = "public_booking_publish_http";
const BEARER = /^Bearer ([^\s]+)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type PublicBookingAction = "offers" | "quotes" | "holds" | "details" | "reservations";

type PublicBookingApiService = Pick<PublicBookingService,
  "authenticate" | "start" | "offers" | "quote" | "hold" | "details" | "reserve">;
type PublicBookingApiDatabase = Pick<Database, "withTenantTransaction">;
type SiteResolver = (siteId: string) => Promise<PublicBookingSiteContext | null>;
type SiteAuthority = Pick<PublicBookingSiteAuthority, "resolve" | "publish">;

interface RequestBudget {
  windowStartedAt: number;
  requests: number;
  lastSeenAt: number;
}

class HttpFailure extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
    this.name = "HttpFailure";
  }
}

class TransactionRecoveryError extends Error {
  constructor() {
    super("Public booking publication transaction recovery failed");
    this.name = "TransactionRecoveryError";
  }
}

export interface PublicBookingHttpApiOptions {
  readonly database: PublicBookingApiDatabase;
  readonly service: PublicBookingApiService;
  /** A single-site directory capability. It must return only currently published sites. */
  readonly resolveSite?: SiteResolver;
  /** The narrow runtime directory SQL capability used with the default authority adapter. */
  readonly runtimeSql?: PublicBookingRuntimeSql;
  readonly authority?: SiteAuthority;
  readonly now?: () => number;
}

function requestId(): string { return crypto.randomUUID(); }

function cancelBody(request: Request): void {
  if (request.body) void request.body.cancel().catch(() => undefined);
}

function jsonResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    pragma: "no-cache",
    "x-content-type-options": "nosniff",
  } });
}

function errorResponse(status: number, code: string, id: string): Response {
  return jsonResponse(JSON.stringify({ error: code, request_id: id }), status);
}

function encode(value: unknown): string {
  const encoded = JSON.stringify(value, (_key, item: unknown) => typeof item === "bigint" ? item.toString(10) : item);
  if (encoded === undefined || new TextEncoder().encode(encoded).byteLength > MAX_RESPONSE_BYTES) {
    throw new HttpFailure(503, "service/unavailable");
  }
  return encoded;
}

function hasStrictOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try { return origin !== "null" && origin === new URL(request.url).origin; }
  catch { return false; }
}

function parseBearer(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization === null) return null;
  return BEARER.exec(authorization)?.[1] ?? null;
}

function validSession(session: PublicBookingSession | null): session is PublicBookingSession {
  return session !== null && typeof session.sessionId === "string" && session.sessionId.length > 0 &&
    typeof session.tenantId === "string" && Number.isFinite(session.expiresAt);
}

function responseFromError(error: unknown, id: string): Response {
  if (error instanceof HttpFailure) return errorResponse(error.status, error.code, id);
  if (error instanceof StaffCrsSearchError) return errorResponse(error.status, error.code, id);
  if (error instanceof PublicBookingError) return errorResponse(error.status, error.code, id);
  if (error instanceof PublicBookingSiteError) return errorResponse(403, "booking/unavailable", id);
  if (error instanceof PublicBookingSiteConflictError || error instanceof IdempotencyConflictError ||
      error instanceof HoldConflictError || error instanceof ReservationConflictError ||
      error instanceof QuotedTaxHoldBindingConflictError) return errorResponse(409, "booking/conflict", id);
  if (error instanceof PublicBookingSiteValidationError || error instanceof ReservationOfferValidationError ||
      error instanceof QuotedTaxHoldBindingValidationError) return errorResponse(400, "booking/invalid", id);
  if (error instanceof PublicBookingSiteUnavailableError) return errorResponse(503, "service/unavailable", id);
  return errorResponse(503, "service/unavailable", id);
}

function exactEmptyObject(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype && Reflect.ownKeys(value).length === 0;
}

function validateStartResult(value: unknown): Readonly<{ token: string; expiresAt: string; property: Readonly<{ id: string; name: string; timeZone: string }>; paymentAccepted: false }> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new HttpFailure(503, "service/unavailable");
  const result = value as Record<string, unknown>;
  const property = result.property;
  if (typeof result.token !== "string" || result.token.length < 1 || typeof result.expiresAt !== "string" ||
      typeof property !== "object" || property === null || Array.isArray(property)) throw new HttpFailure(503, "service/unavailable");
  const metadata = property as Record<string, unknown>;
  if (typeof metadata.id !== "string" || !UUID.test(metadata.id) || typeof metadata.name !== "string" ||
      typeof metadata.timeZone !== "string" || result.paymentAccepted !== false) throw new HttpFailure(503, "service/unavailable");
  return Object.freeze({ token: result.token, expiresAt: result.expiresAt,
    property: Object.freeze({ id: metadata.id, name: metadata.name, timeZone: metadata.timeZone }), paymentAccepted: false });
}

function projectPublishedSite(value: unknown): Readonly<{
  siteId: string; version: number; active: boolean; channelCode: string; ratePlanIds: readonly string[];
}> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new HttpFailure(503, "service/unavailable");
  const site = value as Record<string, unknown>;
  if (typeof site.siteId !== "string" || !UUID.test(site.siteId) || !Number.isSafeInteger(site.version) ||
      typeof site.active !== "boolean" || typeof site.channelCode !== "string" ||
      !/^[a-z][a-z0-9._-]{0,63}$/.test(site.channelCode) || !Array.isArray(site.ratePlanIds) ||
      site.ratePlanIds.length < 1 || site.ratePlanIds.length > 16 ||
      !site.ratePlanIds.every((id) => typeof id === "string" && UUID.test(id))) throw new HttpFailure(503, "service/unavailable");
  return Object.freeze({ siteId: site.siteId, version: site.version as number, active: site.active,
    channelCode: site.channelCode, ratePlanIds: Object.freeze([...site.ratePlanIds] as string[]) });
}

/** HTTP boundary for explicitly published, anonymous booking sites. */
export class PublicBookingHttpApi {
  readonly #database: PublicBookingApiDatabase;
  readonly #service: PublicBookingApiService;
  readonly #authority: SiteAuthority;
  readonly #resolveSite: SiteResolver;
  readonly #now: () => number;
  readonly #budgets = new Map<string, RequestBudget>();

  constructor(options: PublicBookingHttpApiOptions) {
    this.#database = options.database;
    this.#service = options.service;
    this.#now = options.now ?? Date.now;
    this.#authority = options.authority ?? new PublicBookingSiteAuthority();
    if (options.resolveSite) this.#resolveSite = options.resolveSite;
    else {
      if (!options.runtimeSql) throw new Error("Public booking HTTP requires a narrow runtime directory SQL capability");
      this.#resolveSite = async (siteId) => {
        try { return await this.#authority.resolve(options.runtimeSql!, siteId); }
        catch (error) { if (error instanceof PublicBookingSiteError) return null; throw error; }
      };
    }
  }

  /** Starts a session only for an explicitly published, syntactically valid site UUID. */
  async start(request: Request, siteId: string): Promise<Response> {
    const id = requestId();
    try {
      this.#validateRequest(request);
      if (typeof siteId !== "string" || !UUID.test(siteId)) throw new HttpFailure(404, "booking/site_not_found");
      this.#consumeBudget(`site:${siteId}`);
      const body = await readCrsSearchJson(request);
      if (!exactEmptyObject(body)) throw new HttpFailure(400, "booking/invalid");
      const site = await this.#resolveSite(siteId);
      if (!site || site.site.siteId !== siteId || site.site.active !== true) throw new HttpFailure(404, "booking/site_not_found");
      const encoded = await this.#database.withTenantTransaction(site.tenantId, async (tx) => {
        const result = validateStartResult(await this.#service.start(tx, siteId, site.site.version));
        return encode(result);
      });
      return jsonResponse(encoded, 201);
    } catch (error) {
      cancelBody(request);
      if (error instanceof PublicBookingSiteError) return errorResponse(404, "booking/site_not_found", id);
      return responseFromError(error, id);
    }
  }

  /** Executes a public booking command using only the domain-authenticated bearer session. */
  async handle(request: Request, action: PublicBookingAction): Promise<Response> {
    const id = requestId();
    try {
      this.#validateRequest(request);
      if (!["offers", "quotes", "holds", "details", "reservations"].includes(action)) {
        throw new HttpFailure(404, "request/not_found");
      }
      const token = parseBearer(request);
      if (token === null) throw new HttpFailure(401, "auth/unauthorized");
      const session = this.#service.authenticate(token);
      if (!validSession(session)) throw new HttpFailure(401, "auth/unauthorized");
      this.#consumeBudget(`session:${session.sessionId}`);
      const body = await readCrsSearchJson(request);
      const encoded = await this.#database.withTenantTransaction(session.tenantId, async (tx) => {
        let result: unknown;
        switch (action) {
          case "offers": result = await this.#service.offers(tx, session, body); break;
          case "quotes": result = await this.#service.quote(tx, session, body); break;
          case "holds": result = await this.#service.hold(tx, session, body, id); break;
          case "details": result = await this.#service.details(tx, session, body, id); break;
          case "reservations": result = await this.#service.reserve(tx, session, body, id); break;
        }
        return encode(result);
      });
      return jsonResponse(encoded, 200);
    } catch (error) {
      cancelBody(request);
      return responseFromError(error, id);
    }
  }

  /** Staff publication is called only after the operator's tenant middleware has resolved. */
  async publish(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    const id = requestId();
    try {
      this.#validateRequest(context.request);
      if (!UUID.test(propertyNode) || context.identity.tenantId !== context.tenantId ||
          !context.identity.actorId || !PUBLIC_BOOKING_PUBLISHER_SCOPES.every((scope) => context.identity.scopes?.includes(scope))) {
        throw new HttpFailure(403, "auth/forbidden");
      }
      const body = await readCrsSearchJson(context.request);
      await context.tx.unsafe(`SAVEPOINT ${PUBLISH_SAVEPOINT}`);
      try {
        const published = await this.#authority.publish(
          context.tx, context.identity, propertyNode, body as PublishPublicBookingSiteBody, id,
        );
        const encoded = encode(projectPublishedSite(published));
        await context.tx.unsafe(`RELEASE SAVEPOINT ${PUBLISH_SAVEPOINT}`);
        return jsonResponse(encoded, 200);
      } catch (error) {
        try {
          await context.tx.unsafe(`ROLLBACK TO SAVEPOINT ${PUBLISH_SAVEPOINT}`);
          await context.tx.unsafe(`RELEASE SAVEPOINT ${PUBLISH_SAVEPOINT}`);
        } catch {
          throw new TransactionRecoveryError();
        }
        return responseFromError(error, id);
      }
    } catch (error) {
      cancelBody(context.request);
      if (error instanceof TransactionRecoveryError) throw error;
      return responseFromError(error, id);
    }
  }

  #validateRequest(request: Request): void {
    if (request.method !== "POST" || !hasStrictOrigin(request)) {
      cancelBody(request);
      throw new HttpFailure(403, "request/origin_forbidden");
    }
    let url: URL;
    try { url = new URL(request.url); }
    catch { throw new HttpFailure(400, "request/invalid"); }
    if (request.url.includes("?")) {
      cancelBody(request);
      throw new HttpFailure(400, "request/invalid");
    }
  }

  #consumeBudget(key: string): void {
    const now = this.#now();
    for (const [candidate, value] of this.#budgets) {
      if (now - value.lastSeenAt >= BUDGET_WINDOW_MS) this.#budgets.delete(candidate);
    }
    let budget = this.#budgets.get(key);
    if (!budget) {
      if (this.#budgets.size >= MAX_LIVE_BUDGETS) throw new HttpFailure(429, "request/rate_limited");
      budget = { windowStartedAt: now, requests: 0, lastSeenAt: now };
      this.#budgets.set(key, budget);
    }
    if (now - budget.windowStartedAt >= BUDGET_WINDOW_MS) {
      budget.windowStartedAt = now;
      budget.requests = 0;
    }
    budget.lastSeenAt = now;
    if (budget.requests >= BUDGET_LIMIT) throw new HttpFailure(429, "request/rate_limited");
    budget.requests += 1;
  }
}
