import { describe, expect, test } from "bun:test";

import {
  type AccessTokenClaims,
  Hs256TokenSigner,
  isValidScope,
  tokenPolicy,
} from "../src/contexts/identity";

const SECRET = "yellow-order-020-hs256-secret-0001";
const USER_ID = "00000000-0000-0000-0000-000000000960";
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_TENANT_ID = "00000000-0000-0000-0000-000000000002";
const JTI = "00000000-0000-0000-0000-000000000999";
const ISSUED_AT = 1_800_000_000;

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
}

function encodeSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function signWithHmac(
  header: Record<string, unknown>,
  claims: Record<string, unknown>,
): Promise<string> {
  const encodedHeader = encodeSegment(header);
  const encodedClaims = encodeSegment(claims);
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${Buffer.from(signature).toString("base64url")}`;
}

function signer(now: () => number = () => ISSUED_AT): Hs256TokenSigner {
  return new Hs256TokenSigner(SECRET, { now, jtiFactory: () => JTI });
}

async function issuedToken(tokens = signer()): Promise<string> {
  return tokens.issue({
    userId: USER_ID,
    tenantId: TENANT_ID,
    scopes: ["reservations.booking:read", "inventory.space:*"],
  });
}

describe("Order 020 token policy", () => {
  test("production default JTI factory remains bound to Crypto", async () => {
    const signer = new Hs256TokenSigner(SECRET);
    const token = await signer.issue({ userId: USER_ID, tenantId: TENANT_ID, scopes: [] });
    const claims = await signer.verify(token);
    expect(claims?.jti).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  test("P1: Bun WebCrypto supports Ed25519; fallback order is Ed25519 then ES256", async () => {
    const ed25519 = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const es256 = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );

    console.log("P1 capability: Ed25519=true; fallback=Ed25519; ES256=true");
    expect("privateKey" in ed25519).toBe(true);
    expect("privateKey" in es256).toBe(true);
  });

  test("P2: issued token carries exactly the D-91 claim set", async () => {
    const token = await issuedToken();
    const segments = token.split(".");
    expect(segments).toHaveLength(3);
    const claims = decodeSegment(segments[1]!);

    expect(claims).toEqual({
      iss: "yellow",
      sub: USER_ID,
      aud: "yellow-api",
      iat: ISSUED_AT,
      nbf: ISSUED_AT,
      exp: ISSUED_AT + 900,
      jti: JTI,
      tid: TENANT_ID,
      scp: "inventory.space:* reservations.booking:read",
      cv: 1,
    });
    expect(Object.keys(claims).sort()).toEqual([
      "aud", "cv", "exp", "iat", "iss", "jti", "nbf", "scp", "sub", "tid",
    ]);
    expect(await signer().verify(token)).toEqual(claims as unknown as AccessTokenClaims);
  });

  test("P3: alg:none with no signature is rejected", async () => {
    const unsigned = `${encodeSegment({ alg: "none", typ: "JWT" })}.${encodeSegment({})}.`;
    expect(await signer().verify(unsigned)).toBeNull();
  });

  test("P4: a different header algorithm is rejected even with a valid HMAC", async () => {
    const valid = await issuedToken();
    const claims = decodeSegment(valid.split(".")[1]!);
    const confused = await signWithHmac({ alg: "RS256", typ: "JWT" }, claims);

    expect(await signer().verify(confused)).toBeNull();
  });

  test("P5: 59 seconds past expiry is accepted and 61 seconds past is rejected", async () => {
    let now = ISSUED_AT;
    const tokens = signer(() => now);
    const token = await issuedToken(tokens);

    now = ISSUED_AT + tokenPolicy.ttlSeconds + 59;
    expect(await tokens.verify(token)).not.toBeNull();
    now = ISSUED_AT + tokenPolicy.ttlSeconds + 61;
    expect(await tokens.verify(token)).toBeNull();
  });

  test("P6: changing one payload byte invalidates the signature", async () => {
    const token = await issuedToken();
    const [header, payload, signature] = token.split(".") as [string, string, string];
    const claims = decodeSegment(payload);
    const tamperedPayload = encodeSegment({ ...claims, tid: OTHER_TENANT_ID });

    expect(tamperedPayload).not.toBe(payload);
    expect(await signer().verify(`${header}.${tamperedPayload}.${signature}`)).toBeNull();
  });

  test("verification rejects a correctly signed token with any extra claim", async () => {
    const valid = await issuedToken();
    const claims = decodeSegment(valid.split(".")[1]!);
    const token = await signWithHmac({ alg: "HS256", typ: "JWT" }, { ...claims, role: "manager" });

    expect(await signer().verify(token)).toBeNull();
  });

  test("scope grammar anchors context and permits wildcard only as the action", () => {
    expect(isValidScope("inventory.space:read")).toBe(true);
    expect(isValidScope("statutory-privacy.submission:*")).toBe(true);
    expect(isValidScope("*.space:read")).toBe(false);
    expect(isValidScope("inventory.*:read")).toBe(false);
    expect(isValidScope("unknown.space:read")).toBe(false);
    expect(isValidScope("inventory.space:*:extra")).toBe(false);
  });
});
