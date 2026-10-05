/** Shared, in-memory controls for already-authorized and bounded table results. */
export type TableValue = string | number | bigint | boolean | null | undefined;
export type TableColumn<T> = Readonly<{ key: string; label: string; value: (row: T) => TableValue }>;
export type TableFilter = Readonly<{
  column: string;
  operator: "contains" | "equals" | "notEquals" | "isEmpty" | "isNotEmpty";
  value: string;
}>;
export type TableSort = Readonly<{ column: string; direction: "asc" | "desc" }>;
export type TableQuery = Readonly<{ search: string; filters: readonly TableFilter[]; sorts: readonly TableSort[] }>;
export const createTableQuery = (): TableQuery => ({ search: "", filters: [], sorts: [] });
export const tableFilterConditions: readonly Readonly<{ value: TableFilter["operator"]; label: string }>[] = [
  { value: "contains", label: "Contains" }, { value: "equals", label: "Is exactly" },
  { value: "notEquals", label: "Is not" }, { value: "isEmpty", label: "Is empty" },
  { value: "isNotEmpty", label: "Is not empty" },
];
export const filterNeedsValue = (operator: TableFilter["operator"]): boolean => operator !== "isEmpty" && operator !== "isNotEmpty";

/** Header changes keep existing precedence; new fields become the next level. */
export function setTableColumnSort(query: TableQuery, column: string, direction: TableSort["direction"]): TableQuery {
  const index = query.sorts.findIndex(sort => sort.column === column);
  const sorts = query.sorts.filter(sort => sort.column !== column);
  sorts.splice(index < 0 ? sorts.length : index, 0, { column, direction });
  return { ...query, sorts };
}
export function clearTableColumn(query: TableQuery, column: string, part: "filters" | "sorts" | "all" = "all"): TableQuery {
  return { ...query,
    filters: part === "sorts" ? query.filters : query.filters.filter(filter => filter.column !== column),
    sorts: part === "filters" ? query.sorts : query.sorts.filter(sort => sort.column !== column),
  };
}
export function moveTableSort(query: TableQuery, from: number, to: number): TableQuery {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= query.sorts.length || to >= query.sorts.length) return query;
  const sorts = [...query.sorts];
  const [sort] = sorts.splice(from, 1);
  if (sort) sorts.splice(to, 0, sort);
  return { ...query, sorts };
}
export function tableColumnSort(query: TableQuery, column: string): "ascending" | "descending" | "none" {
  const sort = query.sorts.find(entry => entry.column === column);
  return sort ? sort.direction === "asc" ? "ascending" : "descending" : "none";
}
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const text = (value: TableValue): string => value == null ? "" : String(value).normalize("NFKC").trim().toLocaleLowerCase("en");
const empty = (value: TableValue): boolean => value == null || (typeof value === "string" && !value.trim());

export function queryTableRows<T>(rows: readonly T[], columns: readonly TableColumn<T>[], query: TableQuery): T[] {
  const byKey = new Map(columns.map(column => [column.key, column]));
  // An unsupported filter cannot silently broaden the results.
  if (query.filters.some(filter => !byKey.has(filter.column)) ||
      query.sorts.some(sort => !byKey.has(sort.column) || (sort.direction !== "asc" && sort.direction !== "desc")) ||
      new Set(query.sorts.map(sort => sort.column)).size !== query.sorts.length) return [];
  const search = text(query.search);
  const filtered = rows.map((row, index) => ({ row, index })).filter(({ row }) => {
    if (search && !columns.some(column => text(column.value(row)).includes(search))) return false;
    return query.filters.every(filter => {
      const value = byKey.get(filter.column)!.value(row);
      const expected = text(filter.value);
      switch (filter.operator) {
        case "contains": return text(value).includes(expected);
        case "equals": return text(value) === expected;
        case "notEquals": return text(value) !== expected;
        case "isEmpty": return empty(value);
        case "isNotEmpty": return !empty(value);
        default: return false;
      }
    });
  });
  if (query.sorts.length) filtered.sort((left, right) => {
    for (const sort of query.sorts) {
      const column = byKey.get(sort.column)!;
      const a = column.value(left.row), b = column.value(right.row);
      // Missing values remain last in both directions.
      if (empty(a) !== empty(b)) return empty(a) ? 1 : -1;
      const comparison = typeof a === "number" && typeof b === "number"
        ? a - b
        : typeof a === "bigint" && typeof b === "bigint"
          ? (a < b ? -1 : a > b ? 1 : 0)
          : collator.compare(text(a), text(b));
      if (comparison) return sort.direction === "desc" ? -comparison : comparison;
    }
    return left.index - right.index;
  });
  return filtered.map(({ row }) => row);
}
