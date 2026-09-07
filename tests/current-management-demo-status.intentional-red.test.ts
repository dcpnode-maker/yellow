import { expect, test } from "bun:test";

import { PROJECT_BUILD_SNAPSHOT } from "../src/project-status";

test("Order 444 status records built partner-preview work without claiming integration or Phase 7 completion", () => {
  expect(PROJECT_BUILD_SNAPSHOT.schemaVersion).toBe(2);
  expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-07");
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.latestBuiltOrder).toBe(439);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.currentOrder).toBe(444);
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
  expect(mergedDelivery?.remaining).toContain("Merged main81 is not the preserved local77 or the current Order444 candidate85 development");
  expect(mergedDelivery?.remaining).toContain("authentic external-provider sandbox acceptance and activation remain unfinished");
  expect(mergedDelivery?.summary).toContain("hotel-journey study remains a fictional design prototype");
  expect(mergedDelivery?.summary).toMatch(/Astra Ultra RMS.*documented research without algorithm runtime or measured uplift/i);
  const currentDelivery: { readonly order: number; readonly state: string; readonly summary: string; readonly remaining?: string } | undefined =
    PROJECT_BUILD_SNAPSHOT.recordedWork.at(-1);
  expect(currentDelivery?.order).toBe(444);
  expect(currentDelivery?.state).toBe("proof_in_progress");
  expect(currentDelivery?.summary).toMatch(/three-layout Calm Workbench, Precision Desk and Service Timeline shell/i);
  expect(currentDelivery?.summary).toMatch(/Q208 operator invoice queue\/detail, readiness, confirmed issuance, explicit submission\/current receipt and exact print workflow/i);
  expect(currentDelivery?.summary).toContain("populated81-to-85 preservation 2/0");
  expect(currentDelivery?.summary).toContain("synthetic fiscal review seed through genuine production services 8/0");
  expect(currentDelivery?.remaining).toContain("not merged main81 or preserved local77");
  expect(currentDelivery?.remaining).toContain("candidate85 is not the founder runtime");
  expect(currentDelivery?.remaining).toContain("Exact current-head all-six CI and CodeQL");
  expect(currentDelivery?.remaining).toContain("guarded native promotion");
  expect(currentDelivery?.remaining).toContain("full Astra identity/journey design");
  expect(currentDelivery?.remaining).toContain("Order 444, Phase 7 and the whole application are not complete");
  const nativeIssuance = PROJECT_BUILD_SNAPSHOT.recordedWork.find(({ order }) => order === 434);
  expect(nativeIssuance?.summary).toMatch(/PR83.*77 migrations.*127 public tables/i);
  expect(nativeIssuance?.summary).toContain("443e3826");
  expect(nativeIssuance?.remaining).toMatch(/provider submission/i);
  expect(nativeIssuance?.remaining).toMatch(/runtime activation/i);
  expect(mergedDelivery?.remaining).toContain("No local refresh, native promotion");
  expect(mergedDelivery?.remaining).toMatch(/new-department release/i);
  expect(mergedDelivery?.summary).toContain("fictional design prototype");
  expect(mergedDelivery?.remaining).toMatch(/Phase 7 is not complete/i);
  expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ state }) => state)).toEqual([
    "reviewed", "reviewed", "reviewed", "reviewed", "built_unverified",
    "reviewed", "reviewed", "active", "planned", "planned", "planned", "planned", "planned",
    "planned", "planned", "planned", "planned", "planned",
  ]);
});
