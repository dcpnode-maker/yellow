import { expect, test } from "bun:test";
import { validateHostingCalendar } from "../frontend/yellow/src/hosting-calendar-api";

const propertyId = "10000000-0000-4000-8000-000000000001";
const unitTypeId = "30000000-0000-4000-8000-000000000001";
const read = { propertyId, from: "2026-03-01", to: "2026-04-01", timezone: "UTC" };
function page(stayFrom: string) {
  return { propertyId, timezone: "UTC", fromDate: read.from, toDateExclusive: read.to, limit: 1000, limited: false, roomLimit: 500, roomsLimited: false, rooms: [],
    segments: [{ reservationId: "40000000-0000-4000-8000-000000000001", confirmationNo: "Y-SYNTHETIC", primaryGuestDisplayName: "Synthetic guest", reservationStatus: "reserved", segmentId: "50000000-0000-4000-8000-000000000001", segmentSeq: 1, segmentStatus: "booked", stayFrom, stayTo: "2026-03-03T10:00:00.000Z", localFromDate: "2026-03-02", localToDateExclusive: "2026-03-03", clipFromDate: "2026-03-02", clipToDateExclusive: "2026-03-03", continuesBefore: false, continuesAfter: false, unitTypeId, unitTypeCode: "APT", unitTypeLabel: "Apartment", sellableUnitId: null, sellableUnitLabel: null, roomCondition: null, outOfService: null }] };
}
test("native transport rejects impossible UTC dates before local-date mapping", () => {
  expect(() => validateHostingCalendar(page("2026-02-30T14:00:00.000000Z"), read)).toThrow("inconsistent");
  expect(validateHostingCalendar(page("2026-03-02T14:00:00.000000Z"), read).segments).toHaveLength(1);
});
test("native transport rejects rollover clock values and malformed offsets", () => {
  for (const instant of ["2026-03-01T38:00:00Z", "2026-03-01T24:00:00Z", "2026-03-02T13:60:00Z", "2026-03-02T13:00:60Z", "2026-03-02T14:00:00+24:00", "2026-03-02T14:00:00+00:60"]) {
    expect(() => validateHostingCalendar(page(instant), read)).toThrow();
  }
});
