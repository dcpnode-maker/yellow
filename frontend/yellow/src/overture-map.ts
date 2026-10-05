export const OVERTURE_RELEASE = "2026-09-23.0";
export const VISIBLE_PLACE_LIMIT = 200;
export const PLACES_MIN_ZOOM = 14;
export type OvertureView = "all" | "lodging";
export const GLOBAL_BOUNDS = [-180, -85.05, 180, 85.05] as const;

export const OVERTURE_AREAS = [
  { label: "Riyadh", longitude: 46.6753, latitude: 24.7136 },
  { label: "Dubai", longitude: 55.2708, latitude: 25.2048 },
  { label: "Dehradun", longitude: 78.0322, latitude: 30.3165 },
  { label: "London", longitude: -0.1276, latitude: 51.5072 },
  { label: "New York", longitude: -73.9855, latitude: 40.7484 },
  { label: "Sydney", longitude: 151.2093, latitude: -33.8688 },
] as const;

export type OverturePlace = Readonly<{
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  category: string | null;
  taxonomyHierarchy: readonly string[];
  status: string | null;
  confidence: number | null;
  address: string | null;
  websites: readonly string[];
  sources: readonly string[];
}>;

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const boundedText = (value: unknown, limit = 240): string | null => {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result && result.length <= limit && !/[\u0000-\u001f\u007f]/.test(result) ? result : null;
};

const parseJson = (value: unknown): unknown => {
  if (typeof value !== "string" || value.length > 20_000) return value;
  try { return JSON.parse(value); } catch { return value; }
};

export function safeExternalUrl(value: unknown): string | null {
  const input = boundedText(value, 2048);
  if (!input) return null;
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function parseCoordinate(longitude: unknown, latitude: unknown): readonly [number, number] | null {
  const lon = typeof longitude === "string" && longitude.trim() ? Number(longitude) : longitude;
  const lat = typeof latitude === "string" && latitude.trim() ? Number(latitude) : latitude;
  if (typeof lon !== "number" || typeof lat !== "number" || !Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -85.05 || lat > 85.05) return null;
  return [lon, lat];
}

function nameOf(properties: Record<string, unknown>): string | null {
  const direct = boundedText(properties["@name"] ?? properties.name);
  if (direct) return direct;
  const names = object(parseJson(properties.names));
  return names ? boundedText(names.primary) : null;
}

function addressOf(value: unknown): string | null {
  const parsed = parseJson(value);
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  const address = object(first);
  if (!address) return null;
  const freeform = boundedText(address.freeform ?? address.formatted ?? address.address);
  if (freeform) return freeform;
  const parts = [address.locality, address.region, address.country].map(part => boundedText(part, 80)).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function strings(value: unknown, limit: number): readonly string[] {
  const parsed = parseJson(value);
  return (Array.isArray(parsed) ? parsed : [parsed]).slice(0, limit).flatMap(item => {
    const text = boundedText(item, 2048);
    return text ? [text] : [];
  });
}

function sourceLabels(value: unknown): readonly string[] {
  const parsed = parseJson(value);
  const sources = Array.isArray(parsed) ? parsed : [parsed];
  return sources.slice(0, 4).flatMap(source => {
    const direct = boundedText(source, 300);
    if (direct) return [direct];
    const record = object(source);
    if (!record) return [];
    const parts = [record.dataset, record.record_id, record.update_time].map(part => boundedText(part, 100)).filter(Boolean);
    return parts.length ? [parts.join(" · ")] : [];
  });
}

export function normalizeOverturePlace(feature: unknown): OverturePlace | null {
  const raw = object(feature);
  const properties = object(raw?.properties);
  const geometry = object(raw?.geometry);
  const coordinates = geometry?.type === "Point" && Array.isArray(geometry.coordinates) ? geometry.coordinates : null;
  if (!properties || !coordinates) return null;
  const point = parseCoordinate(coordinates[0], coordinates[1]);
  const id = boundedText(properties.id ?? raw?.id, 160);
  if (!point || !id) return null;
  const taxonomy = object(parseJson(properties.taxonomy));
  const hierarchy = Array.isArray(taxonomy?.hierarchy) && taxonomy.hierarchy.length <= 16 && taxonomy.hierarchy.every(item => typeof item === "string" && /^[a-z][a-z0-9_]{0,79}$/.test(item))
    ? taxonomy.hierarchy as string[] : [];
  return Object.freeze({
    id,
    name: nameOf(properties) ?? "Unnamed place",
    longitude: point[0], latitude: point[1],
    category: boundedText(properties.basic_category, 160),
    taxonomyHierarchy: Object.freeze([...hierarchy]),
    status: boundedText(properties.operating_status, 120),
    confidence: typeof properties.confidence === "number" && properties.confidence >= 0 && properties.confidence <= 1 ? properties.confidence : null,
    address: addressOf(properties.addresses),
    websites: Object.freeze(strings(properties.websites, 4).flatMap(site => { const safe = safeExternalUrl(site); return safe ? [safe] : []; })),
    sources: Object.freeze(sourceLabels(properties.sources)),
  });
}

export function boundedVisiblePlaces(features: readonly unknown[]): readonly OverturePlace[] {
  const seen = new Set<string>();
  const result: OverturePlace[] = [];
  for (const feature of features) {
    const place = normalizeOverturePlace(feature);
    if (!place || seen.has(place.id)) continue;
    seen.add(place.id);
    result.push(place);
    if (result.length === VISIBLE_PLACE_LIMIT) break;
  }
  return result;
}

export function matchesOvertureView(place: OverturePlace, view: OvertureView): boolean {
  return view === "all" || place.taxonomyHierarchy.includes("lodging");
}

export function overtureArchiveUrl(origin: string, theme: "places" | "divisions"): string {
  const url = new URL(origin);
  if (!/^https?:$/.test(url.protocol) || url.pathname !== "/" || url.search || url.hash) throw new TypeError("Invalid map origin");
  return `${url.origin}/api/public/overture/${OVERTURE_RELEASE}/${theme}.pmtiles`;
}
