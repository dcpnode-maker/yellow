import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, hashLocalPassword, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import { ReservationGuestService } from "../src/contexts/reservations";
import { OperatorHttpApi } from "../src/http/operator";
import {
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_OPERATOR_RESERVATION_GUESTS_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_RESERVATION_GUESTS === "1";
const SECRET = "yellow-order-096-test-token-secret-exactly-long-enough";
const TENANT = "00000000-0000-0000-0000-000000009601";
const PROPERTY = "00000000-0000-0000-0000-000000009611";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000009612";
const USER = "00000000-0000-0000-0000-000000009621";
const READ_USER = "00000000-0000-0000-0000-000000009622";
const ROLE = "00000000-0000-0000-0000-000000009623";
const READ_ROLE = "00000000-0000-0000-0000-000000009624";
const PRIMARY = "00000000-0000-0000-0000-000000009631";
const SHARER = "00000000-0000-0000-0000-000000009632";
const RESERVATION = "00000000-0000-0000-0000-000000009641";
const TERMINAL_RESERVATION = "00000000-0000-0000-0000-000000009642";

if (REQUIRE_DATABASE && !DATABASE_URL) throw new Error("Order 096 database URL is required");
const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let loginPool: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let app: ReturnType<typeof createApp>;
let failingApp: ReturnType<typeof createApp>;
let writeToken = "";
let readToken = "";

function headers(token: string, key?: string): HeadersInit {
  return { "content-type": "application/json", authorization: `Bearer ${token}`,
    ...(key ? { "idempotency-key": key } : {}) };
}

function call(path: string, init: RequestInit = {}, target = app) {
  return target.handle(new Request(`http://yellow.test${path}`, init));
}

class FailingEventBus implements EventBus {
  constructor(readonly delegate: EventBus) {}
  publish(_tx: Tx, _event: PublishEventInput): Promise<OutboxEvent> {
    throw new Error("Order 096 injected reservation.modified publication failure");
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

async function cleanup() {
  if (!admin) return;
  await admin`DELETE FROM api_idempotency WHERE tenant_id = ${TENANT}::uuid`;
  await admin`DELETE FROM outbox WHERE tenant_id = ${TENANT}::uuid`;
  await admin`DELETE FROM fact_log WHERE tenant_id = ${TENANT}::uuid`;
  await admin`DELETE FROM reservation_guest WHERE tenant_id = ${TENANT}::uuid`;
  await admin`DELETE FROM reservation WHERE tenant_id = ${TENANT}::uuid`;
  await admin`DELETE FROM user_role WHERE tenant_id = ${TENANT}::uuid`;
  await admin`DELETE FROM role_permission WHERE role_id IN (${ROLE}::uuid, ${READ_ROLE}::uuid)`;
  await admin`DELETE FROM role WHERE id IN (${ROLE}::uuid, ${READ_ROLE}::uuid)`;
  await admin`DELETE FROM app_user WHERE id IN (${USER}::uuid, ${READ_USER}::uuid)`;
  await admin`DELETE FROM party WHERE tenant_id = ${TENANT}::uuid`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY}::uuid, ${OTHER_PROPERTY}::uuid)`;
  await admin`DELETE FROM tenant WHERE id = ${TENANT}::uuid`;
  await admin`DELETE FROM permission WHERE code IN ('reservations.guests:read', 'reservations.guests:write')`;
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 8 });
  loginPool = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 8 });
  database = Database.connect(DATABASE_URL, { maxConnections: 12 });
  const tokens = new Hs256TokenSigner(SECRET);
  const events = new PostgresEventBus(eventPool);
  const guests = new ReservationGuestService({ events, idempotency: new PostgresIdempotency() });
  app = createApp({ database, tenantResolver: new BearerTenantResolver(tokens), operatorApi: new OperatorHttpApi(
    new LocalLoginService(loginPool, tokens), new AvailabilityService(), undefined, new PostgresIdempotency(),
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, guests,
  ) });
  const failingGuests = new ReservationGuestService({ events: new FailingEventBus(events), idempotency: new PostgresIdempotency() });
  failingApp = createApp({ database, tenantResolver: new BearerTenantResolver(tokens), operatorApi: new OperatorHttpApi(
    new LocalLoginService(loginPool, tokens), new AvailabilityService(), undefined, new PostgresIdempotency(),
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, failingGuests,
  ) });
  await cleanup();
  const auth = JSON.stringify(await hashLocalPassword("order096-correct-password"));
  await admin`INSERT INTO permission (code, description) VALUES
    ('reservations.guests:read', 'Read reservation guests'),
    ('reservations.guests:write', 'Write reservation guests')`;
  await admin`INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${TENANT}::uuid, 'order096', 'Order 096', 'shared', 'active')`;
  await admin`INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency) VALUES
    (${PROPERTY}::uuid, ${TENANT}::uuid, 'order096.one', 'property', 'Order 096 One', 'UTC', 'USD'),
    (${OTHER_PROPERTY}::uuid, ${TENANT}::uuid, 'order096.two', 'property', 'Order 096 Two', 'UTC', 'USD')`;
  await admin`INSERT INTO app_user (id, tenant_id, email, display_name, auth, status) VALUES
    (${USER}::uuid, ${TENANT}::uuid, 'write@order096.test', 'Write Operator', ${auth}::text::jsonb, 'active'),
    (${READ_USER}::uuid, ${TENANT}::uuid, 'read@order096.test', 'Read Operator', ${auth}::text::jsonb, 'active')`;
  await admin`INSERT INTO role (id, tenant_id, name) VALUES
    (${ROLE}::uuid, ${TENANT}::uuid, 'Guest Writer'), (${READ_ROLE}::uuid, ${TENANT}::uuid, 'Guest Reader')`;
  await admin`INSERT INTO role_permission (role_id, permission_code) VALUES
    (${ROLE}::uuid, 'reservations.guests:read'), (${ROLE}::uuid, 'reservations.guests:write'),
    (${READ_ROLE}::uuid, 'reservations.guests:read')`;
  await admin`INSERT INTO user_role (tenant_id, user_id, role_id, scope_node) VALUES
    (${TENANT}::uuid, ${USER}::uuid, ${ROLE}::uuid, ${PROPERTY}::uuid),
    (${TENANT}::uuid, ${READ_USER}::uuid, ${READ_ROLE}::uuid, ${PROPERTY}::uuid)`;
  await admin`INSERT INTO party (id, tenant_id, kind, display_name, status) VALUES
    (${PRIMARY}::uuid, ${TENANT}::uuid, 'person', 'Primary', 'active'),
    (${SHARER}::uuid, ${TENANT}::uuid, 'person', 'Sharer', 'active')`;
  await admin`INSERT INTO reservation (id, tenant_id, property_node, confirmation_no, status, primary_party, channel_code, currency)
    VALUES
      (${RESERVATION}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O96-EXACT', 'reserved', ${PRIMARY}::uuid, 'direct', 'USD'),
      (${TERMINAL_RESERVATION}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O96-END', 'cancelled', ${PRIMARY}::uuid, 'direct', 'USD')`;
  await admin`INSERT INTO reservation_guest (tenant_id, reservation_id, party_id, role, share_pct)
    VALUES
      (${TENANT}::uuid, ${RESERVATION}::uuid, ${PRIMARY}::uuid, 'primary', NULL),
      (${TENANT}::uuid, ${TERMINAL_RESERVATION}::uuid, ${PRIMARY}::uuid, 'primary', NULL)`;

  for (const [email, assign] of [["write@order096.test", (value: string) => { writeToken = value; }],
    ["read@order096.test", (value: string) => { readToken = value; }]] as const) {
    const response = await call("/api/v1/auth/local:login", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant: "order096", email, password: "order096-correct-password" }) });
    assign((await response.json() as { accessToken: string }).accessToken);
  }
});

afterAll(async () => {
  await cleanup();
  await database?.close();
  await eventPool?.close();
  await loginPool?.close();
  await admin?.close();
});

databaseDescribe("Order 096 operator reservation guest adapter", () => {
  test("P1: exact confirmation lookup and authorized replacement use canonical server output", async () => {
    const found = await call(`/api/v1/properties/${PROPERTY}/reservation-guests?confirmationNo=O96-EXACT`, { headers: headers(writeToken) });
    expect(found.status).toBe(200);
    expect((await found.json() as any).reservation).toEqual({ reservationId: RESERVATION, confirmationNo: "O96-EXACT",
      status: "reserved", primaryPartyId: PRIMARY, guests: [{ partyId: PRIMARY, role: "primary", sharePct: null }] });
    const changed = await call(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/guests`, {
      method: "PUT", headers: headers(writeToken, "order096-exact-write"),
      body: JSON.stringify({ primarySharePct: "60.00", guests: [{ partyId: SHARER, role: "sharer", sharePct: "40.00" }] }),
    });
    expect(changed.status).toBe(200);
    expect(changed.headers.get("idempotency-replayed")).toBe("false");
    expect((await changed.json() as any).reservation.guests).toEqual([
      { partyId: PRIMARY, role: "primary", sharePct: "60.00" },
      { partyId: SHARER, role: "sharer", sharePct: "40.00" },
    ]);
    const replay = await call(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/guests`, {
      method: "PUT", headers: headers(writeToken, "order096-exact-write"),
      body: JSON.stringify({ primarySharePct: "60.00", guests: [{ partyId: SHARER, role: "sharer", sharePct: "40.00" }] }),
    });
    expect(replay.status).toBe(200);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
  });

  test("P4: publisher failure rolls the HTTP command and idempotency claim back together", async () => {
    const before = await admin!`SELECT role, share_pct::text FROM reservation_guest WHERE reservation_id=${RESERVATION}::uuid ORDER BY role`;
    const beforeEvidence = await admin!`SELECT
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id=${RESERVATION}::uuid) AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${RESERVATION}::uuid) AS events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation='reservation.guests.replace') AS claims`;
    const failed = await call(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/guests`, {
      method: "PUT", headers: headers(writeToken, "order096-publisher-failure"),
      body: JSON.stringify({ primarySharePct: null, guests: [] }),
    }, failingApp);
    expect(failed.status).toBe(503);
    const after = await admin!`SELECT role, share_pct::text FROM reservation_guest WHERE reservation_id=${RESERVATION}::uuid ORDER BY role`;
    const afterEvidence = await admin!`SELECT
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id=${RESERVATION}::uuid) AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${RESERVATION}::uuid) AS events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation='reservation.guests.replace') AS claims`;
    expect(after).toEqual(before);
    expect(afterEvidence).toEqual(beforeEvidence);
    const retry = await call(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/guests`, {
      method: "PUT", headers: headers(writeToken, "order096-publisher-failure"),
      body: JSON.stringify({ primarySharePct: null, guests: [] }),
    });
    expect(retry.status).toBe(200);
    expect(retry.headers.get("idempotency-replayed")).toBe("false");
  });

  test("P2/P3: read-only, property and strict-shape boundaries reject without mutation", async () => {
    const before = await admin!`SELECT role, share_pct::text FROM reservation_guest WHERE reservation_id=${RESERVATION}::uuid ORDER BY role`;
    const readOnly = await call(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/guests`, {
      method: "PUT", headers: headers(readToken, "order096-read-only"),
      body: JSON.stringify({ primarySharePct: null, guests: [] }),
    });
    expect(readOnly.status).toBe(403);
    const foreignProperty = await call(`/api/v1/properties/${OTHER_PROPERTY}/reservation-guests?confirmationNo=O96-EXACT`, { headers: headers(writeToken) });
    expect(foreignProperty.status).toBe(403);
    const malformed = await call(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/guests`, {
      method: "PUT", headers: headers(writeToken, "order096-malformed"),
      body: JSON.stringify({ primarySharePct: null, guests: [], authority: true }),
    });
    expect(malformed.status).toBe(400);
    const badTotal = await call(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/guests`, {
      method: "PUT", headers: headers(writeToken, "order096-bad-total"),
      body: JSON.stringify({ primarySharePct: "60.00", guests: [{ partyId: SHARER, role: "sharer", sharePct: "30.00" }] }),
    });
    expect(badTotal.status).toBe(400);
    const changedReplay = await call(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/guests`, {
      method: "PUT", headers: headers(writeToken, "order096-exact-write"),
      body: JSON.stringify({ primarySharePct: null, guests: [] }),
    });
    expect(changedReplay.status).toBe(409);
    const terminal = await call(`/api/v1/properties/${PROPERTY}/reservations/${TERMINAL_RESERVATION}/guests`, {
      method: "PUT", headers: headers(writeToken, "order096-terminal"),
      body: JSON.stringify({ primarySharePct: null, guests: [] }),
    });
    expect(terminal.status).toBe(409);
    const unauthenticated = await call(`/api/v1/properties/${PROPERTY}/reservation-guests?confirmationNo=O96-EXACT`);
    expect(unauthenticated.status).toBe(401);
    const after = await admin!`SELECT role, share_pct::text FROM reservation_guest WHERE reservation_id=${RESERVATION}::uuid ORDER BY role`;
    expect(after).toEqual(before);
  });

  test("P5: lookup is exact, duplicate query keys and terminally absent confirmations are generic", async () => {
    const duplicate = await call(`/api/v1/properties/${PROPERTY}/reservation-guests?confirmationNo=O96-EXACT&confirmationNo=O96-EXACT`, { headers: headers(writeToken) });
    expect(duplicate.status).toBe(400);
    const absent = await call(`/api/v1/properties/${PROPERTY}/reservation-guests?confirmationNo=O96-ABSENT`, { headers: headers(writeToken) });
    expect(absent.status).toBe(404);
  });
});
