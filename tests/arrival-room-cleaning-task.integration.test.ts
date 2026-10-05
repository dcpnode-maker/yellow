import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  ArrivalRoomCleaningConflictError,
  ArrivalRoomCleaningNotFoundError,
  ArrivalRoomCleaningTaskService,
  ArrivalRoomCleaningValidationError,
  type ArrivalRoomCleaningCreateInput,
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

setDefaultTimeout(40_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ARRIVAL_ROOM_CLEANING_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ARRIVAL_ROOM_CLEANING === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error(
    "YELLOW_DEPLOY_DATABASE_URL and YELLOW_ARRIVAL_ROOM_CLEANING_URL " +
    "(or YELLOW_RUNTIME_DATABASE_URL) are required",
  );
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000022901";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000022902";
const PROPERTY = "00000000-0000-0000-0000-000000022911";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000022912";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000022913";
const ACTOR = "00000000-0000-0000-0000-000000022921";
const OTHER_ACTOR = "00000000-0000-0000-0000-000000022922";
const INACTIVE_ACTOR = "00000000-0000-0000-0000-000000022923";
const FOREIGN_ACTOR = "00000000-0000-0000-0000-000000022924";
const OVERRIDE_ACTOR = "00000000-0000-0000-0000-000000022925";
const OVERRIDE_ROLE = "00000000-0000-0000-0000-000000022926";
const STAFF = "00000000-0000-0000-0000-000000022931";
const OTHER_STAFF = "00000000-0000-0000-0000-000000022932";
const NON_STAFF = "00000000-0000-0000-0000-000000022933";
const INACTIVE_STAFF = "00000000-0000-0000-0000-000000022934";
const FOREIGN_STAFF = "00000000-0000-0000-0000-000000022935";
const GUEST = "00000000-0000-0000-0000-000000022936";
const FOREIGN_GUEST = "00000000-0000-0000-0000-000000022937";

const UNIT_TYPE = "00000000-0000-0000-0000-000000022941";
const OTHER_UNIT_TYPE = "00000000-0000-0000-0000-000000022942";
const FOREIGN_UNIT_TYPE = "00000000-0000-0000-0000-000000022943";
const RATE_PLAN = "00000000-0000-0000-0000-000000022951";
const OTHER_RATE_PLAN = "00000000-0000-0000-0000-000000022952";
const FOREIGN_RATE_PLAN = "00000000-0000-0000-0000-000000022953";

const FIXTURES = Object.freeze({
  create: {
    reservation: "00000000-0000-0000-0000-000000022961",
    segment: "00000000-0000-0000-0000-000000022962",
    sellable: "00000000-0000-0000-0000-000000022963",
    space: "00000000-0000-0000-0000-000000022964",
  },
  existing: {
    reservation: "00000000-0000-0000-0000-000000022971",
    segment: "00000000-0000-0000-0000-000000022972",
    sellable: "00000000-0000-0000-0000-000000022973",
    space: "00000000-0000-0000-0000-000000022974",
    task: "00000000-0000-0000-0000-000000022975",
  },
  race: {
    reservation: "00000000-0000-0000-0000-000000022981",
    segment: "00000000-0000-0000-0000-000000022982",
    sellable: "00000000-0000-0000-0000-000000022983",
    space: "00000000-0000-0000-0000-000000022984",
  },
  rollback: {
    reservation: "00000000-0000-0000-0000-000000022991",
    segment: "00000000-0000-0000-0000-000000022992",
    sellable: "00000000-0000-0000-0000-000000022993",
    space: "00000000-0000-0000-0000-000000022994",
  },
  hostile: {
    reservation: "00000000-0000-0000-0000-000000023001",
    segment: "00000000-0000-0000-0000-000000023002",
    sellable: "00000000-0000-0000-0000-000000023003",
    space: "00000000-0000-0000-0000-000000023004",
  },
  incoherent: {
    reservation: "00000000-0000-0000-0000-000000023011",
    segment: "00000000-0000-0000-0000-000000023012",
    sellable: "00000000-0000-0000-0000-000000023013",
    space: "00000000-0000-0000-0000-000000023014",
    task1: "00000000-0000-0000-0000-000000023015",
    task2: "00000000-0000-0000-0000-000000023016",
  },
  wrongProperty: {
    reservation: "00000000-0000-0000-0000-000000023021",
    segment: "00000000-0000-0000-0000-000000023022",
    sellable: "00000000-0000-0000-0000-000000023023",
    space: "00000000-0000-0000-0000-000000023024",
  },
  foreign: {
    reservation: "00000000-0000-0000-0000-000000023031",
    segment: "00000000-0000-0000-0000-000000023032",
    sellable: "00000000-0000-0000-0000-000000023033",
    space: "00000000-0000-0000-0000-000000023034",
  },
});

const PERIOD_START = "2020-01-01T14:00:00.123456Z";
const PERIOD_END = "2100-01-01T10:00:00.000000Z";

let deploy: SQL | undefined;
let directRuntime: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let service: ArrivalRoomCleaningTaskService | undefined;

class FailAfterPublishBus implements EventBus {
  constructor(readonly delegate: EventBus) {}

  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, event);
    throw new Error("Order 229 injected publication failure");
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
    operation: "task.created" as const,
  });
}

function input(
  reservationId: string,
  key: string,
  attendantPartyId = STAFF,
  audit = envelope(),
  tenantId = TENANT,
  propertyNode = PROPERTY,
): ArrivalRoomCleaningCreateInput {
  return {
    tenantId,
    propertyNode,
    reservationId,
    attendantPartyId,
    idempotencyKey: key,
    envelope: audit,
  } as unknown as ArrivalRoomCleaningCreateInput;
}

function keyHash(key: string): string {
  return new Bun.CryptoHasher("sha256").update(key).digest("hex");
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

async function cleanup(client = deploy): Promise<void> {
  if (!client) return;
  await client`DELETE FROM api_idempotency WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM outbox WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM fact_log WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM task WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM unit_condition WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM reservation_segment WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM reservation WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM sellable_unit_space WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM sellable_unit WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM space WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM rate_plan WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM unit_type WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM user_role WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM role_permission WHERE role_id=${OVERRIDE_ROLE}::uuid`;
  await client`DELETE FROM role WHERE id=${OVERRIDE_ROLE}::uuid`;
  await client`DELETE FROM party_role WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM party WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM app_user WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM org_node WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM tenant WHERE id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await client`DELETE FROM permission WHERE code='stay-operations.checkin:dirty-room-override'`;
}

describe("Order 229 arrival room cleaning task contract", () => {
  test("migration fixes one least-privilege owner capability and keeps raw task DML revoked", async () => {
    const source = await Bun.file(new URL(
      "../migrations/0032_governed_arrival_room_cleaning_task.sql",
      import.meta.url,
    )).text();
    expect(source).toContain("SECURITY DEFINER");
    expect(source).toContain("SET search_path = pg_catalog, public, pg_temp");
    expect(source).toContain("session_user <> 'yellow_runtime'");
    expect(source).toContain("current_user <> 'yellow_owner'");
    expect(source).toContain("staff.role = 'staff'");
    expect(source).toContain("condition.condition IN ('dirty', 'pickup')");
    expect(source).toContain("task.status IN ('assigned', 'in_progress')");
    expect(source).toContain("REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.task");
    expect(source).not.toContain("INSERT INTO public.fact_log");
    expect(source).not.toContain("INSERT INTO public.outbox");
  });

  test("strict domain input rejects caller-owned surplus truth before database access", async () => {
    const unreachable = new ArrivalRoomCleaningTaskService({
      database: { withTenantTransaction: async () => { throw new Error("database reached"); } } as never,
      events: {} as never,
      idempotency: {} as never,
    });
    await expect(unreachable.create({
      ...input(FIXTURES.create.reservation, "order229-invalid-shape"),
      roomCondition: "dirty",
    } as never)).rejects.toBeInstanceOf(ArrivalRoomCleaningValidationError);
    await expect(unreachable.candidate({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA",
      actorId: ACTOR,
    })).rejects.toBeInstanceOf(ArrivalRoomCleaningValidationError);
  });
});

databaseDescribe("Order 229 fresh-PostgreSQL governed arrival room cleaning task", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 16, prepare: false });
    directRuntime = new SQL(RUNTIME_URL!, { max: 6, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 16, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 48, prepare: false });
    service = new ArrivalRoomCleaningTaskService({
      database,
      events: new PostgresEventBus(eventPool),
      idempotency: new PostgresIdempotency(),
    });
    await cleanup();

    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT}::uuid,'order229','Order 229','shared','active'),
      (${FOREIGN_TENANT}::uuid,'order229-foreign','Order 229 Foreign','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY}::uuid,${TENANT}::uuid,'order229.property'::ltree,'property','Order 229','UTC','USD'),
      (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order229.other'::ltree,'property','Order 229 Other','UTC','USD'),
      (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order229_foreign.property'::ltree,'property','Order 229 Foreign','UTC','USD')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR}::uuid,${TENANT}::uuid,'actor@order229.local','Actor','active'),
      (${OTHER_ACTOR}::uuid,${TENANT}::uuid,'other@order229.local','Other Actor','active'),
      (${INACTIVE_ACTOR}::uuid,${TENANT}::uuid,'inactive@order229.local','Inactive Actor','disabled'),
      (${OVERRIDE_ACTOR}::uuid,${TENANT}::uuid,'override@order229.local','Override Actor','active'),
      (${FOREIGN_ACTOR}::uuid,${FOREIGN_TENANT}::uuid,'foreign@order229.local','Foreign Actor','active')`;
    await deploy`INSERT INTO permission(code,description) VALUES(
      'stay-operations.checkin:dirty-room-override','Override dirty-room check-in blocker')`;
    await deploy`INSERT INTO role(id,tenant_id,name) VALUES(
      ${OVERRIDE_ROLE}::uuid,${TENANT}::uuid,'Order 229 Dirty Room Override')`;
    await deploy`INSERT INTO role_permission(role_id,permission_code) VALUES(
      ${OVERRIDE_ROLE}::uuid,'stay-operations.checkin:dirty-room-override')`;
    await deploy`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(
      ${TENANT}::uuid,${OVERRIDE_ACTOR}::uuid,${OVERRIDE_ROLE}::uuid,${PROPERTY}::uuid)`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
      (${STAFF}::uuid,${TENANT}::uuid,'person','Room Attendant','active'),
      (${OTHER_STAFF}::uuid,${TENANT}::uuid,'person','Other Attendant','active'),
      (${NON_STAFF}::uuid,${TENANT}::uuid,'person','Not Staff','active'),
      (${INACTIVE_STAFF}::uuid,${TENANT}::uuid,'person','Inactive Staff','merged'),
      (${GUEST}::uuid,${TENANT}::uuid,'person','Guest','active'),
      (${FOREIGN_STAFF}::uuid,${FOREIGN_TENANT}::uuid,'person','Foreign Staff','active'),
      (${FOREIGN_GUEST}::uuid,${FOREIGN_TENANT}::uuid,'person','Foreign Guest','active')`;
    await deploy`INSERT INTO party_role(tenant_id,party_id,role) VALUES
      (${TENANT}::uuid,${STAFF}::uuid,'staff'),
      (${TENANT}::uuid,${OTHER_STAFF}::uuid,'staff'),
      (${TENANT}::uuid,${INACTIVE_STAFF}::uuid,'staff'),
      (${TENANT}::uuid,${GUEST}::uuid,'guest'),
      (${FOREIGN_TENANT}::uuid,${FOREIGN_STAFF}::uuid,'staff'),
      (${FOREIGN_TENANT}::uuid,${FOREIGN_GUEST}::uuid,'guest')`;
    await deploy`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key) VALUES
      (${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'STD','Standard','hotel-room'),
      (${OTHER_UNIT_TYPE}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'STD','Standard','hotel-room'),
      (${FOREIGN_UNIT_TYPE}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'STD','Standard','hotel-room')`;
    await deploy`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency) VALUES
      (${RATE_PLAN}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'BAR','BAR','USD'),
      (${OTHER_RATE_PLAN}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'BAR','BAR','USD'),
      (${FOREIGN_RATE_PLAN}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'BAR','BAR','USD')`;

    const rows = Object.entries(FIXTURES);
    for (const [name, fixture] of rows) {
      const foreign = name === "foreign";
      const other = name === "wrongProperty";
      const tenantId = foreign ? FOREIGN_TENANT : TENANT;
      const propertyNode = foreign ? FOREIGN_PROPERTY : other ? OTHER_PROPERTY : PROPERTY;
      const unitType = foreign ? FOREIGN_UNIT_TYPE : other ? OTHER_UNIT_TYPE : UNIT_TYPE;
      const ratePlan = foreign ? FOREIGN_RATE_PLAN : other ? OTHER_RATE_PLAN : RATE_PLAN;
      const guest = foreign ? FOREIGN_GUEST : GUEST;
      await deploy`INSERT INTO space(id,tenant_id,property_node,code,profile_key,status) VALUES(
        ${fixture.space}::uuid,${tenantId}::uuid,${propertyNode}::uuid,
        ${`229-${name}`},'room','active')`;
      await deploy`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES(
        ${fixture.sellable}::uuid,${tenantId}::uuid,${unitType}::uuid,${`229 ${name}`},'active')`;
      await deploy`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode) VALUES(
        ${tenantId}::uuid,${fixture.sellable}::uuid,${fixture.space}::uuid,'exclusive')`;
      await deploy`INSERT INTO reservation(
        id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
      ) VALUES(
        ${fixture.reservation}::uuid,${tenantId}::uuid,${propertyNode}::uuid,
        ${`O229-${name}`},'due_in',${guest}::uuid,'direct','USD')`;
      await deploy`INSERT INTO reservation_segment(
        id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,
        adults,children,rate_plan_id,status
      ) VALUES(
        ${fixture.segment}::uuid,${tenantId}::uuid,${fixture.reservation}::uuid,1,
        ${unitType}::uuid,${fixture.sellable}::uuid,
        tstzrange(${PERIOD_START}::timestamptz,${PERIOD_END}::timestamptz,'[)'),
        1,'[]'::jsonb,${ratePlan}::uuid,'booked')`;
      await deploy`INSERT INTO unit_condition(tenant_id,space_id,condition,updated_by) VALUES(
        ${tenantId}::uuid,${fixture.space}::uuid,
        ${name === "existing" || name === "rollback" ? "pickup" : "dirty"},
        ${foreign ? FOREIGN_ACTOR : ACTOR}::uuid)`;
    }

    await deploy`INSERT INTO task(
      id,tenant_id,property_node,kind,status,subject_type,subject_id,
      assignee_party,department,due_at,priority,payload
    ) VALUES
      (${FIXTURES.existing.task}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,
       'housekeeping','in_progress','space',${FIXTURES.existing.space}::uuid,
       ${OTHER_STAFF}::uuid,'Housekeeping',${PERIOD_START}::timestamptz,1,'{}'::jsonb),
      (${FIXTURES.incoherent.task1}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,
       'housekeeping','assigned','space',${FIXTURES.incoherent.space}::uuid,
       ${STAFF}::uuid,'Housekeeping',${PERIOD_START}::timestamptz,1,'{}'::jsonb),
      (${FIXTURES.incoherent.task2}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,
       'housekeeping','in_progress','space',${FIXTURES.incoherent.space}::uuid,
       ${OTHER_STAFF}::uuid,'Housekeeping',${PERIOD_START}::timestamptz,1,'{}'::jsonb)`;
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

  test("P1 exposes only the exact owner capability and denies direct runtime/task DML", async () => {
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
      WHERE oid = 'public.create_arrival_room_cleaning_task(uuid,uuid,uuid,uuid,uuid)'::regprocedure
    `;
    expect(capability).toEqual([{
      owner: "yellow_owner",
      security_definer: true,
      config: ["search_path=pg_catalog, public, pg_temp"],
      app_execute: true,
      runtime_execute: false,
      public_execute: false,
    }]);
    await expectSqlState(directRuntime!`SELECT * FROM public.create_arrival_room_cleaning_task(
      ${TENANT}::uuid,${PROPERTY}::uuid,${FIXTURES.create.reservation}::uuid,
      ${STAFF}::uuid,${ACTOR}::uuid
    )`, "42501");
    await expectAppRoleDenied(`INSERT INTO public.task(
      tenant_id,property_node,kind,status,subject_type,subject_id
    ) VALUES(
      '${TENANT}'::uuid,'${PROPERTY}'::uuid,'housekeeping','assigned','space',
      '${FIXTURES.create.space}'::uuid
    )`);
    await expectAppRoleDenied(`UPDATE public.task SET status='done'
      WHERE tenant_id='${TENANT}'::uuid AND id='${FIXTURES.existing.task}'::uuid`);
    await expectAppRoleDenied(`DELETE FROM public.task
      WHERE tenant_id='${TENANT}'::uuid AND id='${FIXTURES.existing.task}'::uuid`);
    await expectAppRoleDenied("TRUNCATE public.task");
  });

  test("P2 candidate and creation use exact current arrival/room truth and minimized evidence", async () => {
    expect(await service!.candidate({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: FIXTURES.create.reservation,
      actorId: ACTOR,
    })).toEqual({
      reservationId: FIXTURES.create.reservation,
      spaceId: FIXTURES.create.space,
      spaceCode: "229-create",
      roomCondition: "dirty",
      dueAt: new Date(PERIOD_START).toISOString(),
      existingTaskId: null,
    });
    const result = await service!.create(input(
      FIXTURES.create.reservation,
      "order229-create-cleaning-task",
    ));
    expect(result).toEqual({
      taskId: expect.any(String),
      reservationId: FIXTURES.create.reservation,
      spaceId: FIXTURES.create.space,
      roomCondition: "dirty",
      attendantPartyId: STAFF,
      dueAt: new Date(PERIOD_START).toISOString(),
      created: true,
      replayed: false,
    });
    const stored = await deploy!<Array<{
      id: string;
      kind: string;
      status: string;
      subject_type: string;
      subject_id: string;
      assignee_party: string;
      department: string;
      due_at: Date;
      priority: number;
      payload: Record<string, unknown>;
      facts: number;
      events: number;
      fact_payload: Record<string, unknown>;
      event_payload: Record<string, unknown>;
    }>>`
      SELECT task.id::text,task.kind,task.status,task.subject_type,task.subject_id::text,
             task.assignee_party::text,task.department,task.due_at,task.priority,task.payload,
             (SELECT count(*)::int FROM fact_log WHERE entity_id=task.id AND fact_type='task.created') facts,
             (SELECT count(*)::int FROM outbox WHERE aggregate_id=task.id AND event_type='task.created') events,
             (SELECT payload FROM fact_log WHERE entity_id=task.id AND fact_type='task.created') fact_payload,
             (SELECT payload FROM outbox WHERE aggregate_id=task.id AND event_type='task.created') event_payload
      FROM task WHERE task.id=${result.taskId}::uuid
    `;
    expect(stored).toEqual([expect.objectContaining({
      id: result.taskId,
      kind: "housekeeping",
      status: "assigned",
      subject_type: "space",
      subject_id: FIXTURES.create.space,
      assignee_party: STAFF,
      department: "Housekeeping",
      due_at: new Date(PERIOD_START),
      priority: 1,
      payload: {
        source: "arrival_room_cleaning",
        reservation_id: FIXTURES.create.reservation,
        room_condition: "dirty",
      },
      facts: 1,
      events: 1,
    })]);
    expect(stored[0]?.fact_payload).toEqual({
      ...stored[0]?.event_payload,
      request_id: expect.any(String),
    });
    expect(Object.keys(stored[0]?.fact_payload ?? {}).sort()).toEqual([
      "assignee_party_id", "department", "due_at", "priority", "request_id",
      "reservation_id", "room_condition", "space_id", "status",
    ]);
    expect(Object.keys(stored[0]?.event_payload ?? {}).sort()).toEqual([
      "assignee_party_id", "department", "due_at", "priority", "reservation_id",
      "room_condition", "space_id", "status",
    ]);
    expect(JSON.stringify(stored)).not.toMatch(/guest|contact|note|payment|statutory/i);
  });

  test("P3 exact existing task and replay return stable truth without duplicate evidence", async () => {
    const candidate = await service!.candidate({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: FIXTURES.existing.reservation,
      actorId: ACTOR,
    });
    expect(candidate).toMatchObject({
      spaceId: FIXTURES.existing.space,
      roomCondition: "pickup",
      existingTaskId: FIXTURES.existing.task,
    });
    const command = input(FIXTURES.existing.reservation, "order229-existing-task");
    const first = await service!.create(command);
    const replay = await service!.create(command);
    expect(first).toEqual({
      taskId: FIXTURES.existing.task,
      reservationId: FIXTURES.existing.reservation,
      spaceId: FIXTURES.existing.space,
      roomCondition: "pickup",
      attendantPartyId: OTHER_STAFF,
      dueAt: new Date(PERIOD_START).toISOString(),
      created: false,
      replayed: false,
    });
    expect(replay).toEqual({ ...first, replayed: true });
    const evidence = await deploy!<Array<{ tasks: number; facts: number; events: number }>>`SELECT
      (SELECT count(*)::int FROM task WHERE tenant_id=${TENANT}::uuid
        AND subject_id=${FIXTURES.existing.space}::uuid) tasks,
      (SELECT count(*)::int FROM fact_log WHERE entity_id=${FIXTURES.existing.task}::uuid
        AND fact_type='task.created') facts,
      (SELECT count(*)::int FROM outbox WHERE aggregate_id=${FIXTURES.existing.task}::uuid
        AND event_type='task.created') events`;
    expect(evidence).toEqual([{ tasks: 1, facts: 0, events: 0 }]);
    await expect(service!.create({ ...command, attendantPartyId: OTHER_STAFF }))
      .rejects.toBeInstanceOf(ArrivalRoomCleaningConflictError);
    await expect(service!.create({ ...command, envelope: envelope(undefined, OTHER_ACTOR) }))
      .rejects.toBeInstanceOf(ArrivalRoomCleaningConflictError);
  });

  test("P4 twenty contenders converge to one task and one atomic fact/outbox pair", async () => {
    const settled = await Promise.allSettled(Array.from({ length: 20 }, (_, index) =>
      service!.create(input(
        FIXTURES.race.reservation,
        `order229-race-${String(index).padStart(2, "0")}`,
      )),
    ));
    const fulfilled = settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
    expect(fulfilled).toHaveLength(20);
    expect(new Set(fulfilled.map(({ taskId }) => taskId)).size).toBe(1);
    expect(fulfilled.filter(({ created }) => created)).toHaveLength(1);
    const taskId = fulfilled[0]!.taskId;
    const evidence = await deploy!<Array<{ tasks: number; facts: number; events: number }>>`SELECT
      (SELECT count(*)::int FROM task WHERE tenant_id=${TENANT}::uuid
        AND kind='housekeeping' AND subject_type='space'
        AND subject_id=${FIXTURES.race.space}::uuid AND status IN ('assigned','in_progress')) tasks,
      (SELECT count(*)::int FROM fact_log WHERE entity_id=${taskId}::uuid AND fact_type='task.created') facts,
      (SELECT count(*)::int FROM outbox WHERE aggregate_id=${taskId}::uuid AND event_type='task.created') events`;
    expect(evidence).toEqual([{ tasks: 1, facts: 1, events: 1 }]);
  });

  test("P5 publication failure rolls task/evidence/idempotency back before exact retry", async () => {
    const failing = new ArrivalRoomCleaningTaskService({
      database: database!,
      events: new FailAfterPublishBus(new PostgresEventBus(eventPool!)),
      idempotency: new PostgresIdempotency(),
    });
    const command = input(FIXTURES.rollback.reservation, "order229-rollback-retry");
    await expect(failing.create(command)).rejects.toThrow("Order 229 injected publication failure");
    const rolledBack = await deploy!<Array<{ tasks: number; facts: number; events: number; claims: number }>>`SELECT
      (SELECT count(*)::int FROM task WHERE tenant_id=${TENANT}::uuid
        AND kind='housekeeping' AND subject_id=${FIXTURES.rollback.space}::uuid) tasks,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
        AND payload @> ${JSON.stringify({ reservation_id: FIXTURES.rollback.reservation })}::text::jsonb) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid
        AND event_type='task.created'
        AND payload @> ${JSON.stringify({ reservation_id: FIXTURES.rollback.reservation })}::text::jsonb) events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid
        AND operation='housekeeping.arrival-cleaning.create'
        AND key_hash=${keyHash("order229-rollback-retry")}) claims`;
    expect(rolledBack).toEqual([{ tasks: 0, facts: 0, events: 0, claims: 0 }]);
    expect(await service!.create(command)).toMatchObject({ created: true, replayed: false });
  });

  test("P6 hostile tenant/property/actor/attendant and incoherent duplicate truth conceal without mutation", async () => {
    const hostile = [
      input(FIXTURES.hostile.reservation, "order229-nonstaff", NON_STAFF),
      input(FIXTURES.hostile.reservation, "order229-inactive-staff", INACTIVE_STAFF),
      input(FIXTURES.hostile.reservation, "order229-foreign-staff", FOREIGN_STAFF),
      input(FIXTURES.hostile.reservation, "order229-inactive-actor", STAFF, envelope(undefined, INACTIVE_ACTOR)),
      input(FIXTURES.wrongProperty.reservation, "order229-wrong-property"),
      input(FIXTURES.foreign.reservation, "order229-foreign-reservation"),
      input(FIXTURES.incoherent.reservation, "order229-incoherent-duplicates"),
    ];
    for (const command of hostile) {
      await expect(service!.create(command)).rejects.toBeInstanceOf(ArrivalRoomCleaningNotFoundError);
    }
    await expect(service!.candidate({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: FIXTURES.incoherent.reservation,
      actorId: ACTOR,
    })).rejects.toBeInstanceOf(ArrivalRoomCleaningNotFoundError);
    const state = await deploy!<Array<{ hostile_tasks: number; incoherent_tasks: number; hostile_evidence: number }>>`SELECT
      (SELECT count(*)::int FROM task WHERE tenant_id=${TENANT}::uuid
        AND subject_id=${FIXTURES.hostile.space}::uuid) hostile_tasks,
      (SELECT count(*)::int FROM task WHERE tenant_id=${TENANT}::uuid
        AND subject_id=${FIXTURES.incoherent.space}::uuid) incoherent_tasks,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
        AND payload @> ${JSON.stringify({ reservation_id: FIXTURES.hostile.reservation })}::text::jsonb) hostile_evidence`;
    expect(state).toEqual([{ hostile_tasks: 0, incoherent_tasks: 2, hostile_evidence: 0 }]);
  });

  test("P6 exact-property dirty-room override authority conceals candidate and cannot create a task", async () => {
    await expect(service!.candidate({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: FIXTURES.hostile.reservation,
      actorId: OVERRIDE_ACTOR,
    })).rejects.toBeInstanceOf(ArrivalRoomCleaningNotFoundError);
    await expect(service!.create(input(
      FIXTURES.hostile.reservation,
      "order229-override-actor-concealed",
      STAFF,
      envelope(undefined, OVERRIDE_ACTOR),
    ))).rejects.toBeInstanceOf(ArrivalRoomCleaningNotFoundError);
    const state = await deploy!<Array<{ tasks: number; facts: number; events: number; claims: number }>>`SELECT
      (SELECT count(*)::int FROM task WHERE tenant_id=${TENANT}::uuid
        AND subject_id=${FIXTURES.hostile.space}::uuid) tasks,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
        AND payload @> ${JSON.stringify({ reservation_id: FIXTURES.hostile.reservation })}::text::jsonb) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid
        AND event_type='task.created'
        AND payload @> ${JSON.stringify({ reservation_id: FIXTURES.hostile.reservation })}::text::jsonb) events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid
        AND operation='housekeeping.arrival-cleaning.create'
        AND key_hash=${keyHash("order229-override-actor-concealed")}) claims`;
    expect(state).toEqual([{ tasks: 0, facts: 0, events: 0, claims: 0 }]);
  });
});
