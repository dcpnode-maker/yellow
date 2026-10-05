// Read projection only. The existing scoped client and canonical parsers remain the network boundary.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONDITIONS = new Set(['clean', 'dirty', 'pickup', 'inspected']);
const STAGES = new Map([['assigned', 'Assigned'], ['in_progress', 'Cleaning in progress'], ['done', 'Cleaning completed'], ['verified', 'Verified task']]);
const ACTIONS = new Set(['start', 'complete', 'verify']);
const ROOM_FIELDS = ['spaceId', 'code', 'floor', 'condition', 'updatedAt'];
const TASK_FIELDS = ['taskId', 'spaceId', 'spaceCode', 'floor', 'roomCondition', 'roomUpdatedAt', 'taskStatus', 'priority', 'assigned', 'dueAt', 'completedAt', 'allowedActions'];

function fail(message) { throw new Error(`Housekeeping progress: ${message}`); }
function exact(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid record');
  const keys = Object.keys(value).sort();
  if (keys.length !== fields.length || keys.some((key, i) => key !== [...fields].sort()[i])) fail('unexpected record fields');
}
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function floor(value) { return value === null || typeof value === 'string'; }
function identity(value) { if (typeof value !== 'string' || !UUID.test(value)) fail('invalid identity'); return value.toLowerCase(); }

// Compare UTC microseconds, not browser millisecond truncation. Reject normalized impossible dates.
export function instantMicros(value) {
  if (typeof value !== 'string') fail('a valid UTC clock/instant is required');
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/.exec(value);
  if (!match || value.startsWith('0000-')) fail('a valid UTC clock/instant is required');
  const base = `${match[1]}Z`, millis = Date.parse(base);
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 19) + 'Z' !== base) fail('impossible civil date or time');
  return BigInt(millis) * 1000n + BigInt((match[2] ?? '').padEnd(6, '0'));
}

function roomRecord(raw) {
  exact(raw, ROOM_FIELDS); identity(raw.spaceId);
  if (!text(raw.code) || !floor(raw.floor) || !CONDITIONS.has(raw.condition)) fail('invalid room condition');
  instantMicros(raw.updatedAt);
  return Object.freeze({ ...raw });
}
function taskRecord(raw) {
  exact(raw, TASK_FIELDS); identity(raw.taskId); identity(raw.spaceId);
  if (!text(raw.spaceCode) || !floor(raw.floor) || !CONDITIONS.has(raw.roomCondition) || !STAGES.has(raw.taskStatus) ||
      !Number.isSafeInteger(raw.priority) || raw.priority < 0 || typeof raw.assigned !== 'boolean' ||
      !Array.isArray(raw.allowedActions) || raw.allowedActions.length > 1 || !raw.allowedActions.every(action => ACTIONS.has(action))) fail('invalid task');
  instantMicros(raw.roomUpdatedAt);
  if (raw.dueAt !== null) instantMicros(raw.dueAt);
  if (raw.completedAt !== null) instantMicros(raw.completedAt);
  return Object.freeze({ ...raw, allowedActions: Object.freeze([...raw.allowedActions]) });
}
function unique(records, key) {
  const seen = new Set();
  for (const record of records) { const id = identity(record[key]); if (seen.has(id)) fail(`duplicate ${key}`); seen.add(id); }
}

export function buildHousekeepingProgress(snapshot, now) {
  const clock = instantMicros(now);
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.rooms) || !Array.isArray(snapshot.tasks) ||
      snapshot.tasks.length > 200 || typeof snapshot.stale !== 'boolean' ||
      !(snapshot.nextCursor === null || typeof snapshot.nextCursor === 'string' && snapshot.nextCursor.length > 0 && snapshot.nextCursor.length <= 2048) ||
      snapshot.rooms.length === 0 && snapshot.nextCursor !== null ||
      snapshot.tasksMayBeIncomplete !== undefined && typeof snapshot.tasksMayBeIncomplete !== 'boolean') fail('invalid snapshot');
  const rooms = snapshot.rooms.map(roomRecord), tasks = snapshot.tasks.map(taskRecord);
  unique(rooms, 'spaceId'); unique(tasks, 'taskId');
  const roomMap = new Map(rooms.map(room => [identity(room.spaceId), room]));
  const taskViews = tasks.map(task => {
    const room = roomMap.get(identity(task.spaceId));
    const problems = [];
    if (snapshot.stale) problems.push('Snapshot is stale; refresh before relying on this record.');
    if (!room) problems.push('Room condition is not in the loaded condition rows.');
    else if (room.condition !== task.roomCondition || instantMicros(room.updatedAt) !== instantMicros(task.roomUpdatedAt) || room.code !== task.spaceCode || room.floor !== task.floor)
      problems.push('Task room evidence differs from the loaded condition record; refresh both reads.');
    if (instantMicros(task.roomUpdatedAt) > clock) problems.push('Condition timestamp is after the supplied clock.');
    const complete = task.taskStatus === 'done' || task.taskStatus === 'verified';
    if (complete && task.completedAt === null) problems.push('Completion timestamp is not recorded.');
    if (!complete && task.completedAt !== null) problems.push('Completion timestamp conflicts with the recorded task stage.');
    if (task.completedAt !== null && instantMicros(task.completedAt) > clock) problems.push('Completion timestamp is after the supplied clock.');
    const coherent = problems.length === 0;
    let deadlineState = 'not_recorded';
    if (task.dueAt !== null) deadlineState = !coherent ? 'unknown' : complete ? 'completed' :
      instantMicros(task.dueAt) < clock ? 'overdue' : instantMicros(task.dueAt) === clock ? 'due_now' : 'upcoming';
    return Object.freeze({ task, stage: coherent ? STAGES.get(task.taskStatus) : 'Progress evidence unavailable',
      evidenceState: coherent ? 'recorded' : 'unknown', problems: Object.freeze(problems), deadlineState,
      eta: Object.freeze({ state: 'unavailable', at: null, reason: 'The current housekeeping API does not record a predicted completion or room-ready time.' }) });
  });
  const rowViews = rooms.map(room => Object.freeze({ room,
    conditionEvidenceState: snapshot.stale || instantMicros(room.updatedAt) > clock ? 'unknown' : 'recorded',
    tasks: Object.freeze(taskViews.filter(view => identity(view.task.spaceId) === identity(room.spaceId))) }));
  return Object.freeze({ now, stale: snapshot.stale, rooms: Object.freeze(rowViews), tasks: Object.freeze(taskViews),
    unlinkedTasks: Object.freeze(taskViews.filter(view => !roomMap.has(identity(view.task.spaceId)))),
    loadedConditionCount: rooms.length, loadedTaskCount: tasks.length,
    conditionPagesIncomplete: snapshot.nextCursor !== null,
    tasksMayBeIncomplete: tasks.length === 200 || snapshot.tasksMayBeIncomplete === true,
    nextCursor: snapshot.nextCursor,
    counts: Object.freeze(Object.fromEntries([...STAGES.keys()].map(stage => [stage, taskViews.filter(view => view.evidenceState === 'recorded' && view.task.taskStatus === stage).length]))),
    unknownProgressCount: taskViews.filter(view => view.evidenceState === 'unknown').length });
}

export function formatHousekeepingInstant(value, timezone) {
  instantMicros(value);
  if (typeof timezone !== 'string' || !timezone) fail('property timezone is required');
  try { return new Intl.DateTimeFormat('en', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return fail('property timezone is invalid'); }
}
