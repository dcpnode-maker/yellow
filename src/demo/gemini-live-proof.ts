import { handleOverwatchMessageWithProvider } from "../overwatch/confirmation-gate";
import {
  getGeminiProviderStatus,
  loadGeminiProviderConfig,
  type GeminiFetcher,
  type GeminiProviderConfig,
} from "../overwatch/gemini-provider";

export interface DemoGeminiLiveProof {
  readonly product: "Yellow PMS";
  readonly mode: "gemini-live-proof";
  readonly readyToShare: false;
  readonly providerConfigured: boolean;
  readonly providerModel: string;
  readonly liveGeminiProved: boolean;
  readonly nonOperational: {
    readonly provider: "deterministic-local" | "gemini";
    readonly geminiConnected: boolean;
    readonly textPresent: boolean;
    readonly executed: false;
  };
  readonly operational: {
    readonly provider: "deterministic-local" | "gemini";
    readonly requiresConfirmation: boolean;
    readonly confirmed: boolean;
    readonly executed: false;
    readonly suggestedActionId: string | null;
  };
  readonly secretExposed: false;
  readonly safety: readonly string[];
}

export async function buildDemoGeminiLiveProof(
  config: GeminiProviderConfig = loadGeminiProviderConfig(),
  fetcher?: GeminiFetcher,
): Promise<DemoGeminiLiveProof> {
  const providerStatus = getGeminiProviderStatus(config);
  const nonOperational = await handleOverwatchMessageWithProvider({
    prompt: "For the colleague demo, explain in one short sentence what Yellow Overwatch can safely help with.",
    geminiConfig: config,
    ...(fetcher === undefined ? {} : { fetcher }),
  });
  const operational = await handleOverwatchMessageWithProvider({
    prompt: "Please check in Sara Al Harbi now",
    confirmationPhrase: "CONFIRM YELLOW OPERATION",
    geminiConfig: config,
    ...(fetcher === undefined ? {} : { fetcher }),
  });
  const textPresent = nonOperational.message.trim() !== "";
  const liveGeminiProved = providerStatus.configured
    && nonOperational.provider === "gemini"
    && nonOperational.geminiConnected
    && textPresent
    && operational.provider === "deterministic-local"
    && operational.requiresConfirmation
    && operational.executed === false;

  return Object.freeze({
    product: "Yellow PMS" as const,
    mode: "gemini-live-proof" as const,
    readyToShare: false as const,
    providerConfigured: providerStatus.configured,
    providerModel: providerStatus.model,
    liveGeminiProved,
    nonOperational: Object.freeze({
      provider: nonOperational.provider,
      geminiConnected: nonOperational.geminiConnected,
      textPresent,
      executed: nonOperational.executed,
    }),
    operational: Object.freeze({
      provider: operational.provider,
      requiresConfirmation: operational.requiresConfirmation,
      confirmed: operational.confirmed,
      executed: operational.executed,
      suggestedActionId: operational.suggestedActionId,
    }),
    secretExposed: false as const,
    safety: Object.freeze([
      "Gemini may answer only non-operational guidance prompts.",
      "Operational PMS prompts stay deterministic-local.",
      "Operational PMS prompts require exact confirmation and still keep executed:false until governed command proof exists.",
      "The API key is never returned by this route.",
    ]),
  });
}
