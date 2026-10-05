import { describe, expect, test } from "bun:test";
import { RESERVATION_BOARD_CAPABILITIES, filterAndSortMovementRows, metricVariance, movementGuestAttributes, propertyLocalGreeting } from "../frontend/yellow/src/today-workspace";

describe("Order 507 Today workspace helpers", () => {
  test("uses the property timezone for greeting and clock", () => {
    expect(propertyLocalGreeting(new Date("2026-09-20T16:04:00Z"), "Asia/Kolkata"))
      .toEqual({ greeting: "Good evening", time: "21:34 IST" });
    expect(propertyLocalGreeting(new Date("2026-09-20T08:00:00Z"), "Europe/London").greeting)
      .toBe("Good morning");
  });

  test("returns truthful directional variance and no invented zero baseline", () => {
    expect(metricVariance(70, 65)).toEqual({ direction: "up", percent: 7.7 });
    expect(metricVariance(84, 100)).toEqual({ direction: "down", percent: 16 });
    expect(metricVariance(0, 0)).toBeNull();
  });

  test("combines filters and stable multi-key sorting", () => {
    const rows = [
      { reservationId: "2", confirmationNo: "Y2", primaryGuestDisplayName: "Zoya", channelCode: "direct", sellableUnitLabel: "302", ratePlanLabel: "BAR", stayFrom: "2026-09-20T10:00:00Z", stayTo: "2026-09-22T10:00:00Z", arrivalTravel: { scheduledAt: "2026-09-20T12:00:00Z" } },
      { reservationId: "1", confirmationNo: "Y1", primaryGuestDisplayName: "Ankit", channelCode: "direct", sellableUnitLabel: null, unitTypeLabel: "King", ratePlanLabel: "BAR", stayFrom: "2026-09-20T10:00:00Z", stayTo: "2026-09-21T10:00:00Z", arrivalTravel: { scheduledAt: "2026-09-20T11:00:00Z" } },
      { reservationId: "3", confirmationNo: "Y3", primaryGuestDisplayName: "Ankit", channelCode: "agoda", sellableUnitLabel: "101", ratePlanLabel: "Flex", stayFrom: "2026-09-20T10:00:00Z", stayTo: "2026-09-24T10:00:00Z", arrivalTravel: { scheduledAt: "2026-09-20T13:00:00Z" } },
    ] as const;
    expect(filterAndSortMovementRows(rows, { search: "", source: "direct", assignment: "all" }, [{ key: "guest", direction: "asc" }, { key: "eta", direction: "desc" }]).map((row) => row.reservationId)).toEqual(["1", "2"]);
    expect(filterAndSortMovementRows(rows, { search: "ank", source: "", assignment: "assigned" }, [{ key: "nights", direction: "desc" }]).map((row) => row.reservationId)).toEqual(["3"]);
    expect(filterAndSortMovementRows(rows, { search: "", source: "", assignment: "all" }, [{ key: "eta", direction: "asc" }], "departure").map((row) => row.reservationId)).toEqual(["1", "2", "3"]);
  });

  test("filters the unified reservation board by factual operational state", () => {
    const rows = [
      { reservationId: "future", confirmationNo: "FUT-1", status: "reserved", primaryPartyName: "Future Guest" },
      { reservationId: "history", confirmationNo: "HIS-1", status: "checked_out", primaryPartyName: "Past Guest" },
    ];
    expect(
      filterAndSortMovementRows(
        rows,
        { search: "", source: "", assignment: "all", state: "checked_out" },
        [{ key: "guest", direction: "asc" }],
      ).map((row) => row.reservationId),
    ).toEqual(["history"]);
  });

  test("combines exact room-type and rate-plan rules with the other board filters", () => {
    const rows = [
      { reservationId: "one", confirmationNo: "ONE", operationalState: "due_in", channelCode: "agoda", sellableUnitLabel: "101", unitTypeLabel: "One Bedroom Residence", ratePlanLabel: "Best Available Rate" },
      { reservationId: "two", confirmationNo: "TWO", operationalState: "due_in", channelCode: "agoda", sellableUnitLabel: "201", unitTypeLabel: "Two Bedroom Residence", ratePlanLabel: "Best Available Rate" },
      { reservationId: "three", confirmationNo: "THREE", operationalState: "stayover", channelCode: "direct", sellableUnitLabel: "301", unitTypeLabel: "One Bedroom Residence", ratePlanLabel: "Long Stay" },
    ] as const;

    expect(filterAndSortMovementRows(rows, {
      search: "",
      source: "agoda",
      assignment: "assigned",
      state: "due_in",
      roomType: "One Bedroom Residence",
      ratePlan: "Best Available Rate",
    }, [{ key: "guest", direction: "asc" }]).map((row) => row.reservationId)).toEqual(["one"]);
  });

  test("filters movement dates inclusively in the property timezone", () => {
    const rows = [
      { reservationId: "local-21", confirmationNo: "LOCAL-21", stayFrom: "2026-09-20T22:30:00.000Z", stayTo: "2026-09-22T04:00:00.000Z" },
      { reservationId: "local-20", confirmationNo: "LOCAL-20", stayFrom: "2026-09-20T08:00:00.000Z", stayTo: "2026-09-21T04:00:00.000Z" },
    ] as const;

    expect(filterAndSortMovementRows(rows, {
      search: "",
      source: "",
      assignment: "all",
      dateFrom: "2026-09-21",
      dateTo: "2026-09-21",
    }, [{ key: "eta", direction: "asc" }], "arrival", "Asia/Kolkata").map((row) => row.reservationId)).toEqual(["local-21"]);
  });

  test("formats only recorded guest and direction-specific travel attributes", () => {
    const row = {
      reservationId: "travel",
      confirmationNo: "TRAVEL",
      adults: 2,
      children: 1,
      arrivalTravel: { mode: "flight", carrier: "AI", serviceNo: "829", pickupRequested: true },
      departureTravel: { mode: "car", carrier: null, serviceNo: null, pickupRequested: false },
    } as const;
    expect(movementGuestAttributes(row, "arrival")).toBe("2 adults · 1 child · flight AI 829 · pickup requested");
    expect(movementGuestAttributes(row, "departure")).toBe("2 adults · 1 child · car");
    expect(movementGuestAttributes({ reservationId: "empty", confirmationNo: "EMPTY" }, "arrival")).toBe("Guest/travel details unavailable");
    expect(movementGuestAttributes({ reservationId: "scheduled", confirmationNo: "SCHEDULED", adults: 1, arrivalTravel: { scheduledAt: "2026-09-21T10:00:00.000Z" } }, "arrival"))
      .toBe("1 adult · travel time recorded");
  });

  test("filters and sorts recorded party and direction-specific travel facts", () => {
    const rows = [
      { reservationId: "family-pickup", confirmationNo: "FAMILY", primaryPartyName: "Family", adults: 2, children: 2, arrivalTravel: { mode: "flight", carrier: "AI", serviceNo: "829", pickupRequested: true } },
      { reservationId: "solo-car", confirmationNo: "SOLO", primaryPartyName: "Solo", adults: 1, children: 0, arrivalTravel: { mode: "car", pickupRequested: false } },
      { reservationId: "group-no-travel", confirmationNo: "GROUP", primaryPartyName: "Group", adults: 4, children: 0, arrivalTravel: null },
      { reservationId: "unknown-party-count", confirmationNo: "UNKNOWN", primaryPartyName: "Unknown", adults: 3, arrivalTravel: null },
    ] as const;
    const filtered = filterAndSortMovementRows(rows, {
      search: "AI 829",
      source: "",
      assignment: "all",
      minAdults: 2,
      children: "present",
      travel: "recorded",
      pickup: "requested",
    }, [{ key: "adults", direction: "desc" }, { key: "children", direction: "desc" }]);
    expect(filtered.map((row) => row.reservationId)).toEqual(["family-pickup"]);
    expect(filterAndSortMovementRows(rows, {
      search: "",
      source: "",
      assignment: "all",
      children: "absent",
      travel: "not_recorded",
      pickup: "not_recorded",
    }, [{ key: "adults", direction: "desc" }]).map((row) => row.reservationId)).toEqual(["group-no-travel"]);
  });

  test("publishes the exact structured filter and sort inventory", () => {
    expect(RESERVATION_BOARD_CAPABILITIES.filters).toEqual([
      "search", "state", "source", "assignment", "roomType", "ratePlan", "dateRange",
      "minAdults", "children", "travel", "pickup",
    ]);
    expect(RESERVATION_BOARD_CAPABILITIES.sorts).toEqual([
      "eta", "guest", "confirmation", "nights", "room", "source", "rate", "adults", "children",
    ]);
    expect(Object.isFrozen(RESERVATION_BOARD_CAPABILITIES.filters)).toBe(true);
    expect(Object.isFrozen(RESERVATION_BOARD_CAPABILITIES.sorts)).toBe(true);
  });
});
