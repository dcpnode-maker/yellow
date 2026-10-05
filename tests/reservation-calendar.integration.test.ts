import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { Database } from "../src/kernel";
import { OperatorHttpApi } from "../src/http/operator";
import { ReservationCalendarService, reservationCalendarBoundary, reservationCalendarDates, ReservationCalendarConflictError } from "../src/contexts/reservations";

const DEPLOY = process.env.YELLOW_CALENDAR_DEPLOY_URL;
const RUNTIME = process.env.YELLOW_CALENDAR_RUNTIME_URL;
if (process.env.YELLOW_REQUIRE_CALENDAR === "1" && (!DEPLOY || !RUNTIME)) throw new Error("Calendar database proof requires deploy and runtime URLs.");
for (const url of [DEPLOY, RUNTIME]) if (url && !new URL(url).pathname.includes("calendar_acceptance")) throw new Error("Calendar fixture is restricted to its synthetic acceptance database.");
const dbDescribe = DEPLOY && RUNTIME ? describe.serial : describe.skip;
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T = id(90001), FOREIGN = id(90002), P = id(90003), OTHER = id(90004), FP = id(90005);
const PARTY = id(90006), TYPE = id(90007), ROOM1 = id(90008), ROOM2 = id(90009), RATE = id(90010);
const R = id(90011), DAY = id(90012), UNASSIGNED = id(90013), CANCEL = id(90014), NOSHOW = id(90015), OTHER_R = id(90016);
const ACTOR = id(90017), ROLE = id(90018);
let admin: SQL, database: Database;
const service = new ReservationCalendarService();

test("civil ranges permit full leap years and reject impossible, reversed and oversized dates", () => {
  expect(reservationCalendarDates("2024-01-01", "2025-01-01")).toBe(366);
  for (const [from, to] of [["2026-02-30", "2026-03-02"], ["2026-03-02", "2026-03-01"], ["2024-01-01", "2025-01-02"], ["0000-01-01", "0001-01-01"]]) {
    expect(() => reservationCalendarDates(from!, to!)).toThrow();
  }
});
test("civil boundaries preserve skipped and repeated midnight dates", () => {
  expect(reservationCalendarBoundary("2026-03-01", "Asia/Kolkata")).toBe("2026-02-28T18:30:00.000Z");
  expect(reservationCalendarBoundary("2026-09-06", "America/Santiago")).toBe("2026-09-06T04:00:00.000Z");
  expect(() => reservationCalendarBoundary("2011-12-30", "Pacific/Apia")).toThrow();
  expect(() => reservationCalendarBoundary("2026-03-01", "Invalid/Zone")).toThrow();
});

async function clean() {
  if (!admin) return;
  for (const table of ["user_role", "role_permission", "role", "app_user", "reservation_segment", "reservation", "sellable_unit", "rate_plan", "unit_type", "party", "org_node"]) {
    if (table === "role_permission") await admin.unsafe("DELETE FROM role_permission WHERE role_id=$1::uuid", [ROLE]);
    else await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [T, FOREIGN]);
  }
  await admin`DELETE FROM tenant WHERE id IN (${T}::uuid,${FOREIGN}::uuid)`;
}
beforeAll(async () => {
  if (!DEPLOY || !RUNTIME) return;
  admin = new SQL(DEPLOY, { max: 2, prepare: false });
  database = Database.connect(RUNTIME, { maxConnections: 2, prepare: false });
  await clean();
  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES (${T}::uuid,'hosting-calendar-proof','Calendar proof','shared','active'),(${FOREIGN}::uuid,'hosting-calendar-foreign','Foreign proof','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${P}::uuid,${T}::uuid,'calendar_property','property','Calendar Hotel','Asia/Kolkata','INR'),
    (${OTHER}::uuid,${T}::uuid,'calendar_other','property','Other Hotel','UTC','USD'),
    (${FP}::uuid,${FOREIGN}::uuid,'calendar_foreign','property','Foreign Hotel','UTC','USD')`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES (${PARTY}::uuid,${T}::uuid,'person','Calendar Guest','active')`;
  await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key) VALUES (${TYPE}::uuid,${T}::uuid,${P}::uuid,'STD','Standard','hotel')`;
  await admin`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES (${ROOM1}::uuid,${T}::uuid,${TYPE}::uuid,'Room 101','active'),(${ROOM2}::uuid,${T}::uuid,${TYPE}::uuid,'Room 102','active')`;
  await admin`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,status) VALUES (${RATE}::uuid,${T}::uuid,${P}::uuid,'BAR','Base','INR','active')`;
  for (const [reservation, property, status, party] of [[R,P,'reserved',PARTY],[DAY,P,'reserved',PARTY],[UNASSIGNED,P,'reserved',PARTY],[CANCEL,P,'cancelled',PARTY],[NOSHOW,P,'no_show',PARTY],[OTHER_R,OTHER,'reserved',PARTY]] as const) {
    await admin`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency)
      VALUES (${reservation}::uuid,${T}::uuid,${property}::uuid,${'C-'+reservation.slice(-5)},${status},${party}::uuid,'direct','INR')`;
  }
  for (const [segment, reservation, sequence, room, from, to, status] of [
    [id(90101),R,1,ROOM1,'2026-02-27T09:30:00Z','2026-03-02T05:30:00Z','booked'],
    [id(90102),R,2,ROOM2,'2026-03-04T09:30:00Z','2026-03-06T05:30:00Z','booked'],
    [id(90103),DAY,1,ROOM1,'2026-03-01T03:30:00Z','2026-03-01T12:30:00Z','booked'],
    [id(90104),UNASSIGNED,1,null,'2026-03-07T09:30:00Z','2026-03-08T05:30:00Z','booked'],
    [id(90105),CANCEL,1,ROOM1,'2026-03-07T09:30:00Z','2026-03-08T05:30:00Z','cancelled'],
    [id(90106),NOSHOW,1,ROOM1,'2026-03-07T09:30:00Z','2026-03-08T05:30:00Z','booked'],
    [id(90107),OTHER_R,1,ROOM1,'2026-03-07T09:30:00Z','2026-03-08T05:30:00Z','booked'],
  ] as const) await admin`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status)
    VALUES (${segment}::uuid,${T}::uuid,${reservation}::uuid,${sequence},${TYPE}::uuid,${room}::uuid,tstzrange(${from}::timestamptz,${to}::timestamptz,'[)'),1,'[]',${RATE}::uuid,${status})`;
  await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES (${ACTOR}::uuid,${T}::uuid,'calendar@example.test','Calendar reader','active')`;
  await admin`INSERT INTO role(id,tenant_id,name) VALUES (${ROLE}::uuid,${T}::uuid,'Calendar reader')`;
  await admin`INSERT INTO permission(code,description) VALUES ('reservations.lifecycle:read','Reservation lifecycle read') ON CONFLICT (code) DO NOTHING`;
  await admin`INSERT INTO role_permission(role_id,permission_code) VALUES (${ROLE}::uuid,'reservations.lifecycle:read')`;
  await admin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES (${T}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${P}::uuid)`;
});
afterAll(async () => { if (admin) { await clean(); await admin.close(); } if (database) await database.close(); });

dbDescribe("native calendar actual runtime-role PostgreSQL proof", () => {
  const read = (from = "2026-03-01", to = "2026-04-01") => database.withTenantTransaction(T, tx => service.list(tx, { tenantId:T, propertyNode:P, fromDate:from, toDateExclusive:to }));
  test("actual rooms, split-stay gaps, day use and unassigned stays retain their identities", async () => {
    const page = await read();
    expect(page.rooms.map(room => room.sellableUnitId)).toEqual([ROOM1, ROOM2]);
    expect(page.segments).toHaveLength(4);
    const first = page.segments.find(segment => segment.segmentId === id(90101))!;
    expect(first.clipFromDate).toBe("2026-03-01"); expect(first.clipToDateExclusive).toBe("2026-03-02"); expect(first.continuesBefore).toBe(true);
    expect(page.segments.find(segment => segment.segmentId === id(90102))!.sellableUnitId).toBe(ROOM2);
    const day = page.segments.find(segment => segment.reservationId === DAY)!;
    expect(day.localFromDate).toBe(day.localToDateExclusive); expect(day.clipToDateExclusive).toBe("2026-03-02");
    const unassigned = page.segments.find(segment => segment.reservationId === UNASSIGNED)!;
    expect(unassigned.sellableUnitId).toBeNull(); expect(unassigned.primaryGuestDisplayName).toBe("Calendar Guest");
    expect(page.limited).toBe(false); expect(page.roomsLimited).toBe(false);
  });
  test("year reads are bounded, checkout is exclusive and foreign scope fails closed", async () => {
    expect((await read("2026-01-01", "2027-01-01")).segments).toHaveLength(4);
    expect((await read("2026-03-02", "2026-03-03")).segments).toHaveLength(0);
    await expect(database.withTenantTransaction(FOREIGN, tx => service.list(tx, { tenantId:T, propertyNode:P, fromDate:"2026-03-01", toDateExclusive:"2026-04-01" }))).rejects.toBeInstanceOf(ReservationCalendarConflictError);
    expect((await database.withTenantTransaction(FOREIGN, tx => service.list(tx, { tenantId:FOREIGN, propertyNode:FP, fromDate:"2026-03-01", toDateExclusive:"2026-04-01" }))).segments).toHaveLength(0);
  });
  test("operator requires both token scope and current property grant, and revocation takes effect", async () => {
    const api = new OperatorHttpApi({} as never);
    const request = (property:string, scopes:readonly string[]) => database.withTenantTransaction(T, tx => api.reservationCalendar({
      request: new Request(`http://yellow.test/api/v1/properties/${property}/reservation-calendar?from=2026-03-01&to=2026-04-01`),
      tenantId:T, identity:{tenantId:T,actorId:ACTOR,scopes}, tx,
    }, property));
    expect((await request(P, [])).status).toBe(403);
    expect((await request(OTHER, ["reservations.lifecycle:read"])).status).toBe(403);
    expect((await request(FP, ["reservations.lifecycle:read"])).status).toBe(403);
    const authorized = await request(P, ["reservations.lifecycle:read"]);
    expect(authorized.status).toBe(200); expect((await authorized.json()).segments).toHaveLength(4);
    await admin`DELETE FROM user_role WHERE user_id=${ACTOR}::uuid`;
    expect((await request(P, ["reservations.lifecycle:read"])).status).toBe(403);
    await admin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES (${T}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${P}::uuid)`;
  });
  test("read leaves authoritative occupancy, finance and event tables unchanged", async () => {
    const counts = () => admin`SELECT (SELECT count(*) FROM space_occupancy) AS occupancy,(SELECT count(*) FROM journal) AS journals,(SELECT count(*) FROM fact_log) AS facts,(SELECT count(*) FROM outbox) AS events`;
    const before = await counts(); await read(); await read("2026-01-01", "2027-01-01"); expect(await counts()).toEqual(before);
  });
  test("segment and room truncation are explicit and never presented as complete", async () => {
    const limitedReservation = id(90200);
    await admin`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency)
      VALUES (${limitedReservation}::uuid,${T}::uuid,${P}::uuid,'C-LIMIT','reserved',${PARTY}::uuid,'direct','INR')`;
    await admin`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status)
      SELECT ('10000000-0000-4000-8000-' || lpad((100000+n)::text,12,'0'))::uuid,${T}::uuid,${limitedReservation}::uuid,n,${TYPE}::uuid,${ROOM1}::uuid,
        tstzrange('2026-03-10T09:30:00Z','2026-03-11T05:30:00Z','[)'),1,'[]',${RATE}::uuid,'booked' FROM generate_series(1,1001) AS n`;
    const limited = await read(); expect(limited.limited).toBe(true); expect(limited.segments).toHaveLength(1000);
    await admin`DELETE FROM reservation_segment WHERE reservation_id=${limitedReservation}::uuid`;
    await admin`DELETE FROM reservation WHERE id=${limitedReservation}::uuid`;
    await admin`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status)
      SELECT ('10000000-0000-4000-8000-' || lpad((200000+n)::text,12,'0'))::uuid,${T}::uuid,${TYPE}::uuid,'Additional ' || n::text,'active' FROM generate_series(1,500) AS n`;
    const rooms = await read(); expect(rooms.roomsLimited).toBe(true); expect(rooms.rooms).toHaveLength(500);
  });
});
