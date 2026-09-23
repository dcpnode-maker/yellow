import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { ReservationDepartureRollService } from "../src/contexts/reservations";
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

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESERVATION_DEPARTURE_ROLL === "1";

if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error("Order 233 database proof requires deploy and runtime database URLs");
}

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
const TENANT = "00000000-0000-0000-0000-000000023301";
const PROPERTY = "00000000-0000-0000-0000-000000023311";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000023312";
const ACTOR = "00000000-0000-0000-0000-000000023321";
const PARTY = "00000000-0000-0000-0000-000000023331";
const UNIT_TYPE = "00000000-0000-0000-0000-000000023341";
const RATE = "00000000-0000-0000-0000-000000023351";

let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let businessDate = "";
let propertyTimezone = "";

interface ReservationFixture {
  readonly reservationId: string;
  readonly segmentId: string | null;
}

function service(bus: EventBus = events!): ReservationDepartureRollService {
  return new ReservationDepartureRollService({
    database: database!,
    events: bus,
    idempotency: new PostgresIdempotency(),
  });
}

function envelope(requestId = crypto.randomUUID()) {
  return createAuditEnvelope({
    actorId: ACTOR,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    requestId,
    operation: "reservation.due_out",
  });
}

async function roll(target = service(), requestId = crypto.randomUUID()) {
  return target.rollDueDepartures({
    tenantId: TENANT,
    propertyNode: PROPERTY,
    limit: 100,
    envelope: envelope(requestId),
  });
}

async function createReservation(input: Readonly<{
  status?: "reserved" | "in_house" | "due_out" | "checked_out" | "cancelled";
  propertyNode?: string;
  departureOffset?: number;
  segmentStatus?: "booked" | "in_house" | "departed" | "cancelled";
  withSegment?: boolean;
  latestIncoherentSegment?: boolean;
}> = {}): Promise<ReservationFixture> {
  const reservationId = crypto.randomUUID();
  const propertyNode = input.propertyNode ?? PROPERTY;
  await admin!`
    INSERT INTO reservation (
      id, tenant_id, property_node, confirmation_no, status,
      primary_party, channel_code, currency
    ) VALUES (
      ${reservationId}::uuid, ${TENANT}::uuid, ${propertyNode}::uuid,
      ${`O233-${reservationId}`}, ${input.status ?? "in_house"},
      ${PARTY}::uuid, 'direct', 'USD'
    )
  `;
  if (input.withSegment === false) return Object.freeze({ reservationId, segmentId: null });

  const segmentId = crypto.randomUUID();
  const departureOffset = input.departureOffset ?? 0;
  await admin!`
    INSERT INTO reservation_segment (
      id, tenant_id, reservation_id, seq, unit_type_id, period,
      adults, children, rate_plan_id, status
    ) VALUES (
      ${segmentId}::uuid, ${TENANT}::uuid, ${reservationId}::uuid, 1, ${UNIT_TYPE}::uuid,
      tstzrange(
        (${businessDate}::date + ${departureOffset - 2})::timestamp AT TIME ZONE ${propertyTimezone},
        (${businessDate}::date + ${departureOffset})::timestamp AT TIME ZONE ${propertyTimezone},
        '[)'
      ),
      1, '[]'::jsonb, ${RATE}::uuid, ${input.segmentStatus ?? "in_house"}
    )
  `;
  if (input.latestIncoherentSegment) {
    await admin!`
      INSERT INTO reservation_segment (
        id, tenant_id, reservation_id, seq, unit_type_id, period,
        adults, children, rate_plan_id, status
      ) VALUES (
        ${crypto.randomUUID()}::uuid, ${TENANT}::uuid, ${reservationId}::uuid, 2, ${UNIT_TYPE}::uuid,
        tstzrange(
          (${businessDate}::date - 1)::timestamp AT TIME ZONE ${propertyTimezone},
          (${businessDate}::date + 1)::timestamp AT TIME ZONE ${propertyTimezone},
          '[)'
        ),
        1, '[]'::jsonb, ${RATE}::uuid, 'booked'
      )
    `;
  }
  return Object.freeze({ reservationId, segmentId });
}

async function storedSegment(segmentId: string): Promise<string> {
  const rows = await admin!<Array<{ value: string }>>`
    SELECT to_jsonb(segment)::text AS value
    FROM reservation_segment AS segment
    WHERE id=${segmentId}::uuid
  `;
  return rows[0]!.value;
}

async function storedReservationWithoutStatus(reservationId: string): Promise<string> {
  const rows = await admin!<Array<{ value: string }>>`
    SELECT (to_jsonb(reservation) - 'status')::text AS value
    FROM reservation
    WHERE id=${reservationId}::uuid
  `;
  return rows[0]!.value;
}

async function storedReservation(reservationId: string): Promise<string> {
  const rows = await admin!<Array<{ value: string }>>`
    SELECT to_jsonb(reservation)::text AS value
    FROM reservation
    WHERE id=${reservationId}::uuid
  `;
  return rows[0]!.value;
}

async function idempotencyCount(reservationId: string): Promise<number> {
  return database!.withTenantTransaction(TENANT, async (tx) => {
    const rows = await tx<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM api_idempotency
      WHERE tenant_id=${TENANT}::uuid
        AND operation='reservation.departure_roll'
        AND response_body @> ${JSON.stringify({ reservationId })}::jsonb
    `;
    return Number(rows[0]?.count ?? 0);
  });
}

async function evidence(reservationId: string): Promise<Readonly<{
  status: string;
  facts: number;
  events: number;
}>> {
  const rows = await admin!<Array<{ status: string; facts: number; events: number }>>`
    SELECT reservation.status,
      (SELECT count(*)::int FROM fact_log
       WHERE tenant_id=${TENANT}::uuid AND entity_type='reservation'
         AND entity_id=reservation.id AND fact_type='reservation.due_out') AS facts,
      (SELECT count(*)::int FROM outbox
       WHERE tenant_id=${TENANT}::uuid AND aggregate_type='reservation'
         AND aggregate_id=reservation.id AND event_type='reservation.due_out') AS events
    FROM reservation
    WHERE reservation.id=${reservationId}::uuid
  `;
  return rows[0]!;
}

class FailDueOutPublish implements EventBus {
  constructor(readonly delegate: EventBus) {}
  publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    if (event.eventType === "reservation.due_out") {
      throw new Error("Order 233 injected due-out publication failure");
    }
    return this.delegate.publish(tx, event);
  }
  consumeBatch(
    consumer: string,
    handler: EventHandler,
    options?: ConsumeBatchOptions,
  ): Promise<ConsumeBatchResult> {
    return this.delegate.consumeBatch(consumer, handler, options);
  }
}

beforeAll(async () => {
  if (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL) return;
  admin = new SQL(DEPLOY_DATABASE_URL, { max: 4 });
  eventPool = new SQL(RUNTIME_DATABASE_URL, { max: 4, prepare: false });
  database = Database.connect(RUNTIME_DATABASE_URL, { maxConnections: 24, prepare: false });
  events = new PostgresEventBus(eventPool);

  const clock = (await admin<Array<{ timezone: string; business_date: string; utc_date: string }>>`
    SELECT chosen.timezone,
           (transaction_timestamp() AT TIME ZONE chosen.timezone)::date::text AS business_date,
           (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS utc_date
    FROM (
      SELECT CASE
        WHEN extract(hour FROM transaction_timestamp() AT TIME ZONE 'UTC') >= 9
          THEN 'Pacific/Kiritimati'
        ELSE 'America/Adak'
      END AS timezone
    ) AS chosen
  `)[0]!;
  propertyTimezone = clock.timezone;
  businessDate = clock.business_date;
  expect(businessDate).not.toBe(clock.utc_date);

  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES(
    ${TENANT}::uuid,${`order233-${crypto.randomUUID()}`},'Order 233','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order233','property','Order 233',${propertyTimezone},'USD'),
    (${FOREIGN_PROPERTY}::uuid,${TENANT}::uuid,'order233.foreign','property','Order 233 foreign',${propertyTimezone},'USD')`;
  await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(
    ${ACTOR}::uuid,${TENANT}::uuid,${`order233-${crypto.randomUUID()}@yellow.test`},'Departure Roll','active')`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(
    ${PARTY}::uuid,${TENANT}::uuid,'person','Order 233 Guest','active')`;
  await admin`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,status) VALUES(
    ${RATE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O233','Order 233','USD','active')`;
  await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES(
    ${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O233','Order 233','hotel',2)`;
});

afterAll(async () => {
  if (admin) {
    await admin.unsafe(`
      DELETE FROM outbox WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM fact_log WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM api_idempotency WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM reservation_segment WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM reservation WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM unit_type WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM rate_plan WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM party WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM app_user WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM org_node WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM tenant WHERE id='${TENANT}'::uuid;
    `).catch(() => undefined);
  }
  await database?.close();
  await eventPool?.close();
  await admin?.close();
}, 30_000);

databaseDescribe("Order 233 governed reservation departure roll", () => {
  test("the property-local departure changes only its parent and writes one atomic evidence chain", async () => {
    const target = await createReservation();
    if (target.segmentId === null) throw new Error("Expected a reservation segment");
    const segmentBefore = await storedSegment(target.segmentId);
    const parentBefore = await storedReservationWithoutStatus(target.reservationId);
    const requestId = crypto.randomUUID();

    const result = await roll(service(), requestId);

    expect(result).toEqual({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      businessDate,
      examined: 1,
      transitioned: 1,
      departures: [{
        reservationId: target.reservationId,
        segmentId: target.segmentId,
        businessDate,
      }],
    });
    expect(await storedSegment(target.segmentId)).toBe(segmentBefore);
    expect(await storedReservationWithoutStatus(target.reservationId)).toBe(parentBefore);
    expect(await evidence(target.reservationId)).toEqual({ status: "due_out", facts: 1, events: 1 });
    expect(await idempotencyCount(target.reservationId)).toBe(1);

    const audit = await admin!<Array<{
      factRequest: string;
      eventCorrelation: string;
      factPayload: string;
      eventPayload: string;
    }>>`
      SELECT fact.payload->>'request_id' AS "factRequest",
             event.correlation_id::text AS "eventCorrelation",
             (fact.payload - 'request_id')::text AS "factPayload",
             event.payload::text AS "eventPayload"
      FROM fact_log AS fact
      JOIN outbox AS event
        ON event.tenant_id=fact.tenant_id
       AND event.aggregate_id=fact.entity_id
       AND event.event_type=fact.fact_type
      WHERE fact.entity_id=${target.reservationId}::uuid
        AND fact.fact_type='reservation.due_out'
    `;
    expect(audit[0]?.factRequest).toBe(requestId);
    expect(audit[0]?.eventCorrelation).toBe(requestId);
    expect(audit[0]?.eventPayload).toBe(audit[0]?.factPayload);
    expect(JSON.parse(audit[0]!.eventPayload)).toEqual({
      business_date: businessDate,
      previous_status: "in_house",
      reservation_id: target.reservationId,
      segment_id: target.segmentId,
      segment_status: "in_house",
      status: "due_out",
    });

    expect((await roll()).transitioned).toBe(0);
    expect(await evidence(target.reservationId)).toEqual({ status: "due_out", facts: 1, events: 1 });
  }, 30_000);

  test("future, past, foreign, non-in-house, absent and incoherent latest truth are no-ops", async () => {
    const fixtures = await Promise.all([
      createReservation({ departureOffset: 1 }),
      createReservation({ departureOffset: -1 }),
      createReservation({ propertyNode: FOREIGN_PROPERTY }),
      createReservation({ status: "reserved" }),
      createReservation({ status: "due_out" }),
      createReservation({ status: "checked_out" }),
      createReservation({ status: "cancelled" }),
      createReservation({ withSegment: false }),
      createReservation({ latestIncoherentSegment: true }),
      createReservation({ segmentStatus: "departed" }),
    ]);
    const parentsBefore = await Promise.all(
      fixtures.map(({ reservationId }) => storedReservation(reservationId)),
    );
    const segmentsBefore = await Promise.all(
      fixtures.filter((fixture) => fixture.segmentId !== null)
        .map((fixture) => storedSegment(fixture.segmentId!)),
    );

    expect(await roll()).toMatchObject({ examined: 0, transitioned: 0, departures: [] });
    expect(await Promise.all(
      fixtures.map(({ reservationId }) => storedReservation(reservationId)),
    )).toEqual(parentsBefore);
    expect(await Promise.all(
      fixtures.filter((fixture) => fixture.segmentId !== null)
        .map((fixture) => storedSegment(fixture.segmentId!)),
    )).toEqual(segmentsBefore);

    const artifacts = await Promise.all(fixtures.map(({ reservationId }) => evidence(reservationId)));
    expect(artifacts.reduce((sum, row) => sum + row.facts, 0)).toBe(0);
    expect(artifacts.reduce((sum, row) => sum + row.events, 0)).toBe(0);
  }, 30_000);

  test("twenty contenders converge once and leave unrelated rows byte-identical", async () => {
    const target = await createReservation();
    const unrelated = await createReservation({ departureOffset: 1 });
    const unrelatedReservation = await storedReservation(unrelated.reservationId);
    const unrelatedSegment = await storedSegment(unrelated.segmentId!);

    const results = await Promise.all(Array.from({ length: 20 }, () => roll()));

    expect(results.reduce((sum, result) => sum + result.transitioned, 0)).toBe(1);
    expect(results.reduce((sum, result) => sum + result.examined, 0)).toBe(1);
    expect(await evidence(target.reservationId)).toEqual({ status: "due_out", facts: 1, events: 1 });
    expect(await idempotencyCount(target.reservationId)).toBe(1);
    expect(await storedReservation(unrelated.reservationId)).toBe(unrelatedReservation);
    expect(await storedSegment(unrelated.segmentId!)).toBe(unrelatedSegment);
  }, 60_000);

  test("publication failure rolls parent, idempotency and evidence back before exact retry", async () => {
    const target = await createReservation();
    if (target.segmentId === null) throw new Error("Expected a reservation segment");
    const segmentBefore = await storedSegment(target.segmentId);
    const parentBefore = await storedReservation(target.reservationId);

    await expect(roll(service(new FailDueOutPublish(events!))))
      .rejects.toThrow("Order 233 injected due-out publication failure");

    expect(await evidence(target.reservationId)).toEqual({ status: "in_house", facts: 0, events: 0 });
    expect(await idempotencyCount(target.reservationId)).toBe(0);
    expect(await storedSegment(target.segmentId)).toBe(segmentBefore);
    expect(await storedReservation(target.reservationId)).toBe(parentBefore);
    expect((await roll()).transitioned).toBe(1);
    expect(await evidence(target.reservationId)).toEqual({ status: "due_out", facts: 1, events: 1 });
  }, 30_000);
});
