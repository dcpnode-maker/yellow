export const STREET_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const STREET_MAP_PROVIDER_ORIGIN = "https://tiles.openfreemap.org";
export const STREET_MAP_ATTRIBUTION = "OpenFreeMap © OpenMapTiles · Data from OpenStreetMap";
export const STREET_MAP_MAX_LATITUDE = 85.05112878;

export interface StreetMapCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface StreetMapCity extends StreetMapCoordinates {
  readonly label: string;
}

export const STREET_MAP_CITIES: readonly StreetMapCity[] = [
  { label: "Abu Dhabi", latitude: 24.4539, longitude: 54.3773 },
  { label: "Dubai", latitude: 25.2048, longitude: 55.2708 },
  { label: "Riyadh", latitude: 24.7136, longitude: 46.6753 },
  { label: "Dehradun", latitude: 30.3165, longitude: 78.0322 },
  { label: "London", latitude: 51.5072, longitude: -0.1276 },
  { label: "New York", latitude: 40.7128, longitude: -74.006 },
  { label: "Delhi", latitude: 28.6139, longitude: 77.209 },
  { label: "Singapore", latitude: 1.3521, longitude: 103.8198 },
  { label: "Tokyo", latitude: 35.6762, longitude: 139.6503 },
];

const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

/** Accept only plain decimal coordinates; no expressions, URLs, or coercive JS numbers. */
export function parseStreetMapCoordinates(latitudeText: string, longitudeText: string): StreetMapCoordinates | null {
  const latitudeValue = latitudeText.trim();
  const longitudeValue = longitudeText.trim();
  if (!DECIMAL.test(latitudeValue) || !DECIMAL.test(longitudeValue)) return null;
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -STREET_MAP_MAX_LATITUDE || latitude > STREET_MAP_MAX_LATITUDE || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export interface StreetMapEventHandler {
  (): void;
}

export interface ReleasableStreetMap {
  off(event: "load" | "error", handler: StreetMapEventHandler): unknown;
  remove(): void;
}

export interface ReleasableStreetMapMarker {
  remove(): unknown;
}

/** Detach every listener and release both WebGL map resources and the preview marker. */
export function releaseStreetMap(
  map: ReleasableStreetMap,
  marker: ReleasableStreetMapMarker | null,
  onLoad: StreetMapEventHandler,
  onError: StreetMapEventHandler,
): void {
  map.off("load", onLoad);
  map.off("error", onError);
  marker?.remove();
  map.remove();
}
