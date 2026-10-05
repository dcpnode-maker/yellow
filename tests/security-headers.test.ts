import { describe, expect, it } from "bun:test";

import { app, createApp } from "../src/app";
import type { OperatorHttpApi } from "../src/http/operator";
import { SECURITY_HEADERS, YELLOW_MAP_CSP, YELLOW_MAP_WORKER_CSP, isYellowMapWorkerAsset } from "../src/http/security-headers";

function expectCompleteSecurityHeaderPolicy(response: Response): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    expect(response.headers.get(name)).toBe(value);
  }
}

describe("application security headers", () => {
  it("gives only the bundled map worker its required tile connection policy", async () => {
    const path = "/yellow-next/assets/maplibre-gl-worker-V8-um17z.js";
    expect(isYellowMapWorkerAsset(path)).toBe(true);
    for (const wrong of ["/api/maplibre-gl-worker-x.js", "/yellow-next/assets/index-x.js", "/yellow-next/assets/maplibre-gl-worker-x.js/more", "/yellow-next/assets/maplibre-gl-worker-../x.js"]) expect(isYellowMapWorkerAsset(wrong)).toBe(false);
    const operator = createApp({ publicOperatorSurface: "yellow-next", operatorApi: {} as OperatorHttpApi });
    const response = await operator.handle(new Request(`http://localhost${path}`));
    expect(response.headers.get("content-security-policy")).toBe(YELLOW_MAP_WORKER_CSP);
    const unrelated = await operator.handle(new Request("http://localhost/health"));
    expectCompleteSecurityHeaderPolicy(unrelated);
    expect(YELLOW_MAP_WORKER_CSP).toBe(SECURITY_HEADERS["content-security-policy"].replace("connect-src 'self'", "connect-src 'self' https://tiles.openfreemap.org"));
    const ordinaryApp = await app.handle(new Request(`http://localhost${path}`));
    expectCompleteSecurityHeaderPolicy(ordinaryApp);
  });
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

  it("adds only the OpenFreeMap tile origin to the operator map network policy", () => {
    const base = SECURITY_HEADERS["content-security-policy"];
    const directives = Object.fromEntries(YELLOW_MAP_CSP.split(";").map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }));
    expect(directives["connect-src"]).toEqual(["'self'", "https://tiles.openfreemap.org"]);
    expect(directives["img-src"]).toEqual(["'self'", "data:", "blob:", "https://tiles.openfreemap.org"]);
    expect(directives["script-src"]).toEqual(["'self'"]);
    expect(directives["worker-src"]).toEqual(["'self'"]);
    expect(YELLOW_MAP_CSP).not.toContain("tile.openstreetmap.org");
    expect(YELLOW_MAP_CSP).not.toMatch(/unsafe-eval|wasm-unsafe-eval|unsafe-inline|\*/);
    expect(YELLOW_MAP_CSP).toContain("default-src 'self'");
    expect(base).toContain("connect-src 'self'");
    expect(base).toContain("img-src 'self'");
  });
});
