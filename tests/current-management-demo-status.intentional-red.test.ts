import { expect, test } from "bun:test";

import { PROJECT_BUILD_SNAPSHOT } from "../src/project-status";

test("Order 431 intentional red: management demo status reflects approved Order429 and active Order430", () => {
  expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-05");
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.latestBuiltOrder).toBe(429);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.currentOrder).toBe(431);
  expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBe(91);
  expect(PROJECT_BUILD_SNAPSHOT.roadmap.activePhase).toBe(7);
  expect(PROJECT_BUILD_SNAPSHOT.recordedWork.at(-2)?.order).toBe(429);
  expect(PROJECT_BUILD_SNAPSHOT.recordedWork.at(-2)?.state).toBe("independently_approved");
  expect(PROJECT_BUILD_SNAPSHOT.recordedWork.at(-1)?.order).toBe(430);
  expect(PROJECT_BUILD_SNAPSHOT.recordedWork.at(-1)?.state).toBe("proof_in_progress");
  expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ state }) => state)).toEqual([
    "reviewed", "reviewed", "reviewed", "reviewed", "built_unverified",
    "reviewed", "reviewed", "active", "planned", "planned", "planned", "planned", "planned",
    "planned", "planned", "planned", "planned", "planned",
  ]);
});
