import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  ArrivalPickupTaskDispatchService,
  ArrivalPickupTaskDispatchValidationError,
  type ArrivalPickupTaskTransitionInput,
} from "../src/contexts/stay-operations";
import {
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
  type IdempotencyInput,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

setDefaultTimeout(30_000);

const TENANT = "00000000-0000-0000-0000-000000022801";
const PROPERTY = "00000000-0000-0000-0000-000000022802";
const RESERVATION = "00000000-0000-0000-0000-000000022803";
const TASK = "00000000-0000-0000-0000-000000022804";
const ACTOR = "00000000-0000-0000-0000-000000022805";
const STAFF = "00000000-0000-0000-0000-000000022806";
const REQUEST = "00000000-0000-0000-0000-000000022807";
const FACT = "00000000-0000-0000-0000-000000022808";
const NON_STAFF = "00000000-0000-0000-0000-000000022809";
const RUNTIME_URL = process.env.YELLOW_ARRIVAL_PICKUP_DISPATCH_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ARRIVAL_PICKUP_DISPATCH === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_ARRIVAL_PICKUP_DISPATCH_URL (or YELLOW_RUNTIME_DATABASE_URL) are required");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

interface HarnessOptions {
  readonly previousStatus: "open" | "assigned" | "in_progress";
  readonly status: "assigned" | "in_progress" | "done";
  readonly previousAssignee: string | null;
  readonly assignee: string;
  readonly completedAt: Date | null;
}

function harness(options: HarnessOptions) {
  const queries: string[] = [];
  const published: PublishEventInput[] = [];
  const idempotency: IdempotencyInput[] = [];
  const tx = (async (strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    queries.push(sql);
    if (sql.includes("transition_arrival_pickup_task")) {
      return [{
        task_id: TASK,
        reservation_id: RESERVATION,
        previous_task_status: options.previousStatus,
        task_status: options.status,
        previous_assignee_party: options.previousAssignee,
        assignee_party: options.assignee,
        task_completed_at: options.completedAt,
      }];
    }
    if (sql.includes("INSERT INTO fact_log")) {
      return [{
        id: FACT,
        tenant_id: TENANT,
        entity_type: "task",
        entity_id: TASK,
        fact_type: "task.status_changed",
        valid_from: new Date("2026-08-28T10:00:00.000Z"),
        recorded_at: new Date("2026-08-28T10:00:00.000Z"),
        business_date: "2026-08-28",
        actor_id: ACTOR,
        payload: {},
        supersedes: null,
      }];
    }
    throw new Error(`unexpected SQL: ${sql}`);
  }) as unknown as Tx;
  const database = {
    withTenantTransaction: async (tenantId: string, command: (commandTx: Tx) => Promise<unknown>) => {
      expect(tenantId).toBe(TENANT);
      return command(tx);
    },
  } as unknown as Database;
  const idempotent = {
    execute: async <T>(commandTx: Tx, input: IdempotencyInput, command: (inner: Tx) => Promise<{ status: number; body: T }>) => {
      expect(commandTx).toBe(tx);
      idempotency.push(input);
      const result = await command(commandTx);
      return { ...result, replayed: false };
    },
  } as unknown as PostgresIdempotency;
  const events = {
    publish: async (commandTx: Tx, event: PublishEventInput) => {
      expect(commandTx).toBe(tx);
      published.push(event);
      return {} as never;
    },
  } as unknown as EventBus;
  return {
    service: new ArrivalPickupTaskDispatchService({ database, events, idempotency: idempotent }),
    queries,
    published,
    idempotency,
  };
}

function envelope() {
  return Object.freeze({
    actorId: ACTOR,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    requestId: REQUEST,
    operation: "task.status_changed",
  });
}

describe("Order 228 arrival pickup task dispatch domain", () => {
  test("assign, start and complete expose only adjacent canonical receipts and one event", async () => {
    const cases = [
      {
        action: "assign" as const,
        input: {
          expectedTaskStatus: "open" as const,
          expectedAssigneePartyId: null,
          staffPartyId: STAFF,
        },
        prior: "open" as const,
        next: "assigned" as const,
        priorAssignee: null,
        completedAt: null,
        eligibleAction: "start" as const,
      },
      {
        action: "start" as const,
        input: {
          expectedTaskStatus: "assigned" as const,
          expectedAssigneePartyId: STAFF,
        },
        prior: "assigned" as const,
        next: "in_progress" as const,
        priorAssignee: STAFF,
        completedAt: null,
        eligibleAction: "complete" as const,
      },
      {
        action: "complete" as const,
        input: {
          expectedTaskStatus: "in_progress" as const,
          expectedAssigneePartyId: STAFF,
        },
        prior: "in_progress" as const,
        next: "done" as const,
        priorAssignee: STAFF,
        completedAt: new Date("2026-08-28T10:00:00.000Z"),
        eligibleAction: null,
      },
    ];
    for (const item of cases) {
      const current = harness({
        previousStatus: item.prior,
        status: item.next,
        previousAssignee: item.priorAssignee,
        assignee: STAFF,
        completedAt: item.completedAt,
      });
      const result = await current.service.transition({
        tenantId: TENANT,
        propertyNode: PROPERTY,
        reservationId: RESERVATION,
        taskId: TASK,
        action: item.action,
        ...item.input,
        idempotencyKey: `order228-${item.action}`,
        envelope: envelope(),
      } as ArrivalPickupTaskTransitionInput);
      expect(result).toEqual({
        taskId: TASK,
        reservationId: RESERVATION,
        taskStatus: item.next,
        assigneePartyId: STAFF,
        completedAt: item.completedAt?.toISOString() ?? null,
        action: item.action,
        eligibleAction: item.eligibleAction,
        replayed: false,
      });
      expect(current.queries.filter((sql) => sql.includes("transition_arrival_pickup_task"))).toHaveLength(1);
      expect(current.queries.filter((sql) => sql.includes("INSERT INTO fact_log"))).toHaveLength(1);
      expect(current.published).toHaveLength(1);
      expect(current.published[0]).toMatchObject({
        eventType: "task.status_changed",
        aggregateType: "task",
        aggregateId: TASK,
        actorId: ACTOR,
        correlationId: REQUEST,
      });
      expect(current.idempotency).toEqual([expect.objectContaining({
        tenantId: TENANT,
        operation: "stay-operations.pickup-task.transition",
        key: `order228-${item.action}`,
        request: expect.objectContaining({ actorId: ACTOR, taskId: TASK, action: item.action }),
      })]);
    }
  });

  test("rejects non-adjacent or surplus caller authority before database access", async () => {
    const current = harness({
      previousStatus: "open",
      status: "assigned",
      previousAssignee: null,
      assignee: STAFF,
      completedAt: null,
    });
    const base = {
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: RESERVATION,
      taskId: TASK,
      action: "assign",
      expectedTaskStatus: "assigned",
      expectedAssigneePartyId: null,
      staffPartyId: STAFF,
      idempotencyKey: "order228-invalid",
      envelope: envelope(),
      dueAt: "caller-owned",
    };
    await expect(current.service.transition(base as never)).rejects.toBeInstanceOf(
      ArrivalPickupTaskDispatchValidationError,
    );
    expect(current.queries).toHaveLength(0);
  });

  test("migration fixes one owner-mediated signature and keeps raw task DML revoked", async () => {
    const source = await Bun.file(new URL(
      "../migrations/0031_governed_arrival_pickup_task_transition.sql",
      import.meta.url,
    )).text();
    expect(source).toContain("SECURITY DEFINER");
    expect(source).toContain("SET search_path = pg_catalog, public, pg_temp");
    expect(source).toContain("v_task.assignee_party IS DISTINCT FROM p_expected_assignee_party");
    expect(source).toContain("staff_role.role = 'staff'");
    expect(source).toContain("REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.task");
    expect(source).not.toContain("WHEN 'cancel'");
    expect(source).not.toContain("WHEN 'verify'");
  });
});

const DB_RESERVATIONS = Object.freeze({
  assign: "00000000-0000-0000-0000-000000022811",
  start: "00000000-0000-0000-0000-000000022812",
  complete: "00000000-0000-0000-0000-000000022813",
  race: "00000000-0000-0000-0000-000000022814",
  rollback: "00000000-0000-0000-0000-000000022815",
  hostile: "00000000-0000-0000-0000-000000022816",
});
const DB_TASKS = Object.freeze({
  assign: "00000000-0000-0000-0000-000000022821",
  start: "00000000-0000-0000-0000-000000022822",
  complete: "00000000-0000-0000-0000-000000022823",
  race: "00000000-0000-0000-0000-000000022824",
  rollback: "00000000-0000-0000-0000-000000022825",
  hostile: "00000000-0000-0000-0000-000000022826",
});
const SCHEDULE = "2026-09-28T08:00:00.123456Z";

let deploy: SQL | undefined;
let realDatabase: Database | undefined;
let eventPool: SQL | undefined;
let realService: ArrivalPickupTaskDispatchService | undefined;
let directAuthorityProof: Readonly<{
  capabilityDenied: boolean;
  appUpdate: boolean;
  runtimeUpdate: boolean;
}> | undefined;

class FailAfterPublishBus implements EventBus {
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, event);
    throw new Error("Order 228 injected publisher failure");
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

function dbInput(
  taskId: string,
  reservationId: string,
  action: "assign" | "start" | "complete",
  key: string,
): ArrivalPickupTaskTransitionInput {
  const common = {
    tenantId: TENANT,
    propertyNode: PROPERTY,
    reservationId,
    taskId,
    idempotencyKey: key,
    envelope: { ...envelope(), requestId: crypto.randomUUID() },
  };
  if (action === "assign") return {
    ...common, action, expectedTaskStatus: "open", expectedAssigneePartyId: null, staffPartyId: STAFF,
  };
  if (action === "start") return {
    ...common, action, expectedTaskStatus: "assigned", expectedAssigneePartyId: STAFF,
  };
  return { ...common, action, expectedTaskStatus: "in_progress", expectedAssigneePartyId: STAFF };
}

async function cleanupDatabase(client = deploy): Promise<void> {
  if (!client) return;
  await client`DELETE FROM api_idempotency WHERE tenant_id=${TENANT}::uuid`;
  await client`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid`;
  await client`DELETE FROM fact_log WHERE tenant_id=${TENANT}::uuid`;
  await client`DELETE FROM travel_detail WHERE tenant_id=${TENANT}::uuid`;
  await client`DELETE FROM task WHERE tenant_id=${TENANT}::uuid`;
  await client`DELETE FROM reservation WHERE tenant_id=${TENANT}::uuid`;
  await client`DELETE FROM party_role WHERE tenant_id=${TENANT}::uuid`;
  await client`DELETE FROM party WHERE tenant_id=${TENANT}::uuid`;
  await client`DELETE FROM app_user WHERE tenant_id=${TENANT}::uuid`;
  await client`DELETE FROM org_node WHERE tenant_id=${TENANT}::uuid`;
  await client`DELETE FROM tenant WHERE id=${TENANT}::uuid`;
}

databaseDescribe("Order 228 fresh-PostgreSQL arrival pickup dispatch", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 4, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 4, prepare: false });
    realDatabase = Database.connect(RUNTIME_URL!, { maxConnections: 24, prepare: false });
    realService = new ArrivalPickupTaskDispatchService({
      database: realDatabase,
      events: new PostgresEventBus(eventPool),
      idempotency: new PostgresIdempotency(),
    });
    await cleanupDatabase();
    await deploy`INSERT INTO tenant(id,slug,name,tier,status)
      VALUES (${TENANT}::uuid,'order228','Order 228','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency)
      VALUES (${PROPERTY}::uuid,${TENANT}::uuid,'order228.property'::ltree,'property','Order 228','Asia/Kolkata','INR')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status)
      VALUES (${ACTOR}::uuid,${TENANT}::uuid,'actor@order228.local','Actor','active')`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
      (${STAFF}::uuid,${TENANT}::uuid,'person','Dispatcher','active'),
      (${NON_STAFF}::uuid,${TENANT}::uuid,'person','Not Staff','active')`;
    await deploy`INSERT INTO party_role(tenant_id,party_id,role)
      VALUES (${TENANT}::uuid,${STAFF}::uuid,'staff')`;
    for (const [key, reservationId] of Object.entries(DB_RESERVATIONS)) {
      await deploy`INSERT INTO reservation(
        id,tenant_id,property_node,confirmation_no,status,primary_party,currency
      ) VALUES (
        ${reservationId}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,
        ${`O228-${key}`},'due_in',${STAFF}::uuid,'INR'
      )`;
    }
    const statuses = { assign: "open", start: "assigned", complete: "in_progress", race: "open", rollback: "open", hostile: "open" } as const;
    for (const [key, taskId] of Object.entries(DB_TASKS)) {
      const reservationId = DB_RESERVATIONS[key as keyof typeof DB_RESERVATIONS];
      const status = statuses[key as keyof typeof statuses];
      const assignee = status === "assigned" || status === "in_progress" ? STAFF : null;
      await deploy`INSERT INTO task(
        id,tenant_id,property_node,kind,status,subject_type,subject_id,
        assignee_party,department,due_at,priority,payload
      ) VALUES (
        ${taskId}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,
        ${key === "hostile" ? "trace" : "guest_request"},${status},'reservation',${reservationId}::uuid,
        ${assignee}::uuid,'transport',${SCHEDULE}::timestamptz,3,
        '{"requestType":"arrival_pickup"}'::jsonb
      )`;
      await deploy`INSERT INTO travel_detail(
        tenant_id,reservation_id,direction,mode,scheduled_at,pickup_requested,pickup_task_id
      ) VALUES (
        ${TENANT}::uuid,${reservationId}::uuid,'arrival','car',${SCHEDULE}::timestamptz,true,${taskId}::uuid
      )`;
    }
    let capabilityDenied = false;
    try {
      await deploy`SELECT * FROM public.transition_arrival_pickup_task(
        ${TENANT}::uuid,${PROPERTY}::uuid,${DB_RESERVATIONS.assign}::uuid,${DB_TASKS.assign}::uuid,
        'start','assigned',${STAFF}::uuid,NULL,${ACTOR}::uuid
      )`;
    } catch (error) {
      capabilityDenied = (error as { errno?: unknown }).errno === "42501";
    }
    const privileges = await deploy<Array<{ app_update: boolean; runtime_update: boolean }>>`
      SELECT has_table_privilege('app_role','public.task','UPDATE') app_update,
             has_table_privilege('yellow_runtime','public.task','UPDATE') runtime_update`;
    directAuthorityProof = Object.freeze({
      capabilityDenied,
      appUpdate: privileges[0]?.app_update ?? true,
      runtimeUpdate: privileges[0]?.runtime_update ?? true,
    });
  });

  afterAll(async () => {
    await realDatabase?.close();
    await eventPool?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
    const cleanup = new SQL(DEPLOY_URL!, { max: 1, prepare: false });
    try {
      await cleanupDatabase(cleanup);
    } finally {
      await cleanup.close({ timeout: 0 });
    }
  });

  test("executes only assign/start/complete and records one fact/outbox per transition", async () => {
    const inputs = [
      dbInput(DB_TASKS.assign, DB_RESERVATIONS.assign, "assign", "order228-db-assign"),
      dbInput(DB_TASKS.start, DB_RESERVATIONS.start, "start", "order228-db-start"),
      dbInput(DB_TASKS.complete, DB_RESERVATIONS.complete, "complete", "order228-db-complete"),
    ];
    const results = [];
    for (const input of inputs) results.push(await realService!.transition(input));
    expect(results.map(({ taskStatus }) => taskStatus)).toEqual(["assigned", "in_progress", "done"]);
    expect(results[2]?.completedAt).toBeString();
    const evidence = await deploy!<Array<{ facts: number; events: number }>>`SELECT
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
        AND fact_type='task.status_changed'
        AND entity_id IN (${DB_TASKS.assign}::uuid,${DB_TASKS.start}::uuid,${DB_TASKS.complete}::uuid)) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid
        AND event_type='task.status_changed'
        AND aggregate_id IN (${DB_TASKS.assign}::uuid,${DB_TASKS.start}::uuid,${DB_TASKS.complete}::uuid)) events`;
    expect(evidence).toEqual([{ facts: 3, events: 3 }]);
    expect(await realService!.transition(inputs[0]!)).toMatchObject({ replayed: true, taskStatus: "assigned" });
  });

  test("rejects non-staff and hostile current links without mutation", async () => {
    const nonStaff = dbInput(DB_TASKS.race, DB_RESERVATIONS.race, "assign", "order228-db-nonstaff");
    if (nonStaff.action !== "assign") throw new Error("invalid assign fixture");
    await expect(realService!.transition({
      ...nonStaff,
      staffPartyId: NON_STAFF,
    })).rejects.toThrow();
    await expect(realService!.transition(
      dbInput(DB_TASKS.hostile, DB_RESERVATIONS.hostile, "assign", "order228-db-hostile"),
    )).rejects.toThrow();
    const states = await deploy!<Array<{ id: string; status: string; assignee_party: string | null }>>`
      SELECT id::text,status,assignee_party::text FROM task
      WHERE id IN (${DB_TASKS.race}::uuid,${DB_TASKS.hostile}::uuid) ORDER BY id`;
    expect(states.every(({ status, assignee_party }) => status === "open" && assignee_party === null)).toBeTrue();
  });

  test("concurrent same-evidence contenders converge to one transition and one evidence pair", async () => {
    const settled = await Promise.allSettled(Array.from({ length: 20 }, (_, index) =>
      realService!.transition(dbInput(
        DB_TASKS.race,
        DB_RESERVATIONS.race,
        "assign",
        `order228-race-${index}`,
      )),
    ));
    expect(settled.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const evidence = await deploy!<Array<{ facts: number; events: number }>>`SELECT
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
        AND entity_id=${DB_TASKS.race}::uuid AND fact_type='task.status_changed') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid
        AND aggregate_id=${DB_TASKS.race}::uuid AND event_type='task.status_changed') events`;
    expect(evidence).toEqual([{ facts: 1, events: 1 }]);
  });

  test("publication failure rolls back task, fact, outbox and idempotency before exact retry", async () => {
    const failing = new ArrivalPickupTaskDispatchService({
      database: realDatabase!,
      events: new FailAfterPublishBus(new PostgresEventBus(eventPool!)),
      idempotency: new PostgresIdempotency(),
    });
    const input = dbInput(DB_TASKS.rollback, DB_RESERVATIONS.rollback, "assign", "order228-db-rollback");
    await expect(failing.transition(input)).rejects.toThrow("Order 228 injected publisher failure");
    const rolledBack = await deploy!<Array<{ status: string; assignee: string | null; facts: number; events: number; claims: number }>>`SELECT
      task.status,task.assignee_party::text assignee,
      (SELECT count(*)::int FROM fact_log WHERE entity_id=task.id) facts,
      (SELECT count(*)::int FROM outbox WHERE aggregate_id=task.id AND event_type='task.status_changed') events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid
        AND operation='stay-operations.pickup-task.transition' AND response_status IS NULL) claims
      FROM task WHERE id=${DB_TASKS.rollback}::uuid`;
    expect(rolledBack).toEqual([{ status: "open", assignee: null, facts: 0, events: 0, claims: 0 }]);
    expect(await realService!.transition(input)).toMatchObject({ taskStatus: "assigned", replayed: false });
  });

  test("direct deploy capability is denied and raw app-role task DML remains ungranted", async () => {
    expect(directAuthorityProof).toEqual({
      capabilityDenied: true,
      appUpdate: false,
      runtimeUpdate: false,
    });
  });
});
