/** Same-origin allowlist for RMS-PLACES-001 browser assets. Callers cannot turn a
 * request path into a filesystem path: only these immutable names have a response. */
const ASSET_PATHS = {
  "operator-market-map.js": new URL("./operator/operator-market-map.js", import.meta.url),
  "operator-market-map.css": new URL("./operator/operator-market-map.css", import.meta.url),
  "vendor/ne_110m_land.geojson": new URL("./operator/vendor/ne_110m_land.geojson", import.meta.url),
  "vendor/maplibre-gl-6.9.0/LICENSE.txt": new URL("../../node_modules/maplibre-gl/LICENSE.txt", import.meta.url),
  "vendor/maplibre-gl-6.9.0/maplibre-gl.mjs": new URL("../../node_modules/maplibre-gl/dist/maplibre-gl.mjs", import.meta.url),
  "vendor/maplibre-gl-6.9.0/maplibre-gl-shared.mjs": new URL("../../node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs", import.meta.url),
  "vendor/maplibre-gl-6.9.0/maplibre-gl-worker.mjs": new URL("../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url),
  "vendor/maplibre-gl-6.9.0/maplibre-gl.css": new URL("../../node_modules/maplibre-gl/dist/maplibre-gl.css", import.meta.url),
} as const;
export type MarketMapAssetName = keyof typeof ASSET_PATHS;
const CONTENT_TYPES: Readonly<Record<MarketMapAssetName, string>> = {
  "operator-market-map.js": "text/javascript; charset=utf-8",
  "operator-market-map.css": "text/css; charset=utf-8",
  "vendor/ne_110m_land.geojson": "application/geo+json; charset=utf-8",
  "vendor/maplibre-gl-6.9.0/LICENSE.txt": "text/plain; charset=utf-8",
  "vendor/maplibre-gl-6.9.0/maplibre-gl.mjs": "text/javascript; charset=utf-8",
  "vendor/maplibre-gl-6.9.0/maplibre-gl-shared.mjs": "text/javascript; charset=utf-8",
  "vendor/maplibre-gl-6.9.0/maplibre-gl-worker.mjs": "text/javascript; charset=utf-8",
  "vendor/maplibre-gl-6.9.0/maplibre-gl.css": "text/css; charset=utf-8",
};
export function isMarketMapAssetName(value: string): value is MarketMapAssetName {
  return Object.hasOwn(ASSET_PATHS, value);
}
function asset(name: string): Response | undefined {
  if (!isMarketMapAssetName(name)) return undefined;
  return new Response(Bun.file(ASSET_PATHS[name]), { headers: { "cache-control": "no-cache", "content-type": CONTENT_TYPES[name] } });
}
export const marketMapAssets = Object.freeze({
  names: Object.freeze(Object.keys(ASSET_PATHS) as MarketMapAssetName[]),
  isName: isMarketMapAssetName,
  asset,
});
