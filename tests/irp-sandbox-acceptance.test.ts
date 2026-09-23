import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createCipheriv,
  createDecipheriv,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";

import {
  IRP_SANDBOX_AUTHORIZATION_ACKNOWLEDGEMENT,
  runIrpSandboxAcceptance,
  serializeIrpSandboxAcceptance,
} from "../scripts/run-irp-sandbox-acceptance";
import { projectIssuedIndiaIrpWireCandidate } from
  "../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";

const NOW = Date.UTC(2044, 8, 6, 12, 34, 56);
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const ATTEMPT_ID = "00000000-0000-4000-8000-000000000002";
const DOCUMENT_ID = "00000000-0000-4000-8000-000000000461";
const PROVIDER_KEY = "clearirp-direct-order461-synthetic";
const EXTENSION_ID = "00000000-0000-4000-8000-000000000462";
const ISSUER = "YELLOW-ORDER461-SYNTHETIC-IRP";
const KEY_ID = "yellow-order461-synthetic-signing-key";
const ACK_NO = "9223372036854775807";
const ACK_DT = "2044-09-06 12:34:56";
const IRN = "ab".repeat(32);
const DRIFT_IRN = "cd".repeat(32);
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type Mutable = Record<string, any>;
type LookupMode = "accepted" | "drift" | "not_found";

let encryptionPrivateKey: KeyObject;
let encryptionSpki = "";
let signingPair: CryptoKeyPair;
let signingSpki = "";
const temporaryDirectories: string[] = [];

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

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function base64(value: Uint8Array): string {
  return Buffer.from(value).toString("base64");
}

function base64Url(value: Uint8Array): string {
  return base64(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
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

function rsaPkcs1Decrypt(key: KeyObject, ciphertext: Uint8Array): Uint8Array {
  const jwk = key.export({ format: "jwk" });
  if (!jwk.n || !jwk.d) throw new Error("synthetic RSA key is incomplete");
  const modulusBytes = base64UrlBytes(jwk.n).byteLength;
  const encoded = modularPower(bytesBigInt(ciphertext), bytesBigInt(base64UrlBytes(jwk.d)),
    bytesBigInt(base64UrlBytes(jwk.n))).toString(16).padStart(modulusBytes * 2, "0");
  const block = new Uint8Array(Buffer.from(encoded, "hex"));
  const separator = block.indexOf(0, 2);
  if (block[0] !== 0 || block[1] !== 2 || separator < 10) throw new Error("synthetic RSA padding is invalid");
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
    DocDtls: { Typ: "INV", No: "INV/461-1", Dt: "06/09/2044" },
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
  const sourceContentJson = JSON.stringify(source());
  const documentSha256 = hash(sourceContentJson);
  const projected = projectIssuedIndiaIrpWireCandidate({ documentId: DOCUMENT_ID,
    documentSha256, contentJson: sourceContentJson });
  if (!projected.ok) throw new Error(`synthetic projection failed: ${projected.error.code}`);
  return { sourceContentJson, documentSha256, wireJson: projected.value.wireJson,
    wireSha256: projected.value.wireSha256 };
}

async function signPayload(inner: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = base64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT", kid: KEY_ID })));
  const payload = base64Url(encoder.encode(JSON.stringify({ data: inner, iss: ISSUER })));
  const signingInput = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", signingPair.privateKey, encoder.encode(signingInput),
  ));
  return `${signingInput}.${base64Url(signature)}`;
}

async function signedArtifacts(irn: string) {
  const value = issued();
  const invoice = `${value.wireJson.slice(0, -1)},"AckNo":${ACK_NO},"AckDt":"${ACK_DT}","Irn":"${irn}"}`;
  const qr = `{"SellerGstin":"${SELLER_GSTIN}","BuyerGstin":"${BUYER_GSTIN}",` +
    `"DocNo":"INV/461-1","DocTyp":"INV","DocDt":"06/09/2044","TotInvVal":105.00,` +
    `"ItemCnt":1,"MainHsnCode":"996311","Irn":"${irn}"}`;
  const [signedInvoice, signedQRCode] = await Promise.all([signPayload(invoice), signPayload(qr)]);
  return { irn, signedInvoice, signedQRCode };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

function asFetch(implementation: (
  input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1],
) => Promise<Response>): typeof fetch {
  return implementation as typeof fetch;
}

interface HarnessOptions {
  readonly environment?: "sandbox" | "production";
  readonly providerCount?: 1 | 2;
  readonly lookupMode?: LookupMode;
  readonly submitFailure?: "hang" | "throw";
  readonly inputMode?: number;
  readonly documentSha256?: string;
}

async function harness(options: HarnessOptions = {}) {
  const directory = await mkdtemp(join(tmpdir(), "yellow-order461-"));
  temporaryDirectories.push(directory);
  await chmod(directory, 0o700);
  const credentialsPath = join(directory, "credentials.json");
  const manifestPath = join(directory, "providers.json");
  const inputPath = join(directory, "acceptance-input.json");
  const value = issued();
  const accepted = await signedArtifacts(IRN);
  const drift = await signedArtifacts(DRIFT_IRN);
  const trustBundleJson = JSON.stringify({ version: "order461-synthetic-bundle-v1", keys: [{
    id: KEY_ID, spkiDerBase64: signingSpki, notBeforeUnixMs: NOW - 60_000, notAfterUnixMs: NOW + 60_000,
  }] });
  const protocolConfigurationJson = JSON.stringify({
    protocolProfile: "clearirp_direct_v1_04_v1_03_v1",
    providerKey: PROVIDER_KEY,
    environment: options.environment ?? "sandbox",
    apiBaseUrl: "https://order461-clearirp.invalid/",
    encryptionSpkiDerBase64: encryptionSpki,
    issuer: ISSUER,
    profileVersion: "yellow_native_india_1_1_v1",
    trustBundleJson,
    sekEncoding: "raw32",
    tokenExpiryUtcOffsetMinutes: 0,
    definitiveRejectionCodes: ["2150"],
    duplicateCodes: ["2154"],
    notFoundCodes: ["2143"],
  });
  const provider = (id: string) => ({ providerExtensionId: id, providerExtensionVersion: 1,
    protocolConfigurationJson, credentialsFile: credentialsPath });
  const providers = [provider(EXTENSION_ID)];
  if (options.providerCount === 2) providers.push(provider("00000000-0000-4000-8000-000000000463"));
  await writeFile(credentialsPath, JSON.stringify({ clientId: "synthetic-client",
    clientSecret: "synthetic-secret", userName: "synthetic-user", password: "synthetic-password",
    gstin: SELLER_GSTIN }), { mode: 0o600 });
  await writeFile(manifestPath, JSON.stringify({ version: 1, providers }), { mode: 0o600 });
  await writeFile(inputPath, JSON.stringify({
    version: 1,
    authorizationAcknowledgement: IRP_SANDBOX_AUTHORIZATION_ACKNOWLEDGEMENT,
    tenantId: TENANT_ID,
    attemptId: ATTEMPT_ID,
    documentId: DOCUMENT_ID,
    documentSha256: options.documentSha256 ?? value.documentSha256,
    providerKey: PROVIDER_KEY,
    sourceContentJson: value.sourceContentJson,
  }), { mode: options.inputMode ?? 0o600 });
  await chmod(inputPath, options.inputMode ?? 0o600);

  const calls = { authentication: 0, submit: 0, lookup: 0 };
  const sessions = new Map<string, Uint8Array>();
  const response = (record: typeof accepted, sek: Uint8Array) => jsonResponse({ Status: 1,
    Data: base64(encryptAes(sek, new TextEncoder().encode(JSON.stringify({ AckNo: ACK_NO,
      AckDt: ACK_DT, Irn: record.irn, SignedInvoice: record.signedInvoice,
      SignedQRCode: record.signedQRCode, Status: "ACT" })))), ErrorDetails: null, InfoDtls: null });
  const fetchImplementation = asFetch(async (input, init = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    if (url.origin !== "https://order461-clearirp.invalid" || headers.get("client_id") !== "synthetic-client"
        || headers.get("client_secret") !== "synthetic-secret" || headers.get("gstin") !== SELLER_GSTIN
        || !(init.signal instanceof AbortSignal)) throw new Error("synthetic request identity differs");
    if (url.pathname === "/eivital/v1.04/auth") {
      calls.authentication += 1;
      const outer = JSON.parse(String(init.body)) as { Data: string };
      const encoded = rsaPkcs1Decrypt(encryptionPrivateKey, new Uint8Array(Buffer.from(outer.Data, "base64")));
      const credentials = JSON.parse(Buffer.from(Buffer.from(encoded).toString("utf8"), "base64").toString("utf8"));
      if (credentials.UserName !== "synthetic-user" || credentials.Password !== "synthetic-password") {
        throw new Error("synthetic authentication body differs");
      }
      const appKey = new Uint8Array(Buffer.from(credentials.AppKey, "base64"));
      const sek = new Uint8Array(32).fill(calls.authentication);
      const token = `synthetic-token-${calls.authentication}`;
      sessions.set(token, sek);
      return jsonResponse({ Status: 1, Data: { ClientId: "synthetic-client", UserName: "synthetic-user",
        AuthToken: token, Sek: base64(encryptAes(appKey, sek)), TokenExpiry: "2044-09-06 13:34:56" },
      ErrorDetails: null, InfoDtls: null });
    }
    const sek = sessions.get(headers.get("authtoken") ?? "");
    if (!sek || headers.get("user_name") !== "synthetic-user") throw new Error("synthetic session differs");
    if (url.pathname === "/eicore/v1.03/Invoice") {
      calls.submit += 1;
      const outer = JSON.parse(String(init.body)) as { Data: string };
      const wire = new TextDecoder().decode(decryptAes(sek, new Uint8Array(Buffer.from(outer.Data, "base64"))));
      if (init.method !== "POST" || wire !== value.wireJson) throw new Error("synthetic submitted wire differs");
      if (options.submitFailure === "throw") throw new Error("synthetic sensitive transport detail");
      if (options.submitFailure === "hang") {
        return await new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener("abort", () => reject(new Error("synthetic abort")), { once: true });
        });
      }
      return response(accepted, sek);
    }
    if (url.pathname === "/eicore/v1.03/Invoice/irnbydocdetails") {
      calls.lookup += 1;
      if (init.method !== "GET" || url.searchParams.get("doctype") !== "INV"
          || url.searchParams.get("docnum") !== "INV/461-1"
          || url.searchParams.get("docdate") !== "06/09/2044") throw new Error("synthetic lookup differs");
      if (options.lookupMode === "not_found") {
        return jsonResponse({ Status: 0, Data: null,
          ErrorDetails: base64(new TextEncoder().encode(JSON.stringify([{ ErrorCode: "2143" }]))), InfoDtls: null });
      }
      return response(options.lookupMode === "drift" ? drift : accepted, sek);
    }
    throw new Error("unexpected synthetic route");
  });
  return { inputPath, manifestPath, calls, fetchImplementation, value };
}

function invocation(value: Awaited<ReturnType<typeof harness>>, deadlineMs = 5_000) {
  return runIrpSandboxAcceptance({
    authorizationAcknowledged: true,
    inputFile: value.inputPath,
    environment: { YELLOW_INDIA_IRP_PROVIDERS_FILE: value.manifestPath },
    testSeam: { fetch: value.fetchImplementation, clock: () => NOW, deadlineMs },
  });
}

describe("Order461 bounded IRP sandbox acceptance", () => {
  test("import is inert and an absent acknowledgement refuses before input or transport", async () => {
    const child = Bun.spawn([process.execPath, "-e", "await import('./scripts/run-irp-sandbox-acceptance.ts')"], {
      cwd: process.cwd(), stdout: "pipe", stderr: "pipe",
    });
    expect(await child.exited).toBe(0);
    expect(await new Response(child.stdout).text()).toBe("");
    expect(await new Response(child.stderr).text()).toBe("");

    let calls = 0;
    const result = await runIrpSandboxAcceptance({ authorizationAcknowledged: false,
      inputFile: "/path/that/must/not/be/read", environment: {},
      testSeam: { fetch: asFetch(async () => { calls += 1; throw new Error("must not run"); }) } });
    expect(result).toEqual({ ok: false, error: { code: "authorization_required",
      message: "explicit authorization for the configured sandbox taxpayer is required" } });
    expect(calls).toBe(0);
  });

  test("refuses production, ambiguous providers, insecure input and source drift before transport", async () => {
    const cases: Array<readonly [HarnessOptions, string]> = [
      [{ environment: "production" }, "provider_not_sandbox"],
      [{ providerCount: 2 }, "provider_selection_invalid"],
      [{ documentSha256: "0".repeat(64) }, "input_invalid"],
    ];
    // Node cannot attest Windows DACLs; deployment owns that documented prerequisite.
    if (process.platform !== "win32") cases.push([{ inputMode: 0o644 }, "input_insecure"]);
    for (const [options, code] of cases) {
      const value = await harness(options);
      const result = await invocation(value);
      expect(result).toMatchObject({ ok: false, error: { code } });
      expect(value.calls).toEqual({ authentication: 0, submit: 0, lookup: 0 });
    }
  }, 20_000);

  test("accepts one submit and one independently authenticated matching lookup with scoped synthetic proof", async () => {
    const value = await harness();
    const result = await invocation(value);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.code);
    expect(result.value).toMatchObject({
      version: 1,
      kind: "bounded_irp_sandbox_acceptance_v1",
      transportEvidence: "synthetic_injected_transport",
      externalProviderRoundTripEstablished: false,
      providerCertificationClaimed: false,
      databasePersistenceClaimed: false,
      operatorJourneyClaimed: false,
      result: "accepted_matching_submit_and_lookup",
      environment: "sandbox",
      provider: { providerKey: PROVIDER_KEY, providerExtensionId: EXTENSION_ID, providerExtensionVersion: 1 },
      source: { documentId: DOCUMENT_ID, documentSha256: value.value.documentSha256,
        wireSha256: value.value.wireSha256 },
      receipt: { irn: IRN, ackNo: ACK_NO, ackDt: ACK_DT },
    });
    expect(value.calls).toEqual({ authentication: 2, submit: 1, lookup: 1 });
    const output = serializeIrpSandboxAcceptance(result);
    expect(output).toBe(serializeIrpSandboxAcceptance(result));
    expect(output).not.toContain("synthetic-secret");
    expect(output).not.toContain("synthetic-password");
    expect(output).not.toContain("SignedInvoice");
    expect(output).not.toContain("rawResponseBase64");
  }, 20_000);

  test("rejects independently verified lookup identity drift and sanitizes a missing lookup", async () => {
    const drift = await harness({ lookupMode: "drift" });
    expect(await invocation(drift)).toMatchObject({ ok: false, error: { code: "receipt_mismatch" } });
    expect(drift.calls).toEqual({ authentication: 2, submit: 1, lookup: 1 });

    const missing = await harness({ lookupMode: "not_found" });
    const result = await invocation(missing);
    expect(result).toMatchObject({ ok: false, error: { code: "lookup_not_accepted" } });
    const output = serializeIrpSandboxAcceptance(result);
    expect(output).not.toContain("2143");
    expect(output).not.toContain("synthetic-secret");
    expect(missing.calls).toEqual({ authentication: 2, submit: 1, lookup: 1 });
  }, 20_000);

  test("sanitizes transport failure, bounds a hanging submit and never retries or looks up", async () => {
    const thrown = await harness({ submitFailure: "throw" });
    const thrownResult = await invocation(thrown);
    expect(thrownResult).toMatchObject({ ok: false, error: { code: "submit_not_accepted" } });
    expect(serializeIrpSandboxAcceptance(thrownResult)).not.toContain("sensitive transport detail");
    expect(thrown.calls).toEqual({ authentication: 1, submit: 1, lookup: 0 });

    const hanging = await harness({ submitFailure: "hang" });
    const deadlineResult = await invocation(hanging, 500);
    expect(deadlineResult).toMatchObject({ ok: false, error: { code: "deadline_exceeded" } });
    expect(hanging.calls).toEqual({ authentication: 1, submit: 1, lookup: 0 });
  }, 5_000);
});
