import { VoiceInput } from "../ui/VoiceField";
import { useCallback, useEffect, useRef, useState } from "react";
import { searchPartyProfiles, type ReservationDetail, type PartyProfile } from "../yellow-api";
import { ArrivalPickupRequestError, loadArrivalPickupTask, putArrivalTravel, transitionArrivalPickupTask } from "../arrival-pickup-api";
import { arrivalDraftToTuple, arrivalLocalMinute, attemptApplied, clearArrivalAttempt, prepareTaskAttempt, prepareTravelAttempt, readArrivalAttempt, travelTupleMatches, tupleFromTravel, writeArrivalAttempt, type ArrivalAttempt, type ArrivalTravel, type PickupTask, type TravelMode } from "../arrival-pickup";
import "./arrival-pickup.css";

type Props = Readonly<{
  propertyId: string; reservationId: string; confirmationNo: string; status: string; timezone: string;
  travel: ArrivalTravel | null; otherMutationBusy: boolean;
  onLockChange: (locked: boolean) => void; onRefreshDetail: () => Promise<ReservationDetail>;
}>;
const initialDraft = (travel: ArrivalTravel | null, timezone: string) => ({
  mode: (travel?.mode ?? "") as TravelMode | "", carrier: travel?.carrier ?? "", serviceNo: travel?.serviceNo ?? "",
  localTime: arrivalLocalMinute(travel, timezone), pickupRequested: travel?.pickupRequested ?? false,
});
const arrivalOf = (detail: ReservationDetail): ArrivalTravel | null => detail.reservation.travel.find((item) => item.direction === "arrival") ?? null;

export function ArrivalPickupWorkspace({propertyId, reservationId, confirmationNo, status, timezone, travel, otherMutationBusy, onLockChange, onRefreshDetail}: Props) {
  const [draft, setDraft] = useState(() => initialDraft(travel, timezone));
  const [task, setTask] = useState<PickupTask | null>(null);
  const [staffQuery, setStaffQuery] = useState("");
  const [staff, setStaff] = useState<readonly PartyProfile[]>([]);
  const [staffId, setStaffId] = useState("");
  const [travelConfirmed, setTravelConfirmed] = useState(false);
  const [taskConfirmed, setTaskConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ArrivalAttempt | null>(() => readArrivalAttempt(propertyId, reservationId));
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const generation = useRef(0);
  const taskReadGeneration = useRef(0);
  const flight = useRef(false);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const locked = busy || pending !== null;
  useEffect(() => { onLockChange(locked); }, [locked, onLockChange]);
  useEffect(() => () => { generation.current += 1; onLockChange(false); }, [onLockChange]);
  useEffect(() => {
    if (!locked) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [locked]);
  useEffect(() => {
    if (pendingRef.current) return;
    setDraft(initialDraft(travel, timezone));
    setTravelConfirmed(false);
  }, [travel, timezone]);
  useEffect(() => { setTaskConfirmed(false); }, [task?.taskId, task?.status, task?.assigneePartyId]);
  const refresh = useCallback(async () => {
    const current = generation.current;
    const taskRead = ++taskReadGeneration.current;
    const detail = await onRefreshDetail();
    if (current !== generation.current || taskRead !== taskReadGeneration.current) return null;
    if (detail.reservation.reservationId !== reservationId || detail.reservation.confirmationNo !== confirmationNo) throw new Error("Refreshed reservation identity changed.");
    const latestTravel = arrivalOf(detail);
    const latestTask = latestTravel?.pickupTaskId ? await loadArrivalPickupTask(propertyId, reservationId, latestTravel.pickupTaskId) : null;
    if (current !== generation.current || taskRead !== taskReadGeneration.current) return null;
    if (latestTask && latestTask.confirmationNo !== confirmationNo) throw new Error("Linked task confirmation does not match this reservation.");
    setTask(latestTask);
    return {travel: latestTravel, task: latestTask};
  }, [confirmationNo, onRefreshDetail, propertyId, reservationId]);
  useEffect(() => {
    let cancelled = false;
    // A command/recheck refresh owns the exact task read. A newly linked task
    // from that same detail refresh must not invalidate its reconciliation.
    if (flight.current) return;
    const taskRead = ++taskReadGeneration.current;
    if (!travel?.pickupTaskId) { setTask(null); return; }
    void loadArrivalPickupTask(propertyId, reservationId, travel.pickupTaskId).then(value => {
      if (cancelled || taskRead !== taskReadGeneration.current) return;
      if (value.confirmationNo !== confirmationNo) throw new Error("Linked task confirmation does not match this reservation.");
      setTask(value);
    }).catch(cause => { if (!cancelled && taskRead === taskReadGeneration.current) setError(cause instanceof Error ? cause.message : "Linked pickup task is unavailable."); });
    return () => { cancelled = true; };
  }, [confirmationNo, propertyId, reservationId, travel?.pickupTaskId]);

  const reconcile = async (attempt: ArrivalAttempt): Promise<boolean> => {
    const truth = await refresh();
    if (!truth) return false;
    if (attemptApplied(attempt, truth.travel, truth.task)) {
      clearArrivalAttempt(attempt); pendingRef.current = null; setPending(null);
      setNeedsRefresh(false); setError(null);
      setDraft(initialDraft(truth.travel, timezone));
      setTravelConfirmed(false); setTaskConfirmed(false);
      setMessage(attempt.kind === "travel" ? "Arrival travel confirmed from the refreshed reservation." : "Pickup task action confirmed from the linked task.");
      return true;
    }
    if (attempt.kind === "travel") {
      const expected = attempt.body.expected as ReturnType<typeof tupleFromTravel>;
      if (!travelTupleMatches(tupleFromTravel(truth.travel), expected)) {
        setError("Arrival travel differs from both the expected and proposed values. The earlier request may have applied and then changed; its exact key remains frozen. Escalate if recheck and exact retry cannot resolve it.");
        return false;
      }
    } else if (!truth.task || truth.task.taskId !== attempt.taskId || truth.task.status !== attempt.body.expectedTaskStatus || truth.task.assigneePartyId !== attempt.body.expectedAssigneePartyId) {
      setError("The linked pickup task differs from both the expected and target states. The earlier request may have applied and then advanced; its exact key remains frozen. Escalate if recheck and exact retry cannot resolve it.");
      return false;
    }
    setError("The change is not yet confirmed. Recheck or retry the exact same request.");
    return false;
  };
  const run = async (attempt: ArrivalAttempt, retry = false) => {
    if (flight.current || otherMutationBusy || attempt.confirmationNo !== confirmationNo) return;
    const current = generation.current;
    flight.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      if (attempt.kind === "travel") await putArrivalTravel(attempt); else await transitionArrivalPickupTask(attempt);
      if (current !== generation.current) return;
      await reconcile(attempt);
    } catch (cause) {
      if (current !== generation.current) return;
      if (cause instanceof ArrivalPickupRequestError && !cause.uncertain && !retry) {
        clearArrivalAttempt(attempt); pendingRef.current = null; setPending(null); setNeedsRefresh(true);
        setTravelConfirmed(false); setTaskConfirmed(false);
        setError(`${cause.message} Refresh current reservation and task truth before trying again.`);
      } else setError(`${cause instanceof Error ? cause.message : "The result is unknown."} The earlier outcome remains uncertain; recheck or retry this exact request.`);
    } finally { flight.current = false; if (current === generation.current) setBusy(false); }
  };
  const submitTravel = () => {
    if (locked || otherMutationBusy || needsRefresh || travel?.pickupTaskId || !travelConfirmed) return;
    try {
      const attempt = prepareTravelAttempt(propertyId, reservationId, confirmationNo, travel, arrivalDraftToTuple(draft, timezone), crypto.randomUUID());
      writeArrivalAttempt(attempt); pendingRef.current = attempt; onLockChange(true); setPending(attempt); void run(attempt);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Travel details are invalid."); }
  };
  const submitTask = () => {
    if (locked || otherMutationBusy || needsRefresh || !taskConfirmed || !task || task.taskId !== travel?.pickupTaskId) return;
    try {
      const attempt = prepareTaskAttempt(propertyId, reservationId, confirmationNo, task, staffId || null, crypto.randomUUID());
      writeArrivalAttempt(attempt); pendingRef.current = attempt; onLockChange(true); setPending(attempt); void run(attempt);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Task action is unavailable."); }
  };
  const recheck = async () => {
    if (flight.current) return;
    flight.current = true; setBusy(true); setError(null);
    try {
      const attempt = pendingRef.current;
      if (attempt) await reconcile(attempt);
      else { const truth = await refresh(); if (truth) { setDraft(initialDraft(truth.travel, timezone)); setTravelConfirmed(false); setTaskConfirmed(false); setNeedsRefresh(false); setMessage("Current reservation and linked task refreshed."); } }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Current truth could not be loaded."); }
    finally { flight.current = false; setBusy(false); }
  };
  const searchStaff = async () => {
    if (searching || staffQuery.trim().length < 2) return;
    const current = generation.current; setSearching(true); setError(null);
    try { const result = await searchPartyProfiles(staffQuery.trim()); if (current === generation.current) setStaff(result.filter(profile => profile.status === "active" && profile.roles.includes("staff"))); }
    catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : "Staff search is unavailable."); }
    finally { if (current === generation.current) setSearching(false); }
  };
  const editable = ["reserved", "due_in", "in_house", "due_out"].includes(status) && !travel?.pickupTaskId;
  return <section className="arrival-pickup" aria-label="Arrival travel and pickup" data-lifecycle-recovery={locked ? "true" : undefined}>
    <h3>Arrival travel & pickup</h3>
    <p>Property time zone: {timezone}. Pickup intent creates a linked staff task asynchronously; no transport booking, vehicle or charge is promised.</p>
    {editable ? <div className="arrival-pickup-fields">
      <label>Arrival mode<select value={draft.mode} disabled={locked || otherMutationBusy || needsRefresh} onChange={event => {setDraft({...draft, mode: event.target.value as TravelMode | ""});setTravelConfirmed(false);}}><option value="">Not recorded</option>{["flight","train","bus","car","ferry","other"].map(mode => <option key={mode} value={mode}>{mode}</option>)}</select></label>
      <label>Carrier<VoiceInput aria-label="Carrier" contextKey={`${propertyId}:${reservationId}`} onVoiceValue={voiceValue => {setDraft({...draft, carrier:voiceValue});setTravelConfirmed(false);}} maxLength={120} value={draft.carrier} disabled={locked || otherMutationBusy || needsRefresh} onChange={event => {setDraft({...draft, carrier:event.target.value});setTravelConfirmed(false);}} /></label>
      <label>Service number<VoiceInput aria-label="Service number" contextKey={`${propertyId}:${reservationId}`} onVoiceValue={voiceValue => {setDraft({...draft, serviceNo:voiceValue});setTravelConfirmed(false);}} maxLength={64} value={draft.serviceNo} disabled={locked || otherMutationBusy || needsRefresh} onChange={event => {setDraft({...draft, serviceNo:event.target.value});setTravelConfirmed(false);}} /></label>
      <label>Scheduled arrival · {timezone}<input type="datetime-local" value={draft.localTime} disabled={locked || otherMutationBusy || needsRefresh} onChange={event => {setDraft({...draft, localTime:event.target.value});setTravelConfirmed(false);}} /></label>
      <label className="arrival-pickup-check"><input type="checkbox" checked={draft.pickupRequested} disabled={locked || otherMutationBusy || needsRefresh} onChange={event => {setDraft({...draft, pickupRequested:event.target.checked});setTravelConfirmed(false);}} /> Request arrival pickup task</label>
      <label className="arrival-pickup-check"><input type="checkbox" checked={travelConfirmed} disabled={locked || otherMutationBusy || needsRefresh} onChange={event => setTravelConfirmed(event.target.checked)} /> I confirm arrival travel and pickup intent for {confirmationNo}</label>
      <button type="button" className="primary" disabled={locked || otherMutationBusy || needsRefresh || !travelConfirmed} onClick={submitTravel}>Save arrival travel</button>
    </div> : null}
    {travel?.pickupRequested && !travel.scheduledAt ? <p role="status">Pickup requested · schedule required. Record an arrival time before the background worker can link a staff task.</p> : null}
    {travel?.pickupRequested && travel.scheduledAt && !travel.pickupTaskId ? <p role="status">Pickup requested. The background worker has not linked a task yet. Refresh to check; staff assignment is unavailable until a task is linked.</p> : null}
    {travel?.pickupTaskId ? <div className="arrival-pickup-task">
      <p>Linked pickup task {travel.pickupTaskId}{task ? ` · ${task.status.replaceAll("_", " ")}` : " · loading"}</p>
      {task?.eligibleAction === "assign" ? <div className="arrival-pickup-staff"><label>Find existing staff<VoiceInput aria-label="Find pickup staff" contextKey={`${propertyId}:${reservationId}`} onVoiceValue={voiceValue => {setStaffQuery(voiceValue); setStaff([]); setStaffId("");setTaskConfirmed(false);}} value={staffQuery} disabled={locked || otherMutationBusy} onChange={event => {setStaffQuery(event.target.value); setStaff([]); setStaffId("");setTaskConfirmed(false);}} /></label><button type="button" disabled={locked || searching || staffQuery.trim().length < 2} onClick={() => void searchStaff()}>{searching ? "Searching…" : "Search staff"}</button><label>Assign to<select value={staffId} disabled={locked || otherMutationBusy} onChange={event => {setStaffId(event.target.value);setTaskConfirmed(false);}}><option value="">Choose active staff</option>{staff.map(profile => <option key={profile.partyId} value={profile.partyId}>{profile.displayName}</option>)}</select></label></div> : null}
      {task?.assigneePartyId ? <p>Assigned staff ID: {task.assigneePartyId}</p> : null}
      {task?.eligibleAction ? <><label className="arrival-pickup-check"><input type="checkbox" checked={taskConfirmed} disabled={locked || otherMutationBusy || needsRefresh} onChange={event => setTaskConfirmed(event.target.checked)} /> I confirm {task.eligibleAction} for linked task {task.taskId}</label><button type="button" className="primary" disabled={locked || otherMutationBusy || needsRefresh || !taskConfirmed || (task.eligibleAction === "assign" && !staffId)} onClick={submitTask}>{task.eligibleAction === "assign" ? "Assign pickup task" : task.eligibleAction === "start" ? "Start pickup task" : "Complete pickup task"}</button></> : null}
      {task && !task.eligibleAction ? <p role="status">No further pickup task action is currently available.</p> : null}
    </div> : null}
    {pending ? <div className="arrival-pickup-recovery" role="status"><p>{pending.confirmationNo !== confirmationNo ? "The retained attempt names a different confirmation. Keep this reservation locked and escalate; do not issue another write." : busy ? "Sending or checking the exact pending request…" : "Result uncertain. The request body and key are frozen until current truth confirms it."}</p><button type="button" disabled={busy || pending.confirmationNo !== confirmationNo} onClick={() => void recheck()}>Recheck current truth</button><button type="button" className="primary" disabled={busy || otherMutationBusy || pending.confirmationNo !== confirmationNo} onClick={() => void run(pending, true)}>Retry exact request</button></div> : null}
    {!pending ? <button type="button" className="quiet" disabled={busy || otherMutationBusy} onClick={() => void recheck()}>{needsRefresh ? "Refresh after rejection or conflict" : "Refresh pickup status"}</button> : null}
    {error ? <p className="error" role="alert">{error}</p> : null}
    {message ? <p className="success" role="status">{message}</p> : null}
  </section>;
}
