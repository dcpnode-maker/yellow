export interface GeminiProviderConfig {
  readonly apiKey?: string;
  readonly model: string;
  readonly endpointBase: string;
}

export interface GeminiProviderStatus {
  readonly provider: "gemini";
  readonly configured: boolean;
  readonly model: string;
  readonly endpoint: string;
  readonly secretPresent: boolean;
}

export interface GeminiTextResult {
  readonly provider: "gemini";
  readonly model: string;
  readonly text: string;
}

export type GeminiFetcher = (url: string, init: RequestInit) => Promise<Response>;

interface GeminiGenerateContentResponse {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly {
        readonly text?: string;
      }[];
    };
  }[];
}

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const DEFAULT_GEMINI_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta";

export function loadGeminiProviderConfig(env: Record<string, string | undefined> = Bun.env): GeminiProviderConfig {
  return Object.freeze({
    apiKey: env.YELLOW_GEMINI_API_KEY ?? env.GEMINI_API_KEY,
    model: env.YELLOW_GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
    endpointBase: env.YELLOW_GEMINI_ENDPOINT_BASE ?? DEFAULT_GEMINI_ENDPOINT_BASE,
  });
}

export function getGeminiProviderStatus(config: GeminiProviderConfig = loadGeminiProviderConfig()): GeminiProviderStatus {
  return Object.freeze({
    provider: "gemini",
    configured: config.apiKey !== undefined && config.apiKey.trim() !== "",
    model: config.model,
    endpoint: `${config.endpointBase}/models/${config.model}:generateContent`,
    secretPresent: config.apiKey !== undefined && config.apiKey.trim() !== "",
  });
}

export async function generateGeminiOverwatchText(
  prompt: string,
  config: GeminiProviderConfig = loadGeminiProviderConfig(),
  fetcher: GeminiFetcher = fetch,
): Promise<GeminiTextResult | null> {
  if (config.apiKey === undefined || config.apiKey.trim() === "") return null;
  const response = await fetcher(`${config.endpointBase}/models/${config.model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": config.apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "You are Yellow Overwatch, a hospitality PMS operator assistant.",
                "Do not claim that you executed any PMS action.",
                "Keep the answer short, practical, and safe for a hotel colleague demo.",
                `Operator prompt: ${prompt}`,
              ].join("\n"),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512,
      },
    }),
  });
  if (!response.ok) return null;
  const body = await response.json() as GeminiGenerateContentResponse;
  const text = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (text === undefined || text === "") return null;
  return Object.freeze({ provider: "gemini", model: config.model, text });
}
