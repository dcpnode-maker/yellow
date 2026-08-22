import { describe, expect, test } from "bun:test";

import {
  RateEvaluationError,
  deriveRateEvaluationContext,
  evaluateRateModel,
  normalizeRateEvaluatorSpec,
  resolveRateTargetRules,
} from "../src/contexts/rates";

const MAX_BIGINT = 9_223_372_036_854_775_807n;
const PROPERTY = "00000000-0000-0000-0000-000000006700";
const UNIT_TYPE = "00000000-0000-0000-0000-000000006701";
const SELLABLE = "00000000-0000-0000-0000-000000006702";
const PARENT_PLAN = "00000000-0000-0000-0000-000000006703";
const BAR_SOURCE = "00000000-0000-0000-0000-000000006704";

function evaluationContext(overrides: Record<string, unknown> = {}) {
  return deriveRateEvaluationContext({
    propertyTimeZone: "America/New_York",
    bookingInstant: "2026-03-07T23:30:00.000Z",
    stayStartInstant: "2026-03-08T06:30:00.000Z",
    stayEndInstant: "2026-03-10T05:00:00.000Z",
    nightDate: "2026-03-09",
    occupancyBasisPoints: 8_750,
    occupancyEvidenceRef: "projection:version-42",
    barLevel: "HIGH",
    ...overrides,
  });
}

function fixedSpec(amountMinor: unknown = 10_000n, overrides: Record<string, unknown> = {}) {
  return {
    modelKey: "simple-fixed",
    currency: "USD",
    base: { kind: "fixed", amountMinor },
    gate: {},
    rules: [],
    ...overrides,
  };
}

function rule(
  key: string,
  adjustment: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    key,
    stage: 1,
    priority: 0,
    when: {},
    adjustment,
    ...overrides,
  };
}

function permutations<T>(values: readonly T[]): T[][] {
  if (values.length < 2) return [[...values]];
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((tail) => [value, ...tail])
  );
}

function targetResolution(effect: "include" | "exclude" = "include") {
  return resolveRateTargetRules([
    {
      key: "property-base",
      effect: "include",
      priority: 0,
      physical: { kind: "property" },
      commercial: {},
    },
    {
      key: "type-winner",
      effect,
      priority: 0,
      physical: { kind: "unit_type", unitTypeId: UNIT_TYPE },
      commercial: {},
    },
  ], {
    propertyNode: PROPERTY,
    unitTypeId: UNIT_TYPE,
    sellableUnitId: SELLABLE,
    commercial: {},
  }, PROPERTY);
}

describe("Order 067 typed exact-money evaluators", () => {
  test("P1: bigint arithmetic, basis-point rounding and guards remain exact", () => {
    expect(evaluateRateModel(fixedSpec(MAX_BIGINT), evaluationContext())).toMatchObject({
      state: "priced",
      amountMinor: MAX_BIGINT,
      currency: "USD",
      appliedRuleKeys: [],
    });

    for (const invalidMoney of [
      9_007_199_254_740_993,
      100.5,
      "100",
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -1n,
      MAX_BIGINT + 1n,
    ]) {
      expect(() => normalizeRateEvaluatorSpec(fixedSpec(invalidMoney))).toThrow(RateEvaluationError);
    }

    const halfUp = fixedSpec(1n, {
      rules: [rule("half-up", { kind: "basis_points", basisPoints: 5_000 })],
    });
    expect(evaluateRateModel(halfUp, evaluationContext()).amountMinor).toBe(2n);
    const discountHalf = fixedSpec(1n, {
      rules: [rule("discount-half", { kind: "basis_points", basisPoints: -5_000 })],
    });
    expect(evaluateRateModel(discountHalf, evaluationContext()).amountMinor).toBe(1n);

    expect(evaluateRateModel(fixedSpec(100n, {
      floorMinor: 80n,
      ceilingMinor: 90n,
      rules: [rule("discount", { kind: "basis_points", basisPoints: -5_000 })],
    }), evaluationContext())).toMatchObject({ amountMinor: 80n, appliedGuards: ["floor"] });
    expect(evaluateRateModel(fixedSpec(100n, {
      ceilingMinor: 120n,
      rules: [rule("increase", { kind: "basis_points", basisPoints: 5_000 })],
    }), evaluationContext())).toMatchObject({ amountMinor: 120n, appliedGuards: ["ceiling"] });

    expect(() => evaluateRateModel(fixedSpec(MAX_BIGINT, {
      rules: [rule("overflow", { kind: "delta", amountMinor: 1n })],
    }), evaluationContext())).toThrow(RateEvaluationError);
    expect(() => evaluateRateModel(fixedSpec(1n, {
      rules: [rule("negative", { kind: "delta", amountMinor: -2n })],
    }), evaluationContext())).toThrow(RateEvaluationError);
    expect(() => normalizeRateEvaluatorSpec(fixedSpec(10n, {
      floorMinor: 11n,
      ceilingMinor: 10n,
    }))).toThrow(RateEvaluationError);
  });

  test("P2: property-local dates survive DST and reject ambiguous context", () => {
    const context = evaluationContext();
    expect(context).toMatchObject({
      propertyTimeZone: "America/New_York",
      bookingDate: "2026-03-07",
      stayStartDate: "2026-03-08",
      stayEndDate: "2026-03-10",
      nightDate: "2026-03-09",
      nightDowMask: 1,
      bookingWindowDays: 1,
      losNights: 2,
      occupancyBasisPoints: 8_750,
      occupancyEvidenceRef: "projection:version-42",
    });
    expect(Object.isFrozen(context)).toBe(true);
    expect(() => evaluateRateModel(
      fixedSpec(),
      Object.freeze({ ...context, losNights: 99 }),
    )).toThrow(RateEvaluationError);

    expect(evaluationContext({
      propertyTimeZone: "Pacific/Kiritimati",
      bookingInstant: "2026-08-01T09:30:00.000Z",
      stayStartInstant: "2026-08-01T10:30:00.000Z",
      stayEndInstant: "2026-08-02T10:30:00.000Z",
      nightDate: "2026-08-02",
    })).toMatchObject({
      bookingDate: "2026-08-01",
      stayStartDate: "2026-08-02",
      stayEndDate: "2026-08-03",
      bookingWindowDays: 1,
      losNights: 1,
    });

    for (const invalid of [
      { propertyTimeZone: "Mars/Olympus" },
      { bookingInstant: "not-an-instant" },
      { nightDate: "2026-03-10" },
      { stayEndInstant: "2026-03-08T07:00:00.000Z" },
      { occupancyBasisPoints: 10_001 },
      { occupancyEvidenceRef: "" },
      { occupancyBasisPoints: undefined, occupancyEvidenceRef: "projection:orphan" },
    ]) {
      expect(() => evaluationContext(invalid)).toThrow(RateEvaluationError);
    }
  });

  test("P3: every direct model and expert composition has one strict contract", () => {
    expect(evaluateRateModel(fixedSpec(), evaluationContext()).amountMinor).toBe(10_000n);

    const calendar = {
      modelKey: "calendar",
      currency: "USD",
      base: {
        kind: "calendar",
        cells: [
          { stayDate: "2026-03-10", state: "closed" },
          { stayDate: "2026-03-09", state: "open", amountMinor: 12_345n },
        ],
      },
      gate: {},
      rules: [],
    };
    expect(evaluateRateModel(calendar, evaluationContext())).toMatchObject({
      state: "priced",
      amountMinor: 12_345n,
      baseEvidence: { kind: "calendar", stayDate: "2026-03-09", state: "open" },
    });
    expect(evaluateRateModel(calendar, evaluationContext({
      stayEndInstant: "2026-03-11T05:00:00.000Z",
      nightDate: "2026-03-10",
    }))).toMatchObject({
      state: "unpriced",
      reason: "calendar_closed",
    });
    expect(evaluateRateModel(calendar, evaluationContext({
      stayStartInstant: "2026-03-11T04:00:00.000Z",
      stayEndInstant: "2026-03-13T04:00:00.000Z",
      nightDate: "2026-03-11",
    }))).toMatchObject({ state: "unpriced", reason: "calendar_missing" });

    const barContext = evaluationContext({
      reference: {
        sourceKind: "bar",
        sourceId: BAR_SOURCE,
        sourceVersion: 4,
        currency: "USD",
        amountMinor: 20_000n,
      },
    });
    expect(evaluateRateModel({
      modelKey: "bar-ladder",
      currency: "USD",
      base: { kind: "reference", sourceKind: "bar", sourceId: BAR_SOURCE, sourceVersion: 4 },
      gate: {},
      rules: [rule("high-demand", { kind: "basis_points", basisPoints: 1_500 }, {
        when: { barLevel: "HIGH" },
      })],
    }, barContext).amountMinor).toBe(23_000n);

    const parentContext = evaluationContext({
      reference: {
        sourceKind: "parent",
        sourceId: PARENT_PLAN,
        sourceVersion: 7,
        currency: "USD",
        amountMinor: 15_000n,
      },
    });
    expect(evaluateRateModel({
      modelKey: "derived",
      currency: "USD",
      base: { kind: "reference", sourceKind: "parent", sourceId: PARENT_PLAN, sourceVersion: 7 },
      gate: {},
      rules: [rule("child-discount", { kind: "basis_points", basisPoints: -1_000 })],
    }, parentContext).amountMinor).toBe(13_500n);

    const included = targetResolution();
    expect(evaluateRateModel({
      modelKey: "room-matrix",
      currency: "USD",
      base: { kind: "fixed", amountMinor: 10_000n },
      gate: {},
      rules: [rule("type-uplift", { kind: "delta", amountMinor: 2_000n }, {
        targetRuleKey: "type-winner",
      })],
    }, evaluationContext({ targetResolution: included })).amountMinor).toBe(12_000n);

    expect(evaluateRateModel({
      modelKey: "occupancy-los",
      currency: "USD",
      base: { kind: "fixed", amountMinor: 10_000n },
      gate: {},
      rules: [rule("busy-two-night", { kind: "basis_points", basisPoints: 2_000 }, {
        when: {
          occupancy: { minBasisPoints: 8_000, maxBasisPoints: 10_000 },
          los: { minNights: 2, maxNights: 3 },
        },
      })],
    }, evaluationContext()).amountMinor).toBe(12_000n);

    expect(evaluateRateModel({
      modelKey: "contract-negotiated",
      currency: "USD",
      base: { kind: "fixed", amountMinor: 9_000n },
      gate: { stayStart: "2026-03-01", stayEnd: "2026-04-01" },
      eligibleTargetRuleKeys: ["type-winner"],
      rules: [],
    }, evaluationContext({ targetResolution: included })).amountMinor).toBe(9_000n);

    expect(evaluateRateModel({
      modelKey: "expert-composition",
      currency: "USD",
      base: { kind: "fixed", amountMinor: 10_000n },
      gate: {},
      rules: [
        rule("stage-two", { kind: "basis_points", basisPoints: 1_000 }, { stage: 2 }),
        rule("stage-one", { kind: "delta", amountMinor: 1_000n }),
      ],
    }, evaluationContext())).toMatchObject({
      amountMinor: 12_100n,
      appliedRuleKeys: ["stage-one", "stage-two"],
    });

    const invalidSpecs = [
      { ...fixedSpec(), unknown: true },
      { ...fixedSpec(), currency: "usd" },
      { ...fixedSpec(), modelKey: "calendar" },
      { ...calendar, base: { ...calendar.base, cells: [...calendar.base.cells, calendar.base.cells[0]] } },
      { ...calendar, base: { kind: "calendar", cells: [{ stayDate: "2026-03-09", state: "closed", amountMinor: 1n }] } },
      { ...fixedSpec(), modelKey: "bar-ladder" },
      { ...fixedSpec(), modelKey: "derived" },
      { ...fixedSpec(), modelKey: "room-matrix", rules: [rule("unbound", { kind: "delta", amountMinor: 1n })] },
      { ...fixedSpec(), modelKey: "occupancy-los", rules: [rule("unresponsive", { kind: "delta", amountMinor: 1n })] },
      { ...fixedSpec(), modelKey: "contract-negotiated" },
      { ...fixedSpec(), rules: [rule("late-stage", { kind: "delta", amountMinor: 1n }, { stage: 2 })] },
      { ...fixedSpec(), rules: [
        rule("duplicate", { kind: "delta", amountMinor: 1n }),
        rule("duplicate", { kind: "delta", amountMinor: 2n }),
      ] },
      { ...fixedSpec(), rules: Array.from({ length: 201 }, (_, index) =>
        rule(`large-${index}`, { kind: "delta", amountMinor: 1n })
      ) },
      { ...fixedSpec(), gate: { stayStart: "2026-04-01", stayEnd: "2026-03-01" } },
      { ...fixedSpec(), gate: { bookingWindow: { minDays: 20, maxDays: 10 } } },
      { ...fixedSpec(), rules: [rule("bad-adjustment", { kind: "basis_points", basisPoints: 100_001 })] },
      { ...fixedSpec(), modelKey: "package" },
      { ...fixedSpec(), modelKey: "rms-api-managed" },
    ];
    for (const invalid of invalidSpecs) {
      expect(() => normalizeRateEvaluatorSpec(invalid)).toThrow(RateEvaluationError);
    }
    expect(() => normalizeRateEvaluatorSpec({
      ...calendar,
      base: {
        kind: "calendar",
        cells: Array.from({ length: 732 }, (_, index) => ({
          stayDate: new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10),
          state: "open",
          amountMinor: 1n,
        })),
      },
    })).toThrow(RateEvaluationError);
  });

  test("P4: rule order is irrelevant, equal top tuples conflict and stages are numeric", () => {
    const candidates = [
      rule("broad", { kind: "delta", amountMinor: 100n }, { priority: 1 }),
      rule("dow", { kind: "delta", amountMinor: 200n }, { when: { dowMask: 1 }, priority: 1 }),
      rule("los", { kind: "delta", amountMinor: 300n }, {
        when: { dowMask: 1, los: { minNights: 2, maxNights: 2 } },
        priority: 1,
      }),
      rule("winner", { kind: "delta", amountMinor: 400n }, {
        when: { dowMask: 1, los: { minNights: 2, maxNights: 2 } },
        priority: 2,
      }),
    ];
    for (const ordered of permutations(candidates)) {
      expect(evaluateRateModel(fixedSpec(10_000n, {
        modelKey: "expert-composition",
        rules: ordered,
      }), evaluationContext())).toMatchObject({
        state: "priced",
        amountMinor: 10_400n,
        appliedRuleKeys: ["winner"],
      });
    }

    expect(evaluateRateModel(fixedSpec(10_000n, {
      modelKey: "expert-composition",
      rules: [
        rule("zeta", { kind: "delta", amountMinor: 1n }, { when: { dowMask: 1 }, priority: 5 }),
        rule("alpha", { kind: "delta", amountMinor: 2n }, { when: { dowMask: 1 }, priority: 5 }),
      ],
    }), evaluationContext())).toMatchObject({
      state: "conflict",
      amountMinor: null,
      conflictStage: 1,
      conflictingRuleKeys: ["alpha", "zeta"],
    });

    expect(evaluateRateModel(fixedSpec(1_000n, {
      modelKey: "expert-composition",
      rules: [
        rule("third", { kind: "delta", amountMinor: 100n }, { stage: 3 }),
        rule("first", { kind: "basis_points", basisPoints: 10_000 }, { stage: 1 }),
        rule("second", { kind: "replace", amountMinor: 5_000n }, { stage: 2 }),
      ],
    }), evaluationContext())).toMatchObject({
      amountMinor: 5_100n,
      appliedRuleKeys: ["first", "second", "third"],
    });
  });

  test("P5: parent reference identity and version make historical derivation reproducible", () => {
    const historicalSpec = {
      modelKey: "derived",
      currency: "USD",
      base: { kind: "reference", sourceKind: "parent", sourceId: PARENT_PLAN, sourceVersion: 7 },
      gate: {},
      rules: [rule("derive", { kind: "basis_points", basisPoints: -1_500 })],
    };
    const historicalContext = evaluationContext({
      reference: {
        sourceKind: "parent",
        sourceId: PARENT_PLAN,
        sourceVersion: 7,
        currency: "USD",
        amountMinor: 20_000n,
      },
    });
    const first = evaluateRateModel(historicalSpec, historicalContext);
    expect(first).toMatchObject({ amountMinor: 17_000n });

    const currentSpec = {
      ...historicalSpec,
      base: { ...historicalSpec.base, sourceVersion: 8 },
    };
    const currentContext = evaluationContext({
      reference: {
        sourceKind: "parent",
        sourceId: PARENT_PLAN,
        sourceVersion: 8,
        currency: "USD",
        amountMinor: 24_000n,
      },
    });
    expect(evaluateRateModel(currentSpec, currentContext).amountMinor).toBe(20_400n);
    expect(evaluateRateModel(historicalSpec, historicalContext)).toEqual(first);

    for (const reference of [
      { sourceKind: "parent", sourceId: BAR_SOURCE, sourceVersion: 7, currency: "USD", amountMinor: 20_000n },
      { sourceKind: "parent", sourceId: PARENT_PLAN, sourceVersion: 8, currency: "USD", amountMinor: 20_000n },
      { sourceKind: "parent", sourceId: PARENT_PLAN, sourceVersion: 7, currency: "EUR", amountMinor: 20_000n },
      { sourceKind: "bar", sourceId: PARENT_PLAN, sourceVersion: 7, currency: "USD", amountMinor: 20_000n },
    ]) {
      expect(() => evaluateRateModel(historicalSpec, evaluationContext({ reference }))).toThrow(RateEvaluationError);
    }
  });

  test("P6: targeting evidence gates matrix and contract pricing without changing sellability", () => {
    const matrix = {
      modelKey: "room-matrix",
      currency: "USD",
      base: { kind: "fixed", amountMinor: 10_000n },
      gate: {},
      rules: [rule("type-price", { kind: "replace", amountMinor: 12_000n }, {
        targetRuleKey: "type-winner",
      })],
    };
    expect(evaluateRateModel(matrix, evaluationContext({ targetResolution: targetResolution() }))).toMatchObject({
      state: "priced",
      amountMinor: 12_000n,
      targetRuleKey: "type-winner",
    });
    expect(evaluateRateModel(matrix, evaluationContext({ targetResolution: targetResolution("exclude") }))).toMatchObject({
      state: "unpriced",
      reason: "target_excluded",
    });

    const notApplicable = resolveRateTargetRules([{
      key: "wrong-market",
      effect: "include",
      priority: 0,
      physical: { kind: "property" },
      commercial: { marketCode: "OTHER" },
    }], {
      propertyNode: PROPERTY,
      unitTypeId: UNIT_TYPE,
      sellableUnitId: SELLABLE,
      commercial: { marketCode: "RETAIL" },
    }, PROPERTY);
    expect(evaluateRateModel(matrix, evaluationContext({ targetResolution: notApplicable }))).toMatchObject({
      state: "unpriced",
      reason: "target_not_applicable",
    });

    const conflict = resolveRateTargetRules([
      {
        key: "zeta",
        effect: "include",
        priority: 0,
        physical: { kind: "property" },
        commercial: {},
      },
      {
        key: "alpha",
        effect: "include",
        priority: 0,
        physical: { kind: "property" },
        commercial: {},
      },
    ], {
      propertyNode: PROPERTY,
      unitTypeId: UNIT_TYPE,
      sellableUnitId: SELLABLE,
      commercial: {},
    }, PROPERTY);
    expect(evaluateRateModel(matrix, evaluationContext({ targetResolution: conflict }))).toMatchObject({
      state: "conflict",
      conflictingRuleKeys: ["alpha", "zeta"],
    });

    const contract = {
      modelKey: "contract-negotiated",
      currency: "USD",
      base: { kind: "fixed", amountMinor: 9_000n },
      gate: {},
      eligibleTargetRuleKeys: ["company-contract"],
      rules: [],
    };
    expect(evaluateRateModel(contract, evaluationContext({ targetResolution: targetResolution() }))).toMatchObject({
      state: "unpriced",
      reason: "contract_ineligible",
    });
  });

  test("P7: reported work grows sub-quadratically from 100 to 200 rules", () => {
    const buildRules = (count: number) => Array.from({ length: count }, (_, index) => rule(
      `rule-${index.toString().padStart(3, "0")}`,
      { kind: "delta", amountMinor: 1n },
      { when: { barLevel: `L${index.toString().padStart(3, "0")}` } },
    ));
    const first = evaluateRateModel(fixedSpec(10_000n, {
      modelKey: "expert-composition",
      rules: buildRules(100),
    }), evaluationContext({ barLevel: "NONE" }));
    const second = evaluateRateModel(fixedSpec(10_000n, {
      modelKey: "expert-composition",
      rules: buildRules(200),
    }), evaluationContext({ barLevel: "NONE" }));
    expect(first.state).toBe("priced");
    expect(second.state).toBe("priced");
    expect(second.workUnits).toBeLessThan(first.workUnits * 2.2);
    expect(second.workUnits).toBeGreaterThan(first.workUnits);
  });
});
