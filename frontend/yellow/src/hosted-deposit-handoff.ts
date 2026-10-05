// Compatibility with the native one-time capability format, never an identity grant.
const SUPPORTED_OPAQUE_BEARER = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/;

/** Only the registered same-origin guest HTML path; no URL input or decoding. */
export function hostedDepositHandoffPath(bearer: unknown): string | null {
  if (typeof bearer !== "string" || bearer.length !== 80 || !SUPPORTED_OPAQUE_BEARER.test(bearer)) return null;
  return `/pay/${encodeURIComponent(bearer)}`;
}
