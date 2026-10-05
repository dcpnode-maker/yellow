import { useEffect, useRef, useState } from "react";
import {
  changeReservationDeparture, loadReservationSegments, ReservationDepartureRequestError,
  type ReservationDetail, type ReservationSegmentLookup,
} from "../yellow-api";
import {
  departureMatchesAttempt, prepareDepartureAttempt, propertyLocalMinute, sameRecordedInstant,
  type DepartureAttempt,
} from "../reservation-departure-change";

type Props = Readonly<{
  reservationId: string;
  confirmationNo: string;
  timezone: string;
  otherMutationBusy: boolean;
  onLockChange: (locked: boolean) => void;
  onRefreshDetail: () => Promise<ReservationDetail>;
}>;

export function ReservationDepartureChange({
  reservationId, confirmationNo, timezone, otherMutationBusy, onLockChange, onRefreshDetail,
}: Props) {
  const [lookup, setLookup] = useState<ReservationSegmentLookup | null>(null);
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [localValue, setLocalValue] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unresolved, setUnresolved] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const attempt = useRef<DepartureAttempt | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => () => { generation.current += 1; onLockChange(false); }, []);

  const fetchExact = async (): Promise<ReservationSegmentLookup> => {
    const value = await loadReservationSegments(confirmationNo);
    if (value.reservationId !== reservationId || value.confirmationNo !== confirmationNo) {
      throw new Error("Stay segment history no longer matches this reservation.");
    }
    return value;
  };

  const open = async () => {
    if (otherMutationBusy || loading || posting || unresolved) return;
    const current = ++generation.current;
    setOpened(true);
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const value = await fetchExact();
      if (current !== generation.current) return;
      setLookup(value);
      const latest = value.segments.at(-1);
      setLocalValue(latest ? propertyLocalMinute(latest.period.to, timezone) : "");
      setConfirmed(false);
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : "Stay segments could not be loaded.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };

  const finishSuccess = (value: ReservationSegmentLookup) => {
    setLookup(value);
    setLocalValue(propertyLocalMinute(value.segments.at(-1)!.period.to, timezone));
    setConfirmed(false);
    setUnresolved(false);
    setNeedsRefresh(false);
    setError(null);
    setMessage("Departure changed. The refreshed reservation and segment history agree.");
    attempt.current = null;
    onLockChange(false);
  };

  const reconcile = async (current: number): Promise<"applied" | "unchanged" | "changed" | "stale"> => {
    const pending = attempt.current;
    if (!pending) throw new Error("No departure request is pending.");
    const [segments, detail] = await Promise.all([fetchExact(), onRefreshDetail()]);
    if (current !== generation.current) return "stale";
    if (detail.reservation.reservationId !== reservationId || detail.reservation.confirmationNo !== confirmationNo) {
      throw new Error("The refreshed reservation no longer matches this stay.");
    }
    const latest = segments.segments.at(-1);
    const detailLatest = detail.reservation.segments.at(-1);
    if (departureMatchesAttempt(segments, pending) && detailLatest?.segmentId === pending.segmentId &&
        sameRecordedInstant(detailLatest.from, pending.expectedPeriod.from) &&
        sameRecordedInstant(detailLatest.to, pending.newDeparture)) {
      finishSuccess(segments);
      return "applied";
    }
    if (latest?.segmentId === pending.segmentId && detailLatest?.segmentId === pending.segmentId &&
        sameRecordedInstant(latest.period.from, pending.expectedPeriod.from) &&
        sameRecordedInstant(latest.period.to, pending.expectedPeriod.to) &&
        sameRecordedInstant(detailLatest.from, pending.expectedPeriod.from) &&
        sameRecordedInstant(detailLatest.to, pending.expectedPeriod.to)) {
      setLookup(segments);
      return "unchanged";
    }
    attempt.current = null;
    setLookup(segments);
    setUnresolved(false);
    setConfirmed(false);
    onLockChange(false);
    setError("The stay changed while this departure was pending. Review the current dates before a new request.");
    return "changed";
  };

  const submit = async () => {
    if (inFlight.current || otherMutationBusy || needsRefresh || (!lookup && !attempt.current) || (!confirmed && !attempt.current)) return;
    const current = generation.current;
    let pending = attempt.current;
    if (!pending) {
      try {
        pending = prepareDepartureAttempt(lookup!, reservationId, confirmationNo, localValue, timezone, crypto.randomUUID());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Choose a valid departure.");
        return;
      }
      attempt.current = pending;
    }
    inFlight.current = true;
    onLockChange(true);
    setPosting(true);
    setError(null);
    setMessage(null);
    try {
      await changeReservationDeparture(pending.reservationId, pending.segmentId, {
        expectedPeriod: pending.expectedPeriod, newDeparture: pending.newDeparture,
      }, pending.key);
      if (current !== generation.current) return;
      const result = await reconcile(current);
      if (result === "stale") return;
      if (result === "unchanged") throw new ReservationDepartureRequestError("The command returned, but the refreshed stay has not confirmed the new departure. Recheck or retry this exact request.", true);
    } catch (cause) {
      if (current !== generation.current) return;
      if (cause instanceof ReservationDepartureRequestError && !cause.uncertain) {
        attempt.current = null;
        setUnresolved(false);
        setNeedsRefresh(true);
        onLockChange(false);
        setConfirmed(false);
        setError(`${cause.message} Refresh the stay before trying again.`);
      } else {
        setUnresolved(true);
        setError(cause instanceof Error ? cause.message : "The result is uncertain. Recheck or retry this exact request.");
      }
    } finally {
      inFlight.current = false;
      if (current === generation.current) setPosting(false);
    }
  };

  const recheck = async () => {
    if (inFlight.current || otherMutationBusy || !attempt.current) return;
    const current = generation.current;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await reconcile(current);
      if (result === "stale") return;
      if (result === "unchanged") setMessage("The original departure is still recorded. You may retry the exact pending request.");
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : "Current stay truth could not be checked.");
    } finally {
      inFlight.current = false;
      if (current === generation.current) setLoading(false);
    }
  };

  const refreshAfterConflict = async () => {
    if (inFlight.current || otherMutationBusy || unresolved) return;
    const current = generation.current;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const [segments, detail] = await Promise.all([fetchExact(), onRefreshDetail()]);
      if (current !== generation.current) return;
      if (detail.reservation.reservationId !== reservationId || detail.reservation.confirmationNo !== confirmationNo) {
        throw new Error("The refreshed reservation no longer matches this stay.");
      }
      setLookup(segments);
      setLocalValue(propertyLocalMinute(segments.segments.at(-1)!.period.to, timezone));
      setConfirmed(false);
      setNeedsRefresh(false);
      setMessage("Current stay and segment history refreshed. Review the departure again.");
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : "Current stay truth could not be checked.");
    } finally {
      inFlight.current = false;
      if (current === generation.current) setLoading(false);
    }
  };

  const latest = lookup?.segments.at(-1);
  const eligible = latest?.actions.canChangeDeparture === true;
  return <section className="reservation-departure-change" aria-label="Change departure" data-lifecycle-recovery={posting || unresolved ? "true" : undefined}>
    {!opened ? <button type="button" className="quiet" disabled={otherMutationBusy} onClick={() => void open()}>Change departure</button> : null}
    {opened ? <div className="reservation-departure-change-panel">
      <div className="reservation-departure-change-heading"><h3>Change departure</h3><button type="button" className="quiet" disabled={posting || loading || unresolved} onClick={() => { generation.current += 1; setOpened(false); setLookup(null); setError(null); }}>Close</button></div>
      {loading && !lookup ? <p role="status">Loading current stay segments…</p> : null}
      {lookup && latest ? <>
        <p>Confirmation {confirmationNo} · Segment {latest.sequence} · {latest.status.replaceAll("_", " ")}</p>
        <p>Current departure: <strong>{new Date(latest.period.to).toLocaleString(undefined, { timeZone: timezone, dateStyle: "medium", timeStyle: "short" })}</strong> ({timezone})</p>
        {eligible ? <>
          <label>New departure at this property
            <input type="datetime-local" value={localValue} disabled={posting || loading || unresolved || otherMutationBusy} onChange={(event) => { setLocalValue(event.target.value); setConfirmed(false); setError(null); }} />
          </label>
          <p>Proposed departure: {localValue || "Choose a date and time"} ({timezone}). Yellow rechecks capacity and changes the stay dates and occupancy. This action does not reprice or post charges.</p>
          <label className="confirmation"><input type="checkbox" checked={confirmed} disabled={posting || loading || unresolved || otherMutationBusy || !localValue} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm this departure change for {confirmationNo}.</label>
          {!unresolved ? <button type="button" className="primary" disabled={!confirmed || posting || loading || otherMutationBusy || needsRefresh || !localValue} onClick={() => void submit()}>{posting ? "Changing departure…" : "Confirm departure change"}</button> : null}
        </> : <p role="status">Departure changes are unavailable for this stay’s current state.</p>}
      </> : null}
      {unresolved ? <div className="reservation-departure-recovery"><p>The result is uncertain. The proposed time and request key are frozen until current stay truth resolves it.</p><button type="button" className="quiet" disabled={loading || posting} onClick={() => void recheck()}>Recheck current stay</button><button type="button" className="primary" disabled={loading || posting || otherMutationBusy} onClick={() => void submit()}>Retry exact request</button></div> : null}
      {needsRefresh ? <button type="button" className="quiet" disabled={loading || posting || otherMutationBusy} onClick={() => void refreshAfterConflict()}>Refresh current stay</button> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {message ? <p className="success" role="status">{message}</p> : null}
    </div> : null}
  </section>;
}
