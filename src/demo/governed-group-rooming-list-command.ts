import { Database, type Tx } from "../kernel";
import { DEMO_ACTOR_ID, DEMO_BUSINESS_DATE, DEMO_PROPERTY_NODE, DEMO_TENANT_ID } from "./demo-arrival-fixture";
import { DEMO_GROUP_BLOCK_CODE, DEMO_GROUP_IDS, DEMO_GROUP_PICKUP, upsertDemoGroupBlockFixture } from "./demo-group-block-fixture";

const CONFIRMATION_PHRASE = "CONFIRM YELLOW OPERATION";
const ACTION_ID = "import-rooming-list";

export interface GovernedGroupRoomingListImportInput {
  readonly blockCode?: string;
  readonly confirmationNo?: string;
  readonly confirmationPhrase?: string;
  readonly databaseUrl?: string;
}

export interface GovernedGroupRoomingListImportResult {
  readonly actionId: "import-rooming-list";
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
    readonly groupId: string | null;
    readonly reservationId: string | null;
    readonly confirmationNo: string;
    readonly guestLinksBefore: number;
    readonly guestLinksAfter: number;
    readonly importedGuestNames: readonly string[];
    readonly outboxEventType: "group.rooming_list_imported" | null;
    readonly outboxSeq: string | null;
    readonly correlationId: string | null;
    readonly replayed: boolean;
    readonly blockedReason: string | null;
  };
}

interface RoomingListStateRow {
  readonly group_id: string | null;
  readonly reservation_id: string | null;
  readonly guest_links: number;
}

interface OutboxRow {
  readonly seq: string | number | bigint;
}

const IMPORTED_GUEST_NAMES = Object.freeze(["Mehra Wedding Guest 01", "Mehra Wedding Guest 02"]);

export async function executeGovernedGroupRoomingListImport(
  input: GovernedGroupRoomingListImportInput,
): Promise<GovernedGroupRoomingListImportResult> {
  const blockCode = normalizeBlockCode(input.blockCode);
  const confirmationNo = (input.confirmationNo ?? DEMO_GROUP_PICKUP.confirmationNo).trim().toUpperCase();
  const databaseConfigured = input.databaseUrl !== undefined && input.databaseUrl.trim() !== "";
  const confirmed = input.confirmationPhrase === CONFIRMATION_PHRASE;

  if (!confirmed) {
    return result(false, false, false, databaseConfigured, "Exact confirmation phrase is required before any database mutation.", null);
  }
  if (blockCode !== DEMO_GROUP_BLOCK_CODE || confirmationNo !== DEMO_GROUP_PICKUP.confirmationNo) {
    return result(true, false, false, databaseConfigured, "This governed rooming-list import is limited to the fixed MEHRA-WED public-demo pickup reservation.", null);
  }
  if (!databaseConfigured) {
    return result(true, false, false, false, "DATABASE_URL is not configured for governed command execution.", null);
  }

  const database = Database.connect(input.databaseUrl ?? "", { maxConnections: 1, prepare: false });
  try {
    const proof = await database.withTenantTransaction(DEMO_TENANT_ID, async (tx) => executeInTransaction(tx));
    const blocked = proof.blockedReason !== null;
    const executed = !proof.replayed && !blocked;
    return result(true, executed, executed, true, blocked ? proof.blockedReason ?? "Rooming-list import is not eligible." : proof.replayed ? "Rooming list was already imported; authoritative guest links reread from PostgreSQL." : "Governed group rooming-list import created and reread from PostgreSQL.", proof);
  } finally {
    database.close();
  }
}

async function executeInTransaction(tx: Tx): Promise<NonNullable<GovernedGroupRoomingListImportResult["proof"]>> {
  await upsertDemoGroupBlockFixture(tx);
  const before = await readRoomingListState(tx);
  if (before.reservation_id === null || before.group_id === null) {
    return buildProof(before, before, null, null, false, "Pickup reservation must exist before rooming-list import.");
  }
  const existingOutboxSeq = await existingRoomingListOutboxSeq(tx, before.group_id, before.reservation_id);
  if (existingOutboxSeq !== null) {
    return buildProof(before, before, existingOutboxSeq, null, true);
  }

  await tx`
    INSERT INTO reservation_guest (tenant_id, reservation_id, party_id, role, share_pct)
    VALUES
      (${DEMO_TENANT_ID}::uuid, ${before.reservation_id}::uuid, ${DEMO_GROUP_IDS.pickupGuestParty}::uuid, 'primary', 100.00),
      (${DEMO_TENANT_ID}::uuid, ${before.reservation_id}::uuid, ${DEMO_GROUP_IDS.roomingListGuestParty}::uuid, 'accompanying', NULL)
    ON CONFLICT (reservation_id, party_id) DO NOTHING
  `;
  const after = await readRoomingListState(tx);
  const correlationId = crypto.randomUUID();
  const outboxRows = await tx<OutboxRow[]>`
    INSERT INTO outbox (
      id, tenant_id, property_node, business_date, aggregate_type, aggregate_id,
      event_type, event_version, actor_id, correlation_id, payload
    )
    VALUES (
      ${crypto.randomUUID()}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_BUSINESS_DATE}::date,
      'reservation_group', ${before.group_id}::uuid, 'group.rooming_list_imported', 1,
      ${DEMO_ACTOR_ID}::uuid, ${correlationId}::uuid,
      ${JSON.stringify({
        blockCode: DEMO_GROUP_BLOCK_CODE,
        confirmationNo: DEMO_GROUP_PICKUP.confirmationNo,
        reservationId: before.reservation_id,
        guestLinksBefore: before.guest_links,
        guestLinksAfter: after.guest_links,
        importedGuestNames: IMPORTED_GUEST_NAMES,
      })}::jsonb
    )
    RETURNING seq
  `;
  return buildProof(before, after, String(outboxRows[0]?.seq ?? ""), correlationId, false);
}

async function readRoomingListState(tx: Tx): Promise<RoomingListStateRow> {
  const rows = await tx<RoomingListStateRow[]>`
    SELECT reservation.group_id::text AS group_id,
           reservation.id::text AS reservation_id,
           count(reservation_guest.party_id)::int AS guest_links
      FROM reservation
      JOIN reservation_group ON reservation_group.tenant_id = reservation.tenant_id
                            AND reservation_group.id = reservation.group_id
                            AND reservation_group.code = ${DEMO_GROUP_BLOCK_CODE}
      LEFT JOIN reservation_guest ON reservation_guest.tenant_id = reservation.tenant_id
                                 AND reservation_guest.reservation_id = reservation.id
     WHERE reservation.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND reservation.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND reservation.confirmation_no = ${DEMO_GROUP_PICKUP.confirmationNo}
     GROUP BY reservation.group_id, reservation.id
     LIMIT 1
  `;
  return rows[0] ?? { group_id: null, reservation_id: null, guest_links: 0 };
}

async function existingRoomingListOutboxSeq(tx: Tx, groupId: string, reservationId: string): Promise<string | null> {
  const rows = await tx<OutboxRow[]>`
    SELECT seq
      FROM outbox
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND aggregate_type = 'reservation_group'
       AND aggregate_id = ${groupId}::uuid
       AND event_type = 'group.rooming_list_imported'
       AND payload @> ${JSON.stringify({ confirmationNo: DEMO_GROUP_PICKUP.confirmationNo, reservationId })}::jsonb
     ORDER BY seq
     LIMIT 1
  `;
  return rows[0]?.seq === undefined ? null : String(rows[0].seq);
}

function buildProof(
  before: RoomingListStateRow,
  after: RoomingListStateRow,
  outboxSeq: string | null,
  correlationId: string | null,
  replayed: boolean,
  reason?: string,
): NonNullable<GovernedGroupRoomingListImportResult["proof"]> {
  return Object.freeze({
    tenantId: DEMO_TENANT_ID,
    propertyNode: DEMO_PROPERTY_NODE,
    blockCode: DEMO_GROUP_BLOCK_CODE,
    groupId: before.group_id,
    reservationId: before.reservation_id,
    confirmationNo: DEMO_GROUP_PICKUP.confirmationNo,
    guestLinksBefore: before.guest_links,
    guestLinksAfter: after.guest_links,
    importedGuestNames: IMPORTED_GUEST_NAMES,
    outboxEventType: replayed ? null : "group.rooming_list_imported",
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
  proof: GovernedGroupRoomingListImportResult["proof"],
): GovernedGroupRoomingListImportResult {
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
