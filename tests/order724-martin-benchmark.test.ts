import { describe, expect, test } from "bun:test";
import {
  MARTIN_TRIAL_LIMITS,
  parseMartinBenchmarkArgs,
  runMartinRateWindow,
  validateMartinBenchmarkConfig,
  type MartinBenchmarkConfig,
} from "../scripts/research/martin-local-benchmark";

const config: MartinBenchmarkConfig = {
  baseUrl: "http://127.0.0.1:3054",
  tilePath: "/png/0/0/0",
  rps: 20,
  durationSeconds: 1,
  maxInFlight: 4,
  timeoutMs: 500,
  batchSize: 1,
  serverPid: 1234,
  serverPath: "D:\\Yellow\\temp\\order724-martin-trial\\bin\\martin.exe",
};

describe("Order724 bounded Martin local benchmark", () => {
  test("parses the exact fixed loopback target and bounded execution parameters", () => {
    const parsed = parseMartinBenchmarkArgs([
      "--base-url", config.baseUrl, "--tile-path", config.tilePath,
      "--rps", "25", "--duration-seconds", "600", "--max-in-flight", "64",
      "--timeout-ms", "2000", "--server-pid", "1234", "--server-path", config.serverPath,
    ]);
    expect(parsed).toMatchObject({ rps: 25, durationSeconds: 600, maxInFlight: 64, timeoutMs: 2000 });
    expect(parsed.batchSize).toBe(1);
    const batched = parseMartinBenchmarkArgs([
      "--base-url", config.baseUrl, "--tile-path", config.tilePath,
      "--rps", "100", "--duration-seconds", "600", "--max-in-flight", "64",
      "--timeout-ms", "2000", "--server-pid", "1234", "--server-path", config.serverPath, "--batch-size", "8",
    ]);
    expect(batched.batchSize).toBe(8);
    expect(MARTIN_TRIAL_LIMITS.maxDurationSeconds).toBe(600);
    expect(MARTIN_TRIAL_LIMITS.maxInFlight).toBe(64);
  });

  test("rejects public, non-loopback, non-trial-port and malformed tile destinations", () => {
    for (const baseUrl of ["https://127.0.0.1:3054", "http://localhost:3054", "http://0.0.0.0:3054",
      "http://127.0.0.1:3010", "http://127.0.0.1:3054/other", "http://127.0.0.1:3054?x=1"]) {
      expect(() => validateMartinBenchmarkConfig({ ...config, baseUrl })).toThrow();
    }
    for (const tilePath of ["/../catalog", "/../0/0/0", "/./0/0/0", "/png/%2f0/0/0", "/png/0/0", "/other/0/0/0?source=../private"]) {
      expect(() => validateMartinBenchmarkConfig({ ...config, tilePath })).toThrow();
    }
  });

  test("rejects out-of-policy rate, duration, timeout and concurrency caps", () => {
    expect(() => validateMartinBenchmarkConfig({ ...config, rps: 501 })).toThrow();
    expect(() => validateMartinBenchmarkConfig({ ...config, durationSeconds: 601 })).toThrow();
    expect(() => validateMartinBenchmarkConfig({ ...config, maxInFlight: 65 })).toThrow();
    expect(() => validateMartinBenchmarkConfig({ ...config, timeoutMs: 5_001 })).toThrow();
    expect(() => validateMartinBenchmarkConfig({ ...config, batchSize: 0 })).toThrow();
    expect(() => validateMartinBenchmarkConfig({ ...config, batchSize: 9 })).toThrow();
    expect(() => validateMartinBenchmarkConfig({ ...config, serverPath: "C:\\Windows\\System32\\martin.exe" })).toThrow();
  });

  test("counts consumed successful responses and reports bounded latency samples and byte totals", async () => {
    const result = await runMartinRateWindow({ ...config, durationSeconds: 1 }, {
      fetcher: async () => new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200, headers: { "content-length": "4", "content-encoding": "identity" },
      }),
    });
    expect(result).toMatchObject({ scheduled: 20, sent: 20, completed: 20, successful: 20,
      dropped: 0, schedulerDrops: 0, inFlightDrops: 0, maxObservedInFlight: 1,
      non2xx: 0, timeouts: 0, networkErrors: 0, bodyBytesConsumed: 80,
      declaredContentLengthBytes: 80, statusCounts: { "200": 20 }, contentEncodings: { identity: 20 } });
    expect(result.latencyMs.retainedSamples).toBe(20);
    expect(result.latencyMs.p50).toBeGreaterThanOrEqual(0);
    expect(result.serverProcess.cpuMilliseconds).toBeNull();
  });

  test("does not catch up with bursts when the in-flight cap is reached", async () => {
    let calls = 0;
    const result = await runMartinRateWindow({ ...config, rps: 100, durationSeconds: 1, maxInFlight: 1 }, {
      fetcher: async () => {
        calls++;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return new Response(new Uint8Array([1]), { status: 200 });
      },
    });
    expect(result.scheduled).toBe(100);
    expect(result.dropped).toBeGreaterThan(0);
    expect(result.dropped).toBe(result.schedulerDrops + result.inFlightDrops);
    expect(result.inFlightDrops).toBeGreaterThan(0);
    expect(result.maxObservedInFlight).toBe(1);
    expect(result.sent).toBe(calls);
    expect(result.sent).toBeLessThan(result.scheduled);
  });

  test("accounts for scheduler stalls as drops instead of catching up with an artificial burst", async () => {
    let clock = 0;
    let pauses = 0;
    const sendTimes: number[] = [];
    const result = await runMartinRateWindow({ ...config, rps: 10, durationSeconds: 1, maxInFlight: 10 }, {
      now: () => clock,
      pause: async (milliseconds) => { clock += milliseconds + (pauses++ === 0 ? 450 : 0); },
      fetcher: async () => { sendTimes.push(clock); return new Response(new Uint8Array([1]), { status: 200 }); },
    });
    expect(result.scheduled).toBe(10);
    expect(result.dropped).toBe(4);
    expect(result.schedulerDrops).toBe(4);
    expect(result.inFlightDrops).toBe(0);
    expect(result.sent).toBe(6);
    expect(result.slotWakeLatenessMs.max).toBeGreaterThanOrEqual(450);
    expect(result.slotWakeLatenessMs.observedSlots).toBe(6);
    expect(sendTimes[0]).toBe(0);
    expect(sendTimes.slice(1).every((time, index) => time - sendTimes[index]! >= 50)).toBeTrue();
  });

  test("does not issue a request after the scheduled trial deadline", async () => {
    let clock = 0;
    let calls = 0;
    const result = await runMartinRateWindow({ ...config, rps: 2, durationSeconds: 1 }, {
      now: () => clock,
      pause: async (milliseconds) => { clock += milliseconds + 600; },
      fetcher: async () => { calls++; return new Response(null, { status: 200 }); },
    });
    expect(calls).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.scheduled).toBe(2);
    expect(result.dropped).toBe(1);
    expect(result.schedulerDrops).toBe(1);
    expect(result.inFlightDrops).toBe(0);
  });

  test("batch mode counts remainder requests and labels average-rate bursts", async () => {
    const times: number[] = [];
    let clock = 0;
    const result = await runMartinRateWindow({ ...config, rps: 10, durationSeconds: 1, batchSize: 8, maxInFlight: 64 }, {
      now: () => clock,
      pause: async (milliseconds) => { clock += milliseconds; },
      fetcher: async () => { times.push(clock); return new Response(new Uint8Array([1]), { status: 200 }); },
    });
    expect(result).toMatchObject({ pacingProtocol: "burst-average-rate", batchSize: 8,
      batchIntervalMs: 800, plannedBatches: 2, scheduledBatches: 2, missedBatches: 0,
      scheduled: 10, sent: 10, completed: 10, dropped: 0 });
    expect(times).toHaveLength(10);
    expect(times).toEqual([...Array.from({ length: 8 }, () => 0), 800, 800]);
    expect(result.trafficElapsedMs).toBe(1_000);
  });

  test("drops missed batches by request count and never dispatches a batch after deadline", async () => {
    let clock = 0;
    let paused = false;
    const dispatchTimes: number[] = [];
    const result = await runMartinRateWindow({ ...config, rps: 10, durationSeconds: 1, batchSize: 2 }, {
      now: () => clock,
      pause: async (milliseconds) => { clock += milliseconds + (!paused ? 650 : 0); paused = true; },
      fetcher: async () => { dispatchTimes.push(clock); return new Response(null, { status: 200 }); },
    });
    expect(result).toMatchObject({ scheduled: 10, sent: 4, dropped: 6, schedulerDrops: 6,
      inFlightDrops: 0, plannedBatches: 5, scheduledBatches: 5, missedBatches: 3 });
    expect(result.sent + result.dropped).toBe(result.scheduled);
    expect(dispatchTimes).toEqual([0, 0, 850, 850]);
    expect(dispatchTimes.every((time) => time < 1_000)).toBeTrue();
  });

  test("does not begin later requests inside a batch after an injected slow dispatch crosses deadline", async () => {
    let clock = 0;
    let calls = 0;
    const result = await runMartinRateWindow({ ...config, rps: 10, durationSeconds: 1, batchSize: 8 }, {
      now: () => clock,
      pause: async (milliseconds) => { clock += milliseconds; },
      fetcher: async () => {
        calls++;
        if (calls === 1) clock = 1_000;
        return new Response(null, { status: 200 });
      },
    });
    expect(calls).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.scheduled).toBe(10);
    expect(result.dropped).toBe(9);
    expect(result.schedulerDrops).toBe(9);
    expect(result.pacingProtocol).toBe("burst-average-rate");
  });

  test("binds sampled process metrics to the owned PID, path and start time and marks failed samples", async () => {
    let calls = 0;
    const result = await runMartinRateWindow({ ...config, rps: 1, durationSeconds: 1 }, {
      fetcher: async () => new Response(null, { status: 200 }),
      processStats: async () => {
        calls++;
        return { id: calls === 1 ? config.serverPid : config.serverPid + 1, path: config.serverPath,
          startedAt: "2026-09-25T12:00:00.000Z", cpuMs: calls * 10, workingSetBytes: 10_000 };
      },
    });
    expect(calls).toBe(2);
    expect(result.serverProcess.pid).toBe(config.serverPid);
    expect(result.serverProcess.workingSetSampleCount).toBe(1);
    expect(result.serverProcess.processSampleErrors).toBe(1);
    expect(result.serverProcess.cpuMilliseconds).toBe(0);
  });

  test("records process sampler failures without blocking scheduled requests", async () => {
    let calls = 0;
    const result = await runMartinRateWindow({ ...config, rps: 1, durationSeconds: 1 }, {
      fetcher: async () => new Response(null, { status: 200 }),
      processStats: async () => {
        calls++;
        if (calls > 1) throw new Error("sample failed");
        return { id: config.serverPid, path: config.serverPath, startedAt: "2026-09-25T12:00:00.000Z",
          cpuMs: 10, workingSetBytes: 10_000 };
      },
    });
    expect(result.scheduled).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.serverProcess.processSampleErrors).toBe(1);
    expect(result.serverProcess.workingSetSampleCount).toBe(1);
  });

  test("records non-2xx and timeout outcomes without retaining response bodies", async () => {
    let call = 0;
    const result = await runMartinRateWindow({ ...config, rps: 2, durationSeconds: 1, timeoutMs: 100 }, {
      fetcher: async (_url, init) => {
        call++;
        if (call === 1) return new Response(new Uint8Array([9, 8]), { status: 503 });
        return await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
        });
      },
    });
    expect(result.scheduled).toBe(2);
    expect(result.non2xx).toBe(1);
    expect(result.timeouts).toBe(1);
    expect(result.bodyBytesConsumed).toBe(2);
    expect(result.latencyMs.retainedSamples).toBe(1);
  });

  test("counts oversized non-2xx responses in both overlapping categories, not successes", async () => {
    const oversizedBody = new Uint8Array(2_000_001);
    const result = await runMartinRateWindow({ ...config, rps: 1, durationSeconds: 1 }, {
      fetcher: async () => new Response(oversizedBody, { status: 503 }),
    });
    expect(result).toMatchObject({ completed: 1, successful: 0, non2xx: 1, oversized: 1 });
    expect(result.bodyBytesConsumed).toBeGreaterThan(0);
  });

  test("isolates bounded immediate-fetch generator ceilings at 100 and 500 RPS", async () => {
    for (const rps of [100, 500]) {
      const result = await runMartinRateWindow({ ...config, rps, durationSeconds: 3, maxInFlight: 64 }, {
        fetcher: async () => new Response(new Uint8Array([1]), { status: 200 }),
      });
      expect(result.trafficElapsedMs).toBeGreaterThanOrEqual(3_000);
      expect(result.schedulerDrops + result.inFlightDrops).toBe(result.dropped);
      expect(result.scheduled).toBe(rps * 3);
      expect(result.maxObservedInFlight).toBeLessThanOrEqual(64);
      expect(result.sent + result.dropped).toBe(result.scheduled);
      expect(result.slotWakeLatenessMs.observedSlots).toBeGreaterThan(0);
      expect(result.maxObservedInFlight).toBeGreaterThan(0);
    }
  }, 15_000);

  test("rejects duplicate, missing, or extra CLI arguments", () => {
    expect(() => parseMartinBenchmarkArgs([])).toThrow();
    expect(() => parseMartinBenchmarkArgs(["--rps", "1", "--rps", "2"])).toThrow();
    expect(() => parseMartinBenchmarkArgs(["--unexpected", "yes"])).toThrow();
  });
});
