import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "..");
const nativeResumePath = resolve(repositoryRoot, "tests", "native-review-resume.test.ts");
const refereePath = resolve(repositoryRoot, "tests", "referee-typed-parent-fixtures.integration.test.ts");
const fixturePath = resolve(repositoryRoot, "tests", "fixtures", "order130", "referee-p0.txt");
const workflowPath = resolve(repositoryRoot, ".github", "workflows", "ci.yml");
const P0_FIXTURE_SHA256 = "3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1";
const P0_FIXTURE_BYTES = 12_469;
const P0_MASKED_SHA256 = "898b09c45326ecaca6d11bc7c2f2e19d99bb2d7670373988eeb491f5c0dc470c";

function maskSpan(source: string, start: string, end: string, label: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`protected referee marker missing: ${start} .. ${end}`);
  return `${source.slice(0, from)}<ORDER130:${label}>\n${source.slice(to)}`;
}

function maskAllowedRefereeRegions(input: string): string {
  let source = input.replaceAll("\r\n", "\n");
  const periodLine = 'PERIOD = "[2026-09-20 14:00+04,2026-09-22 12:00+04)"\n';
  const constantsAt = source.indexOf(periodLine);
  const resultsAt = source.indexOf("results = []", constantsAt);
  if (constantsAt < 0 || resultsAt < 0) throw new Error("protected referee constants markers missing");
  source = `${source.slice(0, constantsAt + periodLine.length)}<ORDER130:constants>\n${source.slice(resultsAt)}`;
  source = maskSpan(source, "def record(", "# R1 / TC-12.1", "record");
  source = maskSpan(source, "# R3 / TC-12.3", "caps = []", "tc12.3-cleanup");
  return maskSpan(source, "def burst(", "t0 = time.perf_counter()", "burst");
}

function sha256(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

function requiredHostGuard(nativeResume: string): (required: boolean, process: { platform: string }) => void {
  const match = nativeResume.match(/if \(requireNativeResumeProof && process\.platform !== "win32"\) \{\r?\n  throw new Error\("YELLOW_REQUIRE_NATIVE_REVIEW_RESUME requires Windows"\);\r?\n\}/);
  if (match === null) throw new Error("native resume required-host guard is missing or changed");
  return new Function("requireNativeResumeProof", "process", match[0]) as (required: boolean, process: { platform: string }) => void;
}

test("required native resume proof is routed to Windows and P0 provenance stays in-process", async () => {
  const [workflow, nativeResume, referee, currentReferee] = await Promise.all([
    Bun.file(workflowPath).text(),
    Bun.file(nativeResumePath).text(),
    Bun.file(refereePath).text(),
    Bun.file(resolve(repositoryRoot, "tests", "run_invariants.py")).text(),
  ]);
  const windowsStart = workflow.indexOf("  windows-state:");
  const qualityStart = workflow.indexOf("\n  quality:", windowsStart);
  expect(windowsStart).toBeGreaterThanOrEqual(0);
  expect(qualityStart).toBeGreaterThan(windowsStart);
  const windowsJob = workflow.slice(windowsStart, qualityStart);
  const resumeStepStart = windowsJob.indexOf("      - name: Prove Q200 reboot-resume source boundaries on Windows");
  const resumeStepEnd = windowsJob.indexOf("\n      - name:", resumeStepStart + 1);
  expect(resumeStepStart).toBeGreaterThanOrEqual(0);
  expect(resumeStepEnd).toBeGreaterThan(resumeStepStart);
  const resumeStep = windowsJob.slice(resumeStepStart, resumeStepEnd);
  expect(windowsJob).toContain("Install frozen native proof dependencies");
  expect(resumeStep).toContain("shell: pwsh");
  expect(resumeStep).toContain("YELLOW_REQUIRE_NATIVE_REVIEW_RESUME: '1'");
  expect(resumeStep).toContain("run: bun test tests/native-review-resume.test.ts");
  expect(resumeStep).not.toMatch(/\bif:|continue-on-error:|timeout-minutes:|--test-name-pattern|(?:^|\s)-t(?:\s|$)/m);
  expect(resumeStepStart).toBeGreaterThan(
    windowsJob.indexOf("Install frozen native proof dependencies"),
  );
  expect(nativeResume).toContain('process.platform === "win32" ? test : test.skip');
  const guard = requiredHostGuard(nativeResume);
  expect(() => guard(true, { platform: "linux" })).toThrow("YELLOW_REQUIRE_NATIVE_REVIEW_RESUME requires Windows");
  expect(() => guard(false, { platform: "linux" })).not.toThrow();
  expect(() => guard(true, { platform: "win32" })).not.toThrow();
  expect(referee).not.toContain('Bun.spawn(["git", "show"');
  expect(referee).toContain('fixtures", "order130", "referee-p0.txt"');

  expect(existsSync(fixturePath)).toBeTrue();
  const fixtureBytes = new Uint8Array(await Bun.file(fixturePath).arrayBuffer());
  expect(fixtureBytes.byteLength).toBe(P0_FIXTURE_BYTES);
  expect(sha256(fixtureBytes)).toBe(P0_FIXTURE_SHA256);
  const fixture = new TextDecoder("utf-8", { fatal: true }).decode(fixtureBytes);
  expect(fixture.includes("\r")).toBeFalse();
  expect(sha256(new TextEncoder().encode(maskAllowedRefereeRegions(fixture)))).toBe(P0_MASKED_SHA256);
  expect(maskAllowedRefereeRegions(currentReferee)).toBe(maskAllowedRefereeRegions(fixture));
});
