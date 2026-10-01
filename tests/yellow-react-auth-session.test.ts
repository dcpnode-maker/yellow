import { afterEach, expect, test } from "bun:test";
import { createAuthSession, grantedPropertyRoute, requestedGrantedRoute, SignInRequiredError, type AuthSession } from "../frontend/yellow/src/auth-session";

const ACTOR = "b2836978-73fe-58f9-b808-8b58cceac1c4";
const TENANT = "6d9b7ce2-2d14-5576-b8c3-80f06501a603";
const LOCANDA = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const HARRINGTON = "01e4e102-c54f-5205-9542-d84d103084f8";
const OTHER = "00000000-0000-0000-0000-000000000123";
const properties = [{ id: LOCANDA, name: "Locanda", timezone: "Asia/Riyadh" },
  { id: HARRINGTON, name: "Harrington London", timezone: "Europe/London" }];
const credentials = { tenant: "test-tenant", email: "fixture@example.invalid", password: "test-only" };
function token(actor = ACTOR, tenant = TENANT, signature = "test") { return `header.${btoa(JSON.stringify({ sub: actor, tid: tenant }))}.${signature}`; }
function login(actor = ACTOR, tenant = TENANT, signature = "test", expiresInSeconds = 900) {
  return { accessToken: token(actor, tenant, signature), tokenType: "Bearer", expiresInSeconds, user: { id: actor, displayName: "Preview operator" } };
}
function response(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status }); }
const stores: AuthSession[] = [];
function store(options: Parameters<typeof createAuthSession>[0] = {}) { const value = createAuthSession(options); stores.push(value); return value; }
afterEach(() => { for (const value of stores.splice(0)) value.dispose(); });

test("normal login uses exact credential contract and verifies server grants before exposing an in-memory token", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const auth = store({ fetch: async (url, init) => { calls.push({ url, init }); return response(url.endsWith("local:login") ? login() : { properties }); } });
  await expect(auth.session()).rejects.toBeInstanceOf(SignInRequiredError);
  expect(calls).toHaveLength(0);
  const accepted = await auth.signIn(credentials);
  expect(calls.map(call => call.url)).toEqual(["/api/v1/auth/local:login", "/api/v1/me/properties"]);
  expect(calls[0]?.init?.method).toBe("POST");
  expect(JSON.parse(String(calls[0]?.init?.body))).toEqual(credentials);
  expect(new Headers(calls[0]?.init?.headers).has("authorization")).toBe(false);
  expect(new Headers(calls[1]?.init?.headers).get("authorization")).toBe(`Bearer ${token()}`);
  expect(calls[1]?.init?.cache).toBe("no-store");
  expect(accepted.principal).toEqual({ actorId: ACTOR, tenantId: TENANT, displayName: "Preview operator" });
  expect(accepted.properties).toEqual(properties);
  expect(await auth.session()).toBe(token());
  expect(JSON.stringify(auth.getSnapshot())).not.toContain(token());
  expect(JSON.stringify(auth.getSnapshot())).not.toContain(credentials.password);
});

test("invalid, limited, unavailable and network failures leave sign-in unset and never invoke demo fallback or retry", async () => {
  for (const status of [401, 429, 503]) {
    const calls: string[] = [];
    const auth = store({ fetch: async url => { calls.push(url); return response({}, status); } });
    await expect(auth.signIn(credentials)).rejects.toMatchObject({ status });
    await expect(auth.session()).rejects.toBeInstanceOf(SignInRequiredError);
    expect(calls).toEqual(["/api/v1/auth/local:login"]);
  }
  let calls = 0;
  const offline = store({ fetch: async () => { ++calls; throw new Error("offline"); } });
  await expect(offline.signIn(credentials)).rejects.toThrow("could not reach");
  expect(calls).toBe(1);
  expect(offline.getSnapshot().status).toBe("anonymous");
});

test("malformed identity or expiry never exposes a candidate token or performs property reads", async () => {
  for (const malformed of [ { ...login(), tokenType: "Other" }, { ...login(), expiresInSeconds: 0 },
    { ...login(), expiresInSeconds: 901 }, { ...login(), accessToken: "invalid" },
    { ...login(), accessToken: token(OTHER) }, { ...login(), accessToken: token(ACTOR, "not-a-tenant") } ]) {
    const calls: string[] = [];
    const auth = store({ fetch: async url => { calls.push(url); return response(malformed); } });
    await expect(auth.signIn(credentials)).rejects.toThrow("could not be verified");
    expect(calls).toEqual(["/api/v1/auth/local:login"]);
    expect(auth.getSnapshot().status).toBe("anonymous");
  }
});

test("empty, malformed, duplicate or denied grants cannot mount an authenticated workspace", async () => {
  for (const grants of [[], [{ ...properties[0], id: "invalid" }], [properties[0], properties[0]], [{ ...properties[0], name: "" }]]) {
    const auth = store({ fetch: async url => response(url.endsWith("local:login") ? login() : { properties: grants }) });
    await expect(auth.signIn(credentials)).rejects.toThrow();
    expect(auth.getSnapshot().status).toBe("anonymous");
    await expect(auth.session()).rejects.toBeInstanceOf(SignInRequiredError);
  }
  const denied = store({ fetch: async url => url.endsWith("local:login") ? response(login()) : response({}, 403) });
  await expect(denied.signIn(credentials)).rejects.toMatchObject({ status: 403 });
  expect(denied.getSnapshot().status).toBe("anonymous");
});

test("normal granted property reads are not filtered to fixed showcase identifiers; only granted routes are accepted", async () => {
  const actual = [...properties, { id: OTHER, name: "Additional granted property", timezone: "UTC" }];
  const auth = store({ fetch: async url => response(url.endsWith("local:login") ? login() : { properties: actual }) });
  await auth.signIn(credentials);
  expect(await auth.grantedProperties()).toEqual(actual);
  expect(requestedGrantedRoute(`/p/${LOCANDA}/res/reservation`, "?workspace=finance", actual)).toBe(`/p/${LOCANDA}/res/reservation?workspace=finance`);
  expect(requestedGrantedRoute("/", "", actual)).toBeNull();
  expect(requestedGrantedRoute("/p/00000000-0000-0000-0000-000000000999/today", "", actual)).toBeNull();
  expect(grantedPropertyRoute(HARRINGTON, actual)).toBe(`/p/${HARRINGTON}/today`);
  expect(() => grantedPropertyRoute("../../outside", actual)).toThrow("Choose a granted property");
});

test("expiry retains principal and recovery context while preventing token use until same-principal renewal", async () => {
  let clock = 1000;
  let actor = ACTOR; let tenant = TENANT; let allowed = properties;
  const auth = store({ now: () => clock, fetch: async url => response(url.endsWith("local:login") ? login(actor, tenant) : { properties: allowed }) });
  let notifications = 0;
  const unsubscribe = auth.subscribe(() => { ++notifications; });
  await auth.signIn(credentials);
  const original = auth.getSnapshot();
  clock += 900000;
  await expect(auth.session()).rejects.toBeInstanceOf(SignInRequiredError);
  expect(auth.getSnapshot().status).toBe("expired");
  expect(auth.getSnapshot().principal).toBe(original.principal);
  expect(auth.getSnapshot().properties).toBe(original.properties);
  expect(notifications).toBe(2);
  actor = OTHER;
  await expect(auth.signIn(credentials, LOCANDA)).rejects.toThrow("same account");
  actor = ACTOR; tenant = OTHER;
  await expect(auth.signIn(credentials, LOCANDA)).rejects.toThrow("same account");
  tenant = TENANT; allowed = [properties[1]!];
  await expect(auth.signIn(credentials, LOCANDA)).rejects.toThrow("no longer granted");
  expect(auth.getSnapshot().status).toBe("expired");
  allowed = properties;
  await auth.signIn(credentials, LOCANDA);
  expect(await auth.session()).toBe(token());
  expect(auth.getSnapshot().principal).toEqual(original.principal);
  expect(notifications).toBe(3);
  unsubscribe();
});

test("a late sign-in response cannot replace the accepted newer token", async () => {
  let resolveOld!: (value: Response) => void;
  const oldResponse = new Promise<Response>(resolve => { resolveOld = resolve; });
  let attempts = 0;
  let propertyReads = 0;
  const auth = store({ fetch: async url => {
    if (url.endsWith("local:login")) return ++attempts === 1 ? oldResponse : response(login(ACTOR, TENANT, "new"));
    ++propertyReads; return response({ properties });
  } });
  const old = auth.signIn(credentials);
  await auth.signIn(credentials);
  resolveOld(response(login(ACTOR, TENANT, "old")));
  await expect(old).rejects.toThrow("newer sign-in attempt");
  expect(await auth.session()).toBe(token(ACTOR, TENANT, "new"));
  expect(propertyReads).toBe(1);
});

test("property verification cannot commit a token that expired while the grant request was pending", async () => {
  let clock = 0;
  const auth = store({ now: () => clock, fetch: async url => {
    if (url.endsWith("local:login")) return response(login(ACTOR, TENANT, "short", 1));
    clock = 1001; return response({ properties });
  } });
  await expect(auth.signIn(credentials)).rejects.toThrow("expired before property access");
  expect(auth.getSnapshot().status).toBe("anonymous");
});


test("preview auto-login is opt-in, resume-first, and uses the same verified bearer and live grants", async () => {
  for (const resumeStatus of [401, 404]) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const auth = store({ automaticPreviewLogin: true, fetch: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("browser/resume")) return response({}, resumeStatus);
      if (url.endsWith("preview:enter")) return response(login());
      return response({ properties });
    } });
    const accepted = await auth.bootstrap(LOCANDA);
    expect(accepted.status).toBe("authenticated");
    expect(accepted.properties).toEqual(properties);
    expect(calls.map(call => call.url)).toEqual(["/api/v1/auth/browser/resume", "/api/v1/auth/preview:enter", "/api/v1/me/properties"]);
    for (const call of calls.slice(0, 2)) {
      expect(call.init?.method).toBe("POST");
      expect(call.init?.credentials).toBe("same-origin");
      expect(call.init?.cache).toBe("no-store");
      expect(call.init?.body).toBe("{}");
      expect(new Headers(call.init?.headers).get("x-yellow-browser-session")).toBe("v1");
      expect(new Headers(call.init?.headers).get("content-type")).toBe("application/json");
      expect(new Headers(call.init?.headers).has("authorization")).toBe(false);
    }
    expect(new Headers(calls[2]?.init?.headers).get("authorization")).toBe(`Bearer ${token()}`);
    expect(JSON.stringify(auth.getSnapshot())).not.toContain(token());
  }
});

test("preview fallback stays off by default and runs only for initial resume 401 or 404", async () => {
  for (const status of [401, 404, 429, 503]) {
    const calls: string[] = [];
    const auth = store({ automaticPreviewLogin: true, fetch: async url => {
      calls.push(url);
      return response(url.endsWith("browser/resume") ? {} : login(), status);
    } });
    if (status === 401 || status === 404) {
      await expect(auth.bootstrap()).rejects.toMatchObject({ status });
      expect(calls).toEqual(["/api/v1/auth/browser/resume", "/api/v1/auth/preview:enter"]);
    } else {
      await expect(auth.bootstrap()).rejects.toMatchObject({ status });
      expect(calls).toEqual(["/api/v1/auth/browser/resume"]);
    }
  }
  const calls: string[] = [];
  const ordinary = store({ fetch: async url => { calls.push(url); return response({}, 401); } });
  expect((await ordinary.bootstrap()).status).toBe("anonymous");
  expect(calls).toEqual(["/api/v1/auth/browser/resume"]);
});

test("successful cookie resume and explicit sign-out never auto-enter the preview account", async () => {
  const calls: string[] = [];
  const auth = store({ automaticPreviewLogin: true, fetch: async url => {
    calls.push(url);
    if (url.endsWith("browser/resume")) return response(login());
    if (url.endsWith("me/properties")) return response({ properties });
    return new Response(null, { status: 204 });
  } });
  expect((await auth.bootstrap()).status).toBe("authenticated");
  expect(calls).toEqual(["/api/v1/auth/browser/resume", "/api/v1/me/properties"]);
  await auth.logout();
  expect((await auth.bootstrap()).status).toBe("expired");
  expect(calls).toEqual(["/api/v1/auth/browser/resume", "/api/v1/me/properties", "/api/v1/auth/browser/logout"]);
});


test("sign-out waits for an in-flight preview login before clearing its cookie", async () => {
  let resolvePreview!: (value: Response) => void;
  let previewStarted!: () => void;
  const started = new Promise<void>(resolve => { previewStarted = resolve; });
  const calls: string[] = [];
  const auth = store({ automaticPreviewLogin: true, fetch: async url => {
    calls.push(url);
    if (url.endsWith("browser/resume")) return response({}, 401);
    if (url.endsWith("preview:enter")) {
      previewStarted();
      return new Promise<Response>(resolve => { resolvePreview = resolve; });
    }
    if (url.endsWith("browser/logout")) return new Response(null, { status: 204 });
    throw new Error("unexpected request");
  } });
  const bootstrap = auth.bootstrap();
  await started;
  const logout = auth.logout();
  await Promise.resolve();
  expect(calls).toEqual(["/api/v1/auth/browser/resume", "/api/v1/auth/preview:enter"]);
  resolvePreview(response(login()));
  await expect(bootstrap).rejects.toThrow("newer authentication request");
  await logout;
  expect(calls).toEqual(["/api/v1/auth/browser/resume", "/api/v1/auth/preview:enter", "/api/v1/auth/browser/logout"]);
  expect(calls).not.toContain("/api/v1/me/properties");
});
