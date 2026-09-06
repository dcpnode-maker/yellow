import { beforeAll, describe, expect, test } from "bun:test";
import { createPublicKey } from "node:crypto";

import type { FiscalExactJsonValue } from "../src/contexts/tax-fiscal/fiscal-exact-json";
import {
  FISCAL_SIGNED_JWS_LIMITS,
  createFiscalSignedJwsVerifier,
  type FiscalSignedJwsVerifier,
} from "../src/contexts/tax-fiscal/fiscal-signed-jws";

const encoder = new TextEncoder();
const NOW = 1_800_000_000_000;
const NOT_BEFORE = NOW - 10_000;
const NOT_AFTER = NOW + 10_000;
const X5T_A = base64Url(Uint8Array.from({ length: 20 }, (_, index) => index + 1));
const X5T_B = base64Url(Uint8Array.from({ length: 20 }, (_, index) => index + 21));

let rsa2048: CryptoKeyPair;
let wrongRsa2048: CryptoKeyPair;
let rsa3072: CryptoKeyPair;
let ec256: CryptoKeyPair;
let spki2048 = "";
let wrongSpki2048 = "";
let spki3072 = "";
let ecSpki = "";

beforeAll(async () => {
  [rsa2048, wrongRsa2048, rsa3072, ec256] = await Promise.all([
    crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]),
    crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]),
    crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 3072,
      publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]),
    crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]),
  ]);
  [spki2048, wrongSpki2048, spki3072, ecSpki] = await Promise.all([
    exportSpki(rsa2048.publicKey), exportSpki(wrongRsa2048.publicKey),
    exportSpki(rsa3072.publicKey), exportSpki(ec256.publicKey),
  ]);
}, 30_000);

interface TestKey {
  readonly id: string;
  readonly spkiDerBase64: string;
  readonly notBeforeUnixMs: number;
  readonly notAfterUnixMs: number;
  readonly x5t?: string;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Url(bytes: Uint8Array): string {
  return base64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function trust(keys: readonly TestKey[], version = "yellow-test-trust-v1"): string {
  return JSON.stringify({ version, keys });
}

function key(id: string, spkiDerBase64: string, x5t?: string): TestKey {
  return { id, spkiDerBase64, notBeforeUnixMs: NOT_BEFORE, notAfterUnixMs: NOT_AFTER, ...(x5t ? { x5t } : {}) };
}

async function exportSpki(publicKey: CryptoKey): Promise<string> {
  return base64(new Uint8Array(await crypto.subtle.exportKey("spki", publicKey)));
}

async function verifier(source = trust([key("rsa-2048", spki2048, X5T_A)])): Promise<FiscalSignedJwsVerifier> {
  const result = await createFiscalSignedJwsVerifier(source);
  if (!result.ok) throw new Error(`test trust bundle failed: ${result.error.code}`);
  return result.value;
}

async function compact(
  pair: CryptoKeyPair,
  headerText: string,
  payloadText: string,
): Promise<string> {
  const header = base64Url(encoder.encode(headerText));
  const payload = base64Url(encoder.encode(payloadText));
  const signingInput = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", pair.privateKey, encoder.encode(signingInput),
  ));
  return `${signingInput}.${base64Url(signature)}`;
}

async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer)), byte =>
    byte.toString(16).padStart(2, "0")).join("");
}

async function factoryCode(source: unknown): Promise<string> {
  const result = await createFiscalSignedJwsVerifier(source);
  if (result.ok) throw new Error("invalid trust bundle unexpectedly succeeded");
  return result.error.code;
}

async function verifyCode(
  target: FiscalSignedJwsVerifier,
  token: unknown,
  instant: unknown = NOW,
): Promise<string> {
  const result = await target.verify(token, instant);
  if (result.ok) throw new Error("invalid signed JWS unexpectedly succeeded");
  return result.error.code;
}

function expectDeeplyFrozen(value: FiscalExactJsonValue): void {
  expect(Object.isFrozen(value)).toBe(true);
  if (value.kind === "array") {
    expect(Object.isFrozen(value.items)).toBe(true);
    for (const item of value.items) expectDeeplyFrozen(item);
  } else if (value.kind === "object") {
    expect(Object.getPrototypeOf(value.members)).toBeNull();
    expect(Object.isFrozen(value.members)).toBe(true);
    for (const member of Object.values(value.members)) expectDeeplyFrozen(member);
  }
}

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.byteLength; }
  return result;
}

function derLength(length: number): Uint8Array {
  if (length < 128) return new Uint8Array([length]);
  const bytes: number[] = [];
  for (let value = length; value > 0; value = Math.floor(value / 256)) bytes.unshift(value & 0xff);
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function der(tag: number, content: Uint8Array): Uint8Array {
  return concat(new Uint8Array([tag]), derLength(content.byteLength), content);
}

function syntheticRsaSpki(modulusBits: number, exponent = new Uint8Array([1, 0, 1]), salt = 1): string {
  const modulus = new Uint8Array(Math.ceil(modulusBits / 8));
  const highBits = modulusBits % 8;
  modulus[0] = highBits === 0 ? 0x80 : 1 << (highBits - 1);
  modulus[modulus.length - 1] = salt | 1;
  const positiveModulus = modulus[0]! >= 0x80 ? concat(new Uint8Array([0]), modulus) : modulus;
  const rsaPublicKey = der(0x30, concat(der(0x02, positiveModulus), der(0x02, exponent)));
  const rsaEncryption = new Uint8Array([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48,
    0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
  return base64(der(0x30, concat(rsaEncryption, der(0x03, concat(new Uint8Array([0]), rsaPublicKey)))));
}

function nodeModulusBits(spkiDerBase64: string): number | undefined {
  return createPublicKey({
    key: Uint8Array.from(atob(spkiDerBase64), character => character.charCodeAt(0)),
    format: "der",
    type: "spki",
  }).asymmetricKeyDetails?.modulusLength;
}

describe("Order440/Q206 private pinned RS256 JWS verification", () => {
  test("verifies original compact bytes and returns lossless signature-only evidence", async () => {
    const target = await verifier();
    const header = JSON.stringify({ alg: "RS256", typ: "JWT", kid: "rsa-2048", x5t: X5T_A });
    const payload = '{"AckNo":9223372036854775807,"amount":10000000000000000.01,"name":"नमस्ते"}';
    const token = await compact(rsa2048, header, payload);
    const result = await target.verify(token, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("genuine signature did not verify");
    expect(result.value).toMatchObject({
      kind: "fiscal_signed_jws_signature_only_v1",
      fiscalAcceptanceEstablished: false,
      bundleVersion: "yellow-test-trust-v1",
      keyId: "rsa-2048",
      compact: token,
      compactSha256: await sha256Hex(token),
      payloadText: payload,
    });
    expect(result.value.keySpkiSha256).toBe(await sha256Hex(new Uint8Array(
      await crypto.subtle.exportKey("spki", rsa2048.publicKey),
    )));
    expect(result.value.payload).toMatchObject({ kind: "object", members: {
      AckNo: { kind: "number", lexeme: "9223372036854775807" },
      amount: { kind: "number", lexeme: "10000000000000000.01" },
      name: { kind: "string", value: "नमस्ते" },
    } });
    expect(Object.isFrozen(target)).toBe(true);
    expect(Object.keys(target).sort()).toEqual(["bundleVersion", "kind", "verify"]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.value)).toBe(true);
    expectDeeplyFrozen(result.value.payload);
  });

  test("uses exact selectors and checks the selected half-open temporal window every time", async () => {
    const target = await verifier(trust([
      key("rsa-2048", spki2048, X5T_A), key("rsa-3072", spki3072, X5T_B),
    ], "rotation-2"));
    const payload = '{"status":"ACT"}';
    const kidOnly = await compact(rsa2048, JSON.stringify({ alg: "RS256", kid: "rsa-2048" }), payload);
    const thumbOnly = await compact(rsa2048, JSON.stringify({ alg: "RS256", x5t: X5T_A }), payload);
    const both = await compact(rsa2048, JSON.stringify({ alg: "RS256", kid: "rsa-2048", x5t: X5T_A }), payload);
    expect((await target.verify(kidOnly, NOT_BEFORE)).ok).toBe(true);
    expect((await target.verify(thumbOnly, NOT_AFTER - 1)).ok).toBe(true);
    expect((await target.verify(both, NOW)).ok).toBe(true);
    expect(await verifyCode(target, kidOnly, NOT_BEFORE - 1)).toBe("verification_failed");
    expect(await verifyCode(target, kidOnly, NOT_AFTER)).toBe("verification_failed");

    for (const header of [
      { alg: "RS256", kid: "unknown" },
      { alg: "RS256", x5t: base64Url(new Uint8Array(20)) },
      { alg: "RS256", kid: "rsa-2048", x5t: X5T_B },
      { alg: "RS256" },
    ]) {
      expect(await verifyCode(target, await compact(rsa2048, JSON.stringify(header), payload)))
        .toBe("verification_failed");
    }

    const single = await verifier();
    expect((await single.verify(await compact(rsa2048, '{"alg":"RS256"}', payload), NOW)).ok).toBe(true);
    const removed = await verifier(trust([key("rsa-3072", spki3072, X5T_B)], "rotation-3"));
    expect(await verifyCode(removed, kidOnly)).toBe("verification_failed");
    const wrongMaterial = await verifier(trust([key("rsa-2048", wrongSpki2048, X5T_A)]));
    expect(await verifyCode(wrongMaterial, kidOnly)).toBe("verification_failed");
  });

  test("rejects changed original header, payload and signature bytes", async () => {
    const target = await verifier();
    const header = '{"alg":"RS256","typ":"JWT","kid":"rsa-2048"}';
    const payload = '{"amount":10000000000000000.01}';
    const token = await compact(rsa2048, header, payload);
    const [headerSegment, payloadSegment, signatureSegment] = token.split(".") as [string, string, string];
    const changedHeader = base64Url(encoder.encode('{"typ":"JWT","alg":"RS256","kid":"rsa-2048"}'));
    const changedPayload = base64Url(encoder.encode('{"amount":10000000000000000.00}'));
    const standardSignature = signatureSegment.replaceAll("-", "+").replaceAll("_", "/");
    const signature = Uint8Array.from(atob(standardSignature + "=".repeat((4 - standardSignature.length % 4) % 4)),
      character => character.charCodeAt(0));
    signature[0]! ^= 1;
    expect(await verifyCode(target, `${changedHeader}.${payloadSegment}.${signatureSegment}`)).toBe("verification_failed");
    expect(await verifyCode(target, `${headerSegment}.${changedPayload}.${signatureSegment}`)).toBe("verification_failed");
    expect(await verifyCode(target, `${headerSegment}.${payloadSegment}.${base64Url(signature)}`)).toBe("verification_failed");
    expect(await verifyCode(target, `${headerSegment}.${payloadSegment}.${base64Url(signature.subarray(1))}`)).toBe("invalid_jws");
  });

  test("pins headers to RS256 and rejects every unsupported or ambiguous header", async () => {
    const target = await verifier();
    const payload = '{"ok":true}';
    const invalidHeaders: unknown[] = [
      [], "header", { alg: "none", kid: "rsa-2048" }, { alg: "HS256", kid: "rsa-2048" },
      { alg: "PS256", kid: "rsa-2048" }, { alg: "RS256", typ: "jwt", kid: "rsa-2048" },
      { alg: "RS256", kid: "rsa-2048", crit: [] }, { alg: "RS256", kid: "rsa-2048", b64: false },
      { alg: "RS256", kid: "rsa-2048", jwk: {} }, { alg: "RS256", kid: "rsa-2048", x5c: [] },
      { alg: "RS256", kid: "rsa-2048", jku: "https://untrusted.invalid" },
      { alg: "RS256", kid: "rsa-2048", x5u: "https://untrusted.invalid" },
    ];
    for (const header of invalidHeaders) {
      expect(await verifyCode(target, await compact(rsa2048, JSON.stringify(header), payload))).toBe("invalid_jws");
    }
    expect(await verifyCode(target, await compact(rsa2048,
      '{"alg":"RS256","kid":"rsa-2048","kid":"rsa-2048"}', payload))).toBe("invalid_jws");
  });

  test("requires canonical compact base64url, fatal UTF-8 and object JSON segments", async () => {
    const target = await verifier();
    const genuine = await compact(rsa2048, '{"alg":"RS256","kid":"rsa-2048"}', '{"ok":true}');
    const [header, payload, signature] = genuine.split(".") as [string, string, string];
    const invalidUtf8 = base64Url(new Uint8Array([0xff]));
    const bomHeader = base64Url(encoder.encode('\ufeff{"alg":"RS256","kid":"rsa-2048"}'));
    const bomPayload = base64Url(encoder.encode('\ufeff{"ok":true}'));
    for (const token of [
      `${header}=.${payload}.${signature}`, `${header}.${payload}.${signature}=`,
      ` ${header}.${payload}.${signature}`, `${header}..${signature}`, `${header}.${payload}.${signature}.extra`,
      `e31.${payload}.${signature}`, `${invalidUtf8}.${payload}.${signature}`,
      `${header}.${invalidUtf8}.${signature}`,
      `${bomHeader}.${payload}.${signature}`, `${header}.${bomPayload}.${signature}`,
      `${base64Url(encoder.encode("[]"))}.${payload}.${signature}`,
      `${header}.${base64Url(encoder.encode("null"))}.${signature}`,
      `${header}.${base64Url(encoder.encode('{"a":1,"\\u0061":2}'))}.${signature}`,
    ]) expect(await verifyCode(target, token)).toBe("invalid_jws");
    expect(await verifyCode(target, {}, NOW)).toBe("invalid_input");
    expect(await verifyCode(target, genuine, -1)).toBe("invalid_input");
    expect(await verifyCode(target, genuine, Number.MAX_SAFE_INTEGER + 1)).toBe("invalid_input");
  });

  test("accepts only immutable exact-shape trust JSON with safe temporal numbers", async () => {
    const validKey = key("rsa-2048", spki2048, X5T_A);
    const created = await createFiscalSignedJwsVerifier(trust([validKey], "v"));
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("valid trust bundle failed");
    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.value)).toBe(true);

    for (const source of [
      "", "[]", '{"version":"v","keys":[],"extra":true}',
      '{"version":"v","version":"v","keys":[]}',
      JSON.stringify({ version: "", keys: [validKey] }),
      JSON.stringify({ version: "v".repeat(129), keys: [validKey] }),
      JSON.stringify({ version: "line\nfeed", keys: [validKey] }),
      JSON.stringify({ version: "v", keys: [] }),
      JSON.stringify({ version: "v", keys: [{ ...validKey, id: "" }] }),
      JSON.stringify({ version: "v", keys: [{ ...validKey, id: "k".repeat(257) }] }),
      JSON.stringify({ version: "v", keys: [{ ...validKey, extra: true }] }),
      JSON.stringify({ version: "v", keys: [{ ...validKey, notBeforeUnixMs: -1 }] }),
      JSON.stringify({ version: "v", keys: [{ ...validKey, notBeforeUnixMs: 1.5 }] }),
      JSON.stringify({ version: "v", keys: [{ ...validKey, notBeforeUnixMs: NOT_AFTER }] }),
    ]) expect(await factoryCode(source)).toBe("invalid_trust_bundle");
    for (const input of [undefined, null, {}, [], new String(trust([validKey]))]) {
      expect(await factoryCode(input)).toBe("invalid_input");
    }
  });

  test("rejects duplicate key material and malformed selectors without fallback", async () => {
    const first = key("first", spki2048, X5T_A);
    const second = key("second", spki3072, X5T_B);
    for (const keys of [
      [first, { ...second, id: first.id }],
      [first, { ...second, spkiDerBase64: first.spkiDerBase64 }],
      [first, { ...second, x5t: first.x5t }],
    ]) expect(await factoryCode(trust(keys))).toBe("invalid_trust_bundle");
    for (const x5t of [base64Url(new Uint8Array(19)), base64Url(new Uint8Array(21)), `${X5T_A}=`, "not+url"] ) {
      expect(await factoryCode(trust([{ ...first, x5t }]))).toBe("invalid_trust_bundle");
    }
    const trailingDerAlias = base64(concat(
      Uint8Array.from(atob(spki2048), character => character.charCodeAt(0)),
      new Uint8Array([0, 1, 2, 3]),
    ));
    expect(await factoryCode(trust([key("trailing", trailingDerAlias)]))).toBe("invalid_trust_bundle");
    expect(await factoryCode(trust([first, key("same-key-alias", trailingDerAlias, X5T_B)])))
      .toBe("invalid_trust_bundle");
  });

  test("accepts only RSA 2048 through 4096 with exponent 65537 and SHA-256 verify usage", async () => {
    const boundarySpkis = new Map([
      2041, 2047, 2048, 2049, 4096, 4097,
    ].map(bits => [bits, syntheticRsaSpki(bits)] as const));
    for (const [bits, spki] of boundarySpkis) expect(nodeModulusBits(spki)).toBe(bits);
    expect((await createFiscalSignedJwsVerifier(trust([key("min", spki2048)]))).ok).toBe(true);
    expect((await createFiscalSignedJwsVerifier(trust([key("exact-min", boundarySpkis.get(2048)!)]))).ok).toBe(true);
    expect((await createFiscalSignedJwsVerifier(trust([key("nonaligned", boundarySpkis.get(2049)!)]))).ok).toBe(true);
    expect((await createFiscalSignedJwsVerifier(trust([key("middle", spki3072)]))).ok).toBe(true);
    expect((await createFiscalSignedJwsVerifier(trust([key("max", boundarySpkis.get(4096)!)]))).ok).toBe(true);
    for (const spki of [
      syntheticRsaSpki(1024), boundarySpkis.get(2041)!, boundarySpkis.get(2047)!, boundarySpkis.get(4097)!,
      syntheticRsaSpki(2048, new Uint8Array([3])),
      ecSpki, "%%%", base64(new Uint8Array([1, 2, 3])),
    ]) expect(await factoryCode(trust([key("bad", spki)]))).toBe("invalid_trust_bundle");
  });

  test("enforces one through eight distinct keys", async () => {
    const keys = Array.from({ length: FISCAL_SIGNED_JWS_LIMITS.maxKeys }, (_, index) =>
      key(`synthetic-${index}`, syntheticRsaSpki(2048, new Uint8Array([1, 0, 1]), index * 2 + 1)));
    expect((await createFiscalSignedJwsVerifier(trust(keys))).ok).toBe(true);
    expect(await factoryCode(trust([...keys, key("ninth", syntheticRsaSpki(2048, new Uint8Array([1, 0, 1]), 99))])))
      .toBe("resource_exhausted");
  });

  test("enforces exact trust JSON and SPKI DER byte boundaries", async () => {
    const base = trust([key("rsa-2048", spki2048)]);
    const { maxTrustJsonBytes, maxSpkiDerBytes } = FISCAL_SIGNED_JWS_LIMITS;
    const minus = base + " ".repeat(maxTrustJsonBytes - encoder.encode(base).byteLength - 1);
    const exact = `${minus} `;
    const plus = `${exact} `;
    expect(encoder.encode(minus)).toHaveLength(maxTrustJsonBytes - 1);
    expect(encoder.encode(exact)).toHaveLength(maxTrustJsonBytes);
    expect((await createFiscalSignedJwsVerifier(minus)).ok).toBe(true);
    expect((await createFiscalSignedJwsVerifier(exact)).ok).toBe(true);
    expect(await factoryCode(plus)).toBe("resource_exhausted");
    for (const size of [maxSpkiDerBytes - 1, maxSpkiDerBytes]) {
      expect(await factoryCode(trust([key("bad", base64(new Uint8Array(size)))])))
        .toBe("invalid_trust_bundle");
    }
    expect(await factoryCode(trust([key("bad", base64(new Uint8Array(maxSpkiDerBytes + 1)))])))
      .toBe("resource_exhausted");
  });

  test("enforces exact header and payload decoded-byte boundaries", async () => {
    const target = await verifier();
    const headerBase = '{"alg":"RS256","kid":"rsa-2048"}';
    const headerAt = headerBase.slice(0, -1) + " ".repeat(
      FISCAL_SIGNED_JWS_LIMITS.maxHeaderJsonBytes - encoder.encode(headerBase).byteLength,
    ) + "}";
    const headerBelow = headerAt.slice(0, -2) + "}";
    const headerAbove = headerAt.slice(0, -1) + "  }";
    expect((await target.verify(await compact(rsa2048, headerBelow, "{}"), NOW)).ok).toBe(true);
    expect((await target.verify(await compact(rsa2048, headerAt, "{}"), NOW)).ok).toBe(true);
    const headerTooLarge = `${base64Url(encoder.encode(headerAbove))}.${base64Url(encoder.encode("{}"))}.AA`;
    expect(await verifyCode(target, headerTooLarge)).toBe("resource_exhausted");

    const payloadBelow = `{${" ".repeat(FISCAL_SIGNED_JWS_LIMITS.maxPayloadJsonBytes - 3)}}`;
    const payloadAt = `{${" ".repeat(FISCAL_SIGNED_JWS_LIMITS.maxPayloadJsonBytes - 2)}}`;
    const payloadAbove = `{${" ".repeat(FISCAL_SIGNED_JWS_LIMITS.maxPayloadJsonBytes - 1)}}`;
    expect((await target.verify(await compact(rsa2048, headerBase, payloadBelow), NOW)).ok).toBe(true);
    expect((await target.verify(await compact(rsa2048, headerBase, payloadAt), NOW)).ok).toBe(true);
    const payloadTooLarge = `${base64Url(encoder.encode(headerBase))}.${base64Url(encoder.encode(payloadAbove))}.AA`;
    expect(await verifyCode(target, payloadTooLarge)).toBe("resource_exhausted");
  }, 30_000);

  test("enforces signature modulus length and the exact compact character ceiling", async () => {
    const target = await verifier();
    const token2048 = await compact(rsa2048, '{"alg":"RS256","kid":"rsa-2048"}', "{}");
    const token3072 = await compact(rsa3072, '{"alg":"RS256","kid":"rsa-3072"}', "{}");
    expect(base64Url(new Uint8Array(256))).toHaveLength(342);
    expect(base64Url(new Uint8Array(384))).toHaveLength(512);
    expect((await target.verify(token2048, NOW)).ok).toBe(true);
    expect((await (await verifier(trust([key("rsa-3072", spki3072)]))).verify(token3072, NOW)).ok).toBe(true);
    expect(await verifyCode(target, `${token2048.slice(0, token2048.lastIndexOf(".") + 1)}${
      base64Url(new Uint8Array(FISCAL_SIGNED_JWS_LIMITS.maxSignatureBytes + 1))
    }`)).toBe("resource_exhausted");

    const maxHeader = base64Url(encoder.encode(`{"alg":"RS256","kid":"max"${" ".repeat(
      FISCAL_SIGNED_JWS_LIMITS.maxHeaderJsonBytes - encoder.encode('{"alg":"RS256","kid":"max"}').byteLength,
    )}}`));
    const maxPayload = base64Url(encoder.encode(`{${" ".repeat(FISCAL_SIGNED_JWS_LIMITS.maxPayloadJsonBytes - 2)}}`));
    const maxSignature = base64Url(new Uint8Array(FISCAL_SIGNED_JWS_LIMITS.maxSignatureBytes));
    const ceiling = `${maxHeader}.${maxPayload}.${maxSignature}`;
    expect(ceiling).toHaveLength(1_404_249);
    expect(FISCAL_SIGNED_JWS_LIMITS.maxCompactChars).toBe(1_404_249);
    const maxTarget = await verifier(trust([key("max", syntheticRsaSpki(4096))]));
    expect(await verifyCode(maxTarget, ceiling)).toBe("verification_failed");
    expect(await verifyCode(maxTarget, `${ceiling}A`)).toBe("resource_exhausted");
  }, 30_000);

  test("returns only frozen sanitized errors without token, key or exception detail", async () => {
    const badTrust = await createFiscalSignedJwsVerifier('{"version":"secret-bundle","keys":[]}');
    expect(badTrust).toEqual({ ok: false, error: {
      code: "invalid_trust_bundle", message: "fiscal JWS trust bundle is invalid",
    } });
    expect(Object.isFrozen(badTrust)).toBe(true);
    if (badTrust.ok) throw new Error("bad trust unexpectedly succeeded");
    expect(Object.isFrozen(badTrust.error)).toBe(true);
    expect(JSON.stringify(badTrust)).not.toContain("secret-bundle");

    const target = await verifier();
    const result = await target.verify("credential.payload.signature", NOW);
    expect(result).toEqual({ ok: false, error: {
      code: "invalid_jws", message: "fiscal signed JWS is invalid",
    } });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.ok) throw new Error("bad token unexpectedly succeeded");
    expect(Object.isFrozen(result.error)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("credential");
  });
});
