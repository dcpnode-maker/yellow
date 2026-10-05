import { expect, test } from "bun:test";
const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const client = await Bun.file("frontend/yellow/src/workspaces/native-housekeeping-task-client.ts").text();
const workspace = await Bun.file("frontend/yellow/src/workspaces/HousekeepingTaskWorkspace.tsx").text();
const wrapper = app.slice(app.indexOf("function HousekeepingAppWorkspace("), app.indexOf("type DepartmentPerformanceMatrixProps"));
const contains = (source: string, markers: readonly string[]) => { for (const marker of markers) expect(source.includes(marker), marker).toBe(true); };

test("exposes the governed housekeeping transition only through current task truth", () => {
  contains(client, ["makeHousekeepingCommand", "expectedTaskStatus: task.taskStatus", "expectedRoomCondition: task.roomCondition",
    "expectedRoomUpdatedAt: task.roomUpdatedAt", '"idempotency-key": command.key', "body: command.body", "parseHousekeepingReceipt",
    "fresh.taskId !== expected.taskId", "fresh.spaceId !== expected.spaceId", "fresh.taskStatus !== expected.taskStatus",
    "fresh.roomCondition !== expected.roomCondition", "fresh.roomUpdatedAt !== expected.roomUpdatedAt", "if (!sent)"]);
  expect(client).not.toContain("UPDATE unit_condition"); expect(client).not.toContain("UPDATE task SET");
  expect(app).not.toContain("function HousekeepingWorkspace(");
  expect(app.match(/<HousekeepingAppWorkspace propertyId=\{propertyId\}/g)).toHaveLength(2);
  contains(wrapper, ['auth={reactAuthSession}', 'onNativeReceipt={onNativeReceipt}']);
});
test("manual housekeeping actions remain proposal then separate confirmation", () => {
  contains(workspace, ["client.prepare(task, action)", "setConfirmed(false)", "I confirm this staff declaration.",
    "I confirm reconciliation of this retained command.", "Confirm declaration", "Cancel declaration", "disabled={busy || !confirmed}",
    "if (!active || !confirmed || lockedRef.current || running.current || !storage) return;",
    "Staff declarations update native task and room condition records.", "Inspection remains one prerequisite for governed check-in."]);
  contains(client, ["!task.allowedActions.includes(action)", 'task.roomCondition !== "clean"']);
  expect(workspace).not.toContain("The assigned attendant has begun physical cleaning.");
  expect(workspace).not.toContain("must complete and inspect the room before check-in can continue");
  contains(app, ["A granted operator records the staff declaration", "Physical cleaning and supervisor inspection remain distinct"]);
});
test("the active arrival retains one superseding housekeeping proposal", () => {
  for (const marker of ['kind: "housekeeping"', "housekeepingTaskActionIntent(conversationCommand.text)",
    "commandAuthorityGeneration !== conversationAuthority.current", "The task changed before confirmation",
    "This action records a staff declaration", "Physical cleaning and supervisor inspection remain distinct"]) expect(app).toContain(marker);
});
test("success follows complete receipt validation and authoritative refresh", () => {
  contains(client, ["raw.taskId !== task.taskId", "raw.spaceId !== task.spaceId", "raw.action !== action",
    'typeof raw.replayed !== "boolean"', "replayHeader !== String(raw.replayed)", "raw.allowedActions.some",
    "return parseHousekeepingReceipt(raw, command", "await scope.check();"]);
  const execute = workspace.indexOf("const known = await client.execute(");
  const fence = workspace.indexOf("if (!mounted.current || operation.current !== current || lockedRef.current) return;", execute);
  const settle = workspace.indexOf("storage.removeItem(HOUSEKEEPING_RECOVERY_KEY)", execute);
  const callback = workspace.indexOf("onNativeReceipt?.(known)", execute);
  const refresh = workspace.indexOf("await refreshReceipt(known, current)", execute);
  expect(execute).toBeGreaterThan(-1); expect(fence).toBeGreaterThan(execute);
  expect(settle).toBeGreaterThan(fence); expect(callback).toBeGreaterThan(settle); expect(refresh).toBeGreaterThan(callback);
  contains(workspace, ["The outcome is unresolved.", "The same key and body will be replayed before any task reread",
    "The native operation receipt is verified; current floor refresh failed.", "Retry floor read"]);
  contains(wrapper, ["Promise.allSettled", 'queryKey: ["overwatch-arrival-cleaning", propertyId]', 'queryKey: ["overwatch-check-in", propertyId]']);
  expect(wrapper.match(/invalidateQueries/g)).toHaveLength(2);
});
test("confirmed housekeeping work owns the shared assistant mutation lock", () => {
  contains(app, ["onLifecycleBusyChange: (busy: boolean) => void;", "onLifecycleBusyChange={setReservationLifecycleFlight}", "reservationLifecycleBusyRef.current ||"]);
  const childFlight = app.indexOf("conversationInFlight.current = true;");
  const childLock = app.indexOf("onLifecycleBusyChange(true);", childFlight);
  const childAwait = app.indexOf("await loadReservation", childFlight);
  expect(childFlight).toBeGreaterThan(-1); expect(childLock).toBeGreaterThan(childFlight); expect(childLock).toBeLessThan(childAwait);
  const manualSubmit = workspace.indexOf("const submit = async () =>");
  const manualLock = workspace.indexOf("running.current = true; setBusy(true)", manualSubmit);
  const manualAwait = workspace.indexOf("await client.execute", manualSubmit);
  expect(manualLock).toBeGreaterThan(manualSubmit); expect(manualLock).toBeLessThan(manualAwait);
  contains(workspace, ["busy || Boolean(intent?.sent)", "onLifecycleBusyChange?.(navigationLocked)", "event.preventDefault(); event.returnValue"]);
  contains(wrapper, ['data-lifecycle-recovery="true"', "onLifecycleBusyChange={onLifecycleBusyChange}"]);
});
