import { constants as fsConstants } from "node:fs";
import { lstat, open, type FileHandle } from "node:fs/promises";
import { isAbsolute } from "node:path";

import type { FiscalProviderResolution } from
  "../src/contexts/tax-fiscal/fiscal-provider";
import type { FiscalAcceptedReceiptEvidence } from
  "../src/contexts/tax-fiscal/fiscal-submission-receipt";
import {
  decodeFiscalExactJson,
  type FiscalExactJsonValue,
} from "../src/contexts/tax-fiscal/fiscal-exact-json";
import { projectIssuedIndiaIrpWireCandidate } from
  "../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";
import { loadIndiaIrpAdapterRegistrationsFromEnvironment } from
  "../src/contexts/tax-fiscal/india-irp-provider-configuration";

export const IRP_SANDBOX_AUTHORIZATION_ACKNOWLEDGEMENT =
  "I confirm this is an authorized synthetic invoice for the configured sandbox taxpayer" as const;

export const IRP_SANDBOX_ACCEPTANCE_LIMITS = Object.freeze({
  maxInputBytes: 2 * 1024 * 1024,
  maxPathCharacters: 4096,
  deadlineMs: 60_000,
} as const);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const PROVIDER_KEY = /^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$/u;

type ExactObject = Extract<FiscalExactJsonValue, { readonly kind: "object" }>;

export type IrpSandboxAcceptanceErrorCode =
  | "authorization_required"
  | "invalid_input_path"
  | "input_unavailable"
  | "input_insecure"
  | "input_invalid"
  | "resource_exhausted"
  | "provider_configuration_invalid"
  | "provider_selection_invalid"
  | "provider_not_sandbox"
  | "deadline_exceeded"
  | "submit_not_accepted"
  | "lookup_not_accepted"
  | "receipt_mismatch";

export interface IrpSandboxAcceptanceError {
  readonly code: IrpSandboxAcceptanceErrorCode;
  readonly message: string;
}

export interface IrpSandboxAcceptanceSummary {
  readonly version: 1;
  readonly kind: "bounded_irp_sandbox_acceptance_v1";
  readonly transportEvidence: "external_provider_transport" | "synthetic_injected_transport";
  readonly externalProviderRoundTripEstablished: boolean;
  readonly providerCertificationClaimed: false;
  readonly databasePersistenceClaimed: false;
  readonly operatorJourneyClaimed: false;
  readonly result: "accepted_matching_submit_and_lookup";
  readonly environment: "sandbox";
  readonly provider: Readonly<{
    providerKey: string;
    providerExtensionId: string;
    providerExtensionVersion: number;
  }>;
  readonly source: Readonly<{
    documentId: string;
    documentSha256: string;
    wireSha256: string;
  }>;
  readonly receipt: Readonly<{
    irn: string;
    ackNo: string;
    ackDt: string;
    signedInvoiceSha256: string;
    signedQrSha256: string;
    submitResponseSha256: string;
    lookupResponseSha256: string;
    verification: Readonly<{
      profileVersion: string;
      issuer: string;
      invoiceKeyId: string;
      invoiceKeySpkiSha256: string;
      invoiceBundleVersion: string;
      qrKeyId: string;
      qrKeySpkiSha256: string;
      qrBundleVersion: string;
    }>;
  }>;
}

export type IrpSandboxAcceptanceResult = Readonly<
  | { readonly ok: true; readonly value: Readonly<IrpSandboxAcceptanceSummary> }
  | { readonly ok: false; readonly error: Readonly<IrpSandboxAcceptanceError> }
>;

/** Explicitly test-only. The CLI never reads a mock flag or supplies this seam. */
export interface IrpSandboxAcceptanceTestSeam {
  readonly fetch: typeof fetch;
  readonly clock?: () => number;
  readonly deadlineMs?: number;
}

export interface RunIrpSandboxAcceptanceOptions {
  readonly authorizationAcknowledged: boolean;
  readonly inputFile: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly testSeam?: Readonly<IrpSandboxAcceptanceTestSeam>;
}

interface AcceptanceInput {
  readonly tenantId: string;
  readonly attemptId: string;
  readonly documentId: string;
  readonly documentSha256: string;
  readonly providerKey: string;
  readonly sourceContentJson: string;
}

class InputFailure extends Error {
  constructor(readonly code: IrpSandboxAcceptanceErrorCode) {
    super(code);
  }
}

const ERROR_MESSAGES: Readonly<Record<IrpSandboxAcceptanceErrorCode, string>> = Object.freeze({
  authorization_required: "explicit authorization for the configured sandbox taxpayer is required",
  invalid_input_path: "sandbox acceptance input path is invalid",
  input_unavailable: "sandbox acceptance input is unavailable",
  input_insecure: "sandbox acceptance input file protection is invalid",
  input_invalid: "sandbox acceptance input is invalid",
  resource_exhausted: "sandbox acceptance resource limit exceeded",
  provider_configuration_invalid: "IRP provider configuration is invalid or unavailable",
  provider_selection_invalid: "exactly one matching IRP provider registration is required",
  provider_not_sandbox: "the selected IRP provider is not configured for sandbox",
  deadline_exceeded: "sandbox acceptance deadline was exceeded",
  submit_not_accepted: "IRP sandbox submit did not return a verified signed acceptance",
  lookup_not_accepted: "IRP sandbox lookup did not return a verified signed acceptance",
  receipt_mismatch: "IRP sandbox submit and lookup receipts do not match",
});

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function failure(code: IrpSandboxAcceptanceErrorCode): IrpSandboxAcceptanceResult {
  return frozen({ ok: false as const, error: frozen({ code, message: ERROR_MESSAGES[code] }) });
}

function failInput(code: IrpSandboxAcceptanceErrorCode): never {
  throw new InputFailure(code);
}

function validLocalAbsolutePath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
    && value.length <= IRP_SANDBOX_ACCEPTANCE_LIMITS.maxPathCharacters
    && !value.includes("\0") && isAbsolute(value)
    && !/^[a-z][a-z0-9+.-]*:\/\//iu.test(value)
    && !/^[\\/]{2}/u.test(value)
    && (process.platform !== "win32" || /^[A-Za-z]:[\\/]/u.test(value));
}

async function safeClose(handle: FileHandle): Promise<void> {
  try {
    await handle.close();
  } catch {
    failInput("input_unavailable");
  }
}

async function readProtectedInput(path: string): Promise<string> {
  let handle: FileHandle;
  try {
    const flags = process.platform === "win32" ? 0 : fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK;
    handle = await open(path, fsConstants.O_RDONLY | flags);
  } catch {
    return failInput("input_unavailable");
  }
  try {
    const opened = await handle.stat();
    const linked = await lstat(path).catch(() => failInput("input_unavailable"));
    if (!opened.isFile() || linked.isSymbolicLink() || !linked.isFile()
        || opened.dev !== linked.dev || opened.ino !== linked.ino) failInput("input_invalid");
    if (opened.size < 1) failInput("input_invalid");
    if (opened.size > IRP_SANDBOX_ACCEPTANCE_LIMITS.maxInputBytes) failInput("resource_exhausted");
    if (process.platform !== "win32") {
      const effectiveUid = typeof process.geteuid === "function" ? process.geteuid() : process.getuid?.();
      if (effectiveUid === undefined || opened.uid !== effectiveUid || (opened.mode & 0o077) !== 0) {
        failInput("input_insecure");
      }
    }

    const bytes = new Uint8Array(IRP_SANDBOX_ACCEPTANCE_LIMITS.maxInputBytes + 1);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const chunk = await handle.read(bytes, offset, bytes.byteLength - offset, offset);
      if (chunk.bytesRead === 0) break;
      offset += chunk.bytesRead;
    }
    if (offset > IRP_SANDBOX_ACCEPTANCE_LIMITS.maxInputBytes) failInput("resource_exhausted");
    const after = await handle.stat();
    const finalLink = await lstat(path).catch(() => failInput("input_unavailable"));
    if (!after.isFile() || after.dev !== opened.dev || after.ino !== opened.ino
        || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs
        || finalLink.isSymbolicLink() || !finalLink.isFile()
        || finalLink.dev !== opened.dev || finalLink.ino !== opened.ino || offset !== opened.size) {
      failInput("input_unavailable");
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, offset));
    } catch {
      return failInput("input_invalid");
    }
    if (text.charCodeAt(0) === 0xfeff) failInput("input_invalid");
    return text;
  } catch (error) {
    if (error instanceof InputFailure) throw error;
    return failInput("input_unavailable");
  } finally {
    await safeClose(handle);
  }
}

function exactKeys(value: ExactObject, expected: readonly string[]): boolean {
  const actual = Object.keys(value.members).sort();
  const sorted = [...expected].sort();
  return actual.length === sorted.length && actual.every((key, index) => key === sorted[index]);
}

function exactString(value: FiscalExactJsonValue | undefined): string {
  if (value?.kind !== "string") failInput("input_invalid");
  return value.value;
}

function parseInput(text: string): AcceptanceInput {
  const decoded = decodeFiscalExactJson(text, { maxUtf8Bytes: IRP_SANDBOX_ACCEPTANCE_LIMITS.maxInputBytes });
  if (!decoded.ok) failInput(decoded.error.code === "resource_exhausted" ? "resource_exhausted" : "input_invalid");
  if (decoded.value.kind !== "object") failInput("input_invalid");
  const root = decoded.value;
  const fields = ["version", "authorizationAcknowledgement", "tenantId", "attemptId", "documentId",
    "documentSha256", "providerKey", "sourceContentJson"] as const;
  if (!exactKeys(root, fields) || root.members.version?.kind !== "number"
      || root.members.version.lexeme !== "1") failInput("input_invalid");
  if (exactString(root.members.authorizationAcknowledgement) !== IRP_SANDBOX_AUTHORIZATION_ACKNOWLEDGEMENT) {
    failInput("authorization_required");
  }
  const tenantId = exactString(root.members.tenantId);
  const attemptId = exactString(root.members.attemptId);
  const documentId = exactString(root.members.documentId);
  const documentSha256 = exactString(root.members.documentSha256);
  const providerKey = exactString(root.members.providerKey);
  const sourceContentJson = exactString(root.members.sourceContentJson);
  if (!UUID.test(tenantId) || !UUID.test(attemptId) || !UUID.test(documentId)
      || !SHA256.test(documentSha256) || !PROVIDER_KEY.test(providerKey)
      || sourceContentJson.length < 1) failInput("input_invalid");
  return frozen({ tenantId, attemptId, documentId, documentSha256, providerKey, sourceContentJson });
}

type AcceptedResolution = Extract<FiscalProviderResolution, { readonly outcome: "accepted"; readonly receipt: unknown }>;

function acceptedResult(result: FiscalProviderResolution): AcceptedResolution | null {
  return result.outcome === "accepted" && "receipt" in result
    && result.receipt.kind === "accepted_signed_v1" && result.authorityRef === result.receipt.irn
    ? result : null;
}

function sameVerifiedReceipt(
  submit: FiscalAcceptedReceiptEvidence,
  lookup: FiscalAcceptedReceiptEvidence,
): boolean {
  const fields = ["environment", "providerKey", "documentId", "documentSha256", "wireSha256", "irn", "ackNo",
    "ackDt", "signedInvoice", "signedInvoiceSha256", "signedQRCode", "signedQrSha256"] as const;
  if (fields.some((field) => submit[field] !== lookup[field])) return false;
  const verificationFields = ["profileVersion", "issuer", "invoiceKeyId", "invoiceKeySpkiSha256",
    "invoiceBundleVersion", "qrKeyId", "qrKeySpkiSha256", "qrBundleVersion"] as const;
  return verificationFields.every((field) => submit.verification[field] === lookup.verification[field]);
}

function identityMatches(
  registration: Readonly<{ providerKey: string; providerExtensionId: string; providerExtensionVersion: number }>,
  presentation: Readonly<{ providerKey: string; providerExtensionId: string; providerExtensionVersion: number;
    environment: "sandbox" | "production" }>,
): boolean {
  return registration.providerKey === presentation.providerKey
    && registration.providerExtensionId === presentation.providerExtensionId
    && registration.providerExtensionVersion === presentation.providerExtensionVersion;
}

export async function runIrpSandboxAcceptance(
  options: Readonly<RunIrpSandboxAcceptanceOptions>,
): Promise<IrpSandboxAcceptanceResult> {
  if (options.authorizationAcknowledged !== true) return failure("authorization_required");
  if (!validLocalAbsolutePath(options.inputFile)) return failure("invalid_input_path");

  let input: AcceptanceInput;
  try {
    input = parseInput(await readProtectedInput(options.inputFile));
  } catch (error) {
    return failure(error instanceof InputFailure ? error.code : "input_unavailable");
  }

  const seam = options.testSeam;
  const clock = seam?.clock ?? Date.now;
  const deadlineMs = seam?.deadlineMs ?? IRP_SANDBOX_ACCEPTANCE_LIMITS.deadlineMs;
  if (typeof clock !== "function" || !Number.isSafeInteger(deadlineMs) || deadlineMs < 1
      || deadlineMs > IRP_SANDBOX_ACCEPTANCE_LIMITS.deadlineMs) return failure("provider_configuration_invalid");
  let startedAt: number;
  try {
    startedAt = clock();
  } catch {
    return failure("provider_configuration_invalid");
  }
  if (!Number.isSafeInteger(startedAt) || startedAt < 0 || startedAt > Number.MAX_SAFE_INTEGER - deadlineMs) {
    return failure("provider_configuration_invalid");
  }
  const deadlineUnixMs = startedAt + deadlineMs;
  const adapterOptions = seam === undefined ? undefined : { fetch: seam.fetch, clock };
  const loaded = await loadIndiaIrpAdapterRegistrationsFromEnvironment(options.environment, adapterOptions);
  if (!loaded.ok) return failure("provider_configuration_invalid");
  if (loaded.value.length !== 1 || loaded.presentations.length !== 1) {
    return failure("provider_selection_invalid");
  }
  const registration = loaded.value[0]!;
  const presentation = loaded.presentations[0]!;
  if (!identityMatches(registration, presentation) || registration.providerKey !== input.providerKey) {
    return failure("provider_selection_invalid");
  }
  if (presentation.environment !== "sandbox") return failure("provider_not_sandbox");

  const projected = projectIssuedIndiaIrpWireCandidate({ documentId: input.documentId,
    documentSha256: input.documentSha256, contentJson: input.sourceContentJson });
  if (!projected.ok) return failure("input_invalid");

  const callInput = frozen({
    tenantId: input.tenantId,
    providerKey: input.providerKey,
    attemptId: input.attemptId,
    documentId: input.documentId,
    payloadSha256: projected.value.wireSha256,
    payload: new TextEncoder().encode(projected.value.wireJson),
    documentSha256: input.documentSha256,
    sourceContentJson: input.sourceContentJson,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const context = frozen({ signal: controller.signal, deadlineUnixMs });
  try {
    let submitResolution: FiscalProviderResolution;
    try {
      submitResolution = await registration.submit(callInput, context);
    } catch {
      return failure(controller.signal.aborted ? "deadline_exceeded" : "submit_not_accepted");
    }
    if (controller.signal.aborted) return failure("deadline_exceeded");
    const submitResult = acceptedResult(submitResolution);
    if (!submitResult) return failure("submit_not_accepted");
    const submitReceipt = submitResult.receipt;
    if (submitReceipt.environment !== "sandbox" || submitReceipt.providerKey !== input.providerKey
        || submitReceipt.documentId !== input.documentId || submitReceipt.documentSha256 !== input.documentSha256
        || submitReceipt.wireSha256 !== projected.value.wireSha256) return failure("receipt_mismatch");

    let now: number;
    try {
      now = clock();
    } catch {
      return failure("deadline_exceeded");
    }
    if (!Number.isSafeInteger(now) || now < 0 || now >= deadlineUnixMs || controller.signal.aborted) {
      return failure("deadline_exceeded");
    }
    let lookupResolution: FiscalProviderResolution;
    try {
      // The immutable registration pins endpoint, trust and credentials while the
      // adapter performs a new authenticated protocol exchange for this lookup.
      lookupResolution = await registration.lookup(callInput, context);
    } catch {
      return failure(controller.signal.aborted ? "deadline_exceeded" : "lookup_not_accepted");
    }
    if (controller.signal.aborted) return failure("deadline_exceeded");
    const lookupResult = acceptedResult(lookupResolution);
    if (!lookupResult) return failure("lookup_not_accepted");
    const lookupReceipt = lookupResult.receipt;
    if (!sameVerifiedReceipt(submitReceipt, lookupReceipt)) return failure("receipt_mismatch");

    const synthetic = seam !== undefined;
    return frozen({ ok: true as const, value: frozen({
      version: 1 as const,
      kind: "bounded_irp_sandbox_acceptance_v1" as const,
      transportEvidence: synthetic ? "synthetic_injected_transport" as const : "external_provider_transport" as const,
      externalProviderRoundTripEstablished: !synthetic,
      providerCertificationClaimed: false as const,
      databasePersistenceClaimed: false as const,
      operatorJourneyClaimed: false as const,
      result: "accepted_matching_submit_and_lookup" as const,
      environment: "sandbox" as const,
      provider: frozen({ providerKey: registration.providerKey,
        providerExtensionId: registration.providerExtensionId,
        providerExtensionVersion: registration.providerExtensionVersion }),
      source: frozen({ documentId: input.documentId, documentSha256: input.documentSha256,
        wireSha256: projected.value.wireSha256 }),
      receipt: frozen({ irn: submitReceipt.irn, ackNo: submitReceipt.ackNo, ackDt: submitReceipt.ackDt,
        signedInvoiceSha256: submitReceipt.signedInvoiceSha256, signedQrSha256: submitReceipt.signedQrSha256,
        submitResponseSha256: submitResult.responseSha256, lookupResponseSha256: lookupResult.responseSha256,
        verification: frozen({ profileVersion: submitReceipt.verification.profileVersion,
          issuer: submitReceipt.verification.issuer, invoiceKeyId: submitReceipt.verification.invoiceKeyId,
          invoiceKeySpkiSha256: submitReceipt.verification.invoiceKeySpkiSha256,
          invoiceBundleVersion: submitReceipt.verification.invoiceBundleVersion,
          qrKeyId: submitReceipt.verification.qrKeyId,
          qrKeySpkiSha256: submitReceipt.verification.qrKeySpkiSha256,
          qrBundleVersion: submitReceipt.verification.qrBundleVersion }),
      }),
    }) });
  } finally {
    clearTimeout(timer);
  }
}

export function serializeIrpSandboxAcceptance(value: IrpSandboxAcceptanceResult): string {
  return JSON.stringify(value);
}

export async function runIrpSandboxAcceptanceCli(
  argv: readonly string[],
  environment: NodeJS.ProcessEnv,
): Promise<number> {
  const authorized = argv.length === 1 && argv[0] === "--acknowledge-authorized-sandbox-taxpayer";
  const inputFile = environment.YELLOW_IRP_SANDBOX_INPUT_FILE;
  const result = await runIrpSandboxAcceptance({ authorizationAcknowledged: authorized,
    inputFile: typeof inputFile === "string" ? inputFile : "", environment });
  const line = `${serializeIrpSandboxAcceptance(result)}\n`;
  if (result.ok) process.stdout.write(line);
  else process.stderr.write(line);
  return result.ok ? 0 : 1;
}

if (import.meta.main) {
  process.exitCode = await runIrpSandboxAcceptanceCli(process.argv.slice(2), process.env);
}
