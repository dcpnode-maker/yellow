import { useEffect, useId, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { FolioStatement } from "../yellow-api";
import { formatFolioMinor } from "../folio-statement-view";
import {
  initialFolioComparisonSelection,
  MAX_FOLIO_COMPARISON_PANES,
  reconcileFolioComparisonSelection,
  toggleFolioComparisonSelection,
  validateFolioComparisonStatement,
  type FolioWindowComparisonWindow,
} from "../folio-window-comparison";
import { FolioStatementTable } from "./FolioStatementTable";
import "./folio-window-comparison.css";

export type { FolioWindowComparisonWindow } from "../folio-window-comparison";

type Props = Readonly<{
  propertyId: string;
  reservationId: string;
  family: readonly FolioWindowComparisonWindow[];
  activeFolioId: string | null;
  financialNavigationLocked: boolean;
  onActivate: (folioId: string) => void;
  loadStatement: (folioId: string) => Promise<FolioStatement>;
  refreshToken: string;
}>;

export function FolioWindowComparison(props: Props) {
  return <FolioWindowComparisonSession key={`${props.propertyId}:${props.reservationId}`} {...props} />;
}

function FolioWindowComparisonSession({
  propertyId,
  reservationId,
  family,
  activeFolioId,
  financialNavigationLocked,
  onActivate,
  loadStatement,
  refreshToken,
}: Props) {
  const disclosureId = useId();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<readonly string[]>(() => initialFolioComparisonSelection(family, activeFolioId));
  const [refreshSequence, setRefreshSequence] = useState(0);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const familyKey = family.map((window) => `${window.folioId}:${window.windowNo}`).join("|");
  const orderedFamily = useMemo(() => [...family].sort((left, right) => left.windowNo - right.windowNo || left.folioId.localeCompare(right.folioId)), [family]);
  const selectedFamily = orderedFamily.filter((window) => selected.includes(window.folioId));

  useEffect(() => {
    setSelected((current) => reconcileFolioComparisonSelection(current, family, activeFolioId));
  }, [familyKey, activeFolioId]);

  const statements = useQueries({ queries: selectedFamily.map((window) => ({
    queryKey: ["folio-window-comparison", propertyId, reservationId, window.folioId, refreshToken, refreshSequence],
    queryFn: async () => validateFolioComparisonStatement(await loadStatement(window.folioId), reservationId, window),
    enabled: expanded,
    refetchOnWindowFocus: false,
  })) });

  const toggle = (folioId: string) => {
    const result = toggleFolioComparisonSelection(selected, folioId, family);
    if (result.reason === "pane_limit") {
      setSelectionMessage(`Compare up to ${MAX_FOLIO_COMPARISON_PANES} windows at once. All ${family.length} existing windows remain available above.`);
      return;
    }
    if (result.reason === "unknown_folio") {
      setSelectionMessage("That window is no longer part of this reservation. Refresh the reservation before comparing it.");
      return;
    }
    setSelectionMessage(null);
    setSelected(result.selected);
  };

  const activate = (folioId: string) => {
    if (financialNavigationLocked || !family.some((window) => window.folioId === folioId)) return;
    onActivate(folioId);
  };

  return <section className="folio-window-comparison" aria-label="Compare folio windows">
    <header className="folio-window-comparison-heading">
      <div><span className="folio-window-comparison-eyebrow">BILL WINDOWS</span><h2>Compare folio windows</h2>
        <p>{family.length} existing window{family.length === 1 ? "" : "s"} · up to {MAX_FOLIO_COMPARISON_PANES} statements side by side</p></div>
      <button type="button" className="folio-window-comparison-toggle" aria-expanded={expanded} aria-controls={disclosureId}
        onClick={() => setExpanded((value) => !value)}>{expanded ? "Hide comparison" : "Compare windows"}</button>
    </header>
    <div id={disclosureId} hidden={!expanded}>
      <fieldset className="folio-window-comparison-picker">
        <legend>Choose up to {MAX_FOLIO_COMPARISON_PANES} windows to compare</legend>
        <div className="folio-window-comparison-options">
          {orderedFamily.map((window) => {
            const checked = selected.includes(window.folioId);
            return <label key={`${window.folioId}:${window.windowNo}`}>
              <input type="checkbox" checked={checked} disabled={!checked && selected.length >= MAX_FOLIO_COMPARISON_PANES}
                onChange={() => toggle(window.folioId)} />
              <span><strong>Window {window.windowNo}</strong><small>{window.name ?? window.reference ?? window.folioId}</small><small>{window.status.replaceAll("_", " ")}</small></span>
            </label>;
          })}
        </div>
        <div className="folio-window-comparison-picker-footer"><span>{selected.length} selected · {family.length} available</span>
          <button type="button" onClick={() => setRefreshSequence((value) => value + 1)} disabled={selected.length === 0}>Refresh selected statements</button></div>
        <p className="folio-window-comparison-snapshot-note" role="note">Each window is read independently. Snapshots are not atomic; balances stay in their own currency and are never added together here.</p>
      </fieldset>
      {selectionMessage ? <p className="folio-window-comparison-limit" role="status">{selectionMessage}</p> : null}
      {selectedFamily.length === 0 ? <p className="folio-window-comparison-empty" role="status">Select at least one existing window to load its itemized statement.</p> : (
        <div className="folio-window-comparison-grid">
          {selectedFamily.map((window, index) => {
            const result = statements[index];
            const statement = result?.data;
            return <article className="folio-window-comparison-pane" key={window.folioId} data-active={window.folioId === activeFolioId}>
              <header>
                <div><span>Window {window.windowNo} · {window.status.replaceAll("_", " ")}</span>
                  <h3>{window.name ?? window.reference ?? `Folio window ${window.windowNo}`}</h3>
                  {statement ? <p>Balance <strong>{formatFolioMinor(statement.balanceMinor, statement.folio.currency)}</strong> · {statement.folio.currency}</p> : null}
                </div>
                <button type="button" disabled={financialNavigationLocked || window.folioId === activeFolioId}
                  onClick={() => activate(window.folioId)}>{window.folioId === activeFolioId ? "Active window" : "Use this window"}</button>
              </header>
              {result?.isLoading ? <p className="folio-window-comparison-loading" role="status">Loading this window’s statement…</p> : null}
              {result?.isError ? <div className="folio-window-comparison-error" role="alert"><p>{result.error.message}</p>
                <button type="button" onClick={() => void result.refetch()} disabled={result.isFetching}>Retry this window</button></div> : null}
              {result?.isFetching && statement ? <p className="folio-window-comparison-refreshing" role="status">Refreshing this statement snapshot…</p> : null}
              {statement ? <FolioStatementTable rows={statement.rows} currency={statement.folio.currency} /> : null}
              {!result?.isLoading && !result?.isError && !statement ? <p className="folio-window-comparison-empty" role="status">Open the comparison to load this statement.</p> : null}
            </article>;
          })}
        </div>
      )}
    </div>
  </section>;
}
