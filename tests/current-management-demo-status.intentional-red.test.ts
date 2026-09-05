import { expect, test } from "bun:test";

import { PROJECT_BUILD_SNAPSHOT } from "../src/project-status";

test("Order 440 status records the current work without claiming Phase 7 completion", () => {
  expect(PROJECT_BUILD_SNAPSHOT.schemaVersion).toBe(2);
  expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-06");
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.latestBuiltOrder).toBe(439);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.currentOrder).toBe(440);
  expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBe(91);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.activePhase).toBe(7);
  const currentDelivery: { readonly order: number; readonly state: string; readonly remaining?: string } | undefined =
    PROJECT_BUILD_SNAPSHOT.recordedWork.at(-1);
  expect(currentDelivery?.order).toBe(440);
  expect(currentDelivery?.state).toBe("proof_in_progress");
  expect(currentDelivery?.remaining).toMatch(/durable persistence/i);
  expect(currentDelivery?.remaining).toMatch(/live sandbox evidence remain outstanding/i);
  expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ state }) => state)).toEqual([
    "reviewed", "reviewed", "reviewed", "reviewed", "built_unverified",
    "reviewed", "reviewed", "active", "planned", "planned", "planned", "planned", "planned",
    "planned", "planned", "planned", "planned", "planned",
  ]);
});
