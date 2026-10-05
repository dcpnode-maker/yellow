import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  addCalendarDays,
  calendarDays,
  reservationCalendarRows,
  segmentOccupiesCalendarDate,
  type ReservationCalendar,
} from "../frontend/yellow/src/reservation-calendar";

const segment = (overrides: Partial<ReservationCalendar["segments"][number]> = {}): ReservationCalendar["segments"][number] => ({
  reservationId: "00000000-0000-4000-8000-000000000001",
  confirmationNo: "YEL-001",
  primaryGuestDisplayName: "Asha Rao",
  reservationStatus: "in_house",
  segmentId: "00000000-0000-4000-8000-000000000011",
  segmentSeq: 1,
  segmentStatus: "in_house",
  stayFrom: "2026-09-24T10:00:00.000000Z",
  stayTo: "2026-09-27T06:00:00.000000Z",
  localFromDate: "2026-09-24",
  localToDateExclusive: "2026-09-27",
  clipFromDate: "2026-09-24",
  clipToDateExclusive: "2026-09-27",
  continuesBefore: false,
  continuesAfter: false,
  unitTypeId: "00000000-0000-4000-8000-000000000021",
  unitTypeCode: "STD",
  unitTypeLabel: "Standard",
  sellableUnitId: "00000000-0000-4000-8000-000000000031",
  sellableUnitLabel: "101",
  roomCondition: "clean",
  outOfService: false,
  ...overrides,
});

const calendar: ReservationCalendar = {
  propertyId: "00000000-0000-4000-8000-000000000041",
  timezone: "Asia/Kolkata",
  fromDate: "2026-09-24",
  toDateExclusive: "2026-10-01",
  limit: 1000,
  limited: false,
  segments: [
    segment(),
    segment({
      reservationId: "00000000-0000-4000-8000-000000000002",
      confirmationNo: "YEL-002",
      segmentId: "00000000-0000-4000-8000-000000000012",
      reservationStatus: "due_in",
      segmentStatus: "booked",
      unitTypeId: "00000000-0000-4000-8000-000000000022",
      unitTypeCode: "DLX",
      unitTypeLabel: "Deluxe",
      sellableUnitId: null,
      sellableUnitLabel: null,
      roomCondition: null,
      outOfService: null,
      localFromDate: "2026-09-25",
      localToDateExclusive: "2026-09-28",
      clipFromDate: "2026-09-25",
      clipToDateExclusive: "2026-09-28",
    }),
  ],
  rooms: [{
    sellableUnitId: "00000000-0000-4000-8000-000000000031",
    sellableUnitLabel: "101",
    unitTypeId: "00000000-0000-4000-8000-000000000021",
    unitTypeCode: "STD",
    unitTypeLabel: "Standard",
    roomCondition: "clean",
    outOfService: false,
  }],
  roomLimit: 500,
  roomsLimited: false,
};

describe("reservation room calendar UI helpers", () => {
  test("moves by property-local calendar dates without elapsed-hour arithmetic", () => {
    expect(addCalendarDays("2026-03-07", 7)).toBe("2026-03-14");
    expect(addCalendarDays("0001-01-01", -7)).toBe("0001-01-01");
    expect(addCalendarDays("9999-12-24", 7)).toBe("9999-12-31");
    expect(addCalendarDays("9999-12-31", 7)).toBe("9999-12-31");
    expect(calendarDays("2026-09-24")).toEqual([
      "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30",
    ]);
  });

  test("uses half-open clipped dates and separates assigned from unassigned stays", () => {
    expect(segmentOccupiesCalendarDate(calendar.segments[0]!, "2026-09-26")).toBe(true);
    expect(segmentOccupiesCalendarDate(calendar.segments[0]!, "2026-09-27")).toBe(false);
    const rows = reservationCalendarRows(calendar);
    expect(rows.map((row) => row.id)).toEqual([
      "room:00000000-0000-4000-8000-000000000031",
      "unassigned:00000000-0000-4000-8000-000000000022",
    ]);
    expect(rows[0]?.segments[0]?.confirmationNo).toBe("YEL-001");
    expect(rows[1]?.assigned).toBe(false);
    expect(rows[1]?.segments[0]?.confirmationNo).toBe("YEL-002");
    expect(reservationCalendarRows(calendar, "", "00000000-0000-4000-8000-000000000022").map((row) => row.id)).toEqual([
      "unassigned:00000000-0000-4000-8000-000000000022",
    ]);
  });

  test("filters rows by authoritative reservation status and room type ids", () => {
    expect(reservationCalendarRows(calendar, "due_in").flatMap((row) => row.segments).map((item) => item.confirmationNo)).toEqual(["YEL-002"]);
    expect(reservationCalendarRows(calendar, "", "00000000-0000-4000-8000-000000000021").flatMap((row) => row.segments).map((item) => item.confirmationNo)).toEqual(["YEL-001"]);
    expect(reservationCalendarRows(calendar, "checked_out").flatMap((row) => row.segments)).toHaveLength(0);
  });

  test("retains authoritative room rows when there are no visible stay segments", () => {
    const emptyStayCalendar: ReservationCalendar = { ...calendar, segments: [] };
    expect(reservationCalendarRows(emptyStayCalendar).map((row) => row.label)).toEqual(["101"]);
    const calendarUi = readFileSync("frontend/yellow/src/workspaces/ReservationRoomCalendar.tsx", "utf8");
    expect(calendarUi).toContain("query.isSuccess && calendar && rows.length > 0");
    expect(calendarUi).toContain("No stay segments were returned for these dates");
    expect(calendarUi).toContain("No stay segments match these filters.");
  });

  test("keeps SPA navigation, API limits and honest loading/error/empty states visible", () => {
    const workspace = readFileSync("frontend/yellow/src/workspaces/ReservationWorkspace.tsx", "utf8");
    const calendarUi = readFileSync("frontend/yellow/src/workspaces/ReservationRoomCalendar.tsx", "utf8");
    const api = readFileSync("frontend/yellow/src/yellow-api.tsx", "utf8");
    expect(workspace).toContain('aria-label="Reservation views"');
    expect(workspace).toContain('["calendar", "Calendar"]');
    expect(workspace).toContain('"groups", "Groups"');
    expect(workspace).toContain('aria-label="New reservation"');
    expect(workspace).toContain("GroupBlockWorkbenchPanel");
    expect(api).toContain("/reservation-calendar?");
    expect(calendarUi).toContain("calendar.limited");
    expect(calendarUi).toContain("calendar.roomsLimited");
    expect(calendarUi).toContain("role=\"status\"");
    expect(calendarUi).toContain("role=\"alert\"");
    expect(calendarUi).toContain("does not indicate whether a room is available to sell");
    expect(calendarUi).toContain("onOpenReservation(segment.reservationId)");
  });
});
