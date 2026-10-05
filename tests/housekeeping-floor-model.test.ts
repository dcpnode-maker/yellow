import { describe, expect, test } from "bun:test";
import { appendConditionPage, makeFloorSnapshot, parseConditionPage, parseTask, parseTaskPage } from "../frontend/yellow/src/housekeeping-floor-model";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const room = (n: number, floor: string | null = "2", code = `R${n}`) => ({ spaceId: id(n), code, floor, condition: "clean", updatedAt: "2026-10-01T12:30:45.123456Z" });
const task = (taskId: number, spaceId: string, extra: Record<string, unknown> = {}) => ({ taskId: id(taskId), spaceId, spaceCode: "R1", floor: "2", roomCondition: "dirty", roomUpdatedAt: "2026-10-01T12:30:45.123456Z", taskStatus: "assigned", priority: 1, assigned: true, dueAt: null, completedAt: null, allowedActions: ["start"], ...extra });

describe("housekeeping floor model", () => {
  test("validates and appends bounded pages beyond 100 with exact room identity and microsecond timestamps", () => {
    let pageState = appendConditionPage({ rooms: [], nextCursor: null, cursors: new Set<string>() }, parseConditionPage({ rooms: Array.from({ length: 100 }, (_, i) => room(i + 1)), nextCursor: "cursor-1" }));
    pageState = appendConditionPage(pageState, parseConditionPage({ rooms: Array.from({ length: 5 }, (_, i) => room(i + 101)), nextCursor: null }));
    expect(pageState.rooms).toHaveLength(105);
    expect(pageState.rooms[0]?.updatedAt).toBe("2026-10-01T12:30:45.123456Z");
    expect(makeFloorSnapshot(pageState.rooms, [], pageState.nextCursor).exhausted).toBe(true);
  });
  test("groups exact nullable and text floors and matches tasks only by space id", () => {
    const rooms = [parseConditionPage({ rooms: [room(1, null, "101"), room(2, "Mezzanine", "101")], nextCursor: null }).rooms[0]!,
      parseConditionPage({ rooms: [room(2, "Mezzanine", "101")], nextCursor: null }).rooms[0]!];
    const tasks = parseTaskPage({ tasks: [task(10, id(1)), task(11, id(1)), task(12, id(99))] });
    const model = makeFloorSnapshot(rooms, tasks, null);
    expect(model.floors.map((f) => f.label)).toEqual(["Mezzanine", "Floor not recorded"]);
    expect(model.floors[0]?.rooms).toHaveLength(1);
    expect(model.tasks.filter((t) => t.spaceId === rooms[0]?.spaceId)).toHaveLength(2);
    expect(model.tasks.filter((t) => t.spaceId === rooms[1]?.spaceId)).toHaveLength(0);
  });
  test("rejects repeated rooms, cursor cycles, malformed rows, and duplicate task identities", () => {
    const first = parseConditionPage({ rooms: [room(1)], nextCursor: "c1" });
    const state = appendConditionPage({ rooms: [], nextCursor: null, cursors: new Set<string>() }, first);
    expect(() => appendConditionPage(state, parseConditionPage({ rooms: [room(1)], nextCursor: "c2" }))).toThrow();
    expect(() => appendConditionPage(state, parseConditionPage({ rooms: [room(2)], nextCursor: "c1" }))).toThrow();
    expect(() => parseConditionPage({ rooms: [{ ...room(1), updatedAt: "2026-02-31T12:30:45Z" }], nextCursor: null })).toThrow();
    expect(() => parseTaskPage({ tasks: [task(5, id(1)), task(5, id(2))] })).toThrow();
  });
  test("retains the server action allowlist and explicitly exposes the 200-task limit", () => {
    const tasks = parseTaskPage({ tasks: Array.from({ length: 200 }, (_, i) => task(i + 1, id(i + 500))) });
    expect(makeFloorSnapshot([], tasks, null).tasksMayBeIncomplete).toBe(true);
    expect(() => parseTask({ ...task(1, id(1)), allowedActions: ["verify", "complete"] })).toThrow();
    expect(() => parseTaskPage({ tasks: Array.from({ length: 201 }, (_, i) => task(i + 1, id(i + 500))) })).toThrow();
  });
  test("rejects duplicate identities inside a page, oversized and empty nonterminal pages, and coerced status", () => {
    for (const rooms of [[room(1), room(1)], Array.from({ length: 101 }, (_, i) => room(i + 1))])
      expect(() => parseConditionPage({ rooms, nextCursor: null })).toThrow();
    expect(() => parseConditionPage({ rooms: [], nextCursor: "next" })).toThrow();
    expect(() => parseTask(task(1, id(1), { taskStatus: { toString: () => "assigned" } }))).toThrow();
    expect(parseConditionPage({ rooms: [{ ...room(1), spaceId: "00000000-0000-0000-0000-000000000000" }], nextCursor: null }).rooms).toHaveLength(1);
  });
});
