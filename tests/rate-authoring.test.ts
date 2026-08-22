import { describe, expect, test } from "bun:test";

import {
  RATE_MODEL_CATALOGUE,
  canonicalRateAuthoringJson,
  compileRateAuthoringCommand,
} from "../src/contexts/rates";

const PLAN = "00000000-0000-0000-0000-000000007101";

function minimumFixedCommand(authoringMode: "guided" | "expert") {
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

describe("Order 071 canonical rate authoring", () => {
  test("catalogue coverage and Guided/Expert commands share one canonical meaning", () => {
    expect(RATE_MODEL_CATALOGUE).toHaveLength(10);
    const guided = compileRateAuthoringCommand(minimumFixedCommand("guided"));
    const expert = compileRateAuthoringCommand(minimumFixedCommand("expert"));
    expect(canonicalRateAuthoringJson(guided, { omitAuthoringMode: true }))
      .toBe(canonicalRateAuthoringJson(expert, { omitAuthoringMode: true }));
  });
});
