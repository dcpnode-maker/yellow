import { describe, expect, it } from "bun:test";
import {
  PUBLIC_BOOKING_PUBLISHER_SCOPES,
  PublicBookingSiteConflictError,
  PublicBookingSiteAuthority,
  type PublicBookingSiteContext,
} from "../src/contexts/identity";
import type { PublicBookingService } from "../src/contexts/reservations";
import type { Database, TenantRequestContext, Tx } from "../src/kernel";
import { PublicBookingHttpApi } from "../src/http/public-booking";

const SITE_ID = "00000000-0000-0000-0000-000000000101";
const TENANT_ID = "00000000-0000-0000-0000-000000000102";
const PROPERTY_ID = "00000000-0000-0000-0000-000000000103";
const PLAN_ID = "00000000-0000-0000-0000-000000000104";
const TOKEN = "public-session-token";
const SESSION = Object.freeze({
  tenantId: TENANT_ID,
  propertyNode: PROPERTY_ID,
  actorId: "00000000-0000-0000-0000-000000000105",
  siteId: SITE_ID,
  siteVersion: 3,
  ratePlanIds: Object.freeze([PLAN_ID]),
  channelCode: "direct",
  sessionId: "00000000-0000-0000-0000-000000000106",
  issuedAt: 1_800_000_000,
  expiresAt: 1_800_000_900,
});
const SITE: PublicBookingSiteContext = Object.freeze({
  tenantId: TENANT_ID,
  propertyNode: PROPERTY_ID,
  propertyName: "North House",
  timeZone: "Europe/London",
  site: Object.freeze({ siteId: SITE_ID, version: 3, active: true, issuerId: SESSION.actorId,
    ratePlanIds: Object.freeze([PLAN_ID]), channelCode: "direct" }),
});

function request(path = "/api/public/booking/start", body = "{}", headers: HeadersInit = {}, method = "POST"): Request {
  const merged = new Headers(headers);
  merged.set("content-type", "application/json");
  return new Request(`https://yellow.test${path}`, { method, headers: merged, body });
}

function harness(overrides: Partial<PublicBookingService> = {}, options: { now?: () => number } = {}) {
  const calls = {
    resolve: 0, tx: [] as string[], starts: [] as Array<{ siteId: string; version: number }>,
    authenticate: 0, actions: [] as string[], commits: 0, rollbacks: 0,
  };
  const service = {
    authenticate(token: string) { calls.authenticate++; return token === TOKEN ? SESSION : null; },
    async start(_tx: Tx, siteId: string, version: number) {
      calls.starts.push({ siteId, version });
      return { token: "public-token", expiresAt: "2026-10-01T00:15:00.000Z",
        property: { id: PROPERTY_ID, name: "North House", timeZone: "Europe/London" }, paymentAccepted: false };
    },
    async offers() { calls.actions.push("offers"); return { amount: 99n }; },
    async quote() { calls.actions.push("quotes"); return { amount: 99n }; },
    async hold() { calls.actions.push("holds"); return { amount: 99n }; },
    async details() { calls.actions.push("details"); return { amount: 99n }; },
    async reserve() { calls.actions.push("reservations"); return { amount: 99n }; },
    ...overrides,
  } as unknown as PublicBookingService;
  const database = {
    async withTenantTransaction<T>(tenantId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
      calls.tx.push(tenantId);
      try {
        const result = await work({} as Tx);
        calls.commits++;
        return result;
      } catch (error) {
        calls.rollbacks++;
        throw error;
      }
    },
  } as unknown as Database;
  const api = new PublicBookingHttpApi({
    database,
    service,
    now: options.now,
    async resolveSite(siteId) { calls.resolve++; return siteId === SITE_ID ? SITE : null; },
  });
  return { api, calls };
}

function sessionRequest(path = "/api/public/booking/offers", body = "{}", token = TOKEN, headers: HeadersInit = {}) {
  const merged = new Headers(headers);
  if (token) merged.set("authorization", `Bearer ${token}`);
  return request(path, body, merged);
}

describe("public booking HTTP boundary", () => {
  it("checks origin and query before public site directory access", async () => {
    const { api, calls } = harness();
    const foreignOrigin = await api.start(request("/api/public/booking/start", "{}", { origin: "https://attacker.test" }), SITE_ID);
    const nullOrigin = await api.start(request("/api/public/booking/start", "{}", { origin: "null" }), SITE_ID);
    const query = await api.start(request("/api/public/booking/start?site=foreign"), SITE_ID);
    expect([foreignOrigin.status, nullOrigin.status, query.status]).toEqual([403, 403, 400]);
    expect(calls.resolve).toBe(0);
    expect(calls.tx).toHaveLength(0);
  });

  it("starts only an explicitly published site and takes tenant authority from its resolution", async () => {
    const { api, calls } = harness();
    const missing = await api.start(request(), "00000000-0000-0000-0000-000000000999");
    expect(missing.status).toBe(404);
    const response = await api.start(request(), SITE_ID);
    expect(response.status).toBe(201);
    expect(calls.starts).toEqual([{ siteId: SITE_ID, version: 3 }]);
    expect(calls.tx).toEqual([TENANT_ID]);
    expect(await response.json()).toEqual({ token: "public-token", expiresAt: "2026-10-01T00:15:00.000Z",
      property: { id: PROPERTY_ID, name: "North House", timeZone: "Europe/London" }, paymentAccepted: false });
  });

  it("requires the exact empty object before looking up a site", async () => {
    const { api, calls } = harness();
    const response = await api.start(request("/api/public/booking/start", "{\"tenantId\":\"foreign\"}"), SITE_ID);
    expect(response.status).toBe(400);
    expect(calls.resolve).toBe(0);
    expect(calls.tx).toHaveLength(0);
  });

  it("limits shared site starts before directory IO", async () => {
    const { api, calls } = harness();
    const responses: Response[] = [];
    for (let index = 0; index < 31; index++) responses.push(await api.start(request(), SITE_ID));
    expect(responses.slice(0, 30).every((response) => response.status === 201)).toBe(true);
    expect(responses[30]?.status).toBe(429);
    expect(calls.resolve).toBe(30);
  });

  it("authenticates a strict bearer and rejects invitation/staff credentials before body or tenant work", async () => {
    const { api, calls } = harness();
    const missing = await api.handle(sessionRequest("/api/public/booking/offers", "bad", ""), "offers");
    const malformed = await api.handle(sessionRequest("/api/public/booking/offers", "bad", "Bearer a b"), "offers");
    const foreign = await api.handle(sessionRequest("/api/public/booking/offers", "{}", TOKEN, { origin: "https://other.test" }), "offers");
    expect([missing.status, malformed.status, foreign.status]).toEqual([401, 401, 403]);
    expect(calls.authenticate).toBe(0);
    expect(calls.tx).toHaveLength(0);
  });

  it("runs each public action in the signed tenant and serializes bigint without cache", async () => {
    const { api, calls } = harness();
    for (const action of ["offers", "quotes", "holds", "details", "reservations"] as const) {
      const response = await api.handle(sessionRequest(), action);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ amount: "99" });
    }
    expect(calls.tx).toEqual([TENANT_ID, TENANT_ID, TENANT_ID, TENANT_ID, TENANT_ID]);
    expect(calls.actions).toEqual(["offers", "quotes", "holds", "details", "reservations"]);
  });

  it("rejects malformed bodies after authentication and consumes the bounded session budget first", async () => {
    const { api, calls } = harness();
    const invalid = await api.handle(sessionRequest("/api/public/booking/offers", "not json"), "offers");
    expect(invalid.status).toBe(400);
    expect(calls.tx).toHaveLength(0);
    const responses: Response[] = [];
    for (let index = 0; index < 29; index++) responses.push(await api.handle(sessionRequest(), "offers"));
    expect(responses.every((response) => response.status === 200)).toBe(true);
    const limited = await api.handle(sessionRequest("/api/public/booking/offers", "not json"), "offers");
    expect(limited.status).toBe(429);
    expect(calls.actions).toHaveLength(29);
  });

  it("does not commit a session transaction if the encoded response exceeds one MiB", async () => {
    const { api, calls } = harness({ async offers() { return { value: "x".repeat(1024 * 1024) }; } });
    const response = await api.handle(sessionRequest(), "offers");
    expect(response.status).toBe(503);
    expect(calls.commits).toBe(0);
    expect(calls.rollbacks).toBe(1);
  });

  it("uses the shared authority for scoped staff publication and hides internal site fields", async () => {
    let published = 0;
    const authority = {
      async resolve() { return SITE; },
      async publish() {
        published++;
        return { siteId: SITE_ID, version: 4, active: true, issuerId: SESSION.actorId,
          tenantId: TENANT_ID, channelCode: "direct", ratePlanIds: [PLAN_ID] };
      },
    } as unknown as PublicBookingSiteAuthority;
    const api = new PublicBookingHttpApi({
      database: {} as Database,
      service: {} as PublicBookingService,
      authority,
      resolveSite: async () => SITE,
    });
    const tx = { async unsafe() { return []; } } as unknown as Tx;
    const context = (scopes: readonly string[]): TenantRequestContext => ({
      request: request("/api/v1/properties/property-a/public-booking-site", "{}"),
      tenantId: TENANT_ID,
      identity: { tenantId: TENANT_ID, actorId: SESSION.actorId, scopes },
      tx,
    });
    const denied = await api.publish(context(PUBLIC_BOOKING_PUBLISHER_SCOPES.slice(1)), PROPERTY_ID);
    expect(denied.status).toBe(403);
    expect(published).toBe(0);
    const response = await api.publish(context(PUBLIC_BOOKING_PUBLISHER_SCOPES), PROPERTY_ID);
    expect(response.status).toBe(200);
    const responseBody = await response.clone().text();
    expect(JSON.parse(responseBody)).toEqual({ siteId: SITE_ID, version: 4, active: true, channelCode: "direct", ratePlanIds: [PLAN_ID] });
    expect(responseBody).not.toContain("issuerId");
    expect(published).toBe(1);
  });

  it("rolls back publication on mapped errors or response serialization failure", async () => {
    const statements: string[] = [];
    const tx = { async unsafe(statement: string) { statements.push(statement); return []; } } as unknown as Tx;
    const authority = {
      async resolve() { return SITE; },
      async publish() { throw new PublicBookingSiteConflictError(); },
    } as unknown as PublicBookingSiteAuthority;
    const api = new PublicBookingHttpApi({ database: {} as Database, service: {} as PublicBookingService,
      authority, resolveSite: async () => SITE });
    const response = await api.publish({ request: request(), tenantId: TENANT_ID,
      identity: { tenantId: TENANT_ID, actorId: SESSION.actorId, scopes: PUBLIC_BOOKING_PUBLISHER_SCOPES }, tx }, PROPERTY_ID);
    expect(response.status).toBe(409);
    expect(statements).toEqual([
      "SAVEPOINT public_booking_publish_http",
      "ROLLBACK TO SAVEPOINT public_booking_publish_http",
      "RELEASE SAVEPOINT public_booking_publish_http",
    ]);
  });

  it("lets publication savepoint recovery failure abort the enclosing operator transaction", async () => {
    const authority = {
      async resolve() { return SITE; },
      async publish() { throw new PublicBookingSiteConflictError(); },
    } as unknown as PublicBookingSiteAuthority;
    const api = new PublicBookingHttpApi({ database: {} as Database, service: {} as PublicBookingService,
      authority, resolveSite: async () => SITE });
    const tx = { async unsafe(statement: string) {
      if (statement.startsWith("ROLLBACK TO SAVEPOINT")) throw new Error("rollback failed");
      return [];
    } } as unknown as Tx;
    await expect(api.publish({ request: request(), tenantId: TENANT_ID,
      identity: { tenantId: TENANT_ID, actorId: SESSION.actorId, scopes: PUBLIC_BOOKING_PUBLISHER_SCOPES }, tx }, PROPERTY_ID))
      .rejects.toThrow("Public booking publication transaction recovery failed");
  });

  it("does not permit URL query authority on session operations", async () => {
    const { api, calls } = harness();
    const response = await api.handle(sessionRequest("/api/public/booking/offers?tenant=foreign"), "offers");
    expect(response.status).toBe(400);
    expect(calls.authenticate).toBe(0);
    expect(calls.tx).toHaveLength(0);
  });
});
