import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner } from "../src/contexts/identity";
import { FiscalSubmissionAdapterAvailabilityService, FiscalSubmissionReceiptReadService,
  FiscalSubmissionRepository, FiscalSubmissionService, FiscalSubmissionWorker,
  VerifiedIndiaIrpAdapterRegistry, type VerifiedIndiaIrpAdapterRegistration } from "../src/contexts/tax-fiscal";
import { projectIssuedIndiaIrpWireCandidate } from "../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";
import { OperatorHttpApi } from "../src/http/operator";
import { Database } from "../src/kernel";
import { assertCreditSubmissionTargets, createCreditSubmissionScenario, createOrder447CreditProtocol,
  creditSubmissionFinancialFingerprint, parseCreditSubmissionTargetMode } from "./fixtures/india-native-credit-submission-fixture";
import { createOrder440ClearIrpProtocol, type Order440ClearIrpIssuedDocument,
  type Order440ClearIrpProtocol } from "./fixtures/order440-clearirp-protocol";
import { FISCAL_RECEIPT_READ_SCOPE } from "./fixtures/order440-signed-fiscal-receipt";
import { parseCreditClaimChildEnvironment } from "./fixtures/order447-credit-claim-child";

const deployUrl = process.env.YELLOW_ORDER447_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER447_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER447_RECOVERY === "1";
if (required && (!deployUrl || !runtimeUrl)) throw new Error("Required Order447 recovery needs exact admitted credentials");
const targetMode = required || deployUrl || runtimeUrl
  ? parseCreditSubmissionTargetMode(process.env.YELLOW_ORDER447_TARGET_MODE) : undefined;
if (deployUrl || runtimeUrl) {
  if (!deployUrl || !runtimeUrl) throw new Error("Order447 recovery requires paired credentials");
  assertCreditSubmissionTargets(deployUrl, runtimeUrl, "runtime", targetMode!,
    process.env.YELLOW_REQUIRE_ORDER447_CI_CANONICAL === "1", process.env.YELLOW_ORDER447_CI_DATABASE_ADDRESS);
}
const databaseDescribe = required ? describe.serial : describe.skip;
type Base = Awaited<ReturnType<typeof createCreditSubmissionScenario>>;
type Scenario = Base & { readonly submissionId: string };
const sha = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");

describe("Order447 runtime-only claim child admission", () => {
  test("requires exact native/CI identity and bounded synthetic inputs without a deploy credential", () => {
    const native = { YELLOW_REQUIRE_ORDER447_RECOVERY: "1", YELLOW_ORDER447_TARGET_MODE: "native-draft",
      YELLOW_ORDER447_RUNTIME_DATABASE_URL: "postgres://yellow_runtime:synthetic@127.0.0.1:55503/yellow_order446_credit_upgrade_20260907",
      YELLOW_ORDER447_CHILD_TENANT: "00000000-0000-4000-8000-000000000001",
      YELLOW_ORDER447_CHILD_SUBMISSION: "00000000-0000-4000-8000-000000000002",
      YELLOW_ORDER447_CHILD_DOCUMENT: "00000000-0000-4000-8000-000000000003",
      YELLOW_ORDER447_CHILD_NONCE: "00000000-0000-4000-8000-000000000004",
      YELLOW_ORDER447_CHILD_WIRE_SHA: "a".repeat(64) };
    expect(parseCreditClaimChildEnvironment(native).mode).toBe("native-draft");
    for (const key of Object.keys(native)) {
      expect(() => parseCreditClaimChildEnvironment({ ...native, [key]: undefined })).toThrow();
    }
    for (const url of [native.YELLOW_ORDER447_RUNTIME_DATABASE_URL.replace("yellow_runtime", "yellow_deploy"),
      `${native.YELLOW_ORDER447_RUNTIME_DATABASE_URL}?options=-csearch_path=public`,
      native.YELLOW_ORDER447_RUNTIME_DATABASE_URL.replace("127.0.0.1", "localhost"),
      native.YELLOW_ORDER447_RUNTIME_DATABASE_URL.replace("credit_upgrade", "credit_candidate")]) {
      expect(() => parseCreditClaimChildEnvironment({ ...native, YELLOW_ORDER447_RUNTIME_DATABASE_URL: url })).toThrow();
    }
    const ci = { ...native, YELLOW_ORDER447_TARGET_MODE: "ci-canonical",
      YELLOW_ORDER447_CI_DATABASE_ADDRESS: "127.0.0.1:5432",
      YELLOW_ORDER447_RUNTIME_DATABASE_URL: "postgres://yellow_runtime:synthetic@127.0.0.1:5432/yellow_order447_current88_ci" };
    expect(() => parseCreditClaimChildEnvironment(ci)).toThrow();
    expect(parseCreditClaimChildEnvironment({ ...ci, YELLOW_REQUIRE_ORDER447_CI_CANONICAL: "1" }).mode).toBe("ci-canonical");
    for (const address of [undefined, "127.0.0.1:5433", "other.example:5432"]) {
      expect(() => parseCreditClaimChildEnvironment({ ...ci, YELLOW_REQUIRE_ORDER447_CI_CANONICAL: "1",
        YELLOW_ORDER447_CI_DATABASE_ADDRESS: address })).toThrow();
    }
    expect(() => parseCreditClaimChildEnvironment({ ...ci, YELLOW_REQUIRE_ORDER447_CI_CANONICAL: "1",
      YELLOW_ORDER447_RUNTIME_DATABASE_URL: ci.YELLOW_ORDER447_RUNTIME_DATABASE_URL.replace(":5432/", ":55503/") })).toThrow();
  });
});

/** No inherited database, provider or signing secrets; only runtime authority enters the child. */
async function committedClaimChild(scenario: Scenario, wireSha256: string) {
  const nonce = crypto.randomUUID();
  const env: Record<string, string> = {};
  for (const name of ["SystemRoot", "WINDIR", "PATH", "TEMP", "TMP"]) {
    if (process.env[name]) env[name] = process.env[name]!;
  }
  Object.assign(env, { YELLOW_REQUIRE_ORDER447_RECOVERY: "1", YELLOW_ORDER447_TARGET_MODE: targetMode!,
    YELLOW_ORDER447_RUNTIME_DATABASE_URL: runtimeUrl!,
    YELLOW_REQUIRE_ORDER447_CI_CANONICAL: process.env.YELLOW_REQUIRE_ORDER447_CI_CANONICAL === "1" ? "1" : "0",
    YELLOW_ORDER447_CHILD_TENANT: scenario.tenantId, YELLOW_ORDER447_CHILD_SUBMISSION: scenario.submissionId,
    YELLOW_ORDER447_CHILD_DOCUMENT: scenario.documentId, YELLOW_ORDER447_CHILD_WIRE_SHA: wireSha256,
    YELLOW_ORDER447_CHILD_NONCE: nonce });
  if (targetMode === "ci-canonical") env.YELLOW_ORDER447_CI_DATABASE_ADDRESS = process.env.YELLOW_ORDER447_CI_DATABASE_ADDRESS!;
  parseCreditClaimChildEnvironment(env);
  const child = spawn(process.execPath, [fileURLToPath(new URL("./fixtures/order447-credit-claim-child.ts", import.meta.url))],
    { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  let stderrBytes = 0;
  let overflow = false;
  let timedOut = false;
  const closed = new Promise<{ code: number | null; signal: string | null }>(resolve => {
    child.once("error", () => { overflow = true; });
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  child.stdout.on("data", (value: Buffer) => {
    if (Buffer.byteLength(output) + value.length > 4096) { overflow = true; child.kill("SIGKILL"); }
    else output += value.toString("utf8");
  });
  child.stderr.on("data", (value: Buffer) => {
    stderrBytes += value.length;
    if (stderrBytes > 4096) { overflow = true; child.kill("SIGKILL"); }
  });
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    deadline = setTimeout(() => { timedOut = true; child.kill("SIGKILL");
      reject(new Error("Order447 owned claim child exceeded its deadline")); }, 35_000);
  });
  try {
    const ended = await Promise.race([closed, timeout]);
    expect(timedOut || overflow).toBe(false);
    expect(ended).toEqual({ code: 0, signal: null });
    expect(stderrBytes).toBe(0);
    // Do not print arbitrary child output on failure: only a validated fixed receipt is accepted.
    if (!output.startsWith('{"kind":"committed_credit_claim"') || output.length > 512) {
      throw new Error("Order447 child did not acknowledge a committed credit claim");
    }
    const receipt = JSON.parse(output) as Record<string, unknown>;
    if (!receipt || Object.keys(receipt).sort().join(",") !== "backend,documentId,kind,nonce,wireSha256"
        || !Number.isInteger(receipt.backend) || Number(receipt.backend) < 1) {
      throw new Error("Order447 claim child acknowledgement shape is invalid");
    }
    expect(receipt).toEqual({ kind: "committed_credit_claim", nonce,
      documentId: scenario.documentId, wireSha256, backend: receipt.backend });
    expect(child.exitCode).toBe(0);
    return Number(receipt.backend);
  } finally {
    clearTimeout(deadline);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    let reapTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([closed, new Promise<never>((_resolve, reject) => {
        reapTimer = setTimeout(() => reject(new Error("Order447 owned claim child could not be reaped")), 5_000);
      })]);
    } finally { clearTimeout(reapTimer); }
  }
}

databaseDescribe("Order447 genuine CRN lifecycle recovery", () => {
  let deploy: SQL;
  let database: Database;
  const service = new FiscalSubmissionService();
  const tokens = new Hs256TokenSigner("order447-recovery-synthetic-session-secret-at-least-48-bytes");

  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false, connectionTimeout: 5 });
    database = Database.connect(runtimeUrl!, { maxConnections: 2, prepare: false });
    const [identity] = await deploy<{ frontier: number; migration: string; body_sha: string }[]>`
      SELECT (SELECT max(version)::int FROM public.schema_migration) frontier,
        (SELECT checksum_sha256 FROM public.schema_migration WHERE version=${targetMode === "native-draft" ? 87 : 88}) migration,
        pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
          pg_catalog.replace(prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex') body_sha
      FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(
        'public.india_fiscal_submission_project_wire(uuid,uuid,uuid)')`;
    expect(identity).toEqual({ frontier: targetMode === "native-draft" ? 87 : 88,
      migration: targetMode === "native-draft" ? "c8b4ada5702807a0705a13e888e95730e0dbcc8ac7796e0ad2358208a5f873ba"
        : "214754e94bdfb0a2163395c9ab4449b0b5e87da7830c45e69d77ac05a2cddb64",
      body_sha: "b34eaf0095dad0df5cd55453b7e4bd1a42f5ae698a02c5ebca3dcac7645c9f96" });
  }, 30_000);
  afterAll(async () => { await database?.close(); await deploy?.close({ timeout: 0 }); }, 30_000);

  async function arrange() {
    const base = await createCreditSubmissionScenario(deploy, database, { roomNightAmounts: ["10000"] });
    const financial = await creditSubmissionFinancialFingerprint(deploy, base.tenantId);
    const request = Object.freeze({ tenantId: base.tenantId, propertyNode: base.propertyNode,
      documentId: base.documentId, providerExtensionId: base.provider.providerExtensionId,
      actorId: base.actorId, idempotencyKey: `recovery447-${crypto.randomUUID()}`, requestId: crypto.randomUUID() });
    const result = await database.withTenantTransaction(base.tenantId, tx => service.request(tx, request));
    if (!result.ok) throw new Error(`Order447 recovery request failed: ${result.error.code}`);
    const scenario = Object.freeze({ ...base, submissionId: result.value.submissionId });
    const [source] = await deploy<{ content: string; hash: string }[]>`
      SELECT content::text content,sha256 hash FROM public.document
      WHERE tenant_id=${base.tenantId}::uuid AND id=${base.documentId}::uuid`;
    if (!source) throw new Error("Order447 recovery credit is missing");
    const projected = projectIssuedIndiaIrpWireCandidate({ documentId: base.documentId,
      documentSha256: source.hash, contentJson: source.content });
    if (!projected.ok) throw new Error("Order447 recovery credit source is invalid");
    const wire = projected.value;
    expect(sha(wire.wireJson)).toBe(wire.wireSha256);
    expect(JSON.parse(wire.wireJson)).toMatchObject({ DocDtls: { Typ: "CRN", No: base.credit.docNo },
      RefDtls: { PrecDocDtls: [{ InvNo: base.candidate.invoice.docNo }] } });
    expect(wire.wireJson).not.toContain("YellowCredit");
    const document: Order440ClearIrpIssuedDocument = { documentId: base.documentId, documentSha256: source.hash,
      sourceContentJson: source.content, wireJson: wire.wireJson, wireSha256: wire.wireSha256,
      providerKey: base.provider.providerKey };
    const token = await tokens.issue({ userId: base.actorId, tenantId: base.tenantId, scopes: [FISCAL_RECEIPT_READ_SCOPE] });
    return { scenario, document, financial, request, initialReceipt: result.value, token };
  }

  async function delivery(s: Scenario) {
    const result: Record<string, unknown> = {};
    for (const table of ["fiscal_submission", "fiscal_submission_history", "fact_log", "outbox"] as const) {
      result[table] = await deploy.unsafe(`SELECT to_jsonb(r)::text body FROM public.${table} r
        WHERE tenant_id=$1::uuid ORDER BY to_jsonb(r)::text COLLATE "C"`, [s.tenantId]);
    }
    return JSON.stringify(result);
  }
  async function head(s: Scenario) {
    const [row] = await deploy<{ status: string; disposition: string; transition_seq: string; wire_text: string;
      wire_sha256: string; response: unknown; authority_ref: string | null; attempt_number: number }[]>`
      SELECT status,disposition,transition_seq,wire_text,wire_sha256,response,authority_ref,attempt_number
      FROM public.fiscal_submission WHERE tenant_id=${s.tenantId}::uuid AND id=${s.submissionId}::uuid`;
    if (!row) throw new Error("Order447 recovery head is missing"); return row;
  }
  async function runFresh(s: Scenario, registration: VerifiedIndiaIrpAdapterRegistration) {
    const pool = new SQL(runtimeUrl!, { max: 1, prepare: false, connectionTimeout: 5 });
    try {
      return await new FiscalSubmissionWorker(new FiscalSubmissionRepository(pool),
        new VerifiedIndiaIrpAdapterRegistry([registration])).runOnce({ tenantId: s.tenantId,
        submissionId: s.submissionId, ...s.provider, leaseSeconds: 30, transportDeadlineMs: 20_000 });
    } finally { await pool.close({ timeout: 0 }); }
  }
  async function receiptBytes(s: Scenario, token: string) {
    const dependencies = { submissions: {
      async request() { throw new Error("Receipt GET cannot request"); },
      async retry() { throw new Error("Receipt GET cannot retry"); },
    }, adapters: new FiscalSubmissionAdapterAvailabilityService([]), receipts: new FiscalSubmissionReceiptReadService() };
    const Operator = OperatorHttpApi as unknown as new (...args: unknown[]) => OperatorHttpApi;
    const operatorApi = new Operator({}, undefined, ...Array.from({ length: 44 }, () => undefined), dependencies);
    const app = createApp({ database, tenantResolver: new BearerTenantResolver(tokens), operatorApi });
    const response = await app.handle(new Request(`http://yellow.test/api/v1/properties/${s.propertyNode}/fiscal-submissions/${s.submissionId}/receipt`,
      { headers: { authorization: `Bearer ${token}`, "x-correlation-id": crypto.randomUUID() } }));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    return response.text();
  }
  async function unchanged(s: Scenario, financial: string, document: Order440ClearIrpIssuedDocument) {
    expect(await creditSubmissionFinancialFingerprint(deploy, s.tenantId)).toBe(financial);
    expect(await head(s)).toMatchObject({ wire_text: document.wireJson, wire_sha256: document.wireSha256, attempt_number: 1 });
  }

  test("a wrong registered provider version has zero effects before the exact CRN registration succeeds", async () => {
    const { scenario, document, financial } = await arrange();
    const protocol = await createOrder447CreditProtocol(document, "accepted");
    const before = await delivery(scenario);
    const wrong = await protocol.createRegistration({ ...scenario.provider,
      providerExtensionVersion: scenario.provider.providerExtensionVersion + 1 });
    expect(await runFresh(scenario, wrong)).toEqual({ ok: true, kind: "idle", reason: "adapter_unavailable" });
    expect(await delivery(scenario)).toBe(before);
    expect(protocol.metrics()).toMatchObject({ authenticationRequests: 0, submissionPosts: 0, documentLookups: 0 });
    expect(await runFresh(scenario, await protocol.createRegistration(scenario.provider)))
      .toMatchObject({ ok: true, kind: "reconciled", action: "submit", status: "accepted", disposition: "none" });
    expect(protocol.metrics()).toMatchObject({ submissionPosts: 1, documentLookups: 0, submittedWireSha256: [document.wireSha256] });
    await unchanged(scenario, financial, document);
  }, 60_000);

  test("accepted CRN signed GET and immutable original request survive strictly cohort-bounded real pruning", async () => {
    const { scenario: s, document, financial, token, request, initialReceipt } = await arrange();
    const protocol = await createOrder447CreditProtocol(document, "accepted");
    expect(await runFresh(s, await protocol.createRegistration(s.provider)))
      .toMatchObject({ ok: true, kind: "reconciled", status: "accepted", disposition: "none" });
    const signed = await receiptBytes(s, token);
    expect(JSON.parse(signed).fiscalSubmissionReceipt).toMatchObject({ kind: "accepted_signed_v1",
      status: "accepted", disposition: "none", documentId: s.documentId });
    const durable = await head(s);
    const history = await deploy`SELECT to_jsonb(h)::text body FROM public.fiscal_submission_history h
      WHERE tenant_id=${s.tenantId}::uuid AND submission_id=${s.submissionId}::uuid ORDER BY transition_seq`;
    const owned = await deploy<{ id: string }[]>`SELECT id::text id FROM public.outbox
      WHERE tenant_id=${s.tenantId}::uuid AND aggregate_type='fiscal_submission' AND aggregate_id=${s.submissionId}::uuid
      ORDER BY id`;
    expect(owned).toHaveLength(3);
    await deploy`UPDATE public.outbox SET published_at=clock_timestamp()
      WHERE tenant_id=${s.tenantId}::uuid AND aggregate_type='fiscal_submission' AND aggregate_id=${s.submissionId}::uuid
        AND published_at IS NULL`;
    await deploy.begin(async tx => {
      await tx.unsafe("SET LOCAL lock_timeout='5s'");
      await tx.unsafe("SET LOCAL statement_timeout='15s'");
      await tx.unsafe("LOCK TABLE public.outbox,public.consumer_processed IN SHARE ROW EXCLUSIVE MODE");
      const eligible = await tx<{ id: string; tenant_id: string; aggregate_id: string; aggregate_type: string }[]>`
        SELECT id::text id,tenant_id::text tenant_id,aggregate_id::text aggregate_id,aggregate_type
        FROM public.outbox WHERE published_at IS NOT NULL AND published_at<now() ORDER BY id`;
      // Global capability: fail closed unless its ENTIRE deletion set is exactly our three fresh events.
      expect(eligible.map(e => ({ id: e.id }))).toEqual(owned.map(e => ({ id: e.id })));
      expect(eligible.every(e => e.tenant_id === s.tenantId && e.aggregate_id === s.submissionId
        && e.aggregate_type === "fiscal_submission")).toBe(true);
      const consumers = await tx<{ outbox_id: string }[]>`SELECT p.outbox_id::text outbox_id
        FROM public.consumer_processed p JOIN public.outbox e ON e.id=p.outbox_id
        WHERE e.published_at IS NOT NULL AND e.published_at<now()`;
      expect(consumers.every(p => owned.some(e => e.id === p.outbox_id))).toBe(true);
      const outside = await tx`SELECT to_jsonb(e)::text body FROM public.outbox e
        WHERE NOT (tenant_id=${s.tenantId}::uuid AND aggregate_type='fiscal_submission' AND aggregate_id=${s.submissionId}::uuid)
        ORDER BY id`;
      const outsideConsumers = await tx`SELECT to_jsonb(p)::text body FROM public.consumer_processed p
        WHERE NOT EXISTS(SELECT 1 FROM public.outbox e WHERE e.id=p.outbox_id AND e.tenant_id=${s.tenantId}::uuid
          AND e.aggregate_type='fiscal_submission' AND e.aggregate_id=${s.submissionId}::uuid)
        ORDER BY to_jsonb(p)::text COLLATE "C"`;
      await tx.unsafe("SET LOCAL ROLE yellow_runtime");
      const [pruned] = await tx<{ processed: number; outbox: bigint }[]>`SELECT * FROM public.runtime_prune_outbox(0)`;
      expect(pruned).toMatchObject({ processed: consumers.length });
      expect(String(pruned?.outbox)).toBe(String(owned.length));
      await tx.unsafe("RESET ROLE");
      expect(await tx`SELECT to_jsonb(e)::text body FROM public.outbox e ORDER BY id`).toEqual(outside);
      expect(await tx`SELECT to_jsonb(p)::text body FROM public.consumer_processed p ORDER BY to_jsonb(p)::text COLLATE "C"`)
        .toEqual(outsideConsumers);
    });
    expect(await receiptBytes(s, token)).toBe(signed);
    expect(await head(s)).toEqual(durable);
    expect(await deploy`SELECT to_jsonb(h)::text body FROM public.fiscal_submission_history h
      WHERE tenant_id=${s.tenantId}::uuid AND submission_id=${s.submissionId}::uuid ORDER BY transition_seq`).toEqual(history);
    const replay = await database.withTenantTransaction(s.tenantId, tx => service.request(tx, request));
    expect(replay.ok && replay.value).toEqual({ ...initialReceipt, replayed: true });
    expect(await receiptBytes(s, token)).toBe(signed);
    expect(protocol.metrics()).toMatchObject({ submissionPosts: 1, documentLookups: 0 });
    await unchanged(s, financial, document);
  }, 60_000);

  test("genuine encrypted CRN submission receives definitive authenticated rejection without IRN or resend", async () => {
    const { scenario: s, document, financial, token } = await arrange();
    const protocol = await createOrder440ClearIrpProtocol(document, "rejected");
    expect(await runFresh(s, await protocol.createRegistration(s.provider)))
      .toMatchObject({ ok: true, kind: "reconciled", action: "submit", status: "rejected", disposition: "none" });
    const bytes = await receiptBytes(s, token);
    const receipt = JSON.parse(bytes).fiscalSubmissionReceipt;
    expect(receipt).toMatchObject({ kind: "rejected", status: "rejected", disposition: "none", errorCodes: ["2150"], documentId: s.documentId });
    expect(receipt).not.toHaveProperty("irn"); expect(receipt).not.toHaveProperty("authorityRef");
    const before = await delivery(s);
    expect(await runFresh(s, await protocol.createRegistration(s.provider)))
      .toEqual({ ok: true, kind: "idle", reason: "terminal" });
    expect(await delivery(s)).toBe(before);
    expect(await receiptBytes(s, token)).toBe(bytes);
    expect(protocol.metrics()).toMatchObject({ authenticationRequests: 1, submissionPosts: 1,
      documentLookups: 0, submittedWireSha256: [document.wireSha256] });
    expect(await head(s)).toMatchObject({ status: "rejected", disposition: "none", authority_ref: null });
    await unchanged(s, financial, document);
  }, 60_000);

  test("a real child exits after committed CRN claim; a fresh worker naturally expires to exact-wire lookup only", async () => {
    const { scenario: s, document, financial } = await arrange();
    // No provider POST ever occurs. Authenticated not-found must remain unresolved, not invent acceptance.
    const protocol: Order440ClearIrpProtocol = await createOrder440ClearIrpProtocol(document, "accepted_after_response_loss");
    const childBackend = await committedClaimChild(s, document.wireSha256);
    let backendEnded = false;
    for (let check = 0; check < 20; check += 1) {
      const [session] = await deploy<{ absent: boolean }[]>`
        SELECT NOT EXISTS(SELECT 1 FROM pg_catalog.pg_stat_activity WHERE pid=${childBackend}) absent`;
      if (session?.absent) { backendEnded = true; break; }
      await Bun.sleep(50);
    }
    expect(backendEnded).toBe(true);
    expect(await head(s)).toMatchObject({ status: "submitted", disposition: "lookup", transition_seq: "2", response: null });
    const [lease] = await deploy<{ expiry: string; live: boolean }[]>`SELECT claim_expires_at::text expiry,
      claim_expires_at>clock_timestamp() live FROM public.fiscal_submission
      WHERE tenant_id=${s.tenantId}::uuid AND id=${s.submissionId}::uuid`;
    expect(lease?.live).toBe(true);
    expect(protocol.metrics()).toMatchObject({ adapterInstances: 0, submissionPosts: 0, documentLookups: 0 });
    const registration = await protocol.createRegistration(s.provider);
    const observed: string[] = [];
    const witnessed = Object.freeze({ ...registration, async lookup(input, context) {
      expect(input.documentId).toBe(document.documentId);
      expect(input.payloadSha256).toBe(document.wireSha256);
      expect(new TextDecoder().decode(input.payload)).toBe(document.wireJson);
      observed.push(input.payloadSha256);
      return registration.lookup(input, context);
    } } satisfies VerifiedIndiaIrpAdapterRegistration);
    expect(await runFresh(s, witnessed)).toEqual({ ok: true, kind: "idle", reason: "busy" });
    const deadline = performance.now() + 22_000;
    let due = false;
    while (performance.now() < deadline) {
      const [row] = await deploy<{ due: boolean; expiry: string }[]>`SELECT claim_expires_at<=clock_timestamp() due,
        claim_expires_at::text expiry FROM public.fiscal_submission
        WHERE tenant_id=${s.tenantId}::uuid AND id=${s.submissionId}::uuid AND response IS NULL`;
      expect(row?.expiry).toBe(lease!.expiry);
      if (row?.due) { due = true; break; }
      await Bun.sleep(250);
    }
    expect(due).toBe(true);
    expect(observed).toEqual([]);
    expect(await runFresh(s, witnessed)).toMatchObject({ ok: true, kind: "reconciled", action: "lookup",
      status: "submitted", disposition: "lookup" });
    expect(observed).toEqual([document.wireSha256]);
    expect(protocol.metrics()).toMatchObject({ authenticationRequests: 1, submissionPosts: 0, documentLookups: 1,
      submittedWireSha256: [] });
    const events = await deploy<{ event_type: string }[]>`SELECT event_type FROM public.fiscal_submission_history
      WHERE tenant_id=${s.tenantId}::uuid AND submission_id=${s.submissionId}::uuid ORDER BY transition_seq`;
    expect(events.map(e => e.event_type)).toEqual(["fiscal.submission.requested", "fiscal.submission.claimed",
      "fiscal.submission.claimed", "fiscal.submission.reconciled"]);
    await unchanged(s, financial, document);
  }, 90_000);
});
