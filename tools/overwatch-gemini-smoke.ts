interface SmokeResponse {
  readonly status: number;
  readonly json: Record<string, unknown>;
}

interface SmokeResult {
  readonly ok: boolean;
  readonly configured: boolean;
  readonly liveGeminiProved: boolean;
  readonly providerModel: string | null;
  readonly nonOperationalProvider: unknown;
  readonly nonOperationalTextPresent: boolean;
  readonly operationalProvider: unknown;
  readonly operationalRequiresConfirmation: unknown;
  readonly operationalExecuted: unknown;
  readonly failureReason: string | null;
}

const port = 43189;
const baseUrl = `http://127.0.0.1:${port}`;

const server = Bun.spawn(["bun", "src/server.ts"], {
  env: { ...Bun.env, PORT: String(port) },
  stdout: "pipe",
  stderr: "pipe",
});

try {
  await waitForHttp(`${baseUrl}/health`, 10_000);
  const provider = await getJson("/api/v1/overwatch/provider");
  if (provider.status !== 200) throw new Error(`provider status returned ${provider.status}`);
  const configured = provider.json.configured === true;
  if (!configured) {
    const result: SmokeResult = {
      ok: true,
      configured: false,
      liveGeminiProved: false,
      providerModel: typeof provider.json.model === "string" ? provider.json.model : null,
      nonOperationalProvider: null,
      nonOperationalTextPresent: false,
      operationalProvider: null,
      operationalRequiresConfirmation: null,
      operationalExecuted: null,
      failureReason: "Gemini key not configured for this process.",
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  const nonOperational = await postJson("/api/v1/overwatch/message", {
    prompt: "For the colleague demo, explain in one short sentence what Yellow Overwatch can safely help with.",
  });
  const operational = await postJson("/api/v1/overwatch/message", {
    prompt: "Please check in Sara Al Harbi now",
  });

  const nonOperationalTextPresent = typeof nonOperational.json.message === "string" && nonOperational.json.message.trim() !== "";
  const ok = nonOperational.status === 200
      && nonOperational.json.provider === "gemini"
      && nonOperational.json.geminiConnected === true
      && nonOperationalTextPresent
      && operational.status === 200
      && operational.json.provider === "deterministic-local"
      && operational.json.requiresConfirmation === true
      && operational.json.executed === false;
  const result: SmokeResult = {
    ok,
    configured: true,
    liveGeminiProved: nonOperational.status === 200 && nonOperational.json.provider === "gemini" && nonOperational.json.geminiConnected === true && nonOperationalTextPresent,
    providerModel: typeof provider.json.model === "string" ? provider.json.model : null,
    nonOperationalProvider: nonOperational.json.provider,
    nonOperationalTextPresent,
    operationalProvider: operational.json.provider,
    operationalRequiresConfirmation: operational.json.requiresConfirmation,
    operationalExecuted: operational.json.executed,
    failureReason: ok ? null : [
      `nonOperational.status=${nonOperational.status}`,
      `nonOperational.provider=${String(nonOperational.json.provider)}`,
      `nonOperational.geminiConnected=${String(nonOperational.json.geminiConnected)}`,
      `nonOperational.textPresent=${String(nonOperationalTextPresent)}`,
      `operational.status=${operational.status}`,
      `operational.provider=${String(operational.json.provider)}`,
      `operational.requiresConfirmation=${String(operational.json.requiresConfirmation)}`,
      `operational.executed=${String(operational.json.executed)}`,
    ].join("; "),
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
} finally {
  server.kill();
  await server.exited.catch(() => undefined);
}

async function getJson(path: string): Promise<SmokeResponse> {
  const response = await fetch(`${baseUrl}${path}`);
  return { status: response.status, json: await response.json() as Record<string, unknown> };
}

async function postJson(path: string, body: Record<string, unknown>): Promise<SmokeResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() as Record<string, unknown> };
}

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
