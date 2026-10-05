import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { buildColleagueOperatingJourney } from "../src/demo/operating-journey";
import { buildDemoWorkflowRehearsal } from "../src/demo/workflow-rehearsal";

describe("demo workflow rehearsal", () => {
  test("covers every operating journey workflow without real PMS execution", () => {
    const journey = buildColleagueOperatingJourney();
    const rehearsal = buildDemoWorkflowRehearsal();

    expect(rehearsal.mode).toBe("synthetic-rehearsal-only");
    expect(rehearsal.readyToShare).toBe(false);
    expect(rehearsal.exactConfirmationPhrase).toBe("CONFIRM YELLOW OPERATION");
    expect(rehearsal.coverage.workflowIds).toEqual(journey.workflows.map((workflow) => workflow.id));
    expect(rehearsal.coverage.coveredWorkflowIds).toEqual(journey.workflows.map((workflow) => workflow.id));
    expect(rehearsal.coverage.complete).toBe(true);
    expect(rehearsal.steps).toHaveLength(8);
    expect(rehearsal.steps.every((step) => step.confirmedForRehearsal)).toBe(true);
    expect(rehearsal.steps.every((step) => step.confirmationPhrase === "CONFIRM YELLOW OPERATION")).toBe(true);
    expect(rehearsal.steps.every((step) => step.realPmsExecuted === false)).toBe(true);
    expect(rehearsal.steps.map((step) => step.workflowId)).toEqual([
      "arrival",
      "stay",
      "cashier",
      "housekeeping",
      "group-blocks",
      "group-blocks",
      "checkout",
      "overwatch",
    ]);
    expect(rehearsal.overwatchProof.intent).toBe("check_in");
    expect(rehearsal.overwatchProof.suggestedActionId).toBe("check-in-arrival");
    expect(rehearsal.overwatchProof.executed).toBe(false);
    expect(rehearsal.safety.join(" ")).toContain("No occupancy, folio, journal, payment");
  });

  test("serves the rehearsal through the demo API", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/workflow-rehearsal"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(body.coverage.complete).toBe(true);
    expect(body.steps).toHaveLength(8);
    expect(body.steps.every((step: { realPmsExecuted: boolean }) => step.realPmsExecuted === false)).toBe(true);
  });
});
