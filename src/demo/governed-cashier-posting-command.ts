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

const DEMO_CHARGES = Object.freeze({
  "dinner-charge-001": Object.freeze({
    amountMinor: 125000,
    description: "Demo dinner charge",
    txCode: "DEMOFOOD",
  }),
  "laundry-charge-001": Object.freeze({
    amountMinor: 65000,
    description: "Demo laundry charge",
    txCode: "DEMOFOOD",
  }),
});

export type DemoCashierChargeKey = keyof typeof DEMO_CHARGES;

export interface GovernedCashierPostingInput {
  readonly confirmationNo?: string;
  readonly folioNo?: string;
  readonly chargeKey?: string;
  readonly confirmationPhrase?: string;
  readonly databaseUrl?: string;
}

export interface GovernedCashierPostingResult {
  readonly actionId: "post-charge";
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
    readonly chargeKey: DemoCashierChargeKey;
    readonly journalId: string | null;
    readonly amountMinor: number;
    readonly postingLineCount: number;
    readonly beforeBalanceMinor: string;
    readonly afterBalanceMinor: string;
    readonly outboxEventType: "folio.charge_posted" | null;
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
  readonly revenue_account_id: string;
}

interface BalanceRow {
  readonly balance_minor: string | number | bigint | null;
}

interface JournalRow {
  readonly id: string;
}

interface CountRow {
  readonly count: string | number | bigint;
}

interface OutboxRow {
  readonly seq: string | number | bigint;
}

export async function executeGovernedCashierPosting(
  input: GovernedCashierPostingInput,
): Promise<GovernedCashierPostingResult> {
  const confirmationNo = normalizeConfirmationNo(input.confirmationNo);
  const folioNo = normalizeFolioNo(input.folioNo);
  const chargeKey = normalizeChargeKey(input.chargeKey);
  const databaseConfigured = input.databaseUrl !== undefined && input.databaseUrl.trim() !== "";
  const confirmed = input.confirmationPhrase === CONFIRMATION_PHRASE;

  if (!confirmed) {
    return result(false, false, false, databaseConfigured, "Exact confirmation phrase is required before any database mutation.", null);
  }
  if (confirmationNo !== DEMO_CONFIRMATION_NO || folioNo !== DEMO_FOLIO_NO || chargeKey === null) {
    return result(true, false, false, databaseConfigured, "This governed cashier posting command is limited to the fixed public-demo folio and charge catalog.", null);
  }
  if (!databaseConfigured) {
    return result(true, false, false, false, "DATABASE_URL is not configured for governed command execution.", null);
  }

  const database = Database.connect(input.databaseUrl ?? "", { maxConnections: 1, prepare: false });
  try {
    const proof = await database.withTenantTransaction(DEMO_TENANT_ID, async (tx) => executeInTransaction(tx, chargeKey));
    return result(true, !proof.replayed, !proof.replayed, true, proof.replayed ? "Charge key was already posted; authoritative folio balance reread from PostgreSQL." : "Governed cashier posting executed and reread from PostgreSQL.", proof);
  } finally {
    database.close();
  }
}

async function executeInTransaction(
  tx: Tx,
  chargeKey: DemoCashierChargeKey,
): Promise<NonNullable<GovernedCashierPostingResult["proof"]>> {
  const fixture = await readFixture(tx);
  if (fixture.folio_status !== "open") throw new Error(`folio ${DEMO_FOLIO_NO} is not open`);
  const charge = DEMO_CHARGES[chargeKey];
  const beforeBalance = await readFolioBalance(tx, fixture.folio_id);
  const existing = await readExistingJournal(tx, chargeKey);
  if (existing !== null) {
    const lineCount = await postingLineCount(tx, existing);
    const afterBalance = await readFolioBalance(tx, fixture.folio_id);
    return buildProof(fixture, chargeKey, existing, charge.amountMinor, lineCount, beforeBalance, afterBalance, null, null, true);
  }

  const journalRows = await tx<JournalRow[]>`
    INSERT INTO journal (
      tenant_id, property_node, business_date, kind, description, currency, source, created_by
    )
    VALUES (
      ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_BUSINESS_DATE}::date,
      'charge', ${charge.description}, 'INR',
      ${JSON.stringify({ demoCommand: "cashier-posting", chargeKey, confirmationNo: DEMO_CONFIRMATION_NO, folioNo: DEMO_FOLIO_NO })}::jsonb,
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
      (${DEMO_TENANT_ID}::uuid, ${journalId}::uuid, 1, ${fixture.guest_account_id}::uuid, ${fixture.folio_id}::uuid, ${charge.txCode}, ${charge.description}, ${charge.amountMinor}, 1, '{}'::jsonb, ${DEMO_BUSINESS_DATE}::date),
      (${DEMO_TENANT_ID}::uuid, ${journalId}::uuid, 2, ${fixture.revenue_account_id}::uuid, NULL, ${charge.txCode}, ${charge.description}, ${-charge.amountMinor}, 1, '{}'::jsonb, ${DEMO_BUSINESS_DATE}::date)
  `;
  const correlationId = crypto.randomUUID();
  const outboxRows = await tx<OutboxRow[]>`
    INSERT INTO outbox (
      id, tenant_id, property_node, business_date, aggregate_type, aggregate_id,
      event_type, event_version, actor_id, correlation_id, payload
    )
    VALUES (
      ${crypto.randomUUID()}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_BUSINESS_DATE}::date,
      'folio', ${fixture.folio_id}::uuid, 'folio.charge_posted', 1,
      ${DEMO_ACTOR_ID}::uuid, ${correlationId}::uuid,
      ${JSON.stringify({ confirmationNo: DEMO_CONFIRMATION_NO, folioNo: DEMO_FOLIO_NO, chargeKey, amountMinor: charge.amountMinor, journalId })}::jsonb
    )
    RETURNING seq
  `;
  const afterBalance = await readFolioBalance(tx, fixture.folio_id);
  const lineCount = await postingLineCount(tx, journalId);
  return buildProof(fixture, chargeKey, journalId, charge.amountMinor, lineCount, beforeBalance, afterBalance, String(outboxRows[0]?.seq ?? ""), correlationId, false);
}

async function readFixture(tx: Tx): Promise<FixtureRow> {
  const rows = await tx<FixtureRow[]>`
    SELECT reservation.id::text AS reservation_id,
           reservation.status AS reservation_status,
           folio.id::text AS folio_id,
           folio.status AS folio_status,
           guest_account.id::text AS guest_account_id,
           revenue_account.id::text AS revenue_account_id
      FROM reservation
      JOIN folio ON folio.tenant_id = reservation.tenant_id AND folio.reservation_id = reservation.id
      JOIN account guest_account ON guest_account.tenant_id = reservation.tenant_id AND guest_account.id = folio.account_id
      JOIN account revenue_account ON revenue_account.tenant_id = reservation.tenant_id AND revenue_account.id = ${DEMO_IDS.revenueAccount}::uuid
      JOIN tx_code ON tx_code.code = 'DEMOFOOD'
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
  if (row === undefined) throw new Error("provisioned demo cashier fixture is missing");
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

async function readExistingJournal(tx: Tx, chargeKey: DemoCashierChargeKey): Promise<string | null> {
  const rows = await tx<JournalRow[]>`
    SELECT id::text
      FROM journal
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND source @> ${JSON.stringify({ demoCommand: "cashier-posting", chargeKey })}::jsonb
     ORDER BY created_at
     LIMIT 1
  `;
  return rows[0]?.id ?? null;
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
  chargeKey: DemoCashierChargeKey,
  journalId: string | null,
  amountMinor: number,
  postingLineCountValue: number,
  beforeBalanceMinor: string,
  afterBalanceMinor: string,
  outboxSeq: string | null,
  correlationId: string | null,
  replayed: boolean,
): NonNullable<GovernedCashierPostingResult["proof"]> {
  return Object.freeze({
    tenantId: DEMO_TENANT_ID,
    propertyNode: DEMO_PROPERTY_NODE,
    confirmationNo: DEMO_CONFIRMATION_NO,
    folioNo: DEMO_FOLIO_NO,
    chargeKey,
    journalId,
    amountMinor,
    postingLineCount: postingLineCountValue,
    beforeBalanceMinor,
    afterBalanceMinor,
    outboxEventType: replayed ? null : "folio.charge_posted",
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
  proof: GovernedCashierPostingResult["proof"],
): GovernedCashierPostingResult {
  return Object.freeze({
    actionId: "post-charge" as const,
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

function normalizeChargeKey(value: string | undefined): DemoCashierChargeKey | null {
  const normalized = (value ?? "dinner-charge-001").trim().toLowerCase();
  return normalized === "dinner-charge-001" || normalized === "laundry-charge-001" ? normalized : null;
}
