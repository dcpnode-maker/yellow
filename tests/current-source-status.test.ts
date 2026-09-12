import { expect, test } from "bun:test";
import { PROJECT_BUILD_SNAPSHOT } from "../src/project-status";

test("Order464 distinguishes source-built receiving work from runtime release", () => {
  expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-12");
  expect(PROJECT_BUILD_SNAPSHOT.roadmap).toEqual({ phaseCount: 18, latestBuiltOrder: 464, currentOrder: 460, activePhase: 7 });
  expect(PROJECT_BUILD_SNAPSHOT.label).toBe("Current-source receiving integration in progress; reservation actions source built");
  const newer = PROJECT_BUILD_SNAPSHOT.recordedWork.filter(({ order }) => order > 444);
  expect(newer.map(({ order, state }) => [order, state])).toEqual([
    [453, "independently_approved"], [454, "independently_approved"],
    [455, "proof_in_progress"], [458, "built_unverified"],
    [459, "built_unverified"], [460, "proof_in_progress"],
    [461, "built_unverified"], [462, "proof_in_progress"],
    [463, "proof_in_progress"], [464, "built_unverified"],
  ]);
  expect(newer.every(row => Object.isFrozen(row) && row.summary.length > 0 && (row.remaining?.length ?? 0) > 0)).toBe(true);
  const byOrder = new Map(newer.map(row => [row.order, row]));
  expect(byOrder.get(453)?.summary).toContain("90 migrations");
  expect(byOrder.get(454)?.summary).toContain("10/0");
  expect(byOrder.get(454)?.summary).toContain("5/0");
  expect(byOrder.get(455)?.summary).toContain("16 passed");
  expect(byOrder.get(455)?.remaining).toContain("exact-source CI");
  expect(byOrder.get(459)?.summary).toContain("five hotel-workflow groups");
  expect(byOrder.get(459)?.remaining).toContain("Founder visual acceptance");
  expect(byOrder.get(460)?.remaining).toContain("runtime build information");
  expect(byOrder.get(460)?.summary).toContain("129-table worker verification and exact owned shutdown");
  expect(byOrder.get(460)?.summary).toContain("frozen source at migration 90");
  expect(byOrder.get(460)?.remaining).toContain("receiving source at migration 91 remain pending");
  expect(byOrder.get(460)?.remaining).toContain("temporary app is stopped");
  expect(byOrder.get(461)?.summary).toContain("synthetic sandbox transport");
  expect(byOrder.get(461)?.remaining).toContain("not deployed or live");
  expect(byOrder.get(462)?.summary).toContain("isolated synthetic staging proof");
  expect(byOrder.get(462)?.remaining).toContain("No client data has been loaded");
  expect(byOrder.get(463)?.summary).toContain("11/0 real database tests and referee 11/11");
  expect(byOrder.get(463)?.summary).toContain("passes the corrected actual runtime-readiness check at migration 91");
  expect(byOrder.get(463)?.remaining).toContain("Publication and runtime integration remain pending");
  expect(byOrder.get(463)?.remaining).toContain("not live");
  expect(byOrder.get(464)?.summary).toContain("34 tests with 6 existing database-gated skips and 0 failures");
  expect(byOrder.get(464)?.remaining).toContain("source-built only, not live");
  expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ number, state }) => [number, state])).toEqual([
    [0,"reviewed"],[1,"reviewed"],[2,"reviewed"],[3,"reviewed"],[4,"built_unverified"],
    [5,"reviewed"],[6,"reviewed"],[7,"active"],[8,"planned"],[9,"planned"],[10,"planned"],
    [11,"planned"],[12,"planned"],[13,"planned"],[14,"planned"],[15,"planned"],[16,"planned"],[17,"planned"],
  ]);
  expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBe(91);
});
