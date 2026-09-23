import { createAuditEnvelope, type Database } from "../../kernel";
import type { HoldService } from "./holds";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MIN_POLL_INTERVAL_MS = 100;
const MAX_POLL_INTERVAL_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_SCOPE_BATCH_SIZE = 100;
const MAX_SCOPE_BATCH_SIZE = 1_000;
const DEFAULT_HOLD_BATCH_SIZE = 100;
const MAX_HOLD_BATCH_SIZE = 100;

export const HOLD_EXPIRY_ACTOR_ID = "00000000-0000-0000-0000-000000000056";

export interface DueHoldScope {
  readonly tenantId: string;
  readonly propertyNode: string;
}

export interface DueHoldScopeSource {
  listDueScopes(limit: number): Promise<readonly DueHoldScope[]>;
}

export interface HoldExpiryWorkerOptions {
  readonly actorId?: string;
  readonly pollIntervalMs?: number;
  readonly scopeBatchSize?: number;
  readonly holdBatchSize?: number;
}

export interface HoldExpiryFailure extends DueHoldScope {
  readonly error: string;
}

export interface HoldExpiryDrainResult {
  readonly scopes: number;
  readonly expired: number;
  readonly failures: readonly HoldExpiryFailure[];
}

export interface HoldExpiryRunOptions {
  readonly signal?: AbortSignal;
  readonly onPoll?: (startedAt: number) => void;
  readonly onResult?: (result: HoldExpiryDrainResult) => void;
  readonly onError?: (error: unknown) => void;
}

type HoldExpiryOperations = Pick<HoldService, "expireDue">;

function boundedInteger(name: string, value: number, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown hold-expiry failure";
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      finish();
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export class HoldExpiryWorker {
  readonly #database: Database;
  readonly #holds: HoldExpiryOperations;
  readonly #source: DueHoldScopeSource;
  readonly #actorId: string;
  readonly #pollIntervalMs: number;
  readonly #scopeBatchSize: number;
  readonly #holdBatchSize: number;

  constructor(
    database: Database,
    holds: HoldExpiryOperations,
    source: DueHoldScopeSource,
    options: HoldExpiryWorkerOptions = {},
  ) {
    this.#database = database;
    this.#holds = holds;
    this.#source = source;
    this.#actorId = options.actorId ?? HOLD_EXPIRY_ACTOR_ID;
    if (!UUID.test(this.#actorId)) throw new Error("actorId must be a UUID");
    this.#pollIntervalMs = boundedInteger("pollIntervalMs", options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      MIN_POLL_INTERVAL_MS, MAX_POLL_INTERVAL_MS);
    this.#scopeBatchSize = boundedInteger("scopeBatchSize", options.scopeBatchSize ?? DEFAULT_SCOPE_BATCH_SIZE,
      1, MAX_SCOPE_BATCH_SIZE);
    this.#holdBatchSize = boundedInteger("holdBatchSize", options.holdBatchSize ?? DEFAULT_HOLD_BATCH_SIZE,
      1, MAX_HOLD_BATCH_SIZE);
  }

  async drainOnce(): Promise<HoldExpiryDrainResult> {
    const scopes = await this.#source.listDueScopes(this.#scopeBatchSize);
    if (scopes.length > this.#scopeBatchSize) {
      throw new Error("due-hold scope source exceeded its requested limit");
    }
    let expired = 0;
    const failures: HoldExpiryFailure[] = [];
    for (const scope of scopes) {
      try {
        const transitioned = await this.#database.withTenantTransaction(scope.tenantId, (tx) =>
          this.#holds.expireDue(tx, createAuditEnvelope({
            actorId: this.#actorId,
            tenantId: scope.tenantId,
            propertyNode: scope.propertyNode,
            requestId: crypto.randomUUID(),
            operation: "hold.expired",
          }), this.#holdBatchSize)
        );
        expired += transitioned.length;
      } catch (error) {
        failures.push({ ...scope, error: errorMessage(error) });
      }
    }
    return { scopes: scopes.length, expired, failures };
  }

  async run(options: HoldExpiryRunOptions = {}): Promise<void> {
    while (!options.signal?.aborted) {
      const startedAt = Date.now();
      options.onPoll?.(startedAt);
      try {
        options.onResult?.(await this.drainOnce());
      } catch (error) {
        options.onError?.(error);
      }
      await wait(Math.max(0, this.#pollIntervalMs - (Date.now() - startedAt)), options.signal);
    }
  }
}
