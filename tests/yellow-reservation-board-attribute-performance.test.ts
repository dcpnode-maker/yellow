import { expect, test } from "bun:test";
import {
  RESERVATION_BOARD_CAPABILITIES,
  createMovementQuery,
  filterAndSortMovementRows,
  type MovementRowLike,
} from "../frontend/yellow/src/today-workspace";

const app = await Bun.file("frontend/yellow/src/workspaces/ReservationWorkspace.tsx").text();
const styles = await Bun.file("frontend/yellow/src/styles.css").text();

test("manual controls expose every new structured party and travel rule", () => {
  for (const marker of [
    'aria-label="Minimum adults"',
    "With children",
    "0 children recorded",
    "Travel recorded",
    "Travel not recorded",
    "Pickup requested",
    "No pickup recorded",
    'aria-label="Close advanced filters"',
    'aria-label="Close advanced sorting"',
    '>Done</button>',
    'event.key !== "Escape"',
    "RESERVATION_BOARD_CAPABILITIES.filters.length",
  ]) expect(app).toContain(marker);
  expect(styles).toContain("min-height: 44px");
  expect(styles).toContain("max-height: min(70vh,680px)");
  expect(styles).toContain("bottom: calc(82px + env(safe-area-inset-bottom))");
  expect(styles).toContain("position: fixed; z-index: 90;");
  expect(styles).toContain(".movement-popover-head > button { min-width: 64px; min-height: 44px;");
  expect(styles).toContain(".movement-popover select,.movement-popover input { min-width: 0; min-height: 44px;");
  expect(styles).toContain(".movement-popover > button { min-height: 44px;");
  expect(styles).toContain(".movement-popover > .movement-popover-done {");
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
  expect(app).toContain("const overscan = 8;");
  expect(app).toContain("const rendered = visibleRows.slice(first, last);");
});
