import {
  handleOverwatchMessage,
  handleOverwatchMessageWithProvider,
  type OverwatchMessageResult,
} from "../overwatch/confirmation-gate";
import {
  getGeminiProviderStatus,
  loadGeminiProviderConfig,
  type GeminiFetcher,
  type GeminiProviderConfig,
  type GeminiProviderStatus,
} from "../overwatch/gemini-provider";

export interface DemoAiRehearsalPrompt {
  readonly id: "non_operational_guidance" | "operational_check_in" | "hindi_readiness";
  readonly prompt: string;
  readonly expectedProviderRule: string;
  readonly result: OverwatchMessageResult;
}

export interface DemoAiRehearsal {
  readonly assistant: "Yellow Overwatch";
  readonly mode: "ai-rehearsal";
  readonly readyToShare: false;
  readonly providerStatus: GeminiProviderStatus;
  readonly secretExposed: false;
  readonly prompts: readonly DemoAiRehearsalPrompt[];
  readonly safety: readonly string[];
}

export async function buildDemoAiRehearsal(
  config: GeminiProviderConfig = loadGeminiProviderConfig(),
  fetcher?: GeminiFetcher,
): Promise<DemoAiRehearsal> {
  const providerStatus = getGeminiProviderStatus(config);
  const nonOperational = await handleOverwatchMessageWithProvider({
    prompt: "Summarise what Yellow Overwatch can safely help with in this colleague demo.",
    geminiConfig: config,
    ...(fetcher === undefined ? {} : { fetcher }),
  });
  const operational = await handleOverwatchMessageWithProvider({
    prompt: "Check in Sara Al Harbi now",
    confirmationPhrase: "CONFIRM YELLOW OPERATION",
    geminiConfig: config,
    ...(fetcher === undefined ? {} : { fetcher }),
  });
  const hindi = handleOverwatchMessage({
    prompt: "डेमो तैयार है?",
    geminiConfig: config,
  });

  return Object.freeze({
    assistant: "Yellow Overwatch" as const,
    mode: "ai-rehearsal" as const,
    readyToShare: false as const,
    providerStatus,
    secretExposed: false as const,
    prompts: Object.freeze([
      prompt("non_operational_guidance", "Gemini may answer when configured; local fallback is allowed when not configured.", nonOperational),
      prompt("operational_check_in", "Operational PMS intent must stay deterministic-local, confirmation-gated and non-executing.", operational),
      prompt("hindi_readiness", "Hindi/Indian-English detection must remain visible without execution.", hindi),
    ]),
    safety: Object.freeze([
      "The API key is never returned by this route.",
      "Operational PMS prompts do not call Gemini.",
      "Every operational result keeps executed:false.",
      "Live demo readiness still requires a configured-key smoke and public URL proof.",
    ]),
  });
}

function prompt(
  id: DemoAiRehearsalPrompt["id"],
  expectedProviderRule: string,
  result: OverwatchMessageResult,
): DemoAiRehearsalPrompt {
  return Object.freeze({
    id,
    prompt: id === "non_operational_guidance"
      ? "Summarise what Yellow Overwatch can safely help with in this colleague demo."
      : id === "operational_check_in"
        ? "Check in Sara Al Harbi now"
        : "डेमो तैयार है?",
    expectedProviderRule,
    result,
  });
}
