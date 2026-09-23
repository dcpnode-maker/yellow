import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();

test("reservation detail renders the governed operating record", () => {
  expect(app).toContain("Booking context");
  expect(app).toContain("Stay segments");
  expect(app).toContain("Alerts & travel");
  expect(app).toContain("Recorded history");
  expect(app).toContain("reservation.history.map");
  expect(app).toContain("reservation.travel.map");
  expect(app).toContain("reservation.alerts.map");
});

test("reservation detail preserves property time and Party identity", () => {
  expect(app).toContain("timezone={selected?.timezone ?? \"UTC\"}");
  expect(app).toContain("guest=${encodeURIComponent(guest.partyId)}");
});
