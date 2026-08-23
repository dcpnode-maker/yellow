import { describe, expect, test } from "bun:test";

import {
  createRateIntentProposalAdapterFromEnvironment,
  RateIntentProviderConfigurationError,
  RateIntentService,
} from "../src/contexts/rates";

const PLAN = "00000000-0000-0000-0000-000000009001";
const SECRET = "order-090-provider-secret-never-serialized";

function currentCommand() {
  return {
    authoringMode: "guided",
    ratePlanId: PLAN,
    model: { key: "simple-fixed", version: 1, componentModelKeys: [] },
    target: {
      rules: [{
        key: "property-default",
        effect: "include",
        priority: 0,
        physical: { kind: "property" },
        commercial: {},
      }],
    },
    evaluator: {
      modelKey: "simple-fixed",
      currency: "USD",
      base: { kind: "fixed", amountMinor: "12500" },
      gate: {},
      rules: [],
      floorMinor: null,
      ceilingMinor: null,
      eligibleTargetRuleKeys: [],
    },
    composition: {
      currency: "USD",
      guestEligibility: {
        minAdults: 1,
        maxAdults: 4,
        minChildren: 0,
        maxChildren: 3,
        minTotalGuests: 1,
        maxTotalGuests: 7,
      },
      package: null,
      promotions: [],
      policy: {
        cancellationPolicyId: null,
        depositPolicyId: null,
        guaranteePolicyId: null,
        noShowPolicyId: null,
        refundTreatment: "policy",
      },
      distribution: { mode: "all", channelCodes: [] },
    },
    rmsBinding: null,
  };
}

function environment(overrides: Record<string, string | undefined> = {}) {
  return {
    YELLOW_RATE_INTENT_PROVIDER: "openai-compatible",
    YELLOW_RATE_INTENT_ENDPOINT: "https://models.example.test/v1/chat/completions",
    YELLOW_RATE_INTENT_MODEL: "yellow-proposal-model",
    YELLOW_RATE_INTENT_AUTH: "bearer",
    YELLOW_RATE_INTENT_API_KEY: SECRET,
    YELLOW_RATE_INTENT_DEPLOYMENT_KEY: "review-cloud",
    YELLOW_RATE_INTENT_TIMEOUT_MS: "8000",
    ...overrides,
  };
}

function providerResponse(content: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { role: "assistant", content: JSON.stringify(content) } }],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("Order 090 portable AI intent provider", () => {
  test("P0/P1: the omitted provider stays zero-network local", async () => {
    let calls = 0;
    const adapter = createRateIntentProposalAdapterFromEnvironment({}, async () => {
      calls += 1;
      throw new Error("network must remain unused");
    });
    expect(adapter.metadata).toEqual({ key: "local-deterministic-v1", external: false });
    const result = await new RateIntentService(adapter).interpret({
      intent: "Set the fixed rate to 14500 minor units.",
      currentCommand: currentCommand(),
    });
    expect(result.status).toBe("ready");
    expect(result.proposal?.evaluator.base).toEqual({ kind: "fixed", amountMinor: 14_500n });
    expect(calls).toBe(0);
  });

  test("P1: selected external configuration fails closed", () => {
    const invalid = [
      environment({ YELLOW_RATE_INTENT_PROVIDER: "azure-magic" }),
      environment({ YELLOW_RATE_INTENT_ENDPOINT: undefined }),
      environment({ YELLOW_RATE_INTENT_ENDPOINT: "http://models.example.test/v1/chat/completions" }),
      environment({ YELLOW_RATE_INTENT_ENDPOINT: "https://user:pass@models.example.test/v1/chat/completions" }),
      environment({ YELLOW_RATE_INTENT_ENDPOINT: "https://models.example.test/v1/chat/completions#secret" }),
      environment({ YELLOW_RATE_INTENT_MODEL: "" }),
      environment({ YELLOW_RATE_INTENT_AUTH: "magic" }),
      environment({ YELLOW_RATE_INTENT_API_KEY: undefined }),
      environment({ YELLOW_RATE_INTENT_DEPLOYMENT_KEY: "Unsafe Label" }),
      environment({ YELLOW_RATE_INTENT_TIMEOUT_MS: "499" }),
      environment({ YELLOW_RATE_INTENT_TIMEOUT_MS: "30001" }),
    ];
    for (const config of invalid) {
      expect(() => createRateIntentProposalAdapterFromEnvironment(config))
        .toThrow(RateIntentProviderConfigurationError);
    }

    expect(createRateIntentProposalAdapterFromEnvironment(environment({
      YELLOW_RATE_INTENT_ENDPOINT: "http://127.0.0.1:11434/v1/chat/completions",
      YELLOW_RATE_INTENT_AUTH: "none",
      YELLOW_RATE_INTENT_API_KEY: undefined,
      YELLOW_RATE_INTENT_DEPLOYMENT_KEY: "on-prem",
    })).metadata).toEqual({ key: "openai-compatible:on-prem", external: true });
  });

  test("P2: compatible transport sends only minimized proposal context", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const adapter = createRateIntentProposalAdapterFromEnvironment(environment(), async (url, init) => {
      requestUrl = String(url);
      requestInit = init;
      const outbound = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> };
      const input = JSON.parse(outbound.messages[1]!.content) as { currentCommand: Record<string, unknown> };
      return providerResponse({
        candidate: input.currentCommand,
        changes: ["Retain the reviewed command."],
        assumptions: [],
        questions: [],
        warnings: ["Review before applying."],
      });
    });

    const result = await new RateIntentService(adapter).interpret({
      intent: "Retain the reviewed command.",
      currentCommand: currentCommand(),
    });
    expect(result.status).toBe("ready");
    expect(result.adapter).toEqual({ key: "openai-compatible:review-cloud", external: true });
    expect(result.proposal?.ratePlanId).toBe(PLAN);
    expect(requestUrl).toBe("https://models.example.test/v1/chat/completions");
    expect(new Headers(requestInit?.headers).get("authorization")).toBe(`Bearer ${SECRET}`);
    const outboundText = String(requestInit?.body);
    const outbound = JSON.parse(outboundText) as Record<string, unknown>;
    expect(outbound).toMatchObject({ model: "yellow-proposal-model", stream: false, temperature: 0 });
    expect(outbound).not.toHaveProperty("tools");
    for (const forbidden of [PLAN, "ratePlanId", "authoringMode", "tenantId", "actorId", "accessToken", "approvalId", SECRET]) {
      expect(outboundText).not.toContain(forbidden);
    }
  });

  test("P2/P3: provider failures are generic and never become authority", async () => {
    const cases: Array<() => Promise<Response>> = [
      async () => new Response(`upstream ${SECRET}`, { status: 500, headers: { "content-type": "text/plain" } }),
      async () => new Response("not-json", { status: 200, headers: { "content-type": "text/plain" } }),
      async () => providerResponse({ candidate: currentCommand(), changes: [], assumptions: [], questions: [], warnings: [], approvalId: PLAN }),
      async () => new Response("x".repeat(65_537), { status: 200, headers: { "content-type": "application/json" } }),
    ];

    for (const response of cases) {
      const adapter = createRateIntentProposalAdapterFromEnvironment(environment(), response);
      const result = await new RateIntentService(adapter).interpret({
        intent: "Retain the reviewed command.",
        currentCommand: currentCommand(),
      });
      expect(["needs_clarification", "rejected"]).toContain(result.status);
      expect(result.proposal).toBeNull();
      expect(JSON.stringify(result)).not.toContain(SECRET);
    }
  });
});

