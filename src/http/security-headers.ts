export const SECURITY_HEADERS = {
  "content-security-policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
  ].join("; "),
  "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
} as const;

/** Native map is lazy but may be opened from any React operator document. */
export function isYellowOperatorDocument(path: string): boolean {
  return path === "/" || /^\/p\/[0-9a-f-]{36}\/(?:today|housekeeping|reservations|guests|res\/[0-9a-f-]{36})$/.test(path);
}

export const YELLOW_MAP_CSP = SECURITY_HEADERS["content-security-policy"]
  .replace("img-src 'self'", "img-src 'self' data: blob: https://tiles.openfreemap.org")
  .replace("connect-src 'self'", "connect-src 'self' https://tiles.openfreemap.org")
  + "; worker-src 'self'";

/** A worker enforces its own response policy, not its parent document's connect-src. */
export const YELLOW_MAP_WORKER_CSP = SECURITY_HEADERS["content-security-policy"]
  .replace("connect-src 'self'", "connect-src 'self' https://tiles.openfreemap.org");

export function isYellowMapWorkerAsset(path: string): boolean {
  return /^\/yellow-next\/assets\/maplibre-gl-worker-[A-Za-z0-9_-]+\.js$/.test(path);
}
