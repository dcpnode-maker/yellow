const DAY_MS = 86_400_000;
const MAX_TIMEOUT_MS = 300_000;
const MAX_CACHE_ENTRIES = 10_000;
const MAX_REQUESTS_PER_RUN = 10_000;
const MAX_CONTEXTS_PER_RUN = 10_000;
const MAX_MONEY_MINOR = 9_223_372_036_854_775_807n;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const CURRENCY = /^[A-Z]{3}$/;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MONEY_MINOR = /^(?:0|[1-9][0-9]*)$/;

export type MarketShoppingMethod =
  | "official-api"
  | "licensed-provider"
  | "permitted-browser"
  | "confirmed-capture"
  | "archive";

export const MARKET_SHOPPING_METHODS: readonly MarketShoppingMethod[] = Object.freeze([
  "official-api", "licensed-provider", "permitted-browser", "confirmed-capture", "archive",
]);

/** These are capability defaults only. No transport is active until a caller installs
 * an enabled route with a read callback. */
export const MARKET_SHOPPING_METHOD_DEFAULTS: Readonly<Record<MarketShoppingMethod, false>> = Object.freeze({
  "official-api": false,
  "licensed-provider": false,
  "permitted-browser": false,
  "confirmed-capture": false,
  archive: false,
});

export interface MarketGuestContext {
  readonly rooms: number;
  readonly adults: number;
  readonly childAges: readonly number[];
}

/** Every field is an exact comparison/cache dimension. Condition and scope strings
 * are opaque caller-provided labels: validating them does not authenticate the caller,
 * prove entitlement, or establish eligibility for automatic pricing. */
export interface MarketShoppingContext {
  readonly tenantId: string;
  /** Managed Yellow property whose recommendation may consume this comparison. */
  readonly managedPropertyId: string;
  /** External comparator/listing identity; no physical-unit equivalence is inferred. */
  readonly comparatorPropertyId: string;
  readonly source: string;
  readonly permissionScope: string;
  readonly entitlement: string;
  readonly pointOfSaleMarket: string;
  readonly roomProduct: string;
  readonly checkInDate: string;
  readonly lengthOfStayNights: number;
  readonly guests: MarketGuestContext;
  readonly currency: string;
  readonly mealPlan: string;
  readonly refundability: string;
  readonly membership: string;
  readonly device: string;
  readonly taxPriceDisplay: string;
}

export interface MarketSourceTimestamp {
  /** Exact source string, retained even when its timezone or age is not comparable. */
  readonly raw: string | null;
  readonly basis: "utc-instant" | "local-or-unspecified" | "unknown";
}

export interface MarketStayTotal {
  /** Base-10 integer minor units. Parsing and calculations use bigint. */
  readonly amountMinor: string;
  readonly currency: string;
  readonly basis: "entire-stay";
  readonly mandatoryChargesIncluded: true;
}

interface MarketObservationCommon {
  readonly context: MarketShoppingContext;
  readonly collectedAt: string;
  readonly sourceTimestamp: MarketSourceTimestamp;
  readonly routeId: string;
  readonly method: MarketShoppingMethod;
  readonly upstream: string;
}

export interface MarketAvailableObservation extends MarketObservationCommon {
  readonly outcome: "available";
  readonly total: MarketStayTotal;
}

export interface MarketUnavailableObservation extends MarketObservationCommon {
  readonly outcome: "unavailable";
  /** This is only the source's no-offer result. It is never booked occupancy evidence. */
  readonly sourceReason: string | null;
}

export type MarketShoppingObservation = Readonly<
  MarketAvailableObservation | MarketUnavailableObservation
>;

export interface MarketAdapterAvailableResult {
  readonly outcome: "available";
  readonly context: MarketShoppingContext;
  readonly collectedAt: string;
  readonly sourceTimestamp: MarketSourceTimestamp;
  readonly total: MarketStayTotal;
}

export interface MarketAdapterUnavailableResult {
  readonly outcome: "unavailable";
  readonly context: MarketShoppingContext;
  readonly collectedAt: string;
  readonly sourceTimestamp: MarketSourceTimestamp;
  readonly sourceReason: string | null;
}

export type MarketShoppingFailureKind =
  | "network"
  | "timeout"
  | "rate-limited"
  | "policy-blocked"
  | "challenge"
  | "access-denied"
  | "invalid-response";

export interface MarketAdapterFailureResult {
  readonly outcome: "failure";
  readonly kind: MarketShoppingFailureKind;
  readonly retryAfterMs?: number;
}

export type MarketAdapterResult = Readonly<
  MarketAdapterAvailableResult | MarketAdapterUnavailableResult | MarketAdapterFailureResult
>;

export interface MarketShoppingReadInput {
  readonly context: Readonly<MarketShoppingContext>;
  readonly signal: AbortSignal;
  readonly deadlineUnixMs: number;
}

/** Installed callbacks are the only read implementation. The runner contains no
 * network client, browser, credential lookup, or simulated successful completion. */
export type MarketShoppingReadAdapter = (
  input: Readonly<MarketShoppingReadInput>,
) => Promise<MarketAdapterResult>;

export interface MarketShoppingRoute {
  readonly id: string;
  readonly method: MarketShoppingMethod;
  readonly upstream: string;
  readonly priority: number;
  readonly enabled: boolean;
  readonly sources: readonly string[];
  readonly timeoutMs: number;
  readonly read: MarketShoppingReadAdapter;
}

export interface MarketShoppingUpstreamLimits {
  readonly upstream: string;
  readonly maxRequestsPerRun: number;
  readonly maxConcurrency: number;
  readonly cooldownMs: number;
}

export interface MarketShoppingRunnerOptions {
  readonly routes?: readonly MarketShoppingRoute[];
  readonly upstreams?: readonly MarketShoppingUpstreamLimits[];
  readonly maxCacheEntries?: number;
  readonly cacheTtlMs?: number;
  readonly maxSourceAgeMs?: number;
  readonly maxContextsPerRun?: number;
  readonly initialCache?: ReadonlyMap<string, MarketShoppingObservation>;
  readonly now?: () => number;
}

export type MarketPriceNonActionableReason =
  | "stale-source"
  | "unknown-source-age"
  | "incomparable-source-age"
  | "stale-collection";

export interface MarketRetainedObservation {
  readonly observation: MarketShoppingObservation;
  readonly actionable: boolean;
  readonly reason: MarketPriceNonActionableReason | "unavailable-not-occupancy" | null;
}

export interface MarketShoppingAttempt {
  readonly routeId: string;
  readonly method: MarketShoppingMethod;
  readonly upstream: string;
  readonly outcome: "actionable" | "non-actionable" | "unavailable" | "failure" | "skipped";
  readonly reason: MarketShoppingFailureKind | MarketPriceNonActionableReason
    | "unavailable-not-occupancy" | "budget-exhausted" | "cooldown" | "upstream-blocked"
    | "upstream-quarantined" | "aborted" | null;
}

export interface MarketShoppingRequest {
  readonly id: string;
  readonly context: MarketShoppingContext;
}

export interface MarketShoppingItemResult {
  readonly requestIds: readonly string[];
  readonly contextKey: string;
  readonly context: MarketShoppingContext;
  readonly status: "actionable" | "non-actionable" | "unavailable" | "failed";
  readonly cacheHit: boolean;
  readonly observation: MarketShoppingObservation | null;
  readonly retainedObservations: readonly MarketRetainedObservation[];
  readonly attempts: readonly MarketShoppingAttempt[];
  /** "actionable" means comparison-quality evidence only. Publication and operational
   * pricing still require their separately authorized domain commands. */
  readonly pricingAuthority: "comparison-only";
}

export interface MarketShoppingRunResult {
  /** Budgets, cache, in-flight work and upstream guards live only in this process.
   * This result is not a durable or distributed schedule. */
  readonly coordinationScope: "single-process";
  readonly results: readonly MarketShoppingItemResult[];
  readonly upstreams: Readonly<Record<string, Readonly<{
    requestsUsed: number;
    requestsRemaining: number;
    blocked: boolean;
    coolingDown: boolean;
    quarantinedReads: number;
  }>>>;
}

export type LongHorizonCadence = "1-day" | "2-days" | "7-days" | "15-days" | "calendar-month";

export type MarketShoppingCadence = Readonly<
  | { kind: "fixed"; intervalMinutes: number }
  | { kind: "calendar-month"; months: 1 }
>;

export interface MarketShoppingCostQuote {
  readonly currency: string;
  readonly allInCostMinor: string;
  readonly quotedMinor: string;
  readonly grossMarginBasisPoints: 3_000;
}

interface UpstreamState {
  active: number;
  readonly waiters: Array<() => void>;
  quarantinedReads: number;
  blocked: boolean;
  blockedReason: "policy-blocked" | "challenge" | "access-denied" | null;
  cooldownUntil: number;
}

interface RunBudget {
  readonly maximum: number;
  remaining: number;
}

interface BudgetWindow {
  readonly budgets: Map<string, RunBudget>;
  participants: number;
}

interface ValidationResult {
  readonly retained: MarketRetainedObservation;
  readonly satisfiesCollection: boolean;
}

function fail(message: string): never {
  throw new TypeError(message);
}

function integer(name: string, value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    return fail(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

function keyString(name: string, value: unknown): string {
  if (typeof value !== "string" || !KEY.test(value)) return fail(`${name} is invalid`);
  return value;
}

function exactLocalDate(name: string, value: unknown): string {
  if (typeof value !== "string") return fail(`${name} must be YYYY-MM-DD`);
  const match = LOCAL_DATE.exec(value);
  if (!match) return fail(`${name} must be YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return fail(`${name} must be a real calendar date`);
  }
  return value;
}

function instant(name: string, value: unknown): number {
  if (typeof value !== "string" || !UTC_INSTANT.test(value)) return fail(`${name} must be a UTC ISO instant`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fail(`${name} must be a real UTC ISO instant`);
  const expected = value.replace(/(?:\.(\d{1,3}))?Z$/, (_whole, digits: string | undefined) =>
    `.${(digits ?? "").padEnd(3, "0")}Z`);
  if (new Date(parsed).toISOString() !== expected) return fail(`${name} must be a real UTC ISO instant`);
  return parsed;
}

function plainObject(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype) return fail(`${name} must be a plain object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], name: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || !actual.every((item, index) => item === wanted[index])) {
    fail(`${name} has unexpected or missing fields`);
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function snapshotContext(value: unknown): MarketShoppingContext {
  const context = plainObject(value, "context");
  exactKeys(context, ["tenantId", "managedPropertyId", "comparatorPropertyId", "source",
    "permissionScope", "entitlement", "pointOfSaleMarket", "roomProduct", "checkInDate",
    "lengthOfStayNights", "guests", "currency", "mealPlan", "refundability", "membership",
    "device", "taxPriceDisplay"], "context");
  const guests = plainObject(context.guests, "context.guests");
  exactKeys(guests, ["rooms", "adults", "childAges"], "context.guests");
  if (!Array.isArray(guests.childAges) || guests.childAges.length > 100
      || guests.childAges.some((age) => typeof age !== "number" || !Number.isSafeInteger(age) || age < 0 || age > 25)) {
    fail("context.guests.childAges is invalid");
  }
  const snapshot: MarketShoppingContext = {
    tenantId: keyString("context.tenantId", context.tenantId),
    managedPropertyId: keyString("context.managedPropertyId", context.managedPropertyId),
    comparatorPropertyId: keyString("context.comparatorPropertyId", context.comparatorPropertyId),
    source: keyString("context.source", context.source),
    permissionScope: keyString("context.permissionScope", context.permissionScope),
    entitlement: keyString("context.entitlement", context.entitlement),
    pointOfSaleMarket: keyString("context.pointOfSaleMarket", context.pointOfSaleMarket),
    roomProduct: keyString("context.roomProduct", context.roomProduct),
    checkInDate: exactLocalDate("context.checkInDate", context.checkInDate),
    lengthOfStayNights: integer("context.lengthOfStayNights", context.lengthOfStayNights, 1, 365),
    guests: freeze({
      rooms: integer("context.guests.rooms", guests.rooms, 1, 100),
      adults: integer("context.guests.adults", guests.adults, 1, 200),
      childAges: freeze([...(guests.childAges as number[])]),
    }),
    currency: typeof context.currency === "string" && CURRENCY.test(context.currency)
      ? context.currency : fail("context.currency must be an uppercase three-letter code"),
    mealPlan: keyString("context.mealPlan", context.mealPlan),
    refundability: keyString("context.refundability", context.refundability),
    membership: keyString("context.membership", context.membership),
    device: keyString("context.device", context.device),
    taxPriceDisplay: keyString("context.taxPriceDisplay", context.taxPriceDisplay),
  };
  return freeze(snapshot) as MarketShoppingContext;
}

export function marketShoppingContextKey(value: MarketShoppingContext): string {
  const context = snapshotContext(value);
  return JSON.stringify([
    context.tenantId, context.managedPropertyId, context.comparatorPropertyId, context.source,
    context.permissionScope, context.entitlement, context.pointOfSaleMarket, context.roomProduct,
    context.checkInDate,
    context.lengthOfStayNights, context.guests.rooms, context.guests.adults,
    context.guests.childAges, context.currency, context.mealPlan, context.refundability,
    context.membership, context.device, context.taxPriceDisplay,
  ]);
}

function moneyMinor(name: string, value: unknown): bigint {
  if (typeof value !== "string" || !MONEY_MINOR.test(value)) return fail(`${name} must be exact minor units`);
  const parsed = BigInt(value);
  if (parsed > MAX_MONEY_MINOR) return fail(`${name} exceeds bigint money range`);
  return parsed;
}

export function quoteMarketShoppingCost(allInCostMinor: string | bigint, currency: string): MarketShoppingCostQuote {
  if (!CURRENCY.test(currency)) fail("currency must be an uppercase three-letter code");
  const cost = typeof allInCostMinor === "bigint"
    ? allInCostMinor
    : moneyMinor("allInCostMinor", allInCostMinor);
  if (cost < 0n || cost > MAX_MONEY_MINOR) fail("allInCostMinor exceeds bigint money range");
  const quoted = (cost * 100n + 69n) / 70n;
  if (quoted > MAX_MONEY_MINOR) fail("quotedMinor exceeds bigint money range");
  return freeze({ currency, allInCostMinor: cost.toString(), quotedMinor: quoted.toString(),
    grossMarginBasisPoints: 3_000 as const });
}

export function marketShoppingCadence(
  propertyLocalDaysAhead: number,
  longHorizon: LongHorizonCadence,
): MarketShoppingCadence {
  integer("propertyLocalDaysAhead", propertyLocalDaysAhead, 0, 36_600);
  if (!["1-day", "2-days", "7-days", "15-days", "calendar-month"].includes(longHorizon)) {
    fail("longHorizon cadence is invalid");
  }
  if (propertyLocalDaysAhead <= 7) return freeze({ kind: "fixed", intervalMinutes: 60 });
  if (propertyLocalDaysAhead <= 20) return freeze({ kind: "fixed", intervalMinutes: 120 });
  if (propertyLocalDaysAhead <= 30) return freeze({ kind: "fixed", intervalMinutes: 180 });
  if (propertyLocalDaysAhead <= 45) return freeze({ kind: "fixed", intervalMinutes: 240 });
  if (propertyLocalDaysAhead <= 90) return freeze({ kind: "fixed", intervalMinutes: 300 });
  if (propertyLocalDaysAhead <= 180) return freeze({ kind: "fixed", intervalMinutes: 360 });
  if (longHorizon === "calendar-month") return freeze({ kind: "calendar-month", months: 1 as const });
  const days = longHorizon === "1-day" ? 1 : longHorizon === "2-days" ? 2
    : longHorizon === "7-days" ? 7 : 15;
  return freeze({ kind: "fixed", intervalMinutes: days * 1_440 });
}

export function marketShoppingPropertyLocalDaysAhead(
  propertyLocalDate: string,
  checkInDate: string,
): number {
  const local = exactLocalDate("propertyLocalDate", propertyLocalDate);
  const checkIn = exactLocalDate("checkInDate", checkInDate);
  const days = (Date.parse(`${checkIn}T00:00:00.000Z`) - Date.parse(`${local}T00:00:00.000Z`)) / DAY_MS;
  if (days < 0) fail("checkInDate cannot precede propertyLocalDate");
  return days;
}

export function marketShoppingCadenceForDates(
  propertyLocalDate: string,
  checkInDate: string,
  longHorizon: LongHorizonCadence,
): MarketShoppingCadence {
  return marketShoppingCadence(
    marketShoppingPropertyLocalDaysAhead(propertyLocalDate, checkInDate),
    longHorizon,
  );
}

/** Adds a cadence in property-local calendar terms. Fixed intervals return a date
 * and minute offset; calendar months clamp to the final real day of the next month. */
export function nextMarketShoppingCollectionLocal(
  lastLocalDate: string,
  lastLocalMinute: number,
  cadence: MarketShoppingCadence,
): Readonly<{ localDate: string; localMinute: number }> {
  const date = exactLocalDate("lastLocalDate", lastLocalDate);
  integer("lastLocalMinute", lastLocalMinute, 0, 1_439);
  if (cadence.kind === "fixed") {
    integer("cadence.intervalMinutes", cadence.intervalMinutes, 1, 31 * 1_440);
    const epoch = Date.parse(`${date}T00:00:00.000Z`) + (lastLocalMinute + cadence.intervalMinutes) * 60_000;
    const next = new Date(epoch);
    return freeze({ localDate: next.toISOString().slice(0, 10),
      localMinute: next.getUTCHours() * 60 + next.getUTCMinutes() });
  }
  if (cadence.months !== 1) fail("calendar cadence must be one month");
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const targetMonthStart = new Date(Date.UTC(year, month, 1));
  const finalDay = new Date(Date.UTC(targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth() + 1, 0)).getUTCDate();
  const next = new Date(Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth(),
    Math.min(day, finalDay)));
  return freeze({ localDate: next.toISOString().slice(0, 10), localMinute: lastLocalMinute });
}

function routeSnapshot(value: MarketShoppingRoute): MarketShoppingRoute {
  const id = keyString("route.id", value.id);
  const upstream = keyString("route.upstream", value.upstream);
  if (!MARKET_SHOPPING_METHODS.includes(value.method)) fail(`route ${id} method is invalid`);
  integer(`route ${id} priority`, value.priority, 0, 1_000_000);
  integer(`route ${id} timeoutMs`, value.timeoutMs, 1, MAX_TIMEOUT_MS);
  if (typeof value.enabled !== "boolean") fail(`route ${id} enabled must be boolean`);
  if (typeof value.read !== "function") fail(`route ${id} needs a read callback`);
  if (!Array.isArray(value.sources) || value.sources.length < 1 || value.sources.length > 1_000) {
    fail(`route ${id} sources must be a bounded nonempty allowlist`);
  }
  const sources = value.sources.map((source) => keyString(`route ${id} source`, source));
  if (new Set(sources).size !== sources.length) fail(`route ${id} sources must be unique`);
  return freeze({ id, upstream, method: value.method, priority: value.priority,
    enabled: value.enabled, timeoutMs: value.timeoutMs, sources: freeze(sources), read: value.read });
}

function upstreamSnapshot(value: MarketShoppingUpstreamLimits): MarketShoppingUpstreamLimits {
  const upstream = keyString("upstream", value.upstream);
  return freeze({ upstream,
    maxRequestsPerRun: integer(`${upstream}.maxRequestsPerRun`, value.maxRequestsPerRun, 1, MAX_REQUESTS_PER_RUN),
    maxConcurrency: integer(`${upstream}.maxConcurrency`, value.maxConcurrency, 1, 1_000),
    cooldownMs: integer(`${upstream}.cooldownMs`, value.cooldownMs, 0, 86_400_000),
  });
}

function failureResult(value: unknown): MarketAdapterFailureResult | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.outcome !== "failure") return null;
  const allowed = ["network", "timeout", "rate-limited", "policy-blocked", "challenge",
    "access-denied", "invalid-response"] as const;
  if (!allowed.includes(record.kind as typeof allowed[number])) return null;
  const expected = record.kind === "rate-limited" && record.retryAfterMs !== undefined
    ? ["outcome", "kind", "retryAfterMs"] : ["outcome", "kind"];
  try {
    exactKeys(record, expected, "adapter failure");
    if (record.retryAfterMs !== undefined) integer("retryAfterMs", record.retryAfterMs, 0, 86_400_000);
  } catch {
    return null;
  }
  return freeze({ outcome: "failure", kind: record.kind as MarketShoppingFailureKind,
    ...(record.retryAfterMs === undefined ? {} : { retryAfterMs: record.retryAfterMs as number }) });
}

function observationFromAdapter(
  raw: unknown,
  expectedContext: MarketShoppingContext,
  route: MarketShoppingRoute,
  now: number,
  maxSourceAgeMs: number,
  cacheTtlMs: number,
): ValidationResult | null {
  try {
    const record = plainObject(raw, "adapter result");
    if (record.outcome !== "available" && record.outcome !== "unavailable") return null;
    const common = ["outcome", "context", "collectedAt", "sourceTimestamp"];
    exactKeys(record, record.outcome === "available" ? [...common, "total"] : [...common, "sourceReason"], "adapter result");
    const context = snapshotContext(record.context);
    if (marketShoppingContextKey(context) !== marketShoppingContextKey(expectedContext)) return null;
    const collectedAt = typeof record.collectedAt === "string" ? record.collectedAt : fail("collectedAt invalid");
    const collected = instant("collectedAt", collectedAt);
    if (collected > now) return null;
    const timestampRecord = plainObject(record.sourceTimestamp, "sourceTimestamp");
    exactKeys(timestampRecord, ["raw", "basis"], "sourceTimestamp");
    if (timestampRecord.raw !== null && typeof timestampRecord.raw !== "string") return null;
    if (typeof timestampRecord.raw === "string" && (timestampRecord.raw.length < 1 || timestampRecord.raw.length > 256)) return null;
    if (!["utc-instant", "local-or-unspecified", "unknown"].includes(timestampRecord.basis as string)) return null;
    if (timestampRecord.basis === "unknown" && timestampRecord.raw !== null) return null;
    if (timestampRecord.basis !== "unknown" && timestampRecord.raw === null) return null;
    const sourceTimestamp: MarketSourceTimestamp = freeze({ raw: timestampRecord.raw as string | null,
      basis: timestampRecord.basis as MarketSourceTimestamp["basis"] });

    if (record.outcome === "unavailable") {
      if (record.sourceReason !== null && (typeof record.sourceReason !== "string"
          || record.sourceReason.length < 1 || record.sourceReason.length > 256)) return null;
      const observation: MarketUnavailableObservation = freeze({ outcome: "unavailable", context,
        collectedAt, sourceTimestamp, sourceReason: record.sourceReason as string | null,
        routeId: route.id, method: route.method, upstream: route.upstream });
      return freeze({ retained: freeze({ observation, actionable: false,
        reason: "unavailable-not-occupancy" }), satisfiesCollection: now - collected <= cacheTtlMs });
    }

    const totalRecord = plainObject(record.total, "total");
    exactKeys(totalRecord, ["amountMinor", "currency", "basis", "mandatoryChargesIncluded"], "total");
    const amount = moneyMinor("total.amountMinor", totalRecord.amountMinor);
    if (totalRecord.currency !== context.currency || totalRecord.basis !== "entire-stay"
        || totalRecord.mandatoryChargesIncluded !== true) return null;
    const total: MarketStayTotal = freeze({ amountMinor: amount.toString(), currency: context.currency,
      basis: "entire-stay", mandatoryChargesIncluded: true });
    const observation: MarketAvailableObservation = freeze({ outcome: "available", context,
      collectedAt, sourceTimestamp, total, routeId: route.id, method: route.method,
      upstream: route.upstream });
    let reason: MarketPriceNonActionableReason | null = null;
    if (now - collected > cacheTtlMs) reason = "stale-collection";
    else if (sourceTimestamp.basis === "unknown") reason = "unknown-source-age";
    else if (sourceTimestamp.basis === "local-or-unspecified") reason = "incomparable-source-age";
    else {
      let sourceTime: number;
      try { sourceTime = instant("sourceTimestamp.raw", sourceTimestamp.raw); } catch { return null; }
      if (sourceTime > collected) reason = "incomparable-source-age";
      else if (now - sourceTime > maxSourceAgeMs) reason = "stale-source";
    }
    return freeze({ retained: freeze({ observation, actionable: reason === null, reason }),
      satisfiesCollection: reason === null });
  } catch {
    return null;
  }
}

function cachedValidation(
  raw: MarketShoppingObservation,
  context: MarketShoppingContext,
  now: number,
  maxSourceAgeMs: number,
  cacheTtlMs: number,
): ValidationResult | null {
  try {
    keyString("cached routeId", raw.routeId);
    keyString("cached upstream", raw.upstream);
    if (!MARKET_SHOPPING_METHODS.includes(raw.method)) return null;
  } catch {
    return null;
  }
  const route: MarketShoppingRoute = {
    id: raw.routeId, method: raw.method, upstream: raw.upstream, priority: 0,
    enabled: true, sources: [context.source], timeoutMs: 1, async read() { return { outcome: "failure", kind: "invalid-response" }; },
  };
  const adapterShape = raw.outcome === "available"
    ? { outcome: raw.outcome, context: raw.context, collectedAt: raw.collectedAt,
      sourceTimestamp: raw.sourceTimestamp, total: raw.total }
    : { outcome: raw.outcome, context: raw.context, collectedAt: raw.collectedAt,
      sourceTimestamp: raw.sourceTimestamp, sourceReason: raw.sourceReason };
  return observationFromAdapter(adapterShape, context, route, now, maxSourceAgeMs, cacheTtlMs);
}

function itemResult(
  requestIds: readonly string[],
  context: MarketShoppingContext,
  status: MarketShoppingItemResult["status"],
  cacheHit: boolean,
  observation: MarketShoppingObservation | null,
  retainedObservations: readonly MarketRetainedObservation[],
    attempts: readonly MarketShoppingAttempt[],
): MarketShoppingItemResult {
  return freeze({ requestIds: freeze([...requestIds]), contextKey: marketShoppingContextKey(context),
    context, status, cacheHit, observation, retainedObservations: freeze([...retainedObservations]),
    attempts: freeze([...attempts]), pricingAuthority: "comparison-only" });
}

export class MarketShoppingRunner {
  readonly #routes: readonly MarketShoppingRoute[];
  readonly #limits: ReadonlyMap<string, MarketShoppingUpstreamLimits>;
  readonly #upstreams = new Map<string, UpstreamState>();
  readonly #cache = new Map<string, MarketShoppingObservation>();
  readonly #inFlight = new Map<string, Promise<MarketShoppingItemResult>>();
  readonly #maxCacheEntries: number;
  readonly #cacheTtlMs: number;
  readonly #maxSourceAgeMs: number;
  readonly #maxContextsPerRun: number;
  readonly #now: () => number;
  #budgetWindow: BudgetWindow | null = null;

  constructor(options: MarketShoppingRunnerOptions = {}) {
    this.#maxCacheEntries = integer("maxCacheEntries", options.maxCacheEntries ?? 1_000, 1, MAX_CACHE_ENTRIES);
    this.#cacheTtlMs = integer("cacheTtlMs", options.cacheTtlMs ?? 3_600_000, 1, 86_400_000);
    this.#maxSourceAgeMs = integer("maxSourceAgeMs", options.maxSourceAgeMs ?? 3_600_000, 1, 31 * DAY_MS);
    this.#maxContextsPerRun = integer("maxContextsPerRun", options.maxContextsPerRun ?? 1_000, 1, MAX_CONTEXTS_PER_RUN);
    this.#now = options.now ?? Date.now;
    const limits = (options.upstreams ?? []).map(upstreamSnapshot);
    this.#limits = new Map(limits.map((limit) => [limit.upstream, limit]));
    if (this.#limits.size !== limits.length) fail("upstream limits must be unique");
    for (const limit of limits) this.#upstreams.set(limit.upstream, { active: 0, waiters: [],
      quarantinedReads: 0, blocked: false, blockedReason: null, cooldownUntil: 0 });
    const routes = (options.routes ?? []).map(routeSnapshot);
    if (new Set(routes.map((route) => route.id)).size !== routes.length) fail("route IDs must be unique");
    for (const route of routes) {
      if (!this.#limits.has(route.upstream)) fail(`route ${route.id} has no upstream limits`);
    }
    this.#routes = freeze(routes.sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id)));
    for (const [key, observation] of options.initialCache ?? []) {
      if (typeof key !== "string") continue;
      try {
        if (marketShoppingContextKey(observation.context) !== key) continue;
        keyString("cached routeId", observation.routeId);
        keyString("cached upstream", observation.upstream);
        if (!MARKET_SHOPPING_METHODS.includes(observation.method)) continue;
        this.#cache.set(key, clone(observation));
        this.#trimCache();
      } catch {
        continue;
      }
    }
  }

  cacheSnapshot(): ReadonlyMap<string, MarketShoppingObservation> {
    return new Map([...this.#cache].map(([key, observation]) => [key, clone(observation)]));
  }

  async run(
    requests: readonly MarketShoppingRequest[],
    options: Readonly<{ signal?: AbortSignal }> = {},
  ): Promise<MarketShoppingRunResult> {
    if (!Array.isArray(requests) || requests.length < 1 || requests.length > this.#maxContextsPerRun) {
      fail(`requests must contain 1 to ${this.#maxContextsPerRun} entries`);
    }
    const grouped = new Map<string, { context: MarketShoppingContext; requestIds: string[] }>();
    const requestIds = new Set<string>();
    for (const request of requests) {
      if (typeof request !== "object" || request === null) fail("request is invalid");
      const id = keyString("request.id", request.id);
      if (requestIds.has(id)) fail("request IDs must be unique");
      requestIds.add(id);
      const context = snapshotContext(request.context);
      const key = marketShoppingContextKey(context);
      const current = grouped.get(key);
      if (current) current.requestIds.push(id);
      else grouped.set(key, { context, requestIds: [id] });
    }
    const window = this.#joinBudgetWindow();
    const budgets = window.budgets;
    try {
      const results = await Promise.all([...grouped].map(async ([key, group]) => {
      const cached = this.#cache.get(key);
      if (cached) {
        const checked = cachedValidation(cached, group.context, this.#now(), this.#maxSourceAgeMs, this.#cacheTtlMs);
        if (checked?.satisfiesCollection) {
          this.#touchCache(key, checked.retained.observation);
          const status = checked.retained.observation.outcome === "available" ? "actionable" : "unavailable";
          return itemResult(group.requestIds, group.context, status, true, checked.retained.observation,
            [checked.retained], []);
        }
        this.#cache.delete(key);
      }
      let shared = this.#inFlight.get(key);
      if (!shared) {
        shared = this.#collect(group.context, budgets, options.signal);
        this.#inFlight.set(key, shared);
        void shared.finally(() => { if (this.#inFlight.get(key) === shared) this.#inFlight.delete(key); }).catch(() => {});
      }
      const collected = await shared;
      return itemResult(group.requestIds, group.context, collected.status, false,
        collected.observation, collected.retainedObservations, collected.attempts);
      }));
      const now = this.#now();
      const upstreams: Record<string, { requestsUsed: number; requestsRemaining: number;
        blocked: boolean; coolingDown: boolean; quarantinedReads: number }> = {};
      for (const [upstream, budget] of budgets) {
        const state = this.#upstreams.get(upstream)!;
        upstreams[upstream] = freeze({ requestsUsed: budget.maximum - budget.remaining,
          requestsRemaining: budget.remaining, blocked: state.blocked,
          coolingDown: state.cooldownUntil > now, quarantinedReads: state.quarantinedReads });
      }
      return freeze({ coordinationScope: "single-process", results: freeze(results), upstreams: freeze(upstreams) });
    } finally {
      window.participants -= 1;
      if (window.participants === 0 && this.#budgetWindow === window) this.#budgetWindow = null;
    }
  }

  async #collect(
    context: MarketShoppingContext,
    budgets: Map<string, RunBudget>,
    signal?: AbortSignal,
  ): Promise<MarketShoppingItemResult> {
    const routes = this.#routes.filter((route) => route.enabled && route.sources.includes(context.source));
    const retained: MarketRetainedObservation[] = [];
    const attempts: MarketShoppingAttempt[] = [];
    for (const route of routes) {
      if (signal?.aborted) {
        attempts.push(freeze({ routeId: route.id, method: route.method, upstream: route.upstream,
          outcome: "skipped", reason: "aborted" }));
        break;
      }
      const state = this.#upstreams.get(route.upstream)!;
      if (state.blocked) {
        attempts.push(freeze({ routeId: route.id, method: route.method, upstream: route.upstream,
          outcome: "skipped", reason: "upstream-blocked" }));
        continue;
      }
      if (state.cooldownUntil > this.#now()) {
        attempts.push(freeze({ routeId: route.id, method: route.method, upstream: route.upstream,
          outcome: "skipped", reason: "cooldown" }));
        continue;
      }
      if (state.quarantinedReads > 0) {
        attempts.push(freeze({ routeId: route.id, method: route.method, upstream: route.upstream,
          outcome: "skipped", reason: "upstream-quarantined" }));
        continue;
      }
      const budget = budgets.get(route.upstream)!;
      if (budget.remaining <= 0) {
        attempts.push(freeze({ routeId: route.id, method: route.method, upstream: route.upstream,
          outcome: "skipped", reason: "budget-exhausted" }));
        continue;
      }
      const acquired = await this.#acquire(route.upstream, signal);
      if (!acquired) {
        const reason = signal?.aborted ? "aborted" : state.blocked ? "upstream-blocked"
          : state.quarantinedReads > 0 ? "upstream-quarantined"
            : state.cooldownUntil > this.#now() ? "cooldown" : "budget-exhausted";
        attempts.push(freeze({ routeId: route.id, method: route.method, upstream: route.upstream,
          outcome: "skipped", reason }));
        continue;
      }
      let releaseOnExit = true;
      let raw: unknown = undefined;
      let syntheticFailure: MarketShoppingFailureKind | null = null;
      try {
        if (signal?.aborted) {
          attempts.push(freeze({ routeId: route.id, method: route.method, upstream: route.upstream,
            outcome: "skipped", reason: "aborted" }));
          break;
        }
        if (state.blocked) {
          attempts.push(freeze({ routeId: route.id, method: route.method, upstream: route.upstream,
            outcome: "skipped", reason: "upstream-blocked" }));
          continue;
        }
        if (state.cooldownUntil > this.#now()) {
          attempts.push(freeze({ routeId: route.id, method: route.method, upstream: route.upstream,
            outcome: "skipped", reason: "cooldown" }));
          continue;
        }
        if (budget.remaining <= 0) {
          attempts.push(freeze({ routeId: route.id, method: route.method, upstream: route.upstream,
            outcome: "skipped", reason: "budget-exhausted" }));
          continue;
        }
        budget.remaining -= 1;
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener("abort", abort, { once: true });
        let timer: ReturnType<typeof setTimeout> | undefined;
        let readPromise: Promise<MarketAdapterResult> | null = null;
        const timeoutSentinel = Object.freeze({ kind: "runner-timeout" });
        try {
          readPromise = Promise.resolve().then(() => route.read(freeze({ context, signal: controller.signal,
            deadlineUnixMs: this.#now() + route.timeoutMs })));
          raw = await Promise.race([
            readPromise,
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(() => { controller.abort(); reject(timeoutSentinel); }, route.timeoutMs);
            }),
          ]);
        } catch (error) {
          syntheticFailure = error === timeoutSentinel ? "timeout" : "network";
          if (syntheticFailure === "timeout" && readPromise) {
            releaseOnExit = false;
            state.quarantinedReads += 1;
            this.#wakeAll(route.upstream);
            void readPromise.finally(() => {
              state.quarantinedReads -= 1;
              this.#release(route.upstream);
            }).catch(() => {});
          }
        } finally {
          if (timer !== undefined) clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
        }
      } finally {
        if (releaseOnExit) this.#release(route.upstream);
      }
      const failure = syntheticFailure
        ? freeze({ outcome: "failure" as const, kind: syntheticFailure })
        : failureResult(raw);
      if (failure) {
        if (failure.kind === "policy-blocked" || failure.kind === "challenge" || failure.kind === "access-denied") {
          state.blocked = true;
          state.blockedReason = failure.kind;
          this.#wakeAll(route.upstream);
        }
        if (failure.kind === "rate-limited") {
          const limit = this.#limits.get(route.upstream)!;
          state.cooldownUntil = Math.max(state.cooldownUntil,
            this.#now() + Math.max(limit.cooldownMs, failure.retryAfterMs ?? 0));
          this.#wakeAll(route.upstream);
        }
        attempts.push(freeze({ routeId: route.id, method: route.method, upstream: route.upstream,
          outcome: "failure", reason: failure.kind }));
        continue;
      }
      const checked = observationFromAdapter(raw, context, route, this.#now(),
        this.#maxSourceAgeMs, this.#cacheTtlMs);
      if (!checked) {
        attempts.push(freeze({ routeId: route.id, method: route.method, upstream: route.upstream,
          outcome: "failure", reason: "invalid-response" }));
        continue;
      }
      retained.push(checked.retained);
      if (checked.satisfiesCollection) {
        this.#touchCache(marketShoppingContextKey(context), checked.retained.observation);
        const status = checked.retained.observation.outcome === "available" ? "actionable" : "unavailable";
        attempts.push(freeze({ routeId: route.id, method: route.method, upstream: route.upstream,
          outcome: status, reason: checked.retained.reason }));
        return itemResult([], context, status, false, checked.retained.observation, retained, attempts);
      }
      attempts.push(freeze({ routeId: route.id, method: route.method, upstream: route.upstream,
        outcome: "non-actionable", reason: checked.retained.reason }));
    }
    const last = retained.at(-1)?.observation ?? null;
    return itemResult([], context, retained.length ? "non-actionable" : "failed", false,
      last, retained, attempts);
  }

  async #acquire(upstream: string, signal?: AbortSignal): Promise<boolean> {
    const state = this.#upstreams.get(upstream)!;
    const limit = this.#limits.get(upstream)!;
    while (state.active >= limit.maxConcurrency) {
      if (signal?.aborted || state.blocked || state.quarantinedReads > 0
          || state.cooldownUntil > this.#now()) return false;
      const woke = await new Promise<boolean>((resolve) => {
        let settled = false;
        const wake = () => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener("abort", abort);
          resolve(true);
        };
        const abort = () => {
          if (settled) return;
          settled = true;
          const index = state.waiters.indexOf(wake);
          if (index >= 0) state.waiters.splice(index, 1);
          resolve(false);
        };
        state.waiters.push(wake);
        signal?.addEventListener("abort", abort, { once: true });
      });
      if (!woke) return false;
    }
    if (signal?.aborted || state.blocked || state.quarantinedReads > 0
        || state.cooldownUntil > this.#now()) return false;
    state.active += 1;
    return true;
  }

  #release(upstream: string): void {
    const state = this.#upstreams.get(upstream)!;
    if (state.active <= 0) fail("upstream concurrency accounting underflow");
    state.active -= 1;
    state.waiters.shift()?.();
  }

  #wakeAll(upstream: string): void {
    const waiters = this.#upstreams.get(upstream)!.waiters.splice(0);
    for (const wake of waiters) wake();
  }

  #joinBudgetWindow(): BudgetWindow {
    if (!this.#budgetWindow) {
      this.#budgetWindow = { budgets: new Map([...this.#limits].map(([upstream, limit]) =>
        [upstream, { maximum: limit.maxRequestsPerRun, remaining: limit.maxRequestsPerRun }])), participants: 0 };
    }
    this.#budgetWindow.participants += 1;
    return this.#budgetWindow;
  }

  #touchCache(key: string, observation: MarketShoppingObservation): void {
    this.#cache.delete(key);
    this.#cache.set(key, clone(observation));
    this.#trimCache();
  }

  #trimCache(): void {
    while (this.#cache.size > this.#maxCacheEntries) {
      const oldest = this.#cache.keys().next().value as string | undefined;
      if (oldest === undefined) return;
      this.#cache.delete(oldest);
    }
  }
}

