import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { buildColleagueDemoScenario } from "../src/demo/colleague-scenario";

describe("colleague demo scenario contract", () => {
  test("builds one ordered colleague walkthrough without claiming readiness", () => {
    const scenario = buildColleagueDemoScenario();

    expect(scenario.status).toBe("not_ready");
    expect(scenario.shareNotificationAllowed).toBe(false);
    expect(scenario.guest.guestName).toBe("Sara Al Harbi");
    expect(scenario.headline.dueIn).toBe(3);
    expect(scenario.headline.occupancyPct).toBe(66.67);
    expect(scenario.steps.map((step) => step.id)).toEqual([
      "open-mobile-shell",
      "review-today-board",
      "review-business-mix",
      "walk-arrival",
      "prove-cashier-safety",
      "review-group-block",
      "walk-checkout",
      "ask-overwatch",
    ]);
  });

  test("keeps every step non-mutating and points at implemented demo routes", () => {
    const scenario = buildColleagueDemoScenario();
    const implementedRoutes = new Set([
      "/",
      "/api/v1/demo/front-desk-board",
      "/api/v1/demo/performance",
      "/api/v1/demo/operating-journey",
      "/api/v1/demo/sandbox/actions/execute",
      "/api/v1/demo/group-blocks/manager",
      "/api/v1/overwatch/message",
    ]);

    for (const step of scenario.steps) {
      expect(implementedRoutes.has(step.route)).toBe(true);
      expect(step.operationalActionsEnabled).toBe(false);
      expect(step.safetyGate).toContain("no real PMS state is changed");
    }
  });

  test("serves the scenario over the public demo API", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/colleague-scenario"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(buildColleagueDemoScenario());
    expect(JSON.stringify(body)).toContain("Configured Gemini key smoke");
  });
});
