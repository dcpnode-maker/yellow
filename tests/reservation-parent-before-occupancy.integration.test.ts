import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  HoldService,
  ReservationOccupancyService,
  type ClaimReservationSegmentInput,
  type ConsumeCartHoldInput,
  type ConsumedCartHold,
  type PrepareCartHoldForSegmentInput,
  type PreparedCartHoldForSegment,
  type PrepareReservationSegmentClaimInput,
  type PreparedReservationSegmentClaim,
  type ReservationSegmentClaim,
} from "../src/contexts/inventory";
import { ReservationCommitService } from "../src/contexts/reservations";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
  type Tx,
} from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_RESERVATION_PARENT_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESERVATION_PARENT === "1";

const TENANT = "00000000-0000-0000-0000-000000012901";
const PROPERTY = "00000000-0000-0000-0000-000000012911";
const ACTOR = "00000000-0000-0000-0000-000000012921";
const PARTY = "00000000-0000-0000-0000-000000012931";
const RATE_PLAN = "00000000-0000-0000-0000-000000012941";
const UNIT_TYPE = "00000000-0000-0000-0000-000000012951";
const SPACE = "00000000-0000-0000-0000-000000012961";
const SPACE_POSITIONAL = "00000000-0000-0000-0000-000000012962";
const SELLABLE = "00000000-0000-0000-0000-000000012971";
const SELLABLE_POSITIONAL = "00000000-0000-0000-0000-000000012972";
const DIRECT_RESERVATION = "00000000-0000-0000-0000-000000012981";
const DIRECT_SEGMENT = "00000000-0000-0000-0000-000000012982";
const HELD_RESERVATION = "00000000-0000-0000-0000-000000012983";
const HELD_SEGMENT = "00000000-0000-0000-0000-000000012984";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RESERVATION_PARENT_URL is required by the Order 129 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let holds: HoldService | undefined;

function stay(offset: number): Readonly<{ from: Date; to: Date }> {
  return Object.freeze({
    from: new Date(Date.UTC(2032, 0, 1 + offset, 14)),
    to: new Date(Date.UTC(2032, 0, 3 + offset, 10)),
  });
}

function envelope(operation: string, requestId = crypto.randomUUID()) {
  return createAuditEnvelope({
    actorId: ACTOR,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    requestId,
    operation,
  });
}

function fixedId(value: number): string {
  return `00000000-0000-0000-0000-${value.toString().padStart(12, "0")}`;
}

function serviceFor(
  reservationId: string,
  segmentId: string,
  options: Readonly<{
    holds?: HoldService;
    occupancy?: ReservationOccupancyService;
    events?: EventBus;
  }> = {},
): ReservationCommitService {
  const ids = [reservationId, segmentId];
  const bus = options.events ?? events!;
  return new ReservationCommitService({
    holds: options.holds ?? holds!,
    ...(options.occupancy ? { occupancy: options.occupancy } : {}),
    events: bus,
    idempotency: new PostgresIdempotency(),
    idFactory: () => {
      const id = ids.shift();
      if (!id) throw new Error("Order 129 deterministic id factory was exhausted");
      return id;
    },
  });
}

class StaleDirectPreparationService extends ReservationOccupancyService {
  override async prepareClaimForSegment(
    tx: Tx,
    input: PrepareReservationSegmentClaimInput,
  ): Promise<PreparedReservationSegmentClaim> {
    const prepared = await super.prepareClaimForSegment(tx, input);
    await tx`
      UPDATE sellable_unit SET status = 'inactive'
      WHERE tenant_id = ${input.envelope.tenantId}::uuid
        AND id = ${prepared.sellableUnitId}::uuid
    `;
    return prepared;
  }
}

class MismatchingDirectAcquisitionService extends ReservationOccupancyService {
  override async claimForSegment(
    tx: Tx,
    input: ClaimReservationSegmentInput,
  ): Promise<ReservationSegmentClaim> {
    const acquired = await super.claimForSegment(tx, input);
    return Object.freeze({ ...acquired, claimCount: acquired.claimCount + 1 });
  }
}

class StaleHoldPreparationService extends HoldService {
  override async prepareForSegment(
    tx: Tx,
    input: PrepareCartHoldForSegmentInput,
  ): Promise<PreparedCartHoldForSegment> {
    const prepared = await super.prepareForSegment(tx, input);
    await tx`
      UPDATE hold SET status = 'released'
      WHERE tenant_id = ${input.envelope.tenantId}::uuid
        AND id = ${prepared.holdId}::uuid
    `;
    return prepared;
  }
}

class FailingHoldAcquisitionService extends HoldService {
  override async consumeForSegment(_tx: Tx, _input: ConsumeCartHoldInput): Promise<ConsumedCartHold> {
    throw new Error("order129 injected hold acquisition failure");
  }
}

async function artifactCounts(reservationId: string, segmentId: string) {
  const rows = await admin!<Array<{
    reservations: number;
    segments: number;
    guests: number;
    segment_claims: number;
    facts: number;
    events: number;
    idempotency: number;
  }>>`
    SELECT
      (SELECT count(*)::int FROM reservation WHERE id = ${reservationId}::uuid) AS reservations,
      (SELECT count(*)::int FROM reservation_segment WHERE id = ${segmentId}::uuid) AS segments,
      (SELECT count(*)::int FROM reservation_guest
        WHERE reservation_id = ${reservationId}::uuid) AS guests,
      (SELECT count(*)::int FROM space_occupancy
        WHERE slot_kind = 'segment' AND slot_ref = ${segmentId}::uuid) AS segment_claims,
      (SELECT count(*)::int FROM fact_log
        WHERE tenant_id = ${TENANT}::uuid
          AND entity_id IN (${reservationId}::uuid, ${segmentId}::uuid)) AS facts,
      (SELECT count(*)::int FROM outbox
        WHERE tenant_id = ${TENANT}::uuid
          AND aggregate_id IN (${reservationId}::uuid, ${segmentId}::uuid)) AS events,
      (SELECT count(*)::int FROM api_idempotency
        WHERE tenant_id = ${TENANT}::uuid
          AND operation = 'reservation.commit'
          AND response_body->>'reservationId' = ${reservationId}) AS idempotency
  `;
  const row = rows[0];
  if (!row) throw new Error("PostgreSQL returned no Order 129 artifact snapshot");
  return row;
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 8 });
  eventPool = new SQL(DATABASE_URL, { max: 8 });
  database = Database.connect(DATABASE_URL, { maxConnections: 16 });
  events = new PostgresEventBus(eventPool);
  holds = new HoldService(events);

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${TENANT}::uuid, 'order129', 'Order 129', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES (${PROPERTY}::uuid, ${TENANT}::uuid, 'order129', 'property',
      'Order 129 Property', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO party (id, tenant_id, kind, display_name, status)
    VALUES (${PARTY}::uuid, ${TENANT}::uuid, 'person', 'Order 129 Guest', 'active')
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key)
    VALUES (${UNIT_TYPE}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid,
      'O129', 'Order 129 Room', 'hotel')
  `;
  await admin`
    INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity)
    VALUES
      (${SPACE}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O129-1', 'hotel', 1),
      (${SPACE_POSITIONAL}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O129-P', 'hotel', 2)
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name)
    VALUES
      (${SELLABLE}::uuid, ${TENANT}::uuid, ${UNIT_TYPE}::uuid, 'Order 129 Sellable'),
      (${SELLABLE_POSITIONAL}::uuid, ${TENANT}::uuid, ${UNIT_TYPE}::uuid, 'Order 129 Positional')
  `;
  await admin`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    VALUES
      (${TENANT}::uuid, ${SELLABLE}::uuid, ${SPACE}::uuid, 'exclusive'),
      (${TENANT}::uuid, ${SELLABLE_POSITIONAL}::uuid, ${SPACE_POSITIONAL}::uuid, 'positional')
  `;
  await admin`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, status)
    VALUES (${RATE_PLAN}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid,
      'O129', 'Order 129 Rate', 'USD', 'active')
  `;

  await admin.unsafe(`
    CREATE TABLE order129_parent_observation (
      tenant_id uuid NOT NULL,
      reservation_id uuid NOT NULL,
      segment_id uuid NOT NULL,
      property_node uuid NOT NULL,
      sellable_unit_id uuid NOT NULL,
      unit_type_id uuid NOT NULL,
      period tstzrange NOT NULL
    )
  `);
  await admin.unsafe(`
    CREATE FUNCTION order129_require_segment_parent() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.slot_kind = 'segment' AND NOT EXISTS (
        SELECT 1
        FROM reservation_segment AS segment
        JOIN reservation
          ON reservation.id = segment.reservation_id
         AND reservation.tenant_id = segment.tenant_id
        JOIN space
          ON space.id = NEW.space_id
         AND space.tenant_id = NEW.tenant_id
        WHERE segment.id = NEW.slot_ref
          AND segment.tenant_id = NEW.tenant_id
          AND reservation.property_node = space.property_node
          AND segment.period = NEW.period
          AND EXISTS (
            SELECT 1 FROM sellable_unit
            WHERE sellable_unit.id = segment.sellable_unit_id
              AND sellable_unit.tenant_id = segment.tenant_id
              AND sellable_unit.unit_type_id = segment.unit_type_id
          )
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = 'P0129',
          MESSAGE = 'order129 segment parent missing before occupancy';
      END IF;
      IF NEW.slot_kind = 'segment' THEN
        INSERT INTO order129_parent_observation (
          tenant_id, reservation_id, segment_id, property_node,
          sellable_unit_id, unit_type_id, period
        )
        SELECT segment.tenant_id, segment.reservation_id, segment.id,
          reservation.property_node, segment.sellable_unit_id,
          segment.unit_type_id, segment.period
        FROM reservation_segment AS segment
        JOIN reservation
          ON reservation.id = segment.reservation_id
         AND reservation.tenant_id = segment.tenant_id
        WHERE segment.id = NEW.slot_ref
          AND segment.tenant_id = NEW.tenant_id;
      END IF;
      RETURN NEW;
    END
    $$
  `);
  await admin.unsafe(`
    CREATE TRIGGER order129_require_segment_parent
    BEFORE INSERT ON space_occupancy
    FOR EACH ROW EXECUTE FUNCTION order129_require_segment_parent()
  `);
});

afterAll(async () => {
  if (admin) {
    await admin.unsafe("DROP TRIGGER IF EXISTS order129_require_segment_parent ON space_occupancy");
    await admin.unsafe("DROP FUNCTION IF EXISTS order129_require_segment_parent()");
    await admin.unsafe("DROP TABLE IF EXISTS order129_parent_observation");
  }
  await database?.close();
  await eventPool?.close();
  await admin?.close();
}, 30_000);

databaseDescribe("Order 129 reservation parents precede segment occupancy", () => {
  test("P1: direct commit creates its exact parents before segment occupancy", async () => {
    const directStay = stay(0);
    const service = serviceFor(DIRECT_RESERVATION, DIRECT_SEGMENT);
    const input = {
      sellableUnitId: SELLABLE,
      ...directStay,
      primaryPartyId: PARTY,
      ratePlanId: RATE_PLAN,
      adults: 2,
      childAges: [7],
      channelCode: "direct",
      idempotencyKey: "order129-direct-red",
      envelope: envelope("reservation.confirmed"),
    };
    const created = await database!.withTenantTransaction(TENANT, (tx) =>
      service.commitDirect(tx, input));
    expect(created).toMatchObject({
      reservationId: DIRECT_RESERVATION,
      segmentId: DIRECT_SEGMENT,
      source: "direct",
      sellableUnitId: SELLABLE,
      unitTypeId: UNIT_TYPE,
      from: directStay.from.toISOString(),
      to: directStay.to.toISOString(),
      claimCount: 1,
      replayed: false,
    });
    const replayed = await database!.withTenantTransaction(TENANT, (tx) =>
      service.commitDirect(tx, { ...input, envelope: envelope("reservation.confirmed") }));
    expect(replayed).toEqual({ ...created, replayed: true });
    expect(await artifactCounts(DIRECT_RESERVATION, DIRECT_SEGMENT)).toEqual({
      reservations: 1,
      segments: 1,
      guests: 1,
      segment_claims: 1,
      facts: 2,
      events: 1,
      idempotency: 1,
    });
    const observations = await admin!<Array<Record<string, unknown>>>`
      SELECT tenant_id, reservation_id, segment_id, property_node,
        sellable_unit_id, unit_type_id, lower(period) AS from_at, upper(period) AS to_at
      FROM order129_parent_observation WHERE segment_id = ${DIRECT_SEGMENT}::uuid
    `;
    expect(observations).toEqual([{
      tenant_id: TENANT,
      reservation_id: DIRECT_RESERVATION,
      segment_id: DIRECT_SEGMENT,
      property_node: PROPERTY,
      sellable_unit_id: SELLABLE,
      unit_type_id: UNIT_TYPE,
      from_at: directStay.from,
      to_at: directStay.to,
    }]);
  });

  test("P1: held conversion creates its exact parents before segment occupancy", async () => {
    const heldStay = stay(10);
    const hold = await database!.withTenantTransaction(TENANT, (tx) => holds!.place(tx, {
      sellableUnitId: SELLABLE,
      ...heldStay,
      ttlSeconds: 900,
      holder: { client_id: "order129-held-red" },
      envelope: envelope("hold.created"),
    }));
    const service = serviceFor(HELD_RESERVATION, HELD_SEGMENT);
    const input = {
      holdId: hold.id,
      primaryPartyId: PARTY,
      ratePlanId: RATE_PLAN,
      adults: 1,
      childAges: [] as readonly number[],
      channelCode: "direct",
      idempotencyKey: "order129-held-red",
      envelope: envelope("reservation.confirmed"),
    };
    const created = await database!.withTenantTransaction(TENANT, (tx) =>
      service.commitHeld(tx, input));
    expect(created).toMatchObject({
      reservationId: HELD_RESERVATION,
      segmentId: HELD_SEGMENT,
      source: "hold",
      holdId: hold.id,
      sellableUnitId: SELLABLE,
      unitTypeId: UNIT_TYPE,
      from: heldStay.from.toISOString(),
      to: heldStay.to.toISOString(),
      claimCount: 1,
      replayed: false,
    });
    const replayed = await database!.withTenantTransaction(TENANT, (tx) =>
      service.commitHeld(tx, { ...input, envelope: envelope("reservation.confirmed") }));
    expect(replayed).toEqual({ ...created, replayed: true });
    expect(await artifactCounts(HELD_RESERVATION, HELD_SEGMENT)).toEqual({
      reservations: 1,
      segments: 1,
      guests: 1,
      segment_claims: 1,
      facts: 1,
      events: 1,
      idempotency: 1,
    });
    const holdRows = await admin!<Array<{ status: string; claims: number }>>`
      SELECT hold.status,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref = hold.id) AS claims
      FROM hold WHERE hold.id = ${hold.id}::uuid
    `;
    expect(holdRows[0]).toEqual({ status: "consumed", claims: 0 });
    const observations = await admin!<Array<Record<string, unknown>>>`
      SELECT tenant_id, reservation_id, segment_id, property_node,
        sellable_unit_id, unit_type_id, lower(period) AS from_at, upper(period) AS to_at
      FROM order129_parent_observation WHERE segment_id = ${HELD_SEGMENT}::uuid
    `;
    expect(observations).toEqual([{
      tenant_id: TENANT,
      reservation_id: HELD_RESERVATION,
      segment_id: HELD_SEGMENT,
      property_node: PROPERTY,
      sellable_unit_id: SELLABLE,
      unit_type_id: UNIT_TYPE,
      from_at: heldStay.from,
      to_at: heldStay.to,
    }]);
  });

  test("P2: stale direct preparation and acquired-identity mismatch roll every provisional artifact back", async () => {
    const staleReservation = fixedId(129101);
    const staleSegment = fixedId(129102);
    const staleStay = stay(20);
    const staleService = serviceFor(staleReservation, staleSegment, {
      occupancy: new StaleDirectPreparationService(events!),
    });
    await expect(database!.withTenantTransaction(TENANT, (tx) => staleService.commitDirect(tx, {
      sellableUnitId: SELLABLE,
      ...staleStay,
      primaryPartyId: PARTY,
      ratePlanId: RATE_PLAN,
      adults: 1,
      childAges: [],
      channelCode: "direct",
      idempotencyKey: "order129-stale-direct",
      envelope: envelope("reservation.confirmed"),
    }))).rejects.toThrow("Active sellable unit");
    expect(await artifactCounts(staleReservation, staleSegment)).toEqual({
      reservations: 0, segments: 0, guests: 0, segment_claims: 0,
      facts: 0, events: 0, idempotency: 0,
    });
    expect((await admin!<Array<{ status: string }>>`
      SELECT status FROM sellable_unit WHERE id = ${SELLABLE}::uuid
    `)[0]?.status).toBe("active");

    const mismatchReservation = fixedId(129103);
    const mismatchSegment = fixedId(129104);
    const mismatchStay = stay(30);
    const mismatchService = serviceFor(mismatchReservation, mismatchSegment, {
      occupancy: new MismatchingDirectAcquisitionService(events!),
    });
    await expect(database!.withTenantTransaction(TENANT, (tx) => mismatchService.commitDirect(tx, {
      sellableUnitId: SELLABLE,
      ...mismatchStay,
      primaryPartyId: PARTY,
      ratePlanId: RATE_PLAN,
      adults: 1,
      childAges: [],
      channelCode: "direct",
      idempotencyKey: "order129-mismatch-direct",
      envelope: envelope("reservation.confirmed"),
    }))).rejects.toThrow("did not match the frozen reservation preparation");
    expect(await artifactCounts(mismatchReservation, mismatchSegment)).toEqual({
      reservations: 0, segments: 0, guests: 0, segment_claims: 0,
      facts: 0, events: 0, idempotency: 0,
    });
  });

  test("P2: direct acquisition conflict rolls provisional parents back and same-key retry succeeds", async () => {
    const reservationId = fixedId(129111);
    const segmentId = fixedId(129112);
    const blockedStay = stay(40);
    const blocker = await database!.withTenantTransaction(TENANT, (tx) => holds!.place(tx, {
      sellableUnitId: SELLABLE,
      ...blockedStay,
      ttlSeconds: 900,
      holder: { client_id: "order129-direct-blocker" },
      envelope: envelope("hold.created"),
    }));
    const input = {
      sellableUnitId: SELLABLE,
      ...blockedStay,
      primaryPartyId: PARTY,
      ratePlanId: RATE_PLAN,
      adults: 1,
      childAges: [] as readonly number[],
      channelCode: "direct",
      idempotencyKey: "order129-direct-retry",
      envelope: envelope("reservation.confirmed"),
    };
    await expect(database!.withTenantTransaction(TENANT, (tx) =>
      serviceFor(reservationId, segmentId).commitDirect(tx, input))).rejects.toThrow(
        "Direct inventory is no longer available",
      );
    expect(await artifactCounts(reservationId, segmentId)).toEqual({
      reservations: 0, segments: 0, guests: 0, segment_claims: 0,
      facts: 0, events: 0, idempotency: 0,
    });
    await database!.withTenantTransaction(TENANT, (tx) => holds!.release(tx, {
      holdId: blocker.id,
      envelope: envelope("hold.released"),
    }));
    const retried = await database!.withTenantTransaction(TENANT, (tx) =>
      serviceFor(reservationId, segmentId).commitDirect(tx, {
        ...input,
        envelope: envelope("reservation.confirmed"),
      }));
    expect(retried).toMatchObject({ reservationId, segmentId, replayed: false, claimCount: 1 });
  });

  test("P2: stale and injected held acquisition failures restore the active hold and retry cleanly", async () => {
    const cases = [
      {
        offset: 50,
        reservationId: fixedId(129121),
        segmentId: fixedId(129122),
        holdService: new StaleHoldPreparationService(events!),
        message: "Held inventory is no longer available",
      },
      {
        offset: 60,
        reservationId: fixedId(129123),
        segmentId: fixedId(129124),
        holdService: new FailingHoldAcquisitionService(events!),
        message: "order129 injected hold acquisition failure",
      },
    ] as const;
    for (const item of cases) {
      const heldStay = stay(item.offset);
      const hold = await database!.withTenantTransaction(TENANT, (tx) => holds!.place(tx, {
        sellableUnitId: SELLABLE,
        ...heldStay,
        ttlSeconds: 900,
        holder: { client_id: `order129-held-${item.offset}` },
        envelope: envelope("hold.created"),
      }));
      const input = {
        holdId: hold.id,
        primaryPartyId: PARTY,
        ratePlanId: RATE_PLAN,
        adults: 1,
        childAges: [] as readonly number[],
        channelCode: "direct",
        idempotencyKey: `order129-held-retry-${item.offset}`,
        envelope: envelope("reservation.confirmed"),
      };
      await expect(database!.withTenantTransaction(TENANT, (tx) =>
        serviceFor(item.reservationId, item.segmentId, { holds: item.holdService })
          .commitHeld(tx, input))).rejects.toThrow(item.message);
      expect(await artifactCounts(item.reservationId, item.segmentId)).toEqual({
        reservations: 0, segments: 0, guests: 0, segment_claims: 0,
        facts: 0, events: 0, idempotency: 0,
      });
      const holdSnapshot = (await admin!<Array<{ status: string; claims: number }>>`
        SELECT hold.status,
          (SELECT count(*)::int FROM space_occupancy WHERE slot_ref = hold.id) AS claims
        FROM hold WHERE id = ${hold.id}::uuid
      `)[0];
      expect(holdSnapshot).toEqual({ status: "active", claims: 1 });
      const retried = await database!.withTenantTransaction(TENANT, (tx) =>
        serviceFor(item.reservationId, item.segmentId).commitHeld(tx, {
          ...input,
          envelope: envelope("reservation.confirmed"),
        }));
      expect(retried).toMatchObject({
        reservationId: item.reservationId,
        segmentId: item.segmentId,
        holdId: hold.id,
        replayed: false,
      });
    }
  }, 30_000);

  test("P3: exclusive and positional direct races commit only database-capacity winners", async () => {
    const race = async (sellableUnitId: string, offset: number, count: number, base: number) => {
      const raceStay = stay(offset);
      const attempts = Array.from({ length: count }, (_, index) => {
        const reservationId = fixedId(base + index * 2);
        const segmentId = fixedId(base + index * 2 + 1);
        return {
          reservationId,
          segmentId,
          promise: database!.withTenantTransaction(TENANT, (tx) =>
            serviceFor(reservationId, segmentId).commitDirect(tx, {
              sellableUnitId,
              ...raceStay,
              primaryPartyId: PARTY,
              ratePlanId: RATE_PLAN,
              adults: 1,
              childAges: [],
              channelCode: "direct",
              idempotencyKey: `order129-race-${base}-${index}`,
              envelope: envelope("reservation.confirmed"),
            })),
        };
      });
      return { attempts, results: await Promise.allSettled(attempts.map(({ promise }) => promise)) };
    };

    const exclusive = await race(SELLABLE, 70, 2, 129200);
    expect(exclusive.results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(exclusive.results.filter(({ status }) => status === "rejected")).toHaveLength(1);
    for (const [index, attempt] of exclusive.attempts.entries()) {
      const snapshot = await artifactCounts(attempt.reservationId, attempt.segmentId);
      expect(snapshot.reservations).toBe(exclusive.results[index]?.status === "fulfilled" ? 1 : 0);
      expect(snapshot.segment_claims).toBe(exclusive.results[index]?.status === "fulfilled" ? 1 : 0);
    }

    const positional = await race(SELLABLE_POSITIONAL, 80, 3, 129210);
    expect(positional.results.filter(({ status }) => status === "fulfilled")).toHaveLength(2);
    expect(positional.results.filter(({ status }) => status === "rejected")).toHaveLength(1);
    const claims = await admin!<Array<{ claim: string }>>`
      SELECT claim::text AS claim FROM space_occupancy
      WHERE tenant_id = ${TENANT}::uuid
        AND space_id = ${SPACE_POSITIONAL}::uuid
        AND period = tstzrange(${stay(80).from.toISOString()}::timestamptz,
          ${stay(80).to.toISOString()}::timestamptz, '[)')
      ORDER BY claim
    `;
    expect(claims).toHaveLength(2);
    expect(new Set(claims.map(({ claim }) => claim)).size).toBe(2);
    for (const [index, attempt] of positional.attempts.entries()) {
      const snapshot = await artifactCounts(attempt.reservationId, attempt.segmentId);
      expect(snapshot.reservations).toBe(positional.results[index]?.status === "fulfilled" ? 1 : 0);
    }
  }, 30_000);

  test("P3: two consumers of one hold produce one reservation and one inert loser", async () => {
    const heldStay = stay(90);
    const hold = await database!.withTenantTransaction(TENANT, (tx) => holds!.place(tx, {
      sellableUnitId: SELLABLE,
      ...heldStay,
      ttlSeconds: 900,
      holder: { client_id: "order129-held-race" },
      envelope: envelope("hold.created"),
    }));
    const identities = [
      { reservationId: fixedId(129220), segmentId: fixedId(129221), key: "order129-hold-race-a" },
      { reservationId: fixedId(129222), segmentId: fixedId(129223), key: "order129-hold-race-b" },
    ];
    const results = await Promise.allSettled(identities.map((identity) =>
      database!.withTenantTransaction(TENANT, (tx) =>
        serviceFor(identity.reservationId, identity.segmentId).commitHeld(tx, {
          holdId: hold.id,
          primaryPartyId: PARTY,
          ratePlanId: RATE_PLAN,
          adults: 1,
          childAges: [],
          channelCode: "direct",
          idempotencyKey: identity.key,
          envelope: envelope("reservation.confirmed"),
        }))));
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
    for (const [index, identity] of identities.entries()) {
      const snapshot = await artifactCounts(identity.reservationId, identity.segmentId);
      expect(snapshot.reservations).toBe(results[index]?.status === "fulfilled" ? 1 : 0);
      expect(snapshot.segment_claims).toBe(results[index]?.status === "fulfilled" ? 1 : 0);
    }
    const final = (await admin!<Array<{ status: string; reservations: number; claims: number }>>`
      SELECT hold.status,
        (SELECT count(*)::int FROM reservation
          WHERE id IN (${identities[0]!.reservationId}::uuid, ${identities[1]!.reservationId}::uuid)) AS reservations,
        (SELECT count(*)::int FROM space_occupancy
          WHERE slot_ref IN (${identities[0]!.segmentId}::uuid, ${identities[1]!.segmentId}::uuid)) AS claims
      FROM hold WHERE id = ${hold.id}::uuid
    `)[0];
    expect(final).toEqual({ status: "consumed", reservations: 1, claims: 1 });
  }, 30_000);
});
