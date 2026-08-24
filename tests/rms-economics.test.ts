import { describe, expect, test } from "bun:test";

import {
  calculateRmsRoomEconomics,
  rmsRoomEconomicsEvidence,
  RMS_ROOM_ECONOMICS_BASIS,
  RmsEconomicsError,
} from "../src/contexts/rates";

const MAX_BIGINT = 9_223_372_036_854_775_807n;

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    currency: "USD",
    occupiedRoomNights: 4,
    taxBasis: "room_revenue_excluding_taxes",
    grossBookedRoomRevenueMinor: 100_003n,
    distributionCosts: {
      hotelFundedCampaignDiscountMinor: 10_001n,
      channelCommissionMinor: 15_002n,
      transactionPaymentFeesMinor: 2_003n,
      expectedCancellationNoShowRefundCostMinor: 3_004n,
      otherVariableDistributionCostsMinor: 1_005n,
    },
    incrementalServicingCostMinor: 9_006n,
    displacedContributionMinor: 12_007n,
    minimumAcceptableContributionPerRoomNightMinor: 14_000n,
    ...overrides,
  };
}

function expectRecursivelyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectRecursivelyFrozen(child);
}

describe("Order 091 canonical RMS room economics", () => {
  test("P1: named exact costs produce exact totals and occupied-room-night ratios", () => {
    const result = calculateRmsRoomEconomics(input());
    expect(result.schemaVersion).toBe(1);
    expect(result.basis).toEqual(RMS_ROOM_ECONOMICS_BASIS);
    expect(result.currency).toBe("USD");
    expect(result.occupiedRoomNights).toBe(4);
    expect(result.distributionCosts).toEqual({
      hotelFundedCampaignDiscountMinor: 10_001n,
      channelCommissionMinor: 15_002n,
      transactionPaymentFeesMinor: 2_003n,
      expectedCancellationNoShowRefundCostMinor: 3_004n,
      otherVariableDistributionCostsMinor: 1_005n,
      totalMinor: 31_015n,
    });
    expect(result.grossBookedRoomRevenueMinor).toBe(100_003n);
    expect(result.netRoomRevenueMinor).toBe(68_988n);
    expect(result.contributionMinor).toBe(59_982n);
    expect(result.displacementAdjustedValueMinor).toBe(47_975n);

    const ratios = [
      result.perOccupiedRoomNight.grossBookedRoomRevenue,
      result.perOccupiedRoomNight.netRoomRevenue,
      result.perOccupiedRoomNight.contribution,
      result.perOccupiedRoomNight.displacementAdjustedValue,
    ];
    expect(ratios.map(({ quotientMinor, remainderMinor }) => [quotientMinor, remainderMinor])).toEqual([
      [25_000n, 3n], [17_247n, 0n], [14_995n, 2n], [11_993n, 3n],
    ]);
    for (const ratio of ratios) {
      expect(ratio.denominatorOccupiedRoomNights).toBe(4);
      expect(ratio.quotientMinor * 4n + ratio.remainderMinor).toBe(ratio.numeratorMinor);
    }
  });

  test("P2: losses stay visible and bid price uses contribution without rounding", () => {
    const loss = calculateRmsRoomEconomics(input({
      occupiedRoomNights: 3,
      grossBookedRoomRevenueMinor: 100n,
      distributionCosts: {
        hotelFundedCampaignDiscountMinor: 100n,
        channelCommissionMinor: 100n,
        transactionPaymentFeesMinor: 100n,
        expectedCancellationNoShowRefundCostMinor: 100n,
        otherVariableDistributionCostsMinor: 100n,
      },
      incrementalServicingCostMinor: 50n,
      displacedContributionMinor: 10n,
      minimumAcceptableContributionPerRoomNightMinor: 0n,
    }));
    expect(loss.netRoomRevenueMinor).toBe(-400n);
    expect(loss.contributionMinor).toBe(-450n);
    expect(loss.displacementAdjustedValueMinor).toBe(-460n);
    expect(loss.perOccupiedRoomNight.displacementAdjustedValue).toEqual({
      numeratorMinor: -460n,
      denominatorOccupiedRoomNights: 3,
      quotientMinor: -153n,
      remainderMinor: -1n,
    });
    expect(loss.bidPrice).toEqual({
      minimumContributionPerOccupiedRoomNightMinor: 0n,
      requiredContributionTotalMinor: 0n,
      surplusOrShortfallMinor: -450n,
      meetsMinimum: false,
    });

    for (const [bid, surplus, meets] of [[14_995n, 2n, true], [14_995n + 1n, -2n, false]] as const) {
      const result = calculateRmsRoomEconomics(input({ minimumAcceptableContributionPerRoomNightMinor: bid }));
      expect(result.bidPrice?.surplusOrShortfallMinor).toBe(surplus);
      expect(result.bidPrice?.meetsMinimum).toBe(meets);
      expect(result.displacementAdjustedValueMinor).toBe(47_975n);
    }
    const equality = calculateRmsRoomEconomics(input({
      incrementalServicingCostMinor: 8_988n,
      minimumAcceptableContributionPerRoomNightMinor: 15_000n,
    }));
    expect(equality.contributionMinor).toBe(60_000n);
    expect(equality.bidPrice?.surplusOrShortfallMinor).toBe(0n);
    expect(equality.bidPrice?.meetsMinimum).toBe(true);
  });

  test("P3: input is strict, bigint-only and signed-overflow safe", () => {
    const invalid: unknown[] = [
      input({ currency: "usd" }),
      input({ occupiedRoomNights: 0 }),
      input({ occupiedRoomNights: 1.5 }),
      input({ taxBasis: "tax_inclusive" }),
      input({ grossBookedRoomRevenueMinor: 100 }),
      input({ grossBookedRoomRevenueMinor: "100" }),
      input({ grossBookedRoomRevenueMinor: -1n }),
      input({ incrementalServicingCostMinor: MAX_BIGINT + 1n }),
      input({ displacedContributionMinor: -1n }),
      input({ minimumAcceptableContributionPerRoomNightMinor: -1n }),
      input({ unsupported: true }),
      { ...input(), distributionCosts: { ...(input().distributionCosts as object), unsupported: 1n } },
      { ...input(), distributionCosts: { ...(input().distributionCosts as object), channelCommissionMinor: -1n } },
      { ...input(), distributionCosts: { ...(input().distributionCosts as object), channelCommissionMinor: MAX_BIGINT } },
      input({
        grossBookedRoomRevenueMinor: 0n,
        distributionCosts: {
          hotelFundedCampaignDiscountMinor: MAX_BIGINT,
          channelCommissionMinor: MAX_BIGINT,
          transactionPaymentFeesMinor: 0n,
          expectedCancellationNoShowRefundCostMinor: 0n,
          otherVariableDistributionCostsMinor: 0n,
        },
      }),
      input({
        occupiedRoomNights: Number.MAX_SAFE_INTEGER,
        minimumAcceptableContributionPerRoomNightMinor: MAX_BIGINT,
      }),
    ];
    const missing = input();
    delete missing.currency;
    invalid.push(missing);
    for (const candidate of invalid) {
      expect(() => calculateRmsRoomEconomics(candidate)).toThrow(RmsEconomicsError);
    }
  });

  test("P4: immutable transport evidence uses canonical decimal strings", () => {
    const source = input();
    const before = structuredClone(source);
    const result = calculateRmsRoomEconomics(source);
    const evidence = rmsRoomEconomicsEvidence(result);
    expectRecursivelyFrozen(result);
    expectRecursivelyFrozen(evidence);
    expect(source).toEqual(before);
    expect(evidence).toMatchObject({
      schemaVersion: 1,
      currency: "USD",
      occupiedRoomNights: 4,
      basis: {
        denominator: "occupied_room_nights",
        taxBasis: "room_revenue_excluding_taxes",
        fixedHotelCostsIncluded: false,
      },
      grossBookedRoomRevenueMinor: "100003",
      netRoomRevenueMinor: "68988",
      contributionMinor: "59982",
      displacementAdjustedValueMinor: "47975",
      bidPrice: {
        minimumContributionPerOccupiedRoomNightMinor: "14000",
        requiredContributionTotalMinor: "56000",
        surplusOrShortfallMinor: "3982",
        meetsMinimum: true,
      },
    });
    expect(evidence.perOccupiedRoomNight.displacementAdjustedValue).toEqual({
      numeratorMinor: "47975",
      denominatorOccupiedRoomNights: 4,
      quotientMinor: "11993",
      remainderMinor: "3",
    });
    expect(JSON.parse(JSON.stringify(evidence)).contributionMinor).toBe("59982");
    expect(JSON.stringify(evidence)).not.toMatch(/\d+\.\d+/);

    const forged = Object.freeze({ ...result, contributionMinor: result.contributionMinor + 1n });
    expect(() => rmsRoomEconomicsEvidence(forged)).toThrow(RmsEconomicsError);
    const shallow = Object.freeze({ ...result, distributionCosts: { ...result.distributionCosts } });
    expect(() => rmsRoomEconomicsEvidence(shallow)).toThrow(RmsEconomicsError);
  });
});
