import { VoiceInput } from "./VoiceField";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { clearTableColumn, filterNeedsValue, setTableColumnSort, tableFilterConditions, type TableFilter, type TableQuery, type TableValue } from "../table-query";
import "./table-controls.css";

type Props = Readonly<{
  column: Readonly<{ key: string; label: string }>;
  query: TableQuery;
  onChange: (query: TableQuery) => void;
  /** Values must come from the caller's already-authorized, loaded rows. */
  values?: readonly TableValue[];
  disabled?: boolean;
}>;

/** Shared header disclosure. The dialog portal escapes table scroll clipping. */
export function TableColumnMenu({ column, query, onChange, values, disabled = false }: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ left: 8, top: 8 });
  const [operator, setOperator] = useState<TableFilter["operator"]>("contains");
  const [value, setValue] = useState("");
  const [valueSearch, setValueSearch] = useState("");
  const sortIndex = query.sorts.findIndex(sort => sort.column === column.key);
  const sort = query.sorts[sortIndex];
  const filters = query.filters.filter(filter => filter.column === column.key);
  const choices = useMemo(() => [...new Set((values ?? []).map(entry => entry == null ? "" : String(entry)))], [values]);
  const visibleChoices = choices.filter(choice => choice.toLocaleLowerCase().includes(valueSearch.toLocaleLowerCase()));
  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };
  const applyFilter = (nextOperator = operator, nextValue = value) => {
    if (disabled) return;
    onChange({ ...query, filters: [...query.filters.filter(filter => filter.column !== column.key), { column: column.key, operator: nextOperator, value: nextValue }] });
    close();
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const popup = panel.current?.getBoundingClientRect();
      if (!anchor || !popup) return;
      setPosition({
        left: Math.max(8, Math.min(anchor.left, window.innerWidth - popup.width - 8)),
        top: Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - popup.height - 8)),
      });
    };
    place();
    panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    window.addEventListener("resize", place);
    // A scrolling parent can move the header; keep the disclosure attached.
    window.addEventListener("scroll", place, true);
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // The nested dictation surface owns the first Escape; its React handler
      // cancels the draft without also dismissing this column menu.
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".voice-field-panel") || target?.closest(".voice-field")?.querySelector('.voice-field-mic[aria-expanded="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  return <>
    <button type="button" ref={trigger} className="table-column-trigger" data-active={Boolean(sort || filters.length)}
      data-open={open} disabled={disabled} aria-label={`${column.label} column options${sort ? `, ${sort.direction === "asc" ? "ascending" : "descending"}, priority ${sortIndex + 1}` : ""}${filters.length ? `, ${filters.length} filters` : ""}`}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => {
        if (open) { close(); return; }
        const filter = filters[0];
        setOperator(filter?.operator ?? "contains"); setValue(filter?.value ?? ""); setValueSearch(""); setOpen(true);
      }}>
      <span className="table-column-label">{column.label}</span>
      {sort ? <span className="table-column-state table-column-sort-state" aria-hidden="true"><svg data-sort-direction={sort.direction} viewBox="0 0 16 16" fill="none"><path d={sort.direction === "asc" ? "M8 13V3m-4 4 4-4 4 4" : "M8 3v10m-4-4 4 4 4-4"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg><small>{sortIndex + 1}</small></span> : null}
      {filters.length ? <span className="table-column-state table-column-filter-state" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M2.5 3.5h11L9.5 8v4.3l-3 1V8L2.5 3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg><small>{filters.length}</small></span> : null}
      <svg className="table-column-chevron" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open && !disabled ? createPortal(<div ref={panel} id={id} role="dialog" aria-label={`${column.label} column options`}
      className="table-column-menu" style={position} onClick={event => event.stopPropagation()}>
      <div className="table-column-menu-heading"><strong>{column.label}</strong><button type="button" aria-label="Close column options" onClick={() => close()}>×</button></div>
      <div className="table-column-actions">
        <button type="button" aria-pressed={sort?.direction === "asc"} onClick={() => { onChange(setTableColumnSort(query, column.key, "asc")); close(); }}><span className="table-column-menu-glyph" aria-hidden="true">↑</span>Sort ascending</button>
        <button type="button" aria-pressed={sort?.direction === "desc"} onClick={() => { onChange(setTableColumnSort(query, column.key, "desc")); close(); }}><span className="table-column-menu-glyph" aria-hidden="true">↓</span>Sort descending</button>
        <button type="button" disabled={!sort} onClick={() => { onChange(clearTableColumn(query, column.key, "sorts")); close(); }}>Clear column sort</button>
      </div>
      <div className="table-column-filter">
        <label><span className="table-column-filter-label"><svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M2.5 3.5h11L9.5 8v4.3l-3 1V8L2.5 3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>Condition</span><select value={operator} onChange={event => setOperator(event.target.value as TableFilter["operator"])}>
          {tableFilterConditions.map(condition => <option key={condition.value} value={condition.value}>{condition.label}</option>)}
        </select></label>
        {filterNeedsValue(operator) ? <label>Value<VoiceInput aria-label="Filter value" contextKey={column.key} onVoiceValue={voiceValue => setValue(voiceValue)} value={value} onChange={event => setValue(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); applyFilter(); } }} /></label> : null}
        {filters.length > 1 ? <p>Applying replaces this column’s {filters.length} rules.</p> : null}
        <div className="table-column-filter-actions"><button type="button" onClick={() => applyFilter()}>Apply filter</button>
          <button type="button" disabled={!filters.length} onClick={() => { onChange(clearTableColumn(query, column.key, "filters")); close(); }}>Clear column filter</button></div>
      </div>
      {values ? <details className="table-column-values"><summary>Choose a loaded value ({choices.length})</summary>
        <label>Find a value<VoiceInput aria-label="Find a value" contextKey={column.key} onVoiceValue={voiceValue => setValueSearch(voiceValue)} type="search" value={valueSearch} onChange={event => setValueSearch(event.target.value)} /></label>
        <div className="table-column-value-list">{visibleChoices.map(choice => <button type="button" key={choice}
          onClick={() => applyFilter(choice.trim() ? "equals" : "isEmpty", choice)}>{choice.trim() ? choice : "(Empty)"}</button>)}
          {!visibleChoices.length ? <p>No matching values.</p> : null}</div>
      </details> : null}
    </div>, document.body) : null}
  </>;
}
