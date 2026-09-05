import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  DEFAULT_SCENARIO_DAY_COUNT,
  DEFAULT_SCENARIO_START_DATE,
  canonicalJson,
  compileScenarioFoundation,
  materializeScenarioFoundation,
  parseScenarioCliOptions,
  scenarioOutputPath,
  sha256,
  validateScenarioManifest,
} from "../scripts/generate-scenario-foundations";

const india = JSON.parse(readFileSync(new URL("../fixtures/scenario-foundations/v1/india.json", import.meta.url), "utf8")) as unknown;
const canada = JSON.parse(readFileSync(new URL("../fixtures/scenario-foundations/v1/canada.json", import.meta.url), "utf8")) as unknown;

function clone(value: unknown): Record<string, any> {
  return JSON.parse(JSON.stringify(value)) as Record<string, any>;
}

test("Order 178: fictional manifests are closed, cross-referenced and non-authoritative", () => {
  for (const source of [india, canada]) {
    const manifest = validateScenarioManifest(source);
    expect(manifest.synthetic).toBe(true);
    expect(manifest.roomClasses.length).toBeGreaterThanOrEqual(4);
    expect(manifest.roomTypes.length).toBeGreaterThanOrEqual(4);
    expect(manifest.roomTypes.some((item) => item.accessible)).toBe(true);
    expect(manifest.roomTypes.some((item) => item.connectsToTypeCodes.length > 0)).toBe(true);
    expect(new Set(manifest.boardPlans.map((item) => item.normalized))).toEqual(new Set(["room_only", "breakfast", "half_board", "full_board"]));
    expect(new Set(manifest.policies.map((item) => item.refundability))).toEqual(new Set(["refundable", "non_refundable"]));
    expect(manifest.partyShapes.some((item) => item.childAges.length > 0)).toBe(true);
    expect(manifest.corporatePatterns.length).toBeGreaterThan(0);
    expect(manifest.longStayPatterns.length).toBeGreaterThan(0);
    expect(manifest.groupPatterns.every((item) => item.authority === "future_scenario_intent" && item.targetPhase === 11)).toBe(true);
    expect(manifest.sources.filter((item) => item.code.startsWith("ota_")).every((item) => item.capability === "future_phase_9")).toBe(true);
    expect(manifest.authority).toEqual({ taxFiscal: "pending_policy", groupsBlocks: "future_phase", databaseAuthority: false, importedReservations: false, purpose: "future_uat_input" });
    expect(canonicalJson(source)).not.toMatch(/(?:@|password|credential|cardnumber|taxRate|taxPercent|gstPercent)/i);
  }
});

test("Order 178: compiler emits exactly 1,096 civil local dates with leap and Toronto DST coverage", () => {
  for (const source of [india, canada]) {
    const generated = compileScenarioFoundation(source);
    expect(generated.dateWindow.startLocalDate).toBe(DEFAULT_SCENARIO_START_DATE);
    expect(generated.dateWindow.endLocalDateExclusive).toBe("2027-01-01");
    expect(generated.dateWindow.dayCount).toBe(DEFAULT_SCENARIO_DAY_COUNT);
    expect(generated.dailyDemandInputs).toHaveLength(1_096);
    expect(generated.dailyDemandInputs[0]?.localDate).toBe("2024-01-01");
    expect(generated.dailyDemandInputs[59]?.localDate).toBe("2024-02-29");
    expect(generated.dailyDemandInputs.at(-1)?.localDate).toBe("2026-12-31");
    expect(new Set(generated.dailyDemandInputs.map((item) => item.localDate)).size).toBe(1_096);
    expect(generated.dailyDemandInputs.every((item) => item.demandBasisPoints >= 1_000 && item.demandBasisPoints <= 20_000 && item.stayNightsHint >= 1 && item.stayNightsHint <= 14)).toBe(true);
  }
  const generatedCanada = compileScenarioFoundation(canada);
  const dates = new Set(generatedCanada.dailyDemandInputs.map((item) => item.localDate));
  for (const transitionDate of ["2024-03-10", "2024-11-03", "2025-03-09", "2025-11-02", "2026-03-08", "2026-11-01"]) expect(dates.has(transitionDate)).toBe(true);
  expect(generatedCanada.dateWindow.timeZone).toBe("America/Toronto");
});

test("Order 178: canonical compiler is byte deterministic and content addressed", () => {
  const first = compileScenarioFoundation(india, "2024-01-01", 10, "fixed-seed");
  const second = compileScenarioFoundation(clone(india), "2024-01-01", 10, "fixed-seed");
  expect(canonicalJson(first)).toBe(canonicalJson(second));
  expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}');
  expect(first.sourceHashSha256).toBe(sha256(canonicalJson(validateScenarioManifest(india))));
  expect(canonicalJson(first).endsWith("\n")).toBe(false);
});

test("Order 178: materialization is write-once, exact-byte idempotent and drift rejecting", () => {
  const root = mkdtempSync(join(tmpdir(), "yellow-scenarios-"));
  try {
    const first = materializeScenarioFoundation(india, { outputRoot: root, dayCount: 4, seed: "materialize" });
    expect(first.wrote).toBe(true);
    expect(readFileSync(first.path, "utf8")).toBe(first.bytes);
    expect(first.path).toBe(scenarioOutputPath(root, "india-riverstone", sha256(first.bytes)));
    expect(materializeScenarioFoundation(india, { outputRoot: root, dayCount: 4, seed: "materialize" }).wrote).toBe(false);
    writeFileSync(first.path, "drift", "utf8");
    expect(() => materializeScenarioFoundation(india, { outputRoot: root, dayCount: 4, seed: "materialize" })).toThrow("Content-addressed output drift");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Order 178: malformed, excessive and authority-bearing inputs fail closed", () => {
  for (const [mutate, message] of [
    [(value: any) => { value.unexpected = true; }, "exactly"],
    [(value: any) => { delete value.roomClasses; }, "exactly"],
    [(value: any) => { value.roomTypes[0].classCode = "MISSING"; }, "unknown class"],
    [(value: any) => { value.roomTypes[1].code = value.roomTypes[0].code; }, "duplicate codes"],
    [(value: any) => { value.roomTypes[0].connectsToTypeCodes = [value.roomTypes[0].code]; }, "connect to itself"],
    [(value: any) => { value.property.timeZone = "Canada/Imaginary"; }, "valid IANA timezone"],
    [(value: any) => { value.policies[0].email = "guest@example.test"; }, "forbidden"],
    [(value: any) => { value.authority.taxPercent = 13; }, "legal or fiscal"],
  ] as Array<[(value: any) => void, string]>) {
    const invalid = clone(india);
    mutate(invalid);
    expect(() => validateScenarioManifest(invalid)).toThrow(message);
  }
  expect(() => compileScenarioFoundation(india, "2024-02-30")).toThrow("valid bounded calendar date");
  expect(() => compileScenarioFoundation(india, "2024-01-01", 0)).toThrow("1 to 1096");
  expect(() => compileScenarioFoundation(india, "2024-01-01", 1_097)).toThrow("1 to 1096");
  expect(() => compileScenarioFoundation(india, "2024-01-01", 1, "email@example.test")).toThrow("seed is invalid");
});

test("Order 178 D-457: country, currency and timezone remain jurisdiction-coherent", () => {
  const indiaWithCanadianZone = clone(india);
  indiaWithCanadianZone.property.timeZone = "America/Toronto";
  expect(() => validateScenarioManifest(indiaWithCanadianZone)).toThrow("not approved for country IN");

  const canadaWithIndianZone = clone(canada);
  canadaWithIndianZone.property.timeZone = "Asia/Kolkata";
  expect(() => validateScenarioManifest(canadaWithIndianZone)).toThrow("not approved for country CA");

  const canadaWithUnsupportedValidZone = clone(canada);
  canadaWithUnsupportedValidZone.property.timeZone = "America/New_York";
  expect(() => validateScenarioManifest(canadaWithUnsupportedValidZone)).toThrow("not approved for country CA");

  const missingTimeZone = clone(canada);
  delete missingTimeZone.property.timeZone;
  expect(() => validateScenarioManifest(missingTimeZone)).toThrow("must contain exactly");
});

test("Order 178: output and CLI boundaries reject traversal, relative roots and duplicate flags", () => {
  expect(() => scenarioOutputPath("relative/output", "india-riverstone", "a".repeat(64))).toThrow("absolute traversal-free");
  expect(() => scenarioOutputPath(`${tmpdir()}\\safe\\..\\escape`, "india-riverstone", "a".repeat(64))).toThrow("absolute traversal-free");
  expect(() => scenarioOutputPath(tmpdir(), "../escape", "a".repeat(64))).toThrow("scenarioKey is invalid");
  expect(parseScenarioCliOptions(["--scenario", "india"]).scenarios).toEqual(["india"]);
  expect(() => parseScenarioCliOptions(["--scenario", "india", "--scenario", "canada"])).toThrow("Duplicate");
  expect(() => parseScenarioCliOptions(["--manifest", "anything.json"])).toThrow("Unknown argument");
  expect(() => parseScenarioCliOptions(["--scenario", "moon"])).toThrow("india, canada");
});

test("Order 178: a scenario-directory link cannot redirect generated bytes", () => {
  const root = mkdtempSync(join(tmpdir(), "yellow-symlink-root-"));
  const outside = mkdtempSync(join(tmpdir(), "yellow-symlink-outside-"));
  try {
    mkdirSync(root, { recursive: true });
    try {
      symlinkSync(outside, join(root, "india-riverstone"), process.platform === "win32" ? "junction" : "dir");
    } catch {
      return;
    }
    expect(() => materializeScenarioFoundation(india, { outputRoot: root, dayCount: 1 })).toThrow("symbolic link");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
