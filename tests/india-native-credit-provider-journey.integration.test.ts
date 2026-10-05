import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner } from "../src/contexts/identity";
import {
  FiscalSubmissionAdapterAvailabilityService,
  FiscalSubmissionReceiptReadService,
  FiscalSubmissionRepository,
  FiscalSubmissionService,
  FiscalSubmissionWorker,
  VerifiedIndiaIrpAdapterRegistry,
  type FiscalSubmissionDeliveryReceipt,
  type FiscalSubmissionReceipt,
  type FiscalSubmissionWorkerStepResult,
  type VerifiedIndiaIrpAdapterRegistration,
} from "../src/contexts/tax-fiscal";
import { projectIssuedIndiaIrpWireCandidate } from
  "../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";
import { OperatorHttpApi } from "../src/http/operator";
import { Database } from "../src/kernel";
import type {
  Order440ClearIrpIssuedDocument,
  Order440ClearIrpProtocol,
} from "./fixtures/order440-clearirp-protocol";
import { FISCAL_RECEIPT_READ_SCOPE } from "./fixtures/order440-signed-fiscal-receipt";
import {
  assertCreditSubmissionTargets,
  createCreditSubmissionScenario,
  createOrder447CreditProtocol,
  creditSubmissionFinancialFingerprint,
  parseCreditSubmissionTargetMode,
  type Order447CreditProtocolBehavior,
} from "./fixtures/india-native-credit-submission-fixture";

const deployUrl = process.env.YELLOW_ORDER447_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER447_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER447_PROVIDER_JOURNEY === "1";
if (required && (!deployUrl || !runtimeUrl)) {
  throw new Error("Required Order447 credit-provider journey needs exact admitted credentials");
}
const targetMode = required || deployUrl || runtimeUrl
  ? parseCreditSubmissionTargetMode(process.env.YELLOW_ORDER447_TARGET_MODE) : undefined;
if (deployUrl || runtimeUrl) {
  if (!deployUrl || !runtimeUrl) throw new Error("Order447 credit-provider journey requires paired deploy/runtime credentials");
  assertCreditSubmissionTargets(deployUrl, runtimeUrl, "runtime", targetMode!,
    process.env.YELLOW_REQUIRE_ORDER447_CI_CANONICAL === "1", process.env.YELLOW_ORDER447_CI_DATABASE_ADDRESS);
}
const databaseDescribe = required ? describe.serial : describe.skip;

type CreditScenario = Awaited<ReturnType<typeof createCreditSubmissionScenario>> & {
  readonly submissionId: string;
};

interface DurableHead {
  readonly status: string;
  readonly disposition: string;
  readonly responseJson: string | null;
  readonly responseSha256: string | null;
  readonly authorityRef: string | null;
  readonly qrPayload: string | null;
  readonly wireText: string;
  readonly wireSha256: string;
  readonly sourceEvidenceHash: string;
  readonly acceptedHistory: number;
}

function receiptHttpApp(database: Database, tokens: Hs256TokenSigner) {
  const submissions = {
    async request() { throw new Error("credit receipt GET must not request a submission"); },
    async retry() { throw new Error("credit receipt GET must not retry a submission"); },
  };
  const dependencies = {
    submissions,
    adapters: new FiscalSubmissionAdapterAvailabilityService([]),
    receipts: new FiscalSubmissionReceiptReadService(),
  };
  const OperatorConstructor = OperatorHttpApi as unknown as new (...args: unknown[]) => OperatorHttpApi;
  const operator = new OperatorConstructor(
    {}, undefined, ...Array.from({ length: 44 }, () => undefined), dependencies,
  );
  return createApp({ database, tenantResolver: new BearerTenantResolver(tokens), operatorApi: operator });
}

function receiptRequest(scenario: CreditScenario, token: string): Request {
  return new Request(
    `http://yellow.test/api/v1/properties/${scenario.propertyNode}/fiscal-submissions/` +
      `${scenario.submissionId}/receipt`,
    { headers: { authorization: `Bearer ${token}`, "x-correlation-id": crypto.randomUUID() } },
  );
}

function worker(
  repository: FiscalSubmissionRepository,
  registration: VerifiedIndiaIrpAdapterRegistration,
): FiscalSubmissionWorker {
  return new FiscalSubmissionWorker(repository, new VerifiedIndiaIrpAdapterRegistry([registration]));
}

function workerInput(scenario: CreditScenario) {
  return Object.freeze({
    tenantId: scenario.tenantId,
    submissionId: scenario.submissionId,
    providerKey: scenario.provider.providerKey,
    providerExtensionId: scenario.provider.providerExtensionId,
    providerExtensionVersion: scenario.provider.providerExtensionVersion,
    leaseSeconds: 60,
    transportDeadlineMs: 20_000,
  });
}

function expectReconciled(
  result: FiscalSubmissionWorkerStepResult,
  action: "submit" | "lookup",
  status: "submitted" | "accepted",
  disposition: "lookup" | "none",
): void {
  expect(result).toMatchObject({ ok: true, kind: "reconciled", action, status, disposition, replayed: false });
}

function syntheticCreditDocument(): Order440ClearIrpIssuedDocument {
  const documentId = "00000000-0000-4000-8000-000000000447";
  const contentJson = JSON.stringify({
    Version: "1.1",
    TranDtls: { TaxSch: "GST", SupTyp: "B2B" },
    DocDtls: { Typ: "CRN", No: "C/447/1", Dt: "08/09/2044" },
    SellerDtls: { Gstin: "29AAPFU0939F1ZR", LglNm: "Yellow Fictional Hotel",
      Addr1: "1 Fictional Road", Loc: "Bengaluru", Pin: 560001, Stcd: "29" },
    BuyerDtls: { Gstin: "27AAPFU0939F1ZV", LglNm: "Fictional Buyer",
      Addr1: "2 Fictional Road", Loc: "Mumbai", Pin: 400001, Stcd: "27", Pos: "27" },
    ItemList: [{ SlNo: "1", IsServc: "Y", HsnCd: "996311", Qty: "1.000", Unit: "OTH",
      UnitPrice: "100.00", TotAmt: "100.00", AssAmt: "100.00", GstRt: "5.00",
      IgstAmt: "5.00", TotItemVal: "105.00" }],
    ValDtls: { AssVal: "100.00", IgstVal: "5.00", TotInvVal: "105.00" },
    RefDtls: { PrecDocDtls: [{ InvNo: "INV/447/1", InvDt: "07/09/2044" }] },
    YellowCredit: {
      originalDocumentId: "00000000-0000-4000-8000-000000000446",
      originalSha256: "a".repeat(64), reason: "Full synthetic credit",
      correctionJournalId: "00000000-0000-4000-8000-000000000448",
      sourceEvidenceHash: "b".repeat(64),
    },
  });
  const documentSha256 = new Bun.CryptoHasher("sha256").update(contentJson).digest("hex");
  const projected = projectIssuedIndiaIrpWireCandidate({ documentId, documentSha256, contentJson });
  if (!projected.ok) throw new Error(`Order447 synthetic CRN projection failed: ${projected.error.code}`);
  return Object.freeze({ documentId, documentSha256, sourceContentJson: contentJson,
    wireJson: projected.value.wireJson, wireSha256: projected.value.wireSha256, providerKey: "india-irp" });
}

describe("Order447 real-crypto hostile credit protocol fixture", () => {
  test("accepts the exact signed CRN before rejecting signed wrong-reference and QR-type controls", async () => {
    const document = syntheticCreditDocument();
    const submit = async (behavior: Order447CreditProtocolBehavior) => {
      const protocol = await createOrder447CreditProtocol(document, behavior);
      const registration = await protocol.createRegistration({ providerKey: document.providerKey,
        providerExtensionId: crypto.randomUUID(), providerExtensionVersion: 1 });
      const result = await registration.submit(Object.freeze({
        tenantId: "00000000-0000-4000-8000-000000000001",
        providerKey: document.providerKey,
        attemptId: crypto.randomUUID(),
        documentId: document.documentId,
        payloadSha256: document.wireSha256,
        payload: new TextEncoder().encode(document.wireJson),
        documentSha256: document.documentSha256,
        sourceContentJson: document.sourceContentJson,
      }), Object.freeze({ signal: new AbortController().signal, deadlineUnixMs: Date.now() + 20_000 }));
      expect(protocol.metrics()).toMatchObject({ adapterInstances: 1, authenticationRequests: 1,
        submissionPosts: 1, documentLookups: 0, submittedWireSha256: [document.wireSha256] });
      return result;
    };

    const accepted = await submit("accepted");
    expect(accepted).toMatchObject({ verified: true, outcome: "accepted",
      receipt: { kind: "accepted_signed_v1", documentId: document.documentId } });
    for (const behavior of ["wrong_reference", "wrong_qr_doc_type"] as const) {
      expect(await submit(behavior)).toEqual({ verified: true, outcome: "timeout" });
    }
  }, 30_000);
});

databaseDescribe("Order447 genuine native-credit signed-provider journey", () => {
  let deploy: SQL;
  let runtimePool: SQL;
  let database: Database;
  let repository: FiscalSubmissionRepository;
  let service: FiscalSubmissionService;
  let tokens: Hs256TokenSigner;

  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 3, prepare: false, connectionTimeout: 5 });
    runtimePool = new SQL(runtimeUrl!, { max: 4, prepare: false, connectionTimeout: 5 });
    database = Database.connect(runtimeUrl!, { maxConnections: 3, prepare: false });
    repository = new FiscalSubmissionRepository(runtimePool);
    service = new FiscalSubmissionService();
    tokens = new Hs256TokenSigner("order447-credit-provider-synthetic-session-secret-48-bytes");
    const [frontier] = await deploy<{ version: number; installed: boolean }[]>`
      SELECT max(version)::integer AS version,
        position('Order447 authenticated full-credit branch' in
          pg_get_functiondef('public.india_fiscal_submission_project_wire(uuid,uuid,uuid)'::regprocedure)) > 0
          AS installed
      FROM public.schema_migration`;
    const expectedFrontier = targetMode === "native-draft" ? 87 : 88;
    if (frontier?.version !== expectedFrontier || frontier.installed !== true) {
      throw new Error("Order447 credit-provider journey requires its exact admitted projector frontier");
    }
  }, 30_000);

  afterAll(async () => {
    await database?.close();
    await runtimePool?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  }, 30_000);

  async function durableHead(scenario: CreditScenario): Promise<DurableHead> {
    const [row] = await deploy<DurableHead[]>`
      SELECT submission.status,submission.disposition,submission.response::text AS "responseJson",
        submission.response_sha256 AS "responseSha256",submission.authority_ref AS "authorityRef",
        submission.qr_payload AS "qrPayload",submission.wire_text AS "wireText",
        submission.wire_sha256 AS "wireSha256",credit.source_evidence_hash AS "sourceEvidenceHash",
        (SELECT count(*)::integer FROM public.fiscal_submission_history history
          WHERE history.tenant_id=submission.tenant_id AND history.submission_id=submission.id
            AND history.status='accepted') AS "acceptedHistory"
      FROM public.fiscal_submission submission
      JOIN public.india_native_fiscal_credit_note credit
        ON credit.tenant_id=submission.tenant_id AND credit.document_id=submission.document_id
      WHERE submission.tenant_id=${scenario.tenantId}::uuid AND submission.id=${scenario.submissionId}::uuid`;
    if (!row) throw new Error("Order447 durable credit submission head is unavailable");
    return row;
  }

  async function arrange(behavior: Order447CreditProtocolBehavior): Promise<{
    readonly scenario: CreditScenario;
    readonly protocol: Order440ClearIrpProtocol;
    readonly token: string;
    readonly financialBefore: string;
    readonly initialReceipt: FiscalSubmissionReceipt;
    readonly request: Readonly<{
      tenantId: string; propertyNode: string; documentId: string; providerExtensionId: string;
      actorId: string; idempotencyKey: string; requestId: string;
    }>;
  }> {
    const base = await createCreditSubmissionScenario(deploy, database, { roomNightAmounts: ["10000"] });
    const financialBefore = await creditSubmissionFinancialFingerprint(deploy, base.tenantId);
    const request = Object.freeze({
      tenantId: base.tenantId,
      propertyNode: base.propertyNode,
      documentId: base.documentId,
      providerExtensionId: base.provider.providerExtensionId,
      actorId: base.actorId,
      idempotencyKey: `credit-provider-${crypto.randomUUID()}`,
      requestId: crypto.randomUUID(),
    });
    const first = await database.withTenantTransaction(base.tenantId, tx => service.request(tx, request));
    if (!first.ok) throw new Error(`Order447 submission request failed: ${first.error.code}`);
    expect(first.value.replayed).toBe(false);
    const replay = await database.withTenantTransaction(base.tenantId, tx => service.request(tx, request));
    if (!replay.ok) throw new Error(`Order447 submission replay failed: ${replay.error.code}`);
    expect(replay.value).toEqual({ ...first.value, replayed: true });
    const scenario: CreditScenario = Object.freeze({ ...base, submissionId: first.value.submissionId });
    const [source] = await deploy<{ documentSha256: string; contentJson: string }[]>`
      SELECT sha256 AS "documentSha256",content::text AS "contentJson"
      FROM public.document
      WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.documentId}::uuid`;
    if (!source) throw new Error("Order447 issued credit source is unavailable");
    const projected = projectIssuedIndiaIrpWireCandidate({
      documentId: scenario.documentId,
      documentSha256: source.documentSha256,
      contentJson: source.contentJson,
    });
    if (!projected.ok) throw new Error(`Order447 credit projection failed: ${projected.error.code}`);
    expect(JSON.parse(projected.value.wireJson)).toMatchObject({
      DocDtls: { Typ: "CRN", No: scenario.credit.docNo },
      RefDtls: { PrecDocDtls: [{ InvNo: scenario.candidate.invoice.docNo }] },
    });
    expect(projected.value.wireJson).not.toContain("YellowCredit");
    const document: Order440ClearIrpIssuedDocument = Object.freeze({
      documentId: scenario.documentId,
      documentSha256: source.documentSha256,
      sourceContentJson: source.contentJson,
      wireJson: projected.value.wireJson,
      wireSha256: projected.value.wireSha256,
      providerKey: scenario.provider.providerKey,
    });
    const [protocol, token] = await Promise.all([
      createOrder447CreditProtocol(document, behavior),
      tokens.issue({ userId: scenario.actorId, tenantId: scenario.tenantId,
        scopes: [FISCAL_RECEIPT_READ_SCOPE] }),
    ]);
    return { scenario, protocol, token, financialBefore, request, initialReceipt: first.value };
  }

  async function runFresh(scenario: CreditScenario, protocol: Order440ClearIrpProtocol) {
    const registration = await protocol.createRegistration(scenario.provider);
    return worker(repository, registration).runOnce(workerInput(scenario));
  }

  async function waitForLookupDue(scenario: CreditScenario): Promise<void> {
    const expiresAt = performance.now() + 20_000;
    while (performance.now() < expiresAt) {
      const [row] = await deploy<{ due: boolean; remainingMs: number }[]>`
        SELECT claim_expires_at + interval '15 seconds' <= clock_timestamp() AS due,
          ceil(greatest(0,extract(epoch FROM (
            claim_expires_at + interval '15 seconds' - clock_timestamp()
          )) * 1000))::integer AS "remainingMs"
        FROM public.fiscal_submission
        WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.submissionId}::uuid
          AND status='submitted' AND disposition='lookup'`;
      if (!row || typeof row.due !== "boolean" || !Number.isInteger(row.remainingMs) || row.remainingMs < 0) {
        throw new Error("Order447 credit submission lookup state is invalid");
      }
      if (row.due) return;
      const remainingBudget = Math.floor(expiresAt - performance.now());
      if (remainingBudget < 1) break;
      await Bun.sleep(Math.max(1, Math.min(row.remainingMs, remainingBudget, 250)));
    }
    throw new Error("Order447 credit submission did not naturally become lookup-due");
  }

  async function getReceiptBytes(scenario: CreditScenario, token: string): Promise<string> {
    const response = await receiptHttpApp(database, tokens).handle(receiptRequest(scenario, token));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    return response.text();
  }

  test("sends exact CRN bytes, recovers one genuine signed acceptance and preserves durable replay", async () => {
    const { scenario, protocol, token, financialBefore, request, initialReceipt } = await arrange("accepted_after_response_loss");
    expectReconciled(await runFresh(scenario, protocol), "submit", "submitted", "lookup");
    expect(protocol.metrics()).toMatchObject({ submissionPosts: 1, documentLookups: 0 });
    await waitForLookupDue(scenario);
    expectReconciled(await runFresh(scenario, protocol), "lookup", "accepted", "none");
    expect(protocol.metrics()).toMatchObject({ submissionPosts: 1, documentLookups: 1 });

    const head = await durableHead(scenario);
    expect(head).toMatchObject({ status: "accepted", disposition: "none", acceptedHistory: 1,
      sourceEvidenceHash: scenario.credit.sourceEvidenceHash });
    expect(head.wireText).not.toContain("YellowCredit");
    expect(protocol.metrics().submittedWireSha256).toEqual([head.wireSha256]);
    expect(head.responseJson).not.toBeNull();
    const raw = JSON.parse(head.responseJson!) as { receipt?: Record<string, unknown> };
    expect(raw.receipt).toMatchObject({ kind: "accepted_signed_v1", documentId: scenario.documentId });
    const signedQRCode = raw.receipt?.signedQRCode;
    expect(typeof signedQRCode).toBe("string");
    if (typeof signedQRCode !== "string") throw new Error("Order447 durable signed QR is unavailable");
    expect(head.qrPayload).toBe(signedQRCode);

    const firstBytes = await getReceiptBytes(scenario, token);
    const secondBytes = await getReceiptBytes(scenario, token);
    expect(secondBytes).toBe(firstBytes);
    expect(firstBytes).not.toMatch(/rawResponse|decryptedData|wireJson|sourceContent|YellowCredit/u);
    const body = JSON.parse(firstBytes) as { fiscalSubmissionReceipt: FiscalSubmissionDeliveryReceipt };
    expect(body.fiscalSubmissionReceipt).toMatchObject({ kind: "accepted_signed_v1", status: "accepted",
      documentId: scenario.documentId, submissionId: scenario.submissionId });

    const existing = await database.withTenantTransaction(scenario.tenantId, tx => service.request(tx, request));
    expect(existing.ok).toBe(true);
    if (!existing.ok) throw new Error(existing.error.code);
    // Q205/0079 replays the immutable command receipt, not today's delivery head.
    expect(initialReceipt).toMatchObject({ status: "pending", disposition: "send", transitionSeq: 1 });
    expect(existing.value).toEqual({ ...initialReceipt, replayed: true });
    const existingReplay = await database.withTenantTransaction(scenario.tenantId, tx => service.request(tx, request));
    expect(existingReplay.ok && existingReplay.value).toEqual(existing.value);
    expect(await durableHead(scenario)).toEqual(head);
    expect(await creditSubmissionFinancialFingerprint(deploy, scenario.tenantId)).toBe(financialBefore);
  }, 120_000);

  test("keeps freshly signed wrong references and wrong QR document types out of durable success", async () => {
    for (const behavior of ["wrong_reference", "wrong_qr_doc_type"] as const) {
      const { scenario, protocol, token, financialBefore } = await arrange(behavior);
      expectReconciled(await runFresh(scenario, protocol), "submit", "submitted", "lookup");
      expect(protocol.metrics()).toMatchObject({ authenticationRequests: 1, submissionPosts: 1,
        documentLookups: 0 });
      const head = await durableHead(scenario);
      expect(head).toMatchObject({ status: "submitted", disposition: "lookup",
        responseSha256: null, authorityRef: null, qrPayload: null, acceptedHistory: 0,
        sourceEvidenceHash: scenario.credit.sourceEvidenceHash });
      expect(typeof head.responseJson).toBe("string");
      const retained = JSON.parse(head.responseJson!) as Record<string, unknown>;
      expect(retained).toMatchObject({ type: "transport_result", outcome: "timeout",
        documentId: scenario.documentId, payloadSha256: head.wireSha256 });
      expect(retained).not.toHaveProperty("receipt");
      const receiptBytes = await getReceiptBytes(scenario, token);
      const body = JSON.parse(receiptBytes) as { fiscalSubmissionReceipt: FiscalSubmissionDeliveryReceipt };
      expect(body.fiscalSubmissionReceipt).toMatchObject({ kind: "pending", status: "submitted",
        disposition: "lookup", documentId: scenario.documentId });
      expect(receiptBytes).not.toMatch(/signedInvoice|signedQRCode|authorityRef|YellowCredit/u);
      expect(await creditSubmissionFinancialFingerprint(deploy, scenario.tenantId)).toBe(financialBefore);
    }
  }, 120_000);
});
