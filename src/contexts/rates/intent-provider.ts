import {
  LocalRateIntentProposalAdapter,
  type RateIntentAdapterInput,
  type RateIntentProposalAdapter,
} from "./intent";

const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const SAFE_MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const SAFE_DEPLOYMENT_KEY = /^[a-z0-9][a-z0-9._-]{0,31}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

type ProviderEnvironment = Readonly<Record<string, string | undefined>>;
type ProviderAuth = "bearer" | "api-key" | "none";

interface OpenAiCompatibleConfiguration {
  readonly endpoint: string;
  readonly model: string;
  readonly auth: ProviderAuth;
  readonly apiKey: string | null;
  readonly deploymentKey: string;
  readonly timeoutMs: number;
}

export type RateIntentProviderFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export class RateIntentProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateIntentProviderConfigurationError";
  }
}

class RateIntentProviderError extends Error {
  constructor() {
    super("The configured proposal provider is unavailable or returned an invalid response");
    this.name = "RateIntentProviderError";
  }
}

const SYSTEM_INSTRUCTION = Object.freeze([
  "You are an untrusted proposal adapter for Yellow's hotel rate authoring compiler.",
  "Return one JSON object with exactly candidate, changes, assumptions, questions and warnings.",
  "candidate is null or contains exactly model, target, evaluator, composition and rmsBinding copied or modified from currentCommand.",
  "All four text collections are arrays of concise plain strings. Do not return Markdown, tools, code, URLs or hidden fields.",
  "Never invent currency scale, tenant/property/actor authority, approval, publication, availability, tax, fiscal or compliance outcomes.",
  "If the intent is ambiguous or unsupported, return candidate null and ask specific questions.",
].join(" "));

function configuredValue(environment: ProviderEnvironment, name: string): string | undefined {
  const value = environment[name]?.trim();
  return value ? value : undefined;
}

function requiredValue(environment: ProviderEnvironment, name: string): string {
  const value = configuredValue(environment, name);
  if (!value) throw new RateIntentProviderConfigurationError(`${name} is required for the selected rate-intent provider`);
  return value;
}

function loopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "[::1]" || hostname === "::1" ||
    /^127(?:\.(?:[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])){3}$/.test(hostname);
}

function configuredEndpoint(environment: ProviderEnvironment): string {
  const raw = requiredValue(environment, "YELLOW_RATE_INTENT_ENDPOINT");
  let endpoint: URL;
  try {
    endpoint = new URL(raw);
  } catch {
    throw new RateIntentProviderConfigurationError("YELLOW_RATE_INTENT_ENDPOINT must be an absolute URL");
  }
  if (endpoint.username || endpoint.password || endpoint.hash) {
    throw new RateIntentProviderConfigurationError("YELLOW_RATE_INTENT_ENDPOINT cannot contain credentials or a fragment");
  }
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && loopbackHostname(endpoint.hostname))) {
    throw new RateIntentProviderConfigurationError("YELLOW_RATE_INTENT_ENDPOINT requires HTTPS except on exact loopback");
  }
  return endpoint.toString();
}

function configuredModel(environment: ProviderEnvironment): string {
  const model = requiredValue(environment, "YELLOW_RATE_INTENT_MODEL");
  if (!SAFE_MODEL.test(model)) {
    throw new RateIntentProviderConfigurationError("YELLOW_RATE_INTENT_MODEL is invalid");
  }
  return model;
}

function configuredDeploymentKey(environment: ProviderEnvironment): string {
  const key = configuredValue(environment, "YELLOW_RATE_INTENT_DEPLOYMENT_KEY") ?? "configured";
  if (!SAFE_DEPLOYMENT_KEY.test(key)) {
    throw new RateIntentProviderConfigurationError("YELLOW_RATE_INTENT_DEPLOYMENT_KEY is invalid");
  }
  return key;
}

function configuredAuth(environment: ProviderEnvironment): Readonly<{ auth: ProviderAuth; apiKey: string | null }> {
  const auth = requiredValue(environment, "YELLOW_RATE_INTENT_AUTH");
  if (auth !== "bearer" && auth !== "api-key" && auth !== "none") {
    throw new RateIntentProviderConfigurationError("YELLOW_RATE_INTENT_AUTH must be bearer, api-key or none");
  }
  if (auth === "none") return Object.freeze({ auth, apiKey: null });
  const apiKey = requiredValue(environment, "YELLOW_RATE_INTENT_API_KEY");
  if (apiKey.length < 16 || apiKey.length > 4_096 || CONTROL_CHARACTERS.test(apiKey)) {
    throw new RateIntentProviderConfigurationError("YELLOW_RATE_INTENT_API_KEY is invalid");
  }
  return Object.freeze({ auth, apiKey });
}

function configuredTimeout(environment: ProviderEnvironment): number {
  const raw = configuredValue(environment, "YELLOW_RATE_INTENT_TIMEOUT_MS");
  if (!raw) return DEFAULT_TIMEOUT_MS;
  if (!/^[0-9]+$/.test(raw)) throw new RateIntentProviderConfigurationError("YELLOW_RATE_INTENT_TIMEOUT_MS is invalid");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < MIN_TIMEOUT_MS || value > MAX_TIMEOUT_MS) {
    throw new RateIntentProviderConfigurationError(
      `YELLOW_RATE_INTENT_TIMEOUT_MS must be ${MIN_TIMEOUT_MS} to ${MAX_TIMEOUT_MS}`,
    );
  }
  return value;
}

function compatibleConfiguration(environment: ProviderEnvironment): OpenAiCompatibleConfiguration {
  const { auth, apiKey } = configuredAuth(environment);
  return Object.freeze({
    endpoint: configuredEndpoint(environment),
    model: configuredModel(environment),
    auth,
    apiKey,
    deploymentKey: configuredDeploymentKey(environment),
    timeoutMs: configuredTimeout(environment),
  });
}

function headers(configuration: OpenAiCompatibleConfiguration): Headers {
  const result = new Headers({ accept: "application/json", "content-type": "application/json" });
  if (configuration.auth === "bearer") result.set("authorization", `Bearer ${configuration.apiKey!}`);
  if (configuration.auth === "api-key") result.set("api-key", configuration.apiKey!);
  return result;
}

async function boundedResponseText(response: Response): Promise<string> {
  const declared = response.headers.get("content-length");
  if (declared && (!/^[0-9]+$/.test(declared) || Number(declared) > MAX_RESPONSE_BYTES)) {
    throw new RateIntentProviderError();
  }
  if (!response.body) throw new RateIntentProviderError();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new RateIntentProviderError();
      }
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new RateIntentProviderError();
  return value as Record<string, unknown>;
}

function providerContent(value: unknown): unknown {
  const envelope = object(value);
  if (!Array.isArray(envelope.choices) || envelope.choices.length < 1) throw new RateIntentProviderError();
  const first = object(envelope.choices[0]);
  const message = object(first.message);
  if (typeof message.content !== "string" || message.content.length < 1) throw new RateIntentProviderError();
  try {
    return JSON.parse(message.content) as unknown;
  } catch {
    throw new RateIntentProviderError();
  }
}

class OpenAiCompatibleRateIntentProposalAdapter implements RateIntentProposalAdapter {
  readonly metadata;
  readonly #configuration: OpenAiCompatibleConfiguration;
  readonly #fetch: RateIntentProviderFetch;

  constructor(configuration: OpenAiCompatibleConfiguration, providerFetch: RateIntentProviderFetch) {
    this.#configuration = configuration;
    this.#fetch = providerFetch;
    this.metadata = Object.freeze({
      key: `openai-compatible:${configuration.deploymentKey}`,
      external: true,
    });
  }

  async propose(input: RateIntentAdapterInput): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#configuration.timeoutMs);
    try {
      const response = await this.#fetch(this.#configuration.endpoint, {
        method: "POST",
        headers: headers(this.#configuration),
        body: JSON.stringify({
          model: this.#configuration.model,
          messages: [
            { role: "system", content: SYSTEM_INSTRUCTION },
            { role: "user", content: JSON.stringify(input) },
          ],
          temperature: 0,
          max_tokens: 2_048,
          response_format: { type: "json_object" },
          stream: false,
        }),
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) throw new RateIntentProviderError();
      const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
      if (contentType !== "application/json" && !contentType?.endsWith("+json")) {
        throw new RateIntentProviderError();
      }
      const text = await boundedResponseText(response);
      return providerContent(JSON.parse(text) as unknown);
    } catch {
      throw new RateIntentProviderError();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createRateIntentProposalAdapterFromEnvironment(
  environment: ProviderEnvironment,
  providerFetch: RateIntentProviderFetch = fetch,
): RateIntentProposalAdapter {
  const provider = configuredValue(environment, "YELLOW_RATE_INTENT_PROVIDER") ?? "local";
  if (provider === "local" || provider === "local-deterministic") {
    return new LocalRateIntentProposalAdapter();
  }
  if (provider !== "openai-compatible") {
    throw new RateIntentProviderConfigurationError("YELLOW_RATE_INTENT_PROVIDER is unsupported");
  }
  return new OpenAiCompatibleRateIntentProposalAdapter(compatibleConfiguration(environment), providerFetch);
}
