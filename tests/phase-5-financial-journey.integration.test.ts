import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  ChargeNotFoundError,
  ChargeService,
  FolioService,
  FolioSettlementService,
  LocalPaymentProvider,
  PaymentService,
  ReceivableConflictError,
  ReceivableService,
  type PostChargeResult,
} from "../src/contexts/financials";
import {
  ApprovalService,
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
} from "../src/kernel";

const RUNTIME_URL = process.env.YELLOW_PHASE5_JOURNEY_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
const DEPLOY_URL = process.env.YELLOW_PHASE5_JOURNEY_ADMIN_URL ??
  process.env.YELLOW_DEPLOY_DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_PHASE5_JOURNEY === "1";

if (REQUIRE_DATABASE && (!RUNTIME_URL || !DEPLOY_URL)) {
  throw new Error(
    "YELLOW_PHASE5_JOURNEY_URL (or YELLOW_RUNTIME_DATABASE_URL) and " +
      "YELLOW_PHASE5_JOURNEY_ADMIN_URL (or YELLOW_DEPLOY_DATABASE_URL) are required by Order 199",
  );
}

const dbDescribe = RUNTIME_URL && DEPLOY_URL ? describe.serial : describe.skip;

export const JOURNEY = Object.freeze({
  tenantId: "00000000-0000-0000-0000-000000019901",
  foreignTenantId: "00000000-0000-0000-0000-000000019902",
  propertyNode: "00000000-0000-0000-0000-000000019911",
  foreignPropertyNode: "00000000-0000-0000-0000-000000019912",
  actorId: "00000000-0000-0000-0000-000000019921",
  approverId: "00000000-0000-0000-0000-000000019922",
  foreignActorId: "00000000-0000-0000-0000-000000019923",
  foreignApproverId: "00000000-0000-0000-0000-000000019924",
  guestPartyId: "00000000-0000-0000-0000-000000019931",
  companyPartyId: "00000000-0000-0000-0000-000000019932",
  agentPartyId: "00000000-0000-0000-0000-000000019933",
  reservationId: "00000000-0000-0000-0000-000000019941",
  revenueAccountId: "00000000-0000-0000-0000-000000019951",
  clearingAccountId: "00000000-0000-0000-0000-000000019952",
  withinReceivableAccountId: "00000000-0000-0000-0000-000000019953",
  overReceivableAccountId: "00000000-0000-0000-0000-000000019954",
  instrumentId: "00000000-0000-0000-0000-000000019961",
  foreignApprovalId: "00000000-0000-0000-0000-000000019971",
  forgedApprovalId: "00000000-0000-0000-0000-000000019972",
  roomTxCode: "O199ROOM",
  amountMinor: "12500",
  currency: "USD",
});

export interface JourneyFixture {
  readonly folioId: string;
  readonly guestAccountId: string;
  readonly businessDate: string;
}

interface LedgerSnapshot {
  readonly journals: unknown;
  readonly postingLines: unknown;
}

let deploy: SQL | undefined;
let runtime: SQL | undefined;
let database: Database | undefined;
let folios: FolioService | undefined;
let charges: ChargeService | undefined;
let payments: PaymentService | undefined;
let settlements: FolioSettlementService | undefined;
let receivables: ReceivableService | undefined;
let fixture: JourneyFixture | undefined;

export function journeyAudit(
  operation: string,
  actorId: string = JOURNEY.actorId,
  propertyNode: string = JOURNEY.propertyNode,
) {
  return createAuditEnvelope({
    operation,
    tenantId: JOURNEY.tenantId,
    propertyNode,
    actorId,
    requestId: crypto.randomUUID(),
  });
}

export async function cleanJourneyFixture(): Promise<void> {
  if (!deploy) return;
  for (const table of [
    "api_idempotency",
    "outbox",
    "fact_log",
    "ar_allocation",
    "payment",
    "provider_event_receipt",
    "payment_operation",
    "payment_instrument",
    "posting_line",
    "journal",
    "approval_request",
    "tx_code_route",
    "business_day",
    "folio",
    "account",
    "document_series",
    "reservation_guest",
    "reservation",
    "app_user",
    "party_role",
    "party",
    "org_node",
  ]) {
    await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [
      JOURNEY.tenantId,
      JOURNEY.foreignTenantId,
    ]);
  }
  await deploy`DELETE FROM tenant
    WHERE id IN (${JOURNEY.tenantId}::uuid,${JOURNEY.foreignTenantId}::uuid)`;
  await deploy`DELETE FROM tx_code WHERE code IN (${JOURNEY.roomTxCode},'CARD_PAYMENT')`;
}

export async function seedJourneyFixture(): Promise<JourneyFixture> {
  if (!deploy || !database || !folios) throw new Error("Order 199 database fixture is unavailable");
  const businessDate = (await deploy<Array<{ business_date: string }>>`
    SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS business_date
  `)[0]!.business_date;

  await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${JOURNEY.tenantId}::uuid,'order199','Order 199','shared','active'),
    (${JOURNEY.foreignTenantId}::uuid,'order199-foreign','Order 199 Foreign','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${JOURNEY.propertyNode}::uuid,${JOURNEY.tenantId}::uuid,'order199','property',
      'Order 199 Property','UTC',${JOURNEY.currency}::char(3)),
    (${JOURNEY.foreignPropertyNode}::uuid,${JOURNEY.foreignTenantId}::uuid,'order199_foreign','property',
      'Order 199 Foreign Property','UTC',${JOURNEY.currency}::char(3))`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${JOURNEY.actorId}::uuid,${JOURNEY.tenantId}::uuid,'operator@order199.test',
      'Order 199 Operator','active'),
    (${JOURNEY.approverId}::uuid,${JOURNEY.tenantId}::uuid,'approver@order199.test',
      'Order 199 Approver','active'),
    (${JOURNEY.foreignActorId}::uuid,${JOURNEY.foreignTenantId}::uuid,'operator@foreign.order199.test',
      'Order 199 Foreign Operator','active'),
    (${JOURNEY.foreignApproverId}::uuid,${JOURNEY.foreignTenantId}::uuid,'approver@foreign.order199.test',
      'Order 199 Foreign Approver','active')`;
  await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${JOURNEY.guestPartyId}::uuid,${JOURNEY.tenantId}::uuid,'person','Order 199 Guest','active'),
    (${JOURNEY.companyPartyId}::uuid,${JOURNEY.tenantId}::uuid,'org','Order 199 Company','active'),
    (${JOURNEY.agentPartyId}::uuid,${JOURNEY.tenantId}::uuid,'org','Order 199 Travel Agent','active')`;
  await deploy`INSERT INTO party_role(tenant_id,party_id,role) VALUES
    (${JOURNEY.tenantId}::uuid,${JOURNEY.guestPartyId}::uuid,'guest'),
    (${JOURNEY.tenantId}::uuid,${JOURNEY.companyPartyId}::uuid,'company'),
    (${JOURNEY.tenantId}::uuid,${JOURNEY.agentPartyId}::uuid,'agent')`;
  await deploy`INSERT INTO reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
    ) VALUES(
      ${JOURNEY.reservationId}::uuid,${JOURNEY.tenantId}::uuid,${JOURNEY.propertyNode}::uuid,
      'O199-1','in_house',${JOURNEY.guestPartyId}::uuid,'direct',${JOURNEY.currency}::char(3)
    )`;
  await deploy`INSERT INTO document_series(tenant_id,property_node,kind,prefix,next_no,fiscal) VALUES
    (${JOURNEY.tenantId}::uuid,${JOURNEY.propertyNode}::uuid,'folio','O199-',1,false)`;
  await deploy`INSERT INTO account(
      id,tenant_id,property_node,role,party_id,name,currency,credit_limit_minor,status
    ) VALUES
    (${JOURNEY.revenueAccountId}::uuid,${JOURNEY.tenantId}::uuid,${JOURNEY.propertyNode}::uuid,
      'revenue',NULL,'Order 199 Room Revenue',${JOURNEY.currency}::char(3),NULL,'open'),
    (${JOURNEY.clearingAccountId}::uuid,${JOURNEY.tenantId}::uuid,${JOURNEY.propertyNode}::uuid,
      'card_clearing',NULL,'Order 199 Card Clearing',${JOURNEY.currency}::char(3),NULL,'open'),
    (${JOURNEY.withinReceivableAccountId}::uuid,${JOURNEY.tenantId}::uuid,${JOURNEY.propertyNode}::uuid,
      'company',${JOURNEY.companyPartyId}::uuid,'Order 199 Company Receivable',
      ${JOURNEY.currency}::char(3),50000,'open'),
    (${JOURNEY.overReceivableAccountId}::uuid,${JOURNEY.tenantId}::uuid,${JOURNEY.propertyNode}::uuid,
      'company',${JOURNEY.agentPartyId}::uuid,'Order 199 Agent Receivable',
      ${JOURNEY.currency}::char(3),5000,'open')`;
  await deploy`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr) VALUES
    (${JOURNEY.roomTxCode},'Order 199 room charge','revenue','Rooms','guest','revenue'),
    ('CARD_PAYMENT','Order 199 card payment','payment',NULL,'card_clearing','guest')`;
  await deploy`INSERT INTO tx_code_route(
      tenant_id,property_node,currency,tx_code,debit_account_id,credit_account_id
    ) VALUES
    (${JOURNEY.tenantId}::uuid,${JOURNEY.propertyNode}::uuid,${JOURNEY.currency}::char(3),
      ${JOURNEY.roomTxCode},NULL,${JOURNEY.revenueAccountId}::uuid),
    (${JOURNEY.tenantId}::uuid,${JOURNEY.propertyNode}::uuid,${JOURNEY.currency}::char(3),
      'CARD_PAYMENT',${JOURNEY.clearingAccountId}::uuid,NULL)`;
  await deploy`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES
    (${JOURNEY.tenantId}::uuid,${JOURNEY.propertyNode}::uuid,${businessDate}::date)`;
  await deploy`INSERT INTO payment_instrument(
      id,tenant_id,party_id,kind,token,brand,last4,expiry,psp,status
    ) VALUES(
      ${JOURNEY.instrumentId}::uuid,${JOURNEY.tenantId}::uuid,${JOURNEY.guestPartyId}::uuid,
      'card_network_token','tok_order199_network_opaque','Test','0199','12/99','local','active'
    )`;

  const opened = await database.withTenantTransaction(JOURNEY.tenantId, (tx) =>
    folios!.openPrimary(tx, {
      tenantId: JOURNEY.tenantId,
      reservationId: JOURNEY.reservationId,
      idempotencyKey: "order199-open-primary",
      envelope: journeyAudit("folio.opened"),
    })
  );
  expect(opened).toMatchObject({
    reservationId: JOURNEY.reservationId,
    folioNo: "O199-1",
    windowNo: 1,
    changed: true,
    replayed: false,
  });
  return Object.freeze({
    folioId: opened.folioId,
    guestAccountId: opened.accountId,
    businessDate,
  });
}

export async function postJourneyCharge(
  current: JourneyFixture,
  key = "order199-card-charge",
  amountMinor: string = JOURNEY.amountMinor,
): Promise<PostChargeResult> {
  if (!database || !charges) throw new Error("Order 199 charge service is unavailable");
  return database.withTenantTransaction(JOURNEY.tenantId, (tx) => charges!.postCharge(tx, {
    tenantId: JOURNEY.tenantId,
    folioId: current.folioId,
    txCode: JOURNEY.roomTxCode,
    amountMinor,
    quantity: "1.000",
    idempotencyKey: key,
    envelope: journeyAudit("journal.posted"),
  }));
}

export async function journeyBalance(current: JourneyFixture): Promise<string> {
  if (!deploy) throw new Error("Order 199 deploy database is unavailable");
  return (await deploy<Array<{ balance: string }>>`
    SELECT COALESCE(sum(amount_minor),0)::text AS balance
      FROM posting_line
     WHERE tenant_id=${JOURNEY.tenantId}::uuid
       AND folio_id=${current.folioId}::uuid
  `)[0]!.balance;
}

export async function settleAndCloseJourney(current: JourneyFixture, keyPrefix: string) {
  if (!settlements) throw new Error("Order 199 settlement service is unavailable");
  const settled = await settlements.settle({
    tenantId: JOURNEY.tenantId,
    folioId: current.folioId,
    idempotencyKey: `${keyPrefix}-settle`,
    envelope: journeyAudit("folio.settled"),
  });
  const closed = await settlements.close({
    tenantId: JOURNEY.tenantId,
    folioId: current.folioId,
    idempotencyKey: `${keyPrefix}-close`,
    envelope: journeyAudit("folio.closed"),
  });
  return Object.freeze({ settled, closed });
}

async function expectSqlState(operation: () => Promise<unknown>, expected: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    const candidate = error as { errno?: string; code?: string };
    expect(candidate.errno ?? candidate.code).toBe(expected);
    return;
  }
  throw new Error(`Expected SQLSTATE ${expected}`);
}

async function ledgerSnapshot(): Promise<LedgerSnapshot> {
  if (!deploy) throw new Error("Order 199 deploy database is unavailable");
  return (await deploy<LedgerSnapshot[]>`
    SELECT
      (SELECT COALESCE(jsonb_agg(to_jsonb(journal) ORDER BY journal.id),'[]'::jsonb)
         FROM journal WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS journals,
      (SELECT COALESCE(jsonb_agg(to_jsonb(line) ORDER BY line.id),'[]'::jsonb)
         FROM posting_line AS line WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS "postingLines"
  `)[0]!;
}

beforeAll(async () => {
  if (!RUNTIME_URL || !DEPLOY_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 12, prepare: false });
  runtime = new SQL(RUNTIME_URL, { max: 12, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 48, prepare: false });
  const events = new PostgresEventBus(runtime);
  const idempotency = new PostgresIdempotency();
  folios = new FolioService({ events, idempotency });
  charges = new ChargeService({ events, idempotency });
  payments = new PaymentService({ database, events, provider: new LocalPaymentProvider() });
  settlements = new FolioSettlementService({ database, events, idempotency });
  receivables = new ReceivableService({
    database,
    events,
    idempotency,
    approvals: new ApprovalService(events),
  });
}, 30_000);

beforeEach(async () => {
  if (!RUNTIME_URL || !DEPLOY_URL) return;
  await cleanJourneyFixture();
  fixture = await seedJourneyFixture();
}, 60_000);

afterAll(async () => {
  await cleanJourneyFixture();
  await database?.close();
  await runtime?.close({ timeout: 0 });
  await deploy?.close({ timeout: 0 });
}, 60_000);

describe("Order 199 Phase-5 financial journey composition", () => {
  test("exports one executable PostgreSQL journey fixture", () => {
    expect(typeof ChargeService).toBe("function");
    expect(typeof PaymentService).toBe("function");
    expect(typeof FolioSettlementService).toBe("function");
  });
});

dbDescribe("Order 199 pristine-PostgreSQL financial journey", () => {
  test("P1 charge -> payment capture -> zero -> settle -> close", async () => {
    // Exact gate marker: charge -> payment capture -> zero -> settle -> close
    const current = fixture!;
    const charge = await postJourneyCharge(current);
    expect(charge).toMatchObject({
      folioId: current.folioId,
      amountMinor: JOURNEY.amountMinor,
      currency: JOURNEY.currency,
      txCode: JOURNEY.roomTxCode,
      replayed: false,
    });
    expect(await journeyBalance(current)).toBe(JOURNEY.amountMinor);

    const authorization = await payments!.authorize({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      instrumentId: JOURNEY.instrumentId,
      amountMinor: JOURNEY.amountMinor,
      idempotencyKey: "order199-card-authorize",
      envelope: journeyAudit("payment.authorized"),
    });
    expect(authorization).toMatchObject({
      phase: "auth",
      outcome: "approved",
      amountMinor: JOURNEY.amountMinor,
      currency: JOURNEY.currency,
      journalId: null,
      replayed: false,
    });

    const captureRequest = {
      tenantId: JOURNEY.tenantId,
      operationId: authorization.operationId,
      amountMinor: JOURNEY.amountMinor,
      idempotencyKey: "order199-card-capture",
      envelope: journeyAudit("payment.captured"),
    } as const;
    const capture = await payments!.capture(captureRequest);
    expect(capture).toMatchObject({
      operationId: authorization.operationId,
      phase: "capture",
      outcome: "approved",
      amountMinor: JOURNEY.amountMinor,
      currency: JOURNEY.currency,
      journalId: expect.any(String),
      replayed: false,
    });
    expect(await payments!.capture(captureRequest)).toEqual({ ...capture, replayed: true });
    expect(await journeyBalance(current)).toBe("0");

    const immutableLedger = await ledgerSnapshot();
    const settled = await settlements!.settle({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      idempotencyKey: "order199-card-settle",
      envelope: journeyAudit("folio.settled"),
    });
    expect(settled).toMatchObject({
      folioId: current.folioId,
      accountId: current.guestAccountId,
      reservationId: JOURNEY.reservationId,
      windowNo: 1,
      previousStatus: "open",
      status: "settled",
      balanceMinor: "0",
      replayed: false,
    });
    const closed = await settlements!.close({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      idempotencyKey: "order199-card-close",
      envelope: journeyAudit("folio.closed"),
    });
    expect(closed).toMatchObject({
      folioId: current.folioId,
      accountId: current.guestAccountId,
      reservationId: JOURNEY.reservationId,
      windowNo: 1,
      previousStatus: "settled",
      status: "closed",
      balanceMinor: "0",
      replayed: false,
    });
    expect(await ledgerSnapshot()).toEqual(immutableLedger);

    const truth = (await deploy!<Array<{
      status: string;
      journals: number;
      lines: number;
      unbalanced: number;
      total: string;
      settlementFacts: number;
      settlementEvents: number;
      arAllocations: number;
    }>>`
      SELECT folio.status,
        (SELECT count(*)::int FROM journal WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS journals,
        (SELECT count(*)::int FROM posting_line WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS lines,
        (SELECT count(*)::int FROM (
          SELECT journal_id FROM posting_line WHERE tenant_id=${JOURNEY.tenantId}::uuid
          GROUP BY journal_id HAVING sum(amount_minor)<>0
        ) AS bad) AS unbalanced,
        (SELECT COALESCE(sum(amount_minor),0)::text FROM posting_line
          WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS total,
        (SELECT count(*)::int FROM fact_log
          WHERE tenant_id=${JOURNEY.tenantId}::uuid AND entity_id=${current.folioId}::uuid
            AND fact_type IN ('folio.settled','folio.closed')) AS "settlementFacts",
        (SELECT count(*)::int FROM outbox
          WHERE tenant_id=${JOURNEY.tenantId}::uuid AND aggregate_id=${current.folioId}::uuid
            AND event_type IN ('folio.settled','folio.closed')) AS "settlementEvents",
        (SELECT count(*)::int FROM ar_allocation
          WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS "arAllocations"
      FROM folio
      WHERE tenant_id=${JOURNEY.tenantId}::uuid AND id=${current.folioId}::uuid
    `)[0]!;
    expect(truth).toEqual({
      status: "closed",
      journals: 2,
      lines: 4,
      unbalanced: 0,
      total: "0",
      settlementFacts: 2,
      settlementEvents: 2,
      arAllocations: 0,
    });
  }, 60_000);

  test("P2 charge -> receivable transfer -> zero -> settle -> close", async () => {
    // Exact gate marker: charge -> receivable transfer -> zero -> settle -> close
    const current = fixture!;
    await postJourneyCharge(current, "order199-receivable-charge");
    const preview = await receivables!.preview({
      tenantId: JOURNEY.tenantId,
      propertyNode: JOURNEY.propertyNode,
      folioId: current.folioId,
      receivableAccountId: JOURNEY.withinReceivableAccountId,
    });
    expect(preview).toMatchObject({
      folioId: current.folioId,
      receivableAccountId: JOURNEY.withinReceivableAccountId,
      partyId: JOURNEY.companyPartyId,
      partyRole: "company",
      currency: JOURNEY.currency,
      amountMinor: JOURNEY.amountMinor,
      exposureMinor: "0",
      creditLimitMinor: "50000",
      projectedExposureMinor: JOURNEY.amountMinor,
      requiresApproval: false,
    });

    const transferred = await receivables!.transfer({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      receivableAccountId: JOURNEY.withinReceivableAccountId,
      reason: "Order 199 company direct billing",
      idempotencyKey: "order199-within-transfer",
      envelope: journeyAudit("journal.posted"),
    });
    expect(transferred).toMatchObject({
      folioId: current.folioId,
      receivableAccountId: JOURNEY.withinReceivableAccountId,
      partyId: JOURNEY.companyPartyId,
      partyRole: "company",
      amountMinor: JOURNEY.amountMinor,
      exposureMinor: "0",
      creditLimitMinor: "50000",
      projectedExposureMinor: JOURNEY.amountMinor,
      requiresApproval: false,
      approvalId: null,
      replayed: false,
    });
    expect(await journeyBalance(current)).toBe("0");

    const immutableLedger = await ledgerSnapshot();
    const { settled, closed } = await settleAndCloseJourney(current, "order199-receivable");
    expect(settled).toMatchObject({
      folioId: current.folioId,
      reservationId: JOURNEY.reservationId,
      previousStatus: "open",
      status: "settled",
      balanceMinor: "0",
      replayed: false,
    });
    expect(closed).toMatchObject({
      folioId: current.folioId,
      reservationId: JOURNEY.reservationId,
      previousStatus: "settled",
      status: "closed",
      balanceMinor: "0",
      replayed: false,
    });
    expect(await ledgerSnapshot()).toEqual(immutableLedger);

    const truth = (await deploy!<Array<{
      status: string;
      folioBalance: string;
      exposure: string;
      transferLines: number;
      transferTotal: string;
      payments: number;
      documents: number;
      allocations: number;
    }>>`
      SELECT folio.status,
        (SELECT COALESCE(sum(amount_minor),0)::text FROM posting_line
          WHERE tenant_id=${JOURNEY.tenantId}::uuid AND folio_id=${current.folioId}::uuid) AS "folioBalance",
        (SELECT COALESCE(sum(amount_minor),0)::text FROM posting_line
          WHERE tenant_id=${JOURNEY.tenantId}::uuid
            AND account_id=${JOURNEY.withinReceivableAccountId}::uuid) AS exposure,
        (SELECT count(*)::int FROM posting_line
          WHERE tenant_id=${JOURNEY.tenantId}::uuid AND journal_id=${transferred.journalId}::uuid) AS "transferLines",
        (SELECT COALESCE(sum(amount_minor),0)::text FROM posting_line
          WHERE tenant_id=${JOURNEY.tenantId}::uuid AND journal_id=${transferred.journalId}::uuid) AS "transferTotal",
        (SELECT count(*)::int FROM payment WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS payments,
        (SELECT count(*)::int FROM document WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS documents,
        (SELECT count(*)::int FROM ar_allocation WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS allocations
      FROM folio
      WHERE tenant_id=${JOURNEY.tenantId}::uuid AND id=${current.folioId}::uuid
    `)[0]!;
    expect(truth).toEqual({
      status: "closed",
      folioBalance: "0",
      exposure: JOURNEY.amountMinor,
      transferLines: 2,
      transferTotal: "0",
      payments: 0,
      documents: 0,
      allocations: 0,
    });
  }, 60_000);

  test("P3 over-limit maker/checker approval is exact, fresh, rejected safely, and one-use", async () => {
    const current = fixture!;
    await postJourneyCharge(current, "order199-over-limit-charge");

    const staleRequest = await receivables!.requestOverLimitApproval({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      receivableAccountId: JOURNEY.overReceivableAccountId,
      idempotencyKey: "order199-stale-request",
      envelope: journeyAudit("approval.requested"),
    });
    expect(staleRequest).toMatchObject({
      status: "pending",
      amountMinor: JOURNEY.amountMinor,
      exposureMinor: "0",
      creditLimitMinor: "5000",
      projectedExposureMinor: JOURNEY.amountMinor,
      replayed: false,
    });
    await expect(receivables!.approveOverLimit({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      approvalId: staleRequest.approvalId,
      idempotencyKey: "order199-self-approval",
      envelope: journeyAudit("approval.decided"),
    })).rejects.toBeInstanceOf(ReceivableConflictError);

    await postJourneyCharge(current, "order199-stale-change", "1");
    await expect(receivables!.approveOverLimit({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      approvalId: staleRequest.approvalId,
      idempotencyKey: "order199-stale-decision",
      envelope: journeyAudit("approval.decided", JOURNEY.approverId),
    })).rejects.toBeInstanceOf(ReceivableConflictError);

    const rejectedRequest = await receivables!.requestOverLimitApproval({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      receivableAccountId: JOURNEY.overReceivableAccountId,
      idempotencyKey: "order199-rejected-request",
      envelope: journeyAudit("approval.requested"),
    });
    expect((await receivables!.rejectOverLimit({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      approvalId: rejectedRequest.approvalId,
      idempotencyKey: "order199-rejected-decision",
      envelope: journeyAudit("approval.decided", JOURNEY.approverId),
    })).status).toBe("rejected");
    await expect(receivables!.transfer({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      receivableAccountId: JOURNEY.overReceivableAccountId,
      approvalId: rejectedRequest.approvalId,
      reason: "Rejected Order 199 direct billing",
      idempotencyKey: "order199-rejected-transfer",
      envelope: journeyAudit("journal.posted"),
    })).rejects.toBeInstanceOf(ReceivableConflictError);

    const exactPayload = {
      partyId: JOURNEY.agentPartyId,
      accountId: JOURNEY.overReceivableAccountId,
      folioId: current.folioId,
      amountMinor: "12501",
      exposureBeforeMinor: "0",
      creditLimitMinor: "5000",
      projectedExposureMinor: "12501",
    };
    await deploy!`INSERT INTO approval_request(
        id,tenant_id,kind,subject_type,subject_id,requested_by,payload,
        status,decided_by,decided_at
      ) VALUES(
        ${JOURNEY.foreignApprovalId}::uuid,${JOURNEY.foreignTenantId}::uuid,
        'receivable_transfer_over_limit','folio',${current.folioId}::uuid,
        ${JOURNEY.foreignActorId}::uuid,${JSON.stringify(exactPayload)}::jsonb,
        'approved',${JOURNEY.foreignApproverId}::uuid,transaction_timestamp()
      )`;
    await expect(receivables!.transfer({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      receivableAccountId: JOURNEY.overReceivableAccountId,
      approvalId: JOURNEY.foreignApprovalId,
      reason: "Foreign Order 199 approval",
      idempotencyKey: "order199-foreign-transfer",
      envelope: journeyAudit("journal.posted"),
    })).rejects.toBeInstanceOf(ReceivableConflictError);

    await deploy!`INSERT INTO approval_request(
        id,tenant_id,kind,subject_type,subject_id,requested_by,payload,
        status,decided_by,decided_at
      ) VALUES(
        ${JOURNEY.forgedApprovalId}::uuid,${JOURNEY.tenantId}::uuid,
        'receivable_transfer_over_limit','folio',${current.folioId}::uuid,
        ${JOURNEY.actorId}::uuid,
        ${JSON.stringify({ ...exactPayload, amountMinor: "12500" })}::jsonb,
        'approved',${JOURNEY.approverId}::uuid,transaction_timestamp()
      )`;
    await expect(receivables!.transfer({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      receivableAccountId: JOURNEY.overReceivableAccountId,
      approvalId: JOURNEY.forgedApprovalId,
      reason: "Forged Order 199 approval",
      idempotencyKey: "order199-forged-transfer",
      envelope: journeyAudit("journal.posted"),
    })).rejects.toBeInstanceOf(ReceivableConflictError);
    expect((await deploy!<Array<{ linked: number }>>`
      SELECT count(*)::int AS linked FROM journal
       WHERE tenant_id=${JOURNEY.tenantId}::uuid
         AND approval_request_id IN (
           ${JOURNEY.foreignApprovalId}::uuid,${JOURNEY.forgedApprovalId}::uuid
         )
    `)[0]).toEqual({ linked: 0 });

    const exactRequest = await receivables!.requestOverLimitApproval({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      receivableAccountId: JOURNEY.overReceivableAccountId,
      idempotencyKey: "order199-exact-request",
      envelope: journeyAudit("approval.requested"),
    });
    expect((await receivables!.approveOverLimit({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      approvalId: exactRequest.approvalId,
      idempotencyKey: "order199-exact-decision",
      envelope: journeyAudit("approval.decided", JOURNEY.approverId),
    }))).toMatchObject({ status: "approved", replayed: false });
    const transferInput = {
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      receivableAccountId: JOURNEY.overReceivableAccountId,
      approvalId: exactRequest.approvalId,
      reason: "Approved Order 199 direct billing",
      idempotencyKey: "order199-exact-transfer",
      envelope: journeyAudit("journal.posted"),
    } as const;
    const transferred = await receivables!.transfer(transferInput);
    expect(transferred).toMatchObject({
      approvalId: exactRequest.approvalId,
      amountMinor: "12501",
      exposureMinor: "0",
      creditLimitMinor: "5000",
      projectedExposureMinor: "12501",
      replayed: false,
    });
    expect(await receivables!.transfer(transferInput)).toEqual({ ...transferred, replayed: true });
    expect(await journeyBalance(current)).toBe("0");

    await postJourneyCharge(current, "order199-approval-reuse-balance", "12501");
    await expect(receivables!.transfer({
      ...transferInput,
      idempotencyKey: "order199-approval-reuse-transfer",
      envelope: journeyAudit("journal.posted"),
    })).rejects.toBeInstanceOf(ReceivableConflictError);
    const lineage = (await deploy!<Array<{ uses: number; transferJournals: number }>>`
      SELECT
        (SELECT count(*)::int FROM journal
          WHERE tenant_id=${JOURNEY.tenantId}::uuid
            AND approval_request_id=${exactRequest.approvalId}::uuid) AS uses,
        (SELECT count(*)::int FROM journal
          WHERE tenant_id=${JOURNEY.tenantId}::uuid
            AND source='{"interface":"financials.receivable.transfer"}'::jsonb) AS "transferJournals"
    `)[0]!;
    expect(lineage).toEqual({ uses: 1, transferJournals: 1 });
  }, 60_000);

  test("P4 capture, transfer and settlement arbitration converges to one lawful result", async () => {
    // Exact gate marker: capture, transfer and settlement arbitration
    const current = fixture!;
    await postJourneyCharge(current, "order199-arbitration-charge");
    const authorization = await payments!.authorize({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      instrumentId: JOURNEY.instrumentId,
      amountMinor: JOURNEY.amountMinor,
      idempotencyKey: "order199-arbitration-authorize",
      envelope: journeyAudit("payment.authorized"),
    });

    const outcomes = await Promise.allSettled([
      payments!.capture({
        tenantId: JOURNEY.tenantId,
        operationId: authorization.operationId,
        amountMinor: JOURNEY.amountMinor,
        idempotencyKey: "order199-arbitration-capture",
        envelope: journeyAudit("payment.captured"),
      }),
      receivables!.transfer({
        tenantId: JOURNEY.tenantId,
        folioId: current.folioId,
        receivableAccountId: JOURNEY.withinReceivableAccountId,
        reason: "Order 199 arbitration direct billing",
        idempotencyKey: "order199-arbitration-transfer",
        envelope: journeyAudit("journal.posted"),
      }),
      settlements!.settle({
        tenantId: JOURNEY.tenantId,
        folioId: current.folioId,
        idempotencyKey: "order199-arbitration-settle",
        envelope: journeyAudit("folio.settled"),
      }),
    ]);
    expect(outcomes.slice(0, 2).filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(await journeyBalance(current)).toBe("0");

    const truth = (await deploy!<Array<{
      status: string;
      journals: number;
      lines: number;
      unbalanced: number;
      captures: number;
      transferJournals: number;
      journalFacts: number;
      journalEvents: number;
      settlementFacts: number;
      settlementEvents: number;
    }>>`
      SELECT folio.status,
        (SELECT count(*)::int FROM journal WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS journals,
        (SELECT count(*)::int FROM posting_line WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS lines,
        (SELECT count(*)::int FROM (
          SELECT journal_id FROM posting_line WHERE tenant_id=${JOURNEY.tenantId}::uuid
          GROUP BY journal_id HAVING sum(amount_minor)<>0
        ) AS bad) AS unbalanced,
        (SELECT count(*)::int FROM payment
          WHERE tenant_id=${JOURNEY.tenantId}::uuid AND phase='capture' AND status='succeeded') AS captures,
        (SELECT count(*)::int FROM journal
          WHERE tenant_id=${JOURNEY.tenantId}::uuid
            AND source='{"interface":"financials.receivable.transfer"}'::jsonb) AS "transferJournals",
        (SELECT count(*)::int FROM fact_log
          WHERE tenant_id=${JOURNEY.tenantId}::uuid AND fact_type='journal.posted') AS "journalFacts",
        (SELECT count(*)::int FROM outbox
          WHERE tenant_id=${JOURNEY.tenantId}::uuid AND event_type='journal.posted') AS "journalEvents",
        (SELECT count(*)::int FROM fact_log
          WHERE tenant_id=${JOURNEY.tenantId}::uuid AND entity_id=${current.folioId}::uuid
            AND fact_type='folio.settled') AS "settlementFacts",
        (SELECT count(*)::int FROM outbox
          WHERE tenant_id=${JOURNEY.tenantId}::uuid AND aggregate_id=${current.folioId}::uuid
            AND event_type='folio.settled') AS "settlementEvents"
      FROM folio
      WHERE tenant_id=${JOURNEY.tenantId}::uuid AND id=${current.folioId}::uuid
    `)[0]!;
    expect(truth.journals).toBe(2);
    expect(truth.lines).toBe(4);
    expect(truth.unbalanced).toBe(0);
    expect(truth.captures + truth.transferJournals).toBe(1);
    expect(truth.journalFacts).toBe(2);
    expect(truth.journalEvents).toBe(2);
    if (outcomes[2]!.status === "fulfilled") {
      expect(truth).toMatchObject({ status: "settled", settlementFacts: 1, settlementEvents: 1 });
    } else {
      expect(truth).toMatchObject({ status: "open", settlementFacts: 0, settlementEvents: 0 });
    }

    if (truth.status === "open") {
      const normalized = await settlements!.settle({
        tenantId: JOURNEY.tenantId,
        folioId: current.folioId,
        idempotencyKey: "order199-arbitration-normalize-settle",
        envelope: journeyAudit("folio.settled"),
      });
      expect(normalized).toMatchObject({ status: "settled", balanceMinor: "0", replayed: false });
    }
    const closed = await settlements!.close({
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      idempotencyKey: "order199-arbitration-close",
      envelope: journeyAudit("folio.closed"),
    });
    expect(closed).toMatchObject({ status: "closed", balanceMinor: "0", replayed: false });
    const final = (await deploy!<Array<{
      status: string;
      settledFacts: number;
      closedFacts: number;
      settledEvents: number;
      closedEvents: number;
      journals: number;
      lines: number;
    }>>`
      SELECT folio.status,
        (SELECT count(*)::int FROM fact_log
          WHERE tenant_id=${JOURNEY.tenantId}::uuid AND entity_id=${current.folioId}::uuid
            AND fact_type='folio.settled') AS "settledFacts",
        (SELECT count(*)::int FROM fact_log
          WHERE tenant_id=${JOURNEY.tenantId}::uuid AND entity_id=${current.folioId}::uuid
            AND fact_type='folio.closed') AS "closedFacts",
        (SELECT count(*)::int FROM outbox
          WHERE tenant_id=${JOURNEY.tenantId}::uuid AND aggregate_id=${current.folioId}::uuid
            AND event_type='folio.settled') AS "settledEvents",
        (SELECT count(*)::int FROM outbox
          WHERE tenant_id=${JOURNEY.tenantId}::uuid AND aggregate_id=${current.folioId}::uuid
            AND event_type='folio.closed') AS "closedEvents",
        (SELECT count(*)::int FROM journal WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS journals,
        (SELECT count(*)::int FROM posting_line WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS lines
      FROM folio
      WHERE tenant_id=${JOURNEY.tenantId}::uuid AND id=${current.folioId}::uuid
    `)[0]!;
    expect(final).toEqual({
      status: "closed",
      settledFacts: 1,
      closedFacts: 1,
      settledEvents: 1,
      closedEvents: 1,
      journals: 2,
      lines: 4,
    });
  }, 60_000);

  test("P5 hostile property and raw runtime mutation authority fail closed", async () => {
    const current = fixture!;
    const before = (await deploy!<Array<{
      journals: number;
      facts: number;
      events: number;
      keys: number;
    }>>`
      SELECT
        (SELECT count(*)::int FROM journal WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS journals,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS keys
    `)[0]!;
    await expect(database!.withTenantTransaction(JOURNEY.tenantId, (tx) => charges!.postCharge(tx, {
      tenantId: JOURNEY.tenantId,
      folioId: current.folioId,
      txCode: JOURNEY.roomTxCode,
      amountMinor: JOURNEY.amountMinor,
      quantity: "1.000",
      idempotencyKey: "order199-hostile-property-charge",
      envelope: journeyAudit("journal.posted", JOURNEY.actorId, JOURNEY.foreignPropertyNode),
    }))).rejects.toBeInstanceOf(ChargeNotFoundError);
    const after = (await deploy!<Array<typeof before>>`
      SELECT
        (SELECT count(*)::int FROM journal WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS journals,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${JOURNEY.tenantId}::uuid) AS keys
    `)[0]!;
    expect(after).toEqual(before);

    await expectSqlState(() => runtime!.unsafe(
      "UPDATE folio SET status='settled' WHERE tenant_id=$1::uuid AND id=$2::uuid",
      [JOURNEY.tenantId, current.folioId],
    ), "42501");
    await expectSqlState(() => runtime!.unsafe(
      "SELECT * FROM public.transition_folio_status($1::uuid,$2::uuid,$3::uuid,$4)",
      [JOURNEY.tenantId, JOURNEY.propertyNode, current.folioId, "settle"],
    ), "42501");
    await expectSqlState(() => runtime!.unsafe(
      "SELECT * FROM public.create_receivable_transfer($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,NULL,$6)",
      [JOURNEY.tenantId, JOURNEY.propertyNode, current.folioId,
        JOURNEY.withinReceivableAccountId, JOURNEY.actorId, "raw runtime transfer"],
    ), "42501");
    expect((await deploy!<Array<{ status: string }>>`
      SELECT status FROM folio
       WHERE tenant_id=${JOURNEY.tenantId}::uuid AND id=${current.folioId}::uuid
    `)[0]).toEqual({ status: "open" });
  }, 30_000);
});
