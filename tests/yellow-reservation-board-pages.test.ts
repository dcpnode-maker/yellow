import { expect, test } from "bun:test";
import { collectReservationBoardPages, operationalStateDescription, operationalStateLabel } from "../frontend/yellow/src/reservation-board";
import { movementColumns } from "../frontend/yellow/src/movement-table-query";

test("the unified reservation board displays its property-local arrival date", () => {
  const row = { reservationId: "r", confirmationNo: "R", stayFrom: "2026-09-23T22:30:00Z", stayTo: "2026-09-27T22:30:00Z", arrivalTravel: { scheduledAt: "2026-09-24T22:30:00Z" } };
  const arrival = movementColumns("arrival", "Asia/Kolkata", true).find(column => column.key === "eta")!;
  const departure = movementColumns("departure", "Asia/Kolkata", true).find(column => column.key === "eta")!;
  const format = (value: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h12" }).format(new Date(value));
  expect(arrival.value(row)).toBe(format(row.arrivalTravel.scheduledAt));
  expect(arrival.value({ ...row, arrivalTravel: null })).toBe(format(row.stayFrom));
  expect(departure.value(row)).toBe(format(row.stayTo));
  expect(String(arrival.value(row))).toContain("25");
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
