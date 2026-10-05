import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, PortfolioReadService, type LocalLoginService,
  type PortfolioPage } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import { Database } from "../src/kernel";

const DEPLOY_URL = process.env.YELLOW_PORTFOLIO_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_PORTFOLIO_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_PORTFOLIO_DATABASE === "1";
if (REQUIRED && (!DEPLOY_URL || !RUNTIME_URL)) throw new Error("Portfolio proof requires paired deploy/runtime URLs");
const dbDescribe = REQUIRED ? describe.serial : describe.skip;
const id = (n: number) => `71900000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T = id(1), FOREIGN = id(2), ACTOR = id(3), PROPERTY_ACTOR = id(4), DEPARTMENT = id(5), EMPTY_ACTOR = id(6);
const ROLE = id(7), OUTLET_ACTOR = id(8), READ = "inventory.availability:read";
const GROUP = id(10), EAST = id(11), WEST = id(12), HOTEL = id(13), SIBLING = id(14), OTHER = id(15), OUTLET = id(16), EMPTY = id(17);
const FOREIGN_SCOPE = id(20), FOREIGN_HOTEL = id(21), LARGE = id(30), BRAND = id(31), BRAND_HOTEL = id(32), LARGE_COUNT = 1200;
const DEMO_ONE = "6081b544-22a1-534f-a86d-bb1ae0519e14", DEMO_TWO = "01e4e102-c54f-5205-9542-d84d103084f8";
const secret = "portfolio-fixture-signing-key-synthetic-not-production";
let now = Math.floor(Date.now() / 1000);
const signer = new Hs256TokenSigner(secret, { now: () => now });
let deploy: SQL | undefined, database: Database | undefined, app: ReturnType<typeof createApp> | undefined;
let mainToken = "", originalDemo: string | undefined;
let createdPermission = false;

async function clean() {
  if (!deploy) return;
  await deploy`DELETE FROM user_role WHERE tenant_id IN (${T}::uuid,${FOREIGN}::uuid)`;
  await deploy`DELETE FROM role_permission WHERE role_id IN (SELECT id FROM role WHERE tenant_id IN (${T}::uuid,${FOREIGN}::uuid))`;
  for (const table of ["role", "app_user", "org_node"]) await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [T, FOREIGN]);
  await deploy`DELETE FROM tenant WHERE id IN (${T}::uuid,${FOREIGN}::uuid)`;
  if (createdPermission) {
    await deploy`DELETE FROM permission WHERE code=${READ}`;
    createdPermission = false;
  }
}
async function token(actor = ACTOR, tenant = T, scopes: readonly string[] = [READ]) {
  return signer.issue({ userId: actor, tenantId: tenant, scopes });
}
async function request(query = "", bearer = mainToken) {
  return app!.handle(new Request(`http://yellow.test/api/v1/me/portfolio${query ? `?${query}` : ""}`, {
    headers: { authorization: `Bearer ${bearer}` },
  }));
}
async function page(query = "", bearer = mainToken): Promise<PortfolioPage> {
  const response = await request(query, bearer);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return response.json() as Promise<PortfolioPage>;
}
async function snapshot(): Promise<string> {
  const parts: unknown[] = [];
  for (const table of ["tenant", "app_user", "role", "user_role", "org_node", "fact_log", "outbox", "api_idempotency",
    "reservation", "space", "sellable_unit", "journal", "posting_line", "task"]) {
    const predicate = table === "tenant" ? "id" : "tenant_id";
    parts.push(await deploy!.unsafe(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) rows
      FROM ${table} t WHERE ${predicate} IN ($1::uuid,$2::uuid)`, [T, FOREIGN]));
  }
  parts.push(await deploy!`SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.permission_code),'[]'::jsonb) rows FROM role_permission p WHERE role_id=${ROLE}::uuid`);
  return JSON.stringify(parts);
}

beforeAll(async () => {
  if (!REQUIRED || !DEPLOY_URL || !RUNTIME_URL) return;
  originalDemo = Bun.env.YELLOW_PUBLIC_DEMO_AUTOMATIC_LOGIN;
  delete Bun.env.YELLOW_PUBLIC_DEMO_AUTOMATIC_LOGIN;
  deploy = new SQL(DEPLOY_URL, { max: 4, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 4, prepare: false });
  await clean();
  createdPermission = (await deploy`INSERT INTO permission(code,description) VALUES(${READ},'Synthetic portfolio fixture existing read permission')
    ON CONFLICT(code) DO NOTHING RETURNING code`).length === 1;
  await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${T}::uuid,'portfolio719','Portfolio fixture','shared','active'),
    (${FOREIGN}::uuid,'portfolio719-foreign','Foreign fixture','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency,config) VALUES
    (${GROUP}::uuid,${T}::uuid,'portfolio719','group','Private group',NULL,NULL,'{"private":"never-return"}'),
    (${EAST}::uuid,${T}::uuid,'portfolio719.east','region','East',NULL,NULL,'{}'),
    (${WEST}::uuid,${T}::uuid,'portfolio719.west','region','Private west',NULL,NULL,'{}'),
    (${HOTEL}::uuid,${T}::uuid,'portfolio719.east.hotel','property','Hotel','UTC','USD','{}'),
    (${SIBLING}::uuid,${T}::uuid,'portfolio719.east.sibling','property','Sibling','Asia/Kolkata','INR','{}'),
    (${OTHER}::uuid,${T}::uuid,'portfolio719.west.hotel','property','Other branch','UTC','USD','{}'),
    (${OUTLET}::uuid,${T}::uuid,'portfolio719.east.hotel.outlet','outlet','Outlet',NULL,NULL,'{}'),
    (${EMPTY}::uuid,${T}::uuid,'portfolio719.empty','region','Empty',NULL,NULL,'{}'),
    (${LARGE}::uuid,${T}::uuid,'portfolio719.large','region','Large fixture',NULL,NULL,'{}'),
    (${BRAND}::uuid,${T}::uuid,'portfolio719.brand','brand','Brand fixture',NULL,NULL,'{}'),
    (${BRAND_HOTEL}::uuid,${T}::uuid,'portfolio719.brand.hotel','property','Brand hotel','UTC','USD','{}'),
    (${FOREIGN_SCOPE}::uuid,${FOREIGN}::uuid,'portfolio719.east','region','Foreign East',NULL,NULL,'{}'),
    (${FOREIGN_HOTEL}::uuid,${FOREIGN}::uuid,'portfolio719.east.hotel','property','Foreign Hotel','UTC','USD','{}'),
    (${DEMO_ONE}::uuid,${T}::uuid,'portfolio719.east.demo_one','property','Demo One','UTC','USD','{}'),
    (${DEMO_TWO}::uuid,${T}::uuid,'portfolio719.west.demo_two','property','Demo Two','UTC','USD','{}')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency)
    SELECT ('71900000-0000-4000-8000-'||lpad((10000+i)::text,12,'0'))::uuid,${T}::uuid,
      ('portfolio719.large.p'||lpad(i::text,6,'0'))::ltree,'property','Large '||i,'UTC','USD'
    FROM generate_series(1,${LARGE_COUNT}) i`;
  for (const actor of [ACTOR, PROPERTY_ACTOR, DEPARTMENT, EMPTY_ACTOR, OUTLET_ACTOR]) {
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${actor}::uuid,${T}::uuid,${`${actor}@portfolio.test`},'Fixture actor','active')`;
  }
  await deploy`INSERT INTO role(id,tenant_id,name) VALUES(${ROLE}::uuid,${T}::uuid,'Portfolio read')`;
  await deploy`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${READ})`;
  await deploy`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES
    (${T}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${EAST}::uuid),
    (${T}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${HOTEL}::uuid),
    (${T}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${OTHER}::uuid),
    (${T}::uuid,${PROPERTY_ACTOR}::uuid,${ROLE}::uuid,${HOTEL}::uuid),
    (${T}::uuid,${OUTLET_ACTOR}::uuid,${ROLE}::uuid,${OUTLET}::uuid),
    (${T}::uuid,${EMPTY_ACTOR}::uuid,${ROLE}::uuid,${EMPTY}::uuid)`;
  app = createApp({ database, tenantResolver: new BearerTenantResolver(signer), operatorApi: new OperatorHttpApi({} as LocalLoginService) });
  mainToken = await token();
}, 60_000);
afterAll(async () => {
  if (!REQUIRED) return;
  if (originalDemo === undefined) delete Bun.env.YELLOW_PUBLIC_DEMO_AUTOMATIC_LOGIN;
  else Bun.env.YELLOW_PUBLIC_DEMO_AUTOMATIC_LOGIN = originalDemo;
  await clean();
  await database?.close();
  await deploy?.close();
}, 60_000);

dbDescribe("authorized portfolio real PostgreSQL HTTP", () => {
  test("runtime app_role and transaction-local tenant are the actual authority boundary", async () => {
    await database!.withTenantTransaction(T, async tx => {
      const rows = await tx<{ role: string; tenant: string }[]>`SELECT current_user role,current_setting('app.tenant_id',true) tenant`;
      expect(rows).toEqual([{ role: "app_role", tenant: T }]);
      const result = await new PortfolioReadService().read(tx, { tenantId: T, actorId: ACTOR, limit: 50 });
      expect(result.nodes.map(n => n.id)).toEqual([EAST, OTHER]);
    });
  });

  test("ancestor grants, independent branches and overlap deduplicate without private ancestors", async () => {
    const before = await snapshot();
    const root = await page();
    expect(root).toEqual({ scope: null, nodes: [
      { id: EAST, name: "East", kind: "region", parentId: null, authorizedPropertyCount: 3, timezone: null, currency: null },
      { id: OTHER, name: "Other branch", kind: "property", parentId: null, authorizedPropertyCount: 1, timezone: "UTC", currency: "USD" },
    ], nextCursor: null });
    const children = await page(`scopeNode=${EAST}`);
    expect(children.nodes.map(n => n.id)).toEqual([HOTEL, SIBLING, DEMO_ONE].sort());
    expect(children.nodes.every(n => n.parentId === EAST && n.authorizedPropertyCount === 1)).toBe(true);
    expect(children.scope).toEqual(root.nodes[0]!);
    const property = await page(`scopeNode=${HOTEL}`);
    expect(property.nodes).toEqual([]);
    expect(property.scope?.parentId).toBe(EAST);
    const serialized = JSON.stringify(children);
    for (const forbidden of ["Private group", "Private west", "Foreign", "private", "path", "tenantId", "config"])
      expect(serialized).not.toContain(forbidden);
    expect(await snapshot()).toBe(before);
  });

  test("property-only grants stay roots; outlet/empty grants return no containing property", async () => {
    const propertyToken = await token(PROPERTY_ACTOR);
    expect((await page("", propertyToken)).nodes.map(n => [n.id, n.parentId])).toEqual([[HOTEL, null]]);
    expect((await request(`scopeNode=${EAST}`, propertyToken)).status).toBe(403);
    expect((await page("", await token(OUTLET_ACTOR))).nodes).toEqual([]);
    expect((await request(`scopeNode=${HOTEL}`, await token(OUTLET_ACTOR))).status).toBe(403);
    expect((await request("", await token(DEPARTMENT))).status).toBe(403);
    expect(await page("", await token(EMPTY_ACTOR))).toEqual({ scope: null, nodes: [], nextCursor: null });
  });

  test("group grant collapses independent roots and counts only accessible property identities", async () => {
    await deploy!`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${T}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${GROUP}::uuid)`;
    try {
      const roots = await page();
      expect(roots.nodes.map(n => [n.id, n.parentId, n.authorizedPropertyCount])).toEqual([[GROUP, null, LARGE_COUNT + 6]]);
      const children = await page(`scopeNode=${GROUP}`);
      expect(children.nodes.map(n => n.id)).toEqual([EAST, WEST, LARGE, BRAND]);
      expect(children.nodes.every(n => n.parentId === GROUP)).toBe(true);
      expect(children.nodes.map(n => n.authorizedPropertyCount)).toEqual([3, 2, LARGE_COUNT, 1]);
      const brand = await page(`scopeNode=${BRAND}`);
      expect(brand.scope?.kind).toBe("brand");
      expect(brand.nodes.map(n => [n.id, n.parentId])).toEqual([[BRAND_HOTEL, BRAND]]);
    } finally { await deploy!`DELETE FROM user_role WHERE user_id=${ACTOR}::uuid AND scope_node=${GROUP}::uuid`; }
  });

  test("foreign/nonexistent/ungranted scope and forged cursor do not disclose or broaden authority", async () => {
    let deniedBody: Record<string, unknown> | undefined;
    for (const scope of [FOREIGN_SCOPE, FOREIGN_HOTEL, WEST, GROUP, id(999)]) {
      const response = await request(`scopeNode=${scope}`);
      expect(response.status).toBe(403);
      const body = await response.json() as Record<string, unknown>;
      delete body.correlation_id;
      if (deniedBody === undefined) deniedBody = body;
      else expect(body).toEqual(deniedBody);
    }
    const positioned = await page(`after=${FOREIGN_SCOPE}`);
    expect(positioned.nodes.every(n => [EAST, OTHER].includes(n.id))).toBe(true);
    expect((await request("", await token(ACTOR, FOREIGN))).status).toBe(403);
    expect((await request("", await token(id(999)))).status).toBe(403);
    expect((await request("", await token(ACTOR, T, []))).status).toBe(403);
  });

  test("strict HTTP query rejects empty, repeated, unknown and invalid parameters", async () => {
    const before = await snapshot();
    for (const query of ["limit=0", "limit=101", "limit=01", "limit=1.0", "limit=", "limit=1&limit=1",
      "after=", "scopeNode=", "scopeNode=bad", "after=bad", "demoRestricted=0", "tenantId=x"])
      expect((await request(query)).status).toBe(400);
    expect(await snapshot()).toBe(before);
  });

  test("same signed token loses current membership and permission including continuation", async () => {
    const first = await page("limit=1");
    expect(first.nextCursor).toBe(EAST);
    await deploy!`DELETE FROM user_role WHERE user_id=${ACTOR}::uuid AND scope_node=${OTHER}::uuid`;
    try {
      expect((await page(`limit=1&after=${first.nextCursor}`)).nodes).toEqual([]);
      expect((await request(`scopeNode=${OTHER}`)).status).toBe(403);
    } finally {
      await deploy!`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${T}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${OTHER}::uuid)`;
    }
    await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid AND permission_code=${READ}`;
    try {
      expect((await request()).status).toBe(403);
      expect((await request(`after=${first.nextCursor}`)).status).toBe(403);
    } finally { await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${READ})`; }
    expect((await request()).status).toBe(200);
    const propertyToken = await token(PROPERTY_ACTOR);
    await deploy!`DELETE FROM user_role WHERE user_id=${PROPERTY_ACTOR}::uuid`;
    try { expect((await request("", propertyToken)).status).toBe(403); }
    finally { await deploy!`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${T}::uuid,${PROPERTY_ACTOR}::uuid,${ROLE}::uuid,${HOTEL}::uuid)`; }
  });

  test("same token loses access when actor or tenant is inactive", async () => {
    for (const table of ["app_user", "tenant"]) {
      const target = table === "app_user" ? ACTOR : T;
      await deploy!.unsafe(`UPDATE ${table} SET status='inactive' WHERE id=$1::uuid`, [target]);
      try {
        expect((await request()).status).toBe(403);
        expect((await request(`after=${EAST}&limit=1`)).status).toBe(403);
      }
      finally { await deploy!.unsafe(`UPDATE ${table} SET status='active' WHERE id=$1::uuid`, [target]); }
    }
  });

  test("token expiry and malformed bearer are rejected at signed session boundary", async () => {
    const issuedAt = now;
    const expiring = await token();
    now = issuedAt + 961;
    try { expect((await request("", expiring)).status).toBe(401); }
    finally { now = issuedAt; }
    expect((await request("", "malformed")).status).toBe(401);
  });

  test("server-controlled demo intersection precedes hierarchy roots and counts", async () => {
    const before = await snapshot();
    Bun.env.YELLOW_PUBLIC_DEMO_AUTOMATIC_LOGIN = "1";
    try {
      const root = await page();
      expect(root.nodes.map(n => [n.id, n.authorizedPropertyCount])).toEqual([[EAST, 1]]);
      expect((await page(`scopeNode=${EAST}`)).nodes.map(n => n.id)).toEqual([DEMO_ONE]);
      expect((await request(`scopeNode=${HOTEL}`)).status).toBe(403);
      expect((await page("", await token(PROPERTY_ACTOR))).nodes).toEqual([]);
      expect((await request("demoRestricted=0")).status).toBe(400);
    } finally { delete Bun.env.YELLOW_PUBLIC_DEMO_AUTOMATIC_LOGIN; }
    expect((await page()).nodes.map(n => n.id)).toEqual([EAST, OTHER]);
    expect(await snapshot()).toBe(before);
  });

  test("large real portfolio keyset pages exhaust independent oracle at limits 1/50/100", async () => {
    await deploy!`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${T}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${LARGE}::uuid)`;
    try {
      const before = await snapshot();
      const oracle = Array.from({ length: LARGE_COUNT }, (_, offset) => id(10001 + offset));
      for (const limit of [1, 50, 100]) {
        const actual: string[] = [];
        let cursor: string | null = null;
        let calls = 0;
        do {
          const result: PortfolioPage = await page(`scopeNode=${LARGE}&limit=${limit}${cursor ? `&after=${cursor}` : ""}`);
          expect(result.nodes.length).toBeLessThanOrEqual(limit);
          expect(result.scope?.authorizedPropertyCount).toBe(LARGE_COUNT);
          expect(result.nodes.every(n => n.parentId === LARGE && n.authorizedPropertyCount === 1)).toBe(true);
          actual.push(...result.nodes.map(n => n.id));
          if (result.nextCursor !== null) expect(result.nextCursor).toBe(result.nodes.at(-1)?.id ?? "unreachable");
          cursor = result.nextCursor;
          expect(++calls).toBeLessThanOrEqual(LARGE_COUNT);
        } while (cursor !== null);
        expect(actual).toEqual(oracle);
        expect(new Set(actual).size).toBe(LARGE_COUNT);
        expect(calls).toBe(Math.ceil(LARGE_COUNT / limit));
      }
      expect(await snapshot()).toBe(before);
    } finally { await deploy!`DELETE FROM user_role WHERE user_id=${ACTOR}::uuid AND scope_node=${LARGE}::uuid`; }
  }, 180_000);
});
