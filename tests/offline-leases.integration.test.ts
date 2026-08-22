import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService, HoldService } from "../src/contexts/inventory";
import { OperatorHttpApi } from "../src/http/operator";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type ConsumeBatchOptions,
  type ConsumeBatchResult,
  type EventBus,
  type EventHandler,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";
import { runReviewSeed, REVIEW_EMAIL } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_OFFLINE_LEASE_URL;
const PASSWORD = process.env.YELLOW_OFFLINE_LEASE_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OFFLINE_LEASE === "1";
const SECRET = "yellow-order-062-test-token-secret-exactly-long-enough";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000006291";
const TENANT_B = "00000000-0000-0000-0000-000000006292";
const FROM = "2047-01-10T12:00:00.000Z";
const TO = "2047-01-12T12:00:00.000Z";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_OFFLINE_LEASE_URL and YELLOW_OFFLINE_LEASE_PASSWORD are required by Order 062");
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let database: Database;
let tokens: Hs256TokenSigner;
let events: PostgresEventBus;
let holds: HoldService;
let app: ReturnType<typeof createApp>;
let accessToken = "";
let userId = "";
let sellables: Record<string, string> = {};

function headers(token = accessToken, key?: string): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(key ? { "idempotency-key": key } : {}),
  };
}

function request(target: ReturnType<typeof createApp>, path: string, init: RequestInit = {}): Promise<Response> {
  return target.handle(new Request(`http://yellow.test${path}`, init));
}

function leasePath(property = SEED_PROPERTY.id, suffix = ""): string {
  return `/api/v1/properties/${property}/offline-leases${suffix}`;
}

function leaseBody(
  sellableUnitId: string,
  from = FROM,
  to = TO,
  deviceId = "front-desk-tablet-01",
  deviceLabel = "Front desk tablet",
  leaseHours = 1,
) {
  return { sellableUnitId, from, to, deviceId, deviceLabel, leaseHours };
}

function place(
  body: unknown,
  key?: string,
  token = accessToken,
  target = app,
  property: string = SEED_PROPERTY.id,
): Promise<Response> {
  return request(target, leasePath(property), {
    method: "POST",
    headers: headers(token, key),
    body: JSON.stringify(body),
  });
}

function release(
  leaseId: string,
  key?: string,
  token = accessToken,
  target = app,
  property: string = SEED_PROPERTY.id,
): Promise<Response> {
  return request(target, leasePath(property, `/${leaseId}/release`), {
    method: "POST",
    headers: headers(token, key),
    body: "{}",
  });
}

function cartBody(sellableUnitId: string, from: string, to: string) {
  return { sellableUnitId, from, to, holderReference: "Order 062 separation" };
}

async function availability(from: string, to: string, sellableUnitId: string): Promise<number | undefined> {
  const response = await request(app, `/api/v1/properties/${SEED_PROPERTY.id}/availability:search`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ from, to, partySize: 1 }),
  });
  expect(response.status).toBe(200);
  const body = await response.json() as { options: Array<{ sellableUnitId: string; availableCount: number }> };
  return body.options.find((option) => option.sellableUnitId === sellableUnitId)?.availableCount;
}

class FailSecondPublishBus implements EventBus {
  #calls = 0;

  constructor(readonly delegate: EventBus) {}

  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    this.#calls += 1;
    if (this.#calls === 2) throw new Error("Order 062 injected second-publish failure");
    return this.delegate.publish(tx, event);
  }

  consumeBatch(consumer: string, handler: EventHandler, options?: ConsumeBatchOptions): Promise<ConsumeBatchResult> {
    return this.delegate.consumeBatch(consumer, handler, options);
  }
}

function makeApp(holdService: HoldService): ReturnType<typeof createApp> {
  return createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      new LocalLoginService(loginPool, tokens),
      new AvailabilityService(),
      undefined,
      new PostgresIdempotency(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      holdService,
    ),
  });
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  const review = await runReviewSeed({ databaseUrl: DATABASE_URL, password: PASSWORD, logger: () => undefined });
  userId = review.userId;
  admin = new SQL(DATABASE_URL, { max: 16 });
  loginPool = new SQL(DATABASE_URL, { max: 8 });
  eventPool = new SQL(DATABASE_URL, { max: 30 });
  database = Database.connect(DATABASE_URL, { maxConnections: 40 });
  tokens = new Hs256TokenSigner(SECRET);
  events = new PostgresEventBus(eventPool);
  holds = new HoldService(events);
  app = makeApp(holds);
  const rows = await admin<Array<{ id: string; name: string }>>`
    SELECT id, name FROM sellable_unit WHERE tenant_id=${SEED_TENANT.id}::uuid ORDER BY name
  `;
  sellables = Object.fromEntries(rows.map(({ name, id }) => [name, id]));
  const login = await request(app, "/api/v1/auth/local:login", {
    method: "POST",
    headers: headers(""),
    body: JSON.stringify({ tenant: SEED_TENANT.slug, email: REVIEW_EMAIL, password: PASSWORD }),
  });
  expect(login.status).toBe(200);
  accessToken = (await login.json() as { accessToken: string }).accessToken;
});

afterAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await database?.close();
  await eventPool?.close();
  await loginPool?.close();
  await admin?.close();
});

databaseDescribe("Order 062 operator-managed offline lease pool", () => {
  test("P1: explicit lease uses PostgreSQL expiry, occupancy, facts/events and truth", async () => {
    const sellable = sellables["Room 101"]!;
    expect(await availability(FROM, TO, sellable)).toBe(1);
    const empty = await request(app, leasePath(), { headers: headers() });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ offlineLeases: [] });

    const response = await place(leaseBody(sellable), "order062-p1-place");
    expect(response.status).toBe(201);
    const responseText = await response.text();
    const lease = (JSON.parse(responseText) as { offlineLease: {
      id: string; kind: string; holder: { device_id: string; device_label: string }; status: string;
    } }).offlineLease;
    expect(lease).toEqual(expect.objectContaining({
      kind: "offline_lease",
      holder: { device_id: "front-desk-tablet-01", device_label: "Front desk tablet" },
      status: "active",
    }));
    const replay = await place(leaseBody(sellable), "order062-p1-place");
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.text()).toBe(responseText);

    const evidence = await admin<Array<{
      kind: string; holder: Record<string, unknown>; ttl: number; claims: number; facts: number; events: number;
      kind_events: number; device_events: number;
    }>>`
      SELECT h.kind, h.holder, extract(epoch FROM h.expires_at-transaction_timestamp())::float8 AS ttl,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_kind='hold' AND slot_ref=h.id) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=h.id) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=h.id OR payload @> ${JSON.stringify({ hold_id: lease.id })}::text::jsonb) AS events,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=h.id AND payload @> '{"kind":"offline_lease"}'::jsonb) AS kind_events,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=h.id AND payload @> '{"device_id":"front-desk-tablet-01"}'::jsonb) AS device_events
      FROM hold h WHERE h.id=${lease.id}::uuid
    `;
    expect(evidence[0]).toEqual(expect.objectContaining({
      kind: "offline_lease",
      holder: { device_id: "front-desk-tablet-01", device_label: "Front desk tablet" },
      claims: 1,
      facts: 1,
      events: 2,
      kind_events: 1,
      device_events: 1,
    }));
    expect(evidence[0]!.ttl).toBeGreaterThan(3590);
    expect(evidence[0]!.ttl).toBeLessThanOrEqual(3600);
    expect(await availability(FROM, TO, sellable)).toBe(0);

    const released = await release(lease.id, "order062-p1-release");
    expect(released.status).toBe(200);
    const releasedText = await released.text();
    expect(JSON.parse(releasedText)).toEqual({ offlineLease: expect.objectContaining({ id: lease.id, status: "released" }) });
    const releaseReplay = await release(lease.id, "order062-p1-release");
    expect(releaseReplay.headers.get("idempotency-replayed")).toBe("true");
    expect(await releaseReplay.text()).toBe(releasedText);
    const after = await admin<Array<{ claims: number; facts: number; events: number }>>`
      SELECT (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=${lease.id}::uuid) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${lease.id}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${lease.id}::uuid
          OR payload @> ${JSON.stringify({ hold_id: lease.id })}::text::jsonb) AS events
    `;
    expect(after[0]).toEqual({ claims: 0, facts: 2, events: 4 });
    expect(await availability(FROM, TO, sellable)).toBe(1);
  });

  test("P2: cart and offline surfaces are disjoint while existing expiry handles leases", async () => {
    const cartFrom = "2047-02-10T12:00:00.000Z";
    const cartTo = "2047-02-12T12:00:00.000Z";
    const cartResponse = await request(app, `/api/v1/properties/${SEED_PROPERTY.id}/holds`, {
      method: "POST",
      headers: headers(accessToken, "order062-cart"),
      body: JSON.stringify(cartBody(sellables["Room 102"]!, cartFrom, cartTo)),
    });
    expect(cartResponse.status).toBe(201);
    const cart = (await cartResponse.json() as { hold: { id: string } }).hold;
    const offline = await place(
      leaseBody(sellables["Room 103"]!, "2047-02-20T12:00:00.000Z", "2047-02-22T12:00:00.000Z", "expiry-device"),
      "order062-expiry",
    );
    expect(offline.status).toBe(201);
    const lease = (await offline.json() as { offlineLease: { id: string } }).offlineLease;

    const cartList = await request(app, `/api/v1/properties/${SEED_PROPERTY.id}/holds`, { headers: headers() });
    const leaseList = await request(app, leasePath(), { headers: headers() });
    const carts = (await cartList.json() as { holds: Array<{ id: string }> }).holds;
    expect(carts.map(({ id }) => id)).toContain(cart.id);
    expect(carts.map(({ id }) => id)).not.toContain(lease.id);
    const leases = (await leaseList.json() as { offlineLeases: Array<{ id: string }> }).offlineLeases;
    expect(leases.map(({ id }) => id)).toContain(lease.id);
    expect(leases.map(({ id }) => id)).not.toContain(cart.id);

    expect((await request(app, `/api/v1/properties/${SEED_PROPERTY.id}/holds/${lease.id}/release`, {
      method: "POST", headers: headers(accessToken, "order062-cross-cart"), body: "{}",
    })).status).toBe(409);
    expect((await release(cart.id, "order062-cross-offline")).status).toBe(409);
    await admin`UPDATE hold SET expires_at=transaction_timestamp()-interval '1 second' WHERE id=${lease.id}::uuid`;
    const expired = await database.withTenantTransaction(SEED_TENANT.id, (tx) => holds.expireDue(tx, createAuditEnvelope({
      actorId: userId,
      tenantId: SEED_TENANT.id,
      propertyNode: SEED_PROPERTY.id,
      requestId: crypto.randomUUID(),
      operation: "hold.expired",
    }), 100));
    expect(expired).toEqual([expect.objectContaining({ id: lease.id, kind: "offline_lease", status: "expired" })]);
    const state = await admin<Array<{ status: string; claims: number; facts: number; events: number }>>`
      SELECT h.status,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=h.id) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=h.id) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=h.id OR payload @> ${JSON.stringify({ hold_id: lease.id })}::text::jsonb) AS events
      FROM hold h WHERE h.id=${lease.id}::uuid
    `;
    expect(state[0]).toEqual({ status: "expired", claims: 0, facts: 2, events: 4 });
    expect(await availability("2047-02-20T12:00:00.000Z", "2047-02-22T12:00:00.000Z", sellables["Room 103"]!)).toBe(1);
  });

  test("P3: twenty contenders yield one complete lease and nineteen artifact-free conflicts", async () => {
    const sellable = sellables["Room 201"]!;
    const from = "2047-03-10T12:00:00.000Z";
    const to = "2047-03-12T12:00:00.000Z";
    const before = await admin<Array<{ claims: number }>>`
      SELECT count(*)::int AS claims FROM api_idempotency
      WHERE operation='operator.inventory.offline_leases.place' AND response_status=201
    `;
    const responses = await Promise.all(Array.from({ length: 20 }, (_, index) => place(
      leaseBody(sellable, from, to, `race-device-${index}`, `Race device ${index}`),
      `order062-race-${index}`,
    )));
    expect(responses.filter(({ status }) => status === 201)).toHaveLength(1);
    expect(responses.filter(({ status }) => status === 409)).toHaveLength(19);
    const rows = await admin<Array<{ holds: number; occupancies: number; facts: number; events: number; claims: number }>>`
      SELECT
        (SELECT count(*)::int FROM hold WHERE kind='offline_lease' AND sellable_unit_id=${sellable}::uuid
          AND period && tstzrange(${from}::timestamptz,${to}::timestamptz,'[)')) AS holds,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_kind='hold'
          AND period && tstzrange(${from}::timestamptz,${to}::timestamptz,'[)')) AS occupancies,
        (SELECT count(*)::int FROM fact_log WHERE entity_type='hold' AND payload @> '{"kind":"offline_lease"}'::jsonb
          AND payload @> '{"period":{"from":"2047-03-10T12:00:00.000Z","to":"2047-03-12T12:00:00.000Z"}}'::jsonb) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_type='hold' AND event_type='hold.created'
          AND payload @> '{"kind":"offline_lease"}'::jsonb AND payload->>'sellable_unit_id'=${sellable}) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE operation='operator.inventory.offline_leases.place'
          AND response_status=201 AND request_hash IS NOT NULL) AS claims
    `;
    expect(rows[0]).toEqual({
      holds: 1,
      occupancies: 1,
      facts: 1,
      events: 1,
      claims: (before[0]?.claims ?? 0) + 1,
    });
  });

  test("P4: permissions, property, shape, duration and replay boundaries fail closed", async () => {
    const sellable = sellables["Room 202"]!;
    const base = leaseBody(sellable, "2047-04-10T12:00:00.000Z", "2047-04-12T12:00:00.000Z", "boundary-device");
    const before = await admin<Array<{ claims: number }>>`
      SELECT count(*)::int AS claims FROM api_idempotency
      WHERE operation='operator.inventory.offline_leases.place' AND response_status=201
    `;
    const readOnly = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["inventory.offline_leases:read"] });
    const writeOnly = await tokens.issue({ userId, tenantId: SEED_TENANT.id, scopes: ["inventory.offline_leases:write"] });
    const tenantB = await tokens.issue({ userId, tenantId: TENANT_B, scopes: ["inventory.offline_leases:read", "inventory.offline_leases:write"] });
    expect((await place(base, "order062-read-only", readOnly)).status).toBe(403);
    expect((await request(app, leasePath(), { headers: headers(writeOnly) })).status).toBe(403);
    expect((await place(base, "order062-foreign", accessToken, app, FOREIGN_PROPERTY)).status).toBe(403);
    expect((await request(app, leasePath(), { headers: headers(tenantB) })).status).toBe(403);
    expect((await place({ ...base, surprise: true }, "order062-unknown")).status).toBe(400);
    expect((await place(base)).status).toBe(400);
    expect((await place({ ...base, deviceId: "guest name with spaces" }, "order062-device")).status).toBe(400);
    expect((await place({ ...base, deviceLabel: "bad\u0000label" }, "order062-label")).status).toBe(400);
    for (const [value, key] of [[0, "zero"], [169, "large"], [1.5, "fraction"]] as const) {
      expect((await place({ ...base, leaseHours: value }, `order062-${key}`)).status).toBe(400);
    }
    expect((await place({ ...base, from: "2047-04-12T12:00:00.000Z" }, "order062-period")).status).toBe(400);

    const valid = await place(base, "order062-changed");
    expect(valid.status).toBe(201);
    expect((await place({ ...base, deviceLabel: "Changed" }, "order062-changed")).status).toBe(409);
    const counts = await admin<Array<{ holds: number; claims: number }>>`
      SELECT
        (SELECT count(*)::int FROM hold WHERE holder @> '{"device_id":"boundary-device"}'::jsonb) AS holds,
        (SELECT count(*)::int FROM api_idempotency WHERE operation='operator.inventory.offline_leases.place'
          AND response_status=201) AS claims
    `;
    expect(counts[0]).toEqual({ holds: 1, claims: (before[0]?.claims ?? 0) + 1 });
  });

  test("P5: event failure rolls lease placement/release and idempotency back before retry", async () => {
    const sellable = sellables["Room 101"]!;
    const body = leaseBody(sellable, "2047-05-10T12:00:00.000Z", "2047-05-12T12:00:00.000Z", "rollback-device");
    const failingPlace = makeApp(new HoldService(new FailSecondPublishBus(events)));
    expect((await place(body, "order062-fail-place", accessToken, failingPlace)).status).toBe(503);
    const rolled = await admin<Array<{ holds: number; claims: number; facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM hold WHERE holder @> '{"device_id":"rollback-device"}'::jsonb) AS holds,
        (SELECT count(*)::int FROM api_idempotency WHERE operation='operator.inventory.offline_leases.place'
          AND response_status IS NULL) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE payload @> '{"device_id":"rollback-device"}'::jsonb) AS facts,
        (SELECT count(*)::int FROM outbox WHERE payload @> '{"device_id":"rollback-device"}'::jsonb) AS events
    `;
    expect(rolled[0]).toEqual({ holds: 0, claims: 0, facts: 0, events: 0 });
    const repaired = await place(body, "order062-fail-place");
    expect(repaired.status).toBe(201);
    const leaseId = (await repaired.json() as { offlineLease: { id: string } }).offlineLease.id;
    const failingRelease = makeApp(new HoldService(new FailSecondPublishBus(events)));
    expect((await release(leaseId, "order062-fail-release", accessToken, failingRelease)).status).toBe(503);
    const active = await admin<Array<{ active: number; occupancies: number; facts: number; claims: number }>>`
      SELECT
        (SELECT count(*)::int FROM hold WHERE id=${leaseId}::uuid AND status='active') AS active,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=${leaseId}::uuid) AS occupancies,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${leaseId}::uuid) AS facts,
        (SELECT count(*)::int FROM api_idempotency WHERE operation='operator.inventory.offline_leases.release'
          AND response_status IS NULL) AS claims
    `;
    expect(active[0]).toEqual({ active: 1, occupancies: 1, facts: 1, claims: 0 });
    expect((await release(leaseId, "order062-fail-release")).status).toBe(200);
  });

  test("P6: exact local permissions and honest themed UI expose no offline shortcut", async () => {
    const permissions = await admin<Array<{ code: string }>>`
      SELECT permission.code FROM permission
      JOIN role_permission ON role_permission.permission_code=permission.code
      JOIN role ON role.id=role_permission.role_id
      WHERE role.tenant_id=${SEED_TENANT.id}::uuid AND role.name='Local Availability Reviewer'
      ORDER BY permission.code
    `;
    expect(permissions.map(({ code }) => code)).toEqual([
      "inventory.availability:read", "inventory.blocks:read", "inventory.blocks:write",
      "inventory.configuration:read", "inventory.configuration:write", "inventory.holds:read",
      "inventory.holds:write", "inventory.offline_leases:read", "inventory.offline_leases:write",
      "inventory.policy:read", "inventory.policy:write", "inventory.restriction:read",
      "inventory.restriction:write", "rates.configuration:read", "rates.configuration:write",
      "rates.pricing:read", "rates.pricing:write",
    ]);
    const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
    const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
    const css = await Bun.file(new URL("../src/http/operator/operator.css", import.meta.url)).text();
    expect(html).toContain("Offline capacity");
    expect(html).toContain("Reservation creation and offline synchronization are not implemented yet");
    expect(html).toMatch(/name="deviceId"[^>]+required/);
    expect(html).toMatch(/name="leaseHours"[^>]+min="1"[^>]+max="168"/);
    expect(script).toContain("loadOfflineLeases");
    expect(script).toContain("Prepare offline capacity");
    expect(script).not.toMatch(/localStorage|sessionStorage|indexedDB|space_occupancy|record_occupancy|release_occupancy/i);
    expect(script).not.toMatch(/offline-leases[^\n]*(?:consume|reservation)/i);
    expect(css).toContain("[data-theme=\"pixel\"]");
    expect(css).toContain("@media (max-width: 720px)");
  });
});
