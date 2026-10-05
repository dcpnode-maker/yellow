import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  ReservationGuestConflictError,
  ReservationGuestNotFoundError,
  ReservationGuestService,
  ReservationGuestValidationError,
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

const DATABASE_URL = process.env.YELLOW_RESERVATION_GUESTS_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESERVATION_GUESTS === "1";

const TENANT_A = "00000000-0000-0000-0000-000000009501";
const TENANT_B = "00000000-0000-0000-0000-000000009502";
const PROPERTY_A = "00000000-0000-0000-0000-000000009511";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000009512";
const PROPERTY_B = "00000000-0000-0000-0000-000000009513";
const ACTOR_A = "00000000-0000-0000-0000-000000009521";
const PRIMARY_A = "00000000-0000-0000-0000-000000009531";
const GUEST_A1 = "00000000-0000-0000-0000-000000009532";
const GUEST_A2 = "00000000-0000-0000-0000-000000009533";
const GUEST_A3 = "00000000-0000-0000-0000-000000009534";
const INACTIVE_A = "00000000-0000-0000-0000-000000009535";
const PRIMARY_B = "00000000-0000-0000-0000-000000009536";
const GUEST_B = "00000000-0000-0000-0000-000000009537";
const RESERVATION_A = "00000000-0000-0000-0000-000000009541";
const RESERVATION_EMPTY = "00000000-0000-0000-0000-000000009542";
const RESERVATION_DUPLICATE_PRIMARY = "00000000-0000-0000-0000-000000009543";
const RESERVATION_TERMINAL = "00000000-0000-0000-0000-000000009544";
const RESERVATION_B = "00000000-0000-0000-0000-000000009545";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RESERVATION_GUESTS_URL is required by the Order 095 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let guests: ReservationGuestService | undefined;

function envelope(
  propertyNode = PROPERTY_A,
  tenantId = TENANT_A,
  requestId = crypto.randomUUID(),
) {
  return createAuditEnvelope({
    operation: "reservation.modified",
    actorId: ACTOR_A,
    tenantId,
    propertyNode,
    requestId,
  });
}

function serviceFor(bus: EventBus): ReservationGuestService {
  return new ReservationGuestService({ events: bus, idempotency: new PostgresIdempotency() });
}

async function replace(
  service: ReservationGuestService,
  input: Parameters<ReservationGuestService["replace"]>[1],
) {
  return database!.withTenantTransaction(input.envelope.tenantId, (tx) => service.replace(tx, input));
}

async function allocation(reservationId = RESERVATION_A) {
  return admin!<Array<{ party_id: string; role: string; share_pct: string | null }>>`
    SELECT party_id, role, share_pct::text
    FROM reservation_guest
    WHERE reservation_id = ${reservationId}::uuid
    ORDER BY CASE role WHEN 'primary' THEN 0 ELSE 1 END, party_id
  `;
}

async function evidence(reservationId = RESERVATION_A) {
  const rows = await admin!<Array<{ facts: number; events: number; idempotency: number }>>`
    SELECT
      (SELECT count(*)::int FROM fact_log
       WHERE entity_type = 'reservation' AND entity_id = ${reservationId}::uuid
         AND fact_type = 'reservation.modified') AS facts,
      (SELECT count(*)::int FROM outbox
       WHERE aggregate_type = 'reservation' AND aggregate_id = ${reservationId}::uuid
         AND event_type = 'reservation.modified') AS events,
      (SELECT count(*)::int FROM api_idempotency
       WHERE tenant_id = ${TENANT_A}::uuid AND operation = 'reservation.guests.replace') AS idempotency
  `;
  return rows[0]!;
}

async function cleanup(): Promise<void> {
  if (!admin) return;
  await admin`DELETE FROM api_idempotency WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM outbox WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM fact_log WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM reservation_guest WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM reservation WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM app_user WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM party WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM org_node WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
}

class FailingEventBus implements EventBus {
  constructor(readonly delegate: EventBus) {}

  publish(_tx: Tx, _event: PublishEventInput): Promise<OutboxEvent> {
    throw new Error("Order 095 injected reservation.modified publication failure");
  }

  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 20 });
  eventPool = new SQL(DATABASE_URL, { max: 24 });
  database = Database.connect(DATABASE_URL, { maxConnections: 32 });
  events = new PostgresEventBus(eventPool);
  guests = serviceFor(events);
  await cleanup();

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order095-a', 'Order 095 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order095-b', 'Order 095 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order095_a', 'property', 'Order 095 A', 'UTC', 'USD'),
      (${PROPERTY_A2}::uuid, ${TENANT_A}::uuid, 'order095_a2', 'property', 'Order 095 A2', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order095_b', 'property', 'Order 095 B', 'UTC', 'EUR')
  `;
  await admin`
    INSERT INTO app_user (id, tenant_id, email, display_name)
    VALUES (${ACTOR_A}::uuid, ${TENANT_A}::uuid, 'order095@yellow.test', 'Order 095 Actor')
  `;
  await admin`
    INSERT INTO party (id, tenant_id, kind, display_name, status)
    VALUES
      (${PRIMARY_A}::uuid, ${TENANT_A}::uuid, 'person', 'Primary A', 'active'),
      (${GUEST_A1}::uuid, ${TENANT_A}::uuid, 'person', 'Guest A1', 'active'),
      (${GUEST_A2}::uuid, ${TENANT_A}::uuid, 'person', 'Guest A2', 'active'),
      (${GUEST_A3}::uuid, ${TENANT_A}::uuid, 'person', 'Guest A3', 'active'),
      (${INACTIVE_A}::uuid, ${TENANT_A}::uuid, 'person', 'Inactive A', 'anonymised'),
      (${PRIMARY_B}::uuid, ${TENANT_B}::uuid, 'person', 'Primary B', 'active'),
      (${GUEST_B}::uuid, ${TENANT_B}::uuid, 'person', 'Guest B', 'active')
  `;
  await admin`
    INSERT INTO reservation (
      id, tenant_id, property_node, confirmation_no, status, primary_party, channel_code, currency
    ) VALUES
      (${RESERVATION_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O95-A', 'reserved', ${PRIMARY_A}::uuid, 'direct', 'USD'),
      (${RESERVATION_EMPTY}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O95-EMPTY', 'reserved', ${PRIMARY_A}::uuid, 'direct', 'USD'),
      (${RESERVATION_DUPLICATE_PRIMARY}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O95-DUP', 'reserved', ${PRIMARY_A}::uuid, 'direct', 'USD'),
      (${RESERVATION_TERMINAL}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O95-END', 'cancelled', ${PRIMARY_A}::uuid, 'direct', 'USD'),
      (${RESERVATION_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O95-B', 'reserved', ${PRIMARY_B}::uuid, 'direct', 'EUR')
  `;
  await admin`
    INSERT INTO reservation_guest (tenant_id, reservation_id, party_id, role, share_pct)
    VALUES
      (${TENANT_A}::uuid, ${RESERVATION_A}::uuid, ${PRIMARY_A}::uuid, 'primary', NULL),
      (${TENANT_A}::uuid, ${RESERVATION_DUPLICATE_PRIMARY}::uuid, ${PRIMARY_A}::uuid, 'primary', NULL),
      (${TENANT_A}::uuid, ${RESERVATION_DUPLICATE_PRIMARY}::uuid, ${GUEST_A3}::uuid, 'primary', NULL),
      (${TENANT_A}::uuid, ${RESERVATION_TERMINAL}::uuid, ${PRIMARY_A}::uuid, 'primary', NULL),
      (${TENANT_B}::uuid, ${RESERVATION_B}::uuid, ${PRIMARY_B}::uuid, 'primary', NULL)
  `;
});

afterAll(async () => {
  await cleanup();
  await database?.close();
  await eventPool?.close();
  await admin?.close();
}, 30_000);

databaseDescribe("Order 095 atomic reservation guest/share allocation", () => {
  test("P1: exact replacement preserves primary and records deterministic complete shares", async () => {
    const firstEnvelope = envelope();
    const first = await replace(guests!, {
      reservationId: RESERVATION_A,
      primarySharePct: "40.00",
      guests: [
        { partyId: GUEST_A2, role: "accompanying", sharePct: null },
        { partyId: GUEST_A1, role: "sharer", sharePct: "60.00" },
      ],
      idempotencyKey: "order095-first-allocation",
      envelope: firstEnvelope,
    });
    expect(first.guests).toEqual([
      { partyId: PRIMARY_A, role: "primary", sharePct: "40.00" },
      { partyId: GUEST_A1, role: "sharer", sharePct: "60.00" },
      { partyId: GUEST_A2, role: "accompanying", sharePct: null },
    ]);
    expect(first.replayed).toBe(false);
    expect(first.changed).toBe(true);

    const replay = await replace(guests!, {
      reservationId: RESERVATION_A,
      primarySharePct: "40.00",
      guests: [
        { partyId: GUEST_A2, role: "accompanying", sharePct: null },
        { partyId: GUEST_A1, role: "sharer", sharePct: "60.00" },
      ],
      idempotencyKey: "order095-first-allocation",
      envelope: firstEnvelope,
    });
    expect(replay).toEqual({ ...first, replayed: true });

    const second = await replace(guests!, {
      reservationId: RESERVATION_A,
      primarySharePct: "55.50",
      guests: [
        { partyId: GUEST_A3, role: "sharer", sharePct: "44.50" },
        { partyId: GUEST_A2, role: "accompanying", sharePct: null },
      ],
      idempotencyKey: "order095-second-allocation",
      envelope: envelope(),
    });
    expect(second.guests).toEqual([
      { partyId: PRIMARY_A, role: "primary", sharePct: "55.50" },
      { partyId: GUEST_A2, role: "accompanying", sharePct: null },
      { partyId: GUEST_A3, role: "sharer", sharePct: "44.50" },
    ]);
    expect(await allocation()).toEqual([
      { party_id: PRIMARY_A, role: "primary", share_pct: "55.50" },
      { party_id: GUEST_A2, role: "accompanying", share_pct: null },
      { party_id: GUEST_A3, role: "sharer", share_pct: "44.50" },
    ]);
    expect(await evidence()).toEqual({ facts: 2, events: 2, idempotency: 2 });
  });

  test("P2: no-op, changed replay and concurrent replacements stay complete", async () => {
    const before = await evidence();
    const noOpEnvelope = envelope();
    const noOp = await replace(guests!, {
      reservationId: RESERVATION_A,
      primarySharePct: "55.50",
      guests: [
        { partyId: GUEST_A2, role: "accompanying", sharePct: null },
        { partyId: GUEST_A3, role: "sharer", sharePct: "44.50" },
      ],
      idempotencyKey: "order095-exact-no-op",
      envelope: noOpEnvelope,
    });
    expect(noOp.changed).toBe(false);
    expect(await evidence()).toEqual({ ...before, idempotency: before.idempotency + 1 });
    await expect(replace(guests!, {
      reservationId: RESERVATION_A,
      primarySharePct: "50.00",
      guests: [{ partyId: GUEST_A3, role: "sharer", sharePct: "50.00" }],
      idempotencyKey: "order095-exact-no-op",
      envelope: noOpEnvelope,
    })).rejects.toBeInstanceOf(IdempotencyConflictError);

    const concurrent = await Promise.all(Array.from({ length: 20 }, (_, index) => {
      const primary = 20 + index;
      return replace(guests!, {
        reservationId: RESERVATION_A,
        primarySharePct: `${primary}.00`,
        guests: [{ partyId: GUEST_A1, role: "sharer", sharePct: `${100 - primary}.00` }],
        idempotencyKey: `order095-concurrent-${index}`,
        envelope: envelope(),
      });
    }));
    expect(concurrent.every((result) => result.changed && result.guests.length === 2)).toBe(true);
    const final = await allocation();
    expect(final).toHaveLength(2);
    expect(final[0]?.party_id).toBe(PRIMARY_A);
    expect(final[1]?.party_id).toBe(GUEST_A1);
    const total = Number(final[0]?.share_pct?.replace(".", "")) +
      Number(final[1]?.share_pct?.replace(".", ""));
    expect(total).toBe(10_000);
    const after = await evidence();
    expect(after.facts - before.facts).toBe(20);
    expect(after.events - before.events).toBe(20);
  });

  test("P3: share, party, status, primary, property and tenant boundaries fail closed", async () => {
    const before = await allocation();
    const evidenceBefore = await evidence();
    const base = {
      reservationId: RESERVATION_A,
      primarySharePct: null,
      guests: [] as const,
      idempotencyKey: "order095-invalid-base",
      envelope: envelope(),
    };
    const invalid: Array<{
      input: unknown;
      error: typeof ReservationGuestValidationError;
      preserveKey?: boolean;
    }> = [
      { input: { ...base, reservationId: "bad" }, error: ReservationGuestValidationError },
      {
        input: { ...base, idempotencyKey: "short" },
        error: ReservationGuestValidationError,
        preserveKey: true,
      },
      { input: { ...base, primarySharePct: "50.0", guests: [{ partyId: GUEST_A1, role: "sharer", sharePct: "50.00" }] }, error: ReservationGuestValidationError },
      { input: { ...base, primarySharePct: "50.00", guests: [{ partyId: GUEST_A1, role: "sharer", sharePct: "49.99" }] }, error: ReservationGuestValidationError },
      { input: { ...base, guests: [{ partyId: GUEST_A1, role: "accompanying", sharePct: "1.00" }] }, error: ReservationGuestValidationError },
      { input: { ...base, guests: [{ partyId: PRIMARY_A, role: "accompanying", sharePct: null }] }, error: ReservationGuestConflictError },
      { input: { ...base, guests: [{ partyId: GUEST_A1, role: "accompanying", sharePct: null }, { partyId: GUEST_A1, role: "accompanying", sharePct: null }] }, error: ReservationGuestValidationError },
      { input: { ...base, guests: [{ partyId: INACTIVE_A, role: "accompanying", sharePct: null }] }, error: ReservationGuestNotFoundError },
      { input: { ...base, guests: [{ partyId: GUEST_B, role: "accompanying", sharePct: null }] }, error: ReservationGuestNotFoundError },
      { input: { ...base, reservationId: RESERVATION_TERMINAL }, error: ReservationGuestConflictError },
      { input: { ...base, reservationId: RESERVATION_EMPTY }, error: ReservationGuestConflictError },
      { input: { ...base, reservationId: RESERVATION_DUPLICATE_PRIMARY }, error: ReservationGuestConflictError },
      { input: { ...base, envelope: envelope(PROPERTY_A2) }, error: ReservationGuestNotFoundError },
      { input: { ...base, reservationId: RESERVATION_B }, error: ReservationGuestNotFoundError },
    ];
    for (const [index, item] of invalid.entries()) {
      const hostile = item.input as typeof base;
      const input = item.preserveKey
        ? hostile
        : { ...hostile, idempotencyKey: `order095-invalid-${index}` };
      await expect(replace(guests!, input)).rejects.toBeInstanceOf(item.error);
      expect(await allocation()).toEqual(before);
    }
    expect(await evidence()).toEqual(evidenceBefore);
  });

  test("P4: final publication failure rolls all guest and evidence mutations back", async () => {
    const before = await allocation();
    const evidenceBefore = await evidence();
    const input = {
      reservationId: RESERVATION_A,
      primarySharePct: "70.00",
      guests: [{ partyId: GUEST_A2, role: "sharer" as const, sharePct: "30.00" }],
      idempotencyKey: "order095-publisher-rollback",
      envelope: envelope(),
    };
    await expect(replace(serviceFor(new FailingEventBus(events!)), input))
      .rejects.toThrow("Order 095 injected reservation.modified publication failure");
    expect(await allocation()).toEqual(before);
    expect(await evidence()).toEqual(evidenceBefore);

    const retried = await replace(guests!, input);
    expect(retried.changed).toBe(true);
    expect(retried.replayed).toBe(false);
    expect(await allocation()).toEqual([
      { party_id: PRIMARY_A, role: "primary", share_pct: "70.00" },
      { party_id: GUEST_A2, role: "sharer", share_pct: "30.00" },
    ]);
  });
});
