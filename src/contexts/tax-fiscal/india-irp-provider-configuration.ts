import { constants as fsConstants } from "node:fs";
import { lstat, open, type FileHandle } from "node:fs/promises";
import { isAbsolute } from "node:path";

import {
  createClearIrpDirectAdapter,
  type ClearIrpDirectAdapterOptions,
} from "./clearirp-direct-adapter";
import {
  decodeFiscalExactJson,
  type FiscalExactJsonValue,
} from "./fiscal-exact-json";
import type { VerifiedIndiaIrpAdapterRegistration } from "./fiscal-submission-worker";

export const INDIA_IRP_PROVIDER_DEPLOYMENT_LIMITS = Object.freeze({
  maxManifestBytes: 4 * 1024 * 1024,
  maxCredentialsBytes: 16 * 1024,
  maxPathCharacters: 4096,
  maxProviders: 16,
} as const);

export type IndiaIrpAdapterRegistrationLoadErrorCode =
  | "invalid_input"
  | "invalid_manifest"
  | "invalid_credentials"
  | "resource_exhausted"
  | "filesystem_unavailable"
  | "insecure_credentials";

export interface IndiaIrpAdapterRegistrationLoadError {
  readonly code: IndiaIrpAdapterRegistrationLoadErrorCode;
  readonly message: string;
}

export type IndiaIrpAdapterRegistrationLoadResult = Readonly<
  | { readonly ok: true; readonly value: readonly Readonly<VerifiedIndiaIrpAdapterRegistration>[] }
  | { readonly ok: false; readonly error: Readonly<IndiaIrpAdapterRegistrationLoadError> }
>;

type ExactObject = Extract<FiscalExactJsonValue, { readonly kind: "object" }>;
type ExactArray = Extract<FiscalExactJsonValue, { readonly kind: "array" }>;

class ConfigurationLoadFailure extends Error {
  constructor(readonly code: IndiaIrpAdapterRegistrationLoadErrorCode) {
    super(code);
  }
}

interface FileSnapshot {
  readonly text: string;
  readonly device: number;
  readonly inode: number;
}

function fail(code: IndiaIrpAdapterRegistrationLoadErrorCode): never {
  throw new ConfigurationLoadFailure(code);
}

function failure(code: IndiaIrpAdapterRegistrationLoadErrorCode): IndiaIrpAdapterRegistrationLoadResult {
  const messages: Record<IndiaIrpAdapterRegistrationLoadErrorCode, string> = {
    invalid_input: "India IRP provider deployment input is invalid",
    invalid_manifest: "India IRP provider deployment manifest is invalid",
    invalid_credentials: "India IRP provider credentials are invalid",
    resource_exhausted: "India IRP provider deployment resource limit exceeded",
    filesystem_unavailable: "India IRP provider deployment files are unavailable",
    insecure_credentials: "India IRP provider credential file protection is invalid",
  };
  return Object.freeze({ ok: false, error: Object.freeze({ code, message: messages[code] }) });
}

function validLocalAbsolutePath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
    && value.length <= INDIA_IRP_PROVIDER_DEPLOYMENT_LIMITS.maxPathCharacters
    && !value.includes("\0") && isAbsolute(value)
    && !/^[a-z][a-z0-9+.-]*:\/\//iu.test(value)
    && !/^[\\/]{2}/u.test(value)
    && (process.platform !== "win32" || /^[A-Za-z]:[\\/]/u.test(value));
}

async function close(handle: FileHandle): Promise<void> {
  try {
    await handle.close();
  } catch {
    fail("filesystem_unavailable");
  }
}

async function readSnapshot(
  path: string,
  maximumBytes: number,
  kind: "manifest" | "credentials",
): Promise<FileSnapshot> {
  let handle: FileHandle;
  try {
    // O_NONBLOCK closes the lstat/open FIFO race: a path replaced with a pipe
    // cannot wait indefinitely for a writer before the opened-handle type check.
    const platformFlags = process.platform === "win32"
      ? 0
      : fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK;
    handle = await open(path, fsConstants.O_RDONLY | platformFlags);
  } catch {
    return fail("filesystem_unavailable");
  }
  try {
    const opened = await handle.stat();
    let linked;
    try {
      linked = await lstat(path);
    } catch {
      return fail("filesystem_unavailable");
    }
    if (!opened.isFile() || linked.isSymbolicLink() || !linked.isFile()
        || linked.dev !== opened.dev || linked.ino !== opened.ino) {
      return fail(kind === "manifest" ? "invalid_manifest" : "invalid_credentials");
    }
    if (opened.size < 1) return fail(kind === "manifest" ? "invalid_manifest" : "invalid_credentials");
    if (opened.size > maximumBytes) return fail("resource_exhausted");
    if (kind === "credentials" && process.platform !== "win32") {
      const effectiveUid = typeof process.geteuid === "function" ? process.geteuid() : process.getuid?.();
      if (effectiveUid === undefined || opened.uid !== effectiveUid || (opened.mode & 0o077) !== 0) {
        return fail("insecure_credentials");
      }
    }

    const bytes = new Uint8Array(maximumBytes + 1);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const chunk = await handle.read(bytes, offset, bytes.byteLength - offset, offset);
      if (chunk.bytesRead === 0) break;
      offset += chunk.bytesRead;
    }
    if (offset > maximumBytes) return fail("resource_exhausted");
    const after = await handle.stat();
    let finalLink;
    try {
      finalLink = await lstat(path);
    } catch {
      return fail("filesystem_unavailable");
    }
    if (!after.isFile() || after.dev !== opened.dev || after.ino !== opened.ino
        || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs
        || finalLink.isSymbolicLink() || !finalLink.isFile()
        || finalLink.dev !== opened.dev || finalLink.ino !== opened.ino || offset !== opened.size) {
      return fail("filesystem_unavailable");
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, offset));
    } catch {
      return fail(kind === "manifest" ? "invalid_manifest" : "invalid_credentials");
    }
    if (text.charCodeAt(0) === 0xfeff) {
      return fail(kind === "manifest" ? "invalid_manifest" : "invalid_credentials");
    }
    return Object.freeze({ text, device: opened.dev, inode: opened.ino });
  } catch (error) {
    if (error instanceof ConfigurationLoadFailure) throw error;
    return fail("filesystem_unavailable");
  } finally {
    await close(handle);
  }
}

function exactObject(value: FiscalExactJsonValue | undefined, code: IndiaIrpAdapterRegistrationLoadErrorCode): ExactObject {
  if (value?.kind !== "object") return fail(code);
  return value;
}

function exactArray(value: FiscalExactJsonValue | undefined, code: IndiaIrpAdapterRegistrationLoadErrorCode): ExactArray {
  if (value?.kind !== "array") return fail(code);
  return value;
}

function exactKeys(value: ExactObject, expected: readonly string[]): boolean {
  const actual = Object.keys(value.members).sort();
  const sorted = [...expected].sort();
  return actual.length === sorted.length && actual.every((name, index) => name === sorted[index]);
}

function stringValue(value: FiscalExactJsonValue | undefined, code: IndiaIrpAdapterRegistrationLoadErrorCode): string {
  if (value?.kind !== "string") return fail(code);
  return value.value;
}

function positiveInteger(value: FiscalExactJsonValue | undefined): number {
  if (value?.kind !== "number" || !/^(?:[1-9][0-9]*)$/u.test(value.lexeme)) return fail("invalid_manifest");
  const parsed = Number(value.lexeme);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fail("invalid_manifest");
  return parsed;
}

function decode(text: string, maximumBytes: number, kind: "manifest" | "credentials"): FiscalExactJsonValue {
  const decoded = decodeFiscalExactJson(text, { maxUtf8Bytes: maximumBytes });
  if (!decoded.ok) {
    if (decoded.error.code === "resource_exhausted") return fail("resource_exhausted");
    return fail(kind === "manifest" ? "invalid_manifest" : "invalid_credentials");
  }
  return decoded.value;
}

function secretValues(value: FiscalExactJsonValue): Readonly<Record<string, string>> {
  const root = exactObject(value, "invalid_credentials");
  const fields = ["clientId", "clientSecret", "gstin", "password", "userName"] as const;
  if (!exactKeys(root, fields)) return fail("invalid_credentials");
  return Object.freeze(Object.fromEntries(fields.map((field) => [
    field, stringValue(root.members[field], "invalid_credentials"),
  ])));
}

function configuredProviderKey(configurationJson: string): string {
  const decoded = decodeFiscalExactJson(configurationJson);
  if (!decoded.ok) return fail(decoded.error.code === "resource_exhausted" ? "resource_exhausted" : "invalid_manifest");
  const root = exactObject(decoded.value, "invalid_manifest");
  return stringValue(root.members.providerKey, "invalid_manifest");
}

/**
 * Loads a single immutable deployment snapshot. Construction is offline: only the
 * real ClearIRP factory may produce submit/lookup functions.
 *
 * POSIX credential ownership and mode bits are enforced here. Node exposes no
 * trustworthy Windows DACL inspection API, so a successful Windows load is not ACL
 * attestation: deployment must independently restrict both files to the runtime
 * account (and required administrators) before activating the separately default-off
 * worker.
 */
export async function loadIndiaIrpAdapterRegistrationsFromEnvironment(
  environment: NodeJS.ProcessEnv,
  options?: ClearIrpDirectAdapterOptions,
): Promise<IndiaIrpAdapterRegistrationLoadResult> {
  let manifestPath: unknown;
  try {
    if (typeof environment !== "object" || environment === null) return failure("invalid_input");
    manifestPath = environment.YELLOW_INDIA_IRP_PROVIDERS_FILE;
  } catch {
    return failure("invalid_input");
  }
  if (manifestPath === undefined) {
    return Object.freeze({ ok: true, value: Object.freeze([]) });
  }
  if (!validLocalAbsolutePath(manifestPath)) return failure("invalid_input");

  try {
    const manifestFile = await readSnapshot(
      manifestPath, INDIA_IRP_PROVIDER_DEPLOYMENT_LIMITS.maxManifestBytes, "manifest",
    );
    const manifest = exactObject(decode(
      manifestFile.text, INDIA_IRP_PROVIDER_DEPLOYMENT_LIMITS.maxManifestBytes, "manifest",
    ), "invalid_manifest");
    if (!exactKeys(manifest, ["version", "providers"])
        || manifest.members.version?.kind !== "number" || manifest.members.version.lexeme !== "1") {
      return fail("invalid_manifest");
    }
    const providers = exactArray(manifest.members.providers, "invalid_manifest");
    if (providers.items.length > INDIA_IRP_PROVIDER_DEPLOYMENT_LIMITS.maxProviders) {
      return fail("resource_exhausted");
    }

    const registrations: Readonly<VerifiedIndiaIrpAdapterRegistration>[] = [];
    const providerExtensionIds = new Set<string>();
    for (const providerValue of providers.items) {
      const provider = exactObject(providerValue, "invalid_manifest");
      const fields = ["providerExtensionId", "providerExtensionVersion",
        "protocolConfigurationJson", "credentialsFile"] as const;
      if (!exactKeys(provider, fields)) return fail("invalid_manifest");
      const providerExtensionId = stringValue(provider.members.providerExtensionId, "invalid_manifest");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(providerExtensionId)) {
        return fail("invalid_manifest");
      }
      // extension.id is the canonical provider-row identity. Reject its reuse
      // before inspecting any repeated entry's version, secrets, or adapter.
      if (providerExtensionIds.has(providerExtensionId)) return fail("invalid_manifest");
      providerExtensionIds.add(providerExtensionId);
      const providerExtensionVersion = positiveInteger(provider.members.providerExtensionVersion);
      const protocolConfigurationJson = stringValue(provider.members.protocolConfigurationJson, "invalid_manifest");
      const credentialsFile = stringValue(provider.members.credentialsFile, "invalid_manifest");
      if (!validLocalAbsolutePath(credentialsFile) || credentialsFile === manifestPath) return fail("invalid_manifest");
      const credentialsSnapshot = await readSnapshot(
        credentialsFile, INDIA_IRP_PROVIDER_DEPLOYMENT_LIMITS.maxCredentialsBytes, "credentials",
      );
      if (credentialsSnapshot.device === manifestFile.device && credentialsSnapshot.inode === manifestFile.inode) {
        return fail("invalid_manifest");
      }
      const secrets = secretValues(decode(
        credentialsSnapshot.text, INDIA_IRP_PROVIDER_DEPLOYMENT_LIMITS.maxCredentialsBytes, "credentials",
      ));
      const adapter = await createClearIrpDirectAdapter(protocolConfigurationJson, secrets, options);
      if (!adapter.ok) {
        if (adapter.error.code === "resource_exhausted") return fail("resource_exhausted");
        if (adapter.error.code === "invalid_secrets") return fail("invalid_credentials");
        if (adapter.error.code === "invalid_input") return fail("invalid_input");
        return fail("invalid_manifest");
      }
      const providerKey = configuredProviderKey(protocolConfigurationJson);
      registrations.push(Object.freeze({
        kind: "registered_verified_india_irp_1_1_adapter" as const,
        providerKey, providerExtensionId, providerExtensionVersion,
        submit: adapter.value.submit, lookup: adapter.value.lookup,
      }));
    }
    return Object.freeze({ ok: true, value: Object.freeze(registrations) });
  } catch (error) {
    return failure(error instanceof ConfigurationLoadFailure ? error.code : "filesystem_unavailable");
  }
}
