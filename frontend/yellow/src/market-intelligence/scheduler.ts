import {
  freezeContract,
  type AdapterResult,
  type MarketObservationAdapter,
  type ObservationRequest,
  type SchedulerResult,
  type SourcePolicy,
} from "./contracts";

export interface SchedulerOptions {
  readonly adapters: readonly MarketObservationAdapter[];
  readonly policy: SourcePolicy;
  readonly now?: () => number;
}

interface CacheEntry {
  readonly expiresAt: number;
  readonly result: SchedulerResult;
}

function sorted(values: readonly string[]): readonly string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

/**
 * Every request dimension that can alter an observation is included here.
 * Arrays are sorted so equivalent sets have the same key; no URL or network
 * operation is involved in key creation.
 */
export function canonicalCacheKey(request: ObservationRequest): string {
  const dimensions = {
    tenantId: request.tenantId,
    propertyId: request.propertyId,
    shell: {
      tenantId: request.shell.tenantId,
      propertyId: request.shell.propertyId,
      propertyName: request.shell.propertyName,
      timezone: request.shell.timezone,
      currency: request.shell.currency,
      roomTypeCodes: sorted(request.shell.roomTypeCodes),
      ratePlanCodes: sorted(request.shell.ratePlanCodes),
      channelCodes: sorted(request.shell.channelCodes),
      shellVersion: request.shell.shellVersion,
      asOf: request.shell.asOf,
    },
    arrival: request.arrival,
    departure: request.departure,
    occupancy: request.occupancy,
    currency: request.currency,
    roomTypeCodes: sorted(request.roomTypeCodes),
    ratePlanCodes: sorted(request.ratePlanCodes),
    channelCodes: sorted(request.channelCodes),
    sourceIds: sorted(request.sourceIds.map(String)),
    mode: request.mode,
  };
  return `yellow-market-v1:${JSON.stringify(dimensions)}`;
}

export const marketIntelligenceCacheKey = canonicalCacheKey;
export const buildCanonicalCacheKey = canonicalCacheKey;

function unavailableResult(
  sourceId: string,
  reason: Extract<AdapterResult, { kind: "unavailable" }>['reason'],
): AdapterResult {
  return freezeContract({
    kind: "unavailable",
    sourceId,
    observations: Object.freeze([]) as readonly [],
    reason,
    estimate: freezeContract({ kind: "unknown", reason }),
  });
}

function resultSources(results: readonly AdapterResult[]): readonly string[] {
  return Object.freeze(results
    .filter((result) => result.kind !== "complete")
    .map((result) => String(result.sourceId)));
}

function aggregate(
  cacheKey: string,
  results: readonly AdapterResult[],
  fromCache: boolean,
): SchedulerResult {
  const frozenResults = Object.freeze([...results]);
  const unavailableSources = resultSources(frozenResults);
  if (unavailableSources.length === 0) {
    return freezeContract({ kind: "complete", cacheKey, results: frozenResults, fromCache });
  }
  if (frozenResults.every((result) => result.kind === "unavailable")) {
    const first = frozenResults[0];
    const reason = first?.kind === "unavailable" ? first.reason : "adapter_unavailable";
    return freezeContract({
      kind: "unavailable",
      cacheKey,
      results: frozenResults,
      fromCache: false,
      reason,
      unavailableSources,
    });
  }
  return freezeContract({
    kind: "partial",
    cacheKey,
    results: frozenResults,
    fromCache,
    unavailableSources,
  });
}

/**
 * In-memory scheduler for synthetic adapters. It provides per-key coalescing,
 * bounded adapter work, and a TTL cache while refusing non-zero-cost or
 * disallowed-host work before invoking an adapter.
 */
export class MarketIntelligenceScheduler {
  private readonly adapters: readonly MarketObservationAdapter[];
  private readonly policy: SourcePolicy;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<SchedulerResult>>();

  public constructor(options: SchedulerOptions) {
    if (!Number.isSafeInteger(options.policy.maxConcurrency) || options.policy.maxConcurrency < 1) {
      throw new RangeError("source policy maxConcurrency must be at least 1");
    }
    if (!Number.isFinite(options.policy.ttlMs) || options.policy.ttlMs < 0) {
      throw new RangeError("source policy ttlMs must be non-negative");
    }
    this.adapters = Object.freeze([...options.adapters]);
    this.policy = Object.freeze({
      ...options.policy,
      allowedHosts: Object.freeze([...options.policy.allowedHosts]),
    });
    this.now = options.now ?? (() => Date.now());
  }

  public get inFlightCount(): number { return this.inFlight.size; }
  public get cacheEntryCount(): number { return this.cache.size; }

  public clear(): void {
    this.cache.clear();
  }

  public schedule(request: ObservationRequest, signal?: AbortSignal): Promise<SchedulerResult> {
    const cacheKey = canonicalCacheKey(request);
    const cached = this.cache.get(cacheKey);
    const now = this.now();
    if (cached && cached.expiresAt > now) {
      return Promise.resolve(aggregate(cacheKey, cached.result.results, true));
    }
    if (cached) this.cache.delete(cacheKey);
    const existing = this.inFlight.get(cacheKey);
    if (existing) return existing;
    const work = this.execute(cacheKey, request, signal);
    this.inFlight.set(cacheKey, work);
    void work.finally(() => {
      if (this.inFlight.get(cacheKey) === work) this.inFlight.delete(cacheKey);
    });
    return work;
  }

  /** Descriptive aliases keep the transport-free API pleasant for lab callers. */
  public run(request: ObservationRequest, signal?: AbortSignal): Promise<SchedulerResult> {
    return this.schedule(request, signal);
  }

  public scheduleObservation(request: ObservationRequest, signal?: AbortSignal): Promise<SchedulerResult> {
    return this.schedule(request, signal);
  }

  private async execute(
    cacheKey: string,
    request: ObservationRequest,
    signal?: AbortSignal,
  ): Promise<SchedulerResult> {
    const requested = new Set(request.sourceIds.map(String));
    const selected = this.adapters.filter((adapter) => requested.size === 0 || requested.has(String(adapter.sourceId)));
    const results: AdapterResult[] = [];

    if (!this.policy.zeroCost) {
      for (const adapter of selected) results.push(unavailableResult(String(adapter.sourceId), "zero_cost_required"));
      return aggregate(cacheKey, results, false);
    }
    if (signal?.aborted) {
      for (const adapter of selected) results.push(unavailableResult(String(adapter.sourceId), "aborted"));
      return aggregate(cacheKey, results, false);
    }

    const runnable: MarketObservationAdapter[] = [];
    for (const adapter of selected) {
      if (!this.policy.allowedHosts.includes(adapter.host)) {
        results.push(unavailableResult(String(adapter.sourceId), "host_not_allowed"));
      } else if (adapter.costEstimate?.kind === "estimated") {
        // A paid estimate is refused before observe() can perform any work.
        results.push(unavailableResult(String(adapter.sourceId), "zero_cost_required"));
      } else {
        runnable.push(adapter);
      }
    }

    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < runnable.length) {
        const index = cursor;
        cursor += 1;
        const adapter = runnable[index];
        if (!adapter) return;
        if (signal?.aborted) {
          results.push(unavailableResult(String(adapter.sourceId), "aborted"));
          continue;
        }
        try {
          const result = await adapter.observe(request);
          results.push(result);
        } catch {
          results.push(unavailableResult(String(adapter.sourceId), "adapter_unavailable"));
        }
      }
    };
    const workers = Math.min(this.policy.maxConcurrency, runnable.length);
    await Promise.all(Array.from({ length: workers }, () => worker()));
    const final = aggregate(cacheKey, results, false);
    if (this.policy.ttlMs > 0 && final.kind !== "unavailable") {
      this.cache.set(cacheKey, { expiresAt: this.now() + this.policy.ttlMs, result: final });
    }
    return final;
  }
}

export function createMarketIntelligenceScheduler(options: SchedulerOptions): MarketIntelligenceScheduler {
  return new MarketIntelligenceScheduler(options);
}
