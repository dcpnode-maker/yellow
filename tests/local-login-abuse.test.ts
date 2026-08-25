import { describe, expect, test } from "bun:test";

import {
  LocalLoginGuard,
  LocalLoginLimitedError,
  LocalLoginService,
  localLoginGuardPolicy,
  type LocalLoginInput,
  type LocalLoginResult,
} from "../src/contexts/identity";
import { createApp, localLoginSourceKey } from "../src/app";
import { AvailabilityService } from "../src/contexts/inventory";
import { OperatorHttpApi } from "../src/http/operator";

const SOURCE_A = "peer:127.0.0.1";
const SOURCE_B = "peer:127.0.0.2";
const ACCOUNT_A = "yellow-demo\0operator@yellow.local";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const VALID_BODY: LocalLoginInput = Object.freeze({
  tenant: "yellow-demo",
  email: "operator@yellow.local",
  password: "not-retained",
});

class RecordingLogin extends LocalLoginService {
  readonly sources: string[] = [];
  readonly #limited: (sourceKey: string) => number | null;

  constructor(limited: (sourceKey: string) => number | null = () => null) {
    super(
      { async reserve(): Promise<never> { throw new Error("must not reserve"); } },
      { async issue(): Promise<never> { throw new Error("must not issue"); } },
    );
    this.#limited = limited;
  }

  override async authenticate(
    _input: LocalLoginInput,
    sourceKey = "unknown",
  ): Promise<LocalLoginResult | null> {
    this.sources.push(sourceKey);
    const retry = this.#limited(sourceKey);
    if (retry !== null) throw new LocalLoginLimitedError(retry);
    return null;
  }
}

describe("Order 117 local-login abuse controls", () => {
  test("P0/P2: password work has four slots and zero queue", async () => {
    const guard = new LocalLoginGuard();
    const release = deferred<void>();
    let active = 0;
    let maximumActive = 0;
    const started = deferred<void>();
    let startedCount = 0;

    const work = Array.from({ length: 4 }, () => guard.verify(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      startedCount += 1;
      if (startedCount === 4) started.resolve();
      await release.promise;
      active -= 1;
      return true;
    }));
    await started.promise;

    const fifth = await guard.verify(async () => {
      throw new Error("the fifth verification must never queue or execute");
    });
    expect(fifth).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(guard.snapshot()).toMatchObject({ activeVerifications: 4, waitingVerifications: 0 });

    release.resolve();
    expect(await Promise.all(work)).toEqual(Array.from({ length: 4 }, () => ({ allowed: true, value: true })));
    expect(maximumActive).toBe(4);
    expect(guard.snapshot()).toMatchObject({ activeVerifications: 0, waitingVerifications: 0 });
  });

  test("P0/P1: exact account, source, refill and failure-backoff policy", () => {
    let now = 0;
    const guard = new LocalLoginGuard({ now: () => now });
    expect(localLoginGuardPolicy).toEqual({
      source: { capacity: 5, refillTokens: 20, refillPeriodMs: 60_000 },
      account: { capacity: 3, refillTokens: 8, refillPeriodMs: 900_000 },
      failureBackoffSeconds: [1, 2, 4, 8, 16, 32, 60],
      maxConcurrentVerifications: 4,
      maxSourceEntries: 4_096,
      maxAccountEntries: 8_192,
    });

    expect(guard.consume(SOURCE_A, ACCOUNT_A)).toEqual({ allowed: true });
    guard.recordFailure(ACCOUNT_A);
    expect(guard.consume(SOURCE_A, ACCOUNT_A)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    now = 112_500;
    expect(guard.consume(SOURCE_A, ACCOUNT_A)).toEqual({ allowed: true });
    guard.recordFailure(ACCOUNT_A);
    expect(guard.consume(SOURCE_A, ACCOUNT_A)).toEqual({ allowed: false, retryAfterSeconds: 2 });

    now = 225_000;
    expect(guard.consume(SOURCE_A, ACCOUNT_A)).toEqual({ allowed: true });
    guard.recordSuccess(ACCOUNT_A);
    expect(guard.consume(SOURCE_A, ACCOUNT_A)).toEqual({ allowed: false, retryAfterSeconds: 113 });

    now = 337_500;
    expect(guard.consume(SOURCE_A, ACCOUNT_A)).toEqual({ allowed: true });
    expect(guard.snapshot()).toMatchObject({ sourceEntries: 1, accountEntries: 1 });
  });

  test("P0/P1: source spray and account spray are independently bounded", () => {
    const sourceGuard = new LocalLoginGuard({ now: () => 0 });
    for (let index = 0; index < 5; index += 1) {
      expect(sourceGuard.consume(SOURCE_A, `tenant\0person-${index}@yellow.local`)).toEqual({ allowed: true });
    }
    expect(sourceGuard.consume(SOURCE_A, "tenant\0person-5@yellow.local"))
      .toEqual({ allowed: false, retryAfterSeconds: 3 });

    const accountGuard = new LocalLoginGuard({ now: () => 0 });
    for (let index = 0; index < 3; index += 1) {
      expect(accountGuard.consume(`peer:10.0.0.${index}`, ACCOUNT_A)).toEqual({ allowed: true });
    }
    expect(accountGuard.consume("peer:10.0.0.3", ACCOUNT_A))
      .toEqual({ allowed: false, retryAfterSeconds: 113 });
  });

  test("P0/P2: state caps fail closed without growing or evicting live limits", () => {
    const guard = new LocalLoginGuard({
      now: () => 0,
      maxSourceEntries: 2,
      maxAccountEntries: 2,
    });
    expect(guard.consume("peer:a", "tenant\0a@yellow.local")).toEqual({ allowed: true });
    expect(guard.consume("peer:b", "tenant\0b@yellow.local")).toEqual({ allowed: true });
    expect(guard.consume("peer:c", "tenant\0c@yellow.local"))
      .toEqual({ allowed: false, retryAfterSeconds: 900 });
    expect(guard.snapshot()).toEqual({
      sourceEntries: 2,
      accountEntries: 2,
      activeVerifications: 0,
      waitingVerifications: 0,
    });
  });

  test("P2: production source and account caps stay exact under distinct-key pressure", () => {
    const sources = new LocalLoginGuard({ now: () => 0 });
    for (let index = 0; index < 4_096; index += 1) {
      sources.consume(`peer:${index}`, `tenant\0source-${index}@yellow.local`);
    }
    expect(sources.snapshot()).toMatchObject({ sourceEntries: 4_096, accountEntries: 4_096 });
    expect(sources.consume("peer:overflow", "tenant\0source-overflow@yellow.local"))
      .toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(sources.snapshot().sourceEntries).toBe(4_096);

    const accounts = new LocalLoginGuard({ now: () => 0 });
    for (let index = 0; index < 8_192; index += 1) {
      accounts.consume(SOURCE_B, `tenant\0person-${index}@yellow.local`);
    }
    expect(accounts.snapshot()).toMatchObject({ sourceEntries: 1, accountEntries: 8_192 });
    expect(accounts.consume(SOURCE_B, "tenant\0overflow@yellow.local"))
      .toEqual({ allowed: false, retryAfterSeconds: 900 });
    expect(accounts.snapshot().accountEntries).toBe(8_192);
  });

  test("P1: failure backoff follows 1, 2, 4, 8, 16, 32, 60 and success resets it", () => {
    let now = 0;
    const guard = new LocalLoginGuard({ now: () => now });
    for (const expected of [1, 2, 4, 8, 16, 32, 60, 60]) {
      expect(guard.consume(SOURCE_A, ACCOUNT_A)).toEqual({ allowed: true });
      guard.recordFailure(ACCOUNT_A);
      expect(guard.consume(SOURCE_A, ACCOUNT_A)).toEqual({ allowed: false, retryAfterSeconds: expected });
      now += 225_000;
    }
    expect(guard.consume(SOURCE_A, ACCOUNT_A)).toEqual({ allowed: true });
    guard.recordSuccess(ACCOUNT_A);
    now += 225_000;
    expect(guard.consume(SOURCE_A, ACCOUNT_A)).toEqual({ allowed: true });
    guard.recordFailure(ACCOUNT_A);
    expect(guard.consume(SOURCE_A, ACCOUNT_A)).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  test("P0/P2: thrown verification releases the slot", async () => {
    const guard = new LocalLoginGuard();
    await expect(guard.verify(async () => { throw new Error("hash failed"); })).rejects.toThrow("hash failed");
    expect(guard.snapshot().activeVerifications).toBe(0);
  });

  test("P0: limited errors carry only a bounded retry duration", () => {
    const error = new LocalLoginLimitedError(901);
    expect(error.retryAfterSeconds).toBe(900);
    expect(error.message).toBe("Local login is temporarily limited");
    expect(JSON.stringify(error)).not.toContain(ACCOUNT_A);
  });

  test("P3: only Bun peer metadata selects a source; forwarded headers never do", async () => {
    expect(localLoginSourceKey(null)).toBe("unknown");
    expect(localLoginSourceKey({ address: "not-an-address", family: "IPv4" })).toBe("unknown");
    expect(localLoginSourceKey({ address: "127.0.0.1", family: "IPv4" })).toBe("ipv4:127.0.0.1");

    const login = new RecordingLogin();
    const app = createApp({ operatorApi: new OperatorHttpApi(login, new AvailabilityService()) });
    const direct = await app.handle(new Request("http://yellow.test/api/v1/auth/local:login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        forwarded: "for=198.51.100.8",
        "x-forwarded-for": "198.51.100.9",
        "x-real-ip": "198.51.100.10",
      },
      body: JSON.stringify(VALID_BODY),
    }));
    expect(direct.status).toBe(401);
    expect(login.sources).toEqual(["unknown"]);

    app.listen({ hostname: "127.0.0.1", port: 0 });
    try {
      const response = await fetch(new URL("/api/v1/auth/local:login", app.server!.url), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          forwarded: "for=203.0.113.20",
          "x-forwarded-for": "203.0.113.21",
          "x-real-ip": "203.0.113.22",
        },
        body: JSON.stringify(VALID_BODY),
      });
      expect(response.status).toBe(401);
      expect(login.sources).toEqual(["unknown", "ipv4:127.0.0.1"]);
    } finally {
      app.server?.stop(true);
    }
  });

  test("P1/P3: every limiter cause has one no-store problem shape and bounded Retry-After", async () => {
    const login = new RecordingLogin((source) => source === "peer:busy" ? 1 : 900);
    const operator = new OperatorHttpApi(login, new AvailabilityService());
    const responses = await Promise.all([
      operator.login(new Request("http://yellow.test/login"), VALID_BODY, "peer:busy"),
      operator.login(new Request("http://yellow.test/login"), VALID_BODY, "peer:full"),
    ]);
    const problems = [];
    for (const response of responses) {
      expect(response.status).toBe(429);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(Number(response.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
      expect(Number(response.headers.get("retry-after"))).toBeLessThanOrEqual(900);
      const body = await response.json() as Record<string, unknown>;
      const { correlation_id: _correlation, ...problem } = body;
      problems.push(problem);
      expect(JSON.stringify(body)).not.toContain("yellow-demo");
      expect(JSON.stringify(body)).not.toContain("operator@yellow.local");
    }
    expect(problems[0]).toEqual(problems[1]);
  });
});
