import type {
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const PROVIDER_KEY = /^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$/;
const REFERENCE_CONTROL = /[\u0000-\u001f\u007f]/u;

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

interface RegisteredAdapter {
  readonly providerKey: string;
  readonly providerExtensionId: string;
  readonly providerExtensionVersion: number;
  readonly provider: FiscalDocumentProvider;
}

export interface FiscalSubmissionWorkerStepInput {
  readonly tenantId: string;
  readonly submissionId: string;
  readonly leaseSeconds: number;
}

export type FiscalSubmissionWorkerErrorCode =
  | "invalid_input"
  | "repository_error"
  | "invalid_claim"
  | "adapter_unavailable"
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
      readonly reason: "busy" | "terminal" | "retry_required";
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
const STEP_KEYS = ["tenantId", "submissionId", "leaseSeconds"] as const;

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function failure(code: FiscalSubmissionWorkerErrorCode, message: string): FiscalSubmissionWorkerStepResult {
  return frozen({ ok: false, error: frozen({ code, message }) });
}

function record(value: unknown): RecordValue | null {
  if (typeof value !== "object" || value === null) return null;
  try {
    if (Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key === "symbol")) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
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

function adapterKey(providerKey: string, extensionId: string, version: number): string {
  return `${providerKey}\u0000${extensionId}\u0000${version}`;
}

/**
 * Registration means the composition root selected an adapter that authenticates and
 * verifies its own provider protocol. This registry never infers certification from a
 * JSON flag and contains no fallback or fake production adapter.
 */
export class VerifiedIndiaIrpAdapterRegistry {
  readonly #adapters: ReadonlyMap<string, RegisteredAdapter>;

  constructor(values: readonly unknown[]) {
    if (!Array.isArray(values)) throw new Error("Verified India IRP adapter registration is invalid");
    const adapters = new Map<string, RegisteredAdapter>();
    for (const value of values) {
      const adapter = registration(value);
      if (!adapter) throw new Error("Verified India IRP adapter registration is invalid");
      const key = adapterKey(adapter.providerKey, adapter.providerExtensionId, adapter.providerExtensionVersion);
      if (adapters.has(key)) throw new Error("Verified India IRP adapter registration is duplicated");
      adapters.set(key, adapter);
    }
    this.#adapters = adapters;
  }

  find(claim: Extract<FiscalSubmissionClaim, { claimed: true }>): RegisteredAdapter | undefined {
    return this.#adapters.get(adapterKey(
      claim.providerKey,
      claim.providerExtensionId,
      claim.providerExtensionVersion,
    ));
  }
}

function stepInput(value: unknown): FiscalSubmissionWorkerStepInput | null {
  const row = record(value);
  if (!row || !exact(row, STEP_KEYS) || typeof row.tenantId !== "string" || !UUID.test(row.tenantId)
      || typeof row.submissionId !== "string" || !UUID.test(row.submissionId)
      || typeof row.leaseSeconds !== "number" || !Number.isSafeInteger(row.leaseSeconds)
      || row.leaseSeconds < 15 || row.leaseSeconds > 300) return null;
  return frozen({ tenantId: row.tenantId, submissionId: row.submissionId, leaseSeconds: row.leaseSeconds });
}

function providerResolution(value: unknown): FiscalProviderResolution | null {
  const row = record(value);
  if (!row || row.verified !== true || typeof row.outcome !== "string") return null;
  if (row.outcome === "accepted" || row.outcome === "rejected") {
    if (!exact(row, ["verified", "outcome", "authorityRef", "responseSha256"])
        || typeof row.authorityRef !== "string" || row.authorityRef.length < 1
        || row.authorityRef.length > 256 || REFERENCE_CONTROL.test(row.authorityRef)
        || typeof row.responseSha256 !== "string" || !SHA256.test(row.responseSha256)) return null;
    return frozen({ verified: true, outcome: row.outcome,
      authorityRef: row.authorityRef, responseSha256: row.responseSha256 });
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
    default: return assertNever(result);
  }
}

export class FiscalSubmissionWorker {
  readonly #repository: FiscalSubmissionWorkerRepository;
  readonly #registry: VerifiedIndiaIrpAdapterRegistry;

  constructor(repository: FiscalSubmissionWorkerRepository, registry: VerifiedIndiaIrpAdapterRegistry) {
    this.#repository = repository;
    this.#registry = registry;
  }

  async runOnce(inputValue: unknown): Promise<FiscalSubmissionWorkerStepResult> {
    const input = stepInput(inputValue);
    if (!input) return failure("invalid_input", "fiscal submission worker input is invalid");

    let claimedResult: FiscalSubmissionRepositoryResult<FiscalSubmissionClaim>;
    try {
      claimedResult = await this.#repository.claim(input);
    } catch {
      return failure("repository_error", "fiscal submission claim failed");
    }
    const claimedEnvelope = record(claimedResult);
    if (!claimedEnvelope || (claimedEnvelope.ok !== true && claimedEnvelope.ok !== false)
        || !exact(claimedEnvelope, claimedEnvelope.ok === true ? ["ok", "value"] : ["ok", "error"])) {
      return failure("repository_error", "fiscal submission claim failed");
    }
    if (claimedEnvelope.ok === false) return failure("repository_error", "fiscal submission claim failed");
    const claim = snapshotFiscalSubmissionClaim(claimedEnvelope.value);
    if (!claim || (claim.claimed && (claim.tenantId !== input.tenantId
        || claim.submissionId !== input.submissionId))) {
      return failure("invalid_claim", "fiscal submission claim was invalid");
    }
    if (!claim.claimed) return frozen({ ok: true, kind: "idle", reason: claim.reason });

    const actualWireHash = new Bun.CryptoHasher("sha256").update(claim.wireJson).digest("hex");
    if (actualWireHash !== claim.wireSha256) {
      return failure("invalid_claim", "fiscal submission claim was invalid");
    }
    const adapter = this.#registry.find(claim);
    if (!adapter) return failure("adapter_unavailable", "verified fiscal provider adapter is unavailable");

    const binding = frozen({ tenantId: claim.tenantId, providerKey: claim.providerKey,
      attemptId: claim.attemptId, documentId: claim.documentId, payloadSha256: claim.wireSha256 });
    let rawResolution: unknown;
    try {
      if (claim.action === "submit") {
        const submission: FiscalProviderSubmission = frozen({
          ...binding,
          payload: new TextEncoder().encode(claim.wireJson),
        });
        rawResolution = await adapter.provider.submit(submission);
      } else {
        const lookup: FiscalProviderLookup = binding;
        rawResolution = await adapter.provider.lookup(lookup);
      }
    } catch {
      // Once submit begins, an exception is an unknown send outcome. It is never
      // evidence of known-not-sent. Lookup failures likewise preserve lookup-only.
      rawResolution = claim.action === "submit"
        ? frozen({ verified: true, outcome: "timeout" as const })
        : frozen({ verified: true, outcome: "pending" as const });
    }

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
      return failure("repository_error", "fiscal submission reconciliation failed");
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
