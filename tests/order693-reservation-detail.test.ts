import { expect, test } from "bun:test";
import { RESERVATION_DETAIL_SECTIONS, reservationDetailReturn } from "../frontend/yellow/src/reservation-detail-sections";

const source = await Bun.file(new URL("../frontend/yellow/src/workspaces/ReservationWorkspace.tsx", import.meta.url)).text();
const css = await Bun.file(new URL("../frontend/yellow/src/workspaces/reservation-detail.css", import.meta.url)).text();
const detail = source.slice(source.indexOf("function ReservationWorkspace("), source.indexOf("type CheckoutStage"));

test("detail keeps visible alerts and validated originating phase", () => {
  expect(detail).toContain('aria-label="Active reservation alerts"');
  expect(detail).toContain('reservation.alerts.filter(alert => alert.active).map');
  expect(RESERVATION_DETAIL_SECTIONS.find(section => section.id === "travel")?.label).toBe("Alerts & travel");
  for (const stage of ["pre_arrival", "arrival", "in_house", "departure", "post_departure", "all"]) {
    expect(reservationDetailReturn("property", `?returnStage=${stage}`).href).toBe(`/p/property/reservations?stage=${stage}`);
  }
  for (const search of ["", "?returnStage=unknown", "?returnStage=arrival&returnStage=all", "?returnStage=https://evil.test", "?returnStage=constructor"]) {
    expect(reservationDetailReturn("property", search)).toEqual({ href: "/p/property/today", label: "Today" });
  }
  expect(source).toContain('?returnStage=${stage}');
});

test("compact detail has stable sections for every existing workflow", () => {
  expect(RESERVATION_DETAIL_SECTIONS.map(section => section.id)).toEqual(["overview", "guests", "stay", "travel", "history", "actions"]);
  for (const { id } of RESERVATION_DETAIL_SECTIONS) expect(detail).toContain(`id="reservation-detail-${id}"`);
  expect(detail).toContain('aria-label="Reservation details"');
  expect(detail).toContain('aria-pressed={detailSection === section.id}');
  expect(detail).toContain('disabled={reservationMutationBusy}');
});

test("section selection hides without unmounting command recovery or drafts", () => {
  expect(detail).toContain('hidden={detailSection !== "travel"}');
  expect(detail).toContain('hidden={detailSection !== "stay"}');
  expect(detail).not.toContain('detailSection === "travel" ?');
  expect(detail).not.toContain('detailSection === "stay" ?');
  expect(detail).toContain('if (locked) setDetailSection("travel")');
  expect(detail).toContain('if (locked) setDetailSection("stay")');
  expect(detail).toContain('initialLifecycleAction ? "actions" : "overview"');
  expect(detail).toContain('if (initialLifecycleAction) setDetailSection("actions")');
  expect(detail).toContain('arrivalPickupLocked ? "travel" : departureChangeLocked ? "stay" : selectedDetailSection');
  expect(detail).toContain('Guest allocation is read-only for this reservation status.');
  expect(css).toContain('[hidden] { display: none !important; }');
  expect(css).toContain('prefers-reduced-motion');
});
