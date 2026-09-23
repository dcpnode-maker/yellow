import { Buffer } from "node:buffer";
import {
  createCipheriv,
  createDecipheriv,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";

import { createClearIrpDirectAdapter } from
  "../../src/contexts/tax-fiscal/clearirp-direct-adapter";
import { decodeFiscalExactJson, type FiscalExactJsonValue } from
  "../../src/contexts/tax-fiscal/fiscal-exact-json";
import { projectIssuedIndiaIrpWireCandidate } from
  "../../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";
import type { VerifiedIndiaIrpAdapterRegistration } from
  "../../src/contexts/tax-fiscal/fiscal-submission-worker";

const PROTOCOL_PROFILE = "clearirp_direct_v1_04_v1_03_v1";
const PROFILE_VERSION = "yellow_native_india_1_1_v1";
const API_ORIGIN = "https://order440-clearirp.invalid";
const ISSUER = "YELLOW-ORDER440-SYNTHETIC-IRP";
const KEY_ID = "yellow-order440-synthetic-signing-key";
const BUNDLE_VERSION = "yellow-order440-synthetic-bundle-v1";
const DEFINITIVE_REJECTION_CODE = "2150";
const DUPLICATE_CODE = "2154";
const NOT_FOUND_CODE = "2143";
const CLIENT_ID = "order440-synthetic-client";
const CLIENT_SECRET = "order440-synthetic-client-secret";
const USER_NAME = "order440-synthetic-user";
const PASSWORD = "order440-synthetic-password";
const ACK_NO = "90071992547409991";

type ExactObject = Extract<FiscalExactJsonValue, { readonly kind: "object" }>;
type ExactArray = Extract<FiscalExactJsonValue, { readonly kind: "array" }>;
type ExactNumber = Extract<FiscalExactJsonValue, { readonly kind: "number" }>;

export type Order440ClearIrpBehavior =
  | "accepted_after_response_loss"
  | "rejected"
  | "cancelled_after_response_loss"
  | "signed_source_mismatch";

export interface Order440ClearIrpIssuedDocument {
  readonly documentId: string;
  readonly documentSha256: string;
  readonly sourceContentJson: string;
  readonly wireJson: string;
  readonly wireSha256: string;
  readonly providerKey: string;
}

export interface Order440ClearIrpAdapterIdentity {
  readonly providerKey: string;
  readonly providerExtensionId: string;
  readonly providerExtensionVersion: number;
}

export interface Order440ClearIrpProtocolMetrics {
  readonly adapterInstances: number;
  readonly authenticationRequests: number;
  readonly submissionPosts: number;
  readonly documentLookups: number;
  readonly submittedWireSha256: readonly string[];
}

export interface Order440ClearIrpProtocol {
  createRegistration(identity: Order440ClearIrpAdapterIdentity): Promise<VerifiedIndiaIrpAdapterRegistration>;
  metrics(): Readonly<Order440ClearIrpProtocolMetrics>;
}

interface ProviderRecord {
  readonly kind: "accepted" | "cancelled" | "mismatch";
  readonly irn: string;
  readonly signedInvoice?: string;
  readonly signedQRCode?: string;
}

function fail(message: string): never {
  throw new Error(`Order440 synthetic ClearIRP protocol failure: ${message}`);
}

function base64(value: Uint8Array): string {
  return Buffer.from(value).toString("base64");
}

function base64Url(value: Uint8Array): string {
  return base64(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64"));
}

function sha256(value: string | Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function bytesBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  return value;
}

function modularPower(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let factor = base % modulus;
  let power = exponent;
  while (power > 0n) {
    if ((power & 1n) === 1n) result = result * factor % modulus;
    factor = factor * factor % modulus;
    power >>= 1n;
  }
  return result;
}

/** Bun disables privateDecrypt with RSA v1.5; this test-side primitive checks its exact encoded block. */
function rsaPkcs1Decrypt(key: KeyObject, ciphertext: Uint8Array): Uint8Array {
  const jwk = key.export({ format: "jwk" });
  if (!jwk.n || !jwk.d) return fail("encryption private key is incomplete");
  const modulusBytes = base64UrlBytes(jwk.n).byteLength;
  const encoded = modularPower(bytesBigInt(ciphertext), bytesBigInt(base64UrlBytes(jwk.d)),
    bytesBigInt(base64UrlBytes(jwk.n))).toString(16).padStart(modulusBytes * 2, "0");
  const block = new Uint8Array(Buffer.from(encoded, "hex"));
  if (block[0] !== 0 || block[1] !== 2) return fail("RSA padding header is invalid");
  const separator = block.indexOf(0, 2);
  if (separator < 10) return fail("RSA padding separator is invalid");
  for (let index = 2; index < separator; index += 1) {
    if (block[index] === 0) return fail("RSA padding is invalid");
  }
  return block.slice(separator + 1);
}

function encryptAes(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const cipher = createCipheriv("aes-256-ecb", key, null);
  return new Uint8Array(Buffer.concat([cipher.update(plaintext), cipher.final()]));
}

function decryptAes(key: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  const decipher = createDecipheriv("aes-256-ecb", key, null);
  return new Uint8Array(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
}

function exactObject(value: FiscalExactJsonValue | undefined): ExactObject {
  if (value?.kind !== "object") return fail("issued wire object is invalid");
  return value;
}

function exactArray(value: FiscalExactJsonValue | undefined): ExactArray {
  if (value?.kind !== "array") return fail("issued wire array is invalid");
  return value;
}

function exactString(value: FiscalExactJsonValue | undefined): string {
  if (value?.kind !== "string") return fail("issued wire string is invalid");
  return value.value;
}

function exactNumber(value: FiscalExactJsonValue | undefined): ExactNumber {
  if (value?.kind !== "number") return fail("issued wire number is invalid");
  return value;
}

function decimalParts(value: ExactNumber | string): { sign: -1 | 0 | 1; coefficient: string; exponent: bigint } {
  const lexeme = typeof value === "string" ? value : value.lexeme;
  const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/u.exec(lexeme);
  if (!match) return fail("issued decimal is invalid");
  let coefficient = `${match[2]}${match[3] ?? ""}`.replace(/^0+/u, "");
  if (coefficient === "") return { sign: 0, coefficient: "0", exponent: 0n };
  let exponent = BigInt(match[4] ?? "0") - BigInt((match[3] ?? "").length);
  while (coefficient.endsWith("0")) {
    coefficient = coefficient.slice(0, -1);
    exponent += 1n;
  }
  return { sign: match[1] === "-" ? -1 : 1, coefficient, exponent };
}

function compareDecimal(left: ExactNumber | string, right: ExactNumber | string): number {
  const first = decimalParts(left);
  const second = decimalParts(right);
  if (first.sign !== second.sign) return first.sign < second.sign ? -1 : 1;
  if (first.sign === 0) return 0;
  const firstMagnitude = BigInt(first.coefficient.length) + first.exponent;
  const secondMagnitude = BigInt(second.coefficient.length) + second.exponent;
  let comparison: number;
  if (firstMagnitude !== secondMagnitude) comparison = firstMagnitude < secondMagnitude ? -1 : 1;
  else {
    const width = Math.max(first.coefficient.length, second.coefficient.length);
    const a = first.coefficient.padEnd(width, "0");
    const b = second.coefficient.padEnd(width, "0");
    comparison = a === b ? 0 : a < b ? -1 : 1;
  }
  return first.sign === 1 ? comparison : -comparison;
}

function mainHsn(root: ExactObject): string {
  const items = exactArray(root.members.ItemList);
  let maximum: ExactNumber | undefined;
  const hsns = new Set<string>();
  for (const value of items.items) {
    const item = exactObject(value);
    const assessable = exactNumber(item.members.AssAmt);
    const hsn = exactString(item.members.HsnCd);
    const comparison = maximum ? compareDecimal(assessable, maximum) : 1;
    if (comparison > 0) {
      maximum = assessable;
      hsns.clear();
      hsns.add(hsn);
    } else if (comparison === 0) hsns.add(hsn);
  }
  if (!maximum || hsns.size !== 1) return fail("issued wire has no unambiguous maximum-value HSN");
  return hsns.values().next().value as string;
}

function formatUtc(unixMs: number): string {
  const iso = new Date(unixMs).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
}

async function signInner(inner: string, privateKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const header = base64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT", kid: KEY_ID })));
  const payload = base64Url(encoder.encode(JSON.stringify({ data: inner, iss: ISSUER })));
  const signingInput = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", privateKey, encoder.encode(signingInput),
  ));
  return `${signingInput}.${base64Url(signature)}`;
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

function asFetch(implementation: (
  input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1],
) => Promise<Response>): typeof fetch {
  return implementation as typeof fetch;
}

/**
 * A stateful, entirely local ClearIRP peer. Every accepted artifact is freshly signed
 * from the supplied immutable source, and every transport body uses real RSA/AES operations.
 */
export async function createOrder440ClearIrpProtocol(
  document: Order440ClearIrpIssuedDocument,
  behavior: Order440ClearIrpBehavior,
): Promise<Readonly<Order440ClearIrpProtocol>> {
  const projected = projectIssuedIndiaIrpWireCandidate({
    documentId: document.documentId,
    documentSha256: document.documentSha256,
    contentJson: document.sourceContentJson,
  });
  if (!projected.ok || projected.value.wireJson !== document.wireJson
      || projected.value.wireSha256 !== document.wireSha256) return fail("issued document projection does not match");
  const decoded = decodeFiscalExactJson(document.wireJson);
  if (!decoded.ok) return fail("issued wire cannot be decoded");
  const root = exactObject(decoded.value);
  const seller = exactObject(root.members.SellerDtls);
  const buyer = exactObject(root.members.BuyerDtls);
  const doc = exactObject(root.members.DocDtls);
  const values = exactObject(root.members.ValDtls);
  const items = exactArray(root.members.ItemList);
  const sellerGstin = exactString(seller.members.Gstin);
  const documentType = exactString(doc.members.Typ);
  const documentNumber = exactString(doc.members.No);
  const documentDate = exactString(doc.members.Dt);
  const irn = sha256(`order440:${document.documentId}:${document.wireSha256}`);
  const createdAt = Date.now();
  const ackDt = formatUtc(createdAt);

  const encryptionPair = generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 0x10001 });
  const encryptionSpki = encryptionPair.publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const signingPair = await crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  }, true, ["sign", "verify"]);
  const signingSpki = base64(new Uint8Array(await crypto.subtle.exportKey("spki", signingPair.publicKey)));
  const trustBundleJson = JSON.stringify({ version: BUNDLE_VERSION, keys: [{
    id: KEY_ID,
    spkiDerBase64: signingSpki,
    notBeforeUnixMs: createdAt - 3_600_000,
    notAfterUnixMs: createdAt + 3_600_000,
  }] });
  const configurationJson = JSON.stringify({
    protocolProfile: PROTOCOL_PROFILE,
    providerKey: document.providerKey,
    environment: "sandbox",
    apiBaseUrl: API_ORIGIN,
    encryptionSpkiDerBase64: encryptionSpki,
    issuer: ISSUER,
    profileVersion: PROFILE_VERSION,
    trustBundleJson,
    sekEncoding: "raw32",
    tokenExpiryUtcOffsetMinutes: 0,
    definitiveRejectionCodes: [DEFINITIVE_REJECTION_CODE],
    duplicateCodes: [DUPLICATE_CODE],
    notFoundCodes: [NOT_FOUND_CODE],
  });
  const secrets = Object.freeze({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET,
    userName: USER_NAME, password: PASSWORD, gstin: sellerGstin });
  const sessions = new Map<string, Uint8Array>();
  const records = new Map<string, ProviderRecord>();
  const submittedWireSha256: string[] = [];
  let adapterInstances = 0;
  let authenticationRequests = 0;
  let submissionPosts = 0;
  let documentLookups = 0;

  const signedRecord = async (kind: "accepted" | "mismatch"): Promise<ProviderRecord> => {
    const invoiceInner = `${document.wireJson.slice(0, -1)},"AckNo":${ACK_NO},` +
      `"AckDt":${JSON.stringify(ackDt)},"Irn":${JSON.stringify(irn)}}`;
    const originalTotal = exactNumber(values.members.TotInvVal);
    const mismatchCandidate = compareDecimal(originalTotal, "999999999.99") === 0
      ? "999999999.98" : "999999999.99";
    const qrTotal = kind === "mismatch" ? mismatchCandidate : originalTotal.lexeme;
    const qrInner = `{` + [
      `"SellerGstin":${JSON.stringify(sellerGstin)}`,
      `"BuyerGstin":${JSON.stringify(exactString(buyer.members.Gstin))}`,
      `"DocNo":${JSON.stringify(documentNumber)}`,
      `"DocTyp":${JSON.stringify(documentType)}`,
      `"DocDt":${JSON.stringify(documentDate)}`,
      `"TotInvVal":${qrTotal}`,
      `"ItemCnt":${items.items.length}`,
      `"MainHsnCode":${JSON.stringify(mainHsn(root))}`,
      `"Irn":${JSON.stringify(irn)}`,
    ].join(",") + `}`;
    const [signedInvoice, signedQRCode] = await Promise.all([
      signInner(invoiceInner, signingPair.privateKey), signInner(qrInner, signingPair.privateKey),
    ]);
    return Object.freeze({ kind, irn, signedInvoice, signedQRCode });
  };

  const encryptedProviderResponse = (record: ProviderRecord, sek: Uint8Array): Response => {
    const data = record.kind === "cancelled"
      ? JSON.stringify({ Irn: record.irn, Status: "CNL" })
      : JSON.stringify({ AckNo: ACK_NO, AckDt: ackDt, Irn: record.irn,
        SignedInvoice: record.signedInvoice, SignedQRCode: record.signedQRCode, Status: "ACT" });
    return jsonResponse({ Status: 1, Data: base64(encryptAes(sek, new TextEncoder().encode(data))),
      ErrorDetails: null, InfoDtls: null });
  };

  const fetchImplementation = asFetch(async (input, init = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    if (url.origin !== API_ORIGIN || headers.get("client_id") !== CLIENT_ID
        || headers.get("client_secret") !== CLIENT_SECRET || headers.get("gstin") !== sellerGstin
        || headers.get("content-type") !== "application/json" || init.redirect !== "error"
        || !(init.signal instanceof AbortSignal) || init.signal.aborted) {
      return fail("request origin or credential headers differ");
    }
    if (url.pathname === "/eivital/v1.04/auth") {
      authenticationRequests += 1;
      if (init.method !== "POST" || headers.has("authtoken") || headers.has("user_name")) {
        return fail("authentication request shape differs");
      }
      const outer = JSON.parse(String(init.body)) as { Data?: unknown };
      if (typeof outer.Data !== "string" || Object.keys(outer).length !== 1) return fail("authentication body differs");
      const encoded = rsaPkcs1Decrypt(encryptionPair.privateKey, new Uint8Array(Buffer.from(outer.Data, "base64")));
      const credentialsText = Buffer.from(encoded).toString("utf8");
      const credentials = JSON.parse(Buffer.from(credentialsText, "base64").toString("utf8")) as Record<string, unknown>;
      if (credentials.UserName !== USER_NAME || credentials.Password !== PASSWORD
          || credentials.ForceRefreshAccessToken !== false || typeof credentials.AppKey !== "string"
          || Object.keys(credentials).length !== 4) return fail("authentication credentials differ");
      const appKey = new Uint8Array(Buffer.from(credentials.AppKey, "base64"));
      if (appKey.byteLength !== 32) return fail("AppKey is not 32 bytes");
      const sek = crypto.getRandomValues(new Uint8Array(32));
      const token = `order440-auth-${authenticationRequests}`;
      sessions.set(token, sek);
      return jsonResponse({ Status: 1, Data: { ClientId: CLIENT_ID, UserName: USER_NAME,
        AuthToken: token, Sek: base64(encryptAes(appKey, sek)),
        TokenExpiry: formatUtc(Date.now() + 600_000) }, ErrorDetails: null, InfoDtls: null });
    }

    const token = headers.get("authtoken");
    const sek = token ? sessions.get(token) : undefined;
    if (!sek || headers.get("user_name") !== USER_NAME) return fail("authenticated core headers differ");
    const key = `${documentType}\u0000${documentNumber}\u0000${documentDate}`;
    if (url.pathname === "/eicore/v1.03/Invoice") {
      submissionPosts += 1;
      if (init.method !== "POST") return fail("invoice submission method differs");
      const outer = JSON.parse(String(init.body)) as { Data?: unknown };
      if (typeof outer.Data !== "string" || Object.keys(outer).length !== 1) return fail("invoice body differs");
      const plaintext = decryptAes(sek, new Uint8Array(Buffer.from(outer.Data, "base64")));
      const submitted = new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
      if (submitted !== document.wireJson) return fail("submitted bytes differ from immutable projected wire");
      submittedWireSha256.push(sha256(plaintext));
      if (behavior === "rejected") {
        const errorDetails = new TextEncoder().encode(JSON.stringify([{
          ErrorCode: DEFINITIVE_REJECTION_CODE,
          ErrorMessage: "synthetic detail retained only in the exact provider evidence",
        }]));
        return jsonResponse({ Status: 0, Data: null, ErrorDetails: base64(errorDetails), InfoDtls: null });
      }
      const kind = behavior === "cancelled_after_response_loss" ? "cancelled"
        : behavior === "signed_source_mismatch" ? "mismatch" : "accepted";
      const record = kind === "cancelled" ? Object.freeze({ kind, irn }) : await signedRecord(kind);
      records.set(key, record);
      if (behavior === "accepted_after_response_loss" || behavior === "cancelled_after_response_loss") {
        throw new Error("synthetic response loss after the provider recorded the invoice");
      }
      return encryptedProviderResponse(record, sek);
    }
    if (url.pathname === "/eicore/v1.03/Invoice/irnbydocdetails") {
      documentLookups += 1;
      if (init.method !== "GET" || url.searchParams.get("doctype") !== documentType
          || url.searchParams.get("docnum") !== documentNumber
          || url.searchParams.get("docdate") !== documentDate || [...url.searchParams].length !== 3) {
        return fail("document lookup identity differs");
      }
      const record = records.get(key);
      if (!record) {
        const errorDetails = new TextEncoder().encode(JSON.stringify([{ ErrorCode: NOT_FOUND_CODE }]));
        return jsonResponse({ Status: 0, Data: null, ErrorDetails: base64(errorDetails), InfoDtls: null });
      }
      return encryptedProviderResponse(record, sek);
    }
    return fail("unexpected protocol path");
  });

  return Object.freeze({
    async createRegistration(identity: Order440ClearIrpAdapterIdentity) {
      if (identity.providerKey !== document.providerKey) return fail("adapter identity provider differs");
      const configured = await createClearIrpDirectAdapter(configurationJson, secrets, {
        fetch: fetchImplementation,
        clock: Date.now,
      });
      if (!configured.ok) return fail(`adapter construction failed: ${configured.error.code}`);
      adapterInstances += 1;
      return Object.freeze({
        kind: "registered_verified_india_irp_1_1_adapter" as const,
        providerKey: identity.providerKey,
        providerExtensionId: identity.providerExtensionId,
        providerExtensionVersion: identity.providerExtensionVersion,
        submit: configured.value.submit,
        lookup: configured.value.lookup,
      });
    },
    metrics() {
      return Object.freeze({ adapterInstances, authenticationRequests, submissionPosts, documentLookups,
        submittedWireSha256: Object.freeze([...submittedWireSha256]) });
    },
  });
}
