import type {
  FiscalSubmissionWorkerStepInput,
  FiscalSubmissionWorkerStepResult,
} from "./fiscal-submission-worker";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PROVIDER_KEY = /^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$/;
const RECONCILIATION_MARGIN_MS = 5_000;

export type FiscalSubmissionDeliveryRuntimeState = "disabled" | "running" | "failed";

export interface FiscalSubmissionCursor {
  readonly tenantId: string;
  readonly submissionId: string;
}

export interface DueFiscalSubmission extends FiscalSubmissionCursor {
  readonly providerKey: string;
  readonly providerExtensionId: string;
  readonly providerExtensionVersion: number;
}

export interface DueFiscalSubmissionSource {
  listDueSubmissions(
    limit: number,
    cursor: Readonly<FiscalSubmissionCursor> | null,
  ): Promise<readonly DueFiscalSubmission[]>;
}

export interface FiscalSubmissionDeliveryOperations {
  runOnce(input: FiscalSubmissionWorkerStepInput, signal?: AbortSignal): Promise<FiscalSubmissionWorkerStepResult>;
}

export interface FiscalSubmissionDeliveryRuntimeOptions {
  readonly batchSize?: number;
  readonly pollIntervalMs?: number;
  readonly leaseSeconds?: number;
  readonly transportDeadlineMs?: number;
}

export interface FiscalSubmissionDeliveryFailure {
  readonly code: string;
}

export interface FiscalSubmissionDeliveryDrainResult {
  readonly discovered: number;
  readonly reconciled: number;
  readonly unavailable: number;
  readonly busy: number;
  readonly idle: number;
  readonly failures: readonly Readonly<FiscalSubmissionDeliveryFailure>[];
}

export interface FiscalSubmissionDeliveryRunOptions {
  readonly signal?: AbortSignal;
  readonly onResult?: (result: FiscalSubmissionDeliveryDrainResult) => void;
  readonly onError?: () => void;
}

const DUE_KEYS = ["tenantId", "submissionId", "providerKey", "providerExtensionId",
  "providerExtensionVersion"] as const;

function bounded(name: string, value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function snapshotDue(value: unknown): Readonly<DueFiscalSubmission> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key === "symbol")) return null;
    const actual = keys.map(String).sort();
    const expected = [...DUE_KEYS].sort();
    if (actual.length !== expected.length || !actual.every((key, index) => key === expected[index])) return null;
    const read = (key: string): unknown => {
      const descriptor = descriptors[key];
      if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined
          || !("value" in descriptor) || descriptor.enumerable !== true) throw new Error("invalid descriptor");
      return descriptor.value;
    };
    const tenantId = read("tenantId");
    const submissionId = read("submissionId");
    const providerKey = read("providerKey");
    const providerExtensionId = read("providerExtensionId");
    const providerExtensionVersion = read("providerExtensionVersion");
    if (typeof tenantId !== "string" || !UUID.test(tenantId)
        || typeof submissionId !== "string" || !UUID.test(submissionId)
        || typeof providerKey !== "string" || !PROVIDER_KEY.test(providerKey)
        || typeof providerExtensionId !== "string" || !UUID.test(providerExtensionId)
        || typeof providerExtensionVersion !== "number" || !Number.isSafeInteger(providerExtensionVersion)
        || providerExtensionVersion < 1) return null;
    return Object.freeze({ tenantId, submissionId, providerKey,
      providerExtensionId, providerExtensionVersion });
  } catch {
    return null;
  }
}

function snapshotPage(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const length = descriptors.length?.value;
    if (typeof length !== "number" || !Number.isSafeInteger(length)
        || length < 0 || length > maximum || Reflect.ownKeys(value).length !== length + 1) return null;
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined
          || !("value" in descriptor) || descriptor.enumerable !== true) return null;
      result.push(descriptor.value);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function key(value: FiscalSubmissionCursor): string {
  return `${value.tenantId}\u0000${value.submissionId}`;
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
    const timer = setTimeout(finish, milliseconds);
    const abort = () => { clearTimeout(timer); finish(); };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export class FiscalSubmissionDeliveryRuntime {
  readonly #delivery: FiscalSubmissionDeliveryOperations;
  readonly #source: DueFiscalSubmissionSource;
  readonly #batchSize: number;
  readonly #pollIntervalMs: number;
  readonly #leaseSeconds: number;
  readonly #transportDeadlineMs: number;
  #cursor: Readonly<FiscalSubmissionCursor> | null = null;
  #state: FiscalSubmissionDeliveryRuntimeState = "disabled";
  #running = false;

  constructor(
    delivery: FiscalSubmissionDeliveryOperations,
    source: DueFiscalSubmissionSource,
    options: FiscalSubmissionDeliveryRuntimeOptions = {},
  ) {
    this.#delivery = delivery;
    this.#source = source;
    this.#batchSize = bounded("batchSize", options.batchSize ?? 100, 1, 500);
    this.#pollIntervalMs = bounded("pollIntervalMs", options.pollIntervalMs ?? 1_000, 100, 60_000);
    this.#leaseSeconds = bounded("leaseSeconds", options.leaseSeconds ?? 60, 15, 300);
    this.#transportDeadlineMs = bounded(
      "transportDeadlineMs",
      options.transportDeadlineMs ?? 30_000,
      100,
      295_000,
    );
    if (this.#transportDeadlineMs + RECONCILIATION_MARGIN_MS >= this.#leaseSeconds * 1_000) {
      throw new Error("transportDeadlineMs must leave a reconciliation margin before lease expiry");
    }
  }

  get state(): FiscalSubmissionDeliveryRuntimeState {
    return this.#state;
  }

  async drainOnce(signal?: AbortSignal): Promise<FiscalSubmissionDeliveryDrainResult> {
    const empty = () => Object.freeze({ discovered: 0, reconciled: 0, unavailable: 0,
      busy: 0, idle: 0, failures: Object.freeze([]) });
    if (signal?.aborted) return empty();
    const requestedCursor = this.#cursor;
    const rawValues = await this.#source.listDueSubmissions(this.#batchSize, requestedCursor);
    const values = snapshotPage(rawValues, this.#batchSize);
    if (!values) {
      throw new Error("due fiscal submission source returned an invalid bounded page");
    }
    if (values.length === 0) {
      if (requestedCursor) this.#cursor = null;
      return empty();
    }

    const due: Readonly<DueFiscalSubmission>[] = [];
    let previous = requestedCursor ? key(requestedCursor) : null;
    for (const value of values) {
      const snapshot = snapshotDue(value);
      if (!snapshot || (previous !== null && key(snapshot) <= previous)) {
        throw new Error("due fiscal submission source returned an invalid keyset page");
      }
      previous = key(snapshot);
      due.push(snapshot);
    }

    let reconciled = 0;
    let unavailable = 0;
    let busy = 0;
    let idle = 0;
    const failures: Readonly<FiscalSubmissionDeliveryFailure>[] = [];
    for (const item of due) {
      if (signal?.aborted) break;
      // Cursor progress is independent of adapter availability or delivery outcome.
      this.#cursor = Object.freeze({ tenantId: item.tenantId, submissionId: item.submissionId });
      const result = await this.#delivery.runOnce({ ...item, leaseSeconds: this.#leaseSeconds,
        transportDeadlineMs: this.#transportDeadlineMs }, signal);
      if (result.ok) {
        if (result.kind === "reconciled") reconciled += 1;
        else if (result.reason === "adapter_unavailable") unavailable += 1;
        else if (result.reason === "adapter_busy") busy += 1;
        else idle += 1;
      } else {
        if (result.error.code === "repository_unavailable") {
          throw new Error("fiscal submission runtime repository is unavailable");
        }
        failures.push(Object.freeze({ code: result.error.code }));
      }
    }
    return Object.freeze({ discovered: due.length, reconciled, unavailable, busy, idle,
      failures: Object.freeze(failures) });
  }

  async run(options: FiscalSubmissionDeliveryRunOptions = {}): Promise<void> {
    if (this.#running) throw new Error("fiscal submission delivery runtime is already running");
    this.#running = true;
    this.#state = "running";
    try {
      while (!options.signal?.aborted) {
        const startedAt = Date.now();
        const result = await this.drainOnce(options.signal);
        options.onResult?.(result);
        await wait(Math.max(0, this.#pollIntervalMs - (Date.now() - startedAt)), options.signal);
      }
      this.#state = "disabled";
    } catch (error) {
      this.#state = "failed";
      options.onError?.();
      throw error;
    } finally {
      this.#running = false;
    }
  }
}
