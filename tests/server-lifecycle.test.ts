import { describe, expect, test } from "bun:test";

import { ServerLifecycle, installServerLifecycleSignals } from "../src/runtime/server-lifecycle";

describe("Order440/Q204 process lifecycle", () => {
  test("retains signal handlers throughout repeated shutdown signals until explicit disposal", async () => {
    const initialInt = process.listeners("SIGINT");
    const initialTerm = process.listeners("SIGTERM");
    let stops = 0;
    let closes = 0;
    const lifecycle = new ServerLifecycle({
      controller: new AbortController(),
      workerTasks: [],
      stopIntake() { stops += 1; },
      closeResources() { closes += 1; },
    });
    const dispose = installServerLifecycleSignals(lifecycle);
    try {
      const installedInt = process.listeners("SIGINT");
      const installedTerm = process.listeners("SIGTERM");
      expect(installedInt.length).toBe(initialInt.length + 1);
      expect(installedTerm.length).toBe(initialTerm.length + 1);
      process.emit("SIGTERM");
      expect(process.listeners("SIGTERM")).toEqual(installedTerm);
      process.emit("SIGTERM");
      process.emit("SIGINT");
      expect(process.listeners("SIGINT")).toEqual(installedInt);
      await lifecycle.shutdown();
      expect(stops).toBe(1);
      expect(closes).toBe(1);
    } finally {
      dispose();
    }
    expect(process.listeners("SIGINT")).toEqual(initialInt);
    expect(process.listeners("SIGTERM")).toEqual(initialTerm);
  });

  test("stops intake, aborts every loop, drains once, closes owned pools, and is idempotent", async () => {
    const events: string[] = [];
    const controller = new AbortController();
    controller.signal.addEventListener("abort", () => events.push("abort"));
    let finishWorker!: () => void;
    const worker = new Promise<void>((resolve) => { finishWorker = resolve; });
    const lifecycle = new ServerLifecycle({
      controller,
      workerTasks: [worker],
      drainTimeoutMs: 100,
      stopIntake() { events.push("stop-intake"); },
      async closeResources() { events.push("close-resources"); },
    });

    const first = lifecycle.shutdown();
    const second = lifecycle.shutdown();
    expect(first).toBe(second);
    await Bun.sleep(0);
    expect(events).toEqual(["stop-intake", "abort"]);
    finishWorker();
    await first;
    expect(events).toEqual(["stop-intake", "abort", "close-resources"]);
  });

  test("a non-settling loop cannot prevent bounded resource closure", async () => {
    let closed = 0;
    const started = performance.now();
    const lifecycle = new ServerLifecycle({
      controller: new AbortController(),
      workerTasks: [new Promise<void>(() => undefined)],
      drainTimeoutMs: 20,
      stopIntake() {},
      async closeResources() { closed += 1; },
    });
    await lifecycle.shutdown();
    expect(closed).toBe(1);
    expect(performance.now() - started).toBeLessThan(500);
  });

  test("forces intake closed after a graceful-stop rejection and still closes resources once", async () => {
    const events: string[] = [];
    const lifecycle = new ServerLifecycle({
      controller: new AbortController(),
      workerTasks: [],
      drainTimeoutMs: 20,
      async stopIntake() {
        events.push("stop-intake");
        throw new Error("private listener failure");
      },
      async forceStopIntake() { events.push("force-stop-intake"); },
      async closeResources() { events.push("close-resources"); },
    });
    await lifecycle.shutdown();
    expect(events).toEqual(["stop-intake", "force-stop-intake", "close-resources"]);
  });
});
