import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import {
  BearerTenantResolver,
  hashLocalPassword,
  Hs256TokenSigner,
  LocalLoginGuard,
  LocalLoginService,
} from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import { OperatorHttpApi } from "../src/http/operator";
import { Database } from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_OPERATOR_WORKBENCH_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_WORKBENCH === "1";
const SECRET = "yellow-order-042-test-token-secret-exactly-long-enough";
const ISSUED_AT = 1_800_000_000;
const TENANT_A = "00000000-0000-0000-0000-000000004210";
const TENANT_B = "00000000-0000-0000-0000-000000004211";
const BRAND_A = "00000000-0000-0000-0000-000000004220";
const PROPERTY_A = "00000000-0000-0000-0000-000000004221";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000004222";
const PROPERTY_B = "00000000-0000-0000-0000-000000004223";
const USER_ANCESTOR = "00000000-0000-0000-0000-000000004230";
const USER_EXACT = "00000000-0000-0000-0000-000000004231";
const USER_NO_SCOPE = "00000000-0000-0000-0000-000000004232";
const USER_OTHER_PROPERTY = "00000000-0000-0000-0000-000000004233";
const USER_INACTIVE = "00000000-0000-0000-0000-000000004234";
const USER_LEGACY = "00000000-0000-0000-0000-000000004235";
const ROLE_READ = "00000000-0000-0000-0000-000000004240";
const ROLE_EMPTY = "00000000-0000-0000-0000-000000004241";
const UNIT_TYPE = "00000000-0000-0000-0000-000000004250";
const SPACE = "00000000-0000-0000-0000-000000004251";
const SELLABLE = "00000000-0000-0000-0000-000000004252";
const BLOCK = "00000000-0000-0000-0000-000000004253";
const PERIOD = {
  from: "2027-08-10T12:00:00.000Z",
  to: "2027-08-12T12:00:00.000Z",
};

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_OPERATOR_WORKBENCH_URL is required by the Order 042 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let database: Database;
let now = ISSUED_AT;
let loginGuardNow = 0;
let tokens: Hs256TokenSigner;
let app: ReturnType<typeof createApp>;

function request(path: string, init: RequestInit = {}) {
  return app.handle(new Request(`http://yellow.test${path}`, init));
}

function jsonHeaders(token?: string): HeadersInit {
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function login(
  email = "ancestor@yellow.test",
  password = "correct horse battery staple",
  tenant = "order042-a",
) {
  loginGuardNow += 900_000;
  return request("/api/v1/auth/local:login", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ tenant, email, password }),
  });
}

async function accessToken(email = "ancestor@yellow.test"): Promise<string> {
  const response = await login(email);
  const body = await response.json() as { accessToken?: string };
  if (!body.accessToken) throw new Error(`Login did not return a token for ${email}`);
  return body.accessToken;
}

async function cleanFixtures() {
  await admin`DELETE FROM restriction WHERE scope_node IN (${PROPERTY_A}::uuid, ${PROPERTY_A2}::uuid)`;
  await admin`DELETE FROM ooo_oos WHERE id = ${BLOCK}::uuid`;
  await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id = ${SELLABLE}::uuid`;
  await admin`DELETE FROM sellable_unit WHERE id = ${SELLABLE}::uuid`;
  await admin`DELETE FROM space WHERE id = ${SPACE}::uuid`;
  await admin`DELETE FROM unit_type WHERE id = ${UNIT_TYPE}::uuid`;
  await admin`DELETE FROM user_role WHERE user_id IN (${USER_ANCESTOR}::uuid, ${USER_EXACT}::uuid, ${USER_NO_SCOPE}::uuid, ${USER_OTHER_PROPERTY}::uuid, ${USER_INACTIVE}::uuid, ${USER_LEGACY}::uuid)`;
  await admin`DELETE FROM role_permission WHERE role_id IN (${ROLE_READ}::uuid, ${ROLE_EMPTY}::uuid)`;
  await admin`DELETE FROM role WHERE id IN (${ROLE_READ}::uuid, ${ROLE_EMPTY}::uuid)`;
  await admin`DELETE FROM app_user WHERE id IN (${USER_ANCESTOR}::uuid, ${USER_EXACT}::uuid, ${USER_NO_SCOPE}::uuid, ${USER_OTHER_PROPERTY}::uuid, ${USER_INACTIVE}::uuid, ${USER_LEGACY}::uuid)`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A}::uuid, ${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid, ${BRAND_A}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM permission WHERE code = 'inventory.availability:read'`;
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 4 });
  loginPool = new SQL(DATABASE_URL, { max: 4 });
  database = Database.connect(DATABASE_URL, { maxConnections: 8 });
  tokens = new Hs256TokenSigner(SECRET, { now: () => now });
  app = createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      new LocalLoginService(loginPool, tokens, new LocalLoginGuard({ now: () => loginGuardNow })),
      new AvailabilityService(),
    ),
  });

  await cleanFixtures();
  const auth = await hashLocalPassword("correct horse battery staple");
  const authJson = JSON.stringify(auth);
  await admin`
    INSERT INTO permission (code, description)
    VALUES ('inventory.availability:read', 'Read tenant-scoped truth availability')
  `;
  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order042-a', 'Order 042 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order042-b', 'Order 042 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${BRAND_A}::uuid, ${TENANT_A}::uuid, 'order042_a', 'brand', 'Order 042 Brand', NULL, NULL),
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order042_a.one', 'property', 'Order 042 One', 'UTC', 'USD'),
      (${PROPERTY_A2}::uuid, ${TENANT_A}::uuid, 'order042_a.two', 'property', 'Order 042 Two', 'Asia/Kolkata', 'INR'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order042_b.one', 'property', 'Order 042 Foreign', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO app_user (id, tenant_id, email, display_name, auth, status)
    VALUES
      (${USER_ANCESTOR}::uuid, ${TENANT_A}::uuid, 'ancestor@yellow.test', 'Ancestor Operator', ${authJson}::text::jsonb, 'active'),
      (${USER_EXACT}::uuid, ${TENANT_A}::uuid, 'exact@yellow.test', 'Exact Operator', ${authJson}::text::jsonb, 'active'),
      (${USER_NO_SCOPE}::uuid, ${TENANT_A}::uuid, 'noscope@yellow.test', 'No Scope', ${authJson}::text::jsonb, 'active'),
      (${USER_OTHER_PROPERTY}::uuid, ${TENANT_A}::uuid, 'other@yellow.test', 'Other Property', ${authJson}::text::jsonb, 'active'),
      (${USER_INACTIVE}::uuid, ${TENANT_A}::uuid, 'inactive@yellow.test', 'Inactive', ${authJson}::text::jsonb, 'disabled'),
      (${USER_LEGACY}::uuid, ${TENANT_A}::uuid, 'legacy@yellow.test', 'Legacy', '{"provider":"local","hash":"$2b$12$legacy"}'::jsonb, 'active')
  `;
  await admin`
    INSERT INTO role (id, tenant_id, name)
    VALUES
      (${ROLE_READ}::uuid, ${TENANT_A}::uuid, 'Availability Reader'),
      (${ROLE_EMPTY}::uuid, ${TENANT_A}::uuid, 'Empty Role')
  `;
  await admin`
    INSERT INTO role_permission (role_id, permission_code)
    VALUES (${ROLE_READ}::uuid, 'inventory.availability:read')
  `;
  await admin`
    INSERT INTO user_role (tenant_id, user_id, role_id, scope_node)
    VALUES
      (${TENANT_A}::uuid, ${USER_ANCESTOR}::uuid, ${ROLE_READ}::uuid, ${BRAND_A}::uuid),
      (${TENANT_A}::uuid, ${USER_EXACT}::uuid, ${ROLE_READ}::uuid, ${PROPERTY_A}::uuid),
      (${TENANT_A}::uuid, ${USER_NO_SCOPE}::uuid, ${ROLE_EMPTY}::uuid, ${PROPERTY_A}::uuid),
      (${TENANT_A}::uuid, ${USER_OTHER_PROPERTY}::uuid, ${ROLE_READ}::uuid, ${PROPERTY_A2}::uuid),
      (${TENANT_A}::uuid, ${USER_OTHER_PROPERTY}::uuid, ${ROLE_EMPTY}::uuid, ${PROPERTY_A}::uuid),
      (${TENANT_A}::uuid, ${USER_LEGACY}::uuid, ${ROLE_READ}::uuid, ${PROPERTY_A}::uuid)
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, max_occupancy, sort_order)
    VALUES (${UNIT_TYPE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O42', 'Order 042 Room', 'hotel', 2, 420)
  `;
  await admin`
    INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity)
    VALUES (${SPACE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O42-1', 'hotel', 1)
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name)
    VALUES (${SELLABLE}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE}::uuid, 'Order 042 Room')
  `;
  await admin`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    VALUES (${TENANT_A}::uuid, ${SELLABLE}::uuid, ${SPACE}::uuid, 'exclusive')
  `;
  await admin`
    INSERT INTO restriction (tenant_id, scope_node, kind, stay_dates, source)
    VALUES (${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'closed', daterange('2027-08-10', '2027-08-13', '[)'), 'manual')
  `;
  await admin`
    INSERT INTO ooo_oos (id, tenant_id, space_id, kind, period, reason)
    VALUES (${BLOCK}::uuid, ${TENANT_A}::uuid, ${SPACE}::uuid, 'oos', tstzrange(${PERIOD.from}::timestamptz, ${PERIOD.to}::timestamptz, '[)'), 'Air conditioning inspection')
  `;
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  await cleanFixtures();
  await loginPool.close();
  await database.close();
  await admin.close();
});

databaseDescribe("Order 042 authenticated operator workbench", () => {
  test("P1: valid database identity issues exact no-store bearer token", async () => {
    const response = await login(" ANCESTOR@YELLOW.TEST ", "correct horse battery staple", " ORDER042-A ");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
    const body = await response.json() as { accessToken: string; tokenType: string; expiresInSeconds: number; user: unknown };
    expect(body.tokenType).toBe("Bearer");
    expect(body.expiresInSeconds).toBe(900);
    expect(body.user).toEqual({ id: USER_ANCESTOR, displayName: "Ancestor Operator" });
    expect(await tokens.verify(body.accessToken)).toMatchObject({
      sub: USER_ANCESTOR,
      tid: TENANT_A,
      scp: "inventory.availability:read",
    });
  });

  test("P2: every credential and body failure is the same generic rejection", async () => {
    const attempts = [
      await login("missing@yellow.test"),
      await login("ancestor@yellow.test", "wrong"),
      await login("inactive@yellow.test"),
      await login("legacy@yellow.test"),
      await login("ancestor@yellow.test", "correct horse battery staple", "unknown-tenant"),
      await request("/api/v1/auth/local:login", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ tenant: "order042-a", email: "ancestor@yellow.test", password: "x", extra: true }) }),
    ];
    for (const response of attempts) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(expect.objectContaining({
        type: "auth/invalid_credentials",
        title: "Authentication failed",
        status: 401,
        detail: "Invalid credentials",
      }));
    }
  });

  test("P3: bearer, scope, and property authorization fail before availability", async () => {
    for (const unauthorized of [
      await request(`/api/v1/properties/${PROPERTY_A}/availability:search`, {
        method: "POST", headers: jsonHeaders(), body: JSON.stringify(PERIOD),
      }),
      await request(`/api/v1/properties/${PROPERTY_A}/availability:search`, {
        method: "POST", headers: jsonHeaders("not-a-token"), body: JSON.stringify(PERIOD),
      }),
    ]) {
      expect(unauthorized.status).toBe(401);
      expect(unauthorized.headers.get("cache-control")).toBe("no-store");
      expect(unauthorized.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
      expect(await unauthorized.json()).toEqual(expect.objectContaining({ type: "auth/unauthorized" }));
    }

    const noScope = await accessToken("noscope@yellow.test");
    expect((await request(`/api/v1/properties/${PROPERTY_A}/availability:search`, {
      method: "POST", headers: jsonHeaders(noScope), body: JSON.stringify(PERIOD),
    })).status).toBe(403);

    const otherProperty = await accessToken("other@yellow.test");
    const otherProperties = await request("/api/v1/me/properties", { headers: jsonHeaders(otherProperty) });
    expect(otherProperties.status).toBe(200);
    expect((await otherProperties.json() as { properties: Array<{ id: string }> }).properties.map(({ id }) => id)).toEqual([
      PROPERTY_A2,
    ]);
    expect((await request(`/api/v1/properties/${PROPERTY_A}/availability:search`, {
      method: "POST", headers: jsonHeaders(otherProperty), body: JSON.stringify(PERIOD),
    })).status).toBe(403);

    const expiring = await accessToken();
    now += 961;
    const expired = await request("/api/v1/me/properties", { headers: jsonHeaders(expiring) });
    expect(expired.status).toBe(401);
    expect(expired.headers.get("cache-control")).toBe("no-store");
    expect(await expired.json()).toEqual(expect.objectContaining({ type: "auth/unauthorized" }));
    now = ISSUED_AT;
  });

  test("P4: exact and ancestor grants list properties and return real blocker evidence", async () => {
    const ancestor = await accessToken();
    const propertiesResponse = await request("/api/v1/me/properties", { headers: jsonHeaders(ancestor) });
    expect(propertiesResponse.status).toBe(200);
    expect((await propertiesResponse.json() as { properties: Array<{ id: string }> }).properties.map(({ id }) => id)).toEqual([
      PROPERTY_A,
      PROPERTY_A2,
    ]);

    const exact = await accessToken("exact@yellow.test");
    const exactProperties = await request("/api/v1/me/properties", { headers: jsonHeaders(exact) });
    expect((await exactProperties.json() as { properties: Array<{ id: string }> }).properties.map(({ id }) => id)).toEqual([PROPERTY_A]);

    const response = await request(`/api/v1/properties/${PROPERTY_A}/availability:search`, {
      method: "POST",
      headers: jsonHeaders(ancestor),
      body: JSON.stringify({ ...PERIOD, partySize: 1 }),
    });
    expect(response.status).toBe(200);
    const option = (await response.json() as { options: Array<Record<string, unknown>> }).options[0];
    expect(option).toMatchObject({
      sellableUnitId: SELLABLE,
      availableCount: 1,
      bookable: false,
      operationalBlocksApplied: [{ id: BLOCK, kind: "oos", reason: "Air conditioning inspection", blocks: true }],
    });
    expect((option?.restrictionsApplied as unknown[])).toHaveLength(1);
    expect((await request(`/api/v1/properties/${PROPERTY_B}/availability:search`, {
      method: "POST", headers: jsonHeaders(ancestor), body: JSON.stringify(PERIOD),
    })).status).toBe(403);
  });

  test("P5: service failures stay generic and a rejected connection is reusable", async () => {
    const token = await accessToken();
    await admin`UPDATE org_node SET config = '{"inventory":{"oos_sellability":"invalid"}}'::jsonb WHERE id = ${PROPERTY_A}::uuid`;
    const failed = await request(`/api/v1/properties/${PROPERTY_A}/availability:search`, {
      method: "POST", headers: jsonHeaders(token), body: JSON.stringify(PERIOD),
    });
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual(expect.objectContaining({
      type: "service/unavailable",
      detail: "Availability is temporarily unavailable",
    }));
    await admin`UPDATE org_node SET config = '{}'::jsonb WHERE id = ${PROPERTY_A}::uuid`;
    expect((await request("/api/v1/me/properties", { headers: jsonHeaders(token) })).status).toBe(200);

    const failingLogin = new OperatorHttpApi(new LocalLoginService({
      async reserve(): Promise<never> { throw new Error("database unavailable"); },
    }, tokens));
    const failingApp = createApp({ operatorApi: failingLogin });
    const unavailable = await failingApp.handle(new Request("http://yellow.test/api/v1/auth/local:login", {
      method: "POST", headers: jsonHeaders(), body: JSON.stringify({ tenant: "order042-a", email: "ancestor@yellow.test", password: "password" }),
    }));
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual(expect.objectContaining({ type: "service/unavailable" }));

    const secret = "postgresql://yellow:secret@db.internal/yellow exploded";
    const transactionFailure = createApp({
      database: new Database({ async reserve(): Promise<never> { throw new Error(secret); } }),
      tenantResolver: { async resolve() { return { tenantId: TENANT_A, actorId: USER_ANCESTOR, scopes: ["inventory.availability:read"] }; } },
      operatorApi: failingLogin,
    });
    const sanitized = await transactionFailure.handle(new Request("http://yellow.test/api/v1/me/properties"));
    expect(sanitized.status).toBe(503);
    expect(sanitized.headers.get("cache-control")).toBe("no-store");
    expect(sanitized.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(await sanitized.text()).not.toContain(secret);
  });

  test("P6: workbench assets are same-origin, external, and contain no token persistence", async () => {
    const htmlResponse = await request("/");
    const cssResponse = await request("/assets/operator.css");
    const jsResponse = await request("/assets/operator.js");
    expect(htmlResponse.headers.get("content-type")).toContain("text/html");
    expect(cssResponse.headers.get("content-type")).toContain("text/css");
    expect(jsResponse.headers.get("content-type")).toContain("text/javascript");
    for (const response of [htmlResponse, cssResponse, jsResponse]) {
      expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
    }
    const html = await htmlResponse.text();
    const css = await cssResponse.text();
    const js = await jsResponse.text();
    expect(html).not.toMatch(/<style\b|style\s*=|<script(?![^>]*\bsrc=)/i);
    expect(`${html}\n${css}\n${js}`).not.toMatch(/https?:\/\//i);
    expect(js).not.toMatch(/localStorage|sessionStorage|document\.cookie|console\.(?:log|debug|info)/);
    expect(js).toContain("let accessToken = \"\";");
    expect(js).not.toContain("fabricated");
    expect(html).toContain('id="theme-select"');
    expect(html).toContain('value="apple"');
    expect(html).toContain('value="android"');
    expect(html).toContain('id="bulk-room-form"');
    expect(html).toContain('id="bulk-room-preview"');
    expect(html).toContain('data-view="status"');
    expect(html).toContain('id="status-view"');
    expect(html).toContain("Recorded build snapshot");
    expect(html).toContain("Live service checks");
    expect(css).toContain(':root[data-theme="android"]');
    expect(css).toContain(".bulk-room-preview");
    expect(css).toContain(".status-health-grid");
    expect(js).toContain("document.documentElement.dataset.theme");
    expect(js).toContain('"rooms:bulk"');
    expect(js).toContain("loadSystemStatus");
    expect(js).not.toMatch(/setInterval|EventSource|WebSocket|api\.github|github\.com/i);
    expect(js).not.toMatch(/fetch\([^)]*theme|\/api\/[^\s"'`]*theme/);
    const server = await Bun.file(new URL("../src/server.ts", import.meta.url)).text();
    expect(server).toContain('return requested ?? "127.0.0.1"');
    expect(server).toContain('YELLOW_OPERATOR_ALLOW_NON_LOOPBACK === "1"');
    expect(server).toContain("const maxRequestBodySize = 16 * 1024;");
    expect(server).toContain("listen({ hostname: runtimeHostname(), port, maxRequestBodySize })");
  });

  test("P7: disabled application remains exact health-only and database-free", async () => {
    let reserves = 0;
    const disabled = createApp({
      database: new Database({
        async reserve(): Promise<never> { reserves += 1; throw new Error("must not reserve"); },
      }),
    });
    const health = await disabled.handle(new Request("http://yellow.test/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    expect((await disabled.handle(new Request("http://yellow.test/"))).status).toBe(404);
    expect((await disabled.handle(new Request("http://yellow.test/api/v1/me/properties"))).status).toBe(404);
    expect(reserves).toBe(0);
  });

  test("Order 117 P4: real identities are uniformly throttled and recover without changing token issuance", async () => {
    let limitedNow = 0;
    const guardedLogin = new LocalLoginService(
      loginPool,
      tokens,
      new LocalLoginGuard({ now: () => limitedNow }),
    );
    const guardedApp = createApp({
      database,
      tenantResolver: new BearerTenantResolver(tokens),
      operatorApi: new OperatorHttpApi(guardedLogin, new AvailabilityService()),
    });
    const attempt = (email: string, password: string, headers: HeadersInit = {}) => guardedApp.handle(new Request(
      "http://yellow.test/api/v1/auth/local:login",
      {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ tenant: "order042-a", email, password }),
      },
    ));

    const first = await attempt("ancestor@yellow.test", "wrong");
    expect(first.status).toBe(401);
    limitedNow = 1_000;
    expect((await attempt("ancestor@yellow.test", "wrong")).status).toBe(401);
    limitedNow = 3_000;
    expect((await attempt("ancestor@yellow.test", "wrong")).status).toBe(401);
    limitedNow = 7_000;
    const limited = await attempt("ancestor@yellow.test", "correct horse battery staple", {
      forwarded: "for=198.51.100.30",
      "x-forwarded-for": "198.51.100.31",
      "x-real-ip": "198.51.100.32",
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("cache-control")).toBe("no-store");
    expect(limited.headers.get("retry-after")).toBe("106");
    expect(await limited.json()).toEqual(expect.objectContaining({
      type: "auth/temporarily_limited",
      title: "Authentication temporarily limited",
      status: 429,
      detail: "Try again later",
    }));

    limitedNow = 112_500;
    const recovered = await attempt("ancestor@yellow.test", "correct horse battery staple");
    expect(recovered.status).toBe(200);
    expect(recovered.headers.get("cache-control")).toBe("no-store");
    const recoveredBody = await recovered.json() as { accessToken: string; expiresInSeconds: number };
    expect(recoveredBody.expiresInSeconds).toBe(900);
    expect(await tokens.verify(recoveredBody.accessToken)).toMatchObject({
      sub: USER_ANCESTOR,
      tid: TENANT_A,
      scp: "inventory.availability:read",
    });

    const freshWrong = new LocalLoginService(loginPool, tokens, new LocalLoginGuard({ now: () => 0 }));
    const freshMissing = new LocalLoginService(loginPool, tokens, new LocalLoginGuard({ now: () => 0 }));
    const wrongResponse = await createApp({ operatorApi: new OperatorHttpApi(freshWrong) }).handle(new Request(
      "http://yellow.test/api/v1/auth/local:login",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenant: "order042-a", email: "ancestor@yellow.test", password: "wrong" }) },
    ));
    const missingResponse = await createApp({ operatorApi: new OperatorHttpApi(freshMissing) }).handle(new Request(
      "http://yellow.test/api/v1/auth/local:login",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenant: "order042-a", email: "missing@yellow.test", password: "wrong" }) },
    ));
    const uniform = async (response: Response) => {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const body = await response.json() as Record<string, unknown>;
      const { correlation_id: _correlation, ...problem } = body;
      return problem;
    };
    expect(await uniform(wrongResponse)).toEqual(await uniform(missingResponse));
  });
});
