import { describe, expect, test } from "bun:test";

import { Hs256TokenSigner } from "../src/contexts/identity";

const LEGACY_SECRET = "yellow-local-development-token-secret-change-before-deployment";
const PLACEHOLDER_SECRET = "change-me-generate-with-openssl-rand-base64-48";
const SUBJECT = {
  userId: "00000000-0000-0000-0000-000000000960",
  tenantId: "00000000-0000-0000-0000-000000000001",
  scopes: ["inventory.space:read"],
} as const;

describe("Order 116 JWT runtime secret boundary", () => {
  test("P0: the parent legacy key is cryptographically sufficient when a runtime accepts it", async () => {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(LEGACY_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    const input = new TextEncoder().encode(JSON.stringify(SUBJECT));
    const signature = await crypto.subtle.sign("HMAC", key, input);

    expect(await crypto.subtle.verify("HMAC", key, signature, input)).toBe(true);
  });

  test("P1: repository-known signing material is rejected at the signer boundary", () => {
    expect(() => new Hs256TokenSigner(LEGACY_SECRET)).toThrow("repository-known");
    expect(() => new Hs256TokenSigner(PLACEHOLDER_SECRET)).toThrow("repository-known");
  });

  test("P1: independent CSPRNG keys remain usable and distinct", async () => {
    const first = crypto.getRandomValues(new Uint8Array(48));
    const second = crypto.getRandomValues(new Uint8Array(48));
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false);

    const tokens = new Hs256TokenSigner(first);
    const issued = await tokens.issue(SUBJECT);
    expect((await tokens.verify(issued))?.sub).toBe(SUBJECT.userId);
  });

  test("P1: Compose and the environment example contain no accepted signing-key fallback", async () => {
    const compose = await Bun.file("docker-compose.yml").text();
    const example = await Bun.file(".env.example").text();

    expect(compose).toContain('YELLOW_TOKEN_SECRET: "${YELLOW_TOKEN_SECRET:-}"');
    expect(compose).not.toContain(LEGACY_SECRET);
    expect(example).toMatch(/^YELLOW_TOKEN_SECRET=\s*$/m);
    expect(example).not.toContain("JWT_SECRET=");
    expect(example).not.toContain(PLACEHOLDER_SECRET);
  });

  test("P2: local setup generation is scoped, cryptographic, non-persistent and non-logging", async () => {
    const shell = await Bun.file("setup.sh").text();
    const powershell = await Bun.file("setup.ps1").text();

    expect(shell).toContain('if [ "$DB_ONLY" -eq 0 ] && [ -z "${YELLOW_TOKEN_SECRET:-}" ]');
    expect(shell).toContain("crypto.getRandomValues");
    expect(powershell).toContain("if (-not $DbOnly -and -not $env:YELLOW_TOKEN_SECRET)");
    expect(powershell).toContain("RandomNumberGenerator]::Fill");
    expect(powershell).toContain("$env:YELLOW_TOKEN_SECRET = $previousTokenSecret");
    for (const source of [shell, powershell]) {
      expect(source).not.toMatch(/(?:echo|printf|Write-(?:Host|Output)).*YELLOW_TOKEN_SECRET/i);
      expect(source).not.toMatch(/(?:Set-Content|Out-File|>>|>)\s*[^\r\n]*(?:\.env|secret)/i);
    }
  });
});
