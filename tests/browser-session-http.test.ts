import { expect, test } from "bun:test";
import { BrowserSessionHttpApi } from "../src/http/browser-session";
import { Hs256TokenSigner, BearerTenantResolver, LocalLoginService, type LocalLoginResult } from "../src/contexts/identity";
import { createApp } from "../src/app";
import { OperatorHttpApi } from "../src/http/operator";
import { AvailabilityService } from "../src/contexts/inventory";
import { SECURITY_HEADERS } from "../src/http/security-headers";

const ACTOR = "b2836978-73fe-58f9-b808-8b58cceac1c4", TENANT = "6d9b7ce2-2d14-5576-b8c3-80f06501a603";
const ORIGIN = "https://yellow-preview.example.invalid";
const COOKIE = "__Host-yellow-browser-session";
const peer = { address: "127.0.0.1" };
function request(path = "browser/resume", extra: Record<string, string> = {}, origin = ORIGIN, method = "POST") {
  return new Request(`${origin}/api/v1/auth/${path}`, { method, headers: {
    origin, "content-type": "application/json", "x-yellow-browser-session": "v1", "sec-fetch-site": "same-origin", ...extra,
  }, ...(method === "POST" ? { body: "{}" } : {}) });
}
async function fixture() {
  let clock = 1_800_000_000, reads = 0, active = true;
  const tokens = new Hs256TokenSigner("synthetic-browser-session-test-secret-0001", {
    now: () => clock, jtiFactory: () => "00000000-0000-0000-0000-000000000987",
  });
  const token = await tokens.issue({ userId: ACTOR, tenantId: TENANT, scopes: ["inventory.space:read"] });
  const api = new BrowserSessionHttpApi(tokens, { async readActiveActor(claims) {
    ++reads; expect(claims.tid).toBe(TENANT); expect(claims.sub).toBe(ACTOR);
    return active ? { id: ACTOR, displayName: "Synthetic operator" } : null;
  } }, { httpsOrigins: [ORIGIN] }, () => clock);
  const login = () => Response.json({ accessToken: token, tokenType: "Bearer", expiresInSeconds: 900,
    user: { id: ACTOR, displayName: "Synthetic operator" } });
  return { api, tokens, token, login, clock: (value: number) => { clock = value; },
    revoke: () => { active = false; }, reads: () => reads };
}

test("credential response sets only host Secure HttpOnly Strict cookie and resume returns identical bearer without extending expiry", async () => {
  const f = await fixture();
  const login = await f.api.captureCredentialLogin(request("local:login"), f.login());
  expect(login.status).toBe(200);
  expect(login.headers.get("set-cookie")).toBe(`${COOKIE}=${f.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=900`);
  expect(login.headers.get("cache-control")).toBe("no-store");
  f.clock(1_800_000_600);
  const resumed = await f.api.resume(request(undefined, { cookie: `${COOKIE}=${f.token}` }), {});
  expect(resumed.status).toBe(200);
  expect(await resumed.json()).toEqual({ accessToken: f.token, tokenType: "Bearer", expiresInSeconds: 300,
    user: { id: ACTOR, displayName: "Synthetic operator" } });
  expect(resumed.headers.has("set-cookie")).toBe(false);
  expect(resumed.headers.get("cache-control")).toBe("no-store");
  expect(f.reads()).toBe(1);
});

test("original expiry excludes verifier skew and inactive identity; ambiguous or tampered cookies fail closed", async () => {
  const f = await fixture();
  f.clock(1_800_000_900);
  expect(await f.tokens.verify(f.token)).not.toBeNull();
  expect((await f.api.resume(request(undefined, { cookie: `${COOKIE}=${f.token}` }), {})).status).toBe(401);
  expect(f.reads()).toBe(0);
  f.clock(1_800_000_899); f.revoke();
  expect((await f.api.resume(request(undefined, { cookie: `${COOKIE}=${f.token}` }), {})).status).toBe(401);
  for (const value of ["", `${COOKIE}=${f.token}; ${COOKIE}=${f.token}`, `${COOKIE}=${f.token}x`, `${COOKIE}=bad`]) {
    expect((await f.api.resume(request(undefined, { cookie: value }), {})).status).toBe(401);
  }
  expect((await f.api.resume(request(), { token: f.token })).status).toBe(400);
});

test("exact Origin, custom JSON header and secure transport reject CSRF and untrusted proxy inference", async () => {
  const f = await fixture();
  for (const headers of ([{ origin: "null" }, { origin: "https://evil.example.invalid" },
    { "x-yellow-browser-session": "wrong" }, { "content-type": "text/plain" },
    { "sec-fetch-site": "cross-site" }] as Array<Record<string, string>>)) expect(f.api.admission(request(undefined, headers))?.status).toBe(403);
  expect(f.api.admission(request(undefined, {}, ORIGIN, "GET"))?.status).toBe(403);
  const missing = request(); missing.headers.delete("origin"); expect(f.api.admission(missing)?.status).toBe(403);
  const internal = new Request("http://127.0.0.1:3184/api/v1/auth/browser/resume", { method: "POST", headers: {
    origin: ORIGIN, "content-type": "application/json", "x-yellow-browser-session": "v1",
    "x-forwarded-proto": "https", "x-forwarded-host": new URL(ORIGIN).host,
  }, body: "{}" });
  expect(f.api.admission(internal, peer)?.status).toBe(403);
  const proxy = new BrowserSessionHttpApi(f.tokens, f.api.identities,
    { httpsOrigins: [ORIGIN], allowLoopbackTlsProxy: true });
  expect(proxy.admission(internal, peer)).toBeNull();
  expect(proxy.admission(internal, { address: "192.0.2.4" })?.status).toBe(403);
  internal.headers.set("origin", "https://evil.example.invalid"); expect(proxy.admission(internal, peer)?.status).toBe(403);
  const local = new BrowserSessionHttpApi(f.tokens, f.api.identities, { httpsOrigins: [], localhostHttpOrigin: "http://localhost:3184" });
  expect(local.admission(request(undefined, {}, "http://localhost:3184"), peer)).toBeNull();
  expect(local.admission(request(undefined, {}, "http://localhost:3184"), { address: "192.0.2.4" })?.status).toBe(403);
  expect(() => new BrowserSessionHttpApi(f.tokens, f.api.identities, { httpsOrigins: [], localhostHttpOrigin: "http://127.0.0.1:3184" })).toThrow();
  expect(() => new BrowserSessionHttpApi(f.tokens, f.api.identities, { httpsOrigins: [ORIGIN + "/"] })).toThrow();
});

test("logout clears only browser cookie; ordinary resolver never accepts cookie authority", async () => {
  const f = await fixture(); const req = request(undefined, { cookie: `${COOKIE}=${f.token}` });
  const resolver = new BearerTenantResolver(f.tokens);
  expect(await resolver.resolve(req)).toBeNull();
  req.headers.set("authorization", `Bearer ${f.token}`);
  expect(await resolver.resolve(req)).toMatchObject({ actorId: ACTOR, tenantId: TENANT });
  const logout = f.api.logout(request("browser/logout"), {});
  expect(logout.status).toBe(204);
  expect(logout.headers.get("set-cookie")).toBe(`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  expect(await f.tokens.verify(f.token)).not.toBeNull(); // No bearer/global revocation claim.
});

test("actual app login opt-in preserves native contract and rejects browser origin before password work, without CORS authorization", async () => {
  const f = await fixture(); let calls = 0;
  class SyntheticLogin extends LocalLoginService {
    constructor() { super({ async reserve(): Promise<never> { throw new Error("No DB fixture"); } },
      { async issue(): Promise<never> { throw new Error("No issue fixture"); } }); }
    override async authenticate(): Promise<LocalLoginResult> { ++calls; return await f.login().json(); }
  }
  const app = createApp({ operatorApi: new OperatorHttpApi(new SyntheticLogin(), new AvailabilityService()),
    browserSessionApi: f.api, tenantResolver: new BearerTenantResolver(f.tokens) });
  const credentials = { tenant: "synthetic", email: "synthetic@example.invalid", password: "synthetic-test-only" };
  const native = await app.handle(new Request(`${ORIGIN}/api/v1/auth/local:login`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify(credentials) }));
  expect(native.status).toBe(200); expect(native.headers.has("set-cookie")).toBe(false);
  const browser = request("local:login"); const browserRequest = new Request(browser.url, { method: "POST", headers: browser.headers, body: JSON.stringify(credentials) });
  const accepted = await app.handle(browserRequest);
  expect(accepted.status).toBe(200); expect(accepted.headers.get("set-cookie")).toContain("HttpOnly; Secure; SameSite=Strict");
  expect(calls).toBe(2);
  const denied = await app.handle(request("local:login", { origin: "https://evil.example.invalid" }));
  expect(denied.status).toBe(403); expect(calls).toBe(2);
  expect(denied.headers.has("access-control-allow-origin")).toBe(false);
  const preflight = await app.handle(new Request(`${ORIGIN}/api/v1/auth/local:login`, { method: "OPTIONS",
    headers: { origin: "https://evil.example.invalid", "access-control-request-method": "POST", "access-control-request-headers": "x-yellow-browser-session" } }));
  expect(preflight.headers.has("access-control-allow-origin")).toBe(false);
  const cookieOnly = await app.handle(request("browser/resume", { cookie: `${COOKIE}=${f.token}` }));
  expect(cookieOnly.status).toBe(200);
  const unauthorized = await app.handle(new Request(`${ORIGIN}/api/v1/me/properties`, { headers: { cookie: `${COOKIE}=${f.token}`, accept: "application/json" } }));
  expect(unauthorized.status).toBe(401);
  const write = await app.handle(new Request(`${ORIGIN}/api/v1/properties/6081b544-22a1-534f-a86d-bb1ae0519e14/operating-mode`,
    { method: "POST", headers: { cookie: `${COOKIE}=${f.token}`, "content-type": "application/json", accept: "application/json" }, body: "{}" }));
  expect(write.status).toBe(401);
  const loggedOut = await app.handle(request("browser/logout"));
  expect(loggedOut.status).toBe(204); expect(loggedOut.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(SECURITY_HEADERS["permissions-policy"]).toBe("camera=(), geolocation=(), microphone=(self), payment=(), usb=()");
});

test("cookie wrapper preserves failed credential responses and rejects overlong cookies; expiry is rechecked after identity IO", async () => {
  const f = await fixture();
  for (const status of [401, 429, 503]) {
    const original = Response.json({ error: "synthetic failure" }, { status, headers: { "retry-after": "30" } });
    const failed = await f.api.captureCredentialLogin(request("local:login"), original);
    expect(failed).toBe(original); expect(failed.status).toBe(status); expect(failed.headers.get("retry-after")).toBe("30");
    expect(failed.headers.has("set-cookie")).toBe(false);
  }
  expect((await f.api.captureCredentialLogin(request("local:login"), Response.json({
    accessToken: "x".repeat(3801), tokenType: "Bearer", user: { id: ACTOR },
  }))).status).toBe(503);
  const slow = new BrowserSessionHttpApi(f.tokens, { async readActiveActor() {
    f.clock(1_800_000_900); return { id: ACTOR, displayName: "Synthetic actor" };
  } }, { httpsOrigins: [ORIGIN] }, () => 1_800_000_900);
  // An initial expiry before IO must fail without invoking its reader.
  expect((await slow.resume(request(undefined, { cookie: `${COOKIE}=${f.token}` }), {})).status).toBe(401);
  let clock = 1_800_000_899;
  const late = new BrowserSessionHttpApi(f.tokens, { async readActiveActor() {
    clock = 1_800_000_900; return { id: ACTOR, displayName: "Synthetic actor" };
  } }, { httpsOrigins: [ORIGIN] }, () => clock);
  f.clock(1_800_000_899);
  expect((await late.resume(request(undefined, { cookie: `${COOKIE}=${f.token}` }), {})).status).toBe(401);
});

test("actual server configuration requires explicit origins and forbids development origin on non-loopback listeners", async () => {
  const source = await Bun.file(new URL("../src/server.ts", import.meta.url)).text();
  const start = source.indexOf("function browserSessionPolicy():");
  const end = source.indexOf("function localReviewCredentials()", start);
  const code = new Bun.Transpiler({ loader: "ts" }).transformSync(source.slice(start, end));
  const make = new Function("Bun", "workbenchEnabled", "runtimeHostname", code + "\nreturn browserSessionPolicy();");
  expect(make({ env: {} }, true, () => "127.0.0.1")).toBeUndefined();
  expect(make({ env: { YELLOW_BROWSER_SESSION_HTTPS_ORIGINS: ORIGIN } }, true, () => "127.0.0.1"))
    .toEqual({ httpsOrigins: [ORIGIN], allowLoopbackTlsProxy: false });
  expect(() => make({ env: { YELLOW_BROWSER_SESSION_ALLOW_LOOPBACK_TLS_PROXY: "1" } }, true, () => "127.0.0.1")).toThrow();
  expect(() => make({ env: { YELLOW_BROWSER_SESSION_HTTPS_ORIGINS: ORIGIN, YELLOW_BROWSER_SESSION_ALLOW_LOOPBACK_TLS_PROXY: "yes" } }, true, () => "127.0.0.1")).toThrow();
  for (const enabled of [true, false]) expect(() => make({ env: { YELLOW_BROWSER_SESSION_LOCALHOST_ORIGIN: "http://localhost:3184" } }, enabled, () => "0.0.0.0")).toThrow();
});

test("actual operations route selects same React asset document as Today, preserving explicit legacy option", async () => {
  const f = await fixture();
  const login = new LocalLoginService({ async reserve(): Promise<never> { throw new Error("unused"); } }, f.tokens);
  const operatorApi = new OperatorHttpApi(login, new AvailabilityService());
  const app = createApp({ operatorApi, publicOperatorSurface: "yellow-next" });
  const property = "6081b544-22a1-534f-a86d-bb1ae0519e14";
  const today = await app.handle(new Request(`${ORIGIN}/p/${property}/today`));
  const operations = await app.handle(new Request(`${ORIGIN}/p/${property}/operations`));
  expect(operations.status).toBe(200); expect(today.status).toBe(200);
  const html = await operations.text(); expect(html).toBe(await today.text()); expect(html).toContain('/yellow-next/assets/');
  const legacy = await createApp({ operatorApi, publicOperatorSurface: "legacy" }).handle(new Request(`${ORIGIN}/p/${property}/operations`));
  expect(legacy.status).toBe(200); expect(await legacy.text()).not.toBe(html);
});
