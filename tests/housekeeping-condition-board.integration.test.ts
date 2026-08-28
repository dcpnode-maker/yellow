import { afterAll, beforeAll, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  HousekeepingConflictError,
  HousekeepingTaskService,
  HousekeepingValidationError,
  type HousekeepingRoomCondition,
} from "../src/contexts/housekeeping";
import { Database, type Tx } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_HOUSEKEEPING_CONDITION_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_HOUSEKEEPING_CONDITION === "1";
if (REQUIRED && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error(
    "YELLOW_DEPLOY_DATABASE_URL and YELLOW_HOUSEKEEPING_CONDITION_URL (or YELLOW_RUNTIME_DATABASE_URL) are required",
  );
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000020801";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000020802";
const PROPERTY = "00000000-0000-0000-0000-000000020811";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000020812";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000020813";

const ROOMS = Object.freeze({
  first: "00000000-0000-0000-0000-000000020821",
  second: "00000000-0000-0000-0000-000000020822",
  third: "00000000-0000-0000-0000-000000020823",
  inactive: "00000000-0000-0000-0000-000000020824",
  other: "00000000-0000-0000-0000-000000020825",
  foreign: "00000000-0000-0000-0000-000000020826",
  noCondition: "00000000-0000-0000-0000-000000020827",
});

let deploy: SQL | undefined;
let database: Database | undefined;
let service: HousekeepingTaskService | undefined;

function listInput(overrides: Partial<Readonly<{
  tenantId: string;
  propertyNode: string;
  condition: HousekeepingRoomCondition;
  cursor: string;
  limit: number;
}>> = {}) {
  return Object.freeze({ tenantId: TENANT, propertyNode: PROPERTY, ...overrides });
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await deploy`DELETE FROM public.unit_condition
    WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM public.space
    WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM public.org_node
    WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM public.tenant
    WHERE id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
}

async function seedRooms(): Promise<void> {
  await deploy!`INSERT INTO public.space(
      id,tenant_id,property_node,code,profile_key,status,floor,attrs
    ) VALUES
    (${ROOMS.second}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'208-B','hotel','active','2',
      '{"private":"never disclose"}'::jsonb),
    (${ROOMS.first}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'208-A','hotel','active','1','{}'::jsonb),
    (${ROOMS.third}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'208-b','hotel','active',NULL,'{}'::jsonb),
    (${ROOMS.inactive}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'208-INACTIVE','hotel','inactive','9','{}'::jsonb),
    (${ROOMS.other}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'208-OTHER','hotel','active','8','{}'::jsonb),
    (${ROOMS.foreign}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'208-FOREIGN','hotel','active','7','{}'::jsonb),
    (${ROOMS.noCondition}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'208-NO-CONDITION','hotel','active','6','{}'::jsonb)`;
  await deploy!`INSERT INTO public.unit_condition(tenant_id,space_id,condition,updated_at,updated_by) VALUES
    (${TENANT}::uuid,${ROOMS.first}::uuid,'dirty','2026-08-28T01:02:03.123456Z'::timestamptz,
      '00000000-0000-0000-0000-000000020831'::uuid),
    (${TENANT}::uuid,${ROOMS.second}::uuid,'clean','2026-08-28T02:03:04.234567Z'::timestamptz,
      '00000000-0000-0000-0000-000000020832'::uuid),
    (${TENANT}::uuid,${ROOMS.third}::uuid,'dirty','2026-08-28T03:04:05.345678Z'::timestamptz,
      '00000000-0000-0000-0000-000000020833'::uuid),
    (${TENANT}::uuid,${ROOMS.inactive}::uuid,'pickup','2026-08-28T04:05:06.456789Z'::timestamptz,NULL),
    (${TENANT}::uuid,${ROOMS.other}::uuid,'inspected','2026-08-28T05:06:07.567890Z'::timestamptz,NULL),
    (${FOREIGN_TENANT}::uuid,${ROOMS.foreign}::uuid,'dirty','2026-08-28T06:07:08.678901Z'::timestamptz,NULL)`;
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 4, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 8, prepare: false });
  service = new HousekeepingTaskService({
    database,
    events: null as never,
    idempotency: null as never,
  });
  await cleanup();
  await deploy`INSERT INTO public.tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order208','Order 208','shared','active'),
    (${FOREIGN_TENANT}::uuid,'order208-foreign','Order 208 Foreign','shared','active')`;
  await deploy`INSERT INTO public.org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order208'::ltree,'property','Order 208','UTC','USD'),
    (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order208.other'::ltree,'property','Order 208 Other','UTC','USD'),
    (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order208_foreign'::ltree,'property','Foreign','UTC','USD')`;
});

beforeEach(async () => {
  if (!deploy) return;
  await deploy`DELETE FROM public.unit_condition
    WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM public.space
    WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await seedRooms();
});

afterAll(async () => {
  await cleanup();
  await database?.close();
  await deploy?.close({ timeout: 0 });
});

databaseDescribe("Order 208 governed room-condition read", () => {
  test("P1 returns deeply frozen minimized rows in exact C-collated code/id keyset pages", async () => {
    const first = await service!.listConditions(listInput({ limit: 1 }));
    expect(first.rooms).toEqual([{
      spaceId: ROOMS.first,
      code: "208-A",
      floor: "1",
      condition: "dirty",
      updatedAt: "2026-08-28T01:02:03.123456Z",
    }]);
    expect(first.nextCursor).toBeString();
    const second = await service!.listConditions(listInput({ limit: 1, cursor: first.nextCursor! }));
    expect(second.rooms[0]).toEqual({
      spaceId: ROOMS.second,
      code: "208-B",
      floor: "2",
      condition: "clean",
      updatedAt: "2026-08-28T02:03:04.234567Z",
    });
    const third = await service!.listConditions(listInput({ limit: 1, cursor: second.nextCursor! }));
    expect(third.rooms.map((room) => room.spaceId)).toEqual([ROOMS.third]);
    expect(third.nextCursor).toBeNull();
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.rooms)).toBe(true);
    expect(Object.isFrozen(first.rooms[0])).toBe(true);
    const bytes = JSON.stringify(first);
    expect(bytes).not.toContain("updatedBy");
    expect(bytes).not.toContain("private");
    expect(Object.keys(first.rooms[0]!)).toEqual(["spaceId", "code", "floor", "condition", "updatedAt"]);
  });

  test("P1 literal condition filter is cursor-bound and default/max limits are accepted", async () => {
    const dirty = await service!.listConditions(listInput({ condition: "dirty", limit: 1 }));
    expect(dirty.rooms.map((room) => room.spaceId)).toEqual([ROOMS.first]);
    expect(dirty.nextCursor).toBeString();
    const next = await service!.listConditions(listInput({
      condition: "dirty", limit: 100, cursor: dirty.nextCursor!,
    }));
    expect(next.rooms.map((room) => room.spaceId)).toEqual([ROOMS.third]);
    expect((await service!.listConditions(listInput())).rooms).toHaveLength(3);
    await expect(service!.listConditions(listInput({ condition: "clean", cursor: dirty.nextCursor! })))
      .rejects.toBeInstanceOf(HousekeepingValidationError);
    await expect(service!.listConditions(listInput({ cursor: dirty.nextCursor! })))
      .rejects.toBeInstanceOf(HousekeepingValidationError);
  });

  test("P2 rejects malformed inputs and non-canonical cursors", async () => {
    await expect(service!.listConditions(listInput({ tenantId: "NOT-A-UUID" })))
      .rejects.toBeInstanceOf(HousekeepingValidationError);
    await expect(service!.listConditions({ ...listInput(), extra: true } as never))
      .rejects.toBeInstanceOf(HousekeepingValidationError);
    await expect(service!.listConditions(listInput({ condition: "unknown" as never })))
      .rejects.toBeInstanceOf(HousekeepingValidationError);
    for (const limit of [0, 101, 1.5, Number.NaN]) {
      await expect(service!.listConditions(listInput({ limit })))
        .rejects.toBeInstanceOf(HousekeepingValidationError);
    }
    await expect(service!.listConditions(listInput({ cursor: "not-a-canonical-cursor" })))
      .rejects.toBeInstanceOf(HousekeepingValidationError);
    const cursor = (await service!.listConditions(listInput({ limit: 1 }))).nextCursor!;
    await expect(service!.listConditions(listInput({ cursor: `${cursor}A` })))
      .rejects.toBeInstanceOf(HousekeepingValidationError);
  });

  test("P2 conceals inactive, other-property and foreign-tenant condition truth", async () => {
    expect((await service!.listConditions(listInput())).rooms.map((room) => room.spaceId))
      .toEqual([ROOMS.first, ROOMS.second, ROOMS.third]);
    expect((await service!.listConditions(listInput({ propertyNode: OTHER_PROPERTY }))).rooms)
      .toEqual([{
        spaceId: ROOMS.other, code: "208-OTHER", floor: "8", condition: "inspected",
        updatedAt: "2026-08-28T05:06:07.567890Z",
      }]);
    expect((await service!.listConditions(listInput({ propertyNode: FOREIGN_PROPERTY }))).rooms)
      .toHaveLength(0);
  });

  test("P2 repeated reads are byte-equivalent and mutate no condition or shared truth", async () => {
    const before = await deploy!`
      SELECT
        (SELECT jsonb_agg(to_jsonb(room) ORDER BY room.id) FROM public.space AS room
          WHERE room.tenant_id=${TENANT}::uuid) AS rooms,
        (SELECT jsonb_agg(to_jsonb(condition) ORDER BY condition.space_id)
          FROM public.unit_condition AS condition WHERE condition.tenant_id=${TENANT}::uuid) AS conditions,
        (SELECT count(*)::int FROM public.task WHERE tenant_id=${TENANT}::uuid) AS tasks,
        (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${TENANT}::uuid) AS facts,
        (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${TENANT}::uuid) AS events,
        (SELECT count(*)::int FROM public.space_occupancy WHERE tenant_id=${TENANT}::uuid) AS occupancies
    `;
    const results = await Promise.all(Array.from({ length: 12 }, () =>
      service!.listConditions(listInput({ condition: "dirty" }))));
    const bytes = JSON.stringify(results[0]);
    expect(results.every((result) => JSON.stringify(result) === bytes)).toBe(true);
    const after = await deploy!`
      SELECT
        (SELECT jsonb_agg(to_jsonb(room) ORDER BY room.id) FROM public.space AS room
          WHERE room.tenant_id=${TENANT}::uuid) AS rooms,
        (SELECT jsonb_agg(to_jsonb(condition) ORDER BY condition.space_id)
          FROM public.unit_condition AS condition WHERE condition.tenant_id=${TENANT}::uuid) AS conditions,
        (SELECT count(*)::int FROM public.task WHERE tenant_id=${TENANT}::uuid) AS tasks,
        (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${TENANT}::uuid) AS facts,
        (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${TENANT}::uuid) AS events,
        (SELECT count(*)::int FROM public.space_occupancy WHERE tenant_id=${TENANT}::uuid) AS occupancies
    `;
    expect(after).toEqual(before);
  });
});

describe("Order 208 stored room-condition validation", () => {
  function fakeService(rows: readonly Record<string, unknown>[]) {
    const tx = (() => Promise.resolve(rows)) as unknown as Tx;
    const fakeDatabase = {
      withTenantTransaction: async <T>(_tenantId: string, operation: (inner: Tx) => Promise<T>) => operation(tx),
    } as Database;
    return new HousekeepingTaskService({
      database: fakeDatabase,
      events: null as never,
      idempotency: null as never,
    });
  }

  const valid = Object.freeze({
    id: ROOMS.first,
    code: "208-A",
    floor: "1",
    condition: "clean",
    updated_at: "2026-08-28T01:02:03.123456Z",
  });

  test("P2 fails malformed stored UUID, condition and canonical timestamp closed", async () => {
    for (const row of [
      { ...valid, id: "not-a-uuid" },
      { ...valid, condition: "ready" },
      { ...valid, updated_at: "2026-08-28T01:02:03.123Z" },
    ]) {
      await expect(fakeService([row]).listConditions(listInput()))
        .rejects.toBeInstanceOf(HousekeepingConflictError);
    }
  });

  test("P1 canonical cursors preserve Unicode room codes as UTF-8", async () => {
    const page = await fakeService([
      { ...valid, code: "कमरा-208" },
      { ...valid, id: ROOMS.second, code: "客室-208" },
    ]).listConditions(listInput({ limit: 1 }));
    expect(page.rooms[0]?.code).toBe("कमरा-208");
    expect(page.nextCursor).toBeString();
    await expect(fakeService([{ ...valid, code: "कमरा-208" }]).listConditions(
      listInput({ limit: 1, cursor: page.nextCursor! }),
    )).resolves.toMatchObject({ rooms: [{ code: "कमरा-208" }] });
  });
});
