import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

function functionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const opening = script.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = opening; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

describe("Order229 exact dirty-arrival cleaning-task UI", () => {
  test("admits only the exact current dirty-room override blocker and server candidate", () => {
    const open = functionSource("openArrivalRoomCleaningTask");
    expect(open).toContain('returning.blocker !== "dirty_room_override_unauthorized"');
    expect(open).toContain("returning.assignedSpaceId");
    expect(open).toContain("returning !== checkInHousekeepingReturn");
    expect(open).toContain('activeView !== "housekeeping"');
    expect(open).toContain("/arrival-room-cleaning-task/candidate");
    expect(open).toContain("arrivalRoomCleaningTaskRequestGeneration");
    expect(open).toContain("arrivalRoomCleaningTaskIsCurrent");
    expect(open).not.toMatch(/room_condition_missing|room_not_ready/);
  });

  test("currentness binds return identity, route, property, exact blocker, section and live slot", () => {
    const current = functionSource("arrivalRoomCleaningTaskIsCurrent");
    for (const proof of [
      "origin?.returning === checkInHousekeepingReturn",
      'origin.blocker === "dirty_room_override_unauthorized"',
      "origin.reservationId === checkInHousekeepingReturn?.reservationId",
      "origin.assignedSpaceId === checkInHousekeepingReturn?.assignedSpaceId",
      "origin.property === propertySelect.value",
      'activeView === "housekeeping"',
      'location.pathname === `/p/${origin.property}/housekeeping`',
      'location.search === ""',
      "arrivalRoomCleaningTaskRequest?.origin === origin",
      "arrivalRoomCleaningTaskRequest?.section === section",
      "section?.isConnected",
      "housekeepingConditionInitializationSlot.contains(section)",
    ]) expect(current).toContain(proof);
  });

  test("candidate parsing accepts only minimized matching room truth and existing task identity", () => {
    const result = functionSource("arrivalRoomCleaningCandidateResult");
    expect(result).toContain('JSON.stringify(keys) !== JSON.stringify(["canCreate", "candidate"])');
    for (const key of [
      "dueAt", "existingTaskId", "reservationId", "roomCondition", "spaceCode", "spaceId",
    ]) expect(result).toContain(`"${key}"`);
    expect(result).toContain("candidate.reservationId !== origin.reservationId");
    expect(result).toContain("candidate.spaceId !== origin.assignedSpaceId");
    expect(result).toContain('candidate.roomCondition !== "dirty"');
    expect(result).toContain('candidate.roomCondition !== "pickup"');
    expect(result).toContain("candidate.existingTaskId !== null");
    expect(result).toContain("canonicalUuid(candidate.existingTaskId)");
  });

  test("renders either existing-task continuity or deliberate active-staff selection and creation", () => {
    const render = functionSource("renderArrivalRoomCleaningTask");
    expect(render).toContain('section.setAttribute("aria-label", "Arrival room cleaning task")');
    expect(render).toContain('status.setAttribute("role", "status")');
    expect(render).toContain('status.setAttribute("aria-live", "polite")');
    expect(render).toContain('node("button", "primary arrival-room-cleaning-task-open", "Open cleaning task")');
    expect(render).toContain("openHousekeepingTaskDetail(state.candidate.existingTaskId");
    expect(render).toContain('node("form", "arrival-room-cleaning-task-form")');
    expect(render).toContain('query.type = "search"');
    expect(render).toContain('query.autocomplete = "off"');
    expect(render).toContain('node("button", "secondary", "Search staff")');
    expect(render).toContain('node("button", "primary", "Create cleaning task")');
    expect(render).toContain('profile.roles.includes("staff")');
    expect(render).toContain("create.disabled = true");
    expect(render).toContain("create.disabled = false");
    expect(render).not.toMatch(/checked\s*=|selectedIndex|defaultValue|infer(?:red)?\s+(?:staff|attendant)/i);
  });

  test("submission retains one unchanged retry key, locks controls and sends only attendant identity", () => {
    const render = functionSource("renderArrivalRoomCleaningTask");
    expect(render).toContain("arrivalRoomCleaningTaskAttempt?.draft === draft");
    expect(render).toContain("{ draft, key: crypto.randomUUID() }");
    expect(render).toContain('form.querySelectorAll("button,input")');
    expect(render).toContain("control.disabled = true");
    expect(render).toContain('method: "POST"');
    expect(render).toContain('headers: { "Idempotency-Key": arrivalRoomCleaningTaskAttempt.key }');
    expect(render).toContain("body: JSON.stringify({ attendantPartyId: attendant.partyId })");
    expect(render).toContain("arrivalRoomCleaningTaskAttempt = null");
    expect(render).toContain("await loadHousekeepingBoard()");
    expect(render).toContain("await openHousekeepingTaskDetail(value.taskId");
    expect(render).not.toMatch(/roomCondition\s*:|spaceId\s*:|actorId\s*:|tenantId\s*:|propertyNode\s*:/);
  });

  test("Housekeeping entry chooses the exact contextual control and adds no browser storage or polling", () => {
    const setView = functionSource("setView");
    expect(setView).toContain('arrivalReturn?.blocker === "room_condition_missing"');
    expect(setView).toContain('arrivalReturn?.blocker === "dirty_room_override_unauthorized"');
    expect(setView).toContain("openArrivalRoomCleaningTask(arrivalReturn)");
    expect(setView).toContain("restoreCheckInHousekeepingRoomFocus(arrivalReturn)");

    const bounded = [
      functionSource("arrivalRoomCleaningTaskIsCurrent"),
      functionSource("arrivalRoomCleaningCandidateResult"),
      functionSource("renderArrivalRoomCleaningTask"),
      functionSource("openArrivalRoomCleaningTask"),
      functionSource("clearArrivalRoomCleaningTask"),
    ].join("\n");
    expect(bounded).not.toMatch(/setInterval|setTimeout|localStorage|sessionStorage|indexedDB|EventSource|WebSocket/);
    expect(bounded).not.toMatch(/record_occupancy|release_occupancy|submitCheckIn|roomCondition\s*=|condition\s*=\s*"(?:clean|inspected)"/);
  });

  test("contains at phone zoom with dedicated material in all six appearances", () => {
    expect(css).toContain(".arrival-room-cleaning-task { min-width: 0;");
    expect(css).toContain(".arrival-room-cleaning-task-form { min-width: 0;");
    expect(css).toContain(".arrival-room-cleaning-task-form button, .arrival-room-cleaning-task-open { min-height: 44px;");
    expect(css).toContain(':root[data-theme="android"] .arrival-room-cleaning-task :is(button,input) { min-height: 48px;');
    for (const appearance of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${appearance}"] .arrival-room-cleaning-task`);
    }
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .arrival-room-cleaning-task");
    expect(css).toContain("@media (forced-colors: active) { .arrival-room-cleaning-task");
    expect(css).toContain(".arrival-room-cleaning-task-form { grid-template-columns: minmax(0,1fr);");
  });
});
