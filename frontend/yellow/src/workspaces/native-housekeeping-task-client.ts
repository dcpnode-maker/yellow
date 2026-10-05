import type { AuthSessionAccess, SessionPrincipal } from "../auth-session";
import { parseTask, type HousekeepingAction, type HousekeepingTaskRow, type RoomCondition } from "../housekeeping-floor-model";

type Transport = (url: string, init?: RequestInit) => Promise<Response>;
export type HousekeepingCommand = Readonly<{
  version: 1; propertyId: string; principal: Readonly<{ actorId: string; tenantId: string }>;
  task: HousekeepingTaskRow; action: HousekeepingAction; key: string; body: string;
}>;
export type HousekeepingReceipt = Readonly<{
  taskId: string; spaceId: string; taskStatus: "in_progress" | "done" | "verified";
  roomCondition: RoomCondition; roomUpdatedAt: string; completedAt: string | null;
  action: HousekeepingAction; replayed: boolean; allowedActions: readonly HousekeepingAction[];
}>;
export class HousekeepingCommandError extends Error {
  constructor(message: string, readonly accessChanged = false, readonly status: number | null = null) {
    super(message); this.name = "HousekeepingCommandError";
  }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: object, fields: string[]) => Object.keys(v).sort().join("|") === [...fields].sort().join("|");
const canonical = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(v) &&
  Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const samePrincipal = (a: Pick<SessionPrincipal, "actorId" | "tenantId">, b: Pick<SessionPrincipal, "actorId" | "tenantId">) =>
  a.actorId === b.actorId && a.tenantId === b.tenantId;
const fail = (): never => { throw new HousekeepingCommandError("The retained housekeeping command is invalid. Manual review is required."); };

export function makeHousekeepingCommand(propertyId: string, principal: Pick<SessionPrincipal, "actorId" | "tenantId">,
  raw: HousekeepingTaskRow, action: HousekeepingAction, key = `yellow-housekeeping-${crypto.randomUUID()}`): HousekeepingCommand {
  const task = parseTask(raw);
  const status = action === "start" ? "assigned" : action === "complete" ? "in_progress" : action === "verify" ? "done" : null;
  if (!UUID.test(propertyId) || !UUID.test(principal.actorId) || !UUID.test(principal.tenantId) ||
      !/^yellow-housekeeping-[0-9a-f-]{36}$/u.test(key) || !UUID.test(key.slice(20)) ||
      !status || task.taskStatus !== status || !canonical(task.roomUpdatedAt) || !task.allowedActions.includes(action) ||
      (action === "start" && (!task.assigned || task.completedAt !== null)) ||
      (action === "complete" && (!["dirty", "pickup"].includes(task.roomCondition) || task.completedAt !== null)) ||
      (action === "verify" && (task.roomCondition !== "clean" || !canonical(task.completedAt)))) return fail();
  return Object.freeze({ version: 1, propertyId, principal: Object.freeze({ actorId: principal.actorId, tenantId: principal.tenantId }),
    task, action, key, body: JSON.stringify({ action, expectedTaskStatus: task.taskStatus,
      expectedRoomCondition: task.roomCondition, expectedRoomUpdatedAt: task.roomUpdatedAt }) });
}

// Storage is an untrusted, credential-free reminder of ONE sent command, never authorization.
export const HOUSEKEEPING_RECOVERY_KEY = "yellow.housekeeping.sent.v1";
export type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type RetainedCommand = Readonly<{ state: "none" }> | Readonly<{ state: "quarantined" }> |
  Readonly<{ state: "sent"; command: HousekeepingCommand }>;
export function readRetainedHousekeeping(storage: RecoveryStorage): RetainedCommand {
  try {
    const value = storage.getItem(HOUSEKEEPING_RECOVERY_KEY);
    if (value === null) return { state: "none" };
    if (value.length > 12000) return { state: "quarantined" };
    const raw: unknown = JSON.parse(value);
    if (!object(raw) || !keys(raw, ["version", "propertyId", "principal", "task", "action", "key", "body"]) || raw.version !== 1 ||
        !object(raw.principal) || !keys(raw.principal, ["actorId", "tenantId"]) || typeof raw.principal.actorId !== "string" ||
        typeof raw.principal.tenantId !== "string" || typeof raw.propertyId !== "string" || typeof raw.key !== "string") return { state: "quarantined" };
    const command = makeHousekeepingCommand(raw.propertyId, { actorId: raw.principal.actorId, tenantId: raw.principal.tenantId },
      parseTask(raw.task), raw.action as HousekeepingAction, raw.key);
    return raw.body === command.body ? { state: "sent", command } : { state: "quarantined" };
  } catch { return { state: "quarantined" }; }
}
export function retainHousekeeping(storage: RecoveryStorage, command: HousekeepingCommand): void {
  const prior = readRetainedHousekeeping(storage);
  if (prior.state === "quarantined" || (prior.state === "sent" && JSON.stringify(prior.command) !== JSON.stringify(command))) return fail();
  storage.setItem(HOUSEKEEPING_RECOVERY_KEY, JSON.stringify(command));
  const confirmed = readRetainedHousekeeping(storage);
  if (confirmed.state !== "sent" || JSON.stringify(confirmed.command) !== JSON.stringify(command)) return fail();
}

export function parseHousekeepingReceipt(raw: unknown, command: HousekeepingCommand, replayHeader: string | null): HousekeepingReceipt {
  const { task, action } = command;
  const status = action === "start" ? "in_progress" : action === "complete" ? "done" : "verified";
  const condition = action === "start" ? task.roomCondition : action === "complete" ? "clean" : "inspected";
  const allowed = action === "start" && ["dirty", "pickup"].includes(task.roomCondition) ? ["complete"] : [];
  if (!object(raw) || !keys(raw, ["taskId", "taskStatus", "spaceId", "roomCondition", "roomUpdatedAt", "completedAt", "action", "replayed", "allowedActions"]) ||
      raw.taskId !== task.taskId || raw.spaceId !== task.spaceId || raw.action !== action || raw.taskStatus !== status ||
      raw.roomCondition !== condition || !canonical(raw.roomUpdatedAt) || typeof raw.replayed !== "boolean" ||
      replayHeader !== String(raw.replayed) || !Array.isArray(raw.allowedActions) || raw.allowedActions.length !== allowed.length ||
      raw.allowedActions.some((value, index) => value !== allowed[index]) ||
      (action === "start" && (raw.roomUpdatedAt !== task.roomUpdatedAt || raw.completedAt !== null)) ||
      (action !== "start" && !canonical(raw.completedAt)) || (action === "verify" && raw.completedAt !== task.completedAt)) {
    throw new HousekeepingCommandError("The native receipt could not be verified. Keep the same command for reconciliation.");
  }
  return Object.freeze({ taskId: task.taskId, spaceId: task.spaceId, action, taskStatus: status, roomCondition: condition,
    roomUpdatedAt: raw.roomUpdatedAt, completedAt: raw.completedAt as string | null, replayed: raw.replayed,
    allowedActions: Object.freeze([...allowed] as HousekeepingAction[]) });
}

export function createHousekeepingTaskClient(options: Readonly<{ propertyId: string; auth: AuthSessionAccess; transport?: Transport }>) {
  const transport = options.transport ?? fetch;
  let epoch = 0, disposed = false;
  let unsubscribe: (() => void) | null = null;
  const activate = () => { disposed = false; unsubscribe ??= options.auth.subscribe(() => { epoch++; }); };
  const changed = () => new HousekeepingCommandError("Housekeeping access changed. Sign in with the original account and property to reconcile.", true);
  function principal(): SessionPrincipal {
    const snapshot = options.auth.getSnapshot();
    if (disposed || !UUID.test(options.propertyId) || snapshot.status !== "authenticated" || !snapshot.principal ||
        !UUID.test(snapshot.principal.actorId) || !UUID.test(snapshot.principal.tenantId) ||
        !snapshot.properties.some(p => p.id === options.propertyId)) throw changed();
    return snapshot.principal;
  }
  async function capture(command?: HousekeepingCommand) {
    if (disposed) throw changed();
    activate();
    const version = epoch, identity = principal();
    if (command && (command.propertyId !== options.propertyId || !samePrincipal(command.principal, identity))) throw changed();
    let token: string;
    try { token = await options.auth.session(); } catch { throw changed(); }
    const assert = () => { if (epoch !== version || !samePrincipal(principal(), identity)) throw changed(); };
    assert();
    let grants;
    try { grants = await options.auth.grantedProperties(); }
    catch (cause) {
      if (cause && typeof cause === "object" && "status" in cause && [401, 403, 404].includes(Number(cause.status))) throw changed();
      throw new HousekeepingCommandError("Current property access could not be verified; no new command is authorized.");
    }
    assert();
    if (!grants.some(p => p.id === options.propertyId) || !token || await options.auth.session() !== token) throw changed();
    assert();
    return { token, identity, assert, async check() { assert(); if (await options.auth.session() !== token) throw changed(); assert(); } };
  }
  return Object.freeze({
    async token(): Promise<string> { return (await capture()).token; },
    async prepare(task: HousekeepingTaskRow, action: HousekeepingAction): Promise<HousekeepingCommand> {
      const scope = await capture(); await scope.check();
      return makeHousekeepingCommand(options.propertyId, scope.identity, task, action);
    },
    async execute(command: HousekeepingCommand, sent: boolean, beforeSend: () => void): Promise<HousekeepingReceipt> {
      // Validate immutable body even for in-memory callers. Never regenerate a replay body/key.
      const validated = makeHousekeepingCommand(command.propertyId, command.principal, command.task, command.action, command.key);
      if (command.body !== validated.body) return fail();
      const scope = await capture(command);
      if (!sent) {
        const read = await transport(`/api/v1/properties/${encodeURIComponent(command.propertyId)}/housekeeping/tasks/${encodeURIComponent(command.task.taskId)}`,
          { cache: "no-store", headers: { authorization: `Bearer ${scope.token}` } });
        await scope.check();
        if (read.status !== 200) throw new HousekeepingCommandError(`Current task could not be verified (${read.status}); nothing was sent.`, [401, 403, 404].includes(read.status), read.status);
        const raw: unknown = await read.json(); await scope.check();
        if (!object(raw) || !keys(raw, ["task"])) throw new HousekeepingCommandError("Current task response is incoherent; nothing was sent.");
        const fresh = parseTask(raw.task), expected = command.task;
        if (fresh.taskId !== expected.taskId || fresh.spaceId !== expected.spaceId || fresh.taskStatus !== expected.taskStatus ||
            fresh.roomCondition !== expected.roomCondition || fresh.roomUpdatedAt !== expected.roomUpdatedAt ||
            fresh.completedAt !== expected.completedAt || fresh.assigned !== expected.assigned || fresh.spaceCode !== expected.spaceCode ||
            fresh.floor !== expected.floor || !fresh.allowedActions.includes(command.action)) {
          throw new HousekeepingCommandError("Task or room evidence changed before confirmation; nothing was sent. Refresh and review again.");
        }
      }
      await scope.check(); beforeSend(); scope.assert();
      let response: Response;
      try { response = await transport(`/api/v1/properties/${encodeURIComponent(command.propertyId)}/housekeeping/tasks/${encodeURIComponent(command.task.taskId)}/transition`,
        { method: "POST", cache: "no-store", headers: { authorization: `Bearer ${scope.token}`, "content-type": "application/json", "idempotency-key": command.key }, body: command.body }); }
      catch { scope.assert(); throw new HousekeepingCommandError("The response was interrupted. The sent command is retained; reconcile the same request."); }
      await scope.check();
      if (response.status !== 200) throw new HousekeepingCommandError(`The sent command remains unresolved (${response.status}). Denial or a missing task does not prove the earlier attempt made no change.`, [401, 403, 404].includes(response.status), response.status);
      let raw: unknown;
      try { raw = await response.json(); } catch { throw new HousekeepingCommandError("The native receipt was incomplete. The sent command remains retained."); }
      await scope.check();
      return parseHousekeepingReceipt(raw, command, response.headers.get("idempotency-replayed"));
    },
    activate,
    dispose() { disposed = true; epoch++; unsubscribe?.(); unsubscribe = null; },
  });
}
