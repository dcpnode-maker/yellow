import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  ReservationDetailConflictError,
  ReservationDetailNotFoundError,
  ReservationDetailService,
  ReservationDetailValidationError,
  type FindReservationPickupTaskDetailInput,
  type ReservationPickupTaskStatus,
} from "../src/contexts/reservations";
import { Database, type Tx } from "../src/kernel";

const URL = process.env.YELLOW_RESERVATION_PICKUP_TASK_DETAIL_URL ??
  process.env.YELLOW_RESERVATION_DETAIL_URL;
if (process.env.YELLOW_REQUIRE_RESERVATION_PICKUP_TASK_DETAIL === "1" && !URL) {
  throw new Error("YELLOW_RESERVATION_PICKUP_TASK_DETAIL_URL is required by the Order 215 proof");
}

const TENANT_A = "00000000-0000-0000-0000-000000021501";
const TENANT_B = "00000000-0000-0000-0000-000000021502";
const PROPERTY_A = "00000000-0000-0000-0000-000000021511";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000021512";
const PROPERTY_B = "00000000-0000-0000-0000-000000021513";
const PARTY_A = "00000000-0000-0000-0000-000000021521";
const PARTY_B = "00000000-0000-0000-0000-000000021522";
const RESERVATION_A = "00000000-0000-0000-0000-000000021531";
const RESERVATION_UNLINKED = "00000000-0000-0000-0000-000000021532";
const RESERVATION_B = "00000000-0000-0000-0000-000000021533";
const TRAVEL_A = "00000000-0000-0000-0000-000000021541";
const TRAVEL_UNLINKED = "00000000-0000-0000-0000-000000021542";
const TRAVEL_B = "00000000-0000-0000-0000-000000021543";
const TASK_A = "00000000-0000-0000-0000-000000021551";
const TASK_OTHER = "00000000-0000-0000-0000-000000021552";
const TASK_B = "00000000-0000-0000-0000-000000021553";
const DUE_AT = "2026-08-28T10:11:12.123456Z";
const CREATED_AT = "2026-08-28T01:02:03.654321Z";
const COMPLETED_AT = "2026-08-28T11:12:13.222222Z";

const service = new ReservationDetailService();
const databaseDescribe = URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let database: Database | undefined;

function input(
  overrides: Partial<FindReservationPickupTaskDetailInput> = {},
): FindReservationPickupTaskDetailInput {
  return {
    tenantId: TENANT_A,
    propertyNode: PROPERTY_A,
    reservationId: RESERVATION_A,
    taskId: TASK_A,
    ...overrides,
  };
}

function find(
  detailInput = input(),
  contextTenant = detailInput.tenantId,
) {
  return database!.withTenantTransaction(contextTenant, (tx) =>
    service.pickupTaskDetail(tx, detailInput));
}

async function clean(): Promise<void> {
  if (!admin) return;
  for (const table of ["travel_detail", "task", "reservation", "party", "org_node"]) {
    await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [TENANT_A, TENANT_B]);
  }
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
}

beforeAll(async () => {
  if (!URL) return;
  admin = new SQL(URL, { max: 4, prepare: false });
  database = Database.connect(URL, { maxConnections: 4, prepare: false });
  await clean();
  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT_A}::uuid,'order215-a','Order 215 A','shared','active'),
    (${TENANT_B}::uuid,'order215-b','Order 215 B','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order215_a','property','Order 215 A','UTC','USD'),
    (${PROPERTY_A2}::uuid,${TENANT_A}::uuid,'order215_a2','property','Order 215 A2','UTC','USD'),
    (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order215_b','property','Order 215 B','UTC','USD')`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY_A}::uuid,${TENANT_A}::uuid,'person','Order 215 Guest A','active'),
    (${PARTY_B}::uuid,${TENANT_B}::uuid,'person','Order 215 Guest B','active')`;
  await admin`INSERT INTO reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
    ) VALUES
    (${RESERVATION_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'Y-215-A','due_in',${PARTY_A}::uuid,'direct','USD'),
    (${RESERVATION_UNLINKED}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'Y-215-U','reserved',${PARTY_A}::uuid,'direct','USD'),
    (${RESERVATION_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'Y-215-B','due_in',${PARTY_B}::uuid,'direct','USD')`;
  await admin`INSERT INTO task(
      id,tenant_id,property_node,kind,status,subject_type,subject_id,assignee_party,
      department,due_at,priority,payload,created_at,completed_at
    ) VALUES
    (${TASK_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'guest_request','open','reservation',
      ${RESERVATION_A}::uuid,NULL,'transport',${DUE_AT}::timestamptz,3,
      '{"requestType":"arrival_pickup"}',${CREATED_AT}::timestamptz,NULL),
    (${TASK_OTHER}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'guest_request','open','reservation',
      ${RESERVATION_UNLINKED}::uuid,NULL,'transport',${DUE_AT}::timestamptz,3,
      '{"requestType":"arrival_pickup"}',${CREATED_AT}::timestamptz,NULL),
    (${TASK_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'guest_request','open','reservation',
      ${RESERVATION_B}::uuid,NULL,'transport',${DUE_AT}::timestamptz,3,
      '{"requestType":"arrival_pickup"}',${CREATED_AT}::timestamptz,NULL)`;
  await admin`INSERT INTO travel_detail(
      id,tenant_id,reservation_id,direction,mode,scheduled_at,pickup_requested,pickup_task_id
    ) VALUES
    (${TRAVEL_A}::uuid,${TENANT_A}::uuid,${RESERVATION_A}::uuid,'arrival','flight',
      ${DUE_AT}::timestamptz,true,${TASK_A}::uuid),
    (${TRAVEL_UNLINKED}::uuid,${TENANT_A}::uuid,${RESERVATION_UNLINKED}::uuid,'arrival','car',
      ${DUE_AT}::timestamptz,true,NULL),
    (${TRAVEL_B}::uuid,${TENANT_B}::uuid,${RESERVATION_B}::uuid,'arrival','train',
      ${DUE_AT}::timestamptz,true,${TASK_B}::uuid)`;
}, 30_000);

afterAll(async () => {
  await clean();
  await database?.close();
  await admin?.close();
}, 60_000);

describe("Order 215 reservation pickup-task detail input", () => {
  test("rejects malformed and widened input before SQL", async () => {
    let calls = 0;
    const noSql = (() => { calls += 1; return Promise.resolve([]); }) as unknown as Tx;
    const malformed = [
      input({ tenantId: "bad" }),
      input({ propertyNode: "bad" }),
      input({ reservationId: "bad" }),
      input({ taskId: "bad" }),
      { ...input(), query: "forbidden" },
      Object.create(input()),
      null,
    ];
    for (const candidate of malformed) {
      await expect(service.pickupTaskDetail(
        noSql,
        candidate as FindReservationPickupTaskDetailInput,
      )).rejects.toBeInstanceOf(ReservationDetailValidationError);
    }
    expect(calls).toBe(0);
  });
});

databaseDescribe("Order 215 fresh-PostgreSQL pickup-task detail proof", () => {
  test("returns only exact current canonical task truth, deeply frozen and without writes", async () => {
    const before = await admin!<{ tasks: number; travel: number; facts: number; outbox: number }[]>`
      SELECT
        (SELECT count(*)::int FROM task WHERE tenant_id = ${TENANT_A}::uuid) AS tasks,
        (SELECT count(*)::int FROM travel_detail WHERE tenant_id = ${TENANT_A}::uuid) AS travel,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${TENANT_A}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id = ${TENANT_A}::uuid) AS outbox
    `;
    const first = await find();
    const second = await find();
    expect(first).toEqual({
      taskId: TASK_A,
      reservationId: RESERVATION_A,
      confirmationNo: "Y-215-A",
      status: "open",
      dueAt: DUE_AT,
      priority: 3,
      createdAt: CREATED_AT,
      completedAt: null,
    });
    expect(Object.keys(first)).toEqual([
      "taskId", "reservationId", "confirmationNo", "status", "dueAt", "priority", "createdAt", "completedAt",
    ]);
    expect(Object.isFrozen(first)).toBeTrue();
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    const after = await admin!<{ tasks: number; travel: number; facts: number; outbox: number }[]>`
      SELECT
        (SELECT count(*)::int FROM task WHERE tenant_id = ${TENANT_A}::uuid) AS tasks,
        (SELECT count(*)::int FROM travel_detail WHERE tenant_id = ${TENANT_A}::uuid) AS travel,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${TENANT_A}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id = ${TENANT_A}::uuid) AS outbox
    `;
    expect(after).toEqual(before);
  });

  test("returns every existing task status and current completion truth without inference", async () => {
    const statuses: readonly ReservationPickupTaskStatus[] =
      ["open", "assigned", "in_progress", "done", "verified", "cancelled"];
    for (const status of statuses) {
      const completedAt = status === "done" || status === "verified" || status === "cancelled"
        ? COMPLETED_AT
        : null;
      await admin!`UPDATE task
        SET status = ${status}, completed_at = ${completedAt}::timestamptz
        WHERE tenant_id = ${TENANT_A}::uuid AND id = ${TASK_A}::uuid`;
      expect(await find()).toMatchObject({ status, completedAt });
    }
    await admin!`UPDATE task SET status = 'open', completed_at = NULL
      WHERE tenant_id = ${TENANT_A}::uuid AND id = ${TASK_A}::uuid`;
  });

  test("conceals wrong property, reservation, task identity, unlinked and cross-tenant truth", async () => {
    const concealed: Array<[FindReservationPickupTaskDetailInput, string]> = [
      [input({ propertyNode: PROPERTY_A2 }), TENANT_A],
      [input({ reservationId: RESERVATION_UNLINKED, taskId: TASK_OTHER }), TENANT_A],
      [input({ taskId: TASK_OTHER }), TENANT_A],
      [input({ taskId: TASK_B }), TENANT_A],
      [input(), TENANT_B],
      [{ tenantId: TENANT_B, propertyNode: PROPERTY_B, reservationId: RESERVATION_B, taskId: TASK_B }, TENANT_A],
    ];
    for (const [candidate, contextTenant] of concealed) {
      await expect(find(candidate, contextTenant)).rejects.toBeInstanceOf(ReservationDetailNotFoundError);
    }
  });

  test("fails closed when the exact current link has a hostile canonical shape", async () => {
    const taskMutations: Array<[string, () => Promise<unknown>, () => Promise<unknown>]> = [
      ["property", () => admin!`UPDATE task SET property_node=${PROPERTY_A2}::uuid WHERE id=${TASK_A}::uuid`,
        () => admin!`UPDATE task SET property_node=${PROPERTY_A}::uuid WHERE id=${TASK_A}::uuid`],
      ["kind", () => admin!`UPDATE task SET kind='trace' WHERE id=${TASK_A}::uuid`,
        () => admin!`UPDATE task SET kind='guest_request' WHERE id=${TASK_A}::uuid`],
      ["subject type", () => admin!`UPDATE task SET subject_type='party' WHERE id=${TASK_A}::uuid`,
        () => admin!`UPDATE task SET subject_type='reservation' WHERE id=${TASK_A}::uuid`],
      ["subject id", () => admin!`UPDATE task SET subject_id=${RESERVATION_UNLINKED}::uuid WHERE id=${TASK_A}::uuid`,
        () => admin!`UPDATE task SET subject_id=${RESERVATION_A}::uuid WHERE id=${TASK_A}::uuid`],
      ["department", () => admin!`UPDATE task SET department='front_desk' WHERE id=${TASK_A}::uuid`,
        () => admin!`UPDATE task SET department='transport' WHERE id=${TASK_A}::uuid`],
      ["due time", () => admin!`UPDATE task SET due_at='2026-08-28T10:11:13.123456Z' WHERE id=${TASK_A}::uuid`,
        () => admin!`UPDATE task SET due_at=${DUE_AT}::timestamptz WHERE id=${TASK_A}::uuid`],
      ["priority", () => admin!`UPDATE task SET priority=2 WHERE id=${TASK_A}::uuid`,
        () => admin!`UPDATE task SET priority=3 WHERE id=${TASK_A}::uuid`],
      ["payload", () => admin!`UPDATE task SET payload='{"requestType":"arrival_pickup","extra":true}' WHERE id=${TASK_A}::uuid`,
        () => admin!`UPDATE task SET payload='{"requestType":"arrival_pickup"}' WHERE id=${TASK_A}::uuid`],
    ];
    for (const [name, makeHostile, restore] of taskMutations) {
      await makeHostile();
      await expect(find()).rejects.toBeInstanceOf(ReservationDetailConflictError);
      await restore();
      expect((await find()).taskId, name).toBe(TASK_A);
    }

    await admin!`UPDATE travel_detail SET pickup_task_id=${TASK_B}::uuid
      WHERE tenant_id=${TENANT_A}::uuid AND id=${TRAVEL_A}::uuid`;
    await expect(find(input({ taskId: TASK_B }))).rejects.toBeInstanceOf(ReservationDetailConflictError);
    await admin!`UPDATE travel_detail SET pickup_task_id=${TASK_A}::uuid
      WHERE tenant_id=${TENANT_A}::uuid AND id=${TRAVEL_A}::uuid`;
  });
});
