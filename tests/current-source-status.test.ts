import { expect, test } from "bun:test";
import { PROJECT_BUILD_SNAPSHOT } from "../src/project-status";

test("Order472 distinguishes the current source priority from dynamic runtime", () => {
  expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-13");
  expect(PROJECT_BUILD_SNAPSHOT.roadmap).toEqual({ phaseCount: 18, latestBuiltOrder: 472, currentOrder: 460, activePhase: 14 });
  expect(PROJECT_BUILD_SNAPSHOT.label).toBe("Current-source release integration in progress; bounded market discovery source accepted");
  const newer = PROJECT_BUILD_SNAPSHOT.recordedWork.filter(({ order }) => order > 444);
  expect(newer.map(({ order, state }) => [order, state])).toEqual([
    [453, "independently_approved"], [454, "independently_approved"],
    [455, "proof_in_progress"], [458, "built_unverified"],
    [459, "built_unverified"], [460, "proof_in_progress"],
    [461, "built_unverified"], [462, "proof_in_progress"],
    [463, "proof_in_progress"], [464, "built_unverified"],
    [465, "independently_approved"], [466, "independently_approved"],
    [467, "built_unverified"], [468, "independently_approved"], [469, "independently_approved"], [470, "independently_approved"],
    [471, "built_unverified"], [472, "independently_approved"],
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
  expect(byOrder.get(460)?.summary).toContain("source41415cc5/frontier91");
  expect(byOrder.get(460)?.summary).toContain("2026-09-13T04:19:14.2088495Z");
  expect(byOrder.get(460)?.summary).toContain("earlier failed Q258 staging attempt remains historical");
  expect(byOrder.get(460)?.remaining).toContain("not a permanent runtime guarantee");
  expect(byOrder.get(461)?.summary).toContain("synthetic sandbox transport");
  expect(byOrder.get(461)?.remaining).toContain("not deployed or live");
  expect(byOrder.get(462)?.summary).toContain("isolated synthetic staging proof");
  expect(byOrder.get(462)?.remaining).toContain("No client data has been loaded");
  expect(byOrder.get(463)?.summary).toContain("11/0 real database tests and referee 11/11");
  expect(byOrder.get(463)?.summary).toContain("passes the corrected actual runtime-readiness check at migration 91");
  expect(byOrder.get(463)?.remaining).toContain("published successor 41415cc5");
  expect(byOrder.get(463)?.remaining).toContain("does not complete Phase 4 or Phase 7");
  expect(byOrder.get(464)?.summary).toContain("34 tests with 6 existing database-gated skips and 0 failures");
  expect(byOrder.get(464)?.remaining).toContain("Dynamic runtime build information");
  expect(byOrder.get(465)?.summary).toContain("34721116555");
  expect(byOrder.get(466)?.summary).toContain("34725373251");
  expect(byOrder.get(466)?.remaining).toContain("both exact served invoice assets");
  expect(byOrder.get(467)?.summary).toContain("d819e080");
  expect(byOrder.get(467)?.summary).toContain("34739597186");
  expect(byOrder.get(468)?.summary).toContain("28 tests passed");
  expect(byOrder.get(468)?.summary).toContain("508 assertions");
  expect(byOrder.get(469)?.summary).toContain("611 assertions");
  expect(byOrder.get(469)?.remaining).toContain("6d4f8ea9");
  expect(byOrder.get(469)?.remaining).toContain("34741807806");
  expect(byOrder.get(469)?.remaining).toContain("11 passed, 0 failed");
  expect(byOrder.get(469)?.remaining).toContain("41415/frontier91");
  expect(byOrder.get(470)?.summary).toContain("1211 assertions");
  expect(byOrder.get(470)?.summary).toContain("6 explicit real-database skips");
  expect(byOrder.get(470)?.remaining).toMatch(/dynamic runtime/i);
  expect(byOrder.get(471)?.summary).toMatch(/frozen.*unaccepted/i);
  expect(byOrder.get(471)?.remaining).toMatch(/provider.*activation|Phase 7/i);
  expect(byOrder.get(472)?.summary).toMatch(/identity.*compset.*map.*attributes.*planner/i);
  expect(byOrder.get(472)?.summary).toContain("Q267");
  expect(byOrder.get(472)?.summary).toContain("Q268");
  expect(byOrder.get(472)?.remaining).toMatch(/publication.*local.*market-quality/i);
  expect(byOrder.get(472)?.remaining).toMatch(/not.*live|not.*collection|not.*pricing/i);
  for (const order of [463, 464, 465, 466, 467, 468, 469, 470] as const) {
    expect(byOrder.get(order)?.remaining).not.toMatch(/not live|integration remain pending|runtime is stopped/);
    expect(byOrder.get(order)?.remaining).toMatch(/runtime.*(dynamic|identifies)|dynamic runtime/i);
  }
  expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ number, state }) => [number, state])).toEqual([
    [0,"reviewed"],[1,"reviewed"],[2,"reviewed"],[3,"reviewed"],[4,"built_unverified"],
    [5,"reviewed"],[6,"reviewed"],[7,"active"],[8,"planned"],[9,"planned"],[10,"planned"],
    [11,"planned"],[12,"planned"],[13,"planned"],[14,"active"],[15,"planned"],[16,"planned"],[17,"planned"],
  ]);
  expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBe(91);
});
