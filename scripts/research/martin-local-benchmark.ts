import { execFile } from "node:child_process";
import { promisify } from "node:util";

const sleep = promisify(setTimeout);

export const MARTIN_TRIAL_LIMITS = Object.freeze({
  maxRps: 500,
  maxDurationSeconds: 600,
  maxInFlight: 64,
  maxBatchSize: 8,
  maxTimeoutMs: 5_000,
  maxResponseBytes: 2_000_000,
  maxLatencySamples: 20_000,
  processSampleCap: 150,
});

const MARTIN_EXE = "D:\\Yellow\\temp\\order724-martin-trial\\bin\\martin.exe";
const TRIAL_ROOT = "D:\\Yellow\\temp\\order724-martin-trial\\";
const SOURCE_PATH = /^\/[A-Za-z0-9._-]+\/(?:0|[1-9][0-9]*)\/(?:0|[1-9][0-9]*)\/(?:0|[1-9][0-9]*)$/u;

export interface MartinBenchmarkConfig {
  readonly baseUrl: string;
  readonly tilePath: string;
  readonly rps: number;
  readonly durationSeconds: number;
  readonly maxInFlight: number;
  readonly timeoutMs: number;
  readonly batchSize: number;
  readonly serverPid: number;
  readonly serverPath: string;
}

export interface ProcessSample {
  readonly id: number;
  readonly path: string;
  readonly startedAt: string;
  readonly cpuMs: number;
  readonly workingSetBytes: number;
}

export interface BenchmarkDependencies {
  readonly fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
  readonly now?: () => number;
  readonly pause?: (milliseconds: number) => Promise<void>;
  readonly random?: () => number;
  readonly processStats?: (pid: number) => Promise<ProcessSample>;
  readonly progress?: (progress: Readonly<{ scheduled: number; sent: number; completed: number; dropped: number;
    schedulerDrops: number; inFlightDrops: number; maxObservedInFlight: number; maxWakeLatenessMs: number }>) => void;
}

function fail(message: string): never { throw new Error(message); }

function parsePositiveInteger(value: string | undefined, name: string, max: number): number {
  if (!value || !/^[1-9][0-9]*$/u.test(value)) fail(`${name} must be a positive integer`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > max) fail(`${name} exceeds its trial limit`);
  return number;
}

function normalizeServerPath(value: string): string {
  const path = value.replaceAll("/", "\\");
  if (path.toLowerCase() !== MARTIN_EXE.toLowerCase() || !path.toLowerCase().startsWith(TRIAL_ROOT.toLowerCase())) {
    fail("server executable must be the verified Order724 Martin path");
  }
  return path;
}

export function validateMartinBenchmarkConfig(config: MartinBenchmarkConfig): MartinBenchmarkConfig {
  let base: URL;
  try { base = new URL(config.baseUrl); } catch { return fail("base URL is invalid"); }
  if (base.protocol !== "http:" || base.hostname !== "127.0.0.1" || base.port !== "3054" ||
      base.pathname !== "/" || base.search || base.hash || base.username || base.password) {
    fail("benchmark target must be the isolated HTTP listener at 127.0.0.1:3054");
  }
  let tileUrl: URL;
  try { tileUrl = new URL(config.tilePath, base); } catch { return fail("tile path must be one canonical local tile route"); }
  if (!SOURCE_PATH.test(config.tilePath) || decodeURIComponent(config.tilePath) !== config.tilePath ||
      /\/(?:\.{1,2})(?:\/|$)/u.test(config.tilePath) || tileUrl.origin !== base.origin || tileUrl.pathname !== config.tilePath ||
      tileUrl.search || tileUrl.hash) fail("tile path must be one canonical local tile route");
  if (!Number.isSafeInteger(config.rps) || config.rps < 1 || config.rps > MARTIN_TRIAL_LIMITS.maxRps) fail("rate exceeds the trial limit");
  if (!Number.isSafeInteger(config.durationSeconds) || config.durationSeconds < 1 || config.durationSeconds > MARTIN_TRIAL_LIMITS.maxDurationSeconds) fail("duration exceeds the trial limit");
  if (!Number.isSafeInteger(config.maxInFlight) || config.maxInFlight < 1 || config.maxInFlight > MARTIN_TRIAL_LIMITS.maxInFlight) fail("in-flight cap exceeds the trial limit");
  if (!Number.isSafeInteger(config.timeoutMs) || config.timeoutMs < 100 || config.timeoutMs > MARTIN_TRIAL_LIMITS.maxTimeoutMs) fail("request timeout exceeds the trial limit");
  if (!Number.isSafeInteger(config.batchSize) || config.batchSize < 1 || config.batchSize > MARTIN_TRIAL_LIMITS.maxBatchSize) fail("batch size exceeds the trial limit");
  if (!Number.isSafeInteger(config.serverPid) || config.serverPid < 1) fail("server PID is invalid");
  normalizeServerPath(config.serverPath);
  return Object.freeze({ ...config, serverPath: normalizeServerPath(config.serverPath) });
}

export function parseMartinBenchmarkArgs(argv: readonly string[]): MartinBenchmarkConfig {
  const required = new Set(["--base-url", "--tile-path", "--rps", "--duration-seconds", "--max-in-flight", "--timeout-ms", "--server-pid", "--server-path"]);
  const accepted = new Set([...required, "--batch-size"]);
  const values = new Map<string, string>();
  if (argv.length % 2 !== 0) fail("arguments must be name/value pairs");
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]; const value = argv[index + 1];
    if (!key || !value || !accepted.has(key) || values.has(key)) fail("invalid benchmark arguments");
    values.set(key, value);
  }
  for (const key of required) if (!values.has(key)) fail("all benchmark arguments are required");
  if (values.size < required.size || values.size > accepted.size) fail("invalid benchmark arguments");
  return validateMartinBenchmarkConfig({
    baseUrl: values.get("--base-url")!, tilePath: values.get("--tile-path")!,
    rps: parsePositiveInteger(values.get("--rps"), "rate", MARTIN_TRIAL_LIMITS.maxRps),
    durationSeconds: parsePositiveInteger(values.get("--duration-seconds"), "duration", MARTIN_TRIAL_LIMITS.maxDurationSeconds),
    maxInFlight: parsePositiveInteger(values.get("--max-in-flight"), "in-flight cap", MARTIN_TRIAL_LIMITS.maxInFlight),
    timeoutMs: parsePositiveInteger(values.get("--timeout-ms"), "timeout", MARTIN_TRIAL_LIMITS.maxTimeoutMs),
    batchSize: values.has("--batch-size") ? parsePositiveInteger(values.get("--batch-size"), "batch size", MARTIN_TRIAL_LIMITS.maxBatchSize) : 1,
    serverPid: parsePositiveInteger(values.get("--server-pid"), "server PID", 2_147_483_647),
    serverPath: values.get("--server-path")!,
  });
}

function parseProcessSample(json: string): ProcessSample {
  const value = JSON.parse(json) as Record<string, unknown>;
  if (!Number.isSafeInteger(value.id) || typeof value.path !== "string" || typeof value.startedAt !== "string" ||
      typeof value.cpuMs !== "number" || !Number.isFinite(value.cpuMs) ||
      typeof value.workingSetBytes !== "number" || !Number.isSafeInteger(value.workingSetBytes) || value.workingSetBytes < 0) {
    fail("server process metrics are invalid");
  }
  return Object.freeze({ id: value.id as number, path: value.path, startedAt: value.startedAt,
    cpuMs: value.cpuMs, workingSetBytes: value.workingSetBytes });
}

export async function readMartinProcessSample(pid: number): Promise<ProcessSample> {
  if (!Number.isSafeInteger(pid) || pid < 1) fail("server PID is invalid");
  const command = `$p=Get-Process -Id ${pid} -ErrorAction Stop; [pscustomobject]@{id=$p.Id;path=$p.Path;startedAt=$p.StartTime.ToUniversalTime().ToString('o');cpuMs=$p.TotalProcessorTime.TotalMilliseconds;workingSetBytes=$p.WorkingSet64} | ConvertTo-Json -Compress`;
  const result = await new Promise<string>((resolve, reject) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command],
      { encoding: "utf8", timeout: 3_000, windowsHide: true, maxBuffer: 16_384 },
      (error, stdout) => error ? reject(error) : resolve(stdout));
  });
  return parseProcessSample(result.trim());
}

function addReservoir(sample: number, count: number, reservoir: number[], random: () => number): void {
  if (reservoir.length < MARTIN_TRIAL_LIMITS.maxLatencySamples) { reservoir.push(sample); return; }
  const slot = Math.floor(random() * count);
  if (slot < reservoir.length) reservoir[slot] = sample;
}

function percentile(samples: readonly number[], fraction: number): number | null {
  if (samples.length === 0) return null;
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)] ?? null;
}

async function consumeResponse(response: Response): Promise<Readonly<{ bytes: number; tooLarge: boolean }>> {
  if (!response.body) return Object.freeze({ bytes: 0, tooLarge: false });
  const reader = response.body.getReader();
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) return Object.freeze({ bytes, tooLarge: false });
      bytes += part.value.byteLength;
      if (bytes > MARTIN_TRIAL_LIMITS.maxResponseBytes) {
        await reader.cancel();
        return Object.freeze({ bytes, tooLarge: true });
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* cancellation can retain the stream lock briefly */ }
  }
}

export async function runMartinRateWindow(configValue: MartinBenchmarkConfig, dependencies: BenchmarkDependencies = {}) {
  const config = validateMartinBenchmarkConfig(configValue);
  const now = dependencies.now ?? (() => performance.now());
  const pause = dependencies.pause ?? ((milliseconds) => sleep(milliseconds).then(() => undefined));
  const fetcher = dependencies.fetcher ?? fetch;
  const random = dependencies.random ?? Math.random;
  const planned = config.rps * config.durationSeconds;
  const batchSize = config.batchSize;
  const batchIntervalMs = batchSize * 1_000 / config.rps;
  const plannedBatches = Math.ceil(planned / batchSize);
  let scheduled = 0; let sent = 0; let completed = 0; let successful = 0; let dropped = 0;
  let schedulerDrops = 0; let inFlightDrops = 0; let maxObservedInFlight = 0;
  let wakeLatenessCount = 0; let maxWakeLatenessMs = 0;
  let scheduledBatches = 0; let missedBatches = 0;
  let timeouts = 0; let networkErrors = 0; let non2xx = 0; let oversized = 0;
  let bodyBytesConsumed = 0; let declaredContentLengthBytes = 0;
  const statusCounts: Record<string, number> = {};
  const encodings: Record<string, number> = {};
  const samples: number[] = [];
  const wakeLatenessSamples: number[] = [];
  const pending = new Set<Promise<void>>();
  const processSamples: ProcessSample[] = [];
  let processSampleErrors = 0;
  const processIdentity: { current: ProcessSample | null } = { current: null };
  let trafficElapsedMs = 0;
  let completionElapsedMs = 0;
  const fetchUri = new URL(config.tilePath, config.baseUrl).href;
  let processSamplePromise: Promise<void> | null = null;
  const takeProcessSample = async () => {
    if (!dependencies.processStats || processSamples.length >= MARTIN_TRIAL_LIMITS.processSampleCap) return;
    if (processSamplePromise) return processSamplePromise;
    processSamplePromise = (async () => {
      try {
        const sample = await dependencies.processStats!(config.serverPid);
        if (sample.id !== config.serverPid || normalizeServerPath(sample.path) !== config.serverPath ||
            (processIdentity.current && sample.startedAt !== processIdentity.current.startedAt)) {
          processSampleErrors++;
          return;
        }
        processIdentity.current ??= sample;
        processSamples.push(sample);
      } catch { processSampleErrors++; }
    })().finally(() => { processSamplePromise = null; });
    return processSamplePromise;
  };
  await takeProcessSample();
  const startedAt = now();
  const processTimer = dependencies.processStats ? setInterval(() => { void takeProcessSample(); }, 5_000) : null;
  const runOne = async () => {
    const requestStarted = now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    let countedLatency = false;
    try {
      const response = await fetcher(fetchUri, { method: "GET", cache: "no-store", redirect: "error", signal: controller.signal,
        headers: { accept: "image/png,application/vnd.mapbox-vector-tile,*/*" } });
      statusCounts[String(response.status)] = (statusCounts[String(response.status)] ?? 0) + 1;
      const encoding = response.headers.get("content-encoding")?.toLowerCase() ?? "identity";
      encodings[encoding] = (encodings[encoding] ?? 0) + 1;
      const length = response.headers.get("content-length");
      if (length && /^[0-9]+$/u.test(length)) declaredContentLengthBytes += Number(length);
      const result = await consumeResponse(response);
      bodyBytesConsumed += result.bytes;
      completed++;
      if (result.tooLarge) oversized++;
      if (!response.ok) non2xx++;
      if (response.ok && !result.tooLarge) successful++;
      countedLatency = true;
      addReservoir(Math.max(0, now() - requestStarted), completed, samples, random);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) timeouts++;
      else networkErrors++;
    } finally {
      clearTimeout(timeout);
      if (!countedLatency && now() > requestStarted) {
        // Failed/timeout samples are counted separately and excluded from successful-response latency quantiles.
      }
    }
  };
  let nextSlot = 0;
  let lastProgressAt = startedAt;
  const progressSnapshot = () => Object.freeze({ scheduled, sent, completed, dropped, schedulerDrops,
    inFlightDrops, scheduledBatches, missedBatches, maxObservedInFlight, maxWakeLatenessMs });
  try {
    while (nextSlot < plannedBatches) {
      const targetAt = startedAt + nextSlot * batchIntervalMs;
      const before = now();
      if (targetAt > before) await pause(targetAt - before);
      const current = now();
      const wakeLatenessMs = Math.max(0, current - targetAt);
      wakeLatenessCount++;
      maxWakeLatenessMs = Math.max(maxWakeLatenessMs, wakeLatenessMs);
      addReservoir(wakeLatenessMs, wakeLatenessCount, wakeLatenessSamples, random);
      if (current - startedAt >= config.durationSeconds * 1_000) {
        const missedBatchesNow = plannedBatches - nextSlot;
        const missed = planned - nextSlot * batchSize;
        scheduled += missed;
        dropped += missed;
        schedulerDrops += missed;
        scheduledBatches += missedBatchesNow;
        missedBatches += missedBatchesNow;
        break;
      }
      const latestDueBatch = Math.min(plannedBatches - 1, Math.max(nextSlot, Math.floor((current - startedAt) / batchIntervalMs)));
      if (latestDueBatch > nextSlot) {
        const skippedBatches = latestDueBatch - nextSlot;
        const skippedRequests = Math.min(planned, latestDueBatch * batchSize) - Math.min(planned, nextSlot * batchSize);
        scheduled += skippedRequests;
        dropped += skippedRequests;
        schedulerDrops += skippedRequests;
        scheduledBatches += skippedBatches;
        missedBatches += skippedBatches;
        nextSlot = latestDueBatch;
      }
      scheduledBatches++;
      const requestCount = Math.min(batchSize, planned - nextSlot * batchSize);
      for (let requestIndex = 0; requestIndex < requestCount; requestIndex++) {
        if (now() - startedAt >= config.durationSeconds * 1_000) {
          const unsentInBatch = requestCount - requestIndex;
          scheduled += unsentInBatch;
          dropped += unsentInBatch;
          schedulerDrops += unsentInBatch;
          break;
        }
        scheduled++;
        if (pending.size >= config.maxInFlight) { dropped++; inFlightDrops++; }
        else {
          sent++;
          let request!: Promise<void>;
          request = runOne().finally(() => pending.delete(request));
          pending.add(request);
          maxObservedInFlight = Math.max(maxObservedInFlight, pending.size);
        }
      }
      nextSlot++;
      if (dependencies.progress && current - lastProgressAt >= 10_000) {
        dependencies.progress(progressSnapshot());
        lastProgressAt = current;
      }
    }
    const remainingWindowMs = startedAt + config.durationSeconds * 1_000 - now();
    if (remainingWindowMs > 0) await pause(remainingWindowMs);
    trafficElapsedMs = Math.max(1, now() - startedAt);
    await Promise.all(pending);
    completionElapsedMs = Math.max(trafficElapsedMs, now() - startedAt);
    if (dependencies.progress) dependencies.progress(progressSnapshot());
  } finally {
    if (processTimer) clearInterval(processTimer);
    await takeProcessSample();
  }
  const firstSample = processSamples[0] ?? null; const lastSample = processSamples.at(-1) ?? null;
  return Object.freeze({
    endpoint: fetchUri, configuredRps: config.rps, durationSeconds: config.durationSeconds,
    pacingProtocol: batchSize === 1 ? "steady-individual-slots" : "burst-average-rate",
    batchSize, batchIntervalMs, plannedBatches, scheduledBatches, missedBatches,
    maxInFlight: config.maxInFlight, timeoutMs: config.timeoutMs,
    trafficElapsedMs: Math.round(trafficElapsedMs), requestCompletionElapsedMs: Math.round(completionElapsedMs),
    scheduled, sent, completed, successful, dropped, timeouts, networkErrors, non2xx, oversized,
    schedulerDrops, inFlightDrops, maxObservedInFlight,
    slotWakeLatenessMs: Object.freeze({ method: "uniform-reservoir-of-scheduled-slot-wake-lateness",
      observedSlots: wakeLatenessCount, retainedSamples: wakeLatenessSamples.length, max: maxWakeLatenessMs,
      p50: percentile(wakeLatenessSamples, 0.50), p95: percentile(wakeLatenessSamples, 0.95),
      p99: percentile(wakeLatenessSamples, 0.99) }),
    achievedSentRps: Number((sent / (trafficElapsedMs / 1_000)).toFixed(2)),
    achievedCompletedRps: Number((completed / (completionElapsedMs / 1_000)).toFixed(2)),
    bodyBytesConsumed, declaredContentLengthBytes,
    statusCounts: Object.freeze(statusCounts), contentEncodings: Object.freeze(encodings),
    latencyMs: Object.freeze({ method: "uniform-reservoir-of-completed-responses", retainedSamples: samples.length,
      p50: percentile(samples, 0.50), p95: percentile(samples, 0.95), p99: percentile(samples, 0.99) }),
    serverProcess: Object.freeze({ pid: config.serverPid, path: config.serverPath,
      startTimeUtc: processIdentity.current?.startedAt ?? null,
      cpuMilliseconds: firstSample && lastSample ? Math.max(0, lastSample.cpuMs - firstSample.cpuMs) : null,
      workingSetSampleCount: processSamples.length,
      workingSetMinBytes: processSamples.length ? Math.min(...processSamples.map((sample) => sample.workingSetBytes)) : null,
      workingSetMaxBytes: processSamples.length ? Math.max(...processSamples.map((sample) => sample.workingSetBytes)) : null,
      processSampleErrors }),
  });
}

if (import.meta.main) {
  try {
    const config = parseMartinBenchmarkArgs(process.argv.slice(2));
    const result = await runMartinRateWindow(config, { processStats: readMartinProcessSample,
      progress: (progress) => process.stderr.write(`progress ${JSON.stringify(progress)}\n`) });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`Martin local benchmark failed: ${error instanceof Error ? error.message : "invalid_trial"}\n`);
    process.exitCode = 1;
  }
}
