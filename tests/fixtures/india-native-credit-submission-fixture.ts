import { SQL } from "bun";
import { createAuditEnvelope, Database, type Tx } from "../../src/kernel";
import { IssueIndiaNativeFiscalCreditNoteCommand } from "../../src/commands/issue-india-native-fiscal-credit-note";
import { createCreditFixture, type CreditFixture } from "./india-native-fiscal-credit-note-fixture";
import type { FiscalSubmissionHttpScenario } from "./order440-fiscal-submission-http";

export const CREDIT_SUBMISSION_DRAFT = new URL("../../handoff/drafts/order447/0088_native_credit_fiscal_submission.sql", import.meta.url);
export const CREDIT_SUBMISSION_CANONICAL = new URL("../../migrations/0088_native_credit_fiscal_submission.sql", import.meta.url);
export const CREDIT_SUBMISSION_PROJECTOR = "public.india_fiscal_submission_project_wire(uuid,uuid,uuid)";
export type CreditSubmissionTargetMode = "native-draft" | "ci-canonical";

export function parseCreditSubmissionTargetMode(value: string | undefined): CreditSubmissionTargetMode {
  if (value === "native-draft" || value === "ci-canonical") return value;
  throw new Error("Order447 requires an explicit native-draft or ci-canonical target mode");
}

export function creditSubmissionMigration(mode: CreditSubmissionTargetMode): URL {
  return mode === "native-draft" ? CREDIT_SUBMISSION_DRAFT : CREDIT_SUBMISSION_CANONICAL;
}

/** This validates identities; it does NOT grant database execution authority.
 * Root must separately admit a particular retained target and frozen draft hash.
 */
export function assertCreditSubmissionTargets(deploy: string, runtime: string, purpose: "runtime" | "rollback",
  mode: CreditSubmissionTargetMode, ciCanonicalAdmitted = false, ciDatabaseAddress?: string): void {
  const targets = [new URL(deploy), new URL(runtime)];
  const name = mode === "native-draft"
    ? (purpose === "rollback" ? "yellow_order446_referee87_20260907" : "yellow_order446_credit_upgrade_20260907")
    : (purpose === "rollback" ? "yellow_order447_upgrade87_ci" : "yellow_order447_current88_ci");
  if (mode === "ci-canonical" && !ciCanonicalAdmitted) {
    throw new Error("Order447 canonical CI target requires explicit admission");
  }
  if (mode === "ci-canonical" && !ciDatabaseAddress) {
    throw new Error("Order447 canonical CI target requires its resolved database address");
  }
  targets.forEach((url, index) => {
    const nativeIdentity = mode === "native-draft" && url.hostname === "127.0.0.1" && url.port === "55503";
    const ciIdentity = mode === "ci-canonical" && url.hostname.length > 0 && /^\d+$/.test(url.port)
      && Number(url.port) >= 1 && Number(url.port) <= 65_535 && url.port !== "55503";
    if (!["postgres:", "postgresql:"].includes(url.protocol) || (!nativeIdentity && !ciIdentity)
        || url.pathname !== `/${name}` || url.search || url.hash || !url.password
        || decodeURIComponent(url.username) !== (index === 0 ? "yellow_deploy" : "yellow_runtime")) {
      throw new Error("Order447 requires its exact separately admitted proof target");
    }
  });
  if (targets[0]!.hostname !== targets[1]!.hostname || targets[0]!.port !== targets[1]!.port) {
    throw new Error("Order447 deploy and runtime targets must resolve to one database server");
  }
  if (mode === "ci-canonical" && targets.some(url => url.host !== ciDatabaseAddress)) {
    throw new Error("Order447 canonical CI target does not match the resolved database address");
  }
}

export async function createCreditSubmissionScenario(deploy: SQL, database: Database,
  options: Parameters<typeof createCreditFixture>[2] = {}): Promise<FiscalSubmissionHttpScenario & { candidate: CreditFixture; credit: Record<string, string> }> {
  const [prerequisites] = await deploy<{ permissions: number; provider: boolean }[]>`SELECT
    (SELECT count(*)::int FROM public.permission WHERE code IN ('financials.adjustments:write','financials.adjustments:post-seal')) permissions,
    EXISTS(SELECT 1 FROM public.extension_type WHERE type='fiscal_provider') provider`;
  if (prerequisites?.permissions !== 2 || !prerequisites.provider) {
    throw new Error("Order447 retained target lacks pre-existing fixture permission/provider prerequisites; do not seed globals implicitly");
  }
  const candidate = await createCreditFixture(deploy, database, {
    ...options, label: options.label ?? `credit447-${crypto.randomUUID().slice(0, 12)}`,
    statutoryOriginalConfiguration: "karnataka_supplier_karnataka_property",
  });
  const issuedCredit = await new IssueIndiaNativeFiscalCreditNoteCommand(database).execute({
    tenantId: candidate.fixture.tenant, propertyNode: candidate.fixture.property, actorId: candidate.fixture.actor,
    originalDocumentId: candidate.invoice.documentId, reason: "Full credit fiscal registration — exact source",
    idempotencyKey: `credit447-${candidate.invoice.documentId}`,
    envelope: createAuditEnvelope({ tenantId: candidate.fixture.tenant, propertyNode: candidate.fixture.property,
      actorId: candidate.fixture.actor, requestId: crypto.randomUUID(), operation: "document.issued" }),
  });
  const credit = JSON.parse(issuedCredit.receiptJson) as Record<string, string>;
  const [role] = await deploy<{ id: string }[]>`SELECT role_id::text id FROM public.user_role
    WHERE tenant_id=${candidate.fixture.tenant}::uuid AND user_id=${candidate.fixture.actor}::uuid ORDER BY role_id LIMIT 1`;
  if (!role || !credit.documentId) throw new Error("Genuine credit fixture incomplete");
  const provider = Object.freeze({ providerKey: "india-irp", providerExtensionId: crypto.randomUUID(), providerExtensionVersion: 1 });
  await deploy`INSERT INTO public.extension(id,tenant_id,type,key,version,effective,content,status)
    VALUES(${provider.providerExtensionId}::uuid,${candidate.fixture.tenant}::uuid,'fiscal_provider',
      ${`in-irp-${provider.providerExtensionId}`},1,tstzrange(NULL,NULL,'[)'),
      '{"jurisdiction":"IN","mode":"in_house_reporting","provider_key":"india-irp","document_formats":["irp_json_1_1"]}'::jsonb,'active')`;
  await deploy`INSERT INTO public.role_permission(role_id,permission_code) SELECT ${role.id}::uuid,code
    FROM public.permission WHERE code IN ('tax-fiscal.submissions:request','tax-fiscal.submissions:retry','tax-fiscal.submissions:read')
    ON CONFLICT DO NOTHING`;
  return { candidate, credit, tenantId: candidate.fixture.tenant, propertyNode: candidate.fixture.property,
    actorId: candidate.fixture.actor, unauthorizedActorId: candidate.fixture.unauthorizedActor,
    roleId: role.id, documentId: credit.documentId, provider };
}

/** Private projector is intentionally not executable by app_role. */
export async function ownerCreditProjection(deploy: SQL, tenant: string, property: string, document: string) {
  return deploy.begin(async tx => {
    await tx`SELECT set_config('app.tenant_id',${tenant},true)`;
    const [row] = await tx<{ value: { documentSha256: string; wireSha256: string; wireText: string; businessDate: string } }[]>`
      SELECT public.india_fiscal_submission_project_wire(${tenant}::uuid,${property}::uuid,${document}::uuid) value`;
    if (!row) throw new Error("Expected private wire projection"); return row.value;
  });
}

export async function requestCreditSubmission(tx: Tx, scenario: FiscalSubmissionHttpScenario, key: string) {
  const [row] = await tx<{ value: Record<string, unknown> }[]>`SELECT public.request_india_fiscal_submission(
    ${scenario.tenantId}::uuid,${scenario.propertyNode}::uuid,${scenario.documentId}::uuid,
    ${scenario.provider.providerExtensionId}::uuid,${scenario.actorId}::uuid,${key},${crypto.randomUUID()}::uuid) value`;
  if (!row) throw new Error("Expected governed submission receipt"); return row.value;
}

export async function creditSubmissionFinancialFingerprint(deploy: SQL, tenant: string): Promise<string> {
  const values: Record<string, unknown> = {};
  for (const table of ["document", "document_series", "journal", "posting_line", "india_native_fiscal_credit_note", "india_gst_native_fiscal_document_origin"] as const) {
    values[table] = await deploy.unsafe(`SELECT to_jsonb(r)::text body FROM public.${table} r WHERE tenant_id=$1::uuid ORDER BY to_jsonb(r)::text COLLATE "C"`, [tenant]);
  }
  return JSON.stringify(values);
}

export type Order447CreditProtocolBehavior =
  | "accepted"
  | "accepted_after_response_loss"
  | "wrong_reference"
  | "wrong_qr_doc_type";

type Order447ExactValue = import("../../src/contexts/tax-fiscal/fiscal-exact-json").FiscalExactJsonValue;
type Order447ExactObject = Extract<Order447ExactValue, { readonly kind: "object" }>;
type Order447ExactArray = Extract<Order447ExactValue, { readonly kind: "array" }>;
type Order447ExactNumber = Extract<Order447ExactValue, { readonly kind: "number" }>;

/**
 * Reuses the established Order440 encrypted provider for the valid recovery path.
 * The two Order447-only modes still use the production direct adapter and real
 * RSA/AES/RS256 operations, but freshly sign one deliberately mismatched CRN field.
 */
export async function createOrder447CreditProtocol(
  document: import("./order440-clearirp-protocol").Order440ClearIrpIssuedDocument,
  behavior: Order447CreditProtocolBehavior,
): Promise<Readonly<import("./order440-clearirp-protocol").Order440ClearIrpProtocol>> {
  if (behavior === "accepted_after_response_loss") {
    const { createOrder440ClearIrpProtocol } = await import("./order440-clearirp-protocol");
    return createOrder440ClearIrpProtocol(document, behavior);
  }

  const [{ Buffer }, nodeCrypto, { createClearIrpDirectAdapter }, { decodeFiscalExactJson },
    { projectIssuedIndiaIrpWireCandidate }] = await Promise.all([
    import("node:buffer"),
    import("node:crypto"),
    import("../../src/contexts/tax-fiscal/clearirp-direct-adapter"),
    import("../../src/contexts/tax-fiscal/fiscal-exact-json"),
    import("../../src/contexts/tax-fiscal/india-irp-issued-wire-candidate"),
  ]);
  const fail = (message: string): never => {
    throw new Error(`Order447 synthetic credit protocol failure: ${message}`);
  };
  const object = (value: Order447ExactValue | undefined): Order447ExactObject =>
    value?.kind === "object" ? value : fail("wire object is invalid");
  const array = (value: Order447ExactValue | undefined): Order447ExactArray =>
    value?.kind === "array" ? value : fail("wire array is invalid");
  const string = (value: Order447ExactValue | undefined): string =>
    value?.kind === "string" ? value.value : fail("wire string is invalid");
  const number = (value: Order447ExactValue | undefined): Order447ExactNumber =>
    value?.kind === "number" ? value : fail("wire number is invalid");
  const base64 = (value: Uint8Array): string => Buffer.from(value).toString("base64");
  const base64Url = (value: Uint8Array): string => base64(value)
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  const base64UrlBytes = (value: string): Uint8Array => new Uint8Array(
    Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64"),
  );
  const sha256 = (value: string | Uint8Array): string =>
    new Bun.CryptoHasher("sha256").update(value).digest("hex");
  const bytesBigInt = (bytes: Uint8Array): bigint => {
    let value = 0n;
    for (const byte of bytes) value = value * 256n + BigInt(byte);
    return value;
  };
  const modularPower = (base: bigint, exponent: bigint, modulus: bigint): bigint => {
    let result = 1n;
    let factor = base % modulus;
    let power = exponent;
    while (power > 0n) {
      if ((power & 1n) === 1n) result = result * factor % modulus;
      factor = factor * factor % modulus;
      power >>= 1n;
    }
    return result;
  };
  const decryptRsaPkcs1 = (key: import("node:crypto").KeyObject, ciphertext: Uint8Array): Uint8Array => {
    const jwk = key.export({ format: "jwk" });
    if (!jwk.n || !jwk.d) return fail("encryption key is incomplete");
    const modulusBytes = base64UrlBytes(jwk.n).byteLength;
    const encoded = modularPower(bytesBigInt(ciphertext), bytesBigInt(base64UrlBytes(jwk.d)),
      bytesBigInt(base64UrlBytes(jwk.n))).toString(16).padStart(modulusBytes * 2, "0");
    const block = new Uint8Array(Buffer.from(encoded, "hex"));
    const separator = block.indexOf(0, 2);
    if (block[0] !== 0 || block[1] !== 2 || separator < 10) return fail("RSA padding is invalid");
    for (let index = 2; index < separator; index += 1) {
      if (block[index] === 0) return fail("RSA padding is invalid");
    }
    return block.slice(separator + 1);
  };
  const encryptAes = (key: Uint8Array, plaintext: Uint8Array): Uint8Array => {
    const cipher = nodeCrypto.createCipheriv("aes-256-ecb", key, null);
    return new Uint8Array(Buffer.concat([cipher.update(plaintext), cipher.final()]));
  };
  const decryptAes = (key: Uint8Array, ciphertext: Uint8Array): Uint8Array => {
    const decipher = nodeCrypto.createDecipheriv("aes-256-ecb", key, null);
    return new Uint8Array(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
  };
  const formatUtc = (unixMs: number): string => {
    const iso = new Date(unixMs).toISOString();
    return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
  };

  const projected = projectIssuedIndiaIrpWireCandidate({
    documentId: document.documentId,
    documentSha256: document.documentSha256,
    contentJson: document.sourceContentJson,
  });
  if (!projected.ok || projected.value.wireJson !== document.wireJson
      || projected.value.wireSha256 !== document.wireSha256) return fail("credit projection differs");
  const decoded = decodeFiscalExactJson(document.wireJson);
  if (!decoded.ok) return fail("credit wire cannot be decoded");
  const root = object(decoded.value);
  const seller = object(root.members.SellerDtls);
  const buyer = object(root.members.BuyerDtls);
  const details = object(root.members.DocDtls);
  const values = object(root.members.ValDtls);
  const items = array(root.members.ItemList);
  const references = array(object(root.members.RefDtls).members.PrecDocDtls);
  if (string(details.members.Typ) !== "CRN" || references.items.length !== 1 || items.items.length < 1) {
    return fail("native CRN identity is invalid");
  }
  const reference = object(references.items[0]);
  const originalNumber = string(reference.members.InvNo);
  const originalDate = string(reference.members.InvDt);
  const originalReference = `{"PrecDocDtls":[{"InvNo":${JSON.stringify(originalNumber)},` +
    `"InvDt":${JSON.stringify(originalDate)}}]}`;
  const wrongNumber = originalNumber.length < 16 ? `${originalNumber}X`
    : `${originalNumber.slice(0, -1)}${originalNumber.endsWith("1") ? "2" : "1"}`;
  const wrongReference = `{"PrecDocDtls":[{"InvNo":${JSON.stringify(wrongNumber)},` +
    `"InvDt":${JSON.stringify(originalDate)}}]}`;
  const referenceMarker = `"RefDtls":${originalReference}`;
  const signedWire = behavior === "wrong_reference"
    ? document.wireJson.replace(referenceMarker, `"RefDtls":${wrongReference}`)
    : document.wireJson;
  if (behavior === "wrong_reference" && signedWire === document.wireJson) return fail("reference marker is absent");
  const hsns = new Set(items.items.map(item => string(object(item).members.HsnCd)));
  if (hsns.size !== 1) return fail("hostile fixture needs one unambiguous HSN");

  const issuer = "YELLOW-ORDER447-SYNTHETIC-IRP";
  const keyId = "yellow-order447-synthetic-signing-key";
  const acknowledgementNumber = "90071992547409991";
  const irn = sha256(`order447:${document.documentId}:${document.wireSha256}:${behavior}`);
  const createdAt = Date.now();
  const acknowledgementDate = formatUtc(createdAt);
  const encryptionPair = nodeCrypto.generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 0x10001 });
  const signingPair = await crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256",
  }, true, ["sign", "verify"]);
  const encoder = new TextEncoder();
  const signInner = async (inner: string): Promise<string> => {
    const header = base64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT", kid: keyId })));
    const payload = base64Url(encoder.encode(JSON.stringify({ data: inner, iss: issuer })));
    const signingInput = `${header}.${payload}`;
    const signature = new Uint8Array(await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5", signingPair.privateKey, encoder.encode(signingInput),
    ));
    return `${signingInput}.${base64Url(signature)}`;
  };
  const invoiceInner = `${signedWire.slice(0, -1)},"AckNo":${acknowledgementNumber},` +
    `"AckDt":${JSON.stringify(acknowledgementDate)},"Irn":${JSON.stringify(irn)}}`;
  const qrInner = `{` + [
    `"SellerGstin":${JSON.stringify(string(seller.members.Gstin))}`,
    `"BuyerGstin":${JSON.stringify(string(buyer.members.Gstin))}`,
    `"DocNo":${JSON.stringify(string(details.members.No))}`,
    `"DocTyp":${JSON.stringify(behavior === "wrong_qr_doc_type" ? "INV" : "CRN")}`,
    `"DocDt":${JSON.stringify(string(details.members.Dt))}`,
    `"TotInvVal":${number(values.members.TotInvVal).lexeme}`,
    `"ItemCnt":${items.items.length}`,
    `"MainHsnCode":${JSON.stringify([...hsns][0]!)}`,
    `"Irn":${JSON.stringify(irn)}`,
  ].join(",") + `}`;
  const [signedInvoice, signedQRCode] = await Promise.all([signInner(invoiceInner), signInner(qrInner)]);
  const encryptionSpki = encryptionPair.publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const signingSpki = base64(new Uint8Array(await crypto.subtle.exportKey("spki", signingPair.publicKey)));
  const configurationJson = JSON.stringify({
    protocolProfile: "clearirp_direct_v1_04_v1_03_v1",
    providerKey: document.providerKey,
    environment: "sandbox",
    apiBaseUrl: "https://order447-clearirp.invalid",
    encryptionSpkiDerBase64: encryptionSpki,
    issuer,
    profileVersion: "yellow_native_india_1_1_v1",
    trustBundleJson: JSON.stringify({ version: "yellow-order447-synthetic-bundle-v1", keys: [{
      id: keyId, spkiDerBase64: signingSpki,
      notBeforeUnixMs: createdAt - 3_600_000, notAfterUnixMs: createdAt + 3_600_000,
    }] }),
    sekEncoding: "raw32",
    tokenExpiryUtcOffsetMinutes: 0,
    definitiveRejectionCodes: ["2150"], duplicateCodes: ["2154"], notFoundCodes: ["2143"],
  });
  const secrets = Object.freeze({
    clientId: "order447-synthetic-client",
    clientSecret: "order447-synthetic-client-secret",
    userName: "order447-synthetic-user",
    password: "order447-synthetic-password",
    gstin: string(seller.members.Gstin),
  });
  const sessions = new Map<string, Uint8Array>();
  const submittedWireSha256: string[] = [];
  let adapterInstances = 0;
  let authenticationRequests = 0;
  let submissionPosts = 0;
  let documentLookups = 0;

  const providerFetch = (async (input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1] = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    if (url.origin !== "https://order447-clearirp.invalid" || headers.get("client_id") !== secrets.clientId
        || headers.get("client_secret") !== secrets.clientSecret || headers.get("gstin") !== secrets.gstin
        || headers.get("content-type") !== "application/json" || init.redirect !== "error"
        || !(init.signal instanceof AbortSignal) || init.signal.aborted) return fail("request envelope differs");
    if (url.pathname === "/eivital/v1.04/auth") {
      authenticationRequests += 1;
      if (init.method !== "POST" || headers.has("authtoken") || headers.has("user_name")) {
        return fail("authentication request differs");
      }
      const outer = JSON.parse(String(init.body)) as { Data?: unknown };
      if (typeof outer.Data !== "string" || Object.keys(outer).length !== 1) return fail("authentication body differs");
      const encrypted = new Uint8Array(Buffer.from(outer.Data, "base64"));
      const encoded = decryptRsaPkcs1(encryptionPair.privateKey, encrypted);
      const credentialsText = Buffer.from(encoded).toString("utf8");
      const credentials = JSON.parse(Buffer.from(credentialsText, "base64").toString("utf8")) as Record<string, unknown>;
      if (credentials.UserName !== secrets.userName || credentials.Password !== secrets.password
          || credentials.ForceRefreshAccessToken !== false || typeof credentials.AppKey !== "string") {
        return fail("authentication credentials differ");
      }
      const appKey = new Uint8Array(Buffer.from(credentials.AppKey, "base64"));
      const sek = crypto.getRandomValues(new Uint8Array(32));
      const token = `order447-auth-${authenticationRequests}`;
      sessions.set(token, sek);
      return new Response(JSON.stringify({ Status: 1, Data: {
        ClientId: secrets.clientId, UserName: secrets.userName, AuthToken: token,
        Sek: base64(encryptAes(appKey, sek)), TokenExpiry: formatUtc(createdAt + 600_000),
      }, ErrorDetails: null, InfoDtls: null }), { status: 200, headers: { "content-type": "application/json" } });
    }
    const token = headers.get("authtoken");
    const sek = token ? sessions.get(token) : undefined;
    if (!sek || headers.get("user_name") !== secrets.userName) return fail("core authorization differs");
    if (url.pathname === "/eicore/v1.03/Invoice") {
      submissionPosts += 1;
      if (init.method !== "POST") return fail("submission method differs");
      const outer = JSON.parse(String(init.body)) as { Data?: unknown };
      if (typeof outer.Data !== "string" || Object.keys(outer).length !== 1) return fail("submission body differs");
      const submitted = new TextDecoder("utf-8", { fatal: true }).decode(
        decryptAes(sek, new Uint8Array(Buffer.from(outer.Data, "base64"))),
      );
      if (submitted !== document.wireJson) return fail("submitted CRN bytes differ");
      submittedWireSha256.push(sha256(submitted));
      const data = JSON.stringify({ AckNo: acknowledgementNumber, AckDt: acknowledgementDate, Irn: irn,
        SignedInvoice: signedInvoice, SignedQRCode: signedQRCode, Status: "ACT" });
      return new Response(JSON.stringify({ Status: 1,
        Data: base64(encryptAes(sek, encoder.encode(data))), ErrorDetails: null, InfoDtls: null,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/eicore/v1.03/Invoice/irnbydocdetails") {
      documentLookups += 1;
      const details = new TextEncoder().encode(JSON.stringify([{ ErrorCode: "2143" }]));
      return new Response(JSON.stringify({ Status: 0, Data: null,
        ErrorDetails: base64(details), InfoDtls: null,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return fail("unexpected protocol path");
  }) as typeof fetch;

  return Object.freeze({
    async createRegistration(identity: import("./order440-clearirp-protocol").Order440ClearIrpAdapterIdentity) {
      if (identity.providerKey !== document.providerKey) return fail("adapter identity differs");
      const configured = await createClearIrpDirectAdapter(configurationJson, secrets, {
        fetch: providerFetch, clock: () => createdAt,
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
