import { expect, test } from "bun:test";

const service = await Bun.file("src/contexts/stay-operations/checkin.ts").text();
const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const migration = await Bun.file("migrations/0096_governed_checkin_room_condition_lock.sql").text();

test("standard check-in distinguishes clean from supervisor-inspected readiness", () => {
  expect(service).toContain('"room_inspection_required"');
  expect(service).toContain('roomCondition === "clean"');
  expect(service).toContain('addBlocker(blockers, "room_inspection_required")');
  expect(service).toContain("public.lock_checkin_room_condition");
  expect(migration).toContain("SECURITY DEFINER");
  expect(migration).toContain("FOR UPDATE OF condition");
  expect(migration).toContain("session_user <> 'yellow_runtime'");
  expect(migration).toContain("current_setting('role', true) IS DISTINCT FROM 'app_role'");
  expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.unit_condition");
  expect(service).not.toContain('roomCondition !== "clean" && roomCondition !== "inspected"');
  expect(app).toContain('const inspectedAssignedRoom = readiness.data?.roomCondition === "inspected";');
  expect(app).toContain("Cleaned · awaiting supervisor inspection");
  expect(app).not.toContain('const cleanAssignedRoom = readiness.data?.roomCondition === "clean" || readiness.data?.roomCondition === "inspected";');
});

test("the retained arrival conversation advances from fresh canonical truth", () => {
  expect(app).toContain("advanceArrivalConversation");
  expect(app).toContain("loadReservation(reservationId)");
  expect(app).toContain("loadCheckInReadiness(reservationId)");
  expect(app).toContain("Supervisor inspection is the next required declaration");
  expect(app).toContain("The next governed Housekeeping step is");
  expect(app).toContain("housekeepingActionCopy(nextAction).button");
  expect(app).toContain("The primary folio is next. Shall I open it now?");
  expect(app).toContain("Every current prerequisite is ready. Shall I complete check-in now?");
  expect(app).toContain("No write was inferred or combined with the completed action");
});

test("each operational step retains its own proposal and confirmation boundary", () => {
  for (const proposal of [
    'kind: "assign"',
    'kind: "cleaning"',
    'kind: "housekeeping"',
    'kind: "folio"',
    'kind: "checkin"',
  ]) expect(app).toContain(proposal);
  expect(app).toContain("setConversationProposal(Object.freeze({ kind: \"folio\" }))");
  expect(app).toContain("setConversationProposal(Object.freeze({ kind: \"checkin\" }))");
  expect(app).toContain("A confirmed arrival action is already in progress");
});
