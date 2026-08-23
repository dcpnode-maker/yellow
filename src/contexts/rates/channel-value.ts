const CURRENCY = /^[A-Z]{3}$/;
const MAX_BIGINT = 9_223_372_036_854_775_807n;
const MIN_BIGINT = -9_223_372_036_854_775_808n;

type JsonObject = Record<string, unknown>;

export const CHANNEL_BOOKED_VALUE_BASIS = Object.freeze({
  grossBookedRoomRevenue:
    "before_hotel_and_channel_funded_guest_discounts_excluding_non_room_charges_and_tax" as const,
  guestBookedTotal:
    "guest_room_price_after_discounts_plus_mandatory_non_room_charge_and_tax_government_pass_through" as const,
  hotelRoomReceivable:
    "gross_booked_room_revenue_minus_hotel_funded_guest_discount_before_other_distribution_costs" as const,
  denominator: "occupied_room_nights" as const,
  mandatoryNonRoomChargeIsRoomRevenue: false as const,
  taxAndGovernmentPassThroughIsRoomRevenue: false as const,
  channelFundedGuestDiscountIsHotelCost: false as const,
  financialRecognitionAuthority: false as const,
  taxCalculationAuthority: false as const,
});

export class ChannelBookedValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannelBookedValueError";
  }
}

export interface ChannelBookedValueInput {
  readonly currency: string;
  readonly occupiedRoomNights: number;
  readonly grossBookedRoomRevenueMinor: bigint;
  readonly hotelFundedGuestDiscountMinor: bigint;
  readonly channelFundedGuestDiscountMinor: bigint;
  readonly mandatoryNonRoomChargeMinor: bigint;
  readonly taxAndGovernmentPassThroughMinor: bigint;
}

export interface ChannelPerOccupiedRoomNightValue {
  readonly numeratorMinor: bigint;
  readonly denominatorOccupiedRoomNights: number;
  readonly quotientMinor: bigint;
  readonly remainderMinor: bigint;
}

export interface ChannelBookedValue {
  readonly schemaVersion: 1;
  readonly basis: typeof CHANNEL_BOOKED_VALUE_BASIS;
  readonly currency: string;
  readonly occupiedRoomNights: number;
  readonly grossBookedRoomRevenueMinor: bigint;
  readonly hotelFundedGuestDiscountMinor: bigint;
  readonly channelFundedGuestDiscountMinor: bigint;
  readonly mandatoryNonRoomChargeMinor: bigint;
  readonly taxAndGovernmentPassThroughMinor: bigint;
  readonly guestRoomPriceMinor: bigint;
  readonly grossGuestValueBeforeDiscountsMinor: bigint;
  readonly guestBookedTotalMinor: bigint;
  readonly hotelRoomReceivableBeforeOtherDistributionCostsMinor: bigint;
  readonly rmsRoomEconomicsMapping: Readonly<{
    grossBookedRoomRevenueMinor: bigint;
    hotelFundedCampaignDiscountMinor: bigint;
    channelFundedGuestDiscountExcludedMinor: bigint;
    mandatoryNonRoomChargeExcludedMinor: bigint;
    taxAndGovernmentPassThroughExcludedMinor: bigint;
  }>;
  readonly perOccupiedRoomNight: Readonly<{
    grossBookedRoomRevenue: ChannelPerOccupiedRoomNightValue;
    guestRoomPrice: ChannelPerOccupiedRoomNightValue;
    grossGuestValueBeforeDiscounts: ChannelPerOccupiedRoomNightValue;
    guestBookedTotal: ChannelPerOccupiedRoomNightValue;
    hotelRoomReceivableBeforeOtherDistributionCosts: ChannelPerOccupiedRoomNightValue;
  }>;
}

export interface ChannelPerOccupiedRoomNightEvidence {
  readonly numeratorMinor: string;
  readonly denominatorOccupiedRoomNights: number;
  readonly quotientMinor: string;
  readonly remainderMinor: string;
}

export interface ChannelBookedValueEvidence {
  readonly schemaVersion: 1;
  readonly basis: typeof CHANNEL_BOOKED_VALUE_BASIS;
  readonly currency: string;
  readonly occupiedRoomNights: number;
  readonly grossBookedRoomRevenueMinor: string;
  readonly hotelFundedGuestDiscountMinor: string;
  readonly channelFundedGuestDiscountMinor: string;
  readonly mandatoryNonRoomChargeMinor: string;
  readonly taxAndGovernmentPassThroughMinor: string;
  readonly guestRoomPriceMinor: string;
  readonly grossGuestValueBeforeDiscountsMinor: string;
  readonly guestBookedTotalMinor: string;
  readonly hotelRoomReceivableBeforeOtherDistributionCostsMinor: string;
  readonly rmsRoomEconomicsMapping: Readonly<{
    grossBookedRoomRevenueMinor: string;
    hotelFundedCampaignDiscountMinor: string;
    channelFundedGuestDiscountExcludedMinor: string;
    mandatoryNonRoomChargeExcludedMinor: string;
    taxAndGovernmentPassThroughExcludedMinor: string;
  }>;
  readonly perOccupiedRoomNight: Readonly<{
    grossBookedRoomRevenue: ChannelPerOccupiedRoomNightEvidence;
    guestRoomPrice: ChannelPerOccupiedRoomNightEvidence;
    grossGuestValueBeforeDiscounts: ChannelPerOccupiedRoomNightEvidence;
    guestBookedTotal: ChannelPerOccupiedRoomNightEvidence;
    hotelRoomReceivableBeforeOtherDistributionCosts: ChannelPerOccupiedRoomNightEvidence;
  }>;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown): JsonObject {
  if (!isObject(value)) throw new ChannelBookedValueError("channel booked-value input must be an object");
  return value;
}

function requireOnlyKeys(value: JsonObject, allowed: readonly string[]): void {
  const expected = new Set(allowed);
  const keys = Object.keys(value);
  if (keys.length !== allowed.length || keys.some((key) => !expected.has(key))) {
    throw new ChannelBookedValueError("channel booked-value input must contain exactly the supported fields");
  }
}

function requireCurrency(value: unknown): string {
  if (typeof value !== "string" || !CURRENCY.test(value)) {
    throw new ChannelBookedValueError("currency must be an uppercase three-letter code");
  }
  return value;
}

function requireRoomNights(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new ChannelBookedValueError("occupiedRoomNights must be a positive safe integer");
  }
  return value as number;
}

function requireMoney(value: unknown, subject: string): bigint {
  if (typeof value !== "bigint" || value < 0n || value > MAX_BIGINT) {
    throw new ChannelBookedValueError(`${subject} must be non-negative signed-range bigint minor units`);
  }
  return value;
}

function checkedSigned(value: bigint, subject: string): bigint {
  if (value < MIN_BIGINT || value > MAX_BIGINT) {
    throw new ChannelBookedValueError(`${subject} exceeds signed-range bigint minor units`);
  }
  return value;
}

function checkedAdd(left: bigint, right: bigint, subject: string): bigint {
  return checkedSigned(left + right, subject);
}

function checkedSubtract(left: bigint, right: bigint, subject: string): bigint {
  return checkedSigned(left - right, subject);
}

function exactPerRoomNight(
  numeratorMinor: bigint,
  occupiedRoomNights: number,
): ChannelPerOccupiedRoomNightValue {
  const denominator = BigInt(occupiedRoomNights);
  return Object.freeze({
    numeratorMinor,
    denominatorOccupiedRoomNights: occupiedRoomNights,
    quotientMinor: numeratorMinor / denominator,
    remainderMinor: numeratorMinor % denominator,
  });
}

export function calculateChannelBookedValue(value: unknown): ChannelBookedValue {
  const source = requireObject(value);
  requireOnlyKeys(source, [
    "currency",
    "occupiedRoomNights",
    "grossBookedRoomRevenueMinor",
    "hotelFundedGuestDiscountMinor",
    "channelFundedGuestDiscountMinor",
    "mandatoryNonRoomChargeMinor",
    "taxAndGovernmentPassThroughMinor",
  ]);
  const input: ChannelBookedValueInput = Object.freeze({
    currency: requireCurrency(source.currency),
    occupiedRoomNights: requireRoomNights(source.occupiedRoomNights),
    grossBookedRoomRevenueMinor: requireMoney(
      source.grossBookedRoomRevenueMinor,
      "grossBookedRoomRevenueMinor",
    ),
    hotelFundedGuestDiscountMinor: requireMoney(
      source.hotelFundedGuestDiscountMinor,
      "hotelFundedGuestDiscountMinor",
    ),
    channelFundedGuestDiscountMinor: requireMoney(
      source.channelFundedGuestDiscountMinor,
      "channelFundedGuestDiscountMinor",
    ),
    mandatoryNonRoomChargeMinor: requireMoney(
      source.mandatoryNonRoomChargeMinor,
      "mandatoryNonRoomChargeMinor",
    ),
    taxAndGovernmentPassThroughMinor: requireMoney(
      source.taxAndGovernmentPassThroughMinor,
      "taxAndGovernmentPassThroughMinor",
    ),
  });
  const totalGuestDiscount = checkedAdd(
    input.hotelFundedGuestDiscountMinor,
    input.channelFundedGuestDiscountMinor,
    "total guest discount",
  );
  if (totalGuestDiscount > input.grossBookedRoomRevenueMinor) {
    throw new ChannelBookedValueError("combined guest discount cannot exceed gross booked room revenue");
  }
  const guestRoomPrice = checkedSubtract(
    input.grossBookedRoomRevenueMinor,
    totalGuestDiscount,
    "guest room price",
  );
  const grossGuestValueBeforeDiscounts = checkedAdd(
    checkedAdd(
      input.grossBookedRoomRevenueMinor,
      input.mandatoryNonRoomChargeMinor,
      "gross guest value before discounts",
    ),
    input.taxAndGovernmentPassThroughMinor,
    "gross guest value before discounts",
  );
  const guestBookedTotal = checkedAdd(
    checkedAdd(guestRoomPrice, input.mandatoryNonRoomChargeMinor, "guest booked total"),
    input.taxAndGovernmentPassThroughMinor,
    "guest booked total",
  );
  const hotelRoomReceivable = checkedSubtract(
    input.grossBookedRoomRevenueMinor,
    input.hotelFundedGuestDiscountMinor,
    "hotel room receivable before other distribution costs",
  );
  if (checkedAdd(guestRoomPrice, input.channelFundedGuestDiscountMinor, "hotel room receivable identity")
    !== hotelRoomReceivable) {
    throw new ChannelBookedValueError("hotel room receivable identity failed");
  }
  const rmsRoomEconomicsMapping = Object.freeze({
    grossBookedRoomRevenueMinor: input.grossBookedRoomRevenueMinor,
    hotelFundedCampaignDiscountMinor: input.hotelFundedGuestDiscountMinor,
    channelFundedGuestDiscountExcludedMinor: input.channelFundedGuestDiscountMinor,
    mandatoryNonRoomChargeExcludedMinor: input.mandatoryNonRoomChargeMinor,
    taxAndGovernmentPassThroughExcludedMinor: input.taxAndGovernmentPassThroughMinor,
  });
  const perOccupiedRoomNight = Object.freeze({
    grossBookedRoomRevenue: exactPerRoomNight(
      input.grossBookedRoomRevenueMinor,
      input.occupiedRoomNights,
    ),
    guestRoomPrice: exactPerRoomNight(guestRoomPrice, input.occupiedRoomNights),
    grossGuestValueBeforeDiscounts: exactPerRoomNight(
      grossGuestValueBeforeDiscounts,
      input.occupiedRoomNights,
    ),
    guestBookedTotal: exactPerRoomNight(guestBookedTotal, input.occupiedRoomNights),
    hotelRoomReceivableBeforeOtherDistributionCosts: exactPerRoomNight(
      hotelRoomReceivable,
      input.occupiedRoomNights,
    ),
  });
  return Object.freeze({
    schemaVersion: 1,
    basis: CHANNEL_BOOKED_VALUE_BASIS,
    ...input,
    guestRoomPriceMinor: guestRoomPrice,
    grossGuestValueBeforeDiscountsMinor: grossGuestValueBeforeDiscounts,
    guestBookedTotalMinor: guestBookedTotal,
    hotelRoomReceivableBeforeOtherDistributionCostsMinor: hotelRoomReceivable,
    rmsRoomEconomicsMapping,
    perOccupiedRoomNight,
  });
}

function recursivelyFrozen(value: unknown): boolean {
  if (!isObject(value)) return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(recursivelyFrozen);
}

function exactStructure(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!isObject(left) || !isObject(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && exactStructure(left[key], right[key]));
}

function canonicalEvidenceSource(value: ChannelBookedValue): ChannelBookedValue {
  if (!recursivelyFrozen(value) || value.schemaVersion !== 1 || value.basis !== CHANNEL_BOOKED_VALUE_BASIS) {
    throw new ChannelBookedValueError("evidence requires an immutable canonical channel booked value");
  }
  const canonical = calculateChannelBookedValue({
    currency: value.currency,
    occupiedRoomNights: value.occupiedRoomNights,
    grossBookedRoomRevenueMinor: value.grossBookedRoomRevenueMinor,
    hotelFundedGuestDiscountMinor: value.hotelFundedGuestDiscountMinor,
    channelFundedGuestDiscountMinor: value.channelFundedGuestDiscountMinor,
    mandatoryNonRoomChargeMinor: value.mandatoryNonRoomChargeMinor,
    taxAndGovernmentPassThroughMinor: value.taxAndGovernmentPassThroughMinor,
  });
  if (!exactStructure(value, canonical)) {
    throw new ChannelBookedValueError("channel booked value does not match its canonical calculation");
  }
  return canonical;
}

function ratioEvidence(value: ChannelPerOccupiedRoomNightValue): ChannelPerOccupiedRoomNightEvidence {
  return Object.freeze({
    numeratorMinor: value.numeratorMinor.toString(),
    denominatorOccupiedRoomNights: value.denominatorOccupiedRoomNights,
    quotientMinor: value.quotientMinor.toString(),
    remainderMinor: value.remainderMinor.toString(),
  });
}

export function channelBookedValueEvidence(value: ChannelBookedValue): ChannelBookedValueEvidence {
  value = canonicalEvidenceSource(value);
  return Object.freeze({
    schemaVersion: 1,
    basis: CHANNEL_BOOKED_VALUE_BASIS,
    currency: value.currency,
    occupiedRoomNights: value.occupiedRoomNights,
    grossBookedRoomRevenueMinor: value.grossBookedRoomRevenueMinor.toString(),
    hotelFundedGuestDiscountMinor: value.hotelFundedGuestDiscountMinor.toString(),
    channelFundedGuestDiscountMinor: value.channelFundedGuestDiscountMinor.toString(),
    mandatoryNonRoomChargeMinor: value.mandatoryNonRoomChargeMinor.toString(),
    taxAndGovernmentPassThroughMinor: value.taxAndGovernmentPassThroughMinor.toString(),
    guestRoomPriceMinor: value.guestRoomPriceMinor.toString(),
    grossGuestValueBeforeDiscountsMinor: value.grossGuestValueBeforeDiscountsMinor.toString(),
    guestBookedTotalMinor: value.guestBookedTotalMinor.toString(),
    hotelRoomReceivableBeforeOtherDistributionCostsMinor:
      value.hotelRoomReceivableBeforeOtherDistributionCostsMinor.toString(),
    rmsRoomEconomicsMapping: Object.freeze({
      grossBookedRoomRevenueMinor: value.rmsRoomEconomicsMapping.grossBookedRoomRevenueMinor.toString(),
      hotelFundedCampaignDiscountMinor:
        value.rmsRoomEconomicsMapping.hotelFundedCampaignDiscountMinor.toString(),
      channelFundedGuestDiscountExcludedMinor:
        value.rmsRoomEconomicsMapping.channelFundedGuestDiscountExcludedMinor.toString(),
      mandatoryNonRoomChargeExcludedMinor:
        value.rmsRoomEconomicsMapping.mandatoryNonRoomChargeExcludedMinor.toString(),
      taxAndGovernmentPassThroughExcludedMinor:
        value.rmsRoomEconomicsMapping.taxAndGovernmentPassThroughExcludedMinor.toString(),
    }),
    perOccupiedRoomNight: Object.freeze({
      grossBookedRoomRevenue: ratioEvidence(value.perOccupiedRoomNight.grossBookedRoomRevenue),
      guestRoomPrice: ratioEvidence(value.perOccupiedRoomNight.guestRoomPrice),
      grossGuestValueBeforeDiscounts: ratioEvidence(
        value.perOccupiedRoomNight.grossGuestValueBeforeDiscounts,
      ),
      guestBookedTotal: ratioEvidence(value.perOccupiedRoomNight.guestBookedTotal),
      hotelRoomReceivableBeforeOtherDistributionCosts: ratioEvidence(
        value.perOccupiedRoomNight.hotelRoomReceivableBeforeOtherDistributionCosts,
      ),
    }),
  });
}
