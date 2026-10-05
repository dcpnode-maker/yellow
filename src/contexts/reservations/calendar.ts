import type { Tx } from "../../kernel";
import { RESERVATION_STATUSES, type ReservationStatus } from "./state-machine";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
export const RESERVATION_CALENDAR_SEGMENT_LIMIT = 1000;
export const RESERVATION_CALENDAR_ROOM_LIMIT = 500;

export type ReservationCalendarInput = Readonly<{ tenantId: string; propertyNode: string; fromDate: string; toDateExclusive: string }>;
export type ReservationCalendarRoom = Readonly<{
  sellableUnitId: string; sellableUnitLabel: string; unitTypeId: string; unitTypeCode: string; unitTypeLabel: string;
  roomCondition: string | null; outOfService: boolean | null;
}>;
export type ReservationCalendarSegment = Readonly<{
  reservationId: string; confirmationNo: string; primaryGuestDisplayName: string; reservationStatus: ReservationStatus;
  segmentId: string; segmentSeq: number; segmentStatus: "booked" | "in_house" | "departed";
  stayFrom: string; stayTo: string; localFromDate: string; localToDateExclusive: string;
  clipFromDate: string; clipToDateExclusive: string; continuesBefore: boolean; continuesAfter: boolean;
  unitTypeId: string; unitTypeCode: string; unitTypeLabel: string;
  sellableUnitId: string | null; sellableUnitLabel: string | null;
  roomCondition: string | null; outOfService: boolean | null;
}>;
export type ReservationCalendarPage = Readonly<{
  propertyId: string; timezone: string; fromDate: string; toDateExclusive: string;
  limit: number; limited: boolean; roomLimit: number; roomsLimited: boolean;
  rooms: readonly ReservationCalendarRoom[]; segments: readonly ReservationCalendarSegment[];
}>;

export class ReservationCalendarValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ReservationCalendarValidationError"; }
}
export class ReservationCalendarConflictError extends Error {
  constructor(message: string) { super(message); this.name = "ReservationCalendarConflictError"; }
}

export function reservationCalendarDates(fromDate: string, toDateExclusive: string): number {
  const day = (value: string): number => {
    if (!LOCAL_DATE.test(value) || value.startsWith("0000-")) throw new ReservationCalendarValidationError("Calendar dates must be ISO local dates");
    const time = Date.parse(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new ReservationCalendarValidationError("Calendar date does not exist");
    return time;
  };
  const days = (day(toDateExclusive) - day(fromDate)) / 86_400_000;
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new ReservationCalendarValidationError("Calendar range must be 1 to 366 local days");
  return days;
}

/** Earliest instant in a civil day, including midnight DST folds and gaps. */
export function reservationCalendarBoundary(date: string, timezone: string): string {
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  reservationCalendarDates(date, next);
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }); }
  catch { throw new ReservationCalendarConflictError("Calendar property timezone is invalid"); }
  const civil = (at: number) => {
    const parts = formatter.formatToParts(at);
    const part = (kind: string) => parts.find(item => item.type === kind)?.value ?? "";
    return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
  };
  const center = Date.parse(`${date}T00:00:00Z`);
  let lower = center - 172_800_000, upper = center + 172_800_000;
  while (lower + 1 < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (civil(middle) < date) lower = middle; else upper = middle;
  }
  if (civil(upper) !== date || civil(upper - 1) >= date) throw new ReservationCalendarConflictError("Calendar date does not exist in the property timezone");
  return new Date(upper).toISOString();
}

type PropertyRow = { id: string; timezone: string };
type RoomRow = {
  sellable_unit_id: string; sellable_unit_label: string; unit_type_id: string; unit_type_code: string; unit_type_label: string;
  room_condition: string | null; out_of_service: boolean | null;
};
type SegmentRow = {
  reservation_id: string; confirmation_no: string; display_name: string | null; reservation_status: string;
  segment_id: string; segment_seq: number; segment_status: string;
  stay_from: string; stay_to: string; local_from_date: string; local_to_date_exclusive: string;
  clip_from_date: string; clip_to_date_exclusive: string; continues_before: boolean; continues_after: boolean;
  segment_unit_type_id: string; unit_type_id: string | null; unit_type_code: string | null; unit_type_label: string | null;
  assigned_sellable_unit_id: string | null; sellable_unit_id: string | null; sellable_unit_label: string | null;
};

function validUuid(value: string): string {
  if (!UUID.test(value)) throw new ReservationCalendarConflictError("Stored calendar identity is invalid");
  return value;
}
function validDate(value: string): string {
  if (!LOCAL_DATE.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) throw new ReservationCalendarConflictError("Stored calendar date is invalid");
  return value;
}
function validInstant(value: string): string {
  if (!UTC_INSTANT.test(value)) throw new ReservationCalendarConflictError("Stored calendar instant is invalid");
  return value;
}
function required(value: string | null): string {
  if (!value || !value.trim()) throw new ReservationCalendarConflictError("Stored calendar label is missing");
  return value;
}
function status(value: string): ReservationStatus {
  const found = RESERVATION_STATUSES.find(item => item === value);
  if (!found) throw new ReservationCalendarConflictError("Stored reservation status is invalid");
  return found;
}
function segmentStatus(value: string): ReservationCalendarSegment["segmentStatus"] {
  if (value !== "booked" && value !== "in_house" && value !== "departed") throw new ReservationCalendarConflictError("Stored segment status is invalid");
  return value;
}
function contextCondition(value: string | null): string | null {
  if (value !== null && !["clean", "dirty", "pickup", "inspected"].includes(value)) throw new ReservationCalendarConflictError("Stored room condition is invalid");
  return value;
}

export class ReservationCalendarService {
  async list(tx: Tx, input: ReservationCalendarInput): Promise<ReservationCalendarPage> {
    if (!UUID.test(input.tenantId) || !UUID.test(input.propertyNode)) throw new ReservationCalendarValidationError("Calendar tenant/property is invalid");
    reservationCalendarDates(input.fromDate, input.toDateExclusive);
    const properties = await tx<PropertyRow[]>`
      SELECT property.id, property.timezone
      FROM org_node AS property
      WHERE property.tenant_id = ${input.tenantId}::uuid
        AND property.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property.id = ${input.propertyNode}::uuid AND property.kind = 'property'
    `;
    if (properties.length !== 1 || !properties[0]?.timezone) throw new ReservationCalendarConflictError("Calendar property is not available");
    const timezone = properties[0].timezone;
    const fromAt = reservationCalendarBoundary(input.fromDate, timezone);
    const toAt = reservationCalendarBoundary(input.toDateExclusive, timezone);
    const rooms = await tx<RoomRow[]>`
      WITH calendar_window AS MATERIALIZED (
        SELECT ${fromAt}::timestamptz AS from_at,
               ${toAt}::timestamptz AS to_at
      )
      SELECT su.id AS sellable_unit_id, su.name AS sellable_unit_label,
             ut.id AS unit_type_id, ut.code AS unit_type_code, ut.name AS unit_type_label,
             context.room_condition, context.out_of_service
      FROM sellable_unit AS su
      JOIN unit_type AS ut ON ut.id = su.unit_type_id
        AND ut.tenant_id = ${input.tenantId}::uuid
        AND ut.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND ut.property_node = ${input.propertyNode}::uuid
      LEFT JOIN LATERAL (
        SELECT CASE WHEN count(*) = 1 THEN max(condition.condition) ELSE NULL END AS room_condition,
               CASE WHEN count(*) = 0 THEN NULL ELSE bool_or(EXISTS (
                 SELECT 1 FROM ooo_oos AS block, calendar_window
                 WHERE block.tenant_id = ${input.tenantId}::uuid
                   AND block.tenant_id = current_setting('app.tenant_id', true)::uuid
                   AND block.space_id = space.id
                   AND block.period && tstzrange(calendar_window.from_at, calendar_window.to_at, '[)')
               )) END AS out_of_service
        FROM sellable_unit_space AS link
        JOIN space ON space.id = link.space_id
          AND space.tenant_id = ${input.tenantId}::uuid
          AND space.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND space.property_node = ${input.propertyNode}::uuid
        LEFT JOIN unit_condition AS condition ON condition.space_id = space.id
          AND condition.tenant_id = ${input.tenantId}::uuid
          AND condition.tenant_id = current_setting('app.tenant_id', true)::uuid
        WHERE link.tenant_id = ${input.tenantId}::uuid
          AND link.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND link.sellable_unit_id = su.id
      ) AS context ON true
      WHERE su.tenant_id = ${input.tenantId}::uuid
        AND su.tenant_id = current_setting('app.tenant_id', true)::uuid
      ORDER BY ut.code COLLATE "C", su.name COLLATE "C", su.id
      LIMIT ${RESERVATION_CALENDAR_ROOM_LIMIT + 1}
    `;
    const visibleRooms = rooms.slice(0, RESERVATION_CALENDAR_ROOM_LIMIT).map(row => Object.freeze({
      sellableUnitId: validUuid(row.sellable_unit_id), sellableUnitLabel: required(row.sellable_unit_label),
      unitTypeId: validUuid(row.unit_type_id), unitTypeCode: required(row.unit_type_code), unitTypeLabel: required(row.unit_type_label),
      roomCondition: contextCondition(row.room_condition), outOfService: row.out_of_service,
    }));
    const roomContext = new Map(visibleRooms.map(room => [room.sellableUnitId, room]));
    const segments = await tx<SegmentRow[]>`
      WITH calendar_window AS MATERIALIZED (
        SELECT ${fromAt}::timestamptz AS from_at,
               ${toAt}::timestamptz AS to_at
      )
      SELECT reservation.id AS reservation_id, reservation.confirmation_no,
             party.display_name, reservation.status AS reservation_status,
             segment.id AS segment_id, segment.seq AS segment_seq, segment.status AS segment_status,
             to_char(lower(segment.period) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS stay_from,
             to_char(upper(segment.period) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS stay_to,
             (lower(segment.period) AT TIME ZONE ${timezone})::date::text AS local_from_date,
             (upper(segment.period) AT TIME ZONE ${timezone})::date::text AS local_to_date_exclusive,
             greatest((lower(segment.period) AT TIME ZONE ${timezone})::date, ${input.fromDate}::date)::text AS clip_from_date,
             least((CASE WHEN (upper(segment.period) AT TIME ZONE ${timezone})::date = (lower(segment.period) AT TIME ZONE ${timezone})::date
               THEN (upper(segment.period) AT TIME ZONE ${timezone})::date + 1
               ELSE (upper(segment.period) AT TIME ZONE ${timezone})::date END), ${input.toDateExclusive}::date)::text AS clip_to_date_exclusive,
             (lower(segment.period) AT TIME ZONE ${timezone})::date < ${input.fromDate}::date AS continues_before,
             (CASE WHEN (upper(segment.period) AT TIME ZONE ${timezone})::date = (lower(segment.period) AT TIME ZONE ${timezone})::date
               THEN (upper(segment.period) AT TIME ZONE ${timezone})::date + 1
               ELSE (upper(segment.period) AT TIME ZONE ${timezone})::date END) > ${input.toDateExclusive}::date AS continues_after,
             segment.unit_type_id AS segment_unit_type_id,
             ut.id AS unit_type_id, ut.code AS unit_type_code, ut.name AS unit_type_label,
             segment.sellable_unit_id AS assigned_sellable_unit_id,
             su.id AS sellable_unit_id, su.name AS sellable_unit_label
      FROM reservation_segment AS segment
      JOIN reservation ON reservation.id = segment.reservation_id
        AND reservation.tenant_id = ${input.tenantId}::uuid
        AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND reservation.property_node = ${input.propertyNode}::uuid
        AND reservation.status NOT IN ('cancelled', 'no_show')
      LEFT JOIN party ON party.id = reservation.primary_party
        AND party.tenant_id = ${input.tenantId}::uuid
        AND party.tenant_id = current_setting('app.tenant_id', true)::uuid
      LEFT JOIN unit_type AS ut ON ut.id = segment.unit_type_id
        AND ut.tenant_id = ${input.tenantId}::uuid
        AND ut.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND ut.property_node = ${input.propertyNode}::uuid
      LEFT JOIN sellable_unit AS su ON su.id = segment.sellable_unit_id
        AND su.tenant_id = ${input.tenantId}::uuid
        AND su.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND su.unit_type_id = segment.unit_type_id
      JOIN calendar_window ON segment.period && tstzrange(calendar_window.from_at, calendar_window.to_at, '[)')
      WHERE segment.tenant_id = ${input.tenantId}::uuid
        AND segment.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND segment.status <> 'cancelled'
        AND (lower(segment.period) AT TIME ZONE ${timezone})::date < ${input.toDateExclusive}::date
        AND (CASE WHEN (upper(segment.period) AT TIME ZONE ${timezone})::date = (lower(segment.period) AT TIME ZONE ${timezone})::date
               THEN (upper(segment.period) AT TIME ZONE ${timezone})::date + 1
               ELSE (upper(segment.period) AT TIME ZONE ${timezone})::date END) > ${input.fromDate}::date
      ORDER BY lower(segment.period), reservation.id, segment.seq, segment.id
      LIMIT ${RESERVATION_CALENDAR_SEGMENT_LIMIT + 1}
    `;
    const visibleSegments = segments.slice(0, RESERVATION_CALENDAR_SEGMENT_LIMIT).map(row => {
      if (row.unit_type_id !== row.segment_unit_type_id ||
          row.assigned_sellable_unit_id !== row.sellable_unit_id ||
          row.sellable_unit_id === null && row.sellable_unit_label !== null ||
          row.sellable_unit_id !== null && row.sellable_unit_label === null ||
          !Number.isSafeInteger(row.segment_seq) || row.segment_seq < 1) throw new ReservationCalendarConflictError("Stored calendar segment is incoherent");
      const sellableUnitId = row.sellable_unit_id === null ? null : validUuid(row.sellable_unit_id);
      const context = sellableUnitId ? roomContext.get(sellableUnitId) : null;
      return Object.freeze({
        reservationId: validUuid(row.reservation_id), confirmationNo: required(row.confirmation_no),
        primaryGuestDisplayName: row.display_name?.trim() ? row.display_name : required(row.confirmation_no), reservationStatus: status(row.reservation_status),
        segmentId: validUuid(row.segment_id), segmentSeq: row.segment_seq, segmentStatus: segmentStatus(row.segment_status),
        stayFrom: validInstant(row.stay_from), stayTo: validInstant(row.stay_to),
        localFromDate: validDate(row.local_from_date), localToDateExclusive: validDate(row.local_to_date_exclusive),
        clipFromDate: validDate(row.clip_from_date), clipToDateExclusive: validDate(row.clip_to_date_exclusive),
        continuesBefore: row.continues_before, continuesAfter: row.continues_after,
        unitTypeId: validUuid(row.segment_unit_type_id), unitTypeCode: required(row.unit_type_code), unitTypeLabel: required(row.unit_type_label),
        sellableUnitId, sellableUnitLabel: row.sellable_unit_label,
        roomCondition: context?.roomCondition ?? null, outOfService: context?.outOfService ?? null,
      });
    });
    return Object.freeze({
      propertyId: input.propertyNode, timezone, fromDate: input.fromDate, toDateExclusive: input.toDateExclusive,
      limit: RESERVATION_CALENDAR_SEGMENT_LIMIT, limited: segments.length > RESERVATION_CALENDAR_SEGMENT_LIMIT,
      roomLimit: RESERVATION_CALENDAR_ROOM_LIMIT, roomsLimited: rooms.length > RESERVATION_CALENDAR_ROOM_LIMIT,
      rooms: Object.freeze(visibleRooms), segments: Object.freeze(visibleSegments),
    });
  }
}
