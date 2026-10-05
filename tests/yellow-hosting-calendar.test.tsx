import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  assignCalendarLanes,
  calendarDateOffset,
  calendarMonthDates,
  calendarYearMonths,
  projectCalendarPage,
  selectCalendarRange,
  type CalendarPage,
  type CalendarSegment,
} from "../frontend/yellow/src/hosting-calendar";
import { CalendarSidePanel, HostingCalendar } from "../frontend/yellow/src/workspaces/HostingCalendar";

const propertyId = "10000000-0000-4000-8000-000000000001";
const secondPropertyId = "10000000-0000-4000-8000-000000000002";
const roomId = "20000000-0000-4000-8000-000000000001";
const secondRoomId = "20000000-0000-4000-8000-000000000002";
const unitTypeId = "30000000-0000-4000-8000-000000000001";

function segment(overrides: Partial<CalendarSegment> = {}): CalendarSegment {
  return {
    reservationId: "40000000-0000-4000-8000-000000000001",
    confirmationNo: "Y-101",
    primaryGuestDisplayName: "Guest",
    reservationStatus: "due_in",
    segmentId: "50000000-0000-4000-8000-000000000001",
    segmentSeq: 1,
    segmentStatus: "booked",
    stayFrom: "2026-03-10T14:00:00.000000Z",
    stayTo: "2026-03-12T10:00:00.000000Z",
    localFromDate: "2026-03-10",
    localToDateExclusive: "2026-03-12",
    clipFromDate: "2026-03-10",
    clipToDateExclusive: "2026-03-12",
    continuesBefore: false,
    continuesAfter: false,
    unitTypeId,
    unitTypeCode: "KING",
    unitTypeLabel: "King",
    sellableUnitId: roomId,
    sellableUnitLabel: "Room 101",
    roomCondition: null,
    outOfService: false,
    ...overrides,
  };
}

function page(overrides: Partial<CalendarPage> = {}): CalendarPage {
  return {
    propertyId,
    timezone: "America/New_York",
    fromDate: "2026-03-01",
    toDateExclusive: "2026-04-01",
    limit: 1000,
    limited: false,
    roomLimit: 500,
    roomsLimited: false,
    rooms: [
      { sellableUnitId: roomId, sellableUnitLabel: "Room 101", unitTypeId, unitTypeCode: "KING", unitTypeLabel: "King", roomCondition: null, outOfService: false },
      { sellableUnitId: secondRoomId, sellableUnitLabel: "Room 102", unitTypeId, unitTypeCode: "KING", unitTypeLabel: "King", roomCondition: "dirty", outOfService: false },
    ],
    segments: [segment()],
    ...overrides,
  };
}

test("month projection handles leap February, leading weekdays, and year boundaries", () => {
  expect(calendarMonthDates("2028-02-01")).toHaveLength(5);
  expect(calendarMonthDates("2028-02-01")[0]).toEqual([null, null, "2028-02-01", "2028-02-02", "2028-02-03", "2028-02-04", "2028-02-05"]);
  expect(calendarMonthDates("2028-02-01").flat().filter(Boolean)).toHaveLength(29);
  expect(calendarDateOffset("2026-12-31", 1)).toBe("2027-01-01");
  expect(calendarYearMonths(2026)).toHaveLength(12);
  expect(calendarYearMonths(2026)[11]).toBe("2026-12-01");
  expect(() => calendarMonthDates("2026-02-29")).toThrow();
});

test("range selection supports keyboard-triggered date buttons and resets after completion", () => {
  expect(selectCalendarRange(null, "2026-03-08")).toEqual({ from: "2026-03-08", to: "" });
  expect(selectCalendarRange({ from: "2026-03-08", to: "" }, "2026-03-11")).toEqual({ from: "2026-03-08", to: "2026-03-11" });
  expect(selectCalendarRange({ from: "2026-03-08", to: "" }, "2026-03-05")).toEqual({ from: "2026-03-05", to: "2026-03-08" });
  expect(selectCalendarRange({ from: "2026-03-08", to: "2026-03-11" }, "2026-03-06")).toEqual({ from: "2026-03-06", to: "" });
  expect(() => selectCalendarRange(null, "2026-02-29")).toThrow();
});

test("Month aligns a Thursday arrival and splits a stay across the Sunday week boundary", () => {
  const stay = segment({ stayFrom: "2026-10-01T14:00:00.000Z", stayTo: "2026-10-06T10:00:00.000Z",
    localFromDate: "2026-10-01", localToDateExclusive: "2026-10-06", clipFromDate: "2026-10-01", clipToDateExclusive: "2026-10-06" });
  const html = renderToString(createElement(HostingCalendar, {
    page: page({ fromDate: "2026-10-01", toDateExclusive: "2026-11-01", segments: [stay] }), startDate: "2026-10-01", mode: "month", timezone: "America/New_York", loading: false, error: null,
    onMode() {}, onDate() {}, onOpen() {}, onRefresh() {},
  }));
  expect(html).toContain('grid-column:5 / span 3;grid-row:2');
  expect(html).toContain('grid-column:1 / span 2;grid-row:2');
  expect(html).toContain('October 1, 2026, 1 recorded segment');
});

test("Month stacks coincident rooms and unassigned stays while Timeline keeps room lanes independent", () => {
  const other = segment({ segmentId: "50000000-0000-4000-8000-000000000002", reservationId: "40000000-0000-4000-8000-000000000002", sellableUnitId: secondRoomId, sellableUnitLabel: "Room 102" });
  const unassigned = segment({ segmentId: "50000000-0000-4000-8000-000000000003", reservationId: "40000000-0000-4000-8000-000000000003", sellableUnitId: null, sellableUnitLabel: null });
  const source = page({ segments: [segment(), other, unassigned] });
  const entries = projectCalendarPage(source, "2026-03-01", 31, source.timezone).entries;
  expect(assignCalendarLanes(entries, "calendar").map(item => item.lane)).toEqual([0, 1, 2]);
  expect(assignCalendarLanes(entries).map(item => item.lane)).toEqual([0, 0, 0]);
  const html = renderToString(createElement(HostingCalendar, { page: source, startDate: "2026-03-01", mode: "month", timezone: source.timezone, loading: false, error: null, onMode() {}, onDate() {}, onOpen() {}, onRefresh() {} }));
  for (const row of [2, 3, 4]) expect(html).toContain(`grid-column:3 / span 2;grid-row:${row}`);
});

test("property-local projection clips overnight checkout exclusively and permits positive day-use", () => {
  const dayUse = segment({
    reservationId: "40000000-0000-4000-8000-000000000002",
    segmentId: "50000000-0000-4000-8000-000000000002",
    segmentSeq: 2,
    stayFrom: "2026-03-15T13:00:00.000000Z",
    stayTo: "2026-03-15T18:00:00.000000Z",
    localFromDate: "2026-03-15",
    localToDateExclusive: "2026-03-15",
    clipFromDate: "2026-03-15",
    clipToDateExclusive: "2026-03-15",
  });
  const result = projectCalendarPage(page({ segments: [segment(), dayUse] }), "2026-03-01", 31, "America/New_York");
  expect(result.invalid).toEqual([]);
  expect(result.entries.map(entry => [entry.start, entry.endExclusive, entry.dayUse])).toEqual([[9, 11, false], [14, 15, true]]);
});

test("separate split-stay segments and different rooms remain distinct records", () => {
  const moved = segment({
    segmentId: "50000000-0000-4000-8000-000000000002",
    segmentSeq: 2,
    stayFrom: "2026-03-13T14:00:00.000000Z",
    stayTo: "2026-03-15T10:00:00.000000Z",
    localFromDate: "2026-03-13",
    localToDateExclusive: "2026-03-15",
    clipFromDate: "2026-03-13",
    clipToDateExclusive: "2026-03-15",
    sellableUnitId: secondRoomId,
    sellableUnitLabel: "Room 102",
  });
  const result = projectCalendarPage(page({ segments: [segment(), moved] }), "2026-03-01", 31, "America/New_York");
  expect(result.entries.map(entry => entry.segment.segmentId)).toEqual([segment().segmentId, moved.segmentId]);
  expect(result.entries[0]?.segment.sellableUnitId).not.toBe(result.entries[1]?.segment.sellableUnitId);
  expect(result.entries[1]?.start).toBe(12);
});

test("overlapping reservations on one unit receive separate lanes without hiding either", () => {
  const overlap = segment({ segmentId: "50000000-0000-4000-8000-000000000002", segmentSeq: 2, stayFrom: "2026-03-11T14:00:00.000000Z", stayTo: "2026-03-13T10:00:00.000000Z", localFromDate: "2026-03-11", localToDateExclusive: "2026-03-13" });
  const later = segment({ segmentId: "50000000-0000-4000-8000-000000000003", segmentSeq: 3, stayFrom: "2026-03-13T14:00:00.000000Z", stayTo: "2026-03-14T10:00:00.000000Z", localFromDate: "2026-03-13", localToDateExclusive: "2026-03-14" });
  const result = projectCalendarPage(page({ segments: [segment(), overlap, later] }), "2026-03-01", 31, "America/New_York");
  const lanes = assignCalendarLanes(result.entries);
  expect(lanes.map(row => row.lane)).toEqual([0, 1, 0]);
  expect(result.entries).toHaveLength(3);
});

test("cancelled history is hidden while malformed, duplicate, cross-unit and incomplete evidence is reported", () => {
  const cancelled = segment({ reservationStatus: "cancelled", segmentId: "50000000-0000-4000-8000-000000000004" });
  const malformedDate = segment({ segmentId: "50000000-0000-4000-8000-000000000005", localFromDate: "2026-02-30" });
  const wrongRoomType = segment({ segmentId: "50000000-0000-4000-8000-000000000006", unitTypeId: "30000000-0000-4000-8000-000000000099" });
  const malformedId = segment({ reservationId: "bad", segmentId: "50000000-0000-4000-8000-000000000007" });
  const duplicated = segment({ segmentId: segment().segmentId, reservationId: "40000000-0000-4000-8000-000000000008" });
  const result = projectCalendarPage(page({ segments: [cancelled, malformedDate, wrongRoomType, malformedId, segment(), duplicated], limited: true, roomsLimited: true }), "2026-03-01", 31, "America/New_York");
  expect(result.entries.map(entry => entry.segment.segmentId)).toHaveLength(3);
  expect(result.entries.some(entry => !entry.openable)).toBe(true);
  expect(result.invalid.some(message => message.includes("invalid date"))).toBe(true);
  expect(result.invalid.some(message => message.includes("unit type do not match"))).toBe(true);
  expect(result.invalid.some(message => message.toLowerCase().includes("duplicate"))).toBe(true);
  expect(result.invalid.some(message => message.includes("limited"))).toBe(true);
  expect(projectCalendarPage(page(), "2026-03-01", 31, "UTC").invalid[0]).toContain("timezone changed");
});

test("cross-property timeline keeps actual property and unit identities separate", () => {
  const first = page();
  const second = page({ propertyId: secondPropertyId, timezone: "UTC", rooms: [
    { sellableUnitId: roomId, sellableUnitLabel: "Room 101", unitTypeId, unitTypeCode: "KING", unitTypeLabel: "King", roomCondition: null, outOfService: false },
  ] });
  const firstWithCondition = page({ rooms: [
    { sellableUnitId: roomId, sellableUnitLabel: "Room 101", unitTypeId, unitTypeCode: "KING", unitTypeLabel: "King", roomCondition: null, outOfService: true },
  ] });
  const html = renderToString(createElement(HostingCalendar, {
    page: firstWithCondition,
    timelinePages: [{ label: "Hotel North", page: firstWithCondition }, { label: "Rental South", page: second }],
    startDate: "2026-03-01", mode: "timeline", timezone: "America/New_York", loading: false, error: null,
    onMode() {}, onDate() {}, onOpen() {}, onRefresh() {},
  }));
  expect(html).toContain("Hotel North");
  expect(html).toContain("Rental South");
  expect(html).toContain("America/New_York");
  expect(html).toContain(">UTC<");
  expect(html).toContain("Room 101");
  expect(html).toContain("Listing");
  expect(html).toContain("Out of service");
  expect(html).toContain("Selected authorized properties");
  expect(html).toContain("blank dates do not establish availability");
});

test("timeline supports one authorized hotel or apartment property with its real units", () => {
  const onlyProperty = page();
  const html = renderToString(createElement(HostingCalendar, {
    page: onlyProperty,
    timelinePages: [{ label: "Hotel North", page: onlyProperty }],
    startDate: "2026-03-01", mode: "timeline", timezone: "America/New_York", loading: false, error: null,
    onMode() {}, onDate() {}, onOpen() {}, onRefresh() {},
  }));
  expect(html).toContain('aria-label="Hotel North timeline"');
  expect(html).toContain("Room 101");
  expect(html).not.toContain("Calendar data is incomplete");
  expect(html).not.toContain("Duplicate property pages");
});

test("timeline rejects repeated pages for the same property identity", () => {
  const duplicateProperty = page();
  const html = renderToString(createElement(HostingCalendar, {
    page: duplicateProperty,
    timelinePages: [
      { label: "Hotel North", page: duplicateProperty },
      { label: "Duplicate Hotel North", page: duplicateProperty },
    ],
    startDate: "2026-03-01", mode: "timeline", timezone: "America/New_York", loading: false, error: null,
    onMode() {}, onDate() {}, onOpen() {}, onRefresh() {},
  }));
  expect(html).toContain("Timeline received duplicate property pages; no properties were merged.");
  expect(html).toContain("Calendar data is incomplete");
});

test("rendered month uses accessible real-date cells, records only, safe guest text, and a reservation side panel", () => {
  const unsafe = segment({ primaryGuestDisplayName: '<img src=x onerror="alert(1)">' });
  const html = renderToString(createElement(HostingCalendar, {
    page: page({ segments: [unsafe] }), startDate: "2026-03-01", mode: "month", timezone: "America/New_York", loading: false, error: null,
    onMode() {}, onDate() {}, onOpen() {}, onRefresh() {},
  }));
  expect(html).toContain('aria-label="March 2026 reservation calendar"');
  expect(html).toContain('role="gridcell"');
  expect(html).toContain("rate not returned");
  expect(html).toContain("Listing");
  expect(html).toContain("Select a recorded reservation to review its segment details.");
  expect(html).toContain("&lt;img");
  expect(html).not.toContain('<img src="x"');
  expect(html).toContain("A blank date is not an availability promise.");
});

test("selected segment side panel offers only the actual reservation open action", () => {
  const selectedPage = page({ segments: [segment()] });
  const projection = projectCalendarPage(selectedPage, "2026-03-01", 31, selectedPage.timezone);
  const entry = projection.entries[0]!;
  const panel = CalendarSidePanel({
    date: "2026-03-10", range: null, page: selectedPage, segmentEntries: [entry], activeKey: entry.key,
    onOpen() {}, timeline: false,
  });
  const html = renderToString(panel);
  expect(html).toContain("Open reservation");
  expect(html).toContain("Y-101");
  expect(html).toContain("Recorded reservation segment");
});

test("year view displays twelve full-width weekday mini-months and marks unrequested dates not loaded", () => {
  const html = renderToString(createElement(HostingCalendar, {
    page: page(), startDate: "2026-01-01", mode: "year", timezone: "America/New_York", loading: false, error: null,
    onMode() {}, onDate() {}, onOpen() {}, onRefresh() {},
  }));
  expect((html.match(/class="hosting-mini-month"/g) ?? [])).toHaveLength(12);
  expect(html).toContain('aria-label="January 2026"');
  expect(html).toContain('data-covered="false"');
  expect(html).toContain("Calendar data is incomplete");
});

test("truncated results visibly fail closed and missing property pages do not render partial timelines", () => {
  const props = { page: page({ limited: true }), startDate: "2026-03-01", mode: "month" as const, timezone: "America/New_York", loading: false, error: null, onMode() {}, onDate() {}, onOpen() {}, onRefresh() {} };
  const limited = renderToString(createElement(HostingCalendar, props));
  expect(limited).toContain('role="alert"');
  expect(limited).toContain("Calendar data is incomplete");
  const missing = renderToString(createElement(HostingCalendar, { ...props, page: null, mode: "timeline", timelinePages: [{ label: "Hotel North", page: page() }] }));
  expect(missing).toContain("A selected property page is missing");
  expect(missing).not.toContain("Hotel North");
});

test("blank dates and rate placeholders make no availability or price promise", () => {
  const result = projectCalendarPage(page({ segments: [] }), "2026-03-01", 31, "America/New_York");
  expect(result.entries).toEqual([]);
  expect(result.invalid).toEqual([]);
  const html = renderToString(createElement(HostingCalendar, { page: page({ segments: [] }), startDate: "2026-03-01", mode: "month", timezone: "America/New_York", loading: false, error: null, onMode() {}, onDate() {}, onOpen() {}, onRefresh() {} }));
  expect(html).toContain("no reservation segment returned");
  expect(html).toContain("rate not returned");
  expect(html).not.toContain("Available");
  expect(html).not.toContain("$100");
});
