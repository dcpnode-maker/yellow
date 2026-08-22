import { describe, expect, test } from "bun:test";

import {
  RateCompositionError,
  type RateOperationalBlockEvidence,
  type RateRestrictionEvidence,
  composeRateQuote,
  deriveRateCompositionContext,
  deriveRateEvaluationContext,
  evaluateRateModel,
  normalizeRateCompositionSpec,
  normalizeRateEvaluatorSpec,
} from "../src/contexts/rates";

const MAX_BIGINT = 9_223_372_036_854_775_807n;
const SELLABLE = "00000000-0000-0000-0000-000000006800";
const CANCELLATION = "00000000-0000-0000-0000-000000006801";
const DEPOSIT = "00000000-0000-0000-0000-000000006802";
const GUARANTEE = "00000000-0000-0000-0000-000000006803";
const NO_SHOW = "00000000-0000-0000-0000-000000006804";

function rateBundle(overrides: Record<string, unknown> = {}) {
  const evaluatorSpec = normalizeRateEvaluatorSpec({
    modelKey: "simple-fixed",
    currency: "USD",
    base: { kind: "fixed", amountMinor: 10_000n },
    gate: {},
    rules: [],
    ...overrides,
  });
  const evaluationContext = deriveRateEvaluationContext({
    propertyTimeZone: "America/New_York",
    bookingInstant: "2026-03-07T23:30:00.000Z",
    stayStartInstant: "2026-03-08T06:30:00.000Z",
    stayEndInstant: "2026-03-10T05:00:00.000Z",
    nightDate: "2026-03-09",
  });
  const evaluationResult = evaluateRateModel(evaluatorSpec, evaluationContext);
  return { evaluatorSpec, evaluationContext, evaluationResult };
}

function policyConfiguration(overrides: Record<string, unknown> = {}) {
  return {
    cancellationPolicyId: CANCELLATION,
    depositPolicyId: DEPOSIT,
    guaranteePolicyId: GUARANTEE,
    noShowPolicyId: NO_SHOW,
    refundTreatment: "policy",
    ...overrides,
  };
}

function policyEvidence() {
  return [
    { kind: "cancellation", policyId: CANCELLATION, evidenceRef: "policy:cancellation-v3" },
    { kind: "deposit", policyId: DEPOSIT, evidenceRef: "policy:deposit-v2" },
    { kind: "guarantee", policyId: GUARANTEE, evidenceRef: "policy:guarantee-v4" },
    { kind: "no_show", policyId: NO_SHOW, evidenceRef: "policy:no-show-v1" },
  ];
}

function availability(overrides: Record<string, unknown> = {}) {
  return {
    sellableUnitId: SELLABLE,
    availableCount: 3,
    bookable: true,
    restrictionEvidence: [
      { key: "min-stay", kind: "min_stay", blocked: false, evidenceRef: "restriction:min-stay-v8" },
    ],
    operationalBlockEvidence: [],
    evidenceRef: "availability:projection-v42",
    ...overrides,
  };
}

function compositionSpec(overrides: Record<string, unknown> = {}) {
  return {
    currency: "USD",
    guestEligibility: {
      minAdults: 1,
      maxAdults: 4,
      minChildren: 0,
      maxChildren: 3,
      minTotalGuests: 1,
      maxTotalGuests: 6,
    },
    package: null,
    promotions: [],
    policy: policyConfiguration(),
    distribution: { mode: "all", channelCodes: [] },
    ...overrides,
  };
}

function compositionContext(overrides: Record<string, unknown> = {}) {
  const rate = rateBundle();
  return deriveRateCompositionContext({
    rateEvaluatorSpec: rate.evaluatorSpec,
    rateEvaluationContext: rate.evaluationContext,
    rateEvaluationResult: rate.evaluationResult,
    guests: { adults: 2, childAges: [7] },
    selectedPromotionCodes: [],
    policyEvidence: policyEvidence(),
    mandatoryPolicyEvidence: [
      { key: "jurisdiction-registration", evidenceRef: "compliance:registration-v5" },
      { key: "statutory-tax-profile", evidenceRef: "compliance:tax-profile-v9" },
    ],
    availabilityEvidence: availability(),
    channelCode: "direct",
    channelMappingEvidenceRef: null,
    ...overrides,
  });
}

function compose(specOverrides: Record<string, unknown> = {}, contextOverrides: Record<string, unknown> = {}) {
  return composeRateQuote(
    normalizeRateCompositionSpec(compositionSpec(specOverrides)),
    compositionContext(contextOverrides),
  );
}

function packageElements() {
  return [
    { key: "arrival", kind: "service", code: "WELCOME", rhythm: "per_stay", amountMinor: 100n, currency: "USD" },
    { key: "breakfast", kind: "meal", code: "BREAKFAST", rhythm: "per_night", amountMinor: 200n, currency: "USD" },
    { key: "transfer", kind: "service", code: "TRANSFER", rhythm: "per_person", amountMinor: 300n, currency: "USD" },
    { key: "credit", kind: "allowance", code: "FNB_CREDIT", rhythm: "per_person_night", amountMinor: 400n, currency: "USD" },
  ];
}

function packageSpec(includedInRate: boolean, elements: unknown[] = packageElements()) {
  return {
    key: "family-flex",
    version: 7,
    includedInRate,
    elements,
  };
}

function promotion(
  code: string,
  stage: number,
  priority: number,
  scope: "room" | "room_and_extras",
  discount: Record<string, unknown>,
) {
  return { code, version: 1, stage, priority, scope, discount };
}

describe("Order 068 rate policy and package composition", () => {
  test("P1: package rhythms, included allocation and exact money are distinct", () => {
    const extra = compose({ package: packageSpec(false) });
    expect(extra).toMatchObject({
      state: "quoted",
      roomAmountMinor: 10_000n,
      includedAllocationMinor: 0n,
      packageExtraMinor: 3_800n,
      promotionDiscountMinor: 0n,
      preTaxSubtotalMinor: 13_800n,
    });
    expect(extra.packageEvidence?.elements.map((element) => ({
      key: element.key,
      quantity: element.quantity,
      totalMinor: element.totalMinor,
    }))).toEqual([
      { key: "arrival", quantity: 1, totalMinor: 100n },
      { key: "breakfast", quantity: 2, totalMinor: 400n },
      { key: "credit", quantity: 6, totalMinor: 2_400n },
      { key: "transfer", quantity: 3, totalMinor: 900n },
    ]);

    expect(compose({ package: packageSpec(true) })).toMatchObject({
      state: "quoted",
      includedAllocationMinor: 3_800n,
      packageExtraMinor: 0n,
      preTaxSubtotalMinor: 10_000n,
    });
    expect(compose({
      package: packageSpec(true, [{
        key: "oversized",
        kind: "allowance",
        code: "OVERSIZED",
        rhythm: "per_stay",
        amountMinor: 10_001n,
        currency: "USD",
      }]),
    })).toMatchObject({ state: "unpriced", reason: "included_package_exceeds_room" });

    for (const invalid of [
      packageSpec(false, [{ ...packageElements()[0], currency: "EUR" }]),
      packageSpec(false, [{ ...packageElements()[0], amountMinor: 1.5 }]),
      packageSpec(false, [packageElements()[0]!, packageElements()[0]!]),
      packageSpec(false, Array.from({ length: 101 }, (_, index) => ({
        key: `item-${index}`,
        kind: "service",
        code: `ITEM_${index}`,
        rhythm: "per_stay",
        amountMinor: 1n,
        currency: "USD",
      }))),
    ]) {
      expect(() => normalizeRateCompositionSpec(compositionSpec({ package: invalid }))).toThrow(RateCompositionError);
    }
    expect(() => compose({
      package: packageSpec(false, [{
        key: "overflow",
        kind: "service",
        code: "OVERFLOW",
        rhythm: "per_person_night",
        amountMinor: MAX_BIGINT,
        currency: "USD",
      }]),
    })).toThrow(RateCompositionError);
  });

  test("P2: explicitly selected promotions stage and round deterministically", () => {
    const promotions = [
      promotion("HALF", 2, 10, "room", { kind: "basis_points", basisPoints: 5_000 }),
      promotion("WELCOME", 1, 10, "room_and_extras", { kind: "amount", amountMinor: 100n }),
      promotion("UNSELECTED", 3, 10, "room", { kind: "amount", amountMinor: 9_000n }),
    ];
    const first = compose(
      { package: packageSpec(false, [{ ...packageElements()[0], amountMinor: 1_000n }]), promotions },
      { selectedPromotionCodes: ["WELCOME", "HALF"] },
    );
    expect(first).toMatchObject({
      state: "quoted",
      roomAmountMinor: 10_000n,
      packageExtraMinor: 1_000n,
      promotionDiscountMinor: 5_100n,
      preTaxSubtotalMinor: 5_900n,
      selectedPromotionCodes: ["HALF", "WELCOME"],
      appliedPromotionCodes: ["WELCOME", "HALF"],
    });

    const reordered = compose(
      {
        package: packageSpec(false, [{ ...packageElements()[0], amountMinor: 1_000n }]),
        promotions: [...promotions].reverse(),
      },
      { selectedPromotionCodes: ["HALF", "WELCOME"] },
    );
    expect(reordered).toEqual(first);

    expect(compose({ promotions: [
      promotion("ZETA", 1, 50, "room", { kind: "amount", amountMinor: 100n }),
      promotion("ALPHA", 1, 50, "room", { kind: "amount", amountMinor: 200n }),
    ] }, { selectedPromotionCodes: ["ZETA", "ALPHA"] })).toMatchObject({
      state: "conflict",
      conflictingPromotionCodes: ["ALPHA", "ZETA"],
      conflictStage: 1,
    });
    expect(() => normalizeRateCompositionSpec(compositionSpec({ promotions: [
      promotion("FLOAT", 1, 1, "room", { kind: "amount", amountMinor: 1.5 }),
    ] }))).toThrow(RateCompositionError);
    expect(() => compositionContext({ selectedPromotionCodes: ["UNKNOWN"] })).not.toThrow();
    expect(() => compose({}, { selectedPromotionCodes: ["UNKNOWN"] })).toThrow(RateCompositionError);
  });

  test("P3: guest, refund and policy evidence fail closed without suppressing mandatory policy", () => {
    const quoted = compose();
    expect(quoted).toMatchObject({
      state: "quoted",
      refundTreatment: "policy",
      policyEvidence: policyEvidence(),
      mandatoryPolicyEvidence: [
        { key: "jurisdiction-registration", evidenceRef: "compliance:registration-v5" },
        { key: "statutory-tax-profile", evidenceRef: "compliance:tax-profile-v9" },
      ],
    });
    expect(compose({}, { guests: { adults: 5, childAges: [] } })).toMatchObject({
      state: "unpriced",
      reason: "guest_ineligible",
    });
    expect(compose({}, { guests: { adults: 1, childAges: [4, 7, 12, 16] } })).toMatchObject({
      state: "unpriced",
      reason: "guest_ineligible",
    });

    for (const evidence of [
      policyEvidence().slice(1),
      policyEvidence().map((item) => item.kind === "deposit" ? { ...item, policyId: CANCELLATION } : item),
      [...policyEvidence(), { kind: "deposit", policyId: DEPOSIT, evidenceRef: "duplicate" }],
    ]) {
      expect(() => compose({}, { policyEvidence: evidence })).toThrow(RateCompositionError);
    }
    expect(() => compose(
      { policy: policyConfiguration({ noShowPolicyId: null, refundTreatment: "non_refundable" }) },
      {},
    )).toThrow(RateCompositionError);
    expect(() => normalizeRateCompositionSpec({ ...compositionSpec(), unknown: true })).toThrow(RateCompositionError);
    expect(() => compositionContext({ mandatoryPolicyEvidence: [
      { key: "duplicate", evidenceRef: "one" },
      { key: "duplicate", evidenceRef: "two" },
    ] })).toThrow(RateCompositionError);
  });

  test("P4: restrictions and operational blockers remain authoritative evidence", () => {
    const restrictionEvidence: readonly RateRestrictionEvidence[] = [
      { key: "advance", kind: "min_advance", blocked: false, evidenceRef: "restriction:advance-v3" },
      { key: "closed", kind: "closed", blocked: true, evidenceRef: "restriction:closed-v8" },
      { key: "cta", kind: "cta", blocked: true, evidenceRef: "restriction:cta-v5" },
      { key: "ctd", kind: "ctd", blocked: false, evidenceRef: "restriction:ctd-v5" },
      { key: "max-stay", kind: "max_stay", blocked: false, evidenceRef: "restriction:max-stay-v2" },
      { key: "min-stay", kind: "min_stay", blocked: false, evidenceRef: "restriction:min-stay-v2" },
    ];
    const operationalBlockEvidence: readonly RateOperationalBlockEvidence[] = [
      { key: "ooo-42", kind: "out_of_order", blocked: true, evidenceRef: "occupancy:ooo-v4" },
      { key: "oos-18", kind: "out_of_service", blocked: false, evidenceRef: "occupancy:oos-v1" },
    ];
    const blockedAvailability = availability({
      bookable: false,
      restrictionEvidence,
      operationalBlockEvidence,
    });
    const blockedContext = compositionContext({ availabilityEvidence: blockedAvailability });
    const blocked = composeRateQuote(normalizeRateCompositionSpec(compositionSpec({
      package: packageSpec(false),
      promotions: [promotion("FREE", 1, 1, "room_and_extras", { kind: "basis_points", basisPoints: 10_000 })],
    })), deriveRateCompositionContext({
      ...blockedContext,
      selectedPromotionCodes: ["FREE"],
    }));
    expect(blocked).toMatchObject({ state: "blocked", reason: "availability_blocked" });
    expect(blocked.restrictionEvidence).toEqual(restrictionEvidence);
    expect(blocked.operationalBlockEvidence).toEqual(operationalBlockEvidence);
    expect(blocked.availabilityEvidence).toEqual(blockedContext.availabilityEvidence);

    expect(compose({}, { availabilityEvidence: availability({ availableCount: 0, bookable: false }) })).toMatchObject({
      state: "blocked",
      reason: "availability_blocked",
    });
    expect(() => compositionContext({
      availabilityEvidence: availability({ availableCount: 0, bookable: true }),
    })).toThrow(RateCompositionError);
    expect(() => compositionContext({
      availabilityEvidence: availability({
        bookable: true,
        restrictionEvidence: [{
          key: "cta",
          kind: "cta",
          blocked: true,
          evidenceRef: "restriction:cta-v5",
        }],
      }),
    })).toThrow(RateCompositionError);
  });

  test("P5: channel configuration needs attributable mapping but never creates capacity", () => {
    expect(compose()).toMatchObject({
      state: "quoted",
      distributionEvidence: { channelCode: "direct", eligible: true, mappingEvidenceRef: null },
    });
    expect(compose(
      { distribution: { mode: "allowlist", channelCodes: ["booking-com", "direct"] } },
      { channelCode: "booking-com", channelMappingEvidenceRef: "channel-map:booking-com-v3" },
    )).toMatchObject({
      state: "quoted",
      distributionEvidence: {
        channelCode: "booking-com",
        eligible: true,
        mappingEvidenceRef: "channel-map:booking-com-v3",
      },
    });
    expect(compose(
      { distribution: { mode: "denylist", channelCodes: ["opaque-ota"] } },
      { channelCode: "opaque-ota", channelMappingEvidenceRef: "channel-map:opaque-v1" },
    )).toMatchObject({ state: "unpriced", reason: "channel_ineligible" });
    expect(() => compositionContext({ channelCode: "booking-com", channelMappingEvidenceRef: null })).toThrow(RateCompositionError);
    expect(() => compositionContext({ channelCode: "direct", channelMappingEvidenceRef: "unexpected" })).toThrow(RateCompositionError);
  });

  test("P6: prior price states and exact frozen evidence propagate without tax", () => {
    const unpricedRate = rateBundle({
      gate: { stayStart: "2027-01-01", stayEnd: "2027-02-01" },
    });
    expect(composeRateQuote(normalizeRateCompositionSpec(compositionSpec()), compositionContext({
      rateEvaluatorSpec: unpricedRate.evaluatorSpec,
      rateEvaluationContext: unpricedRate.evaluationContext,
      rateEvaluationResult: unpricedRate.evaluationResult,
    }))).toMatchObject({ state: "unpriced", reason: "rate:gate_unmatched" });

    const conflictRate = rateBundle({
      modelKey: "expert-composition",
      rules: [
        { key: "zeta", stage: 1, priority: 10, when: {}, adjustment: { kind: "delta", amountMinor: 1n } },
        { key: "alpha", stage: 1, priority: 10, when: {}, adjustment: { kind: "delta", amountMinor: 2n } },
      ],
    });
    expect(composeRateQuote(normalizeRateCompositionSpec(compositionSpec()), compositionContext({
      rateEvaluatorSpec: conflictRate.evaluatorSpec,
      rateEvaluationContext: conflictRate.evaluationContext,
      rateEvaluationResult: conflictRate.evaluationResult,
    }))).toMatchObject({ state: "conflict", reason: "rate_conflict" });

    const valid = compositionContext();
    expect(() => deriveRateCompositionContext({
      ...valid,
      rateEvaluationResult: Object.freeze({ ...valid.rateEvaluationResult, amountMinor: 1n }),
    })).toThrow(RateCompositionError);
    const result = compose();
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.rateEvaluation)).toBe(true);
    expect(Object.hasOwn(result, "taxAmountMinor")).toBe(false);
    expect(result.availabilityEvidence.availableCount).toBe(3);
  });

  test("P7: package and promotion work stays bounded across N and 2N inputs", () => {
    const packageAt = (count: number) => packageSpec(false, Array.from({ length: count }, (_, index) => ({
      key: `item-${index.toString().padStart(3, "0")}`,
      kind: "service",
      code: `ITEM_${index.toString().padStart(3, "0")}`,
      rhythm: "per_stay",
      amountMinor: 1n,
      currency: "USD",
    })));
    const promotionsAt = (count: number) => Array.from({ length: count }, (_, index) => promotion(
      `PROMO_${index.toString().padStart(3, "0")}`,
      (index % 8) + 1,
      index,
      "room",
      { kind: "amount", amountMinor: 0n },
    ));

    const package50 = compose({ package: packageAt(50) });
    const package100 = compose({ package: packageAt(100) });
    expect(package100.workUnits).toBeGreaterThan(package50.workUnits);
    expect(package100.workUnits).toBeLessThan(package50.workUnits * 2.2);

    const promo25 = promotionsAt(25);
    const promo50 = promotionsAt(50);
    const first = compose({ promotions: promo25 }, { selectedPromotionCodes: promo25.map(({ code }) => code) });
    const second = compose({ promotions: promo50 }, { selectedPromotionCodes: promo50.map(({ code }) => code) });
    expect(second.workUnits).toBeGreaterThan(first.workUnits);
    expect(second.workUnits).toBeLessThan(first.workUnits * 2.2);
  });
});
