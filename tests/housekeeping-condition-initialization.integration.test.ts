import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  HousekeepingConflictError,
  HousekeepingNotFoundError,
  HousekeepingTaskService,
  HousekeepingValidationError,
  type HousekeepingInitialCondition,
} from "../src/contexts/housekeeping";
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
const RUNTIME_URL = process.env.YELLOW_HOUSEKEEPING_INITIALIZATION_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_HOUSEKEEPING_INITIALIZATION === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error(
    "YELLOW_DEPLOY_DATABASE_URL and YELLOW_HOUSEKEEPING_INITIALIZATION_URL " +
    "(or YELLOW_RUNTIME_DATABASE_URL) are required",
  );
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000027001";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000027002";
const PROPERTY = "00000000-0000-0000-0000-000000027011";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000027012";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000027013";
const ACTOR = "00000000-0000-0000-0000-000000027021";
const OTHER_ACTOR = "00000000-0000-0000-0000-000000027022";
const INACTIVE_ACTOR = "00000000-0000-0000-0000-000000027023";
const FOREIGN_ACTOR = "00000000-0000-0000-0000-000000027024";

const SPACES = Object.freeze({
  clean: "00000000-0000-0000-0000-000000027061",
  dirty: "00000000-0000-0000-0000-000000027062",
  pickup: "00000000-0000-0000-0000-000000027063",
  existing: "00000000-0000-0000-0000-000000027064",
  replay: "00000000-0000-0000-0000-000000027065",
  rollback: "00000000-0000-0000-0000-000000027066",
  race: "00000000-0000-0000-0000-000000027067",
  inspected: "00000000-0000-0000-0000-000000027068",
  inactive: "00000000-0000-0000-0000-000000027069",
  wrongProperty: "00000000-0000-0000-0000-00000002706a",
  foreign: "00000000-0000-0000-0000-00000002706b",
});

let deploy: SQL | undefined;
let directRuntime: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let service: HousekeepingTaskService | undefined;

function audit(
  requestId = crypto.randomUUID(),
  actorId = ACTOR,
  tenantId = TENANT,
  propertyNode = PROPERTY,
) {
  return createAuditEnvelope({
    actorId,
    tenantId,
    propertyNode,
    requestId,
    operation: "unit.condition_changed",
  });
}

function command(input: {
  readonly spaceId: string;
  readonly roomCondition: HousekeepingInitialCondition;
  readonly key: string;
  readonly envelope?: ReturnType<typeof audit>;
  readonly tenantId?: string;
  readonly propertyNode?: string;
}) {
  const envelope = input.envelope ?? audit();
  return service!.initializeCondition({
    tenantId: input.tenantId ?? TENANT,
    propertyNode: input.propertyNode ?? PROPERTY,
    spaceId: input.spaceId,
    expectedRoomCondition: null,
    roomCondition: input.roomCondition,
    idempotencyKey: input.key,
    envelope,
  });
}

async function expectSqlState(operation: PromiseLike<unknown>, sqlState: string): Promise<void> {
  try {
    await operation;
    throw new Error(`expected SQLSTATE ${sqlState}`);
  } catch (error) {
    expect(error).toMatchObject({ errno: sqlState });
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

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await deploy`DELETE FROM api_idempotency WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM outbox WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM fact_log WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM unit_condition WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM space WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM app_user WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM org_node WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
}

databaseDescribe("Order 227 governed initial room condition", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 12, prepare: false });
    directRuntime = new SQL(RUNTIME_URL!, { max: 4, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 12, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 40, prepare: false });
    service = new HousekeepingTaskService({
      database,
      events: new PostgresEventBus(eventPool),
      idempotency: new PostgresIdempotency(),
    });
    await cleanup();

    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT}::uuid,'order227','Order 227','shared','active'),
      (${FOREIGN_TENANT}::uuid,'order227-foreign','Order 227 Foreign','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY}::uuid,${TENANT}::uuid,'order227.property'::ltree,'property','Order 227 Property','Asia/Kolkata','INR'),
      (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order227.other_property'::ltree,'property','Other Property','UTC','USD'),
      (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order227_foreign.property'::ltree,'property','Foreign Property','UTC','USD')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR}::uuid,${TENANT}::uuid,'actor@order227.local','Actor','active'),
      (${OTHER_ACTOR}::uuid,${TENANT}::uuid,'other-actor@order227.local','Other Actor','active'),
      (${INACTIVE_ACTOR}::uuid,${TENANT}::uuid,'inactive@order227.local','Inactive','disabled'),
      (${FOREIGN_ACTOR}::uuid,${FOREIGN_TENANT}::uuid,'foreign@order227.local','Foreign','active')`;
    await deploy`INSERT INTO space(id,tenant_id,property_node,code,profile_key,status,floor) VALUES
      (${SPACES.clean}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'227-C','standard','active','1'),
      (${SPACES.dirty}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'227-D','standard','active','1'),
      (${SPACES.pickup}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'227-P','standard','active','2'),
      (${SPACES.existing}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'227-E','standard','active','2'),
      (${SPACES.replay}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'227-RP','standard','active','3'),
      (${SPACES.rollback}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'227-B','standard','active','3'),
      (${SPACES.race}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'227-R','standard','active','4'),
      (${SPACES.inspected}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'227-I','standard','active','4'),
      (${SPACES.inactive}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'227-X','standard','inactive','5'),
      (${SPACES.wrongProperty}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'227-W','standard','active','1'),
      (${SPACES.foreign}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'227-F','standard','active','1')`;
    await deploy`INSERT INTO unit_condition(tenant_id,space_id,condition,updated_at) VALUES
      (${TENANT}::uuid,${SPACES.existing}::uuid,'clean','2026-08-28T00:00:00Z')`;
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

  test("P1 capability is exact and all direct condition DML stays denied", async () => {
    const capability = await deploy!<Array<{
      owner: string;
      security_definer: boolean;
      config: string[];
      app_execute: boolean;
      runtime_execute: boolean;
      public_execute: boolean;
    }>>`
      SELECT pg_get_userbyid(proowner) AS owner, prosecdef AS security_definer,
             proconfig AS config,
             has_function_privilege('app_role',oid,'EXECUTE') AS app_execute,
             has_function_privilege('yellow_runtime',oid,'EXECUTE') AS runtime_execute,
             has_function_privilege('public',oid,'EXECUTE') AS public_execute
      FROM pg_proc
      WHERE oid = 'public.initialize_unit_condition(uuid,uuid,uuid,text,uuid)'::regprocedure
    `;
    expect(capability).toEqual([{
      owner: "yellow_owner",
      security_definer: true,
      config: ["search_path=pg_catalog, public, pg_temp"],
      app_execute: true,
      runtime_execute: false,
      public_execute: false,
    }]);

    await expectSqlState(directRuntime!`SELECT * FROM public.initialize_unit_condition(
      ${TENANT}::uuid,${PROPERTY}::uuid,${SPACES.clean}::uuid,'clean',${ACTOR}::uuid
    )`, "42501");
    await expectAppRoleDenied(`INSERT INTO public.unit_condition(tenant_id,space_id,condition)
      VALUES ('${TENANT}'::uuid,'${SPACES.clean}'::uuid,'clean')`);
    await expectAppRoleDenied(`UPDATE public.unit_condition SET condition='dirty'
      WHERE tenant_id='${TENANT}'::uuid AND space_id='${SPACES.existing}'::uuid`);
    await expectAppRoleDenied(`DELETE FROM public.unit_condition
      WHERE tenant_id='${TENANT}'::uuid AND space_id='${SPACES.existing}'::uuid`);
    await expectAppRoleDenied("TRUNCATE public.unit_condition");
  });

  test("P2 clean, dirty and pickup each insert one attributable canonical row; inspected is excluded", async () => {
    for (const [name, spaceId] of [
      ["clean", SPACES.clean],
      ["dirty", SPACES.dirty],
      ["pickup", SPACES.pickup],
    ] as const) {
      const result = await command({
        spaceId,
        roomCondition: name,
        key: `order227-initialize-${name}`,
      });
      expect(result).toMatchObject({
        spaceId,
        roomCondition: name,
        replayed: false,
      });
      expect(new Date(result.roomUpdatedAt).toISOString()).toBe(result.roomUpdatedAt);
      const rows = await deploy!<Array<{
        tenant_id: string;
        condition: string;
        updated_at: Date;
        updated_by: string;
      }>>`
        SELECT tenant_id, condition, updated_at, updated_by
        FROM unit_condition
        WHERE space_id=${spaceId}::uuid
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ tenant_id: TENANT, condition: name, updated_by: ACTOR });
      expect(rows[0]!.updated_at.toISOString()).toBe(result.roomUpdatedAt);
    }

    await expect(service!.initializeCondition({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      spaceId: SPACES.inspected,
      expectedRoomCondition: null,
      roomCondition: "inspected" as never,
      idempotencyKey: "order227-inspected-denied",
      envelope: audit(),
    })).rejects.toBeInstanceOf(HousekeepingValidationError);
    expect(await deploy!`SELECT 1 FROM unit_condition WHERE space_id=${SPACES.inspected}::uuid`).toHaveLength(0);
  });

  test("P2 existing, inactive, wrong-property, foreign and inactive-actor targets write nothing", async () => {
    const before = await deploy!`SELECT tenant_id,space_id,condition,updated_at,updated_by
      FROM unit_condition WHERE space_id=${SPACES.existing}::uuid`;
    await expect(command({
      spaceId: SPACES.existing,
      roomCondition: "dirty",
      key: "order227-existing-row",
    })).rejects.toBeInstanceOf(HousekeepingConflictError);
    expect(await deploy!`SELECT tenant_id,space_id,condition,updated_at,updated_by
      FROM unit_condition WHERE space_id=${SPACES.existing}::uuid`).toEqual(before);

    for (const [label, spaceId, envelope] of [
      ["inactive-space", SPACES.inactive, audit()],
      ["wrong-property", SPACES.wrongProperty, audit()],
      ["foreign-space", SPACES.foreign, audit()],
      ["inactive-actor", SPACES.inspected, audit(crypto.randomUUID(), INACTIVE_ACTOR)],
    ] as const) {
      await expect(command({
        spaceId,
        roomCondition: "clean",
        key: `order227-${label}`,
        envelope,
      })).rejects.toBeInstanceOf(HousekeepingNotFoundError);
    }

    const counts = await deploy!<Array<{ conditions: number; facts: number; events: number; keys: number }>>`
      SELECT
        (SELECT count(*)::int FROM unit_condition WHERE space_id IN (
          ${SPACES.inactive}::uuid,${SPACES.wrongProperty}::uuid,
          ${SPACES.foreign}::uuid,${SPACES.inspected}::uuid
        )) AS conditions,
        (SELECT count(*)::int FROM fact_log WHERE entity_id IN (
          ${SPACES.inactive}::uuid,${SPACES.wrongProperty}::uuid,
          ${SPACES.foreign}::uuid,${SPACES.inspected}::uuid
        )) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id IN (
          ${SPACES.inactive}::uuid,${SPACES.wrongProperty}::uuid,
          ${SPACES.foreign}::uuid,${SPACES.inspected}::uuid
        )) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid
          AND operation='housekeeping.condition.initialize'
          AND response_status IS NULL) AS keys
    `;
    expect(counts).toEqual([{ conditions: 0, facts: 0, events: 0, keys: 0 }]);
  });

  test("P3 exact replay is stable and actor, property, space or condition mismatch conflicts", async () => {
    const envelope = audit();
    const original = await command({
      spaceId: SPACES.replay,
      roomCondition: "clean",
      key: "order227-exact-replay",
      envelope,
    });
    const replay = await command({
      spaceId: SPACES.replay,
      roomCondition: "clean",
      key: "order227-exact-replay",
      envelope,
    });
    expect(replay).toEqual({ ...original, replayed: true });

    for (const mismatch of [
      { spaceId: SPACES.race, roomCondition: "clean" as const, envelope },
      { spaceId: SPACES.replay, roomCondition: "dirty" as const, envelope },
      { spaceId: SPACES.replay, roomCondition: "clean" as const,
        envelope: audit(crypto.randomUUID(), OTHER_ACTOR) },
      { spaceId: SPACES.replay, roomCondition: "clean" as const,
        envelope: audit(crypto.randomUUID(), ACTOR, TENANT, OTHER_PROPERTY), propertyNode: OTHER_PROPERTY },
    ]) {
      await expect(command({
        ...mismatch,
        key: "order227-exact-replay",
      })).rejects.toBeInstanceOf(HousekeepingConflictError);
    }

    const evidence = await deploy!<Array<{ conditions: number; facts: number; events: number; keys: number }>>`
      SELECT
        (SELECT count(*)::int FROM unit_condition WHERE space_id=${SPACES.replay}::uuid) AS conditions,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${SPACES.replay}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${SPACES.replay}::uuid) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid
          AND operation='housekeeping.condition.initialize'
          AND key_hash=encode(digest('order227-exact-replay','sha256'),'hex')) AS keys
    `;
    expect(evidence).toEqual([{ conditions: 1, facts: 1, events: 1, keys: 1 }]);
    expect(await deploy!`SELECT 1 FROM unit_condition WHERE space_id=${SPACES.race}::uuid`).toHaveLength(0);
  });

  test("P3 twenty distinct contenders converge to one row, fact and outbox event", async () => {
    const contenders = await Promise.allSettled(Array.from({ length: 20 }, (_, index) => command({
      spaceId: SPACES.race,
      roomCondition: "pickup",
      key: `order227-race-${String(index).padStart(2, "0")}`,
      envelope: audit(),
    })));
    expect(contenders.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(contenders.filter(({ status }) => status === "rejected")).toHaveLength(19);
    for (const rejected of contenders.filter((result) => result.status === "rejected")) {
      expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(HousekeepingConflictError);
    }

    const evidence = await deploy!<Array<{
      conditions: number;
      facts: number;
      events: number;
      keys: number;
      condition: string;
      fact_payload: Record<string, unknown>;
      event_payload: Record<string, unknown>;
    }>>`
      SELECT
        (SELECT count(*)::int FROM unit_condition WHERE space_id=${SPACES.race}::uuid) AS conditions,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${SPACES.race}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${SPACES.race}::uuid) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid
          AND operation='housekeeping.condition.initialize' AND response_status=201
          AND response_body->>'spaceId'=${SPACES.race}) AS keys,
        (SELECT condition FROM unit_condition WHERE space_id=${SPACES.race}::uuid) AS condition,
        (SELECT payload FROM fact_log WHERE entity_id=${SPACES.race}::uuid) AS fact_payload,
        (SELECT payload FROM outbox WHERE aggregate_id=${SPACES.race}::uuid) AS event_payload
    `;
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      conditions: 1,
      facts: 1,
      events: 1,
      keys: 1,
      condition: "pickup",
      fact_payload: { previous_condition: null, current_condition: "pickup" },
      event_payload: { previous_condition: null, current_condition: "pickup" },
    });
    expect(evidence[0]!.fact_payload).toHaveProperty("room_updated_at");
    expect(evidence[0]!.fact_payload).toHaveProperty("request_id");
    expect(evidence[0]!.event_payload).toHaveProperty("room_updated_at");
  });

  test("P4 publication failure rolls condition, fact, event and idempotency back; exact retry succeeds", async () => {
    const failingEvents: EventBus = {
      publish: async (_tx: Tx, _event: PublishEventInput) => {
        throw new Error("injected initial-condition publication failure");
      },
      consumeBatch: async () => { throw new Error("unused"); },
    };
    const failingService = new HousekeepingTaskService({
      database: database!,
      events: failingEvents,
      idempotency: new PostgresIdempotency(),
    });
    const envelope = audit();
    const input = {
      tenantId: TENANT,
      propertyNode: PROPERTY,
      spaceId: SPACES.rollback,
      expectedRoomCondition: null,
      roomCondition: "dirty" as const,
      idempotencyKey: "order227-rollback-retry",
      envelope,
    };
    await expect(failingService.initializeCondition(input)).rejects.toThrow(
      "injected initial-condition publication failure",
    );

    const rolledBack = await deploy!<Array<{ conditions: number; facts: number; events: number; keys: number }>>`
      SELECT
        (SELECT count(*)::int FROM unit_condition WHERE space_id=${SPACES.rollback}::uuid) AS conditions,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${SPACES.rollback}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${SPACES.rollback}::uuid) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid
          AND operation='housekeeping.condition.initialize'
          AND key_hash=encode(digest('order227-rollback-retry','sha256'),'hex')) AS keys
    `;
    expect(rolledBack).toEqual([{ conditions: 0, facts: 0, events: 0, keys: 0 }]);

    const retried = await service!.initializeCondition(input);
    expect(retried).toMatchObject({
      spaceId: SPACES.rollback,
      roomCondition: "dirty",
      replayed: false,
    });
    const committed = await deploy!<Array<{ conditions: number; facts: number; events: number; keys: number }>>`
      SELECT
        (SELECT count(*)::int FROM unit_condition WHERE space_id=${SPACES.rollback}::uuid) AS conditions,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${SPACES.rollback}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=${SPACES.rollback}::uuid) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid
          AND operation='housekeeping.condition.initialize' AND response_status=201
          AND key_hash=encode(digest('order227-rollback-retry','sha256'),'hex')) AS keys
    `;
    expect(committed).toEqual([{ conditions: 1, facts: 1, events: 1, keys: 1 }]);
  });
});
