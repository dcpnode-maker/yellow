import { describe, expect, it } from "bun:test";

import { app } from "../src/app";
import { handleOverwatchMessage, handleOverwatchMessageWithProvider } from "../src/overwatch/confirmation-gate";
import { generateGeminiOverwatchText, getGeminiProviderStatus, loadGeminiProviderConfig } from "../src/overwatch/gemini-provider";

async function postOverwatch(body: unknown): Promise<{ response: Response; json: Record<string, unknown> }> {
  const response = await app.handle(new Request("http://localhost/api/v1/overwatch/message", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
  return { response, json: await response.json() as Record<string, unknown> };
}

describe("Overwatch confirmation gate", () => {
  it("answers readiness questions without requiring operational confirmation", async () => {
    const { response, json } = await postOverwatch({ prompt: "Is the Yellow demo ready?" });

    expect(response.status).toBe(200);
    expect(json.assistant).toBe("Yellow Overwatch");
    expect(json.provider).toBe("deterministic-local");
    expect(json.geminiConnected).toBe(false);
    expect(json.geminiModel).toBe(null);
    expect(json.intent).toBe("readiness");
    expect(json.requiresConfirmation).toBe(false);
    expect(json.executed).toBe(false);
  });

  it("requires explicit confirmation for English operational PMS actions", async () => {
    const { json } = await postOverwatch({ prompt: "Please check in Sara Al Harbi now" });

    expect(json.intent).toBe("check_in");
    expect(json.operational).toBe(true);
    expect(json.requiresConfirmation).toBe(true);
    expect(json.confirmationPhrase).toBe("CONFIRM YELLOW OPERATION");
    expect(json.confirmed).toBe(false);
    expect(json.executed).toBe(false);
    expect(json.suggestedWorkbench).toBe("/api/v1/demo/front-desk-board");
    expect(json.suggestedActionId).toBe("check-in-arrival");
    expect(json.safetyNotes).toContain("No PMS state was changed.");
  });

  it("detects Hindi/Indian English operational prompts and still refuses ungated execution", async () => {
    const { json } = await postOverwatch({ prompt: "कृपया कमरा बदल दो" });

    expect(json.language).toBe("hi-IN");
    expect(json.intent).toBe("move_room");
    expect(json.requiresConfirmation).toBe(true);
    expect(json.suggestedActionId).toBe("move-room");
    expect(json.executed).toBe(false);
  });

  it("does not execute even after confirmation until governed workflow service proof exists", async () => {
    const { json } = await postOverwatch({
      prompt: "Post a charge to the folio",
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
    });

    expect(json.intent).toBe("post_charge");
    expect(json.confirmed).toBe(true);
    expect(json.executed).toBe(false);
    expect(json.suggestedWorkbench).toBe("/api/v1/demo/front-desk-board");
    expect(json.suggestedActionId).toBe("post-charge");
    expect(String(json.message)).toContain("execution is still disabled");
  });

  it("rejects malformed requests before intent handling", async () => {
    const { response, json } = await postOverwatch({ confirmationPhrase: "CONFIRM YELLOW OPERATION" });

    expect(response.status).toBe(400);
    expect(json.error).toBe("prompt_required");
  });

  it("keeps the pure handler deterministic and bounded", () => {
    expect(handleOverwatchMessage({ prompt: "check out room 303" })).toEqual(
      handleOverwatchMessage({ prompt: "check out room 303" }),
    );
  });

  it("reports Gemini provider status without exposing any secret", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/overwatch/provider"));
    const json = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(json.provider).toBe("gemini");
    expect(json.endpoint).toBeString();
    expect(JSON.stringify(json)).not.toContain("AQ.");
    expect(JSON.stringify(json)).not.toContain("sk-");
  });

  it("defaults to the currently available Gemini Flash model", () => {
    expect(loadGeminiProviderConfig({}).model).toBe("gemini-3.6-flash");
  });

  it("falls back locally when Gemini is not configured", async () => {
    const result = await handleOverwatchMessageWithProvider({
      prompt: "Explain today's readiness",
      geminiConfig: { model: "gemini-test", endpointBase: "https://example.invalid" },
    });

    expect(result.provider).toBe("deterministic-local");
    expect(result.geminiConnected).toBe(false);
    expect(result.geminiModel).toBe(null);
    expect(result.executed).toBe(false);
  });

  it("uses Gemini only for non-operational guidance when configured", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetcher = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(url), init: init ?? {} });
      return Response.json({
        candidates: [{ content: { parts: [{ text: "Gemini readiness guidance." }] } }],
      });
    };

    const result = await handleOverwatchMessageWithProvider({
      prompt: "Summarise the public demo readiness",
      geminiConfig: { apiKey: "test-key", model: "gemini-test", endpointBase: "https://gemini.test/v1beta" },
      fetcher,
    });

    expect(result.provider).toBe("gemini");
    expect(result.geminiConnected).toBe(true);
    expect(result.geminiModel).toBe("gemini-test");
    expect(result.message).toBe("Gemini readiness guidance.");
    expect(result.executed).toBe(false);
    expect(result.suggestedWorkbench).toBe("/api/v1/demo/readiness");
    expect(result.suggestedActionId).toBe(null);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://gemini.test/v1beta/models/gemini-test:generateContent");
    expect((calls[0]?.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    expect(String(calls[0]?.init.body)).toContain("Do not claim that you executed any PMS action.");
  });

  it("does not call Gemini for operational prompts even when a key is configured", async () => {
    let calls = 0;
    const fetcher = async (): Promise<Response> => {
      calls += 1;
      return Response.json({});
    };

    const result = await handleOverwatchMessageWithProvider({
      prompt: "check in Sara now",
      geminiConfig: { apiKey: "test-key", model: "gemini-test", endpointBase: "https://gemini.test/v1beta" },
      fetcher,
    });

    expect(result.provider).toBe("deterministic-local");
    expect(result.intent).toBe("check_in");
    expect(result.requiresConfirmation).toBe(true);
    expect(result.executed).toBe(false);
    expect(calls).toBe(0);
  });

  it("keeps Gemini request parsing bounded to returned text", async () => {
    const result = await generateGeminiOverwatchText(
      "hello",
      { apiKey: "test-key", model: "gemini-test", endpointBase: "https://gemini.test/v1beta" },
      async () => Response.json({ candidates: [{ content: { parts: [{ text: "A" }, { text: "B" }] } }] }),
    );

    expect(result).toEqual({ provider: "gemini", model: "gemini-test", text: "AB" });
    expect(getGeminiProviderStatus({ apiKey: "secret", model: "gemini-test", endpointBase: "https://gemini.test/v1beta" }).secretPresent).toBe(true);
  });
});
