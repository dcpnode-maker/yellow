import { Database, type Tx } from "../kernel";

export type DemoHousekeepingCondition = "clean" | "dirty" | "pickup" | "inspected";

export interface GovernedHousekeepingCommandInput {
  readonly roomCode?: string;
  readonly condition?: DemoHousekeepingCondition;
  readonly confirmationPhrase?: string;
  readonly databaseUrl?: string;
}

export interface GovernedHousekeepingCommandResult {
  readonly actionId: "mark-inspected";
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
    readonly roomCode: string;
    readonly spaceId: string;
    readonly beforeCondition: DemoHousekeepingCondition;
    readonly afterCondition: DemoHousekeepingCondition;
    readonly outboxEventType: "housekeeping.unit_condition_changed";
    readonly outboxSeq: string;
    readonly correlationId: string;
    readonly authoritativeReread: {
      readonly condition: DemoHousekeepingCondition;
      readonly outboxEventFound: boolean;
    };
  };
}

const CONFIRMATION_PHRASE = "CONFIRM YELLOW OPERATION";
const TENANT_ID = "6d9b7ce2-2d14-5576-b8c3-80f06501a603";
const PROPERTY_NODE = "4518a22f-b455-54c6-a50a-4584383749b9";
const DEFAULT_ROOM_CODE = "303";
const DEMO_ACTOR_ID = "00000000-0000-0000-0000-000000000651";

interface ConditionRow {
  readonly space_id: string;
  readonly condition: DemoHousekeepingCondition;
}

interface OutboxRow {
  readonly seq: string | number | bigint;
}

export async function executeGovernedHousekeepingCommand(
  input: GovernedHousekeepingCommandInput,
): Promise<GovernedHousekeepingCommandResult> {
  const roomCode = normalizeRoomCode(input.roomCode);
  const condition = input.condition ?? "inspected";
  const confirmed = input.confirmationPhrase === CONFIRMATION_PHRASE;
  const databaseConfigured = input.databaseUrl !== undefined && input.databaseUrl.trim() !== "";
  if (!confirmed) {
    return result(false, false, false, databaseConfigured, "Exact confirmation phrase is required before any database mutation.", null);
  }
  if (roomCode !== DEFAULT_ROOM_CODE) {
    return result(true, false, false, databaseConfigured, `Room ${roomCode} is outside the governed public-demo housekeeping command scope.`, null);
  }
  if (!databaseConfigured) {
    return result(true, false, false, false, "DATABASE_URL is not configured for governed command execution.", null);
  }

  const database = Database.connect(input.databaseUrl, { maxConnections: 1, prepare: false });
  try {
    const proof = await database.withTenantTransaction(TENANT_ID, async (tx) => {
      const before = await readCondition(tx, roomCode);
      const correlationId = crypto.randomUUID();
      const outboxId = crypto.randomUUID();
      const payload = {
        roomCode,
        beforeCondition: before.condition,
        afterCondition: condition,
        command: "governed-demo-housekeeping-condition",
      };
      const updated = await tx<ConditionRow[]>`
        UPDATE unit_condition
           SET condition = ${condition},
               updated_at = now(),
               updated_by = ${DEMO_ACTOR_ID}::uuid
         WHERE tenant_id = ${TENANT_ID}::uuid
           AND space_id = ${before.space_id}::uuid
         RETURNING space_id::text, condition
      `;
      const after = updated[0];
      if (after === undefined) throw new Error("unit_condition update returned no row");
      const outboxRows = await tx<OutboxRow[]>`
        INSERT INTO outbox (
          id, tenant_id, property_node, business_date, aggregate_type, aggregate_id,
          event_type, event_version, actor_id, correlation_id, payload
        )
        VALUES (
          ${outboxId}::uuid, ${TENANT_ID}::uuid, ${PROPERTY_NODE}::uuid, DATE '2026-09-23',
          'space', ${after.space_id}::uuid, 'housekeeping.unit_condition_changed', 1,
          ${DEMO_ACTOR_ID}::uuid, ${correlationId}::uuid, ${JSON.stringify(payload)}::jsonb
        )
        RETURNING seq
      `;
      const reread = await readCondition(tx, roomCode);
      const outboxFound = await tx<{ found: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
            FROM outbox
           WHERE tenant_id = ${TENANT_ID}::uuid
             AND correlation_id = ${correlationId}::uuid
             AND event_type = 'housekeeping.unit_condition_changed'
        ) AS found
      `;
      return Object.freeze({
        tenantId: TENANT_ID,
        propertyNode: PROPERTY_NODE,
        roomCode,
        spaceId: after.space_id,
        beforeCondition: before.condition,
        afterCondition: after.condition,
        outboxEventType: "housekeeping.unit_condition_changed" as const,
        outboxSeq: String(outboxRows[0]?.seq ?? ""),
        correlationId,
        authoritativeReread: Object.freeze({
          condition: reread.condition,
          outboxEventFound: outboxFound[0]?.found === true,
        }),
      });
    });
    return result(true, true, true, true, "Governed housekeeping command executed and reread from PostgreSQL.", proof);
  } finally {
    database.close();
  }
}

function result(
  confirmed: boolean,
  executed: boolean,
  realPmsExecuted: boolean,
  databaseConfigured: boolean,
  reason: string,
  proof: GovernedHousekeepingCommandResult["proof"],
): GovernedHousekeepingCommandResult {
  return Object.freeze({
    actionId: "mark-inspected" as const,
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

function normalizeRoomCode(roomCode: string | undefined): string {
  const normalized = (roomCode ?? DEFAULT_ROOM_CODE).trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,12}$/.test(normalized)) return DEFAULT_ROOM_CODE;
  return normalized;
}

async function readCondition(tx: Tx, roomCode: string): Promise<ConditionRow> {
  const rows = await tx<ConditionRow[]>`
    SELECT condition.space_id::text, condition.condition
      FROM unit_condition condition
      JOIN space ON space.id = condition.space_id
     WHERE condition.tenant_id = ${TENANT_ID}::uuid
       AND space.tenant_id = ${TENANT_ID}::uuid
       AND space.property_node = ${PROPERTY_NODE}::uuid
       AND space.code = ${roomCode}
     LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) throw new Error("authoritative unit_condition reread returned no row");
  return row;
}
