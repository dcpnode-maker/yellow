import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { buildColleagueDemoProofBundle } from "../src/demo/proof-bundle";

describe("colleague demo proof bundle", () => {
  test("builds a truthful non-share-ready proof bundle from current demo contracts", () => {
    const bundle = buildColleagueDemoProofBundle();

    expect(bundle.product).toBe("Yellow PMS");
    expect(bundle.readyToShare).toBe(false);
    expect(bundle.shareNotificationAllowed).toBe(false);
    expect(bundle.runtime.postgresMajor).toBe(18);
    expect(bundle.runtime.readonlyOrSyntheticOnly).toBe(false);
    expect(bundle.property.code).toBe("YELLOW-DEMO");
    expect(bundle.proved.map((item) => item.id)).toEqual([
      "readiness-truth",
      "simple-hotel-math",
      "synthetic-property-config",
      "front-desk-board",
      "group-block-manager",
      "operating-journey",
      "workflow-rehearsal",
      "action-safety-matrix",
      "confirmation-gate",
      "overwatch-routing",
      "overwatch-ai-rehearsal",
      "sandbox-safety",
    ]);
    expect(bundle.proved.every((item) => item.status === "proved")).toBe(true);
    expect(JSON.stringify(bundle)).toContain("hotel.occupancyPct=66.67");
    expect(JSON.stringify(bundle)).toContain("inventoryRooms=120");
    expect(JSON.stringify(bundle)).toContain("ratePlans=5");
    expect(JSON.stringify(bundle)).toContain("publicDemoMutationMode=governed-proof-routes");
    expect(JSON.stringify(bundle)).toContain("cashier.cashDrawerRequiredForRead=false");
    expect(JSON.stringify(bundle)).toContain("definiteBlock.deductsHouseInventory=true");
    expect(JSON.stringify(bundle)).toContain("allWorkflowActionsDisabled=true");
    expect(JSON.stringify(bundle)).toContain("coverage.complete=true");
    expect(JSON.stringify(bundle)).toContain("allRealPmsExecutedFalse=true");
    expect(JSON.stringify(bundle)).toContain("route=/api/v1/demo/action-safety-matrix");
    expect(JSON.stringify(bundle)).toContain("enabledRealMutations=10");
    expect(JSON.stringify(bundle)).toContain("governedRealMutationFamilies=10");
    expect(JSON.stringify(bundle)).toContain("operational.suggestedActionId=check-in-arrival");
    expect(JSON.stringify(bundle)).toContain("hindi.language=hi-IN");
    expect(JSON.stringify(bundle)).toContain("route=/api/v1/demo/ai-rehearsal");
    expect(JSON.stringify(bundle)).toContain("operational prompts do not call Gemini");
    expect(JSON.stringify(bundle)).toContain("Only the governed housekeeping condition, arrival check-in, cashier charge-posting, cashier settlement, checkout completion, room move, group block status, group pickup, group wash and group rooming-list import commands are enabled");
  });

  test("keeps unproved public mobile and Gemini gates visible", () => {
    const bundle = buildColleagueDemoProofBundle();

    expect(bundle.remainingGates.map((item) => item.id)).toEqual([
      "public-mobile-proof",
      "gemini-live-smoke",
    ]);
    expect(bundle.remainingGates.every((item) => item.status === "remaining")).toBe(true);
    expect(JSON.stringify(bundle)).toContain("Public HTTPS URL and mobile viewport proof are still required");
    expect(JSON.stringify(bundle)).toContain("Configured Gemini smoke is still required");
    expect(JSON.stringify(bundle)).toContain("Public HTTPS URL and mobile viewport proof");
  });

  test("drops the public mobile gate only when public and mobile runtime proof are observed", () => {
    const bundle = buildColleagueDemoProofBundle({ publicAccessObserved: true });

    expect(bundle.readyToShare).toBe(false);
    expect(bundle.remainingGates.map((item) => item.id)).toContain("public-mobile-proof");

    const mobileBundle = buildColleagueDemoProofBundle({ publicAccessObserved: true, mobileProofObserved: true });
    expect(mobileBundle.remainingGates.map((item) => item.id)).not.toContain("public-mobile-proof");
    expect(mobileBundle.remainingGates.map((item) => item.id)).toContain("gemini-live-smoke");
  });

  test("serves the proof bundle through the app with security headers", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/proof-bundle"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(body.readyToShare).toBe(false);
    expect(body.runtime.proofRoute).toBe("/api/v1/demo/proof-bundle");
    expect(body.proved).toHaveLength(12);
    expect(body.remainingGates).toHaveLength(2);
  });
});
