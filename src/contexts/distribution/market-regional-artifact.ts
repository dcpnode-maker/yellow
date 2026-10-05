/**
 * Pure reader for a bounded publisher-range artifact. It validates bytes supplied by
 * a future loader; it neither reads a file nor treats an embedded hash as integrity.
 */
import {
  MARKET_DISCOVERY_LIMITS,
  type MarketDiscoveryCoordinates,
  type MarketDiscoveryRecord,
  type MarketDiscoveryRegion,
  tryNormalizeMarketDiscoveryRecords,
} from "./market-discovery";

export const MARKET_REGIONAL_ARTIFACT_LIMITS = Object.freeze({
  maximumUtf8Bytes: 4 * 1024 * 1024,
  maximumRows: 501,
  maximumRecords: MARKET_DISCOVERY_LIMITS.maximumRecords,
  requiredSourceObjects: 16,
  maximumRawListEntries: 64,
  maximumRawObjectKeys: 32,
  maximumRawDepth: 8,
  maximumRawTextScalars: 1_000,
  maximumQueryScalars: 16_000,
});

export const OVERTURE_REGIONAL_ARTIFACT_PROVENANCE = Object.freeze({
  source: "overture",
  attribution: "Overture Maps Foundation; source-specific attribution: https://docs.overturemaps.org/attribution/",
  format: "yellow/overture-region/v2",
  release: "2026-08-19.0",
  sourceSchema: "v1.18.0",
  method: "publisher-range-extract",
  coordinateMethod: "source-wkb-point",
} as const);

export interface MarketRegionalRawObject {
  readonly [key: string]: MarketRegionalRawValue;
}

export type MarketRegionalRawValue =
  | null
  | boolean
  | number
  | string
  | readonly MarketRegionalRawValue[]
  | MarketRegionalRawObject;

export interface MarketRegionalRawRow {
  readonly id: string;
  readonly name: string;
  readonly longitude: number;
  readonly latitude: number;
  /** Addresses are retained as source evidence until a separately scoped mapper exists. */
  readonly addresses: readonly MarketRegionalRawValue[] | null;
  /** Unsafe raw website strings are deliberately excluded rather than retained. */
  readonly websites: readonly string[];
  readonly categories: MarketRegionalRawValue | null;
  /** This raw publisher value is not an operating assertion. */
  readonly operatingStatus: string | null;
  readonly confidence: MarketRegionalRawValue | null;
  readonly sources: readonly MarketRegionalRawValue[] | null;
  readonly sourceObject: string;
}

interface SourceRow extends Omit<MarketRegionalRawRow, "websites"> {
  readonly websites: readonly MarketRegionalRawValue[];
}

export type MarketRegionalField = "address" | "website" | "category";
export type MarketRegionalFieldExclusionReason = "raw-evidence-only" | "unsafe-or-invalid-optional-value";

export interface MarketRegionalFieldExclusion {
  readonly rowIndex: number;
  readonly field: MarketRegionalField;
  readonly reason: MarketRegionalFieldExclusionReason;
}

export type MarketRegionalRowRejectionCode = "invalid_core_row" | "duplicate_source_record_id";

export interface MarketRegionalRowRejection {
  readonly rowIndex: number;
  readonly code: MarketRegionalRowRejectionCode;
}

export interface MarketRegionalSourceMetadata {
  readonly format: typeof OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.format;
  readonly release: typeof OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.release;
  readonly sourceSchema: typeof OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.sourceSchema;
  readonly method: typeof OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.method;
  /** Coordinates are decoded source WKB points, not bbox minima or physical verification. */
  readonly coordinateMethod: typeof OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.coordinateMethod;
  readonly capturedAt: string;
  readonly region: MarketDiscoveryRegion;
  readonly limit: 500;
  readonly moreAvailable: boolean;
  readonly query: string;
  readonly sourceObjects: readonly string[];
  readonly tool: Readonly<{
    readonly duckdbVersion: "1.5.5";
    readonly wheelSha256: string;
    readonly httpfsSha256: string;
  }>;
}

export interface MarketRegionalArtifactCompleteness {
  /** This reports only the bounded publisher all-places extract, never hotel coverage. */
  readonly scope: "publisher-range-extract-all-places";
  readonly status: "complete" | "incomplete";
  readonly sourceRows: number;
  readonly returnedRecords: number;
  readonly rejectedRows: number;
}

export interface MarketRegionalArtifact {
  readonly source: MarketRegionalSourceMetadata;
  readonly rawRows: readonly MarketRegionalRawRow[];
  readonly records: readonly MarketDiscoveryRecord[];
  readonly rejectedRows: readonly MarketRegionalRowRejection[];
  readonly fieldExclusions: readonly MarketRegionalFieldExclusion[];
  readonly completeness: MarketRegionalArtifactCompleteness;
}

export type MarketRegionalArtifactResult<T> = Readonly<
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: Readonly<{
    readonly code: "invalid_market_regional_artifact";
    readonly message: "Market regional artifact is invalid.";
  }> }
>;

const CONTROL = /[\u0000-\u001f\u007f]/u;
const NON_FORMATTING_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const UTC_ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/u;
const SOURCE_OBJECT = /^https:\/\/overturemaps-us-west-2\.s3\.us-west-2\.amazonaws\.com\/release\/2026-08-19\.0\/theme=places\/type=place\/part-(000(?:0[0-9]|1[0-5]))-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-c000\.zstd\.parquet$/u;

type PlainRecord = Record<string, unknown>;

class ArtifactValidationError extends TypeError {}

function fail(message: string): never {
  throw new ArtifactValidationError(message);
}

function wellFormed(value: string, field: string, maximum: number, nonblank: boolean, allowFormattingControls: boolean = false): string {
  const forbiddenControl = allowFormattingControls ? NON_FORMATTING_CONTROL : CONTROL;
  if ((nonblank && (value.length === 0 || value.trim().length === 0)) || value.length > maximum * 2 || forbiddenControl.test(value)) {
    return fail(`${field} is invalid`);
  }
  let scalars = 0;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return fail(`${field} is not well-formed Unicode`);
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return fail(`${field} is not well-formed Unicode`);
    }
    scalars += 1;
  }
  return scalars <= maximum ? value : fail(`${field} exceeds its scalar bound`);
}

function text(value: unknown, field: string, maximum: number = MARKET_REGIONAL_ARTIFACT_LIMITS.maximumRawTextScalars, nonblank: boolean = true, allowFormattingControls: boolean = false): string {
  return typeof value === "string" ? wellFormed(value, field, maximum, nonblank, allowFormattingControls) : fail(`${field} must be text`);
}

function ownPlain(value: unknown, field: string, maximumKeys: number): PlainRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fail(`${field} must be a plain object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fail(`${field} must be a plain object`);
  const keys = Reflect.ownKeys(value);
  if (keys.length > maximumKeys || keys.some((key) => typeof key !== "string")) return fail(`${field} has too many fields`);
  const snapshot: PlainRecord = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set || !descriptor.enumerable) {
      return fail(`${field} must not contain accessors`);
    }
    snapshot[key as string] = descriptor.value;
  }
  return snapshot;
}

function ownArray(value: unknown, field: string, maximumLength: number): readonly unknown[] {
  if (!Array.isArray(value)) return fail(`${field} must be an array`);
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (!length || !("value" in length) || !Number.isSafeInteger(length.value)
    || length.value < 0 || length.value > maximumLength || Reflect.ownKeys(value).length !== length.value + 1) {
    return fail(`${field} has at most ${maximumLength} entries`);
  }
  const snapshot: unknown[] = [];
  for (let index = 0; index < length.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set || !descriptor.enumerable) {
      return fail(`${field} must not contain accessors`);
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function exactKeys(value: PlainRecord, required: readonly string[], field: string): void {
  const allowed = new Set(required);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !Object.hasOwn(value, key))) {
    fail(`${field} has unexpected or missing fields`);
  }
}

function coordinate(value: unknown, field: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    return fail(`${field} is out of range`);
  }
  return value;
}

function snapshotRegion(value: unknown): MarketDiscoveryRegion {
  const row = ownPlain(value, "region", 4);
  exactKeys(row, ["minimumLatitude", "maximumLatitude", "minimumLongitude", "maximumLongitude"], "region");
  const region = Object.freeze({
    minimumLatitude: coordinate(row.minimumLatitude, "region.minimumLatitude", -90, 90),
    maximumLatitude: coordinate(row.maximumLatitude, "region.maximumLatitude", -90, 90),
    minimumLongitude: coordinate(row.minimumLongitude, "region.minimumLongitude", -180, 180),
    maximumLongitude: coordinate(row.maximumLongitude, "region.maximumLongitude", -180, 180),
  });
  if (region.minimumLatitude > region.maximumLatitude || region.minimumLongitude > region.maximumLongitude) return fail("region is inverted");
  if (region.maximumLatitude - region.minimumLatitude > 1 || region.maximumLongitude - region.minimumLongitude > 1) {
    return fail("region exceeds the one-degree publisher range bound");
  }
  return region;
}

function utcIso(value: unknown): string {
  const result = text(value, "capturedAt", 32);
  const match = UTC_ISO.exec(result);
  if (!match) return fail("capturedAt must be UTC ISO");
  const parsed = Date.parse(result);
  if (!Number.isFinite(parsed)) return fail("capturedAt must be UTC ISO");
  const stamp = new Date(parsed);
  if (stamp.getUTCFullYear() !== Number(match[1]) || stamp.getUTCMonth() + 1 !== Number(match[2])
    || stamp.getUTCDate() !== Number(match[3]) || stamp.getUTCHours() !== Number(match[4])
    || stamp.getUTCMinutes() !== Number(match[5]) || stamp.getUTCSeconds() !== Number(match[6])) return fail("capturedAt must be UTC ISO");
  return result;
}

function sourceObjects(value: unknown): readonly string[] {
  const objects = ownArray(value, "sourceObjects", MARKET_REGIONAL_ARTIFACT_LIMITS.requiredSourceObjects);
  if (objects.length !== MARKET_REGIONAL_ARTIFACT_LIMITS.requiredSourceObjects) return fail("sourceObjects must contain all approved objects");
  const seenUrls = new Set<string>();
  const seenParts = new Set<number>();
  const result: string[] = [];
  for (const candidate of objects) {
    const url = text(candidate, "sourceObject");
    const match = SOURCE_OBJECT.exec(url);
    if (!match || seenUrls.has(url)) return fail("sourceObjects must be approved release objects");
    const part = Number(match[1]);
    if (seenParts.has(part)) return fail("sourceObjects must have unique parts");
    seenUrls.add(url); seenParts.add(part); result.push(url);
  }
  for (let part = 0; part < MARKET_REGIONAL_ARTIFACT_LIMITS.requiredSourceObjects; part += 1) {
    if (!seenParts.has(part)) return fail("sourceObjects must cover parts 00000 through 00015");
  }
  return Object.freeze(result);
}

function rawValue(value: unknown, field: string, depth: number = 0): MarketRegionalRawValue {
  if (depth > MARKET_REGIONAL_ARTIFACT_LIMITS.maximumRawDepth) return fail(`${field} is too deeply nested`);
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : fail(`${field} is invalid`);
  if (typeof value === "string") return text(value, field, MARKET_REGIONAL_ARTIFACT_LIMITS.maximumRawTextScalars, false, true);
  if (Array.isArray(value)) return Object.freeze(ownArray(value, field, MARKET_REGIONAL_ARTIFACT_LIMITS.maximumRawListEntries)
    .map((entry) => rawValue(entry, field, depth + 1)));
  const row = ownPlain(value, field, MARKET_REGIONAL_ARTIFACT_LIMITS.maximumRawObjectKeys);
  const snapshot: Record<string, MarketRegionalRawValue> = Object.create(null);
  for (const key of Object.keys(row)) {
    wellFormed(key, `${field} key`, MARKET_REGIONAL_ARTIFACT_LIMITS.maximumRawTextScalars, false);
    Object.defineProperty(snapshot, key, { value: rawValue(row[key], field, depth + 1), enumerable: true });
  }
  return Object.freeze(snapshot);
}

function rawList(value: unknown, field: string): readonly MarketRegionalRawValue[] | null {
  if (value === null) return null;
  return Object.freeze(ownArray(value, field, MARKET_REGIONAL_ARTIFACT_LIMITS.maximumRawListEntries)
    .map((entry) => rawValue(entry, field)));
}

function canonicalOptionalWebsite(candidate: unknown, core: Record<string, unknown>): string | null {
  const result = tryNormalizeMarketDiscoveryRecords([{ ...core, websites: [candidate] }]);
  if (!result.ok) return null;
  return result.value[0]?.websites[0] ?? null;
}

function normalizedCategories(value: MarketRegionalRawValue | null, core: Record<string, unknown>): readonly string[] | null {
  if (value === null) return Object.freeze([]);
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const row = ownPlain(value, "categories", 2);
  exactKeys(row, ["primary", "alternate"], "categories");
  const entries: unknown[] = [];
  if (row.primary !== null) entries.push(row.primary);
  if (row.alternate !== null) entries.push(...ownArray(row.alternate, "categories.alternate", MARKET_DISCOVERY_LIMITS.maximumCategories));
  const result = tryNormalizeMarketDiscoveryRecords([{ ...core, categories: entries }]);
  return result.ok ? result.value[0]?.categories ?? Object.freeze([]) : null;
}

function sourceRow(value: unknown, sourceObjectSet: ReadonlySet<string>): SourceRow {
  const row = ownPlain(value, "row", 11);
  exactKeys(row, ["id", "name", "longitude", "latitude", "addresses", "websites", "categories", "operatingStatus", "confidence", "sources", "sourceObject"], "row");
  const sourceObject = text(row.sourceObject, "row.sourceObject");
  if (!sourceObjectSet.has(sourceObject)) return fail("row.sourceObject is not approved");
  if (row.operatingStatus !== null && typeof row.operatingStatus !== "string") return fail("row.operatingStatus is invalid");
  return Object.freeze({
    id: text(row.id, "row.id"),
    name: text(row.name, "row.name"),
    longitude: coordinate(row.longitude, "row.longitude", -180, 180),
    latitude: coordinate(row.latitude, "row.latitude", -90, 90),
    addresses: rawList(row.addresses, "row.addresses"),
    websites: row.websites === null ? Object.freeze([]) : Object.freeze(ownArray(row.websites, "row.websites", MARKET_DISCOVERY_LIMITS.maximumWebsites)
      .map((entry) => rawValue(entry, "row.websites"))),
    categories: row.categories === null ? null : rawValue(row.categories, "row.categories"),
    operatingStatus: row.operatingStatus === null ? null : text(row.operatingStatus, "row.operatingStatus", MARKET_REGIONAL_ARTIFACT_LIMITS.maximumRawTextScalars, false),
    confidence: row.confidence === null ? null : rawValue(row.confidence, "row.confidence"),
    sources: rawList(row.sources, "row.sources"),
    sourceObject,
  });
}

function sourceMetadata(value: unknown): Readonly<{ metadata: MarketRegionalSourceMetadata; rows: readonly unknown[] }> {
  const row = ownPlain(value, "artifact", 13);
  exactKeys(row, ["format", "release", "sourceSchema", "method", "coordinateMethod", "capturedAt", "region", "limit", "moreAvailable", "rows", "query", "sourceObjects", "tool"], "artifact");
  if (row.format !== OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.format || row.release !== OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.release
    || row.sourceSchema !== OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.sourceSchema || row.method !== OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.method
    || row.coordinateMethod !== OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.coordinateMethod
    || row.limit !== MARKET_REGIONAL_ARTIFACT_LIMITS.maximumRecords || typeof row.moreAvailable !== "boolean") return fail("artifact envelope is invalid");
  const objects = sourceObjects(row.sourceObjects);
  const rows = ownArray(row.rows, "rows", MARKET_REGIONAL_ARTIFACT_LIMITS.maximumRows);
  if (row.moreAvailable !== (rows.length > MARKET_REGIONAL_ARTIFACT_LIMITS.maximumRecords)) return fail("moreAvailable does not match bounded rows");
  const tool = ownPlain(row.tool, "tool", 3);
  exactKeys(tool, ["duckdbVersion", "wheelSha256", "httpfsSha256"], "tool");
  if (tool.duckdbVersion !== "1.5.5" || typeof tool.wheelSha256 !== "string" || !SHA256.test(tool.wheelSha256)
    || typeof tool.httpfsSha256 !== "string" || !SHA256.test(tool.httpfsSha256)) return fail("tool is invalid");
  return Object.freeze({ metadata: Object.freeze({
    format: OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.format,
    release: OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.release,
    sourceSchema: OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.sourceSchema,
    method: OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.method,
    coordinateMethod: OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.coordinateMethod,
    capturedAt: utcIso(row.capturedAt),
    region: snapshotRegion(row.region),
    limit: 500 as const,
    moreAvailable: row.moreAvailable,
    query: text(row.query, "query", MARKET_REGIONAL_ARTIFACT_LIMITS.maximumQueryScalars, true, true),
    sourceObjects: objects,
    tool: Object.freeze({ duckdbVersion: "1.5.5" as const, wheelSha256: tool.wheelSha256, httpfsSha256: tool.httpfsSha256 }),
  }), rows });
}

function withinRegion(row: SourceRow, region: MarketDiscoveryRegion): boolean {
  return row.latitude >= region.minimumLatitude && row.latitude <= region.maximumLatitude
    && row.longitude >= region.minimumLongitude && row.longitude <= region.maximumLongitude;
}

function adapt(value: string): MarketRegionalArtifact {
  wellFormed(value, "artifact JSON", MARKET_REGIONAL_ARTIFACT_LIMITS.maximumUtf8Bytes, false, true);
  if (new TextEncoder().encode(value).byteLength > MARKET_REGIONAL_ARTIFACT_LIMITS.maximumUtf8Bytes) return fail("artifact JSON exceeds its byte bound");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return fail("artifact JSON is invalid");
  }
  const artifact = sourceMetadata(parsed);
  const sourceObjectSet = new Set(artifact.metadata.sourceObjects);
  const sourceRows: readonly (SourceRow | null)[] = artifact.rows.map((candidate, index) => {
    try {
      return sourceRow(candidate, sourceObjectSet);
    } catch {
      return null;
    }
  });
  const sourceIdCounts = new Map<string, number>();
  for (const row of sourceRows) if (row !== null) sourceIdCounts.set(row.id, (sourceIdCounts.get(row.id) ?? 0) + 1);
  const rawRows: MarketRegionalRawRow[] = [];
  const records: MarketDiscoveryRecord[] = [];
  const rejectedRows: MarketRegionalRowRejection[] = [];
  const fieldExclusions: MarketRegionalFieldExclusion[] = [];
  for (let index = 0; index < sourceRows.length; index += 1) {
    const raw = sourceRows[index];
    if (raw === undefined || raw === null) {
      rejectedRows.push(Object.freeze({ rowIndex: index, code: "invalid_core_row" }));
      continue;
    }
    if ((sourceIdCounts.get(raw.id) ?? 0) > 1) {
      rejectedRows.push(Object.freeze({ rowIndex: index, code: "duplicate_source_record_id" }));
      continue;
    }
    if (index >= MARKET_REGIONAL_ARTIFACT_LIMITS.maximumRecords) continue;
    if (!withinRegion(raw, artifact.metadata.region)) {
      rejectedRows.push(Object.freeze({ rowIndex: index, code: "invalid_core_row" }));
      continue;
    }
    const core = {
      source: OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.source,
      release: artifact.metadata.release,
      schema: artifact.metadata.sourceSchema,
      recordId: raw.id,
      name: raw.name,
      coordinates: { latitude: raw.latitude, longitude: raw.longitude },
      attribution: OVERTURE_REGIONAL_ARTIFACT_PROVENANCE.attribution,
      operatingStatus: "unknown",
    };
    const coreResult = tryNormalizeMarketDiscoveryRecords([core]);
    if (!coreResult.ok || !coreResult.value[0]) {
      rejectedRows.push(Object.freeze({ rowIndex: index, code: "invalid_core_row" }));
      continue;
    }
    const websites: string[] = [];
    for (const website of raw.websites) {
      const normalized = canonicalOptionalWebsite(website, core);
      if (normalized === null || websites.includes(normalized)) {
        fieldExclusions.push(Object.freeze({ rowIndex: index, field: "website", reason: "unsafe-or-invalid-optional-value" }));
      } else websites.push(normalized);
    }
    let categories: readonly string[] | null;
    try {
      categories = normalizedCategories(raw.categories, core);
    } catch {
      categories = null;
    }
    if (categories === null) fieldExclusions.push(Object.freeze({ rowIndex: index, field: "category", reason: "unsafe-or-invalid-optional-value" }));
    if (raw.addresses !== null) fieldExclusions.push(Object.freeze({ rowIndex: index, field: "address", reason: "raw-evidence-only" }));
    const normalized = tryNormalizeMarketDiscoveryRecords([{ ...core, websites, categories: categories ?? [] }]);
    if (!normalized.ok || !normalized.value[0]) {
      rejectedRows.push(Object.freeze({ rowIndex: index, code: "invalid_core_row" }));
      continue;
    }
    // Retain only website evidence that passed the existing discovery URL boundary.
    // Rejected optional values are represented by a non-sensitive exclusion record.
    rawRows.push(Object.freeze({
      id: raw.id,
      name: raw.name,
      longitude: raw.longitude,
      latitude: raw.latitude,
      addresses: raw.addresses,
      websites: Object.freeze(websites),
      categories: raw.categories,
      operatingStatus: raw.operatingStatus,
      confidence: raw.confidence,
      sources: raw.sources,
      sourceObject: raw.sourceObject,
    }));
    records.push(normalized.value[0]);
  }
  const incomplete = artifact.metadata.moreAvailable || rejectedRows.length > 0;
  return Object.freeze({
    source: artifact.metadata,
    rawRows: Object.freeze(rawRows),
    records: Object.freeze(records),
    rejectedRows: Object.freeze(rejectedRows),
    fieldExclusions: Object.freeze(fieldExclusions),
    completeness: Object.freeze({ scope: "publisher-range-extract-all-places" as const,
      status: incomplete ? "incomplete" as const : "complete" as const,
      sourceRows: artifact.rows.length, returnedRecords: records.length, rejectedRows: rejectedRows.length }),
  });
}

/** Public, non-throwing boundary for UTF-8 JSON bytes already supplied by a future loader. */
export function tryAdaptMarketRegionalArtifact(value: unknown): MarketRegionalArtifactResult<MarketRegionalArtifact> {
  try {
    if (typeof value !== "string") return Object.freeze({ ok: false as const, error: Object.freeze({
      code: "invalid_market_regional_artifact" as const, message: "Market regional artifact is invalid." as const,
    }) });
    return Object.freeze({ ok: true as const, value: adapt(value) });
  } catch {
    return Object.freeze({ ok: false as const, error: Object.freeze({
      code: "invalid_market_regional_artifact" as const, message: "Market regional artifact is invalid." as const,
    }) });
  }
}
