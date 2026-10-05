import { expect, test } from "bun:test";
import { reservationStageFromSearch, reservationStageHref, reservationViewFromSearch, reservationViewHref, reservationGroupFromSearch } from "../frontend/yellow/src/reservation-navigation";
import { RESERVATION_JOURNEY_STAGES } from "../frontend/yellow/src/reservation-board";
import { readWorkspaceRoute, softWorkspaceHref } from "../frontend/yellow/src/workspace-navigation";

const P = "00000000-0000-4000-8000-000000000001";
const G = "00000000-0000-4000-8000-000000000004";
const path = `/p/${P}/reservations`;
test("stage defaults and ambiguous links fail to Arrival; sibling views retain CRS", () => {
  for (const search of ["", "?stage=bad", "?stage=arrival&stage=departure"]) expect(reservationStageFromSearch(search)).toBe("arrival");
  for (const stage of [...RESERVATION_JOURNEY_STAGES, "all" as const]) expect(reservationStageFromSearch(`?stage=${stage}`)).toBe(stage);
  expect(reservationViewFromSearch("?view=crs")).toBe("crs");
  expect(reservationGroupFromSearch(`?view=groups&group=${G}`)).toBe(G);
  expect(reservationGroupFromSearch("?view=groups&group=bad")).toBeNull();
});
test("phase links select Individual and preserve route/property/hash while clearing group selection", () => {
  for (const stage of [...RESERVATION_JOURNEY_STAGES, "all" as const]) {
    const href = reservationStageHref(path, `?view=groups&group=${G}&guest=Alice`, "#recorded", stage);
    expect(href.startsWith(path + "?")).toBe(true);
    const url = new URL(href, "https://yellow.invalid");
    expect(url.searchParams.get("stage")).toBe(stage);
    expect(url.searchParams.has("view")).toBe(false);
    expect(url.searchParams.has("group")).toBe(false);
    expect(url.searchParams.get("guest")).toBe("Alice");
    expect(url.hash).toBe("#recorded");
    expect(readWorkspaceRoute(href).workspace).toBe("reservations");
  }
});
test("family links preserve stage while retaining established draft URL cleanup", () => {
  const search = "?stage=departure&create=1&from=2026-10-04&to=2026-10-05&adults=2&child_ages=7&channel=direct&option_ref=synthetic";
  for (const view of ["list", "groups", "calendar", "crs"] as const) {
    const href = reservationViewHref(path, search, "#return", view);
    expect(reservationViewFromSearch(new URL(href, "https://yellow.invalid").search)).toBe(view);
    expect(href).toContain("stage=departure");
    for (const key of ["create", "from", "to", "adults", "child_ages", "channel", "option_ref"]) expect(new URL(href, "https://yellow.invalid").searchParams.has(key)).toBe(false);
  }
});
test("property changes use native navigation; existing detail/cashier routes remain property scoped", () => {
  const current = `https://yellow.invalid${path}`;
  expect(softWorkspaceHref(`${path}?stage=in_house`, current, P)).toBe(`${path}?stage=in_house`);
  expect(softWorkspaceHref("/p/other/reservations", current, P)).toBeNull();
  expect(softWorkspaceHref("https://outside.invalid/", current, P)).toBeNull();
  expect(readWorkspaceRoute(`/p/${P}/res/${G}`).reservationId).toBe(G);
  expect(readWorkspaceRoute(`/p/${P}/today?workspace=finance&reservation=${G}`).financeReservation).toBe(G);
});
test("restoration uses shared controls, server stage reads and existing guarded navigation", async () => {
  const source = await Bun.file(new URL("../frontend/yellow/src/workspaces/ReservationWorkspace.tsx", import.meta.url)).text();
  const start = source.indexOf("function ReservationBoardWorkspace(");
  const end = source.indexOf("function GuestsWorkspace(", start);
  const board = source.slice(start, end);
  expect(board).toContain("AppRuntime.loadReservationJourney(stage as ReservationJourneyStage)");
  expect(board).toContain("journey.data.businessDate");
  expect(board).not.toContain("Date.now()");
  expect(board).not.toContain("history.pushState");
  expect(board).not.toContain("window.location.assign");
  expect(board).toContain("navigateYellow(reservationStageHref");
  expect(board).toContain("<ReservationCalendar");
  expect(board).not.toContain("ReservationRoomCalendar");
  expect(board).toContain("inert={view !== \"list\"}");
  const grid = source.slice(source.indexOf("function MovementGrid("), source.indexOf("function ReservationWorkspace("));
  for (const component of ["MovementTableControls", "TableColumnMenu", "CopyCellButton"]) expect(grid).toContain(component);
  expect(grid).toContain("navigateYellow(`/p/${propertyId}/today?workspace=finance");
});
