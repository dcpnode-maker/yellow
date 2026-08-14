import { describe, expect, it } from "bun:test";

import { app, createApp } from "../src/app";
import { SECURITY_HEADERS } from "../src/http/security-headers";

function expectCompleteSecurityHeaderPolicy(response: Response): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    expect(response.headers.get(name)).toBe(value);
  }
}

describe("application security headers", () => {
  it("applies the complete policy to the actual health response", async () => {
    const response = await app.handle(new Request("http://localhost/health"));

    expectCompleteSecurityHeaderPolicy(response);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("applies the complete policy to an unmatched response", async () => {
    const response = await app.handle(new Request("http://localhost/not-found"));

    expectCompleteSecurityHeaderPolicy(response);
    expect(response.status).toBe(404);
  });

  it("applies the complete policy to a wrong-method response", async () => {
    const response = await app.handle(
      new Request("http://localhost/health", { method: "POST" }),
    );

    expectCompleteSecurityHeaderPolicy(response);
    expect(response.status).toBe(404);
  });

  it("applies the complete policy when a handler throws", async () => {
    const errorPath = "/__security-header-test-error";
    const errorApp = createApp().get(errorPath, () => {
      throw new Error("security header error-path probe");
    });

    const response = await errorApp.handle(new Request(`http://localhost${errorPath}`));

    expectCompleteSecurityHeaderPolicy(response);
    expect(response.status).toBe(500);
  });

  it("allows no third-party or executable CSP source", () => {
    const directives = SECURITY_HEADERS["content-security-policy"]
      .split(";")
      .map((directive) => directive.trim().split(/\s+/));
    const allowedSources = new Set(["'self'", "'none'"]);

    for (const [directive, ...sources] of directives) {
      expect(directive).toBeTruthy();
      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) {
        expect(allowedSources.has(source)).toBeTrue();
      }
    }

    expect(SECURITY_HEADERS["content-security-policy"]).not.toMatch(
      /\*|https?:|\/\/|data:|blob:|'unsafe-inline'|'unsafe-eval'|'wasm-unsafe-eval'/,
    );
  });
});
