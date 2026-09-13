const SERPAPI_ENDPOINT = "https://serpapi.com/search";
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576;
const MAX_CAPTURE_BYTES = 2_097_152;
const MAX_CANDIDATES = 500;
const MAX_STRING = 2_048;
const MAX_URL = 4_096;
const MAX_MONEY_MINOR = 9_223_372_036_854_775_807n;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const MARKET = /^[A-Z]{2}$/u;
const LANGUAGE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,3})?$/u;

export const MARKET_SOURCE_ADAPTER_LIMITS = Object.freeze({
  maxCaptureBytes: MAX_CAPTURE_BYTES,
  maxCandidates: MAX_CANDIDATES,
  maxStringCharacters: MAX_STRING,
  maxUrlCharacters: MAX_URL,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
  minimumTimeoutMs: 100,
  maximumTimeoutMs: 120_000,
  defaultResponseBytes: DEFAULT_MAX_RESPONSE_BYTES,
  minimumResponseBytes: 1_024,
  maximumResponseBytes: 4_194_304,
  maximumPropertyDetailRequests: 10,
  maximumApiKeyCharacters: 512,
} as const);

export type MarketSourceId =
  | "booking-mcp"
  | "trivago-mcp"
  | "google-hotels-serpapi"
  | "google-visible";

export const MARKET_SOURCE_IDS: readonly MarketSourceId[] = Object.freeze([
  "booking-mcp", "trivago-mcp", "google-hotels-serpapi", "google-visible",
]);

export interface MarketSourceQuery {
  readonly destination: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly adults: number;
  readonly rooms: number;
  readonly childrenAges: readonly number[];
  readonly currency: string;
  readonly pointOfSaleMarket: string;
  readonly language: string;
}

export interface MarketSourceMoney {
  /** The source's exact formatted or decimal text. */
  readonly raw: string;
  /** Exact base-10 minor units when the raw text can be parsed without floating point. */
  readonly amountMinor: string | null;
  readonly currency: string;
  readonly basis: "per-night" | "entire-stay" | "reported-book-price" | "unknown";
}

export interface MarketSourceCandidate {
  readonly source: MarketSourceId;
  readonly aggregator: string | null;
  readonly advertiser: string | null;
  readonly externalPropertyId: string | null;
  readonly propertyName: string;
  /** Public URL with credentials, query, and fragment removed. */
  readonly propertyUrl: string | null;
  readonly propertyType: string | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly starRating: string | null;
  readonly guestRating: string | null;
  readonly reviewCount: string | null;
  readonly price: MarketSourceMoney;
  readonly roomName: string | null;
  readonly mealPlan: string | null;
  readonly cancellationText: string | null;
  readonly refundability: boolean | null;
  readonly rateInclusions: readonly string[];
  readonly taxesAndFeesText: string | null;
  readonly taxesIncluded: boolean | null;
  readonly feesIncluded: boolean | null;
  readonly query: MarketSourceQuery;
  /** Connector request creation time when the provider actually supplies it. */
  readonly queriedAt: string | null;
  /** Connector processing completion time; it is not an inventory refresh time. */
  readonly connectorProcessedAt: string | null;
  readonly collectedAt: string | null;
  /** OTA/property inventory update time. Current sources do not supply it. */
  readonly sourceUpdatedAt: string | null;
  readonly comparisonAuthority: "search-candidate-only";
  readonly automaticPricingEligible: false;
}

export type MarketSourceIssueCode =
  | "invalid-payload"
  | "payload-too-large"
  | "invalid-response-status"
  | "query-mismatch"
  | "unknown-collection-time"
  | "candidate-limit"
  | "invalid-property"
  | "invalid-price";

export interface MarketSourceIssue {
  readonly code: MarketSourceIssueCode;
  readonly path: string;
  readonly candidateIndex: number | null;
}

export interface MarketSourceNormalizationInput {
  readonly source: MarketSourceId;
  readonly query: MarketSourceQuery;
  readonly collectedAt: string | null;
  readonly payload: unknown;
}

export interface MarketSourceNormalizationResult {
  readonly source: MarketSourceId;
  readonly query: MarketSourceQuery;
  readonly collectedAt: string | null;
  readonly candidates: readonly MarketSourceCandidate[];
  readonly issues: readonly MarketSourceIssue[];
}

export interface SerpApiGoogleHotelsOptions {
  readonly apiKey: string;
  readonly fetch?: MarketSourceFetch;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
  /** Number of property detail requests after the single search request. Default: 0. */
  readonly propertyDetailLimit?: number;
  readonly noCache?: boolean;
  readonly signal?: AbortSignal;
  readonly now?: () => number;
}

export type MarketSourceFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type MarketSourceReadFailureKind =
  | "missing-credential"
  | "invalid-query"
  | "timeout"
  | "network"
  | "http-status"
  | "redirect"
  | "invalid-content-type"
  | "response-too-large"
  | "invalid-response";

export interface MarketSourceReadError {
  readonly kind: MarketSourceReadFailureKind;
  readonly retryable: boolean;
  readonly status: number | null;
}

export type MarketSourceReadResult = Readonly<
  | { readonly ok: true; readonly value: MarketSourceNormalizationResult }
  | { readonly ok: false; readonly error: MarketSourceReadError }
>;

interface CandidateBase {
  readonly externalPropertyId: string | null;
  readonly propertyName: string;
  readonly propertyUrl: string | null;
  readonly propertyType: string | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly starRating: string | null;
  readonly guestRating: string | null;
  readonly reviewCount: string | null;
}

function fail(message: string): never {
  throw new TypeError(message);
}

function plainObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype) return null;
  return value as Record<string, unknown>;
}

function boundedString(value: unknown, maximum = MAX_STRING): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maximum
    && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value) ? value : null;
}

function scalarText(value: unknown): string | null {
  if (typeof value === "string") return boundedString(value, 128);
  if (typeof value === "number" && Number.isFinite(value) && Number.isSafeInteger(value)) return String(value);
  return null;
}

function moneyRaw(value: unknown): string | null {
  if (typeof value === "string") return boundedString(value, 256);
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const text = String(value);
  return /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(text) ? text : null;
}

function localDate(name: string, value: unknown): string {
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

function utcInstant(name: string, value: unknown): string {
  if (typeof value !== "string" || !UTC_INSTANT.test(value)) return fail(`${name} must be a UTC ISO instant`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fail(`${name} must be a real UTC ISO instant`);
  const expected = value.replace(/(?:\.(\d{1,3}))?Z$/u, (_whole, digits: string | undefined) =>
    `.${(digits ?? "").padEnd(3, "0")}Z`);
  if (new Date(parsed).toISOString() !== expected) return fail(`${name} must be a real UTC ISO instant`);
  return value;
}

function optionalUtcInstant(value: unknown): string | null {
  try { return utcInstant("timestamp", value); } catch { return null; }
}

function integer(name: string, value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    return fail(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

function snapshotQuery(value: MarketSourceQuery): MarketSourceQuery {
  const destination = boundedString(value.destination, 256);
  if (!destination) fail("query.destination is invalid");
  const checkInDate = localDate("query.checkInDate", value.checkInDate);
  const checkOutDate = localDate("query.checkOutDate", value.checkOutDate);
  if (Date.parse(`${checkOutDate}T00:00:00.000Z`) <= Date.parse(`${checkInDate}T00:00:00.000Z`)) {
    fail("query.checkOutDate must be after check-in");
  }
  if (!Array.isArray(value.childrenAges) || value.childrenAges.length > 20
      || value.childrenAges.some((age) => !Number.isSafeInteger(age) || age < 0 || age > 17)) {
    fail("query.childrenAges is invalid");
  }
  if (!CURRENCY.test(value.currency)) fail("query.currency is invalid");
  if (!MARKET.test(value.pointOfSaleMarket)) fail("query.pointOfSaleMarket is invalid");
  if (!LANGUAGE.test(value.language)) fail("query.language is invalid");
  return Object.freeze({
    destination,
    checkInDate,
    checkOutDate,
    adults: integer("query.adults", value.adults, 1, 20),
    rooms: integer("query.rooms", value.rooms, 1, 20),
    childrenAges: Object.freeze([...value.childrenAges]),
    currency: value.currency,
    pointOfSaleMarket: value.pointOfSaleMarket,
    language: value.language,
  });
}

function issue(code: MarketSourceIssueCode, path: string, candidateIndex: number | null = null): MarketSourceIssue {
  return Object.freeze({ code, path, candidateIndex });
}

function safePayloadSize(payload: unknown): number | null {
  try {
    const json = JSON.stringify(payload);
    return json === undefined ? null : new TextEncoder().encode(json).byteLength;
  } catch {
    return null;
  }
}

function safeUrl(value: unknown): string | null {
  const text = boundedString(value, MAX_URL);
  if (!text) return null;
  try {
    const url = new URL(text);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

const ZERO_MINOR_CURRENCIES = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
const THREE_MINOR_CURRENCIES = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

function currencyScale(currency: string): number {
  return ZERO_MINOR_CURRENCIES.has(currency) ? 0 : THREE_MINOR_CURRENCIES.has(currency) ? 3 : 2;
}

function moneyMinor(raw: string, currency: string): string | null {
  const scale = currencyScale(currency);
  let text = raw.normalize("NFKC").trim();
  const prefixed = new RegExp(`^${currency}(?=\\s|[0-9])`, "iu");
  const suffixed = new RegExp(`\\s*${currency}$`, "iu");
  if (prefixed.test(text)) text = text.replace(prefixed, "");
  else if (suffixed.test(text)) text = text.replace(suffixed, "");
  text = text.replace(/[\s\u00A0\u202F]/gu, "");
  if (/\p{L}/u.test(text)) return null;
  const firstDigit = text.search(/[0-9]/u);
  if (firstDigit < 0) return null;
  let lastDigit = text.length - 1;
  while (lastDigit >= firstDigit && !/[0-9]/u.test(text[lastDigit] ?? "")) lastDigit -= 1;
  const adornment = `${text.slice(0, firstDigit)}${text.slice(lastDigit + 1)}`;
  if (/[.,+-]/u.test(adornment)) return null;
  text = text.slice(firstDigit, lastDigit + 1);
  if (!text || text.startsWith("-") || text.startsWith("+")) return null;
  const dot = text.lastIndexOf(".");
  const comma = text.lastIndexOf(",");
  let whole = text;
  let fraction = "";
  const groupedWhole = (value: string, separator: string): string | null => {
    const groups = value.split(separator);
    if (!/^[0-9]+$/u.test(groups[0] ?? "")
        || groups.slice(1).some((group) => !/^[0-9]{3}$/u.test(group))) return null;
    return groups.join("");
  };
  if (dot >= 0 && comma >= 0) {
    const decimalIndex = Math.max(dot, comma);
    const decimalSeparator = decimalIndex === dot ? "." : ",";
    const groupingSeparator = decimalSeparator === "." ? "," : ".";
    const possibleFraction = text.slice(decimalIndex + 1);
    const parsedWhole = groupedWhole(text.slice(0, decimalIndex), groupingSeparator);
    if (!parsedWhole || scale === 0 || possibleFraction.length < 1 || possibleFraction.length > scale) return null;
    whole = parsedWhole;
    fraction = possibleFraction;
  } else if (dot >= 0 || comma >= 0) {
    const separator = dot >= 0 ? "." : ",";
    const groups = text.split(separator);
    const possibleFraction = groups.at(-1) ?? "";
    if (groups.length === 2 && possibleFraction.length === 3) return null;
    if (groups.length === 2 && scale > 0 && possibleFraction.length >= 1
        && possibleFraction.length <= scale) {
      whole = groups[0] ?? "";
      fraction = possibleFraction;
    } else {
      const parsedWhole = groupedWhole(text, separator);
      if (!parsedWhole) return null;
      whole = parsedWhole;
    }
  }
  if (!/^[0-9]+$/u.test(whole) || (fraction && !/^[0-9]+$/u.test(fraction))) return null;
  if (fraction.length > scale) return null;
  const minorText = `${whole}${fraction.padEnd(scale, "0")}`.replace(/^0+(?=\d)/u, "");
  const parsed = BigInt(minorText || "0");
  return parsed <= MAX_MONEY_MINOR ? parsed.toString() : null;
}

function makeMoney(raw: string, currency: string, basis: MarketSourceMoney["basis"]): MarketSourceMoney {
  return Object.freeze({ raw, amountMinor: moneyMinor(raw, currency), currency, basis });
}

function coordinate(value: unknown, minimum: number, maximum: number): string | null {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum
    ? String(value) : null;
}

function baseFromProperty(property: Record<string, unknown>, idKey: string, nameKey: string): CandidateBase | null {
  const name = boundedString(property[nameKey], 512);
  if (!name) return null;
  const location = plainObject(property.location);
  const gps = plainObject(property.gps_coordinates) ?? plainObject(location?.coordinates);
  const rating = plainObject(property.rating);
  return {
    externalPropertyId: scalarText(property[idKey]),
    propertyName: name,
    propertyUrl: safeUrl(property.url ?? property.link ?? property.accommodation_url),
    propertyType: boundedString(property.type, 128),
    latitude: coordinate(property.latitude ?? gps?.latitude, -90, 90),
    longitude: coordinate(property.longitude ?? gps?.longitude, -180, 180),
    starRating: scalarText(property.hotel_rating ?? property.extracted_hotel_class ?? rating?.stars),
    guestRating: scalarText(property.overall_rating ?? rating?.review_score),
    reviewCount: scalarText(property.reviews ?? rating?.number_of_reviews),
  };
}

function candidate(
  source: MarketSourceId,
  query: MarketSourceQuery,
  collectedAt: string | null,
  base: CandidateBase,
  input: Readonly<{
    aggregator: string | null;
    advertiser: string | null;
    price: MarketSourceMoney;
    roomName?: string | null;
    mealPlan?: string | null;
    cancellationText?: string | null;
    refundability?: boolean | null;
    rateInclusions?: readonly string[];
    taxesAndFeesText?: string | null;
    queriedAt?: string | null;
    connectorProcessedAt?: string | null;
  }>,
): MarketSourceCandidate {
  return Object.freeze({
    source,
    aggregator: input.aggregator,
    advertiser: input.advertiser,
    ...base,
    price: input.price,
    roomName: input.roomName ?? null,
    mealPlan: input.mealPlan ?? null,
    cancellationText: input.cancellationText ?? null,
    refundability: input.refundability ?? null,
    rateInclusions: Object.freeze([...(input.rateInclusions ?? [])]),
    taxesAndFeesText: input.taxesAndFeesText ?? null,
    taxesIncluded: null,
    feesIncluded: null,
    query,
    queriedAt: input.queriedAt ?? null,
    connectorProcessedAt: input.connectorProcessedAt ?? null,
    collectedAt,
    sourceUpdatedAt: null,
    comparisonAuthority: "search-candidate-only",
    automaticPricingEligible: false,
  });
}

function normalizeBooking(
  root: Record<string, unknown>, query: MarketSourceQuery, collectedAt: string | null,
  candidates: MarketSourceCandidate[], issues: MarketSourceIssue[],
): void {
  const accommodations = root.accommodations;
  if (!Array.isArray(accommodations)) {
    issues.push(issue("invalid-payload", "payload.accommodations"));
    return;
  }
  const maximum = Math.min(accommodations.length, MAX_CANDIDATES);
  if (accommodations.length > MAX_CANDIDATES) issues.push(issue("candidate-limit", "payload.accommodations"));
  for (let index = 0; index < maximum; index += 1) {
    const item = plainObject(accommodations[index]);
    const base = item && baseFromProperty(item, "id", "name");
    if (!item || !base) { issues.push(issue("invalid-property", `payload.accommodations[${index}]`, index)); continue; }
    const price = plainObject(item.price);
    const currency = boundedString(price?.currency, 3);
    const raw = moneyRaw(price?.book);
    if (!currency || currency !== query.currency || !raw) {
      issues.push(issue("invalid-price", `payload.accommodations[${index}].price`, index));
      continue;
    }
    candidates.push(candidate("booking-mcp", query, collectedAt, base, {
      aggregator: "Booking.com", advertiser: "Booking.com",
      price: makeMoney(raw, currency, "reported-book-price"),
    }));
  }
}

function normalizeTrivago(
  root: Record<string, unknown>, query: MarketSourceQuery, collectedAt: string | null,
  candidates: MarketSourceCandidate[], issues: MarketSourceIssue[],
): void {
  const accommodations = root.accommodations;
  if (!Array.isArray(accommodations)) {
    issues.push(issue("invalid-payload", "payload.accommodations"));
    return;
  }
  const maximum = Math.min(accommodations.length, MAX_CANDIDATES);
  if (accommodations.length > MAX_CANDIDATES) issues.push(issue("candidate-limit", "payload.accommodations"));
  for (let index = 0; index < maximum; index += 1) {
    const item = plainObject(accommodations[index]);
    if (!item || item.arrival !== query.checkInDate || item.departure !== query.checkOutDate) {
      issues.push(issue("query-mismatch", `payload.accommodations[${index}]`, index));
      continue;
    }
    const base = baseFromProperty(item, "accommodation_id", "accommodation_name");
    if (!base) { issues.push(issue("invalid-property", `payload.accommodations[${index}]`, index)); continue; }
    const currency = boundedString(item.currency, 3);
    const perStay = boundedString(item.price_per_stay, 256);
    const perNight = boundedString(item.price_per_night, 256);
    const raw = perStay ?? perNight;
    if (!currency || currency !== query.currency || !raw) {
      issues.push(issue("invalid-price", `payload.accommodations[${index}]`, index));
      continue;
    }
    const advertiser = boundedString(item.advertisers, 256);
    candidates.push(candidate("trivago-mcp", query, collectedAt, base, {
      aggregator: "trivago", advertiser,
      price: makeMoney(raw, currency, perStay ? "entire-stay" : "per-night"),
    }));
  }
}

function sameSerpQuery(parameters: Record<string, unknown>, query: MarketSourceQuery): boolean {
  const children = query.childrenAges.length;
  return parameters.engine === "google_hotels" && parameters.q === query.destination
    && parameters.check_in_date === query.checkInDate && parameters.check_out_date === query.checkOutDate
    && parameters.adults === query.adults && parameters.children === children
    && parameters.currency === query.currency && parameters.gl === query.pointOfSaleMarket.toLowerCase()
    && parameters.hl === query.language;
}

function serpTimes(root: Record<string, unknown>): { queriedAt: string | null; connectorProcessedAt: string | null } {
  const metadata = plainObject(root.search_metadata);
  return {
    queriedAt: optionalUtcInstant(metadata?.created_at),
    connectorProcessedAt: optionalUtcInstant(metadata?.processed_at),
  };
}

function normalizeSerpProperty(
  property: Record<string, unknown>, query: MarketSourceQuery, collectedAt: string | null,
  times: ReturnType<typeof serpTimes>, candidates: MarketSourceCandidate[], issues: MarketSourceIssue[], path: string,
): void {
  const base = baseFromProperty(property, "property_id", "name");
  if (!base) { issues.push(issue("invalid-property", path)); return; }
  const prices = Array.isArray(property.prices) ? property.prices.slice(0, MAX_CANDIDATES) : [];
  const rows = prices.length > 0 ? prices.slice(0, MAX_CANDIDATES - candidates.length) : [property];
  for (let index = 0; index < rows.length; index += 1) {
    const row = plainObject(rows[index]);
    const priceObject = plainObject(row?.rate_per_night ?? property.rate_per_night);
    const raw = boundedString(priceObject?.lowest, 256);
    if (!row || !raw) { issues.push(issue("invalid-price", `${path}.prices[${index}]`)); continue; }
    candidates.push(candidate("google-hotels-serpapi", query, collectedAt, base, {
      aggregator: "Google Hotels",
      advertiser: row === property ? null : boundedString(row.source, 256),
      price: makeMoney(raw, query.currency, "per-night"),
      queriedAt: times.queriedAt,
      connectorProcessedAt: times.connectorProcessedAt,
    }));
  }
}

function normalizeSerpDetail(
  detail: Record<string, unknown>, query: MarketSourceQuery, collectedAt: string | null,
  candidates: MarketSourceCandidate[], issues: MarketSourceIssue[], path: string,
): void {
  const base = baseFromProperty(detail, "property_id", "name");
  if (!base) { issues.push(issue("invalid-property", path)); return; }
  const times = serpTimes(detail);
  const featured = Array.isArray(detail.featured_prices) ? detail.featured_prices : [];
  for (let sourceIndex = 0; sourceIndex < featured.length && sourceIndex < MAX_CANDIDATES
      && candidates.length < MAX_CANDIDATES; sourceIndex += 1) {
    const source = plainObject(featured[sourceIndex]);
    if (!source) { issues.push(issue("invalid-property", `${path}.featured_prices[${sourceIndex}]`)); continue; }
    const advertiser = boundedString(source.source, 256);
    const rooms = Array.isArray(source.rooms) ? source.rooms : [];
    const rows = rooms.length > 0 ? rooms.slice(0, MAX_CANDIDATES) : [source];
    for (let roomIndex = 0; roomIndex < rows.length && candidates.length < MAX_CANDIDATES; roomIndex += 1) {
      const room = plainObject(rows[roomIndex]);
      if (!room) { issues.push(issue("invalid-property", `${path}.featured_prices[${sourceIndex}].rooms[${roomIndex}]`)); continue; }
      const rates = Array.isArray(room.rates) ? room.rates.slice(0, MAX_CANDIDATES) : [];
      const rateRows: readonly unknown[] = rates.length > 0 ? rates : [null];
      for (let rateIndex = 0; rateIndex < rateRows.length && candidates.length < MAX_CANDIDATES; rateIndex += 1) {
        const rate = rateRows[rateIndex] === null ? null : plainObject(rateRows[rateIndex]);
        if (rateRows[rateIndex] !== null && !rate) {
          issues.push(issue("invalid-price", `${path}.featured_prices[${sourceIndex}].rooms[${roomIndex}].rates[${rateIndex}]`));
          continue;
        }
        const total = rate
          ? plainObject(rate.total_rate)
          : plainObject(room.total_rate ?? source.total_rate);
        const priceObject = total ?? (rate
          ? plainObject(rate.rate_per_night)
          : plainObject(room.rate_per_night ?? source.rate_per_night));
        const raw = boundedString(priceObject?.lowest, 256);
        if (!raw) {
          issues.push(issue("invalid-price", `${path}.featured_prices[${sourceIndex}].rooms[${roomIndex}].rates[${rateIndex}]`));
          continue;
        }
        const inclusions = Array.isArray(rate?.inclusions)
          ? rate.inclusions.filter((value): value is string => boundedString(value, 256) !== null).slice(0, 20)
          : [];
        candidates.push(candidate("google-hotels-serpapi", query, collectedAt, base, {
          aggregator: "Google Hotels", advertiser,
          price: makeMoney(raw, query.currency, total ? "entire-stay" : "per-night"),
          roomName: boundedString(room.name, 512),
          mealPlan: rate?.breakfast_included === true ? "breakfast included"
            : rate?.breakfast_included === false ? "breakfast not included" : null,
          cancellationText: rate?.free_cancellation === true ? "free cancellation"
            : rate?.free_cancellation === false ? "free cancellation not included" : null,
          refundability: typeof rate?.free_cancellation === "boolean" ? rate.free_cancellation : null,
          rateInclusions: inclusions,
          queriedAt: times.queriedAt, connectorProcessedAt: times.connectorProcessedAt,
        }));
      }
    }
  }
}

function normalizeSerp(
  root: Record<string, unknown>, query: MarketSourceQuery, collectedAt: string | null,
  candidates: MarketSourceCandidate[], issues: MarketSourceIssue[],
): void {
  const combinedSearch = plainObject(root.search);
  const search = combinedSearch ?? root;
  const metadata = plainObject(search.search_metadata);
  const parameters = plainObject(search.search_parameters);
  if (!metadata || metadata.status !== "Success") {
    issues.push(issue("invalid-response-status", combinedSearch ? "payload.search.search_metadata" : "payload.search_metadata"));
    return;
  }
  if (!parameters || !sameSerpQuery(parameters, query)) {
    issues.push(issue("query-mismatch", combinedSearch ? "payload.search.search_parameters" : "payload.search_parameters"));
    return;
  }
  const properties = search.properties;
  if (Array.isArray(properties)) {
    if (properties.length > MAX_CANDIDATES) issues.push(issue("candidate-limit", "payload.properties"));
    for (let index = 0; index < properties.length && index < MAX_CANDIDATES
        && candidates.length < MAX_CANDIDATES; index += 1) {
      const property = plainObject(properties[index]);
      if (!property) { issues.push(issue("invalid-property", `payload.properties[${index}]`, index)); continue; }
      normalizeSerpProperty(property, query, collectedAt, serpTimes(search), candidates, issues, `payload.properties[${index}]`);
    }
  }
  const details = root.details;
  if (Array.isArray(details)) {
    if (details.length > MAX_CANDIDATES) issues.push(issue("candidate-limit", "payload.details"));
    for (let index = 0; index < details.length && index < MAX_CANDIDATES
        && candidates.length < MAX_CANDIDATES; index += 1) {
      const wrapped = plainObject(details[index]);
      const detail = plainObject(wrapped?.payload ?? wrapped);
      const expectedToken = boundedString(wrapped?.propertyToken, 1_024);
      const detailMetadata = plainObject(detail?.search_metadata);
      const detailParameters = plainObject(detail?.search_parameters);
      if (!detail || !detailMetadata || detailMetadata.status !== "Success") {
        issues.push(issue("invalid-response-status", `payload.details[${index}].search_metadata`, index));
      } else if (!expectedToken || !detailParameters || !sameSerpQuery(detailParameters, query)
          || detailParameters.property_token !== expectedToken) {
        issues.push(issue("query-mismatch", `payload.details[${index}].search_parameters`, index));
      } else {
        normalizeSerpDetail(detail, query, collectedAt, candidates, issues, `payload.details[${index}]`);
      }
    }
  } else if (!Array.isArray(properties) && Array.isArray(root.featured_prices)) {
    issues.push(issue("query-mismatch", "payload.search_parameters.property_token"));
  }
}

function captureContextMatches(value: unknown, query: MarketSourceQuery): boolean {
  const context = plainObject(value);
  if (!context) return false;
  const pairs: ReadonlyArray<readonly [string, unknown]> = [
    ["destination", query.destination], ["checkInDate", query.checkInDate], ["checkOutDate", query.checkOutDate],
    ["adults", query.adults], ["rooms", query.rooms], ["currency", query.currency],
    ["pointOfSaleMarket", query.pointOfSaleMarket], ["language", query.language],
  ];
  return pairs.every(([key, expected]) => context[key] === expected)
    && JSON.stringify(context.childrenAges) === JSON.stringify(query.childrenAges);
}

function normalizeGoogleVisible(
  root: Record<string, unknown>, query: MarketSourceQuery, collectedAt: string | null,
  candidates: MarketSourceCandidate[], issues: MarketSourceIssue[],
): void {
  if (!captureContextMatches(root.captureContext, query)) {
    issues.push(issue("query-mismatch", "payload.captureContext"));
    return;
  }
  const capture = plainObject(root.captureContext);
  const queriedAt = optionalUtcInstant(capture?.queriedAt);
  if (!Array.isArray(root.properties)) { issues.push(issue("invalid-payload", "payload.properties")); return; }
  if (root.properties.length > MAX_CANDIDATES) issues.push(issue("candidate-limit", "payload.properties"));
  for (let index = 0; index < root.properties.length && index < MAX_CANDIDATES
      && candidates.length < MAX_CANDIDATES; index += 1) {
    const property = plainObject(root.properties[index]);
    const base = property && baseFromProperty(property, "id", "name");
    if (!property || !base || !Array.isArray(property.offers)) {
      issues.push(issue("invalid-property", `payload.properties[${index}]`, index)); continue;
    }
    if (property.offers.length > MAX_CANDIDATES) {
      issues.push(issue("candidate-limit", `payload.properties[${index}].offers`, index));
    }
    for (let offerIndex = 0; offerIndex < property.offers.length && offerIndex < MAX_CANDIDATES
        && candidates.length < MAX_CANDIDATES; offerIndex += 1) {
      const offer = plainObject(property.offers[offerIndex]);
      const price = plainObject(offer?.price);
      const raw = boundedString(price?.raw, 256);
      const currency = boundedString(price?.currency, 3);
      const basis = price?.basis;
      const advertiser = boundedString(offer?.advertiser, 256);
      if (!offer || !raw || currency !== query.currency
          || (basis !== "per-night" && basis !== "entire-stay" && basis !== "unknown") || !advertiser) {
        issues.push(issue("invalid-price", `payload.properties[${index}].offers[${offerIndex}]`, index)); continue;
      }
      candidates.push(candidate("google-visible", query, collectedAt, base, {
        aggregator: "Google Hotels", advertiser, price: makeMoney(raw, currency, basis),
        roomName: offer.roomName === null ? null : boundedString(offer.roomName, 512),
        mealPlan: offer.mealPlan === null ? null : boundedString(offer.mealPlan, 512),
        cancellationText: offer.cancellationText === null ? null : boundedString(offer.cancellationText, 512),
        taxesAndFeesText: offer.taxesAndFeesText === null ? null : boundedString(offer.taxesAndFeesText, 512),
        queriedAt,
      }));
    }
  }
}

export function normalizeMarketSourceCapture(input: MarketSourceNormalizationInput): MarketSourceNormalizationResult {
  if (!(MARKET_SOURCE_IDS as readonly unknown[]).includes(input.source)) fail("source is invalid");
  const query = snapshotQuery(input.query);
  const collectedAt = input.source === "google-visible" && input.collectedAt === null
    ? null : utcInstant("collectedAt", input.collectedAt);
  const candidates: MarketSourceCandidate[] = [];
  const issues: MarketSourceIssue[] = [];
  if (collectedAt === null) issues.push(issue("unknown-collection-time", "collectedAt"));
  const size = safePayloadSize(input.payload);
  const root = plainObject(input.payload);
  if (size === null || !root) issues.push(issue("invalid-payload", "payload"));
  else if (size > MAX_CAPTURE_BYTES) issues.push(issue("payload-too-large", "payload"));
  else {
    switch (input.source) {
      case "booking-mcp": normalizeBooking(root, query, collectedAt, candidates, issues); break;
      case "trivago-mcp": normalizeTrivago(root, query, collectedAt, candidates, issues); break;
      case "google-hotels-serpapi": normalizeSerp(root, query, collectedAt, candidates, issues); break;
      case "google-visible": normalizeGoogleVisible(root, query, collectedAt, candidates, issues); break;
    }
  }
  return Object.freeze({ source: input.source, query, collectedAt,
    candidates: Object.freeze(candidates), issues: Object.freeze(issues) });
}

class TransportFailure {
  constructor(readonly error: MarketSourceReadError) {}
}

function readFailure(kind: MarketSourceReadFailureKind, retryable = false, status: number | null = null): MarketSourceReadResult {
  return Object.freeze({ ok: false, error: Object.freeze({ kind, retryable, status }) });
}

function transportFailure(kind: MarketSourceReadFailureKind, retryable = false, status: number | null = null): never {
  throw new TransportFailure(Object.freeze({ kind, retryable, status }));
}

async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return transportFailure("timeout", true);
  let listener: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    listener = () => reject(new TransportFailure(Object.freeze({ kind: "timeout", retryable: true, status: null })));
    signal.addEventListener("abort", listener, { once: true });
  });
  try { return await Promise.race([promise, aborted]); }
  finally { if (listener) signal.removeEventListener("abort", listener); }
}

async function readBoundedJson(response: Response, maximum: number, signal: AbortSignal): Promise<unknown> {
  const discard = (): void => { try { void response.body?.cancel().catch(() => undefined); } catch { /* sanitized */ } };
  if (response.redirected || (response.url && new URL(response.url).origin !== "https://serpapi.com")) {
    discard(); return transportFailure("redirect");
  }
  if (response.status !== 200) {
    discard(); return transportFailure("http-status", response.status === 429 || response.status >= 500, response.status);
  }
  const contentType = response.headers.get("content-type");
  if (contentType === null || !/^application\/json(?:\s*;|$)/iu.test(contentType)) {
    discard(); return transportFailure("invalid-content-type");
  }
  const length = response.headers.get("content-length");
  if (length !== null && (!/^(?:0|[1-9][0-9]*)$/u.test(length) || BigInt(length) > BigInt(maximum))) {
    discard(); return transportFailure("response-too-large");
  }
  if (!response.body) return transportFailure("invalid-response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await abortable(reader.read(), signal);
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maximum) { try { void reader.cancel().catch(() => undefined); } catch { /* sanitized */ }
        return transportFailure("response-too-large"); }
      chunks.push(new Uint8Array(next.value));
    }
  } finally {
    try { reader.releaseLock(); } catch { /* sanitized */ }
  }
  if (total < 2) return transportFailure("invalid-response");
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    return transportFailure("invalid-response");
  }
}

function serpUrl(query: MarketSourceQuery, apiKey: string, noCache: boolean, propertyToken?: string): string {
  const url = new URL(SERPAPI_ENDPOINT);
  url.searchParams.set("engine", "google_hotels");
  url.searchParams.set("q", query.destination);
  url.searchParams.set("check_in_date", query.checkInDate);
  url.searchParams.set("check_out_date", query.checkOutDate);
  url.searchParams.set("adults", String(query.adults));
  url.searchParams.set("children", String(query.childrenAges.length));
  if (query.childrenAges.length > 0) url.searchParams.set("children_ages", query.childrenAges.join(","));
  url.searchParams.set("currency", query.currency);
  url.searchParams.set("gl", query.pointOfSaleMarket.toLowerCase());
  url.searchParams.set("hl", query.language);
  if (propertyToken !== undefined) url.searchParams.set("property_token", propertyToken);
  if (noCache) url.searchParams.set("no_cache", "true");
  url.searchParams.set("api_key", apiKey);
  return url.toString();
}

export async function readSerpApiGoogleHotels(
  inputQuery: MarketSourceQuery,
  options: SerpApiGoogleHotelsOptions,
): Promise<MarketSourceReadResult> {
  const apiKey = typeof options.apiKey === "string" ? options.apiKey : "";
  if (!apiKey || apiKey.length > 512 || /[\s\u0000-\u001F\u007F]/u.test(apiKey)) {
    return readFailure("missing-credential");
  }
  let query: MarketSourceQuery;
  try { query = snapshotQuery(inputQuery); } catch { return readFailure("invalid-query"); }
  if (query.rooms !== 1) return readFailure("invalid-query");
  let timeoutMs: number;
  let maximum: number;
  let detailLimit: number;
  try {
    timeoutMs = integer("timeoutMs", options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 100, 120_000);
    maximum = integer("maxResponseBytes", options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES, 1_024, 4_194_304);
    detailLimit = integer("propertyDetailLimit", options.propertyDetailLimit ?? 0, 0, 10);
  } catch { return readFailure("invalid-query"); }
  const fetchImplementation: MarketSourceFetch = options.fetch ?? globalThis.fetch;
  if (typeof fetchImplementation !== "function") return readFailure("invalid-query");
  const controller = new AbortController();
  const externalAbort = (): void => controller.abort();
  options.signal?.addEventListener("abort", externalAbort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const doFetch = async (url: string): Promise<unknown> => {
    let response: Response;
    try {
      response = await abortable(fetchImplementation(url, Object.freeze({
        method: "GET", headers: Object.freeze({ accept: "application/json" }), redirect: "error", signal: controller.signal,
      })), controller.signal);
    } catch (error) {
      if (error instanceof TransportFailure) throw error;
      if (controller.signal.aborted) return transportFailure("timeout", true);
      return transportFailure("network", true);
    }
    return readBoundedJson(response, maximum, controller.signal);
  };
  try {
    const search = await doFetch(serpUrl(query, apiKey, options.noCache === true));
    const searchRoot = plainObject(search);
    if (!searchRoot) return readFailure("invalid-response");
    const preliminary = normalizeMarketSourceCapture({
      source: "google-hotels-serpapi", query, collectedAt: new Date((options.now ?? Date.now)()).toISOString(), payload: search,
    });
    if (preliminary.issues.some((item) => item.code === "payload-too-large")) {
      return readFailure("response-too-large");
    }
    if (preliminary.issues.some((item) => item.code === "invalid-payload")) {
      return readFailure("invalid-response");
    }
    if (preliminary.issues.some((item) => item.code === "invalid-response-status" || item.code === "query-mismatch")) {
      return readFailure("invalid-response");
    }
    const details: Array<Readonly<{ propertyToken: string; payload: unknown }>> = [];
    const properties = Array.isArray(searchRoot.properties) ? searchRoot.properties : [];
    for (let index = 0; index < properties.length && index < MAX_CANDIDATES
        && details.length < detailLimit; index += 1) {
      const property = plainObject(properties[index]);
      const token = boundedString(property?.property_token, 1_024);
      if (!token) continue;
      const payload = await doFetch(serpUrl(query, apiKey, options.noCache === true, token));
      details.push(Object.freeze({ propertyToken: token, payload }));
    }
    const collectedAt = new Date((options.now ?? Date.now)()).toISOString();
    const value = normalizeMarketSourceCapture({
      source: "google-hotels-serpapi", query, collectedAt,
      payload: Object.freeze({ search, details: Object.freeze(details) }),
    });
    if (value.issues.some((item) => item.code === "payload-too-large")) {
      return readFailure("response-too-large");
    }
    if (value.issues.some((item) => item.code === "invalid-payload")) {
      return readFailure("invalid-response");
    }
    if (value.issues.some((item) => item.code === "invalid-response-status" || item.code === "query-mismatch")) {
      return readFailure("invalid-response");
    }
    return Object.freeze({ ok: true, value });
  } catch (error) {
    return error instanceof TransportFailure
      ? Object.freeze({ ok: false, error: error.error })
      : readFailure(controller.signal.aborted ? "timeout" : "network", true);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", externalAbort);
  }
}

