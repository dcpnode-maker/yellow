const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const CLOCK_SKEW_SECONDS = 60;
const JWT_ALGORITHM = "HS256" as const;
const JWT_TYPE = "JWT" as const;
const TOKEN_AUDIENCE = "yellow-api" as const;
const TOKEN_ISSUER = "yellow" as const;
const TOKEN_CLAIM_VERSION = 1 as const;

const TOKEN_CLAIM_KEYS = [
  "aud",
  "cv",
  "exp",
  "iat",
  "iss",
  "jti",
  "nbf",
  "scp",
  "sub",
  "tid",
] as const;

const CONTEXTS = new Set([
  "crm",
  "distribution",
  "financials",
  "groups",
  "housekeeping",
  "identity",
  "inventory",
  "rates",
  "reporting",
  "reservations",
  "statutory-privacy",
  "stay-operations",
  "tax-fiscal",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RESOURCE = /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)*$/;
const ACTION = /^(?:[a-z][a-z0-9_-]*|\*)$/;
const BASE64_URL = /^[A-Za-z0-9_-]+$/;

export interface AccessTokenClaims {
  readonly iss: typeof TOKEN_ISSUER;
  readonly sub: string;
  readonly aud: typeof TOKEN_AUDIENCE;
  readonly iat: number;
  readonly nbf: number;
  readonly exp: number;
  readonly jti: string;
  readonly tid: string;
  readonly scp: string;
  readonly cv: typeof TOKEN_CLAIM_VERSION;
}

export interface AccessTokenSubject {
  readonly userId: string;
  readonly tenantId: string;
  readonly scopes: readonly string[];
}

export interface TokenSigner {
  issue(subject: AccessTokenSubject): Promise<string>;
  verify(token: string): Promise<AccessTokenClaims | null>;
}

export interface Hs256TokenSignerOptions {
  readonly algorithm?: typeof JWT_ALGORITHM;
  readonly now?: () => number;
  readonly jtiFactory?: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isValidScope(scope: string): boolean {
  const separator = scope.indexOf(":");
  if (separator <= 0 || separator !== scope.lastIndexOf(":")) return false;

  const authority = scope.slice(0, separator);
  const action = scope.slice(separator + 1);
  const contextSeparator = authority.indexOf(".");
  if (contextSeparator <= 0) return false;

  const context = authority.slice(0, contextSeparator);
  const resource = authority.slice(contextSeparator + 1);
  return CONTEXTS.has(context) && RESOURCE.test(resource) && ACTION.test(action);
}

function normalizeScopes(scopes: readonly string[]): string {
  if (!scopes.every(isValidScope)) throw new Error("Invalid access-token scope");
  return [...new Set(scopes)].sort().join(" ");
}

function scopesAreValid(scopes: unknown): scopes is string {
  if (typeof scopes !== "string") return false;
  if (scopes === "") return true;
  const entries = scopes.split(" ");
  return entries.every((scope) => scope.length > 0 && isValidScope(scope));
}

function encodeBase64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function ownedArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function encodeJson(value: unknown): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!BASE64_URL.test(value)) return null;
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) return null;
  return decoded;
}

function decodeJson(value: string): unknown {
  const decoded = decodeBase64Url(value);
  if (!decoded) throw new Error("Invalid base64url");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded));
}

function claimsAreValid(value: unknown, now: number): value is AccessTokenClaims {
  if (!isRecord(value) || !hasExactKeys(value, TOKEN_CLAIM_KEYS)) return false;
  if (
    value.iss !== TOKEN_ISSUER ||
    value.aud !== TOKEN_AUDIENCE ||
    value.cv !== TOKEN_CLAIM_VERSION ||
    !isUuid(value.sub) ||
    !isUuid(value.tid) ||
    !isUuid(value.jti) ||
    !scopesAreValid(value.scp) ||
    !Number.isInteger(value.iat) ||
    !Number.isInteger(value.nbf) ||
    !Number.isInteger(value.exp)
  ) {
    return false;
  }

  const iat = value.iat as number;
  const nbf = value.nbf as number;
  const exp = value.exp as number;
  if (nbf !== iat || exp - iat !== ACCESS_TOKEN_TTL_SECONDS) return false;
  if (iat > now + CLOCK_SKEW_SECONDS || nbf > now + CLOCK_SKEW_SECONDS) return false;
  return now <= exp + CLOCK_SKEW_SECONDS;
}

export class Hs256TokenSigner implements TokenSigner {
  readonly #algorithm: typeof JWT_ALGORITHM;
  readonly #key: Promise<CryptoKey>;
  readonly #now: () => number;
  readonly #jtiFactory: () => string;

  constructor(secret: string | Uint8Array, options: Hs256TokenSignerOptions = {}) {
    const secretBytes = typeof secret === "string" ? new TextEncoder().encode(secret) : secret;
    if (secretBytes.byteLength < 32) throw new Error("HS256 secret must contain at least 32 bytes");

    this.#algorithm = options.algorithm ?? JWT_ALGORITHM;
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1_000));
    this.#jtiFactory = options.jtiFactory ?? (() => crypto.randomUUID());
    this.#key = crypto.subtle.importKey(
      "raw",
      ownedArrayBuffer(secretBytes),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }

  async issue(subject: AccessTokenSubject): Promise<string> {
    if (!isUuid(subject.userId) || !isUuid(subject.tenantId)) {
      throw new Error("Access-token subject and tenant must be UUIDs");
    }

    const issuedAt = this.#now();
    if (!Number.isInteger(issuedAt)) throw new Error("Token clock must return epoch seconds");
    const jti = this.#jtiFactory();
    if (!isUuid(jti)) throw new Error("Access-token jti must be a UUID");

    const header = { alg: this.#algorithm, typ: JWT_TYPE };
    const claims: AccessTokenClaims = {
      iss: TOKEN_ISSUER,
      sub: subject.userId,
      aud: TOKEN_AUDIENCE,
      iat: issuedAt,
      nbf: issuedAt,
      exp: issuedAt + ACCESS_TOKEN_TTL_SECONDS,
      jti,
      tid: subject.tenantId,
      scp: normalizeScopes(subject.scopes),
      cv: TOKEN_CLAIM_VERSION,
    };
    const signingInput = `${encodeJson(header)}.${encodeJson(claims)}`;
    const signature = await crypto.subtle.sign(
      "HMAC",
      await this.#key,
      new TextEncoder().encode(signingInput),
    );
    return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      const segments = token.split(".");
      if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) return null;
      const [encodedHeader, encodedClaims, encodedSignature] = segments as [string, string, string];
      const header = decodeJson(encodedHeader);
      if (
        !isRecord(header) ||
        !hasExactKeys(header, ["alg", "typ"]) ||
        header.alg !== this.#algorithm ||
        header.typ !== JWT_TYPE
      ) {
        return null;
      }

      const signature = decodeBase64Url(encodedSignature);
      if (!signature || signature.byteLength !== 32) return null;
      const signingInput = `${encodedHeader}.${encodedClaims}`;
      const verified = await crypto.subtle.verify(
        "HMAC",
        await this.#key,
        ownedArrayBuffer(signature),
        new TextEncoder().encode(signingInput),
      );
      if (!verified) return null;

      const claims = decodeJson(encodedClaims);
      const now = this.#now();
      return Number.isInteger(now) && claimsAreValid(claims, now) ? claims : null;
    } catch {
      return null;
    }
  }
}

export const tokenPolicy = Object.freeze({
  algorithm: JWT_ALGORITHM,
  audience: TOKEN_AUDIENCE,
  clockSkewSeconds: CLOCK_SKEW_SECONDS,
  claimVersion: TOKEN_CLAIM_VERSION,
  issuer: TOKEN_ISSUER,
  ttlSeconds: ACCESS_TOKEN_TTL_SECONDS,
});
