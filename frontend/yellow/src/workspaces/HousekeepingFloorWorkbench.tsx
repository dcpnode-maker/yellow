import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appendConditionPage, makeFloorSnapshot, type HousekeepingAction, type HousekeepingTaskRow, type RoomConditionRow } from "../housekeeping-floor-model";
import { createHousekeepingFloorClient, HousekeepingFloorRequestError, type HousekeepingFloorClient, type TokenProvider } from "./housekeeping-floor-client";
import "./housekeeping-floor.css";
import { createHousekeepingProgressPanel } from "./HousekeepingProgressPanel.mjs";
import "./housekeeping-progress.css";

const HousekeepingProgressPanel = createHousekeepingProgressPanel(createElement);

export type HousekeepingFloorWorkbenchProps = Readonly<{
  propertyId: string;
  timezone: string;
  getToken: TokenProvider;
  disabled?: boolean;
  refreshGeneration?: number;
  onPrepare: (task: HousekeepingTaskRow, action: HousekeepingAction) => void;
}>;

export function HousekeepingFloorWorkbench({ propertyId, timezone, getToken, disabled = false, refreshGeneration = 0, onPrepare }: HousekeepingFloorWorkbenchProps) {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    setNow(new Date().toISOString());
    const timer = setInterval(() => setNow(new Date().toISOString()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const client = useMemo(() => createHousekeepingFloorClient({ propertyId, getToken }), [propertyId, getToken]);
  const [rooms, setRooms] = useState<readonly RoomConditionRow[]>([]);
  const [tasks, setTasks] = useState<readonly HousekeepingTaskRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursors, setCursors] = useState<ReadonlySet<string>>(new Set());
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [detailTask, setDetailTask] = useState<HousekeepingTaskRow | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dataClient, setDataClient] = useState<HousekeepingFloorClient | null>(null);
  const generation = useRef(0);
  const detailGeneration = useRef(0);
  const refreshing = useRef(true);
  const paging = useRef(false);
  const readingDetail = useRef(false);
  const evidenceToken = useRef<string | null>(null);
  const floorChosen = useRef(false);
  const disabledRef = useRef(disabled);
  const selectedSpaceRef = useRef(selectedSpace);
  disabledRef.current = disabled;
  selectedSpaceRef.current = selectedSpace;
  // Hide a previous property's evidence in the render that precedes effect cleanup.
  const hasSnapshot = dataClient === client;
  const displayRooms = hasSnapshot ? rooms : [];
  const displayTasks = hasSnapshot ? tasks : [];
  const snapshot = useMemo(() => makeFloorSnapshot(displayRooms, displayTasks, hasSnapshot ? cursor : null), [displayRooms, displayTasks, hasSnapshot, cursor]);
  const revokeEvidence = () => {
    setDataClient(null); setRooms([]); setTasks([]); setCursor(null); setCursors(new Set());
    setSelectedSpace(null); selectedSpaceRef.current = null; setDetailTask(null); evidenceToken.current = null;
    setStale(false); client.invalidateScope();
  };
  const accessChanged = (cause: unknown) => cause instanceof HousekeepingFloorRequestError &&
    (cause.scopeChanged || cause.status === 401 || cause.status === 403);

  const refresh = useCallback(async (keepPrior: boolean) => {
    const current = ++generation.current;
    refreshing.current = true; paging.current = false; detailGeneration.current++; readingDetail.current = false;
    evidenceToken.current = null; client.invalidateScope();
    setLoading(true); setLoadingMore(false); setError(null); setDetailError(null);
    setDetailLoading(false); setDetailTask(null);
    if (!keepPrior) { setDataClient(null); setRooms([]); setTasks([]); setCursor(null); setCursors(new Set()); setSelectedFloor(null); setSelectedSpace(null); selectedSpaceRef.current = null; floorChosen.current = false; }
    try {
      const result = await client.snapshot();
      if (generation.current !== current) return;
      const first = appendConditionPage({ rooms: [], nextCursor: null, cursors: new Set<string>() }, result.page);
      evidenceToken.current = result.token; setDataClient(client);
      setRooms(first.rooms); setCursor(first.nextCursor); setCursors(first.cursors); setTasks(result.tasks); setStale(false);
      if (!floorChosen.current && first.rooms.length > 0) { setSelectedFloor(first.rooms[0]!.floor); floorChosen.current = true; }
    } catch (cause) {
      if (generation.current === current) { setError(cause instanceof Error ? cause.message : "Housekeeping data could not be loaded.");
        if (accessChanged(cause)) revokeEvidence(); else setStale(keepPrior);
      }
    } finally { if (generation.current === current) { refreshing.current = false; setLoading(false); } }
  }, [client]);

  useEffect(() => { void refresh(false); return () => { generation.current++; client.invalidateScope(); }; }, [refresh, refreshGeneration, client]);

  const loadMore = async () => {
    if (!hasSnapshot || !cursor || paging.current || refreshing.current || disabled || stale || !evidenceToken.current) return;
    const requested = cursor; const current = generation.current;
    paging.current = true; setLoadingMore(true); setError(null);
    try {
      const result = await client.conditions(requested, evidenceToken.current);
      if (generation.current !== current) return;
      const appended = appendConditionPage({ rooms, nextCursor: requested, cursors }, result.page);
      setRooms(appended.rooms); setCursor(appended.nextCursor); setCursors(appended.cursors); setStale(false);
    } catch (cause) { if (generation.current === current) { setError(cause instanceof Error ? cause.message : "More room conditions could not be loaded."); if (accessChanged(cause)) revokeEvidence(); else setStale(true); } }
    finally { if (generation.current === current) { paging.current = false; setLoadingMore(false); } }
  };

  const chooseRoom = (room: RoomConditionRow) => { if (disabled || refreshing.current || !hasSnapshot) return; detailGeneration.current++; readingDetail.current = false; setDetailLoading(false); selectedSpaceRef.current = room.spaceId; setSelectedSpace(room.spaceId); setSelectedFloor(room.floor); setDetailTask(null); setDetailError(null); };
  const prepare = async (task: HousekeepingTaskRow, action: HousekeepingAction) => {
    if (disabled || refreshing.current || readingDetail.current || stale || !hasSnapshot || !evidenceToken.current || !task.allowedActions.includes(action)) return;
    const current = generation.current; const detailRead = ++detailGeneration.current; readingDetail.current = true; setDetailLoading(true); setDetailError(null);
    try {
      const fresh = await client.task(task.taskId, evidenceToken.current);
      if (generation.current !== current) return;
      if (disabledRef.current || detailGeneration.current !== detailRead || selectedSpaceRef.current !== task.spaceId) return;
      if (fresh.spaceId !== task.spaceId) { setDetailTask(null); setDetailError("This task moved to another room. Refresh the floor view before choosing an action."); return; }
      if (fresh.roomCondition !== task.roomCondition || fresh.roomUpdatedAt !== task.roomUpdatedAt ||
          fresh.taskStatus !== task.taskStatus || !fresh.allowedActions.includes(action)) {
        setDetailTask(fresh); setDetailError("Task or room evidence changed. Current server details are shown; choose an available action again."); return;
      }
      onPrepare(fresh, action);
    } catch (cause) { if (generation.current === current && detailGeneration.current === detailRead && selectedSpaceRef.current === task.spaceId) {
      if (accessChanged(cause)) { revokeEvidence(); setError(cause instanceof Error ? cause.message : "Housekeeping access changed."); }
      else setDetailError(cause instanceof Error ? cause.message : "Current task details could not be verified.");
    } } finally { if (generation.current === current && detailGeneration.current === detailRead) { readingDetail.current = false; setDetailLoading(false); } }
  };
  const selectedRoom = displayRooms.find((room) => room.spaceId === selectedSpace) ?? null;
  const selectedTasks = displayTasks.filter((task) => task.spaceId === selectedSpace);
  const visibleFloors = snapshot.floors;

  return <section className="hk-floor-workbench" aria-label="Housekeeping floor workbench">
    <header className="hk-floor-heading"><div><span className="eyebrow">ROOM OPERATIONS</span><h2>Housekeeping floors</h2>
      <p>Recorded room conditions and current task declarations. This board shows rooms with recorded conditions; it does not represent complete inventory, availability, or check-in readiness.</p></div>
      <button type="button" disabled={disabled || loading} onClick={() => void refresh(true)}>Refresh</button>
    </header>
    {error ? <p className="hk-floor-alert" role="alert">{error}{stale ? " Previously loaded evidence remains visible and may be stale." : ""}</p> : null}
    {snapshot.tasksMayBeIncomplete ? <p className="hk-floor-note" role="status">200 current tasks are loaded. The API has no task cursor, so task matches may be incomplete.</p> : null}
    <p className="hk-floor-count" aria-live="polite">{hasSnapshot ? <>{displayRooms.length} rooms with recorded condition loaded{snapshot.exhausted ? " · condition list exhausted" : " · more rooms may be available"}; {displayTasks.length} current tasks loaded.</> : "Room condition coverage and current tasks have not been verified."}</p>
    {loading && !hasSnapshot ? <p>Loading room conditions…</p> : null}
    {hasSnapshot ? <HousekeepingProgressPanel snapshot={{ rooms: displayRooms, tasks: displayTasks,
      nextCursor: cursor, stale: stale || loading || loadingMore, tasksMayBeIncomplete: snapshot.tasksMayBeIncomplete }}
      now={now} timezone={timezone} /> : null}
    {!loading && hasSnapshot && visibleFloors.length === 0 ? <p>No rooms with recorded conditions are in this result.</p> : null}
    <div className="hk-floor-layout">
      <nav className="hk-floor-nav" aria-label="Housekeeping floors">
        {visibleFloors.map((group) => <button key={group.floor === null ? "floor:null" : `floor:${group.floor}`} type="button"
          aria-pressed={selectedFloor === group.floor} disabled={disabled || loading} onClick={() => { detailGeneration.current++; selectedSpaceRef.current = null; setSelectedFloor(group.floor); floorChosen.current = true; setSelectedSpace(null); setDetailTask(null); setDetailError(null); }}>
          <span>{group.label}</span><small>{group.rooms.length} loaded</small>
        </button>)}
        {hasSnapshot && cursor ? <button type="button" disabled={disabled || loading || loadingMore || stale} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Load more rooms"}</button> : null}
      </nav>
      <div className="hk-floor-room-area">
        {visibleFloors.filter((group) => group.floor === selectedFloor).map((group) => <section key={group.floor === null ? "room-floor:null" : `room-floor:${group.floor}`} aria-label={group.label}>
          <h3>{group.label}</h3><div className="hk-floor-cubes">{group.rooms.map((room) => <button key={room.spaceId} type="button" className={`hk-floor-cube is-${room.condition}`}
            aria-pressed={selectedSpace === room.spaceId} disabled={disabled || loading} onClick={() => chooseRoom(room)}>
            <strong>{room.code}</strong><span>{room.condition}</span><small>Recorded {room.updatedAt}</small>
            {displayTasks.filter((task) => task.spaceId === room.spaceId).length ? <small>{displayTasks.filter((task) => task.spaceId === room.spaceId).length} loaded task(s)</small> : <small>No task in loaded results</small>}
          </button>)}</div>
        </section>)}
      </div>
    </div>
    {selectedRoom ? <aside className="hk-floor-drawer" aria-label={`Room ${selectedRoom.code} details`}>
      <button type="button" className="hk-floor-back" disabled={disabled || loading} onClick={() => { detailGeneration.current++; selectedSpaceRef.current = null; setSelectedSpace(null); setDetailTask(null); setDetailError(null); }}>Back to floors</button>
      <h3>Room {selectedRoom.code}</h3><p>{selectedRoom.floor === null ? "Floor not recorded" : `Floor ${selectedRoom.floor}`} · {selectedRoom.condition}</p>
      <p>Condition recorded at <time dateTime={selectedRoom.updatedAt}>{selectedRoom.updatedAt}</time></p>
      {selectedTasks.length === 0 ? <p>No task in loaded results for this room.</p> : <ul>{selectedTasks.map((listedTask) => {
        const task = detailTask?.taskId === listedTask.taskId ? detailTask : listedTask;
        return <li key={task.taskId}>
        <button type="button" className="hk-floor-task-select" disabled={disabled || loading || detailLoading} aria-pressed={detailTask?.taskId === task.taskId} onClick={() => { setDetailTask(task); setDetailError(null); }}>
          Task {task.taskId} · {task.taskStatus} · priority {task.priority}
        </button>
        {detailTask?.taskId === task.taskId ? <div className="hk-floor-task-detail"><p>Room evidence: {task.roomCondition} · {task.roomUpdatedAt}</p><p>{task.assigned ? "Assigned" : "Unassigned"}{task.dueAt ? ` · due ${task.dueAt}` : ""}</p>
          {task.allowedActions.length ? task.allowedActions.map((action) => <button key={action} type="button" disabled={disabled || loading || detailLoading || stale} onClick={() => void prepare(task, action)}>{action === "start" ? "Start cleaning" : action === "complete" ? "Mark physically clean" : "Verify inspected"}</button>) : <p>No action is currently allowed for this task.</p>}
        </div> : null}
      </li>; })}</ul>}
      {detailError ? <p className="hk-floor-alert" role="alert">{detailError}</p> : null}
    </aside> : null}
  </section>;
}
