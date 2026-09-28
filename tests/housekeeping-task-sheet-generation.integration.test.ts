import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  HousekeepingSheetConflictError,
  HousekeepingSheetNotFoundError,
  HousekeepingSheetService,
  HousekeepingUnsupportedCadenceError,
} from "../src/contexts/housekeeping";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
} from "../src/kernel";

setDefaultTimeout(40_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_HOUSEKEEPING_SHEET_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_HOUSEKEEPING_SHEET === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_HOUSEKEEPING_SHEET_URL (or YELLOW_RUNTIME_DATABASE_URL) are required");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000022001";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000022002";
const ACTOR = "00000000-0000-0000-0000-000000022011";
const FOREIGN_ACTOR = "00000000-0000-0000-0000-000000022012";
const ATTENDANT = "00000000-0000-0000-0000-000000022021";
const OTHER_ATTENDANT = "00000000-0000-0000-0000-000000022022";
const NONSTAFF = "00000000-0000-0000-0000-000000022023";
const INACTIVE_ATTENDANT = "00000000-0000-0000-0000-000000022024";
const GUEST = "00000000-0000-0000-0000-000000022025";

const PROPERTIES = Object.freeze({
  daily: "00000000-0000-0000-0000-000000022101",
  departure: "00000000-0000-0000-0000-000000022102",
  rollback: "00000000-0000-0000-0000-000000022103",
  weekly: "00000000-0000-0000-0000-000000022104",
  missing: "00000000-0000-0000-0000-000000022105",
  mixed: "00000000-0000-0000-0000-000000022106",
  foreign: "00000000-0000-0000-0000-000000022107",
});

interface StayFixture {
  readonly spaceId: string;
  readonly segmentId: string;
  readonly propertyNode: string;
}

let deploy: SQL | undefined;
let directRuntime: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let service: HousekeepingSheetService | undefined;
const fixtures: StayFixture[] = [];

function audit(
  requestId: string = crypto.randomUUID(),
  actorId: string = ACTOR,
  tenantId: string = TENANT,
  propertyNode: string = PROPERTIES.daily,
) {
  return createAuditEnvelope({ actorId, tenantId, propertyNode, requestId, operation: "task.created" });
}

async function occupiedStay(input: {
  propertyNode: string;
  profileKey: string;
  period: string;
  code: string;
  duplicatePosition?: boolean;
}): Promise<StayFixture> {
  const unitType = crypto.randomUUID();
  const sellable = crypto.randomUUID();
  const spaceId = crypto.randomUUID();
  const ratePlan = crypto.randomUUID();
  const reservation = crypto.randomUUID();
  const segmentId = crypto.randomUUID();
  await deploy!`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key)
    VALUES (${unitType}::uuid,${TENANT}::uuid,${input.propertyNode}::uuid,${`UT-${input.code}`},${input.code},${input.profileKey})`;
  await deploy!`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status,floor)
    VALUES (${spaceId}::uuid,${TENANT}::uuid,${input.propertyNode}::uuid,${input.code},${input.profileKey},2,'active','1')`;
  await deploy!`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status)
    VALUES (${sellable}::uuid,${TENANT}::uuid,${unitType}::uuid,${input.code},'active')`;
  await deploy!`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode)
    VALUES (${TENANT}::uuid,${sellable}::uuid,${spaceId}::uuid,'positional')`;
  await deploy!`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive)
    VALUES (${ratePlan}::uuid,${TENANT}::uuid,${input.propertyNode}::uuid,${`RP-${input.code}`},${input.code},'INR',false)`;
  await deploy!`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency)
    VALUES (${reservation}::uuid,${TENANT}::uuid,${input.propertyNode}::uuid,${`CONF-${input.code}`},'in_house',${GUEST}::uuid,'direct','INR')`;
  await deploy!`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,rate_plan_id,status)
    VALUES (${segmentId}::uuid,${TENANT}::uuid,${reservation}::uuid,1,${unitType}::uuid,${sellable}::uuid,${input.period}::tstzrange,${ratePlan}::uuid,'in_house')`;
  await deploy!`INSERT INTO space_occupancy(tenant_id,space_id,period,slot_ref,slot_kind,exclusive,claim)
    VALUES (${TENANT}::uuid,${spaceId}::uuid,${input.period}::tstzrange,${segmentId}::uuid,'segment',false,int4range(0,1))`;
  if (input.duplicatePosition) {
    await deploy!`INSERT INTO space_occupancy(tenant_id,space_id,period,slot_ref,slot_kind,exclusive,claim)
      VALUES (${TENANT}::uuid,${spaceId}::uuid,${input.period}::tstzrange,${segmentId}::uuid,'segment',false,int4range(1,2))`;
  }
  const fixture = Object.freeze({ spaceId, segmentId, propertyNode: input.propertyNode });
  fixtures.push(fixture);
  return fixture;
}

async function expectState(operation: PromiseLike<unknown>, sqlState: string): Promise<void> {
  try {
    await operation;
    throw new Error(`expected SQLSTATE ${sqlState}`);
  } catch (error) {
    expect(error).toMatchObject({ errno: sqlState });
  }
}

databaseDescribe("Order 202 governed housekeeping task sheet generation", () => {
  let daily: StayFixture;
  let departure: StayFixture;
  let rollback: StayFixture;

  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 8, prepare: false });
    directRuntime = new SQL(RUNTIME_URL!, { max: 4, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 12, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 48, prepare: false });
    service = new HousekeepingSheetService({
      database,
      events: new PostgresEventBus(eventPool),
      idempotency: new PostgresIdempotency(),
    });

    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT}::uuid,'order202','Order 202','shared','active'),
      (${FOREIGN_TENANT}::uuid,'order202-foreign','Order 202 Foreign','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTIES.daily}::uuid,${TENANT}::uuid,'order202.daily'::ltree,'property','Daily','Asia/Kolkata','INR'),
      (${PROPERTIES.departure}::uuid,${TENANT}::uuid,'order202.departure'::ltree,'property','Departure','America/Toronto','INR'),
      (${PROPERTIES.rollback}::uuid,${TENANT}::uuid,'order202.rollback'::ltree,'property','Rollback','Asia/Kolkata','INR'),
      (${PROPERTIES.weekly}::uuid,${TENANT}::uuid,'order202.weekly'::ltree,'property','Weekly','UTC','INR'),
      (${PROPERTIES.missing}::uuid,${TENANT}::uuid,'order202.missing'::ltree,'property','Missing','UTC','INR'),
      (${PROPERTIES.mixed}::uuid,${TENANT}::uuid,'order202.mixed'::ltree,'property','Mixed','UTC','INR'),
      (${PROPERTIES.foreign}::uuid,${FOREIGN_TENANT}::uuid,'order202_foreign.property'::ltree,'property','Foreign','UTC','USD')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR}::uuid,${TENANT}::uuid,'actor@order202.local','Actor','active'),
      (${FOREIGN_ACTOR}::uuid,${FOREIGN_TENANT}::uuid,'foreign@order202.local','Foreign','active')`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
      (${ATTENDANT}::uuid,${TENANT}::uuid,'person','Avery Housekeeping','active'),
      (${OTHER_ATTENDANT}::uuid,${TENANT}::uuid,'person','Other Attendant','active'),
      (${NONSTAFF}::uuid,${TENANT}::uuid,'person','Not Staff','active'),
      (${INACTIVE_ATTENDANT}::uuid,${TENANT}::uuid,'person','Inactive Staff','merged'),
      (${GUEST}::uuid,${TENANT}::uuid,'person','Guest','active')`;
    await deploy`INSERT INTO party_role(tenant_id,party_id,role) VALUES
      (${TENANT}::uuid,${ATTENDANT}::uuid,'staff'),
      (${TENANT}::uuid,${OTHER_ATTENDANT}::uuid,'staff'),
      (${TENANT}::uuid,${INACTIVE_ATTENDANT}::uuid,'staff'),
      (${TENANT}::uuid,${GUEST}::uuid,'guest')`;
    await deploy`INSERT INTO extension_type(type,json_schema) VALUES
      ('vertical_profile','{"type":"object"}'::jsonb)`;
    await deploy`INSERT INTO extension(id,tenant_id,type,key,version,effective,content,status) VALUES
      ('00000000-0000-0000-0000-000000022301'::uuid,NULL,'vertical_profile','order202-daily',1,tstzrange('2026-01-01Z',NULL),'{"housekeeping_cadence":"daily"}'::jsonb,'active'),
      ('00000000-0000-0000-0000-000000022302'::uuid,NULL,'vertical_profile','order202-departure',1,tstzrange('2026-01-01Z',NULL),'{"housekeeping_cadence":"on_departure"}'::jsonb,'active'),
      ('00000000-0000-0000-0000-000000022303'::uuid,NULL,'vertical_profile','order202-weekly',1,tstzrange('2026-01-01Z',NULL),'{"housekeeping_cadence":"weekly"}'::jsonb,'active')`;

    daily = await occupiedStay({
      propertyNode: PROPERTIES.daily,
      profileKey: "order202-daily",
      period: "[2026-08-27T09:30:00Z,2026-08-30T04:30:00Z)",
      code: "202-D",
      duplicatePosition: true,
    });
    departure = await occupiedStay({
      propertyNode: PROPERTIES.departure,
      profileKey: "order202-departure",
      period: "[2026-10-31T20:00:00Z,2026-11-01T15:00:00Z)",
      code: "202-O",
    });
    rollback = await occupiedStay({
      propertyNode: PROPERTIES.rollback,
      profileKey: "order202-daily",
      period: "[2026-08-27T09:30:00Z,2026-08-30T04:30:00Z)",
      code: "202-R",
    });
    await occupiedStay({ propertyNode: PROPERTIES.weekly, profileKey: "order202-weekly", period: "[2026-08-27Z,2026-08-30Z)", code: "202-W" });
    await occupiedStay({ propertyNode: PROPERTIES.missing, profileKey: "order202-missing", period: "[2026-08-27Z,2026-08-30Z)", code: "202-N" });
    await occupiedStay({ propertyNode: PROPERTIES.mixed, profileKey: "order202-daily", period: "[2026-08-27Z,2026-08-30Z)", code: "202-M1" });
    await occupiedStay({ propertyNode: PROPERTIES.mixed, profileKey: "order202-departure", period: "[2026-08-27Z,2026-08-28T12:00:00Z)", code: "202-M2" });
  });

  afterAll(async () => {
    await database?.close();
    await eventPool?.close({ timeout: 0 });
    await directRuntime?.close({ timeout: 0 });
    await deploy?.begin(async (tx) => {
      await tx`DELETE FROM public.extension WHERE id IN (
        '00000000-0000-0000-0000-000000022301'::uuid,
        '00000000-0000-0000-0000-000000022302'::uuid,
        '00000000-0000-0000-0000-000000022303'::uuid
      )`;
      await tx`DELETE FROM public.outbox WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.fact_log WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.api_idempotency WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.task WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.task_sheet WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.space_occupancy WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.reservation_segment WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.reservation WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.sellable_unit_space WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.sellable_unit WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.rate_plan WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.space WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.unit_type WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.party_role WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.party WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.app_user WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.org_node WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.tenant WHERE id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
      await tx`DELETE FROM public.extension_type
        WHERE type = 'vertical_profile'
          AND NOT EXISTS (
            SELECT 1 FROM public.extension WHERE extension.type = extension_type.type
          )`;
    });
    await deploy?.close({ timeout: 0 });
  });

  test("P1 owner-contained capability and raw task/sheet DML stay denied", async () => {
    const functions = await deploy!<Array<{ owner: string; security_definer: boolean; config: string[] | null }>>`
      SELECT owner.rolname AS owner, procedure.prosecdef AS security_definer,
             procedure.proconfig AS config
      FROM pg_proc AS procedure
      JOIN pg_roles AS owner ON owner.oid = procedure.proowner
      WHERE procedure.oid = 'public.govern_housekeeping_task_sheet(uuid,uuid,date,uuid,uuid,text,integer)'::regprocedure
    `;
    expect(functions).toEqual([{
      owner: "yellow_owner",
      security_definer: true,
      config: ["search_path=pg_catalog, public, pg_temp"],
    }]);
    await expectState(directRuntime!.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', ${TENANT}, true)`;
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`INSERT INTO task_sheet(tenant_id,property_node,sheet_date,attendant_party)
        VALUES (${TENANT}::uuid,${PROPERTIES.daily}::uuid,'2026-08-28',${ATTENDANT}::uuid)`;
    }), "42501");
    await expectState(directRuntime!.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', ${TENANT}, true)`;
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`INSERT INTO task(tenant_id,property_node,kind,status,subject_type,subject_id)
        VALUES (${TENANT}::uuid,${PROPERTIES.daily}::uuid,'housekeeping','assigned','space',${daily.spaceId}::uuid)`;
    }), "42501");
  });

  test("P2 daily preview deduplicates positional occupancy and departure uses property-local DST date", async () => {
    expect(await service!.preview({ tenantId: TENANT, propertyNode: PROPERTIES.daily, sheetDate: "2026-08-28" }))
      .toMatchObject([{ spaceId: daily.spaceId, spaceCode: "202-D", cadence: "daily" }]);
    expect(await service!.preview({ tenantId: TENANT, propertyNode: PROPERTIES.departure, sheetDate: "2026-11-01" }))
      .toMatchObject([{ spaceId: departure.spaceId, spaceCode: "202-O", cadence: "on_departure" }]);
    expect(await service!.preview({ tenantId: TENANT, propertyNode: PROPERTIES.departure, sheetDate: "2026-10-31" }))
      .toEqual([]);
    await expect(service!.generate({
      tenantId: TENANT, propertyNode: PROPERTIES.departure, sheetDate: "2026-10-31",
      attendantPartyId: ATTENDANT, idempotencyKey: "order202-empty-departure",
      envelope: audit(crypto.randomUUID(), ACTOR, TENANT, PROPERTIES.departure),
    })).rejects.toBeInstanceOf(HousekeepingSheetConflictError);
    expect(await deploy!<Array<{ id: string }>>`
      SELECT id FROM task_sheet WHERE property_node=${PROPERTIES.departure}::uuid
    `).toEqual([]);
  });

  test("P3 unsupported weekly, missing and mixed profile truth creates no artifacts", async () => {
    for (const propertyNode of [PROPERTIES.weekly, PROPERTIES.missing, PROPERTIES.mixed]) {
      await expect(service!.generate({
        tenantId: TENANT, propertyNode, sheetDate: "2026-08-28", attendantPartyId: ATTENDANT,
        idempotencyKey: `unsupported-${propertyNode}`, envelope: audit(crypto.randomUUID(), ACTOR, TENANT, propertyNode),
      })).rejects.toBeInstanceOf(HousekeepingUnsupportedCadenceError);
    }
    const counts = await deploy!<Array<{ sheets: number; tasks: number; facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM task_sheet WHERE tenant_id=${TENANT}::uuid) AS sheets,
        (SELECT count(*)::int FROM task WHERE tenant_id=${TENANT}::uuid AND sheet_id IS NOT NULL) AS tasks,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND fact_type='task.created') AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND event_type='task.created') AS events
    `;
    expect(counts).toEqual([{ sheets: 0, tasks: 0, facts: 0, events: 0 }]);
  });

  test("P4/P5 twenty contenders converge, exact replay is stable and another attendant conflicts", async () => {
    const contenders = await Promise.all(Array.from({ length: 20 }, (_, index) => service!.generate({
      tenantId: TENANT,
      propertyNode: PROPERTIES.daily,
      sheetDate: "2026-08-28",
      attendantPartyId: ATTENDANT,
      idempotencyKey: `order202-race-${String(index).padStart(2, "0")}`,
      envelope: audit(),
    })));
    expect(new Set(contenders.map(({ sheetId }) => sheetId)).size).toBe(1);
    expect(new Set(contenders.flatMap(({ tasks }) => tasks.map(({ taskId }) => taskId))).size).toBe(1);
    expect(contenders[0]?.taskCount).toBe(1);
    const requestId = crypto.randomUUID();
    const first = await service!.generate({
      tenantId: TENANT, propertyNode: PROPERTIES.daily, sheetDate: "2026-08-28", attendantPartyId: ATTENDANT,
      idempotencyKey: "order202-exact-replay", envelope: audit(requestId),
    });
    const replay = await service!.generate({
      tenantId: TENANT, propertyNode: PROPERTIES.daily, sheetDate: "2026-08-28", attendantPartyId: ATTENDANT,
      idempotencyKey: "order202-exact-replay", envelope: audit(requestId),
    });
    expect(replay).toEqual({ ...first, replayed: true });
    await expect(service!.generate({
      tenantId: TENANT, propertyNode: PROPERTIES.daily, sheetDate: "2026-08-28", attendantPartyId: OTHER_ATTENDANT,
      idempotencyKey: "order202-wrong-attendant", envelope: audit(),
    })).rejects.toBeInstanceOf(HousekeepingSheetConflictError);
    const counts = await deploy!<Array<{ sheets: number; tasks: number; facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM task_sheet WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTIES.daily}::uuid) AS sheets,
        (SELECT count(*)::int FROM task WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTIES.daily}::uuid AND sheet_id IS NOT NULL) AS tasks,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id IN (SELECT id FROM task WHERE property_node=${PROPERTIES.daily}::uuid)) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_id IN (SELECT id FROM task WHERE property_node=${PROPERTIES.daily}::uuid)) AS events
    `;
    expect(counts).toEqual([{ sheets: 1, tasks: 1, facts: 1, events: 1 }]);
    expect(await service!.list({ tenantId: TENANT, propertyNode: PROPERTIES.daily, sheetDate: "2026-08-28" }))
      .toMatchObject([{ attendantPartyId: ATTENDANT, attendantName: "Avery Housekeeping", taskCount: 1 }]);
  });

  test("P6 inactive/nonstaff and hostile tenant/property authority is concealed", async () => {
    for (const attendantPartyId of [NONSTAFF, INACTIVE_ATTENDANT]) {
      await expect(service!.generate({
        tenantId: TENANT, propertyNode: PROPERTIES.rollback, sheetDate: "2026-08-28", attendantPartyId,
        idempotencyKey: `order202-${attendantPartyId}`, envelope: audit(crypto.randomUUID(), ACTOR, TENANT, PROPERTIES.rollback),
      })).rejects.toBeInstanceOf(HousekeepingSheetNotFoundError);
    }
    await expect(service!.generate({
      tenantId: FOREIGN_TENANT, propertyNode: PROPERTIES.rollback, sheetDate: "2026-08-28", attendantPartyId: ATTENDANT,
      idempotencyKey: "order202-hostile-tenant", envelope: audit(crypto.randomUUID(), FOREIGN_ACTOR, FOREIGN_TENANT, PROPERTIES.rollback),
    })).rejects.toBeInstanceOf(HousekeepingSheetNotFoundError);
  });

  test("P5 publication failure rolls sheet, task, fact, event and idempotency back", async () => {
    const failingEvents: EventBus = {
      publish: async () => { throw new Error("injected publication failure"); },
      consumeBatch: async () => { throw new Error("unused"); },
    };
    const failingService = new HousekeepingSheetService({
      database: database!, events: failingEvents, idempotency: new PostgresIdempotency(),
    });
    await expect(failingService.generate({
      tenantId: TENANT, propertyNode: PROPERTIES.rollback, sheetDate: "2026-08-28", attendantPartyId: ATTENDANT,
      idempotencyKey: "order202-publication-rollback", envelope: audit(crypto.randomUUID(), ACTOR, TENANT, PROPERTIES.rollback),
    })).rejects.toThrow("injected publication failure");
    const counts = await deploy!<Array<{ sheets: number; tasks: number; facts: number; events: number; idem: number }>>`
      SELECT
        (SELECT count(*)::int FROM task_sheet WHERE property_node=${PROPERTIES.rollback}::uuid) AS sheets,
        (SELECT count(*)::int FROM task WHERE property_node=${PROPERTIES.rollback}::uuid AND sheet_id IS NOT NULL) AS tasks,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id IN (SELECT id FROM task WHERE property_node=${PROPERTIES.rollback}::uuid)) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_id IN (SELECT id FROM task WHERE property_node=${PROPERTIES.rollback}::uuid)) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation='housekeeping.sheet.generate' AND completed_at IS NULL) AS idem
    `;
    expect(counts).toEqual([{ sheets: 0, tasks: 0, facts: 0, events: 0, idem: 0 }]);
    expect(rollback.spaceId).toBeTruthy();
  });
});
