import {
  deriveRateEvaluationContext,
  evaluateRateModel,
  normalizeRateEvaluatorSpec,
} from "./evaluators";
import type {
  RateEvaluationContext,
  RateEvaluationResult,
  RateEvaluatorSpec,
} from "./evaluators";

const MAX_BIGINT = 9_223_372_036_854_775_807n;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CURRENCY = /^[A-Z]{3}$/;
const STABLE_KEY = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const HOTEL_CODE = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const CHANNEL_CODE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

const POLICY_KINDS = Object.freeze(["cancellation", "deposit", "guarantee", "no_show"] as const);
const RESTRICTION_KINDS = Object.freeze([
  "closed",
  "cta",
  "ctd",
  "min_stay",
  "max_stay",
  "min_advance",
  "max_advance",
] as const);
const OPERATIONAL_BLOCK_KINDS = Object.freeze(["out_of_order", "out_of_service"] as const);

export class RateCompositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateCompositionError";
  }
}

export interface RateGuestEligibility {
  readonly minAdults: number;
  readonly maxAdults: number;
  readonly minChildren: number;
  readonly maxChildren: number;
  readonly minTotalGuests: number;
  readonly maxTotalGuests: number;
}

export type RatePackageElementKind = "meal" | "allowance" | "service";
export type RatePackageRhythm = "per_stay" | "per_night" | "per_person" | "per_person_night";

export interface RatePackageElement {
  readonly key: string;
  readonly kind: RatePackageElementKind;
  readonly code: string;
  readonly rhythm: RatePackageRhythm;
  readonly amountMinor: bigint;
  readonly currency: string;
}

export interface RatePackageSpec {
  readonly key: string;
  readonly version: number;
  readonly includedInRate: boolean;
  readonly elements: readonly RatePackageElement[];
}

export type RatePromotionDiscount =
  | Readonly<{ kind: "amount"; amountMinor: bigint }>
  | Readonly<{ kind: "basis_points"; basisPoints: number }>;

export interface RatePromotionSpec {
  readonly code: string;
  readonly version: number;
  readonly stage: number;
  readonly priority: number;
  readonly scope: "room" | "room_and_extras";
  readonly discount: RatePromotionDiscount;
}

export interface RatePolicyConfiguration {
  readonly cancellationPolicyId: string | null;
  readonly depositPolicyId: string | null;
  readonly guaranteePolicyId: string | null;
  readonly noShowPolicyId: string | null;
  readonly refundTreatment: "policy" | "non_refundable";
}

export interface RateDistributionConfiguration {
  readonly mode: "all" | "allowlist" | "denylist";
  readonly channelCodes: readonly string[];
}

export interface RateCompositionSpec {
  readonly currency: string;
  readonly guestEligibility: RateGuestEligibility;
  readonly package: RatePackageSpec | null;
  readonly promotions: readonly RatePromotionSpec[];
  readonly policy: RatePolicyConfiguration;
  readonly distribution: RateDistributionConfiguration;
}

export interface RateGuestMix {
  readonly adults: number;
  readonly childAges: readonly number[];
}

export type RatePolicyKind = (typeof POLICY_KINDS)[number];

export interface RatePolicyEvidence {
  readonly kind: RatePolicyKind;
  readonly policyId: string;
  readonly evidenceRef: string;
}

export interface RateMandatoryPolicyEvidence {
  readonly key: string;
  readonly evidenceRef: string;
}

export type RateRestrictionEvidenceKind = (typeof RESTRICTION_KINDS)[number];
export type RateOperationalBlockKind = (typeof OPERATIONAL_BLOCK_KINDS)[number];

export interface RateRestrictionEvidence {
  readonly key: string;
  readonly kind: RateRestrictionEvidenceKind;
  readonly blocked: boolean;
  readonly evidenceRef: string;
}

export interface RateOperationalBlockEvidence {
  readonly key: string;
  readonly kind: RateOperationalBlockKind;
  readonly blocked: boolean;
  readonly evidenceRef: string;
}

export interface RateAvailabilityEvidence {
  readonly sellableUnitId: string;
  readonly availableCount: number;
  readonly bookable: boolean;
  readonly restrictionEvidence: readonly RateRestrictionEvidence[];
  readonly operationalBlockEvidence: readonly RateOperationalBlockEvidence[];
  readonly evidenceRef: string;
}

export interface RateCompositionContext {
  readonly rateEvaluatorSpec: RateEvaluatorSpec;
  readonly rateEvaluationContext: RateEvaluationContext;
  readonly rateEvaluationResult: RateEvaluationResult;
  readonly guests: RateGuestMix;
  readonly selectedPromotionCodes: readonly string[];
  readonly policyEvidence: readonly RatePolicyEvidence[];
  readonly mandatoryPolicyEvidence: readonly RateMandatoryPolicyEvidence[];
  readonly availabilityEvidence: RateAvailabilityEvidence;
  readonly channelCode: string;
  readonly channelMappingEvidenceRef: string | null;
}

export interface RatePackageElementEvidence extends RatePackageElement {
  readonly quantity: number;
  readonly totalMinor: bigint;
}

export interface RatePackageEvidence {
  readonly key: string;
  readonly version: number;
  readonly includedInRate: boolean;
  readonly elements: readonly RatePackageElementEvidence[];
}

export interface RateDistributionEvidence {
  readonly channelCode: string;
  readonly eligible: boolean;
  readonly mappingEvidenceRef: string | null;
}

export type RateCompositionState = "quoted" | "unpriced" | "blocked" | "conflict";

export interface RateCompositionResult {
  readonly state: RateCompositionState;
  readonly reason: string | null;
  readonly currency: string;
  readonly roomAmountMinor: bigint | null;
  readonly includedAllocationMinor: bigint | null;
  readonly packageExtraMinor: bigint | null;
  readonly promotionDiscountMinor: bigint | null;
  readonly preTaxSubtotalMinor: bigint | null;
  readonly selectedPromotionCodes: readonly string[];
  readonly appliedPromotionCodes: readonly string[];
  readonly conflictingPromotionCodes: readonly string[];
  readonly conflictStage: number | null;
  readonly guests: RateGuestMix;
  readonly packageEvidence: RatePackageEvidence | null;
  readonly policyEvidence: readonly RatePolicyEvidence[];
  readonly mandatoryPolicyEvidence: readonly RateMandatoryPolicyEvidence[];
  readonly refundTreatment: "policy" | "non_refundable";
  readonly restrictionEvidence: readonly RateRestrictionEvidence[];
  readonly operationalBlockEvidence: readonly RateOperationalBlockEvidence[];
  readonly availabilityEvidence: RateAvailabilityEvidence;
  readonly distributionEvidence: RateDistributionEvidence;
  readonly rateEvaluation: RateEvaluationResult;
  readonly workUnits: number;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, subject: string): JsonObject {
  if (!isObject(value)) throw new RateCompositionError(`${subject} must be an object`);
  return value;
}

function requireOnlyKeys(value: JsonObject, allowed: readonly string[], subject: string): void {
  const names = new Set(allowed);
  if (Object.keys(value).some((key) => !names.has(key))) {
    throw new RateCompositionError(`${subject} contains unsupported fields`);
  }
}

function requireFields(value: JsonObject, fields: readonly string[], subject: string): void {
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) throw new RateCompositionError(`${subject} requires ${field}`);
  }
}

function requireInteger(name: string, value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RateCompositionError(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value as number;
}

function requireAmount(name: string, value: unknown): bigint {
  if (typeof value !== "bigint" || value < 0n || value > MAX_BIGINT) {
    throw new RateCompositionError(`${name} must be a non-negative signed-bigint minor-unit value`);
  }
  return value;
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new RateCompositionError(`${name} must be a UUID`);
  }
  return value;
}

function requireNullableUuid(name: string, value: unknown): string | null {
  return value === null ? null : requireUuid(name, value);
}

function requireCurrency(value: unknown): string {
  if (typeof value !== "string" || !CURRENCY.test(value)) {
    throw new RateCompositionError("currency must be an uppercase three-letter code");
  }
  return value;
}

function requireStableKey(name: string, value: unknown): string {
  if (typeof value !== "string" || !STABLE_KEY.test(value)) {
    throw new RateCompositionError(`${name} must be bounded stable text`);
  }
  return value;
}

function requireHotelCode(name: string, value: unknown): string {
  if (typeof value !== "string" || !HOTEL_CODE.test(value)) {
    throw new RateCompositionError(`${name} must be an uppercase hotel code`);
  }
  return value;
}

function requireChannelCode(name: string, value: unknown): string {
  if (typeof value !== "string" || !CHANNEL_CODE.test(value)) {
    throw new RateCompositionError(`${name} must be a lowercase channel code`);
  }
  return value;
}

function requireBoolean(name: string, value: unknown): boolean {
  if (typeof value !== "boolean") throw new RateCompositionError(`${name} must be boolean`);
  return value;
}

function requireArray(value: unknown, subject: string, minimum: number, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new RateCompositionError(`${subject} must contain ${minimum} to ${maximum} entries`);
  }
  return value;
}

function requireUnique(values: readonly string[], subject: string): void {
  if (new Set(values).size !== values.length) throw new RateCompositionError(`${subject} must be unique`);
}

function normalizeGuestEligibility(value: unknown): RateGuestEligibility {
  const source = requireObject(value, "guestEligibility");
  const fields = ["minAdults", "maxAdults", "minChildren", "maxChildren", "minTotalGuests", "maxTotalGuests"];
  requireOnlyKeys(source, fields, "guestEligibility");
  requireFields(source, fields, "guestEligibility");
  const result = Object.freeze({
    minAdults: requireInteger("guestEligibility.minAdults", source.minAdults, 1, 99),
    maxAdults: requireInteger("guestEligibility.maxAdults", source.maxAdults, 1, 99),
    minChildren: requireInteger("guestEligibility.minChildren", source.minChildren, 0, 30),
    maxChildren: requireInteger("guestEligibility.maxChildren", source.maxChildren, 0, 30),
    minTotalGuests: requireInteger("guestEligibility.minTotalGuests", source.minTotalGuests, 1, 129),
    maxTotalGuests: requireInteger("guestEligibility.maxTotalGuests", source.maxTotalGuests, 1, 129),
  });
  if (result.minAdults > result.maxAdults || result.minChildren > result.maxChildren ||
      result.minTotalGuests > result.maxTotalGuests ||
      result.minTotalGuests > result.maxAdults + result.maxChildren ||
      result.maxTotalGuests < result.minAdults + result.minChildren) {
    throw new RateCompositionError("guestEligibility ranges must be increasing and jointly possible");
  }
  return result;
}

function normalizePackageElement(value: unknown, index: number, currency: string): RatePackageElement {
  const source = requireObject(value, `package element ${index}`);
  const fields = ["key", "kind", "code", "rhythm", "amountMinor", "currency"];
  requireOnlyKeys(source, fields, `package element ${index}`);
  requireFields(source, fields, `package element ${index}`);
  if (source.kind !== "meal" && source.kind !== "allowance" && source.kind !== "service") {
    throw new RateCompositionError(`package element ${index}.kind is invalid`);
  }
  if (source.rhythm !== "per_stay" && source.rhythm !== "per_night" &&
      source.rhythm !== "per_person" && source.rhythm !== "per_person_night") {
    throw new RateCompositionError(`package element ${index}.rhythm is invalid`);
  }
  const elementCurrency = requireCurrency(source.currency);
  if (elementCurrency !== currency) throw new RateCompositionError(`package element ${index} currency must match rate currency`);
  return Object.freeze({
    key: requireStableKey(`package element ${index}.key`, source.key),
    kind: source.kind,
    code: requireHotelCode(`package element ${index}.code`, source.code),
    rhythm: source.rhythm,
    amountMinor: requireAmount(`package element ${index}.amountMinor`, source.amountMinor),
    currency: elementCurrency,
  });
}

function normalizePackage(value: unknown, currency: string): RatePackageSpec | null {
  if (value === null) return null;
  const source = requireObject(value, "package");
  const fields = ["key", "version", "includedInRate", "elements"];
  requireOnlyKeys(source, fields, "package");
  requireFields(source, fields, "package");
  const elements = requireArray(source.elements, "package.elements", 1, 100)
    .map((element, index) => normalizePackageElement(element, index, currency));
  requireUnique(elements.map(({ key }) => key), "package element keys");
  requireUnique(elements.map(({ code }) => code), "package element codes");
  return Object.freeze({
    key: requireStableKey("package.key", source.key),
    version: requireInteger("package.version", source.version, 1, Number.MAX_SAFE_INTEGER),
    includedInRate: requireBoolean("package.includedInRate", source.includedInRate),
    elements: Object.freeze([...elements].sort((left, right) => left.key.localeCompare(right.key))),
  });
}

function normalizePromotionDiscount(value: unknown, index: number): RatePromotionDiscount {
  const source = requireObject(value, `promotion ${index}.discount`);
  if (source.kind === "amount") {
    requireOnlyKeys(source, ["kind", "amountMinor"], `promotion ${index}.discount`);
    requireFields(source, ["kind", "amountMinor"], `promotion ${index}.discount`);
    return Object.freeze({ kind: "amount", amountMinor: requireAmount(`promotion ${index}.amountMinor`, source.amountMinor) });
  }
  if (source.kind === "basis_points") {
    requireOnlyKeys(source, ["kind", "basisPoints"], `promotion ${index}.discount`);
    requireFields(source, ["kind", "basisPoints"], `promotion ${index}.discount`);
    return Object.freeze({
      kind: "basis_points",
      basisPoints: requireInteger(`promotion ${index}.basisPoints`, source.basisPoints, 0, 10_000),
    });
  }
  throw new RateCompositionError(`promotion ${index}.discount kind is invalid`);
}

function normalizePromotion(value: unknown, index: number): RatePromotionSpec {
  const source = requireObject(value, `promotion ${index}`);
  const fields = ["code", "version", "stage", "priority", "scope", "discount"];
  requireOnlyKeys(source, fields, `promotion ${index}`);
  requireFields(source, fields, `promotion ${index}`);
  if (source.scope !== "room" && source.scope !== "room_and_extras") {
    throw new RateCompositionError(`promotion ${index}.scope is invalid`);
  }
  return Object.freeze({
    code: requireHotelCode(`promotion ${index}.code`, source.code),
    version: requireInteger(`promotion ${index}.version`, source.version, 1, Number.MAX_SAFE_INTEGER),
    stage: requireInteger(`promotion ${index}.stage`, source.stage, 1, 8),
    priority: requireInteger(`promotion ${index}.priority`, source.priority, 0, 1_000),
    scope: source.scope,
    discount: normalizePromotionDiscount(source.discount, index),
  });
}

function normalizePolicyConfiguration(value: unknown): RatePolicyConfiguration {
  const source = requireObject(value, "policy");
  const fields = [
    "cancellationPolicyId",
    "depositPolicyId",
    "guaranteePolicyId",
    "noShowPolicyId",
    "refundTreatment",
  ];
  requireOnlyKeys(source, fields, "policy");
  requireFields(source, fields, "policy");
  if (source.refundTreatment !== "policy" && source.refundTreatment !== "non_refundable") {
    throw new RateCompositionError("policy.refundTreatment is invalid");
  }
  return Object.freeze({
    cancellationPolicyId: requireNullableUuid("policy.cancellationPolicyId", source.cancellationPolicyId),
    depositPolicyId: requireNullableUuid("policy.depositPolicyId", source.depositPolicyId),
    guaranteePolicyId: requireNullableUuid("policy.guaranteePolicyId", source.guaranteePolicyId),
    noShowPolicyId: requireNullableUuid("policy.noShowPolicyId", source.noShowPolicyId),
    refundTreatment: source.refundTreatment,
  });
}

function normalizeDistribution(value: unknown): RateDistributionConfiguration {
  const source = requireObject(value, "distribution");
  const fields = ["mode", "channelCodes"];
  requireOnlyKeys(source, fields, "distribution");
  requireFields(source, fields, "distribution");
  if (source.mode !== "all" && source.mode !== "allowlist" && source.mode !== "denylist") {
    throw new RateCompositionError("distribution.mode is invalid");
  }
  const channelCodes = requireArray(source.channelCodes, "distribution.channelCodes", 0, 100)
    .map((code, index) => requireChannelCode(`distribution.channelCodes ${index}`, code));
  requireUnique(channelCodes, "distribution.channelCodes");
  if (source.mode === "all" && channelCodes.length !== 0) {
    throw new RateCompositionError("distribution all mode requires an empty channel code list");
  }
  return Object.freeze({ mode: source.mode, channelCodes: Object.freeze([...channelCodes].sort()) });
}

export function normalizeRateCompositionSpec(value: unknown): RateCompositionSpec {
  const source = requireObject(value, "rate composition spec");
  const fields = ["currency", "guestEligibility", "package", "promotions", "policy", "distribution"];
  requireOnlyKeys(source, fields, "rate composition spec");
  requireFields(source, fields, "rate composition spec");
  const currency = requireCurrency(source.currency);
  const promotions = requireArray(source.promotions, "promotions", 0, 50)
    .map(normalizePromotion);
  requireUnique(promotions.map(({ code }) => code), "promotion codes");
  return Object.freeze({
    currency,
    guestEligibility: normalizeGuestEligibility(source.guestEligibility),
    package: normalizePackage(source.package, currency),
    promotions: Object.freeze([...promotions].sort((left, right) =>
      left.stage - right.stage || left.code.localeCompare(right.code)
    )),
    policy: normalizePolicyConfiguration(source.policy),
    distribution: normalizeDistribution(source.distribution),
  });
}

function exactEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((entry, index) => exactEqual(entry, right[index]));
  }
  if (isObject(left) || isObject(right)) {
    if (!isObject(left) || !isObject(right)) return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length &&
      leftKeys.every((key, index) => key === rightKeys[index] && exactEqual(left[key], right[key]));
  }
  return false;
}

function canonicalRateEvaluationContext(value: unknown): RateEvaluationContext {
  if (!Object.isFrozen(value)) {
    throw new RateCompositionError("rateEvaluationContext must be a frozen Order 067 context");
  }
  const source = requireObject(value, "rateEvaluationContext");
  requireOnlyKeys(source, [
    "propertyTimeZone",
    "bookingInstant",
    "stayStartInstant",
    "stayEndInstant",
    "bookingDate",
    "stayStartDate",
    "stayEndDate",
    "nightDate",
    "nightDowMask",
    "bookingWindowDays",
    "losNights",
    "occupancyBasisPoints",
    "occupancyEvidenceRef",
    "barLevel",
    "reference",
    "targetResolution",
  ], "rateEvaluationContext");
  const raw: JsonObject = {
    propertyTimeZone: source.propertyTimeZone,
    bookingInstant: source.bookingInstant,
    stayStartInstant: source.stayStartInstant,
    stayEndInstant: source.stayEndInstant,
    nightDate: source.nightDate,
  };
  if (source.occupancyBasisPoints !== null || source.occupancyEvidenceRef !== null) {
    raw.occupancyBasisPoints = source.occupancyBasisPoints;
    raw.occupancyEvidenceRef = source.occupancyEvidenceRef;
  }
  if (source.barLevel !== null) raw.barLevel = source.barLevel;
  if (source.reference !== null) raw.reference = source.reference;
  if (source.targetResolution !== null) raw.targetResolution = source.targetResolution;
  const canonical = deriveRateEvaluationContext(raw);
  if (!exactEqual(canonical, source)) {
    throw new RateCompositionError("rateEvaluationContext does not match its canonical Order 067 inputs");
  }
  return canonical;
}

function canonicalRateBundle(
  evaluatorSpecValue: unknown,
  evaluationContextValue: unknown,
  evaluationResultValue: unknown,
): { evaluatorSpec: RateEvaluatorSpec; evaluationContext: RateEvaluationContext; evaluationResult: RateEvaluationResult } {
  if (!Object.isFrozen(evaluatorSpecValue)) {
    throw new RateCompositionError("rateEvaluatorSpec must be a frozen Order 067 spec");
  }
  const evaluatorSpec = normalizeRateEvaluatorSpec(evaluatorSpecValue);
  if (!exactEqual(evaluatorSpec, evaluatorSpecValue)) {
    throw new RateCompositionError("rateEvaluatorSpec does not match its canonical Order 067 form");
  }
  const evaluationContext = canonicalRateEvaluationContext(evaluationContextValue);
  if (!Object.isFrozen(evaluationResultValue)) {
    throw new RateCompositionError("rateEvaluationResult must be a frozen Order 067 result");
  }
  const evaluationResult = evaluateRateModel(evaluatorSpec, evaluationContext);
  if (!exactEqual(evaluationResult, evaluationResultValue)) {
    throw new RateCompositionError("rateEvaluationResult does not match the supplied Order 067 spec and context");
  }
  return { evaluatorSpec, evaluationContext, evaluationResult };
}

function normalizeGuests(value: unknown): RateGuestMix {
  const source = requireObject(value, "guests");
  requireOnlyKeys(source, ["adults", "childAges"], "guests");
  requireFields(source, ["adults", "childAges"], "guests");
  const childAges = requireArray(source.childAges, "guests.childAges", 0, 30)
    .map((age, index) => requireInteger(`guests.childAges ${index}`, age, 0, 17));
  return Object.freeze({
    adults: requireInteger("guests.adults", source.adults, 1, 99),
    childAges: Object.freeze([...childAges]),
  });
}

function requirePolicyKind(value: unknown, subject: string): RatePolicyKind {
  if (typeof value !== "string" || !POLICY_KINDS.includes(value as RatePolicyKind)) {
    throw new RateCompositionError(`${subject} is invalid`);
  }
  return value as RatePolicyKind;
}

function normalizePolicyEvidenceItem(value: unknown, index: number): RatePolicyEvidence {
  const source = requireObject(value, `policyEvidence ${index}`);
  const fields = ["kind", "policyId", "evidenceRef"];
  requireOnlyKeys(source, fields, `policyEvidence ${index}`);
  requireFields(source, fields, `policyEvidence ${index}`);
  return Object.freeze({
    kind: requirePolicyKind(source.kind, `policyEvidence ${index}.kind`),
    policyId: requireUuid(`policyEvidence ${index}.policyId`, source.policyId),
    evidenceRef: requireStableKey(`policyEvidence ${index}.evidenceRef`, source.evidenceRef),
  });
}

function normalizeMandatoryPolicyEvidence(value: unknown): readonly RateMandatoryPolicyEvidence[] {
  const evidence = requireArray(value, "mandatoryPolicyEvidence", 0, 100).map((entry, index) => {
    const source = requireObject(entry, `mandatoryPolicyEvidence ${index}`);
    requireOnlyKeys(source, ["key", "evidenceRef"], `mandatoryPolicyEvidence ${index}`);
    requireFields(source, ["key", "evidenceRef"], `mandatoryPolicyEvidence ${index}`);
    return Object.freeze({
      key: requireStableKey(`mandatoryPolicyEvidence ${index}.key`, source.key),
      evidenceRef: requireStableKey(`mandatoryPolicyEvidence ${index}.evidenceRef`, source.evidenceRef),
    });
  });
  requireUnique(evidence.map(({ key }) => key), "mandatory policy evidence keys");
  return Object.freeze([...evidence].sort((left, right) => left.key.localeCompare(right.key)));
}

function normalizeRestrictionEvidence(value: unknown): readonly RateRestrictionEvidence[] {
  const evidence = requireArray(value, "restrictionEvidence", 0, 100).map((entry, index) => {
    const source = requireObject(entry, `restrictionEvidence ${index}`);
    const fields = ["key", "kind", "blocked", "evidenceRef"];
    requireOnlyKeys(source, fields, `restrictionEvidence ${index}`);
    requireFields(source, fields, `restrictionEvidence ${index}`);
    if (typeof source.kind !== "string" || !RESTRICTION_KINDS.includes(source.kind as RateRestrictionEvidenceKind)) {
      throw new RateCompositionError(`restrictionEvidence ${index}.kind is invalid`);
    }
    return Object.freeze({
      key: requireStableKey(`restrictionEvidence ${index}.key`, source.key),
      kind: source.kind as RateRestrictionEvidenceKind,
      blocked: requireBoolean(`restrictionEvidence ${index}.blocked`, source.blocked),
      evidenceRef: requireStableKey(`restrictionEvidence ${index}.evidenceRef`, source.evidenceRef),
    });
  });
  requireUnique(evidence.map(({ key }) => key), "restriction evidence keys");
  return Object.freeze([...evidence].sort((left, right) => left.key.localeCompare(right.key)));
}

function normalizeOperationalBlockEvidence(value: unknown): readonly RateOperationalBlockEvidence[] {
  const evidence = requireArray(value, "operationalBlockEvidence", 0, 100).map((entry, index) => {
    const source = requireObject(entry, `operationalBlockEvidence ${index}`);
    const fields = ["key", "kind", "blocked", "evidenceRef"];
    requireOnlyKeys(source, fields, `operationalBlockEvidence ${index}`);
    requireFields(source, fields, `operationalBlockEvidence ${index}`);
    if (typeof source.kind !== "string" || !OPERATIONAL_BLOCK_KINDS.includes(source.kind as RateOperationalBlockKind)) {
      throw new RateCompositionError(`operationalBlockEvidence ${index}.kind is invalid`);
    }
    return Object.freeze({
      key: requireStableKey(`operationalBlockEvidence ${index}.key`, source.key),
      kind: source.kind as RateOperationalBlockKind,
      blocked: requireBoolean(`operationalBlockEvidence ${index}.blocked`, source.blocked),
      evidenceRef: requireStableKey(`operationalBlockEvidence ${index}.evidenceRef`, source.evidenceRef),
    });
  });
  requireUnique(evidence.map(({ key }) => key), "operational block evidence keys");
  return Object.freeze([...evidence].sort((left, right) => left.key.localeCompare(right.key)));
}

function normalizeAvailabilityEvidence(value: unknown): RateAvailabilityEvidence {
  const source = requireObject(value, "availabilityEvidence");
  const fields = [
    "sellableUnitId",
    "availableCount",
    "bookable",
    "restrictionEvidence",
    "operationalBlockEvidence",
    "evidenceRef",
  ];
  requireOnlyKeys(source, fields, "availabilityEvidence");
  requireFields(source, fields, "availabilityEvidence");
  const availableCount = requireInteger("availabilityEvidence.availableCount", source.availableCount, 0, 1_000_000);
  const restrictionEvidence = normalizeRestrictionEvidence(source.restrictionEvidence);
  const operationalBlockEvidence = normalizeOperationalBlockEvidence(source.operationalBlockEvidence);
  const bookable = requireBoolean("availabilityEvidence.bookable", source.bookable);
  const shouldBeBookable = availableCount > 0 &&
    !restrictionEvidence.some(({ blocked }) => blocked) &&
    !operationalBlockEvidence.some(({ blocked }) => blocked);
  if (bookable !== shouldBeBookable) {
    throw new RateCompositionError("availabilityEvidence.bookable must match capacity and blocker evidence");
  }
  return Object.freeze({
    sellableUnitId: requireUuid("availabilityEvidence.sellableUnitId", source.sellableUnitId),
    availableCount,
    bookable,
    restrictionEvidence,
    operationalBlockEvidence,
    evidenceRef: requireStableKey("availabilityEvidence.evidenceRef", source.evidenceRef),
  });
}

export function deriveRateCompositionContext(value: unknown): RateCompositionContext {
  const source = requireObject(value, "rate composition context");
  const fields = [
    "rateEvaluatorSpec",
    "rateEvaluationContext",
    "rateEvaluationResult",
    "guests",
    "selectedPromotionCodes",
    "policyEvidence",
    "mandatoryPolicyEvidence",
    "availabilityEvidence",
    "channelCode",
    "channelMappingEvidenceRef",
  ];
  requireOnlyKeys(source, fields, "rate composition context");
  requireFields(source, fields, "rate composition context");
  const rate = canonicalRateBundle(
    source.rateEvaluatorSpec,
    source.rateEvaluationContext,
    source.rateEvaluationResult,
  );
  const selectedPromotionCodes = requireArray(source.selectedPromotionCodes, "selectedPromotionCodes", 0, 50)
    .map((code, index) => requireHotelCode(`selectedPromotionCodes ${index}`, code));
  requireUnique(selectedPromotionCodes, "selectedPromotionCodes");
  const evidence = requireArray(source.policyEvidence, "policyEvidence", 0, 4)
    .map(normalizePolicyEvidenceItem);
  requireUnique(evidence.map(({ kind }) => kind), "policy evidence kinds");
  const channelCode = requireChannelCode("channelCode", source.channelCode);
  const mappingEvidenceRef = source.channelMappingEvidenceRef === null
    ? null
    : requireStableKey("channelMappingEvidenceRef", source.channelMappingEvidenceRef);
  if (channelCode === "direct" && mappingEvidenceRef !== null) {
    throw new RateCompositionError("direct channel must not claim external mapping evidence");
  }
  if (channelCode !== "direct" && mappingEvidenceRef === null) {
    throw new RateCompositionError("non-direct channel requires mapping evidence");
  }
  return Object.freeze({
    rateEvaluatorSpec: rate.evaluatorSpec,
    rateEvaluationContext: rate.evaluationContext,
    rateEvaluationResult: rate.evaluationResult,
    guests: normalizeGuests(source.guests),
    selectedPromotionCodes: Object.freeze([...selectedPromotionCodes].sort()),
    policyEvidence: Object.freeze([...evidence].sort((left, right) => left.kind.localeCompare(right.kind))),
    mandatoryPolicyEvidence: normalizeMandatoryPolicyEvidence(source.mandatoryPolicyEvidence),
    availabilityEvidence: normalizeAvailabilityEvidence(source.availabilityEvidence),
    channelCode,
    channelMappingEvidenceRef: mappingEvidenceRef,
  });
}

function safeAdd(left: bigint, right: bigint, subject: string): bigint {
  const value = left + right;
  if (value < 0n || value > MAX_BIGINT) throw new RateCompositionError(`${subject} exceeds signed-bigint minor units`);
  return value;
}

function safeMultiply(amount: bigint, quantity: number, subject: string): bigint {
  const value = amount * BigInt(quantity);
  if (value < 0n || value > MAX_BIGINT) throw new RateCompositionError(`${subject} exceeds signed-bigint minor units`);
  return value;
}

function halfUpBasisPoints(amount: bigint, basisPoints: number): bigint {
  return (amount * BigInt(basisPoints) + 5_000n) / 10_000n;
}

function quantityFor(element: RatePackageElement, context: RateCompositionContext): number {
  const guests = context.guests.adults + context.guests.childAges.length;
  const nights = context.rateEvaluationContext.losNights;
  if (element.rhythm === "per_stay") return 1;
  if (element.rhythm === "per_night") return nights;
  if (element.rhythm === "per_person") return guests;
  const quantity = guests * nights;
  if (!Number.isSafeInteger(quantity)) throw new RateCompositionError("package quantity exceeds safe integer bounds");
  return quantity;
}

function buildPackageEvidence(
  spec: RatePackageSpec | null,
  context: RateCompositionContext,
  work: { units: number },
): { evidence: RatePackageEvidence | null; allocation: bigint } {
  if (spec === null) return { evidence: null, allocation: 0n };
  let allocation = 0n;
  const elements = spec.elements.map((element) => {
    work.units += 1;
    const quantity = quantityFor(element, context);
    const totalMinor = safeMultiply(element.amountMinor, quantity, `package element ${element.key}`);
    allocation = safeAdd(allocation, totalMinor, "package allocation");
    return Object.freeze({ ...element, quantity, totalMinor });
  });
  return {
    allocation,
    evidence: Object.freeze({
      key: spec.key,
      version: spec.version,
      includedInRate: spec.includedInRate,
      elements: Object.freeze(elements),
    }),
  };
}

function validatePolicies(spec: RatePolicyConfiguration, evidence: readonly RatePolicyEvidence[], work: { units: number }): void {
  const expected: Readonly<Record<RatePolicyKind, string | null>> = Object.freeze({
    cancellation: spec.cancellationPolicyId,
    deposit: spec.depositPolicyId,
    guarantee: spec.guaranteePolicyId,
    no_show: spec.noShowPolicyId,
  });
  const actual = new Map(evidence.map((item) => [item.kind, item]));
  for (const kind of POLICY_KINDS) {
    work.units += 1;
    const policyId = expected[kind];
    const supplied = actual.get(kind);
    if (policyId === null && supplied !== undefined) {
      throw new RateCompositionError(`unexpected ${kind} policy evidence`);
    }
    if (policyId !== null && (supplied === undefined || supplied.policyId !== policyId)) {
      throw new RateCompositionError(`${kind} policy evidence does not match configured policy`);
    }
  }
}

function guestEligible(spec: RateGuestEligibility, guests: RateGuestMix): boolean {
  const children = guests.childAges.length;
  const total = guests.adults + children;
  return guests.adults >= spec.minAdults && guests.adults <= spec.maxAdults &&
    children >= spec.minChildren && children <= spec.maxChildren &&
    total >= spec.minTotalGuests && total <= spec.maxTotalGuests;
}

function distributionEligible(spec: RateDistributionConfiguration, channelCode: string): boolean {
  if (spec.mode === "all") return true;
  const listed = spec.channelCodes.includes(channelCode);
  return spec.mode === "allowlist" ? listed : !listed;
}

function resultBase(
  state: RateCompositionState,
  reason: string | null,
  spec: RateCompositionSpec,
  context: RateCompositionContext,
  distributionEvidence: RateDistributionEvidence,
  workUnits: number,
  values: Partial<RateCompositionResult> = {},
): RateCompositionResult {
  return Object.freeze({
    state,
    reason,
    currency: spec.currency,
    roomAmountMinor: null,
    includedAllocationMinor: null,
    packageExtraMinor: null,
    promotionDiscountMinor: null,
    preTaxSubtotalMinor: null,
    selectedPromotionCodes: context.selectedPromotionCodes,
    appliedPromotionCodes: Object.freeze([]),
    conflictingPromotionCodes: Object.freeze([]),
    conflictStage: null,
    guests: context.guests,
    packageEvidence: null,
    policyEvidence: context.policyEvidence,
    mandatoryPolicyEvidence: context.mandatoryPolicyEvidence,
    refundTreatment: spec.policy.refundTreatment,
    restrictionEvidence: context.availabilityEvidence.restrictionEvidence,
    operationalBlockEvidence: context.availabilityEvidence.operationalBlockEvidence,
    availabilityEvidence: context.availabilityEvidence,
    distributionEvidence,
    rateEvaluation: context.rateEvaluationResult,
    workUnits,
    ...values,
  });
}

function canonicalCompositionSpec(value: unknown): RateCompositionSpec {
  if (!Object.isFrozen(value)) throw new RateCompositionError("spec must come from normalizeRateCompositionSpec");
  const canonical = normalizeRateCompositionSpec(value);
  if (!exactEqual(canonical, value)) throw new RateCompositionError("spec does not match its canonical normalized form");
  return canonical;
}

function canonicalCompositionContext(value: unknown): RateCompositionContext {
  if (!Object.isFrozen(value)) throw new RateCompositionError("context must come from deriveRateCompositionContext");
  const canonical = deriveRateCompositionContext(value);
  if (!exactEqual(canonical, value)) throw new RateCompositionError("context does not match its canonical derived form");
  return canonical;
}

export function composeRateQuote(specValue: unknown, contextValue: unknown): RateCompositionResult {
  const spec = canonicalCompositionSpec(specValue);
  const context = canonicalCompositionContext(contextValue);
  if (spec.currency !== context.rateEvaluationResult.currency) {
    throw new RateCompositionError("composition currency must match the Order 067 price currency");
  }

  const work = {
    units: context.rateEvaluationResult.workUnits + spec.promotions.length +
      (spec.package?.elements.length ?? 0) + context.selectedPromotionCodes.length +
      context.policyEvidence.length + context.mandatoryPolicyEvidence.length +
      context.availabilityEvidence.restrictionEvidence.length +
      context.availabilityEvidence.operationalBlockEvidence.length + 1,
  };
  validatePolicies(spec.policy, context.policyEvidence, work);
  const promotionByCode = new Map(spec.promotions.map((promotion) => [promotion.code, promotion]));
  for (const code of context.selectedPromotionCodes) {
    work.units += 1;
    if (!promotionByCode.has(code)) throw new RateCompositionError(`selected promotion ${code} is not configured`);
  }
  const channelEligible = distributionEligible(spec.distribution, context.channelCode);
  const distributionEvidence = Object.freeze({
    channelCode: context.channelCode,
    eligible: channelEligible,
    mappingEvidenceRef: context.channelMappingEvidenceRef,
  });

  if (!context.availabilityEvidence.bookable) {
    return resultBase("blocked", "availability_blocked", spec, context, distributionEvidence, work.units);
  }
  if (context.rateEvaluationResult.state === "conflict") {
    return resultBase("conflict", "rate_conflict", spec, context, distributionEvidence, work.units);
  }
  if (context.rateEvaluationResult.state === "unpriced") {
    return resultBase(
      "unpriced",
      `rate:${context.rateEvaluationResult.reason ?? "unpriced"}`,
      spec,
      context,
      distributionEvidence,
      work.units,
    );
  }
  if (!guestEligible(spec.guestEligibility, context.guests)) {
    return resultBase("unpriced", "guest_ineligible", spec, context, distributionEvidence, work.units);
  }
  if (!channelEligible) {
    return resultBase("unpriced", "channel_ineligible", spec, context, distributionEvidence, work.units);
  }
  const roomAmount = context.rateEvaluationResult.amountMinor;
  if (roomAmount === null || typeof roomAmount !== "bigint") {
    throw new RateCompositionError("priced Order 067 result requires exact bigint amountMinor");
  }

  const packageResult = buildPackageEvidence(spec.package, context, work);
  if (spec.package?.includedInRate && packageResult.allocation > roomAmount) {
    return resultBase("unpriced", "included_package_exceeds_room", spec, context, distributionEvidence, work.units, {
      packageEvidence: packageResult.evidence,
    });
  }
  const includedAllocation = spec.package?.includedInRate ? packageResult.allocation : 0n;
  const packageExtra = spec.package?.includedInRate ? 0n : packageResult.allocation;
  let runningRoom = roomAmount;
  let runningTotal = safeAdd(roomAmount, packageExtra, "room and package subtotal");
  let totalDiscount = 0n;
  const appliedPromotionCodes: string[] = [];
  const byStage = new Map<number, RatePromotionSpec[]>();
  for (const code of context.selectedPromotionCodes) {
    const promotion = promotionByCode.get(code)!;
    const stage = byStage.get(promotion.stage);
    if (stage) stage.push(promotion);
    else byStage.set(promotion.stage, [promotion]);
  }
  for (const stageNumber of [...byStage.keys()].sort((left, right) => left - right)) {
    const candidates = byStage.get(stageNumber)!;
    let highestPriority = -1;
    for (const candidate of candidates) {
      work.units += 1;
      if (candidate.priority > highestPriority) highestPriority = candidate.priority;
    }
    const winners = candidates.filter(({ priority }) => priority === highestPriority)
      .sort((left, right) => left.code.localeCompare(right.code));
    work.units += candidates.length;
    if (winners.length !== 1) {
      return resultBase("conflict", "promotion_conflict", spec, context, distributionEvidence, work.units, {
        packageEvidence: packageResult.evidence,
        conflictingPromotionCodes: Object.freeze(winners.map(({ code }) => code)),
        conflictStage: stageNumber,
      });
    }
    const winner = winners[0]!;
    const discountBase = winner.scope === "room" ? runningRoom : runningTotal;
    const requestedDiscount = winner.discount.kind === "amount"
      ? winner.discount.amountMinor
      : halfUpBasisPoints(discountBase, winner.discount.basisPoints);
    const discount = requestedDiscount > discountBase ? discountBase : requestedDiscount;
    const effectiveDiscount = discount > runningTotal ? runningTotal : discount;
    runningTotal -= effectiveDiscount;
    if (winner.scope === "room") runningRoom -= effectiveDiscount;
    totalDiscount = safeAdd(totalDiscount, effectiveDiscount, "promotion discount total");
    appliedPromotionCodes.push(winner.code);
  }

  return resultBase("quoted", null, spec, context, distributionEvidence, work.units, {
    roomAmountMinor: roomAmount,
    includedAllocationMinor: includedAllocation,
    packageExtraMinor: packageExtra,
    promotionDiscountMinor: totalDiscount,
    preTaxSubtotalMinor: runningTotal,
    appliedPromotionCodes: Object.freeze(appliedPromotionCodes),
    packageEvidence: packageResult.evidence,
  });
}
