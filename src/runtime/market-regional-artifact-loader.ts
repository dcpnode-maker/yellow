/** Explicit, all-or-nothing read-only loading of the server-owned Overture catalog. */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  MARKET_REGIONAL_ADMISSION_LIMITS,
  type MarketRegionalAdmission,
  tryAdmitMarketRegionalArtifact,
} from "../contexts/distribution";

export const MARKET_REGIONAL_ARTIFACT_LOADER_LIMITS = Object.freeze({
  maximumArtifactBytes: MARKET_REGIONAL_ADMISSION_LIMITS.maximumArtifactBytes,
  maximumReaderStdoutBytes: Math.ceil(MARKET_REGIONAL_ADMISSION_LIMITS.maximumArtifactBytes * 4 / 3) + 2_048,
  maximumReaderStderrBytes: 65_536,
  readerTimeoutMs: 15_000,
  catalogEntries: 2,
});

export interface MarketRegionalArtifactReadRequest {
  readonly rootDirectory: string;
  readonly relativePath: string;
  readonly expectedLength: number;
}

export type MarketRegionalArtifactReadBytes = (request: MarketRegionalArtifactReadRequest) => Promise<Uint8Array>;

export interface MarketRegionalArtifactLoaderOptions {
  /** Server-owned deployment root; it is never accepted from an HTTP/request surface. */
  readonly rootDirectory?: string;
  /** Test/deployment override for the preserved absolute PowerShell 7 binary. */
  readonly powershellPath?: string;
  /** Test seam for the native reader; identities, hashes, and validators remain private. */
  readonly readBytes?: MarketRegionalArtifactReadBytes;
}

export interface MarketRegionalArtifactCatalogEntry {
  readonly logicalId: "riyadh" | "dubai";
  readonly admission: MarketRegionalAdmission;
}

export interface MarketRegionalArtifactCatalog {
  readonly entries: readonly MarketRegionalArtifactCatalogEntry[];
}

export type MarketRegionalArtifactCatalogErrorCode = "unsupported_platform" | "invalid_options" | "reader_failed" | "admission_failed";

export type MarketRegionalArtifactCatalogResult = Readonly<
  | { readonly ok: true; readonly value: MarketRegionalArtifactCatalog }
  | { readonly ok: false; readonly error: Readonly<{
    readonly code: MarketRegionalArtifactCatalogErrorCode;
    readonly message: "Market regional artifact catalog could not be loaded.";
  }> }
>;

const DEFAULT_ROOT_DIRECTORY = "E:\\yellow\\market-discovery\\order472";
const DEFAULT_POWERSHELL_PATH = "C:\\Users\\astha\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\powershell\\pwsh.exe";
const READER_PATH = fileURLToPath(new URL("../../scripts/native/read-market-regional-artifact.ps1", import.meta.url));
const RECEIPT_FORMAT = "yellow/market-regional-read/v1";
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const CONTROL = /[\u0000-\u001f\u007f]/u;
const RESERVED_DOS_NAME = /^(?:CON|PRN|AUX|NUL|CLOCK\$|CONIN\$|CONOUT\$|COM[0-9\u00b9\u00b2\u00b3]|LPT[0-9\u00b9\u00b2\u00b3])(?:\.|$)/iu;

interface PrivateCatalogEntry {
  readonly logicalId: "riyadh" | "dubai";
  readonly relativePath: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly region: Readonly<{
    readonly minimumLatitude: number;
    readonly maximumLatitude: number;
    readonly minimumLongitude: number;
    readonly maximumLongitude: number;
  }>;
}

const CATALOG: readonly PrivateCatalogEntry[] = Object.freeze([
  Object.freeze({
    logicalId: "riyadh",
    relativePath: "region-20260913T080233Z-139ffad96f59497a9a19d547792d070e\\region.json",
    byteLength: 41_226,
    sha256: "4b90f33418ab95d62c5ed21a09a601c5bf93c7cf66817e91fe86e0562fa17009",
    region: Object.freeze({ minimumLatitude: 24.707, maximumLatitude: 24.709, minimumLongitude: 46.676, maximumLongitude: 46.678 }),
  }),
  Object.freeze({
    logicalId: "dubai",
    relativePath: "region-20260913T080453Z-5b27867cde994a0b9c673d099ecb7d85\\region.json",
    byteLength: 43_688,
    sha256: "7c0c268a34cb461713eed238124c627a5d1c0e44e3509184a215628b362cc6e7",
    region: Object.freeze({ minimumLatitude: 25.196, maximumLatitude: 25.198, minimumLongitude: 55.270, maximumLongitude: 55.272 }),
  }),
]);

type PlainRecord = Record<string, unknown>;

class LoaderValidationError extends TypeError {}

function fail(message: string): never {
  throw new LoaderValidationError(message);
}

function failure(code: MarketRegionalArtifactCatalogErrorCode): MarketRegionalArtifactCatalogResult {
  return Object.freeze({ ok: false as const, error: Object.freeze({
    code,
    message: "Market regional artifact catalog could not be loaded." as const,
  }) });
}

function ownPlain(value: unknown, field: string, maximumKeys: number): PlainRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fail(`${field} must be a plain object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fail(`${field} must be a plain object`);
  const keys = Reflect.ownKeys(value);
  if (keys.length > maximumKeys || keys.some((key) => typeof key !== "string")) return fail(`${field} has too many fields`);
  const result: PlainRecord = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set || !descriptor.enumerable) return fail(`${field} must not contain accessors`);
    result[key as string] = descriptor.value;
  }
  return result;
}

function exactKeys(value: PlainRecord, keys: readonly string[], field: string): void {
  const allowed = new Set(keys);
  if (Object.keys(value).some((key) => !allowed.has(key)) || keys.some((key) => !Object.hasOwn(value, key))) {
    fail(`${field} has unexpected or missing fields`);
  }
}

function windowsAbsolute(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length < 3 || value.length > 1_024 || CONTROL.test(value)
    || !/^[A-Za-z]:\\/u.test(value) || value.includes("/")) return fail(`${field} is invalid`);
  const tail = value.slice(3);
  const components = tail.length === 0 ? [] : tail.split("\\");
  if (components.some((component) => component.length === 0 || component === "." || component === ".."
    || component.endsWith(".") || component.endsWith(" ") || /[<>:"|?*]/u.test(component)
    || RESERVED_DOS_NAME.test(component))) return fail(`${field} is invalid`);
  return value;
}

function snapshotOptions(value: unknown): Readonly<{ rootDirectory: string; powershellPath: string; readBytes: MarketRegionalArtifactReadBytes | null }> {
  if (value === undefined) return Object.freeze({ rootDirectory: DEFAULT_ROOT_DIRECTORY, powershellPath: DEFAULT_POWERSHELL_PATH, readBytes: null });
  const row = ownPlain(value, "loader options", 3);
  const allowed = ["rootDirectory", "powershellPath", "readBytes"];
  if (Object.keys(row).some((key) => !allowed.includes(key))) return fail("loader options have unexpected fields");
  if (row.readBytes !== undefined && typeof row.readBytes !== "function") return fail("loader readBytes is invalid");
  return Object.freeze({
    rootDirectory: row.rootDirectory === undefined ? DEFAULT_ROOT_DIRECTORY : windowsAbsolute(row.rootDirectory, "loader rootDirectory"),
    powershellPath: row.powershellPath === undefined ? DEFAULT_POWERSHELL_PATH : windowsAbsolute(row.powershellPath, "loader powershellPath"),
    readBytes: row.readBytes === undefined ? null : row.readBytes as MarketRegionalArtifactReadBytes,
  });
}

function decodeReceipt(output: Uint8Array, expectedLength: number): Uint8Array {
  if (output.byteLength === 0 || output.byteLength > MARKET_REGIONAL_ARTIFACT_LOADER_LIMITS.maximumReaderStdoutBytes) return fail("reader output is invalid");
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(output);
  } catch {
    return fail("reader output is invalid");
  }
  if (decoded.charCodeAt(0) === 0xfeff) return fail("reader output is invalid");
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded.trim());
  } catch {
    return fail("reader output is invalid");
  }
  const receipt = ownPlain(parsed, "reader receipt", 3);
  exactKeys(receipt, ["format", "byteLength", "bytesBase64"], "reader receipt");
  if (receipt.format !== RECEIPT_FORMAT || receipt.byteLength !== expectedLength || typeof receipt.bytesBase64 !== "string"
    || receipt.bytesBase64.length > MARKET_REGIONAL_ARTIFACT_LOADER_LIMITS.maximumReaderStdoutBytes || !BASE64.test(receipt.bytesBase64)) {
    return fail("reader receipt is invalid");
  }
  const bytes = Uint8Array.from(Buffer.from(receipt.bytesBase64, "base64"));
  if (bytes.byteLength !== expectedLength || Buffer.from(bytes).toString("base64") !== receipt.bytesBase64) return fail("reader receipt is invalid");
  return bytes;
}

function defaultReadBytes(request: MarketRegionalArtifactReadRequest, powershellPath: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const child = spawn(powershellPath, [
      "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", READER_PATH,
      "-RootDirectory", request.rootDirectory, "-RelativePath", request.relativePath, "-ExpectedLength", String(request.expectedLength),
    ], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Uint8Array[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const terminate = () => {
      if (!child.killed) child.kill(); // This is the child created above, never a global process lookup.
    };
    const timer = setTimeout(() => settle(() => { terminate(); reject(new LoaderValidationError("reader timed out")); }), MARKET_REGIONAL_ARTIFACT_LOADER_LIMITS.readerTimeoutMs);
    child.stdout.on("data", (chunk: Uint8Array) => {
      if (settled) return;
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > MARKET_REGIONAL_ARTIFACT_LOADER_LIMITS.maximumReaderStdoutBytes) return settle(() => { terminate(); reject(new LoaderValidationError("reader stdout exceeded bound")); });
      else stdout.push(Uint8Array.from(chunk));
    });
    child.stderr.on("data", (chunk: Uint8Array) => {
      if (settled) return;
      stderrBytes += chunk.byteLength;
      if (stderrBytes > MARKET_REGIONAL_ARTIFACT_LOADER_LIMITS.maximumReaderStderrBytes) return settle(() => { terminate(); reject(new LoaderValidationError("reader stderr exceeded bound")); });
    });
    child.stdout.on("error", () => {
      if (settled) return;
      settle(() => { terminate(); reject(new LoaderValidationError("reader stdout failed")); });
    });
    child.stderr.on("error", () => {
      if (settled) return;
      settle(() => { terminate(); reject(new LoaderValidationError("reader stderr failed")); });
    });
    child.on("error", () => {
      if (settled) return;
      settle(() => reject(new LoaderValidationError("reader failed")));
    });
    child.on("close", (code) => {
      if (settled) return;
      settle(() => {
        if (code !== 0) return reject(new LoaderValidationError("reader failed"));
        try {
          const joined = new Uint8Array(stdoutBytes);
          let offset = 0;
          for (const chunk of stdout) { joined.set(chunk, offset); offset += chunk.byteLength; }
          resolve(decodeReceipt(joined, request.expectedLength));
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

/** Explicitly reads and admits both private manifest entries; importing this module does nothing. */
export async function loadMarketRegionalArtifactCatalog(options?: MarketRegionalArtifactLoaderOptions): Promise<MarketRegionalArtifactCatalogResult> {
  let configured: Readonly<{ rootDirectory: string; powershellPath: string; readBytes: MarketRegionalArtifactReadBytes | null }>;
  try {
    configured = snapshotOptions(options);
  } catch {
    return failure("invalid_options");
  }
  if (configured.readBytes === null && process.platform !== "win32") return failure("unsupported_platform");
  const entries: MarketRegionalArtifactCatalogEntry[] = [];
  for (const entry of CATALOG) {
    const request = Object.freeze({ rootDirectory: configured.rootDirectory, relativePath: entry.relativePath, expectedLength: entry.byteLength });
    let bytes: Uint8Array;
    try {
      bytes = configured.readBytes === null ? await defaultReadBytes(request, configured.powershellPath) : await configured.readBytes(request);
    } catch {
      return failure("reader_failed");
    }
    const admitted = await tryAdmitMarketRegionalArtifact(bytes, {
      logicalId: entry.logicalId,
      byteLength: entry.byteLength,
      sha256: entry.sha256,
      region: entry.region,
    });
    if (!admitted.ok) return failure("admission_failed");
    entries.push(Object.freeze({ logicalId: entry.logicalId, admission: admitted.value }));
  }
  return Object.freeze({ ok: true as const, value: Object.freeze({ entries: Object.freeze(entries) }) });
}
