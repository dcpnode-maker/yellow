const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STABLE_KEY = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const CURRENCY = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_BIGINT = 9_223_372_036_854_775_807n;

type JsonObject = Record<string, unknown>;

export class RateRecommendationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateRecommendationError";
  }
}

export interface RateRecommendationBinding {
  readonly adapterKey: string;
  readonly adapterVersion: number;
  readonly maximumAgeSeconds: number;
  readonly outageFallback: "local_evaluator";
}

export interface RateRecommendationRequest {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly ratePlanId: string;
  readonly releaseId: string;
  readonly releaseVersion: number;
  readonly sellableUnitId: string;
  readonly unitTypeId: string;
  readonly nightDate: string;
  readonly currency: string;
  readonly bookingInstant: string;
}

export interface RateRecommendationAdapter {
  readonly adapterKey: string;
  readonly adapterVersion: number;
  recommend(request: RateRecommendationRequest): Promise<unknown>;
}

export interface AcceptedRateRecommendation {
  readonly state: "accepted";
  readonly adapterKey: string;
  readonly adapterVersion: number;
  readonly recommendationId: string;
  readonly recommendationVersion: number;
  readonly observedAt: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly ratePlanId: string;
  readonly releaseId: string;
  readonly releaseVersion: number;
  readonly sellableUnitId: string;
  readonly unitTypeId: string;
  readonly nightDate: string;
  readonly currency: string;
  readonly amountMinor: bigint;
  readonly evidenceRef: string;
}

export type RateRecommendationFallbackReason =
  | "adapter_missing"
  | "adapter_unavailable"
  | "adapter_error"
  | "stale";

export interface FallbackRateRecommendation {
  readonly state: "fallback";
  readonly adapterKey: string;
  readonly adapterVersion: number;
  readonly reason: RateRecommendationFallbackReason;
}

export type RateRecommendationResolution = AcceptedRateRecommendation | FallbackRateRecommendation;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, subject: string): JsonObject {
  if (!isObject(value)) throw new RateRecommendationError(`${subject} must be an object`);
  return value;
}

function requireOnlyKeys(value: JsonObject, allowed: readonly string[], subject: string): void {
  const expected = new Set(allowed);
  if (Object.keys(value).some((key) => !expected.has(key))) {
    throw new RateRecommendationError(`${subject} contains unsupported fields`);
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new RateRecommendationError(`${name} must be a UUID`);
  }
  return value;
}

function requireStableKey(name: string, value: unknown): string {
  if (typeof value !== "string" || !STABLE_KEY.test(value)) {
    throw new RateRecommendationError(`${name} must be bounded stable text`);
  }
  return value;
}

function requireVersion(name: string, value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new RateRecommendationError(`${name} must be a positive safe integer`);
  }
  return value as number;
}

function requireInstant(name: string, value: unknown): string {
  if (typeof value !== "string" || !INSTANT.test(value)) {
    throw new RateRecommendationError(`${name} must be a canonical UTC instant`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new RateRecommendationError(`${name} must be a canonical UTC instant`);
  }
  return value;
}

function requireRequest(value: RateRecommendationRequest): RateRecommendationRequest {
  const source = requireObject(value, "recommendation request");
  const fields = [
    "tenantId", "propertyNode", "ratePlanId", "releaseId", "releaseVersion",
    "sellableUnitId", "unitTypeId", "nightDate", "currency", "bookingInstant",
  ];
  requireOnlyKeys(source, fields, "recommendation request");
  const nightDate = source.nightDate;
  if (typeof nightDate !== "string" || !DATE.test(nightDate)) {
    throw new RateRecommendationError("nightDate must be YYYY-MM-DD");
  }
  const parsedNight = new Date(`${nightDate}T00:00:00.000Z`);
  if (!Number.isFinite(parsedNight.getTime()) || parsedNight.toISOString().slice(0, 10) !== nightDate) {
    throw new RateRecommendationError("nightDate must be a real calendar date");
  }
  if (typeof source.currency !== "string" || !CURRENCY.test(source.currency)) {
    throw new RateRecommendationError("currency must be an uppercase three-letter code");
  }
  return Object.freeze({
    tenantId: requireUuid("tenantId", source.tenantId),
    propertyNode: requireUuid("propertyNode", source.propertyNode),
    ratePlanId: requireUuid("ratePlanId", source.ratePlanId),
    releaseId: requireUuid("releaseId", source.releaseId),
    releaseVersion: requireVersion("releaseVersion", source.releaseVersion),
    sellableUnitId: requireUuid("sellableUnitId", source.sellableUnitId),
    unitTypeId: requireUuid("unitTypeId", source.unitTypeId),
    nightDate,
    currency: source.currency,
    bookingInstant: requireInstant("bookingInstant", source.bookingInstant),
  });
}

function fallback(
  binding: RateRecommendationBinding,
  reason: RateRecommendationFallbackReason,
): FallbackRateRecommendation {
  return Object.freeze({
    state: "fallback",
    adapterKey: binding.adapterKey,
    adapterVersion: binding.adapterVersion,
    reason,
  });
}

function normalizeAccepted(
  value: unknown,
  binding: RateRecommendationBinding,
  request: RateRecommendationRequest,
): AcceptedRateRecommendation | FallbackRateRecommendation {
  if (value === null) return fallback(binding, "adapter_unavailable");
  const source = requireObject(value, "recommendation response");
  const fields = [
    "adapterKey", "adapterVersion", "recommendationId", "recommendationVersion", "observedAt",
    "tenantId", "propertyNode", "ratePlanId", "releaseId", "releaseVersion", "sellableUnitId",
    "unitTypeId", "nightDate", "currency", "amountMinor", "evidenceRef",
  ];
  requireOnlyKeys(source, fields, "recommendation response");
  const adapterKey = requireStableKey("adapterKey", source.adapterKey);
  const adapterVersion = requireVersion("adapterVersion", source.adapterVersion);
  const tenantId = requireUuid("tenantId", source.tenantId);
  const propertyNode = requireUuid("propertyNode", source.propertyNode);
  const ratePlanId = requireUuid("ratePlanId", source.ratePlanId);
  const releaseId = requireUuid("releaseId", source.releaseId);
  const releaseVersion = requireVersion("releaseVersion", source.releaseVersion);
  const sellableUnitId = requireUuid("sellableUnitId", source.sellableUnitId);
  const unitTypeId = requireUuid("unitTypeId", source.unitTypeId);
  const nightDate = source.nightDate;
  const currency = source.currency;
  if (adapterKey !== binding.adapterKey || adapterVersion !== binding.adapterVersion) {
    throw new RateRecommendationError("recommendation adapter does not match the published binding");
  }
  if (tenantId !== request.tenantId || propertyNode !== request.propertyNode ||
      ratePlanId !== request.ratePlanId || releaseId !== request.releaseId ||
      releaseVersion !== request.releaseVersion || sellableUnitId !== request.sellableUnitId ||
      unitTypeId !== request.unitTypeId || nightDate !== request.nightDate || currency !== request.currency) {
    throw new RateRecommendationError("recommendation response does not match the exact quote scope");
  }
  if (typeof currency !== "string" || !CURRENCY.test(currency)) {
    throw new RateRecommendationError("recommendation currency must be an uppercase three-letter code");
  }
  if (typeof source.amountMinor !== "bigint" || source.amountMinor < 0n || source.amountMinor > MAX_BIGINT) {
    throw new RateRecommendationError("recommendation amountMinor must be non-negative signed-bigint money");
  }
  const observedAt = requireInstant("observedAt", source.observedAt);
  const observedMs = Date.parse(observedAt);
  const bookingMs = Date.parse(request.bookingInstant);
  if (observedMs > bookingMs) {
    throw new RateRecommendationError("recommendation observedAt cannot be in the future");
  }
  if (bookingMs - observedMs > binding.maximumAgeSeconds * 1_000) {
    return fallback(binding, "stale");
  }
  return Object.freeze({
    state: "accepted",
    adapterKey,
    adapterVersion,
    recommendationId: requireStableKey("recommendationId", source.recommendationId),
    recommendationVersion: requireVersion("recommendationVersion", source.recommendationVersion),
    observedAt,
    tenantId,
    propertyNode,
    ratePlanId,
    releaseId,
    releaseVersion,
    sellableUnitId,
    unitTypeId,
    nightDate,
    currency,
    amountMinor: source.amountMinor,
    evidenceRef: requireStableKey("evidenceRef", source.evidenceRef),
  });
}

export class RateRecommendationRegistry {
  readonly #adapters: ReadonlyMap<string, RateRecommendationAdapter>;

  constructor(adapters: readonly RateRecommendationAdapter[] = []) {
    const registry = new Map<string, RateRecommendationAdapter>();
    for (const adapter of adapters) {
      const adapterKey = requireStableKey("adapter.adapterKey", adapter.adapterKey);
      const adapterVersion = requireVersion("adapter.adapterVersion", adapter.adapterVersion);
      const key = `${adapterKey}@${adapterVersion}`;
      if (registry.has(key)) throw new RateRecommendationError(`duplicate recommendation adapter ${key}`);
      registry.set(key, adapter);
    }
    this.#adapters = registry;
  }

  async resolve(
    bindingValue: RateRecommendationBinding,
    requestValue: RateRecommendationRequest,
  ): Promise<RateRecommendationResolution> {
    const binding = Object.freeze({
      adapterKey: requireStableKey("binding.adapterKey", bindingValue.adapterKey),
      adapterVersion: requireVersion("binding.adapterVersion", bindingValue.adapterVersion),
      maximumAgeSeconds: requireVersion("binding.maximumAgeSeconds", bindingValue.maximumAgeSeconds),
      outageFallback: bindingValue.outageFallback,
    });
    if (binding.maximumAgeSeconds > 86_400 || binding.outageFallback !== "local_evaluator") {
      throw new RateRecommendationError("recommendation binding is outside the governed contract");
    }
    const request = requireRequest(requestValue);
    const adapter = this.#adapters.get(`${binding.adapterKey}@${binding.adapterVersion}`);
    if (!adapter) return fallback(binding, "adapter_missing");
    let response: unknown;
    try {
      response = await adapter.recommend(request);
    } catch {
      return fallback(binding, "adapter_error");
    }
    return normalizeAccepted(response, binding, request);
  }
}
