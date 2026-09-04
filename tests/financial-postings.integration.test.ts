import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  ChargeConflictError,
  ChargeNotFoundError,
  ChargeService,
  ChargeValidationError,
  type PostChargeInput,
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

const URL = process.env.YELLOW_FINANCIAL_POSTINGS_URL;
if (process.env.YELLOW_REQUIRE_FINANCIAL_POSTINGS === "1" && !URL) {
  throw new Error("YELLOW_FINANCIAL_POSTINGS_URL is required by the Order 104 proof");
}
const TENANT_A = "00000000-0000-0000-0000-000000010401";
const TENANT_B = "00000000-0000-0000-0000-000000010402";
const PROPERTY_A = "00000000-0000-0000-0000-000000010411";
const PROPERTY_B = "00000000-0000-0000-0000-000000010412";
const PROPERTY_FOREIGN = "00000000-0000-0000-0000-000000010413";
const PROPERTY_MISSING_DAY = "00000000-0000-0000-0000-000000010414";
const ACTOR_A = "00000000-0000-0000-0000-000000010421";
const ACTOR_B = "00000000-0000-0000-0000-000000010422";
const PARTY_A = "00000000-0000-0000-0000-000000010431";
const GUEST = "00000000-0000-0000-0000-000000010441";
const REVENUE = "00000000-0000-0000-0000-000000010442";
const REVENUE_2 = "00000000-0000-0000-0000-000000010443";
const FOREIGN_REVENUE = "00000000-0000-0000-0000-000000010444";
const USD_REVENUE = "00000000-0000-0000-0000-000000010445";
const MISSING_DAY_GUEST = "00000000-0000-0000-0000-000000010446";
const MISSING_DAY_REVENUE = "00000000-0000-0000-0000-000000010447";
const FOLIO = "00000000-0000-0000-0000-000000010451";
const HOSTILE_FOLIO = "00000000-0000-0000-0000-000000010452";
const STRESS_FOLIO = "00000000-0000-0000-0000-000000010453";
const MISSING_DAY_FOLIO = "00000000-0000-0000-0000-000000010454";

const dbDescribe = URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let service: ChargeService | undefined;
let day = "";

function envelope(propertyNode = PROPERTY_A, tenantId = TENANT_A, actorId = ACTOR_A) {
  return createAuditEnvelope({ operation: "journal.posted", tenantId, propertyNode, actorId, requestId: crypto.randomUUID() });
}

function request(key = `order104-${crypto.randomUUID()}`, folioId = FOLIO,
  amountMinor = "12345", quantity = "1.000"): PostChargeInput {
  return { tenantId: TENANT_A, folioId, txCode: "ROOM", amountMinor, quantity,
    idempotencyKey: key, envelope: envelope() };
}

function makeService(bus: EventBus) {
  return new ChargeService({ events: bus, idempotency: new PostgresIdempotency() });
}

function post(input: PostChargeInput, using = service!, tenantId = input.tenantId) {
  return database!.withTenantTransaction(tenantId, (tx) => using.postCharge(tx, input));
}

class FailAfterPublish implements EventBus {
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, event);
    throw new Error("Order 104 injected failure after outbox insertion");
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

class PausingPublish implements EventBus {
  entered!: () => void;
  release!: () => void;
  readonly published = new Promise<void>((resolve) => { this.entered = resolve; });
  readonly resumed = new Promise<void>((resolve) => { this.release = resolve; });
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    const result = await this.delegate.publish(tx, event);
    this.entered(); await this.resumed; return result;
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

interface Counts { journals: number; lines: number; facts: number; events: number; keys: number; balance: string }
async function counts(folioId = FOLIO): Promise<Counts> {
  return (await admin!<Counts[]>`
    SELECT
      (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT_A}::uuid) journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${TENANT_A}::uuid) lines,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid AND fact_type='journal.posted') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid AND event_type='journal.posted') events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT_A}::uuid AND operation='financials.charge.post') keys,
      COALESCE((SELECT balance_minor::text FROM folio_balance WHERE tenant_id=${TENANT_A}::uuid AND folio_id=${folioId}::uuid),'0') balance`)[0]!;
}

async function excluded() {
  return (await admin!<Array<Record<string, number>>>`
    SELECT (SELECT count(*)::int FROM payment_instrument WHERE tenant_id=${TENANT_A}::uuid) instruments,
      (SELECT count(*)::int FROM payment WHERE tenant_id=${TENANT_A}::uuid) payments,
      (SELECT count(*)::int FROM cashier_session WHERE tenant_id=${TENANT_A}::uuid) cashiers,
      (SELECT count(*)::int FROM document WHERE tenant_id=${TENANT_A}::uuid) documents,
      (SELECT count(*)::int FROM ar_allocation) ar,
      (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id=${TENANT_A}::uuid) fiscal`)[0]!;
}

async function expectState(operation: () => Promise<unknown>, state: string) {
  try { await operation(); } catch (error) {
    const typed = error as { errno?: string; code?: string };
    expect(typed.errno ?? typed.code).toBe(state); return;
  }
  throw new Error(`Expected SQLSTATE ${state}`);
}

async function clean() {
  if (!admin) return;
  for (const table of ["api_idempotency","outbox","fact_log","fiscal_submission",
    "payment","payment_instrument","posting_line","journal","tx_code_route","business_day","folio",
    "account","app_user","party_role","party","org_node"]) {
    await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [TENANT_A, TENANT_B]);
  }
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin`DELETE FROM tx_code WHERE code IN ('ROOM','NOROUTE','BADROLE','NOUSALI')`;
}

beforeAll(async () => {
  if (!URL) return;
  admin = new SQL(URL, { max: 48 }); eventPool = new SQL(URL, { max: 48 });
  database = Database.connect(URL, { maxConnections: 80 });
  events = new PostgresEventBus(eventPool); service = makeService(events);
  await clean();
  day = (await admin<Array<{ d: string }>>`SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text d`)[0]!.d;
  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT_A}::uuid,'order104-a','Order 104 A','shared','active'),
    (${TENANT_B}::uuid,'order104-b','Order 104 B','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order104_a','property','Order 104 A','UTC','INR'),
    (${PROPERTY_B}::uuid,${TENANT_A}::uuid,'order104_b','property','Order 104 B','UTC','USD'),
    (${PROPERTY_MISSING_DAY}::uuid,${TENANT_A}::uuid,'order104_missing_day','property','Order 104 Missing Day','UTC','INR'),
    (${PROPERTY_FOREIGN}::uuid,${TENANT_B}::uuid,'order104_foreign','property','Order 104 Foreign','UTC','INR')`;
  await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR_A}::uuid,${TENANT_A}::uuid,'a@order104.test','Actor A','active'),
    (${ACTOR_B}::uuid,${TENANT_B}::uuid,'b@order104.test','Actor B','active')`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(${PARTY_A}::uuid,${TENANT_A}::uuid,'person','Order 104 Guest','active')`;
  await admin`INSERT INTO party_role(tenant_id,party_id,role) VALUES(${TENANT_A}::uuid,${PARTY_A}::uuid,'guest')`;
  await admin`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES
    (${GUEST}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'guest',${PARTY_A}::uuid,'Guest account','INR','open'),
    (${REVENUE}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'revenue',NULL,'Room revenue','INR','open'),
    (${REVENUE_2}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'revenue',NULL,'Other revenue','INR','open'),
    (${USD_REVENUE}::uuid,${TENANT_A}::uuid,${PROPERTY_B}::uuid,'revenue',NULL,'USD revenue','USD','open'),
    (${MISSING_DAY_GUEST}::uuid,${TENANT_A}::uuid,${PROPERTY_MISSING_DAY}::uuid,'guest',${PARTY_A}::uuid,'Missing-day guest','INR','open'),
    (${MISSING_DAY_REVENUE}::uuid,${TENANT_A}::uuid,${PROPERTY_MISSING_DAY}::uuid,'revenue',NULL,'Missing-day revenue','INR','open'),
    (${FOREIGN_REVENUE}::uuid,${TENANT_B}::uuid,${PROPERTY_FOREIGN}::uuid,'revenue',NULL,'Foreign revenue','INR','open')`;
  await admin`INSERT INTO folio(id,tenant_id,account_id,folio_no,window_no,status) VALUES
    (${FOLIO}::uuid,${TENANT_A}::uuid,${GUEST}::uuid,'O104-A',1,'open'),
    (${HOSTILE_FOLIO}::uuid,${TENANT_A}::uuid,${GUEST}::uuid,'O104-H',2,'open'),
    (${STRESS_FOLIO}::uuid,${TENANT_A}::uuid,${GUEST}::uuid,'O104-S',3,'open'),
    (${MISSING_DAY_FOLIO}::uuid,${TENANT_A}::uuid,${MISSING_DAY_GUEST}::uuid,'O104-M',1,'open')`;
  await admin`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr) VALUES
    ('ROOM','Room charge','revenue','Rooms','guest','revenue'),
    ('NOROUTE','No route','revenue','Rooms','guest','revenue'),
    ('BADROLE','Bad role','payment','Rooms','guest','revenue'),
    ('NOUSALI','No USALI','revenue',NULL,'guest','revenue')`;
  await admin`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,credit_account_id)
    VALUES
      (${TENANT_A}::uuid,${PROPERTY_A}::uuid,'INR','ROOM',${REVENUE}::uuid),
      (${TENANT_A}::uuid,${PROPERTY_MISSING_DAY}::uuid,'INR','ROOM',${MISSING_DAY_REVENUE}::uuid)`;
  await admin`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES(${TENANT_A}::uuid,${PROPERTY_A}::uuid,${day}::date)`;
}, 30_000);

afterAll(async () => { await clean(); await database?.close(); await eventPool?.close(); await admin?.close(); }, 60_000);

describe("Order 104 balanced charge posting", () => {
  test("P0: the financial context exposes canonical charge posting", () => expect(typeof ChargeService).toBe("function"));
});

dbDescribe("Order 104 fresh-PostgreSQL financial posting proof", () => {
  test("P1: exact migration truth, ACL, composite constraints and database guards", async () => {
    expect((await admin!<Array<{ n: number }>>`SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`)[0]!.n).toBe(125);
    const acl = (await admin!<Array<{ rls: boolean; select_ok: boolean; insert_ok: boolean; tx_mutate: boolean }>>`
      SELECT c.relrowsecurity rls,has_table_privilege('app_role','tx_code_route','SELECT') select_ok,
        has_table_privilege('app_role','tx_code_route','INSERT') insert_ok,
        has_table_privilege('app_role','tx_code','INSERT,UPDATE,DELETE') tx_mutate
      FROM pg_class c WHERE c.oid='tx_code_route'::regclass`)[0]!;
    expect(acl).toEqual({ rls: true, select_ok: true, insert_ok: false, tx_mutate: false });
    const defs = (await admin!<Array<{ t: string; d: string }>>`
      SELECT conrelid::regclass::text t,pg_get_constraintdef(oid) d FROM pg_constraint
      WHERE conrelid IN ('journal'::regclass,'posting_line'::regclass,'tx_code_route'::regclass)`)
      .map((row) => `${row.t}:${row.d}`);
    for (const fragment of ["journal:FOREIGN KEY (tenant_id, property_node)",
      "posting_line:FOREIGN KEY (tenant_id, journal_id, business_date, currency)",
      "posting_line:FOREIGN KEY (tenant_id, account_id, currency)",
      "posting_line:FOREIGN KEY (tenant_id, account_id, folio_id)",
      "tx_code_route:FOREIGN KEY (tenant_id, property_node, currency, credit_account_id)"]) {
      expect(defs.some((definition) => definition.includes(fragment))).toBeTrue();
    }
    await expectState(() => database!.withTenantTransaction(TENANT_A, (tx) => tx.unsafe(
      "INSERT INTO journal(tenant_id,property_node,business_date,kind,description,currency) VALUES($1,$2,'2001-01-01','charge','missing','INR')",
      [TENANT_A, PROPERTY_A])), "P0011");
    await expectState(async () => {
      const tx = await admin!.reserve();
      try {
        await tx.unsafe("BEGIN");
        const journal = (await tx<Array<{ id: string }>>`INSERT INTO journal(tenant_id,property_node,business_date,kind,description,currency)
          VALUES(${TENANT_A}::uuid,${PROPERTY_A}::uuid,${day}::date,'charge','unbalanced','INR') RETURNING id`)[0]!.id;
        await tx`INSERT INTO posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,amount_minor,quantity,business_date,currency)
          VALUES(${TENANT_A}::uuid,${journal}::uuid,1,${GUEST}::uuid,${FOLIO}::uuid,'ROOM',1,1,${day}::date,'INR')`;
        try { await tx.unsafe("COMMIT"); }
        catch (error) { await tx.unsafe("ROLLBACK"); throw error; }
      } finally { tx.release(); }
    }, "P0010");
    expect(await counts()).toEqual({ journals: 0, lines: 0, facts: 0, events: 0, keys: 0, balance: "0" });
  }, 30_000);

  test("P2: canonical charge has exact signs, balance, route and minimized evidence", async () => {
    const outside = await excluded();
    const result = await post(request("order104-canonical", FOLIO, "12345", "2.500"));
    expect(result).toEqual({ journalId: expect.any(String), folioId: FOLIO, businessDate: day,
      currency: "INR", txCode: "ROOM", amountMinor: "12345", quantity: "2.500", replayed: false });
    const lines = await admin!<Array<Record<string, unknown>>>`SELECT seq,account_id,folio_id,tx_code,amount_minor::text,
      quantity::text,business_date::text,currency,tax_detail FROM posting_line WHERE journal_id=${result.journalId}::uuid ORDER BY seq`;
    expect(lines).toEqual([
      { seq: 1, account_id: GUEST, folio_id: FOLIO, tx_code: "ROOM", amount_minor: "12345", quantity: "2.500", business_date: day, currency: "INR", tax_detail: null },
      { seq: 2, account_id: REVENUE, folio_id: null, tx_code: "ROOM", amount_minor: "-12345", quantity: "2.500", business_date: day, currency: "INR", tax_detail: null },
    ]);
    const header = (await admin!<Array<Record<string, unknown>>>`SELECT j.kind,j.property_node,j.business_date::text,j.currency,
      sum(p.amount_minor)::text total,count(*)::int line_count FROM journal j JOIN posting_line p ON p.tenant_id=j.tenant_id AND p.journal_id=j.id
      WHERE j.id=${result.journalId}::uuid GROUP BY j.id`)[0]!;
    expect(header).toMatchObject({ kind: "charge", property_node: PROPERTY_A, business_date: day, currency: "INR", total: "0", line_count: 2 });
    expect((await counts()).balance).toBe("12345");
    const evidence = (await admin!<Array<{ fact: Record<string, unknown>; event: Record<string, unknown> }>>`
      SELECT f.payload fact,o.payload event FROM fact_log f JOIN outbox o ON o.tenant_id=f.tenant_id AND o.aggregate_id=f.entity_id
      WHERE f.entity_id=${result.journalId}::uuid AND f.fact_type='journal.posted' AND o.event_type='journal.posted'`)[0]!;
    const payload = { journal_id: result.journalId, kind: "charge", lines: [
      { account: GUEST, folio: FOLIO, tx_code: "ROOM", amount_minor: "12345" },
      { account: REVENUE, tx_code: "ROOM", amount_minor: "-12345" },
    ] };
    expect(evidence.event).toEqual(payload); expect(evidence.fact).toMatchObject(payload);
    expect(JSON.stringify(evidence)).not.toMatch(/Order 104 Guest|@order104|party|token|reservation|note/i);
    expect(await excluded()).toEqual(outside);
  }, 30_000);

  test("P3: exact replay, changed conflict and twenty same-key calls have one effect", async () => {
    const exact = request("order104-replay-exact", FOLIO, "77", "1.125");
    const first = await post(exact);
    expect(await post(exact)).toEqual({ ...first, replayed: true });
    await expect(post({ ...exact, amountMinor: "78" })).rejects.toBeInstanceOf(IdempotencyConflictError);
    const before = await counts();
    const race = request("order104-race-same-key", FOLIO, "91");
    const results = await Promise.all(Array.from({ length: 20 }, () => post(race)));
    expect(new Set(results.map((value) => value.journalId)).size).toBe(1);
    expect(results.filter((value) => !value.replayed)).toHaveLength(1);
    expect(results.filter((value) => value.replayed)).toHaveLength(19);
    expect(await counts()).toEqual({ journals: before.journals + 1, lines: before.lines + 2,
      facts: before.facts + 1, events: before.events + 1, keys: before.keys + 1,
      balance: (BigInt(before.balance) + 91n).toString() });
  }, 30_000);

  test("P3: failure after real outbox insertion rolls back all artifacts and retries", async () => {
    const before = await counts(HOSTILE_FOLIO);
    const exact = request("order104-rollback-outbox", HOSTILE_FOLIO, "31337");
    await expect(post(exact, makeService(new FailAfterPublish(events!)))).rejects.toThrow("failure after outbox insertion");
    expect(await counts(HOSTILE_FOLIO)).toEqual(before);
    expect(await post(exact)).toMatchObject({ folioId: HOSTILE_FOLIO, amountMinor: "31337", replayed: false });
  }, 30_000);

  test("P3: seal latch waits for a charge and a sealed day rejects the next charge", async () => {
    const before = await counts(HOSTILE_FOLIO);
    const pause = new PausingPublish(events!);
    const chargedPromise = post(request("order104-charge-before-seal", HOSTILE_FOLIO, "17"), makeService(pause));
    await pause.published;
    const waitingSeal = admin!.unsafe(
      "SELECT seal_business_day($1,$2,$3::date,$4)", [TENANT_A, PROPERTY_A, day, ACTOR_A]);
    pause.release(); const charged = await chargedPromise; await waitingSeal;
    expect(charged.replayed).toBeFalse();
    await expect(post(request("order104-after-seal", HOSTILE_FOLIO, "19"))).rejects.toBeInstanceOf(ChargeConflictError);
    expect(await counts(HOSTILE_FOLIO)).toEqual({ journals: before.journals + 1, lines: before.lines + 2,
      facts: before.facts + 1, events: before.events + 1, keys: before.keys + 1,
      balance: (BigInt(before.balance) + 17n).toString() });
    await admin!`UPDATE business_day SET sealed_at=NULL,sealed_by=NULL WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid AND business_date=${day}::date`;

    let markSealed!: () => void; let releaseSeal!: () => void;
    const sealedUncommitted = new Promise<void>((resolve) => { markSealed = resolve; });
    const mayCommit = new Promise<void>((resolve) => { releaseSeal = resolve; });
    const sealing = admin!.begin(async (tx) => {
      await tx`UPDATE business_day SET sealed_at=now(),sealed_by=${ACTOR_A}::uuid
        WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid AND business_date=${day}::date`;
      markSealed(); await mayCommit;
    });
    await sealedUncommitted;
    let chargeSettled = false;
    const sealFirstCharge = post(request("order104-seal-before-charge", HOSTILE_FOLIO, "18"))
      .finally(() => { chargeSettled = true; });
    await Bun.sleep(100);
    expect(chargeSettled).toBeFalse();
    releaseSeal(); await sealing;
    await expect(sealFirstCharge).rejects.toBeInstanceOf(ChargeConflictError);
    await admin!`UPDATE business_day SET sealed_at=NULL,sealed_by=NULL WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid AND business_date=${day}::date`;
  }, 30_000);

  test("P4: malformed shape, money, quantity and audit authority write nothing", async () => {
    const before = await counts(HOSTILE_FOLIO);
    const invalid: PostChargeInput[] = [
      { ...request(undefined, HOSTILE_FOLIO), tenantId: "bad" },
      { ...request(undefined, HOSTILE_FOLIO), folioId: "bad" },
      { ...request(undefined, HOSTILE_FOLIO), txCode: "bad code" },
      { ...request(undefined, HOSTILE_FOLIO), amountMinor: "0" },
      { ...request(undefined, HOSTILE_FOLIO), amountMinor: "-1" },
      { ...request(undefined, HOSTILE_FOLIO), amountMinor: "+1" },
      { ...request(undefined, HOSTILE_FOLIO), amountMinor: "01" },
      { ...request(undefined, HOSTILE_FOLIO), amountMinor: "9223372036854775808" },
      { ...request(undefined, HOSTILE_FOLIO), quantity: "0" },
      { ...request(undefined, HOSTILE_FOLIO), quantity: "1.0000" },
      { ...request(undefined, HOSTILE_FOLIO), quantity: "1e3" },
      { ...request(undefined, HOSTILE_FOLIO), idempotencyKey: "short" },
      { ...request(undefined, HOSTILE_FOLIO), envelope: { ...envelope(), operation: "folio.opened" } },
      { ...request(undefined, HOSTILE_FOLIO), routeAccountId: REVENUE } as unknown as PostChargeInput,
      { ...request(undefined, HOSTILE_FOLIO), amountMinor: 1 } as unknown as PostChargeInput,
    ];
    for (const item of invalid) {
      await expect(post(item)).rejects.toBeInstanceOf(ChargeValidationError);
      expect(await counts(HOSTILE_FOLIO)).toEqual(before);
    }
    await expect(post({ ...request(undefined, HOSTILE_FOLIO), envelope: envelope(PROPERTY_B) }))
      .rejects.toBeInstanceOf(ChargeNotFoundError);
    expect(await counts(HOSTILE_FOLIO)).toEqual(before);
  }, 30_000);

  test("P4: closed truth, invalid codes, routes and business days fail without artifacts", async () => {
    const conflict = async (item: PostChargeInput) => {
      const before = await counts(HOSTILE_FOLIO);
      await expect(post(item)).rejects.toBeInstanceOf(ChargeConflictError);
      expect(await counts(HOSTILE_FOLIO)).toEqual(before);
    };
    await admin!`UPDATE folio SET status='closed' WHERE id=${HOSTILE_FOLIO}::uuid`;
    await conflict(request("order104-closed-folio", HOSTILE_FOLIO));
    await admin!`UPDATE folio SET status='open' WHERE id=${HOSTILE_FOLIO}::uuid`;
    await admin!`UPDATE account SET status='frozen' WHERE id=${GUEST}::uuid`;
    await conflict(request("order104-frozen-account", HOSTILE_FOLIO));
    await admin!`UPDATE account SET status='open' WHERE id=${GUEST}::uuid`;
    await conflict({ ...request("order104-missing-route", HOSTILE_FOLIO), txCode: "NOROUTE" });
    await conflict({ ...request("order104-wrong-code-role", HOSTILE_FOLIO), txCode: "BADROLE" });
    await conflict({ ...request("order104-no-usali", HOSTILE_FOLIO), txCode: "NOUSALI" });
    await admin!`UPDATE account SET status='closed' WHERE id=${REVENUE}::uuid`;
    await conflict(request("order104-closed-route", HOSTILE_FOLIO));
    await admin!`UPDATE account SET status='open' WHERE id=${REVENUE}::uuid`;
    await conflict({ ...request("order104-missing-day", MISSING_DAY_FOLIO),
      envelope: envelope(PROPERTY_MISSING_DAY) });
    await admin!`UPDATE business_day SET sealed_at=now(),sealed_by=${ACTOR_A}::uuid
      WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid AND business_date=${day}::date`;
    await conflict(request("order104-sealed-day", HOSTILE_FOLIO));
    await admin!`UPDATE business_day SET sealed_at=NULL,sealed_by=NULL WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid AND business_date=${day}::date`;
  }, 30_000);

  test("P4: RLS hides A financial truth and B cannot seal or reference it", async () => {
    const seen = await database!.withTenantTransaction(TENANT_B, async (tx) => ({
      journals: (await tx<Array<{ n: number }>>`SELECT count(*)::int n FROM journal WHERE tenant_id=${TENANT_A}::uuid`)[0]!.n,
      lines: (await tx<Array<{ n: number }>>`SELECT count(*)::int n FROM posting_line WHERE tenant_id=${TENANT_A}::uuid`)[0]!.n,
      balances: (await tx<Array<{ n: number }>>`SELECT count(*)::int n FROM folio_balance WHERE tenant_id=${TENANT_A}::uuid`)[0]!.n,
      routes: (await tx<Array<{ n: number }>>`SELECT count(*)::int n FROM tx_code_route WHERE tenant_id=${TENANT_A}::uuid`)[0]!.n,
    }));
    expect(seen).toEqual({ journals: 0, lines: 0, balances: 0, routes: 0 });
    await expectState(() => database!.withTenantTransaction(TENANT_B, (tx) => tx.unsafe(
      "SELECT seal_business_day($1,$2,$3::date,$4)", [TENANT_A, PROPERTY_A, day, ACTOR_B])), "42501");
    const foreign = { tenantId: TENANT_B, folioId: FOLIO, txCode: "ROOM", amountMinor: "1", quantity: "1.000",
      idempotencyKey: "order104-foreign", envelope: envelope(PROPERTY_FOREIGN, TENANT_B, ACTOR_B) } satisfies PostChargeInput;
    await expect(post(foreign)).rejects.toBeInstanceOf(ChargeNotFoundError);
  }, 30_000);

  test("P5: 500 charges create 1,000 balanced immutable lines and replay without drift", async () => {
    const before = await counts(STRESS_FOLIO); const outside = await excluded();
    const all = Array.from({ length: 500 }, (_, index) =>
      request(`order104-stress-${index.toString().padStart(3, "0")}`, STRESS_FOLIO, String(index + 1)));
    for (let start = 0; start < all.length; start += 25) {
      await Promise.all(all.slice(start, start + 25).map((item) => post(item)));
    }
    const sum = 125250n;
    const after = await counts(STRESS_FOLIO);
    expect(after).toEqual({ journals: before.journals + 500, lines: before.lines + 1000,
      facts: before.facts + 500, events: before.events + 500, keys: before.keys + 500, balance: sum.toString() });
    const truth = (await admin!<Array<{ bad: number; global_sum: string; guest_sum: string; route_sum: string; bad_groups: number }>>`
      WITH journal_sums AS (
        SELECT j.id,j.property_node,j.business_date,j.currency,sum(p.amount_minor) total
        FROM journal j JOIN posting_line p ON p.tenant_id=j.tenant_id AND p.journal_id=j.id
        WHERE j.tenant_id=${TENANT_A}::uuid GROUP BY j.id
      ), groups AS (SELECT property_node,business_date,currency,sum(total) total FROM journal_sums GROUP BY 1,2,3)
      SELECT count(*) FILTER(WHERE total<>0)::int bad,COALESCE(sum(total),0)::text global_sum,
        (SELECT sum(amount_minor)::text FROM posting_line WHERE tenant_id=${TENANT_A}::uuid AND folio_id=${STRESS_FOLIO}::uuid) guest_sum,
        (SELECT sum(amount_minor)::text FROM posting_line WHERE tenant_id=${TENANT_A}::uuid AND account_id=${REVENUE}::uuid) route_sum,
        (SELECT count(*)::int FROM groups WHERE total<>0) bad_groups FROM journal_sums`)[0]!;
    expect(truth).toMatchObject({ bad: 0, global_sum: "0", guest_sum: sum.toString(), bad_groups: 0 });
    expect(BigInt(truth.route_sum)).toBeLessThanOrEqual(-sum);
    for (let start = 0; start < all.length; start += 25) {
      expect((await Promise.all(all.slice(start, start + 25).map((item) => post(item)))).every((value) => value.replayed)).toBeTrue();
    }
    expect(await counts(STRESS_FOLIO)).toEqual(after); expect(await excluded()).toEqual(outside);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => tx`UPDATE journal SET description='bad' WHERE tenant_id=${TENANT_A}::uuid`)).rejects.toBeTruthy();
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => tx`DELETE FROM posting_line WHERE tenant_id=${TENANT_A}::uuid`)).rejects.toBeTruthy();
  }, 120_000);
});
