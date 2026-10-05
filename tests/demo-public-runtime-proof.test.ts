import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { buildDemoPublicRuntimeProof } from "../src/demo/public-runtime-proof";

describe("public runtime proof", () => {
  test("keeps localhost proof truthful and not share-ready", () => {
    const proof = buildDemoPublicRuntimeProof({
      requestUrl: "http://127.0.0.1:3000/api/v1/demo/public-runtime-proof",
      userAgent: "local-test",
    });

    expect(proof.hostClass).toBe("localhost");
    expect(proof.protocol).toBe("http:");
    expect(proof.publicAccessObserved).toBe(false);
    expect(proof.readyToShare).toBe(false);
    expect(proof.mobileProofRequired).toBe(true);
    expect(proof.checkedRoutes).toContain("/api/v1/demo/action-safety-matrix");
    expect(proof.nextProof).toContain("HTTPS public host");
  });

  test("recognizes HTTPS non-localhost as public access observed", () => {
    const proof = buildDemoPublicRuntimeProof({
      requestUrl: "https://example-yellow-demo.example/api/v1/demo/public-runtime-proof",
      userAgent: "desktop-browser",
    });

    expect(proof.hostClass).toBe("public");
    expect(proof.protocol).toBe("https:");
    expect(proof.publicAccessObserved).toBe(true);
    expect(proof.readyToShare).toBe(false);
    expect(proof.mobileProofObserved).toBe(false);
    expect(proof.nextProof).toContain("mobile browser");
  });

  test("recognizes HTTPS public mobile access as public mobile proof", () => {
    const proof = buildDemoPublicRuntimeProof({
      requestUrl: "https://example-yellow-demo.example/api/v1/demo/public-runtime-proof",
      userAgent: "Mozilla/5.0 (Linux; Android 15; OnePlus) Mobile Safari/537.36",
    });

    expect(proof.publicAccessObserved).toBe(true);
    expect(proof.mobileProofObserved).toBe(true);
    expect(proof.mobileProofRequired).toBe(false);
    expect(proof.readyToShare).toBe(true);
  });

  test("honors forwarded proxy protocol and host from public tunnels", () => {
    const proof = buildDemoPublicRuntimeProof({
      requestUrl: "http://127.0.0.1:3000/api/v1/demo/public-runtime-proof",
      forwardedProto: "https",
      forwardedHost: "yellow-demo-public.example",
      userAgent: "proxy-test",
    });

    expect(proof.host).toBe("yellow-demo-public.example");
    expect(proof.hostClass).toBe("public");
    expect(proof.protocol).toBe("https:");
    expect(proof.publicAccessObserved).toBe(true);
  });

  test("serves the route with security headers", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/public-runtime-proof", {
      headers: { "user-agent": "bun-test" },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(body.mode).toBe("public-runtime-proof");
    expect(body.publicAccessObserved).toBe(false);
    expect(body.readyToShare).toBe(false);
    expect(body.userAgentObserved).toBe("bun-test");
  });
});
