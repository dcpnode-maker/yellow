import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  ReservationTravelConflictError,
  ReservationTravelNotFoundError,
  ReservationTravelService,
  ReservationTravelValidationError,
  type PutReservationTravelInput,
  type ReservationTravelTuple,
} from "../src/contexts/reservations";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

setDefaultTimeout(30_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_RESERVATION_TRAVEL_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_RESERVATION_TRAVEL === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_RESERVATION_TRAVEL_URL (or YELLOW_RUNTIME_DATABASE_URL) are required");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000021201";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000021202";
const PROPERTY = "00000000-0000-0000-0000-000000021211";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000021212";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000021213";
const ACTOR = "00000000-0000-0000-0000-000000021221";
const FOREIGN_ACTOR = "00000000-0000-0000-0000-000000021222";
const PARTY = "00000000-0000-0000-0000-000000021231";
const FOREIGN_PARTY = "00000000-0000-0000-0000-000000021232";
const TASK = "00000000-0000-0000-0000-000000021241";
const RESERVATIONS = Object.freeze({
  create: "00000000-0000-0000-0000-000000021251",
  replace: "00000000-0000-0000-0000-000000021252",
  rollback: "00000000-0000-0000-0000-000000021253",
  race: "00000000-0000-0000-0000-000000021254",
  linked: "00000000-0000-0000-0000-000000021255",
  closed: "00000000-0000-0000-0000-000000021256",
  otherProperty: "00000000-0000-0000-0000-000000021257",
  foreign: "00000000-0000-0000-0000-000000021258",
});

const ARRIVAL = Object.freeze({
  mode: "flight", carrier: "Air India", serviceNo: "AI 141",
  scheduledAt: "2026-09-01T04:05:06.123456Z", pickupRequested: true,
}) satisfies ReservationTravelTuple;
const DEPARTURE = Object.freeze({
  mode: "train", carrier: "VIA Rail", serviceNo: "VIA 82",
  scheduledAt: "2026-09-03T08:09:10.654321Z", pickupRequested: false,
}) satisfies ReservationTravelTuple;

let deploy: SQL | undefined;
let directRuntime: SQL | undefined;
let database: Database | undefined;
let eventPool: SQL | undefined;
let service: ReservationTravelService | undefined;

function audit(propertyNode = PROPERTY, actorId = ACTOR, tenantId = TENANT) {
  return createAuditEnvelope({
    actorId, tenantId, propertyNode, requestId: crypto.randomUUID(), operation: "reservation.modified",
  });
}

function put(
  reservationId: string,
  direction: "arrival" | "departure",
  expected: ReservationTravelTuple | null,
  travel: ReservationTravelTuple,
  key: string,
  envelope = audit(),
) {
  return database!.withTenantTransaction(envelope.tenantId, (tx) => service!.put(tx, {
    reservationId, direction, expected, travel, idempotencyKey: key, envelope,
  }));
}

async function expectSqlState(operation: PromiseLike<unknown>, sqlState: string): Promise<void> {
  try {
    await operation;
    throw new Error(`expected SQLSTATE ${sqlState}`);
  } catch (error) {
    expect(error).toMatchObject({ errno: sqlState });
  }
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  for (const table of ["api_idempotency", "outbox", "fact_log", "travel_detail", "task", "reservation", "party", "app_user", "org_node"]) {
    await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [TENANT, FOREIGN_TENANT]);
  }
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
}

describe("Order 212 reservation travel validation", () => {
  test("invalid commands fail before SQL", async () => {
    let calls = 0;
    const noSql = (() => { calls += 1; return Promise.resolve([]); }) as unknown as Tx;
    const travelService = new ReservationTravelService({
      events: {} as EventBus,
      idempotency: new PostgresIdempotency(),
    });
    const valid: PutReservationTravelInput = {
      reservationId: RESERVATIONS.create,
      direction: "arrival",
      expected: null,
      travel: ARRIVAL,
      idempotencyKey: "order212-validation",
      envelope: audit(),
    };
    const invalid = [
      { ...valid, reservationId: "bad" },
      { ...valid, direction: "transfer" },
      { ...valid, idempotencyKey: "short" },
      { ...valid, travel: { ...ARRIVAL, carrier: " ".repeat(2) } },
      { ...valid, travel: { ...ARRIVAL, serviceNo: "x".repeat(65) } },
      { ...valid, travel: { mode: null, carrier: null, serviceNo: null, scheduledAt: null, pickupRequested: false } },
      { ...valid, direction: "departure", travel: ARRIVAL },
      { ...valid, travel: { ...ARRIVAL, scheduledAt: "2026-09-01T04:05:06+00:00" } },
      { ...valid, travel: { ...ARRIVAL, notes: "not admitted" } },
    ];
    for (const candidate of invalid) {
      await expect(travelService.put(noSql, candidate as PutReservationTravelInput))
        .rejects.toBeInstanceOf(ReservationTravelValidationError);
    }
    expect(calls).toBe(0);
  });
});

databaseDescribe("Order 212 governed reservation travel capture", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 8, prepare: false });
    directRuntime = new SQL(RUNTIME_URL!, { max: 4, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 8, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 40, prepare: false });
    service = new ReservationTravelService({
      events: new PostgresEventBus(eventPool), idempotency: new PostgresIdempotency(),
    });
    await cleanup();
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT}::uuid,'order212','Order 212','shared','active'),
      (${FOREIGN_TENANT}::uuid,'order212-foreign','Order 212 Foreign','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY}::uuid,${TENANT}::uuid,'order212.property'::ltree,'property','Order 212','Asia/Kolkata','INR'),
      (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order212.other'::ltree,'property','Order 212 Other','UTC','USD'),
      (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order212_foreign.property'::ltree,'property','Foreign','UTC','USD')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR}::uuid,${TENANT}::uuid,'actor@order212.local','Actor','active'),
      (${FOREIGN_ACTOR}::uuid,${FOREIGN_TENANT}::uuid,'foreign@order212.local','Foreign','active')`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
      (${PARTY}::uuid,${TENANT}::uuid,'person','Guest','active'),
      (${FOREIGN_PARTY}::uuid,${FOREIGN_TENANT}::uuid,'person','Foreign Guest','active')`;
    await deploy`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,currency) VALUES
      (${RESERVATIONS.create}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O212-C','reserved',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.replace}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O212-U','due_in',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.rollback}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O212-B','in_house',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.race}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O212-R','due_out',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.linked}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O212-L','reserved',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.closed}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O212-X','checked_out',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.otherProperty}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'O212-O','reserved',${PARTY}::uuid,'USD'),
      (${RESERVATIONS.foreign}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'O212-F','reserved',${FOREIGN_PARTY}::uuid,'USD')`;
    await deploy`INSERT INTO task(id,tenant_id,property_node,kind,status,subject_type,subject_id,payload) VALUES
      (${TASK}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'trace','open','reservation',${RESERVATIONS.linked}::uuid,'{}')`;
    await deploy`INSERT INTO travel_detail(tenant_id,reservation_id,direction,mode,carrier,service_no,scheduled_at,pickup_requested,pickup_task_id) VALUES
      (${TENANT}::uuid,${RESERVATIONS.replace}::uuid,'departure',${DEPARTURE.mode},${DEPARTURE.carrier},${DEPARTURE.serviceNo},${DEPARTURE.scheduledAt}::timestamptz,false,NULL),
      (${TENANT}::uuid,${RESERVATIONS.linked}::uuid,'arrival','car',NULL,NULL,'2026-09-01T01:00:00Z',true,${TASK}::uuid)`;
  });

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await eventPool?.close({ timeout: 0 });
    await directRuntime?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  });

  test("P1 capability is owner-contained and raw runtime travel DML remains denied", async () => {
    const capability = await deploy!<Array<{ owner: string; security_definer: boolean; config: string[]; app_execute: boolean; runtime_execute: boolean; public_execute: boolean }>>`
      SELECT pg_get_userbyid(proowner) owner, prosecdef security_definer, proconfig config,
        has_function_privilege('app_role',oid,'EXECUTE') app_execute,
        has_function_privilege('yellow_runtime',oid,'EXECUTE') runtime_execute,
        has_function_privilege('public',oid,'EXECUTE') public_execute
      FROM pg_proc WHERE oid = 'public.put_reservation_travel(uuid,uuid,uuid,text,boolean,text,text,text,timestamptz,boolean,text,text,text,timestamptz,boolean,uuid)'::regprocedure`;
    expect(capability).toEqual([{
      owner: "yellow_owner", security_definer: true,
      config: ["search_path=pg_catalog, public, pg_temp"],
      app_execute: true, runtime_execute: false, public_execute: false,
    }]);
    const connection = await directRuntime!.reserve();
    try {
      await connection.unsafe("BEGIN");
      await connection`SELECT set_config('app.tenant_id',${TENANT},true)`;
      await connection.unsafe("SET LOCAL ROLE app_role");
      await expectSqlState(connection`INSERT INTO travel_detail(tenant_id,reservation_id,direction)
        VALUES (${TENANT}::uuid,${RESERVATIONS.create}::uuid,'arrival')`, "42501");
      await connection.unsafe("ROLLBACK");
    } finally {
      connection.release();
    }
  });

  test("P2 create, replace, no-op and exact evidence are bounded", async () => {
    const created = await put(RESERVATIONS.create, "arrival", null, ARRIVAL, "order212-create-arrival");
    expect(created).toMatchObject({ status: "reserved", direction: "arrival", travel: ARRIVAL, changed: true, replayed: false });
    const replacement = Object.freeze({ ...DEPARTURE, serviceNo: "VIA 84" });
    const changed = await put(RESERVATIONS.replace, "departure", DEPARTURE, replacement, "order212-replace-departure");
    expect(changed).toMatchObject({ status: "due_in", travel: replacement, changed: true });
    const unchanged = await put(RESERVATIONS.replace, "departure", replacement, replacement, "order212-noop-departure");
    expect(unchanged.changed).toBe(false);
    const evidence = await deploy!<Array<{ facts: number; events: number; tasks: number }>>`SELECT
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id IN (${RESERVATIONS.create}::uuid,${RESERVATIONS.replace}::uuid)) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_id IN (${RESERVATIONS.create}::uuid,${RESERVATIONS.replace}::uuid)) events,
      (SELECT count(*)::int FROM task WHERE tenant_id=${TENANT}::uuid) tasks`;
    expect(evidence).toEqual([{ facts: 2, events: 2, tasks: 1 }]);
  });

  test("P3 stale, linked, status, property and tenant boundaries fail closed", async () => {
    const staleReplacement = Object.freeze({ ...DEPARTURE, serviceNo: "VIA 85" });
    await expect(put(RESERVATIONS.replace, "departure", DEPARTURE, staleReplacement, "order212-stale"))
      .rejects.toBeInstanceOf(ReservationTravelConflictError);
    const linked = Object.freeze({ mode: "car", carrier: null, serviceNo: null, scheduledAt: "2026-09-01T01:00:00.000000Z", pickupRequested: true }) satisfies ReservationTravelTuple;
    await expect(put(RESERVATIONS.linked, "arrival", linked, { ...linked, mode: "bus" }, "order212-linked"))
      .rejects.toBeInstanceOf(ReservationTravelConflictError);
    await expect(put(RESERVATIONS.closed, "arrival", null, ARRIVAL, "order212-closed"))
      .rejects.toBeInstanceOf(ReservationTravelConflictError);
    await expect(put(RESERVATIONS.otherProperty, "arrival", null, ARRIVAL, "order212-wrong-property"))
      .rejects.toBeInstanceOf(ReservationTravelNotFoundError);
    await expect(put(RESERVATIONS.foreign, "arrival", null, ARRIVAL, "order212-foreign"))
      .rejects.toBeInstanceOf(ReservationTravelNotFoundError);
  });

  test("P4 publication failure rolls travel, fact, event and idempotency back", async () => {
    const failingEvents: EventBus = {
      publish: async (_tx: Tx, _event: PublishEventInput) => { throw new Error("injected travel publication failure"); },
      consumeBatch: async () => { throw new Error("unused"); },
    };
    const failingService = new ReservationTravelService({ events: failingEvents, idempotency: new PostgresIdempotency() });
    await expect(database!.withTenantTransaction(TENANT, (tx) => failingService.put(tx, {
      reservationId: RESERVATIONS.rollback, direction: "arrival", expected: null, travel: ARRIVAL,
      idempotencyKey: "order212-rollback-event", envelope: audit(),
    }))).rejects.toThrow("injected travel publication failure");
    const counts = await deploy!<Array<{ travel: number; facts: number; events: number; claims: number }>>`SELECT
      (SELECT count(*)::int FROM travel_detail WHERE tenant_id=${TENANT}::uuid AND reservation_id=${RESERVATIONS.rollback}::uuid) travel,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id=${RESERVATIONS.rollback}::uuid) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${RESERVATIONS.rollback}::uuid) events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation='reservation.travel.put') claims`;
    expect(counts).toEqual([{ travel: 0, facts: 0, events: 0, claims: 3 }]);
  });

  test("P5 replay is stable and concurrent creates have one changed effect", async () => {
    const replayEnvelope = audit();
    const first = await put(RESERVATIONS.rollback, "departure", null, DEPARTURE, "order212-exact-replay", replayEnvelope);
    const replay = await put(RESERVATIONS.rollback, "departure", null, DEPARTURE, "order212-exact-replay", replayEnvelope);
    expect(replay).toEqual({ ...first, replayed: true });
    const contenders = await Promise.allSettled(Array.from({ length: 10 }, (_, index) =>
      put(RESERVATIONS.race, "arrival", null, ARRIVAL, `order212-race-${index}`)));
    expect(contenders.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(contenders.filter((result) => result.status === "rejected")).toHaveLength(9);
  });
});
