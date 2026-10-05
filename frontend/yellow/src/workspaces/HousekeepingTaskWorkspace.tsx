import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { reactAuthSession, type AuthSessionAccess } from "../auth-session";
import type { HousekeepingAction, HousekeepingTaskRow, RoomConditionRow } from "../housekeeping-floor-model";
import { HousekeepingFloorWorkbench } from "./HousekeepingFloorWorkbench";
import { createHousekeepingFloorClient, HousekeepingFloorRequestError } from "./housekeeping-floor-client";
import { createHousekeepingTaskClient, HOUSEKEEPING_RECOVERY_KEY, HousekeepingCommandError, readRetainedHousekeeping,
  retainHousekeeping, type HousekeepingCommand, type HousekeepingReceipt, type RecoveryStorage } from "./native-housekeeping-task-client";
import "./housekeeping-task-workspace.css";

type Intent = Readonly<{ command: HousekeepingCommand; sent: boolean }>;
export type HousekeepingTaskWorkspaceProps = Readonly<{
  propertyId: string; timezone: string; auth?: AuthSessionAccess;
  transport?: (url: string, init?: RequestInit) => Promise<Response>;
  recoveryStorage?: RecoveryStorage;
  onLifecycleBusyChange?: (locked: boolean) => void;
  onNativeReceipt?: (receipt: HousekeepingReceipt) => void;
}>;
const copy = { start: "Start cleaning", complete: "Mark physically clean", verify: "Verify inspected" } as const;
const browserStorage = (): RecoveryStorage | undefined => { try { return typeof window === "undefined" ? undefined : window.sessionStorage; } catch { return undefined; } };

export function HousekeepingTaskWorkspace({ propertyId, timezone, auth = reactAuthSession, transport, recoveryStorage,
  onLifecycleBusyChange, onNativeReceipt }: HousekeepingTaskWorkspaceProps) {
  const snapshot = useSyncExternalStore(auth.subscribe, auth.getSnapshot, auth.getSnapshot);
  const storage = useMemo(() => recoveryStorage ?? browserStorage(), [recoveryStorage]);
  const [recovery] = useState(() => storage ? readRetainedHousekeeping(storage) : { state: "quarantined" } as const);
  const [intent, setIntent] = useState<Intent | null>(() => recovery.state === "sent" ? { command: recovery.command, sent: true } : null);
  const intentRef = useRef(intent); intentRef.current = intent;
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null), [receipt, setReceipt] = useState<HousekeepingReceipt | null>(null);
  const receiptOwner = useRef<HousekeepingCommand | null>(null);
  const [room, setRoom] = useState<RoomConditionRow | null>(null), [readFailed, setReadFailed] = useState(false);
  const [refreshGeneration, setRefreshGeneration] = useState(0), [revision, setRevision] = useState(0);
  const [blockedAt, setBlockedAt] = useState<number | null>(null);
  const revisionRef = useRef(revision); revisionRef.current = revision;
  const operation = useRef(0), running = useRef(false), mounted = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const client = useMemo(() => createHousekeepingTaskClient({ propertyId, auth, transport }), [propertyId, auth, transport]);
  const command = intent?.command;
  const foreign = Boolean(command && (command.propertyId !== propertyId || !snapshot.principal ||
    command.principal.actorId !== snapshot.principal.actorId || command.principal.tenantId !== snapshot.principal.tenantId));
  const locked = recovery.state === "quarantined" || foreign || snapshot.status !== "authenticated" ||
    !snapshot.properties.some(p => p.id === propertyId) || blockedAt === revision;
  const lockedRef = useRef(locked); lockedRef.current = locked;
  const navigationLocked = busy || Boolean(intent?.sent) || recovery.state === "quarantined";
  const navigationRef = useRef(navigationLocked); navigationRef.current = navigationLocked;
  const acceptedHref = useRef(typeof location === "undefined" ? "" : location.href);
  const wasNavigationLocked = useRef(false);
  useEffect(() => {
    if (navigationLocked && !wasNavigationLocked.current) acceptedHref.current = location.href;
    wasNavigationLocked.current = navigationLocked;
  }, [navigationLocked]);

  useEffect(() => {
    mounted.current = true; client.activate(); setBusy(false);
    return () => { mounted.current = false; operation.current++; running.current = false; client.dispose(); };
  }, [client]);
  useEffect(() => auth.subscribe(() => {
    operation.current++; running.current = false; setBusy(false);
    setRoom(null); setReceipt(null); setConfirmed(false); setRevision(v => v + 1);
  }), [auth]);
  useEffect(() => { onLifecycleBusyChange?.(navigationLocked); }, [onLifecycleBusyChange, navigationLocked]);
  useEffect(() => { if (intent && !locked) heading.current?.focus(); }, [intent, locked]);
  useEffect(() => {
    // Coalesce after the browser dispatch task, including listeners registered by the shell.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observe = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        if (navigationRef.current) history.pushState(null, "", acceptedHref.current);
        else acceptedHref.current = location.href;
      }, 0);
    };
    const unload = (event: BeforeUnloadEvent) => { if (navigationRef.current) { event.preventDefault(); event.returnValue = ""; } };
    const link = (event: MouseEvent) => {
      if (navigationRef.current && event.target instanceof Element && event.target.closest("a[href]")) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    window.addEventListener("popstate", observe); window.addEventListener("beforeunload", unload);
    document.addEventListener("click", link, true);
    return () => { if (timer !== undefined) clearTimeout(timer); window.removeEventListener("popstate", observe);
      window.removeEventListener("beforeunload", unload); document.removeEventListener("click", link, true); };
  }, []);
  // Every floor read reacquires the verified session and property grant; identity changes remount the read-only floor.
  const getToken = useCallback(() => client.token(), [client, revision]);

  const prepare = async (task: HousekeepingTaskRow, action: HousekeepingAction) => {
    if (lockedRef.current || running.current || intentRef.current) return;
    const current = ++operation.current; running.current = true; setBusy(true); setMessage(null);
    try {
      const prepared = await client.prepare(task, action);
      if (!mounted.current || operation.current !== current || lockedRef.current) return;
      setReceipt(null); setRoom(null); setReadFailed(false); setConfirmed(false);
      const next = { command: prepared, sent: false }; intentRef.current = next; setIntent(next);
    } catch (cause) {
      if (mounted.current && operation.current === current) {
        setMessage(cause instanceof Error ? cause.message : "The task could not be prepared.");
        if (cause instanceof HousekeepingCommandError && cause.accessChanged) setBlockedAt(revisionRef.current);
      }
    } finally { if (mounted.current && operation.current === current) { running.current = false; setBusy(false); } }
  };
  const refreshReceipt = async (known: HousekeepingReceipt, current: number) => {
    const reader = createHousekeepingFloorClient({ propertyId, getToken, fetcher: transport as typeof fetch | undefined });
    try {
      const result = await reader.snapshot();
      if (!mounted.current || operation.current !== current || lockedRef.current) return;
      setRoom(result.page.rooms.find(r => r.spaceId === known.spaceId) ?? null);
      setReadFailed(false); setRefreshGeneration(v => v + 1);
      setMessage("The native operation receipt is verified. The floor is a separate current observation.");
    } catch (cause) {
      if (!mounted.current || operation.current !== current) return;
      setReadFailed(true); setRoom(null); setMessage("The native operation receipt is verified; current floor refresh failed. Retry the read without sending another command.");
      if (cause instanceof HousekeepingFloorRequestError && (cause.scopeChanged || [401, 403, 404].includes(cause.status ?? 0))) setBlockedAt(revisionRef.current);
    } finally { reader.invalidateScope(); }
  };
  const submit = async () => {
    const active = intentRef.current;
    if (!active || !confirmed || lockedRef.current || running.current || !storage) return;
    const current = ++operation.current; running.current = true; setBusy(true); setMessage(null);
    try {
      const known = await client.execute(active.command, active.sent, () => {
        retainHousekeeping(storage, active.command);
        const sent = { command: active.command, sent: true }; intentRef.current = sent; setIntent(sent);
      });
      if (!mounted.current || operation.current !== current || lockedRef.current) return;
      // A valid receipt settles the operation, even when a verified task is absent from subsequent GETs.
      storage.removeItem(HOUSEKEEPING_RECOVERY_KEY);
      intentRef.current = null; setIntent(null); setConfirmed(false); receiptOwner.current = active.command; setReceipt(known);
      // Parent cache invalidation is a consequence of a verified operation, never another command.
      // A presentation callback failure cannot revoke a native receipt or reopen its sent intent.
      try { onNativeReceipt?.(known); } catch { /* The verified receipt and independent floor read remain available. */ }
      await refreshReceipt(known, current);
    } catch (cause) {
      if (!mounted.current || operation.current !== current) return;
      setConfirmed(false); setMessage(cause instanceof Error ? cause.message : "The command remains unresolved.");
      if (cause instanceof HousekeepingCommandError && cause.accessChanged) setBlockedAt(revisionRef.current);
    } finally { if (mounted.current && operation.current === current) { running.current = false; setBusy(false); } }
  };
  const retryRead = async () => {
    if (!receipt || running.current || lockedRef.current) return;
    const current = ++operation.current; running.current = true; setBusy(true);
    try { await refreshReceipt(receipt, current); }
    finally { if (mounted.current && operation.current === current) { running.current = false; setBusy(false); } }
  };

  if (locked) return <section className="hk-task-workspace hk-task-locked" aria-labelledby="hk-task-locked-title">
    <h1 id="hk-task-locked-title">Housekeeping access locked</h1>
    <p>{recovery.state === "quarantined" ? "A retained record is invalid or storage is unavailable. It is quarantined; review is required before starting another command." :
      foreign ? "The original account and property must return. Another account cannot adopt this work." : "Restore authorized access with the original account and property."}</p>
    <p>Sent work is retained. Denial, expiry and a missing task do not prove that an earlier command made no change.</p>
  </section>;
  return <section className="hk-task-workspace" aria-label="Housekeeping task workspace">
    <header><span className="eyebrow">ROOM OPERATIONS</span><h1>Housekeeping</h1>
      <p>Staff declarations update native task and room condition records. Inspection remains one prerequisite for governed check-in.</p></header>
    <HousekeepingFloorWorkbench key={`${propertyId}:${snapshot.principal?.tenantId}:${snapshot.principal?.actorId}:${revision}`} propertyId={propertyId} timezone={timezone} getToken={getToken}
      disabled={busy || Boolean(intent)} refreshGeneration={refreshGeneration} onPrepare={(task, action) => { void prepare(task, action); }} />
    {intent ? <section className="hk-task-confirm" aria-labelledby="hk-task-confirm-title">
      <h2 id="hk-task-confirm-title" ref={heading} tabIndex={-1}>{intent.sent ? "Reconcile retained command" : copy[intent.command.action]}</h2>
      <p>Room {intent.command.task.spaceCode} · {intent.command.task.taskStatus} · {intent.command.task.roomCondition}</p>
      {intent.sent ? <p className="hk-task-warning">The outcome is unresolved. The same key and body will be replayed before any task reread, even if the task has disappeared. No replacement command is available.</p> :
        <p>Current task evidence will be checked before sending your declaration.</p>}
      <details><summary>Command details</summary><p>Task: {intent.command.task.taskId}</p><p>Condition recorded: {intent.command.task.roomUpdatedAt}</p>
        <p>Operation: {intent.command.key}</p></details>
      <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />
        {intent.sent ? "I confirm reconciliation of this retained command." : "I confirm this staff declaration."}</label>
      <div className="hk-task-actions"><button type="button" disabled={busy || !confirmed} onClick={() => void submit()}>
        {busy ? "Checking native state…" : intent.sent ? "Reconcile same request" : "Confirm declaration"}</button>
        {!intent.sent ? <button type="button" disabled={busy} onClick={() => { intentRef.current = null; setIntent(null); setConfirmed(false); setMessage(null); }}>Cancel declaration</button> : null}</div>
    </section> : null}
    {message ? <p role="status" className="hk-task-message">{message}</p> : null}
    {receipt && receiptOwner.current?.propertyId === propertyId && receiptOwner.current.principal.actorId === snapshot.principal?.actorId &&
      receiptOwner.current.principal.tenantId === snapshot.principal?.tenantId ? <section className="hk-task-receipt" aria-label="Native operation receipt"><h2>Verified operation receipt</h2>
      <p>{receipt.taskStatus} · {receipt.roomCondition}{receipt.replayed ? " · native replay" : ""}</p>
      <p>Receipt condition recorded: {receipt.roomUpdatedAt}</p>
      {receipt.completedAt ? <p>Cleaning completion recorded: {receipt.completedAt}</p> : null}
      <p>{room ? `Current observed room condition: ${room.condition} · ${room.updatedAt}` : "Current room condition is not available in this read."}</p>
      {readFailed ? <button type="button" disabled={busy} onClick={() => void retryRead()}>Retry floor read</button> : null}
    </section> : null}
    <details className="hk-task-limits"><summary>Recovery and capability limits</summary>
      <p>A sent command is retained in this browser tab without credentials. Reopening the same tab requires the original account and property plus fresh server authorization. Closing the tab, storage loss or another device may lose this reminder. Native durable command recovery is incomplete; an expired replay record requires manual resolution.</p>
      <p>ETA, comments, voice declarations, stay preferences and general room-condition editing need further native contracts.</p></details>
  </section>;
}
