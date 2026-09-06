import { expect, test } from "bun:test";

import { PROJECT_BUILD_SNAPSHOT } from "../src/project-status";

test("Order 440 status records fiscal and hotel work without claiming Phase 7 completion", () => {
  expect(PROJECT_BUILD_SNAPSHOT.schemaVersion).toBe(2);
  expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-06");
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.latestBuiltOrder).toBe(439);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.currentOrder).toBe(440);
  expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBe(91);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.activePhase).toBe(7);
  const currentDelivery: { readonly order: number; readonly state: string; readonly summary: string; readonly remaining?: string } | undefined =
    PROJECT_BUILD_SNAPSHOT.recordedWork.at(-1);
  expect(currentDelivery?.order).toBe(440);
  expect(currentDelivery?.state).toBe("proof_in_progress");
  expect(currentDelivery?.summary).toMatch(/durable fiscal submission.*immutable command replay.*supervised delivery runtime.*merged through PR88 at 2a0ba41/i);
  expect(currentDelivery?.summary).toContain("80 migrations / 128 public tables");
  expect(currentDelivery?.summary).toContain("post-merge schema/referee 11/11");
  expect(currentDelivery?.remaining).toMatch(/signed invoice\/QR retention.*property-authorized receipt reads remain unfinished/i);
  expect(currentDelivery?.remaining).toMatch(/live sandbox evidence remain outstanding/i);
  expect(currentDelivery?.summary).toMatch(/hotel journeys.*fictional design study.*merged/i);
  expect(currentDelivery?.summary).toMatch(/fictional in-memory prototype/i);
  expect(currentDelivery?.summary).toMatch(/Order 441 Astra Ultra RMS paper.*documented research only/i);
  const nativeIssuance = PROJECT_BUILD_SNAPSHOT.recordedWork.find(({ order }) => order === 434);
  expect(nativeIssuance?.summary).toMatch(/PR83.*77 migrations.*127 public tables/i);
  expect(nativeIssuance?.summary).toContain("443e3826");
  expect(nativeIssuance?.remaining).toMatch(/provider submission/i);
  expect(nativeIssuance?.remaining).toMatch(/runtime activation/i);
  expect(currentDelivery?.remaining).toMatch(/IRP provider activation and operator invoice UI remain separate/i);
  expect(currentDelivery?.remaining).toMatch(/new-department release/i);
  expect(currentDelivery?.remaining).toMatch(/not production/i);
  expect(currentDelivery?.remaining).toMatch(/Phase 7 is not complete/i);
  expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ state }) => state)).toEqual([
    "reviewed", "reviewed", "reviewed", "reviewed", "built_unverified",
    "reviewed", "reviewed", "active", "planned", "planned", "planned", "planned", "planned",
    "planned", "planned", "planned", "planned", "planned",
  ]);
});
