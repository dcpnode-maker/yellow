import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "gb1" as const;
const KEY_DOMAIN = "yellow:guest-booking:key:v1";
const MAX_TTL_SECONDS = 900;
const MAX_TOKEN_BYTES = 24_576;
const MAX_PAYLOAD_BYTES = 16_384;
const MAX_JSON_DEPTH = 32;
const MAX_CONTAINER_WIDTH = 256;
const PURPOSE_MAX_TTL_SECONDS: Readonly<Record<GuestBookingTokenPurpose, number>> = {
  session: 900,
  quote: 300,
  hold: 900,
};
const PURPOSES = new Set(["session", "quote", "hold"]);
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const ENVELOPE_KEYS = ["v", "purpose", "iat", "exp", "payload"] as const;

export type GuestBookingTokenPurpose = "session" | "quote" | "hold";

export interface GuestBookingToken {
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface GuestBookingTokenSignerOptions {
  /** Current time in epoch milliseconds. */
  readonly now?: () => number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]);
}

function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function decodeBase64Url(value: string): Buffer | null {
  if (!BASE64URL.test(value)) return null;
  const decoded = Buffer.from(value, "base64url");
  return decoded.toString("base64url") === value ? decoded : null;
}

function utf8(value: string): Buffer {
  return Buffer.from(value, "utf8");
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

/**
 * Validate data-only JSON before stringify can invoke accessors or toJSON hooks.
 * Returning the encoded snapshot ensures callers cannot mutate issued authority.
 */
function encodePayload(value: unknown): string {
  if (!isRecord(value) || (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)) {
    throw new Error("Guest-booking token payload must be a plain object");
  }
  const ancestors = new Set<object>();
  const visit = (item: unknown, depth: number): void => {
    if (depth > MAX_JSON_DEPTH) throw new Error("Guest-booking token payload is too deep");
    if (item === null || typeof item === "string" || typeof item === "boolean") return;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new Error("Guest-booking token payload numbers must be finite");
      return;
    }
    if (typeof item !== "object") throw new Error("Guest-booking token payload must contain only JSON values");
    if (ancestors.has(item)) throw new Error("Guest-booking token payload must not contain cycles");
    const array = Array.isArray(item);
    const prototype = Object.getPrototypeOf(item);
    if ((array && prototype !== Array.prototype) ||
        (!array && prototype !== Object.prototype && prototype !== null)) {
      throw new Error("Guest-booking token payload must use plain JSON containers");
    }
    if (Object.getOwnPropertySymbols(item).length !== 0) {
      throw new Error("Guest-booking token payload must not contain symbol properties");
    }
    const descriptors = Object.getOwnPropertyDescriptors(item);
    const names = Object.keys(descriptors).filter((name) => name !== "length");
    if (names.length > MAX_CONTAINER_WIDTH || names.some((name) => {
      const descriptor = descriptors[name]!;
      return descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true;
    })) {
      throw new Error("Guest-booking token payload contains unsupported properties");
    }
    if (array && (names.length !== item.length || names.some((name, index) => name !== String(index)) ||
        Object.getOwnPropertyNames(item).length !== item.length + 1)) {
      throw new Error("Guest-booking token payload arrays must be dense");
    }
    if (!array && Object.getOwnPropertyNames(item).length !== names.length) {
      throw new Error("Guest-booking token payload contains unsupported properties");
    }
    ancestors.add(item);
    try {
      for (const name of names) visit(descriptors[name]!.value, depth + 1);
    } finally {
      ancestors.delete(item);
    }
  };
  visit(value, 0);
  const encoded = JSON.stringify(value);
  if (Buffer.byteLength(encoded, "utf8") > MAX_PAYLOAD_BYTES) {
    throw new Error("Guest-booking token payload is too large");
  }
  return encoded;
}

function exactEnvelope(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && hasExactKeys(value, ENVELOPE_KEYS) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

export class GuestBookingTokenSigner {
  readonly #key: Buffer;
  readonly #now: () => number;

  constructor(secret: string, options: GuestBookingTokenSignerOptions = {}) {
    if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
      throw new Error("Guest-booking token secret must contain at least 32 UTF-8 bytes");
    }
    this.#key = createHmac("sha256", utf8(secret)).update(KEY_DOMAIN, "utf8").digest();
    this.#now = options.now ?? Date.now;
  }

  issue(
    purpose: GuestBookingTokenPurpose,
    payload: Readonly<Record<string, unknown>>,
    ttlSeconds: number,
  ): string {
    if (!PURPOSES.has(purpose)) throw new Error("Guest-booking token purpose is invalid");
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > PURPOSE_MAX_TTL_SECONDS[purpose]) {
      throw new Error(`Guest-booking ${purpose} token TTL is outside its allowed range`);
    }
    const now = this.#now();
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("Guest-booking token clock is invalid");
    const issuedAt = Math.floor(now / 1_000);
    const expiresAt = issuedAt + ttlSeconds;
    if (!Number.isSafeInteger(expiresAt)) throw new Error("Guest-booking token expiry is invalid");
    const payloadJson = encodePayload(payload);
    const payloadSnapshot = JSON.parse(payloadJson) as Record<string, unknown>;
    const envelope = JSON.stringify({ v: 1, purpose, iat: issuedAt, exp: expiresAt, payload: payloadSnapshot });
    const encoded = encodeBase64Url(utf8(envelope));
    const signingInput = `${PREFIX}.${encoded}`;
    const signature = createHmac("sha256", this.#key).update(signingInput, "utf8").digest();
    const token = `${signingInput}.${encodeBase64Url(signature)}`;
    if (Buffer.byteLength(token, "utf8") > MAX_TOKEN_BYTES) {
      throw new Error("Guest-booking token is too large");
    }
    return token;
  }

  verify(purpose: GuestBookingTokenPurpose, token: string): GuestBookingToken | null {
    try {
      if (!PURPOSES.has(purpose) || typeof token !== "string" ||
          Buffer.byteLength(token, "utf8") > MAX_TOKEN_BYTES) return null;
      const parts = token.split(".");
      if (parts.length !== 3 || parts[0] !== PREFIX) return null;
      const encoded = parts[1]!;
      const suppliedDigest = decodeBase64Url(parts[2]!);
      if (!suppliedDigest || suppliedDigest.byteLength !== 32) return null;
      const expectedDigest = createHmac("sha256", this.#key).update(`${PREFIX}.${encoded}`, "utf8").digest();
      if (!timingSafeEqual(suppliedDigest, expectedDigest)) return null;

      const envelopeBytes = decodeBase64Url(encoded);
      if (!envelopeBytes) return null;
      const envelopeJson = new TextDecoder("utf-8", { fatal: true }).decode(envelopeBytes);
      const envelope = JSON.parse(envelopeJson) as unknown;
      if (!exactEnvelope(envelope) || envelope.v !== 1 || envelope.purpose !== purpose ||
          !Number.isSafeInteger(envelope.iat) || !Number.isSafeInteger(envelope.exp) ||
          !isRecord(envelope.payload)) return null;
      if (JSON.stringify(envelope) !== envelopeJson) return null;
      const issuedAt = envelope.iat as number;
      const expiresAt = envelope.exp as number;
      if (issuedAt < 0 || expiresAt <= issuedAt ||
          expiresAt - issuedAt > Math.min(MAX_TTL_SECONDS, PURPOSE_MAX_TTL_SECONDS[purpose])) return null;
      const now = this.#now();
      if (!Number.isSafeInteger(now) || now < 0) return null;
      const nowSeconds = Math.floor(now / 1_000);
      if (issuedAt > nowSeconds || nowSeconds >= expiresAt) return null;
      const payloadJson = encodePayload(envelope.payload);
      if (Buffer.byteLength(payloadJson, "utf8") > MAX_PAYLOAD_BYTES) return null;
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      return Object.freeze({ issuedAt, expiresAt, payload: deepFreeze(payload) });
    } catch {
      return null;
    }
  }
}
