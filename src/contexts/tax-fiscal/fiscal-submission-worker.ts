import type {
  FiscalProviderCallContext,
  FiscalDocumentProvider,
  FiscalProviderLookup,
  FiscalProviderResolution,
  FiscalProviderSubmission,
} from "./fiscal-provider";
import {
  snapshotFiscalSubmissionClaim,
  snapshotFiscalSubmissionNormalizedResult,
  snapshotFiscalSubmissionReceipt,
  type ClaimIndiaFiscalSubmissionInput,
  type FiscalSubmissionClaim,
  type FiscalSubmissionNormalizedResult,
  type FiscalSubmissionReceipt,
  type FiscalSubmissionRepositoryResult,
  type ReconcileIndiaFiscalSubmissionInput,
} from "./fiscal-submission-repository";
import { snapshotFiscalReceiptEvidence } from "./fiscal-submission-receipt";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const PROVIDER_KEY = /^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$/;
const REFERENCE_CONTROL = /[\u0000-\u001f\u007f]/u;
const MAX_REGISTERED_ADAPTERS = 100;
const RECONCILIATION_MARGIN_MS = 5_000;

type RecordValue = Record<string, unknown>;

export interface FiscalSubmissionWorkerRepository {
  claim(input: ClaimIndiaFiscalSubmissionInput): Promise<FiscalSubmissionRepositoryResult<FiscalSubmissionClaim>>;
  reconcile(input: ReconcileIndiaFiscalSubmissionInput): Promise<FiscalSubmissionRepositoryResult<FiscalSubmissionReceipt>>;
}

export interface VerifiedIndiaIrpAdapterRegistration {
  readonly kind: "registered_verified_india_irp_1_1_adapter";
  readonly providerKey: string;
  readonly providerExtensionId: string;
  readonly providerExtensionVersion: number;
  readonly submit: FiscalDocumentProvider["submit"];
  readonly lookup: FiscalDocumentProvider["lookup"];
}

export interface FiscalSubmissionAdapterIdentity {
  readonly providerKey: string;
  readonly providerExtensionId: string;
  readonly providerExtensionVersion: number;
}

interface RegisteredAdapter extends FiscalSubmissionAdapterIdentity {
  readonly providerKey: string;
  readonly providerExtensionId: string;
  readonly providerExtensionVersion: number;
  readonly provider: FiscalDocumentProvider;
}

export interface FiscalSubmissionWorkerStepInput {
  readonly tenantId: string;
  readonly submissionId: string;
  readonly providerKey: string;
  readonly providerExtensionId: string;
  readonly providerExtensionVersion: number;
  readonly leaseSeconds: number;
  readonly transportDeadlineMs: number;
}

export type FiscalSubmissionWorkerErrorCode =
  | "invalid_input"
  | "repository_error"
  | "repository_unavailable"
  | "invalid_claim"
  | "provider_result_invalid"
  | "reconciliation_conflict";

export interface FiscalSubmissionWorkerError {
  readonly code: FiscalSubmissionWorkerErrorCode;
  readonly message: string;
}

export type FiscalSubmissionWorkerStepResult = Readonly<
  | {
      readonly ok: true;
      readonly kind: "idle";
      readonly reason: "busy" | "terminal" | "retry_required" | "adapter_unavailable" | "adapter_busy" | "cancelled";
    }
  | {
      readonly ok: true;
      readonly kind: "reconciled";
      readonly action: "submit" | "lookup";
      readonly submissionId: string;
      readonly attemptId: string;
      readonly status: FiscalSubmissionReceipt["status"];
      readonly disposition: FiscalSubmissionReceipt["disposition"];
      readonly replayed: boolean;
    }
  | { readonly ok: false; readonly error: Readonly<FiscalSubmissionWorkerError> }
>;

const REGISTRATION_KEYS = ["kind", "providerKey", "providerExtensionId", "providerExtensionVersion", "submit", "lookup"] as const;
const STEP_KEYS = ["tenantId", "submissionId", "providerKey", "providerExtensionId",
  "providerExtensionVersion", "leaseSeconds", "transportDeadlineMs"] as const;

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function failure(code: FiscalSubmissionWorkerErrorCode, message: string): FiscalSubmissionWorkerStepResult {
  return frozen({ ok: false, error: frozen({ code, message }) });
}

function repositoryFailure(value: unknown, operation: "claim" | "reconciliation"): FiscalSubmissionWorkerStepResult {
  const error = record(value);
  if (error && exact(error, ["code", "message"]) && error.code === "pool_failed") {
    return failure("repository_unavailable", "fiscal submission runtime repository is unavailable");
  }
  return failure("repository_error", `fiscal submission ${operation} failed`);
}

function record(value: unknown): RecordValue | null {
  if (typeof value !== "object" || value === null) return null;
  try {
    if (Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key === "symbol")) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    for (const key of keys) {
      const descriptor = descriptors[String(key)];
      if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined
          || !("value" in descriptor) || descriptor.enumerable !== true) return null;
    }
    return Object.fromEntries(keys.map((key) => [String(key), descriptors[String(key)]!.value]));
  } catch {
    return null;
  }
}

function exact(row: RecordValue, keys: readonly string[]): boolean {
  const actual = Object.keys(row).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function registration(value: unknown): RegisteredAdapter | null {
  const row = record(value);
  if (!row || !exact(row, REGISTRATION_KEYS)
      || row.kind !== "registered_verified_india_irp_1_1_adapter"
      || typeof row.providerKey !== "string" || !PROVIDER_KEY.test(row.providerKey)
      || typeof row.providerExtensionId !== "string" || !UUID.test(row.providerExtensionId)
      || !positiveInteger(row.providerExtensionVersion)
      || typeof row.submit !== "function" || typeof row.lookup !== "function") return null;
  const provider = frozen({
    submit: row.submit as FiscalDocumentProvider["submit"],
    lookup: row.lookup as FiscalDocumentProvider["lookup"],
  });
  return frozen({ providerKey: row.providerKey, providerExtensionId: row.providerExtensionId,
    providerExtensionVersion: row.providerExtensionVersion, provider });
}

function registrationValues(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const length = descriptors.length?.value;
    if (typeof length !== "number" || !Number.isSafeInteger(length)
        || length < 0 || length > MAX_REGISTERED_ADAPTERS) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key === "symbol") || keys.length !== length + 1) return null;
    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined
          || !("value" in descriptor) || descriptor.enumerable !== true) return null;
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function adapterKey(providerKey: string, extensionId: string, version: number): string {
  return `${providerKey}\u0000${extensionId}\u0000${version}`;
}

interface RegisteredAdapterState {
  readonly adapter: RegisteredAdapter;
  busy: boolean;
}

interface ReservedAdapterLane {
  readonly adapter: RegisteredAdapter;
  release(): void;
  releaseWhenSettled(promise: Promise<unknown>): void;
}

type AdapterLaneReservation = Readonly<
  | { readonly ok: false; readonly reason: "adapter_unavailable" | "adapter_busy" }
  | { readonly ok: true; readonly lane: ReservedAdapterLane }
>;

/**
 * Registration means the composition root selected an adapter that authenticates and
 * verifies its own provider protocol. This registry never infers certification from a
 * JSON flag and contains no fallback or fake production adapter.
 */
export class VerifiedIndiaIrpAdapterRegistry {
  readonly #adapters: ReadonlyMap<string, RegisteredAdapterState>;
  readonly #identities: readonly Readonly<FiscalSubmissionAdapterIdentity>[];

  constructor(values: readonly unknown[]) {
    const registrations = registrationValues(values);
    if (!registrations) {
      throw new Error("Verified India IRP adapter registration is invalid");
    }
    const adapters = new Map<string, RegisteredAdapterState>();
    const identities: Readonly<FiscalSubmissionAdapterIdentity>[] = [];
    for (const value of registrations) {
      const adapter = registration(value);
      if (!adapter) throw new Error("Verified India IRP adapter registration is invalid");
      const key = adapterKey(adapter.providerKey, adapter.providerExtensionId, adapter.providerExtensionVersion);
      if (adapters.has(key)) throw new Error("Verified India IRP adapter registration is duplicated");
      adapters.set(key, { adapter, busy: false });
      identities.push(frozen({ providerKey: adapter.providerKey,
        providerExtensionId: adapter.providerExtensionId,
        providerExtensionVersion: adapter.providerExtensionVersion }));
    }
    this.#adapters = adapters;
    this.#identities = frozen(identities);
  }

  get size(): number {
    return this.#adapters.size;
  }

  identities(): readonly Readonly<FiscalSubmissionAdapterIdentity>[] {
    return this.#identities;
  }

  reserve(identity: FiscalSubmissionAdapterIdentity): AdapterLaneReservation {
    const state = this.#adapters.get(adapterKey(
      identity.providerKey,
      identity.providerExtensionId,
      identity.providerExtensionVersion,
    ));
    if (!state) return frozen({ ok: false, reason: "adapter_unavailable" });
    if (state.busy) return frozen({ ok: false, reason: "adapter_busy" });
    state.busy = true;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      state.busy = false;
    };
    return frozen({ ok: true, lane: frozen({
      adapter: state.adapter,
      release,
      releaseWhenSettled(promise: Promise<unknown>) {
        void promise.then(release, release);
      },
    }) });
  }
}

function stepInput(value: unknown): FiscalSubmissionWorkerStepInput | null {
  const row = record(value);
  if (!row || !exact(row, STEP_KEYS) || typeof row.tenantId !== "string" || !UUID.test(row.tenantId)
      || typeof row.submissionId !== "string" || !UUID.test(row.submissionId)
      || typeof row.providerKey !== "string" || !PROVIDER_KEY.test(row.providerKey)
      || typeof row.providerExtensionId !== "string" || !UUID.test(row.providerExtensionId)
      || !positiveInteger(row.providerExtensionVersion)
      || typeof row.leaseSeconds !== "number" || !Number.isSafeInteger(row.leaseSeconds)
      || row.leaseSeconds < 15 || row.leaseSeconds > 300
      || typeof row.transportDeadlineMs !== "number" || !Number.isSafeInteger(row.transportDeadlineMs)
      || row.transportDeadlineMs < 100 || row.transportDeadlineMs + RECONCILIATION_MARGIN_MS >= row.leaseSeconds * 1_000) {
    return null;
  }
  return frozen({ tenantId: row.tenantId, submissionId: row.submissionId,
    providerKey: row.providerKey, providerExtensionId: row.providerExtensionId,
    providerExtensionVersion: row.providerExtensionVersion,
    leaseSeconds: row.leaseSeconds, transportDeadlineMs: row.transportDeadlineMs });
}

function providerResolution(value: unknown): FiscalProviderResolution | null {
  const row = record(value);
  if (!row || row.verified !== true || typeof row.outcome !== "string") return null;
  if (row.outcome === "accepted" || row.outcome === "rejected" || row.outcome === "provider_cancelled") {
    if (typeof row.responseSha256 !== "string" || !SHA256.test(row.responseSha256)) return null;
    const receipt = snapshotFiscalReceiptEvidence(row.receipt, row.responseSha256);
    if (!receipt) return null;
    if (row.outcome === "accepted" && receipt.kind === "accepted_signed_v1"
        && exact(row, ["verified", "outcome", "authorityRef", "responseSha256", "receipt"])
        && row.authorityRef === receipt.irn) {
      return frozen({ verified: true, outcome: "accepted", authorityRef: receipt.irn,
        responseSha256: row.responseSha256, receipt });
    }
    if (!exact(row, ["verified", "outcome", "responseSha256", "receipt"])) return null;
    if (row.outcome === "rejected" && receipt.kind === "rejected") {
      return frozen({ verified: true, outcome: "rejected", responseSha256: row.responseSha256, receipt });
    }
    if (row.outcome === "provider_cancelled" && receipt.kind === "provider_cancelled") {
      return frozen({ verified: true, outcome: "provider_cancelled", responseSha256: row.responseSha256, receipt });
    }
    return null;
  }
  if (row.outcome === "pending" || row.outcome === "timeout" || row.outcome === "duplicate"
      || row.outcome === "known_not_sent") {
    return exact(row, ["verified", "outcome"])
      ? frozen({ verified: true, outcome: row.outcome })
      : null;
  }
  // India IRP is reporting mode. A clearance result cannot establish acceptance here.
  return null;
}

function baseResult(claim: Extract<FiscalSubmissionClaim, { claimed: true }>) {
  return frozen({ tenantId: claim.tenantId, providerKey: claim.providerKey,
    attemptId: claim.attemptId, documentId: claim.documentId, payloadSha256: claim.wireSha256 });
}

function normalizedResult(
  claim: Extract<FiscalSubmissionClaim, { claimed: true }>,
  resolution: FiscalProviderResolution,
): FiscalSubmissionNormalizedResult | null {
  const base = baseResult(claim);
  if ("receipt" in resolution) {
    if (resolution.receipt.documentSha256 !== claim.documentSha256) return null;
    const type = claim.action === "submit" ? "transport_result" : "lookup_result";
    return snapshotFiscalSubmissionNormalizedResult({ ...base, type, outcome: resolution.outcome,
      responseSha256: resolution.responseSha256, receipt: resolution.receipt,
      ...(resolution.outcome === "accepted" ? { authorityRef: resolution.authorityRef } : {}) });
  }
  if (claim.action === "submit") {
    if (resolution.outcome === "cleared") return null;
    if (resolution.outcome === "accepted" || resolution.outcome === "rejected") {
      return frozen({ type: "transport_result", ...base, outcome: resolution.outcome,
        authorityRef: resolution.authorityRef, responseSha256: resolution.responseSha256 });
    }
    return frozen({ type: "transport_result", ...base, outcome: resolution.outcome });
  }
  if (resolution.outcome === "accepted" || resolution.outcome === "rejected") {
    return frozen({ type: "lookup_result", ...base, outcome: resolution.outcome,
      authorityRef: resolution.authorityRef, responseSha256: resolution.responseSha256 });
  }
  if (resolution.outcome === "pending" || resolution.outcome === "known_not_sent") {
    return frozen({ type: "lookup_result", ...base, outcome: resolution.outcome });
  }
  return null;
}

function expectedReceipt(
  receipt: FiscalSubmissionReceipt,
  claim: Extract<FiscalSubmissionClaim, { claimed: true }>,
  result: FiscalSubmissionNormalizedResult,
): boolean {
  if (receipt.submissionId !== claim.submissionId || receipt.tenantId !== claim.tenantId
      || receipt.propertyNode !== claim.propertyNode || receipt.documentId !== claim.documentId
      || receipt.documentSha256 !== claim.documentSha256 || receipt.wireSha256 !== claim.wireSha256
      || receipt.providerKey !== claim.providerKey || receipt.providerExtensionId !== claim.providerExtensionId
      || receipt.providerExtensionVersion !== claim.providerExtensionVersion
      || receipt.attemptId !== claim.attemptId || receipt.attemptNumber !== claim.attemptNumber) return false;
  switch (result.outcome) {
    case "pending":
    case "timeout":
    case "duplicate": return receipt.status === "submitted" && receipt.disposition === "lookup";
    case "known_not_sent": return receipt.status === "error" && receipt.disposition === "retry";
    case "accepted": return receipt.status === "accepted" && receipt.disposition === "none";
    case "rejected": return receipt.status === "rejected" && receipt.disposition === "none";
    case "provider_cancelled": return receipt.status === "error" && receipt.disposition === "none";
    default: return assertNever(result);
  }
}

type ProviderCallOutcome = Readonly<
  | { readonly kind: "settled"; readonly value: unknown }
  | { readonly kind: "rejected" }
  | { readonly kind: "interrupted" }
>;

async function callProvider(
  lane: ReservedAdapterLane,
  claim: Extract<FiscalSubmissionClaim, { claimed: true }>,
  signal: AbortSignal | undefined,
  transportDeadlineMs: number,
): Promise<unknown> {
  if (signal?.aborted) {
    lane.release();
    return claim.action === "submit"
      ? frozen({ verified: true, outcome: "known_not_sent" as const })
      : frozen({ verified: true, outcome: "pending" as const });
  }
  const controller = new AbortController();
  const deadlineUnixMs = Date.now() + transportDeadlineMs;
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, transportDeadlineMs);
  const context: FiscalProviderCallContext = frozen({ signal: controller.signal, deadlineUnixMs });
  const binding = frozen({ tenantId: claim.tenantId, providerKey: claim.providerKey,
    attemptId: claim.attemptId, documentId: claim.documentId, payloadSha256: claim.wireSha256,
    documentSha256: claim.documentSha256, sourceContentJson: claim.sourceContentJson });
  let original: Promise<FiscalProviderResolution>;
  try {
    if (claim.action === "submit") {
      const submission: FiscalProviderSubmission = frozen({
        ...binding,
        payload: new TextEncoder().encode(claim.wireJson),
      });
      original = Promise.resolve(lane.adapter.provider.submit(submission, context));
    } else {
      const lookup: FiscalProviderLookup = frozen({
        ...binding,
        payload: new TextEncoder().encode(claim.wireJson),
      });
      original = Promise.resolve(lane.adapter.provider.lookup(lookup, context));
    }
  } catch (error) {
    // A provider that throws synchronously was invoked, so submit delivery is still
    // uncertain and must follow the same durable lookup path as an async failure.
    original = Promise.reject(error);
  }
  const settled: Promise<ProviderCallOutcome> = original.then(
    (value) => frozen({ kind: "settled", value }),
    () => frozen({ kind: "rejected" }),
  );
  const interrupted = new Promise<ProviderCallOutcome>((resolve) => {
    if (controller.signal.aborted) resolve(frozen({ kind: "interrupted" }));
    else controller.signal.addEventListener("abort", () => resolve(frozen({ kind: "interrupted" })), { once: true });
  });
  const outcome = await Promise.race([settled, interrupted]);
  clearTimeout(timer);
  signal?.removeEventListener("abort", abort);
  if (outcome.kind === "interrupted") {
    // The normalized timeout/pending result owns reconciliation. A late provider
    // result is deliberately ignored, while this exact lane remains quarantined.
    lane.releaseWhenSettled(original);
    return claim.action === "submit"
      ? frozen({ verified: true, outcome: "timeout" as const })
      : frozen({ verified: true, outcome: "pending" as const });
  }
  lane.release();
  if (outcome.kind === "rejected") {
    return claim.action === "submit"
      ? frozen({ verified: true, outcome: "timeout" as const })
      : frozen({ verified: true, outcome: "pending" as const });
  }
  return outcome.value;
}

export class FiscalSubmissionWorker {
  readonly #repository: FiscalSubmissionWorkerRepository;
  readonly #registry: VerifiedIndiaIrpAdapterRegistry;

  constructor(repository: FiscalSubmissionWorkerRepository, registry: VerifiedIndiaIrpAdapterRegistry) {
    this.#repository = repository;
    this.#registry = registry;
  }

  async runOnce(inputValue: unknown, signal?: AbortSignal): Promise<FiscalSubmissionWorkerStepResult> {
    const input = stepInput(inputValue);
    if (!input) return failure("invalid_input", "fiscal submission worker input is invalid");
    if (signal?.aborted) return frozen({ ok: true, kind: "idle", reason: "cancelled" });

    const reservation = this.#registry.reserve(input);
    if (!reservation.ok) return frozen({ ok: true, kind: "idle", reason: reservation.reason });
    const { lane } = reservation;

    let claimedResult: FiscalSubmissionRepositoryResult<FiscalSubmissionClaim>;
    try {
      claimedResult = await this.#repository.claim({ tenantId: input.tenantId,
        submissionId: input.submissionId, leaseSeconds: input.leaseSeconds });
    } catch {
      lane.release();
      return failure("repository_error", "fiscal submission claim failed");
    }
    const claimedEnvelope = record(claimedResult);
    if (!claimedEnvelope || (claimedEnvelope.ok !== true && claimedEnvelope.ok !== false)
        || !exact(claimedEnvelope, claimedEnvelope.ok === true ? ["ok", "value"] : ["ok", "error"])) {
      lane.release();
      return failure("repository_error", "fiscal submission claim failed");
    }
    if (claimedEnvelope.ok === false) {
      lane.release();
      return repositoryFailure(claimedEnvelope.error, "claim");
    }
    const claim = snapshotFiscalSubmissionClaim(claimedEnvelope.value);
    if (!claim || (claim.claimed && (claim.tenantId !== input.tenantId
        || claim.submissionId !== input.submissionId
        || claim.providerKey !== input.providerKey
        || claim.providerExtensionId !== input.providerExtensionId
        || claim.providerExtensionVersion !== input.providerExtensionVersion))) {
      lane.release();
      return failure("invalid_claim", "fiscal submission claim was invalid");
    }
    if (!claim.claimed) {
      lane.release();
      return frozen({ ok: true, kind: "idle", reason: claim.reason });
    }

    const actualWireHash = new Bun.CryptoHasher("sha256").update(claim.wireJson).digest("hex");
    if (actualWireHash !== claim.wireSha256) {
      lane.release();
      return failure("invalid_claim", "fiscal submission claim was invalid");
    }
    const rawResolution = await callProvider(lane, claim, signal, input.transportDeadlineMs);

    const resolution = providerResolution(rawResolution);
    if (!resolution) return failure("provider_result_invalid", "verified fiscal provider result is invalid");
    const event = normalizedResult(claim, resolution);
    const checkedEvent = snapshotFiscalSubmissionNormalizedResult(event);
    if (!event || !checkedEvent) {
      return failure("provider_result_invalid", "verified fiscal provider result is invalid");
    }

    let reconciledResult: FiscalSubmissionRepositoryResult<FiscalSubmissionReceipt>;
    try {
      reconciledResult = await this.#repository.reconcile({
        tenantId: claim.tenantId,
        submissionId: claim.submissionId,
        attemptId: claim.attemptId,
        claimToken: claim.claimToken,
        result: checkedEvent,
      });
    } catch {
      return failure("repository_error", "fiscal submission reconciliation failed");
    }
    const reconciledEnvelope = record(reconciledResult);
    if (!reconciledEnvelope || (reconciledEnvelope.ok !== true && reconciledEnvelope.ok !== false)
        || !exact(reconciledEnvelope, reconciledEnvelope.ok === true ? ["ok", "value"] : ["ok", "error"])) {
      return failure("repository_error", "fiscal submission reconciliation failed");
    }
    if (reconciledEnvelope.ok === false) {
      return repositoryFailure(reconciledEnvelope.error, "reconciliation");
    }
    const receipt = snapshotFiscalSubmissionReceipt(reconciledEnvelope.value);
    if (!receipt || !expectedReceipt(receipt, claim, checkedEvent)) {
      return failure("reconciliation_conflict", "fiscal submission reconciliation receipt conflicts with the claim");
    }
    return frozen({ ok: true, kind: "reconciled", action: claim.action,
      submissionId: receipt.submissionId, attemptId: receipt.attemptId,
      status: receipt.status, disposition: receipt.disposition, replayed: receipt.replayed });
  }
}

function assertNever(value: never): never {
  throw new Error(`unreachable fiscal submission result: ${String(value)}`);
}
