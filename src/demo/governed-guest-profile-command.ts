import { Database, type Tx } from "../kernel";
import {
  DEMO_ACTOR_ID,
  DEMO_BUSINESS_DATE,
  DEMO_CONFIRMATION_NO,
  DEMO_IDS,
  DEMO_PROPERTY_NODE,
  DEMO_TENANT_ID,
  provisionDemoArrivalFixture,
} from "./demo-arrival-fixture";

const CONFIRMATION_PHRASE = "CONFIRM YELLOW OPERATION";

export interface GovernedGuestProfileInput {
  readonly confirmationNo?: string;
  readonly primaryGuestName?: string;
  readonly sharerName?: string;
  readonly confirmationPhrase?: string;
  readonly databaseUrl?: string;
}

export interface GovernedGuestProfileResult {
  readonly actionId: "guest-profile";
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
    readonly primaryGuestBefore: string;
    readonly primaryGuestAfter: string;
    readonly sharerName: string | null;
    readonly guestLinksAfter: number;
    readonly outboxEventType: "reservation.guest_profile_updated";
    readonly outboxSeq: string;
    readonly correlationId: string;
  };
}

interface ReservationGuestState {
  readonly reservation_id: string;
  readonly primary_party_id: string;
  readonly primary_name: string;
}

interface AfterState {
  readonly primary_name: string;
  readonly guest_links: number;
}

interface OutboxRow {
  readonly seq: string | number | bigint;
}

export async function executeGovernedGuestProfileUpdate(input: GovernedGuestProfileInput): Promise<GovernedGuestProfileResult> {
  const confirmationNo = (input.confirmationNo ?? DEMO_CONFIRMATION_NO).trim().toUpperCase();
  const primaryGuestName = cleanName(input.primaryGuestName);
  const sharerName = cleanName(input.sharerName);
  const databaseConfigured = input.databaseUrl !== undefined && input.databaseUrl.trim() !== "";
  const confirmed = input.confirmationPhrase === CONFIRMATION_PHRASE;

  if (!confirmed) {
    return result(false, false, false, databaseConfigured, "Exact confirmation phrase is required before any database mutation.", null);
  }
  if (confirmationNo !== DEMO_CONFIRMATION_NO) {
    return result(true, false, false, databaseConfigured, "This governed guest profile command is limited to the public-demo Sara Al Harbi reservation.", null);
  }
  if (primaryGuestName === null && sharerName === null) {
    return result(true, false, false, databaseConfigured, "Enter a primary guest name or sharer name before confirming.", null);
  }
  if (!databaseConfigured) {
    return result(true, false, false, false, "DATABASE_URL is not configured for governed command execution.", null);
  }

  await provisionDemoArrivalFixture(input.databaseUrl ?? "");
  const database = Database.connect(input.databaseUrl ?? "", { maxConnections: 1, prepare: false });
  try {
    const proof = await database.withTenantTransaction(DEMO_TENANT_ID, async (tx) => executeInTransaction(tx, primaryGuestName, sharerName));
    return result(true, true, true, true, "Governed guest profile update executed and reread from PostgreSQL.", proof);
  } finally {
    database.close();
  }
}

async function executeInTransaction(
  tx: Tx,
  primaryGuestName: string | null,
  sharerName: string | null,
): Promise<NonNullable<GovernedGuestProfileResult["proof"]>> {
  const before = await readReservationGuestState(tx);
  const nextPrimaryName = primaryGuestName ?? before.primary_name;
  await tx`
    UPDATE party
       SET display_name = ${nextPrimaryName},
           legal_name = ${nextPrimaryName},
           attrs = attrs || ${JSON.stringify({ demoEdited: true })}::jsonb
     WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
       AND id = ${before.primary_party_id}::uuid
  `;

  if (sharerName !== null) {
    await tx`
      INSERT INTO party (id, tenant_id, kind, display_name, legal_name, attrs, status)
      VALUES (${DEMO_IDS.sharerParty}::uuid, ${DEMO_TENANT_ID}::uuid, 'person', ${sharerName}, ${sharerName}, '{"demo": true, "sharer": true}'::jsonb, 'active')
      ON CONFLICT (id) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            legal_name = EXCLUDED.legal_name,
            attrs = party.attrs || '{"demo": true, "sharer": true}'::jsonb,
            status = 'active'
    `;
    await tx`
      INSERT INTO reservation_guest (tenant_id, reservation_id, party_id, role, share_pct)
      VALUES (${DEMO_TENANT_ID}::uuid, ${before.reservation_id}::uuid, ${DEMO_IDS.sharerParty}::uuid, 'sharer', 50.00)
      ON CONFLICT (reservation_id, party_id) DO UPDATE
        SET role = 'sharer',
            share_pct = 50.00
    `;
    await tx`
      UPDATE reservation_guest
         SET share_pct = 50.00
       WHERE tenant_id = ${DEMO_TENANT_ID}::uuid
         AND reservation_id = ${before.reservation_id}::uuid
         AND party_id = ${before.primary_party_id}::uuid
    `;
  }

  const after = await readAfterState(tx, before.reservation_id);
  const correlationId = crypto.randomUUID();
  const outboxRows = await tx<OutboxRow[]>`
    INSERT INTO outbox (
      id, tenant_id, property_node, business_date, aggregate_type, aggregate_id,
      event_type, event_version, actor_id, correlation_id, payload
    )
    VALUES (
      ${crypto.randomUUID()}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_BUSINESS_DATE}::date,
      'reservation', ${before.reservation_id}::uuid, 'reservation.guest_profile_updated', 1,
      ${DEMO_ACTOR_ID}::uuid, ${correlationId}::uuid,
      ${JSON.stringify({
        confirmationNo: DEMO_CONFIRMATION_NO,
        primaryGuestBefore: before.primary_name,
        primaryGuestAfter: after.primary_name,
        sharerName,
        guestLinksAfter: after.guest_links,
      })}::jsonb
    )
    RETURNING seq
  `;

  return Object.freeze({
    tenantId: DEMO_TENANT_ID,
    propertyNode: DEMO_PROPERTY_NODE,
    confirmationNo: DEMO_CONFIRMATION_NO,
    reservationId: before.reservation_id,
    primaryGuestBefore: before.primary_name,
    primaryGuestAfter: after.primary_name,
    sharerName,
    guestLinksAfter: after.guest_links,
    outboxEventType: "reservation.guest_profile_updated" as const,
    outboxSeq: String(outboxRows[0]?.seq ?? ""),
    correlationId,
  });
}

async function readReservationGuestState(tx: Tx): Promise<ReservationGuestState> {
  const rows = await tx<ReservationGuestState[]>`
    SELECT reservation.id::text AS reservation_id,
           party.id::text AS primary_party_id,
           party.display_name AS primary_name
      FROM reservation
      JOIN party ON party.tenant_id = reservation.tenant_id AND party.id = reservation.primary_party
     WHERE reservation.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND reservation.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND reservation.confirmation_no = ${DEMO_CONFIRMATION_NO}
     LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) throw new Error("demo reservation guest profile is missing");
  return row;
}

async function readAfterState(tx: Tx, reservationId: string): Promise<AfterState> {
  const rows = await tx<AfterState[]>`
    SELECT party.display_name AS primary_name,
           count(reservation_guest.party_id)::int AS guest_links
      FROM reservation
      JOIN party ON party.tenant_id = reservation.tenant_id AND party.id = reservation.primary_party
      LEFT JOIN reservation_guest ON reservation_guest.tenant_id = reservation.tenant_id
                                 AND reservation_guest.reservation_id = reservation.id
     WHERE reservation.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND reservation.id = ${reservationId}::uuid
     GROUP BY party.display_name
  `;
  const row = rows[0];
  if (row === undefined) throw new Error("demo reservation guest profile reread failed");
  return row;
}

function cleanName(value: string | undefined): string | null {
  const cleaned = (value ?? "").trim().replace(/\s+/g, " ");
  if (cleaned === "") return null;
  return cleaned.slice(0, 80);
}

function result(
  confirmed: boolean,
  executed: boolean,
  realPmsExecuted: boolean,
  databaseConfigured: boolean,
  reason: string,
  proof: GovernedGuestProfileResult["proof"],
): GovernedGuestProfileResult {
  return Object.freeze({
    actionId: "guest-profile" as const,
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
