import { expect, test } from "bun:test";

import { PROJECT_BUILD_SNAPSHOT } from "../src/project-status";

test("Order 440 status records fiscal and hotel work without claiming Phase 7 completion", () => {
  expect(PROJECT_BUILD_SNAPSHOT.schemaVersion).toBe(2);
  expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-07");
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.latestBuiltOrder).toBe(439);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.currentOrder).toBe(440);
  expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBe(91);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.activePhase).toBe(7);
  const currentDelivery: { readonly order: number; readonly state: string; readonly summary: string; readonly remaining?: string } | undefined =
    PROJECT_BUILD_SNAPSHOT.recordedWork.at(-1);
  expect(currentDelivery?.order).toBe(440);
  expect(currentDelivery?.state).toBe("proof_in_progress");
  expect(currentDelivery?.summary).toMatch(/durable fiscal submission.*immutable replay.*supervised delivery.*merged through PR90 at 4ba1d6f/i);
  expect(currentDelivery?.summary).toContain("native ARM64");
  expect(currentDelivery?.summary).toContain("independent actual81 storage");
  expect(currentDelivery?.summary).toContain("synthetic cryptographic recovery journey");
  expect(currentDelivery?.summary).toContain("80 migrations / 128 public tables");
  expect(currentDelivery?.summary).toContain("post-merge schema/referee 11/11");
  expect(currentDelivery?.remaining).toContain("Development81 is not mergedmain80 or the preserved local77");
  expect(currentDelivery?.remaining).toContain("exact-source Linux/ARM64 CI remain integration gates");
  expect(currentDelivery?.remaining).toContain("authentic sandbox acceptance remain unfinished");
  expect(currentDelivery?.summary).toContain("hotel-journey study remains a fictional design prototype");
  expect(currentDelivery?.summary).toMatch(/Order 441 Astra Ultra RMS.*documented research without algorithm runtime or measured uplift/i);
  const nativeIssuance = PROJECT_BUILD_SNAPSHOT.recordedWork.find(({ order }) => order === 434);
  expect(nativeIssuance?.summary).toMatch(/PR83.*77 migrations.*127 public tables/i);
  expect(nativeIssuance?.summary).toContain("443e3826");
  expect(nativeIssuance?.remaining).toMatch(/provider submission/i);
  expect(nativeIssuance?.remaining).toMatch(/runtime activation/i);
  expect(currentDelivery?.remaining).toContain("Operator invoice discovery, issuance and printing");
  expect(currentDelivery?.remaining).toContain("No local refresh, provider activation");
  expect(currentDelivery?.remaining).toMatch(/new-department release/i);
  expect(currentDelivery?.summary).toContain("fictional design prototype");
  expect(currentDelivery?.remaining).toMatch(/Phase 7 is not complete/i);
  expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ state }) => state)).toEqual([
    "reviewed", "reviewed", "reviewed", "reviewed", "built_unverified",
    "reviewed", "reviewed", "active", "planned", "planned", "planned", "planned", "planned",
    "planned", "planned", "planned", "planned", "planned",
  ]);
});
