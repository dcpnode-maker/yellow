import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  HousekeepingConflictError,
  HousekeepingNotFoundError,
  HousekeepingTaskService,
  HousekeepingValidationError,
  type HousekeepingTaskDetailInput,
} from "../src/contexts/housekeeping";
import { Database } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_HOUSEKEEPING_TASK_DETAIL_URL ??
  process.env.YELLOW_HOUSEKEEPING_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_HOUSEKEEPING_TASK_DETAIL === "1";
if (REQUIRED && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_HOUSEKEEPING_TASK_DETAIL_URL (or housekeeping/runtime fallback) are required");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000021701";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000021702";
const PROPERTY = "00000000-0000-0000-0000-000000021711";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000021712";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000021713";
const ATTENDANT = "00000000-0000-0000-0000-000000021721";
const FOREIGN_ATTENDANT = "00000000-0000-0000-0000-000000021722";

const SPACES = Object.freeze({
  assigned: "00000000-0000-0000-0000-000000021731",
  inProgress: "00000000-0000-0000-0000-000000021732",
  done: "00000000-0000-0000-0000-000000021733",
  otherProperty: "00000000-0000-0000-0000-000000021734",
  wrongKind: "00000000-0000-0000-0000-000000021735",
  wrongSubject: "00000000-0000-0000-0000-000000021736",
  verified: "00000000-0000-0000-0000-000000021737",
  cancelled: "00000000-0000-0000-0000-000000021738",
  inactive: "00000000-0000-0000-0000-000000021739",
  noCondition: "00000000-0000-0000-0000-00000002173a",
  foreign: "00000000-0000-0000-0000-00000002173b",
});

const TASKS = Object.freeze({
  assigned: "00000000-0000-0000-0000-000000021741",
  inProgress: "00000000-0000-0000-0000-000000021742",
  done: "00000000-0000-0000-0000-000000021743",
  otherProperty: "00000000-0000-0000-0000-000000021744",
  wrongKind: "00000000-0000-0000-0000-000000021745",
  wrongSubject: "00000000-0000-0000-0000-000000021746",
  verified: "00000000-0000-0000-0000-000000021747",
  cancelled: "00000000-0000-0000-0000-000000021748",
  inactive: "00000000-0000-0000-0000-000000021749",
  noCondition: "00000000-0000-0000-0000-00000002174a",
  foreign: "00000000-0000-0000-0000-00000002174b",
});

const UPDATED_AT = "2026-08-28T01:02:03.123Z";
const DUE_AT = "2026-08-28T08:09:10.654Z";
const COMPLETED_AT = "2026-08-28T09:10:11.987Z";

let deploy: SQL | undefined;
let database: Database | undefined;
let service: HousekeepingTaskService | undefined;

function input(taskId: string = TASKS.assigned): HousekeepingTaskDetailInput {
  return Object.freeze({ tenantId: TENANT, propertyNode: PROPERTY, taskId });
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await deploy`DELETE FROM public.task WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM public.unit_condition WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM public.space WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM public.party WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM public.org_node WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM public.tenant WHERE id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 4, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 8, prepare: false });
  service = new HousekeepingTaskService({ database, events: {} as never, idempotency: {} as never });
  await cleanup();
  await deploy`INSERT INTO public.tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order217','Order 217','shared','active'),
    (${FOREIGN_TENANT}::uuid,'order217-foreign','Order 217 Foreign','shared','active')`;
  await deploy`INSERT INTO public.org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order217'::ltree,'property','Order 217','UTC','USD'),
    (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order217.other'::ltree,'property','Order 217 Other','UTC','USD'),
    (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order217_foreign'::ltree,'property','Order 217 Foreign','UTC','USD')`;
  await deploy`INSERT INTO public.party(id,tenant_id,kind,display_name,status) VALUES
    (${ATTENDANT}::uuid,${TENANT}::uuid,'person','Order 217 Attendant','active'),
    (${FOREIGN_ATTENDANT}::uuid,${FOREIGN_TENANT}::uuid,'person','Foreign Attendant','active')`;
  await deploy`INSERT INTO public.space(id,tenant_id,property_node,code,profile_key,status,floor) VALUES
    (${SPACES.assigned}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'217-A','standard','active','1'),
    (${SPACES.inProgress}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'217-I','standard','active','2'),
    (${SPACES.done}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'217-D','standard','active','3'),
    (${SPACES.otherProperty}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'217-O','standard','active','4'),
    (${SPACES.wrongKind}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'217-K','standard','active','5'),
    (${SPACES.wrongSubject}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'217-S','standard','active','5'),
    (${SPACES.verified}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'217-V','standard','active','6'),
    (${SPACES.cancelled}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'217-C','standard','active','6'),
    (${SPACES.inactive}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'217-X','standard','inactive','7'),
    (${SPACES.noCondition}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'217-N','standard','active','7'),
    (${SPACES.foreign}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'217-F','standard','active','1')`;
  await deploy`INSERT INTO public.unit_condition(tenant_id,space_id,condition,updated_at) VALUES
    (${TENANT}::uuid,${SPACES.assigned}::uuid,'dirty',${UPDATED_AT}::timestamptz),
    (${TENANT}::uuid,${SPACES.inProgress}::uuid,'pickup',${UPDATED_AT}::timestamptz),
    (${TENANT}::uuid,${SPACES.done}::uuid,'clean',${UPDATED_AT}::timestamptz),
    (${TENANT}::uuid,${SPACES.otherProperty}::uuid,'dirty',${UPDATED_AT}::timestamptz),
    (${TENANT}::uuid,${SPACES.wrongKind}::uuid,'dirty',${UPDATED_AT}::timestamptz),
    (${TENANT}::uuid,${SPACES.wrongSubject}::uuid,'dirty',${UPDATED_AT}::timestamptz),
    (${TENANT}::uuid,${SPACES.verified}::uuid,'inspected',${UPDATED_AT}::timestamptz),
    (${TENANT}::uuid,${SPACES.cancelled}::uuid,'dirty',${UPDATED_AT}::timestamptz),
    (${TENANT}::uuid,${SPACES.inactive}::uuid,'dirty',${UPDATED_AT}::timestamptz),
    (${FOREIGN_TENANT}::uuid,${SPACES.foreign}::uuid,'dirty',${UPDATED_AT}::timestamptz)`;
  await deploy`INSERT INTO public.task(
      id,tenant_id,property_node,kind,status,subject_type,subject_id,assignee_party,due_at,priority,completed_at,payload,credits,sheet_id
    ) VALUES
    (${TASKS.assigned}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','assigned','space',${SPACES.assigned}::uuid,${ATTENDANT}::uuid,${DUE_AT}::timestamptz,1,NULL,'{"private":"not disclosed"}',7,NULL),
    (${TASKS.inProgress}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','in_progress','space',${SPACES.inProgress}::uuid,NULL,NULL,2,NULL,'{}',NULL,NULL),
    (${TASKS.done}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','done','space',${SPACES.done}::uuid,${ATTENDANT}::uuid,NULL,3,${COMPLETED_AT}::timestamptz,'{}',NULL,NULL),
    (${TASKS.otherProperty}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'housekeeping','assigned','space',${SPACES.otherProperty}::uuid,${ATTENDANT}::uuid,NULL,4,NULL,'{}',NULL,NULL),
    (${TASKS.wrongKind}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'work_order','assigned','space',${SPACES.wrongKind}::uuid,${ATTENDANT}::uuid,NULL,5,NULL,'{}',NULL,NULL),
    (${TASKS.wrongSubject}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','assigned','party',${SPACES.wrongSubject}::uuid,${ATTENDANT}::uuid,NULL,5,NULL,'{}',NULL,NULL),
    (${TASKS.verified}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','verified','space',${SPACES.verified}::uuid,${ATTENDANT}::uuid,NULL,6,${COMPLETED_AT}::timestamptz,'{}',NULL,NULL),
    (${TASKS.cancelled}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','cancelled','space',${SPACES.cancelled}::uuid,${ATTENDANT}::uuid,NULL,6,${COMPLETED_AT}::timestamptz,'{}',NULL,NULL),
    (${TASKS.inactive}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','assigned','space',${SPACES.inactive}::uuid,${ATTENDANT}::uuid,NULL,7,NULL,'{}',NULL,NULL),
    (${TASKS.noCondition}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'housekeeping','assigned','space',${SPACES.noCondition}::uuid,${ATTENDANT}::uuid,NULL,7,NULL,'{}',NULL,NULL),
    (${TASKS.foreign}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'housekeeping','assigned','space',${SPACES.foreign}::uuid,${FOREIGN_ATTENDANT}::uuid,NULL,1,NULL,'{}',NULL,NULL)`;
}, 30_000);

afterAll(async () => {
  await cleanup();
  await database?.close();
  await deploy?.close({ timeout: 0 });
});

describe("Order 217 housekeeping-task detail input", () => {
  test("rejects malformed and widened input before SQL", async () => {
    let calls = 0;
    const noSql = { withTenantTransaction: () => { calls += 1; return Promise.resolve([]); } } as unknown as Database;
    const validating = new HousekeepingTaskService({ database: noSql, events: {} as never, idempotency: {} as never });
    for (const malformed of [
      { ...input(), tenantId: "bad" },
      { ...input(), propertyNode: "bad" },
      { ...input(), taskId: "bad" },
      { ...input(), query: "forbidden" },
      Object.create(input()),
      null,
    ]) {
      await expect(validating.get(malformed as HousekeepingTaskDetailInput))
        .rejects.toBeInstanceOf(HousekeepingValidationError);
    }
    expect(calls).toBe(0);
  });
});

databaseDescribe("Order 217 exact housekeeping-task detail", () => {
  test("P1 returns only assigned, in-progress and done canonical truth as frozen rows", async () => {
    const assigned = await service!.get(input());
    expect(assigned).toEqual({
      taskId: TASKS.assigned,
      taskStatus: "assigned",
      spaceId: SPACES.assigned,
      spaceCode: "217-A",
      floor: "1",
      roomCondition: "dirty",
      roomUpdatedAt: UPDATED_AT,
      assigned: true,
      dueAt: DUE_AT,
      priority: 1,
      completedAt: null,
    });
    expect(Object.keys(assigned)).toEqual([
      "taskId", "taskStatus", "spaceId", "spaceCode", "floor", "roomCondition",
      "roomUpdatedAt", "assigned", "dueAt", "priority", "completedAt",
    ]);
    expect(Object.isFrozen(assigned)).toBeTrue();
    expect(await service!.get(input(TASKS.inProgress))).toMatchObject({
      taskStatus: "in_progress", roomCondition: "pickup", assigned: false,
    });
    expect(await service!.get(input(TASKS.done))).toMatchObject({
      taskStatus: "done", roomCondition: "clean", completedAt: COMPLETED_AT,
    });
    expect(JSON.stringify(assigned)).not.toMatch(/private|payload|credits|sheet|assignee|party|contact|guest|occupancy/i);
  });

  test("P2 conceals absent, foreign, wrong-property/kind/subject/status and inactive-room truth", async () => {
    for (const taskId of [
      TASKS.otherProperty, TASKS.wrongKind, TASKS.wrongSubject, TASKS.verified,
      TASKS.cancelled, TASKS.inactive, TASKS.noCondition, TASKS.foreign, crypto.randomUUID(),
    ]) {
      await expect(service!.get(input(taskId))).rejects.toBeInstanceOf(HousekeepingNotFoundError);
    }
    await expect(service!.get({ ...input(TASKS.otherProperty), propertyNode: PROPERTY }))
      .rejects.toBeInstanceOf(HousekeepingNotFoundError);
    await expect(service!.get({ ...input(TASKS.foreign), propertyNode: FOREIGN_PROPERTY }))
      .rejects.toBeInstanceOf(HousekeepingNotFoundError);
  });

  test("P2 hostile stored display shapes fail closed without partial disclosure", async () => {
    await deploy!`UPDATE public.space SET code=${"hostile\nroom"}
      WHERE tenant_id=${TENANT}::uuid AND id=${SPACES.assigned}::uuid`;
    const error = await service!.get(input()).then(() => null, (caught: unknown) => caught);
    expect(error).toBeInstanceOf(HousekeepingConflictError);
    expect(String(error)).not.toContain("hostile");
    await deploy!`UPDATE public.space SET code='217-A'
      WHERE tenant_id=${TENANT}::uuid AND id=${SPACES.assigned}::uuid`;
  });

  test("P1 repeated reads are byte-equivalent and mutate no task, room or evidence truth", async () => {
    const before = await deploy!`
      SELECT
        (SELECT jsonb_agg(to_jsonb(task) ORDER BY task.id) FROM public.task WHERE tenant_id=${TENANT}::uuid) AS tasks,
        (SELECT jsonb_agg(to_jsonb(condition) ORDER BY condition.space_id) FROM public.unit_condition AS condition WHERE tenant_id=${TENANT}::uuid) AS conditions,
        (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${TENANT}::uuid) AS facts,
        (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${TENANT}::uuid) AS events,
        (SELECT count(*)::int FROM public.space_occupancy WHERE tenant_id=${TENANT}::uuid) AS occupancies
    `;
    const rows = await Promise.all(Array.from({ length: 12 }, () => service!.get(input())));
    const bytes = JSON.stringify(rows[0]);
    expect(rows.every((row) => JSON.stringify(row) === bytes)).toBeTrue();
    const after = await deploy!`
      SELECT
        (SELECT jsonb_agg(to_jsonb(task) ORDER BY task.id) FROM public.task WHERE tenant_id=${TENANT}::uuid) AS tasks,
        (SELECT jsonb_agg(to_jsonb(condition) ORDER BY condition.space_id) FROM public.unit_condition AS condition WHERE tenant_id=${TENANT}::uuid) AS conditions,
        (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${TENANT}::uuid) AS facts,
        (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${TENANT}::uuid) AS events,
        (SELECT count(*)::int FROM public.space_occupancy WHERE tenant_id=${TENANT}::uuid) AS occupancies
    `;
    expect(after).toEqual(before);
  });
});
