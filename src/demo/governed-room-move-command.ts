import { Database, type Tx } from "../kernel";
import {
  DEMO_ACTOR_ID,
  DEMO_BUSINESS_DATE,
  DEMO_CONFIRMATION_NO,
  DEMO_IDS,
  DEMO_PROPERTY_NODE,
  DEMO_ROOM_CODE,
  DEMO_ROOM_MOVE_TO_CODE,
  DEMO_TENANT_ID,
  provisionDemoArrivalFixture,
} from "./demo-arrival-fixture";

const CONFIRMATION_PHRASE = "CONFIRM YELLOW OPERATION";
const MOVE_INSTANT = "2026-09-23 18:00:00+05:30";

export interface GovernedRoomMoveInput {
  readonly confirmationNo?: string;
  readonly fromRoomCode?: string;
  readonly toRoomCode?: string;
  readonly confirmationPhrase?: string;
  readonly databaseUrl?: string;
}

export interface GovernedRoomMoveResult {
  readonly actionId: "move-room";
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
    readonly reservationId: string;
    readonly fromRoomCode: string;
    readonly toRoomCode: string;
    readonly oldSegmentId: string;
    readonly newSegmentId: string;
    readonly oldSegmentStatusBefore: string;
    readonly oldSegmentStatusAfter: "departed";
    readonly newSegmentStatusAfter: "in_house";
    readonly oldOccupancyBefore: number;
    readonly oldOccupancyAfter: number;
    readonly newOccupancyAfter: number;
    readonly outboxEventType: "reservation.room_moved" | null;
    readonly outboxSeq: string;
    readonly correlationId: string | null;
    readonly replayed: boolean;
    readonly blockedReason: string | null;
  };
}

interface MoveFixtureRow {
  readonly reservation_id: string;
  readonly old_segment_id: string;
  readonly old_segment_status: string;
  readonly old_period: string;
  readonly old_unit_type_id: string;
  readonly old_rate_plan_id: string;
  readonly old_adults: number;
  readonly old_children: unknown;
  readonly old_space_id: string;
  readonly target_space_id: string;
}

interface MoveReadRow {
  readonly reservation_id: string;
  readonly old_segment_id: string;
  readonly new_segment_id: string;
  readonly old_segment_status: string;
  readonly new_segment_status: string;
}

interface CountRow {
  readonly count: string | number | bigint;
}

interface OutboxRow {
  readonly seq: string | number | bigint;
}

export async function executeGovernedRoomMove(input: GovernedRoomMoveInput): Promise<GovernedRoomMoveResult> {
  const confirmationNo = normalize(input.confirmationNo, DEMO_CONFIRMATION_NO);
  const fromRoomCode = normalize(input.fromRoomCode, DEMO_ROOM_CODE);
  const toRoomCode = normalize(input.toRoomCode, DEMO_ROOM_MOVE_TO_CODE);
  const databaseConfigured = input.databaseUrl !== undefined && input.databaseUrl.trim() !== "";
  const confirmed = input.confirmationPhrase === CONFIRMATION_PHRASE;

  if (!confirmed) {
    return result(false, false, false, databaseConfigured, "Exact confirmation phrase is required before any database mutation.", null);
  }
  if (confirmationNo !== DEMO_CONFIRMATION_NO || fromRoomCode !== DEMO_ROOM_CODE || toRoomCode !== DEMO_ROOM_MOVE_TO_CODE) {
    return result(true, false, false, databaseConfigured, "This governed room move is limited to the fixed public-demo reservation and same-type target room.", null);
  }
  if (!databaseConfigured) {
    return result(true, false, false, false, "DATABASE_URL is not configured for governed command execution.", null);
  }

  await provisionDemoArrivalFixture(input.databaseUrl ?? "");
  const database = Database.connect(input.databaseUrl ?? "", { maxConnections: 1, prepare: false });
  try {
    const proof = await database.withTenantTransaction(DEMO_TENANT_ID, async (tx) => executeInTransaction(tx));
    return result(true, proof.outboxEventType !== null, proof.outboxEventType !== null, true, proof.replayed ? "Room move was already executed; authoritative state reread from PostgreSQL." : proof.blockedReason ?? "Governed room move executed and reread from PostgreSQL.", proof);
  } finally {
    database.close();
  }
}

async function executeInTransaction(tx: Tx): Promise<NonNullable<GovernedRoomMoveResult["proof"]>> {
  const replay = await readMovedState(tx);
  if (replay !== null) {
    const oldOccupancyAfter = await occupancyCount(tx, replay.old_segment_id);
    const newOccupancyAfter = await occupancyCount(tx, replay.new_segment_id);
    const seq = await latestMoveOutboxSeq(tx);
    return buildProof({
      reservationId: replay.reservation_id,
      oldSegmentId: replay.old_segment_id,
      newSegmentId: replay.new_segment_id,
      oldSegmentStatusBefore: replay.old_segment_status,
      oldSegmentStatusAfter: replay.old_segment_status,
      newSegmentStatusAfter: replay.new_segment_status,
      oldOccupancyBefore: oldOccupancyAfter,
      oldOccupancyAfter,
      newOccupancyAfter,
      outboxEventType: null,
      outboxSeq: seq,
      correlationId: null,
      replayed: true,
      blockedReason: null,
    });
  }

  const fixture = await readMoveFixture(tx);
  const oldOccupancyBefore = await occupancyCount(tx, fixture.old_segment_id);
  if (fixture.old_segment_status !== "in_house" || oldOccupancyBefore !== 1) {
    return buildProof({
      reservationId: fixture.reservation_id,
      oldSegmentId: fixture.old_segment_id,
      newSegmentId: DEMO_IDS.roomMoveSegment,
      oldSegmentStatusBefore: fixture.old_segment_status,
      oldSegmentStatusAfter: "departed",
      newSegmentStatusAfter: "in_house",
      oldOccupancyBefore,
      oldOccupancyAfter: oldOccupancyBefore,
      newOccupancyAfter: 0,
      outboxEventType: null,
      outboxSeq: "",
      correlationId: null,
      replayed: false,
      blockedReason: "Reservation must be checked in before room move.",
    });
  }

  await tx`SELECT release_occupancy(${DEMO_TENANT_ID}::uuid, ${fixture.old_segment_id}::uuid)`;
  await tx`
    UPDATE reservation_segment
       SET status = 'departed',
           period = tstzrange(lower(period), ${MOVE_INSTANT}::timestamptz, '[)')
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND id = ${fixture.old_segment_id}::uuid
       AND status = 'in_house'
  `;
  await tx`
    INSERT INTO reservation_segment (
      id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id, period,
      adults, children, rate_plan_id, status
    )
    VALUES (
      ${DEMO_IDS.roomMoveSegment}::uuid, ${DEMO_TENANT_ID}::uuid, ${fixture.reservation_id}::uuid, 2,
      ${fixture.old_unit_type_id}::uuid, ${DEMO_IDS.roomMoveSellableUnit}::uuid,
      tstzrange(${MOVE_INSTANT}::timestamptz, upper(${fixture.old_period}::tstzrange), '[)'),
      ${fixture.old_adults}, ${JSON.stringify(fixture.old_children)}::jsonb, ${fixture.old_rate_plan_id}::uuid, 'in_house'
    )
  `;
  await tx`
    SELECT record_occupancy(
      ${DEMO_TENANT_ID}::uuid,
      ${fixture.target_space_id}::uuid,
      (SELECT period FROM reservation_segment WHERE id = ${DEMO_IDS.roomMoveSegment}::uuid),
      ${DEMO_IDS.roomMoveSegment}::uuid,
      'segment',
      true
    )
  `;
  const correlationId = crypto.randomUUID();
  const outboxRows = await tx<OutboxRow[]>`
    INSERT INTO outbox (
      id, tenant_id, property_node, business_date, aggregate_type, aggregate_id,
      event_type, event_version, actor_id, correlation_id, payload
    )
    VALUES (
      ${crypto.randomUUID()}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_BUSINESS_DATE}::date,
      'reservation', ${fixture.reservation_id}::uuid, 'reservation.room_moved', 1,
      ${DEMO_ACTOR_ID}::uuid, ${correlationId}::uuid,
      ${JSON.stringify({
        confirmationNo: DEMO_CONFIRMATION_NO,
        fromRoomCode: DEMO_ROOM_CODE,
        toRoomCode: DEMO_ROOM_MOVE_TO_CODE,
        oldSegmentId: fixture.old_segment_id,
        newSegmentId: DEMO_IDS.roomMoveSegment,
      })}::jsonb
    )
    RETURNING seq
  `;
  const moved = await readMovedState(tx);
  if (moved === null) throw new Error("room move did not create the expected in-house segment");
  return buildProof({
    reservationId: fixture.reservation_id,
    oldSegmentId: fixture.old_segment_id,
    newSegmentId: DEMO_IDS.roomMoveSegment,
    oldSegmentStatusBefore: fixture.old_segment_status,
    oldSegmentStatusAfter: "departed",
    newSegmentStatusAfter: "in_house",
    oldOccupancyBefore,
    oldOccupancyAfter: await occupancyCount(tx, fixture.old_segment_id),
    newOccupancyAfter: await occupancyCount(tx, DEMO_IDS.roomMoveSegment),
    outboxEventType: "reservation.room_moved",
    outboxSeq: String(outboxRows[0]?.seq ?? ""),
    correlationId,
    replayed: false,
    blockedReason: null,
  });
}

async function readMoveFixture(tx: Tx): Promise<MoveFixtureRow> {
  const rows = await tx<MoveFixtureRow[]>`
    SELECT reservation.id::text AS reservation_id,
           segment.id::text AS old_segment_id,
           segment.status AS old_segment_status,
           segment.period::text AS old_period,
           segment.unit_type_id::text AS old_unit_type_id,
           segment.rate_plan_id::text AS old_rate_plan_id,
           segment.adults::int AS old_adults,
           segment.children AS old_children,
           old_space.id::text AS old_space_id,
           target_space.id::text AS target_space_id
      FROM reservation
      JOIN reservation_segment segment ON segment.tenant_id = reservation.tenant_id AND segment.reservation_id = reservation.id
      JOIN sellable_unit_space old_sus ON old_sus.tenant_id = reservation.tenant_id AND old_sus.sellable_unit_id = segment.sellable_unit_id
      JOIN space old_space ON old_space.tenant_id = reservation.tenant_id AND old_space.id = old_sus.space_id
      JOIN sellable_unit_space target_sus ON target_sus.tenant_id = reservation.tenant_id AND target_sus.sellable_unit_id = ${DEMO_IDS.roomMoveSellableUnit}::uuid
      JOIN space target_space ON target_space.tenant_id = reservation.tenant_id AND target_space.id = target_sus.space_id
     WHERE reservation.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND reservation.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND reservation.confirmation_no = ${DEMO_CONFIRMATION_NO}
       AND segment.id = ${DEMO_IDS.segment}::uuid
       AND old_space.code = ${DEMO_ROOM_CODE}
       AND target_space.code = ${DEMO_ROOM_MOVE_TO_CODE}
     LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) throw new Error("room move fixture is missing");
  return row;
}

async function readMovedState(tx: Tx): Promise<MoveReadRow | null> {
  const rows = await tx<MoveReadRow[]>`
    SELECT reservation.id::text AS reservation_id,
           old_segment.id::text AS old_segment_id,
           moved_segment.id::text AS new_segment_id,
           old_segment.status AS old_segment_status,
           moved_segment.status AS new_segment_status
      FROM reservation
      JOIN reservation_segment old_segment ON old_segment.tenant_id = reservation.tenant_id AND old_segment.reservation_id = reservation.id AND old_segment.id = ${DEMO_IDS.segment}::uuid
      JOIN reservation_segment moved_segment ON moved_segment.tenant_id = reservation.tenant_id AND moved_segment.reservation_id = reservation.id AND moved_segment.id = ${DEMO_IDS.roomMoveSegment}::uuid
     WHERE reservation.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND reservation.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND reservation.confirmation_no = ${DEMO_CONFIRMATION_NO}
       AND old_segment.status = 'departed'
       AND moved_segment.status = 'in_house'
     LIMIT 1
  `;
  return rows[0] ?? null;
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

async function latestMoveOutboxSeq(tx: Tx): Promise<string> {
  const rows = await tx<OutboxRow[]>`
    SELECT seq
      FROM outbox
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND event_type = 'reservation.room_moved'
       AND payload @> ${JSON.stringify({ confirmationNo: DEMO_CONFIRMATION_NO })}::jsonb
     ORDER BY seq DESC
     LIMIT 1
  `;
  return String(rows[0]?.seq ?? "");
}

function buildProof(values: {
  readonly reservationId: string;
  readonly oldSegmentId: string;
  readonly newSegmentId: string;
  readonly oldSegmentStatusBefore: string;
  readonly oldSegmentStatusAfter: string;
  readonly newSegmentStatusAfter: string;
  readonly oldOccupancyBefore: number;
  readonly oldOccupancyAfter: number;
  readonly newOccupancyAfter: number;
  readonly outboxEventType: "reservation.room_moved" | null;
  readonly outboxSeq: string;
  readonly correlationId: string | null;
  readonly replayed: boolean;
  readonly blockedReason: string | null;
}): NonNullable<GovernedRoomMoveResult["proof"]> {
  return Object.freeze({
    tenantId: DEMO_TENANT_ID,
    propertyNode: DEMO_PROPERTY_NODE,
    confirmationNo: DEMO_CONFIRMATION_NO,
    reservationId: values.reservationId,
    fromRoomCode: DEMO_ROOM_CODE,
    toRoomCode: DEMO_ROOM_MOVE_TO_CODE,
    oldSegmentId: values.oldSegmentId,
    newSegmentId: values.newSegmentId,
    oldSegmentStatusBefore: values.oldSegmentStatusBefore,
    oldSegmentStatusAfter: values.oldSegmentStatusAfter as "departed",
    newSegmentStatusAfter: values.newSegmentStatusAfter as "in_house",
    oldOccupancyBefore: values.oldOccupancyBefore,
    oldOccupancyAfter: values.oldOccupancyAfter,
    newOccupancyAfter: values.newOccupancyAfter,
    outboxEventType: values.outboxEventType,
    outboxSeq: values.outboxSeq,
    correlationId: values.correlationId,
    replayed: values.replayed,
    blockedReason: values.blockedReason,
  });
}

function result(
  confirmed: boolean,
  executed: boolean,
  realPmsExecuted: boolean,
  databaseConfigured: boolean,
  reason: string,
  proof: GovernedRoomMoveResult["proof"],
): GovernedRoomMoveResult {
  return Object.freeze({
    actionId: "move-room" as const,
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

function normalize(value: string | undefined, fallback: string): string {
  return (value ?? fallback).trim().toUpperCase();
}
