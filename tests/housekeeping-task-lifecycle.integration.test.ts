import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  HousekeepingConflictError,
  HousekeepingNotFoundError,
  HousekeepingTaskService,
  HousekeepingValidationError,
  type HousekeepingTaskAction,
  type HousekeepingTaskStatus,
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
const RUNTIME_URL = process.env.YELLOW_HOUSEKEEPING_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_HOUSEKEEPING === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_HOUSEKEEPING_URL (or YELLOW_RUNTIME_DATABASE_URL) are required");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000021001";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000021002";
const PROPERTY = "00000000-0000-0000-0000-000000021011";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000021012";
const ACTOR = "00000000-0000-0000-0000-000000021021";
const INACTIVE_ACTOR = "00000000-0000-0000-0000-000000021022";
const FOREIGN_ACTOR = "00000000-0000-0000-0000-000000021023";
const ATTENDANT = "00000000-0000-0000-0000-000000021031";
const FOREIGN_ATTENDANT = "00000000-0000-0000-0000-000000021032";

const TASKS = Object.freeze({
  assigned: "00000000-0000-0000-0000-000000021081",
  dirty: "00000000-0000-0000-0000-000000021082",
  pickup: "00000000-0000-0000-0000-000000021083",
  verify: "00000000-0000-0000-0000-000000021084",
  rollback: "00000000-0000-0000-0000-000000021085",
  race: "00000000-0000-0000-0000-000000021086",
  wrongKind: "00000000-0000-0000-0000-000000021087",
  wrongSubject: "00000000-0000-0000-0000-000000021088",
  noCondition: "00000000-0000-0000-0000-000000021089",
  inactiveActor: "00000000-0000-0000-0000-00000002108a",
  replay: "00000000-0000-0000-0000-00000002108b",
  foreign: "00000000-0000-0000-0000-00000002108c",
});

const SPACES = Object.freeze({
  assigned: "00000000-0000-0000-0000-000000021061",
  dirty: "00000000-0000-0000-0000-000000021062",
  pickup: "00000000-0000-0000-0000-000000021063",
  verify: "00000000-0000-0000-0000-000000021064",
  rollback: "00000000-0000-0000-0000-000000021065",
  race: "00000000-0000-0000-0000-000000021066",
  wrongKind: "00000000-0000-0000-0000-000000021067",
  wrongSubject: "00000000-0000-0000-0000-000000021068",
  noCondition: "00000000-0000-0000-0000-000000021069",
  inactiveActor: "00000000-0000-0000-0000-00000002106a",
  replay: "00000000-0000-0000-0000-00000002106b",
  foreign: "00000000-0000-0000-0000-00000002106c",
});

const UPDATED = Object.freeze({
  assigned: "2026-08-28T00:00:00.000Z",
  dirty: "2026-08-28T00:01:00.000Z",
  pickup: "2026-08-28T00:02:00.000Z",
  verify: "2026-08-28T00:03:00.000Z",
  rollback: "2026-08-28T00:04:00.000Z",
  race: "2026-08-28T00:05:00.000Z",
  wrongKind: "2026-08-28T00:06:00.000Z",
  wrongSubject: "2026-08-28T00:07:00.000Z",
  inactiveActor: "2026-08-28T00:08:00.000Z",
  replay: "2026-08-28T00:09:00.000Z",
  foreign: "2026-08-28T00:10:00.000Z",
});

let deploy: SQL | undefined;
let directRuntime: SQL | undefined;
let database: Database | undefined;
let eventPool: SQL | undefined;
let service: HousekeepingTaskService | undefined;

function audit(requestId = crypto.randomUUID(), actorId = ACTOR, tenantId = TENANT, propertyNode = PROPERTY) {
  return createAuditEnvelope({
    actorId, tenantId, propertyNode, requestId, operation: "task.status_changed",
  });
}

function command(input: {
  taskId: string;
  action: HousekeepingTaskAction;
  expectedTaskStatus: HousekeepingTaskStatus;
  expectedRoomCondition: "clean" | "dirty" | "pickup" | "inspected";
  expectedRoomUpdatedAt: string;
  key: string;
  envelope?: ReturnType<typeof audit>;
  tenantId?: string;
  propertyNode?: string;
}) {
  const envelope = input.envelope ?? audit();
  return service!.transition({
    tenantId: input.tenantId ?? TENANT,
    propertyNode: input.propertyNode ?? PROPERTY,
    taskId: input.taskId,
    action: input.action,
    expectedTaskStatus: input.expectedTaskStatus,
    expectedRoomCondition: input.expectedRoomCondition,
    expectedRoomUpdatedAt: input.expectedRoomUpdatedAt,
    idempotencyKey: input.key,
    envelope,
  });
}

async function taskState(taskId: string) {
  return (await deploy!<Array<{
    status: string; completed_at: Date | null; condition: string | null;
    updated_at: Date | null; updated_by: string | null;
  }>>`
    SELECT task.status, task.completed_at, condition.condition,
           condition.updated_at, condition.updated_by
    FROM task
    LEFT JOIN unit_condition AS condition
      ON condition.tenant_id = task.tenant_id AND condition.space_id = task.subject_id
    WHERE task.tenant_id = ${TENANT}::uuid AND task.id = ${taskId}::uuid
  `)[0];
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
  await deploy`DELETE FROM api_idempotency WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM outbox WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM fact_log WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM task WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM unit_condition WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM space WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM party WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM app_user WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM org_node WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
}

databaseDescribe("Order 201 governed housekeeping task lifecycle", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 8, prepare: false });
    directRuntime = new SQL(RUNTIME_URL!, { max: 4, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 8, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 40, prepare: false });
    service = new HousekeepingTaskService({
      database,
      events: new PostgresEventBus(eventPool),
      idempotency: new PostgresIdempotency(),
    });
    await cleanup();

    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT}::uuid,'order201','Order 201','shared','active'),
      (${FOREIGN_TENANT}::uuid,'order201-foreign','Order 201 Foreign','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY}::uuid,${TENANT}::uuid,'order201.property'::ltree,'property','Order 201 Property','Asia/Kolkata','INR'),
      (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order201_foreign.property'::ltree,'property','Foreign Property','UTC','USD')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR}::uuid,${TENANT}::uuid,'actor@order201.local','Actor','active'),
      (${INACTIVE_ACTOR}::uuid,${TENANT}::uuid,'inactive@order201.local','Inactive','disabled'),
      (${FOREIGN_ACTOR}::uuid,${FOREIGN_TENANT}::uuid,'foreign@order201.local','Foreign','active')`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
      (${ATTENDANT}::uuid,${TENANT}::uuid,'person','Attendant','active'),
      (${FOREIGN_ATTENDANT}::uuid,${FOREIGN_TENANT}::uuid,'person','Foreign Attendant','active')`;

    await deploy`INSERT INTO space(id,tenant_id,property_node,code,profile_key,status,floor) VALUES
      (${SPACES.assigned}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'201-A','standard','active','1'),
      (${SPACES.dirty}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'201-D','standard','active','1'),
      (${SPACES.pickup}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'201-P','standard','active','2'),
      (${SPACES.verify}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'201-V','standard','active','2'),
      (${SPACES.rollback}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'201-B','standard','active','3'),
      (${SPACES.race}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'201-R','standard','active','3'),
      (${SPACES.wrongKind}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'201-WK','standard','active','4'),
      (${SPACES.wrongSubject}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'201-WS','standard','active','4'),
      (${SPACES.noCondition}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'201-N','standard','active','5'),
      (${SPACES.inactiveActor}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'201-I','standard','active','5'),
      (${SPACES.replay}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'201-E','standard','active','6'),
      (${SPACES.foreign}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'201-F','standard','active','1')`;
    await deploy`INSERT INTO unit_condition(tenant_id,space_id,condition,updated_at) VALUES
      (${TENANT}::uuid,${SPACES.assigned}::uuid,'dirty',${UPDATED.assigned}::timestamptz),
      (${TENANT}::uuid,${SPACES.dirty}::uuid,'dirty',${UPDATED.dirty}::timestamptz),
      (${TENANT}::uuid,${SPACES.pickup}::uuid,'pickup',${UPDATED.pickup}::timestamptz),
      (${TENANT}::uuid,${SPACES.verify}::uuid,'clean',${UPDATED.verify}::timestamptz),
      (${TENANT}::uuid,${SPACES.rollback}::uuid,'dirty',${UPDATED.rollback}::timestamptz),
      (${TENANT}::uuid,${SPACES.race}::uuid,'dirty',${UPDATED.race}::timestamptz),
      (${TENANT}::uuid,${SPACES.wrongKind}::uuid,'dirty',${UPDATED.wrongKind}::timestamptz),
      (${TENANT}::uuid,${SPACES.wrongSubject}::uuid,'dirty',${UPDATED.wrongSubject}::timestamptz),
      (${TENANT}::uuid,${SPACES.inactiveActor}::uuid,'dirty',${UPDATED.inactiveActor}::timestamptz),
      (${TENANT}::uuid,${SPACES.replay}::uuid,'dirty',${UPDATED.replay}::timestamptz),
      (${FOREIGN_TENANT}::uuid,${SPACES.foreign}::uuid,'dirty',${UPDATED.foreign}::timestamptz)`;
    await deploy`INSERT INTO task(id,tenant_id,property_node,kind,status,subject_type,subject_id,assignee_party,priority,completed_at) VALUES
      (${TASKS.assigned}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','assigned','space',${SPACES.assigned}::uuid,${ATTENDANT}::uuid,1,NULL),
      (${TASKS.dirty}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','in_progress','space',${SPACES.dirty}::uuid,${ATTENDANT}::uuid,1,NULL),
      (${TASKS.pickup}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','in_progress','space',${SPACES.pickup}::uuid,${ATTENDANT}::uuid,2,NULL),
      (${TASKS.verify}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','done','space',${SPACES.verify}::uuid,${ATTENDANT}::uuid,2,'2026-08-28T00:03:30Z'),
      (${TASKS.rollback}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','in_progress','space',${SPACES.rollback}::uuid,${ATTENDANT}::uuid,3,NULL),
      (${TASKS.race}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','in_progress','space',${SPACES.race}::uuid,${ATTENDANT}::uuid,3,NULL),
      (${TASKS.wrongKind}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'work_order','in_progress','space',${SPACES.wrongKind}::uuid,${ATTENDANT}::uuid,4,NULL),
      (${TASKS.wrongSubject}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','in_progress','party',${SPACES.wrongSubject}::uuid,${ATTENDANT}::uuid,4,NULL),
      (${TASKS.noCondition}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','in_progress','space',${SPACES.noCondition}::uuid,${ATTENDANT}::uuid,5,NULL),
      (${TASKS.inactiveActor}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','in_progress','space',${SPACES.inactiveActor}::uuid,${ATTENDANT}::uuid,5,NULL),
      (${TASKS.replay}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','assigned','space',${SPACES.replay}::uuid,${ATTENDANT}::uuid,6,NULL),
      (${TASKS.foreign}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'housekeeping','in_progress','space',${SPACES.foreign}::uuid,${FOREIGN_ATTENDANT}::uuid,1,NULL)`;
  });

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await eventPool?.close({ timeout: 0 });
    await directRuntime?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
    database = undefined;
    eventPool = undefined;
    directRuntime = undefined;
    deploy = undefined;
    service = undefined;
  });

  test("P1 capability is owner-contained and direct task/condition DML stays denied", async () => {
    const capability = await deploy!<Array<{
      owner: string; security_definer: boolean; config: string[]; app_execute: boolean;
      runtime_execute: boolean; public_execute: boolean;
    }>>`
      SELECT pg_get_userbyid(proowner) AS owner, prosecdef AS security_definer,
             proconfig AS config,
             has_function_privilege('app_role',oid,'EXECUTE') AS app_execute,
             has_function_privilege('yellow_runtime',oid,'EXECUTE') AS runtime_execute,
             has_function_privilege('public',oid,'EXECUTE') AS public_execute
      FROM pg_proc
      WHERE oid = 'public.transition_housekeeping_task(uuid,uuid,uuid,text,text,text,timestamptz,uuid)'::regprocedure
    `;
    expect(capability).toEqual([{
      owner: "yellow_owner",
      security_definer: true,
      config: ["search_path=pg_catalog, public, pg_temp"],
      app_execute: true,
      runtime_execute: false,
      public_execute: false,
    }]);
    await expectSqlState(directRuntime!`SELECT * FROM transition_housekeeping_task(
      ${TENANT}::uuid,${PROPERTY}::uuid,${TASKS.assigned}::uuid,
      'start','assigned','dirty',${UPDATED.assigned}::timestamptz,${ACTOR}::uuid
    )`, "42501");

    const connection = await directRuntime!.reserve();
    try {
      await connection.unsafe("BEGIN");
      await connection`SELECT set_config('app.tenant_id',${TENANT},true)`;
      await connection.unsafe("SET LOCAL ROLE app_role");
      await expectSqlState(
        connection`UPDATE task SET status='done' WHERE id=${TASKS.assigned}::uuid`,
        "42501",
      );
      await connection.unsafe("ROLLBACK");
    } finally {
      connection.release();
    }
  });

  test("P2 bounded board and exact adjacent lifecycle retain actor/time evidence", async () => {
    const board = await service!.listBoard({ tenantId: TENANT, propertyNode: PROPERTY, limit: 100 });
    expect(board.find((item) => item.taskId === TASKS.assigned)?.eligibleAction).toBe("start");
    expect(board.find((item) => item.taskId === TASKS.dirty)?.eligibleAction).toBe("complete");
    expect(board.find((item) => item.taskId === TASKS.verify)?.eligibleAction).toBe("verify");
    expect(board.every((item) => item.taskId !== TASKS.wrongKind)).toBe(true);

    const started = await command({
      taskId: TASKS.assigned, action: "start", expectedTaskStatus: "assigned",
      expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED.assigned,
      key: "order201-start-assigned",
    });
    expect(started).toMatchObject({ taskStatus: "in_progress", roomCondition: "dirty", replayed: false });
    expect(started.roomUpdatedAt).toBe(UPDATED.assigned);

    const completed = await command({
      taskId: TASKS.dirty, action: "complete", expectedTaskStatus: "in_progress",
      expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED.dirty,
      key: "order201-complete-dirty",
    });
    expect(completed).toMatchObject({ taskStatus: "done", roomCondition: "clean", eligibleAction: "verify" });
    expect(completed.completedAt).not.toBeNull();

    const pickup = await command({
      taskId: TASKS.pickup, action: "complete", expectedTaskStatus: "in_progress",
      expectedRoomCondition: "pickup", expectedRoomUpdatedAt: UPDATED.pickup,
      key: "order201-complete-pickup",
    });
    expect(pickup).toMatchObject({ taskStatus: "done", roomCondition: "clean" });

    const verified = await command({
      taskId: TASKS.verify, action: "verify", expectedTaskStatus: "done",
      expectedRoomCondition: "clean", expectedRoomUpdatedAt: UPDATED.verify,
      key: "order201-verify-clean",
    });
    expect(verified).toMatchObject({ taskStatus: "verified", roomCondition: "inspected", eligibleAction: null });
    const state = await taskState(TASKS.verify);
    expect(state?.updated_by).toBe(ACTOR);
    expect(state?.updated_at?.toISOString()).toBe(verified.roomUpdatedAt);

    const evidence = await deploy!<Array<{ fact_types: string[]; event_types: string[]; actors: string[] }>>`
      SELECT
        ARRAY(SELECT fact_type FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id=${TASKS.verify}::uuid ORDER BY fact_type) AS fact_types,
        ARRAY(SELECT event_type FROM outbox WHERE tenant_id=${TENANT}::uuid AND (aggregate_id=${TASKS.verify}::uuid OR aggregate_id=${SPACES.verify}::uuid) ORDER BY event_type) AS event_types,
        ARRAY(SELECT DISTINCT actor_id::text FROM fact_log WHERE tenant_id=${TENANT}::uuid AND (entity_id=${TASKS.verify}::uuid OR entity_id=${SPACES.verify}::uuid)) AS actors
    `;
    expect(evidence).toEqual([{
      fact_types: ["task.status_changed"],
      event_types: ["task.status_changed", "unit.condition_changed"],
      actors: [ACTOR],
    }]);
    const conditionFacts = await deploy!<{ fact_type: string; business_date: string }[]>`
      SELECT fact_type, business_date::text FROM fact_log
      WHERE tenant_id=${TENANT}::uuid AND entity_id=${SPACES.verify}::uuid
    `;
    expect(conditionFacts).toEqual([{
      fact_type: "unit.condition_changed",
      business_date: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    }]);
  });

  test("P3 publication failure rolls task, condition, facts, events and idempotency back", async () => {
    const failingEvents: EventBus = {
      publish: async (_tx: Tx, _event: PublishEventInput) => { throw new Error("injected housekeeping publication failure"); },
      consumeBatch: async () => { throw new Error("unused"); },
    };
    const failingService = new HousekeepingTaskService({
      database: database!, events: failingEvents, idempotency: new PostgresIdempotency(),
    });
    await expect(failingService.transition({
      tenantId: TENANT, propertyNode: PROPERTY, taskId: TASKS.rollback,
      action: "complete", expectedTaskStatus: "in_progress", expectedRoomCondition: "dirty",
      expectedRoomUpdatedAt: UPDATED.rollback, idempotencyKey: "order201-rollback-publish",
      envelope: audit(),
    })).rejects.toThrow("injected housekeeping publication failure");
    expect(await taskState(TASKS.rollback)).toMatchObject({ status: "in_progress", condition: "dirty" });
    const artifacts = await deploy!<{ facts: number; events: number; claims: number }[]>`
      SELECT
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id IN (${TASKS.rollback}::uuid,${SPACES.rollback}::uuid)) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_id IN (${TASKS.rollback}::uuid,${SPACES.rollback}::uuid)) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation='housekeeping.task.transition' AND response_status IS NULL) AS claims
    `;
    expect(artifacts).toEqual([{ facts: 0, events: 0, claims: 0 }]);
  });

  test("P4 stale, malformed, inactive and foreign targets fail closed without mutation", async () => {
    await expect(command({
      taskId: TASKS.wrongKind, action: "complete", expectedTaskStatus: "in_progress",
      expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED.wrongKind,
      key: "order201-wrong-kind",
    })).rejects.toBeInstanceOf(HousekeepingNotFoundError);
    await expect(command({
      taskId: TASKS.wrongSubject, action: "complete", expectedTaskStatus: "in_progress",
      expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED.wrongSubject,
      key: "order201-wrong-subject",
    })).rejects.toBeInstanceOf(HousekeepingNotFoundError);
    await expect(command({
      taskId: TASKS.noCondition, action: "complete", expectedTaskStatus: "in_progress",
      expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED.wrongSubject,
      key: "order201-no-condition",
    })).rejects.toBeInstanceOf(HousekeepingNotFoundError);
    await expect(command({
      taskId: TASKS.inactiveActor, action: "complete", expectedTaskStatus: "in_progress",
      expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED.inactiveActor,
      key: "order201-inactive-actor", envelope: audit(crypto.randomUUID(), INACTIVE_ACTOR),
    })).rejects.toBeInstanceOf(HousekeepingNotFoundError);
    await expect(command({
      taskId: TASKS.foreign, action: "complete", expectedTaskStatus: "in_progress",
      expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED.foreign,
      key: "order201-foreign-task",
    })).rejects.toBeInstanceOf(HousekeepingNotFoundError);
    await expect(command({
      taskId: TASKS.rollback, action: "complete", expectedTaskStatus: "in_progress",
      expectedRoomCondition: "dirty", expectedRoomUpdatedAt: "2026-08-28T00:04:00.001Z",
      key: "order201-stale-time",
    })).rejects.toBeInstanceOf(HousekeepingConflictError);
    await expect(command({
      taskId: TASKS.rollback, action: "complete", expectedTaskStatus: "done",
      expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED.rollback,
      key: "order201-bad-adjacent",
    })).rejects.toBeInstanceOf(HousekeepingValidationError);
    expect(await taskState(TASKS.rollback)).toMatchObject({ status: "in_progress", condition: "dirty" });
  });

  test("P5 exact replay is stable, drift conflicts and twenty contenders have one winner", async () => {
    const requestId = crypto.randomUUID();
    const first = await command({
      taskId: TASKS.replay, action: "start", expectedTaskStatus: "assigned",
      expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED.replay,
      key: "order201-exact-replay", envelope: audit(requestId),
    });
    const replay = await command({
      taskId: TASKS.replay, action: "start", expectedTaskStatus: "assigned",
      expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED.replay,
      key: "order201-exact-replay", envelope: audit(requestId),
    });
    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ ...first, replayed: true });
    await expect(command({
      taskId: TASKS.assigned, action: "start", expectedTaskStatus: "assigned",
      expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED.assigned,
      key: "order201-exact-replay", envelope: audit(requestId),
    })).rejects.toBeInstanceOf(HousekeepingConflictError);

    const contenders = await Promise.allSettled(Array.from({ length: 20 }, (_, index) => command({
      taskId: TASKS.race, action: "complete", expectedTaskStatus: "in_progress",
      expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED.race,
      key: `order201-race-${String(index).padStart(2, "0")}`,
    })));
    expect(contenders.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(contenders.filter((result) => result.status === "rejected")).toHaveLength(19);
    expect(await taskState(TASKS.race)).toMatchObject({ status: "done", condition: "clean" });
    const effects = await deploy!<{ facts: number; events: number }[]>`
      SELECT
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id IN (${TASKS.race}::uuid,${SPACES.race}::uuid)) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_id IN (${TASKS.race}::uuid,${SPACES.race}::uuid)) AS events
    `;
    expect(effects).toEqual([{ facts: 2, events: 2 }]);
  });
});
