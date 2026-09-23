import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { ReservationOccupancyService } from "../src/contexts/inventory";
import {
  ReservationLifecycleConflictError,
  ReservationLifecycleNotFoundError,
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

const domain = Bun.file(new URL("../src/contexts/reservations/segments.ts", import.meta.url));
const migration = Bun.file(new URL(
  "../migrations/0033_governed_due_in_room_assignment.sql",
  import.meta.url,
));

describe("Order 231 governed due-in room assignment domain", () => {
  test("candidate admission reuses authoritative availability and excludes non-room mappings", async () => {
    const source = await domain.text();
    expect(source).toContain("this.#availability.search(tx,");
    expect(source).toContain("option.availableCount > 0 && option.bookable");
    expect(source).toContain("bool_and(mapping.claim_mode = 'exclusive')");
    expect(source).toContain("HAVING count(*) = 1");
    expect(source).toContain("expectedSellableUnitId: null");
  });

  test("assignment establishes the typed parent before the occupancy choke point", async () => {
    const source = await domain.text();
    const method = source.slice(source.indexOf("async assignDueInRoom("));
    const capability = method.indexOf("FROM public.assign_due_in_room(");
    const claim = method.indexOf("this.#occupancy.claimForSegment(");
    const fact = method.indexOf("recordFact(commandTx,");
    const publication = method.indexOf("this.#events.publish(commandTx,");
    expect(capability).toBeGreaterThan(0);
    expect(claim).toBeGreaterThan(capability);
    expect(fact).toBeGreaterThan(claim);
    expect(publication).toBeGreaterThan(fact);
    expect(method).toContain('operation: "reservation.segment.assign_due_in_room"');
    expect(method).toContain("expectedReservationStatus: input.expectedReservationStatus");
    expect(method).toContain("expectedSegmentStatus: input.expectedSegmentStatus");
  });

  test("owner capability is caller-contained, tenant-bound and assignment-only", async () => {
    const source = await migration.text();
    expect(source).toContain("CREATE FUNCTION public.assign_due_in_room(");
    expect(source).toContain("session_user <> 'yellow_runtime'");
    expect(source).toContain("current_user <> 'yellow_owner'");
    expect(source).toContain("current_setting('role', true) IS DISTINCT FROM 'app_role'");
    expect(source).toContain("pg_advisory_xact_lock(");
    expect(source).toContain("UPDATE public.reservation_segment AS segment");
    expect(source).not.toContain("INSERT INTO public.space_occupancy");
    expect(source).toContain("GRANT EXECUTE ON FUNCTION public.assign_due_in_room(");
  });
});

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_DUE_IN_ROOM_ASSIGNMENT === "1";
if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error("Order 231 database proof requires deploy and runtime database URLs");
}
const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000023101";
const PROPERTY = "00000000-0000-0000-0000-000000023111";
const ACTOR = "00000000-0000-0000-0000-000000023121";
const INACTIVE_ACTOR = "00000000-0000-0000-0000-000000023122";
const PARTY = "00000000-0000-0000-0000-000000023131";
const RATE = "00000000-0000-0000-0000-000000023141";
const UNIT_TYPE = "00000000-0000-0000-0000-000000023151";
const OTHER_TYPE = "00000000-0000-0000-0000-000000023152";
const SPACES = {
  a: "00000000-0000-0000-0000-000000023161",
  b: "00000000-0000-0000-0000-000000023162",
  c: "00000000-0000-0000-0000-000000023163",
  d: "00000000-0000-0000-0000-000000023164",
  compositeA: "00000000-0000-0000-0000-000000023165",
  compositeB: "00000000-0000-0000-0000-000000023166",
  positional: "00000000-0000-0000-0000-000000023167",
  wrongType: "00000000-0000-0000-0000-000000023168",
} as const;
const SELLABLES = {
  a: "00000000-0000-0000-0000-000000023171",
  b: "00000000-0000-0000-0000-000000023172",
  c: "00000000-0000-0000-0000-000000023173",
  d: "00000000-0000-0000-0000-000000023174",
  composite: "00000000-0000-0000-0000-000000023175",
  positional: "00000000-0000-0000-0000-000000023176",
  wrongType: "00000000-0000-0000-0000-000000023177",
} as const;

let admin: SQL | undefined;
let runtimePool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;

function stay(): Readonly<{ from: Date; to: Date }> {
  const now = Date.now();
  return Object.freeze({
    from: new Date(now - 60 * 60 * 1_000),
    to: new Date(now + 47 * 60 * 60 * 1_000),
  });
}

function expectedPeriod(period: Readonly<{ from: Date; to: Date }>): ExpectedSegmentPeriod {
  return Object.freeze({ from: period.from.toISOString(), to: period.to.toISOString() });
}

function envelope(actorId = ACTOR, requestId = crypto.randomUUID()) {
  return createAuditEnvelope({
    operation: "reservation.modified",
    actorId,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    requestId,
  });
}

function service(bus: EventBus = events!): ReservationSegmentService {
  return new ReservationSegmentService({
    events: bus,
    occupancy: new ReservationOccupancyService(bus),
    idempotency: new PostgresIdempotency(),
  });
}

interface ArrivalFixture {
  readonly reservationId: string;
  readonly segmentId: string;
  readonly period: Readonly<{ from: Date; to: Date }>;
}

async function createArrival(sellableUnitId: string | null = null): Promise<ArrivalFixture> {
  const reservationId = crypto.randomUUID();
  const segmentId = crypto.randomUUID();
  const period = stay();
  await admin!`
    INSERT INTO reservation (
      id, tenant_id, property_node, confirmation_no, status,
      primary_party, channel_code, currency
    ) VALUES (
      ${reservationId}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid,
      ${`O231-${reservationId}`}, 'due_in', ${PARTY}::uuid, 'direct', 'USD'
    )
  `;
  await admin!`
    INSERT INTO reservation_segment (
      id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id,
      period, adults, children, rate_plan_id, status
    ) VALUES (
      ${segmentId}::uuid, ${TENANT}::uuid, ${reservationId}::uuid, 1,
      ${UNIT_TYPE}::uuid, ${sellableUnitId}::uuid,
      tstzrange(${period.from.toISOString()}::timestamptz, ${period.to.toISOString()}::timestamptz, '[)'),
      2, '[{"age":7}]'::jsonb, ${RATE}::uuid, 'booked'
    )
  `;
  return Object.freeze({ reservationId, segmentId, period });
}

function assignmentInput(
  fixture: ArrivalFixture,
  sellableUnitId: string,
  key: string,
  actorId = ACTOR,
  requestId = crypto.randomUUID(),
) {
  return Object.freeze({
    reservationId: fixture.reservationId,
    segmentId: fixture.segmentId,
    expectedReservationStatus: "due_in" as const,
    expectedSegmentStatus: "booked" as const,
    expectedUnitTypeId: UNIT_TYPE,
    expectedSellableUnitId: null,
    expectedPeriod: expectedPeriod(fixture.period),
    sellableUnitId,
    idempotencyKey: key,
    envelope: envelope(actorId, requestId),
  });
}

async function assign(
  target: ReservationSegmentService,
  input: Parameters<ReservationSegmentService["assignDueInRoom"]>[1],
) {
  return database!.withTenantTransaction(TENANT, (tx) => target.assignDueInRoom(tx, input));
}

async function release(segmentId: string): Promise<void> {
  await admin!`SELECT public.release_occupancy(${TENANT}::uuid, ${segmentId}::uuid)`;
}

async function idempotencyCount(key: string): Promise<number> {
  const keyHash = new Bun.CryptoHasher("sha256").update(key).digest("hex");
  return database!.withTenantTransaction(TENANT, async (tx) => {
    const rows = await tx<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM api_idempotency
      WHERE tenant_id=${TENANT}::uuid
        AND operation='reservation.segment.assign_due_in_room'
        AND key_hash=${keyHash}
    `;
    return Number(rows[0]?.count ?? 0);
  });
}

function sqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const record = error as Record<string, unknown>;
  for (const key of ["errno", "code", "sqlState"]) {
    if (typeof record[key] === "string") return record[key];
  }
  return undefined;
}

class FailFirstPublish implements EventBus {
  calls = 0;
  constructor(readonly delegate: EventBus) {}
  publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    this.calls += 1;
    if (this.calls === 1) throw new Error("Order 231 injected publication failure");
    return this.delegate.publish(tx, event);
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

beforeAll(async () => {
  if (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL) return;
  admin = new SQL(DEPLOY_DATABASE_URL, { max: 4 });
  runtimePool = new SQL(RUNTIME_DATABASE_URL, { max: 4 });
  database = Database.connect(RUNTIME_DATABASE_URL, { maxConnections: 24 });
  events = new PostgresEventBus(runtimePool);

  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES(
    ${TENANT}::uuid, ${`order231-${crypto.randomUUID()}`}, 'Order 231', 'shared', 'active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES(
    ${PROPERTY}::uuid,${TENANT}::uuid,'order231','property','Order 231','UTC','USD')`;
  await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR}::uuid,${TENANT}::uuid,${`order231-${crypto.randomUUID()}@yellow.test`},'Order 231 Actor','active'),
    (${INACTIVE_ACTOR}::uuid,${TENANT}::uuid,${`order231-inactive-${crypto.randomUUID()}@yellow.test`},'Inactive','disabled')`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(
    ${PARTY}::uuid,${TENANT}::uuid,'person','Order 231 Guest','active')`;
  await admin`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,status) VALUES(
    ${RATE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O231BAR','Order 231 BAR','USD','active')`;
  await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES
    (${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O231','Order 231 Room','hotel',4),
    (${OTHER_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O231X','Wrong Type','hotel',4)`;
  await admin`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,floor,status) VALUES
    (${SPACES.a}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'231-A','hotel',1,'1','active'),
    (${SPACES.b}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'231-B','hotel',1,'1','active'),
    (${SPACES.c}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'231-C','hotel',1,'2','active'),
    (${SPACES.d}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'231-D','hotel',1,'2','active'),
    (${SPACES.compositeA}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'231-CA','hotel',1,NULL,'active'),
    (${SPACES.compositeB}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'231-CB','hotel',1,NULL,'active'),
    (${SPACES.positional}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'231-P','hotel',2,NULL,'active'),
    (${SPACES.wrongType}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'231-X','hotel',1,NULL,'active')`;
  await admin`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES
    (${SELLABLES.a}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,'Room 231-A','active'),
    (${SELLABLES.b}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,'Room 231-B','active'),
    (${SELLABLES.c}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,'Room 231-C','active'),
    (${SELLABLES.d}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,'Room 231-D','active'),
    (${SELLABLES.composite}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,'Composite 231','active'),
    (${SELLABLES.positional}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,'Bed 231','active'),
    (${SELLABLES.wrongType}::uuid,${TENANT}::uuid,${OTHER_TYPE}::uuid,'Wrong Type 231','active')`;
  await admin`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode) VALUES
    (${TENANT}::uuid,${SELLABLES.a}::uuid,${SPACES.a}::uuid,'exclusive'),
    (${TENANT}::uuid,${SELLABLES.b}::uuid,${SPACES.b}::uuid,'exclusive'),
    (${TENANT}::uuid,${SELLABLES.c}::uuid,${SPACES.c}::uuid,'exclusive'),
    (${TENANT}::uuid,${SELLABLES.d}::uuid,${SPACES.d}::uuid,'exclusive'),
    (${TENANT}::uuid,${SELLABLES.composite}::uuid,${SPACES.compositeA}::uuid,'exclusive'),
    (${TENANT}::uuid,${SELLABLES.composite}::uuid,${SPACES.compositeB}::uuid,'exclusive'),
    (${TENANT}::uuid,${SELLABLES.positional}::uuid,${SPACES.positional}::uuid,'positional'),
    (${TENANT}::uuid,${SELLABLES.wrongType}::uuid,${SPACES.wrongType}::uuid,'exclusive')`;
});

afterAll(async () => {
  if (admin) {
    await admin.unsafe(`
      DELETE FROM space_occupancy WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM outbox WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM fact_log WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM api_idempotency WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM reservation_segment WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM reservation WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM sellable_unit_space WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM sellable_unit WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM space WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM unit_type WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM rate_plan WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM party WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM app_user WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM org_node WHERE tenant_id='${TENANT}'::uuid;
      DELETE FROM tenant WHERE id='${TENANT}'::uuid;
    `).catch(() => undefined);
  }
  await database?.close();
  await runtimePool?.close();
  await admin?.close();
}, 30_000);

databaseDescribe("Order 231 executable PostgreSQL proof", () => {
  test("candidate read admits only free same-type one-room exclusive mappings", async () => {
    const target = await createArrival();
    const blocker = await createArrival(SELLABLES.b);
    await admin!`SELECT public.record_occupancy(
      ${TENANT}::uuid,${SPACES.b}::uuid,
      tstzrange(${blocker.period.from.toISOString()}::timestamptz,${blocker.period.to.toISOString()}::timestamptz,'[)'),
      ${blocker.segmentId}::uuid,'segment',true)`;
    const result = await database!.withTenantTransaction(TENANT, (tx) =>
      service().findDueInRoomAssignmentCandidates(tx, {
        tenantId: TENANT, propertyNode: PROPERTY, reservationId: target.reservationId,
      }));
    expect(result.candidates.map(({ sellableUnitId }) => sellableUnitId)).toEqual([
      SELLABLES.a, SELLABLES.c, SELLABLES.d,
    ]);
    expect(result.candidates.every((candidate) =>
      Object.keys(candidate).sort().join(",") ===
      "floor,roomCondition,sellableUnitId,sellableUnitName,spaceCode,spaceId"
    )).toBe(true);
    await release(blocker.segmentId);
  }, 30_000);

  test("atomic success is replayable, actor-bound and emits one coherent evidence chain", async () => {
    const target = await createArrival();
    const key = `order231-success-${crypto.randomUUID()}`;
    const input = assignmentInput(target, SELLABLES.a, key);
    const first = await assign(service(), input);
    expect(first).toMatchObject({
      reservationId: target.reservationId, segmentId: target.segmentId,
      sellableUnitId: SELLABLES.a, spaceId: SPACES.a, claimCount: 1, replayed: false,
    });
    expect(await assign(service(), { ...input, envelope: envelope() }))
      .toEqual({ ...first, replayed: true });
    await expect(assign(service(), { ...input, sellableUnitId: SELLABLES.b, envelope: envelope() }))
      .rejects.toBeInstanceOf(IdempotencyConflictError);
    const truth = await admin!<Array<{
      sellable: string; claims: number; occupancyFacts: number; modifiedFacts: number;
      occupancyEvents: number; modifiedEvents: number;
    }>>`
      SELECT
        (SELECT sellable_unit_id::text FROM reservation_segment WHERE id=${target.segmentId}::uuid) AS sellable,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=${target.segmentId}::uuid) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
          AND entity_type='reservation_segment' AND entity_id=${target.segmentId}::uuid
          AND fact_type='occupancy.recorded') AS "occupancyFacts",
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
          AND entity_type='reservation' AND entity_id=${target.reservationId}::uuid
          AND fact_type='reservation.modified') AS "modifiedFacts",
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid
          AND aggregate_id IN (SELECT id FROM space_occupancy WHERE slot_ref=${target.segmentId}::uuid)
          AND event_type='occupancy.recorded') AS "occupancyEvents",
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid
          AND aggregate_id=${target.reservationId}::uuid AND event_type='reservation.modified') AS "modifiedEvents"
    `;
    expect(truth).toEqual([{
      sellable: SELLABLES.a, claims: 1, occupancyFacts: 1, modifiedFacts: 1,
      occupancyEvents: 1, modifiedEvents: 1,
    }]);
    expect(await idempotencyCount(key)).toBe(1);
    await release(target.segmentId);
  }, 30_000);

  test("twenty same-segment contenders converge and last-room competition has one winner", async () => {
    const sameSegment = await createArrival();
    const contenderKeys = Array.from({ length: 20 }, (_, index) =>
      `order231-race-${index}-${crypto.randomUUID()}`);
    const contenders = await Promise.allSettled(contenderKeys.map((key) =>
      assign(service(), assignmentInput(
        sameSegment, SELLABLES.c, key,
      ))));
    expect(contenders.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(contenders.filter(({ status }) => status === "rejected")).toHaveLength(19);
    const converged = await admin!<Array<{ claims: number; assignments: number }>>`
      SELECT
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=${sameSegment.segmentId}::uuid) AS claims,
        (SELECT count(*)::int FROM reservation_segment WHERE id=${sameSegment.segmentId}::uuid
          AND sellable_unit_id=${SELLABLES.c}::uuid) AS assignments
    `;
    expect(converged).toEqual([{ claims: 1, assignments: 1 }]);
    expect((await Promise.all(contenderKeys.map(idempotencyCount)))
      .reduce((sum, count) => sum + count, 0)).toBe(1);
    await release(sameSegment.segmentId);

    const left = await createArrival();
    const right = await createArrival();
    const lastRoom = await Promise.allSettled([
      assign(service(), assignmentInput(left, SELLABLES.d, `order231-last-left-${crypto.randomUUID()}`)),
      assign(service(), assignmentInput(right, SELLABLES.d, `order231-last-right-${crypto.randomUUID()}`)),
    ]);
    expect(lastRoom.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(lastRoom.filter(({ status }) => status === "rejected")).toHaveLength(1);
    const lastTruth = await admin!<Array<{ assignments: number; claims: number }>>`
      SELECT
        (SELECT count(*)::int FROM reservation_segment
          WHERE id IN (${left.segmentId}::uuid,${right.segmentId}::uuid)
            AND sellable_unit_id=${SELLABLES.d}::uuid) AS assignments,
        (SELECT count(*)::int FROM space_occupancy
          WHERE slot_ref IN (${left.segmentId}::uuid,${right.segmentId}::uuid)) AS claims
    `;
    expect(lastTruth).toEqual([{ assignments: 1, claims: 1 }]);
    const winner = lastRoom[0]?.status === "fulfilled" ? left.segmentId : right.segmentId;
    await release(winner);
  }, 60_000);

  test("hostile runtime DML/capability/actor paths leave no artifacts", async () => {
    const target = await createArrival();
    let rawState: string | undefined;
    try {
      await database!.withTenantTransaction(TENANT, (tx) => tx`
        UPDATE reservation_segment SET sellable_unit_id=${SELLABLES.a}::uuid
        WHERE id=${target.segmentId}::uuid
      `);
    } catch (error) {
      rawState = sqlState(error);
    }
    expect(rawState).toBe("42501");

    let capabilityState: string | undefined;
    try {
      await runtimePool!`SELECT * FROM public.assign_due_in_room(
        ${TENANT}::uuid,${PROPERTY}::uuid,${target.reservationId}::uuid,${target.segmentId}::uuid,
        ${UNIT_TYPE}::uuid,
        tstzrange(${target.period.from.toISOString()}::timestamptz,${target.period.to.toISOString()}::timestamptz,'[)'),
        NULL,${SELLABLES.a}::uuid,${ACTOR}::uuid)`;
    } catch (error) {
      capabilityState = sqlState(error);
    }
    expect(capabilityState).toBe("42501");
    const inactiveKey = `order231-inactive-${crypto.randomUUID()}`;
    await expect(assign(service(), assignmentInput(
      target, SELLABLES.a, inactiveKey, INACTIVE_ACTOR,
    ))).rejects.toBeInstanceOf(ReservationLifecycleConflictError);
    const truth = await admin!<Array<{ assigned: boolean; claims: number; facts: number; events: number }>>`
      SELECT
        (SELECT sellable_unit_id IS NOT NULL FROM reservation_segment WHERE id=${target.segmentId}::uuid) AS assigned,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=${target.segmentId}::uuid) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
          AND entity_id IN (${target.segmentId}::uuid,${target.reservationId}::uuid)) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid
          AND aggregate_id IN (${target.segmentId}::uuid,${target.reservationId}::uuid)) AS events
    `;
    expect(truth).toEqual([{ assigned: false, claims: 0, facts: 0, events: 0 }]);
    expect(await idempotencyCount(inactiveKey)).toBe(0);
  }, 30_000);

  test("publisher failure rolls assignment, occupancy, evidence and idempotency back before retry", async () => {
    const target = await createArrival();
    const requestId = crypto.randomUUID();
    const key = `order231-rollback-${crypto.randomUUID()}`;
    const input = assignmentInput(target, SELLABLES.b, key, ACTOR, requestId);
    await expect(assign(service(new FailFirstPublish(events!)), input))
      .rejects.toThrow("Order 231 injected publication failure");
    const rolledBack = await admin!<Array<{
      assigned: boolean; claims: number; facts: number; events: number;
    }>>`
      SELECT
        (SELECT sellable_unit_id IS NOT NULL FROM reservation_segment WHERE id=${target.segmentId}::uuid) AS assigned,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=${target.segmentId}::uuid) AS claims,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
          AND payload->>'request_id'=${requestId}) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid
          AND correlation_id=${requestId}::uuid) AS events
    `;
    expect(rolledBack).toEqual([{ assigned: false, claims: 0, facts: 0, events: 0 }]);
    expect(await idempotencyCount(key)).toBe(0);
    expect((await assign(service(), input)).replayed).toBe(false);
    await release(target.segmentId);
  }, 30_000);
});
