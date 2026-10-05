import { describe, expect, test } from "bun:test";
import { createMovementQuery, type MovementRowLike } from "../frontend/yellow/src/today-workspace";
import { movementColumns, movementTableQuery, applyMovementTableQuery, queryMovementTableRows } from "../frontend/yellow/src/movement-table-query";

const rows: readonly MovementRowLike[] = [
  { reservationId: "a", confirmationNo: "A", unitTypeLabel: "Deluxe", unitTypeCode: "DLX2", ratePlanLabel: "Flexible", ratePlanCode: "BAR10" },
  { reservationId: "b", confirmationNo: "B", unitTypeLabel: "Deluxe", unitTypeCode: "DLX1", ratePlanLabel: "Flexible", ratePlanCode: "BAR2" },
  { reservationId: "c", confirmationNo: "C", unitTypeLabel: "Suite", unitTypeCode: "STE", ratePlanLabel: "Corporate", ratePlanCode: "CORP" },
  { reservationId: "missing", confirmationNo: "D", unitTypeLabel: "King", ratePlanLabel: "Bed and Breakfast" },
];

describe("Order675 stored product codes in movement tables", () => {
  test("codes are separate from labels, with no inference from old payloads", () => {
    const columns = movementColumns("arrival", "UTC");
    const rate = columns.find(column => column.key === "rateCode")!;
    const room = columns.find(column => column.key === "roomTypeCode")!;
    expect(rate.label).toBe("Rate code");
    expect(rate.initial).toBe(true);
    expect(room.label).toBe("Room type code");
    expect(room.initial).toBe(false);
    expect(rate.value(rows[0]!)).toBe("BAR10");
    expect(room.value(rows[0]!)).toBe("DLX2");
    expect(rate.value(rows[3]!)).toBeUndefined();
    expect(room.value(rows[3]!)).toBeUndefined();
    expect(columns.some(column => /room class|meal plan/i.test(column.label))).toBe(false);
  });

  test("code search works for each movement direction without replacing label search", () => {
    for (const direction of ["arrival", "departure"] as const) {
      expect(queryMovementTableRows(rows, createMovementQuery(direction, { search: "bar2" }), [], "UTC").map(row => row.reservationId)).toEqual(["b"]);
      expect(queryMovementTableRows(rows, createMovementQuery(direction, { search: "dlx2" }), [], "UTC").map(row => row.reservationId)).toEqual(["a"]);
      expect(queryMovementTableRows(rows, createMovementQuery(direction, { search: "Flexible" }), [], "UTC")).toHaveLength(2);
    }
  });

  test("header filters distinguish identical names and support missing-code checks", () => {
    const query = createMovementQuery("arrival");
    expect(queryMovementTableRows(rows, query, [
      { column: "roomTypeCode", operator: "equals", value: "DLX1" },
      { column: "rateCode", operator: "equals", value: "bar2" },
    ], "UTC").map(row => row.reservationId)).toEqual(["b"]);
    expect(queryMovementTableRows(rows, query, [{ column: "rateCode", operator: "isEmpty", value: "" }], "UTC").map(row => row.reservationId)).toEqual(["missing"]);
  });

  test("both codes survive sort round trips and natural numeric ordering", () => {
    const query = createMovementQuery("arrival", { sorts: [{ key: "rateCode", direction: "asc" }, { key: "roomTypeCode", direction: "desc" }] });
    const mapped = applyMovementTableQuery(query, movementTableQuery(query, []));
    expect(mapped.query.sorts).toEqual(query.sorts);
    expect(queryMovementTableRows(rows.slice(0, 3), mapped.query, [], "UTC").map(row => row.reservationId)).toEqual(["b", "a", "c"]);
    const roomQuery = createMovementQuery("departure", { sorts: [{ key: "roomTypeCode", direction: "desc" }] });
    expect(queryMovementTableRows(rows.slice(0, 3), roomQuery, [], "UTC").map(row => row.reservationId)).toEqual(["c", "a", "b"]);
    expect(rows.map(row => row.reservationId)).toEqual(["a", "b", "c", "missing"]);
  });
});
