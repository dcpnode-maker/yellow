import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  FolioStatementNotFoundError,
  FolioStatementService,
  FolioStatementValidationError,
  type FolioStatementInput,
} from "../src/contexts/financials";
import { Database, type Tx } from "../src/kernel";

const URL = process.env.YELLOW_FINANCIAL_STATEMENTS_URL;
if (process.env.YELLOW_REQUIRE_FINANCIAL_STATEMENTS === "1" && !URL) {
  throw new Error("YELLOW_FINANCIAL_STATEMENTS_URL is required by the Order 105 proof");
}
const TENANT_A = "00000000-0000-0000-0000-000000010501";
const TENANT_B = "00000000-0000-0000-0000-000000010502";
const PROPERTY_A = "00000000-0000-0000-0000-000000010511";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000010512";
const PROPERTY_B = "00000000-0000-0000-0000-000000010513";
const GUEST_A = "00000000-0000-0000-0000-000000010521";
const REVENUE_A = "00000000-0000-0000-0000-000000010522";
const CLOSED_REVENUE_A = "00000000-0000-0000-0000-000000010523";
const GUEST_A2 = "00000000-0000-0000-0000-000000010524";
const REVENUE_A2 = "00000000-0000-0000-0000-000000010525";
const GUEST_B = "00000000-0000-0000-0000-000000010526";
const REVENUE_B = "00000000-0000-0000-0000-000000010527";
const FOLIO_A = "00000000-0000-0000-0000-000000010531";
const EMPTY_FOLIO_A = "00000000-0000-0000-0000-000000010532";
const OTHER_FOLIO_A = "00000000-0000-0000-0000-000000010533";
const STRESS_FOLIO_A = "00000000-0000-0000-0000-000000010534";
const FOLIO_A2 = "00000000-0000-0000-0000-000000010535";
const FOLIO_B = "00000000-0000-0000-0000-000000010536";
const J1 = "00000000-0000-0000-0000-000000010541";
const J2 = "00000000-0000-0000-0000-000000010542";
const J3 = "00000000-0000-0000-0000-000000010543";
const CANONICAL_JOURNAL = "00000000-0000-0000-0000-000000010544";
const EXTRA_SOURCE_JOURNAL = "00000000-0000-0000-0000-000000010545";
const THREE_LINE_JOURNAL = "00000000-0000-0000-0000-000000010546";
const MISMATCHED_JOURNAL = "00000000-0000-0000-0000-000000010547";

const dbDescribe = URL ? describe.serial : describe.skip;
const service = new FolioStatementService();
let admin: SQL | undefined;
let database: Database | undefined;
let day = "";

function input(overrides: Partial<FolioStatementInput> = {}): FolioStatementInput {
  return { tenantId: TENANT_A, propertyNode: PROPERTY_A, reference: "O105-A", ...overrides };
}
function get(statementInput = input(), tenantId = statementInput.tenantId) {
  return database!.withTenantTransaction(tenantId, (tx) => service.get(tx, statementInput));
}
function rewriteCursor(cursor: string, changes: Record<string, unknown>): string {
  const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>;
  return Buffer.from(JSON.stringify({ ...value, ...changes }), "utf8").toString("base64url");
}
async function clean(): Promise<void> {
  if (!admin) return;
  for (const table of ["api_idempotency", "outbox", "fact_log", "posting_line", "journal",
    "tx_code_route", "business_day", "folio", "account", "org_node"]) {
    await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [TENANT_A, TENANT_B]);
  }
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin`DELETE FROM tx_code WHERE code IN ('SROOM','SCLOSED','SPAY','SNOUSALI')`;
}

beforeAll(async () => {
  if (!URL) return;
  admin = new SQL(URL, { max: 8 });
  database = Database.connect(URL, { maxConnections: 8 });
  await clean();
  day = (await admin<Array<{ d: string }>>`SELECT (statement_timestamp() AT TIME ZONE 'UTC')::date::text d`)[0]!.d;
  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT_A}::uuid,'order105-a','Order 105 A','shared','active'),
    (${TENANT_B}::uuid,'order105-b','Order 105 B','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order105_a','property','Order 105 A','UTC','INR'),
    (${PROPERTY_A2}::uuid,${TENANT_A}::uuid,'order105_a2','property','Order 105 A2','UTC','INR'),
    (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order105_b','property','Order 105 B','UTC','INR')`;
  await admin`INSERT INTO account(id,tenant_id,property_node,role,name,currency,status) VALUES
    (${GUEST_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'guest','Guest ledger A','INR','open'),
    (${REVENUE_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'revenue','Revenue A','INR','open'),
    (${CLOSED_REVENUE_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'revenue','Closed revenue A','INR','closed'),
    (${GUEST_A2}::uuid,${TENANT_A}::uuid,${PROPERTY_A2}::uuid,'guest','Guest ledger A2','INR','open'),
    (${REVENUE_A2}::uuid,${TENANT_A}::uuid,${PROPERTY_A2}::uuid,'revenue','Revenue A2','INR','open'),
    (${GUEST_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'guest','Guest ledger B','INR','open'),
    (${REVENUE_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'revenue','Revenue B','INR','open')`;
  await admin`INSERT INTO folio(id,tenant_id,account_id,folio_no,window_no,name,status,created_at) VALUES
    (${FOLIO_A}::uuid,${TENANT_A}::uuid,${GUEST_A}::uuid,'O105-A',1,'Primary','open','2026-08-20T01:02:03.123456Z'),
    (${EMPTY_FOLIO_A}::uuid,${TENANT_A}::uuid,${GUEST_A}::uuid,'O105-E',2,NULL,'open','2026-08-20T01:02:03.123457Z'),
    (${OTHER_FOLIO_A}::uuid,${TENANT_A}::uuid,${GUEST_A}::uuid,'O105-O',3,NULL,'open','2026-08-20T01:02:03.123458Z'),
    (${STRESS_FOLIO_A}::uuid,${TENANT_A}::uuid,${GUEST_A}::uuid,'O105-S',4,NULL,'open','2026-08-20T01:02:03.123459Z'),
    (${FOLIO_A2}::uuid,${TENANT_A}::uuid,${GUEST_A2}::uuid,'O105-A2',1,NULL,'open','2026-08-20T01:02:03.123460Z'),
    (${FOLIO_B}::uuid,${TENANT_B}::uuid,${GUEST_B}::uuid,'O105-B',1,NULL,'open','2026-08-20T01:02:03.123461Z')`;
  await admin`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr) VALUES
    ('SROOM','Statement room','revenue','Rooms','guest','revenue'),
    ('SCLOSED','Closed route','revenue','Other operated','guest','revenue'),
    ('SPAY','Payment-like','payment','Rooms','guest','revenue'),
    ('SNOUSALI','Unattributed','revenue',NULL,'guest','revenue')`;
  await admin`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,credit_account_id) VALUES
    (${TENANT_A}::uuid,${PROPERTY_A}::uuid,'INR','SROOM',${REVENUE_A}::uuid),
    (${TENANT_A}::uuid,${PROPERTY_A}::uuid,'INR','SCLOSED',${CLOSED_REVENUE_A}::uuid),
    (${TENANT_A}::uuid,${PROPERTY_A}::uuid,'INR','SPAY',${REVENUE_A}::uuid),
    (${TENANT_A}::uuid,${PROPERTY_A}::uuid,'INR','SNOUSALI',${REVENUE_A}::uuid),
    (${TENANT_A}::uuid,${PROPERTY_A2}::uuid,'INR','SROOM',${REVENUE_A2}::uuid),
    (${TENANT_B}::uuid,${PROPERTY_B}::uuid,'INR','SROOM',${REVENUE_B}::uuid)`;
  await admin`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES
    (${TENANT_A}::uuid,${PROPERTY_A}::uuid,${day}::date),
    (${TENANT_A}::uuid,${PROPERTY_A2}::uuid,${day}::date),
    (${TENANT_B}::uuid,${PROPERTY_B}::uuid,${day}::date),
    (${TENANT_A}::uuid,${PROPERTY_A}::uuid,'2026-08-20'),
    (${TENANT_A}::uuid,${PROPERTY_A}::uuid,'2026-08-21'),
    (${TENANT_A}::uuid,${PROPERTY_A}::uuid,'2026-08-22')`;
  await admin`INSERT INTO journal(id,tenant_id,property_node,business_date,kind,description,currency,reverses,created_at) VALUES
    (${J1}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'2026-08-20','charge','First','INR',NULL,'2026-08-20T10:11:12.123456Z'),
    (${J2}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'2026-08-20','adjustment','Second','INR',${J1}::uuid,'2026-08-20T10:11:12.123456Z'),
    (${J3}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'2026-08-21','charge','Third','INR',NULL,'2026-08-21T10:11:12.654321Z')`;
  await admin`INSERT INTO posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,amount_minor,quantity,business_date,currency) VALUES
    (${TENANT_A}::uuid,${J1}::uuid,1,${GUEST_A}::uuid,${FOLIO_A}::uuid,'SROOM','Visible first',9007199254740993,1.000,'2026-08-20','INR'),
    (${TENANT_A}::uuid,${J1}::uuid,2,${REVENUE_A}::uuid,NULL,'SROOM','Counterpart first',-9007199254740993,1.000,'2026-08-20','INR'),
    (${TENANT_A}::uuid,${J2}::uuid,1,${GUEST_A}::uuid,${FOLIO_A}::uuid,'SROOM','Visible second',-10,2.500,'2026-08-20','INR'),
    (${TENANT_A}::uuid,${J2}::uuid,2,${REVENUE_A}::uuid,NULL,'SROOM','Counterpart second',10,2.500,'2026-08-20','INR'),
    (${TENANT_A}::uuid,${J3}::uuid,1,${GUEST_A}::uuid,${FOLIO_A}::uuid,'SROOM','Visible third',7,1.125,'2026-08-21','INR'),
    (${TENANT_A}::uuid,${J3}::uuid,2,${REVENUE_A}::uuid,NULL,'SROOM','Counterpart third',-7,1.125,'2026-08-21','INR')`;
}, 30_000);

afterAll(async () => { await clean(); await database?.close(); await admin?.close(); }, 60_000);

describe("Order 105 folio statement snapshot", () => {
  test("P0: the financial context exposes the statement service", () => expect(typeof FolioStatementService).toBe("function"));
  test("P0/P4: strict malformed input and cursor fail before SQL", async () => {
    let calls = 0;
    const noSql = (() => { calls += 1; return Promise.resolve([]); }) as unknown as Tx;
    const invalid: FolioStatementInput[] = [input({ tenantId: "bad" }), input({ propertyNode: "bad" }),
      input({ reference: "bad reference" }), input({ limit: 0 }), input({ limit: 101 }),
      input({ limit: 1.5 }), input({ after: "!" }),
      { ...input(), accountId: GUEST_A } as unknown as FolioStatementInput];
    for (const candidate of invalid) {
      await expect(service.get(noSql, candidate)).rejects.toBeInstanceOf(FolioStatementValidationError);
    }
    expect(calls).toBe(0);
  });
});

dbDescribe("Order 105 fresh-PostgreSQL statement proof", () => {
  test("P1: empty statement is exact, safe and currently chargeable", async () => {
    expect(await get(input({ reference: EMPTY_FOLIO_A }))).toEqual({
      folio: { id: EMPTY_FOLIO_A, reference: "O105-E", name: null, windowNo: 2, status: "open",
        currency: "INR", createdAt: "2026-08-20T01:02:03.123457Z" },
      balanceMinor: "0", lineCount: 0, rows: [],
      chargeOptions: [{ code: "SROOM", name: "Statement room", usaliLine: "Rooms" }],
      chargeAvailability: { allowed: true, reason: null }, nextCursor: null,
    });
  });

  test("P1: mixed signs, huge exact values, microseconds and full-ledger running balance", async () => {
    const result = await get(input({ limit: 2 }));
    expect(result.balanceMinor).toBe("9007199254740990");
    expect(result.lineCount).toBe(3);
    expect(result.rows).toEqual([
      { lineId: expect.any(String), journalId: J3, kind: "charge", businessDate: "2026-08-21",
        postedAt: "2026-08-21T10:11:12.654321Z", reversesJournalId: null, reversedByJournalId: null,
        correctionEligible: false, correctionReason: "adjustment_not_authorized", txCode: "SROOM",
        description: "Visible third", quantity: "1.125", amountMinor: "7", runningBalanceMinor: "9007199254740990" },
      { lineId: expect.any(String), journalId: J2, kind: "adjustment", businessDate: "2026-08-20",
        postedAt: "2026-08-20T10:11:12.123456Z", reversesJournalId: J1, reversedByJournalId: null,
        correctionEligible: false, correctionReason: "adjustment_not_authorized", txCode: "SROOM",
        description: "Visible second", quantity: "2.500", amountMinor: "-10", runningBalanceMinor: "9007199254740983" },
    ]);
    expect(result.nextCursor).toBeString();
    expect(JSON.stringify(result)).not.toMatch(/account|counterpart|source|tax|party|contact/i);
  });

  test("P1/P4: descending keyset pages return every row once without resetting running balance", async () => {
    const seen = [];
    let after: string | undefined;
    do {
      const page = await get(input({ limit: 1, ...(after ? { after } : {}) }));
      seen.push(...page.rows);
      after = page.nextCursor ?? undefined;
    } while (after);
    expect(seen.map((row) => row.journalId)).toEqual([J3, J2, J1]);
    expect(seen.map((row) => row.runningBalanceMinor)).toEqual(["9007199254740990", "9007199254740983", "9007199254740993"]);
    expect(new Set(seen.map((row) => row.lineId)).size).toBe(3);
  });

  test("P1/P4: options are filtered and reads create no artifacts", async () => {
    const counts = () => admin!<Array<Record<string, number>>>`SELECT
      (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT_A}::uuid) journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${TENANT_A}::uuid) lines,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid) events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT_A}::uuid) keys`;
    const before = (await counts())[0]!;
    const result = await get();
    expect(result.chargeOptions).toEqual([{ code: "SROOM", name: "Statement room", usaliLine: "Rooms" }]);
    expect((await counts())[0]!).toEqual(before);
  });

  test("P4: property, folio and tenant boundaries fail closed", async () => {
    await expect(get(input({ propertyNode: PROPERTY_A2 }))).rejects.toBeInstanceOf(FolioStatementNotFoundError);
    await expect(get(input({ tenantId: TENANT_B, propertyNode: PROPERTY_B, reference: "O105-A" }), TENANT_B))
      .rejects.toBeInstanceOf(FolioStatementNotFoundError);
    const cursor = (await get(input({ limit: 1 }))).nextCursor!;
    await expect(get(input({ after: rewriteCursor(cursor, { p: PROPERTY_A2 }) }))).rejects.toBeInstanceOf(FolioStatementValidationError);
    await expect(get(input({ after: rewriteCursor(cursor, { f: OTHER_FOLIO_A }) }))).rejects.toBeInstanceOf(FolioStatementValidationError);
    const tenantBVisible = await database!.withTenantTransaction(TENANT_B, async (tx) => ({
      folios: (await tx<Array<{ n: number }>>`SELECT count(*)::int n FROM folio WHERE tenant_id=${TENANT_A}::uuid`)[0]!.n,
      lines: (await tx<Array<{ n: number }>>`SELECT count(*)::int n FROM posting_line WHERE tenant_id=${TENANT_A}::uuid`)[0]!.n,
      options: (await tx<Array<{ n: number }>>`SELECT count(*)::int n FROM tx_code_route WHERE tenant_id=${TENANT_A}::uuid`)[0]!.n,
    }));
    expect(tenantBVisible).toEqual({ folios: 0, lines: 0, options: 0 });
  });

  test("P1: availability explains closed folio, account and day", async () => {
    await admin!`UPDATE folio SET status='closed' WHERE id=${EMPTY_FOLIO_A}::uuid`;
    expect((await get(input({ reference: "O105-E" }))).chargeAvailability).toEqual({ allowed: false, reason: "folio_not_open" });
    await admin!`UPDATE folio SET status='open' WHERE id=${EMPTY_FOLIO_A}::uuid`;
    await admin!`UPDATE account SET status='frozen' WHERE id=${GUEST_A}::uuid`;
    expect((await get(input({ reference: "O105-E" }))).chargeAvailability).toEqual({ allowed: false, reason: "guest_account_not_open" });
    await admin!`UPDATE account SET status='open' WHERE id=${GUEST_A}::uuid`;
    await admin!`UPDATE business_day SET sealed_at=statement_timestamp() WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid AND business_date=${day}::date`;
    expect((await get(input({ reference: "O105-E" }))).chargeAvailability).toEqual({ allowed: false, reason: "business_day_sealed" });
    await admin!`UPDATE business_day SET sealed_at=NULL WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid AND business_date=${day}::date`;
  });

  test("P1/P4: correction eligibility exactly matches the canonical command shape", async () => {
    const journals = [CANONICAL_JOURNAL, EXTRA_SOURCE_JOURNAL, THREE_LINE_JOURNAL, MISMATCHED_JOURNAL];
    try {
      await admin!`INSERT INTO journal(
          id,tenant_id,property_node,business_date,kind,description,currency,source,created_at
        ) VALUES
        (${CANONICAL_JOURNAL}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,${day}::date,
          'charge','Canonical','INR','{"interface":"financials.charge.post"}'::jsonb,'2026-08-23T00:00:00.000001Z'),
        (${EXTRA_SOURCE_JOURNAL}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,${day}::date,
          'charge','Extra source','INR','{"interface":"financials.charge.post","extra":true}'::jsonb,'2026-08-23T00:00:00.000002Z'),
        (${THREE_LINE_JOURNAL}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,${day}::date,
          'charge','Three lines','INR','{"interface":"financials.charge.post"}'::jsonb,'2026-08-23T00:00:00.000003Z'),
        (${MISMATCHED_JOURNAL}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,${day}::date,
          'charge','Mismatch','INR','{"interface":"financials.charge.post"}'::jsonb,'2026-08-23T00:00:00.000004Z')`;
      await admin!`INSERT INTO posting_line(
          tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,
          amount_minor,quantity,business_date,currency
        ) VALUES
        (${TENANT_A}::uuid,${CANONICAL_JOURNAL}::uuid,1,${GUEST_A}::uuid,${FOLIO_A}::uuid,'SROOM','Canonical',100,1.000,${day}::date,'INR'),
        (${TENANT_A}::uuid,${CANONICAL_JOURNAL}::uuid,2,${REVENUE_A}::uuid,NULL,'SROOM','Canonical',-100,1.000,${day}::date,'INR'),
        (${TENANT_A}::uuid,${EXTRA_SOURCE_JOURNAL}::uuid,1,${GUEST_A}::uuid,${FOLIO_A}::uuid,'SROOM','Extra source',110,1.000,${day}::date,'INR'),
        (${TENANT_A}::uuid,${EXTRA_SOURCE_JOURNAL}::uuid,2,${REVENUE_A}::uuid,NULL,'SROOM','Extra source',-110,1.000,${day}::date,'INR'),
        (${TENANT_A}::uuid,${THREE_LINE_JOURNAL}::uuid,1,${GUEST_A}::uuid,${FOLIO_A}::uuid,'SROOM','Three lines',120,1.000,${day}::date,'INR'),
        (${TENANT_A}::uuid,${THREE_LINE_JOURNAL}::uuid,2,${REVENUE_A}::uuid,NULL,'SROOM','Three lines',-60,1.000,${day}::date,'INR'),
        (${TENANT_A}::uuid,${THREE_LINE_JOURNAL}::uuid,3,${REVENUE_A}::uuid,NULL,'SROOM','Three lines',-60,1.000,${day}::date,'INR'),
        (${TENANT_A}::uuid,${MISMATCHED_JOURNAL}::uuid,1,${GUEST_A}::uuid,${FOLIO_A}::uuid,'SROOM','Mismatch',130,1.000,${day}::date,'INR'),
        (${TENANT_A}::uuid,${MISMATCHED_JOURNAL}::uuid,2,${REVENUE_A}::uuid,NULL,'SROOM','Mismatch',-130,2.000,${day}::date,'INR')`;

      const statement = await get(input({ canCorrectCharge: true, canPostSealAdjustment: true, limit: 100 }));
      const byJournal = new Map(statement.rows.map((row) => [row.journalId, row]));
      expect(byJournal.get(CANONICAL_JOURNAL)).toMatchObject({
        correctionEligible: true,
        correctionReason: null,
      });
      for (const journalId of [EXTRA_SOURCE_JOURNAL, THREE_LINE_JOURNAL, MISMATCHED_JOURNAL]) {
        expect(byJournal.get(journalId)).toMatchObject({
          correctionEligible: false,
          correctionReason: journalId === EXTRA_SOURCE_JOURNAL ? "not_original_charge" : "inconsistent_posting_set",
        });
      }
    } finally {
      await admin!`DELETE FROM posting_line WHERE tenant_id=${TENANT_A}::uuid AND journal_id IN (
        ${journals[0]}::uuid, ${journals[1]}::uuid, ${journals[2]}::uuid, ${journals[3]}::uuid
      )`;
      await admin!`DELETE FROM journal WHERE tenant_id=${TENANT_A}::uuid AND id IN (
        ${journals[0]}::uuid, ${journals[1]}::uuid, ${journals[2]}::uuid, ${journals[3]}::uuid
      )`;
    }
  });

  test("P4: 10,000-line folio stays indexed and bounded with complete running truth", async () => {
    await admin!`INSERT INTO journal(id,tenant_id,property_node,business_date,kind,description,currency,created_at)
      SELECT ('00000000-0000-0000-1050-' || lpad(n::text,12,'0'))::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,
        '2026-08-22'::date,'charge','Stress','INR','2026-08-22T00:00:00Z'::timestamptz + n * interval '1 microsecond'
      FROM generate_series(1,100) n`;
    await admin!`INSERT INTO posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,amount_minor,quantity,business_date,currency)
      SELECT ${TENANT_A}::uuid,('00000000-0000-0000-1050-' || lpad(j::text,12,'0'))::uuid,s::smallint,
        ${GUEST_A}::uuid,${STRESS_FOLIO_A}::uuid,'SROOM','Stress visible',1,1.000,'2026-08-22'::date,'INR'
      FROM generate_series(1,100) j CROSS JOIN generate_series(1,100) s
      UNION ALL SELECT ${TENANT_A}::uuid,('00000000-0000-0000-1050-' || lpad(j::text,12,'0'))::uuid,101,
        ${REVENUE_A}::uuid,NULL,'SROOM','Stress counterpart',-100,100.000,'2026-08-22'::date,'INR' FROM generate_series(1,100) j`;
    const started = performance.now();
    const result = await get(input({ reference: "O105-S", limit: 100 }));
    const elapsed = performance.now() - started;
    expect(result.lineCount).toBe(10_000);
    expect(result.balanceMinor).toBe("10000");
    expect(result.rows).toHaveLength(100);
    expect(result.rows[0]!.runningBalanceMinor).toBe("10000");
    expect(result.nextCursor).toBeString();
    expect(elapsed).toBeLessThan(5_000);
    const plan = (await admin!<Array<{ "QUERY PLAN": string }>>`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT line.id FROM posting_line line WHERE line.tenant_id=${TENANT_A}::uuid AND line.folio_id=${STRESS_FOLIO_A}::uuid`)
      .map((row) => row["QUERY PLAN"]).join("\n");
    expect(plan).toMatch(/posting_folio/i);
  }, 60_000);
});
