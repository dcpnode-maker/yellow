import { execFile as execFileCallback } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, test } from "bun:test";
import type { EventEmitter as NodeEventEmitter } from "node:events";
import type {
  MarketRegionalArtifactCatalogErrorCode,
  MarketRegionalArtifactCatalogResult,
} from "../src/runtime/market-regional-artifact-loader";

const PROBE_ENVIRONMENT = "YELLOW_MARKET_REGIONAL_LOADER_PROBE";
const PROBE_PREFIX = "YELLOW_MARKET_REGIONAL_LOADER_PROBE:";
const SOURCE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const execFile = promisify(execFileCallback);

type ProbeScenario = "valid" | "malformed" | "stdout" | "stderr" | "stdout_error" | "stderr_error" | "nonzero" | "timeout";

interface SupervisionProbe {
  readonly result: unknown;
  readonly killed: boolean;
  readonly args: readonly string[];
  readonly options: unknown;
  readonly timeoutDelay: number | null;
}

function expectedFailure(code: MarketRegionalArtifactCatalogErrorCode): MarketRegionalArtifactCatalogResult {
  return { ok: false, error: { code, message: "Market regional artifact catalog could not be loaded." } };
}

function probeScenario(value: string | undefined): ProbeScenario | null {
  return value === "valid" || value === "malformed" || value === "stdout" || value === "stderr"
    || value === "stdout_error" || value === "stderr_error" || value === "nonzero" || value === "timeout" ? value : null;
}

/** The child runs this same test file under Bun's test mock transform, then exits. */
async function runIsolatedTransportProbe(scenario: ProbeScenario): Promise<void> {
  const { mock } = await import("bun:test");
  const { EventEmitter } = await import("node:events");
  let captured: { args: readonly string[]; options: unknown; child: NodeEventEmitter & { killed: boolean } } | null = null;
  let timeoutDelay: number | null = null;
  mock.module("node:child_process", () => ({
    spawn: (_executable: string, args: string[], options: unknown) => {
      const child = new EventEmitter() as NodeEventEmitter & { stdout: NodeEventEmitter; stderr: NodeEventEmitter; killed: boolean; kill(): boolean };
      Object.defineProperties(child, {
        stdout: { value: new EventEmitter() },
        stderr: { value: new EventEmitter() },
        killed: { value: false, writable: true },
        kill: { value: () => { child.killed = true; return true; } },
      });
      captured = { args: Object.freeze([...args]), options, child };
      queueMicrotask(() => {
        if (scenario === "valid") {
          const bytes = new Uint8Array(41_226);
          child.stdout.emit("data", Buffer.from(JSON.stringify({
            format: "yellow/market-regional-read/v1", byteLength: bytes.byteLength, bytesBase64: Buffer.from(bytes).toString("base64"),
          })));
          child.emit("close", 0);
        } else if (scenario === "malformed") {
          child.stdout.emit("data", Buffer.from("{bad"));
          child.emit("close", 0);
        } else if (scenario === "stdout") {
          child.stdout.emit("data", { byteLength: 6_000_000 });
        } else if (scenario === "stderr") {
          child.stderr.emit("data", { byteLength: 70_000 });
        } else if (scenario === "stdout_error") {
          child.stdout.emit("error", new Error("simulated stream error"));
        } else if (scenario === "stderr_error") {
          child.stderr.emit("error", new Error("simulated stream error"));
        } else if (scenario === "nonzero") {
          child.emit("close", 1);
        } else {
          queueMicrotask(() => child.stdout.emit("data", { byteLength: 6_000_000 }));
        }
      });
      return child;
    },
  }));
  Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  if (scenario === "timeout") {
    globalThis.setTimeout = ((callback: () => void, delay?: number) => {
      timeoutDelay = delay ?? null;
      queueMicrotask(callback);
      return 1 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;
    globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;
  }
  try {
    const loader = await import("../src/runtime/market-regional-artifact-loader");
    const result = await loader.loadMarketRegionalArtifactCatalog({ rootDirectory: "E:\\test-root", powershellPath: "C:\\test-bin\\pwsh.exe" });
    if (captured === null) throw new Error("mocked child was not started");
    const completed = captured as { args: readonly string[]; options: unknown; child: NodeEventEmitter & { killed: boolean } };
    console.log(`${PROBE_PREFIX}${JSON.stringify({ result, killed: completed.child.killed, args: completed.args, options: completed.options, timeoutDelay })}`);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}

async function probeSupervisedChild(scenario: ProbeScenario): Promise<SupervisionProbe> {
  const { stdout } = await execFile(process.execPath, ["test", "tests/market-regional-artifact-loader.test.ts"], {
    cwd: SOURCE_ROOT,
    encoding: "utf8",
    env: { ...process.env, [PROBE_ENVIRONMENT]: scenario },
    shell: false,
    windowsHide: true,
    timeout: 4_000,
    maxBuffer: 131_072,
  });
  const marker = stdout.split(/\r?\n/u).find((line) => line.startsWith(PROBE_PREFIX));
  expect(marker).toBeDefined();
  return JSON.parse(marker!.slice(PROBE_PREFIX.length)) as SupervisionProbe;
}

const isolatedScenario = probeScenario(process.env[PROBE_ENVIRONMENT]);
if (isolatedScenario !== null) {
  await runIsolatedTransportProbe(isolatedScenario);
} else {
  describe("Order472 explicit regional artifact runtime catalog", () => {
    test("has no import-time reader call and invokes only an explicit frozen server-owned request", async () => {
      const loader = await import("../src/runtime/market-regional-artifact-loader");
      let calls = 0;
      const result = await loader.loadMarketRegionalArtifactCatalog({
        rootDirectory: "E:\\test-root",
        readBytes: async (request) => {
          calls += 1;
          expect(Object.isFrozen(request)).toBe(true);
          expect(request.rootDirectory).toBe("E:\\test-root");
          expect(request.relativePath).toBe("region-20260913T080233Z-139ffad96f59497a9a19d547792d070e\\region.json");
          expect(request.expectedLength).toBe(41_226);
          throw new Error("simulated bounded reader failure");
        },
      });
      expect(calls).toBe(1);
      expect(result).toEqual(expectedFailure("reader_failed"));
      expect("value" in result).toBe(false);
    });

    test("fails the complete catalog without publishing partial values for malformed, truncated, or oversized bytes", async () => {
      const loader = await import("../src/runtime/market-regional-artifact-loader");
      for (const bytes of [
        Uint8Array.of(0x7b, 0x7d),
        Uint8Array.of(0x7b),
        new Uint8Array(loader.MARKET_REGIONAL_ARTIFACT_LOADER_LIMITS.maximumArtifactBytes + 1),
      ]) {
        let calls = 0;
        const result = await loader.loadMarketRegionalArtifactCatalog({
          rootDirectory: "E:\\test-root",
          readBytes: async () => { calls += 1; return bytes; },
        });
        expect(calls).toBe(1);
        expect(result).toEqual(expectedFailure("admission_failed"));
        expect("value" in result).toBe(false);
      }
    });

    test("supervises a shell-free mocked child with exact arguments and strict receipt parsing", async () => {
      const probe = await probeSupervisedChild("valid");
      expect(probe.result).toEqual(expectedFailure("admission_failed"));
      expect(probe.args.slice(0, 6)).toEqual(["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File"]);
      expect(probe.args.slice(-6)).toEqual(["-RootDirectory", "E:\\test-root", "-RelativePath", "region-20260913T080233Z-139ffad96f59497a9a19d547792d070e\\region.json", "-ExpectedLength", "41226"]);
      expect(probe.options).toEqual({ shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      expect(probe.killed).toBe(false);
    }, 10_000);

    test("rejects malformed, output-bound, stream-error, and nonzero mocked child receipts without partial values", async () => {
      for (const scenario of ["malformed", "stdout", "stderr", "stdout_error", "stderr_error", "nonzero"] as const) {
        const probe = await probeSupervisedChild(scenario);
        expect(probe.result).toEqual(expectedFailure("reader_failed"));
        expect(probe.killed).toBe(scenario !== "malformed" && scenario !== "nonzero");
      }
    }, 30_000);

    test("uses the real 15-second timeout callback against an isolated owned-child mock and ignores late output", async () => {
      const probe = await probeSupervisedChild("timeout");
      expect(probe.result).toEqual(expectedFailure("reader_failed"));
      expect(probe.killed).toBe(true);
      expect(probe.timeoutDelay).toBe(15_000);
    }, 10_000);

    test("rejects unsafe Windows override segments and hostile options before any reader call", async () => {
      const loader = await import("../src/runtime/market-regional-artifact-loader");
      let reads = 0;
      const hostile = {};
      Object.defineProperty(hostile, "rootDirectory", { enumerable: true, get: () => { reads += 1; return "E:\\test-root"; } });
      expect(await loader.loadMarketRegionalArtifactCatalog(hostile)).toEqual(expectedFailure("invalid_options"));
      expect(reads).toBe(0);

      for (const rootDirectory of [
        "E:test-root", "\\\\server\\share", "E:\\test-root\\..\\elsewhere", "E:\\test-root\\.", "E:\\test-root\\tail. ",
        "E:\\test-root\\CON", "E:\\test-root\\folder:stream", "E:\\test-root\\",
      ]) {
        const result = await loader.loadMarketRegionalArtifactCatalog({ rootDirectory, readBytes: async () => Uint8Array.of() });
        expect(result).toEqual(expectedFailure("invalid_options"));
      }

      expect(await loader.loadMarketRegionalArtifactCatalog({
        rootDirectory: "E:\\test-root",
        readBytes: async () => Uint8Array.of(),
        entries: [],
      } as unknown as Parameters<typeof loader.loadMarketRegionalArtifactCatalog>[0])).toEqual(expectedFailure("invalid_options"));
    });
  });
}
