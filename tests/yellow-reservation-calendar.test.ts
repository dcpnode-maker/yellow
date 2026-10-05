import { expect, test } from "bun:test";
import { calendarDays, calendarDateOffset, calendarDayBoundary, calendarLocalDate, isCalendarDate, projectCalendar, filterCalendarEntries, type CalendarStay } from "../frontend/yellow/src/reservation-calendar";
import { collectReservationBoardPages } from "../frontend/yellow/src/reservation-board";
const stay = (id: string, from: string, to: string, status = "due_in"): CalendarStay => ({ reservationId: id, confirmationNo: id, primaryGuestDisplayName: "Guest " + id, stayFrom: from, stayTo: to, status });
test("civil calendar dates handle leap days, year boundaries and malformed inputs", () => {
  expect(calendarDateOffset("2028-02-28", 1)).toBe("2028-02-29"); expect(calendarDateOffset("2027-02-28", 1)).toBe("2027-03-01");
  expect(calendarDateOffset("2026-12-31", 1)).toBe("2027-01-01"); expect(calendarDateOffset("2027-01-01", -1)).toBe("2026-12-31");
  for (const date of ["2026-02-29", "2026-04-31", "2026-1-02", "", "2026-10-02T00:00:00Z"]) expect(isCalendarDate(date)).toBe(false);
  for (const count of [7, 14, 30]) expect(calendarDays("2026-10-02", count)).toHaveLength(count);
  expect(() => calendarDays("2026-10-02", 365)).toThrow();
});
test("property-local projection follows DST and dates across UTC boundaries", () => {
  expect(calendarLocalDate("2026-10-01T23:30:00.000000Z", "Asia/Kolkata")).toBe("2026-10-02");
  expect(calendarDays("2026-03-28", 7).slice(0, 3)).toEqual(["2026-03-28", "2026-03-29", "2026-03-30"]);
  const result = projectCalendar([stay("dst", "2026-03-28T14:00:00Z", "2026-03-30T10:00:00Z")], "2026-03-28", 7, "Europe/London");
  expect(result.entries[0]?.span).toBe(2);
  expect(() => projectCalendar([], "2026-10-02", 7, "Invalid/Timezone")).toThrow();
});
test("day boundaries use actual civil-day starts through midnight DST and reject a skipped day", () => {
  expect(calendarDayBoundary("2026-09-06", "America/Santiago")).toBe("2026-09-06T04:00:00.000Z");
  expect(calendarLocalDate(calendarDayBoundary("2026-09-06", "America/Santiago"), "America/Santiago")).toBe("2026-09-06");
  const spring = Date.parse(calendarDayBoundary("2026-03-30", "Europe/London")) - Date.parse(calendarDayBoundary("2026-03-29", "Europe/London"));
  const autumn = Date.parse(calendarDayBoundary("2026-10-26", "Europe/London")) - Date.parse(calendarDayBoundary("2026-10-25", "Europe/London"));
  expect(spring).toBe(23 * 3_600_000); expect(autumn).toBe(25 * 3_600_000);
  expect(calendarDayBoundary("2026-10-02", "Asia/Kolkata")).toBe("2026-10-01T18:30:00.000Z");
  expect(() => calendarDayBoundary("2011-12-30", "Pacific/Apia")).toThrow("does not exist");
});
test("overnight checkout is exclusive, day use and first-day departure have explicit markers", () => {
  const result = projectCalendar([
    stay("overnight", "2026-10-02T14:00:00Z", "2026-10-04T10:00:00Z"),
    stay("day", "2026-10-03T08:00:00Z", "2026-10-03T14:00:00Z"),
    stay("depart", "2026-09-29T14:00:00Z", "2026-10-02T10:00:00Z"),
    stay("outside", "2026-09-28T14:00:00Z", "2026-10-01T10:00:00Z"),
  ], "2026-10-02", 7, "UTC");
  expect(result.entries.map(row => row.stay.reservationId)).toEqual(["depart", "overnight", "day"]);
  expect(result.entries.find(row => row.stay.reservationId === "overnight")).toMatchObject({ start: 0, span: 2, dayUse: false });
  expect(result.entries.find(row => row.stay.reservationId === "day")).toMatchObject({ start: 1, span: 1, dayUse: true });
  expect(result.entries.find(row => row.stay.reservationId === "depart")).toMatchObject({ start: 0, span: 1, departureOnly: true, dayUse: false });
  expect(result.invalid).toBe(0);
});
test("clips long summaries and distinguishes invalid evidence, identity and history filters", () => {
  const long = { ...stay("long", "2026-09-01T14:00:00Z", "2026-11-01T10:00:00Z"), channelCode: "airbnb", unitTypeLabel: "Villa" };
  const result = projectCalendar([long, stay("cancelled", "2026-10-02T14:00:00Z", "2026-10-03T10:00:00Z", "cancelled"),
    stay("equal", "2026-10-02T14:00:00Z", "2026-10-02T14:00:00Z"), stay("bad", "2026-02-30T14:00:00Z", "2026-10-03T10:00:00Z"), long], "2026-10-02", 14, "UTC");
  expect(result.invalid).toBe(3); expect(result.entries.find(row => row.stay.reservationId === "long")).toMatchObject({ span: 14, continuesBefore: true, continuesAfter: true });
  expect(filterCalendarEntries(result.entries, "", "active")).toHaveLength(1); expect(filterCalendarEntries(result.entries, "", "all")).toHaveLength(2);
  expect(filterCalendarEntries(result.entries, "AIRBNB", "active")[0]?.stay.reservationId).toBe("long");
  expect(filterCalendarEntries(result.entries, "Villa", "active")).toHaveLength(1); expect(filterCalendarEntries(result.entries, "missing", "all")).toHaveLength(0);
});
test("actual board range reader sends every range/cursor and abort signal without changing legacy reads", async () => {
  const source = await Bun.file(new URL("../frontend/yellow/src/yellow-api.tsx", import.meta.url)).text();
  const block = source.slice(source.indexOf("async function loadReservationBoard()"), source.indexOf("async function loadGroupBlocks()"));
  const script = new Bun.Transpiler({ loader: "tsx" }).transformSync(block);
  const calls: { url: string; signal: AbortSignal | undefined }[] = [];
  const signal = new AbortController().signal;
  const replies = [{ reservations: [stay("one", "2026-10-02T14:00:00Z", "2026-10-03T10:00:00Z")], nextCursor: "page2" }, { reservations: [], nextCursor: null }];
  const make = new Function("session", "collectReservationBoardPages", "fetch", "propertyId", script + "\nreturn {loadReservationBoard,loadReservationCalendarBoard};");
  const client = make(async () => "fixture-token", collectReservationBoardPages, async (url: string, options: { signal: AbortSignal; headers: { authorization: string } }) => {
    expect(options.headers.authorization).toBe("Bearer fixture-token"); calls.push({ url, signal: options.signal });
    return { ok: true, json: async () => replies[calls.length - 1] };
  }, "fixture-property");
  expect((await client.loadReservationCalendarBoard({ from: "2026-10-02T00:00:00.000Z", to: "2026-10-16T00:00:00.000Z", signal })).reservations).toHaveLength(1);
  expect(calls).toHaveLength(2); for (const call of calls) { expect(new URL(call.url, "https://fixture.invalid").searchParams.get("from")).toBe("2026-10-02T00:00:00.000Z"); expect(call.signal).toBe(signal); }
  expect(calls[1]?.url).toContain("after=page2");
  calls.length = 0; replies[0] = { reservations: [], nextCursor: null }; await client.loadReservationBoard();
  expect(calls[0]?.url).not.toContain("from="); expect(calls[0]?.signal).toBeUndefined();
});
test("calendar reader fails closed for malformed or failed later pages", async () => {
  const source = await Bun.file(new URL("../frontend/yellow/src/yellow-api.tsx", import.meta.url)).text();
  const script = new Bun.Transpiler({ loader: "tsx" }).transformSync(source.slice(source.indexOf("async function loadReservationBoard()"), source.indexOf("async function loadGroupBlocks()")));
  const make = new Function("session", "collectReservationBoardPages", "fetch", "propertyId", script + "\nreturn loadReservationCalendarBoard;");
  for (const malformed of [{}, { reservations: {}, nextCursor: null }, { reservations: [null], nextCursor: null }, { reservations: [], nextCursor: 7 }]) {
    const reader = make(async () => "fixture", collectReservationBoardPages, async () => ({ ok: true, json: async () => malformed }), "fixture-property");
    await expect(reader({ from: "from", to: "to" })).rejects.toThrow("Calendar response is incomplete");
  }
  let count = 0; const reader = make(async () => "fixture", collectReservationBoardPages, async () => ++count === 1 ? { ok: true, json: async () => ({ reservations: [], nextCursor: "page2" }) } : { ok: false }, "fixture-property");
  await expect(reader({ from: "from", to: "to" })).rejects.toThrow("Reservations are unavailable");
});
