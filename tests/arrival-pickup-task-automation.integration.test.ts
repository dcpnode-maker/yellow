import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import { ArrivalPickupTaskAutomationConsumer } from "../src/contexts/stay-operations";
import {
  Database, PostgresEventBus, type EventBus, type OutboxEvent, type PublishEventInput, type Tx,
} from "../src/kernel";

setDefaultTimeout(30_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ARRIVAL_PICKUP_TASK_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ARRIVAL_PICKUP_TASK === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_ARRIVAL_PICKUP_TASK_URL (or YELLOW_RUNTIME_DATABASE_URL) are required");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000021301";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000021302";
const PROPERTY = "00000000-0000-0000-0000-000000021311";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000021312";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000021313";
const ACTOR = "00000000-0000-0000-0000-000000021314";
const INACTIVE_ACTOR = "00000000-0000-0000-0000-000000021315";
const FOREIGN_ACTOR = "00000000-0000-0000-0000-000000021316";
const PARTY = "00000000-0000-0000-0000-000000021321";
const FOREIGN_PARTY = "00000000-0000-0000-0000-000000021322";
const EXISTING_TASK = "00000000-0000-0000-0000-000000021331";
const HOSTILE_TASK = "00000000-0000-0000-0000-000000021332";
const SOURCE_EVENT = "00000000-0000-0000-0000-000000021333";
const ROLLBACK_EVENT = "00000000-0000-0000-0000-000000021334";
const RESERVATIONS = Object.freeze({
  eligible: "00000000-0000-0000-0000-000000021341",
  race: "00000000-0000-0000-0000-000000021342",
  rollback: "00000000-0000-0000-0000-000000021343",
  pickupFalse: "00000000-0000-0000-0000-000000021344",
  unscheduled: "00000000-0000-0000-0000-000000021345",
  terminal: "00000000-0000-0000-0000-000000021346",
  linked: "00000000-0000-0000-0000-000000021347",
  hostile: "00000000-0000-0000-0000-000000021348",
  otherProperty: "00000000-0000-0000-0000-000000021349",
  foreign: "00000000-0000-0000-0000-000000021350",
  consumer: "00000000-0000-0000-0000-000000021351",
  consumerRollback: "00000000-0000-0000-0000-000000021352",
});
const SCHEDULED_AT = "2026-09-14T06:30:00.123456Z";

type CapabilityRow = Readonly<{
  task_id: string | null;
  created: boolean;
  due_at: string | null;
}>;

let deploy: SQL | undefined;
let directRuntime: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;

class FailAfterPublishBus implements EventBus {
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, event);
    throw new Error("Order 213 injected publisher failure after outbox insertion");
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

async function govern(
  reservationId: string,
  propertyId = PROPERTY,
  tenantId = TENANT,
  actorId = ACTOR,
): Promise<CapabilityRow> {
  return database!.withTenantTransaction(tenantId, async (tx) => {
    const rows = await tx<CapabilityRow[]>`
      SELECT task_id, created, due_at
        FROM public.govern_arrival_pickup_task(
          ${tenantId}::uuid, ${propertyId}::uuid, ${reservationId}::uuid,
          ${actorId}::uuid
        )
    `;
    expect(rows).toHaveLength(1);
    return rows[0]!;
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

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await deploy`DELETE FROM consumer_processed WHERE consumer='arrival-pickup-task'`;
  await deploy`DELETE FROM consumer_cursor WHERE consumer='arrival-pickup-task'`;
  for (const table of ["outbox", "fact_log", "travel_detail", "task", "reservation", "party", "app_user", "org_node"]) {
    await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [TENANT, FOREIGN_TENANT]);
  }
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
}

databaseDescribe("Order 213 governed arrival pickup-task automation", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 8, prepare: false });
    directRuntime = new SQL(RUNTIME_URL!, { max: 4, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 8, prepare: false });
    events = new PostgresEventBus(eventPool);
    database = Database.connect(RUNTIME_URL!, { maxConnections: 40, prepare: false });
    await cleanup();
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT}::uuid,'order213','Order 213','shared','active'),
      (${FOREIGN_TENANT}::uuid,'order213-foreign','Order 213 Foreign','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY}::uuid,${TENANT}::uuid,'order213.property'::ltree,'property','Order 213','Asia/Kolkata','INR'),
      (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order213.other'::ltree,'property','Order 213 Other','UTC','USD'),
      (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order213_foreign.property'::ltree,'property','Foreign','UTC','USD')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR}::uuid,${TENANT}::uuid,'actor@order213.local','Actor','active'),
      (${INACTIVE_ACTOR}::uuid,${TENANT}::uuid,'inactive@order213.local','Inactive','disabled'),
      (${FOREIGN_ACTOR}::uuid,${FOREIGN_TENANT}::uuid,'foreign@order213.local','Foreign','active')`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
      (${PARTY}::uuid,${TENANT}::uuid,'person','Guest','active'),
      (${FOREIGN_PARTY}::uuid,${FOREIGN_TENANT}::uuid,'person','Foreign Guest','active')`;
    await deploy`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,currency) VALUES
      (${RESERVATIONS.eligible}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O213-E','reserved',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.race}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O213-R','due_in',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.rollback}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O213-B','reserved',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.pickupFalse}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O213-F','reserved',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.unscheduled}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O213-U','reserved',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.terminal}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O213-X','checked_out',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.linked}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O213-L','reserved',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.hostile}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O213-H','reserved',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.otherProperty}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'O213-O','reserved',${PARTY}::uuid,'USD'),
      (${RESERVATIONS.foreign}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'O213-Z','reserved',${FOREIGN_PARTY}::uuid,'USD'),
      (${RESERVATIONS.consumer}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O213-C','reserved',${PARTY}::uuid,'INR'),
      (${RESERVATIONS.consumerRollback}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O213-Q','due_in',${PARTY}::uuid,'INR')`;
    await deploy`INSERT INTO task(
      id,tenant_id,property_node,kind,status,subject_type,subject_id,department,due_at,priority,payload
    ) VALUES
      (${EXISTING_TASK}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest_request','assigned','reservation',${RESERVATIONS.linked}::uuid,'transport',${SCHEDULED_AT}::timestamptz,3,'{"requestType":"arrival_pickup"}'::jsonb),
      (${HOSTILE_TASK}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'trace','open','reservation',${RESERVATIONS.hostile}::uuid,'transport',${SCHEDULED_AT}::timestamptz,3,'{"requestType":"arrival_pickup"}'::jsonb)`;
    await deploy`INSERT INTO travel_detail(
      tenant_id,reservation_id,direction,mode,scheduled_at,pickup_requested,pickup_task_id
    ) VALUES
      (${TENANT}::uuid,${RESERVATIONS.eligible}::uuid,'arrival','flight',${SCHEDULED_AT}::timestamptz,true,NULL),
      (${TENANT}::uuid,${RESERVATIONS.race}::uuid,'arrival','train',${SCHEDULED_AT}::timestamptz,true,NULL),
      (${TENANT}::uuid,${RESERVATIONS.rollback}::uuid,'arrival','car',${SCHEDULED_AT}::timestamptz,true,NULL),
      (${TENANT}::uuid,${RESERVATIONS.pickupFalse}::uuid,'arrival','bus',${SCHEDULED_AT}::timestamptz,false,NULL),
      (${TENANT}::uuid,${RESERVATIONS.unscheduled}::uuid,'arrival','other',NULL,true,NULL),
      (${TENANT}::uuid,${RESERVATIONS.terminal}::uuid,'arrival','ferry',${SCHEDULED_AT}::timestamptz,true,NULL),
      (${TENANT}::uuid,${RESERVATIONS.linked}::uuid,'arrival','flight',${SCHEDULED_AT}::timestamptz,true,${EXISTING_TASK}::uuid),
      (${TENANT}::uuid,${RESERVATIONS.hostile}::uuid,'arrival','flight',${SCHEDULED_AT}::timestamptz,true,${HOSTILE_TASK}::uuid),
      (${TENANT}::uuid,${RESERVATIONS.otherProperty}::uuid,'arrival','flight',${SCHEDULED_AT}::timestamptz,true,NULL),
      (${FOREIGN_TENANT}::uuid,${RESERVATIONS.foreign}::uuid,'arrival','flight',${SCHEDULED_AT}::timestamptz,true,NULL),
      (${TENANT}::uuid,${RESERVATIONS.consumer}::uuid,'arrival','flight',${SCHEDULED_AT}::timestamptz,true,NULL),
      (${TENANT}::uuid,${RESERVATIONS.consumerRollback}::uuid,'arrival','train',${SCHEDULED_AT}::timestamptz,true,NULL)`;
  });

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await eventPool?.close({ timeout: 0 });
    await directRuntime?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  });

  test("P1 capability is owner-contained and raw task/travel DML remains denied", async () => {
    const capability = await deploy!<Array<{
      owner: string; security_definer: boolean; config: string[];
      app_execute: boolean; runtime_execute: boolean; public_execute: boolean;
    }>>`
      SELECT pg_get_userbyid(proowner) owner, prosecdef security_definer, proconfig config,
        has_function_privilege('app_role',oid,'EXECUTE') app_execute,
        has_function_privilege('yellow_runtime',oid,'EXECUTE') runtime_execute,
        has_function_privilege('public',oid,'EXECUTE') public_execute
      FROM pg_proc
      WHERE oid = 'public.govern_arrival_pickup_task(uuid,uuid,uuid,uuid)'::regprocedure
    `;
    expect(capability).toEqual([{
      owner: "yellow_owner", security_definer: true,
      config: ["search_path=pg_catalog, public, pg_temp"],
      app_execute: true, runtime_execute: false, public_execute: false,
    }]);

    for (const statement of [
      `INSERT INTO task(tenant_id,property_node,kind) VALUES ('${TENANT}'::uuid,'${PROPERTY}'::uuid,'guest_request')`,
      `UPDATE travel_detail SET pickup_task_id=NULL WHERE tenant_id='${TENANT}'::uuid AND reservation_id='${RESERVATIONS.linked}'::uuid`,
    ]) {
      const connection = await directRuntime!.reserve();
      try {
        await connection.unsafe("BEGIN");
        await connection`SELECT set_config('app.tenant_id',${TENANT},true)`;
        await connection.unsafe("SET LOCAL ROLE app_role");
        await expectSqlState(connection.unsafe(statement), "42501");
        await connection.unsafe("ROLLBACK");
      } finally {
        connection.release();
      }
    }
    await expectSqlState(deploy!`SELECT * FROM public.govern_arrival_pickup_task(
      ${TENANT}::uuid,${PROPERTY}::uuid,${RESERVATIONS.eligible}::uuid,${ACTOR}::uuid)`, "42501");
    await expectSqlState(
      database!.withTenantTransaction(TENANT, (tx) => tx`
        SELECT * FROM public.govern_arrival_pickup_task(
          ${TENANT}::uuid,${PROPERTY}::uuid,${RESERVATIONS.eligible}::uuid,
          ${INACTIVE_ACTOR}::uuid
        )
      `),
      "42501",
    );
  });

  test("P2 qualifying truth creates and links exactly one canonical minimized task", async () => {
    const created = await govern(RESERVATIONS.eligible);
    expect(created.task_id).toBeString();
    expect(created.created).toBe(true);

    const truth = await deploy!<Array<Record<string, unknown>>>`
      SELECT task.id::text, task.kind, task.status, task.subject_type,
             task.subject_id::text, task.assignee_party, task.department,
             task.due_at::text, task.priority, task.payload,
             travel.pickup_task_id::text AS linked_task
        FROM task
        JOIN travel_detail AS travel ON travel.pickup_task_id = task.id
       WHERE task.id = ${created.task_id}::uuid
    `;
    expect(truth).toEqual([{
      id: created.task_id, kind: "guest_request", status: "open",
      subject_type: "reservation", subject_id: RESERVATIONS.eligible,
      assignee_party: null, department: "transport",
      due_at: "2026-09-14 06:30:00.123456+00", priority: 3,
      payload: { requestType: "arrival_pickup" }, linked_task: created.task_id,
    }]);

    const replay = await govern(RESERVATIONS.eligible);
    expect(replay).toMatchObject({ task_id: created.task_id, created: false });
    const count = await deploy!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM task
       WHERE tenant_id=${TENANT}::uuid AND subject_id=${RESERVATIONS.eligible}::uuid
    `;
    expect(count).toEqual([{ count: 1 }]);
  });

  test("P2 ineligible, absent, property and tenant truth are quiet no-ops", async () => {
    for (const reservationId of [
      RESERVATIONS.pickupFalse, RESERVATIONS.unscheduled, RESERVATIONS.terminal,
      RESERVATIONS.otherProperty, crypto.randomUUID(),
    ]) {
      expect(await govern(reservationId)).toEqual({ task_id: null, created: false, due_at: null });
    }
    expect(await govern(RESERVATIONS.foreign)).toEqual({ task_id: null, created: false, due_at: null });
    expect(await govern(RESERVATIONS.foreign, FOREIGN_PROPERTY, FOREIGN_TENANT, FOREIGN_ACTOR))
      .toMatchObject({ created: true });
  });

  test("P2 coherent links are stable and hostile associations fail closed", async () => {
    expect(await govern(RESERVATIONS.linked)).toMatchObject({
      task_id: EXISTING_TASK, created: false,
    });
    await expectSqlState(
      database!.withTenantTransaction(TENANT, (tx) => tx`
        SELECT * FROM public.govern_arrival_pickup_task(
          ${TENANT}::uuid,${PROPERTY}::uuid,${RESERVATIONS.hostile}::uuid,${ACTOR}::uuid
        )
      `),
      "55000",
    );
  });

  test("P3 concurrency converges and transaction rollback removes task and link", async () => {
    const contenders = await Promise.all(
      Array.from({ length: 20 }, () => govern(RESERVATIONS.race)),
    );
    expect(contenders.filter(({ created }) => created)).toHaveLength(1);
    expect(new Set(contenders.map(({ task_id }) => task_id)).size).toBe(1);
    const raceTask = contenders[0]?.task_id;
    expect(raceTask).toBeString();

    await expect(database!.withTenantTransaction(TENANT, async (tx: Tx) => {
      await tx`SELECT * FROM public.govern_arrival_pickup_task(
        ${TENANT}::uuid,${PROPERTY}::uuid,${RESERVATIONS.rollback}::uuid,${ACTOR}::uuid
      )`;
      throw new Error("injected rollback");
    })).rejects.toThrow("injected rollback");
    const rollback = await deploy!<Array<{ tasks: number; linked_task: string | null }>>`
      SELECT count(task.id)::int AS tasks, max(travel.pickup_task_id::text) AS linked_task
        FROM travel_detail AS travel
        LEFT JOIN task ON task.id=travel.pickup_task_id
       WHERE travel.tenant_id=${TENANT}::uuid
         AND travel.reservation_id=${RESERVATIONS.rollback}::uuid
       GROUP BY travel.id
    `;
    expect(rollback).toEqual([{ tasks: 0, linked_task: null }]);
  });

  test("P3 durable consumer atomically records marker, task, link, fact and event", async () => {
    await deploy!`INSERT INTO outbox(
      id,tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
      actor_id,correlation_id,payload
    ) VALUES (
      ${SOURCE_EVENT}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,DATE '2026-09-14',
      'reservation',${RESERVATIONS.consumer}::uuid,'reservation.modified',${ACTOR}::uuid,
      ${SOURCE_EVENT}::uuid,'{"diff":{"travel":{"direction":"arrival"}}}'::jsonb
    )`;
    const consumer = new ArrivalPickupTaskAutomationConsumer(events!);
    expect(await consumer.drainOnce()).toMatchObject({ created: 1 });
    await consumer.drainOnce();

    const truth = await deploy!<Array<{
      tasks: number; linked: number; facts: number; emitted: number; processed: number;
    }>>`SELECT
      (SELECT count(*)::int FROM task WHERE tenant_id=${TENANT}::uuid
        AND subject_id=${RESERVATIONS.consumer}::uuid) tasks,
      (SELECT count(*)::int FROM travel_detail WHERE tenant_id=${TENANT}::uuid
        AND reservation_id=${RESERVATIONS.consumer}::uuid AND pickup_task_id IS NOT NULL) linked,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
        AND entity_type='task' AND fact_type='task.created'
        AND payload->>'subjectId'=${RESERVATIONS.consumer}) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid
        AND event_type='task.created' AND payload->>'subjectId'=${RESERVATIONS.consumer}) emitted,
      (SELECT count(*)::int FROM consumer_processed
        WHERE consumer='arrival-pickup-task' AND outbox_id=${SOURCE_EVENT}::uuid) processed`;
    expect(truth).toEqual([{ tasks: 1, linked: 1, facts: 1, emitted: 1, processed: 1 }]);
    expect(await consumer.drainOnce()).toMatchObject({ created: 0 });
  });

  test("P3 publisher failure rolls back every consumer effect and retry creates once", async () => {
    await deploy!`INSERT INTO outbox(
      id,tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
      actor_id,correlation_id,payload
    ) VALUES (
      ${ROLLBACK_EVENT}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,DATE '2026-09-14',
      'reservation',${RESERVATIONS.consumerRollback}::uuid,'reservation.modified',${ACTOR}::uuid,
      ${ROLLBACK_EVENT}::uuid,'{"diff":{"travel":{"direction":"arrival"}}}'::jsonb
    )`;
    await expect(new ArrivalPickupTaskAutomationConsumer(new FailAfterPublishBus(events!)).drainOnce())
      .rejects.toThrow("Order 213 injected publisher failure");

    const rolledBack = await deploy!<Array<{
      tasks: number; linked: number; facts: number; emitted: number; processed: number;
    }>>`SELECT
      (SELECT count(*)::int FROM task WHERE tenant_id=${TENANT}::uuid
        AND subject_id=${RESERVATIONS.consumerRollback}::uuid) tasks,
      (SELECT count(*)::int FROM travel_detail WHERE tenant_id=${TENANT}::uuid
        AND reservation_id=${RESERVATIONS.consumerRollback}::uuid AND pickup_task_id IS NOT NULL) linked,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid
        AND entity_type='task' AND payload->>'subjectId'=${RESERVATIONS.consumerRollback}) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid
        AND event_type='task.created' AND payload->>'subjectId'=${RESERVATIONS.consumerRollback}) emitted,
      (SELECT count(*)::int FROM consumer_processed
        WHERE consumer='arrival-pickup-task' AND outbox_id=${ROLLBACK_EVENT}::uuid) processed`;
    expect(rolledBack).toEqual([{ tasks: 0, linked: 0, facts: 0, emitted: 0, processed: 0 }]);

    expect(await new ArrivalPickupTaskAutomationConsumer(events!).drainOnce())
      .toMatchObject({ created: 1 });
    expect((await deploy!<Array<{ tasks: number; processed: number }>>`SELECT
      (SELECT count(*)::int FROM task WHERE tenant_id=${TENANT}::uuid
        AND subject_id=${RESERVATIONS.consumerRollback}::uuid) tasks,
      (SELECT count(*)::int FROM consumer_processed
        WHERE consumer='arrival-pickup-task' AND outbox_id=${ROLLBACK_EVENT}::uuid) processed`)[0])
      .toEqual({ tasks: 1, processed: 1 });
  });
});
