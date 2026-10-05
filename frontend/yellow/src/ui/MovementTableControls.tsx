import { useMemo, useState } from "react";
import { createMovementQuery, type MovementQuery, type MovementRowLike } from "../today-workspace";
import { applyMovementTableQuery, movementColumns, movementTableQuery, queryMovementTableRows, type MovementColumn } from "../movement-table-query";
import { createTableQuery, type TableFilter, type TableQuery } from "../table-query";
import { TableControls } from "./TableControls";
// Presentation-only lane type; current backend status readers remain unchanged.
type ReservationJourneyStage = "pre_arrival" | "arrival" | "in_house" | "departure" | "post_departure";

type Scope = "due_in" | "due_out" | ReservationJourneyStage | "all";
type View = Readonly<{ query: MovementQuery; filters: readonly TableFilter[]; columns?: readonly string[] }>;
const EMPTY_FILTERS: readonly TableFilter[] = [];
const initialQuery = (status: Scope) => createMovementQuery(status === "due_out" || status === "departure" ? "departure" : "arrival", {
  sorts: [{ key: status === "due_in" || status === "arrival" || status === "departure" ? "eta" : "guest", direction: "asc" }, ...(status === "due_in" || status === "arrival" ? [{ key: "guest" as const, direction: "asc" as const }] : [])],
});

/** Each lane keeps its own filters and display fields without remounting the workspace. */
export function useMovementTable<T extends MovementRowLike>({ status, rows, timezone, controlledQuery, onQueryChange }: Readonly<{
  status: Scope; rows: readonly T[]; timezone: string; controlledQuery?: MovementQuery; onQueryChange?: (query: MovementQuery) => void;
}>) {
  const [views, setViews] = useState<Partial<Record<Scope, View>>>({});
  const defaultQuery = useMemo(() => initialQuery(status), [status]);
  const saved = views[status];
  const query = controlledQuery ?? saved?.query ?? defaultQuery;
  const filters = saved?.filters ?? EMPTY_FILTERS;
  const updateQuery = (updates: Partial<MovementQuery>) => {
    const next = createMovementQuery(updates.movementTime ?? query.movementTime, { ...query, ...updates });
    setViews(current => ({ ...current, [status]: { ...current[status], query: next, filters: current[status]?.filters ?? EMPTY_FILTERS } }));
    onQueryChange?.(next);
  };
  const tableQuery = movementTableQuery(query, filters);
  const changeTable = (table: TableQuery) => {
    const next = applyMovementTableQuery(query, table);
    setViews(current => ({ ...current, [status]: { ...current[status], query: next.query, filters: next.filters } }));
    onQueryChange?.(next.query);
  };
  const columns = useMemo(() => movementColumns(query.movementTime, timezone, status === "all"), [query.movementTime, timezone, status]);
  const selectedColumns = saved?.columns ?? columns.filter(column => column.initial).map(column => column.key);
  const setColumns = (next: readonly string[]) => setViews(current => ({ ...current, [status]: { query, filters, ...current[status], columns: next } }));
  const visibleColumns = columns.filter(column => selectedColumns.includes(column.key));
  const visibleRows = useMemo(() => queryMovementTableRows(rows, query, filters, timezone, status === "all"), [rows, query, filters, timezone, status]);
  return { query, updateQuery, tableQuery, changeTable, columns, selectedColumns, setColumns, visibleColumns, visibleRows };
}

export function MovementTableControls({ label, rows, count, columns, selectedColumns, onColumnsChange, query, onQueryChange, tableQuery, onTableChange }: Readonly<{
  label: string; rows: readonly MovementRowLike[]; count: number; columns: readonly MovementColumn[]; selectedColumns: readonly string[];
  onColumnsChange: (keys: readonly string[]) => void; query: MovementQuery; onQueryChange: (updates: Partial<MovementQuery>) => void;
  tableQuery: TableQuery; onTableChange: (query: TableQuery) => void;
}>) {
  const values = (key: "channelCode" | "unitTypeLabel" | "ratePlanLabel") => [...new Set(rows.map(row => row[key]).filter((value): value is string => Boolean(value)))].sort();
  const states = [...new Set(rows.map(row => row.operationalState ?? row.status).filter((value): value is string => Boolean(value)))].sort();
  const criteriaCount = Number(Boolean(query.source)) + Number(Boolean(query.roomType)) + Number(Boolean(query.ratePlan)) + Number(Boolean(query.dateFrom)) + Number(Boolean(query.dateTo)) + Number(query.assignment !== "all") + Number(Boolean(query.state)) + Number(query.minAdults !== null) + Number(query.children !== "all") + Number(query.travel !== "all") + Number(query.pickup !== "all");
  const clearStayCriteria = () => onQueryChange(createMovementQuery(query.movementTime, { search: query.search, sorts: query.sorts }));
  const resetControls = () => {
    const reset = createTableQuery();
    onTableChange(reset);
    onQueryChange(createMovementQuery(query.movementTime));
    onColumnsChange(columns.filter(column => column.initial).map(column => column.key));
  };
  const stayCriteria = <div className="movement-criteria-fields">
          <label>Operational state<select value={query.state} onChange={event => onQueryChange({ state: event.target.value })}><option value="">Any state</option>{states.map(state => <option key={state} value={state}>{state.replaceAll("_", " ")}</option>)}</select></label>
          <label>Channel<select value={query.source} onChange={event => onQueryChange({ source: event.target.value })}><option value="">Any channel</option>{values("channelCode").map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Room type<select value={query.roomType} onChange={event => onQueryChange({ roomType: event.target.value })}><option value="">Any room type</option>{values("unitTypeLabel").map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Rate plan<select value={query.ratePlan} onChange={event => onQueryChange({ ratePlan: event.target.value })}><option value="">Any rate plan</option>{values("ratePlanLabel").map(value => <option key={value}>{value}</option>)}</select></label>
          <label>{query.movementTime === "departure" ? "Departure from" : "Arrival from"}<input type="date" value={query.dateFrom} onChange={event => onQueryChange({ dateFrom: event.target.value })} /></label>
          <label>{query.movementTime === "departure" ? "Departure to" : "Arrival to"}<input type="date" value={query.dateTo} min={query.dateFrom || undefined} onChange={event => onQueryChange({ dateTo: event.target.value })} /></label>
          <label>Room assignment<select value={query.assignment} onChange={event => onQueryChange({ assignment: event.target.value as MovementQuery["assignment"] })}><option value="all">Any</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option></select></label>
          <label>Minimum adults<input type="number" min="1" max="20" inputMode="numeric" value={query.minAdults ?? ""} onChange={event => { const value = Number(event.target.value); onQueryChange({ minAdults: event.target.value === "" || !Number.isSafeInteger(value) || value < 1 || value > 20 ? null : value }); }} /></label>
          <label>Children<select value={query.children} onChange={event => onQueryChange({ children: event.target.value as MovementQuery["children"] })}><option value="all">Any</option><option value="present">With children</option><option value="absent">0 children recorded</option></select></label>
          <label>{query.movementTime === "departure" ? "Departure travel" : "Arrival travel"}<select value={query.travel} onChange={event => onQueryChange({ travel: event.target.value as MovementQuery["travel"] })}><option value="all">Any</option><option value="recorded">Travel recorded</option><option value="not_recorded">Travel not recorded</option></select></label>
          <label>Pickup<select value={query.pickup} onChange={event => onQueryChange({ pickup: event.target.value as MovementQuery["pickup"] })}><option value="all">Any</option><option value="requested">Pickup requested</option><option value="not_recorded">No pickup recorded</option></select></label>
  </div>;
  return <div className="movement-table-controls">
    <TableControls label={label} columns={columns} query={tableQuery} onChange={onTableChange} count={count} total={rows.length}
      selectedColumns={selectedColumns} onColumnsChange={onColumnsChange} stayCriteria={stayCriteria} stayCriteriaCount={criteriaCount} onClearStayCriteria={clearStayCriteria} onReset={resetControls} />
  </div>;
}
