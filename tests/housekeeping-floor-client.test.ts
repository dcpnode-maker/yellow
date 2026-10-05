import { describe, expect, test } from "bun:test";
import { createHousekeepingFloorClient, HousekeepingFloorRequestError } from "../frontend/yellow/src/workspaces/housekeeping-floor-client";

const SPACE = "00000000-0000-4000-8000-000000000001";
const TASK = "00000000-0000-4000-8000-000000000002";
const room = { spaceId: SPACE, code: "101", floor: null, condition: "clean", updatedAt: "2026-10-01T12:30:45.123456Z" };
const task = { taskId: TASK, spaceId: SPACE, spaceCode: "101", floor: null, roomCondition: "clean", roomUpdatedAt: room.updatedAt, taskStatus: "assigned", priority: 1, assigned: true, dueAt: null, completedAt: null, allowedActions: ["start"] };
function response(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status }); }

describe("housekeeping floor client", () => {
  test("loads exact-property condition pages with cursor, no-store, current token, and task cap", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = createHousekeepingFloorClient({ propertyId: "property/id", getToken: async () => "current-token", fetcher: async (input, init) => {
      calls.push({ url: String(input), init });
      return String(input).includes("/conditions") ? response({ rooms: [room], nextCursor: "opaque-2" }) : response({ tasks: [task] });
    } });
    const page = await client.conditions(null); const next = await client.conditions(page.page.nextCursor, page.token); const tasks = await client.tasks(page.token);
    expect(page.page.nextCursor).toBe("opaque-2"); expect(next.page.rooms[0]?.updatedAt).toBe(room.updatedAt);
    expect(tasks.tasks[0]?.allowedActions).toEqual(["start"]);
    expect(calls[0]?.url).toContain("/properties/property%2Fid/housekeeping/conditions?limit=100");
    expect(calls[1]?.url).toContain("cursor=opaque-2"); expect(calls[2]?.url).toContain("tasks?limit=200");
    expect(calls.every((call) => call.init?.cache === "no-store" && (call.init?.headers as Record<string, string>).authorization === "Bearer current-token")).toBe(true);
  });
  test("refuses a changed token between pages and non-200, malformed, or unrelated task details", async () => {
    let token = "first";
    const client = createHousekeepingFloorClient({ propertyId: "p", getToken: async () => token, fetcher: async () => response({ rooms: [room], nextCursor: null }) });
    const initial = await client.conditions(null); token = "second";
    await expect(client.conditions("cursor", initial.token)).rejects.toBeInstanceOf(HousekeepingFloorRequestError);
    const denied = createHousekeepingFloorClient({ propertyId: "p", getToken: async () => "t", fetcher: async () => response({}, 403) });
    await expect(denied.tasks()).rejects.toThrow("403");
    const malformed = createHousekeepingFloorClient({ propertyId: "p", getToken: async () => "t", fetcher: async () => response({ tasks: [], extra: true }) });
    await expect(malformed.tasks()).rejects.toThrow();
    const detail = createHousekeepingFloorClient({ propertyId: "p", getToken: async () => "t", fetcher: async () => response({ task: { ...task, taskId: "00000000-0000-4000-8000-000000000003" } }) });
    await expect(detail.task(TASK)).rejects.toThrow();
  });
  test("a delayed response from a prior token scope is discarded", async () => {
    let token = "old-token";
    const pending: Array<(response: Response) => void> = [];
    const client = createHousekeepingFloorClient({ propertyId: "p", getToken: async () => token, fetcher: async () => new Promise<Response>((resolve) => { pending.push(resolve); }) });
    const oldRead = client.conditions(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    token = "new-token";
    const newRead = client.conditions(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    pending[0]?.(response({ rooms: [room], nextCursor: null }));
    pending[1]?.(response({ rooms: [room], nextCursor: null }));
    await expect(oldRead).rejects.toBeInstanceOf(HousekeepingFloorRequestError);
    await expect(newRead).resolves.toMatchObject({ token: "new-token" });
  });
  test("revocation while acquiring a token cannot resurrect or fetch a prior scope", async () => {
    let resolveToken!: (token: string) => void; let fetches = 0;
    const client = createHousekeepingFloorClient({ propertyId: "p", getToken: () => new Promise<string>((resolve) => { resolveToken = resolve; }), fetcher: async () => { fetches++; return response({ rooms: [room], nextCursor: null }); } });
    const pending = client.conditions(null);
    client.invalidateScope(); resolveToken("revoked-token");
    await expect(pending).rejects.toMatchObject({ scopeChanged: true });
    expect(fetches).toBe(0);
  });
  test("revocation during response JSON and token changes after fetch discard evidence", async () => {
    let resolveJSON!: (body: unknown) => void; let token = "actor-A";
    let entered!: () => void; const reading = new Promise<void>((resolve) => { entered = resolve; });
    const client = createHousekeepingFloorClient({ propertyId: "p", getToken: async () => token, fetcher: async () => ({ status: 200, json: () => { entered(); return new Promise((resolve) => { resolveJSON = resolve; }); } }) as Response });
    const pending = client.conditions(null); await reading;
    client.invalidateScope(); resolveJSON({ rooms: [room], nextCursor: null });
    await expect(pending).rejects.toMatchObject({ scopeChanged: true });
    const switched = createHousekeepingFloorClient({ propertyId: "p", getToken: async () => token, fetcher: async () => { token = "actor-B"; return response({ rooms: [room], nextCursor: null }); } });
    await expect(switched.conditions(null)).rejects.toMatchObject({ scopeChanged: true });
  });
  test("snapshot binds both reads to one scope and pagination cannot silently switch actors", async () => {
    let token = "actor-A"; const calls: string[] = [];
    const client = createHousekeepingFloorClient({ propertyId: "p", getToken: async () => token, fetcher: async (input, init) => {
      calls.push((init?.headers as Record<string, string>).authorization);
      return response(String(input).includes("/conditions") ? { rooms: [room], nextCursor: "next" } : { tasks: [task] });
    } });
    const initial = await client.snapshot(); expect(initial.token).toBe("actor-A"); expect(initial.tasks).toHaveLength(1);
    expect(calls).toEqual(["Bearer actor-A", "Bearer actor-A"]);
    token = "actor-B";
    await expect(client.conditions("next")).rejects.toMatchObject({ scopeChanged: true });
    expect(calls).toHaveLength(2);
    await expect(client.task(TASK, initial.token)).rejects.toMatchObject({ scopeChanged: true });
  });
});
