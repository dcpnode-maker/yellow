import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { movementColumns, movementTableQuery } from "../frontend/yellow/src/movement-table-query";
// Root tests exclude JSX; Bun loads the separately frontend-typechecked component for SSR.
const controlsModulePath: string = "../frontend/yellow/src/ui/MovementTableControls";
const { MovementTableControls } = await import(controlsModulePath);
import {
  RESERVATION_BOARD_CAPABILITIES,
  createMovementQuery,
  filterAndSortMovementRows,
  type MovementRowLike,
} from "../frontend/yellow/src/today-workspace";

const app = await Bun.file("frontend/yellow/src/workspaces/ReservationWorkspace.tsx").text();
const mainApp = await Bun.file("frontend/yellow/src/App.tsx").text();
const styles = await Bun.file("frontend/yellow/src/styles.css").text();

test("manual controls expose every new structured party and travel rule", () => {
  const query = createMovementQuery("arrival");
  const columns = movementColumns("arrival", "UTC");
  const markup = renderToStaticMarkup(createElement(MovementTableControls, {
    label: "Arrivals", rows: [], count: 0, columns,
    selectedColumns: columns.filter(column => column.initial).map(column => column.key),
    onColumnsChange: () => {}, query, onQueryChange: () => {},
    tableQuery: movementTableQuery(query, []), onTableChange: () => {},
  }));
  for (const marker of ["Search Arrivals", "Showing 0 of 0", "Filter", "Sort (2)", "Columns (12)", "aria-expanded=\"false\""])
    expect(markup).toContain(marker);
  expect(markup).not.toContain("Minimum adults"); // compact editor opens on deliberate Filter action
  for (const source of [app, mainApp]) {
    expect(source.includes("<MovementTableControls label=")).toBe(true);
    expect(source.includes("useMovementTable({ status, rows, timezone")).toBe(true);
  }
  expect(styles).toContain("min-height: 44px");
});

test("10,000 reservations filter and stable-sort within an interaction budget", () => {
  const rows: MovementRowLike[] = Array.from({ length: 10_000 }, (_, index) => ({
    reservationId: `reservation-${String(index).padStart(5, "0")}`,
    confirmationNo: `Y-${String(index).padStart(5, "0")}`,
    primaryPartyName: `Guest ${String(Math.floor((10_000 - index) / 100)).padStart(3, "0")}`,
    channelCode: index % 3 === 0 ? "airbnb" : index % 3 === 1 ? "booking.com" : "direct",
    sellableUnitLabel: index % 5 === 0 ? null : String(100 + index),
    unitTypeLabel: index % 2 === 0 ? "One Bedroom Residence" : "Two Bedroom Residence",
    ratePlanLabel: index % 4 === 0 ? "Long Stay" : "Best Available Rate",
    status: "reserved",
    operationalState: "due_in",
    adults: index % 5 + 1,
    children: index % 4,
    stayFrom: "2026-09-22T09:00:00.000Z",
    stayTo: "2026-09-25T09:00:00.000Z",
    arrivalTravel: index % 2 === 0
      ? { scheduledAt: "2026-09-22T08:00:00.000Z", mode: "flight", carrier: "AI", serviceNo: String(index), pickupRequested: index % 6 === 0 }
      : null,
  }));
  const query = createMovementQuery("arrival", {
    source: "airbnb",
    assignment: "assigned",
    minAdults: 2,
    children: "present",
    travel: "recorded",
    pickup: "requested",
    sorts: [{ key: "adults", direction: "desc" }, { key: "guest", direction: "asc" }],
  });
  filterAndSortMovementRows(rows.slice(0, 100), query, query.sorts, query.movementTime, "Asia/Kolkata");
  const started = performance.now();
  const result = filterAndSortMovementRows(rows, query, query.sorts, query.movementTime, "Asia/Kolkata");
  const elapsedMs = performance.now() - started;
  const expectedIds = rows
    .filter((row) => {
      const travel = row.arrivalTravel;
      return row.channelCode === "airbnb"
        && row.sellableUnitLabel !== null
        && (row.adults ?? 0) >= 2
        && (row.children ?? 0) > 0
        && Boolean(travel?.scheduledAt || travel?.mode || travel?.carrier || travel?.serviceNo || travel?.pickupRequested)
        && travel?.pickupRequested === true;
    })
    .sort((left, right) => {
      const adultDifference = (right.adults ?? -1) - (left.adults ?? -1);
      return adultDifference || (left.primaryPartyName ?? "").localeCompare(right.primaryPartyName ?? "");
    })
    .map((row) => row.reservationId);
  expect(result.map((row) => row.reservationId)).toEqual(expectedIds);
  let stableTieCount = 0;
  for (let index = 1; index < result.length; index += 1) {
    const previous = result[index - 1]!;
    const current = result[index]!;
    if (previous.adults === current.adults && previous.primaryPartyName === current.primaryPartyName) {
      stableTieCount += 1;
      expect(rows.indexOf(previous)).toBeLessThan(rows.indexOf(current));
    }
  }
  expect(stableTieCount).toBeGreaterThan(0);
  expect(elapsedMs).toBeLessThan(500);
  expect(Object.isFrozen(result)).toBe(true);
  expect(RESERVATION_BOARD_CAPABILITIES.filters).toHaveLength(11);
  for (const source of [app, mainApp]) {
    expect(source.includes("Math.floor(rowScrollTop / rowHeight) - 8")).toBe(true);
    expect(source.includes("Math.ceil((rowScrollTop + viewportHeight) / rowHeight) + 8")).toBe(true);
    expect(source.includes("const rendered = visibleRows.slice(first, last);")).toBe(true);
  }
});
