import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, type LocalLoginService, type PropertyMode, type PropertyOperatingMode } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import { Database } from "../src/kernel";

const DEPLOY = process.env.YELLOW_PROPERTY_MODE_DEPLOY_DATABASE_URL, RUNTIME = process.env.YELLOW_PROPERTY_MODE_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_PROPERTY_MODE_DATABASE === "1";
if (REQUIRED && (!DEPLOY || !RUNTIME)) throw new Error("Property mode HTTP proof requires paired database URLs");
const dbDescribe = REQUIRED ? describe.serial : describe.skip;
const id = (n: number) => `72100000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T = id(1), FOREIGN_T = id(2), PROPERTY = id(3), SIBLING = id(4), FOREIGN = id(5), ACTOR = id(10), ROLE = id(20);
const READ = "identity.property-mode:read", WRITE = "identity.property-mode:write";
const signer = new Hs256TokenSigner("property-mode-http-synthetic-fixture-key-not-production");
let deploy: SQL | undefined, database: Database | undefined, app: ReturnType<typeof createApp> | undefined, bearer = "";
async function clean() {
  if (!deploy) return;
  for (const table of ["api_idempotency", "outbox", "fact_log", "user_role"]) await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [T, FOREIGN_T]);
  await deploy`DELETE FROM role_permission WHERE role_id IN (SELECT id FROM role WHERE tenant_id IN (${T}::uuid,${FOREIGN_T}::uuid))`;
  for (const table of ["role", "app_user", "org_node"]) await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [T, FOREIGN_T]);
  await deploy`DELETE FROM tenant WHERE id IN (${T}::uuid,${FOREIGN_T}::uuid)`;
}
const path = (property = PROPERTY) => `http://yellow.test/api/v1/properties/${property}/operating-mode`;
async function read(property = PROPERTY, token = bearer, query = "") {
  return app!.handle(new Request(path(property) + query, { headers: { authorization: `Bearer ${token}` } }));
}
async function post(key: string, body: unknown, token = bearer, property = PROPERTY, query = "", contentType = "application/json") {
  return app!.handle(new Request(path(property) + query, { method: "POST", headers: {
    authorization: `Bearer ${token}`, "content-type": contentType, "idempotency-key": key, "x-correlation-id": id(99),
  }, body: JSON.stringify(body) }));
}
async function state(): Promise<string> {
  const rows = [];
  for (const table of ["org_node", "fact_log", "outbox", "api_idempotency"])
    rows.push(await deploy!.unsafe(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) rows FROM ${table} t WHERE tenant_id=$1::uuid`, [T]));
  return JSON.stringify(rows);
}
async function mode(): Promise<PropertyMode> {
  const response = await read();
  expect(response.status).toBe(200);
  return (await response.json() as { propertyMode: PropertyMode }).propertyMode;
}

beforeAll(async () => {
  if (!REQUIRED || !DEPLOY || !RUNTIME) return;
  deploy = new SQL(DEPLOY, { max: 4, prepare: false }); database = Database.connect(RUNTIME, { maxConnections: 6, prepare: false });
  await clean();
  await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${T}::uuid,'mode721-http','Mode HTTP','shared','active'),(${FOREIGN_T}::uuid,'mode721-http-foreign','Foreign HTTP','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency,config) VALUES
    (${PROPERTY}::uuid,${T}::uuid,'mode721.main','property','HTTP property','Asia/Kolkata','INR','{"private":"not-for-http"}'),
    (${SIBLING}::uuid,${T}::uuid,'mode721.sibling','property','Sibling','UTC','USD','{}'),
    (${FOREIGN}::uuid,${FOREIGN_T}::uuid,'mode721.main','property','Foreign','UTC','USD','{}')`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(${ACTOR}::uuid,${T}::uuid,'actor@mode721.test','HTTP actor','active')`;
  await deploy`INSERT INTO role(id,tenant_id,name) VALUES(${ROLE}::uuid,${T}::uuid,'HTTP mode role')`;
  await deploy`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${READ}),(${ROLE}::uuid,${WRITE})`;
  await deploy`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${T}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${PROPERTY}::uuid)`;
  app = createApp({ database, tenantResolver: new BearerTenantResolver(signer), operatorApi: new OperatorHttpApi({} as LocalLoginService) });
  bearer = await signer.issue({ userId: ACTOR, tenantId: T, scopes: [READ, WRITE] });
}, 60_000);
afterAll(async () => { if (!REQUIRED) return; await clean(); await database?.close(); await deploy?.close(); }, 60_000);

dbDescribe("property operating mode genuine signed HTTP", () => {
  test("missing setting is explicit and response contains only the exact typed public DTO", async () => {
    const response = await read(); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ propertyMode: { propertyNode: PROPERTY, mode: null, version: 0, effectiveAt: null, effectiveBusinessDate: null, canWrite: true } });
    const reader = await signer.issue({ userId: ACTOR, tenantId: T, scopes: [READ] });
    expect((await (await read(PROPERTY, reader)).json() as { propertyMode: PropertyMode }).propertyMode.canWrite).toBe(false);
  });

  test("strict JSON/body/query/version/idempotency boundaries reject without state changes", async () => {
    const before = await state();
    for (const body of [{}, { mode: "hotel" }, { expectedVersion: 0, mode: "Hotel" }, { expectedVersion: -1, mode: "hotel" },
      { expectedVersion: 1.5, mode: "str" }, { expectedVersion: 2147483648, mode: "both" },
      { expectedVersion: 0, mode: "both", tenantId: T }, { expectedVersion: 0, mode: "both", canWrite: true }])
      expect((await post("mode721-invalid-body", body)).status).toBe(400);
    expect((await post("short", { expectedVersion: 0, mode: "hotel" })).status).toBe(400);
    expect((await post("", { expectedVersion: 0, mode: "hotel" })).status).toBe(400);
    expect((await post("mode721-not-json", { expectedVersion: 0, mode: "hotel" }, bearer, PROPERTY, "", "text/plain")).status).toBe(400);
    expect((await read("invalid")).status).toBe(400);
    for (const query of ["?mode=hotel", "?tenantId=x", "?limit=1&limit=2"]) {
      expect((await read(PROPERTY, bearer, query)).status).toBe(400);
      expect((await post("mode721-query-denied", { expectedVersion: 0, mode: "hotel" }, bearer, PROPERTY, query)).status).toBe(400);
    }
    expect(await state()).toBe(before);
  });

  test("saved Hotel/STR/Both survives fresh reads; no-op, stale and replay outcomes are exact", async () => {
    let current = await mode();
    for (const value of ["hotel", "str", "both"] as readonly PropertyOperatingMode[]) {
      const response = await post(`mode721-save-${value}`, { expectedVersion: current.version, mode: value });
      expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-correlation-id")).toBe(id(99)); expect(response.headers.get("idempotency-replayed")).toBe("false");
      const body = await response.json() as { propertyMode: PropertyMode; changed: boolean; replayed: boolean };
      expect(Object.keys(body).sort()).toEqual(["changed", "propertyMode", "replayed"]);
      expect(body).toMatchObject({ changed: true, replayed: false, propertyMode: { version: current.version + 1, mode: value, canWrite: true } });
      expect(Object.keys(body.propertyMode).sort()).toEqual(["canWrite", "effectiveAt", "effectiveBusinessDate", "mode", "propertyNode", "version"]);
      expect(await mode()).toEqual(body.propertyMode);
      const replay = await post(`mode721-save-${value}`, { expectedVersion: current.version, mode: value });
      expect(replay.status).toBe(200); expect(replay.headers.get("idempotency-replayed")).toBe("true");
      expect(await replay.json()).toEqual({ ...body, replayed: true });
      current = body.propertyMode;
    }
    const countBefore = await deploy!`SELECT id FROM fact_log WHERE tenant_id=${T}::uuid`;
    const eventsBefore = await deploy!`SELECT id FROM outbox WHERE tenant_id=${T}::uuid ORDER BY seq`;
    const noOp = await post("mode721-same-noop", { expectedVersion: current.version, mode: current.mode });
    expect(noOp.status).toBe(200); expect(await noOp.json()).toEqual({ propertyMode: current, changed: false, replayed: false });
    expect(await deploy!`SELECT id FROM fact_log WHERE tenant_id=${T}::uuid`).toEqual(countBefore);
    expect(await deploy!`SELECT id FROM outbox WHERE tenant_id=${T}::uuid ORDER BY seq`).toEqual(eventsBefore);
    expect((await post("mode721-stale", { expectedVersion: 0, mode: "hotel" })).status).toBe(409);
    expect((await post("mode721-save-hotel", { expectedVersion: current.version, mode: "str" })).status).toBe(409);
  });

  test("same signed token loses current grant and permission before exact replay", async () => {
    const current = await mode();
    const desired = current.mode === "hotel" ? "str" : "hotel";
    const body = { expectedVersion: current.version, mode: desired };
    expect((await post("mode721-revoked-replay", body)).status).toBe(200);
    const before = await state();
    await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid AND permission_code=${WRITE}`;
    try {
      expect((await post("mode721-revoked-replay", body)).status).toBe(403);
      expect((await mode()).canWrite).toBe(false);
    } finally { await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${WRITE})`; }
    await deploy!`DELETE FROM user_role WHERE user_id=${ACTOR}::uuid`;
    try { expect((await read()).status).toBe(403); expect((await post("mode721-revoked-replay", body)).status).toBe(403); }
    finally { await deploy!`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${T}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${PROPERTY}::uuid)`; }
    expect(await state()).toBe(before);
  });

  test("signed scope, tenant, property and inactive identity denials preserve public boundary", async () => {
    const noScope = await signer.issue({ userId: ACTOR, tenantId: T, scopes: [] });
    expect((await read(PROPERTY, noScope)).status).toBe(403);
    expect((await post("mode721-scope-denied", { expectedVersion: 4, mode: "both" }, noScope)).status).toBe(403);
    for (const property of [SIBLING, FOREIGN, id(999)]) {
      expect((await read(property)).status).toBe(403);
      expect((await post("mode721-foreign-denied", { expectedVersion: 0, mode: "hotel" }, bearer, property)).status).toBe(403);
    }
    for (const table of ["tenant", "app_user"]) {
      const target = table === "tenant" ? T : ACTOR;
      await deploy!.unsafe(`UPDATE ${table} SET status='inactive' WHERE id=$1::uuid`, [target]);
      try { expect((await read()).status).toBe(403); expect((await post("mode721-inactive", { expectedVersion: 4, mode: "both" })).status).toBe(403); }
      finally { await deploy!.unsafe(`UPDATE ${table} SET status='active' WHERE id=$1::uuid`, [target]); }
    }
    expect((await read(PROPERTY, "malformed")).status).toBe(401);
    const foreignToken = await signer.issue({ userId: ACTOR, tenantId: FOREIGN_T, scopes: [READ, WRITE] });
    expect((await read(FOREIGN, foreignToken)).status).toBe(403);
  });
});
