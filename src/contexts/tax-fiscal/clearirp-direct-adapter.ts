import {
  constants as cryptoConstants,
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  publicEncrypt,
  randomBytes,
  type KeyObject,
} from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  FISCAL_EXACT_JSON_LIMITS,
  decodeFiscalExactJson,
  type FiscalExactJsonValue,
} from "./fiscal-exact-json";
import type {
  FiscalDocumentProvider,
  FiscalProviderCallContext,
  FiscalProviderLookup,
  FiscalProviderResolution,
  FiscalProviderSubmission,
} from "./fiscal-provider";
import {
  FISCAL_RECEIPT_LIMITS,
  FISCAL_RECEIPT_PROTOCOL_PROFILE,
  type FiscalAcceptedReceiptEvidence,
  type FiscalCancelledReceiptEvidence,
  type FiscalReceiptEvidence,
  type FiscalRejectedReceiptEvidence,
} from "./fiscal-submission-receipt";
import {
  INDIA_IRP_SIGNED_RECEIPT_PROFILE_VERSION,
  createIndiaIrpSignedReceiptBindingVerifier,
  type IndiaIrpSignedReceiptBindingVerifier,
} from "./india-irp-signed-receipt-binding";
import { projectIssuedIndiaIrpWireCandidate } from "./india-irp-issued-wire-candidate";

export const CLEARIRP_DIRECT_ADAPTER_LIMITS = Object.freeze({
  maxConfigurationUtf8Bytes: 256 * 1024,
  maxSecretCharacters: 1024,
  maxAuthenticationResponseBytes: 1024 * 1024,
  maxCodeCount: 32,
  maxCodeCharacters: 64,
  maxProviderKeyCharacters: 128,
  maxAuthTokenCharacters: 4096,
} as const);

export type ClearIrpDirectAdapterFactoryErrorCode =
  | "invalid_input"
  | "invalid_configuration"
  | "invalid_secrets"
  | "resource_exhausted";

export interface ClearIrpDirectAdapterFactoryError {
  readonly code: ClearIrpDirectAdapterFactoryErrorCode;
  readonly message: string;
}

export type ClearIrpDirectAdapterFactoryResult = Readonly<
  | { readonly ok: true; readonly value: Readonly<FiscalDocumentProvider> }
  | { readonly ok: false; readonly error: Readonly<ClearIrpDirectAdapterFactoryError> }
>;

export interface ClearIrpDirectAdapterOptions {
  readonly fetch?: typeof fetch;
  readonly clock?: () => number;
}

type ExactObject = Extract<FiscalExactJsonValue, { readonly kind: "object" }>;

interface AdapterConfiguration {
  readonly protocolProfile: typeof FISCAL_RECEIPT_PROTOCOL_PROFILE;
  readonly providerKey: string;
  readonly environment: "sandbox" | "production";
  readonly apiBaseUrl: string;
  readonly encryptionKey: KeyObject;
  readonly encryptionModulusBytes: number;
  readonly issuer: string;
  readonly profileVersion: typeof INDIA_IRP_SIGNED_RECEIPT_PROFILE_VERSION;
  readonly trustBundleJson: string;
  readonly sekEncoding: "raw32" | "base64-text32";
  readonly tokenExpiryUtcOffsetMinutes: number;
  readonly definitiveRejectionCodes: ReadonlySet<string>;
  readonly duplicateCodes: ReadonlySet<string>;
  readonly notFoundCodes: ReadonlySet<string>;
}

interface AdapterSecrets {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly userName: string;
  readonly password: string;
  readonly gstin: string;
}

interface SubmissionSnapshot {
  readonly tenantId: string;
  readonly providerKey: string;
  readonly attemptId: string;
  readonly documentId: string;
  readonly payloadSha256: string;
  readonly payload: Uint8Array;
  readonly documentSha256: string;
  readonly sourceContentJson: string;
}

interface ContextSnapshot {
  readonly signal: AbortSignal;
  readonly deadlineUnixMs: number;
}

interface DocumentLookupIdentity {
  readonly gstin: string;
  readonly documentType: string;
  readonly documentNumber: string;
  readonly documentDate: string;
  readonly wireJson: string;
  readonly wireSha256: string;
}

interface AuthenticationSession {
  readonly authToken: string;
  readonly sek: Uint8Array;
  readonly tokenExpiryUnixMs: number;
}

class InvalidConfiguration extends Error {}
class ResourceExhausted extends Error {}
class ProtocolFailure extends Error {}

function invalidConfiguration(): never { throw new InvalidConfiguration(); }
function exhausted(): never { throw new ResourceExhausted(); }
function protocolFailure(): never { throw new ProtocolFailure(); }

function failure(
  code: ClearIrpDirectAdapterFactoryErrorCode,
  message: string,
): ClearIrpDirectAdapterFactoryResult {
  return Object.freeze({ ok: false as const, error: Object.freeze({ code, message }) });
}

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactObject(value: FiscalExactJsonValue): ExactObject {
  if (value.kind !== "object") return invalidConfiguration();
  return value;
}

function exactNames(value: ExactObject, required: readonly string[], optional: readonly string[] = []): boolean {
  const names = Object.keys(value.members).sort();
  const allowed = [...required, ...optional].sort();
  return names.length >= required.length && names.length <= allowed.length
    && required.every((name) => Object.hasOwn(value.members, name))
    && names.every((name) => allowed.includes(name));
}

function exactString(value: FiscalExactJsonValue | undefined): string {
  if (value?.kind !== "string") return invalidConfiguration();
  return value.value;
}

function exactInteger(value: FiscalExactJsonValue | undefined): number {
  if (value?.kind !== "number" || !/^-?(?:0|[1-9][0-9]*)$/u.test(value.lexeme)) return invalidConfiguration();
  const parsed = Number(value.lexeme);
  if (!Number.isSafeInteger(parsed)) return invalidConfiguration();
  return parsed;
}

function printableAscii(value: string, maximum: number): boolean {
  if (value.length < 1 || value.length > maximum) return false;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit < 0x20 || unit > 0x7e) return false;
  }
  return true;
}

function canonicalBase64(value: string, maximumBytes: number): Uint8Array | null {
  if (value.length < 4 || value.length > Math.ceil(maximumBytes / 3) * 4 || value.length % 4 !== 0) return null;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const dataLength = value.length - padding;
  const decodedLength = value.length / 4 * 3 - padding;
  if (dataLength < 2 || decodedLength < 1 || decodedLength > maximumBytes) return null;
  for (let index = 0; index < dataLength; index += 1) {
    const unit = value.charCodeAt(index);
    const alphabet = (unit >= 0x41 && unit <= 0x5a) || (unit >= 0x61 && unit <= 0x7a)
      || (unit >= 0x30 && unit <= 0x39) || unit === 0x2b || unit === 0x2f;
    if (!alphabet) return null;
  }
  for (let index = dataLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 0x3d) return null;
  }
  try {
    const bytes = new Uint8Array(Buffer.from(value, "base64"));
    if (bytes.byteLength < 1 || bytes.byteLength > maximumBytes || Buffer.from(bytes).toString("base64") !== value) {
      return null;
    }
    return bytes;
  } catch {
    return null;
  }
}

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function configurationCodes(value: FiscalExactJsonValue | undefined): readonly string[] {
  if (value?.kind !== "array" || value.items.length < 1
      || value.items.length > CLEARIRP_DIRECT_ADAPTER_LIMITS.maxCodeCount) return invalidConfiguration();
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value.items) {
    if (item.kind !== "string" || !printableAscii(item.value, CLEARIRP_DIRECT_ADAPTER_LIMITS.maxCodeCharacters)
        || seen.has(item.value)) return invalidConfiguration();
    seen.add(item.value);
    result.push(item.value);
  }
  return Object.freeze(result);
}

function parseEncryptionKey(value: string): Readonly<{ key: KeyObject; modulusBytes: number }> {
  const bytes = canonicalBase64(value, 2048);
  if (!bytes) return invalidConfiguration();
  try {
    const key = createPublicKey({ key: Buffer.from(bytes), format: "der", type: "spki" });
    const exported = new Uint8Array(key.export({ format: "der", type: "spki" }));
    const details = key.asymmetricKeyDetails;
    if (!Buffer.from(exported).equals(Buffer.from(bytes)) || key.type !== "public" || key.asymmetricKeyType !== "rsa"
        || !details || typeof details.modulusLength !== "number"
        || details.modulusLength < 2048 || details.modulusLength > 4096
        || details.publicExponent !== 65537n) return invalidConfiguration();
    return frozen({ key, modulusBytes: Math.ceil(details.modulusLength / 8) });
  } catch {
    return invalidConfiguration();
  }
}

function parseConfiguration(configurationJson: unknown): AdapterConfiguration {
  if (typeof configurationJson !== "string") return invalidConfiguration();
  if (configurationJson.length > CLEARIRP_DIRECT_ADAPTER_LIMITS.maxConfigurationUtf8Bytes
      || new TextEncoder().encode(configurationJson).byteLength
        > CLEARIRP_DIRECT_ADAPTER_LIMITS.maxConfigurationUtf8Bytes) return exhausted();
  const decoded = decodeFiscalExactJson(configurationJson);
  if (!decoded.ok) {
    if (decoded.error.code === "resource_exhausted") return exhausted();
    return invalidConfiguration();
  }
  const root = exactObject(decoded.value);
  const names = [
    "apiBaseUrl", "definitiveRejectionCodes", "duplicateCodes", "encryptionSpkiDerBase64",
    "environment", "issuer", "notFoundCodes", "profileVersion", "protocolProfile", "providerKey",
    "sekEncoding", "tokenExpiryUtcOffsetMinutes", "trustBundleJson",
  ];
  if (!exactNames(root, names)) return invalidConfiguration();
  const protocolProfile = exactString(root.members.protocolProfile);
  const providerKey = exactString(root.members.providerKey);
  const environment = exactString(root.members.environment);
  const apiBaseUrlValue = exactString(root.members.apiBaseUrl);
  const issuer = exactString(root.members.issuer);
  const profileVersion = exactString(root.members.profileVersion);
  const trustBundleJson = exactString(root.members.trustBundleJson);
  const sekEncoding = exactString(root.members.sekEncoding);
  const tokenExpiryUtcOffsetMinutes = exactInteger(root.members.tokenExpiryUtcOffsetMinutes);
  const definitiveRejectionCodes = configurationCodes(root.members.definitiveRejectionCodes);
  const duplicateCodes = configurationCodes(root.members.duplicateCodes);
  const notFoundCodes = configurationCodes(root.members.notFoundCodes);
  if (protocolProfile !== FISCAL_RECEIPT_PROTOCOL_PROFILE
      || !/^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$/u.test(providerKey)
      || (environment !== "sandbox" && environment !== "production")
      || profileVersion !== INDIA_IRP_SIGNED_RECEIPT_PROFILE_VERSION
      || !printableAscii(issuer, 128)
      || (sekEncoding !== "raw32" && sekEncoding !== "base64-text32")
      || tokenExpiryUtcOffsetMinutes < -840 || tokenExpiryUtcOffsetMinutes > 840) return invalidConfiguration();
  let apiBaseUrl: string;
  try {
    const parsed = new URL(apiBaseUrlValue);
    if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== ""
        || parsed.search !== "" || parsed.hash !== "" || parsed.pathname !== "/"
        || parsed.origin === "null" || parsed.href !== `${parsed.origin}/`) return invalidConfiguration();
    apiBaseUrl = parsed.origin;
  } catch {
    return invalidConfiguration();
  }
  const allCodes = [...definitiveRejectionCodes, ...duplicateCodes, ...notFoundCodes];
  if (new Set(allCodes).size !== allCodes.length) return invalidConfiguration();
  const encryption = parseEncryptionKey(exactString(root.members.encryptionSpkiDerBase64));
  return frozen({
    protocolProfile,
    providerKey,
    environment,
    apiBaseUrl,
    encryptionKey: encryption.key,
    encryptionModulusBytes: encryption.modulusBytes,
    issuer,
    profileVersion,
    trustBundleJson,
    sekEncoding,
    tokenExpiryUtcOffsetMinutes,
    definitiveRejectionCodes: new Set(definitiveRejectionCodes),
    duplicateCodes: new Set(duplicateCodes),
    notFoundCodes: new Set(notFoundCodes),
  });
}

function snapshotPlainRecord(value: unknown, names: readonly string[]): PropertyDescriptorMap | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    if (Object.getOwnPropertySymbols(value).length !== 0) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const actual = Object.keys(descriptors).sort();
    const expected = [...names].sort();
    if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) return null;
    for (const descriptor of Object.values(descriptors)) {
      if (!("value" in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined
          || descriptor.enumerable !== true) return null;
    }
    return descriptors;
  } catch {
    return null;
  }
}

function snapshotSecrets(value: unknown): AdapterSecrets | null {
  const fields = ["clientId", "clientSecret", "gstin", "password", "userName"] as const;
  const descriptors = snapshotPlainRecord(value, fields);
  if (!descriptors) return null;
  const strings = Object.fromEntries(fields.map((field) => [field, descriptors[field]!.value])) as Record<string, unknown>;
  for (const field of fields) {
    const candidate = strings[field];
    if (typeof candidate !== "string" || !printableAscii(candidate, CLEARIRP_DIRECT_ADAPTER_LIMITS.maxSecretCharacters)) {
      return null;
    }
  }
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/u.test(strings.gstin as string)) return null;
  return frozen({
    clientId: strings.clientId as string,
    clientSecret: strings.clientSecret as string,
    userName: strings.userName as string,
    password: strings.password as string,
    gstin: strings.gstin as string,
  });
}

function snapshotOptions(value: ClearIrpDirectAdapterOptions | undefined): Readonly<{
  fetchImplementation: typeof fetch;
  clock: () => number;
}> | null {
  if (value === undefined) return frozen({ fetchImplementation: globalThis.fetch, clock: Date.now });
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
        || Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length !== 0) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const names = Object.keys(descriptors).sort();
    if (names.some((name) => name !== "clock" && name !== "fetch")) return null;
    for (const descriptor of Object.values(descriptors)) {
      if (!("value" in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined
          || descriptor.enumerable !== true) return null;
    }
    const fetchImplementation = descriptors.fetch?.value ?? globalThis.fetch;
    const clock = descriptors.clock?.value ?? Date.now;
    if (typeof fetchImplementation !== "function" || typeof clock !== "function") return null;
    return frozen({ fetchImplementation: fetchImplementation as typeof fetch, clock: clock as () => number });
  } catch {
    return null;
  }
}

function snapshotSubmission(value: FiscalProviderSubmission | FiscalProviderLookup): SubmissionSnapshot | null {
  const fields = [
    "attemptId", "documentId", "documentSha256", "payload", "payloadSha256", "providerKey",
    "sourceContentJson", "tenantId",
  ] as const;
  const descriptors = snapshotPlainRecord(value, fields);
  if (!descriptors) return null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
  const digest = /^[0-9a-f]{64}$/u;
  const stringValue = (name: typeof fields[number]) => descriptors[name]!.value;
  const tenantId = stringValue("tenantId");
  const attemptId = stringValue("attemptId");
  const documentId = stringValue("documentId");
  const providerKey = stringValue("providerKey");
  const payloadSha256 = stringValue("payloadSha256");
  const documentSha256 = stringValue("documentSha256");
  const sourceContentJson = stringValue("sourceContentJson");
  const payloadValue = stringValue("payload");
  if (typeof tenantId !== "string" || !uuid.test(tenantId)
      || typeof attemptId !== "string" || !uuid.test(attemptId)
      || typeof documentId !== "string" || !uuid.test(documentId)
      || typeof providerKey !== "string"
      || typeof payloadSha256 !== "string" || !digest.test(payloadSha256)
      || typeof documentSha256 !== "string" || !digest.test(documentSha256)
      || typeof sourceContentJson !== "string"
      || sourceContentJson.length < 1 || sourceContentJson.length > FISCAL_EXACT_JSON_LIMITS.maxUtf8Bytes
      || utilTypes.isProxy(payloadValue) || !(payloadValue instanceof Uint8Array)
      || payloadValue.byteLength < 1 || payloadValue.byteLength > FISCAL_EXACT_JSON_LIMITS.maxUtf8Bytes) return null;
  return frozen({
    tenantId, providerKey, attemptId, documentId, payloadSha256,
    payload: new Uint8Array(payloadValue), documentSha256, sourceContentJson,
  });
}

function snapshotContext(value: FiscalProviderCallContext): ContextSnapshot | null {
  const descriptors = snapshotPlainRecord(value, ["deadlineUnixMs", "signal"]);
  if (!descriptors) return null;
  const signal = descriptors.signal!.value;
  const deadlineUnixMs = descriptors.deadlineUnixMs!.value;
  if (utilTypes.isProxy(signal) || !(signal instanceof AbortSignal) || typeof deadlineUnixMs !== "number"
      || !Number.isSafeInteger(deadlineUnixMs) || deadlineUnixMs < 0) return null;
  return frozen({ signal, deadlineUnixMs });
}

function exactResponseRoot(value: FiscalExactJsonValue): ExactObject {
  if (value.kind !== "object") return protocolFailure();
  const names = Object.keys(value.members);
  const allowed = ["Status", "status", "Data", "data", "ErrorDetails", "InfoDtls"];
  if (!names.every((name) => allowed.includes(name))
      || ((Object.hasOwn(value.members, "Status") ? 1 : 0) + (Object.hasOwn(value.members, "status") ? 1 : 0)) !== 1
      || ((Object.hasOwn(value.members, "Data") ? 1 : 0) + (Object.hasOwn(value.members, "data") ? 1 : 0)) > 1) {
    return protocolFailure();
  }
  return value;
}

function responseField(root: ExactObject, upper: "Status" | "Data"): FiscalExactJsonValue | undefined {
  const lower = upper === "Status" ? "status" : "data";
  return root.members[upper] ?? root.members[lower];
}

function responseStatus(value: FiscalExactJsonValue | undefined): 0 | 1 {
  if (value?.kind === "number" && value.lexeme === "0") return 0;
  if (value?.kind === "number" && value.lexeme === "1") return 1;
  if (value?.kind === "string" && value.value === "0") return 0;
  if (value?.kind === "string" && value.value === "1") return 1;
  return protocolFailure();
}

function requiredString(value: FiscalExactJsonValue | undefined): string {
  if (value?.kind !== "string" || value.value.length < 1) return protocolFailure();
  return value.value;
}

function strictUtf8(bytes: Uint8Array): string {
  if (bytes.byteLength < 1 || (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) return protocolFailure();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return protocolFailure();
  }
}

function encryptAes(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const cipher = createCipheriv("aes-256-ecb", key, null);
  return new Uint8Array(Buffer.concat([cipher.update(plaintext), cipher.final()]));
}

function decryptAes(key: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  try {
    const decipher = createDecipheriv("aes-256-ecb", key, null);
    return new Uint8Array(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
  } catch {
    return protocolFailure();
  }
}

function parseWallClock(value: string, offsetMinutes: number): number {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/u.exec(value);
  if (!match) return protocolFailure();
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as
    [number, number, number, number, number, number];
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return protocolFailure();
  const utcLike = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(utcLike);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day
      || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) {
    return protocolFailure();
  }
  const instant = utcLike - offsetMinutes * 60_000;
  if (!Number.isSafeInteger(instant) || instant < 0) return protocolFailure();
  return instant;
}

async function awaitAbortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return protocolFailure();
  let abort: (() => void) | undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new ProtocolFailure());
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([promise, interrupted]);
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
  }
}

async function readBoundedBody(response: Response, maximum: number, signal: AbortSignal): Promise<Uint8Array> {
  const discardBody = (): void => {
    if (!response.body) return;
    try {
      const cancellation = response.body.cancel();
      void cancellation.catch(() => undefined);
    } catch { /* response failure remains sanitized */ }
  };
  if (!response.ok || response.redirected) {
    discardBody();
    return protocolFailure();
  }
  const contentType = response.headers.get("content-type");
  if (contentType === null || !/^application\/json(?:\s*;|$)/iu.test(contentType)) {
    discardBody();
    return protocolFailure();
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(contentLength) || BigInt(contentLength) > BigInt(maximum)) {
      discardBody();
      return exhausted();
    }
  }
  if (!response.body) return protocolFailure();
  const reader = response.body.getReader();
  const abandonReader = (): void => {
    try {
      const cancellation = reader.cancel();
      void cancellation.catch(() => undefined);
    } catch { /* response failure remains sanitized */ }
    try { reader.releaseLock(); } catch { /* a pending read may retain it until cancellation settles */ }
  };
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await awaitAbortable(reader.read(), signal);
      if (result.done) break;
      const chunk = result.value;
      total += chunk.byteLength;
      if (total > maximum) {
        abandonReader();
        return exhausted();
      }
      chunks.push(new Uint8Array(chunk));
    }
  } catch (error) {
    abandonReader();
    throw error;
  }
  try { reader.releaseLock(); } catch { /* completed streams should release; no external detail escapes */ }
  if (total < 1) return protocolFailure();
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function requestHeaders(secrets: AdapterSecrets, authToken?: string): Headers {
  const headers = new Headers({
    "content-type": "application/json",
    client_id: secrets.clientId,
    client_secret: secrets.clientSecret,
    Gstin: secrets.gstin,
  });
  if (authToken !== undefined) {
    headers.set("user_name", secrets.userName);
    headers.set("AuthToken", authToken);
  }
  return headers;
}

async function authenticate(
  configuration: AdapterConfiguration,
  secrets: AdapterSecrets,
  fetchImplementation: typeof fetch,
  signal: AbortSignal,
  now: number,
): Promise<AuthenticationSession> {
  const appKey = new Uint8Array(randomBytes(32));
  const credentialsJson = JSON.stringify({
    UserName: secrets.userName,
    Password: secrets.password,
    AppKey: base64(appKey),
    ForceRefreshAccessToken: false,
  });
  const encodedCredentials = new TextEncoder().encode(base64(new TextEncoder().encode(credentialsJson)));
  if (encodedCredentials.byteLength > configuration.encryptionModulusBytes - 11) return protocolFailure();
  let encrypted: Uint8Array;
  try {
    encrypted = new Uint8Array(publicEncrypt({
      key: configuration.encryptionKey,
      padding: cryptoConstants.RSA_PKCS1_PADDING,
    }, encodedCredentials));
  } catch {
    return protocolFailure();
  }
  const response = await awaitAbortable(fetchImplementation(
    `${configuration.apiBaseUrl}/eivital/v1.04/auth`,
    frozen({
      method: "POST",
      headers: requestHeaders(secrets),
      body: JSON.stringify({ Data: base64(encrypted) }),
      redirect: "error",
      signal,
    }),
  ), signal);
  const responseBytes = await readBoundedBody(response, CLEARIRP_DIRECT_ADAPTER_LIMITS.maxAuthenticationResponseBytes, signal);
  const decoded = decodeFiscalExactJson(strictUtf8(responseBytes));
  if (!decoded.ok) return protocolFailure();
  const root = exactResponseRoot(decoded.value);
  if (responseStatus(responseField(root, "Status")) !== 1) return protocolFailure();
  const dataValue = responseField(root, "Data");
  if (dataValue?.kind !== "object"
      || !exactNames(dataValue, ["AuthToken", "ClientId", "Sek", "TokenExpiry", "UserName"])) {
    return protocolFailure();
  }
  const clientId = requiredString(dataValue.members.ClientId);
  const userName = requiredString(dataValue.members.UserName);
  const authToken = requiredString(dataValue.members.AuthToken);
  const encryptedSekText = requiredString(dataValue.members.Sek);
  const tokenExpiryText = requiredString(dataValue.members.TokenExpiry);
  const tokenExpiryUnixMs = parseWallClock(tokenExpiryText, configuration.tokenExpiryUtcOffsetMinutes);
  if (clientId !== secrets.clientId || userName !== secrets.userName
      || !printableAscii(authToken, CLEARIRP_DIRECT_ADAPTER_LIMITS.maxAuthTokenCharacters)
      || tokenExpiryUnixMs <= now) return protocolFailure();
  const encryptedSek = canonicalBase64(encryptedSekText, 4096);
  if (!encryptedSek) return protocolFailure();
  const decryptedSek = decryptAes(appKey, encryptedSek);
  let sek: Uint8Array;
  if (configuration.sekEncoding === "raw32") {
    if (decryptedSek.byteLength !== 32) return protocolFailure();
    sek = decryptedSek;
  } else {
    const decodedSek = canonicalBase64(strictUtf8(decryptedSek), 32);
    if (!decodedSek || decodedSek.byteLength !== 32) return protocolFailure();
    sek = decodedSek;
  }
  return frozen({ authToken, sek: new Uint8Array(sek), tokenExpiryUnixMs });
}

function lookupIdentity(snapshot: SubmissionSnapshot, configuration: AdapterConfiguration, secrets: AdapterSecrets): DocumentLookupIdentity | null {
  if (snapshot.providerKey !== configuration.providerKey) return null;
  const projected = projectIssuedIndiaIrpWireCandidate({
    documentId: snapshot.documentId,
    documentSha256: snapshot.documentSha256,
    contentJson: snapshot.sourceContentJson,
  });
  if (!projected.ok || snapshot.payloadSha256 !== projected.value.wireSha256
      || snapshot.payload.byteLength !== new TextEncoder().encode(projected.value.wireJson).byteLength
      || !Buffer.from(snapshot.payload).equals(Buffer.from(projected.value.wireJson, "utf8"))) return null;
  const decoded = decodeFiscalExactJson(projected.value.wireJson);
  if (!decoded.ok || decoded.value.kind !== "object") return null;
  const seller = decoded.value.members.SellerDtls;
  const document = decoded.value.members.DocDtls;
  if (seller?.kind !== "object" || document?.kind !== "object") return null;
  const gstin = seller.members.Gstin;
  const documentType = document.members.Typ;
  const documentNumber = document.members.No;
  const documentDate = document.members.Dt;
  if (gstin?.kind !== "string" || gstin.value !== secrets.gstin
      || documentType?.kind !== "string" || documentNumber?.kind !== "string"
      || documentDate?.kind !== "string") return null;
  return frozen({ gstin: gstin.value, documentType: documentType.value,
    documentNumber: documentNumber.value, documentDate: documentDate.value,
    wireJson: projected.value.wireJson, wireSha256: projected.value.wireSha256 });
}

function decodedErrorCodes(bytes: Uint8Array): readonly string[] | null {
  let text: string;
  try { text = strictUtf8(bytes); } catch { return null; }
  const decoded = decodeFiscalExactJson(text, { maxUtf8Bytes: FISCAL_RECEIPT_LIMITS.maxDecryptedDataBytes });
  if (!decoded.ok || decoded.value.kind !== "array" || decoded.value.items.length < 1
      || decoded.value.items.length > CLEARIRP_DIRECT_ADAPTER_LIMITS.maxCodeCount) return null;
  const codes: string[] = [];
  const seen = new Set<string>();
  for (const item of decoded.value.items) {
    if (item.kind !== "object" || !exactNames(item, ["ErrorCode"], ["ErrorMessage"])) return null;
    const code = item.members.ErrorCode;
    if (code?.kind !== "string" || !printableAscii(code.value, CLEARIRP_DIRECT_ADAPTER_LIMITS.maxCodeCharacters)
        || seen.has(code.value)) return null;
    seen.add(code.value);
    codes.push(code.value);
  }
  return Object.freeze(codes);
}

function receiptWithinLimit(receipt: FiscalReceiptEvidence): boolean {
  try {
    return new TextEncoder().encode(JSON.stringify(receipt)).byteLength <= FISCAL_RECEIPT_LIMITS.maxEnvelopeBytes;
  } catch {
    return false;
  }
}

function commonReceipt(
  configuration: AdapterConfiguration,
  snapshot: SubmissionSnapshot,
  identity: DocumentLookupIdentity,
  receivedAtUnixMs: number,
  rawBytes: Uint8Array,
  decryptedBytes: Uint8Array,
) {
  return {
    version: 1 as const,
    protocolProfile: FISCAL_RECEIPT_PROTOCOL_PROFILE,
    environment: configuration.environment,
    providerKey: configuration.providerKey,
    documentId: snapshot.documentId,
    documentSha256: snapshot.documentSha256,
    wireSha256: identity.wireSha256,
    receivedAtUnixMs,
    rawResponseBase64: base64(rawBytes),
    decryptedDataBase64: base64(decryptedBytes),
    decryptedDataSha256: sha256(decryptedBytes),
  };
}

async function interpretResponse(
  kind: "submit" | "lookup",
  configuration: AdapterConfiguration,
  snapshot: SubmissionSnapshot,
  identity: DocumentLookupIdentity,
  binder: IndiaIrpSignedReceiptBindingVerifier,
  rawBytes: Uint8Array,
  sek: Uint8Array,
  receivedAtUnixMs: number,
): Promise<FiscalProviderResolution> {
  let root: ExactObject;
  try {
    const decoded = decodeFiscalExactJson(strictUtf8(rawBytes), {
      maxUtf8Bytes: FISCAL_RECEIPT_LIMITS.maxRawResponseBytes,
    });
    if (!decoded.ok) return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
    root = exactResponseRoot(decoded.value);
  } catch {
    return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
  }
  let status: 0 | 1;
  try { status = responseStatus(responseField(root, "Status")); }
  catch { return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" }); }
  const responseSha256 = sha256(rawBytes);
  if (status === 0) {
    const errorDetails = root.members.ErrorDetails;
    if (errorDetails?.kind !== "string") return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
    const errorBytes = canonicalBase64(errorDetails.value, FISCAL_RECEIPT_LIMITS.maxDecryptedDataBytes);
    if (!errorBytes) return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
    const codes = decodedErrorCodes(errorBytes);
    if (!codes) return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
    if (codes.every((code) => configuration.definitiveRejectionCodes.has(code))) {
      const receipt: FiscalRejectedReceiptEvidence = frozen({
        ...commonReceipt(configuration, snapshot, identity, receivedAtUnixMs, rawBytes, errorBytes),
        kind: "rejected" as const,
        errorCodes: Object.freeze([...codes]),
      });
      if (!receiptWithinLimit(receipt)) return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
      return frozen({ verified: true, outcome: "rejected" as const, responseSha256, receipt });
    }
    if (codes.every((code) => configuration.duplicateCodes.has(code))) {
      return frozen({ verified: true, outcome: kind === "submit" ? "duplicate" as const : "pending" as const });
    }
    if (codes.every((code) => configuration.notFoundCodes.has(code))) {
      return frozen({ verified: true, outcome: kind === "submit" ? "timeout" as const : "pending" as const });
    }
    return frozen({ verified: true, outcome: kind === "submit" ? "timeout" as const : "pending" as const });
  }

  const encryptedDataValue = responseField(root, "Data");
  if (encryptedDataValue?.kind !== "string") return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
  const encryptedData = canonicalBase64(encryptedDataValue.value, FISCAL_RECEIPT_LIMITS.maxRawResponseBytes);
  if (!encryptedData) return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
  let decryptedData: Uint8Array;
  let decodedData: FiscalExactJsonValue;
  try {
    decryptedData = decryptAes(sek, encryptedData);
    if (decryptedData.byteLength > FISCAL_RECEIPT_LIMITS.maxDecryptedDataBytes) return exhausted();
    const decoded = decodeFiscalExactJson(strictUtf8(decryptedData), {
      maxUtf8Bytes: FISCAL_RECEIPT_LIMITS.maxDecryptedDataBytes,
    });
    if (!decoded.ok) return protocolFailure();
    decodedData = decoded.value;
  } catch {
    return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
  }
  if (decodedData.kind !== "object") return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
  const providerStatus = decodedData.members.Status;
  if (providerStatus?.kind !== "string") return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
  if (providerStatus.value === "CNL") {
    const allowed = ["AckNo", "AckDt", "Irn", "SignedInvoice", "SignedQRCode", "Status",
      "EwbNo", "EwbDt", "EwbValidTill", "Remarks"];
    if (kind !== "lookup" || !Object.keys(decodedData.members).every((name) => allowed.includes(name))) {
      return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
    }
    const receipt: FiscalCancelledReceiptEvidence = frozen({
      ...commonReceipt(configuration, snapshot, identity, receivedAtUnixMs, rawBytes, decryptedData),
      kind: "provider_cancelled" as const,
      providerStatus: "CNL" as const,
    });
    if (!receiptWithinLimit(receipt)) return frozen({ verified: true, outcome: "pending" });
    return frozen({ verified: true, outcome: "provider_cancelled", responseSha256, receipt });
  }
  if (providerStatus.value !== "ACT") return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
  const allowed = ["AckNo", "AckDt", "Irn", "SignedInvoice", "SignedQRCode", "Status",
    "EwbNo", "EwbDt", "EwbValidTill", "Remarks"];
  if (!Object.keys(decodedData.members).every((name) => allowed.includes(name))) {
    return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
  }
  const ackValue = decodedData.members.AckNo;
  const ackNo = ackValue?.kind === "number" ? ackValue.lexeme : ackValue?.kind === "string" ? ackValue.value : "";
  const ackDt = decodedData.members.AckDt;
  const irn = decodedData.members.Irn;
  const signedInvoice = decodedData.members.SignedInvoice;
  const signedQRCode = decodedData.members.SignedQRCode;
  if (!/^[1-9][0-9]{0,63}$/u.test(ackNo) || ackDt?.kind !== "string" || irn?.kind !== "string"
      || signedInvoice?.kind !== "string" || signedQRCode?.kind !== "string") {
    return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
  }
  const bound = await binder.verify({
    documentId: snapshot.documentId,
    documentSha256: snapshot.documentSha256,
    contentJson: snapshot.sourceContentJson,
    signedInvoice: signedInvoice.value,
    signedQRCode: signedQRCode.value,
    irn: irn.value,
    ackNo,
    ackDt: ackDt.value,
  }, receivedAtUnixMs);
  if (!bound.ok || bound.value.wireSha256 !== identity.wireSha256) {
    return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
  }
  const receipt: FiscalAcceptedReceiptEvidence = frozen({
    ...commonReceipt(configuration, snapshot, identity, receivedAtUnixMs, rawBytes, decryptedData),
    kind: "accepted_signed_v1" as const,
    irn: bound.value.irn,
    ackNo: bound.value.ackNo,
    ackDt: bound.value.ackDt,
    signedInvoice: bound.value.signedInvoice.compact,
    signedInvoiceSha256: bound.value.signedInvoice.compactSha256,
    signedQRCode: bound.value.signedQRCode.compact,
    signedQrSha256: bound.value.signedQRCode.compactSha256,
    verification: frozen({
      profileVersion: bound.value.profileVersion,
      issuer: bound.value.issuer,
      verificationUnixMs: bound.value.verificationUnixMs,
      invoiceKeyId: bound.value.signedInvoice.keyId,
      invoiceKeySpkiSha256: bound.value.signedInvoice.keySpkiSha256,
      invoiceBundleVersion: bound.value.signedInvoice.bundleVersion,
      qrKeyId: bound.value.signedQRCode.keyId,
      qrKeySpkiSha256: bound.value.signedQRCode.keySpkiSha256,
      qrBundleVersion: bound.value.signedQRCode.bundleVersion,
    }),
  });
  if (!receiptWithinLimit(receipt)) return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
  return frozen({ verified: true, outcome: "accepted", authorityRef: bound.value.irn, responseSha256, receipt });
}

async function operate(
  kind: "submit" | "lookup",
  input: FiscalProviderSubmission | FiscalProviderLookup,
  contextValue: FiscalProviderCallContext,
  configuration: AdapterConfiguration,
  secrets: AdapterSecrets,
  binder: IndiaIrpSignedReceiptBindingVerifier,
  fetchImplementation: typeof fetch,
  clock: () => number,
): Promise<FiscalProviderResolution> {
  const uncertain = () => frozen({ verified: true as const, outcome: kind === "submit" ? "known_not_sent" as const : "pending" as const });
  const snapshot = snapshotSubmission(input);
  const context = snapshotContext(contextValue);
  if (!snapshot || !context) return uncertain();
  const identity = lookupIdentity(snapshot, configuration, secrets);
  if (!identity) return uncertain();
  let now: number;
  try { now = clock(); } catch { return uncertain(); }
  if (!Number.isSafeInteger(now) || now < 0 || context.signal.aborted || context.deadlineUnixMs <= now) return uncertain();
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  context.signal.addEventListener("abort", forwardAbort, { once: true });
  if (context.signal.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), Math.min(context.deadlineUnixMs - now, 2_147_483_647));
  let transportDispatched = false;
  try {
    const session = await authenticate(configuration, secrets, fetchImplementation, controller.signal, now);
    if (controller.signal.aborted) return uncertain();
    let dispatchUnixMs: number;
    try { dispatchUnixMs = clock(); } catch { return uncertain(); }
    if (!Number.isSafeInteger(dispatchUnixMs) || dispatchUnixMs < 0
        || dispatchUnixMs >= session.tokenExpiryUnixMs || dispatchUnixMs >= context.deadlineUnixMs) return uncertain();
    let url = `${configuration.apiBaseUrl}/eicore/v1.03/Invoice`;
    let init: RequestInit;
    if (kind === "submit") {
      const encrypted = encryptAes(session.sek, snapshot.payload);
      init = frozen({
        method: "POST",
        headers: requestHeaders(secrets, session.authToken),
        body: JSON.stringify({ Data: base64(encrypted) }),
        redirect: "error",
        signal: controller.signal,
      });
    } else {
      const lookupUrl = new URL(`${configuration.apiBaseUrl}/eicore/v1.03/Invoice/irnbydocdetails`);
      lookupUrl.searchParams.set("doctype", identity.documentType);
      lookupUrl.searchParams.set("docnum", identity.documentNumber);
      lookupUrl.searchParams.set("docdate", identity.documentDate);
      url = lookupUrl.href;
      init = frozen({ method: "GET", headers: requestHeaders(secrets, session.authToken),
        redirect: "error", signal: controller.signal });
    }
    transportDispatched = true;
    const response = await awaitAbortable(fetchImplementation(url, init), controller.signal);
    const body = await readBoundedBody(response, FISCAL_RECEIPT_LIMITS.maxRawResponseBytes, controller.signal);
    let receivedAtUnixMs: number;
    try { receivedAtUnixMs = clock(); } catch { return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" }); }
    if (!Number.isSafeInteger(receivedAtUnixMs) || receivedAtUnixMs < 0 || receivedAtUnixMs > context.deadlineUnixMs) {
      return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
    }
    const resolution = await awaitAbortable(
      interpretResponse(kind, configuration, snapshot, identity, binder, body, session.sek, receivedAtUnixMs),
      controller.signal,
    );
    let completedAtUnixMs: number;
    try { completedAtUnixMs = clock(); } catch {
      return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
    }
    if (controller.signal.aborted || !Number.isSafeInteger(completedAtUnixMs) || completedAtUnixMs < 0
        || completedAtUnixMs > context.deadlineUnixMs) {
      return frozen({ verified: true, outcome: kind === "submit" ? "timeout" : "pending" });
    }
    return resolution;
  } catch {
    return frozen({ verified: true, outcome: kind === "submit" && !transportDispatched ? "known_not_sent" :
      kind === "submit" ? "timeout" : "pending" });
  } finally {
    clearTimeout(timer);
    context.signal.removeEventListener("abort", forwardAbort);
  }
}

/** Constructs an offline-capable direct ClearIRP adapter from pinned deployment policy.
 * Construction performs no network I/O and never accepts injected verification evidence. */
export async function createClearIrpDirectAdapter(
  configurationJson: unknown,
  secretsValue: unknown,
  optionsValue?: ClearIrpDirectAdapterOptions,
): Promise<ClearIrpDirectAdapterFactoryResult> {
  const options = snapshotOptions(optionsValue);
  if (!options) return failure("invalid_input", "ClearIRP direct adapter input is invalid");
  let configuration: AdapterConfiguration;
  try {
    configuration = parseConfiguration(configurationJson);
  } catch (error) {
    return error instanceof ResourceExhausted
      ? failure("resource_exhausted", "ClearIRP direct adapter configuration resource limit exceeded")
      : failure("invalid_configuration", "ClearIRP direct adapter configuration is invalid");
  }
  const secrets = snapshotSecrets(secretsValue);
  if (!secrets) return failure("invalid_secrets", "ClearIRP direct adapter secrets are invalid");
  const authShapeBytes = new TextEncoder().encode(base64(new TextEncoder().encode(JSON.stringify({
    UserName: secrets.userName,
    Password: secrets.password,
    AppKey: base64(new Uint8Array(32)),
    ForceRefreshAccessToken: false,
  })))).byteLength;
  if (authShapeBytes > configuration.encryptionModulusBytes - 11) {
    return failure("invalid_secrets", "ClearIRP direct adapter secrets are invalid");
  }
  const binderResult = await createIndiaIrpSignedReceiptBindingVerifier(JSON.stringify({
    profileVersion: configuration.profileVersion,
    issuer: configuration.issuer,
    trustBundleJson: configuration.trustBundleJson,
  }));
  if (!binderResult.ok) {
    return binderResult.error.code === "resource_exhausted"
      ? failure("resource_exhausted", "ClearIRP direct adapter configuration resource limit exceeded")
      : failure("invalid_configuration", "ClearIRP direct adapter configuration is invalid");
  }
  const adapter: FiscalDocumentProvider = frozen({
    submit(input, context) {
      return operate("submit", input, context, configuration, secrets, binderResult.value,
        options.fetchImplementation, options.clock);
    },
    lookup(input, context) {
      return operate("lookup", input, context, configuration, secrets, binderResult.value,
        options.fetchImplementation, options.clock);
    },
  });
  return frozen({ ok: true as const, value: adapter });
}
