import { expect, test } from "bun:test";
import type { AuthSessionAccess, AuthSnapshot } from "../frontend/yellow/src/auth-session";
import type { HousekeepingAction, HousekeepingTaskRow } from "../frontend/yellow/src/housekeeping-floor-model";
import { createHousekeepingTaskClient, HOUSEKEEPING_RECOVERY_KEY, makeHousekeepingCommand, parseHousekeepingReceipt,
  readRetainedHousekeeping, retainHousekeeping, type HousekeepingCommand } from "../frontend/yellow/src/workspaces/native-housekeeping-task-client";

export const ids = { property: "00000000-0000-4000-8000-000000000001", tenant: "00000000-0000-4000-8000-000000000002",
  actor: "00000000-0000-4000-8000-000000000003", task: "00000000-0000-4000-8000-000000000004",
  space: "00000000-0000-4000-8000-000000000005", other: "00000000-0000-4000-8000-000000000006" };
export const stamp = "2026-10-03T08:00:00.000Z";
export function fixtureTask(action: HousekeepingAction = "start"): HousekeepingTaskRow {
  return { taskId: ids.task, spaceId: ids.space, spaceCode: "101", floor: "1", roomCondition: action === "verify" ? "clean" : "dirty",
    roomUpdatedAt: stamp, taskStatus: action === "start" ? "assigned" : action === "complete" ? "in_progress" : "done", priority: 1,
    assigned: true, dueAt: null, completedAt: action === "verify" ? stamp : null, allowedActions: [action] };
}
export function fixtureReceipt(command: HousekeepingCommand, replayed = false) {
  return { taskId: command.task.taskId, spaceId: command.task.spaceId, action: command.action,
    taskStatus: command.action === "start" ? "in_progress" : command.action === "complete" ? "done" : "verified",
    roomCondition: command.action === "start" ? command.task.roomCondition : command.action === "complete" ? "clean" : "inspected",
    roomUpdatedAt: command.action === "start" ? command.task.roomUpdatedAt : "2026-10-03T08:01:00.000Z",
    completedAt: command.action === "start" ? null : command.action === "verify" ? command.task.completedAt : "2026-10-03T08:01:00.000Z",
    replayed, allowedActions: command.action === "start" && ["dirty", "pickup"].includes(command.task.roomCondition) ? ["complete"] : [] };
}
export function fixtureAuth() {
  let snapshot: AuthSnapshot = { status: "authenticated", principal: { actorId: ids.actor, tenantId: ids.tenant, displayName: "Synthetic staff" },
    properties: [{ id: ids.property, name: "Synthetic property", timezone: "UTC" }] };
  let token = "synthetic-memory-only", granted = true;
  const listeners = new Set<() => void>();
  const auth: AuthSessionAccess = { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    session: async () => { if (snapshot.status !== "authenticated") throw new Error("expired"); return token; },
    grantedProperties: async () => granted ? snapshot.properties : [], signIn: async () => snapshot, bootstrap: async () => snapshot, logout: async () => {} };
  return { auth, change(change: Partial<AuthSnapshot>, nextToken = token) { snapshot = { ...snapshot, ...change }; token = nextToken; listeners.forEach(fn => fn()); },
    denyProperty() { granted = false; } };
}
const principal = { actorId: ids.actor, tenantId: ids.tenant };
const commandFor = (action: HousekeepingAction = "start") => makeHousekeepingCommand(ids.property, principal, fixtureTask(action), action);

test("native action/body and raw receipt match each guarded progression, never granting inspection from complete", () => {
  for (const action of ["start", "complete", "verify"] as const) {
    const command = commandFor(action), task = fixtureTask(action);
    expect(JSON.parse(command.body)).toEqual({ action, expectedTaskStatus: task.taskStatus, expectedRoomCondition: task.roomCondition, expectedRoomUpdatedAt: stamp });
    expect(Object.isFrozen(command.task.allowedActions)).toBe(true);
    const receipt = parseHousekeepingReceipt(fixtureReceipt(command), command, "false");
    expect(receipt.taskStatus).toBe(action === "start" ? "in_progress" : action === "complete" ? "done" : "verified");
    if (action !== "start") expect(receipt.allowedActions).toEqual([]);
    expect(() => parseHousekeepingReceipt({ transition: fixtureReceipt(command) }, command, "false")).toThrow();
    for (const malformed of [{ taskId: ids.other }, { spaceId: ids.other }, { action: "checkout" }, { taskStatus: "assigned" },
      { replayed: "true" }, { allowedActions: ["verify"] }, { allowedActions: [null] }, { roomUpdatedAt: "2026-02-30T10:00:00.000Z" }, { unexpected: true }])
      expect(() => parseHousekeepingReceipt({ ...fixtureReceipt(command), ...malformed }, command, "false")).toThrow();
    expect(() => parseHousekeepingReceipt(fixtureReceipt(command), command, "true")).toThrow();
  }
  const verify = commandFor("verify");
  expect(() => parseHousekeepingReceipt({ ...fixtureReceipt(verify), completedAt: "2026-10-03T08:02:00.000Z" }, verify, "false")).toThrow();
  expect(() => commandFor("finish" as HousekeepingAction)).toThrow();
  expect(() => makeHousekeepingCommand(ids.property, principal, { ...fixtureTask(), roomUpdatedAt: "2026-10-03T08:00:00.000001Z" }, "start")).toThrow();
});

test("lost successful verify replays exact retained key/body BEFORE detail read, despite verified GET 404", async () => {
  const fixture = fixtureAuth(), command = commandFor("verify"), requests: { path: string; body?: string | null; key?: string | null }[] = [];
  let outcome: ReturnType<typeof fixtureReceipt> | null = null, sends = 0;
  const client = createHousekeepingTaskClient({ propertyId: ids.property, auth: fixture.auth, transport: async (path, init) => {
    requests.push({ path, body: init?.body as string | undefined, key: new Headers(init?.headers).get("idempotency-key") });
    if (init?.method !== "POST") return Response.json(outcome ? {} : { task: command.task }, { status: outcome ? 404 : 200 });
    sends++; if (!outcome) { outcome = fixtureReceipt(command); throw new Error("Lost successful response"); }
    return Response.json({ ...outcome, replayed: true }, { headers: { "idempotency-replayed": "true" } });
  } });
  try {
    await expect(client.execute(command, false, () => {})).rejects.toThrow("interrupted");
    const afterLoss = requests.length;
    expect((await client.execute(command, true, () => {})).taskStatus).toBe("verified");
    expect(requests.slice(afterLoss)).toHaveLength(1); expect(requests.at(-1)?.path).toEndWith("/transition");
    expect(requests.at(-1)?.body).toBe(command.body); expect(requests.at(-1)?.key).toBe(command.key); expect(sends).toBe(2);
  } finally { client.dispose(); }
});

test("stale unsent truth prevents a write; uncertain/denied/conflicting sent outcomes retain original identity", async () => {
  for (const status of [200, 401, 403, 404, 409, 500, 503]) {
    const fixture = fixtureAuth(), command = commandFor(), writes: string[] = [];
    const client = createHousekeepingTaskClient({ propertyId: ids.property, auth: fixture.auth, transport: async (_path, init) => {
      if (init?.method !== "POST") return Response.json({ task: { ...command.task, taskStatus: "in_progress", allowedActions: ["complete"] } });
      writes.push(init.body as string); return Response.json({}, { status });
    } });
    try {
      await expect(client.execute(command, false, () => {})).rejects.toThrow("changed before"); expect(writes).toHaveLength(0);
      await expect(client.execute(command, true, () => {})).rejects.toThrow(); expect(writes).toEqual([command.body]);
      expect(command.key).toStartWith("yellow-housekeeping-");
    } finally { client.dispose(); }
  }
});

test("current principal, fresh property grant and session epoch fence old responses without adopting commands", async () => {
  const fixture = fixtureAuth(), command = commandFor(); let writes = 0;
  let release: (() => void) | null = null;
  const client = createHousekeepingTaskClient({ propertyId: ids.property, auth: fixture.auth, transport: async () => {
    writes++; await new Promise<void>(resolve => { release = resolve; });
    return Response.json(fixtureReceipt(command), { headers: { "idempotency-replayed": "false" } });
  } });
  try {
    const pending = client.execute(command, true, () => {});
    while (!release) await Bun.sleep(1);
    fixture.change({ status: "expired" }); fixture.change({ status: "authenticated" }, "renewed-memory-only");
    (release as () => void)(); await expect(pending).rejects.toThrow("access changed");
    fixture.change({ principal: { ...principal, actorId: ids.other, displayName: "Foreign" } });
    await expect(client.execute(command, true, () => {})).rejects.toThrow("access changed"); expect(writes).toBe(1);
    fixture.change({ principal: { ...principal, displayName: "Original" } }); fixture.denyProperty();
    await expect(client.execute(command, true, () => {})).rejects.toThrow("access changed"); expect(writes).toBe(1);
  } finally { client.dispose(); }
});

test("reload reminder validates exact schema/body and quarantines legacy/tampered data; stores no credential", () => {
  const map = new Map<string, string>(), storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } };
  const command = commandFor("verify");
  expect(readRetainedHousekeeping(storage)).toEqual({ state: "none" }); retainHousekeeping(storage, command);
  expect(readRetainedHousekeeping(storage)).toEqual({ state: "sent", command });
  expect(map.get(HOUSEKEEPING_RECOVERY_KEY)).not.toMatch(/Bearer|password|synthetic-memory-only|accessToken/);
  expect(() => retainHousekeeping(storage, commandFor())).toThrow();
  for (const corrupt of ["legacy", JSON.stringify({ ...command, version: 0 }), JSON.stringify({ ...command, body: "{}" }),
    JSON.stringify({ ...command, principal: { ...principal, token: "credential" } })]) {
    storage.setItem(HOUSEKEEPING_RECOVERY_KEY, corrupt); expect(readRetainedHousekeeping(storage)).toEqual({ state: "quarantined" });
    expect(() => retainHousekeeping(storage, command)).toThrow();
  }
});
