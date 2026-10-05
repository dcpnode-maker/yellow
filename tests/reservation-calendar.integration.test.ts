import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { ReservationCalendarService } from "../src/contexts/reservations";
import { Database } from "../src/kernel";

// Run only against an isolated, disposable PostgreSQL database with the current schema.
const DEPLOY_URL = process.env.YELLOW_RESERVATION_CALENDAR_DEPLOY_URL;
const RUNTIME_URL = process.env.YELLOW_RESERVATION_CALENDAR_RUNTIME_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_RESERVATION_CALENDAR_DB === "1";
if (REQUIRED && (!DEPLOY_URL || !RUNTIME_URL)) throw new Error("Order681 disposable DB URLs are required");
const dbDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
const T = "00000000-0000-0000-0000-000000068111";
const FOREIGN = "00000000-0000-0000-0000-000000068112";
const P = "00000000-0000-0000-0000-000000068121";
const OTHER = "00000000-0000-0000-0000-000000068122";
const FOREIGN_P = "00000000-0000-0000-0000-000000068123";
const GUEST = "00000000-0000-0000-0000-000000068131";
const TYPE = "00000000-0000-0000-0000-000000068141";
const OTHER_TYPE = "00000000-0000-0000-0000-000000068142";
const RATE = "00000000-0000-0000-0000-000000068151";
const A = "00000000-0000-0000-0000-000000068161";
const B = "00000000-0000-0000-0000-000000068162";
const EMPTY = "00000000-0000-0000-0000-000000068163";
const FOREIGN_ROOM = "00000000-0000-0000-0000-000000068164";
const SA = "00000000-0000-0000-0000-000000068171";
const SB = "00000000-0000-0000-0000-000000068172";
const REZ = "00000000-0000-0000-0000-000000068181";
const CANCELLED = "00000000-0000-0000-0000-000000068182";
const OTHER_REZ = "00000000-0000-0000-0000-000000068183";
const MOVE1 = "00000000-0000-0000-0000-000000068191";
const MOVE2 = "00000000-0000-0000-0000-000000068192";
let admin: SQL | undefined;
let runtime: Database | undefined;

dbDescribe("Order681 isolated PostgreSQL reservation calendar", () => {
  beforeAll(async () => {
    admin = new SQL(DEPLOY_URL!, { max: 2, prepare: false });
    runtime = Database.connect(RUNTIME_URL!, { maxConnections: 2, prepare: false });
    await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${T}::uuid,'order681-calendar','Calendar','shared','active'),
      (${FOREIGN}::uuid,'order681-foreign','Foreign','shared','active')`;
    await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${P}::uuid,${T}::uuid,'order681_calendar','property','New York','America/New_York','USD'),
      (${OTHER}::uuid,${T}::uuid,'order681_other','property','Other','UTC','USD'),
      (${FOREIGN_P}::uuid,${FOREIGN}::uuid,'order681_foreign','property','Foreign','UTC','USD')`;
    await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES (${GUEST}::uuid,${T}::uuid,'person','Calendar Guest','active')`;
    await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key) VALUES
      (${TYPE}::uuid,${T}::uuid,${P}::uuid,'DLX','Deluxe','hotel'),
      (${OTHER_TYPE}::uuid,${T}::uuid,${OTHER}::uuid,'OTH','Other','hotel')`;
    await admin`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name) VALUES
      (${A}::uuid,${T}::uuid,${TYPE}::uuid,'Room A'),(${B}::uuid,${T}::uuid,${TYPE}::uuid,'Room B'),
      (${EMPTY}::uuid,${T}::uuid,${TYPE}::uuid,'Empty room'),(${FOREIGN_ROOM}::uuid,${T}::uuid,${OTHER_TYPE}::uuid,'Foreign property room')`;
    await admin`INSERT INTO space(id,tenant_id,property_node,code,profile_key) VALUES
      (${SA}::uuid,${T}::uuid,${P}::uuid,'A','hotel'),(${SB}::uuid,${T}::uuid,${P}::uuid,'B','hotel')`;
    await admin`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode) VALUES
      (${T}::uuid,${A}::uuid,${SA}::uuid,'exclusive'),(${T}::uuid,${B}::uuid,${SB}::uuid,'exclusive')`;
    await admin`INSERT INTO unit_condition(tenant_id,space_id,condition) VALUES (${T}::uuid,${SA}::uuid,'clean'),(${T}::uuid,${SB}::uuid,'dirty')`;
    await admin`INSERT INTO ooo_oos(tenant_id,space_id,kind,period) VALUES
      (${T}::uuid,${SB}::uuid,'oos',tstzrange('2026-11-03T17:00:00Z','2026-11-04T17:00:00Z','[)'))`;
    await admin`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,status) VALUES
      (${RATE}::uuid,${T}::uuid,${P}::uuid,'BAR','Best Available','USD','active')`;
    await admin`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,currency) VALUES
      (${REZ}::uuid,${T}::uuid,${P}::uuid,'CAL-681','reserved',${GUEST}::uuid,'USD'),
      (${CANCELLED}::uuid,${T}::uuid,${P}::uuid,'CAL-681-C','cancelled',${GUEST}::uuid,'USD'),
      (${OTHER_REZ}::uuid,${T}::uuid,${OTHER}::uuid,'CAL-681-O','reserved',${GUEST}::uuid,'USD')`;
    await admin`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,rate_plan_id,status) VALUES
      (${MOVE1}::uuid,${T}::uuid,${REZ}::uuid,1,${TYPE}::uuid,${A}::uuid,tstzrange('2026-10-31T19:00:00Z','2026-11-02T16:00:00Z','[)'),${RATE}::uuid,'booked'),
      (${MOVE2}::uuid,${T}::uuid,${REZ}::uuid,2,${TYPE}::uuid,${B}::uuid,tstzrange('2026-11-02T19:00:00Z','2026-11-04T16:00:00Z','[)'),${RATE}::uuid,'booked'),
      ('00000000-0000-0000-0000-000000068194',${T}::uuid,${REZ}::uuid,3,${TYPE}::uuid,${A}::uuid,tstzrange('2026-11-01T19:00:00Z','2026-11-03T16:00:00Z','[)'),${RATE}::uuid,'cancelled'),
      ('00000000-0000-0000-0000-000000068193',${T}::uuid,${CANCELLED}::uuid,1,${TYPE}::uuid,${A}::uuid,tstzrange('2026-11-01T19:00:00Z','2026-11-03T16:00:00Z','[)'),${RATE}::uuid,'cancelled')`;
  });

  afterAll(async () => {
    if (admin) {
      for (const table of ["reservation_segment", "reservation", "ooo_oos", "unit_condition", "sellable_unit_space", "space", "sellable_unit", "rate_plan", "unit_type", "party", "org_node"]) {
        await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id=$1::uuid`, [T]);
        await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id=$1::uuid`, [FOREIGN]);
      }
      await admin`DELETE FROM tenant WHERE id IN (${T}::uuid,${FOREIGN}::uuid)`;
    }
    await runtime?.close();
    await admin?.close();
  });

  test("local half-open dates, DST, all move segments, empty rooms and property isolation", async () => {
    const service = new ReservationCalendarService();
    const list = (tenantId: string, propertyNode: string, fromDate: string, toDateExclusive: string) =>
      runtime!.withTenantTransaction(tenantId, tx => service.list(tx, { tenantId, propertyNode, fromDate, toDateExclusive }));
    const page = await list(T, P, "2026-11-01", "2026-11-04");
    expect(page.timezone).toBe("America/New_York");
    expect(page.rooms.map(room => room.sellableUnitId).sort()).toEqual([A, B, EMPTY].sort());
    expect(page.segments.map(segment => segment.segmentId)).toEqual([MOVE1, MOVE2]);
    expect(page.segments.map(segment => [segment.localFromDate, segment.localToDateExclusive])).toEqual([
      ["2026-10-31", "2026-11-02"], ["2026-11-02", "2026-11-04"],
    ]);
    expect(page.segments[0]).toMatchObject({ clipFromDate: "2026-11-01", clipToDateExclusive: "2026-11-02", continuesBefore: true, sellableUnitId: A });
    expect(page.segments[1]).toMatchObject({ clipFromDate: "2026-11-02", clipToDateExclusive: "2026-11-04", outOfService: true, roomCondition: "dirty", sellableUnitId: B });
    expect((await list(T, P, "2026-11-02", "2026-11-03")).segments.map(segment => segment.segmentId)).toEqual([MOVE2]);
    expect((await list(T, P, "2026-11-04", "2026-11-05")).segments).toEqual([]);
    expect((await list(T, OTHER, "2026-11-01", "2026-11-04")).rooms.map(room => room.sellableUnitId)).toEqual([FOREIGN_ROOM]);
    await expect(list(FOREIGN, P, "2026-11-01", "2026-11-04")).rejects.toThrow();
  });

  test("SQL LIMIT+1 exposes room and segment truncation without hiding the cap", async () => {
    const segmentId = (n: number) => `00000000-0000-0000-0000-${String(681600000 + n).padStart(12, "0")}`;
    try {
      await admin!`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name)
        SELECT ('00000000-0000-0000-0000-' || lpad((681500000 + n)::text,12,'0'))::uuid,
               ${T}::uuid,${TYPE}::uuid,'Limit Room ' || n::text
        FROM generate_series(1,501) AS n`;
      await admin!`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,rate_plan_id,status)
        SELECT ('00000000-0000-0000-0000-' || lpad((681600000 + n)::text,12,'0'))::uuid,
               ${T}::uuid,${REZ}::uuid,(100 + n)::smallint,${TYPE}::uuid,${A}::uuid,
               tstzrange('2026-12-01T19:00:00Z','2026-12-02T16:00:00Z','[)'),${RATE}::uuid,'booked'
        FROM generate_series(1,1001) AS n`;
      const page = await runtime!.withTenantTransaction(T, tx => new ReservationCalendarService().list(tx, {
        tenantId: T, propertyNode: P, fromDate: "2026-12-01", toDateExclusive: "2026-12-03",
      }));
      expect(page.rooms).toHaveLength(500);
      expect(page.roomLimit).toBe(500);
      expect(page.roomsLimited).toBe(true);
      expect(page.segments).toHaveLength(1000);
      expect(page.limit).toBe(1000);
      expect(page.limited).toBe(true);
      expect(page.segments.every(segment => segment.reservationId === REZ)).toBe(true);
      expect(page.segments.every(segment => segment.clipFromDate === "2026-12-01" && segment.clipToDateExclusive === "2026-12-02")).toBe(true);
      expect(page.segments.some(segment => segment.segmentId === segmentId(1001))).toBe(false);
    } finally {
      await admin!`DELETE FROM reservation_segment WHERE tenant_id=${T}::uuid AND id IN (
        SELECT ('00000000-0000-0000-0000-' || lpad((681600000 + n)::text,12,'0'))::uuid FROM generate_series(1,1001) AS n)`;
      await admin!`DELETE FROM sellable_unit WHERE tenant_id=${T}::uuid AND id IN (
        SELECT ('00000000-0000-0000-0000-' || lpad((681500000 + n)::text,12,'0'))::uuid FROM generate_series(1,501) AS n)`;
    }
  });
});
