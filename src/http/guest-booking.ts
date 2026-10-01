import { GuestBookingError, ReservationConflictError, type GuestBookingService } from "../contexts/reservations";
import { GUEST_BOOKING_ISSUER_SCOPES } from "../contexts/identity";
import { QuotedTaxHoldBindingConflictError,QuotedTaxHoldBindingValidationError } from "../contexts/tax-fiscal";
import { ReservationOfferValidationError } from "../contexts/reservations";
import { HoldConflictError } from "../contexts/inventory";
import { IdempotencyConflictError, type Database, type TenantRequestContext, type Tx } from "../kernel";
import { readCrsSearchJson, StaffCrsSearchError } from "./crs-search";

const MAX_RESPONSE_BYTES = 1024 * 1024;
const SESSION_BUDGET_WINDOW_MS = 60_000;
const SESSION_BUDGET_LIMIT = 30;
const MAX_LIVE_SESSION_BUDGETS = 4096;
const ISSUE_SAVEPOINT = "guest_booking_issue_http";
const BEARER = /^Bearer ([^\s]+)$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{1,128}$/;

type GuestAction = "context" | "offers" | "quotes" | "holds" | "reservations";
type GuestApiService = Pick<GuestBookingService,
  "authenticate" | "issue" | "context" | "offers" | "quote" | "hold" | "reserve">;
type GuestApiDatabase = Pick<Database, "withTenantTransaction">;

interface SessionBudget {
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

function jsonResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
    },
  });
}

function errorResponse(status: number, code: string, requestId: string = crypto.randomUUID()): Response {
  return jsonResponse(JSON.stringify({ error: code, request_id: requestId }), status);
}

function cancelBody(request: Request): void {
  if (request.body) void request.body.cancel().catch(() => undefined);
}

function encode(value: unknown): string {
  const result = JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "bigint" ? item.toString(10) : item,
  );
  if (result === undefined) throw new HttpFailure(503, "service/unavailable");
  if (new TextEncoder().encode(result).byteLength > MAX_RESPONSE_BYTES) {
    throw new HttpFailure(503, "service/unavailable");
  }
  return result;
}

function requestId(): string {
  return crypto.randomUUID();
}

function responseFromError(error: unknown, id: string): Response {
  if (error instanceof HttpFailure) return errorResponse(error.status, error.code, id);
  if (error instanceof StaffCrsSearchError) return errorResponse(error.status, error.code, id);
  if (error instanceof GuestBookingError) return errorResponse(error.status, error.code, id);
  if (error instanceof IdempotencyConflictError || error instanceof HoldConflictError ||
      error instanceof ReservationConflictError || error instanceof QuotedTaxHoldBindingConflictError) {
    return errorResponse(409, "booking/conflict", id);
  }
  if (error instanceof QuotedTaxHoldBindingValidationError || error instanceof ReservationOfferValidationError) return errorResponse(400,"booking/invalid",id);
  return errorResponse(503, "service/unavailable", id);
}

function parseBearer(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization === null) return null;
  const match = BEARER.exec(authorization);
  return match?.[1] ?? null;
}

function exactEmptyObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype && Reflect.ownKeys(value).length === 0;
}

function sameOrigin(request: Request): boolean {
  const supplied = request.headers.get("origin");
  if (supplied === null) return true;
  try {
    return supplied === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function validSession(session: ReturnType<GuestApiService["authenticate"]>): session is NonNullable<typeof session> {
  return session !== null && typeof session.sessionId === "string" && session.sessionId.length > 0 &&
    typeof session.tenantId === "string" && Number.isFinite(session.expiresAt);
}

export interface GuestBookingHttpApiOptions {
  readonly database: GuestApiDatabase;
  readonly service: GuestApiService;
}

/** HTTP boundary for staff-issued, invitation-bound guest booking sessions. */
export class GuestBookingHttpApi {
  readonly #database: GuestApiDatabase;
  readonly #service: GuestApiService;
  readonly #sessionBudgets = new Map<string, SessionBudget>();

  constructor(options: GuestBookingHttpApiOptions) {
    this.#database = options.database;
    this.#service = options.service;
  }

  /** Staff-authorized invitation issuance, called only after operator tenant resolution. */
  async issue(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    const id = requestId();
    try {
      if (context.request.url && new URL(context.request.url).search !== "") {
        cancelBody(context.request);
        throw new HttpFailure(400, "request/invalid");
      }
      if (!context.identity.actorId || context.identity.tenantId !== context.tenantId ||
          !GUEST_BOOKING_ISSUER_SCOPES.every((scope) => context.identity.scopes?.includes(scope))) {
        cancelBody(context.request);
        throw new HttpFailure(403, "auth/forbidden");
      }
      const key = context.request.headers.get("idempotency-key");
      if (key === null || !IDEMPOTENCY_KEY.test(key)) {
        cancelBody(context.request);
        throw new HttpFailure(400, "request/invalid");
      }
      const body = await readCrsSearchJson(context.request);
      await context.tx.unsafe(`SAVEPOINT ${ISSUE_SAVEPOINT}`);
      try {
        const encoded = encode(await this.#service.issue(context.tx, {
          tenantId: context.tenantId,
          actorId: context.identity.actorId,
          scopes: context.identity.scopes,
        }, propertyNode, body, key, id));
        await context.tx.unsafe(`RELEASE SAVEPOINT ${ISSUE_SAVEPOINT}`);
        return jsonResponse(encoded, 201);
      } catch (error) {
        try {
          await context.tx.unsafe(`ROLLBACK TO SAVEPOINT ${ISSUE_SAVEPOINT}`);
          await context.tx.unsafe(`RELEASE SAVEPOINT ${ISSUE_SAVEPOINT}`);
        } catch {
          // The enclosing operator tenant boundary must abort if savepoint recovery fails.
          throw new Error("Guest booking issuance transaction recovery failed");
        }
        return responseFromError(error, id);
      }
    } catch (error) {
      if (!(error instanceof HttpFailure) && !(error instanceof StaffCrsSearchError) &&
          !(error instanceof GuestBookingError) && !(error instanceof IdempotencyConflictError) &&
          !(error instanceof HoldConflictError) && !(error instanceof ReservationConflictError || error instanceof QuotedTaxHoldBindingConflictError)) {
        throw error;
      }
      cancelBody(context.request);
      return responseFromError(error, id);
    }
  }

  /** Guest bearer boundary. URL parameters never carry booking authority. */
  async handle(request: Request, action: GuestAction): Promise<Response> {
    const id = requestId();
    let session: ReturnType<GuestApiService["authenticate"]> = null;
    try {
      const token = parseBearer(request);
      if (token === null) {
        cancelBody(request);
        throw new HttpFailure(401, "auth/unauthorized");
      }
      session = this.#service.authenticate(token);
      if (!validSession(session)) {
        cancelBody(request);
        throw new HttpFailure(401, "auth/unauthorized");
      }
      if (new URL(request.url).search !== "" || (action === "context" && request.url.includes("?"))) {
        cancelBody(request);
        throw new HttpFailure(400, "request/invalid");
      }
      if (action === "context" && !sameOrigin(request)) {
        cancelBody(request);
        throw new HttpFailure(403, "auth/forbidden");
      }
      this.#consumeSessionBudget(session.sessionId);
      const body = await readCrsSearchJson(request);
      if (action === "context" && !exactEmptyObject(body)) throw new HttpFailure(400, "request/invalid");
      const encoded = await this.#database.withTenantTransaction(session.tenantId, async (tx) => {
        const result = await this.#runAction(tx, action, session!, body, id);
        return encode(result);
      });
      return jsonResponse(encoded, 200);
    } catch (error) {
      cancelBody(request);
      return responseFromError(error, id);
    }
  }

  #consumeSessionBudget(sessionId: string): void {
    const now = Date.now();
    for (const [key, value] of this.#sessionBudgets) {
      if (now - value.lastSeenAt >= SESSION_BUDGET_WINDOW_MS) this.#sessionBudgets.delete(key);
    }
    let budget = this.#sessionBudgets.get(sessionId);
    if (!budget) {
      if (this.#sessionBudgets.size >= MAX_LIVE_SESSION_BUDGETS) {
        throw new HttpFailure(429, "request/rate_limited");
      }
      budget = { windowStartedAt: now, requests: 0, lastSeenAt: now };
      this.#sessionBudgets.set(sessionId, budget);
    }
    if (now - budget.windowStartedAt >= SESSION_BUDGET_WINDOW_MS) {
      budget.windowStartedAt = now;
      budget.requests = 0;
    }
    budget.lastSeenAt = now;
    if (budget.requests >= SESSION_BUDGET_LIMIT) throw new HttpFailure(429, "request/rate_limited");
    budget.requests += 1;
  }

  #runAction(tx: Tx, action: GuestAction, session: NonNullable<ReturnType<GuestApiService["authenticate"]>>,
    body: unknown, id: string): Promise<unknown> {
    switch (action) {
      case "context": return this.#service.context(tx, session, body);
      case "offers": return this.#service.offers(tx, session, body);
      case "quotes": return this.#service.quote(tx, session, body);
      case "holds": return this.#service.hold(tx, session, body, id);
      case "reservations": return this.#service.reserve(tx, session, body, id);
    }
  }
}
