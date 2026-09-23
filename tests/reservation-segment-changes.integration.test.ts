import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  HoldService,
  ReservationOccupancyService,
} from "../src/contexts/inventory";
import {
  ReservationCommitService,
  ReservationLifecycleConflictError,
  ReservationLifecycleNotFoundError,
  ReservationLifecycleValidationError,
  ReservationSegmentService,
  type ExpectedSegmentPeriod,
} from "../src/contexts/reservations";
import {
  createAuditEnvelope,
  Database,
  IdempotencyConflictError,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_RESERVATION_SEGMENTS_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL ?? process.env.YELLOW_RESERVATION_SEGMENTS_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESERVATION_SEGMENTS === "1";

const TENANT_A = "00000000-0000-0000-0000-000000008601";
const TENANT_B = "00000000-0000-0000-0000-000000008602";
const PROPERTY_A = "00000000-0000-0000-0000-000000008611";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000008612";
const PROPERTY_B = "00000000-0000-0000-0000-000000008613";
const ACTOR_A = "00000000-0000-0000-0000-000000008621";
const ACTOR_B = "00000000-0000-0000-0000-000000008622";
const ACTOR_FOREIGN = "00000000-0000-0000-0000-000000008623";
const PARTY_A = "00000000-0000-0000-0000-000000008631";
const RATE_A = "00000000-0000-0000-0000-000000008641";
const UNIT_TYPE_A = "00000000-0000-0000-0000-000000008651";
const UNIT_TYPE_B = "00000000-0000-0000-0000-000000008652";
const UNIT_TYPE_FOREIGN = "00000000-0000-0000-0000-000000008653";
const SPACE_A = "00000000-0000-0000-0000-000000008661";
const SPACE_B = "00000000-0000-0000-0000-000000008662";
const SPACE_C = "00000000-0000-0000-0000-000000008663";
const SPACE_COMPOSITE_A = "00000000-0000-0000-0000-000000008664";
const SPACE_COMPOSITE_B = "00000000-0000-0000-0000-000000008665";
const SPACE_POSITIONAL = "00000000-0000-0000-0000-000000008666";
const SPACE_FOREIGN = "00000000-0000-0000-0000-000000008667";
const SELLABLE_A = "00000000-0000-0000-0000-000000008671";
const SELLABLE_B = "00000000-0000-0000-0000-000000008672";
const SELLABLE_SAME_SPACE = "00000000-0000-0000-0000-000000008673";
const SELLABLE_CROSS_TYPE = "00000000-0000-0000-0000-000000008674";
const SELLABLE_COMPOSITE = "00000000-0000-0000-0000-000000008675";
const SELLABLE_POSITIONAL = "00000000-0000-0000-0000-000000008676";
const SELLABLE_FOREIGN = "00000000-0000-0000-0000-000000008677";

if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error("YELLOW_RESERVATION_SEGMENTS_URL is required by the Order 086 proof");
}

test("Order 086 P0: reservation segment change surface is present", () => {
  expect(typeof ReservationSegmentService).toBe("function");
  expect(ReservationLifecycleConflictError.prototype).toBeInstanceOf(Error);
});

test("Order 143 P0/P1: segment parents are written before changed-period and new-id claims", async () => {
  const source = await Bun.file(
    new URL("../src/contexts/reservations/segments.ts", import.meta.url),
  ).text();
  const changeStart = source.indexOf("async changeDeparture(");
  const moveStart = source.indexOf("async moveRoom(");
  const change = source.slice(changeStart, moveStart);
  const move = source.slice(moveStart);
  const occursBefore = (section: string, first: string, second: string): boolean => {
    const firstIndex = section.indexOf(first);
    const secondIndex = section.indexOf(second);
    return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
  };

  expect({
    changedPeriodParentBeforeClaim: occursBefore(
      change,
      "const updated = await commandTx",
      "reclaimed = await this.#occupancy.claimForSegment",
    ),
    newMoveParentBeforeClaim: occursBefore(
      move,
      "const inserted = await commandTx",
      "claimed = await this.#occupancy.claimForSegment",
    ),
  }).toEqual({
    changedPeriodParentBeforeClaim: true,
    newMoveParentBeforeClaim: true,
  });
});

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let occupancy: ReservationOccupancyService | undefined;
let commits: ReservationCommitService | undefined;

function instant(day: number, hour = 15): Date {
  return new Date(Date.UTC(2036, 0, day, hour));
}

function period(day: number, nights = 3): Readonly<{ from: Date; to: Date }> {
  const from = instant(day);
  return Object.freeze({ from, to: new Date(from.getTime() + nights * 24 * 60 * 60 * 1_000) });
}

function exactPeriod(value: Readonly<{ from: Date; to: Date }>): ExpectedSegmentPeriod {
  return Object.freeze({ from: value.from.toISOString(), to: value.to.toISOString() });
}

function envelope(
  operation: string,
  actorId = ACTOR_A,
  tenantId = TENANT_A,
  propertyNode = PROPERTY_A,
  requestId = crypto.randomUUID(),
) {
  return createAuditEnvelope({ operation, actorId, tenantId, propertyNode, requestId });
}

function segmentService(
  bus: EventBus,
  options: Readonly<{ now?: Date; idFactory?: () => string }> = {},
): ReservationSegmentService {
  return new ReservationSegmentService({
    events: bus,
    occupancy: new ReservationOccupancyService(bus),
    idempotency: new PostgresIdempotency(),
    now: () => new Date(options.now ?? instant(1)),
    idFactory: options.idFactory,
  });
}

async function createReservation(
  stay: Readonly<{ from: Date; to: Date }>,
  sellableUnitId = SELLABLE_A,
) {
  return database!.withTenantTransaction(TENANT_A, (tx) => commits!.commitDirect(tx, {
    sellableUnitId,
    ...stay,
    primaryPartyId: PARTY_A,
    ratePlanId: RATE_A,
    adults: 2,
    childAges: [6, 11],
    channelCode: "direct",
    idempotencyKey: `order086-commit-${crypto.randomUUID()}`,
    envelope: envelope("reservation.confirmed"),
  }));
}

async function makeInHouse(
  reservationId: string,
  segmentId: string,
  reservationStatus: "in_house" | "due_out" = "in_house",
): Promise<void> {
  await admin!`UPDATE reservation SET status = ${reservationStatus} WHERE id = ${reservationId}::uuid`;
  await admin!`UPDATE reservation_segment SET status = 'in_house' WHERE id = ${segmentId}::uuid`;
}

async function changeDeparture(
  service: ReservationSegmentService,
  input: Parameters<ReservationSegmentService["changeDeparture"]>[1],
) {
  return database!.withTenantTransaction(
    input.envelope.tenantId,
    (tx) => service.changeDeparture(tx, input),
  );
}

async function moveRoom(
  service: ReservationSegmentService,
  input: Parameters<ReservationSegmentService["moveRoom"]>[1],
) {
  return database!.withTenantTransaction(input.envelope.tenantId, (tx) => service.moveRoom(tx, input));
}

async function releaseSegment(segmentId: string): Promise<void> {
  await database!.withTenantTransaction(TENANT_A, (tx) => occupancy!.releaseForSegment(tx, {
    segmentId,
    envelope: envelope("occupancy.released"),
  }));
}

async function snapshot(reservationId: string): Promise<unknown> {
  const reservation = await admin!<Array<Record<string, unknown>>>`
    SELECT status, property_node FROM reservation WHERE id = ${reservationId}::uuid
  `;
  const segments = await admin!<Array<Record<string, unknown>>>`
    SELECT id, seq, unit_type_id, sellable_unit_id, lower(period)::text AS from_at,
           upper(period)::text AS to_at, adults, children, rate_plan_id, price_override, status
    FROM reservation_segment WHERE reservation_id = ${reservationId}::uuid ORDER BY seq, id
  `;
  const claims = await admin!<Array<Record<string, unknown>>>`
    SELECT slot_ref, space_id, period::text, claim::text, exclusive
    FROM space_occupancy
    WHERE slot_ref IN (SELECT id FROM reservation_segment WHERE reservation_id = ${reservationId}::uuid)
    ORDER BY slot_ref, space_id, id
  `;
  const totals = await admin!<Array<Record<string, unknown>>>`
    SELECT
      (SELECT count(*)::int FROM fact_log) AS facts,
      (SELECT count(*)::int FROM outbox) AS events,
      (SELECT count(*)::int FROM api_idempotency) AS keys
  `;
  return JSON.parse(JSON.stringify({ reservation, segments, claims, totals }));
}

async function parentObservations(segmentId: string): Promise<Array<{
  sequence: number;
  tenantId: string;
  reservationId: string;
  segmentId: string;
  propertyNode: string;
  sellableUnitId: string;
  unitTypeId: string;
  spaceId: string;
  claimMode: string;
  status: string;
  from: Date;
  to: Date;
}>> {
  return admin!`
    SELECT observation_id AS sequence,
           tenant_id::text AS "tenantId",
           reservation_id::text AS "reservationId",
           segment_id::text AS "segmentId",
           property_node::text AS "propertyNode",
           sellable_unit_id::text AS "sellableUnitId",
           unit_type_id::text AS "unitTypeId",
           space_id::text AS "spaceId",
           claim_mode AS "claimMode",
           segment_status AS status,
           lower(period) AS "from",
           upper(period) AS "to"
      FROM order143_parent_observation
     WHERE segment_id = ${segmentId}::uuid
     ORDER BY observation_id
  `;
}

async function failedArtifacts(requestId: string): Promise<Readonly<{ facts: number; events: number }>> {
  const rows = await admin!<Array<{ facts: number; events: number }>>`
    SELECT
      (SELECT count(*)::int FROM fact_log
        WHERE payload @> ${JSON.stringify({ request_id: requestId })}::text::jsonb) AS facts,
      (SELECT count(*)::int FROM outbox WHERE correlation_id = ${requestId}::uuid) AS events
  `;
  return rows[0] ?? { facts: -1, events: -1 };
}

async function expectUnchanged(
  reservationId: string,
  promise: Promise<unknown>,
  error: new (...args: never[]) => Error,
): Promise<void> {
  const observed = promise.then(
    () => Object.freeze({ error: null }),
    (caught: unknown) => Object.freeze({ error: caught }),
  );
  const before = await snapshot(reservationId);
  expect((await observed).error).toBeInstanceOf(error);
  expect(await snapshot(reservationId)).toEqual(before);
}

class FailAtEventBus implements EventBus {
  calls = 0;

  constructor(readonly delegate: EventBus, readonly failAt: number) {}

  publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    this.calls += 1;
    if (this.calls === this.failAt) throw new Error(`Order 086 injected publication failure ${this.failAt}`);
    return this.delegate.publish(tx, event);
  }

  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

beforeAll(async () => {
  if (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL) return;
  admin = new SQL(DEPLOY_DATABASE_URL, { max: 32 });
  eventPool = new SQL(RUNTIME_DATABASE_URL, { max: 64 });
  database = Database.connect(RUNTIME_DATABASE_URL, { maxConnections: 96 });
  events = new PostgresEventBus(eventPool);
  occupancy = new ReservationOccupancyService(events);
  commits = new ReservationCommitService({
    holds: new HoldService(events),
    occupancy,
    events,
    idempotency: new PostgresIdempotency(),
  });

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order086-a', 'Order 086 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order086-b', 'Order 086 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order086_a', 'property', 'Order 086 A', 'UTC', 'USD'),
      (${PROPERTY_A2}::uuid, ${TENANT_A}::uuid, 'order086_a2', 'property', 'Order 086 A2', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order086_b', 'property', 'Order 086 B', 'UTC', 'EUR')
  `;
  await admin`
    INSERT INTO app_user (id, tenant_id, email, display_name)
    VALUES
      (${ACTOR_A}::uuid, ${TENANT_A}::uuid, 'order086-a@yellow.test', 'Order 086 Actor A'),
      (${ACTOR_B}::uuid, ${TENANT_A}::uuid, 'order086-b@yellow.test', 'Order 086 Actor B'),
      (${ACTOR_FOREIGN}::uuid, ${TENANT_B}::uuid, 'order086-foreign@yellow.test', 'Order 086 Foreign')
  `;
  await admin`
    INSERT INTO party (id, tenant_id, kind, display_name, status)
    VALUES (${PARTY_A}::uuid, ${TENANT_A}::uuid, 'person', 'Order 086 Guest', 'active')
  `;
  await admin`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, status)
    VALUES (${RATE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O86BAR', 'Order 086 BAR', 'USD', 'active')
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key)
    VALUES
      (${UNIT_TYPE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O86A', 'Order 086 Type A', 'hotel'),
      (${UNIT_TYPE_B}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O86B', 'Order 086 Type B', 'hotel'),
      (${UNIT_TYPE_FOREIGN}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O86F', 'Order 086 Foreign', 'hotel')
  `;
  await admin`
    INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity)
    VALUES
      (${SPACE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O86-A', 'hotel', 1),
      (${SPACE_B}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O86-B', 'hotel', 1),
      (${SPACE_C}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O86-C', 'hotel', 1),
      (${SPACE_COMPOSITE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O86-CA', 'hotel', 1),
      (${SPACE_COMPOSITE_B}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O86-CB', 'hotel', 1),
      (${SPACE_POSITIONAL}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O86-P', 'hotel', 2),
      (${SPACE_FOREIGN}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O86-F', 'hotel', 1)
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name)
    VALUES
      (${SELLABLE_A}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE_A}::uuid, 'Order 086 A'),
      (${SELLABLE_B}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE_A}::uuid, 'Order 086 B'),
      (${SELLABLE_SAME_SPACE}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE_A}::uuid, 'Order 086 Same Space'),
      (${SELLABLE_CROSS_TYPE}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE_B}::uuid, 'Order 086 Cross Type'),
      (${SELLABLE_COMPOSITE}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE_A}::uuid, 'Order 086 Composite'),
      (${SELLABLE_POSITIONAL}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE_A}::uuid, 'Order 086 Positional'),
      (${SELLABLE_FOREIGN}::uuid, ${TENANT_B}::uuid, ${UNIT_TYPE_FOREIGN}::uuid, 'Order 086 Foreign')
  `;
  await admin`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    VALUES
      (${TENANT_A}::uuid, ${SELLABLE_A}::uuid, ${SPACE_A}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_B}::uuid, ${SPACE_B}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_SAME_SPACE}::uuid, ${SPACE_A}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_CROSS_TYPE}::uuid, ${SPACE_C}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_COMPOSITE}::uuid, ${SPACE_COMPOSITE_A}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_COMPOSITE}::uuid, ${SPACE_COMPOSITE_B}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_POSITIONAL}::uuid, ${SPACE_POSITIONAL}::uuid, 'positional'),
      (${TENANT_B}::uuid, ${SELLABLE_FOREIGN}::uuid, ${SPACE_FOREIGN}::uuid, 'exclusive')
  `;
  await admin.unsafe(`
    CREATE TABLE order143_parent_observation (
      observation_id bigserial PRIMARY KEY,
      tenant_id uuid NOT NULL,
      reservation_id uuid NOT NULL,
      segment_id uuid NOT NULL,
      property_node uuid NOT NULL,
      sellable_unit_id uuid NOT NULL,
      unit_type_id uuid NOT NULL,
      space_id uuid NOT NULL,
      claim_mode text NOT NULL,
      segment_status text NOT NULL,
      period tstzrange NOT NULL
    );
    ALTER TABLE order143_parent_observation OWNER TO yellow_owner;
    CREATE FUNCTION order143_require_segment_parent() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.slot_kind <> 'segment' THEN
        RETURN NEW;
      END IF;

      INSERT INTO order143_parent_observation (
        tenant_id, reservation_id, segment_id, property_node,
        sellable_unit_id, unit_type_id, space_id, claim_mode,
        segment_status, period
      )
      SELECT segment.tenant_id, segment.reservation_id, segment.id,
             reservation.property_node, segment.sellable_unit_id,
             segment.unit_type_id, space.id, mapping.claim_mode,
             segment.status, segment.period
        FROM reservation_segment AS segment
        JOIN reservation
          ON reservation.id = segment.reservation_id
         AND reservation.tenant_id = segment.tenant_id
        JOIN sellable_unit
          ON sellable_unit.id = segment.sellable_unit_id
         AND sellable_unit.tenant_id = segment.tenant_id
         AND sellable_unit.unit_type_id = segment.unit_type_id
         AND sellable_unit.status = 'active'
        JOIN unit_type
          ON unit_type.id = segment.unit_type_id
         AND unit_type.tenant_id = segment.tenant_id
         AND unit_type.property_node = reservation.property_node
        JOIN sellable_unit_space AS mapping
          ON mapping.tenant_id = segment.tenant_id
         AND mapping.sellable_unit_id = segment.sellable_unit_id
         AND mapping.space_id = NEW.space_id
         AND mapping.claim_mode =
             CASE WHEN NEW.exclusive THEN 'exclusive' ELSE 'positional' END
        JOIN space
          ON space.id = mapping.space_id
         AND space.tenant_id = segment.tenant_id
         AND space.property_node = reservation.property_node
         AND space.status = 'active'
       WHERE segment.id = NEW.slot_ref
         AND segment.tenant_id = NEW.tenant_id
         AND segment.status IN ('booked', 'in_house')
         AND segment.period = NEW.period;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING
          ERRCODE = 'P0143',
          MESSAGE = 'order143 exact segment parent missing before occupancy';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER order143_require_segment_parent
      BEFORE INSERT ON space_occupancy
      FOR EACH ROW EXECUTE FUNCTION order143_require_segment_parent();
  `);
});

afterAll(async () => {
  if (admin) {
    await admin.unsafe(`
      DROP TRIGGER IF EXISTS order143_require_segment_parent ON space_occupancy;
      DROP FUNCTION IF EXISTS order143_require_segment_parent();
      DROP TABLE IF EXISTS order143_parent_observation;
    `).catch(() => undefined);
  }
  await database?.close();
  await eventPool?.close();
  await admin?.close();
}, 30_000);

databaseDescribe("Order 086 atomic reservation segment changes", () => {
  test("P1: extend and shorten preserve the segment and re-arbitrate exact claims", async () => {
    const service = segmentService(events!);
    const future = period(5, 2);
    const extendedTo = instant(8);
    const extension = await createReservation(future);
    const extendInput = {
      reservationId: extension.reservationId,
      segmentId: extension.segmentId,
      expectedPeriod: exactPeriod(future),
      newDeparture: extendedTo.toISOString(),
      idempotencyKey: "order086-extend-exact",
      envelope: envelope("reservation.modified"),
    } as const;
    const extended = await changeDeparture(service, extendInput);
    expect(extended).toEqual({
      reservationId: extension.reservationId,
      segmentId: extension.segmentId,
      classification: "extended",
      beforePeriod: exactPeriod(future),
      afterPeriod: exactPeriod({ from: future.from, to: extendedTo }),
      sellableUnitId: SELLABLE_A,
      unitTypeId: UNIT_TYPE_A,
      releasedClaimCount: 1,
      reclaimedClaimCount: 1,
      financialJournalId: null,
      replayed: false,
    });
    expect(await changeDeparture(service, { ...extendInput, envelope: envelope("reservation.modified") }))
      .toEqual({ ...extended, replayed: true });

    const extensionRows = await admin!<Array<Record<string, unknown>>>`
      SELECT segment.id, segment.sellable_unit_id, segment.unit_type_id, segment.rate_plan_id,
             segment.adults, segment.children, lower(segment.period) AS from_at,
             upper(segment.period) AS to_at, segment.status,
             occupancy.space_id, occupancy.exclusive
      FROM reservation_segment AS segment
      JOIN space_occupancy AS occupancy ON occupancy.slot_ref = segment.id
      WHERE segment.id = ${extension.segmentId}::uuid
    `;
    expect(extensionRows).toHaveLength(1);
    expect(extensionRows[0]).toMatchObject({
      id: extension.segmentId,
      sellable_unit_id: SELLABLE_A,
      unit_type_id: UNIT_TYPE_A,
      rate_plan_id: RATE_A,
      adults: 2,
      children: [{ age: 6 }, { age: 11 }],
      status: "booked",
      space_id: SPACE_A,
      exclusive: true,
    });
    expect((extensionRows[0]?.from_at as Date).toISOString()).toBe(future.from.toISOString());
    expect((extensionRows[0]?.to_at as Date).toISOString()).toBe(extendedTo.toISOString());
    const extensionParents = await parentObservations(extension.segmentId);
    expect(extensionParents).toHaveLength(2);
    expect(extensionParents.at(-1)).toMatchObject({
      tenantId: TENANT_A,
      reservationId: extension.reservationId,
      segmentId: extension.segmentId,
      propertyNode: PROPERTY_A,
      sellableUnitId: SELLABLE_A,
      unitTypeId: UNIT_TYPE_A,
      spaceId: SPACE_A,
      claimMode: "exclusive",
      status: "booked",
      from: future.from,
      to: extendedTo,
    });

    const live = period(10, 4);
    const liveNow = instant(11, 12);
    const shortenedTo = instant(13);
    const shortening = await createReservation(live);
    await makeInHouse(shortening.reservationId, shortening.segmentId, "due_out");
    const shortenRequestId = crypto.randomUUID();
    const shortened = await changeDeparture(segmentService(events!, { now: liveNow }), {
      reservationId: shortening.reservationId,
      segmentId: shortening.segmentId,
      expectedPeriod: exactPeriod(live),
      newDeparture: shortenedTo.toISOString(),
      idempotencyKey: "order086-shorten-exact",
      envelope: envelope("reservation.modified", ACTOR_A, TENANT_A, PROPERTY_A, shortenRequestId),
    });
    expect(shortened).toMatchObject({
      classification: "shortened",
      beforePeriod: exactPeriod(live),
      afterPeriod: exactPeriod({ from: live.from, to: shortenedTo }),
      releasedClaimCount: 1,
      reclaimedClaimCount: 1,
      financialJournalId: null,
    });
    const shortenedParents = await parentObservations(shortening.segmentId);
    expect(shortenedParents).toHaveLength(2);
    expect(shortenedParents.at(-1)).toMatchObject({
      tenantId: TENANT_A,
      reservationId: shortening.reservationId,
      segmentId: shortening.segmentId,
      propertyNode: PROPERTY_A,
      sellableUnitId: SELLABLE_A,
      unitTypeId: UNIT_TYPE_A,
      spaceId: SPACE_A,
      claimMode: "exclusive",
      status: "in_house",
      from: live.from,
      to: shortenedTo,
    });
    const exactEvents = await admin!<Array<{ event_type: string }>>`
      SELECT event_type FROM outbox
      WHERE correlation_id IN (${extendInput.envelope.requestId}::uuid, ${shortenRequestId}::uuid)
      ORDER BY seq
    `;
    expect(exactEvents.map((event) => event.event_type)).toEqual([
      "occupancy.released", "occupancy.recorded", "reservation.modified",
      "occupancy.released", "occupancy.recorded", "reservation.modified",
    ]);
  }, 30_000);

  test("P2: room move closes old history, opens the next sequence and replays exactly", async () => {
    const stay = period(20, 4);
    const movedAt = instant(22, 9);
    const created = await createReservation(stay);
    await makeInHouse(created.reservationId, created.segmentId);
    await admin!`
      UPDATE reservation_segment
      SET price_override = '{"amount_minor":12345,"currency":"USD"}'::jsonb
      WHERE id = ${created.segmentId}::uuid
    `;
    const newSegmentId = "00000000-0000-0000-0000-000000008691";
    const service = segmentService(events!, { now: movedAt, idFactory: () => newSegmentId });
    const input = {
      reservationId: created.reservationId,
      segmentId: created.segmentId,
      expectedSellableUnitId: SELLABLE_A,
      expectedPeriod: exactPeriod(stay),
      destinationSellableUnitId: SELLABLE_B,
      idempotencyKey: "order086-move-exact",
      envelope: envelope("segment.moved"),
    } as const;
    const moved = await moveRoom(service, input);
    expect(moved).toEqual({
      reservationId: created.reservationId,
      oldSegmentId: created.segmentId,
      newSegmentId,
      oldSequence: 1,
      newSequence: 2,
      fromSellableUnitId: SELLABLE_A,
      toSellableUnitId: SELLABLE_B,
      fromSpaceId: SPACE_A,
      toSpaceId: SPACE_B,
      movedAt: movedAt.toISOString(),
      beforePeriod: exactPeriod(stay),
      departedPeriod: exactPeriod({ from: stay.from, to: movedAt }),
      activePeriod: exactPeriod({ from: movedAt, to: stay.to }),
      financialJournalId: null,
      replayed: false,
    });
    expect(await moveRoom(service, { ...input, envelope: envelope("segment.moved") }))
      .toEqual({ ...moved, replayed: true });

    const segments = await admin!<Array<Record<string, unknown>>>`
      SELECT id, seq, unit_type_id, sellable_unit_id, lower(period) AS from_at,
             upper(period) AS to_at, adults, children, rate_plan_id, price_override, status
      FROM reservation_segment WHERE reservation_id = ${created.reservationId}::uuid ORDER BY seq
    `;
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      id: created.segmentId,
      seq: 1,
      sellable_unit_id: SELLABLE_A,
      status: "departed",
    });
    expect(segments[1]).toMatchObject({
      id: newSegmentId,
      seq: 2,
      unit_type_id: UNIT_TYPE_A,
      sellable_unit_id: SELLABLE_B,
      adults: 2,
      children: [{ age: 6 }, { age: 11 }],
      rate_plan_id: RATE_A,
      price_override: { amount_minor: 12345, currency: "USD" },
      status: "in_house",
    });
    expect((segments[0]?.to_at as Date).toISOString()).toBe(movedAt.toISOString());
    expect((segments[1]?.from_at as Date).toISOString()).toBe(movedAt.toISOString());
    expect((segments[1]?.to_at as Date).toISOString()).toBe(stay.to.toISOString());
    const claims = await admin!<Array<{ slot_ref: string; space_id: string }>>`
      SELECT slot_ref, space_id FROM space_occupancy
      WHERE slot_ref IN (${created.segmentId}::uuid, ${newSegmentId}::uuid)
      ORDER BY slot_ref
    `;
    expect(claims).toEqual([{ slot_ref: newSegmentId, space_id: SPACE_B }]);
    const moveParents = await parentObservations(newSegmentId);
    expect(moveParents).toHaveLength(1);
    expect(moveParents[0]).toMatchObject({
      tenantId: TENANT_A,
      reservationId: created.reservationId,
      segmentId: newSegmentId,
      propertyNode: PROPERTY_A,
      sellableUnitId: SELLABLE_B,
      unitTypeId: UNIT_TYPE_A,
      spaceId: SPACE_B,
      claimMode: "exclusive",
      status: "in_house",
      from: movedAt,
      to: stay.to,
    });
    const movedEvents = await admin!<Array<{ payload: Record<string, unknown> }>>`
      SELECT payload FROM outbox
      WHERE correlation_id = ${input.envelope.requestId}::uuid AND event_type = 'segment.moved'
    `;
    expect(movedEvents).toHaveLength(1);
    expect(movedEvents[0]?.payload).toMatchObject({
      old_segment_id: created.segmentId,
      new_segment_id: newSegmentId,
      from_space: SPACE_A,
      to_space: SPACE_B,
      moved_at: movedAt.toISOString(),
      financial_journal_id: null,
    });
  }, 30_000);

  test("P3: occupied and OOO conflicts roll back, while twenty contenders have one winner", async () => {
    const extensionStay = period(30, 2);
    const extensionTarget = await createReservation(extensionStay);
    const extensionBlocker = await createReservation(period(32, 2));
    const extensionInput = {
      reservationId: extensionTarget.reservationId,
      segmentId: extensionTarget.segmentId,
      expectedPeriod: exactPeriod(extensionStay),
      newDeparture: instant(33).toISOString(),
      idempotencyKey: "order086-blocked-extension",
      envelope: envelope("reservation.modified"),
    } as const;
    await expectUnchanged(
      extensionTarget.reservationId,
      changeDeparture(segmentService(events!), extensionInput),
      ReservationLifecycleConflictError,
    );
    await releaseSegment(extensionBlocker.segmentId);
    expect((await changeDeparture(segmentService(events!), extensionInput)).replayed).toBe(false);

    const occupiedStay = period(40, 3);
    const occupiedTarget = await createReservation(occupiedStay);
    const occupiedBlocker = await createReservation(occupiedStay, SELLABLE_B);
    await makeInHouse(occupiedTarget.reservationId, occupiedTarget.segmentId);
    const occupiedInput = {
      reservationId: occupiedTarget.reservationId,
      segmentId: occupiedTarget.segmentId,
      expectedSellableUnitId: SELLABLE_A,
      expectedPeriod: exactPeriod(occupiedStay),
      destinationSellableUnitId: SELLABLE_B,
      idempotencyKey: "order086-blocked-move",
      envelope: envelope("segment.moved"),
    } as const;
    const occupiedService = segmentService(events!, { now: instant(41), idFactory: () => crypto.randomUUID() });
    await expectUnchanged(
      occupiedTarget.reservationId,
      moveRoom(occupiedService, occupiedInput),
      ReservationLifecycleConflictError,
    );
    await releaseSegment(occupiedBlocker.segmentId);
    expect((await moveRoom(occupiedService, occupiedInput)).replayed).toBe(false);

    const oooStay = period(50, 3);
    const oooTarget = await createReservation(oooStay);
    await makeInHouse(oooTarget.reservationId, oooTarget.segmentId);
    const oooSlot = crypto.randomUUID();
    await admin!`
      INSERT INTO ooo_oos (id, tenant_id, space_id, kind, period, reason)
      VALUES (
        ${oooSlot}::uuid, ${TENANT_A}::uuid, ${SPACE_B}::uuid, 'ooo',
        tstzrange(${oooStay.from.toISOString()}::timestamptz, ${oooStay.to.toISOString()}::timestamptz, '[)'),
        'Order 086 typed-parent conflict fixture'
      )
    `;
    await admin!`
      SELECT record_occupancy(
        ${TENANT_A}::uuid, ${SPACE_B}::uuid,
        tstzrange(${oooStay.from.toISOString()}::timestamptz, ${oooStay.to.toISOString()}::timestamptz, '[)'),
        ${oooSlot}::uuid, 'ooo', true
      )
    `;
    const oooInput = {
      reservationId: oooTarget.reservationId,
      segmentId: oooTarget.segmentId,
      expectedSellableUnitId: SELLABLE_A,
      expectedPeriod: exactPeriod(oooStay),
      destinationSellableUnitId: SELLABLE_B,
      idempotencyKey: "order086-ooo-move",
      envelope: envelope("segment.moved"),
    } as const;
    const oooService = segmentService(events!, { now: instant(51), idFactory: () => crypto.randomUUID() });
    await expectUnchanged(
      oooTarget.reservationId,
      moveRoom(oooService, oooInput),
      ReservationLifecycleConflictError,
    );
    await admin!`SELECT release_occupancy(${TENANT_A}::uuid, ${oooSlot}::uuid)`;
    await admin!`DELETE FROM ooo_oos WHERE id = ${oooSlot}::uuid`;
    expect((await moveRoom(oooService, oooInput)).replayed).toBe(false);

    const raceStay = period(60, 4);
    const raceTarget = await createReservation(raceStay);
    await makeInHouse(raceTarget.reservationId, raceTarget.segmentId);
    const beforeKeys = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM api_idempotency
      WHERE tenant_id = ${TENANT_A}::uuid AND operation = 'reservation.segment.move_room'
    `;
    const attempts = Array.from({ length: 20 }, (_, index) => ({
      reservationId: raceTarget.reservationId,
      segmentId: raceTarget.segmentId,
      expectedSellableUnitId: SELLABLE_A,
      expectedPeriod: exactPeriod(raceStay),
      destinationSellableUnitId: SELLABLE_B,
      idempotencyKey: `order086-race-${String(index).padStart(2, "0")}`,
      envelope: envelope("segment.moved"),
    }));
    const results = await Promise.allSettled(attempts.map((attempt) => moveRoom(
      segmentService(events!, { now: instant(61), idFactory: () => crypto.randomUUID() }),
      attempt,
    )));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(19);
    const afterKeys = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM api_idempotency
      WHERE tenant_id = ${TENANT_A}::uuid AND operation = 'reservation.segment.move_room'
    `;
    expect(afterKeys[0]!.count - beforeKeys[0]!.count).toBe(1);
    const raceTruth = await admin!<Array<{ segments: number; claims: number; moves: number }>>`
      SELECT
        (SELECT count(*)::int FROM reservation_segment
          WHERE reservation_id = ${raceTarget.reservationId}::uuid) AS segments,
        (SELECT count(*)::int FROM space_occupancy
          WHERE slot_ref IN (SELECT id FROM reservation_segment
            WHERE reservation_id = ${raceTarget.reservationId}::uuid)) AS claims,
        (SELECT count(*)::int FROM fact_log
          WHERE entity_type = 'reservation_segment' AND fact_type = 'segment.moved'
            AND payload->>'reservation_id' = ${raceTarget.reservationId}) AS moves
    `;
    expect(raceTruth).toEqual([{ segments: 2, claims: 1, moves: 1 }]);
  }, 60_000);

  test("P4: tenant, state, shape, stale-value and idempotency guards fail closed", async () => {
    const scopedStay = period(70, 3);
    const scoped = await createReservation(scopedStay);
    const scopedBase = {
      reservationId: scoped.reservationId,
      segmentId: scoped.segmentId,
      expectedPeriod: exactPeriod(scopedStay),
      newDeparture: instant(74).toISOString(),
      idempotencyKey: "order086-scope-tenant",
      envelope: envelope("reservation.modified", ACTOR_FOREIGN, TENANT_B, PROPERTY_B),
    } as const;
    await expectUnchanged(
      scoped.reservationId,
      changeDeparture(segmentService(events!), scopedBase),
      ReservationLifecycleNotFoundError,
    );
    await expectUnchanged(
      scoped.reservationId,
      changeDeparture(segmentService(events!), {
        ...scopedBase,
        idempotencyKey: "order086-scope-property",
        envelope: envelope("reservation.modified", ACTOR_A, TENANT_A, PROPERTY_A2),
      }),
      ReservationLifecycleNotFoundError,
    );
    await expectUnchanged(
      scoped.reservationId,
      changeDeparture(segmentService(events!), {
        ...scopedBase,
        expectedPeriod: exactPeriod(period(69, 3)),
        idempotencyKey: "order086-stale-period",
        envelope: envelope("reservation.modified"),
      }),
      ReservationLifecycleConflictError,
    );
    await expectUnchanged(
      scoped.reservationId,
      changeDeparture(segmentService(events!), {
        ...scopedBase,
        newDeparture: scopedStay.to.toISOString(),
        idempotencyKey: "order086-noop-departure",
        envelope: envelope("reservation.modified"),
      }),
      ReservationLifecycleValidationError,
    );
    await expectUnchanged(
      scoped.reservationId,
      changeDeparture(segmentService(events!), {
        ...scopedBase,
        newDeparture: "2036-01-74 15:00",
        idempotencyKey: "order086-invalid-departure",
        envelope: envelope("reservation.modified"),
      }),
      ReservationLifecycleValidationError,
    );

    const liveStay = period(80, 3);
    const live = await createReservation(liveStay);
    await makeInHouse(live.reservationId, live.segmentId);
    await expectUnchanged(
      live.reservationId,
      changeDeparture(segmentService(events!, { now: instant(81) }), {
        reservationId: live.reservationId,
        segmentId: live.segmentId,
        expectedPeriod: exactPeriod(liveStay),
        newDeparture: instant(81).toISOString(),
        idempotencyKey: "order086-live-past-end",
        envelope: envelope("reservation.modified"),
      }),
      ReservationLifecycleConflictError,
    );

    const nonLatestStay = period(90, 4);
    const nonLatest = await createReservation(nonLatestStay);
    await makeInHouse(nonLatest.reservationId, nonLatest.segmentId);
    const firstMove = await moveRoom(
      segmentService(events!, { now: instant(91), idFactory: () => crypto.randomUUID() }),
      {
        reservationId: nonLatest.reservationId,
        segmentId: nonLatest.segmentId,
        expectedSellableUnitId: SELLABLE_A,
        expectedPeriod: exactPeriod(nonLatestStay),
        destinationSellableUnitId: SELLABLE_B,
        idempotencyKey: "order086-create-nonlatest",
        envelope: envelope("segment.moved"),
      },
    );
    await expectUnchanged(
      nonLatest.reservationId,
      changeDeparture(segmentService(events!), {
        reservationId: nonLatest.reservationId,
        segmentId: nonLatest.segmentId,
        expectedPeriod: firstMove.departedPeriod,
        newDeparture: instant(92).toISOString(),
        idempotencyKey: "order086-nonlatest",
        envelope: envelope("reservation.modified"),
      }),
      ReservationLifecycleConflictError,
    );

    const bookedMoveStay = period(100, 3);
    const bookedMove = await createReservation(bookedMoveStay);
    await expectUnchanged(
      bookedMove.reservationId,
      moveRoom(segmentService(events!, { now: instant(101) }), {
        reservationId: bookedMove.reservationId,
        segmentId: bookedMove.segmentId,
        expectedSellableUnitId: SELLABLE_A,
        expectedPeriod: exactPeriod(bookedMoveStay),
        destinationSellableUnitId: SELLABLE_B,
        idempotencyKey: "order086-booked-move",
        envelope: envelope("segment.moved"),
      }),
      ReservationLifecycleConflictError,
    );

    const nullStay = period(110, 3);
    const nullTarget = await createReservation(nullStay);
    await admin!`UPDATE reservation_segment SET sellable_unit_id = NULL WHERE id = ${nullTarget.segmentId}::uuid`;
    await expectUnchanged(
      nullTarget.reservationId,
      changeDeparture(segmentService(events!), {
        reservationId: nullTarget.reservationId,
        segmentId: nullTarget.segmentId,
        expectedPeriod: exactPeriod(nullStay),
        newDeparture: instant(114).toISOString(),
        idempotencyKey: "order086-null-sellable",
        envelope: envelope("reservation.modified"),
      }),
      ReservationLifecycleConflictError,
    );

    const invalidDestinations = [
      [SELLABLE_CROSS_TYPE, "cross-type"],
      [SELLABLE_COMPOSITE, "composite"],
      [SELLABLE_POSITIONAL, "positional"],
      [SELLABLE_SAME_SPACE, "same-space"],
      [SELLABLE_FOREIGN, "foreign"],
    ] as const;
    for (const [destinationSellableUnitId, label] of invalidDestinations) {
      const day = 120 + invalidDestinations.findIndex((entry) => entry[0] === destinationSellableUnitId) * 5;
      const stay = period(day, 3);
      const target = await createReservation(stay);
      await makeInHouse(target.reservationId, target.segmentId);
      await expectUnchanged(
        target.reservationId,
        moveRoom(segmentService(events!, { now: instant(day + 1), idFactory: () => crypto.randomUUID() }), {
          reservationId: target.reservationId,
          segmentId: target.segmentId,
          expectedSellableUnitId: SELLABLE_A,
          expectedPeriod: exactPeriod(stay),
          destinationSellableUnitId,
          idempotencyKey: `order086-${label}-destination`,
          envelope: envelope("segment.moved"),
        }),
        ReservationLifecycleConflictError,
      );
    }

    for (const [sourceSellable, label, destination] of [
      [SELLABLE_COMPOSITE, "composite", SELLABLE_B],
      [SELLABLE_POSITIONAL, "positional", SELLABLE_B],
    ] as const) {
      const day = label === "composite" ? 150 : 155;
      const stay = period(day, 3);
      const target = await createReservation(stay, sourceSellable);
      await makeInHouse(target.reservationId, target.segmentId);
      await expectUnchanged(
        target.reservationId,
        moveRoom(segmentService(events!, { now: instant(day + 1), idFactory: () => crypto.randomUUID() }), {
          reservationId: target.reservationId,
          segmentId: target.segmentId,
          expectedSellableUnitId: sourceSellable,
          expectedPeriod: exactPeriod(stay),
          destinationSellableUnitId: destination,
          idempotencyKey: `order086-${label}-source`,
          envelope: envelope("segment.moved"),
        }),
        ReservationLifecycleConflictError,
      );
    }

    const clockStay = period(165, 3);
    const clockTarget = await createReservation(clockStay);
    await makeInHouse(clockTarget.reservationId, clockTarget.segmentId);
    await expectUnchanged(
      clockTarget.reservationId,
      moveRoom(segmentService(events!, { now: instant(169) }), {
        reservationId: clockTarget.reservationId,
        segmentId: clockTarget.segmentId,
        expectedSellableUnitId: SELLABLE_A,
        expectedPeriod: exactPeriod(clockStay),
        destinationSellableUnitId: SELLABLE_B,
        idempotencyKey: "order086-invalid-clock",
        envelope: envelope("segment.moved"),
      }),
      ReservationLifecycleConflictError,
    );
    await expectUnchanged(
      clockTarget.reservationId,
      moveRoom(segmentService(events!, { now: instant(166) }), {
        reservationId: clockTarget.reservationId,
        segmentId: clockTarget.segmentId,
        expectedSellableUnitId: SELLABLE_A,
        expectedPeriod: exactPeriod(clockStay),
        destinationSellableUnitId: SELLABLE_A,
        idempotencyKey: "order086-same-destination",
        envelope: envelope("segment.moved"),
      }),
      ReservationLifecycleValidationError,
    );

    const keyStay = period(175, 2);
    const keyTarget = await createReservation(keyStay);
    const key = "order086-actor-bound-key";
    const keyInput = {
      reservationId: keyTarget.reservationId,
      segmentId: keyTarget.segmentId,
      expectedPeriod: exactPeriod(keyStay),
      newDeparture: instant(178).toISOString(),
      idempotencyKey: key,
      envelope: envelope("reservation.modified", ACTOR_A),
    } as const;
    await changeDeparture(segmentService(events!), keyInput);
    await expect(changeDeparture(segmentService(events!), {
      ...keyInput,
      newDeparture: instant(179).toISOString(),
      envelope: envelope("reservation.modified", ACTOR_A),
    })).rejects.toBeInstanceOf(IdempotencyConflictError);
    await expect(changeDeparture(segmentService(events!), {
      ...keyInput,
      envelope: envelope("reservation.modified", ACTOR_B),
    })).rejects.toBeInstanceOf(IdempotencyConflictError);
  }, 90_000);

  test("P5: every publication boundary rolls all state back before same-key retry", async () => {
    let day = 190;
    for (const classification of ["extended", "shortened"] as const) {
      for (const failAt of [1, 2, 3]) {
        const stay = period(day, classification === "extended" ? 2 : 4);
        const target = await createReservation(stay);
        const now = instant(day + 1, 8);
        if (classification === "shortened") await makeInHouse(target.reservationId, target.segmentId);
        const newDeparture = instant(day + 3);
        const requestId = crypto.randomUUID();
        const input = {
          reservationId: target.reservationId,
          segmentId: target.segmentId,
          expectedPeriod: exactPeriod(stay),
          newDeparture: newDeparture.toISOString(),
          idempotencyKey: `order086-${classification}-publish-${failAt}`,
          envelope: envelope("reservation.modified", ACTOR_A, TENANT_A, PROPERTY_A, requestId),
        } as const;
        const before = await snapshot(target.reservationId);
        await expect(changeDeparture(
          segmentService(new FailAtEventBus(events!, failAt), { now }),
          input,
        )).rejects.toThrow(`Order 086 injected publication failure ${failAt}`);
        expect(await snapshot(target.reservationId)).toEqual(before);
        expect(await failedArtifacts(requestId)).toEqual({ facts: 0, events: 0 });
        expect((await changeDeparture(segmentService(events!, { now }), input)).replayed).toBe(false);
        day += 5;
      }
    }

    for (const failAt of [1, 2, 3]) {
      const stay = period(day, 4);
      const movedAt = instant(day + 1);
      const target = await createReservation(stay);
      await makeInHouse(target.reservationId, target.segmentId);
      const requestId = crypto.randomUUID();
      const input = {
        reservationId: target.reservationId,
        segmentId: target.segmentId,
        expectedSellableUnitId: SELLABLE_A,
        expectedPeriod: exactPeriod(stay),
        destinationSellableUnitId: SELLABLE_B,
        idempotencyKey: `order086-move-publish-${failAt}`,
        envelope: envelope("segment.moved", ACTOR_A, TENANT_A, PROPERTY_A, requestId),
      } as const;
      const before = await snapshot(target.reservationId);
      await expect(moveRoom(
        segmentService(new FailAtEventBus(events!, failAt), {
          now: movedAt,
          idFactory: () => crypto.randomUUID(),
        }),
        input,
      )).rejects.toThrow(`Order 086 injected publication failure ${failAt}`);
      expect(await snapshot(target.reservationId)).toEqual(before);
      expect(await failedArtifacts(requestId)).toEqual({ facts: 0, events: 0 });
      expect((await moveRoom(segmentService(events!, {
        now: movedAt,
        idFactory: () => crypto.randomUUID(),
      }), input)).replayed).toBe(false);
      day += 5;
    }
  }, 120_000);
});
