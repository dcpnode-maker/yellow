import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { BusinessDayRollNotFoundError, BusinessDayRollService } from "../src/contexts/financials";
import { createAuditEnvelope, Database, PostgresEventBus, type EventBus, type PublishEventInput, type Tx } from "../src/kernel";
import { PostgresDueBusinessDayScopeSource } from "../src/workers/postgres-due-business-day-scopes";

const DEPLOY = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_BUSINESS_DAY_ROLL === "1";
if (REQUIRED && (!DEPLOY || !RUNTIME)) throw new Error("Order 347 database proof requires deploy and runtime URLs");
const databaseDescribe = DEPLOY && RUNTIME ? describe.serial : describe.skip;

const T = "00000000-0000-0000-0000-000000034710";
const P = "00000000-0000-0000-0000-000000034711";
const P2 = "00000000-0000-0000-0000-000000034712";
const INACTIVE_T = "00000000-0000-0000-0000-000000034713";
const INACTIVE_P = "00000000-0000-0000-0000-000000034714";
const FOREIGN_T = "00000000-0000-0000-0000-000000034715";
const FOREIGN_P = "00000000-0000-0000-0000-000000034716";
const ACTOR = "00000000-0000-0000-0000-000000034717";
const GROUP = "00000000-0000-0000-0000-000000034718";
const INVALID_TZ = "00000000-0000-0000-0000-000000034719";

let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;

function envelope(propertyNode = P) {
  return createAuditEnvelope({ actorId: ACTOR, tenantId: T, propertyNode, requestId: crypto.randomUUID(), operation: "business_day.opened" });
}

function service(bus: EventBus = events!) { return new BusinessDayRollService({ database: database!, events: bus }); }

async function reset(propertyNode = P) {
  await admin!`DELETE FROM outbox WHERE tenant_id=${T}::uuid AND aggregate_type='business_day' AND aggregate_id=${propertyNode}::uuid`;
  await admin!`DELETE FROM fact_log WHERE tenant_id=${T}::uuid AND entity_type='business_day' AND entity_id=${propertyNode}::uuid`;
  await admin!`DELETE FROM business_day WHERE tenant_id=${T}::uuid AND property_node=${propertyNode}::uuid`;
}

databaseDescribe("Order 347 automatic property-local business-day roll", () => {
  beforeAll(async () => {
    admin = new SQL(DEPLOY!, { max: 10, prepare: false });
    eventPool = new SQL(RUNTIME!, { max: 2, prepare: false });
    database = Database.connect(RUNTIME!, { maxConnections: 24, prepare: false });
    events = new PostgresEventBus(eventPool);
    await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${T}::uuid,'o347','Order347','shared','active'),
      (${INACTIVE_T}::uuid,'o347-inactive','Order347 inactive','shared','inactive'),
      (${FOREIGN_T}::uuid,'o347-foreign','Order347 foreign','shared','active')`;
    await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${P}::uuid,${T}::uuid,'o347.p1','property','Toronto','America/Toronto','CAD'),
      (${P2}::uuid,${T}::uuid,'o347.p2','property','Kolkata','Asia/Kolkata','INR'),
      (${GROUP}::uuid,${T}::uuid,'o347.group','group','Group',NULL,NULL),
      (${INVALID_TZ}::uuid,${T}::uuid,'o347.invalid','property','Invalid timezone','Not/AZone','USD'),
      (${INACTIVE_P}::uuid,${INACTIVE_T}::uuid,'o347i.p','property','Inactive','UTC','USD'),
      (${FOREIGN_P}::uuid,${FOREIGN_T}::uuid,'o347f.p','property','Foreign','UTC','USD')`;
  });

  afterAll(async () => {
    await admin!`DELETE FROM outbox WHERE tenant_id IN (${T}::uuid,${INACTIVE_T}::uuid,${FOREIGN_T}::uuid)`;
    await admin!`DELETE FROM fact_log WHERE tenant_id IN (${T}::uuid,${INACTIVE_T}::uuid,${FOREIGN_T}::uuid)`;
    await admin!`DELETE FROM business_day WHERE tenant_id IN (${T}::uuid,${INACTIVE_T}::uuid,${FOREIGN_T}::uuid)`;
    await admin!`DELETE FROM org_node WHERE tenant_id IN (${T}::uuid,${INACTIVE_T}::uuid,${FOREIGN_T}::uuid)`;
    await admin!`DELETE FROM tenant WHERE id IN (${T}::uuid,${INACTIVE_T}::uuid,${FOREIGN_T}::uuid)`;
    await database?.close(); await eventPool?.close(); await admin?.close();
  });

  test("derives only PostgreSQL/property-local today and backlog never blocks", async () => {
    await reset();
    const dates = await admin!<{ toronto: string; kolkata: string }[]>`
      SELECT (transaction_timestamp() AT TIME ZONE 'America/Toronto')::date::text AS toronto,
             (transaction_timestamp() AT TIME ZONE 'Asia/Kolkata')::date::text AS kolkata`;
    await admin!`INSERT INTO business_day(tenant_id,property_node,business_date,sealed_at) VALUES
      (${T}::uuid,${P}::uuid,(${dates[0]!.toronto}::date-3),NULL),
      (${T}::uuid,${P}::uuid,(${dates[0]!.toronto}::date-2),transaction_timestamp()),
      (${T}::uuid,${P}::uuid,(${dates[0]!.toronto}::date-1),NULL)`;
    const opened = await service().openCurrentBusinessDay({ tenantId: T, propertyNode: P, envelope: envelope() });
    expect(opened).toEqual({ tenantId: T, propertyNode: P, businessDate: dates[0]!.toronto, opened: true });
    expect(await service().openCurrentBusinessDay({ tenantId: T, propertyNode: P, envelope: envelope() }))
      .toEqual({ tenantId: T, propertyNode: P, businessDate: dates[0]!.toronto, opened: false });
    const evidence = await admin!<{ days: number; facts: number; events: number; event_type: string; payload: Record<string, unknown> }[]>`
      SELECT (SELECT count(*)::int FROM business_day WHERE tenant_id=${T}::uuid AND property_node=${P}::uuid) AS days,
             (SELECT count(*)::int FROM fact_log WHERE tenant_id=${T}::uuid AND entity_type='business_day' AND entity_id=${P}::uuid) AS facts,
             count(*)::int AS events, min(event_type) AS event_type, (array_agg(payload))[1] AS payload
        FROM outbox WHERE tenant_id=${T}::uuid AND aggregate_type='business_day' AND aggregate_id=${P}::uuid`;
    expect(evidence[0]!.days).toBe(4); expect(evidence[0]!.facts).toBe(1); expect(evidence[0]!.events).toBe(1);
    expect(evidence[0]!.event_type).toBe("business_day.opened");
    expect(evidence[0]!.payload).toMatchObject({ property_node: P, business_date: dates[0]!.toronto });

    const kolkata = await service().openCurrentBusinessDay({ tenantId: T, propertyNode: P2, envelope: envelope(P2) });
    expect(kolkata.businessDate).toBe(dates[0]!.kolkata);
    const boundary = await admin!<{ east: string; west: string; dst_before: string; dst_after: string }[]>`
      SELECT ('2047-01-01 12:00:00+00'::timestamptz AT TIME ZONE 'Pacific/Kiritimati')::date::text AS east,
             ('2047-01-01 12:00:00+00'::timestamptz AT TIME ZONE 'America/Toronto')::date::text AS west,
             ('2047-03-10 06:59:59+00'::timestamptz AT TIME ZONE 'America/Toronto')::text AS dst_before,
             ('2047-03-10 07:00:00+00'::timestamptz AT TIME ZONE 'America/Toronto')::text AS dst_after`;
    expect(boundary[0]).toEqual({ east: "2047-01-02", west: "2047-01-01",
      dst_before: "2047-03-10 01:59:59", dst_after: "2047-03-10 03:00:00" });
  });

  test("twenty contenders converge to one atomic effect", async () => {
    await reset();
    const results = await Promise.all(Array.from({ length: 20 }, () =>
      service().openCurrentBusinessDay({ tenantId: T, propertyNode: P, envelope: envelope() })));
    expect(results.filter(({ opened }) => opened)).toHaveLength(1);
    const counts = await admin!<{ days: number; facts: number; events: number }[]>`
      SELECT (SELECT count(*)::int FROM business_day WHERE tenant_id=${T}::uuid AND property_node=${P}::uuid) AS days,
             (SELECT count(*)::int FROM fact_log WHERE tenant_id=${T}::uuid AND entity_type='business_day' AND entity_id=${P}::uuid) AS facts,
             (SELECT count(*)::int FROM outbox WHERE tenant_id=${T}::uuid AND aggregate_type='business_day' AND aggregate_id=${P}::uuid) AS events`;
    expect(counts).toEqual([{ days: 1, facts: 1, events: 1 }]);
  });

  test("late event failure rolls the insert and fact back, then retry succeeds", async () => {
    await reset();
    const failing: EventBus = { ...events!, publish: async (_tx: Tx, _event: PublishEventInput) => { throw new Error("injected publish failure"); },
      consumeBatch: events!.consumeBatch.bind(events!) };
    await expect(service(failing).openCurrentBusinessDay({ tenantId: T, propertyNode: P, envelope: envelope() }))
      .rejects.toThrow("injected publish failure");
    const absent = await admin!<{ days: number; facts: number; events: number }[]>`
      SELECT (SELECT count(*)::int FROM business_day WHERE tenant_id=${T}::uuid AND property_node=${P}::uuid) AS days,
             (SELECT count(*)::int FROM fact_log WHERE tenant_id=${T}::uuid AND entity_type='business_day' AND entity_id=${P}::uuid) AS facts,
             (SELECT count(*)::int FROM outbox WHERE tenant_id=${T}::uuid AND aggregate_type='business_day' AND aggregate_id=${P}::uuid) AS events`;
    expect(absent).toEqual([{ days: 0, facts: 0, events: 0 }]);
    expect((await service().openCurrentBusinessDay({ tenantId: T, propertyNode: P, envelope: envelope() })).opened).toBe(true);
  });

  test("hostile scope and caller-shape inputs fail closed", async () => {
    await expect(service().openCurrentBusinessDay({ tenantId: T, propertyNode: FOREIGN_P, envelope: envelope(FOREIGN_P) }))
      .rejects.toBeInstanceOf(BusinessDayRollNotFoundError);
    for (const propertyNode of [GROUP, INVALID_TZ, crypto.randomUUID()]) {
      await expect(service().openCurrentBusinessDay({ tenantId: T, propertyNode, envelope: envelope(propertyNode) }))
        .rejects.toBeInstanceOf(BusinessDayRollNotFoundError);
    }
    await expect(service().openCurrentBusinessDay({ tenantId: INACTIVE_T, propertyNode: INACTIVE_P,
      envelope: createAuditEnvelope({ actorId: ACTOR, tenantId: INACTIVE_T, propertyNode: INACTIVE_P,
        requestId: crypto.randomUUID(), operation: "business_day.opened" }) }))
      .rejects.toBeInstanceOf(BusinessDayRollNotFoundError);
    await expect(service().openCurrentBusinessDay({ tenantId: T, propertyNode: P, envelope: envelope(),
      businessDate: "2047-01-01" } as never)).rejects.toThrow("shape is invalid");
  });

  test("write capability is app-only while direct business-day DML stays denied", async () => {
    const authority = await admin!<Array<{ owner: string; definer: boolean; config: string[];
      app_execute: boolean; runtime_execute: boolean; public_execute: boolean;
      app_insert: boolean; app_update: boolean; app_delete: boolean }>>`
      SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS definer, p.proconfig AS config,
             has_function_privilege('app_role',p.oid,'EXECUTE') AS app_execute,
             has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS runtime_execute,
             has_function_privilege('public',p.oid,'EXECUTE') AS public_execute,
             has_table_privilege('app_role','business_day','INSERT') AS app_insert,
             has_table_privilege('app_role','business_day','UPDATE') AS app_update,
             has_table_privilege('app_role','business_day','DELETE') AS app_delete
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='open_current_business_day'`;
    expect(authority).toEqual([{ owner: "yellow_owner", definer: true,
      config: ["search_path=pg_catalog, public, pg_temp"], app_execute: true,
      runtime_execute: false, public_execute: false, app_insert: false, app_update: false, app_delete: false }]);

    await admin!.unsafe(`
      DO $proof$
      BEGIN
        BEGIN
          SET LOCAL ROLE yellow_runtime;
          PERFORM open_current_business_day('${T}'::uuid, '${P}'::uuid);
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'runtime unexpectedly executed app capability';
        EXCEPTION WHEN insufficient_privilege THEN
          NULL;
        END;
        SET LOCAL ROLE app_role;
        PERFORM set_config('app.tenant_id', '', true);
        BEGIN
          PERFORM open_current_business_day('${T}'::uuid, '${P}'::uuid);
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'capability unexpectedly accepted an unbound tenant';
        EXCEPTION WHEN insufficient_privilege THEN
          NULL;
        END;
      END
      $proof$;
    `);
  });

  test("runtime discovery is bounded, deterministic and returns scopes rather than dates", async () => {
    await reset(P2);
    const runtime = new SQL(RUNTIME!, { max: 1, prepare: false });
    try {
      const source = new PostgresDueBusinessDayScopeSource(runtime);
      const scopes = await source.listDueScopes(1_000);
      expect(scopes).toContainEqual({ tenantId: T, propertyNode: P2 });
      expect(Object.keys(scopes.find((scope) => scope.propertyNode === P2)!)).toEqual(["tenantId", "propertyNode"]);
      expect(() => source.listDueScopes(0)).toThrow();
      expect(() => source.listDueScopes(1_001)).toThrow();
    } finally { await runtime.close(); }
  });
});
