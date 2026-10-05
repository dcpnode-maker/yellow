import { Database, type Tx } from "../kernel";
import {
  DEMO_ACTOR_ID,
  DEMO_BUSINESS_DATE,
  DEMO_CONFIRMATION_NO,
  DEMO_IDS,
  DEMO_PROPERTY_NODE,
  DEMO_TENANT_ID,
} from "./demo-arrival-fixture";

const CONFIRMATION_PHRASE = "CONFIRM YELLOW OPERATION";
const DEMO_FOLIO_NO = "FOL-DEMO-303";
const SETTLEMENT_KEY = "cash-settlement-current-balance";

export interface GovernedCashierSettlementInput {
  readonly confirmationNo?: string;
  readonly folioNo?: string;
  readonly settlementKey?: string;
  readonly confirmationPhrase?: string;
  readonly databaseUrl?: string;
}

export interface GovernedCashierSettlementResult {
  readonly actionId: "settle-payment";
  readonly mode: "governed-db-command";
  readonly requiresConfirmation: true;
  readonly confirmationPhrase: "CONFIRM YELLOW OPERATION";
  readonly confirmed: boolean;
  readonly executed: boolean;
  readonly realPmsExecuted: boolean;
  readonly databaseConfigured: boolean;
  readonly reason: string;
  readonly proof: null | {
    readonly tenantId: string;
    readonly propertyNode: string;
    readonly confirmationNo: string;
    readonly folioNo: string;
    readonly settlementKey: "cash-settlement-current-balance";
    readonly journalId: string | null;
    readonly paymentId: string | null;
    readonly instrumentId: string | null;
    readonly amountMinor: string;
    readonly postingLineCount: number;
    readonly beforeBalanceMinor: string;
    readonly afterBalanceMinor: string;
    readonly outboxEventType: "folio.payment_settled" | null;
    readonly outboxSeq: string | null;
    readonly correlationId: string | null;
    readonly replayed: boolean;
  };
}

interface FixtureRow {
  readonly reservation_id: string;
  readonly reservation_status: string;
  readonly folio_id: string;
  readonly folio_status: string;
  readonly guest_account_id: string;
  readonly cash_account_id: string;
  readonly cash_instrument_id: string;
}

interface BalanceRow {
  readonly balance_minor: string | number | bigint | null;
}

interface ExistingSettlementRow {
  readonly journal_id: string;
  readonly payment_id: string | null;
  readonly instrument_id: string | null;
  readonly amount_minor: string | number | bigint;
}

interface IdRow {
  readonly id: string;
}

interface CountRow {
  readonly count: string | number | bigint;
}

interface OutboxRow {
  readonly seq: string | number | bigint;
}

export async function executeGovernedCashierSettlement(
  input: GovernedCashierSettlementInput,
): Promise<GovernedCashierSettlementResult> {
  const confirmationNo = normalizeConfirmationNo(input.confirmationNo);
  const folioNo = normalizeFolioNo(input.folioNo);
  const settlementKey = normalizeSettlementKey(input.settlementKey);
  const databaseConfigured = input.databaseUrl !== undefined && input.databaseUrl.trim() !== "";
  const confirmed = input.confirmationPhrase === CONFIRMATION_PHRASE;

  if (!confirmed) {
    return result(false, false, false, databaseConfigured, "Exact confirmation phrase is required before any database mutation.", null);
  }
  if (confirmationNo !== DEMO_CONFIRMATION_NO || folioNo !== DEMO_FOLIO_NO || settlementKey === null) {
    return result(true, false, false, databaseConfigured, "This governed settlement command is limited to the fixed public-demo folio and settlement key.", null);
  }
  if (!databaseConfigured) {
    return result(true, false, false, false, "DATABASE_URL is not configured for governed command execution.", null);
  }

  const database = Database.connect(input.databaseUrl ?? "", { maxConnections: 1, prepare: false });
  try {
    const proof = await database.withTenantTransaction(DEMO_TENANT_ID, async (tx) => executeInTransaction(tx));
    return result(true, !proof.replayed, !proof.replayed, true, proof.replayed ? "Settlement was already posted; authoritative folio balance reread from PostgreSQL." : "Governed settlement executed and reread from PostgreSQL.", proof);
  } finally {
    database.close();
  }
}

async function executeInTransaction(tx: Tx): Promise<NonNullable<GovernedCashierSettlementResult["proof"]>> {
  const fixture = await readFixture(tx);
  if (fixture.folio_status !== "open") throw new Error(`folio ${DEMO_FOLIO_NO} is not open`);
  const beforeBalance = await readFolioBalance(tx, fixture.folio_id);
  const existing = await readExistingSettlement(tx);
  if (existing !== null) {
    const lineCount = await postingLineCount(tx, existing.journal_id);
    const afterBalance = await readFolioBalance(tx, fixture.folio_id);
    return buildProof(fixture, existing.journal_id, existing.payment_id, existing.instrument_id, String(existing.amount_minor), lineCount, beforeBalance, afterBalance, null, null, true);
  }

  const amountMinor = BigInt(beforeBalance);
  if (amountMinor <= 0n) throw new Error(`folio ${DEMO_FOLIO_NO} has no positive balance to settle`);

  const journalRows = await tx<IdRow[]>`
    INSERT INTO journal (
      tenant_id, property_node, business_date, kind, description, currency, source, created_by
    )
    VALUES (
      ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_BUSINESS_DATE}::date,
      'payment', 'Demo cash settlement', 'INR',
      ${JSON.stringify({ demoCommand: "cashier-settlement", settlementKey: SETTLEMENT_KEY, confirmationNo: DEMO_CONFIRMATION_NO, folioNo: DEMO_FOLIO_NO })}::jsonb,
      ${DEMO_ACTOR_ID}::uuid
    )
    RETURNING id::text
  `;
  const journalId = journalRows[0]?.id;
  if (journalId === undefined) throw new Error("journal insert returned no row");

  await tx`
    INSERT INTO posting_line (
      tenant_id, journal_id, seq, account_id, folio_id, tx_code, description, amount_minor, quantity, tax_detail, business_date
    )
    VALUES
      (${DEMO_TENANT_ID}::uuid, ${journalId}::uuid, 1, ${fixture.guest_account_id}::uuid, ${fixture.folio_id}::uuid, 'DEMOCASH', 'Demo cash settlement', ${-amountMinor}, 1, '{}'::jsonb, ${DEMO_BUSINESS_DATE}::date),
      (${DEMO_TENANT_ID}::uuid, ${journalId}::uuid, 2, ${fixture.cash_account_id}::uuid, NULL, 'DEMOCASH', 'Demo cash settlement', ${amountMinor}, 1, '{}'::jsonb, ${DEMO_BUSINESS_DATE}::date)
  `;

  const paymentRows = await tx<IdRow[]>`
    INSERT INTO payment (
      tenant_id, journal_id, instrument_id, psp, psp_ref, method, phase, amount_minor, currency, status
    )
    VALUES (
      ${DEMO_TENANT_ID}::uuid, ${journalId}::uuid, ${fixture.cash_instrument_id}::uuid,
      'yellow-demo', ${`demo-${SETTLEMENT_KEY}`}, 'cash', 'capture', ${amountMinor}, 'INR', 'succeeded'
    )
    RETURNING id::text
  `;
  const paymentId = paymentRows[0]?.id;
  if (paymentId === undefined) throw new Error("payment insert returned no row");

  const correlationId = crypto.randomUUID();
  const outboxRows = await tx<OutboxRow[]>`
    INSERT INTO outbox (
      id, tenant_id, property_node, business_date, aggregate_type, aggregate_id,
      event_type, event_version, actor_id, correlation_id, payload
    )
    VALUES (
      ${crypto.randomUUID()}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_BUSINESS_DATE}::date,
      'folio', ${fixture.folio_id}::uuid, 'folio.payment_settled', 1,
      ${DEMO_ACTOR_ID}::uuid, ${correlationId}::uuid,
      ${JSON.stringify({ confirmationNo: DEMO_CONFIRMATION_NO, folioNo: DEMO_FOLIO_NO, settlementKey: SETTLEMENT_KEY, amountMinor: amountMinor.toString(), journalId, paymentId })}::jsonb
    )
    RETURNING seq
  `;
  const afterBalance = await readFolioBalance(tx, fixture.folio_id);
  const lineCount = await postingLineCount(tx, journalId);
  return buildProof(fixture, journalId, paymentId, fixture.cash_instrument_id, amountMinor.toString(), lineCount, beforeBalance, afterBalance, String(outboxRows[0]?.seq ?? ""), correlationId, false);
}

async function readFixture(tx: Tx): Promise<FixtureRow> {
  const rows = await tx<FixtureRow[]>`
    SELECT reservation.id::text AS reservation_id,
           reservation.status AS reservation_status,
           folio.id::text AS folio_id,
           folio.status AS folio_status,
           guest_account.id::text AS guest_account_id,
           cash_account.id::text AS cash_account_id,
           cash_instrument.id::text AS cash_instrument_id
      FROM reservation
      JOIN folio ON folio.tenant_id = reservation.tenant_id AND folio.reservation_id = reservation.id
      JOIN account guest_account ON guest_account.tenant_id = reservation.tenant_id AND guest_account.id = folio.account_id
      JOIN account cash_account ON cash_account.tenant_id = reservation.tenant_id AND cash_account.id = ${DEMO_IDS.cashAccount}::uuid
      JOIN payment_instrument cash_instrument ON cash_instrument.tenant_id = reservation.tenant_id AND cash_instrument.id = ${DEMO_IDS.cashInstrument}::uuid
      JOIN tx_code ON tx_code.code = 'DEMOCASH'
      JOIN business_day ON business_day.tenant_id = reservation.tenant_id
                       AND business_day.property_node = reservation.property_node
                       AND business_day.business_date = ${DEMO_BUSINESS_DATE}::date
                       AND business_day.sealed_at IS NULL
     WHERE reservation.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND reservation.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND reservation.confirmation_no = ${DEMO_CONFIRMATION_NO}
       AND folio.folio_no = ${DEMO_FOLIO_NO}
       AND folio.status = 'open'
     LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) throw new Error("provisioned demo settlement fixture is missing");
  return row;
}

async function readFolioBalance(tx: Tx, folioId: string): Promise<string> {
  const rows = await tx<BalanceRow[]>`
    SELECT COALESCE(balance_minor, 0)::text AS balance_minor
      FROM folio_balance
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND folio_id = ${folioId}::uuid
  `;
  return String(rows[0]?.balance_minor ?? "0");
}

async function readExistingSettlement(tx: Tx): Promise<ExistingSettlementRow | null> {
  const rows = await tx<ExistingSettlementRow[]>`
    SELECT journal.id::text AS journal_id,
           payment.id::text AS payment_id,
           payment.instrument_id::text AS instrument_id,
           payment.amount_minor::text AS amount_minor
      FROM journal
      LEFT JOIN payment ON payment.tenant_id = journal.tenant_id AND payment.journal_id = journal.id
     WHERE journal.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND journal.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND journal.source @> ${JSON.stringify({ demoCommand: "cashier-settlement", settlementKey: SETTLEMENT_KEY })}::jsonb
     ORDER BY journal.created_at
     LIMIT 1
  `;
  return rows[0] ?? null;
}

async function postingLineCount(tx: Tx, journalId: string): Promise<number> {
  const rows = await tx<CountRow[]>`
    SELECT count(*) AS count
      FROM posting_line
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND journal_id = ${journalId}::uuid
  `;
  return Number(rows[0]?.count ?? 0);
}

function buildProof(
  fixture: FixtureRow,
  journalId: string | null,
  paymentId: string | null,
  instrumentId: string | null,
  amountMinor: string,
  postingLineCountValue: number,
  beforeBalanceMinor: string,
  afterBalanceMinor: string,
  outboxSeq: string | null,
  correlationId: string | null,
  replayed: boolean,
): NonNullable<GovernedCashierSettlementResult["proof"]> {
  return Object.freeze({
    tenantId: DEMO_TENANT_ID,
    propertyNode: DEMO_PROPERTY_NODE,
    confirmationNo: DEMO_CONFIRMATION_NO,
    folioNo: DEMO_FOLIO_NO,
    settlementKey: SETTLEMENT_KEY,
    journalId,
    paymentId,
    instrumentId,
    amountMinor,
    postingLineCount: postingLineCountValue,
    beforeBalanceMinor,
    afterBalanceMinor,
    outboxEventType: replayed ? null : "folio.payment_settled",
    outboxSeq,
    correlationId,
    replayed,
  });
}

function result(
  confirmed: boolean,
  executed: boolean,
  realPmsExecuted: boolean,
  databaseConfigured: boolean,
  reason: string,
  proof: GovernedCashierSettlementResult["proof"],
): GovernedCashierSettlementResult {
  return Object.freeze({
    actionId: "settle-payment" as const,
    mode: "governed-db-command" as const,
    requiresConfirmation: true as const,
    confirmationPhrase: CONFIRMATION_PHRASE,
    confirmed,
    executed,
    realPmsExecuted,
    databaseConfigured,
    reason,
    proof,
  });
}

function normalizeConfirmationNo(value: string | undefined): string {
  return (value ?? DEMO_CONFIRMATION_NO).trim().toUpperCase();
}

function normalizeFolioNo(value: string | undefined): string {
  return (value ?? DEMO_FOLIO_NO).trim().toUpperCase();
}

function normalizeSettlementKey(value: string | undefined): "cash-settlement-current-balance" | null {
  const normalized = (value ?? SETTLEMENT_KEY).trim().toLowerCase();
  return normalized === SETTLEMENT_KEY ? SETTLEMENT_KEY : null;
}
