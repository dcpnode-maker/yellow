import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Hs256TokenSigner, isValidScope, tokenPolicy } from "../src/contexts/identity";

// Source-only fixture extraction: never import the browser tests or launch a browser.
const fixtures = ["order609-reservation-create-edit.browser.test.ts", "yellow-ai-speech-consent.test.ts",
  "yellow-departure-coordination.browser.test.ts"] as const;
const operator = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
const canonicalLifecycleScopes = ["READ", "WRITE"].map(action => {
  const value = new RegExp(`const RESERVATION_LIFECYCLE_${action}_SCOPE = "([^"]+)";`).exec(operator)?.[1];
  if (!value) throw new Error("Canonical lifecycle scope was not found");
  return value;
});

for (const file of fixtures) test(`normal-login ${file} scopes issue and verify through the real signer`, async () => {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const arrays = [...source.matchAll(/\bscopes:\s*(\[[^\]\r\n]*\])/g)];
  expect(arrays).toHaveLength(1);
  const scopes: unknown = JSON.parse(arrays[0]![1]!);
  expect(Array.isArray(scopes)).toBe(true);
  if (!Array.isArray(scopes) || scopes.some(scope => typeof scope !== "string")) throw new Error("Literal fixture scopes required");
  expect(scopes).toEqual([...canonicalLifecycleScopes, "inventory.availability:read", "crm.party:read"]);
  for (const scope of scopes) expect(isValidScope(scope)).toBe(true);
  const userId = /const fixtureActor = "([0-9a-f-]+)";/.exec(source)?.[1];
  const tenantId = /const fixtureTenant = "([0-9a-f-]+)";/.exec(source)?.[1];
  if (!userId || !tenantId) throw new Error("Explicit synthetic actor/tenant required");
  let now = 1_900_000_000;
  const tokens = new Hs256TokenSigner("synthetic-browser-fixture-only-secret-0001", { now: () => now,
    jtiFactory: () => "00000000-0000-4000-8000-000000000610" });
  const token = await tokens.issue({ userId, tenantId, scopes });
  const claims = await tokens.verify(token);
  expect(claims).not.toBeNull();
  expect(claims?.sub).toBe(userId);
  expect(claims?.tid).toBe(tenantId);
  expect(claims?.scp).toBe([...new Set(scopes)].sort().join(" "));
  expect(claims?.iss).toBe(tokenPolicy.issuer);
  expect(claims?.aud).toBe(tokenPolicy.audience);
  expect(claims?.iat).toBe(now);
  expect(claims?.exp).toBe(now + tokenPolicy.ttlSeconds);
  expect(tokenPolicy.ttlSeconds).toBe(900);
  now += tokenPolicy.ttlSeconds + tokenPolicy.clockSkewSeconds + 1;
  expect(await tokens.verify(token)).toBeNull();
});

test("obsolete singular lifecycle contexts are refused by grammar and issuer", async () => {
  const tokens = new Hs256TokenSigner("synthetic-browser-fixture-only-secret-0001");
  for (const scope of ["reservation.lifecycle:read", "reservation.lifecycle:write"]) {
    expect(isValidScope(scope)).toBe(false);
    await expect(tokens.issue({ userId: "b2836978-73fe-58f9-b808-8b58cceac1c4",
      tenantId: "6d9b7ce2-2d14-5576-b8c3-80f06501a603", scopes: [scope] })).rejects.toThrow("Invalid access-token scope");
  }
});
