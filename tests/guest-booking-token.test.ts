import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { GuestBookingTokenSigner, Hs256TokenSigner, type GuestBookingTokenPurpose } from "../src/contexts/identity";

const SECRET = "guest-booking-token-test-secret-with-at-least-32-bytes";
const KEY_DOMAIN = "yellow:guest-booking:key:v1";
const PURPOSES: readonly GuestBookingTokenPurpose[] = [
  "session", "quote", "hold", "public-session", "public-quote", "public-hold", "public-details",
];
const MAX_TTL: Readonly<Record<GuestBookingTokenPurpose, number>> = {
  session: 900,
  quote: 300,
  hold: 900,
  "public-session": 900,
  "public-quote": 300,
  "public-hold": 900,
  "public-details": 900,
};

function signRawEnvelopeJson(json: string): string {
  const key = createHmac("sha256", SECRET).update(KEY_DOMAIN, "utf8").digest();
  const encoded = Buffer.from(json, "utf8").toString("base64url");
  const signingInput = `gb1.${encoded}`;
  const signature = createHmac("sha256", key).update(signingInput, "utf8").digest("base64url");
  return `${signingInput}.${signature}`;
}

describe("GuestBookingTokenSigner", () => {
  test("issues compact purpose-bound tokens and returns immutable verified snapshots", () => {
    let now = Date.UTC(2026, 9, 1, 12, 0, 0, 456);
    const signer = new GuestBookingTokenSigner(SECRET, { now: () => now });
    const source = { invitation: "invite-1", nested: { plans: ["flex", "advance"] } };
    const token = signer.issue("session", source, 900);
    source.nested.plans.push("mutated");

    expect(token.split(".")).toHaveLength(3);
    expect(token.startsWith("gb1.")).toBe(true);
    const envelope = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8")) as Record<string, unknown>;
    expect(Object.keys(envelope).sort()).toEqual(["exp", "iat", "payload", "purpose", "v"]);
    expect(envelope.v).toBe(1);
    expect(envelope.purpose).toBe("session");
    expect(signer.verify("session", token)).toEqual({
      issuedAt: Math.floor(now / 1_000),
      expiresAt: Math.floor(now / 1_000) + 900,
      payload: { invitation: "invite-1", nested: { plans: ["flex", "advance"] } },
    });
    const verified = signer.verify("session", token)!;
    expect(Object.isFrozen(verified)).toBe(true);
    expect(Object.isFrozen(verified.payload)).toBe(true);
    expect(Object.isFrozen(verified.payload.nested)).toBe(true);
    expect(Object.isFrozen((verified.payload.nested as { plans: readonly string[] }).plans)).toBe(true);
    now += 900_000;
    expect(signer.verify("session", token)).toBeNull();
  });

  test("rejects purpose confusion, tampering and staff JWT-shaped tokens", () => {
    const signer = new GuestBookingTokenSigner(SECRET, { now: () => 1_800_000_000_000 });
    const token = signer.issue("quote", { session: "s-1" }, 300);
    expect(signer.verify("hold", token)).toBeNull();
    const [prefix, body, signature] = token.split(".");
    const tampered = `${prefix}.${body!.slice(0, -1)}${body!.endsWith("A") ? "B" : "A"}.${signature}`;
    expect(signer.verify("quote", tampered)).toBeNull();
    const publicToken = signer.issue("public-quote", { session: "public-s-1" }, 300);
    const [publicPrefix, publicBody, publicSignature] = publicToken.split(".");
    const tamperedPublic = `${publicPrefix}.${publicBody!.slice(0, -1)}${publicBody!.endsWith("A") ? "B" : "A"}.${publicSignature}`;
    expect(signer.verify("public-quote", tamperedPublic)).toBeNull();
    expect(signer.verify("quote", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzdGFmZiJ9.signature")).toBeNull();
    expect(signer.verify("quote", `gb2.${body}.${signature}`)).toBeNull();
  });

  test("every invitation and public purpose rejects every other signed purpose", () => {
    const signer = new GuestBookingTokenSigner(SECRET, { now: () => 1_800_000_000_000 });
    for (const purpose of PURPOSES) {
      const token = signer.issue(purpose, { purpose }, MAX_TTL[purpose]);
      expect(signer.verify(purpose, token)).not.toBeNull();
      for (const otherPurpose of PURPOSES) {
        if (otherPurpose !== purpose) expect(signer.verify(otherPurpose, token)).toBeNull();
      }
    }
  });

  test("enforces expiry, future-issued-at and TTL bounds", () => {
    let now = 1_800_000_000_000;
    const signer = new GuestBookingTokenSigner(SECRET, { now: () => now });
    expect(() => signer.issue("session", {}, 0)).toThrow();
    expect(() => signer.issue("session", {}, 901)).toThrow();
    expect(() => signer.issue("quote", {}, 301)).toThrow();
    expect(() => signer.issue("public-session", {}, 901)).toThrow();
    expect(() => signer.issue("public-quote", {}, 301)).toThrow();
    expect(() => signer.issue("public-hold", {}, 901)).toThrow();
    expect(() => signer.issue("public-details", {}, 901)).toThrow();
    expect(() => signer.issue("session", {}, 1.5)).toThrow();
    expect(() => signer.issue("session", {}, Number.MAX_SAFE_INTEGER + 1)).toThrow();

    const expired = signer.issue("hold", { hold: "h-1" }, 1);
    const expiredPublic = signer.issue("public-details", { session: "s-1" }, 1);
    now += 1_000;
    expect(signer.verify("hold", expired)).toBeNull();
    expect(signer.verify("public-details", expiredPublic)).toBeNull();

    now -= 1_000;
    const future = signRawEnvelopeJson(JSON.stringify({
      v: 1, purpose: "session", iat: Math.floor(now / 1_000) + 1,
      exp: Math.floor(now / 1_000) + 60, payload: {},
    }));
    expect(signer.verify("session", future)).toBeNull();
    const overlong = signRawEnvelopeJson(JSON.stringify({
      v: 1, purpose: "session", iat: Math.floor(now / 1_000),
      exp: Math.floor(now / 1_000) + 901, payload: {},
    }));
    expect(signer.verify("session", overlong)).toBeNull();
    const overlongQuote = signRawEnvelopeJson(JSON.stringify({
      v: 1, purpose: "quote", iat: Math.floor(now / 1_000),
      exp: Math.floor(now / 1_000) + 301, payload: {},
    }));
    expect(signer.verify("quote", overlongQuote)).toBeNull();
    const overlongPublicSession = signRawEnvelopeJson(JSON.stringify({
      v: 1, purpose: "public-session", iat: Math.floor(now / 1_000),
      exp: Math.floor(now / 1_000) + 901, payload: {},
    }));
    expect(signer.verify("public-session", overlongPublicSession)).toBeNull();
    const overlongPublicQuote = signRawEnvelopeJson(JSON.stringify({
      v: 1, purpose: "public-quote", iat: Math.floor(now / 1_000),
      exp: Math.floor(now / 1_000) + 301, payload: {},
    }));
    expect(signer.verify("public-quote", overlongPublicQuote)).toBeNull();
  });

  test("rejects short secrets, hostile payloads and size/depth/width overflow", () => {
    expect(() => new GuestBookingTokenSigner("too-short-secret")).toThrow();
    const signer = new GuestBookingTokenSigner(SECRET, { now: () => 1_800_000_000_000 });
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const accessor = Object.defineProperty({}, "secret", { enumerable: true, get: () => "value" });
    const tooDeep: Record<string, unknown> = {};
    let cursor = tooDeep;
    for (let i = 0; i < 34; i++) {
      const next: Record<string, unknown> = {};
      cursor.child = next;
      cursor = next;
    }
    const tooWide = Object.fromEntries(Array.from({ length: 257 }, (_, index) => [`k${index}`, index]));
    for (const payload of [
      null,
      { value: undefined },
      { value: Number.NaN },
      { value: 1n },
      cycle,
      accessor,
      tooDeep,
      tooWide,
      { value: "x".repeat(16_385) },
      Object.assign([], { extra: true }),
    ]) {
      expect(() => signer.issue("session", payload as Readonly<Record<string, unknown>>, 30)).toThrow();
    }
  });

  test("authenticates bytes before parsing and rejects malformed signed envelopes", () => {
    const signer = new GuestBookingTokenSigner(SECRET, { now: () => 1_800_000_000_000 });
    expect(signer.verify("session", signRawEnvelopeJson("not-json"))).toBeNull();
    expect(signer.verify("session", signRawEnvelopeJson("{\"v\":1,\"purpose\":\"session\",\"iat\":1,\"exp\":2,\"payload\":{},\"extra\":true}"))).toBeNull();
    expect(signer.verify("session", signRawEnvelopeJson("{ \"v\":1,\"purpose\":\"session\",\"iat\":1,\"exp\":2,\"payload\":{} }"))).toBeNull();
    expect(signer.verify("session", signRawEnvelopeJson("{\"v\":1,\"v\":1,\"purpose\":\"session\",\"iat\":1,\"exp\":2,\"payload\":{}}"))).toBeNull();
    expect(signer.verify("session", signRawEnvelopeJson("{\"v\":1,\"purpose\":\"session\",\"iat\":1,\"exp\":2,\"payload\":\"not-an-object\"}"))).toBeNull();
    expect(signer.verify("session", `gb1.${Buffer.from("not-json").toString("base64url")}.${"0".repeat(43)}`)).toBeNull();
    expect(signer.verify("session", "gb1.ab+c.def")).toBeNull();
    expect(signer.verify("session", `gb1.${"a".repeat(24_577)}.AAAA`)).toBeNull();
  });
});

test("real staff and guest signers reject each other's credentials with the same configured secret", async () => {
  const secret="same-configured-secret-for-isolated-test-only-32";
  const staff=new Hs256TokenSigner(secret);
  const guest=new GuestBookingTokenSigner(secret);
  for (const purpose of PURPOSES) {
    const token = guest.issue(purpose, { sessionId: "isolated" }, MAX_TTL[purpose]);
    expect(await staff.verify(token)).toBeNull();
  }
  const staffToken=await staff.issue({userId:"00000000-0000-4000-8000-000000000001",
    tenantId:"00000000-0000-4000-8000-000000000002",scopes:["reservations.booking:write"]});
  expect(guest.verify("session",staffToken)).toBeNull();
  for (const purpose of PURPOSES) expect(guest.verify(purpose, staffToken)).toBeNull();
});
