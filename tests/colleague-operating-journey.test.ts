import { describe, expect, it } from "bun:test";

import { app } from "../src/app";
import { buildColleagueOperatingJourney, type ColleagueOperatingJourney } from "../src/demo/operating-journey";

function allActions(journey: ColleagueOperatingJourney) {
  return journey.workflows.flatMap((workflow) => workflow.actions);
}

describe("colleague operating journey", () => {
  it("covers the required PMS demo workflow areas in one deterministic journey", () => {
    const journey = buildColleagueOperatingJourney();

    expect(journey.property.code).toBe("YELLOW-DEMO");
    expect(journey.guestScenario.reservationCode).toBe("L3R-HX-0126");
    expect(journey.workflows.map((workflow) => workflow.id)).toEqual([
      "arrival",
      "stay",
      "cashier",
      "housekeeping",
      "group-blocks",
      "checkout",
      "overwatch",
    ]);
    for (const workflow of journey.workflows) {
      expect(workflow.purpose.length).toBeGreaterThan(40);
      expect(workflow.currentState.length).toBeGreaterThan(0);
      expect(workflow.actions.length).toBeGreaterThan(0);
    }
  });

  it("keeps every operational action confirmation-gated and execution-disabled", () => {
    const actions = allActions(buildColleagueOperatingJourney());

    expect(actions.length).toBeGreaterThan(10);
    for (const action of actions) {
      expect(action.operationalMutation).toBe(true);
      expect(action.requiresConfirmation).toBe(true);
      expect(action.confirmationPhrase).toBe("CONFIRM YELLOW OPERATION");
      expect(action.executionEnabled).toBe(false);
      expect(action.reasonExecutionDisabled).toContain("read-only");
    }
  });

  it("connects the group-block workbench into the operating journey", () => {
    const journey = buildColleagueOperatingJourney();

    expect(journey.groupBlocks).toHaveLength(2);
    expect(journey.groupBlocks[0]?.code).toBe("YCC-0926");
    expect(journey.groupBlocks[0]?.totals.pickedUp).toBe(28);
    expect(journey.workflows.find((workflow) => workflow.id === "group-blocks")?.currentState.join(" ")).toContain("YCC-0926");
  });

  it("serves the journey through the public demo API", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/operating-journey"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual(buildColleagueOperatingJourney());
  });
});
