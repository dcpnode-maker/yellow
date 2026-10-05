import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { buildDemoAiRehearsal } from "../src/demo/ai-rehearsal";

describe("demo AI rehearsal", () => {
  test("uses configured Gemini only for non-operational guidance", async () => {
    const calls: string[] = [];
    const rehearsal = await buildDemoAiRehearsal(
      { apiKey: "test-key", model: "gemini-test", endpointBase: "https://gemini.test/v1beta" },
      async (url) => {
        calls.push(url);
        return Response.json({
          candidates: [{ content: { parts: [{ text: "Gemini can safely explain demo readiness." }] } }],
        });
      },
    );

    const nonOperational = rehearsal.prompts.find((prompt) => prompt.id === "non_operational_guidance");
    const operational = rehearsal.prompts.find((prompt) => prompt.id === "operational_check_in");
    const hindi = rehearsal.prompts.find((prompt) => prompt.id === "hindi_readiness");

    expect(rehearsal.readyToShare).toBe(false);
    expect(rehearsal.providerStatus.configured).toBe(true);
    expect(rehearsal.secretExposed).toBe(false);
    expect(calls).toEqual(["https://gemini.test/v1beta/models/gemini-test:generateContent"]);
    expect(nonOperational?.result.provider).toBe("gemini");
    expect(nonOperational?.result.geminiConnected).toBe(true);
    expect(nonOperational?.result.executed).toBe(false);
    expect(operational?.result.provider).toBe("deterministic-local");
    expect(operational?.result.requiresConfirmation).toBe(true);
    expect(operational?.result.confirmed).toBe(true);
    expect(operational?.result.executed).toBe(false);
    expect(operational?.result.suggestedActionId).toBe("check-in-arrival");
    expect(hindi?.result.language).toBe("hi-IN");
    expect(JSON.stringify(rehearsal)).not.toContain("test-key");
  });

  test("falls back locally when Gemini is not configured", async () => {
    const rehearsal = await buildDemoAiRehearsal({ model: "gemini-test", endpointBase: "https://gemini.test/v1beta" });
    const nonOperational = rehearsal.prompts.find((prompt) => prompt.id === "non_operational_guidance");

    expect(rehearsal.providerStatus.configured).toBe(false);
    expect(nonOperational?.result.provider).toBe("deterministic-local");
    expect(nonOperational?.result.geminiConnected).toBe(false);
    expect(rehearsal.safety.join(" ")).toContain("Live demo readiness still requires a configured-key smoke");
  });

  test("serves the AI rehearsal over the demo API without exposing secrets", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/ai-rehearsal"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(body.assistant).toBe("Yellow Overwatch");
    expect(body.secretExposed).toBe(false);
    expect(body.prompts.map((prompt: { id: string }) => prompt.id)).toEqual([
      "non_operational_guidance",
      "operational_check_in",
      "hindi_readiness",
    ]);
    expect(JSON.stringify(body)).not.toContain("AQ.");
    expect(JSON.stringify(body)).not.toContain("sk-or-v1-");
    expect(JSON.stringify(body)).not.toContain("test-key");
  });
});
