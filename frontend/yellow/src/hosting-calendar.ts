export type CalendarMode = "month" | "year" | "timeline";

export type CalendarRoom = Readonly<{
  sellableUnitId: string;
  sellableUnitLabel: string;
  unitTypeId: string;
  unitTypeCode: string;
  unitTypeLabel: string;
  roomCondition: string | null;
  outOfService: boolean | null;
}>;

export type CalendarSegment = Readonly<{
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

export type CalendarPage = Readonly<{
  propertyId: string;
  timezone: string;
  fromDate: string;
  toDateExclusive: string;
  limit: number;
  limited: boolean;
  roomLimit: number;
  roomsLimited: boolean;
  rooms: readonly CalendarRoom[];
  segments: readonly CalendarSegment[];
}>;

export type CalendarRange = Readonly<{ from: string; to: string }>;

export type CalendarEntry = Readonly<{
  key: string;
  page: CalendarPage;
  segment: CalendarSegment;
  start: number;
  endExclusive: number;
  dayUse: boolean;
  openable: boolean;
}>;

export type CalendarProjection = Readonly<{
  dates: readonly string[];
  entries: readonly CalendarEntry[];
  invalid: readonly string[];
}>;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVE_STATUSES = new Set(["quote", "reserved", "waitlist", "due_in", "in_house", "due_out", "checked_out"]);
const SEGMENT_STATUSES = new Set(["booked", "in_house", "departed"]);
const DAY_MS = 86_400_000;

function utcCivilDay(year: number, month: number, day: number): number {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime() / DAY_MS;
}

function civilDay(value: string): number | null {
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = utcCivilDay(year, month, day);
  const date = new Date(time * DAY_MS);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? time : null;
}

export function isCalendarDate(value: string): boolean {
  return civilDay(value) !== null;
}

export function calendarDateOffset(value: string, amount: number): string {
  const day = civilDay(value);
  if (day === null || !Number.isInteger(amount)) throw new RangeError("Calendar date or offset is invalid");
  return new Date((day + amount) * DAY_MS).toISOString().slice(0, 10);
}

export function calendarMonthDates(value: string): readonly (readonly (string | null)[])[] {
  const day = civilDay(value);
  if (day === null) throw new RangeError("Calendar month is invalid");
  const date = new Date(day * DAY_MS);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const count = new Date(utcCivilDay(year, month + 2, 0) * DAY_MS).getUTCDate();
  const leading = new Date(utcCivilDay(year, month + 1, 1) * DAY_MS).getUTCDay();
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let index = 1; index <= count; index += 1) cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(index).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
}

export function calendarYearMonths(year: number): readonly string[] {
  if (!Number.isInteger(year) || year < 1 || year > 9999) throw new RangeError("Calendar year is invalid");
  return Array.from({ length: 12 }, (_, index) => `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}-01`);
}

export function selectCalendarRange(current: CalendarRange | null, date: string): CalendarRange | null {
  if (!isCalendarDate(date)) throw new RangeError("Selected calendar date is invalid");
  if (!current || current.to !== "") return { from: date, to: "" };
  const first = civilDay(current.from)!;
  const selected = civilDay(date)!;
  return selected < first ? { from: date, to: current.from } : { from: current.from, to: date };
}

function validTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0);
    return true;
  } catch {
    return false;
  }
}

function localDateAt(instant: string, timezone: string): string | null {
  const partsOfInstant = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(instant);
  if (!partsOfInstant || !isCalendarDate(partsOfInstant[1]!) ||
      Number(partsOfInstant[2]) > 23 || Number(partsOfInstant[3]) > 59 || Number(partsOfInstant[4]) > 59 ||
      partsOfInstant[5] !== undefined && (Number(partsOfInstant[5]) > 23 || Number(partsOfInstant[6]) > 59)) return null;
  const time = Date.parse(instant);
  if (!Number.isFinite(time)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(time);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function projectCalendarPage(page: CalendarPage | null, start: string, days: number, timezone: string, roomId = "all"): CalendarProjection {
  if (!Number.isInteger(days) || days < 1 || days > 366 || !isCalendarDate(start)) throw new RangeError("Calendar window is invalid");
  const dates = Array.from({ length: days }, (_, index) => calendarDateOffset(start, index));
  const invalid: string[] = [];
  if (!page) return { dates, entries: [], invalid: ["Calendar data is unavailable"] };
  if (!UUID_RE.test(page.propertyId)) invalid.push("Property identity is malformed");
  if (!validTimezone(page.timezone)) invalid.push("Property timezone is invalid");
  if (page.timezone !== timezone) invalid.push("The selected property timezone changed; refresh the calendar");
  const pageFrom = civilDay(page.fromDate);
  const pageTo = civilDay(page.toDateExclusive);
  if (pageFrom === null || pageTo === null || pageTo <= pageFrom || pageTo - pageFrom > 366) invalid.push("Returned calendar date range is invalid");
  if (!Array.isArray(page.rooms) || !Array.isArray(page.segments)) invalid.push("Calendar records are malformed");
  if (page.limited) invalid.push("Reservation results are limited; this calendar is incomplete");
  if (page.roomsLimited) invalid.push("Listing results are limited; this calendar is incomplete");
  const rooms = new Map<string, CalendarRoom>();
  for (const room of page.rooms ?? []) {
    if (!UUID_RE.test(room.sellableUnitId) || !UUID_RE.test(room.unitTypeId) || !room.sellableUnitLabel?.trim() || !room.unitTypeLabel?.trim()) {
      invalid.push("A returned listing has an invalid identity or label");
      continue;
    }
    if (rooms.has(room.sellableUnitId)) invalid.push("Duplicate listing identity in calendar results");
    else rooms.set(room.sellableUnitId, room);
  }
  const first = civilDay(start)!;
  const rangeEnd = first + days;
  const knownSegments = new Set<string>();
  const entries: CalendarEntry[] = [];
  for (const [index, segment] of (page.segments ?? []).entries()) {
    if (segment.reservationStatus === "cancelled" || segment.reservationStatus === "no_show" || segment.segmentStatus === "cancelled") continue;
    const label = `Reservation segment ${segment.segmentId || index + 1}`;
    const idValid = UUID_RE.test(segment.reservationId) && UUID_RE.test(segment.segmentId);
    const from = civilDay(segment.localFromDate);
    const to = civilDay(segment.localToDateExclusive);
    const instantFrom = Date.parse(segment.stayFrom);
    const instantTo = Date.parse(segment.stayTo);
    const dayUse = from !== null && from === to;
    const statusValid = ACTIVE_STATUSES.has(segment.reservationStatus) && SEGMENT_STATUSES.has(segment.segmentStatus);
    if (from === null || to === null || to < from || to === from && !dayUse || !Number.isSafeInteger(segment.segmentSeq) || segment.segmentSeq < 1 ||
        !UUID_RE.test(segment.unitTypeId) ||
        !Number.isFinite(instantFrom) || !Number.isFinite(instantTo) || instantTo <= instantFrom ||
        !validTimezone(page.timezone) || localDateAt(segment.stayFrom, page.timezone) !== segment.localFromDate ||
        localDateAt(segment.stayTo, page.timezone) !== segment.localToDateExclusive || !statusValid) {
      invalid.push(`${label} has an invalid date, instant, timezone mapping, or status`);
      continue;
    }
    const room = segment.sellableUnitId === null ? null : rooms.get(segment.sellableUnitId);
    if (segment.sellableUnitId !== null && !UUID_RE.test(segment.sellableUnitId)) {
      invalid.push(`${label} has a malformed listing identity`);
      continue;
    }
    if (segment.sellableUnitId !== null && !room && !page.roomsLimited) {
      invalid.push(`${label} references a listing outside the returned property`);
      continue;
    }
    if (room && room.unitTypeId !== segment.unitTypeId) {
      invalid.push(`${label} listing and unit type do not match`);
      continue;
    }
    if (room && segment.sellableUnitLabel !== room.sellableUnitLabel) {
      invalid.push(`${label} listing label does not match the returned listing`);
      continue;
    }
    const startDay = from;
    const endDay = dayUse ? from + 1 : to;
    const visibleStart = Math.max(first, startDay, pageFrom ?? first);
    const visibleEnd = Math.min(rangeEnd, endDay, pageTo ?? rangeEnd);
    if (visibleEnd <= visibleStart) continue;
    const pageRangeContains = pageFrom !== null && pageTo !== null && visibleStart >= pageFrom && visibleEnd <= pageTo;
    if (!pageRangeContains) {
      invalid.push(`${label} falls outside the returned date window`);
      continue;
    }
    const duplicate = knownSegments.has(segment.segmentId);
    if (duplicate) invalid.push(`${label} duplicates a segment identity; both records are shown without an open action`);
    knownSegments.add(segment.segmentId);
    entries.push({
      key: `${page.propertyId}:${segment.segmentId}:${index}`,
      page,
      segment,
      start: visibleStart - first,
      endExclusive: visibleEnd - first,
      dayUse,
      openable: idValid && !duplicate,
    });
  }
  if (pageFrom !== null && pageTo !== null && (first < pageFrom || rangeEnd > pageTo)) invalid.push("The selected calendar dates extend beyond the returned page window");
  if (roomId !== "all") {
    const selected = roomId === "unassigned" ? null : roomId;
    return { dates, entries: entries.filter(entry => entry.segment.sellableUnitId === selected), invalid };
  }
  return { dates, entries, invalid };
}

export function assignCalendarLanes(entries: readonly CalendarEntry[], grouping: "room" | "calendar" = "room"): readonly Readonly<{ entry: CalendarEntry; lane: number }>[] {
  const rows = new Map<string, { endExclusive: number; lane: number }[]>();
  const result: { entry: CalendarEntry; lane: number }[] = [];
  const sorted = [...entries].sort((left, right) =>
    left.start - right.start || left.endExclusive - right.endExclusive || left.segment.segmentId.localeCompare(right.segment.segmentId),
  );
  for (const entry of sorted) {
    const roomKey = grouping === "calendar" ? "calendar" : entry.segment.sellableUnitId ?? `unassigned:${entry.page.propertyId}`;
    const lanes = rows.get(roomKey) ?? [];
    let lane = lanes.findIndex(last => last.endExclusive <= entry.start);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = { endExclusive: entry.endExclusive, lane };
    rows.set(roomKey, lanes);
    result.push({ entry, lane });
  }
  return result;
}

export function calendarStatusLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}
