import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  ChargeConflictError,
  ChargeService,
  FolioSettlementConflictError,
  FolioSettlementNotFoundError,
  FolioSettlementService,
  type FolioSettlementInput,
} from "../src/contexts/financials";
import {
  createAuditEnvelope,
  Database,
  IdempotencyConflictError,
  PostgresEventBus,
  PostgresIdempotency,
} from "../src/kernel";

const RUNTIME_URL = process.env.YELLOW_FINANCIAL_SETTLEMENT_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_FINANCIAL_SETTLEMENT === "1";

if (REQUIRE_DATABASE && (!RUNTIME_URL || !DEPLOY_URL)) {
  throw new Error(
    "YELLOW_FINANCIAL_SETTLEMENT_URL (or YELLOW_RUNTIME_DATABASE_URL) and " +
      "YELLOW_DEPLOY_DATABASE_URL are required by the Order 196 proof",
  );
}

const dbDescribe = RUNTIME_URL && DEPLOY_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000019601";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000019602";
const PROPERTY = "00000000-0000-0000-0000-000000019611";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000019612";
const ACTOR = "00000000-0000-0000-0000-000000019621";
const FOREIGN_ACTOR = "00000000-0000-0000-0000-000000019622";
const PARTY = "00000000-0000-0000-0000-000000019631";
const FOREIGN_PARTY = "00000000-0000-0000-0000-000000019632";
const GUEST = "00000000-0000-0000-0000-000000019641";
const FROZEN_GUEST = "00000000-0000-0000-0000-000000019642";
const REVENUE = "00000000-0000-0000-0000-000000019643";
const FOREIGN_GUEST = "00000000-0000-0000-0000-000000019644";

const ZERO = "00000000-0000-0000-0000-000000019651";
const RACE = "00000000-0000-0000-0000-000000019652";
const NONZERO = "00000000-0000-0000-0000-000000019653";
const WRONG_OPEN = "00000000-0000-0000-0000-000000019654";
const WRONG_SETTLED = "00000000-0000-0000-0000-000000019655";
const FROZEN = "00000000-0000-0000-0000-000000019656";
const FOREIGN = "00000000-0000-0000-0000-000000019657";
const ARBITRATION = "00000000-0000-0000-0000-000000019658";
const NONZERO_JOURNAL = "00000000-0000-0000-0000-000000019661";
const NONZERO_GUEST_LINE = "00000000-0000-0000-0000-000000019662";
const NONZERO_REVENUE_LINE = "00000000-0000-0000-0000-000000019663";
const CODE = "O196ROOM";

let deploy: SQL | undefined;
let runtime: SQL | undefined;
let database: Database | undefined;
let settlements: FolioSettlementService | undefined;
let charges: ChargeService | undefined;
let businessDate = "";

function request(
  action: "settle" | "close",
  folioId: string,
  idempotencyKey: string,
  authority: {
    readonly tenantId: string;
    readonly propertyNode: string;
    readonly actorId: string;
  } = { tenantId: TENANT, propertyNode: PROPERTY, actorId: ACTOR },
): FolioSettlementInput {
  return Object.freeze({
    tenantId: authority.tenantId,
    folioId,
    idempotencyKey,
    envelope: createAuditEnvelope({
      operation: action === "settle" ? "folio.settled" : "folio.closed",
      tenantId: authority.tenantId,
      propertyNode: authority.propertyNode,
      actorId: authority.actorId,
      requestId: crypto.randomUUID(),
    }),
  });
}

async function captureSqlState(operation: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await operation();
  } catch (error) {
    const failure = error as { errno?: string; code?: string };
    return failure.errno ?? failure.code;
  }
  throw new Error("Expected PostgreSQL operation to fail");
}

async function financialSnapshot(): Promise<unknown> {
  return deploy!`
    SELECT
      (SELECT COALESCE(jsonb_agg(to_jsonb(journal) ORDER BY journal.id), '[]'::jsonb)
         FROM journal WHERE tenant_id=${TENANT}::uuid) AS journals,
      (SELECT COALESCE(jsonb_agg(to_jsonb(line) ORDER BY line.id), '[]'::jsonb)
         FROM posting_line AS line WHERE tenant_id=${TENANT}::uuid) AS posting_lines,
      (SELECT COALESCE(jsonb_agg(to_jsonb(balance) ORDER BY balance.folio_id), '[]'::jsonb)
         FROM folio_balance AS balance WHERE tenant_id=${TENANT}::uuid) AS balances
  `;
}

async function evidence(folioId: string): Promise<{
  readonly status: string;
  readonly facts: number;
  readonly events: number;
}> {
  return (await deploy!<Array<{ status: string; facts: number; events: number }>>`
    SELECT folio.status,
      (SELECT count(*)::int FROM fact_log
        WHERE tenant_id=${TENANT}::uuid AND entity_type='folio'
          AND entity_id=${folioId}::uuid
          AND fact_type IN ('folio.settled','folio.closed')) AS facts,
      (SELECT count(*)::int FROM outbox
        WHERE tenant_id=${TENANT}::uuid AND aggregate_type='folio'
          AND aggregate_id=${folioId}::uuid
          AND event_type IN ('folio.settled','folio.closed')) AS events
    FROM folio
    WHERE tenant_id=${TENANT}::uuid AND id=${folioId}::uuid
  `)[0]!;
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  for (const table of [
    "api_idempotency",
    "outbox",
    "fact_log",
    "posting_line",
    "journal",
    "tx_code_route",
    "business_day",
    "folio",
    "account",
    "app_user",
    "party_role",
    "party",
    "org_node",
  ]) {
    await deploy.unsafe(
      `DELETE FROM ${table} WHERE tenant_id IN ($1::uuid, $2::uuid)`,
      [TENANT, FOREIGN_TENANT],
    );
  }
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM tx_code WHERE code=${CODE}`;
}

beforeAll(async () => {
  if (!RUNTIME_URL || !DEPLOY_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 8, prepare: false });
  runtime = new SQL(RUNTIME_URL, { max: 8, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 40, prepare: false });
  const events = new PostgresEventBus(runtime);
  settlements = new FolioSettlementService({
    database,
    events,
    idempotency: new PostgresIdempotency(),
  });
  charges = new ChargeService({ events, idempotency: new PostgresIdempotency() });
  await cleanup();

  businessDate = (await deploy<Array<{ business_date: string }>>`
    SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS business_date
  `)[0]!.business_date;

  await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order196','Order 196','shared','active'),
    (${FOREIGN_TENANT}::uuid,'order196-foreign','Order 196 Foreign','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order196','property','Order 196','UTC','USD'),
    (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order196_foreign','property',
      'Order 196 Foreign','UTC','USD')`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR}::uuid,${TENANT}::uuid,'operator@order196.test','Order 196 Operator','active'),
    (${FOREIGN_ACTOR}::uuid,${FOREIGN_TENANT}::uuid,'operator@foreign.order196.test',
      'Order 196 Foreign Operator','active')`;
  await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY}::uuid,${TENANT}::uuid,'person','Order 196 Guest','active'),
    (${FOREIGN_PARTY}::uuid,${FOREIGN_TENANT}::uuid,'person','Order 196 Foreign Guest','active')`;
  await deploy`INSERT INTO party_role(tenant_id,party_id,role) VALUES
    (${TENANT}::uuid,${PARTY}::uuid,'guest'),
    (${FOREIGN_TENANT}::uuid,${FOREIGN_PARTY}::uuid,'guest')`;
  await deploy`INSERT INTO account(
      id,tenant_id,property_node,role,party_id,name,currency,status
    ) VALUES
    (${GUEST}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${PARTY}::uuid,
      'Order 196 Guest','USD','open'),
    (${FROZEN_GUEST}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${PARTY}::uuid,
      'Order 196 Frozen Guest','USD','frozen'),
    (${REVENUE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'revenue',NULL,
      'Order 196 Revenue','USD','open'),
    (${FOREIGN_GUEST}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'guest',
      ${FOREIGN_PARTY}::uuid,'Order 196 Foreign Guest','USD','open')`;
  await deploy`INSERT INTO folio(id,tenant_id,account_id,folio_no,window_no,name,status) VALUES
    (${ZERO}::uuid,${TENANT}::uuid,${GUEST}::uuid,'O196-ZERO',1,'Zero','open'),
    (${RACE}::uuid,${TENANT}::uuid,${GUEST}::uuid,'O196-RACE',2,'Race','open'),
    (${NONZERO}::uuid,${TENANT}::uuid,${GUEST}::uuid,'O196-NONZERO',3,'Non-zero','open'),
    (${WRONG_OPEN}::uuid,${TENANT}::uuid,${GUEST}::uuid,'O196-OPEN',4,'Open','open'),
    (${WRONG_SETTLED}::uuid,${TENANT}::uuid,${GUEST}::uuid,'O196-SETTLED',5,
      'Settled','settled'),
    (${FROZEN}::uuid,${TENANT}::uuid,${FROZEN_GUEST}::uuid,'O196-FROZEN',1,
      'Frozen','open'),
    (${ARBITRATION}::uuid,${TENANT}::uuid,${GUEST}::uuid,'O196-ARBITRATION',6,
      'Charge versus settle','open'),
    (${FOREIGN}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_GUEST}::uuid,'O196-FOREIGN',1,
      'Foreign','open')`;
  await deploy`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES
    (${TENANT}::uuid,${PROPERTY}::uuid,${businessDate}::date)`;
  await deploy`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr)
    VALUES(${CODE},'Order 196 room charge','revenue','Rooms','guest','revenue')`;
  await deploy`INSERT INTO tx_code_route(
      tenant_id,property_node,currency,tx_code,credit_account_id
    ) VALUES(${TENANT}::uuid,${PROPERTY}::uuid,'USD',${CODE},${REVENUE}::uuid)`;
  await deploy.begin(async (tx) => {
    await tx`INSERT INTO journal(
        id,tenant_id,property_node,business_date,kind,description,currency,source,created_by
      ) VALUES(
        ${NONZERO_JOURNAL}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${businessDate}::date,
        'charge','Order 196 non-zero balance','USD','{"interface":"order196-proof"}'::jsonb,
        ${ACTOR}::uuid
      )`;
    await tx`INSERT INTO posting_line(
        id,tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,
        amount_minor,quantity,business_date
      ) VALUES
      (${NONZERO_GUEST_LINE}::uuid,${TENANT}::uuid,${NONZERO_JOURNAL}::uuid,1,
        ${GUEST}::uuid,${NONZERO}::uuid,${CODE},'Room charge',900,1.000,${businessDate}::date),
      (${NONZERO_REVENUE_LINE}::uuid,${TENANT}::uuid,${NONZERO_JOURNAL}::uuid,2,
        ${REVENUE}::uuid,NULL,${CODE},'Room revenue',-900,1.000,${businessDate}::date)`;
  });
}, 60_000);

afterAll(async () => {
  await cleanup();
  await database?.close();
  await runtime?.close({ timeout: 0 });
  await deploy?.close({ timeout: 0 });
}, 60_000);

describe("Order 196 governed folio settlement boundary", () => {
  test("exports the domain and keeps migration authority bounded", async () => {
    expect(typeof FolioSettlementService).toBe("function");
    const migration = await Bun.file(new URL(
      "../migrations/0023_folio_settlement_capability.sql",
      import.meta.url,
    )).text();
    expect(migration).toContain("CREATE FUNCTION public.transition_folio_status(");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.transition_folio_status");
    expect(migration).toContain("REVOKE UPDATE ON public.folio");
    expect(migration).not.toMatch(/GRANT\s+UPDATE\s+ON\s+(?:public\.)?folio/i);
    expect(migration).not.toMatch(/UPDATE\s+(?:public\.)?(?:journal|posting_line)/i);
  });
});

dbDescribe("Order 196 fresh-PostgreSQL settlement proof", () => {
  test("P3 capability ACL is exact and direct app-role mutation remains denied", async () => {
    const authority = await deploy!<Array<{
      signature: string;
      owner: string;
      security_definer: boolean;
      volatility: string;
      config: string[] | null;
      app_execute: boolean;
      runtime_execute: boolean;
      public_execute: boolean;
      app_update: boolean;
      runtime_update: boolean;
    }>>`
      SELECT p.oid::regprocedure::text AS signature,
        pg_get_userbyid(p.proowner) AS owner,
        p.prosecdef AS security_definer,
        p.provolatile::text AS volatility,
        p.proconfig AS config,
        has_function_privilege('app_role',p.oid,'EXECUTE') AS app_execute,
        has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS runtime_execute,
        has_function_privilege('public',p.oid,'EXECUTE') AS public_execute,
        has_table_privilege('app_role','public.folio','UPDATE') AS app_update,
        has_table_privilege('yellow_runtime','public.folio','UPDATE') AS runtime_update
      FROM pg_proc AS p
      WHERE p.oid='public.transition_folio_status(uuid,uuid,uuid,text)'::regprocedure
    `;
    expect(authority).toEqual([{
      signature: "transition_folio_status(uuid,uuid,uuid,text)",
      owner: "yellow_owner",
      security_definer: true,
      volatility: "v",
      config: ["search_path=pg_catalog, public, pg_temp"],
      app_execute: true,
      runtime_execute: false,
      public_execute: false,
      app_update: false,
      runtime_update: false,
    }]);

    expect(await captureSqlState(() => deploy!.unsafe(
      "SELECT * FROM public.transition_folio_status($1::uuid,$2::uuid,$3::uuid,$4)",
      [TENANT, PROPERTY, WRONG_OPEN, "settle"],
    ))).toBe("42501");
    expect(await captureSqlState(() => runtime!.unsafe(
      "SELECT * FROM public.transition_folio_status($1::uuid,$2::uuid,$3::uuid,$4)",
      [TENANT, PROPERTY, WRONG_OPEN, "settle"],
    ))).toBe("42501");
    expect(await captureSqlState(() => database!.withTenantTransaction(TENANT, (tx) => tx`
      UPDATE folio SET status='settled'
      WHERE tenant_id=${TENANT}::uuid AND id=${WRONG_OPEN}::uuid
    `))).toBe("42501");
    expect((await deploy!<Array<{ status: string }>>`
      SELECT status FROM folio WHERE id=${WRONG_OPEN}::uuid
    `)[0]!.status).toBe("open");
  }, 30_000);

  test("P1 zero balance moves open to settled to closed with exact replay and no ledger mutation", async () => {
    const ledgerBefore = await financialSnapshot();
    const settleRequest = request("settle", ZERO, "order196-zero-settle");
    const settled = await settlements!.settle(settleRequest);
    expect(settled).toEqual({
      folioId: ZERO,
      accountId: GUEST,
      reservationId: null,
      windowNo: 1,
      previousStatus: "open",
      status: "settled",
      balanceMinor: "0",
      replayed: false,
    });
    expect(await settlements!.settle(settleRequest)).toEqual({ ...settled, replayed: true });

    const closeRequest = request("close", ZERO, "order196-zero-close");
    const closed = await settlements!.close(closeRequest);
    expect(closed).toEqual({
      folioId: ZERO,
      accountId: GUEST,
      reservationId: null,
      windowNo: 1,
      previousStatus: "settled",
      status: "closed",
      balanceMinor: "0",
      replayed: false,
    });
    expect(await settlements!.close(closeRequest)).toEqual({ ...closed, replayed: true });
    await expect(settlements!.close({
      ...closeRequest,
      folioId: WRONG_SETTLED,
      envelope: createAuditEnvelope({
        operation: "folio.closed",
        tenantId: TENANT,
        propertyNode: PROPERTY,
        actorId: ACTOR,
        requestId: crypto.randomUUID(),
      }),
    })).rejects.toBeInstanceOf(IdempotencyConflictError);

    expect(await evidence(ZERO)).toEqual({ status: "closed", facts: 2, events: 2 });
    expect(await financialSnapshot()).toEqual(ledgerBefore);
  }, 30_000);

  test("P1/P3 non-zero, wrong-state, frozen-account and foreign targets fail without artifacts", async () => {
    const ledgerBefore = await financialSnapshot();
    const evidenceBefore = await deploy!`
      SELECT
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid) AS events
    `;

    await expect(settlements!.settle(request(
      "settle",
      NONZERO,
      "order196-reject-nonzero",
    ))).rejects.toBeInstanceOf(FolioSettlementConflictError);
    await expect(settlements!.close(request(
      "close",
      WRONG_OPEN,
      "order196-reject-open-close",
    ))).rejects.toBeInstanceOf(FolioSettlementConflictError);
    await expect(settlements!.settle(request(
      "settle",
      WRONG_SETTLED,
      "order196-reject-settled-settle",
    ))).rejects.toBeInstanceOf(FolioSettlementConflictError);
    await expect(settlements!.settle(request(
      "settle",
      FROZEN,
      "order196-reject-frozen",
    ))).rejects.toBeInstanceOf(FolioSettlementConflictError);
    await expect(settlements!.settle(request(
      "settle",
      FOREIGN,
      "order196-reject-foreign",
    ))).rejects.toBeInstanceOf(FolioSettlementNotFoundError);

    const states = await deploy!<Array<{ id: string; status: string }>>`
      SELECT id,status FROM folio
      WHERE id IN (
        ${NONZERO}::uuid,${WRONG_OPEN}::uuid,${WRONG_SETTLED}::uuid,
        ${FROZEN}::uuid,${FOREIGN}::uuid
      ) ORDER BY id
    `;
    expect(Object.fromEntries(states.map(({ id, status }) => [id, status]))).toEqual({
      [NONZERO]: "open",
      [WRONG_OPEN]: "open",
      [WRONG_SETTLED]: "settled",
      [FROZEN]: "open",
      [FOREIGN]: "open",
    });
    expect(await financialSnapshot()).toEqual(ledgerBefore);
    expect(await deploy!`
      SELECT
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid) AS events
    `).toEqual(evidenceBefore);

    const isolated = await database!.withTenantTransaction(TENANT, async (tx) => {
      const folios = await tx<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM folio
        WHERE tenant_id=${FOREIGN_TENANT}::uuid OR id=${FOREIGN}::uuid
      `;
      const accounts = await tx<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM account
        WHERE tenant_id=${FOREIGN_TENANT}::uuid OR id=${FOREIGN_GUEST}::uuid
      `;
      return { folios: folios[0]!.n, accounts: accounts[0]!.n };
    });
    expect(isolated).toEqual({ folios: 0, accounts: 0 });
  }, 30_000);

  test("P2 twenty same-command contenders converge to one transition and one evidence pair", async () => {
    const ledgerBefore = await financialSnapshot();
    const raceRequest = request("settle", RACE, "order196-twenty-converge");
    const outcomes = await Promise.all(
      Array.from({ length: 20 }, () => settlements!.settle(raceRequest)),
    );
    expect(outcomes).toHaveLength(20);
    expect(outcomes.every((outcome) => outcome.folioId === RACE &&
      outcome.status === "settled" && outcome.balanceMinor === "0")).toBeTrue();
    expect(outcomes.filter(({ replayed }) => replayed === false)).toHaveLength(1);
    expect(outcomes.filter(({ replayed }) => replayed === true)).toHaveLength(19);
    expect(await evidence(RACE)).toEqual({ status: "settled", facts: 1, events: 1 });
    expect((await deploy!<Array<{ keys: number }>>`
      SELECT count(*)::int AS keys FROM api_idempotency
      WHERE tenant_id=${TENANT}::uuid
        AND operation='financials.folio.settle'
        AND response_body @> ${JSON.stringify({ folioId: RACE })}::jsonb
    `)[0]!.keys).toBe(1);
    expect(await financialSnapshot()).toEqual(ledgerBefore);
  }, 60_000);

  test("P2 charge versus settle has one coherent winner under the shared financial lock", async () => {
    const settleRequest = request("settle", ARBITRATION, "order196-arbitrate-settle");
    const chargeRequest = Object.freeze({
      tenantId: TENANT,
      folioId: ARBITRATION,
      txCode: CODE,
      amountMinor: "700",
      quantity: "1.000",
      idempotencyKey: "order196-arbitrate-charge",
      envelope: createAuditEnvelope({
        operation: "journal.posted",
        tenantId: TENANT,
        propertyNode: PROPERTY,
        actorId: ACTOR,
        requestId: crypto.randomUUID(),
      }),
    });

    const [settleOutcome, chargeOutcome] = await Promise.allSettled([
      settlements!.settle(settleRequest),
      database!.withTenantTransaction(TENANT, (tx) => charges!.postCharge(tx, chargeRequest)),
    ]);
    expect([settleOutcome, chargeOutcome].filter(({ status }) => status === "fulfilled"))
      .toHaveLength(1);
    expect([settleOutcome, chargeOutcome].filter(({ status }) => status === "rejected"))
      .toHaveLength(1);

    const state = (await deploy!<Array<{
      status: string;
      balance_minor: string;
      guest_lines: number;
      charge_journals: number;
      all_charge_lines: number;
      unbalanced_journals: number;
      settlement_facts: number;
      settlement_events: number;
      charge_facts: number;
      charge_events: number;
      durable_keys: number;
    }>>`
      WITH charge_journals AS MATERIALIZED (
        SELECT DISTINCT posting_line.journal_id
        FROM posting_line
        WHERE posting_line.tenant_id=${TENANT}::uuid
          AND posting_line.folio_id=${ARBITRATION}::uuid
      )
      SELECT folio.status,
        COALESCE(balance.balance_minor,0)::text AS balance_minor,
        (SELECT count(*)::int FROM posting_line
          WHERE tenant_id=${TENANT}::uuid AND folio_id=${ARBITRATION}::uuid) AS guest_lines,
        (SELECT count(*)::int FROM charge_journals) AS charge_journals,
        (SELECT count(*)::int FROM posting_line
          WHERE tenant_id=${TENANT}::uuid
            AND journal_id IN (SELECT journal_id FROM charge_journals)) AS all_charge_lines,
        (SELECT count(*)::int FROM (
          SELECT journal_id FROM posting_line
          WHERE tenant_id=${TENANT}::uuid
            AND journal_id IN (SELECT journal_id FROM charge_journals)
          GROUP BY journal_id HAVING sum(amount_minor)<>0
        ) AS unbalanced) AS unbalanced_journals,
        (SELECT count(*)::int FROM fact_log
          WHERE tenant_id=${TENANT}::uuid AND entity_id=${ARBITRATION}::uuid
            AND fact_type='folio.settled') AS settlement_facts,
        (SELECT count(*)::int FROM outbox
          WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${ARBITRATION}::uuid
            AND event_type='folio.settled') AS settlement_events,
        (SELECT count(*)::int FROM fact_log
          WHERE tenant_id=${TENANT}::uuid AND entity_id IN (
            SELECT journal_id FROM charge_journals
          ) AND fact_type='journal.posted') AS charge_facts,
        (SELECT count(*)::int FROM outbox
          WHERE tenant_id=${TENANT}::uuid AND aggregate_id IN (
            SELECT journal_id FROM charge_journals
          ) AND event_type='journal.posted') AS charge_events,
        (SELECT count(*)::int FROM api_idempotency
          WHERE tenant_id=${TENANT}::uuid
            AND operation IN ('financials.folio.settle','financials.charge.post')
            AND response_body @> ${JSON.stringify({ folioId: ARBITRATION })}::jsonb) AS durable_keys
      FROM folio
      LEFT JOIN folio_balance AS balance
        ON balance.tenant_id=folio.tenant_id AND balance.folio_id=folio.id
      WHERE folio.tenant_id=${TENANT}::uuid AND folio.id=${ARBITRATION}::uuid
    `)[0]!;

    if (settleOutcome.status === "fulfilled") {
      expect(settleOutcome.value).toMatchObject({ status: "settled", balanceMinor: "0" });
      expect(chargeOutcome.status).toBe("rejected");
      if (chargeOutcome.status === "rejected") {
        expect(chargeOutcome.reason).toBeInstanceOf(ChargeConflictError);
      }
      expect(state).toEqual({
        status: "settled",
        balance_minor: "0",
        guest_lines: 0,
        charge_journals: 0,
        all_charge_lines: 0,
        unbalanced_journals: 0,
        settlement_facts: 1,
        settlement_events: 1,
        charge_facts: 0,
        charge_events: 0,
        durable_keys: 1,
      });
    } else {
      expect(settleOutcome.reason).toBeInstanceOf(FolioSettlementConflictError);
      expect(chargeOutcome.status).toBe("fulfilled");
      if (chargeOutcome.status === "fulfilled") {
        expect(chargeOutcome.value).toMatchObject({
          folioId: ARBITRATION,
          amountMinor: "700",
          replayed: false,
        });
      }
      expect(state).toEqual({
        status: "open",
        balance_minor: "700",
        guest_lines: 1,
        charge_journals: 1,
        all_charge_lines: 2,
        unbalanced_journals: 0,
        settlement_facts: 0,
        settlement_events: 0,
        charge_facts: 1,
        charge_events: 1,
        durable_keys: 1,
      });
    }
  }, 60_000);
});
