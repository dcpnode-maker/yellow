import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import {
  BearerTenantResolver,
  Hs256TokenSigner,
  type LocalLoginService,
} from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import { Database } from "../src/kernel";

const DEPLOY_URL = process.env.YELLOW_ORDER581_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER581_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER581_DATABASE === "1";
if (required && (!DEPLOY_URL || !RUNTIME_URL)) throw new Error("Order581 HTTP proof requires paired database URLs");
const dbDescribe = required ? describe.serial : describe.skip;
setDefaultTimeout(30_000);

const TENANT = "58200000-0000-4000-8000-000000000001";
const PROPERTY = "58200000-0000-4000-8000-000000000002";
const SIBLING = "58200000-0000-4000-8000-000000000003";
const ACTOR = "58200000-0000-4000-8000-000000000004";
const ROLE = "58200000-0000-4000-8000-000000000005";
const READ = "identity.property-profile:read";
const WRITE = "identity.property-profile:write";
const signer = new Hs256TokenSigner("order581-property-profile-http-key-not-for-production");

let deploy: SQL | undefined;
let database: Database | undefined;
let app: ReturnType<typeof createApp> | undefined;

async function clean() {
  if (!deploy) return;
  for (const table of ["api_idempotency", "outbox", "fact_log"]) {
    await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id=$1::uuid`, [TENANT]);
  }
  await deploy`DELETE FROM user_role WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM role_permission WHERE role_id IN (SELECT id FROM role WHERE tenant_id=${TENANT}::uuid)`;
  await deploy`DELETE FROM role WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM app_user WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM org_node WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM tenant WHERE id=${TENANT}::uuid`;
}

async function authorization(scopes: readonly string[]) {
  return `Bearer ${await signer.issue({ userId: ACTOR, tenantId: TENANT, scopes })}`;
}

function url(property = PROPERTY, suffix = "") {
  return `http://yellow.test/api/v1/properties/${property}/profile${suffix}`;
}

async function get(scopes: readonly string[] = [READ], property = PROPERTY) {
  return app!.handle(new Request(url(property), {
    headers: { authorization: await authorization(scopes) },
  }));
}

async function post(key: string, body: unknown, scopes: readonly string[] = [WRITE], property = PROPERTY) {
  return app!.handle(new Request(url(property, "/name"), {
    method: "POST",
    headers: {
      authorization: await authorization(scopes),
      "content-type": "application/json",
      "idempotency-key": key,
      "x-correlation-id": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  }));
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 4, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 8, prepare: false });
  await clean();
  await deploy`INSERT INTO tenant(id,slug,name,tier,status)
    VALUES(${TENANT}::uuid,'order581-http','Order581 HTTP','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency,config) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order581_http.main','property','Order581 HTTP','Asia/Kolkata','INR','{"private":"never-return"}'),
    (${SIBLING}::uuid,${TENANT}::uuid,'order581_http.sibling','property','Sibling','UTC',NULL,'{}')`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status)
    VALUES(${ACTOR}::uuid,${TENANT}::uuid,'actor@order581-http.test','Order581 HTTP actor','active')`;
  await deploy`INSERT INTO role(id,tenant_id,name) VALUES(${ROLE}::uuid,${TENANT}::uuid,'Order581 HTTP role')`;
  await deploy`INSERT INTO role_permission(role_id,permission_code) VALUES
    (${ROLE}::uuid,${READ}),(${ROLE}::uuid,${WRITE})`;
  await deploy`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
    VALUES(${TENANT}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${PROPERTY}::uuid)`;
  app = createApp({
    database,
    tenantResolver: new BearerTenantResolver(signer),
    operatorApi: new OperatorHttpApi({} as LocalLoginService),
  });
}, 60_000);

afterAll(async () => {
  await clean();
  await database?.close();
  await deploy?.close();
}, 60_000);

dbDescribe("Order581 signed property identity HTTP boundary", () => {
  test("GET returns the exact canonical shape and never leaks config or tenant", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as { property: Record<string, unknown> };
    expect(Object.keys(body)).toEqual(["property"]);
    expect(Object.keys(body.property).sort()).toEqual([
      "currency", "effectiveAt", "effectiveBusinessDate", "id", "name", "timezone", "version",
    ]);
    expect(body.property).toEqual({ id: PROPERTY, name: "Order581 HTTP", timezone: "Asia/Kolkata",
      currency: "INR", version: 0, effectiveAt: null, effectiveBusinessDate: null });
    expect(JSON.stringify(body)).not.toContain("never-return");
    expect(JSON.stringify(body)).not.toContain(TENANT);
  });

  test("POST normalizes, persists, replays exact receipt and GET observes the version", async () => {
    const first = await post("order581-http-stable-key", { expectedVersion: 0, name: "  HTTP   Yellow  " });
    expect(first.status).toBe(200);
    expect(first.headers.get("idempotency-replayed")).toBe("false");
    const body = await first.json() as Record<string, unknown>;
    expect(body).toMatchObject({ changed: true, replayed: false,
      property: { id: PROPERTY, name: "HTTP Yellow", timezone: "Asia/Kolkata", currency: "INR", version: 1 } });
    const replay = await post("order581-http-stable-key", { expectedVersion: 0, name: "  HTTP   Yellow  " });
    expect(replay.status).toBe(200);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.json()).toEqual({ ...body, replayed: true });
    const current = await get();
    expect(await current.json()).toMatchObject({ property: { name: "HTTP Yellow", version: 1 } });
  });

  test("scope, live grant, sibling, malformed, stale and key conflicts are sanitized", async () => {
    expect((await get([])).status).toBe(403);
    expect((await post("order581-http-no-scope", { expectedVersion: 1, name: "Denied" }, [])).status).toBe(403);
    expect((await get([READ], SIBLING)).status).toBe(403);
    expect((await post("order581-http-sibling", { expectedVersion: 0, name: "Denied" }, [WRITE], SIBLING)).status).toBe(403);
    for (const body of [
      {},
      { expectedVersion: 1 },
      { expectedVersion: "1", name: "Bad" },
      { expectedVersion: 1, name: "Bad", extra: true },
      { expectedVersion: 1, name: "bad\u202ename" },
    ]) expect((await post(`order581-http-invalid-${crypto.randomUUID()}`, body)).status).toBe(400);
    expect((await post("order581-http-stale", { expectedVersion: 0, name: "Stale" })).status).toBe(409);
    const reused = await post("order581-http-stable-key", { expectedVersion: 1, name: "Changed reuse" });
    expect(reused.status).toBe(409);
    expect(await reused.text()).not.toContain("request_hash");
    await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid AND permission_code=${WRITE}`;
    try {
      expect((await post("order581-http-stable-key", { expectedVersion: 0, name: "  HTTP   Yellow  " })).status).toBe(403);
    } finally {
      await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${WRITE})`;
    }
  });
});
