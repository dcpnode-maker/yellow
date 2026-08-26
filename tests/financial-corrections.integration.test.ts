import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  ChargeCorrectionAuthorizationError,
  ChargeCorrectionConflictError,
  ChargeCorrectionService,
  ChargeCorrectionValidationError,
  ChargeService,
  type ReverseChargeInput,
} from "../src/contexts/financials";
import {
  createAuditEnvelope,
  Database,
  IdempotencyConflictError,
  PostgresEventBus,
  PostgresIdempotency,
} from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_FINANCIAL_CORRECTIONS_URL;
if (process.env.YELLOW_REQUIRE_FINANCIAL_CORRECTIONS === "1" && !DATABASE_URL) {
  throw new Error("YELLOW_FINANCIAL_CORRECTIONS_URL is required by the Order 183 proof");
}
const TENANT = "00000000-0000-0000-0000-000000018301";
const PROPERTY = "00000000-0000-0000-0000-000000018302";
const ACTOR = "00000000-0000-0000-0000-000000018303";
const PARTY = "00000000-0000-0000-0000-000000018304";
const GUEST = "00000000-0000-0000-0000-000000018305";
const REVENUE = "00000000-0000-0000-0000-000000018306";
const FOLIOS = Object.freeze([
  "00000000-0000-0000-0000-000000018311",
  "00000000-0000-0000-0000-000000018312",
  "00000000-0000-0000-0000-000000018313",
  "00000000-0000-0000-0000-000000018314",
  "00000000-0000-0000-0000-000000018315",
  "00000000-0000-0000-0000-000000018316",
]);
const CODE = "O183ROOM";
const dbDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let charges: ChargeService | undefined;
let corrections: ChargeCorrectionService | undefined;
let day = "";
let previousDay = "";
let nextDay = "";

function envelope() {
  return createAuditEnvelope({ operation: "journal.posted", tenantId: TENANT,
    propertyNode: PROPERTY, actorId: ACTOR, requestId: crypto.randomUUID() });
}

async function charge(folioId: string, key: string, amountMinor = "12500") {
  return database!.withTenantTransaction(TENANT, (tx) => charges!.postCharge(tx, {
    tenantId: TENANT, folioId, txCode: CODE, amountMinor, quantity: "1.000",
    idempotencyKey: key, envelope: envelope(),
  }));
}

function correction(original: string, folioId: string, key: string,
  postSealAuthorized = false, reason = "Correct room charge coding"): ReverseChargeInput {
  return { tenantId: TENANT, folioId, reversesJournalId: original, reason,
    postSealAuthorized, idempotencyKey: key, envelope: envelope() };
}

function reverse(input: ReverseChargeInput) {
  return database!.withTenantTransaction(TENANT, (tx) => corrections!.reverseCharge(tx, input));
}

async function expectSqlState(action: () => Promise<unknown>, state: string) {
  try {
    await action();
    throw new Error(`expected SQLSTATE ${state}`);
  } catch (error) {
    expect((error as { errno?: string }).errno).toBe(state);
  }
}

function pgDateArray(values: unknown[]): string {
  return `{${values.map((value) => value === null ? "NULL" : `"${String(value)}"`).join(",")}}`;
}

async function clean() {
  if (!admin) return;
  for (const table of ["api_idempotency", "outbox", "fact_log", "posting_line", "journal",
    "tx_code_route", "business_day", "folio", "account", "app_user", "party_role", "party", "org_node"]) {
    await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id = $1::uuid`, [TENANT]);
  }
  await admin`DELETE FROM tenant WHERE id=${TENANT}::uuid`;
  await admin`DELETE FROM tx_code WHERE code=${CODE}`;
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 40 });
  eventPool = new SQL(DATABASE_URL, { max: 40, prepare: false });
  database = Database.connect(DATABASE_URL, { maxConnections: 50, prepare: false });
  const events = new PostgresEventBus(eventPool);
  charges = new ChargeService({ events, idempotency: new PostgresIdempotency() });
  corrections = new ChargeCorrectionService({ events, idempotency: new PostgresIdempotency() });
  await clean();
  day = (await admin<Array<{ d: string }>>`
    SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text d`)[0]!.d;
  const adjacentDays = (await admin<Array<{
    previous_day: string; next_day: string;
  }>>`SELECT (${day}::date - 1)::text previous_day, (${day}::date + 1)::text next_day`)[0]!;
  previousDay = adjacentDays.previous_day;
  nextDay = adjacentDays.next_day;
  await admin`INSERT INTO tenant(id,slug,name,tier,status)
    VALUES(${TENANT}::uuid,'order183','Order 183','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency)
    VALUES(${PROPERTY}::uuid,${TENANT}::uuid,'order183','property','Order 183','UTC','INR')`;
  await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status)
    VALUES(${ACTOR}::uuid,${TENANT}::uuid,'actor@order183.test','Order 183 Actor','active')`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status)
    VALUES(${PARTY}::uuid,${TENANT}::uuid,'person','Order 183 Guest','active')`;
  await admin`INSERT INTO party_role(tenant_id,party_id,role)
    VALUES(${TENANT}::uuid,${PARTY}::uuid,'guest')`;
  await admin`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES
    (${GUEST}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${PARTY}::uuid,'Guest','INR','open'),
    (${REVENUE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'revenue',NULL,'Revenue','INR','open')`;
  for (const [index, folio] of FOLIOS.entries()) {
    await admin`INSERT INTO folio(id,tenant_id,account_id,folio_no,window_no,status)
      VALUES(${folio}::uuid,${TENANT}::uuid,${GUEST}::uuid,${`O183-${index + 1}`},${index + 1},'open')`;
  }
  await admin`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr)
    VALUES(${CODE},'Order 183 room','revenue','Rooms','guest','revenue')`;
  await admin`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,credit_account_id)
    VALUES(${TENANT}::uuid,${PROPERTY}::uuid,'INR',${CODE},${REVENUE}::uuid)`;
  await admin`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES
    (${TENANT}::uuid,${PROPERTY}::uuid,${previousDay}::date),
    (${TENANT}::uuid,${PROPERTY}::uuid,${day}::date),
    (${TENANT}::uuid,${PROPERTY}::uuid,${nextDay}::date)`;
}, 30_000);

afterAll(async () => {
  await clean();
  await database?.close();
  await eventPool?.close();
  await admin?.close();
}, 60_000);

describe("Order 183 correction boundary", () => {
  test("P0 exports the governed service and rejects malformed authority before SQL", async () => {
    expect(typeof ChargeCorrectionService).toBe("function");
    const invalid = correction(crypto.randomUUID(), FOLIOS[0]!, "order183-invalid", false, " padded ");
    await expect(new ChargeCorrectionService({} as never).reverseCharge({} as never, invalid))
      .rejects.toBeInstanceOf(ChargeCorrectionValidationError);
    const migration = await Bun.file(new URL("../migrations/0019_financial_reversal_authority.sql", import.meta.url)).text();
    expect(migration).toContain("GRANT INSERT (reverses) ON public.journal TO app_role");
    expect(migration).toContain("ON public.journal (tenant_id, reverses)");
    expect(migration).toContain("WHERE reverses IS NOT NULL");
    expect(migration).not.toMatch(/GRANT\s+UPDATE|GRANT\s+DELETE/i);
  });
});

dbDescribe("Order 183 fresh-PostgreSQL correction proof", () => {
  test("P0/P4 bounded day-lock capability is exact and hostile inputs fail closed", async () => {
    const authority = await admin!<Array<{
      owner: string; security_definer: boolean; volatility: string; config: string[];
      app: boolean; runtime: boolean; public_role: boolean;
    }>>`
      SELECT pg_get_userbyid(p.proowner) owner, p.prosecdef security_definer,
             p.provolatile::text volatility, p.proconfig config,
             has_function_privilege('app_role',p.oid,'EXECUTE') app,
             has_function_privilege('yellow_runtime',p.oid,'EXECUTE') runtime,
             has_function_privilege('public',p.oid,'EXECUTE') public_role
      FROM pg_proc p
      WHERE p.oid='public.lock_financial_business_days(uuid,uuid,date[])'::regprocedure`;
    expect(authority).toEqual([{ owner: "yellow_owner", security_definer: true, volatility: "v",
      config: ["search_path=pg_catalog, public, pg_temp"], app: true, runtime: false, public_role: false }]);

    await database!.withTenantTransaction(TENANT, (tx) => tx.unsafe(
      "SELECT public.lock_financial_business_days($1::uuid,$2::uuid,$3::date[])",
      [TENANT, PROPERTY, pgDateArray([day, previousDay])],
    ));
    await expectSqlState(() => admin!.unsafe(
      "SELECT public.lock_financial_business_days($1::uuid,$2::uuid,$3::date[])",
      [TENANT, PROPERTY, pgDateArray([day])],
    ), "42501");
    await expectSqlState(() => database!.withTenantTransaction(TENANT, (tx) => tx.unsafe(
      "SELECT business_date FROM business_day WHERE tenant_id=$1::uuid AND property_node=$2::uuid FOR SHARE",
      [TENANT, PROPERTY],
    )), "42501");
    await expectSqlState(() => database!.withTenantTransaction(TENANT, (tx) => tx.unsafe(
      "SELECT public.lock_financial_business_days($1::uuid,$2::uuid,$3::date[])",
      ["00000000-0000-0000-0000-000000018399", PROPERTY, pgDateArray([day])],
    )), "42501");
    for (const [dates, state] of [
      [[], "22023"], [[day, day], "22023"], [[day, previousDay, nextDay], "22023"],
      [[null], "22023"], [["infinity"], "22023"], [["-infinity"], "22023"],
      [["2001-01-01"], "55000"],
    ] as Array<[unknown[], string]>) {
      await expectSqlState(() => database!.withTenantTransaction(TENANT, (tx) => tx.unsafe(
        "SELECT public.lock_financial_business_days($1::uuid,$2::uuid,$3::date[])",
        [TENANT, PROPERTY, pgDateArray(dates)],
      )), state);
    }
    await expectSqlState(() => database!.withTenantTransaction(TENANT, (tx) => tx.unsafe(
      "SELECT public.lock_financial_business_days($1::uuid,$2::uuid,$3::date[])",
      [TENANT, "00000000-0000-0000-0000-000000018398", pgDateArray([day])],
    )), "55000");
    await expectSqlState(() => database!.withTenantTransaction(TENANT, (tx) => tx.unsafe(
      "UPDATE business_day SET sealed_at=sealed_at WHERE tenant_id=$1::uuid",
      [TENANT],
    )), "42501");
  }, 30_000);

  test("P0/P4 reversed day sets serialize while unrelated rows remain nonblocking", async () => {
    let acquired!: () => void;
    let release!: () => void;
    const acquiredPromise = new Promise<void>((resolve) => { acquired = resolve; });
    const releasePromise = new Promise<void>((resolve) => { release = resolve; });
    const holder = database!.withTenantTransaction(TENANT, async (tx) => {
      await tx.unsafe("SELECT public.lock_financial_business_days($1::uuid,$2::uuid,$3::date[])",
        [TENANT, PROPERTY, pgDateArray([day, previousDay])]);
      acquired();
      await releasePromise;
    });
    await acquiredPromise;

    let competingSettled = false;
    const competing = database!.withTenantTransaction(TENANT, (tx) => tx.unsafe(
      "SELECT public.lock_financial_business_days($1::uuid,$2::uuid,$3::date[])",
      [TENANT, PROPERTY, pgDateArray([previousDay, day])],
    )).then(() => { competingSettled = true; });
    let sameRowUpdateSettled = false;
    const sameRowUpdate = admin!`UPDATE business_day SET sealed_at=sealed_at
      WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid
        AND business_date=${day}::date`.then(() => { sameRowUpdateSettled = true; });
    await admin!`UPDATE business_day SET sealed_at=sealed_at
      WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid
        AND business_date=${nextDay}::date`;
    await Bun.sleep(50);
    expect(competingSettled).toBe(true);
    expect(sameRowUpdateSettled).toBe(false);
    release();
    await Promise.all([holder, competing, sameRowUpdate]);
    expect(sameRowUpdateSettled).toBe(true);
  }, 30_000);

  test("P1 creates exact contra lines and leaves original bytes unchanged", async () => {
    const original = await charge(FOLIOS[0]!, "order183-charge-canonical", "850000");
    const before = (await admin!<Array<{ value: string }>>`
      SELECT encode(digest((to_jsonb(j)::text || jsonb_agg(to_jsonb(p) ORDER BY p.seq)::text)::bytea,'sha256'),'hex') value
      FROM journal j JOIN posting_line p ON p.journal_id=j.id
      WHERE j.id=${original.journalId}::uuid GROUP BY j.id`)[0]!.value;
    const result = await reverse(correction(original.journalId, FOLIOS[0]!, "order183-reverse-canonical"));
    expect(result).toMatchObject({ folioId: FOLIOS[0], reversesJournalId: original.journalId,
      currency: "INR", amountMinor: "-850000", replayed: false });
    const after = (await admin!<Array<{ value: string }>>`
      SELECT encode(digest((to_jsonb(j)::text || jsonb_agg(to_jsonb(p) ORDER BY p.seq)::text)::bytea,'sha256'),'hex') value
      FROM journal j JOIN posting_line p ON p.journal_id=j.id
      WHERE j.id=${original.journalId}::uuid GROUP BY j.id`)[0]!.value;
    expect(after).toBe(before);
    const comparison = await admin!<Array<{ bad: number; total: string; balance: string }>>`
      SELECT count(*) FILTER (WHERE correction.seq IS NULL OR correction.account_id<>original.account_id
          OR correction.folio_id IS DISTINCT FROM original.folio_id
          OR correction.tx_code<>original.tx_code OR correction.description IS DISTINCT FROM original.description
          OR correction.quantity<>original.quantity OR correction.amount_minor<>-original.amount_minor
          OR correction.tax_detail IS NOT NULL)::int bad,
        sum(correction.amount_minor)::text total,
        (SELECT balance_minor::text FROM folio_balance WHERE tenant_id=${TENANT}::uuid AND folio_id=${FOLIOS[0]}::uuid) balance
      FROM posting_line original FULL JOIN posting_line correction
        ON correction.journal_id=${result.journalId}::uuid AND correction.seq=original.seq
      WHERE original.journal_id=${original.journalId}::uuid`;
    expect(comparison).toEqual([{ bad: 0, total: "0", balance: "0" }]);
    const evidence = (await admin!<Array<{ kind: string; reverses: string; facts: number; events: number }>>`
      SELECT j.kind,j.reverses,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=j.id AND fact_type='journal.posted') facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id=j.id AND event_type='journal.posted') events
      FROM journal j WHERE j.id=${result.journalId}::uuid`)[0]!;
    expect(evidence).toEqual({ kind: "adjustment", reverses: original.journalId, facts: 1, events: 1 });
  }, 30_000);

  test("P2 replay is exact, changed reuse conflicts, and 20 distinct keys have one winner", async () => {
    const original = await charge(FOLIOS[1]!, "order183-charge-race", "18000");
    const exact = correction(original.journalId, FOLIOS[1]!, "order183-replay-exact");
    const first = await reverse(exact);
    expect(await reverse(exact)).toEqual({ ...first, replayed: true });
    await expect(reverse({ ...exact, reason: "A changed correction reason" }))
      .rejects.toBeInstanceOf(IdempotencyConflictError);

    const secondOriginal = await charge(FOLIOS[2]!, "order183-charge-race-two", "99");
    const outcomes = await Promise.allSettled(Array.from({ length: 20 }, (_, index) =>
      reverse(correction(secondOriginal.journalId, FOLIOS[2]!, `order183-race-${index}`))));
    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.filter((item): item is PromiseRejectedResult => item.status === "rejected");
    expect(rejected).toHaveLength(19);
    expect(rejected.every(({ reason }) => reason instanceof ChargeCorrectionConflictError)).toBeTrue();
    expect((await admin!<Array<{ n: number }>>`
      SELECT count(*)::int n FROM journal WHERE tenant_id=${TENANT}::uuid
       AND reverses=${secondOriginal.journalId}::uuid`)[0]!.n).toBe(1);
  }, 60_000);

  test("P3 sealed-day authority is server input and immutable ACL remains denied", async () => {
    const original = await charge(FOLIOS[3]!, "order183-charge-sealed", "700");
    await admin!`UPDATE business_day SET sealed_at=now(),sealed_by=${ACTOR}::uuid
      WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid AND business_date=${day}::date`;
    await expect(reverse(correction(original.journalId, FOLIOS[3]!, "order183-sealed-denied")))
      .rejects.toBeInstanceOf(ChargeCorrectionAuthorizationError);
    expect(await reverse(correction(original.journalId, FOLIOS[3]!, "order183-sealed-authorized", true)))
      .toMatchObject({ reversesJournalId: original.journalId, amountMinor: "-700" });
    for (const sql of [
      "UPDATE journal SET description=description WHERE tenant_id=$1::uuid",
      "DELETE FROM journal WHERE tenant_id=$1::uuid",
    ]) {
      try {
        await database!.withTenantTransaction(TENANT, (tx) => tx.unsafe(sql, [TENANT]));
        throw new Error("immutable journal mutation unexpectedly succeeded");
      } catch (error) {
        expect((error as { errno?: string }).errno).toBe("42501");
      }
    }
  }, 30_000);
});
