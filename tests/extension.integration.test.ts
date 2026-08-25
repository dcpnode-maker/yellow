import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner } from "../src/contexts/identity";
import { Database, ExtensionRegistry } from "../src/kernel";
import { validateJsonSchema } from "../src/kernel";
import { LAUNCH_EXTENSIONS, LAUNCH_EXTENSION_TYPES } from "../scripts/seed";

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_EXTENSION_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL ?? process.env.YELLOW_EXTENSION_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_EXTENSION === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const TENANT_B = "00000000-0000-0000-0000-000000000002";
const PROPERTY_A = "00000000-0000-0000-0000-000000000012";
const PROPERTY_B = "00000000-0000-0000-0000-0000000000b1";
const USER = "00000000-0000-0000-0000-000000000960";
const SECRET = "order-024-extension-proof-secret-is-long-enough";
const TYPE = "order024-widget";
const DENIED_TYPE = "order024-denied";
const GLOBAL_ID = "00000000-0000-0000-0000-000000002401";
const SCHEMA = {
  type: "object",
  required: ["name", "capacity"],
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    capacity: { type: "integer", minimum: 1 },
  },
} as const;

if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_RUNTIME_DATABASE_URL are required by the Order 024 proof");
}

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let platformPool: SQL | undefined;
let database: Database | undefined;
let registry: ExtensionRegistry | undefined;
let tokenA = "";
let tokenB = "";
let tokenWithoutPlatform = "";

describe("Order 024 launch extension catalogue", () => {
  test("all ten schemas accept all 40 launch instances", () => {
    const schemas = new Map<string, (typeof LAUNCH_EXTENSION_TYPES)[number]["jsonSchema"]>(
      LAUNCH_EXTENSION_TYPES.map(({ type, jsonSchema }) => [type, jsonSchema]),
    );
    const invalid = LAUNCH_EXTENSIONS.flatMap(({ type, key, content }) => {
      const issues = validateJsonSchema(schemas.get(type), content);
      return issues.length === 0 ? [] : [{ type, key, issues }];
    });
    expect(schemas.size).toBe(10);
    expect(LAUNCH_EXTENSIONS).toHaveLength(40);
    expect(invalid).toEqual([]);
  });
});

function request(path: string, token: string, init: RequestInit = {}): Request {
  return new Request(`http://yellow.test${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-request-id": crypto.randomUUID(),
      ...init.headers,
    },
  });
}

beforeAll(async () => {
  if (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL) return;
  admin = new SQL(DEPLOY_DATABASE_URL, { max: 3 });
  platformPool = new SQL(RUNTIME_DATABASE_URL, { max: 6 });
  database = Database.connect(RUNTIME_DATABASE_URL, { maxConnections: 6 });
  registry = new ExtensionRegistry(platformPool);
  const tokens = new Hs256TokenSigner(SECRET);
  const fullScopes = [
    "identity.extension-type:register",
    "identity.extension:read",
    "identity.extension:write",
  ];
  tokenA = await tokens.issue({ userId: USER, tenantId: TENANT_A, scopes: fullScopes });
  tokenB = await tokens.issue({ userId: USER, tenantId: TENANT_B, scopes: fullScopes });
  tokenWithoutPlatform = await tokens.issue({
    userId: USER,
    tenantId: TENANT_A,
    scopes: ["identity.extension:read", "identity.extension:write"],
  });
});

afterAll(async () => {
  if (admin) {
    await admin`DELETE FROM fact_log WHERE payload->>'type' IN (${TYPE}, ${DENIED_TYPE})`;
    await admin`DELETE FROM extension WHERE type IN (${TYPE}, ${DENIED_TYPE})`;
    await admin`DELETE FROM extension_type WHERE type IN (${TYPE}, ${DENIED_TYPE})`;
    await admin.close();
  }
  await platformPool?.close();
  await database?.close();
});

databaseDescribe("Order 024 runtime extension registry", () => {
  test("P1/P6: platform-authorized API registration accepts a valid tenant instance", async () => {
    const app = createApp({
      database,
      tenantResolver: new BearerTenantResolver(new Hs256TokenSigner(SECRET)),
      extensionRegistry: registry,
    });
    const denied = await app.handle(request("/api/extension-types", tokenWithoutPlatform, {
      method: "POST",
      body: JSON.stringify({ type: DENIED_TYPE, propertyNode: PROPERTY_A, jsonSchema: SCHEMA }),
    }));
    expect(denied.status).toBe(403);
    const deniedRows = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM extension_type WHERE type = ${DENIED_TYPE}
    `;
    expect(deniedRows[0]?.count).toBe(0);

    const registered = await app.handle(request("/api/extension-types", tokenA, {
      method: "POST",
      body: JSON.stringify({ type: TYPE, propertyNode: PROPERTY_A, jsonSchema: SCHEMA }),
    }));
    expect(registered.status).toBe(201);
    expect(await registered.json()).toEqual({ result: "inserted" });

    const created = await app.handle(request("/api/extensions", tokenA, {
      method: "POST",
      body: JSON.stringify({
        type: TYPE,
        key: "tenant-a-valid",
        propertyNode: PROPERTY_A,
        content: { name: "A", capacity: 2 },
      }),
    }));
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      tenantId: TENANT_A,
      type: TYPE,
      key: "tenant-a-valid",
      content: { name: "A", capacity: 2 },
    });
  });

  test("P2: invalid content reports the failing path and writes no row", async () => {
    const app = createApp({
      database,
      tenantResolver: new BearerTenantResolver(new Hs256TokenSigner(SECRET)),
      extensionRegistry: registry,
    });
    const response = await app.handle(request("/api/extensions", tokenA, {
      method: "POST",
      body: JSON.stringify({
        type: TYPE,
        key: "tenant-a-invalid",
        propertyNode: PROPERTY_A,
        content: { name: "bad", capacity: 0 },
      }),
    }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "validation_failed",
      issues: [{ path: "$.capacity", message: "must be at least 1" }],
    });
    const rows = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM extension WHERE type = ${TYPE} AND key = 'tenant-a-invalid'
    `;
    expect(rows[0]?.count).toBe(0);
  });

  test("P3: A and B see global plus own instances, never each other's", async () => {
    const app = createApp({
      database,
      tenantResolver: new BearerTenantResolver(new Hs256TokenSigner(SECRET)),
      extensionRegistry: registry,
    });
    const createdB = await app.handle(request("/api/extensions", tokenB, {
      method: "POST",
      body: JSON.stringify({
        type: TYPE,
        key: "tenant-b-valid",
        propertyNode: PROPERTY_B,
        content: { name: "B", capacity: 3 },
      }),
    }));
    expect(createdB.status).toBe(201);
    await admin!`
      INSERT INTO extension (id, tenant_id, type, key, content)
      VALUES (${GLOBAL_ID}::uuid, NULL, ${TYPE}, 'platform-global', '{"name":"Global","capacity":1}'::jsonb)
    `;

    const [responseA, responseB] = await Promise.all([
      app.handle(request("/api/extensions", tokenA)),
      app.handle(request("/api/extensions", tokenB)),
    ]);
    const visibleA = (await responseA.json() as { extensions: Array<{ key: string }> }).extensions.map(({ key }) => key);
    const visibleB = (await responseB.json() as { extensions: Array<{ key: string }> }).extensions.map(({ key }) => key);
    expect(visibleA).toContain("platform-global");
    expect(visibleA).toContain("tenant-a-valid");
    expect(visibleA).not.toContain("tenant-b-valid");
    expect(visibleB).toContain("platform-global");
    expect(visibleB).toContain("tenant-b-valid");
    expect(visibleB).not.toContain("tenant-a-valid");
  });

  test("P4: every API write carries its actor, tenant and request audit fact", async () => {
    const rows = await admin!<Array<{
      entity_type: string;
      tenant_id: string;
      actor_id: string;
      request_id: string;
    }>>`
      SELECT entity_type, tenant_id, actor_id, payload->>'request_id' AS request_id
      FROM fact_log
      WHERE payload->>'type' = ${TYPE}
      ORDER BY recorded_at
    `;
    expect(rows).toHaveLength(3);
    expect(rows.map(({ entity_type }) => entity_type)).toEqual(["extension_type", "extension", "extension"]);
    expect(rows.every(({ actor_id, request_id }) => actor_id === USER && /^[0-9a-f-]{36}$/.test(request_id))).toBe(true);
    expect(rows.map(({ tenant_id }) => tenant_id).sort()).toEqual([TENANT_A, TENANT_A, TENANT_B].sort());
  });

  test("P5: proposed schema incompatibility identifies existing ids and exact paths", async () => {
    const failures = await registry!.checkCompatibility(TENANT_A, TYPE, {
      ...SCHEMA,
      required: ["name", "capacity", "code"],
      properties: { ...SCHEMA.properties, code: { type: "string" } },
    });
    expect(failures).toHaveLength(3);
    expect(failures.every(({ issues }) => issues.some(({ path }) => path === "$.code"))).toBe(true);
  });
});
