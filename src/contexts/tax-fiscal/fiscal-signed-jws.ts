import { createPublicKey } from "node:crypto";

import {
  decodeFiscalExactJson,
  type FiscalExactJsonValue,
} from "./fiscal-exact-json";

export const FISCAL_SIGNED_JWS_LIMITS = Object.freeze({
  maxTrustJsonBytes: 32 * 1024,
  minKeys: 1,
  maxKeys: 8,
  maxSpkiDerBytes: 2048,
  maxHeaderJsonBytes: 4 * 1024,
  maxPayloadJsonBytes: 1024 * 1024,
  minSignatureBytes: 256,
  maxSignatureBytes: 512,
  maxCompactChars: 1_404_249,
  minRsaModulusBits: 2048,
  maxRsaModulusBits: 4096,
} as const);

export type FiscalSignedJwsFactoryErrorCode =
  | "invalid_input"
  | "invalid_trust_bundle"
  | "resource_exhausted";

export type FiscalSignedJwsVerificationErrorCode =
  | "invalid_input"
  | "invalid_jws"
  | "resource_exhausted"
  | "verification_failed";

export interface FiscalSignedJwsError<Code extends string> {
  readonly code: Code;
  readonly message: string;
}

export interface FiscalSignedJwsSignatureEvidence {
  readonly kind: "fiscal_signed_jws_signature_only_v1";
  /** Signature verification alone never establishes fiscal acceptance or document binding. */
  readonly fiscalAcceptanceEstablished: false;
  readonly bundleVersion: string;
  readonly keyId: string;
  readonly keySpkiSha256: string;
  readonly compact: string;
  readonly compactSha256: string;
  readonly payloadText: string;
  readonly payload: FiscalExactJsonValue;
}

export type FiscalSignedJwsVerificationResult = Readonly<
  | { readonly ok: true; readonly value: Readonly<FiscalSignedJwsSignatureEvidence> }
  | { readonly ok: false; readonly error: Readonly<FiscalSignedJwsError<FiscalSignedJwsVerificationErrorCode>> }
>;

export interface FiscalSignedJwsVerifier {
  readonly kind: "fiscal_signed_jws_verifier_v1";
  readonly bundleVersion: string;
  /** The instant must come from authenticated runtime policy, never an untrusted request. */
  verify(compact: unknown, verificationUnixMs: unknown): Promise<FiscalSignedJwsVerificationResult>;
}

export type FiscalSignedJwsVerifierFactoryResult = Readonly<
  | { readonly ok: true; readonly value: Readonly<FiscalSignedJwsVerifier> }
  | { readonly ok: false; readonly error: Readonly<FiscalSignedJwsError<FiscalSignedJwsFactoryErrorCode>> }
>;

interface ImportedTrustKey {
  readonly id: string;
  readonly spkiSha256: string;
  readonly x5t?: string;
  readonly notBeforeUnixMs: number;
  readonly notAfterUnixMs: number;
  readonly modulusBytes: number;
  readonly publicKey: CryptoKey;
}

interface TrustKeySnapshot {
  readonly id: string;
  readonly spki: Uint8Array;
  readonly x5t?: string;
  readonly notBeforeUnixMs: number;
  readonly notAfterUnixMs: number;
}

type ExactObject = Extract<FiscalExactJsonValue, { readonly kind: "object" }>;

class InvalidFiscalSignedJws extends Error {}
class FiscalSignedJwsResourceExhausted extends Error {}

function invalid(): never {
  throw new InvalidFiscalSignedJws();
}

function exhausted(): never {
  throw new FiscalSignedJwsResourceExhausted();
}

function frozenFailure<Code extends string>(code: Code, message: string): Readonly<{
  readonly ok: false;
  readonly error: Readonly<FiscalSignedJwsError<Code>>;
}> {
  return Object.freeze({ ok: false as const, error: Object.freeze({ code, message }) });
}

function isPrintableAscii(value: string, maximum: number): boolean {
  if (value.length < 1 || value.length > maximum) return false;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit < 0x20 || unit > 0x7e) return false;
  }
  return true;
}

function exactObject(value: FiscalExactJsonValue, required: readonly string[], optional: readonly string[] = []): ExactObject {
  if (value.kind !== "object") return invalid();
  const names = Object.keys(value.members);
  const allowed = new Set([...required, ...optional]);
  if (names.length < required.length || names.length > allowed.size
      || required.some(name => !Object.hasOwn(value.members, name))
      || names.some(name => !allowed.has(name))) return invalid();
  return value;
}

function exactString(value: FiscalExactJsonValue | undefined): string {
  if (value?.kind !== "string") return invalid();
  return value.value;
}

function exactSafeMilliseconds(value: FiscalExactJsonValue | undefined): number {
  if (value?.kind !== "number" || !/^(?:0|[1-9][0-9]*)$/u.test(value.lexeme)) return invalid();
  const integer = BigInt(value.lexeme);
  if (integer > BigInt(Number.MAX_SAFE_INTEGER)) return invalid();
  return Number(integer);
}

function bytesFromBinary(binary: string): Uint8Array {
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function decodeCanonicalBase64(value: string): Uint8Array {
  if (value.length === 0 || value.length % 4 !== 0
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) return invalid();
  try {
    const binary = atob(value);
    if (btoa(binary) !== value) return invalid();
    return bytesFromBinary(binary);
  } catch {
    return invalid();
  }
}

function decodeCanonicalBase64Url(value: string): Uint8Array {
  if (value.length === 0 || value.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/u.test(value)) return invalid();
  try {
    const standard = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = standard + "=".repeat((4 - standard.length % 4) % 4);
    const binary = atob(padded);
    const canonical = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
    if (canonical !== value) return invalid();
    return bytesFromBinary(binary);
  } catch {
    return invalid();
  }
}

function textFromUtf8(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return invalid();
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return invalid();
  }
}

function sha256Hex(bytes: Uint8Array): Promise<string> {
  return crypto.subtle.digest("SHA-256", ownedArrayBuffer(bytes)).then(digest =>
    Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join(""));
}

function base64UrlMaximum(byteLength: number): number {
  return Math.ceil(byteLength * 4 / 3);
}

function snapshotTrustBundle(source: string): Readonly<{ version: string; keys: readonly TrustKeySnapshot[] }> {
  const decoded = decodeFiscalExactJson(source);
  if (!decoded.ok) {
    if (decoded.error.code === "resource_exhausted") return exhausted();
    return invalid();
  }
  const root = exactObject(decoded.value, ["version", "keys"]);
  const version = exactString(root.members.version);
  if (!isPrintableAscii(version, 128)) return invalid();
  const keyValues = root.members.keys;
  if (keyValues?.kind !== "array" || keyValues.items.length < FISCAL_SIGNED_JWS_LIMITS.minKeys) return invalid();
  if (keyValues.items.length > FISCAL_SIGNED_JWS_LIMITS.maxKeys) return exhausted();

  const ids = new Set<string>();
  const spkis = new Set<string>();
  const selectors = new Set<string>();
  const keys: TrustKeySnapshot[] = [];
  for (const value of keyValues.items) {
    const row = exactObject(value, ["id", "spkiDerBase64", "notBeforeUnixMs", "notAfterUnixMs"], ["x5t"]);
    const id = exactString(row.members.id);
    const spkiDerBase64 = exactString(row.members.spkiDerBase64);
    const notBeforeUnixMs = exactSafeMilliseconds(row.members.notBeforeUnixMs);
    const notAfterUnixMs = exactSafeMilliseconds(row.members.notAfterUnixMs);
    if (!isPrintableAscii(id, 256) || notBeforeUnixMs >= notAfterUnixMs || ids.has(id)) return invalid();
    if (spkiDerBase64.length > 4 * Math.ceil(FISCAL_SIGNED_JWS_LIMITS.maxSpkiDerBytes / 3)) return exhausted();
    const spki = decodeCanonicalBase64(spkiDerBase64);
    if (spki.byteLength > FISCAL_SIGNED_JWS_LIMITS.maxSpkiDerBytes) return exhausted();
    if (spkis.has(spkiDerBase64)) return invalid();
    let x5t: string | undefined;
    if (Object.hasOwn(row.members, "x5t")) {
      x5t = exactString(row.members.x5t);
      const selector = decodeCanonicalBase64Url(x5t);
      if (selector.byteLength !== 20 || selectors.has(x5t)) return invalid();
      selectors.add(x5t);
    }
    ids.add(id);
    spkis.add(spkiDerBase64);
    keys.push(Object.freeze({ id, spki, notBeforeUnixMs, notAfterUnixMs, ...(x5t ? { x5t } : {}) }));
  }
  return Object.freeze({ version, keys: Object.freeze(keys) });
}

async function importTrustKey(value: TrustKeySnapshot): Promise<ImportedTrustKey> {
  const nodePublicKey = createPublicKey({
    key: ownedArrayBuffer(value.spki),
    format: "der",
    type: "spki",
  });
  const canonicalSpki = Uint8Array.from(nodePublicKey.export({ format: "der", type: "spki" }));
  if (!equalBytes(value.spki, canonicalSpki)) return invalid();
  const actualModulusBits = nodePublicKey.asymmetricKeyDetails?.modulusLength;
  const actualPublicExponent = nodePublicKey.asymmetricKeyDetails?.publicExponent;
  if (nodePublicKey.asymmetricKeyType !== "rsa" || actualModulusBits === undefined
      || actualPublicExponent !== 65_537n
      || actualModulusBits < FISCAL_SIGNED_JWS_LIMITS.minRsaModulusBits
      || actualModulusBits > FISCAL_SIGNED_JWS_LIMITS.maxRsaModulusBits) return invalid();
  const publicKey = await crypto.subtle.importKey(
    "spki",
    ownedArrayBuffer(value.spki),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const algorithm = publicKey.algorithm as RsaHashedKeyAlgorithm;
  const exponent = algorithm.publicExponent;
  if (publicKey.type !== "public" || publicKey.extractable || publicKey.usages.length !== 1
      || publicKey.usages[0] !== "verify" || algorithm.name !== "RSASSA-PKCS1-v1_5"
      || algorithm.hash.name !== "SHA-256"
      || Math.ceil(algorithm.modulusLength / 8) !== Math.ceil(actualModulusBits / 8)
      || exponent.byteLength !== 3 || exponent[0] !== 1 || exponent[1] !== 0 || exponent[2] !== 1) return invalid();
  return Object.freeze({
    id: value.id,
    spkiSha256: await sha256Hex(value.spki),
    ...(value.x5t ? { x5t: value.x5t } : {}),
    notBeforeUnixMs: value.notBeforeUnixMs,
    notAfterUnixMs: value.notAfterUnixMs,
    modulusBytes: Math.ceil(actualModulusBits / 8),
    publicKey,
  });
}

function snapshotHeader(value: FiscalExactJsonValue): Readonly<{
  kid?: string;
  x5t?: string;
}> {
  const header = exactObject(value, ["alg"], ["typ", "kid", "x5t"]);
  if (exactString(header.members.alg) !== "RS256") return invalid();
  if (Object.hasOwn(header.members, "typ") && exactString(header.members.typ) !== "JWT") return invalid();
  let kid: string | undefined;
  if (Object.hasOwn(header.members, "kid")) {
    kid = exactString(header.members.kid);
    if (!isPrintableAscii(kid, 256)) return invalid();
  }
  let x5t: string | undefined;
  if (Object.hasOwn(header.members, "x5t")) {
    x5t = exactString(header.members.x5t);
    if (decodeCanonicalBase64Url(x5t).byteLength !== 20) return invalid();
  }
  return Object.freeze({ ...(kid ? { kid } : {}), ...(x5t ? { x5t } : {}) });
}

function selectKey(
  keys: readonly ImportedTrustKey[],
  byId: ReadonlyMap<string, ImportedTrustKey>,
  byX5t: ReadonlyMap<string, ImportedTrustKey>,
  header: Readonly<{ kid?: string; x5t?: string }>,
): ImportedTrustKey | null {
  const idKey = header.kid === undefined ? undefined : byId.get(header.kid);
  const thumbKey = header.x5t === undefined ? undefined : byX5t.get(header.x5t);
  if (header.kid !== undefined && idKey === undefined) return null;
  if (header.x5t !== undefined && thumbKey === undefined) return null;
  if (idKey && thumbKey && idKey !== thumbKey) return null;
  if (idKey) return idKey;
  if (thumbKey) return thumbKey;
  return keys.length === 1 ? keys[0]! : null;
}

async function verifyCompact(
  bundleVersion: string,
  keys: readonly ImportedTrustKey[],
  byId: ReadonlyMap<string, ImportedTrustKey>,
  byX5t: ReadonlyMap<string, ImportedTrustKey>,
  compactValue: unknown,
  verificationUnixMsValue: unknown,
): Promise<FiscalSignedJwsVerificationResult> {
  if (typeof compactValue !== "string" || typeof verificationUnixMsValue !== "number"
      || !Number.isSafeInteger(verificationUnixMsValue) || verificationUnixMsValue < 0) {
    return frozenFailure("invalid_input", "fiscal signed JWS verification input is invalid");
  }
  if (compactValue.length > FISCAL_SIGNED_JWS_LIMITS.maxCompactChars) {
    return frozenFailure("resource_exhausted", "fiscal signed JWS resource limit exceeded");
  }
  try {
    const firstDot = compactValue.indexOf(".");
    const secondDot = firstDot < 0 ? -1 : compactValue.indexOf(".", firstDot + 1);
    if (firstDot <= 0 || secondDot <= firstDot + 1 || secondDot === compactValue.length - 1
        || compactValue.indexOf(".", secondDot + 1) !== -1) return invalid();
    const headerSegment = compactValue.slice(0, firstDot);
    const payloadSegment = compactValue.slice(firstDot + 1, secondDot);
    const signatureSegment = compactValue.slice(secondDot + 1);
    if (headerSegment.length > base64UrlMaximum(FISCAL_SIGNED_JWS_LIMITS.maxHeaderJsonBytes)
        || payloadSegment.length > base64UrlMaximum(FISCAL_SIGNED_JWS_LIMITS.maxPayloadJsonBytes)
        || signatureSegment.length > base64UrlMaximum(FISCAL_SIGNED_JWS_LIMITS.maxSignatureBytes)) return exhausted();

    const headerBytes = decodeCanonicalBase64Url(headerSegment);
    const payloadBytes = decodeCanonicalBase64Url(payloadSegment);
    const signature = decodeCanonicalBase64Url(signatureSegment);
    if (headerBytes.byteLength > FISCAL_SIGNED_JWS_LIMITS.maxHeaderJsonBytes
        || payloadBytes.byteLength > FISCAL_SIGNED_JWS_LIMITS.maxPayloadJsonBytes
        || signature.byteLength > FISCAL_SIGNED_JWS_LIMITS.maxSignatureBytes) return exhausted();
    if (signature.byteLength < FISCAL_SIGNED_JWS_LIMITS.minSignatureBytes) return invalid();
    const headerText = textFromUtf8(headerBytes);
    const payloadText = textFromUtf8(payloadBytes);
    const decodedHeader = decodeFiscalExactJson(headerText);
    const decodedPayload = decodeFiscalExactJson(payloadText);
    if (!decodedHeader.ok || !decodedPayload.ok) {
      if ((!decodedHeader.ok && decodedHeader.error.code === "resource_exhausted")
          || (!decodedPayload.ok && decodedPayload.error.code === "resource_exhausted")) return exhausted();
      return invalid();
    }
    const header = snapshotHeader(decodedHeader.value);
    if (decodedPayload.value.kind !== "object") return invalid();
    const selected = selectKey(keys, byId, byX5t, header);
    if (!selected || verificationUnixMsValue < selected.notBeforeUnixMs
        || verificationUnixMsValue >= selected.notAfterUnixMs) {
      return frozenFailure("verification_failed", "fiscal signed JWS verification failed");
    }

    if (signature.byteLength !== selected.modulusBytes) return invalid();
    const signingBytes = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
    let verified = false;
    try {
      verified = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5", selected.publicKey,
        ownedArrayBuffer(signature), ownedArrayBuffer(signingBytes),
      );
    } catch {
      verified = false;
    }
    if (!verified) return frozenFailure("verification_failed", "fiscal signed JWS verification failed");
    const compactSha256 = await sha256Hex(new TextEncoder().encode(compactValue));
    return Object.freeze({
      ok: true as const,
      value: Object.freeze({
        kind: "fiscal_signed_jws_signature_only_v1" as const,
        fiscalAcceptanceEstablished: false as const,
        bundleVersion,
        keyId: selected.id,
        keySpkiSha256: selected.spkiSha256,
        compact: compactValue,
        compactSha256,
        payloadText,
        payload: decodedPayload.value,
      }),
    });
  } catch (error) {
    if (error instanceof FiscalSignedJwsResourceExhausted) {
      return frozenFailure("resource_exhausted", "fiscal signed JWS resource limit exceeded");
    }
    return frozenFailure("invalid_jws", "fiscal signed JWS is invalid");
  }
}

/** Trust JSON must be supplied by separately authenticated configuration, never token or HTTP input. */
export async function createFiscalSignedJwsVerifier(input: unknown): Promise<FiscalSignedJwsVerifierFactoryResult> {
  if (typeof input !== "string") {
    return frozenFailure("invalid_input", "fiscal JWS trust bundle input is invalid");
  }
  if (input.length > FISCAL_SIGNED_JWS_LIMITS.maxTrustJsonBytes
      || new TextEncoder().encode(input).byteLength > FISCAL_SIGNED_JWS_LIMITS.maxTrustJsonBytes) {
    return frozenFailure("resource_exhausted", "fiscal JWS trust bundle resource limit exceeded");
  }
  try {
    const snapshot = snapshotTrustBundle(input);
    const keys = Object.freeze(await Promise.all(snapshot.keys.map(importTrustKey)));
    const byId = new Map(keys.map(value => [value.id, value] as const));
    const byX5t = new Map(keys.flatMap(value => value.x5t ? [[value.x5t, value] as const] : []));
    const verifier: FiscalSignedJwsVerifier = Object.freeze({
      kind: "fiscal_signed_jws_verifier_v1" as const,
      bundleVersion: snapshot.version,
      verify(compact: unknown, verificationUnixMs: unknown) {
        return verifyCompact(snapshot.version, keys, byId, byX5t, compact, verificationUnixMs);
      },
    });
    return Object.freeze({ ok: true as const, value: verifier });
  } catch (error) {
    if (error instanceof FiscalSignedJwsResourceExhausted) {
      return frozenFailure("resource_exhausted", "fiscal JWS trust bundle resource limit exceeded");
    }
    return frozenFailure("invalid_trust_bundle", "fiscal JWS trust bundle is invalid");
  }
}
