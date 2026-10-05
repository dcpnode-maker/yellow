import { expect, test } from "bun:test";
import { collectReservationBoardPages, operationalStateDescription, operationalStateLabel } from "../frontend/yellow/src/reservation-board";

import { movementColumns } from "../frontend/yellow/src/movement-table-query";

test("the unified reservation board displays its property-local arrival date", () => {
  const row = { reservationId: "test-display", confirmationNo: "TEST", stayFrom: "2026-10-01T22:00:00Z", stayTo: "2026-10-05T22:00:00Z", arrivalTravel: { scheduledAt: "2026-10-02T23:30:00Z" } };
  const arrival = movementColumns("arrival", "Asia/Riyadh", true).find(column => column.key === "eta")!;
  expect(arrival.label).toBe("Arrival");
  expect(String(arrival.value(row))).toMatch(/03[- ]Oct[- ]2026/);
  expect(String(arrival.value(row))).toContain("02:30");
  expect(String(arrival.value({ ...row, arrivalTravel: null }))).toMatch(/02[- ]Oct[- ]2026/);
  expect(String(arrival.value({ ...row, arrivalTravel: null }))).toContain("01:00");
  const departure = movementColumns("departure", "Asia/Riyadh", true).find(column => column.key === "eta")!;
  expect(departure.label).toBe("Departure");
  expect(String(departure.value(row))).toMatch(/06[- ]Oct[- ]2026/);
  expect(String(departure.value(row))).toContain("01:00");
});

test("labels actual events separately from planned and continuing states", () => {
  expect(operationalStateLabel("due_in")).toBe("Expected arrival");
  expect(operationalStateLabel("checked_in_today")).toBe("Checked in today");
  expect(operationalStateLabel("stayover")).toBe("Stayover");
  expect(operationalStateLabel("due_out")).toBe("Departure today");
  expect(operationalStateLabel("checked_out_today")).toBe("Checked out today");
  expect(operationalStateLabel("checked_out")).toBe("Departed history");
  expect(operationalStateDescription("due_in")).not.toContain("completed");
  expect(operationalStateDescription("checked_in_today")).toContain("completed today");
});

test("collects every keyset page in order", async () => {
  const seen: Array<string | null> = [];
  const result = await collectReservationBoardPages(async (after) => {
    seen.push(after);
    if (after === null) return { reservations: [1, 2], nextCursor: "page-2" };
    return { reservations: [3, 4], nextCursor: null };
  });
  expect(seen).toEqual([null, "page-2"]);
  expect(result.reservations).toEqual([1, 2, 3, 4]);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.reservations)).toBe(true);
});

test("fails closed on repeated cursors and a list beyond the bound", async () => {
  await expect(collectReservationBoardPages(async () => ({ reservations: [1], nextCursor: "same" })))
    .rejects.toThrow("invalid cursor");
  let cursor = 0;
  await expect(collectReservationBoardPages(async () => ({ reservations: [cursor], nextCursor: `p-${++cursor}` }), 2))
    .rejects.toThrow("safe page limit");
  await expect(collectReservationBoardPages(async () => ({ reservations: [] }), 0))
    .rejects.toThrow("maximumPages");
});
