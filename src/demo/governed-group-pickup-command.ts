import { Database, type Tx } from "../kernel";
import { DEMO_ACTOR_ID, DEMO_BUSINESS_DATE, DEMO_PROPERTY_NODE, DEMO_TENANT_ID } from "./demo-arrival-fixture";
import { DEMO_GROUP_BLOCK_CODE, DEMO_GROUP_IDS, DEMO_GROUP_PICKUP, upsertDemoGroupBlockFixture } from "./demo-group-block-fixture";

const CONFIRMATION_PHRASE = "CONFIRM YELLOW OPERATION";
const ACTION_ID = "pickup-from-block";

export interface GovernedGroupPickupInput {
  readonly blockCode?: string;
  readonly stayDate?: string;
  readonly unitTypeCode?: string;
  readonly quantity?: number;
  readonly confirmationPhrase?: string;
  readonly databaseUrl?: string;
}

export interface GovernedGroupPickupResult {
  readonly actionId: "pickup-from-block";
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
    readonly blockCode: string;
    readonly groupId: string;
    readonly reservationId: string | null;
    readonly segmentId: string | null;
    readonly confirmationNo: string;
    readonly stayDate: string;
    readonly unitTypeCode: string;
    readonly blocked: number;
    readonly pickedUpBefore: number;
    readonly pickedUpAfter: number;
    readonly outboxEventType: "group.pickup_created" | null;
    readonly outboxSeq: string | null;
    readonly correlationId: string | null;
    readonly replayed: boolean;
    readonly blockedReason: string | null;
  };
}

interface PickupStateRow {
  readonly group_id: string;
  readonly group_status: string;
  readonly reservation_id: string | null;
  readonly segment_id: string | null;
  readonly blocked: number;
  readonly picked_up: number;
}

interface OutboxRow {
  readonly seq: string | number | bigint;
}

export async function executeGovernedGroupPickup(input: GovernedGroupPickupInput): Promise<GovernedGroupPickupResult> {
  const blockCode = normalizeBlockCode(input.blockCode);
  const stayDate = (input.stayDate ?? DEMO_GROUP_PICKUP.stayDate).trim();
  const unitTypeCode = (input.unitTypeCode ?? DEMO_GROUP_PICKUP.unitTypeCode).trim().toUpperCase();
  const quantity = input.quantity ?? 1;
  const databaseConfigured = input.databaseUrl !== undefined && input.databaseUrl.trim() !== "";
  const confirmed = input.confirmationPhrase === CONFIRMATION_PHRASE;

  if (!confirmed) {
    return result(false, false, false, databaseConfigured, "Exact confirmation phrase is required before any database mutation.", null);
  }
  if (blockCode !== DEMO_GROUP_BLOCK_CODE || stayDate !== DEMO_GROUP_PICKUP.stayDate || unitTypeCode !== DEMO_GROUP_PICKUP.unitTypeCode || quantity !== 1) {
    return result(true, false, false, databaseConfigured, "This governed pickup command is limited to one DLX room on the fixed MEHRA-WED public-demo block date.", null);
  }
  if (!databaseConfigured) {
    return result(true, false, false, false, "DATABASE_URL is not configured for governed command execution.", null);
  }

  const database = Database.connect(input.databaseUrl ?? "", { maxConnections: 1, prepare: false });
  try {
    const proof = await database.withTenantTransaction(DEMO_TENANT_ID, async (tx) => executeInTransaction(tx));
    const blocked = proof.blockedReason !== null;
    const executed = !proof.replayed && !blocked;
    return result(true, executed, executed, true, blocked ? proof.blockedReason ?? "Group pickup is not eligible." : proof.replayed ? "Group pickup already exists; authoritative reservation reread from PostgreSQL." : "Governed group pickup reservation created and reread from PostgreSQL.", proof);
  } finally {
    database.close();
  }
}

async function executeInTransaction(tx: Tx): Promise<NonNullable<GovernedGroupPickupResult["proof"]>> {
  await upsertDemoGroupBlockFixture(tx);
  const before = await readPickupState(tx);
  if (before.group_status !== "definite") {
    return buildProof(before, before, null, null, false, "Group block must be definite before pickup.");
  }
  if (before.reservation_id !== null) {
    const outboxSeq = await existingPickupOutboxSeq(tx, before.reservation_id);
    return buildProof(before, before, outboxSeq, null, true);
  }
  if (before.picked_up >= before.blocked) {
    throw new Error(`group block ${DEMO_GROUP_BLOCK_CODE} has no pickup availability for ${DEMO_GROUP_PICKUP.unitTypeCode} on ${DEMO_GROUP_PICKUP.stayDate}`);
  }

  const reservationId = crypto.randomUUID();
  const segmentId = crypto.randomUUID();
  await tx`
    INSERT INTO reservation (
      id, tenant_id, property_node, confirmation_no, status, primary_party, booker_party,
      group_id, channel_code, market_code, source_code, origin_code, currency, notes
    )
    VALUES (
      ${reservationId}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid,
      ${DEMO_GROUP_PICKUP.confirmationNo}, 'reserved', ${DEMO_GROUP_IDS.pickupGuestParty}::uuid,
      ${DEMO_GROUP_IDS.accountParty}::uuid, ${before.group_id}::uuid, 'direct',
      'GROUPS-SOCIAL', 'EVENTS', 'GROUP_BLOCK', ${DEMO_GROUP_PICKUP.currency},
      'Governed public-demo group pickup from MEHRA-WED'
    )
  `;
  await tx`
    INSERT INTO reservation_segment (
      id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id, period,
      adults, children, rate_plan_id, price_override, status
    )
    VALUES (
      ${segmentId}::uuid, ${DEMO_TENANT_ID}::uuid, ${reservationId}::uuid, 1,
      ${DEMO_GROUP_IDS.pickupUnitType}::uuid, NULL,
      tstzrange(${`${DEMO_GROUP_PICKUP.stayDate}T09:00:00.000Z`}, ${`${DEMO_GROUP_PICKUP.departureDate}T09:00:00.000Z`}, '[)'),
      2, '[]'::jsonb, ${DEMO_GROUP_IDS.pickupRatePlan}::uuid,
      ${JSON.stringify({ amount_minor: DEMO_GROUP_PICKUP.rateMinor, currency: DEMO_GROUP_PICKUP.currency, source: "group_block" })}::jsonb,
      'booked'
    )
  `;
  const after = await readPickupState(tx);
  const correlationId = crypto.randomUUID();
  const outboxRows = await tx<OutboxRow[]>`
    INSERT INTO outbox (
      id, tenant_id, property_node, business_date, aggregate_type, aggregate_id,
      event_type, event_version, actor_id, correlation_id, payload
    )
    VALUES (
      ${crypto.randomUUID()}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_BUSINESS_DATE}::date,
      'reservation_group', ${before.group_id}::uuid, 'group.pickup_created', 1,
      ${DEMO_ACTOR_ID}::uuid, ${correlationId}::uuid,
      ${JSON.stringify({
        blockCode: DEMO_GROUP_BLOCK_CODE,
        confirmationNo: DEMO_GROUP_PICKUP.confirmationNo,
        stayDate: DEMO_GROUP_PICKUP.stayDate,
        unitTypeCode: DEMO_GROUP_PICKUP.unitTypeCode,
        pickedUpBefore: before.picked_up,
        pickedUpAfter: after.picked_up,
      })}::jsonb
    )
    RETURNING seq
  `;
  return buildProof(before, after, String(outboxRows[0]?.seq ?? ""), correlationId, false);
}

async function readPickupState(tx: Tx): Promise<PickupStateRow> {
  const rows = await tx<PickupStateRow[]>`
    WITH picked AS (
      SELECT reservation.id AS reservation_id,
             reservation_segment.id AS segment_id
        FROM reservation
        JOIN reservation_segment ON reservation_segment.tenant_id = reservation.tenant_id
                                AND reservation_segment.reservation_id = reservation.id
       WHERE reservation.tenant_id = ${DEMO_TENANT_ID}::uuid
         AND reservation.property_node = ${DEMO_PROPERTY_NODE}::uuid
         AND reservation.confirmation_no = ${DEMO_GROUP_PICKUP.confirmationNo}
       LIMIT 1
    ),
    pickup_count AS (
      SELECT count(*)::int AS picked_up
        FROM reservation
        JOIN reservation_segment ON reservation_segment.tenant_id = reservation.tenant_id
                                AND reservation_segment.reservation_id = reservation.id
       WHERE reservation.tenant_id = ${DEMO_TENANT_ID}::uuid
         AND reservation.group_id = ${DEMO_GROUP_IDS.group}::uuid
         AND reservation.status IN ('reserved', 'due_in', 'in_house')
         AND reservation_segment.unit_type_id = ${DEMO_GROUP_IDS.pickupUnitType}::uuid
         AND lower(reservation_segment.period)::date = ${DEMO_GROUP_PICKUP.stayDate}::date
         AND reservation_segment.status IN ('booked', 'in_house')
    )
    SELECT reservation_group.id::text AS group_id,
           reservation_group.status AS group_status,
           picked.reservation_id::text AS reservation_id,
           picked.segment_id::text AS segment_id,
           block_allotment.blocked::int AS blocked,
           pickup_count.picked_up::int AS picked_up
      FROM reservation_group
      JOIN block_allotment ON block_allotment.tenant_id = reservation_group.tenant_id
                           AND block_allotment.group_id = reservation_group.id
                           AND block_allotment.unit_type_id = ${DEMO_GROUP_IDS.pickupUnitType}::uuid
                           AND block_allotment.stay_date = ${DEMO_GROUP_PICKUP.stayDate}::date
      CROSS JOIN pickup_count
      LEFT JOIN picked ON true
     WHERE reservation_group.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND reservation_group.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND reservation_group.code = ${DEMO_GROUP_BLOCK_CODE}
     LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) throw new Error("provisioned demo group pickup fixture is missing");
  return row;
}

async function existingPickupOutboxSeq(tx: Tx, reservationId: string): Promise<string | null> {
  const rows = await tx<OutboxRow[]>`
    SELECT seq
      FROM outbox
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND event_type = 'group.pickup_created'
       AND payload @> ${JSON.stringify({ confirmationNo: DEMO_GROUP_PICKUP.confirmationNo })}::jsonb
       AND payload @> ${JSON.stringify({ blockCode: DEMO_GROUP_BLOCK_CODE })}::jsonb
       AND aggregate_type = 'reservation_group'
     ORDER BY seq
     LIMIT 1
  `;
  void reservationId;
  return rows[0]?.seq === undefined ? null : String(rows[0].seq);
}

function buildProof(
  before: PickupStateRow,
  after: PickupStateRow,
  outboxSeq: string | null,
  correlationId: string | null,
  replayed: boolean,
  reason?: string,
): NonNullable<GovernedGroupPickupResult["proof"]> {
  return Object.freeze({
    tenantId: DEMO_TENANT_ID,
    propertyNode: DEMO_PROPERTY_NODE,
    blockCode: DEMO_GROUP_BLOCK_CODE,
    groupId: before.group_id,
    reservationId: after.reservation_id,
    segmentId: after.segment_id,
    confirmationNo: DEMO_GROUP_PICKUP.confirmationNo,
    stayDate: DEMO_GROUP_PICKUP.stayDate,
    unitTypeCode: DEMO_GROUP_PICKUP.unitTypeCode,
    blocked: before.blocked,
    pickedUpBefore: before.picked_up,
    pickedUpAfter: after.picked_up,
    outboxEventType: replayed ? null : "group.pickup_created",
    outboxSeq,
    correlationId,
    replayed,
    blockedReason: reason ?? null,
  });
}

function result(
  confirmed: boolean,
  executed: boolean,
  realPmsExecuted: boolean,
  databaseConfigured: boolean,
  reason: string,
  proof: GovernedGroupPickupResult["proof"],
): GovernedGroupPickupResult {
  return Object.freeze({
    actionId: ACTION_ID,
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

function normalizeBlockCode(value: string | undefined): string {
  return (value ?? DEMO_GROUP_BLOCK_CODE).trim().toUpperCase();
}
