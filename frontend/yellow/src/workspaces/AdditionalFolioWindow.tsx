import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { VoiceInput } from "../ui/VoiceField";
import { BillingIcon } from "../ui/FolioActionRibbon";
import type { FolioStatement, ReservationDetail } from "../yellow-api";
import {
  createAdditionalFolioWindowController,
  type AdditionalFolioWindowController,
} from "./additional-folio-window";
import "./additional-folio-window.css";

export type AdditionalFolioWindowProps = Readonly<{
  propertyId: string;
  reservationId: string;
  sourceFolioId: string;
  sourceFolioReference: string | null;
  reservationLabel?: string;
  getToken: () => Promise<string>;
  loadReservation: (reservationId: string) => Promise<ReservationDetail>;
  loadFolioStatement: (reference: string) => Promise<FolioStatement>;
  acquireMutationLease: (attemptId: string) => boolean;
  releaseMutationLease: (attemptId: string) => void;
  onCreated: (reservation: ReservationDetail, statement: FolioStatement, folioId: string) => void;
  disabled?: boolean;
}>;

export function AdditionalFolioWindow(props: AdditionalFolioWindowProps) {
  const latest = useRef(props);
  latest.current = props;
  const controller = useMemo<AdditionalFolioWindowController>(() => createAdditionalFolioWindowController({
    propertyId: props.propertyId,
    reservationId: props.reservationId,
    sourceFolioId: props.sourceFolioId,
    sourceFolioReference: props.sourceFolioReference,
    getToken: () => latest.current.getToken(),
    loadReservation: id => latest.current.loadReservation(id),
    loadFolioStatement: reference => latest.current.loadFolioStatement(reference),
    acquireMutationLease: id => latest.current.acquireMutationLease(id),
    releaseMutationLease: id => latest.current.releaseMutationLease(id),
    onCreated: (reservation, statement, folioId) => latest.current.onCreated(reservation, statement, folioId),
  }), [props.propertyId, props.reservationId, props.sourceFolioId, props.sourceFolioReference]);
  useEffect(() => { controller.activate(); return () => controller.dispose(); }, [controller]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const ownsLease = state.status === "editing" || state.status === "review" || state.status === "posting" || state.status === "uncertain";
  const externallyDisabled = Boolean(props.disabled && !ownsLease);
  const busy = state.status === "posting";
  const locked = state.status === "uncertain";

  useEffect(() => {
    if (!ownsLease) return;
    const preventLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLeave);
    return () => window.removeEventListener("beforeunload", preventLeave);
  }, [ownsLease]);

  const sourceLabel = props.sourceFolioReference ?? "Selected bill window";
  const restartDraft = () => {
    const priorName = state.name;
    controller.cancel();
    if (controller.open()) controller.setName(priorName);
  };
  return <section className="additional-folio-window" aria-label="Create named bill window"
    data-lifecycle-recovery={ownsLease ? "true" : undefined}>
    {state.status === "closed" ? <button type="button" className="additional-folio-window-toggle"
      title="Add a named bill window" disabled={externallyDisabled} onClick={() => controller.open()}><BillingIcon kind="charge" /> Create named bill window</button> : null}
    {state.status === "editing" ? <div className="additional-folio-window-form">
      <p>Create an empty bill window before charges are routed. This does not create a charge or invoice.</p>
      <label>Window name
        <VoiceInput aria-label="Bill window name" name="windowName" value={state.name} maxLength={80}
          disabled={busy} required contextKey={`${props.propertyId}:${props.reservationId}:${props.sourceFolioId}`}
          onChange={event => controller.setName(event.currentTarget.value)} onVoiceValue={value => controller.setName(value)} />
      </label>
      {state.message ? <p className="additional-folio-window-error" role="alert">{state.message}</p> : null}
      <p className="additional-folio-window-source">Source bill window: <strong>{sourceLabel}</strong></p>
      <div className="additional-folio-window-actions">
        <button type="button" disabled={externallyDisabled || !state.name.trim()} onClick={() => controller.review()}>Review window</button>
        <button type="button" className="additional-folio-window-secondary" onClick={() => controller.cancel()}>Cancel</button>
      </div>
    </div> : null}
    {state.status === "review" && state.reviewedBody ? <div className="additional-folio-window-review">
      <h4>Review new bill window</h4>
      <dl><div><dt>Window name</dt><dd>{state.reviewedBody.name}</dd></div><div><dt>Source bill window</dt><dd>{sourceLabel}</dd></div><div><dt>Reservation</dt><dd>{props.reservationLabel ?? "Selected reservation"}</dd></div></dl>
      <p>An empty open bill window will be created within the existing guest account. No charge, payment or invoice is created.</p>
      <div className="additional-folio-window-actions">
        <button type="button" disabled={externallyDisabled || busy} onClick={() => { void controller.submit(); }}>Confirm and open window</button>
        <button type="button" className="additional-folio-window-secondary" title="Edit this unsubmitted window name" disabled={busy} onClick={() => controller.edit()}><BillingIcon kind="edit" /> Edit</button>
        <button type="button" className="additional-folio-window-secondary" disabled={busy} onClick={() => controller.cancel()}>Cancel</button>
      </div>
    </div> : null}
    {locked ? <div className="additional-folio-window-recovery" role="status">
      <strong>Reconciliation required</strong>
      <p>Yellow retained the exact source, name and operation key. Only this same-key request can continue; editing, cancel and other financial actions are locked.</p>
      <button type="button" disabled={busy} onClick={() => { void controller.submit(); }}>Reconcile retained request</button>
    </div> : null}
    {state.status === "posting" ? <p role="status" aria-live="polite">{state.message ?? "Opening the reviewed bill window…"}</p> : null}
    {state.status === "ready" ? <p className="additional-folio-window-success" role="status">{state.message}</p> : null}
    {state.status === "rejected" ? <div className="additional-folio-window-rejection">
      <p className="additional-folio-window-error" role="alert">{state.message}</p>
      <div className="additional-folio-window-actions">
        <button type="button" onClick={restartDraft}>Edit or retry with a new request</button>
        <button type="button" className="additional-folio-window-secondary" onClick={() => controller.cancel()}>Cancel</button>
      </div>
    </div> : null}
  </section>;
}
