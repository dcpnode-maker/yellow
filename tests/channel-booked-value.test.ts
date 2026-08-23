import { describe, expect, test } from "bun:test";

import {
  calculateChannelBookedValue,
  channelBookedValueEvidence,
  CHANNEL_BOOKED_VALUE_BASIS,
  ChannelBookedValueError,
} from "../src/contexts/rates";

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    currency: "USD",
    occupiedRoomNights: 3,
    grossBookedRoomRevenueMinor: 40_001n,
    hotelFundedGuestDiscountMinor: 3_001n,
    channelFundedGuestDiscountMinor: 2_000n,
    mandatoryNonRoomChargeMinor: 4_999n,
    taxAndGovernmentPassThroughMinor: 6_000n,
    ...overrides,
  };
}

function expectRecursivelyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectRecursivelyFrozen(child);
}

function expectRatioRecomposes(value: {
  numeratorMinor: bigint;
  denominatorOccupiedRoomNights: number;
  quotientMinor: bigint;
  remainderMinor: bigint;
}): void {
  expect(
    value.quotientMinor * BigInt(value.denominatorOccupiedRoomNights) + value.remainderMinor,
  ).toBe(value.numeratorMinor);
}

describe("Order 093 canonical channel booked value", () => {
  test("P1: exact guest, hotel and Order-091 identities share one basis", () => {
    const source = input();
    const before = structuredClone(source);
    const result = calculateChannelBookedValue(source);
    expect(result).toMatchObject({
      schemaVersion: 1,
      basis: CHANNEL_BOOKED_VALUE_BASIS,
      currency: "USD",
      occupiedRoomNights: 3,
      grossBookedRoomRevenueMinor: 40_001n,
      hotelFundedGuestDiscountMinor: 3_001n,
      channelFundedGuestDiscountMinor: 2_000n,
      mandatoryNonRoomChargeMinor: 4_999n,
      taxAndGovernmentPassThroughMinor: 6_000n,
      guestRoomPriceMinor: 35_000n,
      grossGuestValueBeforeDiscountsMinor: 51_000n,
      guestBookedTotalMinor: 45_999n,
      hotelRoomReceivableBeforeOtherDistributionCostsMinor: 37_000n,
      rmsRoomEconomicsMapping: {
        grossBookedRoomRevenueMinor: 40_001n,
        hotelFundedCampaignDiscountMinor: 3_001n,
        channelFundedGuestDiscountExcludedMinor: 2_000n,
        mandatoryNonRoomChargeExcludedMinor: 4_999n,
        taxAndGovernmentPassThroughExcludedMinor: 6_000n,
      },
    });
    for (const ratio of Object.values(result.perOccupiedRoomNight)) expectRatioRecomposes(ratio);
    expect(result.guestRoomPriceMinor + result.hotelFundedGuestDiscountMinor
      + result.channelFundedGuestDiscountMinor).toBe(result.grossBookedRoomRevenueMinor);
    expect(result.guestRoomPriceMinor + result.channelFundedGuestDiscountMinor)
      .toBe(result.hotelRoomReceivableBeforeOtherDistributionCostsMinor);
    expect(source).toEqual(before);
    expectRecursivelyFrozen(result);
  });

  test("P2: funder changes hotel value while non-room and tax stay outside room economics", () => {
    const hotelFunded = calculateChannelBookedValue(input({
      hotelFundedGuestDiscountMinor: 5_000n,
      channelFundedGuestDiscountMinor: 2_000n,
    }));
    const channelFunded = calculateChannelBookedValue(input({
      hotelFundedGuestDiscountMinor: 2_000n,
      channelFundedGuestDiscountMinor: 5_000n,
    }));
    expect(channelFunded.guestRoomPriceMinor).toBe(hotelFunded.guestRoomPriceMinor);
    expect(channelFunded.guestBookedTotalMinor).toBe(hotelFunded.guestBookedTotalMinor);
    expect(channelFunded.hotelRoomReceivableBeforeOtherDistributionCostsMinor
      - hotelFunded.hotelRoomReceivableBeforeOtherDistributionCostsMinor).toBe(3_000n);
    expect(hotelFunded.rmsRoomEconomicsMapping.hotelFundedCampaignDiscountMinor
      - channelFunded.rmsRoomEconomicsMapping.hotelFundedCampaignDiscountMinor).toBe(3_000n);

    const higherNonRoomAndTax = calculateChannelBookedValue(input({
      mandatoryNonRoomChargeMinor: 5_999n,
      taxAndGovernmentPassThroughMinor: 7_000n,
    }));
    const baseline = calculateChannelBookedValue(input());
    expect(higherNonRoomAndTax.guestBookedTotalMinor - baseline.guestBookedTotalMinor).toBe(2_000n);
    expect(higherNonRoomAndTax.grossBookedRoomRevenueMinor).toBe(baseline.grossBookedRoomRevenueMinor);
    expect(higherNonRoomAndTax.hotelRoomReceivableBeforeOtherDistributionCostsMinor)
      .toBe(baseline.hotelRoomReceivableBeforeOtherDistributionCostsMinor);
    expect(higherNonRoomAndTax.rmsRoomEconomicsMapping.grossBookedRoomRevenueMinor)
      .toBe(baseline.rmsRoomEconomicsMapping.grossBookedRoomRevenueMinor);
  });

  test("P3: strict shapes, exact money, discounts and overflow fail closed", () => {
    const missing = input();
    delete missing.currency;
    const invalid = [
      input({ unsupported: true }),
      missing,
      input({ currency: "usd" }),
      input({ occupiedRoomNights: 0 }),
      input({ occupiedRoomNights: 1.5 }),
      input({ grossBookedRoomRevenueMinor: 40_001 }),
      input({ hotelFundedGuestDiscountMinor: "3001" }),
      input({ channelFundedGuestDiscountMinor: -1n }),
      input({ mandatoryNonRoomChargeMinor: 9_223_372_036_854_775_808n }),
      input({ hotelFundedGuestDiscountMinor: 30_000n, channelFundedGuestDiscountMinor: 20_000n }),
      input({
        grossBookedRoomRevenueMinor: 9_223_372_036_854_775_807n,
        hotelFundedGuestDiscountMinor: 0n,
        channelFundedGuestDiscountMinor: 0n,
        mandatoryNonRoomChargeMinor: 1n,
        taxAndGovernmentPassThroughMinor: 0n,
      }),
    ];
    for (const candidate of invalid) {
      const before = structuredClone(candidate);
      expect(() => calculateChannelBookedValue(candidate)).toThrow(ChannelBookedValueError);
      expect(candidate).toEqual(before);
    }
  });

  test("P4: transport evidence is immutable, exact and rejects forged totals", () => {
    const result = calculateChannelBookedValue(input());
    const evidence = channelBookedValueEvidence(result);
    expect(evidence).toMatchObject({
      schemaVersion: 1,
      basis: CHANNEL_BOOKED_VALUE_BASIS,
      grossBookedRoomRevenueMinor: "40001",
      guestRoomPriceMinor: "35000",
      grossGuestValueBeforeDiscountsMinor: "51000",
      guestBookedTotalMinor: "45999",
      hotelRoomReceivableBeforeOtherDistributionCostsMinor: "37000",
      rmsRoomEconomicsMapping: {
        hotelFundedCampaignDiscountMinor: "3001",
        channelFundedGuestDiscountExcludedMinor: "2000",
        mandatoryNonRoomChargeExcludedMinor: "4999",
        taxAndGovernmentPassThroughExcludedMinor: "6000",
      },
    });
    expect(JSON.parse(JSON.stringify(evidence))).toMatchObject({
      currency: "USD",
      guestBookedTotalMinor: "45999",
    });
    expectRecursivelyFrozen(evidence);
    const forged = Object.freeze({ ...result, guestBookedTotalMinor: result.guestBookedTotalMinor + 1n });
    expect(() => channelBookedValueEvidence(forged)).toThrow(ChannelBookedValueError);
  });
});
