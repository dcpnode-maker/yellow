import { expect, test } from "bun:test";
import { createTableQuery, queryTableRows, type TableColumn } from "../frontend/yellow/src/table-query";
const rows = [
  { id: "first", group: "Leisure", code: "WEB10", count: 12, amount: 9007199254740993n },
  { id: "second", group: "CORP", code: "WEB2", count: 9, amount: 9007199254740992n },
  { id: "third", group: "Leisure", code: "WEB2", count: 12, amount: 9007199254740994n },
  { id: "missing", group: null, code: "OTA", count: 0, amount: 0n },
];
const columns: readonly TableColumn<(typeof rows)[number]>[] = [
  { key: "group", label: "Group", value: row => row.group },
  { key: "code", label: "Code", value: row => row.code },
  { key: "count", label: "Bookings", value: row => row.count },
  { key: "amount", label: "Minor units", value: row => row.amount },
];
test("query preserves original row identities and stable order without mutating input", () => {
  const result = queryTableRows(rows, columns, createTableQuery());
  expect(result).toEqual(rows);
  expect(result).not.toBe(rows);
  expect(result[0]).toBe(rows[0]);
});
test("one search composes with all advanced filters", () => {
  expect(queryTableRows(rows, columns, { search: "web", filters: [
    { column: "group", operator: "equals", value: "leisure" },
    { column: "code", operator: "notEquals", value: "WEB10" },
  ], sorts: [] }).map(row => row.id)).toEqual(["third"]);
});
test("sorting respects ordered levels, natural codes, stable ties and missing-last", () => {
  expect(queryTableRows(rows, columns, { ...createTableQuery(), sorts: [
    { column: "count", direction: "desc" }, { column: "code", direction: "asc" },
  ] }).map(row => row.id)).toEqual(["third", "first", "second", "missing"]);
  expect(queryTableRows(rows, columns, { ...createTableQuery(), sorts: [{ column: "group", direction: "desc" }] }).map(row => row.id)).toEqual(["first", "third", "second", "missing"]);
  expect(rows[0]?.id).toBe("first");
});
test("bigint values retain exact sort ordering without float coercion", () => {
  expect(queryTableRows(rows, columns, { ...createTableQuery(), sorts: [{ column: "amount", direction: "asc" }] }).map(row => row.id)).toEqual(["missing", "second", "first", "third"]);
});
test("empty values are explicit and unsupported columns never broaden a view", () => {
  expect(queryTableRows(rows, columns, { ...createTableQuery(), filters: [{ column: "group", operator: "isEmpty", value: "" }] }).map(row => row.id)).toEqual(["missing"]);
  expect(queryTableRows(rows, columns, { ...createTableQuery(), filters: [{ column: "unknown", operator: "equals", value: "" }] })).toEqual([]);
});
