export type ReservationCalendarRoom = Readonly<{
  sellableUnitId: string;
  sellableUnitLabel: string;
  unitTypeId: string;
  unitTypeCode: string;
  unitTypeLabel: string;
  roomCondition: string | null;
  outOfService: boolean | null;
}>;

export type ReservationCalendarSegment = Readonly<{
  reservationId: string;
  confirmationNo: string;
  primaryGuestDisplayName: string;
  reservationStatus: string;
  segmentId: string;
  segmentSeq: number;
  segmentStatus: string;
  stayFrom: string;
  stayTo: string;
  localFromDate: string;
  localToDateExclusive: string;
  clipFromDate: string;
  clipToDateExclusive: string;
  continuesBefore: boolean;
  continuesAfter: boolean;
  unitTypeId: string;
  unitTypeCode: string;
  unitTypeLabel: string;
  sellableUnitId: string | null;
  sellableUnitLabel: string | null;
  roomCondition: string | null;
  outOfService: boolean | null;
}>;

export type ReservationCalendar = Readonly<{
  propertyId: string;
  timezone: string;
  fromDate: string;
  toDateExclusive: string;
  limit: number;
  limited: boolean;
  segments: readonly ReservationCalendarSegment[];
  rooms: readonly ReservationCalendarRoom[];
  roomLimit: number;
  roomsLimited: boolean;
}>;

export type ReservationCalendarRow = Readonly<{
  id: string;
  label: string;
  unitTypeLabel: string;
  roomCondition: string | null;
  outOfService: boolean | null;
  assigned: boolean;
  segments: readonly ReservationCalendarSegment[];
}>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return value.slice(0, 4) !== "0000" && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addCalendarDays(value: string, days: number): string {
  if (!isIsoCalendarDate(value) || !Number.isSafeInteger(days)) return value;
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const result = date.toISOString().slice(0, 10);
  return isIsoCalendarDate(result) ? result : value;
}

export function calendarDays(fromDate: string, count = 7): readonly string[] {
  if (!isIsoCalendarDate(fromDate) || !Number.isSafeInteger(count) || count < 1 || count > 31) return [];
  return Object.freeze(Array.from({ length: count }, (_, index) => addCalendarDays(fromDate, index)));
}

export function reservationCalendarStatusLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/^./, (value) => value.toLocaleUpperCase());
}

export function reservationCalendarRows(
  calendar: ReservationCalendar,
  statusFilter = "",
  unitTypeFilter = "",
): readonly ReservationCalendarRow[] {
  const segments = calendar.segments.filter((segment) =>
    (!statusFilter || segment.reservationStatus === statusFilter) &&
    (!unitTypeFilter || segment.unitTypeId === unitTypeFilter));
  const byRoom = new Map<string, ReservationCalendarSegment[]>();
  const roomById = new Map(calendar.rooms.map((room) => [room.sellableUnitId, room]));
  const unassignedByType = new Map<string, ReservationCalendarSegment[]>();
  for (const segment of segments) {
    if (segment.sellableUnitId !== null) {
      const key = segment.sellableUnitId;
      const existing = byRoom.get(key) ?? [];
      existing.push(segment);
      byRoom.set(key, existing);
    } else {
      const key = segment.unitTypeId || "unknown";
      const existing = unassignedByType.get(key) ?? [];
      existing.push(segment);
      unassignedByType.set(key, existing);
    }
  }

  const rows: ReservationCalendarRow[] = calendar.rooms
    .filter((room) => !unitTypeFilter || room.unitTypeId === unitTypeFilter)
    .map((room) => Object.freeze({
    id: `room:${room.sellableUnitId}`,
    label: room.sellableUnitLabel,
    unitTypeLabel: `${room.unitTypeCode} · ${room.unitTypeLabel}`,
    roomCondition: room.roomCondition,
    outOfService: room.outOfService,
    assigned: true,
    segments: Object.freeze(byRoom.get(room.sellableUnitId) ?? []),
    }));

  for (const [roomId, roomSegments] of byRoom) {
    if (roomById.has(roomId)) continue;
    const first = roomSegments[0];
    if (!first) continue;
    rows.push(Object.freeze({
      id: `room:${roomId}`,
      label: first.sellableUnitLabel ?? "Assigned room",
      unitTypeLabel: `${first.unitTypeCode} · ${first.unitTypeLabel}`,
      roomCondition: first.roomCondition,
      outOfService: first.outOfService,
      assigned: true,
      segments: Object.freeze(roomSegments),
    }));
  }

  for (const [unitTypeId, roomSegments] of unassignedByType) {
    const first = roomSegments[0];
    if (!first) continue;
    rows.push(Object.freeze({
      id: `unassigned:${unitTypeId}`,
      label: "Unassigned stays",
      unitTypeLabel: `${first.unitTypeCode} · ${first.unitTypeLabel}`,
      roomCondition: null,
      outOfService: null,
      assigned: false,
      segments: Object.freeze(roomSegments),
    }));
  }
  return Object.freeze(rows);
}

export function segmentOccupiesCalendarDate(segment: ReservationCalendarSegment, date: string): boolean {
  return date >= segment.clipFromDate && date < segment.clipToDateExclusive;
}
