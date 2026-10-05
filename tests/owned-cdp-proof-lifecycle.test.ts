import { expect, test } from "bun:test";
import {
  CdpTransportTimeoutError,
  fetchJsonBounded,
  withOwnedProcess,
} from "./helpers/owned-cdp-proof-lifecycle";

test("bounds a local CDP response whose JSON body stalls after headers", async () => {
  let responseCancelled = false;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      return new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() { responseCancelled = true; } }), {
        headers: { "content-type": "application/json" },
      });
    },
  });
  const started = performance.now();
  try {
    await expect(fetchJsonBounded(`http://127.0.0.1:${server.port}/json/new`, { method: "PUT" }, 60))
      .rejects.toBeInstanceOf(CdpTransportTimeoutError);
    expect(performance.now() - started).toBeLessThan(500);
    for (let attempt = 0; attempt < 20 && !responseCancelled; attempt += 1) await Bun.sleep(5);
    expect(responseCancelled).toBe(true);
  } finally {
    server.stop(true);
  }
});

test("kills only a TERM-ignoring owned child and preserves the proof error", async () => {
  const source = `process.on("SIGTERM", () => {}); process.stdout.write("owned-ready"); setInterval(() => {}, 1000);`;
  const owned = Bun.spawn([process.execPath, "-e", source], {
    stdin: "ignore", stdout: "pipe", stderr: "ignore",
  });
  const unrelated = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000);"], {
    stdin: "ignore", stdout: "ignore", stderr: "ignore",
  });
  const marker = new Error("original proof callback failure");
  const started = performance.now();
  try {
    const output = owned.stdout.getReader();
    const ready = await output.read();
    expect(new TextDecoder().decode(ready.value)).toContain("owned-ready");
    output.releaseLock();
    expect(owned.exitCode === null && owned.signalCode === null).toBe(true);
    expect(unrelated.exitCode === null && unrelated.signalCode === null).toBe(true);

    await expect(withOwnedProcess(owned, async () => { throw marker; }, async () => {
      await new Promise<never>(() => undefined);
    }, { gracefulRequestMs: 40, gracefulExitMs: 40, terminateSignalMs: 50, killWaitMs: 500 }))
      .rejects.toBe(marker);
    expect(performance.now() - started).toBeLessThan(1_500);
    expect(owned.exitCode !== null || owned.signalCode !== null).toBe(true);
    expect(unrelated.exitCode === null && unrelated.signalCode === null).toBe(true);
  } finally {
    if (owned.exitCode === null && owned.signalCode === null) owned.kill("SIGKILL");
    if (unrelated.exitCode === null && unrelated.signalCode === null) unrelated.kill("SIGKILL");
    await Promise.all([owned.exited, unrelated.exited]);
  }
});

test("returns the proof result without signalling an already-exited child", async () => {
  const child = Bun.spawn([process.execPath, "-e", "process.exit(0);"], {
    stdin: "ignore", stdout: "ignore", stderr: "ignore",
  });
  expect(await child.exited).toBe(0);
  let gracefulCloseRequested = false;
  const result = await withOwnedProcess(child, async () => "proof-result", async () => {
    gracefulCloseRequested = true;
  });
  expect(result).toBe("proof-result");
  expect(gracefulCloseRequested).toBe(false);
});
