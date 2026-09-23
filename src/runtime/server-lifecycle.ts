export interface ServerLifecycleOptions {
  readonly controller: AbortController;
  readonly workerTasks: readonly Promise<unknown>[];
  readonly drainTimeoutMs?: number;
  readonly stopIntake: () => void | Promise<void>;
  readonly forceStopIntake?: () => void | Promise<void>;
  readonly closeResources: () => void | Promise<void>;
}

function bounded(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 60_000) {
    throw new Error("drainTimeoutMs must be between 1 and 60000");
  }
  return value;
}

type Settlement = "fulfilled" | "rejected" | "timeout";

async function within(promise: Promise<unknown>, timeoutMs: number): Promise<Settlement> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  const settled = promise.then<Settlement, Settlement>(() => "fulfilled", () => "rejected");
  const result = await Promise.race([settled, timeout]);
  if (timer !== undefined) clearTimeout(timer);
  return result;
}

export class ServerLifecycle {
  readonly #controller: AbortController;
  readonly #workerTasks: readonly Promise<unknown>[];
  readonly #drainTimeoutMs: number;
  readonly #stopIntake: () => void | Promise<void>;
  readonly #forceStopIntake: (() => void | Promise<void>) | undefined;
  readonly #closeResources: () => void | Promise<void>;
  #shutdownPromise: Promise<void> | undefined;

  constructor(options: ServerLifecycleOptions) {
    this.#controller = options.controller;
    this.#workerTasks = Object.freeze([...options.workerTasks]);
    this.#drainTimeoutMs = bounded(options.drainTimeoutMs ?? 10_000);
    this.#stopIntake = options.stopIntake;
    this.#forceStopIntake = options.forceStopIntake;
    this.#closeResources = options.closeResources;
  }

  shutdown(): Promise<void> {
    this.#shutdownPromise ??= this.#doShutdown();
    return this.#shutdownPromise;
  }

  async #doShutdown(): Promise<void> {
    let intake: Promise<unknown>;
    try {
      intake = Promise.resolve(this.#stopIntake());
    } catch (error) {
      intake = Promise.reject(error);
    }
    // Observe the intake promise immediately so a synchronous failure cannot become
    // an unhandled rejection while the workers finish their reconciliation drain.
    const intakeSettlement = within(intake, this.#drainTimeoutMs);
    this.#controller.abort();

    const [, intakeStopped] = await Promise.all([
      within(Promise.allSettled(this.#workerTasks), this.#drainTimeoutMs),
      intakeSettlement,
    ]);
    if (intakeStopped !== "fulfilled" && this.#forceStopIntake) {
      try { await within(Promise.resolve(this.#forceStopIntake()), this.#drainTimeoutMs); } catch { /* bounded shutdown */ }
    }
    try {
      await within(Promise.resolve(this.#closeResources()), this.#drainTimeoutMs);
    } catch {
      // Shutdown remains bounded and idempotent even if one resource close rejects.
    }
  }
}

export function installServerLifecycleSignals(lifecycle: ServerLifecycle): () => void {
  const handler = () => { void lifecycle.shutdown(); };
  // Keep handlers installed throughout the drain. Removing a once-listener after
  // the first OS signal restores default termination on a repeated signal.
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
  return () => {
    process.off("SIGINT", handler);
    process.off("SIGTERM", handler);
  };
}
