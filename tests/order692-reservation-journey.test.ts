import { expect, test } from "bun:test";
import { collectReservationJourneyPages, operationalStateLabel } from "../frontend/yellow/src/reservation-board";
import { reservationStageFromSearch, reservationStageHref, reservationViewFromSearch, reservationViewHref } from "../frontend/yellow/src/reservation-navigation";

test("phase URL state survives back/deep-link and leaves Groups/Calendar reachable", () => {
  expect(reservationStageFromSearch("?stage=pre_arrival")).toBe("pre_arrival");
  expect(reservationStageFromSearch("?stage=arrival&stage=departure")).toBe("arrival");
  const phase = reservationStageHref("/p/test/reservations", "?view=groups&group=old&flag=1", "#focus", "departure");
  expect(phase).toBe("/p/test/reservations?flag=1&stage=departure#focus");
  expect(reservationViewFromSearch("?view=calendar")).toBe("calendar");
  expect(reservationViewHref("/p/test/reservations", "?stage=departure&flag=1", "", "groups"))
    .toBe("/p/test/reservations?stage=departure&flag=1&view=groups");
});

test("journey collector rejects absent or changing authoritative business dates", async () => {
  const pages = [
    { businessDate: "2026-09-25", reservations: ["A"], nextCursor: "next" },
    { businessDate: "2026-09-25", reservations: ["B"], nextCursor: null },
  ];
  let index = 0;
  expect(await collectReservationJourneyPages(async () => pages[index++]!))
    .toEqual({ businessDate: "2026-09-25", reservations: ["A", "B"] });
  await expect(collectReservationJourneyPages(async () => ({ businessDate: null, reservations: [], nextCursor: null })))
    .rejects.toThrow("No open property business day");
  await expect(collectReservationJourneyPages(async (after) => ({
    businessDate: after ? "2026-09-26" : "2026-09-25", reservations: [], nextCursor: after ? null : "next",
  }))).rejects.toThrow("business day changed");
  await expect(collectReservationJourneyPages(async () => ({ businessDate: "2026-02-30", reservations: [], nextCursor: null })))
    .rejects.toThrow("No open property business day");
});

test("waitlist copy cannot be mistaken for confirmed room inventory", () => {
  expect(operationalStateLabel("waitlist")).toContain("not confirmed");
});
