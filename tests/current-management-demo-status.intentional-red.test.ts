import { expect, test } from "bun:test";

import { PROJECT_BUILD_SNAPSHOT } from "../src/project-status";

test("Order 311 intentional red: management demo status reflects approved Order310", () => {
  expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-01");
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.latestBuiltOrder).toBe(310);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.currentOrder).toBe(311);
  expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBe(91);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.activePhase).toBe(7);
  expect(PROJECT_BUILD_SNAPSHOT.recordedWork.at(-1)?.order).toBe(310);
  expect(PROJECT_BUILD_SNAPSHOT.recordedWork.at(-1)?.state).toBe("independently_approved");
  expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ state }) => state)).toEqual([
    "reviewed", "reviewed", "reviewed", "reviewed", "built_unverified",
    "active", "reviewed", "active", "planned", "planned", "planned", "planned", "planned",
  ]);
});
