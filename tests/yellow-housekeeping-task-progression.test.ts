import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const styles = await Bun.file("frontend/yellow/src/styles.css").text();

test("exposes the governed housekeeping transition only through current task truth", () => {
  for (const marker of [
    "loadHousekeepingTask",
    "transitionHousekeepingTask",
    "/housekeeping/tasks/${task.taskId}/transition",
    "expectedTaskStatus: task.taskStatus",
    "expectedRoomCondition: task.roomCondition",
    "expectedRoomUpdatedAt: task.roomUpdatedAt",
    '"idempotency-key": idempotencyKey',
    "housekeepingTaskMatchesProposal",
    "validateHousekeepingTransitionReceipt",
    "validateHousekeepingTask",
    "HOUSEKEEPING_TASK_KEYS",
    "HOUSEKEEPING_RECEIPT_KEYS",
  ]) expect(app).toContain(marker);
  expect(app).not.toContain("UPDATE unit_condition");
  expect(app).not.toContain("UPDATE task SET");
});

test("manual housekeeping actions remain proposal then separate confirmation", () => {
  for (const marker of [
    "Housekeeping action proposal",
    "No room or task changes have been made.",
    "I confirm the physical housekeeping statement above.",
    "Confirm housekeeping action",
    "Physical cleaning is never inferred",
    "allowedActions.map",
  ]) expect(app).toContain(marker);
  expect(styles).toContain(".housekeeping-action-proposal");
  expect(styles).toContain(".housekeeping-task-action { min-height: 44px;");
  expect(app).toContain('className="housekeeping-task-action"');
  expect(styles).toContain(".housekeeping-action-proposal .proposal-actions button { min-height: 44px;");
  expect(styles).toContain(".housekeeping-action-proposal .confirmation { min-height: 44px;");
  expect(app).toContain("A granted operator records the staff declaration");
  expect(app).not.toContain("The assigned attendant has begun physical cleaning.");
  expect(app).not.toContain("must complete and inspect the room before check-in can continue");
});

test("the active arrival retains one superseding housekeeping proposal", () => {
  for (const marker of [
    'kind: "housekeeping"',
    "housekeepingTaskActionIntent(conversationCommand.text)",
    "commandAuthorityGeneration !== conversationAuthority.current",
    "The task changed before confirmation",
    "This action records a staff declaration",
    "Physical cleaning and supervisor inspection remain distinct",
  ]) expect(app).toContain(marker);
});

test("success follows complete receipt validation and authoritative refresh", () => {
  const validation = app.indexOf("function validateHousekeepingTransitionReceipt");
  const refresh = app.indexOf("await refresh();", validation);
  expect(validation).toBeGreaterThan(-1);
  expect(app).toContain("receipt.taskId !== expected.taskId");
  expect(app).toContain("receipt.spaceId !== expected.spaceId");
  expect(app).toContain("receipt.action !== action");
  expect(app).toContain('typeof receipt.replayed !== "boolean"');
  expect(app).toContain('expected.roomCondition === "dirty" || expected.roomCondition === "pickup"');
  expect(app).toContain("housekeepingFailureIsUncertain");
  expect(app).toContain("same operation key");
  expect(app).toContain("housekeepingTaskReflectsAction");
  expect(refresh).toBeGreaterThan(validation);
});

test("confirmed housekeeping work owns the shared assistant mutation lock", () => {
  expect(app).toContain("onLifecycleBusyChange: (busy: boolean) => void;");
  expect(app).toContain("onLifecycleBusyChange={setReservationLifecycleFlight}");
  const childFlight = app.indexOf("conversationInFlight.current = true;");
  const childLock = app.indexOf("onLifecycleBusyChange(true);", childFlight);
  const childAwait = app.indexOf("await loadReservation", childFlight);
  expect(childFlight).toBeGreaterThan(-1);
  expect(childLock).toBeGreaterThan(childFlight);
  expect(childLock).toBeLessThan(childAwait);

  const manualSubmit = app.indexOf("const submit = async () =>");
  const manualLock = app.indexOf("onLifecycleBusyChange(true);", manualSubmit);
  const manualAwait = app.indexOf("await loadHousekeepingTask", manualSubmit);
  expect(manualLock).toBeGreaterThan(manualSubmit);
  expect(manualLock).toBeLessThan(manualAwait);
  expect(app).toContain("reservationLifecycleBusyRef.current ||");
});
