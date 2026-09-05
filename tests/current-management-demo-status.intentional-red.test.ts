import { expect, test } from "bun:test";

import { PROJECT_BUILD_SNAPSHOT } from "../src/project-status";

test("Order 438 status records the consolidated candidate without claiming Phase 7 completion", () => {
  expect(PROJECT_BUILD_SNAPSHOT.schemaVersion).toBe(2);
  expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-05");
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.latestBuiltOrder).toBe(438);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.currentOrder).toBe(438);
  expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBe(91);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.activePhase).toBe(7);
  const currentDelivery: { readonly order: number; readonly state: string; readonly remaining?: string } | undefined =
    PROJECT_BUILD_SNAPSHOT.recordedWork.at(-1);
  expect(currentDelivery?.order).toBe(438);
  expect(currentDelivery?.state).toBe("built_unverified");
  expect(currentDelivery?.remaining).toMatch(/native issuance remains unreleased/i);
  expect(currentDelivery?.remaining).toMatch(/Phase 7 is not complete/i);
  expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ state }) => state)).toEqual([
    "reviewed", "reviewed", "reviewed", "reviewed", "built_unverified",
    "reviewed", "reviewed", "active", "planned", "planned", "planned", "planned", "planned",
    "planned", "planned", "planned", "planned", "planned",
  ]);
});
