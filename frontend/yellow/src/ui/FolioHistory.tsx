import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createFolioHistoryController, folioHistoryAtLimit, FOLIO_HISTORY_MAX_ROWS,
  type FolioHistoryContext, type FolioHistoryState } from "../folio-history";
import { FolioStatementTable } from "./FolioStatementTable";

type ViewProps = Readonly<{
  state: FolioHistoryState; disabled: boolean; onLoadMore: () => void; onRefresh: () => void;
  postingClass?: string; onPostingClassChange?: (value: string) => void;
}>;

export function FolioHistoryView({ state, disabled, onLoadMore, onRefresh,
  postingClass: controlledPostingClass, onPostingClassChange }: ViewProps) {
  const [localPostingClass, setLocalPostingClass] = useState("all");
  const postingClass = controlledPostingClass ?? localPostingClass;
  const setPostingClass = onPostingClassChange ?? setLocalPostingClass;
  const classes = useMemo(() => [...new Set(state.rows.map(row => row.kind))], [state.rows]);
  const selectedClass = classes.includes(postingClass) ? postingClass : "all";
  const visibleRows = useMemo(() => state.rows.filter(row => selectedClass === "all" || row.kind === selectedClass), [state.rows, selectedClass]);
  const complete = state.page !== null && state.nextCursor === null && state.rows.length === state.page.lineCount;
  const atLimit = state.page !== null && folioHistoryAtLimit(state.rows.length, state.page.lineCount);
  return <section aria-label="Folio posting history" aria-busy={state.status === "loading"}>
    <p className="folio-statement-note" role="status" aria-live="polite">
      {state.page ? `Loaded ${state.rows.length} of ${state.page.lineCount} postings. ` : "History is unavailable. "}
      {complete ? "Search, filter and sort cover the complete loaded statement." : "Search, filter and sort apply only to the loaded postings, not the whole statement."}
    </p>
    {state.status === "refresh-required" && state.rows.length > 0 ? <p className="folio-statement-note" role="note">These rows are the previous snapshot. Refresh is required before loading more history.</p> : null}
    {state.message ? <p role="alert">{state.message}</p> : null}
    {classes.length > 1 ? <div className="cashier-posting-tabs" aria-label="Loaded posting classes">
      <button type="button" aria-pressed={selectedClass === "all"} className={selectedClass === "all" ? "active" : undefined}
        onClick={() => setPostingClass("all")}>{complete ? "All postings" : "Loaded postings"} ({state.rows.length})</button>
      {classes.map(kind => <button type="button" key={kind} aria-pressed={selectedClass === kind}
        className={selectedClass === kind ? "active" : undefined} onClick={() => setPostingClass(kind)}>
        {kind.replaceAll("_", " ")} ({state.rows.filter(row => row.kind === kind).length})</button>)}
    </div> : null}
    {state.page ? <FolioStatementTable rows={visibleRows} currency={state.page.folio.currency} /> : null}
    <div className="cashier-posting-tabs" aria-label="Statement history controls">
      {state.nextCursor && state.status !== "refresh-required" ? <button type="button" disabled={disabled || state.status === "loading" || atLimit} onClick={onLoadMore}>
        {state.status === "loading" ? "Loading older postings…" : state.status === "error" ? "Retry older postings" : "Load older postings"}
      </button> : null}
      <button type="button" disabled={disabled || state.status === "loading"} onClick={onRefresh}>Refresh bill history</button>
    </div>
    {atLimit && !complete ? <p role="note">This view is limited to {FOLIO_HISTORY_MAX_ROWS.toLocaleString("en-US")} loaded postings. The statement is not complete; refresh restarts from its newest postings.</p> : null}
    {disabled ? <p className="folio-statement-note">History loading and refresh are paused while a financial action is in progress.</p> : null}
  </section>;
}

type Props = Readonly<{
  context: FolioHistoryContext; firstPage: unknown; refreshKey: number; disabled: boolean;
  loadPage: (after: string, signal: AbortSignal) => Promise<unknown>; onRefresh: () => void;
  postingClass?: string; onPostingClassChange?: (value: string) => void;
}>;

export function FolioHistory(props: Props) {
  const latest = useRef(props); latest.current = props;
  // A fresh authoritative first page (including structurally shared React Query data) starts a new history session.
  const controller = useMemo(() => createFolioHistoryController({ context: props.context, firstPage: props.firstPage,
    loadPage: (after, signal) => latest.current.loadPage(after, signal), isBlocked: () => latest.current.disabled,
  }), [props.context.propertyId, props.context.folioId, props.context.reservationId, props.firstPage, props.refreshKey]);
  useEffect(() => { controller.activate(); return () => controller.dispose(); }, [controller]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  return <FolioHistoryView key={`${props.context.propertyId}:${props.context.folioId}:${props.refreshKey}`}
    state={state} disabled={props.disabled} postingClass={props.postingClass} onPostingClassChange={props.onPostingClassChange}
    onLoadMore={() => { void controller.loadMore(); }} onRefresh={props.onRefresh} />;
}
