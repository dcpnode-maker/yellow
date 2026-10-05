import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  ReservationArrivalRollService,
} from "../src/contexts/reservations";
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
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESERVATION_ARRIVAL_ROLL === "1";

if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error("Order 232 database proof requires deploy and runtime database URLs");
}

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
const TENANT = "00000000-0000-0000-0000-000000023201";
const PROPERTY = "00000000-0000-0000-0000-000000023211";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000023212";
const ACTOR = "00000000-0000-0000-0000-000000023221";
const PARTY = "00000000-0000-0000-0000-000000023231";
const UNIT_TYPE = "00000000-0000-0000-0000-000000023241";
const RATE = "00000000-0000-0000-0000-000000023251";

let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let businessDate = "";

interface ReservationFixture {
  readonly reservationId: string;
  readonly segmentId: string | null;
}

function service(bus: EventBus = events!): ReservationArrivalRollService {
  return new ReservationArrivalRollService({
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
    operation: "reservation.due_in",
  });
}

async function roll(target = service(), requestId = crypto.randomUUID()) {
  return target.rollDueArrivals({
    tenantId: TENANT,
    propertyNode: PROPERTY,
    limit: 100,
    envelope: envelope(requestId),
  });
}

async function createReservation(input: Readonly<{
  status?: "reserved" | "due_in" | "cancelled" | "waitlist";
  propertyNode?: string;
  arrivalOffset?: number;
  segmentStatus?: "booked" | "cancelled";
  withSegment?: boolean;
  latestFutureSegment?: boolean;
}> = {}): Promise<ReservationFixture> {
  const reservationId = crypto.randomUUID();
  const propertyNode = input.propertyNode ?? PROPERTY;
  await admin!`
    INSERT INTO reservation (
      id, tenant_id, property_node, confirmation_no, status,
      primary_party, channel_code, currency
    ) VALUES (
      ${reservationId}::uuid, ${TENANT}::uuid, ${propertyNode}::uuid,
      ${`O232-${reservationId}`}, ${input.status ?? "reserved"},
      ${PARTY}::uuid, 'direct', 'USD'
    )
  `;
  if (input.withSegment === false) return Object.freeze({ reservationId, segmentId: null });
  const segmentId = crypto.randomUUID();
  const offset = input.arrivalOffset ?? 0;
  await admin!`
    INSERT INTO reservation_segment (
      id, tenant_id, reservation_id, seq, unit_type_id, period,
      adults, children, rate_plan_id, status
    ) VALUES (
      ${segmentId}::uuid, ${TENANT}::uuid, ${reservationId}::uuid, 1, ${UNIT_TYPE}::uuid,
      tstzrange(
        (${businessDate}::date + ${offset})::timestamp AT TIME ZONE 'UTC',
        (${businessDate}::date + ${offset + 2})::timestamp AT TIME ZONE 'UTC',
        '[)'
      ),
      1, '[]'::jsonb, ${RATE}::uuid, ${input.segmentStatus ?? "booked"}
    )
  `;
  if (input.latestFutureSegment) {
    await admin!`
      INSERT INTO reservation_segment (
        id, tenant_id, reservation_id, seq, unit_type_id, period,
        adults, children, rate_plan_id, status
      ) VALUES (
        ${crypto.randomUUID()}::uuid, ${TENANT}::uuid, ${reservationId}::uuid, 2, ${UNIT_TYPE}::uuid,
        tstzrange(
          (${businessDate}::date + 1)::timestamp AT TIME ZONE 'UTC',
          (${businessDate}::date + 3)::timestamp AT TIME ZONE 'UTC',
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
        AND operation='reservation.arrival_roll'
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
         AND entity_id=reservation.id AND fact_type='reservation.due_in') AS facts,
      (SELECT count(*)::int FROM outbox
       WHERE tenant_id=${TENANT}::uuid AND aggregate_type='reservation'
         AND aggregate_id=reservation.id AND event_type='reservation.due_in') AS events
    FROM reservation
    WHERE reservation.id=${reservationId}::uuid
  `;
  return rows[0]!;
}

class FailDueInPublish implements EventBus {
  constructor(readonly delegate: EventBus) {}
  publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    if (event.eventType === "reservation.due_in") {
      throw new Error("Order 232 injected due-in publication failure");
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
  businessDate = (await admin<Array<{ value: string }>>`
    SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS value
  `)[0]!.value;

  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES(
    ${TENANT}::uuid,${`order232-${crypto.randomUUID()}`},'Order 232','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order232','property','Order 232','UTC','USD'),
    (${FOREIGN_PROPERTY}::uuid,${TENANT}::uuid,'order232.foreign','property','Order 232 foreign','UTC','USD')`;
  await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(
    ${ACTOR}::uuid,${TENANT}::uuid,${`order232-${crypto.randomUUID()}@yellow.test`},'Arrival Roll','active')`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(
    ${PARTY}::uuid,${TENANT}::uuid,'person','Order 232 Guest','active')`;
  await admin`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,status) VALUES(
    ${RATE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O232','Order 232','USD','active')`;
  await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES(
    ${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O232','Order 232','hotel',2)`;
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

databaseDescribe("Order 232 governed reservation arrival roll", () => {
  test("exact property-local arrival transitions its parent once and preserves the segment byte-for-byte", async () => {
    const target = await createReservation();
    if (target.segmentId === null) throw new Error("Expected a reservation segment");
    const segmentBefore = await storedSegment(target.segmentId);
    const requestId = crypto.randomUUID();
    const result = await roll(service(), requestId);
    expect(result).toEqual({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      businessDate,
      examined: 1,
      transitioned: 1,
      arrivals: [{
        reservationId: target.reservationId,
        segmentId: target.segmentId,
        businessDate,
      }],
    });
    expect(await storedSegment(target.segmentId)).toBe(segmentBefore);
    expect(await evidence(target.reservationId)).toEqual({ status: "due_in", facts: 1, events: 1 });
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
        AND fact.fact_type='reservation.due_in'
    `;
    expect(audit[0]?.factRequest).toBe(requestId);
    expect(audit[0]?.eventCorrelation).toBe(requestId);
    expect(audit[0]?.eventPayload).toBe(audit[0]?.factPayload);
    expect((await roll()).transitioned).toBe(0);
    expect(await evidence(target.reservationId)).toEqual({ status: "due_in", facts: 1, events: 1 });
  }, 30_000);

  test("future, past, foreign, terminal, absent and incoherent segment truth are no-ops", async () => {
    const fixtures = await Promise.all([
      createReservation({ arrivalOffset: 1 }),
      createReservation({ arrivalOffset: -1 }),
      createReservation({ propertyNode: FOREIGN_PROPERTY }),
      createReservation({ status: "cancelled" }),
      createReservation({ status: "waitlist" }),
      createReservation({ status: "due_in" }),
      createReservation({ withSegment: false }),
      createReservation({ latestFutureSegment: true }),
      createReservation({ segmentStatus: "cancelled" }),
    ]);
    const before = await Promise.all(
      fixtures.map(({ reservationId }) => storedReservation(reservationId)),
    );
    expect(await roll()).toMatchObject({ examined: 0, transitioned: 0, arrivals: [] });
    const after = await Promise.all(
      fixtures.map(({ reservationId }) => storedReservation(reservationId)),
    );
    expect(after).toEqual(before);
    const artifacts = await Promise.all(
      fixtures.map(({ reservationId }) => evidence(reservationId)),
    );
    expect(artifacts.reduce((sum, row) => sum + row.facts, 0)).toBe(0);
    expect(artifacts.reduce((sum, row) => sum + row.events, 0)).toBe(0);
  }, 30_000);

  test("twenty contenders converge to one transition and leave unrelated rows invariant", async () => {
    const target = await createReservation();
    const unrelated = await createReservation({ arrivalOffset: 1 });
    const unrelatedReservation = (await admin!<Array<{ value: string }>>`
      SELECT to_jsonb(reservation)::text AS value FROM reservation
      WHERE id=${unrelated.reservationId}::uuid
    `)[0]!.value;
    const unrelatedSegment = await storedSegment(unrelated.segmentId!);
    const results = await Promise.all(Array.from({ length: 20 }, () => roll()));
    expect(results.reduce((sum, result) => sum + result.transitioned, 0)).toBe(1);
    expect(results.reduce((sum, result) => sum + result.examined, 0)).toBe(1);
    expect(await evidence(target.reservationId)).toEqual({ status: "due_in", facts: 1, events: 1 });
    expect(await idempotencyCount(target.reservationId)).toBe(1);
    expect((await admin!<Array<{ value: string }>>`
      SELECT to_jsonb(reservation)::text AS value FROM reservation
      WHERE id=${unrelated.reservationId}::uuid
    `)[0]!.value).toBe(unrelatedReservation);
    expect(await storedSegment(unrelated.segmentId!)).toBe(unrelatedSegment);
  }, 60_000);

  test("publication failure rolls parent, idempotency and evidence back before exact retry", async () => {
    const target = await createReservation();
    if (target.segmentId === null) throw new Error("Expected a reservation segment");
    const segmentBefore = await storedSegment(target.segmentId);
    await expect(roll(service(new FailDueInPublish(events!))))
      .rejects.toThrow("Order 232 injected due-in publication failure");
    expect(await evidence(target.reservationId)).toEqual({ status: "reserved", facts: 0, events: 0 });
    expect(await idempotencyCount(target.reservationId)).toBe(0);
    expect(await storedSegment(target.segmentId)).toBe(segmentBefore);
    expect((await roll()).transitioned).toBe(1);
    expect(await evidence(target.reservationId)).toEqual({ status: "due_in", facts: 1, events: 1 });
  }, 30_000);

});
