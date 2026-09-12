import { Database, type SQLQueryBindings } from "bun:sqlite";
import { createHash } from "node:crypto";

export const PLACE_CATALOG_RELEASE = "2026-08-19.0" as const;
export const PLACE_CATALOG_OVERTURE_SCHEMA_VERSION = "1.18.0" as const;
export const PLACE_CATALOG_FORMAT = "yellow.place-catalog/v1" as const;

export const PLACE_CATALOG_LIMITS = Object.freeze({
  maximumResults: 200,
  maximumIds: 200,
  maximumCursorOffset: 10_000,
  maximumBboxSpanDegrees: 5,
  minimumKeywordCharacters: 2,
  maximumKeywordCharacters: 200,
  maximumUrlCharacters: 4_096,
  maximumIdCharacters: 128,
});

export type PlaceOperatingStatus = "open" | "temporarily_closed" | "permanently_closed" | "unknown";
export type PlaceJsonValue = null | boolean | number | string | readonly PlaceJsonValue[] | {
  readonly [key: string]: PlaceJsonValue;
};

export interface PlaceAddress {
  readonly freeform: string | null;
  readonly locality: string | null;
  readonly region: string | null;
  readonly postcode: string | null;
  readonly country: string | null;
}

export interface PlaceBrand {
  readonly id: string | null;
  readonly name: string | null;
}

export type PlaceSource = Readonly<Record<string, PlaceJsonValue>>;

export interface PlaceRecord {
  readonly id: string;
  readonly name: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly category: string;
  readonly status: PlaceOperatingStatus;
  readonly address: PlaceAddress | null;
  readonly country: string | null;
  readonly websites: readonly string[];
  readonly brand: PlaceBrand | null;
  readonly confidence: number | null;
  readonly sources: readonly PlaceSource[];
}

interface SearchPage {
  readonly limit?: number;
  readonly cursor?: string;
}

export type PlaceCatalogSearchInput = SearchPage & (
  | { readonly mode: "bbox"; readonly west: number; readonly south: number; readonly east: number; readonly north: number }
  | { readonly mode: "keyword"; readonly q: string }
  | { readonly mode: "url"; readonly url: string }
  | { readonly mode: "domain"; readonly domain: string }
  | { readonly mode: "id"; readonly id: string }
);

export interface PlaceCatalogSearchResult {
  readonly places: readonly PlaceRecord[];
  readonly truncated: boolean;
  readonly ambiguous: boolean;
  readonly nextCursor?: string;
  readonly release: typeof PLACE_CATALOG_RELEASE;
  readonly schemaVersion: typeof PLACE_CATALOG_OVERTURE_SCHEMA_VERSION;
}

export type PlaceCatalogErrorKind = "invalid_input" | "catalog_unavailable" | "catalog_corrupt";

export class PlaceCatalogError extends Error {
  constructor(
    readonly kind: PlaceCatalogErrorKind,
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PlaceCatalogError";
  }
}

export class PlaceCatalogInputError extends PlaceCatalogError {
  constructor(message: string, code = "invalid_input") {
    super("invalid_input", code, message);
    this.name = "PlaceCatalogInputError";
  }
}

interface PlaceRow {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  category: string;
  status: string;
  address_json: string | null;
  country: string | null;
  websites_json: string;
  brand_json: string | null;
  confidence: number | null;
  sources_json: string;
}

interface CursorPayload {
  v: 1;
  offset: number;
  query: string;
}

const PLACE_COLUMNS = `p.id,p.name,p.longitude,p.latitude,p.category,p.status,
  p.address_json,p.country,p.websites_json,p.brand_json,p.confidence,p.sources_json`;
const PLACE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const COUNTRY_CODE = /^[A-Z]{2}$/;
const LODGING_CATEGORIES = new Set([
  "hotel", "lodging", "private_lodging", "bed_and_breakfast", "resort", "motel", "hostel",
  "guest_house", "aparthotel", "apartment_hotel", "serviced_apartment", "vacation_rental",
  "holiday_apartment", "inn", "ryokan", "chalet", "campground", "camp_site", "camping",
  "glamping", "lodge", "cabin", "farmstay", "holiday_park", "capsule_hotel",
  "extended_stay_hotel", "boutique_hotel", "mountain_hut",
]);
const EXPECTED_PLACE_COLUMNS = [
  "rowid", "id", "name", "name_search", "longitude", "latitude", "category", "status",
  "address_json", "country", "websites_json", "brand_json", "confidence", "sources_json", "winner_key",
] as const;

function invalid(code: string, message: string): never {
  throw new PlaceCatalogInputError(message, code);
}

function normalizedText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("und").trim().replace(/\s+/gu, " ");
}

function assertFiniteCoordinate(value: number, minimum: number, maximum: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    invalid("invalid_bbox", `${field} must be a finite number between ${minimum} and ${maximum}`);
  }
}

function normalizeUrl(value: string): { url: string; domain: string } {
  if (typeof value !== "string" || value.length === 0 || value.length > PLACE_CATALOG_LIMITS.maximumUrlCharacters || /[\u0000-\u001f\u007f]/u.test(value)) {
    invalid("invalid_url", "url must be a bounded HTTP or HTTPS URL");
  }
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname || url.username || url.password) {
      invalid("invalid_url", "url must be a public HTTP or HTTPS URL without credentials");
    }
    url.hash = "";
    if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) url.port = "";
    const domain = url.hostname.toLocaleLowerCase("en-US").replace(/\.$/u, "");
    return { url: url.toString(), domain };
  } catch (error) {
    if (error instanceof PlaceCatalogError) throw error;
    throw new PlaceCatalogError("invalid_input", "invalid_url", "url must be a valid HTTP or HTTPS URL", { cause: error });
  }
}

function normalizeDomain(value: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 253 || /[\s/@?#]/u.test(value)) {
    invalid("invalid_domain", "domain must be a bounded hostname without a path or port");
  }
  try {
    const parsed = new URL(`http://${value}`);
    if (parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash) invalid("invalid_domain", "domain must not contain a path or port");
    const domain = parsed.hostname.toLocaleLowerCase("en-US").replace(/\.$/u, "");
    if (!domain || domain.length > 253) invalid("invalid_domain", "domain is invalid");
    return domain;
  } catch (error) {
    if (error instanceof PlaceCatalogError) throw error;
    throw new PlaceCatalogError("invalid_input", "invalid_domain", "domain is invalid", { cause: error });
  }
}

function queryIdentity(input: PlaceCatalogSearchInput, normalized: Record<string, string | number>): string {
  return createHash("sha256").update(JSON.stringify({ mode: input.mode, ...normalized })).digest("base64url");
}

function encodeCursor(offset: number, query: string): string {
  const payload: CursorPayload = { v: 1, offset, query };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(value: string | undefined, query: string): number {
  if (value === undefined) return 0;
  if (typeof value !== "string" || value.length === 0 || value.length > 512) invalid("invalid_cursor", "cursor is invalid");
  try {
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<CursorPayload>;
    if (payload.v !== 1 || payload.query !== query || !Number.isSafeInteger(payload.offset) || (payload.offset ?? -1) < 0 || (payload.offset ?? 0) > PLACE_CATALOG_LIMITS.maximumCursorOffset) {
      invalid("invalid_cursor", "cursor does not belong to this bounded query");
    }
    return payload.offset as number;
  } catch (error) {
    if (error instanceof PlaceCatalogError) throw error;
    throw new PlaceCatalogError("invalid_input", "invalid_cursor", "cursor is invalid", { cause: error });
  }
}

function parseJson(value: string, field: string): PlaceJsonValue {
  try {
    return JSON.parse(value) as PlaceJsonValue;
  } catch (error) {
    throw new PlaceCatalogError("catalog_corrupt", "invalid_catalog_json", `catalog ${field} is malformed`, { cause: error });
  }
}

function isJsonObject(value: PlaceJsonValue): value is Readonly<Record<string, PlaceJsonValue>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreezeJson(value: PlaceJsonValue): PlaceJsonValue {
  if (Array.isArray(value)) {
    for (const child of value) deepFreezeJson(child);
    return Object.freeze(value);
  }
  if (isJsonObject(value)) {
    for (const child of Object.values(value)) deepFreezeJson(child);
    return Object.freeze(value);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null || typeof value === "string") return value;
  throw new PlaceCatalogError("catalog_corrupt", "invalid_catalog_record", `catalog ${field} is invalid`);
}

function assertBoundedRecordString(value: string | null, field: string): void {
  if (value !== null && value.length > 1_000) {
    throw new PlaceCatalogError("catalog_corrupt", "invalid_catalog_record", `catalog ${field} exceeds its bound`);
  }
}

function decodeRow(row: PlaceRow): PlaceRecord {
  if (typeof row.id !== "string" || typeof row.name !== "string" || !PLACE_ID.test(row.id) || !row.name || row.name.length > 1_000
    || !Number.isFinite(row.longitude) || !Number.isFinite(row.latitude) || row.longitude < -180 || row.longitude > 180 || row.latitude < -90 || row.latitude > 90) {
    throw new PlaceCatalogError("catalog_corrupt", "invalid_catalog_record", "catalog contains an invalid place identity or coordinate");
  }
  if (!(["open", "temporarily_closed", "permanently_closed", "unknown"] as const).includes(row.status as PlaceOperatingStatus)) {
    throw new PlaceCatalogError("catalog_corrupt", "invalid_catalog_record", "catalog contains an invalid operating status");
  }
  if (typeof row.category !== "string" || !LODGING_CATEGORIES.has(row.category)
    || row.country !== null && (typeof row.country !== "string" || !COUNTRY_CODE.test(row.country))
    || row.confidence !== null && (!Number.isFinite(row.confidence) || row.confidence < 0 || row.confidence > 1)) {
    throw new PlaceCatalogError("catalog_corrupt", "invalid_catalog_record", "catalog contains an invalid category, country, or confidence");
  }
  const websites = parseJson(row.websites_json, "websites");
  const sources = parseJson(row.sources_json, "sources");
  const address = row.address_json === null ? null : parseJson(row.address_json, "address");
  const brand = row.brand_json === null ? null : parseJson(row.brand_json, "brand");
  if (!Array.isArray(websites) || !websites.every((website) => typeof website === "string") || !Array.isArray(sources) || !sources.every((source) => source !== null && typeof source === "object" && !Array.isArray(source))) {
    throw new PlaceCatalogError("catalog_corrupt", "invalid_catalog_record", "catalog websites or sources are invalid");
  }
  for (const website of websites) {
    try {
      if (normalizeUrl(website).url !== website) throw new Error("non-canonical catalog URL");
    } catch (error) {
      throw new PlaceCatalogError("catalog_corrupt", "invalid_catalog_url", "catalog contains an unsafe or non-canonical website URL", { cause: error });
    }
  }
  if (address !== null && (typeof address !== "object" || Array.isArray(address))) {
    throw new PlaceCatalogError("catalog_corrupt", "invalid_catalog_record", "catalog address is invalid");
  }
  if (brand !== null && (typeof brand !== "object" || Array.isArray(brand))) {
    throw new PlaceCatalogError("catalog_corrupt", "invalid_catalog_record", "catalog brand is invalid");
  }
  const rawAddress = address as Record<string, unknown> | null;
  const rawBrand = brand as Record<string, unknown> | null;
  const decodedAddress: PlaceAddress | null = rawAddress === null ? null : {
    freeform: nullableString(rawAddress.freeform ?? null, "address.freeform"),
    locality: nullableString(rawAddress.locality ?? null, "address.locality"),
    region: nullableString(rawAddress.region ?? null, "address.region"),
    postcode: nullableString(rawAddress.postcode ?? null, "address.postcode"),
    country: nullableString(rawAddress.country ?? null, "address.country"),
  };
  const decodedBrand: PlaceBrand | null = rawBrand === null ? null : {
    id: nullableString(rawBrand.id ?? null, "brand.id"),
    name: nullableString(rawBrand.name ?? null, "brand.name"),
  };
  if (decodedAddress !== null) {
    for (const [key, value] of Object.entries(decodedAddress)) assertBoundedRecordString(value, `address.${key}`);
    if (decodedAddress.country !== null && (!COUNTRY_CODE.test(decodedAddress.country) || decodedAddress.country !== row.country)) {
      throw new PlaceCatalogError("catalog_corrupt", "invalid_catalog_record", "catalog address country is inconsistent");
    }
  }
  return Object.freeze({
    id: row.id,
    name: row.name,
    longitude: row.longitude,
    latitude: row.latitude,
    category: row.category,
    status: row.status as PlaceOperatingStatus,
    address: decodedAddress === null ? null : Object.freeze(decodedAddress),
    country: row.country,
    websites: Object.freeze([...websites] as string[]),
    brand: decodedBrand === null ? null : Object.freeze(decodedBrand),
    confidence: row.confidence,
    sources: Object.freeze(sources.map((source) => deepFreezeJson(source) as PlaceSource)),
  });
}

export class PlaceCatalog {
  readonly release: typeof PLACE_CATALOG_RELEASE;
  readonly schemaVersion: typeof PLACE_CATALOG_OVERTURE_SCHEMA_VERSION;
  readonly #database: Database;
  #closed = false;

  constructor(options: { readonly path: string }) {
    if (!options || typeof options.path !== "string" || options.path.length === 0) {
      invalid("invalid_catalog_path", "a server-configured catalog path is required");
    }
    try {
      this.#database = new Database(options.path, { readonly: true, strict: true });
      this.#database.exec("PRAGMA query_only = ON");
    } catch (error) {
      throw new PlaceCatalogError("catalog_unavailable", "catalog_open_failed", "place catalog is unavailable", { cause: error });
    }
    try {
      this.#validateSchema();
      this.release = PLACE_CATALOG_RELEASE;
      this.schemaVersion = PLACE_CATALOG_OVERTURE_SCHEMA_VERSION;
    } catch (error) {
      this.#database.close(false);
      if (error instanceof PlaceCatalogError) throw error;
      throw new PlaceCatalogError("catalog_corrupt", "catalog_validation_failed", "place catalog validation failed", { cause: error });
    }
  }

  close(): void {
    if (!this.#closed) {
      this.#database.close(false);
      this.#closed = true;
    }
  }

  search(input: PlaceCatalogSearchInput): PlaceCatalogSearchResult {
    this.#assertOpen();
    if (!input || typeof input !== "object") invalid("invalid_search", "search input is required");
    const limit = input.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > PLACE_CATALOG_LIMITS.maximumResults) {
      invalid("invalid_limit", `limit must be an integer between 1 and ${PLACE_CATALOG_LIMITS.maximumResults}`);
    }

    let from = "places p";
    let where: string;
    let parameters: SQLQueryBindings[];
    let normalized: Record<string, string | number>;
    switch (input.mode) {
      case "bbox": {
        assertFiniteCoordinate(input.west, -180, 180, "west");
        assertFiniteCoordinate(input.east, -180, 180, "east");
        assertFiniteCoordinate(input.south, -90, 90, "south");
        assertFiniteCoordinate(input.north, -90, 90, "north");
        if (input.south >= input.north) invalid("invalid_bbox", "south must be less than north");
        const longitudeSpan = input.west <= input.east ? input.east - input.west : 180 - input.west + input.east + 180;
        if (longitudeSpan <= 0 || longitudeSpan > PLACE_CATALOG_LIMITS.maximumBboxSpanDegrees || input.north - input.south > PLACE_CATALOG_LIMITS.maximumBboxSpanDegrees) {
          invalid("bbox_too_large", `bbox spans must be positive and no more than ${PLACE_CATALOG_LIMITS.maximumBboxSpanDegrees} degrees`);
        }
        from = "place_rtree r JOIN places p ON p.rowid=r.id";
        if (input.west <= input.east) {
          where = "r.max_lon>=? AND r.min_lon<=? AND r.max_lat>=? AND r.min_lat<=? AND p.longitude>=? AND p.longitude<=? AND p.latitude>=? AND p.latitude<=?";
          parameters = [input.west, input.east, input.south, input.north, input.west, input.east, input.south, input.north];
        } else {
          where = "(r.max_lon>=? OR r.min_lon<=?) AND r.max_lat>=? AND r.min_lat<=? AND (p.longitude>=? OR p.longitude<=?) AND p.latitude>=? AND p.latitude<=?";
          parameters = [input.west, input.east, input.south, input.north, input.west, input.east, input.south, input.north];
        }
        normalized = { west: input.west, south: input.south, east: input.east, north: input.north };
        break;
      }
      case "keyword": {
        if (typeof input.q !== "string") invalid("invalid_keyword", "keyword query must be a string");
        const query = normalizedText(input.q);
        if (query.length < PLACE_CATALOG_LIMITS.minimumKeywordCharacters || query.length > PLACE_CATALOG_LIMITS.maximumKeywordCharacters) {
          invalid("invalid_keyword", `keyword must contain ${PLACE_CATALOG_LIMITS.minimumKeywordCharacters} to ${PLACE_CATALOG_LIMITS.maximumKeywordCharacters} normalized characters`);
        }
        where = "p.name_search>=? AND p.name_search<?";
        parameters = [query, `${query}\uffff`];
        normalized = { query };
        break;
      }
      case "url": {
        const value = normalizeUrl(input.url);
        from = "websites w JOIN places p ON p.rowid=w.place_rowid";
        where = "w.normalized_url=?";
        parameters = [value.url];
        normalized = { url: value.url };
        break;
      }
      case "domain": {
        const domain = normalizeDomain(input.domain);
        from = "websites w JOIN places p ON p.rowid=w.place_rowid";
        where = "w.normalized_domain=?";
        parameters = [domain];
        normalized = { domain };
        break;
      }
      case "id": {
        if (typeof input.id !== "string" || !PLACE_ID.test(input.id)) invalid("invalid_id", "id must be an exact valid Overture place id");
        where = "p.id=?";
        parameters = [input.id];
        normalized = { id: input.id };
        break;
      }
      default:
        return invalid("invalid_search_mode", "search mode is invalid");
    }

    const identity = queryIdentity(input, normalized);
    const offset = decodeCursor(input.cursor, identity);
    const rows = this.#all(`SELECT ${PLACE_COLUMNS} FROM ${from} WHERE ${where} ORDER BY p.id LIMIT ? OFFSET ?`, [
      ...parameters, limit + 1, offset,
    ]);
    const truncated = rows.length > limit;
    const places = Object.freeze(rows.slice(0, limit).map(decodeRow));
    const nextOffset = offset + places.length;
    const candidateSearchMayBeAmbiguous = input.mode !== "bbox";
    return Object.freeze({
      places,
      truncated,
      ambiguous: candidateSearchMayBeAmbiguous && (places.length > 1 || truncated),
      ...(truncated && nextOffset <= PLACE_CATALOG_LIMITS.maximumCursorOffset ? { nextCursor: encodeCursor(nextOffset, identity) } : {}),
      release: this.release,
      schemaVersion: this.schemaVersion,
    });
  }

  byIds(ids: readonly string[]): readonly PlaceRecord[] {
    this.#assertOpen();
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > PLACE_CATALOG_LIMITS.maximumIds) {
      invalid("invalid_ids", `ids must contain between 1 and ${PLACE_CATALOG_LIMITS.maximumIds} exact ids`);
    }
    const seen = new Set<string>();
    for (const id of ids) {
      if (typeof id !== "string" || !PLACE_ID.test(id) || seen.has(id)) invalid("invalid_ids", "ids must be unique exact valid Overture place ids");
      seen.add(id);
    }
    const placeholders = ids.map(() => "?").join(",");
    const records = new Map(this.#all(`SELECT ${PLACE_COLUMNS} FROM places p WHERE p.id IN (${placeholders})`, [...ids]).map((row) => {
      const place = decodeRow(row);
      return [place.id, place] as const;
    }));
    if (records.size !== ids.length) invalid("unknown_ids", "one or more exact place ids are absent from this catalog release");
    return Object.freeze(ids.flatMap((id) => {
      const place = records.get(id);
      return place === undefined ? [] : [place];
    }));
  }

  #all(sql: string, parameters: readonly SQLQueryBindings[]): PlaceRow[] {
    try {
      return this.#database.query<PlaceRow, SQLQueryBindings[]>(sql).all(...parameters);
    } catch (error) {
      throw new PlaceCatalogError("catalog_corrupt", "catalog_query_failed", "place catalog query failed", { cause: error });
    }
  }

  #assertOpen(): void {
    if (this.#closed) throw new PlaceCatalogError("catalog_unavailable", "catalog_closed", "place catalog is closed");
  }

  #validateSchema(): void {
    const quickCheck = this.#database.query<{ quick_check: string }, []>("PRAGMA quick_check").all();
    if (quickCheck.length !== 1 || quickCheck[0]?.quick_check !== "ok") {
      throw new PlaceCatalogError("catalog_corrupt", "catalog_integrity_failed", "place catalog SQLite integrity check failed");
    }
    const metadataRows = this.#database.query<{ key: string; value: string }, []>("SELECT key,value FROM metadata").all();
    const metadata = new Map(metadataRows.map(({ key, value }) => [key, value]));
    if (metadata.get("catalog_format") !== PLACE_CATALOG_FORMAT || metadata.get("overture_release") !== PLACE_CATALOG_RELEASE || metadata.get("overture_schema_version") !== PLACE_CATALOG_OVERTURE_SCHEMA_VERSION) {
      throw new PlaceCatalogError("catalog_corrupt", "catalog_version_mismatch", "place catalog release or schema version is unsupported");
    }
    const receiptText = metadata.get("import_receipt");
    if (metadata.size !== 4 || receiptText === undefined) {
      throw new PlaceCatalogError("catalog_corrupt", "catalog_manifest_missing", "place catalog import receipt is missing");
    }
    const receipt = parseJson(receiptText, "import receipt");
    if (!isJsonObject(receipt)
      || receipt.catalogFormat !== PLACE_CATALOG_FORMAT || receipt.release !== PLACE_CATALOG_RELEASE
      || receipt.schemaVersion !== PLACE_CATALOG_OVERTURE_SCHEMA_VERSION || !Array.isArray(receipt.sources)) {
      throw new PlaceCatalogError("catalog_corrupt", "catalog_manifest_invalid", "place catalog import receipt is invalid");
    }
    const pragmas = this.#database.query<{ application_id: number; user_version: number }, []>(
      "SELECT (SELECT application_id FROM pragma_application_id) application_id,(SELECT user_version FROM pragma_user_version) user_version",
    ).get();
    if (pragmas?.application_id !== 1_497_380_432 || pragmas.user_version !== 1) {
      throw new PlaceCatalogError("catalog_corrupt", "catalog_schema_mismatch", "place catalog application schema is invalid");
    }
    const placeColumns = this.#database.query<{ name: string }, []>("PRAGMA table_info(places)").all().map(({ name }) => name);
    if (placeColumns.length !== EXPECTED_PLACE_COLUMNS.length || EXPECTED_PLACE_COLUMNS.some((column, index) => placeColumns[index] !== column)) {
      throw new PlaceCatalogError("catalog_corrupt", "catalog_schema_mismatch", "place catalog table schema is invalid");
    }
    const requiredObjects = new Map(this.#database.query<{ name: string; type: string }, []>(
      "SELECT name,type FROM sqlite_schema WHERE name IN ('place_rtree','websites','places_name_prefix_idx','websites_url_idx','websites_domain_idx')",
    ).all().map(({ name, type }) => [name, type]));
    if (requiredObjects.get("place_rtree") !== "table" || requiredObjects.get("websites") !== "table" || requiredObjects.get("places_name_prefix_idx") !== "index" || requiredObjects.get("websites_url_idx") !== "index" || requiredObjects.get("websites_domain_idx") !== "index") {
      throw new PlaceCatalogError("catalog_corrupt", "catalog_schema_mismatch", "place catalog indexes are missing");
    }
    const logicalDamage = this.#database.query<{ damaged: number }, []>(`SELECT EXISTS(
      SELECT 1 FROM places p LEFT JOIN place_rtree r ON r.id=p.rowid
      WHERE r.id IS NULL OR NOT (p.longitude BETWEEN r.min_lon AND r.max_lon)
        OR NOT (p.latitude BETWEEN r.min_lat AND r.max_lat)
      UNION ALL
      SELECT 1 FROM place_rtree r LEFT JOIN places p ON p.rowid=r.id WHERE p.rowid IS NULL
      UNION ALL
      SELECT 1 FROM places p
      WHERE json_array_length(p.websites_json) != (SELECT count(*) FROM websites w WHERE w.place_rowid=p.rowid)
        OR EXISTS (SELECT 1 FROM json_each(p.websites_json) j
          WHERE NOT EXISTS (SELECT 1 FROM websites w WHERE w.place_rowid=p.rowid AND w.normalized_url=j.value))
      UNION ALL
      SELECT 1 FROM websites w LEFT JOIN places p ON p.rowid=w.place_rowid WHERE p.rowid IS NULL
    ) AS damaged`).get();
    if (logicalDamage?.damaged !== 0) {
      throw new PlaceCatalogError("catalog_corrupt", "catalog_index_mismatch", "place catalog spatial or URL index is inconsistent");
    }
    const indexedWebsites = this.#database.query<{ normalized_url: string; normalized_domain: string }, []>(
      "SELECT normalized_url,normalized_domain FROM websites ORDER BY place_rowid,normalized_url",
    );
    for (const website of indexedWebsites.iterate()) {
      try {
        const normalized = normalizeUrl(website.normalized_url);
        if (normalized.url !== website.normalized_url || normalized.domain !== website.normalized_domain) {
          throw new Error("non-canonical indexed URL");
        }
      } catch (error) {
        throw new PlaceCatalogError("catalog_corrupt", "catalog_index_mismatch", "place catalog URL index contains unsafe or inconsistent data", { cause: error });
      }
    }
  }
}
