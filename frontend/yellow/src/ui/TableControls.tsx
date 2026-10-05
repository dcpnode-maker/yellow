import { VoiceInput } from "./VoiceField";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { filterNeedsValue, tableFilterConditions, type TableColumn, type TableFilter, type TableQuery, type TableSort } from "../table-query";

type Editor = "filter" | "sort" | "columns" | null;
type Props<T> = Readonly<{
  label: string;
  columns: readonly TableColumn<T>[];
  query: TableQuery;
  onChange: (query: TableQuery) => void;
  count: number;
  total: number;
  selectedColumns?: readonly string[];
  onColumnsChange?: (keys: readonly string[]) => void;
  stayCriteria?: ReactNode;
  stayCriteriaCount?: number;
  onClearStayCriteria?: () => void;
  onReset?: () => void;
  disabled?: boolean;
}>;

const clone = (query: TableQuery): TableQuery => ({ search: query.search, filters: query.filters.map(filter => ({ ...filter })), sorts: query.sorts.map(sort => ({ ...sort })) });

/** Compact table toolbar with one shared, explicitly selected editor surface. */
export function TableControls<T>({ label, columns, query, onChange, count, total, selectedColumns, onColumnsChange, stayCriteria, stayCriteriaCount = 0, onClearStayCriteria, onReset, disabled = false }: Props<T>) {
  const [editor, setEditor] = useState<Editor>(null);
  const [draft, setDraft] = useState<TableQuery>(() => clone(query));
  const fingerprint = JSON.stringify([query.filters, query.sorts, selectedColumns]);
  useEffect(() => { if (!editor) setDraft(clone(query)); }, [fingerprint, editor]);
  const activeColumnCount = selectedColumns?.length ?? columns.length;
  const filterCount = query.filters.length + stayCriteriaCount;
  const columnMap = useMemo(() => new Map(columns.map(column => [column.key, column])), [columns]);
  const updateDraft = (updates: Partial<TableQuery>) => setDraft(value => ({ ...value, ...updates }));
  const addFilter = () => {
    const column = columns.find(candidate => !draft.filters.some(filter => filter.column === candidate.key)) ?? columns[0];
    if (column) updateDraft({ filters: [...draft.filters, { column: column.key, operator: "contains", value: "" }] });
  };
  const addSort = () => {
    const column = columns.find(candidate => !draft.sorts.some(sort => sort.column === candidate.key));
    if (column) updateDraft({ sorts: [...draft.sorts, { column: column.key, direction: "asc" }] });
  };
  const moveSort = (from: number, to: number) => {
    const sorts = [...draft.sorts]; const current = sorts[from]; const other = sorts[to];
    if (!current || !other) return;
    sorts[from] = other; sorts[to] = current; updateDraft({ sorts });
  };
  const save = () => { onChange({ ...draft, search: query.search }); setEditor(null); };
  const open = (next: Exclude<Editor, null>) => { setDraft(clone(query)); setEditor(value => value === next ? null : next); };
  return <fieldset className="table-controls table-controls-compact" disabled={disabled}>
    <legend>{label} table controls</legend>
    <div className="table-controls-main">
      <div className="table-controls-search-row">
        <label><span className="table-controls-search-label">Search {label}</span><VoiceInput contextKey={label} onVoiceValue={voiceValue => onChange({ ...query, search: voiceValue })} type="search" aria-label={`Search ${label}`} disabled={disabled} value={query.search} onChange={event => onChange({ ...query, search: event.target.value })} placeholder={`Search ${label.toLowerCase()}`} /></label>
        <span role="status" aria-live="polite">Showing {count.toLocaleString()} of {total.toLocaleString()}</span>
      </div>
      <div className="table-controls-action-row">
      {onReset ? <button type="button" disabled={disabled} aria-label="Reset table controls" onClick={onReset}>Reset</button> : null}
      <div className="table-controls-actions" role="group" aria-label={`${label} table editors`}>
        <button type="button" disabled={disabled} aria-label={`Filter${filterCount ? ` (${filterCount} active)` : ""}`} aria-expanded={editor === "filter"} aria-controls="table-editor" onClick={() => open("filter")}><span className="table-controls-action-full">Filter{filterCount ? ` (${filterCount})` : ""}</span><span className="table-controls-action-short" aria-hidden="true">Filter</span></button>
        <button type="button" disabled={disabled} aria-label={`Sort${query.sorts.length ? ` (${query.sorts.length} active)` : ""}`} aria-expanded={editor === "sort"} aria-controls="table-editor" onClick={() => open("sort")}><span className="table-controls-action-full">Sort{query.sorts.length ? ` (${query.sorts.length})` : ""}</span><span className="table-controls-action-short" aria-hidden="true">Sort</span></button>
        <button type="button" disabled={disabled} aria-label={`Columns (${activeColumnCount} visible)`} aria-expanded={editor === "columns"} aria-controls="table-editor" onClick={() => open("columns")}><span className="table-controls-action-full">Columns ({activeColumnCount})</span><span className="table-controls-action-short" aria-hidden="true">Cols</span></button>
      </div>
      </div>
    </div>
    {editor ? <section id="table-editor" className="table-editor" aria-label={`${editor === "filter" ? "Filter" : editor === "sort" ? "Sort" : "Column"} editor`}>
      <header><h3>{editor === "filter" ? "Filters" : editor === "sort" ? "Sort order" : "Visible columns"}</h3><button type="button" aria-label="Close table editor" onClick={() => { setDraft(clone(query)); setEditor(null); }}>×</button></header>
      {editor === "filter" ? <>
        {stayCriteria ? <section className="table-stay-criteria" aria-label="Stay criteria"><h4>Stay criteria</h4>{stayCriteria}{stayCriteriaCount ? <button type="button" onClick={onClearStayCriteria}>Clear stay criteria</button> : null}</section> : null}
        <h4>Table filters</h4><p>All rules must match. Add as many levels as needed.</p>
        {draft.filters.map((filter, index) => <div className="table-controls-rule" key={`${filter.column}-${index}`}>
          <label>Field<select aria-label={`Filter field ${index + 1}`} value={filter.column} onChange={event => updateDraft({ filters: draft.filters.map((item, position) => position === index ? { ...item, column: event.target.value } : item) })}>{columns.map(column => <option key={column.key} value={column.key}>{column.label}</option>)}</select></label>
          <label>Condition<select aria-label={`Filter condition ${index + 1}`} value={filter.operator} onChange={event => updateDraft({ filters: draft.filters.map((item, position) => position === index ? { ...item, operator: event.target.value as TableFilter["operator"] } : item) })}>{tableFilterConditions.map(condition => <option key={condition.value} value={condition.value}>{condition.label}</option>)}</select></label>
          {filterNeedsValue(filter.operator) ? <label>Value<VoiceInput contextKey={`${label}:${filter.column}:${index}`} onVoiceValue={voiceValue => updateDraft({ filters: draft.filters.map((item, position) => position === index ? { ...item, value: voiceValue } : item) })} aria-label={`Filter value ${index + 1}`} value={filter.value} onChange={event => updateDraft({ filters: draft.filters.map((item, position) => position === index ? { ...item, value: event.target.value } : item) })} /></label> : null}
          <button type="button" aria-label={`Remove filter ${index + 1}`} onClick={() => updateDraft({ filters: draft.filters.filter((_, position) => position !== index) })}>Remove</button>
        </div>)}
        {draft.filters.length ? <button type="button" onClick={() => updateDraft({ filters: [] })}>Clear table filters</button> : null}
        <button type="button" onClick={addFilter} disabled={!columns.length}>Add filter</button>
      </> : null}
      {editor === "sort" ? <>
        <p>Sorts apply from top to bottom. Add and reorder levels as needed.</p>
        {draft.sorts.map((sort, index) => <div className="table-controls-rule" key={`${sort.column}-${index}`}>
          <label>Level {index + 1}<select aria-label={`Sort field ${index + 1}`} value={sort.column} onChange={event => updateDraft({ sorts: draft.sorts.map((item, position) => position === index ? { ...item, column: event.target.value } : item) })}>{columns.filter(column => !draft.sorts.some((other, position) => position !== index && other.column === column.key)).map(column => <option key={column.key} value={column.key}>{column.label}</option>)}</select></label>
          <label>Direction<select aria-label={`Sort direction ${index + 1}`} value={sort.direction} onChange={event => updateDraft({ sorts: draft.sorts.map((item, position) => position === index ? { ...item, direction: event.target.value as TableSort["direction"] } : item) })}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
          <div className="table-controls-priority"><button type="button" aria-label={`Move sort ${index + 1} up`} disabled={disabled || index === 0} onClick={() => moveSort(index, index - 1)}>↑</button><button type="button" aria-label={`Move sort ${index + 1} down`} disabled={disabled || index === draft.sorts.length - 1} onClick={() => moveSort(index, index + 1)}>↓</button><button type="button" disabled={disabled} aria-label={`Remove sort ${index + 1}`} onClick={() => updateDraft({ sorts: draft.sorts.filter((_, position) => position !== index) })}>Remove</button></div>
        </div>)}
        {draft.sorts.length ? <button type="button" onClick={() => updateDraft({ sorts: [] })}>Clear sort</button> : null}
        <button type="button" onClick={addSort} disabled={!columns.some(column => !draft.sorts.some(sort => sort.column === column.key))}>Add sort level</button>
      </> : null}
      {editor === "columns" ? <div className="table-columns-editor">{columns.map(column => <label key={column.key}><input type="checkbox" checked={selectedColumns?.includes(column.key) ?? true} disabled={!onColumnsChange || (selectedColumns?.length === 1 && selectedColumns.includes(column.key))} onChange={event => { if (!selectedColumns || !onColumnsChange) return; onColumnsChange(event.target.checked ? [...selectedColumns, column.key] : selectedColumns.filter(key => key !== column.key)); }} />{column.label}</label>)}</div> : null}
      <footer><span>{columnMap.size} fields</span><button type="button" onClick={() => { setDraft(clone(query)); setEditor(null); }}>Cancel</button><button type="button" className="table-editor-apply" onClick={save}>Apply</button></footer>
    </section> : null}
  </fieldset>;
}
