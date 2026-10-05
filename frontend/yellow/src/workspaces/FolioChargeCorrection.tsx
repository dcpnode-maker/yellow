import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { VoiceInput } from "../ui/VoiceField";
import { formatFolioMinor } from "../folio-statement-view";
import {
  correctionReasonLabel, createFolioCorrectionController, normalizeCorrectionReason,
  type CorrectionState, type FolioCorrectionController, type FolioCorrectionOptions,
} from "./folio-charge-correction";
import "./folio-charge-correction.css";

type Props = FolioCorrectionOptions & Readonly<{ reservationLabel: string; folioLabel: string; disabled?: boolean }>;
type ViewProps = Readonly<{
  state: CorrectionState;
  actions: Pick<FolioCorrectionController, "load" | "select" | "setReason" | "review" | "edit" | "cancel" | "submit">;
  reservationLabel: string;
  folioLabel: string;
  contextKey: string;
  disabled?: boolean;
}>;

/** The controller owns commands; this view only renders explicit review and recovery. */
export function FolioChargeCorrectionView({ state, actions, reservationLabel, folioLabel, contextKey, disabled = false }: ViewProps) {
  const drafting = state.status === "editing" || state.status === "review";
  const locked = state.status === "uncertain" || state.status === "posting";
  const ownsLease = drafting || locked;
  const blocked = disabled && !ownsLease;
  const selected = state.selected;
  const currency = state.page?.folio.currency;
  return <section className="folio-correction" aria-label="Correct a posted charge"
    data-lifecycle-recovery={ownsLease ? "true" : undefined} aria-busy={state.status === "posting" || state.status === "loading"}>
    <p className="folio-correction-intro">Reverse one eligible charge in full. Its original posting stays in the bill history. This action does not refund a payment or issue a credit note.</p>
    {!ownsLease ? <div className="folio-correction-actions">
      <button type="button" disabled={blocked || state.status === "loading"} onClick={() => { void actions.load(); }}>
        {state.status === "loading" ? "Loading charges…" : state.page ? "Refresh charges" : "Load posted charges"}
      </button>
    </div> : null}
    {state.message ? <p className={state.status === "done" ? "folio-correction-success" : "folio-correction-notice"}
      role={state.status === "done" || locked ? "status" : "alert"}>{state.message}</p> : null}
    {!ownsLease && state.page ? <>
      <p className="folio-correction-count">Showing {state.rows.length} of {state.page.lineCount} postings · newest first</p>
      <div className="folio-correction-rows" aria-label="Posted charges and correction eligibility">
        {state.rows.map(row => <article key={row.lineId} className="folio-correction-row">
          <div><strong>{row.description ?? row.txCode}</strong><small>{row.businessDate} · {row.txCode} · {row.kind.replaceAll("_", " ")}</small>
            {row.reversedByJournalId ? <small>Correction recorded · {row.reversedByJournalId}</small> : null}
            {row.reversesJournalId ? <small>Reverses charge · {row.reversesJournalId}</small> : null}
            {!row.correctionEligible ? <small className="folio-correction-blocker">{correctionReasonLabel(row.correctionReason)}</small> : null}
          </div>
          <strong className="folio-correction-amount">{formatFolioMinor(row.amountMinor, state.page!.folio.currency)}</strong>
          <button type="button" disabled={blocked || state.status === "loading" || !row.correctionEligible}
            aria-label={`Review correction: ${row.description ?? row.txCode}, ${formatFolioMinor(row.amountMinor, state.page!.folio.currency)}, ${row.businessDate}`}
            onClick={() => actions.select(row.lineId)}>Review correction</button>
        </article>)}
        {state.rows.length === 0 ? <p>No postings are recorded in this bill window.</p> : null}
      </div>
      {state.nextCursor ? <button type="button" className="folio-correction-more" disabled={blocked || state.status === "loading"}
        onClick={() => { void actions.load(true); }}>Load older postings</button> : null}
    </> : null}
    {ownsLease && selected && currency ? <div className="folio-correction-review">
      <h4>{state.status === "editing" ? "Prepare correction" : "Review charge reversal"}</h4>
      <dl>
        <div><dt>Guest / reservation</dt><dd>{reservationLabel}</dd></div>
        <div><dt>Bill window</dt><dd>{folioLabel}</dd></div>
        <div><dt>Original charge</dt><dd>{selected.description ?? selected.txCode} · {selected.txCode}</dd></div>
        <div><dt>Posted business date</dt><dd>{selected.businessDate}</dd></div>
        <div><dt>Original amount</dt><dd>{formatFolioMinor(selected.amountMinor, currency)}</dd></div>
        <div><dt>Full reversal</dt><dd>{formatFolioMinor((-BigInt(selected.amountMinor)).toString(), currency)}</dd></div>
      </dl>
      {state.status === "editing" ? <>
        <label>Reason for correction<VoiceInput aria-label="Reason for charge correction" contextKey={contextKey}
          value={state.reason} maxLength={500} required onVoiceValue={actions.setReason}
          onChange={event => actions.setReason(event.currentTarget.value)} /></label>
        <div className="folio-correction-actions">
          <button type="button" disabled={!normalizeCorrectionReason(state.reason)} onClick={() => actions.review()}>Review reversal</button>
          <button type="button" className="secondary" onClick={actions.cancel}>Cancel</button>
        </div>
      </> : <><p className="folio-correction-reason"><strong>Reason:</strong> {state.reason}</p>
        <p>The server will check the charge and your access again. A new equal and opposite posting will be recorded, with the original preserved.</p>
      </>}
      {state.status === "review" ? <div className="folio-correction-actions">
        <button type="button" onClick={() => { void actions.submit(); }}>Confirm full reversal</button>
        <button type="button" className="secondary" onClick={actions.edit}>Edit reason</button>
        <button type="button" className="secondary" onClick={actions.cancel}>Cancel</button>
      </div> : null}
      {state.status === "uncertain" ? <div className="folio-correction-recovery">
        <strong>Reconciliation required</strong>
        <p>Keep this exact correction until its result is confirmed. Editing, cancellation and other billing actions are locked.</p>
        <button type="button" onClick={() => { void actions.submit(); }}>Reconcile same correction</button>
      </div> : null}
    </div> : null}
  </section>;
}

export function FolioChargeCorrection(props: Props) {
  const latest = useRef(props); latest.current = props;
  const controller = useMemo(() => createFolioCorrectionController({
    propertyId: props.propertyId, reservationId: props.reservationId, folioId: props.folioId,
    getToken: () => latest.current.getToken(),
    acquireMutationLease: owner => latest.current.acquireMutationLease(owner),
    releaseMutationLease: owner => latest.current.releaseMutationLease(owner),
    onReconciled: (page, receipt) => latest.current.onReconciled(page, receipt),
    ...(props.fetcher ? { fetcher: props.fetcher } : {}),
    ...(props.keyFactory ? { keyFactory: props.keyFactory } : {}),
  }), [props.propertyId, props.reservationId, props.folioId]);
  useEffect(() => { controller.activate(); return () => controller.dispose(); }, [controller]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const ownsLease = ["editing", "review", "posting", "uncertain"].includes(state.status);
  useEffect(() => {
    if (!ownsLease) return;
    const preventLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLeave);
    return () => window.removeEventListener("beforeunload", preventLeave);
  }, [ownsLease]);
  return <FolioChargeCorrectionView state={state} actions={controller} reservationLabel={props.reservationLabel}
    folioLabel={props.folioLabel} contextKey={`${props.propertyId}:${props.reservationId}:${props.folioId}`} disabled={props.disabled} />;
}
