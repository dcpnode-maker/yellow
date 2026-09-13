/**
 * Fixed, same-origin assets for the optional Market evidence map frame.
 * These routes intentionally do not accept a caller-selected filename or URL.
 */
const MARKET_MAP_ASSETS = Object.freeze({
  frame: Object.freeze({
    path: "/assets/market-map/frame.html",
    url: new URL("./operator/market-map.html", import.meta.url),
    contentType: "text/html; charset=utf-8",
  }),
  frameScript: Object.freeze({
    path: "/assets/market-map/frame.js",
    url: new URL("./operator/market-map.js", import.meta.url),
    contentType: "text/javascript; charset=utf-8",
  }),
  frameStyle: Object.freeze({
    path: "/assets/market-map/frame.css",
    url: new URL("./operator/market-map.css", import.meta.url),
    contentType: "text/css; charset=utf-8",
  }),
  leafletScript: Object.freeze({
    path: "/assets/market-map/leaflet.js",
    url: new URL("./operator/vendor/leaflet-1.9.4/leaflet.js", import.meta.url),
    contentType: "text/javascript; charset=utf-8",
  }),
  leafletStyle: Object.freeze({
    path: "/assets/market-map/leaflet.css",
    url: new URL("./operator/vendor/leaflet-1.9.4/leaflet.css", import.meta.url),
    contentType: "text/css; charset=utf-8",
  }),
});

export const MARKET_MAP_FRAME_PATH = MARKET_MAP_ASSETS.frame.path;

/** CSP/XFO are applied by createApp only to a successful exact frame document. */
export const MARKET_MAP_FRAME_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https://tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'none'",
  "form-action 'self'",
].join("; ");

type MarketMapAssetName = keyof typeof MARKET_MAP_ASSETS;

function notFound(): Response {
  return new Response(null, { status: 404 });
}

function exactGet(request: Request, path: string): boolean {
  if (request.method !== "GET") return false;
  try {
    const url = new URL(request.url);
    return url.pathname === path && url.search === "";
  } catch {
    return false;
  }
}

function asset(request: Request, name: MarketMapAssetName): Response {
  const selected = MARKET_MAP_ASSETS[name];
  if (!exactGet(request, selected.path)) return notFound();
  return new Response(Bun.file(selected.url), {
    headers: {
      "cache-control": "no-cache",
      "content-type": selected.contentType,
      "x-content-type-options": "nosniff",
    },
  });
}

/** Do not match a caller path alone: the response must be the exact successful frame document. */
export function isSuccessfulMarketMapFrameDocument(request: Request, response: unknown): boolean {
  return exactGet(request, MARKET_MAP_FRAME_PATH)
    && response instanceof Response
    && response.status === 200
    && response.headers.get("content-type") === MARKET_MAP_ASSETS.frame.contentType
    && response.headers.get("cache-control") === "no-cache";
}

export const marketMapAssets = Object.freeze({
  frame(request: Request): Response { return asset(request, "frame"); },
  frameScript(request: Request): Response { return asset(request, "frameScript"); },
  frameStyle(request: Request): Response { return asset(request, "frameStyle"); },
  leafletScript(request: Request): Response { return asset(request, "leafletScript"); },
  leafletStyle(request: Request): Response { return asset(request, "leafletStyle"); },
});
