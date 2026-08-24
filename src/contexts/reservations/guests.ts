import {
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const CONFIRMATION_NO = /^[\x21-\x7e]{1,120}$/;
const SHARE = /^(?:0\.(?:0[1-9]|[1-9]\d)|[1-9]\d?\.\d{2}|100\.00)$/;
const MAX_NON_PRIMARY_GUESTS = 99;

export type ReservationGuestRole = "primary" | "accompanying" | "sharer";
export type RequestedReservationGuestRole = Exclude<ReservationGuestRole, "primary">;
export type GuestEditableReservationStatus = "reserved" | "due_in" | "in_house" | "due_out";

export interface ReservationGuestAllocation extends Readonly<Record<string, JsonValue>> {
  readonly partyId: string;
  readonly role: ReservationGuestRole;
  readonly sharePct: string | null;
}

export interface RequestedReservationGuest {
  readonly partyId: string;
  readonly role: RequestedReservationGuestRole;
  readonly sharePct: string | null;
}

export interface ReplaceReservationGuestsInput {
  readonly reservationId: string;
  readonly primarySharePct: string | null;
  readonly guests: readonly RequestedReservationGuest[];
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface ReplaceReservationGuestsResult {
  readonly reservationId: string;
  readonly status: GuestEditableReservationStatus;
  readonly guests: readonly ReservationGuestAllocation[];
  readonly changed: boolean;
  readonly replayed: boolean;
}

export interface FindReservationGuestsInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly confirmationNo: string;
}

export interface ReservationGuestLookupResult {
  readonly reservationId: string;
  readonly confirmationNo: string;
  readonly status: string;
  readonly primaryPartyId: string;
  readonly guests: readonly ReservationGuestAllocation[];
}

type ReplaceReservationGuestsBody = Omit<ReplaceReservationGuestsResult, "replayed"> &
  Readonly<Record<string, JsonValue>>;

export interface ReservationGuestServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface ReservationRow {
  readonly id: string;
  readonly status: string;
  readonly primary_party: string;
}

interface ReservationLookupRow extends ReservationRow {
  readonly confirmation_no: string;
}

interface GuestRow {
  readonly party_id: string;
  readonly role: string;
  readonly share_pct: string | null;
}

interface NormalizedRequest {
  readonly reservationId: string;
  readonly primarySharePct: string | null;
  readonly guests: readonly RequestedReservationGuest[];
  readonly idempotencyKey: string;
}

export class ReservationGuestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationGuestValidationError";
  }
}

export class ReservationGuestNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationGuestNotFoundError";
  }
}

export class ReservationGuestConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationGuestConflictError";
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ReservationGuestValidationError(`${name} must be a UUID`);
  }
  return value;
}

function basisPoints(name: string, value: unknown): number {
  if (typeof value !== "string" || !SHARE.test(value)) {
    throw new ReservationGuestValidationError(
      `${name} must be a canonical percentage from 0.01 through 100.00`,
    );
  }
  const separator = value.indexOf(".");
  const whole = Number(value.slice(0, separator));
  const fraction = Number(value.slice(separator + 1));
  return whole * 100 + fraction;
}

function freezeRequested(guest: RequestedReservationGuest): RequestedReservationGuest {
  return Object.freeze({ partyId: guest.partyId, role: guest.role, sharePct: guest.sharePct });
}

function normalize(input: ReplaceReservationGuestsInput): NormalizedRequest {
  if (input.envelope.operation !== "reservation.modified") {
    throw new ReservationGuestValidationError("audit operation must be reservation.modified");
  }
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new ReservationGuestValidationError(
      "idempotencyKey must contain 8-200 printable non-space characters",
    );
  }
  if (!Array.isArray(input.guests) || input.guests.length > MAX_NON_PRIMARY_GUESTS) {
    throw new ReservationGuestValidationError("guests must contain at most 99 entries");
  }

  const partyIds = new Set<string>();
  let sharerTotal = 0;
  let sharerCount = 0;
  const guests = input.guests.map((guest, index) => {
    if (typeof guest !== "object" || guest === null || Array.isArray(guest)) {
      throw new ReservationGuestValidationError(`guests[${index}] must be an object`);
    }
    const partyId = requireUuid(`guests[${index}].partyId`, guest.partyId);
    if (partyIds.has(partyId)) {
      throw new ReservationGuestValidationError("guest party ids must be unique");
    }
    partyIds.add(partyId);
    if (guest.role !== "accompanying" && guest.role !== "sharer") {
      throw new ReservationGuestValidationError("guest role must be accompanying or sharer");
    }
    if (guest.role === "accompanying") {
      if (guest.sharePct !== null) {
        throw new ReservationGuestValidationError("accompanying guests cannot carry sharePct");
      }
    } else {
      sharerCount += 1;
      sharerTotal += basisPoints(`guests[${index}].sharePct`, guest.sharePct);
    }
    return freezeRequested({ partyId, role: guest.role, sharePct: guest.sharePct });
  }).sort((left, right) => left.partyId.localeCompare(right.partyId));

  let primarySharePct: string | null;
  if (sharerCount === 0) {
    if (input.primarySharePct !== null) {
      throw new ReservationGuestValidationError("primarySharePct must be null without sharers");
    }
    primarySharePct = null;
  } else {
    const primaryTotal = basisPoints("primarySharePct", input.primarySharePct);
    if (primaryTotal + sharerTotal !== 10_000) {
      throw new ReservationGuestValidationError("primary and sharer percentages must total 100.00");
    }
    primarySharePct = input.primarySharePct;
  }

  return Object.freeze({
    reservationId: requireUuid("reservationId", input.reservationId),
    primarySharePct,
    guests: Object.freeze(guests),
    idempotencyKey: input.idempotencyKey,
  });
}

function asStatus(value: string): GuestEditableReservationStatus {
  if (value === "reserved" || value === "due_in" || value === "in_house" || value === "due_out") {
    return value;
  }
  throw new ReservationGuestConflictError(`Reservation status ${value} cannot change guests`);
}

function freezeAllocation(allocation: ReservationGuestAllocation): ReservationGuestAllocation {
  return Object.freeze({
    partyId: allocation.partyId,
    role: allocation.role,
    sharePct: allocation.sharePct,
  });
}

function validateStoredAllocation(
  reservation: ReservationRow,
  rows: readonly GuestRow[],
): readonly ReservationGuestAllocation[] {
  const primaryRows = rows.filter((row) => row.role === "primary");
  if (primaryRows.length !== 1 || primaryRows[0]?.party_id !== reservation.primary_party) {
    throw new ReservationGuestConflictError("Reservation primary guest membership is inconsistent");
  }
  let total = 0;
  let sharers = 0;
  const allocations = rows.map((row) => {
    if (!UUID.test(row.party_id)) {
      throw new ReservationGuestConflictError("Stored reservation guest party is invalid");
    }
    if (row.role !== "primary" && row.role !== "accompanying" && row.role !== "sharer") {
      throw new ReservationGuestConflictError("Stored reservation guest role is invalid");
    }
    if (row.role === "accompanying") {
      if (row.share_pct !== null) {
        throw new ReservationGuestConflictError("Stored accompanying guest has a share");
      }
    } else if (row.role === "sharer") {
      sharers += 1;
      try {
        total += basisPoints("stored sharer share", row.share_pct);
      } catch {
        throw new ReservationGuestConflictError("Stored sharer percentage is invalid");
      }
    }
    return freezeAllocation({ partyId: row.party_id, role: row.role, sharePct: row.share_pct });
  });
  const primary = allocations.find((allocation) => allocation.role === "primary");
  if (!primary) {
    throw new ReservationGuestConflictError("Reservation primary guest membership is inconsistent");
  }
  if (sharers === 0) {
    if (primary.sharePct !== null) {
      throw new ReservationGuestConflictError("Stored primary share exists without sharers");
    }
  } else {
    try {
      total += basisPoints("stored primary share", primary.sharePct);
    } catch {
      throw new ReservationGuestConflictError("Stored primary percentage is invalid");
    }
    if (total !== 10_000) {
      throw new ReservationGuestConflictError("Stored reservation guest shares do not total 100.00");
    }
  }
  return Object.freeze(allocations.sort((left, right) => {
    if (left.role === "primary") return -1;
    if (right.role === "primary") return 1;
    return left.partyId.localeCompare(right.partyId);
  }));
}

function sameAllocation(
  left: readonly ReservationGuestAllocation[],
  right: readonly ReservationGuestAllocation[],
): boolean {
  return left.length === right.length && left.every((value, index) => {
    const other = right[index];
    return other !== undefined && value.partyId === other.partyId &&
      value.role === other.role && value.sharePct === other.sharePct;
  });
}

function requestedAllocation(
  primaryPartyId: string,
  primarySharePct: string | null,
  guests: readonly RequestedReservationGuest[],
): readonly ReservationGuestAllocation[] {
  return Object.freeze([
    freezeAllocation({ partyId: primaryPartyId, role: "primary", sharePct: primarySharePct }),
    ...guests.map((guest) => freezeAllocation({
      partyId: guest.partyId,
      role: guest.role,
      sharePct: guest.sharePct,
    })),
  ]);
}

export class ReservationGuestService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: ReservationGuestServiceOptions) {
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async findByConfirmation(
    tx: Tx,
    input: FindReservationGuestsInput,
  ): Promise<ReservationGuestLookupResult> {
    const tenantId = requireUuid("tenantId", input.tenantId);
    const propertyNode = requireUuid("propertyNode", input.propertyNode);
    if (typeof input.confirmationNo !== "string" || !CONFIRMATION_NO.test(input.confirmationNo)) {
      throw new ReservationGuestValidationError("confirmationNo must contain 1-120 visible characters");
    }
    const reservations = await tx<ReservationLookupRow[]>`
      SELECT id, confirmation_no, status, primary_party
      FROM reservation
      WHERE tenant_id = ${tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = ${propertyNode}::uuid
        AND confirmation_no = ${input.confirmationNo}
    `;
    const reservation = reservations[0];
    if (!reservation) {
      throw new ReservationGuestNotFoundError("Reservation was not found in the property");
    }
    const rows = await tx<GuestRow[]>`
      SELECT party_id, role, share_pct::text
      FROM reservation_guest
      WHERE tenant_id = ${tenantId}::uuid
        AND reservation_id = ${reservation.id}::uuid
      ORDER BY CASE role WHEN 'primary' THEN 0 ELSE 1 END, party_id
    `;
    return Object.freeze({
      reservationId: reservation.id,
      confirmationNo: reservation.confirmation_no,
      status: reservation.status,
      primaryPartyId: reservation.primary_party,
      guests: validateStoredAllocation(reservation, rows),
    });
  }

  async replace(tx: Tx, input: ReplaceReservationGuestsInput): Promise<ReplaceReservationGuestsResult> {
    const normalized = normalize(input);
    const outcome = await this.#idempotency.execute<ReplaceReservationGuestsBody>(tx, {
      tenantId: input.envelope.tenantId,
      operation: "reservation.guests.replace",
      key: normalized.idempotencyKey,
      request: {
        actorId: input.envelope.actorId,
        propertyNode: input.envelope.propertyNode,
        reservationId: normalized.reservationId,
        primarySharePct: normalized.primarySharePct,
        guests: normalized.guests,
      },
    }, async (commandTx) => {
      const reservations = await commandTx<ReservationRow[]>`
        SELECT id, status, primary_party
        FROM reservation
        WHERE id = ${normalized.reservationId}::uuid
          AND tenant_id = ${input.envelope.tenantId}::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property_node = ${input.envelope.propertyNode}::uuid
        FOR UPDATE
      `;
      const reservation = reservations[0];
      if (!reservation) {
        throw new ReservationGuestNotFoundError("Reservation was not found in the active property");
      }
      const status = asStatus(reservation.status);
      const currentRows = await commandTx<GuestRow[]>`
        SELECT party_id, role, share_pct::text
        FROM reservation_guest
        WHERE tenant_id = ${input.envelope.tenantId}::uuid
          AND reservation_id = ${normalized.reservationId}::uuid
        ORDER BY CASE role WHEN 'primary' THEN 0 ELSE 1 END, party_id
        FOR UPDATE
      `;
      const before = validateStoredAllocation(reservation, currentRows);
      if (normalized.guests.some((guest) => guest.partyId === reservation.primary_party)) {
        throw new ReservationGuestConflictError("Primary party cannot be a non-primary guest");
      }

      const requestedPartyJson = JSON.stringify(normalized.guests.map((guest) => guest.partyId));
      if (normalized.guests.length > 0) {
        const activeParties = await commandTx<Array<{ id: string }>>`
          SELECT party.id
          FROM party
          JOIN jsonb_array_elements_text(${requestedPartyJson}::text::jsonb) AS requested(id)
            ON party.id = requested.id::uuid
          WHERE party.tenant_id = ${input.envelope.tenantId}::uuid
            AND party.tenant_id = current_setting('app.tenant_id', true)::uuid
            AND party.status = 'active'
          ORDER BY party.id
        `;
        if (activeParties.length !== normalized.guests.length) {
          throw new ReservationGuestNotFoundError("Every requested guest must be an active tenant party");
        }
      }

      const after = requestedAllocation(
        reservation.primary_party,
        normalized.primarySharePct,
        normalized.guests,
      );
      const changed = !sameAllocation(before, after);
      if (changed) {
        const primaryUpdated = await commandTx<Array<{ party_id: string }>>`
          UPDATE reservation_guest
          SET share_pct = ${normalized.primarySharePct}::numeric
          WHERE tenant_id = ${input.envelope.tenantId}::uuid
            AND reservation_id = ${normalized.reservationId}::uuid
            AND party_id = ${reservation.primary_party}::uuid
            AND role = 'primary'
          RETURNING party_id
        `;
        if (primaryUpdated[0]?.party_id !== reservation.primary_party) {
          throw new ReservationGuestConflictError("Reservation primary guest changed concurrently");
        }

        for (const guest of normalized.guests) {
          const upserted = await commandTx<Array<{ party_id: string }>>`
            INSERT INTO reservation_guest (tenant_id, reservation_id, party_id, role, share_pct)
            VALUES (
              ${input.envelope.tenantId}::uuid, ${normalized.reservationId}::uuid,
              ${guest.partyId}::uuid, ${guest.role}, ${guest.sharePct}::numeric
            )
            ON CONFLICT (reservation_id, party_id) DO UPDATE
            SET role = EXCLUDED.role, share_pct = EXCLUDED.share_pct
            WHERE reservation_guest.tenant_id = EXCLUDED.tenant_id
              AND reservation_guest.role <> 'primary'
            RETURNING party_id
          `;
          if (upserted[0]?.party_id !== guest.partyId) {
            throw new ReservationGuestConflictError("Reservation guest membership changed concurrently");
          }
        }

        await commandTx`
          DELETE FROM reservation_guest AS existing
          WHERE existing.tenant_id = ${input.envelope.tenantId}::uuid
            AND existing.reservation_id = ${normalized.reservationId}::uuid
            AND existing.role <> 'primary'
            AND NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(${requestedPartyJson}::text::jsonb) AS requested(id)
              WHERE requested.id::uuid = existing.party_id
            )
        `;

        const fact = await recordFact(commandTx, {
          entityType: "reservation",
          entityId: normalized.reservationId,
          envelope: input.envelope,
          payload: { diff: { guests: { before, after } } },
        });
        await this.#events.publish(commandTx, {
          tenantId: input.envelope.tenantId,
          propertyNode: input.envelope.propertyNode,
          businessDate: fact.businessDate,
          aggregateType: "reservation",
          aggregateId: normalized.reservationId,
          eventType: "reservation.modified",
          actorId: input.envelope.actorId,
          correlationId: input.envelope.requestId,
          payload: {
            reservation_id: normalized.reservationId,
            diff: { guests: { before, after } },
          },
        });
      }

      return {
        status: 200,
        body: Object.freeze({
          reservationId: normalized.reservationId,
          status,
          guests: after,
          changed,
        }),
      };
    });
    return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
  }
}
