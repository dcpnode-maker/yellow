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

describe("Order230 arrival cleaning-task check-in continuity presentation", () => {
  test("renders one native semantic task-detail return control only from frozen arrival context", () => {
    const render = functionSource("renderHousekeepingTaskDetailArrivalReturn");
    const state = functionSource("arrivalCleaningCheckInReturnFromState");

    expect(render).toContain('node("button", "quiet housekeeping-arrival-return housekeeping-task-detail-arrival-return"');
    expect(render).toContain("rebaseArrivalCleaningCheckInReturn(task)");
    expect(render).toContain("returning.taskId");
    expect(render).toContain('action.type = "button"');
    expect(render).toContain('action.setAttribute("aria-label"');
    expect(render).toContain('action.addEventListener("click"');
    expect(state).toContain('state?.yellowSurface !== "housekeeping-task-detail"');
    expect(state).toContain('value.blocker !== "dirty_room_override_unauthorized"');
    expect(state).toContain("Object.keys(value).sort()");
    expect(state).toContain("Object.freeze");
  });

  test("labels working truth as Back to arrival and only exact done plus clean as continuation", () => {
    const render = functionSource("renderHousekeepingTaskDetailArrivalReturn");

    expect(render).toContain('task.taskStatus === "done"');
    expect(render).toContain('task.roomCondition === "clean"');
    expect(render).toContain('"Continue check-in preparation"');
    expect(render).toContain('"Back to arrival"');
    expect(render).not.toMatch(/task\.taskStatus\s*===\s*"(?:assigned|in_progress)"\s*\?\s*"Continue check-in preparation"/);
    expect(render).not.toMatch(/roomCondition\s*!==\s*"(?:dirty|pickup)"\s*\?\s*"Continue check-in preparation"/);
  });

  test("both exact Order229 openings carry the same task-bound descriptor without adopting generic detail", () => {
    const arrival = functionSource("renderArrivalRoomCleaningTask");
    const open = functionSource("openHousekeepingTaskDetail");
    const sync = functionSource("syncHousekeepingRoute");

    expect(arrival).toContain("arrivalCleaningCheckInReturnDescriptor(origin, state.candidate.existingTaskId)");
    expect(arrival).toContain("arrivalCleaningCheckInReturnDescriptor(origin, value.taskId)");
    expect(open).toContain("arrivalReturn");
    expect(open).toContain("arrivalCleaningCheckInReturnFromState");
    expect(sync).toContain("arrivalCleaningCheckInReturnFromState");
    expect(sync).not.toMatch(/roomCondition\s*===\s*"(?:dirty|pickup)"[^}]{0,300}arrivalCleaningCheckInReturnDescriptor/s);
  });

  test("deliberate activation returns through canonical check-in preparation without running a command", () => {
    const render = functionSource("renderHousekeepingTaskDetailArrivalReturn");
    const activate = functionSource("returnFromArrivalCleaningTaskToCheckIn");
    const returning = functionSource("returnFromHousekeepingToCheckIn");
    const restore = functionSource("restoreCheckInHousekeepingArrivalFocus");

    expect(render).toContain("returnFromArrivalCleaningTaskToCheckIn");
    expect(activate).toContain('setView("reservations", false)');
    expect(activate).toContain('openReservationDetail(returning.reservationId, { push: false, workbench: "check-in" })');
    expect(returning).toContain('setView("reservations", false)');
    expect(returning).toContain("reservationDrawerReturnReservationId");
    expect(returning).toContain("history.back()");
    expect(restore).toContain("checkInHeading");
    expect(restore).toContain("focus({ preventScroll: true })");

    const presentation = [
      functionSource("arrivalCleaningCheckInReturnDescriptor"),
      functionSource("arrivalCleaningCheckInReturnFromState"),
      render,
      activate,
    ].join("\n");
    expect(presentation).not.toMatch(/submitCheckIn|submitHousekeepingTaskDetailAction|method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
    expect(presentation).not.toMatch(/readiness\s*(?:===|!==)|checkInReadinessData|\.click\(\)/);
    expect(presentation).not.toMatch(/setInterval|setTimeout|localStorage|sessionStorage|indexedDB/);
  });

  test("reuses the established bounded 44px control and Android raises it to 48px", () => {
    const render = functionSource("renderHousekeepingTaskDetailArrivalReturn");
    expect(render).toContain("housekeeping-arrival-return housekeeping-task-detail-arrival-return");
    expect(css).toContain(".checkin-housekeeping-action,.housekeeping-arrival-return { min-width: 0; min-height: 44px; max-width: 100%;");
    expect(css).toContain("white-space: normal");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain(':root[data-theme="android"] .checkin-housekeeping-action,:root[data-theme="android"] .housekeeping-arrival-return { min-height: 48px;');
    expect(css).toContain("@media (max-width: 420px)");
    expect(css).toContain(".checkin-housekeeping-action,.housekeeping-arrival-return { width: 100%; }");
  });

  test("preserves native material in all six appearances without changing semantics", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .checkin-housekeeping-action`);
      expect(css).toContain(`:root[data-theme="${theme}"] .housekeeping-arrival-return`);
    }
    expect(css).toContain('font-family: "MS Sans Serif"');
    expect(css).toContain("backdrop-filter: blur(20px) saturate(170%)");
    expect(css).toContain("box-shadow: -5px -5px 12px #fff,5px 5px 12px #bec8cd");
  });

  test("keeps visible keyboard focus, reduced motion and forced-colour boundaries", () => {
    expect(css).toContain(".checkin-housekeeping-action:focus-visible,.housekeeping-arrival-return:focus-visible { outline: 3px solid var(--focus);");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .checkin-housekeeping-action,.housekeeping-arrival-return { animation: none; transition: none; transform: none; } }");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain(".housekeeping-arrival-return { border: 2px solid ButtonText; background: ButtonFace; color: ButtonText;");
    expect(css).toContain(".housekeeping-arrival-return:focus-visible { outline: 3px solid Highlight; }");
  });
});
