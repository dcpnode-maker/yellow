import { describe, expect, test } from "bun:test";

import {
  RATE_MODEL_CATALOGUE,
  canonicalRateAuthoringJson,
  compileRateAuthoringCommand,
} from "../src/contexts/rates";

const PLAN = "00000000-0000-0000-0000-000000007101";
const REFERENCE = "00000000-0000-0000-0000-000000007102";
type ModelKey = (typeof RATE_MODEL_CATALOGUE)[number]["key"];

interface MutableTestCommand {
  authoringMode: "guided" | "expert";
  ratePlanId: string;
  model: { key: ModelKey; version: number; componentModelKeys: ModelKey[] };
  target: { rules: Array<{
    key: string;
    effect: "include" | "exclude";
    priority: number;
    physical: Record<string, unknown>;
    commercial: Record<string, unknown>;
  }> };
  evaluator: {
    modelKey: string;
    currency: string;
    base: Record<string, unknown>;
    gate: Record<string, unknown>;
    rules: Array<Record<string, unknown>>;
    floorMinor: string | null;
    ceilingMinor: string | null;
    eligibleTargetRuleKeys: string[];
    [key: string]: unknown;
  };
  composition: {
    currency: string;
    guestEligibility: Record<string, unknown>;
    package: Record<string, unknown> | null;
    promotions: Array<Record<string, unknown>>;
    policy: Record<string, unknown>;
    distribution: Record<string, unknown>;
  };
  rmsBinding: Record<string, unknown> | null;
}

function minimumFixedCommand(authoringMode: "guided" | "expert"): MutableTestCommand {
  return {
    authoringMode,
    ratePlanId: PLAN,
    model: {
      key: "simple-fixed",
      version: 1,
      componentModelKeys: [],
    },
    target: {
      rules: [{
        key: "property-default",
        effect: "include",
        priority: 0,
        physical: { kind: "property" },
        commercial: {},
      }],
    },
    evaluator: {
      modelKey: "simple-fixed",
      currency: "USD",
      base: { kind: "fixed", amountMinor: "12500" },
      gate: {},
      rules: [],
      floorMinor: null,
      ceilingMinor: null,
      eligibleTargetRuleKeys: [],
    },
    composition: {
      currency: "USD",
      guestEligibility: {
        minAdults: 1,
        maxAdults: 2,
        minChildren: 0,
        maxChildren: 2,
        minTotalGuests: 1,
        maxTotalGuests: 4,
      },
      package: null,
      promotions: [],
      policy: {
        cancellationPolicyId: null,
        depositPolicyId: null,
        guaranteePolicyId: null,
        noShowPolicyId: null,
        refundTreatment: "policy",
      },
      distribution: { mode: "all", channelCodes: [] },
    },
    rmsBinding: null,
  };
}

function commandForModel(key: ModelKey) {
  const command = structuredClone(minimumFixedCommand("guided"));
  command.model.key = key;
  command.evaluator.modelKey = key;
  switch (key) {
    case "simple-fixed":
      break;
    case "calendar":
      Object.assign(command.evaluator, {
        base: { kind: "calendar", cells: [{ stayDate: "2026-09-01", state: "open", amountMinor: "12500" }] },
      });
      break;
    case "bar-ladder":
      Object.assign(command.evaluator, {
        base: { kind: "reference", sourceKind: "bar", sourceId: REFERENCE, sourceVersion: 1 },
        rules: [{
          key: "bar-one",
          stage: 1,
          priority: 1,
          when: { barLevel: "BAR1" },
          adjustment: { kind: "basis_points", basisPoints: 500 },
        }],
      });
      break;
    case "derived":
      Object.assign(command.evaluator, {
        base: { kind: "reference", sourceKind: "parent", sourceId: REFERENCE, sourceVersion: 1 },
      });
      break;
    case "room-matrix":
      command.target.rules[0]!.key = "room-default";
      Object.assign(command.evaluator, {
        rules: [{
          key: "room-delta",
          stage: 1,
          priority: 1,
          when: {},
          adjustment: { kind: "delta", amountMinor: "-500" },
          targetRuleKey: "room-default",
        }],
      });
      break;
    case "occupancy-los":
      Object.assign(command.evaluator, {
        rules: [{
          key: "high-occupancy",
          stage: 1,
          priority: 1,
          when: { occupancy: { minBasisPoints: 7000, maxBasisPoints: 10000 } },
          adjustment: { kind: "basis_points", basisPoints: 1000 },
        }],
      });
      break;
    case "contract-negotiated":
      command.target.rules[0]!.key = "company-one";
      Object.assign(command.evaluator, { eligibleTargetRuleKeys: ["company-one"] });
      break;
    case "package":
      command.evaluator.modelKey = "simple-fixed";
      command.composition.package = {
        key: "breakfast-package",
        version: 1,
        includedInRate: false,
        elements: [{
          key: "breakfast",
          kind: "meal",
          code: "BREAKFAST",
          rhythm: "per_person_night",
          amountMinor: "1500",
          currency: "USD",
        }],
      };
      break;
    case "rms-api-managed":
      Object.assign(command.evaluator, { floorMinor: "10000", ceilingMinor: "30000" });
      command.rmsBinding = {
        adapterKey: "review-rms",
        adapterVersion: 1,
        maximumAgeSeconds: 900,
        outageFallback: "local_evaluator",
      };
      break;
    case "expert-composition":
      command.model.componentModelKeys = ["simple-fixed", "occupancy-los"];
      Object.assign(command.evaluator, {
        rules: [{
          key: "weekday-lift",
          stage: 2,
          priority: 1,
          when: { dowMask: 31 },
          adjustment: { kind: "delta", amountMinor: "250" },
        }],
      });
      break;
  }
  return command;
}

describe("Order 071 canonical rate authoring", () => {
  test("catalogue coverage and Guided/Expert commands share one canonical meaning", () => {
    expect(RATE_MODEL_CATALOGUE).toHaveLength(10);
    const guided = compileRateAuthoringCommand(minimumFixedCommand("guided"));
    const expert = compileRateAuthoringCommand(minimumFixedCommand("expert"));
    expect(canonicalRateAuthoringJson(guided, { omitAuthoringMode: true }))
      .toBe(canonicalRateAuthoringJson(expert, { omitAuthoringMode: true }));
  });

  test("all ten registered model families compile through exact typed inputs", () => {
    expect(RATE_MODEL_CATALOGUE.map(({ key }) => key)).toEqual([
      "simple-fixed", "calendar", "bar-ladder", "derived", "room-matrix",
      "occupancy-los", "contract-negotiated", "package", "rms-api-managed", "expert-composition",
    ]);
    for (const { key } of RATE_MODEL_CATALOGUE) {
      const result = compileRateAuthoringCommand(commandForModel(key));
      expect(result.model.key).toBe(key);
      expect(typeof result.evaluator.base.kind === "string").toBe(true);
    }
  });

  test("money remains exact and hostile transport or authority fields fail closed", () => {
    const exact = compileRateAuthoringCommand(commandForModel("expert-composition"));
    expect(exact.evaluator.base).toEqual({ kind: "fixed", amountMinor: 12_500n });
    expect(exact.evaluator.rules[0]?.adjustment).toEqual({ kind: "delta", amountMinor: 250n });

    const numberMoney = commandForModel("simple-fixed");
    numberMoney.evaluator.base.amountMinor = 12_500 as unknown as string;
    expect(() => compileRateAuthoringCommand(numberMoney)).toThrow("canonical decimal minor-unit string");

    const unsafe = commandForModel("simple-fixed");
    unsafe.evaluator.base.amountMinor = "9223372036854775808";
    expect(() => compileRateAuthoringCommand(unsafe)).toThrow("outside its exact signed-bigint range");

    const authority = { ...commandForModel("simple-fixed"), tenantId: PLAN };
    expect(() => compileRateAuthoringCommand(authority)).toThrow("missing or unsupported fields");

    const formula = commandForModel("simple-fixed");
    Object.assign(formula.evaluator, { formula: "return 1" });
    expect(() => compileRateAuthoringCommand(formula)).toThrow("unsupported fields");
  });

  test("the operator workbench keeps the complete founder rate flow visible and server-governed", async () => {
    const [html, css, script] = await Promise.all([
      Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text(),
      Bun.file(new URL("../src/http/operator/operator.css", import.meta.url)).text(),
      Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text(),
    ]);
    for (const step of ["Create rate", "Pricing", "Who gets it", "Where / when", "Review"]) {
      expect(html).toContain(step);
    }
    for (const control of [
      "builder-target-rule-list", "builder-add-target-rule", "builder-stay-start", "builder-stay-end",
      "builder-booking-window", "builder-los", "builder-occupancy", "builder-no-show-policy",
      "builder-refund-treatment", "builder-package-code", "builder-promotion-code", "builder-distribution-mode",
    ]) {
      expect(html).toContain(`id="${control}"`);
    }
    expect(html).toContain("CTA / CTD");
    expect(html).toContain("Minimum / maximum stay");
    expect(html).toContain("The requester cannot approve their own rate");
    expect(script).toContain("buildGuidedCommand");
    for (const dimension of [
      "companyPartyId", "marketGroupCode", "marketCode", "sourcePartyId", "sourceCode",
      "channelCode", "segmentCode", "agentPartyId", "campaignCode",
    ]) expect(script).toContain(dimension);
    expect(script).toContain("Run a fresh server preview");
    expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|console\.(?:log|debug|info)/);
    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toContain(':root[data-theme="pixel"]');
  });
});

describe("Order 072 secure AI-assisted authoring surface", () => {
  test("the workbench exposes proposal-only AI controls without browser persistence or automatic authority", async () => {
    const [html, script] = await Promise.all([
      Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text(),
      Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text(),
    ]);
    for (const control of [
      "builder-ai-panel", "builder-ai-intent", "builder-ai-interpret", "builder-ai-apply",
      "builder-ai-changes", "builder-ai-assumptions", "builder-ai-questions", "builder-ai-warnings",
      "builder-ai-guardrails",
    ]) {
      expect(html).toContain(`id="${control}"`);
    }
    expect(html).toContain("Nothing is saved automatically");
    expect(html).toContain("Deployment-selected proposal runtime");
    expect(html).toContain("compatible Azure, cloud or on-prem model");
    expect(html).toContain("Do not enter guest data, credentials or payment details");
    expect(html).toContain("Apply, Save, Preview, independent Approval and Publish stay separate");
    expect(script).toContain("interpretBuilderIntent");
    expect(script).toContain("applyBuilderAiProposal");
    expect(script).toContain("Applied for review only. Nothing is saved");
    expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|innerHTML|console\.(?:log|debug|info)/);
    const interpretOnly = script.slice(
      script.indexOf("async function interpretBuilderIntent"),
      script.indexOf("function applyBuilderAiProposal"),
    );
    const applyOnly = script.slice(
      script.indexOf("function applyBuilderAiProposal"),
      script.indexOf("function setBuilderMode"),
    );
    expect(interpretOnly).not.toMatch(/(?:saveBuilderDraft|requestBuilderApproval|publishBuilderRelease)\s*\(/);
    expect(applyOnly).not.toMatch(/(?:saveBuilderDraft|requestBuilderApproval|publishBuilderRelease)\s*\(/);
  });
});

describe("Order 073 applicability-rule and bulk-preview workbench", () => {
  test("multiple explicit include/exclude rules compile without weakening exact target semantics", () => {
    const command = minimumFixedCommand("guided");
    command.target.rules = [
      { key: "property-default", effect: "include", priority: 0, physical: { kind: "property" }, commercial: {} },
      { key: "business-room", effect: "include", priority: 10,
        physical: { kind: "unit_type", unitTypeId: PLAN }, commercial: { marketCode: "BUSINESS" } },
      { key: "opaque-stop", effect: "exclude", priority: 20,
        physical: { kind: "sellable", sellableUnitId: REFERENCE }, commercial: { channelCode: "opaque" } },
    ];
    const compiled = compileRateAuthoringCommand(command);
    expect(compiled.target.rules.map(({ key, effect }) => ({ key, effect }))).toEqual([
      { key: "business-room", effect: "include" },
      { key: "opaque-stop", effect: "exclude" },
      { key: "property-default", effect: "include" },
    ]);
    const duplicate = structuredClone(command);
    duplicate.target.rules[1]!.key = "property-default";
    expect(() => compileRateAuthoringCommand(duplicate)).toThrow("target rule keys must be unique");
    const invalid = structuredClone(command);
    invalid.target.rules[0]!.priority = 1001;
    expect(() => compileRateAuthoringCommand(invalid)).toThrow("priority must be an integer from 0 to 1000");
  });

  test("P0: the workbench exposes the absent multi-rule editor and server-cell evidence renderer", async () => {
    const [html, script] = await Promise.all([
      Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text(),
      Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text(),
    ]);
    expect(html).toContain('id="builder-target-rule-list"');
    expect(html).toContain('id="builder-add-target-rule"');
    expect(html).toContain('id="builder-simulation-cells"');
    expect(script).toContain("renderBuilderTargetRules");
    expect(script).toContain("renderSimulationCells");
    expect(script).toContain("cell.targetResolution.winningRuleKey");
    for (const physical of ["property", "class", "unit_type", "sellable"]) expect(script).toContain(`[\"${physical}\"`);
    for (const action of ["duplicate", "remove"]) expect(script).toContain(`\"${action}\"`);
    expect(script).toContain("rules.length > 200");
    expect(script).toContain("priority < 0 || priority > 1000");
    expect(script).toContain("Non-direct channel previews require governed channel-mapping evidence");
    expect(script).not.toContain("resolveRateTargetRules");
    expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|innerHTML/);
    const saveOnly = script.slice(script.indexOf("async function saveBuilderDraft"), script.indexOf("function renderSimulationCells"));
    expect(saveOnly.indexOf("command = builderCommand()")).toBeLessThan(saveOnly.indexOf("request(route"));
  });
});
