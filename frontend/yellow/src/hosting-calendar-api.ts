import { calendarDateOffset, isCalendarDate, projectCalendarPage, type CalendarPage } from "./hosting-calendar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_KEYS = ["propertyId", "timezone", "fromDate", "toDateExclusive", "limit", "limited", "roomLimit", "roomsLimited", "rooms", "segments"];
const ROOM_KEYS = ["sellableUnitId", "sellableUnitLabel", "unitTypeId", "unitTypeCode", "unitTypeLabel", "roomCondition", "outOfService"];
const SEGMENT_KEYS = ["reservationId", "confirmationNo", "primaryGuestDisplayName", "reservationStatus", "segmentId", "segmentSeq", "segmentStatus", "stayFrom", "stayTo", "localFromDate", "localToDateExclusive", "clipFromDate", "clipToDateExclusive", "continuesBefore", "continuesAfter", "unitTypeId", "unitTypeCode", "unitTypeLabel", "sellableUnitId", "sellableUnitLabel", "roomCondition", "outOfService"];
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const condition = (value: unknown) => value === null || ["clean", "dirty", "pickup", "inspected"].includes(value as string);
const nullableBool = (value: unknown) => value === null || typeof value === "boolean";

export type CalendarRead = Readonly<{ propertyId: string; from: string; to: string; timezone?: string; signal?: AbortSignal }>;

export function calendarReadDays(from: string, to: string): number {
  if (!isCalendarDate(from) || !isCalendarDate(to) || from.startsWith("0000-") || to.startsWith("0000-")) throw new Error("Choose valid calendar dates.");
  const count = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (!Number.isInteger(count) || count < 1 || count > 366) throw new Error("Choose a calendar range of 1 to 366 days.");
  return count;
}

export function validateHostingCalendar(value: unknown, read: CalendarRead): CalendarPage {
  const days = calendarReadDays(read.from, read.to);
  if (!UUID.test(read.propertyId) || !exact(value, PAGE_KEYS) || value.propertyId !== read.propertyId ||
      value.fromDate !== read.from || value.toDateExclusive !== read.to || !text(value.timezone) ||
      read.timezone !== undefined && value.timezone !== read.timezone || value.limit !== 1000 || value.roomLimit !== 500 ||
      typeof value.limited !== "boolean" || typeof value.roomsLimited !== "boolean" ||
      !Array.isArray(value.rooms) || !Array.isArray(value.segments) || value.rooms.length > 500 || value.segments.length > 1000) {
    throw new Error("Calendar response does not match the selected property and dates.");
  }
  if (value.limited || value.roomsLimited) throw new Error("This calendar exceeds the returned record limit. A complete calendar is unavailable; use a shorter range or the reservation list.");
  for (const room of value.rooms) {
    if (!exact(room, ROOM_KEYS) || !text(room.sellableUnitId) || !UUID.test(room.sellableUnitId) || !text(room.unitTypeId) || !UUID.test(room.unitTypeId) ||
        !text(room.sellableUnitLabel) || !text(room.unitTypeCode) || !text(room.unitTypeLabel) || !condition(room.roomCondition) || !nullableBool(room.outOfService)) {
      throw new Error("Calendar returned malformed accommodation records.");
    }
  }
  for (const segment of value.segments) {
    if (!exact(segment, SEGMENT_KEYS) || !text(segment.reservationId) || !UUID.test(segment.reservationId) || !text(segment.segmentId) || !UUID.test(segment.segmentId) ||
        !text(segment.confirmationNo) || !text(segment.primaryGuestDisplayName) || !text(segment.reservationStatus) || !text(segment.segmentStatus) ||
        !text(segment.unitTypeId) || !UUID.test(segment.unitTypeId) || !text(segment.unitTypeCode) || !text(segment.unitTypeLabel) ||
        !text(segment.stayFrom) || !text(segment.stayTo) || !text(segment.localFromDate) || !text(segment.localToDateExclusive) ||
        !text(segment.clipFromDate) || !text(segment.clipToDateExclusive) || !isCalendarDate(segment.clipFromDate) || !isCalendarDate(segment.clipToDateExclusive) ||
        !Number.isSafeInteger(segment.segmentSeq) || (segment.segmentSeq as number) < 1 ||
        typeof segment.continuesBefore !== "boolean" || typeof segment.continuesAfter !== "boolean" ||
        !(segment.sellableUnitId === null && segment.sellableUnitLabel === null || text(segment.sellableUnitId) && UUID.test(segment.sellableUnitId) && text(segment.sellableUnitLabel)) ||
        !condition(segment.roomCondition) || !nullableBool(segment.outOfService)) {
      throw new Error("Calendar returned malformed reservation segments.");
    }
    const effectiveEnd = segment.localFromDate === segment.localToDateExclusive ? calendarDateOffset(segment.localFromDate, 1) : segment.localToDateExclusive;
    if (segment.clipFromDate !== (segment.localFromDate < read.from ? read.from : segment.localFromDate) ||
        segment.clipToDateExclusive !== (effectiveEnd > read.to ? read.to : effectiveEnd) ||
        segment.clipFromDate >= segment.clipToDateExclusive ||
        segment.continuesBefore !== (segment.localFromDate < read.from) || segment.continuesAfter !== (effectiveEnd > read.to)) {
      throw new Error("Calendar segment clipping is inconsistent.");
    }
  }
  const page = value as unknown as CalendarPage;
  const projection = projectCalendarPage(page, read.from, days, page.timezone);
  if (projection.invalid.length || projection.entries.length !== page.segments.length) throw new Error("Calendar evidence is inconsistent or incomplete.");
  return page;
}

export async function requestHostingCalendar(read: CalendarRead, token: string, transport: typeof fetch = fetch): Promise<CalendarPage> {
  calendarReadDays(read.from, read.to);
  if (!UUID.test(read.propertyId)) throw new Error("Calendar property is invalid.");
  const query = new URLSearchParams({ from: read.from, to: read.to });
  const response = await transport(`/api/v1/properties/${read.propertyId}/reservation-calendar?${query}`, {
    headers: { authorization: `Bearer ${token}` }, ...(read.signal ? { signal: read.signal } : {}),
  });
  if (!response.ok) throw new Error(response.status === 403 ? "Calendar access is not granted for this property." : "Calendar data is unavailable.");
  const body = await response.text();
  if (body.length > 4_194_304) throw new Error("Calendar response is too large to display safely.");
  let value: unknown;
  try { value = JSON.parse(body); } catch { throw new Error("Calendar response is malformed."); }
  return validateHostingCalendar(value, read);
}
