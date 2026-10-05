import { STREET_MAP_MAX_LATITUDE } from "./street-map";
import type { FeatureCollection, Point } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { decodeOsmMarketJson, type OsmMarketData } from "./osm-market-import";

const MAX_BYTES = 5_000_000;
const MAX_ROWS = 10_000;
const DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u;
const COORDINATE = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u;
const INSTANT = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/u;
const SOURCE_KEYS = ["provider", "market", "dashboardId", "currency", "sourceRefreshed", "sourceRefreshTimezone", "observedAt", "contextBasis"];
const ROW_KEYS = ["listingId", "sourceRowId", "listingLink", "latitude", "longitude", "coordinatePrecision", "bedrooms", "starRating", "reviews", "priceNextYearAverage", "activeNights", "minimumStay", "dynamicPricing", "newListing", "title"];
const LIMITATIONS = [
  "listing_coordinates_are_approximate", "listing_price_is_next_year_average_not_october_quote",
  "future_percentiles_are_regional_advertised_nightly_rates_excluding_fees",
  "no_listing_availability_or_confirmed_transaction_price", "no_dubai_or_global_coverage",
];

export class MarketListingImportError extends Error {
  constructor(readonly code: string) { super(code); this.name = "MarketListingImportError"; }
}
function fail(code: string): never { throw new MarketListingImportError(code); }
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
    ? value as Record<string, unknown> : null;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
}
function bounded(value: unknown, maximum: number, code: string): string {
  if (typeof value !== "string") fail(code);
  if (value.length > maximum) fail("text_too_long");
  return value;
}
function dateValid(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]!;
}
function validInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = INSTANT.exec(value);
  return Boolean(match && dateValid(match[1]!) && Number(match[2]) <= 23 && Number(match[3]) <= 59 && Number(match[4]) <= 59);
}
function numberText(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !DECIMAL.test(value) || value.length > 40) fail("invalid_number");
  return value;
}
function coordinate(value: unknown, limit: number): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !COORDINATE.test(value) || value.length > 40) fail("invalid_coordinate");
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) fail("invalid_coordinate");
  return value;
}
function safeLink(value: unknown): string {
  const text = bounded(value, 2_048, "unsafe_link");
  let parsed: URL;
  try { parsed = new URL(text); } catch { return fail("unsafe_link"); }
  if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) fail("unsafe_link");
  return text;
}

export interface MarketListingRow {
  readonly listingId: string;
  readonly sourceRowId: string;
  readonly listingLink: string;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly coordinatePrecision: "source-approximate";
  readonly bedrooms: string;
  readonly starRating: string | null;
  readonly reviews: string | null;
  readonly priceNextYearAverage: string | null;
  readonly activeNights: string | null;
  readonly minimumStay: string | null;
  readonly dynamicPricing: string;
  readonly newListing: boolean;
  readonly title: string;
}
export interface MarketListingData {
  readonly source: Readonly<{
    provider: "PriceLabs"; market: string; dashboardId: string; currency: string;
    sourceRefreshed: string; sourceRefreshTimezone: null;
    observedAt: string; contextBasis: "operator-supplied-dashboard-context-not-encoded-in-csv";
  }>;
  readonly rows: readonly MarketListingRow[];
  readonly mappedCount: number;
  readonly unmappedCount: number;
}
/** Separate datasets; source-specific semantics never leak into the other source. */
export type ImportedMarketData = Readonly<{ kind: "pricelabs"; data: MarketListingData }>
  | Readonly<{ kind: "osm"; data: OsmMarketData }>;
export interface MarketMapPoint {
  readonly listingId: string; readonly latitude: string | null; readonly longitude: string | null;
}

export function decodeImportedMarketJson(text: string): ImportedMarketData {
  if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > MAX_BYTES) fail("file_too_large");
  let parsed: unknown;
  try { parsed = JSON.parse(text) as unknown; } catch { return fail("invalid_json"); }
  const root = object(parsed);
  if (root && object(root.metadata)?.schema === "yellow.osm-accommodation-sample.v1") {
    return { kind: "osm", data: decodeOsmMarketJson(text) };
  }
  return { kind: "pricelabs", data: decodeMarketListingJson(text) };
}

/** Strictly accepts the Order722 private listing JSON, not arbitrary provider output. */
export function decodeMarketListingJson(text: string): MarketListingData {
  if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > MAX_BYTES) fail("file_too_large");
  let parsed: unknown;
  try { parsed = JSON.parse(text) as unknown; } catch { return fail("invalid_json"); }
  const root = object(parsed);
  if (!root || !exactKeys(root, ["schemaVersion", "operational", "source", "limitations", "rows"])
      || root.schemaVersion !== "yellow.pricelabs-dashboard-listings/v1" || root.operational !== false) fail("invalid_package");
  const source = object(root.source);
  if (!source || !exactKeys(source, SOURCE_KEYS) || source.provider !== "PriceLabs"
      || typeof source.market !== "string" || !source.market.trim() || source.market.length > 120
      || /[\u0000-\u001f\u007f]/u.test(source.market)
      || typeof source.dashboardId !== "string" || !/^[0-9]{1,32}$/u.test(source.dashboardId)
      || typeof source.currency !== "string" || !/^[A-Z]{3}$/u.test(source.currency)
      || typeof source.sourceRefreshed !== "string" || !source.sourceRefreshed.trim()
      || source.sourceRefreshed.length > 120 || /[\u0000-\u001f\u007f]/u.test(source.sourceRefreshed)
      || source.sourceRefreshTimezone !== null
      || source.contextBasis !== "operator-supplied-dashboard-context-not-encoded-in-csv"
      || !validInstant(source.observedAt)) fail("invalid_source");
  const suppliedLimitations = root.limitations;
  if (!Array.isArray(suppliedLimitations) || suppliedLimitations.length !== LIMITATIONS.length
      || !LIMITATIONS.every((item, index) => suppliedLimitations[index] === item)) fail("invalid_limitations");
  if (/\bdubai\b/iu.test(source.market as string)) fail("contradictory_source");
  if (!Array.isArray(root.rows) || root.rows.length > MAX_ROWS) fail("invalid_rows");
  const listingIds = new Set<string>(); const rowIds = new Set<string>();
  let mappedCount = 0;
  const rows = root.rows.map((value: unknown): MarketListingRow => {
    const entry = object(value);
    if (!entry || !exactKeys(entry, ROW_KEYS)) fail("invalid_row");
    const listingId = bounded(entry.listingId, 256, "invalid_id");
    const sourceRowId = bounded(entry.sourceRowId, 256, "invalid_id");
    if (!listingId || !sourceRowId || /[\u0000-\u001f\u007f]/u.test(listingId + sourceRowId)) fail("invalid_id");
    if (listingIds.has(listingId) || rowIds.has(sourceRowId)) fail("duplicate_id");
    listingIds.add(listingId); rowIds.add(sourceRowId);
    const latitude = coordinate(entry.latitude, STREET_MAP_MAX_LATITUDE);
    const longitude = coordinate(entry.longitude, 180);
    if ((latitude === null) !== (longitude === null) || entry.coordinatePrecision !== "source-approximate") fail("invalid_coordinate");
    if (latitude !== null) mappedCount += 1;
    if (typeof entry.newListing !== "boolean") fail("invalid_row");
    return {
      listingId, sourceRowId, listingLink: safeLink(entry.listingLink), latitude, longitude,
      coordinatePrecision: "source-approximate", bedrooms: bounded(entry.bedrooms, 40, "invalid_row"),
      starRating: numberText(entry.starRating), reviews: numberText(entry.reviews),
      priceNextYearAverage: numberText(entry.priceNextYearAverage), activeNights: numberText(entry.activeNights),
      minimumStay: numberText(entry.minimumStay), dynamicPricing: bounded(entry.dynamicPricing, 40, "invalid_row"),
      newListing: entry.newListing, title: bounded(entry.title, 512, "invalid_row"),
    };
  });
  return { source: source as unknown as MarketListingData["source"], rows, mappedCount, unmappedCount: rows.length - mappedCount };
}

export function filterMarketListings(rows: readonly MarketListingRow[], search: string, bedrooms: string): MarketListingRow[] {
  const term = search.trim().toLocaleLowerCase().slice(0, 100);
  return rows.filter(row => (bedrooms === "all" || row.bedrooms === bedrooms)
    && (!term || row.title.toLocaleLowerCase().includes(term) || row.listingId.toLocaleLowerCase().includes(term)));
}

export function paginateMarketListings<T>(rows: readonly T[], page: number, pageSize = 20) {
  const safeSize = Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100 ? pageSize : 20;
  const pageCount = Math.max(1, Math.ceil(rows.length / safeSize));
  const currentPage = Number.isInteger(page) ? Math.min(Math.max(page, 1), pageCount) : 1;
  return { page: currentPage, pageCount, rows: rows.slice((currentPage - 1) * safeSize, currentPage * safeSize) };
}

export function marketListingGeoJson(rows: readonly MarketMapPoint[]) {
  return {
    type: "FeatureCollection" as const,
    features: rows.flatMap(row => row.latitude === null || row.longitude === null ? [] : [{
      type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [Number(row.longitude), Number(row.latitude)] },
      properties: { listingId: row.listingId },
    }]),
  };
}

export const MARKET_LISTING_SOURCE = "yellow-private-market-listings";
export const MARKET_CLUSTER_LAYER = "yellow-private-market-clusters";
export const MARKET_CLUSTER_COUNT_LAYER = "yellow-private-market-cluster-count";
export const MARKET_POINT_LAYER = "yellow-private-market-points";

/** Only a client-side GeoJSON source: the tile provider receives viewport requests, not these rows. */
export function attachMarketListingLayers(map: MapLibreMap, onSelect: (listingId: string) => void) {
  let active = true;
  const empty = marketListingGeoJson([]) as FeatureCollection<Point, { listingId: string }>;
  const removeArtifacts = () => {
    for (const layer of [MARKET_POINT_LAYER, MARKET_CLUSTER_COUNT_LAYER, MARKET_CLUSTER_LAYER]) {
      if (map.getLayer(layer)) map.removeLayer(layer);
    }
    if (map.getSource(MARKET_LISTING_SOURCE)) map.removeSource(MARKET_LISTING_SOURCE);
  };
  try {
    map.addSource(MARKET_LISTING_SOURCE, { type: "geojson", data: empty, cluster: true, clusterMaxZoom: 14, clusterRadius: 48 });
    map.addLayer({ id: MARKET_CLUSTER_LAYER, type: "circle", source: MARKET_LISTING_SOURCE,
      filter: ["has", "point_count"], paint: { "circle-color": "#b7ff35", "circle-radius": ["step", ["get", "point_count"], 17, 30, 23, 120, 30],
        "circle-stroke-color": "#17321c", "circle-stroke-width": 1.5 } });
    map.addLayer({ id: MARKET_CLUSTER_COUNT_LAYER, type: "symbol", source: MARKET_LISTING_SOURCE,
      filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12,
        "text-font": ["Noto Sans Regular"] },
      paint: { "text-color": "#17321c" } });
    map.addLayer({ id: MARKET_POINT_LAYER, type: "circle", source: MARKET_LISTING_SOURCE,
      filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#a9f527", "circle-radius": 6,
        "circle-stroke-color": "#17321c", "circle-stroke-width": 1.5 } });
  } catch (error) { removeArtifacts(); throw error; }
  const clusterClick = (event: MapMouseEvent) => {
    const feature = map.queryRenderedFeatures(event.point, { layers: [MARKET_CLUSTER_LAYER] })[0];
    if (!feature || feature.geometry.type !== "Point") return;
    const clusterId = feature.properties.cluster_id;
    if (typeof clusterId !== "number" || !Number.isSafeInteger(clusterId)) return;
    const coordinates = feature.geometry.coordinates as [number, number];
    const source = map.getSource(MARKET_LISTING_SOURCE) as GeoJSONSource | undefined;
    void source?.getClusterExpansionZoom(clusterId).then(zoom => {
      if (active) map.easeTo({ center: coordinates, zoom });
    }).catch(() => { /* A failed tile/worker read leaves the list usable. */ });
  };
  const pointClick = (event: MapMouseEvent) => {
    const feature = map.queryRenderedFeatures(event.point, { layers: [MARKET_POINT_LAYER] })[0];
    const listingId = feature?.properties.listingId;
    if (active && typeof listingId === "string") onSelect(listingId);
  };
  try {
    map.on("click", MARKET_CLUSTER_LAYER, clusterClick);
    map.on("click", MARKET_POINT_LAYER, pointClick);
  } catch (error) {
    map.off("click", MARKET_CLUSTER_LAYER, clusterClick);
    map.off("click", MARKET_POINT_LAYER, pointClick);
    removeArtifacts();
    throw error;
  }
  return {
    update(rows: readonly MarketMapPoint[], fit = false): void {
      if (!active) return;
      const source = map.getSource(MARKET_LISTING_SOURCE) as GeoJSONSource | undefined;
      if (!source) return;
      void source.setData(marketListingGeoJson(rows) as FeatureCollection<Point, { listingId: string }>).catch(() => {
        /* WebGL/worker failure leaves the accessible list available. */
      });
      if (!fit) return;
      const points = rows.filter(row => row.latitude !== null && row.longitude !== null);
      if (points.length === 0) return;
      let minLatitude = Infinity; let maxLatitude = -Infinity; let minLongitude = Infinity; let maxLongitude = -Infinity;
      for (const point of points) {
        const latitude = Number(point.latitude); const longitude = Number(point.longitude);
        minLatitude = Math.min(minLatitude, latitude); maxLatitude = Math.max(maxLatitude, latitude);
        minLongitude = Math.min(minLongitude, longitude); maxLongitude = Math.max(maxLongitude, longitude);
      }
      if (points.length === 1) map.flyTo({ center: [minLongitude, minLatitude], zoom: 12, essential: false });
      else map.fitBounds([[minLongitude, minLatitude], [maxLongitude, maxLatitude]], { padding: 42, maxZoom: 12, duration: 0 });
    },
    dispose(): void {
      if (!active) return;
      active = false;
      map.off("click", MARKET_CLUSTER_LAYER, clusterClick);
      map.off("click", MARKET_POINT_LAYER, pointClick);
      removeArtifacts();
    },
  };
}

export interface MarketListingFileLike { readonly size: number; text(): Promise<string> }
export function createMarketListingFileSession(callbacks: Readonly<{
  onLoaded(data: MarketListingData): void; onError(message: string): void; onCleared(): void;
}>) {
  return createLocalMarketFileSession(callbacks, decodeMarketListingJson,
    "This file is not a valid bounded Order722 PriceLabs listing export.");
}
export function createImportedMarketFileSession(callbacks: Readonly<{
  onLoaded(data: ImportedMarketData): void; onError(message: string): void; onCleared(): void;
}>) {
  return createLocalMarketFileSession(callbacks, decodeImportedMarketJson,
    "Choose a valid normalized PriceLabs export or Order728 OpenStreetMap accommodation sample. Mixed or altered claims are rejected.");
}
function createLocalMarketFileSession<T>(callbacks: Readonly<{
  onLoaded(data: T): void; onError(message: string): void; onCleared(): void;
}>, decode: (text: string) => T, invalidMessage: string) {
  let generation = 0; let disposed = false;
  return {
    async load(file: MarketListingFileLike): Promise<boolean> {
      if (disposed) return false;
      const current = ++generation;
      callbacks.onCleared();
      if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_BYTES) {
        callbacks.onError("Choose a normalized market JSON file of at most 5 MB."); return false;
      }
      try {
        const text = await file.text();
        if (disposed || current !== generation) return false;
        const data = decode(text);
        if (disposed || current !== generation) return false;
        callbacks.onLoaded(data);
        return true;
      } catch {
        if (!disposed && current === generation) callbacks.onError(invalidMessage);
        return false;
      }
    },
    clear(): void { if (!disposed) { generation += 1; callbacks.onCleared(); } },
    dispose(): void { disposed = true; generation += 1; },
  };
}
