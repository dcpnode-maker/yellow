import { useEffect, useRef, useState } from "react";
import {
  createHousekeepingDiscrepancyClient,
  acquireHousekeepingDiscrepancyFlight,
  HousekeepingDiscrepancyRequestError,
  runHousekeepingDiscrepancyAttempt,
  type HousekeepingDiscrepancy,
  type HousekeepingDiscrepancyAttempt,
  type HousekeepingDiscrepancyClient,
  type HousekeepingDiscrepancyRoom,
} from "./housekeeping-discrepancy-client";
import "./housekeeping-discrepancy.css";

type Props = Readonly<{
  propertyId: string;
  getToken: () => Promise<string>;
  rooms: readonly HousekeepingDiscrepancyRoom[];
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onRefresh: () => Promise<void>;
}>;

export function HousekeepingDiscrepancyWorkbench({
  propertyId, getToken, rooms, disabled = false, onBusyChange, onRefresh,
}: Props) {
  const [rows, setRows] = useState<readonly HousekeepingDiscrepancy[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [presence, setPresence] = useState<"occupied" | "vacant" | "">("");
  const [persons, setPersons] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listLoaded, setListLoaded] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const attempt = useRef<HousekeepingDiscrepancyAttempt | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const callbacks = useRef({ onBusyChange, onRefresh, getToken });
  callbacks.current = { onBusyChange, onRefresh, getToken };
  const client = useRef<HousekeepingDiscrepancyClient | null>(null);
  if (!client.current) client.current = createHousekeepingDiscrepancyClient(() => callbacks.current.getToken());

  useEffect(() => {
    const current = ++generation.current;
    let active = true;
    setRows([]);
    setListLoaded(false);
    setError(null);
    setMessage(null);
    setSelectedRoom("");
    setPresence("");
    setPersons("");
    setConfirmed(false);
    attempt.current = null;
    setUncertain(false);
    setLoading(true);
    void client.current!.list(propertyId).then((value) => {
      if (active && current === generation.current) { setRows(value); setListLoaded(true); }
    }).catch((cause: unknown) => {
      if (active && current === generation.current) setError(cause instanceof Error ? cause.message : "Open discrepancies could not be loaded.");
    }).finally(() => {
      if (active && current === generation.current) setLoading(false);
    });
    return () => {
      active = false;
      generation.current += 1;
      callbacks.current.onBusyChange?.(false);
    };
  }, [propertyId]);

  const read = async () => {
    const current = generation.current;
    setLoading(true);
    setError(null);
    try {
      const value = await client.current!.list(propertyId);
      if (current === generation.current) { setRows(value); setListLoaded(true); }
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : "Open discrepancies could not be loaded.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };

  const submit = async (retry = false) => {
    if ((disabled && !uncertain) || loading || posting || (uncertain && !retry)) return;
    if (!retry && !listLoaded) { setError("Refresh the unresolved discrepancy list before reporting so the result can be verified."); return; }
    if (!retry && !confirmed) { setError("Confirm the physical observation before reporting it."); return; }
    let pending = attempt.current;
    if (!pending) {
      const room = rooms.find((item) => item.spaceId === selectedRoom);
      const count = Number(persons);
      if (!room) { setError("Choose an exact room from the currently loaded room list."); return; }
      if (presence !== "occupied" && presence !== "vacant") { setError("Choose the presence you physically observed."); return; }
      if (presence === "occupied" && (!Number.isInteger(count) || count < 1 || count > 99)) {
        setError("Enter the observed person count from 1 to 99."); return;
      }
      const draft = Object.freeze({ spaceId: room.spaceId, observedPresence: presence,
        observedPersons: presence === "occupied" ? count : null });
      pending = Object.freeze({ propertyId, draft, key: crypto.randomUUID() });
      attempt.current = pending;
    }
    if (!acquireHousekeepingDiscrepancyFlight(inFlight)) return;
    setPosting(true);
    setError(null);
    setMessage(null);
    callbacks.current.onBusyChange?.(true);
    const current = generation.current;
    let retainParentLock = false;
    try {
      const result = await runHousekeepingDiscrepancyAttempt({
        client: client.current!, attempt: pending,
        isCurrent: () => current === generation.current && pending!.propertyId === propertyId,
        onRefresh: () => callbacks.current.onRefresh(),
      });
      if (current !== generation.current) return;
      setRows(result.rows);
      setListLoaded(true);
      attempt.current = null;
      setUncertain(false);
      setConfirmed(false);
      setMessage(result.receipt.discrepancy === null
        ? "Observation matched current server truth; no discrepancy was created."
        : result.receipt.created
          ? "Discrepancy recorded and verified in the unresolved list."
          : "Existing discrepancy confirmed in the unresolved list.");
    } catch (cause) {
      if (current !== generation.current) return;
      const failure = cause instanceof HousekeepingDiscrepancyRequestError
        ? cause : new HousekeepingDiscrepancyRequestError(cause instanceof Error ? cause.message : "The report result could not be verified.", null, true);
      if (failure.uncertain || uncertain) {
        retainParentLock = true;
        setUncertain(true);
        setError(`${failure.message} The exact observation and request key are retained; recheck or retry that request.`);
      } else {
        attempt.current = null;
        setUncertain(false);
        setConfirmed(false);
        setError(failure.message);
      }
    } finally {
      inFlight.current = false;
      if (current === generation.current) {
        setPosting(false);
        if (!retainParentLock) callbacks.current.onBusyChange?.(false);
      }
    }
  };

  const editable = !disabled && !posting && !uncertain;
  const currentRoom = rooms.find((room) => room.spaceId === selectedRoom);
  return <section className="housekeeping-discrepancy" aria-label="Room discrepancy reporting" data-lifecycle-recovery={posting || uncertain ? "true" : undefined}>
    <header className="housekeeping-discrepancy__header">
      <div><span className="housekeeping-discrepancy__eyebrow">Observed room presence</span>
        <h2>Room discrepancies</h2>
        <p>Compare a physical observation with the current room record. Reporting does not resolve an open discrepancy or mark a room ready.</p>
      </div>
      <button type="button" className="housekeeping-discrepancy__quiet" disabled={disabled || loading || posting || uncertain} onClick={() => void read()}>Refresh list</button>
    </header>
    <p className="housekeeping-discrepancy__limit">Showing up to 100 unresolved discrepancies. The list is server-owned and updates only when refreshed.</p>
    {loading ? <p role="status">Loading unresolved discrepancies…</p> : !listLoaded ? null : rows.length === 0 ? <p className="housekeeping-discrepancy__empty">No unresolved room discrepancies.</p> :
      <ul className="housekeeping-discrepancy__list" aria-label="Unresolved room discrepancies">{rows.map((row) => <li key={`${row.spaceId}:${row.reportedAt}`}>
        <strong>Room {row.spaceCode}{row.floor ? ` · Floor ${row.floor}` : ""}</strong>
        <span>{row.kind === "sleep" ? "Observed occupied; system vacant" : row.kind === "skip" ? "Observed vacant; system occupied" : `Persons observed ${row.reported}; system ${row.systemState}`}</span>
        <small>Reported {new Date(row.reportedAt).toLocaleString()} · staff {row.reportedBy}</small>
      </li>)}</ul>}
    <form className="housekeeping-discrepancy__form" onSubmit={(event) => { event.preventDefault(); void submit(uncertain); }}>
      <h3>Report an observation</h3>
      <label>Exact loaded room
        <select value={selectedRoom} disabled={!editable || uncertain} required onChange={(event) => { setSelectedRoom(event.target.value); setConfirmed(false); setError(null); }}>
          <option value="">Choose a room</option>{rooms.map((room) => <option key={room.spaceId} value={room.spaceId}>Room {room.code}{room.floor ? ` · Floor ${room.floor}` : ""}</option>)}
        </select>
      </label>
      {!currentRoom && selectedRoom ? <p className="housekeeping-discrepancy__error">That room is no longer in the loaded room list. Refresh Housekeeping before reporting.</p> : null}
      <fieldset disabled={!editable || uncertain}>
        <legend>What did you physically observe?</legend>
        <label><input type="radio" name="observed-presence" value="vacant" checked={presence === "vacant"} onChange={() => { setPresence("vacant"); setPersons(""); setConfirmed(false); }} /> Vacant</label>
        <label><input type="radio" name="observed-presence" value="occupied" checked={presence === "occupied"} onChange={() => { setPresence("occupied"); setConfirmed(false); }} /> Occupied</label>
      </fieldset>
      {presence === "occupied" ? <label>Observed persons
        <input type="number" min="1" max="99" step="1" inputMode="numeric" value={persons} disabled={!editable || uncertain} onChange={(event) => { setPersons(event.target.value); setConfirmed(false); }} />
      </label> : null}
      {!uncertain ? <label className="housekeeping-discrepancy__confirm"><input type="checkbox" checked={confirmed} disabled={!editable || !currentRoom || !presence || (presence === "occupied" && (!Number.isInteger(Number(persons)) || Number(persons) < 1 || Number(persons) > 99))} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm this is what I physically observed for Room {currentRoom?.code ?? "—"}.</label> : null}
      {uncertain ? <p className="housekeeping-discrepancy__pending">The previous request may have been accepted. Its observation and key are frozen until the result is reconciled.</p> : null}
      <div className="housekeeping-discrepancy__actions">
        {!uncertain ? <button type="submit" className="housekeeping-discrepancy__primary" disabled={!editable || !listLoaded || !confirmed}>Report observation</button> : <button type="submit" className="housekeeping-discrepancy__primary" disabled={posting}>{posting ? "Rechecking…" : "Recheck or retry exact report"}</button>}
      </div>
    </form>
    {error ? <p className="housekeeping-discrepancy__error" role="alert">{error}</p> : null}
    {message ? <p className="housekeeping-discrepancy__success" role="status">{message}</p> : null}
  </section>;
}
