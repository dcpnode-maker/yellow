import { describe, expect, test } from "bun:test";

import {
  RateQuoteConflictError,
  RateQuoteService,
  deriveRateEvaluationContext,
  evaluateRateModel,
  normalizeRateCompositionSpec,
  normalizeRateEvaluatorSpec,
  type ResolveRateQuoteInput,
} from "../src/contexts/rates";
import type { TaxJurisdictionResolutionResult } from "../src/contexts/tax-fiscal";
import type { Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000023900";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000023901";
const PROPERTY = "00000000-0000-0000-0000-000000023902";
const RATE_PLAN = "00000000-0000-0000-0000-000000023903";
const RELEASE = "00000000-0000-0000-0000-000000023904";
const MODEL = "00000000-0000-0000-0000-000000023905";
const TARGET = "00000000-0000-0000-0000-000000023906";
const UNIT_TYPE = "00000000-0000-0000-0000-000000023907";
const SELLABLE = "00000000-0000-0000-0000-000000023908";
const EXTENSION = "00000000-0000-0000-0000-000000023909";
const DAY_MS = 86_400_000;

const INDIA_GST = {
  country: "IN",
  price_display: "tax_exclusive",
  rounding: "document",
  taxes: [{
    code: "GST_ROOM",
    name: "GST on accommodation",
    mode: "slab_percent",
    slab_basis: "transaction_value",
    applies_to: ["room_revenue"],
    slabs: [
      { upto_minor: 750_000, rate: 0.05, itc_eligible: false },
      { upto_minor: null, rate: 0.18, itc_eligible: true },
    ],
  }],
} as const;

const INCLUSIVE_VAT = {
  country: "AE",
  price_display: "tax_inclusive",
  rounding: "line",
  taxes: [{
    code: "VAT",
    name: "Value Added Tax",
    mode: "percent",
    rate: 0.05,
    applies_to: ["room_revenue"],
  }],
} as const;

type PackageMode = "none" | "included" | "extra" | "zero";
type ResolutionMode = "resolved" | "unassigned" | "partial" | "mixed" | "foreign" | "property_mismatch" | "date_mismatch";

interface HarnessOptions {
  readonly nightlyAmounts?: readonly bigint[];
  readonly taxContent?: Readonly<Record<string, unknown>>;
  readonly taxInclusive?: boolean;
  readonly currency?: string;
  readonly storedCurrency?: string;
  readonly resolutionMode?: ResolutionMode;
  readonly packageMode?: PackageMode;
  readonly promotion?: boolean;
  readonly bookable?: boolean;
  readonly contentHash?: string;
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value as object)) return value;
  seen.add(value as object);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function isDeeplyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => isDeeplyFrozen(child, seen));
}

function dateAt(index: number): string {
  return new Date(Date.parse("2026-09-01T00:00:00.000Z") + index * DAY_MS).toISOString().slice(0, 10);
}

function quoteInput(nights: number, promotion = false): ResolveRateQuoteInput {
  const selectedPromotionCodes = promotion ? ["SAVE"] : [];
  return {
    propertyNode: PROPERTY,
    ratePlanId: RATE_PLAN,
    sellableUnitId: SELLABLE,
    stayStart: new Date("2026-09-01T15:00:00.000Z"),
    stayEnd: new Date(Date.parse("2026-09-01T15:00:00.000Z") + nights * DAY_MS),
    guests: { adults: 2, childAges: [9] },
    selectedPromotionCodes,
    commercial: {},
    channelCode: "direct",
  };
}

function compositionSpec(currency: string, packageMode: PackageMode, promotion: boolean) {
  return normalizeRateCompositionSpec({
    currency,
    guestEligibility: {
      minAdults: 1,
      maxAdults: 6,
      minChildren: 0,
      maxChildren: 4,
      minTotalGuests: 1,
      maxTotalGuests: 8,
    },
    package: packageMode === "none" ? null : {
      key: "breakfast",
      version: 1,
      includedInRate: packageMode === "included",
      elements: [{
        key: "breakfast-meal",
        kind: "meal",
        code: "BREAKFAST",
        rhythm: "per_stay",
        amountMinor: packageMode === "zero" ? 0n : 100n,
        currency,
      }],
    },
    promotions: promotion ? [{
      code: "SAVE",
      version: 1,
      stage: 1,
      priority: 0,
      scope: "room",
      discount: { kind: "amount", amountMinor: 100n },
    }] : [],
    policy: {
      cancellationPolicyId: null,
      depositPolicyId: null,
      guaranteePolicyId: null,
      noShowPolicyId: null,
      refundTreatment: "policy",
    },
    distribution: { mode: "all", channelCodes: [] },
  });
}

function resolvedJurisdiction(
  businessDate: string,
  taxContent: Readonly<Record<string, unknown>>,
  overrides: Readonly<{
    tenantId?: string;
    propertyNode?: string;
    businessDate?: string;
    version?: number;
    contentHash?: string;
  }> = {},
): TaxJurisdictionResolutionResult {
  const tenantId = overrides.tenantId ?? TENANT;
  const propertyNode = overrides.propertyNode ?? PROPERTY;
  const resolvedBusinessDate = overrides.businessDate ?? businessDate;
  const version = overrides.version ?? 7;
  const contentHash = overrides.contentHash ?? "a".repeat(64);
  return deepFreeze({
    state: "resolved",
    tenantId,
    propertyNode,
    businessDate: resolvedBusinessDate,
    propertyTimezone: "UTC",
    businessDayFromInstant: `${resolvedBusinessDate}T00:00:00.000000Z`,
    businessDayToInstant: "2026-07-02T00:00:00.000000Z",
    assignment: {
      jurisdictionKey: "in-gst-lodging",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      evidenceRef: `tax-assignment:${resolvedBusinessDate}`,
    },
    jurisdiction: {
      extensionId: EXTENSION,
      ownerTenantId: tenantId,
      key: "in-gst-lodging",
      version,
      content: structuredClone(taxContent),
      contentHash,
      effectiveFromInstant: "2026-01-01T00:00:00.000000Z",
      effectiveToInstant: null,
      evidenceRef: `tax-jurisdiction:${version}:${contentHash}`,
    },
  });
}

function unassignedJurisdiction(businessDate: string): TaxJurisdictionResolutionResult {
  return Object.freeze({
    state: "unassigned",
    tenantId: TENANT,
    propertyNode: PROPERTY,
    businessDate,
    propertyTimezone: "UTC",
    businessDayFromInstant: `${businessDate}T00:00:00.000000Z`,
    businessDayToInstant: "2026-07-02T00:00:00.000000Z",
  });
}

function harness(options: HarnessOptions = {}) {
  const nightlyAmounts = options.nightlyAmounts ?? [99_900n, 100_100n];
  const taxContent = options.taxContent ?? INDIA_GST;
  const taxInclusive = options.taxInclusive ?? false;
  const currency = options.currency ?? "INR";
  const storedCurrency = options.storedCurrency ?? currency;
  const resolutionMode = options.resolutionMode ?? "resolved";
  const packageMode = options.packageMode ?? "none";
  const promotion = options.promotion ?? false;
  const bookable = options.bookable ?? true;
  const contentHash = options.contentHash ?? "a".repeat(64);
  const queries: string[] = [];
  const resolverDates: string[] = [];

  const evaluatorSpec = normalizeRateEvaluatorSpec({
    modelKey: "calendar",
    currency,
    base: {
      kind: "calendar",
      cells: nightlyAmounts.map((amountMinor, index) => ({
        stayDate: dateAt(index),
        state: "open",
        amountMinor,
      })),
    },
    gate: {},
    rules: [],
  });
  const release = Object.freeze({
    id: RELEASE,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    ratePlanId: RATE_PLAN,
    modelDraftId: MODEL,
    modelDraftVersion: 1,
    targetDraftId: TARGET,
    targetDraftVersion: 1,
    evaluatorSpec,
    compositionSpec: compositionSpec(currency, packageMode, promotion),
    rmsBinding: null,
    contentHash: "b".repeat(64),
    extensionVersion: 1,
    status: "active",
    undoOfVersion: null,
  });
  const publication = {
    async getActiveRelease() {
      return release;
    },
    async evaluateReleaseNight(_tx: Tx, _releaseId: string, input: Readonly<Record<string, unknown>>) {
      const evaluationContext = deriveRateEvaluationContext({
        propertyTimeZone: input.propertyTimeZone,
        bookingInstant: input.bookingInstant,
        stayStartInstant: input.stayStartInstant,
        stayEndInstant: input.stayEndInstant,
        nightDate: input.nightDate,
      });
      return Object.freeze({
        release,
        targetResolution: null,
        evaluationContext,
        result: evaluateRateModel(evaluatorSpec, evaluationContext),
      });
    },
  };
  const availability = {
    async search() {
      return [Object.freeze({
        sellableUnitId: SELLABLE,
        sellableUnitName: "Order 239 Room",
        unitTypeId: UNIT_TYPE,
        unitTypeCode: "ROOM",
        unitTypeName: "Room",
        profileKey: "hotel",
        maxOccupancy: 4,
        availableCount: bookable ? 1 : 0,
        bookable,
        restrictionsApplied: Object.freeze([]),
        operationalBlocksApplied: Object.freeze([]),
      })];
    },
  };
  const projection = { async occupancySignal() { return null; } };
  const resolver = {
    async resolve(_tx: Tx, input: Readonly<{ propertyNode: string; businessDate: string }>) {
      const index = resolverDates.length;
      resolverDates.push(input.businessDate);
      if (resolutionMode === "unassigned" || (resolutionMode === "partial" && index > 0)) {
        return unassignedJurisdiction(input.businessDate);
      }
      if (resolutionMode === "mixed" && index > 0) {
        return resolvedJurisdiction(input.businessDate, taxContent, {
          version: 8,
          contentHash: "c".repeat(64),
        });
      }
      if (resolutionMode === "foreign") {
        return resolvedJurisdiction(input.businessDate, taxContent, { tenantId: FOREIGN_TENANT });
      }
      if (resolutionMode === "property_mismatch") {
        return resolvedJurisdiction(input.businessDate, taxContent, {
          propertyNode: "00000000-0000-0000-0000-000000023910",
        });
      }
      if (resolutionMode === "date_mismatch") {
        return resolvedJurisdiction(input.businessDate, taxContent, {
          businessDate: "2026-09-30",
        });
      }
      return resolvedJurisdiction(input.businessDate, taxContent, { contentHash });
    },
  };
  const tx = (async (strings: TemplateStringsArray) => {
    const statement = strings.join("?");
    queries.push(statement);
    return [{
      tenant_id: TENANT,
      timezone: "UTC",
      booking_instant: new Date("2026-08-28T00:00:00.000Z"),
      rate_plan_currency: storedCurrency,
      rate_plan_tax_inclusive: taxInclusive,
    }];
  }) as unknown as Tx;
  const service = new RateQuoteService(
    publication as never,
    resolver as never,
    availability as never,
    projection as never,
  );

  return {
    queries,
    resolverDates,
    resolve: (input = quoteInput(nightlyAmounts.length, promotion)) => service.resolve(tx, input),
  };
}

describe("Order 239 attributable rate-quote tax preview", () => {
  async function expectExactConflict(operation: Promise<unknown>, message: string): Promise<void> {
    try {
      await operation;
      throw new Error("expected quote-scope rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(RateQuoteConflictError);
      expect((error as { readonly constructor?: unknown }).constructor).toBe(RateQuoteConflictError);
      expect(error).toMatchObject({
        name: "RateQuoteConflictError",
        message,
      });
    }
  }

  test("P1: mixed 99,900/100,100 room nights use the 5% value band per night, never by stay average", async () => {
    const result = await harness({
      taxContent: {
        ...INDIA_GST,
        taxes: [...INDIA_GST.taxes, {
          code: "PERSON_NIGHT",
          name: "Person-night proof",
          mode: "fixed_per_person_night",
          amount_minor: 1,
          applies_to: ["room_revenue"],
        }],
      },
    }).resolve();

    expect(result.taxPreview).toMatchObject({
      state: "calculated",
      reason: null,
      jurisdiction: { key: "in-gst-lodging", version: 7, contentHash: "a".repeat(64) },
      evaluation: {
        priceDisplay: "tax_exclusive",
        inputTotalMinor: 200_000n,
        baseTotalMinor: 200_000n,
        taxTotalMinor: 10_006n,
        grandTotalMinor: 210_006n,
      },
    });
    if (result.taxPreview.state !== "calculated") throw new Error("expected calculated tax preview");
    expect(result.taxPreview.evaluation.taxes[0]?.components).toEqual([
      {
        lineId: "room",
        revenueGroup: "room_revenue",
        baseMinor: 99_900n,
        taxMinor: null,
        rateBasisPoints: 500,
      },
      {
        lineId: "room",
        revenueGroup: "room_revenue",
        baseMinor: 100_100n,
        taxMinor: null,
        rateBasisPoints: 500,
      },
    ]);
    expect(result.taxPreview.evaluation.taxes[1]).toMatchObject({
      code: "PERSON_NIGHT",
      taxMinor: 6n,
    });
  });

  test("P1: quote preview preserves the exact 0/1,000/1,001/7,500/7,501 INR boundaries", async () => {
    const result = await harness({
      // Zero is not a valid sellable room-night amount; the smallest positive
      // minor unit exercises the lower edge while the evaluator enforces it.
      nightlyAmounts: [1n, 100_000n, 100_100n, 750_000n, 750_100n],
    }).resolve();

    expect(result.taxPreview).toMatchObject({
      state: "calculated",
      reason: null,
      evaluation: {
        inputTotalMinor: 1_700_201n,
        baseTotalMinor: 1_700_201n,
        taxTotalMinor: 182_523n,
        grandTotalMinor: 1_882_724n,
      },
    });
    if (result.taxPreview.state !== "calculated") throw new Error("expected calculated tax preview");
    expect(result.taxPreview.evaluation.taxes[0]?.components).toEqual([
      { lineId: "room", revenueGroup: "room_revenue", baseMinor: 1n, taxMinor: null, rateBasisPoints: 500 },
      { lineId: "room", revenueGroup: "room_revenue", baseMinor: 100_000n, taxMinor: null, rateBasisPoints: 500 },
      { lineId: "room", revenueGroup: "room_revenue", baseMinor: 100_100n, taxMinor: null, rateBasisPoints: 500 },
      { lineId: "room", revenueGroup: "room_revenue", baseMinor: 750_000n, taxMinor: null, rateBasisPoints: 500 },
      { lineId: "room", revenueGroup: "room_revenue", baseMinor: 750_100n, taxMinor: null, rateBasisPoints: 1_800 },
    ]);
  });

  test("P2: exclusive addition and inclusive extraction remain exact, while inclusion mismatch fails closed", async () => {
    const exclusive = await harness({ nightlyAmounts: [100_100n] }).resolve();
    expect(exclusive.taxPreview).toMatchObject({
      state: "calculated",
      evaluation: { baseTotalMinor: 100_100n, taxTotalMinor: 5_005n, grandTotalMinor: 105_105n },
    });

    const inclusive = await harness({
      nightlyAmounts: [10_500n],
      taxContent: INCLUSIVE_VAT,
      taxInclusive: true,
      currency: "AED",
    }).resolve();
    expect(inclusive.taxPreview).toMatchObject({
      state: "calculated",
      evaluation: { baseTotalMinor: 10_000n, taxTotalMinor: 500n, grandTotalMinor: 10_500n },
    });

    await expect(harness({
      nightlyAmounts: [10_500n],
      taxContent: INCLUSIVE_VAT,
      taxInclusive: false,
      currency: "AED",
    }).resolve()).rejects.toBeInstanceOf(RateQuoteConflictError);
  });

  test("P3: unassigned, partial and mixed jurisdiction stays expose no partial total", async () => {
    for (const [resolutionMode, reason] of [
      ["unassigned", "unassigned"],
      ["partial", "partial_assignment"],
      ["mixed", "mixed_jurisdiction"],
    ] as const) {
      const result = await harness({ resolutionMode }).resolve();
      expect(result.taxPreview).toMatchObject({ state: "unavailable", reason });
      expect("evaluation" in result.taxPreview).toBe(false);
    }
  });

  test("P4: package, included allocation, extra value, promotion and stays over 366 nights remain unattributable", async () => {
    for (const options of [
      { packageMode: "included" as const },
      { packageMode: "extra" as const },
      { promotion: true },
    ]) {
      const result = await harness(options).resolve();
      expect(result.taxPreview).toMatchObject({ state: "unavailable", reason: "unsupported_attribution" });
      expect("evaluation" in result.taxPreview).toBe(false);
    }

    const longStay = await harness({
      nightlyAmounts: Array.from({ length: 367 }, () => 100_000n),
    }).resolve();
    expect(longStay.taxPreview).toMatchObject({ state: "unavailable", reason: "stay_too_long" });
    expect("evaluation" in longStay.taxPreview).toBe(false);
  });

  test("D1288: exactly 366 attributable room nights calculate while 367 is refused", async () => {
    const accepted = await harness({
      nightlyAmounts: Array.from({ length: 366 }, () => 100_000n),
    }).resolve();
    expect(accepted.taxPreview).toMatchObject({
      state: "calculated",
      reason: null,
      evaluation: { inputTotalMinor: 36_600_000n },
    });

    const refused = await harness({
      nightlyAmounts: Array.from({ length: 367 }, () => 100_000n),
    }).resolve();
    expect(refused.taxPreview).toEqual({
      state: "unavailable",
      reason: "stay_too_long",
      assignments: refused.taxAssignments,
    });
  }, 20_000);

  test("D1288: a coherent zero-value package remains unavailable because package evidence is present", async () => {
    const result = await harness({ packageMode: "zero" }).resolve();
    expect(result.result).toMatchObject({
      state: "quoted",
      packageEvidence: {
        key: "breakfast",
        includedInRate: false,
        elements: [{ quantity: 1, totalMinor: 0n }],
      },
      includedAllocationMinor: 0n,
      packageExtraMinor: 0n,
      promotionDiscountMinor: 0n,
      appliedPromotionCodes: [],
      roomAmountMinor: 200_000n,
      preTaxSubtotalMinor: 200_000n,
    });
    expect(result.taxPreview).toEqual({
      state: "unavailable",
      reason: "unsupported_attribution",
      assignments: result.taxAssignments,
    });
  });

  test("D1288: resolver property result mismatch reaches only the quote-scope guard", async () => {
    await expectExactConflict(
      harness({ resolutionMode: "property_mismatch" }).resolve(),
      "Tax jurisdiction resolver returned mismatched quote scope",
    );
  });

  test("D1288: resolver business-date result mismatch reaches only the quote-scope guard", async () => {
    await expectExactConflict(
      harness({ resolutionMode: "date_mismatch" }).resolve(),
      "Tax jurisdiction resolver returned mismatched quote scope",
    );
  });

  test("P5: blocked quote state bypasses the tax evaluator", async () => {
    const malformedTaxContent = { ...INDIA_GST, price_display: "not-a-display" };
    const result = await harness({
      bookable: false,
      taxContent: malformedTaxContent,
    }).resolve();

    expect(result.result.state).toBe("blocked");
    expect(result.taxPreview).toMatchObject({ state: "unavailable", reason: "quote_not_quoted" });
  });

  test("P6/P7: exact evidence changes quoteHash, remains deeply frozen and rejects foreign scope", async () => {
    const firstHarness = harness();
    const input = quoteInput(2);
    const inputSnapshot = {
      ...input,
      stayStart: input.stayStart.toISOString(),
      stayEnd: input.stayEnd.toISOString(),
      guests: { ...input.guests, childAges: [...input.guests.childAges] },
      selectedPromotionCodes: [...input.selectedPromotionCodes],
    };
    const first = await firstHarness.resolve(input);
    const second = await harness({ contentHash: "d".repeat(64) }).resolve();

    expect(first.quoteHash).toMatch(/^[0-9a-f]{64}$/);
    expect(second.quoteHash).toMatch(/^[0-9a-f]{64}$/);
    expect(second.quoteHash).not.toBe(first.quoteHash);
    expect(isDeeplyFrozen(first.taxPreview)).toBe(true);
    expect({
      ...input,
      stayStart: input.stayStart.toISOString(),
      stayEnd: input.stayEnd.toISOString(),
      guests: { ...input.guests, childAges: [...input.guests.childAges] },
      selectedPromotionCodes: [...input.selectedPromotionCodes],
    }).toEqual(inputSnapshot);

    await expect(harness({ resolutionMode: "foreign" }).resolve()).rejects.toBeInstanceOf(RateQuoteConflictError);
    await expect(harness({ storedCurrency: "USD" }).resolve()).rejects.toBeInstanceOf(RateQuoteConflictError);
  });

  test("P8: the quote preview emits read-only SQL and resolves every ordered night exactly once", async () => {
    const bounded = harness();
    await bounded.resolve();

    expect(bounded.resolverDates).toEqual(["2026-09-01", "2026-09-02"]);
    expect(bounded.queries).toHaveLength(1);
    expect(bounded.queries[0]).toMatch(/\bSELECT\b/i);
    expect(bounded.queries.some((statement) => /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE)\b/i.test(statement))).toBe(false);
  });
});
