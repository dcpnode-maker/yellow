import { describe, expect, test } from "bun:test";
import { collectReservationBoardPages } from "../frontend/yellow/src/reservation-board";
import {
  createMovementQuery,
  filterAndSortMovementRows,
  type MovementRowLike,
} from "../frontend/yellow/src/today-workspace";
import { resolveReservationQueryIntent } from "../frontend/yellow/src/voice";
import type { ReservationQueryContext, ReservationQueryResolution } from "../frontend/yellow/src/voice";

const options = {
  now: new Date("2026-09-21T06:00:00.000Z"),
  timezone: "Asia/Kolkata",
  sources: ["airbnb", "booking.com", "agoda", "direct"],
  roomTypes: ["One Bedroom Residence", "Two Bedroom Residence"],
  ratePlans: ["Best Available Rate", "Long Stay"],
} as const;

function applied(result: ReservationQueryResolution | null): ReservationQueryContext {
  expect(result?.kind).toBe("apply");
  if (!result || result.kind !== "apply") throw new Error("expected an applied query");
  return result.context;
}

describe("Order 541 shared reservation query", () => {
  test("keeps every compound arrival qualifier instead of degrading to a broad lane", () => {
    const resolved = resolveReservationQueryIntent(
      "Show tomorrow's arrivals from Airbnb only unassigned",
      null,
      options,
    );
    expect(resolved).toEqual({
      kind: "apply",
      context: {
        view: "due_in",
        query: {
          movementTime: "arrival",
          search: "",
          source: "airbnb",
          assignment: "unassigned",
          state: "",
          roomType: "",
          ratePlan: "",
          dateFrom: "2026-09-22",
          dateTo: "2026-09-22",
          minAdults: null,
          children: "all",
          travel: "all",
          pickup: "all",
          sorts: [
            { key: "eta", direction: "asc" },
            { key: "guest", direction: "asc" },
          ],
        },
      },
    });
  });

  test("retains query context for narrow, clear and sort follow-ups", () => {
    const first = applied(resolveReservationQueryIntent("Show tomorrow's Airbnb arrivals", null, options));

    const narrowed = applied(resolveReservationQueryIntent("Now only unassigned", first, options));
    expect(narrowed.query).toMatchObject({
      source: "airbnb",
      assignment: "unassigned",
      dateFrom: "2026-09-22",
      dateTo: "2026-09-22",
    });

    const sorted = applied(resolveReservationQueryIntent("Earliest first", narrowed, options));
    expect(sorted.query.sorts[0]).toEqual({ key: "eta", direction: "asc" });

    const cleared = applied(resolveReservationQueryIntent("Clear the source filter", sorted, options));
    expect(cleared.query.source).toBe("");
    expect(cleared.query.assignment).toBe("unassigned");
    expect(cleared.query.dateFrom).toBe("2026-09-22");
  });

  test("treats future dates as planned movement and exact history as server state", () => {
    const future = resolveReservationQueryIntent(
      "Show departures between 2026-10-01 and 2026-10-31",
      null,
      options,
    );
    expect(future).toMatchObject({
      kind: "apply",
      context: {
        view: "due_out",
        query: {
          movementTime: "departure",
          state: "",
          dateFrom: "2026-10-01",
          dateTo: "2026-10-31",
        },
      },
    });
    expect(resolveReservationQueryIntent("Show departed history", null, options)).toMatchObject({
      kind: "apply",
      context: { view: "all", query: { movementTime: "departure", state: "checked_out" } },
    });
  });

  test("asks locally for unknown labels and invalid date ranges", () => {
    expect(resolveReservationQueryIntent("Show arrivals from Orbitz", null, options)).toMatchObject({
      kind: "clarify",
    });
    expect(resolveReservationQueryIntent(
      "Show departures between 2026-10-31 and 2026-10-01",
      null,
      options,
    )).toMatchObject({ kind: "clarify" });
    expect(resolveReservationQueryIntent("Now only unassigned", null, options)).toMatchObject({
      kind: "clarify",
    });
    expect(resolveReservationQueryIntent("Show arrivals with at least 0 adults", null, options)).toMatchObject({
      kind: "clarify",
      message: "Use a minimum adult count from 1 to 20.",
    });
    for (const ambiguous of [
      "Show arrivals with at least 2 adults or minimum 5 adults",
      "Show arrivals with at least 2 adults and minimum 0 adults",
      "Show arrivals with at least two adults and minimum 3 adults",
      "Show arrivals with at least 2 or 5 adults",
      "Show arrivals with at least 2 adults or 5 adults",
      "Show arrivals with at least 2 adults or 2.5 adults",
      "Show arrivals with at least 2 adults or -1 adults",
      "Show arrivals with at least 2 adults or thirty adults",
      "Show arrivals with minimum twenty one adults",
    ]) expect(resolveReservationQueryIntent(ambiguous, null, options)).toMatchObject({
      kind: "clarify",
    });
  });

  test("retains compound guest and travel filters across Yellow follow-ups", () => {
    const first = applied(resolveReservationQueryIntent(
      "Show arrivals with children, at least 2 adults, travel recorded and pickup requested, most adults first",
      null,
      options,
    ));
    expect(first.query).toMatchObject({
      minAdults: 2,
      children: "present",
      travel: "recorded",
      pickup: "requested",
    });
    expect(first.query.sorts[0]).toEqual({ key: "adults", direction: "desc" });
    const withoutChildren = applied(resolveReservationQueryIntent("Now no children", first, options));
    expect(withoutChildren.query).toMatchObject({
      minAdults: 2,
      children: "absent",
      travel: "recorded",
      pickup: "requested",
    });
    const cleared = applied(resolveReservationQueryIntent("Clear the pickup filter", withoutChildren, options));
    expect(cleared.query.pickup).toBe("all");
    expect(cleared.query.children).toBe("absent");
    const adultsCleared = applied(resolveReservationQueryIntent("Clear the adult filter", cleared, options));
    expect(adultsCleared.query.minAdults).toBeNull();
    expect(adultsCleared.query.children).toBe("absent");
    expect(adultsCleared.query.travel).toBe("recorded");
    expect(adultsCleared.query.pickup).toBe("all");
  });

  test("returns identical manual and Yellow IDs, count and order after complete pagination", async () => {
    const source: MovementRowLike[] = Array.from({ length: 205 }, (_, index) => ({
      reservationId: `reservation-${String(index).padStart(3, "0")}`,
      confirmationNo: `Y-${String(index).padStart(3, "0")}`,
      primaryPartyName: `Guest ${String(204 - index).padStart(3, "0")}`,
      status: "reserved",
      operationalState: index < 100 ? "due_in" : "reserved",
      channelCode: index % 2 === 0 ? "airbnb" : "direct",
      sellableUnitLabel: index % 4 === 0 ? null : `${100 + index}`,
      stayFrom: index < 100 ? "2026-09-21T09:00:00.000Z" : "2026-09-22T09:00:00.000Z",
      stayTo: "2026-09-24T09:00:00.000Z",
    }));
    const complete = await collectReservationBoardPages<MovementRowLike>(async (after) => {
      const start = after ? Number(after) : 0;
      const reservations = source.slice(start, start + 100);
      const nextCursor = start + 100 < source.length ? String(start + 100) : null;
      return { reservations, nextCursor };
    });
    expect(complete.reservations).toHaveLength(205);

    const resolved = applied(resolveReservationQueryIntent(
      "Show tomorrow's Airbnb arrivals only unassigned",
      null,
      options,
    ));
    const yellow = filterAndSortMovementRows(
      complete.reservations,
      resolved.query,
      resolved.query.sorts,
      resolved.query.movementTime,
      options.timezone,
    );
    const manualQuery = createMovementQuery("arrival", {
      source: "airbnb",
      assignment: "unassigned",
      dateFrom: "2026-09-22",
      dateTo: "2026-09-22",
    });
    const manual = filterAndSortMovementRows(
      complete.reservations,
      manualQuery,
      manualQuery.sorts,
      manualQuery.movementTime,
      options.timezone,
    );
    expect(yellow.map((row) => row.reservationId)).toEqual(manual.map((row) => row.reservationId));
    expect(yellow.length).toBe(manual.length);
  });
});
