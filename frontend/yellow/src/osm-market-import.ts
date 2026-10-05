/** Strict Order728 open POI sample. No OTA identity, active inventory or rate inference. */
const MAX_BYTES = 5_000_000;
const MAX_ROWS = 10_000;
const SAMPLE_BBOX = [24.8, 54.85, 25.45, 55.65] as const;
const METADATA_KEYS = ["schema", "source_endpoint", "fetched_at", "source_timestamp", "response_sha256", "response_bytes",
  "filtered_extract_sha256", "bounding_box_south_west_north_east", "coverage", "returned_elements", "retained", "excluded",
  "exclusion_counts", "attribution", "license", "license_url", "copyright_url"];
const ROW_KEYS = ["source_type", "source_id", "source_url", "source_status", "tourism_kind", "name", "latitude", "longitude",
  "coordinate_kind", "fetched_at", "active_inventory", "ota_identity", "exact_entrance", "prices", "calendar"];
const EXCLUSIONS = ["malformed_element", "invalid_source_identity", "duplicate_osm_id", "disallowed_tourism_type", "invalid_coordinates", "out_of_bounds"];
export const OSM_CATEGORY_LABELS = { hotel: "Hotel", apartment: "Apartment", hostel: "Hostel", guest_house: "Guest house", motel: "Motel" } as const;
export type OsmTourismKind = keyof typeof OSM_CATEGORY_LABELS;
export type OsmCoordinateKind = "osm_node_point" | "osm_bounding_box_center";
export interface OsmMarketRow {
  readonly listingId: string; readonly sourceId: string; readonly sourceType: "node" | "way" | "relation";
  readonly listingLink: string; readonly title: string; readonly latitude: string; readonly longitude: string;
  readonly tourismKind: OsmTourismKind; readonly coordinateKind: OsmCoordinateKind;
}
export interface OsmMarketData {
  readonly source: Readonly<{
    provider: "OpenStreetMap"; market: "Dubai metro sample"; observedAt: string; sourceTimestamp: string;
    responseSha256: string; filteredExtractSha256: string; returnedCount: number; excludedCount: number;
    license: "ODbL-1.0"; copyrightUrl: "https://www.openstreetmap.org/copyright";
  }>;
  readonly rows: readonly OsmMarketRow[]; readonly mappedCount: number; readonly unmappedCount: 0;
}
export class OsmMarketImportError extends Error {
  constructor(readonly code: string) { super(code); this.name = "OsmMarketImportError"; }
}
function fail(code: string): never { throw new OsmMarketImportError(code); }
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
    ? value as Record<string, unknown> : null;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
}
function count(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_ROWS; }
function instant(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 40) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/u.exec(value);
  if (!match) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]!
    && Number(match[4]) <= 23 && Number(match[5]) <= 59 && Number(match[6]) <= 59
    && (match[7] === undefined || Number(match[7]) <= 23) && (match[8] === undefined || Number(match[8]) <= 59)
    && Number.isFinite(Date.parse(value));
}
function hash(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value); }
/** JSON.parse otherwise silently accepts duplicate keys whose earlier claims conflict. */
function rejectDuplicateKeys(text: string): void {
  const containers: Array<Set<string> | null> = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "{" || character === "[") {
      containers.push(character === "{" ? new Set<string>() : null);
      if (containers.length > 32) fail("invalid_json_depth");
    } else if (character === "}" || character === "]") containers.pop();
    else if (character === '"') {
      const start = index;
      for (index += 1; index < text.length; index += 1) {
        if (text[index] === "\\") index += 1;
        else if (text[index] === '"') break;
      }
      let next = index + 1;
      while (next < text.length && /\s/u.test(text[next]!)) next += 1;
      const keys = containers[containers.length - 1];
      if (text[next] === ":" && keys) {
        const key: unknown = JSON.parse(text.slice(start, index + 1));
        if (typeof key !== "string") fail("invalid_json");
        if (keys.has(key)) fail("duplicate_json_key");
        keys.add(key);
      }
    }
  }
}

export function decodeOsmMarketJson(text: string): OsmMarketData {
  if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > MAX_BYTES) fail("file_too_large");
  let parsed: unknown;
  try { rejectDuplicateKeys(text); parsed = JSON.parse(text) as unknown; } catch { return fail("invalid_json"); }
  const root = object(parsed);
  if (!root || !exactKeys(root, ["metadata", "accommodations"])) fail("invalid_package");
  const metadata = object(root.metadata);
  if (!metadata || !exactKeys(metadata, METADATA_KEYS) || metadata.schema !== "yellow.osm-accommodation-sample.v1"
    || metadata.source_endpoint !== "https://overpass-api.de/api/interpreter"
    || !instant(metadata.fetched_at) || !instant(metadata.source_timestamp)
    || Date.parse(metadata.source_timestamp) > Date.parse(metadata.fetched_at)
    || !hash(metadata.response_sha256) || !hash(metadata.filtered_extract_sha256)
    || typeof metadata.response_bytes !== "number" || !Number.isSafeInteger(metadata.response_bytes)
    || metadata.response_bytes <= 0 || metadata.response_bytes > 8 * 1024 * 1024
    || metadata.coverage !== "Bounded Dubai metro POI sample; not a complete market or administrative boundary.") fail("invalid_metadata");
  if (metadata.attribution !== "OpenStreetMap contributors" || metadata.license !== "ODbL-1.0"
    || metadata.license_url !== "https://opendatacommons.org/licenses/odbl/1-0/"
    || metadata.copyright_url !== "https://www.openstreetmap.org/copyright") fail("invalid_attribution");
  if (!Array.isArray(metadata.bounding_box_south_west_north_east)
    || metadata.bounding_box_south_west_north_east.length !== SAMPLE_BBOX.length
    || !SAMPLE_BBOX.every((edge, index) => (metadata.bounding_box_south_west_north_east as unknown[])[index] === edge)) fail("invalid_sample_bounds");
  if (!Array.isArray(root.accommodations) || root.accommodations.length > MAX_ROWS
    || !count(metadata.returned_elements) || !count(metadata.retained) || !count(metadata.excluded)
    || metadata.retained !== root.accommodations.length || metadata.returned_elements !== metadata.retained + metadata.excluded) fail("invalid_counts");
  const exclusions = object(metadata.exclusion_counts);
  if (!exclusions || !Object.keys(exclusions).every(key => EXCLUSIONS.includes(key))
    || !Object.values(exclusions).every(value => count(value) && value > 0)
    || Object.values(exclusions).reduce<number>((sum, value) => sum + Number(value), 0) !== metadata.excluded) fail("invalid_exclusions");
  const identifiers = new Set<string>();
  const rows = root.accommodations.map((value: unknown): OsmMarketRow => {
    const row = object(value);
    if (!row || !exactKeys(row, ROW_KEYS)) fail("invalid_row");
    if ((row.source_type !== "node" && row.source_type !== "way" && row.source_type !== "relation")
      || typeof row.source_id !== "string" || !/^[1-9][0-9]{0,19}$/u.test(row.source_id)) fail("invalid_id");
    const listingId = `osm/${row.source_type}/${row.source_id}`;
    if (identifiers.has(listingId)) fail("duplicate_id");
    identifiers.add(listingId);
    const link = `https://www.openstreetmap.org/${row.source_type}/${row.source_id}`;
    if (row.source_url !== link) fail("unsafe_source_link");
    if (row.source_status !== "mapped_accommodation_unverified" || row.fetched_at !== metadata.fetched_at
      || !["active_inventory", "ota_identity", "exact_entrance", "prices", "calendar"].every(field => row[field] === "unknown")) fail("unsupported_claim");
    if (typeof row.tourism_kind !== "string" || !Object.hasOwn(OSM_CATEGORY_LABELS, row.tourism_kind)) fail("invalid_category");
    if (row.coordinate_kind !== (row.source_type === "node" ? "osm_node_point" : "osm_bounding_box_center")) fail("invalid_coordinate_kind");
    if (typeof row.latitude !== "number" || !Number.isFinite(row.latitude) || row.latitude < SAMPLE_BBOX[0] || row.latitude > SAMPLE_BBOX[2]
      || typeof row.longitude !== "number" || !Number.isFinite(row.longitude) || row.longitude < SAMPLE_BBOX[1] || row.longitude > SAMPLE_BBOX[3]) fail("invalid_coordinates");
    if (row.name !== null && (typeof row.name !== "string" || row.name.length > 512 || /[\u0000-\u001f\u007f]/u.test(row.name))) fail("invalid_name");
    return { listingId, sourceId: row.source_id, sourceType: row.source_type, listingLink: link,
      title: row.name as string | null ?? "", latitude: String(row.latitude), longitude: String(row.longitude),
      tourismKind: row.tourism_kind as OsmTourismKind, coordinateKind: row.coordinate_kind as OsmCoordinateKind };
  });
  return { source: { provider: "OpenStreetMap", market: "Dubai metro sample", observedAt: metadata.fetched_at,
    sourceTimestamp: metadata.source_timestamp, responseSha256: metadata.response_sha256, filteredExtractSha256: metadata.filtered_extract_sha256,
    returnedCount: metadata.returned_elements, excludedCount: metadata.excluded, license: "ODbL-1.0",
    copyrightUrl: "https://www.openstreetmap.org/copyright" }, rows, mappedCount: rows.length, unmappedCount: 0 };
}

export function filterOsmMarketRows(rows: readonly OsmMarketRow[], search: string, category: string): OsmMarketRow[] {
  const term = search.trim().toLocaleLowerCase().slice(0, 100);
  return rows.filter(row => (category === "all" || row.tourismKind === category)
    && (!term || row.title.toLocaleLowerCase().includes(term) || row.listingId.toLocaleLowerCase().includes(term)));
}
export function osmCoordinateLabel(kind: OsmCoordinateKind): string {
  return kind === "osm_node_point" ? "Mapped OSM point" : "Mapped area centre";
}
