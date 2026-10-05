import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService, InventoryService } from "../src/contexts/inventory";
import { OperatorHttpApi } from "../src/http/operator";
import {
  Database,
  type EventBus,
  type OutboxEvent,
  PostgresEventBus,
  PostgresIdempotency,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";
import { runReviewSeed } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_OPERATOR_IDEMPOTENCY_ACTOR_URL;
const PASSWORD = process.env.YELLOW_OPERATOR_IDEMPOTENCY_ACTOR_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_IDEMPOTENCY_ACTOR === "1";
const SECRET = "yellow-order-121-test-token-secret-exactly-long-enough";
const ACTOR_B = "00000000-0000-0000-0000-000000012122";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000012131";
const FOREIGN_ACTOR = "00000000-0000-0000-0000-000000012132";
const WRITE_SCOPE = "inventory.configuration:write";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error(
    "YELLOW_OPERATOR_IDEMPOTENCY_ACTOR_URL and YELLOW_OPERATOR_IDEMPOTENCY_ACTOR_PASSWORD are required by Order 121",
  );
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let database: Database;
let tokens: Hs256TokenSigner;
let app: ReturnType<typeof createApp>;
let actorA = "";
let tokenA = "";
let tokenB = "";

function suffix(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
}

function headers(token: string, key?: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
    ...(key ? { "idempotency-key": key } : {}),
    ...extra,
  };
}

function call(path: string, init: RequestInit = {}, target = app): Promise<Response> {
  return target.handle(new Request(`http://yellow.test${path}`, init));
}

function createUnitType(
  body: unknown,
  key: string,
  token = tokenA,
  pathSuffix = "",
  extraHeaders: Record<string, string> = {},
  target = app,
): Promise<Response> {
  return call(`/api/v1/properties/${SEED_PROPERTY.id}/inventory/unit-types${pathSuffix}`, {
    method: "POST",
    headers: headers(token, key, extraHeaders),
    body: JSON.stringify(body),
  }, target);
}

async function artifactCounts(entityId: string): Promise<{ facts: number; events: number }> {
  const rows = await admin<Array<{ facts: number; events: number }>>`
    SELECT
      (SELECT count(*)::int FROM fact_log WHERE entity_id = ${entityId}::uuid) AS facts,
      (SELECT count(*)::int FROM outbox WHERE aggregate_id = ${entityId}::uuid) AS events
  `;
  return rows[0]!;
}

class FailingEventBus implements EventBus {
  publish(_tx: Tx, _event: PublishEventInput): Promise<OutboxEvent> {
    throw new Error("Order 121 injected publisher failure with private detail");
  }

  consumeBatch(..._args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    throw new Error("not used by Order 121");
  }
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  const review = await runReviewSeed({
    databaseUrl: DATABASE_URL,
    password: PASSWORD,
    mode: "identity_inventory",
    logger: () => undefined,
  });
  actorA = review.userId;
  admin = new SQL(DATABASE_URL, { max: 4 });
  loginPool = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 4 });
  database = Database.connect(DATABASE_URL, { maxConnections: 12 });
  tokens = new Hs256TokenSigner(SECRET);
  const inventory = new InventoryService(new PostgresEventBus(eventPool));
  app = createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      new LocalLoginService(loginPool, tokens),
      new AvailabilityService(),
      inventory,
      new PostgresIdempotency(),
    ),
  });
  await admin`
    INSERT INTO app_user (id, tenant_id, email, display_name, status)
    VALUES (${ACTOR_B}::uuid, ${SEED_TENANT.id}::uuid, 'actor-b@order121.test', 'Order 121 Actor B', 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  await admin`
    INSERT INTO user_role (tenant_id, user_id, role_id, scope_node)
    SELECT ${SEED_TENANT.id}::uuid, ${ACTOR_B}::uuid, user_role.role_id, user_role.scope_node
    FROM user_role
    WHERE user_role.tenant_id = ${SEED_TENANT.id}::uuid
      AND user_role.user_id = ${actorA}::uuid
    ON CONFLICT DO NOTHING
  `;
  tokenA = await tokens.issue({ userId: actorA, tenantId: SEED_TENANT.id, scopes: [WRITE_SCOPE] });
  tokenB = await tokens.issue({ userId: ACTOR_B, tenantId: SEED_TENANT.id, scopes: [WRITE_SCOPE] });
});

afterAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await database.close();
  await eventPool.close();
  await loginPool.close();
  await admin.close();
});

databaseDescribe("Order 121 authenticated actor-bound operator idempotency", () => {
  test("P0/P1: the same actor replays while another authorized actor conflicts without new artifacts", async () => {
    const code = `A${suffix()}`;
    const key = `order121-two-actor-${crypto.randomUUID()}`;
    const body = {
      code,
      name: "Order 121 Two Actor Proof",
      profileKey: "hotel",
      baseOccupancy: 1,
      maxOccupancy: 2,
      sortOrder: 121,
    };

    const first = await createUnitType(body, key, tokenA);
    expect(first.status).toBe(201);
    expect(first.headers.get("idempotency-replayed")).toBe("false");
    const created = await first.json() as { id: string };
    const claimBefore = await admin<Array<{ request_hash: string }>>`
      SELECT request_hash FROM api_idempotency
      WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND operation = 'operator.inventory.unit_type.create'
        AND key_hash = encode(digest(${key}, 'sha256'), 'hex')
    `;
    expect(claimBefore).toHaveLength(1);
    expect(claimBefore[0]?.request_hash).toMatch(/^[0-9a-f]{64}$/);

    const replay = await createUnitType(body, key, tokenA);
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.json()).toEqual(created);
    expect(await artifactCounts(created.id)).toEqual({ facts: 1, events: 1 });

    const otherActor = await createUnitType(body, key, tokenB);
    const otherActorBody = await otherActor.json() as { type?: string };
    const claimAfter = await admin<Array<{ request_hash: string }>>`
      SELECT request_hash FROM api_idempotency
      WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND operation = 'operator.inventory.unit_type.create'
        AND key_hash = encode(digest(${key}, 'sha256'), 'hex')
    `;
    const domainRows = await admin<Array<{ rows: number }>>`
      SELECT count(*)::int AS rows FROM unit_type
      WHERE tenant_id = ${SEED_TENANT.id}::uuid AND code = ${code}
    `;
    expect(otherActor.status).toBe(409);
    expect(otherActor.headers.get("idempotency-replayed")).toBeNull();
    expect(otherActorBody.type).toBe("request/idempotency_conflict");
    expect(claimAfter).toEqual(claimBefore);
    expect(domainRows[0]?.rows).toBe(1);
    expect(await artifactCounts(created.id)).toEqual({ facts: 1, events: 1 });

    const originalStillReplays = await createUnitType(body, key, tokenA);
    expect(originalStillReplays.status).toBe(201);
    expect(originalStillReplays.headers.get("idempotency-replayed")).toBe("true");
    expect(await originalStillReplays.json()).toEqual(created);
  });

  test("P2: changed content conflicts and caller-selected actor fields cannot control the hash", async () => {
    const code = `I${suffix()}`;
    const key = `order121-injection-${crypto.randomUUID()}`;
    const body = { code, name: "Order 121 Identity Source", profileKey: "hotel" };
    const injected = await createUnitType(
      body,
      key,
      tokenA,
      `?actorId=${ACTOR_B}`,
      { "x-actor-id": ACTOR_B, "x-yellow-actor-id": ACTOR_B },
    );
    expect(injected.status).toBe(201);

    const attacker = await createUnitType(body, key, tokenB);
    expect(attacker.status).toBe(409);
    expect((await attacker.json() as { type: string }).type).toBe("request/idempotency_conflict");

    const changed = await createUnitType({ ...body, name: "Changed" }, key, tokenA);
    expect(changed.status).toBe(409);
    expect((await changed.json() as { type: string }).type).toBe("request/idempotency_conflict");

    const bodyInjectionKey = `order121-body-injection-${crypto.randomUUID()}`;
    const bodyInjection = await createUnitType({ ...body, code: `B${suffix()}`, actorId: ACTOR_B }, bodyInjectionKey, tokenA);
    expect(bodyInjection.status).toBe(400);
    const claims = await admin<Array<{ rows: number }>>`
      SELECT count(*)::int AS rows FROM api_idempotency
      WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND operation = 'operator.inventory.unit_type.create'
        AND key_hash = encode(digest(${bodyInjectionKey}, 'sha256'), 'hex')
    `;
    expect(claims[0]?.rows).toBe(0);
  });

  test("P3: a foreign tenant cannot claim against or observe the authorized property", async () => {
    const token = await tokens.issue({ userId: FOREIGN_ACTOR, tenantId: FOREIGN_TENANT, scopes: [WRITE_SCOPE] });
    const key = `order121-foreign-${crypto.randomUUID()}`;
    const response = await createUnitType(
      { code: `F${suffix()}`, name: "Foreign", profileKey: "hotel" },
      key,
      token,
    );
    expect(response.status).toBe(403);
    const claims = await admin<Array<{ rows: number }>>`
      SELECT count(*)::int AS rows FROM api_idempotency
      WHERE tenant_id = ${FOREIGN_TENANT}::uuid
    `;
    expect(claims[0]?.rows).toBe(0);
  });

  test("P4: publisher failure rolls mutation, evidence, and idempotency back before retry", async () => {
    const failingInventory = new InventoryService(new FailingEventBus());
    const failing = createApp({
      database,
      tenantResolver: new BearerTenantResolver(tokens),
      operatorApi: new OperatorHttpApi(
        new LocalLoginService(loginPool, tokens),
        new AvailabilityService(),
        failingInventory,
        new PostgresIdempotency(),
      ),
    });
    const code = `R${suffix()}`;
    const key = `order121-rollback-${crypto.randomUUID()}`;
    const body = { code, profileKey: "hotel", capacity: 1 };
    const path = `/api/v1/properties/${SEED_PROPERTY.id}/inventory/spaces`;
    const failed = await call(path, {
      method: "POST",
      headers: headers(tokenA, key),
      body: JSON.stringify(body),
    }, failing);
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("private detail");
    expect(await admin`SELECT id FROM space WHERE tenant_id = ${SEED_TENANT.id}::uuid AND code = ${code}`).toHaveLength(0);
    const failedClaims = await admin<Array<{ rows: number }>>`
      SELECT count(*)::int AS rows FROM api_idempotency
      WHERE tenant_id = ${SEED_TENANT.id}::uuid
        AND operation = 'operator.inventory.space.create'
        AND key_hash = encode(digest(${key}, 'sha256'), 'hex')
    `;
    expect(failedClaims[0]?.rows).toBe(0);

    const retry = await call(path, {
      method: "POST",
      headers: headers(tokenA, key),
      body: JSON.stringify(body),
    });
    expect(retry.status).toBe(201);
    expect(retry.headers.get("idempotency-replayed")).toBe("false");
    const created = await retry.json() as { id: string };
    expect(await artifactCounts(created.id)).toEqual({ facts: 1, events: 1 });
  });
});

describe("Order 121 direct operator idempotency coverage", () => {
  test("P5: every direct PostgresIdempotency call hashes the authenticated actor", async () => {
    const source = await Bun.file(new URL("../src/http/operator.ts", import.meta.url)).text();
    const directCalls = [...source.matchAll(/this\.#idempotency\.execute\(context\.tx,/g)];
    const capturedInputs = [...source.matchAll(
      /this\.#idempotency\.execute\(context\.tx,\s*(\{[\s\S]*?\})\s*,\s*async\s*\(tx\)/g,
    )].map((match) => match[1] ?? "");
    expect(directCalls).toHaveLength(16);
    expect(capturedInputs).toHaveLength(directCalls.length);
    for (const input of capturedInputs) {
      expect(input).toContain("request: { actorId: context.identity.actorId,");
    }
    expect(capturedInputs.some((input) => input.includes("operation: idempotencyOperation"))).toBe(true);
    expect(capturedInputs.some((input) => input.includes('operation: "operator.inventory.rooms.bulk"'))).toBe(true);
    expect(capturedInputs.some((input) => input.includes('operation: "operator.rates.price.create"'))).toBe(true);
  });
});
