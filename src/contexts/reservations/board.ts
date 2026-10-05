import { createHash } from "node:crypto";
import type { Tx } from "../../kernel";
import { RESERVATION_STATUSES, type ReservationStatus } from "./state-machine";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MICROSECOND_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const CURRENCY = /^[A-Z]{3}$/;
const CURSOR = /^[A-Za-z0-9_-]{1,512}$/;
const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1_000;

export const RESERVATION_JOURNEY_STAGES = Object.freeze(["pre_arrival", "arrival", "in_house", "departure", "post_departure"] as const);
export type ReservationJourneyStage = (typeof RESERVATION_JOURNEY_STAGES)[number];
function isCanonicalDate(value: string): boolean {
  return /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
}

export interface ReservationBoardInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  /** Read-only Party-history filter. The property scope remains mandatory. */
  readonly partyId?: string;
  readonly status?: ReservationStatus;
  readonly stage?: ReservationJourneyStage;
  readonly from?: Date;
  readonly to?: Date;
  readonly after?: string;
  readonly limit?: number;
}

export interface ReservationBoardRow {
  readonly reservationId: string;
  readonly primaryPartyId: string;
  readonly confirmationNo: string;
  readonly status: ReservationStatus;
  readonly operationalState: ReservationOperationalState;
  readonly primaryGuestDisplayName: string;
  readonly stayFrom: string;
  readonly stayTo: string;
  readonly unitTypeLabel: string;
  readonly sellableUnitLabel: string | null;
  readonly ratePlanLabel: string;
  readonly adults: number;
  readonly children: number;
  readonly channelCode: string;
  readonly marketCode: string | null;
  readonly sourceCode: string | null;
  readonly currency: string;
  readonly createdAt: string;
  readonly arrivalTravel: ReservationBoardArrivalTravel | null;
  readonly departureTravel: ReservationBoardDepartureTravel | null;
}

export type ReservationOperationalState = ReservationStatus | "checked_in_today" | "stayover" | "checked_out_today";

export interface ReservationBoardArrivalTravel {
  readonly mode: "flight" | "train" | "bus" | "car" | "ferry" | "other" | null;
  readonly carrier: string | null;
  readonly serviceNo: string | null;
  readonly scheduledAt: string | null;
  readonly pickupRequested: boolean;
  readonly pickupTaskLinked: boolean;
}

export interface ReservationBoardDepartureTravel {
  readonly mode: "flight" | "train" | "bus" | "car" | "ferry" | "other" | null;
  readonly carrier: string | null;
  readonly serviceNo: string | null;
  readonly scheduledAt: string | null;
}

export interface ReservationBoardPage {
  readonly reservations: readonly ReservationBoardRow[];
  readonly nextCursor: string | null;
  /** Present only on stage reads; legacy board response remains compatible. */
  readonly businessDate?: string;
}

type CursorPayload = Readonly<{ v: 1; createdAt: string; id: string }> |
  Readonly<{ v: 2; createdAt: string; id: string; stage: ReservationJourneyStage; businessDate: string; query: string }>;

interface BoardSqlRow {
  readonly id: string;
  readonly confirmation_no: string;
  readonly status: string;
  readonly operational_state: string;
  readonly primary_party: string;
  readonly visible_primary_party_id: string | null;
  readonly display_name: string | null;
  readonly stay_from: string | null;
  readonly stay_to: string | null;
  readonly unit_type_label: string | null;
  readonly sellable_unit_label: string | null;
  readonly rate_plan_label: string | null;
  readonly adults: number;
  readonly children: number;
  readonly channel_code: string;
  readonly market_code: string | null;
  readonly source_code: string | null;
  readonly currency: string;
  readonly created_at: string;
  readonly arrival_direction: string | null;
  readonly arrival_mode: string | null;
  readonly arrival_carrier: string | null;
  readonly arrival_service_no: string | null;
  readonly arrival_scheduled_at: string | null;
  readonly arrival_pickup_requested: boolean | null;
  readonly arrival_pickup_task_id: string | null;
  readonly visible_arrival_pickup_task_id: string | null;
  readonly departure_direction: string | null;
  readonly departure_mode: string | null;
  readonly departure_carrier: string | null;
  readonly departure_service_no: string | null;
  readonly departure_scheduled_at: string | null;
}

export class ReservationBoardValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ReservationBoardValidationError"; }
}

export class ReservationBoardConflictError extends Error {
  constructor(message: string) { super(message); this.name = "ReservationBoardConflictError"; }
}

function encodeBase64Url(value: string): string {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): string {
  const standard = value.replaceAll("-", "+").replaceAll("_", "/");
  return atob(standard + "=".repeat((4 - standard.length % 4) % 4));
}

function encodeCursor(payload: CursorPayload): string {
  return encodeBase64Url(JSON.stringify(payload));
}

function isCanonicalInstant(value: string): boolean {
  if (!MICROSECOND_UTC.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 23) === value.slice(0, 23);
}

function decodeCursor(value: string): CursorPayload {
  if (!CURSOR.test(value)) throw new ReservationBoardValidationError("after cursor is invalid");
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(value));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed) ||
        Object.getPrototypeOf(parsed) !== Object.prototype) throw new Error("shape");
    const fields = parsed as Record<string, unknown>;
    if (typeof fields.createdAt !== "string" || !isCanonicalInstant(fields.createdAt) ||
        typeof fields.id !== "string" || !UUID.test(fields.id)) throw new Error("position");
    if (fields.v === 1) {
      if (Object.keys(fields).length !== 3) throw new Error("legacy shape");
    } else if (fields.v === 2) {
      if (Object.keys(fields).length !== 6 || !RESERVATION_JOURNEY_STAGES.includes(fields.stage as ReservationJourneyStage) ||
          typeof fields.businessDate !== "string" || !isCanonicalDate(fields.businessDate) ||
          typeof fields.query !== "string" || !/^[0-9a-f]{64}$/.test(fields.query)) throw new Error("stage shape");
    } else throw new Error("version");
    const cursor = parsed as unknown as CursorPayload;
    if (encodeCursor(cursor) !== value) throw new Error("non-canonical");
    return cursor;
  } catch {
    throw new ReservationBoardValidationError("after cursor is invalid");
  }
}

function validate(input: ReservationBoardInput) {
  if (typeof input !== "object" || input === null || Array.isArray(input) ||
      (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) ||
      Object.getOwnPropertySymbols(input).length > 0) {
    throw new ReservationBoardValidationError("Reservation board input must be a plain object");
  }
  const allowed = new Set(["tenantId", "propertyNode", "partyId", "status", "stage", "from", "to", "after", "limit"]);
  if (Object.getOwnPropertyNames(input).some((key) => !allowed.has(key)) ||
      !UUID.test(input.tenantId) || !UUID.test(input.propertyNode) ||
      (input.partyId !== undefined && !UUID.test(input.partyId))) {
    throw new ReservationBoardValidationError("Reservation board input is invalid");
  }
  if (input.status !== undefined && !RESERVATION_STATUSES.includes(input.status)) {
    throw new ReservationBoardValidationError("status is invalid");
  }
  if (input.stage !== undefined && !RESERVATION_JOURNEY_STAGES.includes(input.stage)) throw new ReservationBoardValidationError("stage is invalid");
  if (input.stage !== undefined && input.status !== undefined) throw new ReservationBoardValidationError("stage and status cannot be combined");
  if ((input.from === undefined) !== (input.to === undefined)) {
    throw new ReservationBoardValidationError("from and to must be supplied together");
  }
  if (input.from !== undefined && input.to !== undefined &&
      (!(input.from instanceof Date) || !(input.to instanceof Date) ||
       !Number.isFinite(input.from.getTime()) || !Number.isFinite(input.to.getTime()) ||
       input.from >= input.to || input.to.getTime() - input.from.getTime() > MAX_RANGE_MS)) {
    throw new ReservationBoardValidationError("stay overlap range is invalid");
  }
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)) {
    throw new ReservationBoardValidationError("limit must be between 1 and 100");
  }
  return {
    tenantId: input.tenantId,
    propertyNode: input.propertyNode,
    partyId: input.partyId ?? null,
    status: input.status ?? null,
    stage: input.stage ?? null,
    from: input.from?.toISOString() ?? null,
    to: input.to?.toISOString() ?? null,
    after: input.after === undefined ? null : decodeCursor(input.after),
    limit: input.limit ?? 50,
  };
}

function storedStatus(value: string): ReservationStatus {
  const status = RESERVATION_STATUSES.find((candidate) => candidate === value);
  if (!status) throw new ReservationBoardConflictError("Stored reservation status is invalid");
  return status;
}

function storedOperationalState(value: string): ReservationOperationalState {
  if (value === "checked_in_today" || value === "stayover" || value === "checked_out_today") return value;
  return storedStatus(value);
}

function required(value: string | null, name: string): string {
  if (value === null) throw new ReservationBoardConflictError(`Stored reservation ${name} is missing`);
  return value;
}

function storedUuid(value: string): string {
  if (!UUID.test(value)) throw new ReservationBoardConflictError("Stored reservation id is invalid");
  return value;
}

function storedInstant(value: string | null, name: string): string {
  const present = required(value, name);
  if (!isCanonicalInstant(present)) throw new ReservationBoardConflictError(`Stored reservation ${name} is invalid`);
  return present;
}

function storedArrivalMode(value: string | null): ReservationBoardArrivalTravel["mode"] {
  if (value === null || value === "flight" || value === "train" || value === "bus" ||
      value === "car" || value === "ferry" || value === "other") return value;
  throw new ReservationBoardConflictError("Stored arrival travel mode is invalid");
}

function storedDepartureMode(value: string | null): ReservationBoardDepartureTravel["mode"] {
  if (value === null || value === "flight" || value === "train" || value === "bus" ||
      value === "car" || value === "ferry" || value === "other") return value;
  throw new ReservationBoardConflictError("Stored departure travel mode is invalid");
}

function storedNullableTravelText(value: string | null, name: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.trim().length < 1) {
    throw new ReservationBoardConflictError(`Stored arrival travel ${name} is invalid`);
  }
  return value;
}

function storedNullableTravelInstant(value: string | null): string | null {
  if (value === null) return null;
  if (!isCanonicalInstant(value)) {
    throw new ReservationBoardConflictError("Stored arrival travel schedule is invalid");
  }
  return value;
}

function storedNullableDepartureTravelText(value: string | null, name: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.trim().length < 1) {
    throw new ReservationBoardConflictError(`Stored departure travel ${name} is invalid`);
  }
  return value;
}

function storedNullableDepartureTravelInstant(value: string | null): string | null {
  if (value === null) return null;
  if (!isCanonicalInstant(value)) {
    throw new ReservationBoardConflictError("Stored departure travel schedule is invalid");
  }
  return value;
}

function arrivalTravel(row: BoardSqlRow): ReservationBoardArrivalTravel | null {
  if (row.arrival_direction === null) {
    if (row.arrival_mode !== null || row.arrival_carrier !== null || row.arrival_service_no !== null ||
        row.arrival_scheduled_at !== null || row.arrival_pickup_requested !== null ||
        row.arrival_pickup_task_id !== null || row.visible_arrival_pickup_task_id !== null) {
      throw new ReservationBoardConflictError("Stored arrival travel association is invalid");
    }
    return null;
  }
  if (row.arrival_direction !== "arrival" || typeof row.arrival_pickup_requested !== "boolean") {
    throw new ReservationBoardConflictError("Stored arrival travel row is invalid");
  }
  if (row.arrival_pickup_task_id === null) {
    if (row.visible_arrival_pickup_task_id !== null) {
      throw new ReservationBoardConflictError("Stored arrival pickup task association is invalid");
    }
  } else if (!UUID.test(row.arrival_pickup_task_id) ||
      row.visible_arrival_pickup_task_id !== row.arrival_pickup_task_id) {
    throw new ReservationBoardConflictError("Stored arrival pickup task association is invalid");
  }
  return Object.freeze({
    mode: storedArrivalMode(row.arrival_mode),
    carrier: storedNullableTravelText(row.arrival_carrier, "carrier"),
    serviceNo: storedNullableTravelText(row.arrival_service_no, "service number"),
    scheduledAt: storedNullableTravelInstant(row.arrival_scheduled_at),
    pickupRequested: row.arrival_pickup_requested,
    pickupTaskLinked: row.arrival_pickup_task_id !== null,
  });
}

function departureTravel(row: BoardSqlRow): ReservationBoardDepartureTravel | null {
  if (row.departure_direction === null) {
    if (row.departure_mode !== null || row.departure_carrier !== null ||
        row.departure_service_no !== null || row.departure_scheduled_at !== null) {
      throw new ReservationBoardConflictError("Stored departure travel association is invalid");
    }
    return null;
  }
  if (row.departure_direction !== "departure") {
    throw new ReservationBoardConflictError("Stored departure travel row is invalid");
  }
  return Object.freeze({
    mode: storedDepartureMode(row.departure_mode),
    carrier: storedNullableDepartureTravelText(row.departure_carrier, "carrier"),
    serviceNo: storedNullableDepartureTravelText(row.departure_service_no, "service number"),
    scheduledAt: storedNullableDepartureTravelInstant(row.departure_scheduled_at),
  });
}

export class ReservationBoardService {
  async list(tx: Tx, input: ReservationBoardInput): Promise<ReservationBoardPage> {
    const page = validate(input);
    // Context binding, not authorization: RLS and HTTP grants remain mandatory.
    const query = createHash("sha256").update(JSON.stringify({
      tenantId: page.tenantId, propertyNode: page.propertyNode, partyId: page.partyId,
      status: page.status, stage: page.stage, from: page.from, to: page.to,
    })).digest("hex");
    if (page.after && (page.stage === null ? page.after.v !== 1 :
        page.after.v !== 2 || page.after.stage !== page.stage || page.after.query !== query)) {
      throw new ReservationBoardValidationError("Reservation board cursor belongs to another query");
    }
    let businessDate: string | undefined;
    if (page.stage !== null) {
      const dayRows = await tx<Array<{ business_date: string | null }>>`
        SELECT to_char(MAX(day.business_date), 'YYYY-MM-DD') AS business_date
        FROM org_node AS property
        LEFT JOIN business_day AS day ON day.tenant_id = property.tenant_id
          AND day.property_node = property.id AND day.sealed_at IS NULL
        WHERE property.tenant_id = ${page.tenantId}::uuid
          AND property.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property.id = ${page.propertyNode}::uuid AND property.kind = 'property'
      `;
      const day = dayRows[0]?.business_date;
      if (dayRows.length !== 1 || typeof day !== "string" || !isCanonicalDate(day)) {
        throw new ReservationBoardConflictError("No open property business day is available for journey phases");
      }
      businessDate = day;
      if (page.after?.v === 2 && page.after.businessDate !== businessDate) {
        throw new ReservationBoardValidationError("Reservation board cursor belongs to another business date");
      }
    }
    const rows = await tx<BoardSqlRow[]>`
      WITH property_context AS MATERIALIZED (
        SELECT property.id, property.timezone, transaction_timestamp() AS as_of,
               CASE WHEN ${page.stage}::text IS NULL
                 THEN (transaction_timestamp() AT TIME ZONE property.timezone)::date
                 ELSE ${businessDate ?? null}::date END AS business_date
        FROM org_node AS property
        WHERE property.tenant_id = ${page.tenantId}::uuid
          AND property.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property.id = ${page.propertyNode}::uuid
          AND property.kind = 'property'
      ), page_reservations AS MATERIALIZED (
        SELECT reservation.id, reservation.confirmation_no, reservation.status,
               reservation.primary_party, reservation.channel_code, reservation.currency,
               reservation.market_code, reservation.source_code, reservation.created_at
        FROM reservation
        JOIN property_context ON property_context.id = reservation.property_node
        LEFT JOIN LATERAL (
          SELECT min(lower(segment.period)) AS stay_from, max(upper(segment.period)) AS stay_to
          FROM reservation_segment AS segment
          WHERE segment.tenant_id = reservation.tenant_id AND segment.reservation_id = reservation.id
            AND segment.status <> 'cancelled'
        ) AS stage_stay ON ${page.stage}::text IS NOT NULL
        WHERE reservation.tenant_id = ${page.tenantId}::uuid
          AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND reservation.property_node = ${page.propertyNode}::uuid
          AND (${page.partyId}::uuid IS NULL OR reservation.primary_party = ${page.partyId}::uuid OR EXISTS (
            SELECT 1 FROM reservation_guest AS guest
            WHERE guest.tenant_id = reservation.tenant_id
              AND guest.reservation_id = reservation.id
              AND guest.party_id = ${page.partyId}::uuid
          ))
          AND (${page.status}::text IS NULL OR reservation.status = ${page.status}::text)
          AND (${page.stage}::text IS NULL OR (
            (${page.stage}::text = 'pre_arrival' AND reservation.status IN ('reserved','due_in','waitlist')
              AND (stage_stay.stay_from AT TIME ZONE property_context.timezone)::date > property_context.business_date)
            OR (${page.stage}::text = 'arrival' AND (
              (reservation.status IN ('reserved','due_in')
                AND (stage_stay.stay_from AT TIME ZONE property_context.timezone)::date = property_context.business_date)
              OR (reservation.status IN ('in_house','due_out')
                AND (stage_stay.stay_from AT TIME ZONE property_context.timezone)::date <= property_context.business_date
                AND (stage_stay.stay_to AT TIME ZONE property_context.timezone)::date >= property_context.business_date
                AND EXISTS (SELECT 1 FROM fact_log AS checkin_fact
                  WHERE checkin_fact.tenant_id = reservation.tenant_id
                    AND checkin_fact.entity_type = 'reservation' AND checkin_fact.entity_id = reservation.id
                    AND checkin_fact.fact_type = 'reservation.checked_in'
                    AND checkin_fact.business_date = property_context.business_date
                    AND NOT EXISTS (SELECT 1 FROM fact_log AS successor WHERE successor.tenant_id = checkin_fact.tenant_id
                      AND successor.entity_type = checkin_fact.entity_type AND successor.entity_id = checkin_fact.entity_id
                      AND successor.supersedes = checkin_fact.id))
                AND NOT EXISTS (SELECT 1 FROM fact_log AS checkout_fact
                  WHERE checkout_fact.tenant_id = reservation.tenant_id
                    AND checkout_fact.entity_type = 'reservation' AND checkout_fact.entity_id = reservation.id
                    AND checkout_fact.fact_type = 'reservation.checked_out'
                    AND NOT EXISTS (SELECT 1 FROM fact_log AS successor WHERE successor.tenant_id = checkout_fact.tenant_id
                      AND successor.entity_type = checkout_fact.entity_type AND successor.entity_id = checkout_fact.entity_id
                      AND successor.supersedes = checkout_fact.id)))
            ))
            OR (${page.stage}::text = 'in_house' AND reservation.status IN ('in_house','due_out'))
            OR (${page.stage}::text = 'departure' AND reservation.status IN ('in_house','due_out')
              AND (stage_stay.stay_to AT TIME ZONE property_context.timezone)::date = property_context.business_date)
            OR (${page.stage}::text = 'post_departure' AND reservation.status = 'checked_out')
          ))
          AND (${page.after?.createdAt ?? null}::timestamptz IS NULL OR
               (reservation.created_at, reservation.id) <
               (${page.after?.createdAt ?? null}::timestamptz, ${page.after?.id ?? null}::uuid))
          AND (${page.from}::timestamptz IS NULL OR EXISTS (
            SELECT 1 FROM reservation_segment AS overlap_segment
            WHERE overlap_segment.tenant_id = reservation.tenant_id
              AND overlap_segment.reservation_id = reservation.id
              AND overlap_segment.period && tstzrange(${page.from}::timestamptz, ${page.to}::timestamptz, '[)')
          ))
        ORDER BY reservation.created_at DESC, reservation.id DESC
        LIMIT ${page.limit + 1}
      ), candidate_segments AS MATERIALIZED (
        SELECT segment.*,
               bool_or(segment.status <> 'cancelled') OVER (PARTITION BY segment.reservation_id) AS has_active
        FROM reservation_segment AS segment
        JOIN page_reservations AS page ON page.id = segment.reservation_id
        WHERE segment.tenant_id = ${page.tenantId}::uuid
      ), segment_summary AS (
        SELECT segment.reservation_id,
               min(lower(segment.period)) AS stay_from_instant,
               max(upper(segment.period)) AS stay_to_instant,
               to_char(min(lower(segment.period)) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS stay_from,
               to_char(max(upper(segment.period)) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS stay_to,
               sum(segment.adults)::int AS adults,
               sum(jsonb_array_length(segment.children))::int AS children
        FROM candidate_segments AS segment
        WHERE segment.status <> 'cancelled' OR NOT segment.has_active
        GROUP BY segment.reservation_id
      ), latest_segment AS (
        SELECT DISTINCT ON (segment.reservation_id)
               segment.reservation_id, segment.unit_type_id, segment.sellable_unit_id, segment.rate_plan_id
        FROM candidate_segments AS segment
        WHERE segment.status <> 'cancelled' OR NOT segment.has_active
        ORDER BY segment.reservation_id, segment.seq DESC, segment.id DESC
      )
      SELECT page.id, page.confirmation_no, page.status,
             CASE
               WHEN page.status = 'due_in' THEN 'due_in'
               WHEN page.status = 'due_out' THEN 'due_out'
               WHEN page.status = 'in_house' AND EXISTS (
                 SELECT 1 FROM fact_log AS checkin_fact
                 WHERE checkin_fact.tenant_id = ${page.tenantId}::uuid
                   AND checkin_fact.entity_type = 'reservation'
                   AND checkin_fact.entity_id = page.id
                   AND checkin_fact.fact_type = 'reservation.checked_in'
                   AND checkin_fact.business_date = property_context.business_date
                   AND NOT EXISTS (
                     SELECT 1 FROM fact_log AS checkin_successor
                     WHERE checkin_successor.tenant_id = checkin_fact.tenant_id
                       AND checkin_successor.entity_type = checkin_fact.entity_type
                       AND checkin_successor.entity_id = checkin_fact.entity_id
                       AND checkin_successor.supersedes = checkin_fact.id
                   )
               ) AND NOT EXISTS (
                 SELECT 1 FROM fact_log AS contradictory_checkout
                 WHERE contradictory_checkout.tenant_id = ${page.tenantId}::uuid
                   AND contradictory_checkout.entity_type = 'reservation'
                   AND contradictory_checkout.entity_id = page.id
                   AND contradictory_checkout.fact_type = 'reservation.checked_out'
                   AND NOT EXISTS (
                     SELECT 1 FROM fact_log AS checkout_successor
                     WHERE checkout_successor.tenant_id = contradictory_checkout.tenant_id
                       AND checkout_successor.entity_type = contradictory_checkout.entity_type
                       AND checkout_successor.entity_id = contradictory_checkout.entity_id
                       AND checkout_successor.supersedes = contradictory_checkout.id
                   )
               )
                 AND (summary.stay_from_instant AT TIME ZONE property_context.timezone)::date <= property_context.business_date
                 AND (CASE WHEN ${page.stage}::text IS NULL THEN summary.stay_to_instant > property_context.as_of
                      ELSE (summary.stay_to_instant AT TIME ZONE property_context.timezone)::date >= property_context.business_date END)
                 THEN 'checked_in_today'
               WHEN page.status = 'in_house'
                 AND (summary.stay_from_instant AT TIME ZONE property_context.timezone)::date < property_context.business_date
                 THEN 'stayover'
               WHEN page.status = 'checked_out' AND EXISTS (
                 SELECT 1 FROM fact_log AS checkout_fact
                 WHERE checkout_fact.tenant_id = ${page.tenantId}::uuid
                   AND checkout_fact.entity_type = 'reservation'
                   AND checkout_fact.entity_id = page.id
                   AND checkout_fact.fact_type = 'reservation.checked_out'
                   AND checkout_fact.business_date = property_context.business_date
                   AND NOT EXISTS (
                     SELECT 1 FROM fact_log AS checkout_successor
                     WHERE checkout_successor.tenant_id = checkout_fact.tenant_id
                       AND checkout_successor.entity_type = checkout_fact.entity_type
                       AND checkout_successor.entity_id = checkout_fact.entity_id
                       AND checkout_successor.supersedes = checkout_fact.id
                   )
               ) THEN 'checked_out_today'
               ELSE page.status
             END AS operational_state,
             page.primary_party,
             party.id AS visible_primary_party_id, party.display_name,
             summary.stay_from, summary.stay_to, unit_type.name AS unit_type_label,
             sellable_unit.name AS sellable_unit_label, rate_plan.name AS rate_plan_label,
             coalesce(summary.adults, 0)::int AS adults, coalesce(summary.children, 0)::int AS children,
             page.channel_code, page.market_code, page.source_code, page.currency,
             to_char(page.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
             arrival_travel.direction AS arrival_direction,
             arrival_travel.mode AS arrival_mode,
             arrival_travel.carrier AS arrival_carrier,
             arrival_travel.service_no AS arrival_service_no,
             CASE WHEN arrival_travel.scheduled_at IS NULL THEN NULL ELSE
               to_char(arrival_travel.scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
             END AS arrival_scheduled_at,
             arrival_travel.pickup_requested AS arrival_pickup_requested,
             arrival_travel.pickup_task_id AS arrival_pickup_task_id,
             arrival_pickup_task.id AS visible_arrival_pickup_task_id,
             departure_travel.direction AS departure_direction,
             departure_travel.mode AS departure_mode,
             departure_travel.carrier AS departure_carrier,
             departure_travel.service_no AS departure_service_no,
             CASE WHEN departure_travel.scheduled_at IS NULL THEN NULL ELSE
               to_char(departure_travel.scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
             END AS departure_scheduled_at
      FROM page_reservations AS page
      JOIN property_context ON true
      LEFT JOIN party ON party.tenant_id = ${page.tenantId}::uuid AND party.id = page.primary_party
      LEFT JOIN segment_summary AS summary ON summary.reservation_id = page.id
      LEFT JOIN latest_segment AS latest ON latest.reservation_id = page.id
      LEFT JOIN unit_type ON unit_type.tenant_id = ${page.tenantId}::uuid
        AND unit_type.property_node = ${page.propertyNode}::uuid AND unit_type.id = latest.unit_type_id
      LEFT JOIN sellable_unit ON sellable_unit.tenant_id = ${page.tenantId}::uuid
        AND sellable_unit.id = latest.sellable_unit_id AND sellable_unit.unit_type_id = latest.unit_type_id
      LEFT JOIN rate_plan ON rate_plan.tenant_id = ${page.tenantId}::uuid
        AND rate_plan.property_node = ${page.propertyNode}::uuid AND rate_plan.id = latest.rate_plan_id
      LEFT JOIN travel_detail AS arrival_travel
        ON arrival_travel.tenant_id = ${page.tenantId}::uuid
       AND arrival_travel.reservation_id = page.id
       AND arrival_travel.direction = 'arrival'
      LEFT JOIN task AS arrival_pickup_task
        ON arrival_pickup_task.tenant_id = ${page.tenantId}::uuid
       AND arrival_pickup_task.property_node = ${page.propertyNode}::uuid
       AND arrival_pickup_task.id = arrival_travel.pickup_task_id
      LEFT JOIN travel_detail AS departure_travel
        ON departure_travel.tenant_id = ${page.tenantId}::uuid
       AND departure_travel.reservation_id = page.id
       AND departure_travel.direction = 'departure'
      ORDER BY page.created_at DESC, page.id DESC
    `;
    const hasMore = rows.length > page.limit;
    const visible = rows.slice(0, page.limit).map((row) => {
      const stayFrom = storedInstant(row.stay_from, "stay start");
      const stayTo = storedInstant(row.stay_to, "stay end");
      if (row.visible_primary_party_id !== row.primary_party || row.display_name === null ||
          stayFrom >= stayTo || row.display_name.length < 1 || row.confirmation_no.length < 1 ||
          row.channel_code.length < 1 || !CURRENCY.test(row.currency) ||
          !Number.isInteger(row.adults) || row.adults < 0 ||
          !Number.isInteger(row.children) || row.children < 0) {
        throw new ReservationBoardConflictError("Stored reservation board row is invalid");
      }
      return Object.freeze({
        reservationId: storedUuid(row.id),
        primaryPartyId: storedUuid(row.primary_party),
        confirmationNo: row.confirmation_no,
        status: storedStatus(row.status),
        operationalState: storedOperationalState(row.operational_state),
        primaryGuestDisplayName: row.display_name,
        stayFrom,
        stayTo,
        unitTypeLabel: required(row.unit_type_label, "unit type"),
        sellableUnitLabel: row.sellable_unit_label,
        ratePlanLabel: required(row.rate_plan_label, "rate plan"),
        adults: row.adults,
        children: row.children,
        channelCode: row.channel_code,
        marketCode: row.market_code,
        sourceCode: row.source_code,
        currency: row.currency,
        createdAt: storedInstant(row.created_at, "creation time"),
        arrivalTravel: arrivalTravel(row),
        departureTravel: departureTravel(row),
      });
    });
    const last = visible.at(-1);
    return Object.freeze({
      reservations: Object.freeze(visible),
      nextCursor: hasMore && last ? encodeCursor(page.stage === null ?
        { v: 1, createdAt: last.createdAt, id: last.reservationId } :
        { v: 2, createdAt: last.createdAt, id: last.reservationId, stage: page.stage, businessDate: businessDate!, query }) : null,
      ...(businessDate === undefined ? {} : { businessDate }),
    });
  }
}
