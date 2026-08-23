import {
  AvailabilityService,
  type AppliedOperationalBlock,
  type AppliedRestriction,
  type AvailabilityOption,
} from "../inventory";
import {
  RATE_TARGET_COMMERCIAL_KEYS,
  RateConfigurationService,
  RateQuoteError,
  RateQuoteNotFoundError,
  RateQuoteService,
  type RatePackageEvidence,
  type RatePlan,
  type RateQuote,
  type RateQuoteTaxAssignmentEvidence,
  type RateTargetCommercial,
} from "../rates";
import type { Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UPPER_CODE = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const CHANNEL_CODE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const CURRENCY = /^[A-Z]{3}$/;
const MAX_CANDIDATE_PAIRS = 1_000;
const MAX_STAY_MILLISECONDS = 732 * 86_400_000;

type OfferState = "bookable" | "blocked" | "unpriced" | "conflict";
type PolicyKind = "cancellation" | "deposit" | "guarantee" | "no_show";
type OfferIssueReason = "publication_unavailable" | "pricing_evidence_unavailable";

export class ReservationOfferValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationOfferValidationError";
  }
}

export class ReservationOfferSearchTooBroadError extends ReservationOfferValidationError {
  constructor(message: string) {
    super(message);
    this.name = "ReservationOfferSearchTooBroadError";
  }
}

export interface ReservationOfferSearchInput {
  readonly propertyNode: string;
  readonly stayStart: Date;
  readonly stayEnd: Date;
  readonly guests: Readonly<{
    adults: number;
    childAges: readonly number[];
  }>;
  readonly unitTypeCodes?: readonly string[];
  readonly ratePlanCodes?: readonly string[];
  readonly attributes?: Readonly<{ genderPolicy: "any" | "female" | "male" }>;
  readonly channelCode: string;
  readonly currency?: string;
  readonly selectedPromotionCodes?: readonly string[];
  readonly commercial?: RateTargetCommercial;
}

export interface ReservationOfferPolicyEvidence {
  readonly policyId: string;
  readonly evidenceRef: string;
}

export interface ReservationOffer {
  readonly optionRef: string;
  readonly state: OfferState;
  readonly reason: string | null;
  readonly bookable: boolean;
  readonly promise: false;
  readonly commitArbitrationRequired: true;
  readonly sellableUnit: Readonly<{ id: string; name: string }>;
  readonly unitType: Readonly<{
    id: string;
    code: string;
    name: string;
    profileKey: string;
    maxOccupancy: number;
  }>;
  readonly ratePlan: Readonly<{
    id: string;
    code: string;
    name: string;
    currency: string;
    taxInclusive: boolean;
  }>;
  readonly release: Readonly<{
    id: string;
    version: number;
    contentHash: string;
  }>;
  readonly stay: Readonly<{
    from: string;
    to: string;
    localFrom: string;
    localTo: string;
  }>;
  readonly party: Readonly<{ adults: number; childAges: readonly number[] }>;
  readonly perNight: readonly Readonly<{ date: string; amountMinor: bigint }>[];
  readonly total: Readonly<{ amountMinor: bigint; currency: string; kind: "pre_tax" }> | null;
  readonly taxes: readonly RateQuoteTaxAssignmentEvidence[];
  readonly taxAssignmentState: RateQuote["taxAssignmentState"];
  readonly policies: Readonly<Record<PolicyKind, ReservationOfferPolicyEvidence | null>>;
  readonly package: RatePackageEvidence | null;
  readonly selectedPromotionCodes: readonly string[];
  readonly appliedPromotionCodes: readonly string[];
  readonly refundTreatment: "policy" | "non_refundable";
  readonly restrictionsApplied: readonly AppliedRestriction[];
  readonly operationalBlocksApplied: readonly AppliedOperationalBlock[];
  readonly availableCount: number;
  readonly evidence: Readonly<{
    quoteHash: string;
    availabilityRef: string;
    bookingInstant: string;
  }>;
}

export interface ReservationOfferIssue {
  readonly sellableUnitId: string;
  readonly unitTypeCode: string;
  readonly ratePlanId: string;
  readonly ratePlanCode: string;
  readonly reason: OfferIssueReason;
}

export interface ReservationOfferSearchSummary {
  readonly inventoryOptions: number;
  readonly candidatePairs: number;
  readonly evaluatedPairs: number;
  readonly bookable: number;
  readonly blocked: number;
  readonly unpriced: number;
  readonly conflicted: number;
  readonly publicationUnavailable: number;
  readonly pricingEvidenceUnavailable: number;
  readonly workLimit: number;
}

export interface ReservationOfferSearchResult {
  readonly options: readonly ReservationOffer[];
  readonly issues: readonly ReservationOfferIssue[];
  readonly summary: ReservationOfferSearchSummary;
}

export interface ReservationOfferSearchOptions {
  readonly maxCandidatePairs?: number;
}

type RatePlanReader = Pick<RateConfigurationService, "listRatePlans">;
type QuoteResolver = Pick<RateQuoteService, "resolve">;

interface NormalizedOfferSearchInput extends Omit<ReservationOfferSearchInput,
  "stayStart" | "stayEnd" | "guests" | "unitTypeCodes" | "ratePlanCodes" |
  "attributes" | "selectedPromotionCodes" | "commercial"
> {
  readonly stayStart: Date;
  readonly stayEnd: Date;
  readonly guests: Readonly<{ adults: number; childAges: readonly number[] }>;
  readonly unitTypeCodes: readonly string[];
  readonly ratePlanCodes: readonly string[];
  readonly attributes: Readonly<{ genderPolicy: "any" | "female" | "male" }> | null;
  readonly selectedPromotionCodes: readonly string[];
  readonly commercial: RateTargetCommercial;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, subject: string): Record<string, unknown> {
  if (!isObject(value)) throw new ReservationOfferValidationError(`${subject} must be an object`);
  return value;
}

function requireOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], subject: string): void {
  const names = new Set(allowed);
  if (Object.keys(value).some((key) => !names.has(key))) {
    throw new ReservationOfferValidationError(`${subject} contains unsupported fields`);
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ReservationOfferValidationError(`${name} must be a UUID`);
  }
  return value;
}

function requireInteger(name: string, value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new ReservationOfferValidationError(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value as number;
}

function requireDate(name: string, value: unknown): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new ReservationOfferValidationError(`${name} must be a finite Date`);
  }
  return new Date(value.getTime());
}

function normalizeCodeList(name: string, value: unknown): readonly string[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length < 1 || value.length > 50 ||
      value.some((code) => typeof code !== "string" || !UPPER_CODE.test(code))) {
    throw new ReservationOfferValidationError(`${name} must contain 1 to 50 uppercase stable codes`);
  }
  if (new Set(value).size !== value.length) {
    throw new ReservationOfferValidationError(`${name} must not contain duplicate codes`);
  }
  return Object.freeze([...value] as string[]);
}

function normalizeCommercial(value: unknown, channelCode: string): RateTargetCommercial {
  const source = value === undefined ? {} : requireObject(value, "commercial");
  requireOnlyKeys(source, RATE_TARGET_COMMERCIAL_KEYS, "commercial");
  const result: Record<string, string> = {};
  for (const key of RATE_TARGET_COMMERCIAL_KEYS) {
    const candidate = source[key];
    if (candidate === undefined) continue;
    if (key === "companyPartyId" || key === "sourcePartyId" || key === "agentPartyId") {
      result[key] = requireUuid(key, candidate);
    } else if (key === "channelCode") {
      if (typeof candidate !== "string" || !CHANNEL_CODE.test(candidate)) {
        throw new ReservationOfferValidationError("commercial.channelCode must be a canonical lowercase code");
      }
      if (candidate !== channelCode) {
        throw new ReservationOfferValidationError("commercial.channelCode must match channelCode");
      }
      result[key] = candidate;
    } else {
      if (typeof candidate !== "string" || !UPPER_CODE.test(candidate)) {
        throw new ReservationOfferValidationError(`commercial.${key} must be an uppercase stable code`);
      }
      result[key] = candidate;
    }
  }
  result.channelCode = channelCode;
  return Object.freeze(result);
}

function normalizeInput(value: ReservationOfferSearchInput): NormalizedOfferSearchInput {
  const source = requireObject(value, "reservation offer search");
  requireOnlyKeys(source, [
    "propertyNode", "stayStart", "stayEnd", "guests", "unitTypeCodes", "ratePlanCodes",
    "attributes", "channelCode", "currency", "selectedPromotionCodes", "commercial",
  ], "reservation offer search");
  const stayStart = requireDate("stayStart", source.stayStart);
  const stayEnd = requireDate("stayEnd", source.stayEnd);
  if (stayStart >= stayEnd || stayEnd.getTime() - stayStart.getTime() > MAX_STAY_MILLISECONDS) {
    throw new ReservationOfferValidationError("stay must be a positive bounded half-open period");
  }
  const guests = requireObject(source.guests, "guests");
  requireOnlyKeys(guests, ["adults", "childAges"], "guests");
  if (!Array.isArray(guests.childAges) || guests.childAges.length > 30) {
    throw new ReservationOfferValidationError("guests.childAges must contain at most 30 ages");
  }
  const childAges = guests.childAges.map((age, index) =>
    requireInteger(`guests.childAges ${index}`, age, 0, 17)
  );
  const channelCode = source.channelCode;
  if (typeof channelCode !== "string" || !CHANNEL_CODE.test(channelCode)) {
    throw new ReservationOfferValidationError("channelCode must be a canonical lowercase code");
  }
  let attributes: NormalizedOfferSearchInput["attributes"] = null;
  if (source.attributes !== undefined) {
    const candidate = requireObject(source.attributes, "attributes");
    requireOnlyKeys(candidate, ["genderPolicy"], "attributes");
    if (candidate.genderPolicy !== "any" && candidate.genderPolicy !== "female" && candidate.genderPolicy !== "male") {
      throw new ReservationOfferValidationError("attributes.genderPolicy must be any, female, or male");
    }
    attributes = Object.freeze({ genderPolicy: candidate.genderPolicy });
  }
  if (source.currency !== undefined && (typeof source.currency !== "string" || !CURRENCY.test(source.currency))) {
    throw new ReservationOfferValidationError("currency must be an uppercase three-letter code");
  }
  const selectedPromotionCodes = normalizeCodeList("selectedPromotionCodes", source.selectedPromotionCodes);
  return Object.freeze({
    propertyNode: requireUuid("propertyNode", source.propertyNode),
    stayStart,
    stayEnd,
    guests: Object.freeze({
      adults: requireInteger("guests.adults", guests.adults, 1, 99),
      childAges: Object.freeze(childAges),
    }),
    unitTypeCodes: normalizeCodeList("unitTypeCodes", source.unitTypeCodes),
    ratePlanCodes: normalizeCodeList("ratePlanCodes", source.ratePlanCodes),
    attributes,
    channelCode,
    ...(source.currency === undefined ? {} : { currency: source.currency as string }),
    selectedPromotionCodes,
    commercial: normalizeCommercial(source.commercial, channelCode),
  });
}

function policyEvidence(quote: RateQuote): ReservationOffer["policies"] {
  const values = new Map(quote.result.policyEvidence.map((policy) => [policy.kind, policy]));
  const evidence = (kind: PolicyKind): ReservationOfferPolicyEvidence | null => {
    const value = values.get(kind);
    return value ? Object.freeze({ policyId: value.policyId, evidenceRef: value.evidenceRef }) : null;
  };
  return Object.freeze({
    cancellation: evidence("cancellation"),
    deposit: evidence("deposit"),
    guarantee: evidence("guarantee"),
    no_show: evidence("no_show"),
  });
}

function offerState(quote: RateQuote): OfferState {
  return quote.result.state === "quoted" ? "bookable" : quote.result.state;
}

function toOffer(plan: RatePlan, quote: RateQuote, input: NormalizedOfferSearchInput): ReservationOffer {
  const exact = quote.availabilityOption;
  if (exact.sellableUnitId !== quote.sellableUnitId || exact.unitTypeId !== quote.unitTypeId) {
    throw new Error("Rate quote returned mismatched exact availability evidence");
  }
  const state = offerState(quote);
  const bookable = state === "bookable" && quote.result.availabilityEvidence.bookable;
  if ((state === "bookable") !== bookable) {
    throw new Error("Rate quote returned inconsistent bookability state");
  }
  const perNight = bookable
    ? quote.result.rateEvaluations.map(({ nightDate, evaluationResult }) => {
      if (typeof evaluationResult.amountMinor !== "bigint" || evaluationResult.amountMinor < 0n) {
        throw new Error("Bookable rate quote did not return exact non-negative nightly money");
      }
      return Object.freeze({ date: nightDate, amountMinor: evaluationResult.amountMinor });
    })
    : [];
  let total: ReservationOffer["total"] = null;
  if (bookable) {
    const preTaxSubtotalMinor = quote.result.preTaxSubtotalMinor;
    if (typeof preTaxSubtotalMinor !== "bigint") {
      throw new Error("Bookable rate quote did not return an exact pre-tax total");
    }
    total = Object.freeze({
      amountMinor: preTaxSubtotalMinor,
      currency: quote.result.currency,
      kind: "pre_tax" as const,
    });
  }
  return Object.freeze({
    optionRef: `offer:${quote.quoteHash}`,
    state,
    reason: quote.result.reason,
    bookable,
    promise: false,
    commitArbitrationRequired: true,
    sellableUnit: Object.freeze({ id: exact.sellableUnitId, name: exact.sellableUnitName }),
    unitType: Object.freeze({
      id: exact.unitTypeId,
      code: exact.unitTypeCode,
      name: exact.unitTypeName,
      profileKey: exact.profileKey,
      maxOccupancy: exact.maxOccupancy,
    }),
    ratePlan: Object.freeze({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      currency: plan.currency,
      taxInclusive: plan.taxInclusive,
    }),
    release: Object.freeze({
      id: quote.releaseId,
      version: quote.releaseVersion,
      contentHash: quote.releaseContentHash,
    }),
    stay: Object.freeze({
      from: input.stayStart.toISOString(),
      to: input.stayEnd.toISOString(),
      localFrom: quote.stayStartDate,
      localTo: quote.stayEndDate,
    }),
    party: input.guests,
    perNight: Object.freeze(perNight),
    total,
    taxes: quote.taxAssignments,
    taxAssignmentState: quote.taxAssignmentState,
    policies: policyEvidence(quote),
    package: quote.result.packageEvidence,
    selectedPromotionCodes: quote.result.selectedPromotionCodes,
    appliedPromotionCodes: quote.result.appliedPromotionCodes,
    refundTreatment: quote.result.refundTreatment,
    restrictionsApplied: exact.restrictionsApplied,
    operationalBlocksApplied: exact.operationalBlocksApplied,
    availableCount: quote.result.availabilityEvidence.availableCount,
    evidence: Object.freeze({
      quoteHash: quote.quoteHash,
      availabilityRef: quote.result.availabilityEvidence.evidenceRef,
      bookingInstant: quote.bookingInstant,
    }),
  });
}

function compareOffers(left: ReservationOffer, right: ReservationOffer): number {
  return left.unitType.code.localeCompare(right.unitType.code) ||
    left.ratePlan.code.localeCompare(right.ratePlan.code) ||
    left.sellableUnit.name.localeCompare(right.sellableUnit.name) ||
    left.sellableUnit.id.localeCompare(right.sellableUnit.id) ||
    left.release.id.localeCompare(right.release.id);
}

function compareIssues(left: ReservationOfferIssue, right: ReservationOfferIssue): number {
  return left.unitTypeCode.localeCompare(right.unitTypeCode) ||
    left.ratePlanCode.localeCompare(right.ratePlanCode) ||
    left.sellableUnitId.localeCompare(right.sellableUnitId) ||
    left.reason.localeCompare(right.reason);
}

export class ReservationOfferSearchService {
  readonly #rates: RatePlanReader;
  readonly #quotes: QuoteResolver;
  readonly #availability: Pick<AvailabilityService, "search">;
  readonly #maxCandidatePairs: number;

  constructor(
    rates: RatePlanReader,
    quotes: QuoteResolver,
    availability: Pick<AvailabilityService, "search"> = new AvailabilityService(),
    options: ReservationOfferSearchOptions = {},
  ) {
    const maximum = options.maxCandidatePairs ?? MAX_CANDIDATE_PAIRS;
    if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > MAX_CANDIDATE_PAIRS) {
      throw new ReservationOfferValidationError("maxCandidatePairs must be an integer from 1 to 1000");
    }
    this.#rates = rates;
    this.#quotes = quotes;
    this.#availability = availability;
    this.#maxCandidatePairs = maximum;
  }

  async search(tx: Tx, value: ReservationOfferSearchInput): Promise<ReservationOfferSearchResult> {
    const input = normalizeInput(value);
    const inventory = (await this.#availability.search(tx, {
      propertyNode: input.propertyNode,
      from: input.stayStart,
      to: input.stayEnd,
      partySize: input.guests.adults + input.guests.childAges.length,
      channelCode: input.channelCode,
      ...(input.attributes === null ? {} : { genderPolicy: input.attributes.genderPolicy }),
    })).filter(({ unitTypeCode }) =>
      input.unitTypeCodes.length === 0 || input.unitTypeCodes.includes(unitTypeCode)
    );
    const plans = (await this.#rates.listRatePlans(tx, input.propertyNode)).filter((plan) =>
      plan.status === "active" &&
      (input.ratePlanCodes.length === 0 || input.ratePlanCodes.includes(plan.code)) &&
      (input.currency === undefined || input.currency === plan.currency)
    );
    const candidatePairs = inventory.length * plans.length;
    if (candidatePairs > this.#maxCandidatePairs) {
      throw new ReservationOfferSearchTooBroadError(
        `availability offer search has ${candidatePairs} pairs; narrow it below ${this.#maxCandidatePairs + 1}`,
      );
    }

    const options: ReservationOffer[] = [];
    const issues: ReservationOfferIssue[] = [];
    let evaluatedPairs = 0;
    let publicationUnavailable = 0;
    let pricingEvidenceUnavailable = 0;
    for (const inventoryOption of inventory) {
      for (const plan of plans) {
        try {
          const quote = await this.#quotes.resolve(tx, {
            propertyNode: input.propertyNode,
            ratePlanId: plan.id,
            sellableUnitId: inventoryOption.sellableUnitId,
            stayStart: input.stayStart,
            stayEnd: input.stayEnd,
            guests: input.guests,
            selectedPromotionCodes: input.selectedPromotionCodes,
            commercial: input.commercial,
            channelCode: input.channelCode,
          });
          evaluatedPairs += 1;
          options.push(toOffer(plan, quote, input));
        } catch (error) {
          if (!(error instanceof RateQuoteError)) throw error;
          const reason: OfferIssueReason = error instanceof RateQuoteNotFoundError
            ? "publication_unavailable"
            : "pricing_evidence_unavailable";
          if (reason === "publication_unavailable") publicationUnavailable += 1;
          else pricingEvidenceUnavailable += 1;
          issues.push(Object.freeze({
            sellableUnitId: inventoryOption.sellableUnitId,
            unitTypeCode: inventoryOption.unitTypeCode,
            ratePlanId: plan.id,
            ratePlanCode: plan.code,
            reason,
          }));
        }
      }
    }
    options.sort(compareOffers);
    issues.sort(compareIssues);
    const frozenOptions = Object.freeze(options);
    return Object.freeze({
      options: frozenOptions,
      issues: Object.freeze(issues),
      summary: Object.freeze({
        inventoryOptions: inventory.length,
        candidatePairs,
        evaluatedPairs,
        bookable: frozenOptions.filter(({ state }) => state === "bookable").length,
        blocked: frozenOptions.filter(({ state }) => state === "blocked").length,
        unpriced: frozenOptions.filter(({ state }) => state === "unpriced").length,
        conflicted: frozenOptions.filter(({ state }) => state === "conflict").length,
        publicationUnavailable,
        pricingEvidenceUnavailable,
        workLimit: this.#maxCandidatePairs,
      }),
    });
  }
}
