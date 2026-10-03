import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHousekeepingProgress as build, instantMicros, formatHousekeepingInstant } from '../frontend/yellow/src/housekeeping-progress.mjs';
import { createHousekeepingProgressPanel } from '../frontend/yellow/src/workspaces/HousekeepingProgressPanel.mjs';

const NOW = '2026-10-03T10:00:00.123456Z';
const ROOM = '00000000-0000-0000-0000-000000000001';
const TASK = '00000000-0000-0000-0000-000000000010';
const room = (changes = {}) => ({ spaceId: ROOM, code: '101', floor: '1', condition: 'dirty', updatedAt: '2026-10-03T09:00:00.000001Z', ...changes });
const task = (changes = {}) => ({ taskId: TASK, spaceId: ROOM, spaceCode: '101', floor: '1', roomCondition: 'dirty', roomUpdatedAt: '2026-10-03T09:00:00.000001Z', taskStatus: 'in_progress', priority: 1, assigned: true, dueAt: NOW, completedAt: null, allowedActions: ['complete'], ...changes });
const snapshot = (changes = {}) => ({ rooms: [room()], tasks: [task()], nextCursor: null, stale: false, ...changes });
const h = (tag, props, ...children) => ({ tag, props, children });
const Panel = createHousekeepingProgressPanel(h);
function allText(node) { return node == null ? '' : typeof node === 'object' ? node.children.map(allText).join(' ') : String(node); }
function tags(node) { return node && typeof node === 'object' ? [node.tag, ...node.children.flatMap(tags)] : []; }

test('categorical work has no percentage, assignee identity, start time or predicted ETA', () => {
  const view = build(snapshot(), NOW), entry = view.tasks[0];
  assert.equal(entry.stage, 'Cleaning in progress'); assert.equal(entry.evidenceState, 'recorded');
  assert.deepEqual(entry.eta, { state: 'unavailable', at: null, reason: 'The current housekeeping API does not record a predicted completion or room-ready time.' });
  assert.deepEqual(entry.task.allowedActions, ['complete']);
  for (const key of ['progressPercent', 'startedAt', 'assigneePartyId', 'readyAt']) assert.equal(Object.hasOwn(entry, key), false);
});
test('UTC civil timestamps reject overflow days, invalid times, offsets and an absent clock', () => {
  for (const value of [null, undefined, '', '0000-01-01T00:00:00Z', '2026-02-30T09:00:00Z', '2026-04-31T09:00:00Z', '2026-10-03T25:00:00Z', '2026-10-03T10:00:00+00:00', '2026-10-03'])
    assert.throws(() => build(snapshot(), value));
  assert.equal(instantMicros('2028-02-29T00:00:00.000001Z') - instantMicros('2028-02-29T00:00:00Z'), 1n);
});
test('deadline boundary respects UTC microseconds and is never an ETA', () => {
  for (const [dueAt, state] of [['2026-10-03T10:00:00.123455Z', 'overdue'], [NOW, 'due_now'], ['2026-10-03T10:00:00.123457Z', 'upcoming'], [null, 'not_recorded']]) {
    const entry = build(snapshot({ tasks: [task({ dueAt })] }), NOW).tasks[0];
    assert.equal(entry.deadlineState, state); assert.equal(entry.eta.at, null);
  }
});
test('missing or contradictory completion evidence is unknown without repairing the server record', () => {
  for (const taskStatus of ['done', 'verified']) {
    const entry = build(snapshot({ tasks: [task({ taskStatus, allowedActions: [], completedAt: null })] }), NOW).tasks[0];
    assert.equal(entry.evidenceState, 'unknown'); assert.equal(entry.task.taskStatus, taskStatus); assert.equal(entry.task.completedAt, null);
  }
  for (const taskStatus of ['assigned', 'in_progress']) {
    const entry = build(snapshot({ tasks: [task({ taskStatus, completedAt: '2026-10-03T09:30:00Z' })] }), NOW).tasks[0];
    assert.equal(entry.evidenceState, 'unknown'); assert.equal(entry.deadlineState, 'unknown');
  }
});
test('completed and verified categorical stages require coherent recorded evidence, not readiness', () => {
  for (const [taskStatus, condition] of [['done', 'clean'], ['verified', 'inspected']]) {
    const view = build(snapshot({ rooms: [room({ condition })], tasks: [task({ taskStatus, roomCondition: condition, completedAt: '2026-10-03T09:30:00Z', allowedActions: [] })] }), NOW);
    assert.equal(view.tasks[0].evidenceState, 'recorded'); assert.equal(view.tasks[0].deadlineState, 'completed');
    assert.equal(Object.hasOwn(view.rooms[0], 'readyToSell'), false); assert.equal(Object.hasOwn(view.rooms[0], 'canCheckIn'), false);
  }
});
test('future condition or completion evidence is unknown', () => {
  const future = '2026-10-03T11:00:00Z';
  assert.equal(build(snapshot({ rooms: [room({ updatedAt: future })], tasks: [task({ roomUpdatedAt: future })] }), NOW).rooms[0].conditionEvidenceState, 'unknown');
  assert.equal(build(snapshot({ tasks: [task({ taskStatus: 'done', completedAt: future })] }), NOW).tasks[0].evidenceState, 'unknown');
});
test('stale or mismatching task evidence never overwrites the loaded room condition', () => {
  const input = snapshot({ rooms: [room({ condition: 'inspected', updatedAt: '2026-10-03T09:50:00Z' })] });
  const view = build(input, NOW);
  assert.equal(view.rooms[0].room.condition, 'inspected'); assert.equal(view.tasks[0].task.roomCondition, 'dirty');
  assert.equal(view.tasks[0].evidenceState, 'unknown'); assert.deepEqual(view.tasks[0].task.allowedActions, ['complete']);
  const stale = build(snapshot({ stale: true }), NOW); assert.equal(stale.unknownProgressCount, 1); assert.equal(stale.tasks[0].deadlineState, 'unknown');
});
test('duplicate identities including different case are rejected; distinct tasks on one room remain distinct', () => {
  assert.throws(() => build(snapshot({ rooms: [room(), room()] }), NOW), /duplicate/);
  assert.throws(() => build(snapshot({ tasks: [task(), task()] }), NOW), /duplicate/);
  const hex = 'abcdef00-0000-0000-0000-000000000001';
  assert.throws(() => build(snapshot({ rooms: [room({ spaceId: hex }), room({ spaceId: hex.toUpperCase() })] }), NOW), /duplicate/);
  const view = build(snapshot({ tasks: [task(), task({ taskId: '00000000-0000-0000-0000-000000000011' })] }), NOW);
  assert.equal(view.rooms[0].tasks.length, 2); assert.equal(view.loadedTaskCount, 2);
});
test('condition pagination and task limit preserve loaded-scope incompleteness', () => {
  const tasks = Array.from({ length: 200 }, (_, i) => task({ taskId: `00000000-0000-0000-0000-${(i + 100).toString(16).padStart(12, '0')}` }));
  const view = build(snapshot({ tasks, nextCursor: 'page-two', tasksMayBeIncomplete: false }), NOW);
  assert.equal(view.tasksMayBeIncomplete, true); assert.equal(view.conditionPagesIncomplete, true);
  assert.equal(view.loadedConditionCount, 1); assert.equal(view.loadedTaskCount, 200);
  assert.throws(() => build(snapshot({ tasks: [...tasks, task()] }), NOW));
});
test('unloaded room condition leaves task visible with explicit unknown progress', () => {
  const view = build(snapshot({ rooms: [] }), NOW);
  assert.equal(view.unlinkedTasks.length, 1); assert.equal(view.unknownProgressCount, 1); assert.equal(view.counts.in_progress, 0);
  assert.throws(() => build(snapshot({ rooms: [], nextCursor: 'impossible' }), NOW));
});
test('unknown fields, malformed task instants, statuses and permissions fail closed', () => {
  for (const change of [{ progressPercent: 50 }, { allowedActions: ['checkout'] }, { allowedActions: ['start', 'complete'] }, { taskStatus: 'working' }, { dueAt: '2026-02-30T09:00:00Z' }, { completedAt: 'bad' }, { assigned: 'true' }, { priority: -1 }])
    assert.throws(() => build(snapshot({ tasks: [task(change)] }), NOW));
});
test('frozen canonical inputs and allowedActions are preserved without mutation', () => {
  const t = Object.freeze({ ...task(), allowedActions: Object.freeze([]) });
  const input = Object.freeze(snapshot({ rooms: Object.freeze([Object.freeze(room())]), tasks: Object.freeze([t]) }));
  const before = JSON.stringify(input), view = build(input, NOW);
  assert.equal(JSON.stringify(input), before); assert.deepEqual(view.tasks[0].task.allowedActions, []);
  assert.equal(Object.isFrozen(view), true); assert.equal(Object.isFrozen(view.tasks[0].task.allowedActions), true);
});
test('timezone is explicitly supplied; invalid property timezone never falls back', () => {
  assert.match(formatHousekeepingInstant(NOW, 'Asia/Kolkata'), /Oct/);
  for (const tz of [null, '', 'Invalid/Timezone']) assert.throws(() => formatHousekeepingInstant(NOW, tz));
});
test('presentation uses text children, loaded counts, deadline label and unavailable ETA without action controls', () => {
  const hostile = '<script>private</script>';
  const tree = Panel({ snapshot: snapshot({ rooms: [room({ code: hostile })], tasks: [task({ spaceCode: hostile })], nextCursor: 'page2' }), now: NOW, timezone: 'Asia/Kolkata' });
  const text = allText(tree);
  assert.match(text, /1 loaded condition rows/); assert.match(text, /More condition pages remain/); assert.match(text, /Deadline:/);
  assert.match(text, /ETA unavailable/); assert.match(text, /Inspection does not establish occupancy/); assert.match(text, /<script>private<\/script>/);
  assert.equal(tags(tree).includes('button'), false); assert.equal(tags(tree).includes('script'), false);
  assert.equal(JSON.stringify(tree).includes('dangerouslySetInnerHTML'), false);
});
test('invalid clock produces recovery presentation without retaining room or task evidence', () => {
  const tree = Panel({ snapshot: snapshot(), now: null, timezone: 'UTC' });
  assert.equal(tree.props.role, 'alert'); assert.match(allText(tree), /unavailable/); assert.doesNotMatch(allText(tree), /101|in_progress/);
});
