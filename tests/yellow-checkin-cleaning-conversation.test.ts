import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();

test("keeps one governed cleaning-task proposal inside the live check-in journey", () => {
  for (const marker of [
    "loadArrivalCleaningCandidate",
    "createArrivalCleaningTask",
    'kind: "cleaning"',
    "resolveArrivalCleaningAttendant",
    "That exact Party is not an active staff profile",
    "More than one active staff profile matches",
    "No change has been made. Shall I create this exact cleaning task?",
    "The cleaning-task candidate changed before confirmation",
    "An actionable cleaning task already exists",
    "Physical cleaning and inspection still belong to Housekeeping",
    '["overwatch-arrival-cleaning", propertyId, reservationId]',
    "commandGeneration !== conversationGeneration.current",
    "commandAuthorityGeneration !== conversationAuthority.current",
    "conversationAuthority={assistantOperationGeneration}",
    "The arrival cleaning-task receipt was incoherent.",
  ]) expect(app).toContain(marker);
});

test("uses only candidate refresh and the existing governed task endpoint", () => {
  expect(app).toContain("/arrival-room-cleaning-task/candidate");
  expect(app).toContain("/arrival-room-cleaning-task`,");
  expect(app).toContain('"idempotency-key": idempotencyKey');
  expect(app).not.toContain("markRoomClean");
  expect(app).not.toContain("completeHousekeepingTask");
});

test("routes the cleaning instruction into the active arrival and withdraws stale authority before lookup", () => {
  const outer = app.indexOf("const cleaningAttendantInstruction = activeArrival");
  const dispatch = app.indexOf("setArrivalConversation({ id: crypto.randomUUID(), text: message });", outer);
  const outerClear = app.indexOf("setGuestAllocationProposal(null);", outer);
  expect(outer).toBeGreaterThan(-1);
  expect(outerClear).toBeGreaterThan(outer);
  expect(outerClear).toBeLessThan(dispatch);

  const instruction = app.indexOf("const cleaningAttendantQuery");
  const proposalClear = app.indexOf("setConversationProposal(null);", instruction);
  const lookup = app.indexOf("await searchPartyProfiles(cleaningAttendantQuery)", instruction);
  expect(proposalClear).toBeGreaterThan(instruction);
  expect(proposalClear).toBeLessThan(lookup);

  const sharedAuthority = app.indexOf("const renderedConversationAuthority = conversationAuthority.current");
  const authorityClear = app.indexOf("setConversationProposal(null);", sharedAuthority);
  const childLookup = app.indexOf("await searchPartyProfiles(cleaningAttendantQuery)", sharedAuthority);
  const crossFlowGuard = app.indexOf("commandAuthorityGeneration !== conversationAuthority.current", childLookup);
  expect(sharedAuthority).toBeGreaterThan(-1);
  expect(authorityClear).toBeGreaterThan(sharedAuthority);
  expect(authorityClear).toBeLessThan(childLookup);
  expect(crossFlowGuard).toBeGreaterThan(childLookup);
});

test("validates the complete task receipt before reporting success", () => {
  for (const marker of [
    "created.taskId",
    "created.dueAt !== actual.dueAt",
    'typeof created.created !== "boolean"',
    'typeof created.replayed !== "boolean"',
    "The arrival cleaning-task receipt was incoherent.",
  ]) expect(app).toContain(marker);
  const receipt = app.indexOf('if (\n            !/^[0-9a-f]{8}');
  const refreshed = app.indexOf("await refresh();", receipt);
  const success = app.indexOf("The cleaning task is created", receipt);
  expect(receipt).toBeGreaterThan(-1);
  expect(refreshed).toBeGreaterThan(receipt);
  expect(refreshed).toBeLessThan(success);
});
