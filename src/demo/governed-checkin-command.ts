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

export interface GovernedCheckInCommandInput {
  readonly confirmationNo?: string;
  readonly roomCode?: string;
  readonly confirmationPhrase?: string;
  readonly databaseUrl?: string;
}

export interface GovernedCheckInCommandResult {
  readonly actionId: "check-in-arrival";
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
    readonly roomCode: string;
    readonly reservationId: string;
    readonly segmentId: string;
    readonly spaceId: string;
    readonly beforeReservationStatus: string;
    readonly afterReservationStatus: "in_house";
    readonly beforeSegmentStatus: string;
    readonly afterSegmentStatus: "in_house";
    readonly occupancyRecorded: boolean;
    readonly occupancyRowsForSegment: number;
    readonly outboxEventType: "reservation.checked_in";
    readonly outboxSeq: string;
    readonly correlationId: string;
  };
}

interface FixtureRow {
  readonly reservation_id: string;
  readonly segment_id: string;
  readonly space_id: string;
  readonly reservation_status: string;
  readonly segment_status: string;
  readonly unit_condition: string;
  readonly period: string;
}

interface CountRow {
  readonly count: string | number | bigint;
}

interface OutboxRow {
  readonly seq: string | number | bigint;
}

export async function executeGovernedCheckInCommand(
  input: GovernedCheckInCommandInput,
): Promise<GovernedCheckInCommandResult> {
  const confirmationNo = normalizeConfirmationNo(input.confirmationNo);
  const roomCode = normalizeRoomCode(input.roomCode);
  const databaseConfigured = input.databaseUrl !== undefined && input.databaseUrl.trim() !== "";
  const confirmed = input.confirmationPhrase === CONFIRMATION_PHRASE;

  if (!confirmed) {
    return result(false, false, false, databaseConfigured, "Exact confirmation phrase is required before any database mutation.", null);
  }
  if (confirmationNo !== DEMO_CONFIRMATION_NO || roomCode !== DEMO_ROOM_CODE) {
    return result(true, false, false, databaseConfigured, "This governed check-in command is limited to the provisioned public-demo arrival fixture.", null);
  }
  if (!databaseConfigured) {
    return result(true, false, false, false, "DATABASE_URL is not configured for governed command execution.", null);
  }

  const database = Database.connect(input.databaseUrl ?? "", { maxConnections: 1, prepare: false });
  try {
    const proof = await database.withTenantTransaction(DEMO_TENANT_ID, async (tx) => executeInTransaction(tx));
    return result(true, proof.occupancyRecorded, proof.occupancyRecorded, true, proof.occupancyRecorded ? "Governed check-in executed and reread from PostgreSQL." : "Arrival was already checked in; authoritative state reread from PostgreSQL.", proof);
  } finally {
    database.close();
  }
}

async function executeInTransaction(tx: Tx): Promise<NonNullable<GovernedCheckInCommandResult["proof"]>> {
  const before = await readFixture(tx);
  if (before.unit_condition !== "clean" && before.unit_condition !== "inspected") {
    throw new Error(`room ${DEMO_ROOM_CODE} must be clean or inspected before check-in`);
  }
  const existingOccupancy = await occupancyCount(tx, before.segment_id);
  if (before.reservation_status === "in_house" && before.segment_status === "in_house" && existingOccupancy > 0) {
    return buildProof(before, before, false, existingOccupancy, "", "");
  }
  if (before.reservation_status !== "due_in" || before.segment_status !== "booked") {
    throw new Error(`arrival fixture is not eligible for check-in: reservation=${before.reservation_status} segment=${before.segment_status}`);
  }

  await tx`
    SELECT record_occupancy(
      ${DEMO_TENANT_ID}::uuid,
      ${before.space_id}::uuid,
      ${before.period}::tstzrange,
      ${before.segment_id}::uuid,
      'segment',
      true
    )
  `;
  await tx`
    UPDATE reservation
       SET status = 'in_house'
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND id = ${before.reservation_id}::uuid
       AND status = 'due_in'
  `;
  await tx`
    UPDATE reservation_segment
       SET status = 'in_house'
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND id = ${before.segment_id}::uuid
       AND status = 'booked'
  `;
  const correlationId = crypto.randomUUID();
  const outboxRows = await tx<OutboxRow[]>`
    INSERT INTO outbox (
      id, tenant_id, property_node, business_date, aggregate_type, aggregate_id,
      event_type, event_version, actor_id, correlation_id, payload
    )
    VALUES (
      ${crypto.randomUUID()}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_BUSINESS_DATE}::date,
      'reservation', ${before.reservation_id}::uuid, 'reservation.checked_in', 1,
      ${DEMO_ACTOR_ID}::uuid, ${correlationId}::uuid,
      ${JSON.stringify({ confirmationNo: DEMO_CONFIRMATION_NO, roomCode: DEMO_ROOM_CODE, segmentId: before.segment_id })}::jsonb
    )
    RETURNING seq
  `;
  const after = await readFixture(tx);
  const count = await occupancyCount(tx, before.segment_id);
  return buildProof(before, after, true, count, String(outboxRows[0]?.seq ?? ""), correlationId);
}

async function readFixture(tx: Tx): Promise<FixtureRow> {
  const rows = await tx<FixtureRow[]>`
    SELECT reservation.id::text AS reservation_id,
           segment.id::text AS segment_id,
           space.id::text AS space_id,
           reservation.status AS reservation_status,
           segment.status AS segment_status,
           condition.condition AS unit_condition,
           segment.period::text AS period
      FROM reservation
      JOIN reservation_segment segment ON segment.tenant_id = reservation.tenant_id AND segment.reservation_id = reservation.id
      JOIN sellable_unit_space sus ON sus.tenant_id = reservation.tenant_id AND sus.sellable_unit_id = segment.sellable_unit_id
      JOIN space ON space.id = sus.space_id AND space.tenant_id = reservation.tenant_id
      JOIN unit_condition condition ON condition.tenant_id = reservation.tenant_id AND condition.space_id = space.id
      JOIN folio ON folio.tenant_id = reservation.tenant_id AND folio.reservation_id = reservation.id AND folio.status = 'open'
     WHERE reservation.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND reservation.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND reservation.confirmation_no = ${DEMO_CONFIRMATION_NO}
       AND segment.id = ${DEMO_IDS.segment}::uuid
       AND space.code = ${DEMO_ROOM_CODE}
     LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) throw new Error("provisioned demo arrival fixture is missing");
  return row;
}

async function occupancyCount(tx: Tx, segmentId: string): Promise<number> {
  const rows = await tx<CountRow[]>`
    SELECT count(*) AS count
      FROM space_occupancy
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND slot_ref = ${segmentId}::uuid
       AND slot_kind = 'segment'
  `;
  return Number(rows[0]?.count ?? 0);
}

function buildProof(
  before: FixtureRow,
  after: FixtureRow,
  occupancyRecorded: boolean,
  occupancyRowsForSegment: number,
  outboxSeq: string,
  correlationId: string,
): NonNullable<GovernedCheckInCommandResult["proof"]> {
  return Object.freeze({
    tenantId: DEMO_TENANT_ID,
    propertyNode: DEMO_PROPERTY_NODE,
    confirmationNo: DEMO_CONFIRMATION_NO,
    roomCode: DEMO_ROOM_CODE,
    reservationId: before.reservation_id,
    segmentId: before.segment_id,
    spaceId: before.space_id,
    beforeReservationStatus: before.reservation_status,
    afterReservationStatus: after.reservation_status as "in_house",
    beforeSegmentStatus: before.segment_status,
    afterSegmentStatus: after.segment_status as "in_house",
    occupancyRecorded,
    occupancyRowsForSegment,
    outboxEventType: "reservation.checked_in" as const,
    outboxSeq,
    correlationId,
  });
}

function result(
  confirmed: boolean,
  executed: boolean,
  realPmsExecuted: boolean,
  databaseConfigured: boolean,
  reason: string,
  proof: GovernedCheckInCommandResult["proof"],
): GovernedCheckInCommandResult {
  return Object.freeze({
    actionId: "check-in-arrival" as const,
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

function normalizeRoomCode(value: string | undefined): string {
  return (value ?? DEMO_ROOM_CODE).trim().toUpperCase();
}
