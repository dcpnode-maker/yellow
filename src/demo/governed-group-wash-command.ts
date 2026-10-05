import { Database, type Tx } from "../kernel";
import { DEMO_ACTOR_ID, DEMO_BUSINESS_DATE, DEMO_PROPERTY_NODE, DEMO_TENANT_ID } from "./demo-arrival-fixture";
import { DEMO_GROUP_BLOCK_CODE, DEMO_GROUP_IDS, DEMO_GROUP_PICKUP, upsertDemoGroupBlockFixture } from "./demo-group-block-fixture";

const CONFIRMATION_PHRASE = "CONFIRM YELLOW OPERATION";
const ACTION_ID = "wash-or-release";

export interface GovernedGroupWashInput {
  readonly blockCode?: string;
  readonly stayDate?: string;
  readonly unitTypeCode?: string;
  readonly confirmationPhrase?: string;
  readonly databaseUrl?: string;
}

export interface GovernedGroupWashResult {
  readonly actionId: "wash-or-release";
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
    readonly stayDate: string;
    readonly unitTypeCode: string;
    readonly blockedBefore: number;
    readonly pickedUp: number;
    readonly remainingBeforeWash: number;
    readonly releasePct: number;
    readonly releasedRooms: number;
    readonly blockedAfter: number;
    readonly outboxEventType: "group.wash_applied" | null;
    readonly outboxSeq: string | null;
    readonly correlationId: string | null;
    readonly replayed: boolean;
    readonly blockedReason: string | null;
  };
}

interface WashStateRow {
  readonly group_id: string;
  readonly group_status: string;
  readonly blocked: number;
  readonly picked_up: number;
  readonly wash_schedule: unknown;
}

interface OutboxRow {
  readonly seq: string | number | bigint;
}

export async function executeGovernedGroupWash(input: GovernedGroupWashInput): Promise<GovernedGroupWashResult> {
  const blockCode = normalizeBlockCode(input.blockCode);
  const stayDate = (input.stayDate ?? DEMO_GROUP_PICKUP.stayDate).trim();
  const unitTypeCode = (input.unitTypeCode ?? DEMO_GROUP_PICKUP.unitTypeCode).trim().toUpperCase();
  const databaseConfigured = input.databaseUrl !== undefined && input.databaseUrl.trim() !== "";
  const confirmed = input.confirmationPhrase === CONFIRMATION_PHRASE;

  if (!confirmed) {
    return result(false, false, false, databaseConfigured, "Exact confirmation phrase is required before any database mutation.", null);
  }
  if (blockCode !== DEMO_GROUP_BLOCK_CODE || stayDate !== DEMO_GROUP_PICKUP.stayDate || unitTypeCode !== DEMO_GROUP_PICKUP.unitTypeCode) {
    return result(true, false, false, databaseConfigured, "This governed wash command is limited to the fixed MEHRA-WED DLX public-demo block date.", null);
  }
  if (!databaseConfigured) {
    return result(true, false, false, false, "DATABASE_URL is not configured for governed command execution.", null);
  }

  const database = Database.connect(input.databaseUrl ?? "", { maxConnections: 1, prepare: false });
  try {
    const proof = await database.withTenantTransaction(DEMO_TENANT_ID, async (tx) => executeInTransaction(tx));
    const blocked = proof.blockedReason !== null;
    const executed = !proof.replayed && !blocked;
    return result(true, executed, executed, true, blocked ? proof.blockedReason ?? "Group wash is not eligible." : proof.replayed ? "Group wash was already applied; authoritative allotment reread from PostgreSQL." : "Governed group wash applied and reread from PostgreSQL.", proof);
  } finally {
    database.close();
  }
}

async function executeInTransaction(tx: Tx): Promise<NonNullable<GovernedGroupWashResult["proof"]>> {
  await upsertDemoGroupBlockFixture(tx);
  const before = await readWashState(tx);
  if (before.group_status !== "definite") {
    return buildProof(before, before, 0, 0, null, null, false, "Group block must be definite before wash/release.");
  }
  const releasePct = readReleasePct(before.wash_schedule);
  const existingOutboxSeq = await existingWashOutboxSeq(tx, before.group_id);
  if (existingOutboxSeq !== null) {
    return buildProof(before, before, releasePct, 0, existingOutboxSeq, null, true);
  }
  const remainingBeforeWash = Math.max(0, before.blocked - before.picked_up);
  const releasedRooms = Math.min(remainingBeforeWash, Math.floor((remainingBeforeWash * releasePct) / 100));
  const targetBlocked = Math.max(before.picked_up, before.blocked - releasedRooms);
  if (releasedRooms === 0 || before.blocked === targetBlocked) {
    return buildProof(before, before, releasePct, 0, null, null, true);
  }

  await tx`
    UPDATE block_allotment
       SET blocked = ${targetBlocked}
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND group_id = ${before.group_id}::uuid
       AND unit_type_id = ${DEMO_GROUP_IDS.pickupUnitType}::uuid
       AND stay_date = ${DEMO_GROUP_PICKUP.stayDate}::date
  `;
  const after = await readWashState(tx);
  const correlationId = crypto.randomUUID();
  const outboxRows = await tx<OutboxRow[]>`
    INSERT INTO outbox (
      id, tenant_id, property_node, business_date, aggregate_type, aggregate_id,
      event_type, event_version, actor_id, correlation_id, payload
    )
    VALUES (
      ${crypto.randomUUID()}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_BUSINESS_DATE}::date,
      'reservation_group', ${before.group_id}::uuid, 'group.wash_applied', 1,
      ${DEMO_ACTOR_ID}::uuid, ${correlationId}::uuid,
      ${JSON.stringify({
        blockCode: DEMO_GROUP_BLOCK_CODE,
        stayDate: DEMO_GROUP_PICKUP.stayDate,
        unitTypeCode: DEMO_GROUP_PICKUP.unitTypeCode,
        blockedBefore: before.blocked,
        pickedUp: before.picked_up,
        releasePct,
        releasedRooms,
        blockedAfter: after.blocked,
      })}::jsonb
    )
    RETURNING seq
  `;
  return buildProof(before, after, releasePct, releasedRooms, String(outboxRows[0]?.seq ?? ""), correlationId, false);
}

async function readWashState(tx: Tx): Promise<WashStateRow> {
  const rows = await tx<WashStateRow[]>`
    WITH pickup_count AS (
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
           block_allotment.blocked::int AS blocked,
           pickup_count.picked_up::int AS picked_up,
           reservation_group.wash_schedule AS wash_schedule
      FROM reservation_group
      JOIN block_allotment ON block_allotment.tenant_id = reservation_group.tenant_id
                           AND block_allotment.group_id = reservation_group.id
                           AND block_allotment.unit_type_id = ${DEMO_GROUP_IDS.pickupUnitType}::uuid
                           AND block_allotment.stay_date = ${DEMO_GROUP_PICKUP.stayDate}::date
      CROSS JOIN pickup_count
     WHERE reservation_group.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND reservation_group.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND reservation_group.code = ${DEMO_GROUP_BLOCK_CODE}
     LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) throw new Error("provisioned demo group wash fixture is missing");
  return row;
}

async function existingWashOutboxSeq(tx: Tx, groupId: string): Promise<string | null> {
  const rows = await tx<OutboxRow[]>`
    SELECT seq
      FROM outbox
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND aggregate_type = 'reservation_group'
       AND aggregate_id = ${groupId}::uuid
       AND event_type = 'group.wash_applied'
     ORDER BY seq
     LIMIT 1
  `;
  return rows[0]?.seq === undefined ? null : String(rows[0].seq);
}

function readReleasePct(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  const candidates = value
    .map((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) return 0;
      const releasePct = Reflect.get(item, "release_pct");
      return typeof releasePct === "number" && Number.isFinite(releasePct) ? releasePct : 0;
    })
    .filter((releasePct) => releasePct > 0);
  return candidates.length === 0 ? 0 : Math.max(...candidates);
}

function buildProof(
  before: WashStateRow,
  after: WashStateRow,
  releasePct: number,
  releasedRooms: number,
  outboxSeq: string | null,
  correlationId: string | null,
  replayed: boolean,
  reason?: string,
): NonNullable<GovernedGroupWashResult["proof"]> {
  return Object.freeze({
    tenantId: DEMO_TENANT_ID,
    propertyNode: DEMO_PROPERTY_NODE,
    blockCode: DEMO_GROUP_BLOCK_CODE,
    groupId: before.group_id,
    stayDate: DEMO_GROUP_PICKUP.stayDate,
    unitTypeCode: DEMO_GROUP_PICKUP.unitTypeCode,
    blockedBefore: before.blocked,
    pickedUp: before.picked_up,
    remainingBeforeWash: Math.max(0, before.blocked - before.picked_up),
    releasePct,
    releasedRooms,
    blockedAfter: after.blocked,
    outboxEventType: replayed ? null : "group.wash_applied",
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
  proof: GovernedGroupWashResult["proof"],
): GovernedGroupWashResult {
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
