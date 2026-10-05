import { expect, test } from "bun:test";
import { clearTableColumn, createTableQuery, moveTableSort, queryTableRows, setTableColumnSort, tableColumnSort, type TableColumn, type TableFilter, type TableQuery } from "../frontend/yellow/src/table-query";
import { createFolioStatementColumns, type FolioStatementRowView } from "../frontend/yellow/src/folio-statement-view";

type Row = { id: string; a: string; b: string; c: number; d: bigint; empty?: string | null };
const rows: readonly Row[] = [
  { id: "high", a: "Leisure", b: "WEB2", c: 2, d: 9007199254740993n, empty: null },
  { id: "low", a: "Leisure", b: "WEB2", c: 2, d: 9007199254740992n, empty: " " },
  { id: "code", a: "Leisure", b: "WEB10", c: 1, d: -9007199254740993n, empty: "present" },
];
const columns: readonly TableColumn<Row>[] = [
  { key: "a", label: "Group", value: row => row.a },
  { key: "b", label: "Code", value: row => row.b },
  { key: "c", label: "Count", value: row => row.c },
  { key: "d", label: "Minor units", value: row => row.d },
  { key: "empty", label: "Optional", value: row => row.empty },
];
const ids = (query: TableQuery) => queryTableRows(rows, columns, query).map(row => row.id);

test("six AND filters execute, including the decisive sixth rule", () => {
  const filters: TableFilter[] = [
    { column: "a", operator: "contains", value: "leis" },
    { column: "a", operator: "equals", value: "LEISURE" },
    { column: "b", operator: "contains", value: "web" },
    { column: "b", operator: "notEquals", value: "DIRECT" },
    { column: "c", operator: "isNotEmpty", value: "" },
    { column: "d", operator: "equals", value: "9007199254740993" },
  ];
  expect(ids({ search: "WEB", filters, sorts: [] })).toEqual(["high"]);
  filters[5] = { column: "d", operator: "equals", value: "9007199254740992" };
  expect(ids({ search: "WEB", filters, sorts: [] })).toEqual(["low"]);
  filters[5] = { column: "d", operator: "equals", value: "9007199254740995" };
  expect(ids({ search: "WEB", filters, sorts: [] })).toEqual([]);
});

test("four unique sort levels evaluate the fourth exact bigint tie-breaker", () => {
  let query = createTableQuery();
  for (const column of ["a", "b", "c", "d"]) query = setTableColumnSort(query, column, "asc");
  expect(query.sorts).toHaveLength(4);
  expect(ids(query)).toEqual(["low", "high", "code"]);
  expect(ids(setTableColumnSort(query, "d", "desc"))).toEqual(["high", "low", "code"]);
  expect(query.sorts[3]?.direction).toBe("asc");
});

test("header direction changes preserve priority, adding is unique, reordering changes the result", () => {
  const query = setTableColumnSort(setTableColumnSort(createTableQuery(), "b", "asc"), "c", "asc");
  const updated = setTableColumnSort(query, "b", "desc");
  expect(updated.sorts).toEqual([{ column: "b", direction: "desc" }, { column: "c", direction: "asc" }]);
  expect(ids(query)).toEqual(["high", "low", "code"]);
  expect(ids(moveTableSort(query, 1, 0))).toEqual(["code", "high", "low"]);
  expect(query.sorts[0]?.column).toBe("b");
  expect(moveTableSort(query, -1, 0)).toBe(query);
  expect(moveTableSort(query, 0, 9)).toBe(query);
  expect(moveTableSort(query, 0.5, 1)).toBe(query);
  expect(tableColumnSort(updated, "b")).toBe("descending");
  expect(tableColumnSort(updated, "c")).toBe("ascending");
  expect(tableColumnSort(updated, "d")).toBe("none");
});

test("clear-column actions preserve search and rules on other columns", () => {
  const query: TableQuery = { search: "WEB", filters: [
    { column: "b", operator: "equals", value: "WEB2" },
    { column: "b", operator: "notEquals", value: "WEB10" },
    { column: "d", operator: "isNotEmpty", value: "" },
  ], sorts: [{ column: "b", direction: "asc" }, { column: "d", direction: "desc" }] };
  expect(ids(query)).toEqual(["high", "low"]);
  const filtersCleared = clearTableColumn(query, "b", "filters");
  expect(filtersCleared.filters).toEqual([query.filters[2]!]);
  expect(filtersCleared.sorts).toBe(query.sorts);
  expect(ids(filtersCleared)).toEqual(["high", "low", "code"]);
  const sortsCleared = clearTableColumn(query, "b", "sorts");
  expect(sortsCleared.filters).toBe(query.filters);
  expect(sortsCleared.sorts).toEqual([query.sorts[1]!]);
  const cleared = clearTableColumn(query, "b");
  expect(cleared.search).toBe("WEB");
  expect(cleared.filters).toEqual([query.filters[2]!]);
  expect(cleared.sorts).toEqual([query.sorts[1]!]);
});

test("unsupported columns, operators, directions and duplicate sorts fail closed", () => {
  expect(ids({ ...createTableQuery(), filters: [{ column: "unknown", operator: "contains", value: "" }] })).toEqual([]);
  expect(ids({ ...createTableQuery(), sorts: [{ column: "unknown", direction: "asc" }] })).toEqual([]);
  expect(ids({ ...createTableQuery(), filters: [{ column: "a", operator: "unsupported" as TableFilter["operator"], value: "" }] })).toEqual([]);
  expect(ids({ ...createTableQuery(), sorts: [{ column: "a", direction: "sideways" as "asc" }] })).toEqual([]);
  expect(ids({ ...createTableQuery(), sorts: [{ column: "a", direction: "asc" }, { column: "a", direction: "desc" }] })).toEqual([]);
});

test("empty values remain last in both directions and blank predicates are explicit", () => {
  for (const direction of ["asc", "desc"] as const) expect(ids(setTableColumnSort(createTableQuery(), "empty", direction))).toEqual(["code", "high", "low"]);
  expect(ids({ ...createTableQuery(), filters: [{ column: "empty", operator: "isEmpty", value: "ignored" }] })).toEqual(["high", "low"]);
  expect(ids({ ...createTableQuery(), filters: [{ column: "empty", operator: "isNotEmpty", value: "ignored" }] })).toEqual(["code"]);
  expect(queryTableRows([], columns, createTableQuery())).toEqual([]);
});

test("folio filtering and sorting retain exact server balances and original row references", () => {
  const statement: FolioStatementRowView[] = [
    { lineId: "a", businessDate: "2026-09-24", description: "Room", kind: "charge", txCode: "ROOM", quantity: "1", amountMinor: "9007199254740993", runningBalanceMinor: "9007199254740993" },
    { lineId: "b", businessDate: "2026-09-24", description: "Room", kind: "charge", txCode: "ROOM", quantity: "1", amountMinor: "9007199254740992", runningBalanceMinor: "18014398509481985" },
  ];
  const before = JSON.stringify(statement);
  let query = createTableQuery();
  for (const column of ["businessDate", "kind", "txCode", "amountMinor"]) query = setTableColumnSort(query, column, "asc");
  const result = queryTableRows(statement, createFolioStatementColumns(), query);
  expect(result[0]).toBe(statement[1]);
  expect(result[0]?.runningBalanceMinor).toBe("18014398509481985");
  expect(queryTableRows(statement, createFolioStatementColumns(), { ...query, filters: [{ column: "amountMinor", operator: "equals", value: "9007199254740993" }] })).toEqual([statement[0]!]);
  expect(JSON.stringify(statement)).toBe(before);
});

test("mapping views preserve originalIndex for the correct unsaved draft row after sorting", () => {
  const draft = [{ key: "z", marketCode: "ZZZ", segmentCode: "LEI" }, { key: "a", marketCode: "AAA", segmentCode: "CORP" }];
  const mapped = draft.map((row, originalIndex) => ({ ...row, originalIndex }));
  const result = queryTableRows(mapped, [{ key: "marketCode", label: "Market code", value: row => row.marketCode }], setTableColumnSort(createTableQuery(), "marketCode", "asc"));
  expect(result[0]).toBe(mapped[1]);
  const edited = draft.map((row, index) => index === result[0]!.originalIndex ? { ...row, segmentCode: "NEW" } : row);
  expect(edited[0]).toBe(draft[0]);
  expect(edited[1]).toEqual({ key: "a", marketCode: "AAA", segmentCode: "NEW" });
  expect(draft[1]?.segmentCode).toBe("CORP");
});
