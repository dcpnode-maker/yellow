import { useMemo, useState } from "react";
import type { HousekeepingTask, HousekeepingTaskAction } from "../yellow-api";
import "./housekeeping-dashboard.css";

type DashboardProps = Readonly<{
  rooms: readonly Readonly<{ condition: string }>[];
  tasks: readonly HousekeepingTask[];
  disabled: boolean;
  actionLabel: (action: HousekeepingTaskAction) => string;
  onPrepare: (task: HousekeepingTask, action: HousekeepingTaskAction, origin?: HTMLButtonElement) => void;
  showSummary?: boolean;
  evidenceState?: "current" | "loading" | "stale" | "unavailable";
}>;

const floorValue = (floor: string | null) => floor === null ? "missing" : `floor:${floor}`;
const label = (value: string) => value.replaceAll("_", " ");

/** Loaded evidence only. Preparing delegates to the existing guarded caller. */
export function HousekeepingTaskDashboard({ rooms, tasks, disabled, actionLabel, onPrepare, showSummary = true, evidenceState = "current" }: DashboardProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [condition, setCondition] = useState("");
  const [floor, setFloor] = useState("");
  const [assigned, setAssigned] = useState("");
  const [priority, setPriority] = useState("");
  const counts = useMemo(() => rooms.reduce<Record<string, number>>((result, room) => {
    result[room.condition] = (result[room.condition] ?? 0) + 1;
    return result;
  }, {}), [rooms]);
  const statuses = [...new Set(tasks.map((task) => task.taskStatus))].sort();
  const conditions = [...new Set(tasks.map((task) => task.roomCondition))].sort();
  const floors = [...new Set(tasks.map((task) => task.floor))].sort((left, right) => (left ?? "").localeCompare(right ?? "", undefined, { numeric: true }));
  const priorities = [...new Set(tasks.map((task) => task.priority))].sort((left, right) => left - right);
  const term = search.trim().toLocaleLowerCase();
  const visible = tasks.filter((task) =>
    (!status || task.taskStatus === status) && (!condition || task.roomCondition === condition) &&
    (!floor || floorValue(task.floor) === floor) && (!assigned || String(task.assigned) === assigned) &&
    (!priority || String(task.priority) === priority) && (!term || [task.taskId, task.spaceId, task.spaceCode, task.floor,
      task.taskStatus, task.roomCondition, task.priority, task.assigned ? "assigned" : "unassigned", task.dueAt, task.completedAt]
      .filter((value) => value !== null).join(" ").toLocaleLowerCase().includes(term)));
  const reset = () => { setSearch(""); setStatus(""); setCondition(""); setFloor(""); setAssigned(""); setPriority(""); };
  const readable = evidenceState === "current" || evidenceState === "stale";

  return <section className="hk-task-dashboard" aria-label="Housekeeping task dashboard">
    {showSummary && readable ? <div className="hk-dashboard-summary" aria-label="Loaded room conditions">
      <div><strong>{rooms.length}</strong><span>rooms · loaded</span></div>
      {Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)).map(([roomCondition, count]) =>
        <div key={roomCondition}><strong>{count}</strong><span>{label(roomCondition)} · loaded</span></div>)}
    </div> : null}
    <article className="detail-card hk-dashboard-tasks">
      <header><h2 tabIndex={-1}>Housekeeping tasks</h2><p>Filter the loaded cleaning tasks returned for this property. Assignment indicates whether a task is assigned; staff names are not returned.</p></header>
      <div className="hk-dashboard-filters">
        <label className="hk-dashboard-search">Search loaded tasks<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Room, floor, task ID or returned field" /></label>
        <label>Task status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{status && !statuses.some(value => value === status) ? <option value={status}>{label(status)} · not in loaded results</option> : null}{statuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <label>Room condition<select value={condition} onChange={(event) => setCondition(event.target.value)}><option value="">All conditions</option>{condition && !conditions.some(value => value === condition) ? <option value={condition}>{label(condition)} · not in loaded results</option> : null}{conditions.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <label>Floor<select value={floor} onChange={(event) => setFloor(event.target.value)}><option value="">All floors</option>{floor && !floors.some(value => floorValue(value) === floor) ? <option value={floor}>{floor === "missing" ? "Not returned" : floor.slice(6)} · not in loaded results</option> : null}{floors.map((value) => <option key={floorValue(value)} value={floorValue(value)}>{value === null ? "Not returned" : value}</option>)}</select></label>
        <label>Assignment<select value={assigned} onChange={(event) => setAssigned(event.target.value)}><option value="">All assignments</option><option value="true">Assigned</option><option value="false">Unassigned</option></select></label>
        <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option>{priority && !priorities.some(value => String(value) === priority) ? <option value={priority}>{priority} · not in loaded results</option> : null}{priorities.map((value) => <option key={value} value={String(value)}>{value}</option>)}</select></label>
        <button type="button" onClick={reset}>Clear filters</button>
      </div>
      <p className="hk-dashboard-row-count" role="status">{readable ? <>{evidenceState === "stale" ? "Previously loaded evidence may be stale. " : ""}{visible.length} of {tasks.length} loaded tasks</> : evidenceState === "loading" ? "Loading current task evidence…" : "Current task evidence is unavailable."}</p>
      {readable && visible.length ? <div className="hk-dashboard-table-scroll" role="region" aria-label="Housekeeping tasks table" tabIndex={0}><table>
        <caption>Loaded housekeeping cleaning tasks</caption>
        <thead><tr><th scope="col">Room</th><th scope="col">Status</th><th scope="col">Floor</th><th scope="col">Assignment</th><th scope="col">Priority</th><th scope="col">Room condition</th><th scope="col">Action</th></tr></thead>
        <tbody>{visible.map((task) => <tr key={task.taskId} data-task-id={task.taskId}>
          <th scope="row">{task.spaceCode}</th><td>{label(task.taskStatus)}</td><td>{task.floor ?? "Not returned"}</td><td>{task.assigned ? "Assigned" : "Unassigned"}</td><td>{task.priority}</td><td>{label(task.roomCondition)}</td>
          <td><div className="hk-dashboard-row-actions">{task.allowedActions.length ? task.allowedActions.map((action) => <button key={action} className="housekeeping-task-action" type="button" disabled={disabled || evidenceState !== "current"} onClick={(event) => { if (!disabled && evidenceState === "current") onPrepare(task, action, event.currentTarget); }}>{actionLabel(action)}</button>) : <span>No action returned</span>}</div></td>
        </tr>)}</tbody>
      </table></div> : readable ? <p className="empty">{tasks.length ? "No loaded tasks match these filters." : "No current tasks are listed."}</p> : null}
    </article>
  </section>;
}
