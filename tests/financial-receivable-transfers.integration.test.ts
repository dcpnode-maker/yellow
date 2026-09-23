import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
  ReceivableConflictError,
  ReceivableService,
  ReceivableValidationError,
} from "../src/contexts/financials";
import {
  ApprovalService,
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
} from "../src/kernel";
import type { EventBus } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000019801";
const PROPERTY = "00000000-0000-0000-0000-000000019811";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000019812";
const ACTOR = "00000000-0000-0000-0000-000000019821";
const APPROVER = "00000000-0000-0000-0000-000000019822";
const COMPANY = "00000000-0000-0000-0000-000000019831";
const AGENT = "00000000-0000-0000-0000-000000019832";
const UNAUTHORIZED_PARTY = "00000000-0000-0000-0000-000000019833";
const REVENUE = "00000000-0000-0000-0000-000000019841";
const GUEST_WITHIN = "00000000-0000-0000-0000-000000019842";
const GUEST_OVER = "00000000-0000-0000-0000-000000019843";
const GUEST_RACE_A = "00000000-0000-0000-0000-000000019844";
const GUEST_RACE_B = "00000000-0000-0000-0000-000000019845";
const GUEST_ZERO = "00000000-0000-0000-0000-000000019846";
const GUEST_NEGATIVE = "00000000-0000-0000-0000-000000019847";
const RECEIVABLE_WITHIN = "00000000-0000-0000-0000-000000019851";
const RECEIVABLE_OVER = "00000000-0000-0000-0000-000000019852";
const RECEIVABLE_RACE = "00000000-0000-0000-0000-000000019853";
const RECEIVABLE_NULL = "00000000-0000-0000-0000-000000019854";
const RECEIVABLE_FROZEN = "00000000-0000-0000-0000-000000019855";
const RECEIVABLE_GENERIC = "00000000-0000-0000-0000-000000019856";
const RECEIVABLE_UNAUTHORIZED = "00000000-0000-0000-0000-000000019857";
const RECEIVABLE_FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000019858";
const RECEIVABLE_FOREIGN_CURRENCY = "00000000-0000-0000-0000-000000019859";
const FOLIO_WITHIN = "00000000-0000-0000-0000-000000019861";
const FOLIO_OVER = "00000000-0000-0000-0000-000000019862";
const FOLIO_RACE_A = "00000000-0000-0000-0000-000000019863";
const FOLIO_RACE_B = "00000000-0000-0000-0000-000000019864";
const FOLIO_ZERO = "00000000-0000-0000-0000-000000019865";
const FOLIO_NEGATIVE = "00000000-0000-0000-0000-000000019866";
const STALE_APPROVAL = "00000000-0000-0000-0000-000000019871";
const SELF_APPROVAL = "00000000-0000-0000-0000-000000019872";
const EXACT_APPROVAL = "00000000-0000-0000-0000-000000019873";

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_FINANCIAL_RECEIVABLE_URL
  ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_FINANCIAL_RECEIVABLE === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_FINANCIAL_RECEIVABLE_URL (or YELLOW_RUNTIME_DATABASE_URL) are required");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const BOUNDARY_REQUEST = "00000000-0000-0000-0000-000000019891";
const boundaryService = new ReceivableService({
  database: {
    withTenantTransaction: async () => { throw new Error("domain input reached database"); },
  } as unknown as Database,
  events: undefined as unknown as EventBus,
  idempotency: undefined as unknown as PostgresIdempotency,
});

function envelope(operation: string) {
  return {
    actorId: ACTOR, tenantId: TENANT, propertyNode: PROPERTY,
    requestId: BOUNDARY_REQUEST, operation,
  };
}

describe("Order 198 ReceivableService domain boundaries", () => {
  test("accepts only exact server-owned preview and target-list input shapes", async () => {
    await expect(boundaryService.preview({
      tenantId: TENANT, propertyNode: PROPERTY, folioId: FOLIO_WITHIN,
      receivableAccountId: RECEIVABLE_WITHIN, amountMinor: "4000",
    } as never)).rejects.toBeInstanceOf(ReceivableValidationError);
    await expect(boundaryService.listTargets({ tenantId: TENANT, propertyNode: PROPERTY, actorId: ACTOR } as never))
      .rejects.toBeInstanceOf(ReceivableValidationError);
    await expect(boundaryService.listTargets({ tenantId: TENANT, propertyNode: PROPERTY }))
      .rejects.toThrow("domain input reached database");
  });

  test("rejects client approval evidence, malformed envelope, and noncanonical transfer reasons", async () => {
    await expect(boundaryService.requestOverLimitApproval({
      tenantId: TENANT, folioId: FOLIO_OVER, receivableAccountId: RECEIVABLE_OVER,
      idempotencyKey: "request-198", envelope: envelope("approval.requested"),
      amountMinor: "8000",
    } as never)).rejects.toBeInstanceOf(ReceivableValidationError);
    await expect(boundaryService.approveOverLimit({
      tenantId: TENANT, folioId: FOLIO_OVER, approvalId: EXACT_APPROVAL,
      idempotencyKey: "approve-198", envelope: envelope("journal.posted"),
    })).rejects.toBeInstanceOf(ReceivableValidationError);
    await expect(boundaryService.transfer({
      tenantId: TENANT, folioId: FOLIO_WITHIN, receivableAccountId: RECEIVABLE_WITHIN,
      reason: "direct\u200bbilling", idempotencyKey: "transfer-198", envelope: envelope("journal.posted"),
    })).rejects.toBeInstanceOf(ReceivableValidationError);
  });

  test("allows an omitted approval only through the server-authoritative transfer path", async () => {
    await expect(boundaryService.transfer({
      tenantId: TENANT, folioId: FOLIO_WITHIN, receivableAccountId: RECEIVABLE_WITHIN,
      reason: "Within limit direct billing", idempotencyKey: "transfer-198-omitted",
      envelope: envelope("journal.posted"),
    })).rejects.toThrow("domain input reached database");
  });
});

interface TransferRow {
  journal_id: string;
  business_date: Date | string;
  currency: string;
  folio_id: string;
  guest_account_id: string;
  receivable_account_id: string;
  receivable_party_id: string;
  receivable_party_role: string;
  amount_minor: string | bigint;
  exposure_before_minor: string | bigint;
  credit_limit_minor: string | bigint;
  projected_exposure_minor: string | bigint;
  approval_request_id: string | null;
}

let deploy: SQL | undefined;
let runtime: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let receivables: ReceivableService | undefined;
let businessDate = "";

function commandEnvelope(
  operation: "approval.requested" | "approval.decided" | "journal.posted",
  actorId = ACTOR,
) {
  return createAuditEnvelope({
    operation, tenantId: TENANT, propertyNode: PROPERTY, actorId, requestId: crypto.randomUUID(),
  });
}

function errorState(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { errno?: unknown; code?: unknown };
  if (typeof candidate.errno === "string") return candidate.errno;
  return typeof candidate.code === "string" ? candidate.code : undefined;
}

async function expectState(operation: () => Promise<unknown>, expected: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    expect(errorState(error)).toBe(expected);
    return;
  }
  throw new Error(`Expected SQLSTATE ${expected}`);
}

async function withAppRole<T>(operation: (tx: SQL) => Promise<T>): Promise<T> {
  return runtime!.begin(async (tx) => {
    await tx`SELECT set_config('app.tenant_id', ${TENANT}, true)`;
    await tx.unsafe("SET LOCAL ROLE app_role");
    return operation(tx);
  });
}

async function transfer(
  folioId: string,
  receivableAccountId: string,
  approvalId: string | null = null,
  reason = "Direct billing transfer",
): Promise<TransferRow> {
  return withAppRole(async (tx) => {
    const rows = await tx<TransferRow[]>`
      SELECT * FROM public.create_receivable_transfer(
        ${TENANT}::uuid, ${PROPERTY}::uuid, ${folioId}::uuid,
        ${receivableAccountId}::uuid, ${ACTOR}::uuid, ${approvalId}::uuid, ${reason}
      )
    `;
    const row = rows[0];
    if (!row) throw new Error("receivable capability returned no row");
    return row;
  });
}

async function addBalance(folioId: string, guestAccountId: string, amount: bigint): Promise<void> {
  await deploy!.begin(async (tx) => {
    const headers = await tx<Array<{ id: string }>>`
      INSERT INTO public.journal (
        tenant_id, property_node, business_date, kind, description,
        currency, source, created_by
      ) VALUES (
        ${TENANT}::uuid, ${PROPERTY}::uuid, ${businessDate}::date, 'charge',
        'Order 198 opening balance', 'USD', '{"interface":"order198.fixture"}'::jsonb,
        ${ACTOR}::uuid
      ) RETURNING id
    `;
    const journalId = headers[0]!.id;
    await tx`
      INSERT INTO public.posting_line (
        tenant_id, journal_id, seq, account_id, folio_id, tx_code,
        description, amount_minor, quantity, business_date, currency
      ) VALUES
        (${TENANT}::uuid, ${journalId}::uuid, 1, ${guestAccountId}::uuid,
         ${folioId}::uuid, 'ORDER198_CHARGE', 'Order 198 opening balance',
         ${amount}, 1, ${businessDate}::date, 'USD'),
        (${TENANT}::uuid, ${journalId}::uuid, 2, ${REVENUE}::uuid,
         NULL, 'ORDER198_CHARGE', 'Order 198 opening balance',
         ${-amount}, 1, ${businessDate}::date, 'USD')
    `;
  });
}

function approvalPayload(
  partyId: string,
  accountId: string,
  folioId: string,
  amount: string,
  exposureBefore: string,
  limit: string,
  projected: string,
): string {
  return JSON.stringify({
    partyId, accountId, folioId, amountMinor: amount,
    exposureBeforeMinor: exposureBefore, creditLimitMinor: limit,
    projectedExposureMinor: projected,
  });
}

async function insertApproval(
  id: string,
  payload: string,
  decidedBy = APPROVER,
): Promise<void> {
  await deploy!`
    INSERT INTO public.approval_request (
      id, tenant_id, kind, subject_type, subject_id, requested_by,
      payload, status, decided_by, decided_at
    ) VALUES (
      ${id}::uuid, ${TENANT}::uuid, 'receivable_transfer_over_limit',
      'folio', ${FOLIO_OVER}::uuid, ${ACTOR}::uuid,
      ${payload}::jsonb, 'approved', ${decidedBy}::uuid, transaction_timestamp()
    )
  `;
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await deploy.begin(async (tx) => {
    await tx.unsafe("SET CONSTRAINTS ALL DEFERRED");
    for (const table of [
      "api_idempotency", "outbox", "fact_log",
      "ar_allocation", "posting_line", "payment", "journal", "approval_request",
      "folio", "account", "party_role", "party", "business_day", "app_user", "org_node",
    ]) {
      await tx.unsafe(`DELETE FROM public.${table} WHERE tenant_id=$1::uuid`, [TENANT]);
    }
  });
  await deploy`DELETE FROM public.tenant WHERE id=${TENANT}::uuid`;
  await deploy`DELETE FROM public.tx_code WHERE code='ORDER198_CHARGE'`;
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 12, prepare: false });
  runtime = new SQL(RUNTIME_URL, { max: 12, prepare: false });
  eventPool = new SQL(RUNTIME_URL, { max: 12, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 12, prepare: false });
  const events = new PostgresEventBus(eventPool);
  receivables = new ReceivableService({
    database, events, idempotency: new PostgresIdempotency(), approvals: new ApprovalService(events),
  });
  await cleanup();
  businessDate = (await deploy<Array<{ value: string }>>`
    SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS value
  `)[0]!.value;

  await deploy`INSERT INTO public.tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order198','Order 198','shared','active')`;
  await deploy`INSERT INTO public.org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order198','property','Order 198','UTC','USD'),
    (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order198.other','property','Order 198 Other','UTC','USD')`;
  await deploy`INSERT INTO public.app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR}::uuid,${TENANT}::uuid,'maker@order198.test','Maker','active'),
    (${APPROVER}::uuid,${TENANT}::uuid,'checker@order198.test','Checker','active')`;
  await deploy`INSERT INTO public.party(id,tenant_id,kind,display_name,status) VALUES
    (${COMPANY}::uuid,${TENANT}::uuid,'org','Order 198 Company','active'),
    (${AGENT}::uuid,${TENANT}::uuid,'org','Order 198 Agent','active'),
    (${UNAUTHORIZED_PARTY}::uuid,${TENANT}::uuid,'org','Order 198 Other','active')`;
  await deploy`INSERT INTO public.party_role(tenant_id,party_id,role) VALUES
    (${TENANT}::uuid,${COMPANY}::uuid,'company'),
    (${TENANT}::uuid,${AGENT}::uuid,'agent')`;
  await deploy`INSERT INTO public.tx_code(code,name,grp,usali_line,default_dr,default_cr) VALUES
    ('ORDER198_CHARGE','Order 198 charge','revenue','Rooms','guest','revenue')`;
  await deploy`INSERT INTO public.account(
      id,tenant_id,property_node,role,party_id,name,currency,credit_limit_minor,status
    ) VALUES
    (${REVENUE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'revenue',NULL,'Revenue','USD',NULL,'open'),
    (${GUEST_WITHIN}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',NULL,'Guest within','USD',NULL,'open'),
    (${GUEST_OVER}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',NULL,'Guest over','USD',NULL,'open'),
    (${GUEST_RACE_A}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',NULL,'Guest race A','USD',NULL,'open'),
    (${GUEST_RACE_B}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',NULL,'Guest race B','USD',NULL,'open'),
    (${GUEST_ZERO}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',NULL,'Guest zero','USD',NULL,'open'),
    (${GUEST_NEGATIVE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',NULL,'Guest credit','USD',NULL,'open'),
    (${RECEIVABLE_WITHIN}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'company',${COMPANY}::uuid,'Company within','USD',10000,'open'),
    (${RECEIVABLE_OVER}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'company',${AGENT}::uuid,'Agent over','USD',5000,'open'),
    (${RECEIVABLE_RACE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'company',${COMPANY}::uuid,'Company race','USD',10000,'open'),
    (${RECEIVABLE_NULL}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'company',${COMPANY}::uuid,'Company null','USD',NULL,'open'),
    (${RECEIVABLE_FROZEN}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'company',${COMPANY}::uuid,'Company frozen','USD',10000,'frozen'),
    (${RECEIVABLE_GENERIC}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'ar_control',NULL,'Generic AR','USD',10000,'open'),
    (${RECEIVABLE_UNAUTHORIZED}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'company',${UNAUTHORIZED_PARTY}::uuid,'Unauthorized','USD',10000,'open'),
    (${RECEIVABLE_FOREIGN_PROPERTY}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'company',${COMPANY}::uuid,'Other property','USD',10000,'open'),
    (${RECEIVABLE_FOREIGN_CURRENCY}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'company',${COMPANY}::uuid,'Other currency','EUR',10000,'open')`;
  await deploy`INSERT INTO public.folio(id,tenant_id,account_id,folio_no,window_no,name,status) VALUES
    (${FOLIO_WITHIN}::uuid,${TENANT}::uuid,${GUEST_WITHIN}::uuid,'R198-1',1,'Within','open'),
    (${FOLIO_OVER}::uuid,${TENANT}::uuid,${GUEST_OVER}::uuid,'R198-2',1,'Over','open'),
    (${FOLIO_RACE_A}::uuid,${TENANT}::uuid,${GUEST_RACE_A}::uuid,'R198-3',1,'Race A','open'),
    (${FOLIO_RACE_B}::uuid,${TENANT}::uuid,${GUEST_RACE_B}::uuid,'R198-4',1,'Race B','open'),
    (${FOLIO_ZERO}::uuid,${TENANT}::uuid,${GUEST_ZERO}::uuid,'R198-5',1,'Zero','open')`;
  await deploy`INSERT INTO public.folio(id,tenant_id,account_id,folio_no,window_no,name,status) VALUES
    (${FOLIO_NEGATIVE}::uuid,${TENANT}::uuid,${GUEST_NEGATIVE}::uuid,'R198-6',1,'Credit','open')`;
  await deploy`INSERT INTO public.business_day(tenant_id,property_node,business_date) VALUES
    (${TENANT}::uuid,${PROPERTY}::uuid,${businessDate}::date),
    (${TENANT}::uuid,${OTHER_PROPERTY}::uuid,${businessDate}::date)`;
  await addBalance(FOLIO_WITHIN, GUEST_WITHIN, 4000n);
  await addBalance(FOLIO_OVER, GUEST_OVER, 8000n);
  await addBalance(FOLIO_RACE_A, GUEST_RACE_A, 6000n);
  await addBalance(FOLIO_RACE_B, GUEST_RACE_B, 6000n);
  await addBalance(FOLIO_NEGATIVE, GUEST_NEGATIVE, -500n);
}, 30_000);

afterAll(async () => {
  await cleanup();
  await database?.close();
  await eventPool?.close({ timeout: 0 });
  await runtime?.close({ timeout: 0 });
  await deploy?.close({ timeout: 0 });
}, 60_000);

databaseDescribe("Order 198 fresh-PostgreSQL receivable transfer proof", () => {
  test("P1 exposes only exact app-role capability and denies raw approval lineage", async () => {
    const authority = await deploy!<Array<{
      owner: string; appExecute: boolean; runtimeExecute: boolean; publicExecute: boolean;
      insertApproval: boolean; updateApproval: boolean;
    }>>`
      SELECT pg_get_userbyid(procedure.proowner) AS owner,
             has_function_privilege('app_role',procedure.oid,'EXECUTE') AS "appExecute",
             has_function_privilege('yellow_runtime',procedure.oid,'EXECUTE') AS "runtimeExecute",
             has_function_privilege('public',procedure.oid,'EXECUTE') AS "publicExecute",
             has_column_privilege('app_role','public.journal','approval_request_id','INSERT') AS "insertApproval",
             has_column_privilege('app_role','public.journal','approval_request_id','UPDATE') AS "updateApproval"
        FROM pg_proc AS procedure
       WHERE procedure.oid =
         'public.create_receivable_transfer(uuid,uuid,uuid,uuid,uuid,uuid,text)'::regprocedure
    `;
    expect(authority).toEqual([{
      owner: "yellow_owner", appExecute: true, runtimeExecute: false, publicExecute: false,
      insertApproval: false, updateApproval: false,
    }]);
    await expectState(() => runtime!`
      SELECT * FROM public.create_receivable_transfer(
        ${TENANT}::uuid,${PROPERTY}::uuid,${FOLIO_WITHIN}::uuid,
        ${RECEIVABLE_WITHIN}::uuid,${ACTOR}::uuid,NULL,'raw runtime login'
      )
    `, "42501");
    await expectState(() => withAppRole((tx) => tx.unsafe(
      "UPDATE public.journal SET approval_request_id=NULL WHERE false",
    )), "42501");
    await expectState(() => runtime!.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000019899', true)`;
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx`SELECT * FROM public.create_receivable_transfer(
        ${TENANT}::uuid,${PROPERTY}::uuid,${FOLIO_WITHIN}::uuid,
        ${RECEIVABLE_WITHIN}::uuid,${ACTOR}::uuid,NULL,'cross tenant'
      )`;
    }), "42501");
  });

  test("P2 moves one exact positive balance, increases exposure, and permits zero settlement", async () => {
    const before = (await deploy!<Array<{
      payments: number; documents: number; allocations: number; cashier: number; sealed: number;
    }>>`
      SELECT
        (SELECT count(*)::int FROM payment WHERE tenant_id=${TENANT}::uuid) AS payments,
        (SELECT count(*)::int FROM document WHERE tenant_id=${TENANT}::uuid) AS documents,
        (SELECT count(*)::int FROM ar_allocation WHERE tenant_id=${TENANT}::uuid) AS allocations,
        (SELECT count(*)::int FROM cashier_session WHERE tenant_id=${TENANT}::uuid) AS cashier,
        (SELECT count(*)::int FROM business_day WHERE tenant_id=${TENANT}::uuid AND sealed_at IS NOT NULL) AS sealed
    `)[0]!;
    const result = await transfer(FOLIO_WITHIN, RECEIVABLE_WITHIN);
    expect({
      ...result,
      amount_minor: String(result.amount_minor),
      exposure_before_minor: String(result.exposure_before_minor),
      credit_limit_minor: String(result.credit_limit_minor),
      projected_exposure_minor: String(result.projected_exposure_minor),
    }).toMatchObject({
      currency: "USD", folio_id: FOLIO_WITHIN, guest_account_id: GUEST_WITHIN,
      receivable_account_id: RECEIVABLE_WITHIN, receivable_party_id: COMPANY,
      receivable_party_role: "company", amount_minor: "4000",
      exposure_before_minor: "0", credit_limit_minor: "10000",
      projected_exposure_minor: "4000", approval_request_id: null,
    });
    const truth = (await deploy!<Array<{
      kind: string; source: unknown; lineCount: number; total: string | bigint;
      guestAmount: string | bigint; receivableAmount: string | bigint;
      folioBalance: string | bigint; exposure: string | bigint;
    }>>`
      SELECT journal.kind, journal.source,
             count(line.id)::int AS "lineCount", sum(line.amount_minor)::text AS total,
             sum(line.amount_minor) FILTER (WHERE line.folio_id=${FOLIO_WITHIN}::uuid)::text AS "guestAmount",
             sum(line.amount_minor) FILTER (WHERE line.account_id=${RECEIVABLE_WITHIN}::uuid)::text AS "receivableAmount",
             (SELECT balance_minor::text FROM folio_balance
               WHERE tenant_id=${TENANT}::uuid AND folio_id=${FOLIO_WITHIN}::uuid) AS "folioBalance",
             (SELECT sum(amount_minor)::text FROM posting_line
               WHERE tenant_id=${TENANT}::uuid AND account_id=${RECEIVABLE_WITHIN}::uuid) AS exposure
        FROM journal JOIN posting_line AS line
          ON line.tenant_id=journal.tenant_id AND line.journal_id=journal.id
       WHERE journal.tenant_id=${TENANT}::uuid AND journal.id=${result.journal_id}::uuid
       GROUP BY journal.id
    `)[0]!;
    expect(truth).toEqual({
      kind: "transfer", source: { interface: "financials.receivable.transfer" },
      lineCount: 2, total: "0", guestAmount: "-4000", receivableAmount: "4000",
      folioBalance: "0", exposure: "4000",
    });
    const settled = await withAppRole((tx) => tx<Array<{ status: string; balance_minor: string | bigint }>>`
      SELECT status, balance_minor FROM public.transition_folio_status(
        ${TENANT}::uuid,${PROPERTY}::uuid,${FOLIO_WITHIN}::uuid,'settle'
      )
    `);
    expect(settled.map((row) => ({ ...row, balance_minor: String(row.balance_minor) })))
      .toEqual([{ status: "settled", balance_minor: "0" }]);
    const after = (await deploy!<Array<typeof before>>`
      SELECT
        (SELECT count(*)::int FROM payment WHERE tenant_id=${TENANT}::uuid) AS payments,
        (SELECT count(*)::int FROM document WHERE tenant_id=${TENANT}::uuid) AS documents,
        (SELECT count(*)::int FROM ar_allocation WHERE tenant_id=${TENANT}::uuid) AS allocations,
        (SELECT count(*)::int FROM cashier_session WHERE tenant_id=${TENANT}::uuid) AS cashier,
        (SELECT count(*)::int FROM business_day WHERE tenant_id=${TENANT}::uuid AND sealed_at IS NOT NULL) AS sealed
    `)[0]!;
    expect(after).toEqual(before);
  });

  test("P3 rejects ineligible targets, zero balance, stale and self approvals", async () => {
    for (const target of [
      RECEIVABLE_NULL, RECEIVABLE_FROZEN, RECEIVABLE_GENERIC,
      RECEIVABLE_UNAUTHORIZED, RECEIVABLE_FOREIGN_PROPERTY, RECEIVABLE_FOREIGN_CURRENCY,
    ]) {
      await expectState(() => transfer(FOLIO_OVER, target), "55000");
    }
    await expectState(() => transfer(FOLIO_ZERO, RECEIVABLE_WITHIN), "55000");
    await expectState(() => transfer(FOLIO_NEGATIVE, RECEIVABLE_WITHIN), "55000");
    await expectState(() => transfer(FOLIO_OVER, RECEIVABLE_OVER), "55000");

    await insertApproval(STALE_APPROVAL, approvalPayload(
      AGENT, RECEIVABLE_OVER, FOLIO_OVER, "8000", "1", "5000", "8001",
    ));
    await expectState(() => transfer(FOLIO_OVER, RECEIVABLE_OVER, STALE_APPROVAL), "55000");
    await insertApproval(SELF_APPROVAL, approvalPayload(
      AGENT, RECEIVABLE_OVER, FOLIO_OVER, "8000", "0", "5000", "8000",
    ), ACTOR);
    await expectState(() => transfer(FOLIO_OVER, RECEIVABLE_OVER, SELF_APPROVAL), "55000");
    expect((await deploy!<Array<{ journals: number }>>`
      SELECT count(*)::int AS journals FROM journal
       WHERE tenant_id=${TENANT}::uuid
         AND source='{"interface":"financials.receivable.transfer"}'::jsonb
         AND description <> 'Direct billing transfer'
    `)[0]).toEqual({ journals: 0 });
  });

  test("P3 exact different-user over-limit approval succeeds once with durable lineage", async () => {
    await insertApproval(EXACT_APPROVAL, approvalPayload(
      AGENT, RECEIVABLE_OVER, FOLIO_OVER, "8000", "0", "5000", "8000",
    ));
    const result = await transfer(FOLIO_OVER, RECEIVABLE_OVER, EXACT_APPROVAL, "Approved direct billing");
    expect({
      role: result.receivable_party_role,
      amount: String(result.amount_minor), exposure: String(result.exposure_before_minor),
      projected: String(result.projected_exposure_minor), approval: result.approval_request_id,
    }).toEqual({ role: "agent", amount: "8000", exposure: "0", projected: "8000", approval: EXACT_APPROVAL });
    expect((await deploy!<Array<{ approval: string; uses: number }>>`
      SELECT journal.approval_request_id AS approval,
             count(*) OVER (PARTITION BY journal.tenant_id,journal.approval_request_id)::int AS uses
        FROM journal
       WHERE tenant_id=${TENANT}::uuid AND id=${result.journal_id}::uuid
    `)[0]).toEqual({ approval: EXACT_APPROVAL, uses: 1 });
    await expectState(() => deploy!`
      INSERT INTO journal(
        tenant_id,property_node,business_date,kind,description,currency,source,created_by,approval_request_id
      ) VALUES (
        ${TENANT}::uuid,${PROPERTY}::uuid,${businessDate}::date,'transfer','reuse','USD',
        '{"interface":"financials.receivable.transfer"}'::jsonb,${ACTOR}::uuid,${EXACT_APPROVAL}::uuid
      )
    `, "23505");
  });

  test("P4 shared-limit concurrency admits exactly one transfer under current exposure", async () => {
    const outcomes = await Promise.allSettled([
      transfer(FOLIO_RACE_A, RECEIVABLE_RACE),
      transfer(FOLIO_RACE_B, RECEIVABLE_RACE),
    ]);
    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(errorState((outcomes.find(({ status }) => status === "rejected") as PromiseRejectedResult).reason))
      .toBe("55000");
    const truth = (await deploy!<Array<{
      exposure: string; zeroFolios: number; positiveFolios: number; transferJournals: number;
    }>>`
      SELECT
        (SELECT sum(amount_minor)::text FROM posting_line
          WHERE tenant_id=${TENANT}::uuid AND account_id=${RECEIVABLE_RACE}::uuid) AS exposure,
        (SELECT count(*)::int FROM folio_balance
          WHERE tenant_id=${TENANT}::uuid AND folio_id IN (${FOLIO_RACE_A}::uuid,${FOLIO_RACE_B}::uuid)
            AND balance_minor=0) AS "zeroFolios",
        (SELECT count(*)::int FROM folio_balance
          WHERE tenant_id=${TENANT}::uuid AND folio_id IN (${FOLIO_RACE_A}::uuid,${FOLIO_RACE_B}::uuid)
            AND balance_minor=6000) AS "positiveFolios",
        (SELECT count(*)::int FROM journal
          WHERE tenant_id=${TENANT}::uuid
            AND source='{"interface":"financials.receivable.transfer"}'::jsonb
            AND description='Direct billing transfer'
            AND id IN (SELECT journal_id FROM posting_line WHERE account_id=${RECEIVABLE_RACE}::uuid)) AS "transferJournals"
    `)[0]!;
    expect(truth).toEqual({ exposure: "6000", zeroFolios: 1, positiveFolios: 1, transferJournals: 1 });
  }, 30_000);
});

databaseDescribe("Order 198 ReceivableService transactional proof", () => {
  test("derives over-limit evidence once, replays every command, and records approval/journal facts and outbox", async () => {
    const remaining = (await deploy!<Array<{ folio_id: string }>>`
      SELECT folio_id
      FROM folio_balance
      WHERE tenant_id=${TENANT}::uuid
        AND folio_id IN (${FOLIO_RACE_A}::uuid,${FOLIO_RACE_B}::uuid)
        AND balance_minor=6000
    `)[0];
    expect(remaining).toBeDefined();
    const folioId = remaining!.folio_id;
    const request = {
      tenantId: TENANT, folioId, receivableAccountId: RECEIVABLE_RACE,
      idempotencyKey: "order198-service-approval-request",
      envelope: commandEnvelope("approval.requested"),
    } as const;
    const requested = await receivables!.requestOverLimitApproval(request);
    expect(requested).toMatchObject({
      status: "pending", replayed: false, folioId, partyId: COMPANY,
      receivableAccountId: RECEIVABLE_RACE, amountMinor: "6000",
      exposureMinor: "6000", creditLimitMinor: "10000", projectedExposureMinor: "12000",
    });
    expect((await receivables!.requestOverLimitApproval(request)).replayed).toBeTrue();

    const decision = {
      tenantId: TENANT, folioId, approvalId: requested.approvalId,
      idempotencyKey: "order198-service-approval-decide",
      envelope: commandEnvelope("approval.decided", APPROVER),
    } as const;
    const approved = await receivables!.approveOverLimit(decision);
    expect(approved).toMatchObject({ approvalId: requested.approvalId, status: "approved", replayed: false });
    expect((await receivables!.approveOverLimit(decision)).replayed).toBeTrue();

    const transferInput = {
      tenantId: TENANT, folioId, receivableAccountId: RECEIVABLE_RACE,
      approvalId: requested.approvalId, reason: "Service approved direct billing",
      idempotencyKey: "order198-service-transfer", envelope: commandEnvelope("journal.posted"),
    } as const;
    const transferred = await receivables!.transfer(transferInput);
    expect(transferred).toMatchObject({
      replayed: false, folioId, receivableAccountId: RECEIVABLE_RACE,
      approvalId: requested.approvalId, amountMinor: "6000", exposureMinor: "6000",
      projectedExposureMinor: "12000",
    });
    expect((await receivables!.transfer(transferInput)).replayed).toBeTrue();
    expect((await deploy!<Array<{ facts: number; events: number; approvalUses: number }>>`
      SELECT
        (SELECT count(*)::int FROM fact_log
          WHERE tenant_id=${TENANT}::uuid
            AND (entity_id=${requested.approvalId}::uuid OR entity_id=${transferred.journalId}::uuid)) AS facts,
        (SELECT count(*)::int FROM outbox
          WHERE tenant_id=${TENANT}::uuid
            AND (aggregate_id=${requested.approvalId}::uuid OR aggregate_id=${transferred.journalId}::uuid)) AS events,
        (SELECT count(*)::int FROM journal
          WHERE tenant_id=${TENANT}::uuid AND approval_request_id=${requested.approvalId}::uuid) AS "approvalUses"
    `)[0]).toEqual({ facts: 3, events: 3, approvalUses: 1 });
  }, 60_000);

  test("reject replay is bounded and leaves its exact approval unusable", async () => {
    await addBalance(FOLIO_ZERO, GUEST_ZERO, 100n);
    const request = {
      tenantId: TENANT, folioId: FOLIO_ZERO, receivableAccountId: RECEIVABLE_RACE,
      idempotencyKey: "order198-service-reject-request", envelope: commandEnvelope("approval.requested"),
    } as const;
    const requested = await receivables!.requestOverLimitApproval(request);
    const decision = {
      tenantId: TENANT, folioId: FOLIO_ZERO, approvalId: requested.approvalId,
      idempotencyKey: "order198-service-reject-decision", envelope: commandEnvelope("approval.decided", APPROVER),
    } as const;
    expect((await receivables!.rejectOverLimit(decision)).status).toBe("rejected");
    expect((await receivables!.rejectOverLimit(decision)).replayed).toBeTrue();
    await expect(receivables!.transfer({
      tenantId: TENANT, folioId: FOLIO_ZERO, receivableAccountId: RECEIVABLE_RACE,
      approvalId: requested.approvalId, reason: "Rejected direct billing",
      idempotencyKey: "order198-service-rejected-transfer", envelope: commandEnvelope("journal.posted"),
    })).rejects.toBeInstanceOf(ReceivableConflictError);
  }, 60_000);
});
