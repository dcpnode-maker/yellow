import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

export const tokenHarborOrigin = "https://tokenharbor.ai/v1";
export const tokenHarborStateRoot = "D:/Yellow/harness/state-workspace";
const enrollmentFile = path.join(tokenHarborStateRoot, "tokenharbor-enrollment.json");
const protectedKeyFile = path.join(tokenHarborStateRoot, "credentials/tokenharbor.dpapi");
const secretModule = "file:///D:/Yellow/harness/adapters/t3/windows-secrets.mjs";
const keyPattern = /^thk_live_[A-Za-z0-9_-]{64}$/;
const freePattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,150}:free$/;

export function assertFreeModels(models) {
  if (!Array.isArray(models) || models.length > 64 ||
      models.some((id) => typeof id !== "string" || !freePattern.test(id)) ||
      new Set(models).size !== models.length)
    throw new Error("Only explicit TokenHarbor :free model IDs are allowed");
  return [...models];
}

export function readEnrollment() {
  const value = JSON.parse(readFileSync(enrollmentFile, "utf8"));
  const fields = ["version", "providerId", "baseUrl", "protectedKeyFile", "freeOnly",
    "paidFallback", "promptScope", "models", "checkedAt"];
  if (!value || Object.keys(value).length !== fields.length ||
      Object.keys(value).some((field) => !fields.includes(field)) ||
      value.version !== 1 || value.providerId !== "tokenharbor" ||
      value.baseUrl !== tokenHarborOrigin || value.protectedKeyFile !== protectedKeyFile ||
      value.freeOnly !== true || value.paidFallback !== false ||
      value.promptScope !== "synthetic-and-public" ||
      !(value.checkedAt === null || Number.isFinite(Date.parse(value.checkedAt))))
    throw new Error("TokenHarbor enrollment differs from the fixed free-only policy");
  assertFreeModels(value.models);
  return value;
}

/** A caller cannot supply an origin, arbitrary request body, paid alias, tools,
 * or fallback provider. Responses are untrusted proposals, never commands. */
export function createTokenHarborClient({ readToken, models = [], fetchImpl = fetch,
  timeoutMs = 45_000, maxBytes = 1024 * 1024 } = {}) {
  const allowed = new Set(assertFreeModels(models));
  if (typeof readToken !== "function" || typeof fetchImpl !== "function" ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000 ||
      !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 2 * 1024 * 1024)
    throw new Error("Invalid bounded TokenHarbor client configuration");
  const request = async (route, body) => {
    let status = null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const token = await readToken();
      if (!keyPattern.test(token ?? "")) throw new Error("Credential");
      const response = await fetchImpl(tokenHarborOrigin + route, {
        method: body === undefined ? "GET" : "POST", redirect: "error",
        credentials: "omit", cache: "no-store", signal: controller.signal,
        headers: { accept: "application/json", authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (Number.isInteger(response.status) && response.status >= 100 && response.status <= 599)
        status = response.status;
      if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "") ||
          !response.body) {
        await response.body?.cancel().catch(() => {});
        throw new Error("Unavailable");
      }
      const length = response.headers.get("content-length");
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
        await response.body.cancel().catch(() => {});
        throw new Error("Oversize");
      }
      const reader = response.body.getReader(), chunks = [];
      let size = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > maxBytes) throw new Error("Oversize");
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      const text = Buffer.concat(chunks, size).toString("utf8");
      // A malicious upstream cannot reflect this credential into CLI output.
      if (text.includes(token)) throw new Error("Credential reflection");
      return JSON.parse(text);
    } catch {
      throw new Error(`TokenHarbor request was not confirmed${status !== null ? ` (HTTP ${status})` : ""}; no retry or paid fallback`);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  };
  return Object.freeze({
    discover: async () => {
      const result = await request("/models");
      if (!Array.isArray(result.data) || result.data.length > 512)
        throw new Error("TokenHarbor model catalogue is unsupported");
      // Catalogue discovery is not proof of remaining generation quota.
      return assertFreeModels(result.data.filter((item) =>
        typeof item?.id === "string" && freePattern.test(item.id)).map((item) => item.id));
    },
    generate: async ({ model, prompt, maxOutputTokens = 512 } = {}) => {
      if (!freePattern.test(model ?? "") || !allowed.has(model))
        throw new Error("An enrolled explicit :free model is required; paid routes are disabled");
      if (typeof prompt !== "string" || prompt.length === 0 ||
          Buffer.byteLength(prompt, "utf8") > 32_768 ||
          !Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 1024)
        throw new Error("TokenHarbor prompt or output exceeds the finite bounds");
      const result = await request("/chat/completions", {
        model, messages: [{ role: "user", content: prompt }],
        max_tokens: maxOutputTokens, stream: false,
      });
      const message = result.choices?.[0]?.message;
      if (!Array.isArray(result.choices) || result.choices.length !== 1 ||
          typeof message?.content !== "string" ||
          Buffer.byteLength(message.content, "utf8") > 131_072 ||
          (message.tool_calls?.length ?? 0) !== 0 || message.function_call != null)
        throw new Error("TokenHarbor returned an unsupported proposal; no execution or fallback");
      const cost = result.usage?.cost ?? result.usage?.total_cost;
      if (cost !== undefined && cost !== 0 && cost !== "0")
        throw new Error("TokenHarbor reported a nonzero free-route cost; stop and inspect billing");
      return Object.freeze({ requestedModel: model, text: message.content,
        completionTokens: Number.isSafeInteger(result.usage?.completion_tokens)
          ? result.usage.completion_tokens : null,
        finishReason: typeof result.choices[0].finish_reason === "string"
          ? result.choices[0].finish_reason.slice(0, 32) : null });
    },
  });
}

function writeState(filename, value) {
  mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = filename + "." + randomUUID() + ".tmp";
  writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  renameSync(temporary, filename);
}

async function readSecretInput() {
  let text = "";
  const raw = process.stdin.isTTY && typeof process.stdin.setRawMode === "function";
  if (raw) process.stdin.setRawMode(true);
  process.stdout.write("Ready for secret input (no echo).\n");
  try {
    for await (const chunk of process.stdin) {
      text += chunk.toString("utf8");
      if (text.length > 1024 || text.includes("\u0003")) throw new Error("Secret input cancelled");
      if (/[\r\n]/.test(text)) break;
    }
  } finally {
    if (raw) process.stdin.setRawMode(false);
    process.stdin.pause();
  }
  const token = text.replace(/[\r\n]+$/, "");
  if (!keyPattern.test(token)) throw new Error("Invalid TokenHarbor key format");
  return token;
}

export async function enrolledClient(models) {
  const enrollment = readEnrollment();
  const { readBridgeCredential } = await import(secretModule);
  return createTokenHarborClient({ models: models ?? enrollment.models,
    readToken: () => readBridgeCredential(enrollment.protectedKeyFile) });
}

async function main(action) {
  if (!["enroll", "probe", "test"].includes(action))
    throw new Error("Use enroll, probe or test; no arbitrary command execution");
  if (action === "enroll") {
    if (existsSync(enrollmentFile) || existsSync(protectedKeyFile))
      throw new Error("TokenHarbor already has local enrollment; no credential was overwritten");
    const token = await readSecretInput();
    const { persistBridgeCredential } = await import(secretModule);
    await persistBridgeCredential(protectedKeyFile, { token,
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString() });
    writeState(enrollmentFile, { version: 1, providerId: "tokenharbor", baseUrl: tokenHarborOrigin,
      protectedKeyFile, freeOnly: true, paidFallback: false,
      promptScope: "synthetic-and-public", models: [], checkedAt: null });
  }
  const enrollment = readEnrollment();
  const client = await enrolledClient();
  const models = await client.discover();
  writeState(enrollmentFile, { ...enrollment, models, checkedAt: new Date().toISOString() });
  const receipt = { version: 1, providerId: "tokenharbor", state: "configured",
    checkedAt: new Date().toISOString(), credentialProtection: "Windows DPAPI CurrentUser",
    freeOnly: true, paidFallback: false, freeModels: models,
    generation: "not_tested", quota: "not_verified", modelCalls: 0,
    automaticJobRouting: "unchanged", nativeT3ProviderEntry: "not_created" };
  if (action === "test") {
    const model = models.find((id) => /deepseek.*flash/i.test(id)) ?? models[0];
    if (!model) throw new Error("No explicit :free route was discovered; no paid substitute");
    const completion = await (await enrolledClient(models)).generate({ model,
      prompt: "Reply with exactly TOKENHARBOR_FREE_READY and nothing else.", maxOutputTokens: 128 });
    receipt.modelCalls = 1;
    receipt.testedModel = model;
    receipt.generation = completion.text.trim() === "TOKENHARBOR_FREE_READY"
      ? "synthetic_probe_passed" : "response_received_marker_mismatch";
    receipt.state = "connected";
    receipt.quota = "one_free_request_accepted_not_a_remaining_quota_measurement";
    receipt.completionTokens = completion.completionTokens;
  }
  writeState(path.join(tokenHarborStateRoot, "artifacts/tokenharbor-connection.json"), receipt);
  console.log(JSON.stringify(receipt));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv[2]).catch((error) => {
    // No upstream error body, key, pairing material or local private state is logged.
    const message = error instanceof Error &&
      /^(TokenHarbor |No explicit :free |Use enroll|Invalid TokenHarbor|Secret input)/.test(error.message)
      ? error.message : "TokenHarbor setup was not confirmed; no retry or paid fallback";
    console.error(message);
    process.exitCode = 1;
  });
}
