import { addCalendarDays, isIsoCalendarDate, reservationCalendarStatusLabel, type ReservationCalendar, type ReservationCalendarSegment } from "./reservation-calendar";

export function calendarSegmentLabel(segment: ReservationCalendarSegment): string {
  return segment.segmentStatus === "departed" ? "Departed segment" : reservationCalendarStatusLabel(segment.reservationStatus);
}

export function calendarSegmentBadge(segment: ReservationCalendarSegment): string {
  if (segment.segmentStatus === "departed" || segment.reservationStatus === "checked_out") return "OUT";
  return ({ in_house: "IN", due_in: "ARR", due_out: "DUE", reserved: "RSV", cancelled: "CXL", no_show: "NS" } as Record<string, string>)[segment.reservationStatus] ?? "STAY";
}

export function calendarMatchesContext(calendar: ReservationCalendar, propertyId: string, timezone: string, from: string, to: string): boolean {
  return calendar.propertyId === propertyId && calendar.timezone === timezone && calendar.fromDate === from && calendar.toDateExclusive === to;
}

export type CalendarView = "list" | "month" | "year";
export type CalendarBarTone = "upcoming" | "active" | "completed" | "inactive";
export type CalendarWeekBar = Readonly<{
  segment: ReservationCalendarSegment;
  column: number;
  span: number;
  lane: number;
  starts: boolean;
  ends: boolean;
}>;

export function monthStart(date: string): string {
  return isIsoCalendarDate(date) ? `${date.slice(0, 7)}-01` : "";
}

export function shiftCalendarMonth(date: string, offset: number): string {
  if (!isIsoCalendarDate(date) || !Number.isSafeInteger(offset)) return "";
  const parsed = new Date(`${monthStart(date)}T12:00:00Z`);
  parsed.setUTCMonth(parsed.getUTCMonth() + offset);
  if (!Number.isFinite(parsed.getTime())) return "";
  // The query's exclusive end must remain a four-digit ISO year.
  const result = parsed.toISOString().slice(0, 10);
  return isIsoCalendarDate(result) ? result : "";
}

export function calendarMonthDates(date: string): readonly string[] {
  const start = monthStart(date);
  const end = shiftCalendarMonth(date, 1);
  if (!start || !end) return [];
  const result: string[] = [];
  for (let current = start; current < end; current = addCalendarDays(current, 1)) {
    result.push(current);
  }
  return result;
}

export function calendarMonthWeeks(date: string): readonly (readonly (string | null)[])[] {
  const dates = calendarMonthDates(date);
  if (!dates.length) return [];
  const cells: (string | null)[] = Array(new Date(`${dates[0]}T12:00:00Z`).getUTCDay()).fill(null);
  cells.push(...dates);
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
}

export function calendarBarTone(segment: ReservationCalendarSegment): CalendarBarTone {
  // A departed room segment remains historical after a room move, even while
  // another segment of the same reservation is still in house.
  if (segment.segmentStatus === "departed") return "completed";
  // A past departure date never completes an occupied stay.
  if (["in_house", "due_out"].includes(segment.reservationStatus) || segment.segmentStatus === "in_house") return "active";
  if (["checked_out", "post_departure"].includes(segment.reservationStatus)) return "completed";
  if (["cancelled", "no_show"].includes(segment.reservationStatus)) return "inactive";
  return "upcoming";
}

export function calendarWeekBars(week: readonly (string | null)[], segments: readonly ReservationCalendarSegment[]): readonly CalendarWeekBar[] {
  const occupied: Set<number>[] = [];
  const bars: CalendarWeekBar[] = [];
  const sorted = [...segments].sort((a, b) => a.clipFromDate.localeCompare(b.clipFromDate) || a.segmentId.localeCompare(b.segmentId));
  for (const segment of sorted) {
    const columns = week.flatMap((date, index) => date && date >= segment.clipFromDate && date < segment.clipToDateExclusive ? [index] : []);
    const first = columns[0];
    const last = columns.at(-1);
    if (first === undefined || last === undefined) continue;
    let lane = occupied.findIndex((taken) => columns.every((column) => !taken.has(column)));
    if (lane < 0) { lane = occupied.length; occupied.push(new Set()); }
    for (const column of columns) occupied[lane]!.add(column);
    bars.push({ segment, column: first + 1, span: last - first + 1, lane,
      starts: week[first] === segment.localFromDate,
      ends: addCalendarDays(week[last]!, 1) === segment.localToDateExclusive });
  }
  return bars;
}
