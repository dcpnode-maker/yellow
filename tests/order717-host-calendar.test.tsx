import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { calendarBarTone, calendarMatchesContext, calendarMonthDates, calendarMonthWeeks, calendarWeekBars, shiftCalendarMonth } from "../frontend/yellow/src/reservation-calendar-views";
import type { ReservationCalendar, ReservationCalendarSegment } from "../frontend/yellow/src/reservation-calendar";
import { HostCalendarMonth, HostReservationCalendar } from "../frontend/yellow/src/workspaces/HostReservationCalendar";

const stay = (overrides: Partial<ReservationCalendarSegment> = {}): ReservationCalendarSegment => ({
  reservationId: "reservation-1", confirmationNo: "Y-1", primaryGuestDisplayName: "Test Guest",
  reservationStatus: "reserved", segmentId: "segment-1", segmentSeq: 1, segmentStatus: "booked",
  stayFrom: "2026-09-25T14:00:00Z", stayTo: "2026-10-05T10:00:00Z",
  localFromDate: "2026-09-25", localToDateExclusive: "2026-10-05", clipFromDate: "2026-09-25", clipToDateExclusive: "2026-10-01",
  continuesBefore: false, continuesAfter: true, unitTypeId: "type-1", unitTypeCode: "STD", unitTypeLabel: "Standard",
  sellableUnitId: "room-1", sellableUnitLabel: "101", roomCondition: "clean", outOfService: false, ...overrides,
});

describe("Order717 shared host-calendar presentation", () => {
  test("month dates use real leap years, not elapsed-hour or local timezone arithmetic", () => {
    expect(calendarMonthDates("2024-02-12")).toHaveLength(29);
    expect(calendarMonthDates("2026-02-12")).toHaveLength(28);
    expect(calendarMonthDates("2026-09-12")).toHaveLength(30);
    expect(calendarMonthDates("2026-10-12")).toHaveLength(31);
    expect(shiftCalendarMonth("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftCalendarMonth("0001-01-01", -1)).toBe("");
    expect(shiftCalendarMonth("9999-11-01", 1)).toBe("9999-12-01");
    expect(calendarMonthDates("9999-11-01")).toHaveLength(30);
    expect(calendarMonthDates("9999-12-01")).toEqual([]);
    expect(calendarMonthDates("not-a-date")).toEqual([]);
    expect(shiftCalendarMonth("2026-09-01", Number.MAX_SAFE_INTEGER)).toBe("");
  });
  test("month cells align Sunday first and preserve leading/trailing empty positions", () => {
    const weeks = calendarMonthWeeks("2026-09-01");
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"]);
    expect(weeks.at(-1)).toEqual(["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", null, null, null]);
  });
  test("booking bars wrap weeks and months while keeping half-open departure dates", () => {
    const weeks = calendarMonthWeeks("2026-09-01");
    expect(calendarWeekBars(weeks[3]!, [stay()])[0]).toMatchObject({ column: 6, span: 2, starts: true, ends: false });
    expect(calendarWeekBars(weeks[4]!, [stay()])[0]).toMatchObject({ column: 1, span: 4, starts: false, ends: false });
    const october = stay({ clipFromDate: "2026-10-01", clipToDateExclusive: "2026-10-05", continuesBefore: true, continuesAfter: false });
    const octoberWeeks = calendarMonthWeeks("2026-10-01");
    expect(calendarWeekBars(octoberWeeks[0]!, [october])[0]).toMatchObject({ column: 5, span: 3, starts: false, ends: false });
    expect(calendarWeekBars(octoberWeeks[1]!, [october])[0]).toMatchObject({ column: 1, span: 1, starts: false, ends: true });
  });
  test("overlapping bookings retain separate lanes rather than hiding records", () => {
    const week = calendarMonthWeeks("2026-09-01")[3]!;
    const bars = calendarWeekBars(week, [stay(), stay({ segmentId: "segment-2" })]);
    expect(bars.map(bar => bar.lane)).toEqual([0, 1]);
    expect(calendarWeekBars(week, [stay({ clipFromDate: "2026-10-01" })])).toEqual([]);
  });
  test("completed stays mute from canonical state, not an elapsed scheduled departure", () => {
    expect(calendarBarTone(stay())).toBe("upcoming");
    expect(calendarBarTone(stay({ reservationStatus: "in_house", stayTo: "2020-01-01T00:00:00Z" }))).toBe("active");
    expect(calendarBarTone(stay({ reservationStatus: "due_out" }))).toBe("active");
    expect(calendarBarTone(stay({ reservationStatus: "checked_out" }))).toBe("completed");
    expect(calendarBarTone(stay({ reservationStatus: "in_house", segmentStatus: "departed" }))).toBe("completed");
    expect(calendarBarTone(stay({ reservationStatus: "cancelled" }))).toBe("inactive");
  });
  test("the shared month renders native date actions and wrapped booking actions without fabricated prices", () => {
    const html = renderToStaticMarkup(createElement(HostCalendarMonth, {
      month: "2026-09-01", today: "2026-09-25", segments: [stay()], selectedDate: "2026-09-26",
      onSelectDate: () => {}, onOpenReservation: () => {},
    }));
    expect(html.match(/class="host-calendar-day/g)).toHaveLength(30);
    expect(html.match(/aria-label="Open reservation:/g)).toHaveLength(2);
    expect(html).toContain('aria-current="date"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('tone-upcoming');
    expect(html).not.toMatch(/SAR|SR800|Available|nightly price/);
    const departed = renderToStaticMarkup(createElement(HostCalendarMonth, {
      month: "2026-09-01", today: "2026-09-25", segments: [stay({ reservationStatus: "in_house", segmentStatus: "departed" })], selectedDate: null,
      onSelectDate: () => {}, onOpenReservation: () => {},
    }));
    expect(departed).toContain("Departed segment");
    expect(departed).toContain(">OUT</span>");
    expect(departed).not.toContain("In house");
    const rms = renderToStaticMarkup(createElement(HostCalendarMonth, {
      month: "2026-02-01", today: "2026-02-01", segments: [], selectedDate: null,
      onSelectDate: () => {}, onOpenReservation: () => {}, renderDayContent: (date) => date === "2026-02-01" ? "Verified fixture rate" : null,
    }));
    expect(rms.match(/Verified fixture rate/g)).toHaveLength(1);
  });
  test("scoped read validation rejects wrong property, timezone or date range", () => {
    const calendar = { propertyId: "p", timezone: "Asia/Riyadh", fromDate: "2026-09-01", toDateExclusive: "2026-10-01" } as ReservationCalendar;
    expect(calendarMatchesContext(calendar, "p", "Asia/Riyadh", "2026-09-01", "2026-10-01")).toBe(true);
    expect(calendarMatchesContext(calendar, "other", "Asia/Riyadh", "2026-09-01", "2026-10-01")).toBe(false);
    expect(calendarMatchesContext(calendar, "p", "UTC", "2026-09-01", "2026-10-01")).toBe(false);
    expect(calendarMatchesContext(calendar, "p", "Asia/Riyadh", "2026-10-01", "2026-11-01")).toBe(false);
  });
  test("picker renders returned rooms, partial limits, and honest initial loading", () => {
    const props = { propertyId: "p", timezone: "Asia/Riyadh", today: "2026-09-25", onOpenReservation: () => {}, loadCalendar: async () => { throw new Error("not used in server rendering"); } };
    const client = new QueryClient();
    const render = () => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(HostReservationCalendar, props)));
    expect(render()).toContain("Loading calendars");
    client.setQueryData(["host-reservation-calendar", "p", "Asia/Riyadh", "2026-09-01", "2026-10-01"], {
      propertyId: "p", timezone: "Asia/Riyadh", fromDate: "2026-09-01", toDateExclusive: "2026-10-01", limit: 1000, limited: true,
      rooms: [{ sellableUnitId: "room-1", sellableUnitLabel: "101", unitTypeId: "type-1", unitTypeCode: "STD", unitTypeLabel: "Standard", roomCondition: "clean", outOfService: false }],
      roomLimit: 500, roomsLimited: false, segments: [stay()],
    } satisfies ReservationCalendar);
    const html = render();
    expect(html).toContain("Partial calendar");
    expect(html).toContain("1000-stay limit");
    expect(html).toContain("101");
    expect(html).toContain("Currently clean");
    expect(html).not.toContain("Listed");
    client.clear();
  });
});
