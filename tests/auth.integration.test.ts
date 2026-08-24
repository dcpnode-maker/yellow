import { afterAll, describe, expect, test } from "bun:test";

import { createApp } from "../src/app";
import {
  BearerTenantResolver,
  hashLocalPassword,
  Hs256TokenSigner,
  verifyLocalPassword,
} from "../src/contexts/identity";
import { Database } from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_AUTH_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_AUTH === "1";
const SECRET = "yellow-order-020-hs256-secret-0001";
const USER_ID = "00000000-0000-0000-0000-000000000960";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const TENANT_B = "00000000-0000-0000-0000-000000000002";
const JTI_A = "00000000-0000-0000-0000-000000000991";
const JTI_B = "00000000-0000-0000-0000-000000000992";
const ISSUED_AT = 1_800_000_000;

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_AUTH_URL is required by bun run test:auth");
}

function encodeSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeClaims(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8")) as Record<string, unknown>;
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

function bearer(token: string): HeadersInit {
  return { authorization: `Bearer ${token}` };
}

describe("Order 020 fail-closed authentication", () => {
  test("local credentials are Argon2id and reject wrong or legacy-shaped records", async () => {
    const auth = await hashLocalPassword("correct horse battery staple");

    expect(auth.provider).toBe("local");
    expect(auth.hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyLocalPassword("correct horse battery staple", auth)).toBe(true);
    expect(await verifyLocalPassword("wrong password", auth)).toBe(false);
    expect(await verifyLocalPassword("correct horse battery staple", {
      provider: "local",
      hash: "$2b$12$legacy-bcrypt-is-not-accepted",
    })).toBe(false);
  });

  test("P7: malformed, unsigned, expired and wrong-audience tokens each become 401", async () => {
    let now = ISSUED_AT;
    const tokens = new Hs256TokenSigner(SECRET, { now: () => now, jtiFactory: () => JTI_A });
    const valid = await tokens.issue({ userId: USER_ID, tenantId: TENANT_A, scopes: [] });
    const validClaims = decodeClaims(valid);
    const unsigned = `${encodeSegment({ alg: "none", typ: "JWT" })}.${encodeSegment(validClaims)}.`;
    const wrongAudience = await signWithHmac(
      { alg: "HS256", typ: "JWT" },
      { ...validClaims, aud: "another-api" },
    );

    now = ISSUED_AT + 961;
    const app = createApp({ tenantResolver: new BearerTenantResolver(tokens) })
      .get("/protected", ({ request, tenantContext }) =>
        tenantContext.handle(request, async () => ({ ok: true }))
      );

    for (const token of ["not-a-jwt", unsigned, valid, wrongAudience]) {
      const response = await app.handle(new Request("http://yellow.test/protected", { headers: bearer(token) }));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorized" });
    }
  });
});

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let database: Database | undefined;

afterAll(async () => {
  await database?.close();
});

databaseDescribe("Order 020 authenticated tenant isolation", () => {
  test("P8: tenant A token sees A rows while tenant B token sees zero A rows", async () => {
    let nextJti = JTI_A;
    const tokens = new Hs256TokenSigner(SECRET, {
      now: () => ISSUED_AT,
      jtiFactory: () => nextJti,
    });
    const tokenA = await tokens.issue({ userId: USER_ID, tenantId: TENANT_A, scopes: ["inventory.space:read"] });
    nextJti = JTI_B;
    const tokenB = await tokens.issue({ userId: USER_ID, tenantId: TENANT_B, scopes: ["inventory.space:read"] });

    database = Database.connect(DATABASE_URL!, { maxConnections: 2 });
    const app = createApp({ database, tenantResolver: new BearerTenantResolver(tokens) })
      .get("/spaces", ({ request, tenantContext }) =>
        tenantContext.handle(request, async ({ tx }) => {
          const rows = await tx<{ count: number }[]>`SELECT count(*)::int AS count FROM space`;
          return { count: rows[0]?.count };
        })
      );

    const responseA = await app.handle(new Request("http://yellow.test/spaces", { headers: bearer(tokenA) }));
    const responseB = await app.handle(new Request("http://yellow.test/spaces", { headers: bearer(tokenB) }));

    expect(responseA.status).toBe(200);
    expect(await responseA.json()).toEqual({ count: 16 });
    expect(responseB.status).toBe(200);
    expect(await responseB.json()).toEqual({ count: 0 });
  });
});
