import { Database, type Tx } from "../kernel";
import {
  DEMO_ACTOR_ID,
  DEMO_BUSINESS_DATE,
  DEMO_CONFIRMATION_NO,
  DEMO_IDS,
  DEMO_PROPERTY_NODE,
  DEMO_ROOM_CODE,
  DEMO_TENANT_ID,
} from "./demo-arrival-fixture";

const CONFIRMATION_PHRASE = "CONFIRM YELLOW OPERATION";
const DEMO_FOLIO_NO = "FOL-DEMO-303";

export interface GovernedCheckoutInput {
  readonly confirmationNo?: string;
  readonly folioNo?: string;
  readonly roomCode?: string;
  readonly confirmationPhrase?: string;
  readonly databaseUrl?: string;
}

export interface GovernedCheckoutResult {
  readonly actionId: "complete-checkout";
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
    readonly roomCode: string;
    readonly reservationId: string;
    readonly segmentId: string;
    readonly folioId: string;
    readonly beforeReservationStatus: string;
    readonly afterReservationStatus: string;
    readonly beforeSegmentStatus: string;
    readonly afterSegmentStatus: string;
    readonly beforeFolioStatus: string;
    readonly afterFolioStatus: string;
    readonly beforeBalanceMinor: string;
    readonly afterBalanceMinor: string;
    readonly releasedOccupancyRows: number;
    readonly remainingOccupancyRows: number;
    readonly outboxEventType: "reservation.checked_out" | null;
    readonly outboxSeq: string | null;
    readonly correlationId: string | null;
    readonly replayed: boolean;
  };
}

interface FixtureRow {
  readonly reservation_id: string;
  readonly reservation_status: string;
  readonly segment_id: string;
  readonly segment_status: string;
  readonly folio_id: string;
  readonly folio_status: string;
}

interface BalanceRow {
  readonly balance_minor: string | number | bigint | null;
}

interface CountRow {
  readonly count: string | number | bigint;
}

interface ReleaseRow {
  readonly released: string | number | bigint;
}

interface OutboxRow {
  readonly seq: string | number | bigint;
}

export async function executeGovernedCheckout(input: GovernedCheckoutInput): Promise<GovernedCheckoutResult> {
  const confirmationNo = normalizeConfirmationNo(input.confirmationNo);
  const folioNo = normalizeFolioNo(input.folioNo);
  const roomCode = normalizeRoomCode(input.roomCode);
  const databaseConfigured = input.databaseUrl !== undefined && input.databaseUrl.trim() !== "";
  const confirmed = input.confirmationPhrase === CONFIRMATION_PHRASE;

  if (!confirmed) {
    return result(false, false, false, databaseConfigured, "Exact confirmation phrase is required before any database mutation.", null);
  }
  if (confirmationNo !== DEMO_CONFIRMATION_NO || folioNo !== DEMO_FOLIO_NO || roomCode !== DEMO_ROOM_CODE) {
    return result(true, false, false, databaseConfigured, "This governed checkout command is limited to the fixed public-demo reservation, folio and room.", null);
  }
  if (!databaseConfigured) {
    return result(true, false, false, false, "DATABASE_URL is not configured for governed command execution.", null);
  }

  const database = Database.connect(input.databaseUrl ?? "", { maxConnections: 1, prepare: false });
  try {
    const proof = await database.withTenantTransaction(DEMO_TENANT_ID, async (tx) => executeInTransaction(tx));
    const reason = proof.replayed
      ? "Checkout was already completed; authoritative reservation state reread from PostgreSQL."
      : "Governed checkout completed and reread from PostgreSQL.";
    return result(true, !proof.replayed, !proof.replayed, true, reason, proof);
  } finally {
    database.close();
  }
}

async function executeInTransaction(tx: Tx): Promise<NonNullable<GovernedCheckoutResult["proof"]>> {
  const before = await readFixture(tx);
  const beforeBalance = await readFolioBalance(tx, before.folio_id);
  if (before.reservation_status === "checked_out" && before.segment_status === "departed" && before.folio_status === "closed") {
    const remainingOccupancy = await occupancyCount(tx, before.segment_id);
    const outboxSeq = await existingCheckoutOutboxSeq(tx, before.reservation_id);
    return buildProof(before, before, beforeBalance, beforeBalance, 0, remainingOccupancy, outboxSeq, null, true);
  }
  if (before.reservation_status !== "in_house" && before.reservation_status !== "due_out") {
    throw new Error(`reservation ${DEMO_CONFIRMATION_NO} is not eligible for checkout from ${before.reservation_status}`);
  }
  if (before.segment_status !== "in_house") {
    throw new Error(`reservation segment is not in_house`);
  }
  if (before.folio_status !== "open" && before.folio_status !== "settled") {
    throw new Error(`folio ${DEMO_FOLIO_NO} is not open or settled`);
  }
  if (BigInt(beforeBalance) !== 0n) {
    throw new Error(`folio ${DEMO_FOLIO_NO} has non-zero balance ${beforeBalance}`);
  }

  const releaseRows = await tx<ReleaseRow[]>`
    SELECT release_occupancy(${DEMO_TENANT_ID}::uuid, ${before.segment_id}::uuid)::text AS released
  `;
  const releasedOccupancyRows = Number(releaseRows[0]?.released ?? 0);
  await tx`
    UPDATE reservation_segment
       SET status = 'departed'
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND id = ${before.segment_id}::uuid
  `;
  await tx`
    UPDATE reservation
       SET status = 'checked_out'
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND id = ${before.reservation_id}::uuid
  `;
  await tx`
    UPDATE folio
       SET status = 'closed'
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND id = ${before.folio_id}::uuid
  `;
  const correlationId = crypto.randomUUID();
  const outboxRows = await tx<OutboxRow[]>`
    INSERT INTO outbox (
      id, tenant_id, property_node, business_date, aggregate_type, aggregate_id,
      event_type, event_version, actor_id, correlation_id, payload
    )
    VALUES (
      ${crypto.randomUUID()}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_BUSINESS_DATE}::date,
      'reservation', ${before.reservation_id}::uuid, 'reservation.checked_out', 1,
      ${DEMO_ACTOR_ID}::uuid, ${correlationId}::uuid,
      ${JSON.stringify({ confirmationNo: DEMO_CONFIRMATION_NO, folioNo: DEMO_FOLIO_NO, roomCode: DEMO_ROOM_CODE, segmentId: before.segment_id, releasedOccupancyRows })}::jsonb
    )
    RETURNING seq
  `;

  const after = await readFixture(tx);
  const afterBalance = await readFolioBalance(tx, before.folio_id);
  const remainingOccupancy = await occupancyCount(tx, before.segment_id);
  return buildProof(before, after, beforeBalance, afterBalance, releasedOccupancyRows, remainingOccupancy, String(outboxRows[0]?.seq ?? ""), correlationId, false);
}

async function readFixture(tx: Tx): Promise<FixtureRow> {
  const rows = await tx<FixtureRow[]>`
    SELECT reservation.id::text AS reservation_id,
           reservation.status AS reservation_status,
           segment.id::text AS segment_id,
           segment.status AS segment_status,
           folio.id::text AS folio_id,
           folio.status AS folio_status
      FROM reservation
      JOIN reservation_segment segment ON segment.tenant_id = reservation.tenant_id AND segment.reservation_id = reservation.id
      JOIN folio ON folio.tenant_id = reservation.tenant_id AND folio.reservation_id = reservation.id
      JOIN space ON space.tenant_id = reservation.tenant_id
                AND space.property_node = reservation.property_node
                AND space.code = ${DEMO_ROOM_CODE}
     WHERE reservation.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND reservation.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND reservation.confirmation_no = ${DEMO_CONFIRMATION_NO}
       AND segment.id = ${DEMO_IDS.segment}::uuid
       AND folio.folio_no = ${DEMO_FOLIO_NO}
     LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) throw new Error("provisioned demo checkout fixture is missing");
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

async function occupancyCount(tx: Tx, segmentId: string): Promise<number> {
  const rows = await tx<CountRow[]>`
    SELECT count(*) AS count
      FROM space_occupancy
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND slot_ref = ${segmentId}::uuid
  `;
  return Number(rows[0]?.count ?? 0);
}

async function existingCheckoutOutboxSeq(tx: Tx, reservationId: string): Promise<string | null> {
  const rows = await tx<OutboxRow[]>`
    SELECT seq
      FROM outbox
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND aggregate_type = 'reservation'
       AND aggregate_id = ${reservationId}::uuid
       AND event_type = 'reservation.checked_out'
     ORDER BY seq
     LIMIT 1
  `;
  return rows[0]?.seq === undefined ? null : String(rows[0].seq);
}

function buildProof(
  before: FixtureRow,
  after: FixtureRow,
  beforeBalanceMinor: string,
  afterBalanceMinor: string,
  releasedOccupancyRows: number,
  remainingOccupancyRows: number,
  outboxSeq: string | null,
  correlationId: string | null,
  replayed: boolean,
): NonNullable<GovernedCheckoutResult["proof"]> {
  return Object.freeze({
    tenantId: DEMO_TENANT_ID,
    propertyNode: DEMO_PROPERTY_NODE,
    confirmationNo: DEMO_CONFIRMATION_NO,
    folioNo: DEMO_FOLIO_NO,
    roomCode: DEMO_ROOM_CODE,
    reservationId: before.reservation_id,
    segmentId: before.segment_id,
    folioId: before.folio_id,
    beforeReservationStatus: before.reservation_status,
    afterReservationStatus: after.reservation_status,
    beforeSegmentStatus: before.segment_status,
    afterSegmentStatus: after.segment_status,
    beforeFolioStatus: before.folio_status,
    afterFolioStatus: after.folio_status,
    beforeBalanceMinor,
    afterBalanceMinor,
    releasedOccupancyRows,
    remainingOccupancyRows,
    outboxEventType: replayed ? null : "reservation.checked_out",
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
  proof: GovernedCheckoutResult["proof"],
): GovernedCheckoutResult {
  return Object.freeze({
    actionId: "complete-checkout" as const,
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

function normalizeRoomCode(value: string | undefined): string {
  return (value ?? DEMO_ROOM_CODE).trim().toUpperCase();
}
