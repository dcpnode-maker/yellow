import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  HoldConflictError,
  HoldService,
  type PlaceCartHoldInput,
} from "../src/contexts/inventory";
import {
  ReservationCommitService,
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationValidationError,
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

const DATABASE_URL = process.env.YELLOW_RESERVATION_COMMIT_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESERVATION_COMMIT === "1";

const TENANT_A = "00000000-0000-0000-0000-000000008101";
const TENANT_B = "00000000-0000-0000-0000-000000008102";
const PROPERTY_A = "00000000-0000-0000-0000-000000008111";
const PROPERTY_B = "00000000-0000-0000-0000-000000008112";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000008113";
const ACTOR_A = "00000000-0000-0000-0000-000000008120";
const PARTY_A = "00000000-0000-0000-0000-000000008131";
const PARTY_MERGED = "00000000-0000-0000-0000-000000008132";
const PARTY_B = "00000000-0000-0000-0000-000000008133";
const GUARANTEE_A = "00000000-0000-0000-0000-000000008141";
const RATE_A = "00000000-0000-0000-0000-000000008151";
const RATE_INACTIVE = "00000000-0000-0000-0000-000000008152";
const RATE_B = "00000000-0000-0000-0000-000000008153";
const RATE_A2 = "00000000-0000-0000-0000-000000008154";
const UNIT_TYPE_A = "00000000-0000-0000-0000-000000008161";
const UNIT_TYPE_B = "00000000-0000-0000-0000-000000008162";
const SPACE_COMPOSITE_A = "00000000-0000-0000-0000-000000008171";
const SPACE_COMPOSITE_B = "00000000-0000-0000-0000-000000008172";
const SPACE_EXCLUSIVE = "00000000-0000-0000-0000-000000008173";
const SPACE_B = "00000000-0000-0000-0000-000000008174";
const SELLABLE_COMPOSITE = "00000000-0000-0000-0000-000000008181";
const SELLABLE_EXCLUSIVE = "00000000-0000-0000-0000-000000008182";
const SELLABLE_B = "00000000-0000-0000-0000-000000008183";
const MANUAL_HOLD = "00000000-0000-0000-0000-000000008191";
const NOCLAIM_HOLD = "00000000-0000-0000-0000-000000008192";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RESERVATION_COMMIT_URL is required by the Order 081 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let holds: HoldService | undefined;
let reservations: ReservationCommitService | undefined;

function stay(offset: number): Readonly<{ from: Date; to: Date }> {
  return Object.freeze({
    from: new Date(Date.UTC(2029, 0, 1 + offset, 14)),
    to: new Date(Date.UTC(2029, 0, 3 + offset, 10)),
  });
}

function envelope(
  operation: string,
  propertyNode = PROPERTY_A,
  tenantId = TENANT_A,
  requestId = crypto.randomUUID(),
) {
  return createAuditEnvelope({ actorId: ACTOR_A, tenantId, propertyNode, requestId, operation });
}

async function place(
  offset: number,
  sellableUnitId = SELLABLE_COMPOSITE,
  service = holds!,
): Promise<Awaited<ReturnType<HoldService["place"]>>> {
  const input: PlaceCartHoldInput = {
    sellableUnitId,
    ...stay(offset),
    ttlSeconds: 900,
    holder: { client_id: `order081-${offset}` },
    envelope: envelope("hold.created"),
  };
  return database!.withTenantTransaction(TENANT_A, (tx) => service.place(tx, input));
}

function commitInput(
  holdId: string,
  key: string,
  options: Readonly<{
    primaryPartyId?: string;
    ratePlanId?: string;
    propertyNode?: string;
    tenantId?: string;
    operation?: string;
    adults?: number;
    childAges?: readonly number[];
    channelCode?: string;
    requestId?: ReturnType<typeof crypto.randomUUID>;
  }> = {},
) {
  return {
    holdId,
    primaryPartyId: options.primaryPartyId ?? PARTY_A,
    ratePlanId: options.ratePlanId ?? RATE_A,
    adults: options.adults ?? 2,
    childAges: options.childAges ?? [6],
    channelCode: options.channelCode ?? "direct",
    idempotencyKey: key,
    envelope: envelope(
      options.operation ?? "reservation.confirmed",
      options.propertyNode ?? PROPERTY_A,
      options.tenantId ?? TENANT_A,
      options.requestId,
    ),
  };
}

function serviceFor(bus: EventBus, idFactory?: () => string): ReservationCommitService {
  return new ReservationCommitService({
    holds: new HoldService(bus),
    events: bus,
    idempotency: new PostgresIdempotency(),
    ...(idFactory ? { idFactory } : {}),
  });
}

async function commit(
  input: ReturnType<typeof commitInput>,
  service = reservations!,
) {
  return database!.withTenantTransaction(input.envelope.tenantId, (tx) => service.commitHeld(tx, input));
}

function deferred(): Readonly<{ promise: Promise<void>; resolve: () => void }> {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return Object.freeze({ promise, resolve });
}

class GatedEventBus implements EventBus {
  readonly entered = deferred();
  readonly release = deferred();

  constructor(readonly delegate: EventBus) {}

  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    if (event.eventType === "reservation.confirmed") {
      this.entered.resolve();
      await this.release.promise;
    }
    return this.delegate.publish(tx, event);
  }

  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

class FailAtEventBus implements EventBus {
  calls = 0;

  constructor(readonly delegate: EventBus, readonly failAt: number) {}

  publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    this.calls += 1;
    if (this.calls === this.failAt) throw new Error(`injected publication failure ${this.failAt}`);
    return this.delegate.publish(tx, event);
  }

  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

async function claimSnapshot(holdId: string, segmentId?: string) {
  const rows = await admin!<Array<{
    hold_status: string;
    hold_claims: number;
    segment_claims: number;
    reservations: number;
  }>>`
    SELECT
      (SELECT status FROM hold WHERE id = ${holdId}::uuid) AS hold_status,
      (SELECT count(*)::int FROM space_occupancy WHERE slot_ref = ${holdId}::uuid) AS hold_claims,
      (SELECT count(*)::int FROM space_occupancy
        WHERE slot_ref = ${segmentId ?? "00000000-0000-0000-0000-000000000000"}::uuid) AS segment_claims,
      (SELECT count(*)::int FROM reservation WHERE tenant_id = ${TENANT_A}::uuid) AS reservations
  `;
  const row = rows[0];
  if (!row) throw new Error("PostgreSQL returned no ownership snapshot");
  return row;
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 16 });
  eventPool = new SQL(DATABASE_URL, { max: 32 });
  database = Database.connect(DATABASE_URL, { maxConnections: 64 });
  events = new PostgresEventBus(eventPool);
  holds = new HoldService(events);
  reservations = serviceFor(events);

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order081-a', 'Order 081 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order081-b', 'Order 081 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order081_a', 'property', 'Order 081 A', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order081_b', 'property', 'Order 081 B', 'UTC', 'EUR'),
      (${PROPERTY_A2}::uuid, ${TENANT_A}::uuid, 'order081_a2', 'property', 'Order 081 A2', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO party (id, tenant_id, kind, display_name, status, merged_into)
    VALUES
      (${PARTY_A}::uuid, ${TENANT_A}::uuid, 'person', 'Order 081 Primary', 'active', NULL),
      (${PARTY_MERGED}::uuid, ${TENANT_A}::uuid, 'person', 'Order 081 Merged', 'merged', ${PARTY_A}::uuid),
      (${PARTY_B}::uuid, ${TENANT_B}::uuid, 'person', 'Order 081 Foreign', 'active', NULL)
  `;
  await admin`
    INSERT INTO policy (id, tenant_id, kind, name, content)
    VALUES (${GUARANTEE_A}::uuid, ${TENANT_A}::uuid, 'guarantee', 'Order 081 Guarantee', '{}'::jsonb)
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key)
    VALUES
      (${UNIT_TYPE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O81A', 'Order 081 A', 'hotel'),
      (${UNIT_TYPE_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O81B', 'Order 081 B', 'hotel')
  `;
  await admin`
    INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity)
    VALUES
      (${SPACE_COMPOSITE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O81-CA', 'hotel', 1),
      (${SPACE_COMPOSITE_B}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O81-CB', 'hotel', 1),
      (${SPACE_EXCLUSIVE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O81-EX', 'hotel', 1),
      (${SPACE_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O81-B', 'hotel', 1)
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name)
    VALUES
      (${SELLABLE_COMPOSITE}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE_A}::uuid, 'Order 081 Composite'),
      (${SELLABLE_EXCLUSIVE}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE_A}::uuid, 'Order 081 Exclusive'),
      (${SELLABLE_B}::uuid, ${TENANT_B}::uuid, ${UNIT_TYPE_B}::uuid, 'Order 081 Foreign')
  `;
  await admin`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    VALUES
      (${TENANT_A}::uuid, ${SELLABLE_COMPOSITE}::uuid, ${SPACE_COMPOSITE_A}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_COMPOSITE}::uuid, ${SPACE_COMPOSITE_B}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_EXCLUSIVE}::uuid, ${SPACE_EXCLUSIVE}::uuid, 'exclusive'),
      (${TENANT_B}::uuid, ${SELLABLE_B}::uuid, ${SPACE_B}::uuid, 'exclusive')
  `;
  await admin`
    INSERT INTO rate_plan (
      id, tenant_id, property_node, code, name, currency, guarantee_policy,
      market_code, source_code, status
    )
    VALUES
      (${RATE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O81A', 'Order 081 Active', 'USD',
        ${GUARANTEE_A}::uuid, 'LEIS', 'DIRECT', 'active'),
      (${RATE_INACTIVE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O81I', 'Order 081 Inactive', 'USD',
        NULL, NULL, NULL, 'inactive'),
      (${RATE_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O81B', 'Order 081 Foreign', 'EUR',
        NULL, NULL, NULL, 'active'),
      (${RATE_A2}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A2}::uuid, 'O81A2', 'Order 081 A2', 'USD',
        ${GUARANTEE_A}::uuid, NULL, NULL, 'active')
  `;
});

afterAll(async () => {
  await database?.close();
  await eventPool?.close();
  await admin?.close();
}, 30_000);

databaseDescribe("Order 081 atomic cart-hold reservation commit", () => {
  test("P1: composite hold becomes one exact reservation and exact retry replays", async () => {
    const hold = await place(0);
    const oldClaims = await admin!<Array<{ space_id: string; period: string; exclusive: boolean }>>`
      SELECT space_id, period::text, exclusive
      FROM space_occupancy WHERE slot_ref = ${hold.id}::uuid ORDER BY space_id
    `;
    const request = commitInput(hold.id, "order081-exact-replay");
    const created = await commit(request);
    expect(created.replayed).toBe(false);
    expect(created).toMatchObject({
      holdId: hold.id,
      status: "reserved",
      propertyNode: PROPERTY_A,
      primaryPartyId: PARTY_A,
      sellableUnitId: SELLABLE_COMPOSITE,
      unitTypeId: UNIT_TYPE_A,
      ratePlanId: RATE_A,
      adults: 2,
      childAges: [6],
      channelCode: "direct",
      currency: "USD",
      guaranteePolicyId: GUARANTEE_A,
      from: stay(0).from.toISOString(),
      to: stay(0).to.toISOString(),
    });
    expect(created.confirmationNo).toBe(`Y-${created.reservationId.replaceAll("-", "").toUpperCase()}`);

    const replayed = await commit({ ...request, envelope: envelope("reservation.confirmed") });
    expect(replayed).toEqual({ ...created, replayed: true });
    await expect(commit({ ...request, adults: 3, envelope: envelope("reservation.confirmed") }))
      .rejects.toBeInstanceOf(IdempotencyConflictError);

    const newClaims = await admin!<Array<{ space_id: string; period: string; exclusive: boolean }>>`
      SELECT space_id, period::text, exclusive
      FROM space_occupancy WHERE slot_ref = ${created.segmentId}::uuid ORDER BY space_id
    `;
    expect(newClaims).toEqual(oldClaims);
    expect(await claimSnapshot(hold.id, created.segmentId)).toMatchObject({
      hold_status: "consumed",
      hold_claims: 0,
      segment_claims: 2,
    });
    const domain = await admin!<Array<{
      reservation_status: string;
      segment_status: string;
      guest_role: string;
      children: unknown;
      reservation_facts: number;
      event_types: string[];
      idempotency_claims: number;
    }>>`
      SELECT
        reservation.status AS reservation_status,
        segment.status AS segment_status,
        guest.role AS guest_role,
        segment.children,
        (SELECT count(*)::int FROM fact_log
          WHERE entity_type = 'reservation' AND entity_id = reservation.id) AS reservation_facts,
        (SELECT array_agg(event_type ORDER BY seq) FROM outbox
          WHERE correlation_id = ${request.envelope.requestId}::uuid) AS event_types,
        (SELECT count(*)::int FROM api_idempotency
          WHERE tenant_id = ${TENANT_A}::uuid AND operation = 'reservation.commit.held') AS idempotency_claims
      FROM reservation
      JOIN reservation_segment AS segment ON segment.reservation_id = reservation.id
      JOIN reservation_guest AS guest ON guest.reservation_id = reservation.id
      WHERE reservation.id = ${created.reservationId}::uuid
    `;
    expect(domain).toEqual([{
      reservation_status: "reserved",
      segment_status: "booked",
      guest_role: "primary",
      children: [{ age: 6 }],
      reservation_facts: 1,
      event_types: [
        "hold.consumed",
        "occupancy.released",
        "occupancy.released",
        "occupancy.recorded",
        "occupancy.recorded",
        "reservation.confirmed",
      ],
      idempotency_claims: 1,
    }]);
  }, 30_000);

  test("P2: transfer stays exclusive while open and one hold has one concurrent winner", async () => {
    const held = await place(10, SELLABLE_EXCLUSIVE);
    const gate = new GatedEventBus(events!);
    const gatedCommit = commit(commitInput(held.id, "order081-gated-transfer"), serviceFor(gate));
    await gate.entered.promise;

    let contenderSettled = false;
    const contender = place(10, SELLABLE_EXCLUSIVE).finally(() => { contenderSettled = true; });
    await Bun.sleep(100);
    expect(contenderSettled).toBe(false);
    gate.release.resolve();
    const winner = await gatedCommit;
    await expect(contender).rejects.toBeInstanceOf(HoldConflictError);
    expect(await claimSnapshot(held.id, winner.segmentId)).toMatchObject({
      hold_status: "consumed",
      hold_claims: 0,
      segment_claims: 1,
    });

    const racedHold = await place(20, SELLABLE_EXCLUSIVE);
    const attempts = await Promise.allSettled(Array.from({ length: 20 }, (_, index) =>
      commit(commitInput(racedHold.id, `order081-race-key-${index}`))
    ));
    const winners = attempts.filter((result) => result.status === "fulfilled");
    const losers = attempts.filter((result) => result.status === "rejected");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(19);
    for (const loser of losers) {
      if (loser.status === "rejected") expect(loser.reason).toBeInstanceOf(ReservationConflictError);
    }
    const result = winners[0];
    if (!result || result.status !== "fulfilled") throw new Error("hold race returned no winner");
    const residue = await admin!<Array<{ reservations: number; claims: number; claims_for_hold: number; keys: number }>>`
      SELECT
        (SELECT count(*)::int FROM reservation_segment WHERE id = ${result.value.segmentId}::uuid) AS reservations,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref = ${result.value.segmentId}::uuid) AS claims,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref = ${racedHold.id}::uuid) AS claims_for_hold,
        (SELECT count(*)::int FROM api_idempotency
          WHERE tenant_id = ${TENANT_A}::uuid AND operation = 'reservation.commit.held'
            AND response_body->>'holdId' = ${racedHold.id}) AS keys
    `;
    expect(residue).toEqual([{ reservations: 1, claims: 1, claims_for_hold: 0, keys: 1 }]);
  }, 30_000);

  test("P3: every publication failure restores the original hold and exact retry", async () => {
    for (let failAt = 1; failAt <= 6; failAt += 1) {
      const held = await place(100 + (failAt * 3));
      const before = await claimSnapshot(held.id);
      const claims = await admin!<Array<{ space_id: string; period: string; claim: string }>>`
        SELECT space_id, period::text, claim::text
        FROM space_occupancy WHERE slot_ref = ${held.id}::uuid ORDER BY space_id
      `;
      const requestId = crypto.randomUUID();
      const input = commitInput(held.id, `order081-publisher-${failAt}`, { requestId });
      const failingBus = new FailAtEventBus(events!, failAt);
      await expect(commit(input, serviceFor(failingBus))).rejects.toThrow(`injected publication failure ${failAt}`);
      expect(failingBus.calls).toBe(failAt);
      const after = await claimSnapshot(held.id);
      expect(after).toEqual(before);
      const restored = await admin!<Array<{ space_id: string; period: string; claim: string }>>`
        SELECT space_id, period::text, claim::text
        FROM space_occupancy WHERE slot_ref = ${held.id}::uuid ORDER BY space_id
      `;
      expect(restored).toEqual(claims);
      const artifacts = await admin!<Array<{ facts: number; events: number; keys: number }>>`
        SELECT
          (SELECT count(*)::int FROM fact_log WHERE payload @> ${JSON.stringify({ request_id: requestId })}::text::jsonb) AS facts,
          (SELECT count(*)::int FROM outbox WHERE correlation_id = ${requestId}::uuid) AS events,
          (SELECT count(*)::int FROM api_idempotency
            WHERE tenant_id = ${TENANT_A}::uuid AND operation = 'reservation.commit.held'
              AND response_body->>'holdId' = ${held.id}) AS keys
      `;
      expect(artifacts).toEqual([{ facts: 0, events: 0, keys: 0 }]);
      const retried = await commit({ ...input, envelope: envelope("reservation.confirmed") });
      expect(retried.replayed).toBe(false);
      expect((await claimSnapshot(held.id, retried.segmentId)).hold_status).toBe("consumed");
    }
  }, 30_000);

  test("P4: hold kind, lifecycle, tenant, property and references fail closed", async () => {
    const rejected: Array<() => Promise<unknown>> = [];

    const expired = await place(200);
    await admin!`UPDATE hold SET expires_at = transaction_timestamp() - interval '1 second' WHERE id = ${expired.id}::uuid`;
    rejected.push(() => commit(commitInput(expired.id, "order081-expired")));

    const released = await place(203);
    await database!.withTenantTransaction(TENANT_A, (tx) => holds!.release(tx, {
      holdId: released.id,
      envelope: envelope("hold.released"),
    }));
    rejected.push(() => commit(commitInput(released.id, "order081-released")));

    const consumed = await place(206);
    await commit(commitInput(consumed.id, "order081-consumed-first"));
    rejected.push(() => commit(commitInput(consumed.id, "order081-consumed-second")));

    rejected.push(() => commit(commitInput("00000000-0000-0000-0000-000000008199", "order081-missing")));

    const wrongProperty = await place(209);
    rejected.push(() => commit(commitInput(wrongProperty.id, "order081-property", {
      propertyNode: PROPERTY_A2,
      ratePlanId: RATE_A2,
    })));

    const wrongTenant = await place(212);
    rejected.push(() => commit(commitInput(wrongTenant.id, "order081-tenant", {
      tenantId: TENANT_B,
      propertyNode: PROPERTY_B,
      primaryPartyId: PARTY_B,
      ratePlanId: RATE_B,
    })));

    const offline = await database!.withTenantTransaction(TENANT_A, (tx) => holds!.placeOfflineLease(tx, {
      sellableUnitId: SELLABLE_COMPOSITE,
      ...stay(215),
      ttlSeconds: 3_600,
      deviceId: "order081-device",
      envelope: envelope("hold.created"),
    }));
    rejected.push(() => commit(commitInput(offline.id, "order081-offline")));

    await admin!`
      INSERT INTO hold (id, tenant_id, property_node, sellable_unit_id, period, kind, holder, expires_at)
      VALUES (${MANUAL_HOLD}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, ${SELLABLE_EXCLUSIVE}::uuid,
        tstzrange(${stay(218).from.toISOString()}::timestamptz, ${stay(218).to.toISOString()}::timestamptz, '[)'),
        'manual', '{}'::jsonb, transaction_timestamp() + interval '1 hour')
    `;
    await admin!`SELECT record_occupancy(${TENANT_A}::uuid, ${SPACE_EXCLUSIVE}::uuid,
      tstzrange(${stay(218).from.toISOString()}::timestamptz, ${stay(218).to.toISOString()}::timestamptz, '[)'),
      ${MANUAL_HOLD}::uuid, 'hold', true)`;
    rejected.push(() => commit(commitInput(MANUAL_HOLD, "order081-manual")));

    await admin!`
      INSERT INTO hold (id, tenant_id, property_node, sellable_unit_id, period, kind, holder, expires_at)
      VALUES (${NOCLAIM_HOLD}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, ${SELLABLE_EXCLUSIVE}::uuid,
        tstzrange(${stay(219).from.toISOString()}::timestamptz, ${stay(219).to.toISOString()}::timestamptz, '[)'),
        'cart', '{}'::jsonb, transaction_timestamp() + interval '1 hour')
    `;
    rejected.push(() => commit(commitInput(NOCLAIM_HOLD, "order081-no-claim")));

    const mergedParty = await place(221);
    rejected.push(() => commit(commitInput(mergedParty.id, "order081-merged-party", { primaryPartyId: PARTY_MERGED })));
    const foreignParty = await place(224);
    rejected.push(() => commit(commitInput(foreignParty.id, "order081-foreign-party", { primaryPartyId: PARTY_B })));
    const inactiveRate = await place(227);
    rejected.push(() => commit(commitInput(inactiveRate.id, "order081-inactive-rate", { ratePlanId: RATE_INACTIVE })));
    const foreignRate = await place(230);
    rejected.push(() => commit(commitInput(foreignRate.id, "order081-foreign-rate", { ratePlanId: RATE_B })));
    const missingParty = await place(233);
    rejected.push(() => commit(commitInput(missingParty.id, "order081-missing-party", {
      primaryPartyId: "00000000-0000-0000-0000-000000008139",
    })));
    const missingRate = await place(236);
    rejected.push(() => commit(commitInput(missingRate.id, "order081-missing-rate", {
      ratePlanId: "00000000-0000-0000-0000-000000008159",
    })));

    const results = await Promise.allSettled(rejected.map((attempt) => attempt()));
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    for (const result of results) {
      if (result.status !== "rejected") continue;
      expect(
        result.reason instanceof ReservationConflictError || result.reason instanceof ReservationNotFoundError,
      ).toBe(true);
    }
    expect((await claimSnapshot(expired.id)).hold_claims).toBe(2);
    expect((await claimSnapshot(wrongProperty.id)).hold_status).toBe("active");
    expect((await claimSnapshot(mergedParty.id)).hold_status).toBe("active");
    expect((await claimSnapshot(inactiveRate.id)).hold_status).toBe("active");
  }, 30_000);

  test("P4: hostile values and generated identities leave a valid hold retryable", async () => {
    const held = await place(300);
    const invalid = [
      commitInput("not-a-uuid", "order081-invalid-hold"),
      commitInput(held.id, "order081-invalid-party", { primaryPartyId: "not-a-uuid" }),
      commitInput(held.id, "order081-invalid-rate", { ratePlanId: "not-a-uuid" }),
      commitInput(held.id, "short"),
      commitInput(held.id, "order081-invalid-adults", { adults: 0 }),
      commitInput(held.id, "order081-invalid-child", { childAges: [18] }),
      commitInput(held.id, "order081-invalid-channel", { channelCode: "Direct SQL" }),
      commitInput(held.id, "order081-invalid-operation", { operation: "reservation.modified" }),
    ];
    for (const input of invalid) {
      await expect(commit(input)).rejects.toBeInstanceOf(ReservationValidationError);
    }
    await expect(commit(commitInput(held.id, "order081-invalid-generated"), serviceFor(events!, () => "bad-id")))
      .rejects.toBeInstanceOf(ReservationValidationError);
    expect(await claimSnapshot(held.id)).toMatchObject({ hold_status: "active", hold_claims: 2 });
    const recovered = await commit(commitInput(held.id, "order081-valid-after-invalid"));
    expect(recovered.status).toBe("reserved");
  }, 30_000);
});
