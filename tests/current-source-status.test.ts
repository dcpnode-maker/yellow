import { expect, test } from "bun:test";
import { PROJECT_BUILD_SNAPSHOT } from "../src/project-status";

test("Order467 distinguishes recorded source and promotion receipts from current runtime", () => {
  expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-13");
  expect(PROJECT_BUILD_SNAPSHOT.roadmap).toEqual({ phaseCount: 18, latestBuiltOrder: 466, currentOrder: 460, activePhase: 7 });
  expect(PROJECT_BUILD_SNAPSHOT.label).toBe("Current-source receiving integration in progress; invoice source accepted");
  const newer = PROJECT_BUILD_SNAPSHOT.recordedWork.filter(({ order }) => order > 444);
  expect(newer.map(({ order, state }) => [order, state])).toEqual([
    [453, "independently_approved"], [454, "independently_approved"],
    [455, "proof_in_progress"], [458, "built_unverified"],
    [459, "built_unverified"], [460, "proof_in_progress"],
    [461, "built_unverified"], [462, "proof_in_progress"],
    [463, "proof_in_progress"], [464, "built_unverified"],
    [465, "independently_approved"], [466, "independently_approved"],
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
  expect(byOrder.get(460)?.summary).toContain("source41415cc5/frontier91 at 2026-09-13T04:19:14.2088495Z");
  expect(byOrder.get(460)?.summary).toContain("earlier failed Q258 staging attempt remains historical evidence");
  expect(byOrder.get(460)?.remaining).toContain("timestamped local promotion receipt, not a permanent runtime guarantee");
  expect(byOrder.get(460)?.remaining).toContain("Provider acceptance, genuine fiscal eligibility, Phase 7 and the whole application remain incomplete");
  expect(byOrder.get(461)?.summary).toContain("synthetic sandbox transport");
  expect(byOrder.get(461)?.remaining).toContain("not deployed or live");
  expect(byOrder.get(462)?.summary).toContain("isolated synthetic staging proof");
  expect(byOrder.get(462)?.remaining).toContain("No client data has been loaded");
  expect(byOrder.get(463)?.summary).toContain("11/0 real database tests and referee 11/11");
  expect(byOrder.get(463)?.summary).toContain("passes the corrected actual runtime-readiness check at migration 91");
  expect(byOrder.get(463)?.remaining).toContain("published successor 41415cc5 and the local release verified on September 13");
  expect(byOrder.get(463)?.remaining).toContain("does not complete Phase 4 or Phase 7 or substitute for workflow-specific acceptance");
  expect(byOrder.get(464)?.summary).toContain("34 tests with 6 existing database-gated skips and 0 failures");
  expect(byOrder.get(464)?.remaining).toContain("published successor 41415cc5 and the local release verified on September 13");
  expect(byOrder.get(464)?.remaining).toContain("Source delivery does not itself establish workflow-specific acceptance or phase completion");
  expect(byOrder.get(465)?.summary).toContain("46004d6f9b61a02f14259fd3f911e85a72ae0c60 passed six-job CI run 34721116555");
  expect(byOrder.get(465)?.remaining).toContain("provider activation, Q253 policy resolution and Phase 7 completion remain separate");
  expect(byOrder.get(466)?.summary).toContain("41415cc5c6953f71d9b3baada6fd9c7853567128; CI run 34725373251 passed six jobs");
  expect(byOrder.get(466)?.remaining).toContain("Current runtime identity remains dynamic");
  expect(byOrder.get(466)?.remaining).toContain("No new database proof, provider activation or Phase 7 completion follows from this local delivery");
  expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ number, state }) => [number, state])).toEqual([
    [0,"reviewed"],[1,"reviewed"],[2,"reviewed"],[3,"reviewed"],[4,"built_unverified"],
    [5,"reviewed"],[6,"reviewed"],[7,"active"],[8,"planned"],[9,"planned"],[10,"planned"],
    [11,"planned"],[12,"planned"],[13,"planned"],[14,"planned"],[15,"planned"],[16,"planned"],[17,"planned"],
  ]);
  expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBe(91);
});
