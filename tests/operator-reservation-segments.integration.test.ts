import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import { BearerTenantResolver, hashLocalPassword, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import { ReservationSegmentService } from "../src/contexts/reservations";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, PostgresEventBus, PostgresIdempotency } from "../src/kernel";

const URL = process.env.YELLOW_OPERATOR_RESERVATION_SEGMENTS_URL;
if (process.env.YELLOW_REQUIRE_OPERATOR_RESERVATION_SEGMENTS === "1" && !URL) throw new Error("Order 098 database URL is required");
const databaseDescribe = URL ? describe.serial : describe.skip;
const T = "00000000-0000-0000-0000-000000009801", P = "00000000-0000-0000-0000-000000009811";
const P2 = "00000000-0000-0000-0000-000000009812", U = "00000000-0000-0000-0000-000000009821";
const UR = "00000000-0000-0000-0000-000000009822", R = "00000000-0000-0000-0000-000000009823";
const RR = "00000000-0000-0000-0000-000000009824", PARTY = "00000000-0000-0000-0000-000000009831";
const RES = "00000000-0000-0000-0000-000000009841", SEG = "00000000-0000-0000-0000-000000009842";
const UT = "00000000-0000-0000-0000-000000009851", SU = "00000000-0000-0000-0000-000000009852";
const RP = "00000000-0000-0000-0000-000000009853";
let admin: SQL | undefined, pool: SQL | undefined, db: Database | undefined;
let app: ReturnType<typeof createApp>, real: ReservationSegmentService, writeToken = "", readToken = "";
const calls: Array<{ operation: string; input: Record<string, unknown> }> = [];
const period = { from: "2049-01-01T15:00:00.000Z", to: "2049-01-03T11:00:00.000Z" };

const mock = {
  async findByConfirmation(_tx, input) { calls.push({ operation: "find", input: { ...input } }); return {
    reservationId: RES, confirmationNo: input.confirmationNo, status: "reserved" as const,
    segments: [{ segmentId: SEG, sequence: 1, status: "booked", unitTypeId: UT, sellableUnitId: SU,
      period, actions: { canChangeDeparture: true, canMoveRoom: false } }],
  }; },
  async changeDeparture(_tx, input) { calls.push({ operation: "departure", input: { ...input } }); return {
    reservationId: input.reservationId, segmentId: input.segmentId, classification: "extended" as const,
    beforePeriod: input.expectedPeriod, afterPeriod: { ...input.expectedPeriod, to: input.newDeparture },
    sellableUnitId: SU, unitTypeId: UT, releasedClaimCount: 1, reclaimedClaimCount: 1,
    financialJournalId: null, replayed: false,
  }; },
  async moveRoom(_tx, input) { calls.push({ operation: "move", input: { ...input } }); return {
    reservationId: input.reservationId, oldSegmentId: input.segmentId, newSegmentId: "00000000-0000-0000-0000-000000009843",
    oldSequence: 1, newSequence: 2, fromSellableUnitId: input.expectedSellableUnitId,
    toSellableUnitId: input.destinationSellableUnitId, fromSpaceId: "00000000-0000-0000-0000-000000009861",
    toSpaceId: "00000000-0000-0000-0000-000000009862", movedAt: "2049-01-02T10:00:00.000Z",
    beforePeriod: input.expectedPeriod, departedPeriod: { from: input.expectedPeriod.from, to: "2049-01-02T10:00:00.000Z" },
    activePeriod: { from: "2049-01-02T10:00:00.000Z", to: input.expectedPeriod.to }, financialJournalId: null, replayed: false,
  }; },
} satisfies Pick<ReservationSegmentService, "findByConfirmation" | "changeDeparture" | "moveRoom">;

const call = (path: string, init: RequestInit = {}) => app.handle(new Request(`http://yellow.test${path}`, init));
const headers = (token: string, key?: string): HeadersInit => ({ "content-type": "application/json", authorization: `Bearer ${token}`,
  ...(key ? { "idempotency-key": key } : {}) });

async function cleanup() {
  if (!admin) return;
  await admin`DELETE FROM reservation_segment WHERE tenant_id=${T}::uuid`;
  await admin`DELETE FROM reservation WHERE tenant_id=${T}::uuid`;
  await admin`DELETE FROM sellable_unit WHERE id=${SU}::uuid`; await admin`DELETE FROM rate_plan WHERE id=${RP}::uuid`;
  await admin`DELETE FROM unit_type WHERE id=${UT}::uuid`; await admin`DELETE FROM party WHERE tenant_id=${T}::uuid`;
  await admin`DELETE FROM user_role WHERE tenant_id=${T}::uuid`; await admin`DELETE FROM role_permission WHERE role_id IN (${R}::uuid,${RR}::uuid)`;
  await admin`DELETE FROM role WHERE id IN (${R}::uuid,${RR}::uuid)`; await admin`DELETE FROM app_user WHERE id IN (${U}::uuid,${UR}::uuid)`;
  await admin`DELETE FROM org_node WHERE id IN (${P}::uuid,${P2}::uuid)`; await admin`DELETE FROM tenant WHERE id=${T}::uuid`;
  await admin`DELETE FROM permission WHERE code IN ('reservations.segments:read','reservations.segments:write')`;
}

beforeAll(async () => {
  if (!URL) return;
  admin = new SQL(URL); pool = new SQL(URL); db = Database.connect(URL, { maxConnections: 8 });
  real = new ReservationSegmentService({ events: new PostgresEventBus(pool), idempotency: new PostgresIdempotency() });
  const tokens = new Hs256TokenSigner("yellow-order-098-test-token-secret-exactly-long-enough");
  app = createApp({ database: db, tenantResolver: new BearerTenantResolver(tokens), operatorApi: new OperatorHttpApi(
    new LocalLoginService(pool, tokens), new AvailabilityService(), undefined, new PostgresIdempotency(),
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, mock,
  ) });
  await cleanup(); const auth = JSON.stringify(await hashLocalPassword("order098-correct-password"));
  await admin`INSERT INTO permission(code,description) VALUES ('reservations.segments:read','read'),('reservations.segments:write','write')`;
  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES (${T}::uuid,'order098','Order 098','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${P}::uuid,${T}::uuid,'order098.one','property','One','UTC','USD'),(${P2}::uuid,${T}::uuid,'order098.two','property','Two','UTC','USD')`;
  await admin`INSERT INTO app_user(id,tenant_id,email,display_name,auth,status) VALUES
    (${U}::uuid,${T}::uuid,'write@order098.test','Writer',${auth}::text::jsonb,'active'),
    (${UR}::uuid,${T}::uuid,'read@order098.test','Reader',${auth}::text::jsonb,'active')`;
  await admin`INSERT INTO role(id,tenant_id,name) VALUES (${R}::uuid,${T}::uuid,'Writer'),(${RR}::uuid,${T}::uuid,'Reader')`;
  await admin`INSERT INTO role_permission(role_id,permission_code) VALUES (${R}::uuid,'reservations.segments:read'),
    (${R}::uuid,'reservations.segments:write'),(${RR}::uuid,'reservations.segments:read')`;
  await admin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES
    (${T}::uuid,${U}::uuid,${R}::uuid,${P}::uuid),(${T}::uuid,${UR}::uuid,${RR}::uuid,${P}::uuid)`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES (${PARTY}::uuid,${T}::uuid,'person','Primary','active')`;
  await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key) VALUES (${UT}::uuid,${T}::uuid,${P}::uuid,'O98','Room','standard')`;
  await admin`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name) VALUES (${SU}::uuid,${T}::uuid,${UT}::uuid,'Room 098')`;
  await admin`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,status) VALUES (${RP}::uuid,${T}::uuid,${P}::uuid,'O98','Rate','USD','active')`;
  await admin`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency)
    VALUES (${RES}::uuid,${T}::uuid,${P}::uuid,'O98-EXACT','reserved',${PARTY}::uuid,'direct','USD')`;
  await admin`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status)
    VALUES (${SEG}::uuid,${T}::uuid,${RES}::uuid,1,${UT}::uuid,${SU}::uuid,tstzrange('2049-01-01T15:00:00Z','2049-01-03T11:00:00Z','[)'),1,'[]'::jsonb,${RP}::uuid,'booked')`;
  for (const [email, set] of [["write@order098.test", (v: string) => writeToken = v], ["read@order098.test", (v: string) => readToken = v]] as const) {
    const response = await call("/api/v1/auth/local:login", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant: "order098", email, password: "order098-correct-password" }) });
    set((await response.json() as { accessToken: string }).accessToken);
  }
});
afterAll(async () => { await cleanup(); await db?.close(); await pool?.close(); await admin?.close(); });

databaseDescribe("Order 098 strict operator reservation segment adapter", () => {
  test("P1: exact history and departure bind server authority", async () => {
    const stored = await db!.withTenantTransaction(T, (tx) => real.findByConfirmation(tx, { tenantId: T, propertyNode: P, confirmationNo: "O98-EXACT" }));
    expect(stored).toMatchObject({ reservationId: RES, status: "reserved", segments: [{ segmentId: SEG, sequence: 1,
      actions: { canChangeDeparture: true, canMoveRoom: false } }] }); calls.length = 0;
    expect((await call(`/api/v1/properties/${P}/reservation-segments?confirmationNo=O98-EXACT`, { headers: headers(writeToken) })).status).toBe(200);
    expect((await call(`/api/v1/properties/${P}/reservations/${RES}/segments/${SEG}/departure`, { method: "PATCH",
      headers: headers(writeToken, "order098-departure-change"), body: JSON.stringify({ expectedPeriod: period, newDeparture: "2049-01-04T11:00:00.000Z" }) })).status).toBe(200);
    expect(calls.map(({ operation }) => operation)).toEqual(["find", "departure"]);
    expect(calls[1]?.input).toMatchObject({ reservationId: RES, segmentId: SEG, idempotencyKey: "order098-departure-change",
      envelope: { tenantId: T, actorId: U, propertyNode: P, operation: "reservation.modified" } });
  });
  test("P2: move binds destination but never accepts caller time", async () => {
    calls.length = 0; const destination = "00000000-0000-0000-0000-000000009899";
    expect((await call(`/api/v1/properties/${P}/reservations/${RES}/segments/${SEG}/move`, { method: "POST",
      headers: headers(writeToken, "order098-room-move"), body: JSON.stringify({ expectedSellableUnitId: SU,
        expectedPeriod: period, destinationSellableUnitId: destination }) })).status).toBe(200);
    expect(calls).toHaveLength(1); expect(calls[0]?.input).toMatchObject({ destinationSellableUnitId: destination,
      envelope: { tenantId: T, actorId: U, propertyNode: P, operation: "segment.moved" } });
    expect(calls[0]?.input).not.toHaveProperty("movedAt");
  });
  test("P4: auth, scope, property and shapes reject before commands", async () => {
    calls.length = 0;
    expect((await call(`/api/v1/properties/${P}/reservation-segments?confirmationNo=O98-EXACT`)).status).toBe(401);
    expect((await call(`/api/v1/properties/${P2}/reservation-segments?confirmationNo=O98-EXACT`, { headers: headers(writeToken) })).status).toBe(403);
    expect((await call(`/api/v1/properties/${P}/reservations/${RES}/segments/${SEG}/departure`, { method: "PATCH",
      headers: headers(readToken, "order098-read-only"), body: JSON.stringify({ expectedPeriod: period, newDeparture: "2049-01-04T11:00:00Z" }) })).status).toBe(403);
    expect((await call(`/api/v1/properties/${P}/reservations/${RES}/segments/${SEG}/move`, { method: "POST",
      headers: headers(writeToken, "order098-hostile"), body: JSON.stringify({ expectedSellableUnitId: SU,
        expectedPeriod: period, destinationSellableUnitId: SU, movedAt: "2049-01-02T10:00:00Z" }) })).status).toBe(400);
    expect((await call(`/api/v1/properties/${P}/reservation-segments?confirmationNo=O98&confirmationNo=O98`, { headers: headers(writeToken) })).status).toBe(400);
    expect(calls).toEqual([]);
  });
});
