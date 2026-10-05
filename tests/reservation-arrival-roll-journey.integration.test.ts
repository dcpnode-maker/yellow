import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  HoldService,
  ReservationOccupancyService,
} from "../src/contexts/inventory";
import {
  ReservationArrivalRollService,
  ReservationBoardService,
  ReservationCommitService,
  ReservationDetailService,
} from "../src/contexts/reservations";
import { CheckInService } from "../src/contexts/stay-operations";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
} from "../src/kernel";

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESERVATION_ARRIVAL_ROLL === "1";

if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error("Order 232 journey proof requires deploy and runtime database URLs");
}

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
const TENANT = "00000000-0000-0000-0000-000000023271";
const PROPERTY = "00000000-0000-0000-0000-000000023272";
const ACTOR = "00000000-0000-0000-0000-000000023273";
const PARTY = "00000000-0000-0000-0000-000000023274";
const UNIT_TYPE = "00000000-0000-0000-0000-000000023275";
const SPACE = "00000000-0000-0000-0000-000000023276";
const SELLABLE = "00000000-0000-0000-0000-000000023277";
const RATE_PLAN = "00000000-0000-0000-0000-000000023278";
const RESERVATION = "00000000-0000-0000-0000-000000023279";
const SEGMENT = "00000000-0000-0000-0000-000000023280";

let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let businessDate = "";
let arrival = new Date(0);
let departure = new Date(0);
let todayEnd = new Date(0);

function envelope(operation: "reservation.confirmed" | "reservation.due_in") {
  return createAuditEnvelope({
    actorId: ACTOR,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    requestId: crypto.randomUUID(),
    operation,
  });
}

async function cleanup(): Promise<void> {
  if (!admin) return;
  const occupancy = await admin<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM space_occupancy
      WHERE tenant_id=${TENANT}::uuid AND slot_ref=${SEGMENT}::uuid
    ) AS exists
  `;
  if (occupancy[0]?.exists) {
    await admin`SELECT public.release_occupancy(${TENANT}::uuid, ${SEGMENT}::uuid)`;
  }
  for (const table of [
    "outbox",
    "fact_log",
    "api_idempotency",
    "reservation_guest",
    "reservation_segment",
    "reservation",
    "sellable_unit_space",
    "sellable_unit",
    "space",
    "unit_type",
    "rate_plan",
    "party",
    "app_user",
    "org_node",
  ]) {
    await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id=$1::uuid`, [TENANT]);
  }
  await admin`DELETE FROM tenant WHERE id=${TENANT}::uuid`;
}

beforeAll(async () => {
  if (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL) return;
  admin = new SQL(DEPLOY_DATABASE_URL, { max: 2, prepare: false });
  eventPool = new SQL(RUNTIME_DATABASE_URL, { max: 2, prepare: false });
  database = Database.connect(RUNTIME_DATABASE_URL, { maxConnections: 8, prepare: false });
  await cleanup();

  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES(
    ${TENANT}::uuid,'order232-journey','Order 232 journey','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES(
    ${PROPERTY}::uuid,${TENANT}::uuid,'order232_journey','property',
    'Order 232 journey','Asia/Kolkata','INR')`;
  await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(
    ${ACTOR}::uuid,${TENANT}::uuid,'order232-journey@yellow.test','Arrival worker','active')`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(
    ${PARTY}::uuid,${TENANT}::uuid,'person','Committed arrival','active')`;
  await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES(
    ${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O232J','Journey room','hotel',2)`;
  await admin`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status) VALUES(
    ${SPACE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O232J','hotel',1,'active')`;
  await admin`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES(
    ${SELLABLE}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,'Journey room','active')`;
  await admin`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode) VALUES(
    ${TENANT}::uuid,${SELLABLE}::uuid,${SPACE}::uuid,'exclusive')`;
  await admin`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,status) VALUES(
    ${RATE_PLAN}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O232J','Journey BAR','INR','active')`;

  const clock = (await admin<Array<{
    business_date: string;
    arrival: string;
    today_end: string;
    departure: string;
  }>>`
    WITH property_clock AS (
      SELECT property.timezone,
             (transaction_timestamp() AT TIME ZONE property.timezone)::date AS business_date
      FROM org_node AS property
      WHERE property.tenant_id=${TENANT}::uuid AND property.id=${PROPERTY}::uuid
    )
    SELECT business_date::text AS business_date,
           to_char((business_date::timestamp AT TIME ZONE timezone) AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS arrival,
           to_char(((business_date + 1)::timestamp AT TIME ZONE timezone) AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS today_end,
           to_char(((business_date + 2)::timestamp AT TIME ZONE timezone) AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS departure
    FROM property_clock
  `)[0];
  if (!clock) throw new Error("PostgreSQL returned no property-local journey clock");
  businessDate = clock.business_date;
  arrival = new Date(clock.arrival);
  todayEnd = new Date(clock.today_end);
  departure = new Date(clock.departure);
});

afterAll(async () => {
  await cleanup();
  await database?.close();
  await eventPool?.close({ timeout: 0 });
  await admin?.close({ timeout: 0 });
}, 30_000);

databaseDescribe("Order 232 committed arrival journey", () => {
  test("a real direct commit rolls on the property-local arrival date into Today and check-in truth", async () => {
    const events = new PostgresEventBus(eventPool!);
    const idempotency = new PostgresIdempotency();
    const ids = [RESERVATION, SEGMENT];
    const commits = new ReservationCommitService({
      holds: new HoldService(events),
      occupancy: new ReservationOccupancyService(events),
      events,
      idempotency,
      idFactory: () => ids.shift() ?? crypto.randomUUID(),
    });
    const rolls = new ReservationArrivalRollService({ database: database!, events, idempotency });
    const board = new ReservationBoardService();
    const detail = new ReservationDetailService();
    const checkIns = new CheckInService({ database: database!, events, idempotency });

    const committed = await database!.withTenantTransaction(TENANT, (tx) => commits.commitDirect(tx, {
      sellableUnitId: SELLABLE,
      from: arrival,
      to: departure,
      primaryPartyId: PARTY,
      ratePlanId: RATE_PLAN,
      adults: 1,
      childAges: [],
      channelCode: "direct",
      idempotencyKey: "order232-real-commit-journey",
      envelope: envelope("reservation.confirmed"),
    }));
    expect(committed).toMatchObject({
      reservationId: RESERVATION,
      segmentId: SEGMENT,
      status: "reserved",
      source: "direct",
      claimCount: 1,
      replayed: false,
    });

    const today = () => database!.withTenantTransaction(TENANT, (tx) => board.list(tx, {
      tenantId: TENANT,
      propertyNode: PROPERTY,
      status: "due_in",
      from: arrival,
      to: todayEnd,
      limit: 100,
    }));
    const reservationDetail = () => database!.withTenantTransaction(TENANT, (tx) => detail.findById(tx, {
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: RESERVATION,
    }));
    const readiness = () => checkIns.getReadiness({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: RESERVATION,
      dirtyRoomOverrideAuthorized: false,
    });

    expect((await today()).reservations).toEqual([]);
    expect((await reservationDetail()).status).toBe("reserved");
    expect((await readiness()).blockers).toContain("reservation_not_due_in");

    const rolled = await rolls.rollDueArrivals({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      limit: 100,
      envelope: envelope("reservation.due_in"),
    });
    expect(rolled).toEqual({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      businessDate,
      examined: 1,
      transitioned: 1,
      arrivals: [{ reservationId: RESERVATION, segmentId: SEGMENT, businessDate }],
    });

    const dueInToday = await today();
    expect(dueInToday.reservations).toHaveLength(1);
    expect(dueInToday.reservations[0]).toMatchObject({
      reservationId: RESERVATION,
      confirmationNo: committed.confirmationNo,
      status: "due_in",
      primaryGuestDisplayName: "Committed arrival",
      stayFrom: arrival.toISOString().replace(".000Z", ".000000Z"),
      stayTo: departure.toISOString().replace(".000Z", ".000000Z"),
    });

    const rolledDetail = await reservationDetail();
    expect(rolledDetail.status).toBe("due_in");
    expect(rolledDetail.segments).toMatchObject([{ segmentId: SEGMENT, status: "booked" }]);
    expect(rolledDetail.history.map(({ factType }) => factType).sort())
      .toEqual(["occupancy.recorded", "reservation.confirmed", "reservation.due_in"].sort());

    const rolledReadiness = await readiness();
    expect(rolledReadiness).toMatchObject({
      reservationId: RESERVATION,
      status: "due_in",
      segmentId: SEGMENT,
      assignedSpaceId: SPACE,
      canCheckIn: false,
    });
    expect(rolledReadiness.blockers).not.toContain("reservation_not_due_in");
    expect(rolledReadiness.blockers).not.toContain("active_segment_missing");
    expect(rolledReadiness.blockers).not.toContain("room_assignment_missing");
    expect(rolledReadiness.blockers).not.toContain("room_mapping_invalid");
    expect(rolledReadiness.blockers).toEqual(["room_condition_missing", "primary_folio_not_open"]);
  }, 30_000);
});
