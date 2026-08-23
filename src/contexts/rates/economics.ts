const CURRENCY = /^[A-Z]{3}$/;
const MAX_BIGINT = 9_223_372_036_854_775_807n;
const MIN_BIGINT = -9_223_372_036_854_775_808n;

type JsonObject = Record<string, unknown>;

export class RmsEconomicsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RmsEconomicsError";
  }
}

export const RMS_ROOM_ECONOMICS_BASIS = Object.freeze({
  revenueBasis: "gross_booked_room_revenue_before_distribution_costs" as const,
  denominator: "occupied_room_nights" as const,
  taxBasis: "room_revenue_excluding_taxes" as const,
  fixedHotelCostsIncluded: false as const,
});

export interface RmsDistributionCostsInput {
  readonly hotelFundedCampaignDiscountMinor: bigint;
  readonly channelCommissionMinor: bigint;
  readonly transactionPaymentFeesMinor: bigint;
  readonly expectedCancellationNoShowRefundCostMinor: bigint;
  readonly otherVariableDistributionCostsMinor: bigint;
}

export interface RmsRoomEconomicsInput {
  readonly currency: string;
  readonly occupiedRoomNights: number;
  readonly taxBasis: "room_revenue_excluding_taxes";
  readonly grossBookedRoomRevenueMinor: bigint;
  readonly distributionCosts: RmsDistributionCostsInput;
  readonly incrementalServicingCostMinor: bigint;
  readonly displacedContributionMinor: bigint;
  readonly minimumAcceptableContributionPerRoomNightMinor: bigint | null;
}

export interface ExactPerOccupiedRoomNightValue {
  readonly numeratorMinor: bigint;
  readonly denominatorOccupiedRoomNights: number;
  readonly quotientMinor: bigint;
  readonly remainderMinor: bigint;
}

export interface RmsDistributionCosts extends RmsDistributionCostsInput {
  readonly totalMinor: bigint;
}

export interface RmsBidPriceComparison {
  readonly minimumContributionPerOccupiedRoomNightMinor: bigint;
  readonly requiredContributionTotalMinor: bigint;
  readonly surplusOrShortfallMinor: bigint;
  readonly meetsMinimum: boolean;
}

export interface RmsRoomEconomics {
  readonly schemaVersion: 1;
  readonly basis: typeof RMS_ROOM_ECONOMICS_BASIS;
  readonly currency: string;
  readonly occupiedRoomNights: number;
  readonly grossBookedRoomRevenueMinor: bigint;
  readonly distributionCosts: RmsDistributionCosts;
  readonly netRoomRevenueMinor: bigint;
  readonly incrementalServicingCostMinor: bigint;
  readonly contributionMinor: bigint;
  readonly displacedContributionMinor: bigint;
  readonly displacementAdjustedValueMinor: bigint;
  readonly perOccupiedRoomNight: Readonly<{
    grossBookedRoomRevenue: ExactPerOccupiedRoomNightValue;
    netRoomRevenue: ExactPerOccupiedRoomNightValue;
    contribution: ExactPerOccupiedRoomNightValue;
    displacementAdjustedValue: ExactPerOccupiedRoomNightValue;
  }>;
  readonly bidPrice: RmsBidPriceComparison | null;
}

export interface ExactPerOccupiedRoomNightEvidence {
  readonly numeratorMinor: string;
  readonly denominatorOccupiedRoomNights: number;
  readonly quotientMinor: string;
  readonly remainderMinor: string;
}

export interface RmsRoomEconomicsEvidence {
  readonly schemaVersion: 1;
  readonly basis: typeof RMS_ROOM_ECONOMICS_BASIS;
  readonly currency: string;
  readonly occupiedRoomNights: number;
  readonly grossBookedRoomRevenueMinor: string;
  readonly distributionCosts: Readonly<{
    hotelFundedCampaignDiscountMinor: string;
    channelCommissionMinor: string;
    transactionPaymentFeesMinor: string;
    expectedCancellationNoShowRefundCostMinor: string;
    otherVariableDistributionCostsMinor: string;
    totalMinor: string;
  }>;
  readonly netRoomRevenueMinor: string;
  readonly incrementalServicingCostMinor: string;
  readonly contributionMinor: string;
  readonly displacedContributionMinor: string;
  readonly displacementAdjustedValueMinor: string;
  readonly perOccupiedRoomNight: Readonly<{
    grossBookedRoomRevenue: ExactPerOccupiedRoomNightEvidence;
    netRoomRevenue: ExactPerOccupiedRoomNightEvidence;
    contribution: ExactPerOccupiedRoomNightEvidence;
    displacementAdjustedValue: ExactPerOccupiedRoomNightEvidence;
  }>;
  readonly bidPrice: Readonly<{
    minimumContributionPerOccupiedRoomNightMinor: string;
    requiredContributionTotalMinor: string;
    surplusOrShortfallMinor: string;
    meetsMinimum: boolean;
  }> | null;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, subject: string): JsonObject {
  if (!isObject(value)) throw new RmsEconomicsError(`${subject} must be an object`);
  return value;
}

function requireOnlyKeys(value: JsonObject, allowed: readonly string[], subject: string): void {
  const keys = Object.keys(value);
  const expected = new Set(allowed);
  if (keys.length !== allowed.length || keys.some((key) => !expected.has(key))) {
    throw new RmsEconomicsError(`${subject} must contain exactly the supported fields`);
  }
}

function requireCurrency(value: unknown): string {
  if (typeof value !== "string" || !CURRENCY.test(value)) {
    throw new RmsEconomicsError("currency must be an uppercase three-letter code");
  }
  return value;
}

function requireRoomNights(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new RmsEconomicsError("occupiedRoomNights must be a positive safe integer");
  }
  return value as number;
}

function requireNonNegativeMoney(value: unknown, subject: string): bigint {
  if (typeof value !== "bigint" || value < 0n || value > MAX_BIGINT) {
    throw new RmsEconomicsError(`${subject} must be non-negative signed-range bigint minor units`);
  }
  return value;
}

function checkedSigned(value: bigint, subject: string): bigint {
  if (value < MIN_BIGINT || value > MAX_BIGINT) {
    throw new RmsEconomicsError(`${subject} exceeds signed-range bigint minor units`);
  }
  return value;
}

function checkedAdd(left: bigint, right: bigint, subject: string): bigint {
  return checkedSigned(left + right, subject);
}

function checkedSubtract(left: bigint, right: bigint, subject: string): bigint {
  return checkedSigned(left - right, subject);
}

function normalizeDistributionCosts(value: unknown): RmsDistributionCostsInput {
  const source = requireObject(value, "distributionCosts");
  requireOnlyKeys(source, [
    "hotelFundedCampaignDiscountMinor",
    "channelCommissionMinor",
    "transactionPaymentFeesMinor",
    "expectedCancellationNoShowRefundCostMinor",
    "otherVariableDistributionCostsMinor",
  ], "distributionCosts");
  return Object.freeze({
    hotelFundedCampaignDiscountMinor: requireNonNegativeMoney(
      source.hotelFundedCampaignDiscountMinor,
      "hotelFundedCampaignDiscountMinor",
    ),
    channelCommissionMinor: requireNonNegativeMoney(source.channelCommissionMinor, "channelCommissionMinor"),
    transactionPaymentFeesMinor: requireNonNegativeMoney(
      source.transactionPaymentFeesMinor,
      "transactionPaymentFeesMinor",
    ),
    expectedCancellationNoShowRefundCostMinor: requireNonNegativeMoney(
      source.expectedCancellationNoShowRefundCostMinor,
      "expectedCancellationNoShowRefundCostMinor",
    ),
    otherVariableDistributionCostsMinor: requireNonNegativeMoney(
      source.otherVariableDistributionCostsMinor,
      "otherVariableDistributionCostsMinor",
    ),
  });
}

function normalizeInput(value: unknown): RmsRoomEconomicsInput {
  const source = requireObject(value, "RMS room economics input");
  requireOnlyKeys(source, [
    "currency",
    "occupiedRoomNights",
    "taxBasis",
    "grossBookedRoomRevenueMinor",
    "distributionCosts",
    "incrementalServicingCostMinor",
    "displacedContributionMinor",
    "minimumAcceptableContributionPerRoomNightMinor",
  ], "RMS room economics input");
  if (source.taxBasis !== RMS_ROOM_ECONOMICS_BASIS.taxBasis) {
    throw new RmsEconomicsError(`taxBasis must be ${RMS_ROOM_ECONOMICS_BASIS.taxBasis}`);
  }
  const minimum = source.minimumAcceptableContributionPerRoomNightMinor;
  if (minimum !== null && typeof minimum !== "bigint") {
    throw new RmsEconomicsError(
      "minimumAcceptableContributionPerRoomNightMinor must be null or non-negative signed-range bigint minor units",
    );
  }
  return Object.freeze({
    currency: requireCurrency(source.currency),
    occupiedRoomNights: requireRoomNights(source.occupiedRoomNights),
    taxBasis: source.taxBasis,
    grossBookedRoomRevenueMinor: requireNonNegativeMoney(
      source.grossBookedRoomRevenueMinor,
      "grossBookedRoomRevenueMinor",
    ),
    distributionCosts: normalizeDistributionCosts(source.distributionCosts),
    incrementalServicingCostMinor: requireNonNegativeMoney(
      source.incrementalServicingCostMinor,
      "incrementalServicingCostMinor",
    ),
    displacedContributionMinor: requireNonNegativeMoney(
      source.displacedContributionMinor,
      "displacedContributionMinor",
    ),
    minimumAcceptableContributionPerRoomNightMinor: minimum === null
      ? null
      : requireNonNegativeMoney(minimum, "minimumAcceptableContributionPerRoomNightMinor"),
  });
}

function exactPerRoomNight(numeratorMinor: bigint, occupiedRoomNights: number): ExactPerOccupiedRoomNightValue {
  const denominator = BigInt(occupiedRoomNights);
  return Object.freeze({
    numeratorMinor,
    denominatorOccupiedRoomNights: occupiedRoomNights,
    quotientMinor: numeratorMinor / denominator,
    remainderMinor: numeratorMinor % denominator,
  });
}

function distributionTotal(costs: RmsDistributionCostsInput): bigint {
  let total = 0n;
  total = checkedAdd(total, costs.hotelFundedCampaignDiscountMinor, "distribution cost total");
  total = checkedAdd(total, costs.channelCommissionMinor, "distribution cost total");
  total = checkedAdd(total, costs.transactionPaymentFeesMinor, "distribution cost total");
  total = checkedAdd(total, costs.expectedCancellationNoShowRefundCostMinor, "distribution cost total");
  return checkedAdd(total, costs.otherVariableDistributionCostsMinor, "distribution cost total");
}

export function calculateRmsRoomEconomics(value: unknown): RmsRoomEconomics {
  const input = normalizeInput(value);
  const totalDistributionCost = distributionTotal(input.distributionCosts);
  const netRoomRevenue = checkedSubtract(
    input.grossBookedRoomRevenueMinor,
    totalDistributionCost,
    "net room revenue",
  );
  const contribution = checkedSubtract(
    netRoomRevenue,
    input.incrementalServicingCostMinor,
    "room contribution",
  );
  const displacementAdjustedValue = checkedSubtract(
    contribution,
    input.displacedContributionMinor,
    "displacement-adjusted value",
  );
  const distributionCosts = Object.freeze({
    ...input.distributionCosts,
    totalMinor: totalDistributionCost,
  });
  const perOccupiedRoomNight = Object.freeze({
    grossBookedRoomRevenue: exactPerRoomNight(input.grossBookedRoomRevenueMinor, input.occupiedRoomNights),
    netRoomRevenue: exactPerRoomNight(netRoomRevenue, input.occupiedRoomNights),
    contribution: exactPerRoomNight(contribution, input.occupiedRoomNights),
    displacementAdjustedValue: exactPerRoomNight(displacementAdjustedValue, input.occupiedRoomNights),
  });
  let bidPrice: RmsBidPriceComparison | null = null;
  if (input.minimumAcceptableContributionPerRoomNightMinor !== null) {
    const required = checkedSigned(
      input.minimumAcceptableContributionPerRoomNightMinor * BigInt(input.occupiedRoomNights),
      "required bid-price contribution total",
    );
    const surplus = checkedSubtract(contribution, required, "bid-price surplus or shortfall");
    bidPrice = Object.freeze({
      minimumContributionPerOccupiedRoomNightMinor: input.minimumAcceptableContributionPerRoomNightMinor,
      requiredContributionTotalMinor: required,
      surplusOrShortfallMinor: surplus,
      meetsMinimum: surplus >= 0n,
    });
  }
  return Object.freeze({
    schemaVersion: 1,
    basis: RMS_ROOM_ECONOMICS_BASIS,
    currency: input.currency,
    occupiedRoomNights: input.occupiedRoomNights,
    grossBookedRoomRevenueMinor: input.grossBookedRoomRevenueMinor,
    distributionCosts,
    netRoomRevenueMinor: netRoomRevenue,
    incrementalServicingCostMinor: input.incrementalServicingCostMinor,
    contributionMinor: contribution,
    displacedContributionMinor: input.displacedContributionMinor,
    displacementAdjustedValueMinor: displacementAdjustedValue,
    perOccupiedRoomNight,
    bidPrice,
  });
}

function ratioEvidence(value: ExactPerOccupiedRoomNightValue): ExactPerOccupiedRoomNightEvidence {
  return Object.freeze({
    numeratorMinor: value.numeratorMinor.toString(),
    denominatorOccupiedRoomNights: value.denominatorOccupiedRoomNights,
    quotientMinor: value.quotientMinor.toString(),
    remainderMinor: value.remainderMinor.toString(),
  });
}

export function rmsRoomEconomicsEvidence(value: RmsRoomEconomics): RmsRoomEconomicsEvidence {
  if (!Object.isFrozen(value) || value.schemaVersion !== 1 || value.basis !== RMS_ROOM_ECONOMICS_BASIS) {
    throw new RmsEconomicsError("evidence input must come from calculateRmsRoomEconomics");
  }
  return Object.freeze({
    schemaVersion: 1,
    basis: RMS_ROOM_ECONOMICS_BASIS,
    currency: value.currency,
    occupiedRoomNights: value.occupiedRoomNights,
    grossBookedRoomRevenueMinor: value.grossBookedRoomRevenueMinor.toString(),
    distributionCosts: Object.freeze({
      hotelFundedCampaignDiscountMinor: value.distributionCosts.hotelFundedCampaignDiscountMinor.toString(),
      channelCommissionMinor: value.distributionCosts.channelCommissionMinor.toString(),
      transactionPaymentFeesMinor: value.distributionCosts.transactionPaymentFeesMinor.toString(),
      expectedCancellationNoShowRefundCostMinor:
        value.distributionCosts.expectedCancellationNoShowRefundCostMinor.toString(),
      otherVariableDistributionCostsMinor: value.distributionCosts.otherVariableDistributionCostsMinor.toString(),
      totalMinor: value.distributionCosts.totalMinor.toString(),
    }),
    netRoomRevenueMinor: value.netRoomRevenueMinor.toString(),
    incrementalServicingCostMinor: value.incrementalServicingCostMinor.toString(),
    contributionMinor: value.contributionMinor.toString(),
    displacedContributionMinor: value.displacedContributionMinor.toString(),
    displacementAdjustedValueMinor: value.displacementAdjustedValueMinor.toString(),
    perOccupiedRoomNight: Object.freeze({
      grossBookedRoomRevenue: ratioEvidence(value.perOccupiedRoomNight.grossBookedRoomRevenue),
      netRoomRevenue: ratioEvidence(value.perOccupiedRoomNight.netRoomRevenue),
      contribution: ratioEvidence(value.perOccupiedRoomNight.contribution),
      displacementAdjustedValue: ratioEvidence(value.perOccupiedRoomNight.displacementAdjustedValue),
    }),
    bidPrice: value.bidPrice === null ? null : Object.freeze({
      minimumContributionPerOccupiedRoomNightMinor:
        value.bidPrice.minimumContributionPerOccupiedRoomNightMinor.toString(),
      requiredContributionTotalMinor: value.bidPrice.requiredContributionTotalMinor.toString(),
      surplusOrShortfallMinor: value.bidPrice.surplusOrShortfallMinor.toString(),
      meetsMinimum: value.bidPrice.meetsMinimum,
    }),
  });
}
