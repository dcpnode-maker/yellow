import { afterEach, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createAuthSession, type AuthSession } from "../frontend/yellow/src/auth-session";
import { reservationViewForDestination, reservationViewHref } from "../frontend/yellow/src/reservation-navigation";
const { AuthenticationGate } = await import("../frontend/yellow/src/AuthenticationGate");
const ACTOR = "b2836978-73fe-58f9-b808-8b58cceac1c4", TENANT = "6d9b7ce2-2d14-5576-b8c3-80f06501a603";
const PROPERTY = "6081b544-22a1-534f-a86d-bb1ae0519e14", OTHER = "00000000-0000-0000-0000-000000000123";
const properties = [{ id: PROPERTY, name: "Synthetic property", timezone: "Asia/Riyadh" }];
const credentials = { tenant: "synthetic", email: "synthetic@example.invalid", password: "synthetic-test-only" };
function login(ttl = 300, actor = ACTOR, tenant = TENANT) {
  return { accessToken: `header.${btoa(JSON.stringify({ sub: actor, tid: tenant }))}.synthetic`, tokenType: "Bearer",
    expiresInSeconds: ttl, user: { id: actor, displayName: "Synthetic actor" } };
}
function response(value: unknown, status = 200) { return Response.json(value, { status }); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; }
const stores: AuthSession[] = [];
function store(options: Parameters<typeof createAuthSession>[0]) { const auth = createAuthSession(options); stores.push(auth); return auth; }
afterEach(() => { for (const auth of stores.splice(0)) auth.dispose(); });

test("a fresh document resumes once, verifies actual grants and retains deep link without JS storage or demo", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const auth = store({ fetch: async (url, init) => { calls.push({ url, init }); return response(url.endsWith("browser/resume") ? login() : { properties }); } });
  const first = auth.bootstrap(PROPERTY); expect(auth.bootstrap(PROPERTY)).toBe(first);
  await first; expect(await auth.session()).toBe(login().accessToken);
  expect(calls.map(call => call.url)).toEqual(["/api/v1/auth/browser/resume", "/api/v1/me/properties"]);
  expect(calls[0]?.init).toMatchObject({ method: "POST", credentials: "same-origin", cache: "no-store", body: "{}" });
  expect(new Headers(calls[0]?.init?.headers).get("x-yellow-browser-session")).toBe("v1");
  expect(new Headers(calls[0]?.init?.headers).has("authorization")).toBe(false);
  expect(new Headers(calls[1]?.init?.headers).get("authorization")).toBe(`Bearer ${login().accessToken}`);
  const location = { pathname: `/p/${PROPERTY}/today`, search: "?lane=in_house", replace() { throw new Error("SSR must not navigate"); } };
  const html = renderToString(createElement(AuthenticationGate, { auth, location }, createElement("p", null, "Original workspace")));
  expect(html).toContain("Original workspace"); expect(html).toContain("Sign out");
  expect(html).not.toContain('inert=""'); expect(html).not.toContain(login().accessToken);
  expect(html).not.toContain(credentials.password);
  const source = await Bun.file(new URL("../frontend/yellow/src/auth-session.ts", import.meta.url)).text();
  expect(source).not.toMatch(/localStorage|sessionStorage|demo:enter|document\.cookie/);
});

test("missing cookie stays signed out; revoked property and transport failure cannot expose a bearer", async () => {
  const missing = store({ fetch: async () => response({}, 401) });
  expect((await missing.bootstrap(PROPERTY)).status).toBe("anonymous"); await expect(missing.session()).rejects.toThrow();
  const revoked = store({ fetch: async url => response(url.endsWith("browser/resume") ? login() : { properties }) });
  await expect(revoked.bootstrap(OTHER)).rejects.toThrow("no longer granted"); await expect(revoked.session()).rejects.toThrow();
  const unavailable = store({ fetch: async () => response({}, 503) });
  await expect(unavailable.bootstrap()).rejects.toMatchObject({ status: 503 }); await expect(unavailable.session()).rejects.toThrow();
});

test("resume transport latency cannot extend original remaining TTL and in-document expiry requires credentials", async () => {
  let clock = 0, calls = 0;
  const auth = store({ now: () => clock, fetch: async url => {
    ++calls; if (url.endsWith("browser/resume")) { clock = 2000; return response(login(3)); }
    return response({ properties });
  } });
  await auth.bootstrap(PROPERTY); clock = 2999; expect(await auth.session()).toBe(login().accessToken);
  clock = 3000; await expect(auth.session()).rejects.toThrow();
  await auth.bootstrap(PROPERTY); expect(calls).toBe(2); expect(auth.getSnapshot().status).toBe("expired");
});

test("credential transport latency is included in the original lifetime rather than added after response arrival", async () => {
  let clock = 0;
  const auth = store({ now: () => clock, fetch: async url => {
    if (url.endsWith("local:login")) { clock = 2000; return response(login(3)); }
    return response({ properties });
  } });
  await auth.signIn(credentials); clock = 3000; await expect(auth.session()).rejects.toThrow();
});

test("logout rejects a late bootstrap property grant without retaining any anonymous candidate identity", async () => {
  const grants = deferred<Response>(); const entered = deferred<void>();
  const auth = store({ fetch: async url => {
    if (url.endsWith("browser/resume")) return response(login());
    if (url.endsWith("browser/logout")) return new Response(null, { status: 204 });
    entered.resolve(); return grants.promise;
  } });
  const result = auth.bootstrap(PROPERTY).catch(error => error);
  await entered.promise; await auth.logout(); grants.resolve(response({ properties }));
  expect((await result).message).toContain("newer authentication");
  expect(auth.getSnapshot().principal).toBeNull(); await expect(auth.session()).rejects.toThrow();
});

test("late resume cannot overwrite a newer credential identity or adopt its granted property response", async () => {
  const pending = deferred<Response>(); let grantReads = 0;
  const auth = store({ fetch: async url => {
    if (url.endsWith("browser/resume")) return pending.promise;
    if (url.endsWith("local:login")) return response(login(900));
    ++grantReads; return response({ properties });
  } });
  const resume = auth.bootstrap(PROPERTY).catch(error => error);
  await auth.signIn(credentials); pending.resolve(response(login(300, OTHER)));
  expect((await resume).message).toContain("newer authentication"); expect(auth.getSnapshot().principal?.actorId).toBe(ACTOR); expect(grantReads).toBe(1);
});

test("logout locks memory immediately, clears after earlier cookie-writing login and protects recovery actor", async () => {
  const pending = deferred<Response>(); const calls: string[] = []; let credentialAttempt = 0;
  const auth = store({ fetch: async url => {
    calls.push(url);
    if (url.endsWith("local:login")) { ++credentialAttempt; return credentialAttempt === 1 ? response(login(900)) : pending.promise; }
    if (url.endsWith("browser/logout")) return new Response(null, { status: 204 });
    return response({ properties });
  } });
  await auth.signIn(credentials);
  const older = auth.signIn(credentials).catch(error => error);
  const logout = auth.logout(); expect(auth.logout()).toBe(logout);
  await expect(auth.session()).rejects.toThrow(); expect(auth.getSnapshot().principal?.actorId).toBe(ACTOR);
  expect(auth.getSnapshot().status).toBe("expired"); expect(calls).not.toContain("/api/v1/auth/browser/logout");
  await expect(auth.signIn(credentials)).rejects.toThrow("Sign-out is still");
  pending.resolve(response(login(900))); expect((await older).message).toContain("newer sign-in"); await logout;
  expect(calls.at(-1)).toBe("/api/v1/auth/browser/logout");
  const location = { pathname: `/p/${PROPERTY}/today`, search: "", replace() {} };
  const html = renderToString(createElement(AuthenticationGate, { auth, location }, createElement("p", { "data-key": "immutable-operation-key" }, "Pending work")));
  expect(html).toContain("immutable-operation-key"); expect(html).toContain('inert=""'); expect(html).toContain("same account");
});

test("logout failure is explicit and token stays locked; same tenant does not authorize actor substitution", async () => {
  let actor = ACTOR;
  const auth = store({ fetch: async url => url.endsWith("browser/logout") ? response({}, 503) :
    response(url.endsWith("local:login") ? login(900, actor) : { properties }) });
  await auth.signIn(credentials); await expect(auth.logout()).rejects.toThrow("could not be confirmed");
  await expect(auth.session()).rejects.toThrow(); actor = OTHER;
  await expect(auth.signIn(credentials, PROPERTY)).rejects.toThrow("same account");
  actor = ACTOR; await auth.signIn(credentials, PROPERTY); expect(auth.getSnapshot().status).toBe("authenticated");
});

test("actual workflow finance and cashiers share existing route and every financial/lifecycle/mode lock", async () => {
  const source = await Bun.file(new URL("../frontend/yellow/src/App.tsx", import.meta.url)).text();
  const start = source.indexOf("  const workflow = (part:");
  const end = source.indexOf("  const billingDesk =", start);
  const compiled = new Bun.Transpiler({ loader: "tsx" }).transformSync(source.slice(start, end));
  const make = new Function("reservationLifecycleBusyRef", "voiceTransferRecoveryLockedRef", "propertyModeNavigationLocked", "window", "propertyId", "internalMarketLabEnabled", "reservationViewForDestination", "reservationViewHref", "PopStateEvent", "navigateYellow", compiled + "\nreturn workflow;");
  for (const [life, transfer, mode] of [[false, false, false], [true, false, false], [false, true, false], [false, false, true]]) {
    const hrefs: string[] = [];
    const workflow = make({ current: life }, { current: transfer }, mode, { location: {} }, PROPERTY, false, reservationViewForDestination, reservationViewHref, class {}, (href: string) => hrefs.push(href));
    workflow("finance"); workflow("cashiers");
    expect(hrefs).toEqual(life || transfer || mode ? [] : [`/p/${PROPERTY}/today?workspace=finance`, `/p/${PROPERTY}/today?workspace=finance`]);
  }
});
