import { Database, type Tx } from "../kernel";
import { DEMO_ACTOR_ID, DEMO_BUSINESS_DATE, DEMO_PROPERTY_NODE, DEMO_TENANT_ID } from "./demo-arrival-fixture";
import { DEMO_GROUP_BLOCK_CODE, readProvisionedGroupBlock, upsertDemoGroupBlockFixture } from "./demo-group-block-fixture";

const CONFIRMATION_PHRASE = "CONFIRM YELLOW OPERATION";
const TARGET_STATUS = "definite";

export interface GovernedGroupBlockStatusInput {
  readonly blockCode?: string;
  readonly targetStatus?: string;
  readonly confirmationPhrase?: string;
  readonly databaseUrl?: string;
}

export interface GovernedGroupBlockStatusResult {
  readonly actionId: "convert-status";
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
    readonly beforeStatus: string;
    readonly afterStatus: string;
    readonly beforeDeductsHouseInventory: boolean;
    readonly afterDeductsHouseInventory: boolean;
    readonly outboxEventType: "group.status_changed" | null;
    readonly outboxSeq: string | null;
    readonly correlationId: string | null;
    readonly replayed: boolean;
  };
}

interface GroupRow {
  readonly group_id: string;
  readonly status: string;
  readonly deducts: boolean;
}

interface OutboxRow {
  readonly seq: string | number | bigint;
}

export async function executeGovernedGroupBlockStatus(
  input: GovernedGroupBlockStatusInput,
): Promise<GovernedGroupBlockStatusResult> {
  const blockCode = normalizeBlockCode(input.blockCode);
  const targetStatus = normalizeTargetStatus(input.targetStatus);
  const databaseConfigured = input.databaseUrl !== undefined && input.databaseUrl.trim() !== "";
  const confirmed = input.confirmationPhrase === CONFIRMATION_PHRASE;

  if (!confirmed) {
    return result(false, false, false, databaseConfigured, "Exact confirmation phrase is required before any database mutation.", null);
  }
  if (blockCode !== DEMO_GROUP_BLOCK_CODE || targetStatus !== TARGET_STATUS) {
    return result(true, false, false, databaseConfigured, "This governed group block command is limited to converting the fixed public-demo block to definite.", null);
  }
  if (!databaseConfigured) {
    return result(true, false, false, false, "DATABASE_URL is not configured for governed command execution.", null);
  }

  const database = Database.connect(input.databaseUrl ?? "", { maxConnections: 1, prepare: false });
  try {
    const proof = await database.withTenantTransaction(DEMO_TENANT_ID, async (tx) => executeInTransaction(tx));
    return result(true, !proof.replayed, !proof.replayed, true, proof.replayed ? "Group block was already definite; authoritative status reread from PostgreSQL." : "Governed group block status conversion executed and reread from PostgreSQL.", proof);
  } finally {
    database.close();
  }
}

async function executeInTransaction(tx: Tx): Promise<NonNullable<GovernedGroupBlockStatusResult["proof"]>> {
  await upsertDemoGroupBlockFixture(tx);
  const before = await readGroup(tx);
  if (before.status === TARGET_STATUS) {
    const outboxSeq = await existingStatusOutboxSeq(tx, before.group_id);
    return buildProof(before, before, outboxSeq, null, true);
  }
  if (before.status !== "tentative") {
    throw new Error(`group block ${DEMO_GROUP_BLOCK_CODE} is not eligible for conversion from ${before.status}`);
  }
  const fixture = await readProvisionedGroupBlock(tx);
  if (fixture.definiteDeducts !== true || fixture.tentativeDeducts !== false) {
    throw new Error("demo block status definitions are not configured for tentative->definite deduction proof");
  }

  await tx`
    UPDATE reservation_group
       SET status = ${TARGET_STATUS}
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND code = ${DEMO_GROUP_BLOCK_CODE}
  `;
  const after = await readGroup(tx);
  const correlationId = crypto.randomUUID();
  const outboxRows = await tx<OutboxRow[]>`
    INSERT INTO outbox (
      id, tenant_id, property_node, business_date, aggregate_type, aggregate_id,
      event_type, event_version, actor_id, correlation_id, payload
    )
    VALUES (
      ${crypto.randomUUID()}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_BUSINESS_DATE}::date,
      'reservation_group', ${before.group_id}::uuid, 'group.status_changed', 1,
      ${DEMO_ACTOR_ID}::uuid, ${correlationId}::uuid,
      ${JSON.stringify({ blockCode: DEMO_GROUP_BLOCK_CODE, beforeStatus: before.status, afterStatus: after.status, beforeDeducts: before.deducts, afterDeducts: after.deducts })}::jsonb
    )
    RETURNING seq
  `;
  return buildProof(before, after, String(outboxRows[0]?.seq ?? ""), correlationId, false);
}

async function readGroup(tx: Tx): Promise<GroupRow> {
  const rows = await tx<GroupRow[]>`
    SELECT reservation_group.id::text AS group_id,
           reservation_group.status AS status,
           block_status_def.deducts AS deducts
      FROM reservation_group
      JOIN block_status_def ON block_status_def.tenant_id = reservation_group.tenant_id
                           AND block_status_def.code = reservation_group.status
     WHERE reservation_group.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND reservation_group.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND reservation_group.code = ${DEMO_GROUP_BLOCK_CODE}
     LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) throw new Error("provisioned demo group block is missing");
  return row;
}

async function existingStatusOutboxSeq(tx: Tx, groupId: string): Promise<string | null> {
  const rows = await tx<OutboxRow[]>`
    SELECT seq
      FROM outbox
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND aggregate_type = 'reservation_group'
       AND aggregate_id = ${groupId}::uuid
       AND event_type = 'group.status_changed'
     ORDER BY seq
     LIMIT 1
  `;
  return rows[0]?.seq === undefined ? null : String(rows[0].seq);
}

function buildProof(
  before: GroupRow,
  after: GroupRow,
  outboxSeq: string | null,
  correlationId: string | null,
  replayed: boolean,
): NonNullable<GovernedGroupBlockStatusResult["proof"]> {
  return Object.freeze({
    tenantId: DEMO_TENANT_ID,
    propertyNode: DEMO_PROPERTY_NODE,
    blockCode: DEMO_GROUP_BLOCK_CODE,
    groupId: before.group_id,
    beforeStatus: before.status,
    afterStatus: after.status,
    beforeDeductsHouseInventory: before.deducts,
    afterDeductsHouseInventory: after.deducts,
    outboxEventType: replayed ? null : "group.status_changed",
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
  proof: GovernedGroupBlockStatusResult["proof"],
): GovernedGroupBlockStatusResult {
  return Object.freeze({
    actionId: "convert-status" as const,
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

function normalizeTargetStatus(value: string | undefined): string {
  return (value ?? TARGET_STATUS).trim().toLowerCase();
}
