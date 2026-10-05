export type CalendarStay = Readonly<{
  reservationId: string; confirmationNo: string; status: string;
  primaryGuestDisplayName?: string; primaryPartyName?: string;
  stayFrom?: string; stayTo?: string; unitTypeLabel?: string | null;
  channelCode?: string; operationalState?: string;
}>;
export type CalendarEntry = Readonly<{
  stay: CalendarStay; arrival: string; departure: string;
  start: number; span: number; dayUse: boolean; departureOnly: boolean;
  continuesBefore: boolean; continuesAfter: boolean;
}>;
const DAY = 86_400_000;
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
}
export function calendarDateOffset(value: string, offset: number): string {
  if (!isCalendarDate(value) || !Number.isInteger(offset) || Math.abs(offset) > 366) throw new Error("Choose a valid calendar date.");
  const result = new Date(new Date(`${value}T12:00:00.000Z`).getTime() + offset * DAY).toISOString().slice(0, 10);
  if (!isCalendarDate(result)) throw new Error("Calendar date is outside the supported range.");
  return result;
}
export function calendarDays(start: string, count: number): readonly string[] {
  if (![7, 14, 30].includes(count)) throw new Error("Choose a 7, 14 or 30 day calendar.");
  return Array.from({ length: count }, (_, offset) => calendarDateOffset(start, offset));
}
export function calendarLocalDate(instant: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(instant) ||
      !isCalendarDate(instant.slice(0, 10)) || !Number.isFinite(Date.parse(instant)) ||
      Number(instant.slice(11, 13)) > 23 || Number(instant.slice(14, 16)) > 59 || Number(instant.slice(17, 19)) > 59) throw new Error("Reservation dates are unavailable.");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant));
  const part = (kind: string) => parts.find(item => item.type === kind)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
/** Earliest instant in a property civil day; midnight may not exist after DST. */
export function calendarDayBoundary(date: string, timezone: string): string {
  if (!isCalendarDate(date)) throw new Error("Choose a valid calendar date.");
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const localDate = (instant: number) => {
    const parts = formatter.formatToParts(new Date(instant));
    const part = (kind: string) => parts.find(item => item.type === kind)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  const center = Date.parse(`${date}T00:00:00.000Z`);
  let lower = center - 2 * DAY, upper = center + 2 * DAY;
  while (lower + 1 < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (localDate(middle) < date) lower = middle; else upper = middle;
  }
  if (localDate(upper) !== date || localDate(upper - 1) >= date) throw new Error("This date does not exist in the property timezone.");
  return new Date(upper).toISOString();
}
export function calendarGuest(stay: CalendarStay): string {
  return stay.primaryGuestDisplayName ?? stay.primaryPartyName ?? stay.confirmationNo;
}
export function projectCalendar(stays: readonly CalendarStay[], start: string, count: number, timezone: string) {
  const dates = calendarDays(start, count); const end = calendarDateOffset(start, count);
  // Validate the property timezone even for an empty server result.
  calendarLocalDate(`${start}T12:00:00.000Z`, timezone);
  const entries: CalendarEntry[] = []; let invalid = 0;
  const seen = new Set<string>();
  for (const stay of stays) {
    if (!stay.reservationId || seen.has(stay.reservationId)) { ++invalid; continue; }
    seen.add(stay.reservationId);
    try {
      if (!stay.stayFrom || !stay.stayTo || Date.parse(stay.stayFrom) >= Date.parse(stay.stayTo)) throw new Error("Invalid stay interval");
      const arrival = calendarLocalDate(stay.stayFrom, timezone), departure = calendarLocalDate(stay.stayTo, timezone);
      const dayUse = arrival === departure; const lastExclusive = dayUse ? calendarDateOffset(arrival, 1) : departure;
      const departureOnly = !dayUse && departure === start;
      if (arrival >= end || (lastExclusive <= start && !departureOnly)) continue;
      const first = arrival < start ? start : arrival, last = lastExclusive > end ? end : lastExclusive;
      const index = (date: string) => Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / DAY);
      entries.push({ stay, arrival, departure, start: departureOnly ? 0 : index(first), span: departureOnly ? 1 : index(last) - index(first), dayUse, departureOnly,
        continuesBefore: arrival < start, continuesAfter: lastExclusive > end });
    } catch { ++invalid; }
  }
  entries.sort((a, b) => a.arrival.localeCompare(b.arrival) || calendarGuest(a.stay).localeCompare(calendarGuest(b.stay)) || a.stay.reservationId.localeCompare(b.stay.reservationId));
  return { dates, entries, invalid };
}
export function filterCalendarEntries(entries: readonly CalendarEntry[], search: string, view: "active" | "all"): readonly CalendarEntry[] {
  const term = search.trim().toLocaleLowerCase();
  return entries.filter(({ stay }) => (view === "all" || !["cancelled", "no_show"].includes(stay.status)) &&
    (!term || [calendarGuest(stay), stay.confirmationNo, stay.unitTypeLabel, stay.channelCode].some(value => value?.toLocaleLowerCase().includes(term))));
}
