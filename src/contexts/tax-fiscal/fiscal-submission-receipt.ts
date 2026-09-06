import { types as utilTypes } from "node:util";
import type { Tx } from "../../kernel";
import { FISCAL_SIGNED_JWS_LIMITS } from "./fiscal-signed-jws";

/** Durable evidence contracts. Shape/hash validation is not signature verification;
 * only the authenticated adapter can establish a new provider acceptance. */
export const FISCAL_RECEIPT_PROTOCOL_PROFILE = "clearirp_direct_v1_04_v1_03_v1" as const;
export const FISCAL_RECEIPT_LIMITS = Object.freeze({
  maxRawResponseBytes: 6 * 1024 * 1024,
  maxDecryptedDataBytes: 4 * 1024 * 1024,
  maxEnvelopeBytes: 18 * 1024 * 1024,
} as const);

export interface FiscalReceiptVerification {
  readonly profileVersion: "yellow_native_india_1_1_v1";
  readonly issuer: string;
  readonly verificationUnixMs: number;
  readonly invoiceKeyId: string;
  readonly invoiceKeySpkiSha256: string;
  readonly invoiceBundleVersion: string;
  readonly qrKeyId: string;
  readonly qrKeySpkiSha256: string;
  readonly qrBundleVersion: string;
}

interface FiscalReceiptEvidenceBase {
  readonly version: 1;
  readonly protocolProfile: typeof FISCAL_RECEIPT_PROTOCOL_PROFILE;
  readonly environment: "sandbox" | "production";
  readonly providerKey: string;
  readonly documentId: string;
  readonly documentSha256: string;
  readonly wireSha256: string;
  readonly receivedAtUnixMs: number;
  readonly rawResponseBase64: string;
  readonly decryptedDataBase64: string;
  readonly decryptedDataSha256: string;
}

export interface FiscalAcceptedReceiptEvidence extends FiscalReceiptEvidenceBase {
  readonly kind: "accepted_signed_v1";
  readonly irn: string;
  readonly ackNo: string;
  readonly ackDt: string;
  readonly signedInvoice: string;
  readonly signedInvoiceSha256: string;
  readonly signedQRCode: string;
  readonly signedQrSha256: string;
  readonly verification: Readonly<FiscalReceiptVerification>;
}

export interface FiscalRejectedReceiptEvidence extends FiscalReceiptEvidenceBase {
  readonly kind: "rejected";
  readonly errorCodes: readonly string[];
}

export interface FiscalCancelledReceiptEvidence extends FiscalReceiptEvidenceBase {
  readonly kind: "provider_cancelled";
  readonly providerStatus: "CNL";
}

export type FiscalReceiptEvidence = Readonly<FiscalAcceptedReceiptEvidence
  | FiscalRejectedReceiptEvidence | FiscalCancelledReceiptEvidence>;

const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PROVIDER_KEY = /^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$/;
const BASE_KEYS = ["version", "kind", "protocolProfile", "environment", "providerKey",
  "documentId", "documentSha256", "wireSha256", "receivedAtUnixMs", "rawResponseBase64",
  "decryptedDataBase64", "decryptedDataSha256"] as const;
const VERIFICATION_KEYS = ["profileVersion", "issuer", "verificationUnixMs", "invoiceKeyId",
  "invoiceKeySpkiSha256", "invoiceBundleVersion", "qrKeyId", "qrKeySpkiSha256", "qrBundleVersion"] as const;

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value)) return null;
  try {
    if (Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length > 32 || keys.some(key => typeof key !== "string")) return null;
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
      result[String(key)] = descriptor.value;
    }
    return result;
  } catch { return null; }
}

function exact(row: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(row).length === keys.length && keys.every(key => Object.hasOwn(row, key));
}

function ascii(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && /^[\x20-\x7e]+$/.test(value);
}

function sha(value: unknown): value is string { return typeof value === "string" && SHA256.test(value); }
function epoch(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function hash(value: string | Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function bytes(value: unknown, maximum: number): Uint8Array | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 4 * Math.ceil(maximum / 3)
    || value.length % 4 !== 0) return null;
  // Canonical round-trip rejects alphabet, whitespace, padding and pad-bit aliases.
  // A repeated-quartet regex hits the runtime regex budget on valid 4–6MiB bodies.
  const decoded = Buffer.from(value, "base64");
  if (decoded.length === 0 || decoded.length > maximum || decoded.toString("base64") !== value) return null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(decoded);
    if (text.charCodeAt(0) === 0xfeff) return null;
  } catch { return null; }
  return decoded;
}

function acknowledgementDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(value)
    || value.startsWith("0000")) return false;
  const utc = value.replace(" ", "T") + "Z";
  const date = new Date(utc);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) + "Z" === utc;
}

function compact(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= FISCAL_SIGNED_JWS_LIMITS.maxCompactChars
    && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function verification(value: unknown): Readonly<FiscalReceiptVerification> | null {
  const row = record(value);
  if (!row || !exact(row, VERIFICATION_KEYS) || row.profileVersion !== "yellow_native_india_1_1_v1"
    || !ascii(row.issuer, 128) || !epoch(row.verificationUnixMs)
    || !ascii(row.invoiceKeyId, 256) || !sha(row.invoiceKeySpkiSha256) || !ascii(row.invoiceBundleVersion, 128)
    || !ascii(row.qrKeyId, 256) || !sha(row.qrKeySpkiSha256) || !ascii(row.qrBundleVersion, 128)) return null;
  return Object.freeze({ profileVersion: row.profileVersion, issuer: row.issuer,
    verificationUnixMs: row.verificationUnixMs, invoiceKeyId: row.invoiceKeyId,
    invoiceKeySpkiSha256: row.invoiceKeySpkiSha256, invoiceBundleVersion: row.invoiceBundleVersion,
    qrKeyId: row.qrKeyId, qrKeySpkiSha256: row.qrKeySpkiSha256, qrBundleVersion: row.qrBundleVersion });
}

function codes(value: unknown): readonly string[] | null {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value)) return null;
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value as unknown;
  if (typeof length !== "number" || !Number.isInteger(length) || length < 1 || length > 32
    || Reflect.ownKeys(value).length !== length + 1) return null;
  const result: string[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || !ascii(descriptor.value, 64)
      || result.includes(descriptor.value)) return null;
    result.push(descriptor.value);
  }
  return Object.freeze(result);
}

/** Detached strict validation; never confers provider authenticity. */
export function snapshotFiscalReceiptEvidence(value: unknown, responseSha256: unknown): FiscalReceiptEvidence | null {
  const row = record(value);
  if (!row || !sha(responseSha256) || row.version !== 1 || row.protocolProfile !== FISCAL_RECEIPT_PROTOCOL_PROFILE
    || (row.environment !== "sandbox" && row.environment !== "production")
    || typeof row.providerKey !== "string" || !PROVIDER_KEY.test(row.providerKey)
    || typeof row.documentId !== "string" || !UUID.test(row.documentId)
    || !sha(row.documentSha256) || !sha(row.wireSha256) || !epoch(row.receivedAtUnixMs)
    || !sha(row.decryptedDataSha256)) return null;
  const extra = row.kind === "accepted_signed_v1"
    ? ["irn", "ackNo", "ackDt", "signedInvoice", "signedInvoiceSha256", "signedQRCode", "signedQrSha256", "verification"]
    : row.kind === "rejected" ? ["errorCodes"] : row.kind === "provider_cancelled" ? ["providerStatus"] : null;
  if (!extra || !exact(row, [...BASE_KEYS, ...extra])) return null;
  const raw = bytes(row.rawResponseBase64, FISCAL_RECEIPT_LIMITS.maxRawResponseBytes);
  const decrypted = bytes(row.decryptedDataBase64, FISCAL_RECEIPT_LIMITS.maxDecryptedDataBytes);
  if (!raw || !decrypted || hash(raw) !== responseSha256 || hash(decrypted) !== row.decryptedDataSha256) return null;
  const base: FiscalReceiptEvidenceBase = { version: 1, protocolProfile: FISCAL_RECEIPT_PROTOCOL_PROFILE,
    environment: row.environment, providerKey: row.providerKey, documentId: row.documentId,
    documentSha256: row.documentSha256, wireSha256: row.wireSha256, receivedAtUnixMs: row.receivedAtUnixMs,
    rawResponseBase64: row.rawResponseBase64 as string, decryptedDataBase64: row.decryptedDataBase64 as string,
    decryptedDataSha256: row.decryptedDataSha256 };
  let result: FiscalReceiptEvidence;
  if (row.kind === "rejected") {
    const errorCodes = codes(row.errorCodes);
    if (!errorCodes) return null;
    result = Object.freeze({ ...base, kind: "rejected", errorCodes });
  } else if (row.kind === "provider_cancelled") {
    if (row.providerStatus !== "CNL") return null;
    result = Object.freeze({ ...base, kind: "provider_cancelled", providerStatus: "CNL" });
  } else {
    const verified = verification(row.verification);
    if (!verified || !sha(row.irn) || typeof row.ackNo !== "string" || !/^[1-9][0-9]{0,63}$/.test(row.ackNo)
      || !acknowledgementDate(row.ackDt) || !compact(row.signedInvoice) || !sha(row.signedInvoiceSha256)
      || hash(row.signedInvoice) !== row.signedInvoiceSha256 || !compact(row.signedQRCode)
      || !sha(row.signedQrSha256) || hash(row.signedQRCode) !== row.signedQrSha256) return null;
    result = Object.freeze({ ...base, kind: "accepted_signed_v1", irn: row.irn, ackNo: row.ackNo, ackDt: row.ackDt,
      signedInvoice: row.signedInvoice, signedInvoiceSha256: row.signedInvoiceSha256,
      signedQRCode: row.signedQRCode, signedQrSha256: row.signedQrSha256, verification: verified });
  }
  return new TextEncoder().encode(JSON.stringify(result)).length <= FISCAL_RECEIPT_LIMITS.maxEnvelopeBytes ? result : null;
}

interface FiscalDeliveryReceiptBase {
  readonly submissionId: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly documentId: string;
  readonly documentSha256: string;
  readonly wireSha256: string;
  readonly providerKey: string;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly status: "pending" | "submitted" | "accepted" | "rejected" | "error";
  readonly disposition: "send" | "lookup" | "retry" | "none";
  readonly transitionSeq: number;
}

export type FiscalSubmissionDeliveryReceipt = Readonly<FiscalDeliveryReceiptBase & (
  | { readonly kind: "pending" }
  | { readonly kind: "legacy_hash_only"; readonly authorityRef: string | null; readonly responseSha256: string | null }
  | { readonly kind: "rejected"; readonly environment: "sandbox" | "production";
      readonly responseSha256: string; readonly errorCodes: readonly string[] }
  | { readonly kind: "provider_cancelled"; readonly environment: "sandbox" | "production";
      readonly responseSha256: string; readonly providerStatus: "CNL" }
  | { readonly kind: "accepted_signed_v1"; readonly environment: "sandbox" | "production";
      readonly responseSha256: string; readonly irn: string; readonly ackNo: string; readonly ackDt: string;
      readonly signedInvoice: string; readonly signedQRCode: string; readonly signedInvoiceSha256: string;
      readonly signedQrSha256: string; readonly verification: Readonly<FiscalReceiptVerification> }
)>;

const READ_BASE_KEYS = ["kind", "submissionId", "tenantId", "propertyNode", "documentId", "documentSha256",
  "wireSha256", "providerKey", "attemptId", "attemptNumber", "status", "disposition", "transitionSeq"] as const;

/** Validates only the SQL-authorized public projection; refuses raw artifacts/secrets. */
export function snapshotFiscalSubmissionDeliveryReceipt(value: unknown): FiscalSubmissionDeliveryReceipt | null {
  const row = record(value);
  if (!row || !["submissionId", "tenantId", "propertyNode", "documentId", "attemptId"]
    .every(key => typeof row[key] === "string" && UUID.test(row[key] as string))
    || !sha(row.documentSha256) || !sha(row.wireSha256) || typeof row.providerKey !== "string"
    || !PROVIDER_KEY.test(row.providerKey) || !epoch(row.attemptNumber) || row.attemptNumber < 1
    || row.attemptNumber > 4 || !epoch(row.transitionSeq) || row.transitionSeq < 1) return null;
  const extra = row.kind === "pending" ? [] : row.kind === "legacy_hash_only" ? ["authorityRef", "responseSha256"]
    : row.kind === "rejected" ? ["environment", "responseSha256", "errorCodes"]
    : row.kind === "provider_cancelled" ? ["environment", "responseSha256", "providerStatus"]
    : row.kind === "accepted_signed_v1" ? ["environment", "responseSha256", "irn", "ackNo", "ackDt",
      "signedInvoice", "signedQRCode", "signedInvoiceSha256", "signedQrSha256", "verification"] : null;
  if (!extra || !exact(row, [...READ_BASE_KEYS, ...extra])) return null;
  let details: Record<string, unknown> = {};
  if (row.kind === "pending") {
    if (!((row.status === "pending" && row.disposition === "send")
      || (row.status === "submitted" && row.disposition === "lookup")
      || (row.status === "error" && row.disposition === "retry"))) return null;
  } else {
    if (row.disposition !== "none") return null;
    if (row.kind === "legacy_hash_only") {
      if ((row.status !== "accepted" && row.status !== "rejected")
        || (row.authorityRef !== null && (typeof row.authorityRef !== "string" || row.authorityRef.length < 1
          || row.authorityRef.length > 256 || /[\u0000-\u001f\u007f]/u.test(row.authorityRef)))
        || (row.responseSha256 !== null && !sha(row.responseSha256))) return null;
      details = { authorityRef: row.authorityRef, responseSha256: row.responseSha256 };
    } else {
      if ((row.environment !== "sandbox" && row.environment !== "production") || !sha(row.responseSha256)) return null;
      details = { environment: row.environment, responseSha256: row.responseSha256 };
      if (row.kind === "rejected") {
        const errorCodes = codes(row.errorCodes);
        if (row.status !== "rejected" || !errorCodes) return null;
        details.errorCodes = errorCodes;
      } else if (row.kind === "provider_cancelled") {
        if (row.status !== "error" || row.providerStatus !== "CNL") return null;
        details.providerStatus = "CNL";
      } else {
        const verified = verification(row.verification);
        if (row.status !== "accepted" || !verified || !sha(row.irn) || typeof row.ackNo !== "string"
          || !/^[1-9][0-9]{0,63}$/.test(row.ackNo) || !acknowledgementDate(row.ackDt)
          || !compact(row.signedInvoice) || !compact(row.signedQRCode)
          || !sha(row.signedInvoiceSha256) || !sha(row.signedQrSha256)
          || hash(row.signedInvoice) !== row.signedInvoiceSha256 || hash(row.signedQRCode) !== row.signedQrSha256) return null;
        Object.assign(details, { irn: row.irn, ackNo: row.ackNo, ackDt: row.ackDt,
          signedInvoice: row.signedInvoice, signedQRCode: row.signedQRCode,
          signedInvoiceSha256: row.signedInvoiceSha256, signedQrSha256: row.signedQrSha256, verification: verified });
      }
    }
  }
  const base = Object.fromEntries(READ_BASE_KEYS.map(key => [key, row[key]]));
  return Object.freeze({ ...base, ...details }) as FiscalSubmissionDeliveryReceipt;
}

export type FiscalSubmissionDeliveryReadResult = Readonly<
  | { readonly ok: true; readonly value: FiscalSubmissionDeliveryReceipt | null }
  | { readonly ok: false; readonly error: Readonly<{ readonly code: "invalid_input" | "invalid_receipt" | "database_error";
      readonly message: string }> }
>;

export class FiscalSubmissionReceiptReadService {
  async read(tx: Tx, input: unknown): Promise<FiscalSubmissionDeliveryReadResult> {
    const fail = (code: "invalid_input" | "invalid_receipt" | "database_error"): FiscalSubmissionDeliveryReadResult =>
      Object.freeze({ ok: false, error: Object.freeze({ code, message: "Fiscal delivery receipt could not be read" }) });
    const row = record(input);
    if (!row || !exact(row, ["tenantId", "propertyNode", "submissionId", "actorId"])
      || !Object.values(row).every(value => typeof value === "string" && UUID.test(value))) return fail("invalid_input");
    try {
      const rows = await tx<Array<{ receipt: unknown }>>`
        SELECT read_india_fiscal_submission_delivery_receipt(
          ${row.tenantId as string}::uuid, ${row.propertyNode as string}::uuid,
          ${row.submissionId as string}::uuid, ${row.actorId as string}::uuid
        ) AS receipt
      `;
      if (utilTypes.isProxy(rows) || !Array.isArray(rows)) return fail("invalid_receipt");
      // The SQL driver may attach result metadata. Do not read caller-controlled
      // array properties or require its prototype to be a literal Array prototype.
      const length = Object.getOwnPropertyDescriptor(rows, "length");
      const first = Object.getOwnPropertyDescriptor(rows, "0");
      if (!length || !("value" in length) || length.value !== 1
        || !first || !("value" in first) || !first.enumerable) return fail("invalid_receipt");
      const wrapper = record(first.value);
      if (!wrapper || !exact(wrapper, ["receipt"])) return fail("invalid_receipt");
      if (wrapper.receipt === null) return Object.freeze({ ok: true, value: null });
      const receipt = snapshotFiscalSubmissionDeliveryReceipt(wrapper.receipt);
      if (!receipt || receipt.tenantId !== row.tenantId || receipt.propertyNode !== row.propertyNode
        || receipt.submissionId !== row.submissionId) return fail("invalid_receipt");
      return Object.freeze({ ok: true, value: receipt });
    } catch { return fail("database_error"); }
  }
}
