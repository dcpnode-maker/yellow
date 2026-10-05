import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { appendConditionPage, makeFloorSnapshot, type HousekeepingAction, type HousekeepingTaskRow, type RoomConditionRow } from "../housekeeping-floor-model";
import { createHousekeepingFloorClient, HousekeepingFloorRequestError, type HousekeepingFloorClient, type TokenProvider } from "./housekeeping-floor-client";
import "./housekeeping-floor.css";
import { createHousekeepingProgressPanel } from "./HousekeepingProgressPanel.mjs";
import "./housekeeping-progress.css";
import { HousekeepingTaskDashboard } from "./HousekeepingTaskDashboard";

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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTaskRef = useRef<string | null>(null);
  const [reviewFocus, setReviewFocus] = useState(0);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const tableRoot = useRef<HTMLDivElement>(null);
  const currentClient = useRef(client); currentClient.current = client;
  const selectionOrigin = useRef<HTMLButtonElement | null>(null);
  const pendingTableReturn = useRef<{ client: HousekeepingFloorClient; origin: HTMLButtonElement; scrollY: number } | null>(null);
  const wasDisabled = useRef(disabled);
  const returnReady = useRef(false);
  const completedRefresh = useRef(-1);
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
  const roomButtons = useRef(new Map<string, HTMLButtonElement>());
  disabledRef.current = disabled;
  selectedSpaceRef.current = selectedSpace;
  // Hide a previous property's evidence in the render that precedes effect cleanup.
  const hasSnapshot = dataClient === client;
  const displayRooms = hasSnapshot ? rooms : [];
  const displayTasks = hasSnapshot ? tasks : [];
  const snapshot = useMemo(() => makeFloorSnapshot(displayRooms, displayTasks, hasSnapshot ? cursor : null), [displayRooms, displayTasks, hasSnapshot, cursor]);
  const revokeEvidence = () => {
    setDataClient(null); setRooms([]); setTasks([]); setCursor(null); setCursors(new Set());
    setSelectedSpace(null); selectedSpaceRef.current = null; setSelectedTaskId(null); selectedTaskRef.current = null; setDetailTask(null); evidenceToken.current = null;
    detailGeneration.current++; readingDetail.current = false; setDetailLoading(false); pendingTableReturn.current = null;
    setStale(false); client.invalidateScope();
  };
  const accessChanged = (cause: unknown) => cause instanceof HousekeepingFloorRequestError &&
    (cause.scopeChanged || cause.status === 401 || cause.status === 403 || cause.status === 404);

  const refresh = useCallback(async (keepPrior: boolean) => {
    const current = ++generation.current;
    refreshing.current = true; paging.current = false; detailGeneration.current++; readingDetail.current = false;
    selectedTaskRef.current = null; setSelectedTaskId(null);
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
    } finally { if (generation.current === current) { completedRefresh.current = refreshGeneration; refreshing.current = false; setLoading(false); } }
  }, [client, refreshGeneration]);

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

  const selectionBlocked = () => disabledRef.current || refreshing.current || paging.current || stale || !hasSnapshot || currentClient.current !== client || !evidenceToken.current;
  const cancelSelection = () => {
    detailGeneration.current++; readingDetail.current = false; setDetailLoading(false);
    selectedTaskRef.current = null; setSelectedTaskId(null); setDetailTask(null); setDetailError(null);
    pendingTableReturn.current = null;
  };
  const chooseRoom = (room: RoomConditionRow) => { if (selectionBlocked()) return; cancelSelection(); selectionOrigin.current = null; selectedSpaceRef.current = room.spaceId; setSelectedSpace(room.spaceId); setSelectedFloor(room.floor); };
  const prepare = async (requestedTask: HousekeepingTaskRow, action: HousekeepingAction, origin?: HTMLButtonElement) => {
    if (selectionBlocked()) return;
    // Resolve against this rendered evidence, or the explicitly reviewed current
    // detail. Never let an obsolete row closure substitute another task/room.
    const task = detailTask?.taskId === requestedTask.taskId && selectedTaskRef.current === requestedTask.taskId
      ? detailTask : displayTasks.find(item => item.taskId === requestedTask.taskId);
    if (!task || task.spaceId !== requestedTask.spaceId || !task.allowedActions.includes(action)) return;
    const current = generation.current; const detailRead = ++detailGeneration.current; const token = evidenceToken.current!;
    selectedTaskRef.current = task.taskId; setSelectedTaskId(task.taskId);
    selectedSpaceRef.current = task.spaceId; setSelectedSpace(task.spaceId);
    const room = displayRooms.find(item => item.spaceId === task.spaceId);
    if (room) setSelectedFloor(room.floor);
    if (origin) selectionOrigin.current = origin;
    pendingTableReturn.current = null;
    readingDetail.current = true; setDetailLoading(true); setDetailError(null); setDetailTask(task);
    const stillCurrent = () => generation.current === current && detailGeneration.current === detailRead &&
      currentClient.current === client && evidenceToken.current === token && !disabledRef.current &&
      selectedTaskRef.current === task.taskId && selectedSpaceRef.current === task.spaceId;
    try {
      const fresh = await client.task(task.taskId, token);
      if (!stillCurrent()) return;
      if (fresh.spaceId !== task.spaceId) { setDetailTask(null); setDetailError("This task moved to another room. Refresh the floor view before choosing an action."); setReviewFocus(detailRead); return; }
      setDetailTask(fresh);
      if (JSON.stringify(fresh) !== JSON.stringify(task) || !fresh.allowedActions.includes(action)) {
        setDetailError("Task or room evidence changed. Current server details are shown; choose an available action again."); setReviewFocus(detailRead); return;
      }
      if (selectionOrigin.current) pendingTableReturn.current = { client, origin: selectionOrigin.current, scrollY: window.scrollY };
      onPrepare(fresh, action);
    } catch (cause) { if (stillCurrent()) {
      if (accessChanged(cause)) { revokeEvidence(); setError(cause instanceof Error ? cause.message : "Housekeeping access changed."); }
      else { setDetailError(cause instanceof Error ? cause.message : "Current task details could not be verified."); setReviewFocus(detailRead); }
    } } finally { if (generation.current === current && detailGeneration.current === detailRead) { readingDetail.current = false; setDetailLoading(false); } }
  };
  useLayoutEffect(() => {
    if (reviewFocus !== detailGeneration.current || disabledRef.current || readingDetail.current || !hasSnapshot) return;
    detailHeading.current?.focus({ preventScroll: true });
    detailHeading.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [reviewFocus, hasSnapshot]);
  useLayoutEffect(() => {
    if (wasDisabled.current && !disabled) returnReady.current = true;
    wasDisabled.current = disabled;
    const request = pendingTableReturn.current;
    // A receipt can unlock before the passive refresh effect removes the old rows.
    // Wait for that refresh to settle before returning focus to surviving evidence.
    if (!returnReady.current || !request || disabled || loading || completedRefresh.current !== refreshGeneration) return;
    returnReady.current = false; pendingTableReturn.current = null;
    if (request.client !== client || !hasSnapshot || stale || (document.activeElement !== document.body && !document.activeElement?.closest('.hk-task-confirm'))) return;
    const target = request.origin.isConnected && !request.origin.disabled ? request.origin : tableRoot.current?.querySelector<HTMLHeadingElement>('h2');
    target?.focus({ preventScroll: true });
    window.scrollTo({ top: request.scrollY, behavior: "instant" });
  }, [disabled, loading, hasSnapshot, stale, client, refreshGeneration]);
  const selectedRoom = displayRooms.find((room) => room.spaceId === selectedSpace) ?? null;
  const selectedTasks = displayTasks.filter((task) => task.spaceId === selectedSpace);
  const selectedTask = hasSnapshot ? detailTask ?? displayTasks.find(task => task.taskId === selectedTaskId) ?? null : null;
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
    {!loading && hasSnapshot && visibleFloors.length === 0 ? <p>No rooms with recorded conditions are in this result.</p> : null}
    <div className="hk-floor-layout">
      <nav className="hk-floor-nav" aria-label="Housekeeping floors">
        {visibleFloors.map((group) => <button key={group.floor === null ? "floor:null" : `floor:${group.floor}`} type="button"
          aria-pressed={selectedFloor === group.floor} disabled={disabled || loading || stale || loadingMore} onClick={() => { if (selectionBlocked()) return; cancelSelection(); selectionOrigin.current = null; selectedSpaceRef.current = null; setSelectedFloor(group.floor); floorChosen.current = true; setSelectedSpace(null); }}>
          <span>{group.label}</span><small>{group.rooms.length} loaded</small>
        </button>)}
        {hasSnapshot && cursor ? <button type="button" disabled={disabled || loading || loadingMore || stale} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Load more rooms"}</button> : null}
      </nav>
      <div className="hk-floor-room-area">
        {visibleFloors.filter((group) => group.floor === selectedFloor).map((group) => <section key={group.floor === null ? "room-floor:null" : `room-floor:${group.floor}`} aria-label={group.label}>
          <h3>{group.label}</h3><div className="hk-floor-cubes">{group.rooms.map((room) => <button key={room.spaceId} type="button" className={`hk-floor-cube is-${room.condition}`}
            ref={(node) => { if (node) roomButtons.current.set(room.spaceId, node); else roomButtons.current.delete(room.spaceId); }}
            aria-pressed={selectedSpace === room.spaceId} disabled={disabled || loading || stale || loadingMore} onClick={() => chooseRoom(room)}>
            <strong>{room.code}</strong><span>{room.condition}</span><small>Recorded {room.updatedAt}</small>
            {displayTasks.filter((task) => task.spaceId === room.spaceId).length ? <small>{displayTasks.filter((task) => task.spaceId === room.spaceId).length} loaded task(s)</small> : <small>No task in loaded results</small>}
          </button>)}</div>
        </section>)}
      </div>
    </div>
    <div ref={tableRoot}><HousekeepingTaskDashboard rooms={displayRooms} tasks={displayTasks} showSummary={false}
      evidenceState={loading ? "loading" : !hasSnapshot ? "unavailable" : stale ? "stale" : "current"}
      disabled={disabled || loading || loadingMore || stale} actionLabel={action => action === "start" ? "Start cleaning" : action === "complete" ? "Mark physically clean" : "Verify inspected"}
      onPrepare={(task, action, origin) => void prepare(task, action, origin)} /></div>
    {selectedTaskId && hasSnapshot ? <section className="hk-floor-drawer" aria-label="Selected housekeeping task">
      <h3 ref={detailHeading} tabIndex={-1}>Task details · Room {selectedTask?.spaceCode ?? selectedSpace}</h3>
      {!selectedRoom ? <p>Room condition page not loaded for this task.</p> : null}
      {detailLoading ? <p role="status">Checking current task details…</p> : null}
      {selectedTask ? <p>Task {selectedTask.taskId} · {selectedTask.taskStatus} · Task-recorded condition: {selectedTask.roomCondition} · {selectedTask.roomUpdatedAt}</p> : null}
      {selectedTask ? <p>Floor {selectedTask.floor ?? "not returned"} · Priority {selectedTask.priority} · {selectedTask.assigned ? "Assigned" : "Unassigned"}{selectedTask.dueAt ? ` · Due ${selectedTask.dueAt}` : ""}{selectedTask.completedAt ? ` · Completed ${selectedTask.completedAt}` : ""}</p> : null}
      {detailError ? <p className="hk-floor-alert" role="alert">{detailError}</p> : null}
      {detailTask && detailError && !detailLoading ? <div className="hk-floor-task-detail">{detailTask.allowedActions.length ? detailTask.allowedActions.map(action => <button key={action} type="button" disabled={disabled || loading || stale || loadingMore} onClick={() => void prepare(detailTask, action)}>{action === "start" ? "Start cleaning" : action === "complete" ? "Mark physically clean" : "Verify inspected"}</button>) : <p>No action is currently allowed for this task.</p>}</div> : null}
    </section> : null}
    {selectedRoom ? <aside className="hk-floor-drawer" aria-label={`Room ${selectedRoom.code} details`}>
      <button type="button" className="hk-floor-back" disabled={disabled || loading} onClick={() => { if (disabledRef.current || refreshing.current) return; roomButtons.current.get(selectedRoom.spaceId)?.focus(); cancelSelection(); selectedSpaceRef.current = null; setSelectedSpace(null); }}>Back to floors</button>
      <h3>Room {selectedRoom.code}</h3><p>{selectedRoom.floor === null ? "Floor not recorded" : `Floor ${selectedRoom.floor}`} · {selectedRoom.condition}</p>
      <HousekeepingProgressPanel key={selectedRoom.spaceId} snapshot={{ rooms: [selectedRoom],
        tasks: selectedTasks.map((task) => detailTask?.taskId === task.taskId ? detailTask : task),
        nextCursor: cursor, stale: stale || loading || loadingMore || Boolean(detailError), tasksMayBeIncomplete: snapshot.tasksMayBeIncomplete }}
        now={now} timezone={timezone} selectedTaskId={detailTask?.taskId} disabled={disabled || loading || detailLoading}
        onSelectTask={(task) => { if (selectionBlocked()) return; cancelSelection(); selectionOrigin.current = null; selectedTaskRef.current = task.taskId; setSelectedTaskId(task.taskId); setDetailTask(task); }}
        renderTaskControls={(task) => <div className="hk-floor-task-detail">
          {task.allowedActions.length ? task.allowedActions.map((action) => <button key={action} type="button" disabled={disabled || loading || detailLoading || stale} onClick={() => void prepare(task, action)}>{action === "start" ? "Start cleaning" : action === "complete" ? "Mark physically clean" : "Verify inspected"}</button>) : <p>No action is currently allowed for this task.</p>}
        </div>} />
    </aside> : null}
  </section>;
}
