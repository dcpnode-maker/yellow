import { useEffect, useRef, useState } from "react";
import type { ReservationDetail } from "../yellow-api";
import { VoiceInput, VoiceTextarea } from "../ui/VoiceField";
import {
  admitReservationAlertCommand, createReservationAlertsClient, normalizeReservationAlertDraft,
  prepareCreateAlertAttemptFromBody, prepareDeactivateAlertAttempt, reservationAlertOutcomeUncertain, runReservationAlertAttempt,
  ReservationAlertRequestError, type ReservationAlert, type ReservationAlertAttempt,
  type CreateReservationAlertBody, type ReservationAlertDraft, type ReservationAlertShowOn,
} from "../reservation-alerts-client";
import "./reservation-alerts.css";

type Props = Readonly<{
  propertyId: string;
  reservationId: string;
  confirmationNo: string;
  alerts: ReservationDetail["reservation"]["alerts"];
  canManageAlerts: boolean;
  getToken: () => Promise<string>;
  otherMutationBusy: boolean;
  onLockChange: (locked: boolean) => void;
  onRefreshDetail: () => Promise<ReservationDetail>;
}>;
type Status = "idle" | "posting" | "uncertain" | "done";
const EMPTY_DRAFT: ReservationAlertDraft = Object.freeze({ code: "", message: "", showOn: "always" });

export function ReservationAlerts(props: Props) {
  const identity = `${props.propertyId}\u0000${props.reservationId}\u0000${props.confirmationNo}`;
  const callbacks = useRef(props);
  callbacks.current = props;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const generation = useRef(0);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const attempt = useRef<ReservationAlertAttempt | null>(null);
  const uncertain = useRef(false);
  const client = useRef<ReturnType<typeof createReservationAlertsClient> | null>(null);
  if (!client.current) client.current = createReservationAlertsClient(() => callbacks.current.getToken());

  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState<ReservationAlertDraft>(EMPTY_DRAFT);
  const [reviewedBody, setReviewedBody] = useState<CreateReservationAlertBody | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [createConfirmed, setCreateConfirmed] = useState(false);
  const [deactivateAlert, setDeactivateAlert] = useState<ReservationAlert | null>(null);
  const [deactivateConfirmed, setDeactivateConfirmed] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = status === "posting" || status === "uncertain";

  useEffect(() => {
    mounted.current = true;
    generation.current += 1;
    attempt.current = null;
    uncertain.current = false;
    inFlight.current = false;
    setOpened(false); setDraft(EMPTY_DRAFT); setReviewedBody(null); setReviewing(false); setCreateConfirmed(false);
    setDeactivateAlert(null); setDeactivateConfirmed(false); setStatus("idle"); setMessage(null); setError(null);
    callbacks.current.onLockChange(false);
    return () => {
      mounted.current = false;
      generation.current += 1;
      inFlight.current = false;
      callbacks.current.onLockChange(false);
    };
  }, [identity]);

  const capture = () => Object.freeze({ identity, generation: generation.current, getToken: callbacks.current.getToken });
  const isReservationCurrent = (expected: ReturnType<typeof capture>) => mounted.current && identityRef.current === expected.identity &&
    generation.current === expected.generation;
  const isCurrent = (expected: ReturnType<typeof capture>) => isReservationCurrent(expected) && callbacks.current.getToken === expected.getToken;

  const run = async (frozen: ReservationAlertAttempt, expected: ReturnType<typeof capture>) => {
    if (!admitReservationAlertCommand(inFlight, isCurrent(expected))) return;
    callbacks.current.onLockChange(true);
    setStatus("posting"); setError(null); setMessage(null);
    try {
      await runReservationAlertAttempt({
        client: client.current!, attempt: frozen,
        isCurrent: () => isCurrent(expected), refreshDetail: () => callbacks.current.onRefreshDetail(),
      });
      if (!isCurrent(expected)) return;
      attempt.current = null; uncertain.current = false;
      setStatus("done");
      setMessage(frozen.operation === "create"
        ? "Alert created. The refreshed reservation confirms it is recorded."
        : "Alert deactivated. The refreshed reservation confirms the change.");
      setOpened(false); setDraft(EMPTY_DRAFT); setReviewedBody(null); setReviewing(false); setCreateConfirmed(false); setDeactivateAlert(null); setDeactivateConfirmed(false);
      callbacks.current.onLockChange(false);
    } catch (cause) {
      if (!isReservationCurrent(expected)) return;
      if (!isCurrent(expected)) {
        uncertain.current = true;
        setStatus("uncertain");
        setError("Your session changed during the request. Keep this exact alert request and reconcile it with the current session.");
        callbacks.current.onLockChange(true);
        return;
      }
      const isAmbiguous = reservationAlertOutcomeUncertain(uncertain.current, cause);
      if (isAmbiguous) {
        uncertain.current = true;
        setStatus("uncertain");
        setError(cause instanceof ReservationAlertRequestError
          ? cause.message : "Yellow could not verify the alert result. Reconcile this exact request before continuing.");
        callbacks.current.onLockChange(true);
      } else {
        attempt.current = null;
        uncertain.current = false;
        setStatus("idle");
        setError(cause instanceof ReservationAlertRequestError
          ? cause.message : "The alert was not accepted. Review the fields and current reservation.");
        callbacks.current.onLockChange(false);
      }
    } finally {
      inFlight.current = false;
    }
  };

  const submitCreate = () => {
    if (inFlight.current || locked || props.otherMutationBusy || !props.canManageAlerts || !reviewing || !createConfirmed) return;
    let key: string;
    try { key = crypto.randomUUID(); }
    catch { setError("A secure request key could not be created. No alert request was sent."); return; }
    const prepared = reviewedBody && prepareCreateAlertAttemptFromBody({ propertyId: props.propertyId, reservationId: props.reservationId,
      confirmationNo: props.confirmationNo, body: reviewedBody, key });
    if (!prepared) { setError("Enter a valid note and optional code before saving."); return; }
    attempt.current = prepared;
    uncertain.current = false;
    void run(prepared, capture());
  };

  const beginDeactivate = (alert: ReservationAlert) => {
    if (inFlight.current || locked || props.otherMutationBusy || !props.canManageAlerts || !alert.active) return;
    setOpened(false); setDraft(EMPTY_DRAFT); setReviewedBody(null); setReviewing(false); setCreateConfirmed(false);
    setDeactivateAlert(Object.freeze({ ...alert })); setDeactivateConfirmed(false); setError(null); setMessage(null);
  };

  const submitDeactivate = (alert: ReservationAlert) => {
    if (inFlight.current || locked || props.otherMutationBusy || !props.canManageAlerts || !deactivateConfirmed || !alert.active) return;
    let key: string;
    try { key = crypto.randomUUID(); }
    catch { setError("A secure request key could not be created. No alert request was sent."); return; }
    const prepared = prepareDeactivateAlertAttempt({ propertyId: props.propertyId, reservationId: props.reservationId,
      confirmationNo: props.confirmationNo, alert, key });
    if (!prepared) { setError("The selected alert is no longer valid. Refresh this reservation before continuing."); return; }
    attempt.current = prepared;
    uncertain.current = false;
    setDeactivateAlert(null); setDeactivateConfirmed(false);
    void run(prepared, capture());
  };

  const reconcile = () => {
    if (status !== "uncertain" || inFlight.current || !attempt.current) return;
    // A previous ambiguous write makes every subsequent failure ambiguous too.
    uncertain.current = true;
    void run(attempt.current, capture());
  };

  const cancelDraft = () => {
    if (locked || props.otherMutationBusy) return;
    setOpened(false); setDraft(EMPTY_DRAFT); setReviewedBody(null); setReviewing(false); setCreateConfirmed(false);
    setDeactivateAlert(null); setDeactivateConfirmed(false); setError(null);
  };

  const reviewCreate = () => {
    if (locked || props.otherMutationBusy) return;
    const body = normalizeReservationAlertDraft(draft);
    if (!body) { setError("Enter a valid note and optional code before reviewing the alert."); return; }
    setReviewedBody(body); setReviewing(true); setCreateConfirmed(false); setError(null);
  };

  return <section className="reservation-alerts" aria-label="Reservation alerts"
    aria-busy={status === "posting"} data-lifecycle-recovery={locked ? "true" : undefined}>
    {props.alerts.length ? <ul className="reservation-alerts-list">{props.alerts.map((alert) => <li key={alert.alertId}>
      <div className="reservation-alert-copy"><strong>{alert.code ?? "Operational alert"} · {alert.active ? "active" : "inactive"}</strong>
        <span>{alert.message} · show on {alert.showOn}</span></div>
      {props.canManageAlerts && alert.active && status !== "uncertain" ? <button type="button" className="reservation-alerts-secondary"
        disabled={locked || props.otherMutationBusy} onClick={() => beginDeactivate(alert)}>Review deactivation</button> : null}
      {deactivateAlert?.alertId === alert.alertId && status !== "uncertain" ? <div className="reservation-alerts-review">
        <p>Deactivate this active alert for {props.confirmationNo}? This will not change reservation status, travel, occupancy or billing.</p>
        <label><input type="checkbox" checked={deactivateConfirmed} disabled={locked || props.otherMutationBusy}
          onChange={(event) => setDeactivateConfirmed(event.target.checked)} /> I confirm deactivating this alert.</label>
        <button type="button" disabled={!deactivateConfirmed || locked || props.otherMutationBusy}
          onClick={() => submitDeactivate(deactivateAlert)}>Confirm deactivation</button>
        <button type="button" className="reservation-alerts-secondary" disabled={locked || props.otherMutationBusy}
          onClick={() => { setDeactivateAlert(null); setDeactivateConfirmed(false); }}>Cancel</button>
      </div> : null}
    </li>)}</ul> : <p>No reservation alerts are recorded.</p>}

    {props.canManageAlerts && status !== "uncertain" ? <>
      {!opened ? <button type="button" className="reservation-alerts-toggle" disabled={locked || props.otherMutationBusy}
        onClick={() => { setOpened(true); setMessage(null); setError(null); }}>Create alert</button> : null}
      {opened ? <div className="reservation-alerts-editor">
        <div className="reservation-alerts-heading"><h3>Create reservation alert</h3>
          <button type="button" className="reservation-alerts-secondary" disabled={locked || props.otherMutationBusy}
            onClick={cancelDraft}>Cancel</button></div>
        <label>Staff note<VoiceTextarea aria-label="Staff note" contextKey={`${props.propertyId}:${props.reservationId}:alert-note`}
          maxLength={2000} rows={3} value={draft.message} disabled={locked || props.otherMutationBusy || reviewing}
          onVoiceValue={(message) => setDraft((current) => ({ ...current, message }))}
          onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))} /></label>
        <label>Code (optional)<VoiceInput aria-label="Alert code (optional)" contextKey={`${props.propertyId}:${props.reservationId}:alert-code`}
          maxLength={128} value={draft.code} disabled={locked || props.otherMutationBusy || reviewing}
          onVoiceValue={(code) => setDraft((current) => ({ ...current, code }))}
          onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} /></label>
        <label>Show this alert<select value={draft.showOn} disabled={locked || props.otherMutationBusy || reviewing}
          onChange={(event) => setDraft((current) => ({ ...current, showOn: event.target.value as ReservationAlertShowOn }))}>
          <option value="always">Always</option><option value="checkin">At check-in</option><option value="checkout">At check-out</option>
        </select></label>
        {!reviewing ? <button type="button" disabled={locked || props.otherMutationBusy}
          onClick={reviewCreate}>Review alert</button> : <div className="reservation-alerts-review">
          <h4>Review this alert</h4><p><strong>{reviewedBody?.code || "Operational alert"}</strong> · show on {reviewedBody?.showOn}</p>
          <p className="reservation-alerts-note-preview">{reviewedBody?.message || "Enter a staff note before confirming."}</p>
          <label><input type="checkbox" checked={createConfirmed} disabled={locked || props.otherMutationBusy}
            onChange={(event) => setCreateConfirmed(event.target.checked)} /> I confirm creating this operational alert for {props.confirmationNo}.</label>
          <button type="button" disabled={!createConfirmed || locked || props.otherMutationBusy} onClick={submitCreate}>Confirm and create alert</button>
          <button type="button" className="reservation-alerts-secondary" disabled={locked || props.otherMutationBusy}
            onClick={() => { setReviewing(false); setReviewedBody(null); setCreateConfirmed(false); }}>Edit alert</button>
        </div>}
      </div> : null}
    </> : null}

    {status === "uncertain" && attempt.current ? <div className="reservation-alerts-recovery" data-lifecycle-recovery="true">
      <p>The alert outcome is not confirmed. Its exact request and key are retained; other reservation actions remain locked.</p>
      <button type="button" disabled={inFlight.current} onClick={reconcile}>Reconcile exact alert request</button>
    </div> : null}
    {status === "posting" ? <p role="status">Saving alert and verifying the refreshed reservation…</p> : null}
    {message ? <p role="status" className="reservation-alerts-message">{message}</p> : null}
    {error ? <p role="alert" className="reservation-alerts-error">{error}</p> : null}
  </section>;
}
