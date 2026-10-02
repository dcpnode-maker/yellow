import { describe, expect, it } from "bun:test";
import { createApp } from "../src/app";
import {
  BearerTenantResolver,
  GuestBookingTokenSigner,
  Hs256TokenSigner,
  PUBLIC_BOOKING_PUBLISHER_SCOPES,
} from "../src/contexts/identity";
import type { GuestBookingService, PublicBookingService } from "../src/contexts/reservations";
import type { OperatorHttpApi } from "../src/http/operator";
import { GuestBookingHttpApi } from "../src/http/guest-booking";
import { PublicBookingHttpApi } from "../src/http/public-booking";
import type { Database, Tx } from "../src/kernel";
import type { PublicBookingSiteAuthority } from "../src/contexts/identity";

const STAFF_TENANT = "00000000-0000-0000-0000-000000000701";
const STAFF_ACTOR = "00000000-0000-0000-0000-000000000702";
const PROPERTY = "00000000-0000-0000-0000-000000000703";
const SITE = "00000000-0000-0000-0000-000000000704";
const RATE_PLAN = "00000000-0000-0000-0000-000000000705";
const PUBLIC_TENANT = "00000000-0000-0000-0000-000000000706";
const INVITATION_TENANT = "00000000-0000-0000-0000-000000000707";
const INVITATION_SECRET = "mounted-proof-invitation-secret-0001";
const PUBLIC_SECRET = "mounted-proof-public-site-secret-0001";
const STAFF_SECRET = "mounted-proof-staff-token-secret-0001";
const CLOCK = 1_798_900_000_000;

function jsonRequest(path: string, token?: string, body = "{}", origin?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (origin) headers.set("origin", origin);
  return new Request(`https://yellow.test${path}`, { method: "POST", headers, body });
}

function mounted() {
  const calls = {
    transactions: [] as string[],
    sql: [] as string[],
    sitesResolved: [] as string[],
    guestActions: [] as string[],
    publicActions: [] as string[],
    published: [] as Array<{ tenantId: string; actorId: string; property: string; tx: Tx }>,
  };
  const tx = {
    async unsafe(statement: string) { calls.sql.push(statement); return []; },
  } as unknown as Tx;
  const database = {
    async withTenantTransaction<T>(tenantId: string, work: (transaction: Tx) => Promise<T>): Promise<T> {
      calls.transactions.push(tenantId);
      return work(tx);
    },
  } as unknown as Database;

  const tokens = new GuestBookingTokenSigner(INVITATION_SECRET, { now: () => CLOCK });
  const invitationToken = tokens.issue("session", { sessionId: "invitation-session" }, 600);
  const invitationSession = {
    tenantId: INVITATION_TENANT,
    propertyNode: PROPERTY,
    actorId: STAFF_ACTOR,
    primaryPartyId: "00000000-0000-0000-0000-000000000708",
    ratePlanIds: [RATE_PLAN],
    channelCode: "direct",
    sessionId: "00000000-0000-0000-0000-000000000709",
    issuedAt: Math.floor(CLOCK / 1000),
    expiresAt: Math.floor(CLOCK / 1000) + 600,
  };
  const guestService = {
    authenticate(token: string) { return token === invitationToken ? invitationSession : null; },
    async context(_transaction: Tx, _session: typeof invitationSession, body: unknown) {
      expect(body).toEqual({});
      calls.guestActions.push("context");
      return { property: { id: PROPERTY, name: "Mount House", timeZone: "UTC" }, ratePlans: [] };
    },
    async issue(_transaction: Tx) { calls.guestActions.push("issue"); return { invitation: true }; },
  } as unknown as GuestBookingService;
  const guestRoutes = new GuestBookingHttpApi({ database, service: guestService });

  const publicTokens = new GuestBookingTokenSigner(PUBLIC_SECRET, { now: () => CLOCK });
  const publicToken = publicTokens.issue("public-session", { sessionId: "public-session" }, 600);
  const publicSession = {
    tenantId: PUBLIC_TENANT,
    propertyNode: PROPERTY,
    actorId: STAFF_ACTOR,
    siteId: SITE,
    siteVersion: 1,
    ratePlanIds: [RATE_PLAN],
    channelCode: "direct",
    sessionId: "00000000-0000-0000-0000-000000000710",
    issuedAt: Math.floor(CLOCK / 1000),
    expiresAt: Math.floor(CLOCK / 1000) + 600,
  };
  const publicService = {
    authenticate(token: string) { return token === publicToken ? publicSession : null; },
    async start() {
      return {
        token: publicToken,
        expiresAt: new Date(CLOCK + 600_000).toISOString(),
        property: { id: PROPERTY, name: "Mount House", timeZone: "UTC" },
        paymentAccepted: false as const,
      };
    },
    async offers() { calls.publicActions.push("offers"); return { action: "offers" }; },
    async quote() { calls.publicActions.push("quotes"); return { action: "quotes" }; },
    async hold() { calls.publicActions.push("holds"); return { action: "holds" }; },
    async details() { calls.publicActions.push("details"); return { action: "details" }; },
    async reserve() { calls.publicActions.push("reservations"); return { action: "reservations" }; },
  } as unknown as PublicBookingService;
  const siteContext = {
    tenantId: PUBLIC_TENANT,
    propertyNode: PROPERTY,
    propertyName: "Mount House",
    timeZone: "UTC",
    site: { siteId: SITE, version: 1, active: true as const, issuerId: STAFF_ACTOR, ratePlanIds: [RATE_PLAN], channelCode: "direct" },
  };
  const authority = {
    async resolve() { return siteContext; },
    async publish(transaction: Tx, identity: { tenantId: string; actorId?: string }, property: string) {
      calls.published.push({ tenantId: identity.tenantId, actorId: identity.actorId ?? "", property, tx: transaction });
      return { siteId: SITE, version: 2, active: true, channelCode: "direct", ratePlanIds: [RATE_PLAN] };
    },
  } as unknown as PublicBookingSiteAuthority;
  const publicRoutes = new PublicBookingHttpApi({
    database,
    service: publicService,
    authority,
    now: () => CLOCK,
    async resolveSite(siteId) {
      calls.sitesResolved.push(siteId);
      return siteId === SITE ? siteContext : null;
    },
  });

  const staffTokens = new Hs256TokenSigner(STAFF_SECRET, { now: () => Math.floor(CLOCK / 1000) });
  const operatorApi = {
    unauthorized: () => Response.json({ error: "unauthorized" }, { status: 401 }),
    failure: () => Response.json({ error: "failure" }, { status: 500 }),
  } as unknown as OperatorHttpApi;
  const app = createApp({
    database,
    tenantResolver: new BearerTenantResolver(staffTokens),
    operatorApi,
    guestBookingRoutes: guestRoutes,
    publicBookingRoutes: publicRoutes,
  });
  return { app, calls, staffTokens, invitationToken, publicToken, publicSession };
}

describe("assembled mounted booking composition proof", () => {
  it("mounts invitation context, public site start and all five storefront commands with separate bearer domains", async () => {
    const h = mounted();
    const start = await h.app.handle(jsonRequest(`/api/public/booking/sites/${SITE}/sessions`, undefined, "{}", "https://yellow.test"));
    expect(start.status).toBe(201);
    expect(start.headers.get("cache-control")).toBe("no-store");
    expect(await start.json()).toMatchObject({ property: { id: PROPERTY }, paymentAccepted: false });

    const actions = ["offers", "quotes", "holds", "details", "reservations"] as const;
    const paths = [
      "/api/public/booking/storefront/offers",
      "/api/public/booking/storefront/quotes",
      "/api/public/booking/storefront/holds",
      "/api/public/booking/storefront/details",
      "/api/public/booking/storefront/reservations",
    ];
    const responses = await Promise.all(paths.map((path) => h.app.handle(jsonRequest(path, h.publicToken))));
    expect(responses.map((response) => response.status)).toEqual(Array(5).fill(200));
    expect(await Promise.all(responses.map((response) => response.json()))).toEqual(actions.map((action) => ({ action })));
    expect(h.calls.publicActions).toEqual([...actions]);
    expect(responses.every((response) => response.headers.get("cache-control") === "no-store")).toBe(true);

    const context = await h.app.handle(jsonRequest("/api/public/booking/context", h.invitationToken));
    expect(context.status).toBe(200);
    expect(context.headers.get("cache-control")).toBe("no-store");
    expect(await context.json()).toEqual({ property: { id: PROPERTY, name: "Mount House", timeZone: "UTC" }, ratePlans: [] });
    expect(h.calls.guestActions).toEqual(["context"]);

    const staffToken = await h.staffTokens.issue({
      userId: STAFF_ACTOR,
      tenantId: STAFF_TENANT,
      scopes: PUBLIC_BOOKING_PUBLISHER_SCOPES,
    });
    const publish = await h.app.handle(jsonRequest(
      `/api/v1/properties/${PROPERTY}/booking-site`, staffToken,
      JSON.stringify({ active: true, ratePlanIds: [RATE_PLAN], channelCode: "direct" }),
    ));
    expect(publish.status).toBe(200);
    expect(await publish.json()).toEqual({ siteId: SITE, version: 2, active: true, channelCode: "direct", ratePlanIds: [RATE_PLAN] });
    expect(h.calls.published.map(({ tenantId, actorId, property }) => ({ tenantId, actorId, property }))).toEqual([
      { tenantId: STAFF_TENANT, actorId: STAFF_ACTOR, property: PROPERTY },
    ]);
    expect(h.calls.sql).toEqual(["SAVEPOINT public_booking_publish_http", "RELEASE SAVEPOINT public_booking_publish_http"]);
    expect(h.calls.transactions).toContain(STAFF_TENANT);
    expect(h.calls.transactions).toContain(PUBLIC_TENANT);
    expect(h.calls.transactions).toContain(INVITATION_TENANT);
  });

  it("denies wrong tokens, invalid staff identity, foreign origins and unknown or unconfigured routes before domain work", async () => {
    const h = mounted();
    const before = h.calls.transactions.length;
    const staffToken = await h.staffTokens.issue({ userId: STAFF_ACTOR, tenantId: STAFF_TENANT, scopes: PUBLIC_BOOKING_PUBLISHER_SCOPES });
    const invalidStaff = await h.app.handle(jsonRequest(`/api/v1/properties/${PROPERTY}/booking-site`, "invalid-staff-token"));
    expect(invalidStaff.status).toBe(401);
    expect(h.calls.transactions).toHaveLength(before);

    const wrongInvitationWithStaff = await h.app.handle(jsonRequest("/api/public/booking/context", staffToken));
    const wrongInvitationWithPublic = await h.app.handle(jsonRequest("/api/public/booking/context", h.publicToken));
    const wrongPublicSiteWithInvitation = await h.app.handle(jsonRequest("/api/public/booking/storefront/offers", h.invitationToken));
    const wrongPublicSiteWithStaff = await h.app.handle(jsonRequest("/api/public/booking/storefront/offers", staffToken));
    expect([wrongInvitationWithStaff.status, wrongInvitationWithPublic.status,
      wrongPublicSiteWithInvitation.status, wrongPublicSiteWithStaff.status]).toEqual([401, 401, 401, 401]);
    expect(h.calls.transactions).toHaveLength(before);

    const foreignStart = await h.app.handle(jsonRequest(`/api/public/booking/sites/${SITE}/sessions`, undefined, "{}", "https://attacker.test"));
    const foreignCommand = await h.app.handle(jsonRequest("/api/public/booking/storefront/offers", h.publicToken, "{}", "https://attacker.test"));
    expect([foreignStart.status, foreignCommand.status]).toEqual([403, 403]);
    expect(h.calls.transactions).toHaveLength(before);
    expect(h.calls.sitesResolved).toEqual([]);
    expect(h.calls.publicActions).toEqual([]);

    const foreignStaffPublish = await h.app.handle(jsonRequest(
      `/api/v1/properties/${PROPERTY}/booking-site`, staffToken,
      JSON.stringify({ active: true, ratePlanIds: [RATE_PLAN], channelCode: "direct" }),
      "https://attacker.test",
    ));
    expect(foreignStaffPublish.status).toBe(403);
    // The existing operator middleware establishes its tenant transaction before the
    // publish handler checks Origin; the handler must still stop before savepoint or domain work.
    expect(h.calls.transactions.slice(before)).toEqual([STAFF_TENANT]);
    expect(h.calls.sql).toEqual([]);
    expect(h.calls.published).toEqual([]);

    const unknown = await h.app.handle(jsonRequest("/api/public/booking/storefront/not-a-command", h.publicToken));
    expect(unknown.status).toBe(404);
    const withoutCapability = createApp({ database: {} as Database });
    const absent = await withoutCapability.handle(jsonRequest(`/api/public/booking/sites/${SITE}/sessions`));
    expect(absent.status).toBe(404);
  });
});
