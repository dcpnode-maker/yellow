import { beforeAll, describe, expect, test } from "bun:test";
import {
  createCipheriv,
  createDecipheriv,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";

import {
  CLEARIRP_DIRECT_ADAPTER_LIMITS,
  createClearIrpDirectAdapter,
} from "../src/contexts/tax-fiscal/clearirp-direct-adapter";
import type { FiscalDocumentProvider, FiscalProviderResolution } from
  "../src/contexts/tax-fiscal/fiscal-provider";
import { FISCAL_RECEIPT_LIMITS } from "../src/contexts/tax-fiscal/fiscal-submission-receipt";
import { projectIssuedIndiaIrpWireCandidate } from
  "../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";

const NOW = Date.UTC(2044, 8, 6, 12, 34, 56);
const DOCUMENT_ID = "00000000-0000-4000-8000-000000000207";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const ATTEMPT_ID = "00000000-0000-4000-8000-000000000002";
const PROVIDER_KEY = "clearirp-direct-fictional";
const ISSUER = "YELLOW-FICTIONAL-IRP";
const KEY_ID = "yellow-fictional-signing-key";
const IRN = "ab".repeat(32);
const ACK_NO = "9223372036854775807";
const ACK_DT = "2044-09-06 12:34:56";
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type Mutable = Record<string, any>;

let encryptionPrivateKey: KeyObject;
let encryptionSpki = "";
let signingPair: CryptoKeyPair;
let signingSpki = "";

function testFetch(
  implementation: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<Response>,
): typeof fetch {
  return implementation as typeof fetch;
}

beforeAll(async () => {
  const encryption = generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 0x10001 });
  encryptionPrivateKey = encryption.privateKey;
  encryptionSpki = encryption.publicKey.export({ format: "der", type: "spki" }).toString("base64");
  signingPair = await crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256",
  }, true, ["sign", "verify"]);
  signingSpki = base64(new Uint8Array(await crypto.subtle.exportKey("spki", signingPair.publicKey)));
}, 30_000);

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function base64Url(bytes: Uint8Array): string {
  return base64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64"));
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

/** Test-side raw RSA operation: Bun deliberately disables privateDecrypt with v1.5 padding. */
function rsaPkcs1Decrypt(key: KeyObject, ciphertext: Uint8Array): Uint8Array {
  const jwk = key.export({ format: "jwk" });
  if (!jwk.n || !jwk.d) throw new Error("test RSA key is incomplete");
  const modulusBytes = base64UrlBytes(jwk.n).byteLength;
  const encoded = modularPower(bytesBigInt(ciphertext), bytesBigInt(base64UrlBytes(jwk.d)),
    bytesBigInt(base64UrlBytes(jwk.n))).toString(16).padStart(modulusBytes * 2, "0");
  const block = new Uint8Array(Buffer.from(encoded, "hex"));
  if (block[0] !== 0 || block[1] !== 2) throw new Error("test RSA padding header is invalid");
  const separator = block.indexOf(0, 2);
  if (separator < 10) throw new Error("test RSA padding separator is invalid");
  for (let index = 2; index < separator; index += 1) {
    if (block[index] === 0) throw new Error("test RSA padding is invalid");
  }
  return block.slice(separator + 1);
}

function hash(value: string | Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function gstin(body: string): string {
  let factor = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const product = factor * GST_ALPHABET.indexOf(body[index]!);
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(product / 36) + product % 36;
  }
  return body + GST_ALPHABET[(36 - sum % 36) % 36]!;
}

const SELLER_GSTIN = gstin("29ABCDE1234F1Z");
const BUYER_GSTIN = gstin("27FGHIJ5678K1Z");

function source(): Mutable {
  return {
    Version: "1.1",
    TranDtls: { TaxSch: "GST", SupTyp: "B2B" },
    DocDtls: { Typ: "INV", No: "INV/207-1", Dt: "06/09/2044" },
    SellerDtls: { Gstin: SELLER_GSTIN, LglNm: "Fictional Yellow Hotel", Addr1: "1 Test Road",
      Loc: "Bengaluru", Pin: 560001, Stcd: "29" },
    BuyerDtls: { Gstin: BUYER_GSTIN, LglNm: "Fictional Buyer", Addr1: "2 Test Road",
      Loc: "Mumbai", Pin: 400001, Stcd: "27", Pos: "27" },
    ItemList: [{ SlNo: "1", IsServc: "Y", HsnCd: "996311", Qty: "1.000", Unit: "OTH",
      UnitPrice: "100.00", TotAmt: "100.00", AssAmt: "100.00", GstRt: "5.00",
      IgstAmt: "5.00", TotItemVal: "105.00" }],
    ValDtls: { AssVal: "100.00", IgstVal: "5.00", TotInvVal: "105.00" },
  };
}

function issued() {
  const contentJson = JSON.stringify(source());
  const documentSha256 = hash(contentJson);
  const projected = projectIssuedIndiaIrpWireCandidate({ documentId: DOCUMENT_ID, documentSha256, contentJson });
  if (!projected.ok) throw new Error(`fixture projection failed: ${projected.error.code}`);
  return { contentJson, documentSha256, wireJson: projected.value.wireJson,
    wireSha256: projected.value.wireSha256 };
}

function trustBundle(): string {
  return JSON.stringify({ version: "fictional-bundle-v1", keys: [{
    id: KEY_ID, spkiDerBase64: signingSpki, notBeforeUnixMs: NOW - 60_000, notAfterUnixMs: NOW + 60_000,
  }] });
}

function configuration(overrides: Mutable = {}): string {
  return JSON.stringify({
    protocolProfile: "clearirp_direct_v1_04_v1_03_v1",
    providerKey: PROVIDER_KEY,
    environment: "sandbox",
    apiBaseUrl: "https://fictional.clearirp.invalid/",
    encryptionSpkiDerBase64: encryptionSpki,
    issuer: ISSUER,
    profileVersion: "yellow_native_india_1_1_v1",
    trustBundleJson: trustBundle(),
    sekEncoding: "raw32",
    tokenExpiryUtcOffsetMinutes: 330,
    definitiveRejectionCodes: ["2150"],
    duplicateCodes: ["2154"],
    notFoundCodes: ["2143"],
    ...overrides,
  });
}

function secrets(overrides: Mutable = {}) {
  return { clientId: "fictional-client", clientSecret: "fictional-secret", userName: "fictional-user",
    password: "fictional-password", gstin: SELLER_GSTIN, ...overrides };
}

function submission(overrides: Mutable = {}) {
  const value = issued();
  return Object.freeze({ tenantId: TENANT_ID, providerKey: PROVIDER_KEY, attemptId: ATTEMPT_ID,
    documentId: DOCUMENT_ID, payloadSha256: value.wireSha256,
    payload: new TextEncoder().encode(value.wireJson), documentSha256: value.documentSha256,
    sourceContentJson: value.contentJson, ...overrides });
}

function context(deadlineUnixMs = NOW + 5_000, signal = new AbortController().signal) {
  return Object.freeze({ signal, deadlineUnixMs });
}

function encryptAes(key: Uint8Array, bytes: Uint8Array): Uint8Array {
  const cipher = createCipheriv("aes-256-ecb", key, null);
  return new Uint8Array(Buffer.concat([cipher.update(bytes), cipher.final()]));
}

function decryptAes(key: Uint8Array, bytes: Uint8Array): Uint8Array {
  const decipher = createDecipheriv("aes-256-ecb", key, null);
  return new Uint8Array(Buffer.concat([decipher.update(bytes), decipher.final()]));
}

async function signPayload(payloadText: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = base64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT", kid: KEY_ID })));
  const payload = base64Url(encoder.encode(payloadText));
  const signingInput = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", signingPair.privateKey, encoder.encode(signingInput),
  ));
  return `${signingInput}.${base64Url(signature)}`;
}

async function signedArtifacts(changedCent = false) {
  const value = issued();
  const sourceValue = source();
  const invoice = `${value.wireJson.slice(0, -1)},"AckNo":${ACK_NO},"AckDt":"${ACK_DT}","Irn":"${IRN}"}`;
  const total = changedCent ? "105.01" : sourceValue.ValDtls.TotInvVal;
  const qr = `{"SellerGstin":${JSON.stringify(SELLER_GSTIN)},"BuyerGstin":${JSON.stringify(BUYER_GSTIN)},` +
    `"DocNo":${JSON.stringify(sourceValue.DocDtls.No)},"DocTyp":"INV","DocDt":"06/09/2044",` +
    `"TotInvVal":${total},"ItemCnt":1,"MainHsnCode":"996311","Irn":"${IRN}"}`;
  return Promise.all([
    signPayload(JSON.stringify({ data: invoice, iss: ISSUER })),
    signPayload(JSON.stringify({ data: qr, iss: ISSUER })),
  ]).then(([signedInvoice, signedQRCode]) => ({ signedInvoice, signedQRCode }));
}

interface ProtocolOptions {
  readonly coreKind?: "accepted" | "cancelled" | "rejected" | "duplicate" | "not_found" | "mixed";
  readonly badSignature?: boolean;
  readonly changedCent?: boolean;
  readonly sekEncoding?: "raw32" | "base64-text32";
  readonly authExpiry?: string;
  readonly rawCoreBody?: string;
  readonly coreContentLength?: string;
  readonly coreDecryptedBytes?: number;
  readonly coreResponseBytes?: number;
}

async function protocol(options: ProtocolOptions = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const sek = new Uint8Array(32).fill(7);
  let exactCoreBody = "";
  const artifacts = await signedArtifacts(options.changedCent);
  if (options.badSignature) {
    const segments = artifacts.signedInvoice.split(".");
    const signature = segments[2]!;
    segments[2] = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    artifacts.signedInvoice = segments.join(".");
  }
  const fetchImplementation = testFetch(async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const headers = new Headers(init.headers);
    expect(headers.get("client_id")).toBe("fictional-client");
    expect(headers.get("client_secret")).toBe("fictional-secret");
    expect(headers.get("gstin")).toBe(SELLER_GSTIN);
    if (url.endsWith("/eivital/v1.04/auth")) {
      const outer = JSON.parse(String(init.body)) as { Data: string };
      const encodedCredentials = rsaPkcs1Decrypt(encryptionPrivateKey, Buffer.from(outer.Data, "base64"));
      const credentials = JSON.parse(Buffer.from(Buffer.from(encodedCredentials).toString("utf8"), "base64").toString("utf8"));
      expect(credentials).toEqual({ UserName: "fictional-user", Password: "fictional-password",
        AppKey: expect.any(String), ForceRefreshAccessToken: false });
      const appKey = new Uint8Array(Buffer.from(credentials.AppKey, "base64"));
      const sekPlain = options.sekEncoding === "base64-text32"
        ? new TextEncoder().encode(base64(sek)) : sek;
      const authBody = JSON.stringify({ Status: 1, Data: { ClientId: "fictional-client",
        UserName: "fictional-user", AuthToken: "fictional-auth-token",
        Sek: base64(encryptAes(appKey, sekPlain)),
        TokenExpiry: options.authExpiry ?? "2044-09-06 18:05:56" }, ErrorDetails: null, InfoDtls: null });
      return new Response(authBody, { headers: { "content-type": "application/json" } });
    }
    expect(headers.get("user_name")).toBe("fictional-user");
    expect(headers.get("authtoken")).toBe("fictional-auth-token");
    if (init.method === "POST") {
      const encrypted = Buffer.from((JSON.parse(String(init.body)) as { Data: string }).Data, "base64");
      expect(new TextDecoder().decode(decryptAes(sek, encrypted))).toBe(issued().wireJson);
    } else {
      const parsed = new URL(url);
      expect(parsed.pathname).toBe("/eicore/v1.03/Invoice/irnbydocdetails");
      expect([...parsed.searchParams.entries()]).toEqual([
        ["doctype", "INV"], ["docnum", "INV/207-1"], ["docdate", "06/09/2044"],
      ]);
    }
    let body: string;
    const coreKind = options.coreKind ?? "accepted";
    if (coreKind === "rejected" || coreKind === "duplicate" || coreKind === "not_found" || coreKind === "mixed") {
      const codes = coreKind === "rejected" ? ["2150"] : coreKind === "duplicate" ? ["2154"]
        : coreKind === "not_found" ? ["2143"] : ["2150", "9999"];
      const errorBytes = new TextEncoder().encode(JSON.stringify(codes.map((ErrorCode) => ({ ErrorCode,
        ErrorMessage: "not retained as operator output" }))));
      body = JSON.stringify({ Status: 0, Data: null, ErrorDetails: base64(errorBytes), InfoDtls: null });
    } else {
      let data = coreKind === "cancelled"
        ? JSON.stringify({ Irn: IRN, Status: "CNL" })
        : `{"AckNo":${ACK_NO},"AckDt":"${ACK_DT}","Irn":"${IRN}",` +
          `"SignedInvoice":${JSON.stringify(artifacts.signedInvoice)},` +
          `"SignedQRCode":${JSON.stringify(artifacts.signedQRCode)},"Status":"ACT"}`;
      if (options.coreDecryptedBytes !== undefined) data = data.padEnd(options.coreDecryptedBytes, " ");
      body = JSON.stringify({ Status: 1, Data: base64(encryptAes(sek, new TextEncoder().encode(data))),
        ErrorDetails: null, InfoDtls: null });
    }
    exactCoreBody = options.rawCoreBody ?? body;
    if (options.coreResponseBytes !== undefined) exactCoreBody = exactCoreBody.padEnd(options.coreResponseBytes, " ");
    return new Response(exactCoreBody, { headers: { "content-type": "application/json",
      ...(options.coreContentLength ? { "content-length": options.coreContentLength } : {}) } });
  });
  return { calls, fetchImplementation, get exactCoreBody() { return exactCoreBody; } };
}

async function adapter(fetchImplementation: typeof fetch, sekEncoding: "raw32" | "base64-text32" = "raw32") {
  const result = await createClearIrpDirectAdapter(configuration({ sekEncoding }), secrets(),
    { fetch: fetchImplementation, clock: () => NOW });
  if (!result.ok) throw new Error(`adapter factory failed: ${result.error.code}`);
  return result.value;
}

function outcome(result: FiscalProviderResolution): string { return result.outcome; }

describe("Order440/Q207 direct ClearIRP transport", () => {
  test("accepts genuinely signed responses at the admitted decoded and raw byte ceilings", async () => {
    for (const options of [
      { coreDecryptedBytes: FISCAL_RECEIPT_LIMITS.maxDecryptedDataBytes - 1 },
      { coreDecryptedBytes: FISCAL_RECEIPT_LIMITS.maxDecryptedDataBytes },
      { coreResponseBytes: FISCAL_RECEIPT_LIMITS.maxRawResponseBytes },
    ]) {
      const server = await protocol(options);
      const result = await (await adapter(server.fetchImplementation)).submit(submission(), context(NOW + 20_000));
      expect(outcome(result)).toBe("accepted");
      if (result.outcome !== "accepted" || !("receipt" in result)) throw new Error("expected bounded signed acceptance");
      if (options.coreDecryptedBytes !== undefined) {
        expect(Buffer.from(result.receipt.decryptedDataBase64, "base64").byteLength).toBe(options.coreDecryptedBytes);
      }
      if (options.coreResponseBytes !== undefined) {
        expect(Buffer.from(result.receipt.rawResponseBase64, "base64").byteLength).toBe(options.coreResponseBytes);
      }
      expect(result.responseSha256).toBe(hash(server.exactCoreBody));
    }
  }, 60_000);

  test("deadline cannot be held hostage by an oversized body's unending stream cancellation", async () => {
    const authenticated = await protocol();
    let cancellations = 0;
    const streamFetch = testFetch(async (input, init) => {
      if (String(input).endsWith("/auth")) return authenticated.fetchImplementation(input, init);
      const body = new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new Uint8Array(FISCAL_RECEIPT_LIMITS.maxRawResponseBytes + 1)); },
        cancel() { cancellations += 1; return new Promise<void>(() => undefined); },
      });
      return new Response(body, { headers: { "content-type": "application/json" } });
    });
    const provider = await adapter(streamFetch);
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        provider.submit(submission(), context(NOW + 25)),
        new Promise<"unbounded-cancellation">((resolve) => {
          deadline = setTimeout(() => resolve("unbounded-cancellation"), 1_000);
        }),
      ]);
      expect(result).not.toBe("unbounded-cancellation");
      if (typeof result !== "string") expect(outcome(result)).toBe("timeout");
      expect(cancellations).toBe(1);
    } finally { if (deadline !== undefined) clearTimeout(deadline); }
  }, 5_000);

  test("rejects one byte beyond each admitted response ceiling without a resend", async () => {
    for (const options of [
      { coreDecryptedBytes: FISCAL_RECEIPT_LIMITS.maxDecryptedDataBytes + 1 },
      { coreResponseBytes: FISCAL_RECEIPT_LIMITS.maxRawResponseBytes + 1 },
    ]) {
      const server = await protocol(options);
      const result = await (await adapter(server.fetchImplementation)).submit(submission(), context(NOW + 20_000));
      expect(outcome(result)).toBe("timeout");
      expect(server.calls.filter((call) => new URL(call.url).pathname === "/eicore/v1.03/Invoice"))
        .toHaveLength(1);
    }
  }, 60_000);

  test("deadline also bounds a hanging reader read and consumes cancellation rejection", async () => {
    const authenticated = await protocol();
    let cancellations = 0;
    const streamFetch = testFetch(async (input, init) => {
      if (String(input).endsWith("/auth")) return authenticated.fetchImplementation(input, init);
      const body = new ReadableStream<Uint8Array>({
        pull() { return new Promise<void>(() => undefined); },
        cancel() { cancellations += 1; return Promise.reject(new Error("synthetic cancellation rejection")); },
      });
      return new Response(body, { headers: { "content-type": "application/json" } });
    });
    let outerDeadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        (await adapter(streamFetch)).submit(submission(), context(NOW + 25)),
        new Promise<"unbounded-read">((resolve) => {
          outerDeadline = setTimeout(() => resolve("unbounded-read"), 1_000);
        }),
      ]);
      expect(result).not.toBe("unbounded-read");
      if (typeof result !== "string") expect(outcome(result)).toBe("timeout");
      expect(cancellations).toBe(1);
      await Promise.resolve();
    } finally { if (outerDeadline !== undefined) clearTimeout(outerDeadline); }
  }, 5_000);

  test("disposes failed-status and redirected response bodies without awaiting hostile cancellation", async () => {
    for (const responseKind of ["failed_status", "redirected"] as const) {
      const authenticated = await protocol();
      let cancellations = 0;
      const fetchImplementation = testFetch(async (input, init) => {
        if (String(input).endsWith("/auth")) return authenticated.fetchImplementation(input, init);
        const body = new ReadableStream<Uint8Array>({
          start(controller) { controller.enqueue(new TextEncoder().encode("not processed")); },
          cancel() { cancellations += 1; return Promise.reject(new Error("synthetic disposal rejection")); },
        });
        const response = new Response(body, { status: responseKind === "failed_status" ? 503 : 200,
          headers: { "content-type": "application/json" } });
        if (responseKind === "redirected") Object.defineProperty(response, "redirected", { value: true });
        return response;
      });
      const started = performance.now();
      const result = await (await adapter(fetchImplementation)).submit(submission(), context(NOW + 2_000));
      expect(outcome(result)).toBe("timeout");
      expect(performance.now() - started).toBeLessThan(1_000);
      expect(cancellations).toBe(1);
      await Promise.resolve();
    }
  }, 5_000);

  test("authenticates, encrypts exact original wire and accepts only genuine bound signed artifacts", async () => {
    const server = await protocol();
    const provider = await adapter(server.fetchImplementation);
    const result = await provider.submit(submission(), context());
    expect(outcome(result)).toBe("accepted");
    if (result.outcome !== "accepted" || !("receipt" in result)) throw new Error("expected signed acceptance");
    expect(result.authorityRef).toBe(IRN);
    expect(result.responseSha256).toBe(hash(server.exactCoreBody));
    expect(result.receipt).toMatchObject({
      version: 1, kind: "accepted_signed_v1", protocolProfile: "clearirp_direct_v1_04_v1_03_v1",
      environment: "sandbox", providerKey: PROVIDER_KEY, documentId: DOCUMENT_ID,
      documentSha256: issued().documentSha256, wireSha256: issued().wireSha256,
      receivedAtUnixMs: NOW, irn: IRN, ackNo: ACK_NO, ackDt: ACK_DT,
      verification: { profileVersion: "yellow_native_india_1_1_v1", issuer: ISSUER,
        verificationUnixMs: NOW, invoiceKeyId: KEY_ID, qrKeyId: KEY_ID },
    });
    expect(Buffer.from(result.receipt.rawResponseBase64, "base64").toString()).toBe(server.exactCoreBody);
    expect(hash(result.receipt.signedInvoice)).toBe(result.receipt.signedInvoiceSha256);
    expect(hash(result.receipt.signedQRCode)).toBe(result.receipt.signedQrSha256);
    expect(JSON.stringify(result)).not.toContain("fictional-password");
    expect(server.calls.map((call) => [new URL(call.url).pathname, call.init.method])).toEqual([
      ["/eivital/v1.04/auth", "POST"], ["/eicore/v1.03/Invoice", "POST"],
    ]);
  }, 20_000);

  test("fresh lookup authenticates independently, uses immutable document details and records CNL discrepancy", async () => {
    const first = await protocol({ coreKind: "accepted" });
    expect(outcome(await (await adapter(first.fetchImplementation)).submit(submission(), context()))).toBe("accepted");
    const fresh = await protocol({ coreKind: "cancelled", sekEncoding: "base64-text32" });
    const result = await (await adapter(fresh.fetchImplementation, "base64-text32")).lookup(submission(), context());
    expect(outcome(result)).toBe("provider_cancelled");
    if (result.outcome !== "provider_cancelled") throw new Error("expected provider cancellation");
    expect(result.receipt.providerStatus).toBe("CNL");
    expect(fresh.calls).toHaveLength(2);
    expect(fresh.calls.filter((call) => call.init.method === "POST")).toHaveLength(1);
    expect(new URL(fresh.calls[1]!.url).pathname).toEndWith("/irnbydocdetails");
  }, 20_000);

  test("retains exact definitive error bytes but never turns duplicate, not-found or mixed codes into rejection", async () => {
    for (const [kind, expected] of [["rejected", "rejected"], ["duplicate", "duplicate"],
      ["not_found", "timeout"], ["mixed", "timeout"]] as const) {
      const server = await protocol({ coreKind: kind });
      const result = await (await adapter(server.fetchImplementation)).submit(submission(), context());
      expect(outcome(result)).toBe(expected);
      expect(server.calls.filter((call) => new URL(call.url).pathname === "/eicore/v1.03/Invoice")).toHaveLength(1);
      if (kind === "rejected") {
        if (result.outcome !== "rejected" || !("receipt" in result)) throw new Error("expected rejection receipt");
        expect(result).not.toHaveProperty("authorityRef");
        expect(result.receipt.errorCodes).toEqual(["2150"]);
        expect(Buffer.from(result.receipt.rawResponseBase64, "base64").toString()).toBe(server.exactCoreBody);
        expect(Buffer.from(result.receipt.decryptedDataBase64, "base64").toString()).toContain("ErrorCode");
      }
    }
  }, 20_000);

  test("does not accept bad signatures or exact changed-cent signed values", async () => {
    for (const options of [{ badSignature: true }, { changedCent: true }]) {
      const server = await protocol(options);
      const provider = await adapter(server.fetchImplementation);
      expect(outcome(await provider.submit(submission(), context()))).toBe("timeout");
    }
  }, 20_000);

  test("authentication expiry and failure are known-not-sent for submit but uncertain for lookup", async () => {
    const expired = await protocol({ authExpiry: "2044-09-06 18:04:56" });
    const provider = await adapter(expired.fetchImplementation);
    expect(outcome(await provider.submit(submission(), context()))).toBe("known_not_sent");
    expect(outcome(await provider.lookup(submission(), context()))).toBe("pending");
    expect(expired.calls.every((call) => call.url.endsWith("/auth"))).toBe(true);
  });

  test("validates source/hash/wire/provider/GSTIN before authentication", async () => {
    let calls = 0;
    const provider = await adapter(testFetch(async () => { calls += 1; throw new Error("must not run"); }));
    const valid = submission();
    const cases = [
      submission({ providerKey: "other-provider" }),
      submission({ payloadSha256: "0".repeat(64) }),
      submission({ payload: new TextEncoder().encode(`${issued().wireJson} `) }),
      submission({ documentSha256: "0".repeat(64) }),
      submission({ sourceContentJson: `${valid.sourceContentJson} ` }),
    ];
    for (const candidate of cases) expect(outcome(await provider.submit(candidate, context()))).toBe("known_not_sent");
    expect(calls).toBe(0);
  });

  test("honors pre-abort/deadline and bounds streamed response bodies without a resend", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    const provider = await adapter(testFetch(async () => { calls += 1; return new Response("{}"); }));
    expect(outcome(await provider.submit(submission(), context(NOW + 100, controller.signal)))).toBe("known_not_sent");
    expect(calls).toBe(0);

    const oversized = await protocol({ coreContentLength: String(FISCAL_RECEIPT_LIMITS.maxRawResponseBytes + 1) });
    expect(outcome(await (await adapter(oversized.fetchImplementation)).submit(submission(), context()))).toBe("timeout");
    expect(oversized.calls).toHaveLength(2);

    const authenticated = await protocol();
    const hangingFetch = testFetch(async (input, init) => {
      if (String(input).endsWith("/auth")) return authenticated.fetchImplementation(input, init);
      authenticated.calls.push({ url: String(input), init: init ?? {} });
      return await new Promise<Response>(() => undefined);
    });
    const started = performance.now();
    expect(outcome(await (await adapter(hangingFetch)).submit(submission(), context(NOW + 25)))).toBe("timeout");
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(authenticated.calls.filter((call) => new URL(call.url).pathname === "/eicore/v1.03/Invoice"))
      .toHaveLength(1);
  });

  test("rejects duplicate/malformed response JSON and never promotes it to authority", async () => {
    const duplicate = await protocol({ rawCoreBody: '{"Status":1,"Status":1,"Data":"AAAA"}' });
    expect(outcome(await (await adapter(duplicate.fetchImplementation)).submit(submission(), context()))).toBe("timeout");
    expect(duplicate.calls).toHaveLength(2);
  });

  test("requires every explicit immutable configuration field and sanitized exact secrets", async () => {
    const fetchImplementation = testFetch(async () => { throw new Error("offline"); });
    for (const input of [
      undefined,
      {},
      configuration({ apiBaseUrl: "http://fictional.clearirp.invalid/" }),
      configuration({ tokenExpiryUtcOffsetMinutes: 841 }),
      configuration({ definitiveRejectionCodes: ["2154"] }),
      configuration({ protocolProfile: "other" }),
      "{" + '"protocolProfile":"clearirp_direct_v1_04_v1_03_v1","protocolProfile":"x"' + "}",
      `"${"x".repeat(CLEARIRP_DIRECT_ADAPTER_LIMITS.maxConfigurationUtf8Bytes)}"`,
    ]) {
      const result = await createClearIrpDirectAdapter(input, secrets(), { fetch: fetchImplementation, clock: () => NOW });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain("fictional-password");
    }
    const accessor = { clientId: "fictional-client", clientSecret: "fictional-secret", userName: "fictional-user",
      gstin: SELLER_GSTIN } as Mutable;
    Object.defineProperty(accessor, "password", { enumerable: true, get: () => "fictional-password" });
    const invalidSecret = await createClearIrpDirectAdapter(configuration(), accessor,
      { fetch: fetchImplementation, clock: () => NOW });
    expect(invalidSecret).toEqual({ ok: false,
      error: { code: "invalid_secrets", message: "ClearIRP direct adapter secrets are invalid" } });
  }, 20_000);
});
