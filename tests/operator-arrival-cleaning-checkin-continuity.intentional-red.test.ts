import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

function functionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing existing function ${name}`);
  const opening = script.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = opening; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

describe("Order230 intentional red: arrival cleaning-task check-in continuity", () => {
  test("contextual task detail does not yet carry the frozen arrival descriptor or return action", () => {
    expect(script.includes("arrivalCleaningCheckInReturnFromState")).toBe(true);
    expect(script.includes("housekeeping-task-detail-arrival-return")).toBe(true);
    expect(script.includes("Continue check-in preparation")).toBe(true);
  });

  test("both exact Order229 existing-task and created-task paths do not yet admit the descriptor", () => {
    const render = functionSource("renderArrivalRoomCleaningTask");

    expect(render.includes(
      "arrivalCleaningCheckInReturnDescriptor(origin, state.candidate.existingTaskId)",
    )).toBe(true);
    expect(render.includes(
      "arrivalCleaningCheckInReturnDescriptor(origin, value.taskId)",
    )).toBe(true);
  });
});
