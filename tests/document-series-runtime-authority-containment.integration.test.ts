import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  FolioService,
  type OpenAdditionalFolioInput,
  type OpenPrimaryFolioInput,
} from "../src/contexts/financials";
import {
  createAuditEnvelope,
  Database,
  IdempotencyConflictError,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const DEPLOY_URL = process.env.YELLOW_ORDER410_DATABASE_URL ?? process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER410_RUNTIME_DATABASE_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_ORDER410_DATABASE === "1";
if (REQUIRE_DATABASE && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_ORDER410_DATABASE_URL and YELLOW_ORDER410_RUNTIME_DATABASE_URL are required");
}
const dbDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const TA = "00000000-0000-0000-0000-000000041001";
const TB = "00000000-0000-0000-0000-000000041002";
const PA = "00000000-0000-0000-0000-000000041011";
const PB = "00000000-0000-0000-0000-000000041012";
const PA_ABSENT = "00000000-0000-0000-0000-000000041013";
const PA_DUPLICATE = "00000000-0000-0000-0000-000000041014";
const PA_FISCAL = "00000000-0000-0000-0000-000000041015";
const PA_OVERFLOW = "00000000-0000-0000-0000-000000041016";
const ACTOR_A = "00000000-0000-0000-0000-000000041021";
const ACTOR_B = "00000000-0000-0000-0000-000000041022";
const PARTY_A = "00000000-0000-0000-0000-000000041031";
const PARTY_B = "00000000-0000-0000-0000-000000041032";
const RES_PRIMARY = "00000000-0000-0000-0000-000000041041";
const RES_ADDITIONAL = "00000000-0000-0000-0000-000000041042";

let deploy: SQL | undefined;
let runtime: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let service: FolioService | undefined;

class FailAfterPublish implements EventBus {
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, event);
    throw new Error("Order410 injected rollback after publication");
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

function envelope(tenantId = TA, propertyNode = PA, actorId = ACTOR_A) {
  return createAuditEnvelope({
    operation: "folio.opened", tenantId, propertyNode, actorId, requestId: crypto.randomUUID(),
  });
}

function primary(key: string): OpenPrimaryFolioInput {
  return { tenantId: TA, reservationId: RES_PRIMARY, idempotencyKey: key, envelope: envelope() };
}

function additional(sourceFolioId: string, name: string, key: string): OpenAdditionalFolioInput {
  return {
    tenantId: TA, reservationId: RES_ADDITIONAL, sourceFolioId, name, idempotencyKey: key,
    envelope: envelope(),
  };
}

async function tenantTransaction<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return database!.withTenantTransaction(tenantId, fn);
}

async function allocate(tenantId: string, propertyNode: string): Promise<Record<string, unknown>> {
  return tenantTransaction(tenantId, async (tx) => {
    const rows = await tx<Array<Record<string, unknown>>>`
      SELECT * FROM public.allocate_non_fiscal_folio_reference(${tenantId}::uuid,${propertyNode}::uuid)
    `;
    if (rows.length !== 1 || !rows[0]) throw new Error("allocator returned no row");
    return rows[0];
  });
}

function allocatedReference(row: Record<string, unknown>): string {
  const value = row.folio_reference ?? row.folio_no ?? row.reference ?? row.formatted_reference;
  if (typeof value !== "string") throw new Error("allocator returned no formatted reference");
  return value;
}

async function expectSqlState(action: () => Promise<unknown>, expected: string | readonly string[]) {
  try {
    await action();
  } catch (error) {
    const state = (error as { errno?: string; code?: string }).errno ?? (error as { code?: string }).code;
    expect(Array.isArray(expected) ? expected : [expected]).toContain(state);
    return;
  }
  throw new Error(`expected SQLSTATE ${Array.isArray(expected) ? expected.join("/") : expected}`);
}

interface Census {
  series: number; nextTotal: string; accounts: number; folios: number; facts: number;
  events: number; keys: number; documents: number;
}
async function census(): Promise<Census> {
  return (await deploy!<Census[]>`
    SELECT
      (SELECT count(*)::int FROM document_series WHERE tenant_id IN (${TA}::uuid,${TB}::uuid)) series,
      (SELECT COALESCE(sum(next_no),0)::text FROM document_series WHERE tenant_id IN (${TA}::uuid,${TB}::uuid)) "nextTotal",
      (SELECT count(*)::int FROM account WHERE tenant_id IN (${TA}::uuid,${TB}::uuid)) accounts,
      (SELECT count(*)::int FROM folio WHERE tenant_id IN (${TA}::uuid,${TB}::uuid)) folios,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id IN (${TA}::uuid,${TB}::uuid)) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id IN (${TA}::uuid,${TB}::uuid)) events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id IN (${TA}::uuid,${TB}::uuid)) keys,
      (SELECT count(*)::int FROM document WHERE tenant_id IN (${TA}::uuid,${TB}::uuid)) documents
  `)[0]!;
}

async function expectUnchanged(action: () => Promise<unknown>, states: string | readonly string[] = ["42501", "55000"]) {
  const before = await census();
  await expectSqlState(action, states);
  expect(await census()).toEqual(before);
}

async function clean() {
  if (!deploy) return;
  for (const table of ["api_idempotency", "outbox", "fact_log", "document", "folio", "account",
    "document_series", "reservation_guest", "reservation", "app_user", "party_role", "party", "org_node"]) {
    await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [TA, TB]);
  }
  await deploy`DELETE FROM tenant WHERE id IN (${TA}::uuid,${TB}::uuid)`;
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 8, prepare: false });
  runtime = new SQL(RUNTIME_URL, { max: 8, prepare: false });
  eventPool = new SQL(RUNTIME_URL, { max: 8, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 110, prepare: false });
  service = new FolioService({ events: new PostgresEventBus(eventPool), idempotency: new PostgresIdempotency() });
  await clean();
  await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TA}::uuid,'order410-a','Order410 A','shared','active'),
    (${TB}::uuid,'order410-b','Order410 B','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PA}::uuid,${TA}::uuid,'order410_a','property','Order410 A','UTC','INR'),
    (${PA_ABSENT}::uuid,${TA}::uuid,'order410_absent','property','Order410 absent','UTC','INR'),
    (${PA_DUPLICATE}::uuid,${TA}::uuid,'order410_duplicate','property','Order410 duplicate','UTC','INR'),
    (${PA_FISCAL}::uuid,${TA}::uuid,'order410_fiscal','property','Order410 fiscal','UTC','INR'),
    (${PA_OVERFLOW}::uuid,${TA}::uuid,'order410_overflow','property','Order410 overflow','UTC','INR'),
    (${PB}::uuid,${TB}::uuid,'order410_b','property','Order410 B','UTC','CAD')`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR_A}::uuid,${TA}::uuid,'a@order410.test','Order410 A','active'),
    (${ACTOR_B}::uuid,${TB}::uuid,'b@order410.test','Order410 B','active')`;
  await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY_A}::uuid,${TA}::uuid,'person','Order410 guest A','active'),
    (${PARTY_B}::uuid,${TB}::uuid,'person','Order410 guest B','active')`;
  await deploy`INSERT INTO party_role(tenant_id,party_id,role) VALUES
    (${TA}::uuid,${PARTY_A}::uuid,'guest'),(${TB}::uuid,${PARTY_B}::uuid,'guest')`;
  await deploy`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency) VALUES
    (${RES_PRIMARY}::uuid,${TA}::uuid,${PA}::uuid,'O410-P','reserved',${PARTY_A}::uuid,'direct','INR'),
    (${RES_ADDITIONAL}::uuid,${TA}::uuid,${PA}::uuid,'O410-A','in_house',${PARTY_A}::uuid,'direct','INR')`;
  await deploy`INSERT INTO document_series(tenant_id,property_node,kind,prefix,next_no,fiscal) VALUES
    (${TA}::uuid,${PA}::uuid,'folio','A-',1,false),
    (${TB}::uuid,${PB}::uuid,'folio','B-',500,false),
    (${TA}::uuid,${PA_DUPLICATE}::uuid,'folio','D1-',10,false),
    (${TA}::uuid,${PA_DUPLICATE}::uuid,'folio','D2-',20,false),
    (${TA}::uuid,${PA_FISCAL}::uuid,'folio','F-',30,true),
    (${TA}::uuid,${PA_OVERFLOW}::uuid,'folio','X-',9223372036854775807,false)`;
}, 60_000);

afterAll(async () => {
  await clean();
  await database?.close(); await eventPool?.close(); await runtime?.close(); await deploy?.close();
}, 60_000);

dbDescribe("Order410 document-series runtime authority containment", () => {
  test("P0: capability ownership, fixed path and ACL are exact; direct counters and documents stay denied", async () => {
    const functions = await deploy!<Array<{ owner: string; securityDefiner: boolean; config: string[] | null }>>`
      SELECT pg_get_userbyid(proowner) owner,prosecdef "securityDefiner",proconfig config
      FROM pg_proc WHERE oid='public.allocate_non_fiscal_folio_reference(uuid,uuid)'::regprocedure`;
    expect(functions).toEqual([{ owner: "yellow_owner", securityDefiner: true, config: ["search_path=pg_catalog, public"] }]);
    const acl = await deploy!<Array<{ grantee: string; privilege: string }>>`
      SELECT COALESCE(role.rolname,'PUBLIC') grantee,expanded.privilege_type privilege
      FROM pg_proc function
      CROSS JOIN LATERAL aclexplode(COALESCE(function.proacl,acldefault('f',function.proowner))) expanded
      LEFT JOIN pg_roles role ON role.oid=expanded.grantee
      WHERE function.oid='public.allocate_non_fiscal_folio_reference(uuid,uuid)'::regprocedure
      ORDER BY grantee,privilege`;
    expect(acl).toEqual([
      { grantee: "app_role", privilege: "EXECUTE" },
      { grantee: "yellow_owner", privilege: "EXECUTE" },
    ]);
    await expectUnchanged(() => runtime!.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id',${TA},true)`;
      await tx`SELECT * FROM public.allocate_non_fiscal_folio_reference(${TA}::uuid,${PA}::uuid)`;
    }), "42501");
    await expectUnchanged(() => deploy!`
      SELECT * FROM public.allocate_non_fiscal_folio_reference(${TA}::uuid,${PA}::uuid)
    `, "42501");

    for (const statement of [
      `UPDATE document_series SET next_no=next_no+1 WHERE tenant_id='${TA}' AND property_node='${PA}'`,
      `UPDATE document_series SET next_no=next_no+1 WHERE tenant_id='${TA}' AND property_node='${PA_FISCAL}'`,
      `INSERT INTO document(tenant_id,property_node,kind,content) VALUES('${TA}','${PA}','invoice','{}')`,
      `UPDATE document SET status='issued' WHERE tenant_id='${TA}'`,
      `DELETE FROM document WHERE tenant_id='${TA}'`,
    ]) {
      await expectUnchanged(() => runtime!.begin(async (tx) => {
        await tx`SELECT set_config('app.tenant_id',${TA},true)`;
        await tx.unsafe(statement);
      }), "42501");
    }
  }, 30_000);

  test("P1: primary and additional journeys preserve references, replay and rollback without documents", async () => {
    const first = await tenantTransaction(TA, (tx) => service!.openPrimary(tx, primary("order410-primary-replay")));
    expect(first).toMatchObject({ folioNo: "A-1", windowNo: 1, changed: true, replayed: false });
    expect(await tenantTransaction(TA, (tx) => service!.openPrimary(tx, primary("order410-primary-replay"))))
      .toEqual({ ...first, replayed: true });
    await expect(tenantTransaction(TA, (tx) => service!.openPrimary(tx, primary("order410-primary-changed"))))
      .resolves.toMatchObject({ folioNo: "A-1", windowNo: 1, changed: false });

    const account = crypto.randomUUID();
    const source = crypto.randomUUID();
    await deploy!`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status)
      VALUES(${account}::uuid,${TA}::uuid,${PA}::uuid,'guest',${PARTY_A}::uuid,'Additional','INR','open')`;
    await deploy!`INSERT INTO folio(id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status)
      VALUES(${source}::uuid,${TA}::uuid,${account}::uuid,${RES_ADDITIONAL}::uuid,'SOURCE',1,'Primary','open')`;
    const extraRequest = additional(source, "Business", "order410-additional-replay");
    const extra = await tenantTransaction(TA, (tx) => service!.openAdditional(tx, extraRequest));
    expect(extra).toMatchObject({ folioNo: "A-2", windowNo: 2, changed: true, replayed: false });
    expect(await tenantTransaction(TA, (tx) => service!.openAdditional(tx, extraRequest)))
      .toEqual({ ...extra, replayed: true });
    await expect(tenantTransaction(TA, (tx) => service!.openAdditional(tx,
      { ...extraRequest, name: "Personal" }))).rejects.toBeInstanceOf(IdempotencyConflictError);

    const before = await census();
    const failing = new FolioService({
      events: new FailAfterPublish(new PostgresEventBus(eventPool!)), idempotency: new PostgresIdempotency(),
    });
    await expect(tenantTransaction(TA, (tx) => failing.openAdditional(tx,
      additional(source, "Rollback", "order410-additional-rollback"))))
      .rejects.toThrow("Order410 injected rollback");
    expect(await census()).toEqual(before);
    expect((await deploy!<Array<{ count: number }>>`SELECT count(*)::int count FROM document
      WHERE tenant_id=${TA}::uuid`)[0]!.count).toBe(0);
  }, 45_000);

  test("P1: absent, duplicate, fiscal-only, foreign and overflow truth reject with exact zero-write census", async () => {
    for (const [tenantId, propertyNode, state] of [
      [TA, PA_ABSENT, "55000"], [TA, PA_DUPLICATE, "55000"], [TA, PA_FISCAL, "55000"],
      [TA, PB, "55000"], [TB, PA, "55000"], [TA, PA_OVERFLOW, "22023"],
    ] as const) {
      await expectUnchanged(() => allocate(tenantId, propertyNode), state);
    }
  }, 30_000);

  test("P1: 100 concurrent allocations are unique and gap-free across two isolated tenants", async () => {
    const [a, b] = await Promise.all([
      Promise.all(Array.from({ length: 50 }, () => allocate(TA, PA))),
      Promise.all(Array.from({ length: 50 }, () => allocate(TB, PB))),
    ]);
    const aNumbers = a.map(allocatedReference).map((value) => Number(value.slice(2))).sort((x, y) => x - y);
    const bNumbers = b.map(allocatedReference).map((value) => Number(value.slice(2))).sort((x, y) => x - y);
    expect(aNumbers).toEqual(Array.from({ length: 50 }, (_, index) => index + 3));
    expect(bNumbers).toEqual(Array.from({ length: 50 }, (_, index) => index + 500));
    expect(new Set(a.map(allocatedReference)).size).toBe(50);
    expect(new Set(b.map(allocatedReference)).size).toBe(50);
    const next = await deploy!<Array<{ tenant_id: string; next_no: string }>>`
      SELECT tenant_id,next_no::text FROM document_series
      WHERE (tenant_id=${TA}::uuid AND property_node=${PA}::uuid)
         OR (tenant_id=${TB}::uuid AND property_node=${PB}::uuid)
      ORDER BY tenant_id`;
    expect(next).toEqual([{ tenant_id: TA, next_no: "53" }, { tenant_id: TB, next_no: "550" }]);
  }, 90_000);
});
