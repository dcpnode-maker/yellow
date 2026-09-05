import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  RESERVATION_DEPARTURE_ROLL_ACTOR_ID,
  ReservationBoardService,
  ReservationDepartureRollService,
  ReservationDetailService,
  type RollDueDeparturesInput,
} from "../src/contexts/reservations";
import { CheckoutReadinessService } from "../src/contexts/stay-operations";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
} from "../src/kernel";

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESERVATION_DEPARTURE_ROLL === "1";

if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error("Order 233 journey proof requires deploy and runtime database URLs");
}

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
const TENANT = "00000000-0000-0000-0000-000000023371";
const PROPERTY = "00000000-0000-0000-0000-000000023372";
const ACTOR = RESERVATION_DEPARTURE_ROLL_ACTOR_ID;
const PARTY = "00000000-0000-0000-0000-000000023374";
const UNIT_TYPE = "00000000-0000-0000-0000-000000023375";
const SPACE = "00000000-0000-0000-0000-000000023376";
const SELLABLE = "00000000-0000-0000-0000-000000023377";
const RATE_PLAN = "00000000-0000-0000-0000-000000023378";
const RESERVATION = "00000000-0000-0000-0000-000000023379";
const SEGMENT = "00000000-0000-0000-0000-000000023380";
const ACCOUNT = "00000000-0000-0000-0000-000000023381";
const FOLIO = "00000000-0000-0000-0000-000000023382";

let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let businessDate = "";
let arrival = new Date(0);
let departure = new Date(0);
let todayEnd = new Date(0);

function envelope(): RollDueDeparturesInput["envelope"] {
  return createAuditEnvelope({
    actorId: ACTOR,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    requestId: crypto.randomUUID(),
    operation: "reservation.due_out",
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
    "folio",
    "account",
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
    ${TENANT}::uuid,'order233-journey','Order 233 journey','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES(
    ${PROPERTY}::uuid,${TENANT}::uuid,'order233_journey','property',
    'Order 233 journey','Asia/Kolkata','INR')`;
  await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(
    ${ACTOR}::uuid,${TENANT}::uuid,'order233-journey@yellow.test','Departure worker','active')`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(
    ${PARTY}::uuid,${TENANT}::uuid,'person','Departing guest','active')`;
  await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES(
    ${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O233J','Journey room','hotel',2)`;
  await admin`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status) VALUES(
    ${SPACE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O233J','hotel',1,'active')`;
  await admin`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES(
    ${SELLABLE}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,'Journey room','active')`;
  await admin`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode) VALUES(
    ${TENANT}::uuid,${SELLABLE}::uuid,${SPACE}::uuid,'exclusive')`;
  await admin`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,status) VALUES(
    ${RATE_PLAN}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O233J','Journey BAR','INR','active')`;

  const clock = (await admin<Array<{
    business_date: string;
    arrival: string;
    departure: string;
    today_end: string;
  }>>`
    WITH property_clock AS (
      SELECT property.timezone,
             (transaction_timestamp() AT TIME ZONE property.timezone)::date AS business_date
      FROM org_node AS property
      WHERE property.tenant_id=${TENANT}::uuid AND property.id=${PROPERTY}::uuid
    )
    SELECT business_date::text AS business_date,
           to_char(((business_date - 2)::timestamp AT TIME ZONE timezone) AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS arrival,
           to_char((business_date::timestamp AT TIME ZONE timezone) AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS departure,
           to_char(((business_date + 1)::timestamp AT TIME ZONE timezone) AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS today_end
    FROM property_clock
  `)[0];
  if (!clock) throw new Error("PostgreSQL returned no property-local journey clock");
  businessDate = clock.business_date;
  arrival = new Date(clock.arrival);
  departure = new Date(clock.departure);
  todayEnd = new Date(clock.today_end);

  await admin`INSERT INTO reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
    ) VALUES(
      ${RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O233-JOURNEY','in_house',
      ${PARTY}::uuid,'direct','INR'
    )`;
  await admin`INSERT INTO reservation_guest(tenant_id,reservation_id,party_id,role) VALUES(
    ${TENANT}::uuid,${RESERVATION}::uuid,${PARTY}::uuid,'primary')`;
  await admin`INSERT INTO reservation_segment(
      id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,
      adults,children,rate_plan_id,status
    ) VALUES(
      ${SEGMENT}::uuid,${TENANT}::uuid,${RESERVATION}::uuid,1,${UNIT_TYPE}::uuid,
      ${SELLABLE}::uuid,
      tstzrange(${arrival.toISOString()}::timestamptz,${departure.toISOString()}::timestamptz,'[)'),
      1,'[]'::jsonb,${RATE_PLAN}::uuid,'in_house'
    )`;
  await database.withTenantTransaction(TENANT, async (tx) => {
    await tx`SELECT public.record_occupancy(
      ${TENANT}::uuid,${SPACE}::uuid,
      tstzrange(${arrival.toISOString()}::timestamptz,${departure.toISOString()}::timestamptz,'[)'),
      ${SEGMENT}::uuid,'segment',true
    )`;
  });
  await admin`INSERT INTO account(
      id,tenant_id,property_node,role,party_id,name,currency,status
    ) VALUES(
      ${ACCOUNT}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${PARTY}::uuid,
      'Order 233 guest account','INR','open'
    )`;
  await admin`INSERT INTO folio(
      id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status
    ) VALUES(
      ${FOLIO}::uuid,${TENANT}::uuid,${ACCOUNT}::uuid,${RESERVATION}::uuid,
      'O233-F1',1,'Primary','settled'
    )`;
});

afterAll(async () => {
  await cleanup();
  await database?.close();
  await eventPool?.close({ timeout: 0 });
  await admin?.close({ timeout: 0 });
}, 30_000);

databaseDescribe("Order 233 in-house departure journey", () => {
  test("a real current in-house segment rolls into Today, detail and checkout readiness without checkout", async () => {
    const events = new PostgresEventBus(eventPool!);
    const idempotency = new PostgresIdempotency();
    const rolls = new ReservationDepartureRollService({ database: database!, events, idempotency });
    const board = new ReservationBoardService();
    const detail = new ReservationDetailService();
    const readiness = new CheckoutReadinessService({ database: database! });

    const today = () => database!.withTenantTransaction(TENANT, (tx) => board.list(tx, {
      tenantId: TENANT,
      propertyNode: PROPERTY,
      status: "due_out",
      from: arrival,
      to: todayEnd,
      limit: 100,
    }));
    const reservationDetail = () => database!.withTenantTransaction(TENANT, (tx) => detail.findById(tx, {
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: RESERVATION,
    }));
    const checkoutReadiness = () => readiness.read({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: RESERVATION,
    });

    expect((await today()).reservations).toEqual([]);
    expect(await reservationDetail()).toMatchObject({
      reservationId: RESERVATION,
      status: "in_house",
      segments: [{ segmentId: SEGMENT, status: "in_house" }],
    });
    expect(await checkoutReadiness()).toMatchObject({
      reservationId: RESERVATION,
      reservationStatus: "in_house",
      ready: true,
      blockers: [],
      segment: { segmentId: SEGMENT, sellableUnitId: SELLABLE },
      room: { spaceId: SPACE, spaceCode: "O233J" },
      folios: [{ folioId: FOLIO, status: "settled", balanceMinor: "0" }],
    });

    const rolled = await rolls.rollDueDepartures({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      limit: 100,
      envelope: envelope(),
    });
    expect(rolled).toEqual({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      businessDate,
      examined: 1,
      transitioned: 1,
      departures: [{ reservationId: RESERVATION, segmentId: SEGMENT, businessDate }],
    });

    const dueOutToday = await today();
    expect(dueOutToday.reservations).toHaveLength(1);
    expect(dueOutToday.reservations[0]).toMatchObject({
      reservationId: RESERVATION,
      confirmationNo: "O233-JOURNEY",
      status: "due_out",
      primaryGuestDisplayName: "Departing guest",
      stayFrom: arrival.toISOString().replace(".000Z", ".000000Z"),
      stayTo: departure.toISOString().replace(".000Z", ".000000Z"),
    });

    const rolledDetail = await reservationDetail();
    expect(rolledDetail.status).toBe("due_out");
    expect(rolledDetail.segments).toMatchObject([{ segmentId: SEGMENT, status: "in_house" }]);
    expect(rolledDetail.history.map(({ factType }) => factType)).toEqual(["reservation.due_out"]);

    expect(await checkoutReadiness()).toMatchObject({
      reservationId: RESERVATION,
      reservationStatus: "due_out",
      ready: true,
      blockers: [],
      segment: { segmentId: SEGMENT, sellableUnitId: SELLABLE },
      occupancy: { periodStart: arrival.toISOString(), periodEnd: departure.toISOString() },
      folios: [{ folioId: FOLIO, status: "settled", balanceMinor: "0" }],
    });

    const forbiddenCheckout = await admin!<Array<{
      checked_out_facts: number;
      checked_out_events: number;
      occupancy_count: number;
    }>>`
      SELECT
        (SELECT count(*)::int FROM fact_log
          WHERE tenant_id=${TENANT}::uuid AND entity_type='reservation'
            AND entity_id=${RESERVATION}::uuid AND fact_type='reservation.checked_out') AS checked_out_facts,
        (SELECT count(*)::int FROM outbox
          WHERE tenant_id=${TENANT}::uuid AND aggregate_type='reservation'
            AND aggregate_id=${RESERVATION}::uuid AND event_type='reservation.checked_out') AS checked_out_events,
        (SELECT count(*)::int FROM space_occupancy
          WHERE tenant_id=${TENANT}::uuid AND slot_ref=${SEGMENT}::uuid) AS occupancy_count
    `;
    expect(forbiddenCheckout[0]).toEqual({
      checked_out_facts: 0,
      checked_out_events: 0,
      occupancy_count: 1,
    });
  }, 30_000);
});
