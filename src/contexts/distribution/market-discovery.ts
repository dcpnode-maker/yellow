/**
 * Bounded external market-discovery evidence. This module deliberately accepts a
 * normalized contract only: raw Overture/Parquet fields belong to a separately
 * admitted reader. Nothing here is an authenticated property mapping, confirmed
 * competitor set, availability observation, or price recommendation.
 */

export const MARKET_DISCOVERY_LIMITS = Object.freeze({
  maximumRecords: 500,
  maximumResults: 500,
  maximumTextScalars: 500,
  maximumAddressScalars: 1_000,
  maximumWebsites: 16,
  maximumCategories: 64,
  identityProximityDegrees: 0.01,
});

export type MarketDiscoveryOperatingStatus =
  | "unknown"
  | "source-reported-open"
  | "source-reported-closed";

export interface MarketDiscoveryCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface MarketDiscoveryProvenance {
  readonly source: string;
  readonly release: string;
  readonly schema: string;
  readonly recordId: string;
  readonly attribution: string;
}

export interface MarketDiscoveryRecord {
  readonly provenance: MarketDiscoveryProvenance;
  readonly name: string;
  readonly coordinates: MarketDiscoveryCoordinates;
  readonly address: string | null;
  readonly websites: readonly string[];
  readonly categories: readonly string[];
  /** This is only the external source's report, never verification that it operates. */
  readonly operatingStatus: MarketDiscoveryOperatingStatus;
}

export interface MarketDiscoveryRegion {
  readonly minimumLatitude: number;
  readonly maximumLatitude: number;
  readonly minimumLongitude: number;
  readonly maximumLongitude: number;
}

export type MarketIdentityMatchBasis =
  | "source-record-id"
  | "canonical-public-url"
  | "normalized-name"
  | "coordinate-proximity";

export interface MarketIdentitySuggestion {
  readonly record: MarketDiscoveryRecord;
  readonly matchedBy: readonly MarketIdentityMatchBasis[];
  /** A human/client confirmation remains mandatory for every evidence combination. */
  readonly requiresConfirmation: true;
}

export interface MarketIdentitySuggestions {
  readonly requiresConfirmation: true;
  readonly ambiguous: boolean;
  readonly suggestions: readonly MarketIdentitySuggestion[];
}

export type MarketDiscoveryResult<T> = Readonly<
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: Readonly<{ readonly code: "invalid_market_discovery_input"; readonly message: "Market discovery input is invalid." }> }
>;

const CONTROL = /[\u0000-\u001f\u007f]/u;
const OPERATING_STATUSES: readonly MarketDiscoveryOperatingStatus[] = Object.freeze([
  "unknown", "source-reported-open", "source-reported-closed",
]);

type PlainRecord = Record<string, unknown>;

class DiscoveryValidationError extends TypeError {}

function fail(message: string): never {
  throw new DiscoveryValidationError(message);
}

function ownPlain(value: unknown, name: string, maximumKeys: number): PlainRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fail(`${name} must be a plain object`);
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) return fail(`${name} must be a plain object`);
    const keys = Reflect.ownKeys(value);
    if (keys.length > maximumKeys || keys.some((key) => typeof key !== "string")) return fail(`${name} has too many fields`);
    const snapshot: PlainRecord = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set || !descriptor.enumerable) {
        return fail(`${name} must not contain accessors`);
      }
      snapshot[key as string] = descriptor.value;
    }
    return snapshot;
  } catch (error) {
    if (error instanceof DiscoveryValidationError) throw error;
    return fail(`${name} must be a plain object`);
  }
}

function ownArray(value: unknown, name: string, maximumLength: number): readonly unknown[] {
  if (!Array.isArray(value)) return fail(`${name} must be an array`);
  try {
    const length = Object.getOwnPropertyDescriptor(value, "length");
    if (!length || !("value" in length) || !Number.isSafeInteger(length.value)
      || length.value < 0 || length.value > maximumLength || Reflect.ownKeys(value).length !== length.value + 1) {
      return fail(`${name} has at most ${maximumLength} entries`);
    }
    const result: unknown[] = [];
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set || !descriptor.enumerable) {
        return fail(`${name} must not contain accessors`);
      }
      result.push(descriptor.value);
    }
    return result;
  } catch (error) {
    if (error instanceof DiscoveryValidationError) throw error;
    return fail(`${name} must be an array`);
  }
}

function exactKeys(value: PlainRecord, required: readonly string[], optional: readonly string[], name: string): void {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !Object.hasOwn(value, key))) {
    fail(`${name} has unexpected or missing fields`);
  }
}

function wellFormedScalars(value: string, name: string, maximum: number): string {
  if (value.length === 0 || value.trim().length === 0 || value.length > maximum * 2 || CONTROL.test(value)) {
    return fail(`${name} is invalid`);
  }
  let scalars = 0;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return fail(`${name} is not well-formed Unicode`);
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return fail(`${name} is not well-formed Unicode`);
    }
    scalars += 1;
  }
  return scalars <= maximum ? value : fail(`${name} exceeds its scalar bound`);
}

function text(value: unknown, name: string, maximum: number = MARKET_DISCOVERY_LIMITS.maximumTextScalars): string {
  return typeof value === "string" ? wellFormedScalars(value, name, maximum) : fail(`${name} must be text`);
}

function coordinate(value: unknown, name: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    return fail(`${name} must be from ${minimum} to ${maximum}`);
  }
  return value;
}

function coordinates(value: unknown, name: string): MarketDiscoveryCoordinates {
  const row = ownPlain(value, name, 2);
  exactKeys(row, ["latitude", "longitude"], [], name);
  return Object.freeze({
    latitude: coordinate(row.latitude, `${name}.latitude`, -90, 90),
    longitude: coordinate(row.longitude, `${name}.longitude`, -180, 180),
  });
}

/**
 * Keeps an already-sanitized canonical complete public URL. Host-only coincidence is
 * never identity. This normalized-record boundary rejects queries/fragments rather
 * than stripping tracking parameters: a later property-entry boundary must retain
 * original evidence while deriving any tracking-free URL it is authorized to use.
 */
export function canonicalMarketDiscoveryUrl(value: unknown): string {
  const source = text(value, "website");
  let parsed: URL;
  try {
    parsed = new URL(source);
  } catch {
    return fail("website is invalid");
  }
  if (parsed.protocol !== "https:" || parsed.hostname.length === 0 || parsed.username !== "" || parsed.password !== ""
    || parsed.search !== "" || parsed.hash !== "") return fail("website is unsafe");
  return parsed.toString();
}

function orderedTexts(value: unknown, name: string, maximum: number, transform: (input: unknown) => string): readonly string[] {
  const entries = ownArray(value, name, maximum);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    const normalized = transform(entry);
    if (seen.has(normalized)) fail(`duplicate ${name.slice(0, -1)}`);
    seen.add(normalized); result.push(normalized);
  }
  return Object.freeze(result);
}

function operatingStatus(value: unknown): MarketDiscoveryOperatingStatus {
  if (value === undefined) return "unknown";
  return typeof value === "string" && OPERATING_STATUSES.includes(value as MarketDiscoveryOperatingStatus)
    ? value as MarketDiscoveryOperatingStatus : fail("operatingStatus is invalid");
}

function snapshotInputRecord(value: unknown): MarketDiscoveryRecord {
  const row = ownPlain(value, "record", 12);
  exactKeys(row, ["source", "release", "schema", "recordId", "name", "coordinates", "attribution"],
    ["address", "websites", "categories", "operatingStatus"], "record");
  const provenance = Object.freeze({
    source: text(row.source, "source"),
    release: text(row.release, "release"),
    schema: text(row.schema, "schema"),
    recordId: text(row.recordId, "recordId"),
    attribution: text(row.attribution, "attribution"),
  });
  return Object.freeze({
    provenance,
    name: text(row.name, "name"),
    coordinates: coordinates(row.coordinates, "coordinates"),
    address: row.address === undefined ? null : text(row.address, "address", MARKET_DISCOVERY_LIMITS.maximumAddressScalars),
    websites: row.websites === undefined ? Object.freeze([]) : orderedTexts(row.websites, "websites",
      MARKET_DISCOVERY_LIMITS.maximumWebsites, canonicalMarketDiscoveryUrl),
    categories: row.categories === undefined ? Object.freeze([]) : orderedTexts(row.categories, "categories",
      MARKET_DISCOVERY_LIMITS.maximumCategories, (entry) => text(entry, "category")),
    operatingStatus: operatingStatus(row.operatingStatus),
  });
}

function recordKey(record: MarketDiscoveryRecord): string {
  return `${record.provenance.source}\u0000${record.provenance.recordId}`;
}

function sortRecords(records: readonly MarketDiscoveryRecord[]): readonly MarketDiscoveryRecord[] {
  return Object.freeze([...records].sort((left, right) => {
    const leftKey = recordKey(left);
    const rightKey = recordKey(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  }));
}

/** Normalizes bounded external evidence. It performs no I/O and creates no durable identity. */
export function normalizeMarketDiscoveryRecords(value: unknown): readonly MarketDiscoveryRecord[] {
  const entries = ownArray(value, "records", MARKET_DISCOVERY_LIMITS.maximumRecords);
  const seen = new Set<string>();
  const records: MarketDiscoveryRecord[] = [];
  for (const entry of entries) {
    const record = snapshotInputRecord(entry);
    const key = recordKey(record);
    if (seen.has(key)) fail("duplicate source record identity");
    seen.add(key); records.push(record);
  }
  return sortRecords(records);
}

function snapshotNormalizedRecord(value: unknown): MarketDiscoveryRecord {
  const row = ownPlain(value, "normalized record", 7);
  exactKeys(row, ["provenance", "name", "coordinates", "address", "websites", "categories", "operatingStatus"], [], "normalized record");
  const provenance = ownPlain(row.provenance, "normalized provenance", 5);
  exactKeys(provenance, ["source", "release", "schema", "recordId", "attribution"], [], "normalized provenance");
  return snapshotInputRecord({
    source: provenance.source, release: provenance.release, schema: provenance.schema, recordId: provenance.recordId,
    attribution: provenance.attribution, name: row.name, coordinates: row.coordinates,
    ...(row.address === null ? {} : { address: row.address }), websites: row.websites,
    categories: row.categories, operatingStatus: row.operatingStatus,
  });
}

function snapshotNormalizedRecords(value: unknown): readonly MarketDiscoveryRecord[] {
  const entries = ownArray(value, "records", MARKET_DISCOVERY_LIMITS.maximumRecords);
  const seen = new Set<string>();
  const records: MarketDiscoveryRecord[] = [];
  for (const entry of entries) {
    const record = snapshotNormalizedRecord(entry);
    const key = recordKey(record);
    if (seen.has(key)) fail("duplicate source record identity");
    seen.add(key); records.push(record);
  }
  return sortRecords(records);
}

function region(value: unknown): MarketDiscoveryRegion {
  const row = ownPlain(value, "region", 4);
  exactKeys(row, ["minimumLatitude", "maximumLatitude", "minimumLongitude", "maximumLongitude"], [], "region");
  const result = Object.freeze({
    minimumLatitude: coordinate(row.minimumLatitude, "region.minimumLatitude", -90, 90),
    maximumLatitude: coordinate(row.maximumLatitude, "region.maximumLatitude", -90, 90),
    minimumLongitude: coordinate(row.minimumLongitude, "region.minimumLongitude", -180, 180),
    maximumLongitude: coordinate(row.maximumLongitude, "region.maximumLongitude", -180, 180),
  });
  if (result.minimumLatitude > result.maximumLatitude || result.minimumLongitude > result.maximumLongitude) {
    fail("region is inverted");
  }
  return result;
}

/**
 * Returns an inclusive, non-wrapping latitude/longitude rectangle in stable
 * source-record order. Antimeridian searches require two explicit rectangles; this
 * contract never treats an inverted longitude range as a wraparound request.
 */
export function filterMarketDiscoveryRegion(records: unknown, value: unknown): readonly MarketDiscoveryRecord[] {
  const candidates = snapshotNormalizedRecords(records);
  const requested = region(value);
  return Object.freeze(candidates.filter((candidate) => candidate.coordinates.latitude >= requested.minimumLatitude
    && candidate.coordinates.latitude <= requested.maximumLatitude
    && candidate.coordinates.longitude >= requested.minimumLongitude
    && candidate.coordinates.longitude <= requested.maximumLongitude));
}

interface IdentityTarget {
  readonly source: string;
  readonly recordId: string | null;
  readonly publicUrl: string | null;
  readonly name: string | null;
  readonly coordinates: MarketDiscoveryCoordinates | null;
}

function identityTarget(value: unknown): IdentityTarget {
  const row = ownPlain(value, "identity target", 6);
  exactKeys(row, ["source"], ["recordId", "publicUrl", "name", "coordinates", "callerLabel"], "identity target");
  if (row.callerLabel !== undefined) text(row.callerLabel, "callerLabel");
  return Object.freeze({
    source: text(row.source, "source"),
    recordId: row.recordId === undefined ? null : text(row.recordId, "recordId"),
    publicUrl: row.publicUrl === undefined ? null : canonicalMarketDiscoveryUrl(row.publicUrl),
    name: row.name === undefined ? null : text(row.name, "name"),
    coordinates: row.coordinates === undefined ? null : coordinates(row.coordinates, "coordinates"),
  });
}

function normalizedName(value: string): string {
  // ECMAScript toLowerCase is locale-independent; source text itself remains unchanged.
  return value.normalize("NFC").toLowerCase();
}

/** A bounded axis-aligned degree heuristic, not physical distance, ranking, or accuracy evidence. */
function nearby(left: MarketDiscoveryCoordinates, right: MarketDiscoveryCoordinates): boolean {
  return Math.abs(left.latitude - right.latitude) <= MARKET_DISCOVERY_LIMITS.identityProximityDegrees
    && Math.abs(left.longitude - right.longitude) <= MARKET_DISCOVERY_LIMITS.identityProximityDegrees;
}

/**
 * Produces evidence-only suggestions. Exact source IDs and URLs still require an
 * explicit confirmation; optional name/proximity are intentionally unscored.
 */
export function suggestMarketIdentity(records: unknown, value: unknown): MarketIdentitySuggestions {
  const candidates = snapshotNormalizedRecords(records);
  const target = identityTarget(value);
  const suggestions: MarketIdentitySuggestion[] = [];
  for (const candidate of candidates) {
    if (candidate.provenance.source !== target.source) continue;
    const matchedBy: MarketIdentityMatchBasis[] = [];
    if (target.recordId !== null && candidate.provenance.recordId === target.recordId) matchedBy.push("source-record-id");
    if (target.publicUrl !== null && candidate.websites.includes(target.publicUrl)) matchedBy.push("canonical-public-url");
    if (target.name !== null && normalizedName(candidate.name) === normalizedName(target.name)) matchedBy.push("normalized-name");
    if (target.coordinates !== null && nearby(candidate.coordinates, target.coordinates)) matchedBy.push("coordinate-proximity");
    if (matchedBy.length > 0) suggestions.push(Object.freeze({ record: candidate,
      matchedBy: Object.freeze(matchedBy), requiresConfirmation: true as const }));
  }
  const bounded = suggestions.slice(0, MARKET_DISCOVERY_LIMITS.maximumResults);
  return Object.freeze({ requiresConfirmation: true as const, ambiguous: bounded.length > 1,
    suggestions: Object.freeze(bounded) });
}

function marketDiscoveryResult<T>(operation: () => T): MarketDiscoveryResult<T> {
  try {
    return Object.freeze({ ok: true as const, value: operation() });
  } catch {
    return Object.freeze({ ok: false as const, error: Object.freeze({
      code: "invalid_market_discovery_input" as const,
      message: "Market discovery input is invalid." as const,
    }) });
  }
}

/** Public non-throwing boundary for untrusted normalized-record input. */
export function tryNormalizeMarketDiscoveryRecords(value: unknown): MarketDiscoveryResult<readonly MarketDiscoveryRecord[]> {
  return marketDiscoveryResult(() => normalizeMarketDiscoveryRecords(value));
}

/** Public non-throwing boundary for untrusted normalized records and a region rectangle. */
export function tryFilterMarketDiscoveryRegion(records: unknown, value: unknown): MarketDiscoveryResult<readonly MarketDiscoveryRecord[]> {
  return marketDiscoveryResult(() => filterMarketDiscoveryRegion(records, value));
}

/** Public non-throwing boundary for explainable identity suggestions. */
export function trySuggestMarketIdentity(records: unknown, value: unknown): MarketDiscoveryResult<MarketIdentitySuggestions> {
  return marketDiscoveryResult(() => suggestMarketIdentity(records, value));
}
