import { Buffer } from "node:buffer";
import { SQL } from "bun";
import { copyFile, mkdtemp, readdir, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMigrations } from "../../scripts/migrate";
import { Hs256TokenSigner } from "../../src/contexts/identity";

import { Database } from "../../src/kernel";
import { decodeFiscalExactJson, type FiscalExactJsonValue } from
  "../../src/contexts/tax-fiscal/fiscal-exact-json";
import {
  INDIA_IRP_SIGNED_RECEIPT_PROFILE_VERSION,
  createIndiaIrpSignedReceiptBindingVerifier,
  type IndiaIrpSignedReceiptBindingVerifier,
} from "../../src/contexts/tax-fiscal/india-irp-signed-receipt-binding";
import {
  createFiscalSubmissionHttpScenario,
  fiscalRequest, fiscalRetryRequest, fiscalSubmissionHttpApp, fiscalToken,
  type FiscalSubmissionHttpBody,
  type FiscalSubmissionHttpScenario,
} from "./order440-fiscal-submission-http";

// Retain owned copies for failure diagnosis. Never alter canonical SQL or a ledger.
export async function signedFiscalMigrationCopy(mode: "canonical" | "rollback" | "drift" | "hostile_acl") {
  const directory = await mkdtemp(join(tmpdir(), `yellow-q207-${mode}-`));
  const source = new URL("../../migrations/", import.meta.url);
  const files = (await readdir(source)).filter(name => /^\d{4}_[a-z0-9_-]+\.sql$/u.test(name)
    && Number(name.slice(0, 4)) <= 81).sort();
  if (files.length !== 81 || files.some((name, index) => Number(name.slice(0, 4)) !== index + 1)) {
    throw new Error("Q207 requires the exact contiguous canonical81 prefix");
  }
  await Promise.all(files.map(name => copyFile(new URL(name, source), join(directory, name))));
  const last = join(directory, files[80]!);
  if (mode === "rollback") await appendFile(last,
    "\nDO $reviewer_fault$ BEGIN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Q207 late migration rollback probe'; END $reviewer_fault$;\n");
  if (mode === "drift") await appendFile(last, "\n-- Q207 owned-copy checksum drift probe only\n");
  if (mode === "hostile_acl") await appendFile(last,
    "\nDO $reviewer_acl$ BEGIN IF has_column_privilege('app_role','public.fiscal_submission','wire_text','SELECT') OR has_column_privilege('app_role','public.fiscal_submission_history','response_sha256','SELECT') THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Q207 hostile column grants survived canonical81'; END IF; RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Q207 hostile ACL proof rolls back all migration DDL'; END $reviewer_acl$;\n");
  return { directory, hash: sha256(new Uint8Array(await Bun.file(last).arrayBuffer())),
    run: (databaseUrl: string) => runMigrations({ databaseUrl, migrationsDirectory: directory, logger: () => {} }) };
}

export async function signedFiscalTenantSnapshot(deploy: SQL, tenantId: string): Promise<readonly string[]> {
  const result: string[] = [];
  for (const table of ["fiscal_submission", "fiscal_submission_history", "fact_log", "outbox",
    "document", "document_series", "journal", "posting_line"] as const) {
    const rows = await deploy.unsafe<{ body: string }[]>(
      `SELECT to_jsonb(s)::text AS body FROM public.${table} s WHERE tenant_id=$1::uuid ORDER BY to_jsonb(s)::text`,
      [tenantId]);
    result.push(...rows.map(row => `${table}:${row.body}`));
  }
  return Object.freeze(result);
}

export async function createPre81FiscalHistory(deploy: SQL, runtime: SQL, database: Database,
  outcome: "accepted" | "rejected" | "known_not_sent" | "in_flight" | "pending") {
  const base = await createFiscalSubmissionHttpScenario(deploy, database);
  const tokens = new Hs256TokenSigner("q207-upgrade-review-synthetic-token-secret-48-characters");
  const token = await fiscalToken(tokens, base);
  const app = fiscalSubmissionHttpApp(database, tokens, [base.provider]);
  const requestKey = `q207-upgrade-${crypto.randomUUID()}`;
  const first = await app.handle(fiscalRequest(base, token, requestKey));
  if (first.status !== 201) throw new Error(`Q207 old request failed with HTTP ${first.status}`);
  const requestBytes = await first.text();
  const body = JSON.parse(requestBytes) as FiscalSubmissionHttpBody;
  const scenario: SignedFiscalScenario = { ...base, submissionId: body.fiscalSubmission.submissionId,
    requestIdempotencyKey: requestKey, requestReceipt: body.fiscalSubmission };
  const retries: { key: string; bytes: string }[] = [];
  const legacyResult = (claim: SignedFiscalClaim, terminal: "accepted" | "rejected" | "known_not_sent") => ({
    type: "transport_result", tenantId: claim.tenantId, providerKey: claim.providerKey,
    attemptId: claim.attemptId, documentId: claim.documentId, payloadSha256: claim.wireSha256,
    outcome: terminal, ...(terminal === "known_not_sent" ? {} : {
      authorityRef: `q207-legacy-${terminal}`, responseSha256: sha256(`q207-legacy-${terminal}`),
    }),
  });
  for (let retry = 0; retry < 3; retry++) {
    const claim = await claimSignedFiscalSubmission(runtime, scenario);
    await reconcileSignedFiscalSubmission(runtime, scenario, claim, legacyResult(claim, "known_not_sent"));
    const key = `q207-upgrade-${crypto.randomUUID()}`;
    const response = await app.handle(fiscalRetryRequest(base, token, scenario.submissionId, key));
    if (response.status !== 201) throw new Error(`Q207 old retry failed with HTTP ${response.status}`);
    retries.push({ key, bytes: await response.text() });
  }
  const claim = outcome === "pending" ? undefined : await claimSignedFiscalSubmission(runtime, scenario);
  const result = claim && outcome !== "in_flight" && outcome !== "pending" ? legacyResult(claim, outcome) : undefined;
  if (claim && result) await reconcileSignedFiscalSubmission(runtime, scenario, claim, result);
  return { scenario, outcome, claim, result, requestBytes, retries,
    async replay() {
      const operations = [() => app.handle(fiscalRequest(base, token, requestKey)),
        ...retries.map(retry => () => app.handle(fiscalRetryRequest(base, token, scenario.submissionId, retry.key)))];
      const responses = await Promise.all(Array.from({ length: operations.length * 3 },
        (_, index) => operations[index % operations.length]!()));
      return Promise.all(responses.map(async (response, index) => ({
        status: response.status, cache: response.headers.get("cache-control"),
        replayed: response.headers.get("idempotency-replayed"), bytes: await response.text(),
        expected: [requestBytes, ...retries.map(retry => retry.bytes)][index % operations.length]!,
      })));
    },
  };
}

export const SIGNED_FISCAL_RECEIPT_PROOF_DATABASE_PREFIX = "yellow_order440_q207_";
export const FISCAL_RECEIPT_READ_SCOPE = "tax-fiscal.submissions:read";

const ISSUER = "YELLOW-FICTIONAL-IRP";
const KEY_ID = "yellow-q207-fictional-key";
const BUNDLE_VERSION = "yellow-q207-fictional-bundle-v1";
const VERIFICATION_UNIX_MS = 1_800_000_000_000;
const IRN = "a7".repeat(32);
const ACK_NO = "90071992547409991";
const ACK_DT = "2044-09-07 12:34:56";

function isLoopback(target: URL): boolean {
  const port = Number(target.port);
  return (target.hostname === "127.0.0.1" || target.hostname === "[::1]")
    && /^\d{1,5}$/u.test(target.port) && Number.isInteger(port) && port >= 1 && port <= 65_535;
}

export function assertSignedFiscalReceiptProofTargets(deploy: string, runtime: string): void {
  const targets = [new URL(deploy), new URL(runtime)];
  for (const [index, target] of targets.entries()) {
    if (!/^(?:postgres|postgresql):$/u.test(target.protocol) || target.search !== "" || target.hash !== ""
        || target.password === "" || !isLoopback(target)
        || decodeURIComponent(target.username) !== (index === 0 ? "yellow_deploy" : "yellow_runtime")
        || !new RegExp(`^/${SIGNED_FISCAL_RECEIPT_PROOF_DATABASE_PREFIX}[a-z0-9_]+$`, "u").test(target.pathname)) {
      throw new Error("Signed fiscal receipt proof requires explicit isolated Q207 database authority");
    }
  }
  if (targets[0]!.hostname !== targets[1]!.hostname || targets[0]!.port !== targets[1]!.port
      || targets[0]!.pathname !== targets[1]!.pathname) {
    throw new Error("Signed fiscal receipt proof connections must target the same isolated database");
  }
}

export interface SignedFiscalClaim {
  readonly claimed: true;
  readonly action: "submit" | "lookup";
  readonly claimToken: string;
  readonly submissionId: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly documentId: string;
  readonly documentSha256: string;
  readonly sourceContentJson: string;
  readonly wireSha256: string;
  readonly wireJson: string;
  readonly providerKey: string;
  readonly providerExtensionId: string;
  readonly providerExtensionVersion: number;
  readonly attemptId: string;
  readonly attemptNumber: number;
}

export interface SignedFiscalScenario extends FiscalSubmissionHttpScenario {
  readonly submissionId: string;
  readonly requestIdempotencyKey: string;
  readonly requestReceipt: unknown;
}

type ExactObject = Extract<FiscalExactJsonValue, { readonly kind: "object" }>;
type ExactArray = Extract<FiscalExactJsonValue, { readonly kind: "array" }>;

function sha256(value: Uint8Array | string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function standardBase64(value: Uint8Array): string {
  return Buffer.from(value).toString("base64");
}

function base64Url(value: Uint8Array): string {
  return standardBase64(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function exactObject(value: FiscalExactJsonValue | undefined): ExactObject {
  if (value?.kind !== "object") throw new Error("Q207 synthetic issued wire object is invalid");
  return value;
}

function exactArray(value: FiscalExactJsonValue | undefined): ExactArray {
  if (value?.kind !== "array") throw new Error("Q207 synthetic issued wire array is invalid");
  return value;
}

function exactString(value: FiscalExactJsonValue | undefined): string {
  if (value?.kind !== "string") throw new Error("Q207 synthetic issued wire string is invalid");
  return value.value;
}

function exactNumber(value: FiscalExactJsonValue | undefined): string {
  if (value?.kind !== "number") throw new Error("Q207 synthetic issued wire number is invalid");
  return value.lexeme;
}

async function signPayload(payloadText: string, privateKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const header = base64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT", kid: KEY_ID })));
  const payload = base64Url(encoder.encode(payloadText));
  const input = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", privateKey, encoder.encode(input),
  ));
  return `${input}.${base64Url(signature)}`;
}

async function signInner(inner: string, privateKey: CryptoKey): Promise<string> {
  return signPayload(JSON.stringify({ data: inner, iss: ISSUER }), privateKey);
}

function signedQrInner(wireJson: string): string {
  const decoded = decodeFiscalExactJson(wireJson);
  if (!decoded.ok) throw new Error("Q207 synthetic issued wire could not be decoded");
  const root = exactObject(decoded.value);
  const seller = exactObject(root.members.SellerDtls);
  const buyer = exactObject(root.members.BuyerDtls);
  const document = exactObject(root.members.DocDtls);
  const values = exactObject(root.members.ValDtls);
  const items = exactArray(root.members.ItemList);
  const hsns = new Set(items.items.map(item => exactString(exactObject(item).members.HsnCd)));
  if (hsns.size !== 1) throw new Error("Q207 synthetic fixture requires one unambiguous HSN");
  return `{` + [
    `"SellerGstin":${JSON.stringify(exactString(seller.members.Gstin))}`,
    `"BuyerGstin":${JSON.stringify(exactString(buyer.members.Gstin))}`,
    `"DocNo":${JSON.stringify(exactString(document.members.No))}`,
    `"DocTyp":${JSON.stringify(exactString(document.members.Typ))}`,
    `"DocDt":${JSON.stringify(exactString(document.members.Dt))}`,
    `"TotInvVal":${exactNumber(values.members.TotInvVal)}`,
    `"ItemCnt":${items.items.length}`,
    `"MainHsnCode":${JSON.stringify([...hsns][0]!)}`,
    `"Irn":${JSON.stringify(IRN)}`,
  ].join(",") + `}`;
}

export interface SignedFiscalReceiptFactory {
  accepted(claim: SignedFiscalClaim, type?: "transport_result" | "lookup_result"): Promise<Record<string, unknown>>;
  rejected(claim: SignedFiscalClaim, errorCodes?: readonly string[], type?: "transport_result" | "lookup_result"):
    Record<string, unknown>;
  cancelled(claim: SignedFiscalClaim): Record<string, unknown>;
}

export async function createSignedFiscalReceiptFactory(): Promise<SignedFiscalReceiptFactory> {
  const pair = await crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256",
  }, true, ["sign", "verify"]);
  const spki = standardBase64(new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey)));
  const trustBundleJson = JSON.stringify({ version: BUNDLE_VERSION, keys: [{
    id: KEY_ID, spkiDerBase64: spki,
    notBeforeUnixMs: VERIFICATION_UNIX_MS - 10_000,
    notAfterUnixMs: VERIFICATION_UNIX_MS + 10_000,
  }] });
  const configured = await createIndiaIrpSignedReceiptBindingVerifier(JSON.stringify({
    profileVersion: INDIA_IRP_SIGNED_RECEIPT_PROFILE_VERSION, issuer: ISSUER, trustBundleJson,
  }));
  if (!configured.ok) throw new Error("Q207 synthetic signed receipt verifier configuration failed");
  const verifier: IndiaIrpSignedReceiptBindingVerifier = configured.value;

  const common = (claim: SignedFiscalClaim, kind: string, rawText: string, decryptedText: string) => {
    const raw = new TextEncoder().encode(rawText);
    const decrypted = new TextEncoder().encode(decryptedText);
    return {
      version: 1,
      kind,
      protocolProfile: "clearirp_direct_v1_04_v1_03_v1",
      environment: "sandbox",
      providerKey: claim.providerKey,
      documentId: claim.documentId,
      documentSha256: claim.documentSha256,
      wireSha256: claim.wireSha256,
      receivedAtUnixMs: VERIFICATION_UNIX_MS,
      rawResponseBase64: standardBase64(raw),
      decryptedDataBase64: standardBase64(decrypted),
      decryptedDataSha256: sha256(decrypted),
      responseSha256: sha256(raw),
    };
  };

  return Object.freeze({
    async accepted(
      claim: SignedFiscalClaim,
      type: "transport_result" | "lookup_result" = "transport_result",
    ) {
      const invoiceInner = `${claim.wireJson.slice(0, -1)},"AckNo":${ACK_NO},` +
        `"AckDt":${JSON.stringify(ACK_DT)},"Irn":${JSON.stringify(IRN)}}`;
      const [signedInvoice, signedQRCode] = await Promise.all([
        signInner(invoiceInner, pair.privateKey), signInner(signedQrInner(claim.wireJson), pair.privateKey),
      ]);
      const bound = await verifier.verify({
        documentId: claim.documentId, documentSha256: claim.documentSha256,
        contentJson: claim.sourceContentJson, signedInvoice, signedQRCode,
        irn: IRN, ackNo: ACK_NO, ackDt: ACK_DT,
      }, VERIFICATION_UNIX_MS);
      if (!bound.ok) throw new Error(`Q207 synthetic signed receipt did not bind: ${bound.error.code}`);
      const rawText = JSON.stringify({ Status: "1", Data: "fictional-encrypted-invoice-body" });
      const decryptedText = JSON.stringify({ Irn: IRN, AckNo: ACK_NO, AckDt: ACK_DT, SignedInvoice: signedInvoice,
        SignedQRCode: signedQRCode, Status: "ACT" });
      const values = common(claim, "accepted_signed_v1", rawText, decryptedText);
      const { responseSha256, ...receiptCommon } = values;
      return {
        type, tenantId: claim.tenantId, providerKey: claim.providerKey,
        attemptId: claim.attemptId, documentId: claim.documentId,
        payloadSha256: claim.wireSha256, outcome: "accepted", authorityRef: IRN, responseSha256,
        receipt: {
          ...receiptCommon, irn: IRN, ackNo: ACK_NO, ackDt: ACK_DT,
          signedInvoice, signedInvoiceSha256: bound.value.signedInvoice.compactSha256,
          signedQRCode, signedQrSha256: bound.value.signedQRCode.compactSha256,
          verification: {
            profileVersion: bound.value.profileVersion, issuer: bound.value.issuer,
            verificationUnixMs: bound.value.verificationUnixMs,
            invoiceKeyId: bound.value.signedInvoice.keyId,
            invoiceKeySpkiSha256: bound.value.signedInvoice.keySpkiSha256,
            invoiceBundleVersion: bound.value.signedInvoice.bundleVersion,
            qrKeyId: bound.value.signedQRCode.keyId,
            qrKeySpkiSha256: bound.value.signedQRCode.keySpkiSha256,
            qrBundleVersion: bound.value.signedQRCode.bundleVersion,
          },
        },
      };
    },
    rejected(
      claim: SignedFiscalClaim,
      errorCodes: readonly string[] = ["FICTIONAL-E100"],
      type: "transport_result" | "lookup_result" = "transport_result",
    ) {
      const values = common(claim, "rejected", JSON.stringify({ Status: "0", ErrorDetails: "encrypted" }),
        JSON.stringify({ ErrorCodes: errorCodes }));
      const { responseSha256, ...receiptCommon } = values;
      return {
        type, tenantId: claim.tenantId, providerKey: claim.providerKey,
        attemptId: claim.attemptId, documentId: claim.documentId,
        payloadSha256: claim.wireSha256, outcome: "rejected", responseSha256,
        receipt: { ...receiptCommon, errorCodes: [...errorCodes] },
      };
    },
    cancelled(claim: SignedFiscalClaim) {
      const values = common(claim, "provider_cancelled", JSON.stringify({ Status: "1", Data: "encrypted" }),
        JSON.stringify({ Status: "CNL" }));
      const { responseSha256, ...receiptCommon } = values;
      return {
        type: "lookup_result", tenantId: claim.tenantId, providerKey: claim.providerKey,
        attemptId: claim.attemptId, documentId: claim.documentId,
        payloadSha256: claim.wireSha256, outcome: "provider_cancelled", responseSha256,
        receipt: { ...receiptCommon, providerStatus: "CNL" },
      };
    },
  });
}

export async function createSignedFiscalScenario(
  deploy: SQL, runtime: SQL, database: Database, grantRead = true,
): Promise<SignedFiscalScenario> {
  const scenario = await createFiscalSubmissionHttpScenario(deploy, database);
  if (grantRead) {
    await deploy`INSERT INTO public.role_permission(role_id,permission_code)
      VALUES(${scenario.roleId}::uuid,${FISCAL_RECEIPT_READ_SCOPE}) ON CONFLICT DO NOTHING`;
  }
  const requestIdempotencyKey = `q207-${crypto.randomUUID()}`;
  const requestId = crypto.randomUUID();
  const [row] = await runtime.begin(async tx => {
    await tx`SELECT set_config('app.tenant_id',${scenario.tenantId},true)`;
    await tx.unsafe("SET LOCAL ROLE app_role");
    return tx<{ receipt: unknown }[]>`SELECT public.request_india_fiscal_submission(
      ${scenario.tenantId}::uuid,${scenario.propertyNode}::uuid,${scenario.documentId}::uuid,
      ${scenario.provider.providerExtensionId}::uuid,${scenario.actorId}::uuid,
      ${requestIdempotencyKey},${requestId}::uuid) AS receipt`;
  });
  const receipt = row?.receipt as { submissionId?: unknown } | undefined;
  if (typeof receipt?.submissionId !== "string") throw new Error("Q207 fiscal request did not return a submission");
  return Object.freeze({ ...scenario, submissionId: receipt.submissionId,
    requestIdempotencyKey, requestReceipt: row!.receipt });
}

export async function claimSignedFiscalSubmission(runtime: SQL, scenario: SignedFiscalScenario): Promise<SignedFiscalClaim> {
  const [row] = await runtime.begin(async tx => {
    await tx`SELECT set_config('app.tenant_id',${scenario.tenantId},true)`;
    return tx<{ receipt: unknown }[]>`SELECT public.claim_india_fiscal_submission(
      ${scenario.tenantId}::uuid,${scenario.submissionId}::uuid,60) AS receipt`;
  });
  const claim = row?.receipt as Partial<SignedFiscalClaim> | undefined;
  if (!claim || claim.claimed !== true || (claim.action !== "submit" && claim.action !== "lookup")) {
    throw new Error("Q207 fiscal submission was not claimed");
  }
  return claim as SignedFiscalClaim;
}

export async function reconcileSignedFiscalSubmission(
  runtime: SQL, scenario: SignedFiscalScenario, claim: SignedFiscalClaim, result: Record<string, unknown>,
): Promise<unknown> {
  const [row] = await runtime.begin(async tx => {
    await tx`SELECT set_config('app.tenant_id',${scenario.tenantId},true)`;
    return tx<{ receipt: unknown }[]>`SELECT public.reconcile_india_fiscal_submission(
      ${scenario.tenantId}::uuid,${scenario.submissionId}::uuid,${claim.attemptId}::uuid,
      ${claim.claimToken}::uuid,${JSON.stringify(result)}::jsonb) AS receipt`;
  });
  return row?.receipt;
}

export async function readSignedFiscalReceipt(
  runtime: SQL, input: { readonly tenantId: string; readonly propertyNode: string;
    readonly submissionId: string; readonly actorId: string },
): Promise<unknown> {
  const [row] = await runtime.begin(async tx => {
    await tx`SELECT set_config('app.tenant_id',${input.tenantId},true)`;
    await tx.unsafe("SET LOCAL ROLE app_role");
    return tx<{ receipt: unknown }[]>`SELECT public.read_india_fiscal_submission_delivery_receipt(
      ${input.tenantId}::uuid,${input.propertyNode}::uuid,${input.submissionId}::uuid,
      ${input.actorId}::uuid) AS receipt`;
  });
  return row?.receipt;
}
