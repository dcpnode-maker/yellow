import { useMemo, useState } from "react";
import type { HousekeepingCondition, HousekeepingTask, HousekeepingTaskAction } from "../yellow-api";
import "./housekeeping-dashboard.css";

type DashboardProps = Readonly<{
  rooms: readonly HousekeepingCondition[];
  tasks: readonly HousekeepingTask[];
  disabled: boolean;
  actionLabel: (action: HousekeepingTaskAction) => string;
  onPrepare: (task: HousekeepingTask, action: HousekeepingTaskAction) => void;
}>;

const floorValue = (floor: string | null) => floor === null ? "missing" : `floor:${floor}`;
const label = (value: string) => value.replaceAll("_", " ");

/** Loaded evidence only. Preparing delegates to the existing guarded caller. */
export function HousekeepingTaskDashboard({ rooms, tasks, disabled, actionLabel, onPrepare }: DashboardProps) {
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

  return <section className="hk-task-dashboard" aria-label="Housekeeping task dashboard">
    <div className="hk-dashboard-summary" aria-label="Loaded room conditions">
      <div><strong>{rooms.length}</strong><span>rooms · loaded</span></div>
      {Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)).map(([roomCondition, count]) =>
        <div key={roomCondition}><strong>{count}</strong><span>{label(roomCondition)} · loaded</span></div>)}
    </div>
    <article className="detail-card hk-dashboard-tasks">
      <header><h2>Housekeeping tasks</h2><p>Filter the current cleaning tasks returned for this property. Assignment indicates whether a task is assigned; staff names are not returned.</p></header>
      <div className="hk-dashboard-filters">
        <label className="hk-dashboard-search">Search loaded tasks<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Room, floor, task ID or returned field" /></label>
        <label>Task status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <label>Room condition<select value={condition} onChange={(event) => setCondition(event.target.value)}><option value="">All conditions</option>{conditions.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <label>Floor<select value={floor} onChange={(event) => setFloor(event.target.value)}><option value="">All floors</option>{floors.map((value) => <option key={floorValue(value)} value={floorValue(value)}>{value === null ? "Not returned" : value}</option>)}</select></label>
        <label>Assignment<select value={assigned} onChange={(event) => setAssigned(event.target.value)}><option value="">All assignments</option><option value="true">Assigned</option><option value="false">Unassigned</option></select></label>
        <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option>{priorities.map((value) => <option key={value} value={String(value)}>{value}</option>)}</select></label>
        <button type="button" onClick={reset}>Clear filters</button>
      </div>
      <p className="hk-dashboard-row-count" role="status">{visible.length} of {tasks.length} loaded tasks</p>
      {visible.length ? <div className="hk-dashboard-table-scroll" role="region" aria-label="Housekeeping tasks table" tabIndex={0}><table>
        <caption>Loaded housekeeping cleaning tasks</caption>
        <thead><tr><th scope="col">Room</th><th scope="col">Status</th><th scope="col">Floor</th><th scope="col">Assignment</th><th scope="col">Priority</th><th scope="col">Room condition</th><th scope="col">Action</th></tr></thead>
        <tbody>{visible.map((task) => <tr key={task.taskId} data-task-id={task.taskId}>
          <th scope="row">{task.spaceCode}</th><td>{label(task.taskStatus)}</td><td>{task.floor ?? "Not returned"}</td><td>{task.assigned ? "Assigned" : "Unassigned"}</td><td>{task.priority}</td><td>{label(task.roomCondition)}</td>
          <td><div className="hk-dashboard-row-actions">{task.allowedActions.length ? task.allowedActions.map((action) => <button key={action} className="housekeeping-task-action" type="button" disabled={disabled} onClick={() => onPrepare(task, action)}>{actionLabel(action)}</button>) : <span>No action returned</span>}</div></td>
        </tr>)}</tbody>
      </table></div> : <p className="empty">{tasks.length ? "No loaded tasks match these filters." : "No current tasks are listed."}</p>}
    </article>
  </section>;
}
