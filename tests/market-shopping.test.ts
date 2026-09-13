import { describe, expect, test } from "bun:test";

import {
  MARKET_SHOPPING_METHOD_DEFAULTS,
  MARKET_SHOPPING_METHODS,
  MarketShoppingRunner,
  marketShoppingCadence,
  marketShoppingCadenceForDates,
  marketShoppingContextKey,
  marketShoppingPropertyLocalDaysAhead,
  nextMarketShoppingCollectionLocal,
  quoteMarketShoppingCost,
  type MarketAdapterResult,
  type MarketShoppingContext,
  type MarketShoppingObservation,
  type MarketShoppingReadAdapter,
  type MarketShoppingRoute,
  type MarketShoppingUpstreamLimits,
} from "../src/contexts/distribution";

const NOW = Date.parse("2026-09-08T12:00:00.000Z");

function context(overrides: Partial<MarketShoppingContext> = {}): MarketShoppingContext {
  return {
    tenantId: "tenant-a",
    managedPropertyId: "managed-property-a",
    comparatorPropertyId: "comparator-property-a",
    source: "source-a",
    permissionScope: "market-read",
    entitlement: "public-rate",
    pointOfSaleMarket: "US",
    roomProduct: "king-room",
    checkInDate: "2026-09-20",
    lengthOfStayNights: 2,
    guests: { rooms: 1, adults: 2, childAges: [7] },
    currency: "USD",
    mealPlan: "breakfast",
    refundability: "refundable",
    membership: "public",
    device: "desktop",
    taxPriceDisplay: "tax-and-fees-included",
    ...overrides,
  };
}

function available(
  value: MarketShoppingContext,
  overrides: Partial<Extract<MarketAdapterResult, { outcome: "available" }>> = {},
): Extract<MarketAdapterResult, { outcome: "available" }> {
  return {
    outcome: "available",
    context: value,
    collectedAt: "2026-09-08T11:59:00.000Z",
    sourceTimestamp: { raw: "2026-09-08T11:58:00.000Z", basis: "utc-instant" },
    total: { amountMinor: "9007199254740993", currency: value.currency,
      basis: "entire-stay", mandatoryChargesIncluded: true },
    ...overrides,
  };
}

function route(
  id: string,
  upstream: string,
  read: MarketShoppingReadAdapter,
  overrides: Partial<MarketShoppingRoute> = {},
): MarketShoppingRoute {
  return { id, upstream, read, method: "official-api", priority: 1, enabled: true,
    sources: ["source-a"], timeoutMs: 1_000, ...overrides };
}

function limits(
  upstream: string,
  overrides: Partial<MarketShoppingUpstreamLimits> = {},
): MarketShoppingUpstreamLimits {
  return { upstream, maxRequestsPerRun: 20, maxConcurrency: 4, cooldownMs: 60_000, ...overrides };
}

function runner(
  routes: readonly MarketShoppingRoute[],
  upstreams: readonly MarketShoppingUpstreamLimits[],
  overrides: Partial<ConstructorParameters<typeof MarketShoppingRunner>[0]> = {},
): MarketShoppingRunner {
  return new MarketShoppingRunner({ routes, upstreams, now: () => NOW,
    cacheTtlMs: 3_600_000, maxSourceAgeMs: 3_600_000, ...overrides });
}

describe("RMS market shopping foundation", () => {
  test("every authority, product, market, stay, guest and price-display dimension isolates work", () => {
    const base = context();
    const variants: MarketShoppingContext[] = [
      context({ tenantId: "tenant-b" }),
      context({ managedPropertyId: "managed-property-b" }),
      context({ comparatorPropertyId: "comparator-property-b" }),
      context({ source: "source-b" }),
      context({ permissionScope: "market-read-premium" }),
      context({ entitlement: "member-rate" }),
      context({ pointOfSaleMarket: "GB" }),
      context({ roomProduct: "twin-room" }),
      context({ checkInDate: "2026-09-21" }),
      context({ lengthOfStayNights: 3 }),
      context({ guests: { ...base.guests, rooms: 2 } }),
      context({ guests: { ...base.guests, adults: 3 } }),
      context({ guests: { ...base.guests, childAges: [8] } }),
      context({ currency: "EUR" }),
      context({ mealPlan: "room-only" }),
      context({ refundability: "nonrefundable" }),
      context({ membership: "member" }),
      context({ device: "mobile" }),
      context({ taxPriceDisplay: "tax-exclusive" }),
    ];
    const keys = new Set([marketShoppingContextKey(base), ...variants.map(marketShoppingContextKey)]);
    expect(keys.size).toBe(variants.length + 1);
    expect(() => marketShoppingContextKey({ ...base, currency: "usd" })).toThrow();
    expect(() => marketShoppingContextKey({ ...base, checkInDate: "2026-02-30" })).toThrow();
  });

  test("explicit methods default disabled and an unconfigured runner performs no read", async () => {
    expect(MARKET_SHOPPING_METHODS).toEqual([
      "official-api", "licensed-provider", "permitted-browser", "confirmed-capture", "archive",
    ]);
    expect(Object.values(MARKET_SHOPPING_METHOD_DEFAULTS)).toEqual([false, false, false, false, false]);
    const result = await new MarketShoppingRunner({ now: () => NOW }).run([{ id: "job-a", context: context() }]);
    expect(result.coordinationScope).toBe("single-process");
    expect(result.results[0]?.status).toBe("failed");
    expect(result.results[0]?.attempts).toEqual([]);
  });

  test("duplicate jobs and overlapping runs share exactly one in-flight adapter read", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const read: MarketShoppingReadAdapter = async ({ context: value }) => {
      calls += 1;
      markStarted();
      await gate;
      return available(value);
    };
    const service = runner([route("api", "ota", read)], [limits("ota")]);
    const first = service.run([{ id: "first", context: context() }, { id: "duplicate", context: context() }]);
    const second = service.run([{ id: "overlap", context: context() }]);
    await started;
    expect(calls).toBe(1);
    release();
    const [one, two] = await Promise.all([first, second]);
    expect(one.results[0]?.requestIds).toEqual(["first", "duplicate"]);
    expect(two.results[0]?.requestIds).toEqual(["overlap"]);
    expect(one.results[0]?.observation?.outcome).toBe("available");
    if (one.results[0]?.observation?.outcome === "available") {
      expect(one.results[0].observation.total.amountMinor).toBe("9007199254740993");
    }
  });

  test("overlapping runs share one finite request budget window", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const service = runner([route("api", "ota", async ({ context: value }) => {
      calls += 1;
      markStarted();
      await gate;
      return available(value);
    })], [limits("ota", { maxRequestsPerRun: 1, maxConcurrency: 1 })]);
    const first = service.run([{ id: "first", context: context() }]);
    const second = service.run([{ id: "second", context: context({ membership: "member" }) }]);
    await started;
    expect(calls).toBe(1);
    release();
    const results = await Promise.all([first, second]);
    expect(calls).toBe(1);
    expect(results.flatMap((result) => result.results.map(({ status }) => status)).sort())
      .toEqual(["actionable", "failed"]);
    expect(results[1]?.upstreams.ota?.requestsUsed).toBe(1);
  });

  test("routes fail over sequentially while one upstream shares request budget and concurrency", async () => {
    const order: string[] = [];
    let active = 0;
    let peak = 0;
    const first: MarketShoppingReadAdapter = async () => {
      order.push("first");
      return { outcome: "failure", kind: "network" };
    };
    const second: MarketShoppingReadAdapter = async ({ context: value }) => {
      order.push("second");
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      return available(value);
    };
    const service = runner([
      route("one", "shared", first, { priority: 1 }),
      route("two", "shared", second, { priority: 2 }),
    ], [limits("shared", { maxRequestsPerRun: 2, maxConcurrency: 1 })]);
    const result = await service.run([{ id: "a", context: context() },
      { id: "b", context: context({ checkInDate: "2026-09-21" }) }]);
    expect(peak).toBe(1);
    expect(result.upstreams.shared).toEqual({ requestsUsed: 2, requestsRemaining: 0,
      blocked: false, coolingDown: false, quarantinedReads: 0 });
    expect(result.results.map((item) => item.status).sort()).toEqual(["actionable", "failed"]);
    expect(order).toEqual(["first", "second"]);
  });

  test("a hard failure blocks every method on the same upstream and permits independent failover", async () => {
    let bypassCalls = 0;
    let independentCalls = 0;
    const service = runner([
      route("browser", "ota", async () => ({ outcome: "failure", kind: "challenge" }),
        { method: "permitted-browser", priority: 1 }),
      route("api-same-upstream", "ota", async ({ context: value }) => {
        bypassCalls += 1;
        return available(value);
      }, { method: "official-api", priority: 2 }),
      route("provider", "independent", async ({ context: value }) => {
        independentCalls += 1;
        return available(value);
      }, { method: "licensed-provider", priority: 3 }),
    ], [limits("ota"), limits("independent")]);
    const result = await service.run([{ id: "one", context: context() }]);
    expect(result.results[0]?.status).toBe("actionable");
    expect(result.results[0]?.attempts.map(({ reason }) => reason)).toEqual([
      "challenge", "upstream-blocked", null,
    ]);
    expect(result.upstreams.ota?.blocked).toBe(true);
    expect(bypassCalls).toBe(0);
    expect(independentCalls).toBe(1);
  });

  test("a shared hard block wakes all queued contexts instead of leaving calls pending", async () => {
    let calls = 0;
    const service = runner([route("browser", "ota", async () => {
      calls += 1;
      return { outcome: "failure", kind: "access-denied" };
    }, { method: "permitted-browser" })], [limits("ota", { maxConcurrency: 1 })]);
    const result = await service.run([0, 1, 2].map((index) => ({ id: `job-${index}`,
      context: context({ membership: `segment-${index}` }) })));
    expect(calls).toBe(1);
    expect(result.results.every(({ status }) => status === "failed")).toBe(true);
    expect(result.results.flatMap(({ attempts }) => attempts).filter(({ reason }) =>
      reason === "upstream-blocked").length).toBe(2);
  });

  test("rate-limit cooldown is shared and cannot be bypassed by another method or next run", async () => {
    let sameUpstreamCalls = 0;
    let independentCalls = 0;
    const service = runner([
      route("limited", "ota", async () => ({ outcome: "failure", kind: "rate-limited", retryAfterMs: 90_000 }),
        { priority: 1 }),
      route("same", "ota", async ({ context: value }) => { sameUpstreamCalls += 1; return available(value); },
        { method: "confirmed-capture", priority: 2 }),
      route("other", "provider", async ({ context: value }) => { independentCalls += 1; return available(value); },
        { method: "licensed-provider", priority: 3 }),
    ], [limits("ota"), limits("provider")]);
    const first = await service.run([{ id: "one", context: context() }]);
    expect(first.results[0]?.attempts.map(({ reason }) => reason)).toEqual(["rate-limited", "cooldown", null]);
    await service.run([{ id: "two", context: context({ membership: "member" }) }]);
    expect(sameUpstreamCalls).toBe(0);
    expect(independentCalls).toBe(2);
  });

  test("an adapter ignoring abort is quarantined after timeout and cannot overlap a same-upstream retry", async () => {
    let lateRelease!: () => void;
    const late = new Promise<void>((resolve) => { lateRelease = resolve; });
    let sameCalls = 0;
    let independentCalls = 0;
    const service = runner([
      route("hung", "ota", async ({ context: value }) => {
        await late;
        return available(value);
      }, { timeoutMs: 10, priority: 1 }),
      route("same", "ota", async ({ context: value }) => { sameCalls += 1; return available(value); },
        { priority: 2 }),
      route("other", "provider", async ({ context: value }) => {
        independentCalls += 1;
        return available(value);
      }, { priority: 3 }),
    ], [limits("ota", { maxConcurrency: 1 }), limits("provider")]);
    const result = await service.run([{ id: "one", context: context() }]);
    expect(result.results[0]?.attempts.map(({ reason }) => reason)).toEqual([
      "timeout", "upstream-quarantined", null,
    ]);
    expect(result.upstreams.ota?.quarantinedReads).toBe(1);
    expect(sameCalls).toBe(0);
    expect(independentCalls).toBe(1);
    lateRelease();
    await Promise.resolve();
    await Promise.resolve();
  });

  test("an adapter cannot forge the runner timeout classification with its error message", async () => {
    let fallbackCalls = 0;
    const service = runner([
      route("throwing", "ota", async () => { throw new Error("adapter-timeout"); }, { priority: 1 }),
      route("fallback", "ota", async ({ context: value }) => {
        fallbackCalls += 1;
        return available(value);
      }, { priority: 2 }),
    ], [limits("ota", { maxConcurrency: 1 })]);
    const result = await service.run([{ id: "one", context: context() }]);
    expect(result.results[0]?.attempts.map(({ reason }) => reason)).toEqual(["network", null]);
    expect(result.upstreams.ota?.quarantinedReads).toBe(0);
    expect(fallbackCalls).toBe(1);
  });

  test("aborting a queued acquisition removes it without underflow or later over-admission", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let active = 0;
    let peak = 0;
    const service = runner([route("api", "ota", async ({ context: value }) => {
      active += 1;
      peak = Math.max(peak, active);
      if (value.membership === "holder") await gate;
      active -= 1;
      return available(value);
    })], [limits("ota", { maxConcurrency: 1, maxRequestsPerRun: 5 })]);
    const first = service.run([{ id: "holder", context: context({ membership: "holder" }) }]);
    await Promise.resolve();
    const controller = new AbortController();
    const queued = service.run([{ id: "queued", context: context({ membership: "queued" }) }],
      { signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    const queuedResult = await queued;
    expect(queuedResult.results[0]?.attempts[0]?.reason).toBe("aborted");
    release();
    await first;
    const final = await service.run([{ id: "final", context: context({ membership: "final" }) }]);
    expect(final.results[0]?.status).toBe("actionable");
    expect(peak).toBe(1);
  });

  test("stale, unknown-age and unzoned source prices are retained but never actionable or cached", async () => {
    let calls = 0;
    const service = runner([route("capture", "source", async ({ context: value }) => {
      calls += 1;
      const sourceTimestamp = value.membership === "stale"
        ? { raw: "2026-09-08T09:00:00.000Z", basis: "utc-instant" as const }
        : value.membership === "unknown"
          ? { raw: null, basis: "unknown" as const }
          : { raw: "2026-09-08 11:58", basis: "local-or-unspecified" as const };
      return available(value, { sourceTimestamp });
    })], [limits("source")], { maxSourceAgeMs: 3_600_000 });
    const requests = ["stale", "unknown", "unzoned"].map((membership) =>
      ({ id: membership, context: context({ membership }) }));
    const first = await service.run(requests);
    expect(first.results.map((item) => item.status)).toEqual([
      "non-actionable", "non-actionable", "non-actionable",
    ]);
    expect(first.results.map((item) => item.retainedObservations[0]?.reason)).toEqual([
      "stale-source", "unknown-source-age", "incomparable-source-age",
    ]);
    expect(service.cacheSnapshot().size).toBe(0);
    await service.run(requests.map((request, index) => ({ ...request, id: `again-${index}` })));
    expect(calls).toBe(6);
  });

  test("an expired valid observation remains an explicitly stale fallback after failed refreshes", async () => {
    const value = context();
    const key = marketShoppingContextKey(value);
    const originalCollectedAt = "2026-09-08T11:59:00.000Z";
    const originalSourceTimestamp = { raw: "2026-09-08T11:58:00.000Z", basis: "utc-instant" as const };
    let now = NOW;
    let mode: "fresh" | "fail" | "replace" = "fresh";
    let calls = 0;
    let failureGate: Promise<void> | null = null;
    let releaseFailure!: () => void;
    let markFailureStarted!: () => void;
    const failureStarted = new Promise<void>((resolve) => { markFailureStarted = resolve; });
    const service = runner([route("api", "ota", async ({ context: current }) => {
      calls += 1;
      if (mode === "fail") {
        markFailureStarted();
        await failureGate;
        return { outcome: "failure", kind: "network" };
      }
      if (mode === "replace") {
        return available(current, {
          collectedAt: new Date(now - 60_000).toISOString(),
          sourceTimestamp: { raw: new Date(now - 120_000).toISOString(), basis: "utc-instant" },
        });
      }
      return available(current, { collectedAt: originalCollectedAt, sourceTimestamp: originalSourceTimestamp });
    })], [limits("ota", { maxRequestsPerRun: 1, maxConcurrency: 1 })], { now: () => now });

    const initial = await service.run([{ id: "initial", context: value }]);
    expect(initial.results[0]?.status).toBe("actionable");
    expect(service.cacheSnapshot().get(key)?.collectedAt).toBe(originalCollectedAt);

    now += 2 * 3_600_000;
    mode = "fail";
    failureGate = new Promise<void>((resolve) => { releaseFailure = resolve; });
    const firstRefresh = service.run([{ id: "refresh-one", context: value }]);
    await failureStarted;
    const overlappingRefresh = service.run([{ id: "refresh-two", context: value }]);
    expect(calls).toBe(2);
    releaseFailure();
    failureGate = null;
    const [first, second] = await Promise.all([firstRefresh, overlappingRefresh]);
    for (const result of [first, second]) {
      const item = result.results[0];
      expect(item?.status).toBe("non-actionable");
      expect(item?.cacheHit).toBe(false);
      expect(item?.observation?.context).toEqual(value);
      expect(item?.observation?.collectedAt).toBe(originalCollectedAt);
      expect(item?.observation?.sourceTimestamp).toEqual(originalSourceTimestamp);
      expect(item?.observation?.routeId).toBe("api");
      expect(item?.observation?.method).toBe("official-api");
      expect(item?.observation?.upstream).toBe("ota");
      expect(item?.retainedObservations).toHaveLength(1);
      expect(item?.retainedObservations[0]?.actionable).toBe(false);
      expect(item?.retainedObservations[0]?.reason).toBe("stale-collection");
      expect(item?.attempts.map(({ reason }) => reason)).toEqual(["network"]);
      expect(result.upstreams.ota?.requestsUsed).toBe(1);
    }
    expect(service.cacheSnapshot().get(key)?.collectedAt).toBe(originalCollectedAt);

    const repeated = await service.run([{ id: "refresh-three", context: value }]);
    expect(calls).toBe(3);
    expect(repeated.results[0]?.status).toBe("non-actionable");
    expect(repeated.results[0]?.observation?.collectedAt).toBe(originalCollectedAt);
    expect(repeated.results[0]?.retainedObservations[0]?.reason).toBe("stale-collection");
    expect(service.cacheSnapshot().get(key)?.collectedAt).toBe(originalCollectedAt);

    mode = "replace";
    const replacement = await service.run([{ id: "replacement", context: value }]);
    expect(calls).toBe(4);
    expect(replacement.results[0]?.status).toBe("actionable");
    expect(replacement.results[0]?.cacheHit).toBe(false);
    expect(replacement.results[0]?.observation?.collectedAt).not.toBe(originalCollectedAt);
    expect(service.cacheSnapshot().get(key)?.collectedAt).toBe(replacement.results[0]?.observation?.collectedAt);
  });

  test("expired cached unavailability is stale rather than current, while invalid cache is discarded", async () => {
    const value = context();
    const key = marketShoppingContextKey(value);
    let now = NOW;
    let fail = false;
    const service = runner([route("api", "ota", async ({ context: current }) => {
      if (fail) return { outcome: "failure", kind: "network" };
      return {
        outcome: "unavailable", context: current, collectedAt: "2026-09-08T11:59:00.000Z",
        sourceTimestamp: { raw: null, basis: "unknown" }, sourceReason: "source returned no offer",
      };
    })], [limits("ota")], { now: () => now });
    const initial = await service.run([{ id: "initial", context: value }]);
    expect(initial.results[0]?.status).toBe("unavailable");
    now += 2 * 3_600_000;
    fail = true;
    const stale = await service.run([{ id: "expired", context: value }]);
    expect(stale.results[0]?.status).toBe("non-actionable");
    expect(stale.results[0]?.cacheHit).toBe(false);
    expect(stale.results[0]?.observation?.outcome).toBe("unavailable");
    expect(stale.results[0]?.retainedObservations[0]?.reason).toBe("stale-collection");
    expect(stale.results[0]?.attempts.map(({ reason }) => reason)).toEqual(["network"]);
    expect(service.cacheSnapshot().get(key)?.collectedAt).toBe("2026-09-08T11:59:00.000Z");

    const wrongContext = context({ tenantId: "tenant-b" });
    const crossContext: MarketShoppingObservation = {
      ...available(wrongContext), routeId: "cache", method: "archive", upstream: "archive",
    };
    const invalidCurrency: MarketShoppingObservation = {
      ...available(value, { total: { amountMinor: "100", currency: "EUR", basis: "entire-stay",
        mandatoryChargesIncluded: true } }), routeId: "cache", method: "archive", upstream: "archive",
    };
    let reads = 0;
    const rejectingRoute = route("reject", "reject", async () => {
      reads += 1;
      return { outcome: "failure", kind: "network" };
    });
    const crossContextService = runner([rejectingRoute], [limits("reject")], {
      initialCache: new Map([[key, crossContext]]),
    });
    expect(crossContextService.cacheSnapshot().size).toBe(0);
    const crossContextResult = await crossContextService.run([{ id: "cross-context", context: value }]);
    expect(crossContextResult.results[0]?.status).toBe("failed");
    expect(crossContextResult.results[0]?.observation).toBeNull();

    const invalidCurrencyService = runner([rejectingRoute], [limits("reject")], {
      initialCache: new Map([[key, invalidCurrency]]),
    });
    const invalidCurrencyResult = await invalidCurrencyService.run([{ id: "invalid-currency", context: value }]);
    expect(invalidCurrencyResult.results[0]?.status).toBe("failed");
    expect(invalidCurrencyResult.results[0]?.observation).toBeNull();
    expect(invalidCurrencyService.cacheSnapshot().size).toBe(0);
    expect(reads).toBe(2);
  });

  test("cached available observations retain their original source-age reason when collection is still fresh", async () => {
    const staleSource = context({ membership: "stale-source-cache" });
    const unknownSource = context({ membership: "unknown-source-cache" });
    const staleCollectedAt = "2026-09-08T11:59:00.000Z";
    const staleSourceTimestamp = { raw: "2026-09-08T09:00:00.000Z", basis: "utc-instant" as const };
    const unknownCollectedAt = "2026-09-08T11:58:00.000Z";
    const unknownSourceTimestamp = { raw: null, basis: "unknown" as const };
    const cachedStale: MarketShoppingObservation = {
      ...available(staleSource, { collectedAt: staleCollectedAt, sourceTimestamp: staleSourceTimestamp }),
      routeId: "cache", method: "archive", upstream: "archive",
    };
    const cachedUnknown: MarketShoppingObservation = {
      ...available(unknownSource, { collectedAt: unknownCollectedAt, sourceTimestamp: unknownSourceTimestamp }),
      routeId: "cache", method: "archive", upstream: "archive",
    };
    const service = runner([route("api", "ota", async () => ({ outcome: "failure", kind: "network" }))],
      [limits("ota")], { initialCache: new Map([
        [marketShoppingContextKey(staleSource), cachedStale],
        [marketShoppingContextKey(unknownSource), cachedUnknown],
      ]) });
    const result = await service.run([
      { id: "stale-source", context: staleSource },
      { id: "unknown-source", context: unknownSource },
    ]);
    expect(result.results.map(({ status }) => status)).toEqual(["non-actionable", "non-actionable"]);
    expect(result.results.map(({ retainedObservations }) => retainedObservations[0]?.reason))
      .toEqual(["stale-source", "unknown-source-age"]);
    expect(result.results.map(({ observation }) => observation?.collectedAt))
      .toEqual([staleCollectedAt, unknownCollectedAt]);
    expect(result.results.map(({ observation }) => observation?.sourceTimestamp))
      .toEqual([staleSourceTimestamp, unknownSourceTimestamp]);
    expect(service.cacheSnapshot().get(marketShoppingContextKey(staleSource))?.collectedAt).toBe(staleCollectedAt);
    expect(service.cacheSnapshot().get(marketShoppingContextKey(unknownSource))?.collectedAt).toBe(unknownCollectedAt);
  });

  test("a new non-actionable observation remains primary and appends a distinct cached fallback once", async () => {
    const value = context();
    const oldCollectedAt = new Date(NOW - 2 * 3_600_000).toISOString();
    const oldSourceTimestamp = { raw: new Date(NOW - 2 * 3_600_000 - 60_000).toISOString(),
      basis: "utc-instant" as const };
    const cached: MarketShoppingObservation = {
      ...available(value, { collectedAt: oldCollectedAt, sourceTimestamp: oldSourceTimestamp }),
      routeId: "cache", method: "archive", upstream: "archive",
    };
    const key = marketShoppingContextKey(value);
    const service = runner([route("new", "ota", async ({ context: current }) => available(current, {
      collectedAt: "2026-09-08T11:59:00.000Z",
      sourceTimestamp: { raw: null, basis: "unknown" },
    }))], [limits("ota")], { initialCache: new Map([[key, cached]]) });
    const result = await service.run([{ id: "new-observation", context: value }]);
    const item = result.results[0];
    expect(item?.status).toBe("non-actionable");
    expect(item?.cacheHit).toBe(false);
    expect(item?.observation?.routeId).toBe("new");
    expect(item?.observation?.collectedAt).toBe("2026-09-08T11:59:00.000Z");
    expect(item?.retainedObservations.map(({ reason }) => reason))
      .toEqual(["unknown-source-age", "stale-collection"]);
    expect(item?.retainedObservations[1]?.observation.collectedAt).toBe(oldCollectedAt);
    expect(service.cacheSnapshot().get(key)?.collectedAt).toBe(oldCollectedAt);

    const duplicateService = runner([route("cache", "archive", async ({ context: current }) => available(current, {
      collectedAt: oldCollectedAt, sourceTimestamp: oldSourceTimestamp,
    }), { method: "archive" })], [limits("archive")], { initialCache: new Map([[key, cached]]) });
    const duplicate = await duplicateService.run([{ id: "same-observation", context: value }]);
    expect(duplicate.results[0]?.status).toBe("non-actionable");
    expect(duplicate.results[0]?.retainedObservations).toHaveLength(1);
    expect(duplicate.results[0]?.retainedObservations[0]?.reason).toBe("stale-collection");
  });

  test("wrong-context cache entries, cross-currency prices and booked-occupancy claims cannot satisfy a request", async () => {
    const wanted = context();
    const wrong = context({ tenantId: "tenant-b" });
    const cached = available(wrong);
    const cachedObservation = { ...cached, routeId: "cache", method: "archive" as const, upstream: "archive" };
    let validCalls = 0;
    const service = runner([
      route("wrong-currency", "bad", async ({ context: value }) => available(value,
        { total: { amountMinor: "100", currency: "EUR", basis: "entire-stay", mandatoryChargesIncluded: true } }),
        { priority: 1 }),
      route("occupancy-claim", "bad-two", async ({ context: value }) => ({
        outcome: "unavailable", context: value, collectedAt: "2026-09-08T11:59:00.000Z",
        sourceTimestamp: { raw: "2026-09-08T11:58:00.000Z", basis: "utc-instant" },
        sourceReason: "not offered", bookedOccupancy: 12,
      } as unknown as MarketAdapterResult), { priority: 2 }),
      route("valid", "good", async ({ context: value }) => { validCalls += 1; return available(value); },
        { priority: 3 }),
    ], [limits("bad"), limits("bad-two"), limits("good")], {
      initialCache: new Map([[marketShoppingContextKey(wanted), cachedObservation]]),
    });
    const result = await service.run([{ id: "wanted", context: wanted }]);
    expect(result.results[0]?.attempts.map(({ reason }) => reason)).toEqual([
      "invalid-response", "invalid-response", null,
    ]);
    expect(result.results[0]?.cacheHit).toBe(false);
    expect(validCalls).toBe(1);
  });

  test("hostile cached provenance is rejected before it can become actionable or audited output", async () => {
    const wanted = context();
    const raw = available(wanted);
    const poisoned = { ...raw, routeId: "<img src=x onerror=alert(1)>",
      method: "evil", upstream: "../bad" } as unknown as MarketShoppingObservation;
    let calls = 0;
    const service = runner([route("valid", "good", async ({ context: value }) => {
      calls += 1;
      return available(value);
    })], [limits("good")], {
      initialCache: new Map([[marketShoppingContextKey(wanted), poisoned]]),
    });
    const result = await service.run([{ id: "wanted", context: wanted }]);
    expect(result.results[0]?.cacheHit).toBe(false);
    expect(result.results[0]?.observation?.routeId).toBe("valid");
    expect(JSON.stringify(result)).not.toContain("onerror");
    expect(calls).toBe(1);
  });

  test("source-reported unavailability stays non-pricing and carries no booked occupancy", async () => {
    const service = runner([route("api", "ota", async ({ context: value }) => ({
      outcome: "unavailable", context: value, collectedAt: "2026-09-08T11:59:00.000Z",
      sourceTimestamp: { raw: null, basis: "unknown" }, sourceReason: "source returned no offer",
    }))], [limits("ota")]);
    const result = await service.run([{ id: "one", context: context() }]);
    expect(result.results[0]?.status).toBe("unavailable");
    expect(result.results[0]?.retainedObservations[0]?.reason).toBe("unavailable-not-occupancy");
    expect(JSON.stringify(result)).not.toContain("bookedOccupancy");
    expect(JSON.stringify(result)).not.toContain("occupancyPercent");
  });

  test("expired fallback entries remain subject to deterministic bounded cache eviction", async () => {
    const expired = context({ membership: "expired" });
    const middle = context({ membership: "middle" });
    const newest = context({ membership: "newest" });
    const expiredKey = marketShoppingContextKey(expired);
    const oldCollectedAt = new Date(NOW - 2 * 3_600_000).toISOString();
    const cachedExpired: MarketShoppingObservation = {
      ...available(expired, { collectedAt: oldCollectedAt,
        sourceTimestamp: { raw: new Date(NOW - 2 * 3_600_000 - 60_000).toISOString(), basis: "utc-instant" } }),
      routeId: "cache", method: "archive", upstream: "archive",
    };
    const service = runner([route("api", "ota", async ({ context: current }) => {
      if (current.membership === "expired") return { outcome: "failure", kind: "network" };
      return available(current, {
        collectedAt: new Date(NOW - 60_000).toISOString(),
        sourceTimestamp: { raw: new Date(NOW - 120_000).toISOString(), basis: "utc-instant" },
      });
    })], [limits("ota")], { maxCacheEntries: 2,
      initialCache: new Map([[expiredKey, cachedExpired]]) });

    const retained = await service.run([{ id: "expired", context: expired }]);
    expect(retained.results[0]?.status).toBe("non-actionable");
    expect(service.cacheSnapshot().has(expiredKey)).toBe(true);
    await service.run([{ id: "middle", context: middle }]);
    await service.run([{ id: "newest", context: newest }]);
    const cache = service.cacheSnapshot();
    expect(cache.size).toBe(2);
    expect(cache.has(expiredKey)).toBe(false);
    expect(cache.has(marketShoppingContextKey(middle))).toBe(true);
    expect(cache.has(marketShoppingContextKey(newest))).toBe(true);
  });

  test("cache is bounded and exact-context observations remain isolated", async () => {
    const service = runner([route("api", "ota", async ({ context: value }) => available(value))],
      [limits("ota")], { maxCacheEntries: 2 });
    await service.run([0, 1, 2].map((index) => ({ id: `job-${index}`,
      context: context({ checkInDate: `2026-09-${20 + index}` }) })));
    const cache = service.cacheSnapshot();
    expect(cache.size).toBe(2);
    expect(cache.has(marketShoppingContextKey(context({ checkInDate: "2026-09-20" })))).toBe(false);
  });

  test("cadence boundaries and calendar-month scheduling use property-local calendar terms", () => {
    const expected = new Map([
      [0, 60], [7, 60], [8, 120], [20, 120], [21, 180], [30, 180], [31, 240],
      [45, 240], [46, 300], [90, 300], [91, 360], [180, 360],
    ]);
    for (const [days, minutes] of expected) {
      expect(marketShoppingCadence(days, "15-days")).toEqual({ kind: "fixed", intervalMinutes: minutes });
    }
    expect(marketShoppingCadence(181, "1-day")).toEqual({ kind: "fixed", intervalMinutes: 1_440 });
    expect(marketShoppingCadence(181, "2-days")).toEqual({ kind: "fixed", intervalMinutes: 2_880 });
    expect(marketShoppingCadence(181, "7-days")).toEqual({ kind: "fixed", intervalMinutes: 10_080 });
    expect(marketShoppingCadence(181, "15-days")).toEqual({ kind: "fixed", intervalMinutes: 21_600 });
    expect(marketShoppingPropertyLocalDaysAhead("2026-09-08", "2026-09-29")).toBe(21);
    expect(marketShoppingCadenceForDates("2026-09-08", "2026-09-29", "1-day"))
      .toEqual({ kind: "fixed", intervalMinutes: 180 });
    expect(() => marketShoppingPropertyLocalDaysAhead("2026-09-08", "2026-09-07")).toThrow();
    const monthly = marketShoppingCadence(181, "calendar-month");
    expect(nextMarketShoppingCollectionLocal("2027-01-31", 90, monthly)).toEqual({ localDate: "2027-02-28", localMinute: 90 });
    expect(nextMarketShoppingCollectionLocal("2028-01-31", 90, monthly)).toEqual({ localDate: "2028-02-29", localMinute: 90 });
    expect(nextMarketShoppingCollectionLocal("2026-12-31", 1_439,
      { kind: "fixed", intervalMinutes: 60 })).toEqual({ localDate: "2027-01-01", localMinute: 59 });
  });

  test("30 percent gross-margin quote uses exact bigint ceiling arithmetic", () => {
    expect(quoteMarketShoppingCost("1", "USD")).toEqual({ currency: "USD", allInCostMinor: "1",
      quotedMinor: "2", grossMarginBasisPoints: 3_000 });
    expect(quoteMarketShoppingCost(70n, "USD").quotedMinor).toBe("100");
    expect(quoteMarketShoppingCost("9007199254740993", "USD").quotedMinor).toBe("12867427506772848");
    expect(() => quoteMarketShoppingCost("01", "USD")).toThrow("exact minor units");
    expect(() => quoteMarketShoppingCost("9223372036854775807", "USD")).toThrow("quotedMinor exceeds");
  });
});
