import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  ReservationDetailConflictError,
  ReservationDetailNotFoundError,
  ReservationDetailService,
  ReservationDetailValidationError,
  type FindReservationDetailInput,
} from "../src/contexts/reservations";
import { Database, type Tx } from "../src/kernel";

const URL = process.env.YELLOW_RESERVATION_DETAIL_URL;
if (process.env.YELLOW_REQUIRE_RESERVATION_DETAIL === "1" && !URL) {
  throw new Error("YELLOW_RESERVATION_DETAIL_URL is required by the Order 141 proof");
}

const TENANT_A = "00000000-0000-0000-0000-000000014101";
const TENANT_B = "00000000-0000-0000-0000-000000014102";
const PROPERTY_A = "00000000-0000-0000-0000-000000014111";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000014112";
const PROPERTY_B = "00000000-0000-0000-0000-000000014113";
const PRIMARY_A = "00000000-0000-0000-0000-000000014121";
const ACCOMPANYING_A = "00000000-0000-0000-0000-000000014129";
const SHARER_A = "00000000-0000-0000-0000-000000014122";
const PRIMARY_B = "00000000-0000-0000-0000-000000014123";
const ACTOR_A = "00000000-0000-0000-0000-000000014124";
const RESERVATION_A = "00000000-0000-0000-0000-000000014131";
const RESERVATION_B = "00000000-0000-0000-0000-000000014132";
const SEGMENT_A1 = "00000000-0000-0000-0000-000000014141";
const SEGMENT_A2 = "00000000-0000-0000-0000-000000014142";
const SEGMENT_B = "00000000-0000-0000-0000-000000014143";
const UNIT_A = "00000000-0000-0000-0000-000000014151";
const UNIT_B = "00000000-0000-0000-0000-000000014152";
const RATE_A = "00000000-0000-0000-0000-000000014161";
const RATE_B = "00000000-0000-0000-0000-000000014162";
const ACCOUNT_A = "00000000-0000-0000-0000-000000014171";
const ACCOUNT_B = "00000000-0000-0000-0000-000000014172";
const FOLIO_A1 = "00000000-0000-0000-0000-000000014181";
const FOLIO_A2 = "00000000-0000-0000-0000-000000014182";
const FOLIO_B = "00000000-0000-0000-0000-000000014183";
const ALERT_ACTIVE = "00000000-0000-0000-0000-000000014191";
const ALERT_INACTIVE = "00000000-0000-0000-0000-000000014192";
const ALERT_B = "00000000-0000-0000-0000-000000014193";
const TRAVEL_ARRIVAL = "00000000-0000-0000-0000-000000014201";
const TRAVEL_DEPARTURE = "00000000-0000-0000-0000-000000014202";
const TRAVEL_B = "00000000-0000-0000-0000-000000014203";
const TASK_A = "00000000-0000-0000-0000-000000014204";
const TASK_B = "00000000-0000-0000-0000-000000014205";
const FACT_RES_1 = "00000000-0000-0000-0000-000000014211";
const FACT_SEG_1 = "00000000-0000-0000-0000-000000014212";
const FACT_RES_2 = "00000000-0000-0000-0000-000000014213";
const FACT_UNRELATED = "00000000-0000-0000-0000-000000014214";
const FACT_B = "00000000-0000-0000-0000-000000014215";
const REQUEST_ID = "order-141-request-correlation";

const service = new ReservationDetailService();
const databaseDescribe = URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let database: Database | undefined;

function input(overrides: Partial<FindReservationDetailInput> = {}): FindReservationDetailInput {
  return { tenantId: TENANT_A, propertyNode: PROPERTY_A, confirmationNo: "Y-141-A", ...overrides };
}

function find(detailInput = input(), contextTenant = detailInput.tenantId) {
  return database!.withTenantTransaction(contextTenant, (tx) => service.findByConfirmation(tx, detailInput));
}

async function clean(): Promise<void> {
  if (!admin) return;
  for (const table of ["fact_log", "travel_detail", "task", "alert", "folio", "account",
    "reservation_guest", "reservation_segment", "reservation", "rate_plan", "unit_type", "party", "org_node"]) {
    await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [TENANT_A, TENANT_B]);
  }
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
}

beforeAll(async () => {
  if (!URL) return;
  admin = new SQL(URL, { max: 4 });
  database = Database.connect(URL, { maxConnections: 4 });
  await clean();
  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT_A}::uuid,'order141-a','Order 141 A','shared','active'),
    (${TENANT_B}::uuid,'order141-b','Order 141 B','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order141_a','property','Order 141 A','Asia/Kolkata','INR'),
    (${PROPERTY_A2}::uuid,${TENANT_A}::uuid,'order141_a2','property','Order 141 A2','UTC','USD'),
    (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order141_b','property','Order 141 B','UTC','USD')`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${PRIMARY_A}::uuid,${TENANT_A}::uuid,'person','Primary Guest','active'),
    (${ACCOMPANYING_A}::uuid,${TENANT_A}::uuid,'person','Accompanying Guest','active'),
    (${SHARER_A}::uuid,${TENANT_A}::uuid,'person','Sharer Guest','active'),
    (${ACTOR_A}::uuid,${TENANT_A}::uuid,'person','Operator','active'),
    (${PRIMARY_B}::uuid,${TENANT_B}::uuid,'person','Foreign Guest','active')`;
  await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key) VALUES
    (${UNIT_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O141A','Order 141 A','hotel'),
    (${UNIT_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'O141B','Order 141 B','hotel')`;
  await admin`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,status) VALUES
    (${RATE_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O141A','Order 141 A','INR','active'),
    (${RATE_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'O141B','Order 141 B','USD','active')`;
  await admin`INSERT INTO reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,booker_party,
      channel_code,market_code,source_code,origin_code,currency,eta,etd,notes,created_at
    ) VALUES
    (${RESERVATION_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'Y-141-A','due_in',
      ${PRIMARY_A}::uuid,${ACCOMPANYING_A}::uuid,'direct','LEISURE','WEB','OWN','INR',
      '18:30:00+05:30','10:00:00+05:30','Exact detail','2026-08-25T01:02:03.123456Z'),
    (${RESERVATION_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'Y-141-B','reserved',
      ${PRIMARY_B}::uuid,NULL,'ota',NULL,NULL,NULL,'USD',NULL,NULL,'Foreign detail','2026-08-25T02:00:00Z')`;
  await admin`INSERT INTO reservation_segment(
      id,tenant_id,reservation_id,seq,unit_type_id,period,adults,children,rate_plan_id,price_override,status
    ) VALUES
    (${SEGMENT_A2}::uuid,${TENANT_A}::uuid,${RESERVATION_A}::uuid,2,${UNIT_A}::uuid,
      tstzrange('2026-08-27T06:30:00Z','2026-08-28T05:30:00Z','[)'),1,'[]',${RATE_A}::uuid,NULL,'booked'),
    (${SEGMENT_A1}::uuid,${TENANT_A}::uuid,${RESERVATION_A}::uuid,1,${UNIT_A}::uuid,
      tstzrange('2026-08-25T06:30:00Z','2026-08-27T06:30:00Z','[)'),2,'[{"age":6},{"age":12}]',${RATE_A}::uuid,
      '{"amount_minor":"9007199254740993","currency":"INR","basis":{"kind":"manual"}}','booked'),
    (${SEGMENT_B}::uuid,${TENANT_B}::uuid,${RESERVATION_B}::uuid,1,${UNIT_B}::uuid,
      tstzrange('2026-08-25T00:00:00Z','2026-08-26T00:00:00Z','[)'),1,'[]',${RATE_B}::uuid,NULL,'booked')`;
  await admin`INSERT INTO reservation_guest(tenant_id,reservation_id,party_id,role,share_pct) VALUES
    (${TENANT_A}::uuid,${RESERVATION_A}::uuid,${PRIMARY_A}::uuid,'primary',NULL),
    (${TENANT_A}::uuid,${RESERVATION_A}::uuid,${SHARER_A}::uuid,'sharer',37.50),
    (${TENANT_A}::uuid,${RESERVATION_A}::uuid,${ACCOMPANYING_A}::uuid,'accompanying',NULL),
    (${TENANT_B}::uuid,${RESERVATION_B}::uuid,${PRIMARY_B}::uuid,'primary',NULL)`;
  await admin`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES
    (${ACCOUNT_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'guest',${PRIMARY_A}::uuid,'Guest A','INR','open'),
    (${ACCOUNT_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'guest',${PRIMARY_B}::uuid,'Guest B','USD','open')`;
  await admin`INSERT INTO folio(id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status) VALUES
    (${FOLIO_A2}::uuid,${TENANT_A}::uuid,${ACCOUNT_A}::uuid,${RESERVATION_A}::uuid,'O141-2',2,'Incidentals','settled'),
    (${FOLIO_A1}::uuid,${TENANT_A}::uuid,${ACCOUNT_A}::uuid,${RESERVATION_A}::uuid,'O141-1',1,'Primary','open'),
    (${FOLIO_B}::uuid,${TENANT_B}::uuid,${ACCOUNT_B}::uuid,${RESERVATION_B}::uuid,'O141-B',1,'Foreign','open')`;
  await admin`INSERT INTO alert(id,tenant_id,subject_type,subject_id,code,message,show_on,active) VALUES
    (${ALERT_INACTIVE}::uuid,${TENANT_A}::uuid,'reservation',${RESERVATION_A}::uuid,'OLD','Inactive','checkout',false),
    (${ALERT_ACTIVE}::uuid,${TENANT_A}::uuid,'reservation',${RESERVATION_A}::uuid,'VIP','Active','always',true),
    (${ALERT_B}::uuid,${TENANT_B}::uuid,'reservation',${RESERVATION_B}::uuid,'FOREIGN','Foreign','always',true)`;
  await admin`INSERT INTO task(id,tenant_id,property_node,kind,status,subject_type,subject_id,payload) VALUES
    (${TASK_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'guest_request','open','reservation',${RESERVATION_A}::uuid,'{}'),
    (${TASK_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'guest_request','open','reservation',${RESERVATION_B}::uuid,'{}')`;
  await admin`INSERT INTO travel_detail(
      id,tenant_id,reservation_id,direction,mode,carrier,service_no,scheduled_at,pickup_requested,pickup_task_id,notes
    ) VALUES
    (${TRAVEL_DEPARTURE}::uuid,${TENANT_A}::uuid,${RESERVATION_A}::uuid,'departure','car',NULL,NULL,
      '2026-08-28T05:30:00.654321Z',false,NULL,'Guest car'),
    (${TRAVEL_ARRIVAL}::uuid,${TENANT_A}::uuid,${RESERVATION_A}::uuid,'arrival','flight','Air India','AI141',
      '2026-08-25T12:34:56.123456Z',true,${TASK_A}::uuid,'Meet at gate'),
    (${TRAVEL_B}::uuid,${TENANT_B}::uuid,${RESERVATION_B}::uuid,'arrival','train','Foreign Rail','B141',
      '2026-08-25T10:00:00Z',false,NULL,NULL)`;
  await admin`INSERT INTO fact_log(
      id,tenant_id,entity_type,entity_id,fact_type,valid_from,valid_to,recorded_at,business_date,actor_id,payload,supersedes
    ) VALUES
    (${FACT_RES_1}::uuid,${TENANT_A}::uuid,'reservation',${RESERVATION_A}::uuid,'reservation.confirmed',
      '2026-08-25T00:00:00.000001Z',NULL,'2026-08-25T00:00:01.000001Z','2026-08-25',${ACTOR_A}::uuid,
      ${JSON.stringify({ request_id: REQUEST_ID, nested: { keep: [1, "two", true] } })}::text::jsonb,NULL),
    (${FACT_SEG_1}::uuid,${TENANT_A}::uuid,'reservation_segment',${SEGMENT_A1}::uuid,'segment.moved',
      '2026-08-25T00:00:00.000002Z','2026-08-27T06:30:00.000000Z','2026-08-25T00:00:02.000001Z','2026-08-25',NULL,
      '{"request_id":42,"from":"A","to":"B"}',NULL),
    (${FACT_RES_2}::uuid,${TENANT_A}::uuid,'reservation',${RESERVATION_A}::uuid,'reservation.modified',
      '2026-08-25T00:00:00.000003Z',NULL,'2026-08-25T00:00:02.000001Z','2026-08-25',${ACTOR_A}::uuid,
      '{"request_id":"second","notes":{"before":null,"after":"Exact detail"}}',${FACT_RES_1}::uuid),
    (${FACT_UNRELATED}::uuid,${TENANT_A}::uuid,'reservation_segment',${SEGMENT_B}::uuid,'segment.foreign',
      '2026-08-25T00:00:00Z',NULL,'2026-08-25T00:00:00Z','2026-08-25',NULL,'{}',NULL),
    (${FACT_B}::uuid,${TENANT_B}::uuid,'reservation',${RESERVATION_B}::uuid,'reservation.foreign',
      '2026-08-25T00:00:00Z',NULL,'2026-08-25T00:00:00Z','2026-08-25',NULL,'{}',NULL)`;
}, 30_000);

afterAll(async () => {
  await clean();
  await database?.close();
  await admin?.close();
}, 60_000);

describe("Order 141 reservation detail/history read model", () => {
  test("P0: planned public read model exists", () => {
    expect(ReservationDetailService).toBeDefined();
    expect(ReservationDetailValidationError).toBeDefined();
    expect(ReservationDetailNotFoundError).toBeDefined();
  });

  test("P2: malformed input fails before SQL", async () => {
    let calls = 0;
    const noSql = (() => { calls += 1; return Promise.resolve([]); }) as unknown as Tx;
    const invalid = [input({ tenantId: "BAD" }), input({ propertyNode: "BAD" }),
      input({ confirmationNo: "" }), input({ confirmationNo: "contains space" }),
      input({ confirmationNo: "x".repeat(121) }), input({ confirmationNo: "bad\nline" }),
      { ...input(), reservationId: RESERVATION_A }, Object.create(input())] as unknown[];
    for (const candidate of invalid) {
      await expect(service.findByConfirmation(noSql, candidate as FindReservationDetailInput))
        .rejects.toBeInstanceOf(ReservationDetailValidationError);
    }
    expect(calls).toBe(0);
  });
});

databaseDescribe("Order 141 fresh-PostgreSQL reservation detail proof", () => {
  test("P1: aggregate is exact, ordered, deeply frozen and read-only", async () => {
    const counts = () => admin!<Array<Record<string, number>>>`SELECT
      (SELECT count(*)::int FROM reservation WHERE tenant_id=${TENANT_A}::uuid) reservations,
      (SELECT count(*)::int FROM reservation_segment WHERE tenant_id=${TENANT_A}::uuid) segments,
      (SELECT count(*)::int FROM reservation_guest WHERE tenant_id=${TENANT_A}::uuid) guests,
      (SELECT count(*)::int FROM folio WHERE tenant_id=${TENANT_A}::uuid) folios,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid) events`;
    const before = (await counts())[0]!;
    const detail = await find();
    expect(await find()).toEqual(detail);
    expect((await counts())[0]!).toEqual(before);
    expect(detail).toMatchObject({
      reservationId: RESERVATION_A, confirmationNo: "Y-141-A", status: "due_in",
      primaryPartyId: PRIMARY_A, bookerPartyId: ACCOMPANYING_A, groupId: null,
      channelCode: "direct", marketCode: "LEISURE", sourceCode: "WEB", originCode: "OWN",
      currency: "INR", guaranteePolicyId: null, eta: "18:30:00+05:30", etd: "10:00:00+05:30",
      notes: "Exact detail", createdAt: "2026-08-25T01:02:03.123456Z",
      cancelledAt: null, cancelReason: null, cancellationNo: null,
    });
    expect(detail.segments).toEqual([
      { segmentId: SEGMENT_A1, sequence: 1, unitTypeId: UNIT_A, sellableUnitId: null,
        from: "2026-08-25T06:30:00.000000Z", to: "2026-08-27T06:30:00.000000Z", adults: 2,
        childAges: [6, 12], ratePlanId: RATE_A,
        priceOverride: { amount_minor: "9007199254740993", currency: "INR", basis: { kind: "manual" } },
        status: "booked" },
      { segmentId: SEGMENT_A2, sequence: 2, unitTypeId: UNIT_A, sellableUnitId: null,
        from: "2026-08-27T06:30:00.000000Z", to: "2026-08-28T05:30:00.000000Z", adults: 1,
        childAges: [], ratePlanId: RATE_A, priceOverride: null, status: "booked" },
    ]);
    expect(detail.guests).toEqual([
      { partyId: PRIMARY_A, displayName: "Primary Guest", role: "primary", sharePct: null },
      { partyId: ACCOMPANYING_A, displayName: "Accompanying Guest", role: "accompanying", sharePct: null },
      { partyId: SHARER_A, displayName: "Sharer Guest", role: "sharer", sharePct: "37.50" },
    ]);
    expect(detail.folios).toEqual([
      { folioId: FOLIO_A1, accountId: ACCOUNT_A, folioNo: "O141-1", windowNo: 1, name: "Primary", status: "open" },
      { folioId: FOLIO_A2, accountId: ACCOUNT_A, folioNo: "O141-2", windowNo: 2, name: "Incidentals", status: "settled" },
    ]);
    expect(detail.alerts).toEqual([
      { alertId: ALERT_ACTIVE, code: "VIP", message: "Active", showOn: "always", active: true },
      { alertId: ALERT_INACTIVE, code: "OLD", message: "Inactive", showOn: "checkout", active: false },
    ]);
    expect(detail.travel).toEqual([
      { travelId: TRAVEL_ARRIVAL, direction: "arrival", mode: "flight", carrier: "Air India",
        serviceNo: "AI141", scheduledAt: "2026-08-25T12:34:56.123456Z", pickupRequested: true,
        pickupTaskId: TASK_A, notes: "Meet at gate" },
      { travelId: TRAVEL_DEPARTURE, direction: "departure", mode: "car", carrier: null,
        serviceNo: null, scheduledAt: "2026-08-28T05:30:00.654321Z", pickupRequested: false,
        pickupTaskId: null, notes: "Guest car" },
    ]);
    expect(Object.isFrozen(detail)).toBe(true);
    expect(Object.isFrozen(detail.segments)).toBe(true);
    expect(Object.isFrozen(detail.segments[0]!.childAges)).toBe(true);
    expect(Object.isFrozen(detail.segments[0]!.priceOverride)).toBe(true);
    expect(Object.isFrozen((detail.segments[0]!.priceOverride as Record<string, unknown>).basis)).toBe(true);
  });

  test("P2: property, tenant, missing and malformed stored boundaries fail closed", async () => {
    await expect(find(input({ propertyNode: PROPERTY_A2 }))).rejects.toBeInstanceOf(ReservationDetailNotFoundError);
    await expect(find(input({ confirmationNo: "MISSING" }))).rejects.toBeInstanceOf(ReservationDetailNotFoundError);
    await expect(find(input({ tenantId: TENANT_B, propertyNode: PROPERTY_B }), TENANT_B))
      .rejects.toBeInstanceOf(ReservationDetailNotFoundError);
    await expect(find(input(), TENANT_B)).rejects.toBeInstanceOf(ReservationDetailNotFoundError);

    await admin!`UPDATE reservation_segment SET children='[{"age":"six"}]'::jsonb WHERE id=${SEGMENT_A1}::uuid`;
    await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE reservation_segment SET children='[{"age":6},{"age":12}]'::jsonb WHERE id=${SEGMENT_A1}::uuid`;

    await admin!`UPDATE reservation_segment
      SET period=tstzrange(NULL,'2026-08-27T06:30:00Z','()') WHERE id=${SEGMENT_A1}::uuid`;
    await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE reservation_segment
      SET period=tstzrange('2026-08-25T06:30:00Z',NULL,'[)') WHERE id=${SEGMENT_A1}::uuid`;
    await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE reservation_segment SET period='empty'::tstzrange WHERE id=${SEGMENT_A1}::uuid`;
    await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE reservation_segment
      SET period=tstzrange('2026-08-25T06:30:00Z','2026-08-27T06:30:00Z','(]') WHERE id=${SEGMENT_A1}::uuid`;
    await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE reservation_segment
      SET period=tstzrange('2026-08-25T06:30:00Z','2026-08-27T06:30:00Z','[)') WHERE id=${SEGMENT_A1}::uuid`;

    await admin!`UPDATE reservation SET primary_party=${PRIMARY_B}::uuid WHERE id=${RESERVATION_A}::uuid`;
    await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE reservation SET primary_party=${PRIMARY_A}::uuid WHERE id=${RESERVATION_A}::uuid`;

    await admin!`UPDATE reservation SET booker_party=${PRIMARY_B}::uuid WHERE id=${RESERVATION_A}::uuid`;
    await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE reservation SET booker_party=${ACCOMPANYING_A}::uuid WHERE id=${RESERVATION_A}::uuid`;

    await admin!`UPDATE reservation SET property_node=${PROPERTY_B}::uuid WHERE id=${RESERVATION_A}::uuid`;
    await expect(find(input({ propertyNode: PROPERTY_B }))).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE reservation SET property_node=${PROPERTY_A}::uuid WHERE id=${RESERVATION_A}::uuid`;

    await admin!`UPDATE reservation_guest SET party_id=${PRIMARY_B}::uuid
      WHERE tenant_id=${TENANT_A}::uuid AND reservation_id=${RESERVATION_A}::uuid AND party_id=${PRIMARY_A}::uuid`;
    await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE reservation_guest SET party_id=${PRIMARY_A}::uuid
      WHERE tenant_id=${TENANT_A}::uuid AND reservation_id=${RESERVATION_A}::uuid AND party_id=${PRIMARY_B}::uuid`;

    await admin!`UPDATE reservation_segment SET unit_type_id=${UNIT_B}::uuid WHERE id=${SEGMENT_A1}::uuid`;
    await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE reservation_segment SET unit_type_id=${UNIT_A}::uuid WHERE id=${SEGMENT_A1}::uuid`;

    await admin!`UPDATE reservation_segment SET rate_plan_id=${RATE_B}::uuid WHERE id=${SEGMENT_A1}::uuid`;
    await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE reservation_segment SET rate_plan_id=${RATE_A}::uuid WHERE id=${SEGMENT_A1}::uuid`;

    await admin!`UPDATE account SET property_node=${PROPERTY_A2}::uuid WHERE id=${ACCOUNT_A}::uuid`;
    await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE account SET property_node=NULL WHERE id=${ACCOUNT_A}::uuid`;
    await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE account SET property_node=${PROPERTY_A}::uuid WHERE id=${ACCOUNT_A}::uuid`;

    await admin!`UPDATE travel_detail SET pickup_task_id=${TASK_B}::uuid WHERE id=${TRAVEL_ARRIVAL}::uuid`;
    await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE travel_detail SET pickup_task_id=${TASK_A}::uuid WHERE id=${TRAVEL_ARRIVAL}::uuid`;

    await admin!`UPDATE fact_log SET supersedes=${FACT_B}::uuid WHERE id=${FACT_RES_2}::uuid`;
    await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE fact_log SET supersedes=${FACT_RES_1}::uuid WHERE id=${FACT_RES_2}::uuid`;

    const tenantBVisible = await database!.withTenantTransaction(TENANT_B, async (tx) => ({
      parties: (await tx<Array<{ n: number }>>`SELECT count(*)::int n FROM party WHERE tenant_id=${TENANT_A}::uuid`)[0]!.n,
      folios: (await tx<Array<{ n: number }>>`SELECT count(*)::int n FROM folio WHERE tenant_id=${TENANT_A}::uuid`)[0]!.n,
      alerts: (await tx<Array<{ n: number }>>`SELECT count(*)::int n FROM alert WHERE tenant_id=${TENANT_A}::uuid`)[0]!.n,
      travel: (await tx<Array<{ n: number }>>`SELECT count(*)::int n FROM travel_detail WHERE tenant_id=${TENANT_A}::uuid`)[0]!.n,
      facts: (await tx<Array<{ n: number }>>`SELECT count(*)::int n FROM fact_log WHERE tenant_id=${TENANT_A}::uuid`)[0]!.n,
    }));
    expect(tenantBVisible).toEqual({ parties: 0, folios: 0, alerts: 0, travel: 0, facts: 0 });
  });

  test("P3: append-only history is chronological, complete and narrowly correlated", async () => {
    const history = (await find()).history;
    expect(history.map((fact) => fact.factId)).toEqual([FACT_RES_1, FACT_SEG_1, FACT_RES_2]);
    expect(history).toEqual([
      { factId: FACT_RES_1, entityType: "reservation", entityId: RESERVATION_A,
        factType: "reservation.confirmed", validFrom: "2026-08-25T00:00:00.000001Z", validTo: null,
        recordedAt: "2026-08-25T00:00:01.000001Z", businessDate: "2026-08-25", actorId: ACTOR_A,
        payload: { request_id: REQUEST_ID, nested: { keep: [1, "two", true] } },
        supersedes: null, requestCorrelationId: REQUEST_ID },
      { factId: FACT_SEG_1, entityType: "reservation_segment", entityId: SEGMENT_A1,
        factType: "segment.moved", validFrom: "2026-08-25T00:00:00.000002Z",
        validTo: "2026-08-27T06:30:00.000000Z", recordedAt: "2026-08-25T00:00:02.000001Z",
        businessDate: "2026-08-25", actorId: null, payload: { request_id: 42, from: "A", to: "B" },
        supersedes: null, requestCorrelationId: null },
      { factId: FACT_RES_2, entityType: "reservation", entityId: RESERVATION_A,
        factType: "reservation.modified", validFrom: "2026-08-25T00:00:00.000003Z", validTo: null,
        recordedAt: "2026-08-25T00:00:02.000001Z", businessDate: "2026-08-25", actorId: ACTOR_A,
        payload: { request_id: "second", notes: { before: null, after: "Exact detail" } },
        supersedes: FACT_RES_1, requestCorrelationId: "second" },
    ]);
    expect(history.some((fact) => fact.factId === FACT_UNRELATED)).toBe(false);
    expect(Object.isFrozen(history)).toBe(true);
    expect(Object.isFrozen(history[0]!.payload)).toBe(true);
    expect(Object.isFrozen((history[0]!.payload as Record<string, unknown>).nested)).toBe(true);
  });
});
