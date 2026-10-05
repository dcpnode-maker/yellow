const SOURCE_CAPACITY = 5;
const SOURCE_REFILL_TOKENS = 20;
const SOURCE_REFILL_PERIOD_MS = 60_000;
const ACCOUNT_CAPACITY = 3;
const ACCOUNT_REFILL_TOKENS = 8;
const ACCOUNT_REFILL_PERIOD_MS = 15 * 60_000;
const FAILURE_BACKOFF_SECONDS = Object.freeze([1, 2, 4, 8, 16, 32, 60] as const);
const MAX_CONCURRENT_VERIFICATIONS = 4;
const MAX_SOURCE_ENTRIES = 4_096;
const MAX_ACCOUNT_ENTRIES = 8_192;
const MAX_RETRY_AFTER_SECONDS = 900;
const RECLAIM_SCAN_LIMIT = 64;

export const localLoginGuardPolicy = Object.freeze({
  source: Object.freeze({
    capacity: SOURCE_CAPACITY,
    refillTokens: SOURCE_REFILL_TOKENS,
    refillPeriodMs: SOURCE_REFILL_PERIOD_MS,
  }),
  account: Object.freeze({
    capacity: ACCOUNT_CAPACITY,
    refillTokens: ACCOUNT_REFILL_TOKENS,
    refillPeriodMs: ACCOUNT_REFILL_PERIOD_MS,
  }),
  failureBackoffSeconds: FAILURE_BACKOFF_SECONDS,
  maxConcurrentVerifications: MAX_CONCURRENT_VERIFICATIONS,
  maxSourceEntries: MAX_SOURCE_ENTRIES,
  maxAccountEntries: MAX_ACCOUNT_ENTRIES,
});

export interface LocalLoginGuardOptions {
  readonly now?: () => number;
  readonly maxSourceEntries?: number;
  readonly maxAccountEntries?: number;
}

export type LocalLoginGuardDecision =
  | Readonly<{ allowed: true }>
  | Readonly<{ allowed: false; retryAfterSeconds: number }>;

export type LocalLoginVerification<T> =
  | Readonly<{ allowed: true; value: T }>
  | Readonly<{ allowed: false; retryAfterSeconds: number }>;

interface BucketEntry {
  creditMs: number;
  lastRefillMs: number;
  lastUsedMs: number;
}

interface AccountEntry extends BucketEntry {
  failureCount: number;
  backoffUntilMs: number;
}

function requirePositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return value;
}

function boundedRetryAfter(milliseconds: number): number {
  if (!Number.isFinite(milliseconds)) return MAX_RETRY_AFTER_SECONDS;
  return Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(1, Math.ceil(milliseconds / 1_000)));
}

function refill(entry: BucketEntry, now: number, maximumCredit: number): void {
  const elapsed = Math.max(0, now - entry.lastRefillMs);
  entry.creditMs = Math.min(maximumCredit, entry.creditMs + elapsed);
  entry.lastRefillMs = now;
}

function touch<T extends BucketEntry>(entries: Map<string, T>, key: string, entry: T, now: number): void {
  entry.lastUsedMs = now;
  entries.delete(key);
  entries.set(key, entry);
}

export class LocalLoginLimitedError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Local login is temporarily limited");
    this.name = "LocalLoginLimitedError";
    this.retryAfterSeconds = boundedRetryAfter(retryAfterSeconds * 1_000);
  }
}

export class LocalLoginGuard {
  readonly #now: () => number;
  readonly #maxSourceEntries: number;
  readonly #maxAccountEntries: number;
  readonly #sources = new Map<string, BucketEntry>();
  readonly #accounts = new Map<string, AccountEntry>();
  #activeVerifications = 0;
  #lastNow = 0;

  constructor(options: LocalLoginGuardOptions = {}) {
    this.#now = options.now ?? (() => Math.floor(performance.now()));
    this.#maxSourceEntries = requirePositiveInteger(
      options.maxSourceEntries ?? MAX_SOURCE_ENTRIES,
      "maxSourceEntries",
    );
    this.#maxAccountEntries = requirePositiveInteger(
      options.maxAccountEntries ?? MAX_ACCOUNT_ENTRIES,
      "maxAccountEntries",
    );
  }

  consume(sourceKey: string, accountKey: string): LocalLoginGuardDecision {
    if (sourceKey.length === 0 || sourceKey.length > 128 || accountKey.length === 0 || accountKey.length > 320) {
      return Object.freeze({ allowed: false, retryAfterSeconds: MAX_RETRY_AFTER_SECONDS });
    }
    const now = this.#monotonicNow();
    const source = this.#source(sourceKey, now);
    const account = this.#account(accountKey, now);
    let retryMs = 0;

    if (source) {
      const cost = SOURCE_REFILL_PERIOD_MS / SOURCE_REFILL_TOKENS;
      refill(source, now, SOURCE_CAPACITY * cost);
      if (source.creditMs >= cost) source.creditMs -= cost;
      else retryMs = Math.max(retryMs, cost - source.creditMs);
      touch(this.#sources, sourceKey, source, now);
    } else {
      retryMs = this.#admissionRetry(this.#sources, now, SOURCE_REFILL_PERIOD_MS);
    }

    if (account) {
      const cost = ACCOUNT_REFILL_PERIOD_MS / ACCOUNT_REFILL_TOKENS;
      refill(account, now, ACCOUNT_CAPACITY * cost);
      if (account.creditMs >= cost) account.creditMs -= cost;
      else retryMs = Math.max(retryMs, cost - account.creditMs);
      if (account.backoffUntilMs > now) retryMs = Math.max(retryMs, account.backoffUntilMs - now);
      touch(this.#accounts, accountKey, account, now);
    } else {
      retryMs = this.#admissionRetry(this.#accounts, now, ACCOUNT_REFILL_PERIOD_MS);
    }

    return retryMs > 0
      ? Object.freeze({ allowed: false, retryAfterSeconds: boundedRetryAfter(retryMs) })
      : Object.freeze({ allowed: true });
  }

  recordFailure(accountKey: string): void {
    const now = this.#monotonicNow();
    const account = this.#accounts.get(accountKey);
    if (!account) return;
    account.failureCount = Math.min(account.failureCount + 1, FAILURE_BACKOFF_SECONDS.length);
    const seconds = FAILURE_BACKOFF_SECONDS[account.failureCount - 1] ?? 60;
    account.backoffUntilMs = now + seconds * 1_000;
    touch(this.#accounts, accountKey, account, now);
  }

  recordSuccess(accountKey: string): void {
    const now = this.#monotonicNow();
    const account = this.#accounts.get(accountKey);
    if (!account) return;
    account.failureCount = 0;
    account.backoffUntilMs = 0;
    touch(this.#accounts, accountKey, account, now);
  }

  async verify<T>(operation: () => Promise<T>): Promise<LocalLoginVerification<T>> {
    if (this.#activeVerifications >= MAX_CONCURRENT_VERIFICATIONS) {
      return Object.freeze({ allowed: false, retryAfterSeconds: 1 });
    }
    this.#activeVerifications += 1;
    try {
      return Object.freeze({ allowed: true, value: await operation() });
    } finally {
      this.#activeVerifications -= 1;
    }
  }

  snapshot() {
    return Object.freeze({
      sourceEntries: this.#sources.size,
      accountEntries: this.#accounts.size,
      activeVerifications: this.#activeVerifications,
      waitingVerifications: 0,
    });
  }

  #monotonicNow(): number {
    const candidate = this.#now();
    if (!Number.isSafeInteger(candidate) || candidate < 0) {
      throw new Error("Local login guard clock must return non-negative integer milliseconds");
    }
    this.#lastNow = Math.max(this.#lastNow, candidate);
    return this.#lastNow;
  }

  #source(key: string, now: number): BucketEntry | null {
    const current = this.#sources.get(key);
    if (current) return current;
    this.#reclaimSources(now);
    if (this.#sources.size >= this.#maxSourceEntries) return null;
    const cost = SOURCE_REFILL_PERIOD_MS / SOURCE_REFILL_TOKENS;
    const created = { creditMs: SOURCE_CAPACITY * cost, lastRefillMs: now, lastUsedMs: now };
    this.#sources.set(key, created);
    return created;
  }

  #account(key: string, now: number): AccountEntry | null {
    const current = this.#accounts.get(key);
    if (current) {
      const maximumCredit = ACCOUNT_CAPACITY * (ACCOUNT_REFILL_PERIOD_MS / ACCOUNT_REFILL_TOKENS);
      refill(current, now, maximumCredit);
      if (current.creditMs === maximumCredit && current.backoffUntilMs <= now &&
          now - current.lastUsedMs >= ACCOUNT_REFILL_PERIOD_MS) {
        current.failureCount = 0;
        current.backoffUntilMs = 0;
      }
      return current;
    }
    this.#reclaimAccounts(now);
    if (this.#accounts.size >= this.#maxAccountEntries) return null;
    const cost = ACCOUNT_REFILL_PERIOD_MS / ACCOUNT_REFILL_TOKENS;
    const created = {
      creditMs: ACCOUNT_CAPACITY * cost,
      lastRefillMs: now,
      lastUsedMs: now,
      failureCount: 0,
      backoffUntilMs: 0,
    };
    this.#accounts.set(key, created);
    return created;
  }

  #reclaimSources(now: number): void {
    let inspected = 0;
    const maximumCredit = SOURCE_CAPACITY * (SOURCE_REFILL_PERIOD_MS / SOURCE_REFILL_TOKENS);
    for (const [key, entry] of this.#sources) {
      if (inspected >= RECLAIM_SCAN_LIMIT) break;
      inspected += 1;
      refill(entry, now, maximumCredit);
      if (entry.creditMs === maximumCredit && now - entry.lastUsedMs >= SOURCE_REFILL_PERIOD_MS) {
        this.#sources.delete(key);
        break;
      }
    }
  }

  #reclaimAccounts(now: number): void {
    let inspected = 0;
    const maximumCredit = ACCOUNT_CAPACITY * (ACCOUNT_REFILL_PERIOD_MS / ACCOUNT_REFILL_TOKENS);
    for (const [key, entry] of this.#accounts) {
      if (inspected >= RECLAIM_SCAN_LIMIT) break;
      inspected += 1;
      refill(entry, now, maximumCredit);
      if (entry.creditMs === maximumCredit && entry.backoffUntilMs <= now &&
          now - entry.lastUsedMs >= ACCOUNT_REFILL_PERIOD_MS) {
        this.#accounts.delete(key);
        break;
      }
    }
  }

  #admissionRetry(entries: Map<string, BucketEntry>, now: number, expiryMs: number): number {
    const oldest = entries.values().next().value as BucketEntry | undefined;
    return oldest ? Math.max(1, oldest.lastUsedMs + expiryMs - now) : expiryMs;
  }
}
