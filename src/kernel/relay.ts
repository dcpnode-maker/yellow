import type { EventHandler, OutboxEvent } from "./event-bus";
import { PostgresEventBus } from "./outbox";

const MIN_POLL_INTERVAL_MS = 100;
const MAX_POLL_INTERVAL_MS = 250;
const DEFAULT_POLL_INTERVAL_MS = 150;
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 1_000;

export interface OutboxRelayOptions {
  readonly consumer: string;
  readonly pollIntervalMs?: number;
  readonly batchSize?: number;
}

export interface RelayBatchResult {
  readonly examined: number;
  readonly processed: number;
  readonly published: number;
}

export interface RelayBatchHooks {
  readonly afterConsumerCommit?: (events: readonly OutboxEvent[]) => Promise<void> | void;
}

export interface RelayRunOptions {
  readonly signal?: AbortSignal;
  readonly onPoll?: (startedAt: number) => void;
}

function validateInteger(name: string, value: number, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export class OutboxRelay {
  readonly #bus: PostgresEventBus;
  readonly #consumer: string;
  readonly #pollIntervalMs: number;
  readonly #batchSize: number;

  constructor(bus: PostgresEventBus, options: OutboxRelayOptions) {
    this.#bus = bus;
    this.#consumer = options.consumer;
    this.#pollIntervalMs = validateInteger(
      "pollIntervalMs",
      options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      MIN_POLL_INTERVAL_MS,
      MAX_POLL_INTERVAL_MS,
    );
    this.#batchSize = validateInteger(
      "batchSize",
      options.batchSize ?? DEFAULT_BATCH_SIZE,
      1,
      MAX_BATCH_SIZE,
    );
  }

  async drainOnce(handler: EventHandler, hooks: RelayBatchHooks = {}): Promise<RelayBatchResult> {
    const consumed = await this.#bus.consumeUnpublishedBatch(
      this.#consumer,
      handler,
      { limit: this.#batchSize },
    );
    await hooks.afterConsumerCommit?.(consumed.events);
    const published = await this.#bus.markPublished(consumed.events.map(({ id }) => id));
    return { examined: consumed.examined, processed: consumed.processed, published };
  }

  async run(handler: EventHandler, options: RelayRunOptions = {}): Promise<void> {
    while (!options.signal?.aborted) {
      const startedAt = Date.now();
      options.onPoll?.(startedAt);
      await this.drainOnce(handler);
      const elapsed = Date.now() - startedAt;
      await wait(Math.max(0, this.#pollIntervalMs - elapsed), options.signal);
    }
  }

  prune(retentionSeconds: number): Promise<{ processed: number; outbox: number }> {
    return this.#bus.prunePublished(retentionSeconds);
  }
}
