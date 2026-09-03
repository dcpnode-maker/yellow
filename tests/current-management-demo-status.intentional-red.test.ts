import { expect, test } from "bun:test";

import { PROJECT_BUILD_SNAPSHOT } from "../src/project-status";

test("Order 397 intentional red: management demo status reflects approved Order396", () => {
  expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-03");
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.latestBuiltOrder).toBe(396);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.currentOrder).toBe(397);
  expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBe(91);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.activePhase).toBe(7);
  expect(PROJECT_BUILD_SNAPSHOT.recordedWork.at(-1)?.order).toBe(396);
  expect(PROJECT_BUILD_SNAPSHOT.recordedWork.at(-1)?.state).toBe("independently_approved");
  expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ state }) => state)).toEqual([
    "reviewed", "reviewed", "reviewed", "reviewed", "built_unverified",
    "active", "reviewed", "active", "planned", "planned", "planned", "planned", "planned",
    "planned", "planned", "planned", "planned", "planned",
  ]);
});
