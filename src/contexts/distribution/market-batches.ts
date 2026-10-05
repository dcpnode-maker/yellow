import {
  marketShoppingCadenceForDates,
  type MarketShoppingCadence,
} from "./market-shopping";

const DAY_MS = 86_400_000;
const MAX_PLANNED_REQUESTS = 4_000;
const MAX_BATCH_SIZE = 1_000;
const MAX_STRING_LENGTH = 256;
const MAX_LAST_SUCCESS_ENTRIES = MAX_PLANNED_REQUESTS;
// Covers the maximum generated key, including worst-case JSON escaping of scope text.
const MAX_LAST_SUCCESS_KEY_CHARACTERS = 131_072;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const CURRENCY = /^[A-Z]{3}$/;
const MARKET_INPUT = /^[A-Za-z]{2}$/;
const SUPPORTED_LANGUAGE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,3})?$/;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export type MarketBatchSourceId =
  | "booking-mcp"
  | "trivago-mcp"
  | "google-hotels-serpapi"
  | "google-visible";

export const MARKET_BATCH_SOURCE_IDS: readonly MarketBatchSourceId[] = Object.freeze([
  "booking-mcp",
  "trivago-mcp",
  "google-hotels-serpapi",
  "google-visible",
]);

export const MARKET_BATCH_PLANNER_LIMITS = Object.freeze({
  maximumPlannedRequests: MAX_PLANNED_REQUESTS,
  maximumBatchSize: MAX_BATCH_SIZE,
  maximumLastSuccessEntries: MAX_LAST_SUCCESS_ENTRIES,
  maximumLastSuccessKeyCharacters: MAX_LAST_SUCCESS_KEY_CHARACTERS,
} as const);

export interface MarketBatchGuests {
  readonly rooms: number;
  readonly adults: number;
  readonly childAges: readonly number[];
}

/** These labels are exact planning/cache dimensions. Supplying them does not prove
 * identity, permission, entitlement, competitor equivalence, or pricing authority. */
export interface MarketSourcePolicy {
  readonly tenantId: string;
  readonly managedPropertyId: string;
  readonly permissionScope: string;
  readonly entitlement: string;
  readonly propertyTimezone: string;
  readonly lookaheadMonths: 3 | 4;
  readonly selectedSources: readonly MarketBatchSourceId[];
  /** Opaque selected competitor ids/names. One search covers the whole selection. */
  readonly competitorScope: readonly string[];
  readonly destination: string;
  readonly guests: MarketBatchGuests;
  readonly currency: string;
  readonly pointOfSaleMarket: string;
  readonly language: string;
  readonly lengthsOfStayNights: readonly number[];
}

export interface MarketSourceRequestSelector {
  readonly source: MarketBatchSourceId;
  readonly arrivalDate: string;
  readonly lengthOfStayNights: number;
}

export interface PlannedMarketSourceRequest {
  readonly key: string;
  readonly tenantId: string;
  readonly managedPropertyId: string;
  readonly permissionScope: string;
  readonly entitlement: string;
  readonly competitorScope: readonly string[];
  readonly source: MarketBatchSourceId;
  readonly destination: string;
  readonly guests: MarketBatchGuests;
  readonly currency: string;
  readonly pointOfSaleMarket: string;
  readonly language: string;
  readonly arrivalDate: string;
  readonly checkoutDate: string;
  readonly lengthOfStayNights: number;
  readonly daysAhead: number;
  readonly cadence: MarketShoppingCadence;
}

export interface MarketSourceBatch {
  readonly batchNumber: number;
  readonly requests: readonly PlannedMarketSourceRequest[];
}

export interface BuildMarketSourcePlanOptions {
  readonly now: string | number | Date;
  /** Successful collection time by exact request key. This controls only Yellow's
   * collection cadence; it is not a claim about upstream source freshness. Callers
   * must prune history to the current lookahead's maximum 4,000 relevant keys. */
  readonly lastSuccessByKey?: Readonly<Record<string, string>>;
  readonly maxBatchSize: number;
  readonly maxRequestsThisRun: number;
}

export interface MarketSourcePlan {
  readonly asOfUtc: string;
  readonly propertyLocalDate: string;
  readonly arrivalEndExclusive: string;
  readonly requestedPotentialQueryCount: number;
  readonly dueRequestCount: number;
  readonly selectedRequestCount: number;
  readonly deferredRequestCount: number;
  readonly deferredDueToBudgetCount: number;
  readonly deferredDueToCadenceCount: number;
  /** Earliest UTC instant at which deferred work is eligible; null means none. */
  readonly nextDueAtUtc: string | null;
  readonly batches: readonly MarketSourceBatch[];
}

interface PolicySnapshot extends Omit<MarketSourcePolicy,
  "selectedSources" | "competitorScope" | "guests" | "lengthsOfStayNights"> {
  readonly selectedSources: readonly MarketBatchSourceId[];
  readonly competitorScope: readonly string[];
  readonly guests: MarketBatchGuests;
  readonly lengthsOfStayNights: readonly number[];
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

function boundedString(name: string, value: unknown, maximum = MAX_STRING_LENGTH): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum
      || value !== value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) {
    return fail(`${name} must be a nonempty bounded string without control characters`);
  }
  return value;
}

function pointOfSaleMarket(value: unknown): string {
  if (typeof value !== "string" || !MARKET_INPUT.test(value)) {
    return fail("pointOfSaleMarket must be a two-letter market code");
  }
  return value.toUpperCase();
}

function canonicalLanguage(value: unknown): string {
  const input = boundedString("language", value, 35);
  let canonical: string;
  try {
    const locales = Intl.getCanonicalLocales(input);
    if (locales.length !== 1) return fail("language must be one supported BCP47 language tag");
    canonical = locales[0] ?? fail("language must be one supported BCP47 language tag");
  } catch {
    return fail("language must be one supported BCP47 language tag");
  }
  if (!SUPPORTED_LANGUAGE.test(canonical)) {
    return fail("language must be one supported BCP47 language tag");
  }
  return canonical;
}

function exactLocalDate(name: string, value: unknown): string {
  if (typeof value !== "string") return fail(`${name} must be YYYY-MM-DD`);
  const match = LOCAL_DATE.exec(value);
  if (!match) return fail(`${name} must be YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day) return fail(`${name} must be a real calendar date`);
  return value;
}

function nowInstant(value: string | number | Date): number {
  if (typeof value === "string") {
    if (!UTC_INSTANT.test(value)) fail("now must be a UTC ISO instant");
    const parsed = Date.parse(value);
    const expected = value.replace(/(?:\.(\d{1,3}))?Z$/, (_whole, digits: string | undefined) =>
      `.${(digits ?? "").padEnd(3, "0")}Z`);
    if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== expected) {
      fail("now must be a real UTC ISO instant");
    }
    return parsed;
  }
  if (value instanceof Date) {
    const parsed = value.getTime();
    if (!Number.isFinite(parsed)) fail("now must be a real instant");
    return parsed;
  }
  if (!Number.isSafeInteger(value)) fail("now must be a finite integer Unix millisecond instant");
  return value;
}

function successInstant(name: string, value: unknown, now: number): number {
  if (typeof value !== "string" || !UTC_INSTANT.test(value)) return fail(`${name} must be a UTC ISO instant`);
  const parsed = Date.parse(value);
  const expected = value.replace(/(?:\.(\d{1,3}))?Z$/, (_whole, digits: string | undefined) =>
    `.${(digits ?? "").padEnd(3, "0")}Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== expected) {
    fail(`${name} must be a real UTC ISO instant`);
  }
  if (parsed > now) fail(`${name} cannot be in the future`);
  return parsed;
}

function propertyLocalDate(now: number, timeZone: string): string {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      calendar: "gregory",
      numberingSystem: "latn",
    });
  } catch {
    return fail("propertyTimezone must be a supported IANA timezone");
  }
  const parts = formatter.formatToParts(new Date(now));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((value) => value.type === type)?.value ?? fail("propertyTimezone date conversion failed");
  return exactLocalDate("property local date", `${part("year")}-${part("month")}-${part("day")}`);
}

function addCalendarMonths(date: string, months: 3 | 4): string {
  const [year, month, day] = exactLocalDate("date", date).split("-").map(Number) as [number, number, number];
  const targetMonthStart = new Date(Date.UTC(year, month - 1 + months, 1));
  const finalDay = new Date(Date.UTC(targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth(),
    Math.min(day, finalDay))).toISOString().slice(0, 10);
}

function addCalendarDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSorted<T extends string | number>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort((left, right) =>
    typeof left === "number" && typeof right === "number" ? left - right : compareText(String(left), String(right))));
}

function sortedNumbers(values: readonly number[]): readonly number[] {
  return Object.freeze([...values].sort((left, right) => left - right));
}

function snapshotPolicy(value: MarketSourcePolicy): PolicySnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("policy must be an object");
  if (value.lookaheadMonths !== 3 && value.lookaheadMonths !== 4) fail("lookaheadMonths must be 3 or 4");
  if (!Array.isArray(value.selectedSources) || value.selectedSources.length > 100) {
    fail("selectedSources must be a bounded explicit array");
  }
  for (const source of value.selectedSources) {
    if (!MARKET_BATCH_SOURCE_IDS.includes(source)) fail("selectedSources contains an unsupported source");
  }
  if (!Array.isArray(value.competitorScope) || value.competitorScope.length < 1
      || value.competitorScope.length > 200) fail("competitorScope must explicitly select 1 to 200 competitors");
  const competitors = value.competitorScope.map((item, index) =>
    boundedString(`competitorScope[${index}]`, item));
  if (!Array.isArray(value.lengthsOfStayNights) || value.lengthsOfStayNights.length < 1
      || value.lengthsOfStayNights.length > 365) fail("lengthsOfStayNights must contain 1 to 365 entries");
  const lengths = value.lengthsOfStayNights.map((length, index) =>
    integer(`lengthsOfStayNights[${index}]`, length, 1, 365));
  if (typeof value.guests !== "object" || value.guests === null || Array.isArray(value.guests)) {
    fail("guests must be an object");
  }
  if (!Array.isArray(value.guests.childAges) || value.guests.childAges.length > 100) {
    fail("guests.childAges must be a bounded array");
  }
  const childAges = value.guests.childAges.map((age, index) =>
    integer(`guests.childAges[${index}]`, age, 0, 25));
  const timeZone = boundedString("propertyTimezone", value.propertyTimezone, 128);
  // Construction verifies the identifier even when an empty source selection produces no work.
  propertyLocalDate(0, timeZone);
  return Object.freeze({
    tenantId: keyString("tenantId", value.tenantId),
    managedPropertyId: keyString("managedPropertyId", value.managedPropertyId),
    permissionScope: keyString("permissionScope", value.permissionScope),
    entitlement: keyString("entitlement", value.entitlement),
    propertyTimezone: timeZone,
    lookaheadMonths: value.lookaheadMonths,
    selectedSources: uniqueSorted(value.selectedSources),
    competitorScope: uniqueSorted(competitors),
    destination: boundedString("destination", value.destination),
    guests: Object.freeze({
      rooms: integer("guests.rooms", value.guests.rooms, 1, 100),
      adults: integer("guests.adults", value.guests.adults, 1, 200),
      childAges: sortedNumbers(childAges),
    }),
    currency: typeof value.currency === "string" && CURRENCY.test(value.currency)
      ? value.currency : fail("currency must be an uppercase three-letter code"),
    pointOfSaleMarket: pointOfSaleMarket(value.pointOfSaleMarket),
    language: canonicalLanguage(value.language),
    lengthsOfStayNights: uniqueSorted(lengths),
  });
}

function requestKey(policy: PolicySnapshot, selector: MarketSourceRequestSelector): string {
  return JSON.stringify([
    policy.tenantId,
    policy.managedPropertyId,
    policy.permissionScope,
    policy.entitlement,
    policy.competitorScope,
    selector.source,
    policy.destination,
    policy.guests.rooms,
    policy.guests.adults,
    policy.guests.childAges,
    policy.currency,
    policy.pointOfSaleMarket,
    policy.language,
    selector.arrivalDate,
    addCalendarDays(selector.arrivalDate, selector.lengthOfStayNights),
    selector.lengthOfStayNights,
  ]);
}

/** Builds the exact identity used both for planning and captured-result association. */
export function marketSourceRequestKey(
  policyValue: MarketSourcePolicy,
  selector: MarketSourceRequestSelector,
): string {
  const policy = snapshotPolicy(policyValue);
  if (!MARKET_BATCH_SOURCE_IDS.includes(selector.source)) fail("source is unsupported");
  if (!policy.selectedSources.includes(selector.source)) fail("source is not explicitly selected");
  const arrivalDate = exactLocalDate("arrivalDate", selector.arrivalDate);
  const lengthOfStayNights = integer("lengthOfStayNights", selector.lengthOfStayNights, 1, 365);
  if (!policy.lengthsOfStayNights.includes(lengthOfStayNights)) {
    fail("lengthOfStayNights is not explicitly selected");
  }
  return requestKey(policy, { source: selector.source, arrivalDate, lengthOfStayNights });
}

export function buildMarketSourcePlan(
  policyValue: MarketSourcePolicy,
  options: BuildMarketSourcePlanOptions,
): MarketSourcePlan {
  const policy = snapshotPolicy(policyValue);
  if (typeof options !== "object" || options === null || Array.isArray(options)) fail("options must be an object");
  const now = nowInstant(options.now);
  const asOfUtc = new Date(now).toISOString();
  const localToday = propertyLocalDate(now, policy.propertyTimezone);
  const endExclusive = addCalendarMonths(localToday, policy.lookaheadMonths);
  const maxBatchSize = integer("maxBatchSize", options.maxBatchSize, 1, MAX_BATCH_SIZE);
  const maxRequestsThisRun = integer("maxRequestsThisRun", options.maxRequestsThisRun, 0, MAX_PLANNED_REQUESTS);
  const successes = options.lastSuccessByKey ?? {};
  if (typeof successes !== "object" || successes === null || Array.isArray(successes)) {
    fail("lastSuccessByKey must be an object");
  }
  const parsedSuccesses = new Map<string, number>();
  const successEntries = Object.entries(successes);
  if (successEntries.length > MAX_LAST_SUCCESS_ENTRIES) {
    fail(`lastSuccessByKey must contain at most ${MAX_LAST_SUCCESS_ENTRIES} entries`);
  }
  for (const [key, value] of successEntries) {
    if (key.length < 1 || key.length > MAX_LAST_SUCCESS_KEY_CHARACTERS) {
      fail(`lastSuccessByKey keys must contain 1 to ${MAX_LAST_SUCCESS_KEY_CHARACTERS} characters`);
    }
    parsedSuccesses.set(key, successInstant(`lastSuccessByKey[${JSON.stringify(key)}]`, value, now));
  }

  const arrivalCount = (Date.parse(`${endExclusive}T00:00:00.000Z`)
    - Date.parse(`${localToday}T00:00:00.000Z`)) / DAY_MS;
  const requestedPotentialQueryCount = arrivalCount * policy.selectedSources.length
    * policy.lengthsOfStayNights.length;
  if (requestedPotentialQueryCount > MAX_PLANNED_REQUESTS) {
    fail(`policy would plan ${requestedPotentialQueryCount} requests; maximum is ${MAX_PLANNED_REQUESTS}`);
  }

  const due: PlannedMarketSourceRequest[] = [];
  let deferredDueToCadenceCount = 0;
  let earliestCadenceDue = Number.POSITIVE_INFINITY;
  for (let daysAhead = 0; daysAhead < arrivalCount; daysAhead += 1) {
    const arrivalDate = addCalendarDays(localToday, daysAhead);
    const cadence = marketShoppingCadenceForDates(localToday, arrivalDate, "calendar-month");
    if (cadence.kind !== "fixed") fail("finite market horizon unexpectedly reached calendar-month cadence");
    for (const source of policy.selectedSources) {
      for (const lengthOfStayNights of policy.lengthsOfStayNights) {
        const key = requestKey(policy, { source, arrivalDate, lengthOfStayNights });
        const lastSuccess = parsedSuccesses.get(key);
        const nextDue = lastSuccess === undefined
          ? Number.NEGATIVE_INFINITY
          : lastSuccess + cadence.intervalMinutes * 60_000;
        if (nextDue > now) {
          deferredDueToCadenceCount += 1;
          earliestCadenceDue = Math.min(earliestCadenceDue, nextDue);
          continue;
        }
        due.push(Object.freeze({
          key,
          tenantId: policy.tenantId,
          managedPropertyId: policy.managedPropertyId,
          permissionScope: policy.permissionScope,
          entitlement: policy.entitlement,
          competitorScope: policy.competitorScope,
          source,
          destination: policy.destination,
          guests: policy.guests,
          currency: policy.currency,
          pointOfSaleMarket: policy.pointOfSaleMarket,
          language: policy.language,
          arrivalDate,
          checkoutDate: addCalendarDays(arrivalDate, lengthOfStayNights),
          lengthOfStayNights,
          daysAhead,
          cadence,
        }));
      }
    }
  }
  due.sort((left, right) => left.daysAhead - right.daysAhead
    || compareText(left.source, right.source)
    || left.lengthOfStayNights - right.lengthOfStayNights
    || compareText(left.key, right.key));
  const selected = due.slice(0, maxRequestsThisRun);
  const deferredDueToBudgetCount = due.length - selected.length;
  const batches: MarketSourceBatch[] = [];
  for (let index = 0; index < selected.length; index += maxBatchSize) {
    batches.push(Object.freeze({
      batchNumber: batches.length + 1,
      requests: Object.freeze(selected.slice(index, index + maxBatchSize)),
    }));
  }
  const deferredRequestCount = deferredDueToBudgetCount + deferredDueToCadenceCount;
  const nextDue = deferredDueToBudgetCount > 0 ? now : earliestCadenceDue;
  return Object.freeze({
    asOfUtc,
    propertyLocalDate: localToday,
    arrivalEndExclusive: endExclusive,
    requestedPotentialQueryCount,
    dueRequestCount: due.length,
    selectedRequestCount: selected.length,
    deferredRequestCount,
    deferredDueToBudgetCount,
    deferredDueToCadenceCount,
    nextDueAtUtc: Number.isFinite(nextDue) ? new Date(nextDue).toISOString() : null,
    batches: Object.freeze(batches),
  });
}

