import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import {
  BearerTenantResolver,
  Hs256TokenSigner,
  type LocalLoginService,
} from "../src/contexts/identity";
import { Database } from "../src/kernel";
import { OperatorHttpApi } from "../src/http/operator";

const DEPLOY_URL = process.env.YELLOW_ORDER562_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER562_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER562_DATABASE === "1";
if (required && (!DEPLOY_URL || !RUNTIME_URL)) throw new Error("Order562 operator proof requires paired database URLs");
const dbDescribe = required ? describe.serial : describe.skip;

const TENANT = "56300000-0000-4000-8000-000000000001";
const PROPERTY = "56300000-0000-4000-8000-000000000002";
const ACTOR = "56300000-0000-4000-8000-000000000003";
const ROLE = "56300000-0000-4000-8000-000000000004";
const SCOPE = "financials.folio-series:configure";
const signer = new Hs256TokenSigner("order562-signed-session-test-key-not-for-production");

let deploy: SQL | undefined;
let database: Database | undefined;
let app: ReturnType<typeof createApp> | undefined;

async function clean() {
  if (!deploy) return;
  for (const table of ["api_idempotency", "outbox", "fact_log", "document_series"]) {
    await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id=$1::uuid`, [TENANT]);
  }
  await deploy`DELETE FROM user_role WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid`;
  await deploy`DELETE FROM role WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM app_user WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM org_node WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM tenant WHERE id=${TENANT}::uuid`;
}

async function token(scopes: readonly string[] = [SCOPE]) {
  return `Bearer ${await signer.issue({ userId: ACTOR, tenantId: TENANT, scopes })}`;
}

function url(property = PROPERTY, suffix = "") {
  return `http://yellow.test/api/v1/properties/${property}/folio-series${suffix}`;
}

async function post(key: string, options: {
  property?: string;
  scopes?: readonly string[];
  body?: unknown;
  contentType?: string;
  suffix?: string;
} = {}) {
  return app!.handle(new Request(url(options.property, options.suffix), {
    method: "POST",
    headers: {
      authorization: await token(options.scopes),
      "content-type": options.contentType ?? "application/json",
      "idempotency-key": key,
    },
    body: JSON.stringify(options.body ?? { prefix: "HTTP562-" }),
  }));
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 4, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 8, prepare: false });
  await clean();
  await deploy`INSERT INTO tenant(id,slug,name,tier,status)
    VALUES(${TENANT}::uuid,'operator562','Operator562','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency)
    VALUES(${PROPERTY}::uuid,${TENANT}::uuid,'operator562.main','property','Operator562','Asia/Kolkata','INR')`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status)
    VALUES(${ACTOR}::uuid,${TENANT}::uuid,'operator@order562.test','Operator562','active')`;
  await deploy`INSERT INTO role(id,tenant_id,name) VALUES(${ROLE}::uuid,${TENANT}::uuid,'Operator562 role')`;
  await deploy`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${SCOPE})`;
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

dbDescribe("Order562 signed operator folio-series boundary", () => {
  test("preserves first HTTP status/body on same-key replay and distinguishes a new-key no-op", async () => {
    const first = await post("order562-http-stable-key");
    expect(first.status).toBe(201);
    expect(first.headers.get("idempotency-replayed")).toBe("false");
    expect(first.headers.get("cache-control")).toBe("no-store");
    const body = await first.json() as Record<string, unknown>;
    expect(body).toMatchObject({ kind: "folio", propertyNode: PROPERTY, prefix: "HTTP562-",
      fiscal: false, nextNo: "1", created: true });

    const replay = await post("order562-http-stable-key");
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.json()).toEqual(body);

    await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid AND permission_code=${SCOPE}`;
    try {
      expect((await post("order562-http-stable-key")).status).toBe(403);
    } finally {
      await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${SCOPE})`;
    }
    await deploy!`UPDATE app_user SET status='inactive' WHERE tenant_id=${TENANT}::uuid AND id=${ACTOR}::uuid`;
    try {
      expect((await post("order562-http-stable-key")).status).toBe(403);
    } finally {
      await deploy!`UPDATE app_user SET status='active' WHERE tenant_id=${TENANT}::uuid AND id=${ACTOR}::uuid`;
    }

    const current = await post("order562-http-new-key");
    expect(current.status).toBe(200);
    expect(current.headers.get("idempotency-replayed")).toBe("false");
    expect(await current.json()).toEqual({ ...body, created: false });
    const [counts] = await deploy!<{ series: number; facts: number; events: number; receipts: number }[]>`SELECT
      (SELECT count(*)::int FROM document_series WHERE tenant_id=${TENANT}::uuid) series,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type='document_series') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND event_type='folio.series.configured') events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid
        AND operation='financials.folio-series.configure') receipts`;
    expect(counts).toEqual({ series: 1, facts: 1, events: 1, receipts: 2 });
  });

  test("rejects missing scope, foreign property, malformed body, query and idempotency key before mutation", async () => {
    const [before] = await deploy!<{ total: number }[]>`SELECT
      (SELECT count(*) FROM document_series WHERE tenant_id=${TENANT}::uuid)+
      (SELECT count(*) FROM fact_log WHERE tenant_id=${TENANT}::uuid)+
      (SELECT count(*) FROM outbox WHERE tenant_id=${TENANT}::uuid)+
      (SELECT count(*) FROM api_idempotency WHERE tenant_id=${TENANT}::uuid) total`;
    expect((await post("order562-http-no-scope", { scopes: [] })).status).toBe(403);
    expect((await post("order562-http-foreign", { property: crypto.randomUUID() })).status).toBe(403);
    for (const options of [
      { body: {} },
      { body: { prefix: "BAD SPACE" } },
      { body: { prefix: "OK-", unexpected: true } },
      { suffix: "?x=1" },
      { contentType: "text/plain" },
    ]) expect((await post("order562-http-invalid", options)).status).toBe(400);
    expect((await post("short", {})).status).toBe(400);
    const [after] = await deploy!<{ total: number }[]>`SELECT
      (SELECT count(*) FROM document_series WHERE tenant_id=${TENANT}::uuid)+
      (SELECT count(*) FROM fact_log WHERE tenant_id=${TENANT}::uuid)+
      (SELECT count(*) FROM outbox WHERE tenant_id=${TENANT}::uuid)+
      (SELECT count(*) FROM api_idempotency WHERE tenant_id=${TENANT}::uuid) total`;
    expect(after).toEqual(before);
  });

  test("same key with a different prefix is a sanitized conflict", async () => {
    const response = await post("order562-http-stable-key", { body: { prefix: "OTHER562-" } });
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(text).not.toContain("request_hash");
    expect(text).not.toContain("PostgreSQL");
  });
});
