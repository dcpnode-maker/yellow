import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  VehicleParkingAssignmentService,
  VehicleParkingConflictError,
  VehicleParkingNotFoundError,
  type VehicleParkingAssignmentInput,
} from "../src/contexts/stay-operations";
import {
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_VEHICLE_PARKING_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_VEHICLE_PARKING === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Order 236 parking proof requires deploy and runtime database URLs");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
const id = (suffix: number): string => `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT = id(23801);
const PROPERTY = id(23811);
const OTHER_PROPERTY = id(23812);
const ACTOR = id(23821);
const INACTIVE_ACTOR = id(23822);
const GUEST = id(23831);
const UNIT_TYPE = id(23841);
const RATE_PLAN = id(23851);
const RESERVATION = id(23861);
const SEGMENT = id(23862);
const PARKING_A = id(23871);
const PARKING_B = id(23872);
const PARKING_RACE = id(23873);
const ROOM = id(23874);
const LARGE_PARKING = id(23875);
const VEHICLE_A = id(23881);
const VEHICLE_ROLLBACK = id(23882);
const VEHICLE_OFFSITE = id(23883);
const PERIOD_START = "2020-01-01T00:00:00.000000Z";
const PERIOD_END = "2100-01-01T00:00:00.000000Z";

let deploy: SQL | undefined;
let directRuntime: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let service: VehicleParkingAssignmentService | undefined;

class FailAfterPublishBus implements EventBus {
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, event);
    throw new Error("Order 236 injected publication failure");
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

function envelope(requestId = crypto.randomUUID(), actorId = ACTOR) {
  return Object.freeze({
    actorId,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    requestId,
    operation: "occupancy.recorded" as const,
  });
}

function input(
  vehicleId: string,
  parkingSpaceId: string,
  idempotencyKey: string,
  audit = envelope(),
): VehicleParkingAssignmentInput {
  return Object.freeze({
    tenantId: TENANT,
    propertyNode: PROPERTY,
    vehicleId,
    parkingSpaceId,
    idempotencyKey,
    envelope: audit,
  });
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await deploy`DELETE FROM api_idempotency WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM fact_log WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM vehicle WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM space_occupancy WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM reservation_segment WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM reservation WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM rate_plan WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM unit_type WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM party WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM business_day WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM space WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM app_user WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM org_node WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM tenant WHERE id=${TENANT}::uuid`;
}

async function expectAppRoleDenied(statement: string): Promise<void> {
  const connection = await directRuntime!.reserve();
  try {
    await connection.unsafe("BEGIN");
    await connection`SELECT set_config('app.tenant_id', ${TENANT}, true)`;
    await connection.unsafe("SET LOCAL ROLE app_role");
    await connection.unsafe("SAVEPOINT hostile_dml");
    try {
      await connection.unsafe(statement);
      throw new Error("expected app-role denial");
    } catch (error) {
      expect(error).toMatchObject({ errno: "42501" });
      await connection.unsafe("ROLLBACK TO SAVEPOINT hostile_dml");
    }
    await connection.unsafe("ROLLBACK");
  } finally {
    connection.release();
  }
}

databaseDescribe("Order 236 fresh-PostgreSQL governed vehicle parking assignment", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 8, prepare: false });
    directRuntime = new SQL(RUNTIME_URL!, { max: 4, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 8, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 32, prepare: false });
    service = new VehicleParkingAssignmentService({
      database,
      events: new PostgresEventBus(eventPool),
      idempotency: new PostgresIdempotency(),
    });
    await cleanup();
    await deploy`INSERT INTO tenant(id,slug,name,tier,status)
      VALUES(${TENANT}::uuid,'order236','Order 236','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY}::uuid,${TENANT}::uuid,'order236.property'::ltree,'property','Order 236','UTC','USD'),
      (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order236.other'::ltree,'property','Order 236 Other','UTC','USD')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR}::uuid,${TENANT}::uuid,'actor@order236.local','Actor','active'),
      (${INACTIVE_ACTOR}::uuid,${TENANT}::uuid,'inactive@order236.local','Inactive','disabled')`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status)
      VALUES(${GUEST}::uuid,${TENANT}::uuid,'person','Order 236 Guest','active')`;
    await deploy`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key)
      VALUES(${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'STD','Standard','hotel')`;
    await deploy`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency)
      VALUES(${RATE_PLAN}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'BAR','BAR','USD')`;
    await deploy`INSERT INTO business_day(tenant_id,property_node,business_date)
      VALUES(${TENANT}::uuid,${PROPERTY}::uuid,CURRENT_DATE)`;
    await deploy`INSERT INTO reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
    ) VALUES(${RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O236-STAY','in_house',${GUEST}::uuid,'direct','USD')`;
    await deploy`INSERT INTO reservation_segment(
      id,tenant_id,reservation_id,seq,unit_type_id,period,adults,children,rate_plan_id,status
    ) VALUES(
      ${SEGMENT}::uuid,${TENANT}::uuid,${RESERVATION}::uuid,1,${UNIT_TYPE}::uuid,
      tstzrange(${PERIOD_START}::timestamptz,${PERIOD_END}::timestamptz,'[)'),
      1,'[]'::jsonb,${RATE_PLAN}::uuid,'in_house'
    )`;
    await deploy`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status,floor) VALUES
      (${PARKING_A}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'P-01','parking',1,'active','B1'),
      (${PARKING_B}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'P-02','parking',1,'active','B1'),
      (${PARKING_RACE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'P-03','parking',1,'active','B2'),
      (${ROOM}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'101','hotel',1,'active','1'),
      (${LARGE_PARKING}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'P-LARGE','parking',2,'active','B2')`;
    await deploy`INSERT INTO vehicle(
      id,tenant_id,property_node,reservation_id,party_id,reg_no,entered_at,exited_at
    ) VALUES
      (${VEHICLE_A}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${RESERVATION}::uuid,${GUEST}::uuid,'O236-A',CURRENT_TIMESTAMP,NULL),
      (${VEHICLE_ROLLBACK}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${RESERVATION}::uuid,${GUEST}::uuid,'O236-R',CURRENT_TIMESTAMP,NULL),
      (${VEHICLE_OFFSITE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${RESERVATION}::uuid,${GUEST}::uuid,'O236-X',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`;
  });

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await eventPool?.close({ timeout: 0 });
    await directRuntime?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  });

  test("P1 lists exact available parking and creates one exclusive segment claim", async () => {
    const before = await service!.read({ tenantId: TENANT, propertyNode: PROPERTY, vehicleId: VEHICLE_A });
    expect(before.assignment).toBeNull();
    expect(before.candidates.map(({ code }) => code)).toEqual(["P-01", "P-02", "P-03"]);

    const result = await service!.assign(input(VEHICLE_A, PARKING_A, "order236-success"));
    expect(result).toMatchObject({ created: true, replayed: false, assignment: {
      vehicleId: VEHICLE_A, parkingSpaceId: PARKING_A, code: "P-01", registration: "O236-A",
    } });
    expect(Date.parse(result.assignment.from)).toBeLessThan(Date.parse(result.assignment.to));
    const truth = await deploy!<Array<{ parking: string; claims: number; facts: number; events: number }>>`SELECT
      vehicle.parking_space AS parking,
      (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=${TENANT}::uuid
        AND space_id=${PARKING_A}::uuid AND slot_ref=${SEGMENT}::uuid AND slot_kind='segment'
        AND exclusive AND claim=int4range(0,NULL)) claims,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
        AND entity_type='vehicle' AND entity_id=${VEHICLE_A}::uuid AND fact_type='occupancy.recorded') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid
        AND event_type='occupancy.recorded' AND payload @> ${JSON.stringify({ vehicle_id: VEHICLE_A })}::text::jsonb) events
      FROM vehicle WHERE tenant_id=${TENANT}::uuid AND id=${VEHICLE_A}::uuid`;
    expect(truth).toEqual([{ parking: PARKING_A, claims: 1, facts: 1, events: 1 }]);
    expect(await service!.read({ tenantId: TENANT, propertyNode: PROPERTY, vehicleId: VEHICLE_A }))
      .toMatchObject({ assignment: { parkingSpaceId: PARKING_A, code: "P-01" }, candidates: [] });
  });

  test("P2 contains direct capability/DML and hostile or non-parking targets", async () => {
    try {
      await directRuntime!`SELECT * FROM public.assign_vehicle_parking(
        ${TENANT}::uuid,${PROPERTY}::uuid,${VEHICLE_ROLLBACK}::uuid,${PARKING_B}::uuid,${ACTOR}::uuid
      )`;
      throw new Error("expected governed-role denial");
    } catch (error) {
      expect(error).toMatchObject({ errno: "42501" });
    }
    await expectAppRoleDenied(`UPDATE public.vehicle SET parking_space='${PARKING_B}'::uuid WHERE id='${VEHICLE_ROLLBACK}'::uuid`);
    await expectAppRoleDenied(`INSERT INTO public.space_occupancy(tenant_id,space_id,period,slot_ref,slot_kind,exclusive,claim) VALUES('${TENANT}'::uuid,'${PARKING_B}'::uuid,tstzrange(now(),now()+interval '1 day','[)'),'${SEGMENT}'::uuid,'segment',true,int4range(0,NULL))`);
    await expect(service!.assign(input(VEHICLE_OFFSITE, PARKING_B, "order236-offsite")))
      .rejects.toBeInstanceOf(VehicleParkingNotFoundError);
    await expect(service!.assign(input(VEHICLE_ROLLBACK, ROOM, "order236-room")))
      .rejects.toBeInstanceOf(VehicleParkingNotFoundError);
    await expect(service!.assign(input(VEHICLE_ROLLBACK, LARGE_PARKING, "order236-capacity")))
      .rejects.toBeInstanceOf(VehicleParkingNotFoundError);
    await expect(service!.assign(input(
      VEHICLE_ROLLBACK, PARKING_B, "order236-inactive-actor", envelope(undefined, INACTIVE_ACTOR),
    ))).rejects.toBeInstanceOf(VehicleParkingNotFoundError);
  });

  test("P3 rolls claim, vehicle, fact, outbox and idempotency back before retry", async () => {
    const failing = new VehicleParkingAssignmentService({
      database: database!,
      events: new FailAfterPublishBus(new PostgresEventBus(eventPool!)),
      idempotency: new PostgresIdempotency(),
    });
    const command = input(VEHICLE_ROLLBACK, PARKING_B, "order236-rollback");
    await expect(failing.assign(command)).rejects.toThrow("Order 236 injected publication failure");
    const rolledBack = await deploy!<Array<{ parking: string | null; claims: number; facts: number; events: number; keys: number }>>`SELECT
      vehicle.parking_space AS parking,
      (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=${TENANT}::uuid AND space_id=${PARKING_B}::uuid) claims,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id=${VEHICLE_ROLLBACK}::uuid) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND payload @> ${JSON.stringify({ vehicle_id: VEHICLE_ROLLBACK })}::text::jsonb) events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation='stay-operations.vehicle.park') keys
      FROM vehicle WHERE tenant_id=${TENANT}::uuid AND id=${VEHICLE_ROLLBACK}::uuid`;
    expect(rolledBack).toEqual([{ parking: null, claims: 0, facts: 0, events: 0, keys: 1 }]);
    expect(await service!.assign(command)).toMatchObject({ created: true, replayed: false });
  });

  test("P4 exact replay is stable and twenty slot contenders converge to one effect", async () => {
    const first = await service!.assign(input(VEHICLE_A, PARKING_A, "order236-replay"));
    expect(first).toMatchObject({ created: false, replayed: false });
    const replay = await service!.assign(input(VEHICLE_A, PARKING_A, "order236-replay"));
    expect(replay).toMatchObject({ created: false, replayed: true });
    await expect(service!.assign(input(VEHICLE_A, PARKING_B, "order236-changed")))
      .rejects.toBeInstanceOf(VehicleParkingConflictError);

    const racers = Array.from({ length: 20 }, (_, index) => id(23900 + index));
    for (const [index, vehicleId] of racers.entries()) {
      await deploy!`INSERT INTO vehicle(
        id,tenant_id,property_node,reservation_id,party_id,reg_no,entered_at
      ) VALUES(
        ${vehicleId}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${RESERVATION}::uuid,${GUEST}::uuid,
        ${`O236-RACE-${index}`},CURRENT_TIMESTAMP
      )`;
    }
    const settled = await Promise.allSettled(racers.map((vehicleId, index) =>
      service!.assign(input(vehicleId, PARKING_RACE, `order236-race-${index}`)),
    ));
    expect(settled.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(settled.filter(({ status }) => status === "rejected")).toHaveLength(19);
    const cardinality = await deploy!<Array<{ vehicles: number; claims: number; facts: number; events: number }>>`SELECT
      (SELECT count(*)::int FROM vehicle WHERE tenant_id=${TENANT}::uuid AND parking_space=${PARKING_RACE}::uuid) vehicles,
      (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=${TENANT}::uuid AND space_id=${PARKING_RACE}::uuid) claims,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND payload @> ${JSON.stringify({ space_id: PARKING_RACE })}::text::jsonb) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND event_type='occupancy.recorded' AND payload @> ${JSON.stringify({ space_id: PARKING_RACE })}::text::jsonb) events`;
    expect(cardinality).toEqual([{ vehicles: 1, claims: 1, facts: 1, events: 1 }]);
  });

  test("P5 canonical segment release clears the parking claim and vehicle binding", async () => {
    const released = await database!.withTenantTransaction(TENANT, async (tx) =>
      tx<Array<{ count: number }>>`
        SELECT public.release_occupancy(${TENANT}::uuid, ${SEGMENT}::uuid) AS count
      `,
    );
    expect(released).toEqual([{ count: 3 }]);
    const truth = await deploy!<Array<{ parking: string | null; claims: number }>>`
      SELECT vehicle.parking_space AS parking,
             (SELECT count(*)::int FROM space_occupancy
               WHERE tenant_id=${TENANT}::uuid AND slot_ref=${SEGMENT}::uuid) AS claims
        FROM vehicle
       WHERE tenant_id=${TENANT}::uuid AND id=${VEHICLE_A}::uuid
    `;
    expect(truth).toEqual([{ parking: null, claims: 0 }]);
    expect(await service!.read({ tenantId: TENANT, propertyNode: PROPERTY, vehicleId: VEHICLE_A }))
      .toMatchObject({ assignment: null });
  });
});
