import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { buildDemoGeminiLiveProof } from "../src/demo/gemini-live-proof";

describe("demo Gemini live proof", () => {
  test("proves Gemini only for non-operational guidance when configured", async () => {
    const calls: string[] = [];
    const proof = await buildDemoGeminiLiveProof(
      { apiKey: "test-key", model: "gemini-test", endpointBase: "https://gemini.test/v1beta" },
      async (url) => {
        calls.push(url);
        return Response.json({
          candidates: [{ content: { parts: [{ text: "Gemini explains safe demo guidance." }] } }],
        });
      },
    );

    expect(proof.readyToShare).toBe(false);
    expect(proof.providerConfigured).toBe(true);
    expect(proof.liveGeminiProved).toBe(true);
    expect(proof.nonOperational.provider).toBe("gemini");
    expect(proof.nonOperational.geminiConnected).toBe(true);
    expect(proof.nonOperational.textPresent).toBe(true);
    expect(proof.nonOperational.executed).toBe(false);
    expect(proof.operational.provider).toBe("deterministic-local");
    expect(proof.operational.requiresConfirmation).toBe(true);
    expect(proof.operational.confirmed).toBe(true);
    expect(proof.operational.executed).toBe(false);
    expect(proof.operational.suggestedActionId).toBe("check-in-arrival");
    expect(calls).toEqual(["https://gemini.test/v1beta/models/gemini-test:generateContent"]);
    expect(JSON.stringify(proof)).not.toContain("test-key");
  });

  test("reports not proved when unconfigured without failing the route", async () => {
    const proof = await buildDemoGeminiLiveProof({ model: "gemini-test", endpointBase: "https://gemini.test/v1beta" });

    expect(proof.providerConfigured).toBe(false);
    expect(proof.liveGeminiProved).toBe(false);
    expect(proof.nonOperational.provider).toBe("deterministic-local");
    expect(proof.operational.executed).toBe(false);
  });

  test("serves the proof route with security headers and no secret", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/gemini-live-proof"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(body.mode).toBe("gemini-live-proof");
    expect(body.secretExposed).toBe(false);
    expect(JSON.stringify(body)).not.toContain("AQ.");
    expect(JSON.stringify(body)).not.toContain("test-key");
  });
});
