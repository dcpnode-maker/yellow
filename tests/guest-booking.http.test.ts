import { describe, expect, it } from "bun:test";
import { createApp } from "../src/app";
import {
  BearerTenantResolver,
  GUEST_BOOKING_ISSUER_SCOPES,
  GuestBookingTokenSigner,
  Hs256TokenSigner,
} from "../src/contexts/identity";
import type { GuestBookingService } from "../src/contexts/reservations";
import type { OperatorHttpApi } from "../src/http/operator";
import type { Database, Tx, TenantRequestContext } from "../src/kernel";
import { GuestBookingHttpApi } from "../src/http/guest-booking";

const TOKEN = "gbs.secret-token-value";
const STAFF_SECRET = "yellow-guest-booking-http-staff-secret-0001";
const GUEST_SECRET = "yellow-guest-booking-http-guest-secret-0001";
const STAFF_ID = "00000000-0000-0000-0000-000000000701";
const STAFF_TENANT = "00000000-0000-0000-0000-000000000702";
const OTHER_TENANT = "00000000-0000-0000-0000-000000000703";
const PROPERTY_ID = "00000000-0000-0000-0000-000000000704";
const PUBLIC_BOOKING_ROUTES = [
  "/api/public/booking/offers",
  "/api/public/booking/quotes",
  "/api/public/booking/holds",
  "/api/public/booking/reservations",
] as const;
const SESSION = Object.freeze({
  tenantId: "tenant-a",
  propertyNode: "property-a",
  actorId: "party-a",
  primaryPartyId: "party-a",
  ratePlanIds: Object.freeze(["rate-a"]),
  channelCode: "DIRECT",
  sessionId: "session-a",
  issuedAt: Date.now(),
  expiresAt: Date.now() + 60_000,
});

function harness(overrides: Partial<GuestBookingService> = {}) {
  const calls = { authenticate: 0, transactions: 0, issue: 0, offers: 0, quote: 0, hold: 0, reserve: 0, commits: 0, rollbacks: 0 };
  const service = {
    authenticate(token: string) { calls.authenticate++; return token === TOKEN ? SESSION : null; },
    async issue() { calls.issue++; return { invitation: "issued" }; },
    async offers() { calls.offers++; return { offers: [] }; },
    async quote() { calls.quote++; return { amount: 123n }; },
    async hold() { calls.hold++; return { hold: "held" }; },
    async reserve() { calls.reserve++; return { reservation: "reserved" }; },
    ...overrides,
  } as unknown as GuestBookingService;
  const database = {
    async withTenantTransaction<T>(_tenantId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
      calls.transactions++;
      try {
        const result = await work({} as Tx);
        calls.commits++;
        return result;
      } catch (error) {
        calls.rollbacks++;
        throw error;
      }
    },
  };
  return { api: new GuestBookingHttpApi({ database, service }), calls };
}

function guestRequest(path = "/api/public/booking/offers", token = TOKEN, body = "{}", headers: HeadersInit = {}) {
  const merged = new Headers(headers);
  merged.set("content-type", "application/json");
  if (token) merged.set("authorization", `Bearer ${token}`);
  return new Request(`https://yellow.test${path}`, { method: "POST", headers: merged, body });
}

function staffContext(scopes: readonly string[] = GUEST_BOOKING_ISSUER_SCOPES, body = "{}", tx = { async unsafe() { return []; } } as unknown as Tx) {
  const request = new Request("https://yellow.test/api/v1/properties/property-a/booking-invitations", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "issue-1" },
    body,
  });
  return {
    request,
    tenantId: "tenant-a",
    identity: { tenantId: "tenant-a", actorId: "staff-a", scopes },
    tx,
  } as TenantRequestContext;
}

describe("guest booking HTTP boundary", () => {
  it("authenticates a strict bearer before parsing bodies or selecting a tenant", async () => {
    const { api, calls } = harness();
    const response = await api.handle(guestRequest("/api/public/booking/offers", "bad token"), "offers");
    expect(response.status).toBe(401);
    expect(calls.authenticate).toBe(0);
    expect(calls.transactions).toBe(0);
    expect(await response.text()).not.toContain("bad token");
  });

  it("rejects missing and malformed bearer credentials without opening a tenant transaction", async () => {
    const { api, calls } = harness();
    const noAuth = await api.handle(guestRequest("/api/public/booking/offers", ""), "offers");
    const malformed = await api.handle(guestRequest("/api/public/booking/offers", "Bearer a b"), "offers");
    expect([noAuth.status, malformed.status]).toEqual([401, 401]);
    expect(calls.transactions).toBe(0);
  });

  it("rejects URL query strings and does not parse the body", async () => {
    const { api, calls } = harness();
    const response = await api.handle(guestRequest("/api/public/booking/offers?tenant=tenant-b"), "offers");
    expect(response.status).toBe(400);
    expect(calls.transactions).toBe(0);
    expect(calls.offers).toBe(0);
  });

  it("runs guest operations in the session tenant and sends no-store JSON with bigint decimals", async () => {
    const { api, calls } = harness();
    const response = await api.handle(guestRequest("/api/public/booking/quotes"), "quotes");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ amount: "123" });
    expect(calls.transactions).toBe(1);
    expect(calls.quote).toBe(1);
  });

  it("serves context through the guest bearer with an exact empty object and no-store headers", async () => {
    const context = { property: { id: "property-a", name: "Harbor House", timeZone: "Asia/Kolkata" }, ratePlans: [] };
    let contextCalls = 0;
    const { api, calls } = harness({
      async context(_tx, _session, body) {
        expect(body).toEqual({});
        contextCalls++;
        return context;
      },
    });
    const response = await api.handle(guestRequest(
      "/api/public/booking/context", TOKEN, "{}", { origin: "https://yellow.test" },
    ), "context");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(context);
    expect(contextCalls).toBe(1);
    expect(calls.transactions).toBe(1);
  });

  it("rejects context query, nonempty body, and cross-origin Origin before opening a transaction", async () => {
    let contextCalls = 0;
    const { api, calls } = harness({ async context() { contextCalls++; return {}; } });
    const query = await api.handle(guestRequest("/api/public/booking/context?property=property-b"), "context");
    const emptyQuery = await api.handle(guestRequest("/api/public/booking/context?"), "context");
    const body = await api.handle(guestRequest("/api/public/booking/context", TOKEN, "{\"property\":\"property-a\"}"), "context");
    const origin = await api.handle(guestRequest(
      "/api/public/booking/context", TOKEN, "{}", { origin: "https://attacker.test" },
    ), "context");
    expect([query.status, emptyQuery.status, body.status, origin.status]).toEqual([400, 400, 400, 403]);
    expect(contextCalls).toBe(0);
    expect(calls.transactions).toBe(0);
  });

  it("applies the existing session budget and response-size ceiling to context", async () => {
    let contextCalls = 0;
    const { api, calls } = harness({
      async context() { contextCalls++; return { property: { name: "x".repeat(1024 * 1024) } }; },
    });
    const oversized = await api.handle(guestRequest("/api/public/booking/context"), "context");
    expect(oversized.status).toBe(503);
    expect(calls.transactions).toBe(1);
    expect(calls.commits).toBe(0);
    expect(calls.rollbacks).toBe(1);

    const budget = harness({ async context() { contextCalls++; return {}; } });
    const responses: Response[] = [];
    for (let index = 0; index < 31; index++) {
      responses.push(await budget.api.handle(guestRequest("/api/public/booking/context"), "context"));
    }
    expect(responses.slice(0, 30).every((response) => response.status === 200)).toBe(true);
    expect(responses[30]?.status).toBe(429);
    expect(budget.calls.transactions).toBe(30);
  });

  it("does not forward a guest supplied operation key to the hold domain command", async () => {
    const { api } = harness({
      async hold(...args: unknown[]) {
        expect(args).toHaveLength(4);
        expect(args[3]).toMatch(/^[0-9a-f-]{36}$/i);
        expect(args[3]).not.toBe("guest-chosen-command-key");
        return { hold: "held" };
      },
    });
    const response = await api.handle(guestRequest(
      "/api/public/booking/holds", TOKEN, "{}", { "idempotency-key": "guest-chosen-command-key" },
    ), "holds");
    expect(response.status).toBe(200);
  });

  it("rejects bodies above the shared 64 KiB bound", async () => {
    const { api, calls } = harness();
    const tooLarge = JSON.stringify({ value: "x".repeat(64 * 1024) });
    const response = await api.handle(guestRequest("/api/public/booking/offers", TOKEN, tooLarge), "offers");
    expect(response.status).toBe(400);
    expect(calls.transactions).toBe(0);
    expect(calls.offers).toBe(0);
  });

  it("does not commit a tenant transaction when the encoded response exceeds 1 MiB", async () => {
    const { api, calls } = harness({ async offers() { return { value: "x".repeat(1024 * 1024) }; } });
    const response = await api.handle(guestRequest(), "offers");
    expect(response.status).toBe(503);
    expect(calls.transactions).toBe(1);
    expect(calls.commits).toBe(0);
    expect(calls.rollbacks).toBe(1);
  });

  it("requires every issuer scope before reading the body and passes only the issuer idempotency key", async () => {
    const { api, calls } = harness({
      async issue(...args: unknown[]) {
        calls.issue++;
        expect(args[1]).toMatchObject({ tenantId: "tenant-a", actorId: "staff-a" });
        expect(args[4]).toBe("issue-1");
        return { invitation: "issued" };
      },
    });
    const denied = await api.issue(staffContext(GUEST_BOOKING_ISSUER_SCOPES.slice(1)), "property-a");
    expect(denied.status).toBe(403);
    expect(calls.issue).toBe(0);
    const issued = await api.issue(staffContext(), "property-a");
    expect(issued.status).toBe(201);
    expect(calls.issue).toBe(1);
  });

  it("rolls back staff issuance before returning an error when the response exceeds 1 MiB", async () => {
    let mutation = false;
    let savepointValue = false;
    const statements: string[] = [];
    const tx = {
      async unsafe(statement: string) {
        statements.push(statement);
        if (statement.startsWith("SAVEPOINT ")) savepointValue = mutation;
        if (statement.startsWith("ROLLBACK TO SAVEPOINT ")) mutation = savepointValue;
        return [];
      },
    } as unknown as Tx;
    const { api } = harness({
      async issue() {
        mutation = true;
        return { value: "x".repeat(1024 * 1024) };
      },
    });
    const response = await api.issue(staffContext(GUEST_BOOKING_ISSUER_SCOPES, "{}", tx), "property-a");
    expect(response.status).toBe(503);
    expect(mutation).toBe(false);
    expect(statements).toEqual([
      "SAVEPOINT guest_booking_issue_http",
      "ROLLBACK TO SAVEPOINT guest_booking_issue_http",
      "RELEASE SAVEPOINT guest_booking_issue_http",
    ]);
  });

  it("maps unknown service failures to a generic response without leaking token or error text", async () => {
    const secretFailure = `database exploded while handling ${TOKEN}`;
    const { api } = harness({ async offers() { throw new Error(secretFailure); } });
    const response = await api.handle(guestRequest(), "offers");
    const body = await response.text();
    expect(response.status).toBe(503);
    expect(body).not.toContain(secretFailure);
    expect(body).not.toContain(TOKEN);
  });

  it("limits each live session to 30 requests per minute", async () => {
    const { api } = harness();
    const responses: Response[] = [];
    for (let index = 0; index < 31; index++) {
      responses.push(await api.handle(guestRequest(), "offers"));
    }
    expect(responses.slice(0, 30).every((response) => response.status === 200)).toBe(true);
    expect(responses[30]?.status).toBe(429);
  });
});

describe("guest booking routes mounted in createApp", () => {
  async function mountedHarness() {
    const calls: {
      readonly guest: Array<{ action: string; tenantId: string; tx: Tx }>;
      readonly issues: Array<{ tenantId: string; actorId: string; propertyNode: string; body: unknown; key: string; tx: Tx }>;
      readonly tenantTransactions: string[];
      readonly authenticates: string[];
    } = {
      guest: [], issues: [], tenantTransactions: [], authenticates: [],
    };
    const staffTokens = new Hs256TokenSigner(STAFF_SECRET);
    const guestTokens = new GuestBookingTokenSigner(GUEST_SECRET);
    const guestToken = guestTokens.issue("session", { sessionId: SESSION.sessionId }, 120);
    const session = { ...SESSION, tenantId: STAFF_TENANT };
    const service = {
      authenticate(token: string) {
        calls.authenticates.push(token);
        return token === guestToken ? session : null;
      },
      async issue(tx: Tx, issuer: { tenantId: string; actorId: string }, propertyNode: string, body: unknown, key: string) {
        calls.issues.push({ tenantId: issuer.tenantId, actorId: issuer.actorId, propertyNode, body, key, tx });
        return { invitation: "issued" };
      },
      async offers(tx: Tx, guest: typeof session) {
        calls.guest.push({ action: "offers", tenantId: guest.tenantId, tx });
        return { action: "offers" };
      },
      async quote(tx: Tx, guest: typeof session) {
        calls.guest.push({ action: "quotes", tenantId: guest.tenantId, tx });
        return { action: "quotes" };
      },
      async hold(tx: Tx, guest: typeof session) {
        calls.guest.push({ action: "holds", tenantId: guest.tenantId, tx });
        return { action: "holds" };
      },
      async reserve(tx: Tx, guest: typeof session) {
        calls.guest.push({ action: "reservations", tenantId: guest.tenantId, tx });
        return { action: "reservations" };
      },
    } as unknown as GuestBookingService;
    const database = {
      async withTenantTransaction<T>(tenantId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
        calls.tenantTransactions.push(tenantId);
        const tx = {
          async unsafe() { return []; },
        } as unknown as Tx;
        return work(tx);
      },
    } as unknown as Database;
    const routes = new GuestBookingHttpApi({ database, service });
    const operatorApi = {
      unauthorized: () => Response.json({ error: "unauthorized" }, { status: 401 }),
      failure: () => Response.json({ error: "failure" }, { status: 500 }),
    } as unknown as OperatorHttpApi;
    const app = createApp({
      database: {
        async withTenantTransaction<T>(tenantId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
          calls.tenantTransactions.push(tenantId);
          return work({ async unsafe() { return []; } } as unknown as Tx);
        },
      } as unknown as Database,
      tenantResolver: new BearerTenantResolver(staffTokens),
      operatorApi,
      guestBookingRoutes: routes,
    });
    return { app, calls, staffTokens, guestToken };
  }

  it("mounts exactly the four public POST operations and runs each in the session tenant transaction", async () => {
    const { app, calls, guestToken } = await mountedHarness();
    const actions = ["offers", "quotes", "holds", "reservations"] as const;
    const responses = await Promise.all(PUBLIC_BOOKING_ROUTES.map((path) => app.handle(new Request(
      `https://yellow.test${path}`,
      { method: "POST", headers: { authorization: `bEaReR ${guestToken}`, "content-type": "application/json" }, body: "{}" },
    ))));

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
    expect(await Promise.all(responses.map((response) => response.json()))).toEqual(actions.map((action) => ({ action })));
    expect(calls.guest.map(({ action, tenantId }) => ({ action, tenantId }))).toEqual(
      actions.map((action) => ({ action, tenantId: STAFF_TENANT })),
    );
    expect(calls.tenantTransactions).toEqual(Array(4).fill(STAFF_TENANT));
    expect(calls.guest.every(({ tx }) => tx !== undefined)).toBe(true);
    expect(calls.authenticates).toEqual(Array(4).fill(guestToken));

    const wrongMethod = await app.handle(new Request(`https://yellow.test${PUBLIC_BOOKING_ROUTES[0]}`, {
      method: "GET", headers: { authorization: `Bearer ${guestToken}` },
    }));
    const unknownPath = await app.handle(new Request("https://yellow.test/api/public/booking/status", {
      method: "POST", headers: { authorization: `Bearer ${guestToken}`, "content-type": "application/json" }, body: "{}",
    }));
    expect([wrongMethod.status, unknownPath.status]).toEqual([404, 404]);
  });

  it("returns 404 for public routes when guest booking is not configured", async () => {
    const app = createApp();
    const responses = await Promise.all(PUBLIC_BOOKING_ROUTES.map((path) => app.handle(new Request(
      `https://yellow.test${path}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
    ))));
    expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404]);
  });

  it("mounts issuance only under the existing operator tenant boundary and requires all five scopes", async () => {
    const { app, calls, staffTokens, guestToken } = await mountedHarness();
    const body = JSON.stringify({ tenantId: OTHER_TENANT, propertyNode: OTHER_TENANT, purpose: "direct_booking" });
    const issuePath = `https://yellow.test/api/v1/properties/${PROPERTY_ID}/booking-invitations`;

    for (const omitted of GUEST_BOOKING_ISSUER_SCOPES) {
      const token = await staffTokens.issue({
        userId: STAFF_ID,
        tenantId: STAFF_TENANT,
        scopes: GUEST_BOOKING_ISSUER_SCOPES.filter((scope) => scope !== omitted),
      });
      const denied = await app.handle(new Request(issuePath, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "idempotency-key": "issue-1" },
        body: "{",
      }));
      expect(denied.status).toBe(403);
    }
    expect(calls.issues).toEqual([]);

    const staffToken = await staffTokens.issue({ userId: STAFF_ID, tenantId: STAFF_TENANT, scopes: GUEST_BOOKING_ISSUER_SCOPES });
    const issued = await app.handle(new Request(issuePath, {
      method: "POST",
      headers: { authorization: `Bearer ${staffToken}`, "content-type": "application/json", "idempotency-key": "issue-1" },
      body,
    }));
    expect(issued.status).toBe(201);
    expect(await issued.json()).toEqual({ invitation: "issued" });
    expect(calls.issues.map(({ tenantId, actorId, propertyNode, body: inputBody, key }) => ({ tenantId, actorId, propertyNode, body: inputBody, key }))).toEqual([{
      tenantId: STAFF_TENANT,
      actorId: STAFF_ID,
      propertyNode: PROPERTY_ID,
      body: { tenantId: OTHER_TENANT, propertyNode: OTHER_TENANT, purpose: "direct_booking" },
      key: "issue-1",
    }]);
    expect(calls.tenantTransactions).toEqual([...Array(5).fill(STAFF_TENANT), STAFF_TENANT]);

    const appWithoutOperator = createApp({ guestBookingRoutes: new GuestBookingHttpApi({
      database: {} as Database,
      service: {} as GuestBookingService,
    }) });
    const notMounted = await appWithoutOperator.handle(new Request(issuePath, {
      method: "POST", headers: { authorization: `Bearer ${staffToken}`, "content-type": "application/json" }, body,
    }));
    expect(notMounted.status).toBe(404);
  });

  it("keeps staff bearer tokens and guest session tokens in separate authentication boundaries", async () => {
    const { app, calls, staffTokens, guestToken } = await mountedHarness();
    const staffToken = await staffTokens.issue({ userId: STAFF_ID, tenantId: STAFF_TENANT, scopes: GUEST_BOOKING_ISSUER_SCOPES });
    const guestWithStaffToken = await app.handle(new Request(`https://yellow.test${PUBLIC_BOOKING_ROUTES[0]}`, {
      method: "POST", headers: { authorization: `Bearer ${staffToken}`, "content-type": "application/json" }, body: "{}",
    }));
    const staffWithGuestToken = await app.handle(new Request(`https://yellow.test/api/v1/properties/${PROPERTY_ID}/booking-invitations`, {
      method: "POST", headers: { authorization: `Bearer ${guestToken}`, "content-type": "application/json", "idempotency-key": "issue-1" }, body: "{}",
    }));

    expect(guestWithStaffToken.status).toBe(401);
    expect(staffWithGuestToken.status).toBe(401);
    expect(calls.guest).toEqual([]);
    expect(calls.issues).toEqual([]);
    expect(calls.authenticates).toEqual([staffToken]);
    expect(calls.tenantTransactions).toEqual([]);
  });
});
