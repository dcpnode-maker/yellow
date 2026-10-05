import { expect, test } from "bun:test";

import { PROJECT_BUILD_SNAPSHOT } from "../src/project-status";

test("Order464 status preserves the verified Order444 preview without claiming current activation or Phase7 completion", () => {
  expect(PROJECT_BUILD_SNAPSHOT.schemaVersion).toBe(2);
  expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-12");
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.latestBuiltOrder).toBe(464);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.currentOrder).toBe(460);
  expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBe(91);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.activePhase).toBe(7);
  const mergedDelivery = PROJECT_BUILD_SNAPSHOT.recordedWork.find(({ order }) => order === 440);
  expect(mergedDelivery?.state).toBe("proof_in_progress");
  expect(mergedDelivery?.summary).toMatch(/durable fiscal submission.*authenticated provider.*immutable signed receipts.*merged through PR91 at 3503b0c/i);
  expect(mergedDelivery?.summary).toContain("native ARM64");
  expect(mergedDelivery?.summary).toContain("full upgrade compatibility");
  expect(mergedDelivery?.summary).toContain("All six CI jobs and normal CodeQL passed");
  expect(mergedDelivery?.summary).toContain("81 migrations / 128 public tables");
  expect(mergedDelivery?.summary).toContain("post-merge schema/referee 11/11");
  expect(mergedDelivery?.remaining).toContain("historically verified Order444 preview85 and retained rollback77");
  expect(mergedDelivery?.remaining).toContain("authentic external-provider sandbox acceptance and activation remain unfinished");
  expect(mergedDelivery?.summary).toContain("hotel-journey study remains a fictional design prototype");
  expect(mergedDelivery?.summary).toMatch(/Astra Ultra RMS.*documented research without algorithm runtime or measured uplift/i);
  const currentDelivery: { readonly order: number; readonly state: string; readonly summary: string; readonly remaining?: string } | undefined =
    PROJECT_BUILD_SNAPSHOT.recordedWork.find(({ order }) => order === 444);
  expect(currentDelivery?.order).toBe(444);
  expect(currentDelivery?.state).toBe("proof_in_progress");
  expect(currentDelivery?.summary).toMatch(/three-layout Calm Workbench, Precision Desk and Service Timeline shell/i);
  expect(currentDelivery?.summary).toMatch(/Q208 operator invoice queue\/detail, readiness, confirmed issuance, explicit submission\/current receipt and exact print workflow/i);
  expect(currentDelivery?.summary).toContain("populated81-to-85 preservation 2/0");
  expect(currentDelivery?.summary).toContain("synthetic fiscal review seed through genuine production services 8/0");
  expect(currentDelivery?.summary).toContain("a10851786f17f2fdea0cf970320ee8c46a45b670/frontier85");
  expect(currentDelivery?.summary).toContain("all six CI34095296622 jobs and normal CodeQL34095293723");
  expect(currentDelivery?.summary).toContain("2026-09-07 at 08:09:38Z");
  expect(currentDelivery?.summary).toContain("08:14:30Z");
  expect(currentDelivery?.summary).toContain("three prefilled sign-in fields and the actual login button");
  expect(currentDelivery?.summary).toContain("synthetic invoice YR/1");
  expect(currentDelivery?.summary).toContain("mounted 15 destinations");
  expect(currentDelivery?.summary).toContain("three desktop layouts and the 390px phone view");
  expect(currentDelivery?.summary).toContain("signed out with zero business commands");
  expect(currentDelivery?.remaining).toContain("historical verified preview receipt");
  expect(currentDelivery?.remaining).toContain("dynamic runtime build information owns the actual serving revision/frontier");
  expect(currentDelivery?.remaining).toContain("Old b5ef708/frontier77 is retained for rollback");
  expect(currentDelivery?.remaining).toContain("not full transaction acceptance of all 15 workspaces");
  expect(currentDelivery?.remaining).toContain("providers remain unconfigured/default-off");
  expect(currentDelivery?.remaining).toContain("No main merge is claimed");
  expect(currentDelivery?.remaining).toContain("Full Astra identity/journey design");
  expect(currentDelivery?.remaining).toContain("Order 444, Phase 7 and the whole application are not complete");
  const nativeIssuance = PROJECT_BUILD_SNAPSHOT.recordedWork.find(({ order }) => order === 434);
  expect(nativeIssuance?.summary).toMatch(/PR83.*77 migrations.*127 public tables/i);
  expect(nativeIssuance?.summary).toContain("443e3826");
  expect(nativeIssuance?.remaining).toMatch(/provider submission/i);
  expect(nativeIssuance?.remaining).toMatch(/runtime activation/i);
  expect(currentDelivery?.remaining).not.toContain("candidate85 is not the founder runtime");
  expect(currentDelivery?.remaining).not.toContain("Exact current-head all-six CI and CodeQL");
  expect(mergedDelivery?.remaining).toMatch(/new-department release/i);
  expect(mergedDelivery?.summary).toContain("fictional design prototype");
  expect(mergedDelivery?.remaining).toMatch(/Phase 7 is not complete/i);
  expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ state }) => state)).toEqual([
    "reviewed", "reviewed", "reviewed", "reviewed", "built_unverified",
    "reviewed", "reviewed", "active", "planned", "planned", "planned", "planned", "planned",
    "planned", "planned", "planned", "planned", "planned",
  ]);
});
