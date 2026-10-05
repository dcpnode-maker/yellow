import { useEffect, useMemo, useRef, useState } from "react";
import type { ReservationDetail } from "../yellow-api";
import {
  createRoomMoveClient, eligibleRoomMoveDestinations, emptyRoomMoveRead, frozenRoomMoveRetry,
  roomMoveCanClose, roomMoveCanSubmit, roomMoveFailureDisposition, roomMoveStatusAfterClose,
  RoomMoveRequestError, runRoomMoveAttempt,
  type RoomMoveAttempt, type RoomMoveHistory, type RoomMoveInventory,
} from "../reservation-room-move";
import "./reservation-room-move.css";

type Props = Readonly<{
  propertyId: string; reservationId: string; confirmationNo: string;
  getToken: () => Promise<string>; timezone: string;
  otherMutationBusy: boolean; onLockChange: (locked: boolean) => void;
  onRefreshDetail: () => Promise<ReservationDetail>;
}>;
type AttemptStatus = "idle" | "posting" | "uncertain" | "done";

export function ReservationRoomMove(props: Props) {
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<RoomMoveHistory | null>(null);
  const [inventory, setInventory] = useState<RoomMoveInventory | null>(null);
  const [destinationId, setDestinationId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<AttemptStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<RoomMoveAttempt | null>(null);
  const generation = useRef(0);
  const currentIdentity = useRef("");
  const inFlight = useRef(false);
  const callbacks = useRef(props);
  callbacks.current = props;
  const identity = `${props.propertyId}\u0000${props.reservationId}\u0000${props.confirmationNo}`;
  currentIdentity.current = identity;
  const isCurrent = (expected: string, generationAtStart: number) =>
    currentIdentity.current === expected && generation.current === generationAtStart;
  const client = useMemo(() => createRoomMoveClient(props.getToken), [props.getToken]);

  useEffect(() => {
    generation.current += 1;
    attempt.current = null;
    inFlight.current = false;
    setOpened(false); setLoading(false); setHistory(null); setInventory(null);
    setDestinationId(""); setConfirmed(false); setStatus("idle"); setMessage(null); setError(null);
    callbacks.current.onLockChange(false);
    return () => { generation.current += 1; };
  }, [identity]);

  const read = async () => {
    if (loading || inFlight.current || props.otherMutationBusy || status === "uncertain") return;
    const expected = identity; const currentGeneration = generation.current;
    setOpened(true); setLoading(true); setError(null); setMessage(null);
    const cleared = emptyRoomMoveRead();
    setHistory(cleared.history); setInventory(cleared.inventory); setDestinationId(cleared.destinationId); setConfirmed(cleared.confirmed);
    setStatus((previous) => roomMoveStatusAfterClose(previous));
    try {
      const [segments, configured] = await Promise.all([
        client.historyExact(props.propertyId, props.reservationId, props.confirmationNo, () => isCurrent(expected, currentGeneration)),
        client.inventory(props.propertyId, () => isCurrent(expected, currentGeneration)),
      ]);
      if (!isCurrent(expected, currentGeneration)) return;
      setHistory(segments); setInventory(configured); setDestinationId(""); setConfirmed(false);
    } catch (cause) {
      if (!isCurrent(expected, currentGeneration)) return;
      setError(cause instanceof RoomMoveRequestError && cause.status === 403
        ? "Room move requires reservation-segment access and separately granted inventory-configuration access. Ask an authorized administrator; no bypass is available."
        : cause instanceof Error ? cause.message : "Stay or room configuration could not be verified.");
    } finally { if (isCurrent(expected, currentGeneration)) setLoading(false); }
  };

  const latest = history?.segments.at(-1);
  const source = inventory?.sellableUnits.find((unit) => unit.id === latest?.sellableUnitId);
  const sourceClaim = source && latest && source.unitTypeId === latest.unitTypeId && source.spaces.length === 1 && source.spaces[0]?.claimMode === "exclusive" ? source.spaces[0] : null;
  const candidates = useMemo(() => inventory && latest ? eligibleRoomMoveDestinations(inventory, latest) : [], [inventory, latest]);

  const execute = async (retry: boolean) => {
    if (inFlight.current || props.otherMutationBusy) return;
    const retryAttempt = retry ? frozenRoomMoveRetry(status, attempt.current) : null;
    if (retry ? !retryAttempt : (!roomMoveCanSubmit({ confirmed, history, inventory, status, destinationId }) || !latest)) return;
    const expected = identity; const currentGeneration = generation.current;
    if (!retry) {
      if (!latest?.actions.canMoveRoom || latest.status !== "in_house" || !sourceClaim || !candidates.some(({ id }) => id === destinationId)) {
        setError("This stay or destination is no longer eligible. Refresh current stay and room configuration."); return;
      }
      let key: string;
      try { key = crypto.randomUUID(); } catch { setError("A secure request key could not be created. Try again before submitting."); return; }
      attempt.current = Object.freeze({ propertyId: props.propertyId, reservationId: props.reservationId,
        confirmationNo: props.confirmationNo, segmentId: latest.segmentId, segmentSequence: latest.sequence,
        segmentUnitTypeId: latest.unitTypeId, sourceSpaceId: sourceClaim.spaceId,
        destinationSpaceId: candidates.find(({ id }) => id === destinationId)!.spaces[0]!.spaceId,
        request: Object.freeze({ expectedSellableUnitId: latest.sellableUnitId!,
          expectedPeriod: Object.freeze({ ...latest.period }), destinationSellableUnitId: destinationId }), key });
    }
    const frozen = retry ? retryAttempt : attempt.current;
    if (!frozen) return;
    const preservingUnknownOutcome = retry || status === "uncertain";
    inFlight.current = true;
    callbacks.current.onLockChange(true); // Synchronously lock parent actions before the first await.
    setStatus("posting"); setError(null); setMessage(null); setLoading(true);
    try {
      const result = await runRoomMoveAttempt({ client, attempt: frozen,
        isCurrent: () => isCurrent(expected, currentGeneration),
        refreshDetail: () => callbacks.current.onRefreshDetail() });
      if (!isCurrent(expected, currentGeneration)) return;
      setHistory(result.history); setStatus("done"); setMessage("Room move confirmed. The refreshed reservation and segment history agree.");
      attempt.current = null; callbacks.current.onLockChange(false);
    } catch (cause) {
      if (!isCurrent(expected, currentGeneration)) return;
      const disposition = roomMoveFailureDisposition(preservingUnknownOutcome, cause instanceof RoomMoveRequestError ? cause.uncertain : true);
      if (disposition.retainAttempt) {
        setStatus(disposition.nextStatus); callbacks.current.onLockChange(disposition.keepParentLock);
        setError(cause instanceof Error ? cause.message : "The result is uncertain. Retry this exact request to reconcile it.");
      } else {
        setStatus("idle"); attempt.current = null; callbacks.current.onLockChange(false);
        setConfirmed(false); setHistory(null); setInventory(null); setDestinationId("");
        setError(cause instanceof Error ? cause.message : "The room move was not accepted. Refresh current stay and configuration.");
      }
    } finally {
      inFlight.current = false;
      if (isCurrent(expected, currentGeneration)) setLoading(false);
    }
  };

  const close = () => {
    if (!roomMoveCanClose(status, loading) || inFlight.current) return;
    generation.current += 1; setOpened(false); setHistory(null); setInventory(null); setError(null); setMessage(null);
    setStatus((previous) => roomMoveStatusAfterClose(previous));
  };
  return <section className="reservation-room-move" aria-label="Move room" data-lifecycle-recovery={status === "posting" || status === "uncertain" ? "true" : undefined}>
    {!opened ? <button type="button" className="reservation-room-move-toggle" disabled={props.otherMutationBusy} onClick={() => void read()}>Move room</button> : null}
    {opened ? <div className="reservation-room-move-panel">
      <div className="reservation-room-move-heading"><div><h3>Move room</h3><p>Immediate move · same room type · availability is checked when you confirm.</p></div>
        <button type="button" className="reservation-room-move-secondary" disabled={loading || status === "posting" || status === "uncertain"} onClick={close}>Close</button></div>
      {loading && !history ? <p role="status">Loading exact stay history and authorized room configuration…</p> : null}
      {history && latest ? <>
        <p>Confirmation {props.confirmationNo} · Segment {latest.sequence} · {latest.status.replaceAll("_", " ")}</p>
        {latest.actions.canMoveRoom && latest.status === "in_house" && sourceClaim ? <>
          <p>Current room: <strong>{source?.name}</strong> ({sourceClaim.code}) · Configuration does not show room availability or readiness.</p>
          <label className="reservation-room-move-field">Move to a configured room of the same type
            <select value={destinationId} disabled={loading || status !== "idle" || props.otherMutationBusy} onChange={(event) => { setDestinationId(event.target.value); setConfirmed(false); setError(null); }}>
              <option value="">Choose a room</option>
              {candidates.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.spaces[0]!.code})</option>)}
            </select>
          </label>
          {!candidates.length ? <p role="status">No configured same-type exclusive room is eligible for selection. Configuration does not indicate availability.</p> : null}
          <label className="reservation-room-move-confirm"><input type="checkbox" checked={confirmed} disabled={!destinationId || loading || status !== "idle" || props.otherMutationBusy} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm an immediate room move for {props.confirmationNo}. Yellow will recheck destination occupancy.</label>
          <p>The server determines the move time and arbitrates occupancy. This does not change readiness, keys, charges, rates or folios.</p>
          <button type="button" className="reservation-room-move-primary" disabled={!confirmed || !destinationId || status !== "idle" || loading || props.otherMutationBusy} onClick={() => void execute(false)}>Confirm room move</button>
        </> : <p role="status">Room moves are unavailable for this stay’s current state.</p>}
      </> : null}
      {status === "uncertain" ? <div className="reservation-room-move-recovery"><p>The request outcome is uncertain. Its destination, source period and request key are frozen; other reservation actions remain locked.</p>
        <button type="button" className="reservation-room-move-primary" disabled={loading || inFlight.current} onClick={() => void execute(true)}>Retry exact room move</button></div> : null}
      {status === "done" ? <p className="reservation-room-move-success" role="status">{message}</p> : null}
      {error ? <p className="reservation-room-move-error" role="alert">{error}</p> : null}
      {status === "idle" && opened ? <button type="button" className="reservation-room-move-secondary" disabled={loading || props.otherMutationBusy} onClick={() => void read()}>Refresh stay and room configuration</button> : null}
    </div> : null}
  </section>;
}
