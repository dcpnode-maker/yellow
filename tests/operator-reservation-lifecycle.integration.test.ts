import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, hashLocalPassword, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import { ReservationLifecycleService } from "../src/contexts/reservations";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, PostgresEventBus, PostgresIdempotency } from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_OPERATOR_RESERVATION_LIFECYCLE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_RESERVATION_LIFECYCLE === "1";
const SECRET = "yellow-order-097-test-token-secret-exactly-long-enough";
const TENANT = "00000000-0000-0000-0000-000000009701";
const PROPERTY = "00000000-0000-0000-0000-000000009711";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000009712";
const USER = "00000000-0000-0000-0000-000000009721";
const READ_USER = "00000000-0000-0000-0000-000000009722";
const ROLE = "00000000-0000-0000-0000-000000009723";
const READ_ROLE = "00000000-0000-0000-0000-000000009724";
const RESERVATION = "00000000-0000-0000-0000-000000009741";
const PRIMARY = "00000000-0000-0000-0000-000000009731";

if (REQUIRE_DATABASE && !DATABASE_URL) throw new Error("Order 097 database URL is required");
const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let loginPool: SQL | undefined;
let database: Database | undefined;
let app: ReturnType<typeof createApp>;
let realLifecycle: ReservationLifecycleService;
let writeToken = "";
let readToken = "";
const calls: Array<{ operation: string; input: Record<string, unknown> }> = [];

const lifecycle = {
  async findByConfirmation(_tx, input) {
    calls.push({ operation: "find", input: { ...input } });
    return { reservationId: RESERVATION, confirmationNo: input.confirmationNo, status: "reserved" as const,
      fields: { notes: null, eta: null, etd: null, marketCode: null, sourceCode: null, originCode: null },
      actions: { canModify: true, canCancel: true, canReinstate: false } };
  },
  async modify(_tx, input) {
    calls.push({ operation: "modify", input: { ...input } });
    return { reservationId: input.reservationId, status: "reserved" as const,
      diff: { notes: { before: null, after: "Late arrival" } }, replayed: false };
  },
  async cancel(_tx, input) {
    calls.push({ operation: "cancel", input: { ...input } });
    return { reservationId: input.reservationId, previousStatus: "reserved" as const, status: "cancelled" as const,
      cancellationNo: "C-ORDER097", cancelledAt: "2049-01-01T00:00:00.000Z", releasedClaimCount: 1,
      policyDecision: { evidence: "none" as const, policy_id: null, content_hash: null, rule_before_hours: null, penalty: null },
      approvalId: null, penaltyJournalId: null, replayed: false };
  },
  async reinstate(_tx, input) {
    calls.push({ operation: "reinstate", input: { ...input } });
    return { reservationId: input.reservationId, previousStatus: "cancelled" as const, status: "reserved" as const,
      reclaimedClaimCount: 1, replayed: false };
  },
} satisfies Pick<ReservationLifecycleService, "findByConfirmation" | "modify" | "cancel" | "reinstate">;

function call(path: string, init: RequestInit = {}) {
  return app.handle(new Request(`http://yellow.test${path}`, init));
}

function headers(token: string, key?: string): HeadersInit {
  return { "content-type": "application/json", authorization: `Bearer ${token}`,
    ...(key ? { "idempotency-key": key } : {}) };
}

async function cleanup() {
  if (!admin) return;
  await admin`DELETE FROM reservation WHERE tenant_id=${TENANT}::uuid`;
  await admin`DELETE FROM party WHERE tenant_id=${TENANT}::uuid`;
  await admin`DELETE FROM user_role WHERE tenant_id=${TENANT}::uuid`;
  await admin`DELETE FROM role_permission WHERE role_id IN (${ROLE}::uuid, ${READ_ROLE}::uuid)`;
  await admin`DELETE FROM role WHERE id IN (${ROLE}::uuid, ${READ_ROLE}::uuid)`;
  await admin`DELETE FROM app_user WHERE id IN (${USER}::uuid, ${READ_USER}::uuid)`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY}::uuid, ${OTHER_PROPERTY}::uuid)`;
  await admin`DELETE FROM tenant WHERE id=${TENANT}::uuid`;
  await admin`DELETE FROM permission WHERE code IN ('reservations.lifecycle:read', 'reservations.lifecycle:write')`;
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 4 });
  loginPool = new SQL(DATABASE_URL, { max: 4 });
  database = Database.connect(DATABASE_URL, { maxConnections: 8 });
  realLifecycle = new ReservationLifecycleService({
    events: new PostgresEventBus(loginPool), idempotency: new PostgresIdempotency(),
  });
  const tokens = new Hs256TokenSigner(SECRET);
  app = createApp({ database, tenantResolver: new BearerTenantResolver(tokens), operatorApi: new OperatorHttpApi(
    new LocalLoginService(loginPool, tokens), new AvailabilityService(), undefined, new PostgresIdempotency(),
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, lifecycle,
  ) });
  await cleanup();
  const auth = JSON.stringify(await hashLocalPassword("order097-correct-password"));
  await admin`INSERT INTO permission (code, description) VALUES
    ('reservations.lifecycle:read', 'Read reservation lifecycle'),
    ('reservations.lifecycle:write', 'Write reservation lifecycle')`;
  await admin`INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${TENANT}::uuid, 'order097', 'Order 097', 'shared', 'active')`;
  await admin`INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency) VALUES
    (${PROPERTY}::uuid, ${TENANT}::uuid, 'order097.one', 'property', 'Order 097 One', 'UTC', 'USD'),
    (${OTHER_PROPERTY}::uuid, ${TENANT}::uuid, 'order097.two', 'property', 'Order 097 Two', 'UTC', 'USD')`;
  await admin`INSERT INTO app_user (id, tenant_id, email, display_name, auth, status) VALUES
    (${USER}::uuid, ${TENANT}::uuid, 'write@order097.test', 'Write Operator', ${auth}::text::jsonb, 'active'),
    (${READ_USER}::uuid, ${TENANT}::uuid, 'read@order097.test', 'Read Operator', ${auth}::text::jsonb, 'active')`;
  await admin`INSERT INTO role (id, tenant_id, name) VALUES
    (${ROLE}::uuid, ${TENANT}::uuid, 'Lifecycle Writer'), (${READ_ROLE}::uuid, ${TENANT}::uuid, 'Lifecycle Reader')`;
  await admin`INSERT INTO role_permission (role_id, permission_code) VALUES
    (${ROLE}::uuid, 'reservations.lifecycle:read'), (${ROLE}::uuid, 'reservations.lifecycle:write'),
    (${READ_ROLE}::uuid, 'reservations.lifecycle:read')`;
  await admin`INSERT INTO user_role (tenant_id, user_id, role_id, scope_node) VALUES
    (${TENANT}::uuid, ${USER}::uuid, ${ROLE}::uuid, ${PROPERTY}::uuid),
    (${TENANT}::uuid, ${READ_USER}::uuid, ${READ_ROLE}::uuid, ${PROPERTY}::uuid)`;
  await admin`INSERT INTO party (id, tenant_id, kind, display_name, status)
    VALUES (${PRIMARY}::uuid, ${TENANT}::uuid, 'person', 'Order 097 Primary', 'active')`;
  await admin`INSERT INTO reservation (
    id, tenant_id, property_node, confirmation_no, status, primary_party, channel_code, currency,
    notes, eta, market_code
  ) VALUES (
    ${RESERVATION}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O97-EXACT', 'reserved',
    ${PRIMARY}::uuid, 'direct', 'USD', 'Late arrival', '15:00:00+00'::timetz, 'DIRECT'
  )`;
  for (const [email, assign] of [["write@order097.test", (value: string) => { writeToken = value; }],
    ["read@order097.test", (value: string) => { readToken = value; }]] as const) {
    const response = await call("/api/v1/auth/local:login", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant: "order097", email, password: "order097-correct-password" }) });
    assign((await response.json() as { accessToken: string }).accessToken);
  }
});

afterAll(async () => {
  await cleanup();
  await database?.close();
  await loginPool?.close();
  await admin?.close();
});

databaseDescribe("Order 097 strict operator reservation lifecycle adapter", () => {
  test("P1: lookup and modify bind server authority and exact optimistic fields", async () => {
    const stored = await database!.withTenantTransaction(TENANT, (tx) => realLifecycle.findByConfirmation(tx, {
      tenantId: TENANT, propertyNode: PROPERTY, confirmationNo: "O97-EXACT",
    }));
    expect(stored).toMatchObject({ reservationId: RESERVATION, confirmationNo: "O97-EXACT", status: "reserved",
      fields: { notes: "Late arrival", eta: "15:00:00+00", marketCode: "DIRECT" },
      actions: { canModify: true, canCancel: true, canReinstate: false } });
    calls.length = 0;
    const found = await call(`/api/v1/properties/${PROPERTY}/reservations?confirmationNo=O97-EXACT`, { headers: headers(writeToken) });
    expect(found.status).toBe(200);
    expect((await found.json() as any).reservation.actions).toEqual({ canModify: true, canCancel: true, canReinstate: false });
    const changed = await call(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}`, {
      method: "PATCH", headers: headers(writeToken, "order097-metadata-change"),
      body: JSON.stringify({ expected: { notes: null }, changes: { notes: "Late arrival" } }),
    });
    expect(changed.status).toBe(200);
    expect(calls.map(({ operation }) => operation)).toEqual(["find", "modify"]);
    expect(calls[0]?.input).toEqual({ tenantId: TENANT, propertyNode: PROPERTY, confirmationNo: "O97-EXACT" });
    const mutation = calls[1]?.input as any;
    expect(mutation.reservationId).toBe(RESERVATION);
    expect(mutation.envelope).toMatchObject({ tenantId: TENANT, actorId: USER, propertyNode: PROPERTY,
      operation: "reservation.modified" });
    expect(mutation.idempotencyKey).toBe("order097-metadata-change");
  });

  test("P2/P3: cancel and reinstate call only injected commands with exact operations", async () => {
    calls.length = 0;
    const cancelled = await call(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/cancel`, {
      method: "POST", headers: headers(writeToken, "order097-cancel-command"),
      body: JSON.stringify({ reason: "Guest request" }),
    });
    expect(cancelled.status).toBe(200);
    const reinstated = await call(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/reinstate`, {
      method: "POST", headers: headers(writeToken, "order097-reinstate-command"), body: "{}",
    });
    expect(reinstated.status).toBe(200);
    expect(calls.map(({ operation }) => operation)).toEqual(["cancel", "reinstate"]);
    expect((calls[0]?.input as any).envelope.operation).toBe("reservation.cancelled");
    expect((calls[1]?.input as any).envelope.operation).toBe("reservation.reinstated");
  });

  test("P4: authentication, read-only, property and strict shapes reject before commands", async () => {
    calls.length = 0;
    expect((await call(`/api/v1/properties/${PROPERTY}/reservations?confirmationNo=O97-EXACT`)).status).toBe(401);
    expect((await call(`/api/v1/properties/${OTHER_PROPERTY}/reservations?confirmationNo=O97-EXACT`, { headers: headers(writeToken) })).status).toBe(403);
    expect((await call(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}`, {
      method: "PATCH", headers: headers(readToken, "order097-read-only"),
      body: JSON.stringify({ expected: { notes: null }, changes: { notes: "No" } }),
    })).status).toBe(403);
    expect((await call(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/cancel`, {
      method: "POST", headers: headers(writeToken, "order097-hostile"),
      body: JSON.stringify({ reason: "No", policy: { penalty: 0 } }),
    })).status).toBe(400);
    expect((await call(`/api/v1/properties/${PROPERTY}/reservations?confirmationNo=O97&confirmationNo=O97`, { headers: headers(writeToken) })).status).toBe(400);
    expect(calls).toEqual([]);
  });
});
