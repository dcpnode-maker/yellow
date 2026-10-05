import { describe, expect, test } from "bun:test";
import { createMovementQuery } from "../frontend/yellow/src/today-workspace";
import { movementColumns, movementTableQuery, applyMovementTableQuery, queryMovementTableRows, movementLaneFromSearch, movementLaneUrl } from "../frontend/yellow/src/movement-table-query";

const rows = [
  { reservationId: "a", confirmationNo: "R1", primaryGuestDisplayName: "Same", stayFrom: "2026-09-24T22:30:00Z", stayTo: "2026-09-28T03:00:00Z", channelCode: "WEB", ratePlanLabel: "BAR", sellableUnitLabel: "102", adults: 2, children: 0, arrivalTravel: { carrier: "ArrivalAir", pickupRequested: true }, departureTravel: { carrier: "ReturnAir" } },
  { reservationId: "b", confirmationNo: "R2", primaryGuestDisplayName: "Same", stayFrom: "2026-09-23T22:30:00Z", stayTo: "2026-09-27T03:00:00Z", channelCode: "WEB", ratePlanLabel: "BAR", sellableUnitLabel: "101", adults: 1 },
] as const;

describe("Order674 movement adapters preserve existing domain reads", () => {
  test("new column filters compose with property-local departure criteria and directional travel search", () => {
    const q = createMovementQuery("departure", { dateFrom: "2026-09-28", dateTo: "2026-09-28", search: "returnair" });
    expect(queryMovementTableRows(rows, q, [{ column: "source", operator: "equals", value: "WEB" }], "Asia/Kolkata")).toEqual([rows[0]]);
    expect(queryMovementTableRows(rows, { ...q, search: "arrivalair" }, [], "Asia/Kolkata")).toEqual([]);
    expect(queryMovementTableRows(rows, createMovementQuery("arrival", { dateFrom: "2026-09-25" }), [], "Asia/Kolkata")).toEqual([rows[0]]);
  });
  test("five sort levels survive control round trip and apply the existing movement comparator", () => {
    const q = createMovementQuery("arrival", { sorts: [{ key: "guest", direction: "asc" }, { key: "source", direction: "desc" }, { key: "rate", direction: "asc" }, { key: "adults", direction: "asc" }, { key: "room", direction: "desc" }] });
    const mapped = applyMovementTableQuery(q, movementTableQuery(q, []));
    expect(mapped.query.sorts).toEqual(q.sorts);
    expect(queryMovementTableRows(rows, mapped.query, mapped.filters, "UTC").map(r => r.reservationId)).toEqual(["b", "a"]);
    expect(rows[0].reservationId).toBe("a");
  });
  test("unknown sort/filter cannot silently broaden the view, duplicate sorts are rejected", () => {
    const q = createMovementQuery("arrival");
    expect(queryMovementTableRows(rows, q, [{ column: "unknown", operator: "equals", value: "" }], "UTC")).toEqual([]);
    expect(() => applyMovementTableQuery(q, { search: "", filters: [], sorts: [{ column: "unknown", direction: "asc" }] })).toThrow();
    expect(() => applyMovementTableQuery(q, { search: "", filters: [], sorts: [{ column: "guest", direction: "asc" }, { column: "guest", direction: "desc" }] })).toThrow();
    expect(movementColumns("departure", "UTC").find(c => c.key === "eta")?.label).toBe("Departure");
  });
  test("lane links preserve query context and reject unknown state without document navigation", () => {
    expect(movementLaneFromSearch("?lane=due_out")).toBe("due_out");
    expect(movementLaneFromSearch("?lane=cancelled")).toBe(null);
    expect(movementLaneUrl("https://yellow.test/p/hotel/today?keep=1#context", "in_house")).toBe("/p/hotel/today?keep=1&lane=in_house#context");
    expect(movementLaneUrl("https://yellow.test/p/hotel/today?lane=due_in&keep=1", null)).toBe("/p/hotel/today?keep=1");
  });
  test("channel, source, market and room type stay distinct under column filters and sorting", () => {
    const commercial = [
      { ...rows[0], channelCode: "OTA", sourceCode: "DIRECT", marketCode: "CORP", unitTypeLabel: "Suite" },
      { ...rows[1], channelCode: "DIRECT", sourceCode: "AGENT", marketCode: "LEISURE", unitTypeLabel: "Deluxe" },
    ];
    const q = createMovementQuery("arrival", { sorts: [{ key: "roomType", direction: "asc" }] });
    expect(queryMovementTableRows(commercial, q, [], "UTC").map(row => row.reservationId)).toEqual(["b", "a"]);
    expect(queryMovementTableRows(commercial, q, [{ column: "source", operator: "equals", value: "DIRECT" }], "UTC").map(row => row.reservationId)).toEqual(["b"]);
    expect(queryMovementTableRows(commercial, q, [{ column: "sourceCode", operator: "equals", value: "DIRECT" }], "UTC").map(row => row.reservationId)).toEqual(["a"]);
    expect(queryMovementTableRows(commercial, q, [{ column: "marketCode", operator: "equals", value: "CORP" }], "UTC").map(row => row.reservationId)).toEqual(["a"]);
    expect(movementColumns("arrival", "UTC").find(column => column.key === "source")?.label).toBe("Channel");
    expect(movementColumns("arrival", "UTC").some(column => /readiness|room class|meal plan/i.test(column.label))).toBe(false);
  });
  test("header filters operate on visible property-local date values, never an inferred room class", () => {
    const q = createMovementQuery("arrival");
    const display = movementColumns("arrival", "Asia/Kolkata", true).find(column => column.key === "eta")!.value(rows[0]);
    expect(String(display)).toContain("25");
    expect(queryMovementTableRows(rows, q, [{ column: "eta", operator: "equals", value: String(display) }], "Asia/Kolkata", true)).toEqual([rows[0]]);
    expect(queryMovementTableRows(rows, q, [{ column: "roomClass", operator: "equals", value: "King" }], "UTC")).toEqual([]);
  });
});
