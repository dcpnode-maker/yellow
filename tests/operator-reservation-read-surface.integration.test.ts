import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import { ReservationBoardService, ReservationDetailNotFoundError, ReservationDetailService, ReservationLifecycleService } from "../src/contexts/reservations";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, type TenantRequestContext, type Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000016621";
const PROPERTY = "00000000-0000-0000-0000-000000016622";
const RESERVATION = "00000000-0000-0000-0000-000000016623";
const ACTOR = "00000000-0000-0000-0000-000000016624";

const boardCalls: unknown[] = [];
const detailCalls: unknown[] = [];
const board = { async list(_tx: Tx, input: unknown) {
  boardCalls.push(input);
  return { reservations: [], nextCursor: null };
} };
const detail = { async findById(_tx: Tx, input: unknown) {
  detailCalls.push(input);
  throw new ReservationDetailNotFoundError("missing");
} };

const api = new OperatorHttpApi(
  {} as LocalLoginService, {} as AvailabilityService, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, board, detail,
);

function context(path: string, scopes = ["reservations.lifecycle:read"], granted = true): TenantRequestContext {
  const tx = (() => Promise.resolve(granted ? [{ id: PROPERTY, name: "P", timezone: "UTC", currency: "USD" }] : [])) as unknown as Tx;
  return { tenantId: TENANT, request: new Request(`http://yellow.test${path}`), tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes } };
}

describe("Order 166 operator reservation read surface", () => {
  test("Order 200 composes check-in beneath UUID detail without client authority", () => {
    const root = resolve(import.meta.dir, "..");
    const app = readFileSync(resolve(root, "src/app.ts"), "utf8");
    const html = readFileSync(resolve(root, "src/http/operator/index.html"), "utf8");
    const client = readFileSync(resolve(root, "src/http/operator/operator.js"), "utf8");
    const css = readFileSync(resolve(root, "src/http/operator/operator.css"), "utf8");
    expect(app).toContain('reservations/:reservation/check-in/readiness"');
    expect(app).toContain('reservations/:reservation/check-in"');
    expect(html).toContain('id="checkin-workbench"');
    expect(client).toContain("loadCheckInReadiness");
    expect(client).not.toContain('body: JSON.stringify({ dirtyRoomOverrideAuthorized');
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .checkin-workbench`);
    }
  });

  test("Order 206 minimizes arrival travel on the existing board transport", () => {
    const operator = readFileSync(resolve(import.meta.dir, "../src/http/operator.ts"), "utf8");
    const projectionStart = operator.indexOf("function reservationBoardJson(");
    const projectionEnd = operator.indexOf("\n}\n", projectionStart);
    expect(projectionStart).toBeGreaterThan(0);
    const projection = operator.slice(projectionStart, projectionEnd);
    expect(projection).toContain("arrivalTravel: reservation.arrivalTravel");
    expect(projection).not.toMatch(/pickupTaskId|taskStatus|taskState|travelId|notes|partyId|contact|parking|vehicle/i);
    expect(operator).toContain("canonicalJson(reservationBoardJson(page))");
  });

  test("board admits only strict non-PII query keys and binds tenant/property authority", async () => {
    boardCalls.length = 0;
    const path = `/api/v1/properties/${PROPERTY}/reservation-board?status=reserved&limit=100`;
    const response = await api.reservationBoard(context(path), PROPERTY);
    expect(response.status).toBe(200);
    expect(boardCalls).toEqual([{ tenantId: TENANT, propertyNode: PROPERTY, status: "reserved", limit: 100 }]);
    for (const query of ["guestName=Alice", "search=5551234", "limit=101", "from=2026-01-01T00:00:00Z"] ) {
      expect((await api.reservationBoard(context(`/x?${query}`), PROPERTY)).status).toBe(400);
    }
    expect(boardCalls).toHaveLength(1);
  });

  test("UUID detail returns generic not-found for missing and foreign properties", async () => {
    detailCalls.length = 0;
    const request = context(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}`);
    const missing = await (async () => {
      try { return await api.reservationDetail(request, PROPERTY, RESERVATION); }
      catch (error) { return api.failure(request.request, error); }
    })();
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ type: "reservations/not_found", title: "Not found" });
    expect(detailCalls).toEqual([{ tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION }]);
    const foreign = await api.reservationDetail(context("/x", ["reservations.lifecycle:read"], false), PROPERTY, RESERVATION);
    expect(foreign.status).toBe(404);
    expect(detailCalls).toHaveLength(1);
  });

  test("scope denial and malformed detail URL fail before service calls", async () => {
    detailCalls.length = 0;
    expect((await api.reservationDetail(context("/x", []), PROPERTY, RESERVATION)).status).toBe(403);
    expect((await api.reservationDetail(context("/x?confirmationNo=PII"), PROPERTY, RESERVATION)).status).toBe(400);
    expect((await api.reservationDetail(context("/x"), PROPERTY, "bad")).status).toBe(400);
    expect(detailCalls).toEqual([]);
  });
});

const DEPLOY_URL = process.env.YELLOW_OPERATOR_RESERVATION_READ_DEPLOY_URL;
const RUNTIME_URL = process.env.YELLOW_OPERATOR_RESERVATION_READ_RUNTIME_URL;
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000016625";
const PRIMARY = "00000000-0000-0000-0000-000000016626";
const UNIT = "00000000-0000-0000-0000-000000016627";
const RATE = "00000000-0000-0000-0000-000000016628";
const SEGMENT = "00000000-0000-0000-0000-000000016629";
const ROLE = "00000000-0000-0000-0000-000000016630";
let admin: SQL | undefined;
let runtimeDatabase: Database | undefined;
let loginPool: SQL | undefined;
let httpApp: ReturnType<typeof createApp>;
let token = "";

async function cleanup() {
  if (!admin) return;
  for (const table of ["reservation_guest", "reservation_segment", "reservation", "rate_plan", "unit_type", "party", "user_role"]) {
    await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id=$1::uuid`, [TENANT]);
  }
  await admin`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid`;
  await admin`DELETE FROM role WHERE id=${ROLE}::uuid`;
  await admin`DELETE FROM app_user WHERE id=${ACTOR}::uuid`;
  await admin`DELETE FROM org_node WHERE tenant_id=${TENANT}::uuid`;
  await admin`DELETE FROM tenant WHERE id=${TENANT}::uuid`;
  await admin`DELETE FROM permission WHERE code='reservations.lifecycle:read'`;
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  admin = new SQL(DEPLOY_URL, { max: 2, prepare: false });
  loginPool = new SQL(RUNTIME_URL, { max: 1, prepare: false });
  runtimeDatabase = Database.connect(RUNTIME_URL, { maxConnections: 3, prepare: false });
  await cleanup();
  await admin`INSERT INTO permission(code,description) VALUES ('reservations.lifecycle:read','Read reservations')`;
  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES (${TENANT}::uuid,'order166-http','Order 166 HTTP','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order166_http','property','HTTP','UTC','USD'),
    (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order166_other','property','Other','UTC','USD')`;
  await admin`INSERT INTO app_user(id,tenant_id,email,display_name,auth,status)
    VALUES (${ACTOR}::uuid,${TENANT}::uuid,'operator@order166.test','Operator','{}','active')`;
  await admin`INSERT INTO role(id,tenant_id,name) VALUES (${ROLE}::uuid,${TENANT}::uuid,'Reader')`;
  await admin`INSERT INTO role_permission(role_id,permission_code) VALUES (${ROLE}::uuid,'reservations.lifecycle:read')`;
  await admin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
    VALUES (${TENANT}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${PROPERTY}::uuid)`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status)
    VALUES (${PRIMARY}::uuid,${TENANT}::uuid,'person','HTTP Guest','active')`;
  await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key)
    VALUES (${UNIT}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'STD','Standard','hotel')`;
  await admin`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,status)
    VALUES (${RATE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'BAR','BAR','USD','active')`;
  await admin`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency,created_at)
    VALUES (${RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'Y-166-HTTP','reserved',${PRIMARY}::uuid,'direct','USD','2026-08-26T00:00:00Z')`;
  await admin`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,period,adults,children,rate_plan_id,status)
    VALUES (${SEGMENT}::uuid,${TENANT}::uuid,${RESERVATION}::uuid,1,${UNIT}::uuid,tstzrange('2026-09-01','2026-09-02','[)'),1,'[]',${RATE}::uuid,'booked')`;
  await admin`INSERT INTO reservation_guest(tenant_id,reservation_id,party_id,role)
    VALUES (${TENANT}::uuid,${RESERVATION}::uuid,${PRIMARY}::uuid,'primary')`;
  const signer = new Hs256TokenSigner("order166-http-proof-secret-longer-than-thirty-two-bytes");
  token = await signer.issue({ userId: ACTOR, tenantId: TENANT, scopes: ["reservations.lifecycle:read"] });
  const lifecycle = new ReservationLifecycleService({ events: {} as never, idempotency: {} as never });
  const operator = new OperatorHttpApi(
    new LocalLoginService(loginPool, signer), new AvailabilityService(), undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, lifecycle, undefined, undefined, undefined, undefined,
    new ReservationBoardService(), new ReservationDetailService(),
  );
  httpApp = createApp({ database: runtimeDatabase, tenantResolver: new BearerTenantResolver(signer), operatorApi: operator });
});

afterAll(async () => {
  await cleanup();
  await runtimeDatabase?.close();
  await loginPool?.close();
  await admin?.close();
});

databaseDescribe("Order 166 real unprepared HTTP surface", () => {
  const get = (path: string) => httpApp.handle(new Request(`http://yellow.test${path}`, {
    headers: { authorization: `Bearer ${token}` },
  }));

  test("board, UUID aggregate, deep link and exact-confirmation compatibility are live", async () => {
    const boardResponse = await get(`/api/v1/properties/${PROPERTY}/reservation-board?limit=1`);
    expect(boardResponse.status).toBe(200);
    expect(await boardResponse.json()).toMatchObject({ reservations: [{ reservationId: RESERVATION }], nextCursor: null });
    const detailResponse = await get(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}`);
    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toMatchObject({
      reservation: { reservationId: RESERVATION, confirmationNo: "Y-166-HTTP" },
      actions: { canModify: true, canCancel: true, canReinstate: false },
    });
    expect((await get(`/p/${PROPERTY}/res/${RESERVATION}`)).status).toBe(200);
    const exact = await get(`/api/v1/properties/${PROPERTY}/reservations?confirmationNo=Y-166-HTTP`);
    expect(exact.status).toBe(200);
    expect(await exact.json()).toMatchObject({ reservation: { reservationId: RESERVATION } });
  });

  test("foreign property, missing UUID and PII GET search are generic or rejected", async () => {
    for (const path of [
      `/api/v1/properties/${OTHER_PROPERTY}/reservations/${RESERVATION}`,
      `/api/v1/properties/${PROPERTY}/reservations/00000000-0000-0000-0000-000000016699`,
    ]) {
      const response = await get(path);
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ type: "reservations/not_found" });
    }
    expect((await get(`/api/v1/properties/${PROPERTY}/reservation-board?guestName=HTTP%20Guest`)).status).toBe(400);
  });
});
