import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService, HoldService } from "../src/contexts/inventory";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, PostgresEventBus, PostgresIdempotency,
  type ConsumeBatchOptions, type ConsumeBatchResult, type EventBus, type EventHandler,
  type OutboxEvent, type PublishEventInput, type Tx } from "../src/kernel";
import { runReviewSeed, REVIEW_EMAIL } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_OPERATOR_HOLD_URL;
const PASSWORD = process.env.YELLOW_OPERATOR_HOLD_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_HOLD === "1";
const SECRET = "yellow-order-055-test-token-secret-exactly-long-enough";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000005591";
const FROM = "2046-01-10T12:00:00.000Z";
const TO = "2046-01-12T12:00:00.000Z";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_OPERATOR_HOLD_URL and YELLOW_OPERATOR_HOLD_PASSWORD are required by Order 055");
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let database: Database;
let tokens: Hs256TokenSigner;
let events: PostgresEventBus;
let app: ReturnType<typeof createApp>;
let accessToken = "";
let userId = "";
let sellables: Record<string, string> = {};
let firstHold = "";

function headers(token = accessToken, key?: string): Record<string, string> {
  return { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(key ? { "idempotency-key": key } : {}) };
}

function request(target: ReturnType<typeof createApp>, path: string, init: RequestInit = {}): Promise<Response> {
  return target.handle(new Request(`http://yellow.test${path}`, init));
}

function holdsPath(property: string = SEED_PROPERTY.id, suffix = ""): string {
  return `/api/v1/properties/${property}/holds${suffix}`;
}

function body(sellableUnitId: string, from = FROM, to = TO, holderReference = "Founder walk-in") {
  return { sellableUnitId, from, to, holderReference };
}

function place(input: unknown, key?: string, token = accessToken, target = app,
  property: string = SEED_PROPERTY.id): Promise<Response> {
  return request(target, holdsPath(property), {
    method: "POST", headers: headers(token, key), body: JSON.stringify(input),
  });
}

function release(holdId: string, key?: string, token = accessToken, target = app,
  property = SEED_PROPERTY.id, input: unknown = {}): Promise<Response> {
  return request(target, holdsPath(property, `/${holdId}/release`), {
    method: "POST", headers: headers(token, key), body: JSON.stringify(input),
  });
}

async function availability(from = FROM, to = TO): Promise<Array<{ sellableUnitId: string; availableCount: number; bookable: boolean }>> {
  const response = await request(app, `/api/v1/properties/${SEED_PROPERTY.id}/availability:search`, {
    method: "POST", headers: headers(), body: JSON.stringify({ from, to, partySize: 1 }),
  });
  expect(response.status).toBe(200);
  return (await response.json() as { options: Array<{ sellableUnitId: string; availableCount: number; bookable: boolean }> }).options;
}

class FailSecondPublishBus implements EventBus {
  #calls = 0;
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    this.#calls += 1;
    if (this.#calls === 2) throw new Error("Order 055 injected second-publish failure");
    return this.delegate.publish(tx, event);
  }
  consumeBatch(consumer: string, handler: EventHandler, options?: ConsumeBatchOptions): Promise<ConsumeBatchResult> {
    return this.delegate.consumeBatch(consumer, handler, options);
  }
}

function makeApp(holds: HoldService): ReturnType<typeof createApp> {
  return createApp({ database, tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(new LocalLoginService(loginPool, tokens), new AvailabilityService(),
      undefined, new PostgresIdempotency(), undefined, undefined, undefined, undefined, undefined, holds) });
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  const review = await runReviewSeed({ databaseUrl: DATABASE_URL, password: PASSWORD, logger: () => undefined });
  userId = review.userId;
  admin = new SQL(DATABASE_URL, { max: 12 });
  loginPool = new SQL(DATABASE_URL, { max: 6 });
  eventPool = new SQL(DATABASE_URL, { max: 24 });
  database = Database.connect(DATABASE_URL, { maxConnections: 36 });
  tokens = new Hs256TokenSigner(SECRET);
  events = new PostgresEventBus(eventPool);
  app = makeApp(new HoldService(events));
  const rows = await admin<Array<{ id: string; name: string }>>`
    SELECT id, name FROM sellable_unit WHERE tenant_id=${SEED_TENANT.id}::uuid ORDER BY name
  `;
  sellables = Object.fromEntries(rows.map(({ name, id }) => [name, id]));
  const login = await request(app, "/api/v1/auth/local:login", { method: "POST", headers: headers(""),
    body: JSON.stringify({ tenant: SEED_TENANT.slug, email: REVIEW_EMAIL, password: PASSWORD }) });
  expect(login.status).toBe(200);
  accessToken = (await login.json() as { accessToken: string }).accessToken;
});

afterAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await database.close(); await eventPool.close(); await loginPool.close(); await admin.close();
});

databaseDescribe("Order 055 operator cart holds", () => {
  test("P1: active list is initially empty and creates no evidence", async () => {
    const before = await admin<Array<{ facts: number; events: number }>>`
      SELECT (SELECT count(*)::int FROM fact_log WHERE entity_type='hold') AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_type='hold') AS events
    `;
    const response = await request(app, holdsPath(), { headers: headers() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ holds: [] });
    const after = await admin<Array<{ facts: number; events: number }>>`
      SELECT (SELECT count(*)::int FROM fact_log WHERE entity_type='hold') AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_type='hold') AS events
    `;
    expect(after[0]).toEqual(before[0]);
  });

  test("P2: ten-minute placement is exact, durable, evidenced and changes one real option", async () => {
    const sellable = sellables["Room 101"]!;
    const before = (await availability()).find(({ sellableUnitId }) => sellableUnitId === sellable);
    expect(before).toEqual(expect.objectContaining({ availableCount: 1, bookable: true }));
    const response = await place(body(sellable), "order055-place");
    expect(response.status).toBe(201);
    const responseText = await response.text();
    const hold = (JSON.parse(responseText) as { hold: { id: string; holder: { reference: string }; status: string } }).hold;
    firstHold = hold.id;
    expect(hold).toEqual(expect.objectContaining({ holder: { reference: "Founder walk-in" }, status: "active" }));
    const replay = await place(body(sellable), "order055-place");
    expect(replay.status).toBe(201); expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.text()).toBe(responseText);
    const evidence = await admin<Array<{ ttl: number; claims: number; facts: number; events: number; durable: number }>>`
      SELECT extract(epoch FROM expires_at-transaction_timestamp())::float8 AS ttl,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_kind='hold' AND slot_ref=${firstHold}::uuid) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${firstHold}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${firstHold}::uuid
          OR payload @> ${JSON.stringify({ hold_id: firstHold })}::text::jsonb) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE operation='operator.inventory.holds.place'
          AND response_status=201) AS durable
      FROM hold WHERE id=${firstHold}::uuid
    `;
    expect(evidence[0]).toEqual(expect.objectContaining({ claims: 1, facts: 1, events: 2, durable: 1 }));
    expect(evidence[0]?.ttl).toBeGreaterThan(590); expect(evidence[0]?.ttl).toBeLessThanOrEqual(600);
    expect((await availability()).find(({ sellableUnitId }) => sellableUnitId === sellable)?.availableCount).toBe(0);
  });

  test("P3: changed replay conflicts and twenty placements have one winner without loser artifacts", async () => {
    expect((await place({ ...body(sellables["Room 101"]!), holderReference: "Changed" }, "order055-place")).status).toBe(409);
    const sellable = sellables["Room 102"]!;
    const from = "2046-02-10T12:00:00.000Z";
    const to = "2046-02-12T12:00:00.000Z";
    const before = await admin<Array<{ claims: number }>>`
      SELECT count(*)::int AS claims FROM api_idempotency WHERE operation='operator.inventory.holds.place'
    `;
    const responses = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      place(body(sellable, from, to, `Race ${index}`), `order055-race-${index}`)));
    expect(responses.filter(({ status }) => status === 201)).toHaveLength(1);
    expect(responses.filter(({ status }) => status === 409)).toHaveLength(19);
    const rows = await admin<Array<{ holds: number; occupancies: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM hold WHERE sellable_unit_id=${sellable}::uuid
          AND period && tstzrange(${from}::timestamptz,${to}::timestamptz,'[)')) AS holds,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_kind='hold'
          AND period && tstzrange(${from}::timestamptz,${to}::timestamptz,'[)')) AS occupancies,
        (SELECT count(*)::int FROM api_idempotency WHERE operation='operator.inventory.holds.place') AS claims
    `;
    expect(rows[0]).toEqual({ holds: 1, occupancies: 1, claims: (before[0]?.claims ?? 0) + 1 });
  });

  test("P4: release is replayable, exact, disappears and restores availability", async () => {
    const response = await release(firstHold, "order055-release");
    expect(response.status).toBe(200);
    const responseText = await response.text();
    expect(JSON.parse(responseText)).toEqual({ hold: expect.objectContaining({ id: firstHold, status: "released" }) });
    const replay = await release(firstHold, "order055-release");
    expect(replay.status).toBe(200); expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.text()).toBe(responseText);
    const rows = await admin<Array<{ claims: number; facts: number; events: number }>>`
      SELECT (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=${firstHold}::uuid) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${firstHold}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${firstHold}::uuid
          OR payload @> ${JSON.stringify({ hold_id: firstHold })}::text::jsonb) AS events
    `;
    expect(rows[0]).toEqual({ claims: 0, facts: 2, events: 4 });
    const listed = await request(app, holdsPath(), { headers: headers() });
    expect((await listed.json() as { holds: Array<{ id: string }> }).holds.some(({ id }) => id === firstHold)).toBe(false);
    expect((await availability()).find(({ sellableUnitId }) => sellableUnitId === sellables["Room 101"])?.availableCount).toBe(1);
  });

  test("P5: malformed, unauthorized, foreign and repeated calls persist nothing", async () => {
    const before = await admin<Array<{ holds: number; occupancies: number; facts: number; events: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM hold) AS holds,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_kind='hold') AS occupancies,
        (SELECT count(*)::int FROM fact_log WHERE entity_type='hold') AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_type='hold') AS events,
        (SELECT count(*)::int FROM api_idempotency) AS claims
    `;
    const noScope = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["inventory.holds:read"] });
    expect((await place(body(sellables["Room 103"]!), "order055-no-scope", noScope)).status).toBe(403);
    expect((await place({ ...body(sellables["Room 103"]!), surprise: true }, "order055-unknown")).status).toBe(400);
    expect((await place(body(sellables["Room 103"]!), undefined)).status).toBe(400);
    expect((await place(body(sellables["Room 103"]!), "order055-foreign", accessToken, app, FOREIGN_PROPERTY)).status).toBe(403);
    expect((await release(firstHold, "order055-repeat")).status).toBe(409);
    const after = await admin<Array<{ holds: number; occupancies: number; facts: number; events: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM hold) AS holds,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_kind='hold') AS occupancies,
        (SELECT count(*)::int FROM fact_log WHERE entity_type='hold') AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_type='hold') AS events,
        (SELECT count(*)::int FROM api_idempotency) AS claims
    `;
    expect(after[0]).toEqual(before[0]);
  });

  test("P6: second-publish failures roll place and release back before same-key retry", async () => {
    const sellable = sellables["Room 103"]!;
    const placeBody = body(sellable, "2046-03-10T12:00:00.000Z", "2046-03-12T12:00:00.000Z", "Rollback");
    const failingPlace = makeApp(new HoldService(new FailSecondPublishBus(events)));
    expect((await place(placeBody, "order055-fail-place", accessToken, failingPlace)).status).toBe(503);
    const rolledPlace = await admin<Array<{ holds: number; occupancies: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM hold WHERE holder @> '{"reference":"Rollback"}'::jsonb) AS holds,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_kind='hold' AND period &&
          tstzrange('2046-03-10T12:00:00Z','2046-03-12T12:00:00Z','[)')) AS occupancies,
        (SELECT count(*)::int FROM api_idempotency WHERE operation='operator.inventory.holds.place'
          AND response_status IS NULL) AS claims
    `;
    expect(rolledPlace[0]).toEqual({ holds: 0, occupancies: 0, claims: 0 });
    const placed = await place(placeBody, "order055-fail-place");
    expect(placed.status).toBe(201);
    const holdId = (await placed.json() as { hold: { id: string } }).hold.id;
    const failingRelease = makeApp(new HoldService(new FailSecondPublishBus(events)));
    expect((await release(holdId, "order055-fail-release", accessToken, failingRelease)).status).toBe(503);
    const rolledRelease = await admin<Array<{ active: number; occupancies: number; facts: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM hold WHERE id=${holdId}::uuid AND status='active') AS active,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=${holdId}::uuid) AS occupancies,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${holdId}::uuid) AS facts,
        (SELECT count(*)::int FROM api_idempotency WHERE operation='operator.inventory.holds.release'
          AND response_status IS NULL) AS claims
    `;
    expect(rolledRelease[0]).toEqual({ active: 1, occupancies: 1, facts: 1, claims: 0 });
    expect((await release(holdId, "order055-fail-release")).status).toBe(200);
  });

  test("P7: typed temporary-hold UI and exact seventeen-scope role expose no occupancy shortcut", async () => {
    const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
    const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
    const css = await Bun.file(new URL("../src/http/operator/operator.css", import.meta.url)).text();
    expect(html).toContain("Active holds"); expect(html).toContain("not a reservation");
    expect(script).toContain("loadActiveHolds"); expect(script).toContain("Hold for 10 minutes");
    expect(script).not.toMatch(/localStorage|sessionStorage|indexedDB|space_occupancy|record_occupancy|release_occupancy|ttlSeconds/i);
    expect(script).not.toMatch(/expiresAt\s*:/i);
    expect(css).toContain("@media (max-width: 720px)");
    const permissions = await admin<Array<{ code: string }>>`
      SELECT permission.code FROM permission
      JOIN role_permission ON role_permission.permission_code=permission.code
      JOIN role ON role.id=role_permission.role_id WHERE role.tenant_id=${SEED_TENANT.id}::uuid
        AND role.name='Local Availability Reviewer' ORDER BY permission.code
    `;
    expect(permissions.map(({ code }) => code)).toEqual([
      "inventory.availability:read", "inventory.blocks:read", "inventory.blocks:write",
      "inventory.configuration:read", "inventory.configuration:write", "inventory.holds:read",
      "inventory.holds:write", "inventory.offline_leases:read", "inventory.offline_leases:write",
      "inventory.policy:read", "inventory.policy:write",
      "inventory.restriction:read", "inventory.restriction:write", "rates.configuration:read",
      "rates.configuration:write", "rates.pricing:read", "rates.pricing:write",
    ]);
  });
});
