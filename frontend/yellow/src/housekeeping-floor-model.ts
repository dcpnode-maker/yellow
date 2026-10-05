export type RoomCondition = "clean" | "dirty" | "pickup" | "inspected";
export type HousekeepingAction = "start" | "complete" | "verify";
export type RoomConditionRow = Readonly<{
  spaceId: string; code: string; floor: string | null; condition: RoomCondition; updatedAt: string;
}>;
export type HousekeepingTaskRow = Readonly<{
  taskId: string; spaceId: string; spaceCode: string; floor: string | null;
  roomCondition: RoomCondition; roomUpdatedAt: string;
  taskStatus: "assigned" | "in_progress" | "done" | "verified";
  priority: number; assigned: boolean; dueAt: string | null; completedAt: string | null;
  allowedActions: readonly HousekeepingAction[];
}>;
export type ConditionPage = Readonly<{ rooms: readonly RoomConditionRow[]; nextCursor: string | null }>;
export type FloorGroup = Readonly<{ floor: string | null; label: string; rooms: readonly RoomConditionRow[] }>;
export type FloorSnapshot = Readonly<{
  rooms: readonly RoomConditionRow[];
  tasks: readonly HousekeepingTaskRow[];
  floors: readonly FloorGroup[];
  nextCursor: string | null;
  exhausted: boolean;
  tasksMayBeIncomplete: boolean;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/u;
const CONDITIONS = new Set<RoomCondition>(["clean", "dirty", "pickup", "inspected"]);
const ACTIONS = new Set<HousekeepingAction>(["start", "complete", "verify"]);
const TASK_STATUSES = new Set(["assigned", "in_progress", "done", "verified"]);
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort(); const want = [...expected].sort();
  return actual.length === want.length && actual.every((key, i) => key === want[i]);
}
function validInstant(value: unknown): value is string {
  if (typeof value !== "string" || !INSTANT.test(value)) return false;
  const millis = new Date(value).getTime();
  if (!Number.isFinite(millis)) return false;
  const second = value.slice(0, 19) + "Z";
  return new Date(second).toISOString().slice(0, 19) + "Z" === second;
}
function fail(subject: string): never { throw new Error(`${subject} response is incoherent.`); }

export function parseConditionPage(value: unknown): ConditionPage {
  if (!object(value) || !keys(value, ["rooms", "nextCursor"]) || !Array.isArray(value.rooms) || value.rooms.length > 100 ||
      !(value.nextCursor === null || (typeof value.nextCursor === "string" && value.nextCursor.length > 0)) ||
      (value.rooms.length === 0 && value.nextCursor !== null)) return fail("Housekeeping conditions");
  const ids = new Set<string>();
  const rooms = value.rooms.map((raw): RoomConditionRow => {
    if (!object(raw) || !keys(raw, ["spaceId", "code", "floor", "condition", "updatedAt"]) ||
        typeof raw.spaceId !== "string" || !UUID.test(raw.spaceId) || typeof raw.code !== "string" || raw.code.trim().length === 0 ||
        !(raw.floor === null || typeof raw.floor === "string") || !CONDITIONS.has(raw.condition as RoomCondition) || !validInstant(raw.updatedAt)) return fail("Housekeeping room");
    const identity = raw.spaceId.toLowerCase();
    if (ids.has(identity)) return fail("Housekeeping room (repeated identity)");
    ids.add(identity);
    return Object.freeze({ spaceId: raw.spaceId, code: raw.code, floor: raw.floor as string | null,
      condition: raw.condition as RoomCondition, updatedAt: raw.updatedAt });
  });
  return Object.freeze({ rooms: Object.freeze(rooms), nextCursor: value.nextCursor as string | null });
}

export function parseTask(value: unknown): HousekeepingTaskRow {
  const fields = ["taskId", "spaceId", "spaceCode", "floor", "roomCondition", "roomUpdatedAt", "taskStatus", "priority", "assigned", "dueAt", "completedAt", "allowedActions"];
  if (!object(value) || !keys(value, fields) || typeof value.taskId !== "string" || !UUID.test(value.taskId) ||
      typeof value.spaceId !== "string" || !UUID.test(value.spaceId) || typeof value.spaceCode !== "string" || value.spaceCode.trim().length === 0 ||
      !(value.floor === null || typeof value.floor === "string") || !CONDITIONS.has(value.roomCondition as RoomCondition) || !validInstant(value.roomUpdatedAt) ||
      typeof value.taskStatus !== "string" || !TASK_STATUSES.has(value.taskStatus) || !Number.isInteger(value.priority) || (value.priority as number) < 0 || typeof value.assigned !== "boolean" ||
      !(value.dueAt === null || validInstant(value.dueAt)) || !(value.completedAt === null || validInstant(value.completedAt)) ||
      !Array.isArray(value.allowedActions) || value.allowedActions.length > 1 || !value.allowedActions.every((action) => ACTIONS.has(action as HousekeepingAction))) return fail("Housekeeping task");
  return Object.freeze({ taskId: value.taskId, spaceId: value.spaceId, spaceCode: value.spaceCode, floor: value.floor as string | null,
    roomCondition: value.roomCondition as RoomCondition, roomUpdatedAt: value.roomUpdatedAt, taskStatus: value.taskStatus as HousekeepingTaskRow["taskStatus"],
    priority: value.priority as number, assigned: value.assigned, dueAt: value.dueAt as string | null, completedAt: value.completedAt as string | null,
    allowedActions: Object.freeze([...(value.allowedActions as HousekeepingAction[])]) });
}

export function parseTaskPage(value: unknown): readonly HousekeepingTaskRow[] {
  if (!object(value) || !keys(value, ["tasks"]) || !Array.isArray(value.tasks) || value.tasks.length > 200) return fail("Housekeeping tasks");
  const tasks = value.tasks.map(parseTask); const ids = new Set<string>();
  for (const task of tasks) { const identity = task.taskId.toLowerCase(); if (ids.has(identity)) return fail("Housekeeping tasks"); ids.add(identity); }
  return Object.freeze(tasks);
}

export function appendConditionPage(
  prior: Readonly<{ rooms: readonly RoomConditionRow[]; nextCursor: string | null; cursors: ReadonlySet<string> }>,
  page: ConditionPage,
): Readonly<{ rooms: readonly RoomConditionRow[]; nextCursor: string | null; cursors: ReadonlySet<string> }> {
  const ids = new Set(prior.rooms.map((room) => room.spaceId.toLowerCase()));
  for (const room of page.rooms) { const identity = room.spaceId.toLowerCase(); if (ids.has(identity)) return fail("Housekeeping page (repeated room identity)"); ids.add(identity); }
  const cursors = new Set(prior.cursors);
  if (page.nextCursor !== null && (cursors.has(page.nextCursor) || page.nextCursor === prior.nextCursor)) return fail("Housekeeping cursor");
  if (prior.nextCursor === null && prior.rooms.length > 0) return fail("Housekeeping page (already exhausted)");
  if (page.nextCursor !== null) cursors.add(page.nextCursor);
  return Object.freeze({ rooms: Object.freeze([...prior.rooms, ...page.rooms]), nextCursor: page.nextCursor, cursors });
}

export function makeFloorSnapshot(
  rooms: readonly RoomConditionRow[], tasks: readonly HousekeepingTaskRow[], nextCursor: string | null,
): FloorSnapshot {
  const groups = new Map<string, RoomConditionRow[]>();
  for (const room of rooms) { const key = room.floor === null ? "\u0000" : `floor:${room.floor}`; const rows = groups.get(key) ?? []; rows.push(room); groups.set(key, rows); }
  const floors = [...groups.entries()].map(([key, rows]) => ({ floor: key === "\u0000" ? null : key.slice(6), label: key === "\u0000" ? "Floor not recorded" : key.slice(6), rooms: Object.freeze(rows) }))
    .sort((a, b) => a.floor === null ? (b.floor === null ? 0 : 1) : b.floor === null ? -1 : a.floor.localeCompare(b.floor, undefined, { numeric: true }));
  return Object.freeze({ rooms: Object.freeze([...rooms]), tasks: Object.freeze([...tasks]), floors: Object.freeze(floors),
    nextCursor, exhausted: nextCursor === null, tasksMayBeIncomplete: tasks.length >= 200 });
}
