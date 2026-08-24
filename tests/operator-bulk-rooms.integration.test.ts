import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService, InventoryService } from "../src/contexts/inventory";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, PostgresEventBus, PostgresIdempotency } from "../src/kernel";
import { runReviewSeed, REVIEW_EMAIL } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";
import { BROWSER_SQL_SYNTAX } from "./helpers/browser-asset-security";

const DATABASE_URL = process.env.YELLOW_OPERATOR_BULK_ROOMS_URL;
const PASSWORD = process.env.YELLOW_OPERATOR_BULK_ROOMS_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_BULK_ROOMS === "1";
const SECRET = "yellow-order-057-test-token-secret-exactly-long-enough";
const NON_HOTEL_TYPE = "00000000-0000-0000-0000-000000005700";
const FOREIGN_TYPE = "00000000-0000-0000-0000-000000005701";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_OPERATOR_BULK_ROOMS_URL and YELLOW_OPERATOR_BULK_ROOMS_PASSWORD are required by Order 057");
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let database: Database;
let tokens: Hs256TokenSigner;
let app: ReturnType<typeof createApp>;
let accessToken = "";
let userId = "";
let roomTypeId = "";
let roomTypeMaxOccupancy = 0;

type CreatedRoom = {
  readonly space: { readonly id: string; readonly code: string; readonly profileKey: string;
    readonly capacity: number; readonly maxOccupancy: number | null; readonly floor: string | null };
  readonly sellableUnit: { readonly id: string; readonly name: string; readonly unitTypeId: string;
    readonly spaces: readonly { readonly spaceId: string; readonly code: string; readonly claimMode: string }[] };
};

function headers(token = accessToken, key?: string, correlation?: string): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(key ? { "idempotency-key": key } : {}),
    ...(correlation ? { "x-correlation-id": correlation } : {}),
  };
}

function path(property: string = SEED_PROPERTY.id): string {
  return `/api/v1/properties/${property}/inventory/rooms:bulk`;
}

function request(url: string, init: RequestInit = {}): Promise<Response> {
  return app.handle(new Request(`http://yellow.test${url}`, init));
}

function post(body: unknown, key?: string, token = accessToken, property: string = SEED_PROPERTY.id,
  correlation?: string): Promise<Response> {
  return request(path(property), {
    method: "POST", headers: headers(token, key, correlation), body: JSON.stringify(body),
  });
}

function explicitRooms(prefix: string, count: number): Array<{ code: string; name: string; floor: string }> {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(3, "0");
    return { code: `${prefix}-${number}`, name: `Room ${prefix}-${number}`, floor: prefix.slice(-2) };
  });
}

async function prefixCounts(prefix: string): Promise<{ spaces: number; sellables: number; facts: number; events: number }> {
  const rows = await admin<Array<{ spaces: number; sellables: number; facts: number; events: number }>>`
    WITH target_spaces AS (
      SELECT id FROM space WHERE tenant_id = ${SEED_TENANT.id}::uuid AND code LIKE ${`${prefix}%`}
    ), target_sellables AS (
      SELECT su.id FROM sellable_unit su
      WHERE su.tenant_id = ${SEED_TENANT.id}::uuid AND su.name LIKE ${`Room ${prefix}%`}
    ), target_ids AS (
      SELECT id FROM target_spaces UNION ALL SELECT id FROM target_sellables
    )
    SELECT
      (SELECT count(*)::int FROM target_spaces) AS spaces,
      (SELECT count(*)::int FROM target_sellables) AS sellables,
      (SELECT count(*)::int FROM fact_log WHERE entity_id IN (SELECT id FROM target_ids)) AS facts,
      (SELECT count(*)::int FROM outbox WHERE aggregate_id IN (SELECT id FROM target_ids)) AS events
  `;
  return rows[0]!;
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  const review = await runReviewSeed({ databaseUrl: DATABASE_URL, password: PASSWORD, logger: () => undefined });
  userId = review.userId;
  admin = new SQL(DATABASE_URL, { max: 4 });
  loginPool = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 4 });
  database = Database.connect(DATABASE_URL, { maxConnections: 16 });
  tokens = new Hs256TokenSigner(SECRET);
  const inventory = new InventoryService(new PostgresEventBus(eventPool));
  app = createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      new LocalLoginService(loginPool, tokens), new AvailabilityService(), inventory, new PostgresIdempotency(),
    ),
  });
  const snapshot = await request(`/api/v1/properties/${SEED_PROPERTY.id}/inventory`, {
    headers: headers(await tokens.issue({ userId, tenantId: SEED_TENANT.id,
      scopes: ["inventory.configuration:read", "inventory.configuration:write"] })),
  });
  expect(snapshot.status).toBe(200);
  const body = await snapshot.json() as { unitTypes: Array<{ id: string; code: string; maxOccupancy: number }> };
  const roomType = body.unitTypes.find(({ code }) => code === "DLX");
  roomTypeId = roomType?.id ?? "";
  roomTypeMaxOccupancy = roomType?.maxOccupancy ?? 0;
  expect(roomTypeId).toMatch(/^[0-9a-f-]{36}$/);
  expect(roomTypeMaxOccupancy).toBeGreaterThan(0);
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, max_occupancy, sort_order)
    VALUES (${NON_HOTEL_TYPE}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid,
            'O57P', 'Order 057 Parking', 'parking', 1, 570)
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, max_occupancy, sort_order)
    SELECT ${FOREIGN_TYPE}::uuid, tenant_id, id, 'O57F', 'Order 057 Foreign', 'hotel', 2, 571
    FROM org_node
    WHERE tenant_id = ${SEED_TENANT.id}::uuid AND kind = 'property' AND id <> ${SEED_PROPERTY.id}::uuid
    ORDER BY id LIMIT 1
  `;
  const login = await request("/api/v1/auth/local:login", {
    method: "POST", headers: headers(""),
    body: JSON.stringify({ tenant: SEED_TENANT.slug, email: REVIEW_EMAIL, password: PASSWORD }),
  });
  expect(login.status).toBe(200);
  accessToken = (await login.json() as { accessToken: string }).accessToken;
});

afterAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await database.close();
  await eventPool.close();
  await loginPool.close();
  await admin.close();
});

databaseDescribe("Order 057 operator bulk exclusive-room creation", () => {
  test("P1/P2: boundaries create exact audited exclusive room pairs in request order", async () => {
    const correlation = "00000000-0000-0000-0000-000000005702";
    const batches = [
      { prefix: "O57A", rooms: explicitRooms("O57A", 1) },
      { prefix: "O57B", rooms: explicitRooms("O57B", 2) },
      { prefix: "O57C", rooms: explicitRooms("O57C", 200) },
    ];
    for (const batch of batches) {
      const response = await post({ unitTypeId: roomTypeId, rooms: batch.rooms },
        `order057-${batch.prefix}`, accessToken, SEED_PROPERTY.id, correlation);
      expect(response.status).toBe(201);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-correlation-id")).toBe(correlation);
      expect(response.headers.get("idempotency-replayed")).toBe("false");
      const body = await response.json() as { rooms: CreatedRoom[] };
      expect(body.rooms.map(({ space }) => space.code)).toEqual(batch.rooms.map(({ code }) => code));
      for (const [index, created] of body.rooms.entries()) {
        expect(created.space).toMatchObject({
          code: batch.rooms[index]!.code, profileKey: "hotel", capacity: 1,
          maxOccupancy: roomTypeMaxOccupancy, floor: batch.rooms[index]!.floor,
        });
        expect(created.sellableUnit).toMatchObject({
          name: batch.rooms[index]!.name, unitTypeId: roomTypeId,
          spaces: [{ spaceId: created.space.id, code: created.space.code, claimMode: "exclusive" }],
        });
      }
      expect(await prefixCounts(batch.prefix)).toEqual({
        spaces: batch.rooms.length, sellables: batch.rooms.length,
        facts: batch.rooms.length * 2, events: batch.rooms.length * 2,
      });
      const evidence = await admin<Array<{ fact_types: string[]; event_types: string[];
        request_ids: string[]; correlations: string[] }>>`
        WITH target AS (
          SELECT id FROM space WHERE tenant_id = ${SEED_TENANT.id}::uuid AND code LIKE ${`${batch.prefix}%`}
          UNION ALL
          SELECT id FROM sellable_unit WHERE tenant_id = ${SEED_TENANT.id}::uuid AND name LIKE ${`Room ${batch.prefix}%`}
        )
        SELECT
          ARRAY(SELECT DISTINCT fact_type FROM fact_log WHERE entity_id IN (SELECT id FROM target) ORDER BY fact_type) AS fact_types,
          ARRAY(SELECT DISTINCT event_type FROM outbox WHERE aggregate_id IN (SELECT id FROM target) ORDER BY event_type) AS event_types,
          ARRAY(SELECT DISTINCT payload->>'request_id' FROM fact_log WHERE entity_id IN (SELECT id FROM target) ORDER BY payload->>'request_id') AS request_ids,
          ARRAY(SELECT DISTINCT correlation_id::text FROM outbox WHERE aggregate_id IN (SELECT id FROM target) ORDER BY correlation_id::text) AS correlations
      `;
      expect(evidence[0]).toEqual({
        fact_types: ["sellable_unit.created", "space.created"],
        event_types: ["sellable_unit.created", "space.created"],
        request_ids: [correlation], correlations: [correlation],
      });
    }
  }, 30_000);

  test("P3: replay is exact and concurrent same-key calls create one batch", async () => {
    const body = { unitTypeId: roomTypeId, rooms: explicitRooms("O57R", 2) };
    const first = await post(body, "order057-replay");
    const firstText = await first.text();
    expect(first.status).toBe(201);
    const replay = await post(body, "order057-replay");
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.text()).toBe(firstText);
    expect((await post({ ...body, rooms: explicitRooms("O57X", 1) }, "order057-replay")).status).toBe(409);
    expect(await prefixCounts("O57R")).toEqual({ spaces: 2, sellables: 2, facts: 4, events: 4 });

    const concurrentBody = { unitTypeId: roomTypeId, rooms: explicitRooms("O57Q", 2) };
    const responses = await Promise.all([
      post(concurrentBody, "order057-concurrent"), post(concurrentBody, "order057-concurrent"),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    expect(responses.map((response) => response.headers.get("idempotency-replayed")).sort()).toEqual(["false", "true"]);
    expect(await prefixCounts("O57Q")).toEqual({ spaces: 2, sellables: 2, facts: 4, events: 4 });
  });

  test("P4: any invalid item, profile, authority or key rolls the complete batch back", async () => {
    const invalid = await post({ unitTypeId: roomTypeId, rooms: [
      ...explicitRooms("O57I", 1), { code: " invalid ", name: "Bad room" },
    ] }, "order057-invalid-item");
    expect(invalid.status).toBe(400);
    expect(await prefixCounts("O57I")).toEqual({ spaces: 0, sellables: 0, facts: 0, events: 0 });

    const duplicate = await post({ unitTypeId: roomTypeId, rooms: [
      { code: "O57D-1", name: "Room O57D-1" }, { code: "O57D-1", name: "Room duplicate" },
    ] }, "order057-duplicate");
    expect(duplicate.status).toBe(400);
    expect(await prefixCounts("O57D")).toEqual({ spaces: 0, sellables: 0, facts: 0, events: 0 });

    expect((await post({ unitTypeId: NON_HOTEL_TYPE, rooms: explicitRooms("O57P", 1) }, "order057-profile")).status).toBe(400);
    expect((await post({ unitTypeId: FOREIGN_TYPE, rooms: explicitRooms("O57F", 1) }, "order057-foreign-type")).status).toBe(404);
    expect((await post({ unitTypeId: roomTypeId, rooms: explicitRooms("O57K", 1) })).status).toBe(400);
    const noScope = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["inventory.configuration:read"] });
    expect((await post({ unitTypeId: roomTypeId, rooms: explicitRooms("O57S", 1) }, "order057-scope", noScope)).status).toBe(403);
    for (const prefix of ["O57P", "O57F", "O57K", "O57S"]) {
      expect(await prefixCounts(prefix)).toEqual({ spaces: 0, sellables: 0, facts: 0, events: 0 });
    }
  });

  test("P4: publisher failure rolls every artifact back and a clean retry succeeds", async () => {
    const failingInventory = new InventoryService({
      async publish(): Promise<never> { throw new Error("publisher unavailable with secret-order057-detail"); },
      async consumeBatch(): Promise<never> { throw new Error("not used"); },
    });
    const failing = createApp({
      database, tenantResolver: new BearerTenantResolver(tokens),
      operatorApi: new OperatorHttpApi(
        new LocalLoginService(loginPool, tokens), new AvailabilityService(), failingInventory, new PostgresIdempotency(),
      ),
    });
    const body = { unitTypeId: roomTypeId, rooms: explicitRooms("O57E", 2) };
    const idempotencyBefore = await admin<Array<{ rows: number }>>`
      SELECT count(*)::int AS rows FROM api_idempotency
      WHERE tenant_id = ${SEED_TENANT.id}::uuid AND operation = 'operator.inventory.rooms.bulk'
    `;
    const failed = await failing.handle(new Request(`http://yellow.test${path()}`, {
      method: "POST", headers: headers(accessToken, "order057-publisher"), body: JSON.stringify(body),
    }));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("secret-order057-detail");
    expect(await prefixCounts("O57E")).toEqual({ spaces: 0, sellables: 0, facts: 0, events: 0 });
    const idempotencyAfter = await admin<Array<{ rows: number }>>`
      SELECT count(*)::int AS rows FROM api_idempotency
      WHERE tenant_id = ${SEED_TENANT.id}::uuid AND operation = 'operator.inventory.rooms.bulk'
    `;
    expect(idempotencyAfter).toEqual(idempotencyBefore);

    const retry = await post(body, "order057-publisher");
    expect(retry.status).toBe(201);
    expect(retry.headers.get("idempotency-replayed")).toBe("false");
    expect(await prefixCounts("O57E")).toEqual({ spaces: 2, sellables: 2, facts: 4, events: 4 });
  });

  test("P5: strict boundaries and malformed bodies fail closed", async () => {
    const cases: unknown[] = [
      {}, { unitTypeId: roomTypeId, rooms: [] },
      { unitTypeId: roomTypeId, rooms: explicitRooms("O57Z", 201) },
      { unitTypeId: "not-a-uuid", rooms: explicitRooms("O57Z", 1) },
      { unitTypeId: roomTypeId, rooms: [{ code: "O57Z-1", extra: true }] },
      { unitTypeId: roomTypeId, rooms: [{ code: "O57Z-1", name: "" }] },
      { unitTypeId: roomTypeId, rooms: [{ code: "O57Z-1", floor: " floor " }] },
      { unitTypeId: roomTypeId, rooms: explicitRooms("O57Z", 1), surprise: true },
    ];
    for (const [index, body] of cases.entries()) {
      const response = await post(body, `order057-boundary-${index}`);
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual(expect.objectContaining({ type: "request/invalid", status: 400 }));
    }
    expect(await prefixCounts("O57Z")).toEqual({ spaces: 0, sellables: 0, facts: 0, events: 0 });
    expect((await post({ unitTypeId: roomTypeId, rooms: explicitRooms("O57M", 1) }, "order057-malformed-property",
      accessToken, "not-a-uuid")).status).toBe(400);
  });

  test("P6/P7: one accessible themed workbench previews explicit range and pasted lists", async () => {
    const html = await (await request("/")).text();
    const css = await (await request("/assets/operator.css")).text();
    const js = await (await request("/assets/operator.js")).text();
    expect(html).toContain('id="bulk-room-form"');
    expect(html).toContain('id="bulk-room-preview"');
    expect(html).toContain('id="bulk-room-mode"');
    expect(html).toContain('aria-live="polite"');
    expect(css).toContain(':root[data-theme="pixel"]');
    expect(css).toContain(".bulk-room-preview");
    expect(js).toContain('"rooms:bulk"');
    expect(js).toContain("Array.from");
    expect(js).toContain("padStart");
    expect(js).toContain("new Set");
    expect(js).toContain("crypto.randomUUID()");
    expect(js).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    expect(js).not.toMatch(BROWSER_SQL_SYNTAX);
    expect(js).not.toMatch(/postgres(?:ql)?:\/\//i);
  });
});
