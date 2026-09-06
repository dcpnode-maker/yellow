import { describe, expect, test } from "bun:test";
import type { Subprocess } from "bun";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const SERVER_ENTRY = resolve(PROJECT_ROOT, "src", "server.ts");
const requireLinuxProcessProof = process.env.YELLOW_REQUIRE_SERVER_FISCAL_PROCESS === "1";
if (requireLinuxProcessProof && process.platform !== "linux") {
  throw new Error("Required Q204 server process proof must run on Linux");
}
const linuxProcessDescribe = process.platform === "linux" && requireLinuxProcessProof
  ? describe.serial
  : describe.skip;
const OUTPUT_LIMIT = 16 * 1024;
const PRIVATE_SENTINEL = "q204-private-process-sentinel";

interface BoundedOutput {
  readonly text: string;
  readonly truncated: boolean;
}

interface ChildResult {
  readonly exitCode: number;
  readonly stdout: BoundedOutput;
  readonly stderr: BoundedOutput;
}

async function boundedOutput(stream: ReadableStream<Uint8Array>): Promise<BoundedOutput> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let retained = 0;
  let truncated = false;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    const remaining = OUTPUT_LIMIT - retained;
    if (remaining > 0) {
      const slice = next.value.byteLength > remaining ? next.value.subarray(0, remaining) : next.value;
      text += decoder.decode(slice, { stream: true });
      retained += slice.byteLength;
    }
    if (next.value.byteLength > remaining) truncated = true;
  }
  text += decoder.decode();
  return Object.freeze({ text, truncated });
}

async function within<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function spawnOwned(command: readonly string[], environment: Readonly<Record<string, string>>): {
  readonly child: Subprocess<"ignore", "pipe", "pipe">;
  readonly stdout: Promise<BoundedOutput>;
  readonly stderr: Promise<BoundedOutput>;
} {
  const child = Bun.spawn([...command], {
    cwd: PROJECT_ROOT,
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin", NO_COLOR: "1", ...environment },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  return { child, stdout: boundedOutput(child.stdout), stderr: boundedOutput(child.stderr) };
}

async function collectOwned(
  owned: ReturnType<typeof spawnOwned>, timeoutMs = 8_000,
): Promise<ChildResult> {
  const exitCode = await within(owned.child.exited, timeoutMs, "Q204 owned child did not exit in time");
  const [stdout, stderr] = await Promise.all([owned.stdout, owned.stderr]);
  return Object.freeze({ exitCode, stdout, stderr });
}

async function killOwned(owned: ReturnType<typeof spawnOwned>): Promise<void> {
  if (owned.child.exitCode !== null) return;
  owned.child.kill("SIGKILL");
  try { await within(owned.child.exited, 2_000, "Q204 owned child cleanup timed out"); } catch { /* owned cleanup */ }
}

async function reserveLoopbackPort(): Promise<{ readonly port: number; close(): Promise<void> }> {
  const reservation = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response("reserved", { status: 418 }),
  });
  const port = reservation.port;
  if (typeof port !== "number" || !Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    await reservation.stop(true);
    throw new Error("Q204 could not reserve an isolated loopback port");
  }
  return Object.freeze({ port, close: async () => { await reservation.stop(true); } });
}

async function healthAt(port: number): Promise<Response> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      return await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(250) });
    } catch {
      await Bun.sleep(20);
    }
  }
  throw new Error("Q204 disabled server did not become healthy in time");
}

async function validatedTempDirectory(): Promise<string> {
  const base = await realpath(tmpdir());
  const directory = await realpath(await mkdtemp(join(base, "yellow-order440-q204-lifecycle-")));
  const child = relative(base, directory);
  if (child === "" || child === ".." || child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
      || isAbsolute(child)) {
    throw new Error("Q204 lifecycle fixture escaped its temporary root");
  }
  return directory;
}

async function removeValidatedTempDirectory(directory: string): Promise<void> {
  const base = await realpath(tmpdir());
  const target = await realpath(directory);
  const child = relative(base, target);
  if (child === "" || child === ".." || child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
      || isAbsolute(child) || !target.split(/[\\/]/).at(-1)?.startsWith("yellow-order440-q204-lifecycle-")) {
    throw new Error("Refusing to remove an unverified Q204 lifecycle fixture");
  }
  await rm(target, { recursive: true, force: true });
}

async function readPhase(path: string): Promise<{ phase: string; stops: number; closes: number; aborted: boolean }> {
  return JSON.parse(await readFile(path, "utf8")) as {
    phase: string; stops: number; closes: number; aborted: boolean;
  };
}

async function waitForPhase(path: string, expected: string): Promise<Awaited<ReturnType<typeof readPhase>>> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const state = await readPhase(path);
      if (state.phase === expected) return state;
    } catch { /* fixture has not published its next atomic-sized state yet */ }
    await Bun.sleep(10);
  }
  throw new Error(`Q204 lifecycle fixture did not reach ${expected}`);
}

describe("Order440/Q204 fiscal composition", () => {
  test("is default-off, has no environment-built adapter hook, and fails enabled-empty before listen", async () => {
    const source = await readFile(new URL("../src/server.ts", import.meta.url), "utf8");
    expect(source).toContain('Bun.env.YELLOW_FISCAL_SUBMISSION_WORKER === "1"');
    expect(source).toContain("const verifiedIndiaIrpAdapterRegistrations = Object.freeze([])");
    expect(source).toContain("enabled fiscal submission worker requires a verified provider adapter");
    expect(source.indexOf("enabled fiscal submission worker requires a verified provider adapter"))
      .toBeLessThan(source.indexOf("runtimeApp().listen"));
    expect(source).not.toMatch(/YELLOW_(?:FISCAL|IRP).*(?:JSON|URL|TOKEN|SECRET|PASSWORD)/);
  });

  test("shares one shutdown signal across all existing loops and reports actual fiscal state", async () => {
    const [server, status, operator] = await Promise.all([
      readFile(new URL("../src/server.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/project-status.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/http/operator.ts", import.meta.url), "utf8"),
    ]);
    expect(server.match(/signal: runtimeAbort\.signal/g)?.length).toBeGreaterThanOrEqual(7);
    expect(server).toContain("new ServerLifecycle");
    expect(status).toContain("fiscalSubmissionDeliveryWorkerState");
    expect(operator).toContain("fiscalSubmissionDelivery: this.#runtimeStatus.fiscalSubmissionDeliveryWorkerState");
  });
});

linuxProcessDescribe("Order440/Q204 actual Linux server lifecycle", () => {
  test("the default-disabled server serves health and exits cleanly on real SIGTERM", async () => {
    const reservation = await reserveLoopbackPort();
    const port = reservation.port;
    await reservation.close();
    const owned = spawnOwned([process.execPath, SERVER_ENTRY], {
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(port),
      YELLOW_OPERATOR_WORKBENCH: "0",
      YELLOW_FISCAL_SUBMISSION_WORKER: "0",
      YELLOW_TOKEN_SECRET: PRIVATE_SENTINEL,
      YELLOW_BUILD_SHA: "0000000000000000000000000000000000000000",
    });
    try {
      const response = await healthAt(port);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
      expect(owned.child.exitCode).toBeNull();
      process.kill(owned.child.pid, "SIGTERM");
      const result = await collectOwned(owned);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.truncated || result.stderr.truncated).toBe(false);
      expect(result.stdout.text.includes(PRIVATE_SENTINEL)
        || result.stderr.text.includes(PRIVATE_SENTINEL)).toBe(false);
    } finally {
      await killOwned(owned);
    }
  }, 15_000);

  test("enabled fiscal delivery with no registered provider fails before listening", async () => {
    const reservation = await reserveLoopbackPort();
    const owned = spawnOwned([process.execPath, SERVER_ENTRY], {
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(reservation.port),
      YELLOW_OPERATOR_WORKBENCH: "1",
      YELLOW_FISCAL_SUBMISSION_WORKER: "1",
      YELLOW_TOKEN_SECRET: PRIVATE_SENTINEL,
    });
    try {
      const result = await collectOwned(owned);
      expect(result.exitCode === 0).toBe(false);
      expect(result.stderr.text.includes(
        "enabled fiscal submission worker requires a verified provider adapter",
      )).toBe(true);
      expect(result.stderr.text.includes("EADDRINUSE")).toBe(false);
      expect(result.stdout.truncated || result.stderr.truncated).toBe(false);
      expect(result.stdout.text.includes(PRIVATE_SENTINEL)
        || result.stderr.text.includes(PRIVATE_SENTINEL)).toBe(false);
      const reservationResponse = await fetch(`http://127.0.0.1:${reservation.port}/`);
      expect(reservationResponse.status).toBe(418);
    } finally {
      await killOwned(owned);
      await reservation.close();
    }
  }, 15_000);

  test("two real SIGTERMs during a pending drain finish once through production lifecycle handlers", async () => {
    const directory = await validatedTempDirectory();
    const fixturePath = join(directory, "q204-linux-lifecycle.ts");
    const statePath = join(directory, "state.json");
    const lifecycleUrl = new URL("../src/runtime/server-lifecycle.ts", import.meta.url).href;
    const fixture = `
      import { writeFileSync } from "node:fs";
      import { ServerLifecycle, installServerLifecycleSignals } from ${JSON.stringify(lifecycleUrl)};
      const statePath = process.env.YELLOW_Q204_LIFECYCLE_STATE;
      if (!statePath) throw new Error("missing isolated lifecycle state path");
      let stops = 0;
      let closes = 0;
      const keepAlive = setInterval(() => undefined, 1_000);
      const controller = new AbortController();
      let finishWorker;
      const worker = new Promise((resolve) => { finishWorker = resolve; });
      const record = (phase) => writeFileSync(statePath, JSON.stringify({
        phase, stops, closes, aborted: controller.signal.aborted,
      }));
      controller.signal.addEventListener("abort", () => {
        record("draining");
        setTimeout(() => finishWorker(), 750);
      }, { once: true });
      let dispose;
      const lifecycle = new ServerLifecycle({
        controller,
        workerTasks: [worker],
        drainTimeoutMs: 2_000,
        stopIntake() { stops += 1; },
        closeResources() {
          closes += 1;
          clearInterval(keepAlive);
          record("done");
          dispose();
          process.exitCode = stops === 1 && closes === 1 && controller.signal.aborted ? 0 : 9;
        },
      });
      dispose = installServerLifecycleSignals(lifecycle);
      record("ready");
    `;
    await writeFile(fixturePath, fixture, { encoding: "utf8", flag: "wx" });
    const owned = spawnOwned([process.execPath, fixturePath], {
      YELLOW_Q204_LIFECYCLE_STATE: statePath,
      YELLOW_TOKEN_SECRET: PRIVATE_SENTINEL,
    });
    try {
      expect(await waitForPhase(statePath, "ready")).toEqual({
        phase: "ready", stops: 0, closes: 0, aborted: false,
      });
      process.kill(owned.child.pid, "SIGTERM");
      expect(await waitForPhase(statePath, "draining")).toEqual({
        phase: "draining", stops: 1, closes: 0, aborted: true,
      });
      expect(owned.child.exitCode).toBeNull();
      process.kill(owned.child.pid, "SIGTERM");
      await Bun.sleep(100);
      expect(owned.child.exitCode).toBeNull();
      expect(await waitForPhase(statePath, "done")).toEqual({
        phase: "done", stops: 1, closes: 1, aborted: true,
      });
      const result = await collectOwned(owned);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.truncated || result.stderr.truncated).toBe(false);
      expect(result.stdout.text.includes(PRIVATE_SENTINEL)
        || result.stderr.text.includes(PRIVATE_SENTINEL)).toBe(false);
    } finally {
      await killOwned(owned);
      await removeValidatedTempDirectory(directory);
    }
  }, 15_000);
});
