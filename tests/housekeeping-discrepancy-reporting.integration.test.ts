import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  HousekeepingDiscrepancyConflictError,
  HousekeepingDiscrepancyNotFoundError,
  HousekeepingDiscrepancyService,
  type HousekeepingDiscrepancyReportInput,
} from "../src/contexts/housekeeping";
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
const RUNTIME_URL = process.env.YELLOW_HOUSEKEEPING_DISCREPANCY_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_HOUSEKEEPING_DISCREPANCY === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error(
    "YELLOW_DEPLOY_DATABASE_URL and YELLOW_HOUSEKEEPING_DISCREPANCY_URL " +
    "(or YELLOW_RUNTIME_DATABASE_URL) are required",
  );
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT = id(23601);
const FOREIGN_TENANT = id(23602);
const PROPERTY = id(23611);
const OTHER_PROPERTY = id(23612);
const FOREIGN_PROPERTY = id(23613);
const ACTOR = id(23621);
const INACTIVE_ACTOR = id(23622);
const FOREIGN_ACTOR = id(23623);
const GUEST = id(23631);
const UNIT_TYPE = id(23641);
const OTHER_UNIT_TYPE = id(23642);
const FOREIGN_UNIT_TYPE = id(23643);
const RATE_PLAN = id(23651);

const FIXTURES = Object.freeze({
  sleep: { room: id(23701), sellable: id(23702) },
  skip: { room: id(23711), sellable: id(23712), reservation: id(23713), segment: id(23714), occupancy: id(23715) },
  person: { room: id(23721), sellable: id(23722), reservation: id(23723), segment: id(23724), occupancy: id(23725) },
  match: { room: id(23731), sellable: id(23732) },
  replay: { room: id(23741), sellable: id(23742) },
  rollback: { room: id(23751), sellable: id(23752) },
  race: { room: id(23761), sellable: id(23762) },
  hostile: { room: id(23771), sellable: id(23772) },
  wrongProperty: { room: id(23781), sellable: id(23782) },
  foreign: { room: id(23791), sellable: id(23792) },
});

const PERIOD_START = "2020-01-01T14:00:00.123456Z";
const PERIOD_END = "2100-01-01T10:00:00.000000Z";

let deploy: SQL | undefined;
let directRuntime: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let service: HousekeepingDiscrepancyService | undefined;

class FailAfterPublishBus implements EventBus {
  constructor(readonly delegate: EventBus) {}

  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, event);
    throw new Error("Order 235 injected publication failure");
  }

  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

function envelope(
  requestId = crypto.randomUUID(),
  actorId = ACTOR,
  tenantId = TENANT,
  propertyNode = PROPERTY,
) {
  return Object.freeze({
    actorId,
    tenantId,
    propertyNode,
    requestId,
    operation: "discrepancy.reported" as const,
  });
}

function input(
  room: string,
  key: string,
  observedPresence: "occupied" | "vacant",
  observedPersons: number | null,
  audit = envelope(),
  tenantId = TENANT,
  propertyNode = PROPERTY,
): HousekeepingDiscrepancyReportInput {
  return {
    tenantId,
    propertyNode,
    spaceId: room,
    observedPresence,
    observedPersons,
    idempotencyKey: key,
    envelope: audit,
  };
}

function keyHash(key: string): string {
  return new Bun.CryptoHasher("sha256").update(key).digest("hex");
}

async function expectSqlState(operation: PromiseLike<unknown>, state: string): Promise<void> {
  try {
    await operation;
    throw new Error(`expected SQLSTATE ${state}`);
  } catch (error) {
    expect(error).toMatchObject({ errno: state });
  }
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
      throw new Error(`expected app-role denial for ${statement}`);
    } catch (error) {
      expect(error).toMatchObject({ errno: "42501" });
      await connection.unsafe("ROLLBACK TO SAVEPOINT hostile_dml");
    }
    await connection.unsafe("ROLLBACK");
  } finally {
    connection.release();
  }
}

async function cleanup(client = deploy): Promise<void> {
  if (!client) return;
  await client`DELETE FROM api_idempotency WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM outbox WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM fact_log WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM discrepancy WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM space_occupancy WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM unit_condition WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM reservation_segment WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM reservation WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM sellable_unit_space WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM sellable_unit WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM space WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM rate_plan WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM unit_type WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM party WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM app_user WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM org_node WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM tenant WHERE id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
}

databaseDescribe("Order 235 fresh-PostgreSQL governed room discrepancy reporting", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 8, prepare: false });
    directRuntime = new SQL(RUNTIME_URL!, { max: 4, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 8, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 32, prepare: false });
    service = new HousekeepingDiscrepancyService({
      database,
      events: new PostgresEventBus(eventPool),
      idempotency: new PostgresIdempotency(),
    });
    await cleanup();

    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT}::uuid,'order235','Order 235','shared','active'),
      (${FOREIGN_TENANT}::uuid,'order235-foreign','Order 235 Foreign','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY}::uuid,${TENANT}::uuid,'order235.property'::ltree,'property','Order 235','UTC','USD'),
      (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order235.other'::ltree,'property','Order 235 Other','UTC','USD'),
      (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order235_foreign.property'::ltree,'property','Order 235 Foreign','UTC','USD')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR}::uuid,${TENANT}::uuid,'actor@order235.local','Actor','active'),
      (${INACTIVE_ACTOR}::uuid,${TENANT}::uuid,'inactive@order235.local','Inactive Actor','disabled'),
      (${FOREIGN_ACTOR}::uuid,${FOREIGN_TENANT}::uuid,'foreign@order235.local','Foreign Actor','active')`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
      (${GUEST}::uuid,${TENANT}::uuid,'person','Order 235 Guest','active')`;
    await deploy`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key) VALUES
      (${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'STD','Standard','hotel-room'),
      (${OTHER_UNIT_TYPE}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'STD','Standard','hotel-room'),
      (${FOREIGN_UNIT_TYPE}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'STD','Standard','hotel-room')`;
    await deploy`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency) VALUES
      (${RATE_PLAN}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'BAR','BAR','USD')`;

    for (const [name, fixture] of Object.entries(FIXTURES)) {
      const foreign = name === "foreign";
      const otherProperty = name === "wrongProperty";
      const tenantId = foreign ? FOREIGN_TENANT : TENANT;
      const propertyNode = foreign ? FOREIGN_PROPERTY : otherProperty ? OTHER_PROPERTY : PROPERTY;
      const unitType = foreign ? FOREIGN_UNIT_TYPE : otherProperty ? OTHER_UNIT_TYPE : UNIT_TYPE;
      await deploy`INSERT INTO space(id,tenant_id,property_node,code,profile_key,status,floor) VALUES(
        ${fixture.room}::uuid,${tenantId}::uuid,${propertyNode}::uuid,
        ${`235-${name}`},'room','active','1')`;
      await deploy`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES(
        ${fixture.sellable}::uuid,${tenantId}::uuid,${unitType}::uuid,${`235 ${name}`},'active')`;
      await deploy`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode) VALUES(
        ${tenantId}::uuid,${fixture.sellable}::uuid,${fixture.room}::uuid,'exclusive')`;
      await deploy`INSERT INTO unit_condition(tenant_id,space_id,condition,updated_by) VALUES(
        ${tenantId}::uuid,${fixture.room}::uuid,'clean',
        ${foreign ? FOREIGN_ACTOR : ACTOR}::uuid)`;
    }

    for (const occupied of [
      { fixture: FIXTURES.skip, confirmation: "O235-SKIP", adults: 1, children: [] },
      { fixture: FIXTURES.person, confirmation: "O235-PERSON", adults: 2, children: [{ age: 7 }] },
    ]) {
      await deploy`INSERT INTO reservation(
        id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
      ) VALUES(
        ${occupied.fixture.reservation}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,
        ${occupied.confirmation},'in_house',${GUEST}::uuid,'direct','USD')`;
      await deploy`INSERT INTO reservation_segment(
        id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,
        adults,children,rate_plan_id,status
      ) VALUES(
        ${occupied.fixture.segment}::uuid,${TENANT}::uuid,${occupied.fixture.reservation}::uuid,1,
        ${UNIT_TYPE}::uuid,${occupied.fixture.sellable}::uuid,
        tstzrange(${PERIOD_START}::timestamptz,${PERIOD_END}::timestamptz,'[)'),
        ${occupied.adults},${JSON.stringify(occupied.children)}::text::jsonb,${RATE_PLAN}::uuid,'in_house')`;
      await deploy`INSERT INTO space_occupancy(
        id,tenant_id,space_id,period,slot_ref,slot_kind,exclusive,claim
      ) VALUES(
        ${occupied.fixture.occupancy}::uuid,${TENANT}::uuid,${occupied.fixture.room}::uuid,
        tstzrange(${PERIOD_START}::timestamptz,${PERIOD_END}::timestamptz,'[)'),
        ${occupied.fixture.segment}::uuid,'segment',true,int4range(0,NULL))`;
    }
  });

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await eventPool?.close({ timeout: 0 });
    await directRuntime?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
    service = undefined;
    database = undefined;
    eventPool = undefined;
    directRuntime = undefined;
    deploy = undefined;
  });

  test("P1 derives sleep, skip and person evidence and preserves a matching no-op", async () => {
    const sleep = await service!.report(input(
      FIXTURES.sleep.room, "order235-classify-sleep", "occupied", 2,
    ));
    expect(sleep).toMatchObject({ created: true, replayed: false, discrepancy: {
      spaceId: FIXTURES.sleep.room, kind: "sleep", reported: "occupied", systemState: "vacant",
    } });

    const skip = await service!.report(input(
      FIXTURES.skip.room, "order235-classify-skip", "vacant", null,
    ));
    expect(skip).toMatchObject({ created: true, replayed: false, discrepancy: {
      spaceId: FIXTURES.skip.room, kind: "skip", reported: "vacant", systemState: "occupied",
    } });

    const person = await service!.report(input(
      FIXTURES.person.room, "order235-classify-person", "occupied", 2,
    ));
    expect(person).toMatchObject({ created: true, replayed: false, discrepancy: {
      spaceId: FIXTURES.person.room, kind: "person", reported: "persons:2", systemState: "persons:3",
    } });

    expect(await service!.report(input(
      FIXTURES.match.room, "order235-classify-match", "vacant", null,
    ))).toEqual({ discrepancy: null, created: false, replayed: false });

    const evidence = await deploy!<Array<{ discrepancies: number; facts: number; events: number }>>`SELECT
      (SELECT count(*)::int FROM discrepancy WHERE tenant_id=${TENANT}::uuid
        AND space_id IN (${FIXTURES.sleep.room}::uuid,${FIXTURES.skip.room}::uuid,${FIXTURES.person.room}::uuid)) discrepancies,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
        AND fact_type='discrepancy.reported') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid
        AND event_type='discrepancy.reported') events`;
    expect(evidence).toEqual([{ discrepancies: 3, facts: 3, events: 3 }]);
    expect(await service!.listOpen({ tenantId: TENANT, propertyNode: PROPERTY }))
      .toHaveLength(3);
  });

  test("P2 contains hostile runtime, raw-DML, tenant, property and actor inputs", async () => {
    await expectSqlState(directRuntime!`SELECT * FROM public.report_room_discrepancy(
      ${TENANT}::uuid,${PROPERTY}::uuid,${FIXTURES.hostile.room}::uuid,'occupied',1,${ACTOR}::uuid
    )`, "42501");
    await expectAppRoleDenied(`INSERT INTO public.discrepancy(
      tenant_id,space_id,reported,system_state,reported_by
    ) VALUES(
      '${TENANT}'::uuid,'${FIXTURES.hostile.room}'::uuid,'occupied','vacant','${ACTOR}'::uuid
    )`);
    await expect(service!.report(input(
      FIXTURES.wrongProperty.room, "order235-hostile-property", "occupied", 1,
    ))).rejects.toBeInstanceOf(HousekeepingDiscrepancyNotFoundError);
    await expect(service!.report(input(
      FIXTURES.foreign.room, "order235-hostile-tenant", "occupied", 1,
    ))).rejects.toBeInstanceOf(HousekeepingDiscrepancyNotFoundError);
    await expect(service!.report(input(
      FIXTURES.hostile.room,
      "order235-hostile-actor",
      "occupied",
      1,
      envelope(undefined, INACTIVE_ACTOR),
    ))).rejects.toBeInstanceOf(HousekeepingDiscrepancyNotFoundError);
    const rows = await deploy!<Array<{ mutations: number }>>`SELECT count(*)::int AS mutations
      FROM discrepancy WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)
        AND space_id IN (
          ${FIXTURES.hostile.room}::uuid,${FIXTURES.wrongProperty.room}::uuid,${FIXTURES.foreign.room}::uuid
        )`;
    expect(rows).toEqual([{ mutations: 0 }]);
  });

  test("P3 atomically rolls discrepancy, fact, outbox and claim back, then retries", async () => {
    const failing = new HousekeepingDiscrepancyService({
      database: database!,
      events: new FailAfterPublishBus(new PostgresEventBus(eventPool!)),
      idempotency: new PostgresIdempotency(),
    });
    const command = input(
      FIXTURES.rollback.room, "order235-rollback-retry", "occupied", 1,
    );
    await expect(failing.report(command)).rejects.toThrow("Order 235 injected publication failure");
    const rolledBack = await deploy!<Array<{
      discrepancies: number; facts: number; events: number; claims: number;
    }>>`SELECT
      (SELECT count(*)::int FROM discrepancy WHERE tenant_id=${TENANT}::uuid
        AND space_id=${FIXTURES.rollback.room}::uuid) discrepancies,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
        AND payload @> ${JSON.stringify({ space_id: FIXTURES.rollback.room })}::text::jsonb) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid
        AND event_type='discrepancy.reported'
        AND payload @> ${JSON.stringify({ space_id: FIXTURES.rollback.room })}::text::jsonb) events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid
        AND operation='housekeeping.discrepancy.report'
        AND key_hash=${keyHash("order235-rollback-retry")}) claims`;
    expect(rolledBack).toEqual([{ discrepancies: 0, facts: 0, events: 0, claims: 0 }]);
    expect(await service!.report(command)).toMatchObject({ created: true, replayed: false });
  });

  test("P3 replays exact evidence and rejects changed key or changed observation", async () => {
    const command = input(FIXTURES.replay.room, "order235-exact-replay", "occupied", 2);
    const created = await service!.report(command);
    expect(created).toMatchObject({ created: true, replayed: false });
    const replay = await service!.report(command);
    expect(replay).toEqual({ ...created, replayed: true });
    await expect(service!.report({ ...command, observedPersons: 3 }))
      .rejects.toBeInstanceOf(HousekeepingDiscrepancyConflictError);
    await expect(service!.report(input(
      FIXTURES.replay.room, "order235-changed-observation", "vacant", null,
    ))).rejects.toBeInstanceOf(HousekeepingDiscrepancyConflictError);
    expect(await service!.report(input(
      FIXTURES.replay.room, "order235-convergent-evidence", "occupied", 9,
    ))).toMatchObject({
      discrepancy: { discrepancyId: created.discrepancy!.discrepancyId },
      created: false,
      replayed: false,
    });
  });

  test("P4 twenty concurrent reporters converge to one discrepancy and audit pair", async () => {
    const settled = await Promise.allSettled(Array.from({ length: 20 }, (_, index) =>
      service!.report(input(
        FIXTURES.race.room,
        `order235-race-${String(index).padStart(2, "0")}`,
        "occupied",
        (index % 9) + 1,
      )),
    ));
    const fulfilled = settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
    expect(fulfilled).toHaveLength(20);
    expect(fulfilled.filter(({ created }) => created)).toHaveLength(1);
    expect(new Set(fulfilled.map(({ discrepancy }) => discrepancy!.discrepancyId)).size).toBe(1);
    const discrepancyId = fulfilled[0]!.discrepancy!.discrepancyId;
    const evidence = await deploy!<Array<{ discrepancies: number; facts: number; events: number }>>`SELECT
      (SELECT count(*)::int FROM discrepancy WHERE tenant_id=${TENANT}::uuid
        AND space_id=${FIXTURES.race.room}::uuid AND resolved_at IS NULL) discrepancies,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
        AND entity_id=${discrepancyId}::uuid AND fact_type='discrepancy.reported') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid
        AND aggregate_id=${discrepancyId}::uuid AND event_type='discrepancy.reported') events`;
    expect(evidence).toEqual([{ discrepancies: 1, facts: 1, events: 1 }]);
  });
});
