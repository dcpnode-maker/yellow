import { buildHousekeepingProgress, formatHousekeepingInstant } from '../housekeeping-progress.mjs';

// Inject React.createElement at integration. No local network, state transition or raw HTML sink.
export function createHousekeepingProgressPanel(h) {
  return function HousekeepingProgressPanel({ snapshot, now, timezone }) {
    let view;
    try { view = buildHousekeepingProgress(snapshot, now); formatHousekeepingInstant(now, timezone); }
    catch { return h('p', { className: 'hk-floor-alert', role: 'alert' }, 'Housekeeping progress is unavailable. Refresh the current property records and clock.'); }
    const at = value => h('time', { dateTime: value }, formatHousekeepingInstant(value, timezone));
    const taskRow = entry => h('li', { key: entry.task.taskId, className: 'hk-progress-task' },
      h('strong', null, entry.stage), h('small', null, `Task ${entry.task.taskId} · recorded stage ${entry.task.taskStatus}`),
      h('span', null, entry.task.assigned ? 'Assignment recorded; identity unavailable' : 'No assignment recorded'),
      h('span', null, 'Deadline: ', entry.task.dueAt === null ? 'Not recorded' : at(entry.task.dueAt), ` · ${entry.deadlineState.replaceAll('_', ' ')}`),
      h('span', null, 'Completion recorded: ', entry.task.completedAt === null ? 'Not recorded' : at(entry.task.completedAt)),
      h('span', null, 'ETA unavailable'),
      ...entry.problems.map(problem => h('p', { key: problem, className: 'hk-floor-alert' }, problem)));
    return h('section', { className: 'hk-progress-panel', 'aria-label': 'Recorded housekeeping progress' },
      h('h3', null, 'Housekeeping progress'),
      h('p', { className: 'hk-floor-count', role: 'status' }, `${view.loadedConditionCount} loaded condition rows · ${view.loadedTaskCount} loaded tasks · ${view.unknownProgressCount} with unknown progress evidence`),
      h('p', { className: 'hk-floor-note' }, 'Task stages show recorded work. Deadlines and condition timestamps are separate from ETA. Inspection does not establish occupancy, sellability or check-in permission.'),
      view.stale ? h('p', { className: 'hk-floor-alert', role: 'alert' }, 'Snapshot is stale; progress evidence is unavailable until refreshed.') : null,
      view.conditionPagesIncomplete ? h('p', { className: 'hk-floor-note' }, 'More condition pages remain. Use the existing Load more rooms control; counts cover loaded rows only.') : null,
      view.tasksMayBeIncomplete ? h('p', { className: 'hk-floor-note' }, 'The task list may be incomplete at the 200-task limit. These are loaded task counts, not a property total.') : null,
      view.rooms.length === 0 ? h('p', null, 'No condition rows in loaded results.') : null,
      ...view.rooms.map(entry => h('section', { key: entry.room.spaceId, className: 'hk-progress-room', 'aria-label': `Recorded progress for room ${entry.room.code}` },
        h('h4', null, `Room ${entry.room.code} · ${entry.room.floor === null ? 'Floor not recorded' : `Floor ${entry.room.floor}`}`),
        h('p', null, `Recorded condition: ${entry.room.condition} · evidence ${entry.conditionEvidenceState}`),
        h('p', null, 'Condition recorded: ', at(entry.room.updatedAt)),
        entry.tasks.length ? h('ul', null, ...entry.tasks.map(taskRow)) : h('p', null, 'No task in loaded results for this room.'))),
      view.unlinkedTasks.length ? h('section', { className: 'hk-progress-room' }, h('h4', null, 'Tasks whose room condition is not loaded'), h('ul', null, ...view.unlinkedTasks.map(taskRow))) : null);
  };
}
